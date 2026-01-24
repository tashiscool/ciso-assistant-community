"""
Serdes Module - MIT Licensed

Serialization and Deserialization for backup/restore functionality.
Copyright (c) 2026 Tash

This module provides:
- Backup: Export system data to portable format
- Restore: Import data from backup files
- Dependency resolution for complex object graphs
- Import/export of libraries, frameworks, and assessments
"""

# Lazy imports to allow testing without Django
__all__ = [
    'create_backup',
    'BackupWriter',
    'restore_backup',
    'BackupReader',
    'serialize_model_instance',
    'deserialize_model_instance',
    'resolve_dependencies',
]


def __getattr__(name):
    """Lazy import to avoid Django dependency at import time."""
    if name in ('create_backup', 'BackupWriter'):
        from . import backup
        return getattr(backup, name)
    elif name in ('restore_backup', 'BackupReader'):
        from . import restore
        return getattr(restore, name)
    elif name in ('serialize_model_instance', 'deserialize_model_instance', 'resolve_dependencies'):
        from . import utils
        return getattr(utils, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
