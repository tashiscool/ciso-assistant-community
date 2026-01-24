"""
Comprehensive tests for AI Assistant Services

Tests cover:
- LLM Client abstraction layer
- Control statement generation
- Policy extraction
- Control effectiveness evaluation
- Control explanation
- Mock client for testing
"""

import pytest
from unittest.mock import Mock, patch

from ai_assistant.services.llm_client import (
    LLMProvider,
    LLMConfig,
    LLMMessage,
    LLMResponse,
    OpenAIClient,
    AnthropicClient,
    MockLLMClient,
    create_llm_client,
    get_default_llm_client,
    set_default_llm_client,
)


# =============================================================================
# LLMConfig Tests
# =============================================================================

class TestLLMConfig:
    """Tests for LLMConfig dataclass."""

    def test_config_defaults(self):
        """Test LLMConfig default values."""
        config = LLMConfig(provider=LLMProvider.OPENAI)

        assert config.provider == LLMProvider.OPENAI
        assert config.model == 'gpt-4'
        assert config.api_key is None
        assert config.base_url is None
        assert config.max_tokens == 4096
        assert config.temperature == 0.7
        assert config.timeout == 60
        assert config.retry_count == 3
        assert config.extra_config == {}

    def test_config_with_custom_values(self):
        """Test LLMConfig with custom values."""
        config = LLMConfig(
            provider=LLMProvider.ANTHROPIC,
            api_key='test-key',
            model='claude-3-5-sonnet-20241022',
            max_tokens=8192,
            temperature=0.5,
            timeout=120,
        )

        assert config.provider == LLMProvider.ANTHROPIC
        assert config.api_key == 'test-key'
        assert config.model == 'claude-3-5-sonnet-20241022'
        assert config.max_tokens == 8192
        assert config.temperature == 0.5


# =============================================================================
# LLMMessage Tests
# =============================================================================

class TestLLMMessage:
    """Tests for LLMMessage dataclass."""

    def test_create_system_message(self):
        """Test creating a system message."""
        msg = LLMMessage(role='system', content='You are a helpful assistant.')

        assert msg.role == 'system'
        assert msg.content == 'You are a helpful assistant.'

    def test_create_user_message(self):
        """Test creating a user message."""
        msg = LLMMessage(role='user', content='Help me with this control.')

        assert msg.role == 'user'
        assert msg.content == 'Help me with this control.'

    def test_create_assistant_message(self):
        """Test creating an assistant message."""
        msg = LLMMessage(role='assistant', content='Here is my response.')

        assert msg.role == 'assistant'
        assert msg.content == 'Here is my response.'

    def test_to_dict(self):
        """Test converting message to dictionary."""
        msg = LLMMessage(role='user', content='Test content')

        result = msg.to_dict()

        assert result == {'role': 'user', 'content': 'Test content'}


# =============================================================================
# LLMResponse Tests
# =============================================================================

class TestLLMResponse:
    """Tests for LLMResponse dataclass."""

    def test_response_creation(self):
        """Test creating an LLM response."""
        response = LLMResponse(
            content='Generated text',
            model='gpt-4',
            usage={
                'prompt_tokens': 100,
                'completion_tokens': 50,
                'total_tokens': 150,
            },
            finish_reason='stop',
        )

        assert response.content == 'Generated text'
        assert response.model == 'gpt-4'
        assert response.finish_reason == 'stop'

    def test_input_tokens_property(self):
        """Test input_tokens property."""
        response = LLMResponse(
            content='Test',
            model='gpt-4',
            usage={'prompt_tokens': 100, 'completion_tokens': 50, 'total_tokens': 150},
            finish_reason='stop',
        )

        assert response.input_tokens == 100

    def test_output_tokens_property(self):
        """Test output_tokens property."""
        response = LLMResponse(
            content='Test',
            model='gpt-4',
            usage={'prompt_tokens': 100, 'completion_tokens': 50, 'total_tokens': 150},
            finish_reason='stop',
        )

        assert response.output_tokens == 50

    def test_total_tokens_property(self):
        """Test total_tokens property."""
        response = LLMResponse(
            content='Test',
            model='gpt-4',
            usage={'prompt_tokens': 100, 'completion_tokens': 50, 'total_tokens': 150},
            finish_reason='stop',
        )

        assert response.total_tokens == 150

    def test_missing_usage_keys(self):
        """Test properties handle missing usage keys."""
        response = LLMResponse(
            content='Test',
            model='gpt-4',
            usage={},
            finish_reason='stop',
        )

        assert response.input_tokens == 0
        assert response.output_tokens == 0
        assert response.total_tokens == 0


