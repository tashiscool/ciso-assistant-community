# CISO Assistant Implementation Roadmap
## Feature Parity with RegScale + FedRAMP 20x Future-Proofing

**Version:** 1.1
**Date:** January 2026
**Status:** Draft

---

## Executive Summary

This roadmap outlines a strategic implementation plan to:
1. **Achieve feature parity with RegScale** - Address identified gaps in core GRC capabilities
2. **Support FedRAMP 20x** - Future-proof for the new authorization paradigm
3. **Maintain competitive advantage** - Leverage existing strengths (90+ frameworks, OSCAL, multi-language)

### Timeline Overview

| Phase | Focus | Duration | Priority |
|-------|-------|----------|----------|
| Phase 1 | FedRAMP 20x Foundation | 6-8 weeks | Critical |
| Phase 2 | Core Platform Enhancements | 8-10 weeks | High |
| Phase 3 | Scanner Integrations | 10-12 weeks | High |
| Phase 4 | Advanced AI & Risk Analytics | 8-10 weeks | High |
| Phase 5 | Advanced Workflows & Automation | 6-8 weeks | Medium |

### Deferred Items (Post-Product Maturity)

The following items are explicitly **out of scope** for this roadmap and will be considered only after core product features are complete and validated:
- CLI Tool
- GraphQL API

These developer-focused features add complexity without directly improving core GRC capabilities for end users.

---

## Feature Parity Comparison: CISO Assistant vs RegScale

| Feature | RegScale | CISO Assistant | Gap Status |
|---------|----------|----------------|------------|
| **Compliance Frameworks** | 60+ | 90+ | ✅ Ahead |
| **OSCAL Support** | Full (SSP, SAP, SAR, POA&M) | Full bi-directional | ✅ Parity |
| **FedRAMP Support** | Rev5 + 20x | Rev5, 20x in progress | 🔄 Phase 1 |
| **Continuous Controls Monitoring** | Yes | Yes (ConMon module) | ✅ Parity |
| **Risk Management** | Asset, TPRM, Enterprise | Asset, TPRM, Business | 🔄 Phase 4.5 |
| **Quantitative Risk (Monte Carlo)** | Yes | No | 🔄 Phase 4.2 |
| **Third-Party Risk Management** | Yes | Yes | ✅ Parity |
| **Evidence Repository** | Centralized, automated | Centralized, automated | ✅ Parity |
| **Scanner Integrations** | 1300+ APIs (via OCSF) | 20+ connectors | 🔄 Phase 3 |
| **OCSF Support** | Yes (OCSF-to-OSCAL) | No | 🔄 Phase 4.3 |
| **AI - Control Authoring** | RegML Author | Basic AI Assistant | 🔄 Phase 4.1 |
| **AI - Policy Extraction** | RegML Extractor | No | 🔄 Phase 4.1 |
| **AI - Control Auditing** | RegML Auditor | No | 🔄 Phase 4.1 |
| **AI - Control Explanation** | RegML Explainer | No | 🔄 Phase 4.1 |
| **Time Travel / Version History** | Patented system | Basic audit logs | 🔄 Phase 2.4 |
| **Security Graph** | Yes (360° asset view) | No | 🔄 Phase 4.4 |
| **Low-Code Workflows** | Yes | Basic workflow engine | 🔄 Phase 5.2 |
| **Kanban/Visual Tracking** | Yes | No | 🔄 Phase 2.1 |
| **Guided Workflows (Wayfinder)** | Yes | No | 🔄 Phase 2.2 |
| **Multi-Language Support** | Limited | 22 languages | ✅ Ahead |
| **Open Source** | No (Proprietary) | Yes | ✅ Differentiator |

**Legend:** ✅ Complete | 🔄 In Roadmap | ❌ Not Planned

---

## Phase 1: FedRAMP 20x Foundation (Critical Priority)

**Rationale:** FedRAMP 20x Phase 2 pilot ends March 2026, with public Low/Moderate authorizations expected Q3-Q4 2026. Rev5 providers must transition to machine-readable data by FY27 Q1-Q2. Early support positions CISO Assistant as a leader in this space.

### 1.1 FedRAMP 20x KSI Framework Library

**Deliverable:** New framework library file for FedRAMP 20x Key Security Indicators

**Location:** `backend/library/libraries/fedramp-20x-ksi.yaml`

**Structure:**
```yaml
urn: urn:intuitem:risk:library:fedramp-20x
locale: en
ref_id: FEDRAMP-20X-KSI
name: FedRAMP 20x Key Security Indicators
description: FedRAMP 20x modernized authorization framework based on Key Security Indicators
version: 25.12A
publication_date: 2025-12-29
provider: FedRAMP / GSA
packager: intuitem

objects:
  framework:
    urn: urn:intuitem:risk:framework:fedramp-20x
    ref_id: FEDRAMP-20X
    name: FedRAMP 20x Key Security Indicators
    implementation_groups_definition:
      - ref_id: LOW
        name: Low Impact
        description: FedRAMP 20x Low Impact baseline (56 KSIs)
      - ref_id: MOD
        name: Moderate Impact
        description: FedRAMP 20x Moderate Impact baseline (61 KSIs)

    requirement_nodes:
      # 11 KSI Categories with ~61 indicators
      - urn: urn:intuitem:risk:req_node:fedramp-20x:ksi-afr
        assessable: false
        depth: 1
        ref_id: KSI-AFR
        name: Authorization by FedRAMP
        description: Government-specific requirements for maintaining authorization

      - urn: urn:intuitem:risk:req_node:fedramp-20x:ksi-afr-01
        assessable: true
        depth: 2
        parent_urn: urn:intuitem:risk:req_node:fedramp-20x:ksi-afr
        ref_id: KSI-AFR-01
        name: Minimum Assessment Scope
        description: Apply FedRAMP MAS to identify and document scope
        implementation_groups: [LOW, MOD]
        # ... (all 61 KSIs)
```

