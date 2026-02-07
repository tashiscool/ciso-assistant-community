"""
Container Security Connectors.

Supported platforms:
- Trivy: Container vulnerability scanner
- Grype: Container vulnerability scanner by Anchore
"""

from .trivy import TrivyConnector
from .grype import GrypeConnector

__all__ = ['TrivyConnector', 'GrypeConnector']
