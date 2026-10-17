// 一夜の整合チェック(依存なし)。CI と手元の両方で `node tools/check.mjs` を実行する。
// public/index.html の「ENGINE START」〜「ENGINE END」だけを取り出し、画面なしで何百回も遊ばせて確かめる。
import { readFileSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const a = html.indexOf("/* ==== ENGINE START"), b = html.indexOf("/* ==== ENGINE END ==== */");
if (a < 0 || b < 0) { console.error("ENGINE の目印が見つからない"); process.exit(1); }
const E = runInNewContext(html.slice(a, b) + "\n;({ newGame, doAction, chooseEvent, eventChoices, visibleActions, avail, placeOf, ACTIONS, EVENTS, END })");

const errors = [];
const img = (name) => new URL("../public/img/" + name + ".jpg", import.meta.url);

// 1. 行動と出来事の id が重ならない
const ids = [...E.ACTIONS.map((x) => x.id), ...E.EVENTS.map((x) => x.id)];
ids.filter((x, i) => ids.indexOf(x) !== i).forEach((x) => errors.push("id が重複 " + x));

// 2. 使う絵がそろっている(場所・人物・タイトル・共有用)
const places = new Set(["office", "exterior", "ogp"]);
for (const x of [...E.ACTIONS, ...E.EVENTS]) {
  if (typeof x.place === "string") places.add(x.place);
  if (typeof x.place === "function") ["server", "makabe"].forEach((p) => places.add(p));
}
for (const p of ["miyoshi", "tachibana", "makabe", "oka"]) places.add(p);
for (const p of places) if (!existsSync(img(p))) errors.push("絵がない public/img/" + p + ".jpg");

// 3. 再現できる乱数で遊ばせる
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const okActs = (g) => E.visibleActions(g).filter((x) => E.avail(g, x).ok).map((x) => x.id);
const okChoices = (g) => E.eventChoices(g).map((c, i) => (c.need && c.need(g) ? -1 : i)).filter((i) => i >= 0);
function play(seed, act, ev) {
  const r = rng(seed), g = E.newGame(r);
  let n = 0;
  while (!g.ended && n++ < 500) { if (g.pending) E.chooseEvent(g, ev(g, r)); else E.doAction(g, act(g, r)); }
  return g;
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
// でたらめに遊ぶ人: どの回も 8:30 に結末まで進む
let broken = 0;
for (let i = 0; i < 500; i++) {
  const g = play(1000 + i, (g, r) => pick(okActs(g), r), (g, r) => pick(okChoices(g), r));
  if (!g.ended || !g.result || g.t !== E.END) broken++;
}
if (broken) errors.push("結末まで進まない回 " + broken + " / 500");
// 何もしない人: いつも C
const passive = Array.from({ length: 100 }, (_, i) => play(3000 + i, () => "wait", (g) => okChoices(g)[0]));
if (passive.some((g) => g.result.rank !== "C")) errors.push("何もしないのに C 以外になる回がある");
// 推理する慣れた人: S が出るが、出すぎない(20〜90%)
function deduce(g) {
  const pri = ["cut_outside", "call_ir", "detach_backup", "paper", "wake_director", "notify_staff", "segment", "police", "check_backup", "check_server"];
  if (g.used.check_server) {
    if (g.hidden.entry === "mail") pri.push("check_mail", "close_mail");
    else if (!g.used.check_vpn) pri.push("check_vpn");
    else pri.push(g.identified && g.hidden.entry === "vpn" ? "close_vpn" : "close_vendor");
  }
  pri.push("check_admin", "rm_admin");
  if (g.ir.onsite) pri.push("preserve", "check_process", "rm_task", "rm_tool", "restore_ref");
  pri.push("rm_task", "neighbor", "report_pref", "check_egress");
  const ok = okActs(g);
  return pri.find((x) => ok.includes(x)) || "wait";
}
function careful(g) {
  const ok = okChoices(g);
  const want = { ambulance: g.paperReady ? 0 : 1, recovery: g.police ? 1 : 2, threat: ok.includes(1) ? 1 : 0, staff: 0, press: g.director ? 0 : 1,
    morning: g.closed[g.hidden.entry] && g.removed[g.hidden.backdoor] ? 0 : 1, outpatient: g.paperReady ? 0 : (ok.includes(1) ? 1 : 0) }[g.pending];
  return want !== undefined && ok.includes(want) ? want : ok[0];
}
const skilled = Array.from({ length: 200 }, (_, i) => play(5000 + i, deduce, careful));
const sRate = skilled.filter((g) => g.result.rank === "S").length / skilled.length;
if (sRate < 0.2 || sRate > 0.9) errors.push("推理する人の S の割合が想定外 " + Math.round(sRate * 100) + "%");

console.log("STATS", JSON.stringify({ actions: E.ACTIONS.length, events: E.EVENTS.length, images: places.size, skilledS: Math.round(sRate * 100) + "%" }));
console.log("ERRORS", errors.length); errors.forEach((e) => console.log("  ✗ " + e));
console.log(errors.length === 0 ? "CHECK PASS" : "CHECK FAIL");
process.exit(errors.length === 0 ? 0 : 1);