**Tasks:**
- [ ] Parse FedRAMP GitHub JSON files to extract all KSIs
- [ ] Map KSIs to NIST SP 800-53 controls (already in JSON)
- [ ] Create YAML library with proper URN structure
- [ ] Add implementation groups (Low/Moderate)
- [ ] Include retired KSI tracking

**Estimated Effort:** 2-3 weeks

---

### 1.2 KSI Implementation Data Model

**Deliverable:** New bounded context for FedRAMP 20x KSI tracking

**Location:** `backend/core/bounded_contexts/fedramp_20x/`

**New Aggregates:**

```python
# backend/core/bounded_contexts/fedramp_20x/domain/aggregates.py

class KSIImplementation(AggregateRoot):
    """
    Tracks implementation of a Key Security Indicator per FRR-KSI-02.

    Required summaries:
    - Goals with pass/fail criteria
    - Consolidated information resources
    - Machine-based validation processes and cycles
    - Non-machine-based validation processes and cycles
    - Current implementation status
    - Clarifications/responses to assessments
    """
    ksi_id: str  # e.g., "KSI-IAM-01"
    cloud_service_offering_id: UUID

    # Goals and criteria (FRR-KSI-02)
    goals: str
    pass_fail_criteria: str
    traceability: str

    # Information resources being validated
    information_resources: List[str]  # Consolidated summaries

    # Machine-based validation
    machine_validation_process: str
    machine_validation_cycle: str  # e.g., "hourly", "daily", "weekly"
    machine_validation_enabled: bool
    last_machine_validation: datetime
    machine_validation_result: Optional[bool]

    # Non-machine-based validation
    human_validation_process: str
    human_validation_cycle: str  # e.g., "monthly", "quarterly"
    last_human_validation: datetime
    human_validation_result: Optional[bool]

    # Status
    status: KSIStatus  # draft, in_progress, implemented, validated, failed
    compliance_percentage: float  # 0-100

    # Assessment response
    clarifications: str
    assessment_responses: List[AssessmentResponse]

    # Linked entities
    evidence_ids: List[UUID]  # EmbeddedIdArrayField
    control_implementation_ids: List[UUID]

    # Audit
    version: int
    created_at: datetime
    updated_at: datetime


class CloudServiceOffering(AggregateRoot):
    """
    Represents a cloud service offering for FedRAMP 20x authorization.
    """
    name: str
    description: str
    service_model: str  # IaaS, PaaS, SaaS
    deployment_model: str  # Public, Private, Hybrid, Community

    # FedRAMP specific
    impact_level: str  # low, moderate, high
    authorization_status: str  # seeking, authorized, revoked
    marketplace_url: Optional[str]

    # Authorization data sharing (FRR-ADS)
    trust_center_url: Optional[str]
    public_info_url: Optional[str]

    # Services included
    services: List[ServiceDetail]

    # KSI coverage
    ksi_implementation_ids: List[UUID]
    overall_ksi_compliance: float


class OngoingAuthorizationReport(AggregateRoot):
    """
    Quarterly OAR per FRR-CCM-01.
    """
    cloud_service_offering_id: UUID
    report_period_start: date
    report_period_end: date
    target_publish_date: date
    actual_publish_date: Optional[date]

    # Content
    executive_summary: str
    ksi_status_summary: Dict[str, Any]  # JSON
    vulnerability_summary: Dict[str, Any]
    incident_summary: Dict[str, Any]
    significant_changes: List[str]

    # Feedback tracking (FRR-CCM-04, FRR-CCM-05)
    feedback_mechanism_url: str
    anonymized_feedback_summary: str

    # Publication
    status: str  # draft, review, published
    machine_readable_url: Optional[str]
    human_readable_url: Optional[str]


class PersistentValidation(AggregateRoot):
    """
    Tracks persistent validation activities per FRR-PVA.
    """
    ksi_implementation_id: UUID
    validation_type: str  # machine, human, hybrid

    # Execution
    scheduled_at: datetime
    executed_at: Optional[datetime]
    completed_at: Optional[datetime]

    # Results
    passed: Optional[bool]
    findings: List[ValidationFinding]
    evidence_collected: List[UUID]

    # If failed, tracked as vulnerability (FRR-PVA-02)
    vulnerability_id: Optional[UUID]


class VulnerabilityTracking(AggregateRoot):
    """
    FedRAMP 20x VDR vulnerability tracking per FRR-VDR.
    """
    cloud_service_offering_id: UUID

    # Detection
    detected_at: datetime
    detection_method: str
    cve_id: Optional[str]

    # Evaluation (FRR-VDR-07 through FRR-VDR-09)
    exploitability: str  # high, medium, low, none
    internet_reachable: bool
    potential_adverse_impact: str  # critical, high, moderate, low

    # Context
    affected_resources: List[str]
    is_false_positive: bool
    false_positive_justification: Optional[str]

    # Response
    status: str  # detected, evaluating, mitigating, remediated, accepted
    mitigation_plan: str
    remediation_deadline: date
    remediated_at: Optional[datetime]

    # Linked to KSIs affected
    affected_ksi_ids: List[str]
```

**Tasks:**
- [ ] Create domain models and aggregates
- [ ] Implement repositories
- [ ] Create API endpoints
- [ ] Build frontend components
- [ ] Add validation rules per FedRAMP requirements

**Estimated Effort:** 3-4 weeks

---

### 1.3 FedRAMP 20x Machine-Readable Export

**Deliverable:** Export compliance data in FedRAMP 20x JSON schema

**Location:** `backend/fedramp_20x/services/export_service.py`

**Features:**
- Export KSI implementations as JSON matching FedRAMP schema
- Generate OAR in machine-readable format
- Export vulnerability data per VDR requirements
- Support both human-readable and machine-readable formats (FRR-ADS-02)

