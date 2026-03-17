import { base64UrlDecode, base64UrlEncode } from "./http";

interface SignedPayload {
  tenant_id: string;
  object_key: string;
  method: "PUT" | "GET";
  bucket: "evidence" | "import" | "export" | "snapshot";
  content_type?: string;
  expires_at: number;
}

const encoder = new TextEncoder();

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signPayload(payload: SignedPayload, secret: string): Promise<string> {
  const key = await importSigningKey(secret);
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);

  return [base64UrlEncode(payloadBytes), base64UrlEncode(new Uint8Array(signature))].join(".");
}

export async function verifyPayload(token: string, secret: string): Promise<SignedPayload | null> {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    return null;
  }

  const key = await importSigningKey(secret);
  const payloadBytes = base64UrlDecode(payloadPart);
  const payloadView = new Uint8Array(payloadBytes.length);
  payloadView.set(payloadBytes);
  const signatureBytes = base64UrlDecode(signaturePart);
  const signatureView = new Uint8Array(signatureBytes.length);
  signatureView.set(signatureBytes);

  const isValid = await crypto.subtle.verify("HMAC", key, signatureView, payloadView);
  if (!isValid) {
    return null;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadView)) as SignedPayload;
    if (!payload.expires_at || Date.now() > payload.expires_at) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export type { SignedPayload };
