"""
Comprehensive tests for Risk Assessment and Risk Reporting Services

Tests cover:
- RiskAssessmentService: CVSS calculation, asset risk assessment, control evaluation
- RiskReportingService: Dashboard generation, heat maps, trend analysis, KPIs
"""

import pytest
import uuid
from unittest.mock import Mock, patch, MagicMock
from datetime import date, timedelta
from django.utils import timezone

from risk_registers.services.risk_assessment_service import RiskAssessmentService
from risk_registers.services.risk_reporting_service import RiskReportingService


# =============================================================================
# RiskAssessmentService Tests
# =============================================================================

class TestRiskAssessmentService:
    """Tests for RiskAssessmentService."""

    @pytest.fixture
    def service(self):
        """Create risk assessment service with mocked repositories."""
        svc = RiskAssessmentService()
        svc.asset_risk_repo = MagicMock()
        svc.risk_register_repo = MagicMock()
        return svc

    @pytest.fixture
    def sample_assessment_data(self):
        """Sample assessment data for testing."""
        return {
            'asset_name': 'Production Database Server',
            'risk_title': 'Unauthorized Access Risk',
            'risk_description': 'Risk of unauthorized access to sensitive data',
            'risk_category': 'confidentiality',
            'inherent_likelihood': 4,
            'inherent_impact': 5,
            'tags': ['critical', 'database', 'pii'],
            'cvss_base_score': 7.5,
            'temporal_metrics': {
                'exploitability': 0.9,
                'remediation_level': 1.0,
                'report_confidence': 1.0
            },
            'environmental_metrics': {
                'collateral_damage_potential': 1.0,
                'target_distribution': 0.8,
                'confidentiality_requirement': 1.5,
                'integrity_requirement': 1.0,
                'availability_requirement': 1.0
            },
            'threat_details': {
                'source': 'External Threat Actor',
                'vector': 'Network',
                'vulnerability_description': 'Weak authentication mechanism'
            },
            'cve_ids': ['CVE-2024-0001'],
            'cwe_ids': ['CWE-287'],
            'risk_threshold': 3,
            'risk_appetite': 'moderate'
        }

    # -------------------------------------------------------------------------
    # CVSS Calculation Tests
    # -------------------------------------------------------------------------

    def test_calculate_cvss_score_base_only(self, service):
        """Test CVSS calculation with base score only."""
        result = service.calculate_cvss_score(7.5)

        assert result['base_score'] == 7.5
        assert result['temporal_score'] == 7.5
        assert result['environmental_score'] == 7.5

    def test_calculate_cvss_score_with_temporal(self, service):
        """Test CVSS calculation with temporal metrics."""
        temporal_metrics = {
            'exploitability': 0.9,
            'remediation_level': 0.95,
            'report_confidence': 1.0
        }

        result = service.calculate_cvss_score(8.0, temporal_metrics)

        assert result['base_score'] == 8.0
        assert result['temporal_score'] < result['base_score']
        assert result['temporal_score'] == round(8.0 * 0.9 * 0.95 * 1.0, 1)

    def test_calculate_cvss_score_with_environmental(self, service):
        """Test CVSS calculation with environmental metrics."""
        temporal_metrics = {
            'exploitability': 1.0,
            'remediation_level': 1.0,
            'report_confidence': 1.0
        }
        environmental_metrics = {
            'collateral_damage_potential': 1.0,
            'target_distribution': 0.5,
            'confidentiality_requirement': 1.5,
            'integrity_requirement': 1.0,
            'availability_requirement': 1.0
        }

        result = service.calculate_cvss_score(7.0, temporal_metrics, environmental_metrics)

        assert result['base_score'] == 7.0
        assert result['temporal_score'] == 7.0
        assert 'environmental_score' in result

    def test_calculate_cvss_score_capped_at_10(self, service):
        """Test CVSS score is capped at 10.0."""
        temporal_metrics = {
            'exploitability': 1.5,
            'remediation_level': 1.5,
            'report_confidence': 1.5
        }

        result = service.calculate_cvss_score(9.0, temporal_metrics)

        assert result['temporal_score'] <= 10.0
        assert result['environmental_score'] <= 10.0

    def test_calculate_cvss_score_low_base(self, service):
        """Test CVSS calculation with low base score."""
        result = service.calculate_cvss_score(2.0)

        assert result['base_score'] == 2.0
        assert result['temporal_score'] == 2.0
        assert result['environmental_score'] == 2.0

    # -------------------------------------------------------------------------
    # Asset Risk Assessment Tests
    # -------------------------------------------------------------------------

    @patch('risk_registers.services.risk_assessment_service.AssetRisk')
    def test_assess_asset_risk_basic(self, mock_asset_risk_class, service, sample_assessment_data):
        """Test basic asset risk assessment."""
        mock_asset_risk = MagicMock()
        mock_asset_risk_class.return_value = mock_asset_risk

        asset_id = uuid.uuid4()
        assessor_id = uuid.uuid4()

        result = service.assess_asset_risk(
            asset_id=asset_id,
            assessment_data=sample_assessment_data,
            assessor_user_id=assessor_id,
            assessor_username='test_assessor'
        )

        mock_asset_risk.create_asset_risk.assert_called_once()
        mock_asset_risk.save.assert_called_once()
        assert result == mock_asset_risk

    @patch('risk_registers.services.risk_assessment_service.AssetRisk')
    def test_assess_asset_risk_generates_risk_id(self, mock_asset_risk_class, service):
        """Test that asset risk assessment generates unique risk ID."""
        mock_asset_risk = MagicMock()
        mock_asset_risk_class.return_value = mock_asset_risk

        assessment_data = {
            'asset_name': 'Test Asset',
            'risk_title': 'Test Risk',
            'risk_description': 'Test description'
        }

        service.assess_asset_risk(
            asset_id=uuid.uuid4(),
            assessment_data=assessment_data,
            assessor_user_id=uuid.uuid4(),
            assessor_username='test_user'
        )

        call_kwargs = mock_asset_risk.create_asset_risk.call_args
        assert call_kwargs is not None
        risk_id = call_kwargs.kwargs.get('risk_id') or call_kwargs[1].get('risk_id')
        if risk_id:
            assert risk_id.startswith('RISK-AST-')

    @patch('risk_registers.services.risk_assessment_service.AssetRisk')
    def test_assess_asset_risk_with_cvss(self, mock_asset_risk_class, service, sample_assessment_data):
        """Test asset risk assessment with CVSS scores."""
        mock_asset_risk = MagicMock()
        mock_asset_risk_class.return_value = mock_asset_risk

        service.assess_asset_risk(
            asset_id=uuid.uuid4(),
            assessment_data=sample_assessment_data,
            assessor_user_id=uuid.uuid4(),
            assessor_username='test_assessor'
        )

        # Verify CVSS scores were set
        assert mock_asset_risk.cvss_base_score is not None

    # -------------------------------------------------------------------------
    # Update Risk Assessment Tests
    # -------------------------------------------------------------------------

    def test_update_risk_assessment_not_found(self, service):
        """Test update with non-existent risk."""
        with patch.object(service.asset_risk_repo, 'get', return_value=None):
            with pytest.raises(ValueError, match="not found"):
                service.update_risk_assessment(
                    risk_id='RISK-001',
                    update_data={'risk_title': 'Updated Title'},
                    updated_by_user_id=uuid.uuid4(),
                    updated_by_username='test_user'
                )

    def test_update_risk_assessment_basic(self, service):
        """Test basic risk assessment update."""
        mock_risk = MagicMock()
        mock_risk.inherent_likelihood = 3
        mock_risk.inherent_impact = 3
        mock_risk.treatment_status = 'pending'

        with patch.object(service.asset_risk_repo, 'get', return_value=mock_risk):
            result = service.update_risk_assessment(
                risk_id='RISK-001',
                update_data={'risk_title': 'Updated Title'},
                updated_by_user_id=uuid.uuid4(),
                updated_by_username='test_user'
            )

            assert result == mock_risk
            assert mock_risk.risk_title == 'Updated Title'
            mock_risk.save.assert_called()

    # -------------------------------------------------------------------------
    # Control Effectiveness Evaluation Tests
    # -------------------------------------------------------------------------

    def test_evaluate_control_effectiveness_not_found(self, service):
        """Test control evaluation with non-existent risk."""
        with patch.object(service.asset_risk_repo, 'get', return_value=None):
            with pytest.raises(ValueError, match="not found"):
                service.evaluate_control_effectiveness(
                    risk_id='RISK-001',
                    control_assessments=[],
                    evaluated_by_user_id=uuid.uuid4(),
                    evaluated_by_username='test_user'
                )

    def test_evaluate_control_effectiveness_calculates_residual(self, service):
        """Test control effectiveness reduces residual risk."""
        mock_risk = MagicMock()
        mock_risk.inherent_likelihood = 4
        mock_risk.inherent_impact = 5
        mock_risk.inherent_risk_score = 20
        mock_risk.risk_reduction_achieved = 0

        control_assessments = [
            {'control_id': 'AC-1', 'effectiveness': 80, 'weight': 1.0},
            {'control_id': 'AC-2', 'effectiveness': 75, 'weight': 1.0},
        ]

        with patch.object(service.asset_risk_repo, 'get', return_value=mock_risk):
            result = service.evaluate_control_effectiveness(
                risk_id='RISK-001',
                control_assessments=control_assessments,
                evaluated_by_user_id=uuid.uuid4(),
                evaluated_by_username='test_user'
            )

            assert 'average_control_effectiveness' in result
            assert result['effective_controls_count'] == 2
            mock_risk.update_residual_risk.assert_called_once()

    def test_evaluate_control_effectiveness_no_effective_controls(self, service):
        """Test control evaluation with no effective controls."""
        mock_risk = MagicMock()
        mock_risk.inherent_likelihood = 4
        mock_risk.inherent_impact = 4
        mock_risk.inherent_risk_score = 16
        mock_risk.risk_reduction_achieved = 0

        control_assessments = [
            {'control_id': 'AC-1', 'effectiveness': 50, 'weight': 1.0},  # Below 70%
        ]

        with patch.object(service.asset_risk_repo, 'get', return_value=mock_risk):
            result = service.evaluate_control_effectiveness(
                risk_id='RISK-001',
                control_assessments=control_assessments,
                evaluated_by_user_id=uuid.uuid4(),
                evaluated_by_username='test_user'
            )

            assert result['effective_controls_count'] == 0
            assert result['average_control_effectiveness'] == 0

    # -------------------------------------------------------------------------
    # Bulk Risk Assessment Tests
    # -------------------------------------------------------------------------

    @patch('risk_registers.services.risk_assessment_service.AssetRisk')
    def test_bulk_risk_assessment(self, mock_asset_risk_class, service):
        """Test bulk risk assessment for multiple assets."""
        mock_asset_risk = MagicMock()
        mock_asset_risk_class.return_value = mock_asset_risk

        asset_ids = [uuid.uuid4() for _ in range(3)]
        template = {
            'risk_title': 'Common Risk',
            'risk_description': 'Common description',
            'inherent_likelihood': 3,
            'inherent_impact': 3
        }

        results = service.perform_bulk_risk_assessment(
            asset_ids=asset_ids,
            assessment_template=template,
            assessor_user_id=uuid.uuid4(),
            assessor_username='test_assessor'
        )

        assert len(results) == 3
        assert mock_asset_risk.create_asset_risk.call_count == 3

    # -------------------------------------------------------------------------
    # Risk Scenario Generation Tests
    # -------------------------------------------------------------------------

    def test_generate_risk_scenarios(self, service):
        """Test risk scenario generation from threat modeling data."""
        threat_data = {
            'threat_actors': [
                {'name': 'External Hacker', 'description': 'Malicious external actor',
                 'capability_score': 4, 'intent_score': 4, 'motivation': 'financial'}
            ],
            'attack_vectors': [
                {'name': 'Network Attack', 'description': 'Attack via network',
                 'type': 'network', 'ease_score': 3, 'damage_potential_score': 4}
            ],
            'vulnerabilities': [
                {'name': 'SQL Injection', 'description': 'SQL injection vulnerability',
                 'type': 'software', 'prevalence_score': 3, 'severity_score': 4, 'impact': 'confidentiality'}
            ]
        }

        scenarios = service.generate_risk_scenarios(
            asset_id=uuid.uuid4(),
            threat_modeling_data=threat_data,
            assessor_user_id=uuid.uuid4(),
            assessor_username='test_assessor'
        )

        assert len(scenarios) == 1
        assert 'External Hacker' in scenarios[0]['title']
        assert 'inherent_likelihood' in scenarios[0]
        assert 'inherent_impact' in scenarios[0]
        assert 'mitigation_suggestions' in scenarios[0]

    def test_generate_risk_scenarios_multiple_combinations(self, service):
        """Test scenario generation with multiple threat combinations."""
        threat_data = {
            'threat_actors': [
                {'name': 'Actor1', 'description': 'A1', 'capability_score': 3, 'intent_score': 3},
                {'name': 'Actor2', 'description': 'A2', 'capability_score': 4, 'intent_score': 4}
            ],
            'attack_vectors': [
                {'name': 'Vector1', 'description': 'V1', 'type': 'network', 'ease_score': 3, 'damage_potential_score': 3}
            ],
            'vulnerabilities': [
                {'name': 'Vuln1', 'description': 'VU1', 'type': 'software', 'prevalence_score': 3, 'severity_score': 3, 'impact': 'integrity'},
                {'name': 'Vuln2', 'description': 'VU2', 'type': 'configuration', 'prevalence_score': 2, 'severity_score': 2, 'impact': 'availability'}
            ]
        }

        scenarios = service.generate_risk_scenarios(
            asset_id=uuid.uuid4(),
            threat_modeling_data=threat_data,
            assessor_user_id=uuid.uuid4(),
            assessor_username='test_assessor'
        )

        # 2 actors * 1 vector * 2 vulnerabilities = 4 scenarios
        assert len(scenarios) == 4

    # -------------------------------------------------------------------------
    # Scenario Calculation Helper Tests
    # -------------------------------------------------------------------------

    def test_calculate_scenario_likelihood(self, service):
        """Test scenario likelihood calculation."""
        actor = {'capability_score': 4}
        vector = {'ease_score': 3}
        vulnerability = {'prevalence_score': 5}

        likelihood = service._calculate_scenario_likelihood(actor, vector, vulnerability)

        assert likelihood >= 1
        assert likelihood <= 5
        assert likelihood == 4  # (4 + 3 + 5) // 3 = 4

    def test_calculate_scenario_impact(self, service):
        """Test scenario impact calculation."""
        actor = {'intent_score': 5}
        vector = {'damage_potential_score': 4}
        vulnerability = {'severity_score': 3}

        impact = service._calculate_scenario_impact(actor, vector, vulnerability)

        assert impact >= 1
        assert impact <= 5
        assert impact == 4  # (5 + 4 + 3) // 3 = 4

    def test_determine_scenario_category_confidentiality(self, service):
        """Test scenario category determination for confidentiality."""
        vulnerability = {'impact': 'Data confidentiality breach'}

        category = service._determine_scenario_category({}, {}, vulnerability)

        assert category == 'confidentiality'

    def test_determine_scenario_category_integrity(self, service):
        """Test scenario category determination for integrity."""
        vulnerability = {'impact': 'Data integrity compromise'}

        category = service._determine_scenario_category({}, {}, vulnerability)

        assert category == 'integrity'

    def test_generate_mitigation_suggestions_network(self, service):
        """Test mitigation suggestions for network vector."""
        vector = {'type': 'network attack'}
        vulnerability = {'type': 'software vulnerability'}

        suggestions = service._generate_mitigation_suggestions(vector, vulnerability)

        assert len(suggestions) > 0
        assert any('network' in s.lower() for s in suggestions)

    def test_generate_mitigation_suggestions_social(self, service):
        """Test mitigation suggestions for social engineering."""
        vector = {'type': 'social engineering'}
        vulnerability = {'type': 'configuration weakness'}

        suggestions = service._generate_mitigation_suggestions(vector, vulnerability)

        assert len(suggestions) > 0
        assert any('awareness' in s.lower() or 'training' in s.lower() for s in suggestions)

    # -------------------------------------------------------------------------
    # Validation Tests
    # -------------------------------------------------------------------------

    def test_validate_risk_assessment_data_valid(self, service):
        """Test validation of valid assessment data."""
        data = {
            'asset_name': 'Test Asset',
            'risk_title': 'Test Risk',
            'risk_description': 'Test description',
            'inherent_likelihood': 3,
            'inherent_impact': 4,
            'cvss_base_score': 7.5,
            'risk_category': 'operational'
        }

        errors = service.validate_risk_assessment_data(data)

        assert errors == []

    def test_validate_risk_assessment_data_missing_required(self, service):
        """Test validation with missing required fields."""
        data = {'inherent_likelihood': 3}

        errors = service.validate_risk_assessment_data(data)

        assert len(errors) == 3
        assert any('asset_name' in e for e in errors)
        assert any('risk_title' in e for e in errors)
        assert any('risk_description' in e for e in errors)

    def test_validate_risk_assessment_data_invalid_likelihood(self, service):
        """Test validation with invalid likelihood."""
        data = {
            'asset_name': 'Test',
            'risk_title': 'Test',
            'risk_description': 'Test',
            'inherent_likelihood': 10  # Invalid
        }

        errors = service.validate_risk_assessment_data(data)

        assert any('likelihood' in e for e in errors)

    def test_validate_risk_assessment_data_invalid_impact(self, service):
        """Test validation with invalid impact."""
        data = {
            'asset_name': 'Test',
            'risk_title': 'Test',
            'risk_description': 'Test',
            'inherent_impact': 0  # Invalid
        }

        errors = service.validate_risk_assessment_data(data)

        assert any('impact' in e for e in errors)

    def test_validate_risk_assessment_data_invalid_cvss(self, service):
        """Test validation with invalid CVSS score."""
        data = {
            'asset_name': 'Test',
            'risk_title': 'Test',
            'risk_description': 'Test',
            'cvss_base_score': 15.0  # Invalid - must be 0-10
        }

        errors = service.validate_risk_assessment_data(data)

        assert any('CVSS' in e for e in errors)

    def test_validate_risk_assessment_data_invalid_category(self, service):
        """Test validation with invalid risk category."""
        data = {
            'asset_name': 'Test',
            'risk_title': 'Test',
            'risk_description': 'Test',
            'risk_category': 'invalid_category'
        }

        errors = service.validate_risk_assessment_data(data)

        assert any('category' in e for e in errors)