```python
class FedRAMP20xExportService:
    """
    Export CISO Assistant data in FedRAMP 20x machine-readable format.
    """

    def export_authorization_package(
        self,
        cso_id: UUID,
        include_evidence: bool = True
    ) -> Dict[str, Any]:
        """
        Export full authorization package in FedRAMP 20x format.
        """
        pass

    def export_ksi_summary(
        self,
        cso_id: UUID,
        impact_level: str = "moderate"
    ) -> Dict[str, Any]:
        """
        Export KSI implementation summary per FRR-KSI-02.
        """
        pass

    def export_oar(
        self,
        oar_id: UUID
    ) -> Dict[str, Any]:
        """
        Export Ongoing Authorization Report in machine-readable format.
        """
        pass

    def generate_validation_report(
        self,
        cso_id: UUID,
        validation_run_id: UUID
    ) -> Dict[str, Any]:
        """
        Generate validation report showing automated validation coverage.
        """
        pass
```

**Tasks:**
- [ ] Implement JSON schema based on FedRAMP GitHub specs
- [ ] Create export endpoints
- [ ] Add schema validation
- [ ] Support version tracking for exports

**Estimated Effort:** 2 weeks

---

### 1.4 FedRAMP 20x Dashboard & UI

**Deliverable:** New UI section for FedRAMP 20x management

**Location:** `frontend/src/routes/(app)/fedramp-20x/`

**Components:**
```
fedramp-20x/
├── +page.svelte              # Overview dashboard
├── cso/
│   ├── +page.svelte          # Cloud Service Offerings list
│   ├── [id]/
│   │   ├── +page.svelte      # CSO detail
│   │   ├── ksis/             # KSI management
│   │   ├── oars/             # OAR management
│   │   └── validation/       # Validation status
├── ksi-library/
│   └── +page.svelte          # KSI reference library
└── reports/
    └── +page.svelte          # Export/reporting
```

**Dashboard Features:**
- KSI compliance heatmap (11 categories)
- Automation coverage indicator (target: 70%+)
- Upcoming OAR deadlines
- Validation cycle status
- Vulnerability summary per VDR

**Estimated Effort:** 2-3 weeks

---

## Phase 2: Core Platform Enhancements (High Priority)

### 2.1 Kanban Board System

**Gap:** RegScale has drag-drop Kanban for remediation tracking

**Deliverable:** Reusable Kanban component for multiple modules

**Location:** `frontend/src/lib/components/Kanban/`

**Implementation:**
```typescript
// frontend/src/lib/components/Kanban/KanbanBoard.svelte
interface KanbanColumn {
  id: string;
  title: string;
  items: KanbanItem[];
  color?: string;
  limit?: number;  // WIP limit
}

interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  assignee?: User;
  dueDate?: Date;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  labels?: string[];
}

// Supports:
// - Drag and drop between columns
// - WIP limits
// - Filtering and search
// - Swimlanes (by assignee, priority, etc.)
// - Card quick actions
```

**Apply to:**
- POA&M/Findings remediation
- Risk treatment tracking
- Control implementation status
- FedRAMP 20x KSI progress
- Vulnerability response workflow

**Tasks:**
- [ ] Build generic Kanban component
- [ ] Integrate with existing data models
- [ ] Add real-time updates via WebSocket
- [ ] Mobile-responsive design

**Estimated Effort:** 3 weeks

---

### 2.2 Wayfinder - Guided Workflow System

**Gap:** RegScale 6.0 has step-by-step compliance guidance

**Deliverable:** Interactive workflow guidance system

**Location:** `backend/wayfinder/` and `frontend/src/lib/components/Wayfinder/`

**Features:**
```python
# backend/wayfinder/models.py

class Workflow(models.Model):
    """
    Defines a multi-step guided workflow.
    """
    name = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(choices=[
        ('onboarding', 'Onboarding'),
        ('assessment', 'Assessment'),
        ('authorization', 'Authorization'),
        ('remediation', 'Remediation'),
        ('audit', 'Audit Preparation'),
    ])
    framework = models.ForeignKey('Framework', null=True)

    # Workflow definition (JSON)
    steps = models.JSONField()

    # Conditions for workflow availability
    preconditions = models.JSONField(default=list)

    estimated_duration = models.DurationField(null=True)


class WorkflowStep(models.Model):
    """
    Individual step in a workflow.
    """
    workflow = models.ForeignKey(Workflow)
    order = models.IntegerField()

    title = models.CharField(max_length=255)
    description = models.TextField()
    instructions = models.TextField()  # Markdown

    # Step type
    step_type = models.CharField(choices=[
        ('info', 'Information'),
        ('form', 'Form Input'),
        ('checklist', 'Checklist'),
        ('upload', 'File Upload'),
        ('review', 'Review'),
        ('approval', 'Approval'),
        ('automation', 'Automated Action'),
    ])

    # Form/checklist definition
    form_schema = models.JSONField(null=True)

    # Automation
    automation_action = models.CharField(null=True)  # e.g., "create_assessment"

    # Skip conditions
    skip_conditions = models.JSONField(default=list)


class WorkflowExecution(models.Model):
    """
    Tracks user progress through a workflow.
    """
    workflow = models.ForeignKey(Workflow)
    user = models.ForeignKey(User)

    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)

    current_step = models.IntegerField(default=0)
    step_data = models.JSONField(default=dict)  # Collected data per step

    status = models.CharField(choices=[
        ('in_progress', 'In Progress'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ])
```

**Pre-built Workflows:**
1. **FedRAMP 20x Authorization** - Full 20x authorization journey
2. **FedRAMP Rev5 to 20x Migration** - Transition guide
3. **Initial Risk Assessment** - EBIOS RM or quantitative
4. **Compliance Assessment Setup** - Framework selection and baseline
5. **Incident Response Execution** - IR playbook
6. **Vendor Due Diligence** - TPRM workflow
7. **Audit Preparation** - Evidence gathering checklist

**Tasks:**
- [ ] Design workflow engine
- [ ] Build step renderer components
- [ ] Create workflow library
- [ ] Add progress tracking and resume capability
- [ ] Integration with AI Assistant for guidance

