# Case provenance

Checked 2026-11-01. All three reports are closed historical reports. A failing case here reproduces a historical pattern, not the current release state. No full upstream application is executed.

## CC Switch #8719

- Report: https://github.com/farion1231/cc-switch/issues/8719
- Source: https://github.com/farion1231/cc-switch/blob/7da255387f601b5b1f8db2d98aefaa95aab3de90/src/lib/usageRange.ts
- Full file retained as `vendor/cc-switch-source.ts`.
- Executed excerpt: from `getStartOfLocalDayDate` through `resolveUsageRange`, before `getUsageRangePresetLabel`. Top-level time constants retained; standalone type definitions supplied to replace imported types. Executable function bodies unchanged.
- License: `vendor/CC-SWITCH-LICENSE` (MIT, Jason Young).
- Report expectation: New York, 2026-11-02 23:30 local, seven local days start 2026-10-27. Original function starts 2026-10-28. UTC control passes.

## OpenClaw #130944

- Report: https://github.com/openclaw/openclaw/issues/130944
- Source: https://github.com/openclaw/openclaw/blob/9bd50c8/ui/src/lib/sessions/grouping.ts
- Full file retained as `vendor/openclaw-source.ts`.
- Executed excerpt: original `dateBucketId` function, with `UNGROUPED_ID` supplied and an export appended. Function body unchanged. Other grouping functions and UI are not executed.
- License: `vendor/OPENCLAW-LICENSE` (MIT).
- Expectation: Los Angeles, November 2 noon; yesterday midnight belongs in `yesterday`. Fixed-duration original code returns `week`. UTC control passes.

## react-datepicker #1018

- Report: https://github.com/Hacker0x01/react-datepicker/issues/1018
- Maintainer documentation: https://github.com/Hacker0x01/react-datepicker/blob/main/docs/timezone.md
- This case reimplements the integration pattern using native Date: pick local September 10 midnight, serialize with `toISOString`, then take the date portion. It is **not vendored component code** and does not assert a component defect.
- Expectation: preserve the date-only field `2017-09-10`. In positive UTC offsets the flawed serialization stores `2017-09-09`; UTC control passes.
- Correct integration for a date-only database field preserves local calendar components (or the original date input string), rather than converting to an instant and truncating it.

## Add a case

Provide source URL + fixed revision, evidence scope, original failing input, explicit expected behavior, positive failure demonstration and at least one passing control. Cases must disclose whether they run original source, an excerpt, a port or a synthetic reconstruction. Include licenses for copied source.
