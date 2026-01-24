"""
Serdes URL Configuration - MIT Licensed

Clean-room implementation of backup/restore URL routing.
Copyright (c) 2026 Tash
"""

from django.urls import path
from .views import (
    create_backup_view,
    restore_backup_view,
    preview_backup_view,
    selective_restore_view,
    create_incremental_backup_view,
    backup_models_view,
)

app_name = 'serdes_mit'

urlpatterns = [
    # Backup endpoints
    path('backup/', create_backup_view, name='create-backup'),
    path('backup/incremental/', create_incremental_backup_view, name='create-incremental-backup'),
    path('backup/models/', backup_models_view, name='backup-models'),

    # Restore endpoints
    path('restore/', restore_backup_view, name='restore-backup'),
    path('restore/preview/', preview_backup_view, name='preview-backup'),
    path('restore/selective/', selective_restore_view, name='selective-restore'),
]
