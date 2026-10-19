# Readable workspace verification

Implemented 2026-10-19 in the existing Northstar project, branch `codex/cf-readable-workspace`.

## Behavior and preservation

Home presents three personalized actions, with detailed tools grouped under All tools. Partner reading opens the named partner's read-only answers before optional shared-choice comparisons. The introduction remains attributed to Debynyhan Banks and accessible through About this workspace.

The default guided sequence uses the existing 12 Christian / 13 Debynyhan essential question IDs. All applicable questions remain available in guided and full-list views. Original question IDs, stored selections and notes are unchanged. New short prompts use separate display helpers; complete guidance remains available through Help me answer. Legacy substantive answers still count complete. Explicit draft, unknown, skipped and unanswered states remain unresolved even when retained text exists.

Questionnaire writes use the existing Supabase queue and wait for acknowledgement before reporting cloud success. Pending writes are checkpointed by account, workspace and seat. Reload recovery is review-only: it never automatically replays writes or replaces current server records. A user can compare current and recovered content, restore their own answer as a draft, reopen planning work, or download recoverable data. Confirmations are never replayed. Session-generation guards prevent stale reads and acknowledgements crossing account changes.

Planning fields retain their original identifiers and validation. The staged renderer preserves blank financial amounts, zero values, historical selections and conditional fields. A local form draft is explicitly described as device-only. Shared records change only after final validation and save; final-save controls remain locked until acknowledgement, and failed saves preserve the editable draft. Dynamic review summaries show current required gaps without replacing inputs.

## Browser checks

Used `/private/tmp/cf-readable-preview` with a separate local origin and its cloud configuration disabled. Test values were entered only into that preview. Production configuration was preserved in the source checkout.

- A questionnaire draft survived reload and resumed at its question. Save and continue changed it to answered and advanced.
- Marking a written alternative unknown preserved its text, advanced, and left completion at one of twelve. Back displayed the retained notes and Not sure yet status.
- A customer-plan draft survived finishing later and reloading, reopening at Services with the title retained. Final validation identified the missing owner without deleting entries; adding the owner allowed a preview-only final save.
- Christian's Extra large preference produced 24px text; switching preview identity to Debynyhan restored that account's Large preference and 20px text.
- Partner answers were visibly labeled Read-only with no answer-editing controls. Unknown notes were still readable.
- At 1280 CSS pixels, body and navigation text measured 20px and question headings 27px. Primary guided buttons measured over 55px high.
- At 320 CSS pixels, guided discovery fit without horizontal overflow.
- In the isolated preview only, doubled text was tested with a 40px root/body size. Guided discovery fit at both 1280 and 320 CSS pixels after correcting narrow-width wrapping. This was a text-enlargement simulation, not a claim about every browser's zoom behavior. The temporary QA override was removed before packaging.
- Keyboard focus moved to the active question after navigation. Planning step changes focused the new step. Source checks and focused regressions cover final-save locks and validation focus.
- Final browser verification confirmed a required-field error focuses `planning-form-errors`; correcting the owner updates the review summary immediately. Partner answer views contained no answer-editing controls. A staged form fit an effective 320px viewport with a measured width below 292px.

## Automated checks

The production build and all **163 Node tests passed**. Repository ESLint and `git diff --check` passed. Focused coverage includes legacy answer preservation, unresolved-state completion, full unfinished-answer exports, account/workspace/seat draft isolation, review-only recovery, queue failures and session resets, all form-field mappings, blank-versus-zero review values, conditional fields, final-save control locks and scoped reading preferences.

## Verification boundaries

This release does not change database schema, row-level policies, SMTP, domains or account permissions. Existing sign-in and invitation flows remain in place. No new production test accounts or fabricated business records are required for this UI release.

These checks are not a complete assistive-technology or WCAG conformance audit. Christian should try signing in, answering, leaving/resuming and reading Debynyhan's proposal so his own preferences can guide subsequent refinements.