**Estimated Effort:** 4 weeks

---

### 2.3 Lightning Assessment

**Gap:** RegScale has rapid one-click testing execution

**Deliverable:** Quick assessment execution with automated evidence collection

**Location:** `backend/assessments/services/lightning_assessment.py`

**Features:**
```python
class LightningAssessmentService:
    """
    Rapid assessment execution with automation.
    """

    def execute_lightning_assessment(
        self,
        framework_id: UUID,
        scope: AssessmentScope,
        evidence_sources: List[EvidenceSource],
        auto_collect: bool = True
    ) -> LightningAssessmentResult:
        """
        Execute rapid assessment:
        1. Auto-collect evidence from connected sources
        2. Map evidence to controls
        3. Pre-populate assessment results
        4. Flag items needing manual review
        """
        pass

    def get_assessment_readiness(
        self,
        framework_id: UUID,
        scope: AssessmentScope
    ) -> ReadinessReport:
        """
        Pre-flight check showing:
        - Controls with existing evidence
        - Controls with automation coverage
        - Controls requiring manual assessment
        - Estimated assessment time
        """
        pass
```

**UI Flow:**
1. Select framework and scope
2. Show readiness report
3. Connect evidence sources
4. One-click "Run Assessment"
5. Real-time progress with evidence mapping
6. Review and finalize results

**Estimated Effort:** 3 weeks

---

### 2.4 Time Travel / Version History System

**Gap:** RegScale has patented time travel system for full audit history

**Deliverable:** Comprehensive versioning with point-in-time snapshots

**Location:** Extend `backend/core/domain/` infrastructure

**Implementation:**
```python
# Extend existing EventStore pattern

class TemporalQueryService:
    """
    Query entities at any point in time.
    """

    def get_entity_at_time(
        self,
        entity_type: str,
        entity_id: UUID,
        timestamp: datetime
    ) -> Optional[Dict[str, Any]]:
        """
        Reconstruct entity state at given timestamp.
        """
        pass

    def get_entity_history(
        self,
        entity_type: str,
        entity_id: UUID,
        start: datetime,
        end: datetime
    ) -> List[EntityVersion]:
        """
        Get all versions of entity in time range.
        """
        pass

    def compare_versions(
        self,
        entity_type: str,
        entity_id: UUID,
        timestamp_a: datetime,
        timestamp_b: datetime
    ) -> DiffReport:
        """
        Generate diff between two versions.
        """
        pass

    def create_snapshot(
        self,
        scope: SnapshotScope,
        name: str,
        description: str
    ) -> Snapshot:
        """
        Create named snapshot of current state.
        """
        pass

    def restore_from_snapshot(
        self,
        snapshot_id: UUID,
        dry_run: bool = True
    ) -> RestoreReport:
        """
        Restore to snapshot state.
        """
        pass
```

**Features:**
- Event-sourced history (already have EventStore)
- Point-in-time queries
- Named snapshots (e.g., "Pre-Audit 2026-Q1")
- Diff visualization
- Integrity verification (hash chains)
- Export historical reports

**Estimated Effort:** 4 weeks

---

## Phase 3: Scanner & Tool Integrations (High Priority)

### 3.1 Integration Framework Enhancement

**Current State:** Evidence Automation module with basic connectors

**Enhancement:** Robust plugin architecture for scanner integrations

**Location:** `backend/integrations/`

```python
# backend/integrations/base.py

class IntegrationConnector(ABC):
    """
    Base class for all scanner/tool integrations.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def category(self) -> str:
        """vulnerability_scanner, siem, identity, cloud, etc."""
        pass

    @property
    @abstractmethod
    def supported_data_types(self) -> List[str]:
        """vulnerabilities, assets, users, logs, etc."""
        pass

    @abstractmethod
    async def test_connection(self, config: Dict) -> ConnectionTestResult:
        pass

    @abstractmethod
    async def fetch_data(
        self,
        data_type: str,
        filters: Optional[Dict] = None,
        since: Optional[datetime] = None
    ) -> AsyncIterator[Dict]:
        pass

    @abstractmethod
    def map_to_ciso_model(
        self,
        data_type: str,
        raw_data: Dict
    ) -> Union[Asset, Vulnerability, Evidence, ...]:
        pass


class IntegrationRegistry:
    """
    Registry for all available integrations.
    """
    _connectors: Dict[str, Type[IntegrationConnector]] = {}

    @classmethod
    def register(cls, connector_class: Type[IntegrationConnector]):
        cls._connectors[connector_class.name] = connector_class

    @classmethod
    def get_connector(cls, name: str) -> Type[IntegrationConnector]:
        return cls._connectors.get(name)

    @classmethod
    def list_connectors(cls, category: Optional[str] = None) -> List[Dict]:
        pass
```

### 3.2 Priority Scanner Integrations

**Tier 1 - Critical (Most requested, broad coverage):**

| Integration | Category | Data Types | Effort |
|------------|----------|------------|--------|
| Microsoft Defender | EDR/Vuln | vulnerabilities, threats, assets | 2 weeks |
| Microsoft InTune | MDM | devices, compliance, policies | 2 weeks |
| Wiz | CSPM | vulnerabilities, misconfigs, assets | 2 weeks |
| Prisma Cloud | CSPM | vulnerabilities, compliance, assets | 2 weeks |
| Active Directory | Identity | users, groups, policies | 1.5 weeks |

**Tier 2 - High (DevSecOps, AppSec):**

| Integration | Category | Data Types | Effort |
|------------|----------|------------|--------|
| Snyk | SCA/SAST | vulnerabilities, dependencies | 1.5 weeks |
| Trivy | Container | vulnerabilities, misconfigs | 1 week |
| Veracode | SAST/DAST | vulnerabilities, findings | 1.5 weeks |
| SonarCloud | SAST | code quality, vulnerabilities | 1 week |
| GitLab Security | DevSecOps | vulnerabilities, compliance | 1.5 weeks |

**Tier 3 - Medium (Specialized):**

