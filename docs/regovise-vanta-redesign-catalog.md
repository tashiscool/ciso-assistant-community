# Regovise Vanta-Style IA Redesign Catalog

## Objective

Regovise should borrow the cohesion of the Vanta-style experience without shrinking the product. Vanta is strong because its left navigation, page hierarchy, tabs, status pills, tables, and detail drawers make the core GRC jobs feel predictable. Regovise has a broader and more powerful domain model, but the current shell exposes that breadth as implementation buckets.

This catalog defines a feature-preserving information architecture target. It is not a runtime implementation plan by itself. It is the bridge between what Regovise already supports and the cleaner UX model we want.

## Implementation Ledger

This ledger is the source of truth for staged implementation progress. A section can only be marked `[DONE]` when the shipped UI, route preservation, permission gates, and responsive behavior have been verified.

### Status

- [DONE] Product Design audit and Product UI coherence pass completed on 2026-07-21 for the shared shell primitives, Home, Starter Guide, Work Queue, and Evidence Explorer. The pass removed displaced coaching/hero content, made Work Queue controls truthful, made deterministic evidence status visually primary, standardized responsive action placement, and preserved all route/API/auth/persistence contracts.
- [DONE] Final authenticated Worker regression passed 42 representative routes across 1440, 1024, 768, and 390 widths (168/168 checks), including every top-level IA family plus representative detail, legacy, admin/setup, public portal, and Vanta prototype routes. Exact 1440x1000 and 390x844 target captures were also reviewed for the four audited operator flows.
- [DONE] The structured product UX audit, findings, evidence limits, and follow-up boundaries are recorded in `docs/regovise-product-ux-audit.md`.
- [BLOCKED] Public authentication visual alignment remains a separately approved auth-sensitive slice. The current public login still uses the older dark/glass language; it was audited but intentionally not changed without auth-surface approval and dedicated login/error/recovery regression coverage.
- [LEFT] Optional Figma parity validation remains available if a design source is supplied; current visual truth is based on the provided screenshots and the running authenticated Worker.
- [DONE] Overall feasible Regovise IA redesign checklist is complete for the current no-API-change slice: the Vanta-like shell, canonical IA, route preservation, shared primitives, migrated domain surfaces, representative action flows, and Worker visual QA now have shipped evidence. Remaining non-green work is limited to the explicitly cataloged auth/data/profile constraints and optional external-design validation below.
- [DONE] Add the frontend IA model, shell navigation coverage checks, and route preservation ledger.
- [DONE] Strengthen IA preservation verification: every route family now validates required metadata, canonical group mapping, allowed preservation state, allowed audience, and gated admin/internal claims. `/utilities/*` and `/vanta-clone/*` are preserved as reachable legacy/reference route families rather than mislabeled internal-only surfaces.
- [DONE] Strengthen permission-edge IA verification: every standard promoted nav route now has to be intentionally always reachable or covered by an explicit `shellAccess` capability gate, and every standard route-family preservation pattern has to map to an explicit capability gate or documented reference exception. Advanced Risk preservation was split into EBIOS and quantitative route families so the catalog matches the real access boundaries.
- [DONE] Close mounted legacy bridge preservation coverage: `verify:ia-shell` now inventories all 67 `legacyBridgeModels`, requires matching `LegacyRouteBridgePage` resolver entries and `IA_ROUTE_FAMILIES` preservation metadata, and caught/fixed the missing `/security-profiles/*` resolver so deep links are intentionally permission-routed instead of silently falling through.
- [DONE] Replace the implementation-bucket sidebar with the Vanta-like responsive shell navigation.
- [DONE] Accessibility Gate + Verification Closure foundation: shared UI aliases/primitives and the flagged Evidence Explorer white-on-light contrast issue were rethemed and verified in the Worker shell.
- [DONE] Accessibility source-token gate tightened: the verifier now catches dark/translucent `bg-black/*` leftovers, the known high-risk source tokens were swept, and only intentional white-on-purple shell/control text remains allowlisted.
- [DONE] Accessibility hotspot closure batch for setup, builders, AI/GRC admin, and core/library/fedramp: source dark-token/badge leftovers were swept, alias route ownership was preserved, mobile overflow containment was added, and representative Worker browser checks passed at 1440, 1024, 768, and 390.
- [DONE] Whole-app visual accessibility gate is closed for the shipped no-API Worker slice: shared tokens/primitives, promoted IA routes, representative legacy aliases, admin/setup routes, public portal/questionnaire routes, Vanta prototype routes, and the flagged Evidence Explorer path have passed static token checks and Worker width checks at 1440, 1024, 768, and 390 with no observed page-level overflow or visible white-on-light regressions.
- [DONE] Dedicated responsive regression gate added and passed: `npm run verify:responsive` now exercises promoted Regovise routes, representative legacy routes, the flagged Evidence Explorer path, and `/vanta-clone/tests` at 1440, 1024, 768, and 390; it verifies route content, page-level overflow, mobile shell drawer usability, and prototype route containment.
- [BLOCKED] Universal visual accessibility certification beyond the checked Worker matrices requires data-dependent tenant detail records, allowed-profile rendering for permission-edge legacy bridges, and mutation/propagation workflows that cannot be fully proved from the generic session without changing APIs, auth/profile setup, or seeded tenant data.
- [DONE] Convert Home, Starter Guide, and Work Queue into the new shell primitives: Home is a compact program-health dashboard, `/program/setup` is the Starter Guide stepper/checklist, `/tasks` owns the Work Queue route, and `/workspace/me` remains preserved as My Access.
- [DONE] Convert the first Compliance foundation batch onto shared Regovise/Vanta primitives: `/frameworks`, `/frameworks/:frameworkId`, `/framework-library`, `/findings`, `/gap-assessments`, and `/report-bundles` now use shared page headers/status pills/filter/table patterns where applicable, and this batch no longer uses legacy local badge classes.
- [DONE] Convert the Compliance detail batch onto shared primitives and mobile-safe grids: `/framework-library/:frameworkId`, `/gap-assessments/:assessmentId`, and `/report-bundles/:bundleId` now use shared page headers/status pills, preserve route paths, and pass Worker/browser containment checks at 1440, 1024, 768, and 390.
- [DONE] Convert shared module Compliance surfaces onto shared readable status primitives and mobile-safe grids: `/security-controls`, `/policies`, `/evidence-locker`, and `/requirements` no longer rely on legacy local badge aliases in the shared module workspace, preserve route paths, and pass Worker/browser containment checks for the checked widths/routes.
- [DONE] Convert the Compliance assessments/tests batch onto shared readable primitives and mobile-safe containment: `/assessments`, `/compliance-assessments`, `/risk-assessments`, `/compliance-assessments/:assessmentId`, `/risk-assessments/:assessmentId`, `/compliance-assessments/:assessmentId/action-plan`, `/compliance-assessments/:assessmentId/flash-mode`, `/applied-controls/kanban-mode`, `/applied-controls/flash-mode`, and `/assessment-evidence-packages` preserve route paths and pass Worker/browser checks at 1440, 1024, 768, and 390.
- [DONE] Convert Compliance action-plan budget overview onto a truthful Vanta-like route surface: `/compliance-assessments/:assessmentId/action-plan/budget-overview` now renders distinct budget copy, toggle actions, summary metrics, and local table scrolling while preserving the existing action-plan route and data contract.
- [DONE] Convert Gap Assessment creation into a shared right-drawer flow: `/gap-assessments` now keeps the existing create API and framework/source/severity/status inputs while moving the assessment request form into a responsive drawer with reachable footer actions.
- [DONE] Convert Gap Assessment output-generation actions into shared review modals: `/gap-assessments/:assessmentId` keeps the existing evidence-package, report-bundle, and report-snapshot APIs while moving `Create evidence package`, `Create report bundle`, `Exec summary`, and `Board brief` into explicit cancelable review flows with reachable actions.
- [DONE] Convert Framework Detail requirement creation into a shared right-drawer flow: `/frameworks/:frameworkId` now keeps the existing `/core/frameworks/:frameworkId/controls` create API while moving requirement reference/title/description entry out of the page body into a responsive drawer with reachable footer actions.
- [DONE] Convert Framework Library packaged catalogue import into a shared review modal: `/framework-library` keeps the existing import snapshot API while requiring an explicit `Import packaged catalogues` review flow with cancel/primary/close actions reachable on desktop and mobile.
- [DONE] Convert Assessment Evidence Packages into a shared package-review action flow: `/assessment-evidence-packages` and `/assessment-evidence-packages/:packageMarker` now use shared page header, tabs, filter, table, action-menu, status-pill, and right-drawer primitives; preserve existing package APIs/routes; keep long request/comment tables locally scrollable with sticky headers; and expose request, comment, rollup, and anomaly inspection drawers with source/locker actions.
- [DONE] Complete Compliance for the feasible no-API slice: frameworks, controls/shared modules, assessments/tests, action plans, package/review surfaces, findings, report bundles, gap assessment actions, framework requirement creation, packaged catalogue import, and assessment evidence packages now use shared readable primitives and verified responsive action flows.
- [BLOCKED] Universal Compliance certification for tenant-specific audit/package IDs, permission-edge profiles, and mutation propagation outside the seeded/checked flows requires real tenant records or approved backend/API contracts.
- [DONE] Convert the first Risk batch onto shared readable primitives and mobile-safe containment: `/risks`, `/risk-scenarios`, `/advanced-risk/ebios`, `/advanced-risk/ebios/:studyId`, `/advanced-risk/quantitative`, `/advanced-risk/quantitative/:studyId`, `/advanced-risk/quantitative/:studyId/executive-summary`, `/advanced-risk/quantitative/:studyId/key-metrics`, `/advanced-risk/quantitative/:studyId/action-plan`, `/quantitative-risk-scenarios/:scenarioId`, `/quantitative-risk-hypotheses/:hypothesisId`, `/ebios-rm`, and `/quantitative-risk-studies` preserve route paths and pass Worker/browser checks at 1440, 1024, 768, and 390.
- [DONE] Convert the Risk incident/exception shared-module batch onto shared readable primitives and mobile-safe route preservation: `/incidents`, `/security-exceptions`, `/modules/incidents`, and `/modules/exceptions` preserve canonical and legacy module access, render active navigation where promoted, and pass Worker/browser checks at 1440, 1024, 768, and 390.
- [DONE] Convert Risk assessment action-plan budget overview onto a truthful Vanta-like route surface: `/risk-assessments/:assessmentId/action-plan/budget-overview` now renders distinct budget copy, toggle actions, summary metrics, and local table scrolling while preserving the existing treatment/action-plan route and data contract.
- [DONE] Convert Risk scenario/register creation actions into shared right-drawer flows: `/risk-scenarios` now keeps register and scenario API behavior intact while moving add actions into responsive drawers with reachable footer actions at desktop, tablet, and mobile widths.
- [DONE] Convert advanced-risk study creation into shared right-drawer flows: `/advanced-risk/ebios`, `/ebios-rm`, `/advanced-risk/quantitative`, and `/quantitative-risk-studies` keep the existing EBIOS and quantitative study create APIs while moving study setup into responsive drawers with reachable footer actions.
- [DONE] Convert Risk scenario/register inspect, edit, and destructive-review action flows: `/risk-scenarios` now keeps existing risk register/scenario APIs intact while moving register and scenario inspect/edit/delete actions into shared action menus, right drawers, and explicit review modals; the scenario table stays locally scrollable with sticky headers; and mobile edit drawers keep primary actions visible at 390px.
- [DONE] Convert Risk incident/exception drilldown action flows: `/incidents?record=...` and `/security-exceptions?record=...` now expose inspect, edit, relationship-management, activity-note, and guarded archive review actions through shared action-menu, right-drawer, modal, and status-pill primitives while preserving existing shared-module APIs, canonical routes, and legacy `/modules/incidents` and `/modules/exceptions` access.
- [DONE] Convert advanced-risk EBIOS and quantitative study detail action flows: `/advanced-risk/ebios/:studyId` and `/advanced-risk/quantitative/:studyId` now expose study snapshot, editable study metadata, and guarded delete review flows through shared action menus, right drawers, and modals while preserving the existing EBIOS/quantitative study update and delete APIs. Delete flows were verified and canceled against seeded demo studies.
- [DONE] Convert quantitative and risk-assessment treatment action-plan review flows: `/advanced-risk/quantitative/:studyId/action-plan`, `/risk-assessments/:assessmentId/action-plan`, and `/risk-assessments/:assessmentId/action-plan/budget-overview` now use shared page header, tabs where applicable, filter/table shell, status pill, action-menu, and right-drawer primitives; preserve existing GET-only action-plan APIs and route paths; keep scenario-derived treatment status deterministic/read-only; and route detail decisions to existing scenario workspaces without adding backend mutations.
- [DONE] Convert the dedicated Risk Action Tracker surface: `/risk-actions` now composes existing task, validation, incident, exception, scenario, and finding data into a shared table/drawer action-tracking view without adding backend APIs, while `/tasks` remains the canonical Work Queue.
- [DONE] Complete Risk for the feasible no-API slice: overview/register/library, scenarios, advanced EBIOS and quantitative routes, incidents, exceptions, treatment/action-plan review, and the dedicated action tracker now use shared primitives and verified responsive drawer/modal flows.
- [BLOCKED] Universal Risk certification for tenant-specific detail IDs, alternate permission profiles, and mutation propagation outside seeded studies/actions requires real tenant data or approved backend/API contracts.
- [DONE] Convert the first Evidence and Assurance batch onto shared readable primitives and mobile-safe containment: `/evidence-management`, `/features/evidence-management`, `/evidence/jobs`, `/evidence/sources`, `/conmon/executions`, `/conmon/profiles`, `/features/continuous-monitoring`, `/assurance`, `/assurance/evidence`, `/assurance/tracker`, `/assurance/packages`, `/assurance/reviews`, and `/assurance/agent-runs` preserve route paths and pass Worker/browser checks at 1440, 1024, 768, and 390.
- [DONE] Convert Evidence Sources add/configure flow into a shared right drawer: `/evidence/sources` now keeps the existing source create API and provider-specific AWS fields while moving configuration into a responsive drawer with local table scrolling.
- [DONE] Convert Evidence Management source creation into a shared right-drawer flow: `/evidence-management` now keeps the existing `/evidence/sources` create API and provider-specific AWS fields while moving source creation out of the page header into a responsive drawer with reachable footer actions.
- [DONE] Convert Evidence Management source collection and destructive-review flows: `/evidence-management` and `/evidence/sources` now keep the existing collect/delete APIs intact while routing source collection and source deletion through shared review modals; source/job/artifact tables scroll locally on tablet and mobile widths instead of widening the page.
- [DONE] Convert Evidence Explorer downstream action review flows: `/assurance/evidence` now keeps the existing deterministic evaluation, 20x package build, and assurance agent APIs intact while routing `Run eval`, `Build 20x`, and `Run agent` through shared review modals with selected-job context and cancelable primary actions.
- [DONE] Convert Tracker Workbench import and conversion review flows: `/assurance/tracker` now keeps the existing tracker import and tracker-to-20x APIs intact while moving import setup into a shared right drawer and conversion into an explicit review modal with reachable cancel/confirm actions.
- [DONE] Convert Agent Run Inspector writeback action flows: `/assurance/agent-runs` now keeps the existing writeback approval/rejection/evidence-request/duplicate/export APIs intact while moving writeback inspect/export/review decisions into shared action menus, a right drawer, and explicit review modal with reachable actions.
- [DONE] Convert Review Queue decision action flows: `/assurance/reviews` now keeps the existing review-decision API intact while moving recommendation inspection and accept/reject decisions into shared action menus, a right drawer, and explicit reviewer confirmation modals with reachable actions.
- [DONE] Convert Package Explorer inspection workflows: `/assurance/packages` now keeps the existing package/read/review-history/artifact APIs intact while moving package readiness, current artifact inspection, and review-history inspection into shared action-menu/right-drawer flows with reachable actions and local preview scrolling.
- [DONE] Convert Assurance Overview attention queue inspection flow: `/assurance` now keeps existing overview/explain/workflow APIs intact while moving selected queue item inspection into a shared right drawer with linked workflow lineage and reachable Close/Open workbench actions.
- [DONE] Fix shared right-drawer and mobile-sheet primitive placement so migrated drawer/sheet action flows remain fully in viewport with reachable footer actions at 390px mobile width.
- [DONE] Complete Evidence and Assurance for the feasible no-API slice: evidence management/sources/jobs, continuous monitoring, assurance overview, Evidence Explorer, tracker import/conversion, package inspection, review decisions, and agent-run writeback flows now use shared readable primitives, deterministic status remains visually primary, and checked drawers/modals remain reachable at mobile widths.
- [BLOCKED] Universal Evidence and Assurance certification for unseeded package propagation, mutation edge cases, and tenant-specific detail IDs requires live tenant records or approved backend/API contracts beyond the generic Worker session.
- [DONE] Convert the first Vendors and Trust batch onto shared readable primitives and mobile-safe containment: `/third-party`, `/third-party/entities/:entityId`, `/portal`, and `/portal/assignments/:assignmentId` now use shared status pills, light panel/table tokens, 2xl dense grids, and pass Worker/browser checks at 1440, 1024, 768, and 390.
- [DONE] Convert Third-Party Management creation flows into shared right-drawer actions: `/third-party` now keeps the existing entity, solution, and contract create APIs while moving all three creation forms into responsive drawers with reachable footer actions.
- [DONE] Convert Third-Party entity detail inspection flows: `/third-party/entities/:entityId` now keeps the existing entity detail API intact while moving entity, solution, contract, and vendor-assessment inspection into shared action menus and right drawers with reachable close/reference actions.
- [DONE] Convert Third-Party entity, solution, and contract review-update flows: `/third-party/entities/:entityId` now keeps existing entity, solution, and contract update APIs intact while moving provider metadata, solution data-handling, and contract economics/status reviews into shared action-menu and right-drawer flows with reachable desktop/tablet/mobile actions. Entity assessment records remain inspect-only because the current backend route is GET-only.
- [DONE] Convert Third-Party Management vendor import staging and bulk-review flows: `/third-party` now exposes shared `RegModal` review flows for staged vendor import rows and current vendor coverage gaps, keeps the existing entity/solution/contract APIs untouched, and explicitly records persisted bulk import as outside the no-API-change slice.
- [DONE] Convert Trust Center/FedRAMP provider shell mutation flows into shared review modals: `/trust-center` and `/fedramp/provider` keep existing provider/trust-center APIs while routing offering, service, grant, agency contact, communication, incident, VDR, OAR, quarterly review, feedback, SCN, secure configuration, scope, and crypto inventory actions through cancelable `RegModal` review flows with action metadata.
- [DONE] Convert Questionnaire Builder creation and assignment setup flows: `/builders/questionnaire-builder` keeps the existing questionnaire template and assignment APIs while moving new-template creation into a shared review modal and assignment setup into a responsive right drawer with reachable footer actions at desktop, tablet, and mobile widths.
- [DONE] Convert public questionnaire response access-code and submit-review flow: `/questionnaires/response/:shareToken` now uses readable shared light tokens, labeled access-code and response fields, shared status pills, and the shared submit review modal while preserving the existing public access-code/response/submit APIs.
- [DONE] Convert public portal assignment inspect/save-review flows: `/portal` and `/portal/assignments/:assignmentId` keep the existing portal assignment APIs while moving requirement inspection, per-requirement save review, and full-assignment submit review into shared action-menu, right-drawer, and review-modal primitives with reachable desktop and mobile actions.
- [DONE] Complete Vendors and Trust for the feasible no-API slice: TPRM listing/detail/review-update, staged vendor import review, Trust Center/FedRAMP provider actions, questionnaire builder assignment, public questionnaire response, and portal assignment save/submit review now use shared primitives and verified responsive action flows.
- [BLOCKED] Persisted vendor bulk import, public portal permission-edge variants, and tenant-specific vendor/portal/questionnaire detail IDs beyond seeded examples require approved backend/API contracts or real tenant records.
- [DONE] Convert the first Assets and Systems integrations batch onto shared readable primitives and canonical routing: `/integrations` now owns the Integrations landing, `/automation-manager` and `/features/automation-manager` remain preserved aliases, and the route uses shared status pills, light panel/table tokens, and mobile-safe containment.
- [DONE] Convert the Assets and Systems shared-module batch onto shared readable primitives and mobile-safe containment: `/assets`, `/components`, `/interconnections`, `/supply-chain`, and `/modules` use shared status pills/light tokens/local overflow containment, preserve route paths, and pass Worker/browser checks at 1440, 1024, 768, and 390.
- [DONE] Convert Automation Manager connector creation into a shared right-drawer flow: `/integrations`, `/automation-manager`, and `/features/automation-manager` now keep the existing connector create API while moving provider selection and connector naming into a responsive drawer with reachable footer actions.
- [DONE] Convert Automation Manager provider configuration, secure configuration, scope, raw-config, and run-inspection workflows: `/integrations`, `/automation-manager`, and `/features/automation-manager` now keep existing connector update/test APIs while moving provider metadata, credential reference posture, resource scope, raw config editing, and run inspection into shared action menus and right drawers with reachable actions.
- [DONE] Convert shared-module record detail action flows: `/assets`, `/components`, `/interconnections`, `/supply-chain`, `/modules`, and other shared-module workspaces now expose record inspect, edit, relationship-management, activity, scrutiny-run, and guarded archive actions through shared action-menu, right-drawer, modal, and status-pill primitives while preserving the existing create/update/archive APIs and direct `?record=` detail route behavior.
- [DONE] Complete Assets and Systems for the feasible no-API slice: Integrations, Automation Manager aliases, connector create/configure/test/inspect flows, shared-module asset/system workspaces, and `?record=` detail actions now use shared readable primitives and verified responsive action flows.
- [BLOCKED] Universal Assets and Systems certification for provider-specific integration edge cases, alternate permission profiles, and tenant-specific detail IDs beyond the shared-module `?record=` path requires real connector data or approved backend/API contracts.
- [DONE] Convert the first People and Access batch onto shared readable primitives and mobile-safe containment: `/workspace/me`, `/workspace/team`, `/workspace/access`, `/workspace/domains`, `/users`, and setup role aliases preserve route paths, use shared status pills/light tokens/local table scrolling, and pass Worker/browser checks at 1440, 1024, 768, and 390.
- [DONE] Verify the People/Admin setup access batch and convert the service-account destructive action to a guarded shared modal: `/setup/service-accounts`, `/setup/sso`, and `/setup/user-management-roles/mfa` preserve admin-only routes, remain readable/responsive, and the service-account deactivate action now requires confirmation before the API call.
- [DONE] Convert People team member/group creation into shared right-drawer flows: `/workspace/team` now keeps the existing user and group create APIs intact while moving add actions into responsive drawers with reachable footer actions at desktop, tablet, and mobile widths.
- [DONE] Convert the People temporary-password action into a shared right-drawer flow: `/workspace/team` keeps the existing local-auth admin password endpoint intact while moving the row-level password form out of the table into a responsive drawer with reachable footer actions.
- [DONE] Convert Access Control role-management creation into shared right-drawer flows: `/workspace/access` now keeps the existing role and role-assignment create APIs while moving role catalog and assignment setup into responsive drawers with reachable footer actions.
- [DONE] Convert the People and Access inspect/destructive-review action-flow batch: `/workspace/team`, `/workspace/access`, `/users`, and `/setup/user-management-roles/roles` now inspect users, groups, roles, and role assignments in shared drawers and route delete/remove actions through shared review modals using existing IAM APIs. Built-in role/group protections remain enforced, and shared action menus now close before launching drawers/modals.
- [DONE] Convert the People and Access metadata edit action-flow batch: `/workspace/team`, `/workspace/access`, `/users`, `/setup/user-management-roles/roles`, and `/setup/user-management-roles/mfa` now edit user profile basics, custom user-group metadata, and custom role metadata in shared drawers using existing IAM PUT APIs. Built-in group/role edits remain guarded, alias active-state mappings are statically verified, and permissions, membership, scope, and role-assignment updates are not implied by the UI.
- [DONE] Convert the People and Access access-edit action-flow batch: `/workspace/team`, `/workspace/access`, `/users`, `/setup/user-management-roles/roles`, and `/setup/user-management-roles/mfa` now edit user group memberships, custom group scope/member membership, custom role permissions, and custom role assignments in shared drawers using existing IAM PUT APIs. Built-in roles, groups, and assignments remain guarded, route paths and permission gates remain unchanged, and action drawers stay reachable at desktop, tablet, and mobile widths.
- [DONE] Complete People and Access for the feasible no-API slice: My Access, team, users, access/roles, groups, setup role/MFA aliases, temporary passwords, membership/scope/permission edit drawers, and guarded destructive flows now use shared primitives and verified responsive action flows.
- [BLOCKED] Universal People and Access certification for alternate permission profiles and tenant-specific user/group/role IDs beyond seeded IAM surfaces requires real tenant records or profile-specific QA sessions.
- [DONE] Convert the first Privacy and Resilience batch onto shared readable primitives and mobile-safe containment: `/privacy`, `/privacy/processings/:processingId`, `/resilience`, and `/resilience/business-impact-analyses/:analysisId` now use shared status pills, light panel/table tokens, 2xl dense grids, local table scrolling, and pass Worker/browser checks at 1440, 1024, 768, and 390.
- [DONE] Convert Resilience BIA creation into a shared right-drawer flow: `/resilience` now keeps the existing business-impact-analysis create API while moving BIA fields into a responsive drawer with reachable footer actions.
- [DONE] Convert Privacy creation flows into shared right-drawer actions: `/privacy` now keeps the existing processing, right-request, and breach create APIs while moving all three creation forms into responsive drawers with reachable footer actions.
- [DONE] Convert Privacy and Resilience inspect, edit, and destructive-review action flows: `/privacy`, `/privacy/processings/:processingId`, `/resilience`, and `/resilience/business-impact-analyses/:analysisId` now inspect, edit, and route delete actions through shared action menus, right drawers, and explicit review modals while preserving existing PUT/DELETE APIs and route paths.
- [DONE] Convert Resilience BIA asset recovery and threshold review flows: `/resilience/business-impact-analyses/:analysisId` and the legacy `/business-impact-analysis/:analysisId` alias now expose asset-level recovery plan inspection and threshold-configuration review through shared action menus, right drawers, and review modals while preserving the existing read/update/delete BIA APIs.
- [DONE] Complete Privacy and Resilience for the feasible no-API slice: privacy processing/right-request/breach flows, resilience BIA creation/detail/edit/delete, asset recovery inspection, threshold review, and legacy BIA alias routing now use shared primitives and verified responsive action flows.
- [BLOCKED] Universal Privacy and Resilience certification for alternate permission profiles, tenant-specific BIA/processing IDs beyond seeded records, and recovery scenario mutation propagation edge cases requires real tenant records or approved backend/API contracts.
- [DONE] Convert the first Automation and Builders/Admin hotspot batch onto the light shell/accessibility baseline: `/builders/dashboard-builder`, `/grc-admin`, `/scrutiny-engine`, `/setup/general`, `/frameworks`, and `/fedramp/provider` pass representative Worker visual QA and preserve alias/canonical active navigation state.
- [DONE] Convert the first Reports and Exports batch onto shared readable primitives and mobile-safe containment: `/reports`, `/reports/dora-roi`, `/report-bundles`, `/builders/report-builder`, `/compliance-exports`, and FedRAMP/eMASS compliance export aliases preserve route paths, use shared status pill/light tokens, and pass Worker/browser checks at 1440, 1024, 768, and 390.
- [DONE] Convert the remaining first-pass Automation and Builders/Admin route batch onto shared readable primitives and mobile-safe containment: response automation, evidence mapping, RegML, AI policy builder, export/form/rules/questionnaire/wayfinder builders, and setup security/SSO/MFA/service-account/module surfaces preserve route paths, use shared status pill/light tokens, and pass Worker/browser checks at 1440, 1024, 768, and 390.
- [DONE] Convert Dashboard Builder canvas creation into a shared right-drawer flow: `/builders/dashboard-builder` now keeps the existing dashboard create API while moving title/access/group entry out of the sidebar into a responsive drawer with reachable footer actions.
- [DONE] Convert Report Builder report creation into a shared right-drawer flow: `/builders/report-builder` now keeps the existing report create API while moving report title, owner, chart type, and module setup out of the sidebar into a responsive drawer with reachable footer actions.
- [DONE] Convert Report Builder share and subscription setup into shared right-drawer flows: `/builders/report-builder` now keeps the existing share and subscription APIs while moving recipient and schedule setup out of the page side panel into responsive drawers with reachable footer actions.
- [DONE] Convert Report Builder destructive delete confirmation into a shared modal: `/builders/report-builder` no longer relies on `window.prompt` and keeps the existing report delete API behind a responsive confirmation dialog with reachable actions.
- [DONE] Convert Export Builder creation, field-mapping import review, and destructive delete into shared drawer/modal flows: `/builders/export-builder` now keeps the existing create/import/delete APIs while moving the create form, mapping import review, and delete confirmation into responsive shared primitives with reachable actions.
- [DONE] Convert Export Builder secondary action flows into shared review modals: `/builders/export-builder` now keeps the existing duplicate, preview/test, auto-map, and delete APIs while routing `Duplicate`, `Test Export`, `Auto Map Fields`, and destructive removal through cancelable shared modals with reachable actions and locally contained builder/table scrolling.
- [DONE] Convert Dashboard Builder destructive delete confirmation into a shared modal: `/builders/dashboard-builder` now keeps the existing dashboard delete API behind a responsive confirmation dialog with reachable actions.
- [DONE] Convert Report Builder subscription removal into a shared review modal: `/builders/report-builder` now keeps the existing subscription delete API while requiring an explicit review/confirm surface with accessible icon-only action labeling.
- [DONE] Convert setup/admin Tags and Classification destructive actions into shared review modals: `/setup/tags` and `/setup/classification` now keep their existing delete APIs while requiring confirmation and showing downstream impact context before deletion.
- [DONE] Convert Response Automation destructive actions into shared review modals: `/response-automation` now keeps the existing job and question delete APIs while requiring confirmation surfaces with source/status/confidence context before deletion.
- [DONE] Convert Evidence Mapping removal into a shared review modal: `/evidence-mapping` now keeps the existing evidence mapping delete API while requiring confirmation with mapping target/type/parent context before removal.
- [DONE] Convert the next Reports and Exports / Automation and Builders action-flow batch: `/builders/report-builder` now queues exports behind a review modal, `/builders/export-builder` copies starter templates behind a review modal, and `/builders/dashboard-builder` removes dashboard tiles behind a review modal. Existing APIs and persistence contracts are unchanged.
- [DONE] Close the broader route-family visual QA batch for promoted IA routes, representative legacy aliases, admin-only builders/setup routes, public portal routes, and Vanta prototype routes: Worker checks covered 56 routes at 1440, 1024, 768, and 390 with active navigation, mobile navigation, overflow, fallback, and visible text contrast assertions.
- [DONE] Polish secondary/admin active navigation for the newly promoted routes: `/threat-models` is now represented under Risk and `/builders` is represented and admin-gated under Automation and Builders, while `/modules/tasks` remains the preserved legacy module path.
- [DONE] Convert the builder/admin destructive-detail action-flow batch: `/builders/questionnaire-builder` now reviews question and visual-rule removals in shared modals, `/builders/form-builder` now reviews section and field removals in shared modals, and `/grc-admin` opens recent background jobs in a shared right drawer with locally scrollable JSON payloads. Existing APIs and persistence contracts are unchanged.
- [DONE] Convert the persisted Reports and Exports action-flow batch: `/reports` and `/reports/dora-roi` now inspect, regenerate, and delete historical report exports behind shared drawers/review modals using existing report-export APIs, and `/compliance-exports` retries compliance export jobs behind a shared review modal using the existing export-job API. Existing APIs and persistence contracts are unchanged.
- [DONE] Convert Compliance Exports job inspection into shared action-menu and right-drawer flows: `/compliance-exports` and `/features/compliance-exports/fedramp/poams` now keep existing run/retry/download/file-history APIs intact while moving historical job inspection into a responsive pipeline drawer, keeping retry as an explicit review modal, and mapping the FedRAMP alias back to the Reports and Exports active navigation state.
- [DONE] Convert Scrutiny Engine admin execution actions into shared review modals: `/grc-admin/scrutiny-engine` now keeps existing draft-generation, reconciliation, materialization, and reviewer-comment APIs intact while routing those high-impact actions through cancelable shared `RegModal` review surfaces with scoped run/item/comment context.
- [DONE] Convert setup/admin detail action flows into shared review surfaces: `/setup/security`, `/setup/service-accounts`, `/grc-admin`, and `/framework-library` keep their existing APIs while routing security status updates, service-account issue/rotate/deactivate, AI settings saves, curated snapshot import, SCF refresh, and packaged catalogue import through cancelable modals verified at desktop, tablet, and mobile widths.
- [BLOCKED] Persisted compliance export job removal is blocked by the no-API-change constraint: neither the frontend Compliance Exports API nor the Worker `/ai/compliance-exports/jobs/:jobId` handler exposes an existing DELETE route; the current contract supports workspace/job GET, job POST/retry, and completed-job download only.
- [DONE] Complete Reports and Exports, Automation and Builders, and Admin for the feasible no-API slice: report/export builders, dashboard/form/questionnaire/rules/wayfinder builders, report export inspect/regenerate/delete, compliance export inspect/retry, scrutiny/admin execution reviews, setup/security/service-account detail actions, and related aliases now use shared primitives and verified responsive action flows.
- [BLOCKED] Universal Reports, Builders, and Admin certification for alternate permission profiles and tenant-specific detail IDs beyond seeded records requires profile-specific QA sessions or real tenant data.
- [DONE] Preserve Vanta clone reference routes while the native Regovise pages continue to match or exceed those patterns: representative prototype routes remain reachable through `/vanta-clone/*`, and the reference tests/controls/documents table-heavy screens now contain mobile and desktop horizontal overflow locally instead of widening the page.

