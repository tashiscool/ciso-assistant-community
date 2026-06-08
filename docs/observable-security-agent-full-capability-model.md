# Observable Security Agent Full Capability Model

## Operating definition

Observable Security Agent (OSA) is the evidence/artifact producer. Regovise is the reviewer, approval, package, and operations workspace.

OSA must act as:

- Evidence collector: collect live AWS evidence and ingest scanner, ticket, tracker, graph, Azure export, and GCP export inputs without mutating external systems.
- Normalizer: convert source-specific records into canonical findings, evidence references, confidence summaries, and rejection diagnostics.
- Deterministic evaluator: derive PASS, FAIL, PARTIAL, and unavailable states from evidence artifacts only.
- Package builder: emit FedRAMP 20x-style package artifacts, validation manifests, reports, and package links.
- Reconciliation engine: compare package/report claims against machine-readable evidence and record drift or missing evidence.
- Grounded explainer: explain the deterministic evidence chain without inventing evidence or deciding PASS/FAIL.
- Bounded writeback drafter: draft Jira, ServiceNow, GitHub, Slack, email, cloud, or ticket payloads locally. Jira create/comment/link/transition can be dispatched only after Regovise approval through an enabled Jira connector; the other external systems remain draft/export-only.
- Regovise-reviewable audit actor: emit `agent_run_manifest.json` plus artifact payloads so every action, policy decision, blocked action, review gate, and writeback draft is inspectable.

## Stable handoff contract

The stable handoff contract remains `agent_run_manifest.json` plus optional artifact payloads.

Required manifest fields:

- `schema_version`
- `producer.name = observable-security-agent`
- `run_id`
- `workflow_name`
- `status`
- `manifest_completeness`
- `artifact_families`
- `policy_decisions`
- `review_gates`
- `blocked_actions`
- `writeback_requests`
- `package_links`

Every artifact family must either be available or explicitly marked `not_applicable` with a reason. Silent missing previews are a product bug.

## Artifact families

OSA should produce or explicitly explain these families:

- `trace_json`
- `summary_markdown`
- `task_graph`
- `workflow_memory`
- `blocked_actions`
- `writeback_requests`
- `agent_eval_results`
- `agent_risk_report`
- `agent_poam`
- `agent_instrumentation_plan`
- `secure_agent_architecture`
- `normalized_findings`
- `threat_hunt_findings`
- `draft_tickets`
- `twenty_x_package`
- `package_manifest`
- `reconciliation_results`
- `source_confidence`
- `rejection_diagnostics`
- `live_collection_coverage`
- `package_links`
- `reconciliation_links`
- `ticket_system_inventory`
- `ticket_process_coverage`
- `jira_write_intents`
- `jira_write_results`

## Regovise surface map

| OSA capability | Regovise surface | Reviewer job |
|---|---|---|
| Evidence collector | Evidence Explorer | Confirm source, scope, coverage, and redaction status. |
| Normalizer | Evidence Explorer and Agent Run Inspector | Inspect normalized findings, source badges, confidence, and rejected records. |
| Deterministic evaluator | Overview and Agent Run Inspector | Verify PASS/FAIL/PARTIAL is evidence-derived. |
| Package builder | Package Explorer | Review package parity, package links, and generated report state. |
| Reconciliation engine | Package Explorer and Workflow panel | Inspect drift, missing evidence, stale reports, and package/report mismatch. |
| Grounded explainer | Agent Run Inspector explanation panel | Ask explanatory questions while keeping deterministic artifacts authoritative. |
| Bounded writeback drafter | Review Queue and Agent Run Inspector | Approve draft, reject draft, request more evidence, mark duplicate, or export payload. |
| Audit actor | Workflow panel | Track import, review, approval, rejection, duplicate, and evidence-request events. |

## Writeback lifecycle

All writebacks imported from OSA start in `pending` state. Jira-specific imported intents use the canonical `jira_write_intents` artifact family. Regovise preserves them as pending writebacks, validates them with `jira:dry_run`, and records any approved dispatch as connector-run evidence.

Allowed reviewer decisions:

- `approve`: records approval evidence. Jira still requires a separate `dispatch-jira` action before external dispatch.
- `reject`: records rejection evidence.
- `request_more_evidence`: records that more evidence is needed before action.
- `duplicate`: records that the draft is already covered elsewhere.
- `export`: returns the local draft payload for review or manual handling.
- `dispatch-jira`: dispatches an approved Jira writeback through an enabled Jira connector after dry-run validation.

Forbidden in this plan:

- Jira write without an approved Regovise writeback and enabled Jira connector
- ServiceNow write
- GitHub issue or PR write
- Slack or email send
- Cloud mutation
- Permission change
- Destructive change
- Any dispatch without an explicit human-approved integration decision

## Capability readiness checklist

| Capability | Fixture-ready | Live-ready | Import-ready | Reviewer-ready | Notes |
|---|---:|---:|---:|---:|---|
| Competition demo harness | yes | n/a | yes | yes | `make competition-demo` remains credential-free and deterministic. |
| AWS live collection summary | yes | yes | yes | yes | Live summaries are redacted and written outside committed sample folders by default. |
| Azure export ingestion | yes | export only | yes | partial | No live Azure collection or mutation in this plan. |
| GCP export ingestion | yes | export only | yes | partial | No live GCP collection or mutation in this plan. |
| Scanner import confidence | yes | import only | yes | yes | Source badges and rejected-row diagnostics should accompany normalized outputs. |
| Ticket/tracker import confidence | yes | import only | yes | yes | Dialect confidence and rejected rows should stay visible. |
| Inventory graph import | yes | import only | yes | yes | Graph confidence should feed evidence and package context. |
| Deterministic evals | yes | yes | yes | yes | LLMs may explain but do not decide PASS/FAIL. |
| 20x package generation | yes | yes | yes | yes | Package links are imported into Regovise summary and preview records. |
| Reconciliation | yes | yes | yes | yes | Reconciliation links should refresh after review decisions. |
| Agent trace and memory | yes | yes | yes | yes | Trace, task graph, workflow memory, blocked actions, and review gates are first-class artifacts. |
| Writeback drafts | yes | yes | yes | yes | Draft lifecycle implemented; Jira dispatch is approval-gated and connector-run audited. |

## Acceptance criteria

- OSA manifest completeness is true when every required family exists or is explicitly not applicable.
- `make competition-demo` fails if required families are unavailable without reason.
- Regovise import persists all available previews and explicit unavailable preview records.
- Agent Run Inspector shows proof chain, artifact families, source confidence, rejected records, live coverage, policy decisions, blocked actions, memory/artifact previews, review gates, and writeback drafts.
- Approval decisions create review evidence and never dispatch externally.
