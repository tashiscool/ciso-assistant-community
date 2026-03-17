# Assessment Artifact Package Transformer

This document defines the abstraction contract used to transform legacy assessment request lists into a normalized, ready-to-collect artifact package.

## Purpose

Use `scripts/build_assessment_artifact_package.py` to convert tab-delimited request lists (controls/workstreams, category, artifact request, date) into:

- a normalized JSON package
- optional normalized CSV
- collection playbooks for AWS, RHEL/Linux, and database evidence
- quality diagnostics for malformed controls/placeholders/missing fields

## Supported Abstractions

- Workstreams: `SAP`, `PEN_TEST`, `CORE_CONTROL`, `POLICY_BASE_CONTROLS`, `SPECIAL_INSTRUCTION`
- Controls: canonicalized to `AC-2`, `AC-2(7)`, etc.
- Control families: extracted from controls (`AC`, `AU`, `CM`, ...)
- Control domains: mapped by family (Access Control, Audit, Configuration, etc.)
- Artifact types: policy, procedure, plan, configuration snapshot, command output, report, records, screenshot, scan evidence, etc.
- Platform tags: `AWS`, `RHEL7`, `LINUX`, `ORACLE_DB`, `POSTGRES_DB`, `WEB_APP`, `NETWORK_BOUNDARY`, `SPLUNK`, `NESSUS`, `TREND_MICRO`, etc.
- Time scopes: inferred terms like `rolling_365_days`, `sample_of_months`, `since_last_assessment`
- Periodicity: inferred cadence (`weekly`, `monthly`, `quarterly`, `annual`, etc.) from explicit language plus control/time-scope heuristics
- Collection channels: `tool_export`, `cli_capture`, `document_repository`, etc.
- Bundle hints: deterministic artifact file path suggestions per request

## Input Format

Expected tab-delimited rows:

1. Control/workstream tokens (comma-separated)
2. Category/classification (optional)
3. Artifact request text
4. Date (`MM/DD/YY`, `MM/DD/YYYY`, or `YYYY-MM-DD`)

## Usage

```bash
python3 scripts/build_assessment_artifact_package.py \
  --input /path/to/request-list.tsv \
  --output qa/assessment_artifact_package.json \
  --normalized-csv qa/assessment_artifact_package.normalized.csv
```

## Output Contract

Top-level sections in output JSON:

- `metadata`
- `abstractions`
- `stats`
- `items`
- `indexes`
- `collection_playbooks`
- `quality_report`

Each item includes:

- normalized `controls`, `control_families`, `control_domains`
- `workstreams`
- `artifact_types` and `primary_artifact_type`
- `platform_tags`
- parsed `commands` and `config_paths`
- inferred `periodicity` and `time_scopes`
- `bundle_hint.relative_path`

## Operational Cadence

The package now supports practical recurring evidence operations:

- weekly (e.g., audit log reviews, alert triage)
- monthly (e.g., vulnerability scans, POA&M updates)
- quarterly (e.g., account recertification, baseline validation, penetration testing)
- annual (e.g., training, policy reviews, risk assessments)

This is used by schedule generation in the API/UI to produce auditor-friendly, frequency-based collection plans from raw request rows.

## Quality Gate

The package sets `quality_report.quality_gate` to:

- `pass` when no row issues are detected
- `needs_review` when malformed controls, placeholders, unknown tokens, or missing data are found

This allows immediate filtering of rows that require analyst cleanup before evidence collection begins.
