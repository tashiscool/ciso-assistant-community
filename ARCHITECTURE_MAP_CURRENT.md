# CISO Assistant - Current Integration Architecture Map

> **Note:** This document describes the architecture AFTER DDD migration and OSCAL/FedRAMP/OpenRMF enhancements.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CISO Assistant                                      │
│         Unified GRC Platform with Federal Compliance Support                 │
│                                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    OSCAL    │  │   FedRAMP   │  │  OpenRMF    │  │  GovReady   │         │
│  │ Integration │  │  Patterns   │  │  Patterns   │  │  Patterns   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. High-Level Architecture (Current)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Frontend (SvelteKit)                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │   Routes   │  │    Lib     │  │   Utils    │  │    New Components      │ │
│  │  (pages)   │  │(components)│  │(crud/table)│  │ ┌──────────────────┐   │ │
│  │  + /rmf/   │  │            │  │            │  │ │   OscalEditor    │   │ │
│  └────────────┘  └────────────┘  └────────────┘  │ │  (zone-based)    │   │ │
│                                                   │ └──────────────────┘   │ │
│                                                   └────────────────────────┘ │
└─────────────────────────────────────┬────────────────────────────────────────┘
                                      │ REST API (JSON)
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│               Django Backend (Hybrid: Legacy + DDD)                           │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    URL Router + DDD Service Layer                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌──────────────────────────┐    ┌──────────────────────────────────────┐   │
│  │    Legacy Django Apps     │    │        Bounded Contexts (DDD)        │   │
│  │  (core, iam, library)     │    │   ┌──────────────────────────────┐   │   │
│  └──────────────────────────┘    │   │      rmf_operations          │   │   │
│                                   │   │  ┌─────────┐ ┌─────────────┐ │   │   │
│  ┌──────────────────────────┐    │   │  │Aggregates│ │  Services   │ │   │   │
│  │    OSCAL Integration      │    │   │  └─────────┘ └─────────────┘ │   │   │
│  │  ┌────────────────────┐   │    │   └──────────────────────────────┘   │   │
│  │  │  TrestleService    │   │    │   ┌──────────────────────────────┐   │   │
│  │  │  FedRAMPEnhanced   │   │    │   │      compliance             │   │   │
│  │  │  OpenControlConv   │   │    │   └──────────────────────────────┘   │   │
│  │  └────────────────────┘   │    │   ┌──────────────────────────────┐   │   │
│  └──────────────────────────┘    │   │      questionnaires          │   │   │
│                                   │   │  (GovReady patterns)         │   │   │
│  ┌──────────────────────────┐    │   └──────────────────────────────┘   │   │
│  │       POA&M Module        │    │   ┌──────────────────────────────┐   │   │
│  │  ┌────────────────────┐   │    │   │      privacy                │   │   │
│  │  │  POAMExportService │   │    │   └──────────────────────────────┘   │   │
│  │  └────────────────────┘   │    │   [+ 6 more bounded contexts]       │   │
│  └──────────────────────────┘    └──────────────────────────────────────┘   │
│                                                                               │
└─────────────────────────────────────┬────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL/SQLite)                               │
│             + Domain Events + Aggregate State                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2. Backend Application Structure (Current)

```
backend/
├── ciso_assistant/              # Django Project Configuration
│   ├── settings.py              # Includes bounded contexts
│   └── urls.py                  # Routes to DDD modules
│
├── core/                        # Legacy + DDD Infrastructure
│   ├── models.py                # Legacy models (still used)
│   ├── views.py                 # Legacy ViewSets
│   │
│   ├── domain/                  # DDD Infrastructure ★ NEW
│   │   ├── aggregate.py         # Base Aggregate class
│   │   ├── repository.py        # Base Repository pattern
│   │   ├── events.py            # Domain Event classes
│   │   └── value_objects.py     # Value Object base
│   │
│   └── bounded_contexts/        # Domain-Driven Design ★ NEW
│       ├── organization/        # Org structure (Folder, Actor)
│       ├── asset_and_service/   # Asset management
│       ├── control_library/     # Control definitions
│       ├── compliance/          # Compliance assessments
│       ├── privacy/             # Privacy/GDPR
│       ├── security_operations/ # Incidents, vulnerabilities
│       ├── third_party_management/ # TPRM
│       ├── business_continuity/ # BC/DR
│       │
│       └── rmf_operations/      # RMF/STIG Operations ★ NEW
│           ├── aggregates/
│           │   ├── stig_checklist.py    # STIG Checklist aggregate
│           │   ├── vulnerability_finding.py
│           │   ├── checklist_score.py   # CAT scoring
│           │   └── system_group.py
│           ├── repositories/
│           │   └── checklist_repository.py
│           └── services/        # ★ ENHANCED
│               ├── ckl_parser.py
│               ├── ckl_exporter.py
│               ├── nessus_parser.py
│               ├── vulnerability_correlation.py
│               └── rmf_enhanced.py      # ★ NEW (SCAP, RMF docs, scoring)
│
├── oscal_integration/           # OSCAL Module ★ NEW
│   ├── models/
│   │   └── oscal_document.py
│   └── services/
│       ├── oscal_importer.py    # OSCAL import
│       ├── oscal_exporter.py    # OSCAL export
│       ├── ssp_generator.py     # SSP generation
│       ├── ssp_importer.py      # SSP import
│       ├── fedramp_validator.py # FedRAMP validation
│       ├── trestle_service.py   # ★ NEW (split/merge, profile resolution)
│       ├── fedramp_enhanced.py  # ★ NEW (origination, roles, LI-SaaS)
│       └── opencontrol_converter.py # ★ NEW (OpenControl ↔ OSCAL)
│
├── questionnaires/              # Questionnaire Module ★ ENHANCED
│   ├── models/
│   │   ├── questionnaire.py     # Aggregate
│   │   └── question.py          # Question aggregate
│   └── services/
│       ├── questionnaire_service.py
│       └── govready_enhanced.py # ★ NEW (conditional logic, modules)
│
├── poam/                        # POA&M Module ★ ENHANCED
│   ├── models/
│   │   └── poam_item.py         # POA&M with milestones/deviations
│   └── services/
│       └── poam_export.py       # ★ NEW (FedRAMP XLSX, CSV, OSCAL)
│
├── iam/                         # Identity (unchanged)
├── library/                     # Frameworks (unchanged)
├── ebios_rm/                    # EBIOS (unchanged)
├── tprm/                        # TPRM (unchanged)
└── serdes/                      # Backup (unchanged)
```

