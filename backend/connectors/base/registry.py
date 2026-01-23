"""
Connector registry for discovering and managing connector types.
"""

from typing import Dict, List, Optional, Type
import logging

from .connector import BaseConnector, ConnectorCategory, ConnectorConfig

logger = logging.getLogger(__name__)


class ConnectorRegistry:
    """
    Registry for connector types.

    Allows registering connector classes and creating instances.
    Provides discovery and metadata for the UI.
    """

    _instance: Optional['ConnectorRegistry'] = None
    _connectors: Dict[str, Type[BaseConnector]] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._connectors = {}
        return cls._instance

    @classmethod
    def register(cls, connector_class: Type[BaseConnector]) -> Type[BaseConnector]:
        """
        Register a connector class.
        Can be used as a decorator:

        @ConnectorRegistry.register
        class MyConnector(BaseConnector):
            ...
        """
        connector_type = connector_class.connector_type
        if connector_type in cls._connectors:
            logger.warning(f"Connector type '{connector_type}' already registered, overwriting")
        cls._connectors[connector_type] = connector_class
        logger.info(f"Registered connector: {connector_type}")
        return connector_class

    @classmethod
    def get(cls, connector_type: str) -> Optional[Type[BaseConnector]]:
        """Get a connector class by type."""
        return cls._connectors.get(connector_type)

    @classmethod
    def create(cls, connector_type: str, config: ConnectorConfig) -> Optional[BaseConnector]:
        """Create a connector instance."""
        connector_class = cls.get(connector_type)
        if connector_class is None:
            logger.error(f"Unknown connector type: {connector_type}")
            return None
        return connector_class(config)

    @classmethod
    def list_all(cls) -> List[Type[BaseConnector]]:
        """List all registered connector classes."""
        return list(cls._connectors.values())

    @classmethod
    def list_by_category(cls, category: ConnectorCategory) -> List[Type[BaseConnector]]:
        """List connector classes by category."""
        return [
            c for c in cls._connectors.values()
            if c.category == category
        ]

    @classmethod
    def get_metadata(cls) -> List[dict]:
        """
        Get metadata for all registered connectors.
        Used by the UI to display available integrations.
        """
        metadata = []
        for connector_class in cls._connectors.values():
            metadata.append({
                "connector_type": connector_class.connector_type,
                "display_name": connector_class.display_name,
                "description": connector_class.description,
                "category": connector_class.category.value,
                "supported_auth_types": connector_class.supported_auth_types,
                "supports_sync": connector_class.supports_sync,
                "supports_webhook": connector_class.supports_webhook,
                "supports_bidirectional": connector_class.supports_bidirectional,
            })
        return metadata

    @classmethod
    def get_categories(cls) -> List[dict]:
        """Get all categories with their connectors."""
        categories = {}
        for connector_class in cls._connectors.values():
            cat = connector_class.category
            if cat not in categories:
                categories[cat] = {
                    "id": cat.value,
                    "name": cat.name.replace("_", " ").title(),
                    "connectors": []
                }
            categories[cat]["connectors"].append({
                "connector_type": connector_class.connector_type,
                "display_name": connector_class.display_name,
            })
        return list(categories.values())

    @classmethod
    def clear(cls):
        """Clear all registered connectors. Used for testing."""
        cls._connectors.clear()


def get_registry() -> ConnectorRegistry:
    """Get the singleton registry instance."""
    return ConnectorRegistry()


# Auto-discovery of connectors
def discover_connectors():
    """
    Discover and register all connectors.
    Import all connector modules to trigger registration.
    """
    from importlib import import_module

    connector_modules = [
        # Cloud Security
        "connectors.cloud_security.wiz",
        "connectors.cloud_security.prisma",
        "connectors.cloud_security.aqua",
        # SAST/DAST
        "connectors.sast_dast.snyk",
        "connectors.sast_dast.veracode",
        "connectors.sast_dast.sonarcloud",
        "connectors.sast_dast.burp",
        "connectors.sast_dast.appscan",
        # Container Security
        "connectors.container.trivy",
        # Vulnerability Scanners
        "connectors.vulnerability.rapid7",
        "connectors.vulnerability.nessus",
        "connectors.vulnerability.qualys",
        # CI/CD Security
        "connectors.cicd.gitlab",
        "connectors.cicd.xray",
        "connectors.cicd.github_security",
        # Identity & Access
        "connectors.identity.active_directory",
        "connectors.identity.intune",
        "connectors.identity.okta",
        # Endpoint Security
        "connectors.endpoint.defender",
        # CRM/GRC
        "connectors.crm.salesforce",
    ]

    for module_name in connector_modules:
        try:
            import_module(module_name)
            logger.debug(f"Loaded connector module: {module_name}")
        except ImportError as e:
            logger.debug(f"Could not load connector module {module_name}: {e}")
