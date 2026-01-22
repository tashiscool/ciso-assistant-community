# CISO Assistant - Original Integration Architecture Map

> **Note:** This document describes the architecture PRIOR to DDD migration and OSCAL/FedRAMP/OpenRMF enhancements.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CISO Assistant                                      │
│                    GRC (Governance, Risk, Compliance)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Frontend (SvelteKit)                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │   Routes   │  │    Lib     │  │   Utils    │  │   Stores   │             │
│  │  (pages)   │  │(components)│  │(crud/table)│  │  (state)   │             │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘             │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │ REST API (JSON)
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      Django Backend (Monolithic)                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    URL Router (ciso_assistant/urls.py)                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                  │                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Django REST Framework                          │   │
│  │   ViewSets → Serializers → Models → Database                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL/SQLite)                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2. Backend Application Structure (Original)

```
backend/
├── ciso_assistant/              # Django Project Configuration
│   ├── settings.py              # App settings, installed apps
│   ├── urls.py                  # Root URL routing
│   └── wsgi.py / asgi.py        # Server interfaces
│
├── core/                        # MAIN APPLICATION (Monolithic ~300KB)
│   ├── models.py                # 400+ models in single file
│   ├── views.py                 # ViewSets for all core models
│   ├── serializers.py           # DRF serializers
│   ├── urls.py                  # 100+ API endpoints
│   ├── helpers.py               # Business logic utilities
│   ├── utils.py                 # Permission & utility functions
│   └── base_models.py           # AbstractBaseModel, Mixins
│
├── iam/                         # Identity & Access Management
│   ├── models.py                # User, Role, Folder, UserGroup
│   ├── views.py                 # Auth ViewSets
│   ├── serializers.py           # User/Auth serializers
│   └── sso/                     # SAML/OIDC integration
│
├── library/                     # Framework Library Management
│   ├── models.py                # StoredLibrary, LoadedLibrary
│   ├── views.py                 # Library ViewSets
│   ├── utils.py                 # YAML parsing, framework loading
│   └── libraries/               # 215+ framework YAML files
│
├── ebios_rm/                    # EBIOS Risk Management Module
│   ├── models.py                # EBIOS-specific models (43KB)
│   ├── views.py                 # EBIOS ViewSets
│   └── helpers.py               # EBIOS calculations
│
├── tprm/                        # Third-Party Risk Management
│   ├── models.py                # Entity, Contract, EntityAssessment
│   ├── views.py                 # TPRM ViewSets
│   └── utils.py                 # DORA export/lint
│
├── serdes/                      # Serialization/Backup
│   ├── views.py                 # Backup/Restore endpoints
│   └── utils.py                 # Export/Import utilities
│
├── privacy/                     # Privacy Module
├── resilience/                  # Business Continuity
├── crq/                         # Compliance Requests
├── cal/                         # Calendar
├── metrology/                   # Metrics/KPIs
├── global_settings/             # System Settings
├── webhooks/                    # Event Webhooks
└── integrations/                # External Integrations
```

## 3. Core Models Architecture (Original)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         core/models.py (~300KB)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  REFERENTIAL OBJECTS (Library-based, i18n-enabled)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Framework   │  │ReferenceCtrl│  │   Threat    │  │ RiskMatrix  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│  ASSET MANAGEMENT                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │    Asset    │  │  Perimeter  │  │SecurityExcp │                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
│                                                                              │
│  RISK & ASSESSMENT                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │RiskAssessmt │  │RiskScenario │  │RiskAcceptce │  │Vulnerability│        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│  COMPLIANCE                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │ComplianceAs │  │RequirementAs│  │AppliedCntrl │                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
│                                                                              │
│  EVIDENCE & DOCUMENTATION                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │  Evidence   │  │EvidenceRev  │  │   Policy    │                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
│                                                                              │
│  ORGANIZATIONAL                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Actor    │  │   Campaign  │  │  Incident   │  │TimelineEntry│        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. API Layer (Original)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REST API Endpoints                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  /api/                                                                       │
│  ├── /folders/                    # Content organization                    │
│  ├── /users/                      # User management                         │
│  ├── /user-groups/                # Group management                        │
│  │                                                                          │
│  ├── /frameworks/                 # Compliance frameworks                   │
│  ├── /reference-controls/         # Control definitions                     │
│  ├── /threats/                    # Threat library                          │
│  ├── /risk-matrices/              # Risk severity matrices                  │
│  │                                                                          │
│  ├── /assets/                     # Asset inventory                         │
│  ├── /perimeters/                 # Network perimeters                      │
│  │                                                                          │
│  ├── /risk-assessments/           # Risk evaluations                        │
│  ├── /risk-scenarios/             # Risk scenarios                          │
│  ├── /vulnerabilities/            # Vulnerability tracking                  │
│  │                                                                          │
│  ├── /compliance-assessments/     # Compliance evaluations                  │
│  ├── /requirement-assessments/    # Requirement tracking                    │
│  ├── /applied-controls/           # Implemented controls                    │
│  ├── /policies/                   # Security policies                       │
│  │                                                                          │
│  ├── /evidences/                  # Supporting documentation                │
│  ├── /campaigns/                  # Assessment campaigns                    │
│  ├── /incidents/                  # Security incidents                      │
│  │                                                                          │
│  ├── /iam/                        # Authentication                          │
│  ├── /ebios-rm/                   # EBIOS Risk Management                   │
│  ├── /tprm/                       # Third-Party Risk Management             │
│  ├── /serdes/                     # Backup/Restore                          │
│  └── /settings/                   # Global settings                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5. Frontend Structure (Original)

