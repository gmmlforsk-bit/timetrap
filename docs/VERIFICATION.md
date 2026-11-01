# Verification record — 2026-11-01

Local: macOS ARM64, Node 26.10.0, Playwright's installed Chromium. No Windows/Linux runtime or hosted GitHub Actions run is claimed.

- Syntax checks: passed.
- Core tests: 9 passed, 0 failed.
- Browser integration: three source-linked historical patterns reproduce, each with a passing UTC control.
- Fall-back: New York 01:59 becomes 01:00 after advancing 60 seconds; countdown 120 becomes 60.
- Spring-forward: New York 01:59 becomes 03:00 after advancing 60 seconds.
- Direct clock jump leaves countdown state unchanged.
- CSS selector fill/click and expected-text checks work across isolated contexts.
- Exported reproduction is actually executed: a known mismatch exits with AssertionError; a passing scenario completes with one assertion per world.
- Export ZIP contents are unpacked and checked for HTML, metadata, executable script and screenshot data.
- Native in-app browser: desktop 1440 px and narrow 390 px layouts inspected; narrow page has no horizontal overflow and collapses configuration after start.
- Native UI flow: demo → exact-text assertion → export ZIP completed. Three world checks displayed PASS.
- Pure black/gray styling checked in UI, fixture and HTML export; previous beige/green palette removed.

Historical case execution scope is documented in CASES.md. Full upstream applications were not executed. No newly discovered upstream defect is claimed.

## Motion edition 0.1.1

- Redesigned monochrome hero, interactive three-zone fall-back preview, staggered capture cards, execution scan and keyboard-accessible zoom buttons.
- The illustrative preview uses Intl timezone conversion and never calls the experiment engine. At +60 s: New York 01:00:00, Shanghai 14:00:00, UTC 06:00:00, verified in the in-app browser.
- Manual scrubbing pauses playback. Global motion control persists the explicit choice. OS reduced-motion defaults to paused; automatic ticking stops while hidden or outside the viewport.
- Syntax and all 9 core tests pass. Native UI start → advance 1 minute → zoom → export succeeds with three browser captures, no console errors.
- Motion pause persists after reload; lab/case switching hides the hero correctly and preserves separate status messages.
- Final 1440 px desktop and native 365 px narrow viewport checked; document width 350 px in the narrow viewport (no horizontal overflow).
