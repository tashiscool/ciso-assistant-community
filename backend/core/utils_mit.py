# MIT License - See LICENSE-MIT.txt in repository root
"""
Core Utilities - Clean-room MIT implementation

Common utility functions for GRC operations including:
- String manipulation
- Date/time utilities
- Hash functions
- Role and permission constants
"""

import hashlib
import json
from enum import Enum
from re import sub
from typing import Any, Optional, List, Dict
from datetime import datetime, date, timedelta
import calendar


def sizeof_json(obj: Any) -> int:
    """
    Returns the size of a JSON-encoded object in bytes.

    Args:
        obj: Object to measure (will be JSON-encoded)

    Returns:
        Size in bytes
    """
    if isinstance(obj, (bytes, bytearray, memoryview)):
        return len(obj)
    return len(json.dumps(obj).encode("utf-8"))


def camel_case(s: str) -> str:
    """
    Convert a string to camelCase.

    Args:
        s: String with underscores or hyphens

    Returns:
        camelCase string
    """
    if not s:
        return ""
    s = sub(r"(_|-)+", " ", s).title().replace(" ", "")
    return "".join([s[0].lower(), s[1:]])


def snake_case(s: str) -> str:
    """
    Convert a string to snake_case.

    Args:
        s: CamelCase or space-separated string

    Returns:
        snake_case string
    """
    if not s:
        return ""
    # Insert underscore before uppercase letters
    result = sub(r'([A-Z])', r'_\1', s)
    # Replace spaces and hyphens with underscores
    result = sub(r'[\s-]+', '_', result)
    # Remove leading underscore and convert to lowercase
    return result.lstrip('_').lower()


def sha256(data: bytes) -> str:
    """
    Return the SHA256 hash of bytes as hexadecimal string.

    Args:
        data: Bytes to hash

    Returns:
        64-character hexadecimal string
    """
    h = hashlib.new("SHA256")
    h.update(data)
    return h.hexdigest()


def md5(data: bytes) -> str:
    """
    Return the MD5 hash of bytes as hexadecimal string.

    Args:
        data: Bytes to hash

    Returns:
        32-character hexadecimal string
    """
    h = hashlib.new("MD5")
    h.update(data)
    return h.hexdigest()


class RoleCodename(Enum):
    """Built-in role codenames."""
    ADMINISTRATOR = "BI-RL-ADM"
    DOMAIN_MANAGER = "BI-RL-DMA"
    ANALYST = "BI-RL-ANA"
    APPROVER = "BI-RL-APP"
    READER = "BI-RL-AUD"
    THIRD_PARTY_RESPONDENT = "BI-RL-TPR"

    def __str__(self) -> str:
        return self.value


class UserGroupCodename(Enum):
    """Built-in user group codenames."""
    ADMINISTRATOR = "BI-UG-ADM"
    GLOBAL_READER = "BI-UG-GAD"
    GLOBAL_APPROVER = "BI-UG-GAP"
    DOMAIN_MANAGER = "BI-UG-DMA"
    ANALYST = "BI-UG-ANA"
    APPROVER = "BI-UG-APP"
    READER = "BI-UG-AUD"
    THIRD_PARTY_RESPONDENT = "BI-UG-TPR"

    def __str__(self) -> str:
        return self.value


# Built-in role display names
BUILTIN_ROLE_CODENAMES = {
    str(RoleCodename.ADMINISTRATOR): "Administrator",
    str(RoleCodename.DOMAIN_MANAGER): "Domain manager",
    str(RoleCodename.ANALYST): "Analyst",
    str(RoleCodename.APPROVER): "Approver",
    str(RoleCodename.READER): "Reader",
    str(RoleCodename.THIRD_PARTY_RESPONDENT): "Third-party respondent",
}

# Built-in user group display names
BUILTIN_USERGROUP_CODENAMES = {
    str(UserGroupCodename.ADMINISTRATOR): "Administrator",
    str(UserGroupCodename.GLOBAL_READER): "Global reader",
    str(UserGroupCodename.GLOBAL_APPROVER): "Global approver",
    str(UserGroupCodename.DOMAIN_MANAGER): "Domain manager",
    str(UserGroupCodename.ANALYST): "Analyst",
    str(UserGroupCodename.APPROVER): "Approver",
    str(UserGroupCodename.READER): "Reader",
    str(UserGroupCodename.THIRD_PARTY_RESPONDENT): "Third-party respondent",
}


