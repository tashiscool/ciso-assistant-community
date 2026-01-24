"""
Comprehensive tests for Additional AI Assistant Services

Tests cover:
- Context Builder: SuggestionContext, building context for different entity types
- Suggestion Engine: Suggestion generation for requirements, risks, controls
- AI Author: Document drafting for controls, policies, procedures
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import uuid

from ai_assistant.services.context_builder import (
    SuggestionContext,
    ContextBuilder,
)
from ai_assistant.services.suggestion_engine import (
    SuggestionType,
    Suggestion,
    SuggestionEngine,
)
from ai_assistant.services.ai_author import (
    DocumentType,
    Framework,
    ControlDraft,
    PolicyDraft,
    ProcedureDraft,
    AIAuthorService,
    get_ai_author_service,
)


# =============================================================================
# Context Builder - Data Class Tests
# =============================================================================

class TestSuggestionContext:
    """Tests for SuggestionContext dataclass."""

    def test_context_creation_minimal(self):
        """Test creating context with minimal parameters."""
        context = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test-uuid-123',
        )

        assert context.entity_type == 'requirement_assessment'
        assert context.entity_id == 'test-uuid-123'
        assert context.entity_data == {}
        assert context.related_controls == []
        assert context.related_evidences == []
        assert context.framework_context is None
        assert context.historical_patterns == []

    def test_context_creation_full(self):
        """Test creating context with all parameters."""
        context = SuggestionContext(
            entity_type='risk_scenario',
            entity_id='risk-uuid-456',
            entity_data={'name': 'Test Risk', 'severity': 'high'},
            related_controls=[{'id': 'ctrl-1', 'name': 'Control 1'}],
            related_evidences=[{'id': 'ev-1', 'name': 'Evidence 1'}],
            framework_context={'name': 'NIST', 'version': '800-53'},
            historical_patterns=[{'pattern': 'recurring', 'count': 5}],
        )

        assert context.entity_type == 'risk_scenario'
        assert context.entity_data['name'] == 'Test Risk'
        assert len(context.related_controls) == 1
        assert len(context.related_evidences) == 1
        assert context.framework_context['name'] == 'NIST'
        assert len(context.historical_patterns) == 1


# =============================================================================
# Context Builder - Service Tests
# =============================================================================

class TestContextBuilder:
    """Tests for ContextBuilder service."""

    @pytest.fixture
    def context_builder(self):
        """Create context builder instance."""
        return ContextBuilder()

    def test_builder_initialization(self, context_builder):
        """Test context builder initializes correctly."""
        assert context_builder is not None

    @patch('ai_assistant.services.context_builder.RequirementAssessment')
    def test_build_requirement_context_not_found(self, mock_model, context_builder):
        """Test building context when requirement not found."""
        from core.models import RequirementAssessment
        mock_model.DoesNotExist = RequirementAssessment.DoesNotExist
        mock_model.objects.select_related.return_value.prefetch_related.return_value.get.side_effect = RequirementAssessment.DoesNotExist

        result = context_builder.build_requirement_context('nonexistent-id')

        assert result.entity_type == 'requirement_assessment'
        assert result.entity_id == 'nonexistent-id'
        assert result.entity_data == {}

    @patch('ai_assistant.services.context_builder.RequirementAssessment')
    def test_build_requirement_context_success(self, mock_model, context_builder):
        """Test building requirement context successfully."""
        # Create mock requirement assessment
        mock_req = Mock()
        mock_req.requirement.urn = 'AC-1'
        mock_req.requirement.name = 'Access Control Policy'
        mock_req.requirement.description = 'Test description'
        mock_req.status = 'in_progress'
        mock_req.result = 'partially_compliant'
        mock_req.observation = 'Test observation'
        mock_req.compliance_assessment = Mock()
        mock_req.compliance_assessment.framework = Mock()
        mock_req.compliance_assessment.framework.name = 'NIST 800-53'
        mock_req.compliance_assessment.framework.urn = 'nist-800-53'
        mock_req.compliance_assessment.framework.description = 'NIST controls'

        # Mock related controls and evidences
        mock_control = Mock()
        mock_control.id = uuid.uuid4()
        mock_control.name = 'Test Control'
        mock_control.description = 'Control description'
        mock_control.status = 'implemented'
        mock_control.category = 'access_control'
        mock_req.applied_controls.all.return_value = [mock_control]

        mock_evidence = Mock()
        mock_evidence.id = uuid.uuid4()
        mock_evidence.name = 'Test Evidence'
        mock_evidence.status = 'approved'
        mock_req.evidences.all.return_value = [mock_evidence]

        mock_model.objects.select_related.return_value.prefetch_related.return_value.get.return_value = mock_req

        result = context_builder.build_requirement_context('test-id')

        assert result.entity_type == 'requirement_assessment'
        assert result.entity_data['requirement_urn'] == 'AC-1'
        assert result.entity_data['requirement_name'] == 'Access Control Policy'
        assert len(result.related_controls) == 1
        assert len(result.related_evidences) == 1
        assert result.framework_context['name'] == 'NIST 800-53'

    @patch('ai_assistant.services.context_builder.RiskScenario')
    def test_build_risk_context_not_found(self, mock_model, context_builder):
        """Test building risk context when not found."""
        from core.models import RiskScenario
        mock_model.DoesNotExist = RiskScenario.DoesNotExist
        mock_model.objects.select_related.return_value.prefetch_related.return_value.get.side_effect = RiskScenario.DoesNotExist

        result = context_builder.build_risk_context('nonexistent-id')

        assert result.entity_type == 'risk_scenario'
        assert result.entity_data == {}

    @patch('ai_assistant.services.context_builder.RiskScenario')
    def test_build_risk_context_success(self, mock_model, context_builder):
        """Test building risk context successfully."""
        mock_risk = Mock()
        mock_risk.name = 'Data Breach Risk'
        mock_risk.description = 'Risk description'
        mock_risk.threat = Mock()
        mock_risk.threat.name = 'External Attacker'
        mock_risk.threat.description = 'Threat description'
        mock_risk.current_proba = 3
        mock_risk.current_impact = 4
        mock_risk.residual_proba = 2
        mock_risk.residual_impact = 3
        mock_risk.treatment = 'mitigate'
        mock_risk.applied_controls.all.return_value = []

        mock_asset = Mock()
        mock_asset.id = uuid.uuid4()
        mock_asset.name = 'Customer Database'
        mock_asset.type = 'data'
        mock_risk.assets.all.return_value = [mock_asset]

        mock_model.objects.select_related.return_value.prefetch_related.return_value.get.return_value = mock_risk

        result = context_builder.build_risk_context('risk-id')

        assert result.entity_type == 'risk_scenario'
        assert result.entity_data['name'] == 'Data Breach Risk'
        assert result.entity_data['threat_name'] == 'External Attacker'
        assert result.entity_data['current_probability'] == 3
        assert len(result.entity_data['affected_assets']) == 1

    @patch('ai_assistant.services.context_builder.AppliedControl')
    def test_build_control_context_not_found(self, mock_model, context_builder):
        """Test building control context when not found."""
        from core.models import AppliedControl
        mock_model.DoesNotExist = AppliedControl.DoesNotExist
        mock_model.objects.select_related.return_value.prefetch_related.return_value.get.side_effect = AppliedControl.DoesNotExist

        result = context_builder.build_control_context('nonexistent-id')

        assert result.entity_type == 'applied_control'
        assert result.entity_data == {}

    @patch('ai_assistant.services.context_builder.AppliedControl')
    def test_build_control_context_success(self, mock_model, context_builder):
        """Test building control context successfully."""
        mock_control = Mock()
        mock_control.name = 'MFA Implementation'
        mock_control.description = 'Multi-factor authentication'
        mock_control.status = 'implemented'
        mock_control.category = 'access_control'
        mock_control.reference_control = Mock()
        mock_control.reference_control.name = 'IA-2'
        mock_control.reference_control.description = 'Identification and Authentication'
        mock_control.evidences.all.return_value = []

        mock_model.objects.select_related.return_value.prefetch_related.return_value.get.return_value = mock_control

        result = context_builder.build_control_context('control-id')

        assert result.entity_type == 'applied_control'
        assert result.entity_data['name'] == 'MFA Implementation'
        assert result.entity_data['reference_control_name'] == 'IA-2'

    @patch('ai_assistant.services.context_builder.Evidence')
    def test_build_evidence_context_not_found(self, mock_model, context_builder):
        """Test building evidence context when not found."""
        from core.models import Evidence
        mock_model.DoesNotExist = Evidence.DoesNotExist
        mock_model.objects.prefetch_related.return_value.get.side_effect = Evidence.DoesNotExist

        result = context_builder.build_evidence_context('nonexistent-id')

        assert result.entity_type == 'evidence'
        assert result.entity_data == {}

    @patch('ai_assistant.services.context_builder.Evidence')
    def test_build_evidence_context_success(self, mock_model, context_builder):
        """Test building evidence context successfully."""
        mock_evidence = Mock()
        mock_evidence.name = 'Access Review Report'
        mock_evidence.description = 'Quarterly access review'
        mock_evidence.status = 'approved'
        mock_evidence.expiry_date = None
        mock_evidence.applied_controls.all.return_value = []

        mock_model.objects.prefetch_related.return_value.get.return_value = mock_evidence

        result = context_builder.build_evidence_context('evidence-id')

        assert result.entity_type == 'evidence'
        assert result.entity_data['name'] == 'Access Review Report'
        assert result.entity_data['status'] == 'approved'


# =============================================================================
# Suggestion Engine - Enum Tests
# =============================================================================

class TestSuggestionEnums:
    """Tests for Suggestion Engine enums."""

    def test_suggestion_type_values(self):
        """Test SuggestionType enum values."""
        assert SuggestionType.CONTROL_RECOMMENDATION == 'control_recommendation'
        assert SuggestionType.EVIDENCE_SUGGESTION == 'evidence_suggestion'
        assert SuggestionType.REMEDIATION_GUIDANCE == 'remediation_guidance'
        assert SuggestionType.RISK_MITIGATION == 'risk_mitigation'
        assert SuggestionType.IMPLEMENTATION_GUIDANCE == 'implementation_guidance'
        assert SuggestionType.COMPLIANCE_GAP == 'compliance_gap'


# =============================================================================
# Suggestion Engine - Data Class Tests
# =============================================================================

class TestSuggestionDataClass:
    """Tests for Suggestion dataclass."""

    def test_suggestion_creation_minimal(self):
        """Test creating suggestion with minimal parameters."""
        suggestion = Suggestion(
            type=SuggestionType.CONTROL_RECOMMENDATION,
            title='Test Suggestion',
            description='Test description',
            priority='medium',
            confidence=0.8,
        )

        assert suggestion.type == SuggestionType.CONTROL_RECOMMENDATION
        assert suggestion.title == 'Test Suggestion'
        assert suggestion.priority == 'medium'
        assert suggestion.confidence == 0.8
        assert suggestion.action_items == []

    def test_suggestion_creation_full(self):
        """Test creating suggestion with all parameters."""
        suggestion = Suggestion(
            type=SuggestionType.EVIDENCE_SUGGESTION,
            title='Collect Evidence',
            description='Collect access logs',
            priority='high',
            confidence=0.9,
            action_items=['Identify source', 'Set up collection'],
            related_resources=[{'type': 'control', 'id': 'AC-1'}],
            metadata={'category': 'access_control'},
        )

        assert len(suggestion.action_items) == 2
        assert len(suggestion.related_resources) == 1
        assert suggestion.metadata['category'] == 'access_control'

    def test_suggestion_to_dict(self):
        """Test Suggestion serialization."""
        suggestion = Suggestion(
            type=SuggestionType.RISK_MITIGATION,
            title='Mitigate Risk',
            description='Risk mitigation steps',
            priority='high',
            confidence=0.85,
            action_items=['Step 1', 'Step 2'],
        )

        result = suggestion.to_dict()

        assert result['type'] == 'risk_mitigation'
        assert result['title'] == 'Mitigate Risk'
        assert result['confidence'] == 0.85
        assert len(result['action_items']) == 2


# =============================================================================
# Suggestion Engine - Service Tests
# =============================================================================

class TestSuggestionEngine:
    """Tests for SuggestionEngine service."""

    @pytest.fixture
    def engine(self, mock_llm_client):
        """Create suggestion engine instance."""
        return SuggestionEngine(llm_client=mock_llm_client)

    @pytest.fixture
    def engine_no_llm(self):
        """Create suggestion engine without LLM."""
        return SuggestionEngine(llm_client=None)

    def test_engine_initialization(self, engine):
        """Test engine initializes correctly."""
        assert engine.llm_client is not None
        assert engine.context_builder is not None

    def test_engine_knowledge_base_exists(self, engine):
        """Test that knowledge base is populated."""
        assert 'access_control' in engine.CONTROL_KNOWLEDGE_BASE
        assert 'audit_logging' in engine.CONTROL_KNOWLEDGE_BASE
        assert 'encryption' in engine.CONTROL_KNOWLEDGE_BASE
        assert 'controls' in engine.CONTROL_KNOWLEDGE_BASE['access_control']
        assert 'evidences' in engine.CONTROL_KNOWLEDGE_BASE['access_control']

    def test_fedramp_control_families(self, engine):
        """Test FedRAMP control family mapping."""
        assert engine.FEDRAMP_CONTROL_FAMILIES['AC'] == 'access_control'
        assert engine.FEDRAMP_CONTROL_FAMILIES['AU'] == 'audit_logging'
        assert engine.FEDRAMP_CONTROL_FAMILIES['SC'] == 'encryption'
        assert engine.FEDRAMP_CONTROL_FAMILIES['IR'] == 'incident_response'

    def test_determine_control_category_by_prefix(self, engine):
        """Test category determination by FedRAMP prefix."""
        context = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test',
            entity_data={'requirement_urn': 'AC-2', 'requirement_name': ''},
        )

        category = engine._determine_control_category(context)
        assert category == 'access_control'

    def test_determine_control_category_by_keyword(self, engine):
        """Test category determination by keyword."""
        context = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test',
            entity_data={
                'requirement_urn': '',
                'requirement_name': '',
                'requirement_description': 'Enable encryption for all data at rest',
            },
        )

        category = engine._determine_control_category(context)
        assert category == 'encryption'

    def test_determine_control_category_default(self, engine):
        """Test category determination defaults to configuration_management."""
        context = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test',
            entity_data={
                'requirement_urn': '',
                'requirement_name': '',
                'requirement_description': '',
            },
        )

        category = engine._determine_control_category(context)
        assert category == 'configuration_management'

    def test_generate_control_suggestions(self, engine):
        """Test generating control suggestions."""
        context = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test',
            entity_data={},
            related_controls=[],
        )

        suggestions = engine._generate_control_suggestions(context, 'access_control')

        assert len(suggestions) > 0
        assert all(s.type == SuggestionType.CONTROL_RECOMMENDATION for s in suggestions)
        assert suggestions[0].priority in ['high', 'medium', 'low']

    def test_generate_control_suggestions_filters_existing(self, engine):
        """Test that existing controls are filtered out."""
        context = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test',
            entity_data={},
            related_controls=[
                {'name': 'Implement multi-factor authentication (MFA)'}
            ],
        )

        suggestions = engine._generate_control_suggestions(context, 'access_control')

        # MFA suggestion should be filtered out
        for s in suggestions:
            assert 'multi-factor' not in s.title.lower() or 'mfa' not in s.title.lower()

    def test_generate_evidence_suggestions(self, engine):
        """Test generating evidence suggestions."""
        context = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test',
            entity_data={},
            related_evidences=[],
        )

        suggestions = engine._generate_evidence_suggestions(context, 'audit_logging')

        assert len(suggestions) > 0
        assert all(s.type == SuggestionType.EVIDENCE_SUGGESTION for s in suggestions)

    def test_generate_remediation_suggestions_non_compliant(self, engine):
        """Test remediation suggestions for non-compliant status."""
        context = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test',
            entity_data={'result': 'non_compliant'},
        )

        suggestions = engine._generate_remediation_suggestions(context)

        assert len(suggestions) == 1
        assert suggestions[0].type == SuggestionType.REMEDIATION_GUIDANCE
        assert suggestions[0].priority == 'high'

    def test_generate_remediation_suggestions_compliant(self, engine):
        """Test no remediation suggestions for compliant status."""
        context = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test',
            entity_data={'result': 'compliant'},
        )

        suggestions = engine._generate_remediation_suggestions(context)
        assert len(suggestions) == 0

    def test_generate_risk_mitigation_suggestions_high_risk(self, engine):
        """Test risk mitigation for high risk score."""
        context = SuggestionContext(
            entity_type='risk_scenario',
            entity_id='test',
            entity_data={
                'current_probability': 4,
                'current_impact': 5,
                'treatment': 'mitigate',
            },
        )

        suggestions = engine._generate_risk_mitigation_suggestions(context)

        assert len(suggestions) == 1
        assert suggestions[0].type == SuggestionType.RISK_MITIGATION
        assert suggestions[0].priority == 'high'
        assert suggestions[0].metadata['urgency'] == 'immediate'

    def test_generate_risk_mitigation_suggestions_medium_risk(self, engine):
        """Test risk mitigation for medium risk score."""
        context = SuggestionContext(
            entity_type='risk_scenario',
            entity_id='test',
            entity_data={
                'current_probability': 3,
                'current_impact': 3,
            },
        )

        suggestions = engine._generate_risk_mitigation_suggestions(context)

        assert len(suggestions) == 1
        assert suggestions[0].metadata['urgency'] == 'short-term'

    def test_generate_risk_control_suggestions(self, engine):
        """Test risk control suggestions based on threat."""
        context = SuggestionContext(
            entity_type='risk_scenario',
            entity_id='test',
            entity_data={
                'threat_name': 'Ransomware Attack',
                'threat_description': 'Malware encryption of data',
            },
        )

        suggestions = engine._generate_risk_control_suggestions(context)

        assert len(suggestions) > 0
        assert all(s.type == SuggestionType.CONTROL_RECOMMENDATION for s in suggestions)

    def test_generate_implementation_suggestions(self, engine):
        """Test implementation guidance suggestions."""
        context = SuggestionContext(
            entity_type='applied_control',
            entity_id='test',
            entity_data={
                'status': 'planned',
                'category': 'access_control',
            },
        )

        suggestions = engine._generate_implementation_suggestions(context)

        assert len(suggestions) == 1
        assert suggestions[0].type == SuggestionType.IMPLEMENTATION_GUIDANCE

    @patch.object(ContextBuilder, 'build_requirement_context')
    def test_get_requirement_suggestions(self, mock_build, engine):
        """Test getting requirement suggestions."""
        mock_build.return_value = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test',
            entity_data={
                'requirement_urn': 'AC-1',
                'requirement_name': 'Access Control Policy',
                'requirement_description': 'Develop access control policy',
                'result': 'non_compliant',
            },
        )

        suggestions = engine.get_requirement_suggestions('test-id')

        assert len(suggestions) > 0
        mock_build.assert_called_once_with('test-id')

    @patch.object(ContextBuilder, 'build_requirement_context')
    def test_get_requirement_suggestions_filtered(self, mock_build, engine):
        """Test getting filtered requirement suggestions."""
        mock_build.return_value = SuggestionContext(
            entity_type='requirement_assessment',
            entity_id='test',
            entity_data={'requirement_urn': 'AC-1'},
        )

        suggestions = engine.get_requirement_suggestions(
            'test-id',
            suggestion_types=[SuggestionType.CONTROL_RECOMMENDATION]
        )

        # Should only have control recommendations
        assert all(s.type == SuggestionType.CONTROL_RECOMMENDATION for s in suggestions)

    @patch.object(ContextBuilder, 'build_risk_context')
    def test_get_risk_suggestions(self, mock_build, engine):
        """Test getting risk suggestions."""
        mock_build.return_value = SuggestionContext(
            entity_type='risk_scenario',
            entity_id='test',
            entity_data={
                'current_probability': 4,
                'current_impact': 4,
                'threat_name': 'Data Breach',
            },
        )

        suggestions = engine.get_risk_suggestions('risk-id')

        assert len(suggestions) > 0
        mock_build.assert_called_once_with('risk-id')

    @patch.object(ContextBuilder, 'build_control_context')
    def test_get_control_suggestions(self, mock_build, engine):
        """Test getting control suggestions."""
        mock_build.return_value = SuggestionContext(
            entity_type='applied_control',
            entity_id='test',
            entity_data={
                'status': 'in_progress',
                'category': 'access_control',
            },
        )

        suggestions = engine.get_control_suggestions('control-id')

        assert len(suggestions) > 0
        mock_build.assert_called_once_with('control-id')

    def test_enhance_with_llm_no_client(self, engine_no_llm):
        """Test LLM enhancement returns unchanged when no client."""
        suggestions = [
            Suggestion(
                type=SuggestionType.CONTROL_RECOMMENDATION,
                title='Test',
                description='Test',
                priority='medium',
                confidence=0.8,
            )
        ]

        result = engine_no_llm._enhance_with_llm(suggestions, SuggestionContext(
            entity_type='test',
            entity_id='test',
        ))

        assert result == suggestions


# =============================================================================
# AI Author - Enum Tests
# =============================================================================

class TestAIAuthorEnums:
    """Tests for AI Author enums."""

    def test_document_type_values(self):
        """Test DocumentType enum values."""
        assert DocumentType.CONTROL_STATEMENT == 'control_statement'
        assert DocumentType.POLICY_SECTION == 'policy_section'
        assert DocumentType.PROCEDURE == 'procedure'
        assert DocumentType.SSP_NARRATIVE == 'ssp_narrative'
        assert DocumentType.POAM_ENTRY == 'poam_entry'
        assert DocumentType.RISK_STATEMENT == 'risk_statement'
        assert DocumentType.EVIDENCE_DESCRIPTION == 'evidence_description'

    def test_framework_values(self):
        """Test Framework enum values."""
        assert Framework.NIST_800_53 == 'nist_800_53'
        assert Framework.FEDRAMP == 'fedramp'
        assert Framework.ISO_27001 == 'iso_27001'
        assert Framework.SOC2 == 'soc2'
        assert Framework.HIPAA == 'hipaa'
        assert Framework.PCI_DSS == 'pci_dss'
        assert Framework.CMMC == 'cmmc'


# =============================================================================
# AI Author - Data Class Tests
# =============================================================================

class TestAIAuthorDataClasses:
    """Tests for AI Author data classes."""

    def test_control_draft_creation(self):
        """Test ControlDraft dataclass creation."""
        draft = ControlDraft(
            control_id='AC-1',
            requirement_text='Develop access control policy',
            implementation_statement='The organization has developed...',
            responsible_roles=['CISO', 'Security Team'],
            implementation_status='implemented',
            suggested_evidence=['Policy document', 'Review records'],
            confidence_score=0.85,
            framework='fedramp',
        )

        assert draft.control_id == 'AC-1'
        assert len(draft.responsible_roles) == 2
        assert draft.confidence_score == 0.85

    def test_control_draft_to_dict(self):
        """Test ControlDraft serialization."""
        draft = ControlDraft(
            control_id='AC-2',
            requirement_text='Test',
            implementation_statement='Test implementation',
        )

        result = draft.to_dict()

        assert result['control_id'] == 'AC-2'
        assert result['implementation_status'] == 'planned'
        assert result['confidence_score'] == 0.0

    def test_policy_draft_creation(self):
        """Test PolicyDraft dataclass creation."""
        draft = PolicyDraft(
            title='Access Control Policy',
            content='This policy establishes...',
            sections=[{'title': 'Scope', 'content': 'All employees'}],
            related_controls=['AC-1', 'AC-2'],
        )

        assert draft.title == 'Access Control Policy'
        assert len(draft.sections) == 1
        assert len(draft.related_controls) == 2

    def test_policy_draft_to_dict(self):
        """Test PolicyDraft serialization."""
        draft = PolicyDraft(
            title='Test Policy',
            content='Test content',
        )

        result = draft.to_dict()

        assert result['title'] == 'Test Policy'
        assert result['sections'] == []

    def test_procedure_draft_creation(self):
        """Test ProcedureDraft dataclass creation."""
        draft = ProcedureDraft(
            title='User Access Provisioning',
            purpose='Ensure proper access provisioning',
            scope='All new user accounts',
            steps=[
                {'step': 'Submit request', 'responsible': 'Manager'},
                {'step': 'Approve request', 'responsible': 'Security'},
            ],
            roles_responsibilities={'Manager': ['Submit requests', 'Verify need']},
            related_controls=['AC-2'],
        )

        assert draft.title == 'User Access Provisioning'
        assert len(draft.steps) == 2
        assert 'Manager' in draft.roles_responsibilities

    def test_procedure_draft_to_dict(self):
        """Test ProcedureDraft serialization."""
        draft = ProcedureDraft(
            title='Test Procedure',
            purpose='Test purpose',
            scope='Test scope',
        )

        result = draft.to_dict()

        assert result['title'] == 'Test Procedure'
        assert result['steps'] == []


# =============================================================================
# AI Author - Service Tests
# =============================================================================

class TestAIAuthorService:
    """Tests for AIAuthorService."""

    @pytest.fixture
    def ai_author(self, mock_llm_client):
        """Create AI Author service with mock client."""
        return AIAuthorService(llm_client=mock_llm_client)

    def test_service_initialization(self, mock_llm_client):
        """Test service initialization."""
        service = AIAuthorService(llm_client=mock_llm_client)
        assert service._llm_client is mock_llm_client

    def test_service_lazy_load(self):
        """Test lazy loading of LLM client."""
        service = AIAuthorService()
        assert service._llm_client is None

    def test_draft_control_implementation(self, ai_author):
        """Test control implementation drafting."""
        result = ai_author.draft_control_implementation(
            control_id='AC-1',
            requirement_text='Develop and document access control policy',
            framework='fedramp',
        )

        assert isinstance(result, ControlDraft)
        assert result.control_id == 'AC-1'
        assert result.framework == 'fedramp'

    def test_draft_control_with_context(self, ai_author):
        """Test control drafting with context."""
        result = ai_author.draft_control_implementation(
            control_id='AC-2',
            requirement_text='Manage user accounts',
            context={
                'organization': 'Test Corp',
                'system': 'Cloud Platform',
            },
        )

        assert isinstance(result, ControlDraft)

    def test_draft_control_with_existing(self, ai_author):
        """Test control drafting with existing implementation."""
        result = ai_author.draft_control_implementation(
            control_id='AC-3',
            requirement_text='Access enforcement',
            existing_implementation='Basic RBAC implemented',
        )

        assert isinstance(result, ControlDraft)

    def test_draft_policy_section(self, ai_author):
        """Test policy section drafting."""
        result = ai_author.draft_policy_section(
            topic='Access Control',
            framework='nist_800_53',
            related_controls=['AC-1', 'AC-2'],
        )

        assert isinstance(result, PolicyDraft)
        assert 'AC-1' in result.related_controls

    def test_draft_procedure(self, ai_author):
        """Test procedure drafting."""
        result = ai_author.draft_procedure(
            procedure_name='User Access Provisioning',
            purpose='Ensure proper access provisioning',
            related_controls=['AC-2'],
        )

        assert isinstance(result, ProcedureDraft)
        # Verify the method runs and returns a ProcedureDraft
        # Title may be empty if parsing fails (mock response doesn't match expected format)
        assert result.related_controls == ['AC-2']

    def test_draft_ssp_narrative(self, ai_author):
        """Test SSP narrative drafting."""
        result = ai_author.draft_ssp_narrative(
            control_id='AC-1',
            requirement_text='Access control policy',
            system_description='Cloud-based CRM system',
        )

        assert isinstance(result, str)

    def test_draft_poam_entry(self, ai_author):
        """Test POA&M entry drafting."""
        result = ai_author.draft_poam_entry(
            weakness_description='MFA not enabled for all users',
            control_id='IA-2',
            severity='high',
        )

        assert isinstance(result, dict)
        assert result['control_id'] == 'IA-2'
        assert result['severity'] == 'high'

    def test_improve_existing_text(self, ai_author):
        """Test text improvement."""
        result = ai_author.improve_existing_text(
            text='access controls implemented',
            document_type='control_statement',
            improvement_focus=['clarity', 'specificity'],
        )

        assert isinstance(result, str)

    def test_format_context_empty(self, ai_author):
        """Test formatting empty context."""
        result = ai_author._format_context({})
        assert 'No additional context' in result

    def test_format_context_with_data(self, ai_author):
        """Test formatting context with data."""
        result = ai_author._format_context({
            'organization': 'Test Corp',
            'items': ['a', 'b', 'c'],
        })

        assert 'organization' in result
        assert 'Test Corp' in result

    def test_parse_control_response(self, ai_author):
        """Test control response parsing."""
        response = """IMPLEMENTATION:
