# Regovise three-view design QA

final result: passed

Scope: connected frontend preview of all three selected images. Review performed 2026-10-11 (America/New_York). Production runtime/auth/data are outside this preview. Application source files and production routes were not replaced.

## Comparison targets and normalization

| View | Source visual truth | Browser implementation | Full comparison | Focused comparison |
| --- | --- | --- | --- | --- |
| My Work | `.codex/design/visual-option-1.png` | `qa/work-desktop.png` | `qa/work-comparison-final.png` | `qa/work-focused-final.png` |
| Systems | `.codex/design/visual-option-2.png` | `qa/system-desktop.png` | `qa/system-comparison-final.png` | `qa/system-focused-final.png` |
| Controls | `.codex/design/visual-option-3.png` | `qa/controls-desktop.png` | `qa/controls-comparison-final.png` | `qa/controls-focused-final.png` |

Paths beginning `.codex` are relative to repository root; QA paths are relative to this preview folder. Sources are 1487×1058px generated design frames. Implementations are 1440×1024px screenshots at a 1440×1024CSS viewport/density 1. Source frames were normalized to the comparison viewport (under 0.1% aspect-ratio difference). Combined inputs show source left and actual browser right; each is not a separate memory-only comparison. Full paired images are 2880×1048 including 24px comparison labels; focused pairs are 2460×770.

State: Atlas API, Agency RMF Moderate, initial three pending work items; System Overview; Controls AC-2/Implementation with unchecked review checklist. Native save/request state is truthful rather than pretending the initial draft is auto-saved or approved. Synthetic fixture has one pending evidence record, so derived counts are 1 rather than the mock's 2. The mock's unsupported package-change count is replaced with derived Items awaiting attention.

## Review history and resolved findings

1. Initial desktop comparison (saved `*-comparison-initial.png`) found [P2] System/Control pages flush against shell with missing page inset. Added dedicated page padding and restored header/content rhythm. Initial control editor also lacked the mock's functional formatting toolbar; added actual Markdown selection wrapping, headings, lists and controlled validated-link insertion without new dependencies or unsafe rich HTML.
2. Initial desktop comparison found [P2] link affordances dark instead of purple because a parent button-color rule overrode link color. Corrected selector specificity and re-captured. Removed unnecessary preview-explanation text in the editor; retained the sourced Example workspace context.
3. Interaction review found [P1] Save left edited draft flagged unsaved. Stored a distinct in-memory saved-draft snapshot and compared edits against that snapshot. Request review now adds a deduplicated control-review task with a working control handoff. Edited drafts retain correct review-needed state and are not marked approved.
4. Mobile 390px check found [P2] document overflow 172px from an absolutely positioned screen-reader table label escaping the scroll wrapper. Established local containing blocks on scrolling table wrappers; re-capture confirms document overflow 0. The data table itself scrolls internally rather than hiding needed columns.
5. Final desktop comparison found [P2] extra vertical rhythm pushed the second history/evidence row below the target viewport. Tightened targeted section/header/fact spacing. Final measured System history bottom 1002.98px and Control supporting-evidence bottom 987.16px, inside 1024px viewport. Post-fix paired/focused captures retain the source hierarchy and all major content.

The final comparisons show no actionable P0/P1/P2 fidelity/task defects in the selected three views. My Work full/focused comparison was also independently reviewed by the frontend agent; only P3 differences remained.

## Required fidelity surfaces

- Fonts/typography: existing Avenir Next/Segoe UI product family and Georgia wordmark, readable dark hierarchy, title/body/secondary weights and responsive wrapping checked. Source has slightly larger/heavier supporting text in some rows; retained compact readable operator text as P3.
- Spacing/layout: queue/detail/spanning summary, system status/attention/case/history, and control family/editor/reviewer proportions checked in paired inputs. Shared 220px desktop navigation intentionally unifies the three mockups' varying sidebar widths. Final major content fits at 1440×1024; tablet/mobile stack and preserve named navigation.
- Colors/tokens: Regovise purple selection/action, warm white/lavender surfaces, dark text, and labeled green/amber/red states match brand/source meaning. Flat purple replaces subtle mock button gradient; minorP3 visual difference. Selection/status meaning is not color-only.
- Images/assets/icons: source is an interface with editable wordmark, initials and standard line icons; existing native brand typography and installed Lucide icons are used. No photographs/illustrations/custom raster assets are omitted. No custom inline SVG/CSS art is used to substitute image assets. A few icon glyphs differ from the rendered mocks (P3).
- Copy/content: key labels/context/actions match the selected layouts. Review replaces unimplemented approval language; counts reflect fixture truth; draft save/request does not certify authorization. Rich HTML is intentionally replaced by functional Markdown text drafting. The illustrative footer/legal links are omitted rather than invented.

## Browser/task acceptance

Verified in Codex in-app browser, local standalone entry, using synthetic records:

- Navigation between all three views; URL context updates; system switch changes displayed data and keeps Atlas/Orion drafts separate.
- My Work selection/detail, filter-empty recovery and due-date sort (Oct 9 remediation first for oldest).
- Evidence review rejects acceptance without scope confirmation; accepted review updates the queue, review readback and summary without changing recorded decision metadata.
- Control draft edit/save clears unsaved feedback; completed review checks enable Request; request updates button/status and creates queue work; no auto-approval.
- Markdown Bold wraps the selected narrative; four control tabs render corresponding evidence/assessment/history content.
- Five system tabs render boundary, assets, dependencies and team/history context.
- Search filters to a control and navigates to it; Cmd/Ctrl+K opens search.
- Mobile navigation exposes all seven destinations; Escape closes it and returns focus to Open navigation. Dialogs use Radix focus management and scoped return targets.
- No browser console errors/warnings observed in final checks.

All three views had document overflow 0 at 1440px desktop, and at 1024/768/390/320px in the stored responsive sweep (`qa/responsive-checks.json`). Desktop screenshots 1440×1024; mobile screenshot captures at 390×844 with full-page output. Wide evidence/history tables remain contained scroll regions. Primary keyboard actions were exercised; a screen-reader/WCAG certification was not performed.

## Verification commands

Frontend typecheck, dedicated preview build, existing accessibility-token check and existing IA-shell check passed. Build warns only that Browserslist data is stale. Existing shell routes/metadata remain intact. No new dependencies or backend/API/auth/persistence/deployment changes.

## Follow-up polish / scope limits

P3: match supporting type/icon glyphs more exactly and refine compact tablet density if desired. Prototype draft/review state is in-memory and resets on reload. Broader suite areas are contextual fixture dialogs, not complete new operational screens. Connecting actual system/case/decision contracts, native files, external integrations and production data is a separate approved implementation slice.

Implementation checklist: selected visuals captured; common shell/context implemented; all three core flows exercised; earlier P1/P2 fixes re-captured; combined and focused comparisons opened; commands passed; local preview retained.
