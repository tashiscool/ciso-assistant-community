# Security Operating Model Guide

A practical guide for mapping CISO Assistant capabilities to a structured security operating model.

---

## 1. Introduction

A security operating model defines how an organization discovers, manages, and governs its security posture on an ongoing basis. Without one, security work fragments into disconnected activities: vulnerability scans pile up in one tool, risk registers live in spreadsheets, compliance evidence sits in shared drives, and nobody has a single view of where the organization stands.

CISO Assistant implements a five-role operating model that gives every security activity a clear home:

- **Truth** -- What do we have? Assets, boundaries, system groupings.
- **Signals** -- What is wrong? Scanners, configuration drift, access reviews, detection health.
- **Actions** -- What are we doing about it? Remediation plans, control implementation, risk treatment.
- **Governance & Response** -- Are changes safe, exceptions tracked, incidents handled? Policies, change control, exception management, incident response.
- **Gates** -- Did we pass? Are we authorized? Assessments, risk acceptance, authorization to operate.

Each concern has exactly one owner. No feature serves double duty. When you know which role a question belongs to, you know which part of CISO Assistant answers it.

---

## 2. The Continuous Posture Loop

Security posture is not a point-in-time snapshot. It is a continuous loop where each stage feeds the next.

```
    +----------+      +-----------+      +-----------+
    |  TRUTH   | ---> |  SIGNALS  | ---> |  ACTIONS  |
    | (Assets, |      | (Scans,   |      | (POA&M,   |
    |  Boundary)|     |  Drift,   |      |  Controls,|
    +----------+      |  Reviews) |      |  Treatment|
         ^            +-----------+      +-----------+
         |                                     |
         |                                     v
    +----------+                        +-------------+
    |  GATES   | <--------------------- | GOVERNANCE  |
    | (Assess, |                        | & RESPONSE  |
    |  Authz)  |                        | (Policy,    |
    +----------+                        |  Change,    |
         |                              |  Exceptions,|
         +--- findings feed back -----> |  Incidents) |
              into Signals              +-------------+
```

**Data flow:**

1. **Truth** establishes what exists: assets, perimeters, system groups, and their relationships.
2. **Signals** discover what is wrong with what exists: vulnerability scans, configuration drift, access anomalies, detection gaps, certificate expirations.
3. **Actions** address what Signals found: POA&M items track remediation, AppliedControls implement fixes, risk treatments make deliberate accept/mitigate/transfer/avoid decisions.
4. **Governance & Response** wraps Actions in process: policies set expectations, change control ensures modifications are safe, exceptions formalize accepted deviations, and incident response handles active threats.
5. **Gates** evaluate whether everything above is sufficient: compliance assessments score against frameworks, risk assessments quantify residual risk, findings assessments capture pen test results, and risk acceptance grants authorization to operate.

Gate results feed back into Signals (new findings, re-assessment triggers) and the loop continues.

---

## 3. Feature-to-Role Mapping

This table is the core reference. It maps every operating model concern to the CISO Assistant feature that owns it.

| Role | Operating Model Item | CISO Assistant Feature | Status |
|------|---------------------|----------------------|--------|
| **Truth** | Asset inventory & boundary definition | Asset, Perimeter, AssetCapability models | Complete |
| **Truth** | System grouping & categorization | SystemGroup, AssetClass hierarchies | Complete |
| **Signal** | Vulnerability scans | 23+ Connectors (Nessus, Qualys, Snyk, AWS, etc.) + Finding/Vulnerability models | Complete |
| **Signal** | Baseline & configuration drift | ConMon validation + STIG checklists + RMF baselines | Partial |
| **Signal** | Access reviews | AccessReview model -- periodic attestation of user access rights | New |
| **Signal** | Telemetry & detection health | DetectionRule model -- coverage mapping of logging/alerting per asset | New |
| **Signal** | Backup & restore testing | Asset RTO/RPO/MTD fields + BCP test routes | Partial |
| **Signal** | Crypto & secret hygiene | CryptoAsset model -- certificate/key inventory with expiration tracking | New |
| **Action** | Patches & remediation | POA&M system + AppliedControl with ETA tracking | Complete |
| **Action** | Control implementation | AppliedControl lifecycle, reference control mapping | Complete |
| **Action** | Risk treatment | RiskScenario treatment options (accept, mitigate, transfer, avoid) | Complete |
| **Governance** | Policy management | Policy model (inherits AppliedControl) | Complete |
| **Governance** | Managed change control | SignificantChangeRequest (15 change types, SCN categories, full lifecycle) | Complete |
| **Governance** | Exception management | SecurityException with approval workflow | Complete |
| **Response** | Incident response | SecurityIncident (general + FedRAMP/US-CERT models) | Complete |
| **Response** | Incident timeline | TimelineEntry for chronological incident tracking | Complete |
| **Gate** | Compliance assessment | ComplianceAssessment with RequirementAssessment scoring | Complete |
| **Gate** | Risk assessment | RiskAssessment with scenario-based analysis | Complete |
| **Gate** | Findings assessment | FindingsAssessment for pen test / audit findings | Complete |
| **Gate** | Authorization to operate | RiskAcceptance approval workflow + RMF ATO | Complete |

