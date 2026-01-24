# MIT License - See LICENSE-MIT.txt in repository root
"""
Tests for core/utils_mit.py (Core utilities)

Standalone tests that can run without Django using unittest.
"""

import unittest
from datetime import date, datetime


class TestStringUtilities(unittest.TestCase):
    """Test string manipulation utilities."""

    def test_camel_case(self):
        """Test camelCase conversion."""
        from core.utils_mit import camel_case
        self.assertEqual(camel_case("hello_world"), "helloWorld")
        self.assertEqual(camel_case("my-variable-name"), "myVariableName")
        self.assertEqual(camel_case(""), "")
        self.assertEqual(camel_case("Already"), "already")

    def test_snake_case(self):
        """Test snake_case conversion."""
        from core.utils_mit import snake_case
        self.assertEqual(snake_case("helloWorld"), "hello_world")
        self.assertEqual(snake_case("MyVariableName"), "my_variable_name")
        self.assertEqual(snake_case(""), "")
        self.assertEqual(snake_case("already_snake"), "already_snake")

    def test_truncate_string(self):
        """Test string truncation."""
        from core.utils_mit import truncate_string
        self.assertEqual(truncate_string("Hello World", 8), "Hello...")
        self.assertEqual(truncate_string("Short", 10), "Short")
        self.assertEqual(truncate_string("", 5), "")
        self.assertEqual(truncate_string(None, 5), "")

    def test_truncate_string_custom_suffix(self):
        """Test string truncation with custom suffix."""
        from core.utils_mit import truncate_string
        self.assertEqual(truncate_string("Hello World", 9, ">>"), "Hello W>>")


class TestHashUtilities(unittest.TestCase):
    """Test hash utilities."""

    def test_sha256(self):
        """Test SHA256 hash."""
        from core.utils_mit import sha256
        result = sha256(b"test")
        self.assertEqual(len(result), 64)
        self.assertEqual(
            result,
            "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
        )

    def test_md5(self):
        """Test MD5 hash."""
        from core.utils_mit import md5
        result = md5(b"test")
        self.assertEqual(len(result), 32)
        self.assertEqual(result, "098f6bcd4621d373cade4e832627b4f6")


class TestJsonUtilities(unittest.TestCase):
    """Test JSON utilities."""

    def test_sizeof_json(self):
        """Test JSON size calculation."""
        from core.utils_mit import sizeof_json
        self.assertEqual(sizeof_json({"a": 1}), 8)  # '{"a": 1}'
        self.assertEqual(sizeof_json([1, 2, 3]), 9)  # '[1, 2, 3]'

    def test_sizeof_json_bytes(self):
        """Test sizeof_json with bytes input."""
        from core.utils_mit import sizeof_json
        self.assertEqual(sizeof_json(b"hello"), 5)


class TestDateUtilities(unittest.TestCase):
    """Test date utilities."""

    def test_get_month_range(self):
        """Test getting month range."""
        from core.utils_mit import get_month_range
        start, end = get_month_range(2024, 2)
        self.assertEqual(start, date(2024, 2, 1))
        self.assertEqual(end, date(2024, 2, 29))  # Leap year

    def test_get_quarter_range(self):
        """Test getting quarter range."""
        from core.utils_mit import get_quarter_range
        start, end = get_quarter_range(2024, 1)
        self.assertEqual(start, date(2024, 1, 1))
        self.assertEqual(end, date(2024, 3, 31))

    def test_get_year_range(self):
        """Test getting year range."""
        from core.utils_mit import get_year_range
        start, end = get_year_range(2024)
        self.assertEqual(start, date(2024, 1, 1))
        self.assertEqual(end, date(2024, 12, 31))

    def test_parse_date(self):
        """Test date parsing."""
        from core.utils_mit import parse_date
        self.assertEqual(parse_date("2024-06-15"), date(2024, 6, 15))
        self.assertEqual(parse_date("15/06/2024"), date(2024, 6, 15))
        self.assertIsNone(parse_date("invalid"))
        self.assertIsNone(parse_date(None))

    def test_parse_datetime(self):
        """Test datetime parsing."""
        from core.utils_mit import parse_datetime
        result = parse_datetime("2024-06-15T10:30:00")
        self.assertEqual(result.year, 2024)
        self.assertEqual(result.month, 6)
        self.assertEqual(result.hour, 10)


