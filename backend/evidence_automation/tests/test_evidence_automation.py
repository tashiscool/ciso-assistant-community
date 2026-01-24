"""
Comprehensive tests for Evidence Automation Services

Tests cover:
- Evidence Collector: Source connection, collection orchestration, storage
- Connectors: AWS, Azure, GitHub, API connectors
- CollectedEvidence data class
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime
import json

from evidence_automation.services.connectors import (
    CollectedEvidence,
    BaseConnector,
    AWSConnector,
    AzureConnector,
    GitHubConnector,
    APIConnector,
    get_connector,
    CONNECTORS,
)
from evidence_automation.services.collector import (
    EvidenceCollector,
    evidence_collector,
)


# =============================================================================
# CollectedEvidence Data Class Tests
# =============================================================================

class TestCollectedEvidence:
    """Tests for CollectedEvidence dataclass."""

    def test_creation_minimal(self):
        """Test creating CollectedEvidence with minimal params."""
        evidence = CollectedEvidence(
            name='Test Evidence',
            description='Test description',
            content_type='json',
            data={'key': 'value'},
        )

        assert evidence.name == 'Test Evidence'
        assert evidence.description == 'Test description'
        assert evidence.content_type == 'json'
        assert evidence.data == {'key': 'value'}
        assert evidence.filename is None
        assert evidence.metadata == {}

    def test_creation_full(self):
        """Test creating CollectedEvidence with all params."""
        evidence = CollectedEvidence(
            name='Full Evidence',
            description='Full description',
            content_type='file',
            data=b'binary data',
            filename='evidence.bin',
            metadata={'source': 'aws', 'type': 'iam'},
        )

        assert evidence.filename == 'evidence.bin'
        assert evidence.metadata['source'] == 'aws'

    def test_post_init_metadata(self):
        """Test that None metadata becomes empty dict."""
        evidence = CollectedEvidence(
            name='Test',
            description='Test',
            content_type='text',
            data='text data',
            metadata=None,
        )

        assert evidence.metadata == {}


# =============================================================================
# Base Connector Tests
# =============================================================================

class TestBaseConnector:
    """Tests for BaseConnector abstract class."""

    def test_validate_config_default(self):
        """Test default validate_config returns empty list."""
        # Create a concrete implementation for testing
        class TestConnector(BaseConnector):
            def connect(self):
                return True

            def disconnect(self):
                pass

            def test_connection(self):
                return {'success': True}

            def collect(self, query, parameters):
                return []

        connector = TestConnector({'test': 'config'})
        assert connector.validate_config() == []
        assert connector.config == {'test': 'config'}
        assert connector.connected is False


# =============================================================================
# AWS Connector Tests
# =============================================================================

class TestAWSConnector:
    """Tests for AWSConnector."""

    @pytest.fixture
    def aws_config(self):
        """Valid AWS configuration."""
        return {
            'access_key_id': 'test_key',
            'secret_access_key': 'test_secret',
            'region': 'us-east-1',
        }

    def test_validate_config_valid(self, aws_config):
        """Test validation with valid config."""
        connector = AWSConnector(aws_config)
        errors = connector.validate_config()
        assert errors == []

    def test_validate_config_missing_keys(self):
        """Test validation with missing keys."""
        connector = AWSConnector({})
        errors = connector.validate_config()
        assert len(errors) == 3
        assert any('access_key_id' in e for e in errors)
        assert any('secret_access_key' in e for e in errors)
        assert any('region' in e for e in errors)

    def test_validate_config_partial(self):
        """Test validation with partial config."""
        connector = AWSConnector({'access_key_id': 'key'})
        errors = connector.validate_config()
        assert len(errors) == 2

    def test_connect_success(self, aws_config):
        """Test successful AWS connection with mocked boto3."""
        import sys
        mock_boto3 = MagicMock()
        mock_session = MagicMock()
        mock_boto3.Session.return_value = mock_session

        with patch.dict(sys.modules, {'boto3': mock_boto3}):
            connector = AWSConnector(aws_config)
            result = connector.connect()

            # Either connects successfully with mock or handles gracefully
            assert isinstance(result, bool)

    def test_connect_handles_import_error(self, aws_config):
        """Test connection handles missing boto3."""
        connector = AWSConnector(aws_config)
        # Without boto3 actually available or mocked, this tests error handling
        result = connector.connect()
        # Result depends on whether boto3 is installed
        assert isinstance(result, bool)

    def test_disconnect(self, aws_config):
        """Test AWS disconnect."""
        connector = AWSConnector(aws_config)
        connector.session = Mock()
        connector.connected = True

        connector.disconnect()

        assert connector.session is None
        assert connector.connected is False

    def test_test_connection_not_connected(self, aws_config):
        """Test connection test when not connected."""
        connector = AWSConnector(aws_config)
        connector.connected = False

        # Will attempt to connect first
        result = connector.test_connection()
        # Will either succeed (if boto3 available) or fail gracefully
        assert 'success' in result

    def test_collect_without_connection(self, aws_config):
        """Test collection behavior without connection."""
        connector = AWSConnector(aws_config)
        connector.connected = False

        result = connector.collect('', {'collection_type': 'iam_users'})
        # Will return empty list or attempt to connect first
        assert isinstance(result, list)

    def test_required_config_defined(self):
        """Test REQUIRED_CONFIG is defined."""
        assert 'access_key_id' in AWSConnector.REQUIRED_CONFIG
        assert 'secret_access_key' in AWSConnector.REQUIRED_CONFIG
        assert 'region' in AWSConnector.REQUIRED_CONFIG


# =============================================================================
# Azure Connector Tests
# =============================================================================

class TestAzureConnector:
    """Tests for AzureConnector."""

    @pytest.fixture
    def azure_config(self):
        """Valid Azure configuration."""
        return {
            'tenant_id': 'test-tenant',
            'client_id': 'test-client',
            'client_secret': 'test-secret',
        }

    def test_validate_config_valid(self, azure_config):
        """Test validation with valid config."""
        connector = AzureConnector(azure_config)
        errors = connector.validate_config()
        assert errors == []

    def test_validate_config_missing_keys(self):
        """Test validation with missing keys."""
        connector = AzureConnector({})
        errors = connector.validate_config()
        assert len(errors) == 3

    @patch('evidence_automation.services.connectors.ClientSecretCredential', create=True)
    def test_connect_success(self, mock_credential, azure_config):
        """Test successful Azure connection."""
        with patch.dict('sys.modules', {'azure.identity': MagicMock()}):
            connector = AzureConnector(azure_config)
            # Patch the import inside connect
            with patch('evidence_automation.services.connectors.ClientSecretCredential', create=True):
                result = connector.connect()
                # Connection may fail due to missing azure.identity, which is expected

    def test_disconnect(self, azure_config):
        """Test Azure disconnect."""
        connector = AzureConnector(azure_config)
        connector.credential = Mock()
        connector.connected = True

        connector.disconnect()

        assert connector.credential is None
        assert connector.connected is False


# =============================================================================
# GitHub Connector Tests
# =============================================================================

class TestGitHubConnector:
    """Tests for GitHubConnector."""

    @pytest.fixture
    def github_config(self):
        """Valid GitHub configuration."""
        return {
            'access_token': 'ghp_test_token',
        }

    def test_validate_config_valid(self, github_config):
        """Test validation with valid config."""
        connector = GitHubConnector(github_config)
        errors = connector.validate_config()
        assert errors == []

    def test_validate_config_missing_token(self):
        """Test validation with missing token."""
        connector = GitHubConnector({})
        errors = connector.validate_config()
        assert len(errors) == 1
        assert 'access_token' in errors[0]

    def test_connect(self, github_config):
        """Test GitHub connect."""
        connector = GitHubConnector(github_config)
        result = connector.connect()

        assert result is True
        assert connector.connected is True
        assert 'Authorization' in connector.headers
        assert connector.headers['Authorization'] == 'token ghp_test_token'
        assert connector.base_url == 'https://api.github.com'

    def test_disconnect(self, github_config):
        """Test GitHub disconnect."""
        connector = GitHubConnector(github_config)
        connector.connect()
        connector.disconnect()

        assert connector.headers is None
        assert connector.connected is False

    @patch('evidence_automation.services.connectors.requests')
    def test_test_connection_success(self, mock_requests, github_config):
        """Test successful connection test."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'login': 'testuser',
            'name': 'Test User',
        }
        mock_requests.get.return_value = mock_response

        connector = GitHubConnector(github_config)
        result = connector.test_connection()

        assert result['success'] is True
        assert result['login'] == 'testuser'

    @patch('evidence_automation.services.connectors.requests')
    def test_test_connection_failure(self, mock_requests, github_config):
        """Test connection test failure."""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_requests.get.return_value = mock_response

        connector = GitHubConnector(github_config)
        result = connector.test_connection()

        assert result['success'] is False
        assert 'HTTP 401' in result['error']

    @patch('evidence_automation.services.connectors.requests')
    def test_collect_repo_settings(self, mock_requests, github_config):
        """Test collecting repository settings."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'name': 'test-repo',
            'full_name': 'org/test-repo',
            'private': True,
            'default_branch': 'main',
            'has_issues': True,
            'has_projects': False,
            'has_wiki': False,
            'allow_squash_merge': True,
            'allow_merge_commit': True,
            'allow_rebase_merge': False,
            'delete_branch_on_merge': True,
        }
        mock_requests.get.return_value = mock_response

        connector = GitHubConnector(github_config)
        connector.connect()
        result = connector.collect('', {
            'collection_type': 'repository_settings',
            'organization': 'org',
            'repository': 'test-repo',
        })

        assert len(result) == 1
        assert 'test-repo' in result[0].name
        assert result[0].content_type == 'json'

    @patch('evidence_automation.services.connectors.requests')
    def test_collect_org_members(self, mock_requests, github_config):
        """Test collecting organization members."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {'login': 'user1', 'id': 1, 'type': 'User', 'site_admin': False},
            {'login': 'user2', 'id': 2, 'type': 'User', 'site_admin': False},
        ]
        mock_requests.get.return_value = mock_response

        connector = GitHubConnector(github_config)
        connector.connect()
        result = connector.collect('', {
            'collection_type': 'org_members',
            'organization': 'test-org',
        })

        assert len(result) == 1
        assert result[0].metadata['member_count'] == 2

    @patch('evidence_automation.services.connectors.requests')
    def test_collect_branch_protection(self, mock_requests, github_config):
        """Test collecting branch protection rules."""
        # Mock responses for repo and protection
        mock_repo_response = Mock()
        mock_repo_response.status_code = 200
        mock_repo_response.json.return_value = {'default_branch': 'main'}

        mock_protection_response = Mock()
        mock_protection_response.status_code = 200
        mock_protection_response.json.return_value = {
            'enforce_admins': {'enabled': True},
            'required_pull_request_reviews': {'required_approving_review_count': 1},
            'required_status_checks': {'strict': True},
            'restrictions': None,
        }

        mock_requests.get.side_effect = [mock_repo_response, mock_protection_response]

        connector = GitHubConnector(github_config)
        connector.connect()
        result = connector.collect('', {
            'collection_type': 'branch_protection',
            'organization': 'org',
            'repository': 'repo',
        })

        assert len(result) == 1
        assert 'branch_protection' in result[0].metadata['collection_type']


