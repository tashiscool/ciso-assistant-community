# Proposed Regovise information architecture and role workflows

Design proposal, 2026-10-11. This document reorganizes the **existing audited suite** around the work of security analysts, ISSOs, ISSMs, control owners, assessors and authorizing officials. It does not approve new architecture, database entities, public APIs, persistence behavior, permission changes, or product implementation. System/cycle semantics are contract decisions described below. Federal RMF/FedRAMP language is a provisional working context, not a declaration that every tenant follows one fixed cadence or that a generated package is an authorization decision.

Source evidence: [core frontend map](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/frontend-core.md), [extended frontend map](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/frontend-extended.md), [backend map](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/backend.md), [route inventory](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/frontend-route-components.json). Visual alternatives and external product research belong to the main design brief. This proposal supplies the IA, workflow ownership, route continuity and state contract behind those visuals.

## Recommendation: seven daily destinations, one selected system and cycle

Use seven stable primary navigation items:

1. **My Work** — next actions assigned to me, my team and permitted systems.
2. **Systems** — portfolio directory, selected system overview, boundary and inventory.
3. **Controls** — baseline, implementation statements, narratives, inherited controls and policies.
4. **Evidence** — evidence library, tests, requests and collection context. “Evidence & Tests” is an equally clear full label if the selected visual direction has enough space.
5. **Risk & POA&M** — findings, vulnerabilities, risk, remediation, exceptions and response records.
6. **Authorization** — assessment planning/execution, packages, human reviews, decision evidence and ATO maintenance.
7. **Monitoring** — collection health, evidence freshness, assessment/maintenance obligations, drift and consequential events.

Do not add top-level entries for frameworks, libraries, assurance, agent runs, every export format, every builder, EBIOS, quantitative studies, privacy, BIA, vendors or configuration. Preserve all of them through contextual tabs, record actions, the global command/search surface, **Workspace tools**, and **Administration**. These two utility menus should be compact launchers with categories/search, not another always-expanded 60-link sidebar.

The seven labels remain stable across roles. Filter inaccessible areas and actions rather than inventing separate products or changing the underlying authority through a “role switch.” Default landing and saved views can reflect a user's job. A person with multiple roles can choose a view preset; the preset never changes permissions.

**Why retain Monitoring as a primary destination:** the target is maintaining ATOs, so a daily view of stale evidence, failed collection, missing feeds, expiring obligations and open review gates deserves one click. It is a projection of source records, not a second copy of evidence or risk data. **Why assessments belong in Authorization:** assessments are activities within a selected authorization effort and need the baseline, assessor, plan, scope and output package context. To preserve discoverability, Assessments must be a visible first-level local tab in Authorization and a strong Start/Resume assessment action from Controls and Evidence; it must not be hidden under Packages.

## Scope and shell contract

The upper shell should make three scopes explicit: **Portfolio → System → Authorization cycle**. Below that, every record header shows its authoritative owner and scope.

| Scope | What the user sees | What the user can do | Important boundary |
| --- | --- | --- | --- |
| Portfolio | System directory; cross-system due/blocked/expiring work; posture trends; shared controls/library; team workload and permitted reports | Select a system, compare permitted systems, act on assigned work, manage shared sources if authorized | Aggregated figures need coverage/unknown counts; lack of access is not a zero. |
| System | Name/ID, boundary owner, environment/impact/baseline labels when defined, accountable ISSO/ISSM, live operating records, dependencies | Work on that system's controls, evidence, assets, remediation and assessments | A system is not automatically one IAM folder, one application, one perimeter or one security-plan record. |
| Authorization cycle | Cycle label/version, purpose, working versus frozen state, target dates, assessment and decision context, package lineage | Prepare/review cycle-specific assessment and package; inspect previous cycles; maintain obligations | Proposed cycle must have approved identity/version/relationship rules; current API has no equivalent universal cycle anchor. |
| Record | Record type/ID/version, system/cycle associations, domain scope, owner, freshness/status, last saved/last reviewed and related entities | Perform permitted record actions; inspect evidence and history | Do not infer owner/system/cycle solely from a matching title or a URL. |

Topbar order: workspace → portfolio/system selector → cycle selector when relevant → scope-aware search → actual jobs/notifications → help → account. “All permitted systems” is an explicit context. System/cycle switching preserves the current area when meaningful; if no matching view exists, explain and open the nearest valid context. Never silently keep a record from the prior system on screen.

The system selector is searchable, lists recent/pinned permitted systems and always offers “All systems.” A cycle selector distinguishes current live operational context from named previous/frozen snapshots. It displays **No cycle selected** or **Unlinked record** when associations are unknown. A user can inspect historical evidence without inadvertently editing the current cycle. No scope picker is an authentication/tenant override; preview identity controls stay in local diagnostics.

At desktop width, use a compact stable sidebar with readable seven-item labels and scoped badges. At tablet width, retain accessible text navigation through an expandable sidebar/drawer; the existing group-icon rail that exposes only the first route is insufficient. Mobile: focus-managed modal navigation, Escape/backdrop/close handling, full-screen record panels, sticky Save/Cancel, scrollable local tabs, cards or contained table scrolling. A primary icon-only button always has an accessible name; badges/colors do not replace text status.

## Local structure: full suite without primary-menu overload

Show at most five local tabs before an accessible **More** menu. Never use More to hide the page's central task. Local tabs operate inside the selected scope, and record drawers provide cross-object links that return to the original filtered list.

| Primary area | First local tabs | More/contextual work | Record-level view |
| --- | --- | --- | --- |
| My Work | Assigned to me; My team; Needs review; Due soon; Completed | Calendar, all permitted work, saved views, shared task register, validation queue | Summary → required action → source/evidence → rationale → action history. |
| Systems | Overview; Boundary; Assets; Dependencies; People | Components/interconnections/supply chain; vendors/contracts; privacy; resilience/BIA; program/project context; capabilities; system activity | System identity and boundary → owned inventory/dependencies → related control/evidence/authorization impacts. |
| Controls | Implementation; Narratives; Inheritance; Policies; Baseline | Requirements, catalogue/SCF mappings, security profiles, common controls, control library, assessment plan templates | Control/ref → applicability/responsibility → implementation → evidence/tests → gaps/tasks → history. |
| Evidence | Evidence library; Tests; Requests; Collection runs; Coverage | Tracker imports, normalized artifact/proof graph explorer, document mappings, source configuration for authorized operators | Evidence → source/time/scope → control mappings → evaluations → sufficiency/review → consumption in packages. |
| Risk & POA&M | POA&M; Findings; Vulnerabilities; Risks; Exceptions | Changes, incidents/cases, causal analysis, qualitative assessments, threat portfolio, EBIOS, quantitative studies and budget | Finding/risk → affected system/control → evidence → treatment/owner/due → retest/closure → history. |
| Authorization | Overview; Assessments; Packages; Reviews; Maintenance | Decision record, requirements/obligations, trust-center/provider publication, executive reports, exports and eMASS/FedRAMP/OSCAL choices | Cycle → scope/baseline/plan → evidence sufficiency → package/version → review → authorized decision/conditions. |
| Monitoring | Attention; Evidence freshness; Collection health; Obligations; Changes | Run history, feed coverage, ConMon profiles, agent workflow traces and approval drafts, metrics/analytics | Detected event → confidence/coverage → affected records → recommended next action → human review/action readback. |

Use one **ownership destination** for each underlying object. For example, Monitoring can show a changed asset and offer “Review change”; it opens the change record in Risk & POA&M, with original monitoring context retained. Evidence Tests can show an assessment requirement; it links to the assessment in Authorization. A reusable catalogue remains in the portfolio Control library; its installed system baseline appears inside Controls. “Assurance” becomes the evidence-to-review-to-package workflow woven across these areas, rather than another parallel product menu.

Specialist areas are enabled by need/capability and remain searchable:

- Vendors/supply chain and interconnections are contextual Dependencies work under Systems; a portfolio vendor workspace remains in Workspace tools.
- Privacy and BIA are system-local context tabs under Systems when linked; full cross-system processing/rights/breach/BIA workspaces remain in Workspace tools.
- Qualitative/EBIOS/quantitative analysis is under Risk & POA&M → Advanced analysis. Current fixed-template quantitative output must be labeled as such until a real modeling capability exists.
- AI is a contextual **Draft / Explain / Suggest** action next to the source material, with provenance and review. Workspace AI remains available from search/Workspace tools. AI provider/terms/configuration is Administration.
- Builders are reusable-template authoring tools in Workspace tools → Templates; contextual “Edit template” opens the right tool if permitted. Regular users launch an assessment or generate an output rather than navigating through seven builders.
- Integrations/imports/sources/ConMon profiles are Monitoring/Evidence context actions for authorized operators; workspace-wide configuration lives in Administration → Connections and data.
- IAM/security/SSO/MFA/service accounts/settings/branding/email/logs/license/content governance belong to Administration. My Access remains in account menu and help for denied actions.

## Job-oriented landing layouts

Every landing page has a context header, one primary next action, a compact count summary, a prioritized work list and a recent-action readback. ATO posture, evidence posture, operational monitoring and review posture are separate labeled indicators. A green collection job cannot make the ATO indicator green. No decorative all-good metric when no evidence was collected.

| Persona | Landing/layout | Primary work surface | Read-only/authority boundary |
| --- | --- | --- | --- |
| Security analyst | My Work, selected permitted portfolio/system; actionable findings/failed tests/stale feed first; split list/detail with affected system/control and raw-evidence link | Evidence tests, monitoring triage, vulnerability/finding treatment, retest | Can investigate/draft/perform delegated changes; cannot accept risk or authorize merely because a test passes. |
| ISSO | Selected System Overview; five blocks: authorization/cycle context, obligations due, control implementation/evidence gaps, POA&M, significant changes. One “Continue next action” and next handoff | Control coverage/narratives, evidence/test readiness, POA&M owners, assessments/package review | System stewardship needs explicit write rights. Present recommended vs accepted treatment and working vs reviewed artifacts separately. |
| ISSM / portfolio lead | Systems portfolio; ordered system rows with authorization date/unknowns, blockers, owners, stale evidence, open risks, upcoming reviews; workload side panel | Cross-system prioritization, shared controls, assignments, escalation, package/handoff review | Portfolio visibility is permission-scoped. Reassignments/role grants/risk acceptance remain separate controlled actions. |
| Control owner / system owner | My Work filtered to owned controls/assets; evidence requests and implementation sections with due dates; full control drawer can open | Implementation statement, evidence/reference response, gap correction, readiness for review | Assignment gives workflow responsibility, not automatic administrator permissions or authority over other owners. |
| Assessor | Authorization → selected Assessment; scoped requirement/question list left, selected item/evidence center, finding/sufficiency/rationale panel right; progress by evaluated item | Execute assessment plan, challenge evidence, record test observations, review sufficiency, issue findings | Has assessment-scoped evidence visibility. Reviews preserve source/evaluation truth and cannot rewrite collector history. |
| AO / decision reviewer | Authorization → decision view for a named frozen package; concise scope/risks/conditions/changes/readiness, review ledger, expandable evidence lineage | Review decision package, accept/challenge documented conditions, record authorized decision if contract permits | A proposed authorization decision form requires an approved backend authority/audit contract. “Advance RMF handoff” is not an AO decision. |
| External contributor / auditee | Dedicated portal with assignment title/system context disclosure permitted by policy, due date, request instructions, response/evidence and save/submit receipt | Respond to assigned requests/questionnaires; view authorized feedback | Minimal assignment/share-token scope. No internal primary sidebar, tenant tools, all-system directory or source credentials. Fix current anonymous parameter-routing defect before treating share links as usable. |

Do not require users to know whether source storage is D1/R2, whether a view is called parity, or which legacy product named the route. Show source object, scope, saved status, reviewer and next action instead.