### Verification Evidence

- [DONE] Product UX closure gates re-passed on 2026-07-21: `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`; the build emitted only the existing chunk-size advisory.
- [DONE] Final authenticated Worker visual QA on 2026-07-21 passed 168/168 checks: 42 routes at 1440, 1024, 768, and 390 widths. Machine-readable evidence is in `artifacts/product-ui-audit/product-ui-audit-final-full/2026-07-21-final/responsive-summary.json`.
- [DONE] Exact target captures for the audited Home, Starter Guide, Work Queue, and Evidence Explorer flows were reviewed at 1440x1000 and 390x844 under `artifacts/product-ui-audit/product-ui-audit-final-targets/`.
- [DONE] `npm run verify:ia-shell` from `apps/web`: passed on 2026-06-10 with 13 canonical IA groups, 76 promoted nav routes covered, `/tasks` Work Queue route ownership checked, 17 route preservation families mapped, 30 admin-gated nav routes checked, and 1 internal-gated route checked.
- [DONE] `npm run verify:ia-shell` from `apps/web`: re-passed on 2026-06-10 after strengthening route-family validation. Evidence: 13 canonical IA groups, 76 promoted nav routes covered, `/tasks` Work Queue route ownership checked, 17 route preservation families mapped, route preservation metadata checked for required fields/canonical groups/preservation states/audiences/gated admin-internal states, 30 admin-gated nav routes checked, and 1 internal-gated nav route checked.
- [DONE] `npm run verify:ia-shell` from `apps/web`: re-passed on 2026-06-13 after strengthening permission-edge IA coverage. Evidence: 13 canonical IA groups, 79 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 exact legacy active-state aliases and 1 prefix alias checked, 19 route preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated nav route checked, 47 standard-gated nav routes checked, and 16 standard route-family gates checked.
- [DONE] `npm run verify:ia-shell` from `apps/web`: re-passed on 2026-06-13 after closing mounted legacy bridge preservation coverage. Evidence: 13 canonical IA groups, 79 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 exact legacy active-state aliases and 1 prefix alias checked, 80 route preservation families mapped, 67 legacy bridge route configs checked, 67 legacy bridge IA families checked, 31 admin-gated nav routes checked, 1 internal-gated nav route checked, 47 standard-gated nav routes checked, and 68 standard route-family gates checked. The verifier caught the missing `/security-profiles/*` legacy resolver and the resolver is now present.
- [DONE] `npm run typecheck` from `apps/web`: passed on 2026-06-10.
- [DONE] `npm run build` from `apps/web`: passed on 2026-06-10.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the `/tasks` route ownership fix; all passed.
- [DONE] Protected Worker visual QA used `npm --prefix ../../cloudflare run dev:local` from `apps/web`; Wrangler served the integrated shell at `http://localhost:8787`.
- [DONE] Loopback header-mode session was established without secret-based bootstrap and protected routes were smoked in the Worker shell.
- [DONE] Browser width checks against the integrated Worker shell at `http://127.0.0.1:8787/`: 1440 desktop persistent sidebar width 292; 1024 tablet rail width 76; 768 tablet rail width 76; 390 mobile drawer opens to width 292. No page-level horizontal overflow, console errors, page errors, failed responses, or request failures were observed in the viewport probe.
- [DONE] Browser resize probes issued at 1440, 1024, 768, and 390 widths against `/`, `/program/setup`, `/tasks`, and `/assurance/evidence?artifact=normalized_bundle&evidenceJobId=bacafef5-4489-4f87-976b-73d32ee63e10`. All checked routes kept the shell mounted, avoided login fallback, showed active navigation state, and had no page-level horizontal overflow.
- [DONE] `/tasks` Worker smoke at 1440, 1024, 768, and 390 widths confirmed the route renders `OPERATIONS / Work Queue` with queue metrics and task rows, and does not render the generic `MODULES / Tasks` shared module page. `/modules/tasks` remains the legacy module path.
- [DONE] Mobile navigation probe at the 390 resize confirmed the navigation control was present and toggled on `/`, `/program/setup`, `/tasks`, and the flagged Evidence Explorer route. The opened drawer rendered a 292px navigation panel with the active item visible, including `Tasks` on `/tasks`.
- [DONE] Flagged Evidence Explorer contrast check: the copy `Deterministic checks`, `Run evaluations before asking for explanations`, and `The pass, partial, and fail states here are meant to come from deterministic checks first...` was found on the Worker route with dark text colors on white or pale-purple backgrounds rather than white-on-light. Evidence Explorer also retained local scroll containers for artifact panes.
- [DONE] Source sweep after retheme: `rg "text-white|text-slate-|bg-slate-|border-white|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300" apps/web/src/features/assurance apps/web/src/features/ops apps/web/src/features/reports apps/web/src/features/risk apps/web/src/features/modules` returned no matches.
- [DONE] `npm run verify:a11y-tokens` from `apps/web`: passed on 2026-06-10 after tightening the disallowed token set to include `bg-black/*`. Evidence: 199 source files checked, 3 legacy token occurrences found, and all 3 were intentional contrast-safe allowlist hits.
- [DONE] Compliance foundation batch source sweep: `rg "badge-neutral|badge-warning|badge-error|badge-success" apps/web/src/features/grc/FindingsExplorerPage.tsx apps/web/src/features/grc/GapAssessmentsPage.tsx apps/web/src/features/grc/ReportBundlesPage.tsx apps/web/src/features/core/FrameworksPage.tsx apps/web/src/features/core/FrameworkDetailPage.tsx apps/web/src/features/grc/FrameworkLibraryPage.tsx` returned no matches.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the Compliance foundation primitive batch; all passed.
- [DONE] Compliance foundation Worker smoke: `curl` returned HTTP 200 for `/frameworks`, `/findings`, `/gap-assessments`, and `/report-bundles` against `http://127.0.0.1:8787`.
- [DONE] Compliance foundation browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/frameworks`, `/framework-library`, `/findings`, `/gap-assessments`, and `/report-bundles` mounted at 1440 width; representative responsive snapshots were checked at 1024 (`/report-bundles`), 768 (`/findings`), and 390 (`/gap-assessments`) with the shell mounted and the new page header/status-pill content visible.
- [DONE] Compliance detail source sweep: `rg "badge-neutral|badge-warning|badge-error|badge-success" apps/web/src/features/grc/FrameworkKnowledgeDetailPage.tsx apps/web/src/features/grc/GapAssessmentDetailPage.tsx apps/web/src/features/grc/ReportBundleDetailPage.tsx` returned no matches.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the Compliance detail primitive/mobile-grid batch; all passed.
- [DONE] Compliance detail Worker smoke: `curl` returned HTTP 200 for `/framework-library/au-apra-cps-234`, `/gap-assessments/38ccd01a0e79a45ce657e1ca94893be1015b287907a7346f9a4307e682ffe326`, and `/report-bundles/fdd6d790167971c5214a3f1e3ffaa4390bba54d09c6d9f317c856bb0865a2e28` against `http://127.0.0.1:8787`.
- [DONE] Compliance detail browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/framework-library/:frameworkId`, `/gap-assessments/:assessmentId`, and `/report-bundles/:bundleId` were checked at 390 after a mobile overflow was found and fixed with `minmax(0,1fr)` grids and `min-w-0` panel containment; representative snapshots were also checked at 1440, 1024, and 768 with the shell mounted, active navigation visible, and no page-level horizontal overflow.
- [DONE] Shared module Compliance source sweep: `rg "badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger" apps/web/src/features/modules/SharedModuleWorkspacePage.tsx` returned no matches after replacing record/status chips with `RegStatusPill`.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the shared module Compliance primitive/mobile-grid batch; all passed.
- [DONE] Shared module Compliance Worker smoke: `curl` returned HTTP 200 for `/security-controls`, `/policies`, `/evidence-locker`, and `/requirements` against `http://127.0.0.1:8787`.
- [DONE] Shared module Compliance browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/security-controls` was checked at 1440, 1024, 768, and 390 with the shell mounted, active Controls navigation visible, and no root/body/main horizontal overflow; `/policies`, `/evidence-locker`, and `/requirements` were checked at 390 with no page-level or main-area horizontal overflow. `/requirements` remains reachable as an unpromoted module route, so it has no primary active-nav marker by design.
- [DONE] Compliance assessments/tests source sweep: `rg "badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger|divide-white/|text-white|bg-slate-|text-slate-|bg-black/|border-white" apps/web/src/features/assessments` returned no matches.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the Compliance assessments/tests mobile-containment batch; all passed.
- [DONE] Local Worker data prerequisite for assessment route QA was corrected with `npm --prefix cloudflare run migrate:local`; this applied the missing questionnaire runtime migrations required by `/assessments` and removed the prior `D1_ERROR: no such table: questionnaire_instances` failure from protected Worker smoke.
- [DONE] Compliance assessments/tests Worker smoke: `curl` returned HTTP 200 for `/assessments`, `/compliance-assessments`, `/risk-assessments`, `/applied-controls/kanban-mode`, `/applied-controls/flash-mode`, `/assessment-evidence-packages`, `/risk-assessments/risk-assessment-enterprise-demo`, `/compliance-assessments/compliance-assessment-iso-demo`, `/compliance-assessments/compliance-assessment-iso-demo/action-plan`, and `/compliance-assessments/compliance-assessment-iso-demo/flash-mode` against `http://127.0.0.1:8787`.
- [DONE] Compliance assessments/tests browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/`, `/program/setup`, `/tasks`, `/assessments`, `/compliance-assessments`, `/risk-assessments`, `/applied-controls/kanban-mode`, `/applied-controls/flash-mode`, `/assessment-evidence-packages`, `/compliance-assessments/compliance-assessment-iso-demo`, `/risk-assessments/risk-assessment-enterprise-demo`, `/compliance-assessments/compliance-assessment-iso-demo/action-plan`, and `/compliance-assessments/compliance-assessment-iso-demo/flash-mode` passed 52 route-width checks across 1440, 1024, 768, and 390. No page-level horizontal overflow, protected-route fallback, data-layer error text, console/page errors, failed same-origin requests, or local table/pre overflow regressions were observed. The 390px overflows previously found on the compliance and risk assessment detail routes were fixed with shrinkable topbar breadcrumbs and local overflow containment for risk matrix/table panels.
- [DONE] Compliance/Risk action-plan budget overview route patch: `ComplianceActionPlanPage` and `RiskAssessmentActionPlanPage` now detect `/budget-overview`, render distinct `Budget Overview` headings, route toggle actions, budget-specific summary cards, explanatory `BUDGET LENS` copy, and locally scrollable tables without changing backend APIs or route paths.
- [DONE] Compliance/Risk action-plan budget browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/compliance-assessments/compliance-assessment-iso-demo/action-plan/budget-overview`, `/risk-assessments/risk-assessment-enterprise-demo/action-plan/budget-overview`, `/compliance-assessments/compliance-assessment-iso-demo/action-plan`, and `/risk-assessments/risk-assessment-enterprise-demo/action-plan` passed 16 route-width checks across 1440, 1024, 768, and 390. Checks covered distinct budget/action text, no protected fallback, no unallowlisted dark-era token hits, no root/body/main horizontal overflow, and local table overflow at tablet/mobile widths.
- [DONE] Gap Assessment creation drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/gap-assessments` passed route and drawer checks at 1440, 1024, 768, and 390. Checks covered the `Run gap assessment` right drawer, title/source inputs, reachable footer actions, no protected fallback, no unallowlisted dark-era token hits, and no root/body/main horizontal overflow.
- [DONE] Risk source sweep: `rg "className=.*(text-white|text-slate-|bg-slate-|border-white|divide-white|bg-black/|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300|badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger)" apps/web/src/features/risk apps/web/src/features/advanced-risk` returned no matches after replacing legacy local badges with shared `RegStatusPill` and adding mobile-safe table/grid containment.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the first Risk primitive/mobile-containment batch; all passed.
- [DONE] Risk Worker data discovery used the local demo identity headers (`x-tenant-id: tenant-demo`, `x-user-id: user-demo`) and confirmed seeded route IDs: `ebios-study-demo-enterprise`, `quantitative-study-demo-enterprise`, `quant-scenario-demo-ransomware`, and `quant-hypothesis-demo-ransomware-current`.
- [DONE] Risk browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/risks`, `/risk-scenarios`, `/advanced-risk/ebios`, `/advanced-risk/ebios/ebios-study-demo-enterprise`, `/advanced-risk/quantitative`, `/advanced-risk/quantitative/quantitative-study-demo-enterprise`, `/advanced-risk/quantitative/quantitative-study-demo-enterprise/executive-summary`, `/advanced-risk/quantitative/quantitative-study-demo-enterprise/key-metrics`, `/advanced-risk/quantitative/quantitative-study-demo-enterprise/action-plan`, `/quantitative-risk-scenarios/quant-scenario-demo-ransomware`, `/quantitative-risk-hypotheses/quant-hypothesis-demo-ransomware-current`, `/ebios-rm`, and `/quantitative-risk-studies` mounted at 1440 with no protected fallback, error text, root/body/main overflow, or missing headings. The 1024, 768, and 390 checks repeated the representative canonical, detail, and legacy route set with no page-level overflow or protected-route fallback.
- [DONE] Risk mobile navigation probe at 390px confirmed the drawer opens to a 292px navigation panel on `/advanced-risk/quantitative` and exposes the active `Quantitative Risk` item.
- [DONE] Risk incident/exception shared-module source sweep: `rg -n "text-white|bg-slate|bg-gray-9|text-gray-1|text-slate-1|from-slate|to-slate|backdrop-blur|bg-white/|text-white/|border-white/" apps/web/src/features/modules/SharedModuleWorkspacePage.tsx apps/web/src/features/parity/LegacyRouteBridgePage.tsx apps/web/src/features/risk apps/web/src/features/advanced-risk apps/web/src/features/ops` returned no matches.
- [DONE] Risk incident/exception browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/incidents`, `/security-exceptions`, `/modules/incidents`, and `/modules/exceptions` passed 16 route-width checks across 1440, 1024, 768, and 390. Checks covered canonical and legacy route rendering, active navigation labels for promoted incident/exception routes, mobile drawer exposure, no protected fallback, no dark-era token hits, and no root/body/main horizontal overflow.
- [DONE] Risk scenario/register drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/risk-scenarios` passed route and drawer checks at 1440, 1024, 768, and 390. Checks covered the `Add risk register` and `Add risk scenario` right drawers, reachable footer actions, no protected fallback, no unallowlisted dark-era token hits, and no root/body/main horizontal overflow.
- [DONE] Advanced-risk study drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/advanced-risk/ebios`, `/ebios-rm`, `/advanced-risk/quantitative`, and `/quantitative-risk-studies` passed 16 route-width checks across 1440, 1024, 768, and 390. Checks opened the `Create EBIOS study` and `Create quantitative study` right drawers, confirmed study setup controls/defaults, confirmed reachable footer actions, and found no protected-route fallback, unallowlisted dark-era token hits, or root/body/main horizontal overflow.
- [DONE] Evidence and Assurance source sweep: `rg "className=.*(text-white|text-slate-|bg-slate-|border-white|divide-white|bg-black/|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300|badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger)" apps/web/src/features/evidence apps/web/src/features/assurance apps/web/src/features/conmon` returned no matches after replacing legacy local badges with `RegStatusPill`, adding shared main containment, and deferring nested Evidence Explorer multi-column grids to wider breakpoints.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the Evidence and Assurance primitive/mobile-containment batch; all passed.
- [DONE] Evidence and Assurance Worker smoke used `npm --prefix cloudflare run dev:local` and served the latest built assets: `assurance-workbench-BEgw6CsI.js` and `index-BDd9m3a0.css`.
- [DONE] Evidence and Assurance browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/`, `/tasks`, `/evidence-management`, `/features/evidence-management`, `/evidence/jobs`, `/evidence/sources`, `/conmon/executions`, `/conmon/profiles`, `/features/continuous-monitoring`, `/assurance`, `/assurance/evidence?artifact=normalized_bundle&evidenceJobId=bacafef5-4489-4f87-976b-73d32ee63e10`, `/assurance/tracker`, `/assurance/packages`, `/assurance/reviews`, and `/assurance/agent-runs` passed 60 route-width checks across 1440, 1024, 768, and 390. No page-level or main-area horizontal overflow, protected-route fallback, white-on-light deterministic evidence text, root/body overflow, or same-origin mount failure was observed.
- [DONE] Direct flagged Evidence Explorer route check at 1440, 1024, 768, and 390 confirmed `Evidence Explorer` mounted with active Evidence/Assurance navigation context, no root/body/main horizontal overflow, no protected fallback, mobile navigation control present, and no white deterministic-copy text.
- [DONE] Evidence source configuration drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/evidence/sources` passed route and drawer checks at 1440, 1024, 768, and 390. Checks covered the `Add evidence source` right drawer, provider switching to AWS, AWS region/access key/secret key fields, reachable footer actions, no protected fallback, no unallowlisted dark-era token hits, and no root/body/main horizontal overflow.
- [DONE] Evidence Management source-creation drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/evidence-management` passed route and drawer checks at 1440, 1024, 768, and 390. Checks covered the `Add evidence source` right drawer, provider switching to AWS, AWS access key/secret key fields, reachable footer actions, no protected fallback, no unallowlisted dark-era token hits, and no root/body/main horizontal overflow.
- [DONE] Evidence source collection/destructive-review static gates on 2026-06-13: `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` all passed; `npm --prefix ../../cloudflare run typecheck` from `apps/web` passed. The build emitted `index-D5bD5APf.css`, `evidence-operations-BCKaHVxv.js`, `assurance-workbench-2f0tv9UR.js`, `builders-ai-COwwfK9b.js`, and `index-Dl4sR3XF.js`.
- [DONE] Evidence source collection/destructive-review Worker smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/evidence-management` and `/evidence/sources` passed 1440, 1024, 768, and 390 checks for route rendering, protected fallback, active Evidence context, root/body/main overflow, and local table scrolling at tablet/mobile widths. At 390, the `Queue evidence collection` and `Delete evidence source` modals stayed within the viewport, exposed `Cancel`, primary, and `Close` actions, and were canceled without mutating data.
- [DONE] Evidence Explorer action-review static gates on 2026-06-13: `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` all passed; `npm --prefix ../../cloudflare run typecheck` from `apps/web` passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets emitted successfully.
- [DONE] Evidence Explorer action-review Worker smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/assurance/evidence?artifact=normalized_bundle&evidenceJobId=bacafef5-4489-4f87-976b-73d32ee63e10` passed 1440, 1024, 768, and 390 checks for route rendering, protected fallback, active Evidence context, root/body/main overflow, and presence of `Run eval`, `Build 20x`, and `Run agent`. At 390px, `Run deterministic evaluation`, `Build 20x package`, and `Run assurance agent` modals stayed within the viewport, included selected-job context, exposed `Cancel`, primary, and `Close` actions, and were canceled without mutating data.
- [DONE] Privacy and Resilience source sweep: `rg "className=.*(text-white|text-slate-|bg-slate-|border-white|divide-white|bg-black/|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300|badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger)|BadgeClass|badge-" apps/web/src/features/privacy apps/web/src/features/resilience` returned no matches after replacing legacy local badges with `RegStatusPill` and adding mobile-safe containment.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the Privacy and Resilience primitive/mobile-containment batch; all passed.
- [DONE] Privacy and Resilience Worker smoke used `npm --prefix cloudflare run dev:local` and served the latest built assets: `index-BDVqTGn-.js` and `index-DdIz7Doi.css`.
- [DONE] Privacy and Resilience browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/`, `/privacy`, `/privacy/processings/9260b8ef-c608-4bcf-bb33-2eee7e457633`, `/resilience`, and `/resilience/business-impact-analyses/5e2c3b22-73ec-4113-8f07-9f1911dc346a` passed 20 route-width checks across 1440, 1024, 768, and 390. No page-level horizontal overflow, protected-route fallback, unexpected dark-era classes, missing reachable actions, or missing primary route text was observed. The only browser-side white text hit was the contrast-safe white-on-purple staging pill and was allowlisted.
- [DONE] Resilience BIA drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/resilience` passed route and drawer checks at 1440, 1024, 768, and 390. Checks covered the `Create business impact analysis` right drawer, perimeter and matrix fields, reachable footer actions, no protected fallback, no unallowlisted dark-era token hits, and no root/body/main horizontal overflow.
- [DONE] Vendors and Trust source sweep: `rg "className=.*(text-white|text-slate-|bg-slate-|border-white|divide-white|bg-black/|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300|badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger)|BadgeClass|badge-" apps/web/src/features/tprm apps/web/src/features/portal` returned no matches after replacing legacy local badges with `RegStatusPill` and adding mobile-safe containment.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the first Vendors and Trust primitive/mobile-containment batch; all passed.
- [DONE] Vendors and Trust Worker smoke used `npm --prefix cloudflare run dev:local` and served the latest built assets: `index-BMVEXrDz.js`, `index-C_NDXO8G.css`, `program-operations-EOUJwqtx.js`, and `grc-governance-DiKRhfu_.js`.
- [DONE] Vendors and Trust browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/third-party`, `/third-party/entities/entity-demo-resilience`, `/portal`, and `/portal/assignments/portal-assignment-demo-vendor` passed 16 route-width checks across 1440, 1024, 768, and 390. No page-level horizontal overflow, protected-route fallback, unexpected dark-era classes, missing reachable actions, or missing primary route text was observed.
- [DONE] Third-Party Management creation drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/third-party` passed route and drawer checks at 1440, 1024, 768, and 390. Checks covered the `New entity`, `New solution`, and `New contract` right drawers, representative form fields, reachable footer actions, no protected fallback, no unallowlisted dark-era token hits, and no root/body/main horizontal overflow.
- [DONE] Integrations source sweep: `rg "className=.*(text-white|text-slate-|bg-slate-|border-white|divide-white|bg-black/|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300|badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger)|BadgeClass|badge-" apps/web/src/features/integrations` returned no matches after replacing legacy local badges with `RegStatusPill` and adding mobile-safe containment.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the integrations primitive/mobile-containment and route-ownership batch; all passed. `verify:ia-shell` now checks route ownership for `/tasks` and `/integrations`.
- [DONE] Integrations Worker smoke used `npm --prefix cloudflare run dev:local` and served the latest built assets after the route fix: `index-B6lOuSI0.js`, `index-Co8zPV4S.css`, and `workspace-utilities-sBRvvFwk.js`.
- [DONE] Integrations browser smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/integrations` passed 4 route-width checks across 1440, 1024, 768, and 390. No page-level horizontal overflow, protected-route fallback, unexpected dark-era classes, missing reachable actions, or missing primary route text was observed. `/automation-manager` and `/features/automation-manager` remain preserved aliases.
- [DONE] Automation Manager connector drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/integrations`, `/automation-manager`, and `/features/automation-manager` passed 12 route-width checks across 1440, 1024, 768, and 390. Checks opened the `Create connector` right drawer, confirmed connector name/provider controls and provider options, confirmed reachable footer actions, and found no protected-route fallback, unallowlisted dark-era token hits, or root/body/main horizontal overflow.
- [DONE] Assets and Systems shared-module source sweep: `rg "className=.*(text-white|text-slate-|bg-slate-|border-white|divide-white|bg-black/|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300|badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger)|BadgeClass|badge-" apps/web/src/features/modules apps/web/src/features/integrations` returned no matches after replacing the remaining `/modules` directory badge aliases with readable status pill aliases.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the Assets and Systems shared-module batch; all passed.
- [DONE] Assets and Systems Worker smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/assets`, `/components`, `/interconnections`, `/supply-chain`, and `/modules` passed 20 route-width checks across 1440, 1024, 768, and 390. No page-level horizontal overflow, protected-route fallback, unexpected dark-era classes, missing primary route text, or missing canonical active navigation state was observed for promoted routes; `/modules` remains a preserved directory route.
- [DONE] Setup/builders/admin/fedramp hotspot source sweep: `rg "className=.*(text-white|text-slate-|bg-slate-|border-white|divide-white|bg-black/|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300|badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger)|BadgeClass|badge-" apps/web/src/features/setup apps/web/src/features/builders apps/web/src/features/core apps/web/src/features/fedramp apps/web/src/features/grc/GrcAdministrationPage.tsx apps/web/src/features/grc/ScrutinyEnginePage.tsx` returned no matches after replacing legacy badge aliases with readable status pill aliases and light separators.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the setup/builders/admin/fedramp hotspot batch; all passed. `verify:ia-shell` continued to validate `/tasks` and `/integrations` route ownership.
- [DONE] Setup/builders/admin/fedramp Worker smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/setup/general`, `/builders/dashboard-builder`, `/grc-admin`, `/scrutiny-engine`, `/frameworks`, and `/fedramp/provider` passed 24 route-width checks across 1440, 1024, 768, and 390. No page-level horizontal overflow, protected-route fallback, unexpected dark-era classes, missing route text, or missing active navigation state was observed. `/scrutiny-engine` maps to canonical `/grc-admin/scrutiny-engine` for active nav, and `/fedramp/provider` maps to canonical `/trust-center`.
- [DONE] Reports and Exports source sweep: `rg "className=.*(text-white|text-slate-|bg-slate-|border-white|divide-white|bg-black/|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300|badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger)|BadgeClass|badge-" apps/web/src/features/reports apps/web/src/features/ai/ComplianceExportsPage.tsx apps/web/src/features/grc/ReportBundlesPage.tsx apps/web/src/features/grc/ReportBundleDetailPage.tsx apps/web/src/features/builders/ReportBuilderPage.tsx apps/web/src/features/builders/ReportBuilderWorkspace.tsx` returned no matches after replacing remaining report/export badge aliases with readable status pill aliases and adding local export table overflow containment.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the first Reports and Exports primitive/mobile-containment batch; all passed.
- [DONE] Reports and Exports Worker smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/reports`, `/reports/dora-roi`, `/report-bundles`, `/builders/report-builder`, `/compliance-exports`, and `/features/compliance-exports/fedramp/poams` passed 24 route-width checks across 1440, 1024, 768, and 390. Checks covered route rendering, protected-route fallback, contrast-token leftovers with the known contrast-safe staging pill allowlisted, and page/main overflow. Later active-state alias verification covers secondary/admin route mappings that were still quiet in this earlier smoke pass.
- [BLOCKED] Compliance export job removal verification on 2026-06-13: `rg "compliance-exports/jobs.*DELETE|DELETE.*compliance-exports|deleteCompliance|removeCompliance|ai/compliance-exports/jobs" cloudflare/src apps/web/src/features/ai` found no existing delete path. `apps/web/src/features/ai/api.ts` exposes only compliance-export workspace GET, job POST, and job GET. `cloudflare/src/services/ai/http.ts` handles compliance-export jobs with GET/POST/download and falls through to `methodNotAllowed(['GET', 'POST'])`; implementing true persisted job removal would require a backend API contract change and remains blocked under this plan.
- [DONE] Broader native route-family Worker visual QA on 2026-06-13 used the integrated Worker shell at `http://127.0.0.1:8787`: 44 canonical, preserved, and admin/setup routes were checked at 1440, 1024, 768, and 390 for 176 route-width checks with zero failures. The matrix covered Home, Starter Guide, Work Queue, Compliance, Risk, Evidence and Assurance, Vendors and Trust, Assets and Systems, People and Access, Privacy and Resilience, Reports and Exports, Automation and Builders, Admin, `/modules`, and `/modules/tasks`; checks asserted route rendering, no protected fallback, visible text, nav/sidebar presence, and no root/body/main page-level overflow. A wider exploratory pass also included two Vanta prototype routes; those remain reference-only and had expected prototype-specific differences rather than native Regovise shell regressions.
- [DONE] Static gates re-ran after the compliance-export blocker classification and broader route-family Worker QA on 2026-06-13: `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, `npm run build`, and `npm --prefix ../../cloudflare run typecheck` all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes, `/tasks` and `/integrations` route ownership checked, 17 preservation families, 31 admin-gated routes, 1 internal-gated route, 199 accessibility-scanned source files, and production build assets emitted successfully with only the existing Vite chunk-size warning.
- [DONE] Static gates re-ran after the permission-edge IA verifier hardening on 2026-06-13: `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, `npm run build`, `npm --prefix ../../cloudflare run typecheck`, and `git diff --check` all passed. Evidence: 13 canonical IA groups, 79 promoted nav routes, `/tasks` and `/integrations` route ownership checked, 19 preservation families, 31 admin-gated routes, 1 internal-gated route, 47 standard-gated nav routes, 16 standard route-family gates, 200 accessibility-scanned source files, and production build assets `index-BE2n4Eom.css`, `index-CgHRx9uz.js`, and `assurance-workbench-ZOIQjtIS.js` emitted successfully with only the existing Vite chunk-size warning.
- [DONE] Automation and Builders/Admin source sweep: `rg "badge-(neutral|warning|error|success|positive|danger)|text-white|text-slate-|bg-slate-|border-white|divide-white|bg-black/|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300" apps/web/src/features/builders apps/web/src/features/ai apps/web/src/features/setup apps/web/src/features/grc/GrcAdministrationPage.tsx apps/web/src/features/grc/ScrutinyEnginePage.tsx` returned no matches after replacing the remaining response automation, evidence mapping, RegML, and AI policy builder badge aliases with shared readable status pill aliases.
- [DONE] Shared tabs mobile containment fix: `apps/web/src/components/ui/tabs.tsx` now constrains tab lists to `max-w-full overflow-x-auto` and prevents tab triggers from shrinking, so dense builder tabs scroll locally instead of widening the page at 390px.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the Automation and Builders/Admin primitive/mobile-containment batch; all passed.
- [DONE] Automation and Builders/Admin Worker smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/response-automation`, `/evidence-mapping`, `/features/regml`, `/ai-policy-builder`, `/builders/export-builder`, `/builders/export-builder/docx-template`, `/builders/form-builder`, `/builders/rules-builder`, `/builders/questionnaire-builder`, `/builders/wayfinder-builder`, `/setup/general`, `/setup/security`, `/setup/sso`, `/setup/mfa`, `/setup/service-accounts`, and `/setup/modules-features` passed 64 route-width checks across 1440, 1024, 768, and 390. Checks covered route rendering, protected-route fallback, contrast-token leftovers with the known contrast-safe staging pill allowlisted, and page/main overflow.
- [DONE] Privacy creation drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/privacy` passed 4 route-width checks across 1440, 1024, 768, and 390. Checks opened `New processing`, `New right request`, and `New breach record`, confirmed drawer headings, required fields, and footer actions, and found no protected-route fallback, page-level overflow, or unexpected dark-era classes.
- [DONE] Vanta reference route preservation smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/vanta-clone/vendors`, `/vanta-clone/starter-guide`, `/vanta-clone/tests`, `/vanta-clone/controls`, `/vanta-clone/frameworks`, `/vanta-clone/compliance/documents/all`, `/vanta-clone/risk/library`, and `/vanta-clone/users` passed 16 route-width checks at 1440 and 390 after adding local prototype containment for the tests summary/table, controls summary/table, and documents filters/table screens. Checks covered expected reference text, route reachability, and page/root overflow for the table-heavy prototype routes.
- [DONE] People and Access source sweep: `rg "className=.*(text-white|text-slate-|bg-slate-|border-white|divide-white|bg-black/|cyan-300|amber-300|rose-300|emerald-300|violet-300|indigo-300|badge-neutral|badge-warning|badge-error|badge-success|badge-positive|badge-danger)|BadgeClass|badge-" apps/web/src/features/iam apps/web/src/features/core/MePage.tsx` returned no matches after replacing legacy badge aliases with readable status pill aliases and adding local table overflow containment.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the People and Access primitive/mobile-containment batch; all passed.
- [DONE] People and Access Worker smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/workspace/me`, `/workspace/team`, `/workspace/access`, `/workspace/domains`, `/users`, and `/setup/user-management-roles/roles` passed 24 route-width checks across 1440, 1024, 768, and 390. No page-level horizontal overflow, protected-route fallback, unexpected dark-era classes, missing primary route text, or missing canonical active navigation state was observed; mobile drawer checks confirmed active state remains visible after opening.
- [DONE] People/Admin setup access action smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/setup/service-accounts`, `/setup/sso`, and `/setup/user-management-roles/mfa` passed 12 route-width checks across 1440, 1024, 768, and 390. Checks covered route rendering, no protected fallback, no root/body/main horizontal overflow, no dark-era token hits, and the service-account deactivate confirmation modal staying within the viewport with `Cancel` and `Deactivate token` actions reachable.
- [DONE] People team/group drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/workspace/team` passed 4 route-width checks across 1440, 1024, 768, and 390. Checks opened `Add team member` and `Create group`, confirmed required form fields and footer actions, found no protected-route fallback, no root/body/main horizontal overflow, and no unexpected dark-era classes after the shell staging badge was converted to a readable purple pill.
- [DONE] People temporary-password drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/workspace/team` passed 4 route-width checks across 1440, 1024, 768, and 390. Checks opened a row-level `Set Temp Password`/`Rotate Temp Password` action, confirmed the `Set temporary password` drawer, password fields, and footer actions, and found no protected-route fallback, page-level overflow, or unexpected dark-era classes.
- [DONE] Access Control role-management drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/workspace/access` passed 4 route-width checks across 1440, 1024, 768, and 390. Checks opened `Add role` and `Assign role`, confirmed role/permission inputs, assignment selects, recursive scope controls, reachable footer actions, and found no protected-route fallback, unallowlisted dark-era token hits, or root/body/main horizontal overflow.
- [DONE] Framework Detail requirement drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/frameworks/4bfb89dd-7a58-44f0-8791-41aa747d104c` passed 4 route-width checks across 1440, 1024, 768, and 390. Checks opened `Add requirement`, confirmed reference/title/description fields and footer actions, and found no protected-route fallback, unallowlisted dark-era token hits, or root/body/main horizontal overflow.
- [DONE] Dashboard Builder creation drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/builders/dashboard-builder` passed 4 route-width checks across 1440, 1024, 768, and 390. Checks opened `Create dashboard`, confirmed dashboard title/access controls, switched to private access to reveal the allowed-groups field, confirmed footer actions, and found no protected-route fallback, unallowlisted dark-era token hits, or root/body/main horizontal overflow.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the Report Builder creation drawer migration; all passed.
- [DONE] Report Builder creation drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/builders/report-builder` passed 4 route-width checks across 1440, 1024, 768, and 390. Checks opened `Create report`, confirmed report title/owner/chart/module controls and footer actions, and found no protected-route fallback, unallowlisted dark-era token hits, or root/body/main horizontal overflow.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the Report Builder share/subscription drawer migration; all passed.
- [DONE] Report Builder create/share/subscription drawer smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/builders/report-builder` passed 4 route-width checks across 1440, 1024, 768, and 390. Checks opened `Create report`, `Record share`, and `Create subscription`, confirmed required form controls and footer actions, and found no protected-route fallback, unallowlisted dark-era token hits, or root/body/main horizontal overflow.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-10 after the Report Builder delete modal migration; all passed.
- [DONE] Report Builder delete modal smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/builders/report-builder` passed 4 route-width checks across 1440, 1024, 768, and 390. Checks opened `Delete report definition`, confirmed `Cancel` and `Delete report` actions, and found no protected-route fallback, unallowlisted dark-era token hits, or root/body/main horizontal overflow.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-11 after the Export Builder and Dashboard Builder action-flow conversion; all passed.
- [DONE] Export Builder action-flow smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/builders/export-builder` passed route and action checks at 1440, 1024, 768, and 390. Checks opened `Create export configuration`, `Import field mappings`, and `Delete export configuration`, confirmed reachable footer actions, and found no protected-route fallback or root/body/main horizontal overflow. A focused 1024px retry confirmed the delete modal after an automation sequencing false negative.
- [DONE] Dashboard Builder delete modal smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/builders/dashboard-builder` passed route and action checks at 1440, 1024, 768, and 390. Checks opened `Create dashboard` and `Delete dashboard`, confirmed reachable footer actions, and found no protected-route fallback or root/body/main horizontal overflow.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-11 after the Report Builder subscription-removal and setup/admin destructive-action modal batch; all passed.
- [DONE] Report Builder subscription-removal and setup/admin modal smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/builders/report-builder`, `/setup/tags`, and `/setup/classification` passed 12 route-width checks across 1440, 1024, 768, and 390. Checks opened `Remove subscription`, `Delete tag`, and `Delete classification`, confirmed `Cancel` plus destructive actions remained reachable, and found no protected-route fallback, unallowlisted dark-era token hits, or root/body/main horizontal overflow.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-11 after the Response Automation and Evidence Mapping review-modal batch; all passed. Evidence: 13 canonical IA groups, 76 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 199 source files scanned by the accessibility-token gate with only intentional contrast-safe allowlist hits, and production build assets emitted successfully.
- [DONE] Response Automation and Evidence Mapping review-modal smoke used the integrated Worker shell at `http://127.0.0.1:8787`: `/response-automation` and `/evidence-mapping` passed 8 route/action checks across 1440, 1024, 768, and 390. Checks opened `Delete response job`, `Delete question`, and `Remove evidence mapping`, confirmed `Cancel` plus destructive actions remained reachable, and found no protected-route fallback, unallowlisted dark-era token hits, or root/body/main horizontal overflow. The Evidence Mapping check created one temporary mapping for `assessment_summary.json`, exercised the removal confirmation, and cleaned that temporary mapping back up.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-11 after the next action-flow and active-nav batch; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, and production build assets emitted successfully.
- [DONE] Source prompt/badge sweep on 2026-06-11: `rg -n "window\\.(confirm|prompt)|badge-(success|neutral|warning|danger|error|positive)" apps/web/src -g '*.tsx' -g '*.ts'` returned no matches.
- [DONE] Worker route-family QA used the integrated Worker shell at `http://127.0.0.1:8787`: 56 routes passed at 1440, 1024, 768, and 390 for 224 checks total. Checks covered top-level IA routes, representative legacy/contextual routes, admin-only builder/setup routes, the flagged Evidence Explorer route, `/modules`, `/modules/tasks`, `/portal`, and Vanta prototype routes. No HTTP failure, strict fallback/error text, empty render, page-level overflow, missing desktop/tablet active navigation, missing mobile navigation control, or visible text contrast failure was observed.
- [DONE] Worker action-flow QA used the integrated Worker shell at `http://127.0.0.1:8787`: 12 required checks and 24 optional checks passed across 1440, 1024, 768, and 390. Checks opened `Queue report export`, `Copy starter template`, `Remove dashboard tile`, `Remove sub-template`, `Reset factory defaults`, `Delete Wayfinder template`, `Delete questionnaire assignment`, `Delete tag`, `Delete classification`, and `Deactivate service account` where data made each action available; 4 optional checks were skipped because the corresponding data-dependent action was absent at that width/session.
- [DONE] In-app Browser sanity check on 2026-06-11 opened `http://127.0.0.1:8787/builders/report-builder`, clicked the exact `Export` button, and confirmed the `Queue report export` dialog exposed visible `Cancel` and `Queue export` actions.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-12 UTC after the builder/admin destructive-detail action-flow batch; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, and production build assets `index-9RplWkVH.js` and `index-FTj9kbpI.css` emitted successfully.
- [DONE] Builder/admin action-flow Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/builders/questionnaire-builder`, `/builders/form-builder`, and `/grc-admin` passed route and action checks at 1440, 1024, 768, and 390. Checks opened `Remove question`, `Remove rule`, `Remove form section`, `Remove form field`, and `GRC job result`, confirmed visible/reachable cancel/close/destructive actions, confirmed GRC drawer JSON payloads stay locally contained, and found no protected-route fallback, root/body/main horizontal overflow, or application-error text.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-12 after the persisted report/export action-flow batch; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, and production build assets `index-IpDtDdYQ.js`, `builders-ai-BSWqpS5C.js`, and `index-D2MqiEeR.css` emitted successfully.
- [DONE] Persisted Reports and Exports Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/reports`, `/reports/dora-roi`, and `/compliance-exports` passed route checks at 1440, 1024, 768, and 390 with no protected-route fallback, root/body/main horizontal overflow, unallowlisted visible text contrast failures, or bad text. Action checks opened `Inspect export`, `Regenerate report export`, `Delete report export`, DORA `Inspect export`, DORA `Regenerate report export`, DORA `Delete report export`, and `Retry compliance export`; each drawer/modal exposed reachable close/cancel/download/regenerate/delete/retry actions.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-12 after the People and Access inspect/destructive-review action-flow batch; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, and production build assets emitted successfully.
- [DONE] People and Access inspect/destructive-review Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/workspace/team`, `/workspace/access`, `/users`, and `/setup/user-management-roles/roles` passed route and action checks at 1440, 1024, 768, and 390. Checks opened `Inspect user`, `Delete user`, `Inspect group`, `Delete group` or the built-in disabled delete state, `Inspect role`, `Delete role` or the built-in disabled delete state, `Inspect assignment`, and `Remove assignment`; drawer/modal headings and reachable cancel/close/destructive actions were confirmed, local table scroll containers stayed contained, and no protected-route fallback, root/body/main horizontal overflow, bad text, or visible contrast issue was observed.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web` on 2026-06-12 after the People and Access metadata edit/active-alias batch; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, and production build assets emitted successfully.
- [DONE] People and Access metadata edit Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/workspace/team`, `/workspace/access`, `/users`, `/setup/user-management-roles/roles`, and `/setup/user-management-roles/mfa` passed 20 route-width checks across 1440, 1024, 768, and 390. Checks opened `Edit user`, `Edit group`, and `Edit role`, confirmed built-in group/role edit actions stay disabled, confirmed reachable drawer close/cancel/save actions, and after the alias fix confirmed People and Access active navigation plus mobile drawer active state on canonical and legacy routes with no protected fallback or page-level horizontal overflow.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare`, on 2026-06-12 after the People and Access access-edit action-flow batch; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare IAM service typecheck passed, and production build assets emitted successfully.
- [DONE] People and Access access-edit Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/workspace/team` and `/workspace/access` passed route and action checks at 1440, 1024, 768, and 390. Checks opened `Edit user`, `Edit group`, `Edit role`, and `Edit assignment`, confirmed group-membership checkboxes, custom group scope and member controls, role permission textarea, assignment principal/role/user/scope controls, visible close/cancel/save actions, desktop and mobile active People and Access navigation, local table scrolling at 390, and no protected fallback, error text, or page-level horizontal overflow.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare`, on 2026-06-12 after the Assessment Evidence Packages action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-CljF54-m.css` and `index-EIIJY9k8.js` emitted successfully.
- [DONE] Assessment Evidence Packages Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/assessment-evidence-packages` passed route and package-review action checks at 1440, 1024, 768, and 390. Checks used the seeded `FEDHR-FY20-FEDRAMP-XLSX` package with 301 requests, 47 rollups, 424 reviewer-comment events, and 2 anomalies; opened Requests, Reviewer Comments, Evidence Rollups, and Anomalies; confirmed request/comment tables use local scroll with sticky headers; confirmed request/comment/rollup/anomaly drawers expose reachable source/locker actions; confirmed mobile nav exposes Compliance > Audit Packages; and found no protected-route fallback, root/body/main horizontal overflow, or visible contrast issue.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare`, on 2026-06-12 after the Risk scenario/register inspect/edit/delete action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-BgfPb8ms.css` and `index-BCeiV0yQ.js` emitted successfully.
- [DONE] Risk scenario/register action-flow Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/risk-scenarios` passed route and action checks at 1440, 1024, 768, and 390. Checks opened register Inspect/Edit/Delete and scenario Inspect/Edit/Delete flows for seeded `Enterprise Risk Register` and `Cloud asset inventory drift`; confirmed Cancel/Close/Save/Delete review actions stayed reachable; confirmed the 390px scenario edit drawer became a full-height sheet with `Save changes`, `Cancel`, and `Close` visible; confirmed the scenario table uses local scroll with sticky headers; confirmed mobile navigation exposes Risk entries; and found no protected-route fallback, root/body/main horizontal overflow, or visible contrast issue. Delete flows were opened and canceled without mutating seeded data.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare`, on 2026-06-12 after the Privacy and Resilience inspect/edit/destructive-review action-flow batch; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-BgfPb8ms.css` and `index-DFOgV0Zd.js` emitted successfully.
- [DONE] Privacy and Resilience action-flow Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/privacy`, `/privacy/processings/9260b8ef-c608-4bcf-bb33-2eee7e457633`, `/resilience`, and `/resilience/business-impact-analyses/5e2c3b22-73ec-4113-8f07-9f1911dc346a` passed route and action checks at 1440, 1024, 768, and 390. Checks opened processing Inspect/Edit/Delete, right-request Inspect/Edit/Delete, breach Inspect/Edit/Delete, BIA Inspect/Edit/Delete, processing detail Edit/Delete, and BIA detail Edit/Delete flows; confirmed Cancel/Close/Save/Delete review actions stayed reachable; confirmed local tables/cards did not create page-level horizontal overflow; and found no protected-route fallback, error text, or visible contrast issue. Delete flows were opened and canceled without mutating seeded data.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare` and `git diff --check`, on 2026-06-12 after the Agent Run Inspector writeback action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-CS4NvHca.css`, `index-KtLT08jm.js`, and `assurance-workbench-C5Q-_ZWR.js` emitted and served by the local Worker.
- [DONE] Agent Run Inspector writeback Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/assurance/agent-runs` passed route and action checks at 1440, 1024, 768, and 390. Checks confirmed no root/body/main horizontal overflow, no protected fallback or visible error text, and a mounted `Agent Run Inspector`; opened the first writeback action menu, opened the `Inspect writeback` right drawer, confirmed payload content and `Export draft` footer action stayed visible, opened the `Approve writeback?` review modal, confirmed reviewer note and primary/cancel actions stayed visible, and canceled without mutating seeded writeback data.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare` and `git diff --check`, on 2026-06-12 after the Review Queue decision action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-BQo-rH4x.css`, `index-BbDpwe2u.js`, and `assurance-workbench-CN76Dph6.js` emitted and served by the local Worker.
- [DONE] Review Queue decision Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/assurance/reviews` passed route and action checks at 1440, 1024, 768, and 390. Checks confirmed no root/body/main horizontal overflow, no protected fallback or visible error text, and a mounted `Review Queue`; opened the selected recommendation action menu, opened the `Inspect recommendation` right drawer, confirmed recommendation payload content and drawer actions stayed visible, opened both `Accept recommendation` and `Reject recommendation` review modals, confirmed reviewer note and cancel/primary actions stayed visible, and canceled without mutating seeded review data.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare` and `git diff --check`, on 2026-06-12 after the Tracker Workbench import/conversion action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-DilaANfP.css`, `index-BVh2kSsE.js`, and `assurance-workbench-BohZqrFm.js` emitted and served by the local Worker.
- [DONE] Tracker Workbench Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/assurance/tracker` passed route and action checks at 1440, 1024, 768, and 390. Checks confirmed no root/body/main horizontal overflow, no protected fallback or visible error text, and a mounted `Tracker Workbench`; opened the `New tracker import` right drawer, confirmed `Tracker rows JSON` and `Import rows` stayed reachable, opened the `Convert tracker import to 20x` review modal, confirmed cancel/convert actions stayed visible, and canceled without mutating seeded tracker data.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare` and `git diff --check`, on 2026-06-12 after the Package Explorer action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-6zBfFz4h.css`, `index-DyQ06Nw3.js`, and `assurance-workbench-DgQkI2G0.js` emitted and served by the local Worker.
- [DONE] Package Explorer Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/assurance/packages` passed route and action checks at 1440, 1024, 768, and 390. Checks opened package `Inspect readiness`, `Inspect current artifact`, and `Inspect review history` right drawers, confirmed reachable close/evidence/review actions and local artifact preview scrolling, and found no protected-route fallback, root/body/main horizontal overflow, missing active navigation, or visible contrast issue.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare` and `git diff --check`, on 2026-06-12 after the Third-Party entity detail action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-BCMOQqMk.css`, `index-bP5vakeO.js`, and `program-operations-CA4peXo8.js` emitted and served by the local Worker.
- [DONE] Third-Party entity detail Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/third-party/entities/entity-demo-vendor` passed route and action checks at 1440, 1024, 768, and 390. Checks opened `Inspect entity`, `Inspect solution`, `Inspect contract`, and `Inspect assessment` right drawers for seeded `Northwind Cloud`, confirmed reachable close/reference actions and local drawer scrolling, and found no protected-route fallback, root/body/main horizontal overflow, missing active navigation, or visible contrast issue.
- [DONE] Re-ran `npm run typecheck`, `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck` from `cloudflare`, `git diff --check`, and `npm run build` on 2026-06-12 after the Automation Manager provider/scope/run action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-BuD9JKjL.css` and `index-Dhc2R3Oh.js` emitted and served by the local Worker.
- [DONE] Automation Manager provider/scope/run Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/integrations` passed route and action checks at 1440, 1024, 768, and 390. Checks opened `Configure provider`, `Manage resource scope`, `Review secure configuration`, `Edit raw config`, generated local D1 test run `a2f29f45-5b62-452f-bcf7-c9d72e431dac`, opened `Inspect run`, confirmed reachable close/apply/save actions, confirmed mobile action menu and 390px full-width security drawer behavior, and found no protected-route fallback, root/body/main horizontal overflow, missing active navigation, or visible contrast issue.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, `npm run build`, `npm run typecheck` from `cloudflare`, and `git diff --check` on 2026-06-12 after the shared-module record action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-EIxlzBkP.css` and `index-Bq6zVz10.js` emitted and served by the local Worker.
- [DONE] Shared-module record action-flow Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/assets?record=8895a0d5-46f2-4e72-8820-141396986511` passed route and action checks at 1440, 1024, 768, and 390. Checks opened `Inspect record`, `Edit core fields`, `Manage relationships`, `Review activity`, and `Archive record` for seeded `QA Asset Action Flow`; confirmed drawer/modal titles, form fields, footer actions, relationship editing controls, activity note controls, and destructive cancel paths remained reachable; confirmed the 390px drawer fits the viewport without horizontal overrun; and found no protected-route fallback, root/body/main horizontal overflow, missing active navigation, or visible contrast issue. Sibling route smokes for `/components`, `/interconnections`, and `/supply-chain` at 390 confirmed active nav labels, action affordances, and no page-level overflow.
- [DONE] Incident and exception drilldown action-flow Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/incidents?record=d15aa175-53c8-4cdb-b492-adeb7d3f33d2` and `/security-exceptions?record=5994ce1e-b6e2-48fb-886e-28e148d2a4c4` passed route and action checks at 1440, 1024, 768, and 390. Checks opened `Inspect record`, `Edit core fields`, `Manage relationships`, `Review activity`, and `Archive record`; confirmed incident-specific and exception-specific typed relationship actions, drawer/modal titles, form fields, footer actions, activity note controls, and destructive cancel paths remained reachable; confirmed 390px inspect drawers fit the viewport without horizontal overrun; and found no protected-route fallback, root/body/main horizontal overflow, missing active navigation, or visible contrast issue. Archive flows were opened and canceled without mutating the seeded QA records.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, `npm run build`, `npm run typecheck` from `cloudflare`, and `git diff --check` on 2026-06-12 after the incident/exception drilldown action-flow verification; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-EIxlzBkP.css` and `index-Bq6zVz10.js` emitted and served by the local Worker.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, `npm run build`, `npm run typecheck` from `cloudflare`, and `git diff --check` on 2026-06-12 after the advanced-risk EBIOS/quantitative study detail action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-C_H93mLC.css`, `index-CdjVJLeA.js`, and `advanced-risk-CKRoVq_d.js` emitted successfully.
- [DONE] Advanced-risk EBIOS/quantitative detail Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/advanced-risk/ebios/ebios-study-demo-enterprise` and `/advanced-risk/quantitative/quantitative-study-demo-enterprise` passed route and action checks at 1440, 1024, 768, and 390. Checks opened `Review study snapshot`, `Edit study details`, and `Delete study` flows; confirmed drawer/modal titles, form controls, `Close`, `Cancel`, `Save study`, and guarded `Delete study` actions stayed reachable at 390px; confirmed Risk active navigation for `EBIOS RM` and `Quantitative Risk`; and found no protected-route fallback, root/body/main horizontal overflow, missing active navigation, or visible contrast issue. Delete flows were opened and canceled without mutating seeded demo studies.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, `npm run build`, `npm run typecheck` from `cloudflare`, and `git diff --check` on 2026-06-12 after the Risk action-plan review-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 4 legacy active-state aliases checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-CgMZ1srX.css`, `advanced-risk-Dcq88u1d.js`, and `index-ClmVDKmT.js` emitted successfully.
- [DONE] Risk action-plan review Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/advanced-risk/quantitative/quantitative-study-demo-enterprise/action-plan`, `/risk-assessments/risk-assessment-enterprise-demo/action-plan`, and `/risk-assessments/risk-assessment-enterprise-demo/action-plan/budget-overview` passed route and action checks at 1440, 1024, 768, and 390. Checks opened quantitative `Review action` and core risk `Review treatment` drawers at 390px; confirmed `Close` and `Open scenario`/`Open mapped scenario` actions stayed reachable; confirmed Risk active navigation for quantitative and risk-assessment legacy detail paths; confirmed local table scrolling at tablet/mobile widths; and found no protected-route fallback, root/body/main horizontal overflow, missing active navigation, or visible contrast issue.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, `npm run build`, `npm run typecheck` from `cloudflare`, and `git diff --check` on 2026-06-12 after the Compliance Exports job-inspection action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-B7fV50ck.css`, `builders-ai-COx6Zwnw.js`, and `index-DRu1J1K8.js` emitted successfully.
- [DONE] Compliance Exports job-inspection Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/compliance-exports` and `/features/compliance-exports/fedramp/poams` passed route checks at 1440, 1024, 768, and 390 with Reports and Exports active navigation, no protected-route fallback, and no root/body/main horizontal overflow. At 390px, checks opened the `Observable Security Agent 20x Package` action menu, confirmed `Inspect pipeline`, `Retry export`, `Download file`, and `View in files`, opened the pipeline drawer with `Readiness inputs` and `Pipeline execution`, confirmed reachable close/download actions, opened and canceled the retry modal, and confirmed the export-family tabs scroll locally on mobile instead of widening the page.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, `npm run build`, `npm run typecheck` from `cloudflare`, and `git diff --check` on 2026-06-12 after the Scrutiny Engine review-modal action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate, Cloudflare typecheck passed, and production build assets `index-B7fV50ck.css`, `builders-ai-COx6Zwnw.js`, and `index-N0J6vrka.js` emitted successfully.
- [DONE] GRC admin and Scrutiny Engine Worker QA used the integrated Worker shell at `http://127.0.0.1:8787`: `/grc-admin` and `/grc-admin/scrutiny-engine` passed route checks at 1440, 1024, 768, and 390 with no protected-route fallback and no root/body/main horizontal overflow. Checks confirmed active admin navigation for `GRC Content and AI`, Scrutiny Engine local active state at desktop/tablet widths, mobile navigation at 390px, and the 390px `Generate Scrutiny Run` review modal opened full-width with reachable `Cancel`, `Generate run`, and `Close` actions; the modal was canceled without mutating data.
- [DONE] Revalidated the latest export-builder, report-builder, setup/admin, framework-library, gap-assessment, and report-export action-flow batch in the Worker shell on 2026-06-13. Routes checked: `/builders/export-builder`, `/builders/report-builder`, `/setup/security`, `/setup/service-accounts`, `/grc-admin`, `/framework-library`, `/gap-assessments/38ccd01a0e79a45ce657e1ca94893be1015b287907a7346f9a4307e682ffe326`, `/reports`, and `/reports/dora-roi`. Width checks covered 1440, 1024, 768, and 390 for the six-route matrix; report export row actions were checked at desktop with real pointer events. Checks opened and canceled `Duplicate`, `Test Export`, `Auto Map Fields`, `Delete export configuration`, `Queue report export`, `Delete report definition`, `Remove subscription`, `Update security control`, `Issue service account token`, `Rotate service account`, `Deactivate service account`, `Save AI backend settings`, `Import curated snapshot`, `Refresh SCF crosswalks`, `Import packaged catalogues`, `Create evidence package`, `Create report bundle`, `Generate executive summary`, `Generate board brief`, and report export `Inspect`, `Regenerate`, and `Delete` flows on both report routes. No protected fallback, root/body/main overflow, unreachable primary actions, visible contrast issue, or API-contract change was observed.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm --prefix ../../cloudflare run typecheck` and `git diff --check`, on 2026-06-13 after the latest action-flow QA and ledger update; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, and production build assets `index-DvexW54a.css`, `builders-ai-BzHNK0c7.js`, `assurance-workbench-D4jagTxz.js`, `program-operations-CnAQa96u.js`, and `index-C7NqBhso.js` emitted successfully. `git diff --check` reported no whitespace errors.
- [DONE] Trust Center/FedRAMP provider Worker QA used the integrated Worker shell at `http://127.0.0.1:8787` on 2026-06-13 after the provider action-flow migration. Routes checked: `/trust-center` and `/fedramp/provider` at 1440, 1024, 768, and 390. Checks opened and canceled `Save offering`, `Add service`, `Create grant`, `Add contact`, `Create message`, `Create incident`, `Confirm delivery`, `Queue notices`, `Confirm agencies`, `Sync evaluations`, `Generate VDR report`, `Generate OAR cycle`, `Schedule quarterly review`, `Publish`, `Publish cycle`, `Publish review`, `Add feedback item`, `Close latest feedback item`, `Create change`, `Publish latest notice`, `Publish guide`, `Add release`, `Create scope document`, and `Add crypto record`. Checks found no protected fallback, root/body/main overflow, unreachable modal actions, or visible contrast issue; 390px checks confirmed the `Open navigation` affordance and full-width modals kept cancel/primary/close actions reachable. `Confirm FedRAMP` was disabled on the seeded already-confirmed incident, so queue/agency confirmation flows covered incident mutation review without changing data.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm --prefix ../../cloudflare run typecheck` and `git diff --check`, on 2026-06-13 after the Trust Center/FedRAMP provider action-flow migration and ledger update; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, and production build assets from the local Worker build emitted successfully.
- [DONE] Questionnaire Builder action-flow Worker QA used the integrated Worker shell at `http://127.0.0.1:8787` on 2026-06-13 after the builder creation/assignment migration. Route checked: `/builders/questionnaire-builder` at 1440, 1024, 768, and 390. Checks opened and canceled the new-template review modal and `Create Questionnaire Assignment` right drawer, confirmed `Cancel`, `Create`, and `Create Assignment` actions stayed reachable, confirmed assignment fields remained contained at 390px, confirmed the mobile navigation affordance at 390px, and found no protected-route fallback, root/body/main overflow, unreachable primary actions, visible contrast issue, or browser console errors.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm --prefix ../../cloudflare run typecheck` and `git diff --check`, on 2026-06-13 after the Questionnaire Builder action-flow migration and ledger update; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, and production build assets `index-c0zLjd-u.css`, `builders-ai-Dwa-c_kl.js`, `program-operations-DRmGn0Es.js`, and `index-BZSbIk52.js` emitted successfully. The existing Vite chunk-size warning remains informational only.
- [DONE] Public Questionnaire Response Worker QA used the integrated Worker shell at `http://127.0.0.1:8787` on 2026-06-13 after the public response accessibility migration. Route checked: `/questionnaires/response/cc9aa4b3-ac1d-4f17-b6b1-2ce0d56a1d3f` at 1440, 1024, 768, and 390 using seeded access code `853885633`. Checks validated the access code, confirmed `Access code accepted` status, confirmed labeled response/evidence fields, opened and canceled the `Submit questionnaire response` review modal, verified `Cancel`, `Submit response`, and `Close` actions stayed reachable at 390px, confirmed active `Vendors and Trust` / `Questionnaires` navigation, and found no protected-route fallback, root/body/main overflow, or visible white-on-light contrast issue. Screenshots saved under `.playwright-mcp/regovise-public-questionnaire-response-validated-*.png`.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm --prefix ../../cloudflare run typecheck` and `git diff --check`, on 2026-06-13 after the public questionnaire response accessibility migration and ledger update; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, and production build assets `index-h1J4pH3v.css`, `builders-ai-C3dTlWZx.js`, `program-operations-C7BSfGl-.js`, and `index-9ZdrJ3gd.js` emitted successfully. The existing Vite chunk-size warning remains informational only.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm --prefix ../../cloudflare run typecheck`, on 2026-06-13 after the Assurance Overview drawer migration and shared mobile drawer/sheet positioning fix; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, and production build assets `index-BExQbDRx.css`, `assurance-workbench-OlOdePtG.js`, and `index-DglWu5Sg.js` emitted successfully. The existing Vite chunk-size warning remains informational only.
- [DONE] Assurance Overview Worker QA used the integrated Worker shell at `http://127.0.0.1:8787` on 2026-06-13 after the shared drawer fix. Route checked: `/assurance` at 1440, 1024, 768, and 390. Checks opened the `Inspect here` queue action, confirmed the shared right drawer remained fully inside the viewport at every width, confirmed active Evidence and Assurance navigation, confirmed no protected fallback and no root/body/main page-level horizontal overflow, and verified `Close` plus `Open workbench` footer actions stayed reachable. Drawer screenshots saved under `.playwright-mcp/regovise-assurance-drawer-fixed-*.png`.
- [DONE] Public Portal assignment Worker QA used the integrated Worker shell at `http://127.0.0.1:8787` on 2026-06-13 after the portal assignment action-flow migration. Routes checked: `/portal` and `/portal/assignments/portal-assignment-demo-vendor` at 1440, 1024, 768, and 390. Checks opened and canceled the per-requirement `Inspect response` drawer and `Save requirement response` modal, confirmed the mobile drawer and modal remained inside the 390px viewport, confirmed `Close`, `Review save`, `Cancel`, and `Save response` actions stayed reachable, confirmed the assignment listing stayed reachable from `/portal`, and found no protected fallback, root/body/main overflow, unreachable primary actions, or visible contrast issue. The save and submit review flows were canceled without mutating data.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare` and `git diff --check`, on 2026-06-13 after the public portal assignment action-flow migration and ledger update; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, and production build assets `index-V-dmsli0.css`, `builders-ai-C3dTlWZx.js`, `program-operations-C7BSfGl-.js`, and `index-CnJG5d7U.js` emitted successfully. The existing Vite chunk-size warning remains informational only, and `git diff --check` reported no whitespace errors.
- [DONE] Resilience BIA asset recovery/threshold Worker QA used the integrated Worker shell at `http://127.0.0.1:8787` on 2026-06-13 after the BIA asset action-flow migration. Routes checked: `/resilience/business-impact-analyses/bia-demo-enterprise` at 1440, 1024, 768, and 390, plus legacy alias `/business-impact-analysis/bia-demo-enterprise` at 390. Checks confirmed `Enterprise Service Recovery Study`, `Business Impact Analysis`, `Recovery Matrix`, and `Asset Assessments` rendered with active Privacy and Resilience navigation, no protected fallback, and no root/body/main page-level horizontal overflow. At 390px checks opened the `Identity Platform` asset action menu, opened `Inspect recovery plan`, confirmed the right drawer stayed contained with `Escalation thresholds`, `Close`, and `Review thresholds`, opened the threshold review modal, confirmed `Review thresholds for Identity Platform`, local table overflow containment, `Close`, and `Edit BIA metadata`, and canceled without mutating seeded BIA data.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm --prefix cloudflare run typecheck` and `git diff --check`, on 2026-06-13 after the BIA asset recovery/threshold action-flow migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, `git diff --check` reported no whitespace errors, and production build assets `index-Dr0GyS85.css`, `builders-ai-BIXPpwp5.js`, `program-operations-CfhPGgqq.js`, and `index-VcPf0uO2.js` emitted successfully. The existing Vite chunk-size warning remains informational only.
- [DONE] TPRM entity review/update Worker QA used the integrated Worker shell at `http://127.0.0.1:8787` on 2026-06-13 after the TPRM review-update action-flow migration. Route checked: `/third-party/entities/entity-demo-resilience` at 1440, 1024, 768, and 390. Checks opened `Review and update entity`, `Review and update solution`, and `Review and update contract` drawers; saved unchanged entity, solution, and contract reviews through existing Core update APIs; confirmed success notices for all three paths; confirmed the 390px mobile navigation drawer and full-width review drawer kept primary actions reachable; and found no protected fallback, page-level horizontal overflow, unreachable actions, visible contrast issue, or `method_not_allowed` regression.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm --prefix cloudflare run typecheck` and `git diff --check`, on 2026-06-13 after the TPRM entity review/update migration; all passed. Evidence: 13 canonical IA groups, 78 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 17 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 199 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, `git diff --check` reported no whitespace errors, and production build assets `index-Dr0GyS85.css`, `builders-ai-BIXPpwp5.js`, `program-operations-CwvRo4Af.js`, and `index-l7RtTXFc.js` emitted successfully. The existing Vite chunk-size warning remains informational only.
- [DONE] TPRM vendor import staging and bulk-review Worker QA used the integrated Worker shell at `http://127.0.0.1:8787` on 2026-06-13 after the no-API review-flow migration. Route checked: `/third-party` at 1440, 1024, 768, and 390. Checks opened `Review vendor import` and `Bulk review`, confirmed `Review vendor import staging`, `TaskNimbus`, `Mark review complete`, `Bulk review vendor coverage`, `Entities without contracts`, and `Complete review`, confirmed both modals stayed within the viewport at 390px, captured zero browser console errors/warnings, and found no protected fallback, root/body/main horizontal overflow, unreachable actions, or visible contrast issue.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm --prefix ../../cloudflare run typecheck` and `git diff --check`, on 2026-06-13 after the TPRM vendor import/bulk-review migration; all passed. Evidence: 13 canonical IA groups, 79 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 80 preservation families mapped, 67 legacy bridge route configs checked, 67 legacy bridge IA families checked, 31 admin-gated nav routes checked, 1 internal-gated route checked, 47 standard-gated nav routes checked, 68 standard route-family gates checked, 200 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, `git diff --check` reported no whitespace errors, and production build assets `index-D5HiQSB1.css`, `builders-ai-C1Zi_3T1.js`, `program-operations-u54snPCq.js`, and `index-BbwRybKR.js` emitted successfully. The existing Vite chunk-size warning remains informational only.
- [DONE] Risk Action Tracker Worker QA used the integrated Worker shell at `http://127.0.0.1:8787` on 2026-06-13 after the dedicated tracker route migration. Route checked: `/risk-actions` at 1440, 1024, 768, and 390. Checks confirmed `Action Tracker` renders with active Risk navigation, no protected fallback, no root/body/main horizontal overflow, readable light-theme contrast, local table scrolling, and a mobile-contained `Inspect action` drawer for seeded `QA Incident Action Flow`; the 390px drawer measured 390x900, kept `Close` and `Open source` footer actions inside the viewport, and showed the deterministic-status note. Screenshot saved as `.playwright-mcp/regovise-risk-action-tracker-mobile-drawer.png`.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare` and `git diff --check`, on 2026-06-13 after the Risk Action Tracker migration; all passed. Evidence: 13 canonical IA groups, 79 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 18 preservation families mapped, 31 admin-gated nav routes checked, 1 internal-gated route checked, 200 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, `git diff --check` reported no whitespace errors, and production build assets emitted successfully with only the existing Vite chunk-size warning.
- [DONE] Legacy bridge permission-fallback Worker QA used the integrated Worker shell at `http://127.0.0.1:8787` on 2026-06-13 after the mounted bridge verifier closure. Route checked: `/security-profiles/example-deep-link` at 1440, 1024, 768, and 390. In the current limited browser profile the route safely redirected to `/workspace/me` instead of exposing a security-profile surface; all widths kept the shell mounted, showed readable My Access content, avoided login/fallback/error text, and had no document/body/main horizontal overflow. Allowed-profile rendering for `/security-profiles/*` remains under the remaining permission-edge visual QA item.
- [DONE] Re-ran `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, and `npm run build` from `apps/web`, plus `npm run typecheck` from `cloudflare` and `git diff --check`, on 2026-06-13 after the mounted legacy bridge preservation verifier/ledger update; all passed. Evidence: 13 canonical IA groups, 79 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 5 legacy active-state aliases plus 1 prefix alias checked, 80 preservation families mapped, 67 legacy bridge route configs checked, 67 legacy bridge IA families checked, 31 admin-gated nav routes checked, 1 internal-gated route checked, 47 standard-gated nav routes checked, 68 standard route-family gates checked, 200 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, `git diff --check` reported no whitespace errors, and production build assets emitted successfully with only the existing Vite chunk-size warning.
- [DONE] Final no-API checklist static gates re-ran after ops alias coverage, Vanta prototype active-state/contrast closure, and catalog ledger reconciliation on 2026-06-13: `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, `npm run build`, `npm --prefix ../../cloudflare run typecheck`, and `git diff --check` all passed. Evidence: 13 canonical IA groups, 84 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 10 exact legacy active-state aliases checked, 6 prefix legacy active-state aliases checked, 88 route preservation families mapped, 67 legacy bridge route configs and 67 legacy bridge IA families checked, 31 admin-gated nav routes checked, 1 internal-gated nav route checked, 52 standard-gated nav routes checked, 76 standard route-family gates checked, 200 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, `git diff --check` reported no whitespace errors, and production build assets `index-s2UGrLWP.js` and `index-jKVYfLeb.css` were emitted successfully with only the existing Vite chunk-size warning.
- [DONE] Final no-API Worker visual matrix on 2026-06-13 used `http://127.0.0.1:8787` and saved `regovise-qa-1440-latest.json`, `regovise-qa-1024-latest.json`, `regovise-qa-768-latest.json`, and `regovise-qa-390-latest.json`. The matrix checked 28 representative routes at 1440, 1024, 768, and 390: Home, Starter Guide, Work Queue, the flagged Evidence Explorer path, ops aliases (`/utilities`, `/subsystems`, `/workflow`, `/news-feed`, `/workbench` plus `/features/*` aliases), Compliance, Risk, Evidence and Assurance, Vendors and Trust, Assets and Systems, People and Access, Privacy and Resilience, Reports and Exports, Automation and Builders, Admin, `/modules`, and `/vanta-clone/tests`. The parsed result had `failureCount: 0`, `maxOverflow: 0`, `contrastCandidates: 0`, and `staleDividerRoutes: 0`; `/tasks` rendered Work Queue instead of the generic module page; Evidence Explorer retained deterministic-status copy; and `/vanta-clone/tests` exposed a current-page active marker.
- [DONE] Responsive regression closure on 2026-06-15 used the integrated Worker shell at `http://127.0.0.1:8787` after adding `apps/web/scripts/verify_responsive_routes.mjs` and the `npm run verify:responsive` script. A focused 390px pass saved `/Users/tkhan/IdeaProjects/ciso-assistant-community/artifacts/responsive-qa/2026-06-15T01-58-05-207Z/responsive-summary.json` and passed every checked route including `/vanta-clone/tests`. The full matrix saved `/Users/tkhan/IdeaProjects/ciso-assistant-community/artifacts/responsive-qa/2026-06-15T02-00-14-041Z/responsive-summary.json` and passed 42 routes at 1440, 1024, 768, and 390: Home, Starter Guide, Work Queue, flagged Evidence Explorer, Compliance, Risk, Evidence and Assurance, Vendors and Trust, Assets and Systems, People and Access, Privacy and Resilience, Reports and Exports, Automation and Builders, Admin, `/modules`, `/modules/tasks`, and `/vanta-clone/tests`. The Vanta prototype tests screen received additional mobile containment for summary cards, filter rows, table scrolling, and the program-mapping popover before the green rerun.
- [DONE] Static gates re-ran on 2026-06-15 after the responsive regression closure: `npm run verify:ia-shell`, `npm run verify:a11y-tokens`, `npm run typecheck`, `npm run build`, `npm --prefix cloudflare run typecheck`, `npm --prefix cloudflare run dev:local`, and `git diff --check` all passed. Evidence: 13 canonical IA groups, 84 promoted nav routes covered, `/tasks` and `/integrations` route ownership checked, 88 route preservation families mapped, 67 legacy bridge route configs and 67 legacy bridge IA families checked, 31 admin-gated nav routes checked, 1 internal-gated nav route checked, 52 standard-gated nav routes checked, 76 standard route-family gates checked, 200 source files scanned by the accessibility-token gate with 3 intentional contrast-safe allowlisted occurrences, Cloudflare typecheck passed, and production build assets `index-Zot3xjL5.js` and `index-8-tc_btR.css` emitted successfully with only the existing Vite chunk-size warning.
- [BLOCKED] Remaining universal visual QA is concentrated in data-dependent tenant detail routes, permission-edge profiles, and mutation/propagation edge workflows that cannot be proved from the generic Worker session without new tenant data or alternate profile setup. Allowed remaining scan hits in the checked shell/component set are white text on purple controls (`button-primary`), which are intentional and contrast-safe.
- [DONE] Route smoke coverage: one primary route per top-level IA group plus representative legacy/contextual routes returned HTTP 200, kept the shell mounted, and had no page-level horizontal overflow. Routes checked: `/`, `/program/setup`, `/workspace/me`, `/frameworks`, `/risks`, `/evidence-management`, `/third-party`, `/assets`, `/workspace/team`, `/privacy`, `/reports`, `/chat`, `/setup/general`, `/modules`, `/risk-assessments/risk-assessment-enterprise-demo`, `/portal/assignments/portal-assignment-demo-vendor`.
- [BLOCKED] Remaining universal primitive verification is limited to tenant/permission-edge paths not reproducible in the current generic Worker profile. Checked migrated batches already verify page headers, tabs, filter bars, table shells, status pills, drawers, modals, and mobile sheet/drawer behavior for their representative routes; future tenant-specific route families should pass the same gate before being certified.

