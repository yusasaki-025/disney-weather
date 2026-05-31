# マイハマびより (disney-weather)

舞浜の天気からショー ・ パレード中止リスクを予測する個人向けツールです。

複数の天気予報を横並びで比較し、「パレードが中止にならない快適な日」を一目で判断できます。

同行者と URL 1 本で共有しながら相談する用途を想定しています。

公開 URL : <https://disney-weather.pages.dev>

## できること

- 今日 ＋ 14 日 (15 日分) の予報を、ソース横並び (気象庁 / Open-Meteo) で比較
- 日ごとの総合スコア (**ベスト / OK / 微妙 / 別日**) ＋ 朝 / 昼 / 夜 サブスコア (昼パレード時刻を最重視)
- 風 ・ 雨 ・ 熱 (WBGT) の 3 バッジ ・ ショー別風キャン閾値 (§0.30 過去風キャン記録に基づく)
- おすすめ TOP3 ハイライト
- 行 (カード) をタップで詳細パネル展開 ・ 時系列グラフ + ショースケジュール + 服装サジェスト
- 並び替え (日付順 / スコア順) ・ 絞り込み (平日 / 土日祝 / おすすめ日のみ) ・ 表示状態は自動保存
- TDL / TDS 切替 (詳細パネル内タブ)
- ヘッダー2ボタンに簡素化 (更新 ・ ヘルプ) ・ スマホはカード形式
- 公式日別ショースケジュール (取得済みの月のみ ・ 月1運用)
- 当日中止情報 (operation-log 取得済みの日のみ表示)
- 過去風キャン記録に基づくショー別閾値 ・ Phase 3 で「過去同条件の中止率」表示予定
- WBGT 環境省実値 (Cloudflare Workers プロキシ 経由 ・ 4-10月) + 簡易計算 fallback

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
| 環境省 WBGT | 暑さ指数の予測値 | 不要 | CORS 制約で直接取得不可。Workers プロキシで実値化 (§0.10)。下記参照 |
| OpenWeather | 8 日分の hourly / daily | API キー | 任意 (Phase 2)。プロキシ経由で有効化 |

座標は TDL ･ TDS 共通で舞浜駅近辺 (`lat=35.6329, lon=139.8804`) を使います。

### WBGT (暑さ指数) について

環境省の暑さ指数 CSV は CORS ヘッダーを返さないため、ブラウザの artifact から直接は取得できません。

そのため通常は Open-Meteo の気温 ＋ 湿度から簡易式で推定し、画面には「(推定)」と表示します。

プロキシ経由などで環境省データが取れた場合のみ「(環境省)」表示に切り替わります。

#### 環境省 WBGT 実値の有効化 (Cloudflare Workers プロキシ、§0.10)

CORS を回避して環境省の実値を使うには、軽量プロキシ Worker をデプロイします。

```sh
cd workers && npx wrangler deploy --config wrangler.toml
```

デプロイ後に表示される URL を [src/main.js](src/main.js) の `CONFIG.wbgtProxyUrl` に設定すると、WBGT が簡易計算から環境省実値に切り替わります ( 詳細パネルの表示も「環境省」に )。提供期間は概ね 4 - 10 月で、期間外 ・ 取得失敗時は自動で簡易計算にフォールバックします。観測地点は船橋 (44132) を使用します。

データ出典 : **環境省 暑さ指数 (WBGT) 電子情報提供サービス** ( 政府標準利用規約に基づき出典明記のうえ利用 )。

---

## スコアの読み方

総合スコア ＝ 100 - (風減点 ＋ 雨減点 ＋ 熱中症減点 ＋ 寒さ減点 ＋ UV減点) です。

- **ベスト** 85 以上 : 風 ・ 雨 ・ 暑さすべて OK
- **OK** 70 以上 : 軽微なリスクのみ
- **微妙** 50 以上 : 風バ or 雨バの可能性
- **別日** 50 未満 : 中止リスク高

加えて **バッジ下限ガード** (§0.16) : バッジが「ほぼ中止」「中止リスク高」のいずれかなら総合スコアを「別日」(≦ 45) に強制。整合保証。

風 ・ 雨 ・ 熱の算定窓は、季節限定の昼パレード時刻 (TDL 13:00 / 14:30 ・ TDS 11:30 / 14:00) の前後 1 時間の **平均値** (§0.13.2、最大値は補助表示)。ナイトパレードは通年演目で参考扱い。

ショー別風キャン閾値 (§0.30 過去 PDF 由来) :

| ショー | 風バ | 風キャン |
|---|---|---|
| ハーモニー ・ イン ・ カラー | 6m/s | 12m/s |
| イッツ ・ ア ・ スウィーツフルタイム! | - | 12m/s |
| Reach for the Stars | - | pyroLimit 8m/s (花火カット) |
| エレクトリカル ・ ドリームライツ | - | 10m/s |
| ビリーヴ! | 5m/s | 12m/s |
| スパークリング ・ ジュビリー ・ セレブレーション | - | 12m/s |

スコアの詳細ロジックは [docs/SPEC.md §5](docs/SPEC.md) と [src/score/scoring.js](src/score/scoring.js) を参照。

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

## ショー ・ パレード時刻のメンテナンス (§0.8)

ショー ・ パレードの時刻はシーズンや日によって変わります。表示は日別 JSON があればその実時刻を、無ければ典型値 (FALLBACK) を使い、詳細パネルに「公式取得済 / 典型値で代替」バッジが出ます。

### 公式サイトからの自動取得は不可

当初は公式の日別カレンダーを Playwright で自動取得する設計でしたが、公式サイトは Akamai Bot Manager による bot 保護が入っており、headless ・ headed いずれの自動アクセスでも安定して中身を取得できないことを確認しました ( 空シェルが返る / 反復アクセスで遮断 )。`scripts/fetch-schedule.mjs` は記録として残していますが**実運用はできません**。