## 3. DDD Bounded Contexts Architecture

### 3.1 All Bounded Contexts (10 total)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Bounded Contexts (DDD) - Complete List                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. organization           # Organizational structure                        │
│     Aggregates: Folder, Actor, Team                                         │
│                                                                              │
│  2. asset_and_service      # Asset management                               │
│     Aggregates: Asset, Perimeter, AssetCapability                           │
│                                                                              │
│  3. control_library        # Control definitions                            │
│     Aggregates: Framework, ReferenceControl, Threat, RiskMatrix             │
│                                                                              │
│  4. compliance             # Compliance assessments                         │
│     Aggregates: ComplianceAssessment, RequirementAssessment                 │
│     Services: ComplianceAssessmentService                                   │
│                                                                              │
│  5. privacy                # Privacy/GDPR management                        │
│     Services: PrivacyAssessmentService                                      │
│                                                                              │
│  6. security_operations    # Incidents, vulnerabilities                     │
│     Aggregates: Incident, Vulnerability                                     │
│                                                                              │
│  7. third_party_management # TPRM                                           │
│     Aggregates: Entity, Contract                                            │
│                                                                              │
│  8. business_continuity    # BC/DR                                          │
│     Aggregates: BIAAssessment, RecoveryPlan                                 │
│                                                                              │
│  9. risk_registers         # Risk management                                │
│     Services: RiskAssessmentService, RiskReportingService                   │
│                                                                              │
│ 10. rmf_operations ★ ENHANCED (OpenRMF patterns)                            │
│     See Section 3.2 for detailed breakdown                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 rmf_operations Bounded Context (Enhanced)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              rmf_operations Bounded Context - Full Structure                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AGGREGATES (8 files):                                                       │
│  ├── stig_checklist.py       # STIG Checklist aggregate root               │
│  ├── vulnerability_finding.py # Individual vulnerability findings           │
│  ├── checklist_score.py      # CAT1/2/3 scoring aggregate                  │
│  ├── system_group.py         # System grouping aggregate                   │
│  ├── stig_template.py        # STIG template definitions                   │
│  ├── nessus_scan.py          # Nessus scan aggregate                       │
│  ├── artifact.py             # Evidence artifact aggregate                 │
│  └── audit_log.py            # Audit log aggregate                         │
│                                                                              │
│  SERVICES (8 files):                                                         │
│  ├── ckl_parser.py           # CKL file parsing (existing)                 │
│  ├── ckl_exporter.py         # CKL file export (existing)                  │
│  ├── nessus_parser.py        # Nessus scan parsing (existing)              │
│  ├── vulnerability_correlation.py # Cross-reference vulnerabilities        │
│  ├── audit_service.py        # Audit logging service                       │
│  ├── bulk_operations.py      # Bulk import/export operations               │
│  ├── cci_service.py          # CCI (Control Correlation ID) service        │
│  └── rmf_enhanced.py ★ NEW   # SCAP parser, RMF docs, scoring              │
│                                                                              │
│  rmf_enhanced.py CLASSES:                                                    │
│  ├── SCAPParser              # XCCDF 1.1/1.2 and ARF parsing               │
│  ├── RMFDocumentGenerator    # POA&M XLSX, Test Plan DOCX, RAR DOCX        │
│  ├── SystemScoringService    # Compliance scoring with CAT weights         │
│  └── AssetMetadataService    # Asset extraction and classification         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. OSCAL Integration Layer (New)

### 4.1 Service Files Overview

| File | Size | Classes | Purpose |
|------|------|---------|---------|
| trestle_service.py | 44KB | 5 | Format conversion, split/merge, profile resolution |
| fedramp_enhanced.py | 31KB | 8 | FedRAMP origination, roles, LI-SaaS, SSP enhancement |
| opencontrol_converter.py | 27KB | 4 | OpenControl ↔ OSCAL bidirectional conversion |
| oscal_importer.py | 19KB | - | OSCAL import (existing) |
| oscal_exporter.py | 17KB | - | OSCAL export (existing) |
| ssp_generator.py | 21KB | - | SSP generation (existing) |
| ssp_importer.py | 24KB | - | SSP import (existing) |
| fedramp_validator.py | 16KB | - | FedRAMP validation (existing) |

