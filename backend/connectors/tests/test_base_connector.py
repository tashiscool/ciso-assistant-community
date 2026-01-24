"""
Tests for base connector classes.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio

# Helper to run async functions synchronously
def run_async(coro):
    """Run an async function synchronously."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

from connectors.base.connector import (
    BaseConnector,
    ConnectorConfig,
    ConnectorResult,
    ConnectorStatus,
    ConnectorCategory,
    ConnectorError,
    AuthenticationError,
    ConnectionError,
    RateLimitError,
    ValidationError,
)


class TestConnectorStatus:
    """Tests for ConnectorStatus enum."""

    def test_status_values(self):
        assert ConnectorStatus.UNCONFIGURED.value == "unconfigured"
        assert ConnectorStatus.CONFIGURED.value == "configured"
        assert ConnectorStatus.CONNECTED.value == "connected"
        assert ConnectorStatus.SYNCING.value == "syncing"
        assert ConnectorStatus.ERROR.value == "error"
        assert ConnectorStatus.DISABLED.value == "disabled"


class TestConnectorCategory:
    """Tests for ConnectorCategory enum."""

    def test_category_values(self):
        assert ConnectorCategory.CLOUD_SECURITY.value == "cloud_security"
        assert ConnectorCategory.SAST_DAST.value == "sast_dast"
        assert ConnectorCategory.VULNERABILITY.value == "vulnerability"
        assert ConnectorCategory.IDENTITY.value == "identity"
        assert ConnectorCategory.CICD.value == "cicd"
        assert ConnectorCategory.ENDPOINT.value == "endpoint"
        assert ConnectorCategory.CRM_GRC.value == "crm_grc"
        assert ConnectorCategory.CONTAINER.value == "container"


class TestConnectorConfig:
    """Tests for ConnectorConfig dataclass."""

    def test_config_creation_minimal(self):
        config = ConnectorConfig(
            connector_type="test",
            name="Test Connector",
        )
        assert config.connector_type == "test"
        assert config.name == "Test Connector"
        assert config.enabled is True
        assert config.auth_type == "api_key"
        assert config.timeout_seconds == 30

    def test_config_creation_full(self):
        config = ConnectorConfig(
            connector_type="wiz",
            name="Wiz Production",
            enabled=True,
            auth_type="oauth2",
            credentials={"client_id": "xxx", "client_secret": "yyy"},
            base_url="https://api.wiz.io",
            timeout_seconds=60,
            max_retries=5,
            sync_interval_minutes=30,
            sync_on_startup=True,
            field_mappings={"severity": "risk_level"},
            include_filters={"project": "main"},
            exclude_filters={"status": "resolved"},
            extra_settings={"custom": "value"},
        )
        assert config.connector_type == "wiz"
        assert config.auth_type == "oauth2"
        assert config.credentials["client_id"] == "xxx"
        assert config.timeout_seconds == 60
        assert config.sync_on_startup is True

    def test_config_defaults(self):
        config = ConnectorConfig(
            connector_type="test",
            name="Test",
        )
        assert config.credentials == {}
        assert config.field_mappings == {}
        assert config.include_filters == {}
        assert config.exclude_filters == {}
        assert config.extra_settings == {}


class TestConnectorResult:
    """Tests for ConnectorResult dataclass."""

    def test_result_creation_success(self):
        result = ConnectorResult(
            success=True,
            data=[{"id": 1}, {"id": 2}],
            items_processed=2,
            items_created=2,
        )
        assert result.success is True
        assert len(result.data) == 2
        assert result.items_processed == 2
        assert result.error_message is None

    def test_result_creation_failure(self):
        result = ConnectorResult(
            success=False,
            error_message="Authentication failed",
            error_code="AUTH_ERROR",
        )
        assert result.success is False
        assert result.error_message == "Authentication failed"
        assert result.error_code == "AUTH_ERROR"

    def test_result_duration_calculation(self):
        start = datetime(2024, 1, 1, 12, 0, 0)
        end = datetime(2024, 1, 1, 12, 0, 30)
        result = ConnectorResult(
            success=True,
            started_at=start,
            completed_at=end,
        )
        assert result.duration_seconds == 30.0

    def test_result_duration_none_when_incomplete(self):
        result = ConnectorResult(
            success=True,
            started_at=datetime.now(),
        )
        assert result.duration_seconds is None


