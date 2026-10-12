# Regovise extended frontend and UX map

Source reviewed at working-tree HEAD `752f0ffe1`. This is a read-only source map of `apps/web`, including existing uncommitted files. It is not a deployment certification or a claim that every rendered control was exercised in a browser. Backend capability notes below were cross-checked with the backend source analyst and key implementations. No secrets, production systems, authentication settings, or product source were changed by this analysis.

## How to read the extended application

The canonical app is a React/Vite application. Normal workspace screens run inside `WorkspaceAppLayout` and its access boundaries; the share-token questionnaire has an intended unauthenticated bypass at AppLayout L404, but that branch does not provide matched route parameters and currently stalls (see limitations). Explicit route definitions take precedence over broad compatibility bridges. UI labels such as `Validated`, `D1-backed`, `Live preview`, and `Production E2E` are application copy; they do not independently establish that the underlying operation is complete, produces native files, or was tested against production during this review. The Vanta clone is a separate visual prototype that bypasses the normal shell entirely. [apps/web/src/shell/AppLayout.tsx:492](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:492) [apps/web/src/shell/AppLayout.tsx:978](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:978) [apps/web/src/features/parity/SemanticLauncherPage.tsx:15](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/SemanticLauncherPage.tsx:15)

Normal data uses `ApiClient`: feature-local API adapters pass relative service paths and unwrap `{data: ...}`. Most pages maintain local editor drafts, explicit loading/busy flags, an error string, and a success notice; Save/Create invokes the service, replaces draft state, then reloads the collection. Local draft edits are not automatically durable. Shared records persist through `/core/modules`, builders through `/builders`, setup through `/setup`, IAM through `/iam`, and operational/portal/import/export records through `/ops`. The shared API prefix is resolved by the API client, so adapter paths below omit `/_api`. [apps/web/src/shared/api/client.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shared/api/client.ts:1)

## Route ownership

| Family | Current routes and aliases | Actual screen ownership |
| --- | --- | --- |
| IAM | `/workspace/domains`, `/folders`; `/workspace/team`, `/users`; `/workspace/access`, setup role aliases | Domain tree/creation, team/groups, role and assignment administration. Admin-only shell routes. |
| Setup | `/setup`, `/setup/{tags,general,classification,service-accounts,branding,email,logs-utilization,security,modules-features,risk-model,sso,mfa}` | Setup launcher plus twelve dedicated pages; email-settings/theming-branding/SSO/MFA aliases reuse the same pages. |
| Builders | `/builders`, `/builders/{export-builder,form-builder,report-builder,dashboard-builder,rules-builder,wayfinder-builder,questionnaire-builder}` | Seven authoring experiences. Rules Builder is the Form Builder Rules tab; questionnaire overview/rules routes are starting tabs of one workspace. Report Builder uses report permission; the other builder routes are admin-only. |
| Public questionnaire | `/questionnaires/response/:shareToken` | Standalone visual response form with access-code API. The shell bypasses workspace sign-in at AppLayout L404, but renders the page outside a matched Route, so `useParams().shareToken` is absent and anonymous loading stalls. Authenticated route L619 supplies params correctly. |
| AI | `/features/regml` and author/explainer/ssp-author/auditor/ai-generator children; `/ai-policy-builder`, `/response-automation`, `/evidence-mapping`, `/compliance-exports` and `/features/*` aliases | Shared RegML workspace with different initial panes; dedicated wizard/review/mapping/export pages. Admin-only in shell. |
| TPRM | `/third-party`, `/third-party/entities/:entityId`, `/entities`, `/entities/:entityId`, `/contracts`, `/features/third-party-risk` | Entity/solution/contract workspace and entity detail; `/contracts` lands on the whole workspace. |
| Privacy | `/privacy`, `/privacy/processings/:processingId`, `/processings`, `/processings/:processingId` | Processing/rights/breach workspace and processing detail. |
| Resilience | `/resilience`, `/resilience/business-impact-analyses/:analysisId`, `/business-impact-analysis` and detail/action-plan/report/visual aliases | BIA list/detail. Action-plan/report/visual aliases reuse detail, rather than distinct native editors/renderers. |
| Reports | `/reports`, `/reports/dora-roi` | Catalog/export history and DORA Register of Information validation/export. |
| Modules | `/modules`, `/modules/:moduleKey`, direct aliases listed later | Directory or schema-driven shared-record workspace. Non-shared catalog entries show a link to their dedicated/template destination. |
| Ops | `/program`, `/program/setup`, `/analytics`, `/search`, `/backup-restore`, `/calendar`, `/quick-start`, `/settings`, `/dashboards`, `/recap`, `/validation-flows`, `/x-rays`, `/tasks`, `/task-nodes`, `/task-templates`, `/workflow`, `/utilities`, `/subsystems`, `/rmf`, `/app-management`, `/workbench`, `/news-feed` | Dedicated overview/control components, several operating on the same parity overview payload; feature aliases point to the same components. |
| Portal/imports/integrations | `/portal`, `/portal/assignments/:assignmentId`, auditee/my-assignments aliases; `/imports`; `/integrations`, `/automation-manager`, `/features/automation-manager` | Auditee responses/submission; import-job interface; connector metadata/lifecycle interface. |
| Legacy semantic bridges | Unknown descendants under `/modules/*`, `/features/*`, `/builders/*`, `/setup/*`, `/utilities/*`, `/logs`, and legacy model wildcards | Redirect to a canonical screen after `canAccessShellRoute`; unsupported subpaths are consolidated into broader workflows. |
| Vanta | `/vanta-clone...` | Hardcoded visual prototype, separate shell, path-to-screen resolver. |

Route evidence: [apps/web/src/shell/AppLayout.tsx:499](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:499) [apps/web/src/shell/AppLayout.tsx:573](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:573) [apps/web/src/shell/AppLayout.tsx:602](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:602) [apps/web/src/shell/AppLayout.tsx:621](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:621) [apps/web/src/shell/AppLayout.tsx:682](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:682) [apps/web/src/shell/AppLayout.tsx:707](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:707) [apps/web/src/shell/AppLayout.tsx:817](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:817). `/tasks` is deliberately filtered out of shared direct aliases at line 707, leaving the dedicated Work Queue at line 851; the shared task register remains `/modules/tasks`.

## Common UX building blocks

`PagePrimitives.tsx` standardizes a white page header, responsive action rows, horizontally scrollable tab strip, filter bar, bordered table wrapper, six pill tones, dropdown actions, and Radix-backed modal/drawer/sheet variants. The modal constrains height to 90dvh with a scrolling body and fixed footer. The right drawer occupies the full viewport on narrow displays and a maximum 520px right panel on larger displays; the mobile sheet becomes a centered dialog at `sm`. Destructive actions appear red and can be disabled. Links and mutation callbacks share the action menu. [apps/web/src/components/regovise/PagePrimitives.tsx:36](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/components/regovise/PagePrimitives.tsx:36) [apps/web/src/components/regovise/PagePrimitives.tsx:81](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/components/regovise/PagePrimitives.tsx:81) [apps/web/src/components/regovise/PagePrimitives.tsx:170](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/components/regovise/PagePrimitives.tsx:170) [apps/web/src/components/regovise/PagePrimitives.tsx:222](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/components/regovise/PagePrimitives.tsx:222) [apps/web/src/components/regovise/PagePrimitives.tsx:245](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/components/regovise/PagePrimitives.tsx:245)

Tables and card registers usually scroll horizontally when wide. Most screens collapse multi-column content into a vertical stack before `xl`/`2xl`; form drawers provide labeled fields, save/cancel footers, and contextual summaries. Loading is commonly plain panel text, rather than a skeleton; errors are usually inline notices. These reusable components improve focus/dialog semantics, but custom `RegTabs` merely declares tab roles and click handling: it does not itself implement the complete arrow-key/roving-tabindex/panel association pattern. [apps/web/src/components/regovise/PagePrimitives.tsx:81](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/components/regovise/PagePrimitives.tsx:81)

## Builders: author, save, validate, distribute

### Form Builder and Rules Builder

The library lists tenant form packages; selection loads a deep-cloned draft and synchronizes `?moduleKey=`. A package includes singular/plural module names, alphabetical/manual section order, status, description, sections, fields, and embedded rules. The left collection opens the selected package; the editor splits into section layout, field selection, and field settings. Users add/reorder/remove sections and fields; deletion is a review modal. Rules Builder is the same workspace with `initialTab="rules"`. [apps/web/src/features/builders/FormBuilderWorkspace.tsx:264](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/FormBuilderWorkspace.tsx:264) [apps/web/src/features/builders/FormBuilderWorkspace.tsx:821](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/FormBuilderWorkspace.tsx:821) [apps/web/src/features/builders/RulesBuilderPage.tsx:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/RulesBuilderPage.tsx:1)

Field configuration includes display/system names, type, active/editable/required flags, help text, pattern, min/max, choice sets, and validation comparisons. Supported definitions span text/rich text/contact identifiers/numbers/currency/date/select/users/organizations/facilities/risk scales/checkbox/toggle/labels/HTML/button. These definitions exceed the types rendered as distinct controls in the shared-record runtime: runtime rendering reduces them to select, textarea, boolean, date, numeric, or plain text controls. [apps/web/src/features/builders/formTypes.ts:24](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/formTypes.ts:24) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:708](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:708) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3927](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3927)

Rules use AND/OR conditions on fields, new-record context, tenant features, or modules; actions SHOW/HIDE/REQUIRE/NOT_REQUIRE/ENABLE/DISABLE/SET_VALUE/VALIDATE target a field/tab. Local `evaluateFormRuntime` coerces values, evaluates conditions and date-relative comparisons, applies actions, and returns section/field visibility, editability, required flags, errors, and computed data. Shared records use this same frontend runtime before saving; service validation remains authoritative. Runtime context passed by the shared page includes the active module and related modules, but no `enabledFeatures` list. [apps/web/src/features/builders/formTypes.ts:85](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/formTypes.ts:85) [apps/web/src/features/builders/formRules.ts:97](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/formRules.ts:97) [apps/web/src/features/builders/formRules.ts:131](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/formRules.ts:131) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3682](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3682)

Save PUTs the full package to `/builders/forms/:id`; Validate POSTs current sections/rules, replacing draft diagnostics. Import reads JSON and POSTs `/import`; Export downloads local draft JSON. Factory reset POSTs `/reset` after a modal. Unsaved changes are detected by JSON equality against the saved detail; the workspace shows status but does not install a route-leave browser guard. On collection/detail errors it records an inline message and clears loading. [apps/web/src/features/builders/FormBuilderWorkspace.tsx:427](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/FormBuilderWorkspace.tsx:427) [apps/web/src/features/builders/FormBuilderWorkspace.tsx:450](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/FormBuilderWorkspace.tsx:450) [apps/web/src/features/builders/FormBuilderWorkspace.tsx:476](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/FormBuilderWorkspace.tsx:476) [apps/web/src/features/builders/FormBuilderWorkspace.tsx:513](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/FormBuilderWorkspace.tsx:513) [apps/web/src/features/builders/formApi.ts:36](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/formApi.ts:36)

### Export Builder and DOCX guide

Library → create configuration/starter copy → Setup → Export Mappings → Sub Templates → Gallery → Preview & Tests. Config stores module/export group/type/status/description, file name/analysis, mappings, filter rows/expression, and appendices. Mappings are selected for field-path/render settings and browsed through the server field catalog; filters support row logic such as `1 AND (2 OR 3)`. The upload and review-action modals expose what will change before template analysis, duplicate, auto-map, test, mapping export, or appendix removal. [apps/web/src/features/builders/ExportBuilderWorkspace.tsx:1057](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderWorkspace.tsx:1057) [apps/web/src/features/builders/exportTypes.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/exportTypes.ts:1) [apps/web/src/features/builders/ExportBuilderWorkspace.tsx:1245](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderWorkspace.tsx:1245) [apps/web/src/features/builders/ExportBuilderWorkspace.tsx:1958](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderWorkspace.tsx:1958)

Browser extraction scans DOCX/XLSX ZIP XML using `DataView`, central-directory offsets and `DecompressionStream('deflate-raw')`; it falls back to `file.text()`. The server receives filename plus extracted content, not an uploaded native binary file. Analyzer output distinguishes `content-scan` from `heuristic-seed`; Auto Map explicitly describes matching heuristics. Export/import mappings transports JSON. Existing test runs show diagnostics/preview results, and the backend test output is a semantic preview package, not a DOCX/XLSX renderer. The guide is documentation for placeholders/tags/tables/render settings, not a document editor. [apps/web/src/features/builders/ExportBuilderWorkspace.tsx:232](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderWorkspace.tsx:232) [apps/web/src/features/builders/ExportBuilderWorkspace.tsx:299](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderWorkspace.tsx:299) [apps/web/src/features/builders/ExportBuilderWorkspace.tsx:554](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderWorkspace.tsx:554) [apps/web/src/features/builders/ExportBuilderWorkspace.tsx:590](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderWorkspace.tsx:590) [apps/web/src/features/builders/ExportBuilderWorkspace.tsx:1239](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderWorkspace.tsx:1239) [cloudflare/src/services/builders/exports.ts:1347](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/builders/exports.ts:1347) [apps/web/src/features/builders/ExportBuilderDocxGuidePage.tsx:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderDocxGuidePage.tsx:1)

### Report Builder

Definitions library → create drawer → choose List/Bar/Line/Pie and module → select display/drilldown/sort fields, group-by, count/sum/average aggregation and filter rows/logic → generate preview → save/share/export/subscription. `?report=` selects a definition. Create, share recipients, subscription recipient/type/start/recurrence, export review, delete-report and delete-subscription each have dedicated panels/modals. Saved definitions use `/builders/reports`; preview sends the current unsaved config. [apps/web/src/features/builders/ReportBuilderWorkspace.tsx:112](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderWorkspace.tsx:112) [apps/web/src/features/builders/reportTypes.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/reportTypes.ts:1) [apps/web/src/features/builders/ReportBuilderWorkspace.tsx:280](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderWorkspace.tsx:280) [apps/web/src/features/builders/ReportBuilderWorkspace.tsx:365](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderWorkspace.tsx:365) [apps/web/src/features/builders/ReportBuilderWorkspace.tsx:1210](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderWorkspace.tsx:1210)

List preview is a table; all series previews, including Line and Pie, are currently horizontal percentage bars with an icon/label indicating requested chart type. `drillDownFields` is stored configuration, not a clickable chart drilldown implemented on this screen. Export POSTs the saved report ID and only puts the returned download path into a success notice; it does not automatically fetch/open the artifact. Share/subscription API records do not alone prove email delivery. [apps/web/src/features/builders/ReportBuilderWorkspace.tsx:405](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderWorkspace.tsx:405) [apps/web/src/features/builders/ReportBuilderWorkspace.tsx:891](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderWorkspace.tsx:891) [apps/web/src/features/builders/ReportBuilderWorkspace.tsx:1041](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderWorkspace.tsx:1041) [apps/web/src/features/builders/ReportBuilderWorkspace.tsx:1080](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderWorkspace.tsx:1080)

Backend previews load genuine module rows and evaluate filters/aggregations, but two misleading fallbacks exist: no rows returns fixed sample names/numbers; zero filtered results falls back to the first ten unfiltered rows. Thus an apparently populated preview is not sufficient evidence that the tenant or selected filter actually has matching data. [cloudflare/src/services/builders/reports.ts:736](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/builders/reports.ts:736) [cloudflare/src/services/builders/reports.ts:764](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/builders/reports.ts:764)

### Dashboard Builder

Canvases library → create public/private title/group configuration → choose Widgets/Reports/By Module palette → add Left/Right → reorder or move between columns → preview → save/favorite/publish. Full layout stores item instances plus left/right ID order. Remove-tile and delete-dashboard require modals; create uses a drawer. Empty columns explain that no tiles exist. Preview hides edit tools and replaces them with source-description text; it does not render the underlying report data as an embedded live chart. Public/private/groups/published are saved metadata; do not infer a public sharing URL or complete authorization behavior solely from labels. [apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:75](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:75) [apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:227](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:227) [apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:340](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:340) [apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:561](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:561) [apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:691](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:691) [apps/web/src/features/builders/dashboardApi.ts:24](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/dashboardApi.ts:24)

### Wayfinder Builder

