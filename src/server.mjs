import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { Lab } from "./engine.mjs";
import { cases } from "./cases.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4317);
const host = `http://127.0.0.1:${port}`;
const token = randomBytes(24).toString("hex");
const lab = new Lab(resolve(root, "output/session"));
let busy = false;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
  ".mjs": "text/javascript",
  ".zip": "application/zip",
};
function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
  });
  res.end(
    type === "application/json" && !Buffer.isBuffer(body)
      ? JSON.stringify(body)
      : body,
  );
}
async function body(req) {
  let s = "";
  for await (const c of req) {
    s += c;
    if (s.length > 20000) throw Error("请求过大");
  }
  return JSON.parse(s || "{}");
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}`)
      return send(res, 403, { error: "Loopback access only" });
    const path = new URL(req.url, host).pathname;
    if (path === "/favicon.ico") {
      res.writeHead(204);
      return res.end();
    }
    if (path === "/api/info" && req.method === "GET")
      return send(res, 200, {
        token,
        cases: cases.map(({ code, body, ...c }) => c),
        version: "0.1.1",
      });
    if (path.startsWith("/api/") && req.method === "POST") {
      if (
        req.headers["x-timetrap-token"] !== token ||
        (req.headers.origin && req.headers.origin !== host)
      )
        return send(res, 403, { error: "Invalid local session" });
      if (busy) return send(res, 409, { error: "实验正在执行，请稍候。" });
      busy = true;
      try {
        const b = await body(req);
        let result;
        if (path === "/api/start") result = await lab.start(b);
        else if (path === "/api/action") result = await lab.act(b);
        else if (path === "/api/case") result = await lab.runCase(b.id);
        else if (path === "/api/export") result = await lab.exportReport();
        else return send(res, 404, { error: "Not found" });
        return send(res, 200, result);
      } finally {
        busy = false;
      }
    }
    if (req.method !== "GET")
      return send(res, 405, { error: "Method not allowed" });
    let file;
    if (path.startsWith("/artifacts/")) {
      const name = path.slice(11);
      if (
        !/^(\d+-\d+\.png|report\.json|report\.zip|reproduce\.mjs)$/.test(name)
      )
        return send(res, 404, {});
      file = resolve(root, "output/session", name);
    } else {
      const names = {
        "/": "index.html",
        "/app.js": "app.js",
        "/style.css": "style.css",
        "/fixture": "fixture.html",
      };
      if (!names[path]) return send(res, 404, { error: "Not found" });
      file = resolve(root, "public", names[path]);
    }
    send(res, 200, await readFile(file), types[extname(file)] || "text/plain");
  } catch (e) {
    send(res, e.code === "ENOENT" ? 404 : 400, { error: e.message });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `TimeTrap ready: ${host}\nLocal browser clock lab · Ctrl+C to stop`,
  ),
);
async function close() {
  await lab.close();
  server.close(() => process.exit(0));
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