## Non Goals

- Do not remove any current route family, module, builder, legacy bridge, public workflow, or permission gate.
- Do not rename data models, API contracts, or persistence concepts yet.
- Do not decide final copy for every menu label yet.
- Do not collapse Regovise into Vanta. Use Vanta as the cohesion reference, not as the product boundary.

## Code Truth Sources

Primary shell and routing sources:

- `apps/web/src/shell/Sidebar.tsx`
- `apps/web/src/shell/AppLayout.tsx`
- `apps/web/src/shell/Topbar.tsx`
- `apps/web/src/shell/shellAccess.ts`

Primary domain and module sources:

- `apps/web/src/features/modules/types.ts`
- `cloudflare/src/services/core/moduleRegistry.ts`
- `cloudflare/src/services/core/semanticCoverage.ts`
- `cloudflare/docs/regovise_backend_mapping.yaml`
- `README.md`

Vanta-style prototype sources:

- `apps/web/src/features/vanta/VantaClonePage.tsx`
- `apps/web/src/features/vanta/VantaAdditionalScreens.tsx`
- `apps/web/src/features/vanta/VantaClonePage.css`

## Current Regovise Domain Inventory

### Current Sidebar Groups

The current sidebar is organized mostly by product implementation area:

| Current group | Current pages and capabilities |
| --- | --- |
| Home | Home, unified search, analytics, my access |
| Program | Program workspace, modules, libraries, frameworks, framework library, assessments, gap assessments, vendors, privacy, resilience, portal, advanced risk |
| Evidence and Monitoring | Evidence management, assessment evidence packages, evidence jobs, continuous monitoring executions, findings, reports, report bundles |
| Assurance | Assurance overview, assurance evidence, tracker, packages, reviews, agent runs |
| Automation | Workspace AI |
| Administration | Guided setup, policies, domains, team, evidence sources, monitoring profiles, permissions, setup, security, automation manager, GRC admin, scrutiny engine, trust center, response automation, evidence mapping, RegML |
| Builders | Form builder, rules builder, export builder, report builder, dashboard builder, questionnaire builder, wayfinder builder |
| Internal | Settings and workflow tools |

