"""
Pytest Configuration for MIT-licensed Modules

This conftest provides Django mocking for testing MIT modules
without requiring a full Django setup.
"""

import sys
from unittest.mock import MagicMock, PropertyMock


def mock_django():
    """Mock Django and related packages for testing."""
    if 'django' in sys.modules:
        return  # Already imported, don't mock

    # Create mock Django module
    mock_django = MagicMock()
    mock_django.db = MagicMock()
    mock_django.db.models = MagicMock()
    mock_django.conf = MagicMock()
    mock_django.conf.settings = MagicMock()
    mock_django.conf.settings.AUTH_USER_MODEL = 'auth.User'
    mock_django.apps = MagicMock()
    mock_django.core = MagicMock()
    mock_django.core.files = MagicMock()
    mock_django.core.files.base = MagicMock()
    mock_django.http = MagicMock()
    mock_django.utils = MagicMock()
    mock_django.utils.timezone = MagicMock()
    mock_django.core.validators = MagicMock()

    # Mock model fields
    mock_django.db.models.Model = MagicMock
    mock_django.db.models.UUIDField = MagicMock(return_value=MagicMock())
    mock_django.db.models.CharField = MagicMock(return_value=MagicMock())
    mock_django.db.models.TextField = MagicMock(return_value=MagicMock())
    mock_django.db.models.IntegerField = MagicMock(return_value=MagicMock())
    mock_django.db.models.PositiveSmallIntegerField = MagicMock(return_value=MagicMock())
    mock_django.db.models.PositiveIntegerField = MagicMock(return_value=MagicMock())
    mock_django.db.models.BooleanField = MagicMock(return_value=MagicMock())
    mock_django.db.models.DateField = MagicMock(return_value=MagicMock())
    mock_django.db.models.DateTimeField = MagicMock(return_value=MagicMock())
    mock_django.db.models.DecimalField = MagicMock(return_value=MagicMock())
    mock_django.db.models.FloatField = MagicMock(return_value=MagicMock())
    mock_django.db.models.JSONField = MagicMock(return_value=MagicMock())
    mock_django.db.models.ForeignKey = MagicMock(return_value=MagicMock())
    mock_django.db.models.ManyToManyField = MagicMock(return_value=MagicMock())
    mock_django.db.models.CASCADE = 'CASCADE'
    mock_django.db.models.SET_NULL = 'SET_NULL'
    mock_django.db.models.PROTECT = 'PROTECT'
    mock_django.db.models.TextChoices = type('TextChoices', (), {})
    mock_django.db.models.Max = MagicMock()
    mock_django.db.models.Min = MagicMock()
    mock_django.db.models.Avg = MagicMock()
    mock_django.db.models.Sum = MagicMock()
    mock_django.db.models.Count = MagicMock()

    # Mock validators
    mock_django.core.validators.MinValueValidator = MagicMock(return_value=MagicMock())
    mock_django.core.validators.MaxValueValidator = MagicMock(return_value=MagicMock())

    # Install mocks
    sys.modules['django'] = mock_django
    sys.modules['django.db'] = mock_django.db
    sys.modules['django.db.models'] = mock_django.db.models
    sys.modules['django.conf'] = mock_django.conf
    sys.modules['django.conf.settings'] = mock_django.conf.settings
    sys.modules['django.apps'] = mock_django.apps
    sys.modules['django.core'] = mock_django.core
    sys.modules['django.core.files'] = mock_django.core.files
    sys.modules['django.core.files.base'] = mock_django.core.files.base
    sys.modules['django.http'] = mock_django.http
    sys.modules['django.utils'] = mock_django.utils
    sys.modules['django.utils.timezone'] = mock_django.utils.timezone
    sys.modules['django.core.validators'] = mock_django.core.validators

    # Mock REST Framework
    mock_rest = MagicMock()
    mock_rest.serializers = MagicMock()
    mock_rest.serializers.Serializer = MagicMock
    mock_rest.serializers.ModelSerializer = MagicMock
    mock_rest.viewsets = MagicMock()
    mock_rest.viewsets.ModelViewSet = MagicMock
    mock_rest.viewsets.ViewSet = MagicMock
    mock_rest.decorators = MagicMock()
    mock_rest.response = MagicMock()
    mock_rest.response.Response = MagicMock
    mock_rest.permissions = MagicMock()
    mock_rest.parsers = MagicMock()
    mock_rest.status = MagicMock()
    mock_rest.test = MagicMock()

    sys.modules['rest_framework'] = mock_rest
    sys.modules['rest_framework.serializers'] = mock_rest.serializers
    sys.modules['rest_framework.viewsets'] = mock_rest.viewsets
    sys.modules['rest_framework.decorators'] = mock_rest.decorators
    sys.modules['rest_framework.response'] = mock_rest.response
    sys.modules['rest_framework.permissions'] = mock_rest.permissions
    sys.modules['rest_framework.parsers'] = mock_rest.parsers
    sys.modules['rest_framework.status'] = mock_rest.status
    sys.modules['rest_framework.test'] = mock_rest.test


# Run mock setup when this module is imported
mock_django()