### 4.2 TrestleService (compliance-trestle patterns)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              TrestleService - trestle_service.py (44KB, 1100+ lines)         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ENUMS & DATA CLASSES:                                                       │
│  ├── OscalFormat(Enum)           # JSON, YAML, XML                          │
│  ├── OscalModelType(Enum)        # catalog, profile, ssp, component, etc.   │
│  ├── SplitResult                 # Split operation result                   │
│  ├── MergeResult                 # Merge operation result                   │
│  ├── ProfileResolutionResult     # Profile resolution result                │
│  └── ValidationResult            # Validation result with errors/warnings   │
│                                                                              │
│  FORMAT CONVERSION:                                                          │
│  ├── convert_format(content, from_fmt, to_fmt) → str                        │
│  ├── _parse_content(content, format) → Dict                                 │
│  ├── _serialize_content(data, format) → str                                 │
│  ├── _parse_xml_to_dict(xml_content) → Dict                                 │
│  └── _dict_to_xml(data, root_name) → str                                    │
│                                                                              │
│  DOCUMENT SPLITTING:                                                         │
│  ├── split_document(content, model_type, split_by) → SplitResult            │
│  ├── _split_catalog(data, split_by) → List[str]                             │
│  │   └── Split by: group, control, control-family                           │
│  ├── _split_by_control_family(data, controls) → List[str]                   │
│  ├── _split_ssp(data, split_by) → List[str]                                 │
│  │   └── Split by: control-family, component                                │
│  └── _split_component_definition(data) → List[str]                          │
│                                                                              │
│  DOCUMENT MERGING:                                                           │
│  ├── merge_documents(contents, model_type) → MergeResult                    │
│  ├── _merge_catalogs(documents) → Dict                                      │
│  ├── _merge_ssps(documents) → Dict                                          │
│  ├── _merge_component_definitions(documents) → Dict                         │
│  └── _merge_assessment_results(documents) → Dict                            │
│                                                                              │
│  PROFILE RESOLUTION:                                                         │
│  ├── resolve_profile(profile, catalog) → ProfileResolutionResult            │
│  ├── _get_all_controls_from_catalog(catalog) → List[Dict]                   │
│  └── _apply_profile_modifications(controls, profile) → List[Dict]           │
│                                                                              │
│  VALIDATION:                                                                 │
│  ├── validate_comprehensive(content) → ValidationResult                     │
│  ├── _detect_model_type(data) → Optional[str]                               │
│  ├── _collect_all_ids(data, path) → List[str]                               │
│  ├── _check_references(data, known_ids) → List[str]                         │
│  ├── _validate_ssp(data, errors, warnings)                                  │
│  └── _validate_catalog(data, errors, warnings)                              │
│                                                                              │
│  REPOSITORY:                                                                 │
│  ├── create_component_definition(name, components) → str                    │
│  ├── list_documents(model_type) → List[Dict]                                │
│  └── _normalize_component(component) → Dict                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 FedRAMPEnhancedService

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           FedRAMPEnhancedService - fedramp_enhanced.py (31KB, 800+ lines)    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ENUMS & DATA CLASSES:                                                       │
│  ├── ControlOrigination(Enum)    # sp-corporate, sp-system, customer,       │
│  │                               # inherited, shared, hybrid               │
│  ├── FedRAMPImplementationStatus # implemented, partial, planned, alt, n/a  │
│  ├── FedRAMPBaseline(Enum)       # LOW, MODERATE, HIGH, LI_SAAS             │
│  ├── ControlOriginationInfo      # Control + origination + status + notes   │
│  ├── ResponsibleRole             # Role ID, title, description              │
│  └── FedRAMPValidationResult     # Validation with errors/warnings          │
│                                                                              │
│  CONTROL ORIGINATION:                                                        │
│  ├── set_control_origination(ctrl_id, orig, status, notes)                  │
│  ├── get_control_origination(control_id) → ControlOriginationInfo           │
│  ├── bulk_set_origination(control_ids, origination, status)                 │
│  └── get_controls_by_origination(origination) → List[str]                   │
│                                                                              │
│  RESPONSIBLE ROLES:                                                          │
│  ├── add_responsible_role(role_id, title, description)                      │
│  ├── assign_role_to_control(control_id, role_id)                            │
│  ├── get_roles_for_control(control_id) → List[ResponsibleRole]              │
│  └── get_controls_by_role(role_id) → List[str]                              │
│                                                                              │
│  SSP ENHANCEMENT:                                                            │
│  ├── enhance_ssp_with_fedramp(ssp_content, baseline, sys_info) → str        │
│  │   └── Adds: originations, roles, FedRAMP metadata, baselines             │
│  └── extract_fedramp_info_from_ssp(ssp_content) → Dict                      │
│                                                                              │
│  VALIDATION:                                                                 │
│  └── validate_fedramp_ssp(ssp_content, baseline) → FedRAMPValidationResult  │
│      └── Checks: required controls, originations, roles, metadata           │
│                                                                              │
│  LI-SAAS SUPPORT:                                                            │
│  ├── get_li_saas_controls() → List[Dict]    # 37 LI-SaaS controls           │
│  └── initialize_li_saas_originations() → int                                │
│                                                                              │
│  REPORTING:                                                                  │
│  ├── generate_control_matrix(baseline) → Dict                               │
│  └── generate_role_responsibility_report() → Dict                           │
│                                                                              │
│  BUILT-IN ROLES (12):                                                        │
│  ├── system-owner, authorizing-official, isso, issm                         │
│  ├── security-engineer, system-admin, network-admin, database-admin         │
│  └── privacy-officer, configuration-manager, incident-responder, risk-exec  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 OpenControlConverter (GoComply patterns)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│          OpenControlConverter - opencontrol_converter.py (27KB, 780+ lines)  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DATA CLASSES:                                                               │
│  ├── ConversionResult            # Success flag, content, errors, warnings  │
│  ├── OpenControlComponent        # OC component structure                   │
│  └── OpenControlStandard         # OC standard structure                    │
│                                                                              │
│  OPENCONTROL → OSCAL:                                                        │
│  ├── opencontrol_component_to_oscal(yaml_content) → ConversionResult        │
│  │   └── Component YAML → OSCAL Component Definition                        │
│  ├── opencontrol_standard_to_oscal(yaml_content) → ConversionResult         │
│  │   └── Standard YAML → OSCAL Catalog                                      │
│  ├── opencontrol_system_to_oscal(yaml_content, components) → ConversionResult│
│  │   └── System YAML → OSCAL SSP                                            │
│  └── convert_opencontrol_project(project_dir) → Dict[str, ConversionResult] │
│      └── Batch conversion of entire OpenControl project                     │
│                                                                              │
│  OSCAL → OPENCONTROL:                                                        │
│  ├── oscal_component_to_opencontrol(oscal_json) → ConversionResult          │
│  │   └── OSCAL Component Definition → Component YAML                        │
│  └── oscal_catalog_to_opencontrol(oscal_json) → ConversionResult            │
│      └── OSCAL Catalog → Standard YAML                                      │
│                                                                              │
│  INTERNAL HELPERS:                                                           │
│  ├── _convert_oc_component(oc_data) → Dict                                  │
│  ├── _convert_satisfy_to_impl_req(satisfy) → Dict                           │
│  ├── _convert_oc_control(control_id, control_data) → Dict                   │
│  ├── _convert_oscal_component_to_oc(component) → Dict                       │
│  ├── _convert_impl_req_to_satisfy(impl_req) → Dict                          │
│  ├── _convert_oscal_control_to_oc(control) → Dict                           │
│  └── _process_group_controls(group, controls_dict)                          │
│                                                                              │
│  REQUIREMENTS:                                                               │
│  └── PyYAML (optional) - Returns error with install instructions if missing │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5. Questionnaire Enhancement Layer (New)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│         Questionnaire Services (GovReady-Q patterns) - govready_enhanced.py  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DATA CLASSES:                                                               │
│  ├── ConditionOperator(Enum)  # equals, contains, greater_than, etc.       │
│  ├── ConditionResult          # Evaluation result with value/reason         │
│  ├── QuestionVisibility       # Question ID with visibility flag            │
│  ├── ModuleSpec               # Module definition with questions/mappings   │
│  └── GeneratedStatement       # Generated control implementation statement  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ConditionalLogicEngine                            │    │
│  │  ├── evaluate_visibility() - Show/hide questions based on context   │    │
│  │  ├── evaluate_impute() - Auto-answer based on previous answers      │    │
│  │  ├── get_visible_questions() - Filter question list                 │    │
│  │  │                                                                   │    │
│  │  Operators (13 total):                                               │    │
│  │  ├── equals, not_equals, contains, not_contains                     │    │
│  │  ├── greater_than, less_than, greater_or_equal, less_or_equal       │    │
│  │  ├── is_empty, is_not_empty, matches (regex), in, not_in            │    │
│  │  │                                                                   │    │
│  │  Boolean Logic: AND, OR, NOT with nested condition support           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ModuleRepository                                  │    │
│  │  Methods:                                                            │    │
│  │  ├── get_module() - Retrieve module by ID                           │    │
│  │  ├── list_modules() - List all or by framework                      │    │
│  │  ├── register_module() - Add custom module                          │    │
│  │  ├── get_module_questions() - Get questions for module              │    │
│  │  └── get_control_mapping() - Get control IDs for question           │    │
│  │                                                                       │    │
│  │  Built-in Modules (5):                                               │    │
│  │  ├── fedramp-low        # FedRAMP Low Baseline (17 controls)        │    │
│  │  ├── fedramp-moderate   # FedRAMP Moderate Baseline (325 controls)  │    │
│  │  ├── nist-800-53        # NIST SP 800-53 Rev 5 (full catalog)       │    │
│  │  ├── gdpr               # GDPR Data Protection Articles             │    │
│  │  └── iso-27001          # ISO 27001:2022 ISMS Controls              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    StatementGenerator                                │    │
│  │  Methods:                                                            │    │
│  │  ├── generate_statement() - Single control implementation statement │    │
│  │  └── generate_statements_for_module() - All statements for module   │    │
│  │                                                                       │    │
│  │  Features:                                                           │    │
│  │  ├── Template-based generation with {placeholder} substitution      │    │
│  │  ├── Question answer → parameter mapping                            │    │
│  │  └── Multi-value answer formatting (lists, booleans, etc.)          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    OutputDocumentGenerator                           │    │
│  │  Methods:                                                            │    │
│  │  ├── generate_oscal_statements() - OSCAL SSP control implementations│    │
│  │  │   Returns: OSCAL-compliant JSON with by-component structure      │    │
│  │  └── generate_gap_analysis() - Compliance gap report                │    │
│  │      Returns: Answered/unanswered/partial counts with details       │    │
│  │                                                                       │    │
│  │  Integration:                                                        │    │
│  │  ├── Uses ModuleRepository for question→control mappings            │    │
│  │  └── Uses StatementGenerator for implementation statements          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6. POA&M Export Layer (New)

