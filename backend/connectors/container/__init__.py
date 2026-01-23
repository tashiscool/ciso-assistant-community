"""
Container Security Connectors.

Supported platforms:
- Trivy: Container vulnerability scanner
"""

from .trivy import TrivyConnector

__all__ = ['TrivyConnector']