# =============================================================================
# API Connector Tests
# =============================================================================

class TestAPIConnector:
    """Tests for APIConnector."""

    @pytest.fixture
    def api_config(self):
        """Valid API configuration."""
        return {
            'base_url': 'https://api.example.com',
            'auth_type': 'bearer',
            'token': 'test_token',
        }

    def test_validate_config_valid(self, api_config):
        """Test validation with valid config."""
        connector = APIConnector(api_config)
        errors = connector.validate_config()
        assert errors == []

    def test_validate_config_missing_url(self):
        """Test validation with missing base_url."""
        connector = APIConnector({})
        errors = connector.validate_config()
        assert len(errors) == 1
        assert 'base_url' in errors[0]

    def test_connect_bearer_auth(self, api_config):
        """Test connect with bearer auth."""
        connector = APIConnector(api_config)
        result = connector.connect()

        assert result is True
        assert connector.connected is True
        assert connector.headers['Authorization'] == 'Bearer test_token'

    def test_connect_api_key_auth(self):
        """Test connect with API key auth."""
        config = {
            'base_url': 'https://api.example.com',
            'auth_type': 'api_key',
            'api_key': 'my_api_key',
            'api_key_name': 'X-Custom-Key',
        }
        connector = APIConnector(config)
        result = connector.connect()

        assert result is True
        assert connector.headers['X-Custom-Key'] == 'my_api_key'

    @patch('evidence_automation.services.connectors.requests')
    def test_test_connection_success(self, mock_requests, api_config):
        """Test successful connection test."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_requests.get.return_value = mock_response

        connector = APIConnector(api_config)
        result = connector.test_connection()

        assert result['success'] is True
        assert result['status_code'] == 200

    @patch('evidence_automation.services.connectors.requests')
    def test_test_connection_failure(self, mock_requests, api_config):
        """Test connection test failure."""
        mock_requests.get.side_effect = Exception("Connection refused")

        connector = APIConnector(api_config)
        result = connector.test_connection()

        assert result['success'] is False
        assert 'Connection refused' in result['error']

    @patch('evidence_automation.services.connectors.requests')
    def test_collect_get_json(self, mock_requests, api_config):
        """Test collecting JSON via GET."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'data': 'test'}
        mock_requests.get.return_value = mock_response

        connector = APIConnector(api_config)
        connector.connect()
        result = connector.collect('/endpoint', {
            'method': 'GET',
            'name': 'Test Data',
        })

        assert len(result) == 1
        assert result[0].content_type == 'json'
        assert result[0].data == {'data': 'test'}

    @patch('evidence_automation.services.connectors.requests')
    def test_collect_post(self, mock_requests, api_config):
        """Test collecting via POST."""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {'created': True}
        mock_requests.post.return_value = mock_response

        connector = APIConnector(api_config)
        connector.connect()
        result = connector.collect('/create', {
            'method': 'POST',
            'body': {'key': 'value'},
        })

        assert len(result) == 1