### 6.1 poam_export.py Overview (26KB, 600+ lines)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           POA&M Export Services - poam_export.py (RampControl patterns)      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DATA CLASSES:                                                               │
│  ├── ExportResult                # Success flag, content (bytes/str), errors│
│  └── DeviationType(Enum)         # OR, FR, FP, VENDOR_DEPENDENCY            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 POAMExportService

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          POAMExportService                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FEDRAMP EXCEL EXPORT:                                                       │
│  export_fedramp_xlsx(poam_items, system_info) → ExportResult                 │
│  ├── Creates FedRAMP Appendix A compliant workbook                          │
│  ├── Sheet 1: POA&M Items (26 columns)                                      │
│  │   ├── A: POA&M ID                    N: Vendor Dependencies             │
│  │   ├── B: Weakness Name               O: Last Vendor Check-in            │
│  │   ├── C: Weakness Description        P: Vendor Product Name             │
│  │   ├── D: Detector Source             Q: Original Risk Rating            │
│  │   ├── E: Source ID                   R: Adjusted Risk Rating            │
│  │   ├── F: Asset Identifier            S: Risk Adjustment                 │
│  │   ├── G: POC                         T: False Positive                  │
│  │   ├── H: Resources Required          U: Operational Requirement         │
│  │   ├── I: Scheduled Completion        V: Deviation Rationale             │
│  │   ├── J: Milestone 1 Description     W: Supporting Documents            │
│  │   ├── K: Milestone 1 Date            X: Comments                        │
│  │   ├── L: Milestone 2 Description     Y: Auto-Approve                    │
│  │   └── M: Milestone 2 Date            Z: Completion Date                 │
│  ├── Sheet 2: System Info (name, type, impact level, ATO date)             │
│  ├── Sheet 3: Summary (total items, by risk level, by status)              │
│  └── Requires: openpyxl (optional dependency)                               │
│                                                                              │
│  CSV EXPORT:                                                                 │
│  export_csv(poam_items) → ExportResult                                       │
│  ├── Creates CSV with same columns as Excel                                 │
│  ├── UTF-8 encoding with BOM for Excel compatibility                        │
│  └── No external dependencies                                               │
│                                                                              │
│  OSCAL POAM EXPORT:                                                          │
│  export_oscal_poam(poam_items, system_info) → ExportResult                   │
│  ├── Creates OSCAL POA&M JSON document                                      │
│  ├── Structure: metadata, system-id, poam-items, back-matter               │
│  ├── Each item: uuid, title, description, origins, findings, observations  │
│  └── Milestones and deviations mapped to OSCAL structures                   │
│                                                                              │
│  DEVIATION REPORT:                                                           │
│  generate_deviation_report(poam_items) → Dict                                │
│  ├── summary: total_deviations, by_type counts                             │
│  ├── by_type: OR, FR, FP, VENDOR_DEPENDENCY groupings                      │
│  ├── items: detailed deviation information per item                        │
│  └── aging: 0-30 days, 31-60 days, 61-90 days, 90+ days                    │
│                                                                              │
│  MILESTONE REPORT:                                                           │
│  generate_milestone_report(poam_items) → Dict                                │
│  ├── summary: total_milestones, completed, upcoming, overdue               │
│  ├── overdue: items with past-due milestones                               │
│  ├── upcoming_30_days: milestones due within 30 days                       │
│  ├── by_status: open, completed, in_progress groupings                     │
│  └── timeline: chronological milestone view                                 │
│                                                                              │
│  INTERNAL METHODS:                                                           │
│  ├── _map_to_fedramp_row(item) → List[Any]                                 │
│  ├── _write_system_info_sheet(ws, system_info)                             │
│  ├── _write_summary_sheet(ws, poam_items)                                  │
│  └── _convert_to_oscal_poam_item(item) → Dict                              │
│                                                                              │
│  DEVIATION TYPES:                                                            │
│  ├── OR:  Operational Requirement - Cannot remediate due to operations     │
│  ├── FR:  False Positive - Scanner error, not a real vulnerability         │
│  ├── FP:  False Positive (alternate) - Confirmed not vulnerable            │
│  └── VENDOR_DEPENDENCY - Waiting on vendor patch/fix                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7. RMF Enhanced Services Layer (New)

