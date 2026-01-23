"""
Evidence Collection Connectors

Provides connectors for various evidence sources.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, BinaryIO
from dataclasses import dataclass
from datetime import datetime
import json
import requests
import structlog

logger = structlog.get_logger(__name__)


@dataclass
class CollectedEvidence:
    """Represents collected evidence data."""
    name: str
    description: str
    content_type: str  # 'file', 'json', 'text', 'image'
    data: Any  # File bytes, JSON dict, or text
    filename: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class BaseConnector(ABC):
    """Base class for evidence source connectors."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.connected = False

    @abstractmethod
    def connect(self) -> bool:
        """Establish connection to the source."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Close connection to the source."""
        pass

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Test the connection and return status."""
        pass

    @abstractmethod
    def collect(self, query: str, parameters: Dict[str, Any]) -> List[CollectedEvidence]:
        """Collect evidence based on query and parameters."""
        pass

    def validate_config(self) -> List[str]:
        """Validate configuration and return list of errors."""
        return []


class AWSConnector(BaseConnector):
    """Connector for AWS evidence collection."""

    REQUIRED_CONFIG = ['access_key_id', 'secret_access_key', 'region']

    def validate_config(self) -> List[str]:
        errors = []
        for key in self.REQUIRED_CONFIG:
            if key not in self.config or not self.config[key]:
                errors.append(f"Missing required configuration: {key}")
        return errors

    def connect(self) -> bool:
        try:
            import boto3
            self.session = boto3.Session(
                aws_access_key_id=self.config.get('access_key_id'),
                aws_secret_access_key=self.config.get('secret_access_key'),
                region_name=self.config.get('region', 'us-east-1')
            )
            self.connected = True
            return True
        except Exception as e:
            logger.error("AWS connection failed", error=str(e))
            return False

    def disconnect(self) -> None:
        self.session = None
        self.connected = False

    def test_connection(self) -> Dict[str, Any]:
        try:
            if not self.connected:
                self.connect()
            sts = self.session.client('sts')
            identity = sts.get_caller_identity()
            return {
                'success': True,
                'account_id': identity['Account'],
                'user_arn': identity['Arn'],
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
            }

    def collect(self, query: str, parameters: Dict[str, Any]) -> List[CollectedEvidence]:
        collected = []

        try:
            if not self.connected:
                self.connect()

            collection_type = parameters.get('collection_type', 'configuration')

            if collection_type == 'iam_users':
                collected.extend(self._collect_iam_users())
            elif collection_type == 'security_groups':
                collected.extend(self._collect_security_groups())
            elif collection_type == 's3_buckets':
                collected.extend(self._collect_s3_buckets())
            elif collection_type == 'cloudtrail':
                collected.extend(self._collect_cloudtrail_status())
            elif collection_type == 'config_rules':
                collected.extend(self._collect_config_rules())

        except Exception as e:
            logger.error("AWS collection failed", error=str(e), query=query)

        return collected

    def _collect_iam_users(self) -> List[CollectedEvidence]:
        iam = self.session.client('iam')
        users = iam.list_users()

        user_data = []
        for user in users.get('Users', []):
            user_info = {
                'UserName': user['UserName'],
                'UserId': user['UserId'],
                'Arn': user['Arn'],
                'CreateDate': user['CreateDate'].isoformat(),
                'PasswordLastUsed': user.get('PasswordLastUsed', {}).isoformat() if user.get('PasswordLastUsed') else None,
            }

            # Get MFA status
            mfa_devices = iam.list_mfa_devices(UserName=user['UserName'])
            user_info['MFAEnabled'] = len(mfa_devices.get('MFADevices', [])) > 0

            user_data.append(user_info)

        return [CollectedEvidence(
            name='AWS IAM Users List',
            description=f'IAM users list collected at {datetime.now().isoformat()}',
            content_type='json',
            data=user_data,
            filename='aws_iam_users.json',
            metadata={
                'source': 'aws',
                'collection_type': 'iam_users',
                'user_count': len(user_data),
            }
        )]

    def _collect_security_groups(self) -> List[CollectedEvidence]:
        ec2 = self.session.client('ec2')
        sgs = ec2.describe_security_groups()

        sg_data = []
        for sg in sgs.get('SecurityGroups', []):
            sg_data.append({
                'GroupId': sg['GroupId'],
                'GroupName': sg['GroupName'],
                'Description': sg['Description'],
                'VpcId': sg.get('VpcId'),
                'InboundRules': len(sg.get('IpPermissions', [])),
                'OutboundRules': len(sg.get('IpPermissionsEgress', [])),
            })

        return [CollectedEvidence(
            name='AWS Security Groups',
            description=f'Security groups list collected at {datetime.now().isoformat()}',
            content_type='json',
            data=sg_data,
            filename='aws_security_groups.json',
            metadata={
                'source': 'aws',
                'collection_type': 'security_groups',
                'sg_count': len(sg_data),
            }
        )]

    def _collect_s3_buckets(self) -> List[CollectedEvidence]:
        s3 = self.session.client('s3')
        buckets = s3.list_buckets()

        bucket_data = []
        for bucket in buckets.get('Buckets', []):
            bucket_info = {
                'Name': bucket['Name'],
                'CreationDate': bucket['CreationDate'].isoformat(),
            }

            try:
                # Get encryption status
                encryption = s3.get_bucket_encryption(Bucket=bucket['Name'])
                bucket_info['EncryptionEnabled'] = True
            except:
                bucket_info['EncryptionEnabled'] = False

            try:
                # Get versioning status
                versioning = s3.get_bucket_versioning(Bucket=bucket['Name'])
                bucket_info['VersioningEnabled'] = versioning.get('Status') == 'Enabled'
            except:
                bucket_info['VersioningEnabled'] = False

            bucket_data.append(bucket_info)

        return [CollectedEvidence(
            name='AWS S3 Buckets Configuration',
            description=f'S3 bucket configurations collected at {datetime.now().isoformat()}',
            content_type='json',
            data=bucket_data,
            filename='aws_s3_buckets.json',
            metadata={
                'source': 'aws',
                'collection_type': 's3_buckets',
                'bucket_count': len(bucket_data),
            }
        )]

    def _collect_cloudtrail_status(self) -> List[CollectedEvidence]:
        ct = self.session.client('cloudtrail')
        trails = ct.describe_trails()

        trail_data = []
        for trail in trails.get('trailList', []):
            trail_info = {
                'Name': trail['Name'],
                'S3BucketName': trail.get('S3BucketName'),
                'IsMultiRegionTrail': trail.get('IsMultiRegionTrail', False),
                'LogFileValidationEnabled': trail.get('LogFileValidationEnabled', False),
                'IncludeGlobalServiceEvents': trail.get('IncludeGlobalServiceEvents', False),
            }

            try:
                status = ct.get_trail_status(Name=trail['Name'])
                trail_info['IsLogging'] = status.get('IsLogging', False)
            except:
                trail_info['IsLogging'] = None

            trail_data.append(trail_info)

        return [CollectedEvidence(
            name='AWS CloudTrail Status',
            description=f'CloudTrail configuration collected at {datetime.now().isoformat()}',
            content_type='json',
            data=trail_data,
            filename='aws_cloudtrail.json',
            metadata={
                'source': 'aws',
                'collection_type': 'cloudtrail',
                'trail_count': len(trail_data),
            }
        )]

    def _collect_config_rules(self) -> List[CollectedEvidence]:
        config = self.session.client('config')

        try:
            rules = config.describe_config_rules()
            rule_data = []

            for rule in rules.get('ConfigRules', []):
                rule_data.append({
                    'ConfigRuleName': rule['ConfigRuleName'],
                    'ConfigRuleState': rule['ConfigRuleState'],
                    'Source': rule['Source']['Owner'],
                    'Description': rule.get('Description', ''),
                })

            return [CollectedEvidence(
                name='AWS Config Rules',
                description=f'AWS Config rules collected at {datetime.now().isoformat()}',
                content_type='json',
                data=rule_data,
                filename='aws_config_rules.json',
                metadata={
                    'source': 'aws',
                    'collection_type': 'config_rules',
                    'rule_count': len(rule_data),
                }
            )]
        except Exception as e:
            logger.warning("Failed to collect Config rules", error=str(e))
            return []


class AzureConnector(BaseConnector):
    """Connector for Azure evidence collection."""

    REQUIRED_CONFIG = ['tenant_id', 'client_id', 'client_secret']

    def validate_config(self) -> List[str]:
        errors = []
        for key in self.REQUIRED_CONFIG:
            if key not in self.config or not self.config[key]:
                errors.append(f"Missing required configuration: {key}")
        return errors

    def connect(self) -> bool:
        try:
            from azure.identity import ClientSecretCredential
            self.credential = ClientSecretCredential(
                tenant_id=self.config.get('tenant_id'),
                client_id=self.config.get('client_id'),
                client_secret=self.config.get('client_secret')
            )
            self.connected = True
            return True
        except Exception as e:
            logger.error("Azure connection failed", error=str(e))
            return False

    def disconnect(self) -> None:
        self.credential = None
        self.connected = False

    def test_connection(self) -> Dict[str, Any]:
        try:
            if not self.connected:
                self.connect()

            # Test by getting a token
            token = self.credential.get_token("https://management.azure.com/.default")
            return {
                'success': True,
                'tenant_id': self.config.get('tenant_id'),
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
            }

    def collect(self, query: str, parameters: Dict[str, Any]) -> List[CollectedEvidence]:
        collected = []

        try:
            if not self.connected:
                self.connect()

            collection_type = parameters.get('collection_type', 'configuration')

            if collection_type == 'users':
                collected.extend(self._collect_azure_ad_users())
            elif collection_type == 'security_center':
                collected.extend(self._collect_security_center())

        except Exception as e:
            logger.error("Azure collection failed", error=str(e), query=query)

        return collected

    def _collect_azure_ad_users(self) -> List[CollectedEvidence]:
        from azure.identity import ClientSecretCredential
        import requests

        token = self.credential.get_token("https://graph.microsoft.com/.default")

        headers = {
            'Authorization': f'Bearer {token.token}',
            'Content-Type': 'application/json'
        }

        response = requests.get(
            'https://graph.microsoft.com/v1.0/users',
            headers=headers
        )

        if response.status_code == 200:
            users = response.json().get('value', [])
            user_data = []

            for user in users:
                user_data.append({
                    'id': user.get('id'),
                    'displayName': user.get('displayName'),
                    'userPrincipalName': user.get('userPrincipalName'),
                    'accountEnabled': user.get('accountEnabled'),
                    'createdDateTime': user.get('createdDateTime'),
                })

            return [CollectedEvidence(
                name='Azure AD Users',
                description=f'Azure AD users collected at {datetime.now().isoformat()}',
                content_type='json',
                data=user_data,
                filename='azure_ad_users.json',
                metadata={
                    'source': 'azure_ad',
                    'collection_type': 'users',
                    'user_count': len(user_data),
                }
            )]

        return []

    def _collect_security_center(self) -> List[CollectedEvidence]:
        # Placeholder for Azure Security Center collection
        return []


class GitHubConnector(BaseConnector):
    """Connector for GitHub evidence collection."""

    REQUIRED_CONFIG = ['access_token']

    def validate_config(self) -> List[str]:
        errors = []
        if 'access_token' not in self.config or not self.config['access_token']:
            errors.append("Missing required configuration: access_token")
        return errors

    def connect(self) -> bool:
        self.headers = {
            'Authorization': f"token {self.config.get('access_token')}",
            'Accept': 'application/vnd.github.v3+json'
        }
        self.base_url = 'https://api.github.com'
        self.connected = True
        return True

    def disconnect(self) -> None:
        self.headers = None
        self.connected = False

    def test_connection(self) -> Dict[str, Any]:
        try:
            if not self.connected:
                self.connect()

            response = requests.get(f'{self.base_url}/user', headers=self.headers)
            if response.status_code == 200:
                user = response.json()
                return {
                    'success': True,
                    'login': user.get('login'),
                    'name': user.get('name'),
                }
            return {
                'success': False,
                'error': f'HTTP {response.status_code}',
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
            }

    def collect(self, query: str, parameters: Dict[str, Any]) -> List[CollectedEvidence]:
        collected = []

        try:
            if not self.connected:
                self.connect()

            collection_type = parameters.get('collection_type', 'repository_settings')
            org = parameters.get('organization')
            repo = parameters.get('repository')

            if collection_type == 'repository_settings' and org and repo:
                collected.extend(self._collect_repo_settings(org, repo))
            elif collection_type == 'branch_protection' and org and repo:
                collected.extend(self._collect_branch_protection(org, repo))
            elif collection_type == 'org_members' and org:
                collected.extend(self._collect_org_members(org))
            elif collection_type == 'security_alerts' and org and repo:
                collected.extend(self._collect_security_alerts(org, repo))

        except Exception as e:
            logger.error("GitHub collection failed", error=str(e), query=query)

        return collected

    def _collect_repo_settings(self, org: str, repo: str) -> List[CollectedEvidence]:
        response = requests.get(
            f'{self.base_url}/repos/{org}/{repo}',
            headers=self.headers
        )

        if response.status_code == 200:
            data = response.json()
            settings = {
                'name': data.get('name'),
                'full_name': data.get('full_name'),
                'private': data.get('private'),
                'default_branch': data.get('default_branch'),
                'has_issues': data.get('has_issues'),
                'has_projects': data.get('has_projects'),
                'has_wiki': data.get('has_wiki'),
                'allow_squash_merge': data.get('allow_squash_merge'),
                'allow_merge_commit': data.get('allow_merge_commit'),
                'allow_rebase_merge': data.get('allow_rebase_merge'),
                'delete_branch_on_merge': data.get('delete_branch_on_merge'),
            }

            return [CollectedEvidence(
                name=f'GitHub Repository Settings - {repo}',
                description=f'Repository settings for {org}/{repo}',
                content_type='json',
                data=settings,
                filename=f'github_{org}_{repo}_settings.json',
                metadata={
                    'source': 'github',
                    'collection_type': 'repository_settings',
                    'organization': org,
                    'repository': repo,
                }
            )]

        return []

    def _collect_branch_protection(self, org: str, repo: str) -> List[CollectedEvidence]:
        # Get default branch first
        repo_response = requests.get(
            f'{self.base_url}/repos/{org}/{repo}',
            headers=self.headers
        )

        if repo_response.status_code != 200:
            return []

        default_branch = repo_response.json().get('default_branch', 'main')

        response = requests.get(
            f'{self.base_url}/repos/{org}/{repo}/branches/{default_branch}/protection',
            headers=self.headers
        )

        if response.status_code == 200:
            data = response.json()
            protection = {
                'branch': default_branch,
                'enforce_admins': data.get('enforce_admins', {}).get('enabled', False),
                'required_pull_request_reviews': data.get('required_pull_request_reviews') is not None,
                'required_status_checks': data.get('required_status_checks') is not None,
                'restrictions': data.get('restrictions') is not None,
            }

            return [CollectedEvidence(
                name=f'GitHub Branch Protection - {repo}/{default_branch}',
                description=f'Branch protection rules for {org}/{repo}',
                content_type='json',
                data=protection,
                filename=f'github_{org}_{repo}_branch_protection.json',
                metadata={
                    'source': 'github',
                    'collection_type': 'branch_protection',
                    'organization': org,
                    'repository': repo,
                    'branch': default_branch,
                }
            )]

        return []

    def _collect_org_members(self, org: str) -> List[CollectedEvidence]:
        response = requests.get(
            f'{self.base_url}/orgs/{org}/members',
            headers=self.headers
        )

        if response.status_code == 200:
            members = response.json()
            member_data = []

            for member in members:
                member_data.append({
                    'login': member.get('login'),
                    'id': member.get('id'),
                    'type': member.get('type'),
                    'site_admin': member.get('site_admin'),
                })

            return [CollectedEvidence(
                name=f'GitHub Organization Members - {org}',
                description=f'Organization members for {org}',
                content_type='json',
                data=member_data,
                filename=f'github_{org}_members.json',
                metadata={
                    'source': 'github',
                    'collection_type': 'org_members',
                    'organization': org,
                    'member_count': len(member_data),
                }
            )]

        return []

    def _collect_security_alerts(self, org: str, repo: str) -> List[CollectedEvidence]:
        # Dependabot alerts
        response = requests.get(
            f'{self.base_url}/repos/{org}/{repo}/dependabot/alerts',
            headers=self.headers
        )

        alerts = []
        if response.status_code == 200:
            for alert in response.json():
                alerts.append({
                    'number': alert.get('number'),
                    'state': alert.get('state'),
                    'severity': alert.get('security_vulnerability', {}).get('severity'),
                    'package': alert.get('security_vulnerability', {}).get('package', {}).get('name'),
                    'created_at': alert.get('created_at'),
                })

        return [CollectedEvidence(
            name=f'GitHub Security Alerts - {repo}',
            description=f'Dependabot alerts for {org}/{repo}',
            content_type='json',
            data=alerts,
            filename=f'github_{org}_{repo}_security_alerts.json',
            metadata={
                'source': 'github',
                'collection_type': 'security_alerts',
                'organization': org,
                'repository': repo,
                'alert_count': len(alerts),
            }
        )]


class APIConnector(BaseConnector):
    """Generic API connector for custom evidence sources."""

    REQUIRED_CONFIG = ['base_url']

    def validate_config(self) -> List[str]:
        errors = []
        if 'base_url' not in self.config or not self.config['base_url']:
            errors.append("Missing required configuration: base_url")
        return errors

    def connect(self) -> bool:
        self.base_url = self.config.get('base_url', '').rstrip('/')
        self.headers = self.config.get('headers', {})

        # Add authentication if provided
        auth_type = self.config.get('auth_type')
        if auth_type == 'bearer':
            self.headers['Authorization'] = f"Bearer {self.config.get('token')}"
        elif auth_type == 'api_key':
            key_name = self.config.get('api_key_name', 'X-API-Key')
            self.headers[key_name] = self.config.get('api_key')

        self.connected = True
        return True

    def disconnect(self) -> None:
        self.connected = False

    def test_connection(self) -> Dict[str, Any]:
        try:
            if not self.connected:
                self.connect()

            test_endpoint = self.config.get('test_endpoint', '/')
            response = requests.get(
                f'{self.base_url}{test_endpoint}',
                headers=self.headers,
                timeout=10
            )

            return {
                'success': response.status_code < 400,
                'status_code': response.status_code,
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
            }

    def collect(self, query: str, parameters: Dict[str, Any]) -> List[CollectedEvidence]:
        try:
            if not self.connected:
                self.connect()

            endpoint = query or parameters.get('endpoint', '/')
            method = parameters.get('method', 'GET').upper()

            if method == 'GET':
                response = requests.get(
                    f'{self.base_url}{endpoint}',
                    headers=self.headers,
                    params=parameters.get('query_params', {}),
                    timeout=30
                )
            elif method == 'POST':
                response = requests.post(
                    f'{self.base_url}{endpoint}',
                    headers=self.headers,
                    json=parameters.get('body', {}),
                    timeout=30
                )
            else:
                return []

            if response.status_code < 400:
                try:
                    data = response.json()
                    content_type = 'json'
                except:
                    data = response.text
                    content_type = 'text'

                return [CollectedEvidence(
                    name=parameters.get('name', f'API Response - {endpoint}'),
                    description=parameters.get('description', f'Data collected from {self.base_url}{endpoint}'),
                    content_type=content_type,
                    data=data,
                    filename=parameters.get('filename', 'api_response.json'),
                    metadata={
                        'source': 'api',
                        'endpoint': endpoint,
                        'status_code': response.status_code,
                    }
                )]

        except Exception as e:
            logger.error("API collection failed", error=str(e), query=query)

        return []


# Connector registry
CONNECTORS = {
    'aws': AWSConnector,
    'azure': AzureConnector,
    'azure_ad': AzureConnector,
    'github': GitHubConnector,
    'api': APIConnector,
}


def get_connector(source_type: str, config: Dict[str, Any]) -> Optional[BaseConnector]:
    """Get a connector instance for the given source type."""
    connector_class = CONNECTORS.get(source_type)
    if connector_class:
        return connector_class(config)
    return None