### 5.1 Overview Statistics

| Category | Count |
|----------|-------|
| Route directories | 269 |
| Svelte components | 224 |
| Component directories | 42 |
| Utility files | 21 |

### 5.2 Route Architecture (269 directories)

```
frontend/src/routes/
├── (app)/                              # Authenticated application routes
│   ├── (internal)/                     # Main internal application
│   │   │
│   │   ├── risk-assessments/           # Risk assessment management
│   │   │   └── [id=uuid]/              # Individual assessment
│   │   │       ├── convert-to-quantitative/
│   │   │       ├── sync-to-actions/
│   │   │       ├── export/ (xlsx, pdf, csv)
│   │   │       └── action-plan/ (export/excel, export/pdf)
│   │   │
│   │   ├── compliance-assessments/     # Compliance assessment management
│   │   │   └── [id=uuid]/
│   │   │       ├── flash-mode/
│   │   │       ├── comparable_audits/
│   │   │       ├── evidences-list/
│   │   │       ├── action-plan/
│   │   │       ├── export/ (xlsx, csv)
│   │   │       └── tree/
│   │   │
│   │   ├── requirement-assessments/    # Requirement tracking
│   │   │   └── [id=uuid]/
│   │   │       └── suggestions/applied-controls/
│   │   │
│   │   ├── asset-assessments/          # Asset evaluation
│   │   │   └── [id=uuid]/
│   │   │       ├── dependencies/
│   │   │       └── action-plan/
│   │   │
│   │   ├── entity-assessments/         # TPRM entity assessments
│   │   │   └── [id=uuid]/
│   │   │
│   │   ├── validation-flows/           # Workflow validation
│   │   │   └── [id=uuid]/
│   │   │
│   │   ├── risk-matrices/              # Risk matrix configuration
│   │   │   └── [id=uuid]/
│   │   │
│   │   ├── ebios-rm/                   # EBIOS Risk Management module
│   │   │   ├── [id=uuid]/
│   │   │   │   ├── workshop-one/ through workshop-five/
│   │   │   │   └── export/
│   │   │   └── feared-events/
│   │   │       └── [id=uuid]/
│   │   │
│   │   ├── calendar/                   # Calendar views
│   │   │   └── [year]/[month]/
│   │   │
│   │   ├── settings/                   # Application settings
│   │   │   ├── webhooks/
│   │   │   │   ├── endpoints/[id=uuid]/
│   │   │   │   └── event-types/
│   │   │   └── saml/download-cert/
│   │   │
│   │   ├── backup-restore/             # Database backup/restore
│   │   │   └── dump-db/
│   │   │
│   │   ├── privacy/                    # Privacy management
│   │   │   ├── data-assets/[id=uuid]/
│   │   │   ├── consent-records/
│   │   │   └── data-subject-rights/
│   │   │
│   │   ├── experimental/               # Experimental features
│   │   │   ├── ecosystem/
│   │   │   ├── mapping/[id=uuid]/
│   │   │   ├── timeseries/
│   │   │   ├── ordered-list/
│   │   │   ├── circle-packing/
│   │   │   ├── graph/
│   │   │   ├── calendar-activity/
│   │   │   ├── loss-exceedance/
│   │   │   ├── yearly-tasks-review/
│   │   │   └── batch-create/
│   │   │
│   │   ├── requirement-mapping-sets/   # Framework mapping
│   │   │   └── graph/
│   │   │
│   │   ├── sync-mappings/[id=uuid]/    # Mapping synchronization
│   │   ├── mapping-libraries/          # Mapping library management
│   │   ├── recap/                      # Summary/recap views
│   │   ├── ro-to/[id=uuid]/edit/       # Risk objectives
│   │   ├── security/                   # Security settings
│   │   │
│   │   └── [model=urlmodel]/           # Dynamic model routes (generic)
│   │       ├── [id=uuid]/
│   │       │   ├── [field=fields]/
│   │       │   └── edit/
│   │       ├── export/xlsx/
│   │       └── [filter=filters]/
│   │
│   └── (third-party)/                  # Third-party risk management
│       └── [Various TPRM routes]
│
└── (authentication)/                   # Authentication routes
    ├── login/
    ├── register/
    ├── password-reset/
    └── [SSO routes]
```

