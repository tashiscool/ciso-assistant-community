# Canonical Prompt-Pack Audit

Updated: April 13, 2026

Scope:

- Prompt-pack source: [/Users/tkhan/IdeaProjects/ciso-assistant-community/openregscale/deliverables/regscale-prompt-pack-v1.md](/Users/tkhan/IdeaProjects/ciso-assistant-community/openregscale/deliverables/regscale-prompt-pack-v1.md)
- Canonical stack only: [/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web) + [/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare)

This audit is intentionally stricter than the older `openregscale` validation matrix. A prompt-pack item only counts as truly migrated when it exists as a first-class Regovise route and Cloudflare-backed behavior in the canonical stack.

## Status Definitions

- `Migrated`: shipped in `apps/web` with real Worker behavior in `cloudflare`
- `Parity shell`: present in canonical UX, but still generic/parity-oriented rather than domain-complete
- `Not yet migrated`: still missing as a canonical Regovise feature

## Migrated

- Builders
  - DOCX Template Guide
  - Dashboard Builder
  - Export Builder
  - Form Builder
  - Report Builder
  - Rules Builder
  - Questionnaire Builder
  - Visual Rules Engine
  - Wayfinder Builder
- Governance / core platform
  - Actors
  - My Access
  - Domains
  - Team
  - Access Control
  - Setup / Tags
  - Setup / Service Accounts
  - Setup / Modules and Features
  - Setup / SSO
  - Setup / MFA
  - Setup / Logs and Utilization
  - Setup / Security
  - Libraries
  - Frameworks
  - Policies
  - Assessments
- AI / export family
  - AI Policy Builder
  - Compliance Exports
  - Compliance Exports / eMASS child views
  - Compliance Exports / FedRAMP child views
  - RegML (AI)
  - Control AI Features
  - RegML Author
  - RegML Explainer
  - SSP AI Features
  - RegML SSP Author
  - RegML Auditor
  - AI Generator
  - Response Automation
  - Evidence Mapping
- Risk / operational domains
  - Analytics
  - Assets
  - Asset Assessments
  - Backup / Restore
  - Calendar
  - Dashboards
  - Incidents
  - Search
  - Security Exceptions
  - Third Party
  - Privacy
  - Resilience
  - Evidence Management
  - Evidence Sources
  - Evidence Jobs
  - ConMon Profiles
  - ConMon Runs
  - Reports
  - Chat
  - Imports
  - Library mapping / sync mapping style surfaces
  - Program / recap-style surfaces
  - Quick Start
  - Settings
  - Task Nodes
  - Task Templates
  - Validation Flows
  - Vulnerabilities
  - Workflow
  - Workbench
  - News Feed
  - Utilities
  - Subsystems
  - RMF
  - App Management
  - X-Rays
  - Auditee Portal
  - EBIOS RM
  - Quantitative Risk
- Prompt-pack feature tranche completed in this pass
  - Automation Manager

## Parity Shell

No prompt-pack routes remain in parity-shell-only status in the canonical app.

A few promoted operational surfaces still share the common Worker overview payload rather than fully separate domain-specific service namespaces, but they now exist as first-class canonical Regovise routes rather than generic bridge pages.

## Not Yet Migrated

No prompt-pack routes remain un-migrated in the canonical stack.

## Cloudflare Readiness Notes

What is true today:

- Every `Migrated` item above is grounded in the canonical Cloudflare stack.
- Canonical setup endpoints are now enforced as a root-scoped admin surface rather than open tenant reads.
- Canonical IAM admin routes and `Automation Manager` now use the same root-scoped admin gate.
- Canonical `Evidence` and `ConMon` services now enforce IAM permissions beyond mere tenant/session presence:
  - `view_evidence` / `collect_evidence` for evidence reads and mutations
  - `view_conmon` / `run_conmon` for continuous monitoring reads and mutations
