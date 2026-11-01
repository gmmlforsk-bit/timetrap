const $ = (s) => document.querySelector(s),
  esc = (s) =>
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
let token,
  started = false,
  baseline;
const info = await fetch("/api/info").then((r) => r.json());
token = info.token;
$("#url").value = location.origin + "/fixture";
const presets = {
  fall: "2026-11-01T05:59:00Z",
  spring: "2026-03-08T06:59:00Z",
  year: "2026-12-31T23:59:00Z",
  leap: "2028-02-28T23:59:00Z",
};
async function api(path, data) {
  const r = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-TimeTrap-Token": token },
    body: JSON.stringify(data),
  });
  const result = await r.json();
  if (!r.ok) throw Error(result.error);
  return result;
}
function setStatus(text, error = false) {
  for (const node of document.querySelectorAll(document.body.classList.contains("case-mode") ? "#case-status" : "#status")) {
    node.textContent = text;
    node.className = error ? "error" : "";
  }
}
async function task(message, fn) {
  document.body.classList.add("is-working");
  $(".stage").setAttribute("aria-busy","true");
  setStatus(message);
  document
    .querySelectorAll("button:not(#motion-toggle),input:not(#preview-scrub),textarea")
    .forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    setStatus(e.message, true);
  } finally {
    document.body.classList.remove("is-working");
    $(".stage").setAttribute("aria-busy","false");
    document
      .querySelectorAll("button:not(#motion-toggle),input:not(#preview-scrub),textarea")
      .forEach((b) => (b.disabled = false));
  }
}
function render(sample) {
  const offset = Math.round(
    (Date.parse(sample.worlds[0].instant) - baseline) / 60000,
  );
  $("#timeline").value = Math.max(-120, Math.min(120, offset));
  $("#timeline-label").textContent =
    "T " + (offset >= 0 ? "+ " : "− ") + Math.abs(offset) + " min";
  $("#worlds").innerHTML = sample.worlds
    .map((w,i)=>`<article class="world" style="--world-index:${i}"><div class="world-top"><div class="world-number">WORLD ${String(i+1).padStart(2,'0')}<span>●</span></div><b>${esc(w.zone)}</b><p>${esc(w.local)}</p></div><button class="world-preview" aria-label="放大 ${esc(w.zone)} 实验截图"><img src="/artifacts/${w.screenshot}?v=${Date.now()}" alt="${esc(w.zone)} 实时实验截图"><span>检查这一帧 ↗</span></button><div class="world-bottom"><span>FRAME ${String(sample.seq).padStart(3,'0')}</span><span>${esc(w.instant.slice(11,19))} UTC</span></div>${w.errors.length?`<div class="errors">${w.errors.length} 条页面错误：${esc(w.errors.at(-1))}</div>`:''}</article>`)
    .join("");
  $("#log").innerHTML = (sample.actions ?? [])
    .map(
      (a, i) =>
        `<div>${String(i + 1).padStart(2, "0")} · ${esc(a.type)} ${esc(a.selector ?? a.instant ?? a.ms / 60000 + " min")}${a.checks ? " → " + a.checks.map((c) => `<span class="${c.pass ? "pass" : "fail"}">${esc(c.zone)} ${c.pass ? "PASS" : "FAIL"}</span>`).join(" / ") : ""}</div>`,
    )
    .join("");
  $("#status").textContent =
    `已捕获 ${sample.worlds.length} 个真实浏览器 · 帧 ${sample.seq} · ${sample.label}。点击截图放大。`;
  $("#downloads").innerHTML = "";
}
$("#start").onclick = () =>
  task("正在创建平行浏览器…", async () => {
    const result = await api("start", {
      url: $("#url").value,
      instant: $("#instant").value,
      zones: $("#zones")
        .value.split("\n")
        .map((z) => z.trim())
        .filter(Boolean),
    });
    started = true;
    if (matchMedia("(max-width:750px)").matches)
      $("#config-details").open = false;
    document.body.classList.add("running");
    baseline = Date.parse($("#instant").value);
    $("#timeline").value = 0;
    render(result);
  });
