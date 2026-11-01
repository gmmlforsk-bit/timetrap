import { stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
const cc = stripTypeScriptTypes(
  readFileSync(
    new URL("../vendor/cc-switch-extracted.ts", import.meta.url),
    "utf8",
  ),
).replaceAll("export ", "");
const claw = stripTypeScriptTypes(
  readFileSync(
    new URL("../vendor/openclaw-extracted.ts", import.meta.url),
    "utf8",
  ),
).replace("export { dateBucketId };", "");
export const cases = [
  {
    id: "lookback",
    title: "七天，少了一天",
    tag: "CC Switch · #8719",
    source: "https://github.com/farion1231/cc-switch/issues/8719",
    provenance: "运行固定提交的原始函数摘录；非完整桌面应用。",
    instant: "2026-11-03T04:30:00Z",
    zones: ["America/New_York", "Asia/Shanghai", "UTC"],
    code: cc,
    body: `const now=Date.now(); const actual=new Date(resolveUsageRange({preset:'7d'},now).startDate*1000); const d=new Date(now); const expected=new Date(d.getFullYear(),d.getMonth(),d.getDate()-6); return {actual:fmt(actual),expected:fmt(expected),pass:actual.getTime()===expected.getTime(),note:'最近七个本地日，应从六天前的零点开始。固定减 24 小时在夏令时边界会偏移。'};`,
  },
  {
    id: "grouping",
    title: "消失的「昨天」",
    tag: "OpenClaw · #130944",
    source: "https://github.com/openclaw/openclaw/issues/130944",
    provenance: "运行固定提交 dateBucketId 原始函数；非完整会话界面。",
    instant: "2026-11-02T20:00:00Z",
    zones: ["America/Los_Angeles", "Asia/Shanghai", "UTC"],
    code: claw,
    body: `const d=new Date(); const row=new Date(d.getFullYear(),d.getMonth(),d.getDate()-1); const actual=dateBucketId(row.getTime(),d.getTime()); return {actual,expected:'yesterday',pass:actual==='yesterday',note:'昨天零点的一条记录应归入 yesterday。固定 24 小时无法覆盖秋季 25 小时的本地日。'};`,
  },
  {
    id: "date-only",
    title: "选了十号，存成九号",
    tag: "react-datepicker · #1018",
    source: "https://github.com/Hacker0x01/react-datepicker/issues/1018",
    provenance:
      "按报告重建的日期序列化用法；不是组件源码，也不归因于组件缺陷。",
    instant: "2017-09-10T12:00:00Z",
    zones: ["Europe/Moscow", "Asia/Shanghai", "UTC"],
    code: "",
    body: `const selected=new Date(2017,8,10); const actual=selected.toISOString().slice(0,10); return {actual,expected:'2017-09-10',pass:actual==='2017-09-10',note:'日期字段误用 UTC 时间戳取日期会改变用户选择的日期。修复应保存本地年月日，而非截断 ISO 时间戳。'};`,
  },
];
export function caseFunction(item) {
  return new Function(
    `${item.code}\nconst fmt=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');\n${item.body}`,
  );
}
