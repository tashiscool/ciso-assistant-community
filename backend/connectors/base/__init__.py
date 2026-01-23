"""
Base connector module - core interfaces and utilities.
"""

from .connector import (
    BaseConnector,
    ConnectorConfig,
    ConnectorStatus,
    ConnectorResult,
    ConnectorError,
)
from .registry import ConnectorRegistry, get_registry
from .auth import AuthProvider, OAuth2Provider, APIKeyProvider, ServiceAccountProvider
from .scheduler import ConnectorScheduler

__all__ = [
    'BaseConnector',
    'ConnectorConfig',
    'ConnectorStatus',
    'ConnectorResult',
    'ConnectorError',
    'ConnectorRegistry',
    'get_registry',
    'AuthProvider',
    'OAuth2Provider',
    'APIKeyProvider',
    'ServiceAccountProvider',
    'ConnectorScheduler',
]
