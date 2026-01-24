"""
Comprehensive tests for Privacy Assessment Service

Tests cover:
- Privacy Impact Assessment (PIA)
- Consent management
- Data subject rights processing
- Privacy compliance reporting
"""

import pytest
import uuid
from unittest.mock import Mock, patch, MagicMock
from django.utils import timezone

from privacy.services.privacy_assessment_service import PrivacyAssessmentService


# =============================================================================
# PrivacyAssessmentService Tests
# =============================================================================

class TestPrivacyAssessmentService:
    """Tests for PrivacyAssessmentService."""

    @pytest.fixture
    def service(self):
        """Create privacy assessment service with mocked repositories."""
        svc = PrivacyAssessmentService()
        svc.data_asset_repo = MagicMock()
        svc.consent_repo = MagicMock()
        svc.dsr_repo = MagicMock()
        return svc

    @pytest.fixture
    def mock_data_asset(self):
        """Create mock data asset."""
        asset = MagicMock()
        asset.asset_id = 'DA-001'
        asset.asset_name = 'Customer Database'
        asset.sensitivity_level = 'confidential'
        asset.estimated_data_subjects = 10000
        asset.processing_purposes = ['customer_service', 'marketing']
        asset.international_transfers = []
        asset.recipients = ['Support Team']
        asset.third_party_processors = ['Cloud Provider']
        asset.consent_required = True
        asset.consent_mechanisms = ['web_form', 'email']
        asset.retention_schedule = 'P3Y'
        asset.security_measures = ['encryption', 'access_control', 'audit_logging']
        asset.subject_rights_supported = ['access', 'rectification', 'erasure']
        asset.data_subject_rights_compliance_score = 85
        asset.data_categories = ['personal', 'contact']
        asset.data_subject_types = ['customers', 'employees']
        return asset

    # -------------------------------------------------------------------------
    # Privacy Impact Assessment Tests
    # -------------------------------------------------------------------------

    def test_conduct_pia_success(self, service, mock_data_asset):
        """Test successful PIA execution."""
        service.data_asset_repo.get.return_value = mock_data_asset
        with patch.object(service.data_asset_repo, 'get', return_value=mock_data_asset):
            result = service.conduct_privacy_impact_assessment(
                asset_id='DA-001',
                assessment_scope={'include_data_flows': True},
                assessor_user_id=uuid.uuid4(),
                assessor_username='privacy_officer'
            )

            assert result['asset_id'] == 'DA-001'
            assert result['asset_name'] == 'Customer Database'
            assert 'risk_factors' in result
            assert 'control_effectiveness' in result
            assert 'data_subject_impact' in result
            assert 'findings' in result
            assert 'recommendations' in result
            assert 'overall_risk_level' in result
            assert 'pia_conclusion' in result
            mock_data_asset.conduct_privacy_impact_assessment.assert_called_once()
            mock_data_asset.save.assert_called_once()

    def test_conduct_pia_asset_not_found(self, service):
        """Test PIA with non-existent asset."""
        with patch.object(service.data_asset_repo, 'get', return_value=None):
            with pytest.raises(ValueError, match="not found"):
                service.conduct_privacy_impact_assessment(
                    asset_id='NONEXISTENT',
                    assessment_scope={},
                    assessor_user_id=uuid.uuid4(),
                    assessor_username='test_user'
                )

    # -------------------------------------------------------------------------
    # PIA Risk Factor Assessment Tests
    # -------------------------------------------------------------------------

    def test_assess_pia_risk_factors_sensitivity(self, service, mock_data_asset):
        """Test PIA risk factor assessment for data sensitivity."""
        risk_factors = service._assess_pia_risk_factors(mock_data_asset)

        assert 'data_sensitivity' in risk_factors
        assert risk_factors['data_sensitivity']['level'] == 'confidential'
        assert risk_factors['data_sensitivity']['score'] == 60

    def test_assess_pia_risk_factors_volume(self, service, mock_data_asset):
        """Test PIA risk factor assessment for data volume."""
        risk_factors = service._assess_pia_risk_factors(mock_data_asset)

        assert 'data_volume' in risk_factors
        assert risk_factors['data_volume']['estimated_subjects'] == 10000
        assert risk_factors['data_volume']['score'] == 60  # 10000 subjects = medium volume

    def test_assess_pia_risk_factors_processing(self, service, mock_data_asset):
        """Test PIA risk factor assessment for processing characteristics."""
        mock_data_asset.processing_purposes = ['customer_service', 'profiling', 'marketing']

        risk_factors = service._assess_pia_risk_factors(mock_data_asset)

        assert 'processing_characteristics' in risk_factors
        assert risk_factors['processing_characteristics']['score'] > 0

    def test_assess_pia_risk_factors_international_transfer(self, service, mock_data_asset):
        """Test PIA risk factor assessment for international transfers."""
        mock_data_asset.international_transfers = ['EU', 'US']

        risk_factors = service._assess_pia_risk_factors(mock_data_asset)

        assert risk_factors['international_transfers']['count'] == 2
        assert risk_factors['international_transfers']['score'] == 50  # 2 * 25

    # -------------------------------------------------------------------------
    # Privacy Controls Evaluation Tests
    # -------------------------------------------------------------------------

    def test_evaluate_privacy_controls(self, service, mock_data_asset):
        """Test privacy controls evaluation."""
        controls = service._evaluate_privacy_controls(mock_data_asset)

        assert 'controls' in controls
        assert 'overall_effectiveness' in controls
        assert 'implemented_controls' in controls
        assert 'total_controls' in controls
        assert controls['overall_effectiveness'] > 0

    def test_evaluate_privacy_controls_data_minimization(self, service, mock_data_asset):
        """Test data minimization control evaluation."""
        mock_data_asset.processing_purposes = ['single_purpose']

        controls = service._evaluate_privacy_controls(mock_data_asset)

        assert controls['controls']['data_minimization']['implemented'] is True
        assert controls['controls']['data_minimization']['effectiveness'] == 80

    def test_evaluate_privacy_controls_no_retention(self, service, mock_data_asset):
        """Test control evaluation without retention schedule."""
        mock_data_asset.retention_schedule = None

        controls = service._evaluate_privacy_controls(mock_data_asset)

        assert controls['controls']['storage_limitation']['implemented'] is False
        assert controls['controls']['storage_limitation']['effectiveness'] == 35

    def test_evaluate_privacy_controls_no_consent(self, service, mock_data_asset):
        """Test control evaluation without consent mechanism."""
        mock_data_asset.consent_required = False
        mock_data_asset.consent_mechanisms = []

        controls = service._evaluate_privacy_controls(mock_data_asset)

        assert controls['controls']['consent_mechanism']['implemented'] is False
        assert controls['controls']['consent_mechanism']['effectiveness'] == 25

    # -------------------------------------------------------------------------
    # Data Subject Impact Assessment Tests
    # -------------------------------------------------------------------------

    def test_assess_data_subject_impact(self, service, mock_data_asset):
        """Test data subject impact assessment."""
        impact = service._assess_data_subject_impact(mock_data_asset)

        assert 'vulnerable_subjects' in impact
        assert 'data_sensitivity_impact' in impact
        assert 'processing_scale' in impact
        assert 'potential_harm' in impact

    def test_assess_data_subject_impact_vulnerable_subjects(self, service, mock_data_asset):
        """Test impact assessment with vulnerable subjects."""
        mock_data_asset.data_subject_types = ['children', 'patients']

        impact = service._assess_data_subject_impact(mock_data_asset)

        assert impact['vulnerable_subjects']['present'] is True
        assert impact['vulnerable_subjects']['score'] == 30

    def test_assess_data_subject_impact_special_category(self, service, mock_data_asset):
        """Test impact assessment with special category data."""
        mock_data_asset.data_categories = ['special_category_data', 'health']

        impact = service._assess_data_subject_impact(mock_data_asset)

        assert any('Special category' in f for f in impact['potential_harm']['factors'])
        assert impact['potential_harm']['score'] >= 40

    def test_assess_data_subject_impact_profiling(self, service, mock_data_asset):
        """Test impact assessment with automated profiling."""
        mock_data_asset.processing_purposes = ['automated profiling', 'scoring']

        impact = service._assess_data_subject_impact(mock_data_asset)

        assert any('profiling' in f.lower() for f in impact['potential_harm']['factors'])

    # -------------------------------------------------------------------------
    # PIA Findings Generation Tests
    # -------------------------------------------------------------------------

    def test_generate_pia_findings_high_risk(self, service):
        """Test PIA findings generation for high risk."""
        risk_factors = {
            'data_sensitivity': {'score': 80},
            'data_volume': {'score': 60},
            'processing_characteristics': {'score': 40}
        }
        control_effectiveness = {'overall_effectiveness': 50}
        subject_impact = {'potential_harm': {'score': 60}}

        findings = service._generate_pia_findings(risk_factors, control_effectiveness, subject_impact)

        assert len(findings) >= 1
        assert any(f['type'] == 'high_risk' for f in findings)

    def test_generate_pia_findings_control_weakness(self, service):
        """Test PIA findings for control weakness."""
        risk_factors = {'data_sensitivity': {'score': 30}}
        control_effectiveness = {'overall_effectiveness': 40}
        subject_impact = {'potential_harm': {'score': 20}}

        findings = service._generate_pia_findings(risk_factors, control_effectiveness, subject_impact)

        assert any(f['type'] == 'control_weakness' for f in findings)

    def test_generate_pia_findings_subject_impact(self, service):
        """Test PIA findings for high subject impact."""
        risk_factors = {'data_sensitivity': {'score': 30}}
        control_effectiveness = {'overall_effectiveness': 80}
        subject_impact = {'potential_harm': {'score': 70}}

        findings = service._generate_pia_findings(risk_factors, control_effectiveness, subject_impact)

        assert any(f['type'] == 'subject_impact' for f in findings)

    # -------------------------------------------------------------------------
    # PIA Recommendations Tests
    # -------------------------------------------------------------------------

    def test_generate_pia_recommendations_high_risk(self, service):
        """Test PIA recommendations for high risk findings."""
        findings = [{'type': 'high_risk', 'severity': 'high'}]

        recommendations = service._generate_pia_recommendations(findings)

        assert len(recommendations) > 0
        assert any('safeguard' in r.lower() for r in recommendations)

    def test_generate_pia_recommendations_control_weakness(self, service):
        """Test PIA recommendations for control weaknesses."""
        findings = [{'type': 'control_weakness', 'severity': 'medium'}]

        recommendations = service._generate_pia_recommendations(findings)

        assert len(recommendations) > 0
        assert any('control' in r.lower() for r in recommendations)

    def test_generate_pia_recommendations_no_duplicates(self, service):
        """Test that recommendations don't contain duplicates."""
        findings = [
            {'type': 'high_risk', 'severity': 'high'},
            {'type': 'high_risk', 'severity': 'high'}
        ]

        recommendations = service._generate_pia_recommendations(findings)

        assert len(recommendations) == len(set(recommendations))

    # -------------------------------------------------------------------------
    # Overall Risk Calculation Tests
    # -------------------------------------------------------------------------

    def test_calculate_overall_pia_risk_high(self, service):
        """Test overall PIA risk calculation - high risk."""
        risk_factors = {
            'data_sensitivity': {'score': 80},
            'data_volume': {'score': 70},
            'international_transfers': {'score': 50}
        }
        control_effectiveness = {'overall_effectiveness': 40}

        risk_level = service._calculate_overall_pia_risk(risk_factors, control_effectiveness)

        assert risk_level == 'high'

    def test_calculate_overall_pia_risk_medium(self, service):
        """Test overall PIA risk calculation - medium risk."""
        risk_factors = {
            'data_sensitivity': {'score': 50},
            'data_volume': {'score': 40}
        }
        control_effectiveness = {'overall_effectiveness': 60}

        risk_level = service._calculate_overall_pia_risk(risk_factors, control_effectiveness)

        assert risk_level == 'medium'

    def test_calculate_overall_pia_risk_low(self, service):
        """Test overall PIA risk calculation - low risk."""
        risk_factors = {
            'data_sensitivity': {'score': 20},
            'data_volume': {'score': 20}
        }
        control_effectiveness = {'overall_effectiveness': 90}

        risk_level = service._calculate_overall_pia_risk(risk_factors, control_effectiveness)

        assert risk_level == 'low'

    # -------------------------------------------------------------------------
    # PIA Conclusion Tests
    # -------------------------------------------------------------------------

    def test_generate_pia_conclusion_high_risk(self, service):
        """Test PIA conclusion for high risk."""
        conclusion = service._generate_pia_conclusion('high', ['Implement safeguards'])

        assert 'HIGH' in conclusion
        assert 'immediate attention' in conclusion

    def test_generate_pia_conclusion_medium_risk(self, service):
        """Test PIA conclusion for medium risk."""
        conclusion = service._generate_pia_conclusion('medium', ['Monitor controls'])

        assert 'MEDIUM' in conclusion
        assert 'monitored' in conclusion

    def test_generate_pia_conclusion_low_risk(self, service):
        """Test PIA conclusion for low risk."""
        conclusion = service._generate_pia_conclusion('low', [])

        assert 'LOW' in conclusion
        assert 'periodically' in conclusion

    # -------------------------------------------------------------------------
    # Sensitivity Score Tests
    # -------------------------------------------------------------------------

    def test_get_sensitivity_score_public(self, service):
        """Test sensitivity score for public data."""
        assert service._get_sensitivity_score('public') == 10

    def test_get_sensitivity_score_internal(self, service):
        """Test sensitivity score for internal data."""
        assert service._get_sensitivity_score('internal') == 30

    def test_get_sensitivity_score_confidential(self, service):
        """Test sensitivity score for confidential data."""
        assert service._get_sensitivity_score('confidential') == 60

    def test_get_sensitivity_score_restricted(self, service):
        """Test sensitivity score for restricted data."""
        assert service._get_sensitivity_score('restricted') == 80

    def test_get_sensitivity_score_highly_restricted(self, service):
        """Test sensitivity score for highly restricted data."""
        assert service._get_sensitivity_score('highly_restricted') == 100

    def test_get_sensitivity_score_unknown(self, service):
        """Test sensitivity score for unknown level."""
        assert service._get_sensitivity_score('unknown') == 50

    # -------------------------------------------------------------------------
    # Data Volume Risk Tests
    # -------------------------------------------------------------------------

    def test_assess_data_volume_risk_none(self, service):
        """Test volume risk with unknown volume."""
        assert service._assess_data_volume_risk(None) == 20

    def test_assess_data_volume_risk_very_high(self, service):
        """Test volume risk with very high volume."""
        assert service._assess_data_volume_risk(200000) == 100

    def test_assess_data_volume_risk_high(self, service):
        """Test volume risk with high volume."""
        assert service._assess_data_volume_risk(50000) == 80

    def test_assess_data_volume_risk_medium(self, service):
        """Test volume risk with medium volume."""
        assert service._assess_data_volume_risk(5000) == 60

    def test_assess_data_volume_risk_low(self, service):
        """Test volume risk with low volume."""
        assert service._assess_data_volume_risk(500) == 40

    def test_assess_data_volume_risk_very_low(self, service):
        """Test volume risk with very low volume."""
        assert service._assess_data_volume_risk(50) == 20

    # -------------------------------------------------------------------------
    # Consent Processing Tests
    # -------------------------------------------------------------------------

    def test_process_consent_request(self, service):
        """Test consent request processing."""
        with patch('privacy.services.privacy_assessment_service.ConsentRecord') as MockConsent:
            mock_consent = MagicMock()
            MockConsent.return_value = mock_consent

            result = service.process_consent_request(
                data_subject_id='DS-001',
                processing_purposes=['marketing', 'analytics'],
                consent_method='web_form',
                consent_data={
                    'data_subject_type': 'customer',
                    'consent_language': 'en',
                    'country_code': 'US',
                    'legal_basis': 'consent'
                }
            )

            mock_consent.record_consent.assert_called_once()
            mock_consent.save.assert_called_once()
            assert result == mock_consent

    def test_process_consent_request_with_legitimate_interests(self, service):
        """Test consent request with legitimate interests."""
        with patch('privacy.services.privacy_assessment_service.ConsentRecord') as MockConsent:
            mock_consent = MagicMock()
            MockConsent.return_value = mock_consent

            service.process_consent_request(
                data_subject_id='DS-001',
                processing_purposes=['service_delivery'],
                consent_method='contract',
                consent_data={
                    'legal_basis': 'legitimate_interests',
                    'legitimate_interests': 'Service delivery requires data processing'
                }
            )

            assert mock_consent.legitimate_interests == 'Service delivery requires data processing'

    # -------------------------------------------------------------------------
    # Data Subject Rights Tests
    # -------------------------------------------------------------------------

    def test_process_dsr_request(self, service):
        """Test data subject rights request processing."""
        with patch('privacy.services.privacy_assessment_service.DataSubjectRight') as MockDSR:
            mock_dsr = MagicMock()
            MockDSR.return_value = mock_dsr

            result = service.process_data_subject_right_request(
                data_subject_id='DS-001',
                primary_right='access',
                request_description='I want to access my data',
                contact_info={'email': 'test@example.com', 'phone': '123-456-7890'},
                request_data={
                    'data_subject_type': 'customer',
                    'priority': 'high',
                    'source': 'email'
                }
            )

            mock_dsr.submit_request.assert_called_once()
            mock_dsr.save.assert_called_once()
            assert result == mock_dsr

    def test_process_dsr_request_erasure(self, service):
        """Test erasure (right to be forgotten) request."""
        with patch('privacy.services.privacy_assessment_service.DataSubjectRight') as MockDSR:
            mock_dsr = MagicMock()
            MockDSR.return_value = mock_dsr

            service.process_data_subject_right_request(
                data_subject_id='DS-001',
                primary_right='erasure',
                request_description='Please delete all my data',
                contact_info={'email': 'test@example.com'},
                request_data={'priority': 'high'}
            )

            call_kwargs = mock_dsr.submit_request.call_args
            assert call_kwargs is not None

    # -------------------------------------------------------------------------
    # Privacy Compliance Report Tests
    # -------------------------------------------------------------------------

    def test_generate_privacy_compliance_report(self, service):
        """Test privacy compliance report generation."""
        mock_assets = {
            'total_data_assets': 50,
            'compliance_status_distribution': {'compliant': 40, 'non_compliant': 10},
            'high_risk_assets': 5,
            'attention_required': 3,
            'pia_status': {'completion_rate': 85},
            'dpo_review_status': {'completion_rate': 90}
        }
        mock_risk = {'risk_level': 'medium'}
        mock_retention = {'compliant_percentage': 95}
        mock_rights = {'readiness_score': 88}
        mock_maturity = {
            'maturity_score': 75,
            'maturity_level': 'managed'
        }

        with patch.object(service.data_asset_repo, 'get_privacy_compliance_overview', return_value=mock_assets), \
             patch.object(service.data_asset_repo, 'get_data_asset_risk_assessment', return_value=mock_risk), \
             patch.object(service.data_asset_repo, 'get_retention_compliance_report', return_value=mock_retention), \
             patch.object(service.data_asset_repo, 'get_data_subject_rights_readiness', return_value=mock_rights), \
             patch.object(service.data_asset_repo, 'calculate_privacy_maturity_score', return_value=mock_maturity):

            result = service.generate_privacy_compliance_report()

            assert result['report_title'] == 'Privacy Compliance Report'
            assert 'executive_summary' in result
            assert result['executive_summary']['maturity_score'] == 75
            assert 'data_assets' in result
            assert 'recommendations' in result

    # -------------------------------------------------------------------------
    # Compliance Recommendations Tests
    # -------------------------------------------------------------------------

    def test_generate_compliance_recommendations_low_maturity(self, service):
        """Test recommendations for low privacy maturity."""
        assets = {
            'pia_status': {'completion_rate': 90},
            'dpo_review_status': {'completion_rate': 90},
            'attention_required': 0
        }
        maturity = {'maturity_score': 40}

        recommendations = service._generate_compliance_recommendations(assets, maturity)

        assert len(recommendations) > 0
        assert any('governance' in r.lower() for r in recommendations)

    def test_generate_compliance_recommendations_low_pia(self, service):
        """Test recommendations for low PIA completion."""
        assets = {
            'pia_status': {'completion_rate': 50},
            'dpo_review_status': {'completion_rate': 90},
            'attention_required': 0
        }
        maturity = {'maturity_score': 80}

        recommendations = service._generate_compliance_recommendations(assets, maturity)

        assert any('impact assessment' in r.lower() for r in recommendations)

    def test_generate_compliance_recommendations_attention_needed(self, service):
        """Test recommendations when assets need attention."""
        assets = {
            'pia_status': {'completion_rate': 90},
            'dpo_review_status': {'completion_rate': 90},
            'attention_required': 5
        }
        maturity = {'maturity_score': 80}

        recommendations = service._generate_compliance_recommendations(assets, maturity)

        assert any('5' in r and 'asset' in r.lower() for r in recommendations)


