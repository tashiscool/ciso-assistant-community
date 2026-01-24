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

from .models import StoredLibrary, LoadedLibrary
from .utils import LibraryImporter, validate_library, preview_library

__all__ = [
    'StoredLibrary',
    'LoadedLibrary',
    'LibraryImporter',
    'validate_library',
    'preview_library',
]