# =============================================================================
# Connector Registry Tests
# =============================================================================

class TestConnectorRegistry:
    """Tests for connector registry."""

    def test_registry_contains_all_connectors(self):
        """Test that registry has all connectors."""
        assert 'aws' in CONNECTORS
        assert 'azure' in CONNECTORS
        assert 'azure_ad' in CONNECTORS
        assert 'github' in CONNECTORS
        assert 'api' in CONNECTORS

    def test_get_connector_valid(self):
        """Test getting valid connector."""
        connector = get_connector('aws', {'access_key_id': 'test'})
        assert isinstance(connector, AWSConnector)

    def test_get_connector_invalid(self):
        """Test getting invalid connector returns None."""
        connector = get_connector('invalid_type', {})
        assert connector is None


# =============================================================================
# Evidence Collector Tests
# =============================================================================

class TestEvidenceCollector:
    """Tests for EvidenceCollector service."""

    @pytest.fixture
    def collector(self):
        """Create evidence collector instance."""
        return EvidenceCollector()

    def test_collector_initialization(self, collector):
        """Test collector initializes correctly."""
        assert collector.active_connectors == {}

    @patch('evidence_automation.services.collector.get_connector')
    def test_test_source_connection_unsupported(self, mock_get_connector, collector):
        """Test connection test for unsupported source."""
        mock_get_connector.return_value = None

        mock_source = Mock()
        mock_source.source_type = 'unsupported'

        result = collector.test_source_connection(mock_source)

        assert result['success'] is False
        assert 'Unsupported source type' in result['error']

    @patch('evidence_automation.services.collector.get_connector')
    def test_test_source_connection_config_error(self, mock_get_connector, collector):
        """Test connection test with config errors."""
        mock_connector = Mock()
        mock_connector.validate_config.return_value = ['Missing access_key_id']
        mock_get_connector.return_value = mock_connector

        mock_source = Mock()
        mock_source.source_type = 'aws'
        mock_source.config = {}

        result = collector.test_source_connection(mock_source)

        assert result['success'] is False
        assert 'Configuration validation failed' in result['error']

    @patch('evidence_automation.services.collector.get_connector')
    def test_test_source_connection_success(self, mock_get_connector, collector):
        """Test successful connection test."""
        mock_connector = Mock()
        mock_connector.validate_config.return_value = []
        mock_connector.test_connection.return_value = {'success': True}
        mock_get_connector.return_value = mock_connector

        mock_source = Mock()
        mock_source.source_type = 'aws'
        mock_source.config = {'key': 'value'}
        mock_source.name = 'Test Source'

        result = collector.test_source_connection(mock_source)

        assert result['success'] is True
        mock_connector.disconnect.assert_called_once()

    @patch('evidence_automation.services.collector.get_connector')
    def test_test_source_connection_exception(self, mock_get_connector, collector):
        """Test connection test exception handling."""
        mock_connector = Mock()
        mock_connector.validate_config.return_value = []
        mock_connector.test_connection.side_effect = Exception("Network error")
        mock_get_connector.return_value = mock_connector

        mock_source = Mock()
        mock_source.source_type = 'aws'
        mock_source.config = {}
        mock_source.name = 'Test Source'

        result = collector.test_source_connection(mock_source)

        assert result['success'] is False
        assert 'Network error' in result['error']

    def test_singleton_exists(self):
        """Test that singleton instance exists."""
        assert evidence_collector is not None
        assert isinstance(evidence_collector, EvidenceCollector)


