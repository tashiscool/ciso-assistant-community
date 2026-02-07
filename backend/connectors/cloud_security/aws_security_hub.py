"""
AWS Security Hub Connector.

Imports findings from AWS Security Hub, which aggregates security alerts
from multiple AWS services and third-party tools.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
import logging

from ..base.connector import (
    BaseConnector,
    ConnectorCategory,
    ConnectorConfig,
    ConnectorResult,
    AuthenticationError,
)
from ..base.registry import ConnectorRegistry

logger = logging.getLogger(__name__)


@dataclass
class SecurityHubFinding:
    """Represents an AWS Security Hub finding."""

    id: str
    title: str
    description: str
    severity: str
    severity_normalized: int
    resource_id: str
    resource_type: str
    compliance_status: Optional[str] = None
    aws_account_id: Optional[str] = None
    region: Optional[str] = None
    product_name: Optional[str] = None
    generator_id: Optional[str] = None
    workflow_status: Optional[str] = None
    record_state: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    remediation_text: Optional[str] = None
    remediation_url: Optional[str] = None
    standards_control_arn: Optional[str] = None
    types: List[str] = field(default_factory=list)


@ConnectorRegistry.register
class AWSSecurityHubConnector(BaseConnector[SecurityHubFinding]):
    """
    Connector for AWS Security Hub.

    Fetches consolidated security findings from AWS Security Hub, including
    findings from GuardDuty, Inspector, Macie, IAM Access Analyzer, Firewall
    Manager, and third-party integrations.
    """

    connector_type = "aws_security_hub"
    display_name = "AWS Security Hub"
    description = "Aggregated security findings from AWS Security Hub"
    category = ConnectorCategory.CLOUD_SECURITY
    supported_auth_types = ["service_account"]

    supports_sync = True
    supports_webhook = False
    supports_bidirectional = False

    config_schema = {
        "required": ["aws_access_key_id", "aws_secret_access_key", "region"],
        "properties": {
            "aws_access_key_id": {
                "type": "string",
                "description": "AWS access key ID",
            },
            "aws_secret_access_key": {
                "type": "string",
                "format": "password",
                "description": "AWS secret access key",
            },
            "region": {
                "type": "string",
                "description": "AWS region (e.g. us-east-1)",
                "default": "us-east-1",
            },
            "filters": {
                "type": "object",
                "description": "Security Hub finding filters (optional)",
            },
        },
    }

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._boto_client = None

    async def validate_config(self) -> ConnectorResult:
        """Validate AWS credentials and region are configured."""
        required_fields = ["aws_access_key_id", "aws_secret_access_key"]
        missing = [
            f for f in required_fields if not self.config.credentials.get(f)
        ]
        if missing:
            return ConnectorResult(
                success=False,
                error_message=f"Missing required credentials: {', '.join(missing)}",
                error_code="MISSING_CREDENTIALS",
            )

        region = self.config.extra_settings.get("region", "us-east-1")
        if not region:
            return ConnectorResult(
                success=False,
                error_message="AWS region is required",
                error_code="MISSING_CONFIG",
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to AWS Security Hub by describing the hub."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            response = self._boto_client.describe_hub()
            hub_arn = response.get("HubArn", "")
            return ConnectorResult(
                success=True,
                metadata={"hub_arn": hub_arn},
            )
        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=f"Failed to connect to AWS Security Hub: {e}",
                error_code="CONNECTION_ERROR",
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with AWS using provided credentials."""
        try:
            import boto3
        except ImportError:
            raise AuthenticationError(
                "boto3 is required for the AWS Security Hub connector. "
                "Install it with: pip install boto3"
            )

        try:
            region = self.config.extra_settings.get("region", "us-east-1")
            self._boto_client = boto3.client(
                "securityhub",
                aws_access_key_id=self.config.credentials["aws_access_key_id"],
                aws_secret_access_key=self.config.credentials[
                    "aws_secret_access_key"
                ],
                region_name=region,
            )
            return ConnectorResult(success=True)
        except Exception as e:
            raise AuthenticationError(f"AWS authentication failed: {e}")

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch findings from AWS Security Hub with pagination."""
        if not self._boto_client:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED",
            )

        all_findings = []

        try:
            # Build filters from config or kwargs
            filters = kwargs.get(
                "filters",
                self.config.extra_settings.get("filters", {}),
            )

            # Default filter: only ACTIVE findings
            if not filters:
                filters = {
                    "RecordState": [
                        {"Value": "ACTIVE", "Comparison": "EQUALS"}
                    ]
                }

            paginator = self._boto_client.get_paginator("get_findings")
            page_iterator = paginator.paginate(
                Filters=filters,
                MaxResults=100,
            )

            for page in page_iterator:
                findings = page.get("Findings", [])
                all_findings.extend(findings)

            return ConnectorResult(
                success=True,
                data=all_findings,
                items_processed=len(all_findings),
                metadata={
                    "total_findings": len(all_findings),
                    "region": self.config.extra_settings.get(
                        "region", "us-east-1"
                    ),
                },
            )

        except Exception as e:
            logger.error(f"Security Hub fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR",
            )

    async def transform_data(
        self, raw_data: Any
    ) -> List[SecurityHubFinding]:
        """Transform Security Hub findings to SecurityHubFinding objects."""
        findings = []

        severity_label_map = {
            "INFORMATIONAL": "info",
            "LOW": "low",
            "MEDIUM": "medium",
            "HIGH": "high",
            "CRITICAL": "critical",
        }

        for f in raw_data:
            severity_obj = f.get("Severity", {})
            severity_label = severity_obj.get("Label", "INFORMATIONAL")
            severity_normalized = severity_obj.get("Normalized", 0)

            # Extract primary resource
            resources = f.get("Resources", [{}])
            primary_resource = resources[0] if resources else {}

            # Extract remediation
            remediation = f.get("Remediation", {})
            recommendation = remediation.get("Recommendation", {})

            # Extract compliance status
            compliance = f.get("Compliance", {})
            compliance_status = compliance.get("Status")

            finding = SecurityHubFinding(
                id=f.get("Id", ""),
                title=f.get("Title", ""),
                description=f.get("Description", ""),
                severity=severity_label_map.get(
                    severity_label, "info"
                ),
                severity_normalized=severity_normalized,
                resource_id=primary_resource.get("Id", ""),
                resource_type=primary_resource.get("Type", ""),
                compliance_status=compliance_status,
                aws_account_id=f.get("AwsAccountId"),
                region=primary_resource.get("Region"),
                product_name=f.get("ProductName"),
                generator_id=f.get("GeneratorId"),
                workflow_status=f.get("Workflow", {}).get("Status"),
                record_state=f.get("RecordState"),
                created_at=f.get("CreatedAt"),
                updated_at=f.get("UpdatedAt"),
                remediation_text=recommendation.get("Text"),
                remediation_url=recommendation.get("Url"),
                types=f.get("Types", []),
            )
            findings.append(finding)

        return findings

    def get_config_schema(self) -> dict:
        """Return AWS Security Hub specific config schema."""
        base = super().get_config_schema()
        base["properties"].update(
            {
                "aws_access_key_id": {
                    "type": "string",
                    "description": "AWS Access Key ID",
                },
                "aws_secret_access_key": {
                    "type": "string",
                    "format": "password",
                    "description": "AWS Secret Access Key",
                },
                "region": {
                    "type": "string",
                    "description": "AWS Region",
                    "default": "us-east-1",
                },
                "filters": {
                    "type": "object",
                    "description": "Security Hub finding filters",
                },
            }
        )
        base["required"].extend(
            ["aws_access_key_id", "aws_secret_access_key", "region"]
        )
        return base
