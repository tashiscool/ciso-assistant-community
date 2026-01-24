"""
AI Extractor Service

Provides AI-powered extraction of controls, requirements, and
compliance-related content from policy documents.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, BinaryIO
from enum import Enum
import logging
import re

from .llm_client import get_default_llm_client, LLMMessage

logger = logging.getLogger(__name__)


class DocumentFormat(str, Enum):
    """Supported document formats."""
    PDF = 'pdf'
    DOCX = 'docx'
    TXT = 'txt'
    MARKDOWN = 'markdown'
    HTML = 'html'


class ExtractionType(str, Enum):
    """Types of extraction to perform."""
    CONTROLS = 'controls'
    REQUIREMENTS = 'requirements'
    POLICIES = 'policies'
    PROCEDURES = 'procedures'
    RISKS = 'risks'
    EVIDENCE = 'evidence'


@dataclass
class ExtractedControl:
    """Represents a control extracted from a document."""
    control_id: Optional[str]
    title: str
    description: str
    implementation_statement: Optional[str]
    mapped_framework_controls: List[str] = field(default_factory=list)
    confidence_score: float = 0.0
    source_location: Optional[str] = None
    category: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'control_id': self.control_id,
            'title': self.title,
            'description': self.description,
            'implementation_statement': self.implementation_statement,
            'mapped_framework_controls': self.mapped_framework_controls,
            'confidence_score': self.confidence_score,
            'source_location': self.source_location,
            'category': self.category,
        }


@dataclass
class ExtractedRequirement:
    """Represents a requirement extracted from a document."""
    requirement_id: Optional[str]
    text: str
    requirement_type: str  # 'mandatory', 'recommended', 'optional'
    related_controls: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    confidence_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            'requirement_id': self.requirement_id,
            'text': self.text,
            'requirement_type': self.requirement_type,
            'related_controls': self.related_controls,
            'keywords': self.keywords,
            'confidence_score': self.confidence_score,
        }


@dataclass
class ExtractedPolicy:
    """Represents a policy section extracted from a document."""
    title: str
    content: str
    section_number: Optional[str]
    parent_section: Optional[str]
    related_controls: List[str] = field(default_factory=list)
    effective_date: Optional[str] = None
    review_date: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'title': self.title,
            'content': self.content,
            'section_number': self.section_number,
            'parent_section': self.parent_section,
            'related_controls': self.related_controls,
            'effective_date': self.effective_date,
            'review_date': self.review_date,
        }


@dataclass
class ExtractionResult:
    """Result of document extraction."""
    document_name: str
    extraction_type: str
    controls: List[ExtractedControl] = field(default_factory=list)
    requirements: List[ExtractedRequirement] = field(default_factory=list)
    policies: List[ExtractedPolicy] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'document_name': self.document_name,
            'extraction_type': self.extraction_type,
            'controls': [c.to_dict() for c in self.controls],
            'requirements': [r.to_dict() for r in self.requirements],
            'policies': [p.to_dict() for p in self.policies],
            'metadata': self.metadata,
            'warnings': self.warnings,
            'summary': {
                'controls_count': len(self.controls),
                'requirements_count': len(self.requirements),
                'policies_count': len(self.policies),
            },
        }


class DocumentParser:
    """Parses various document formats into plain text."""

    def parse(
        self,
        content: bytes,
        format: DocumentFormat,
        filename: Optional[str] = None
    ) -> str:
        """
        Parse document content into plain text.

        Args:
            content: Raw document bytes
            format: Document format
            filename: Original filename

        Returns:
            Extracted plain text
        """
        if format == DocumentFormat.PDF:
            return self._parse_pdf(content)
        elif format == DocumentFormat.DOCX:
            return self._parse_docx(content)
        elif format == DocumentFormat.TXT:
            return content.decode('utf-8', errors='ignore')
        elif format == DocumentFormat.MARKDOWN:
            return content.decode('utf-8', errors='ignore')
        elif format == DocumentFormat.HTML:
            return self._parse_html(content)
        else:
            raise ValueError(f"Unsupported document format: {format}")

    def _parse_pdf(self, content: bytes) -> str:
        """Parse PDF content."""
        try:
            import io
            # Try pypdf first
            try:
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(content))
                text_parts = []
                for page in reader.pages:
                    text_parts.append(page.extract_text() or '')
                return '\n\n'.join(text_parts)
            except ImportError:
                pass

            # Fall back to PyPDF2
            try:
                from PyPDF2 import PdfReader as PyPDF2Reader
                reader = PyPDF2Reader(io.BytesIO(content))
                text_parts = []
                for page in reader.pages:
                    text_parts.append(page.extract_text() or '')
                return '\n\n'.join(text_parts)
            except ImportError:
                pass

            logger.warning("No PDF library available (pypdf or PyPDF2)")
            return "[PDF parsing requires pypdf or PyPDF2 library]"

        except Exception as e:
            logger.error(f"Error parsing PDF: {e}")
            return f"[Error parsing PDF: {str(e)}]"

    def _parse_docx(self, content: bytes) -> str:
        """Parse DOCX content."""
        try:
            import io
            from docx import Document
            doc = Document(io.BytesIO(content))
            paragraphs = [p.text for p in doc.paragraphs]
            return '\n\n'.join(paragraphs)
        except ImportError:
            logger.warning("python-docx library not available")
            return "[DOCX parsing requires python-docx library]"
        except Exception as e:
            logger.error(f"Error parsing DOCX: {e}")
            return f"[Error parsing DOCX: {str(e)}]"

    def _parse_html(self, content: bytes) -> str:
        """Parse HTML content."""
        try:
            from html.parser import HTMLParser

            class TextExtractor(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.text_parts = []
                    self.skip_tags = {'script', 'style', 'head'}
                    self.current_tag = None

                def handle_starttag(self, tag, attrs):
                    self.current_tag = tag

                def handle_endtag(self, tag):
                    self.current_tag = None

                def handle_data(self, data):
                    if self.current_tag not in self.skip_tags:
                        text = data.strip()
                        if text:
                            self.text_parts.append(text)

            parser = TextExtractor()
            parser.feed(content.decode('utf-8', errors='ignore'))
            return '\n'.join(parser.text_parts)

        except Exception as e:
            logger.error(f"Error parsing HTML: {e}")
            return f"[Error parsing HTML: {str(e)}]"

    def detect_format(self, filename: str) -> DocumentFormat:
        """Detect document format from filename."""
        ext = filename.lower().split('.')[-1]
        format_map = {
            'pdf': DocumentFormat.PDF,
            'docx': DocumentFormat.DOCX,
            'doc': DocumentFormat.DOCX,  # Treat .doc as .docx
            'txt': DocumentFormat.TXT,
            'md': DocumentFormat.MARKDOWN,
            'markdown': DocumentFormat.MARKDOWN,
            'html': DocumentFormat.HTML,
            'htm': DocumentFormat.HTML,
        }
        return format_map.get(ext, DocumentFormat.TXT)


class AIExtractorService:
    """
    AI-powered document extraction service.

    Extracts controls, requirements, policies, and other compliance
    content from documents using LLM.
    """

    def __init__(self, llm_client=None):
        """
        Initialize the AI Extractor service.

        Args:
            llm_client: LLM client instance. Uses default if not provided.
        """
        self._llm_client = llm_client
        self.parser = DocumentParser()

    @property
    def llm_client(self):
        """Lazy load LLM client."""
        if self._llm_client is None:
            self._llm_client = get_default_llm_client()
        return self._llm_client

    def extract_from_document(
        self,
        content: bytes,
        filename: str,
        extraction_types: Optional[List[ExtractionType]] = None,
        target_framework: Optional[str] = None,
        chunk_size: int = 4000,
    ) -> ExtractionResult:
        """
        Extract compliance content from a document.

        Args:
            content: Raw document bytes
            filename: Document filename
            extraction_types: Types of content to extract
            target_framework: Framework to map controls to
            chunk_size: Size of text chunks for processing

        Returns:
            ExtractionResult with extracted content
        """
        extraction_types = extraction_types or [ExtractionType.CONTROLS]

        # Parse document to text
        doc_format = self.parser.detect_format(filename)
        text = self.parser.parse(content, doc_format, filename)

        if text.startswith('[') and ']' in text:
            # Parsing error
            return ExtractionResult(
                document_name=filename,
                extraction_type=','.join(e.value for e in extraction_types),
                warnings=[text],
            )

        result = ExtractionResult(
            document_name=filename,
            extraction_type=','.join(e.value for e in extraction_types),
            metadata={
                'format': doc_format.value,
                'text_length': len(text),
                'target_framework': target_framework,
            },
        )

        # Process based on extraction types
        if ExtractionType.CONTROLS in extraction_types:
            controls = self._extract_controls(text, target_framework, chunk_size)
            result.controls = controls

        if ExtractionType.REQUIREMENTS in extraction_types:
            requirements = self._extract_requirements(text, chunk_size)
            result.requirements = requirements

        if ExtractionType.POLICIES in extraction_types:
            policies = self._extract_policies(text, chunk_size)
            result.policies = policies

        return result

    def extract_controls_from_text(
        self,
        text: str,
        target_framework: Optional[str] = None,
    ) -> List[ExtractedControl]:
        """
        Extract controls from plain text.

        Args:
            text: Plain text content
            target_framework: Framework to map controls to

        Returns:
            List of extracted controls
        """
        return self._extract_controls(text, target_framework)

    def map_to_framework(
        self,
        control_descriptions: List[str],
        target_framework: str,
    ) -> List[Dict[str, Any]]:
        """
        Map control descriptions to framework controls.

        Args:
            control_descriptions: List of control descriptions
            target_framework: Target framework

        Returns:
            List of mappings with framework control IDs
        """
        system_prompt = f"""You are an expert at mapping security controls to the {target_framework} framework.
