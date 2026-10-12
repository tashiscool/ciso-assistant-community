# Repository reference tracks

Reviewed 2026-10-11 from source and package manifests. The current production direction is `apps/web` + `cloudflare`; the directories below are separate applications, parity sources, imported content or operating tools. They were mapped at subsystem/request-path level, not completely audited line by line. Mechanical file/declaration coverage is in [source-index.csv](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/source-index.csv).

## Legacy Python/Svelte stack

The legacy browser starts in `frontend` (SvelteKit with Node adapter, Skeleton/Tailwind, Paraglide localization). Filesystem routes separate authentication, internal workspace and third-party/auditee experiences. Generic `[model]` route families coexist with dedicated assessments, risk, EBIOS, privacy, BIA, quantitative, reporting and settings pages. This remains a mature behavior reference, not the React app's runtime.

`frontend/src/hooks.server.ts` establishes locale/CSRF, validates the backend token and allauth session, loads current user/general settings/feature flags, redirects expired login, and attaches authorization/language/CSRF headers to backend requests. The backend API default is `http://localhost:8000/api`; exposed SSO URL is configured separately. Tokens use `Authorization: Token ...` in this stack, whereas the canonical Worker uses `ca_session` cookies (development identity headers are a separate mechanism). Those protocols are not interchangeable.

Django 6 / DRF runs from `backend` and declares Python >=3.14,<3.15. `ciso_assistant/urls.py` mounts schema, integrations, core API, serialization and webhooks. `core/urls.py` registers common DRF viewsets, discovers configurable module viewsets, and mounts IAM/data-wizard/settings/chat/EBIOS/privacy/resilience/quantitative/metrology/document APIs. Models, serializers, filters, viewsets, permissions and tasks each have responsibilities; the Django ORM and relation tables differ from the Worker's handwritten D1 schema/JSON aggregates.

| Legacy area | Domain and code ownership |
| --- | --- |
| `backend/core` | Libraries/reference controls/frameworks/requirement trees, perimeters, assets, threats/vulnerabilities, evidence/revisions, applied controls/policies, risk/compliance assessments, requirement assignments, findings, incidents, tasks/validation flows, actors/teams, journeys and templates. Central `models.py` expresses reuse and relationships. |
| `backend/iam` | Folder hierarchy, users/groups, roles/permissions/assignments, recursive scoped access, personal-access tokens. |
| `backend/tprm` | Entities and assessments, representatives, solutions and contracts. |
| `backend/privacy` | Processing/nature/purposes, personal data, subjects/recipients/contractors/transfers, rights and breaches. |
| `backend/resilience` | Business-impact analysis, asset impact assessment and escalation thresholds. |
| `backend/ebios_rm` | Study/workshops, feared events, risk-origin/target pairs, stakeholders, strategic/operational scenarios, attack paths, elementary actions, operating modes and kill chains. |
| `backend/crq` | Quantitative studies/scenarios/hypotheses and simulation/economic views; NumPy/SciPy dependencies are declared. Current Worker quantitative summaries should not be assumed equivalent. |
| `backend/metrology` | Metric definitions/instances/custom and built-in samples, dashboards/widgets. |
| `backend/pmbok` | Generic collections and accreditations. |
| `backend/doc_management` | Documents, revisions, attachments and edits. |
| `backend/integrations` | Provider/configuration, sync mappings/events and provider integration routes. |
| `backend/webhooks` | Event types, configured outgoing endpoints and delivery tasks. |
| `backend/data_wizard`, `backend/serdes` | Structured imports, model validation/serialization and instance/domain transport. |
| `backend/chat`, `backend/global_settings` | Chat provider/workspace interaction and instance configuration. |

Legacy storage defaults to SQLite, with optional PostgreSQL; files use filesystem or configured S3 storage. Huey provides background tasks (SqliteHuey configuration in settings). Docker/Caddy/Gunicorn/Helm/RHEL artifacts serve this older stack; they do not define the canonical Worker deployment. Existing legacy API/functional/unit tests remain parity evidence but were not executed in this review.

Source anchors: [URL root](/Users/tkhan/IdeaProjects/ciso-assistant-community/backend/ciso_assistant/urls.py), [DRF route registry](/Users/tkhan/IdeaProjects/ciso-assistant-community/backend/core/urls.py), [core models](/Users/tkhan/IdeaProjects/ciso-assistant-community/backend/core/models.py), [IAM models](/Users/tkhan/IdeaProjects/ciso-assistant-community/backend/iam/models.py), [Svelte hooks](/Users/tkhan/IdeaProjects/ciso-assistant-community/frontend/src/hooks.server.ts), [Svelte API constants](/Users/tkhan/IdeaProjects/ciso-assistant-community/frontend/src/lib/utils/constants.ts), [backend dependency manifest](/Users/tkhan/IdeaProjects/ciso-assistant-community/backend/pyproject.toml).

