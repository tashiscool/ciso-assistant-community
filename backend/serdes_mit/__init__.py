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

from .backup import create_backup, BackupWriter
from .restore import restore_backup, BackupReader
from .utils import (
    serialize_model_instance,
    deserialize_model_instance,
    resolve_dependencies,
)

__all__ = [
    'create_backup',
    'BackupWriter',
    'restore_backup',
    'BackupReader',
    'serialize_model_instance',
    'deserialize_model_instance',
    'resolve_dependencies',
]
