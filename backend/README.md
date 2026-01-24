# CISO Assistant Backend

A Django-based backend implementing Domain-Driven Design (DDD) architecture for comprehensive GRC (Governance, Risk, and Compliance) management.

## Architecture Overview

The backend follows a **Bounded Context** pattern with clear separation of concerns:

```
backend/
├── core/bounded_contexts/     # DDD Bounded Contexts
├── integrations/              # External system integrations
├── ai_assistant/              # AI-powered features
├── iam/                       # Identity & Access Management
└── [feature modules]/         # Feature-specific modules
```

## Bounded Contexts

| Context | Description | Status |
|---------|-------------|--------|
| `assessment_engine` | Lightning & Master assessments, test cases, bulk operations | In Progress |
| `asset_and_service` | Asset management and service catalog | Active |
| `business_continuity` | BCP plans, disaster recovery, RTO/RPO tracking | Active |
| `compliance` | Compliance frameworks and requirements | Active |
| `control_library` | Security controls and control families | Active |
| `organization` | Organizational structure, domains, perimeters | Active |
| `privacy` | GDPR compliance, data assets, consent records, DSR | Active |
| `risk_registers` | Risk assessment and risk register management | Active |
| `rmf_operations` | FedRAMP 20x, OSCAL, KSI management | Active |
| `security_graph` | Security relationship visualization | In Progress |
| `security_operations` | Security operations workflows | Active |
| `third_party_management` | Vendor risk management | Active |
| `version_history` | Audit trails, versioning, snapshots | In Progress |
| `workflow_engine` | Workflow definitions and execution | Active |

## Integrations

### OCSF (Open Cybersecurity Schema Framework)
Located in `integrations/ocsf/`:
- Parse OCSF security findings
- Translate OCSF to OSCAL format
- Support for compliance findings, vulnerability findings, detection findings

### OSCAL (Open Security Controls Assessment Language)
Located in `oscal_integration/`:
- Import/export OSCAL catalogs, profiles, and assessment results
- FedRAMP package generation
- SSP (System Security Plan) support

### Connectors
Located in `connectors/`:
- External tool integrations
- Sync scheduling and data mapping

## AI Assistant

Located in `ai_assistant/`:
- **LLM Client**: Unified interface for OpenAI, Anthropic, Azure, and local models
- **AI Auditor**: Automated compliance auditing
- **AI Author**: Document generation assistance
- **AI Explainer**: Control and requirement explanations
- **AI Extractor**: Data extraction from documents

## Key Modules

| Module | Purpose |
|--------|---------|
| `crq` | Cyber Risk Quantification |
| `ebios_rm` | EBIOS Risk Manager methodology |
| `evidence_automation` | Evidence collection and validation |
| `metrology` | Metrics and KPIs |
| `pmbok` | Project management integration |
| `privacy` | Privacy management (GDPR, CCPA) |
| `resilience` | Operational resilience |
| `tprm` | Third-Party Risk Management |

## Development

### Prerequisites
- Python 3.11+
- Poetry for dependency management
- PostgreSQL (recommended) or SQLite

### Setup
```bash
# Install dependencies
poetry install

# Run migrations
poetry run python manage.py migrate

# Start development server
poetry run python manage.py runserver
```

### Running Tests
```bash
# Run all tests
poetry run pytest

# Run specific bounded context tests
poetry run pytest core/bounded_contexts/tests/

# Run with coverage
poetry run pytest --cov=core --cov-report=html

# Run specific test file
poetry run pytest integrations/ocsf/tests.py -v
```

### Test Coverage

| Module | Tests | Coverage |
|--------|-------|----------|
| OCSF Integration | 76 tests | Models, Parser, Translator, API |
| AI Assistant | 58 tests | All LLM clients |
| RMF Operations | 40+ tests | FedRAMP, OSCAL export |
| Assessment Engine | 26 tests | Services, models (scaffold) |
| Version History | 8 tests | Services (scaffold) |

## API Documentation

API endpoints follow REST conventions:

```
/api/iam/                    # Identity management
/api/core/                   # Core GRC operations
/api/privacy/                # Privacy management
/api/business-continuity/    # BCP management
/api/third-party/            # Vendor management
/api/integrations/ocsf/      # OCSF operations
/api/rmf/                    # RMF operations
/api/ai-assistant/           # AI features
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | SQLite |
| `SECRET_KEY` | Django secret key | Generated |
| `DEBUG` | Debug mode | False |
| `OPENAI_API_KEY` | OpenAI API key | None |
| `ANTHROPIC_API_KEY` | Anthropic API key | None |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint | None |

## License

See the main repository LICENSE file.
