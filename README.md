<p align="center">
  <img src="gh_banner.png" alt="CISO Assistant" width="100%"/>
</p>

<h1 align="center">CISO Assistant</h1>

<p align="center">
  <strong>Enterprise GRC Platform for Modern Security Teams</strong>
</p>

<p align="center">
  <a href="#deployment">Deployment</a> &bull;
  <a href="#core-capabilities">Capabilities</a> &bull;
  <a href="#supported-frameworks">Frameworks</a> &bull;
  <a href="#development-setup">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="MIT License"/>
  <img src="https://img.shields.io/github/v/release/tashiscool/ciso-assistant-community?style=flat-square" alt="Release"/>
  <img src="https://img.shields.io/github/stars/tashiscool/ciso-assistant-community?style=flat-square" alt="Stars"/>
</p>

---

CISO Assistant is a comprehensive **Governance, Risk, and Compliance (GRC)** platform that unifies cybersecurity management into a single, intelligent hub. Built with a **Domain-Driven Design** architecture, it provides enterprise-grade capabilities for organizations of any size.

## Why CISO Assistant?

- **Unified Platform**: Connect compliance, risk management, security operations, and third-party risk in one place
- **90+ Frameworks**: Built-in support for ISO 27001, NIST CSF, SOC 2, FedRAMP, CMMC, GDPR, and more
- **AI-Powered**: Intelligent assistance for control mapping, gap analysis, and documentation
- **API-First**: Full REST API for automation and integration with your security stack
- **MIT Licensed**: Fully open source under the permissive MIT license - use freely in commercial projects

---

## Deployment

### Quick Start (Docker)

```bash
git clone https://github.com/tashiscool/ciso-assistant-community.git
cd ciso-assistant-community
./docker-compose.sh
```

