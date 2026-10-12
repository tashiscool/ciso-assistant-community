# Regovise frontend: shell, compliance, risk, evidence, assurance, provider workflows

Source audit of the current working tree on 2026-10-11. This report describes implementation in `apps/web`, including local uncommitted work. It is not proof that the code is deployed to regovise.com, that every external connector is configured, or that every screen has been visually exercised. No product files were edited and no production systems or secret files were accessed. The companion maps cover the backend and extended frontend areas.

## Runtime and state model

The canonical React app starts at [main.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/main.tsx:7): React 18 `StrictMode`, React Router `BrowserRouter`, then `AppLayout`. There is no Redux, React Query, or other central data store in this package. Most pages own their data, loading/error/success states, selected records, and forms with React hooks, call the API from effects, and reload or update arrays after mutations. `apps/web/package.json` declares React, React Router, Radix primitives, Lucide icons, Tailwind, and Vite; its discovered validation commands include `build`, `typecheck`, `verify:a11y-tokens`, `verify:ia-shell`, and `verify:responsive`.

[AppLayout](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:343) controls session establishment, permission loading, shell visibility, public response rendering, all explicit routes, route guards, aliases, and fallback routes. `/vanta-clone*` bypasses this shell at [line 978](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:978); this is a separate imitation surface, not the canonical Home page.

[ApiClient](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shared/api/client.ts:7) defaults to `VITE_API_BASE_URL` or `/_api`, sends JSON and `credentials: include`, optionally adds tenant/user identity headers in local header-auth mode, and throws server `message`/`error` or raw response text on non-2xx. It assumes successful responses are JSON. There is no shared cancellation, caching, retry, global notification queue, optimistic mutation framework, or streaming layer. The direct auth/session fetches deliberately use fixed `/_api` paths rather than this configurable client.

Persistence distinctions:

- **Server records:** CRUD, evaluation, review, import, package, and provider operations call HTTP endpoints; backend D1/R2/queue/workflow behavior is traced in the backend map. Screen data usually comes from those calls rather than hardcoded lists.
- **URL state:** assurance workbenches encode selected job/import/package/recommendation/decision/run, artifact family, audience, focus, step, policy, and writeback context in query parameters, allowing cross-screen handoffs.
- **Browser persistence:** tenant/user/auth-mode preferences live in localStorage, local session suppression/migration flags in sessionStorage, coach-mark dismissal in localStorage. These are UI/session preferences, not business truth.
- **Transient UI:** input drafts, filters, tabs, selected drawer records, open dialogs, busy flags, and success banners mostly disappear on navigation/reload. Sidebar collapse/open-group state is transient, not persisted.
- **Placeholders:** several prominent actions only set local notices or redirect to existing workspaces; these are called out below.

## Session, first-run access, and account journey

[useSessionBootstrap](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shared/session/useSessionBootstrap.ts:32) exchanges local identity headers for a cookie session at `POST /core/session/exchange`, or checks `GET /core/session`. On a development/loopback origin it can auto-migrate an anonymous preview to the demo header identity once per browser session. [identity.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shared/session/identity.ts:42) only enables headers for Vite development or loopback hosts; its defaults are `tenant-demo`/`user-demo` unless compile-time defaults override them. Identity changes emit a browser event and most domain pages refetch.

After authentication the layout loads `GET /iam/me` before exposing the navigation. It derives permissions and temporary-password posture. While waiting it shows “Establishing workspace session” or “Preparing your workspace”. An unauthenticated request preserves its path in `?next=`, reads `GET /core/bootstrap/status`, and routes to `/login` or `/setup/initialize`. Errors checking bootstrap status fall back to initialized/login. `/logout` and auth entry with `reauth=1` delete the session, reset local identity to anonymous, and route to sign-in. An unauthenticated `/questionnaires/response/:shareToken` attempts to render the public questionnaire without the workspace shell. However, this branch mounts `QuestionnaireResponsePage` outside a matched `Route`, so `useParams()` supplies no share token and the page remains in its initial loading state; the authenticated Route supplies the parameter correctly. The root browser audit reproduced this on a local suppressed-anonymous session and observed no questionnaire API request. [Layout branches](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:392).

| Route / screen | UI and implemented interaction |
| --- | --- |
| `/login` → `BootstrapAccessPanel(surface="login")` | Workspace slug, tenant-specific login posture, selectable password/email-code/SSO methods when allowed. Password uses email/password; email code request switches to verification step, shows expiry and local preview code if returned, and permits resend; SSO redirects to the provider URL. Busy/error/notices and disabled-method states are explicit. |
| `/setup/initialize` → same panel, initialization surface | Workspace name/slug, administrator name/email, configured bootstrap secret. POST creates first workspace/admin session; the slug derives from workspace name. Existing initialization, disabled bootstrap mode, and unavailable-method states have routing instructions. |
| `/admin/recover` → same panel, recovery surface | Workspace slug, admin email, bootstrap secret; establish admin session or set matching new local password/confirmation. These are real API operations, not a normal self-service forgotten-password email flow. |
| `/auth/callback` → `SsoCallbackPage` | Reads provider code/state/error, exchanges through POST `/core/sso/callback`, updates identity/session, and returns to the server-provided next path. Role/email mismatch errors add workspace/provisioned-email guidance. |
| `/workspace/me`, `/my-profile` → `MePage` | Identity/session/permission/domain metrics; direct and group-inherited roles; groups; domain-level permission lists. If local login is enabled, password configured/reset/lock posture and current/new/confirmation form; POST `/core/local-auth/set-password`, then reload. If disabled, the UI explains workspace-managed SSO. |

Auth operation sources: [panel data/config](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:176), [session completion](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:326), [initialize/recovery/login actions](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:361), [SSO callback](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/SsoCallbackPage.tsx:29), [My Access](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:19).

The temporary-password banner is advisory, linking to My Access; the frontend does not force all other routes closed until rotation. The layout only reloads that flag when identity/session changes, whereas My Access reloads its own payload after password update.

## Shell, navigation, design system, and responsive behavior

[iaNavigation.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/iaNavigation.ts:74) is the source of truth for 13 navigation groups, audience labels, route preservation labels, aliases, and search metadata:

| Navigation group | User-facing destinations |
| --- | --- |
| Home | Home; Find anything; Analytics |
| Starter Guide | Starter Guide / guided setup, admin |
| Work Queue | My Access; Tasks; Findings; Review Queue |
| Compliance | Overview; Frameworks; Framework Library; Libraries; Modules; Controls; Assessments and Tests; Gap Assessments; Policies; Documents and Evidence; Audit Packages |
| Risk | Risk Library; Risk Register; Action Tracker; Threat Models; EBIOS RM; Quantitative Risk; Incidents; Exceptions |
| Evidence and Assurance | Evidence Workspace; Collection Jobs; Monitoring Runs; Assurance Overview; Evidence Explorer; Tracker Workbench; 20x Packages; Agent Runs |
| Vendors and Trust | Vendors; External Portal; Questionnaires; Trust Center (admin) |
| Assets and Systems | Assets; Components; Interconnections; Supply Chain; Integrations (admin) |
| People and Access | People; Access; SSO; MFA; Service Accounts, all admin |
| Privacy and Resilience | Privacy; Resilience; Incidents; Exceptions |
| Reports and Exports | Reports; DORA ROI; Report Bundles; Report Builder; Compliance Exports (admin) |
| Automation and Builders | Workspace AI; Workbench; Workflow; Utilities; Subsystems; News Feed; Builder Launcher; Response Automation; Evidence Mapping; AI Authoring; Form/Rules/Export/Dashboard/Questionnaire/Wayfinder builders; Imports; later items admin |
| Admin | Workspace Settings; Security; Scope; Tags; Classification; Modules and Features; Risk Model; Evidence Sources; Monitoring Profiles; GRC Content and AI; Scrutiny Engine; Platform Settings |

These are a role-filtered menu, not 13 independently implemented products. Many destinations use the shared module workspace or control pages traced in the extended map. “Modules” is explicitly a legacy-route navigation item. Incidents/exceptions appear in two groups; Review Queue is in Work Queue, while other assurance work lives in Evidence and Assurance.

[shellAccess](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/shellAccess.ts:148) derives capabilities from permission strings, not role names. Any user/group/role/folder write permission yields workspace-admin navigation. Framework permissions unlock libraries/frameworks/compliance/reports; risk-register/scenario permissions unlock risk/advanced-risk; evidence permissions unlock evidence/assurance; ConMon, TPRM, privacy and BIA permissions unlock their areas. Any framework/risk/evidence/ConMon permission unlocks operations/search/analytics/program/modules/chat. Auditees can use the portal. The combined Assessments workspace requires both framework and risk permission. The fallback route prefers Program, Assurance, Portal, Frameworks, then other domain workspaces, ending at My Access. Direct route denials render [RouteAccessBoundary](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/RouteAccessBoundary.tsx:48), with requested route, explanation, Home/recommended-area/My Access actions.

[Sidebar](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Sidebar.tsx:301) shows a sticky 292 px expanded sidebar at `xl` (1280 px+) with a user-controlled 76 px collapsed option. Between `md` and `xl` (768–1279 px), it is always a 76 px icon rail. That rail has one icon per group, links only to the group's first visible route, and uses tooltips; it is not an expandable submenu. Below 768 px, Topbar's hamburger opens a 292 px overlay drawer with backdrop and close button, and navigating closes it. Home/Starter Guide/Work Queue/Compliance start expanded; active groups automatically open. Route aliases are canonicalized for active menu highlighting.

The brand header says “Regovise / Workspace console / Staging” regardless of environment. The expanded sidebar's “Help… ⌘+K” pill links to `/search`; its footer explicitly mentions the IA migration and “Vanta-like rhythm.” These are actual product-copy remnants.

[Topbar](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Topbar.tsx:108) is sticky, shows route-segment breadcrumbs, search, a bell, account dropdown, and local-admin Preview tools. Breadcrumbs are plain spans rather than navigable links; unknown segments show raw IDs/slugs. Account menu goes to Profile/My Access, permitted platform/workspace settings, and actual sign-out. Local Preview tools can choose user/tenant and exchange identity; they load `/iam/users` only when allowed and offer demo identity reset. Profile fallback is user ID or loaded preview user. Search button navigates to `/search` and advertises Cmd+K; no keyboard shortcut is registered by Topbar/Sidebar. The bell has a hardcoded notification dot and no click handler or feed.

[styles.css](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/styles.css:5) defines a light-only lavender/purple design system, Avenir Next/Segoe UI/sans font stack, purple primary buttons, green success, amber warning, red danger, panels/cards/metrics/notices, 44 px minimum primary/secondary buttons, focus rings, min-width containment and word wrapping. Many older pages still mix heavily rounded panels and raw HTML forms/tables with newer compact primitives. [PagePrimitives](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/components/regovise/PagePrimitives.tsx:39) centralizes responsive page headers, scrollable tabs, stacked-to-horizontal filter bars, tables, status pills, contextual menus, modal/drawer/sheet patterns. Right drawers fill mobile viewport and become at most 520 px on desktop; modals max at 90dvh; mobile sheets at 86dvh. Radix supplies dialogs/dropdowns/selects/tabs/avatars/tooltips. The generic [DataTable](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/components/ui/data-table.tsx:42) searches currently loaded row fields client-side, shows five skeleton rows, empty state and count, and permits row clicks; it has no sort or pagination.

[CoachMarksPanel](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/components/CoachMarksPanel.tsx:38) is an inline quick guide rather than a target-attached tour. It renders sequential cards, optional links and hide/show controls; dismissal keys use `regovise.coachmarks.<page-key>` in localStorage and are not tenant-specific. Assurance, Home, My Access and other workspaces use it.

Responsive source support is not equivalent to an accessibility audit. The custom mobile sidebar uses a plain overlay and no explicit focus trap/Escape handling; the icon rail limits discoverability; native draggable control cards have no keyboard-drag equivalent in source. Some older tables have `overflow-hidden` without horizontal-scroll wrappers, unlike updated `RegTableShell` screens. See browser verification report for runtime results.

## Home / dashboard

`/` renders [HomePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:301), not `DashboardPage`. It requests permission-appropriate `/core/overview`, `/assurance/overview`, and admin `/ops/parity/overview` plus `/assurance/parity/status` in parallel. A failure in any requested call fails the combined Home load. It displays skeletons initially and an error notice on failure.

[Home stage logic](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:208) chooses setup when an admin lacks domains/users/roles/frameworks or the first three quick-start completions; assurance when enabled and actual package/review/writeback/agent/evidence/ConMon signals exist; portal for portal-only users; program for other program capabilities; otherwise basic workspace. Home's content then presents program-health progress, four summary cards, prioritized work, stage guidance, workspace jump links, journey cards, and admin readiness warnings. For users with `/tasks` access the primary CTA is always “Open Work Queue,” with stage action moved to secondary. Setup work comes from unfinished quick-start steps; assurance work is pending reviews/writebacks, mismatches and validation drift; program work highlights assessment/vendor/privacy/resilience entry points; portal-only users see assignment and account entry points.

The Home “Program health” percentage is a heuristic: admin quick-start completion; otherwise 100 when assurance signals exist, 65 with assessments, or 25. “Active assessments” metrics count all core risk/compliance records, not a filter by active status. Those are UI summaries, not an independently calculated continuous-control compliance score. [metrics/progress](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:615).

[DashboardPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:155) is retained source with core health/overview/bootstrap metrics and a demo bootstrap action, but there is no import or route to it in current AppLayout. It should not be described as an active production dashboard.

## Catalogue and reference-library workflow

| Screen | Layout, data, and actions | Boundary |
| --- | --- | --- |
| Frameworks / Catalogues Workspace | [FrameworksPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:144): installed catalogues table, source-of-truth summary, packaged catalogue import cards, switch between system and file imports, drag/drop or browse JSON file preview, custom catalogue creation. Loads core frameworks, GRC packaged library (optional), and `/iam/me`; checks framework write permissions before enabling import/create. Creates key/name/version/category; imports a packaged ID or parsed file payload through `/core/frameworks/import/system` or `/file`, then reloads. | File parsing/previews are local; installation/custom creation persists. Only JSON is parsed; supporting labels/formats should be checked against actual parser. Source preview accepts several nested metadata/control structures. |
| Framework / catalogue detail | [FrameworkDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:16): metadata/requirement-count header, coverage cards, requirement tree and flat requirement table. Add requirement right drawer (reference/title/description) POSTs `/core/frameworks/:id/controls` and reloads all three detail calls (record, controls, tree). | Creates one assessable requirement. No frontend editing/deleting/reordering existing requirements here. Add button itself is not independently gated by write permission. |
| Libraries list | [LibrariesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx:13): core packaged/loaded library cards with name/provider/version/description/status and detail links. | Read-only list, no import/delete action in this screen. |
| Library detail | [LibraryDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:24): metadata/provider/packager/version/update status, publication/dependencies/copyright, linked framework, recursive reference tree, risk-matrix scoring levels, threats/severity and reference-control tables. | Read-only packaged/reference content. `FrameworkTree` recurses through visible nodes and counts assessable nodes; it is not an editable tree widget. |
| Catalogue / Framework Library | [FrameworkLibraryPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:16): overview counts, snapshot status, client search over name/SCF/tags, managed-content cards. Admin capabilities permit packaged snapshot import after review modal, enqueue/wait/reload. | This GRC knowledge corpus differs from installed tenant core frameworks and core libraries; not every similarly titled library view is the same data store. |
| Framework knowledge detail | [FrameworkKnowledgeDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx:20): metadata, document-kind counts, selectable documents and Markdown source shown as whitespace-preserving plain text; crosswalk control lookup with SCF controls and target obligations. | Read-only content/SCF resolution; document text is rendered as plain preformatted text, not a rich Markdown editor. |

The dominant journey is packaged knowledge → install core framework → inspect/add requirements → build a reusable assessment plan → launch a manual/compliance assessment scoped to that framework. Core library packages also carry threat/risk-matrix assets. Routes/aliases and exact API strings are enumerated in the appendices.

## Qualitative risk and manual/compliance assessment workflows

[AssessmentsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:80) loads domains, perimeters, frameworks, risk registers, users/groups, reusable questionnaire templates, and both assessment types together. It exposes perimeter creation, risk assessment creation, compliance/manual assessment creation, and existing-record lists. Every dependency is requested in one `Promise.all`, so one unauthorized/unavailable dependency can prevent the whole workbench loading. Most defaults pick the first available record.

