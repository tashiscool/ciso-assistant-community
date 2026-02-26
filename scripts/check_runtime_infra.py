#!/usr/bin/env python3
"""
Validate local runtime infrastructure dependencies used by end-to-end tests.

Checks:
1) Redis read/write/delete against configured host.
2) S3-compatible object storage read/write/delete against configured bucket.
"""

from __future__ import annotations

import argparse
import os
import socket
import ssl
import sys
import uuid


def _as_bool(value: str | None) -> bool:
    return str(value).lower() in {"1", "true", "yes", "on"}


def _print(status: str, message: str) -> None:
    print(f"[{status}] {message}")


def _encode_redis_command(*parts: str) -> bytes:
    encoded_parts = [
        f"${len(part.encode('utf-8'))}\r\n{part}\r\n"
        for part in parts
    ]
    return f"*{len(parts)}\r\n{''.join(encoded_parts)}".encode("utf-8")


def _read_redis_line(sock: socket.socket) -> bytes:
    data = b""
    while not data.endswith(b"\r\n"):
        chunk = sock.recv(1)
        if not chunk:
            break
        data += chunk
    return data


def _read_redis_response(sock: socket.socket):
    prefix = sock.recv(1)
    if not prefix:
        raise RuntimeError("Redis returned an empty response")

    if prefix == b"+":
        return _read_redis_line(sock).decode("utf-8").strip()
    if prefix == b":":
        return int(_read_redis_line(sock).decode("utf-8").strip())
    if prefix == b"$":
        length = int(_read_redis_line(sock).decode("utf-8").strip())
        if length == -1:
            return None
        payload = b""
        while len(payload) < length + 2:
            payload += sock.recv(length + 2 - len(payload))
        return payload[:-2].decode("utf-8")
    if prefix == b"-":
        raise RuntimeError(_read_redis_line(sock).decode("utf-8").strip())

    raise RuntimeError(f"Unsupported Redis response prefix: {prefix!r}")


def _run_redis_command(sock: socket.socket, *parts: str):
    sock.sendall(_encode_redis_command(*parts))
    return _read_redis_response(sock)


def check_redis(require: bool) -> bool:
    redis_enabled = _as_bool(os.getenv("USE_REDIS", "False")) or require
    if not redis_enabled:
        _print("SKIP", "Redis check skipped (USE_REDIS is false).")
        return True

    host = os.getenv("REDIS_HOST", "localhost")
    port = int(os.getenv("REDIS_PORT", "6379"))
    db = os.getenv("REDIS_DB", "0")
    password = os.getenv("REDIS_PASSWORD")
    use_ssl = _as_bool(os.getenv("REDIS_SSL", "False"))

    key = f"ciso-assistant:infra-check:{uuid.uuid4().hex}"
    value = f"value-{uuid.uuid4().hex}"
    try:
        base_sock = socket.create_connection((host, port), timeout=5)
        base_sock.settimeout(5)
        sock = base_sock
        if use_ssl:
            context = ssl.create_default_context()
            sock = context.wrap_socket(base_sock, server_hostname=host)

        with sock:
            if password:
                auth_result = _run_redis_command(sock, "AUTH", password)
                if str(auth_result).upper() != "OK":
                    raise RuntimeError(f"AUTH failed: {auth_result}")
            select_result = _run_redis_command(sock, "SELECT", str(db))
            if str(select_result).upper() != "OK":
                raise RuntimeError(f"SELECT failed: {select_result}")
            set_result = _run_redis_command(sock, "SET", key, value, "EX", "60")
            if str(set_result).upper() != "OK":
                raise RuntimeError(f"SET failed: {set_result}")
            got = _run_redis_command(sock, "GET", key)
            _run_redis_command(sock, "DEL", key)
    except Exception as exc:
        _print(
            "FAIL",
            f"Redis connectivity failed for {host}:{port}/{db} (ssl={use_ssl}): {exc}",
        )
        return False

    if got != value:
        _print("FAIL", "Redis round-trip value mismatch.")
        return False

    _print("PASS", f"Redis round-trip succeeded for {host}:{port}/{db} (ssl={use_ssl}).")
    return True


def check_s3(require: bool) -> bool:
    s3_enabled = _as_bool(os.getenv("USE_S3", "False")) or require
    if not s3_enabled:
        _print("SKIP", "S3 check skipped (USE_S3 is false).")
        return True

    bucket = os.getenv("AWS_STORAGE_BUCKET_NAME")
    if not bucket:
        _print("FAIL", "AWS_STORAGE_BUCKET_NAME must be set for S3 check.")
        return False

    try:
        import boto3
        from botocore.config import Config
    except Exception as exc:  # pragma: no cover
        _print("FAIL", f"S3 client import failed: {exc}")
        return False

    region = os.getenv("AWS_S3_REGION_NAME", os.getenv("AWS_REGION", "us-east-1"))
    endpoint_url = os.getenv("AWS_S3_ENDPOINT_URL")
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

    client_kwargs = {
        "service_name": "s3",
        "region_name": region,
        "endpoint_url": endpoint_url,
        "config": Config(connect_timeout=5, read_timeout=5, retries={"max_attempts": 1}),
    }
    if access_key and secret_key:
        client_kwargs["aws_access_key_id"] = access_key
        client_kwargs["aws_secret_access_key"] = secret_key

    key = f"ciso-assistant/infra-check/{uuid.uuid4().hex}.txt"
    body = f"infra-check-{uuid.uuid4().hex}".encode("utf-8")

    try:
        client = boto3.client(**client_kwargs)
        client.put_object(Bucket=bucket, Key=key, Body=body)
        result = client.get_object(Bucket=bucket, Key=key)
        downloaded = result["Body"].read()
        client.delete_object(Bucket=bucket, Key=key)
    except Exception as exc:
        endpoint_hint = endpoint_url or "aws-default-endpoint"
        _print(
            "FAIL",
            f"S3 connectivity failed for bucket={bucket}, endpoint={endpoint_hint}: {exc}",
        )
        return False

    if downloaded != body:
        _print("FAIL", "S3 round-trip object content mismatch.")
        return False

    endpoint_hint = endpoint_url or "aws-default-endpoint"
    _print(
        "PASS",
        f"S3 round-trip succeeded for bucket={bucket}, endpoint={endpoint_hint}.",
    )
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate Redis + S3 runtime integrations used for local E2E.",
    )
    parser.add_argument(
        "--require-redis",
        action="store_true",
        help="Fail when Redis validation is skipped.",
    )
    parser.add_argument(
        "--require-s3",
        action="store_true",
        help="Fail when S3 validation is skipped.",
    )
    args = parser.parse_args()

    results = [
        check_redis(require=args.require_redis),
        check_s3(require=args.require_s3),
    ]
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