### 7.1 rmf_enhanced.py Overview (37KB, 1050+ lines)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               RMF Enhanced Services - rmf_enhanced.py (OpenRMF patterns)     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DATA CLASSES:                                                               │
│  ├── ScapResult                  # SCAP parsing result (benchmark, findings)│
│  ├── AssetMetadata               # Asset info (hostname, IP, OS, etc.)      │
│  ├── RMFDocumentResult           # Document generation result               │
│  └── SystemScore                 # Scoring result with CAT breakdown        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 SCAPParser

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SCAPParser                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PUBLIC METHODS:                                                             │
│  ├── parse_xccdf_results(xml_content) → ScapResult                          │
│  │   └── Auto-detects XCCDF 1.1, 1.2, or Benchmark with results            │
│  └── convert_to_stig_findings(scap_result) → List[Dict]                     │
│      └── Converts SCAP findings to STIG checklist format                    │
│                                                                              │
│  INTERNAL PARSERS:                                                           │
│  ├── _parse_xccdf_test_result(root) → ScapResult                            │
│  ├── _parse_xccdf_benchmark_with_results(root) → ScapResult                 │
│  └── _parse_arf_results(root) → ScapResult                                  │
│                                                                              │
│  RESULT MAPPING:                                                             │
│  ├── pass, fixed      → not_a_finding                                       │
│  ├── fail             → open                                                │
│  ├── error, unknown   → not_reviewed                                        │
│  └── notapplicable    → not_applicable                                      │
│                                                                              │
│  SEVERITY MAPPING (_map_severity):                                           │
│  ├── high, critical   → cat1                                                │
│  ├── medium           → cat2                                                │
│  └── low, info        → cat3                                                │
│                                                                              │
│  XML NAMESPACES SUPPORTED:                                                   │
│  ├── xccdf: http://checklists.nist.gov/xccdf/1.1                           │
│  ├── xccdf12: http://checklists.nist.gov/xccdf/1.2                         │
│  └── arf: http://scap.nist.gov/schema/asset-reporting-format/1.1           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 RMFDocumentGenerator

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RMFDocumentGenerator                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  generate_poam_xlsx(findings, system_info) → RMFDocumentResult               │
│  ├── Creates FedRAMP-compliant POA&M Excel workbook                         │
│  ├── Sheets: POA&M Items, System Info, Summary                              │
│  ├── Columns: POA&M ID, Weakness, Control, POC, Status, Dates, etc.        │
│  └── Requires: openpyxl (optional dependency)                               │
│                                                                              │
│  generate_test_plan(system_info, controls) → RMFDocumentResult               │
│  ├── Creates Security Assessment Test Plan (DOCX)                           │
│  ├── Sections: Executive Summary, Scope, Methodology, Test Cases           │
│  ├── Test case format: Control ID, Objective, Method, Expected Result      │
│  └── Requires: python-docx (optional dependency)                            │
│                                                                              │
│  generate_risk_assessment_report(findings, system_info) → RMFDocumentResult  │
│  ├── Creates Risk Assessment Report (DOCX)                                  │
│  ├── Sections: Exec Summary, Methodology, Findings, Recommendations        │
│  ├── Risk calculations: CAT breakdown, weighted scores                     │
│  └── Requires: python-docx (optional dependency)                            │
│                                                                              │
│  OPTIONAL DEPENDENCY HANDLING:                                               │
│  └── Returns error result with installation instructions if missing         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 SystemScoringService

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SystemScoringService                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  calculate_system_score(checklists) → SystemScore                            │
│  ├── Aggregates all checklist findings                                      │
│  ├── Counts: cat1_open, cat1_closed, cat2_open, cat2_closed, etc.          │
│  ├── Calculates weighted risk score:                                        │
│  │   └── (CAT1_open × 10) + (CAT2_open × 5) + (CAT3_open × 1)              │
│  └── Calculates compliance percentage: closed / total × 100                 │
│                                                                              │
│  generate_dashboard_data(checklists) → Dict                                  │
│  ├── summary: total_checklists, total_findings, risk_rating                │
│  ├── by_category: CAT1/2/3 open/closed counts                              │
│  ├── by_status: open, closed, not_reviewed counts                          │
│  ├── by_checklist: per-checklist breakdown                                 │
│  └── trends: placeholder for historical data                                │
│                                                                              │
│  calculate_risk_rating(system_score) → str                                   │
│  ├── HIGH:      Any CAT1 open OR CAT2 open > 10                            │
│  ├── MODERATE:  CAT2 open > 0 OR CAT3 open > 20                            │
│  ├── LOW:       CAT3 open > 0                                              │
│  └── VERY LOW:  No open findings                                            │
│                                                                              │
│  WEIGHT CONFIGURATION:                                                       │
│  └── cat1_weight=10, cat2_weight=5, cat3_weight=1 (constructor params)     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.5 AssetMetadataService

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AssetMetadataService                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  extract_from_ckl(ckl_data) → AssetMetadata                                  │
│  ├── Extracts: hostname, ip_address, mac_address, fqdn                     │
│  ├── Extracts: os_name, os_version                                         │
│  ├── Extracts: technology_area (auto-classified)                           │
│  └── Source: CKL ASSET element                                              │
│                                                                              │
│  extract_from_nessus(host_data) → AssetMetadata                              │
│  ├── Extracts: hostname, ip_address, mac_address                           │
│  ├── Extracts: os_name from Nessus OS fingerprinting                       │
│  ├── Extracts: technology_area (auto-classified)                           │
│  └── Source: Nessus host properties                                         │
│                                                                              │
│  classify_technology_area(hostname, os_info) → str                           │
│  ├── Pattern matching on hostname and OS info:                              │
│  │   ├── "sql", "db", "oracle", "mysql"      → Database                    │
│  │   ├── "web", "apache", "nginx", "iis"     → Web Server                  │
│  │   ├── "fw", "firewall", "asa", "palo"     → Firewall                    │
│  │   ├── "switch", "router", "cisco", "ios"  → Network Device              │
│  │   ├── "win", "windows server"             → Windows Server              │
│  │   ├── "linux", "rhel", "centos", "ubuntu" → Linux Server                │
│  │   ├── "workstation", "desktop", "win10"   → Workstation                 │
│  │   └── default                             → Other                        │
│  └── Case-insensitive matching                                              │
│                                                                              │
│  to_dict(metadata) → Dict[str, Any]                                          │
│  └── Serializes AssetMetadata to dictionary                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8. Frontend Architecture (Current)