### 5.3 Component Architecture (224 components in 42 directories)

```
frontend/src/lib/components/
│
├── Anchor/                     # Navigation anchor components
├── Assets/                     # Asset-related UI components
├── BIA/                        # Business Impact Analysis components
├── Breadcrumbs/                # Breadcrumb navigation
├── Calendar/                   # Calendar widgets and views
├── Chart/                      # Chart/graph components
├── CommandPalette/             # Command palette (Cmd+K functionality)
│
├── ContextMenu/                # Context menu system (5 subdirectories)
│   ├── elementary-actions/     # Basic action menus
│   ├── applied-controls/       # Control-specific actions
│   ├── task-nodes/             # Task node actions
│   ├── evidences/              # Evidence-related actions
│   └── ebios-rm/               # EBIOS-specific actions
│
├── DataViz/                    # Data visualization components
│   └── (Charts, cards, metrics displays)
│
├── DetailView/                 # Detail page components
│   └── (Object detail views, side panels)
│
├── Dropdown/                   # Dropdown menus and selects
│
├── EbiosRM/                    # EBIOS Risk Management UI
│   └── (Workshop components, risk scenarios)
│
├── Forms/                      # Form system (2 subdirectories)
│   ├── ModelForm/              # Dynamic model-based forms
│   └── OTP/                    # One-time password inputs
│
├── FrameworkEquivalence/       # Framework mapping visualizations
├── FrameworkMappingsChart/     # Framework mapping charts
│
├── GanttView/                  # Gantt chart timeline views
│
├── List/                       # List components
├── Logo/                       # Logo components
│
├── Modals/                     # Modal dialog components
│   └── (Confirmation, forms, info modals)
│
├── ModelTable/                 # Data table components
│   └── (Sortable, filterable tables)
│
├── RiskMatrix/                 # Risk matrix visualization
│   └── (Heat maps, severity grids)
│
├── Settings/                   # Settings UI components
│
├── SideBar/                    # Sidebar navigation
│   └── QuickStart/             # Quick start guides
│
├── Snippets/                   # Reusable code snippets
│   └── AutocompleteSelect/     # Autocomplete select widget
│
├── TableOfContents/            # Table of contents navigation
├── TableRowActions/            # Table row action buttons
│
├── Toast/                      # Toast notification components
├── TreeView/                   # Tree view components
│
├── ValidationFlows/            # Workflow validation UI
│
├── rmf/                        # RMF-specific components (NEW - added for enhancements)
│
└── utils/                      # Component utilities
```

### 5.4 Utility Layer (21 files)

```
frontend/src/lib/utils/
│
├── Core Business Logic
│   ├── crud.ts               # 82KB - CRUD operations for all models
│   ├── schemas.ts            # 56KB - Zod schemas for model validation
│   ├── table.ts              # 61KB - Table configurations, columns, filters
│   └── types.ts              # TypeScript type definitions
│
├── Navigation & Routing
│   ├── breadcrumbs.ts        # Breadcrumb generation logic
│   ├── load.ts               # SvelteKit load functions
│   └── toc.ts                # Table of contents generation
│
├── State Management
│   ├── stores.ts             # Svelte stores (global state)
│   └── cookies.ts            # Cookie management
│
├── Authentication & Security
│   ├── access-control.ts     # Permission checking
│   ├── csrf.ts               # CSRF token handling
│   └── actions.ts            # Form actions and submissions
│
├── Internationalization
│   ├── i18n.ts               # Translation utilities
│   └── locales.ts            # Locale configuration
│
├── UI Helpers
│   ├── helpers.ts            # General UI helper functions
│   ├── datetime.ts           # Date/time formatting
│   ├── constants.ts          # UI constants and enums
│   └── related-visibility.ts # Related field visibility logic
│
├── External Integrations
│   ├── webhooks.ts           # Webhook configuration
│   └── external-links.ts     # External link handling
│
└── Configuration
    └── sidebar-config.ts     # Sidebar navigation configuration
```

