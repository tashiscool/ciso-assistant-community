"""
Assessment Engine Module

Provides rapid assessment execution capabilities including:
- Lightning Assessment: Quick, focused assessments
- Master Assessment: Grouped control testing across multiple frameworks
- Assessment Templates: Reusable assessment configurations
- Bulk Operations: Mass status updates and evidence linking
"""

from .models import (
    LightningAssessment,
    MasterAssessment,
    AssessmentTemplate,
    AssessmentRun,
    ControlGroup,
    TestCase,
    TestResult,
)
from .services import (
    LightningAssessmentService,
    MasterAssessmentService,
    AssessmentExecutionService,
    BulkOperationService,
)

__all__ = [
    'LightningAssessment',
    'MasterAssessment',
    'AssessmentTemplate',
    'AssessmentRun',
    'ControlGroup',
    'TestCase',
    'TestResult',
    'LightningAssessmentService',
    'MasterAssessmentService',
    'AssessmentExecutionService',
    'BulkOperationService',
]