| Integration | Category | Data Types | Effort |
|------------|----------|------------|--------|
| Aqua | Container | vulnerabilities, runtime | 1.5 weeks |
| Rapid7/Nexpose | Vuln Scanner | vulnerabilities, assets | 1.5 weeks |
| Burp Suite | DAST | vulnerabilities, findings | 1 week |
| IBM AppScan | DAST | vulnerabilities | 1 week |
| JFrog Xray | SCA | vulnerabilities, licenses | 1 week |
| Salesforce | CRM | users, data access | 1 week |

**Sample Integration Implementation:**

```python
# backend/integrations/connectors/wiz.py

@IntegrationRegistry.register
class WizConnector(IntegrationConnector):
    name = "wiz"
    category = "cspm"
    supported_data_types = ["vulnerabilities", "misconfigurations", "assets", "compliance"]

    def __init__(self, config: WizConfig):
        self.client_id = config.client_id
        self.client_secret = config.client_secret
        self.api_url = config.api_url or "https://api.wiz.io/graphql"
        self._token = None

    async def test_connection(self, config: Dict) -> ConnectionTestResult:
        try:
            token = await self._authenticate()
            return ConnectionTestResult(success=True, message="Connected to Wiz API")
        except Exception as e:
            return ConnectionTestResult(success=False, message=str(e))

    async def fetch_data(
        self,
        data_type: str,
        filters: Optional[Dict] = None,
        since: Optional[datetime] = None
    ) -> AsyncIterator[Dict]:
        if data_type == "vulnerabilities":
            query = self._build_vuln_query(filters, since)
            async for result in self._paginate_graphql(query):
                yield result
        elif data_type == "misconfigurations":
            # ...

    def map_to_ciso_model(self, data_type: str, raw_data: Dict):
        if data_type == "vulnerabilities":
            return VulnerabilityFinding(
                external_id=raw_data["id"],
                title=raw_data["name"],
                severity=self._map_severity(raw_data["severity"]),
                cve_id=raw_data.get("cve"),
                affected_asset=raw_data["resource"]["name"],
                description=raw_data["description"],
                remediation=raw_data.get("remediation"),
                detected_at=parse_datetime(raw_data["createdAt"]),
                source="wiz",
            )
```

**Estimated Total Effort:** 10-12 weeks (parallel development possible)

---

## Phase 4: Advanced AI & Risk Analytics (High Priority)

**Gap:** RegScale has RegML AI platform with Author, Extractor, Auditor, and Explainer capabilities, plus quantitative risk analysis with Monte Carlo simulations.

### 4.1 Enhanced AI Assistant (RegML Parity)

**Deliverable:** Expand AI Assistant to match RegScale's RegML capabilities

**Location:** `backend/ai_assistant/services/`

**Features:**

```python
class AIAssistantService:
    """
    Enhanced AI capabilities matching RegML feature set.
    """

    # AI Author - Draft control implementation statements
    async def author_control(
        self,
        requirement_id: UUID,
        context: ControlContext,
        existing_policies: List[PolicyDocument]
    ) -> ControlDraft:
        """
        Draft precise control implementation statements that satisfy
        regulatory requirements. Reduces errors and improves documentation.
        """
        pass

    # AI Extractor - Extract controls from policy documents
    async def extract_controls_from_policy(
        self,
        policy_document: bytes,
        target_framework_id: Optional[UUID] = None
    ) -> List[ExtractedControl]:
        """
        Automatically derive compliance documentation from existing policies.
        Analyzes policies and builds effective controls statements.
        """
        pass

    # AI Auditor - Evaluate controls on demand
    async def audit_control(
        self,
        control_id: UUID,
        evaluation_criteria: Optional[List[str]] = None
    ) -> ControlAuditResult:
        """
        Evaluate controls on-demand, identify gaps, and recommend
        improvements with context-aware suggestions.
        """
        pass

    # AI Explainer - Demystify complex control statements
    async def explain_control(
        self,
        control_id: UUID,
        target_audience: str = "technical"  # technical, executive, auditor
    ) -> ControlExplanation:
        """
        Provide role-specific explanations that bridge knowledge gaps
        and ensure clear understanding of regulatory requirements.
        """
        pass

    # AI Mapper - Map controls across frameworks
    async def suggest_control_mapping(
        self,
        source_control_id: UUID,
        target_framework_id: UUID
    ) -> List[MappingSuggestion]:
        """
        Intelligently suggest control mappings between frameworks.
        """
        pass
```

**Tasks:**
- [ ] Implement AI Author with policy context awareness
- [ ] Build AI Extractor with PDF/Word document parsing
- [ ] Create AI Auditor with gap analysis and recommendations
- [ ] Add AI Explainer with role-based output formatting
- [ ] Integrate with existing AI Assistant UI

**Estimated Effort:** 4 weeks

---

### 4.2 Quantitative Risk Analysis (Monte Carlo)

**Gap:** RegScale has financial modeling that translates risks to dollars using Monte Carlo simulations

**Deliverable:** Quantitative risk analysis with financial impact modeling

**Location:** `backend/core/bounded_contexts/risk_registers/services/quantitative_analysis.py`