| Page / journey step | Forms, main views, and side effects |
| --- | --- |
| Assessment workbench | Perimeter: domain/reference/name/description/lifecycle. Risk assessment: perimeter/register/reference/name/version/status/observation. Compliance/manual assessment: type, reusable assessment-plan template, perimeter/framework, assessor, reference/version/status/name, start/finish, instructions/process info/maturity score, user/group assignment, optional source-security-plan reference, selected control checkboxes (all/clear), recurrence checkbox/until/frequency, observation. POSTs create records; selected template supplies instructions/process notes and template ID. Creation then resets draft and reloads lists. [forms/actions](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:213). |
| Risk assessment detail | [RiskAssessmentDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:36): assessment metadata/counts, scenario list, add-scenario inline form (title/description/likelihood/impact/status), 5×5 likelihood-impact heatmap using score buckets, links to other workbench views. GET record and scenarios; POST scenario attaches it to current assessment/register. |
| Compliance assessment detail | [ComplianceAssessmentDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:39): result distribution and progress, assessment record context, left selector of plan lines-of-inquiry vs scoped controls, right selected-item review form, Previous/Save/Next. Results include compliant/partial/noncompliant/not-applicable/not-assessed. Shared inputs are observation/evidence note/gaps-differences/likelihood/impact/auto-generate-follow-up; controls additionally have evidence status and implementation/documentation scores. POST saves a selected plan item or requirement; reloads parent assessment progress. Switching selection replaces form state; no unsaved-change prompt. |
| Compliance action plan and budget | [ComplianceActionPlanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx:19): read-only applied-control table and budget totals, route tabs for plan vs budget, links to scoped flash/kanban with encoded assessment/back context. Source `/core/compliance-assessments/:id/action-plan`. |
| Applied controls flash mode | [AppliedControlsFlashPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:15): one applied control at a time, previous/next, editable status/priority/category/CSF function/owner/effort/ETA/expiry/control impact/annual cost/notes. POST `/core/applied-controls/:id` persists all fields. Context can come from route assessment or query parameter. |
| Applied controls kanban | [AppliedControlsKanbanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:25): boards grouped by domain, six lanes Tracking/To do/In progress/On hold/Active/Deprecated. Native drag/drop optimistically updates status, POSTs full control details, reloads on failure. Cards show reference/name/priority/owner/annual cost; mobile stacks lanes. No create/details drawer or keyboard movement in this page. |
| Risk scenarios / Risk Library | [RiskScenariosPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:63): register selection/sidebar and register scenario table; create/inspect/edit/delete registers and scenarios through drawers/confirmations. Register domain/name/description; scenario register/title/description/likelihood/impact/status. POST/PUT/DELETE core APIs. Deletes can cascade according to backend rules; UI confirmation must be read as a real mutation. |
| Risk assessment action plan/budget | [RiskAssessmentActionPlanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:55): derived treatments table, priority/status/cost/residual metrics, budget tab, inspect-treatment drawer and source-scenario navigation. GET action plan; no treatment mutation. “Prepare review packet” is only a local success notice (line 140), no export artifact. |
| Risk Action Tracker | [RiskActionTrackerPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:157): combines Ops task/incident/exception/validation cards, the first 12 GRC findings and core scenarios into a client-side unified queue. Tabs by source (all/findings/tasks/incidents/exceptions/scenarios), search, status/source/due-date table, inspect drawer and source links. It does not own a second action persistence model. Partial source failures produce a warning; refresh reloads. |
| Threat Models | [ThreatModelsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:70): scenario portfolio, modeled-register summaries, description/residual coverage, taxonomy/scoring/runtime contracts, status mix, governance signals and apply-to-systems guidance. Admin may load risk-model settings; everyone attempts register/scenario reads, independently with partial warnings. Threshold defaults to 16 if settings unavailable. Actions navigate to Risk Scenarios, Risk Model, Assessments; no separate threat-model graph editor or save operation. |

Manual assessment result writes, generated follow-ups, applied-control status and the source risk register are distinct operations. A read-only treatment summary or aggregated Action Tracker is not a new case-management workflow. Similarly, the “Threat Models” name currently refers to a source-backed portfolio/scoring summary, not diagram authoring.

## Advanced risk: EBIOS and quantitative

| Page | Implemented UI/workflow | Backend reality |
| --- | --- | --- |
| EBIOS workspace | [EbiosWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:14): study cards with progress/metadata; Create study drawer selects domain/perimeter/reference entity, name/ref/description; loads those reference records plus studies and POSTs `/ops/ebios-studies`. | Creates persisted study shell with default five workshops and initially empty scenario arrays. |
| EBIOS study detail and legacy workshop routes | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:44): study metadata/progress, five workshop step cards with status buttons, feared events/stakeholder/scenario sections, review snapshot drawer, edit name/description/status/quotation method/version/observation, delete confirmation. GET/PUT/DELETE study; POST workshop-step status. | Workshop controls change persisted `workshop_status_json`, not the risk substance. All `/ebios-rm/:id/workshop-*`, `/visual`, `/report`, `/edit` aliases render this same page; source page does not branch into separate workshop editors/reports. |
| Quantitative workspace | [QuantitativeWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:21): study cards with portfolio loss and status, create drawer domain/register/name/ref/description/loss threshold. POST `/ops/quantitative-studies`. | Creation uses fixed default scenario/hypothesis data with new UUIDs and aggregates portfolio values. |
| Quantitative study detail | [QuantitativeStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:55): portfolio metrics/scenario economics; Executive Summary, Key Metrics, Action Plan links; review drawer; edit name/description/status/distribution model/currency/loss threshold/version/observation; delete dialog; retrigger-simulations button. | “Retrigger simulations” applies fixed 0.97 current-ALE and 0.95 residual-ALE multipliers to portfolio JSON. It is not stochastic/Monte Carlo modeling and does not update scenario JSON. |
| Quantitative executive summary | [QuantitativeExecutiveSummaryPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeExecutiveSummaryPage.tsx:9): study/narrative summary and portfolio values; back to study. GET `/ops/quantitative-studies/:id/executive-summary`. | Server-derived narrative, no authoring form. |
| Quantitative key metrics | [QuantitativeKeyMetricsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx:28): portfolio metrics and threshold/exceedance-oriented values. GET `.../key-metrics`. | A summary of persisted/default deterministic economics. |
| Quantitative action plan / legacy budget route | [QuantitativeActionPlanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:47): scenario-derived actions, budget, cost/effectiveness/ROI/source scenario and review drawer. GET `.../action-plan`. | Read-only derived actions; “Prepare review packet” only sets a notice. The legacy budget-overview route renders this same page without a distinct budget mode. |
| Quantitative scenario detail | [QuantitativeScenarioDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeScenarioDetailPage.tsx:18): current/residual ALE, treatment/ROI metrics and links to hypotheses. GET `/ops/quantitative-risk-scenarios/:id`. | Read-only scenario/hypothesis data, no editor here. |
| Quantitative hypothesis detail | [QuantitativeHypothesisDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeHypothesisDetailPage.tsx:17): hypothesis stage, probability/loss/annual-exposure data and parent links. GET `/ops/quantitative-risk-hypotheses/:id`. | Read-only. |
| Risk-assessment conversion | [RiskAssessmentConversionPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/RiskAssessmentConversionPage.tsx:3): explains route migration and links to Quantitative Workspace or source assessment. | No conversion API request, data transfer, prefill, or automatic study creation. |

Backend trace anchors: [quantitative default scenarios](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ops/http.ts:1891), [portfolio sums](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ops/http.ts:1499), [study creation](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ops/http.ts:6815), [retrigger behavior](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ops/http.ts:6964), [EBIOS create/status mutation](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ops/http.ts:6620).

## Imported assessment evidence packages and assessor scrutiny

[AssessmentEvidencePackagePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:216), on `/assessment-evidence-packages` and `/:packageMarker`, is a read-only cockpit over imported historical assessment packages. It loads package summaries and selected marker detail from `/core/assessment-evidence-packages` endpoints; selecting a package navigates to its marker route. KPIs include evidence/core requests, reviewer comments, average days, control references and anomalies. Its tabs are Overview, Evidence Requests, Reviewer Comments, Evidence Rollups, Anomalies, Reusable Template. Overview shows control coverage and owner/family bottlenecks. Requests filter by search/family/evidence type/owner/core-request status/anomaly/comment presence; tables have inspect drawers and source-record links. Comment drawers show excerpts; rollups show locker linkage/control refs; anomalies show timing/mapping issues. Template tab directs to Assessment Plans and shows discovery/historical-integrity metadata. It links Data Calls, Evidence Locker, Assessment Plans and the Scrutiny Engine with package marker; it does not mutate source history.

[ScrutinyEnginePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:138) is an admin-only assessment evidence workflow, optionally deep-linked with package/run context. It loads domains, previous runs, question patterns and readiness; it handles disabled feature flag/readiness messages. Tabs: Scope, Draft Questions, Evidence Requests, Evidence Responses, Sufficiency Review, Comment Trail, Missing Feeds, Materialized Records. Scope includes title, folder, scope type, package marker, comma-separated control refs, module key and record ID. Generate Draft creates a run after review; materialization takes optional item IDs and include-drafts setting, creating linked Data Calls/Evidence Locker records; reconcile reloads current evidence state; sufficiency review records selected item, decision/event, reason/body and follow-up requirements. All meaningful actions use a review modal, and generated questions are distinguished from materialized records and human sufficiency decisions. Inspectable readiness metrics, missing feeds, reviewer challenges, comments and record links keep the chain visible. [actions](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:231), [API routes](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:240).

## GRC findings, gap assessments and reports

| Page | User workflow and APIs |
| --- | --- |
| Findings Explorer | [FindingsExplorerPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:23): filters framework/source/severity/status, apply/reset/load, selectable normalized findings list, selected finding detail with resource scope/account/region/time, evaluation results, evidence refs and target control mapping. GET `/grc/findings` with filters and `/:id`; no direct finding remediation edit in this page. |
| Gap assessments | [GapAssessmentsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx:7): history cards, refresh and new-run drawer with title/framework checkboxes/source CSV/severity CSV/status CSV. POST `/grc/assessments`; returns a persisted detail and navigates there. This is normalized evidence/findings gap analysis, distinct from the manual core compliance-assessment model. |
| Gap assessment detail | [GapAssessmentDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:23): framework/source/finding/gap counts and AI-provider posture; selectable gap rows and descriptions/mappings/evidence refs; outputs list. Review-confirmed Create evidence package, Create report bundle, Generate executive summary/board brief enqueue GRC jobs, wait until completed/failed, then reload outputs or navigate bundle. Actual evidence/report download links use returned paths. |
| Report bundles | [ReportBundlesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundlesPage.tsx:7): generated bundle cards with optional assessmentId query filter, report family/status/provider/time/detail/download context. GET `/grc/report-bundles`. |
| Report bundle detail | [ReportBundleDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:7): download button, manifest, narrative storyline, status/provider/family metadata, parent assessment and Reports/Compliance Exports/Framework Library links. Download is a real returned artifact route. |
| GRC Administration | [GrcAdministrationPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:28): curated corpus counts/SCF/snapshot, provider-neutral AI settings, native-collector readiness/last runs/provider, import snapshot/refresh SCF/collect actions, recent background jobs and result drawer (request/result/diagnostics). Settings edits, imports, refreshes and connector collection require review modal. Queued job polling defaults to 1.2 seconds, 120-second timeout, completed/failed termination. |

The corpus is read through `/grc/frameworks`, finding/control/SCF endpoints and managed document content. `/grc/admin/settings` reads/writes provider posture. GRC report/evidence operations have persistent job envelopes; [waitForGrcJob](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:315) is actual browser polling, unlike evidence/ConMon lists that only fetch when mounted/refreshed.

## Evidence collection and continuous monitoring

| Page | UI behavior | Source of truth |
| --- | --- | --- |
| Evidence Management / Evidence Workspace | [EvidenceManagementPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:62): Sources/Jobs/Artifacts tabs, search across all three, totals for sources/queued-running/artifacts/successful jobs, links into assurance evidence/tracker/packages. New source drawer selects AWS/GitHub/Snyk/Wiz/Custom HTTP; AWS additionally asks region/all-enabled-regions/key ID/secret/session token. Source rows collect or delete with review/confirmation modals. Jobs/artifacts are summary tables. | GET sources/jobs/artifacts. POST source, POST `sources/:id/collect`, DELETE source. AWS config forces `allowSyntheticSeed:false` and includes read-only credential input. For non-AWS new sources this form only sets `createdFrom`, no connector-specific URL/token/repository/configuration form. |
| Evidence Sources (admin) | [EvidenceSourcesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:18): simpler source list, same source-create drawer/provider/AWS details, queue-collection modal. No source-delete affordance here. | Same `/evidence/sources` service, not a separate source model. |
| Evidence Jobs | [EvidenceJobsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceJobsPage.tsx:20): queue-job table with status, source, attempts/error and timing/summary metadata. | GET `/evidence/jobs` on identity/mount. No periodic polling or creation in this page. |
| ConMon profiles (admin) | [ConMonProfilesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx:19): create name/description with hardcoded `fedramp_conmon` type; profile type/status/description table and Run button. | GET/POST `/conmon/profiles`, POST `/:id/run` returns execution ID. No schedule authoring, profile edit/delete, scanner/control rules in this form. |
| ConMon executions / Monitoring Runs | [ConMonExecutionsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonExecutionsPage.tsx:25): execution table with profile/status/requested-start-finish/attempts/error and JSON summary. Links to assurance evidence/packages. | GET `/conmon/executions`, initial/identity load only. No run-detail route or automatic refresh here. |

The backend collection pipeline first attempts AWS network collection, then input normalization of supplied `liveCollection/liveInput`, and only allows demo seed when explicitly enabled/manual-demo. Absent supported live/input configuration fails rather than silently creating successful evidence. Consequently the non-AWS source selector alone does not establish a fully configured live connection. GitHub's actual network GRC collector is a separate service pathway from the generic evidence-source form. [pipeline](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/assurance/runtime.ts:946), [no-input gate](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/assurance/runtime.ts:1040), [AWS collector](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/assurance/awsLiveCollection.ts:854), [GRC GitHub collector](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/grc-engine/collectors.ts:384). Backend map gives the exact live-versus-stub coverage and credential-storage boundaries.

## Assurance: evidence → review → package → bounded agent trace

This is the most detailed workflow in the React code, with shared deep-link context rather than independent disconnected screens. [Assurance API](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:28) supplies evidence detail/artifact preview, evaluation, explanation, tracker, package, review, workflow and agent operations.