class TestConnectorError:
    """Tests for ConnectorError and subclasses."""

    def test_connector_error(self):
        error = ConnectorError(
            message="Test error",
            code="TEST_ERROR",
            details={"field": "value"},
            recoverable=True,
        )
        assert str(error) == "Test error"
        assert error.message == "Test error"
        assert error.code == "TEST_ERROR"
        assert error.details == {"field": "value"}
        assert error.recoverable is True

    def test_connector_error_defaults(self):
        error = ConnectorError("Simple error")
        assert error.code == "CONNECTOR_ERROR"
        assert error.details == {}
        assert error.recoverable is True

    def test_authentication_error(self):
        error = AuthenticationError(
            "Invalid API key",
            details={"key_prefix": "sk_..."},
        )
        assert error.code == "AUTH_ERROR"
        assert error.recoverable is True
        assert "key_prefix" in error.details

    def test_connection_error(self):
        error = ConnectionError("Connection timeout")
        assert error.code == "CONNECTION_ERROR"
        assert error.recoverable is True

    def test_rate_limit_error(self):
        error = RateLimitError(
            "Rate limit exceeded",
            retry_after_seconds=60,
            details={"limit": 100},
        )
        assert error.code == "RATE_LIMIT_ERROR"
        assert error.retry_after_seconds == 60
        assert error.details["retry_after_seconds"] == 60
        assert error.details["limit"] == 100

    def test_validation_error(self):
        error = ValidationError(
            "Invalid field value",
            field="severity",
            details={"allowed": ["low", "medium", "high"]},
        )
        assert error.code == "VALIDATION_ERROR"
        assert error.recoverable is False
        assert error.details["field"] == "severity"


class ConcreteConnector(BaseConnector):
    """Concrete implementation for testing."""

    connector_type = "test"
    display_name = "Test Connector"
    description = "A test connector"
    category = ConnectorCategory.CLOUD_SECURITY

    async def validate_config(self):
        if not self.config.name:
            return ConnectorResult(success=False, error_message="Name required")
        return ConnectorResult(success=True)

    async def test_connection(self):
        return ConnectorResult(success=True)

    async def authenticate(self):
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs):
        return ConnectorResult(
            success=True,
            data=[{"id": 1, "name": "Finding 1"}],
        )

    async def transform_data(self, raw_data):
        return [{"transformed": item} for item in raw_data]