This organization preserves access, but it makes users think in terms of systems instead of jobs. A Vanta-style shell should instead make the user think in stable GRC domains.

### Shared Semantic Modules To Preserve

Regovise has a broad semantic module layer that must stay reachable:

- Assets
- Assessments
- Assessment plans
- Capabilities
- Case management
- Catalogues
- Causal analysis
- Changes
- Components
- Data calls
- Evidence locker
- Exceptions
- Incidents
- Interconnections
- Issues
- Policies
- Programs
- Projects
- Questionnaires
- Requests
- Requirements
- Risks
- Security controls
- Security plans
- Security profiles
- Supply chain
- Tasks
- Threats
- Threat models

These are not just navigation items. They are the backbone for Regovise as a configurable GRC workbench. The redesigned navigation should expose them through domain-specific entry points while keeping `/modules` and direct module routes available.

### Builder Capabilities To Preserve

Regovise has builder surfaces that Vanta does not expose as a first-class domain:

- Form builder
- Rules builder
- Export builder
- Report builder
- Dashboard builder
- Questionnaire builder
- Wayfinder builder

These should remain available, but they should move out of the main operator path unless the user has builder/admin permissions.

### Assurance And Evidence Capabilities To Preserve

Important Regovise capabilities that should not get flattened:

- Evidence management
- Evidence jobs
- Evidence sources
- Evidence mapping
- Assessment evidence packages
- Assurance packages
- Assurance reviews
- Assurance tracker
- Agent runs
- Continuous monitoring profiles and executions
- Findings
- Report bundles