For each control description, identify the most relevant framework control(s).

Format your response as a numbered list:
1. [Control description summary] -> [Framework Control ID(s)]
2. [Control description summary] -> [Framework Control ID(s)]

Only include high-confidence mappings. If unsure, indicate with "?"."""

        user_prompt = "Map these control descriptions to framework controls:\n\n"
        for i, desc in enumerate(control_descriptions, 1):
            user_prompt += f"{i}. {desc[:500]}\n\n"

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.2)
            return self._parse_mapping_response(
                response.content, control_descriptions
            )
        except Exception as e:
            logger.error(f"Error mapping controls: {e}")
            return [{'description': d, 'error': str(e)} for d in control_descriptions]

    def analyze_policy_coverage(
        self,
        policy_text: str,
        framework: str,
    ) -> Dict[str, Any]:
        """
        Analyze policy coverage against a framework.

        Args:
            policy_text: Policy document text
            framework: Target framework

        Returns:
            Analysis of policy coverage
        """
        # Chunk if needed
        text_chunk = policy_text[:8000] if len(policy_text) > 8000 else policy_text

        system_prompt = f"""You are an expert compliance analyst. Analyze the provided policy document
and assess its coverage of {framework} requirements.

Provide your analysis in this format:
COVERAGE_SUMMARY: [Overall assessment]
COVERED_AREAS:
- [Area 1]: [Coverage description]
- [Area 2]: [Coverage description]
GAPS:
- [Gap 1]: [Description and recommendation]
- [Gap 2]: [Description and recommendation]
CONTROL_MAPPINGS:
- [Policy section] -> [Framework control(s)]
"""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=f"Analyze this policy:\n\n{text_chunk}"),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.3)
            return self._parse_coverage_response(response.content)
        except Exception as e:
            logger.error(f"Error analyzing coverage: {e}")
            return {'error': str(e)}

    def _extract_controls(
        self,
        text: str,
        target_framework: Optional[str],
        chunk_size: int = 4000,
    ) -> List[ExtractedControl]:
        """Extract controls from text using LLM."""
        controls = []
        chunks = self._chunk_text(text, chunk_size)

        framework_instruction = ""
        if target_framework:
            framework_instruction = f"\nMap extracted controls to {target_framework} control IDs where possible."

        system_prompt = f"""You are an expert at extracting security controls from policy documents.