Template library → choose/create template → edit title/owner/status/description → ordered stages → ordered activities → documentation links → save. Stage/activity moves are up/down array operations; activity stores title/type/description/link and documentation labels/URLs. JSON export downloads the current draft; import normalizes stage/activity shapes and either replaces the selected template or creates a new one via dedicated endpoints. Delete is confirmed; unsaved draft has a sticky save reminder. This is guided-journey template authoring, not a workflow execution engine. [apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:115](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:115) [apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:244](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:244) [apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:290](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:290) [apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:321](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:321) [apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:636](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:636) [apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:1115](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:1115)

### Questionnaire Builder, assessment plans, rules, and respondents

One workspace accepts `workspaceMode=all|assessment-plans|questionnaires` and `initialTab`; overview and rules-engine wrappers change the initial tab. Template kind is `assessment-plan` or `questionnaire`. Tabs: Overview, Builder, Assignments, Responses, Visual Rules Engine, Test Runs. Detail loads template/rules/test history plus instances. Metadata records audience, source framework, assignment and owner models, instructions, public/login flags, evidence/upload expectations, scoring and export/distribution settings. [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:174](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:174) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:263](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:263) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:339](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:339) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:1126](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:1126)

Questions have ref/prompt/section/type/required/weight/help/requirement/evidence plus scores/options/table columns. Sections/questions are added and removed in draft; removal uses review modals. Type definitions include single/multi select, text, number, boolean, date/email/phone, table, instructional and file-upload. Visual rules store AND/OR plus string condition/action lists; JSON mode, validation diagnostics, draft test-preview, saved test runs, resulting score/grade/hidden/disabled/required flags allow inspection before distribution. Template export obtains server JSON then creates a browser download; import is pasted JSON sent to `/builders/questionnaires/import`. [apps/web/src/features/builders/types.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/types.ts:1) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:1689](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:1689) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:2247](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:2247) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:2476](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:2476) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:808](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:808) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:834](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:834)

Assignments support user/email/module/self/recurring/bulk with due/start/end dates, reviewer and parent module/record. Creation returns instances with share links/access codes. Responses are drafted per instance; Save responses, Submit, Accept, Reject, Reopen, Close, Feedback, Delete, and export call explicit endpoints. Mutating review transitions use confirmation copy explaining locking/review. Recurrence settings are recorded here; worker execution/delivery is a separate concern. [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:287](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:287) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:900](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:900) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:924](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:924) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:947](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:947) [apps/web/src/features/builders/api.ts:158](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/api.ts:158)

The intended public response page is rendered before workspace sign-in for unauthenticated share-token paths (AppLayout L404). That branch renders outside a matched Route, leaving `useParams().shareToken` undefined; the effect returns before clearing loading. Root browser validation reproduced an anonymous response URL stuck on Loading with no questionnaire-access request. The authenticated matched route does provide the token. Once a token is available, the page GETs a share-token shell, POSTs access code validation, PUTs answers/uploads, then separately POSTs submit. Open/RequestChanges instances are editable; other statuses are locked. Runtime hides/disables/marks required questions and presents validation errors. Submit opens a review modal and saves before submitting. Its renderer has specialized boolean, single-select, instructional controls; other types (including multi-select and table) fall back to a textarea. File-upload is an evidence-reference textarea; no file bytes are uploaded. Internal response editor does support multi-select but does not mirror public runtime filtering/locking at the input layer. [apps/web/src/features/builders/QuestionnaireResponsePage.tsx:37](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireResponsePage.tsx:37) [apps/web/src/features/builders/QuestionnaireResponsePage.tsx:69](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireResponsePage.tsx:69) [apps/web/src/features/builders/QuestionnaireResponsePage.tsx:152](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireResponsePage.tsx:152) [apps/web/src/features/builders/QuestionnaireResponsePage.tsx:178](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireResponsePage.tsx:178) [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:2169](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:2169)

## AI surfaces: workflow UI versus model execution

### Policy Builder / Security Profiles

Session collection → Create session → 1 Select Profile → 2 Select Controls → 3 Review & Finish. Server catalogues are baseline sources. A profile queues matching controls; manual catalog/control selection can add controls; queue clearing and finish use review dialogs. Finish deduplicates requirement rows and marks the session Finished. Security Profiles is the same component with alternate copy and additional local manual/imported profile handling. Local profiles remain in React state; exported profile JSON is a browser file. Imported profiles can only activate if matching parent catalogues exist in the tenant; partial unmatched controls and duplicate skips are reported. This workflow does not itself invoke a language model or author an actual policy document. [apps/web/src/features/ai/AIPolicyBuilderPage.tsx:207](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/AIPolicyBuilderPage.tsx:207) [apps/web/src/features/ai/AIPolicyBuilderPage.tsx:498](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/AIPolicyBuilderPage.tsx:498) [apps/web/src/features/ai/AIPolicyBuilderPage.tsx:561](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/AIPolicyBuilderPage.tsx:561) [apps/web/src/features/ai/AIPolicyBuilderPage.tsx:643](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/AIPolicyBuilderPage.tsx:643) [apps/web/src/features/ai/AIPolicyBuilderPage.tsx:861](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/AIPolicyBuilderPage.tsx:861) [cloudflare/src/services/ai/http.ts:1555](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ai/http.ts:1555)

### RegML

Hub/Author/Explainer/SSP Author/Auditor/AI Generator tabs show tenant health, enable/terms/deployment configuration, source set, prompt mode Plan/Build, prompt editor, attempts/version history, before/after content, audit summaries and Copy/Apply actions. Runtime readiness is returned by API rather than inferred from a tab. Frontend maps Author and Explainer to backend mode `SSP Author`; Auditor and AI Generator get distinct modes. Settings PUT, run POST, apply POST update the session snapshot; Copy uses browser clipboard. [apps/web/src/features/ai/RegMLPage.tsx:88](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/RegMLPage.tsx:88) [apps/web/src/features/ai/RegMLPage.tsx:387](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/RegMLPage.tsx:387) [apps/web/src/features/ai/RegMLPage.tsx:471](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/RegMLPage.tsx:471) [apps/web/src/features/ai/RegMLPage.tsx:490](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/RegMLPage.tsx:490) [apps/web/src/features/ai/RegMLPage.tsx:695](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/RegMLPage.tsx:695)

Backend can use configured tenant AI and otherwise produce deterministic plan/attempt behavior. Apply updates the attempt status/selection/session message; it does not directly overwrite security-plan or control domain records. The screen's promise of applying an output should be understood as session-level acceptance until a domain writeback exists. [cloudflare/src/services/ai/regml.ts:1125](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ai/regml.ts:1125)

### Response Automation

Intake → Sources → Launch wizard uses title, source document name, export format, selected approved source IDs. Job cards show question/accepted counts and export link when provided. Open review → filter by answer/acceptance/confidence plus text → paginated editable answers → Accept all current page → Save current page sequentially persists changed items → source/detail inspector. Delete job/item uses modals. The document field is a name, not file transport. Backend builds a fixed question bank and retrieval/optional AI drafts; it is not parsing arbitrary questionnaire DOCX/XLSX uploads. The API's export link is surfaced as a real anchor, unlike Report Builder's notice-only export handling. [apps/web/src/features/ai/ResponseAutomationPage.tsx:35](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ResponseAutomationPage.tsx:35) [apps/web/src/features/ai/ResponseAutomationPage.tsx:177](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ResponseAutomationPage.tsx:177) [apps/web/src/features/ai/ResponseAutomationPage.tsx:200](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ResponseAutomationPage.tsx:200) [apps/web/src/features/ai/ResponseAutomationPage.tsx:345](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ResponseAutomationPage.tsx:345) [apps/web/src/features/ai/ResponseAutomationPage.tsx:448](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ResponseAutomationPage.tsx:448) [cloudflare/src/services/ai/responseAutomation.ts:552](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ai/responseAutomation.ts:552)

### Evidence Mapping

Choose evidence artifact → Current Mappings/Add Mappings/AI Recommendations. Manual mapping selects Security Plan/Control/Component/other server-defined target type, searches targets and picks multiple records. Existing targets are disabled to avoid duplicate add. Recommendations use threshold control, generation and checked acceptance grouped by mapping type; delete mapping is confirmed. API reads evidence details and persists explicit mapping links, rather than changing the underlying binary evidence. Backend recommendation retrieval uses embeddings when configured or name/path heuristics; a displayed recommendation does not prove content-level semantic analysis. [apps/web/src/features/ai/EvidenceMappingPage.tsx:27](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/EvidenceMappingPage.tsx:27) [apps/web/src/features/ai/EvidenceMappingPage.tsx:131](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/EvidenceMappingPage.tsx:131) [apps/web/src/features/ai/EvidenceMappingPage.tsx:166](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/EvidenceMappingPage.tsx:166) [apps/web/src/features/ai/EvidenceMappingPage.tsx:283](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/EvidenceMappingPage.tsx:283) [apps/web/src/features/ai/EvidenceMappingPage.tsx:431](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/EvidenceMappingPage.tsx:431) [cloudflare/src/services/ai/evidenceMapping.ts:283](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ai/evidenceMapping.ts:283)

### Compliance Exports

All/eMASS/FedRAMP/OSCAL/JSON/Word filters, prerequisite/readiness panels, export-option cards, job history, files-history links, inspection drawer and retry confirmation. Child eMASS/FedRAMP URLs reuse family-filtered export pages, not separate native hardware/software/POAM/ports/SAP/SAR/SLCM editors. Ready options can POST jobs; blocked options remain visible with explanations. Retrying creates another job while keeping original history. Download/files links open API-provided paths. Backend download generates metadata JSON, simple XML, or plain text carrying document/spreadsheet filename extensions; this is not a complete native OSCAL/FedRAMP/DOCX/XLSX production renderer. [apps/web/src/features/ai/ComplianceExportsPage.tsx:48](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ComplianceExportsPage.tsx:48) [apps/web/src/features/ai/ComplianceExportsPage.tsx:120](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ComplianceExportsPage.tsx:120) [apps/web/src/features/ai/ComplianceExportsPage.tsx:150](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ComplianceExportsPage.tsx:150) [apps/web/src/features/ai/ComplianceExportsPage.tsx:256](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ComplianceExportsPage.tsx:256) [apps/web/src/features/ai/ComplianceExportsPage.tsx:418](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ComplianceExportsPage.tsx:418) [cloudflare/src/services/ai/http.ts:732](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/ai/http.ts:732)

## IAM and setup administration

### IAM relationships and screens

Folders/domain scopes form a hierarchy (`parentFolderId`, `depth`, `pathLabel`, builtin flag). `FoldersPage` loads the tree, defaults parent to root, and creates root/domain/folder records; it is not a full rename/reparent/delete tree editor. Domain scope feeds most business-record create forms. [apps/web/src/features/iam/types.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/types.ts:1) [apps/web/src/features/iam/FoldersPage.tsx:25](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/FoldersPage.tsx:25) [apps/web/src/features/iam/FoldersPage.tsx:48](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/FoldersPage.tsx:48)

Team & Groups shows two tables, inspect/edit/create drawers and delete modals. User creation captures email/display/first/last/locale, local-login fallback, third-party/auditee flags and groups. User editing changes names/locale/groups. Group creation/edit captures domain, names/description and members; builtin groups block edits. Local temporary password requires matching confirmation and POSTs the explicit admin-set-password endpoint. Team loads SSO snapshot and disables local fallback flags when runtime-ready enforced SSO forbids fallback. [apps/web/src/features/iam/TeamPage.tsx:79](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/TeamPage.tsx:79) [apps/web/src/features/iam/TeamPage.tsx:109](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/TeamPage.tsx:109) [apps/web/src/features/iam/TeamPage.tsx:139](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/TeamPage.tsx:139) [apps/web/src/features/iam/TeamPage.tsx:243](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/TeamPage.tsx:243) [apps/web/src/features/iam/TeamPage.tsx:269](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/TeamPage.tsx:269)

Access Control loads current effective access, roles, assignments, users/groups/folders together. Custom roles have named permission arrays parsed from comma/newline input. Assignments connect user OR group → role → folder scope with recursive flag. Create/edit/inspect use right drawers, deletion uses confirmation. Effective direct/group roles and accessible domains are visible alongside role/assignment tables, making scope inheritance inspectable. Builtin restrictions appear in editor/action state and require backend enforcement. [apps/web/src/features/iam/AccessPage.tsx:124](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/AccessPage.tsx:124) [apps/web/src/features/iam/AccessPage.tsx:173](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/AccessPage.tsx:173) [apps/web/src/features/iam/AccessPage.tsx:196](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/AccessPage.tsx:196) [apps/web/src/features/iam/types.ts:76](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/types.ts:76)

### Setup capability matrix

All dedicated setup routes are admin-only in the shell. Most pages GET a snapshot, hydrate editable draft, request review in a `RegModal`, PUT the specific configuration and rehydrate the returned snapshot. The endpoint contracts and summary types are centralized. [apps/web/src/features/setup/api.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/api.ts:1) [apps/web/src/features/setup/types.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/types.ts:1)

| Page | Editable/readable UX | Data and material boundary |
| --- | --- | --- |
| General | Organization/workspace label, timezone/locale/date format, fiscal month/due time/reviewer team, workdays, change-freeze toggle/window | `/setup/general`; saved configuration and downstream-effects copy. Actual scheduling enforcement is separate. |
| Tags | User/System title, OSCAL-required flag, usage metrics, edit/create form, confirmed delete | CRUD `/setup/tags`; labels/metadata, not proof of complete OSCAL export. |
| Classification | Title and confidentiality/integrity/availability levels, coverage metrics, CRUD and local CSV export | `/setup/classification`; CSV exports visible classification records. |
| Risk Model | Matrix/scales/threshold bands/formula/residual/inherited methods/risk-owner role, escalation settings, review/save | `/setup/risk-model`; configuration UI does not alone establish end-to-end automatic escalation. |
| Branding | Asset URLs, logo/favicon/login/background, color inputs, login/footer text, blur/overlay/powered-by toggles and local live preview | `/setup/branding`; URLs and config are saved, no image upload transport. Preview is within the page; global application to every surface requires consumer verification. |
| Email | Support email, delivery mode, status/note; provider/from/DKIM/webhook/config-readiness and recent-event readouts | `/setup/email`; provider secrets are not editable in this form, no send-test action here. |
| Modules & Features | Module/flag checkboxes, RegML enable/terms, readiness/status note, review/save | `/setup/modules-features`; routes and permission gates are defined elsewhere. |
| Logs & Utilization | D1/R2/queue/DO metric cards, errors/session tables | GET `/setup/logs-utilization`; read-only, no UI date filters despite filter fields in response type. |
| Security Posture | Control owner/description/status/detail review actions, architecture/access-layer readouts | GET/PUT `/setup/security[/:controlId]`; posture metadata is distinct from actual runtime enforcement. |
| SSO | Protocol/provider, domain/client/callback/metadata, role/email/name claims, button label, group sync, enforce login/local fallback/JIT, runtime readiness | GET/PUT `/setup/sso`; actual OIDC implementation exists separately, SAML is inactive, Access is front-door configuration. |
| MFA | Enforcement/method toggles, exempt service accounts, grace days, target coverage/status, review/save | GET/PUT `/setup/mfa`; policy persistence only, no verified MFA enrollment/challenge/enforcement in login flow. |
| Service Accounts | Purpose/role/TTL create, expiry/status inventory, rotate/delete review, once-visible returned token and Copy | `/setup/service-accounts`; backend stores prefix/scopes/expiry rather than usable token verifier. Treat as operational inventory, not a verified credential-auth system. |

