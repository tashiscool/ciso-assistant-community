"""
AWS Config Connector.

Imports compliance evaluation results from AWS Config, which assesses,
audits, and evaluates the configurations of AWS resources against
desired configurations defined in AWS Config rules.
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
class AWSConfigEvaluation:
    """Represents an AWS Config compliance evaluation result."""

    id: str
    rule_name: str
    resource_type: str
    resource_id: str
    compliance_status: str
    severity: str
    annotation: Optional[str] = None
    aws_account_id: Optional[str] = None
    region: Optional[str] = None
    rule_description: Optional[str] = None
    rule_source: Optional[str] = None
    ordering_timestamp: Optional[str] = None
    config_rule_arn: Optional[str] = None
    input_parameters: Optional[str] = None
    remediation_action: Optional[str] = None


@ConnectorRegistry.register
class AWSConfigConnector(BaseConnector[AWSConfigEvaluation]):
    """
    Connector for AWS Config.

    Fetches compliance evaluation results from AWS Config rules, providing
    visibility into resource configuration compliance across AWS accounts.
    """

    connector_type = "aws_config"
    display_name = "AWS Config"
    description = "Resource compliance evaluation results from AWS Config"
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
        },
    }

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._boto_client = None

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
        """Test connection by listing Config rules."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            response = self._boto_client.describe_config_rules(Limit=1)
            return ConnectorResult(
                success=True,
                metadata={
                    "rules_found": len(
                        response.get("ConfigRules", [])
                    )
                },
            )
        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=f"Failed to connect to AWS Config: {e}",
                error_code="CONNECTION_ERROR",
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with AWS using provided credentials."""
        try:
            import boto3
        except ImportError:
            raise AuthenticationError(
                "boto3 is required for the AWS Config connector. "
                "Install it with: pip install boto3"
            )

        try:
            region = self.config.extra_settings.get("region", "us-east-1")
            self._boto_client = boto3.client(
                "config",
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
        """Fetch compliance evaluation results from AWS Config."""
        if not self._boto_client:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED",
            )

        try:
            # Step 1: Get all config rules
            config_rules = []
            next_token = None

            while True:
                params = {}
                if next_token:
                    params["NextToken"] = next_token

                response = self._boto_client.describe_config_rules(**params)
                config_rules.extend(response.get("ConfigRules", []))

                next_token = response.get("NextToken")
                if not next_token:
                    break

            # Build rule name to metadata mapping
            rule_metadata = {}
            for rule in config_rules:
                rule_name = rule.get("ConfigRuleName", "")
                rule_metadata[rule_name] = {
                    "description": rule.get("Description", ""),
                    "source": rule.get("Source", {}).get(
                        "SourceIdentifier", ""
                    ),
                    "arn": rule.get("ConfigRuleArn", ""),
                    "input_parameters": rule.get("InputParameters", ""),
                }

            # Step 2: Get compliance details for each rule
            all_evaluations = []

            for rule in config_rules:
                rule_name = rule.get("ConfigRuleName", "")
                eval_next_token = None

                while True:
                    eval_params = {
                        "ConfigRuleName": rule_name,
                        "Limit": 100,
                    }
                    if eval_next_token:
                        eval_params["NextToken"] = eval_next_token

                    try:
                        eval_response = (
                            self._boto_client.get_compliance_details_by_config_rule(
                                **eval_params
                            )
                        )
                        results = eval_response.get(
                            "EvaluationResults", []
                        )

                        # Attach rule metadata to each evaluation
                        for result in results:
                            result["_rule_name"] = rule_name
                            result["_rule_metadata"] = rule_metadata.get(
                                rule_name, {}
                            )

                        all_evaluations.extend(results)

                        eval_next_token = eval_response.get("NextToken")
                        if not eval_next_token:
                            break

                    except Exception as e:
                        logger.warning(
                            f"Error fetching compliance for rule {rule_name}: {e}"
                        )
                        break

            return ConnectorResult(
                success=True,
                data=all_evaluations,
                items_processed=len(all_evaluations),
                metadata={
                    "total_rules": len(config_rules),
                    "total_evaluations": len(all_evaluations),
                    "region": self.config.extra_settings.get(
                        "region", "us-east-1"
                    ),
                },
            )

        except Exception as e:
            logger.error(f"AWS Config fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR",
            )

    async def transform_data(
        self, raw_data: Any
    ) -> List[AWSConfigEvaluation]:
        """Transform AWS Config evaluation results."""
        evaluations = []

        compliance_severity_map = {
            "NON_COMPLIANT": "high",
            "COMPLIANT": "info",
            "NOT_APPLICABLE": "info",
            "INSUFFICIENT_DATA": "low",
        }

        for e in raw_data:
            compliance_type = e.get("ComplianceType", "NOT_APPLICABLE")
            eval_result_id = e.get("EvaluationResultIdentifier", {})
            eval_qualifier = eval_result_id.get(
                "EvaluationResultQualifier", {}
            )

            rule_name = e.get("_rule_name", eval_qualifier.get("ConfigRuleName", ""))
            rule_meta = e.get("_rule_metadata", {})

            resource_type = eval_qualifier.get("ResourceType", "")
            resource_id = eval_qualifier.get("ResourceId", "")

            ordering_timestamp = e.get("ResultRecordedTime")
            if ordering_timestamp and hasattr(ordering_timestamp, "isoformat"):
                ordering_timestamp = ordering_timestamp.isoformat()

            evaluation = AWSConfigEvaluation(
                id=f"{rule_name}:{resource_type}:{resource_id}",
                rule_name=rule_name,
                resource_type=resource_type,
                resource_id=resource_id,
                compliance_status=compliance_type,
                severity=compliance_severity_map.get(
                    compliance_type, "info"
                ),
                annotation=e.get("Annotation"),
                region=self.config.extra_settings.get("region", "us-east-1"),
                rule_description=rule_meta.get("description"),
                rule_source=rule_meta.get("source"),
                ordering_timestamp=ordering_timestamp,
                config_rule_arn=rule_meta.get("arn"),
                input_parameters=rule_meta.get("input_parameters"),
            )
            evaluations.append(evaluation)

        return evaluations

    def get_config_schema(self) -> dict:
        """Return AWS Config specific config schema."""
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
            }
        )
        base["required"].extend(
            ["aws_access_key_id", "aws_secret_access_key", "region"]
        )
        return base
