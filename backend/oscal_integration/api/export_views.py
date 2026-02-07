"""
Document Export API Views

Django REST Framework views for generating and downloading compliance documents
including SSP, SAR, SAP, POA&M, Risk Register, and Continuous Monitoring Reports.
"""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.http import HttpResponse

from ..services.export_builder import ExportBuilder, DOCUMENT_TYPE_INFO, DocumentType

logger = logging.getLogger(__name__)


class DocumentExportView(APIView):
    """
    Generate and download a compliance document.

    POST /api/documents/export/
    {
        "document_type": "ssp|sar|sap|poam|risk_register|conmon_report",
        "format": "docx|xlsx|pdf|oscal_json|oscal_yaml|csv",
        "assessment_id": "<uuid>",  (optional, for SSP/SAR/SAP/POAM)
        "system_id": "<uuid>",      (optional, for risk register/conmon)
        "options": {}                (optional, generation options)
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Generate and download a compliance document."""
        doc_type = request.data.get('document_type')
        format_key = request.data.get('format', 'docx')
        assessment_id = request.data.get('assessment_id')
        system_id = request.data.get('system_id')
        options = request.data.get('options', {})

        if not doc_type:
            return Response(
                {'error': 'document_type is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate document type
        valid_types = [dt.value for dt in DocumentType]
        if doc_type not in valid_types:
            return Response(
                {
                    'error': f"Invalid document_type '{doc_type}'. Valid types: {valid_types}",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Assessment-based documents require assessment_id
        assessment_types = ['ssp', 'sar', 'sap', 'poam']
        if doc_type in assessment_types and not assessment_id:
            return Response(
                {'error': f'assessment_id is required for {doc_type} generation'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            builder = ExportBuilder()
            result = builder.generate_document(
                doc_type=doc_type,
                format=format_key,
                assessment_id=assessment_id,
                system_id=system_id,
                options=options,
            )

            if not result.success:
                return Response(
                    {
                        'error': 'Document generation failed',
                        'errors': result.errors,
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Return the file as a download response
            response = HttpResponse(
                result.content_bytes,
                content_type=result.content_type,
            )
            response['Content-Disposition'] = f'attachment; filename="{result.filename}"'
            response['X-Document-Type'] = doc_type
            response['X-Document-Format'] = format_key

            return response

        except Exception as e:
            logger.error(f"Error in document export: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DocumentListView(APIView):
    """
    List available document types and their supported formats.

    GET /api/documents/types/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return available document types and recent exports."""
        document_types = ExportBuilder.get_document_types()

        # Format options for the frontend
        format_options = [
            {'value': 'docx', 'label': 'Word Document (.docx)', 'icon': 'fa-file-word'},
            {'value': 'xlsx', 'label': 'Excel Spreadsheet (.xlsx)', 'icon': 'fa-file-excel'},
            {'value': 'pdf', 'label': 'PDF / HTML (.html)', 'icon': 'fa-file-pdf'},
            {'value': 'oscal_json', 'label': 'OSCAL JSON (.json)', 'icon': 'fa-code'},
            {'value': 'oscal_yaml', 'label': 'OSCAL YAML (.yaml)', 'icon': 'fa-code'},
            {'value': 'csv', 'label': 'CSV (.csv)', 'icon': 'fa-file-csv'},
        ]

        return Response({
            'document_types': document_types,
            'format_options': format_options,
        })


class DocumentPreviewView(APIView):
    """
    Preview document generation options and estimated size.

    POST /api/documents/preview/
    {
        "document_type": "ssp",
        "assessment_id": "<uuid>"
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Preview what a document export will contain."""
        doc_type = request.data.get('document_type')
        assessment_id = request.data.get('assessment_id')

        if not doc_type:
            return Response(
                {'error': 'document_type is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        type_info = DOCUMENT_TYPE_INFO.get(DocumentType(doc_type))
        if not type_info:
            return Response(
                {'error': f'Unknown document type: {doc_type}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        preview = {
            'document_type': doc_type,
            'name': type_info['name'],
            'description': type_info['description'],
            'supported_formats': [f.value for f in type_info['supported_formats']],
            'assessment_id': assessment_id,
        }

        # Add assessment-specific preview info if available
        if assessment_id and doc_type in ('ssp', 'sar', 'sap'):
            try:
                from core.models import ComplianceAssessment, RequirementAssessment

                assessment = ComplianceAssessment.objects.get(id=assessment_id)
                req_count = RequirementAssessment.objects.filter(
                    compliance_assessment=assessment
                ).count()

                preview['assessment_info'] = {
                    'name': str(assessment),
                    'framework': str(assessment.framework) if assessment.framework else 'N/A',
                    'project': str(assessment.project) if assessment.project else 'N/A',
                    'requirement_count': req_count,
                }
            except Exception as e:
                preview['assessment_info'] = {'error': str(e)}

        return Response(preview)