# =============================================================================
# Edge Case Tests
# =============================================================================

class TestPrivacyServiceEdgeCases:
    """Edge case tests for privacy service."""

    @pytest.fixture
    def service(self):
        svc = PrivacyAssessmentService()
        svc.data_asset_repo = MagicMock()
        svc.consent_repo = MagicMock()
        svc.dsr_repo = MagicMock()
        return svc

    def test_pia_with_minimal_asset_data(self, service):
        """Test PIA with minimal asset data."""
        mock_asset = MagicMock()
        mock_asset.asset_id = 'DA-001'
        mock_asset.asset_name = 'Minimal Asset'
        mock_asset.sensitivity_level = 'internal'
        mock_asset.estimated_data_subjects = 0
        mock_asset.processing_purposes = []
        mock_asset.international_transfers = []
        mock_asset.recipients = []
        mock_asset.third_party_processors = []
        mock_asset.consent_required = False
        mock_asset.consent_mechanisms = []
        mock_asset.retention_schedule = None
        mock_asset.security_measures = []
        mock_asset.subject_rights_supported = []
        mock_asset.data_subject_rights_compliance_score = 0
        mock_asset.data_categories = []
        mock_asset.data_subject_types = []

        with patch.object(service.data_asset_repo, 'get', return_value=mock_asset):
            result = service.conduct_privacy_impact_assessment(
                asset_id='DA-001',
                assessment_scope={},
                assessor_user_id=uuid.uuid4(),
                assessor_username='test_user'
            )

            assert result is not None
            assert 'overall_risk_level' in result

    def test_control_effectiveness_all_zero(self, service):
        """Test control effectiveness with all controls at zero."""
        mock_asset = MagicMock()
        mock_asset.processing_purposes = []
        mock_asset.retention_schedule = None
        mock_asset.security_measures = []
        mock_asset.consent_required = False
        mock_asset.consent_mechanisms = []
        mock_asset.subject_rights_supported = []
        mock_asset.data_subject_rights_compliance_score = 0

        controls = service._evaluate_privacy_controls(mock_asset)

        assert controls['overall_effectiveness'] < 50

    def test_empty_findings_no_recommendations(self, service):
        """Test that empty findings generate no recommendations."""
        recommendations = service._generate_pia_recommendations([])

        assert recommendations == []

    def test_consent_statistics_placeholder(self, service):
        """Test consent statistics returns placeholder data."""
        stats = service._get_consent_statistics()

        assert stats['total_consents'] == 0
        assert 'active_consents' in stats

    def test_dsr_statistics_placeholder(self, service):
        """Test DSR statistics returns placeholder data."""
        stats = service._get_dsr_statistics()

        assert stats['total_requests'] == 0
        assert 'compliance_rate' in stats
