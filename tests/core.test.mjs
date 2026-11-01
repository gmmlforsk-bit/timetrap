import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig, generateScript } from "../src/engine.mjs";
const valid = {
  url: "http://localhost:3000",
  instant: "2026-11-01T05:59:00Z",
  zones: ["UTC", "America/New_York"],
};
test("canonicalizes a real instant, preserves distinct IANA zones", () => {
  assert.equal(validateConfig(valid).instant, "2026-11-01T05:59:00.000Z");
});
for (const [title, patch] of [
  ["ambiguous wall time", { instant: "2026-11-01T01:30:00" }],
  ["invalid date", { instant: "nonsense" }],
  ["unsupported URL", { url: "file:///etc/passwd" }],
  ["URL credentials", { url: "https://user:pass@example.com" }],
  ["invalid timezone", { zones: ["Mars/Olympus"] }],
  [
    "unbounded world count",
    {
      zones: [
        "UTC",
        "Asia/Shanghai",
        "Europe/London",
        "Europe/Berlin",
        "America/New_York",
      ],
    },
  ],
  ["empty worlds", { zones: [] }],
])
  test("rejects " + title, () =>
    assert.throws(() => validateConfig({ ...valid, ...patch })),
  );
test("export uses executable assertions and no interpolated code from URL", () => {
  const code = generateScript({
    config: { ...valid, url: "http://example.com/?q=`${throwBad()}`" },
    actions: [{ type: "expect", selector: "#value", value: "expected" }],
  });
  assert.ok(code.includes("assert.equal"));
  assert.ok(code.includes("finally{await browser.close();}"));
});