The redesign should treat these as one coherent "evidence to assurance" lifecycle rather than several separate tools.

### Risk, Privacy, Vendor, And Resilience Capabilities To Preserve

Regovise already goes beyond baseline compliance tracking:

- Risk assessments
- Advanced risk with EBIOS RM
- Quantitative risk
- Risk scenarios
- Third-party risk and vendors
- Privacy operations
- Resilience and business impact analysis
- Incidents
- Exceptions
- Contracts and entities through legacy bridge surfaces

These map naturally into Vanta-like domains, but Regovise should keep its deeper risk and resilience workflows visible.

### Admin And Access Capabilities To Preserve

Current admin capabilities include:

- Tenant/workspace domains
- Team management
- Workspace access and permissions
- Setup and security settings
- GRC admin
- Scrutiny engine
- Trust center setup
- Response automation
- Feature and RegML tools
- Legacy settings and workflow routes

Admin should become quieter, permission-gated, and task-oriented. It should not dominate the everyday operator sidebar.

## Vanta-Inspired Domain Model

The Vanta reference screens establish a clearer user-facing model:

| Vanta domain | Typical subpages and patterns |
| --- | --- |
| Home | Program health, progress, work reminders, workspace switcher |
| Starter guide | Guided setup phases, onboarding tasks, progress checklist |
| Tests | Test list, test details, results, remediation, deactivated tests, custom tests |
| Reports | Compliance/risk reports, visual progress cards, audit timelines |
| Compliance | Frameworks, controls, policies, documents, audits, settings |
| Customer Trust | Trust center, questionnaires, commitments, accounts, knowledge base |
| Risk | Overview, register, library, action tracker, snapshots, settings |
| Vendors | Vendor discovery, procurement, reviews, managed vendors, reports |
| Assets | Computers, inventory, integrations, scoping |
| Personnel | People, computers, access, background checks, groups, settings |
| Integrations | Available integrations, connected integrations, errors, filters |
| Users and workspace | User table, roles, linking, workspace switcher, account controls |