### 8.1 Overview Statistics (Updated)

| Category | Original | Current | Change |
|----------|----------|---------|--------|
| Route directories | 269 | 272+ | +3 (RMF routes) |
| Svelte components | 224 | 225 | +1 (OscalEditor) |
| Component directories | 42 | 43 | +1 (OscalEditor/) |
| Utility files | 21 | 21 | Unchanged |

### 8.2 New Routes Added

```
frontend/src/routes/
├── (app)/
│   ├── (internal)/
│   │   ├── [all existing 269 routes unchanged...]
│   │   │
│   │   └── rmf/                     # ★ NEW: RMF Operations Routes
│   │       ├── +page.svelte         # RMF dashboard
│   │       ├── checklists/          # STIG checklist management
│   │       │   ├── +page.svelte     # Checklist list
│   │       │   └── [id]/            # Individual checklist
│   │       ├── findings/            # Vulnerability findings
│   │       │   ├── +page.svelte     # Findings list
│   │       │   └── [id]/            # Individual finding
│   │       └── scoring/             # Compliance scoring
│   │           └── +page.svelte     # Scoring dashboard
```

### 8.3 New Component: OscalEditor

```
frontend/src/lib/components/OscalEditor/
├── OscalEditor.svelte              # Main component (26KB, 750+ lines)
└── index.ts                        # Exports

OscalEditor.svelte Features:
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OscalEditor Component                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROPS ($props):                                                             │
│  ├── document: OscalDocument      # OSCAL document to edit                  │
│  ├── documentType: string         # catalog, profile, ssp, etc.             │
│  ├── readonly: boolean            # Read-only mode                          │
│  └── onSave: (doc) => void        # Save callback ($bindable)               │
│                                                                              │
│  STATE ($state):                                                             │
│  ├── activeZone: string           # metadata | controls | parameters        │
│  ├── searchQuery: string          # Control search filter                   │
│  ├── expandedControls: Set        # Expanded control IDs                    │
│  ├── parameterView: string        # blank | catalog | profile | assigned    │
│  ├── format: string               # json | yaml                             │
│  ├── hasUnsavedChanges: boolean   # Dirty state tracking                    │
│  └── validationErrors: array      # Real-time validation errors             │
│                                                                              │
│  COMPUTED ($derived):                                                        │
│  ├── filteredControls             # Search-filtered control list            │
│  ├── controlCount                 # Total control count                     │
│  └── parameterCount               # Total parameter count                   │
│                                                                              │
│  ZONES:                                                                      │
│  ├── Metadata Zone                # Title, version, dates, parties          │
│  ├── Controls Zone                # Control list with expand/collapse       │
│  │   ├── Control search bar                                                 │
│  │   ├── Expand all / Collapse all                                         │
│  │   └── Individual control editors                                         │
│  └── Parameters Zone              # Parameter values with view switching    │
│      ├── Blank view (no values)                                             │
│      ├── Catalog defaults                                                   │
│      ├── Profile modifications                                              │
│      └── Assigned values                                                    │
│                                                                              │
│  FEATURES:                                                                   │
│  ├── Real-time JSON/YAML validation                                         │
│  ├── Format conversion toggle                                               │
│  ├── Auto-save with debounce                                                │
│  ├── Keyboard shortcuts (Ctrl+S save)                                       │
│  └── Responsive layout                                                      │
│                                                                              │
│  SVELTE 5 PATTERNS:                                                          │
│  ├── $state for reactive state                                              │
│  ├── $derived for computed values                                           │
│  ├── $props for component inputs                                            │
│  ├── $bindable for two-way binding                                          │
│  └── $effect for side effects                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Modified Utility Files

```
frontend/src/lib/utils/
├── schemas.ts ★ MODIFIED           # Added RMF/OSCAL model schemas
│   └── + rmfChecklistSchema, oscalDocumentSchema, etc.
│
├── sidebar-config.ts ★ MODIFIED    # Added RMF navigation section
│   └── + RMF Operations menu items
│
├── table.ts ★ MODIFIED             # Added RMF table configurations
│   └── + checklistColumns, findingColumns, scoreColumns
│
└── types.ts ★ MODIFIED             # Added RMF/OSCAL TypeScript types
    └── + OscalDocument, STIGChecklist, VulnerabilityFinding, etc.