Entry references: [apps/web/src/features/setup/GeneralPage.tsx:41](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/GeneralPage.tsx:41) [apps/web/src/features/setup/TagsPage.tsx:13](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/TagsPage.tsx:13) [apps/web/src/features/setup/ClassificationPage.tsx:38](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/ClassificationPage.tsx:38) [apps/web/src/features/setup/RiskModelPage.tsx:30](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/RiskModelPage.tsx:30) [apps/web/src/features/setup/BrandingPage.tsx:24](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/BrandingPage.tsx:24) [apps/web/src/features/setup/EmailPage.tsx:10](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/EmailPage.tsx:10) [apps/web/src/features/setup/ModulesFeaturesPage.tsx:11](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/ModulesFeaturesPage.tsx:11) [apps/web/src/features/setup/LogsUtilizationPage.tsx:8](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/LogsUtilizationPage.tsx:8) [apps/web/src/features/setup/SecurityPosturePage.tsx:16](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/SecurityPosturePage.tsx:16) [apps/web/src/features/setup/SSOPage.tsx:16](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/SSOPage.tsx:16) [apps/web/src/features/setup/MFAPage.tsx:10](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/MFAPage.tsx:10) [apps/web/src/features/setup/ServiceAccountsPage.tsx:18](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/ServiceAccountsPage.tsx:18). Capability boundaries: [cloudflare/src/services/setup/http.ts:2416](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/setup/http.ts:2416) [cloudflare/src/services/setup/http.ts:2775](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/setup/http.ts:2775) [cloudflare/src/services/core/oidc.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/core/oidc.ts:1).

## Third-party, privacy, resilience, reports, portal, and imports

### Third-party management and DORA inputs

Workspace parallel-loads domain folders, entities, solutions, contracts, assessments. Entity → Solution/provider → Contract/provider/beneficiary/linked solutions is the main data chain; assessments also link entity/perimeter/compliance assessment. Header actions expose create-entity/create-solution/create-contract drawers and review panels; list cards show totals, provider relationships, expense/currency, review date and status. Entity links drill into detail; entity detail offers inspect/update drawers for entity/solution/contract and assessment inspection. Edit payloads include extended DORA fields (entity hierarchy/provider type, service data locations/substitutability/exit plan, contract arrangements/law/notice/exclusion). No create-assessment/delete flow exists in these two dedicated TPRM screens. [apps/web/src/features/tprm/TprmWorkspacePage.tsx:179](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/tprm/TprmWorkspacePage.tsx:179) [apps/web/src/features/tprm/TprmWorkspacePage.tsx:230](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/tprm/TprmWorkspacePage.tsx:230) [apps/web/src/features/tprm/TprmWorkspacePage.tsx:285](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/tprm/TprmWorkspacePage.tsx:285) [apps/web/src/features/tprm/EntityDetailPage.tsx:222](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/tprm/EntityDetailPage.tsx:222) [apps/web/src/features/tprm/types.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/tprm/types.ts:1)

### Privacy

Main page operates three collections: processing register, right requests, data breaches; creation/edit/inspection drawers and delete modals exist for each. A processing connects lawful purposes, personal data/retention/deletion/sensitivity, subjects/recipients, contractors, cross-border transfers/entities and perimeters. Right requests connect request type/status/requested/due/observation to processings. Breaches connect discovered type/risk/status/affected processings/counts plus authority/subject notification times and consequences. The main create forms initially capture a small metadata subset; edit expands the detail. [apps/web/src/features/privacy/PrivacyWorkspacePage.tsx:150](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/PrivacyWorkspacePage.tsx:150) [apps/web/src/features/privacy/PrivacyWorkspacePage.tsx:238](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/PrivacyWorkspacePage.tsx:238) [apps/web/src/features/privacy/PrivacyWorkspacePage.tsx:299](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/PrivacyWorkspacePage.tsx:299) [apps/web/src/features/privacy/PrivacyWorkspacePage.tsx:359](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/PrivacyWorkspacePage.tsx:359) [apps/web/src/features/privacy/types.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/types.ts:1)

Processing detail renders purpose/lawful basis, personal-data/subjects, recipients/contractors, transfers and DPIA/sensitive metadata. Edit changes header/channel/DPIA metadata, preserving perimeters; child purposes/data/subjects/contractors/transfers are readout arrays, not native CRUD sub-editors on that page. No file upload or authority-notification send operation exists in these pages; timestamps/text are saved metadata. [apps/web/src/features/privacy/ProcessingDetailPage.tsx:86](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/ProcessingDetailPage.tsx:86) [apps/web/src/features/privacy/ProcessingDetailPage.tsx:211](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/ProcessingDetailPage.tsx:211) [apps/web/src/features/privacy/ProcessingDetailPage.tsx:266](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/ProcessingDetailPage.tsx:266)

### Resilience / BIA

BIA list loads perimeters and analyses, allows create/edit/delete with domain/perimeter/version/status/matrix/observation metadata, and links to detail. Detail displays recovery matrix levels, asset assessments/dependencies/associated controls, documented/tested/targets-met pills, and point-in-time qualitative/quantitative thresholds. Asset inspection uses a drawer; threshold review uses a modal whose sole mutation route is `Edit BIA metadata`. There is no asset-threshold/recovery-objective editor in this screen, despite the review wording. Detail CRUD affects BIA metadata. Action-plan/report/visual alias URLs display the same detail component. [apps/web/src/features/resilience/ResiliencePage.tsx:61](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/resilience/ResiliencePage.tsx:61) [apps/web/src/features/resilience/ResiliencePage.tsx:96](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/resilience/ResiliencePage.tsx:96) [apps/web/src/features/resilience/BusinessImpactAnalysisDetailPage.tsx:85](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/resilience/BusinessImpactAnalysisDetailPage.tsx:85) [apps/web/src/features/resilience/BusinessImpactAnalysisDetailPage.tsx:231](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/resilience/BusinessImpactAnalysisDetailPage.tsx:231) [apps/web/src/features/resilience/BusinessImpactAnalysisDetailPage.tsx:443](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/resilience/BusinessImpactAnalysisDetailPage.tsx:443)

### Reports and DORA Register of Information

Reports loads server catalog plus export history. Catalog cards link into report flows; export rows expose inspect/download/recreate/delete. Inspect shows saved filters/summary; replay uses the export's saved payload and keeps history; delete is confirmed. DORA page loads lint plus all exports, filters history to `dora-roi`, and presents severity/category/object diagnostics, available identifiers, authority/country/naming defaults, IND/consolidation level and CSV generation. `ReportsPage` and DORA use `/ops/reports`, distinct from `/builders/reports` definitions. DORA can create CSV records but source service completeness must be judged from exported content, not filenames/UI success notices. DORA's `if (loading || !lint)` before its error notice means a failed initial request can leave the apparent loading panel indefinitely. [apps/web/src/features/reports/ReportsPage.tsx:53](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/reports/ReportsPage.tsx:53) [apps/web/src/features/reports/ReportsPage.tsx:90](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/reports/ReportsPage.tsx:90) [apps/web/src/features/reports/DoraReportPage.tsx:71](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/reports/DoraReportPage.tsx:71) [apps/web/src/features/reports/DoraReportPage.tsx:96](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/reports/DoraReportPage.tsx:96) [apps/web/src/features/reports/DoraReportPage.tsx:148](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/reports/DoraReportPage.tsx:148)

### Auditee portal

Dashboard lists assignments with status, linked assessment/entity/framework, due date and completion percentage. Detail loads requirements/events and seeds drafts. Each requirement has result (not assessed/noncompliant/partial/compliant/not applicable), response, observation and evidence-note text; inspect and review-save open drawer/modal. Save POSTs one requirement and reloads all drafts. Submit-for-review confirmation POSTs assignment submit; submitted/closed states disable edit and remove submit. The requirement evidence field is a note, not a binary artifact upload. Saving/reloading one requirement can reset other unsaved local drafts because the response replaces the entire draft map. [apps/web/src/features/portal/PortalDashboardPage.tsx:32](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/portal/PortalDashboardPage.tsx:32) [apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:49](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:49) [apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:75](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:75) [apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:95](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:95) [apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:125](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:125) [apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:193](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:193)

### Imports

Form asks domain/job name/source label spreadsheet|CSV|JSON/target risk_scenarios|entities|processings/row count. POST body contains those fields only; no file picker, row payload, column mapping, parser or preview is present. History shows steps, status, counts and created object names. Thus this UI is a persisted import-job/demo creation interface, not a complete workbook ingestion flow. The server returns an ImportJob; success text calls it completed. A user cannot import their actual workbook contents through this screen. [apps/web/src/features/imports/ImportsPage.tsx:52](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/imports/ImportsPage.tsx:52) [apps/web/src/features/imports/ImportsPage.tsx:96](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/imports/ImportsPage.tsx:96) [apps/web/src/features/imports/ImportsPage.tsx:149](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/imports/ImportsPage.tsx:149)

## Integrations

Automation Manager loads connector summaries, auto-selects a connector and deep-clones detail/config JSON. Create chooses provider/name; detail edits metadata/auth mode/base URL/status/enabled/capabilities and provider-specific configuration. Actions open provider, resource scope, secure metadata, raw JSON drawers; selected run opens history inspector. Raw JSON parse errors are separated from service errors. Save PUTs complete metadata/config; Test/Sync POST only the saved connector ID, so unsaved config edits are not included in those actions. [apps/web/src/features/integrations/AutomationManagerPage.tsx:159](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx:159) [apps/web/src/features/integrations/AutomationManagerPage.tsx:268](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx:268) [apps/web/src/features/integrations/AutomationManagerPage.tsx:305](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx:305) [apps/web/src/features/integrations/AutomationManagerPage.tsx:336](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx:336) [apps/web/src/features/integrations/AutomationManagerPage.tsx:468](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx:468)

The corresponding `/integrations/connectors/:id/test|sync` backend records completed/skipped from the enabled flag, provider lifecycle descriptions and fixed summary counts; it does not execute an external handshake/provider fetch. Sync is explicitly dry-run. This is distinct from real collectors in `/grc/connectors` and AWS evidence collection. Credential metadata readiness is not proof that credentials were validated. [cloudflare/src/services/integrations/http.ts:543](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare/src/services/integrations/http.ts:543) [apps/web/src/features/integrations/types.ts:1](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/types.ts:1)

## Shared modules: one record engine with domain-aware presentation

Directory groups catalog entries as shared-workspace/dedicated-workspace/template-workspace/subfeature and provides canonical/direct links, related modules, coverage badges and record totals. Direct aliases cover assets, capabilities, case-management, causal-analysis, changes, components, data-calls, evidence-locker, exceptions/security-exceptions, incidents, interconnections, issues, policies, programs, projects, requests, requirements, risks, security-controls, security-plans, supply-chain, threats. Tasks has shared records at `/modules/tasks`; `/tasks` is the consolidated work queue. Assessment-plans/questionnaires route into the template workspace, catalogues into frameworks, and security-profiles/threat-models have dedicated destinations. [apps/web/src/features/modules/ModuleDirectoryPage.tsx:28](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/ModuleDirectoryPage.tsx:28) [apps/web/src/features/modules/types.ts:105](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:105) [apps/web/src/shell/AppLayout.tsx:707](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:707)

Shared page obtains module metadata + accessible domain folders + matching Form Builder schema; without a matching schema it builds sections from catalog starter fields. Registers query by text/status/domain/includeArchived; selecting a record sets `?record=`, new sets `?create=true`. It shows domain-specific guidance, metrics/badges/highlights, registry cards, editable form sections, relation links, note/activity timeline and links to Form/Report Builder. Generic records are genuinely persisted via `/core/modules/:moduleKey/records` with CRUD-like create/update/archive; update uses POST, archive is explicit and confirmed. A schema is applied at runtime before Save; missing domain or first validation error blocks saving. [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:643](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:643) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3643](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3643) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3713](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3713) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3835](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3835) [apps/web/src/features/modules/api.ts:45](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/api.ts:45)

Record structure is common: folder/title/status, owner/assignee IDs, start/finish/due/review/expiry dates, flexible `data`, relation links and created/updated/note/archived activity. Link rows manually store relationType/targetType/targetId/label/route; they are not automatically a native cross-domain graph workflow. Domain-specific guidance/highlights/metrics/badges mostly interpret those flexible fields. Types include risks with likelihood/consequence/exposure; incidents with detection/containment/response; cases with investigation/evidence/disposition; policies with owner/version/review/acknowledgment; projects/programs with lifecycle/budget/progress; supply-chain with vendor/sourcing/criticality; plans/components with control/boundary/authorization data. These specialized summaries make the engine useful but should not be confused with distinct dedicated service models for every module. [apps/web/src/features/modules/types.ts:59](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:59) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:82](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:82) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:895](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:895) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:2337](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:2337) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3144](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:3144)

Record action menu offers inspect/core edit/relationships/activity/archive. The right drawers share the same draft/save function; core edit exposes a limited subset of fields, while main form exposes all renderable sections. Scrutiny links are available for assessment-plans/questionnaires/security-controls/security-plans/data-calls/evidence-locker and pass module/record/control refs in query parameters. Empty registers give domain-specific first-record advice; failed metadata gives unavailable message; non-shared entries show canonical destination, not generic record forms. [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:25](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:25) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:4076](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:4076) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:4229](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:4229) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:4302](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:4302) [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:4810](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:4810)

## Operational workspaces and compatibility semantics

`useOpsParityOverview` GETs `/ops/parity/overview`, then many screens render different projections of assets/actors/analytics/dashboards/calendar/backups/incidents/libraries/policies/checklist/search/settings/exceptions/tasks/validation/vulnerabilities/x-rays/program. These are server-backed overview cards that link to canonical workflows, not independent native editors for every legacy model. Most overview screens explicitly handle loading/error/empty results and Refresh. Search filters the fetched index client-side by title/subtitle/section/keywords and removes routes inaccessible to the current access profile. [apps/web/src/features/ops/useOpsParityOverview.ts:70](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/useOpsParityOverview.ts:70) [apps/web/src/features/ops/SearchControlRoomPage.tsx:12](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/SearchControlRoomPage.tsx:12)

| Screen | What a user can do | Data/action semantics |
| --- | --- | --- |
| Program | Review readiness/core areas/discovery links; access-filtered next actions | Parity overview cards; shared `/programs` register is different. |
| Starter Guide / Quick Start | Checklist/onboarding phases, launch pending setup/work queue links, Refresh | Completion derives from overview; first integration group is hardcoded 3/3 complete. No interactive wizard progress save here. |
| Analytics | Domain coverage, validation pressure, replay/workspace metrics and drill-in links | Overview aggregation; permission-aware sections. |
| Search | Text search and linked results/empty scopes | Client-side matching of fetched index; no separate search mutation. |
| Calendar | Query upcoming event/deadline list and open source records | Derived events; no calendar event create/reschedule UI. |
| Backup and Restore | Counts/latest imports/exports, links to reports/imports, validation artifacts | Overview only; no database backup download/upload/restore operation. |
| Settings | Identity/runtime/readiness and mapped setting links | Admin overview; actual settings edited in setup pages. |
| Dashboards/Recap/Risk Matrices | Aggregate metrics, validation-linked recap, diagnostic links | Same Dashboards component; risk-matrices alias is not matrix CRUD. |
| Validation Flows/Requirement Assessments/Findings Assessments | Active validation items, readiness dependencies, canonical links | Same overview surface, no standalone validation graph editor. |
| X-Rays | Diagnostic/validation/deadline/replay posture | Derived overview; not infrastructure tracing. |
| Task Nodes/Templates/Work Queue | Tabs All/Tasks/Validation, text search, table action menu, kanban/flash links | Combined applied-control task/validation overview; no node/template execution editor. Shared task CRUD is `/modules/tasks`. |
| Library Mappings | Canonical library operations and mapping-discovery links | Overview; mapping-set/sync aliases reuse this screen. |
| Asset Assessments / Actors / Vulnerabilities | Register-like cards, context/helper panels and canonical links | RegistryControlPages overview projections, not native per-record CRUD. |
| Workbench | Filter owner/module/status/text; active/completed tables, module volume/activity, source-record links | GET `/ops/workbench`; no direct edit mutation. |
| News Feed | Filter module/type/priority/text; event list/timeline/module volume and source links | GET `/ops/news-feed`; no external news service/social posting. |
| Workflow | Lease key input, Acquire/Release lease, active lease/template/lane/recent run display | GET `/ops/workflow`, POST `/leases` and `/leases/:key/release`; coordination metadata, not visual flow design. |
| Utilities | Select utility/scope/record-count hint/preview/notes, Launch and inspect recent receipts | `/ops/utilities/launch`; receipt/queue metadata does not by itself prove underlying utility work completed. |
| Subsystems | Record type Security Plan/Issue/Risk/Evidence, choose panel, Pin/Unpin, availability/action readouts | `/ops/subsystems/select` and `/:key/pin` persist tray selection/pin metadata. |
| RMF | Select authorization package, inspect steps/artifacts/blockers/timeline, Advance handoff | GET `/ops/rmf`, POST `/packages/:id/handoff`; stage progression is not independent authorization decision evidence. |
| App Management | Create business unit, edit name/description/public/inherit/owner/notes, duplicate; inspect group/user/service account tables | `/ops/app-management/apps`; access-looking matrices largely display snapshot data, actual IAM remains separate. |

