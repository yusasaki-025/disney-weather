# ディズニー行く日決め weather 比較ダッシュボード

TDL ･ TDS に行く日を決めるための天気比較ダッシュボードです。

複数の天気予報を横並びで比較し、「パレードが中止にならない快適な日」を一目で判断できます。

同行者と URL 1 本で共有しながら相談する用途を想定しています。

## Cowork 版と公開版の機能差 (§0.7)

同じ `dist/artifact.html` を 2 系統で使えます。ランタイム判定 (`src/utils/runtime.js` の `isCowork()`) で個人連携ボタンを出し分けます。

| 機能 | Cowork 版 (個人用) | 公開版 (Cloudflare Pages 等・閲覧専用) |
|---|---|---|
| 天気比較 ・ スコア ・ グラフ ・ 服装 ・ 雨雲レーダー | 動作 | 動作 |
| URL コピー ・ ダークモード ・ 印刷 ・ ヘルプ | 動作 | 動作 |
| Notion 送信 ・ カレンダー登録 | 動作 | 非表示 (Cowork ランタイム必須) |

公開版では `window.cowork` が無いため、個人連携ボタンはそもそも表示されません。

---

## できること

- 今日 ＋ 14 日 (15 日分) の予報を、ソース横並び (気象庁 / Open-Meteo) で比較
- 日ごとの総合スコア (◎ ○ △ ×) ＋ 朝 / 昼 / 夜 サブスコア (昼パレード時刻を最重視)
- 風キャン ･ 雨キャン ･ 熱キャン (WBGT) の 3 バッジ
- おすすめ TOP3 ハイライト
- 行をクリックで時系列グラフ (降水確率 ･ 風速 ･ 気温) ＋ 持ち物 ･ 服装サジェスト
- 並び替え (日付順がデフォルト / スコア順)、絞り込み (平日 / 土日祝 / ◎ ○ のみ)、表示状態は自動保存
- パーク切替 (TDL / TDS、TDS はハーバーショーがあるので風減点を強める)
- 同行者の都合 NG 日マーク、QR コード共有
- データ鮮度ラベル (各セル「最終更新◯分前」)、60 秒ごとの自動更新 (タブ非アクティブ時は停止)
- ダークモード (OS 設定追従 ＋ 手動トグル)、用語集 ・ ヘルプ、当日 ・ 前日の雨雲レーダー、印刷モード
- Notion 連携 (候補送信)、Google Calendar 連携 (予定追加) ※ Cowork artifact 上で有効

---

## いちばん簡単な使い方 (Cowork artifact)

`dist/artifact.html` を Cowork の artifact として登録すると、リロードするたびに最新予報を取得して表示します。

同行者には artifact の共有 URL を渡すか、画面の「QR」ボタンで QR を見せてください。

---

## 手元で見たいとき

Claude Code に次のように伝えてください。

> disney-weather プロジェクトでローカルサーバーを立ち上げて、ブラウザで開いて

(内部的には `npm install` → `npm run dev` を実行し、表示された `http://localhost:5173` を開きます)

ビルドして 1 枚の HTML にまとめたいときは、こう伝えてください。

> disney-weather をビルドして dist/artifact.html を作って

(内部的には `npm run build` を実行し、`dist/artifact.html` に単一 HTML が出力されます)

---

## データソース

| ソース | 取得項目 | 認証 | 備考 |
|---|---|---|---|
| 気象庁 (JMA) | 降水確率 ･ 気温 ･ 天気概況 | 不要 | 風速 ･ UV ･ 時系列は非構造化のため非対応 |
| Open-Meteo | 気温 ･ 体感 ･ 降水 ･ 風速 ･ 突風 ･ UV ･ 時系列 | 不要 | メインソース。15 日全日をカバー |
| 環境省 WBGT | 暑さ指数の予測値 | 不要 | CORS 制約でブラウザから直接取得不可。下記参照 |
| OpenWeather | 8 日分の hourly / daily | API キー | 任意 (Phase 2)。プロキシ経由で有効化 |

座標は TDL ･ TDS 共通で舞浜駅近辺 (`lat=35.6329, lon=139.8804`) を使います。

### WBGT (暑さ指数) について

環境省の暑さ指数 CSV は CORS ヘッダーを返さないため、ブラウザの artifact から直接は取得できません。

そのため通常は Open-Meteo の気温 ＋ 湿度から簡易式で推定し、画面には「(推定)」と表示します。