```

### 8.5 Component Integration Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Frontend Component Integration                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  New Component Dependencies:                                                 │
│                                                                              │
│  OscalEditor.svelte                                                          │
│  ├── Imports from: @skeletonlabs/skeleton-svelte (Tooltip)                  │
│  ├── Uses: Svelte 5 runes ($state, $derived, $props, $bindable, $effect)   │
│  └── Integrates with: /api/oscal/* endpoints                                │
│                                                                              │
│  RMF Routes                                                                  │
│  ├── Use: ModelTable component (existing)                                   │
│  ├── Use: DetailView component (existing)                                   │
│  ├── Use: DataViz components (existing)                                     │
│  └── Integrate with: /api/rmf/* endpoints                                   │
│                                                                              │
│  rmf/ Component Directory ★ NEW                                              │
│  └── Placeholder for future RMF-specific components                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9. API Endpoints (Current)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REST API Endpoints                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EXISTING ENDPOINTS (unchanged):                                             │
│  /api/                                                                       │
│  ├── /folders/, /users/, /frameworks/, /assets/, etc.                       │
│  ├── /risk-assessments/, /compliance-assessments/                           │
│  ├── /iam/, /ebios-rm/, /tprm/, /serdes/                                   │
│                                                                              │
│  NEW/ENHANCED ENDPOINTS:                                                     │
│  /api/                                                                       │
│  ├── /rmf/                         # ★ RMF Operations                       │
│  │   ├── /checklists/              # STIG checklist management              │
│  │   ├── /findings/                # Vulnerability findings                 │
│  │   ├── /scores/                  # Checklist scores                       │
│  │   ├── /system-groups/           # System groupings                       │
│  │   └── /import/                  # CKL/SCAP import                        │
│  │                                                                          │
│  ├── /oscal/                       # ★ OSCAL Operations                     │
│  │   ├── /import/                  # Import OSCAL documents                 │
│  │   ├── /export/                  # Export to OSCAL                        │
│  │   ├── /validate/                # Validate OSCAL                         │
│  │   ├── /convert/                 # Format conversion                      │
│  │   ├── /split/                   # Split large documents                  │
│  │   ├── /merge/                   # Merge documents                        │
│  │   └── /resolve-profile/         # Profile resolution                     │
│  │                                                                          │
│  ├── /fedramp/                     # ★ FedRAMP Operations                   │
│  │   ├── /validate-ssp/            # FedRAMP SSP validation                 │
│  │   ├── /originations/            # Control origination                    │
│  │   ├── /li-saas/                 # LI-SaaS baseline                       │
│  │   └── /roles/                   # Responsible roles                      │
│  │                                                                          │
│  ├── /questionnaires/              # ★ Enhanced Questionnaires              │
│  │   ├── /modules/                 # Assessment modules                     │
│  │   ├── /evaluate/                # Conditional logic evaluation           │
│  │   └── /generate-statements/     # Statement generation                   │
│  │                                                                          │
│  └── /poam/                        # ★ Enhanced POA&M                       │
│      ├── /export/fedramp/          # FedRAMP Excel export                   │
│      ├── /export/csv/              # CSV export                             │
│      ├── /export/oscal/            # OSCAL export                           │
│      ├── /deviations/              # Deviation report                       │
│      └── /milestones/              # Milestone report                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10. Data Flow (Current)

```
┌──────────────┐     HTTP      ┌──────────────┐              ┌──────────────┐
│   Frontend   │ ───────────▶ │   API Layer  │ ──────────▶ │   Service    │
│  (SvelteKit) │              │  (ViewSet)   │              │   Layer      │
│              │              │              │              │              │
│  OscalEditor │              │              │              │ TrestleSvc   │
└──────────────┘              └──────────────┘              │ FedRAMPSvc   │
       │                             │                      │ POAMExport   │
       │                             │                      └──────────────┘
       │                             │                             │
       │                             ▼                             │
       │                      ┌──────────────┐              ┌──────────────┐
       │                      │  DDD Layer   │ ◀─────────── │  Repository  │
       │                      │  (Aggregate) │              │   Pattern    │
       │                      └──────────────┘              └──────────────┘
       │                             │                             │
       │                             │ Domain Events               │
       │                             ▼                             │
       │                      ┌──────────────┐              ┌──────────────┐
       └──────────────────── │    Store     │ ◀─────────── │   Database   │
            Response          │  (Svelte)    │   Data       │ (PostgreSQL) │
                              └──────────────┘              └──────────────┘
```

## 11. Integration Points (Current)

| Integration | Type | Description | Status |
|-------------|------|-------------|--------|
| SSO (SAML/OIDC) | Auth | External identity providers | Existing |
| Webhooks | Events | Push notifications | Existing |
| Library Import | Data | YAML framework files | Existing |
| Backup/Restore | Data | Full database export | Existing |
| **OSCAL Import/Export** | Data | All OSCAL model types | **New** |
| **FedRAMP Validation** | Validation | FedRAMP SSP compliance | **New** |
| **OpenControl** | Data | Legacy compliance-as-code | **New** |
| **SCAP Import** | Data | XCCDF/ARF scan results | **New** |
| **CKL Import/Export** | Data | STIG Viewer checklists | **New** |
| **Nessus Correlation** | Data | Vulnerability scan results | **New** |

## 12. Module Dependencies (Current)

```
                         ┌─────────────┐
                         │     iam     │
                         │ (users/auth)│
                         └──────┬──────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   library   │         │    core     │         │global_setng │
│(frameworks) │◀────────│   (main)    │────────▶│  (config)   │
└─────────────┘         └──────┬──────┘         └─────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│  ebios_rm   │        │    tprm     │        │   serdes    │
│  (EBIOS)    │        │(3rd party)  │        │  (backup)   │
└─────────────┘        └─────────────┘        └─────────────┘

                    ★ NEW SERVICE LAYERS ★

        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│   oscal_    │        │questionnaire│        │    poam     │
│ integration │        │  (enhanced) │        │ (enhanced)  │
│             │        │             │        │             │
│ TrestleSvc  │        │CondLogicEng │        │ ExportSvc   │
│ FedRAMPSvc  │        │ ModuleRepo  │        │             │
│ OpenCtrlCnv │        │ StmtGen     │        │             │
└─────────────┘        └─────────────┘        └─────────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Bounded Contexts   │
                    │                     │
                    │  rmf_operations     │
                    │    SCAPParser       │
                    │    RMFDocGen        │
                    │    ScoringService   │
                    │    AssetMetadata    │
                    └─────────────────────┘