class TestSafeConversions(unittest.TestCase):
    """Test safe type conversions."""

    def test_safe_int(self):
        """Test safe integer conversion."""
        from core.utils_mit import safe_int
        self.assertEqual(safe_int("42"), 42)
        self.assertEqual(safe_int(3.7), 3)
        self.assertEqual(safe_int("invalid", 0), 0)
        self.assertEqual(safe_int(None, 10), 10)

    def test_safe_float(self):
        """Test safe float conversion."""
        from core.utils_mit import safe_float
        self.assertEqual(safe_float("3.14"), 3.14)
        self.assertEqual(safe_float(42), 42.0)
        self.assertEqual(safe_float("invalid", 0.0), 0.0)
        self.assertEqual(safe_float(None, 1.5), 1.5)


class TestDictUtilities(unittest.TestCase):
    """Test dictionary utilities."""

    def test_deep_merge(self):
        """Test deep dictionary merge."""
        from core.utils_mit import deep_merge
        base = {"a": 1, "b": {"c": 2}}
        override = {"b": {"d": 3}, "e": 4}
        result = deep_merge(base, override)
        self.assertEqual(result, {"a": 1, "b": {"c": 2, "d": 3}, "e": 4})

    def test_flatten_dict(self):
        """Test dictionary flattening."""
        from core.utils_mit import flatten_dict
        nested = {"a": {"b": {"c": 1}}, "d": 2}
        result = flatten_dict(nested)
        self.assertEqual(result, {"a.b.c": 1, "d": 2})

    def test_unflatten_dict(self):
        """Test dictionary unflattening."""
        from core.utils_mit import unflatten_dict
        flat = {"a.b.c": 1, "d": 2}
        result = unflatten_dict(flat)
        self.assertEqual(result, {"a": {"b": {"c": 1}}, "d": 2})


class TestListUtilities(unittest.TestCase):
    """Test list utilities."""

    def test_chunk_list(self):
        """Test list chunking."""
        from core.utils_mit import chunk_list
        result = chunk_list([1, 2, 3, 4, 5], 2)
        self.assertEqual(result, [[1, 2], [3, 4], [5]])

    def test_unique_by_key(self):
        """Test list deduplication by key."""
        from core.utils_mit import unique_by_key
        items = [
            {"id": 1, "name": "a"},
            {"id": 2, "name": "b"},
            {"id": 1, "name": "c"},
        ]
        result = unique_by_key(items, "id")
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "a")


class TestRoleCodenames(unittest.TestCase):
    """Test role and usergroup codenames."""

    def test_role_codename_values(self):
        """Test RoleCodename enum values."""
        from core.utils_mit import RoleCodename
        self.assertEqual(str(RoleCodename.ADMINISTRATOR), "BI-RL-ADM")
        self.assertEqual(str(RoleCodename.ANALYST), "BI-RL-ANA")

    def test_usergroup_codename_values(self):
        """Test UserGroupCodename enum values."""
        from core.utils_mit import UserGroupCodename
        self.assertEqual(str(UserGroupCodename.ADMINISTRATOR), "BI-UG-ADM")
        self.assertEqual(str(UserGroupCodename.ANALYST), "BI-UG-ANA")

    def test_builtin_role_names(self):
        """Test builtin role display names."""
        from core.utils_mit import BUILTIN_ROLE_CODENAMES
        self.assertIn("BI-RL-ADM", BUILTIN_ROLE_CODENAMES)
        self.assertEqual(BUILTIN_ROLE_CODENAMES["BI-RL-ADM"], "Administrator")


if __name__ == '__main__':
    unittest.main()