Entry points and actions: [apps/web/src/features/ops/ProgramControlPage.tsx:12](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/ProgramControlPage.tsx:12) [apps/web/src/features/ops/QuickStartControlPage.tsx:6](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/QuickStartControlPage.tsx:6) [apps/web/src/features/ops/AnalyticsControlRoomPage.tsx:11](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/AnalyticsControlRoomPage.tsx:11) [apps/web/src/features/ops/CalendarControlPage.tsx:10](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/CalendarControlPage.tsx:10) [apps/web/src/features/ops/BackupRestoreControlPage.tsx:5](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/BackupRestoreControlPage.tsx:5) [apps/web/src/features/ops/DashboardsControlPage.tsx:5](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/DashboardsControlPage.tsx:5) [apps/web/src/features/ops/ValidationFlowsControlPage.tsx:5](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/ValidationFlowsControlPage.tsx:5) [apps/web/src/features/ops/TaskAndMappingControlPages.tsx:54](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/TaskAndMappingControlPages.tsx:54) [apps/web/src/features/ops/RegistryControlPages.tsx:197](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/RegistryControlPages.tsx:197) [apps/web/src/features/ops/WorkbenchControlPage.tsx:10](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/WorkbenchControlPage.tsx:10) [apps/web/src/features/ops/NewsFeedControlPage.tsx:10](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/NewsFeedControlPage.tsx:10) [apps/web/src/features/ops/WorkflowControlPage.tsx:35](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/WorkflowControlPage.tsx:35) [apps/web/src/features/ops/UtilitiesControlPage.tsx:47](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/UtilitiesControlPage.tsx:47) [apps/web/src/features/ops/SubsystemsControlPage.tsx:47](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/SubsystemsControlPage.tsx:47) [apps/web/src/features/ops/RMFControlPage.tsx:37](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/RMFControlPage.tsx:37) [apps/web/src/features/ops/AppManagementControlPage.tsx:72](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/AppManagementControlPage.tsx:72) [apps/web/src/features/ops/controlApi.ts:280](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/controlApi.ts:280).

Additional aliases consolidate `/content-types`, `/generic-collections`, `/presets`, `/preset-journeys`, `/experimental`, `/license-management`, `/accreditations` into Program; `/metric-instances` into Analytics; advanced-risk operating/operational/strategic/RO-TO/stakeholder into EBIOS; `/scoring-assistant` into Chat. This supplies navigation coverage rather than full feature equivalence with the old application. [apps/web/src/shell/AppLayout.tsx:864](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:864)

`ComplianceNavigatorRouteBridgePage` resolves first slug/path to canonical destinations; `LegacyRouteBridgePage` additionally maps ID/subview routes, but often discards unsupported detail segments. Access rejection redirects to default authorized route. Unrecognized compliance slugs go to area launchers. `ParityWorkspacePage`/`ParityRoutePages` retain older overview implementations but are not imported by the current AppLayout; similarly Assets/Policies/Incidents/SecurityExceptions control exports remain source components while active direct routes are shared modules. Count source files separately from active user-facing routes. [apps/web/src/features/parity/ComplianceNavigatorRouteBridgePage.tsx:13](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/ComplianceNavigatorRouteBridgePage.tsx:13) [apps/web/src/features/parity/ComplianceNavigatorRouteBridgePage.tsx:236](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/ComplianceNavigatorRouteBridgePage.tsx:236) [apps/web/src/features/parity/LegacyRouteBridgePage.tsx:13](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/LegacyRouteBridgePage.tsx:13) [apps/web/src/features/parity/LegacyRouteBridgePage.tsx:121](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/LegacyRouteBridgePage.tsx:121) [apps/web/src/features/parity/ParityRoutePages.tsx:509](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/ParityRoutePages.tsx:509)

## Vanta visual prototype

`AppLayout` detects any pathname beginning `/vanta-clone` before the real workspace shell, and `VantaClonePage` selects a screen by substring checks. There is a 69-entry screen-route table covering vendor review, customer trust commitments, people/tasks, compliance/risk reports, questionnaires, audits/create audit, documents/list/new/upload/detail/actions, policies/list/template/editor/approver/reaccept/version/sync/custom, tests/detail/deactivate/custom/Jira/control linking, frameworks/catalog/import/upload/review/control drawer/scope, inventory, Australian privacy scope/settings, console/home/program health/tooltips, welcome, notification settings, integrations, risk library/add scenario and user/access states. The source appendix below lists every route literally. [apps/web/src/shell/AppLayout.tsx:981](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:981) [apps/web/src/features/vanta/VantaClonePage.tsx:185](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:185) [apps/web/src/features/vanta/VantaClonePage.tsx:254](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:254)

Two TSX files and a large dedicated CSS stylesheet recreate Vanta-style layouts with fixed Acme/example data, chart SVGs, cards, tables, dimmed-background modal/drawer variants and decorative toggles. Sidebar buttons do navigate between clone routes; a few local toggles/text filters alter React state. Many buttons are visual-only and have no callback; Toggle simply reflects its `on` prop. There is no `ApiClient`, fetch, persistent local/session storage or integration with Regovise records in these files. A reload resets interactive local state; many modal states are separate URLs rather than lifecycle overlays. These are useful UI references, not operational features or a connected Vanta account. [apps/web/src/features/vanta/VantaClonePage.tsx:734](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:734) [apps/web/src/features/vanta/VantaClonePage.tsx:1023](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:1023) [apps/web/src/features/vanta/VantaAdditionalScreens.tsx:91](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaAdditionalScreens.tsx:91) [apps/web/src/features/vanta/VantaAdditionalScreens.tsx:120](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaAdditionalScreens.tsx:120) [apps/web/src/features/vanta/VantaClonePage.tsx:1969](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:1969)

## Cross-cutting gaps and practical limits

- Anonymous questionnaire share-link entry currently stalls: the shell bypass renders QuestionnaireResponsePage outside a matched route; `shareToken` is undefined, so the load effect exits while `loading` remains true. Root local browser reproduced this path; authenticated routing supplies the token. [AppLayout:404](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/shell/AppLayout.tsx:404) [QuestionnaireResponsePage:37](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireResponsePage.tsx:37)
- Several screens have fields/labels that look like stronger capabilities than the transport implements: reference text instead of file uploads, metadata/config instead of credential or MFA enforcement, semantic preview instead of rendered native exports, and compatibility aliases instead of a full independent workflow.
- Builder drafts are explicit-save local state, generally show unsaved flags, and can be replaced on selection/reload without a leave guard. Save uses full snapshots; concurrent edits and stale selection need backend concurrency controls to avoid lost updates.
- Collection/detail loads generally use raw effects and async functions rather than a query cache with cancellation; several large workspaces can show stale detail during races or leave old detail present on error. ModuleDirectory is one exception with an explicit cancellation guard. [apps/web/src/features/modules/ModuleDirectoryPage.tsx:33](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/ModuleDirectoryPage.tsx:33)
- Initial request failures are not uniformly exposed: DORA keeps its loading fallback when lint remains null; Automation Manager uses `detailLoading || !draft` as detail loading even after failure/empty library. These are source-grounded UX risks, not browser-confirmed defects in this analysis. [apps/web/src/features/reports/DoraReportPage.tsx:148](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/reports/DoraReportPage.tsx:148) [apps/web/src/features/integrations/AutomationManagerPage.tsx:453](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx:453)
- Date defaults and example values in several builder/admin forms are fixed dates/names/emails rather than calculated current-user values. Examples include Report Builder subscription start `2026-04-18` and recipient defaults. Treat entered content as a draft the user must review. [apps/web/src/features/builders/ReportBuilderWorkspace.tsx:134](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderWorkspace.tsx:134)
- Domain records rendered by TPRM/privacy/BIA have genuine service persistence but not a complete editor for every nested object. Empty sections often simply render no rows/cards without helpful first-item guidance; the shared module register has substantially stronger contextual empty states.
- Static launcher badges and strings asserting production tests are not a substitute for test logs or real deployment evidence. This map only records actual source behavior and local validation delegated to the root task.

## Source navigation appendix

The following mechanically extracted index records exported components, named event/load/save handlers, literal API paths, tabs, dialog titles, headings and selected fixed form labels for every file in this analysis scope. It is a navigation aid, not an assertion that all controls are functional. Links point into the analyzed source; anonymous inline callbacks and dynamic labels remain inspectable through their parent component links. No secret/runtime values are included.

### [apps/web/src/features/ai/AIPolicyBuilderPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/AIPolicyBuilderPage.tsx:1) (1391 lines)

Components and named handlers: `formatDate` L27, `badgeClass` L31, `slugify` L41, `downloadProfile` L49, `normalizeCatalogueName` L67, `parseImportedProfile` L71, `resolveLocalProfileControls` L146, `AIPolicyBuilderPage` L207, `loadWorkspace` L231, `loadDetail` L257, `refreshCurrentSession` L351, `handleCreateSession` L359, `handleSaveSession` L384, `addControlsToManualDraft` L402, `handleAddSelectedControlToDraft` L422, `handleAddFamilyToDraft` L435, `handleRemoveDraftControl` L448, `handleClearManualDraft` L454, `handleSaveManualProfile` L462, `handleQueueProfile` L498, `handleImportProfileFile` L561, `handleRemoveLocalProfile` L583, `handleExportCurrentProfile` L591, `handleQueueControl` L600, `handleClearQueue` L623, `handleFinish` L643.

Visible anchors: tab `profiles` L861, tab `controls` L862, tab `review` L863.

### [apps/web/src/features/ai/ComplianceExportsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ComplianceExportsPage.tsx:1) (547 lines)

Components and named handlers: `formatDate` L15, `statusClass` L19, `matchesFilter` L29, `findOptionForJob` L38, `ComplianceExportsPage` L48, `loadWorkspace` L70, `handleRunExport` L120, `handleInspectJob` L140, `handleRetryJob` L150.

Visible anchors: Generate standardized compliance packages for external systems L187, tab `all` L256, tab `emass` L257, tab `fedramp` L258, tab `oscal` L259, tab `json` L260, tab `word` L261, dialog/title Retry compliance export L530.

### [apps/web/src/features/ai/EvidenceMappingPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/EvidenceMappingPage.tsx:1) (550 lines)

Components and named handlers: `formatDate` L17, `badgeClass` L21, `EvidenceMappingPage` L27, `loadWorkspace` L45, `loadDetail` L59, `handleCreateMappings` L131, `handleDeleteMapping` L149, `handleGenerateRecommendations` L166.

Visible anchors: Link evidence documents to controls, plans, and components L193, tab `current` L283, tab `add` L284, tab `ai` L285, dialog/title Remove evidence mapping L514.

### [apps/web/src/features/ai/RegMLPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/RegMLPage.tsx:1) (994 lines)

Components and named handlers: `formatDate` L71, `availabilityBadgeClass` L75, `attemptStatusClass` L81, `paneToMode` L87, `getDefaultPromptForPane` L93, `getSelectedAttempt` L113, `copyToClipboard` L125, `WorkspaceRunner` L133, `RegMLWorkspacePage` L387, `loadWorkspace` L406, `handleSaveSettings` L471, `handleRun` L490, `handleApply` L519, `handleCopyOutput` L544, `RegMLPage` L972, `RegMLAuthorPage` L976, `RegMLExplainerPage` L980, `RegMLSSPAuthorPage` L984, `RegMLAuditorPage` L988, `RegMLAIGeneratorPage` L992.

Visible anchors: tab `hub` L695, tab `author` L696, tab `explainer` L697, tab `ssp-author` L698, tab `auditor` L699, tab `ai-generator` L700.

### [apps/web/src/features/ai/ResponseAutomationPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/ResponseAutomationPage.tsx:1) (724 lines)

Components and named handlers: `formatDate` L19, `statusBadgeClass` L23, `confidenceBadgeClass` L29, `ResponseAutomationPage` L35, `loadWorkspace` L61, `loadDetail` L76, `handleCreateJob` L177, `saveCurrentPage` L200, `handleDeleteItem` L234, `handleDeleteJob` L255, `acceptAllCurrentPage` L273.

Visible anchors: Automate questionnaire answering from approved internal sources L291, tab `intake` L345, tab `sources` L346, tab `launch` L347, dialog/title Delete response job L645, dialog/title Delete question L686.

### [apps/web/src/features/ai/api.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/api.ts:1) (218 lines)

Components and named handlers: `getPolicyBuilderWorkspace` L20, `createPolicyBuilderSession` L25, `getPolicyBuilderSession` L30, `updatePolicyBuilderSession` L35, `queuePolicyProfile` L40, `queuePolicyControl` L48, `clearPolicyBuilderQueue` L56, `finishPolicyBuilderSession` L61, `getComplianceExportsWorkspace` L73, `createComplianceExportJob` L78, `getComplianceExportJob` L96, `getResponseAutomationWorkspace` L114, `createResponseAutomationJob` L119, `getResponseAutomationJob` L129, `updateResponseAutomationItem` L134, `deleteResponseAutomationItem` L142, `deleteResponseAutomationJob` L147, `getEvidenceMappingWorkspace` L152, `getEvidenceMappingDetail` L157, `createEvidenceMappings` L162, `deleteEvidenceMapping` L167, `generateEvidenceRecommendations` L172, `getRegmlWorkspace` L177, `updateRegmlSettings` L182, `getRegmlSession` L191, `runRegmlPrompt` L198, `applyRegmlAttempt` L213.

API calls: `GET /ai/policy-builder` L21, `POST /ai/policy-builder/sessions` L26, `GET /ai/policy-builder/sessions/${sessionId}` L31, `PUT /ai/policy-builder/sessions/${sessionId}` L36, `POST /ai/policy-builder/sessions/${sessionId}/queue-profile` L41, `POST /ai/policy-builder/sessions/${sessionId}/queue-control` L49, `DELETE /ai/policy-builder/sessions/${sessionId}/queue` L57, `POST /ai/policy-builder/sessions/${sessionId}/finish` L62, `GET /ai/compliance-exports` L74, `POST /ai/compliance-exports/jobs` L79, `GET /ai/compliance-exports/jobs/${jobId}` L97, `GET /ai/response-automation` L115, `POST /ai/response-automation/jobs` L125, `GET /ai/response-automation/jobs/${jobId}` L130, `PUT /ai/response-automation/jobs/${jobId}/items/${itemId}` L135, `DELETE /ai/response-automation/jobs/${jobId}/items/${itemId}` L143, `DELETE /ai/response-automation/jobs/${jobId}` L148, `GET /ai/evidence-mapping` L153, `GET /ai/evidence-mapping/evidence/${artifactId}` L158, `POST /ai/evidence-mapping/evidence/${artifactId}/mappings` L163, `DELETE /ai/evidence-mapping/evidence/${artifactId}/mappings/${mappingId}` L168, `POST /ai/evidence-mapping/evidence/${artifactId}/recommendations` L173, `GET /ai/regml` L178, `PUT /ai/regml/settings` L187, `GET /ai/regml/workspaces/${encodeURIComponent(mode)}` L192, `POST /ai/regml/workspaces/${encodeURIComponent(mode)}/run` L206, `POST /ai/regml/workspaces/${encodeURIComponent(mode)}/attempts/${attemptId}/apply` L214.

### [apps/web/src/features/ai/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ai/types.ts:1) (468 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/builders/DashboardBuilderPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/DashboardBuilderPage.tsx:1) (5 lines)

Components and named handlers: `DashboardBuilderPage` L3.

### [apps/web/src/features/builders/DashboardBuilderWorkspace.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/DashboardBuilderWorkspace.tsx:1) (916 lines)

Components and named handlers: `clone` L23, `formatDate` L27, `reorder` L31, `dashboardPayload` L45, `normalizeDraft` L55, `DashboardBuilderWorkspace` L75, `loadDashboards` L100, `loadDetail` L115, `handleCreateDashboard` L227, `handleSave` L254, `handleDelete` L274, `handleFavorite` L296, `handlePublish` L316, `updateDraft` L336, `addPaletteItem` L340, `removeItem` L362, `moveItem` L379, `flipColumn` L399.

