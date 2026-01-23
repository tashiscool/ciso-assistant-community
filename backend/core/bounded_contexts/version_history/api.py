"""
Version History API Views

REST API endpoints for version history, snapshots, and auditing.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import datetime, timedelta

from .models import VersionHistory, VersionSnapshot, VersionDiff, VersionComment
from .services import VersionService, SnapshotService, DiffService, AuditService


class VersionHistorySerializer(serializers.ModelSerializer):
    """Serializer for version history entries."""

    content_type_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VersionHistory
        fields = [
            'id', 'content_type', 'content_type_name', 'object_id',
            'version_number', 'version_label', 'change_type',
            'change_summary', 'change_reason', 'snapshot_data',
            'changed_fields', 'previous_values', 'created_by',
            'created_by_name', 'created_at', 'ip_address', 'tags'
        ]
        read_only_fields = fields

    def get_content_type_name(self, obj):
        return f"{obj.content_type.app_label}.{obj.content_type.model}"

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None


class VersionSnapshotSerializer(serializers.ModelSerializer):
    """Serializer for version snapshots."""

    version_number = serializers.IntegerField(source='version.version_number', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VersionSnapshot
        fields = [
            'id', 'version', 'version_number', 'name', 'description',
            'snapshot_type', 'external_reference', 'created_by',
            'created_by_name', 'created_at', 'expires_at', 'is_protected'
        ]
        read_only_fields = ['id', 'version', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None


class VersionCommentSerializer(serializers.ModelSerializer):
    """Serializer for version comments."""

    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VersionComment
        fields = [
            'id', 'version', 'comment', 'comment_type',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None


class VersionHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for browsing version history.

    Endpoints:
    - GET /api/version-history/ - List all version history
    - GET /api/version-history/{id}/ - Get specific version
    - GET /api/version-history/{id}/diff/ - Get diff from previous
    - GET /api/version-history/{id}/restore/ - Restore to this version
    """

    queryset = VersionHistory.objects.all()
    serializer_class = VersionHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by content type
        content_type = self.request.query_params.get('content_type')
        if content_type:
            try:
                app_label, model = content_type.split('.')
                ct = ContentType.objects.get(app_label=app_label, model=model)
                queryset = queryset.filter(content_type=ct)
            except (ValueError, ContentType.DoesNotExist):
                pass

        # Filter by object ID
        object_id = self.request.query_params.get('object_id')
        if object_id:
            queryset = queryset.filter(object_id=object_id)

        # Filter by change type
        change_type = self.request.query_params.get('change_type')
        if change_type:
            queryset = queryset.filter(change_type=change_type)

        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(created_by_id=user_id)

        # Filter by date range
        from_date = self.request.query_params.get('from_date')
        if from_date:
            queryset = queryset.filter(created_at__gte=from_date)

        to_date = self.request.query_params.get('to_date')
        if to_date:
            queryset = queryset.filter(created_at__lte=to_date)

        return queryset.order_by('-created_at')

    @action(detail=True, methods=['get'])
    def diff(self, request, pk=None):
        """Get diff from previous version."""
        version = self.get_object()
        diff = version.get_diff_from_previous()
        return Response(diff)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restore to this version."""
        version = self.get_object()
        reason = request.data.get('reason', '')

        try:
            instance = version.content_object
            if not instance:
                return Response(
                    {'error': 'Original object no longer exists'},
                    status=status.HTTP_404_NOT_FOUND
                )

            VersionService.restore_version(
                instance,
                version.version_number,
                user=request.user,
                reason=reason
            )

            return Response({'status': 'restored', 'version': version.version_number})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def for_object(self, request):
        """Get history for a specific object."""
        content_type = request.query_params.get('content_type')
        object_id = request.query_params.get('object_id')

        if not content_type or not object_id:
            return Response(
                {'error': 'content_type and object_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            app_label, model = content_type.split('.')
            ct = ContentType.objects.get(app_label=app_label, model=model)
        except (ValueError, ContentType.DoesNotExist):
            return Response(
                {'error': 'Invalid content_type'},
                status=status.HTTP_400_BAD_REQUEST
            )

        versions = VersionHistory.objects.filter(
            content_type=ct,
            object_id=object_id
        ).order_by('-version_number')

        serializer = self.get_serializer(versions, many=True)
        return Response(serializer.data)


class VersionSnapshotViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing version snapshots.

    Endpoints:
    - GET /api/version-snapshots/ - List snapshots
    - POST /api/version-snapshots/ - Create snapshot
    - GET /api/version-snapshots/{id}/ - Get snapshot
    - DELETE /api/version-snapshots/{id}/ - Delete snapshot
    - POST /api/version-snapshots/{id}/restore/ - Restore from snapshot
    """

    queryset = VersionSnapshot.objects.all()
    serializer_class = VersionSnapshotSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restore from this snapshot."""
        snapshot = self.get_object()
        reason = request.data.get('reason', '')

        try:
            instance = SnapshotService.restore_from_snapshot(
                snapshot,
                user=request.user,
                reason=reason
            )
            return Response({'status': 'restored', 'snapshot': snapshot.name})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class VersionDiffViewSet(viewsets.ViewSet):
    """
    ViewSet for computing version diffs.

    Endpoints:
    - POST /api/version-diff/compare/ - Compare two versions
    - GET /api/version-diff/timeline/ - Get change timeline
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def compare(self, request):
        """Compare two versions."""
        from_id = request.data.get('from_version')
        to_id = request.data.get('to_version')

        if not from_id or not to_id:
            return Response(
                {'error': 'from_version and to_version required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from_version = VersionHistory.objects.get(id=from_id)
            to_version = VersionHistory.objects.get(id=to_id)
        except VersionHistory.DoesNotExist:
            return Response(
                {'error': 'Version not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        diff = DiffService.get_diff(from_version, to_version)
        return Response({
            'from_version': from_version.version_number,
            'to_version': to_version.version_number,
            'diff': diff
        })

    @action(detail=False, methods=['get'])
    def timeline(self, request):
        """Get change timeline for an object."""
        content_type = request.query_params.get('content_type')
        object_id = request.query_params.get('object_id')

        if not content_type or not object_id:
            return Response(
                {'error': 'content_type and object_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            app_label, model = content_type.split('.')
            ct = ContentType.objects.get(app_label=app_label, model=model)
            model_class = ct.model_class()
            instance = model_class.objects.get(pk=object_id)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        from_version = request.query_params.get('from_version')
        to_version = request.query_params.get('to_version')

        timeline = DiffService.get_timeline_diff(
            instance,
            from_version=int(from_version) if from_version else None,
            to_version=int(to_version) if to_version else None,
        )

        return Response(timeline)


class AuditViewSet(viewsets.ViewSet):
    """
    ViewSet for audit trail and compliance reporting.

    Endpoints:
    - GET /api/audit/trail/ - Get audit trail
    - GET /api/audit/report/ - Generate compliance report
    - GET /api/audit/export/ - Export audit log
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def trail(self, request):
        """Get audit trail."""
        content_type = request.query_params.get('content_type')
        user_id = request.query_params.get('user_id')
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        change_types = request.query_params.getlist('change_type')
        limit = int(request.query_params.get('limit', 100))

        model_class = None
        if content_type:
            try:
                app_label, model = content_type.split('.')
                ct = ContentType.objects.get(app_label=app_label, model=model)
                model_class = ct.model_class()
            except (ValueError, ContentType.DoesNotExist):
                pass

        user = None
        if user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.filter(id=user_id).first()

        trail = AuditService.get_audit_trail(
            model_class=model_class,
            user=user,
            from_date=datetime.fromisoformat(from_date) if from_date else None,
            to_date=datetime.fromisoformat(to_date) if to_date else None,
            change_types=change_types or None,
            limit=limit,
        )

        return Response(trail)

    @action(detail=False, methods=['get'])
    def report(self, request):
        """Generate compliance report."""
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        content_types = request.query_params.getlist('content_type')

        if not from_date or not to_date:
            # Default to last 30 days
            to_date = timezone.now()
            from_date = to_date - timedelta(days=30)
        else:
            from_date = datetime.fromisoformat(from_date)
            to_date = datetime.fromisoformat(to_date)

        model_classes = []
        for ct_str in content_types:
            try:
                app_label, model = ct_str.split('.')
                ct = ContentType.objects.get(app_label=app_label, model=model)
                model_classes.append(ct.model_class())
            except (ValueError, ContentType.DoesNotExist):
                pass

        if not model_classes:
            # Default to common GRC models if none specified
            pass

        report = AuditService.generate_compliance_report(
            model_classes=model_classes,
            from_date=from_date,
            to_date=to_date,
        )

        return Response(report)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export audit log."""
        format_type = request.query_params.get('format', 'json')

        # Build filters from query params
        filters = {
            'limit': int(request.query_params.get('limit', 1000)),
        }

        from_date = request.query_params.get('from_date')
        if from_date:
            filters['from_date'] = datetime.fromisoformat(from_date)

        to_date = request.query_params.get('to_date')
        if to_date:
            filters['to_date'] = datetime.fromisoformat(to_date)

        try:
            export_data = AuditService.export_audit_log(format=format_type, **filters)

            if format_type == 'csv':
                response = Response(
                    export_data,
                    content_type='text/csv'
                )
                response['Content-Disposition'] = 'attachment; filename="audit_log.csv"'
            else:
                response = Response(
                    export_data,
                    content_type='application/json'
                )
                response['Content-Disposition'] = 'attachment; filename="audit_log.json"'

            return response
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