$("#demo").onclick = () => {
  $("#url").value = location.origin + "/fixture";
  $("#instant").value = presets.fall;
  $("#zones").value = "America/New_York\nAsia/Shanghai\nUTC";
  $("#start").click();
  $("#lab").scrollIntoView({behavior:document.body.classList.contains("motion-off")?"instant":"smooth",block:"start"});
};
async function action(a) {
  if (!started) throw Error("请先启动实验。");
  render(await api("action", a));
}
for (const b of document.querySelectorAll("[data-advance]"))
  b.onclick = () =>
    task("正在推进定时器并捕获页面…", () =>
      action({ type: "advance", ms: Number(b.dataset.advance) }),
    );
$("#jump").onclick = () =>
  task("正在跳转时钟…", () =>
    action({ type: "jump", instant: $("#instant").value }),
  );
for (const b of document.querySelectorAll("[data-preset]"))
  b.onclick = () => {
    $("#instant").value = presets[b.dataset.preset];
    if (started) $("#jump").click();
  };
for (const b of document.querySelectorAll("[data-action]"))
  b.onclick = () =>
    task("正在所有时区执行操作…", () =>
      action({
        type: b.dataset.action,
        selector: $("#selector").value,
        value: $("#value").value,
      }),
    );
$("#export").onclick = () =>
  task("正在生成复现报告…", async () => {
    const d = await api("export", {});
    $("#downloads").innerHTML =
      '<a href="/artifacts/report.zip" download>下载完整复现包 ZIP</a><a href="/artifacts/report.json" download>下载完整报告 JSON</a><a href="/artifacts/reproduce.mjs" download>下载可运行测试脚本</a>';
    $("#status").textContent =
      `已生成 ${d.samples.length} 帧、${d.actions.length} 个操作的报告。可下载完整复现包，包含截图和可运行测试。`;
  });
for (const b of document.querySelectorAll("[data-tab]"))
  b.onclick = () => {
    document
      .querySelectorAll("[data-tab]")
      .forEach((x) => x.classList.toggle("active", x === b));
    $("#lab").hidden = b.dataset.tab !== "lab";
    $("#cases").hidden = b.dataset.tab !== "cases";
    const pane=b.dataset.tab==="cases"?$("#cases"):$("#lab");
    pane.animate([{opacity:0,transform:"translateY(10px)"},{opacity:1,transform:"translateY(0)"}],{duration:document.body.classList.contains("motion-off")?0:380,easing:"cubic-bezier(.22,1,.36,1)"});
    document.body.classList.toggle("case-mode", b.dataset.tab === "cases");
  };
$("#case-list").innerHTML = info.cases
  .map(
    (c) =>
      `<article class="case" id="case-${c.id}"><div class="case-head"><div><a href="${c.source}" target="_blank" rel="noreferrer">${esc(c.tag)} ↗</a><h3>${esc(c.title)}</h3></div><button data-run="${c.id}">执行浏览器复现 ↗</button></div><p>${esc(c.provenance)}</p><p>固定瞬间 ${esc(c.instant)}</p><div class="results"></div></article>`,
  )
  .join("");
for (const b of document.querySelectorAll("[data-run]"))
  b.onclick = () =>
    task("正在独立 Chromium 时区环境中验证…", async () => {
      const c = await api("case", { id: b.dataset.run });
      $("#case-" + c.id + " .results").innerHTML =
        `<table><thead><tr><th>时区</th><th>实际结果</th><th>预期结果</th><th>判定</th></tr></thead><tbody>${c.results.map((r) => `<tr><td>${esc(r.zone)}</td><td>${esc(r.actual)}</td><td>${esc(r.expected)}</td><td class="${r.pass ? "pass" : "fail"}">${r.pass ? "PASS · 对照" : "FAIL · 已重现"}</td></tr>`).join("")}</tbody></table><p>${esc(c.results[0].note)}</p>`;
      setStatus(
        c.title +
          "：复现完成。FAIL 表示已重现历史问题；PASS 为未触发的时区对照。",
      );
    });
$("#worlds").addEventListener("click", (e) => {
  const preview=e.target.closest(".world-preview");
  if (preview) {
    $("#zoom img").src = preview.querySelector("img").src;
    $("#zoom").showModal();
  }
});
$("#worlds").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName === "IMG") e.target.click();
});
$("#closezoom").onclick = () => $("#zoom").close();

$("#timeline").oninput = () =>
  ($("#timeline-label").textContent = Number($("#timeline").value) + " min");