```python
class QuantitativeRiskAnalysisService:
    """
    Financial risk modeling with Monte Carlo simulations.
    """

    def run_monte_carlo_simulation(
        self,
        risk_id: UUID,
        iterations: int = 10000,
        confidence_levels: List[float] = [0.90, 0.95, 0.99]
    ) -> MonteCarloResult:
        """
        Run Monte Carlo simulation for risk financial impact.

        Returns:
        - Expected annual loss
        - Loss distribution
        - Value at Risk (VaR) at confidence levels
        - Conditional VaR (CVaR)
        """
        pass

    def calculate_risk_reduction_roi(
        self,
        risk_id: UUID,
        mitigation_cost: Decimal,
        mitigation_effectiveness: float  # 0-1 reduction factor
    ) -> ROIAnalysis:
        """
        Calculate ROI of risk mitigation investment.
        Translates risk reduction to bottom-line impact.
        """
        pass

    def aggregate_portfolio_risk(
        self,
        risk_ids: List[UUID],
        correlation_matrix: Optional[List[List[float]]] = None
    ) -> PortfolioRiskResult:
        """
        Aggregate risks with correlation analysis.
        """
        pass


@dataclass
class MonteCarloResult:
    iterations: int
    expected_annual_loss: Decimal
    standard_deviation: Decimal
    minimum_loss: Decimal
    maximum_loss: Decimal
    percentiles: Dict[int, Decimal]  # {90: $X, 95: $Y, 99: $Z}
    var_90: Decimal  # Value at Risk
    var_95: Decimal
    var_99: Decimal
    cvar_95: Decimal  # Conditional VaR (Expected Shortfall)
    loss_distribution: List[Decimal]  # For visualization


@dataclass
class ROIAnalysis:
    mitigation_cost: Decimal
    expected_loss_before: Decimal
    expected_loss_after: Decimal
    annual_risk_reduction: Decimal
    roi_percentage: float
    payback_period_years: float
    npv_5_year: Decimal
```

**UI Components:**
- Risk financial impact input form (ALE factors)
- Monte Carlo simulation runner with progress indicator
- Loss distribution histogram/chart
- ROI calculator with visualization
- Portfolio risk dashboard

**Estimated Effort:** 3 weeks

---

### 4.3 OCSF Integration (Telemetry Normalization)

**Gap:** RegScale has OCSF-to-OSCAL translator for seamless telemetry conversion

**Deliverable:** Open Cybersecurity Schema Framework (OCSF) support

**Location:** `backend/integrations/ocsf/`

```python
class OCSFTranslatorService:
    """
    OCSF-to-OSCAL translation for telemetry normalization.
    Enables single integration point for security tool data.
    """

    def parse_ocsf_event(
        self,
        event: Dict[str, Any],
        event_class: str  # security_finding, vulnerability, etc.
    ) -> OCSFEvent:
        """
        Parse and validate OCSF event data.
        """
        pass

    def translate_to_oscal(
        self,
        ocsf_event: OCSFEvent,
        target_type: str  # finding, observation, risk
    ) -> OSCALObject:
        """
        Convert OCSF event to OSCAL-compliant object.
        """
        pass

    def map_to_controls(
        self,
        ocsf_event: OCSFEvent,
        framework_id: UUID
    ) -> List[ControlMapping]:
        """
        Map OCSF security finding to relevant controls.
        """
        pass

    def bulk_import_ocsf(
        self,
        events: List[Dict[str, Any]],
        source: str
    ) -> ImportResult:
        """
        Bulk import OCSF events from security tools.
        """
        pass
```

**Supported OCSF Event Classes:**
- Security Finding (1001)
- Vulnerability Finding (2001)
- Compliance Finding (2002)
- Detection Finding (2004)
- Configuration State (5001)
- Account Change (3001)
- Authentication (3002)

**Benefits:**
- Single integration point for multiple security tools
- Automatic normalization of diverse telemetry
- Native OSCAL output for compliance documentation
- Reduced connector maintenance burden

**Estimated Effort:** 3 weeks

---

### 4.4 Security Graph & Asset Relationships

**Gap:** RegScale has Security Graph for 360-degree asset view

**Deliverable:** Graph-based asset relationship visualization and querying

**Location:** `backend/core/bounded_contexts/asset_service/services/security_graph.py`

```python
class SecurityGraphService:
    """
    Graph-based representation of assets, controls, risks, and relationships.
    """

    def build_asset_graph(
        self,
        scope: Optional[AssetScope] = None
    ) -> AssetGraph:
        """
        Build graph of assets with all relationships:
        - Asset → Asset (dependencies, data flows)
        - Asset → Control (implemented by)
        - Asset → Risk (threatens)
        - Asset → Vulnerability (affects)
        - Asset → Evidence (supports)
        """
        pass

    def query_graph(
        self,
        query: GraphQuery
    ) -> GraphQueryResult:
        """
        Query the security graph:
        - Find all assets affected by a vulnerability
        - Trace data flows from sensitive systems
        - Identify blast radius of a compromised asset
        - Find control coverage gaps
        """
        pass

    def calculate_blast_radius(
        self,
        asset_id: UUID,
        attack_type: str = "compromise"
    ) -> BlastRadiusResult:
        """
        Calculate potential impact if asset is compromised.
        """
        pass

    def get_asset_risk_context(
        self,
        asset_id: UUID
    ) -> AssetRiskContext:
        """
        360-degree view of asset with:
        - Direct and inherited risks
        - Control coverage
        - Vulnerability exposure
        - Compliance status
        - Data sensitivity
        """
        pass
```

**UI Components:**
- Interactive graph visualization (D3.js or similar)
- Blast radius visualizer
- Asset context panel
- Graph query builder

**Estimated Effort:** 4 weeks

---

### 4.5 Enterprise Risk Expansion

**Gap:** RegScale has enterprise risk beyond IT/cyber (HR, legal, safety)

**Deliverable:** Extended risk register categories

**Location:** Extend `backend/core/bounded_contexts/risk_registers/`

**New Risk Categories:**
```python
class RiskCategory(str, Enum):
    # Existing
    ASSET = "asset"
    THIRD_PARTY = "third_party"
    BUSINESS = "business"

    # New categories
    OPERATIONAL = "operational"      # Business process risks
    FINANCIAL = "financial"          # Financial/budget risks
    LEGAL = "legal"                  # Legal/regulatory risks
    HR = "hr"                        # Human resources risks
    SAFETY = "safety"                # Physical safety risks
    REPUTATIONAL = "reputational"    # Brand/reputation risks
    STRATEGIC = "strategic"          # Strategic/market risks
    ENVIRONMENTAL = "environmental"  # Environmental/ESG risks
```

**Features:**
- Category-specific risk templates
- Cross-category risk correlation
- Enterprise risk dashboard
- Board-level reporting views

