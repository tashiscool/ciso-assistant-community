# Approved web dependency migration

This implements the user-approved major web dependency remediation. It changes the existing build/styling cohort and preserves React 18, the production router/component tree, authentication, APIs and persistence behavior. The earlier semver-only lockfile candidate remains historical evidence; this migration does not use a force install, peer bypass, package patch, override or advisory waiver.

## Installed cohort

| Package | Previous installed version | Installed version | Compatibility decision |
|---|---:|---:|---|
| Vite | 5.4.21 | 8.3.4 | Supported upstream release; Rolldown configuration replaces deprecated Rollup configuration. |
| React SWC plugin | 3.11.0 | 4.3.3 | Declares Vite 8 support; existing SWC development transform retained. |
| Tailwind CSS | 3.4.19 | 4.3.3 | Existing TS configuration explicitly loaded through `@config`. |
| Tailwind PostCSS plugin | — | 4.3.3 | Official v4 PostCSS integration replaces the v3 plugin. |
| PostCSS | 8.5.29 | 8.5.29 | Patched compatible PostCSS retained. |
| React Router DOM | 6.30.6 | 7.18.4 | v7 supports React 18; deliberately does not adopt v8's React 19 requirement. |
| Tailwind Merge | 2.6.1 | 3.7.0 | Compatible with Tailwind 4.3 class names/conflicts. |

Actual installed versions, engines and peer declarations are recorded in [installed-cohort.json](../../artifacts/verification/web-toolchain/installed-cohort.json). Metadata and package acquisition used the public npm registry, empty user/global npm configs, a task-owned cache and a minimal child environment. Lockfile resolution and `npm ci` both used `--ignore-scripts`; peer resolution succeeded normally. Native compiler dependencies loaded successfully in the subsequent actual build/CSS checks.

## Source changes and preservation

- Manifest/lockfile move to the compatible cohort; redundant Autoprefixer is removed because Tailwind 4 handles prefixing.
- The existing feature/vendor chunk classifier remains in use. Rolldown `codeSplitting.groups` preserves its twelve names and includes Router 7's internal package in the React vendor group. The standalone prototype entry uses the same supported configuration vocabulary.
- Global CSS imports Tailwind 4 with explicit source roots and the existing Tailwind TS configuration. Only the two composed `@apply` classes become registered utilities so shared panel/metric styles compile.
- Existing product colors, typography, dimensions and custom CSS remain. Small shadow/radius/blur defaults, default ring, border/placeholder/button/dialog defaults and transparent forced-color outlines retain the relevant v3 behavior. There are no screen, navigation or business logic edits.

## Executed checks

| Check | Observed result | Evidence boundary |
|---|---|---|
| Public-registry `npm audit --json` | Exit 0; info/low/moderate/high/critical/total all 0 | Snapshot for this locked web tree; not a production exploit assessment. |
| `npm run build` | Pass, Vite 8.3.4, 1,825 modules | Actual bundle generation; no browser interaction implied. |
| `npm run typecheck` | Pass | Existing strict application TypeScript check. |
| `npm run verify:api-client` | 51/51 pass | Existing transport, QA policy, browser preference and actual-handler questionnaire regressions. |
| `npm run verify:toolchain` | 8/8 pass | Actual PostCSS compilation/config loading; explicit utility fixtures cover preserved defaults; Router matching and class merging are exercised directly. |
| `npm run verify:ia-shell` | Pass | Source route/navigation/access metadata checks. |
| `npm run verify:a11y-tokens` | Pass, 212 files | Source token check, not a screen-reader audit. |
| `npm run verify:observable-import-ui` | Pass | Existing bounded import UI source contract. |

The audit receipt is [dependency-audit.json](../../artifacts/verification/web-toolchain/dependency-audit.json). Local checks ran on Node 24.13.0/npm 11.6.2. Vite/SWC require Node 20.19 or 22.12+; the repository's pinned Node 22.22 runtime meets that requirement. Linux/CI execution and final browser observations belong to the root verification run and are not asserted here.

The existing build warns that the main chunk is approximately 538 kB after minification. This warning is retained; the migration does not add a warning threshold or claim a loading-performance improvement.

## Final browser acceptance still required

Use the final frozen build with runner-owned local synthetic state. The root agent owns this browser verification; these are acceptance cases, not completed observations in this document:

1. At 1440, 1024, 768 and 390px, inspect the work queue, grouped navigation, core forms/tables and evidence/authorization screens for overflow, missing utilities, color/font/radius/shadow changes, card spacing and hidden sections.
2. Exercise navigation, detail routes and the anonymous questionnaire response. Check open/close/focus behavior, editable native multiselect arrays, read-only table data, Save/status/submission and canonical readback.
3. Inspect Tailwind 4's changed `space-x/y` selector behavior where child margins, inline labels or hidden sibling groups occur. Compare actual rendered gaps; do not infer pixel equality from the CSS regression tests.
4. Check desktop hover/focus and mobile direct activation: Tailwind 4 scopes hover styles to hover-capable primary input devices. The hidden attribute now takes precedence over display utilities.
5. Check animation/focus states in Radix dialogs/menus and transparent outlines in forced colors. Screen-reader and all-engine coverage remain separate evidence requirements.

Tailwind 4 requires Chrome 111+, Safari 16.4+ and Firefox 128+. This browser baseline must be reflected in production support expectations; no older-browser compatibility claim is made.

## Primary sources consulted

- [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide): PostCSS package, explicit configuration, defaults, custom utilities and changed selectors.
- [Tailwind compatibility](https://tailwindcss.com/docs/compatibility): modern browser minimums.
- [Tailwind custom styles](https://tailwindcss.com/docs/adding-custom-styles): component layers and registered utility behavior.
- [Vite migration guide](https://vite.dev/guide/migration): Rolldown configuration and code splitting changes.
- [Rolldown manual code splitting](https://rolldown.rs/in-depth/manual-code-splitting): supported named groups/runtime initialization.
- [Official SWC plugin README](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc/README.md): Vite 8 transform behavior.
- [React Router v6 to v7 migration](https://reactrouter.com/7.13.2/upgrading/v6): React 18/Node 20 support and declarative route caveats.
- [Tailwind Merge README](https://github.com/dcastil/tailwind-merge/blob/main/README.md): Tailwind 4.3 support.
- Public npm package metadata: exact installed release/engine/peer declarations are retained in the cohort receipt above.
