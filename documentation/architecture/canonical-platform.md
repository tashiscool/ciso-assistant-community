# Canonical Platform Direction

This repository currently contains multiple overlapping application tracks. To avoid continuing to build multiple partially-overlapping GRC products, the one canonical stack is now:

- product: `Regovise`
- frontend: [`apps/web`](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web)
- backend/runtime: [`cloudflare`](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare)
- production domain: `https://regovise.com`

## What Each Top-Level App Means

### Canonical shipping product

- [`apps/web`](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web)
- [`cloudflare`](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare)

This is the only stack that should receive net-new product behavior, production deployment work, runtime integrations, and migration completion work.

### Legacy parity source

- [`backend`](/Users/tkhan/IdeaProjects/ciso-assistant-community/backend)
- [`frontend`](/Users/tkhan/IdeaProjects/ciso-assistant-community/frontend)
- [`cli`](/Users/tkhan/IdeaProjects/ciso-assistant-community/cli)

These directories remain important because they contain mature domain workflows, models, and legacy behavior that still need to be ported. They are the parity reference, not the future deployment target.

### UX and feature-reference sandbox

- [`openregscale`](/Users/tkhan/IdeaProjects/ciso-assistant-community/openregscale)

This directory is a reference implementation and exploration sandbox for workspace flows, feature framing, and UX ideas. It should not be treated as the canonical deployable app.

## Hard Rules

1. Net-new user-facing product features go into [`apps/web`](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web) and [`cloudflare`](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare).
2. If a capability only exists in [`backend`](/Users/tkhan/IdeaProjects/ciso-assistant-community/backend), [`frontend`](/Users/tkhan/IdeaProjects/ciso-assistant-community/frontend), or [`openregscale`](/Users/tkhan/IdeaProjects/ciso-assistant-community/openregscale), port it into the canonical stack before extending it further.
3. Production deployment, domain routing, D1 schema, R2 artifacts, Queue consumers, Durable Objects, and operational smoke tests belong to [`cloudflare`](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare).
4. Product navigation, feature IA, and shipped UX belong to [`apps/web`](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web).
5. `openregscale` may continue to inform UX, but it should be treated as a design/reference source unless and until the corresponding behavior is ported into the canonical stack.
6. The Python/Svelte stack remains the feature-parity source of truth for legacy behavior until that behavior is fully migrated into the canonical stack.

## Repo Intent

The goal is not to delete valuable code. The goal is to assign each area a clear purpose:

- `apps/web` + `cloudflare`: ship the product
- `backend` + `frontend`: mine for parity and migration
- `openregscale`: mine for UX and workflow design

## Migration Priorities

### 1. Domain parity

Port remaining mature workflows from the legacy Python/Svelte implementation into the Cloudflare runtime, especially:

- IAM and tenancy edge cases
- connector breadth
- assessment and control workflows
- reporting and imports
- advanced risk flows
- audit logging and admin operations

### 2. UX consolidation

Port the strongest workspace patterns from `openregscale` into `apps/web` instead of continuing parallel feature work there.

### 3. Reference-suite retirement

Any route that still behaves like a reference suite, placeholder surface, or synthetic snapshot in the canonical stack should be upgraded to real product behavior or explicitly marked as not yet migrated.

## Definition Of “One Comprehensive Solution”

We should treat the platform as complete only when all three of these are true:

1. The Cloudflare stack contains the full shipped UX and backend behavior.
2. The remaining legacy and sandbox directories are reference sources, not competing products.
3. Deployment, validation, and customer-facing operations all run through `regovise.com`.

## Working Decision

Effective immediately for this repo:

- the one canonical stack is `apps/web` + `cloudflare`
- the one canonical production domain is `regovise.com`
- `backend` + `frontend` is the parity backlog
- `openregscale` is the UX backlog
