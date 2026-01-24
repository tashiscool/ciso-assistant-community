"""
LLM Client Abstraction Layer

Provides a unified interface for interacting with different LLM providers
(OpenAI, Anthropic, Azure OpenAI, local models).
"""

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    OPENAI = 'openai'
    ANTHROPIC = 'anthropic'
    AZURE_OPENAI = 'azure_openai'
    LOCAL = 'local'  # For self-hosted models like Ollama


@dataclass
class LLMConfig:
    """Configuration for LLM client."""
    provider: LLMProvider
    api_key: Optional[str] = None
    model: str = 'gpt-4'
    base_url: Optional[str] = None
    organization_id: Optional[str] = None
    max_tokens: int = 4096
    temperature: float = 0.7
    timeout: int = 60
    retry_count: int = 3
    extra_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMMessage:
    """A message in a conversation."""
    role: str  # 'system', 'user', 'assistant'
    content: str

    def to_dict(self) -> Dict[str, str]:
        return {'role': self.role, 'content': self.content}


@dataclass
class LLMResponse:
    """Response from an LLM."""
    content: str
    model: str
    usage: Dict[str, int]  # tokens used
    finish_reason: str
    raw_response: Optional[Dict] = None

    @property
    def input_tokens(self) -> int:
        return self.usage.get('prompt_tokens', 0)

    @property
    def output_tokens(self) -> int:
        return self.usage.get('completion_tokens', 0)

    @property
    def total_tokens(self) -> int:
        return self.usage.get('total_tokens', 0)


class BaseLLMClient(ABC):
    """Base class for LLM clients."""

    def __init__(self, config: LLMConfig):
        self.config = config

    @abstractmethod
    def chat(
        self,
        messages: List[LLMMessage],
        **kwargs
    ) -> LLMResponse:
        """Send a chat completion request."""
        pass

    @abstractmethod
    def complete(
        self,
        prompt: str,
        **kwargs
    ) -> LLMResponse:
        """Send a text completion request."""
        pass

    def generate_control_draft(
        self,
        requirement_text: str,
        framework: str = 'FedRAMP',
        context: str = '',
    ) -> str:
        """Generate a control implementation statement draft."""
        system_prompt = f"""You are an expert cybersecurity compliance specialist with deep knowledge of {framework} requirements.
Your task is to draft a clear, comprehensive control implementation statement.
Write in a formal, professional tone suitable for audit documentation.
Include specific technical measures and procedural controls."""

        user_prompt = f"""Draft a control implementation statement for the following requirement:

Requirement: {requirement_text}

{f"Additional Context: {context}" if context else ""}

Provide a comprehensive implementation statement that:
1. Directly addresses all aspects of the requirement
2. Specifies concrete technical and procedural controls
3. Identifies responsible parties and frequencies
4. Is written in present tense describing current state
"""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        response = self.chat(messages, temperature=0.5)
        return response.content

    def extract_controls_from_policy(
        self,
        policy_text: str,
        framework: str = 'FedRAMP',
    ) -> List[Dict[str, str]]:
        """Extract controls from a policy document."""
        system_prompt = f"""You are an expert at analyzing security policies and mapping them to {framework} controls.
Extract discrete security controls from the provided policy text.
Return the results in a structured format."""

        user_prompt = f"""Analyze the following policy text and extract all identifiable security controls:

Policy Text:
{policy_text[:8000]}  # Limit text length

For each control, provide:
1. Control description
2. Related {framework} control family (if applicable)
3. Implementation status indicators (if mentioned)
4. Evidence requirements

Format as a JSON array of objects with keys: description, control_family, status, evidence"""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        response = self.chat(messages, temperature=0.3)

        # Parse response - handle both JSON and text responses
        try:
            import json
            # Try to extract JSON from response
            content = response.content
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                content = content.split('```')[1].split('```')[0]
            return json.loads(content)
        except Exception:
            logger.warning("Could not parse LLM response as JSON")
            return []

    def evaluate_control_effectiveness(
        self,
        control_description: str,
        requirement_text: str,
        evidence_summary: str = '',
    ) -> Dict[str, Any]:
        """Evaluate how well a control addresses a requirement."""
        system_prompt = """You are a cybersecurity auditor evaluating control effectiveness.
Provide an objective assessment of how well the described control addresses the requirement."""

        user_prompt = f"""Evaluate the effectiveness of the following control:

Requirement: {requirement_text}

Control Implementation: {control_description}

{f"Evidence Summary: {evidence_summary}" if evidence_summary else ""}

Assess:
1. Coverage: Does the control fully address the requirement? (percentage estimate)
2. Gaps: What aspects of the requirement are not addressed?
3. Strengths: What does the control do well?
4. Recommendations: What improvements would strengthen this control?

Provide your assessment in a structured format."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        response = self.chat(messages, temperature=0.3)

        return {
            'evaluation': response.content,
            'model': response.model,
        }

    def explain_control(
        self,
        control_text: str,
        audience: str = 'executive',
    ) -> str:
        """Explain a control for a specific audience."""
        audience_contexts = {
            'executive': 'business stakeholders with limited technical background',
            'auditor': 'compliance auditors familiar with regulatory requirements',
            'engineer': 'technical staff responsible for implementation',
            'developer': 'software developers who need to implement secure coding practices',
        }

        audience_context = audience_contexts.get(audience, audience_contexts['executive'])

        system_prompt = f"""You are a cybersecurity expert explaining technical controls to {audience_context}.
