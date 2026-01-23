"""
Evidence Automation API Views
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter

from ..models import EvidenceSource, EvidenceCollectionRule, EvidenceCollectionRun
from ..services.collector import evidence_collector
from ..services.connectors import get_connector
from .serializers import (
    EvidenceSourceSerializer,
    EvidenceSourceWriteSerializer,
    EvidenceCollectionRuleSerializer,
    EvidenceCollectionRunSerializer,
    TestConnectionSerializer,
    RunCollectionSerializer,
)


class EvidenceSourceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing evidence sources."""

    permission_classes = [IsAuthenticated]
    queryset = EvidenceSource.objects.all()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return EvidenceSourceWriteSerializer
        return EvidenceSourceSerializer

    def get_queryset(self):
        return EvidenceSource.objects.all().order_by('-created_at')

    @extend_schema(
        summary="Test source connection",
        description="Test the connection to an evidence source.",
        responses={200: dict},
    )
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """Test connection to an evidence source."""
        source = self.get_object()
        result = evidence_collector.test_source_connection(source)

        # Update source status based on result
        if result.get('success'):
            source.status = EvidenceSource.Status.ACTIVE
        else:
            source.status = EvidenceSource.Status.ERROR
            source.last_error = result.get('error')
        source.save()

        return Response(result)

    @extend_schema(
        summary="Get collection status",
        description="Get collection status and recent runs for a source.",
        responses={200: dict},
    )
    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Get collection status for a source."""
        result = evidence_collector.get_collection_status(str(pk))
        return Response(result)

    @extend_schema(
        summary="Activate source",
        description="Activate an evidence source for collection.",
        responses={200: EvidenceSourceSerializer},
    )
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a source."""
        source = self.get_object()
        source.status = EvidenceSource.Status.ACTIVE
        source.collection_enabled = True
        source.save()
        return Response(EvidenceSourceSerializer(source).data)

    @extend_schema(
        summary="Deactivate source",
        description="Deactivate an evidence source.",
        responses={200: EvidenceSourceSerializer},
    )
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a source."""
        source = self.get_object()
        source.status = EvidenceSource.Status.INACTIVE
        source.collection_enabled = False
        source.save()
        return Response(EvidenceSourceSerializer(source).data)


class EvidenceCollectionRuleViewSet(viewsets.ModelViewSet):
    """ViewSet for managing evidence collection rules."""

    permission_classes = [IsAuthenticated]
    queryset = EvidenceCollectionRule.objects.all()
    serializer_class = EvidenceCollectionRuleSerializer

    def get_queryset(self):
        queryset = EvidenceCollectionRule.objects.all().select_related('source')

        # Filter by source
        source_id = self.request.query_params.get('source')
        if source_id:
            queryset = queryset.filter(source_id=source_id)

        # Filter by enabled status
        enabled = self.request.query_params.get('enabled')
        if enabled is not None:
            queryset = queryset.filter(enabled=enabled.lower() == 'true')

        return queryset.order_by('-created_at')

    @extend_schema(
        summary="Run collection",
        description="Manually trigger evidence collection for a rule.",
        request=RunCollectionSerializer,
        responses={200: EvidenceCollectionRunSerializer},
    )
    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        """Manually run evidence collection for a rule."""
        rule = self.get_object()
        dry_run = request.data.get('dry_run', False)

        run = evidence_collector.collect_evidence(rule, dry_run=dry_run)
        return Response(EvidenceCollectionRunSerializer(run).data)

    @extend_schema(
        summary="Enable rule",
        description="Enable a collection rule.",
        responses={200: EvidenceCollectionRuleSerializer},
    )
    @action(detail=True, methods=['post'])
    def enable(self, request, pk=None):
        """Enable a collection rule."""
        rule = self.get_object()
        rule.enabled = True
        rule.save()
        return Response(EvidenceCollectionRuleSerializer(rule).data)

    @extend_schema(
        summary="Disable rule",
        description="Disable a collection rule.",
        responses={200: EvidenceCollectionRuleSerializer},
    )
    @action(detail=True, methods=['post'])
    def disable(self, request, pk=None):
        """Disable a collection rule."""
        rule = self.get_object()
        rule.enabled = False
        rule.save()
        return Response(EvidenceCollectionRuleSerializer(rule).data)


class EvidenceCollectionRunViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing evidence collection runs."""

    permission_classes = [IsAuthenticated]
    queryset = EvidenceCollectionRun.objects.all()
    serializer_class = EvidenceCollectionRunSerializer

    def get_queryset(self):
        queryset = EvidenceCollectionRun.objects.all().select_related('rule', 'rule__source')

        # Filter by rule
        rule_id = self.request.query_params.get('rule')
        if rule_id:
            queryset = queryset.filter(rule_id=rule_id)

        # Filter by source
        source_id = self.request.query_params.get('source')
        if source_id:
            queryset = queryset.filter(rule__source_id=source_id)

        # Filter by status
        run_status = self.request.query_params.get('status')
        if run_status:
            queryset = queryset.filter(status=run_status)

        return queryset.order_by('-created_at')