Visible anchors: Dashboard Builder L434, Canvases L482, dialog/title Create dashboard L800, dialog/title Delete dashboard L846, dialog/title Remove dashboard tile L879.

### [apps/web/src/features/builders/ExportBuilderDocxGuidePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderDocxGuidePage.tsx:1) (307 lines)

Components and named handlers: `lintPlaceholders` L43, `ExportBuilderDocxGuidePage` L62, `load` L69.

Visible anchors: Creating an Export Builder DOCX Template L100.

### [apps/web/src/features/builders/ExportBuilderPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderPage.tsx:1) (5 lines)

Components and named handlers: `ExportBuilderPage` L3.

### [apps/web/src/features/builders/ExportBuilderWorkspace.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ExportBuilderWorkspace.tsx:1) (2104 lines)

Components and named handlers: `clone` L108, `formatDate` L112, `flattenFieldCatalog` L116, `exportPayload` L129, `emptyFilterRow` L146, `moduleContextCopy` L155, `reviewActionCopy` L173, `decodeXmlEntities` L219, `xmlToSearchableText` L228, `inflateRaw` L232, `findEndOfCentralDirectory` L241, `extractZipXmlText` L250, `readTemplateContent` L299, `ExportBuilderWorkspace` L315, `loadExports` L348, `loadDetail` L364, `refreshLibraryAndDetail` L464, `handleCreateExport` L472, `handleSave` L495, `handleDuplicate` L515, `handleDelete` L534, `handleAnalyzeTemplate` L554, `handleAutoMap` L590, `handleExportMappings` L609, `handleImportMappings` L628, `handleAddSubTemplate` L661, `handleTest` L689, `updateMapping` L711, `updateSubTemplateMapping` L724, `updateSubTemplate` L744, `handleRemoveSubTemplate` L757, `handleCopyStarterTemplate` L770, `resetFileInputs` L791, `dismissTemplateUploadReview` L803, `confirmTemplateUploadReview` L809, `confirmReviewAction` L824.

Visible anchors: Export Builder L909, Configurations L959, tab `setup` L1058, tab `mappings` L1059, tab `subtemplates` L1060, tab `gallery` L1061, tab `preview` L1062, Analyze placeholders L1199, Appendices and companion sections L1457, Run a test export L1611, dialog/title Create export configuration L1766, dialog/title Import field mappings L1815, dialog/title Delete export configuration L1855, dialog/title Remove sub-template L1889, dialog/title Copy starter template L1937.

### [apps/web/src/features/builders/FormBuilderPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/FormBuilderPage.tsx:1) (5 lines)

Components and named handlers: `FormBuilderPage` L3.

### [apps/web/src/features/builders/FormBuilderWorkspace.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/FormBuilderWorkspace.tsx:1) (2156 lines)

Components and named handlers: `formatDate` L131, `clone` L135, `reorder` L139, `emptyField` L149, `emptySection` L170, `emptyChoice` L182, `emptyValidation` L191, `emptyCondition` L201, `emptyAction` L212, `emptyRule` L225, `severityClass` L236, `isSelectLike` L246, `exportPayload` L252, `FormBuilderWorkspace` L264, `loadModules` L292, `loadDetail` L317, `handleCreateModule` L408, `handleSave` L427, `handleValidate` L448, `handleExport` L473, `handleImportFile` L489, `handleFactoryReset` L515, `updateDraftSection` L536, `updateDraftField` L547, `handleDeleteSection` L561, `handleDeleteField` L580, `updateDraftRule` L595.

Visible anchors: Form Builder L649, Builder Packages L702, tab `builder` L821, tab `rules` L822, Section Layout L831, Embedded Form Automation L1534, dialog/title Remove form section L2017, dialog/title Remove form field L2065, dialog/title Reset factory defaults L2116.

### [apps/web/src/features/builders/QuestionnaireBuilderPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderPage.tsx:1) (9 lines)

Components and named handlers: `QuestionnaireBuilderPage` L7.

### [apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireBuilderWorkspace.tsx:1) (3048 lines)

Components and named handlers: `formatDate` L66, `emptyQuestion` L70, `emptyRule` L86, `instanceActionCopy` L98, `buildDefaultAnswers` L138, `severityClass` L164, `templateKindForWorkspace` L174, `isQuestionnaireTemplate` L184, `workspaceLabels` L188, `QuestionnaireBuilderWorkspace` L263, `loadTemplates` L325, `loadDetail` L339, `refreshInstances` L376, `handleRemoveQuestion` L585, `handleRemoveRule` L602, `handleCreateTemplate` L614, `handleSaveTemplate` L678, `handleSaveRules` L739, `handleRunTest` L763, `applyRuleJsonDraft` L785, `handleValidateRules` L808, `handlePreviewTest` L834, `handleImportTemplate` L863, `handleExportTemplate` L887, `handleCreateAssignment` L900, `handleSaveInstanceResponse` L924, `handleInstanceAction` L947, `handleDeleteInstance` L979, `handleExportInstance` L998.

Visible anchors: tab `overview` L1126, tab `builder` L1127, tab `assignments` L1128, tab `responses` L1129, tab `rules` L1130, tab `tests` L1131, Questionnaire Assignments L2057, Assigned Questionnaires L2115, Visual Rule Graph L2247, tab `visual` L2303, tab `json` L2304, Rules JSON L2476, Run Rule Test L2554, dialog/title Create Questionnaire Assignment L2812, dialog/title Remove rule L2893, dialog/title Delete questionnaire assignment L3004.

### [apps/web/src/features/builders/QuestionnaireOverviewPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireOverviewPage.tsx:1) (9 lines)

Components and named handlers: `QuestionnaireOverviewPage` L7.

### [apps/web/src/features/builders/QuestionnaireResponsePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireResponsePage.tsx:1) (278 lines)

Components and named handlers: `passingTone` L19, `QuestionnaireResponsePage` L23, `loadShell` L37, `validateAccessCode` L52, `saveResponses` L69.

API calls: `GET /builders/questionnaire-access/${shareToken}` L41, `POST /builders/questionnaire-access/${shareToken}/validate` L57, `PUT /builders/questionnaire-access/${shareToken}/responses` L74, `POST /builders/questionnaire-access/${shareToken}/submit` L83.

Visible anchors: dialog/title Submit questionnaire response L242.

### [apps/web/src/features/builders/QuestionnaireRulesEnginePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/QuestionnaireRulesEnginePage.tsx:1) (9 lines)

Components and named handlers: `QuestionnaireRulesEnginePage` L7.

### [apps/web/src/features/builders/ReportBuilderPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderPage.tsx:1) (5 lines)

Components and named handlers: `ReportBuilderPage` L3.

### [apps/web/src/features/builders/ReportBuilderWorkspace.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/ReportBuilderWorkspace.tsx:1) (1517 lines)

Components and named handlers: `clone` L43, `formatDate` L47, `emptyFilterRow` L51, `toggleValue` L60, `addValue` L64, `removeValue` L69, `moveValue` L73, `reportPayload` L84, `ReportBuilderWorkspace` L112, `loadReports` L146, `loadDetail` L162, `updateDraft` L225, `updateConfig` L229, `selectReport` L243, `updateFieldList` L248, `handleCreateReport` L280, `handleSave` L322, `handleDelete` L342, `handlePreview` L365, `handleShare` L383, `handleExport` L405, `handleCreateSubscription` L427, `handleDeleteSubscription` L453.

Visible anchors: Report Builder L484, Definitions L536, dialog/title Create report L1209, dialog/title Record share L1288, dialog/title Create subscription L1327, dialog/title Queue report export L1401, dialog/title Delete report definition L1444, dialog/title Remove subscription L1465.

### [apps/web/src/features/builders/RulesBuilderPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/RulesBuilderPage.tsx:1) (5 lines)

Components and named handlers: `RulesBuilderPage` L3.

### [apps/web/src/features/builders/WayfinderBuilderPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/WayfinderBuilderPage.tsx:1) (5 lines)

Components and named handlers: `WayfinderBuilderPage` L3.

### [apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/WayfinderBuilderWorkspace.tsx:1) (1177 lines)

Components and named handlers: `clone` L40, `formatDate` L44, `reorder` L48, `emptyDocumentationLink` L58, `emptyActivity` L66, `emptyStage` L77, `normalizeImportedStages` L89, `WayfinderBuilderWorkspace` L115, `loadTemplates` L135, `loadDetail` L149, `handleCreateTemplate` L222, `handleSave` L244, `handleDelete` L270, `handleExport` L290, `handleImport` L321.

Visible anchors: Wayfinder Builder L396, Wayfinders L464, Ordered workflow stages L636, dialog/title Delete Wayfinder template L1137.

### [apps/web/src/features/builders/api.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/api.ts:1) (237 lines)

Components and named handlers: `listQuestionnaireTemplates` L16, `createQuestionnaireTemplate` L21, `getQuestionnaireTemplate` L50, `saveQuestionnaireTemplate` L55, `saveQuestionnaireRules` L93, `runQuestionnaireRuleTest` L104, `validateQuestionnaireRules` L118, `previewQuestionnaireRuleTest` L132, `importQuestionnaireTemplate` L148, `exportQuestionnaireTemplate` L156, `listQuestionnaireInstances` L161, `createQuestionnaireAssignment` L168, `saveQuestionnaireInstanceResponses` L194, `runQuestionnaireInstanceAction` L211, `deleteQuestionnaireInstance` L228, `exportQuestionnaireInstance` L232.

API calls: `GET /builders/questionnaires` L17, `POST /builders/questionnaires` L46, `GET /builders/questionnaires/${questionnaireId}` L51, `PUT /builders/questionnaires/${questionnaireId}` L86, `PUT /builders/questionnaires/${questionnaireId}/rules` L100, `POST /builders/questionnaires/${questionnaireId}/test-runs` L111, `POST /builders/questionnaires/${questionnaireId}/validate` L125, `POST /builders/questionnaires/${questionnaireId}/test-preview` L141, `POST /builders/questionnaires/import` L152, `GET /builders/questionnaires/${questionnaireId}/export` L157, `GET /builders/questionnaires/${questionnaireId}/instances` L162, `POST /builders/questionnaires/${questionnaireId}/assignments` L187, `PUT /builders/questionnaires/${questionnaireId}/instances/${instanceId}/responses` L204, `POST /builders/questionnaires/${questionnaireId}/instances/${instanceId}/${action}` L221, `DELETE /builders/questionnaires/${questionnaireId}/instances/${instanceId}` L229, `GET /builders/questionnaires/${questionnaireId}/instances/${instanceId}/export` L233.

### [apps/web/src/features/builders/dashboardApi.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/dashboardApi.ts:1) (51 lines)

Components and named handlers: `listDashboardBuilderDashboards` L6, `createDashboardBuilderDashboard` L11, `getDashboardBuilderDashboard` L20, `saveDashboardBuilderDashboard` L25, `deleteDashboardBuilderDashboard` L39, `favoriteDashboardBuilderDashboard` L43, `publishDashboardBuilderDashboard` L48.

API calls: `GET /builders/dashboards` L7, `POST /builders/dashboards` L16, `GET /builders/dashboards/${dashboardId}` L21, `PUT /builders/dashboards/${dashboardId}` L35, `DELETE /builders/dashboards/${dashboardId}` L40, `POST /builders/dashboards/${dashboardId}/favorite` L44, `POST /builders/dashboards/${dashboardId}/publish` L49.

### [apps/web/src/features/builders/dashboardTypes.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/dashboardTypes.ts:1) (51 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/builders/exportApi.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/exportApi.ts:1) (148 lines)

Components and named handlers: `listExportBuilderConfigs` L15, `createExportBuilderConfig` L30, `getExportBuilderConfig` L38, `saveExportBuilderConfig` L43, `analyzeExportBuilderTemplate` L64, `autoMapExportBuilderConfig` L79, `importExportBuilderMappings` L92, `duplicateExportBuilderConfig` L107, `deleteExportBuilderConfig` L112, `testExportBuilderConfig` L117, `addExportBuilderSubTemplate` L135.

API calls: `GET /builders/exports` L20, `POST /builders/exports` L34, `GET /builders/exports/${exportId}` L39, `PUT /builders/exports/${exportId}` L60, `POST /builders/exports/${exportId}/analyze-template` L72, `POST /builders/exports/${exportId}/auto-map` L85, `POST /builders/exports/${exportId}/import-mappings` L100, `POST /builders/exports/${exportId}/duplicate` L108, `DELETE /builders/exports/${exportId}` L113, `POST /builders/exports/${exportId}/test` L125, `POST /builders/exports/${exportId}/sub-templates` L143.

### [apps/web/src/features/builders/exportTypes.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/exportTypes.ts:1) (143 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/builders/formApi.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/formApi.ts:1) (74 lines)

Components and named handlers: `listFormBuilderModules` L6, `createFormBuilderModule` L11, `getFormBuilderModule` L20, `saveFormBuilderModule` L25, `importFormBuilderModule` L41, `resetFormBuilderModule` L57, `validateFormBuilderModule` L62.

API calls: `GET /builders/forms` L7, `POST /builders/forms` L16, `GET /builders/forms/${moduleId}` L21, `PUT /builders/forms/${moduleId}` L37, `POST /builders/forms/${moduleId}/import` L53, `POST /builders/forms/${moduleId}/reset` L58, `POST /builders/forms/${moduleId}/validate` L69.

### [apps/web/src/features/builders/formRules.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/formRules.ts:1) (335 lines)

Components and named handlers: `normalizeKey` L29, `hasValue` L33, `asComparableValue` L40, `daysFromNow` L50, `dateOnly` L56, `specialValue` L60, `resolveConfiguredValue` L77, `compareValues` L89, `conditionMatches` L137, `buildFieldIndex` L163, `coerceValueForField` L173, `validateFieldValue` L190, `evaluateFormRuntime` L223.

### [apps/web/src/features/builders/formTypes.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/formTypes.ts:1) (158 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/builders/reportApi.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/reportApi.ts:1) (117 lines)

Components and named handlers: `listReportBuilderReports` L12, `createReportBuilderReport` L17, `getReportBuilderReport` L30, `saveReportBuilderReport` L35, `deleteReportBuilderReport` L51, `previewReportBuilderReport` L55, `shareReportBuilderReport` L74, `exportReportBuilderReport` L85, `createReportBuilderSubscription` L94, `deleteReportBuilderSubscription` L110.

API calls: `GET /builders/reports` L13, `POST /builders/reports` L26, `GET /builders/reports/${reportId}` L31, `PUT /builders/reports/${reportId}` L47, `DELETE /builders/reports/${reportId}` L52, `POST /builders/reports/${reportId}/preview` L67, `POST /builders/reports/${reportId}/share` L78, `POST /builders/reports/${reportId}/export` L88, `POST /builders/reports/${reportId}/subscriptions` L103, `DELETE /builders/reports/${reportId}/subscriptions/${subscriptionId}` L114.

### [apps/web/src/features/builders/reportTypes.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/reportTypes.ts:1) (84 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/builders/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/types.ts:1) (219 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/builders/wayfinderApi.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/wayfinderApi.ts:1) (72 lines)

Components and named handlers: `listWayfinderTemplates` L6, `createWayfinderTemplate` L11, `importNewWayfinderTemplate` L22, `getWayfinderTemplate` L33, `saveWayfinderTemplate` L38, `importWayfinderTemplate` L52, `deleteWayfinderTemplate` L69.

API calls: `GET /builders/wayfinders` L7, `POST /builders/wayfinders` L18, `POST /builders/wayfinders/import` L29, `GET /builders/wayfinders/${templateId}` L34, `PUT /builders/wayfinders/${templateId}` L48, `POST /builders/wayfinders/${templateId}/import` L62, `DELETE /builders/wayfinders/${templateId}` L70.

### [apps/web/src/features/builders/wayfinderTypes.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/builders/wayfinderTypes.ts:1) (47 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/iam/AccessPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/AccessPage.tsx:1) (1194 lines)

Components and named handlers: `parsePermissions` L31, `AccessPage` L35, `loadAccessWorkspace` L124, `createRole` L173, `createAssignment` L196, `openEditRole` L218, `updateRole` L228, `deleteRole` L253, `openEditAssignment` L270, `updateAssignment` L283, `deleteAssignment` L310.

