/**
 * インシデント・ゼロ「さくら町立病院の一夜」の、感想と利用状況を受け取る Google フォームを作る。
 *
 * 使い方(PCで5分・一度だけ)
 *   1. https://script.google.com を開き「新しいプロジェクト」
 *   2. 最初からある中身を消して、このファイルの中身を全部貼る
 *   3. 上の「実行」を押す(関数は makeForm)。Google の許可画面が出たら許可する
 *   4. 下の「実行ログ」に出た 3 行を控え、1行目を public/index.html の CONFIG.form に入れる
 *      - 1行目: ゲームに入れる設定(CONFIG.form)
 *      - 2行目: 回答がたまるスプレッドシート
 *      - 3行目: フォームの編集画面(さわらなくてよい)
 *
 * フォームは匿名(メールアドレスを集めない)。ゲームからは、どこまで進んだか・結果・感想だけが送られる。
 */
function makeForm() {
  const KEYS = ["kind", "sid", "ver", "clock", "steps", "rank", "score", "ending", "answers",
                "fun", "again", "stuck", "comment", "device", "plays", "elapsed", "src"];

  const form = FormApp.create("インシデント・ゼロ 感想と利用状況");
  form.setDescription("ゲーム「さくら町立病院の一夜」から自動で送られる回答です。匿名で、個人が分かる情報は含みません。");
  form.setCollectEmail(false);
  form.setShowLinkToRespondAgain(false);
  try { form.setRequireLogin(false); } catch (e) { /* 個人の Google アカウントでは設定項目がない */ }

  const items = {};
  KEYS.forEach(function (k) { items[k] = form.addTextItem().setTitle(k); });

  const ss = SpreadsheetApp.create("インシデント・ゼロ 回答");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // 各項目の送り先の番号(entry.数字)を、事前入力リンクから1つずつ取り出す
  const entries = {};
  KEYS.forEach(function (k) {
    const url = form.createResponse().withItemResponse(items[k].createResponse("x")).toPrefilledUrl();
    const m = url.match(/entry\.(\d+)=/);
    entries[k] = m ? "entry." + m[1] : null;
  });

  const action = form.getPublishedUrl().replace(/\/viewform.*$/, "/formResponse");
  Logger.log(JSON.stringify({ action: action, entries: entries }));
  Logger.log("回答のスプレッドシート: " + ss.getUrl());
  Logger.log("フォームの編集: " + form.getEditUrl());
}