## Suggested operating rhythms by job

These are configurable product workflows, not regulatory deadlines. Real dates/cadence come from the selected authority/system/cycle policy and the obligation's owner. Expose the scheduled next occurrence, overdue condition, pause/exception and evidence needed to complete it.

| Persona | Daily | Weekly | Monthly / scheduled cycle |
| --- | --- | --- | --- |
| Analyst | Triage failed/stale jobs; review new findings/changes; attach evidence; update assigned treatment; retest closures | Compare coverage/drift; review recurring failures and aged blockers; validate scanner inventory scope; prepare team handoff | Prepare monitoring evidence/metrics; review vulnerability status; support recurring tests and package-delta review. |
| ISSO | Review system attention list, overdue tasks, evidence requests, assessment comments and approval gates | Review control/narrative changes, inheritance/provider changes, POA&M exceptions and inventory impact; assign missing owners | Prepare configured ConMon/VDR/OAR/review outputs; verify package readiness and evidence validity; maintain conditions/decision dates. |
| ISSM | Review systems with urgent blockers, incidents, expired obligations or missing accountable owner | Portfolio comparison and team capacity; common-control ownership; authorize delegated handoff/escalation when permitted | Portfolio posture, recurring reporting, change/risk trends, upcoming renewals/assessment cycles and leadership summary. |
| Control owner | Resolve own request; update implementation draft/evidence; answer clarification; read save/submit receipt | Check owned evidence freshness and upcoming review dates; correct rejected submissions | Attest/review owner-controlled implementation when required by policy, supply updated evidence and confirm scope. |
| Assessor | Resume assigned plan; inspect evidence; record observations; challenge/accept with rationale; issue finding | Review outstanding evidence/sufficiency/comments; reconcile changes with assessment scope; assess unresolved issues | Finalize assigned assessment outputs/review record; provide package changes requested and traceable report. |
| AO/reviewer | Act on ready assigned decisions or clarifications; inspect material change notifications as delegated | Review approaching decision/handoff dates and unresolved conditions | Review configured authorization/maintenance package and conditions; record authorized decision with explicit scope and version. |
| External contributor | Respond to assigned request; save draft and submit; handle clarification | Review pending/returned assignments | Complete recurring questionnaire/evidence submissions on the actual configured schedule. |

Sample ISSO daily flow: open selected system → inspect Monitoring Attention → failed AWS collection links to saved source/run detail → resolve authorized configuration or request operator help → rerun → inspect actual collection result/coverage → open affected control/tests → review generated finding → assign/update POA&M → return to My Work and see the persisted next action. A queued job receipt alone never closes the work.

Sample authorization flow: select explicit cycle → choose baseline/assessment plan → assign assessors/owners → execute tests and evidence requests → review findings and sufficiency → generate a working package → inspect validation/reconciliation/lineage → reviewer accepts or requests changes → preserve a named package snapshot → record authorized decision/conditions through an approved contract → activate maintenance obligations. Current implementations already support substantial middle steps, while universal system/cycle/decision anchors require contract work.

## Scope contracts that need an explicit decision

These are design requirements to resolve, not independent architecture changes. Existing route and entity semantics must remain intact until approved.

| Decision | Existing evidence / mismatch | UI contract to decide |
| --- | --- | --- |
| C1: accountable System identity | [IAM folder](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/types.ts:1) is a security/domain hierarchy; [Perimeter](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/assessments/types.ts:1) is assessment scope; App Management is business-unit/application metadata; shared security plans/components carry flexible fields. None is a universal System object. | Stable system identity, boundary ownership, scoped object associations and authorized users. Decide whether an approved existing anchor can represent the meaning or a new one is required; do not rename a folder “System.” |
| C2: authorization cycle identity | Core assessments have version/status/perimeter/framework; RMF package handoff has stage projections. A package job and assessment are not inherently the same authorization cycle. | Cycle identity/purpose, active/archive/frozen states, baseline/evidence/assessment/package/decision relationships and prior-cycle carryover. |
| C3: control implementation and inheritance | Catalogue controls, applied controls and shared security-control records are distinct sources. Current inheritance-looking fields do not establish a universal shared-provider consumer model. | System applicability, responsible party, implementation statement, inherited provider/consumer validation/version/provenance and boundary for overrides. |
| C4: evidence consumption / sufficiency | Existing artifacts/jobs/mappings/review decisions/package lineage are real, but universal system/cycle reuse rules are not defined. | Collection scope, observed/collected/expiry times, reusable source versus cycle snapshot, reviewer sufficiency and affected consumers on source change. |
| C5: job/action authority | Current shell is coarse permission-derived navigation; [shellAccess](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/shellAccess.ts:148) does not describe all fine-grained record actions. | Read/write/run/review/accept-risk/authorize/publish/dispatch authority by scope and action, including assessor/external assignment limits. Role-oriented presentation must not add permissions. |
| C6: unified work queue | Existing `/tasks`, shared `/modules/tasks`, recommendations, applied controls, validation, requests, findings and writebacks overlap. | Stable projection referencing authoritative source objects, permitted aggregation, ownership, due dates and completion readbacks; avoid creating a duplicate task system without approval. |
| C7: obligations/cadence | ConMon profiles do not have a full schedule editor; current calendar derives events; provider outputs have cadence records. | Which policy establishes cadence, owner, next due/completed/exception states, change trigger and evidence expectation; no fixed universal “monthly ATO complete” switch. |
| C8: authorization decision / package freeze | RMF advance mutates workflow stage; current package builder produces artifacts, review records and validation. | Legal/organizational decision authority, frozen version/hash, decision record/conditions/dates, change control and relationship to working operational truth. |
| C9: external dispatch | Ordinary agent approval/export is draft-only. Dedicated admin Jira route can dispatch with separate status/receipt. Generic connector test/sync is dry-run. | Visible review/approve/dispatch separation, exact target/payload/scope and actual delivery receipt; no automatic promotion of approved draft to delivered. |
| C10: read composition and URL scope | Many current workspaces load tenant-wide folders/lists; not all sources refetch on identity. | Exact scoped read capability, route-context resolution, cancellation/stale results, scope changes with unsaved drafts, support for unassigned records. A frontend filter alone is not an authorization boundary. |

Until C1/C2 are resolved, new selectors must be either an explicitly labeled design mock or a **scope view over existing records** labeled with their real domain/perimeter/plan/package meaning. The proposal must not ship fake system rows or invented authorization-cycle IDs.

## Route, navigation and write-permission separation

Navigation is an affordance. A route is a stable address. A server permission is authority. They should never be collapsed into “adminOnly therefore everything here is safe.”

| Layer | Proposed rule | Current code implication |
| --- | --- | --- |
| Visibility | Show permitted primary areas and contextually relevant local tabs; search includes authorized specialist capabilities | Preserve existing coarse filtering initially; do not grant new capability to make a mock visible. |
| Deep link | Preserve record ID, original query parameters, artifact/audience/focus and source return context | Existing assurance/workbench/shared-record queries are valuable; aliases cannot discard them when moving navigation. |
| Read | Direct URL checks scope and object visibility independently of menu presence | Explain access denial and give allowed destination/My Access; do not return empty data that looks like absence. |
| Write/run | Per-action server authorization; UI hides or disables unavailable operations with a short reason and request-owner path | Framework/read-only users should not need users/groups admin dependencies merely to read an assessment. |
| Review | Scope and reviewer authority, explicit target/version/rationale and persisted decision | Human review status cannot rewrite deterministic evaluation outcome. |
| Authorize/publish/dispatch | Distinct authority/confirmation/receipt for each act | Package ready, RMF handoff, grant issued, queued communication, draft approved and actual external delivery are separate. |
| History/archive | Historical read survives navigation consolidation; edits/archive/delete show exact affected objects and impact | Existing destructive actions remain specific, not hidden bulk toggles. |

Illustrative future locations are `System → Controls → Implementation → selected control`, `System → Authorization → Assessments → selected assessment`, and `System → Authorization → Packages → named version`. They express UI location, **not approved new public API/router paths**. Current routes stay canonical addresses during an IA-only transition. A later approved routing contract may add `/systems/:systemId/...` and cycle context, with a complete mapping; this document does not authorize it.

Route continuity rules:

1. Keep every explicit existing route reachable even if absent from primary navigation.
2. Preserve route/query/hash and record selection; link legacy aliases to the same underlying record rather than silently show a broader list.
3. If a deep-linked record has an approved unique system association, reflect it in the context selector. With zero/multiple associations, show Unlinked/Multiple systems, not a guessed selection.
4. Legacy `/visual`, `/report`, `/export`, `/convert` aliases must disclose the supported destination/action. Preserve their addresses, but do not promise operations the current code never performed.
5. `/tasks` continues to mean aggregated Work Queue; `/modules/tasks` continues to mean shared task CRUD. Other module direct aliases preserve their module key and `?record` context.
6. Public `/questionnaires/response/:shareToken` remains a separate assignment/share-token flow; trust-center public manifest/grant endpoints retain their backend access model.
7. Unmounted `DashboardPage`/old parity pages and `/vanta-clone*` are not operational workspaces. Keep prototype/archive discovery under developer/reference tools rather than adding them to daily navigation.
8. Never redirect a denied mutation into a similar writable route, drop selected record scope, or convert an authorization status during URL migration.

## Every current feature group: destination and preservation

Capability legend: **E** existing persisted operation; **V** existing read projection/composition; **D** needs domain/API/persistence contract; **L** limited/placeholder/dry-run capability that must be labeled truthfully. E/V/L describe the current implementation, not a promise that every proposed layout is already built.

