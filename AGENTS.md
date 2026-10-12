# AGENTS.md - ciso-assistant-community

## Project

Regovise is a multi-tenant governance, risk, compliance, evidence and assurance workspace. The canonical product is `apps/web` plus `cloudflare`; the Django/Svelte app tracks and `openregscale` are legacy parity/reference sources. See `ARCHITECTURE.md` and `documentation/engineering/developer-guide.md` for current ownership and verification.

## Architecture

The canonical frontend uses React 18, React Router, Vite, TypeScript, Tailwind and existing Radix primitives. The Cloudflare Worker serves its assets and `/_api` domain handlers, with D1 metadata, R2 artifacts, Queues and Durable Object coordination. Feature pages own local state/API adapters; domain services own authorization and persistence. Root `ops/` composes source/type/build/contract checks and an isolated local Worker/D1 verification lane. ATO workspace prototypes remain separate synthetic UI artifacts, not production API or authorization implementations.

## Commands

Before changing code, inspect available commands:

```bash
find . -maxdepth 3 \( -name package.json -o -name pom.xml -o -name build.gradle -o -name pyproject.toml -o -name Cargo.toml -o -name wrangler.toml -o -name Makefile \)
```

Use discovered commands only. Do not invent commands.

## Standards

- Follow existing architecture.
- Keep changes small and reviewable.
- Add tests for changed behavior when practical.
- Include explicit error handling.
- Do not commit secrets or local environment files.
- Do not rewrite unrelated code.

## Restricted Paths

If this project touches client data, government systems, production infrastructure, auth, encryption, audit logging, or secrets:

- Do not read or modify secret files.
- Do not print environment variables.
- Do not access production systems.
- Do not run destructive database commands.
- Do not change authentication, encryption, audit logging, or access control without explicit approval.
- Prefer read-only analysis first.

## Definition Of Done

- Relevant tests pass or failures are explained.
- Changed files are summarized.
- Risks are documented.
- Follow-up tasks are listed.
