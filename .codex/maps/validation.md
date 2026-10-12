# Historical local validation and coverage

Run on 2026-10-11 (America/New_York), HEAD `752f0ffe1` plus existing local edits. No product implementation changed. No production system, external collector, private env file or existing database was used. The inherited checkout was already dirty; it remained so.

The later approved release fixes the bootstrap, anonymous questionnaire and mobile dialog issues described in this initial audit. Its final full verification passed 22 gates, 324 regressions and four fresh isolated domain journeys with zero advisory findings on Node 24.13.0, within the supported engine range. See [production hardening](../../documentation/engineering/production-hardening.md). Generated release receipts are local ignored artifacts; historical seeded-demo screenshots are reference evidence.

## Pull and preparation

`git -c rebase.autoStash=false -c merge.autoStash=false pull --ff-only` completed with `Already up to date.` for the configured upstream of `feature/origin-main`. No stash/reset/rebase/checkout/commit/push ran. This does not establish that the branch equals main or that production runs its files.

Frontend TypeScript was initially unavailable because the local frontend dependencies were absent. `npm --prefix apps/web ci --ignore-scripts` installed the existing lockfile dependencies; it did not change the manifest or lockfile. Installation reported 16 audit findings (6 moderate, 10 high), which were not independently analyzed or remediated in this scope.

## Executed checks

| Check | Result and boundary |
| --- | --- |
| `npm --prefix apps/web run typecheck` | Passed after installing existing dependencies. |
| `npm --prefix apps/web run build` | Passed. Vite warns about stale Browserslist data and a main chunk over 500KB. Build does not establish runtime/mutation behavior. |
| `npm --prefix cloudflare run typecheck` | Passed. |
| `npm --prefix apps/web run verify:ia-shell` | Passed: 13 groups; 84 promoted route checks; route ownership/access/preservation and legacy aliases covered. Source nav inventory has 85 distinct URLs. |
| `npm --prefix apps/web run verify:a11y-tokens` | Passed: 200 source files, three intentional allowlisted token occurrences. This is a token scan, not WCAG or screen-reader certification. |
| `npm --prefix apps/web run verify:observable-import-ui` | Passed source contract check. |
| `npm --prefix cloudflare run alignment:check` | Passed static source/metadata check; 427 call sites, 156 normalized paths, 256 distinct frontend patterns, 20 services; zero declared alignment gaps. |
| `npm --prefix cloudflare run validate:grc-contracts` | Passed: 49 fixtures and 103 sanitized framework documents. |
| `npm --prefix cloudflare run verify:queue-recovery` | Passed queue recovery contract verification. |
| All 41 D1 migrations into a new isolated local scratch database | Applied successfully. No remote or preexisting database was touched. |
| Fresh demo bootstrap | Failed twice with FK constraint; root confirmed IAM folders are seeded before tenant exists. |
| Scratch-only tenant preseed, followed by demo bootstrap | Succeeded. This bypasses the bootstrap-order bug for visualization; it is not an application fix or a clean-start pass. |

The existing localhost:8787 process belonged to another application (Math Card Games); it was left untouched. Regovise review ran on 127.0.0.1:8799 using an independent temporary Wrangler config/database/state. Config pointed at current source/build, used `APP_ENV=development`, disabled mail, service delivery and remote bindings, omitted cron, and loaded an empty env file from the temporary directory. No repo secret configuration was read. Only generated demo identities/data were used.

## Browser review

The review opened all 85 distinct navigation URLs at widths 1440, 1024, 768, 390 (height 900): 340 route-width checks. It recorded main text/headings/buttons, failed API responses, page exceptions, document horizontal overflow and mobile menu visibility. External browser requests were blocked. Result: no page exceptions, no API responses >=400, no document overflow >4px, and mobile drawer opening succeeded for every navigation route at 390px.

These are GET/navigation checks against a privileged seeded demo user. They do not prove permission isolation for other users, functional saves, export correctness, complete connector setup, queue completion, server errors after mutation, chart accuracy, internal-table usability or accessibility. Some screens load empty states successfully. Static and browser metadata saying a route exists is not proof of its advertised capability.

A second pass opened 23 seeded detail URLs for frameworks/libraries, qualitative/manual assessments/action plans/flash/Kanban, vendor entity, privacy processing, BIA, portal assignment, EBIOS, quantitative study/summary/metrics/action plan/scenario/hypothesis and representative legacy aliases. These had no observed page exceptions or failed API responses. Four creation dialogs (risk scenario, team member, entity, privacy processing) were opened and inspected without submitting. Browser writes other than session exchange were blocked in this pass.

Four anonymous entry URLs were inspected. Login, already-initialized setup and guarded administrator recovery render. `/questionnaires/response/unknown-code` stays on “Loading questionnaire response...” after follow-up: only `core/session` was requested; there was no `builders/questionnaire-access` request. AppLayout directly renders the component outside a matched `Route`, so `useParams().shareToken` is undefined and the effect exits without clearing loading. An invalid token should reach an error state; any token is affected by this anonymous branch.

Mobile navigation was opened on 15 representative screens. Escape left the drawer open on all 15; clicking its explicit close button closed all 15. Source has no Escape handler/focus trap/dialog semantics. Screenshots were recaptured after the close-button action to show page content.

Evidence:

- [Full 340-check navigation result](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/ui-runtime-coverage.json)
- [Detail/dialog/anonymous entry result](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/ui-detail-coverage.json)
- [Navigation URL inventory](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/navigation-routes.json)
- [Route/API alignment inventory](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/route-api-alignment.json)
- [Frontend Route/component inventory](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/frontend-route-components.json)

## Representative desktop/mobile screens

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Home | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-home.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-home.png) |
| Risk scenarios | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-risk-scenarios.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-risk-scenarios.png) |
| Assessments | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-assessments.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-assessments.png) |
| Evidence | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-evidence-management.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-evidence-management.png) |
| Assurance | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-assurance.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-assurance.png) |
| Vendor oversight | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-third-party.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-third-party.png) |
| Privacy | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-privacy.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-privacy.png) |
| Resilience | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-resilience.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-resilience.png) |
| Reports | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-reports.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-reports.png) |
| Questionnaire builder | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-builders-questionnaire-builder.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-builders-questionnaire-builder.png) |
| Integrations | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-integrations.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-integrations.png) |
| Team administration | [1440px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/1440-workspace-team.png) | [390px](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/screenshots/390-workspace-team.png) |

Screenshots also cover Tasks, Frameworks, Security setup and the four dialogs. They are local seeded-demo evidence, not screenshots of production.

## Work intentionally outside verification scope

No production smoke/deploy/token verification/remote migration, secrets inspection, live cloud/integration/AI/SSO/email execution, submission/writeback, restore/backup, regulatory-standard compliance certification, screen-reader test, comprehensive legacy regression suite or all-line security audit ran. No pass result is asserted for those areas. Source findings and implementation boundaries are documented in the other maps and risks file.
