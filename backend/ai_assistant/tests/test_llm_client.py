"""
Tests for LLM Client Abstraction Layer

Tests cover:
- LLM Provider enum
- Configuration dataclasses
- Message and Response dataclasses
- BaseLLMClient methods
- MockLLMClient functionality
- Client factory function
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os

from ai_assistant.services.llm_client import (
    LLMProvider,
    LLMConfig,
    LLMMessage,
    LLMResponse,
    BaseLLMClient,
    OpenAIClient,
    AnthropicClient,
    AzureOpenAIClient,
    LocalLLMClient,
    MockLLMClient,
    create_llm_client,
    get_default_llm_client,
    set_default_llm_client,
)


# =============================================================================
# LLMProvider Enum Tests
# =============================================================================

class TestLLMProvider:
    """Tests for LLMProvider enum."""

    def test_provider_values(self):
        """Test provider enum values."""
        assert LLMProvider.OPENAI == 'openai'
        assert LLMProvider.ANTHROPIC == 'anthropic'
        assert LLMProvider.AZURE_OPENAI == 'azure_openai'
        assert LLMProvider.LOCAL == 'local'

    def test_provider_from_string(self):
        """Test creating provider from string."""
        assert LLMProvider('openai') == LLMProvider.OPENAI
        assert LLMProvider('anthropic') == LLMProvider.ANTHROPIC

    def test_provider_str_value(self):
        """Test provider string representation."""
        assert str(LLMProvider.OPENAI.value) == 'openai'


# =============================================================================
# LLMConfig Tests
# =============================================================================

class TestLLMConfig:
    """Tests for LLMConfig dataclass."""

    def test_default_config(self):
        """Test config with default values."""
        config = LLMConfig(provider=LLMProvider.OPENAI)

        assert config.provider == LLMProvider.OPENAI
        assert config.api_key is None
        assert config.model == 'gpt-4'
        assert config.base_url is None
        assert config.max_tokens == 4096
        assert config.temperature == 0.7
        assert config.timeout == 60
        assert config.retry_count == 3
        assert config.extra_config == {}

    def test_custom_config(self):
        """Test config with custom values."""
        config = LLMConfig(
            provider=LLMProvider.ANTHROPIC,
            api_key='test-key',
            model='claude-3-5-sonnet',
            max_tokens=8192,
            temperature=0.5,
            timeout=120,
            extra_config={'custom_field': 'value'},
        )

        assert config.api_key == 'test-key'
        assert config.model == 'claude-3-5-sonnet'
        assert config.max_tokens == 8192
        assert config.temperature == 0.5
        assert config.extra_config['custom_field'] == 'value'


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
        msg = LLMMessage(role='user', content='Hello, world!')
        assert msg.role == 'user'

    def test_create_assistant_message(self):
        """Test creating an assistant message."""
        msg = LLMMessage(role='assistant', content='Hello! How can I help?')
        assert msg.role == 'assistant'

    def test_to_dict(self):
        """Test message serialization."""
        msg = LLMMessage(role='user', content='Test content')
        result = msg.to_dict()

        assert result == {'role': 'user', 'content': 'Test content'}


# =============================================================================
# LLMResponse Tests
# =============================================================================

class TestLLMResponse:
    """Tests for LLMResponse dataclass."""

    def test_create_response(self):
        """Test creating a response."""
        response = LLMResponse(
            content='Test response content',
            model='gpt-4',
            usage={
                'prompt_tokens': 100,
                'completion_tokens': 50,
                'total_tokens': 150,
            },
            finish_reason='stop',
        )

        assert response.content == 'Test response content'
        assert response.model == 'gpt-4'
        assert response.finish_reason == 'stop'

    def test_response_with_raw(self):
        """Test response with raw response data."""
        response = LLMResponse(
            content='Test',
            model='gpt-4',
            usage={'total_tokens': 100},
            finish_reason='stop',
            raw_response={'id': 'test-id', 'choices': []},
        )

        assert response.raw_response['id'] == 'test-id'

    def test_input_tokens_property(self):
        """Test input_tokens property."""
        response = LLMResponse(
            content='Test',
            model='gpt-4',
            usage={'prompt_tokens': 100},
            finish_reason='stop',
        )

        assert response.input_tokens == 100

    def test_output_tokens_property(self):
        """Test output_tokens property."""
        response = LLMResponse(
            content='Test',
            model='gpt-4',
            usage={'completion_tokens': 50},
            finish_reason='stop',
        )

        assert response.output_tokens == 50

    def test_total_tokens_property(self):
        """Test total_tokens property."""
        response = LLMResponse(
            content='Test',
            model='gpt-4',
            usage={'total_tokens': 150},
            finish_reason='stop',
        )

        assert response.total_tokens == 150

    def test_missing_usage_fields(self):
        """Test response with missing usage fields."""
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
# MockLLMClient Tests
# =============================================================================

class TestMockLLMClient:
    """Tests for MockLLMClient."""

    @pytest.fixture
    def mock_client(self):
        """Create a mock LLM client."""
        config = LLMConfig(provider=LLMProvider.LOCAL)
        return MockLLMClient(config)

    def test_chat_returns_response(self, mock_client):
        """Test chat returns a mock response."""
        messages = [
            LLMMessage(role='system', content='You are helpful'),
            LLMMessage(role='user', content='Hello'),
        ]

        response = mock_client.chat(messages)

        assert isinstance(response, LLMResponse)
        assert '[Mock LLM Response]' in response.content
        assert 'Hello' in response.content
        assert response.model == 'mock-model'
        assert response.finish_reason == 'stop'

    def test_chat_extracts_user_message(self, mock_client):
        """Test that chat extracts the last user message."""
        messages = [
            LLMMessage(role='user', content='First question'),
            LLMMessage(role='assistant', content='First answer'),
            LLMMessage(role='user', content='Second question'),
        ]

        response = mock_client.chat(messages)

        assert 'Second question' in response.content

    def test_chat_handles_long_message(self, mock_client):
        """Test chat truncates long messages."""
        long_content = 'A' * 200
        messages = [LLMMessage(role='user', content=long_content)]

        response = mock_client.chat(messages)

        # Should truncate to first 100 chars
        assert len(response.content) < len(long_content) + 50

    def test_chat_usage_stats(self, mock_client):
        """Test chat returns usage statistics."""
        messages = [LLMMessage(role='user', content='Test')]

        response = mock_client.chat(messages)

        assert response.usage['prompt_tokens'] == 100
        assert response.usage['completion_tokens'] == 50
        assert response.usage['total_tokens'] == 150

    def test_complete_returns_response(self, mock_client):
        """Test complete returns a mock response."""
        response = mock_client.complete('Test prompt')

        assert isinstance(response, LLMResponse)
        assert '[Mock LLM Completion]' in response.content
        assert 'Test prompt' in response.content

    def test_complete_truncates_prompt(self, mock_client):
        """Test complete truncates long prompts."""
        long_prompt = 'B' * 100
        response = mock_client.complete(long_prompt)

        # Verify response is generated
        assert isinstance(response, LLMResponse)

    def test_generate_control_draft(self, mock_client):
        """Test generate_control_draft method."""
        result = mock_client.generate_control_draft(
            requirement_text='Implement access controls',
            framework='FedRAMP',
            context='Cloud environment',
        )

        assert isinstance(result, str)
        assert '[Mock LLM Response]' in result

    def test_extract_controls_from_policy(self, mock_client):
        """Test extract_controls_from_policy method."""
        result = mock_client.extract_controls_from_policy(
            policy_text='All users must authenticate.',
            framework='FedRAMP',
        )

        # Mock client returns empty list (can't parse mock response as JSON)
        assert isinstance(result, list)

    def test_evaluate_control_effectiveness(self, mock_client):
        """Test evaluate_control_effectiveness method."""
        result = mock_client.evaluate_control_effectiveness(
            control_description='MFA is implemented',
            requirement_text='Implement multi-factor authentication',
            evidence_summary='Screenshots provided',
        )

        assert isinstance(result, dict)
        assert 'evaluation' in result
        assert 'model' in result
        assert result['model'] == 'mock-model'

    def test_explain_control(self, mock_client):
        """Test explain_control method."""
        result = mock_client.explain_control(
            control_text='Access control policy requiring authentication',
            audience='executive',
        )

        assert isinstance(result, str)
        assert '[Mock LLM Response]' in result

    def test_explain_control_different_audiences(self, mock_client):
        """Test explain_control with different audiences."""
        audiences = ['executive', 'auditor', 'engineer', 'developer']

        for audience in audiences:
            result = mock_client.explain_control(
                control_text='Test control',
                audience=audience,
            )
            assert isinstance(result, str)


# =============================================================================
# Client Factory Tests
# =============================================================================

class TestCreateLLMClient:
    """Tests for create_llm_client factory function."""

    def test_create_mock_client(self):
        """Test creating a mock client explicitly."""
        client = create_llm_client(provider='mock')
        assert isinstance(client, MockLLMClient)

    def test_create_with_config_object(self):
        """Test creating client with config object."""
        config = LLMConfig(provider=LLMProvider.LOCAL)
        client = create_llm_client(config=config)
        assert isinstance(client, LocalLLMClient)

    def test_config_overrides_provider(self):
        """Test that config provider overrides provider parameter."""
        config = LLMConfig(provider=LLMProvider.LOCAL)
        client = create_llm_client(provider='mock', config=config)
        assert isinstance(client, LocalLLMClient)

    def test_invalid_provider(self):
        """Test error on invalid provider."""
        with pytest.raises(ValueError) as exc_info:
            create_llm_client(provider='invalid_provider')

        assert 'Unknown LLM provider' in str(exc_info.value)

    @patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'test-key'}, clear=True)
    def test_auto_detect_anthropic(self):
        """Test auto-detection of Anthropic from env."""
        # Clear other keys
        for key in ['OPENAI_API_KEY', 'AZURE_OPENAI_API_KEY', 'LOCAL_LLM_URL']:
            os.environ.pop(key, None)

        client = create_llm_client()
        assert isinstance(client, AnthropicClient)

    @patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}, clear=True)
    def test_auto_detect_openai(self):
        """Test auto-detection of OpenAI from env."""
        # Clear other keys
        for key in ['ANTHROPIC_API_KEY', 'AZURE_OPENAI_API_KEY', 'LOCAL_LLM_URL']:
            os.environ.pop(key, None)

        client = create_llm_client()
        assert isinstance(client, OpenAIClient)

    @patch.dict(os.environ, {}, clear=True)
    def test_default_to_mock(self):
        """Test defaulting to mock when no API keys."""
        # Clear all relevant keys
        for key in ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'AZURE_OPENAI_API_KEY', 'LOCAL_LLM_URL']:
            os.environ.pop(key, None)

        client = create_llm_client()
        assert isinstance(client, MockLLMClient)

    def test_create_openai_client(self):
        """Test creating OpenAI client explicitly."""
        client = create_llm_client(provider=LLMProvider.OPENAI, api_key='test')
        assert isinstance(client, OpenAIClient)

    def test_create_anthropic_client(self):
        """Test creating Anthropic client explicitly."""
        client = create_llm_client(provider=LLMProvider.ANTHROPIC, api_key='test')
        assert isinstance(client, AnthropicClient)

    def test_create_azure_client(self):
        """Test creating Azure OpenAI client explicitly."""
        client = create_llm_client(provider=LLMProvider.AZURE_OPENAI, api_key='test')
        assert isinstance(client, AzureOpenAIClient)

    def test_create_local_client(self):
        """Test creating local LLM client."""
        client = create_llm_client(provider=LLMProvider.LOCAL)
        assert isinstance(client, LocalLLMClient)

    def test_create_with_kwargs(self):
        """Test creating client with additional kwargs."""
        client = create_llm_client(
            provider=LLMProvider.LOCAL,
            model='llama2',
            max_tokens=2048,
            temperature=0.5,
        )
        assert client.config.model == 'llama2'
        assert client.config.max_tokens == 2048
        assert client.config.temperature == 0.5


# =============================================================================
# Singleton Tests
# =============================================================================

class TestDefaultClient:
    """Tests for default client singleton."""

    def test_get_default_client(self):
        """Test getting default client."""
        # Reset singleton
        import ai_assistant.services.llm_client as llm_module
        llm_module._default_client = None

        with patch.dict(os.environ, {}, clear=True):
            for key in ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'AZURE_OPENAI_API_KEY', 'LOCAL_LLM_URL']:
                os.environ.pop(key, None)

            client = get_default_llm_client()
            assert client is not None

    def test_set_default_client(self):
        """Test setting default client."""
        import ai_assistant.services.llm_client as llm_module

        custom_client = MockLLMClient(LLMConfig(provider=LLMProvider.LOCAL))
        set_default_llm_client(custom_client)

        assert llm_module._default_client is custom_client

        # Clean up
        llm_module._default_client = None


# =============================================================================
# OpenAI Client Tests (Mocked)
# =============================================================================

class TestOpenAIClient:
    """Tests for OpenAIClient with mocked OpenAI library."""

    @pytest.fixture
    def openai_config(self):
        """Create OpenAI config."""
        return LLMConfig(
            provider=LLMProvider.OPENAI,
            api_key='test-api-key',
            model='gpt-4',
        )

    def test_client_initialization(self, openai_config):
        """Test OpenAI client initialization."""
        client = OpenAIClient(openai_config)
        assert client.config == openai_config
        assert client._client is None  # Lazy loaded

    def test_chat_success(self, openai_config):
        """Test successful chat completion."""
        # Setup mock
        mock_openai_client = MagicMock()

        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(content='Test response'),
                finish_reason='stop'
            )
        ]
        mock_response.model = 'gpt-4'
        mock_response.usage = MagicMock(
            prompt_tokens=10,
            completion_tokens=5,
            total_tokens=15
        )
        mock_response.model_dump.return_value = {}

        mock_openai_client.chat.completions.create.return_value = mock_response

        # Test
        client = OpenAIClient(openai_config)
        client._client = mock_openai_client  # Inject mock directly

        messages = [LLMMessage(role='user', content='Hello')]
        response = client.chat(messages)

        assert response.content == 'Test response'
        assert response.model == 'gpt-4'
        assert response.finish_reason == 'stop'

    def test_complete_uses_chat(self, openai_config):
        """Test that complete method uses chat internally."""
        client = OpenAIClient(openai_config)

        with patch.object(client, 'chat') as mock_chat:
            mock_chat.return_value = LLMResponse(
                content='Test',
                model='gpt-4',
                usage={},
                finish_reason='stop',
            )

            client.complete('Test prompt')

            mock_chat.assert_called_once()
            call_args = mock_chat.call_args
            messages = call_args[0][0]
            assert len(messages) == 1
            assert messages[0].role == 'user'
            assert messages[0].content == 'Test prompt'


# =============================================================================
# Anthropic Client Tests (Mocked)
# =============================================================================

class TestAnthropicClient:
    """Tests for AnthropicClient with mocked Anthropic library."""

    @pytest.fixture
    def anthropic_config(self):
        """Create Anthropic config."""
        return LLMConfig(
            provider=LLMProvider.ANTHROPIC,
            api_key='test-api-key',
            model='claude-3-5-sonnet-20241022',
        )

    def test_client_initialization(self, anthropic_config):
        """Test Anthropic client initialization."""
        client = AnthropicClient(anthropic_config)
        assert client.config == anthropic_config
        assert client._client is None  # Lazy loaded

    def test_chat_success(self, anthropic_config):
        """Test successful chat completion."""
        # Setup mock
        mock_anthropic_client = MagicMock()

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='Test response')]
        mock_response.model = 'claude-3-5-sonnet-20241022'
        mock_response.usage = MagicMock(input_tokens=10, output_tokens=5)
        mock_response.stop_reason = 'end_turn'
        mock_response.model_dump.return_value = {}

        mock_anthropic_client.messages.create.return_value = mock_response

        # Test
        client = AnthropicClient(anthropic_config)
        client._client = mock_anthropic_client  # Inject mock directly

        messages = [
            LLMMessage(role='system', content='You are helpful'),
            LLMMessage(role='user', content='Hello'),
        ]
        response = client.chat(messages)

        assert response.content == 'Test response'
        assert response.model == 'claude-3-5-sonnet-20241022'

    def test_chat_extracts_system_message(self, anthropic_config):
        """Test that system message is extracted correctly."""
        mock_anthropic_client = MagicMock()

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='Response')]
        mock_response.model = 'claude-3-5-sonnet-20241022'
        mock_response.usage = MagicMock(input_tokens=10, output_tokens=5)
        mock_response.stop_reason = 'end_turn'
        mock_response.model_dump.return_value = {}

        mock_anthropic_client.messages.create.return_value = mock_response

        client = AnthropicClient(anthropic_config)
        client._client = mock_anthropic_client  # Inject mock directly

        messages = [
            LLMMessage(role='system', content='System prompt'),
            LLMMessage(role='user', content='User message'),
        ]
        client.chat(messages)

        # Verify system was passed separately
        call_kwargs = mock_anthropic_client.messages.create.call_args.kwargs
        assert call_kwargs.get('system') == 'System prompt'

    def test_chat_maps_gpt_model_name(self, anthropic_config):
        """Test that GPT model names are mapped to Claude."""
        mock_anthropic_client = MagicMock()

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='Response')]
        mock_response.model = 'claude-3-5-sonnet-20241022'
        mock_response.usage = MagicMock(input_tokens=10, output_tokens=5)
        mock_response.stop_reason = 'end_turn'
        mock_response.model_dump.return_value = {}

        mock_anthropic_client.messages.create.return_value = mock_response

        client = AnthropicClient(anthropic_config)
        client._client = mock_anthropic_client  # Inject mock directly

        messages = [LLMMessage(role='user', content='Test')]
        client.chat(messages, model='gpt-4')

        # Verify model was mapped
        call_kwargs = mock_anthropic_client.messages.create.call_args.kwargs
        assert call_kwargs['model'] == 'claude-3-5-sonnet-20241022'


# =============================================================================
# Local LLM Client Tests
# =============================================================================

class TestLocalLLMClient:
    """Tests for LocalLLMClient."""

    @pytest.fixture
    def local_config(self):
        """Create local LLM config."""
        return LLMConfig(
            provider=LLMProvider.LOCAL,
            model='llama2',
            base_url='http://localhost:11434',
        )

    def test_client_initialization(self, local_config):
        """Test local client initialization."""
        client = LocalLLMClient(local_config)
        assert client.base_url == 'http://localhost:11434'

    def test_default_base_url(self):
        """Test default base URL."""
        config = LLMConfig(provider=LLMProvider.LOCAL)
        client = LocalLLMClient(config)
        assert client.base_url == 'http://localhost:11434'

    @patch('requests.post')
    def test_chat_success(self, mock_post, local_config):
        """Test successful chat with local LLM."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            'message': {'content': 'Test response'},
            'model': 'llama2',
            'prompt_eval_count': 10,
            'eval_count': 5,
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        client = LocalLLMClient(local_config)
        messages = [LLMMessage(role='user', content='Hello')]
        response = client.chat(messages)

        assert response.content == 'Test response'
        assert response.model == 'llama2'
        assert response.usage['prompt_tokens'] == 10
        assert response.usage['completion_tokens'] == 5

    @patch('requests.post')
    def test_chat_ollama_api_format(self, mock_post, local_config):
        """Test that request uses Ollama API format."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            'message': {'content': 'Response'},
            'model': 'llama2',
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        client = LocalLLMClient(local_config)
        messages = [LLMMessage(role='user', content='Test')]
        client.chat(messages)

        # Verify request format
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == 'http://localhost:11434/api/chat'
        assert call_args[1]['json']['model'] == 'llama2'
        assert call_args[1]['json']['stream'] is False


# =============================================================================
# Azure OpenAI Client Tests
# =============================================================================

class TestAzureOpenAIClient:
    """Tests for AzureOpenAIClient."""

    @pytest.fixture
    def azure_config(self):
        """Create Azure OpenAI config."""
        return LLMConfig(
            provider=LLMProvider.AZURE_OPENAI,
            api_key='test-api-key',
            base_url='https://myresource.openai.azure.com',
            extra_config={
                'api_version': '2024-02-01',
                'deployment_name': 'gpt-4-deployment',
            },
        )

    def test_client_initialization(self, azure_config):
        """Test Azure client initialization."""
        client = AzureOpenAIClient(azure_config)
        assert client.config == azure_config
        assert client._client is None  # Lazy loaded

    def test_chat_success(self, azure_config):
        """Test successful chat completion."""
        mock_azure_client = MagicMock()

        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(content='Azure response'),
                finish_reason='stop'
            )
        ]
        mock_response.model = 'gpt-4'
        mock_response.usage = MagicMock(
            prompt_tokens=10,
            completion_tokens=5,
            total_tokens=15
        )
        mock_response.model_dump.return_value = {}

        mock_azure_client.chat.completions.create.return_value = mock_response

        client = AzureOpenAIClient(azure_config)
        client._client = mock_azure_client  # Inject mock directly

        messages = [LLMMessage(role='user', content='Hello')]
        response = client.chat(messages)

        assert response.content == 'Azure response'

    def test_uses_deployment_name(self, azure_config):
        """Test that deployment name is used."""
        mock_azure_client = MagicMock()

        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content='Response'), finish_reason='stop')
        ]
        mock_response.model = 'gpt-4'
        mock_response.usage = MagicMock(
            prompt_tokens=10, completion_tokens=5, total_tokens=15
        )
        mock_response.model_dump.return_value = {}

        mock_azure_client.chat.completions.create.return_value = mock_response

        client = AzureOpenAIClient(azure_config)
        client._client = mock_azure_client  # Inject mock directly

        messages = [LLMMessage(role='user', content='Test')]
        client.chat(messages)

        # Verify deployment name was used as model
        call_kwargs = mock_azure_client.chat.completions.create.call_args.kwargs
        assert call_kwargs['model'] == 'gpt-4-deployment'


# =============================================================================
# BaseLLMClient Method Tests
# =============================================================================

class TestBaseLLMClientMethods:
    """Tests for BaseLLMClient convenience methods using MockLLMClient."""

    @pytest.fixture
    def client(self):
        """Create a mock client."""
        config = LLMConfig(provider=LLMProvider.LOCAL)
        return MockLLMClient(config)

    def test_generate_control_draft_structure(self, client):
        """Test generate_control_draft uses correct prompt structure."""
        # The mock client will be called with the generated prompts
        result = client.generate_control_draft(
            requirement_text='Implement MFA',
            framework='FedRAMP',
            context='Cloud environment',
        )

        # Result should be a string
        assert isinstance(result, str)

    def test_extract_controls_handles_non_json(self, client):
        """Test extract_controls handles non-JSON response."""
        result = client.extract_controls_from_policy(
            policy_text='All users must authenticate.',
        )

        # Should return empty list when response can't be parsed
        assert result == []

    def test_evaluate_control_returns_dict(self, client):
        """Test evaluate_control returns expected structure."""
        result = client.evaluate_control_effectiveness(
            control_description='MFA implemented',
            requirement_text='Require MFA',
        )

        assert 'evaluation' in result
        assert 'model' in result

    def test_explain_control_for_audiences(self, client):
        """Test explain_control adjusts for different audiences."""
        audiences = ['executive', 'auditor', 'engineer', 'developer', 'unknown']

        for audience in audiences:
            result = client.explain_control(
                control_text='Access control policy',
                audience=audience,
            )
            assert isinstance(result, str)
