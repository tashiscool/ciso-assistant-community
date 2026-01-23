"""
Version History (Time Travel) Module

Provides comprehensive version tracking and point-in-time recovery
for all major entities in CISO Assistant.

Features:
- Full version history for any model
- Point-in-time snapshots
- Diff/comparison between versions
- Audit trail with user attribution
- Rollback capabilities
- Bulk history export
"""

from .models import (
    VersionedModel,
    VersionHistory,
    VersionSnapshot,
    VersionDiff,
    VersionComment,
)
from .services import (
    VersionService,
    SnapshotService,
    DiffService,
    AuditService,
)
from .mixins import VersionedModelMixin

__all__ = [
    'VersionedModel',
    'VersionHistory',
    'VersionSnapshot',
    'VersionDiff',
    'VersionComment',
    'VersionService',
    'SnapshotService',
    'DiffService',
    'AuditService',
    'VersionedModelMixin',
]
