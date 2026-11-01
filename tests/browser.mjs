import { resolve } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { Lab } from "../src/engine.mjs";
const base = process.env.TIMETRAP_URL || "http://127.0.0.1:4317";
const dir = "output/verification";
const lab = new Lab(dir);
const results = [];
try {
  for (const id of ["lookback", "grouping", "date-only"]) {
    const r = await lab.runCase(id);
    assert.equal(
      r.results[0].pass,
      false,
      id + " must expose reported failure",
    );
    assert.equal(
      r.results.find((x) => x.zone === "UTC").pass,
      true,
      id + " must have passing UTC control",
    );
    results.push(r);
    console.log(id + ": reported failure reproduced + UTC control passed");
  }
  const sample = await lab.start({
    url: base + "/fixture",
    instant: "2026-11-01T05:59:00Z",
    zones: ["America/New_York", "Asia/Shanghai", "UTC"],
  });
  assert.equal(sample.worlds.length, 3);
  await lab.act({ type: "advance", ms: 60000 });
  const page = lab.worlds[0].page;
  assert.equal(await page.locator("#time").innerText(), "01:00:00");
  assert.equal(await page.locator("#count").innerText(), "60");
  assert.match(await page.locator("#direction").innerText(), /向后/);
  console.log("NY fall-back 01:59 -> 01:00, countdown 120 -> 60: passed");
  await lab.act({ type: "jump", instant: "2026-11-02T06:00:00Z" });
  assert.equal(await page.locator("#count").innerText(), "60");
  console.log("Clock jump preserves timer state: passed");
  await lab.act({ type: "fill", selector: "#date", value: "2017-09-10" });
  await lab.act({ type: "click", selector: "#save" });
  const outcome = await lab.act({
    type: "expect",
    selector: "#saved",
    value: "2017-09-10",
  });
  const checks = outcome.actions.at(-1).checks;
  assert.equal(checks.find((x) => x.zone === "Asia/Shanghai").pass, false);
  assert.equal(checks.find((x) => x.zone === "UTC").pass, true);
  const report = await lab.exportReport();
  assert.ok(report.samples.length >= 6);
  const bundle = unzipSync(new Uint8Array(await readFile(dir + "/report.zip")));
  assert.ok(bundle["report.html"]);
  assert.ok(bundle["0-0.png"]);
  assert.equal(
    JSON.parse(strFromU8(bundle["report.json"])).samples.length,
    report.samples.length,
  );
  const scriptPath = resolve(dir, "reproduce.mjs");
  try {
    execFileSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      stdio: "pipe",
      cwd: resolve(dir),
      timeout: 60000,
    });
    throw Error("Exported failing test incorrectly passed");
  } catch (e) {
    assert.ok(
      e.stderr?.includes("AssertionError"),
      "exported test must fail on actual mismatch",
    );
  }
  console.log(
    "Exported reproduction actually rejects date-only mismatch: passed",
  );
  // Replay a passing test too, rather than accepting every failure as success.
  await lab.start({
    url: base + "/fixture",
    instant: "2026-03-08T06:59:00Z",
    zones: ["America/New_York", "UTC"],
  });
  await lab.act({ type: "advance", ms: 60000 });
  assert.equal(
    await lab.worlds[0].page.locator("#time").innerText(),
    "03:00:00",
  );
  await lab.act({ type: "expect", selector: "#count", value: "60" });
  await lab.exportReport();
  const output = execFileSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    stdio: "pipe",
    cwd: resolve(dir),
    timeout: 60000,
  });
  assert.match(output, /1 assertions checked/);
  console.log("Spring skip + exported passing assertion: passed");
  await mkdir("output/verification", { recursive: true });
  await writeFile(
    "output/verification/cases.json",
    JSON.stringify(results, null, 2),
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await lab.close();
}
