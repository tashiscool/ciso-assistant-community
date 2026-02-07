"""
AWS GuardDuty Connector.

Imports threat detection findings from AWS GuardDuty, which monitors
for malicious activity and unauthorized behavior in AWS accounts.
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
class GuardDutyFinding:
    """Represents an AWS GuardDuty finding."""

    id: str
    title: str
    description: str
    severity: str
    severity_score: float
    finding_type: str
    resource_type: str
    resource_id: str
    region: Optional[str] = None
    aws_account_id: Optional[str] = None
    threat_name: Optional[str] = None
    threat_purpose: Optional[str] = None
    action_type: Optional[str] = None
    actor_ip: Optional[str] = None
    actor_country: Optional[str] = None
    service_name: Optional[str] = None
    count: int = 1
    archived: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    evidence: List[str] = field(default_factory=list)


@ConnectorRegistry.register
class AWSGuardDutyConnector(BaseConnector[GuardDutyFinding]):
    """
    Connector for AWS GuardDuty.

    Fetches threat intelligence findings including reconnaissance, instance
    compromise, account compromise, and data exfiltration detections.
    """

    connector_type = "aws_guardduty"
    display_name = "AWS GuardDuty"
    description = "Threat detection findings from AWS GuardDuty"
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
            "detector_id": {
                "type": "string",
                "description": "GuardDuty detector ID (auto-detected if not provided)",
            },
        },
    }

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._boto_client = None
        self._detector_id = None

    async def validate_config(self) -> ConnectorResult:
        """Validate AWS credentials are configured."""
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
        """Test connection by listing GuardDuty detectors."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            response = self._boto_client.list_detectors()
            detector_ids = response.get("DetectorIds", [])

            if not detector_ids:
                return ConnectorResult(
                    success=False,
                    error_message="No GuardDuty detectors found in this region. "
                    "Ensure GuardDuty is enabled.",
                    error_code="NO_DETECTOR",
                )

            return ConnectorResult(
                success=True,
                metadata={"detector_ids": detector_ids},
            )
        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=f"Failed to connect to AWS GuardDuty: {e}",
                error_code="CONNECTION_ERROR",
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with AWS using provided credentials."""
        try:
            import boto3
        except ImportError:
            raise AuthenticationError(
                "boto3 is required for the AWS GuardDuty connector. "
                "Install it with: pip install boto3"
            )

        try:
            region = self.config.extra_settings.get("region", "us-east-1")
            self._boto_client = boto3.client(
                "guardduty",
                aws_access_key_id=self.config.credentials["aws_access_key_id"],
                aws_secret_access_key=self.config.credentials[
                    "aws_secret_access_key"
                ],
                region_name=region,
            )

            # Resolve detector ID
            self._detector_id = self.config.extra_settings.get("detector_id")
            if not self._detector_id:
                response = self._boto_client.list_detectors()
                detector_ids = response.get("DetectorIds", [])
                if detector_ids:
                    self._detector_id = detector_ids[0]
                else:
                    raise AuthenticationError(
                        "No GuardDuty detector found. Ensure GuardDuty is enabled."
                    )

            return ConnectorResult(success=True)
        except AuthenticationError:
            raise
        except Exception as e:
            raise AuthenticationError(f"AWS authentication failed: {e}")

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch findings from AWS GuardDuty with pagination."""
        if not self._boto_client or not self._detector_id:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated or no detector configured",
                error_code="NOT_AUTHENTICATED",
            )

        all_findings = []

        try:
            # Build finding criteria
            finding_criteria = kwargs.get("finding_criteria", {})
            sort_criteria = {"AttributeName": "severity", "OrderBy": "DESC"}

            # List finding IDs with pagination
            finding_ids = []
            next_token = None

            while True:
                list_params = {
                    "DetectorId": self._detector_id,
                    "FindingCriteria": finding_criteria,
                    "SortCriteria": sort_criteria,
                    "MaxResults": 50,
                }
                if next_token:
                    list_params["NextToken"] = next_token

                response = self._boto_client.list_findings(**list_params)
                finding_ids.extend(response.get("FindingIds", []))

                next_token = response.get("NextToken")
                if not next_token:
                    break

            # Fetch full finding details in batches of 50
            for i in range(0, len(finding_ids), 50):
                batch = finding_ids[i : i + 50]
                response = self._boto_client.get_findings(
                    DetectorId=self._detector_id,
                    FindingIds=batch,
                )
                all_findings.extend(response.get("Findings", []))

            return ConnectorResult(
                success=True,
                data=all_findings,
                items_processed=len(all_findings),
                metadata={
                    "total_findings": len(all_findings),
                    "detector_id": self._detector_id,
                    "region": self.config.extra_settings.get(
                        "region", "us-east-1"
                    ),
                },
            )

        except Exception as e:
            logger.error(f"GuardDuty fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR",
            )

    async def transform_data(
        self, raw_data: Any
    ) -> List[GuardDutyFinding]:
        """Transform GuardDuty findings to GuardDutyFinding objects."""
        findings = []

        for f in raw_data:
            severity_score = f.get("Severity", 0)
            severity = self._map_severity(severity_score)

            # Extract resource details
            resource = f.get("Resource", {})
            resource_type = resource.get("ResourceType", "Unknown")

            # Determine resource ID based on type
            resource_id = self._extract_resource_id(resource, resource_type)

            # Extract action details
            service = f.get("Service", {})
            action = service.get("Action", {})
            action_type = action.get("ActionType")

            # Extract actor information
            actor_ip, actor_country = self._extract_actor_info(action)

            # Extract evidence
            evidence_list = []
            evidence = service.get("Evidence", {})
            threat_intel = evidence.get("ThreatIntelligenceDetails", [])
            for ti in threat_intel:
                threat_names = ti.get("ThreatNames", [])
                evidence_list.extend(threat_names)

            # Parse finding type for threat name and purpose
            finding_type = f.get("Type", "")
            type_parts = finding_type.split(":")
            threat_purpose = type_parts[0] if type_parts else None
            threat_name = type_parts[-1] if len(type_parts) > 1 else None

            finding = GuardDutyFinding(
                id=f.get("Id", ""),
                title=f.get("Title", ""),
                description=f.get("Description", ""),
                severity=severity,
                severity_score=severity_score,
                finding_type=finding_type,
                resource_type=resource_type,
                resource_id=resource_id,
                region=f.get("Region"),
                aws_account_id=f.get("AccountId"),
                threat_name=threat_name,
                threat_purpose=threat_purpose,
                action_type=action_type,
                actor_ip=actor_ip,
                actor_country=actor_country,
                service_name=service.get("ServiceName"),
                count=service.get("Count", 1),
                archived=f.get("Archived", False),
                created_at=f.get("CreatedAt"),
                updated_at=f.get("UpdatedAt"),
                evidence=evidence_list,
            )
            findings.append(finding)

        return findings

    @staticmethod
    def _map_severity(score: float) -> str:
        """Map GuardDuty severity score (0-10) to label."""
        if score >= 7.0:
            return "high"
        elif score >= 4.0:
            return "medium"
        elif score > 0:
            return "low"
        return "info"

    @staticmethod
    def _extract_resource_id(resource: dict, resource_type: str) -> str:
        """Extract the primary resource identifier."""
        if resource_type == "Instance":
            instance_details = resource.get("InstanceDetails", {})
            return instance_details.get("InstanceId", "")
        elif resource_type == "AccessKey":
            access_key = resource.get("AccessKeyDetails", {})
            return access_key.get("AccessKeyId", "")
        elif resource_type == "S3Bucket":
            s3_details = resource.get("S3BucketDetails", [{}])
            if s3_details:
                return s3_details[0].get("Name", "")
        return resource.get("ResourceType", "unknown")

    @staticmethod
    def _extract_actor_info(action: dict) -> tuple:
        """Extract actor IP and country from action details."""
        actor_ip = None
        actor_country = None

        # Check various action type details for remote IP
        for action_key in [
            "NetworkConnectionAction",
            "PortProbeAction",
            "AwsApiCallAction",
        ]:
            action_detail = action.get(action_key, {})
            remote_ip_details = action_detail.get(
                "RemoteIpDetails", {}
            )
            if remote_ip_details:
                actor_ip = remote_ip_details.get("IpAddressV4")
                country = remote_ip_details.get("Country", {})
                actor_country = country.get("CountryName")
                break

        return actor_ip, actor_country

    def get_config_schema(self) -> dict:
        """Return AWS GuardDuty specific config schema."""
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
                "detector_id": {
                    "type": "string",
                    "description": "GuardDuty Detector ID (auto-detected if omitted)",
                },
            }
        )
        base["required"].extend(
            ["aws_access_key_id", "aws_secret_access_key", "region"]
        )
        return base
