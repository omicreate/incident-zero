// 最小版のバランス確認。index.html の ENGINE 部分だけを取り出して、いろいろな遊び方で何百回も自動で遊ばせる。
// 使い方: node tools/sim.mjs [回数]
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const a = html.indexOf("/* ==== ENGINE START"), b = html.indexOf("/* ==== ENGINE END ==== */");
if (a < 0 || b < 0) { console.error("ENGINE の目印が見つからない"); process.exit(1); }
const E = runInNewContext(html.slice(a, b) + "\n;({ newGame, doAction, chooseEvent, eventChoices, visibleActions, avail, ACT, EV, END })");
const N = Number(process.argv[2]) || 400;

// 再現できる乱数
function mulberry32(s) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function okActions(g) { return E.visibleActions(g).filter((x) => E.avail(g, x).ok).map((x) => x.id); }
function okChoices(g) { return E.eventChoices(g).map((c, i) => (c.need && c.need(g) ? -1 : i)).filter((i) => i >= 0); }

function play(seed, actPolicy, evPolicy) {
  const rng = mulberry32(seed);
  const g = E.newGame(rng);
  let decisions = 0, guard = 0;
  while (!g.ended && guard++ < 500) {
    decisions++;
    if (g.pending) E.chooseEvent(g, evPolicy(g, rng));
    else E.doAction(g, actPolicy(g, rng));
  }
  return { g, decisions };
}

// ---- 遊び方 ----
const pickR = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const randomAct = (g, rng) => { const ids = okActions(g); const nw = ids.filter((x) => x !== "wait"); return nw.length && rng() < 0.9 ? pickR(nw, rng) : pickR(ids, rng); };
const randomEv = (g, rng) => pickR(okChoices(g), rng);

// 何もしない人
const passiveAct = () => "wait";
const passiveEv = (g) => ({ ambulance: 0, recovery: 2, threat: 0, staff: 1, press: 1, morning: 1, outpatient: 0 }[g.pending] ?? okChoices(g)[0]);

// あわてる人: 電源を落とし、全部抜き、業者に電話して待つ。記者には否定し、朝はつなぐ
const naiveSeq = ["power_off", "unplug_all", "call_vendor", "check_vpn", "close_vpn", "wake_director"];
const naiveAct = (g) => naiveSeq.find((id) => okActions(g).includes(id)) || "wait";
const naiveEv = (g) => ({ ambulance: 0, recovery: 0, threat: 2, staff: 1, press: 2, morning: 0, outpatient: 0 }[g.pending] ?? okChoices(g)[0]);
const naiveEvOk = (g, rng) => { const c = naiveEv(g); return okChoices(g).includes(c) ? c : okChoices(g)[0]; };

// 慣れた人(答えはズルして知っている = 上限の目安)
function expertAct(cut) {
  return (g) => {
    const H = g.hidden;
    const pri = ["cut_outside", "call_ir", "detach_backup", "paper", "wake_director", "notify_staff", cut, "police", "check_backup"];
    pri.push({ vpn: "check_vpn", vendor: "call_vendor", mail: "check_mail" }[H.entry], { vpn: "close_vpn", vendor: "close_vendor", mail: "close_mail" }[H.entry]);
    pri.push("check_admin", "rm_admin");
    if (g.ir.onsite) pri.push("preserve", "check_process", "rm_task", "rm_tool", "restore_ref");
    pri.push("rm_task", "neighbor", "report_pref", "check_egress");
    const ok = okActions(g);
    return pri.find((id) => ok.includes(id)) || "wait";
  };
}
function expertEv(g) {
  const ok = okChoices(g);
  const want = {
    ambulance: g.paperReady ? 0 : 1, recovery: g.police ? 1 : 2, threat: ok.includes(1) ? 1 : 0, staff: 0,
    press: g.director ? 0 : 1, morning: (g.closed[g.hidden.entry] && g.removed[g.hidden.backdoor]) ? 0 : 1,
  }[g.pending];
  if (want !== undefined && ok.includes(want)) return want;
  if (g.pending === "outpatient") { // 3つを試して一番よいもの
    let best = ok[0], bs = -1;
    for (const i of ok) { const c = structuredClone(g); E.chooseEvent(c, i); if (c.result.score > bs) { bs = c.result.score; best = i; } }
    return best;
  }
  return ok[0];
}
// 慣れているが答えは知らない人: 入口は全部塞ぐ(時間で払う)
function hedgeAct(g) {
  const pri = ["cut_outside", "call_ir", "detach_backup", "paper", "wake_director", "notify_staff", "segment", "police", "check_backup",
    "check_mail", "close_vpn", "close_vendor", "close_mail", "check_admin", "rm_admin"];
  if (g.ir.onsite) pri.push("preserve", "check_process", "rm_task", "rm_tool", "restore_ref");
  pri.push("rm_task", "neighbor", "report_pref", "check_egress");
  const ok = okActions(g);
  return pri.find((id) => ok.includes(id)) || "wait";
}

