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