Identify distinct security controls, policies, or requirements from the text.{framework_instruction}

For each control found, provide:
CONTROL:
ID: [Control ID if present, or generate one like CTRL-001]
TITLE: [Short title]
DESCRIPTION: [Full description]
IMPLEMENTATION: [Implementation details if present]
MAPPED_CONTROLS: [Framework control IDs if mappable]
CATEGORY: [Category like Access Control, Audit, etc.]
---
"""

        for i, chunk in enumerate(chunks):
            user_prompt = f"Extract security controls from this document section ({i+1}/{len(chunks)}):\n\n{chunk}"

            messages = [
                LLMMessage(role='system', content=system_prompt),
                LLMMessage(role='user', content=user_prompt),
            ]

            try:
                response = self.llm_client.chat(messages, temperature=0.2)
                chunk_controls = self._parse_controls_response(
                    response.content, f"chunk_{i+1}"
                )
                controls.extend(chunk_controls)
            except Exception as e:
                logger.error(f"Error extracting controls from chunk {i+1}: {e}")

        # Deduplicate controls
        controls = self._deduplicate_controls(controls)

        return controls

    def _extract_requirements(
        self,
        text: str,
        chunk_size: int = 4000,
    ) -> List[ExtractedRequirement]:
        """Extract requirements from text using LLM."""
        requirements = []
        chunks = self._chunk_text(text, chunk_size)

        system_prompt = """You are an expert at extracting requirements from documents.