$("#timeline").onchange = () =>
  task("正在沿时间轴跳转…", () =>
    action({
      type: "jump",
      instant: new Date(
        (baseline ?? Date.parse($("#instant").value)) +
          Number($("#timeline").value) * 60000,
      ).toISOString(),
    }),
  );

matchMedia("(max-width:750px)").addEventListener("change", (e) => {
  if (started) document.querySelector("#config-details").open = !e.matches;
});

// Independent illustrative clock. It never sends actions to the experiment engine.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionPreference = null;
try { motionPreference = localStorage.getItem('timetrap-motion'); } catch {}
let motionEnabled = motionPreference === null ? !reduceMotion.matches : motionPreference === 'on';
let previewSeconds = 0, previewFrame = 0, previewLast = 0, heroVisible = false;
const previewBase = Date.parse('2026-11-01T05:59:00Z');
const clockFormats = ['America/New_York','Asia/Shanghai','UTC'].map(timeZone =>
  new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
let lastPreviewSecond = -1;
function paintPreview() {
  const second = Math.floor(previewSeconds);
  if (second === lastPreviewSecond) return;
  lastPreviewSecond = second;
  const date = new Date(previewBase + second * 1000);
  ['#preview-ny','#preview-sh','#preview-utc'].forEach((id,i)=>$(id).textContent=clockFormats[i].format(date));
  $('#preview-iso').textContent=clockFormats[2].format(date)+' UTC';
  $('#preview-offset').textContent=second>=60?'UTC−05':'UTC−04';
  $('#preview-phase').textContent=second>=60?'纽约回到 01 点，其他时区继续向前。':'同一个瞬间，三种本地时间。';
  $('#preview-scrub').value=second;
  $('#preview-scrub').setAttribute('aria-valuetext',`经过 ${second} 秒，纽约 ${clockFormats[0].format(date)}`);
  $('#time-sculpture').classList.toggle('crossed',second>=60);
  $('#time-sculpture').style.setProperty('--preview-progress',`${second/1.2}%`);
}
function tickPreview(now) {
  if (previewLast) previewSeconds=(previewSeconds+Math.min(now-previewLast,250)/100)%121;
  previewLast=now;
  paintPreview();
  previewFrame=requestAnimationFrame(tickPreview);
}
function syncPreview() {
  cancelAnimationFrame(previewFrame);previewFrame=0;previewLast=0;
  if(motionEnabled && heroVisible && !document.hidden && !document.body.classList.contains('case-mode'))
    previewFrame=requestAnimationFrame(tickPreview);
}
function applyMotion() {
  document.body.classList.toggle('motion-off',!motionEnabled);
  $('#motion-toggle').setAttribute('aria-pressed',String(motionEnabled));
  $('#motion-toggle').setAttribute('aria-label',motionEnabled?'暂停动效':'开启动效');
  $('.motion-text').textContent=motionEnabled?'动效开启':'动效暂停';
  $('.preview-indicator').textContent=motionEnabled?'交互预演 · 10×':'交互预演 · 手动';
  syncPreview();
}
$('#motion-toggle').onclick=()=>{
  motionEnabled=!motionEnabled;motionPreference=motionEnabled?'on':'off';
  try{localStorage.setItem('timetrap-motion',motionPreference)}catch{}
  applyMotion();
};
reduceMotion.addEventListener('change',()=>{if(motionPreference===null){motionEnabled=!reduceMotion.matches;applyMotion()}});
$('#preview-scrub').addEventListener('input',()=>{
  motionEnabled=false;applyMotion();previewSeconds=Number($('#preview-scrub').value);paintPreview();
});
new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;syncPreview()},{threshold:0}).observe($('.hero'));
document.addEventListener('visibilitychange',syncPreview);
for(const button of document.querySelectorAll('[data-tab]')) button.addEventListener('click',syncPreview);
const revealObserver=new IntersectionObserver(entries=>{
  for(const entry of entries) if(entry.isIntersecting){entry.target.classList.add('revealed');revealObserver.unobserve(entry.target)}
},{threshold:.08});
for(const element of document.querySelectorAll('.actions,.scope-detail,footer')){
  element.classList.add('reveal-ready');revealObserver.observe(element);
}
paintPreview();applyMotion();