The important lesson is not the exact labels. The lesson is that every major object family has:

- A stable left-nav home.
- A table-first list view.
- A detail view with tabs.
- A small set of visible workflow actions.
- Consistent statuses and pills.
- Contextual drawers or modals for add/edit flows.
- Responsive behavior that keeps the left-nav mental model intact.

## Proposed Regovise IA Crosswalk

### Top-Level Navigation Target

| Proposed Regovise group | Vanta analogy | Current Regovise surfaces | Purpose |
| --- | --- | --- | --- |
| Home | Home | `/`, analytics, search, workspace health | Executive and operator landing page with program health, alerts, and next actions |
| Starter Guide | Starter guide | `/program/setup`, setup pages, guided onboarding | Setup phases for domains, people, frameworks, integrations, evidence, and first assessments |
| Work Queue | My work plus Vanta task surfaces | `/workspace/me`, tasks, findings, reviews, action plans | The user's assigned approvals, evidence requests, findings, remediations, and reviews |
| Compliance | Compliance | Frameworks, libraries, controls, requirements, assessments, policies, documents, audits | The central framework-control-policy-evidence workspace |
| Risk | Risk | Risk scenarios, assessments, EBIOS, quantitative risk, exceptions, incidents, threats | Risk register, risk library, analysis, treatment, and action tracking |
| Evidence and Assurance | Documents plus assurance | Evidence management, jobs, sources, packages, reviews, tracker, monitoring | Continuous evidence collection, audit readiness, and assurance review lifecycle |
| Vendors and Trust | Vendors plus Customer Trust | Third-party, supply chain, entities, contracts, questionnaires, trust center, portal | External assurance, customer trust, vendor reviews, questionnaires, commitments |
| Assets and Systems | Assets plus Integrations | Assets, components, interconnections, integrations, secure configuration, scoping | Systems of record, scope, assets, integrations, components, and dependency maps |
| People and Access | Personnel plus Users | Team, users, workspace access, IAM, SSO/MFA, my access, domain access | Personnel, access, identity, ownership, assignments, and least privilege |
| Privacy and Resilience | Privacy plus resilience | Privacy, processings, incidents, resilience, BIA, operational scenarios | Privacy operations, processing records, breach readiness, resilience and continuity |
| Reports and Exports | Reports | Reports, DORA, report bundles, dashboards, export builder | Executive reports, board packets, audit exports, custom reporting |
| Automation and Builders | Vanta AI plus admin builders | Chat, RegML, response automation, evidence mapping, builders, data wizard | AI-assisted workflows, import/mapping, builders, rules, automation |
| Admin | Settings | Workspace settings, security, domains, permissions, GRC admin, internal tools | Permission-gated configuration, content administration, and system controls |

