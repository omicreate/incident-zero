// 分岐と演出データの整合チェック(依存なし)。CI と手元の両方で `node tools/check.mjs` を実行する。
// public/index.html から「const SCENARIOS」〜「状態」コメントの間のデータ部だけを取り出して検証する。
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const START = "const SCENARIOS = {";
const END = "/* ====== 状態 ====== */";
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < 0 || b < a) {
  console.error("データ部の目印が見つからない(" + START + " / " + END + ")");
  process.exit(1);
}
const NAMES = ["SCENARIOS", "ROLES", "DIFFS", "GLOSS", "TERM", "ADVISOR", "SCRIPTS", "CUT", "GATE", "TECH", "STEP_TECH"];
const D = runInNewContext(html.slice(a, b) + "\n;({" + NAMES.join(",") + "})");
const { SCENARIOS, ROLES, SCRIPTS, CUT, GATE, ADVISOR, TERM, TECH, STEP_TECH } = D;

const errors = [], warns = [];
const stats = { scripts: 0, scenes: 0, endings: 0, reachable: 0 };
const META = new Set(["_learn", "_src"]);
const ENDS = ["win", "mix", "loss", "atk_success", "atk_partial", "atk_deterred"];

for (const scn of Object.keys(SCENARIOS)) {
  for (const role of Object.keys(ROLES)) {
    const key = scn + ":" + role;
    const S = SCRIPTS[key];
    stats.scripts++;
    if (!S) { errors.push("台本がない " + key); continue; }
    if (!S.start) errors.push(key + ": start がない");
    const ids = Object.keys(S).filter((k) => !META.has(k));
    // 1. 選択肢の行き先が存在する。END に行く場面は end キーを持つ
    for (const sid of ids) {
      stats.scenes++;
      const sc = S[sid];
      if (!Array.isArray(sc.choices) || sc.choices.length === 0) errors.push(key + ":" + sid + " 選択肢がない");
      let terminal = false;
      (sc.choices || []).forEach((ch, i) => {
        if (ch.next === "END") terminal = true;
        else if (!S[ch.next]) errors.push(key + ":" + sid + " choice[" + i + "] → 存在しない場面 " + ch.next);
      });
      if (terminal) {
        stats.endings++;
        if (!sc.end) errors.push(key + ":" + sid + " 終端なのに end キーがない");
        else if (!ENDS.includes(sc.end)) errors.push(key + ":" + sid + " 不正な end キー " + sc.end);
      }
    }
    // 2. start から全場面に届く(幅優先)
    const seen = new Set(), q = ["start"];
    while (q.length) {
      const id = q.shift();
      if (seen.has(id) || !S[id]) continue;
      seen.add(id);
      (S[id].choices || []).forEach((ch) => { if (ch.next !== "END" && !seen.has(ch.next)) q.push(ch.next); });
    }
    stats.reachable += seen.size;
    for (const sid of ids) if (!seen.has(sid)) warns.push(key + ":" + sid + " start から届かない");
    // 3. 学びと出典
    if (!Array.isArray(S._learn) || S._learn.length < 3) errors.push(key + ": _learn が足りない");
    if (!S._src) errors.push(key + ": _src がない");
  }
}
// 4. 演出データのキーは実在の場面を指す
for (const [name, map] of [["CUT", CUT], ["GATE", GATE], ["ADVISOR", ADVISOR], ["TERM", TERM], ["STEP_TECH", STEP_TECH]]) {
  for (const k of Object.keys(map)) {
    const [scn, role, sid] = k.split(":");
    if (!SCRIPTS[scn + ":" + role] || !SCRIPTS[scn + ":" + role][sid]) errors.push(name + " のキー " + k + " → 場面がない");
  }
}
// 5. 専門解説は全舞台にあり、出典は https
for (const scn of Object.keys(SCENARIOS)) {
  const t = TECH[scn];
  if (!t) { errors.push("TECH がない " + scn); continue; }
  if (!t.lead?.defend || !t.lead?.attack) errors.push("TECH " + scn + ": lead の攻守どちらかがない");
  if (!t.chain?.length || !t.ctrl?.length || !t.refs?.length) errors.push("TECH " + scn + ": chain/ctrl/refs が空");
  (t.refs || []).forEach((r) => { if (!/^https:\/\//.test(r.u)) errors.push("TECH " + scn + ": https でない出典 " + r.u); });
}

console.log("STATS", JSON.stringify({ ...stats, techTags: Object.keys(STEP_TECH).length }));
console.log("ERRORS", errors.length); errors.forEach((e) => console.log("  ✗ " + e));
console.log("WARNINGS", warns.length); warns.forEach((w) => console.log("  ! " + w));
console.log(errors.length === 0 ? "CHECK PASS" : "CHECK FAIL");
process.exit(errors.length === 0 ? 0 : 1);
