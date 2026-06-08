# Observable Security Agent import contract

Regovise imports Observable Security Agent runs through:

```http
POST /agent/runs/import-observable
```

The request body accepts:

- `manifest`: required OSA `agent_run_manifest.json` payload.
- `trace`: optional OSA trace payload.
- `artifacts`: optional artifact previews keyed by artifact family or preview name.
- `folderId`: optional Regovise scope target.

## Persistence expectations

Regovise persists an agent run, normalized trace, artifact previews, policy decisions, review gates, blocked actions, pending writeback approvals, and imported Jira write intents when `jira_write_intents` is present. Missing artifact payloads are allowed and should show as unavailable previews instead of failing the import.

## Safety expectations

Writebacks stay pending/draft-only during import. Regovise must not dispatch Jira, ServiceNow, GitHub, cloud, email, Slack, or ticket writes during import. Jira dispatch is supported only after a tenant administrator approves the writeback and calls `POST /agent/writebacks/:id/dispatch-jira` through an enabled Jira ticketing connector. ServiceNow, GitHub, cloud, email, Slack, and arbitrary ticket writes remain draft/export-only in this implementation.

## Jira connector write lifecycle

- `POST /agent/connectors/jira/test` verifies an enabled Jira Server-compatible connector using `serverInfo`, `myself`, `project`, and `createmeta`.
- `POST /agent/connectors/jira/import-tickets` performs read-only Jira JQL ingestion and returns ticket inventory, process coverage, evidence matrix, confidence, and rejection diagnostics artifacts.
- `POST /agent/connectors/jira/dry-run` validates one canonical Jira write intent against connector capabilities and allowlists without POSTing to Jira.
- `POST /agent/writebacks/:id/approve` records the human approval decision.
- `POST /agent/writebacks/:id/dispatch-jira` performs create/comment/link/transition only for `approved` or retryable `dispatch_failed` writebacks.
- Every Jira dispatch creates an `integration_connector_runs` evidence row and stores the run id on `assurance_writeback_approvals.integration_run_id`.
- Already `dispatched` writebacks return idempotently and do not create duplicate Jira writes.
