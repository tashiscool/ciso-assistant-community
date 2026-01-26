"""
Management command to test RDS IAM authentication.

Usage:
    python manage.py test_rds_iam

This command tests the IAM authentication configuration by:
1. Generating an IAM auth token
2. Attempting to connect to the database
3. Running a simple query to verify the connection
"""

from django.core.management.base import BaseCommand
from django.conf import settings
import json


class Command(BaseCommand):
    help = 'Test RDS IAM authentication connection'

    def add_arguments(self, parser):
        parser.add_argument(
            '--host',
            type=str,
            help='RDS hostname (defaults to DB_HOST from settings)',
        )
        parser.add_argument(
            '--port',
            type=int,
            default=5432,
            help='RDS port (default: 5432)',
        )
        parser.add_argument(
            '--user',
            type=str,
            help='Database user (defaults to POSTGRES_USER from settings)',
        )
        parser.add_argument(
            '--database',
            type=str,
            help='Database name (defaults to POSTGRES_NAME from settings)',
        )
        parser.add_argument(
            '--region',
            type=str,
            default='us-gov-west-1',
            help='AWS region (default: us-gov-west-1)',
        )
        parser.add_argument(
            '--json',
            action='store_true',
            help='Output results as JSON',
        )

    def handle(self, *args, **options):
        from ciso_assistant.database.backends.postgresql_iam import (
            test_iam_auth_connection,
            is_govcloud_region
        )

        # Get connection parameters
        db_settings = settings.DATABASES.get('default', {})

        host = options['host'] or db_settings.get('HOST', 'localhost')
        port = options['port'] or int(db_settings.get('PORT', 5432))
        user = options['user'] or db_settings.get('USER', '')
        database = options['database'] or db_settings.get('NAME', '')
        region = options['region'] or db_settings.get('AWS_REGION', 'us-gov-west-1')

        if not options['json']:
            self.stdout.write(self.style.NOTICE('Testing RDS IAM Authentication'))
            self.stdout.write(f'  Host: {host}')
            self.stdout.write(f'  Port: {port}')
            self.stdout.write(f'  User: {user}')
            self.stdout.write(f'  Database: {database}')
            self.stdout.write(f'  Region: {region}')
            self.stdout.write(f'  GovCloud: {is_govcloud_region(region)}')
            self.stdout.write('')

        # Test connection
        result = test_iam_auth_connection(
            host=host,
            port=port,
            user=user,
            database=database,
            region=region
        )

        if options['json']:
            self.stdout.write(json.dumps(result, indent=2))
        else:
            if result['success']:
                self.stdout.write(self.style.SUCCESS('Connection test PASSED'))
                self.stdout.write(f'  Token generated: {result["token_generated"]}')
                self.stdout.write(f'  Connection established: {result["connection_established"]}')
                if result.get('postgres_version'):
                    self.stdout.write(f'  PostgreSQL version: {result["postgres_version"]}')
            else:
                self.stdout.write(self.style.ERROR('Connection test FAILED'))
                self.stdout.write(f'  Token generated: {result["token_generated"]}')
                self.stdout.write(f'  Connection established: {result["connection_established"]}')
                if result.get('error'):
                    self.stdout.write(f'  Error: {result["error"]}')

        return 0 if result['success'] else 1
