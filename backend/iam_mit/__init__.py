"""
Identity and Access Management Models - MIT Licensed

Clean-room implementation of IAM for GRC platform.
Copyright (c) 2026 Tash

This module provides:
- User: Extended user model for GRC users
- Role: Role-based access control
- Permission: Fine-grained permissions
- UserGroup: User grouping for easier management
- AccessPolicy: Policy-based access control
"""

from .models import (
    User,
    Role,
    Permission,
    RolePermission,
    UserRole,
    UserGroup,
    GroupMembership,
    AccessPolicy,
    APIKey,
    AuditLog,
)

__all__ = [
    'User',
    'Role',
    'Permission',
    'RolePermission',
    'UserRole',
    'UserGroup',
    'GroupMembership',
    'AccessPolicy',
    'APIKey',
    'AuditLog',
]