| Existing feature group | Proposed ownership / discovery | Preserve / boundary |
| --- | --- | --- |
| `home` | My Work landing and Systems Overview | `/`; current role-filtered stage/metrics **V**. Replace heuristic health with labeled counts/coverage, not pretend scores. |
| `dashboard` | Developer/reference archive; usable metrics may inform portfolio Overview | Unmounted component, not new canonical dashboard **L**. |
| `core` | Entry/auth/account; Controls Baseline and catalogue detail | `/login`, initialization/recovery/SSO callbacks, `/workspace/me`, `/frameworks*`; create/import/requirements **E**. |
| `libraries` | Controls → Library/advanced reference | `/libraries*`, loaded/stored/mapping aliases; linked threat/matrix assets **V**. |
| `assessments` | Authorization → Assessments/Packages; Controls/Evidence contextual tests; Remediation plans | Risk/compliance assessment IDs, plan/budget, flash/kanban, imported assessment package marker **E/V**. |
| `risk` | Risk & POA&M → Risks/Findings/Action views/Advanced | `/risk-scenarios`, `/risk-actions`, `/threat-models`; CRUD risks **E**, aggregated tracker/threat portfolio **V**. |
| `advanced-risk` | Risk & POA&M → Advanced analysis | EBIOS studies/workshop status **E**; quant fixed scenarios/multiplier “simulation” **L**; conversion navigation-only **L**. |
| `grc` | Controls → Library/Mappings; Risk → Findings; Authorization → Assessments/Packages; admin content/AI | Preserve `/framework-library*`, `/findings`, `/gap-assessments*`, `/report-bundles*`, scrutiny/admin. Distinguish GRC gap vs core manual assessment data. |
| `assurance` | Evidence → Explorer/Tracker; Authorization → Packages/Reviews; Monitoring → Workflows/Agent runs | Preserve all job/import/package/review/run deep links and explanation/artifact context **E/V**. Ordinary writeback review/export is draft-only **L**. |
| `evidence` | Evidence library/runs; Monitoring health; authorized Sources context | `/evidence-management`, `/evidence/jobs`, `/evidence/sources`; source/collection **E**, non-AWS form incomplete **L**. |
| `conmon` | Monitoring → Runs/obligations; authorized profile configuration | `/conmon/executions`, `/conmon/profiles`; queue-run **E**, current schedule/profile sophistication limited **L**. |
| `fedramp` | Authorization → Provider/trust publication, maintenance and communication history | `/trust-center`, `/fedramp/provider`; record/generate/publish/grant **E**, delivery status must remain separate from queued/confirmed record. |
| `chat` | Contextual Help/Explain; Workspace tools → Workspace AI | `/chat`, `/scoring-assistant`; scoped aggregate-context guidance **E/L**, no full-history model conversation guarantee. |
| `ai` | Contextual Draft/Suggest/Map/Explain; Authorization Exports; admin settings | RegML profiles/narratives/recommendations/response/evidence mapping/export routes; explicit draft/apply review, model availability and native-export limits. |
| `builders` | Workspace tools → Templates and contextual Edit template | Form/rules/report/dashboard/export/questionnaire/wayfinder routes/queries **E**; native rendering/delivery/chart interactions have limits **L**. |
| `iam` | Administration → People/Access/Scope; account My Access | User/group/role/folder routes **E**; do not relabel IAM folder as system or business unit permissions as authorization. |
| `setup` | Administration → Workspace/Security/Classification/Content/Connections | Preserve all setup/SSO/MFA aliases **E** config; actual enforcement/credential validation is capability-specific **L**. |
| `imports` | Evidence → Intake or relevant contextual import; admin Data | `/imports`, tracker/Observable/template imports separate by content; show actual accepted format/validation/output. |
| `integrations` | Monitoring → Connections; admin Connections and data | `/integrations`, automation aliases **E** metadata; generic Test/Sync **L** dry-run, not live collection proof. |
| `modules` | Owned local tabs listed below; Workspace tools → All records for advanced operators | `/modules*` + all direct module aliases **E** shared records; templates/dedicated/subfeature entries link their real owner. |
| `ops` | My Work/Systems/Monitoring/Authorization projections; utility tools/admin | Program/search/analytics/calendar/workbench/RMF/workflow/utilities/subsystems/app-management and aliases. Most **V**; leases/handoff/pins/business units **E** limited semantics. |
| `parity` | Route resolver/reference tools | Preserve stable aliases and authorized fallback; no daily “parity” product area. Unmounted old pages **L**. |
| `portal` | External assignment portal; internal Authorization → Requests/Assignments | `/portal`, assignment/auditee/my-assignment aliases **E**; assignment scope rather than full workspace. |
| `privacy` | Systems → Privacy context; specialist cross-system Workspace tools | Processing/rights/breach routes **E**; full dedicated workflow not a single “privacy score.” |
| `resilience` | Systems → Resilience/BIA context; specialist Workspace tools | BIA/detail/action/report/visual aliases **E/V**; current aliases reuse detail, not native visual/report editors. |
| `reports` | Authorization → Outputs; Systems portfolio Overview → Reports action; Templates tool | `/reports`, `/reports/dora-roi`, report builder; DORA specialist includes actual input validation/export. |
| `tprm` | Systems → Dependencies/Vendors; portfolio specialist Workspace tools | Entities/solutions/contracts/detail routes **E**; preserve contracts/source mapping; title alone cannot assign a vendor to system. |
| `vanta` | Design references/prototype archive | `/vanta-clone*`; static visual/local state **L**. Never used as evidence of real Regovise automation. |

Shared module local ownership:

| Module keys | Primary area / tab |
| --- | --- |
| `assets`, `components`, `interconnections`, `supply-chain` | Systems → Assets/Dependencies. |
| `programs`, `projects`, `capabilities` | Systems → Program context / Workspace tools at portfolio level. |
| `security-controls`, `requirements`, `policies`, `security-plans` | Controls → Implementation/Baseline/Policies; plan also contextual Authorization package source. |
| `evidence-locker`, `data-calls`, `requests` | Evidence → Library/Requests. |
| `risks`, `issues`, `exceptions`, `threats`, `causal-analysis`, `case-management` | Risk & POA&M → respective local workspaces/Advanced analysis. |
| `changes`, `incidents` | Risk & POA&M → Changes/Incidents; Monitoring links affected source records. |
| `tasks` | My Work; shared CRUD retains `/modules/tasks`, while dedicated `/tasks` stays aggregate. |
| Dedicated directory entries `catalogues`, `assessment-plans`, `questionnaires`, `security-profiles`, `threat-models` | Controls library/profile/baseline; Authorization plan/assessment; Evidence requests/questionnaires; Risk advanced views. |

## One hundred priority interactions and state/readback contract

The following are a proposed UX acceptance inventory. **E/V/L** identifies reusable current operations/projections/limitations; **D** marks added contract behavior. No row silently claims a missing feature exists. For every mutation the final view must read the saved server result, identify the affected source/version and explain the next action. Draft/local state cannot appear as Saved. Filter/search/list projections remain distinct from writes.