class TestConnectionView(APIView):
    """Test connection to a source without creating it."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Test source connection",
        description="Test connection to an evidence source using provided configuration.",
        request=TestConnectionSerializer,
        responses={200: dict},
    )
    def post(self, request):
        """Test a source connection."""
        serializer = TestConnectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        source_type = serializer.validated_data['source_type']
        config = serializer.validated_data['config']

        connector = get_connector(source_type, config)
        if not connector:
            return Response({
                'success': False,
                'error': f'Unsupported source type: {source_type}',
            })

        # Validate configuration
        config_errors = connector.validate_config()
        if config_errors:
            return Response({
                'success': False,
                'error': 'Configuration validation failed',
                'details': config_errors,
            })

        # Test connection
        try:
            result = connector.test_connection()
            return Response(result)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            })
        finally:
            try:
                connector.disconnect()
            except:
                pass


class SourceTypesView(APIView):
    """Get available evidence source types."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get source types",
        description="Get list of available evidence source types and their configuration requirements.",
        responses={200: dict},
    )
    def get(self, request):
        """Get available source types."""
        source_types = []

        for choice in EvidenceSource.SourceType.choices:
            type_info = {
                'value': choice[0],
                'label': choice[1],
                'config_fields': self._get_config_fields(choice[0]),
            }
            source_types.append(type_info)

        return Response({
            'source_types': source_types,
        })

    def _get_config_fields(self, source_type):
        """Get required configuration fields for a source type."""
        fields = {
            'aws': [
                {'name': 'access_key_id', 'label': 'Access Key ID', 'type': 'text', 'required': True},
                {'name': 'secret_access_key', 'label': 'Secret Access Key', 'type': 'password', 'required': True},
                {'name': 'region', 'label': 'Region', 'type': 'text', 'required': True, 'default': 'us-east-1'},
            ],
            'azure': [
                {'name': 'tenant_id', 'label': 'Tenant ID', 'type': 'text', 'required': True},
                {'name': 'client_id', 'label': 'Client ID', 'type': 'text', 'required': True},
                {'name': 'client_secret', 'label': 'Client Secret', 'type': 'password', 'required': True},
                {'name': 'subscription_id', 'label': 'Subscription ID', 'type': 'text', 'required': False},
            ],
            'azure_ad': [
                {'name': 'tenant_id', 'label': 'Tenant ID', 'type': 'text', 'required': True},
                {'name': 'client_id', 'label': 'Client ID', 'type': 'text', 'required': True},
                {'name': 'client_secret', 'label': 'Client Secret', 'type': 'password', 'required': True},
            ],
            'github': [
                {'name': 'access_token', 'label': 'Personal Access Token', 'type': 'password', 'required': True},
                {'name': 'organization', 'label': 'Organization', 'type': 'text', 'required': False},
            ],
            'okta': [
                {'name': 'domain', 'label': 'Okta Domain', 'type': 'text', 'required': True},
                {'name': 'api_token', 'label': 'API Token', 'type': 'password', 'required': True},
            ],
            'jira': [
                {'name': 'domain', 'label': 'Jira Domain', 'type': 'text', 'required': True},
                {'name': 'email', 'label': 'Email', 'type': 'email', 'required': True},
                {'name': 'api_token', 'label': 'API Token', 'type': 'password', 'required': True},
            ],
            'servicenow': [
                {'name': 'instance', 'label': 'Instance Name', 'type': 'text', 'required': True},
                {'name': 'username', 'label': 'Username', 'type': 'text', 'required': True},
                {'name': 'password', 'label': 'Password', 'type': 'password', 'required': True},
            ],
            'api': [
                {'name': 'base_url', 'label': 'Base URL', 'type': 'url', 'required': True},
                {'name': 'auth_type', 'label': 'Auth Type', 'type': 'select', 'required': False,
                 'options': ['none', 'bearer', 'api_key', 'basic']},
                {'name': 'token', 'label': 'Token/API Key', 'type': 'password', 'required': False},
            ],
        }
        return fields.get(source_type, [])


class CollectionTypesView(APIView):
    """Get available evidence collection types."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get collection types",
        description="Get list of available evidence collection types.",
        responses={200: dict},
    )
    def get(self, request):
        """Get available collection types."""
        collection_types = [
            {'value': choice[0], 'label': choice[1]}
            for choice in EvidenceCollectionRule.CollectionType.choices
        ]

        # Source-specific collection options
        source_collections = {
            'aws': [
                {'type': 'iam_users', 'label': 'IAM Users List'},
                {'type': 'security_groups', 'label': 'Security Groups'},
                {'type': 's3_buckets', 'label': 'S3 Bucket Configurations'},
                {'type': 'cloudtrail', 'label': 'CloudTrail Status'},
                {'type': 'config_rules', 'label': 'AWS Config Rules'},
            ],
            'azure': [
                {'type': 'users', 'label': 'Azure AD Users'},
                {'type': 'security_center', 'label': 'Security Center Findings'},
            ],
            'github': [
                {'type': 'repository_settings', 'label': 'Repository Settings'},
                {'type': 'branch_protection', 'label': 'Branch Protection Rules'},
                {'type': 'org_members', 'label': 'Organization Members'},
                {'type': 'security_alerts', 'label': 'Security Alerts'},
            ],
        }

        return Response({
            'collection_types': collection_types,
            'source_specific': source_collections,
        })