- Canonical `Builders` and AI governance surfaces now also enforce real IAM permissions:
  - builder reads require `view_framework` or stronger framework-management permissions
  - builder mutations require framework-management permissions
  - AI policy / RegML / compliance-export family reads require `view_framework` or stronger framework-management permissions
  - AI policy / RegML / compliance-export family mutations require framework-management permissions
  - AI evidence-mapping stays aligned to evidence permissions rather than the framework permission family
- Canonical `ops` surfaces now follow the same permission-family model instead of relying on tenant/session presence alone:
  - workflow, utilities, workbench, news feed, chat, and imports require operational workspace permissions
  - reports, RMF, and app management align to framework permissions
  - EBIOS RM and quantitative risk align to risk permissions
  - the auditee portal now uses actor-safe authorization semantics:
    - internal users need framework-view/framework-management permissions
    - auditee users can only access assignments whose `actor_email` matches their signed-in identity
- Canonical `core` routes now also enforce real permission families instead of relying on tenant/session presence alone:
  - libraries, frameworks, compliance assessments, and applied controls align to framework permissions
  - perimeters align to folder-management permissions
  - risk registers, scenarios, and risk assessments align to risk permissions
  - third-party entities, solutions, contracts, and entity assessments align to TPRM permissions
  - processings, right requests, and data breaches align to privacy permissions
  - business impact analyses align to resilience permissions
- The Worker now includes dedicated service namespaces for:
  - `core`
  - `iam`
  - `evidence`
  - `conmon`
  - `ops`
  - `builders`
  - `integrations`
  - `setup`
  - `ai`
- The new `Automation Manager` slice is backed by:
  - [/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/migrations/0011_integrations_connectors.sql](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/migrations/0011_integrations_connectors.sql)
  - [/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/integrations/http.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/integrations/http.ts)
  - [/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx)

What is not yet true:

- The canonical stack now satisfies the prompt-pack route coverage bar, but not the broader production-hardening bar.
- The canonical stack still has production-hardening work left, but the builder, operations, setup/admin, and AI/export prompt-pack families now exist as first-class Cloudflare-native surfaces.
- The canonical AI family now supports optional Workers AI and Vectorize-backed execution with deterministic fallback for environments where those bindings are not provisioned.
- The canonical permission model is stronger now, but several core query paths still need folder/domain-scope filtering so scoped roles do not automatically expand to tenant-wide reads for every row family.

## Recommended Next Tranches

1. Production-hardening depth
   - continue moving shared overview payloads toward deeper domain services where needed
2. Setup/admin depth beyond prompt-pack minimums
   - keep broadening the canonical setup surface beyond the minimum route-complete migration set
   - email delivery, branding, classification, general tenant controls, and risk-model configuration are now canonical
   - canonical session bootstrap now exchanges demo/dev identity headers for D1-backed `ca_session` cookies, and production prefers cookie auth over direct identity headers outside the dedicated session-exchange route
   - the canonical stack now also includes a guarded first-run bootstrap and admin recovery path for empty production tenants, backed by `BOOTSTRAP_SETUP_SECRET`
   - canonical local sign-in now supports D1-backed one-time email codes for users marked with `keep_local_login`, with production delivery gated on the configured email provider and dev environments falling back to preview codes when delivery is intentionally disabled
   - canonical local sign-in also supports D1-backed password credentials for `keep_local_login` users, including guarded bootstrap-side password initialization, normal cookie-session sign-in on production, authenticated self-service password rotation in `My Access`, and tenant-admin temporary-password provisioning in `Team & Groups`
   - next likely slices are scope-aware folder/domain filtering across the core services and broader first-party identity options beyond bootstrap/admin recovery, local email codes, and local password sign-in

## Bottom Line

The canonical stack is meaningfully further along now, but it is still in migration.

The truthful summary today is:

> Regovise is live on Cloudflare, all prompt-pack route families now exist as first-class canonical routes in `apps/web + cloudflare`, and the remaining work is deeper production-hardening rather than missing prompt-pack pages.