| # | Interaction | Destination / result | State, error, empty or unsupported behavior | Basis |
| --- | --- | --- | --- | --- |
| 1 | Open workspace/session | My Work or assigned system landing | Skeleton → authorized data; session error offers sign-in; no empty-all-green fallback | E/V |
| 2 | First workspace initialization | Admin entry → real tenant/admin receipt | Existing initialized/disabled mode, secret error; no normal user bootstrap button | E |
| 3 | Password/email-code/SSO sign-in | Preserved allowed next route | Disabled methods/expires/resend/SSO role mismatch; no credential detail in logs | E |
| 4 | Select portfolio/system | Clear context header and correct scoped data | Loading clears previous scope; no permission means denied, unknown means unlinked | D |
| 5 | Select live versus named cycle | Live context or frozen named snapshot | No cycle/archived/locked/excluded scope states; no guessed cycle IDs | D |
| 6 | Open deep-linked record | Record selected, area and context reflected | Missing/archived/denied/multiple-associations distinguishable | E + D scope |
| 7 | Search scoped records/tools | Authorized results with source/type/scope | No results differs from unavailable index; real keyboard shortcut and mobile button | V |
| 8 | Open actual notification/job center | Event/status with source, time and action | Empty inbox/no API status; no hardcoded dot | D |
| 9 | Inspect My Access | Role sources/domain permissions | Explanation and owner/contact for unavailable action; no self-grant | E |
| 10 | Change context with unsaved draft | Save/discard/stay choice | Failed save keeps original draft/scope; never cross-write to new system | D |
| 11 | See assigned tasks across systems | My Work grouped by actionable source | Count coverage/unknown source errors; partial load shows omission banner | V + D associations |
| 12 | Filter my/team/due/blocked work | Stable saved view and clear chips | Zero matching rows preserves filters; reset, permissions and due timezone explicit | V/D saved views |
| 13 | Open task and source | Drawer with source-record link/return | Task projection is not a duplicate source record | E/V |
| 14 | Assign/reassign work | Authorized owner change and receipt | Missing owner/role/permission shown; reassignment is not role grant | E + D aggregate |
| 15 | Complete task | Source result + related open obligations | Cannot mark evidence collection complete from queue receipt | E/D consistency |
| 16 | Comment/request clarification | Source record event with author/time | Blank input/error retry; preserved unsent comment | E |
| 17 | Set due/review/expiry dates | Save source dates and next occurrence | Invalid order/timezone/history scope and unknown policy prompt | E/D recurrence |
| 18 | Review recent completed actions | Timeline links exact changed source | Locally clicked acknowledgement is not server completion | V |
| 19 | Open calendar of obligations | Source-backed due items | No obligation source -> empty guidance, no synthetic events | V/D obligations |
| 20 | Export/share a work view | Actual permitted artifact or link | If backend only returns metadata, label link/preview; no false download | L/D |
| 21 | Open system directory | Accountable system rows and scope counts | No systems: authorized onboarding; denied: request access; unlinked assets separate | D |
| 22 | Create/register system | Review identity/boundary/owner summary | Requires approved C1; until then actual perimeter/plan record remains labeled | D |
| 23 | Inspect system boundary | Boundary narrative and inventory/dependency references | Missing boundary/unknown owner flags, not compliant defaults | E records + D anchor |
| 24 | Add/update asset | Scoped record with owner/category/context | Domain required, validation and save readback; real IDs preserved | E + D association |
| 25 | Link component/interconnection | Direction/responsibility/scope with source link | Ambiguous relation shows proposed/unverified, not inherited truth | E/D semantics |
| 26 | Change inventory scope | Impact preview lists affected controls/tests | Cannot silently detach cycle snapshot or previous evidence | D |
| 27 | Add vendor/contract dependency | Linked entity/solution/contract, due/risk context | Known vendor ≠ shared-control provider; unsupported links shown | E + D association |
| 28 | Open people/responsibilities | Scoped accountable role/assignment list | Role display not authority; admin grant separate route/action | E + D system view |
| 29 | Open privacy processing/right/breach | Specialist scoped workspace with source IDs | Unsupported nested editor described; no privacy checkbox score | E/V |
| 30 | Open resilience/BIA | Existing BIA detail with actual actions | Report/visual alias landing disclosed; missing native output not promised | E/L |
| 31 | Choose/import baseline catalogue | Controls Baseline version/source | Packaged reference-only vs imported control count explicit | E + D cycle |
| 32 | Inspect requirement/control hierarchy | Assessable count/tree and flat table | No tree/source failure separate; no implicit editing permission | V |
| 33 | Add tenant requirement | Saved reference/title/description | Duplicate/invalid/no permission field error; load saved created item | E |
| 34 | Scope controls to assessment | Explicit selected IDs/template context | Empty selection semantics clear; baseline version included | E/D version |
| 35 | Determine applicability | Supported decision/rationale/reference | Proposed not-applicable requires reviewer contract; no automatic exclusion by AI | E/D |
| 36 | Assign control owner | Owner ID/responsibility readback | Unassigned/multiple responsibilities and delegation visible | E/D |
| 37 | Edit implementation statement | Draft/editor with section completeness | Unsaved/validation/conflict/save failure separate; version/source preserved | E + D structured model |
| 38 | Link evidence/test to control | Relationship plus sufficiency/coverage status | Link presence ≠ sufficient evidence; missing scope fails clearly | E/D association |
| 39 | Compare control revisions | Diff with changed source and consumers | No supported version history -> explicit unavailable comparison | D |
| 40 | Open test/assessment from control | Correct assessment requirement context | Pending/not-assessed/failed/accepted distinct; retain return/filter | E/V |
| 41 | View narrative sections | Coverage checklist and source citations | Generated text shown Draft; not verified by fluent prose | E/D canonical sections |
| 42 | Draft narrative with AI | Preview/ref/provenance, editable diff | AI unavailable/fallback/invalid output/read permission; preserve manual draft | E/L |
| 43 | Apply AI draft | Confirm exact target/fields and saved version | New draft does not auto-review/authorize; conflict/denial keep preview | E/D version |
| 44 | View inherited controls | Provider/responsibility/version/evidence/change date | Requires C3; old inheritance fields alone not verified compliance | D |
| 45 | Request/accept inheritance | Target control/provider and human justification | Proposal/accepted/challenged/expired; no silent inheritance override | D |
| 46 | Provider control changes | List affected consumers/current snapshots | Alert is distinct from consumer re-approval; historical frozen records unchanged | D |
| 47 | Manage policy review | Policy draft/owner/version/review/acknowledgement | Current shared metadata not certified signature workflow | E/L |
| 48 | Resolve SCF crosswalk mapping | Source and target obligations with provenance | No mapping/unsupported reference distinguish from pass | V |
| 49 | Open security profiles/template | Actual profile controls and review queue | Baseline template is not system implementation or accepted inheritance | E/L |
| 50 | Launch assessment from Controls | Authorization assessment plan preselected/context shown | Current source manual linking until contract; no silent new assessment | E/D context |
| 51 | Browse evidence library | Source/time/scope/type/control/review/status filters | No evidence shows intake options; permission failure does not appear empty | E/V |
| 52 | Inspect evidence/proof lineage | Artifact preview/object metadata/raw ref | Missing R2 object/invalid family/provenance rejected distinguish | E |
| 53 | Add/manual evidence response | Exact accepted format/reference/upload semantics | Text reference not mislabeled file upload; preserve failed draft | E/L |
| 54 | Map evidence to control | Saved relationship and recommendation review | Suggested mappings need human apply; ambiguous/missing target fails | E |
| 55 | Mark/review sufficiency | Accepted/challenged/needs-more state with rationale | Collector pass is distinct from assessor sufficiency | E + D scope |
| 56 | Configure source | Saved provider scope/credentials readiness only for authorized user | Non-AWS unsupported config explicit; keys masked/redacted; no secrets in table | E/L |
| 57 | Queue collection | Job ID/queued status and inspect link | Receipt never says collected; unavailable connector tells needed setup | E |
| 58 | Inspect/run failure/retry | Attempts, classified error, partial coverage, last success | Failed current run doesn't erase valid historic evidence; rerun requires authority | E/D retry UI |
| 59 | Import tracker/Observable data | Validate actual JSON format, diagnostics, source confidence | Bad JSON/nonempty array/version mismatch; demo example never masquerades live | E |
| 60 | Convert tracker to package | Created job/package IDs with reconciliation | Actual saved outputs then inspect; no conversion-complete equals authorization | E |
| 61 | Open finding/vulnerability | Evidence, affected resource/control and source event | Unknown severity/scope/missing feed explicit; source records not duplicate | E/V |
| 62 | Create/update POA&M treatment | Owner/action/due/cost/status/control/evidence context | Current derived plan versus writable issue/task separated; requires C6 for unified edit | E/D |
| 63 | Prioritize treatment | Risk/severity/age/impact view and rationale | Sorting doesn't mutate risk score; default thresholds labeled | V |
| 64 | Apply retest/closure evidence | Link new result and review source closure | Failed retest/open obligations block misleading completed badge | E/D closure contract |
| 65 | Request risk acceptance | Reviewer/decision/rationale/expiry evidence | Needs approved acceptance authority; no generic status choice as final acceptance | D |
| 66 | Create/review exception | Scope/owner/mitigation/expiry/conditions | Expired exception reopens attention; metadata versus authorization separate | E/D |
| 67 | Log incident/change | Affected system/records, timeline and response | Queue notification record ≠ sent; sensitive detail scoped | E/D linkage |
| 68 | Investigate case/causal analysis | Shared source records/relations/action trail | Missing specialized logic labeled, not fake forensic tooling | E/L |
| 69 | Qualitative risk scenario/edit | Likelihood/impact/status and source register | Missing values unknown; scope/cascade delete preview | E |
| 70 | Advanced EBIOS/quant analysis | Study/status/method and clear limitations | Workshop step ≠ substantive analysis; quant multiplier ≠ Monte Carlo | E/L |
| 71 | Create assessment plan/instance | Scope/template/baseline/assessor/owner/dates | Manual/GRC gap model distinction; required permission/reference failures | E |
| 72 | Select assessment subset/recurrence | Explicit control IDs/plan questions and saved recurrence | Policy schedules configurable; unsupported recurrence behavior disclosed | E/L |
| 73 | Execute selected test/item | Requirement/question, evidence and editable observations | Not assessed/pass/partial/fail/NA and score meaning; no silent auto-pass | E |
| 74 | Save item/progress | Persisted item/version and updated actual progress | Unsaved selection guard; error preserves draft; concurrent edit conflicts | E/D concurrency |
| 75 | Generate scrutiny questions | Draft questions with references and completeness | Feature disabled/no source readiness/fallback pattern explicitly shown | E |
| 76 | Materialize evidence requests | Created data-call/locker IDs and owner/context | Idempotency/exact affected count visible; draft question not sent request | E/D delivery |
| 77 | Receive request response | Actual response/source artifact and event | Pending/returned/submitted and missing upload format explicit | E |
| 78 | Challenge/accept sufficiency | Named item/reviewer/rationale/evidence in comment trail | Decision separate from immutable collected evidence/eval truth | E |
| 79 | Run normalized gap assessment | Findings filters/sources/baseline and resulting gap IDs | Partial/missing sources included; not same as full manual assessment completion | E/V |
| 80 | Finalize assessment output | Reviewed items/findings/remaining blockers/report version | Needs finalization contract beyond existing progress counts | D |
| 81 | Build working package | Real package/artifact IDs with generation status | Validation/reconciliation/pending reviews shown, no automatic ready claim | E |
| 82 | Inspect package validation | Failures/coverage/reconciliation/source confidence | Unknown/no object/not evaluated distinct from valid | E |
| 83 | Review recommendation | Accept/reject, rationale and refresh package receipt | Human decision does not overwrite eval truth; deferred refresh error visible | E |
| 84 | Freeze named review package | Immutable target/version/hash and source cutoff | Requires C8; working outputs cannot be called frozen decision snapshot | D |
| 85 | Request package changes | Named source/version/owner/work item with return path | Future rebuild linked version; reviewer cannot edit owner evidence | E/D |
| 86 | Generate actual reports/exports | Supported format/download/version and diagnostics | Semantic preview/JSON in lieu of Word labeled correctly; unavailable renderer explicit | E/L |
| 87 | Record authorized decision | Authority, system/cycle/package/conditions/dates | Requires C8 and authorized role; RMF stage advance cannot replace it | D |
| 88 | Activate maintenance obligations | Named owner/cadence/change-trigger/evidence next due | Requires C7; current profile queue alone not scheduler | E/D |
| 89 | Publish trust/provider artifact | Audience/publication/grant details and receipt | Working/reviewed/published/agency access distinct; revoke/unsupported action explicit | E/L |
| 90 | Compare prior package/cycle | Actual differences plus carryover references | Requires C2/C8; unavailable historical content explicit | D |
| 91 | Open Monitoring Attention | Affected scope/priority/last event/required action | No feeds ≠ healthy; partial coverage count/last checked visible | V/D |
| 92 | Review stale evidence | Freshness basis/expiry/affected controls/next collection | Stale evidence remains inspectable; policy threshold not hardcoded success | E/D policy |
| 93 | Inspect ConMon execution | Job attempts/result/object references/timing | Queued/running/failed/completed separate; refresh/poll cancellation correct | E/V |
| 94 | Configure monitoring profile | Actual supported name/type/rules/schedule capability | Current name/type only; missing schedule editor never implied | E/L |
| 95 | Review change impact | Asset/boundary/control/evidence/package consequences | Requires association contract; speculative impacts labeled Suggested | D |
| 96 | Inspect agent run/proof | Task trace/policy/coverage/rejected rows/artifacts | Imported provenance distinct from signed verification; known missing data shown | E |
| 97 | Review writeback draft | Payload/target/evidence/reviewer note and saved decision | Approved draft vs dispatched; current UI approval explicitly no delivery | E/L |
| 98 | Dispatch permitted external action | Separate permission, target/payload review and actual receipt | Failed/retry/duplicate idempotency and no-connector states; dedicated dispatch only | E backend + D UI |
| 99 | Use specialist/admin tools | Searchable launcher with scope preserved or explicit switch | Missing access gives explanation; unsupported product screen not mock success | E/V |
| 100 | Read every saved/job/review outcome | Saved server object/status/time/version and next action | Partial failure/deferred artifact refresh/dispatch pending preserved; local notice not proof | E/D uniform contract |

## Cross-screen state vocabulary and empty/error treatment

Never force distinct backend enums into one universal status. A display label can be humanized while raw status/source remains inspectable. Separate **implementation**, **test outcome**, **evidence freshness**, **sufficiency review**, **task workflow**, **package validation**, **authorization decision**, **publication**, and **external delivery**.

| Situation | Required presentation / recovery |
| --- | --- |
| Loading initial data | Skeleton of the destination layout with context retained; no stale content from prior scope. |
| Partial source failure | Available data plus concise missing-source/coverage message and retry; counts identify limited denominator. |
| Empty valid scope | Explain the first meaningful action permitted by role; external contributor sees their assignment guidance. |
| No search/filter match | Preserve filters and show Clear filters; do not invite duplicate object creation. |
| Permission denied | Object/area unavailable and allowable next step/My Access/contact owner; no data existence leak beyond authorized policy. |
| Not found/deleted/archived | Specific state when permitted to know; archived historical read/restore affordance only when supported. |
| Unsupported/unconfigured | State exact missing capability/setup and genuine fallback; no enabled button that only posts a success notice. |
| Dirty draft | Visible Unsaved changes, Save/Cancel, context/leave guard; manual edits remain after API failure. |
| Server validation | Errors by field with focus/summary; preserve valid inputs; non-field API error plus retry/reference. |
| Save succeeds | Saved object/version/time/owner readback; update list/detail from saved result; optional undo only when server semantics support it. |
| Version/conflict | Describe stale base, show compare/reload/merge draft; never silently replace another reviewer/owner change. |
| Job queued/running | Job ID/status/attempts/started/last checked and inspect link; no “complete” merely from submission. |
| Job failed/partial | Actual result/error/coverage; retry targets saved configuration; previously successful evidence retained. |
| AI unavailable/invalid/fallback | Provider/readiness/fallback label and manual path; no synthetic generated success. |
| Review/apply | Explicit target/version/change diff/rationale; saved event and downstream refresh outcome. |
| Frozen/history | Read-only scope label, version/hash/date, permitted copy-to-new action; no editable-looking current-cycle form. |
| External action | Draft → reviewed → dispatched → delivered/failed read separately with receipt; no queued-email claim as sent. |
| Destructive action | Exact record/scope/dependencies/cascade disclosure and confirmation; reject stale/unscoped bulk actions. |

## Reviewable rollout boundaries

1. **IA-only proposal/mock:** seven daily destinations, local-tab placements, role landing layouts, accurate capability labels and route preservation. No system/cycle fabricated persistence.
2. **Approved navigation slice:** source-backed route composition, genuine search/notification affordances, mobile navigation and parameter fixes, with existing permissions and records unchanged. This requires a separate implementation request and relevant checks.
3. **Approved domain-contract slice:** resolve C1/C2/C3/C8 before universal system/cycle/inheritance/authorization controls become operational. Then one bounded vertical journey with explicit acceptance tests.
4. **Automation slice:** live connector readiness, freshness/obligations, source-result readback and independently gated writeback dispatch. Do not broaden to every provider before the first full journey works.

Success measures for usability study: an analyst finds and acts on assigned failed test without understanding legacy modules; an ISSO identifies the selected system/cycle and its next blocker; a control owner responds with preserved draft/error handling; an assessor records a traceable sufficiency decision; an AO reviews one unambiguous package version; an external contributor submits and gets a real receipt. Cross-role authorized deep links and prior-cycle records continue to resolve. Source-backed readiness and human authority remain distinct at every step.

## Complete existing navigation and route preservation appendices

The appendices map current navigation destinations and current explicit routes to the proposed daily areas/utilities. They are coverage indexes, not implemented redirects, new route approvals or claims of feature parity. Canonical current routes remain in place. Dynamic module routes resolve their module key using the ownership table above; legacy model wildcards preserve the existing resolver until reviewed individually.


### Existing navigation: all current entries preserved