def get_month_range(year: int, month: int) -> tuple:
    """
    Get the start and end dates for a month.

    Args:
        year: Year
        month: Month (1-12)

    Returns:
        Tuple of (start_date, end_date)
    """
    start = date(year, month, 1)
    _, last_day = calendar.monthrange(year, month)
    end = date(year, month, last_day)
    return (start, end)


def get_quarter_range(year: int, quarter: int) -> tuple:
    """
    Get the start and end dates for a quarter.

    Args:
        year: Year
        quarter: Quarter (1-4)

    Returns:
        Tuple of (start_date, end_date)
    """
    start_month = (quarter - 1) * 3 + 1
    end_month = start_month + 2
    start = date(year, start_month, 1)
    _, last_day = calendar.monthrange(year, end_month)
    end = date(year, end_month, last_day)
    return (start, end)


def get_year_range(year: int) -> tuple:
    """
    Get the start and end dates for a year.

    Args:
        year: Year

    Returns:
        Tuple of (start_date, end_date)
    """
    return (date(year, 1, 1), date(year, 12, 31))


def parse_date(value: Any) -> Optional[date]:
    """
    Parse a date from various formats.

    Args:
        value: Date string, datetime, or date object

    Returns:
        date object or None if parsing fails
    """
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        # Try common formats
        for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
    return None


def parse_datetime(value: Any) -> Optional[datetime]:
    """
    Parse a datetime from various formats.

    Args:
        value: Datetime string or datetime object

    Returns:
        datetime object or None if parsing fails
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        # Try ISO format first
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            pass
        # Try common formats
        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M:%S"]:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
    return None


def truncate_string(s: str, max_length: int, suffix: str = "...") -> str:
    """
    Truncate a string to max length with suffix.

    Args:
        s: String to truncate
        max_length: Maximum length including suffix
        suffix: Suffix to add if truncated

    Returns:
        Truncated string
    """
    if not s or len(s) <= max_length:
        return s or ""
    return s[:max_length - len(suffix)] + suffix


def safe_int(value: Any, default: int = 0) -> int:
    """
    Safely convert value to integer.

    Args:
        value: Value to convert
        default: Default if conversion fails

    Returns:
        Integer value
    """
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def safe_float(value: Any, default: float = 0.0) -> float:
    """
    Safely convert value to float.

    Args:
        value: Value to convert
        default: Default if conversion fails

    Returns:
        Float value
    """
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def deep_merge(base: dict, override: dict) -> dict:
    """
    Deep merge two dictionaries.

    Args:
        base: Base dictionary
        override: Override dictionary

    Returns:
        Merged dictionary
    """
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def flatten_dict(d: dict, parent_key: str = "", sep: str = ".") -> dict:
    """
    Flatten a nested dictionary.

    Args:
        d: Dictionary to flatten
        parent_key: Parent key prefix
        sep: Separator between keys

    Returns:
        Flattened dictionary
    """
    items = []
    for k, v in d.items():
        new_key = parent_key + sep + k if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def unflatten_dict(d: dict, sep: str = ".") -> dict:
    """
    Unflatten a dictionary with dot-notation keys.

    Args:
        d: Flattened dictionary
        sep: Separator between keys

    Returns:
        Nested dictionary
    """
    result = {}
    for key, value in d.items():
        parts = key.split(sep)
        current = result
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value
    return result


def chunk_list(lst: list, chunk_size: int) -> List[list]:
    """
    Split a list into chunks of specified size.

    Args:
        lst: List to split
        chunk_size: Maximum items per chunk

    Returns:
        List of chunks
    """
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]


def unique_by_key(items: List[dict], key: str) -> List[dict]:
    """
    Remove duplicates from list of dicts by key.

    Args:
        items: List of dictionaries
        key: Key to use for uniqueness

    Returns:
        List with duplicates removed (keeps first)
    """
    seen = set()
    result = []
    for item in items:
        k = item.get(key)
        if k not in seen:
            seen.add(k)
            result.append(item)
    return result
