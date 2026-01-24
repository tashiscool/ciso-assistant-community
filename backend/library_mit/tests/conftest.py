"""
Library MIT Test Configuration
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
    sys.modules['rest_framework'] = MagicMock()
    sys.modules['rest_framework.serializers'] = MagicMock()
    sys.modules['rest_framework.viewsets'] = MagicMock()
    sys.modules['rest_framework.parsers'] = MagicMock()