| Current navigation destination | Proposed discovery / ownership | Existing route source |
| --- | --- | --- |
| `/` | My Work → Role landing / Systems Overview | [AppLayout:496](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:496) |
| `/search` | Global search → Scoped records / Tools | [AppLayout:818](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:818) |
| `/analytics` | Systems → Portfolio analytics (contextual reports) | [AppLayout:817](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:817) |
| `/program/setup` | Administration → Getting started | [AppLayout:498](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:498) |
| `/workspace/me` | Account → My Access | [AppLayout:501](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:501) |
| `/tasks` | My Work → Aggregated queue | [AppLayout:851](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:851) |
| `/findings` | Risk & POA&M → Findings | [AppLayout:540](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:540) |
| `/assurance/reviews` | Authorization → Reviews (My Work projection) | [AppLayout:953](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:953) |
| `/program` | Systems → Portfolio / Program overview | [AppLayout:497](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:497) |
| `/frameworks` | Controls → Baseline / Catalogues | [AppLayout:536](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:536) |
| `/framework-library` | Controls → Library / Managed content | [AppLayout:538](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:538) |
| `/libraries` | Controls → Library / Reference packages | [AppLayout:534](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:534) |
| `/modules` | Workspace tools → All records | [AppLayout:499](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:499) |
| `/security-controls` | Controls → Implementation | [Module aliases](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) |
| `/assessments` | Authorization → Assessments / Workbench | [AppLayout:545](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:545) |
| `/gap-assessments` | Authorization → Assessments / Gap runs | [AppLayout:541](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:541) |
| `/policies` | Controls → Policies | [Module aliases](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) |
| `/evidence-locker` | Evidence → Library / Documents | [Module aliases](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) |
| `/assessment-evidence-packages` | Authorization → Packages / Imported assessment package | [AppLayout:945](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:945) |
| `/risk-scenarios` | Risk & POA&M → Risk library / Registers | [AppLayout:940](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:940) |
| `/risks` | Risk & POA&M → Risks | [Module aliases](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) |
| `/risk-actions` | Risk & POA&M → Action tracker (My Work projection) | [AppLayout:939](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:939) |
| `/threat-models` | Risk & POA&M → Advanced / Threat portfolio | [AppLayout:635](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:635) |
| `/advanced-risk/ebios` | Risk & POA&M → Advanced / EBIOS | [AppLayout:725](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:725) |
| `/advanced-risk/quantitative` | Risk & POA&M → Advanced / Quantitative | [AppLayout:727](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:727) |
| `/incidents` | Risk & POA&M → Incidents | [Module aliases](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) |
| `/security-exceptions` | Risk & POA&M → Exceptions | [Module aliases](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) |
| `/evidence-management` | Evidence → Sources / Jobs / Artifacts | [AppLayout:943](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:943) |
| `/evidence/jobs` | Evidence → Collection runs (Monitoring context) | [AppLayout:948](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:948) |
| `/conmon/executions` | Monitoring → Run history | [AppLayout:942](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:942) |
| `/assurance` | Monitoring → Assurance attention / Authorization readiness | [AppLayout:949](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:949) |
| `/assurance/evidence` | Evidence → Explorer / Evaluations | [AppLayout:950](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:950) |
| `/assurance/tracker` | Evidence → Intake / Tracker diagnostics | [AppLayout:951](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:951) |
| `/assurance/packages` | Authorization → Packages / 20x explorer | [AppLayout:952](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:952) |
| `/assurance/agent-runs` | Monitoring → Agent traces / Writeback draft reviews | [AppLayout:954](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:954) |
| `/third-party` | Systems → Dependencies / Vendors (portfolio tool available) | [AppLayout:573](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:573) |
| `/portal` | External portal → Assignments (internal Authorization link) | [AppLayout:723](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:723) |
| `/questionnaires` | Evidence → Requests / Questionnaires | [AppLayout:716](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:716) |
| `/trust-center` | Authorization → Provider / Maintenance and trust publication | [AppLayout:692](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:692) |
| `/assets` | Systems → Assets | [Module aliases](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) |
| `/components` | Systems → Assets / Components | [Module aliases](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) |
| `/interconnections` | Systems → Dependencies / Interconnections | [Module aliases](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) |
| `/supply-chain` | Systems → Dependencies / Supply chain | [Module aliases](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) |
| `/integrations` | Administration → Connections (contextual Monitoring) | [AppLayout:683](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:683) |
| `/workspace/team` | Administration → People and groups | [AppLayout:503](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:503) |
| `/workspace/access` | Administration → Roles and access | [AppLayout:504](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:504) |
| `/setup/sso` | Administration → S S O | [AppLayout:516](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:516) |
| `/setup/mfa` | Administration → M F A | [AppLayout:517](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:517) |
| `/setup/service-accounts` | Administration → Service Accounts | [AppLayout:508](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:508) |
| `/privacy` | Systems → Privacy (specialist portfolio tool available) | [AppLayout:576](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:576) |
| `/resilience` | Systems → Resilience / BIA (portfolio tool available) | [AppLayout:579](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:579) |
| `/reports` | Authorization → Outputs / Report catalog | [AppLayout:600](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:600) |
| `/reports/dora-roi` | Workspace tools → Specialist reports / DORA | [AppLayout:601](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:601) |
| `/report-bundles` | Authorization → Outputs / Report bundles | [AppLayout:543](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:543) |
| `/builders/report-builder` | Workspace tools → Templates / Reports (contextual Outputs) | [AppLayout:609](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:609) |
| `/compliance-exports` | Authorization → Outputs / Compliance exports | [AppLayout:649](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:649) |
| `/chat` | Workspace tools → Workspace AI / Contextual guidance | [AppLayout:681](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:681) |
| `/workbench` | My Work → All permitted work | [AppLayout:703](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:703) |
| `/workflow` | Workspace tools → Coordination / Leases | [AppLayout:693](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:693) |
| `/utilities` | Workspace tools → Utilities | [AppLayout:695](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:695) |
| `/subsystems` | Workspace tools → Record view presets | [AppLayout:697](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:697) |
| `/news-feed` | Monitoring → Changes / Activity | [AppLayout:705](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:705) |
| `/builders` | Administration / Workspace tools → Category launcher | [AppLayout:602](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:602) |
| `/response-automation` | Monitoring → Reviewable automation (advanced tool) | [AppLayout:645](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:645) |
| `/evidence-mapping` | Evidence → Control mappings / Suggestions | [AppLayout:647](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:647) |
| `/features/regml` | Workspace tools → AI / Settings and modes | [AppLayout:621](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:621) |
| `/builders/form-builder` | Workspace tools → Templates / Forms | [AppLayout:606](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:606) |
| `/builders/rules-builder` | Workspace tools → Templates / Form rules | [AppLayout:611](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:611) |
| `/builders/export-builder` | Workspace tools → Templates / Export templates | [AppLayout:603](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:603) |
| `/builders/dashboard-builder` | Workspace tools → Templates / Dashboards | [AppLayout:610](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:610) |
| `/builders/questionnaire-builder` | Workspace tools → Templates / Questionnaire designer | [AppLayout:614](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:614) |
| `/builders/wayfinder-builder` | Workspace tools → Templates / Journey templates | [AppLayout:612](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:612) |
| `/imports` | Workspace tools → Data import (contextual intake) | [AppLayout:682](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:682) |
| `/setup/general` | Administration → General | [AppLayout:506](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:506) |
| `/setup/security` | Administration → Security Posture | [AppLayout:513](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:513) |
| `/workspace/domains` | Administration → Domain scope | [AppLayout:502](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:502) |
| `/setup/tags` | Administration → Tags | [AppLayout:505](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:505) |
| `/setup/classification` | Administration → Classification | [AppLayout:507](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:507) |
| `/setup/modules-features` | Administration → Modules Features | [AppLayout:514](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:514) |
| `/setup/risk-model` | Administration → Risk Model | [AppLayout:515](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:515) |
| `/evidence/sources` | Administration → Evidence sources (contextual Evidence) | [AppLayout:947](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:947) |
| `/conmon/profiles` | Administration → Monitoring profiles (contextual Monitoring) | [AppLayout:941](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:941) |
| `/grc-admin` | Administration → Catalogue content / AI providers | [AppLayout:689](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:689) |
| `/grc-admin/scrutiny-engine` | Authorization → Assessments / Scrutiny (current admin permission retained) | [AppLayout:691](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:691) |
| `/settings` | Administration → Platform settings | [AppLayout:831](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:831) |

Coverage: 85 current navigation entries; 85 unique destinations. Duplicated source-menu entries are retained in this index, but the proposed IA gives each object one owner.

### All explicit route definitions and aliases

