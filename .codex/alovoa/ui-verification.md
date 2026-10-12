# Browser verification of the bounded practice port

Observed with Codex's in-app browser against fresh runner-owned local state and updated canonical lockfiles. Earlier navigation/text-flow runs are retained in their receipts. Final navigation/structured-questionnaire runtime: `local-2026-10-12T04-34-59-839Z-f4070fac`, loopback port 63317, after the independent review repairs. Synthetic demo records only, email/service delivery disabled, external provider HTTP blocked. This is a manual task/keyboard/browser check, not a complete accessibility or product certification.

## Mobile navigation

Target: existing 292px drawer, navigation/groups/routes and desktop sidebar. Baseline phone screenshot is `artifacts/verification/ui-practices/mobile-navigation-before.jpg`; Escape left it open and focus remained behind it.

Final phone viewport was measured in the page as **390 × 844**. Opening focuses the single Close navigation button inside a named Navigation dialog. Shift+Tab wraps to Admin; Tab wraps back to Close navigation. Escape closes and restores Open navigation focus. Outside click, close button, Tasks navigation and resizing to desktop close the drawer. Tasks resolves to `/tasks`. Desktop viewport measured **1440 × 1000** with no remaining mobile dialog. No page-level horizontal overflow or console errors were observed in the named final navigation scenarios. The development-process footer was removed.

These observations verify the named browser keyboard interactions. A screen-reader audit, all browser engines, all roles and every navigation destination were not tested here.

The final build also exposes `aria-expanded` and controlled group regions. All thirteen groups referenced existing unique regions; the full document had no duplicate IDs. Toggling Home changed its expanded value to false and hid its referenced region. Escape still closed the dialog and returned Open navigation focus.

## Public questionnaire

The browser used the existing logout route, then opened the response without a workspace shell/session. Invalid share token resolves to a useful not-found state; invalid code reports that it did not match. A valid synthetic link/code opens the form. Required-answer validation, Save, submission confirmation and locked submitted controls were exercised.

The final build was tested at measured **1440 × 1000** and **390 × 844**. Save succeeds at both widths. Submission at phone size disables the textarea, Save and Submit, and both the header and status pill show Submitted. The private canonical instance readback confirms Submitted, 100% complete and the exact synthetic answer. No page-level horizontal overflow or console errors were observed in the final positive scenario.

The route effect now clears state for a changed token, ignores stale loading responses, and ignores stale validate/save results; no automatic mutation retry was introduced. Independent review found same-token edits could be overwritten during Save. The repair locks access code/answer/select/evidence fields while requests are pending. Seven controlled regression cases execute actual compiled handlers/effects/rendered props. The final browser run delays the real public response by five seconds only in the owned temporary Worker wrapper: the answer is disabled during Save, editing returns after completion, and the saved answer remains intact. Old-token scheduling remains covered by the controlled test rather than full browser fault injection. Native uploads, all question types, login-required enforcement, reviewer request-changes and all questionnaire policy combinations are outside this bounded check.

The last review additionally repaired stale success notices and structured-answer loss. Final browser checks selected Analyst+ISSO via the native multiselect, confirmed no editable control for the existing table, and verified the private canonical record kept the selections as a string array and the original table rows unchanged. Editing text removed the old success status; the delayed Save showed Saving... with disabled controls and no stale success notice. A successful notice has role=status/polite semantics; a screen-reader announcement was not tested. Fifteen controlled questionnaire cases cover malformed/structured-value preservation and failure/notice behavior. Full table editing remains unsupported from the public link until its metadata/validation contract is approved.

## Artifacts

- [Phone navigation](../../artifacts/verification/ui-practices/mobile-navigation-after.jpg)
- [Desktop navigation](../../artifacts/verification/ui-practices/desktop-navigation-after.jpg)
- [Desktop questionnaire Save](../../artifacts/verification/ui-practices/questionnaire-desktop-saved.jpg)
- [Phone questionnaire Save](../../artifacts/verification/ui-practices/questionnaire-mobile-saved.jpg)
- [Phone submitted questionnaire](../../artifacts/verification/ui-practices/questionnaire-mobile-submitted.jpg)
- [Pending Save locks fields](../../artifacts/verification/ui-practices/questionnaire-saving-locked.jpg)
- [Canonical answer/status readback](../../artifacts/verification/ui-practices/questionnaire-readback.json)

The final structured mobile Save/submission images are full-page captures taken from the measured 390×844 viewport, so image height exceeds viewport height. The receipt records actual JPEG dimensions and hashes. Final supported-field tests confirm array selections, table row preservation, current Submitted header, disabled response controls, and no workspace shell. All selected final positive browser scenarios recorded no console errors or document horizontal overflow.

Earlier browser fixtures and images were replaced with final-build captures at measured dimensions. Earlier integration receipts remain historical for their recorded source identity. Synthetic grades/mappings are test inputs and never establish an ATO or genuine control compliance.