API calls: `GET /iam/me` L130, `GET /iam/roles` L131, `GET /iam/role-assignments` L132, `GET /iam/folders` L133, `GET /iam/users` L134, `GET /iam/user-groups` L135, `POST /iam/roles` L178, `POST /iam/role-assignments` L201, `PUT /iam/roles/${role.id}` L238, `DELETE /iam/roles/${role.id}` L258, `PUT /iam/role-assignments/${assignment.id}` L293, `DELETE /iam/role-assignments/${assignment.id}` L315.

Visible anchors: Access Control L339, dialog/title Add role L592, dialog/title Edit role L653, dialog/title Assign role L722, dialog/title Edit assignment L841, dialog/title Delete role L1137, dialog/title Remove assignment L1176.

### [apps/web/src/features/iam/FoldersPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/FoldersPage.tsx:1) (193 lines)

Components and named handlers: `FoldersPage` L8, `loadFolders` L25, `createFolder` L48.

API calls: `GET /iam/folders` L29, `POST /iam/folders` L53.

Visible anchors: Domains & Folders L80.

### [apps/web/src/features/iam/TeamPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/TeamPage.tsx:1) (1379 lines)

Components and named handlers: `TeamPage` L17, `loadWorkspaceTeam` L79, `toggleSelection` L127, `createUser` L139, `createGroup` L174, `openEditUser` L198, `updateUser` L210, `openEditGroup` L232, `updateGroup` L243, `setTemporaryPasswordForUser` L269, `deleteUser` L298, `deleteGroup` L315.

API calls: `GET /iam/users` L84, `GET /iam/user-groups` L85, `GET /iam/folders` L86, `POST /iam/users` L144, `POST /iam/user-groups` L179, `PUT /iam/users/${user.id}` L215, `PUT /iam/user-groups/${group.id}` L253, `POST /core/local-auth/admin-set-password` L280, `DELETE /iam/users/${user.id}` L303, `DELETE /iam/user-groups/${group.id}` L320.

Visible anchors: Team & Groups L342, dialog/title Add team member L601, dialog/title Edit team member L748, dialog/title Set temporary password L871, dialog/title Create group L940, dialog/title Edit group L1029, dialog/title Delete user L1323, dialog/title Delete group L1362.

### [apps/web/src/features/iam/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/iam/types.ts:1) (125 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/imports/ImportsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/imports/ImportsPage.tsx:1) (203 lines)

Components and named handlers: `formatDate` L9, `ImportsPage` L13, `loadImports` L28, `createImport` L52.

API calls: `GET /iam/folders?contentType=domain` L33, `GET /ops/imports` L34, `POST /ops/imports` L57.

Visible anchors: Import Pipelines L82.

### [apps/web/src/features/imports/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/imports/types.ts:1) (31 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/integrations/AutomationManagerPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/AutomationManagerPage.tsx:1) (1125 lines)

Components and named handlers: `formatDate` L102, `prettyCapability` L106, `statusTone` L110, `stringConfig` L124, `booleanConfig` L129, `arrayConfig` L134, `splitScopeLines` L139, `jsonPreview` L146, `DrawerField` L150, `AutomationManagerPage` L159, `loadConnectors` L179, `loadDetail` L193, `handleCreateConnector` L246, `applyConfigDraft` L268, `updateDraftConfig` L283, `updateDraftConfigValue` L293, `updateDraftConfigFromLines` L301, `handleSaveConnector` L305, `handleAction` L336.

Visible anchors: Connectors and Automation L382, Tenant Integrations L415, Connector Config JSON L615, dialog/title Configure provider L732, dialog/title Manage resource scope L830, dialog/title Review secure configuration L913, dialog/title Edit raw config L1021, dialog/title Create connector L1090.

### [apps/web/src/features/integrations/api.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/api.ts:1) (60 lines)

Components and named handlers: `listConnectors` L6, `getConnector` L11, `createConnector` L16, `updateConnector` L27, `testConnector` L44, `syncConnector` L53.

API calls: `GET /integrations/connectors` L7, `GET /integrations/connectors/${connectorId}` L12, `POST /integrations/connectors` L23, `PUT /integrations/connectors/${connectorId}` L40, `POST /integrations/connectors/${connectorId}/test` L47, `POST /integrations/connectors/${connectorId}/sync` L56.

### [apps/web/src/features/integrations/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/integrations/types.ts:1) (43 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/modules/ModuleDirectoryPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/ModuleDirectoryPage.tsx:1) (166 lines)

Components and named handlers: `badgeClass` L13, `ModuleDirectoryPage` L27.

Visible anchors: Tenant Module Directory L80.

### [apps/web/src/features/modules/SharedModuleWorkspacePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/SharedModuleWorkspacePage.tsx:1) (5143 lines)

Components and named handlers: `formatDate` L573, `formatTimestamp` L577, `isoDateOnly` L581, `normalizeText` L588, `humanizeDataKey` L592, `formatRecordValue` L600, `recordDataEntries` L613, `findTitleDataKey` L630, `joinControlRefs` L636, `buildRenderableSections` L643, `isTextAreaField` L708, `isSelectField` L712, `isDateField` L716, `isNumericField` L720, `isBooleanField` L732, `deriveTitleFromData` L736, `deriveStatusFromData` L747, `deriveDateSlots` L758, `createBlankDraft` L816, `buildDraftFromRecord` L841, `buildPayloadFromDraft` L863, `recordDateChips` L885, `moduleRecordHighlights` L895, `moduleWorkspaceMetrics` L2337, `moduleRecordBadges` L3144, `moduleRecordSecondaryText` L3357, `SharedModuleWorkspacePage` L3643, `loadMetadata` L3713, `loadRecords` L3746, `saveRecord` L3835, `archiveRecord` L3878, `updateDraftField` L3906, `updateDraftDataValue` L3921, `addDraftLink` L3936, `updateDraftLink` L3957, `removeDraftLink` L3968, `renderDrawerDraftField` L3979.

API calls: `GET /iam/folders?contentType=domain` L3725.

Visible anchors: What this module manages L4134, Linked records and evidence L4529, Capability posture L4677, Builder and reporting hooks L4694, Program context L4727, Evidence links L4741, Timeline and audit notes L4765, dialog/title Manage relationships L4998, dialog/title Review activity L5079, dialog/title Archive record L5124.

### [apps/web/src/features/modules/api.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/api.ts:1) (67 lines)

Components and named handlers: `listModuleCatalog` L12, `getModuleCatalogEntry` L17, `listModuleRecords` L22, `getModuleRecord` L43, `createModuleRecord` L48, `updateModuleRecord` L53, `archiveModuleRecord` L62.

API calls: `GET /core/modules/catalog` L13, `GET /core/modules/${moduleKey}` L18, `GET /core/modules/${moduleKey}/records${query ? ` L37, `GET /core/modules/${moduleKey}/records/${recordId}` L44, `POST /core/modules/${moduleKey}/records` L49, `POST /core/modules/${moduleKey}/records/${recordId}` L58, `POST /core/modules/${moduleKey}/records/${recordId}/archive` L63.

### [apps/web/src/features/modules/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/modules/types.ts:1) (140 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/ops/AnalyticsControlRoomPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/AnalyticsControlRoomPage.tsx:1) (179 lines)

Components and named handlers: `AnalyticsControlRoomPage` L11.

Visible anchors: Analytics L36, Domain coverage L72, Validation pressure L94, Operational replay L131, Workspace output L155.

### [apps/web/src/features/ops/AppManagementControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/AppManagementControlPage.tsx:1) (310 lines)

Components and named handlers: `toDraft` L20, `AppManagementControlPage` L31, `load` L40, `handleCreate` L72, `handleSave` L91, `handleDuplicate` L113.

Visible anchors: App Management L150, Business-unit partitions L189.

### [apps/web/src/features/ops/BackupRestoreControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/BackupRestoreControlPage.tsx:1) (128 lines)

Components and named handlers: `BackupRestoreControlPage` L5.

Visible anchors: Backup and Restore L23, Recovery posture L73, Validation-linked artifacts L98.

### [apps/web/src/features/ops/CalendarControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/CalendarControlPage.tsx:1) (200 lines)

Components and named handlers: `formatDate` L6, `CalendarControlPage` L10.

Visible anchors: Calendar L38, Scheduled events L89, Operational readiness L145, Deadline context L176.

### [apps/web/src/features/ops/DashboardsControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/DashboardsControlPage.tsx:1) (154 lines)

Components and named handlers: `DashboardsControlPage` L5.

Visible anchors: Dashboards L23, Dashboard metrics L60, Validation-linked recap L91, Diagnostic overlays L127.

### [apps/web/src/features/ops/NewsFeedControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/NewsFeedControlPage.tsx:1) (229 lines)

Components and named handlers: `NewsFeedControlPage` L10, `load` L19.

Visible anchors: News Feed L79, Feed filters L115.

### [apps/web/src/features/ops/ProgramControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/ProgramControlPage.tsx:1) (244 lines)

Components and named handlers: `ProgramControlPage` L12.

Visible anchors: Program Workspace L79, dialog/title Use Program as the operating layer, not just another landing page. L105, Core program areas L156, Discovery paths L187, Readiness context L215.

### [apps/web/src/features/ops/QuickStartControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/QuickStartControlPage.tsx:1) (236 lines)

Components and named handlers: `QuickStartControlPage` L6.

Visible anchors: dialog/title Starter Guide L63, Onboarding L113, Setup summary L198.

### [apps/web/src/features/ops/RMFControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/RMFControlPage.tsx:1) (248 lines)

Components and named handlers: `RMFControlPage` L6, `load` L14, `handleAdvance` L37.

Visible anchors: RMF L70, Authorization packages L109.

### [apps/web/src/features/ops/RegistryControlPages.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/RegistryControlPages.tsx:1) (384 lines)

Components and named handlers: `RegistryControlPage` L37, `AssetsControlPage` L197, `AssetAssessmentsControlPage` L224, `ActorsControlPage` L251, `VulnerabilitiesControlPage` L278, `PoliciesControlPage` L305, `IncidentsControlPage` L332, `SecurityExceptionsControlPage` L359.

Visible anchors: dialog/title Assets L219, dialog/title Asset Assessments L246, dialog/title Actors L273, dialog/title Vulnerabilities L300, dialog/title Policies L327, dialog/title Incidents L354, dialog/title Security Exceptions L381.

### [apps/web/src/features/ops/SearchControlRoomPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/SearchControlRoomPage.tsx:1) (136 lines)

Components and named handlers: `SearchControlRoomPage` L12.

Visible anchors: Search L62, Search index L88.

### [apps/web/src/features/ops/SettingsControlRoomPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/SettingsControlRoomPage.tsx:1) (202 lines)

Components and named handlers: `formatUserId` L5, `SettingsControlRoomPage` L9.

Visible anchors: Settings L29, Identity and runtime L82, Readiness checklist L116, Mapped settings surfaces L149, Searchable admin context L174.

### [apps/web/src/features/ops/SubsystemsControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/SubsystemsControlPage.tsx:1) (221 lines)

Components and named handlers: `SubsystemsControlPage` L13, `load` L21, `handleSelect` L47, `handleTogglePin` L62.

Visible anchors: Subsystems L91, Active tray selection L130.

### [apps/web/src/features/ops/TaskAndMappingControlPages.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/TaskAndMappingControlPages.tsx:1) (365 lines)

Components and named handlers: `statusTone` L29, `formatStatus` L46, `TaskOperationsControlPage` L54, `LibraryMappingsControlPage` L238.

Visible anchors: Library Mapping Surfaces L256, Canonical library operations L306, Mapping discovery L342.

### [apps/web/src/features/ops/UtilitiesControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/UtilitiesControlPage.tsx:1) (247 lines)

Components and named handlers: `UtilitiesControlPage` L10, `load` L22, `handleLaunch` L47.

Visible anchors: Utilities L87, Launch utility L126.

### [apps/web/src/features/ops/ValidationFlowsControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/ValidationFlowsControlPage.tsx:1) (138 lines)

Components and named handlers: `ValidationFlowsControlPage` L5.

Visible anchors: Validation Flows L23, Active validation items L73, Readiness dependencies L110.

### [apps/web/src/features/ops/WorkbenchControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/WorkbenchControlPage.tsx:1) (267 lines)

Components and named handlers: `WorkbenchControlPage` L10, `load` L19.

Visible anchors: Workbench L80, Filters L114.

### [apps/web/src/features/ops/WorkflowControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/WorkflowControlPage.tsx:1) (236 lines)

Components and named handlers: `WorkflowControlPage` L11, `load` L19, `handleAcquireLease` L35, `handleReleaseLease` L55.

Visible anchors: Workflow L84, Lease coordination L123.

### [apps/web/src/features/ops/XRaysControlPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/XRaysControlPage.tsx:1) (185 lines)

Components and named handlers: `formatDate` L5, `XRaysControlPage` L9.

Visible anchors: X-Rays L29, Core x-ray signals L66, Validation flows L96, Upcoming operational dates L134, Backup and replay posture L165.

### [apps/web/src/features/ops/controlApi.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/controlApi.ts:1) (432 lines)

Components and named handlers: `getWorkbenchSnapshot` L285, `getNewsFeedSnapshot` L290, `getWorkflowControlSnapshot` L295, `getUtilitiesControlSnapshot` L300, `launchUtilityRun` L305, `getSubsystemsControlSnapshot` L322, `selectSubsystemPanel` L327, `toggleSubsystemPin` L335, `getRMFControlSnapshot` L346, `advanceRMFPackageHandoff` L351, `getAppManagementControlSnapshot` L358, `createAppManagementApp` L363, `saveAppManagementApp` L375, `duplicateAppManagementApp` L395, `acquireWorkflowLease` L407, `releaseWorkflowLease` L421.

API calls: `GET /ops/workbench` L286, `GET /ops/news-feed` L291, `GET /ops/workflow` L296, `GET /ops/utilities` L301, `POST /ops/utilities/launch` L313, `GET /ops/subsystems` L323, `POST /ops/subsystems/select` L331, `POST /ops/subsystems/${encodeURIComponent(subsystemKey)}/pin` L339, `GET /ops/rmf` L347, `POST /ops/rmf/packages/${encodeURIComponent(packageId)}/handoff` L352, `GET /ops/app-management` L359, `POST /ops/app-management/apps` L366, `PUT /ops/app-management/apps/${encodeURIComponent(appId)}` L386, `POST /ops/app-management/apps/${encodeURIComponent(appId)}/duplicate` L398, `POST /ops/workflow/leases` L411, `POST /ops/workflow/leases/${encodeURIComponent(leaseKey)}/release` L424.

### [apps/web/src/features/ops/useOpsParityOverview.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/ops/useOpsParityOverview.ts:1) (98 lines)

Components and named handlers: `useOpsParityOverview` L74, `refresh` L80.

API calls: `GET /ops/parity/overview` L84.

### [apps/web/src/features/parity/ComplianceNavigatorRouteBridgePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/ComplianceNavigatorRouteBridgePage.tsx:1) (251 lines)

Components and named handlers: `first` L9, `resolveComplianceNavigatorPath` L13, `ComplianceNavigatorRouteBridgePage` L240.

### [apps/web/src/features/parity/LegacyRouteBridgePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/LegacyRouteBridgePage.tsx:1) (130 lines)

Components and named handlers: `LegacyRouteBridgePage` L121.

### [apps/web/src/features/parity/ParityRoutePages.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/ParityRoutePages.tsx:1) (897 lines)

Components and named handlers: `formatDate` L109, `useParityOverviewData` L113, `loadOverview` L119, `PageShell` L139, `LoadingState` L180, `ErrorState` L184, `SummaryStats` L188, `CardGrid` L202, `TimelineList` L229, `SearchWorkspace` L254, `QuickStartWorkspace` L332, `SettingsWorkspace` L375, `BackupWorkspace` L426, `AnalyticsWorkspace` L477, `ParityRoutePage` L509, `AssetsParityPage` L599, `AssetAssessmentsParityPage` L614, `ActorsParityPage` L629, `VulnerabilitiesParityPage` L644, `PoliciesParityPage` L659, `IncidentsParityPage` L674, `SecurityExceptionsParityPage` L689, `AnalyticsParityPage` L704, `SearchParityPage` L719, `BackupRestoreParityPage` L734, `CalendarParityPage` L749, `QuickStartParityPage` L764, `SettingsParityPage` L779, `DashboardsParityPage` L794, `ValidationFlowsParityPage` L809, `XRaysParityPage` L824, `TaskNodesParityPage` L839, `TaskTemplatesParityPage` L854, `LibraryMappingsParityPage` L869, `ProgramParityPage` L884.

