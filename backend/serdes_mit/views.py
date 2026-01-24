"""
Serdes Views - MIT Licensed

Clean-room implementation of backup/restore API views.
Copyright (c) 2026 Tash
"""

import io
from datetime import datetime

from django.http import FileResponse
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .backup import create_backup, BackupWriter, IncrementalBackupWriter
from .restore import restore_backup, SelectiveRestorer


class IsAdminUser(permissions.BasePermission):
    """Only allow admin users."""

    def has_permission(self, request, view):
        return request.user and request.user.is_staff


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def create_backup_view(request):
    """
    Create a backup of the system.

    POST parameters:
    - organization_id: Optional organization to scope backup
    - include_attachments: Whether to include file attachments (default: true)
    - exclude_models: List of model names to exclude
    """
    organization_id = request.data.get('organization_id')
    include_attachments = request.data.get('include_attachments', True)
    exclude_models = set(request.data.get('exclude_models', []))

    try:
        backup_buffer = create_backup(
            organization_id=organization_id,
            include_attachments=include_attachments,
            exclude_models=exclude_models,
        )

        # Generate filename
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        if organization_id:
            filename = f"backup_{organization_id[:8]}_{timestamp}.zip"
        else:
            filename = f"backup_full_{timestamp}.zip"

        response = FileResponse(
            backup_buffer,
            as_attachment=True,
            filename=filename,
            content_type='application/zip'
        )

        return response

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def restore_backup_view(request):
    """
    Restore a backup file.

    POST parameters (multipart form):
    - file: The backup ZIP file
    - preserve_ids: Whether to preserve original IDs (default: false)
    - skip_existing: Whether to skip existing objects (default: true)
    - organization_id: Optional organization to scope restore
    """
    if 'file' not in request.FILES:
        return Response(
            {'error': 'No file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )

    file = request.FILES['file']
    preserve_ids = request.data.get('preserve_ids', 'false').lower() == 'true'
    skip_existing = request.data.get('skip_existing', 'true').lower() == 'true'
    organization_id = request.data.get('organization_id')

    try:
        result = restore_backup(
            input_file=file,
            preserve_ids=preserve_ids,
            skip_existing=skip_existing,
            organization_id=organization_id,
        )

        if result.get('success'):
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def preview_backup_view(request):
    """
    Preview a backup file without restoring.

    POST parameters (multipart form):
    - file: The backup ZIP file
    """
    if 'file' not in request.FILES:
        return Response(
            {'error': 'No file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )

    file = request.FILES['file']

    try:
        restorer = SelectiveRestorer(file)
        preview = restorer.get_preview()
        return Response(preview, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def selective_restore_view(request):
    """
    Selectively restore objects from a backup.

    POST parameters (multipart form):
    - file: The backup ZIP file
    - model_names: List of model names to restore (optional)
    - pks: List of primary keys to restore (optional)
    - preserve_ids: Whether to preserve original IDs (default: false)
    - organization_id: Optional organization to scope restore
    """
    if 'file' not in request.FILES:
        return Response(
            {'error': 'No file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )

    file = request.FILES['file']
    model_names = request.data.getlist('model_names', [])
    pks = request.data.getlist('pks', [])
    preserve_ids = request.data.get('preserve_ids', 'false').lower() == 'true'
    organization_id = request.data.get('organization_id')

    if not model_names and not pks:
        return Response(
            {'error': 'Either model_names or pks must be provided'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        restorer = SelectiveRestorer(file)

        if model_names:
            restorer.select_by_model(model_names)
        elif pks:
            restorer.select_by_pk(pks)

        result = restorer.restore_selected(
            preserve_ids=preserve_ids,
            organization_id=organization_id
        )

        if result.get('success'):
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def create_incremental_backup_view(request):
    """
    Create an incremental backup since a given timestamp.

    POST parameters:
    - since: ISO timestamp of last backup
    - organization_id: Optional organization to scope backup
    - include_attachments: Whether to include file attachments (default: true)
    """
    since_str = request.data.get('since')
    if not since_str:
        return Response(
            {'error': 'since parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        since = datetime.fromisoformat(since_str.replace('Z', '+00:00'))
    except ValueError:
        return Response(
            {'error': 'Invalid since timestamp format'},
            status=status.HTTP_400_BAD_REQUEST
        )

    organization_id = request.data.get('organization_id')
    include_attachments = request.data.get('include_attachments', True)

    try:
        writer = IncrementalBackupWriter(
            organization_id=organization_id,
            since=since,
            include_attachments=include_attachments
        )

        # Add all default models
        from .backup import _get_default_backup_models
        for model_class in _get_default_backup_models():
            writer.add_model_instances(model_class)

        output = io.BytesIO()
        manifest = writer.write(output)
        output.seek(0)

        # Generate filename
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"backup_incremental_{timestamp}.zip"

        response = FileResponse(
            output,
            as_attachment=True,
            filename=filename,
            content_type='application/zip'
        )

        return response

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def backup_models_view(request):
    """
    Get list of models available for backup.
    """
    from .backup import _get_default_backup_models

    models_info = []
    for model_class in _get_default_backup_models():
        models_info.append({
            'name': f"{model_class._meta.app_label}.{model_class._meta.model_name}",
            'verbose_name': model_class._meta.verbose_name,
            'count': model_class.objects.count(),
        })

    return Response(models_info)
