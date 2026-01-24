"""
Identity and Access Management Models - MIT Licensed

Clean-room implementation of folder-based hierarchical RBAC.
Copyright (c) 2026 Tash

This module provides:
- Folder: Hierarchical organizational structure (ROOT, DOMAIN, ENCLAVE)
- FolderMixin: Multi-tenant scoping mixin for models
- User, UserGroup: User and group management
- Role, RoleAssignment: Permission management with folder-based scoping
- PersonalAccessToken: API authentication
- AuditLog: Security event logging
"""

# Lazy imports to allow testing without Django
__all__ = [
    # Folder hierarchy
    'Folder',
    'FolderMixin',
    'PublishInRootFolderMixin',
    # User management
    'User',
    'UserGroup',
    # RBAC
    'Role',
    'RoleAssignment',
    # API authentication
    'PersonalAccessToken',
    # Audit
    'AuditLog',
]


def __getattr__(name):
    """Lazy import to avoid Django dependency at import time."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