API calls: `GET /ops/parity/overview` L123.

Visible anchors: dialog/title Assets L607, dialog/title Asset Assessments L622, dialog/title Actors L637, dialog/title Vulnerabilities L652, dialog/title Policies L667, dialog/title Incidents L682, dialog/title Security Exceptions L697, dialog/title Analytics L712, dialog/title Search L727, dialog/title Backup and Restore L742, dialog/title Calendar L757, dialog/title Quick Start L772, dialog/title Settings L787, dialog/title Dashboards L802, dialog/title Validation Flows L817, dialog/title X-Rays L832, dialog/title Task Nodes L847, dialog/title Task Templates L862.

### [apps/web/src/features/parity/ParityWorkspacePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/ParityWorkspacePage.tsx:1) (338 lines)

Components and named handlers: `formatDate` L99, `ParityWorkspacePage` L103, `loadOverview` L110.

API calls: `GET /ops/parity/overview` L114.

### [apps/web/src/features/parity/SemanticLauncherPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/parity/SemanticLauncherPage.tsx:1) (250 lines)

Components and named handlers: `SemanticLauncherPage` L201.

### [apps/web/src/features/portal/PortalAssignmentDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/portal/PortalAssignmentDetailPage.tsx:1) (496 lines)

Components and named handlers: `formatDate` L17, `resultTone` L21, `PortalAssignmentDetailPage` L35, `loadAssignment` L49, `saveRequirement` L75, `submitAssignment` L95.

API calls: `GET /ops/portal/assignments/${assignmentId}` L59, `POST /ops/portal/assignments/${assignmentId}/requirements/${requirementId}` L84, `POST /ops/portal/assignments/${assignmentId}/submit` L104.

Visible anchors: dialog/title Submit portal assignment L332, dialog/title Save requirement response L432.

### [apps/web/src/features/portal/PortalDashboardPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/portal/PortalDashboardPage.tsx:1) (112 lines)

Components and named handlers: `statusTone` L12, `PortalDashboardPage` L26, `loadAssignments` L32.

API calls: `GET /ops/portal/assignments` L36.

Visible anchors: Auditee Portal L64.

### [apps/web/src/features/portal/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/portal/types.ts:1) (46 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/privacy/PrivacyWorkspacePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/PrivacyWorkspacePage.tsx:1) (1511 lines)

Components and named handlers: `formatDate` L18, `formatDateTime` L22, `formatDateForInput` L26, `formatDateTimeForInput` L30, `toIsoTimestamp` L36, `numericInputValue` L40, `statusTone` L45, `PrivacyWorkspacePage` L62, `loadWorkspace` L150, `processingReference` L192, `openProcessingEdit` L197, `openRequestEdit` L209, `openBreachEdit` L221, `createProcessing` L238, `createRightRequest` L266, `createBreach` L299, `updateProcessing` L332, `updateRightRequest` L359, `updateBreach` L385, `deletePrivacyRecord` L416.

API calls: `GET /iam/folders?contentType=domain` L155, `GET /core/processings` L156, `GET /core/right-requests` L157, `GET /core/data-breaches` L158, `POST /core/processings` L243, `POST /core/right-requests` L272, `POST /core/data-breaches` L305, `PUT /core/processings/${editingProcessing.id}` L338, `PUT /core/right-requests/${editingRequest.id}` L365, `PUT /core/data-breaches/${editingBreach.id}` L391, `DELETE /core/${resource}/${target.id}` L427.

Visible anchors: Privacy Operations L456, dialog/title New processing L680, dialog/title New right request L770, dialog/title New breach record L876, dialog/title Edit processing L1028, dialog/title Edit right request L1175, dialog/title Edit breach record L1332.

### [apps/web/src/features/privacy/ProcessingDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/ProcessingDetailPage.tsx:1) (408 lines)

Components and named handlers: `statusTone` L17, `ProcessingDetailPage` L34, `loadDetail` L54, `openEdit` L73, `updateProcessing` L86, `deleteProcessing` L113.

API calls: `GET /core/processings/${processingId}` L58, `PUT /core/processings/${processing.id}` L92, `DELETE /core/processings/${processing.id}` L118.

Visible anchors: dialog/title Edit processing L325.

### [apps/web/src/features/privacy/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/privacy/types.ts:1) (120 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/reports/DoraReportPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/reports/DoraReportPage.tsx:1) (405 lines)

Components and named handlers: `formatDate` L16, `severityClasses` L20, `formatJson` L33, `reportStatusTone` L37, `replayPayload` L44, `DoraReportPage` L54, `loadPage` L71, `generateExport` L96, `regenerateExport` L117, `deleteExport` L133.

API calls: `GET /ops/reports/dora-roi` L76, `GET /ops/reports/exports` L77, `POST /ops/reports/exports` L101, `POST /ops/reports/exports` L122, `DELETE /ops/reports/exports/${item.id}` L138.

Visible anchors: Register of Information L162, Saved DORA filters L320, Validation summary L326, dialog/title Delete DORA export L358, dialog/title Regenerate DORA export L391.

### [apps/web/src/features/reports/ReportsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/reports/ReportsPage.tsx:1) (357 lines)

Components and named handlers: `formatDate` L16, `formatJson` L20, `reportStatusTone` L24, `replayPayload` L31, `ReportsPage` L41, `loadReports` L53, `handleDeleteExport` L73, `handleReplayExport` L90.

API calls: `GET /ops/reports` L57, `DELETE /ops/reports/exports/${item.id}` L78, `POST /ops/reports/exports` L95.

Visible anchors: Reports and Export Flows L116, Saved filters L270, Summary L276, dialog/title Delete report export L308, dialog/title Regenerate report export L341.

### [apps/web/src/features/reports/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/reports/types.ts:1) (54 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/resilience/BusinessImpactAnalysisDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/resilience/BusinessImpactAnalysisDetailPage.tsx:1) (615 lines)

Components and named handlers: `statusTone` L17, `BusinessImpactAnalysisDetailPage` L31, `loadDetail` L52, `openEdit` L73, `updateAnalysis` L85, `deleteAnalysis` L113.

API calls: `GET /core/business-impact-analyses/${analysisId}` L56, `PUT /core/business-impact-analyses/${analysis.id}` L91, `DELETE /core/business-impact-analyses/${analysis.id}` L118.

Visible anchors: dialog/title Edit business impact analysis L538.

### [apps/web/src/features/resilience/ResiliencePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/resilience/ResiliencePage.tsx:1) (579 lines)

Components and named handlers: `statusTone` L18, `ResiliencePage` L32, `loadWorkspace` L61, `openAnalysisEdit` L85, `createAnalysis` L96, `updateAnalysis` L126, `deleteAnalysis` L151.

API calls: `GET /core/perimeters` L66, `GET /core/business-impact-analyses` L67, `POST /core/business-impact-analyses` L101, `PUT /core/business-impact-analyses/${editingAnalysis.id}` L132, `DELETE /core/business-impact-analyses/${analysisToDelete.id}` L157.

Visible anchors: Business Impact Analysis L178, Business impact studies L234, dialog/title Create business impact analysis L343, dialog/title Edit business impact analysis L500.

### [apps/web/src/features/resilience/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/resilience/types.ts:1) (57 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/setup/BrandingPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/BrandingPage.tsx:1) (340 lines)

Components and named handlers: `BrandingPage` L24, `hydrate` L33, `load` L53, `handleSave` L69.

Visible anchors: Branding L98, Live preview L224, Readiness L256, Runtime contracts L276, dialog/title Save branding L303.

### [apps/web/src/features/setup/ClassificationPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/ClassificationPage.tsx:1) (332 lines)

Components and named handlers: `exportCsv` L19, `ClassificationPage` L38, `load` L49, `handleSubmit` L65, `handleDelete` L84.

Visible anchors: Classification L125, Coverage by level L217, dialog/title Delete classification L294.

### [apps/web/src/features/setup/EmailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/EmailPage.tsx:1) (263 lines)

Components and named handlers: `EmailPage` L10, `hydrate` L22, `load` L30, `handleSave` L46.

Visible anchors: Email L80, Runtime sender identity L164, Recent delivery events L194, Guidance L220, dialog/title Save email setup L247.

### [apps/web/src/features/setup/GeneralPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/GeneralPage.tsx:1) (317 lines)

Components and named handlers: `toggleDay` L37, `GeneralPage` L41, `hydrate` L50, `load` L67, `handleSave` L83.

Visible anchors: General L112, Operating defaults L230, Coordination signals L246, Downstream effects L266, dialog/title Save general settings L293.

### [apps/web/src/features/setup/LogsUtilizationPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/LogsUtilizationPage.tsx:1) (151 lines)

Components and named handlers: `LogsUtilizationPage` L8.

Visible anchors: Logs and Utilization L46, Volume summary L70.

### [apps/web/src/features/setup/MFAPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/MFAPage.tsx:1) (299 lines)

Components and named handlers: `MFAPage` L10, `hydrate` L24, `load` L34, `handleSave` L50.

Visible anchors: Multi-Factor Authentication L89, Coverage guidance L206, Recommendations L227, Current posture L241, dialog/title Save MFA policy L265.

### [apps/web/src/features/setup/ModulesFeaturesPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/ModulesFeaturesPage.tsx:1) (343 lines)

Components and named handlers: `toggleId` L7, `ModulesFeaturesPage` L11, `hydrate` L24, `load` L33, `handleSave` L49, `toggleModule` L71, `toggleFeature` L75.

Visible anchors: Modules and Features L105, RegML readiness L213, Readiness signals L260, Operator note L284, dialog/title Save modules and features L315.

### [apps/web/src/features/setup/RiskModelPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/RiskModelPage.tsx:1) (331 lines)

Components and named handlers: `RiskModelPage` L30, `hydrate` L39, `load` L58, `handleSave` L74.

Visible anchors: Risk Model L103, Governance signals L230, Threshold bands L250, Runtime contracts L268, dialog/title Save risk model L295.

### [apps/web/src/features/setup/SSOPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/SSOPage.tsx:1) (506 lines)

Components and named handlers: `SSOPage` L16, `hydrate` L41, `load` L62, `handleSave` L93.

Visible anchors: Single sign-on L146, Provider readiness L402, Cutover checklist L422, Provider examples L436, dialog/title Save SSO settings L476.

### [apps/web/src/features/setup/SecurityPosturePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/SecurityPosturePage.tsx:1) (294 lines)

Components and named handlers: `SecurityPosturePage` L16, `load` L25, `updateControl` L45, `queueControlUpdate` L69, `dismissPendingUpdate` L79.

Visible anchors: Security L101, Cloudflare control layers L208, Access layers L227, Architecture notes L239, dialog/title Update security control L273.

### [apps/web/src/features/setup/ServiceAccountsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/ServiceAccountsPage.tsx:1) (416 lines)

Components and named handlers: `ServiceAccountsPage` L18, `load` L31, `handleCreate` L47, `handleRotate` L65, `handleDelete` L84, `copyToken` L99.

Visible anchors: Service Accounts L121, dialog/title Issue service account token L295, dialog/title Rotate service account L341, dialog/title Deactivate service account L389.

### [apps/web/src/features/setup/TagsPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/TagsPage.tsx:1) (282 lines)

Components and named handlers: `TagsPage` L13, `load` L24, `handleSubmit` L40, `handleDelete` L61.

Visible anchors: Tags L93, dialog/title Delete tag L245.

### [apps/web/src/features/setup/api.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/api.ts:1) (290 lines)

Components and named handlers: `getSetupTags` L19, `createSetupTag` L24, `updateSetupTag` L33, `deleteSetupTag` L45, `getSetupServiceAccounts` L50, `createSetupServiceAccount` L55, `rotateSetupServiceAccount` L64, `deleteSetupServiceAccount` L77, `getSetupLogsUtilization` L84, `getSetupSecurity` L89, `updateSetupSecurityControl` L94, `getSetupModulesFeatures` L107, `updateSetupModulesFeatures` L112, `getSetupSso` L123, `updateSetupSso` L128, `getSetupMfa` L151, `updateSetupMfa` L156, `getSetupEmail` L168, `updateSetupEmail` L173, `getSetupClassification` L183, `createSetupClassification` L188, `updateSetupClassification` L198, `deleteSetupClassification` L214, `getSetupBranding` L221, `updateSetupBranding` L226, `getSetupGeneral` L246, `updateSetupGeneral` L251, `getSetupRiskModel` L268, `updateSetupRiskModel` L273.

API calls: `GET /setup/tags` L20, `POST /setup/tags` L29, `PUT /setup/tags/${tagId}` L41, `DELETE /setup/tags/${tagId}` L46, `GET /setup/service-accounts` L51, `POST /setup/service-accounts` L60, `POST /setup/service-accounts/${accountId}/rotate` L70, `DELETE /setup/service-accounts/${accountId}` L78, `GET /setup/logs-utilization` L85, `GET /setup/security` L90, `PUT /setup/security/${controlId}` L103, `GET /setup/modules-features` L108, `PUT /setup/modules-features` L119, `GET /setup/sso` L124, `PUT /setup/sso` L147, `GET /setup/mfa` L152, `PUT /setup/mfa` L164, `GET /setup/email` L169, `PUT /setup/email` L179, `GET /setup/classification` L184, `POST /setup/classification` L194, `PUT /setup/classification/${classificationId}` L207, `DELETE /setup/classification/${classificationId}` L215, `GET /setup/branding` L222, `PUT /setup/branding` L242, `GET /setup/general` L247, `PUT /setup/general` L264, `GET /setup/risk-model` L269, `PUT /setup/risk-model` L288.

### [apps/web/src/features/setup/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/setup/types.ts:1) (373 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/tprm/EntityDetailPage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/tprm/EntityDetailPage.tsx:1) (1125 lines)

Components and named handlers: `formatDate` L31, `formatMoney` L35, `statusTone` L47, `openReference` L61, `nullableText` L66, `optionalInteger` L71, `optionalAmount` L78, `splitReferences` L85, `DetailRow` L92, `FormField` L103, `EntityDetailPage` L120, `loadDetail` L132, `setDraftField` L155, `openEdit` L159, `saveEdit` L222.

API calls: `GET /core/entities/${entityId}` L138, `PUT /core/entities/${detail.entity.id}` L235, `PUT /core/solutions/${editItem.item.id}` L251, `PUT /core/contracts/${editItem.item.id}` L271.

### [apps/web/src/features/tprm/TprmWorkspacePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/tprm/TprmWorkspacePage.tsx:1) (842 lines)

Components and named handlers: `formatDate` L59, `formatMoney` L63, `statusTone` L75, `TprmWorkspacePage` L89, `loadWorkspace` L179, `createEntity` L230, `createSolution` L258, `createContract` L285.

API calls: `GET /iam/folders?contentType=domain` L185, `GET /core/entities` L186, `GET /core/solutions` L187, `GET /core/contracts` L188, `GET /core/entity-assessments` L189, `POST /core/entities` L235, `POST /core/solutions` L263, `POST /core/contracts` L291.

Visible anchors: Third-Party Management L328, dialog/title Review vendor import staging L488, dialog/title Bulk review vendor coverage L553, dialog/title New entity L611, dialog/title New solution L678, dialog/title New contract L752.

### [apps/web/src/features/tprm/types.ts](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/tprm/types.ts:1) (125 lines)

Schema/type support; inspect file for the complete declared contract.

### [apps/web/src/features/vanta/VantaAdditionalScreens.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaAdditionalScreens.tsx:1) (3652 lines)