| Current address / pattern | Proposed location | Current component | Existing guard, preserved until approved | Route source |
| --- | --- | --- | --- | --- |
| `/login` | Entry → Sign-in / Initialize / Recovery | `BootstrapAccessPanel` | Existing direct/session/bridge behavior | [line 333](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:333) |
| `/auth/callback` | Entry → SSO callback | `SsoCallbackPage` | Existing direct/session/bridge behavior | [line 334](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:334) |
| `/setup/initialize` | Entry → Sign-in / Initialize / Recovery | `BootstrapAccessPanel` | Existing direct/session/bridge behavior | [line 335](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:335) |
| `/admin/recover` | Entry → Sign-in / Initialize / Recovery | `BootstrapAccessPanel` | Existing direct/session/bridge behavior | [line 336](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:336) |
| `*` | Unknown route → Useful authorized next step | `div` | Existing direct/session/bridge behavior | [line 962](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:962) |
| `/` | My Work → Role landing / Systems Overview | `HomePage` | Existing direct/session/bridge behavior | [line 496](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:496) |
| `/program` | Systems → Portfolio / Program overview | `ProgramControlPage` | canUseProgramWorkspace | [line 497](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:497) |
| `/program/setup` | Administration → Getting started | `QuickStartControlPage` | Admin | [line 498](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:498) |
| `/modules` | Workspace tools → All records | `ModuleDirectoryPage` | canUseModules | [line 499](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:499) |
| `/modules/:moduleKey` | Module-key ownership table (preserve record query) | `SharedModuleWorkspacePage` | canUseModules | [line 500](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:500) |
| `/workspace/me` | Account → My Access | `MePage` | Existing direct/session/bridge behavior | [line 501](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:501) |
| `/workspace/domains` | Administration → Domain scope | `FoldersPage` | Admin | [line 502](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:502) |
| `/workspace/team` | Administration → People and groups | `TeamPage` | Admin | [line 503](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:503) |
| `/workspace/access` | Administration → Roles and access | `AccessPage` | Admin | [line 504](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:504) |
| `/setup/tags` | Administration → Tags | `TagsPage` | Admin | [line 505](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:505) |
| `/setup/general` | Administration → General | `GeneralPage` | Admin | [line 506](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:506) |
| `/setup/classification` | Administration → Classification | `ClassificationPage` | Admin | [line 507](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:507) |
| `/setup/service-accounts` | Administration → Service Accounts | `ServiceAccountsPage` | Admin | [line 508](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:508) |
| `/setup/branding` | Administration → Branding | `BrandingPage` | Admin | [line 509](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:509) |
| `/setup/email` | Administration → Email | `EmailPage` | Admin | [line 510](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:510) |
| `/setup/email-settings` | Administration → Email | `EmailPage` | Admin | [line 511](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:511) |
| `/setup/logs-utilization` | Administration → Logs Utilization | `LogsUtilizationPage` | Admin | [line 512](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:512) |
| `/setup/security` | Administration → Security Posture | `SecurityPosturePage` | Admin | [line 513](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:513) |
| `/setup/modules-features` | Administration → Modules Features | `ModulesFeaturesPage` | Admin | [line 514](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:514) |
| `/setup/risk-model` | Administration → Risk Model | `RiskModelPage` | Admin | [line 515](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:515) |
| `/setup/sso` | Administration → S S O | `SSOPage` | Admin | [line 516](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:516) |
| `/setup/mfa` | Administration → M F A | `MFAPage` | Admin | [line 517](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:517) |
| `/setup/theming-branding` | Administration → Branding | `BrandingPage` | Admin | [line 518](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:518) |
| `/setup` | Administration / Workspace tools → Category launcher | `SemanticLauncherPage` | Admin | [line 519](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:519) |
| `/setup/compliance-settings` | Controls → Baseline / Catalogues | `FrameworksPage` | Admin | [line 520](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:520) |
| `/setup/file-system` | Administration → Evidence sources (contextual Evidence) | `EvidenceSourcesPage` | Admin | [line 521](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:521) |
| `/setup/facilities` | Administration → Domain scope | `FoldersPage` | Admin | [line 522](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:522) |
| `/setup/cause-codes` | Administration → Risk Model | `RiskModelPage` | Admin | [line 523](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:523) |
| `/setup/security-policies` | Module-key ownership table (preserve record query) | `SharedModuleWorkspacePage` | Admin | [line 524](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:524) |
| `/setup/user-management-roles/roles` | Administration → Roles and access | `AccessPage` | Admin | [line 528](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:528) |
| `/setup/user-management-roles/mfa` | Administration → M F A | `MFAPage` | Admin | [line 529](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:529) |
| `/setup/user-management-roles` | Administration → People and groups | `TeamPage` | Admin | [line 530](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:530) |
| `/setup/functional-roles` | Administration → Roles and access | `AccessPage` | Admin | [line 531](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:531) |
| `/sso` | Administration → S S O | `SSOPage` | Admin | [line 532](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:532) |
| `/setup-mfa` | Administration → M F A | `MFAPage` | Admin | [line 533](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:533) |
| `/libraries` | Controls → Library / Reference packages | `LibrariesPage` | canUseLibraries | [line 534](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:534) |
| `/libraries/:libraryId` | Controls → Library / Reference package | `LibraryDetailPage` | canUseLibraries | [line 535](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:535) |
| `/frameworks` | Controls → Baseline / Catalogues | `FrameworksPage` | canUseFrameworks | [line 536](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:536) |
| `/frameworks/:frameworkId` | Controls → Baseline / Catalogue requirements | `FrameworkDetailPage` | canUseFrameworks | [line 537](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:537) |
| `/framework-library` | Controls → Library / Managed content | `FrameworkLibraryPage` | canUseFrameworks | [line 538](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:538) |
| `/framework-library/:frameworkId` | Controls → Library / Documents and crosswalks | `FrameworkKnowledgeDetailPage` | canUseFrameworks | [line 539](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:539) |
| `/findings` | Risk & POA&M → Findings | `FindingsExplorerPage` | canUseFrameworks | [line 540](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:540) |
| `/gap-assessments` | Authorization → Assessments / Gap runs | `GapAssessmentsPage` | canUseFrameworks | [line 541](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:541) |
| `/gap-assessments/:assessmentId` | Authorization → Assessments / Selected gap run | `GapAssessmentDetailPage` | canUseFrameworks | [line 542](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:542) |
| `/report-bundles` | Authorization → Outputs / Report bundles | `ReportBundlesPage` | canUseFrameworks | [line 543](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:543) |
| `/report-bundles/:bundleId` | Authorization → Outputs / Selected bundle | `ReportBundleDetailPage` | canUseFrameworks | [line 544](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:544) |
| `/assessments` | Authorization → Assessments / Workbench | `AssessmentsPage` | canUseAssessmentWorkspace | [line 545](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:545) |
| `/risk-assessments/:assessmentId` | Risk & POA&M → Risk analysis / Assessment | `RiskAssessmentDetailPage` | canUseRiskAssessments | [line 546](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:546) |
| `/risk-assessments/:assessmentId/action-plan` | Risk & POA&M → Treatment / Budget | `RiskAssessmentActionPlanPage` | canUseRiskAssessments | [line 547](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:547) |
| `/risk-assessments/:assessmentId/action-plan/budget-overview` | Risk & POA&M → Treatment / Budget | `RiskAssessmentActionPlanPage` | canUseRiskAssessments | [line 551](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:551) |
| `/compliance-assessments/:assessmentId` | Authorization → Assessments / Selected assessment | `ComplianceAssessmentDetailPage` | canUseComplianceAssessments | [line 555](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:555) |
| `/compliance-assessments/:assessmentId/action-plan` | Risk & POA&M → Control treatment / Budget | `ComplianceActionPlanPage` | canUseComplianceAssessments | [line 559](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:559) |
| `/compliance-assessments/:assessmentId/action-plan/budget-overview` | Risk & POA&M → Control treatment / Budget | `ComplianceActionPlanPage` | canUseComplianceAssessments | [line 563](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:563) |
| `/compliance-assessments/:assessmentId/flash-mode` | Risk & POA&M → Treatment / Flash review | `AppliedControlsFlashPage` | canUseComplianceAssessments | [line 567](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:567) |
| `/applied-controls/kanban-mode` | Risk & POA&M → Treatment / Board | `AppliedControlsKanbanPage` | canUseComplianceAssessments | [line 571](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:571) |
| `/applied-controls/flash-mode` | Risk & POA&M → Treatment / Flash review | `AppliedControlsFlashPage` | canUseComplianceAssessments | [line 572](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:572) |
| `/third-party` | Systems → Dependencies / Vendors (portfolio tool available) | `TprmWorkspacePage` | canUseThirdParty | [line 573](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:573) |
| `/third-party/entities/:entityId` | Systems → Dependencies / Vendor detail | `EntityDetailPage` | canUseThirdParty | [line 574](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:574) |
| `/entities/:entityId` | Systems → Dependencies / Vendor detail | `EntityDetailPage` | canUseThirdParty | [line 575](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:575) |
| `/privacy` | Systems → Privacy (specialist portfolio tool available) | `PrivacyWorkspacePage` | canUsePrivacy | [line 576](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:576) |
| `/privacy/processings/:processingId` | Systems → Privacy / Processing detail | `ProcessingDetailPage` | canUsePrivacy | [line 577](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:577) |
| `/processings/:processingId` | Systems → Privacy / Processing detail | `ProcessingDetailPage` | canUsePrivacy | [line 578](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:578) |
| `/resilience` | Systems → Resilience / BIA (portfolio tool available) | `ResiliencePage` | canUseResilience | [line 579](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:579) |
| `/resilience/business-impact-analyses/:analysisId` | Systems → Resilience / BIA detail | `BusinessImpactAnalysisDetailPage` | canUseResilience | [line 580](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:580) |
| `/business-impact-analysis/:analysisId` | Systems → Resilience / BIA detail | `BusinessImpactAnalysisDetailPage` | canUseResilience | [line 584](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:584) |
| `/business-impact-analysis/:analysisId/action-plan` | Systems → Resilience / BIA detail | `BusinessImpactAnalysisDetailPage` | canUseResilience | [line 588](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:588) |
| `/business-impact-analysis/:analysisId/report` | Systems → Resilience / BIA detail | `BusinessImpactAnalysisDetailPage` | canUseResilience | [line 592](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:592) |
| `/business-impact-analysis/:analysisId/visual` | Systems → Resilience / BIA detail | `BusinessImpactAnalysisDetailPage` | canUseResilience | [line 596](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:596) |
| `/reports` | Authorization → Outputs / Report catalog | `ReportsPage` | canUseReports | [line 600](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:600) |
| `/reports/dora-roi` | Workspace tools → Specialist reports / DORA | `DoraReportPage` | canUseReports | [line 601](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:601) |
| `/builders` | Administration / Workspace tools → Category launcher | `SemanticLauncherPage` | Admin | [line 602](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:602) |
| `/builders/export-builder` | Workspace tools → Templates / Export templates | `ExportBuilderPage` | Admin | [line 603](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:603) |
| `/builders/export-builder/docx-template` | Workspace tools → Templates / Export guide | `ExportBuilderDocxGuidePage` | Admin | [line 604](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:604) |
| `/builders/export-builder/docx-template-guide` | Workspace tools → Templates / Export guide | `ExportBuilderDocxGuidePage` | Admin | [line 605](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:605) |
| `/builders/form-builder` | Workspace tools → Templates / Forms | `FormBuilderPage` | Admin | [line 606](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:606) |
| `/builders/form-builder/user-guide` | Workspace tools → Templates / Forms | `FormBuilderPage` | Admin | [line 607](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:607) |
| `/builders/form-builder/rules-guide` | Workspace tools → Templates / Form rules | `RulesBuilderPage` | Admin | [line 608](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:608) |
| `/builders/report-builder` | Workspace tools → Templates / Reports (contextual Outputs) | `ReportBuilderPage` | canUseReports | [line 609](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:609) |
| `/builders/dashboard-builder` | Workspace tools → Templates / Dashboards | `DashboardBuilderPage` | Admin | [line 610](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:610) |
| `/builders/rules-builder` | Workspace tools → Templates / Form rules | `RulesBuilderPage` | Admin | [line 611](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:611) |
| `/builders/wayfinder-builder` | Workspace tools → Templates / Journey templates | `WayfinderBuilderPage` | Admin | [line 612](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:612) |
| `/builders/questionnaire-builder/overview` | Workspace tools → Templates / Questionnaire overview | `QuestionnaireOverviewPage` | Admin | [line 613](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:613) |
| `/builders/questionnaire-builder` | Workspace tools → Templates / Questionnaire designer | `QuestionnaireBuilderPage` | Admin | [line 614](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:614) |
| `/builders/questionnaire-builder/rules-engine` | Workspace tools → Templates / Questionnaire rules | `QuestionnaireRulesEnginePage` | Admin | [line 615](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:615) |
| `/questionnaires/response/:shareToken` | External portal → Share-token response | `QuestionnaireResponsePage` | Existing direct/session/bridge behavior | [line 619](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:619) |
| `/features` | Administration / Workspace tools → Category launcher | `SemanticLauncherPage` | Admin | [line 620](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:620) |
| `/features/regml` | Workspace tools → AI / Settings and modes | `RegMLPage` | Admin | [line 621](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:621) |
| `/features/regml/control-ai-features` | Workspace tools → AI / Settings and modes | `RegMLPage` | Admin | [line 622](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:622) |
| `/features/regml/author` | Controls → Narratives / Draft (advanced AI tool) | `RegMLAuthorPage` | Admin | [line 623](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:623) |
| `/features/regml/explainer` | Contextual Explain (Workspace tools → AI) | `RegMLExplainerPage` | Admin | [line 624](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:624) |
| `/features/regml/ssp-ai-features` | Workspace tools → AI / Settings and modes | `RegMLPage` | Admin | [line 625](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:625) |
| `/features/regml/ssp-author` | Controls → Narratives / Plan draft (advanced AI tool) | `RegMLSSPAuthorPage` | Admin | [line 626](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:626) |
| `/features/regml/auditor` | Authorization → Reviews / AI draft aid | `RegMLAuditorPage` | Admin | [line 627](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:627) |
| `/features/regml/ai-generator` | Workspace tools → AI / Draft generator | `RegMLAIGeneratorPage` | Admin | [line 628](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:628) |
| `/ai-policy-builder` | Controls → Baseline / Security profiles (AI draft tool) | `AIPolicyBuilderPage` | Admin | [line 629](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:629) |
| `/features/ai-policy-builder` | Controls → Baseline / Security profiles (AI draft tool) | `AIPolicyBuilderPage` | Admin | [line 630](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:630) |
| `/security-profiles` | Controls → Baseline / Security profiles | `AIPolicyBuilderPage` | canUseModules | [line 631](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:631) |
| `/threat-models` | Risk & POA&M → Advanced / Threat portfolio | `ThreatModelsPage` | canUseModules | [line 635](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:635) |
| `/response-automation` | Monitoring → Reviewable automation (advanced tool) | `ResponseAutomationPage` | Admin | [line 645](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:645) |
| `/features/response-automation` | Monitoring → Reviewable automation (advanced tool) | `ResponseAutomationPage` | Admin | [line 646](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:646) |
| `/evidence-mapping` | Evidence → Control mappings / Suggestions | `EvidenceMappingPage` | Admin | [line 647](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:647) |
| `/features/evidence-mapping` | Evidence → Control mappings / Suggestions | `EvidenceMappingPage` | Admin | [line 648](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:648) |
| `/compliance-exports` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 649](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:649) |
| `/features/compliance-exports` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 650](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:650) |
| `/features/compliance-exports/emass` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 651](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:651) |
| `/features/compliance-exports/emass/hardware-software-list` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 652](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:652) |
| `/features/compliance-exports/emass/poams` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 656](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:656) |
| `/features/compliance-exports/emass/ports-protocols` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 657](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:657) |
| `/features/compliance-exports/emass/sap-sar` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 661](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:661) |
| `/features/compliance-exports/emass/slcm` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 662](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:662) |
| `/features/compliance-exports/fedramp` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 663](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:663) |
| `/features/compliance-exports/fedramp/cis-crm` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 664](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:664) |
| `/features/compliance-exports/fedramp/inventory` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 668](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:668) |
| `/features/compliance-exports/fedramp/poams` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 672](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:672) |
| `/features/compliance-exports/fedramp/risk-exposure` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 673](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:673) |
| `/features/compliance-exports/fedramp/test-case-procedures` | Authorization → Outputs / Compliance exports | `ComplianceExportsPage` | Admin | [line 677](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:677) |
| `/chat` | Workspace tools → Workspace AI / Contextual guidance | `ChatWorkspacePage` | canUseChat | [line 681](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:681) |
| `/imports` | Workspace tools → Data import (contextual intake) | `ImportsPage` | Admin | [line 682](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:682) |
| `/integrations` | Administration → Connections (contextual Monitoring) | `AutomationManagerPage` | Admin | [line 683](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:683) |
| `/automation-manager` | Administration → Connections (contextual Monitoring) | `AutomationManagerPage` | Admin | [line 684](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:684) |
| `/features/automation-manager` | Administration → Connections (contextual Monitoring) | `AutomationManagerPage` | Admin | [line 685](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:685) |
| `/fedramp/provider` | Authorization → Provider / Maintenance and trust publication | `FedrampProviderShellPage` | Admin | [line 686](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:686) |
| `/features/third-party-risk` | Systems → Dependencies / Vendors (portfolio tool available) | `TprmWorkspacePage` | canUseThirdParty | [line 687](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:687) |
| `/features/continuous-monitoring` | Administration → Monitoring profiles (contextual Monitoring) | `ConMonProfilesPage` | Admin | [line 688](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:688) |
| `/grc-admin` | Administration → Catalogue content / AI providers | `GrcAdministrationPage` | Admin | [line 689](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:689) |
| `/scrutiny-engine` | Authorization → Assessments / Scrutiny (current admin permission retained) | `ScrutinyEnginePage` | Admin | [line 690](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:690) |
| `/grc-admin/scrutiny-engine` | Authorization → Assessments / Scrutiny (current admin permission retained) | `ScrutinyEnginePage` | Admin | [line 691](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:691) |
| `/trust-center` | Authorization → Provider / Maintenance and trust publication | `FedrampProviderShellPage` | Admin | [line 692](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:692) |
| `/workflow` | Workspace tools → Coordination / Leases | `WorkflowControlPage` | canUseProgramWorkspace | [line 693](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:693) |
| `/features/workflow` | Workspace tools → Coordination / Leases | `WorkflowControlPage` | canUseProgramWorkspace | [line 694](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:694) |
| `/utilities` | Workspace tools → Utilities | `UtilitiesControlPage` | canUseModules | [line 695](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:695) |
| `/features/utilities` | Workspace tools → Utilities | `UtilitiesControlPage` | canUseModules | [line 696](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:696) |
| `/subsystems` | Workspace tools → Record view presets | `SubsystemsControlPage` | canUseModules | [line 697](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:697) |
| `/features/subsystems` | Workspace tools → Record view presets | `SubsystemsControlPage` | canUseModules | [line 698](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:698) |
| `/rmf` | Authorization → Overview / RMF handoff | `RMFControlPage` | canUseFrameworks | [line 699](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:699) |
| `/features/rmf` | Authorization → Overview / RMF handoff | `RMFControlPage` | canUseFrameworks | [line 700](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:700) |
| `/app-management` | Administration → Business units / Applications | `AppManagementControlPage` | canUseProgramWorkspace | [line 701](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:701) |
| `/features/app-management` | Administration → Business units / Applications | `AppManagementControlPage` | canUseProgramWorkspace | [line 702](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:702) |
| `/workbench` | My Work → All permitted work | `WorkbenchControlPage` | canUseProgramWorkspace | [line 703](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:703) |
| `/features/workbench` | My Work → All permitted work | `WorkbenchControlPage` | canUseProgramWorkspace | [line 704](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:704) |
| `/news-feed` | Monitoring → Changes / Activity | `NewsFeedControlPage` | canUseProgramWorkspace | [line 705](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:705) |
| `/features/news-feed` | Monitoring → Changes / Activity | `NewsFeedControlPage` | canUseProgramWorkspace | [line 706](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:706) |
| `{entry.route}` | Module-key ownership table (preserve record query) | `SharedModuleWorkspacePage` | canUseModules | [line 708](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:708) |
| `/catalogues` | Controls → Baseline / Catalogues | `Navigate` | canUseModules | [line 714](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:714) |
| `/assessment-plans` | Authorization → Assessments / Reusable plans | `QuestionnaireOverviewPage` | canUseModules | [line 715](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:715) |
| `/questionnaires` | Evidence → Requests / Questionnaires | `QuestionnaireOverviewPage` | canUseModules | [line 716](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:716) |
| `/modules/*` | Preserved contextual alias resolver | `ComplianceNavigatorRouteBridgePage` | Existing direct/session/bridge behavior | [line 717](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:717) |
| `/features/*` | Preserved contextual alias resolver | `ComplianceNavigatorRouteBridgePage` | Existing direct/session/bridge behavior | [line 718](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:718) |
| `/builders/*` | Preserved contextual alias resolver | `ComplianceNavigatorRouteBridgePage` | Existing direct/session/bridge behavior | [line 719](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:719) |
| `/setup/*` | Preserved contextual alias resolver | `ComplianceNavigatorRouteBridgePage` | Existing direct/session/bridge behavior | [line 720](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:720) |
| `/utilities/*` | Preserved contextual alias resolver | `ComplianceNavigatorRouteBridgePage` | Existing direct/session/bridge behavior | [line 721](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:721) |
| `/logs` | Preserved contextual alias resolver | `ComplianceNavigatorRouteBridgePage` | Existing direct/session/bridge behavior | [line 722](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:722) |
| `/portal` | External portal → Assignments (internal Authorization link) | `PortalDashboardPage` | canUsePortal | [line 723](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:723) |
| `/portal/assignments/:assignmentId` | External portal → Selected assignment | `PortalAssignmentDetailPage` | canUsePortal | [line 724](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:724) |
| `/advanced-risk/ebios` | Risk & POA&M → Advanced / EBIOS | `EbiosWorkspacePage` | canUseAdvancedRisk | [line 725](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:725) |
| `/advanced-risk/ebios/:studyId` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 726](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:726) |
| `/advanced-risk/quantitative` | Risk & POA&M → Advanced / Quantitative | `QuantitativeWorkspacePage` | canUseAdvancedRisk | [line 727](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:727) |
| `/advanced-risk/quantitative/:studyId` | Risk & POA&M → Advanced / Quantitative study | `QuantitativeStudyDetailPage` | canUseAdvancedRisk | [line 728](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:728) |
| `/advanced-risk/quantitative/:studyId/executive-summary` | Risk & POA&M → Advanced / Quantitative summary | `QuantitativeExecutiveSummaryPage` | canUseAdvancedRisk | [line 732](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:732) |
| `/advanced-risk/quantitative/:studyId/key-metrics` | Risk & POA&M → Advanced / Quantitative metrics | `QuantitativeKeyMetricsPage` | canUseAdvancedRisk | [line 736](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:736) |
| `/advanced-risk/quantitative/:studyId/action-plan` | Risk & POA&M → Advanced / Quantitative treatment | `QuantitativeActionPlanPage` | canUseAdvancedRisk | [line 740](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:740) |
| `/quantitative-risk-studies/:studyId/action-plan/budget-overview` | Risk & POA&M → Advanced / Quantitative treatment | `QuantitativeActionPlanPage` | canUseAdvancedRisk | [line 744](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:744) |
| `/quantitative-risk-scenarios/:scenarioId` | Risk & POA&M → Advanced / Quantitative scenario | `QuantitativeScenarioDetailPage` | canUseAdvancedRisk | [line 748](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:748) |
| `/quantitative-risk-hypotheses/:hypothesisId` | Risk & POA&M → Advanced / Quantitative hypothesis | `QuantitativeHypothesisDetailPage` | canUseAdvancedRisk | [line 752](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:752) |
| `/risk-assessments/:assessmentId/convert-to-quantitative` | Risk & POA&M → Advanced / Quantitative entry (navigation-only) | `RiskAssessmentConversionPage` | canUseAdvancedRisk | [line 756](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:756) |
| `/folders` | Administration → Domain scope | `FoldersPage` | Admin | [line 760](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:760) |
| `/users` | Administration → People and groups | `TeamPage` | Admin | [line 761](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:761) |
| `/my-profile` | Account → My Access | `MePage` | Existing direct/session/bridge behavior | [line 762](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:762) |
| `/my-assignments` | External portal → Assignments (internal Authorization link) | `PortalDashboardPage` | canUsePortal | [line 763](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:763) |
| `/entities` | Systems → Dependencies / Vendors (portfolio tool available) | `TprmWorkspacePage` | canUseThirdParty | [line 764](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:764) |
| `/contracts` | Systems → Dependencies / Vendors (portfolio tool available) | `TprmWorkspacePage` | canUseThirdParty | [line 765](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:765) |
| `/processings` | Systems → Privacy (specialist portfolio tool available) | `PrivacyWorkspacePage` | canUsePrivacy | [line 766](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:766) |
| `/business-impact-analysis` | Systems → Resilience / BIA (portfolio tool available) | `ResiliencePage` | canUseResilience | [line 767](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:767) |
| `/compliance-assessments` | Authorization → Assessments / Workbench | `AssessmentsPage` | canUseAssessmentWorkspace | [line 768](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:768) |
| `/risk-assessments` | Authorization → Assessments / Workbench | `AssessmentsPage` | canUseAssessmentWorkspace | [line 769](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:769) |
| `/loaded-libraries` | Controls → Library / Reference packages | `LibrariesPage` | canUseLibraries | [line 770](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:770) |
| `/loaded-libraries/:libraryId` | Controls → Library / Reference package | `LibraryDetailPage` | canUseLibraries | [line 771](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:771) |
| `/mapping-libraries` | Controls → Library / Reference packages | `LibrariesPage` | canUseLibraries | [line 772](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:772) |
| `/stored-libraries` | Controls → Library / Reference packages | `LibrariesPage` | canUseLibraries | [line 773](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:773) |
| `/stored-libraries/:libraryId` | Controls → Library / Reference package | `LibraryDetailPage` | canUseLibraries | [line 774](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:774) |
| `/auditee-dashboard` | External portal → Assignments (internal Authorization link) | `PortalDashboardPage` | canUsePortal | [line 775](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:775) |
| `/auditee-assessments/:assignmentId` | External portal → Selected assignment | `PortalAssignmentDetailPage` | canUsePortal | [line 776](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:776) |
| `/ebios-rm` | Risk & POA&M → Advanced / EBIOS | `EbiosWorkspacePage` | canUseAdvancedRisk | [line 777](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:777) |
| `/ebios-rm/:studyId` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 778](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:778) |
| `/ebios-rm/:studyId/visual` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 779](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:779) |
| `/ebios-rm/:studyId/report` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 780](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:780) |
| `/ebios-rm/:studyId/workshop-1/feared-events` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 781](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:781) |
| `/ebios-rm/:studyId/workshop-1/baseline` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 782](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:782) |
| `/ebios-rm/:studyId/workshop-1/ebios-rm-study` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 783](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:783) |
| `/ebios-rm/:studyId/workshop-1/ebios-rm-study/edit` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 784](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:784) |
| `/ebios-rm/:studyId/workshop-2/ro-to` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 785](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:785) |
| `/ebios-rm/:studyId/workshop-3/ecosystem` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 786](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:786) |
| `/ebios-rm/:studyId/workshop-3/strategic-scenarios` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 787](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:787) |
| `/ebios-rm/:studyId/workshop-4/operational-scenario` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 788](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:788) |
| `/ebios-rm/:studyId/workshop-4/elementary-actions` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 789](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:789) |
| `/ebios-rm/:studyId/workshop-5/risk-analyses` | Risk & POA&M → Advanced / EBIOS study | `EbiosStudyDetailPage` | canUseAdvancedRisk | [line 790](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:790) |
| `/quantitative-risk-studies` | Risk & POA&M → Advanced / Quantitative | `QuantitativeWorkspacePage` | canUseAdvancedRisk | [line 791](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:791) |
| `/quantitative-risk-studies/:studyId` | Risk & POA&M → Advanced / Quantitative study | `QuantitativeStudyDetailPage` | canUseAdvancedRisk | [line 792](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:792) |
| `/quantitative-risk-studies/:studyId/executive-summary` | Risk & POA&M → Advanced / Quantitative summary | `QuantitativeExecutiveSummaryPage` | canUseAdvancedRisk | [line 793](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:793) |
| `/quantitative-risk-studies/:studyId/key-metrics` | Risk & POA&M → Advanced / Quantitative metrics | `QuantitativeKeyMetricsPage` | canUseAdvancedRisk | [line 797](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:797) |
| `/quantitative-risk-studies/:studyId/action-plan` | Risk & POA&M → Advanced / Quantitative treatment | `QuantitativeActionPlanPage` | canUseAdvancedRisk | [line 801](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:801) |
| `/asset-assessments` | Systems → Resilience / Asset assessment overview | `AssetAssessmentsControlPage` | canUseResilience | [line 805](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:805) |
| `/actors` | Risk & POA&M → Advanced / Actors overview | `ActorsControlPage` | canUseAdvancedRisk | [line 809](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:809) |
| `/vulnerabilities` | Risk & POA&M → Vulnerabilities overview | `VulnerabilitiesControlPage` | canUseRiskAssessments | [line 813](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:813) |
| `/analytics` | Systems → Portfolio analytics (contextual reports) | `AnalyticsControlRoomPage` | canUseAnalytics | [line 817](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:817) |
| `/search` | Global search → Scoped records / Tools | `SearchControlRoomPage` | canUseSearch | [line 818](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:818) |
| `/backup-restore` | Administration → Data inventory (not restore capability) | `BackupRestoreControlPage` | Admin | [line 819](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:819) |
| `/calendar` | My Work → Calendar | `CalendarControlPage` | canUseProgramWorkspace | [line 823](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:823) |
| `/quick-start` | Administration → Getting started | `QuickStartControlPage` | Admin | [line 827](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:827) |
| `/settings` | Administration → Platform settings | `SettingsControlRoomPage` | Admin | [line 831](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:831) |
| `/dashboards` | Systems → Portfolio analytics / Summary | `DashboardsControlPage` | canUseAnalytics | [line 835](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:835) |
| `/recap` | Systems → Portfolio analytics / Summary | `DashboardsControlPage` | canUseAnalytics | [line 839](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:839) |
| `/validation-flows` | Authorization → Assessments / Validation readiness | `ValidationFlowsControlPage` | canUseFrameworks | [line 843](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:843) |
| `/x-rays` | Monitoring → Diagnostics / Validation posture | `XRaysControlPage` | canUseAnalytics | [line 847](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:847) |
| `/tasks` | My Work → Aggregated queue | `TaskOperationsControlPage` | canUseModules | [line 851](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:851) |
| `/task-nodes` | My Work → Work queue / Validation | `TaskOperationsControlPage` | canUseModules | [line 855](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:855) |
| `/task-templates` | My Work → Work queue / Validation | `TaskOperationsControlPage` | canUseModules | [line 859](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:859) |
| `/risk-matrices` | Risk & POA&M → Risk model summary (Admin edits) | `DashboardsControlPage` | canUseRiskAssessments | [line 863](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:863) |
| `/requirement-assessments` | Authorization → Assessments / Validation readiness | `ValidationFlowsControlPage` | canUseFrameworks | [line 867](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:867) |
| `/requirement-mapping-sets` | Controls → Library / Mapping operations | `LibraryMappingsControlPage` | canUseLibraries | [line 871](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:871) |
| `/sync-mappings` | Controls → Library / Mapping operations | `LibraryMappingsControlPage` | canUseLibraries | [line 875](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:875) |
| `/content-types` | Systems → Portfolio / Program overview | `ProgramControlPage` | canUseProgramWorkspace | [line 879](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:879) |
| `/generic-collections` | Systems → Portfolio / Program overview | `ProgramControlPage` | canUseProgramWorkspace | [line 883](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:883) |
| `/presets` | Systems → Portfolio / Program overview | `ProgramControlPage` | canUseProgramWorkspace | [line 887](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:887) |
| `/preset-journeys` | Systems → Portfolio / Program overview | `ProgramControlPage` | canUseProgramWorkspace | [line 891](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:891) |
| `/experimental` | Systems → Portfolio / Program overview | `ProgramControlPage` | canUseProgramWorkspace | [line 895](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:895) |
| `/license-management` | Systems → Portfolio / Program overview | `ProgramControlPage` | Admin | [line 899](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:899) |
| `/metric-instances` | Systems → Portfolio analytics (contextual reports) | `AnalyticsControlRoomPage` | canUseAnalytics | [line 903](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:903) |
| `/accreditations` | Systems → Portfolio / Program overview | `ProgramControlPage` | canUseProgramWorkspace | [line 907](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:907) |
| `/findings-assessments` | Authorization → Assessments / Validation readiness | `ValidationFlowsControlPage` | canUseFrameworks | [line 911](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:911) |
| `/operating-modes` | Risk & POA&M → Advanced / EBIOS | `EbiosWorkspacePage` | canUseAdvancedRisk | [line 915](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:915) |
| `/operational-scenarios` | Risk & POA&M → Advanced / EBIOS | `EbiosWorkspacePage` | canUseAdvancedRisk | [line 919](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:919) |
| `/strategic-scenarios` | Risk & POA&M → Advanced / EBIOS | `EbiosWorkspacePage` | canUseAdvancedRisk | [line 923](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:923) |
| `/ro-to` | Risk & POA&M → Advanced / EBIOS | `EbiosWorkspacePage` | canUseAdvancedRisk | [line 927](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:927) |
| `/stakeholders` | Risk & POA&M → Advanced / EBIOS | `EbiosWorkspacePage` | canUseAdvancedRisk | [line 931](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:931) |
| `/scoring-assistant` | Workspace tools → Workspace AI / Contextual guidance | `ChatWorkspacePage` | canUseChat | [line 935](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:935) |
| `/risk-actions` | Risk & POA&M → Action tracker (My Work projection) | `RiskActionTrackerPage` | canUseRiskAssessments | [line 939](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:939) |
| `/risk-scenarios` | Risk & POA&M → Risk library / Registers | `RiskScenariosPage` | canUseRiskAssessments | [line 940](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:940) |
| `/conmon/profiles` | Administration → Monitoring profiles (contextual Monitoring) | `ConMonProfilesPage` | Admin | [line 941](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:941) |
| `/conmon/executions` | Monitoring → Run history | `ConMonExecutionsPage` | canUseConMon | [line 942](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:942) |
| `/evidence-management` | Evidence → Sources / Jobs / Artifacts | `EvidenceManagementPage` | canUseEvidence | [line 943](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:943) |
| `/features/evidence-management` | Evidence → Sources / Jobs / Artifacts | `EvidenceManagementPage` | canUseEvidence | [line 944](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:944) |
| `/assessment-evidence-packages` | Authorization → Packages / Imported assessment package | `AssessmentEvidencePackagePage` | canUseEvidence | [line 945](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:945) |
| `/assessment-evidence-packages/:packageMarker` | Authorization → Packages / Imported assessment package | `AssessmentEvidencePackagePage` | canUseEvidence | [line 946](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:946) |
| `/evidence/sources` | Administration → Evidence sources (contextual Evidence) | `EvidenceSourcesPage` | Admin | [line 947](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:947) |
| `/evidence/jobs` | Evidence → Collection runs (Monitoring context) | `EvidenceJobsPage` | canUseEvidence | [line 948](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:948) |
| `/assurance` | Monitoring → Assurance attention / Authorization readiness | `AssuranceOverviewPage` | canUseAssurance | [line 949](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:949) |
| `/assurance/evidence` | Evidence → Explorer / Evaluations | `AssuranceEvidenceExplorerPage` | canUseAssurance | [line 950](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:950) |
| `/assurance/tracker` | Evidence → Intake / Tracker diagnostics | `TrackerWorkbenchPage` | canUseAssurance | [line 951](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:951) |
| `/assurance/packages` | Authorization → Packages / 20x explorer | `PackageExplorerPage` | canUseAssurance | [line 952](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:952) |
| `/assurance/reviews` | Authorization → Reviews (My Work projection) | `ReviewQueuePage` | canUseAssurance | [line 953](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:953) |
| `/assurance/agent-runs` | Monitoring → Agent traces / Writeback draft reviews | `AgentRunInspectorPage` | canUseAssurance | [line 954](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:954) |
| `{`/${model}/*`}` | Preserved legacy alias resolver | `LegacyRouteBridgePage` | Existing direct/session/bridge behavior | [line 956](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:956) |

Coverage: 258 unique explicit current route patterns, generated from the audited AppLayout inventory. Dynamic shared aliases and 67 legacy model wildcards are expanded/owned through the module table and preserved resolver. No routes have been changed by this proposal.

### Legacy model families

Every current `/{model}/*` family remains reachable through [LegacyRouteBridgePage](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/LegacyRouteBridgePage.tsx:13). Its resolver must be reviewed before changing record/subview behavior:

`accreditations`, `analytics`, `actors`, `asset-assessments`, `assets`, `auditee-assessments`, `auditee-dashboard`, `backup-restore`, `business-impact-analysis`, `calendar`, `compliance-assessments`, `contracts`, `dashboards`, `ebios-rm`, `entities`, `entity-assessments`, `evidence-revisions`, `evidences`, `experimental`, `findings-assessments`, `first-connexion`, `folders`, `generic-collections`, `incidents`, `libraries`, `license-management`, `loaded-libraries`, `mapping-libraries`, `metric-instances`, `my-assignments`, `my-profile`, `operating-modes`, `operational-scenarios`, `password-reset`, `policies`, `preset-journeys`, `presets`, `processings`, `quantitative-risk-hypotheses`, `quantitative-risk-scenarios`, `quantitative-risk-studies`, `quick-start`, `recap`, `reports`, `requirement-assessments`, `requirement-mapping-sets`, `risk-assessments`, `risk-matrices`, `risk-scenarios`, `ro-to`, `scoring-assistant`, `search`, `security-profiles`, `security-exceptions`, `settings`, `setup-mfa`, `stakeholders`, `stored-libraries`, `strategic-scenarios`, `sso`, `sync-mappings`, `task-nodes`, `task-templates`, `users`, `validation-flows`, `vulnerabilities`, `x-rays`.

Inventory validation: 67 current legacy model families. Additional dedicated `/vanta-clone*` prototype bypass is preserved as reference-only outside normal navigation.