Adjust your language and focus based on the audience's needs and background."""

        user_prompt = f"""Explain the following security control in terms appropriate for {audience}:

Control: {control_text}

Provide:
1. Clear explanation of what this control does
2. Why it's important (business/security impact)
3. How it protects the organization
4. Any relevant metrics or indicators to monitor"""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        response = self.chat(messages, temperature=0.5)
        return response.content


class OpenAIClient(BaseLLMClient):
    """OpenAI API client implementation."""

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self._client = None

    @property
    def client(self):
        if self._client is None:
            try:
                from openai import OpenAI
                self._client = OpenAI(
                    api_key=self.config.api_key or os.getenv('OPENAI_API_KEY'),
                    organization=self.config.organization_id,
                    base_url=self.config.base_url,
                    timeout=self.config.timeout,
                )
            except ImportError:
                raise ImportError("OpenAI package not installed. Run: pip install openai")
        return self._client

    def chat(
        self,
        messages: List[LLMMessage],
        **kwargs
    ) -> LLMResponse:
        """Send a chat completion request to OpenAI."""
        try:
            response = self.client.chat.completions.create(
                model=kwargs.get('model', self.config.model),
                messages=[m.to_dict() for m in messages],
                max_tokens=kwargs.get('max_tokens', self.config.max_tokens),
                temperature=kwargs.get('temperature', self.config.temperature),
            )

            return LLMResponse(
                content=response.choices[0].message.content,
                model=response.model,
                usage={
                    'prompt_tokens': response.usage.prompt_tokens,
                    'completion_tokens': response.usage.completion_tokens,
                    'total_tokens': response.usage.total_tokens,
                },
                finish_reason=response.choices[0].finish_reason,
                raw_response=response.model_dump() if hasattr(response, 'model_dump') else None,
            )
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    def complete(
        self,
        prompt: str,
        **kwargs
    ) -> LLMResponse:
        """Send a text completion request (using chat endpoint)."""
        messages = [LLMMessage(role='user', content=prompt)]
        return self.chat(messages, **kwargs)


