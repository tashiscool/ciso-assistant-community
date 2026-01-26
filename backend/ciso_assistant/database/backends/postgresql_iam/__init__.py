"""
PostgreSQL database backend with AWS RDS IAM Authentication support.

This backend automatically generates IAM authentication tokens for each new
database connection. IAM tokens expire after 15 minutes, so connections should
be configured with CONN_MAX_AGE < 900 seconds (we recommend 840 seconds / 14 minutes).

Supports both AWS Commercial and AWS GovCloud regions.

Configuration:
    Set RDS_IAM_AUTH=True in environment variables and configure:
    - POSTGRES_NAME: Database name
    - POSTGRES_USER: IAM database user (must have rds_iam role)
    - DB_HOST: RDS endpoint hostname
    - DB_PORT: Database port (default: 5432)
    - AWS_REGION: AWS region for the RDS instance (default: us-gov-west-1)

The IAM user/role running the application must have the following IAM policy:

For AWS Commercial:
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "rds-db:connect",
            "Resource": "arn:aws:rds-db:<region>:<account>:dbuser:<resource-id>/<db-user>"
        }
    ]
}

For AWS GovCloud:
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "rds-db:connect",
            "Resource": "arn:aws-us-gov:rds-db:<region>:<account>:dbuser:<resource-id>/<db-user>"
        }
    ]
}

And the PostgreSQL user must be granted the rds_iam role:
    GRANT rds_iam TO <db-user>;
"""

import logging
import threading
from time import time
from typing import Dict, Any

from django.db.backends.postgresql import base

logger = logging.getLogger(__name__)

# Thread-local storage for caching tokens per thread
_token_cache = threading.local()

# Token refresh interval in seconds (refresh 1 minute before expiry)
TOKEN_REFRESH_INTERVAL = 840  # 14 minutes

# GovCloud region prefixes
GOVCLOUD_REGION_PREFIXES = ('us-gov-', 'us-iso-', 'us-isob-')


def is_govcloud_region(region: str) -> bool:
    """Check if the region is a GovCloud or isolated region."""
    return any(region.startswith(prefix) for prefix in GOVCLOUD_REGION_PREFIXES)


def get_rds_client(region: str):
    """
    Get an RDS client for the specified region.

    Handles both commercial AWS and GovCloud regions.
    """
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        raise ImportError(
            "boto3 is required for RDS IAM authentication. "
            "Install it with: pip install boto3"
        )

    # Configure retry settings for reliability
    config = Config(
        retries={
            'max_attempts': 3,
            'mode': 'adaptive'
        },
        connect_timeout=5,
        read_timeout=10
    )

    # boto3 automatically handles GovCloud endpoints based on region
    client = boto3.client('rds', region_name=region, config=config)

    return client


def get_rds_auth_token(host: str, port: int, user: str, region: str) -> str:
    """
    Generate an IAM authentication token for RDS.

    The token is valid for 15 minutes. We cache it for 14 minutes to ensure
    we always have a valid token while minimizing API calls.

    Works with both AWS Commercial and GovCloud regions.
    """
    # Check thread-local cache
    cache_key = f"{host}:{port}:{user}:{region}"
    now = time()

    if hasattr(_token_cache, 'tokens'):
        cached = _token_cache.tokens.get(cache_key)
        if cached and (now - cached['timestamp']) < TOKEN_REFRESH_INTERVAL:
            logger.debug("Using cached RDS IAM auth token for %s@%s", user, host)
            return cached['token']
    else:
        _token_cache.tokens = {}

    # Generate new token
    region_type = "GovCloud" if is_govcloud_region(region) else "Commercial"
    logger.info(
        "Generating new RDS IAM auth token for %s@%s:%s in region %s (%s)",
        user, host, port, region, region_type
    )

    try:
        client = get_rds_client(region)
        token = client.generate_db_auth_token(
            DBHostname=host,
            Port=port,
            DBUsername=user,
            Region=region
        )
    except Exception as e:
        logger.error(
            "Failed to generate RDS IAM auth token for %s@%s in region %s: %s",
            user, host, region, str(e)
        )
        raise

    # Cache the token
    _token_cache.tokens[cache_key] = {
        'token': token,
        'timestamp': now
    }

    logger.info(
        "Successfully generated RDS IAM auth token for %s@%s (expires in 15 min)",
        user, host
    )
    return token


def clear_token_cache():
    """Clear the token cache. Useful for testing or forced refresh."""
    if hasattr(_token_cache, 'tokens'):
        _token_cache.tokens.clear()
        logger.info("RDS IAM auth token cache cleared")


class DatabaseWrapper(base.DatabaseWrapper):
    """
    PostgreSQL database backend that uses AWS RDS IAM authentication.

    This backend generates a fresh IAM auth token for each new connection,
    ensuring that connections always use valid credentials.

    Supports both AWS Commercial and GovCloud regions.
    """

    def get_connection_params(self):
        """
        Get connection parameters with IAM auth token as password.
        """
        params = super().get_connection_params()

        # Get IAM auth configuration
        settings_dict = self.settings_dict
        host = settings_dict.get('HOST', 'localhost')
        port = int(settings_dict.get('PORT', 5432))
        user = settings_dict.get('USER', '')
        region = settings_dict.get('AWS_REGION', 'us-gov-west-1')

        # Generate IAM auth token
        token = get_rds_auth_token(host, port, user, region)
        params['password'] = token

        # Ensure SSL is enabled (required for IAM auth)
        if 'sslmode' not in params:
            params['sslmode'] = 'require'

        return params

    def ensure_connection(self):
        """
        Ensure we have a valid connection, refreshing IAM token if needed.
        """
        if self.connection is not None:
            # Check if connection is still valid
            try:
                with self.connection.cursor() as cursor:
                    cursor.execute('SELECT 1')
            except Exception as e:
                logger.warning(
                    "Database connection check failed (%s), reconnecting with fresh IAM token",
                    str(e)
                )
                self.close()

        super().ensure_connection()

    def _cursor(self):
        """
        Return a cursor, ensuring connection is valid.

        Override to add connection validation before returning cursor.
        """
        self.ensure_connection()
        return super()._cursor()


# Utility functions for health checks
def test_iam_auth_connection(
    host: str,
    port: int,
    user: str,
    database: str,
    region: str = 'us-gov-west-1'
) -> Dict[str, Any]:
    """
    Test IAM authentication connection to RDS.

    Returns a dict with connection test results.
    Useful for health checks and debugging.
    """
    try:
        import psycopg2
    except ImportError:
        return {
            'success': False,
            'error': 'psycopg2 not installed'
        }

    result = {
        'success': False,
        'host': host,
        'port': port,
        'user': user,
        'database': database,
        'region': region,
        'is_govcloud': is_govcloud_region(region),
        'error': None,
        'token_generated': False,
        'connection_established': False,
    }

    try:
        # Generate token
        token = get_rds_auth_token(host, port, user, region)
        result['token_generated'] = True

        # Test connection
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=token,
            database=database,
            sslmode='require',
            connect_timeout=10
        )

        # Verify connection works
        with conn.cursor() as cursor:
            cursor.execute('SELECT version()')
            version = cursor.fetchone()[0]
            result['postgres_version'] = version

        conn.close()
        result['connection_established'] = True
        result['success'] = True

    except Exception as e:
        result['error'] = str(e)
        logger.error("IAM auth connection test failed: %s", str(e))

    return result
