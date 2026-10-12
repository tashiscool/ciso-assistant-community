# Connected Regovise ATO workspace preview

The three selected visual concepts are implemented as connected React views:

- My Work: selected task/detail, Assigned/Needs review tabs, filter/sort, evidence-review handoff and authorization summary.
- Systems: overview, boundary/assets/dependencies/team tabs, record inspection, attention actions and operating history.
- Controls: control/family selection, implementation/evidence/assessment/history tabs, Markdown draft formatting, Save and review-request workflow.

Shared context, command search, dialogs, mobile navigation, evidence outcomes, per-system drafts and generated review work connect the views. The visible Example workspace uses synthetic records. Draft saves/review outcomes stay in memory for the running page; reload resets them. No APIs, authentication, official authorization, persistence, external delivery or production deployment are implemented by this preview.

## Run

From the repository root:

```sh
npm --prefix apps/web run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

Open `http://127.0.0.1:5176/prototypes/ato-workspace/`.

Views use `?view=work`, `?view=system`, or `?view=controls&control=ac-2`, with `system=atlas` or `system=orion`. System-specific drafts do not cross contexts.

## Verify/build

```sh
npm --prefix apps/web run typecheck
npm --prefix apps/web run build -- --config prototypes/ato-workspace/vite.config.ts
npm --prefix apps/web run verify:a11y-tokens
npm --prefix apps/web run verify:ia-shell
```

The dedicated Vite build writes this preview to its ignored `dist/` directory. The normal application entry/router and production Worker remain unchanged. The new modules reuse existing React, Radix and Lucide dependencies.

Implementation source is `apps/web/src/features/ato-workspace-preview`. Browser evidence and same-frame comparisons are in `qa/`; the final QA report is `design-qa.md`. This is a reviewed frontend preview, not regulatory conformance or production-readiness certification.
