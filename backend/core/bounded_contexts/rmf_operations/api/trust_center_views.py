"""
Trust Center API Views

Public and authenticated API endpoints for the Trust Center.
Provides authorization status, KSI compliance, and OAR history information.
"""

from uuid import UUID
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

from ..services.trust_center import get_trust_center_service


class TrustCenterSummaryView(APIView):
    """Get Trust Center summary statistics (public)."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Get Trust Center Summary",
        description="Returns summary statistics for all authorized CSOs. "
                    "This is a public endpoint that does not require authentication.",
        responses={200: dict},
        tags=['Trust Center', 'Public'],
    )
    def get(self, request):
        """Get Trust Center summary."""
        try:
            service = get_trust_center_service()
            summary = service.get_trust_center_summary()

            return Response({
                'success': True,
                'data': summary,
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TrustCenterCSOListView(APIView):
    """List authorized CSOs (public)."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="List Authorized CSOs",
        description="Returns list of authorized Cloud Service Offerings with "
                    "basic authorization status information. This is a public endpoint.",
        parameters=[
            OpenApiParameter(
                name='status',
                description='Filter by authorization status',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='impact_level',
                description='Filter by impact level (low, moderate, high)',
                required=False,
                type=str,
            ),
        ],
        responses={200: dict},
        tags=['Trust Center', 'Public'],
    )
    def get(self, request):
        """List CSOs."""
        status_filter = request.query_params.get('status')
        impact_level = request.query_params.get('impact_level')

        try:
            service = get_trust_center_service()
            csos = service.get_public_cso_list(
                status_filter=status_filter,
                impact_level=impact_level,
            )

            return Response({
                'success': True,
                'data': {
                    'csos': [c.to_dict() for c in csos],
                    'total': len(csos),
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TrustCenterCSODetailView(APIView):
    """Get CSO authorization status (public)."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Get CSO Authorization Status",
        description="Returns detailed authorization status for a specific CSO. "
                    "This is a public endpoint.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=True,
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
            ),
        ],
        responses={200: dict},
        tags=['Trust Center', 'Public'],
    )
    def get(self, request, cso_id):
        """Get CSO detail."""
        try:
            cso_uuid = UUID(cso_id)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid cso_id format',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_trust_center_service()
            cso_status = service.get_public_authorization_status(cso_uuid)

            if not cso_status:
                return Response({
                    'success': False,
                    'error': 'CSO not found or not publicly available',
                }, status=status.HTTP_404_NOT_FOUND)

            return Response({
                'success': True,
                'data': cso_status.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TrustCenterKSIComplianceView(APIView):
    """Get KSI compliance report for a CSO (public)."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Get CSO KSI Compliance Report",
        description="Returns KSI compliance report for a specific CSO. "
                    "This is a public endpoint showing compliance status.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=True,
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
            ),
            OpenApiParameter(
                name='include_details',
                description='Include detailed KSI breakdown',
                required=False,
                type=bool,
                default=False,
            ),
        ],
        responses={200: dict},
        tags=['Trust Center', 'Public'],
    )
    def get(self, request, cso_id):
        """Get KSI compliance report."""
        try:
            cso_uuid = UUID(cso_id)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid cso_id format',
            }, status=status.HTTP_400_BAD_REQUEST)

        include_details = request.query_params.get('include_details', 'false').lower() == 'true'

        try:
            service = get_trust_center_service()
            report = service.get_ksi_compliance_report(
                cso_uuid,
                include_details=include_details
            )

            if not report:
                return Response({
                    'success': False,
                    'error': 'CSO not found or compliance data unavailable',
                }, status=status.HTTP_404_NOT_FOUND)

            return Response({
                'success': True,
                'data': report.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TrustCenterOARHistoryView(APIView):
    """Get OAR history for a CSO (public)."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Get CSO OAR History",
        description="Returns OAR submission history for a specific CSO. "
                    "This is a public endpoint.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=True,
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
            ),
            OpenApiParameter(
                name='limit',
                description='Maximum number of OARs to return',
                required=False,
                type=int,
                default=8,
            ),
        ],
        responses={200: dict},
        tags=['Trust Center', 'Public'],
    )
    def get(self, request, cso_id):
        """Get OAR history."""
        try:
            cso_uuid = UUID(cso_id)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid cso_id format',
            }, status=status.HTTP_400_BAD_REQUEST)

        limit = int(request.query_params.get('limit', 8))

        try:
            service = get_trust_center_service()
            history = service.get_oar_history(cso_uuid, limit=limit)

            return Response({
                'success': True,
                'data': {
                    'oar_history': [h.to_dict() for h in history],
                    'total': len(history),
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TrustCenterOSCALExcerptView(APIView):
    """Get OSCAL SSP excerpt for a CSO (public)."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Get OSCAL SSP Excerpt",
        description="Returns machine-readable OSCAL SSP excerpt for a CSO. "
                    "This supports FedRAMP 20x machine-readable requirements.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=True,
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
            ),
            OpenApiParameter(
                name='sections',
                description='Comma-separated list of sections to include',
                required=False,
                type=str,
            ),
        ],
        responses={200: dict},
        tags=['Trust Center', 'Public', 'OSCAL'],
    )
    def get(self, request, cso_id):
        """Get OSCAL excerpt."""
        try:
            cso_uuid = UUID(cso_id)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid cso_id format',
            }, status=status.HTTP_400_BAD_REQUEST)

        sections_str = request.query_params.get('sections')
        sections = sections_str.split(',') if sections_str else None

        try:
            service = get_trust_center_service()
            excerpt = service.generate_oscal_ssp_excerpt(cso_uuid, sections=sections)

            return Response({
                'success': True,
                'data': excerpt,
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# Authenticated Trust Center Views (for CSO owners)
# =============================================================================

class TrustCenterPublishView(APIView):
    """Publish/unpublish CSO in Trust Center (authenticated)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Publish CSO to Trust Center",
        description="Publishes a CSO to the public Trust Center. Requires authentication "
                    "and appropriate permissions on the CSO.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=True,
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
            ),
        ],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'publish': {
                        'type': 'boolean',
                        'description': 'True to publish, False to unpublish',
                    },
                },
                'required': ['publish'],
            }
        },
        responses={200: dict},
        tags=['Trust Center'],
    )
    def post(self, request, cso_id):
        """Publish/unpublish CSO."""
        try:
            cso_uuid = UUID(cso_id)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid cso_id format',
            }, status=status.HTTP_400_BAD_REQUEST)

        publish = request.data.get('publish', True)

        try:
            # In a real implementation, this would update the CSO's
            # public visibility setting
            return Response({
                'success': True,
                'data': {
                    'cso_id': str(cso_uuid),
                    'published': publish,
                    'message': f'CSO {"published to" if publish else "removed from"} Trust Center',
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TrustCenterConfigView(APIView):
    """Configure Trust Center display for a CSO (authenticated)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Configure Trust Center Display",
        description="Configure what information is displayed on the Trust Center "
                    "for a specific CSO.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=True,
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
            ),
        ],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'show_ksi_details': {
                        'type': 'boolean',
                        'description': 'Show detailed KSI breakdown',
                    },
                    'show_oar_history': {
                        'type': 'boolean',
                        'description': 'Show OAR submission history',
                    },
                    'show_oscal_excerpt': {
                        'type': 'boolean',
                        'description': 'Make OSCAL SSP excerpt available',
                    },
                    'custom_description': {
                        'type': 'string',
                        'description': 'Custom description for Trust Center listing',
                    },
                },
            }
        },
        responses={200: dict},
        tags=['Trust Center'],
    )
    def post(self, request, cso_id):
        """Configure Trust Center display."""
        try:
            cso_uuid = UUID(cso_id)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid cso_id format',
            }, status=status.HTTP_400_BAD_REQUEST)

        config = {
            'show_ksi_details': request.data.get('show_ksi_details', True),
            'show_oar_history': request.data.get('show_oar_history', True),
            'show_oscal_excerpt': request.data.get('show_oscal_excerpt', True),
            'custom_description': request.data.get('custom_description', ''),
        }

        try:
            # In a real implementation, save this configuration
            return Response({
                'success': True,
                'data': {
                    'cso_id': str(cso_uuid),
                    'config': config,
                    'message': 'Trust Center configuration updated',
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