class AnthropicClient(BaseLLMClient):
    """Anthropic (Claude) API client implementation."""

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self._client = None

    @property
    def client(self):
        if self._client is None:
            try:
                from anthropic import Anthropic
                self._client = Anthropic(
                    api_key=self.config.api_key or os.getenv('ANTHROPIC_API_KEY'),
                )
            except ImportError:
                raise ImportError("Anthropic package not installed. Run: pip install anthropic")
        return self._client

    def chat(
        self,
        messages: List[LLMMessage],
        **kwargs
    ) -> LLMResponse:
        """Send a chat completion request to Anthropic."""
        try:
            # Extract system message if present
            system_content = None
            chat_messages = []

            for msg in messages:
                if msg.role == 'system':
                    system_content = msg.content
                else:
                    chat_messages.append(msg.to_dict())

            model = kwargs.get('model', self.config.model)
            if model.startswith('gpt-'):
                # Map OpenAI model names to Claude
                model = 'claude-3-5-sonnet-20241022'

            create_kwargs = {
                'model': model,
                'max_tokens': kwargs.get('max_tokens', self.config.max_tokens),
                'messages': chat_messages,
            }

            if system_content:
                create_kwargs['system'] = system_content

            response = self.client.messages.create(**create_kwargs)

            return LLMResponse(
                content=response.content[0].text,
                model=response.model,
                usage={
                    'prompt_tokens': response.usage.input_tokens,
                    'completion_tokens': response.usage.output_tokens,
                    'total_tokens': response.usage.input_tokens + response.usage.output_tokens,
                },
                finish_reason=response.stop_reason,
                raw_response=response.model_dump() if hasattr(response, 'model_dump') else None,
            )
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            raise

    def complete(
        self,
        prompt: str,
        **kwargs
    ) -> LLMResponse:
        """Send a text completion request (using chat endpoint)."""
        messages = [LLMMessage(role='user', content=prompt)]
        return self.chat(messages, **kwargs)


class AzureOpenAIClient(BaseLLMClient):
    """Azure OpenAI API client implementation."""

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self._client = None

    @property
    def client(self):
        if self._client is None:
            try:
                from openai import AzureOpenAI
                self._client = AzureOpenAI(
                    api_key=self.config.api_key or os.getenv('AZURE_OPENAI_API_KEY'),
                    api_version=self.config.extra_config.get('api_version', '2024-02-01'),
                    azure_endpoint=self.config.base_url or os.getenv('AZURE_OPENAI_ENDPOINT'),
                )
            except ImportError:
                raise ImportError("OpenAI package not installed. Run: pip install openai")
        return self._client

    def chat(
        self,
        messages: List[LLMMessage],
        **kwargs
    ) -> LLMResponse:
        """Send a chat completion request to Azure OpenAI."""
        try:
            deployment_name = self.config.extra_config.get('deployment_name', self.config.model)

            response = self.client.chat.completions.create(
                model=deployment_name,
                messages=[m.to_dict() for m in messages],
                max_tokens=kwargs.get('max_tokens', self.config.max_tokens),
                temperature=kwargs.get('temperature', self.config.temperature),
            )

            return LLMResponse(
                content=response.choices[0].message.content,
                model=response.model,
                usage={
                    'prompt_tokens': response.usage.prompt_tokens,
                    'completion_tokens': response.usage.completion_tokens,
                    'total_tokens': response.usage.total_tokens,
                },
                finish_reason=response.choices[0].finish_reason,
                raw_response=response.model_dump() if hasattr(response, 'model_dump') else None,
            )
        except Exception as e:
            logger.error(f"Azure OpenAI API error: {e}")
            raise

    def complete(
        self,
        prompt: str,
        **kwargs
    ) -> LLMResponse:
        """Send a text completion request (using chat endpoint)."""
        messages = [LLMMessage(role='user', content=prompt)]
        return self.chat(messages, **kwargs)


class LocalLLMClient(BaseLLMClient):
    """Client for local LLMs (e.g., Ollama, LocalAI)."""

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.base_url = config.base_url or 'http://localhost:11434'

    def chat(
        self,
        messages: List[LLMMessage],
        **kwargs
    ) -> LLMResponse:
        """Send a chat completion request to local LLM."""
        import requests

        try:
            # Ollama API format
            response = requests.post(
                f'{self.base_url}/api/chat',
                json={
                    'model': kwargs.get('model', self.config.model),
                    'messages': [m.to_dict() for m in messages],
                    'stream': False,
                    'options': {
                        'temperature': kwargs.get('temperature', self.config.temperature),
                        'num_predict': kwargs.get('max_tokens', self.config.max_tokens),
                    }
                },
                timeout=self.config.timeout,
            )
            response.raise_for_status()
            data = response.json()

            return LLMResponse(
                content=data.get('message', {}).get('content', ''),
                model=data.get('model', self.config.model),
                usage={
                    'prompt_tokens': data.get('prompt_eval_count', 0),
                    'completion_tokens': data.get('eval_count', 0),
                    'total_tokens': data.get('prompt_eval_count', 0) + data.get('eval_count', 0),
                },
                finish_reason='stop',
                raw_response=data,
            )
        except Exception as e:
            logger.error(f"Local LLM API error: {e}")
            raise

    def complete(
        self,
        prompt: str,
        **kwargs
    ) -> LLMResponse:
        """Send a text completion request."""
        messages = [LLMMessage(role='user', content=prompt)]
        return self.chat(messages, **kwargs)