# =============================================================================
# LLMProvider Tests
# =============================================================================

class TestLLMProvider:
    """Tests for LLMProvider enum."""

    def test_provider_values(self):
        """Test LLMProvider enum values."""
        assert LLMProvider.OPENAI.value == 'openai'
        assert LLMProvider.ANTHROPIC.value == 'anthropic'
        assert LLMProvider.AZURE_OPENAI.value == 'azure_openai'
        assert LLMProvider.LOCAL.value == 'local'

    def test_provider_from_string(self):
        """Test creating provider from string."""
        provider = LLMProvider('openai')
        assert provider == LLMProvider.OPENAI

        provider = LLMProvider('anthropic')
        assert provider == LLMProvider.ANTHROPIC


# =============================================================================
# MockLLMClient Tests
# =============================================================================

class TestMockLLMClient:
    """Tests for MockLLMClient."""

    def test_mock_client_initialization(self):
        """Test mock client initialization."""
        config = LLMConfig(provider=LLMProvider.LOCAL)
        client = MockLLMClient(config)

        assert client.config == config

    def test_mock_chat_response(self):
        """Test mock chat returns valid response."""
        config = LLMConfig(provider=LLMProvider.LOCAL)
        client = MockLLMClient(config)

        messages = [
            LLMMessage(role='system', content='You are helpful.'),
            LLMMessage(role='user', content='Generate a control statement.'),
        ]

        response = client.chat(messages)

        assert isinstance(response, LLMResponse)
        assert '[Mock LLM Response]' in response.content
        assert response.model == 'mock-model'
        assert response.finish_reason == 'stop'
        assert response.total_tokens == 150

    def test_mock_complete_response(self):
        """Test mock complete returns valid response."""
        config = LLMConfig(provider=LLMProvider.LOCAL)
        client = MockLLMClient(config)

        response = client.complete('Generate a control.')

        assert isinstance(response, LLMResponse)
        assert '[Mock LLM Completion]' in response.content
        assert response.model == 'mock-model'


# =============================================================================
# BaseLLMClient Method Tests
# =============================================================================

class TestBaseLLMClientMethods:
    """Tests for BaseLLMClient methods using MockLLMClient."""

    @pytest.fixture
    def client(self):
        """Create a mock client for testing."""
        config = LLMConfig(provider=LLMProvider.LOCAL)
        return MockLLMClient(config)

    def test_generate_control_draft(self, client):
        """Test generating control draft."""
        requirement = 'The organization shall implement multi-factor authentication.'

        result = client.generate_control_draft(
            requirement_text=requirement,
            framework='FedRAMP',
        )

        assert isinstance(result, str)
        assert len(result) > 0

    def test_generate_control_draft_with_context(self, client):
        """Test generating control draft with context."""
        requirement = 'Implement access controls.'
        context = 'Cloud-based SaaS application'

        result = client.generate_control_draft(
            requirement_text=requirement,
            framework='NIST 800-53',
            context=context,
        )

        assert isinstance(result, str)

    def test_extract_controls_from_policy(self, client):
        """Test extracting controls from policy."""
        policy_text = """
        Access Control Policy:
        1. All users must use MFA for authentication.
        2. Passwords must be at least 16 characters.
        3. Access is reviewed quarterly.
        """

        result = client.extract_controls_from_policy(
            policy_text=policy_text,
            framework='FedRAMP',
        )

        assert isinstance(result, list)

    def test_evaluate_control_effectiveness(self, client):
        """Test evaluating control effectiveness."""
        result = client.evaluate_control_effectiveness(
            control_description='MFA is enforced for all user accounts.',
            requirement_text='The system shall require MFA for all users.',
            evidence_summary='Okta MFA configuration screenshots.',
        )

        assert isinstance(result, dict)
        assert 'evaluation' in result
        assert 'model' in result

    def test_explain_control_executive(self, client):
        """Test explaining control for executive audience."""
        control_text = 'AC-2: Account Management'

        result = client.explain_control(
            control_text=control_text,
            audience='executive',
        )

        assert isinstance(result, str)
        assert len(result) > 0

    def test_explain_control_engineer(self, client):
        """Test explaining control for engineer audience."""
        control_text = 'SC-13: Cryptographic Protection'

        result = client.explain_control(
            control_text=control_text,
            audience='engineer',
        )

        assert isinstance(result, str)


# =============================================================================
# OpenAI Client Tests
# =============================================================================