| Page | Layout, selections, and actions | Persistence / limits |
| --- | --- | --- |
| Assurance Overview | [AssuranceOverviewPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:156): counts, attention queue ordered from reviews/writebacks/package mismatches/drift/tracker errors/workflow status; inspect-action drawer; latest handoffs; review ledger; package/tracker/writeback/workflow summaries; links to all assurance workbenches. Admin-only operational readiness/parity details. Selected attention item/audience/focus encoded in URL; role-specific explanation panel. | Reads `/assurance/overview`; optional `/assurance/parity/status`. It prioritizes work; actual decisions happen in destination workbenches. |
| Evidence Explorer | [AssuranceEvidenceExplorerPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:81): selectable job list, detail/coverage, artifact family JSON/text preview, deterministic eval summary/failing checks, reasonableness findings, recommendations, gaps, POA&M, evidence graph node/edge counts and selected-node connected-record view. Evaluate / Build 20x package / Run assurance agent each open review modal. Audience/focus/artifact/job URL state preserves handoffs. | POST eval persists deterministic eval artifact; POST package builds review artifact set; POST agent creates bounded run with `requestedWritebacks:true`. Build response records last package ID; agent response records run ID and pending-writeback count. No general network graph editor. |
| Tracker Workbench | [TrackerWorkbenchPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:101): list of imports; import drawer domain/name/**JSON rows** textarea prefilled with sample rows; status/category/owner rollups, artifact preview, row diagnostics and raw selected row, generated packages, tracker explanation. Convert to 20x review modal creates evidence job + package and exposes direct links. | Client JSON parse checks nonempty array, POSTs rows with hardcoded `sourceType:'csv'`; there is no CSV/XLSX upload parser in this specific screen. Conversion persists outputs and reconciliation, not just a visual format toggle. |
| Package Explorer | [PackageExplorerPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:157): package-job chooser, job/readiness summary; mismatch triage; validation/reconciliation/review/lineage panels; package artifact family previews; embedded agent-security/proof records; validation failures; findings; POA&M readiness; reconciliation checks; report bundle; evidence lineage; review ledger/history. Action menu opens readiness/current-artifact/review-history drawers or evidence/reviews. Audience/focus explain panel and workflow timeline. | Reads package record, package JSON document and linked review history/artifacts. “Ready” is evaluated through checks, not inferred solely from job completion. This page has no source-data edits or browser-side package-generation action. |
| Review Queue | [ReviewQueuePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:47): pending recommendation selector, inspect drawer, justification, Accept/Reject review modal; decision history and selected decision; linked evidence and refreshed packages; remediation/derivation explanations, linked workflow timeline. RecommendationId/decisionId/evidenceJobId/audience/focus are shareable query state. | POST `/assurance/reviews/decision` records human decision/evidence/control refs, reloads queue, reports refreshed package IDs and package-refresh error if deferred. Human decisions do not silently overwrite deterministic evaluations. Default justification text is editable; no mandatory detailed rationale beyond backend validation. |
| Agent Run Inspector | [AgentRunInspectorPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:151): Observable manifest JSON import/sample loader, run chooser, trace steps, policy decisions, selected-step/policy detail, proof chain/source confidence/rejected records/live coverage, JSON artifacts, run summary and linked package, bounded writeback requests. Each writeback has inspect/export/approve/reject/request-more-evidence/mark-duplicate; decision modal shows reviewer note/payload/evidence. run/step/policy/writeback/artifact/audience query state. | Imports persisted Observable runs or inspects server-created traces. Approval is explicitly draft-only with no external dispatch; export fetches draft and places it into artifact preview, not a file-download dialog. Decision APIs persist review state, reload run/trace/list. Real Jira dispatch exists in a separate dedicated admin backend route; these normal UI actions do not call it. |

[AssuranceExplainPanel](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceExplainPanel.tsx:43) generates `POST /assurance/explain` with allowed audience, job/import/focus and optional question, shows title/narrative/highlights/actions/evidence refs/provider metadata, and can auto-refresh on context. Audience options vary among assessor/executive/authorizing official/derivation/reasonableness/remediation/tracker. It explains existing deterministic artifacts rather than replacing their values. [AssuranceWorkflowPanel](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:109) reads linked workflow runs by IDs/types, filters status, expands metadata and links connected evidence/package/tracker/review/agent records. Both report errors locally.

Deterministic backend assurance evaluates resource reconciliation, scanner scope, centralized logging/correlation, alerts, change-ticketing, exploitation review, reasonableness, exposure and 20x rollup; the package builder persists R2 JSON and Markdown assessor/executive/AO/POA&M outputs, validates/reconciles them and registers provider-shell links. Review records refresh package artifacts while preserving evaluation truth. [evaluation](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/assurance/runtime.ts:1682), [package build route](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/assurance/http.ts:2748), [package artifact generation](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/assurance/runtime.ts:4224), [review ledger](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/assurance/runtime.ts:4938), [agent run creation](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/agent/http.ts:1347), [dedicated dispatch boundary](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/agent/http.ts:2350).

Dominant assurance journey: configure/collect source → inspect normalized evidence and collection coverage → run deterministic evaluation → inspect gaps/reasonableness/proof → make explicit human recommendation decisions → build/read package and validate reconciliation → inspect bounded agent trace and review writeback drafts → publish/package through provider operations when appropriate. Alternative intake is JSON tracker import → diagnostics → convert to evidence/package → same review chain.

## FedRAMP provider / Trust Center

`/trust-center` and `/fedramp/provider` both render the admin-only [FedrampProviderShellPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:198). This is one long vertically stacked operations page rather than a public trust center or a multi-route app. It fetches one `/trust-center` overview with offering, catalog/grants/artifacts/access events, communications, VDR, OAR/quarterly/feedback, changes, secure-config, scope and crypto state. Top metrics count published-artifact registry entries, grants, VDR evaluations/reports and OAR cycles. Actions open a shared review modal with title/description/metadata/confirm; success reloads overview and resets applicable drafts. Busy/error/message handling is explicit.

| Section | Form fields / actions / visibility |
| --- | --- |
| Offering, catalog, publication | Offering name, marketplace URL, contact email, operational/degraded/maintenance status, public access guidance → PUT. Public manifest link opens returned stable machine-readable endpoint in new tab. Recent artifact cards show kind/version/publication/audience; they are not direct downloads. Service name/summary/objectives CSV/customer-responsibilities CSV → create service. Agency/contact email/expiry ISO → create grant; returned token portal path becomes a shareable URL banner. |
| Security inbox, routing, audit | Contact agency/name/email/role → create. Message subject/criticality general-important-emergency-test/body Markdown → create queued communication. Incident title/state identified-investigating-recovering-resolved → create queued notification. Recent delivery confirmations and incident queue/FedRAMP/agency confirmations each have review gates and disabled terminal states. Backend API includes extra CISA/fail/message-queue helpers that this page does not expose. |
| Persistent reporting cadence | Sync vulnerability evaluations, generate working monthly VDR, working OAR cycle, and working quarterly review; lists of recent VDR/OAR/review drafts each permit publication. Feedback question/response-addendum → record; close latest feedback updates response/status and regenerates addendum. These are database/artifact/publication actions; creating queued communication or clicking confirmation is not proof that an email was sent. |
| Significant changes | Title, routine-recurring/adaptive/transformative type, description, planned-start ISO → create change/notice schedule. Recent changes display type/description/date; publish latest unpublished notice. |
| Secure configuration | Guide title/summary/Markdown → publish guide. Version/release-notes/defaults JSON → create secure-default release linked to latest guide. Current-versus-recommended defaults diff shows up to eight paths. Invalid JSON surfaces error during confirmation. |
| Scope and crypto | Scope title/narrative Markdown → create document and registry artifact. Crypto service/module/validation-status/CMVP-certificate → create inventory; provenance derives from presence of certificate. Latest documents and crypto rows, case-insensitive service-name coverage count. It records claimed validation provenance; it does not query CMVP or cryptographically validate a module from this screen. |

All provider API operations are enumerated at [fedramp/api.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:6), and confirmed-action behavior at [page line 319](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:319). Lists use small slices (e.g. six artifacts, four deliveries, five scope/crypto rows) with no pagination/search. Some fields and actions target the latest item rather than an arbitrarily chosen record. The public/necessary-party endpoint implementations belong to the backend map, not a separate React public UI.

## Workspace AI / guidance chat

`/chat` and `/scoring-assistant` use [ChatWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:13). It loads status/domain/session lists, shows provider/session-count/readiness metrics, a domain/title session form and selectable history cards on the left, conversation on the right. Messages display role/time/plain text and citation chips. Create posts folder/title; send posts message content, receives updated session, clears composer and reloads list. Empty state asks to create a session. Busy/error state exists, but no streaming, editing, deleting, file attachments or tool-execution UI.

Backend [workspaceGuidance](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ai/workspaceGuidance.ts:159) builds replies from current tenant aggregate context, optionally asks the AI provider for a JSON response, and falls back to deterministic domain guidance. It does not pass the full stored conversation history to the model. Citation chips are known tenant/context labels, not open web citation lookup. This screen therefore behaves as scoped guidance, not unrestricted chat or a workflow automation cockpit.

## Concrete UX and implementation concerns

These are source-confirmed findings or clearly marked inference, not a live-site certification:

1. **Misleading active controls:** topbar bell has no action and static dot; Cmd+K hints have no registered shortcut. [Topbar](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Topbar.tsx:321).
2. **Export/conversion gaps:** risk/quantitative “Prepare review packet” only sets a message; risk-to-quant conversion only navigates. Legacy export/sync routes may bridge to summary pages, not perform the old action. [Risk plan](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:138), [quant plan](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:101), [conversion](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/RiskAssessmentConversionPage.tsx:3).
3. **Quantitative model limitation:** “simulations”, distribution choice and financial metrics surround fixed templates/simple multipliers rather than actual stochastic modeling. Retrigger changes aggregate values without changing scenario values, creating potential visible inconsistency. [backend retrigger](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ops/http.ts:6964).
4. **Fine-grained permissions vs coarse UI:** `/assessments` and compliance index require both framework/risk capabilities, although detail allows framework-only; creation workbench also requests users/groups/templates even if a user can assess but cannot administer those resources. Read-capable users can see mutation affordances on several detail screens and receive backend denial. Navigation is a usability filter, not authorization enforcement. [guards](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:545), [capabilities](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/shellAccess.ts:148), [workbench dependencies](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:95).
5. **Medium-screen discovery:** 768–1279 px sidebar always uses group icons that only link first route; no same-rail way to expand group links. Users must use destination links/search to reach other items. [Sidebar](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Sidebar.tsx:334).
6. **Product/internal copy:** Staging hardcoded in sidebar; migration/Cloudflare/Worker/D1 terminology leaks into several product pages and success messages. Home progress/active metrics are heuristics/counts, not continuous evidence scores. [brand](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Sidebar.tsx:235), [chat copy](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:111).
7. **Incomplete connector setup:** non-AWS Evidence Management providers create a generic config with no live connection fields. Selector presence does not demonstrate successful collection. [source config](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:172).
8. **Refresh/identity limits:** many pages refetch on identity, but GRC/FedRAMP/Threat Models pages use mount/config-only effects. Local preview identity switching can leave mounted views stale until navigation/reload (inference from effect dependencies). Plain evidence/ConMon lists do not auto-poll queue updates. [FedRAMP effect](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:300), [Threat Models effect](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:132).
9. **Legacy parity breadth ≠ old-screen parity:** numerous workshop/report/visual/edit routes deliberately render one canonical workspace or redirect; missing semantic actions should not be certified based on route count. [legacy routing](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/LegacyRouteBridgePage.tsx:13).
10. **Anonymous questionnaire cannot load:** the direct unauthenticated rendering branch omits route parameter context, causing permanent initial loading. [branch](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:404), [required parameter](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireResponsePage.tsx:41). Local browser verification by the root agent confirms this defect.
11. **Navigation gaps:** the read-only catalogue helper links to `/me`, which has no AppLayout route, rather than `/workspace/me`; expanded sidebar always shows Help/search even when the profile has no search capability and the destination is denied. [catalogue helper](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:574), [unfiltered Help pill](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/Sidebar.tsx:266).
12. **Error/empty states vary:** some details replace actual fetch error with a generic not-found notice; combined Promise.all workbenches fail as a whole; newer threat/risk sources allow partial data. No common inline-field validation/unsaved-draft guard/retry system. Runtime/browser checks determine actual user impact.

## Source inventory appendices

The following inventories are generated from source syntax to make coverage reviewable. Route inventory contains every explicit current AppLayout route mapped to the audited components, including aliases. Endpoint inventory shows literal API calls and operation function names; an API helper being listed does not imply it has a visible control in every page. UI inventory includes static headings, tabs, labeled form fields and action/drawer labels, with source locations for dynamic/conditional behavior. All URLs shown here are application routes, not a claim that production was accessed.


### Explicit route inventory

| Route | Component | Layout guard | Route source |
| --- | --- | --- | --- |
| `/login` | [BootstrapAccessPanel](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx) | `Public/session branch` | [AppLayout:333](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:333) |
| `/auth/callback` | [SsoCallbackPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/SsoCallbackPage.tsx) | `Public/session branch` | [AppLayout:334](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:334) |
| `/setup/initialize` | [BootstrapAccessPanel](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx) | `Public/session branch` | [AppLayout:335](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:335) |
| `/admin/recover` | [BootstrapAccessPanel](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx) | `Public/session branch` | [AppLayout:336](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:336) |
| `/` | [HomePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx) | `Signed-in` | [AppLayout:496](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:496) |
| `/workspace/me` | [MePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx) | `Signed-in` | [AppLayout:501](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:501) |
| `/setup/compliance-settings` | [FrameworksPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx) | `adminOnly` | [AppLayout:520](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:520) |
| `/setup/file-system` | [EvidenceSourcesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx) | `adminOnly` | [AppLayout:521](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:521) |
| `/libraries` | [LibrariesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx) | `canUseLibraries` | [AppLayout:534](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:534) |
| `/libraries/:libraryId` | [LibraryDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx) | `canUseLibraries` | [AppLayout:535](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:535) |
| `/frameworks` | [FrameworksPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx) | `canUseFrameworks` | [AppLayout:536](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:536) |
| `/frameworks/:frameworkId` | [FrameworkDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx) | `canUseFrameworks` | [AppLayout:537](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:537) |
| `/framework-library` | [FrameworkLibraryPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx) | `canUseFrameworks` | [AppLayout:538](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:538) |
| `/framework-library/:frameworkId` | [FrameworkKnowledgeDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx) | `canUseFrameworks` | [AppLayout:539](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:539) |
| `/findings` | [FindingsExplorerPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx) | `canUseFrameworks` | [AppLayout:540](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:540) |
| `/gap-assessments` | [GapAssessmentsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx) | `canUseFrameworks` | [AppLayout:541](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:541) |
| `/gap-assessments/:assessmentId` | [GapAssessmentDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx) | `canUseFrameworks` | [AppLayout:542](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:542) |
| `/report-bundles` | [ReportBundlesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundlesPage.tsx) | `canUseFrameworks` | [AppLayout:543](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:543) |
| `/report-bundles/:bundleId` | [ReportBundleDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx) | `canUseFrameworks` | [AppLayout:544](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:544) |
| `/assessments` | [AssessmentsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx) | `canUseAssessmentWorkspace` | [AppLayout:545](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:545) |
| `/risk-assessments/:assessmentId` | [RiskAssessmentDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx) | `canUseRiskAssessments` | [AppLayout:546](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:546) |
| `/risk-assessments/:assessmentId/action-plan` | [RiskAssessmentActionPlanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx) | `canUseRiskAssessments` | [AppLayout:547](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:547) |
| `/risk-assessments/:assessmentId/action-plan/budget-overview` | [RiskAssessmentActionPlanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx) | `canUseRiskAssessments` | [AppLayout:551](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:551) |
| `/compliance-assessments/:assessmentId` | [ComplianceAssessmentDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx) | `canUseComplianceAssessments` | [AppLayout:555](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:555) |
| `/compliance-assessments/:assessmentId/action-plan` | [ComplianceActionPlanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx) | `canUseComplianceAssessments` | [AppLayout:559](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:559) |
| `/compliance-assessments/:assessmentId/action-plan/budget-overview` | [ComplianceActionPlanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx) | `canUseComplianceAssessments` | [AppLayout:563](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:563) |
| `/compliance-assessments/:assessmentId/flash-mode` | [AppliedControlsFlashPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx) | `canUseComplianceAssessments` | [AppLayout:567](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:567) |
| `/applied-controls/kanban-mode` | [AppliedControlsKanbanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx) | `canUseComplianceAssessments` | [AppLayout:571](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:571) |
| `/applied-controls/flash-mode` | [AppliedControlsFlashPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx) | `canUseComplianceAssessments` | [AppLayout:572](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:572) |
| `/threat-models` | [ThreatModelsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx) | `canUseModules` | [AppLayout:635](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:635) |
| `/chat` | [ChatWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx) | `canUseChat` | [AppLayout:681](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:681) |
| `/fedramp/provider` | [FedrampProviderShellPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx) | `adminOnly` | [AppLayout:686](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:686) |
| `/features/continuous-monitoring` | [ConMonProfilesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx) | `adminOnly` | [AppLayout:688](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:688) |
| `/grc-admin` | [GrcAdministrationPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx) | `adminOnly` | [AppLayout:689](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:689) |
| `/scrutiny-engine` | [ScrutinyEnginePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx) | `adminOnly` | [AppLayout:690](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:690) |
| `/grc-admin/scrutiny-engine` | [ScrutinyEnginePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx) | `adminOnly` | [AppLayout:691](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:691) |
| `/trust-center` | [FedrampProviderShellPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx) | `adminOnly` | [AppLayout:692](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:692) |
| `/advanced-risk/ebios` | [EbiosWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx) | `canUseAdvancedRisk` | [AppLayout:725](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:725) |
| `/advanced-risk/ebios/:studyId` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:726](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:726) |
| `/advanced-risk/quantitative` | [QuantitativeWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx) | `canUseAdvancedRisk` | [AppLayout:727](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:727) |
| `/advanced-risk/quantitative/:studyId` | [QuantitativeStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:728](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:728) |
| `/advanced-risk/quantitative/:studyId/executive-summary` | [QuantitativeExecutiveSummaryPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeExecutiveSummaryPage.tsx) | `canUseAdvancedRisk` | [AppLayout:732](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:732) |
| `/advanced-risk/quantitative/:studyId/key-metrics` | [QuantitativeKeyMetricsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx) | `canUseAdvancedRisk` | [AppLayout:736](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:736) |
| `/advanced-risk/quantitative/:studyId/action-plan` | [QuantitativeActionPlanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx) | `canUseAdvancedRisk` | [AppLayout:740](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:740) |
| `/quantitative-risk-studies/:studyId/action-plan/budget-overview` | [QuantitativeActionPlanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx) | `canUseAdvancedRisk` | [AppLayout:744](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:744) |
| `/quantitative-risk-scenarios/:scenarioId` | [QuantitativeScenarioDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeScenarioDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:748](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:748) |
| `/quantitative-risk-hypotheses/:hypothesisId` | [QuantitativeHypothesisDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeHypothesisDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:752](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:752) |
| `/risk-assessments/:assessmentId/convert-to-quantitative` | [RiskAssessmentConversionPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/RiskAssessmentConversionPage.tsx) | `canUseAdvancedRisk` | [AppLayout:756](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:756) |
| `/my-profile` | [MePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx) | `Signed-in` | [AppLayout:762](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:762) |
| `/compliance-assessments` | [AssessmentsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx) | `canUseAssessmentWorkspace` | [AppLayout:768](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:768) |
| `/risk-assessments` | [AssessmentsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx) | `canUseAssessmentWorkspace` | [AppLayout:769](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:769) |
| `/loaded-libraries` | [LibrariesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx) | `canUseLibraries` | [AppLayout:770](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:770) |
| `/loaded-libraries/:libraryId` | [LibraryDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx) | `canUseLibraries` | [AppLayout:771](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:771) |
| `/mapping-libraries` | [LibrariesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx) | `canUseLibraries` | [AppLayout:772](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:772) |
| `/stored-libraries` | [LibrariesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx) | `canUseLibraries` | [AppLayout:773](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:773) |
| `/stored-libraries/:libraryId` | [LibraryDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx) | `canUseLibraries` | [AppLayout:774](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:774) |
| `/ebios-rm` | [EbiosWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx) | `canUseAdvancedRisk` | [AppLayout:777](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:777) |
| `/ebios-rm/:studyId` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:778](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:778) |
| `/ebios-rm/:studyId/visual` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:779](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:779) |
| `/ebios-rm/:studyId/report` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:780](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:780) |
| `/ebios-rm/:studyId/workshop-1/feared-events` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:781](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:781) |
| `/ebios-rm/:studyId/workshop-1/baseline` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:782](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:782) |
| `/ebios-rm/:studyId/workshop-1/ebios-rm-study` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:783](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:783) |
| `/ebios-rm/:studyId/workshop-1/ebios-rm-study/edit` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:784](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:784) |
| `/ebios-rm/:studyId/workshop-2/ro-to` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:785](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:785) |
| `/ebios-rm/:studyId/workshop-3/ecosystem` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:786](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:786) |
| `/ebios-rm/:studyId/workshop-3/strategic-scenarios` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:787](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:787) |
| `/ebios-rm/:studyId/workshop-4/operational-scenario` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:788](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:788) |
| `/ebios-rm/:studyId/workshop-4/elementary-actions` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:789](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:789) |
| `/ebios-rm/:studyId/workshop-5/risk-analyses` | [EbiosStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:790](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:790) |
| `/quantitative-risk-studies` | [QuantitativeWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx) | `canUseAdvancedRisk` | [AppLayout:791](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:791) |
| `/quantitative-risk-studies/:studyId` | [QuantitativeStudyDetailPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx) | `canUseAdvancedRisk` | [AppLayout:792](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:792) |
| `/quantitative-risk-studies/:studyId/executive-summary` | [QuantitativeExecutiveSummaryPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeExecutiveSummaryPage.tsx) | `canUseAdvancedRisk` | [AppLayout:793](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:793) |
| `/quantitative-risk-studies/:studyId/key-metrics` | [QuantitativeKeyMetricsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx) | `canUseAdvancedRisk` | [AppLayout:797](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:797) |
| `/quantitative-risk-studies/:studyId/action-plan` | [QuantitativeActionPlanPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx) | `canUseAdvancedRisk` | [AppLayout:801](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:801) |
| `/operating-modes` | [EbiosWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx) | `canUseAdvancedRisk` | [AppLayout:915](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:915) |
| `/operational-scenarios` | [EbiosWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx) | `canUseAdvancedRisk` | [AppLayout:919](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:919) |
| `/strategic-scenarios` | [EbiosWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx) | `canUseAdvancedRisk` | [AppLayout:923](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:923) |
| `/ro-to` | [EbiosWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx) | `canUseAdvancedRisk` | [AppLayout:927](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:927) |
| `/stakeholders` | [EbiosWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx) | `canUseAdvancedRisk` | [AppLayout:931](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:931) |
| `/scoring-assistant` | [ChatWorkspacePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx) | `canUseChat` | [AppLayout:935](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:935) |
| `/risk-actions` | [RiskActionTrackerPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx) | `canUseRiskAssessments` | [AppLayout:939](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:939) |
| `/risk-scenarios` | [RiskScenariosPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx) | `canUseRiskAssessments` | [AppLayout:940](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:940) |
| `/conmon/profiles` | [ConMonProfilesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx) | `adminOnly` | [AppLayout:941](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:941) |
| `/conmon/executions` | [ConMonExecutionsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonExecutionsPage.tsx) | `canUseConMon` | [AppLayout:942](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:942) |
| `/evidence-management` | [EvidenceManagementPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx) | `canUseEvidence` | [AppLayout:943](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:943) |
| `/features/evidence-management` | [EvidenceManagementPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx) | `canUseEvidence` | [AppLayout:944](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:944) |
| `/assessment-evidence-packages` | [AssessmentEvidencePackagePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx) | `canUseEvidence` | [AppLayout:945](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:945) |
| `/assessment-evidence-packages/:packageMarker` | [AssessmentEvidencePackagePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx) | `canUseEvidence` | [AppLayout:946](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:946) |
| `/evidence/sources` | [EvidenceSourcesPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx) | `adminOnly` | [AppLayout:947](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:947) |
| `/evidence/jobs` | [EvidenceJobsPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceJobsPage.tsx) | `canUseEvidence` | [AppLayout:948](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:948) |
| `/assurance` | [AssuranceOverviewPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx) | `canUseAssurance` | [AppLayout:949](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:949) |
| `/assurance/evidence` | [AssuranceEvidenceExplorerPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx) | `canUseAssurance` | [AppLayout:950](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:950) |
| `/assurance/tracker` | [TrackerWorkbenchPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx) | `canUseAssurance` | [AppLayout:951](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:951) |
| `/assurance/packages` | [PackageExplorerPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx) | `canUseAssurance` | [AppLayout:952](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:952) |
| `/assurance/reviews` | [ReviewQueuePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx) | `canUseAssurance` | [AppLayout:953](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:953) |
| `/assurance/agent-runs` | [AgentRunInspectorPage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx) | `canUseAssurance` | [AppLayout:954](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:954) |

Coverage: 97 explicit route/component entries across 55 audited JSX files (including shared subpanels and unmounted Dashboard source). Auth routes also redirect authenticated users home. Legacy `/{model}/*` wildcard bridges add redirects beyond the explicit entries; see [LegacyRouteBridgePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/LegacyRouteBridgePage.tsx:121).

### Page-level request inventory

These are literal request sites in pages; API helper modules follow separately. Template expressions are preserved.

| Page | Method / endpoint expression | Source |
| --- | --- | --- |
| HomePage | `GET /core/overview` | [line 322](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:322) |
| HomePage | `GET /assurance/overview` | [line 325](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:325) |
| HomePage | `GET /ops/parity/overview` | [line 328](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:328) |
| HomePage | `GET /assurance/parity/status` | [line 331](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:331) |
| DashboardPage | `GET /core/health` | [line 171](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:171) |
| DashboardPage | `GET /core/overview` | [line 172](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:172) |
| DashboardPage | `GET /core/tenants/${identity.tenantId}/workflows` | [line 173](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:173) |
| DashboardPage | `POST /core/bootstrap-demo` | [line 196](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:196) |
| BootstrapAccessPanel | `GET /_api/core/bootstrap/status` | [line 183](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:183) |
| BootstrapAccessPanel | `GET /_api/core/login/config` | [line 186](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:186) |
| BootstrapAccessPanel | `GET /_api/core/login/options?tenantSlug=${encodeURIComponent(slug)}` | [line 290](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:290) |
| BootstrapAccessPanel | `POST /_api/core/bootstrap/initialize` | [line 367](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:367) |
| BootstrapAccessPanel | `POST /_api/core/bootstrap/admin-session` | [line 401](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:401) |
| BootstrapAccessPanel | `POST /_api/core/login/request-code` | [line 434](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:434) |
| BootstrapAccessPanel | `POST /_api/core/login/verify-code` | [line 473](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:473) |
| BootstrapAccessPanel | `POST /_api/core/local-auth/sign-in` | [line 505](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:505) |
| BootstrapAccessPanel | `POST /_api/core/local-auth/bootstrap-set-password` | [line 541](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:541) |
| BootstrapAccessPanel | `POST /_api/core/sso/start` | [line 575](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx:575) |
| FrameworkDetailPage | `GET /core/frameworks/${frameworkId}` | [line 42](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:42) |
| FrameworkDetailPage | `GET /core/frameworks/${frameworkId}/controls` | [line 43](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:43) |
| FrameworkDetailPage | `GET /core/frameworks/${frameworkId}/tree` | [line 44](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:44) |
| FrameworkDetailPage | `POST /core/frameworks/${frameworkId}/controls` | [line 70](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:70) |
| FrameworksPage | `GET /core/frameworks` | [line 171](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:171) |
| FrameworksPage | `GET /iam/me` | [line 173](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:173) |
| FrameworksPage | `POST /core/frameworks` | [line 196](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:196) |
| FrameworksPage | `POST /core/frameworks/import/system` | [line 220](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:220) |
| FrameworksPage | `POST /core/frameworks/import/file` | [line 267](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:267) |
| MePage | `GET /iam/me` | [line 22](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:22) |
| MePage | `POST /core/local-auth/set-password` | [line 46](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:46) |
| SsoCallbackPage | `POST /_api/core/sso/callback` | [line 41](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/SsoCallbackPage.tsx:41) |
| LibrariesPage | `GET /core/libraries` | [line 23](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx:23) |
| LibraryDetailPage | `GET /core/libraries/${libraryId}` | [line 41](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:41) |
| AppliedControlsFlashPage | `GET /core/applied-controls${suffix}` | [line 53](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:53) |
| AppliedControlsFlashPage | `POST /core/applied-controls/${current.id}` | [line 94](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:94) |
| AppliedControlsKanbanPage | `GET /core/applied-controls${suffix}` | [line 48](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:48) |
| AppliedControlsKanbanPage | `POST /core/applied-controls/${id}` | [line 68](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:68) |
| AssessmentEvidencePackagePage | `GET /core/assessment-evidence-packages` | [line 245](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:245) |
| AssessmentEvidencePackagePage | `GET /core/assessment-evidence-packages/${encodeURIComponent(marker)}` | [line 270](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:270) |
| AssessmentsPage | `GET /iam/folders?contentType=domain` | [line 95](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:95) |
| AssessmentsPage | `GET /core/perimeters` | [line 96](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:96) |
| AssessmentsPage | `GET /core/frameworks` | [line 97](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:97) |
| AssessmentsPage | `GET /core/risk-registers` | [line 98](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:98) |
| AssessmentsPage | `GET /iam/users` | [line 99](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:99) |
| AssessmentsPage | `GET /iam/user-groups` | [line 100](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:100) |
| AssessmentsPage | `GET /core/risk-assessments` | [line 102](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:102) |
| AssessmentsPage | `GET /core/compliance-assessments` | [line 103](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:103) |
| AssessmentsPage | `GET /core/frameworks/${complianceFrameworkId}/controls` | [line 166](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:166) |
| AssessmentsPage | `POST /core/perimeters` | [line 218](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:218) |
| AssessmentsPage | `POST /core/risk-assessments` | [line 245](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:245) |
| AssessmentsPage | `POST /core/compliance-assessments` | [line 288](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:288) |
| ComplianceActionPlanPage | `GET /core/compliance-assessments/${assessmentId}/action-plan` | [line 38](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx:38) |
| ComplianceAssessmentDetailPage | `GET /core/compliance-assessments/${assessmentId}` | [line 74](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:74) |
| ComplianceAssessmentDetailPage | `GET /core/compliance-assessments/${assessmentId}/requirements` | [line 75](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:75) |
| ComplianceAssessmentDetailPage | `GET /core/compliance-assessments/${assessmentId}/assessment-plan-items` | [line 78](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:78) |
| ComplianceAssessmentDetailPage | `POST /core/compliance-assessments/${assessmentId}/assessment-plan-items/${selectedPlanItem.id}` | [line 204](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:204) |
| ComplianceAssessmentDetailPage | `POST /core/compliance-assessments/${assessmentId}/requirements/${selectedRequirement.id}` | [line 221](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:221) |
| ComplianceAssessmentDetailPage | `GET /core/compliance-assessments/${assessmentId}` | [line 242](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:242) |
| RiskAssessmentActionPlanPage | `GET /core/risk-assessments/${assessmentId}/action-plan` | [line 76](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:76) |
| RiskAssessmentDetailPage | `GET /core/risk-assessments/${assessmentId}` | [line 62](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:62) |
| RiskAssessmentDetailPage | `GET /core/risk-assessments/${assessmentId}/scenarios` | [line 63](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:63) |
| RiskAssessmentDetailPage | `POST /core/risk-assessments/${assessmentId}/scenarios` | [line 87](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:87) |
| RiskActionTrackerPage | `GET /core/risk-scenarios` | [line 173](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:173) |
| RiskScenariosPage | `GET /iam/folders?contentType=domain` | [line 106](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:106) |
| RiskScenariosPage | `GET /core/risk-registers` | [line 107](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:107) |
| RiskScenariosPage | `GET /core/risk-scenarios` | [line 108](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:108) |
| RiskScenariosPage | `POST /core/risk-registers` | [line 147](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:147) |
| RiskScenariosPage | `POST /core/risk-scenarios` | [line 169](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:169) |
| RiskScenariosPage | `PUT /core/risk-registers/${editingRegister.id}` | [line 205](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:205) |
| RiskScenariosPage | `DELETE /core/risk-registers/${registerToDelete.id}` | [line 226](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:226) |
| RiskScenariosPage | `PUT /core/risk-scenarios/${editingScenario.id}` | [line 252](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:252) |
| RiskScenariosPage | `DELETE /core/risk-scenarios/${scenarioToDelete.id}` | [line 275](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:275) |
| ThreatModelsPage | `GET /core/risk-registers` | [line 88](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:88) |
| ThreatModelsPage | `GET /core/risk-scenarios` | [line 89](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:89) |
| EbiosStudyDetailPage | `GET /ops/ebios-studies/${studyId}` | [line 76](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:76) |
| EbiosStudyDetailPage | `PUT /ops/ebios-studies/${study.id}` | [line 106](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:106) |
| EbiosStudyDetailPage | `DELETE /ops/ebios-studies/${study.id}` | [line 126](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:126) |
| EbiosStudyDetailPage | `POST /ops/ebios-studies/${studyId}/workshops/${workshopId}/${step.id}` | [line 144](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:144) |
| EbiosWorkspacePage | `GET /iam/folders?contentType=domain` | [line 38](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:38) |
| EbiosWorkspacePage | `GET /core/perimeters` | [line 39](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:39) |
| EbiosWorkspacePage | `GET /core/entities` | [line 40](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:40) |
| EbiosWorkspacePage | `GET /ops/ebios-studies` | [line 41](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:41) |
| EbiosWorkspacePage | `POST /ops/ebios-studies` | [line 72](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:72) |
| QuantitativeActionPlanPage | `GET /ops/quantitative-studies/${studyId}/action-plan` | [line 68](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:68) |
| QuantitativeExecutiveSummaryPage | `GET /ops/quantitative-studies/${studyId}/executive-summary` | [line 27](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeExecutiveSummaryPage.tsx:27) |
| QuantitativeHypothesisDetailPage | `GET /ops/quantitative-hypotheses/${hypothesisId}` | [line 37](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeHypothesisDetailPage.tsx:37) |
| QuantitativeKeyMetricsPage | `GET /ops/quantitative-studies/${studyId}/key-metrics` | [line 45](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx:45) |
| QuantitativeScenarioDetailPage | `GET /ops/quantitative-scenarios/${scenarioId}` | [line 37](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeScenarioDetailPage.tsx:37) |
| QuantitativeStudyDetailPage | `GET /ops/quantitative-studies/${studyId}` | [line 88](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:88) |
| QuantitativeStudyDetailPage | `PUT /ops/quantitative-studies/${study.id}` | [line 122](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:122) |
| QuantitativeStudyDetailPage | `DELETE /ops/quantitative-studies/${study.id}` | [line 145](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:145) |
| QuantitativeStudyDetailPage | `POST /ops/quantitative-studies/${studyId}/retrigger-simulations` | [line 164](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:164) |
| QuantitativeWorkspacePage | `GET /iam/folders?contentType=domain` | [line 44](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:44) |
| QuantitativeWorkspacePage | `GET /core/risk-registers` | [line 45](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:45) |
| QuantitativeWorkspacePage | `GET /ops/quantitative-studies` | [line 46](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:46) |
| QuantitativeWorkspacePage | `POST /ops/quantitative-studies` | [line 73](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:73) |
| FrameworkLibraryPage | `GET /iam/me` | [line 43](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:43) |
| ScrutinyEnginePage | `GET /iam/folders` | [line 190](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:190) |
| TrackerWorkbenchPage | `GET /iam/folders?contentType=domain` | [line 163](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:163) |
| EvidenceJobsPage | `GET /evidence/jobs` | [line 31](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceJobsPage.tsx:31) |
| EvidenceManagementPage | `GET /evidence/sources` | [line 88](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:88) |
| EvidenceManagementPage | `GET /evidence/jobs` | [line 89](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:89) |
| EvidenceManagementPage | `GET /evidence/artifacts` | [line 90](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:90) |
| EvidenceManagementPage | `POST /evidence/sources` | [line 194](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:194) |
| EvidenceManagementPage | `POST /evidence/sources/${sourceId}/collect` | [line 221](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:221) |
| EvidenceManagementPage | `DELETE /evidence/sources/${sourceId}` | [line 237](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:237) |
| EvidenceSourcesPage | `GET /evidence/sources` | [line 39](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:39) |
| EvidenceSourcesPage | `POST /evidence/sources` | [line 80](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:80) |
| EvidenceSourcesPage | `POST /evidence/sources/${sourceId}/collect` | [line 106](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:106) |
| ChatWorkspacePage | `GET /ops/chat/status` | [line 32](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:32) |
| ChatWorkspacePage | `GET /iam/folders?contentType=domain` | [line 33](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:33) |
| ChatWorkspacePage | `GET /ops/chat/sessions` | [line 34](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:34) |
| ChatWorkspacePage | `POST /ops/chat/sessions` | [line 63](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:63) |
| ChatWorkspacePage | `POST /ops/chat/sessions/${selectedSession.id}/messages` | [line 85](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:85) |
| ConMonExecutionsPage | `GET /conmon/executions` | [line 36](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonExecutionsPage.tsx:36) |
| ConMonProfilesPage | `GET /conmon/profiles` | [line 33](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx:33) |
| ConMonProfilesPage | `POST /conmon/profiles` | [line 50](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx:50) |
| ConMonProfilesPage | `POST /conmon/profiles/${profileId}/run` | [line 70](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx:70) |

117 literal request sites; helper-driven GRC/Assurance/FedRAMP operations are listed below. Request calls do not by themselves certify external delivery or a configured connector.

### GRC, assurance, and provider API helper inventory

| Helper | Endpoint(s) / method(s) | Source |
| --- | --- | --- |
| `getGrcOverview` | GET `/grc` | [grc:47](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:47) |
| `getGrcStatus` | GET `/grc/status` | [grc:52](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:52) |
| `getFrameworkLibrary` | GET `/grc/frameworks` | [grc:57](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:57) |
| `getFrameworkDetail` | GET `/grc/frameworks/${encodeURIComponent(frameworkId)}` | [grc:62](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:62) |
| `getFrameworkDocument` | GET `/grc/frameworks/${encodeURIComponent(frameworkId)}/content/${encodeURIComponent(slug)}` | [grc:67](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:67) |
| `getFindings` | GET `/grc/findings` | [grc:74](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:74) |
| `getControlMap` | GET `/grc/controls/map` | [grc:81](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:81) |
| `analyzeControlConflicts` | POST `/grc/controls/conflicts` | [grc:91](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:91) |
| `optimizeControlCoverage` | POST `/grc/controls/optimize` | [grc:113](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:113) |
| `getFindingDetail` | GET `/grc/findings/${encodeURIComponent(findingId)}` | [grc:125](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:125) |
| `createGapAssessment` | POST `/grc/assessments` | [grc:130](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:130) |
| `getGapAssessments` | GET `/grc/assessments` | [grc:135](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:135) |
| `getGapAssessment` | GET `/grc/assessments/${encodeURIComponent(assessmentId)}` | [grc:140](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:140) |
| `createReportBundle` | POST `/grc/assessments/${encodeURIComponent(assessmentId)}/report` | [grc:147](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:147) |
| `createEvidencePackage` | POST `/grc/evidence-packages` | [grc:154](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:154) |
| `getReportBundles` | GET `/grc/report-bundles` | [grc:161](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:161) |
| `getReportBundle` | GET `/grc/report-bundles/${encodeURIComponent(bundleId)}` | [grc:168](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:168) |
| `getCollectorStatuses` | GET `/grc/connectors` | [grc:175](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:175) |
| `getCollectorRuns` | GET `/grc/connectors/${encodeURIComponent(source)}/runs` | [grc:180](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:180) |
| `launchNativeCollector` | POST `/grc/connectors/${encodeURIComponent(source)}/collect` | [grc:187](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:187) |
| `generateExecutiveReport` | POST `/grc/reports/${encodeURIComponent(reportKind)}` | [grc:196](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:196) |
| `getGrcAdminStatus` | GET `/grc/admin/settings` | [grc:207](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:207) |
| `updateGrcAdminSettings` | PUT `/grc/admin/settings` | [grc:212](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:212) |
| `importGrcSnapshot` | POST `/grc/admin/import-snapshot` | [grc:217](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:217) |
| `refreshGrcScf` | POST `/grc/admin/scf/refresh` | [grc:222](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:222) |
| `getGrcJobs` | GET `/grc/jobs` | [grc:235](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:235) |
| `getScrutinyPatterns` | GET `/grc/scrutiny-patterns` | [grc:240](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:240) |
| `getScrutinyReadiness` | GET `/grc/scrutiny-readiness` | [grc:257](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:257) |
| `listScrutinyRuns` | GET `/grc/scrutiny-runs` | [grc:267](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:267) |
| `createDraftScrutinyRun` | POST `/grc/scrutiny-runs/draft` | [grc:272](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:272) |
| `getScrutinyRun` | GET `/grc/scrutiny-runs/${encodeURIComponent(runId)}` | [grc:277](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:277) |
| `materializeScrutinyRun` | POST `/grc/scrutiny-runs/${encodeURIComponent(runId)}/materialize` | [grc:282](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:282) |
| `reconcileScrutinyRun` | POST `/grc/scrutiny-runs/${encodeURIComponent(runId)}/reconcile` | [grc:290](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:290) |
| `reviewScrutinyItem` | POST `/grc/scrutiny-items/${encodeURIComponent(itemId)}/review` | [grc:298](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:298) |
| `getGrcJob` | GET `/grc/jobs/${encodeURIComponent(jobId)}` | [grc:306](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:306) |
| `waitForGrcJob` |  Composes helpers / polls (see source) | [grc:315](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/api.ts:315) |
| `getAssuranceOverview` | GET `/assurance/overview` | [assurance:28](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:28) |
| `getObservableParityStatus` | GET `/assurance/parity/status` | [assurance:33](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:33) |
| `listEvidenceJobs` | GET `/evidence/jobs` | [assurance:38](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:38) |
| `getEvidenceJob` | GET `/evidence/jobs/${jobId}` | [assurance:43](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:43) |
| `getEvidenceArtifactPreview` | GET `/evidence/jobs/${jobId}/artifacts/${family}` | [assurance:48](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:48) |
| `runAssuranceEvaluation` | POST `/assurance/evals/run` | [assurance:55](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:55) |
| `getAssuranceEvaluation` | GET `/assurance/evals/${evidenceJobId}` | [assurance:60](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:60) |
| `explainAssurance` | POST `/assurance/explain` | [assurance:65](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:65) |
| `listAssuranceWorkflowRuns` | GET `/assurance/workflows${suffix}` | [assurance:76](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:76) |
| `listTrackerImports` | GET `/assurance/tracker/imports` | [assurance:100](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:100) |
| `getTrackerImport` | GET `/assurance/tracker/imports/${importId}` | [assurance:105](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:105) |
| `getTrackerArtifactPreview` | GET `/assurance/tracker/imports/${importId}/artifacts/${family}` | [assurance:110](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:110) |
| `createTrackerImport` | POST `/assurance/tracker/import` | [assurance:117](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:117) |
| `convertTrackerToTwentyX` | POST `/assurance/tracker/${importId}/to-20x` | [assurance:130](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:130) |
| `listPackages` | GET `/assurance/packages` | [assurance:141](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:141) |
| `buildPackage` | POST `/assurance/packages/build` | [assurance:146](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:146) |
| `getPackage` | GET `/assurance/packages/${packageJobId}` | [assurance:156](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:156) |
| `getPackageDocument` |  Composes helpers / polls (see source) | [assurance:195](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:195) |
| `getPackageArtifactPreview` | GET `/assurance/packages/${packageJobId}/artifacts/${family}` | [assurance:200](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:200) |
| `listPendingReviews` | GET `/assurance/reviews/pending` | [assurance:207](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:207) |
| `listReviewHistory` | GET `/assurance/reviews/history?evidenceJobId=${encodeURIComponent(evidenceJobId)}`, `/assurance/reviews/history` | [assurance:212](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:212) |
| `recordReviewDecision` | POST `/assurance/reviews/decision` | [assurance:220](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:220) |
| `listAgentRuns` | GET `/agent/runs` | [assurance:232](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:232) |
| `createAgentRun` | POST `/agent/runs` | [assurance:237](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:237) |
| `importObservableAgentRun` | POST `/agent/runs/import-observable` | [assurance:247](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:247) |
| `getAgentRun` | GET `/agent/runs/${runId}` | [assurance:255](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:255) |
| `getAgentTrace` | GET `/agent/runs/${runId}/trace` | [assurance:294](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:294) |
| `getAgentArtifactPreview` | GET `/agent/runs/${runId}/artifacts/${family}` | [assurance:299](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:299) |
| `approveWriteback` | POST `/agent/writebacks/${writebackId}/approve` | [assurance:306](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:306) |
| `rejectWriteback` | POST `/agent/writebacks/${writebackId}/reject` | [assurance:314](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:314) |
| `requestWritebackEvidence` | POST `/agent/writebacks/${writebackId}/request-more-evidence` | [assurance:323](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:323) |
| `markWritebackDuplicate` | POST `/agent/writebacks/${writebackId}/duplicate` | [assurance:331](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:331) |
| `exportWritebackDraft` | GET `/agent/writebacks/${writebackId}/export` | [assurance:339](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/api.ts:339) |
| `getFedrampOverview` | GET `/trust-center` | [fedramp:6](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:6) |
| `updateFedrampOffering` | PUT `/trust-center` | [fedramp:11](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:11) |
| `createTrustCenterService` | POST `/trust-center/services` | [fedramp:16](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:16) |
| `createTrustCenterGrant` | POST `/trust-center/grants` | [fedramp:21](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:21) |
| `createAgencyContact` | POST `/fedramp-communications/contacts` | [fedramp:32](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:32) |
| `createFedrampMessage` | POST `/fedramp-communications/messages` | [fedramp:37](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:37) |
| `queueFedrampMessage` | POST `/fedramp-communications/messages/${encodeURIComponent(messageId)}/queue` | [fedramp:42](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:42) |
| `confirmFedrampDelivery` | POST `/fedramp-communications/deliveries/${encodeURIComponent(deliveryId)}/confirm` | [fedramp:47](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:47) |
| `failFedrampDelivery` | POST `/fedramp-communications/deliveries/${encodeURIComponent(deliveryId)}/fail` | [fedramp:55](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:55) |
| `createIncidentNotification` | POST `/fedramp-communications/incidents` | [fedramp:63](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:63) |
| `queueIncidentNotification` | POST `/fedramp-communications/incidents/${encodeURIComponent(incidentId)}/queue` | [fedramp:68](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:68) |
| `confirmIncidentFedramp` | POST `/fedramp-communications/incidents/${encodeURIComponent(incidentId)}/confirm-fedramp` | [fedramp:73](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:73) |
| `confirmIncidentCisa` | POST `/fedramp-communications/incidents/${encodeURIComponent(incidentId)}/confirm-cisa` | [fedramp:78](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:78) |
| `confirmIncidentAgencies` | POST `/fedramp-communications/incidents/${encodeURIComponent(incidentId)}/confirm-agencies` | [fedramp:83](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:83) |
| `syncVdrEvaluations` | POST `/vdr/sync` | [fedramp:88](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:88) |
| `generateVdrReport` | POST `/vdr/reports` | [fedramp:93](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:93) |
| `publishVdrReport` | POST `/vdr/reports/${encodeURIComponent(reportId)}/publish` | [fedramp:98](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:98) |
| `generateOarCycle` | POST `/ccm/oar-cycles` | [fedramp:103](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:103) |
| `publishOarCycle` | POST `/ccm/oar-cycles/${encodeURIComponent(cycleId)}/publish` | [fedramp:108](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:108) |
| `scheduleQuarterlyReview` | POST `/ccm/quarterly-reviews` | [fedramp:113](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:113) |
| `publishQuarterlyReview` | POST `/ccm/quarterly-reviews/${encodeURIComponent(reviewId)}/publish` | [fedramp:118](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:118) |
| `createFeedbackItem` | POST `/ccm/feedback` | [fedramp:123](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:123) |
| `updateFeedbackItem` | PATCH `/ccm/feedback/${encodeURIComponent(feedbackId)}` | [fedramp:128](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:128) |
| `createSignificantChange` | POST `/scn/changes` | [fedramp:133](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:133) |
| `updateSignificantChange` | PATCH `/scn/changes/${encodeURIComponent(changeId)}` | [fedramp:138](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:138) |
| `publishSignificantChangeNotice` | POST `/scn/notices/${encodeURIComponent(noticeId)}/publish` | [fedramp:143](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:143) |
| `createSecureGuide` | POST `/secure-config/guides` | [fedramp:148](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:148) |
| `createSecureRelease` | POST `/secure-config/releases` | [fedramp:153](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:153) |
| `createScopeDocument` | POST `/scope/documents` | [fedramp:158](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:158) |
| `createCryptoInventory` | POST `/crypto/inventory` | [fedramp:163](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/api.ts:163) |

### UI labels and form/control inventory

This inventory supplements the behavior trace with static labels and component locations for every audited page, including subpanels. Dynamic text, list lengths, visibility, business values, and confirmation text must be read in the linked source.

#### HomePage

Source: [apps/web/src/features/home/HomePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx).

- Action/tab label: **Finish guided setup** — [line 91](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:91).
- Action/tab label: **Open program workspace** — [line 92](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:92).
- Action/tab label: **Open assessments** — [line 100](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:100).
- Action/tab label: **Open assurance overview** — [line 107](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:107).
- Action/tab label: **Open package explorer** — [line 108](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:108).
- Action/tab label: **Open auditee portal** — [line 115](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:115).
- Action/tab label: **Open my access** — [line 116](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:116).
- Action/tab label: **Refresh workspace** — [line 124](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:124).
- Action/tab label: **Search the workspace** — [line 584](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:584).
- Action/tab label: **Review workspace analytics** — [line 585](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:585).
- Action/tab label: **Open AI authoring tools** — [line 586](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:586).
- Action/tab label: **Open the assurance command center** — [line 588](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:588).
- Action/tab label: **Open the auditee portal** — [line 590](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:590).
- Action/tab label: **Open Work Queue** — [line 597](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:597).
- Action/tab label: **Portal access** — [line 619](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:619).
- Action/tab label: **Priority work** — [line 625](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:625).
- Action/tab label: **Workspace scope** — [line 631](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:631).
- Action/tab label: **Available areas** — [line 637](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:637).
- Action/tab label: **Assessments** — [line 645](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:645).
- Action/tab label: **Evidence jobs** — [line 657](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:657).
- Action/tab label: **Assurance queue** — [line 663](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:663).
- Title: **Program health** — [line 704](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:704).
- Heading: **What needs attention next** — [line 733](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:733).
- Field/section: **Current posture** — [line 772](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:772).
- Field/section: **Quick links** — [line 807](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:807).
- Heading: **Jump to a workspace** — [line 808](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:808).
- Field/section: **Program areas** — [line 840](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:840).
- Heading: **Work across the program without losing context** — [line 841](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:841).
- Heading: **Assurance package readiness needs attention** — [line 876](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/home/HomePage.tsx:876).

#### DashboardPage

Source: [apps/web/src/features/dashboard/DashboardPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx).

- Action/tab label: **Domains** — [line 217](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:217).
- Action/tab label: **Team Members** — [line 218](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:218).
- Action/tab label: **Access Assignments** — [line 219](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:219).
- Action/tab label: **Frameworks** — [line 220](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:220).
- Action/tab label: **Risk Assessments** — [line 226](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:226).
- Action/tab label: **Compliance Reviews** — [line 227](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:227).
- Action/tab label: **Risk Scenarios** — [line 228](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:228).
- Action/tab label: **Third Parties** — [line 229](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:229).
- Action/tab label: **Report Exports** — [line 235](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:235).
- Action/tab label: **Chat Sessions** — [line 236](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:236).
- Action/tab label: **Import Jobs** — [line 237](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:237).
- Action/tab label: **Portal Assignments** — [line 238](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:238).
- Action/tab label: **Privacy Processings** — [line 244](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:244).
- Action/tab label: **BIA Studies** — [line 245](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:245).
- Action/tab label: **EBIOS Studies** — [line 246](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:246).
- Action/tab label: **Quant Studies** — [line 247](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:247).
- Action/tab label: **Application shell** — [line 254](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:254).
- Action/tab label: **Workspace data** — [line 255](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:255).
- Action/tab label: **Evidence storage** — [line 256](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:256).
- Action/tab label: **Automation jobs** — [line 257](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:257).
- Action/tab label: **Background coordination** — [line 258](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:258).
- Field/section: **Overview** — [line 270](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:270).
- Heading: **CISO Assistant** — [line 271](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:271).
- Field/section: **Active Identity** — [line 298](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:298).
- Field/section: **Operational Areas** — [line 348](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:348).
- Field/section: **Workspace Status** — [line 371](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:371).
- Field/section: **Active Background Work** — [line 418](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/dashboard/DashboardPage.tsx:418).

#### BootstrapAccessPanel

Source: [apps/web/src/features/core/BootstrapAccessPanel.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/BootstrapAccessPanel.tsx).

Uses dynamic/subcomponent labels; read the source and behavior table above.

#### FrameworkDetailPage

Source: [apps/web/src/features/core/FrameworkDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx).

- Field/section: **Catalogue readiness** — [line 125](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:125).
- Heading: **Requirement coverage** — [line 126](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:126).
- Field/section: **Framework key** — [line 133](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:133).
- Field/section: **Version** — [line 137](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:137).
- Field/section: **Category** — [line 141](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:141).
- Field/section: **Requirements** — [line 147](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:147).
- Field/section: **Created** — [line 153](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:153).
- Field/section: **Updated** — [line 157](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:157).
- Field/section: **Downstream use** — [line 162](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:162).
- Field/section: **Catalogue actions** — [line 172](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:172).
- Heading: **Add requirements without leaving context** — [line 173](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:173).
- Field/section: **Requirement Tree** — [line 193](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:193).
- Heading: **Associated Requirements** — [line 194](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:194).
- Title: **Add requirement** — [line 265](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:265).
- Field/section: **Reference** — [line 276](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:276).
- Field/section: **Title** — [line 285](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:285).
- Field/section: **Description** — [line 294](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkDetailPage.tsx:294).

#### FrameworkTree

Source: [apps/web/src/features/core/FrameworkTree.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworkTree.tsx).

Uses dynamic/subcomponent labels; read the source and behavior table above.

#### FrameworksPage

Source: [apps/web/src/features/core/FrameworksPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx).

- Title: **Catalogues Workspace** — [line 311](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:311).
- Field/section: **Scope** — [line 334](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:334).
- Heading: **Control source of truth** — [line 335](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:335).
- Field/section: **Why catalogues matter** — [line 342](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:342).
- Field/section: **Use alongside** — [line 350](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:350).
- Field/section: **Import** — [line 369](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:369).
- Heading: **Bring catalogues into this workspace** — [line 370](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:370).
- Field/section: **Import from system** — [line 397](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:397).
- Field/section: **Import from file** — [line 479](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:479).
- Field/section: **Read-only access** — [line 567](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:567).
- Field/section: **Active catalogues** — [line 587](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:587).
- Field/section: **Requirements loaded** — [line 591](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:591).
- Field/section: **Packaged catalogues ready** — [line 595](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:595).
- Field/section: **Latest update** — [line 599](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:599).
- Field/section: **Manual entry** — [line 612](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:612).
- Heading: **Create a tenant-specific catalogue** — [line 613](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:613).
- Field/section: **Catalogue key** — [line 627](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:627).
- Field/section: **Catalogue name** — [line 636](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:636).
- Field/section: **Version** — [line 646](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:646).
- Field/section: **Category** — [line 655](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/FrameworksPage.tsx:655).

#### MePage

Source: [apps/web/src/features/core/MePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx).

- Field/section: **Workspace** — [line 65](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:65).
- Heading: **My Access** — [line 66](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:66).
- Title: **Use My Access to understand scope before assuming the app is missing something.** — [line 74](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:74).
- Field/section: **Identity** — [line 110](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:110).
- Field/section: **Session** — [line 117](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:117).
- Field/section: **Permissions** — [line 122](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:122).
- Field/section: **Accessible domains** — [line 126](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:126).
- Field/section: **Role Sources** — [line 133](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:133).
- Field/section: **Groups** — [line 164](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:164).
- Field/section: **Domain Perimeter** — [line 178](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:178).
- Field/section: **Local Sign-In** — [line 200](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:200).
- Field/section: **Current password** — [line 238](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:238).
- Field/section: **New password** — [line 249](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:249).
- Field/section: **Confirm new password** — [line 258](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/MePage.tsx:258).

#### SsoCallbackPage

Source: [apps/web/src/features/core/SsoCallbackPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/SsoCallbackPage.tsx).

- Field/section: **Single Sign-On** — [line 94](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/SsoCallbackPage.tsx:94).
- Heading: **Finishing sign-in** — [line 95](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/core/SsoCallbackPage.tsx:95).

#### LibrariesPage

Source: [apps/web/src/features/libraries/LibrariesPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx).

- Field/section: **Catalog** — [line 43](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx:43).
- Heading: **Libraries** — [line 44](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx:44).
- Field/section: **Library Pack** — [line 62](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx:62).
- Field/section: **Reference controls** — [line 74](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx:74).
- Field/section: **Threats** — [line 80](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx:80).
- Field/section: **Risk matrices** — [line 84](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx:84).
- Field/section: **Framework** — [line 90](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibrariesPage.tsx:90).

#### LibraryDetailPage

Source: [apps/web/src/features/libraries/LibraryDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx).

- Field/section: **Catalog** — [line 69](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:69).
- Field/section: **Provider** — [line 76](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:76).
- Field/section: **Packager** — [line 80](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:80).
- Field/section: **Version** — [line 84](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:84).
- Field/section: **Status** — [line 88](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:88).
- Field/section: **Publication date** — [line 100](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:100).
- Field/section: **Framework** — [line 104](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:104).
- Field/section: **Dependencies** — [line 114](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:114).
- Field/section: **Copyright** — [line 128](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:128).
- Heading: **Reference Tree** — [line 141](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:141).
- Field/section: **Risk Matrices** — [line 158](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:158).
- Heading: **Scoring Assets** — [line 159](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/libraries/LibraryDetailPage.tsx:159).

#### AppliedControlsFlashPage

Source: [apps/web/src/features/assessments/AppliedControlsFlashPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx).

- Field/section: **Flash Mode** — [line 139](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:139).
- Field/section: **Status** — [line 154](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:154).
- Field/section: **Priority** — [line 165](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:165).
- Field/section: **Category** — [line 175](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:175).
- Field/section: **CSF function** — [line 179](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:179).
- Field/section: **Owner** — [line 191](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:191).
- Field/section: **Effort** — [line 195](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:195).
- Field/section: **ETA** — [line 206](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:206).
- Field/section: **Expiry date** — [line 210](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:210).
- Field/section: **Control impact** — [line 219](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:219).
- Field/section: **Annual cost** — [line 230](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:230).
- Field/section: **Notes** — [line 243](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsFlashPage.tsx:243).

#### AppliedControlsKanbanPage

Source: [apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx).

- Action/tab label: **Tracking** — [line 11](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:11).
- Action/tab label: **To do** — [line 12](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:12).
- Action/tab label: **In progress** — [line 13](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:13).
- Action/tab label: **On hold** — [line 14](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:14).
- Action/tab label: **Active** — [line 15](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:15).
- Action/tab label: **Deprecated** — [line 16](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:16).
- Field/section: **Remediation** — [line 120](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:120).
- Heading: **Applied Controls Board** — [line 121](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:121).
- Field/section: **Domain** — [line 134](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AppliedControlsKanbanPage.tsx:134).

#### AssessmentEvidencePackagePage

Source: [apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx).

- Action/tab label: **Evidence Requests** — [line 305](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:305).
- Action/tab label: **Core Requests** — [line 310](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:310).
- Action/tab label: **Reviewer Comments** — [line 315](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:315).
- Action/tab label: **Avg Days** — [line 320](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:320).
- Action/tab label: **Control Refs** — [line 325](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:325).
- Action/tab label: **Anomalies** — [line 330](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:330).
- Title: **Scrutiny chain cockpit** — [line 365](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:365).
- Heading: **No assessment packages imported yet** — [line 376](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:376).
- Field/section: **Imported packages** — [line 386](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:386).
- Heading: **Imported Packages** — [line 387](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:387).
- Action/tab label: **Overview** — [line 460](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:460).
- Action/tab label: **Evidence Rollups** — [line 463](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:463).
- Action/tab label: **Reusable Template** — [line 465](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:465).
- Heading: **Control Coverage** — [line 472](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:472).
- Heading: **Family and Owner Bottlenecks** — [line 485](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:485).
- Action/tab label: **Inspect request** — [line 638](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:638).
- Action/tab label: **Open source record** — [line 639](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:639).
- Heading: **Reviewer Comments and Sufficiency Events** — [line 655](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:655).
- Action/tab label: **Inspect comment** — [line 696](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:696).
- Heading: **Evidence Locker Rollups** — [line 714](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:714).
- Action/tab label: **Inspect rollup** — [line 737](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:737).
- Action/tab label: **Open locker record** — [line 738](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:738).
- Heading: **Date and Mapping Anomalies** — [line 760](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:760).
- Action/tab label: **Inspect anomaly** — [line 792](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:792).
- Heading: **Builder Entry** — [line 810](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:810).
- Heading: **Discovery Hooks** — [line 818](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:818).
- Heading: **Historical Integrity** — [line 827](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:827).
- Heading: **Timing** — [line 890](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:890).
- Heading: **Control references** — [line 907](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:907).
- Heading: **Excerpt** — [line 957](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentEvidencePackagePage.tsx:957).

#### AssessmentsPage

Source: [apps/web/src/features/assessments/AssessmentsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx).

- Field/section: **Assessments** — [line 360](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:360).
- Heading: **Assessment Workbench** — [line 361](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:361).
- Field/section: **Perimeters** — [line 373](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:373).
- Field/section: **Risk assessments** — [line 377](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:377).
- Field/section: **Compliance assessments** — [line 381](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:381).
- Field/section: **Frameworks linked** — [line 385](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:385).
- Field/section: **New Perimeter** — [line 416](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:416).
- Field/section: **Domain** — [line 426](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:426).
- Field/section: **Reference ID** — [line 440](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:440).
- Field/section: **Perimeter name** — [line 450](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:450).
- Field/section: **Description** — [line 459](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:459).
- Field/section: **Lifecycle status** — [line 467](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:467).
- Field/section: **New Risk Assessment** — [line 490](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:490).
- Field/section: **Perimeter** — [line 500](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:500).
- Field/section: **Risk register** — [line 514](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:514).
- Field/section: **Version** — [line 534](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:534).
- Field/section: **Status** — [line 538](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:538).
- Field/section: **Assessment name** — [line 549](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:549).
- Field/section: **Observation** — [line 558](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:558).
- Field/section: **Manual and Compliance Assessments** — [line 576](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:576).
- Field/section: **Assessment type** — [line 586](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:586).
- Field/section: **Assessment plan** — [line 598](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:598).
- Field/section: **Framework** — [line 627](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:627).
- Field/section: **Lead assessor** — [line 666](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:666).
- Field/section: **Planned start** — [line 724](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:724).
- Field/section: **Planned finish** — [line 733](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:733).
- Field/section: **Instructions** — [line 743](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:743).
- Field/section: **Process info** — [line 752](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:752).
- Field/section: **Maturity score** — [line 762](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:762).
- Field/section: **Assignment type** — [line 774](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:774).
- Field/section: **Assignment** — [line 785](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:785).
- Field/section: **Source security plan reference** — [line 801](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:801).
- Field/section: **Controls in Scope** — [line 812](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:812).
- Field/section: **Repeat until** — [line 865](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:865).
- Field/section: **Frequency** — [line 874](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/AssessmentsPage.tsx:874).

#### ComplianceActionPlanPage

Source: [apps/web/src/features/assessments/ComplianceActionPlanPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx).

- Field/section: **Remediation** — [line 107](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx:107).
- Field/section: **Assessment** — [line 124](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx:124).
- Field/section: **Framework** — [line 128](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx:128).
- Field/section: **Perimeter** — [line 132](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx:132).
- Field/section: **Annual budget** — [line 161](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx:161).
- Field/section: **Open work** — [line 165](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx:165).
- Field/section: **Tracking only** — [line 173](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx:173).
- Field/section: **Budget lens** — [line 184](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceActionPlanPage.tsx:184).

#### ComplianceAssessmentDetailPage

Source: [apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx).

- Field/section: **Governance** — [line 292](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:292).
- Field/section: **Framework** — [line 301](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:301).
- Field/section: **Perimeter** — [line 305](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:305).
- Field/section: **Progress** — [line 311](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:311).
- Field/section: **Maturity** — [line 315](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:315).
- Field/section: **Assessment type** — [line 319](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:319).
- Field/section: **Assessment progress** — [line 327](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:327).
- Field/section: **Compliant** — [line 341](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:341).
- Field/section: **Partial** — [line 345](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:345).
- Field/section: **Non-compliant** — [line 351](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:351).
- Field/section: **N/A** — [line 355](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:355).
- Field/section: **Not assessed** — [line 361](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:361).
- Field/section: **Assessment record** — [line 369](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:369).
- Field/section: **Result** — [line 596](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:596).
- Field/section: **Evidence status** — [line 607](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:607).
- Field/section: **Implementation score** — [line 629](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:629).
- Field/section: **Documentation score** — [line 641](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:641).
- Field/section: **Observation** — [line 657](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:657).
- Field/section: **Evidence note** — [line 668](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:668).
- Field/section: **Gaps and differences** — [line 677](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:677).
- Field/section: **Likelihood** — [line 689](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:689).
- Field/section: **Impact** — [line 701](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/ComplianceAssessmentDetailPage.tsx:701).

#### RiskAssessmentActionPlanPage

Source: [apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx).

- Action/tab label: **Action plan** — [line 166](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:166).
- Action/tab label: **Budget overview** — [line 167](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:167).
- Field/section: **Treatment items** — [line 177](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:177).
- Field/section: **Annual budget** — [line 185](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:185).
- Field/section: **Highest residual** — [line 189](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:189).
- Field/section: **Assessment** — [line 196](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:196).
- Field/section: **Perimeter** — [line 200](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:200).
- Field/section: **Version** — [line 206](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:206).
- Field/section: **Budget lens** — [line 213](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:213).
- Field/section: **Treatment queue** — [line 224](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:224).
- Action/tab label: **Review treatment** — [line 276](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:276).
- Action/tab label: **Open mapped scenario workspace** — [line 281](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:281).
- Field/section: **Recommended action** — [line 326](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:326).
- Field/section: **Priority** — [line 331](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:331).
- Field/section: **Status** — [line 337](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:337).
- Field/section: **Residual score** — [line 345](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:345).
- Field/section: **Annual cost** — [line 349](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:349).
- Field/section: **Effort** — [line 353](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:353).
- Field/section: **Inherent score** — [line 357](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentActionPlanPage.tsx:357).

#### RiskAssessmentDetailPage

Source: [apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx).

- Field/section: **Risk** — [line 157](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:157).
- Field/section: **Perimeter** — [line 165](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:165).
- Field/section: **Register** — [line 171](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:171).
- Field/section: **Version** — [line 177](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:177).
- Field/section: **Status** — [line 181](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:181).
- Field/section: **Reference** — [line 187](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:187).
- Field/section: **Updated** — [line 191](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:191).
- Field/section: **Observation** — [line 195](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:195).
- Field/section: **Add Scenario** — [line 210](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:210).
- Field/section: **Scenario title** — [line 212](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:212).
- Field/section: **Description** — [line 221](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:221).
- Field/section: **Likelihood** — [line 231](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:231).
- Field/section: **Impact** — [line 243](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:243).
- Field/section: **Scenarios in scope** — [line 275](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:275).
- Field/section: **Open scenarios** — [line 279](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:279).
- Field/section: **Average inherent score** — [line 283](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:283).
- Field/section: **Average residual score** — [line 287](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:287).
- Field/section: **Matrix View** — [line 294](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:294).
- Heading: **Likelihood x Impact Heatmap** — [line 295](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/RiskAssessmentDetailPage.tsx:295).

#### RiskActionTrackerPage

Source: [apps/web/src/features/risk/RiskActionTrackerPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx).

- Title: **Action Tracker** — [line 267](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:267).
- Action/tab label: **All work** — [line 298](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:298).
- Action/tab label: **Findings** — [line 299](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:299).
- Action/tab label: **Tasks** — [line 300](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:300).
- Action/tab label: **Incidents** — [line 301](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:301).
- Action/tab label: **Exceptions** — [line 302](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:302).
- Action/tab label: **Scenarios** — [line 303](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:303).
- Action/tab label: **Inspect action** — [line 373](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:373).
- Action/tab label: **Open source** — [line 377](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskActionTrackerPage.tsx:377).

#### RiskScenariosPage

Source: [apps/web/src/features/risk/RiskScenariosPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx).

- Field/section: **Risk** — [line 295](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:295).
- Heading: **Risk Scenarios** — [line 296](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:296).
- Field/section: **Registers** — [line 330](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:330).
- Heading: **Risk registers** — [line 331](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:331).
- Action/tab label: **Inspect register** — [line 351](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:351).
- Action/tab label: **Edit register** — [line 356](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:356).
- Action/tab label: **Delete register** — [line 361](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:361).
- Field/section: **Scenario library** — [line 391](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:391).
- Heading: **Register scenarios** — [line 392](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:392).
- Action/tab label: **Inspect scenario** — [line 437](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:437).
- Action/tab label: **Edit scenario** — [line 442](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:442).
- Action/tab label: **Delete scenario** — [line 447](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:447).
- Title: **Add risk register** — [line 495](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:495).
- Field/section: **Scope** — [line 506](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:506).
- Field/section: **Register name** — [line 520](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:520).
- Field/section: **Description** — [line 529](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:529).
- Title: **Add risk scenario** — [line 568](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:568).
- Field/section: **Risk register** — [line 579](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:579).
- Field/section: **Scenario title** — [line 593](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:593).
- Field/section: **Likelihood** — [line 612](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:612).
- Field/section: **Impact** — [line 624](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:624).
- Field/section: **Status** — [line 636](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:636).
- Field/section: **Scenarios** — [line 682](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:682).
- Heading: **Recent scenarios** — [line 695](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:695).
- Title: **Edit risk register** — [line 738](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:738).
- Field/section: **Inherent score** — [line 819](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:819).
- Field/section: **Residual score** — [line 823](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:823).
- Title: **Edit risk scenario** — [line 859](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:859).
- Title: **Delete risk register** — [line 957](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:957).
- Title: **Delete risk scenario** — [line 991](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/RiskScenariosPage.tsx:991).

#### ThreatModelsPage

Source: [apps/web/src/features/risk/ThreatModelsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx).

- Field/section: **Risk Modeling** — [line 244](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:244).
- Heading: **Threat Models** — [line 245](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:245).
- Field/section: **Model type** — [line 274](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:274).
- Field/section: **Scale size** — [line 278](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:278).
- Field/section: **Registers** — [line 282](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:282).
- Field/section: **Scenarios** — [line 286](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:286).
- Field/section: **Open scenarios** — [line 290](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:290).
- Field/section: **Elevated exposure** — [line 294](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:294).
- Field/section: **Workspace Notes** — [line 303](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:303).
- Field/section: **How Threat Models Work** — [line 313](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:313).
- Field/section: **Scenario Portfolio** — [line 348](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:348).
- Field/section: **Modeling Coverage** — [line 418](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:418).
- Field/section: **Risk Taxonomy & Scoring** — [line 472](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:472).
- Field/section: **Runtime Contracts** — [line 507](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:507).
- Field/section: **Governance Signals** — [line 523](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:523).
- Field/section: **Scenario Status Mix** — [line 548](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:548).
- Field/section: **Apply To Systems** — [line 568](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/risk/ThreatModelsPage.tsx:568).

#### EbiosStudyDetailPage

Source: [apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx).

- Action/tab label: **Review study snapshot** — [line 180](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:180).
- Action/tab label: **Edit study details** — [line 181](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:181).
- Action/tab label: **Delete study** — [line 182](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:182).
- Field/section: **Perimeter** — [line 190](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:190).
- Field/section: **Reference entity** — [line 194](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:194).
- Field/section: **Status** — [line 198](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:198).
- Field/section: **Workshop progress** — [line 202](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:202).
- Field/section: **Feared Events** — [line 245](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:245).
- Field/section: **Stakeholders and Scenarios** — [line 264](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:264).
- Title: **EBIOS study snapshot** — [line 301](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:301).
- Title: **Edit EBIOS study** — [line 339](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:339).
- Field/section: **Name** — [line 350](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:350).
- Field/section: **Description** — [line 358](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:358).
- Field/section: **Quotation method** — [line 380](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:380).
- Field/section: **Version** — [line 393](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:393).
- Field/section: **Observation** — [line 401](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:401).
- Title: **Delete EBIOS study** — [line 425](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosStudyDetailPage.tsx:425).

#### EbiosWorkspacePage

Source: [apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx).

- Field/section: **Advanced Risk** — [line 102](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:102).
- Heading: **EBIOS RM** — [line 103](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:103).
- Field/section: **Workshop progress** — [line 140](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:140).
- Field/section: **Feared events** — [line 144](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:144).
- Field/section: **Strategic scenarios** — [line 148](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:148).
- Field/section: **Operational scenarios** — [line 152](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:152).
- Title: **Create EBIOS study** — [line 174](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:174).
- Field/section: **Domain** — [line 185](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:185).
- Field/section: **Perimeter** — [line 195](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:195).
- Field/section: **Reference entity** — [line 205](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:205).
- Field/section: **Name** — [line 215](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:215).
- Field/section: **Reference** — [line 219](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:219).
- Field/section: **Description** — [line 223](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/EbiosWorkspacePage.tsx:223).

#### QuantitativeActionPlanPage

Source: [apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx).

- Field/section: **Budget** — [line 128](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:128).
- Field/section: **Actions** — [line 132](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:132).
- Field/section: **Assigned** — [line 136](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:136).
- Field/section: **Scenario links** — [line 140](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:140).
- Field/section: **Treatment queue** — [line 148](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:148).
- Heading: **Scenario-derived actions** — [line 149](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:149).
- Action/tab label: **Review action** — [line 181](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:181).
- Action/tab label: **Open scenario** — [line 186](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:186).
- Field/section: **Deterministic source** — [line 231](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:231).
- Field/section: **Scenario** — [line 239](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:239).
- Field/section: **Owner** — [line 243](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:243).
- Field/section: **Status** — [line 249](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:249).
- Field/section: **Annual cost** — [line 257](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeActionPlanPage.tsx:257).

#### QuantitativeExecutiveSummaryPage

Source: [apps/web/src/features/advanced-risk/QuantitativeExecutiveSummaryPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeExecutiveSummaryPage.tsx).

- Field/section: **Executive Summary** — [line 57](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeExecutiveSummaryPage.tsx:57).
- Field/section: **Risk register** — [line 66](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeExecutiveSummaryPage.tsx:66).
- Field/section: **Scenarios** — [line 70](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeExecutiveSummaryPage.tsx:70).
- Field/section: **Threshold** — [line 74](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeExecutiveSummaryPage.tsx:74).

#### QuantitativeHypothesisDetailPage

Source: [apps/web/src/features/advanced-risk/QuantitativeHypothesisDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeHypothesisDetailPage.tsx).

- Field/section: **Probability** — [line 82](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeHypothesisDetailPage.tsx:82).
- Field/section: **Impact low** — [line 86](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeHypothesisDetailPage.tsx:86).
- Field/section: **Impact high** — [line 92](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeHypothesisDetailPage.tsx:92).
- Field/section: **ALE** — [line 98](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeHypothesisDetailPage.tsx:98).

#### QuantitativeKeyMetricsPage

Source: [apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx).

- Field/section: **Key Metrics** — [line 70](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx:70).
- Heading: **Portfolio Metrics** — [line 71](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx:71).
- Field/section: **Current ALE** — [line 78](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx:78).
- Field/section: **Residual ALE** — [line 84](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx:84).
- Field/section: **Risk reduction** — [line 90](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx:90).
- Field/section: **Above threshold** — [line 96](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx:96).
- Field/section: **Scenarios** — [line 100](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeKeyMetricsPage.tsx:100).

#### QuantitativeScenarioDetailPage

Source: [apps/web/src/features/advanced-risk/QuantitativeScenarioDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeScenarioDetailPage.tsx).

- Field/section: **Current ALE** — [line 77](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeScenarioDetailPage.tsx:77).
- Field/section: **Residual ALE** — [line 83](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeScenarioDetailPage.tsx:83).
- Field/section: **Owner** — [line 89](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeScenarioDetailPage.tsx:89).
- Field/section: **Status** — [line 93](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeScenarioDetailPage.tsx:93).
- Field/section: **Hypotheses** — [line 99](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeScenarioDetailPage.tsx:99).

#### QuantitativeStudyDetailPage

Source: [apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx).

- Action/tab label: **Review study snapshot** — [line 199](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:199).
- Action/tab label: **Edit study details** — [line 200](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:200).
- Action/tab label: **Delete study** — [line 201](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:201).
- Field/section: **Current ALE** — [line 230](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:230).
- Field/section: **Residual ALE** — [line 236](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:236).
- Field/section: **Risk reduction** — [line 242](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:242).
- Field/section: **Threshold breaches** — [line 248](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:248).
- Title: **Quantitative study snapshot** — [line 300](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:300).
- Title: **Edit quantitative study** — [line 338](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:338).
- Field/section: **Name** — [line 349](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:349).
- Field/section: **Description** — [line 357](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:357).
- Field/section: **Status** — [line 366](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:366).
- Field/section: **Distribution model** — [line 379](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:379).
- Field/section: **Currency** — [line 393](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:393).
- Field/section: **Loss threshold** — [line 401](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:401).
- Field/section: **Version** — [line 411](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:411).
- Field/section: **Observation** — [line 419](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:419).
- Title: **Delete quantitative study** — [line 443](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeStudyDetailPage.tsx:443).

#### QuantitativeWorkspacePage

Source: [apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx).

- Field/section: **Advanced Risk** — [line 103](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:103).
- Heading: **Quantitative Studies** — [line 104](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:104).
- Field/section: **Current ALE** — [line 141](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:141).
- Field/section: **Residual ALE** — [line 147](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:147).
- Field/section: **Risk reduction** — [line 153](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:153).
- Field/section: **Scenarios** — [line 159](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:159).
- Title: **Create quantitative study** — [line 181](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:181).
- Field/section: **Domain** — [line 192](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:192).
- Field/section: **Risk register** — [line 202](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:202).
- Field/section: **Name** — [line 212](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:212).
- Field/section: **Reference** — [line 216](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:216).
- Field/section: **Description** — [line 220](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:220).
- Field/section: **Loss threshold** — [line 224](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/QuantitativeWorkspacePage.tsx:224).

#### RiskAssessmentConversionPage

Source: [apps/web/src/features/advanced-risk/RiskAssessmentConversionPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/RiskAssessmentConversionPage.tsx).

- Field/section: **Quantitative Migration** — [line 9](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/RiskAssessmentConversionPage.tsx:9).
- Heading: **Convert to Quantitative Study** — [line 10](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/advanced-risk/RiskAssessmentConversionPage.tsx:10).

#### FindingsExplorerPage

Source: [apps/web/src/features/grc/FindingsExplorerPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx).

- Title: **Findings Explorer** — [line 107](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:107).
- Field/section: **Assessment-ready intake** — [line 127](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:127).
- Heading: **Filters** — [line 128](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:128).
- Field/section: **Findings** — [line 203](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:203).
- Field/section: **Finding detail** — [line 258](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:258).
- Field/section: **Status** — [line 276](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:276).
- Field/section: **Severity** — [line 280](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:280).
- Field/section: **Evaluations** — [line 284](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:284).
- Field/section: **Evidence refs** — [line 288](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:288).
- Field/section: **Resource scope** — [line 294](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:294).
- Field/section: **Type** — [line 297](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:297).
- Field/section: **Collected** — [line 301](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:301).
- Field/section: **Account** — [line 305](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:305).
- Field/section: **Region** — [line 309](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:309).
- Field/section: **Control evaluations** — [line 316](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FindingsExplorerPage.tsx:316).

#### FrameworkKnowledgeDetailPage

Source: [apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx).

- Field/section: **Catalogue key** — [line 148](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx:148).
- Field/section: **SCF framework** — [line 152](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx:152).
- Field/section: **Documents** — [line 156](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx:156).
- Field/section: **Updated** — [line 160](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx:160).
- Field/section: **Imported catalogue documents** — [line 180](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx:180).
- Field/section: **Catalogue tutoring** — [line 233](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx:233).
- Heading: **Crosswalk & control guidance** — [line 234](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx:234).
- Field/section: **SCF controls** — [line 256](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx:256).
- Field/section: **Target obligations** — [line 271](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx:271).

#### FrameworkLibraryPage

Source: [apps/web/src/features/grc/FrameworkLibraryPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx).

- Title: **Catalogue Library** — [line 113](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:113).
- Field/section: **Packaged catalogues** — [line 142](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:142).
- Field/section: **Imported findings** — [line 146](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:146).
- Field/section: **Gap assessments** — [line 150](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:150).
- Field/section: **Report bundles** — [line 154](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:154).
- Field/section: **Packaged import status** — [line 162](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:162).
- Field/section: **Latest curated snapshot** — [line 169](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:169).
- Field/section: **Search** — [line 194](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:194).
- Heading: **Managed catalogue content** — [line 195](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:195).
- Field/section: **Catalogue key** — [line 232](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:232).
- Field/section: **Documents** — [line 236](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:236).
- Field/section: **SCF mapping** — [line 240](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:240).
- Field/section: **Updated** — [line 244](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:244).
- Title: **Import packaged catalogues** — [line 291](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:291).
- Field/section: **Catalogues** — [line 296](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:296).
- Field/section: **Managed documents** — [line 300](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/FrameworkLibraryPage.tsx:300).

#### GapAssessmentDetailPage

Source: [apps/web/src/features/grc/GapAssessmentDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx).

- Field/section: **Frameworks** — [line 169](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:169).
- Field/section: **Sources** — [line 173](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:173).
- Field/section: **Findings** — [line 177](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:177).
- Field/section: **Gap rows** — [line 181](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:181).
- Field/section: **AI narrative** — [line 185](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:185).
- Field/section: **Selected gap** — [line 231](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:231).
- Field/section: **SCF control** — [line 238](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:238).
- Field/section: **Status** — [line 242](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:242).
- Field/section: **Severity** — [line 246](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:246).
- Field/section: **Evidence refs** — [line 250](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:250).
- Field/section: **Description** — [line 256](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:256).
- Field/section: **Mapped target controls** — [line 263](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:263).
- Field/section: **Report bundles** — [line 290](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:290).
- Heading: **Assessment outputs** — [line 291](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:291).
- Field/section: **Evidence & reporting** — [line 328](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:328).
- Heading: **Executive artifacts** — [line 329](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:329).
- Field/section: **Evidence package** — [line 361](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:361).
- Title: **Create evidence package** — [line 431](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:431).
- Field/section: **Assessment** — [line 436](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:436).
- Field/section: **Evidence packages** — [line 444](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:444).
- Title: **Create report bundle** — [line 473](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:473).
- Field/section: **Current bundles** — [line 482](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:482).
- Field/section: **Audience** — [line 532](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentDetailPage.tsx:532).

#### GapAssessmentsPage

Source: [apps/web/src/features/grc/GapAssessmentsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx).

- Title: **Gap Assessment Workspace** — [line 78](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx:78).
- Field/section: **Assessment history** — [line 106](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx:106).
- Heading: **Recent runs** — [line 107](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx:107).
- Field/section: **Sources** — [line 140](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx:140).
- Field/section: **Findings** — [line 144](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx:144).
- Field/section: **Gaps** — [line 148](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx:148).
- Field/section: **Updated** — [line 152](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx:152).
- Title: **Run gap assessment** — [line 183](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GapAssessmentsPage.tsx:183).

#### GrcAdministrationPage

Source: [apps/web/src/features/grc/GrcAdministrationPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx).

- Field/section: **GRC Content Administration** — [line 205](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:205).
- Heading: **Knowledge & AI Control Plane** — [line 206](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:206).
- Field/section: **Assessor scrutiny workflow** — [line 212](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:212).
- Field/section: **Imported corpus** — [line 230](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:230).
- Heading: **Curated snapshot status** — [line 231](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:231).
- Field/section: **Frameworks** — [line 234](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:234).
- Field/section: **Documents** — [line 238](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:238).
- Field/section: **SCF version** — [line 242](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:242).
- Field/section: **SCF frameworks** — [line 246](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:246).
- Field/section: **Normalized findings** — [line 253](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:253).
- Field/section: **Evidence packages** — [line 257](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:257).
- Field/section: **Recent jobs** — [line 261](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:261).
- Field/section: **Latest snapshot** — [line 267](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:267).
- Field/section: **Provider-neutral AI** — [line 282](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:282).
- Heading: **GRC backend settings** — [line 283](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:283).
- Field/section: **Native collectors** — [line 361](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:361).
- Heading: **Priority connector status** — [line 362](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:362).
- Field/section: **Runs** — [line 378](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:378).
- Field/section: **Last success** — [line 382](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:382).
- Field/section: **Provider** — [line 388](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:388).
- Field/section: **Maintenance actions** — [line 415](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:415).
- Heading: **Content operations** — [line 416](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:416).
- Field/section: **Recent background work** — [line 433](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:433).
- Title: **GRC job result** — [line 536](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:536).
- Field/section: **Request** — [line 566](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:566).
- Field/section: **Result** — [line 572](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:572).
- Field/section: **Diagnostics** — [line 578](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/GrcAdministrationPage.tsx:578).

#### ReportBundleDetailPage

Source: [apps/web/src/features/grc/ReportBundleDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx).

- Field/section: **Assessment** — [line 80](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:80).
- Field/section: **Status** — [line 84](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:84).
- Field/section: **AI provider** — [line 88](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:88).
- Field/section: **Report family** — [line 92](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:92).
- Field/section: **Narrative summary** — [line 102](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:102).
- Heading: **Assessment storyline** — [line 103](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:103).
- Field/section: **Manifest payload** — [line 109](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:109).
- Field/section: **Connected surfaces** — [line 118](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:118).
- Heading: **Next step** — [line 119](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:119).
- Field/section: **Connected delivery** — [line 135](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundleDetailPage.tsx:135).

#### ReportBundlesPage

Source: [apps/web/src/features/grc/ReportBundlesPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundlesPage.tsx).

- Title: **Report Bundle View** — [line 47](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundlesPage.tsx:47).
- Field/section: **Bundle catalog** — [line 63](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundlesPage.tsx:63).
- Heading: **Generated outputs** — [line 64](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundlesPage.tsx:64).
- Field/section: **Assessment** — [line 97](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundlesPage.tsx:97).
- Field/section: **AI provider** — [line 101](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundlesPage.tsx:101).
- Field/section: **Created** — [line 105](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundlesPage.tsx:105).
- Field/section: **Download** — [line 109](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ReportBundlesPage.tsx:109).

#### ScrutinyEnginePage

Source: [apps/web/src/features/grc/ScrutinyEnginePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx).

- Heading: **Assessor scrutiny cockpit** — [line 388](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:388).
- Tab: **Scope** — [line 430](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:430).
- Tab: **Draft Questions** — [line 431](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:431).
- Tab: **Evidence Requests** — [line 432](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:432).
- Tab: **Evidence Responses** — [line 433](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:433).
- Tab: **Sufficiency Review** — [line 434](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:434).
- Tab: **Comment Trail** — [line 435](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:435).
- Tab: **Missing Feeds** — [line 436](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:436).
- Tab: **Materialized Records** — [line 437](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:437).
- Field/section: **Run title** — [line 529](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:529).
- Field/section: **Folder scope** — [line 537](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:537).
- Field/section: **Scope type** — [line 554](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:554).
- Field/section: **Package marker** — [line 567](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:567).
- Field/section: **Control refs** — [line 576](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:576).
- Field/section: **Module key** — [line 585](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:585).
- Field/section: **Record id** — [line 594](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:594).
- Field/section: **Items** — [line 996](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:996).
- Field/section: **Missing feeds** — [line 1000](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:1000).
- Field/section: **Challenges** — [line 1004](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:1004).
- Field/section: **Comment body** — [line 1048](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/grc/ScrutinyEnginePage.tsx:1048).

#### AgentRunInspectorPage

Source: [apps/web/src/features/assurance/AgentRunInspectorPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx).

- Field/section: **Assurance** — [line 558](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:558).
- Heading: **Agent Run Inspector** — [line 559](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:559).
- Title: **Use Agent Run Inspector to verify the automation boundary.** — [line 567](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:567).
- Field/section: **Observable Security Agent import** — [line 578](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:578).
- Field/section: **Agent runs** — [line 605](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:605).
- Field/section: **Selected run** — [line 658](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:658).
- Field/section: **Steps** — [line 680](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:680).
- Field/section: **Blocked actions** — [line 684](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:684).
- Field/section: **Pending writebacks** — [line 688](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:688).
- Field/section: **Open gaps** — [line 692](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:692).
- Field/section: **Threat hunt** — [line 696](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:696).
- Field/section: **Validation** — [line 700](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:700).
- Field/section: **Proof chain** — [line 707](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:707).
- Field/section: **Source confidence** — [line 715](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:715).
- Field/section: **Rejected records** — [line 721](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:721).
- Field/section: **Live collection coverage** — [line 727](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:727).
- Action/tab label: **Derivation trace** — [line 747](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:747).
- Action/tab label: **Remediation focus** — [line 748](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:748).
- Action/tab label: **Executive summary** — [line 749](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:749).
- Field/section: **Execution trace** — [line 769](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:769).
- Field/section: **Policy decisions** — [line 798](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:798).
- Field/section: **Selected trace step** — [line 829](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:829).
- Field/section: **Selected policy decision** — [line 860](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:860).
- Field/section: **Agent artifact preview** — [line 887](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:887).
- Field/section: **Run summary** — [line 941](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:941).
- Field/section: **Writeback approvals** — [line 989](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:989).
- Field/section: **Reviewer note** — [line 991](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:991).
- Action/tab label: **Inspect writeback** — [line 1033](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:1033).
- Action/tab label: **Approve** — [line 1046](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:1046).
- Action/tab label: **Reject** — [line 1051](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:1051).
- Action/tab label: **Request more evidence** — [line 1057](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:1057).
- Action/tab label: **Mark duplicate** — [line 1062](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:1062).
- Field/section: **Selected writeback** — [line 1081](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:1081).
- Title: **Writeback request** — [line 1151](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:1151).
- Field/section: **Review rationale** — [line 1174](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:1174).
- Field/section: **Evidence refs** — [line 1181](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:1181).
- Field/section: **Payload** — [line 1195](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AgentRunInspectorPage.tsx:1195).

#### AssuranceEvidenceExplorerPage

Source: [apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx).

- Title: **Evidence Explorer** — [line 431](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:431).
- Field/section: **Evidence jobs** — [line 455](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:455).
- Field/section: **Selected evidence job** — [line 501](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:501).
- Field/section: **Declared inventory** — [line 551](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:551).
- Field/section: **Findings** — [line 555](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:555).
- Field/section: **Alert rules** — [line 559](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:559).
- Field/section: **Tickets** — [line 563](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:563).
- Field/section: **Artifact preview** — [line 577](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:577).
- Action/tab label: **Assessor** — [line 593](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:593).
- Action/tab label: **Derivation trace** — [line 594](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:594).
- Action/tab label: **Reasonableness** — [line 595](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:595).
- Action/tab label: **Remediation** — [line 596](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:596).
- Field/section: **Artifacts** — [line 615](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:615).
- Field/section: **Evaluation summary** — [line 642](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:642).
- Field/section: **PASS** — [line 646](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:646).
- Field/section: **PARTIAL** — [line 650](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:650).
- Field/section: **FAIL** — [line 654](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:654).
- Field/section: **POA&amp;M** — [line 658](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:658).
- Field/section: **Collection coverage** — [line 671](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:671).
- Field/section: **Reasonableness findings** — [line 698](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:698).
- Field/section: **Pending review recommendations** — [line 723](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:723).
- Field/section: **Top failing checks** — [line 749](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:749).
- Field/section: **Open gaps** — [line 770](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:770).
- Field/section: **POA&amp;M queue** — [line 792](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:792).
- Field/section: **Evidence graph** — [line 818](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:818).
- Field/section: **Nodes** — [line 821](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:821).
- Field/section: **Edges** — [line 825](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:825).
- Field/section: **Node types** — [line 829](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:829).
- Field/section: **Edge types** — [line 833](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:833).
- Field/section: **Inspect node** — [line 860](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:860).
- Field/section: **Connected records** — [line 887](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceEvidenceExplorerPage.tsx:887).

#### AssuranceExplainPanel

Source: [apps/web/src/features/assurance/AssuranceExplainPanel.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceExplainPanel.tsx).

- Field/section: **Audience** — [line 119](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceExplainPanel.tsx:119).
- Field/section: **Focus** — [line 139](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceExplainPanel.tsx:139).
- Field/section: **Question** — [line 159](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceExplainPanel.tsx:159).
- Field/section: **Highlights** — [line 199](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceExplainPanel.tsx:199).
- Field/section: **Suggested actions** — [line 212](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceExplainPanel.tsx:212).
- Field/section: **Evidence refs** — [line 225](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceExplainPanel.tsx:225).

#### AssuranceOverviewPage

Source: [apps/web/src/features/assurance/AssuranceOverviewPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx).

- Action/tab label: **Evidence** — [line 420](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:420).
- Action/tab label: **Tracker** — [line 421](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:421).
- Action/tab label: **Focus** — [line 422](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:422).
- Field/section: **Assurance** — [line 464](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:464).
- Heading: **Assurance Overview** — [line 465](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:465).
- Title: **Assurance is a flow from evidence to review to package.** — [line 490](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:490).
- Field/section: **Evidence jobs** — [line 499](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:499).
- Field/section: **Tracker imports** — [line 503](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:503).
- Field/section: **Package mismatches** — [line 508](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:508).
- Field/section: **Verified packages** — [line 512](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:512).
- Field/section: **Agent-backed packages** — [line 516](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:516).
- Field/section: **Validation drift** — [line 520](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:520).
- Field/section: **Pending reviews** — [line 524](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:524).
- Field/section: **Pending writebacks** — [line 528](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:528).
- Field/section: **Failed workflows** — [line 532](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:532).
- Field/section: **Assurance readiness** — [line 541](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:541).
- Field/section: **Attention queue** — [line 715](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:715).
- Action/tab label: **Tracker reviewer** — [line 789](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:789).
- Action/tab label: **Assessor** — [line 791](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:791).
- Action/tab label: **Executive** — [line 792](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:792).
- Action/tab label: **Authorizing official** — [line 793](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:793).
- Action/tab label: **Derivation trace** — [line 794](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:794).
- Action/tab label: **Reasonableness** — [line 795](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:795).
- Action/tab label: **Remediation focus** — [line 796](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:796).
- Title: **Inspect assurance action** — [line 850](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:850).
- Field/section: **Backlog posture** — [line 891](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:891).
- Field/section: **Latest handoffs** — [line 917](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:917).
- Field/section: **Human review** — [line 947](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:947).
- Field/section: **Tracker rows with errors** — [line 1095](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:1095).
- Field/section: **Recent assurance workflows** — [line 1129](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceOverviewPage.tsx:1129).

#### AssuranceWorkflowPanel

Source: [apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx).

- Action/tab label: **Evidence** — [line 81](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:81).
- Action/tab label: **Package** — [line 84](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:84).
- Action/tab label: **Tracker** — [line 87](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:87).
- Action/tab label: **Review** — [line 90](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:90).
- Action/tab label: **Agent** — [line 93](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:93).
- Field/section: **Running** — [line 197](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:197).
- Field/section: **Awaiting review** — [line 201](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:201).
- Field/section: **Completed** — [line 205](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:205).
- Field/section: **Failed** — [line 209](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:209).
- Field/section: **Run context** — [line 273](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:273).
- Field/section: **Workflow metadata** — [line 292](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/AssuranceWorkflowPanel.tsx:292).

#### PackageExplorerPage

Source: [apps/web/src/features/assurance/PackageExplorerPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx).

- Field/section: **Assurance** — [line 477](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:477).
- Heading: **20x Package Explorer** — [line 478](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:478).
- Title: **Use Package Explorer to decide whether an output is truly share-ready.** — [line 486](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:486).
- Field/section: **Package jobs** — [line 498](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:498).
- Field/section: **Selected package** — [line 546](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:546).
- Action/tab label: **Inspect readiness** — [line 572](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:572).
- Action/tab label: **Inspect current artifact** — [line 577](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:577).
- Action/tab label: **Inspect review history** — [line 582](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:582).
- Action/tab label: **Open evidence explorer** — [line 587](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:587).
- Action/tab label: **Open review queue** — [line 594](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:594).
- Field/section: **Evaluations** — [line 608](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:608).
- Field/section: **Gaps** — [line 612](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:612).
- Field/section: **POA&amp;M** — [line 616](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:616).
- Field/section: **Generated** — [line 620](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:620).
- Field/section: **Accepted Reviews** — [line 624](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:624).
- Field/section: **Validation** — [line 628](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:628).
- Field/section: **Mismatch triage** — [line 638](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:638).
- Field/section: **Validation rollup** — [line 672](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:672).
- Field/section: **Reconciliation posture** — [line 698](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:698).
- Field/section: **Review ledger** — [line 718](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:718).
- Field/section: **Package lineage** — [line 736](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:736).
- Action/tab label: **Assessor** — [line 765](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:765).
- Action/tab label: **Executive** — [line 766](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:766).
- Action/tab label: **Authorizing official** — [line 767](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:767).
- Action/tab label: **Derivation trace** — [line 768](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:768).
- Action/tab label: **Remediation focus** — [line 769](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:769).
- Field/section: **Package artifact preview** — [line 793](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:793).
- Field/section: **Package summary** — [line 869](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:869).
- Field/section: **Embedded agent security** — [line 893](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:893).
- Field/section: **Validation failures** — [line 1057](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1057).
- Field/section: **Priority findings** — [line 1095](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1095).
- Field/section: **POA&amp;M readiness** — [line 1137](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1137).
- Field/section: **Reconciliation checks** — [line 1170](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1170).
- Field/section: **Report bundle** — [line 1195](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1195).
- Field/section: **Evidence lineage** — [line 1232](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1232).
- Field/section: **Review ledger decisions** — [line 1274](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1274).
- Field/section: **Recent review decisions** — [line 1310](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1310).
- Title: **Package readiness** — [line 1337](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1337).
- Field/section: **Package job** — [line 1355](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1355).
- Field/section: **Handoff health** — [line 1398](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1398).
- Title: **Current package artifact** — [line 1427](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1427).
- Field/section: **Artifact family** — [line 1439](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1439).
- Field/section: **Object metadata** — [line 1458](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1458).
- Title: **Package review history** — [line 1476](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1476).
- Field/section: **Decision rollup** — [line 1493](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1493).
- Field/section: **Accepted** — [line 1496](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1496).
- Field/section: **Rejected** — [line 1500](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1500).
- Field/section: **Linked** — [line 1504](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1504).
- Field/section: **Embedded ledger decisions** — [line 1512](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1512).
- Field/section: **Recent linked decisions** — [line 1529](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/PackageExplorerPage.tsx:1529).

#### ReviewQueuePage

Source: [apps/web/src/features/assurance/ReviewQueuePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx).

- Field/section: **Assurance** — [line 290](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:290).
- Heading: **Review Queue** — [line 291](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:291).
- Title: **Use Review Queue to make explicit human decisions, not silent overrides.** — [line 299](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:299).
- Field/section: **Pending recommendations** — [line 322](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:322).
- Field/section: **Selected recommendation** — [line 369](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:369).
- Action/tab label: **Inspect recommendation** — [line 375](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:375).
- Action/tab label: **Open evidence bundle** — [line 382](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:382).
- Action/tab label: **Accept** — [line 389](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:389).
- Action/tab label: **Reject** — [line 398](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:398).
- Field/section: **Justification** — [line 420](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:420).
- Action/tab label: **Remediation** — [line 481](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:481).
- Action/tab label: **Derivation trace** — [line 482](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:482).
- Field/section: **Decision history** — [line 510](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:510).
- Field/section: **Selected decision** — [line 559](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:559).
- Field/section: **Target type** — [line 693](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:693).
- Field/section: **Target id** — [line 697](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:697).
- Field/section: **Evidence refs** — [line 701](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:701).
- Field/section: **Control refs** — [line 712](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:712).
- Field/section: **Recommendation payload** — [line 725](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:725).
- Field/section: **Recommendation** — [line 770](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:770).
- Field/section: **Reviewer note** — [line 776](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/ReviewQueuePage.tsx:776).

#### TrackerWorkbenchPage

Source: [apps/web/src/features/assurance/TrackerWorkbenchPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx).

- Field/section: **Assurance** — [line 413](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:413).
- Heading: **Tracker Workbench** — [line 414](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:414).
- Title: **Use Tracker as the intake-and-diagnostics layer.** — [line 422](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:422).
- Field/section: **Tracker intake** — [line 435](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:435).
- Heading: **New tracker import** — [line 436](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:436).
- Field/section: **Selected import** — [line 490](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:490).
- Action/tab label: **Review conversion** — [line 533](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:533).
- Action/tab label: **Open latest evidence bundle** — [line 540](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:540).
- Action/tab label: **Open latest package** — [line 548](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:548).
- Field/section: **Open rows** — [line 562](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:562).
- Field/section: **High** — [line 566](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:566).
- Field/section: **Critical** — [line 570](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:570).
- Field/section: **Packages** — [line 574](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:574).
- Field/section: **Status posture** — [line 581](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:581).
- Field/section: **Top categories** — [line 595](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:595).
- Field/section: **Top owners** — [line 608](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:608).
- Field/section: **Tracker artifacts** — [line 631](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:631).
- Field/section: **Artifact preview** — [line 637](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:637).
- Field/section: **Row diagnostics** — [line 666](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:666).
- Field/section: **Selected row** — [line 712](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:712).
- Field/section: **Raw row payload** — [line 771](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:771).
- Action/tab label: **Tracker reviewer** — [line 780](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:780).
- Field/section: **Generated packages** — [line 807](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:807).
- Field/section: **Domain** — [line 858](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:858).
- Field/section: **Import name** — [line 868](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:868).
- Field/section: **Tracker rows JSON** — [line 872](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:872).
- Title: **Convert tracker import to 20x** — [line 900](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assurance/TrackerWorkbenchPage.tsx:900).

#### EvidenceJobsPage

Source: [apps/web/src/features/evidence/EvidenceJobsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceJobsPage.tsx).

- Field/section: **Evidence** — [line 44](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceJobsPage.tsx:44).
- Heading: **Queue-Driven Evidence Jobs** — [line 45](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceJobsPage.tsx:45).

#### EvidenceManagementPage

Source: [apps/web/src/features/evidence/EvidenceManagementPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx).

- Action/tab label: **Sources** — [line 142](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:142).
- Action/tab label: **Queued / Running** — [line 147](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:147).
- Action/tab label: **Artifacts** — [line 152](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:152).
- Action/tab label: **Successful Jobs** — [line 157](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:157).
- Field/section: **Evidence** — [line 257](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:257).
- Heading: **Evidence Management** — [line 258](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:258).
- Field/section: **Assurance** — [line 274](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:274).
- Tab: **Jobs** — [line 324](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:324).
- Title: **Add evidence source** — [line 494](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:494).
- Title: **Queue evidence collection** — [line 599](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:599).
- Title: **Delete evidence source** — [line 642](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceManagementPage.tsx:642).

#### EvidenceSourcesPage

Source: [apps/web/src/features/evidence/EvidenceSourcesPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx).

- Field/section: **Evidence** — [line 124](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:124).
- Heading: **Evidence Collection Sources** — [line 125](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:125).
- Title: **Add evidence source** — [line 223](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:223).
- Field/section: **Source name** — [line 234](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:234).
- Field/section: **Provider** — [line 243](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:243).
- Field/section: **AWS region** — [line 259](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:259).
- Field/section: **Access key id** — [line 267](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:267).
- Field/section: **Secret access key** — [line 275](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:275).
- Field/section: **Session token** — [line 284](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:284).
- Title: **Queue evidence collection** — [line 325](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/evidence/EvidenceSourcesPage.tsx:325).

#### FedrampProviderShellPage

Source: [apps/web/src/features/fedramp/FedrampProviderShellPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx).

- Field/section: **FedRAMP 20x** — [line 556](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:556).
- Heading: **Provider Process Shell** — [line 557](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:557).
- Title: **Offering, catalog, and publication** — [line 578](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:578).
- Field: **Offering name** — [line 601](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:601).
- Field: **Marketplace URL** — [line 602](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:602).
- Field: **Primary contact email** — [line 608](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:608).
- Field: **Public access guidance** — [line 627](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:627).
- Field/section: **Public manifest** — [line 641](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:641).
- Field/section: **Recent artifacts** — [line 652](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:652).
- Field: **Service name** — [line 688](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:688).
- Field: **Service summary** — [line 689](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:689).
- Field: **Security objectives (CSV)** — [line 690](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:690).
- Field: **Customer responsibilities (CSV)** — [line 695](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:695).
- Field: **Agency name** — [line 719](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:719).
- Field: **Agency contact email** — [line 720](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:720).
- Field: **Expires on (ISO)** — [line 727](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:727).
- Title: **Security inbox, routing, and audit trail** — [line 737](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:737).
- Field: **Contact name** — [line 768](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:768).
- Field: **Contact email** — [line 769](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:769).
- Field: **Role** — [line 770](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:770).
- Field: **Subject** — [line 795](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:795).
- Field: **Body (Markdown)** — [line 809](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:809).
- Field: **Incident title** — [line 830](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:830).
- Title: **Persistent reporting cadence** — [line 958](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:958).
- Field: **Question** — [line 1144](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1144).
- Field: **Response / addendum** — [line 1145](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1145).
- Title: **Significant change records and notices** — [line 1179](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1179).
- Field: **Change title** — [line 1202](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1202).
- Field: **Description** — [line 1215](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1215).
- Field: **Planned start (ISO)** — [line 1216](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1216).
- Title: **Guide, defaults, and release history** — [line 1265](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1265).
- Field: **Guide title** — [line 1284](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1284).
- Field: **Summary** — [line 1285](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1285).
- Field: **Guide markdown** — [line 1286](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1286).
- Field: **Version label** — [line 1311](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1311).
- Field: **Release notes** — [line 1312](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1312).
- Field: **Defaults JSON** — [line 1313](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1313).
- Title: **Boundary formalization and crypto inventory** — [line 1342](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1342).
- Field: **Scope title** — [line 1361](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1361).
- Field: **Narrative markdown** — [line 1362](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1362).
- Field: **Module name** — [line 1389](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1389).
- Field: **Validation status** — [line 1390](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1390).
- Field: **CMVP certificate** — [line 1395](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/fedramp/FedrampProviderShellPage.tsx:1395).

#### ChatWorkspacePage

Source: [apps/web/src/features/chat/ChatWorkspacePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx).

- Field/section: **Chat** — [line 109](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:109).
- Heading: **Workspace Guidance Chat** — [line 110](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:110).
- Field/section: **Provider** — [line 118](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:118).
- Field/section: **Sessions** — [line 122](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:122).
- Field/section: **Ready** — [line 126](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:126).
- Field/section: **Domain** — [line 145](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:145).
- Field/section: **Session title** — [line 155](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:155).
- Field/section: **Conversation** — [line 182](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/chat/ChatWorkspacePage.tsx:182).

#### ConMonExecutionsPage

Source: [apps/web/src/features/conmon/ConMonExecutionsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonExecutionsPage.tsx).

- Field/section: **ConMon** — [line 49](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonExecutionsPage.tsx:49).
- Heading: **Queue-Driven Executions** — [line 50](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonExecutionsPage.tsx:50).
- Field/section: **Assurance** — [line 58](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonExecutionsPage.tsx:58).

#### ConMonProfilesPage

Source: [apps/web/src/features/conmon/ConMonProfilesPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx).

- Field/section: **ConMon** — [line 89](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx:89).
- Heading: **Continuous Monitoring Profiles** — [line 90](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx:90).
- Field/section: **Profile name** — [line 104](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx:104).
- Field/section: **Description** — [line 113](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/conmon/ConMonProfilesPage.tsx:113).