Access the application at [https://localhost:8443](https://localhost:8443)

### Production Deployment Options

CISO Assistant provides two production deployment scripts with interactive setup wizards, AWS GovCloud support, and full management tooling.

| Deployment | OS | FIPS | Best For |
|------------|-----|------|----------|
| [EC2 RHEL 8](#ec2--rhel-8) | RHEL 8 | No | Standard AWS/GovCloud deployments |
| [Ubuntu FIPS](#ubuntu-fips) | Ubuntu 20.04/22.04 | Yes | Federal/government FIPS compliance |

Both deployments include:
- **Interactive configuration wizard** - walks through every setting
- **RDS PostgreSQL** with IAM authentication (15-min token refresh)
- **S3 file storage** with IAM role-based access
- **Task queue options** - Huey/SQLite, Huey/Redis (ElastiCache), or Celery/SQS
- **Nginx reverse proxy** with TLS 1.2/1.3
- **Systemd services** with auto-restart
- **Management console** (`sudo ciso-assistant`) with helper scripts

---

### EC2 / RHEL 8

Deploy on AWS EC2 with RHEL 8, RDS PostgreSQL, and S3:

```bash
# SSH to your EC2 instance
ssh ec2-user@your-instance

# Download and run
curl -O https://raw.githubusercontent.com/tashiscool/ciso-assistant-community/main/deploy/ec2-rhel8/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

The script walks through 5 phases:

| Phase | What Happens |
|-------|--------------|
| 1. System Packages | Installs Python 3.11, Node.js 20 |
| 2. Application | Clones repo, sets up backend (Poetry/Gunicorn) and frontend (npm/SvelteKit) |
| 3. Configuration | Interactive wizard for DB, S3, task queue, logging |
| 4. System Config | Creates systemd services, configures nginx, SELinux, firewall |
| 5. Post-Install | SSL setup, database test, migrations, admin user, starts services |

**AWS prerequisites**: EC2 with IAM role, RDS PostgreSQL 14+, S3 bucket. Optional: ElastiCache Redis or SQS queue.

See [deploy/ec2-rhel8/README.md](deploy/ec2-rhel8/README.md) for full documentation including IAM policies and RDS setup.

---

### Ubuntu FIPS

Deploy on Ubuntu 20.04/22.04 with **FIPS 140-2/140-3 validated cryptography**:

```bash
# SSH to your instance
ssh ubuntu@your-instance

# Download and run
curl -O https://raw.githubusercontent.com/tashiscool/ciso-assistant-community/main/deploy/ubuntu-fips/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

In addition to the standard 5 phases, this deployment adds:

- **Ubuntu Pro FIPS** package enablement with automatic reboot handling
- **FIPS compliance verification** via `sudo ciso-assistant fips`
- **System OpenSSL** linked into Python virtualenv for FIPS crypto
- **FIPS-compliant TLS** cipher configuration in nginx

**Prerequisites**: Ubuntu Pro subscription (for FIPS packages), EC2 with IAM role, RDS PostgreSQL 14+, S3 bucket.

See [deploy/ubuntu-fips/README.md](deploy/ubuntu-fips/README.md) for full documentation.

---

### Management Console

After deployment, all management is handled through the `ciso-assistant` console:

```bash
# Interactive management menu
sudo ciso-assistant
```

```
========================================
  CISO Assistant Management Console
========================================

Quick Status:
  FIPS Mode: ENABLED            # (Ubuntu FIPS only)
  Services: 4/4 running
  URL: https://ciso.example.gov

 1) Show service status          6) Setup SSL certificate
 2) Start all services           7) Test database connection
 3) Stop all services            8) Run migrations
 4) Restart all services         9) Manage admin users
 5) View logs                   10) Check FIPS compliance
```

**Direct commands:**

```bash
sudo ciso-assistant status           # Service status with uptime
sudo ciso-assistant restart          # Restart all services
sudo ciso-assistant restart backend  # Restart specific service
sudo ciso-assistant logs             # View recent logs
sudo ciso-assistant follow           # Follow logs real-time
sudo ciso-assistant health           # HTTP endpoint + disk + memory checks

sudo ciso-assistant ssl              # SSL certificate setup (Let's Encrypt)
sudo ciso-assistant db               # Database connection diagnostic
sudo ciso-assistant migrate          # Run database migrations
sudo ciso-assistant admin            # Admin user management
sudo ciso-assistant fips             # FIPS compliance check (Ubuntu)

sudo ciso-assistant config           # Edit configuration + restart
sudo ciso-assistant update           # Pull latest code and update
```

### Helper Scripts

Located in `/opt/ciso-assistant/scripts/`:

| Script | Purpose | Key Commands |
|--------|---------|--------------|
| `setup-ssl.sh` | SSL certificate management | `--letsencrypt`, `--check`, `--self-signed` |
| `test-db.sh` | Database connection testing | `--verbose`, `--env-only`, `--network-only` |
| `run-migrations.sh` | Database migrations | `--full`, `--check`, `--plan` |
| `create-admin.sh` | Admin user management | `--create`, `--list`, `--reset EMAIL` |
| `manage-services.sh` | Service management | `start`, `stop`, `restart`, `health` |
| `check-fips.sh` | FIPS compliance (Ubuntu) | `--verbose`, `--json` |

### Post-Deployment Migrations

If the initial deployment uses placeholder database values, run migrations after editing the config:

```bash
# Edit configuration with real values
sudo vi /etc/ciso-assistant/env

# Run migrations
sudo ./deploy.sh --run-migrations

# Or use the management console
sudo ciso-assistant migrate --full
```

### Task Queue Options

| Backend | Config | Use Case |
|---------|--------|----------|
| Huey + SQLite | `TASK_QUEUE_BACKEND=huey` (default) | Single-server, simple |
| Huey + Redis | `TASK_QUEUE_BACKEND=huey` + `USE_REDIS=True` | ElastiCache, multi-server |
| Celery + SQS | `TASK_QUEUE_BACKEND=celery` + `USE_SQS=True` | AWS managed, serverless |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | Secret key for sessions | Auto-generated |
| `CISO_ASSISTANT_URL` | Public URL | `http://localhost:5173` |
| `POSTGRES_NAME` | Database name | SQLite if unset |
| `POSTGRES_USER` | Database user | - |
| `DB_HOST` | RDS endpoint | - |
| `RDS_IAM_AUTH` | Enable IAM auth | `False` |
| `AWS_REGION` | AWS region | `us-gov-west-1` |
| `USE_S3` | Enable S3 storage | `False` |
| `AWS_AUTH_MODE` | `iam` or `credentials` | `credentials` |
| `USE_REDIS` | Enable Redis caching | `False` |
| `TASK_QUEUE_BACKEND` | `huey` or `celery` | `huey` |
| `USE_SQS` | Enable SQS queue | `False` |
| `FIPS_MODE` | FIPS indicator | `False` |

### Kubernetes

Helm charts are available in the `charts/` directory.

---

## Core Capabilities

### Governance & Compliance

| Feature | Description |
|---------|-------------|
| **Multi-Framework Assessment** | Assess against multiple frameworks simultaneously with automatic control mapping |
| **Continuous Monitoring** | Pre-built ConMon profiles for FedRAMP, ISO 27001, SOC 2, NIST CSF, and CMMC |
| **OSCAL Integration** | Bi-directional OSCAL support with SSP generation and FedRAMP validation |
| **Audit Management** | Complete audit lifecycle with evidence collection and finding tracking |

### Risk Management

| Feature | Description |
|---------|-------------|
| **Risk Registers** | Business, asset, and third-party risk tracking with treatment workflows |
| **Quantitative Risk (CRQ)** | Monte Carlo simulation, Loss Exceedance Curves, and ROI analysis |
| **Security Graph** | Visual relationship mapping with blast radius and attack path analysis |
| **EBIOS-RM** | Full implementation of the French ANSSI risk methodology |

### FedRAMP & RMF Operations

| Feature | Description |
|---------|-------------|
| **FedRAMP 20x** | Complete support for FedRAMP Rev 5 and continuous authorization requirements |
| **Key Security Indicators** | Real-time KSI dashboard with trend analysis and threshold alerts |
| **Change Control Board** | Significant Change Notification (SCN) workflow with approval tracking |
| **Incident Response** | Security incident management with US-CERT reporting timelines |
| **Trust Center** | Public-facing compliance portal for customers and stakeholders |
| **Ongoing Authorization** | Automated OAR generation with POA&M tracking |

### AI Assistant

| Capability | Description |
|------------|-------------|
| **AI Auditor** | Automated compliance gap detection and remediation suggestions |
| **AI Author** | Generate policies, procedures, and control documentation |
| **AI Explainer** | Role-specific explanations (executive, auditor, technical) |
| **AI Extractor** | Extract structured data from policy documents and SOC reports |

### Integration & Automation

| Feature | Description |
|---------|-------------|
| **Connector Framework** | 20+ pre-built connectors for security tools and cloud platforms |
| **Evidence Automation** | Scheduled evidence collection with validation and freshness tracking |
| **Workflow Engine** | Visual workflow builder for custom GRC processes |
| **OCSF Support** | Security event normalization with OSCAL mapping |

---

## Connector Integrations

| Category | Integrations |
|----------|--------------|
| **Cloud Security** | Wiz, Prisma Cloud, Aqua |
| **SAST/DAST** | Snyk, Veracode, SonarCloud, Burp Suite, IBM AppScan |
| **Vulnerability** | Rapid7 InsightVM, Nessus, Qualys |
| **Container** | Trivy |
| **CI/CD** | GitLab Security, GitHub Advanced Security, JFrog Xray |
| **Identity** | Active Directory, Okta, Microsoft Intune |
| **Endpoint** | Microsoft Defender |
| **CRM** | Salesforce, HubSpot |

---

## Architecture

CISO Assistant is built on a **Domain-Driven Design (DDD)** architecture with 15 bounded contexts:

```
backend/core/bounded_contexts/
├── organization/           # Org units, users, groups, roles
├── asset_and_service/      # Asset management, classifications
├── control_library/        # Controls, policies, evidence
├── risk_registers/         # Risk management workflows
├── compliance/             # Frameworks, assessments, audits
├── privacy/                # Data assets, flows, PIAs
├── security_operations/    # Incidents, awareness programs
├── third_party_management/ # Vendor risk assessments
├── business_continuity/    # BCP, disaster recovery
├── rmf_operations/         # STIG, vulnerability mgmt, RMF
├── security_graph/         # Relationship visualization
├── workflow_engine/        # Custom process automation
├── assessment_engine/      # Dynamic questionnaires
└── version_history/        # Audit trail, change tracking
```

### Tech Stack

- **Backend**: Django 5.x, Django REST Framework, PostgreSQL
- **Frontend**: SvelteKit 2.x, Svelte 5, Tailwind CSS
- **Task Queue**: Huey (SQLite/Redis) or Celery (Redis/SQS)
- **Deployment**: Docker, EC2 (RHEL 8 / Ubuntu FIPS), Kubernetes

---

## Supported Frameworks

CISO Assistant includes **90+ compliance frameworks** out of the box:

### Popular Frameworks

| Framework | Region |
|-----------|--------|
| ISO 27001:2022 | Global |
| NIST CSF v2.0 | US |
| NIST SP 800-53 rev5 | US |
| SOC 2 | US |
| PCI DSS 4.0 | Global |
| GDPR | EU |
| NIS2 | EU |
| FedRAMP rev5 | US |
| CMMC v2 | US |
| HIPAA (NIST 800-66) | US |
| CIS Controls v8 | Global |
| DORA | EU |
| Essential Eight | AU |
| TISAX v6.0 | DE |

### AI & Cloud Frameworks

| Framework | Focus |
|-----------|-------|
| EU AI Act | AI Governance |
| NIST AI RMF | AI Risk |
| ISO 42001:2023 | AI Management |
| CSA CCM | Cloud Security |
| SecNumCloud | Cloud (FR) |
| BSI C5 | Cloud (DE) |

### Industry-Specific

| Framework | Industry |
|-----------|----------|
| SWIFT CSCF | Financial |
| CJIS | Law Enforcement |
| Part-IS | Aviation |
| TIBER-EU | Financial |
| ITAR | Defense |
| ENS | Government (ES) |

[View all 90+ frameworks →](backend/library/libraries/)

---

## Development Setup

### Requirements

- Python 3.12+
- Node.js 22+
- pnpm 9.0+
- PostgreSQL (optional, SQLite default)

### Backend

```bash
cd backend
poetry install
poetry run python manage.py migrate
poetry run python manage.py createsuperuser
poetry run python manage.py runserver
```

### Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

Access the dev server at [http://localhost:5173](http://localhost:5173)

---

## API & Integration

Interactive API documentation (Swagger) is available at `/api/schema/swagger/` when `DJANGO_DEBUG=True`.

### Authentication

```bash
# Get token
curl -X POST http://localhost:8000/api/iam/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@localhost", "password": "your-password"}'

# Use token
curl http://localhost:8000/api/applied-controls/ \
  -H "Authorization: Token <your-token>"
```

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Pre-commit Hooks

```bash
pre-commit install
```

### Running Tests

```bash
# Backend
cd backend && poetry run pytest

# Frontend E2E
cd frontend && ./tests/e2e-tests.sh
```

---

## Test Coverage

CISO Assistant maintains comprehensive test coverage across all critical modules:

| Module | Tests | Coverage Focus |
|--------|-------|----------------|
| **AI Assistant** | 264 | Auditor, Author, Explainer, Extractor, Context Builder |
| **OSCAL Integration** | 77 | SSP generation, FedRAMP validation, OSCAL import/export |
| **Evidence Automation** | 48 | AWS, Azure, GitHub, API connectors |
| **POA&M Services** | 23 | FedRAMP exports, OSCAL POA&M, deviation reports |
| **Risk Management** | 54 | CVSS calculation, risk assessment, dashboards, KPIs |
| **Privacy Services** | 49 | PIA, consent management, data subject rights |
| **Compliance Services** | 36 | Assessment workflows, evidence collection, reporting |
| **Questionnaire Engine** | 39 | Conditional logic, scoring, progress tracking |
| **Bounded Contexts** | 100+ | FedRAMP 20x, Trust Center, Privacy, Third-Party |
| **Continuous Monitoring** | 50+ | ConMon profiles, KSI tracking, alerts |
| **MIT Modules** | 424 | All core GRC models, IAM, privacy, risk, integrations |

**Total**: 1,300+ backend tests ensuring enterprise-grade reliability.

### Quality Assurance

- **Domain-Driven Design**: Each bounded context has isolated unit tests
- **Service Layer Testing**: All business logic services are comprehensively tested
- **Mock-Based Testing**: No database dependencies for unit tests
- **Edge Case Coverage**: Boundary conditions and error handling tested

---

## Module Overview

CISO Assistant provides a complete set of GRC modules:

| Module | Models | Lines | Description |
|--------|--------|-------|-------------|
| **iam_mit** | 10 | 868 | Folder-based hierarchical RBAC |
| **core/models_mit** | 42 | 4,018 | Complete GRC domain models |
| **core/utils_mit** | - | 412 | String, date, hash utilities |
| **core/helpers_mit** | - | 448 | Status, scoring, statistics helpers |
| **privacy_mit** | 9 | 1,041 | GDPR/data protection compliance |
| **resilience_mit** | 3 | 636 | Business continuity management |
| **ebios_rm_mit** | 12 | 944 | EBIOS RM methodology |
| **tprm_mit** | 5 | 658 | Third-party risk management |
| **library_mit** | 2 | 221 | Framework library management |
| **cal_mit** | 2 | 438 | Calendar and event scheduling |
| **global_settings_mit** | 2 | 377 | Application settings & feature flags |
| **metrology_mit** | 6 | 809 | Metrics and dashboards |
| **webhooks_mit** | 3 | 461 | Webhook notifications |
| **integrations_mit** | 4 | 553 | External tool integrations |
| **pmbok_mit** | 2 | 385 | Portfolio management |
| **data_wizard_mit** | - | 976 | Excel import/export (EBIOS, ARM) |

### Key Features

**IAM Module** - Complete folder-based RBAC:
- Hierarchical folders (ROOT/DOMAIN/ENCLAVE)
- FolderMixin for multi-tenant scoping
- Role assignments with perimeter folders
- Recursive permission checking

**Core Module** - Full GRC domain:
- Organization, Domain, Perimeter
- Framework, Control, Policy, AppliedControl
- RiskMatrix, RiskScenario, RiskAssessment
- Evidence, Incident, Campaign, Audit

**Privacy Module** - GDPR compliance:
- Processing activities (ROPA)
- Data subject rights (DSAR)
- Data breach management
- Cross-border transfers

**EBIOS RM Module** - French ANSSI methodology:
- 5-workshop structure
- RoTo (Risk Origin/Target Objective)
- Attack paths and kill chains
- Stakeholder criticality

**Metrology Module** - Metrics and dashboards:
- Custom and builtin metrics
- Configurable dashboards
- Time-series tracking

**Integrations Module** - External tools:
- Provider registry
- Bi-directional sync
- Webhook delivery

**Data Wizard Module** - Excel import/export:
- EBIOS RM study import/export
- ARM format support (French/English)
- Configurable sheet mapping
- Header normalization

### Usage

Modules can be imported independently:

```python
# Use models in your project
from iam_mit import Folder, Role, RoleAssignment
from privacy_mit import Processing, DataBreach, RightRequest
from ebios_rm_mit import EbiosRMStudy, FearedEvent, RoTo
```

---

## Comparison to Commercial Tools

CISO Assistant provides feature parity with commercial GRC platforms:

| Feature | CISO Assistant | Paramify | RegScale |
|---------|----------------|----------|----------|
| OSCAL SSP Generation | Yes | Yes | Yes |
| FedRAMP Automation | Yes | Yes | Yes |
| Multi-Framework Support | Yes (90+) | Yes | Yes |
| Continuous Monitoring | Yes | Yes | Yes |
| Evidence Automation | Yes | Yes | Yes |
| AI-Powered Assistance | Yes | No | No |
| Risk Quantification (CRQ) | Yes | No | No |
| Security Graph | Yes | No | No |
| Open Source | Yes | No | No |
| Self-Hosted | Yes | No | Yes |
| MIT Licensed | Yes | No | No |

---

## License

CISO Assistant is released under the **MIT License**.

```
MIT License

Copyright (c) 2026 Tash

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

This means you can:
- Use commercially
- Modify freely
- Distribute copies
- Use privately
- Sublicense

See [LICENSE](LICENSE) for the full license text.

---

## Acknowledgments

Built with [Django](https://www.djangoproject.com/), [SvelteKit](https://kit.svelte.dev/), [Tailwind CSS](https://tailwindcss.com/), [eCharts](https://echarts.apache.org/), and [compliance-trestle](https://ibm.github.io/compliance-trestle/).

---

<p align="center">
  Maintained by <strong>Tash</strong>
</p>
