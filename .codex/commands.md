# Discovered commands

Commands below come from package manifests, repository READMEs/CI or Wrangler help. Paths are relative to this repository when using `--prefix`. Root invocation examples are shown. Presence of a command does not authorize production work.

## Canonical checks run in this review

```sh
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
npm --prefix apps/web run verify:ia-shell
npm --prefix apps/web run verify:a11y-tokens
npm --prefix apps/web run verify:observable-import-ui
npm --prefix cloudflare run typecheck
npm --prefix cloudflare run alignment:check
npm --prefix cloudflare run validate:grc-contracts
npm --prefix cloudflare run verify:queue-recovery
```

All passed after `npm --prefix apps/web ci --ignore-scripts` restored existing locked dependencies. The frontend manifest/lockfile was not changed. The accessibility check is a source token scan; alignment is lexical/metadata matching. Detailed evidence and warnings are in [validation](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/validation.md).

## Canonical local development / tests discovered

| Workspace | Commands / requirements |
| --- | --- |
| `apps/web` | `dev` (Vite 5174), `preview`, `verify:responsive`, `test:observable-import-ui`; `test:demo-video` is demo-video smoke; `demo:video`, `demo:video:publish`, `demo:voiceover` generate media. |
| `cloudflare` | `dev`, `dev:local` (prepares local vars + builds frontend + Wrangler 8787), `migrate:local`; `smoke:local`, `smoke:local:grc`, `smoke:local:scrutiny`, `smoke:local:fedramp`, `smoke:local:email`, `smoke:local:full`, `verify:observable-local`; `semantic:matrix`, `verify:observable-import-contract`, alias `test:observable-import-contract`; `types`, `sync:grc-snapshot`. |

`verify:responsive` requires Playwright from `frontend`, which was absent locally. Rather than installing the entire legacy workspace, this review used the connected Playwright browser with an isolated Worker and stored results. Existing responsive script performs bootstrap writes; local smoke tests create/update/delete demo objects, enqueue work and can send configured email. They require isolated state and reviewed providers.

`dev:local` prepares `.dev.vars`; it was not run because private configuration was excluded. The review instead discovered Wrangler help and used a temporary config outside the repo, `wrangler d1 migrations apply D1_MAIN --local --config ... --env-file ... --persist-to ...`, then `wrangler dev --local --config ... --env-file ... --persist-to ... --ip 127.0.0.1 --port 8799`. That state was independent of existing D1 data and all remote bindings.

`verify:observable-import-contract` may consult neighboring `/Users/tkhan/IdeaProjects/security-infra/observable-security-agent` sample data. It was catalogued but not executed. `sync:grc-snapshot` changes vendored content and is not an ordinary read-only check.

## Sensitive operating commands catalogued, not run

Worker scripts include `deploy`, `deploy:production`, `deploy:production:script`, `migrate:remote`, `migrate:production`, `migrate:production:script`, `verify:production-token`, `smoke:production`, `smoke:production:modules`, `smoke:production:playwright`, `smoke:production:e2e`, `ensure:observable-production`, `verify:observable-production`, `verify:aws-live-local`, `verify:scrutiny-readiness`, and `import:fedhr-fedramp`. These may access credentials/cloud services, mutate databases/datasets or send notifications. Names containing “verify”/“smoke” do not make them read-only. Use only with explicit scope and approved target.

The canonical CI entry is [deploy-regovise-edge.yml](/Users/tkhan/IdeaProjects/ciso-assistant-community/.github/workflows/deploy-regovise-edge.yml). It installs with `npm ci`, builds/typechecks, runs Wrangler dry-run packaging, deploys main, optionally applies migrations by manual input, syncs selected secrets, then runs production smoke/parity preparation.

## Legacy / reference commands discovered, not run

| Area | Declared/documented commands |
| --- | --- |
| `frontend/package.json` | `dev`, `build`, `preview`, `check`, `check:watch`, `test`, `test:ci`, `test:ui`, `test:e2e`, `coverage`, `lint`, `format`; build/postinstall compile Paraglide. |
| Legacy README/backend | `poetry install`, `poetry run python manage.py runserver`, `poetry run pytest`, `python manage.py run_huey ...`; migrate/createsuperuser commands are state-changing. Declared Python>=3.14,<3.15; Django 6. |
| `frontend/tests` | README documents `tests/e2e-tests.sh`; package E2E script starts Docker Compose. |
| CLI/dispatcher | README documents `python clica.py ...`, `uv sync`, `uv run dispatcher.py ...`; backup/restore/auth/consume may read secrets or mutate systems. |
| `openregscale/package.json` | `dev`, `build`, `start`, `preview`, `check`, `cf:dev`, `cf:deploy`, `cf:d1:migrate:local`, `cf:d1:migrate:remote`, `format`. Sandbox only. |
| `claude-grc-engineering/package.json` | Contract/plugin/diagram validation and local framework/gap/scanner scripts. Imported source tooling, not the production Worker. |

Do not use the root legacy Quick Start as the canonical Regovise deployment recipe. [Architecture](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/architecture.md) and [reference tracks](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/maps/repository-reference.md) explain the split.
