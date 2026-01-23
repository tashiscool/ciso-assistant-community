"""
Authentication providers for connectors.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
import logging
import httpx

logger = logging.getLogger(__name__)


@dataclass
class AuthToken:
    """Represents an authentication token."""
    access_token: str
    token_type: str = "Bearer"
    expires_at: Optional[datetime] = None
    refresh_token: Optional[str] = None
    scope: Optional[str] = None
    extra: Dict[str, Any] = None

    def __post_init__(self):
        if self.extra is None:
            self.extra = {}

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        # Add buffer to avoid edge cases
        return datetime.utcnow() >= (self.expires_at - timedelta(minutes=5))

    @property
    def authorization_header(self) -> str:
        return f"{self.token_type} {self.access_token}"


class AuthProvider(ABC):
    """Base class for authentication providers."""

    @abstractmethod
    async def authenticate(self) -> AuthToken:
        """Authenticate and return a token."""
        pass

    @abstractmethod
    async def refresh(self, token: AuthToken) -> AuthToken:
        """Refresh an expired token."""
        pass

    def get_headers(self, token: AuthToken) -> Dict[str, str]:
        """Get headers for authenticated requests."""
        return {"Authorization": token.authorization_header}


class APIKeyProvider(AuthProvider):
    """
    API Key authentication provider.

    Supports various API key placements:
    - Header (default)
    - Query parameter
    - Basic auth
    """

    def __init__(
        self,
        api_key: str,
        header_name: str = "X-API-Key",
        placement: str = "header",  # header, query, basic
        key_prefix: str = "",
    ):
        self.api_key = api_key
        self.header_name = header_name
        self.placement = placement
        self.key_prefix = key_prefix

    async def authenticate(self) -> AuthToken:
        """API keys don't need authentication, just return a token."""
        return AuthToken(
            access_token=self.api_key,
            token_type="ApiKey",
            extra={
                "header_name": self.header_name,
                "placement": self.placement,
                "key_prefix": self.key_prefix,
            }
        )

    async def refresh(self, token: AuthToken) -> AuthToken:
        """API keys don't expire, return same token."""
        return token

    def get_headers(self, token: AuthToken) -> Dict[str, str]:
        """Get headers for API key authentication."""
        if self.placement == "header":
            value = f"{self.key_prefix}{self.api_key}" if self.key_prefix else self.api_key
            return {self.header_name: value}
        elif self.placement == "basic":
            import base64
            encoded = base64.b64encode(f"{self.api_key}:".encode()).decode()
            return {"Authorization": f"Basic {encoded}"}
        return {}

    def get_query_params(self, token: AuthToken) -> Dict[str, str]:
        """Get query params if using query placement."""
        if self.placement == "query":
            return {self.header_name: self.api_key}
        return {}


