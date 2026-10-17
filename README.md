# Incident Zero — One Night at Sakura Town Hospital

**Play: https://omicreate.github.io/incident-zero/**

A single-player browser game about incident response. At 0:24 a.m., every medical record in a small town's only hospital stops opening. You are the one office worker who has looked after the hospital's systems. Before outpatient hours begin at 8:30 a.m., what do you shut down, what do you uncover, and what do you choose?

- Every action moves the clock forward. You can't do everything.
- How the attackers got in, the backdoor they left, whether the backups survived and whether data was stolen all change every game. You have to investigate.
- No right/wrong pop-ups along the way. At the end, a debrief compares your night with a real, publicly reported incident.

About 15–25 minutes per game. Japanese only. No server, no sign-up.

---

## インシデント・ゼロ — さくら町立病院の一夜

夜中の0時24分、町にひとつしかない病院のカルテが、ぜんぶ開かなくなる。
あなたは、この病院のシステムを一人で見てきた事務職員。朝8時30分の外来までに、何を止め、何を見抜き、何を選ぶか。

ブラウザだけで遊べる、一人用の事件対応ゲーム(1回15〜25分)。登録もサーバ処理もない。

- 行動するたびに時計が進む。全部はできない
- どこから入られたか・裏口・控え・持ち出しは、調べないと分からない。答えは毎回変わる
- 途中で正解・不正解は出ない。最後に、ふりかえり会で実際の事件(半田病院・2021年)と見比べる

## 安全の約束

- 実在の攻撃の手順・コマンド・設定値・弱点を突く具体的なやり方は書かない
- 病院・人物・会社・出来事の細部は架空。下敷きにした事件は、結末で出典を添える
- 登場人物の絵は顔を出さない(後ろ姿とシルエットだけ)

## 構成

```
public/index.html     ゲーム本体(HTML・CSS・JS を1枚に収めている)
public/img/*.jpg      場面と登場人物の絵、共有用の画像(ogp.jpg)
public/404.html       見つからないとき
tools/check.mjs       整合チェック(依存なし。CI でも走る)
tools/sim.mjs         バランス確認(遊び方ごとに何百回も自動で遊ばせる)
tools/make-form.gs    感想と利用状況を受け取る Google フォームを作るスクリプト
docs/art-direction.md 絵の方針
```

`public/index.html` の中は2つに分かれている。

- `/* ==== ENGINE START ====` 〜 `/* ==== ENGINE END ==== */` … ゲームの仕組み(画面に触れない)。行動は `ACTIONS`、時刻で起きる出来事は `EVENTS`、結末は `finish()`
- `/* ====== 画面 ====== */` から下 … 画面・音・保存・共有・感想。先頭の `CONFIG` に公開URLと送り先がある

## 確かめ方

```
node tools/check.mjs      # 絵がそろっているか・500回とも結末まで進むか・S の出かたが想定内か
node tools/sim.mjs 400    # 遊び方ごとの平均点・ランクの割合・「待つ」の回数
```

## 公開

main に push すると、`.github/workflows/pages.yml` が `public/` を GitHub Pages に公開する(チェックが通らなければ公開しない)。

## 感想と利用状況(Google フォーム)

1. https://script.google.com で新しいプロジェクトを作り、`tools/make-form.gs` を貼って `makeForm` を実行する
2. 実行ログの1行目(`{"action": ..., "entries": {...}}`)を、`public/index.html` の `CONFIG.form` に入れる
3. 回答は、ログの2行目のスプレッドシートにたまる

送るもの: 遊び始め・2時/4時/6時の通過・結末(ランク・点数・今夜の答え)・プレイヤーが送った感想、それとリンクに付けた `?src=` の印(どこから来たか)。名前やメールなど個人が分かる情報は送らない。
`CONFIG.form` が `null` のあいだは何も送らず、感想の欄も出ない。プレイヤーはタイトル画面で「送らないようにする」を選べる。

## ライセンス

The code is MIT-licensed ([LICENSE](LICENSE)). The story, characters, artwork and text are not ([NOTICE.md](NOTICE.md)).
コードは MIT。物語・登場人物・絵・文章は MIT の対象外。
