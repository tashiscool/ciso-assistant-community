"""
ITIL / Service Management Connectors.

Supported platforms:
- ServiceNow: CMDB and incident management sync
- Jira: Issue and ticket tracking for security findings
"""

from .servicenow import ServiceNowConnector
from .jira import JiraConnector

__all__ = ['ServiceNowConnector', 'JiraConnector']
