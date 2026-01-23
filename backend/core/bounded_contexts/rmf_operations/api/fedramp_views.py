"""
FedRAMP KSI Dashboard API Views
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter

from ..services.fedramp_ksi import get_ksi_service


class FedRAMPDashboardView(APIView):
    """Get complete FedRAMP KSI dashboard data."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get FedRAMP KSI Dashboard",
        description="Returns complete FedRAMP Key Security Indicators dashboard data including authorization status, KSI metrics, control compliance, vulnerabilities, POA&M status, and continuous monitoring data.",
        parameters=[
            OpenApiParameter(
                name='system_group_id',
                description='Optional system group ID to scope metrics',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='compliance_assessment_id',
                description='Optional compliance assessment ID to scope metrics',
                required=False,
                type=str,
            ),
        ],
        responses={200: dict},
    )
    def get(self, request):
        """Get FedRAMP dashboard data."""
        system_group_id = request.query_params.get('system_group_id')
        compliance_assessment_id = request.query_params.get('compliance_assessment_id')

        service = get_ksi_service(
            system_group_id=system_group_id,
            compliance_assessment_id=compliance_assessment_id
        )

        try:
            dashboard_data = service.get_dashboard_data()
            return Response({
                'success': True,
                'data': dashboard_data.to_dict(),
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FedRAMPKSIMetricsView(APIView):
    """Get FedRAMP KSI metrics only."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get FedRAMP KSI Metrics",
        description="Returns Key Security Indicator metrics for FedRAMP continuous monitoring.",
        parameters=[
            OpenApiParameter(
                name='category',
                description='Filter by metric category',
                required=False,
                type=str,
            ),
        ],
        responses={200: dict},
    )
    def get(self, request):
        """Get KSI metrics."""
        category = request.query_params.get('category')

        service = get_ksi_service()

        try:
            dashboard_data = service.get_dashboard_data()
            metrics = dashboard_data.ksi_metrics

            if category:
                metrics = [m for m in metrics if m.category == category]

            return Response({
                'success': True,
                'metrics': [m.to_dict() for m in metrics],
                'count': len(metrics),
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FedRAMPControlComplianceView(APIView):
    """Get FedRAMP control compliance data."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get FedRAMP Control Compliance",
        description="Returns control compliance data by control family.",
        responses={200: dict},
    )
    def get(self, request):
        """Get control compliance data."""
        service = get_ksi_service()

        try:
            dashboard_data = service.get_dashboard_data()
            return Response({
                'success': True,
                'data': dashboard_data.control_compliance,
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FedRAMPVulnerabilitySummaryView(APIView):
    """Get FedRAMP vulnerability summary."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get FedRAMP Vulnerability Summary",
        description="Returns vulnerability summary including counts by severity, remediation rates, and trends.",
        responses={200: dict},
    )
    def get(self, request):
        """Get vulnerability summary."""
        service = get_ksi_service()

        try:
            dashboard_data = service.get_dashboard_data()
            return Response({
                'success': True,
                'data': dashboard_data.vulnerability_summary,
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FedRAMPPOAMStatusView(APIView):
    """Get FedRAMP POA&M status."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get FedRAMP POA&M Status",
        description="Returns POA&M status including item counts, milestone tracking, and trends.",
        responses={200: dict},
    )
    def get(self, request):
        """Get POA&M status."""
        service = get_ksi_service()

        try:
            dashboard_data = service.get_dashboard_data()
            return Response({
                'success': True,
                'data': dashboard_data.poam_status,
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FedRAMPContinuousMonitoringView(APIView):
    """Get FedRAMP continuous monitoring status."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get FedRAMP Continuous Monitoring Status",
        description="Returns continuous monitoring status including scan schedules and deliverable tracking.",
        responses={200: dict},
    )
    def get(self, request):
        """Get continuous monitoring status."""
        service = get_ksi_service()

        try:
            dashboard_data = service.get_dashboard_data()
            return Response({
                'success': True,
                'data': {
                    'continuous_monitoring': dashboard_data.continuous_monitoring,
                    'scan_compliance': dashboard_data.scan_compliance,
                }
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
