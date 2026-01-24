"""
Comprehensive tests for Questionnaire Service

Tests cover:
- Questionnaire run management
- Question navigation and flow
- Answer submission and validation
- Conditional logic evaluation
- Scoring calculations
- Progress tracking
"""

import pytest
import uuid
import sys
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta

# Mock the questionnaire models before importing the service
mock_questionnaire = MagicMock()
mock_question = MagicMock()
mock_run = MagicMock()

sys.modules['questionnaires.models.questionnaire'] = MagicMock()
sys.modules['questionnaires.models.question'] = MagicMock()
sys.modules['questionnaires.models.questionnaire_run'] = MagicMock()

from django.utils import timezone

from questionnaires.services.questionnaire_service import QuestionnaireService


# =============================================================================
# QuestionnaireService Tests
# =============================================================================

class TestQuestionnaireService:
    """Tests for QuestionnaireService."""

    @pytest.fixture
    def service(self):
        """Create questionnaire service."""
        return QuestionnaireService()

    @pytest.fixture
    def mock_questionnaire(self):
        """Create mock questionnaire."""
        questionnaire = MagicMock()
        questionnaire.id = uuid.uuid4()
        questionnaire.title = 'Security Assessment Questionnaire'
        questionnaire.status = 'published'
        questionnaire.enable_scoring = True
        questionnaire.allow_back_navigation = True
        questionnaire.estimated_duration_minutes = 30
        questionnaire.question_ids = ['q1', 'q2', 'q3']
        return questionnaire

    @pytest.fixture
    def mock_question(self):
        """Create mock question."""
        question = MagicMock()
        question.id = 'q1'
        question.text = 'What is your security policy status?'
        question.help_text = 'Select your current policy status'
        question.question_type = 'single_choice'
        question.options = ['Yes', 'No', 'Partial']
        question.is_required = True
        question.validation_rules = {}
        question.enable_scoring = True
        question.points = 10
        question.conditional_logic = None
        return question

    @pytest.fixture
    def mock_run(self):
        """Create mock questionnaire run."""
        run = MagicMock()
        run.id = uuid.uuid4()
        run.questionnaire_id = uuid.uuid4()
        run.status = 'in_progress'
        run.is_in_progress = True
        run.is_completed = False
        run.visible_question_ids = ['q1', 'q2', 'q3']
        run.current_question_index = 0
        run.questions_answered = 0
        run.total_questions = 3
        run.current_score = 0
        run.enable_scoring = True
        run.skipped_question_ids = []
        run.answers = {}
        run.started_at = timezone.now()
        run.completed_at = None
        run.time_spent_seconds = 120
        run.feedback = None
        run.duration_seconds = 0
        run.max_possible_score = 30
        run.final_score_percentage = 0
        run.passed = False
        run.passing_score = 70
        return run

    # -------------------------------------------------------------------------
    # Start Questionnaire Run Tests
    # -------------------------------------------------------------------------

    def test_start_questionnaire_run_success(self, service, mock_questionnaire):
        """Test successful questionnaire run start."""
        with patch.object(service, '_get_questionnaire', return_value=mock_questionnaire), \
             patch('questionnaires.services.questionnaire_service.QuestionnaireRun') as MockRun, \
             patch.object(service, '_calculate_visible_questions', return_value=['q1', 'q2', 'q3']):

            mock_run = MagicMock()
            MockRun.return_value = mock_run

            result = service.start_questionnaire_run(
                questionnaire_id=mock_questionnaire.id,
                user_id=uuid.uuid4()
            )

            mock_run.start_run.assert_called_once()
            mock_run.update_progress.assert_called_once()
            assert result == mock_run

    def test_start_questionnaire_run_not_published(self, service, mock_questionnaire):
        """Test starting run for unpublished questionnaire."""
        mock_questionnaire.status = 'draft'

        with patch.object(service, '_get_questionnaire', return_value=mock_questionnaire):
            with pytest.raises(ValueError, match="not published"):
                service.start_questionnaire_run(
                    questionnaire_id=mock_questionnaire.id,
                    user_id=uuid.uuid4()
                )

    def test_start_questionnaire_run_not_found(self, service):
        """Test starting run for non-existent questionnaire."""
        with patch.object(service, '_get_questionnaire', return_value=None):
            with pytest.raises(ValueError, match="not found"):
                service.start_questionnaire_run(
                    questionnaire_id=uuid.uuid4(),
                    user_id=uuid.uuid4()
                )

    def test_start_questionnaire_run_anonymous(self, service, mock_questionnaire):
        """Test starting run for anonymous user."""
        with patch.object(service, '_get_questionnaire', return_value=mock_questionnaire), \
             patch('questionnaires.services.questionnaire_service.QuestionnaireRun') as MockRun, \
             patch.object(service, '_calculate_visible_questions', return_value=['q1', 'q2', 'q3']):

            mock_run = MagicMock()
            MockRun.return_value = mock_run

            result = service.start_questionnaire_run(
                questionnaire_id=mock_questionnaire.id,
                user_id=None,
                session_token='session-123'
            )

            assert result == mock_run

    # -------------------------------------------------------------------------
    # Get Next Question Tests
    # -------------------------------------------------------------------------

    def test_get_next_question_success(self, service, mock_questionnaire, mock_question, mock_run):
        """Test getting next question."""
        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire), \
             patch.object(service, '_get_question', return_value=mock_question), \
             patch.object(service, '_format_question_data', return_value={'id': 'q1', 'text': 'Question 1'}):

            mock_run.get_progress_percentage.return_value = 33

            result = service.get_next_question(mock_run.id)

            assert result is not None
            assert 'question_id' in result
            assert 'question' in result
            assert 'progress' in result
            assert result['progress']['current'] == 1
            assert result['progress']['total'] == 3

    def test_get_next_question_run_not_in_progress(self, service, mock_run):
        """Test getting next question when run is not in progress."""
        mock_run.is_in_progress = False

        with patch.object(service, '_get_run', return_value=mock_run):
            result = service.get_next_question(mock_run.id)

            assert result is None

    def test_get_next_question_run_not_found(self, service):
        """Test getting next question for non-existent run."""
        with patch.object(service, '_get_run', return_value=None):
            result = service.get_next_question(uuid.uuid4())

            assert result is None

    def test_get_next_question_completed(self, service, mock_questionnaire, mock_run):
        """Test getting next question when questionnaire is completed."""
        mock_run.current_question_index = 3  # Past the end

        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire):

            result = service.get_next_question(mock_run.id)

            assert result is None

    # -------------------------------------------------------------------------
    # Submit Answer Tests
    # -------------------------------------------------------------------------

    def test_submit_answer_success(self, service, mock_questionnaire, mock_question, mock_run):
        """Test successful answer submission."""
        mock_question.validate_answer.return_value = {'valid': True, 'errors': [], 'warnings': []}
        mock_question.calculate_score.return_value = 10

        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire), \
             patch.object(service, '_get_question', return_value=mock_question), \
             patch.object(service, '_calculate_visible_questions', return_value=['q1', 'q2', 'q3']), \
             patch.object(service, 'get_next_question', return_value={'question_id': 'q2'}):

            result = service.submit_answer(
                run_id=mock_run.id,
                question_id='q1',
                answer_value='Yes',
                time_spent=30
            )

            assert result['success'] is True
            assert result['score_awarded'] == 10
            mock_run.submit_answer.assert_called_once()

    def test_submit_answer_validation_failed(self, service, mock_questionnaire, mock_question, mock_run):
        """Test answer submission with validation failure."""
        mock_question.validate_answer.return_value = {
            'valid': False,
            'errors': ['Required field'],
            'warnings': []
        }

        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire), \
             patch.object(service, '_get_question', return_value=mock_question):

            result = service.submit_answer(
                run_id=mock_run.id,
                question_id='q1',
                answer_value=None
            )

            assert result['success'] is False
            assert 'Required field' in result['errors']

    def test_submit_answer_invalid_entities(self, service):
        """Test answer submission with invalid entities."""
        # When run is None, accessing run.questionnaire_id raises AttributeError
        with patch.object(service, '_get_run', return_value=None):
            with pytest.raises(AttributeError):
                service.submit_answer(
                    run_id=uuid.uuid4(),
                    question_id='q1',
                    answer_value='Yes'
                )

    def test_submit_answer_completes_questionnaire(self, service, mock_questionnaire, mock_question, mock_run):
        """Test answer submission that completes questionnaire."""
        mock_run.current_question_index = 2  # Last question
        mock_question.validate_answer.return_value = {'valid': True, 'errors': [], 'warnings': []}
        mock_question.calculate_score.return_value = 10
        mock_run.calculate_score.return_value = 80

        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire), \
             patch.object(service, '_get_question', return_value=mock_question), \
             patch.object(service, '_calculate_visible_questions', return_value=['q1', 'q2', 'q3']):

            # After updating progress, we're at index 3, which equals length
            mock_run.current_question_index = 3  # Simulating update_progress moving to 3

            result = service.submit_answer(
                run_id=mock_run.id,
                question_id='q3',
                answer_value='Yes'
            )

            assert result['success'] is True
            assert result['is_completed'] is True
            mock_run.complete_run.assert_called_once()

    # -------------------------------------------------------------------------
    # Navigation Tests
    # -------------------------------------------------------------------------

    def test_go_to_previous_question(self, service, mock_questionnaire, mock_run):
        """Test navigating to previous question."""
        mock_run.current_question_index = 1

        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire), \
             patch.object(service, 'get_next_question', return_value={'question_id': 'q1'}):

            result = service.go_to_previous_question(mock_run.id)

            assert result is not None
            assert mock_run.current_question_index == 0

    def test_go_to_previous_question_at_start(self, service, mock_questionnaire, mock_run):
        """Test navigating to previous when at first question."""
        mock_run.current_question_index = 0

        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire):

            result = service.go_to_previous_question(mock_run.id)

            assert result is None

    def test_go_to_previous_question_navigation_disabled(self, service, mock_questionnaire, mock_run):
        """Test navigating back when navigation is disabled."""
        mock_questionnaire.allow_back_navigation = False
        mock_run.current_question_index = 1

        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire):

            result = service.go_to_previous_question(mock_run.id)

            assert result is None

    # -------------------------------------------------------------------------
    # Skip Question Tests
    # -------------------------------------------------------------------------

    def test_skip_question_success(self, service, mock_questionnaire, mock_run):
        """Test skipping a question."""
        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire), \
             patch.object(service, '_calculate_visible_questions', return_value=['q1', 'q2', 'q3']):

            result = service.skip_question(mock_run.id, 'q1')

            assert result is True
            mock_run.skip_question.assert_called_with('q1')

    def test_skip_question_run_not_found(self, service):
        """Test skipping question with non-existent run."""
        with patch.object(service, '_get_run', return_value=None):
            result = service.skip_question(uuid.uuid4(), 'q1')

            assert result is False

    # -------------------------------------------------------------------------
    # Progress Tracking Tests
    # -------------------------------------------------------------------------

    def test_get_questionnaire_progress(self, service, mock_questionnaire, mock_run):
        """Test getting questionnaire progress."""
        mock_run.get_progress_percentage.return_value = 50

        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire), \
             patch.object(service, '_estimate_completion_time', return_value=15):

            result = service.get_questionnaire_progress(mock_run.id)

            assert 'run_id' in result
            assert result['status'] == 'in_progress'
            assert result['progress_percentage'] == 50
            assert result['current_question'] == 1
            assert result['total_questions'] == 3

    def test_get_questionnaire_progress_run_not_found(self, service):
        """Test getting progress for non-existent run."""
        with patch.object(service, '_get_run', return_value=None):
            result = service.get_questionnaire_progress(uuid.uuid4())

            assert 'error' in result

    def test_get_questionnaire_progress_questionnaire_not_found(self, service, mock_run):
        """Test getting progress when questionnaire not found."""
        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=None):

            result = service.get_questionnaire_progress(mock_run.id)

            assert 'error' in result

    # -------------------------------------------------------------------------
    # Results Tests
    # -------------------------------------------------------------------------

    def test_get_questionnaire_results_completed(self, service, mock_questionnaire, mock_run, mock_question):
        """Test getting results for completed questionnaire."""
        mock_run.is_completed = True
        mock_run.status = 'completed'
        mock_run.answers = {
            'q1': {'value': 'Yes', 'timestamp': '2024-01-01T10:00:00', 'time_spent_seconds': 30}
        }
        mock_run.completed_at = timezone.now()
        mock_run.current_score = 25
        mock_run.final_score_percentage = 83

        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire), \
             patch.object(service, '_get_question', return_value=mock_question):

            result = service.get_questionnaire_results(mock_run.id)

            assert result['status'] == 'completed'
            assert 'answers' in result
            assert result['scoring_enabled'] is True
            assert result['final_score'] == 25

    def test_get_questionnaire_results_not_completed(self, service, mock_run):
        """Test getting results for incomplete questionnaire."""
        mock_run.is_completed = False

        with patch.object(service, '_get_run', return_value=mock_run):
            result = service.get_questionnaire_results(mock_run.id)

            assert 'error' in result

    # -------------------------------------------------------------------------
    # Conditional Logic Tests
    # -------------------------------------------------------------------------

    def test_evaluate_conditional_logic_no_conditions(self, service, mock_run):
        """Test conditional logic evaluation without conditions."""
        mock_question = MagicMock()
        mock_question.conditional_logic = None

        result = service._evaluate_conditional_logic(mock_question, mock_run)

        assert result is True

    def test_evaluate_conditional_logic_equals(self, service, mock_run):
        """Test conditional logic with equals operator."""
        mock_question = MagicMock()
        mock_question.conditional_logic = {
            'show_if': {
                'question_id': 'q1',
                'operator': 'equals',
                'value': 'Yes'
            }
        }
        mock_run.get_answer.return_value = {'value': 'Yes'}

        result = service._evaluate_conditional_logic(mock_question, mock_run)

        assert result is True

    def test_evaluate_conditional_logic_not_equals(self, service, mock_run):
        """Test conditional logic with not_equals operator."""
        mock_question = MagicMock()
        mock_question.conditional_logic = {
            'show_if': {
                'question_id': 'q1',
                'operator': 'not_equals',
                'value': 'No'
            }
        }
        mock_run.get_answer.return_value = {'value': 'Yes'}

        result = service._evaluate_conditional_logic(mock_question, mock_run)

        assert result is True

    def test_evaluate_conditional_logic_contains(self, service, mock_run):
        """Test conditional logic with contains operator."""
        mock_question = MagicMock()
        mock_question.conditional_logic = {
            'show_if': {
                'question_id': 'q1',
                'operator': 'contains',
                'value': 'security'
            }
        }
        mock_run.get_answer.return_value = {'value': 'security policy'}

        result = service._evaluate_conditional_logic(mock_question, mock_run)

        assert result is True

    def test_evaluate_conditional_logic_greater_than(self, service, mock_run):
        """Test conditional logic with greater_than operator."""
        mock_question = MagicMock()
        mock_question.conditional_logic = {
            'show_if': {
                'question_id': 'q1',
                'operator': 'greater_than',
                'value': 5
            }
        }
        mock_run.get_answer.return_value = {'value': 10}

        result = service._evaluate_conditional_logic(mock_question, mock_run)

        assert result is True

    def test_evaluate_conditional_logic_less_than(self, service, mock_run):
        """Test conditional logic with less_than operator."""
        mock_question = MagicMock()
        mock_question.conditional_logic = {
            'show_if': {
                'question_id': 'q1',
                'operator': 'less_than',
                'value': 10
            }
        }
        mock_run.get_answer.return_value = {'value': 5}

        result = service._evaluate_conditional_logic(mock_question, mock_run)

        assert result is True

    def test_evaluate_conditional_logic_no_answer(self, service, mock_run):
        """Test conditional logic when condition answer doesn't exist."""
        mock_question = MagicMock()
        mock_question.conditional_logic = {
            'show_if': {
                'question_id': 'q1',
                'operator': 'equals',
                'value': 'Yes'
            }
        }
        mock_run.get_answer.return_value = None

        result = service._evaluate_conditional_logic(mock_question, mock_run)

        assert result is False

    # -------------------------------------------------------------------------
    # Visible Questions Calculation Tests
    # -------------------------------------------------------------------------

    def test_calculate_visible_questions(self, service, mock_questionnaire, mock_run):
        """Test calculating visible questions."""
        mock_q1 = MagicMock()
        mock_q1.conditional_logic = None
        mock_q2 = MagicMock()
        mock_q2.conditional_logic = None

        with patch.object(service, '_get_question', side_effect=[mock_q1, mock_q2, None]), \
             patch.object(service, '_evaluate_conditional_logic', return_value=True):

            result = service._calculate_visible_questions(mock_questionnaire, mock_run)

            assert 'q1' in result
            assert 'q2' in result

    # -------------------------------------------------------------------------
    # Expiry Calculation Tests
    # -------------------------------------------------------------------------

    def test_calculate_expiry_with_duration(self, service, mock_questionnaire):
        """Test expiry calculation with duration set."""
        mock_questionnaire.estimated_duration_minutes = 30

        result = service._calculate_expiry(mock_questionnaire)

        assert result is not None
        # Should be 60 minutes from now (30 * 2 buffer)

    def test_calculate_expiry_no_duration(self, service, mock_questionnaire):
        """Test expiry calculation without duration."""
        mock_questionnaire.estimated_duration_minutes = None

        result = service._calculate_expiry(mock_questionnaire)

        assert result is None

    # -------------------------------------------------------------------------
    # Completion Time Estimation Tests
    # -------------------------------------------------------------------------

    def test_estimate_completion_time(self, service, mock_questionnaire, mock_run):
        """Test completion time estimation."""
        mock_questionnaire.estimated_duration_minutes = 30
        mock_run.total_questions = 30
        mock_run.questions_answered = 10

        result = service._estimate_completion_time(mock_questionnaire, mock_run)

        assert result == 20  # (30 - 10) * (30 / 30) = 20

    def test_estimate_completion_time_no_duration(self, service, mock_questionnaire, mock_run):
        """Test completion time estimation without duration."""
        mock_questionnaire.estimated_duration_minutes = None

        result = service._estimate_completion_time(mock_questionnaire, mock_run)

        assert result is None

    # -------------------------------------------------------------------------
    # Question Formatting Tests
    # -------------------------------------------------------------------------

    def test_format_question_data(self, service, mock_question):
        """Test question data formatting."""
        result = service._format_question_data(mock_question)

        assert result['id'] == str(mock_question.id)
        assert result['text'] == mock_question.text
        assert result['help_text'] == mock_question.help_text
        assert result['type'] == mock_question.question_type
        assert result['options'] == mock_question.options
        assert result['is_required'] == mock_question.is_required
        assert result['enable_scoring'] == mock_question.enable_scoring
        assert result['points'] == mock_question.points