// 慣れていて、画面に出た手がかりだけで推理する人
function deduceAct(g) {
  const pri = ["cut_outside", "call_ir", "detach_backup", "paper", "wake_director", "notify_staff", "segment", "police", "check_backup", "check_server"];
  if (g.used.check_server) {
    if (g.hidden.entry === "mail") pri.push("check_mail", "close_mail"); // サーバの記録に「医事課のPC」と出ている
    else if (!g.used.check_vpn) pri.push("check_vpn");
    else pri.push(g.identified && g.hidden.entry === "vpn" ? "close_vpn" : "close_vendor"); // VPNに跡がなければ業者
  }
  pri.push("check_admin", "rm_admin");
  if (g.ir.onsite) pri.push("preserve", "check_process", "rm_task", "rm_tool", "restore_ref");
  pri.push("rm_task", "neighbor", "report_pref", "check_egress");
  const ok = okActions(g);
  return pri.find((id) => ok.includes(id)) || "wait";
}

const STRATS = {
  "何もしない": [passiveAct, passiveEv],
  "でたらめ": [randomAct, randomEv],
  "あわてる": [naiveAct, naiveEvOk],
  "慣れた人(全部塞ぐ)": [hedgeAct, expertEv],
  "慣れた人(推理する)": [deduceAct, expertEv],
  "答えを知る(分ける)": [expertAct("segment"), expertEv],
  "答えを知る(全部抜く)": [expertAct("unplug_all"), expertEv],
};

const pct = (n) => (100 * n / N).toFixed(0).padStart(3) + "%";
const avg = (xs) => (xs.reduce((s, x) => s + x, 0) / xs.length);
for (const [name, [ap, ep]] of Object.entries(STRATS)) {
  const rs = [];
  for (let i = 0; i < N; i++) rs.push(play(1000 + i, ap, ep));
  const ranks = { S: 0, A: 0, B: 0, C: 0 };
  rs.forEach((r) => ranks[r.g.result.rank]++);
  const m = (k) => avg(rs.map((r) => r.g.m[k])).toFixed(0).padStart(3);
  const waits = avg(rs.map((r) => r.g.used.wait || 0)).toFixed(1);
  const reinf = rs.filter((r) => r.g.result.reinfect).length;
  console.log(
    name.padEnd(14, "　"),
    "点", avg(rs.map((r) => r.g.result.score)).toFixed(0).padStart(3),
    "| S" + pct(ranks.S), "A" + pct(ranks.A), "B" + pct(ranks.B), "C" + pct(ranks.C),
    "| 広" + m("spread"), "患" + m("patient"), "信" + m("trust"), "証" + m("evidence"),
    "| 判断", avg(rs.map((r) => r.decisions)).toFixed(0), "待つ", waits, "| 再侵入", pct(reinf),
  );
}

// 出来事と結末のつじつま(どの回でも 8:30 に終わり、結果がある)
let broken = 0;
for (let i = 0; i < N; i++) { const { g } = play(5000 + i, randomAct, randomEv); if (!g.ended || !g.result || g.t !== E.END) broken++; }
console.log(broken ? "NG: 終わらない回 " + broken : "OK: " + N + "回とも 8:30 に結末まで進んだ");