**Status key:**

- **Complete** -- Feature is fully implemented with API, models, and frontend routes.
- **Partial** -- Core models exist; additional integration or UI work is planned.
- **New** -- Model is defined or planned; not yet wired into the full stack.

---

## 4. No-Overlap Cheat Sheet

Each concern has exactly one owner. This table makes the boundaries explicit so teams do not duplicate work or look in the wrong place.

| Concern | Owner | Not handled by |
|---------|-------|---------------|
| "What do we have?" | Asset + Perimeter (Truth) | Not in Signals or Actions |
| "What's wrong?" | Connectors + Findings (Signal) | Not in Actions or Governance |
| "What are we doing about it?" | POA&M + AppliedControl (Action) | Not in Signals or Gates |
| "Is the change safe?" | SignificantChangeRequest (Governance) | Not in Actions |
| "Are exceptions tracked?" | SecurityException (Governance) | Not in Risk Acceptance |
| "Did we pass?" | Assessments (Gate) | Not in Signals |
| "Are we authorized?" | RiskAcceptance / ATO (Gate) | Not in Actions |

**Why this matters:** When a vulnerability scanner finds an issue, the finding lives in Signals. The remediation plan lives in Actions (POA&M). The assessment of whether remediation is sufficient lives in Gates. If you blur these boundaries, you end up with findings that are also remediation plans, or assessments that try to track remediation progress -- and the data model breaks down.

---

## 5. The Change Wrapper

Any modification to your environment that could affect security posture should go through managed change control. CISO Assistant implements this through the `SignificantChangeRequest` aggregate.

### The 15 Change Types

The SignificantChangeRequest model covers all categories of change that could alter your security boundary or control effectiveness:

1. **Authorization Boundary Change** -- Expanding or contracting what is in scope
2. **Technology/Architecture Change** -- Swapping or adding infrastructure components
3. **Key Personnel Change** -- Changes to security-critical roles
4. **Process/Procedure Change** -- Operational workflow modifications
5. **Third-Party Vendor Change** -- Adding, removing, or replacing vendors
6. **Data Flow Change** -- Altering how data moves between systems
7. **Encryption Change** -- Modifying cryptographic implementations
8. **Authentication/Access Control Change** -- Changes to identity and access management
9. **Network Architecture Change** -- Network topology modifications
10. **Data Storage Change** -- Where and how data is stored
11. **Interconnection Change** -- System-to-system connection changes
12. **Physical Security Change** -- Physical access or environmental changes
13. **Incident Response Change** -- Modifications to IR procedures
14. **Contingency Planning Change** -- BCP/DR plan modifications
15. **Other Change** -- Anything not covered above

### SCN Categories

For organizations operating under FedRAMP, changes may trigger a Significant Change Notification (SCN). The model supports eight SCN categories:

- Category 1: Authorization Boundary
- Category 2: Services/Features
- Category 3: Architecture
- Category 4: Interconnections
- Category 5: Cryptographic Modules
- Category 6: Control Implementation
- Category 7: Key Personnel
- Category 8: Physical Environment

### How Changes Trigger Re-Assessment

The change lifecycle follows a strict progression:

```
Draft --> Submitted --> Impact Analysis --> Impact Assessed
                                               |
                                    +----------+----------+
                                    |                     |
                              SCN Required          SCN Not Required
                                    |                     |
                              SCN Submitted               |
                                    |                     |
                              SCN Acknowledged            |
                                    |                     |
                                    +----------+----------+
                                               |
                                           Approved --> Implemented --> Verified
```

When a change is implemented, it can trigger re-assessment in the Gates layer. The `affected_control_ids` and `affected_ksi_ids` fields on each change request identify which controls and key security indicators need re-evaluation. This closes the loop: a change in Governance feeds back into Gates, which may generate new Signals.

---

## 6. The Exception Loop

Not every control can be fully implemented at all times. The `SecurityException` model provides a formal mechanism for tracking accepted deviations from policy or control requirements.

### Exception Lifecycle

```
Draft --> In Review --> Approved --> [Active until expiration] --> Expired
                  \                                           \
                   --> Resolved (early closure)                --> Deprecated
```

The statuses are:

- **Draft** -- Exception is being documented; not yet submitted for review.
- **In Review** -- Exception has been submitted and is awaiting approval.
- **Approved** -- Exception is active; the deviation is formally accepted.
- **Resolved** -- The underlying issue has been fixed; the exception is no longer needed.
- **Expired** -- The expiration date has passed; the exception must be re-reviewed.
- **Deprecated** -- The exception is no longer relevant (e.g., the system was decommissioned).

### Relationship to Controls and Risk

Each SecurityException can be linked to:

- **AppliedControls** -- Which controls are affected by the exception
- **RequirementAssessments** -- Which compliance requirements are impacted
- **Owners** -- Who is responsible for the exception
- **Approver** -- Who authorized the deviation
- **Severity** -- How significant the exception is

### Expiration and Re-Review

Every exception has an expiration date. The system enforces that expiration dates must be in the future at creation time. When an exception expires, it transitions to "Expired" status, which signals that the team must either:

1. Remediate the underlying issue (move to Resolved)
2. Submit a new exception with a new expiration date
3. Deprecate the exception if no longer applicable

This prevents exceptions from becoming permanent, unreviewed deviations.

---

## 7. Periodic Gates: Assessment and Authorization

Gates are the checkpoints where the organization evaluates whether its security posture is adequate. CISO Assistant provides four gate types, each serving a distinct purpose.

### ComplianceAssessment

A ComplianceAssessment evaluates the organization against a specific framework (e.g., NIST 800-53, ISO 27001, SOC 2). It contains RequirementAssessment records -- one per framework requirement -- each scored for compliance status. These assessments answer the question: "Do our controls satisfy the requirements of this framework?"

**Cycle:** Typically annual for certification frameworks, quarterly for continuous monitoring frameworks.

### RiskAssessment

A RiskAssessment evaluates risk scenarios against a risk matrix. Each RiskScenario within the assessment maps threats and vulnerabilities to assets, producing likelihood and impact scores. These assessments answer the question: "What is our residual risk after controls are applied?"

**Cycle:** At least annually, or whenever significant changes occur (triggered by the Change Wrapper).

### FindingsAssessment

A FindingsAssessment captures results from penetration tests, security audits, or other point-in-time evaluations. It categorizes findings (pen test, audit, undefined) and tracks their disposition. These assessments answer the question: "What did the testers or auditors find?"

**Cycle:** Annually for pen tests (or per regulatory requirement), ad hoc for audits.

### Authorization (RiskAcceptance)

RiskAcceptance is the final gate. It represents a formal decision by an authorizing official that the residual risk -- as documented by the assessments above -- is acceptable. The approval workflow progresses through: Created, Submitted, Accepted (or Rejected), and Revoked.

For RMF-governed systems, this maps directly to the Authorization to Operate (ATO) decision.

**Cycle:** Tied to assessment cycles; re-authorization is required when significant changes occur or when the current authorization expires.

### How Gates Feed Back into Signals

Gate results do not exist in isolation. When an assessment identifies a gap:

- A ComplianceAssessment gap becomes a finding that feeds into POA&M (Action layer)
- A RiskAssessment with unacceptable residual risk triggers new control requirements (Action layer)
- A FindingsAssessment produces findings that need remediation tracking (Action layer)
- A denied RiskAcceptance sends the system back through the loop

Each of these outputs becomes a new Signal for the next iteration of the posture loop.

---

## 8. Getting Started Checklist

For teams adopting CISO Assistant, follow this sequence to build out your operating model layer by layer.

### Step 1: Define Your Truth

- [ ] Create your organizational folder structure (domains/projects)
- [ ] Register assets in the Asset model (servers, applications, data stores, endpoints)
- [ ] Define perimeters to establish authorization boundaries
- [ ] Set up AssetClass hierarchies if you have complex categorization needs
- [ ] Document asset capabilities (confidentiality, integrity, availability requirements)

### Step 2: Connect Your Signals

- [ ] Configure connectors for your vulnerability scanners (Nessus, Qualys, Snyk, etc.)
- [ ] Run initial scans to populate Finding and Vulnerability records
- [ ] Set up ConMon validation if operating under FedRAMP or RMF
- [ ] Document RTO/RPO/MTD values on critical assets for BCP signal coverage
- [ ] Plan for access review and detection rule coverage as those features mature

### Step 3: Track Your Actions

- [ ] Create POA&M items for known open vulnerabilities and audit findings
- [ ] Map AppliedControls to reference controls from your chosen framework(s)
- [ ] Set ETA dates on all POA&M items and AppliedControls for tracking
- [ ] Document risk treatment decisions on each RiskScenario (accept, mitigate, transfer, avoid)

### Step 4: Establish Governance

- [ ] Create Policy records for your security policies (these inherit from AppliedControl)
- [ ] Define your change control process using SignificantChangeRequest
- [ ] Set up SecurityException workflows with appropriate approvers
- [ ] Configure incident response procedures using SecurityIncident models
- [ ] Ensure all governance records have assigned owners

### Step 5: Run Your Gates

- [ ] Create a ComplianceAssessment against your primary framework
- [ ] Score each RequirementAssessment within the compliance assessment
- [ ] Run a RiskAssessment using your organization's risk matrix
- [ ] Create FindingsAssessments for pen test and audit results
- [ ] Submit RiskAcceptance for authorizing official review
- [ ] Review gate outputs and feed gaps back into Steps 2-4

### Ongoing

- [ ] Re-run the loop on your chosen cadence (quarterly or monthly recommended)
- [ ] Use SignificantChangeRequest for any change that could affect posture
- [ ] Review and renew or resolve SecurityExceptions before they expire
- [ ] Update Truth (assets and boundaries) as the environment changes

---

## Summary

The operating model is simple: know what you have (Truth), know what is wrong (Signals), fix it (Actions), govern the process (Governance & Response), and prove it (Gates). CISO Assistant provides a feature for each of these roles, with clear boundaries between them. Start with Truth, build outward, and let the continuous posture loop keep your organization secure.