## CLI, MCP and event automation

`cli/clica.py` is a Click API client: resolves names to IDs, imports assets/assessments via Data Wizard, uploads evidence, and provides streaming/resumable backup/restore. `cli/ca_mcp` registers read/create/update/delete, analysis, library, TPRM, EBIOS and quantitative tools on FastMCP. Its HTTP client uses legacy API endpoints and token headers, handles pagination and response formatting. It is not a frontend for the Worker API. Backup/restore is intentionally excluded from this investigation.

`dispatcher` consumes Kafka observation messages, selects single/multiple matching legacy API objects, dispatches applied-control or requirement-assessment updates and evidence uploads, and reports failures. File inputs can be base64 or fetched from configured S3. It reads external config/credentials at runtime; those private files were not inspected or executed.

`automation/prefect_impl.py` demonstrates a Prowler Kubernetes scan ETL: read local scan configuration, create a temporary kubeconfig, execute scanner, normalize status by framework, resolve a legacy audit's framework, update requirements, and clean temporary files. The code currently forces lax PASS→compliant mapping in `update_audit`; this example is not the canonical ConMon engine. `automation/n8n/n8n-nodes-ca` contains legacy API nodes/workflows; `vendor/n8n` is an imported reference, not executed as a Worker dependency.

Source anchors: [CLI](/Users/tkhan/IdeaProjects/ciso-assistant-community/cli/clica.py), [MCP registrations](/Users/tkhan/IdeaProjects/ciso-assistant-community/cli/ca_mcp/server.py), [MCP HTTP](/Users/tkhan/IdeaProjects/ciso-assistant-community/cli/ca_mcp/client.py), [dispatcher handlers](/Users/tkhan/IdeaProjects/ciso-assistant-community/dispatcher/messages.py), [Prefect ETL](/Users/tkhan/IdeaProjects/ciso-assistant-community/automation/prefect_impl.py).

## Enterprise, UX sandbox and imported content

`enterprise/backend` extends legacy models/views/permissions, templates and commercial behavior; `enterprise/frontend` is a legacy build overlay. The top-level /Users/tkhan/IdeaProjects/ciso-assistant-community/LICENSE.md distinguishes enterprise commercial material from other repository licensing. Importing code from these paths needs license and parity review.

`openregscale` is a React 19/Vite/Wouter UX sandbox. `client/src/App.tsx` defines its separate route system, shared typed services/state contracts live in `shared`, Express-related stores live in `server`, and a separate Cloudflare implementation/migrations live under `openregscale/cloudflare`. It contains richer experiments such as drag/drop, trees, charts and form authoring. Its file-based/local store behavior and Workers API are distinct from canonical `cloudflare`. The product decision says to port selected behavior into `apps/web`/`cloudflare`, not deploy the sandbox as a competing product.

`claude-grc-engineering` is imported framework/contracts/plugin and local Node tooling content. Canonical GRC code uses curated schemas, sanitized framework snapshots and provider-neutral adaptations; it does not execute arbitrary imported plugin scripts in the Worker. `cloudflare/vendor` supplies managed content/schema snapshots, and `vendor/compliance-navigator` supplies reference module/route semantics. These are integration inputs and references, not additional shipping servers. Snapshot provenance/schema validation and compatible licenses matter when updating them.

`tools` contains framework/library conversion, mapping and spreadsheet utilities; `config` generates legacy deployment configuration; `charts`, `packaging`, `integration`, `perf_testing`, `.github/workflows` and shell scripts support legacy/operational paths. Existing `artifacts`, QA JSON/Markdown and demo videos are historical output; their existence does not prove the current working tree or production behavior.

Source anchors: [Canonical platform decision](/Users/tkhan/IdeaProjects/ciso-assistant-community/documentation/architecture/canonical-platform.md), [Sandbox routes](/Users/tkhan/IdeaProjects/ciso-assistant-community/openregscale/client/src/App.tsx), [Sandbox manifest](/Users/tkhan/IdeaProjects/ciso-assistant-community/openregscale/package.json), [Imported GRC review](/Users/tkhan/IdeaProjects/ciso-assistant-community/documentation/architecture/claude-grc-engineering-regovise-integration-review.md), [Licensing](/Users/tkhan/IdeaProjects/ciso-assistant-community/LICENSE.md).