Identify distinct requirements, obligations, or mandates from the text.

For each requirement found, provide:
REQUIREMENT:
ID: [Requirement ID if present, or generate one like REQ-001]
TEXT: [Full requirement text]
TYPE: [mandatory/recommended/optional]
KEYWORDS: [Key terms]
RELATED_CONTROLS: [Related control IDs if apparent]
---
"""

        for i, chunk in enumerate(chunks):
            user_prompt = f"Extract requirements from this document section:\n\n{chunk}"

            messages = [
                LLMMessage(role='system', content=system_prompt),
                LLMMessage(role='user', content=user_prompt),
            ]

            try:
                response = self.llm_client.chat(messages, temperature=0.2)
                chunk_reqs = self._parse_requirements_response(response.content)
                requirements.extend(chunk_reqs)
            except Exception as e:
                logger.error(f"Error extracting requirements from chunk {i+1}: {e}")

        return requirements

    def _extract_policies(
        self,
        text: str,
        chunk_size: int = 4000,
    ) -> List[ExtractedPolicy]:
        """Extract policy sections from text using LLM."""
        policies = []
        chunks = self._chunk_text(text, chunk_size)

        system_prompt = """You are an expert at analyzing policy documents.
Identify distinct policy sections, statements, or directives from the text.

For each policy section found, provide:
POLICY:
TITLE: [Section title]
SECTION_NUMBER: [Section number if present]
CONTENT: [Policy content]
RELATED_CONTROLS: [Related control IDs if apparent]
---
"""

        for i, chunk in enumerate(chunks):
            user_prompt = f"Extract policy sections from this document:\n\n{chunk}"

            messages = [
                LLMMessage(role='system', content=system_prompt),
                LLMMessage(role='user', content=user_prompt),
            ]

            try:
                response = self.llm_client.chat(messages, temperature=0.2)
                chunk_policies = self._parse_policies_response(response.content)
                policies.extend(chunk_policies)
            except Exception as e:
                logger.error(f"Error extracting policies from chunk {i+1}: {e}")

        return policies

    def _chunk_text(self, text: str, chunk_size: int) -> List[str]:
        """Split text into chunks for processing."""
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        # Try to split on paragraph boundaries
        paragraphs = text.split('\n\n')
        current_chunk = ""

        for para in paragraphs:
            if len(current_chunk) + len(para) + 2 <= chunk_size:
                current_chunk += para + '\n\n'
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                # If single paragraph is too long, split it
                if len(para) > chunk_size:
                    for i in range(0, len(para), chunk_size):
                        chunks.append(para[i:i+chunk_size])
                    current_chunk = ""
                else:
                    current_chunk = para + '\n\n'

        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks

    def _parse_controls_response(
        self,
        content: str,
        source_location: str
    ) -> List[ExtractedControl]:
        """Parse LLM response for control extraction."""
        controls = []
        control_blocks = content.split('---')

        for block in control_blocks:
            if 'CONTROL:' not in block and 'ID:' not in block:
                continue

            control_data = {
                'control_id': None,
                'title': '',
                'description': '',
                'implementation_statement': None,
                'mapped_framework_controls': [],
                'category': None,
            }

            lines = block.split('\n')
            current_field = None

            for line in lines:
                line = line.strip()
                if line.startswith('ID:'):
                    control_data['control_id'] = line[3:].strip()
                elif line.startswith('TITLE:'):
                    control_data['title'] = line[6:].strip()
                elif line.startswith('DESCRIPTION:'):
                    control_data['description'] = line[12:].strip()
                    current_field = 'description'
                elif line.startswith('IMPLEMENTATION:'):
                    control_data['implementation_statement'] = line[15:].strip()
                    current_field = 'implementation'
                elif line.startswith('MAPPED_CONTROLS:'):
                    mapped = line[16:].strip()
                    if mapped:
                        control_data['mapped_framework_controls'] = [
                            c.strip() for c in mapped.split(',')
                        ]
                elif line.startswith('CATEGORY:'):
                    control_data['category'] = line[9:].strip()
                elif current_field == 'description' and line:
                    control_data['description'] += ' ' + line
                elif current_field == 'implementation' and line:
                    if control_data['implementation_statement']:
                        control_data['implementation_statement'] += ' ' + line

            # Only add if we have meaningful content
            if control_data['title'] or control_data['description']:
                controls.append(ExtractedControl(
                    control_id=control_data['control_id'],
                    title=control_data['title'],
                    description=control_data['description'],
                    implementation_statement=control_data['implementation_statement'],
                    mapped_framework_controls=control_data['mapped_framework_controls'],
                    confidence_score=0.8,
                    source_location=source_location,
                    category=control_data['category'],
                ))

        return controls

    def _parse_requirements_response(
        self,
        content: str
    ) -> List[ExtractedRequirement]:
        """Parse LLM response for requirement extraction."""
        requirements = []
        req_blocks = content.split('---')

        for block in req_blocks:
            if 'REQUIREMENT:' not in block and 'TEXT:' not in block:
                continue

            req_data = {
                'requirement_id': None,
                'text': '',
                'requirement_type': 'mandatory',
                'related_controls': [],
                'keywords': [],
            }

            lines = block.split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('ID:'):
                    req_data['requirement_id'] = line[3:].strip()
                elif line.startswith('TEXT:'):
                    req_data['text'] = line[5:].strip()
                elif line.startswith('TYPE:'):
                    req_type = line[5:].strip().lower()
                    if req_type in ['mandatory', 'recommended', 'optional']:
                        req_data['requirement_type'] = req_type
                elif line.startswith('KEYWORDS:'):
                    keywords = line[9:].strip()
                    if keywords:
                        req_data['keywords'] = [k.strip() for k in keywords.split(',')]
                elif line.startswith('RELATED_CONTROLS:'):
                    controls = line[17:].strip()
                    if controls:
                        req_data['related_controls'] = [
                            c.strip() for c in controls.split(',')
                        ]

            if req_data['text']:
                requirements.append(ExtractedRequirement(
                    requirement_id=req_data['requirement_id'],
                    text=req_data['text'],
                    requirement_type=req_data['requirement_type'],
                    related_controls=req_data['related_controls'],
                    keywords=req_data['keywords'],
                    confidence_score=0.8,
                ))

        return requirements

    def _parse_policies_response(
        self,
        content: str
    ) -> List[ExtractedPolicy]:
        """Parse LLM response for policy extraction."""
        policies = []
        policy_blocks = content.split('---')

        for block in policy_blocks:
            if 'POLICY:' not in block and 'TITLE:' not in block:
                continue

            policy_data = {
                'title': '',
                'content': '',
                'section_number': None,
                'related_controls': [],
            }

            lines = block.split('\n')
            current_field = None

            for line in lines:
                line = line.strip()
                if line.startswith('TITLE:'):
                    policy_data['title'] = line[6:].strip()
                elif line.startswith('SECTION_NUMBER:'):
                    policy_data['section_number'] = line[15:].strip()
                elif line.startswith('CONTENT:'):
                    policy_data['content'] = line[8:].strip()
                    current_field = 'content'
                elif line.startswith('RELATED_CONTROLS:'):
                    controls = line[17:].strip()
                    if controls:
                        policy_data['related_controls'] = [
                            c.strip() for c in controls.split(',')
                        ]
                    current_field = None
                elif current_field == 'content' and line:
                    policy_data['content'] += ' ' + line

            if policy_data['title'] or policy_data['content']:
                policies.append(ExtractedPolicy(
                    title=policy_data['title'],
                    content=policy_data['content'],
                    section_number=policy_data['section_number'],
                    parent_section=None,
                    related_controls=policy_data['related_controls'],
                ))

        return policies

    def _parse_mapping_response(
        self,
        content: str,
        original_descriptions: List[str]
    ) -> List[Dict[str, Any]]:
        """Parse mapping response."""
        mappings = []

        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if not line or not line[0].isdigit():
                continue

            # Parse "1. Description -> Control IDs"
            if '->' in line:
                parts = line.split('->', 1)
                if len(parts) == 2:
                    # Extract index from start
                    match = re.match(r'(\d+)\.\s*(.+)', parts[0])
                    if match:
                        idx = int(match.group(1)) - 1
                        control_ids = [c.strip() for c in parts[1].split(',')]
                        if 0 <= idx < len(original_descriptions):
                            mappings.append({
                                'description': original_descriptions[idx][:200],
                                'mapped_controls': control_ids,
                                'confidence': 'low' if '?' in parts[1] else 'high',
                            })

        return mappings

    def _parse_coverage_response(self, content: str) -> Dict[str, Any]:
        """Parse coverage analysis response."""
        result = {
            'coverage_summary': '',
            'covered_areas': [],
            'gaps': [],
            'control_mappings': [],
        }

        lines = content.split('\n')
        current_section = None

        for line in lines:
            line = line.strip()

            if line.startswith('COVERAGE_SUMMARY:'):
                result['coverage_summary'] = line[17:].strip()
            elif line.startswith('COVERED_AREAS:'):
                current_section = 'covered'
            elif line.startswith('GAPS:'):
                current_section = 'gaps'
            elif line.startswith('CONTROL_MAPPINGS:'):
                current_section = 'mappings'
            elif line.startswith('- ') and current_section:
                item = line[2:].strip()
                if current_section == 'covered':
                    result['covered_areas'].append(item)
                elif current_section == 'gaps':
                    result['gaps'].append(item)
                elif current_section == 'mappings':
                    result['control_mappings'].append(item)

        return result

    def _deduplicate_controls(
        self,
        controls: List[ExtractedControl]
    ) -> List[ExtractedControl]:
        """Remove duplicate controls based on title/description similarity."""
        if len(controls) <= 1:
            return controls

        seen = set()
        unique_controls = []

        for control in controls:
            # Create a simple fingerprint from title + first 100 chars of description
            fingerprint = (
                control.title.lower().strip() +
                control.description[:100].lower().strip()
            )

            if fingerprint not in seen:
                seen.add(fingerprint)
                unique_controls.append(control)

        return unique_controls


# Singleton instance
_ai_extractor_service: Optional[AIExtractorService] = None


def get_ai_extractor_service() -> AIExtractorService:
    """Get or create the AI Extractor service instance."""
    global _ai_extractor_service
    if _ai_extractor_service is None:
        _ai_extractor_service = AIExtractorService()
    return _ai_extractor_service
