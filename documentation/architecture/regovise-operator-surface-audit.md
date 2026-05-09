# Regovise Operator Surface Audit

Date: May 9, 2026

## Goal

Audit the current Regovise interaction architecture to identify operator, admin, recovery, migration, and parity internals that are still exposed to regular users.

This audit treats the desired product posture as:

- Regular users should see a clear compliance-program product.
- Tenant administrators should see setup, access, and integration controls.
- Break-glass recovery should be isolated behind dedicated guarded routes.
- Engineering or migration tooling should not appear in mainstream product navigation or default landing flows.

## Audience Model

### 1. Public / unauthenticated

Allowed:

- Standard sign-in
- First-run initialization only when no tenant exists
- Explicit recovery access only when intentionally requested

Not allowed:

- Bootstrap secret mechanics in the default sign-in page
- Tenant/user population telemetry
- Delivery-mode or auth-mode internals

### 2. Standard authenticated user

Allowed:

- Home
- Program
- Assessments
- Evidence
- Assurance work relevant to their scope
- Personal profile and password management

Not allowed:

- Workspace-wide access control
- System settings
- Connector management
- Migration/parity dashboards
- Engineering control-room routes

### 3. Tenant administrator

Allowed:

- Workspace setup
- Team and permissions
- Security posture
- Branding, email, SSO, MFA
- Evidence sources and monitoring configuration
- Integrations and automation configuration

Not allowed by default:

- Break-glass bootstrap recovery
- Engineering parity workspaces
- Loopback/debug identity switching outside local environments

### 4. Break-glass recovery

Allowed:

- Dedicated guarded recovery route
- Bootstrap-secret-based admin session recovery
- Local password recovery for designated administrator accounts

Not allowed:

- Exposure in the default sign-in flow
- Exposure in authenticated navigation

### 5. Internal / operator / engineering

Allowed:

- Parity and migration inspection
- Legacy route bridges
- Control-room views
- Internal workflow and subsystem consoles
- Deep validation/debug surfaces

Not allowed:

- Inclusion in default landing pages
- Inclusion in standard navigation
- Presentation with user-facing product copy

## Primary Findings

### P1. The default unauthenticated entry point mixes normal sign-in with bootstrap and break-glass recovery.

The current unauthenticated shell always routes users into `BootstrapAccessPanel`, which combines first-tenant initialization, password sign-in, email-code sign-in, bootstrap-secret password recovery, and bootstrap-secret administrator session recovery.

References:

- [apps/web/src/shell/AppLayout.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:233)
- [apps/web/src/features/core/BootstrapAccessPanel.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:425)
- [apps/web/src/features/core/BootstrapAccessPanel.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:443)
- [apps/web/src/features/core/BootstrapAccessPanel.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:734)

Why this matters:

- Regular users are exposed to bootstrap-secret and recovery mechanics.
- The product’s normal sign-in path looks like infrastructure recovery tooling.
- Tenant counts, user counts, and login-delivery posture are shown before authentication.

### P1. The primary sidebar has no audience segmentation and exposes admin and operator surfaces to any authenticated user.

The sidebar is a single static navigation table. It includes standard product areas, tenant-admin areas, and operator-like automation/system areas in one unfiltered shell.

References:

- [apps/web/src/shell/Sidebar.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Sidebar.tsx:48)
- [apps/web/src/shell/Sidebar.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Sidebar.tsx:78)
- [apps/web/src/shell/Sidebar.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Sidebar.tsx:84)

Directly exposed today:

- `Workspace AI`
- `RegML`
- `Response Automation`
- `Evidence Mapping`
- `Workflow`
- `Integrations`
- `Permissions`
- `Workspace Settings`
- `Security`
- `System Settings`

Why this matters:

- A regular scoped user can discover tenant-admin and internal-looking surfaces from the main product nav.
- The product IA still reads like an implementation console rather than a RegScale replacement.

### P1. The Home page still pulls operator/parity feeds into the default product landing experience.

The current home experience calls `/_api/ops/parity/overview` and `/_api/assurance/parity/status`, then uses that data to drive setup posture, package readiness, and navigation choices. It also links directly to analytics and RegML from the default “Useful next places” area.

References:

- [apps/web/src/features/home/HomePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:214)
- [apps/web/src/features/home/HomePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:259)
- [apps/web/src/features/home/HomePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:470)
- [apps/web/src/features/home/HomePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:667)
- [apps/web/src/features/home/HomePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:692)

Why this matters:

- The landing page still assumes users should care about parity status and internal readiness contracts.
- “Operator paths” and assurance-package readiness are presented too early for ordinary end users.
- The main landing page still acts partly like an internal command center.

### P1. The Assurance overview still presents internal “Observable parity” language and operator framing as a mainstream user surface.

The assurance command center includes an `Observable parity` section, parity contracts, parity-ready package counts, and “operator action” phrasing directly in the user-facing workspace.

References:

- [apps/web/src/features/assurance/AssuranceOverviewPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:483)
- [apps/web/src/features/assurance/AssuranceOverviewPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:567)
- [apps/web/src/features/assurance/AssuranceOverviewPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:656)

Why this matters:

- “Observable parity” is an engineering/migration concept, not a product concept.
- Regular assurance users should see package readiness, evidence coverage, review status, and approvals, not parity verification terminology.

## Secondary Findings

### P2. Internal control-room routes are mounted as first-class product routes without audience guards.

The app router mounts control-room and admin-style pages at stable user-visible paths such as `/analytics`, `/search`, `/settings`, `/workflow`, `/utilities`, `/subsystems`, `/rmf`, `/app-management`, and others.

References:

- [apps/web/src/shell/AppLayout.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:521)
- [apps/web/src/shell/AppLayout.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:541)
- [apps/web/src/shell/AppLayout.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:545)
- [apps/web/src/shell/AppLayout.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:553)
- [apps/web/src/shell/AppLayout.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:657)

Why this matters:

- Even if some pages are useful internally, they should not be first-class mainstream routes without role- or audience-based gating.
- Search and analytics currently resolve to control-room pages, not clearly productized user experiences.

### P2. The user menu exposes raw internal identity metadata to all authenticated users.

Even when loopback-only header switching is hidden, the profile menu still shows raw tenant ID, raw user ID, and auth mode to every authenticated user.

References:

- [apps/web/src/shell/Topbar.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Topbar.tsx:281)
- [apps/web/src/shell/Topbar.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Topbar.tsx:292)

Why this matters:

- This is debugging-oriented identity metadata, not normal product UX.
- It contributes to the “admin console” feel of the app.

### P2. Loopback identity switching is correctly environment-scoped, but the shell still treats it as a built-in navigation concern.

The tenant/user switching controls are guarded by `canUseHeaderIdentity()`, which is loopback-only in production. That is good. But the topbar still dedicates space and architecture to debug identity switching in the main shell component.

References:

- [apps/web/src/shared/session/identity.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shared/session/identity.ts:24)
- [apps/web/src/shell/Topbar.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Topbar.tsx:130)
- [apps/web/src/shell/Topbar.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Topbar.tsx:188)

Why this matters:

- The production risk is lower here than on the login page.
- The architectural issue remains: debug concerns live inside the standard shell rather than a dedicated dev/operator shell.

### P2. Legacy bridge and parity routes remain directly reachable and use migration-focused copy.

Legacy bridge routes are still mounted for a wide set of models, and their user-facing copy is explicitly about parity, migration, and legacy route mapping.

References:

- [apps/web/src/shell/AppLayout.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:657)
- [apps/web/src/features/parity/LegacyRouteBridgePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/LegacyRouteBridgePage.tsx:17)
- [apps/web/src/features/parity/LegacyRouteBridgePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/LegacyRouteBridgePage.tsx:381)

Why this matters:

- Useful migration scaffolding is still presented like a product surface.
- These routes should become silent redirects or admin-only migration tooling.

### P2. Integration and automation surfaces are presented as ordinary workspace navigation instead of tenant-admin tools.

The automation manager is productized enough to be useful, but its semantics are still tenant-level connector configuration and operations.

References:

- [apps/web/src/shell/Sidebar.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Sidebar.tsx:78)
- [apps/web/src/features/integrations/AutomationManagerPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx:78)
- [apps/web/src/features/integrations/AutomationManagerPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx:103)

Why this matters:

- Connector setup, sync, and outbound automation are administrative workflows.
- These should sit behind admin navigation and permissions, not general-purpose navigation.

## Route Classification

### Keep public

- `/login` once separated from bootstrap/recovery
- `/setup/initialize` only when no tenant exists
- `/admin/recover` only when intentionally requested

### Keep for standard users

- `/`
- `/program`
- `/assessments`
- `/third-party`
- `/privacy`
- `/resilience`
- `/reports`
- `/evidence-management`
- `/conmon/executions`
- `/assurance`
- `/assurance/evidence`
- `/assurance/tracker`
- `/assurance/packages`
- `/assurance/reviews`
- `/assurance/agent-runs`
- `/workspace/me`

### Tenant-admin only

- `/workspace/access`
- `/setup/*`
- `/evidence/sources`
- `/conmon/profiles`
- `/automation-manager`
- `/response-automation`
- `/evidence-mapping`
- `/chat` if it remains workspace-wide automation rather than end-user assistant UX

### Internal / operator / engineering only

- `/analytics` in its current control-room form
- `/search` in its current control-room form
- `/settings`
- `/workflow`
- `/utilities`
- `/subsystems`
- `/rmf`
- `/app-management`
- `/workbench`
- `/news-feed`
- `/backup-restore`
- `/validation-flows`
- `/x-rays`
- `/${legacyModel}/*` bridge routes
- parity-specific overview and bridge surfaces

## Recommended Remediation Order

### 1. Split authentication and recovery flows.

- Create `/login` for normal sign-in only.
- Create `/setup/initialize` for zero-tenant bootstrap only.
- Create `/admin/recover` for bootstrap-secret recovery only.
- Stop rendering bootstrap and recovery options on the default unauthenticated page.

### 2. Add audience-aware shell navigation.

- Create `standard`, `tenant-admin`, and `internal` navigation groups.
- Filter sidebar items by audience and permission.
- Remove admin and internal surfaces from the default standard-user nav.

### 3. Gate routes, not just navigation.

- Add route guards in `AppLayout` for admin-only and internal-only pages.
- Treat hidden nav as insufficient without route-level enforcement.

### 4. Remove parity and operator language from product entry points.

- Replace `Observable parity`, `parity-ready`, and `operator attention` with product language.
- Move engineering readiness details behind an admin/internal status route.

### 5. Convert legacy bridge pages into silent redirects or admin-only migration tools.

- Normal users should not land on migration explanation pages.
- If a legacy route must survive, route directly into the destination workspace.

## Suggested Definition Of Done

- A normal user can sign in without seeing bootstrap, tenant-count, or recovery internals.
- A normal user cannot discover admin or operator routes from the main nav.
- A normal user cannot open internal/control-room routes directly.
- The home page reads like a compliance operating system, not a migration or parity dashboard.
- Recovery and bootstrap routes exist, but only as isolated guarded flows.
- Debug identity metadata and parity concepts are removed from standard user UX.