class TestBaseConnector:
    """Tests for BaseConnector abstract class."""

    @pytest.fixture
    def config(self):
        return ConnectorConfig(
            connector_type="test",
            name="Test Instance",
        )

    @pytest.fixture
    def connector(self, config):
        return ConcreteConnector(config)

    def test_init(self, connector, config):
        assert connector.config == config
        assert connector._status == ConnectorStatus.UNCONFIGURED
        assert connector._last_sync is None
        assert connector._last_error is None
        assert connector._client is None

    def test_properties(self, connector):
        assert connector.status == ConnectorStatus.UNCONFIGURED
        assert connector.last_sync is None
        assert connector.last_error is None

    def test_class_attributes(self):
        assert ConcreteConnector.connector_type == "test"
        assert ConcreteConnector.display_name == "Test Connector"
        assert ConcreteConnector.category == ConnectorCategory.CLOUD_SECURITY

    def test_validate_config_success(self, connector):
        result = run_async(connector.validate_config())
        assert result.success is True

    def test_validate_config_failure(self, config):
        config.name = ""
        connector = ConcreteConnector(config)
        result = run_async(connector.validate_config())
        assert result.success is False

    def test_test_connection(self, connector):
        result = run_async(connector.test_connection())
        assert result.success is True

    def test_authenticate(self, connector):
        result = run_async(connector.authenticate())
        assert result.success is True

    def test_fetch_data(self, connector):
        result = run_async(connector.fetch_data())
        assert result.success is True
        assert len(result.data) == 1

    def test_transform_data(self, connector):
        raw_data = [{"id": 1}, {"id": 2}]
        result = run_async(connector.transform_data(raw_data))
        assert len(result) == 2
        assert all("transformed" in item for item in result)

    def test_sync_success(self, connector):
        result = run_async(connector.sync())

        assert result.success is True
        assert result.items_processed == 1
        assert connector.status == ConnectorStatus.CONNECTED
        assert connector.last_sync is not None
        assert connector.last_error is None

    def test_sync_auth_failure(self, connector):
        async def failing_auth():
            return ConnectorResult(
                success=False,
                error_message="Auth failed",
                error_code="AUTH_ERROR",
            )
        connector.authenticate = failing_auth

        result = run_async(connector.sync())

        assert result.success is False
        assert "Auth failed" in result.error_message
        assert connector.status == ConnectorStatus.ERROR
        assert connector.last_error is not None

    def test_sync_fetch_failure(self, connector):
        async def failing_fetch(**kwargs):
            return ConnectorResult(
                success=False,
                error_message="Fetch failed",
            )
        connector.fetch_data = failing_fetch

        result = run_async(connector.sync())

        assert result.success is False
        assert "Fetch failed" in result.error_message
        assert connector.status == ConnectorStatus.ERROR

    def test_sync_connector_error(self, connector):
        async def error_auth():
            raise ConnectorError("Connector error", code="TEST_ERROR")
        connector.authenticate = error_auth

        result = run_async(connector.sync())

        assert result.success is False
        assert result.error_code == "TEST_ERROR"
        assert connector.status == ConnectorStatus.ERROR

    def test_sync_unexpected_error(self, connector):
        async def unexpected_error():
            raise Exception("Unexpected error")
        connector.authenticate = unexpected_error

        result = run_async(connector.sync())

        assert result.success is False
        assert result.error_code == "UNEXPECTED_ERROR"
        assert connector.status == ConnectorStatus.ERROR

    def test_disconnect(self, connector):
        connector._client = MagicMock()
        connector._status = ConnectorStatus.CONNECTED

        run_async(connector.disconnect())

        assert connector._client is None
        assert connector.status == ConnectorStatus.CONFIGURED

    def test_get_config_schema(self, connector):
        schema = connector.get_config_schema()

        assert schema["type"] == "object"
        assert "properties" in schema
        assert "name" in schema["properties"]
        assert "enabled" in schema["properties"]
        assert "name" in schema["required"]

    def test_get_status_info(self, connector):
        info = connector.get_status_info()

        assert info["connector_type"] == "test"
        assert info["display_name"] == "Test Connector"
        assert info["status"] == "unconfigured"
        assert info["last_sync"] is None
        assert info["config_name"] == "Test Instance"
        assert info["enabled"] is True

    def test_get_status_info_with_sync(self, connector):
        connector._status = ConnectorStatus.CONNECTED
        connector._last_sync = datetime(2024, 1, 1, 12, 0, 0)

        info = connector.get_status_info()

        assert info["status"] == "connected"
        assert info["last_sync"] == "2024-01-01T12:00:00"


class TestConnectorWithFailingAuth:
    """Tests for connector behavior with authentication failures."""

    @pytest.fixture
    def failing_connector(self):
        class FailingAuthConnector(ConcreteConnector):
            async def authenticate(self):
                raise AuthenticationError("Invalid credentials")

        config = ConnectorConfig(
            connector_type="test",
            name="Failing",
        )
        return FailingAuthConnector(config)

    def test_sync_handles_auth_exception(self, failing_connector):
        result = run_async(failing_connector.sync())

        assert result.success is False
        assert failing_connector.status == ConnectorStatus.ERROR


class TestConnectorWithRateLimit:
    """Tests for connector behavior with rate limiting."""

    @pytest.fixture
    def rate_limited_connector(self):
        class RateLimitedConnector(ConcreteConnector):
            async def fetch_data(self, **kwargs):
                raise RateLimitError("Too many requests", retry_after_seconds=30)

        config = ConnectorConfig(
            connector_type="test",
            name="Rate Limited",
        )
        return RateLimitedConnector(config)

    def test_sync_handles_rate_limit(self, rate_limited_connector):
        result = run_async(rate_limited_connector.sync())

        assert result.success is False
        assert result.error_code == "RATE_LIMIT_ERROR"
