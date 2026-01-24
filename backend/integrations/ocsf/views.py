"""
OCSF Integration API Views

Provides REST API endpoints for OCSF event import and translation.
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser
from uuid import UUID
import logging
import json

from .ocsf_parser import get_ocsf_parser, OCSFParseError
from .ocsf_to_oscal import get_ocsf_translator
from .ocsf_models import (
    OCSFEventClass,
    SecurityFinding,
    VulnerabilityFinding,
    ComplianceFinding,
    DetectionFinding,
)

logger = logging.getLogger(__name__)


class OCSFParseView(APIView):
    """Parse and validate OCSF events."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request):
        """
        Parse OCSF event data.

        Request body: OCSF event JSON (single event or array)

        Returns:
        - Parsed events with validation status
        """
        try:
            parser = get_ocsf_parser()
            events = parser.parse(request.data)

            return Response({
                'status': 'success',
                'events_count': len(events),
                'events': [event.to_dict() for event in events],
                'summary': {
                    'security_findings': sum(1 for e in events if isinstance(e, SecurityFinding)),
                    'vulnerability_findings': sum(1 for e in events if isinstance(e, VulnerabilityFinding)),
                    'compliance_findings': sum(1 for e in events if isinstance(e, ComplianceFinding)),
                    'detection_findings': sum(1 for e in events if isinstance(e, DetectionFinding)),
                },
            })

        except OCSFParseError as e:
            return Response(
                {'error': f'Parse error: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error parsing OCSF events: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OCSFImportView(APIView):
    """Import OCSF events into CISO Assistant."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser]

    def post(self, request):
        """
        Import OCSF events into CISO Assistant.

        Request body:
        {
            "events": [...],  # OCSF events
            "folder_id": "uuid",
            "options": {
                "create_vulnerabilities": true,
                "create_findings": true,
                "create_assets": false
            }
        }
        """
        try:
            events_data = request.data.get('events', [])
            folder_id = request.data.get('folder_id')
            options = request.data.get('options', {})

            if not folder_id:
                return Response(
                    {'error': 'folder_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            parser = get_ocsf_parser()
            events = parser.parse(events_data)

            results = {
                'imported': 0,
                'vulnerabilities_created': 0,
                'findings_created': 0,
                'errors': [],
            }

            folder_uuid = UUID(folder_id)

            for event in events:
                try:
                    # Import vulnerability findings
                    if isinstance(event, VulnerabilityFinding) and options.get('create_vulnerabilities', True):
                        vuln_data = parser.to_ciso_vulnerability(event, folder_uuid)
                        # Create vulnerability in database
                        from core.models import Vulnerability
                        Vulnerability.objects.create(**vuln_data)
                        results['vulnerabilities_created'] += 1
                        results['imported'] += 1

                    # Import security findings
                    elif isinstance(event, SecurityFinding) and options.get('create_findings', True):
                        finding_data = parser.to_ciso_finding(event, folder_uuid)
                        from core.models import Finding
                        Finding.objects.create(**finding_data)
                        results['findings_created'] += 1
                        results['imported'] += 1

                except Exception as e:
                    results['errors'].append({
                        'event_uid': event.metadata.uid,
                        'error': str(e),
                    })

            return Response({
                'status': 'success',
                'results': results,
            })

        except OCSFParseError as e:
            return Response(
                {'error': f'Parse error: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error importing OCSF events: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OCSFToOSCALView(APIView):
    """Translate OCSF events to OSCAL format."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request):
        """
        Translate OCSF events to OSCAL format.

        Request body:
        {
            "events": [...],  # OCSF events
            "output_format": "assessment-results" | "poam" | "observations",
            "system_id": "optional-system-id"
        }
        """
        try:
            events_data = request.data.get('events', [])
            output_format = request.data.get('output_format', 'assessment-results')
            system_id = request.data.get('system_id')

            parser = get_ocsf_parser()
            events = parser.parse(events_data)

            translator = get_ocsf_translator(system_id)

            if output_format == 'assessment-results':
                result = translator.translate_to_assessment_result(events)
            elif output_format == 'poam':
                result = {
                    'poam-items': [
                        translator.translate_to_poam_item(event)
                        for event in events
                    ]
                }
            elif output_format == 'observations':
                result = {
                    'observations': [
                        translator.translate_to_observation(event)
                        for event in events
                    ]
                }
            elif output_format == 'findings':
                findings_data = [
                    translator.translate_to_finding(event)
                    for event in events
                ]
                result = {
                    'findings': [f['finding'] for f in findings_data],
                    'observations': [f['observation'] for f in findings_data],
                }
            else:
                return Response(
                    {'error': f'Unknown output_format: {output_format}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return Response({
                'status': 'success',
                'format': output_format,
                'events_translated': len(events),
                'oscal': result,
            })

        except OCSFParseError as e:
            return Response(
                {'error': f'Parse error: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error translating OCSF to OSCAL: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OCSFSchemaView(APIView):
    """Get OCSF schema information."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get supported OCSF event classes and schema information.
        """
        return Response({
            'supported_event_classes': [
                {
                    'class_uid': OCSFEventClass.SECURITY_FINDING,
                    'class_name': 'Security Finding',
                    'description': 'General security-relevant observation or detection',
                },
                {
                    'class_uid': OCSFEventClass.VULNERABILITY_FINDING,
                    'class_name': 'Vulnerability Finding',
                    'description': 'Discovered vulnerability information',
                },
                {
                    'class_uid': OCSFEventClass.COMPLIANCE_FINDING,
                    'class_name': 'Compliance Finding',
                    'description': 'Compliance check result',
                },
                {
                    'class_uid': OCSFEventClass.DETECTION_FINDING,
                    'class_name': 'Detection Finding',
                    'description': 'Threat detection event',
                },
            ],
            'severity_levels': [
                {'id': 0, 'name': 'Unknown'},
                {'id': 1, 'name': 'Informational'},
                {'id': 2, 'name': 'Low'},
                {'id': 3, 'name': 'Medium'},
                {'id': 4, 'name': 'High'},
                {'id': 5, 'name': 'Critical'},
                {'id': 6, 'name': 'Fatal'},
            ],
            'ocsf_version': '1.1.0',
            'import_capabilities': [
                'vulnerabilities',
                'findings',
                'compliance_assessments',
            ],
            'export_capabilities': [
                'oscal_assessment_results',
                'oscal_poam',
                'oscal_observations',
            ],
        })


class OCSFUploadView(APIView):
    """Upload OCSF event file."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        """
        Upload and parse an OCSF event file.

        Supports JSON and NDJSON formats.
        """
        try:
            file = request.FILES.get('file')
            if not file:
                return Response(
                    {'error': 'No file uploaded'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Read file content
            content = file.read().decode('utf-8')

            parser = get_ocsf_parser()
            events = parser.parse(content)

            return Response({
                'status': 'success',
                'filename': file.name,
                'events_count': len(events),
                'summary': {
                    'security_findings': sum(1 for e in events if isinstance(e, SecurityFinding)),
                    'vulnerability_findings': sum(1 for e in events if isinstance(e, VulnerabilityFinding)),
                    'compliance_findings': sum(1 for e in events if isinstance(e, ComplianceFinding)),
                    'detection_findings': sum(1 for e in events if isinstance(e, DetectionFinding)),
                },
                'events': [event.to_dict() for event in events[:100]],  # Limit preview
            })

        except OCSFParseError as e:
            return Response(
                {'error': f'Parse error: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error uploading OCSF file: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