class TestOpenAIClient:
    """Tests for OpenAI client."""

    def test_client_initialization(self):
        """Test OpenAI client initialization."""
        config = LLMConfig(
            provider=LLMProvider.OPENAI,
            api_key='test-key',
            model='gpt-4',
        )
        client = OpenAIClient(config)

        assert client.config == config
        assert client._client is None  # Lazy initialization

    def test_complete_uses_chat(self):
        """Test complete method uses chat under the hood."""
        config = LLMConfig(provider=LLMProvider.OPENAI, api_key='test-key')
        client = OpenAIClient(config)

        mock_response = LLMResponse(
            content='Completion',
            model='gpt-4',
            usage={'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15},
            finish_reason='stop',
        )
        client.chat = Mock(return_value=mock_response)

        response = client.complete('Test prompt')

        client.chat.assert_called_once()
        assert response.content == 'Completion'


# =============================================================================
# Anthropic Client Tests
# =============================================================================

class TestAnthropicClient:
    """Tests for Anthropic client."""

    def test_client_initialization(self):
        """Test Anthropic client initialization."""
        config = LLMConfig(
            provider=LLMProvider.ANTHROPIC,
            api_key='test-key',
            model='claude-3-5-sonnet-20241022',
        )
        client = AnthropicClient(config)

        assert client.config == config
        assert client._client is None

    def test_complete_uses_chat(self):
        """Test complete method uses chat under the hood."""
        config = LLMConfig(provider=LLMProvider.ANTHROPIC, api_key='test-key')
        client = AnthropicClient(config)

        mock_response = LLMResponse(
            content='Claude response',
            model='claude-3-5-sonnet-20241022',
            usage={'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15},
            finish_reason='end_turn',
        )
        client.chat = Mock(return_value=mock_response)

        response = client.complete('Test prompt')

        client.chat.assert_called_once()
        assert response.content == 'Claude response'


# =============================================================================
# Factory Function Tests
# =============================================================================

class TestCreateLLMClient:
    """Tests for create_llm_client factory function."""

    def test_create_mock_client(self):
        """Test creating mock client."""
        client = create_llm_client(provider='mock')

        assert isinstance(client, MockLLMClient)

    def test_create_openai_client(self):
        """Test creating OpenAI client."""
        config = LLMConfig(provider=LLMProvider.OPENAI, api_key='test-key')
        client = create_llm_client(config=config)

        assert isinstance(client, OpenAIClient)

    def test_create_anthropic_client(self):
        """Test creating Anthropic client."""
        config = LLMConfig(provider=LLMProvider.ANTHROPIC, api_key='test-key')
        client = create_llm_client(config=config)

        assert isinstance(client, AnthropicClient)

    def test_invalid_provider_raises_error(self):
        """Test invalid provider raises ValueError."""
        with pytest.raises(ValueError):
            create_llm_client(provider='invalid_provider')


# =============================================================================
# Default Client Tests
# =============================================================================

class TestDefaultClient:
    """Tests for default client management."""

    def test_set_default_client(self):
        """Test setting default client."""
        mock_client = MockLLMClient(LLMConfig(provider=LLMProvider.LOCAL))

        set_default_llm_client(mock_client)
        result = get_default_llm_client()

        assert result == mock_client


# =============================================================================
# Integration Tests
# =============================================================================

class TestLLMClientIntegration:
    """Integration tests for LLM client workflows."""

    @pytest.fixture
    def mock_client(self):
        """Create a mock client for integration tests."""
        config = LLMConfig(provider=LLMProvider.LOCAL)
        return MockLLMClient(config)

    def test_full_control_generation_workflow(self, mock_client):
        """Test complete control generation workflow."""
        # Step 1: Generate control draft
        draft = mock_client.generate_control_draft(
            requirement_text='Implement account management controls.',
            framework='FedRAMP',
        )
        assert len(draft) > 0

        # Step 2: Evaluate effectiveness
        evaluation = mock_client.evaluate_control_effectiveness(
            control_description=draft,
            requirement_text='Implement account management controls.',
        )
        assert 'evaluation' in evaluation

        # Step 3: Explain for different audiences
        executive_explanation = mock_client.explain_control(draft, audience='executive')
        engineer_explanation = mock_client.explain_control(draft, audience='engineer')

        assert len(executive_explanation) > 0
        assert len(engineer_explanation) > 0

    def test_conversation_with_multiple_messages(self, mock_client):
        """Test multi-turn conversation."""
        messages = [
            LLMMessage(role='system', content='You are a compliance expert.'),
            LLMMessage(role='user', content='What is AC-2?'),
            LLMMessage(role='assistant', content='AC-2 is Account Management...'),
            LLMMessage(role='user', content='How do I implement it?'),
        ]

        response = mock_client.chat(messages)

        assert isinstance(response, LLMResponse)
        assert response.content is not None