プロキシ経由などで環境省データが取れた場合のみ「(環境省)」表示に切り替わります。

---

## スコアの読み方

総合スコア ＝ 100 - (風減点 ＋ 雨減点 ＋ 熱中症減点 ＋ 寒さ減点 ＋ UV減点) です。

- ◎ 85 以上 : 行くべき
- ○ 70 以上 : 行ってよい
- △ 50 以上 : 微妙 (風 or 雨に注意)
- × 50 未満 : 別日推奨

風 ･ 雨 ･ 熱の減点は、季節限定の昼パレード時刻 (TDL 13:00 / 14:30 ･ TDS 11:30 / 14:00) の前後 1 時間を最優先で見ます。

ナイトパレードは通年演目のため参考扱いです。

スコアの詳細ロジックは仕様書 §5 と [src/score/scoring.js](src/score/scoring.js) を参照してください。

---

## Notion 連携を有効にする

1. Notion で「ディズニー行く日候補」データベースを作る (プロパティ案は仕様書 §11.1)。
2. そのデータベースの ID を [src/integrations/notion.js](src/integrations/notion.js) の `NOTION_CONFIG` に設定する。
3. Cowork の Notion コネクタのツール ID を同じく `NOTION_CONFIG.createTool` に合わせる。

Claude Code にこう伝えれば代わりに設定します。

> 作った Notion DB の URL はこれ : (ここに URL)。disney-weather の Notion 連携を有効にして

設定が未完了の間は「Notion 送信」ボタンを押すとその場でエラー文が出るだけで、他の機能には影響しません。

---

## Google Calendar 連携

行を開いて「カレンダー登録」を押すと、確認ダイアログのあと当日 8:00 - 22:00 の予定を追加します。

Cowork の Google Calendar コネクタのツール ID を [src/integrations/gcal.js](src/integrations/gcal.js) の `GCAL_CONFIG.createTool` に合わせてください。

---

## パレード時刻の更新 (月 1 目安)

公式の運行スケジュールに公開 API が無いため、典型的な時刻を [src/data/showSchedule.js](src/data/showSchedule.js) に固定値で持っています。

公式と乖離したらこのファイルだけ手で直してください。

Claude Code にこう伝えれば更新します。

> disney-weather のパレード時刻を更新して。TDL のデイパレードは 13:30 と 15:00 に変わった

---

## OpenWeather を追加する (任意 ･ Phase 2)

1. OpenWeather の API キーを取得する。
2. `workers/openweather-proxy.js` を Cloudflare Workers にデプロイし、キーを Secret として設定する。
3. 出力された Worker URL を [src/main.js](src/main.js) の `CONFIG.openWeatherProxyUrl` に設定する。

API キーは artifact には絶対に埋め込みません (プロキシ側にだけ置きます)。

---

## 開発

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー (HMR) |
| `npm test` | ユニットテスト (Vitest) |
| `npm run coverage` | カバレッジ計測 |
| `npm run lint` | ESLint |
| `npm run build` | `dist/artifact.html` を生成 |

スコアロジック ([src/score/scoring.js](src/score/scoring.js)) はテストカバレッジ 100% です。

---

## 既知の制約 ･ 仕様との差分

- テーブルは仕様書が挙げた Grid.js ではなく素の HTML テーブルで実装しました (展開行 ･ 色 ＋ 記号セル ･ アクセシビリティの制御を素直にするため)。
- 気象庁は風速 ･ UV ･ 時系列を構造化提供しないため、これらの値とグラフは Open-Meteo (と任意の OpenWeather) が主体です。
- 環境省 WBGT は CORS 制約で通常は取得できず、簡易計算 (推定値、誤差 ±1.5℃ 程度) で代替します。
- 環境省 WBGT 予測の提供は概ね 4 - 10 月 (夏季) のみです。期間外は簡易計算になります。
- 的中追跡 (§3.12) ･ ソース信頼度補正 (§5.4) は Phase 2 のため、ロジックの土台のみ用意し未稼働です。
- 雨雲レーダー (§3.18) は気象庁ページが frame-ancestors CSP で iframe 埋め込みを拒否するため、当日 ・ 前日のみ「公式ページを新しいタブで開く」直リンクカードにしています (§3.18 のフォールバック準拠)。
- 自動通知 (§3.19・scheduled task) ･ PWA (§6.8) ･ テスト基盤 (msw ＋ Playwright、§7.4) は今回のパスでは未実装です (依存 ・ 構成上のトレードオフのため別途判断)。