Components and named handlers: `VantaWordmark` L79, `Glyph` L83, `MiniCheckbox` L87, `Toggle` L91, `FlatPill` L99, `Tag` L116, `GhostButton` L120, `PurpleButton` L136, `WorkspaceButton` L144, `FlatTopbar` L154, `WorkspaceMenu` L187, `FlatSidebar` L237, `FlatShell` L326, `SimpleVantaShell` L360, `BarePage` L392, `StarterGuideScreen` L412, `PolicyBuilderScreen` L506, `PoliciesListScreen` L599, `PeopleTaskStatusScreen` L692, `TestsOverviewScreen` L795, `TestDetailScreen` L906, `ScopeTabs` L1052, `FrameworkScopeScreen` L1074, `IntegrationScopeConfigScreen` L1113, `InventoryScopeScreen` L1160, `PrivacyPeopleScopeScreen` L1249, `ScopeSettingsScreen` L1308, `AuditModalScreen` L1334, `ProgramHealthTable` L1406, `ProgressCard` L1468, `ConsoleProgramHealthScreen` L1485, `ConsoleHomeScreen` L1502, `ConsoleHomeTooltipScreen` L1530, `NotificationsSettingsScreen` L1548, `IntegrationsCatalogScreen` L1620, `testing` L1694, `ControlsBaseContent` L1698, `ControlsOverviewScreen` L1763, `ControlsUploadScreen` L1771, `ControlsImportReviewScreen` L1812, `HomeWelcomeScreen` L1857, `FrameworkCards` L1896, `FrameworksCatalogScreen` L1909, `FrameworkImportModalScreen` L1925, `FrameworkDetailScreen` L1955, `FrameworkUploadBackground` L1991, `FrameworkUploadScreen` L2020, `FrameworkImportReviewScreen` L2071, `SuggestionCard` L2145, `FrameworkControlDrawerScreen` L2187, `TestsDashboardChrome` L2257, `CustomTestModalScreen` L2403, `CustomTestsFilteredScreen` L2444, `JiraTestContent` L2448, `JiraTestDetailScreen` L2486, `AddTestToControlModalScreen` L2490, `DocumentsListContent` L2551, `DocumentsListScreen` L2622, `NewCustomDocumentScreen` L2630, `DocumentDetailContent` L2686, `of` L2736, `DocumentDetailScreen` L2757, `AddDocumentToControlModalScreen` L2761, `DocumentUploadScreen` L2813, `DocumentUploadDetailsModalScreen` L2847, `EditCustomDocumentRequestScreen` L2886, `PolicyTemplatesScreen` L2925, `PolicyEditorScreen` L2948, `AssignApproverModalScreen` L2990, `PolicyReacceptModalScreen` L3030, `PolicyVersionShell` L3071, `PolicyVersionEmptyScreen` L3079, `PolicyCreateVersionScreen` L3089, `PolicyUploadVersionScreen` L3131, `PolicySyncConfluenceScreen` L3152, `CreateCustomPolicyScreen` L3175, `CustomPolicyDetailContent` L3213, `CustomPolicyDetailScreen` L3273, `EmployeeAssignmentModalScreen` L3277, `ThirdPartyPolicyContent` L3322, `AddControlsModalScreen` L3344, `TestDeactivateMenuScreen` L3377, `DeactivatedTestsScreen` L3399, `over` L3430, `RiskLibraryContent` L3437, `RiskLibraryScreen` L3451, `AddRiskScenarioModalScreen` L3459, `UsersTable` L3497, `UsersPageChrome` L3538, `UsersAccessScreen` L3589.

Visible anchors: Company L191, Workspace L201, Starter Guide L422, Onboarding L442, Connect your first integrations L453, Set up policies L470, Policy Builder: Code of Conduct L523, Who owns this policy? L529, When should this policy go into effect? L536, Code of Conduct L551, Policies L604, People L696, Tests passing L802, Automated tests L812, Documents L819, Tests that need attention L829, Inventory items have active owners L886, Inventory items have active owners L922, Test results L959, Status L1023, Frameworks L1028, Configurable integrations L1083, Addigy L1131, Assets L1138, Autoscale groups L1166, STANDARD L1177, Australian Privacy Principles L1254, People L1276, Scope Settings L1312, Audits L1339, SOC 2 Type II L1347, Add a new audit L1361, Define audit scope L1362, Control and evidence status L1422, Amalgamated Widgets controls L1450, Program health L1489, Framework progress L1491, dialog/title SOC 2 progress L1493, dialog/title ISO 27001:2022 progress L1494, dialog/title HIPAA progress L1495, Home L1506, Compliance progress L1516, dialog/title SOC 2 L1520, dialog/title ISO 27001:2022 L1521, dialog/title HIPAA L1522, Home L1534, Program health L1535, Framework progress L1537, dialog/title SOC 2 progress L1539, dialog/title ISO 27001:2022 progress L1540, dialog/title HIPAA progress L1541, Notifications L1552, Company L1555, My account L1561, Schedule L1570, Allow notifications L1573, Personnel reminders L1586, Frequency L1592, External notifications L1603, Recommended for you L1668, Controls L1702, Assignment L1710, Completion L1719, Upload a File L1780, Required columns L1786, Optional columns L1790, What data do you want to upload? L1802, Review & finalize L1821, Home L1861, Welcome to Vanta! L1864, Frameworks L1914, Frameworks L1930, Import custom framework L1936, Requirement categories L1965, Completion L1968, Audit timeline L1969, Parent Section Name - 1 L1973, CHILD-1 Child Section Name - 1 -&gt; L1976, Frameworks L1996, Required columns L2039, Optional columns L2046, What data do you want to upload? L2059, This is a test summary L2196, dialog/title Tests L2219, dialog/title Documents L2228, Category L2310, Deactivated L2317, Create a custom test L2410, dialog/title Tests: Custom L2445, No related controls L2477, Add test to control L2497, Controls L2513, Manage 2.3 L2522, Description L2530, Domain L2532, Frameworks L2534, Related sections L2536, Documents: All L2555, Category L2567, New custom document L2639, Add a new document L2716, Details L2731, Description L2735, Time sensitivity &amp; recurrence L2738, Add note (optional) L2742, Add document to control L2768, Controls L2784, Job Scheduling Access L2794, Description L2802, Add a new document L2831, Search_Searches_default_01242023_1351.xlsx L2854, Edit custom document request L2893, Assign an approver L2997, Do you want employees to reaccept Anti-Discrimination and Harassment Policy after it is approved? L3037, Create a new version L3093, Upload a file L3135, Drag &amp; drop new document L3142, Sync from Confluence L3156, Create new policy L3182, Custom policy test creation L3191, Draft L3229, Details L3255, Description L3259, Time sensitivity &amp; recurrence L3261, Employee assignment L3284, Add controls L3356, User endpoint devices L3362, Description L3366, Domain L3367, Frameworks L3368, Related sections L3369, Company has an approved Asset Management Policy L3382, Tests L3411, Category L3413, Vanta risk library L3440, Add risk scenario L3467, Users L3551, Add user L3621, Access L3623.

### [apps/web/src/features/vanta/VantaClonePage.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:1) (2114 lines)

Components and named handlers: `VantaLogo` L510, `WorkspaceSelector` L514, `Topbar` L526, `Shell` L565, `Sidebar` L589, `Tabs` L662, `StatusPill` L688, `getInitials` L705, `avatarBackground` L714, `AskVantaBubble` L725, `VendorReviewScreen` L734, `AiExtractionPanel` L882, `CommitmentCard` L907, `CommitmentsScreen` L950, `PeopleScreen` L1023, `PolylineChart` L1116, `FrameworkLineChart` L1150, `AuditTimelineChart` L1181, `OwnersChart` L1208, `PassingCategoryChart` L1253, `ComplianceReportScreen` L1287, `RiskScoresChart` L1345, `InherentRiskBars` L1373, `Heatmap` L1428, `RiskReportScreen` L1483, `CompactShell` L1544, `QuestionnaireScreen` L1576, `AuditTracker` L1662, `AuditCard` L1703, `AuditsScreen` L1746, `DocumentSidebar` L1792, `DocumentsScreen` L1849, `VantaClonePage` L1969.

Visible anchors: TaskNimbus security review L743, Documentation L765, Questionnaire L807, 9. Data Protection and Security L892, 9.1 Vulnerability Notice L893, 9.2 Security Incident Notification L898, dialog/title Security incident and breach notice L969, dialog/title Data deletion and return L977, dialog/title Subprocessor change notice L985, dialog/title Customer right to audit L993, Security incident and breach notice L1003, People L1040, Compliance report L1292, Framework progress L1303, Upcoming audits L1307, Top test owners as of today L1311, Tests passing by category L1315, Program task completion L1321, Risk report L1488, Risk scores L1490, Inherent risk over time L1495, Inherent risk as of today L1499, Untimely notification in delays in breach response L1505, TaskNimbus L1584, Vanta Agent L1639, Timeline L1727, Audits L1751, dialog/title SOC 2 Type II L1753, dialog/title ISO 27001 L1754, Add a new audit L1757, Define audit scope L1759, Proof of completed access review L1859, Vanta Agent L1935, Summary: L1941, Scope of review: L1945, Findings and remediation instructions: L1950.

### [apps/web/src/components/regovise/PagePrimitives.tsx](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/components/regovise/PagePrimitives.tsx:1) (324 lines)

Components and named handlers: `RegPageHeader` L39, `RegTabs` L83, `RegFilterBar` L127, `RegTableShell` L139, `RegStatusPill` L155, `RegActionMenu` L178, `RegModal` L233, `RegRightDrawer` L256, `RegMobileSheet` L284, `RegDrawerCloseButton` L312.

### All Vanta clone routes

| Screen | URL | Source |
| --- | --- | --- |
| vendor | `/vanta-clone/vendors` | [route table:186](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:186) |
| starterGuide | `/vanta-clone/starter-guide` | [route table:187](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:187) |
| commitments | `/vanta-clone/customer-trust/commitments` | [route table:188](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:188) |
| people | `/vanta-clone/personnel/people` | [route table:189](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:189) |
| peopleTasks | `/vanta-clone/personnel/people/tasks` | [route table:190](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:190) |
| complianceReport | `/vanta-clone/reports/compliance` | [route table:191](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:191) |
| riskReport | `/vanta-clone/reports/risk` | [route table:192](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:192) |
| questionnaire | `/vanta-clone/questionnaires/tasknimbus` | [route table:193](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:193) |
| audits | `/vanta-clone/compliance/audits` | [route table:194](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:194) |
| auditModal | `/vanta-clone/compliance/audits/new` | [route table:195](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:195) |
| documents | `/vanta-clone/compliance/documents` | [route table:196](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:196) |
| policies | `/vanta-clone/compliance/policies` | [route table:197](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:197) |
| policyBuilder | `/vanta-clone/compliance/policies/code-of-conduct` | [route table:198](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:198) |
| thirdPartyPolicy | `/vanta-clone/compliance/policies/third-party-management` | [route table:199](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:199) |
| addControlsModal | `/vanta-clone/compliance/policies/third-party-management/add-controls` | [route table:200](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:200) |
| testsOverview | `/vanta-clone/tests` | [route table:201](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:201) |
| testDetail | `/vanta-clone/tests/inventory-owners` | [route table:202](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:202) |
| testDeactivateMenu | `/vanta-clone/tests/asset-management-policy/deactivate` | [route table:203](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:203) |
| deactivatedTests | `/vanta-clone/tests/deactivated` | [route table:204](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:204) |
| controlsOverview | `/vanta-clone/controls` | [route table:205](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:205) |
| controlsUpload | `/vanta-clone/controls/upload` | [route table:206](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:206) |
| controlsReview | `/vanta-clone/controls/review-finalize` | [route table:207](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:207) |
| frameworksCatalog | `/vanta-clone/frameworks` | [route table:208](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:208) |
| frameworkImport | `/vanta-clone/frameworks/import` | [route table:209](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:209) |
| frameworkUpload | `/vanta-clone/frameworks/upload` | [route table:210](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:210) |
| frameworkReview | `/vanta-clone/frameworks/review-finalize` | [route table:211](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:211) |
| frameworkDetail | `/vanta-clone/frameworks/test-framework/controls` | [route table:212](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:212) |
| frameworkControlDrawer | `/vanta-clone/frameworks/test-framework/controls/drawer` | [route table:213](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:213) |
| frameworkScope | `/vanta-clone/frameworks/esg-demo/scope` | [route table:214](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:214) |
| integrationScope | `/vanta-clone/frameworks/esg-demo/scope/addigy` | [route table:215](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:215) |
| inventoryScope | `/vanta-clone/inventory/autoscale-groups` | [route table:216](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:216) |
| privacyPeopleScope | `/vanta-clone/frameworks/australian-privacy-principles/people` | [route table:217](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:217) |
| scopeSettings | `/vanta-clone/frameworks/australian-privacy-principles/scope-settings` | [route table:218](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:218) |
| consoleProgram | `/vanta-clone/console/program-health` | [route table:219](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:219) |
| consoleHome | `/vanta-clone/console/home` | [route table:220](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:220) |
| consoleHomeTooltip | `/vanta-clone/console/home-tooltip` | [route table:221](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:221) |
| homeWelcome | `/vanta-clone/home/welcome` | [route table:222](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:222) |
| notificationsSettings | `/vanta-clone/settings/notifications` | [route table:223](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:223) |
| integrations | `/vanta-clone/integrations` | [route table:224](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:224) |
| riskLibrary | `/vanta-clone/risk/library` | [route table:225](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:225) |
| addRiskScenario | `/vanta-clone/risk/register/add-scenario` | [route table:226](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:226) |
| users | `/vanta-clone/users` | [route table:227](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:227) |
| usersAdd | `/vanta-clone/users/add` | [route table:228](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:228) |
| usersSelected | `/vanta-clone/users/selected` | [route table:229](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:229) |
| usersPlain | `/vanta-clone/users/plain` | [route table:230](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:230) |
| customTestModal | `/vanta-clone/tests/custom/new` | [route table:231](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:231) |
| customTestsFiltered | `/vanta-clone/tests/custom` | [route table:232](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:232) |
| jiraTestDetail | `/vanta-clone/tests/jira-test` | [route table:233](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:233) |
| addTestControl | `/vanta-clone/tests/jira-test/add-control` | [route table:234](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:234) |
| documentsList | `/vanta-clone/compliance/documents/all` | [route table:235](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:235) |
| newDocument | `/vanta-clone/compliance/documents/new` | [route table:236](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:236) |
| addDocumentControl | `/vanta-clone/compliance/documents/new-control` | [route table:237](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:237) |
| addDocumentControlSelected | `/vanta-clone/compliance/documents/new-control-selected` | [route table:238](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:238) |
| documentUpload | `/vanta-clone/compliance/documents/upload` | [route table:239](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:239) |
| documentUploadDetails | `/vanta-clone/compliance/documents/upload/details` | [route table:240](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:240) |
| documentDetail | `/vanta-clone/compliance/documents/board-charter` | [route table:241](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:241) |
| documentDetailMore | `/vanta-clone/compliance/documents/board-charter/more` | [route table:242](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:242) |
| editDocumentRequest | `/vanta-clone/compliance/documents/edit-custom-request` | [route table:243](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:243) |
| policyTemplates | `/vanta-clone/compliance/policies/templates` | [route table:244](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:244) |
| policyEditor | `/vanta-clone/compliance/policies/access-control/editor` | [route table:245](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:245) |
| assignApprover | `/vanta-clone/compliance/policies/access-control/approver` | [route table:246](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:246) |
| policyReaccept | `/vanta-clone/compliance/policies/access-control/reaccept` | [route table:247](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:247) |
| policyVersionEmpty | `/vanta-clone/compliance/policies/access-control/version-empty` | [route table:248](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:248) |
| policyCreateVersion | `/vanta-clone/compliance/policies/access-control/version` | [route table:249](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:249) |
| policyUploadVersion | `/vanta-clone/compliance/policies/access-control/upload-version` | [route table:250](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:250) |
| policySyncConfluence | `/vanta-clone/compliance/policies/access-control/sync-confluence` | [route table:251](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:251) |
| createCustomPolicy | `/vanta-clone/compliance/policies/new-custom` | [route table:252](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:252) |
| customPolicyDetail | `/vanta-clone/compliance/policies/help-center-review` | [route table:253](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:253) |
| employeeAssignment | `/vanta-clone/compliance/policies/help-center-review/employee-assignment` | [route table:254](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web/src/features/vanta/VantaClonePage.tsx:254) |

### Complete extended-scope coverage

108 TypeScript/TSX files indexed; 52,241 source lines, plus Vanta CSS. 69 literal Vanta screen routes. This appendix indexes all files in the named feature directories, including older unmounted source components. Function/anchor L-numbers are one-based lines in each linked file. API calls are extracted only from `client.get/post/put/patch/delete` invocations; navigation URLs are not mislabeled as service endpoints.
