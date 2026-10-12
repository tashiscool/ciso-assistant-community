# Regovise React workspace

This is the canonical React 18/Vite frontend. The canonical Worker in [`cloudflare`](../../cloudflare/) serves `dist/` and `/_api` from one origin. The sibling root `frontend/` is legacy Svelte/parity source; it is not this app.

## Install and check

Use the root declared Node/npm range and this workspace's existing lockfile. From the repository root:

```sh
npm --prefix apps/web ci
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
npm --prefix apps/web run verify:api-client
```

For the combined canonical gates, use `npm run verify`. No root npm workspace/dependency migration is required. The isolated Worker check requires the web build and installed Worker dependencies; see [local verification](../../ops/local/README.md).

## Source layout

- `src/main.tsx` and `src/shell/`: application boot, session/access handling, routes, navigation and topbar.
- `src/features/<domain>/`: page state, feature-specific types/API adapters and full workspaces.
- `src/shared/api/`: current JSON request client and transport response/error helpers. Runtime parsing does not certify every feature's data shape or business result.
- `src/shared/session/`: existing identity/session behavior; changes are security-sensitive.
- `src/shared/browser/preferences.ts`: failure-tolerant cosmetic preference access; coach-mark keys/values stay unchanged and identity/token/permission state remains with its existing owner.
- `src/components/` and `src/styles.css`: established Regovise/Radix primitives and tokens.
- `scripts/`: source/IA/token/import checks, transport regression suite and local browser checks.

Keep feature meaning intact. A framework requirement, applied control, core compliance assessment, GRC gap run, evidence evaluation, human review, package and official authorization are different objects/actions even when views share fields.

## Browser development and preview

```sh
npm --prefix apps/web run dev -- --host 127.0.0.1
```

Vite is a frontend server. The current Vite config does not proxy `/_api` to a Worker; a frontend server alone does not establish an operational authenticated workspace. Review the intended local API/configuration path before working with actual domain data. Prefer isolated verification for credential-free backend tests rather than invoking scripts that prepare private variables.

The connected ATO UI preview is separately addressed at `/prototypes/ato-workspace/`; its [README](prototypes/ato-workspace/README.md) describes the explicit local run/build, synthetic fixture data and in-memory save/review behavior. It is not imported by the production router and is not server-persistence/authorization evidence.

## Relevant checks and limits

| Command | What it establishes |
| --- | --- |
| `typecheck`, `build` | Compilation/build compatibility for current source and installed versions. |
| `verify:api-client` | Actual TS transport, pure local-QA policy and cosmetic preference helper tested with fake fetch/identity/storage and synthetic responses; no live provider/auth storage execution. |
| `verify:ia-shell` | Navigation/route/guard preservation metadata; not proof that every button works. |
| `verify:a11y-tokens` | Static visual-token constraints; not a screen-reader audit. |
| `verify:observable-import-ui` | Source/UI import contract assertions. |
| `verify:responsive` | Local browser layout/navigation/diagnostic checks, using existing Playwright from legacy frontend dependencies. It bootstraps local demo data, requires loopback and is outside the default root fast lane. |

Meaningful UI acceptance also needs the actual task, loading/error/empty/disabled states, keyboard focus, mobile reachability and saved canonical result. Keep source, declared test, executed browser result and external provider outcome separate. Preserve aliases and query-selected records. Use existing dependencies; new libraries, routes and product semantics require review.