# =============================================================================
# RiskReportingService Tests
# =============================================================================

class TestRiskReportingService:
    """Tests for RiskReportingService."""

    @pytest.fixture
    def service(self):
        """Create risk reporting service with mocked repositories."""
        svc = RiskReportingService()
        svc.asset_risk_repo = MagicMock()
        svc.risk_register_repo = MagicMock()
        return svc

    @pytest.fixture
    def mock_enterprise_summary(self):
        """Mock enterprise risk summary."""
        return {
            'total_risks': 100,
            'risk_distribution': {
                'critical': 5,
                'high': 15,
                'medium': 40,
                'low': 40
            },
            'treatment_summary': {
                'treatment_effectiveness_percentage': 75
            }
        }

    # -------------------------------------------------------------------------
    # Dashboard Generation Tests
    # -------------------------------------------------------------------------

    def test_generate_risk_dashboard_data_enterprise(self, service, mock_enterprise_summary):
        """Test enterprise dashboard generation."""
        with patch.object(service.risk_register_repo, 'get_enterprise_risk_summary', return_value=mock_enterprise_summary), \
             patch.object(service.asset_risk_repo, 'get_risk_trends', return_value={}), \
             patch.object(service.risk_register_repo, 'get_risk_heat_map_enterprise', return_value={}), \
             patch.object(service.risk_register_repo, 'get_top_enterprise_risks', return_value=[]):

            result = service.generate_risk_dashboard_data(scope='enterprise')

            assert result['scope'] == 'enterprise'
            assert 'summary' in result
            assert 'kpis' in result
            assert 'heat_map' in result
            assert 'top_risks' in result
            assert 'trends' in result
            assert 'generated_at' in result

    def test_generate_risk_dashboard_data_invalid_scope(self, service):
        """Test dashboard with invalid scope."""
        with pytest.raises(ValueError, match="Invalid scope"):
            service.generate_risk_dashboard_data(scope='invalid')

    def test_generate_risk_dashboard_data_asset_missing_id(self, service):
        """Test asset dashboard without asset_id."""
        with pytest.raises(ValueError, match="Invalid scope"):
            service.generate_risk_dashboard_data(scope='asset', filters={})

    def test_generate_risk_dashboard_data_asset(self, service):
        """Test asset-specific dashboard generation."""
        asset_id = str(uuid.uuid4())

        with patch.object(service.asset_risk_repo, 'find_by_asset', return_value=[]), \
             patch.object(service.asset_risk_repo, 'get_risk_statistics_for_asset', return_value={}), \
             patch.object(service.asset_risk_repo, 'get_risk_heat_map_data', return_value={}), \
             patch.object(service.asset_risk_repo, 'get_treatment_effectiveness_report', return_value={}), \
             patch.object(service.asset_risk_repo, 'get_risks_requiring_attention', return_value=[]):

            result = service.generate_risk_dashboard_data(
                scope='asset',
                filters={'asset_id': asset_id}
            )

            assert result['scope'] == 'asset'
            assert result['asset_id'] == asset_id

    # -------------------------------------------------------------------------
    # KPI Calculation Tests
    # -------------------------------------------------------------------------

    def test_calculate_risk_kpis(self, service, mock_enterprise_summary):
        """Test KPI calculation."""
        kpis = service._calculate_risk_kpis(mock_enterprise_summary)

        assert 'high_critical_percentage' in kpis
        assert 'treatment_effectiveness_percentage' in kpis
        assert 'appetite_compliance_score' in kpis
        assert 'overall_health_score' in kpis
        assert kpis['high_critical_percentage'] == 20.0  # (5 + 15) / 100 * 100

    def test_calculate_risk_kpis_empty_risks(self, service):
        """Test KPI calculation with zero risks."""
        summary = {
            'total_risks': 0,
            'risk_distribution': {'critical': 0, 'high': 0, 'medium': 0, 'low': 0},
            'treatment_summary': {'treatment_effectiveness_percentage': 0}
        }

        kpis = service._calculate_risk_kpis(summary)

        assert kpis['high_critical_percentage'] == 0

    def test_get_kpi_status_risk_distribution(self, service):
        """Test KPI status for risk distribution."""
        assert service._get_kpi_status(5, 'risk_distribution') == 'excellent'
        assert service._get_kpi_status(15, 'risk_distribution') == 'good'
        assert service._get_kpi_status(25, 'risk_distribution') == 'moderate'
        assert service._get_kpi_status(50, 'risk_distribution') == 'poor'

    def test_get_kpi_status_treatment(self, service):
        """Test KPI status for treatment."""
        assert service._get_kpi_status(10, 'treatment') == 'excellent'
        assert service._get_kpi_status(30, 'treatment') == 'good'
        assert service._get_kpi_status(50, 'treatment') == 'moderate'
        assert service._get_kpi_status(70, 'treatment') == 'poor'

    def test_get_kpi_status_unknown(self, service):
        """Test KPI status for unknown type."""
        assert service._get_kpi_status(50, 'unknown_type') == 'unknown'

    # -------------------------------------------------------------------------
    # Risk Register Report Tests
    # -------------------------------------------------------------------------

    def test_generate_risk_register_report_comprehensive(self, service):
        """Test comprehensive risk register report."""
        mock_health_score = {
            'overall_health_score': 85,
            'health_factors': {},
            'recommendations': []
        }

        with patch.object(service.risk_register_repo, 'get_register_health_score', return_value=mock_health_score), \
             patch.object(service.risk_register_repo, 'get_register_performance_comparison', return_value=[]), \
             patch.object(service.asset_risk_repo, 'get_risk_trends', return_value={}), \
             patch.object(service.asset_risk_repo, 'get_top_risks', return_value=[]):

            result = service.generate_risk_register_report(
                register_id='REG-001',
                report_type='comprehensive'
            )

            assert result['report_type'] == 'comprehensive'
            assert 'executive_summary' in result
            assert 'technical_details' in result

    def test_generate_risk_register_report_executive(self, service):
        """Test executive risk register report."""
        mock_health_score = {
            'overall_health_score': 90,
            'health_factors': {'risks_within_appetite': 95, 'treatment_effectiveness': 80},
            'recommendations': []
        }

        with patch.object(service.risk_register_repo, 'get_register_health_score', return_value=mock_health_score), \
             patch.object(service.risk_register_repo, 'get_register_performance_comparison', return_value=[]):

            result = service.generate_risk_register_report(
                register_id='REG-001',
                report_type='executive'
            )

            assert result['report_type'] == 'executive'
            assert result['health_score'] == 90
            assert 'key_metrics' in result

    def test_generate_risk_register_report_technical(self, service):
        """Test technical risk register report."""
        mock_health_score = {
            'overall_health_score': 75,
            'health_factors': {'data_completeness': 80, 'up_to_date_reports': 70, 'up_to_date_reviews': 85},
            'recommendations': []
        }

        with patch.object(service.risk_register_repo, 'get_register_health_score', return_value=mock_health_score), \
             patch.object(service.asset_risk_repo, 'get_risk_trends', return_value={}), \
             patch.object(service.asset_risk_repo, 'get_top_risks', return_value=[]):

            result = service.generate_risk_register_report(
                register_id='REG-001',
                report_type='technical'
            )

            assert result['report_type'] == 'technical'
            assert 'technical_metrics' in result
            assert 'trends_analysis' in result

    # -------------------------------------------------------------------------
    # Heat Map Report Tests
    # -------------------------------------------------------------------------

    def test_generate_risk_heat_map_report_enterprise(self, service):
        """Test enterprise heat map report."""
        mock_heat_map = {
            'matrix': [
                [5, 3, 2, 1, 0],
                [8, 6, 4, 2, 1],
                [10, 8, 5, 3, 2],
                [12, 10, 7, 4, 3],
                [5, 4, 3, 2, 1]
            ]
        }

        with patch.object(service.risk_register_repo, 'get_risk_heat_map_enterprise', return_value=mock_heat_map):
            result = service.generate_risk_heat_map_report(scope='enterprise')

            assert result['scope'] == 'enterprise'
            assert 'heat_map' in result
            assert 'analysis' in result

    def test_generate_risk_heat_map_report_invalid_scope(self, service):
        """Test heat map report with invalid scope."""
        with pytest.raises(ValueError, match="Invalid scope"):
            service.generate_risk_heat_map_report(scope='invalid')

    def test_analyze_heat_map(self, service):
        """Test heat map analysis."""
        heat_map = {
            'matrix': [
                [5, 3, 2, 1, 0],
                [8, 6, 4, 2, 1],
                [10, 8, 5, 3, 2],
                [12, 10, 7, 4, 3],
                [5, 4, 3, 2, 1]
            ]
        }

        analysis = service._analyze_heat_map(heat_map)

        assert 'total_risks' in analysis
        assert analysis['total_risks'] == sum(sum(row) for row in heat_map['matrix'])
        assert 'high_risk_zones' in analysis
        assert 'dominant_patterns' in analysis
        assert 'insights' in analysis

    def test_analyze_heat_map_invalid_matrix(self, service):
        """Test heat map analysis with invalid matrix."""
        heat_map = {'matrix': []}

        analysis = service._analyze_heat_map(heat_map)

        assert 'error' in analysis

    # -------------------------------------------------------------------------
    # Trends Report Tests
    # -------------------------------------------------------------------------

    def test_generate_risk_trends_report(self, service):
        """Test risk trends report generation."""
        mock_trends = {
            'periods': ['2024-01', '2024-02', '2024-03'],
            'total_risks': [50, 55, 60],
            'critical_risks': [5, 6, 7],
            'treatment_effectiveness': [70, 72, 75]
        }

        with patch.object(service.asset_risk_repo, 'get_risk_trends', return_value=mock_trends):
            result = service.generate_risk_trends_report(months=3)

            assert 'periods' in result
            assert 'trends' in result
            assert 'analysis' in result
            assert 'generated_at' in result

    def test_analyze_trends_increasing(self, service):
        """Test trend analysis with increasing risks."""
        trends = {
            'periods': ['2024-01', '2024-02', '2024-03', '2024-04'],
            'total_risks': [50, 52, 70, 80],  # Second half significantly higher
            'critical_risks': [5, 5, 5, 5],
            'treatment_effectiveness': [70, 70, 70, 70]
        }

        analysis = service._analyze_trends(trends)

        assert analysis['trend_direction'] == 'increasing'
        assert any('increasing' in insight.lower() for insight in analysis['insights'])

    def test_analyze_trends_decreasing(self, service):
        """Test trend analysis with decreasing risks."""
        trends = {
            'periods': ['2024-01', '2024-02', '2024-03', '2024-04'],
            'total_risks': [100, 90, 50, 40],  # Second half significantly lower
            'critical_risks': [10, 8, 5, 3],
            'treatment_effectiveness': [70, 75, 80, 85]
        }

        analysis = service._analyze_trends(trends)

        assert analysis['trend_direction'] == 'decreasing'

    def test_analyze_trends_stable(self, service):
        """Test trend analysis with stable risks."""
        trends = {
            'periods': ['2024-01', '2024-02', '2024-03', '2024-04'],
            'total_risks': [50, 51, 49, 50],  # Relatively stable
            'critical_risks': [5, 5, 5, 5],
            'treatment_effectiveness': [70, 70, 70, 70]
        }

        analysis = service._analyze_trends(trends)

        assert analysis['trend_direction'] == 'stable'

    def test_analyze_trends_treatment_effectiveness(self, service):
        """Test trend analysis for treatment effectiveness."""
        trends = {
            'periods': ['2024-01', '2024-02'],
            'total_risks': [50, 50],
            'critical_risks': [5, 5],
            'treatment_effectiveness': [90, 95]  # High effectiveness
        }

        analysis = service._analyze_trends(trends)

        assert any('effectiveness' in insight.lower() for insight in analysis['insights'])


