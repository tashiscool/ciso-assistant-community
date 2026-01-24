"""
Serdes MIT Test Configuration
"""

import sys
from unittest.mock import MagicMock

# Mock Django before any imports
if 'django' not in sys.modules:
    mock_django = MagicMock()
    sys.modules['django'] = mock_django
    sys.modules['django.db'] = MagicMock()
    sys.modules['django.db.models'] = MagicMock()
    sys.modules['django.conf'] = MagicMock()
    sys.modules['django.apps'] = MagicMock()
    sys.modules['django.core'] = MagicMock()
    sys.modules['django.core.files'] = MagicMock()
    sys.modules['django.core.files.base'] = MagicMock()
    sys.modules['django.http'] = MagicMock()
    sys.modules['rest_framework'] = MagicMock()
    sys.modules['rest_framework.decorators'] = MagicMock()
    sys.modules['rest_framework.response'] = MagicMock()
    sys.modules['rest_framework.permissions'] = MagicMock()
    sys.modules['rest_framework.parsers'] = MagicMock()
    sys.modules['rest_framework.status'] = MagicMock()
    sys.modules['rest_framework.test'] = MagicMock()