### 5.5 UI Framework Stack

| Technology | Purpose |
|------------|---------|
| SvelteKit | Full-stack framework (SSR + SPA) |
| Svelte 5 | Reactive UI with runes ($state, $derived) |
| Skeleton UI | Component library (pre-Svelte 5 version) |
| TailwindCSS | Utility-first CSS framework |
| TypeScript | Type-safe development |
| Zod | Runtime schema validation |
| Chart.js | Data visualization |

### 5.6 Key UI Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UI Component Hierarchy                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Page Layout                                                                 │
│  ├── SideBar (navigation)                                                   │
│  ├── Breadcrumbs (location)                                                 │
│  └── Main Content                                                           │
│      ├── ModelTable (list views)                                            │
│      │   ├── TableRowActions                                                │
│      │   └── ContextMenu                                                    │
│      ├── DetailView (object views)                                          │
│      │   ├── Forms/ModelForm                                                │
│      │   └── DataViz components                                             │
│      └── Modals (dialogs)                                                   │
│                                                                              │
│  Data Flow                                                                   │
│  ├── +page.server.ts → load() → API fetch                                  │
│  ├── +page.svelte → $page.data → render                                    │
│  └── Actions → form submission → API mutation                               │
│                                                                              │
│  State Management                                                            │
│  ├── Server state: SvelteKit load functions                                │
│  ├── Client state: Svelte stores (stores.ts)                               │
│  └── Form state: Superforms + Zod validation                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6. Data Flow (Original)

```
┌──────────────┐     HTTP      ┌──────────────┐    ORM     ┌──────────────┐
│   Frontend   │ ───────────▶ │   ViewSet    │ ─────────▶ │    Model     │
│  (SvelteKit) │              │   (DRF)      │            │  (Django)    │
└──────────────┘              └──────────────┘            └──────────────┘
       │                             │                           │
       │  fetch('/api/...')         │  Serializer               │  QuerySet
       │                             │                           │
       ▼                             ▼                           ▼
┌──────────────┐              ┌──────────────┐            ┌──────────────┐
│    Store     │ ◀─────────── │    JSON      │ ◀───────── │   Database   │
│  (Svelte)    │   Response   │   Response   │   Data     │ (PostgreSQL) │
└──────────────┘              └──────────────┘            └──────────────┘
```

## 7. Integration Points (Original)

| Integration | Type | Description |
|-------------|------|-------------|
| SSO (SAML/OIDC) | Authentication | External identity providers |
| Webhooks | Events | Push notifications to external systems |
| Library Import | Data | YAML framework files |
| Backup/Restore | Data | Full database export/import |
| Audit Log | Logging | Change tracking via auditlog |

## 8. Module Dependencies (Original)

```
                    ┌─────────────┐
                    │     iam     │
                    │ (users/auth)│
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   library   │    │    core     │    │global_setng │
│(frameworks) │◀───│   (main)    │───▶│  (config)   │
└─────────────┘    └──────┬──────┘    └─────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  ebios_rm   │   │    tprm     │   │   serdes    │
│  (EBIOS)    │   │(3rd party)  │   │  (backup)   │
└─────────────┘   └─────────────┘   └─────────────┘
```

## 9. Security Model (Original)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RBAC Permission Model                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User ──▶ UserGroup ──▶ Role ──▶ Permissions                                │
│                                                                              │
│  Roles:                                                                      │
│  ├── Administrator (full access)                                            │
│  ├── Domain Manager (domain-scoped)                                         │
│  ├── Analyst (read + limited write)                                         │
│  ├── Reader (read-only)                                                     │
│  └── Approver (review/approve workflows)                                    │
│                                                                              │
│  Folder-based scoping:                                                       │
│  ├── Root Folder (global)                                                   │
│  └── Sub-folders (domain-specific)                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10. Missing Capabilities (Original)

| Gap Area | Description |
|----------|-------------|
| **OSCAL Support** | No native OSCAL import/export |
| **FedRAMP** | No FedRAMP-specific validations or templates |
| **STIG/CKL** | No STIG checklist management |
| **SCAP** | No SCAP result parsing |
| **POA&M** | Basic POA&M without milestones/deviations |
| **Questionnaires** | No conditional logic or modules |
| **RMF Documents** | No automated document generation |
| **Domain Events** | No event-driven architecture |
| **CQRS** | No command/query separation |

---

*Document Version: Pre-DDD Migration*
*Last Updated: Baseline architecture before enhancements*