class OAuth2Provider(AuthProvider):
    """
    OAuth2 authentication provider.

    Supports:
    - Client credentials flow (machine-to-machine)
    - Authorization code flow (user authorization)
    - Token refresh
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        token_url: str,
        authorization_url: Optional[str] = None,
        scope: Optional[str] = None,
        audience: Optional[str] = None,
        extra_params: Optional[Dict[str, str]] = None,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = token_url
        self.authorization_url = authorization_url
        self.scope = scope
        self.audience = audience
        self.extra_params = extra_params or {}

    async def authenticate(self) -> AuthToken:
        """
        Authenticate using client credentials flow.
        """
        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        if self.scope:
            data["scope"] = self.scope
        if self.audience:
            data["audience"] = self.audience

        data.update(self.extra_params)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            if response.status_code != 200:
                logger.error(f"OAuth2 authentication failed: {response.text}")
                raise Exception(f"OAuth2 authentication failed: {response.status_code}")

            token_data = response.json()

        expires_at = None
        if "expires_in" in token_data:
            expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])

        return AuthToken(
            access_token=token_data["access_token"],
            token_type=token_data.get("token_type", "Bearer"),
            expires_at=expires_at,
            refresh_token=token_data.get("refresh_token"),
            scope=token_data.get("scope", self.scope),
        )

    async def refresh(self, token: AuthToken) -> AuthToken:
        """Refresh an expired token."""
        if not token.refresh_token:
            # No refresh token, re-authenticate
            return await self.authenticate()

        data = {
            "grant_type": "refresh_token",
            "refresh_token": token.refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            if response.status_code != 200:
                logger.warning("Token refresh failed, re-authenticating")
                return await self.authenticate()

            token_data = response.json()

        expires_at = None
        if "expires_in" in token_data:
            expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])

        return AuthToken(
            access_token=token_data["access_token"],
            token_type=token_data.get("token_type", "Bearer"),
            expires_at=expires_at,
            refresh_token=token_data.get("refresh_token", token.refresh_token),
            scope=token_data.get("scope", token.scope),
        )


class ServiceAccountProvider(AuthProvider):
    """
    Service account authentication (e.g., Google Cloud, Azure).

    Supports JWT-based service account authentication.
    """

    def __init__(
        self,
        credentials_json: Dict[str, Any],
        scope: Optional[str] = None,
        token_url: Optional[str] = None,
    ):
        self.credentials = credentials_json
        self.scope = scope
        self.token_url = token_url or self._get_default_token_url()

    def _get_default_token_url(self) -> str:
        """Get default token URL based on credential type."""
        if "type" in self.credentials:
            if self.credentials["type"] == "service_account":
                return "https://oauth2.googleapis.com/token"
        return ""

    async def authenticate(self) -> AuthToken:
        """
        Authenticate using service account credentials.
        Creates a signed JWT and exchanges it for an access token.
        """
        import jwt
        import time

        now = int(time.time())
        payload = {
            "iss": self.credentials.get("client_email"),
            "sub": self.credentials.get("client_email"),
            "aud": self.token_url,
            "iat": now,
            "exp": now + 3600,
        }

        if self.scope:
            payload["scope"] = self.scope

        private_key = self.credentials.get("private_key", "")
        signed_jwt = jwt.encode(
            payload,
            private_key,
            algorithm="RS256"
        )

        data = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": signed_jwt,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            if response.status_code != 200:
                logger.error(f"Service account authentication failed: {response.text}")
                raise Exception(f"Service account authentication failed: {response.status_code}")

            token_data = response.json()

        expires_at = None
        if "expires_in" in token_data:
            expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])

        return AuthToken(
            access_token=token_data["access_token"],
            token_type=token_data.get("token_type", "Bearer"),
            expires_at=expires_at,
            scope=token_data.get("scope", self.scope),
        )

    async def refresh(self, token: AuthToken) -> AuthToken:
        """Service accounts just re-authenticate."""
        return await self.authenticate()


class AzureADProvider(OAuth2Provider):
    """
    Azure Active Directory authentication provider.

    Specialized OAuth2 provider for Microsoft Azure AD.
    """

    def __init__(
        self,
        tenant_id: str,
        client_id: str,
        client_secret: str,
        scope: str = "https://graph.microsoft.com/.default",
    ):
        token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        authorization_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize"

        super().__init__(
            client_id=client_id,
            client_secret=client_secret,
            token_url=token_url,
            authorization_url=authorization_url,
            scope=scope,
        )
        self.tenant_id = tenant_id


class BasicAuthProvider(AuthProvider):
    """
    Basic HTTP authentication provider.
    """

    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password

    async def authenticate(self) -> AuthToken:
        """Create a basic auth token."""
        import base64
        credentials = f"{self.username}:{self.password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return AuthToken(
            access_token=encoded,
            token_type="Basic",
        )

    async def refresh(self, token: AuthToken) -> AuthToken:
        """Basic auth doesn't expire."""
        return token

    def get_headers(self, token: AuthToken) -> Dict[str, str]:
        """Get headers for basic auth."""
        return {"Authorization": f"Basic {token.access_token}"}