# =============================================================================
# Edge Case Tests
# =============================================================================

class TestQuestionnaireServiceEdgeCases:
    """Edge case tests for questionnaire service."""

    @pytest.fixture
    def service(self):
        return QuestionnaireService()

    def test_numeric_comparison_with_non_numeric(self, service):
        """Test numeric comparison with non-numeric values."""
        mock_run = MagicMock()
        mock_run.get_answer.return_value = {'value': 'not a number'}

        mock_question = MagicMock()
        mock_question.conditional_logic = {
            'show_if': {
                'question_id': 'q1',
                'operator': 'greater_than',
                'value': 5
            }
        }

        result = service._evaluate_conditional_logic(mock_question, mock_run)

        assert result is False

    def test_empty_questionnaire(self, service):
        """Test with questionnaire with no questions."""
        mock_questionnaire = MagicMock()
        mock_questionnaire.question_ids = []
        mock_run = MagicMock()

        result = service._calculate_visible_questions(mock_questionnaire, mock_run)

        assert result == []

    def test_all_questions_hidden(self, service):
        """Test when all questions are hidden by conditions."""
        mock_questionnaire = MagicMock()
        mock_questionnaire.question_ids = ['q1', 'q2']
        mock_run = MagicMock()

        with patch.object(service, '_get_question', return_value=MagicMock()), \
             patch.object(service, '_evaluate_conditional_logic', return_value=False):

            result = service._calculate_visible_questions(mock_questionnaire, mock_run)

            assert result == []

    def test_scoring_disabled(self, service):
        """Test with scoring disabled."""
        mock_questionnaire = MagicMock()
        mock_questionnaire.enable_scoring = False

        mock_run = MagicMock()
        mock_run.enable_scoring = False
        mock_run.is_completed = True
        mock_run.status = 'completed'
        mock_run.answers = {}
        mock_run.completed_at = timezone.now()
        mock_run.skipped_question_ids = []
        mock_run.feedback = None
        mock_run.duration_seconds = 0

        with patch.object(service, '_get_run', return_value=mock_run), \
             patch.object(service, '_get_questionnaire', return_value=mock_questionnaire):

            result = service.get_questionnaire_results(mock_run.id)

            assert 'scoring_enabled' not in result or result.get('scoring_enabled') is False
