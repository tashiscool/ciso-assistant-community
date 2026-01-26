"""
PostgreSQL database backend with AWS RDS IAM Authentication support.

This backend automatically generates IAM authentication tokens for each new
database connection. IAM tokens expire after 15 minutes, so connections should
be configured with CONN_MAX_AGE < 900 seconds (we recommend 840 seconds / 14 minutes).

Configuration:
    Set RDS_IAM_AUTH=True in environment variables and configure:
    - POSTGRES_NAME: Database name
    - POSTGRES_USER: IAM database user (must have rds_iam role)
    - DB_HOST: RDS endpoint hostname
    - DB_PORT: Database port (default: 5432)
    - AWS_REGION: AWS region for the RDS instance

The IAM user/role running the application must have the following IAM policy:
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

And the PostgreSQL user must be granted the rds_iam role:
    GRANT rds_iam TO <db-user>;
"""

import logging
import threading
from functools import lru_cache
from time import time

from django.db.backends.postgresql import base

logger = logging.getLogger(__name__)

# Thread-local storage for caching tokens per thread
_token_cache = threading.local()

# Token refresh interval in seconds (refresh 1 minute before expiry)
TOKEN_REFRESH_INTERVAL = 840  # 14 minutes


def get_rds_auth_token(host: str, port: int, user: str, region: str) -> str:
    """
    Generate an IAM authentication token for RDS.

    The token is valid for 15 minutes. We cache it for 14 minutes to ensure
    we always have a valid token while minimizing API calls.
    """
    try:
        import boto3
    except ImportError:
        raise ImportError(
            "boto3 is required for RDS IAM authentication. "
            "Install it with: pip install boto3"
        )

    # Check thread-local cache
    cache_key = f"{host}:{port}:{user}:{region}"
    now = time()

    if hasattr(_token_cache, 'tokens'):
        cached = _token_cache.tokens.get(cache_key)
        if cached and (now - cached['timestamp']) < TOKEN_REFRESH_INTERVAL:
            return cached['token']
    else:
        _token_cache.tokens = {}

    # Generate new token
    logger.debug(
        "Generating new RDS IAM auth token for %s@%s:%s in region %s",
        user, host, port, region
    )

    client = boto3.client('rds', region_name=region)
    token = client.generate_db_auth_token(
        DBHostname=host,
        Port=port,
        DBUsername=user,
        Region=region
    )

    # Cache the token
    _token_cache.tokens[cache_key] = {
        'token': token,
        'timestamp': now
    }

    logger.info("Generated new RDS IAM auth token for %s@%s", user, host)
    return token


class DatabaseWrapper(base.DatabaseWrapper):
    """
    PostgreSQL database backend that uses AWS RDS IAM authentication.

    This backend generates a fresh IAM auth token for each new connection,
    ensuring that connections always use valid credentials.
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
        region = settings_dict.get('AWS_REGION', 'us-east-1')

        # Generate IAM auth token
        token = get_rds_auth_token(host, port, user, region)
        params['password'] = token

        return params

    def ensure_connection(self):
        """
        Ensure we have a valid connection, refreshing IAM token if needed.
        """
        if self.connection is not None:
            # Check if connection is still valid
            try:
                self.connection.cursor().execute('SELECT 1')
            except Exception:
                logger.warning("Database connection lost, reconnecting with fresh IAM token")
                self.close()

        super().ensure_connection()
