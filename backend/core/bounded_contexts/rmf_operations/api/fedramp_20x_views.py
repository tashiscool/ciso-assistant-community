"""
FedRAMP 20x Export and Import API Views

API endpoints for generating machine-readable FedRAMP 20x packages and
importing KSI requirements.
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
from ..services.ksi_import import KSIImportService
from ..services.validation_templates import (
    get_validation_template_service,
    VALIDATION_RULE_TEMPLATES,
)
from ..services.oar_workflow import get_oar_generation_service


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
                oscal_data = package.to_oscal()
                return Response({
                    'success': True,
                    'data': oscal_data,
                    'format': 'oscal-ar',
                    'oscal_version': '1.1.2',
                })

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


# =============================================================================
# KSI Import Views
# =============================================================================

class KSIImportPreviewView(APIView):
    """Preview KSI import for a Cloud Service Offering."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Preview KSI Import",
        description="Shows what KSIs would be imported without creating records. "
                    "Useful for confirming the import scope before executing.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=True,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='impact_level',
                description='Override impact level (low, moderate, high)',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='categories',
                description='Comma-separated list of categories to import (e.g., AFR,IAM,CMT)',
                required=False,
                type=str,
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x', 'KSI Management'],
    )
    def get(self, request):
        """Get import preview."""
        cso_id = request.query_params.get('cso_id')
        impact_level = request.query_params.get('impact_level')
        categories_str = request.query_params.get('categories')

        if not cso_id:
            return Response({
                'success': False,
                'error': 'cso_id is required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            cso_uuid = UUID(cso_id)
            categories = categories_str.split(',') if categories_str else None

            service = KSIImportService()
            preview = service.get_import_preview(
                cso_id=cso_uuid,
                impact_level=impact_level,
                categories=categories
            )

            return Response({
                'success': True,
                'data': preview,
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class KSIImportExecuteView(APIView):
    """Execute KSI import for a Cloud Service Offering."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Import KSIs for CSO",
        description="Imports KSI requirements from the FedRAMP 20x library "
                    "and creates KSIImplementation records for the specified CSO.",
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
                    'impact_level': {
                        'type': 'string',
                        'description': 'Override impact level (low, moderate, high)',
                    },
                    'categories': {
                        'type': 'array',
                        'items': {'type': 'string'},
                        'description': 'Specific categories to import',
                    },
                    'skip_existing': {
                        'type': 'boolean',
                        'description': 'Skip KSIs that already exist (default: true)',
                        'default': True,
                    },
                },
            }
        },
        responses={200: dict},
        tags=['FedRAMP 20x', 'KSI Management'],
    )
    def post(self, request, cso_id):
        """Execute KSI import."""
        try:
            cso_uuid = UUID(cso_id)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid cso_id format',
            }, status=status.HTTP_400_BAD_REQUEST)

        impact_level = request.data.get('impact_level')
        categories = request.data.get('categories')
        skip_existing = request.data.get('skip_existing', True)

        try:
            service = KSIImportService()
            implementations = service.import_ksis_for_cso(
                cso_id=cso_uuid,
                impact_level=impact_level,
                categories=categories,
                skip_existing=skip_existing,
                created_by=request.user.id if request.user else None
            )

            return Response({
                'success': True,
                'data': {
                    'imported_count': len(implementations),
                    'ksi_ids': [str(impl.id) for impl in implementations],
                    'ksi_refs': [impl.ksi_ref_id for impl in implementations],
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class KSICategoriesView(APIView):
    """Get available KSI categories."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get KSI Categories",
        description="Returns the list of available KSI categories from the "
                    "FedRAMP 20x library with their KSI counts.",
        responses={200: dict},
        tags=['FedRAMP 20x', 'KSI Management'],
    )
    def get(self, request):
        """Get available categories."""
        try:
            service = KSIImportService()
            categories = service.get_available_categories()

            return Response({
                'success': True,
                'data': {
                    'categories': categories,
                    'total_categories': len(categories),
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class KSILibraryMetadataView(APIView):
    """Get KSI library metadata."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get KSI Library Metadata",
        description="Returns metadata about the FedRAMP 20x KSI library "
                    "including version, provider, and KSI counts by impact level.",
        responses={200: dict},
        tags=['FedRAMP 20x', 'KSI Management'],
    )
    def get(self, request):
        """Get library metadata."""
        try:
            service = KSIImportService()
            metadata = service.parser.get_library_metadata()
            counts = service.parser.get_ksi_count_by_impact_level()

            return Response({
                'success': True,
                'data': {
                    **metadata,
                    'ksi_counts': counts,
                    'impact_levels': ['LOW', 'MOD'],
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# Validation Rule Template Views
# =============================================================================

class ValidationTemplateListView(APIView):
    """List available validation rule templates."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List Validation Rule Templates",
        description="Returns all available validation rule templates. "
                    "Templates can be filtered by category and rule type.",
        parameters=[
            OpenApiParameter(
                name='category',
                description='Filter by category (e.g., identity, change_management)',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='rule_type',
                description='Filter by rule type (api, scanner, config, log, evidence, manual)',
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name='ksi_ref',
                description='Filter by applicable KSI reference (e.g., KSI-IAM-01)',
                required=False,
                type=str,
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x', 'Validation Rules'],
    )
    def get(self, request):
        """Get list of validation templates."""
        category = request.query_params.get('category')
        rule_type = request.query_params.get('rule_type')
        ksi_ref = request.query_params.get('ksi_ref')

        try:
            service = get_validation_template_service()

            if ksi_ref:
                templates = service.get_templates_for_ksi(ksi_ref)
            else:
                templates = service.list_templates(
                    category=category,
                    rule_type=rule_type
                )

            # Convert to dict for JSON serialization
            template_data = []
            for t in templates:
                template_data.append({
                    'id': t.id,
                    'name': t.name,
                    'description': t.description,
                    'rule_type': t.rule_type,
                    'applicable_ksi_refs': t.applicable_ksi_refs,
                    'default_frequency': t.default_frequency,
                    'requires_integration': t.requires_integration,
                    'category': t.category,
                    'parameters': t.parameters,
                })

            return Response({
                'success': True,
                'data': {
                    'templates': template_data,
                    'total': len(template_data),
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ValidationTemplateDetailView(APIView):
    """Get details of a specific validation rule template."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get Validation Rule Template",
        description="Returns full details of a specific validation rule template "
                    "including default definition and pass criteria.",
        parameters=[
            OpenApiParameter(
                name='template_id',
                description='Template ID',
                required=True,
                type=str,
                location=OpenApiParameter.PATH,
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x', 'Validation Rules'],
    )
    def get(self, request, template_id):
        """Get template details."""
        try:
            service = get_validation_template_service()
            template = service.get_template(template_id)

            if not template:
                return Response({
                    'success': False,
                    'error': f'Template not found: {template_id}',
                }, status=status.HTTP_404_NOT_FOUND)

            return Response({
                'success': True,
                'data': {
                    'id': template.id,
                    'name': template.name,
                    'description': template.description,
                    'rule_type': template.rule_type,
                    'applicable_ksi_refs': template.applicable_ksi_refs,
                    'default_frequency': template.default_frequency,
                    'default_definition': template.default_definition,
                    'default_pass_criteria': template.default_pass_criteria,
                    'requires_integration': template.requires_integration,
                    'category': template.category,
                    'parameters': template.parameters,
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ValidationTemplateInstantiateView(APIView):
    """Instantiate a validation rule from a template."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Instantiate Validation Rule from Template",
        description="Creates a new persistent validation rule from a template. "
                    "The rule will be associated with the specified KSI implementation.",
        parameters=[
            OpenApiParameter(
                name='template_id',
                description='Template ID',
                required=True,
                type=str,
                location=OpenApiParameter.PATH,
            ),
        ],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'ksi_implementation_id': {
                        'type': 'string',
                        'format': 'uuid',
                        'description': 'KSI Implementation ID to attach the rule to',
                    },
                    'name': {
                        'type': 'string',
                        'description': 'Custom name for the rule (optional)',
                    },
                    'frequency': {
                        'type': 'string',
                        'description': 'Validation frequency (optional, uses template default)',
                    },
                    'parameters': {
                        'type': 'object',
                        'description': 'Parameter values for the rule',
                    },
                },
                'required': ['ksi_implementation_id'],
            }
        },
        responses={200: dict},
        tags=['FedRAMP 20x', 'Validation Rules'],
    )
    def post(self, request, template_id):
        """Instantiate validation rule from template."""
        ksi_implementation_id = request.data.get('ksi_implementation_id')
        custom_name = request.data.get('name')
        frequency = request.data.get('frequency')
        parameters = request.data.get('parameters', {})

        if not ksi_implementation_id:
            return Response({
                'success': False,
                'error': 'ksi_implementation_id is required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            ksi_uuid = UUID(ksi_implementation_id)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid ksi_implementation_id format',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_validation_template_service()
            rule = service.instantiate_template(
                template_id=template_id,
                ksi_implementation_id=ksi_uuid,
                custom_name=custom_name,
                frequency_override=frequency,
                parameter_values=parameters,
                created_by=request.user.id if request.user else None
            )

            if not rule:
                return Response({
                    'success': False,
                    'error': f'Template not found: {template_id}',
                }, status=status.HTTP_404_NOT_FOUND)

            return Response({
                'success': True,
                'data': {
                    'rule_id': str(rule.id),
                    'name': rule.name,
                    'rule_type': rule.rule_type,
                    'frequency': rule.frequency,
                    'is_active': rule.is_active,
                    'ksi_implementation_id': str(rule.ksi_implementation_id),
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ValidationTemplateCategoriesView(APIView):
    """Get available template categories."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get Validation Template Categories",
        description="Returns the list of available template categories with counts.",
        responses={200: dict},
        tags=['FedRAMP 20x', 'Validation Rules'],
    )
    def get(self, request):
        """Get available categories."""
        try:
            service = get_validation_template_service()
            categories = service.get_categories()

            return Response({
                'success': True,
                'data': {
                    'categories': categories,
                    'total': len(categories),
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ValidationTemplateBulkInstantiateView(APIView):
    """Bulk instantiate validation rules for a KSI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Bulk Instantiate Validation Rules",
        description="Creates all applicable validation rules for a KSI implementation "
                    "based on the KSI reference.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'ksi_implementation_id': {
                        'type': 'string',
                        'format': 'uuid',
                        'description': 'KSI Implementation ID',
                    },
                    'ksi_ref': {
                        'type': 'string',
                        'description': 'KSI Reference (e.g., KSI-IAM-01)',
                    },
                    'skip_integration_required': {
                        'type': 'boolean',
                        'description': 'Skip templates requiring integrations (default: true)',
                        'default': True,
                    },
                },
                'required': ['ksi_implementation_id', 'ksi_ref'],
            }
        },
        responses={200: dict},
        tags=['FedRAMP 20x', 'Validation Rules'],
    )
    def post(self, request):
        """Bulk instantiate validation rules."""
        ksi_implementation_id = request.data.get('ksi_implementation_id')
        ksi_ref = request.data.get('ksi_ref')
        skip_integration = request.data.get('skip_integration_required', True)

        if not ksi_implementation_id or not ksi_ref:
            return Response({
                'success': False,
                'error': 'ksi_implementation_id and ksi_ref are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            ksi_uuid = UUID(ksi_implementation_id)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid ksi_implementation_id format',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_validation_template_service()
            templates = service.get_templates_for_ksi(ksi_ref)

            rules_created = []
            for template in templates:
                # Skip templates that require integrations if flag is set
                if skip_integration and template.requires_integration:
                    continue

                rule = service.instantiate_template(
                    template_id=template.id,
                    ksi_implementation_id=ksi_uuid,
                    created_by=request.user.id if request.user else None
                )
                if rule:
                    rules_created.append({
                        'rule_id': str(rule.id),
                        'template_id': template.id,
                        'name': rule.name,
                        'rule_type': rule.rule_type,
                    })

            return Response({
                'success': True,
                'data': {
                    'rules_created': rules_created,
                    'total': len(rules_created),
                    'templates_available': len(templates),
                    'skipped_integration': len(templates) - len(rules_created) if skip_integration else 0,
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# OAR Generation Views
# =============================================================================

class OARGenerateView(APIView):
    """Generate Ongoing Authorization Report (OAR)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Generate OAR",
        description="Generates a complete Ongoing Authorization Report for the "
                    "specified CSO and reporting period. Captures KSI snapshots, "
                    "vulnerability metrics, incidents, and changes.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'cso_id': {
                        'type': 'string',
                        'format': 'uuid',
                        'description': 'Cloud Service Offering ID',
                    },
                    'year': {
                        'type': 'integer',
                        'description': 'Reporting year',
                    },
                    'quarter': {
                        'type': 'string',
                        'enum': ['Q1', 'Q2', 'Q3', 'Q4'],
                        'description': 'Reporting quarter',
                    },
                    'use_ai_summary': {
                        'type': 'boolean',
                        'description': 'Generate AI-powered executive summary',
                        'default': False,
                    },
                },
                'required': ['cso_id', 'year', 'quarter'],
            }
        },
        responses={200: dict},
        tags=['FedRAMP 20x', 'OAR'],
    )
    def post(self, request):
        """Generate OAR."""
        cso_id = request.data.get('cso_id')
        year = request.data.get('year')
        quarter = request.data.get('quarter')
        use_ai_summary = request.data.get('use_ai_summary', False)

        if not cso_id or not year or not quarter:
            return Response({
                'success': False,
                'error': 'cso_id, year, and quarter are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            cso_uuid = UUID(cso_id)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid cso_id format',
            }, status=status.HTTP_400_BAD_REQUEST)

        if quarter not in ['Q1', 'Q2', 'Q3', 'Q4']:
            return Response({
                'success': False,
                'error': 'Invalid quarter. Must be Q1, Q2, Q3, or Q4',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_oar_generation_service(cso_id=cso_uuid)
            oar_data = service.generate_oar(
                year=int(year),
                quarter=quarter,
                use_ai_summary=use_ai_summary,
                created_by=request.user.id if request.user else None
            )

            return Response({
                'success': True,
                'data': oar_data.to_dict(),
            })

        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OARExportPackageView(APIView):
    """Export OAR as complete package."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Export OAR Package",
        description="Exports an OAR as a complete FedRAMP 20x package ready for submission.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'cso_id': {
                        'type': 'string',
                        'format': 'uuid',
                        'description': 'Cloud Service Offering ID',
                    },
                    'year': {
                        'type': 'integer',
                        'description': 'Reporting year',
                    },
                    'quarter': {
                        'type': 'string',
                        'enum': ['Q1', 'Q2', 'Q3', 'Q4'],
                        'description': 'Reporting quarter',
                    },
                },
                'required': ['cso_id', 'year', 'quarter'],
            }
        },
        responses={200: dict},
        tags=['FedRAMP 20x', 'OAR'],
    )
    def post(self, request):
        """Export OAR package."""
        cso_id = request.data.get('cso_id')
        year = request.data.get('year')
        quarter = request.data.get('quarter')

        if not cso_id or not year or not quarter:
            return Response({
                'success': False,
                'error': 'cso_id, year, and quarter are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            cso_uuid = UUID(cso_id)
            service = get_oar_generation_service(cso_id=cso_uuid)
            oar_data = service.generate_oar(
                year=int(year),
                quarter=quarter,
            )
            package = service.export_oar_package(oar_data)

            return Response({
                'success': True,
                'data': package,
            })

        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OARDownloadView(APIView):
    """Download OAR as JSON file."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Download OAR",
        description="Downloads an OAR as a JSON file.",
        parameters=[
            OpenApiParameter(
                name='cso_id',
                description='Cloud Service Offering ID',
                required=True,
                type=OpenApiTypes.UUID,
            ),
            OpenApiParameter(
                name='year',
                description='Reporting year',
                required=True,
                type=int,
            ),
            OpenApiParameter(
                name='quarter',
                description='Reporting quarter (Q1, Q2, Q3, Q4)',
                required=True,
                type=str,
            ),
        ],
        responses={200: dict},
        tags=['FedRAMP 20x', 'OAR'],
    )
    def get(self, request):
        """Download OAR as file."""
        from django.http import HttpResponse
        import json

        cso_id = request.query_params.get('cso_id')
        year = request.query_params.get('year')
        quarter = request.query_params.get('quarter')

        if not cso_id or not year or not quarter:
            return Response({
                'success': False,
                'error': 'cso_id, year, and quarter are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            cso_uuid = UUID(cso_id)
            service = get_oar_generation_service(cso_id=cso_uuid)
            oar_data = service.generate_oar(
                year=int(year),
                quarter=quarter,
            )
            package = service.export_oar_package(oar_data)

            filename = f'oar-{cso_id[:8]}-{year}-{quarter}.json'
            content = json.dumps(package, indent=2)

            response = HttpResponse(content, content_type='application/json')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