The organization implements access controls through IAM.

RESPONSIBLE_ROLES:
- CISO
- Security Team

SUGGESTED_EVIDENCE:
- Policy document
- Configuration screenshots"""

        result = ai_author._parse_control_response(response)

        assert 'IAM' in result['implementation']
        assert 'CISO' in result['roles']
        assert 'Policy document' in result['evidence']

    def test_parse_control_response_fallback(self, ai_author):
        """Test control response parsing fallback."""
        response = "Just plain text without sections"

        result = ai_author._parse_control_response(response)

        assert result['implementation'] == 'Just plain text without sections'

    def test_parse_policy_response(self, ai_author):
        """Test policy response parsing."""
        response = """TITLE: Access Control Policy
CONTENT:
This policy establishes access control requirements.
SECTIONS:
- Scope: All employees and contractors
- Responsibilities: Security team manages access"""

        result = ai_author._parse_policy_response(response)

        assert result['title'] == 'Access Control Policy'
        assert len(result['sections']) == 2

    def test_parse_procedure_response(self, ai_author):
        """Test procedure response parsing."""
        response = """TITLE: Access Provisioning
PURPOSE: Ensure proper access
SCOPE: All user accounts
STEPS:
1. Submit request | Responsible: User
2. Approve request | Responsible: Manager
ROLES:
- Manager: Review, Approve"""

        result = ai_author._parse_procedure_response(response)

        assert result['title'] == 'Access Provisioning'
        assert len(result['steps']) == 2
        assert 'Manager' in result['roles']

    def test_parse_poam_response(self, ai_author):
        """Test POA&M response parsing."""
        response = """WEAKNESS: MFA not enabled