### 日別の手動メンテ (現行運用)

Yuka さんが公式アプリ ・ 公式サイトで見た公演名 ・ 時刻を Claude に伝えると、Claude が `src/data/schedule/YYYY-MM.json` を作成 ・ 更新します。形式は次のとおり ( Claude が組み立てるので、伝えるのは「日付 ・ パーク ・ 公演名 ・ 時刻」だけで OK )。

```json
{
  "month": "2026-06",
  "days": {
    "2026-06-04": {
      "TDL": { "shows": [
        { "name": "ディズニー･ハーモニー･イン･カラー", "times": ["13:00"], "priority": "high" }
      ] }
    }
  }
}
```

JSON を置いて `npm run build` → main に push すると公開ページ ( https://disney-weather.pages.dev ) に反映されます。JSON が無い日は自動で FALLBACK ( 典型値で代替 ) 表示になります。

### 典型値 (FALLBACK) の更新

日別までは持たず代表時刻だけ最新にしたい場合は、[src/data/showSchedule.js](src/data/showSchedule.js) の `FALLBACK_SCHEDULE` の公演名 ・ 時刻を更新します。

## 当日の運営状況 (中止 ・ 内容変更) の蓄積 (§0.28)

ショー ・ パレードの当日中止や時刻変更、早閉めなどの「当日変更」を `src/data/operation-log/YYYY-MM-DD.json` に蓄積し、詳細パネルに「当日中止情報」セクションとして表示します ( 取得済の日のみ )。Phase 2 第4弾 ( 的中追跡 ) の基礎データになります。

### 取得手順

公式サイトは Akamai による bot 保護があるため、安定取得には実 Chrome 経由 ( Cowork Chrome MCP ) が必要です。取得結果を次の形式で `src/data/operation-log/` に保存します。

```json
{
  "date": "2026-06-05",
  "snapshots": [
    {
      "fetchedAt": "2026-06-05T08:00:00+09:00",
      "park": "TDS",
      "closedShows": [{ "text": "ビリーヴ! 中止 (天候不良)" }],
      "modifiedShows": [{ "text": "ダンス ・ ザ ・ グローブ! 18:50 公演中止", "time": "18:50" }],
      "earlyClose": "18:30",
      "closedAttractions": [],
      "rawTextSnippet": "..."
    }
  ]
}
```

ローカル Mac で試す場合は `npm run fetch-operation` ( 今日 ) または `npm run fetch-operation -- 20260605` ( 指定日 )。取得できた日だけ JSON を出力し、失敗時は何も書きません。保存後は次でコミットします。

```sh
git add src/data/operation-log/
git commit -m "data: operation snapshot YYYY-MM-DD"
git push
```

JSON が無い日 ・ 取得失敗時はセクションを表示しません。

## データ出典

- 気象庁 ( 政府標準利用規約 )
- Open-Meteo ( CC BY 4.0、非商用 )
- 環境省 暑さ指数 電子情報提供サービス ( 政府標準利用規約 )
- 東京ディズニーリゾート公式 ( 出典明記 ・ 個人利用 ・ 月 1 取得 )
- 過去風キャン記録 : TSUBASA のディズニーパークブログ + X @tdr_syopare_can ( 個人利用 ・ 出典明記 )

### 過去風キャン記録の取り込み (§0.30)

ブロガーがまとめた月別 PDF ( 風キャン基準 ・ 日別の実測風速 ・ 公演実施状況 ) を `docs/cancel-history-pdf/{YYYY-MM}.txt` ( pdftotext で抽出済 ) から構造化し、`src/data/cancel-history/{YYYY-MM}.json` に保存します。Phase 2 第4弾 ( 的中追跡 ) の正解ラベルになります。

```sh
npm run import-cancel-history            # 全月
npm run import-cancel-history -- 2026-04 # 指定月
```

実行時に月別の record 数 ・ status 分布をログ出力します ( 固定幅 PDF のパースは完璧ではないため人手チェック用 )。**元 PDF / txt は第三者の成果物のため public リポジトリには含めません** ( `.gitignore` でローカル保持 )。抽出後の JSON ( 事実データ ) のみをコミットします。

## 予報精度の追跡 (§0.29)

各天気予報ソースの「前日予報」と「当日実測」を比較し、ソース別の誤差を蓄積します ( 将来の信頼度補正の素地 )。

- 毎朝 : `npm run snapshot-forecast` — その時点の予報を `src/data/forecast-snapshots/{YYYY-MM-DD}.json` に保存
- 翌朝 : `npm run track-accuracy` — 前日の予報と当日実測 ( 気象庁アメダス船橋 44132 + 環境省 WBGT ) を比較し `src/data/accuracy-log.json` に日次追記

30 日ほど蓄積すると各ソースの平均誤差が見えてきます ( Phase 3 で「予報精度ダッシュボード」UI ・ GitHub Actions cron 自動化を予定 )。実測が揃っていない当日は記録をスキップし、失敗時もログのみで UI には影響しません。気象庁は突風 ・ 風速を構造化提供しないため風誤差は Open-Meteo 主体です。

## ロードマップ

未消化の機能 ・ 改善は [GitHub Issues](https://github.com/yusasaki-025/disney-weather/issues) で管理しています。
詳細仕様は [docs/CHANGES.md](docs/CHANGES.md) を参照。

- Milestone : [§0.39 機能拡張 第3弾](https://github.com/yusasaki-025/disney-weather/milestones)
- 持ち越し : [carry-over ラベル](https://github.com/yusasaki-025/disney-weather/issues?q=is%3Aopen+label%3Acarry-over)
