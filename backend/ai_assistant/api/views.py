"""
AI Assistant API Views

Provides REST API endpoints for AI-powered suggestions.
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter

from ..services.suggestion_engine import SuggestionEngine, SuggestionType


class RequirementSuggestionsView(APIView):
    """Get AI suggestions for a requirement assessment."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get AI suggestions for requirement assessment",
        description="Returns AI-powered suggestions for controls, evidence, and remediation for a requirement assessment.",
        parameters=[
            OpenApiParameter(
                name='suggestion_types',
                description='Comma-separated list of suggestion types to filter',
                required=False,
                type=str,
            ),
        ],
        responses={200: dict},
    )
    def get(self, request, pk):
        """Get suggestions for a requirement assessment."""
        engine = SuggestionEngine()

        # Parse suggestion types filter
        suggestion_types = None
        types_param = request.query_params.get('suggestion_types')
        if types_param:
            type_names = [t.strip() for t in types_param.split(',')]
            suggestion_types = [
                SuggestionType(name) for name in type_names
                if name in SuggestionType._value2member_map_
            ]

        try:
            suggestions = engine.get_requirement_suggestions(
                str(pk),
                suggestion_types=suggestion_types
            )

            return Response({
                'success': True,
                'suggestions': [s.to_dict() for s in suggestions],
                'count': len(suggestions),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RiskSuggestionsView(APIView):
    """Get AI suggestions for a risk scenario."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get AI suggestions for risk scenario",
        description="Returns AI-powered suggestions for risk mitigation and control recommendations.",
        parameters=[
            OpenApiParameter(
                name='suggestion_types',
                description='Comma-separated list of suggestion types to filter',
                required=False,
                type=str,
            ),
        ],
        responses={200: dict},
    )
    def get(self, request, pk):
        """Get suggestions for a risk scenario."""
        engine = SuggestionEngine()

        suggestion_types = None
        types_param = request.query_params.get('suggestion_types')
        if types_param:
            type_names = [t.strip() for t in types_param.split(',')]
            suggestion_types = [
                SuggestionType(name) for name in type_names
                if name in SuggestionType._value2member_map_
            ]

        try:
            suggestions = engine.get_risk_suggestions(
                str(pk),
                suggestion_types=suggestion_types
            )

            return Response({
                'success': True,
                'suggestions': [s.to_dict() for s in suggestions],
                'count': len(suggestions),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ControlSuggestionsView(APIView):
    """Get AI suggestions for control implementation."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get AI suggestions for control implementation",
        description="Returns AI-powered suggestions for implementing and evidencing a control.",
        responses={200: dict},
    )
    def get(self, request, pk):
        """Get suggestions for an applied control."""
        engine = SuggestionEngine()

        try:
            suggestions = engine.get_control_suggestions(str(pk))

            return Response({
                'success': True,
                'suggestions': [s.to_dict() for s in suggestions],
                'count': len(suggestions),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class EvidenceSuggestionsView(APIView):
    """Get AI suggestions for evidence collection."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get AI suggestions for evidence collection",
        description="Returns AI-powered suggestions for what evidence to collect for an entity.",
        parameters=[
            OpenApiParameter(
                name='entity_type',
                description='Type of entity (requirement_assessment, applied_control, evidence)',
                required=True,
                type=str,
            ),
        ],
        responses={200: dict},
    )
    def get(self, request, pk):
        """Get evidence suggestions for an entity."""
        engine = SuggestionEngine()

        entity_type = request.query_params.get('entity_type', 'requirement_assessment')

        try:
            suggestions = engine.get_evidence_suggestions(entity_type, str(pk))

            return Response({
                'success': True,
                'suggestions': [s.to_dict() for s in suggestions],
                'count': len(suggestions),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ComplianceGapAnalysisView(APIView):
    """Get compliance gap analysis and recommendations."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get compliance gap analysis",
        description="Returns AI-powered gap analysis and recommendations for a compliance assessment.",
        responses={200: dict},
    )
    def get(self, request, pk):
        """Get gap analysis for a compliance assessment."""
        engine = SuggestionEngine()

        try:
            suggestions = engine.get_compliance_gap_analysis(str(pk))

            return Response({
                'success': True,
                'suggestions': [s.to_dict() for s in suggestions],
                'count': len(suggestions),
                'summary': {
                    'total_gaps': sum(
                        s.metadata.get('non_compliant_count', 0) +
                        s.metadata.get('partially_compliant_count', 0)
                        for s in suggestions
                    ),
                    'missing_evidence': sum(
                        s.metadata.get('missing_evidence_count', 0)
                        for s in suggestions
                    ),
                }
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BulkSuggestionsView(APIView):
    """Get bulk AI suggestions for multiple entities."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get bulk AI suggestions",
        description="Returns AI-powered suggestions for multiple entities at once.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'entities': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'type': {'type': 'string'},
                                'id': {'type': 'string'},
                            }
                        }
                    }
                }
            }
        },
        responses={200: dict},
    )
    def post(self, request):
        """Get suggestions for multiple entities."""
        engine = SuggestionEngine()
        entities = request.data.get('entities', [])

        results = []
        for entity in entities:
            entity_type = entity.get('type')
            entity_id = entity.get('id')

            try:
                if entity_type == 'requirement_assessment':
                    suggestions = engine.get_requirement_suggestions(entity_id)
                elif entity_type == 'risk_scenario':
                    suggestions = engine.get_risk_suggestions(entity_id)
                elif entity_type == 'applied_control':
                    suggestions = engine.get_control_suggestions(entity_id)
                else:
                    suggestions = []

                results.append({
                    'entity_type': entity_type,
                    'entity_id': entity_id,
                    'suggestions': [s.to_dict() for s in suggestions],
                    'count': len(suggestions),
                })

            except Exception as e:
                results.append({
                    'entity_type': entity_type,
                    'entity_id': entity_id,
                    'error': str(e),
                })

        return Response({
            'success': True,
            'results': results,
            'total_entities': len(entities),
        })


# =============================================================================
# AI Author Views
# =============================================================================

class AIAuthorDraftControlView(APIView):
    """Draft a control implementation statement using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Draft control implementation",
        description="Uses AI to draft a control implementation statement based on requirements.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'control_id': {'type': 'string'},
                    'requirement_text': {'type': 'string'},
                    'framework': {'type': 'string'},
                    'context': {'type': 'object'},
                    'existing_implementation': {'type': 'string'},
                },
                'required': ['control_id', 'requirement_text'],
            }
        },
        responses={200: dict},
        tags=['AI Author'],
    )
    def post(self, request):
        """Draft a control implementation."""
        from ..services.ai_author import get_ai_author_service

        control_id = request.data.get('control_id')
        requirement_text = request.data.get('requirement_text')
        framework = request.data.get('framework', 'nist_800_53')
        context = request.data.get('context', {})
        existing_implementation = request.data.get('existing_implementation')

        if not control_id or not requirement_text:
            return Response({
                'success': False,
                'error': 'control_id and requirement_text are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_author_service()
            draft = service.draft_control_implementation(
                control_id=control_id,
                requirement_text=requirement_text,
                framework=framework,
                context=context,
                existing_implementation=existing_implementation,
            )

            return Response({
                'success': True,
                'data': draft.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIAuthorDraftPolicyView(APIView):
    """Draft a policy section using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Draft policy section",
        description="Uses AI to draft a policy section for a given topic.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'topic': {'type': 'string'},
                    'framework': {'type': 'string'},
                    'related_controls': {'type': 'array', 'items': {'type': 'string'}},
                    'context': {'type': 'object'},
                },
                'required': ['topic'],
            }
        },
        responses={200: dict},
        tags=['AI Author'],
    )
    def post(self, request):
        """Draft a policy section."""
        from ..services.ai_author import get_ai_author_service

        topic = request.data.get('topic')
        framework = request.data.get('framework', 'nist_800_53')
        related_controls = request.data.get('related_controls', [])
        context = request.data.get('context', {})

        if not topic:
            return Response({
                'success': False,
                'error': 'topic is required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_author_service()
            draft = service.draft_policy_section(
                topic=topic,
                framework=framework,
                related_controls=related_controls,
                context=context,
            )

            return Response({
                'success': True,
                'data': draft.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIAuthorDraftProcedureView(APIView):
    """Draft a procedure document using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Draft procedure",
        description="Uses AI to draft a procedure document.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'procedure_name': {'type': 'string'},
                    'purpose': {'type': 'string'},
                    'related_controls': {'type': 'array', 'items': {'type': 'string'}},
                    'context': {'type': 'object'},
                },
                'required': ['procedure_name', 'purpose'],
            }
        },
        responses={200: dict},
        tags=['AI Author'],
    )
    def post(self, request):
        """Draft a procedure."""
        from ..services.ai_author import get_ai_author_service

        procedure_name = request.data.get('procedure_name')
        purpose = request.data.get('purpose')
        related_controls = request.data.get('related_controls', [])
        context = request.data.get('context', {})

        if not procedure_name or not purpose:
            return Response({
                'success': False,
                'error': 'procedure_name and purpose are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_author_service()
            draft = service.draft_procedure(
                procedure_name=procedure_name,
                purpose=purpose,
                related_controls=related_controls,
                context=context,
            )

            return Response({
                'success': True,
                'data': draft.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIAuthorDraftSSPView(APIView):
    """Draft an SSP narrative using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Draft SSP narrative",
        description="Uses AI to draft an SSP narrative for a control.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'control_id': {'type': 'string'},
                    'requirement_text': {'type': 'string'},
                    'system_description': {'type': 'string'},
                    'implementation_details': {'type': 'object'},
                },
                'required': ['control_id', 'requirement_text', 'system_description'],
            }
        },
        responses={200: dict},
        tags=['AI Author'],
    )
    def post(self, request):
        """Draft an SSP narrative."""
        from ..services.ai_author import get_ai_author_service

        control_id = request.data.get('control_id')
        requirement_text = request.data.get('requirement_text')
        system_description = request.data.get('system_description')
        implementation_details = request.data.get('implementation_details', {})

        if not all([control_id, requirement_text, system_description]):
            return Response({
                'success': False,
                'error': 'control_id, requirement_text, and system_description are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_author_service()
            narrative = service.draft_ssp_narrative(
                control_id=control_id,
                requirement_text=requirement_text,
                system_description=system_description,
                implementation_details=implementation_details,
            )

            return Response({
                'success': True,
                'data': {
                    'control_id': control_id,
                    'narrative': narrative,
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIAuthorImproveTextView(APIView):
    """Improve existing compliance text using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Improve text",
        description="Uses AI to improve existing compliance documentation text.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'text': {'type': 'string'},
                    'document_type': {'type': 'string'},
                    'improvement_focus': {'type': 'array', 'items': {'type': 'string'}},
                },
                'required': ['text', 'document_type'],
            }
        },
        responses={200: dict},
        tags=['AI Author'],
    )
    def post(self, request):
        """Improve existing text."""
        from ..services.ai_author import get_ai_author_service

        text = request.data.get('text')
        document_type = request.data.get('document_type')
        improvement_focus = request.data.get('improvement_focus')

        if not text or not document_type:
            return Response({
                'success': False,
                'error': 'text and document_type are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_author_service()
            improved = service.improve_existing_text(
                text=text,
                document_type=document_type,
                improvement_focus=improvement_focus,
            )

            return Response({
                'success': True,
                'data': {
                    'original': text,
                    'improved': improved,
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# AI Extractor Views
# =============================================================================

class AIExtractorUploadView(APIView):
    """Extract controls and requirements from uploaded documents."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Extract from document",
        description="Extracts controls, requirements, and policies from an uploaded document.",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'file': {'type': 'string', 'format': 'binary'},
                    'extraction_types': {'type': 'string'},
                    'target_framework': {'type': 'string'},
                },
                'required': ['file'],
            }
        },
        responses={200: dict},
        tags=['AI Extractor'],
    )
    def post(self, request):
        """Extract content from document."""
        from ..services.ai_extractor import get_ai_extractor_service, ExtractionType

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({
                'success': False,
                'error': 'No file uploaded',
            }, status=status.HTTP_400_BAD_REQUEST)

        extraction_types_str = request.data.get('extraction_types', 'controls')
        target_framework = request.data.get('target_framework')

        # Parse extraction types
        extraction_types = []
        for t in extraction_types_str.split(','):
            t = t.strip().lower()
            if t in ExtractionType._value2member_map_:
                extraction_types.append(ExtractionType(t))

        if not extraction_types:
            extraction_types = [ExtractionType.CONTROLS]

        try:
            content = uploaded_file.read()
            service = get_ai_extractor_service()

            result = service.extract_from_document(
                content=content,
                filename=uploaded_file.name,
                extraction_types=extraction_types,
                target_framework=target_framework,
            )

            return Response({
                'success': True,
                'data': result.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIExtractorTextView(APIView):
    """Extract controls from plain text."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Extract from text",
        description="Extracts controls from plain text content.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'text': {'type': 'string'},
                    'target_framework': {'type': 'string'},
                },
                'required': ['text'],
            }
        },
        responses={200: dict},
        tags=['AI Extractor'],
    )
    def post(self, request):
        """Extract controls from text."""
        from ..services.ai_extractor import get_ai_extractor_service

        text = request.data.get('text')
        target_framework = request.data.get('target_framework')

        if not text:
            return Response({
                'success': False,
                'error': 'text is required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_extractor_service()
            controls = service.extract_controls_from_text(
                text=text,
                target_framework=target_framework,
            )

            return Response({
                'success': True,
                'data': {
                    'controls': [c.to_dict() for c in controls],
                    'count': len(controls),
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIExtractorMapControlsView(APIView):
    """Map control descriptions to framework controls."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Map to framework",
        description="Maps control descriptions to framework control IDs.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'control_descriptions': {'type': 'array', 'items': {'type': 'string'}},
                    'target_framework': {'type': 'string'},
                },
                'required': ['control_descriptions', 'target_framework'],
            }
        },
        responses={200: dict},
        tags=['AI Extractor'],
    )
    def post(self, request):
        """Map controls to framework."""
        from ..services.ai_extractor import get_ai_extractor_service

        control_descriptions = request.data.get('control_descriptions', [])
        target_framework = request.data.get('target_framework')

        if not control_descriptions or not target_framework:
            return Response({
                'success': False,
                'error': 'control_descriptions and target_framework are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_extractor_service()
            mappings = service.map_to_framework(
                control_descriptions=control_descriptions,
                target_framework=target_framework,
            )

            return Response({
                'success': True,
                'data': {
                    'mappings': mappings,
                    'count': len(mappings),
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIExtractorCoverageAnalysisView(APIView):
    """Analyze policy coverage against a framework."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Analyze policy coverage",
        description="Analyzes policy document coverage against a compliance framework.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'policy_text': {'type': 'string'},
                    'framework': {'type': 'string'},
                },
                'required': ['policy_text', 'framework'],
            }
        },
        responses={200: dict},
        tags=['AI Extractor'],
    )
    def post(self, request):
        """Analyze policy coverage."""
        from ..services.ai_extractor import get_ai_extractor_service

        policy_text = request.data.get('policy_text')
        framework = request.data.get('framework')

        if not policy_text or not framework:
            return Response({
                'success': False,
                'error': 'policy_text and framework are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_extractor_service()
            analysis = service.analyze_policy_coverage(
                policy_text=policy_text,
                framework=framework,
            )

            return Response({
                'success': True,
                'data': analysis,
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# AI Auditor Views
# =============================================================================

class AIAuditorEvaluateControlView(APIView):
    """Evaluate control effectiveness using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Evaluate control effectiveness",
        description="Uses AI to evaluate the effectiveness of a control implementation.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'control_id': {'type': 'string'},
                    'control_description': {'type': 'string'},
                    'requirement_text': {'type': 'string'},
                    'implementation_statement': {'type': 'string'},
                    'evidence_summary': {'type': 'string'},
                    'context': {'type': 'object'},
                },
                'required': ['control_id', 'control_description', 'requirement_text'],
            }
        },
        responses={200: dict},
        tags=['AI Auditor'],
    )
    def post(self, request):
        """Evaluate control effectiveness."""
        from ..services.ai_auditor import get_ai_auditor_service

        control_id = request.data.get('control_id')
        control_description = request.data.get('control_description')
        requirement_text = request.data.get('requirement_text')
        implementation_statement = request.data.get('implementation_statement')
        evidence_summary = request.data.get('evidence_summary')
        context = request.data.get('context', {})

        if not all([control_id, control_description, requirement_text]):
            return Response({
                'success': False,
                'error': 'control_id, control_description, and requirement_text are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_auditor_service()
            evaluation = service.evaluate_control_effectiveness(
                control_id=control_id,
                control_description=control_description,
                requirement_text=requirement_text,
                implementation_statement=implementation_statement,
                evidence_summary=evidence_summary,
                context=context,
            )

            return Response({
                'success': True,
                'data': evaluation.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIAuditorGapAnalysisView(APIView):
    """Perform gap analysis using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Perform gap analysis",
        description="Uses AI to identify gaps between current state and compliance requirements.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'current_state': {'type': 'object'},
                    'target_framework': {'type': 'string'},
                    'control_requirements': {'type': 'array'},
                },
                'required': ['current_state', 'target_framework'],
            }
        },
        responses={200: dict},
        tags=['AI Auditor'],
    )
    def post(self, request):
        """Perform gap analysis."""
        from ..services.ai_auditor import get_ai_auditor_service

        current_state = request.data.get('current_state', {})
        target_framework = request.data.get('target_framework')
        control_requirements = request.data.get('control_requirements')

        if not current_state or not target_framework:
            return Response({
                'success': False,
                'error': 'current_state and target_framework are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_auditor_service()
            gaps = service.perform_gap_analysis(
                current_state=current_state,
                target_framework=target_framework,
                control_requirements=control_requirements,
            )

            return Response({
                'success': True,
                'data': {
                    'gaps': [g.to_dict() for g in gaps],
                    'count': len(gaps),
                    'summary': {
                        'critical': sum(1 for g in gaps if g.severity == 'critical'),
                        'high': sum(1 for g in gaps if g.severity == 'high'),
                        'medium': sum(1 for g in gaps if g.severity == 'medium'),
                        'low': sum(1 for g in gaps if g.severity == 'low'),
                    },
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIAuditorComplianceAssessmentView(APIView):
    """Assess compliance using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Assess compliance",
        description="Uses AI to assess overall compliance against a framework.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'framework': {'type': 'string'},
                    'controls_data': {'type': 'array'},
                },
                'required': ['framework', 'controls_data'],
            }
        },
        responses={200: dict},
        tags=['AI Auditor'],
    )
    def post(self, request):
        """Assess compliance."""
        from ..services.ai_auditor import get_ai_auditor_service

        framework = request.data.get('framework')
        controls_data = request.data.get('controls_data', [])

        if not framework or not controls_data:
            return Response({
                'success': False,
                'error': 'framework and controls_data are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_auditor_service()
            assessment = service.assess_compliance(
                framework=framework,
                controls_data=controls_data,
            )

            return Response({
                'success': True,
                'data': assessment.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIAuditorEvidenceReviewView(APIView):
    """Review evidence using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Review evidence",
        description="Uses AI to review evidence for a control.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'evidence_description': {'type': 'string'},
                    'evidence_type': {'type': 'string'},
                    'control_requirement': {'type': 'string'},
                    'evidence_date': {'type': 'string'},
                },
                'required': ['evidence_description', 'evidence_type', 'control_requirement'],
            }
        },
        responses={200: dict},
        tags=['AI Auditor'],
    )
    def post(self, request):
        """Review evidence."""
        from ..services.ai_auditor import get_ai_auditor_service

        evidence_description = request.data.get('evidence_description')
        evidence_type = request.data.get('evidence_type')
        control_requirement = request.data.get('control_requirement')
        evidence_date = request.data.get('evidence_date')

        if not all([evidence_description, evidence_type, control_requirement]):
            return Response({
                'success': False,
                'error': 'evidence_description, evidence_type, and control_requirement are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_auditor_service()
            review = service.review_evidence(
                evidence_description=evidence_description,
                evidence_type=evidence_type,
                control_requirement=control_requirement,
                evidence_date=evidence_date,
            )

            return Response({
                'success': True,
                'data': review.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# AI Explainer Views
# =============================================================================

class AIExplainerControlView(APIView):
    """Explain a control for a specific audience."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Explain control",
        description="Uses AI to explain a control for a specific audience.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'control_id': {'type': 'string'},
                    'control_name': {'type': 'string'},
                    'control_description': {'type': 'string'},
                    'audience': {'type': 'string'},
                    'context': {'type': 'object'},
                },
                'required': ['control_id', 'control_name', 'control_description'],
            }
        },
        responses={200: dict},
        tags=['AI Explainer'],
    )
    def post(self, request):
        """Explain a control."""
        from ..services.ai_explainer import get_ai_explainer_service

        control_id = request.data.get('control_id')
        control_name = request.data.get('control_name')
        control_description = request.data.get('control_description')
        audience = request.data.get('audience', 'executive')
        context = request.data.get('context', {})

        if not all([control_id, control_name, control_description]):
            return Response({
                'success': False,
                'error': 'control_id, control_name, and control_description are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_explainer_service()
            explanation = service.explain_control(
                control_id=control_id,
                control_name=control_name,
                control_description=control_description,
                audience=audience,
                context=context,
            )

            return Response({
                'success': True,
                'data': explanation.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIExplainerRiskView(APIView):
    """Explain a risk for a specific audience."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Explain risk",
        description="Uses AI to explain a risk for a specific audience.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'risk_id': {'type': 'string'},
                    'risk_title': {'type': 'string'},
                    'risk_description': {'type': 'string'},
                    'risk_score': {'type': 'number'},
                    'audience': {'type': 'string'},
                    'context': {'type': 'object'},
                },
                'required': ['risk_id', 'risk_title', 'risk_description'],
            }
        },
        responses={200: dict},
        tags=['AI Explainer'],
    )
    def post(self, request):
        """Explain a risk."""
        from ..services.ai_explainer import get_ai_explainer_service

        risk_id = request.data.get('risk_id')
        risk_title = request.data.get('risk_title')
        risk_description = request.data.get('risk_description')
        risk_score = request.data.get('risk_score')
        audience = request.data.get('audience', 'executive')
        context = request.data.get('context', {})

        if not all([risk_id, risk_title, risk_description]):
            return Response({
                'success': False,
                'error': 'risk_id, risk_title, and risk_description are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_explainer_service()
            explanation = service.explain_risk(
                risk_id=risk_id,
                risk_title=risk_title,
                risk_description=risk_description,
                risk_score=risk_score,
                audience=audience,
                context=context,
            )

            return Response({
                'success': True,
                'data': explanation.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIExplainerConceptView(APIView):
    """Explain a security concept for a specific audience."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Explain concept",
        description="Uses AI to explain a security or compliance concept.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'concept': {'type': 'string'},
                    'audience': {'type': 'string'},
                    'format': {'type': 'string'},
                    'context': {'type': 'object'},
                },
                'required': ['concept'],
            }
        },
        responses={200: dict},
        tags=['AI Explainer'],
    )
    def post(self, request):
        """Explain a concept."""
        from ..services.ai_explainer import get_ai_explainer_service

        concept = request.data.get('concept')
        audience = request.data.get('audience', 'end_user')
        format_type = request.data.get('format', 'detailed')
        context = request.data.get('context', {})

        if not concept:
            return Response({
                'success': False,
                'error': 'concept is required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_explainer_service()
            explanation = service.explain_concept(
                concept=concept,
                audience=audience,
                format=format_type,
                context=context,
            )

            return Response({
                'success': True,
                'data': explanation.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIExplainerExecutiveSummaryView(APIView):
    """Generate an executive summary using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Generate executive summary",
        description="Uses AI to generate an executive summary from data.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'data': {'type': 'object'},
                    'summary_type': {'type': 'string'},
                },
                'required': ['data', 'summary_type'],
            }
        },
        responses={200: dict},
        tags=['AI Explainer'],
    )
    def post(self, request):
        """Generate executive summary."""
        from ..services.ai_explainer import get_ai_explainer_service

        data = request.data.get('data', {})
        summary_type = request.data.get('summary_type')

        if not data or not summary_type:
            return Response({
                'success': False,
                'error': 'data and summary_type are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_explainer_service()
            summary = service.generate_executive_summary(
                data=data,
                summary_type=summary_type,
            )

            return Response({
                'success': True,
                'data': {
                    'summary': summary,
                    'summary_type': summary_type,
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIExplainerTranslateView(APIView):
    """Translate technical content to business language."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Translate to business language",
        description="Uses AI to translate technical content to business-friendly language.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'technical_content': {'type': 'string'},
                    'content_type': {'type': 'string'},
                },
                'required': ['technical_content'],
            }
        },
        responses={200: dict},
        tags=['AI Explainer'],
    )
    def post(self, request):
        """Translate technical to business."""
        from ..services.ai_explainer import get_ai_explainer_service

        technical_content = request.data.get('technical_content')
        content_type = request.data.get('content_type', 'finding')

        if not technical_content:
            return Response({
                'success': False,
                'error': 'technical_content is required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_explainer_service()
            translated = service.translate_technical_to_business(
                technical_content=technical_content,
                content_type=content_type,
            )

            return Response({
                'success': True,
                'data': {
                    'original': technical_content,
                    'translated': translated,
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# AI Vendor Scoring Views
# =============================================================================

class AIVendorScoringView(APIView):
    """Score vendor assessment using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Score vendor assessment",
        description="Uses AI to score a vendor entity assessment based on questionnaire responses.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'questionnaire_responses': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'question': {'type': 'string'},
                                'answer': {'type': 'string'},
                                'category': {'type': 'string'},
                                'weight': {'type': 'number'},
                            },
                            'required': ['question', 'answer'],
                        },
                    },
                },
            }
        },
        responses={200: dict},
        tags=['AI Vendor Scoring'],
    )
    def post(self, request, pk=None):
        """Score a vendor entity assessment."""
        from ..services.ai_vendor_scorer import get_ai_vendor_scorer_service

        assessment_id = str(pk) if pk else request.data.get('assessment_id')
        questionnaire_responses = request.data.get('questionnaire_responses')

        if not assessment_id:
            return Response({
                'success': False,
                'error': 'assessment_id is required (via URL or request body)',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            service = get_ai_vendor_scorer_service()
            result = service.score_vendor_assessment(
                entity_assessment_id=assessment_id,
                questionnaire_responses=questionnaire_responses,
            )

            return Response({
                'success': True,
                'data': result.to_dict(),
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIVendorRiskSummaryView(APIView):
    """Generate executive risk summary for a vendor."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Generate vendor risk summary",
        description="Uses AI to generate an executive risk summary for a scored vendor.",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'vendor_name': {'type': 'string'},
                    'score_data': {'type': 'object'},
                },
                'required': ['vendor_name', 'score_data'],
            }
        },
        responses={200: dict},
        tags=['AI Vendor Scoring'],
    )
    def post(self, request):
        """Generate vendor risk summary."""
        from ..services.ai_vendor_scorer import (
            VendorScoreResult,
            get_ai_vendor_scorer_service,
        )

        vendor_name = request.data.get('vendor_name')
        score_data = request.data.get('score_data', {})

        if not vendor_name or not score_data:
            return Response({
                'success': False,
                'error': 'vendor_name and score_data are required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            score_result = VendorScoreResult(
                overall_score=score_data.get('overall_score', 0),
                risk_rating=score_data.get('risk_rating', 'medium'),
                category_scores=score_data.get('category_scores', {}),
                strengths=score_data.get('strengths', []),
                weaknesses=score_data.get('weaknesses', []),
                recommendations=score_data.get('recommendations', []),
                answer_evaluations=score_data.get('answer_evaluations', []),
            )

            service = get_ai_vendor_scorer_service()
            summary = service.generate_vendor_risk_summary(
                score_result=score_result,
                vendor_name=vendor_name,
            )

            return Response({
                'success': True,
                'data': {
                    'vendor_name': vendor_name,
                    'summary': summary,
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# AI POA&M Generation Views
# =============================================================================

class AIPOAMGenerateView(APIView):
    """Generate POA&M items from findings using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Generate POA&M items from findings",
        description=(
            "Uses AI to generate Plan of Action and Milestones items from "
            "selected vulnerability or compliance findings."
        ),
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'finding_ids': {
                        'type': 'array',
                        'items': {'type': 'string'},
                    },
                    'auto_create': {'type': 'boolean'},
                    'system_group_id': {'type': 'string'},
                },
                'required': ['finding_ids'],
            }
        },
        responses={200: dict},
        tags=['AI POA&M'],
    )
    def post(self, request):
        """Generate POA&M items from selected findings."""
        from poam.services.ai_poam_generator import get_ai_poam_generator

        finding_ids = request.data.get('finding_ids', [])
        auto_create = request.data.get('auto_create', False)
        system_group_id = request.data.get('system_group_id')

        if not finding_ids:
            return Response({
                'success': False,
                'error': 'finding_ids is required and must not be empty',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            generator = get_ai_poam_generator()
            generated_items = generator.generate_from_findings(finding_ids)

            result = {
                'generated_items': [item.to_dict() for item in generated_items],
                'count': len(generated_items),
            }

            if auto_create and generated_items:
                created_ids = generator.bulk_create_poam_items(
                    generated_items,
                    system_group_id=system_group_id,
                )
                result['created_ids'] = created_ids
                result['created_count'] = len(created_ids)

            return Response({
                'success': True,
                'data': result,
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIPOAMGenerateFromScanView(APIView):
    """Generate POA&M items from scan results using AI."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Generate POA&M items from scan results",
        description=(
            "Uses AI to generate POA&M items from the latest scan results "
            "of a specified connector."
        ),
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'connector_id': {'type': 'string'},
                    'auto_create': {'type': 'boolean'},
                    'system_group_id': {'type': 'string'},
                },
                'required': ['connector_id'],
            }
        },
        responses={200: dict},
        tags=['AI POA&M'],
    )
    def post(self, request):
        """Generate POA&M items from scan results."""
        from poam.services.ai_poam_generator import get_ai_poam_generator

        connector_id = request.data.get('connector_id')
        auto_create = request.data.get('auto_create', False)
        system_group_id = request.data.get('system_group_id')

        if not connector_id:
            return Response({
                'success': False,
                'error': 'connector_id is required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            generator = get_ai_poam_generator()
            generated_items = generator.generate_from_scan_results(connector_id)

            result = {
                'generated_items': [item.to_dict() for item in generated_items],
                'count': len(generated_items),
            }

            if auto_create and generated_items:
                created_ids = generator.bulk_create_poam_items(
                    generated_items,
                    system_group_id=system_group_id,
                )
                result['created_ids'] = created_ids
                result['created_count'] = len(created_ids)

            return Response({
                'success': True,
                'data': result,
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# AI Batch Control Drafting Views
# =============================================================================

class AIBatchControlDraftView(APIView):
    """Batch draft control implementations for an assessment."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Batch draft control implementations",
        description=(
            "Uses AI to draft implementation statements for all controls "
            "in a compliance assessment. Processes each requirement and "
            "returns drafts for review."
        ),
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'assessment_id': {'type': 'string'},
                    'framework': {'type': 'string'},
                    'context': {'type': 'object'},
                    'control_ids': {
                        'type': 'array',
                        'items': {'type': 'string'},
                        'description': 'Optional subset of control IDs to draft. If empty, drafts all.',
                    },
                },
                'required': ['assessment_id'],
            }
        },
        responses={200: dict},
        tags=['AI Author'],
    )
    def post(self, request):
        """Draft all (or selected) control implementations for an assessment."""
        from ..services.ai_author import get_ai_author_service

        assessment_id = request.data.get('assessment_id')
        framework = request.data.get('framework', 'nist_800_53')
        context = request.data.get('context', {})
        control_ids_filter = request.data.get('control_ids', [])

        if not assessment_id:
            return Response({
                'success': False,
                'error': 'assessment_id is required',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Load requirements for this assessment
            requirements = self._load_requirements(
                assessment_id, control_ids_filter
            )

            if not requirements:
                return Response({
                    'success': False,
                    'error': 'No requirements found for the given assessment',
                }, status=status.HTTP_404_NOT_FOUND)

            service = get_ai_author_service()
            drafts = []
            errors = []

            for req in requirements:
                try:
                    draft = service.draft_control_implementation(
                        control_id=req['control_id'],
                        requirement_text=req['requirement_text'],
                        framework=framework,
                        context=context,
                        existing_implementation=req.get(
                            'existing_implementation'
                        ),
                    )
                    drafts.append(draft.to_dict())
                except Exception as e:
                    errors.append({
                        'control_id': req['control_id'],
                        'error': str(e),
                    })

            return Response({
                'success': True,
                'data': {
                    'drafts': drafts,
                    'count': len(drafts),
                    'errors': errors,
                    'error_count': len(errors),
                    'assessment_id': assessment_id,
                    'framework': framework,
                },
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @staticmethod
    def _load_requirements(
        assessment_id: str, control_ids_filter: list = None
    ) -> list:
        """
        Load requirement assessments from the database.

        Tries the bounded-context compliance models first, then falls back
        to the core models.
        """
        import logging as _logging
        _logger = _logging.getLogger(__name__)
        requirements = []

        try:
            from compliance.models.requirement_assessment import (
                RequirementAssessment,
            )

            qs = RequirementAssessment.objects.filter(
                compliance_assessment_id=assessment_id
            )
            if control_ids_filter:
                qs = qs.filter(requirement_id__in=control_ids_filter)

            for ra in qs:
                requirements.append({
                    'control_id': ra.requirement_id,
                    'requirement_text': (
                        f"{ra.requirement_title}\n\n{ra.requirement_description}"
                    ),
                    'existing_implementation': getattr(
                        ra, 'observation', None
                    ),
                })
            return requirements

        except ImportError:
            pass

        # Fallback to core models
        try:
            from core.models import RequirementAssessment as CoreRA

            qs = CoreRA.objects.filter(
                compliance_assessment_id=assessment_id
            )
            if control_ids_filter:
                qs = qs.filter(requirement__ref_id__in=control_ids_filter)

            for ra in qs:
                req = ra.requirement if hasattr(ra, 'requirement') else None
                requirements.append({
                    'control_id': (
                        req.ref_id if req and hasattr(req, 'ref_id') else str(ra.id)
                    ),
                    'requirement_text': (
                        str(req) if req else 'No requirement text available'
                    ),
                    'existing_implementation': getattr(
                        ra, 'observation', None
                    ),
                })
            return requirements

        except Exception as e:
            _logger.error(f"Error loading requirements: {e}")
            return []