**Estimated Effort:** 2 weeks

---

## Phase 5: Advanced Workflows & Automation (Medium Priority)

### 5.1 Master Assessment Feature

**Gap:** RegScale has grouped control testing workflows

**Deliverable:** Assessment orchestration across multiple systems/components

```python
class MasterAssessment(AggregateRoot):
    """
    Orchestrates assessments across multiple systems.
    """
    name: str
    description: str

    # Scope
    framework_id: UUID
    system_ids: List[UUID]  # Multiple systems

    # Assessment configuration
    testing_methodology: str  # examination, interview, testing
    sampling_strategy: str

    # Child assessments
    component_assessments: List[ComponentAssessment]

    # Aggregation
    aggregation_rules: Dict[str, Any]  # How to roll up results

    # Timeline
    planned_start: date
    planned_end: date

    # Results
    overall_status: str
    overall_compliance: float

    def aggregate_results(self) -> AggregatedResult:
        """Roll up component assessment results."""
        pass

    def generate_consolidated_report(self) -> Report:
        """Generate single report from all components."""
        pass
```

**Estimated Effort:** 3 weeks

---

### 5.2 Enhanced Workflow Builder

**Current State:** Basic workflow engine exists

**Enhancement:** Advanced visual workflow builder with more capabilities

**Location:** `frontend/src/lib/components/WorkflowBuilder/`

**Additional Features:**
- Drag-drop workflow designer improvements
- Advanced trigger types: schedule, event, manual, webhook, API
- Enhanced action types: API calls, notifications, data transforms, approvals, integrations
- Conditional logic with complex expressions
- Loop and parallel execution
- Error handling and retry logic
- Workflow versioning and rollback
- Testing/simulation mode with dry-run
- Workflow analytics and performance metrics

**Pre-built Workflow Templates:**
1. Vulnerability → POA&M creation
2. Evidence expiration → notification
3. Scanner data → vulnerability import
4. Assessment completion → report generation
5. Control change → re-assessment trigger
6. Incident detection → response playbook execution
7. Vendor risk score change → escalation workflow
8. Compliance deadline → reminder cascade

**Estimated Effort:** 3 weeks

---

## Implementation Priority Matrix

```
                    IMPACT
                    High │ Phase 1: FedRAMP 20x    Phase 3: Scanners
                         │ (Critical for future)   (Customer demand)
                         │
                         │ Phase 4: AI & Risk      Phase 2: Core UX
                         │ (RegScale parity)       (Kanban, Wayfinder)
                         │
                    Low  │                         Phase 5: Workflows
                         │                         (Automation)
                         └─────────────────────────────────────────
                              Low                High
                                    EFFORT
```

---

## Resource Allocation Recommendation

### Team Structure (Assuming 8-person team)

**Stream 1: FedRAMP 20x (3 developers)**
- Backend: KSI models, export service, validation
- Frontend: Dashboard, KSI management UI
- Integration: Machine-readable formats

**Stream 2: Platform Enhancements (2 developers)**
- Kanban system
- Wayfinder workflows
- Lightning Assessment
- Time Travel

**Stream 3: Integrations (2 developers)**
- Scanner connectors (parallelizable)
- Integration framework
- OCSF translator

**Stream 4: AI & Risk Analytics (1 developer + AI/ML specialist)**
- Enhanced AI Assistant features
- Quantitative risk analysis
- Security Graph

---

## Success Metrics

### FedRAMP 20x
- [ ] Support 100% of 61 KSIs
- [ ] Export valid FedRAMP 20x JSON packages
- [ ] Pass FedRAMP validation for machine-readable format
- [ ] Generate compliant OARs

### Feature Parity with RegScale
- [ ] 14+ new scanner integrations operational
- [ ] AI Author, Extractor, Auditor, Explainer features live
- [ ] Quantitative risk analysis with Monte Carlo simulations
- [ ] OCSF-to-OSCAL translation working
- [ ] Security Graph with blast radius analysis
- [ ] Enterprise risk categories beyond IT/cyber
- [ ] Kanban used in 3+ modules
- [ ] 5+ Wayfinder workflows published
- [ ] Master Assessment feature deployed

### User Adoption
- [ ] 50% reduction in assessment setup time (Lightning Assessment)
- [ ] 30% increase in automation coverage (workflows)
- [ ] 90% user satisfaction with new UI features
- [ ] 60% reduction in control authoring time (AI Author)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| FedRAMP 20x spec changes | High | Monitor RFC discussions, build flexible schema |
| Integration API changes | Medium | Version connectors, add fallback logic |
| Scope creep | Medium | Strict MVP definitions per phase |
| Resource constraints | Medium | Prioritize ruthlessly, consider community contributions |
| AI model quality | Medium | Iterative testing, human review workflows |
| OCSF schema evolution | Low | Abstract translation layer, version support |

---

## Next Steps

1. **Immediate (Week 1-2):**
   - Finalize Phase 1 technical design
   - Set up FedRAMP 20x development branch
   - Begin KSI framework YAML creation

2. **Short-term (Week 3-4):**
   - Start KSI data model implementation
   - Prototype Kanban component
   - Begin Wayfinder workflow engine design

3. **Medium-term (Week 5-8):**
   - Start Phase 4 AI enhancement work (AI Author, Extractor)
   - Implement quantitative risk analysis foundation
   - Begin OCSF schema integration

4. **Ongoing:**
   - Weekly sync on FedRAMP 20x RFC updates
   - Bi-weekly integration prioritization review
   - Monthly roadmap adjustment based on feedback
   - Track RegScale feature releases for parity updates

---

## Appendix A: FedRAMP 20x KSI Quick Reference

