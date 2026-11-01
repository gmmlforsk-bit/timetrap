import { zipSync, strToU8 } from "fflate";
import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cases, caseFunction } from "./cases.mjs";
export function validateConfig(input) {
  const date = new Date(input.instant);
  if (
    !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(input.instant ?? "") ||
    !Number.isFinite(+date) ||
    date.getUTCFullYear() < 1970 ||
    date.getUTCFullYear() > 2100
  )
    throw Error("时间必须带 Z 或 UTC 偏移，年份范围 1970–2100。");
  if (
    !Array.isArray(input.zones) ||
    input.zones.length < 1 ||
    input.zones.length > 4
  )
    throw Error("请选择 1–4 个时区。");
  const zones = [...new Set(input.zones)];
  for (const z of zones) new Intl.DateTimeFormat("en", { timeZone: z });
  const url = new URL(input.url);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("仅支持不含账户密码的 HTTP / HTTPS 地址。");
  return { url: url.href, instant: date.toISOString(), zones };
}
export class Lab {
  constructor(dir) {
    this.dir = resolve(dir);
    this.worlds = [];
    this.actions = [];
    this.samples = [];
    this.seq = 0;
  }
  async browserReady() {
    this.browser ??= await chromium.launch({ headless: true });
    return this.browser;
  }
  async start(config) {
    config = validateConfig(config);
    await this.closeWorlds();
    this.config = config;
    this.actions = [];
    this.samples = [];
    this.seq = 0;
    await this.browserReady();
    try {
      for (const zone of config.zones) {
        const context = await this.browser.newContext({
          timezoneId: zone,
          viewport: { width: 1000, height: 700 },
          serviceWorkers: "block",
        });
        const page = await context.newPage();
        page.setDefaultTimeout(6000);
        const w = { zone, context, page, errors: [] };
        this.worlds.push(w);
        page.on("pageerror", (e) => w.errors.push(e.message));
        await page.clock.install({ time: new Date(config.instant) });
        await page.clock.pauseAt(new Date(config.instant));
        await page.goto(config.url, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
      }
    } catch (e) {
      await this.closeWorlds();
      throw e;
    }
    return this.capture("initial");
  }
  async capture(label) {
    await mkdir(this.dir, { recursive: true });
    const worlds = [];
    const seq = this.seq++;
    for (let i = 0; i < this.worlds.length; i++) {
      const w = this.worlds[i],
        meta = await w.page.evaluate(() => ({
          instant: new Date().toISOString(),
          local: new Date().toString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          url: location.href,
          title: document.title,
        }));
      const name = `${seq}-${i}.png`;
      await w.page.screenshot({
        path: resolve(this.dir, name),
        animations: "disabled",
        timeout: 12000,
      });
      worlds.push({
        ...meta,
        zone: w.zone,
        screenshot: name,
        errors: [...w.errors],
      });
    }
    const sample = { seq, label, worlds };
    this.samples.push(sample);
    return { ...sample, actions: this.actions };
  }
  async act(a) {
    if (!this.worlds.length) throw Error("请先启动一次实验。");
    if (a.type === "jump") {
      const date = new Date(a.instant);
      if (
        !Number.isFinite(+date) ||
        !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(a.instant ?? "")
      )
        throw Error("请输入带时区的 ISO 时间。");
      for (const w of this.worlds) await w.page.clock.setSystemTime(date);
    } else if (a.type === "advance") {
      if (!Number.isFinite(a.ms) || a.ms < 0 || a.ms > 86400000)
        throw Error("推进范围为 0–24 小时。");
      for (const w of this.worlds) await w.page.clock.runFor(a.ms);
    } else if (["click", "fill", "expect"].includes(a.type)) {
      if (
        typeof a.selector !== "string" ||
        a.selector.length > 500 ||
        !a.selector.trim()
      )
        throw Error("需要有效的 CSS / Playwright 选择器。");
      const checks = [];
      for (const w of this.worlds) {
        try {
          const loc = w.page.locator(a.selector);
          if (a.type === "click") await loc.click();
          if (a.type === "fill") await loc.fill(String(a.value ?? ""));
          if (a.type === "expect") {
            const actual = await loc.innerText();
            checks.push({
              zone: w.zone,
              pass: actual === String(a.value),
              actual,
              expected: String(a.value),
            });
          }
        } catch (e) {
          if (a.type === "expect")
            checks.push({
              zone: w.zone,
              pass: false,
              error: e.message,
              expected: String(a.value),
            });
          else {
            this.actions.push({ ...a, error: e.message, partial: true });
            throw Error(
              "部分时区操作失败；请重开实验以恢复一致起点。" + e.message,
            );
          }
        }
      }
      if (a.type === "expect") a = { ...a, checks };
    } else throw Error("未知操作。");
    this.actions.push(a);
    return this.capture(a.type);
  }
  async runCase(id) {
    const item = cases.find((x) => x.id === id);
    if (!item) throw Error("未知案例");
    await this.browserReady();
    const results = [];
    for (const zone of item.zones) {
      const c = await this.browser.newContext({ timezoneId: zone });
      try {
        const p = await c.newPage();
        await p.clock.setFixedTime(new Date(item.instant));
        results.push({ zone, ...(await p.evaluate(caseFunction(item))) });
      } finally {
        await c.close();
      }
    }
    return {
      id: item.id,
      title: item.title,
      source: item.source,
      provenance: item.provenance,
      instant: item.instant,
      results,
    };
  }
  async exportReport() {
    if (!this.samples.length) throw Error("还没有实验结果。");
    const data = {
      version: 1,
      environment: {
        browser: this.browser.version(),
        node: process.version,
        platform: process.platform,
      },
      createdAt: new Date().toISOString(),
      scope:
        "Browser main-frame time only; server clocks unchanged. Screenshots are evidence, not automatic bug verdicts.",
      config: this.config,
      actions: this.actions,
      samples: this.samples,
    };
    await writeFile(
      resolve(this.dir, "report.json"),
      JSON.stringify(data, null, 2),
    );
    await writeFile(resolve(this.dir, "reproduce.mjs"), generateScript(data));
    const files = {
      "report.json": strToU8(JSON.stringify(data, null, 2)),
      "reproduce.mjs": strToU8(generateScript(data)),
    };
    for (const sample of data.samples)
      for (const w of sample.worlds)
        files[w.screenshot] = new Uint8Array(
          await readFile(resolve(this.dir, w.screenshot)),
        );
    const esc = (s) =>
      String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
    files["report.html"] = strToU8(
      '<!doctype html><meta charset="utf-8"><title>TimeTrap report</title><style>body{font:14px system-ui;max-width:1200px;margin:40px auto;background:#070707;color:#e5e5e5;padding:20px}img{max-width:100%;border:1px solid #333}.worlds{display:flex;gap:16px}.worlds>div{flex:1;min-width:0}pre{white-space:pre-wrap}section{margin:35px 0}</style><h1>TimeTrap / reproduction report</h1><p>' +
        esc(data.scope) +
        "</p><pre>" +
        esc(JSON.stringify(data.config, null, 2)) +
        "</pre>" +
        data.samples
          .map(
            (sample) =>
              "<section><h2>" +
              esc(sample.seq + " · " + sample.label) +
              '</h2><div class="worlds">' +
              sample.worlds
                .map(
                  (w) =>
                    "<div><h3>" +
                    esc(w.zone) +
                    "</h3><p>" +
                    esc(w.local) +
                    '</p><img src="' +
                    w.screenshot +
                    '"></div>',
                )
                .join("") +
              "</div></section>",
          )
          .join("") +
        "<h2>Recorded actions / explicit checks</h2><pre>" +
        esc(JSON.stringify(data.actions, null, 2)) +
        "</pre>",
    );
    files["README.txt"] = strToU8(
      "Open report.html to review evidence. No internet is required to read screenshots. To replay: place reproduce.mjs in a folder with playwright installed, then node reproduce.mjs. The target URL must still be reachable. Assertions reflect your supplied expectations; no assertions means observation only. Captures may contain private data; review before sharing.",
    );
    await writeFile(resolve(this.dir, "report.zip"), zipSync(files));
    return data;
  }
  async closeWorlds() {
    for (const w of this.worlds) await w.context.close();
    this.worlds = [];
  }
  async close() {
    await this.closeWorlds();
    await this.browser?.close();
    this.browser = null;
  }
}
export function generateScript(data) {
  return `// TimeTrap executable reproduction. Run: node reproduce.mjs\n// npm install playwright && npx playwright install chromium\nimport { chromium } from 'playwright';\nimport assert from 'node:assert/strict';\nconst config=${JSON.stringify(data.config, null, 2)};\nconst actions=${JSON.stringify(data.actions, null, 2)};\nconst browser=await chromium.launch();\ntry {\n for(const zone of config.zones){\n  const context=await browser.newContext({timezoneId:zone,viewport:{width:1000,height:700},serviceWorkers:'block'});\n  try{\n   const page=await context.newPage();page.setDefaultTimeout(6000);\n   await page.clock.install({time:new Date(config.instant)});await page.clock.pauseAt(new Date(config.instant));\n   await page.goto(config.url,{waitUntil:'domcontentloaded'});\n   for(const a of actions){\n    if(a.partial)throw Error('Original run had a partial action; restart and re-record.');\n    if(a.type==='jump')await page.clock.setSystemTime(new Date(a.instant));\n    if(a.type==='advance')await page.clock.runFor(a.ms);\n    if(a.type==='click')await page.locator(a.selector).click();\n    if(a.type==='fill')await page.locator(a.selector).fill(a.value??'');\n    if(a.type==='expect')assert.equal(await page.locator(a.selector).innerText(),String(a.value),zone+' '+a.selector);\n   }\n   await page.screenshot({path:'timetrap-'+zone.replaceAll('/','_')+'.png',animations:'disabled'});\n   console.log(zone+': replayed; '+actions.filter(a=>a.type==='expect').length+' assertions checked');\n  }finally{await context.close();}\n }\n}finally{await browser.close();}\n`;
}
