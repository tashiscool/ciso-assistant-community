"""
Endpoint Security Connectors.

Supported platforms:
- Microsoft Defender for Endpoint: Endpoint detection and response
"""

from .defender import DefenderConnector

__all__ = ['DefenderConnector']