class MockLLMClient(BaseLLMClient):
    """Mock LLM client for testing and development."""

    def chat(
        self,
        messages: List[LLMMessage],
        **kwargs
    ) -> LLMResponse:
        """Return a mock response."""
        # Extract the last user message
        user_message = ''
        for msg in reversed(messages):
            if msg.role == 'user':
                user_message = msg.content[:100]
                break

        return LLMResponse(
            content=f"[Mock LLM Response] This is a mock response for: {user_message}...",
            model='mock-model',
            usage={
                'prompt_tokens': 100,
                'completion_tokens': 50,
                'total_tokens': 150,
            },
            finish_reason='stop',
        )

    def complete(
        self,
        prompt: str,
        **kwargs
    ) -> LLMResponse:
        """Return a mock completion."""
        return LLMResponse(
            content=f"[Mock LLM Completion] Response for: {prompt[:50]}...",
            model='mock-model',
            usage={
                'prompt_tokens': 50,
                'completion_tokens': 25,
                'total_tokens': 75,
            },
            finish_reason='stop',
        )


def create_llm_client(
    provider: Union[str, LLMProvider] = None,
    config: LLMConfig = None,
    **kwargs
) -> BaseLLMClient:
    """
    Factory function to create an LLM client.

    Args:
        provider: LLM provider (openai, anthropic, azure_openai, local, mock)
        config: LLMConfig object (overrides provider if specified)
        **kwargs: Additional configuration options

    Returns:
        Configured LLM client instance
    """
    if config:
        provider = config.provider
    elif provider is None:
        # Auto-detect based on environment variables
        if os.getenv('ANTHROPIC_API_KEY'):
            provider = LLMProvider.ANTHROPIC
        elif os.getenv('AZURE_OPENAI_API_KEY'):
            provider = LLMProvider.AZURE_OPENAI
        elif os.getenv('OPENAI_API_KEY'):
            provider = LLMProvider.OPENAI
        elif os.getenv('LOCAL_LLM_URL'):
            provider = LLMProvider.LOCAL
        else:
            logger.warning("No LLM API key found. Using mock client.")
            provider = 'mock'

    if isinstance(provider, str):
        try:
            provider = LLMProvider(provider.lower())
        except ValueError:
            if provider.lower() == 'mock':
                return MockLLMClient(config or LLMConfig(provider=LLMProvider.LOCAL))
            raise ValueError(f"Unknown LLM provider: {provider}")

    if config is None:
        config = LLMConfig(
            provider=provider,
            **kwargs
        )

    client_classes = {
        LLMProvider.OPENAI: OpenAIClient,
        LLMProvider.ANTHROPIC: AnthropicClient,
        LLMProvider.AZURE_OPENAI: AzureOpenAIClient,
        LLMProvider.LOCAL: LocalLLMClient,
    }

    client_class = client_classes.get(provider)
    if client_class is None:
        raise ValueError(f"Unsupported LLM provider: {provider}")

    return client_class(config)


# Singleton instance for default client
_default_client: Optional[BaseLLMClient] = None


def get_default_llm_client() -> Optional[BaseLLMClient]:
    """Get the default LLM client instance."""
    global _default_client
    if _default_client is None:
        try:
            _default_client = create_llm_client()
        except Exception as e:
            logger.warning(f"Could not create default LLM client: {e}")
            _default_client = MockLLMClient(LLMConfig(provider=LLMProvider.LOCAL))
    return _default_client


def set_default_llm_client(client: BaseLLMClient):
    """Set the default LLM client instance."""
    global _default_client
    _default_client = client
