# Scope and local security

The server binds only to 127.0.0.1 and rejects other Host values. State-changing API requests require an ephemeral token and same-origin requests. There is no upload service or analytics. URLs accept only HTTP(S), without embedded credentials. 1–4 distinct valid IANA zones are allowed. The server serializes browser operations and bounds request bodies. Artifact routes accept only known filenames. The target is loaded in a separate Chromium context per world, with service workers blocked.

The local server intentionally supports local development addresses. It is not designed for public hosting or access by untrusted remote users. No command execution API or arbitrary evaluation API is exposed to the web interface. CSS/Playwright selectors are accepted for interactions.

Run against pages you intend to test. A target app can perform real side effects when you click a button: use test data and a development environment. Local browser clock simulation is not an authentication bypass. Screenshot content and captured text can be sensitive; inspect reports before sharing.

Main-frame clock coverage only: Date and Playwright-clock-supported timers. Server timestamps, browser TLS validation, operating system time, workers and cross-origin frames are not certified. Each context has isolated storage. Browser-side notifications, calendar behavior and network calls depend on the target's implementation.

The tool does not infer whether a visual difference is a defect. User-supplied exact-text assertions define expected behavior. Exported script execution reproduces those checks; zero assertions means observation-only. A URL requiring state, credentials or mutable remote data may fail to reproduce later.

Both CLI and UI use the same engine. A failed synchronized interaction can leave worlds at different states; the UI instructs the user to restart rather than pretending the action was atomic.