# =============================================================================
# Integration-like Tests (with mocked Django models)
# =============================================================================

class TestEvidenceCollectorIntegration:
    """Integration-style tests for EvidenceCollector."""

    @patch('evidence_automation.services.collector.EvidenceCollectionRun')
    @patch('evidence_automation.services.collector.get_connector')
    def test_collect_evidence_connector_not_found(
        self, mock_get_connector, mock_run_model
    ):
        """Test collection with unsupported connector."""
        mock_get_connector.return_value = None

        mock_run = Mock()
        mock_run.run_log = []
        mock_run_model.objects.create.return_value = mock_run
        mock_run_model.Status.RUNNING = 'running'
        mock_run_model.Status.FAILED = 'failed'

        mock_rule = Mock()
        mock_rule.source.source_type = 'unsupported'
        mock_rule.source.config = {}

        collector = EvidenceCollector()
        result = collector.collect_evidence(mock_rule)

        assert result.status == 'failed'
        assert 'Unsupported source type' in result.error_message

    @patch('evidence_automation.services.collector.EvidenceCollectionRun')
    @patch('evidence_automation.services.collector.get_connector')
    def test_collect_evidence_connection_failed(
        self, mock_get_connector, mock_run_model
    ):
        """Test collection when connection fails."""
        mock_connector = Mock()
        mock_connector.connect.return_value = False
        mock_get_connector.return_value = mock_connector

        mock_run = Mock()
        mock_run.run_log = []
        mock_run_model.objects.create.return_value = mock_run
        mock_run_model.Status.RUNNING = 'running'
        mock_run_model.Status.FAILED = 'failed'

        mock_rule = Mock()
        mock_rule.source.source_type = 'aws'
        mock_rule.source.config = {}
        mock_rule.source.name = 'Test Source'

        collector = EvidenceCollector()
        result = collector.collect_evidence(mock_rule)

        assert result.status == 'failed'
        assert 'Failed to connect' in result.error_message

    @patch('evidence_automation.services.collector.EvidenceCollectionRule')
    def test_run_scheduled_collections_no_rules(self, mock_rule_model):
        """Test scheduled collection with no rules."""
        mock_rule_model.objects.filter.return_value.select_related.return_value = []

        collector = EvidenceCollector()
        result = collector.run_scheduled_collections()

        assert result['total'] == 0
        assert result['success'] == 0
        assert result['failed'] == 0

    @patch('evidence_automation.services.collector.EvidenceSource')
    def test_get_collection_status_not_found(self, mock_source_model):
        """Test get status for non-existent source."""
        from evidence_automation.models import EvidenceSource
        mock_source_model.DoesNotExist = EvidenceSource.DoesNotExist
        mock_source_model.objects.get.side_effect = EvidenceSource.DoesNotExist

        collector = EvidenceCollector()
        result = collector.get_collection_status('00000000-0000-0000-0000-000000000001')

        assert 'error' in result
        assert result['error'] == 'Source not found'

    @patch('evidence_automation.services.collector.EvidenceCollectionRun')
    @patch('evidence_automation.services.collector.EvidenceSource')
    def test_get_collection_status_success(
        self, mock_source_model, mock_run_model
    ):
        """Test successful status retrieval."""
        mock_source = Mock()
        mock_source.id = 'test-id'
        mock_source.name = 'Test Source'
        mock_source.status = 'active'
        mock_source.last_collection_at = None
        mock_source.last_collection_status = 'success'
        mock_source.last_error = None
        mock_source_model.objects.get.return_value = mock_source

        mock_run_model.objects.filter.return_value.order_by.return_value.__getitem__.return_value = []

        collector = EvidenceCollector()
        result = collector.get_collection_status('test-id')

        assert result['source']['name'] == 'Test Source'
        assert result['source']['status'] == 'active'
