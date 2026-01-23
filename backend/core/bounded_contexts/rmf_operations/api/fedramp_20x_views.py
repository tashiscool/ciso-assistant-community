"""
FedRAMP 20x Export API Views

API endpoints for generating machine-readable FedRAMP 20x packages.
"""

from uuid import UUID
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

from ..services.fedramp_20x_export import (
    get_export_service,
    get_incident_change_export_service
)


class FedRAMP20xKSIExportView(APIView):
    """Export KSI compliance package in machine-readable format."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Export FedRAMP 20x KSI Package",
        description="Generates a machine-readable KSI compliance package for FedRAMP 20x authorization.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='format',
                description='Output format (json or oscal)',
                required=False,
                type=str,
                default='json',
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x'],
    )
    def get(self, request):
        """Get KSI compliance package."""
        cso_id = request.query_params.get('cso_id')
        output_format = request.query_params.get('format', 'json')

        try:
            cso_uuid = UUID(cso_id) if cso_id else None
            service = get_export_service(cso_id=cso_uuid)
            package = service.generate_ksi_package()

            if output_format == 'oscal':
                # TODO: Convert to OSCAL format
                return Response({
                    'success': False,
                    'error': 'OSCAL format not yet implemented',
                }, status=status.HTTP_501_NOT_IMPLEMENTED)

            return Response({
                'success': True,
                'data': package.to_dict(),
            })

        except ValueError as e:
            return Response({
                'success': False,
                'error': f'Invalid parameter: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FedRAMP20xOARExportView(APIView):
    """Export Ongoing Authorization Report in machine-readable format."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Export FedRAMP 20x OAR Package",
        description="Generates a machine-readable Ongoing Authorization Report package.",
        parameters=[
            OpenApiParameter(
                name='oar_id',
                description='Specific OAR ID to export',
                required=False,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='year',
                description='Reporting year',
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name='quarter',
                description='Reporting quarter (Q1, Q2, Q3, Q4)',
                required=False,
                type=str,
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x'],
    )
    def get(self, request):
        """Get OAR package."""
        oar_id = request.query_params.get('oar_id')
        cso_id = request.query_params.get('cso_id')
        year = request.query_params.get('year')
        quarter = request.query_params.get('quarter')

        try:
            cso_uuid = UUID(cso_id) if cso_id else None
            oar_uuid = UUID(oar_id) if oar_id else None
            year_int = int(year) if year else None

            service = get_export_service(cso_id=cso_uuid)
            package = service.generate_oar_package(
                oar_id=oar_uuid,
                year=year_int,
                quarter=quarter
            )

            if 'error' in package:
                return Response({
                    'success': False,
                    'error': package['error'],
                }, status=status.HTTP_404_NOT_FOUND)

            return Response({
                'success': True,
                'data': package,
            })

        except ValueError as e:
            return Response({
                'success': False,
                'error': f'Invalid parameter: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FedRAMP20xValidationReportView(APIView):
    """Export persistent validation results report."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Export FedRAMP 20x Validation Report",
        description="Generates a report of persistent validation rule results.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x'],
    )
    def get(self, request):
        """Get validation report."""
        cso_id = request.query_params.get('cso_id')

        try:
            cso_uuid = UUID(cso_id) if cso_id else None
            service = get_export_service(cso_id=cso_uuid)
            report = service.generate_validation_report()

            return Response({
                'success': True,
                'data': report,
            })

        except ValueError as e:
            return Response({
                'success': False,
                'error': f'Invalid parameter: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FedRAMP20xCompletePackageView(APIView):
    """Export complete FedRAMP 20x authorization package."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Export Complete FedRAMP 20x Package",
        description="Generates a complete machine-readable FedRAMP 20x authorization package including KSI compliance, OAR data, and validation results.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=True,
                type=OpenApiTypes.UUID,
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x'],
    )
    def get(self, request):
        """Get complete authorization package."""
        cso_id = request.query_params.get('cso_id')

        if not cso_id:
            return Response({
                'success': False,
                'error': 'cso_id is required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            cso_uuid = UUID(cso_id)
            service = get_export_service(cso_id=cso_uuid)
            package = service.generate_complete_package()

            return Response({
                'success': True,
                'data': package,
            })

        except ValueError as e:
            return Response({
                'success': False,
                'error': f'Invalid parameter: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FedRAMP20xDownloadView(APIView):
    """Download FedRAMP 20x package as file."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Download FedRAMP 20x Package",
        description="Downloads a FedRAMP 20x package as a JSON file.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=True,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='type',
                description='Package type (ksi, oar, validation, complete)',
                required=False,
                type=str,
                default='complete',
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x'],
    )
    def get(self, request):
        """Download package as file."""
        from django.http import HttpResponse
        import json

        cso_id = request.query_params.get('cso_id')
        package_type = request.query_params.get('type', 'complete')

        if not cso_id:
            return Response({
                'success': False,
                'error': 'cso_id is required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            cso_uuid = UUID(cso_id)
            service = get_export_service(cso_id=cso_uuid)

            if package_type == 'ksi':
                package = service.generate_ksi_package()
                data = package.to_dict()
                filename = f'fedramp-20x-ksi-{cso_id[:8]}.json'
            elif package_type == 'oar':
                data = service.generate_oar_package()
                filename = f'fedramp-20x-oar-{cso_id[:8]}.json'
            elif package_type == 'validation':
                data = service.generate_validation_report()
                filename = f'fedramp-20x-validation-{cso_id[:8]}.json'
            else:
                data = service.generate_complete_package()
                filename = f'fedramp-20x-complete-{cso_id[:8]}.json'

            content = json.dumps(data, indent=2)

            response = HttpResponse(content, content_type='application/json')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except ValueError as e:
            return Response({
                'success': False,
                'error': f'Invalid parameter: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# Incident and Change Control Export Views
# =============================================================================

class IncidentExportView(APIView):
    """Export security incident report."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Export Security Incident Report",
        description="Generates a security incident report in FedRAMP 20x format.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='start_date',
                description='Start date filter (ISO format)',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='end_date',
                description='End date filter (ISO format)',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='include_closed',
                description='Include closed incidents',
                required=False,
                type=bool,
                default=True,
            ),
            OpenApiParameter(
                name='output_format',
                description='Output format (json or oscal)',
                required=False,
                type=str,
                default='json',
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x', 'Incident Response'],
    )
    def get(self, request):
        """Get incident report."""
        from datetime import datetime

        cso_id = request.query_params.get('cso_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        include_closed = request.query_params.get('include_closed', 'true').lower() == 'true'
        output_format = request.query_params.get('output_format', 'json')

        try:
            cso_uuid = UUID(cso_id) if cso_id else None
            start_dt = datetime.fromisoformat(start_date) if start_date else None
            end_dt = datetime.fromisoformat(end_date) if end_date else None

            service = get_incident_change_export_service(cso_id=cso_uuid)

            if output_format == 'oscal':
                data = service.generate_oscal_incident_observations()
            else:
                data = service.generate_incident_report(
                    start_date=start_dt,
                    end_date=end_dt,
                    include_closed=include_closed
                )

            return Response({
                'success': True,
                'data': data,
            })

        except ValueError as e:
            return Response({
                'success': False,
                'error': f'Invalid parameter: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChangeControlExportView(APIView):
    """Export change control report."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Export Change Control Report",
        description="Generates a change control report in FedRAMP 20x format.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='start_date',
                description='Start date filter (ISO format)',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='end_date',
                description='End date filter (ISO format)',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='include_completed',
                description='Include completed changes',
                required=False,
                type=bool,
                default=True,
            ),
            OpenApiParameter(
                name='output_format',
                description='Output format (json or oscal)',
                required=False,
                type=str,
                default='json',
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x', 'Change Control'],
    )
    def get(self, request):
        """Get change control report."""
        from datetime import datetime

        cso_id = request.query_params.get('cso_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        include_completed = request.query_params.get('include_completed', 'true').lower() == 'true'
        output_format = request.query_params.get('output_format', 'json')

        try:
            cso_uuid = UUID(cso_id) if cso_id else None
            start_dt = datetime.fromisoformat(start_date) if start_date else None
            end_dt = datetime.fromisoformat(end_date) if end_date else None

            service = get_incident_change_export_service(cso_id=cso_uuid)

            if output_format == 'oscal':
                data = service.generate_oscal_change_poam()
            else:
                data = service.generate_change_control_report(
                    start_date=start_dt,
                    end_date=end_dt,
                    include_completed=include_completed
                )

            return Response({
                'success': True,
                'data': data,
            })

        except ValueError as e:
            return Response({
                'success': False,
                'error': f'Invalid parameter: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OperationsExportView(APIView):
    """Export complete operations package (incidents + changes)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Export Complete Operations Package",
        description="Generates a complete operations package including incident response and change control data.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x'],
    )
    def get(self, request):
        """Get complete operations package."""
        cso_id = request.query_params.get('cso_id')

        try:
            cso_uuid = UUID(cso_id) if cso_id else None
            service = get_incident_change_export_service(cso_id=cso_uuid)
            data = service.generate_complete_operations_package()

            return Response({
                'success': True,
                'data': data,
            })

        except ValueError as e:
            return Response({
                'success': False,
                'error': f'Invalid parameter: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OperationsDownloadView(APIView):
    """Download operations report as file."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Download Operations Report",
        description="Downloads an operations report as a JSON file.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=False,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='type',
                description='Report type (incidents, changes, complete, oscal-incidents, oscal-changes)',
                required=False,
                type=str,
                default='complete',
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x'],
    )
    def get(self, request):
        """Download operations report as file."""
        from django.http import HttpResponse
        import json

        cso_id = request.query_params.get('cso_id')
        report_type = request.query_params.get('type', 'complete')

        try:
            cso_uuid = UUID(cso_id) if cso_id else None
            service = get_incident_change_export_service(cso_id=cso_uuid)

            cso_prefix = cso_id[:8] if cso_id else 'all'

            if report_type == 'incidents':
                data = service.generate_incident_report()
                filename = f'incident-report-{cso_prefix}.json'
            elif report_type == 'changes':
                data = service.generate_change_control_report()
                filename = f'change-control-report-{cso_prefix}.json'
            elif report_type == 'oscal-incidents':
                data = service.generate_oscal_incident_observations()
                filename = f'oscal-incident-observations-{cso_prefix}.json'
            elif report_type == 'oscal-changes':
                data = service.generate_oscal_change_poam()
                filename = f'oscal-change-poam-{cso_prefix}.json'
            else:
                data = service.generate_complete_operations_package()
                filename = f'operations-complete-{cso_prefix}.json'

            content = json.dumps(data, indent=2)

            response = HttpResponse(content, content_type='application/json')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except ValueError as e:
            return Response({
                'success': False,
                'error': f'Invalid parameter: {str(e)}',
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
