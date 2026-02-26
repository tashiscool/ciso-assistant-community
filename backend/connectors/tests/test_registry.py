"""Runtime tests for connector registry behavior."""

from connectors.base.connector import (
    BaseConnector,
    ConnectorCategory,
    ConnectorConfig,
    ConnectorResult,
)
from connectors.base.registry import ConnectorRegistry


class DummyRegistryConnector(BaseConnector[dict]):
    connector_type = "dummy_registry_connector"
    display_name = "Dummy Registry Connector"
    description = "Connector used for registry runtime tests."
    category = ConnectorCategory.SAST_DAST
    supported_auth_types = ["none"]

    async def validate_config(self) -> ConnectorResult:
        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        return ConnectorResult(success=True)

    async def authenticate(self) -> ConnectorResult:
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        return ConnectorResult(success=True, data=[])

    async def transform_data(self, raw_data):
        return []


def test_registry_entries_survive_singleton_initialization():
    """Metadata registered before instance creation must not be wiped by __new__."""
    ConnectorRegistry.clear()
    ConnectorRegistry._instance = None
    ConnectorRegistry.register(DummyRegistryConnector)

    metadata_before_instance = ConnectorRegistry.get_metadata()
    assert {item["connector_type"] for item in metadata_before_instance} == {
        "dummy_registry_connector"
    }

    registry = ConnectorRegistry()
    metadata_after_instance = registry.get_metadata()
    connector_types = {item["connector_type"] for item in metadata_after_instance}

    assert "dummy_registry_connector" in connector_types
    assert registry.create(
        "dummy_registry_connector",
        ConnectorConfig(connector_type="dummy_registry_connector", name="dummy"),
    )