```

## 13. Security Model (Current - Enhanced)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RBAC Permission Model (Enhanced)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Existing Roles (unchanged):                                                 │
│  ├── Administrator, Domain Manager, Analyst, Reader, Approver              │
│                                                                              │
│  ★ NEW: FedRAMP Responsible Roles (for SSP/POA&M):                          │
│  ├── system-owner         # Information System Owner                        │
│  ├── authorizing-official # Authorizing Official                            │
│  ├── isso                 # Information System Security Officer             │
│  ├── issm                 # Information System Security Manager             │
│  ├── security-engineer    # Security Engineer                               │
│  ├── system-admin         # System Administrator                            │
│  ├── network-admin        # Network Administrator                           │
│  ├── database-admin       # Database Administrator                          │
│  ├── privacy-officer      # Privacy Officer                                 │
│  ├── configuration-manager # Configuration Manager                          │
│  ├── incident-responder   # Incident Responder                              │
│  └── risk-executive       # Risk Executive                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 14. Capabilities Added

### 14.1 Full Capability Matrix

| Capability | Source Pattern | Service/Component | File | Lines |
|------------|---------------|-------------------|------|-------|
| **OSCAL Integration (TrestleService)** |
| OSCAL Split/Merge | compliance-trestle | TrestleService | trestle_service.py | 1100+ |
| Profile Resolution | compliance-trestle | TrestleService | trestle_service.py | |
| Format Conversion (JSON/YAML/XML) | compliance-trestle | TrestleService | trestle_service.py | |
| Comprehensive Validation | compliance-trestle | TrestleService | trestle_service.py | |
| Component Definition Creation | compliance-trestle | TrestleService | trestle_service.py | |
| **FedRAMP Support (FedRAMPEnhancedService)** |
| Control Origination Tracking | FedRAMP templates | FedRAMPEnhancedService | fedramp_enhanced.py | 800+ |
| Responsible Roles Management | FedRAMP requirements | FedRAMPEnhancedService | fedramp_enhanced.py | |
| LI-SaaS Baseline (37 controls) | FedRAMP LI-SaaS | FedRAMPEnhancedService | fedramp_enhanced.py | |
| SSP Enhancement | FedRAMP templates | FedRAMPEnhancedService | fedramp_enhanced.py | |
| FedRAMP SSP Validation | FedRAMP requirements | FedRAMPEnhancedService | fedramp_enhanced.py | |
| Control Matrix Generation | FedRAMP templates | FedRAMPEnhancedService | fedramp_enhanced.py | |
| **OpenControl Conversion** |
| OpenControl → OSCAL Component | GoComply | OpenControlConverter | opencontrol_converter.py | 780+ |
| OpenControl → OSCAL Catalog | GoComply | OpenControlConverter | opencontrol_converter.py | |
| OpenControl → OSCAL SSP | GoComply | OpenControlConverter | opencontrol_converter.py | |
| OSCAL → OpenControl (reverse) | GoComply | OpenControlConverter | opencontrol_converter.py | |
| Batch Project Conversion | GoComply | OpenControlConverter | opencontrol_converter.py | |
| **RMF Operations (OpenRMF patterns)** |
| SCAP/XCCDF Import | OpenRMF | SCAPParser | rmf_enhanced.py | 1050+ |
| ARF Results Parsing | OpenRMF | SCAPParser | rmf_enhanced.py | |
| POA&M Document Generation | OpenRMF | RMFDocumentGenerator | rmf_enhanced.py | |
| Test Plan Generation | OpenRMF | RMFDocumentGenerator | rmf_enhanced.py | |
| Risk Assessment Report | OpenRMF | RMFDocumentGenerator | rmf_enhanced.py | |
| CAT1/2/3 Weighted Scoring | OpenRMF | SystemScoringService | rmf_enhanced.py | |
| Dashboard Data Generation | OpenRMF | SystemScoringService | rmf_enhanced.py | |
| Risk Rating Calculation | OpenRMF | SystemScoringService | rmf_enhanced.py | |
| Asset Metadata Extraction | OpenRMF | AssetMetadataService | rmf_enhanced.py | |
| Technology Area Classification | OpenRMF | AssetMetadataService | rmf_enhanced.py | |
| **Questionnaire Enhancements (GovReady-Q patterns)** |
| Conditional Logic Engine | GovReady-Q | ConditionalLogicEngine | govready_enhanced.py | 1100+ |
| Module Repository (5 built-in) | GovReady-Q | ModuleRepository | govready_enhanced.py | |
| Statement Generator | GovReady-Q | StatementGenerator | govready_enhanced.py | |
| OSCAL Statement Output | GovReady-Q | OutputDocumentGenerator | govready_enhanced.py | |
| Gap Analysis Report | GovReady-Q | OutputDocumentGenerator | govready_enhanced.py | |
| **POA&M Export (RampControl patterns)** |
| FedRAMP Appendix A Excel | RampControl | POAMExportService | poam_export.py | 600+ |
| CSV Export | RampControl | POAMExportService | poam_export.py | |
| OSCAL POA&M Export | RampControl | POAMExportService | poam_export.py | |
| Deviation Report | RampControl | POAMExportService | poam_export.py | |
| Milestone Report | RampControl | POAMExportService | poam_export.py | |
| **Frontend** |
| OSCAL Editor UI | OSCAL-GUI | OscalEditor.svelte | OscalEditor.svelte | 750+ |

### 14.2 Code Statistics

| Module | New Files | Total Lines | New Classes | New Methods |
|--------|-----------|-------------|-------------|-------------|
| oscal_integration/services | 3 | ~3,700 | 17 | 60+ |
| rmf_operations/services | 1 | ~1,050 | 4 | 20+ |
| questionnaires/services | 1 | ~1,100 | 5 | 30+ |
| poam/services | 1 | ~600 | 2 | 10+ |
| frontend/components | 2 | ~750 | - | - |
| **Total** | **8** | **~7,200** | **28** | **120+** |

### 14.3 Integration Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Enhancement Integration Summary                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Source Projects Analyzed: 8 GRC repositories                                │
│  Integration Gaps Identified: 28                                            │
│  Gaps Implemented: 28 (100%)                                                │
│                                                                              │
│  Implementation Phases:                                                      │
│  ├── Phase 1: OSCAL/Trestle Integration (TrestleService)                   │
│  ├── Phase 2: FedRAMP Enhancement (FedRAMPEnhancedService)                 │
│  ├── Phase 3: OpenControl Conversion (OpenControlConverter)                │
│  ├── Phase 4: RMF Operations (SCAPParser, RMFDocGen, Scoring, Assets)      │
│  ├── Phase 5: Questionnaire Enhancement (ConditionalLogic, Modules, Gen)   │
│  └── Phase 6: POA&M Export (FedRAMP Excel, CSV, OSCAL, Reports)            │
│                                                                              │
│  Architecture Pattern: Hybrid (Legacy Django + DDD Bounded Contexts)        │
│  DDD Bounded Contexts: 10 total                                             │
│  New Service Files: 8                                                       │
│  New Frontend Components: 1 (OscalEditor)                                   │
│  New Routes: 3 (rmf/checklists, rmf/findings, rmf/scoring)                 │
│                                                                              │
│  Backwards Compatibility: 100% (all changes are additive)                   │
│  Breaking Changes: 0                                                        │
│  Modified Existing Files: 4 (utils only - schemas, types, sidebar, table)  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Document Version: Post-DDD Migration + Federal Compliance Enhancements*
*Last Updated: 2026-01-22*
*Verification Status: All services verified, no circular dependencies*