| Category | ID | Name | Low | Mod |
|----------|-----|------|-----|-----|
| Authorization | KSI-AFR-01 | Minimum Assessment Scope | ✓ | ✓ |
| Authorization | KSI-AFR-02 | Key Security Indicators | ✓ | ✓ |
| Authorization | KSI-AFR-03 | Authorization Data Sharing | ✓ | ✓ |
| Authorization | KSI-AFR-04 | Vulnerability Detection & Response | ✓ | ✓ |
| Authorization | KSI-AFR-05 | Significant Change Notifications | ✓ | ✓ |
| Authorization | KSI-AFR-06 | Incident Communications | ✓ | ✓ |
| Authorization | KSI-AFR-07 | Collaborative Continuous Monitoring | ✓ | ✓ |
| Authorization | KSI-AFR-08 | Persistent Validation | ✓ | ✓ |
| Authorization | KSI-AFR-09 | Recommended Secure Configuration | ✓ | ✓ |
| Authorization | KSI-AFR-10 | Cryptographic Modules | ✓ | ✓ |
| Authorization | KSI-AFR-11 | Digital Identity | ✓ | ✓ |
| Education | KSI-CED-01 | General Training | ✓ | ✓ |
| Education | KSI-CED-02 | Role-Specific Training | ✓ | ✓ |
| Education | KSI-CED-03 | Development Training | ✓ | ✓ |
| Education | KSI-CED-04 | IR/DR Training | ✓ | ✓ |
| Change Mgmt | KSI-CMT-01 | Log and Monitor Changes | ✓ | ✓ |
| Change Mgmt | KSI-CMT-02 | Redeployment | ✓ | ✓ |
| Change Mgmt | KSI-CMT-03 | Automated Testing | ✓ | ✓ |
| Change Mgmt | KSI-CMT-04 | Change Management Procedures | ✓ | ✓ |
| Cloud Native | KSI-CNA-01 | Restrict Network Traffic | ✓ | ✓ |
| Cloud Native | KSI-CNA-02 | Attack Surface | ✓ | ✓ |
| Cloud Native | KSI-CNA-03 | Enforce Traffic Flow | ✓ | ✓ |
| Cloud Native | KSI-CNA-04 | Immutable Infrastructure | ✓ | ✓ |
| Cloud Native | KSI-CNA-05 | Unwanted Activity | ✓ | ✓ |
| Cloud Native | KSI-CNA-06 | Secure Enclaves | ✓ | ✓ |
| Cloud Native | KSI-CNA-07 | Secure Software Factories | ✓ | ✓ |
| Cloud Native | KSI-CNA-08 | Automated Enforcement | | ✓ |
| IAM | KSI-IAM-01 | Phishing-Resistant MFA | ✓ | ✓ |
| IAM | KSI-IAM-02 | Passwordless Authentication | ✓ | ✓ |
| IAM | KSI-IAM-03 | Non-User Accounts | ✓ | ✓ |
| IAM | KSI-IAM-04 | Just-in-Time Authorization | ✓ | ✓ |
| IAM | KSI-IAM-05 | Least Privilege | ✓ | ✓ |
| IAM | KSI-IAM-06 | Session Management | ✓ | ✓ |
| IAM | KSI-IAM-07 | Personnel Security | ✓ | ✓ |
| Incident | KSI-INR-01 | Incident Response Procedures | ✓ | ✓ |
| Incident | KSI-INR-02 | Incident Review | ✓ | ✓ |
| Incident | KSI-INR-03 | After Action Reports | ✓ | ✓ |
| Monitoring | KSI-MLA-01 | SIEM | ✓ | ✓ |
| Monitoring | KSI-MLA-02 | Audit Logging | ✓ | ✓ |
| Monitoring | KSI-MLA-05 | Evaluate Configuration | ✓ | ✓ |
| Monitoring | KSI-MLA-06 | Log Retention | ✓ | ✓ |
| Monitoring | KSI-MLA-07 | Alerting | ✓ | ✓ |
| Monitoring | KSI-MLA-08 | Behavioral Monitoring | | ✓ |
| Policy | KSI-PIY-01 | Automated Inventory | ✓ | ✓ |
| Policy | KSI-PIY-03 | Vulnerability Disclosure | ✓ | ✓ |
| Policy | KSI-PIY-04 | CISA Secure By Design | ✓ | ✓ |
| Policy | KSI-PIY-06 | Media Protection | ✓ | ✓ |
| Policy | KSI-PIY-07 | Records Retention | ✓ | ✓ |
| Policy | KSI-PIY-08 | Maintenance | ✓ | ✓ |
| Recovery | KSI-RPL-01 | Recovery Objectives | ✓ | ✓ |
| Recovery | KSI-RPL-02 | Recovery Plan | ✓ | ✓ |
| Recovery | KSI-RPL-03 | System Backups | ✓ | ✓ |
| Recovery | KSI-RPL-04 | Recovery Testing | ✓ | ✓ |
| Service Config | KSI-SVC-01 | Continuous Improvement | ✓ | ✓ |
| Service Config | KSI-SVC-02 | Network Encryption | ✓ | ✓ |
| Service Config | KSI-SVC-04 | Configuration Automation | ✓ | ✓ |
| Service Config | KSI-SVC-05 | Resource Integrity | ✓ | ✓ |
| Service Config | KSI-SVC-06 | Data Protection | ✓ | ✓ |
| Service Config | KSI-SVC-07 | Federal Data Location | ✓ | ✓ |
| Service Config | KSI-SVC-08 | Malicious Code Protection | | ✓ |
| Service Config | KSI-SVC-09 | Host Intrusion Protection | | ✓ |
| Service Config | KSI-SVC-10 | File Integrity Monitoring | | ✓ |
| Third-Party | KSI-TPR-03 | Supply Chain Risk Management | ✓ | ✓ |
| Third-Party | KSI-TPR-04 | Supply Chain Risk Monitoring | ✓ | ✓ |

**Total: 56 Low Impact KSIs, 61 Moderate Impact KSIs**

---

## Appendix B: Scanner Integration API Reference

See `docs/INTEGRATION_API.md` for detailed connector development guide.

---

*Document maintained by CISO Assistant Development Team*
*Last updated: January 2026*