### Compliance Subnavigation

Compliance should become the main daily GRC workspace:

| Proposed item | Current routes/features |
| --- | --- |
| Overview | Program workspace and framework progress summary |
| Frameworks | `/frameworks`, `/framework-library`, libraries |
| Controls | `/controls`, security controls, requirements, applied controls |
| Assessments and Tests | `/assessments`, gap assessments, requirement assessments, conmon test-like checks |
| Policies | `/policies`, policy builder, policy versions |
| Documents and Evidence | Evidence locker, documents, evidence packages, evidence mapping |
| Audits | Assurance packages, assurance reviews, audit timeline views |
| Findings | `/findings`, issues, action plans |
| Settings | Framework scoping, assessment settings, compliance exports |

This keeps Vanta's "Compliance" mental model while preserving Regovise's decoupled controls, requirements, evidence, assessments, and policy relationships.

### Risk Subnavigation

Risk should be a first-class domain, not a collection of scattered advanced tools:

| Proposed item | Current routes/features |
| --- | --- |
| Overview | Risk dashboards and analytics |
| Risk register | Risks, risk scenarios, assessments |
| Risk library | Scenario library, threat and vulnerability libraries |
| Action tracker | Findings, remediations, exceptions, tasks |
| EBIOS RM | `/advanced-risk/ebios` and legacy EBIOS routes |
| Quantitative risk | `/advanced-risk/quantitative` |
| Incidents and exceptions | Incidents, exceptions, case management |
| Settings | Risk scoring models, profiles, workflows |

