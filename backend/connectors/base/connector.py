"""
Base connector interface for all security tool integrations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional, TypeVar, Generic
import logging

logger = logging.getLogger(__name__)


class ConnectorStatus(Enum):
    """Status of a connector instance."""
    UNCONFIGURED = "unconfigured"
    CONFIGURED = "configured"
    CONNECTED = "connected"
    SYNCING = "syncing"
    ERROR = "error"
    DISABLED = "disabled"


class ConnectorCategory(Enum):
    """Categories of security tool connectors."""
    CLOUD_SECURITY = "cloud_security"
    SAST_DAST = "sast_dast"
    VULNERABILITY = "vulnerability"
    IDENTITY = "identity"
    CICD = "cicd"
    ENDPOINT = "endpoint"
    CRM_GRC = "crm_grc"
    CONTAINER = "container"


@dataclass
class ConnectorConfig:
    """Configuration for a connector instance."""
    connector_type: str
    name: str
    enabled: bool = True

    # Authentication
    auth_type: str = "api_key"  # api_key, oauth2, service_account
    credentials: dict = field(default_factory=dict)

    # Connection settings
    base_url: Optional[str] = None
    timeout_seconds: int = 30
    max_retries: int = 3

    # Sync settings
    sync_interval_minutes: int = 60
    sync_on_startup: bool = False

    # Mapping settings
    field_mappings: dict = field(default_factory=dict)

    # Filters
    include_filters: dict = field(default_factory=dict)
    exclude_filters: dict = field(default_factory=dict)

    # Additional connector-specific settings
    extra_settings: dict = field(default_factory=dict)


@dataclass
class ConnectorResult:
    """Result of a connector operation."""
    success: bool
    data: Optional[Any] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    items_processed: int = 0
    items_created: int = 0
    items_updated: int = 0
    items_failed: int = 0
    warnings: list = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @property
    def duration_seconds(self) -> Optional[float]:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


class ConnectorError(Exception):
    """Base exception for connector errors."""

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        details: Optional[dict] = None,
        recoverable: bool = True
    ):
        super().__init__(message)
        self.message = message
        self.code = code or "CONNECTOR_ERROR"
        self.details = details or {}
        self.recoverable = recoverable


class AuthenticationError(ConnectorError):
    """Authentication failed."""

    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(
            message=message,
            code="AUTH_ERROR",
            details=details,
            recoverable=True
        )


class ConnectionError(ConnectorError):
    """Connection to the external service failed."""

    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(
            message=message,
            code="CONNECTION_ERROR",
            details=details,
            recoverable=True
        )


class RateLimitError(ConnectorError):
    """Rate limit exceeded."""

    def __init__(
        self,
        message: str,
        retry_after_seconds: Optional[int] = None,
        details: Optional[dict] = None
    ):
        super().__init__(
            message=message,
            code="RATE_LIMIT_ERROR",
            details={**(details or {}), "retry_after_seconds": retry_after_seconds},
            recoverable=True
        )
        self.retry_after_seconds = retry_after_seconds


class ValidationError(ConnectorError):
    """Data validation failed."""

    def __init__(self, message: str, field: Optional[str] = None, details: Optional[dict] = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            details={**(details or {}), "field": field},
            recoverable=False
        )


T = TypeVar('T')


class BaseConnector(ABC, Generic[T]):
    """
    Abstract base class for all security tool connectors.

    Each connector implementation should:
    1. Implement the abstract methods
    2. Define the data type T it returns
    3. Handle authentication and rate limiting
    4. Map external data to CISO Assistant models
    """

    # Class attributes to be overridden
    connector_type: str = "base"
    display_name: str = "Base Connector"
    description: str = "Base connector interface"
    category: ConnectorCategory = ConnectorCategory.CLOUD_SECURITY
    supported_auth_types: list[str] = ["api_key"]

    # Capabilities
    supports_sync: bool = True
    supports_webhook: bool = False
    supports_bidirectional: bool = False

    def __init__(self, config: ConnectorConfig):
        self.config = config
        self._status = ConnectorStatus.UNCONFIGURED
        self._last_sync: Optional[datetime] = None
        self._last_error: Optional[str] = None
        self._client: Optional[Any] = None

    @property
    def status(self) -> ConnectorStatus:
        return self._status

    @property
    def last_sync(self) -> Optional[datetime]:
        return self._last_sync

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    @abstractmethod
    async def validate_config(self) -> ConnectorResult:
        """
        Validate the connector configuration.
        Returns success if config is valid.
        """
        pass

    @abstractmethod
    async def test_connection(self) -> ConnectorResult:
        """
        Test the connection to the external service.
        Returns success if connection is successful.
        """
        pass

    @abstractmethod
    async def authenticate(self) -> ConnectorResult:
        """
        Authenticate with the external service.
        Sets up the client for subsequent operations.
        """
        pass

    @abstractmethod
    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """
        Fetch data from the external service.
        Returns the raw data from the service.
        """
        pass

    @abstractmethod
    async def transform_data(self, raw_data: Any) -> list[T]:
        """
        Transform raw data from the external service
        into CISO Assistant domain objects.
        """
        pass

    async def sync(self, **kwargs) -> ConnectorResult:
        """
        Perform a full sync operation.

        1. Authenticate
        2. Fetch data
        3. Transform data
        4. Return results
        """
        result = ConnectorResult(success=False, started_at=datetime.utcnow())

        try:
            self._status = ConnectorStatus.SYNCING

            # Authenticate
            auth_result = await self.authenticate()
            if not auth_result.success:
                result.error_message = f"Authentication failed: {auth_result.error_message}"
                result.error_code = auth_result.error_code
                self._status = ConnectorStatus.ERROR
                self._last_error = result.error_message
                return result

            # Fetch data
            fetch_result = await self.fetch_data(**kwargs)
            if not fetch_result.success:
                result.error_message = f"Fetch failed: {fetch_result.error_message}"
                result.error_code = fetch_result.error_code
                self._status = ConnectorStatus.ERROR
                self._last_error = result.error_message
                return result

            # Transform data
            transformed = await self.transform_data(fetch_result.data)

            result.success = True
            result.data = transformed
            result.items_processed = len(transformed)
            result.metadata = {
                "fetch_metadata": fetch_result.metadata,
            }

            self._status = ConnectorStatus.CONNECTED
            self._last_sync = datetime.utcnow()
            self._last_error = None

        except ConnectorError as e:
            result.error_message = e.message
            result.error_code = e.code
            self._status = ConnectorStatus.ERROR
            self._last_error = e.message
            logger.error(f"Connector sync error: {e.message}", exc_info=True)

        except Exception as e:
            result.error_message = str(e)
            result.error_code = "UNEXPECTED_ERROR"
            self._status = ConnectorStatus.ERROR
            self._last_error = str(e)
            logger.exception(f"Unexpected connector error: {e}")

        finally:
            result.completed_at = datetime.utcnow()

        return result

    async def disconnect(self) -> None:
        """Clean up any resources."""
        self._client = None
        self._status = ConnectorStatus.CONFIGURED

    def get_config_schema(self) -> dict:
        """
        Return JSON schema for connector configuration.
        Override in subclasses to add connector-specific fields.
        """
        return {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Display name for this connector instance"
                },
                "enabled": {
                    "type": "boolean",
                    "default": True
                },
                "base_url": {
                    "type": "string",
                    "format": "uri",
                    "description": "Base URL for the service API"
                },
                "auth_type": {
                    "type": "string",
                    "enum": self.supported_auth_types,
                    "default": self.supported_auth_types[0] if self.supported_auth_types else "api_key"
                },
                "sync_interval_minutes": {
                    "type": "integer",
                    "minimum": 5,
                    "default": 60
                }
            },
            "required": ["name"]
        }

    def get_status_info(self) -> dict:
        """Return current connector status information."""
        return {
            "connector_type": self.connector_type,
            "display_name": self.display_name,
            "status": self._status.value,
            "last_sync": self._last_sync.isoformat() if self._last_sync else None,
            "last_error": self._last_error,
            "config_name": self.config.name,
            "enabled": self.config.enabled,
        }
