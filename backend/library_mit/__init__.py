"""
Library Management Module - MIT Licensed

Clean-room implementation of reference library management.
Copyright (c) 2026 Tash

This module provides:
- StoredLibrary: Libraries stored on the system
- LoadedLibrary: Libraries loaded and active
- Library import/export functionality
- Version management and updates
"""

# Lazy imports to allow testing without Django
__all__ = [
    'StoredLibrary',
    'LoadedLibrary',
    'LibraryImporter',
    'validate_library',
    'preview_library',
]


def __getattr__(name):
    """Lazy import to avoid Django dependency at import time."""
    if name in ('StoredLibrary', 'LoadedLibrary'):
        from . import models
        return getattr(models, name)
    elif name in ('LibraryImporter', 'validate_library', 'preview_library'):
        from . import utils
        return getattr(utils, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