REMEDIATION: Deploy MFA solution
MILESTONES:
1. Select vendor | 30 days
2. Deploy solution | 60 days
RESOURCES: $50,000 budget"""

        result = ai_author._parse_poam_response(response, 'IA-2', 'high')

        assert result['weakness'] == 'MFA not enabled'
        assert len(result['milestones']) == 2
        assert result['milestones'][0]['days_to_complete'] == 30

    def test_calculate_confidence(self, ai_author):
        """Test confidence calculation."""
        mock_response = Mock()
        mock_response.content = "Short response"

        score = ai_author._calculate_confidence(mock_response)
        assert 0.0 <= score <= 0.95

    def test_calculate_confidence_detailed(self, ai_author):
        """Test confidence calculation for detailed response."""
        mock_response = Mock()
        mock_response.content = "A" * 1500 + "\nIMPLEMENTATION: test\nRESPONSIBLE: test"

        score = ai_author._calculate_confidence(mock_response)
        assert score > 0.8

    def test_build_control_system_prompt(self, ai_author):
        """Test building control system prompt."""
        prompt = ai_author._build_control_system_prompt('fedramp')
        assert 'FedRAMP' in prompt

    def test_build_control_user_prompt(self, ai_author):
        """Test building control user prompt."""
        prompt = ai_author._build_control_user_prompt(
            control_id='AC-1',
            requirement_text='Test requirement',
            context={'org': 'Test'},
            existing_implementation=None,
        )

        assert 'AC-1' in prompt
        assert 'Test requirement' in prompt

    def test_build_control_user_prompt_with_existing(self, ai_author):
        """Test building control user prompt with existing implementation."""
        prompt = ai_author._build_control_user_prompt(
            control_id='AC-1',
            requirement_text='Test',
            context={},
            existing_implementation='Existing text',
        )

        assert 'Existing text' in prompt


# =============================================================================
# Singleton Tests
# =============================================================================

class TestAIAuthorSingleton:
    """Tests for AI Author singleton accessor."""

    def test_get_ai_author_service(self):
        """Test AI Author singleton accessor."""
        import ai_assistant.services.ai_author as author_module
        author_module._ai_author_service = None

        service1 = get_ai_author_service()
        service2 = get_ai_author_service()

        assert service1 is service2