### Evidence And Assurance Subnavigation

Evidence and assurance should model the full audit-readiness lifecycle:

| Proposed item | Current routes/features |
| --- | --- |
| Evidence | Evidence management and evidence locker |
| Sources | Evidence sources and integrations |
| Jobs | Evidence jobs and import status |
| Monitoring | Continuous monitoring profiles and executions |
| Reviews | Assurance reviews |
| Tracker | Assurance tracker |
| Packages | Assessment and assurance evidence packages |
| Agent runs | Assurance agent runs |

### Vendors And Trust Subnavigation

This domain should combine Vanta's Vendor and Customer Trust strengths:

| Proposed item | Current routes/features |
| --- | --- |
| Overview | Third-party dashboard and customer trust summary |
| Vendors | Third-party and supply-chain records |
| Reviews | Vendor assessments and questionnaires |
| Questionnaires | Questionnaire builder/runtime and customer questionnaires |
| Commitments | Contracts, commitments, evidence promises |
| Trust center | Trust center and portal surfaces |
| Accounts | External accounts and entity relationships |
| Reports | Vendor and trust reports |

### Assets And Systems Subnavigation

Assets and integrations should become a scoping-first systems workspace:

| Proposed item | Current routes/features |
| --- | --- |
| Overview | Asset/system health |
| Assets | Assets module |
| Components | Components and interconnections |
| Integrations | Connected and available integrations |
| Scope | Tenant/workspace domains, framework scope, system scope |
| Secure configuration | Secure config services and component checks |
| Supply chain | Supply-chain module |
| Data calls | Data calls and ingestion |

### People And Access Subnavigation

Personnel and user administration should be connected but permission-aware:

| Proposed item | Current routes/features |
| --- | --- |
| People | Team and user lists |
| My access | `/workspace/me` |
| Access | Workspace access, permissions, IAM |
| Groups and domains | Domain/folder access and assignment groups |
| Roles | Roles, profiles, SSO/MFA |
| Tasks | User tasks and assignments |
| Service accounts | Service/integration identities when available |
| Settings | People/access settings |

## Left Navigation Requirements

### Desktop

- Use a persistent Vanta-like left navigation with a width near 260 to 288 px.
- Keep the workspace switcher and environment badge near the top.
- Include a global search/help field near the top of the nav.
- Show top-level domains with expandable child lists.
- Highlight both the active parent and active child.
- Use section separators sparingly.
- Put counts and progress pills only where they support action, such as Work Queue, Findings, Reviews, or Starter Guide.
- Keep admin-only, builder-only, and internal routes hidden unless the profile allows access.
- Preserve direct route access for legacy and deep-link URLs.

### Tablet

- Collapse the nav into a rail with a flyout menu.
- Preserve active route state in the rail and flyout.
- Keep page-level tabs sticky enough that users do not lose local context.
- Keep table filters in a compact toolbar or filter drawer.

### Mobile

- Use an off-canvas drawer for the full nav.
- Keep a small sticky top header with page title, drawer trigger, and primary action.
- Move secondary actions into menus or bottom sheets.
- Convert right-side drawers into bottom sheets or full-screen panels.
- Allow tables to scroll horizontally inside their own container only. The page itself should not overflow horizontally.

### Responsive Acceptance Rules

- No page-level horizontal overflow at 390 px, 768 px, 1024 px, and 1440 px.
- Main page grids collapse to one column before content gets cramped.
- Detail tabs wrap or become horizontally scrollable without truncating labels.
- Modals fit within viewport height and keep footer actions visible.
- Table filters remain reachable on mobile.
- The left-nav mental model remains consistent across breakpoints.

## 1000X Differentiation Target

Regovise should not just look like Vanta. It should feel more complete, more inspectable, and more powerful.

### 1. Unified GRC Graph

Every important object should be traceable:

- Framework to requirement
- Requirement to control
- Control to policy
- Policy to document
- Document to evidence
- Evidence to test/assessment
- Assessment to finding
- Finding to risk
- Risk to treatment
- Treatment to task
- Task to owner

Vanta-style navigation makes this easier to understand. Regovise can win by making the graph visible and actionable.

### 2. Scope As A Product Primitive

Vanta's scoping screens are a strong reference. Regovise can go further by making scope consistent across:

- Frameworks
- Assets
- Systems
- Integrations
- People
- Vendors
- Domains/folders
- Evidence sources

The user should always know what is in scope, why it is in scope, who owns it, and which frameworks depend on it.

### 3. Evidence-First Trust

AI and automation should always show provenance:

- Source file
- Source control
- Source framework
- Extracted field
- Confidence
- Reviewer
- Last refresh
- Open gaps

This is a key advantage over products that only summarize.

### 4. Continuous Assurance Lifecycle

Evidence, monitoring, review, and package readiness should be one cohesive domain:

- Collect
- Normalize
- Map
- Review
- Package
- Export
- Monitor
- Renew

This is stronger than a static audit document library.

### 5. AI That Creates Auditable Work

AI should not just answer questions. It should create reviewable, source-backed artifacts:

- Draft control mappings
- Draft questionnaire responses
- Draft policy sections
- Draft remediation steps
- Draft risk scenarios
- Draft evidence evaluations
- Draft customer trust responses

Every AI artifact should be reversible, reviewable, and linked to source evidence.

### 6. Open And Extensible Content Model

Regovise's module registry, builders, importers, and APIs are differentiators. Keep them visible for power users, but hide their complexity from everyday operators.

## Feature Preservation Checklist

Before any implementation is accepted, every current capability should be mapped to one of these states:

| State | Meaning |
| --- | --- |
| Primary nav | Visible in the new left nav |
| Secondary nav | Visible as a child item under a primary domain |
| Local tab | Visible inside a detail page or workspace |
| Contextual action | Reachable through a button, menu, drawer, or command |
| Search/command | Reachable through global search or command palette |
| Legacy route | Direct route remains supported but not promoted |
| Admin-only | Hidden unless permissions allow it |
| Internal-only | Hidden except internal profiles |

Nothing should be deleted just because it does not fit the first draft of the nav.

## Phased Implementation Plan

### Phase 0: Decide The Product Language

Resolve the naming choices before moving pixels:

- "Compliance" vs "Program"
- "Tests" vs "Assessments"
- "Documents" vs "Evidence"
- "Domains" vs "Scope"
- "Customer Trust" vs "Trust Center"
- "Vendors" vs "Third Parties"

Recommendation: use the more familiar Vanta-style label in the nav, then preserve the Regovise-specific depth inside the page.

### Phase 1: Introduce A Route Crosswalk

Create a single source of truth for the new IA:

- Domain group
- Child item
- Route
- Permission gate
- Badge/count source
- Legacy aliases
- Responsive behavior

This should be separate from visual components so we can test coverage before changing the shell.

### Phase 2: Build The New Shell Components

Build Vanta-like primitives:

- `RegoviseAppShell`
- `RegoviseSidebar`
- `RegoviseNavGroup`
- `RegoviseMobileDrawer`
- `RegovisePageHeader`
- `RegoviseTabs`
- `RegoviseFilterBar`
- `RegoviseTableShell`
- `RegoviseRightDrawer`

Use existing React patterns and CSS conventions from `apps/web`.

### Phase 3: Remap Primary Navigation

Switch the sidebar to the new IA, but keep:

- Existing routes
- Existing permission gates
- Existing legacy bridges
- Existing Vanta clone prototype routes
- Existing admin/internal route visibility

### Phase 4: Standardize Page Layouts

Convert high-traffic pages first:

- Home
- Starter Guide
- Compliance overview
- Frameworks
- Controls
- Assessments
- Evidence
- Risk register
- Vendors
- Assets
- People/access
- Integrations

### Phase 5: Responsive QA

Every converted page needs desktop, tablet, and mobile checks:

- 1440 px desktop
- 1024 px tablet landscape
- 768 px tablet portrait
- 390 px mobile

Check the left nav, drawer behavior, tables, filters, modals, and right drawers.

## Risks And Open Questions

| Topic | Risk | Recommendation |
| --- | --- | --- |
| Domain terminology | Regovise uses "domains" for workspace scoping, while the redesign uses domain groups for navigation. | Consider using "Scope" for workspace/domain scoping in UI where ambiguity matters. |
| Tests vs assessments | Vanta's "Tests" is intuitive, but Regovise has assessments, monitoring executions, requirements, controls, and evidence checks. | Use "Assessments and Tests" during transition, then decide based on user testing. |
| Documents vs evidence | Vanta has documents as a visible compliance object. Regovise has richer evidence semantics. | Use "Documents and Evidence" in Compliance, and "Evidence" in Assurance. |
| Admin density | Current admin, builder, and internal tools are too prominent for everyday users. | Move them under permission-gated Admin and Automation/Builders groups. |
| Legacy route findability | Hiding old route names could make deep features feel lost. | Preserve direct routes and add global search aliases. |
| Feature breadth | Regovise can look overwhelming if every module becomes a nav item. | Promote domains, not implementation modules. Keep modules accessible through the domain pages. |

## Acceptance Criteria For The Redesign

- Every current route family is mapped to primary nav, secondary nav, local tab, contextual action, search/command, legacy route, admin-only, or internal-only.
- No existing permission gate is weakened.
- No existing route is removed without an explicit migration and redirect plan.
- The left nav remains coherent on desktop, tablet, and mobile.
- Core GRC jobs require fewer clicks than the current shell.
- Tables and filter bars remain usable on mobile.
- Detail pages use consistent tabs, drawers, status pills, and action menus.
- AI/automation outputs show source provenance and review states.
- The final UI makes Regovise feel like a unified GRC operating system, not a list of tools.