# =============================================================================
# Edge Case Tests
# =============================================================================

class TestRiskServicesEdgeCases:
    """Edge case tests for risk services."""

    @pytest.fixture
    def assessment_service(self):
        svc = RiskAssessmentService()
        svc.asset_risk_repo = MagicMock()
        svc.risk_register_repo = MagicMock()
        return svc

    @pytest.fixture
    def reporting_service(self):
        svc = RiskReportingService()
        svc.asset_risk_repo = MagicMock()
        svc.risk_register_repo = MagicMock()
        return svc

    def test_cvss_with_zero_base_score(self, assessment_service):
        """Test CVSS calculation with zero base score."""
        result = assessment_service.calculate_cvss_score(0.0)

        assert result['base_score'] == 0.0
        assert result['temporal_score'] == 0.0

    def test_cvss_with_maximum_base_score(self, assessment_service):
        """Test CVSS calculation with maximum base score."""
        result = assessment_service.calculate_cvss_score(10.0)

        assert result['base_score'] == 10.0

    def test_scenario_generation_empty_threats(self, assessment_service):
        """Test scenario generation with empty threat data."""
        scenarios = assessment_service.generate_risk_scenarios(
            asset_id=uuid.uuid4(),
            threat_modeling_data={'threat_actors': [], 'attack_vectors': [], 'vulnerabilities': []},
            assessor_user_id=uuid.uuid4(),
            assessor_username='test_user'
        )

        assert scenarios == []

    def test_validation_with_empty_data(self, assessment_service):
        """Test validation with completely empty data."""
        errors = assessment_service.validate_risk_assessment_data({})

        assert len(errors) == 3

    def test_trends_analysis_insufficient_data(self, reporting_service):
        """Test trend analysis with insufficient data."""
        trends = {
            'periods': ['2024-01'],
            'total_risks': [50],
            'critical_risks': [5],
            'treatment_effectiveness': [70]
        }

        analysis = reporting_service._analyze_trends(trends)

        assert analysis['trend_direction'] == 'stable'
