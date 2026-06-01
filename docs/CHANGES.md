# Disney Weather - 仕様書アップデート差分

最終更新 : 2026/05/30
読者 : 既に着手済みの Claude Code 担当
完全な最新仕様 : `disney-weather-spec.md`

このドキュメントは、仕様書の改訂で変わった点を「既存コードにどう取り込むか」の観点で整理したものです。優先度高い順に並んでいます。Breaking から先に対応してください。

---

## 0. UI 仕様の追加調整 (2026/05/30 後半)

### 0.1 画面順序の変更 (Yuka さん要望)

旧 : ヘッダー → **TOP3** → フィルター → カレンダー → 詳細
新 : ヘッダー → **フィルター → カレンダー (メイン)** → 詳細 → **TOP3 (下部サマリ)**

理由 : 日付順カレンダーが主、TOP3 は補助。

影響ファイル :

- `src/main.js` の DOM 構築順序を変更
- `src/ui/top3.js` の挿入位置をテーブル下に
- スマホレイアウトも同じ順序

### 0.2 デフォルトソートを日付順に

- 旧 : スコア順
- 新 : **日付順がデフォルト**
- 既存 localStorage に `sort='score'` が保存されている場合は尊重 (互換性維持)
- 初回ロード ・ 未保存時は日付順

`src/ui/filters.js` の初期値を `'date'` に。

### 0.4 Cowork artifact 互換のための CDN ・ ライブラリ差し替え (要対応)

Cowork artifact は許可 CDN のホワイトリスト方式 (それ以外の fetch はサンドボックスでブロック)。現状の `dist/artifact.html` は以下の点で不整合。

| 現状 | Cowork 許可 | 対応 |
|---|---|---|
| Chart.js v4.4.6 | Chart.js **v4.5.0** | バージョンピンを `^4.5.0` に変更 |
| qrcode-generator v1.4.4 | 未許可 | 削除 (QR 機能を URL コピーボタンに置換) |
| Material Symbols Rounded フォント | 許可されているか要確認 | フォント未許可なら Unicode 記号 ＋ Material Icons SVG inline に切替 |

#### 修正手順 (Claude Code 向け)

1. `package.json` の依存変更
   - `"chart.js": "^4.5.0"` にピン (4.4.6 から上げる)
   - `"qrcode-generator": "^1.4.4"` を削除
   - `npm install` 実行
2. QR 機能の代替実装
   - 「QR コード表示」ボタンを **「URL をコピー」ボタン** (`navigator.clipboard.writeText`) に置換
   - 用語集 / ヘルプに「QR が必要なときは https://www.qr-code-generator.com 等の外部サービスにコピーした URL を貼ってください」と一文追加
   - 該当ファイル : `src/ui/qrcode.js` (もしくは TOP 領域の QR ボタン担当箇所)、`src/main.js` の import 削除
3. Material Symbols フォント
   - 試しに `cdn.jsdelivr.net/npm/@material-symbols/svg-400@latest` の SVG を inline する方法、または該当文字列 (`check_circle` 等) をフォント未読み込み環境でも崩れない fallback (◎ ○ △ × の Unicode のみ) を CSS に書く
   - これは Cowork artifact 許可リスト未確認のため、まずは `font-display: swap` を追加し、フォント未読み込みでも記号と数値だけで判別できるよう CSS 調整
4. `vite.config.js` で `optimizeDeps` / `build.rollupOptions.external` を確認、再ビルド
5. `npm run build` 後の `dist/artifact.html` を再確認
6. 出力サイズが ＋10KB 程度に膨らんでも 300KB 目標は余裕なので問題なし

#### Cowork artifact ホワイトリスト (確認済み)

- Chart.js v4.5.0 (UMD、global `Chart`)
- Grid.js v5.0.2 (UMD ＋ CSS、global `gridjs`)
- Mermaid v11.10.0 (global `mermaid`)
- それ以外の jsdelivr / unpkg は実行時ブロック

QR ライブラリの inline 化が必要な場合は、`qrcode-svg-mini` のような MIT ライブラリのソースを `src/vendor/qrcode-svg.js` に直接コピペ ・ ESM 化 して、バンドルに含める方法も可 (外部 fetch を発生させない)。

#### 完了後 Yuka さんに渡す情報

- 新しい `dist/artifact.html` の絶対パス
- `Cowork artifact CDN 制約をクリアしました` のサイン
- 動作確認 : ブラウザ実描画 ・ Chart.js 描画 ・ QR ボタンが「URL コピー」になっていること

### 0.5 スコアセルからアイコン併記も完全廃止 ＋ バッジに実数値併記 (Yuka さん指摘)

#### 0.5.1 スコアセル

問題 : Material Symbols 未読み込み時に `check_circle` も `check` も Unicode `✓` にフォールバックされ、「✓○80」のように **◎ と ○ の判別がつかない**。

対応 : スコアセルからアイコンを完全削除。**◎ / ○ / △ / × ＋ 数値 ＋ 色** のみ。

```
✕ 旧 :  ✓ ○ 80  (アイコン ＋ 記号 ＋ 数値)
○ 新 :  ○ 80   (記号 ＋ 数値)
```

影響 : `src/ui/table.js` のスコアセルレンダラからアイコン部分を削除。CSS `.score-icon` を未使用化 (削除)。

#### 0.5.2 風 ・ 雨 ・ 熱セルを「実数 ＋ バッジ」構造に

問題 : ラベルだけ (「風バ」等) だと判定根拠の数値が見えない。並列に書くと「9m/s 風バ」で大事な数値が埋もれる。

対応 : **数値 (主) ＋ バッジ (副)** の2階層構造に分離。

```
✕ 旧 :  風バ                    (ラベルだけ ・ 数値不明)
✕ 中間案 : 9m/s 風バ            (並列 ・ 主従不明確)
○ 新 :  [ 9m/s ] [風バ]          (数値が主、バッジが色付き副表示)
```

- 数値はやや大きめの黒文字 (タブラー数字で揃える)
- バッジは小さい角丸の色付きラベル (危険度で背景色変化)
- 並びは「数値 → バッジ」固定 (左から目に入る順序)

DOM :

```html
<span class="cell">
  <span class="value">9m/s</span>
  <span class="badge badge-warn">風バ</span>
</span>
```

バッジクラス :

- `badge-normal` (通常 ・ 雨無) : 薄緑背景
- `badge-warn` (風バ ・ 雨バ ・ 熱バ ・ 暑さ注意) : 薄黄背景
- `badge-danger` (中止リスク ・ 雨キャン ・ 熱キャン) : 薄赤背景
- `badge-critical` (ほぼ中止) : 赤背景 ＋ 白文字

降水量は0でない時のみ併記 :

```
[ 70% 2mm ] [雨キャン]
```

WBGT が簡易計算 (`wbgtSource === 'derived'`) の時 :

```
[ WBGT 29 (推定) ] [熱バ]
```

影響 :

- `src/ui/table.js` のバッジ列レンダラを「value + badge」の2要素構造に
- `src/styles.css` にバッジクラス4種類を追加
- スマホは単位省略可 ([ 9 ] [風バ] のように)

詳細は仕様書 §5.5 / §5.6 / **§5.7** を参照。

### 0.6 サブスコア ・ 気温色分け ・ ハンバーガー ・ 鮮度集約 (Yuka さん追加指摘)

#### 0.6.1 朝/昼/夜 サブスコアを背景色ピル化 ＋ gap 拡大 (再修正)

問題 : 直近の Yuka さん指摘「朝×昼×0夜× これはなんなの?」
原因 : 現状の CSS で `.subscore` が `flex-direction: column` ＋ `gap: 6px` のため、字面が縦に積まれ ・ 時間帯間のスペースも狭く、ラベルと記号のペアが視覚的に読みにくい (「朝」「×」「昼」「×」「0」「夜」「×」が連続体に見える)。

対応 :

- 各サブスコアを **横並び (row)** で「朝 ○」のようなペアにする
- それぞれを **背景色付きの角丸ピル** にして視覚分離
- ピル間 `gap` を 6px → **12px 以上** に拡大
- 朝 ・ 夜 : 薄い背景色 (var(--surface-2)) で控えめ
- 昼 : アクセント枠 + 太字 + 数値 で主役 (subscore-main クラス維持)

表示イメージ :

```
✕ 現状 :  朝×昼×0夜×  ← 字面が詰まって読めない
○ 新 :   [ 朝 ○ ]   [ 昼 ◎ 92 ]   [ 夜 △ ]
          灰色ピル    枠付き太字     灰色ピル
```

CSS 修正 (必須) :

```css
.subscore-group {
  display: inline-flex;
  align-items: center;
  gap: 12px;                    /* 6px → 12px */
}
.subscore {
  display: inline-flex;
  flex-direction: row;          /* column → row */
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 12px;
}
.subscore-main {
  border: 1.5px solid var(--accent);
  background: var(--surface);
  font-weight: 700;
  font-size: 13px;
}
```

DOM 構造は既存のまま (HTML 変更不要、CSS のみ修正)。

該当ファイル : `src/styles.css` の `.subscore-group` ・ `.subscore` ・ `.subscore-main`

詳細仕様 : §3.3 サブスコアの表示仕様。

#### 0.6.2 気温セルを暖寒色グラデーションで色分け

問題 : `32℃ / 24℃` のような表示が黒文字で読みづらく、暑い / 寒いの直感が出ない。

対応 : 温度帯ごとに文字色を変える (赤系 ＝ 暑い ／ 緑 ＝ 快適 ／ 青系 ＝ 寒い)。

| 気温帯 | 色 |
|---|---|
| ≧ 35℃ | `#9B1C1C` 深紅 |
| 30 - 34 | `#D24A4A` 赤 |
| 25 - 29 | `#E48732` オレンジ |
| 20 - 24 | `#2D8F3E` 緑 (快適) |
| 15 - 19 | `#3A8AB8` 青緑 |
| 10 - 14 | `#3F6FAE` 青 |
| 5 - 9 | `#2C4D8E` 濃青 |
| < 5 | `#1A2D5E` 紺 |

該当 : `src/ui/table.js` の気温セル ・ `src/utils/tempColor.js` (新規) に色決定関数 (引数 ℃ → 戻り値 hex)。フッターに小さい凡例を追加。
詳細仕様 : §3.2 気温セルの色分け。

#### 0.6.3 ヘッダーボタンをハンバーガーメニューに集約 (狭幅時)

問題 : スマホ (< 768px) で「URL コピー / Notion 送信 / ダークモード / 印刷」等のボタンが並ぶとヘッダーが崩れる。

対応 :

- PC (≧ 768px) : 従来どおりヘッダー右に横並び表示
- スマホ (< 768px) : `menu` アイコンボタン1つ → タップでドロワー (右からスライドイン)
- ドロワー項目 : URL コピー / Notion 送信 / カレンダー登録 / 印刷 / ダークモード / 用語集 / 強制更新 / 出典
- ARIA : `aria-expanded` `role="menu"` `role="menuitem"` ・ Esc で閉じる
- フォーカストラップ実装、開いたら先頭項目に focus

該当ファイル :

- `src/ui/header.js` 既存
- `src/ui/menu.js` 新規
- `src/styles.css` メディアクエリ `@media (max-width: 767px)` でドロワー表示

詳細仕様 : §6.11 ハンバーガーメニュー。

#### 0.6.4 鮮度ラベルをステータスバーに集約

問題 : 各セルに「最終更新 24分前 キャッシュ」が並んで冗長 ・ ノイズ。同じバッチ取得なら全列同じ値が出るので意味が薄い。

対応 : テーブル上部のステータスバーにソース別1か所だけ集約。

表示イメージ :

```
[フィルター行]
JMA 24分前 ・ Open-Meteo 18分前   [キャッシュ表示中]  [強制更新]
```

- ソース名 ＋ 経過時間 をソース別に1つだけ
- 取得時刻は全日分のうち最も古いものを採用
- 全ソースがキャッシュなら「キャッシュ表示中」黄色ピル1つ
- 各セルからは鮮度ラベルを削除、ホバー時の `title` 属性に格下げ
- 「強制更新」ボタン (キャッシュ無視) もここに集約

該当ファイル :

- `src/ui/statusBar.js` 新規
- `src/ui/table.js` から鮮度セルを削除
- `src/utils/freshness.js` の役割を縮小 (ステータスバー専用に)

詳細仕様 : §3.14 データ鮮度表示。

> **2026/05/30 完了報告反映** : (1) - (4) は Claude Code により実装済み (commits `b5a8651` / `372aaf0` / `42a98af`)。 (5) (6) は新規追加。

#### 0.6.5 スコアセルを記号からテキストラベルへ (◎○△× 完全廃止)

問題 : Yuka さん再指摘「✓○80 これも何? 何を示しているか分からない」「数字は分かるけど、まるとかが何なのか分からない」。
原因 : ◎ ○ △ × は学校の通知簿風で日本人にはなじみあるが、用途が明示されていないので「何の指標か」直感的に伝わらない。

対応 : 記号を **直接的な日本語テキスト** に置換。

| 旧 | 新 |
|---|---|
| ◎ 92 | **行くべき 92** (緑太字) |
| ○ 78 | **行ってよい 78** (薄緑太字) |
| △ 58 | **微妙 58** (黄太字) |
| × 32 | **別日 32** (赤太字) |

- 記号 ◎ ○ △ × は **すべての箇所から削除** (テーブル ・ サブスコア ・ ARIA ・ Notion 書き込み)
- サブスコアは **記号も廃止**、色付き数値ピルだけにする :
  ```
  旧 : 朝×昼×0夜×            → 字面が連続体に見える
  新 : [朝 78] [昼 92] [夜 58]   → 数値だけ ・ 背景色で危険度
  ```
- スコア帯ごとのピル背景 : 緑 (行くべき) / 薄緑 (行ってよい) / 黄 (微妙) / 赤 (別日)
- 昼ピルだけ少し大きめ ・ 太字で強調 (subscore-main 維持)
- 凡例カードをテーブル上部に常時表示 (折りたたみ可、状態 localStorage 保存) :
  ```
  スコア凡例 : [行くべき] 風 ・ 雨 ・ 暑さ全部OK ／ [行ってよい] 軽微 ／ [微妙] 風バ or 雨バ域 ／ [別日] 中止リスク高
  ```

該当ファイル :

- `src/score/scoring.js` : 記号定数を `{ key: 'excellent', label: '行くべき', color: '#2D8F3E' }` のようなラベル化
- `src/ui/table.js` のスコアセル ・ サブスコアセルレンダラ全面書き換え
- `src/ui/legend.js` 新規 : 凡例カード
- `src/integrations/notion.js` : `subText` の記号を削除し「朝 行くべき / 昼 微妙 / 夜 別日」テキストに
- `src/styles.css` : `.subscore` の背景色ピル化 (記号廃止後の見せ方)

詳細仕様 : §6.3 スコア表記と配色。

#### 0.6.6 天気予報セルに大きな天気アイコンを導入

問題 : Yuka さん指摘「風 / 雨 / 熱 / 気象庁 / Open-Meteo は文字ばっかで分かりづらい。普通の天気予報はもっとアイコン大きめでぱっと見が分かる」

対応 : カテゴリアイコン (列ヘッダー 28px) ＋ 各日の天気状況アイコン (40px) を導入。

#### 1. 列ヘッダーアイコン

| 列 | アイコン | サイズ |
|---|---|---|
| 風 | `air` | 28px |
| 雨 | `umbrella` | 28px |
| 熱 | `thermostat` | 28px |
| 気象庁 / Open-Meteo | (各セル内で天気アイコン) | - |

#### 2. JMA / Open-Meteo セルに大きな天気状況アイコン

各日の天気概況テキストを `src/utils/weatherIcon.js` で Material Symbol 名 ＋ 色にマップ :

| 天気 | アイコン | 色 |
|---|---|---|
| 晴れ | `wb_sunny` | `#F2A93B` (黄) |
| 晴れ時々曇り | `partly_cloudy_day` | `#E48732` (橙) |
| 曇り | `cloud` | `#7C8696` (灰) |
| 雨 | `rainy` | `#3F6FAE` (青) |
| 大雨 | `thunderstorm` | `#2C4D8E` (濃青) |
| 雪 | `ac_unit` | `#3A8AB8` (青緑) |
| 雷 | `bolt` | `#9B59B6` (紫) |
| 霧 | `foggy` | `#A0A8B5` (灰青) |

セル内構成 :

```
┌──────────────────┐
│  (wb_sunny 40px) │   ← 大きい天気アイコン (主役)
│  晴れ             │   ← 概況テキスト
│  26℃ / 18℃       │   ← 気温 (色分け §3.2)
│  雨 30%           │   ← 降水確率
└──────────────────┘
```

#### 3. 風 ・ 雨 ・ 熱セルのカテゴリアイコン

セル内に小さなアイコン (16-20px) を頭に配置 :

```
(air 16px) 9m/s  [風バ]
(umbrella 16px) 45%  [雨バ]
(thermostat 16px) WBGT 29  [熱バ]
```

これによりセル単位でも「これは風の情報」が直感的に伝わる。

該当ファイル :

- `src/utils/weatherIcon.js` 新規 : `getWeatherIcon(weatherText): { name: string ; color: string }`
- `src/ui/table.js` の列ヘッダー ・ 各セルレンダラ更新
- `src/styles.css` : `.weather-icon` `.cat-icon` の大きさ ・ 色

詳細仕様 : §5.7 セルの共通レイアウト。

#### 0.6.7 行クリックの可視化

問題 : Yuka さん指摘「行をクリックできることが分かりづらい」。

対応 :

- 行ホバーで `cursor: pointer` ＋ 背景色変化 (`var(--surface-hover)`)
- 行末に `chevron_right` アイコン (開いた行は `expand_more`)
- PC では「詳細を見る」テキストを併記
- `role="button"` `tabindex="0"` `aria-expanded` 対応
- Enter / Space キーで開閉
- ホバー時に微妙な elevation (shadow-hover)

該当 : `src/ui/table.js` 行レンダラ、`src/styles.css` `.calendar-row:hover` 等

#### 0.6.8 詳細パネルを2カラム (左 = 情報 / 右 = グラフ) に再設計

問題 : Yuka さん指摘「クリックしたときの中身がパッと見分かりづらい / グラフは右側のほうが良い / 見出し区切りが分かりづらい」。

対応 :

- PC (≧ 768px) : 2カラム grid (左 = ショースケジュール ・ 服装 ・ グリ ・ 休止 / 右 = グラフ ・ 気温チャート)
- スマホ (< 768px) : 1カラム縦並び (ショースケジュール → グラフ → 気温 → 服装)
- 見出し (`<h3 class="panel-heading">`) :
  - 左に丸ドット (`var(--primary)` のピル)
  - 下に太い罫線 (`border-bottom: 2px solid var(--accent)`)
  - 上に 24px 余白
- セクション間に淡い水平線 (`border-top: 1px solid var(--border)`)
- 開閉アニメ : 200ms slide-down ＋ fade-in
- 行クリックで panel が行直下に挿入

該当 :

- `src/ui/detailPanel.js` 新規 (または `src/ui/chart.js` を分離)
- `src/styles.css` の `.detail-panel` `.panel-grid` `.panel-heading` `.panel-bullet`
- Chart.js の高さ : PC 300px / スマホ 240px、横軸時刻、左Y降水確率、右Y風速、縦線でショー時刻ハイライト

詳細仕様 : §3.4 詳細パネル。

#### 0.6.9 ショースケジュールを実在公演名 ・ パーク別に

問題 : Yuka さん指摘「これは実際の時間引けてないってこと? ショースケジュールは具体名で書いて (例 : ハーモニーインカラー)。ランドとシーでも違うはず」。

回答 :

- **Phase 1 の現状 : 公式 calendar からの自動取得は未実装。`src/data/showSchedule.js` の固定 JSON で代替**
- ただし Phase 1 でも **実在公演名 ・ 時刻 ・ パーク別** で表示できるよう固定 JSON を作り込む
- Phase 2 で公式 `/tdl/daily/calendar/{YYYYMMDD}/` ・ `/tds/daily/calendar/{YYYYMMDD}/` から日別取得 (§3.10 / §3.20)

固定 JSON (2026/6/4 時点の公式 calendar を確認した実データ) :

```js
// src/data/showSchedule.js
export const SHOW_SCHEDULE = {
  TDL: [
    { name: 'ディズニー･ハーモニー･イン･カラー', times: ['13:00'], priority: 'high', kind: 'parade-day', tag: 'プレミアアクセス' },
    { name: 'イッツ･ア･スウィーツフルタイム!', times: ['16:25'], priority: 'high', kind: 'show-day', tag: 'パルパルーザ枠 ・ 季節限定' },
    { name: 'Reach for the Stars', times: ['20:50'], priority: 'high', kind: 'show-day', tag: '季節限定 ・ プレミアアクセス' },
    { name: 'ジャンボリミッキー!レッツ･ダンス!', times: ['12:45','14:00','15:15','17:05','18:20'], priority: 'medium', kind: 'show-indoor', tag: 'エントリー受付' },
    { name: '東京ディズニーランド･エレクトリカルパレード･ドリームライツ', times: ['19:30'], priority: 'low', kind: 'parade-night', tag: '通年' },
    { name: 'スカイ･フル･オブ･カラーズ', times: ['20:30'], priority: 'low', kind: 'fireworks', tag: '通年花火' },
    { name: 'ミッキーのレインボー･ルアウ', times: [], priority: null, kind: 'show-restaurant', tag: '予約必須' },
  ],
  TDS: [
    { name: 'スパークリング･ジュビリー･セレブレーション', times: ['11:30','14:00','16:00'], priority: 'high', kind: 'harbor-day', tag: '25周年 ・ 季節限定' },
    { name: 'ダンス･ザ･グローブ!', times: ['13:00','14:45','17:05','18:50'], priority: 'medium', kind: 'show-indoor', tag: 'エントリー ・ プレミアアクセス' },
    { name: 'ドリームス･テイク･フライト', times: ['11:00','12:25','13:50','15:55','17:20'], priority: 'medium', kind: 'show-indoor', tag: 'エントリー ・ プレミアアクセス' },
    { name: 'ビリーヴ!〜シー･オブ･ドリームス〜', times: ['19:30'], priority: 'low', kind: 'harbor-night', tag: '通年 ・ プレミアアクセス' },
    { name: '【環境演出】スパークリング･ジュビリー･ナイト', times: ['20:15','20:40','20:55'], priority: 'low', kind: 'environment', tag: '季節 ・ 短時間' },
    { name: 'スカイ･フル･オブ･カラーズ', times: ['20:30'], priority: 'low', kind: 'fireworks', tag: '通年花火' },
    { name: 'ダッフィー＆フレンズのワンダフル･フレンドシップ', times: [], priority: null, kind: 'show-restaurant', tag: '予約必須' },
  ],
};
```

UI での表示 (詳細パネル内) は **実在公演名 ・ 時刻 ・ タグ** を1行ずつ列挙。priority 別にグルーピング :

```
TDL の場合 :
  デイパレード ・ ショー (主算定)
    ・ ディズニー･ハーモニー･イン･カラー  13:00  [プレミアアクセス]
    ・ イッツ･ア･スウィーツフルタイム!   16:25  [パルパルーザ枠]
    ・ Reach for the Stars             20:50  [季節限定]
  ナイトパレード ・ 花火 (参考)
    ・ エレクトリカルパレード ・ ドリームライツ  19:30
    ・ スカイ ・ フル ・ オブ ・ カラーズ        20:30
  屋内 (エントリー受付)
    ・ ジャンボリミッキー!         12:45 / 14:00 / 15:15 / 17:05 / 18:20
```

該当ファイル :

- `src/data/showSchedule.js` 全面書き換え (構造 ・ パーク別 ・ 実在公演名)
- `src/data/showPriority.js` は不要に (showSchedule.js 内に priority を含めるため)
- `src/ui/detailPanel.js` でショースケジュール表示 (グルーピング ・ 実在名)

詳細仕様 : §3.10 ショースケジュール。

#### 0.6.10 公式 TDR トーンへのデザイン刷新

問題 : Yuka さん指摘「デザインや色合いが寂しい。<https://www.tokyodisneyresort.jp/> の雰囲気に合わせて」。

公式トップを確認した結果 (2026/05/30) :

- 白背景 ・ 写真主導 ・ メインビジュアルが大きい
- ヘッダーアイコンは色分け (赤 ・ 緑 ・ 青 ・ ピンク ・ オレンジ)
- ロゴはレトロ風セリフ ・ 手書き要素
- 鮮やかな色 (青空 ・ ピンク ・ ゴールド)
- 親しみやすい角丸 ・ 柔らかいシャドウ

対応 (デザイントークン全面刷新) :

```css
:root {
  --primary       : #4A90D2;  /* ディズニーブルー */
  --accent        : #E84A8C;  /* ミニーピンク */
  --accent-2      : #F0B040;  /* ゴールド */
  --background    : #FBFCFE;
  --surface       : #FFFFFF;
  --surface-2     : #EEF4FB;
  --surface-hover : #DCE7F5;
  --border        : #D5E2F0;
  --border-strong : #4A90D2;
  --text          : #1E2A3A;
  --text-sub      : #5A6B82;

  --excellent : #2D8F3E;  /* 行くべき */
  --good      : #88C057;
  --fair      : #F2A93B;
  --poor      : #D24A4A;

  --font-heading  : "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
  --font-body     : "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", sans-serif;
  --font-numeric  : "Inter", "Segoe UI", system-ui, sans-serif;

  --radius        : 12px;
  --radius-sm     : 8px;
  --radius-pill   : 999px;

  --shadow-soft   : 0 4px 16px rgba(74, 144, 210, 0.10);
  --shadow-card   : 0 2px 8px rgba(74, 144, 210, 0.06);
  --shadow-hover  : 0 8px 24px rgba(74, 144, 210, 0.16);

  --gradient-hero    : linear-gradient(135deg, #4A90D2 0%, #B8E0FE 100%);
  --gradient-magic   : linear-gradient(135deg, #E84A8C 0%, #F0B040 50%, #4A90D2 100%);
  --gradient-subtle  : linear-gradient(180deg, #FBFCFE 0%, #EEF4FB 100%);
}

[data-theme="dark"] {
  --primary       : #5BA3E0;
  --accent        : #FF6FA8;
  --accent-2      : #FFC661;
  --background    : #0F1828;
  --surface       : #1A2638;
  --surface-2     : #243349;
  --surface-hover : #2E4060;
  --border        : #324560;
  --text          : #E8EEF6;
  --text-sub      : #A7B3C4;
}
```

具体的な装飾 :

- ヘッダー : 上部に `var(--gradient-hero)` 帯 + タイトルをセリフ体で大きく
- TOP3 カード : `--shadow-soft` ＋ `--radius` 16px ＋ 斜めリボン (1位はゴールド)
- カレンダー行 : 白背景、ホバーで `--surface-hover` ＋ 行末に chevron アイコン
- スコアラベル ・ バッジ : 各状態色に薄背景 ＋ 太字
- 詳細パネル : 開いた瞬間に下から slide-down 200ms ・ 左カラム上に `--gradient-magic` の細リボン
- 見出し : `border-bottom: 2px solid var(--accent)` ＋ 左の丸ドット (`--primary`)
- ボタン : ピンクアクセント背景 ＋ 白文字 ＋ 角丸

タイポグラフィ :

- 見出し : `var(--font-heading)` (Noto Serif JP) ・ 太字 700
- 本文 : `var(--font-body)` (Noto Sans JP) ・ 400-500
- 数値 : `var(--font-numeric)` (Inter) ・ `font-variant-numeric: tabular-nums`

フォントは Google Fonts CDN から `<link>` で読み込み (`Noto Serif JP` / `Noto Sans JP` / `Inter`)。Material Symbols 同様、Cowork artifact では未許可 CDN の可能性があるためフォールバック必須 (`font-display: swap` ＋ システムフォントへの安全な fallback)。

該当ファイル :

- `src/styles.css` の :root / [data-theme="dark"] 全面刷新
- `src/index.html` の `<link>` で Google Fonts 読み込み
- `src/ui/header.js` でヘッダーグラデーション帯
- `src/ui/top3.js` でリボン装飾
- `src/ui/table.js` の行ホバー ・ chevron 追加
- `src/ui/detailPanel.js` で見出し装飾 ・ slide-down アニメ

詳細仕様 : §6.9.5 デザイントークン。

#### 0.6.11 見出しの左ゴールド縦バーを削除 (komorebi ルール「縦アクセントバー禁止」)

問題 : §0.6.10 で実装した見出しの左ゴールド縦バーは、Yuka さんの長年のルール「縦アクセントバーは AI っぽいので禁止」と衝突する (komorebi-design-system でも同様の指針)。

対応 : 縦バーを削除し、**色 ・ 余白 ・ 下罫線** の組み合わせで区切りを表現。

```css
/* ✕ 旧 (NG) */
.panel-heading {
  border-left: 4px solid var(--accent-2);  /* ゴールド縦バー */
  padding-left: 12px;
}

/* ○ 新 */
.panel-heading {
  /* 縦バーなし、色 ・ 余白 ・ 下罫線で区切る */
  color: var(--primary);                       /* 見出しはブルー */
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1.15rem;
  margin-top: 32px;                            /* 大きめ上余白 */
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--accent);      /* 下にピンクの罫線 */
}

/* スマホ */
@media (max-width: 767px) {
  .panel-heading {
    margin-top: 24px;
    font-size: 1.05rem;
  }
}
```

縦バー以外の装飾 (左の丸ドット panel-bullet があれば、それも見直し or 廃止) も AI 風に見える可能性があるので一緒に簡素化。

該当ファイル :

- `src/styles.css` の `.panel-heading` `.section-heading` 等で `border-left` / `border-inline-start` を全削除
- 見出しの装飾は 色 ・ フォント ・ 罫線 ・ 余白のみで構成

詳細仕様 : §6.9.5 デザイントークン (装飾要素から縦バー言及を削除)。

### 0.8 日別ショースケジュール取得 (Phase 2、Yuka さん指摘)

問題 : Yuka さん指摘「月1で取ってくればいい気がする」「1ヶ月間毎日時間同じではなく、1日違う日や後半が違うなどある」「12時→16時に変わったり」「GW は公演数が増えたり」

現状の固定 JSON では日別の差異 (時刻変動 ・ 公演追加 ・ 連休増) を再現できない。日別の実スケジュールを取得 ・ 反映する。

#### 運用方針

- 取得頻度 : 月1 (毎月 9 - 10日に翌月分一括取得、公式更新後すぐ)
- 取得対象 : 翌月の全日 (TDL ・ TDS 別々)
- 保存先 : repo 内 `src/data/schedule/{YYYY-MM}.json`
- 反映 : commit & push → CF Pages 自動再ビルド

#### スクリプト

`scripts/fetch-schedule.mjs` 新規 :

- Playwright (headless Chrome) で `/tdl/daily/calendar/{YYYYMMDD}/` ・ `/tds/daily/calendar/{YYYYMMDD}/` を順次取得
- DOM パース → JSON 化
- リクエスト間 2-3秒 sleep、User-Agent 明示

`package.json` に script 追加 :

```json
"scripts": {
  "fetch-schedule": "node scripts/fetch-schedule.mjs"
}
```

実行例 : `npm run fetch-schedule -- 2026-07`

#### JSON スキーマ

詳細は SPEC.md §3.10 を参照。要点 :

- `month` ・ `fetchedAt` ・ `source`
- `days['2026-06-04'].TDL.shows[]` に日別の `name` ・ `times[]` ・ `priority` ・ `kind` ・ `tags[]`
- `openHour` ・ `closeHour` も日別
- `greetings` ・ `closures` も日別

#### 反映ロジック

`src/data/showSchedule.js` :

```js
import schedule202606 from './schedule/2026-06.json';
import schedule202607 from './schedule/2026-07.json';

const SCHEDULE_BY_MONTH = { '2026-06': schedule202606, '2026-07': schedule202607 };

export function getDaySchedule(date, park) {
  const month = date.slice(0, 7);
  const data = SCHEDULE_BY_MONTH[month];
  if (!data) return FALLBACK_SCHEDULE[park];
  return data.days[date]?.[park] ?? FALLBACK_SCHEDULE[park];
}
```

スコアリング (§5.1) ・ 詳細パネル (§3.4) は `getDaySchedule()` 経由で **その日の実時刻** を使う。

#### UI 表示

詳細パネルの右上にバッジで「公式取得済 ・ 2026/06」or「典型値で代替」を区別表示。

#### 月初運用フロー

```
cd ~/claude/personal/disney-weather
npm run fetch-schedule -- 2026-07
git add src/data/schedule/2026-07.json
git commit -m "data: 2026-07 schedule"
git push
# CF Pages 自動再ビルド (5分) → 公開ページ反映
```

#### Phase 3 : 完全自動化 (将来)

- GitHub Actions cron (毎月10日 06:00 JST) でスクリプト自動実行 ・ PR 作成
- Cloudflare Workers cron + Browser Rendering API (CF 課金確認)
- 内部 API が見つかれば Playwright 不要

### 0.9 Notion / GCal 連携を完全廃止 (Yuka さん指摘)

問題 : Yuka さん指摘「Notion/GCal 連携要らないから消して」。

公開ページ ・ Cowork artifact のどちらでも不要。完全削除でシンプル化。

#### 削除対象

ファイル削除 :

- `src/integrations/notion.js`
- `src/integrations/gcal.js`
- `src/integrations/scheduler.js` (3段階自動通知も削除する場合)
- `src/integrations/slack.js` (上記 scheduler 連動)
- `src/integrations/` ディレクトリごと削除して可

ファイル更新 :

- `src/ui/header.js` ・ `src/ui/menu.js` から "Notion 送信" "カレンダー登録" ボタン削除
- `src/ui/menu.js` のドロワー項目から該当2項目削除 (残るは URL コピー / 印刷 / ダーク切替 / 用語集 / 強制更新 / 出典)
- `src/utils/runtime.js` ・ `isCowork()` は不要になるので削除 (機能差がなくなる)
- `src/main.js` から isCowork() 関連の import / 分岐削除
- `README.md` から「Cowork 版 ・ 公開ページ版の機能差」記述削除 (差がなくなる)
- `disclaimer` の「個人連携機能は Cowork 版でのみ動作」一文削除

仕様書整理 (Code 側では不要、私 (Cowork) が docs/SPEC.md ・ docs/CHANGES.md で並行更新する) :

- §3.6 同行者共有 : Notion 送信ボタン記述削除 → 「URL コピー」「QR」のみ
- §3.9 決定フロー : Notion ステータス更新 ・ GCal 連携を削除、決定日は localStorage のみ
- §11 Notion 連携 : セクション全廃 or 「廃止」注記
- §12 Google Calendar 連携 : セクション全廃 or 「廃止」注記
- §14 受け入れ基準 : 「Notion 送信ボタン」「カレンダー登録ボタン」「同行者 NG 日」「同行者投票」削除
- §3.23 同行者投票 : Notion DB のリアクション集計が前提だったので削除 (Phase 2 / 3 で別案検討)
- §0.7 公開ページ化 : ランタイム判定 (isCowork) は不要に → セクション簡素化 (ただし CF Pages デプロイ手順は残す)

#### Notion DB (作成済みのもの)

`d17f66b8c11b42d5b7e624226e79c6fe` の DB は Yuka さんが Notion 上で削除 (任意)。アプリ側からはアクセスしなくなるので残しても害なし。

#### テスト

- Notion / GCal 関連のテストファイルがあれば削除
- Vitest 緑のまま維持

#### 同行者と相談する手段は?

Notion を介さずに :

- 「URL コピー」で同行者と Web 共有 (公開ページ)
- 同行者の都合 NG 日は **localStorage に保存** (個人端末で完結) ・ 同行者と同期しない
- 「決定した」フラグも localStorage のみ
- 必要なら共有 Notion ページに Yuka さんが手書きでメモ (アプリ側は関与しない)

### 0.10 バッジラベル簡素化 ＋ WBGT セル冗長表記削除 (Yuka さん指摘)

#### 0.10.1 「通常運行」→「通常」に統一

Yuka さん指摘 : 「運行って何?」

3バッジ (風 ・ 雨 ・ 熱) のラベル「通常運行」を **「通常」** に統一。シンプルに。

| バッジ | 旧ラベル | 新ラベル |
|---|---|---|
| 風 | 通常運行 | 通常 |
| 雨 | 通常運行 / 雨なし | 通常 (雨なしと統合) |
| 熱 | 通常運行 | 通常 |

該当ファイル :

- `src/score/scoring.js` or 該当のバッジラベル定義
- `src/ui/table.js` のバッジ生成箇所

#### 0.10.2 熱バッジセルから「WBGT」「(推定)」削除

Yuka さん指摘 : 「WBGT と (推定) は見出し列にあるし毎回書かなくて良くない?」

列ヘッダーが「熱 (WBGT)」と明示されているのに、セルにも「WBGT」「(推定)」が毎回出てきて冗長。

対応 :

- セル内表記から `WBGT` プレフィックスを **削除** → 数値だけ (例 `27 通常` / `31 熱キャン濃厚`)
- `(推定)` プレフィックスも **削除** → ステータスバーで1か所だけ表示
- ホバー時の `title` 属性で「WBGT 簡易計算による推定値」を補助表示 (詳細を見たい人向け)

ステータスバー追加表示 :

```
[フィルター行]
JMA 24分前 ・ Open-Meteo 18分前   [WBGT 環境省 or 簡易計算]   [強制更新]
```

- `wbgtSource === 'env-jp'` : 緑系ピル「WBGT 環境省」
- `wbgtSource === 'derived'` : 黄色ピル「WBGT 簡易計算」

該当ファイル :

- `src/ui/table.js` の熱バッジセルレンダラから `WBGT` ・ `(推定)` 削除
- `src/ui/statusBar.js` に WBGT ソース表示ピル追加
- `src/utils/freshness.js` (or 同等) で `wbgtSource` を集約取得

詳細仕様 : §3.14 データ鮮度表示 ・ §5.6 熱バッジ。

### 0.11 プロダクト名変更 ＋ フィルター文言整合 (Yuka さん指摘)

#### 0.11.1 「Disney 行く日きめるダッシュボード」→「マイハマびより」

Yuka さん指摘 : 旧名がダサい。Disney 商標も避けたい。

新名 : **マイハマびより** (やわらか和語 ・ 場所固有 ・ 商標安全)

変更対象 :

- HTML `<title>` : `マイハマびより` (or `マイハマびより ・ ディズニーの天気予報`)
- ヘッダーロゴ ・ 表示テキスト : `マイハマびより`
- 説明文 / 副タイトル : `舞浜の天気からショー ・ パレード中止リスクを予測` 等
- `package.json` の `name` : `maihama-biyori` (kebab-case)
- `package.json` の `description` : `舞浜 (TDL ・ TDS) の天気予報を比較してショー ・ パレード中止リスクを判定`
- README タイトル ・ 概要
- `manifest.json` (PWA) の `name` / `short_name`
- aria-label, og:title, meta description

維持するもの (技術的な命名 ・ 影響大) :

- GitHub repo : `yusasaki-025/disney-weather` (URL 変えると CF Pages も再連携必要)
- 公開 URL : `disney-weather.pages.dev` (リネームは別途、希望なら CF Pages 設定で project rename)
- ローカルディレクトリ : `~/claude/personal/disney-weather/` (お好みで rename 可)
- ソースの内部識別子 (`disney-weather` 等の変数名) : 影響範囲大ければそのまま

#### 0.11.2 フィルター「◎ ○ のみ」→「行ける日のみ」

Yuka さん指摘 : 「◎ ○ のみって絞り込みがあるけど ◎ とか廃止されたから意味がわからないチェックになっちゃってる」

スコア記号 ◎ ○ △ × を「行くべき / 行ってよい / 微妙 / 別日」テキストラベル化 (§0.6.5) したので、フィルターも記号でなくテキスト基準に :

| 旧 | 新 |
|---|---|
| `[ ] ◎ ○ のみ` | `[ ] 行ける日のみ` |

動作 :

- チェック ON 時 : 総合スコアラベルが「行くべき」or「行ってよい」の日のみ表示
- チェック OFF 時 : 全日表示 (既定)

該当ファイル :

- `src/ui/filters.js` のチェックボックス label ・ フィルター関数
- ARIA label も「行ける日のみ表示」に更新
- localStorage キーは互換性のため変更しない (`filterGoodOnly` などのまま)

### 0.12 スマホ詳細パネルの横はみ出し修正 (Yuka さん指摘)

問題 : 行タップで詳細パネルは開くが、スマホ (375px) で **画面から横にはみ出る**。

原因仮説 :

- 詳細パネル grid が PC の 2カラムのままで強制 1カラム化されてない
- Chart.js コンテナの `min-width: auto` (flex/grid 親のデフォルト) で canvas がはみ出る
- ショースケジュールのテキストや見出しが折り返さない
- TDL/TDS タブが幅にフィットしてない

対応 (`src/styles.css` の `@media (max-width: 767px)`) :

```css
@media (max-width: 767px) {
  /* 1. 詳細パネル grid を 1カラム強制 */
  .detail-row .panel-grid,
  .detail-panel .panel-grid {
    grid-template-columns: 1fr !important;
    display: block;
    gap: 16px;
  }

  /* 2. パネル本体 ・ 子要素に overflow ・ max-width 制御 */
  .detail-row,
  .detail-panel,
  .detail-row > *,
  .detail-panel > * {
    max-width: 100%;
    box-sizing: border-box;
  }
  .detail-row,
  .detail-panel {
    overflow-x: hidden;
  }

  /* 3. Chart.js コンテナ ・ min-width: 0 で grid/flex 子の収縮を許可 */
  .chart-container,
  .chart-wrapper,
  .detail-panel .chart {
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }
  canvas {
    max-width: 100% !important;
    height: auto !important;
  }

  /* 4. ショースケジュール ・ 見出し ・ 長い名前の折り返し */
  .detail-panel h3,
  .detail-panel h4,
  .show-name,
  .panel-heading {
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  /* 5. TDL/TDS タブをコンパクトに */
  .park-tab,
  .park-tabs button {
    flex: 1 1 0;
    min-width: 0;
    padding: 8px 4px;
    font-size: 13px;
  }
}
```

検証 :

- 実機 iPhone Safari or Chrome DevTools (375px) で行タップ
- 詳細パネル開いて 横スクロールバーが出ない (`document.body.scrollWidth === 375`)
- グラフが幅にフィット
- 見出しが折り返す
- TDL / TDS タブが画面幅に収まる
- 「キャラクターグリーティング」「ハーモニー ・ イン ・ カラー」等の長い名前が折り返される

該当ファイル :

- `src/styles.css` の @media クエリのみ修正 (HTML 構造変更不要)

### 0.13 スコアラベル短縮 ・ 平均値スコア ・ ステータスバー削除 (Yuka さん指摘)

#### 0.13.1 スコアラベル短縮 (「行ってよい」が長い)

Yuka さん指摘 : 「行ってよい」が長い。

新ラベル :

| 旧 | 新 | 色 |
|---|---|---|
| 行くべき | **ベスト** | `#2D8F3E` 緑 |
| 行ってよい | **OK** | `#88C057` 薄緑 |
| 微妙 | **微妙** | `#F2A93B` 黄 |
| 別日 | **別日** | `#D24A4A` 赤 |

凡例カード文言 :

> ベスト = 風 ・ 雨 ・ 暑さ全部 OK ／ OK = 軽微 ／ 微妙 = 風バ or 雨バ域 ／ 別日 = 中止リスク高

フィルター「行ける日のみ」は **「ベスト or OK」を含む意味** で維持 (文言変更なし)。

該当ファイル :

- `src/score/scoring.js` のラベル定数 (`label: '行くべき'` 等を更新)
- `src/ui/legend.js` の凡例カード文言
- `src/ui/table.js` (もし `行くべき` 等をハードコードしてれば)
- ARIA label 例 : `aria-label="6月2日 ベスト スコア92"`

#### 0.13.2 スコア算定窓を「最大値」→「平均値」に

Yuka さん指摘 : 「スコアが赤ばかり、こんなもんなの?」「全然いい日がない」。

原因 : 現状の `wind_show_window` ・ `pop_show_window` ・ `wbgt_show_window` は **昼パレード時刻 ±1h の最大値**。一瞬の突風 ・ 短時間スパイクで丸ごと「中止リスク高」「ほぼ中止」になりがち。

対応 : 算定窓を **平均値** に変更。

```js
// 旧
const wind_show = Math.max(...hourlyWindInWindow);

// 新
const wind_show = hourlyWindInWindow.reduce((a,b)=>a+b, 0) / hourlyWindInWindow.length;
```

対象 :

- `wind_show_window` ・ `gust_show_window` : ±1h の平均
- `pop_show_window` : ±1h の平均
- `wbgt_show_window` : ±1h の平均

維持するもの (詳細パネル ・ ツールチップ参考表示用) :

- 1日の全体最大値 (`wind_max` ・ `pop_max` ・ `wbgt_max`) は引き続き計算 ・ 保持
- バッジセルのツールチップに「ピーク 15m/s (15時)」のような補助情報

#### 0.13.3 ステータスバー削除 ・ ヘッダー更新ボタンに鮮度集約

Yuka さん指摘 : 「気象庁 今 ・ Open-Meteo 今 ・ 強制更新」が上のヘッダー「更新」ボタンと被って邪魔。

対応 : ステータスバーを **完全削除**、鮮度はヘッダー更新ボタンに統合。

新ヘッダー (右側) :

```
[(refresh) 更新 ・ 23分前] [印刷] [URLコピー] [ヘルプ] [ダーク]
```

- 「更新」ボタン内に「X分前」を併記 (一番古いソースの経過時間)
- キャッシュ中は cached アイコンを更新アイコンに重ねる (or 隣に黄色ドット)
- ホバー / フォーカスで詳細を `title` 属性で出す :
  - `気象庁 18分前 ・ Open-Meteo 23分前 ・ WBGT 簡易計算`
- WBGT ソースバッジ (環境省 / 簡易計算) は ヘルプモーダル or 詳細パネル に格下げ

該当ファイル :

- `src/ui/statusBar.js` を削除
- `src/main.js` から statusBar import / 呼び出し削除
- `src/ui/header.js` の更新ボタンに鮮度ラベル追加
- スマホ (< 768px) ハンバーガー内も同じ

### 0.14 フィルター「行ける日のみ」→「おすすめ日のみ」(Yuka さん再指摘)

問題 : Yuka さん指摘「行ける日のみって自分の予定的に行ける日っぽい書き方だね」 → 「予定空いてる日」と誤読される。

対応 : フィルター文言を **「おすすめ日のみ」** に変更。

| 旧 | 新 |
|---|---|
| `[ ] 行ける日のみ` | `[ ] おすすめ日のみ` |

- ARIA label : 「おすすめ日のみ表示」
- README の絞り込み記述も同様に変更
- 動作 : ON で 総合スコアが「ベスト」or「OK」の日のみ表示 (§0.13.1 ラベル変更後の前提)
- localStorage キーは互換維持

該当 :

- `src/ui/filters.js` のチェックボックス label / aria-label
- README.md の絞り込み説明

### 0.15 テーブル見出しを sticky で画面追従 (Yuka さん指摘)

問題 : 15日分のデータをスクロールしているうちに、列名 (日付 / スコア / 風 / 雨 / 熱 / 気象庁 / Open-Meteo) が見えなくなり「これは何の列?」が分からなくなる。

対応 : `position: sticky` で見出し行をスクロール時にも画面上部に固定。

#### 実装 (CSS only)

`src/styles.css` に追加 :

```css
/* テーブル見出し行を sticky に */
.calendar-header-row,
.table-header-row,
table thead,
table thead th {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--surface);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}

/* ダークモード対応 */
[data-theme="dark"] .calendar-header-row,
[data-theme="dark"] .table-header-row,
[data-theme="dark"] table thead {
  background: var(--surface);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}
```

#### 注意点

- ページ上部のヘッダーバー (タイトル「マイハマびより」) が sticky な場合は、`calendar-header-row` の `top` をヘッダー高さに合わせる (例 `top: 64px`)
- ステータスバー削除 (§0.13.3) 後はヘッダー直下が見出し行になる
- 詳細パネルが行クリックで挿入されても見出し追従は維持
- スマホでも同じ sticky 動作 ・ 横スクロール時もヘッダーは追従
- 詳細パネル内のサブ見出し (時間帯スコア / ショー ・ パレード 等) は sticky 不要 (パネル内のみ表示)

#### 該当ファイル

- `src/styles.css` のみ (HTML 構造変更不要)

### 0.16 バッジ下限ガード (Yuka さん指摘 ・ スコアとバッジの矛盾解消)

問題 : 6/10 (水) の例 :「OK 75 / 風 8m/s 通常 / 雨 34% 2.4mm ほぼ中止」 → 雨ほぼ中止なのに総合 OK は矛盾。

原因 : §0.13.2 でスコア算定窓を **平均値** に変えたが、バッジ判定は **最大値** のまま。整合がとれていない。

対応 : バッジリスク (severity) に応じて総合スコアに **下限ガード** (上限キャップ) を効かせる。

#### Severity 定義

| severity | バッジ例 |
|---|---|
| `normal` | 風/雨/熱「通常」 |
| `warn` | 風バ可能性あり / 雨バ可能性 / 熱バ可能性あり / 暑さ注意 |
| `danger` | 中止リスク高 / 雨キャン濃厚 / 熱キャン濃厚 |
| `critical` | ほぼ中止 |

#### スコアキャップ

```js
const RAW_SCORE = computeAvgScore(forecasts, day, park);   // 平均値ベース (§0.13.2)
const worstSeverity = Math.max(windBadge.severity, rainBadge.severity, heatBadge.severity);

let finalScore = RAW_SCORE;
if (worstSeverity === 'critical')  finalScore = Math.min(finalScore, 25);  // 別日確定
else if (worstSeverity === 'danger') finalScore = Math.min(finalScore, 45);  // 別日
else if (worstSeverity === 'warn')   finalScore = Math.min(finalScore, 65);  // 微妙
// 'normal' はキャップなし
```

| Severity | スコア上限 | スコア区分 |
|---|---|---|
| critical (ほぼ中止) | 25 | 別日 |
| danger (中止濃厚) | 45 | 別日 |
| warn (バ) | 65 | 微妙 |
| normal (通常) | キャップなし | ベスト / OK / 微妙 / 別日 (素のまま) |

#### 整合保証

- バッジが「ほぼ中止」「中止リスク高」のいずれかの日 → 総合は最大「別日」
- バッジが「風バ」「雨バ」「熱バ」「暑さ注意」のいずれかの日 → 総合は最大「微妙」
- すべての日でバッジと総合スコアが整合する

#### ツールチップ補助

ガードが効いた日のスコアラベルにホバーで明示 :

> 「平均値スコアは 75 (OK) ですが、バッジ『雨ほぼ中止』(ピーク 2.4mm/h, 14時) により総合を 25 (別日) に格下げ」

このようにユーザーが「なぜ OK じゃないのか」を理解できる。

#### テスト

- raw=80 ・ バッジ critical → final=25
- raw=80 ・ バッジ danger → final=45
- raw=80 ・ バッジ warn → final=65
- raw=80 ・ バッジ normal → final=80
- 境界値 (raw=25 で critical → 25のまま、raw=20 で critical → 20のまま)

#### 該当ファイル

- `src/score/scoring.js` (computeScore 関数に severity 判定 ・ キャップ適用ロジック追加)
- `src/tests/scoring.test.js` (テスト追加)
- `src/ui/table.js` のスコアセルツールチップに「ガード理由」表示

### 0.17 ヘッダー簡素化 ・ 印刷 / URL コピー / ナイトモード 全削除 (Yuka さん指摘)

問題 : Yuka さん指摘「印刷 ・ URL コピー はあまり使わないから無くす」「ナイトモードも要らない」。

対応 : ヘッダー右側を **「更新 ・ X分前」「ヘルプ」の2ボタン** だけにする。ハンバーガーメニューも項目少なくなるので廃止。

#### 削除する機能 ・ ファイル

| 項目 | 削除対象 |
|---|---|
| 印刷ボタン | `src/ui/print.js` ・ `src/ui/header.js` から該当ボタン削除 |
| URL コピーボタン | `src/ui/header.js` から該当ボタン削除 ・ 用語集モーダルの「URL コピー」案内も削除 |
| ナイトモード (ダークモード) | `src/ui/theme.js` 削除 ・ `src/styles.css` から `[data-theme="dark"]` ブロック全削除 |
| 印刷用 CSS | `src/styles.css` の `@media print { ... }` 全削除 |
| ハンバーガーメニュー | `src/ui/menu.js` 削除 ・ ヘッダーは2ボタン横並びに統一 (スマホでも) |
| manifest.json の theme-color 切替 | ライト固定 |

#### 残す機能 (ヘッダー)

- **更新ボタン** (「更新 ・ X分前」表示、強制更新もこれに集約 §0.13.3)
- **ヘルプボタン** (用語集モーダル)

PC ・ スマホとも横並び2ボタンで収まるのでレイアウト崩れなし。

#### 仕様書側の整理 (参考、Code 作業は不要)

- §3.6 同行者共有 : URL コピー記述削除
- §3.17 印刷モード : 削除
- §6.6 ダークモード : 削除
- §6.9 印刷用 CSS : 削除
- §6.11 ハンバーガーメニュー : 削除
- §14 DoD : 「印刷」「URL コピー」「ダーク切替」項目削除

#### 検証

- 公開ページのヘッダー右側に **「更新 ・ X分前」「ヘルプ」だけ**
- ダーク CSS なし (常にライト)
- 印刷時の見た目は通常レイアウトで OK
- 用語集 (ヘルプ) は維持
- スマホ 375px でも横並び崩れなし
- npm test 緑、npm run build 通る

### 0.18 「undefined」バグ修正 ＋ スコア ・ サブスコアにアイコン併用 (Yuka さん指摘)

#### 0.18.1 「undefined」バグ修正

Yuka さん指摘 : `5/31 (日) undefined スコア80` の `undefined` が何か分からない。

推測原因 (Code 側で要確認) :

- ARIA label or DOM テンプレート文字列に `${...}` が undefined を返してる
- §0.13.1 ラベル変更時に `symbol.label` 参照キーが mismatch (旧「行ってよい」を期待してる箇所が残ってる)
- 曜日変換 ・ スコア区分テキスト ・ ガード理由 (§0.16) のいずれかが undefined

修正手順 :

1. ブラウザで該当箇所を accessibility tree or DOM で確認
2. undefined になっている変数を特定
3. ラベル参照を正しい新名 (`ベスト` `OK`) に直す
4. ARIA label のテストを追加して再発防止

#### 0.18.2 スコア ・ サブスコアに評価アイコン併用

Yuka さん指摘 : 「文字ばかりだからアイコン使って見やすく」。

採用 : 評価系 Material Symbols (Yuka さん選択) :

| スコア | アイコン | 色 | Unicode フォールバック |
|---|---|---|---|
| ベスト | `star` | `#2D8F3E` 緑 | ★ |
| OK | `done` | `#88C057` 薄緑 | ✓ |
| 微妙 | `warning` | `#F2A93B` 黄 | ⚠ |
| 別日 | `block` | `#D24A4A` 赤 | ⊘ |

過去にあった「`check_circle` も `check` も ✓ にフォールバックして混乱」問題は、今回は 4種ともフォント未読込時の Unicode が **形状的に異なる** (★ ✓ ⚠ ⊘) ので発生しない。

#### スコアセル表示

```
[★] ベスト 92  (緑)
[✓] OK 78     (薄緑)
[⚠] 微妙 58   (黄)
[⊘] 別日 32   (赤)
```

DOM 構造 :

```html
<span class="score-pill score-best">
  <span class="material-symbols-rounded" aria-hidden="true">star</span>
  <span class="label">ベスト</span>
  <span class="value">92</span>
</span>
```

ARIA は `aria-label="6月2日 ベスト スコア92"` でテキスト記号を含めない (アイコンは装飾扱い)。

#### サブスコア (時間帯)

```
[朝 ✓]   [昼 ★ 92]   [夜 ⚠]
```

ピル内にアイコン (12-14px 小さめ) + 時間帯ラベル + (昼のみ数値)。

#### 凡例カード

凡例にもアイコン併用 :

> [★] ベスト = 風 ・ 雨 ・ 暑さ全部 OK ／ [✓] OK = 軽微 ／ [⚠] 微妙 = 風バ or 雨バ域 ／ [⊘] 別日 = 中止リスク高

#### CSS

```css
.score-pill .material-symbols-rounded {
  font-size: 18px;
  margin-right: 4px;
  vertical-align: middle;
}
.subscore .material-symbols-rounded {
  font-size: 13px;
  margin-right: 2px;
}
.legend-item .material-symbols-rounded {
  font-size: 16px;
  vertical-align: text-bottom;
}
```

#### 該当ファイル

- `src/score/scoring.js` : ラベル定数に `icon: 'star'` フィールド追加
- `src/ui/table.js` : スコアピル ・ サブスコアピルにアイコン
- `src/ui/legend.js` : 凡例カードにアイコン
- `src/styles.css` : アイコンサイズ ・ 余白

#### 検証

- スコアセル 4種が「アイコン + テキスト + 数値」で表示
- サブスコアピルも「[時間帯ラベル][アイコン]」で表示
- 凡例カードにもアイコン併用
- DOM ・ ARIA に undefined が一切出ない
- フォント未読み込み時も Unicode (★ ✓ ⚠ ⊘) で判別可能
- npm test 緑、npm run build 通る

### 0.19 テーブル全行表示 ＋ sticky 見出し再実装 (Yuka さん指摘)

問題 : Yuka さん指摘「表が範囲内スクロールするの嫌だ ・ 全部表示して」。

原因 : §0.15 sticky 見出し実装時に `.calendar-container` or `.table-wrapper` に `overflow-y: auto` ＋ `max-height` を入れた可能性 (sticky を効かせるため)。結果、表が内部スクロールになり 15日分が見切れる。

対応 : **テーブル全行表示** + **見出しはページ全体スクロールに対して sticky**。

#### CSS 修正

```css
/* テーブルコンテナから overflow / max-height を削除 (全行表示) */
.calendar-container,
.table-wrapper,
.disney-table {
  /* overflow-y: auto;  ← 削除 */
  /* max-height: ...;   ← 削除 */
  overflow: visible;
  height: auto;
  max-height: none;
}

/* thead だけ sticky (ページ全体スクロールで body に追従) */
table thead,
table thead th,
.table-header-row {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--surface);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}

/* スクロール親は body (or html) になる、テーブル親は overflow:visible 必須 */
body, html, #app {
  overflow-y: auto;
  overflow-x: hidden;
}
```

#### 重要なポイント (Code 側)

- `position: sticky` は **「親要素のスクロール領域」に対して** 効く
- 親要素に `overflow: auto/scroll/hidden` があると、その親内でしか sticky しない (＝ ページ全体スクロールに追従しない)
- 「全行表示 + body スクロールで sticky」 にするには、テーブル親には `overflow: visible` を維持

#### モバイル横スクロール

- 列が画面幅より広い場合 (スマホで気象庁/Open-Meteo 列が見切れる場合) は **テーブル本体に `overflow-x: auto`** を入れる
- ただし `overflow-y` は入れない (縦スクロールは body 側)
- これで横スクロールは表内、縦スクロールはページ全体

```css
@media (max-width: 767px) {
  .disney-table {
    overflow-x: auto;
    overflow-y: visible;
  }
}
```

#### 検証

- PC で 15日分が縦に全部並ぶ (内部スクロールなし)
- ページを下スクロールすると見出し行が画面上部に固定
- スマホでも縦は全行表示 ・ 横はみ出る場合だけ横スクロール
- 詳細パネル開いて行数が増えてもスクロール問題なし

#### 該当ファイル

- `src/styles.css` のテーブルコンテナ系セレクタから overflow / max-height 削除
- thead の sticky スタイルは維持

### 0.20 sticky 見出しの z-index 競合修正 (Yuka さん指摘)

問題 : Yuka さん指摘「スクロールすると、アイコンが sticky の上に出るバグありそう」

原因 (典型) :

- アイコン要素 (天気 / 評価 / カテゴリ) や行に `position: relative` ・ `z-index` ・ `transform` ・ `opacity < 1` ・ `filter` などが付いて、**新しい stacking context** を作っている
- sticky 見出しの `z-index` (現状 10 程度) が低すぎてアイコンの上に来れない
- もしくは sticky 親要素の stacking context により、`z-index` が比較対象にならない

#### 対策

1. **sticky 見出しの z-index を引き上げ** :

```css
table thead, table thead th,
.calendar-header-row, .table-header-row {
  position: sticky;
  top: 0;
  z-index: 100;                  /* 10 → 100 */
  background: var(--surface);    /* 不透明背景必須 */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}
```

2. **アイコン側の stacking context リセット** :

```css
.material-symbols-rounded,
.weather-icon,
.score-icon,
.cat-icon,
.score-pill,
.calendar-row .badge {
  position: static;
  z-index: auto;
  transform: none;
  /* opacity: 1 (半透明にしない) */
  /* filter: none */
}
```

3. **sticky 見出しの背景を不透明に** :

```css
table thead th {
  background: var(--surface);    /* 透けない */
  background-clip: padding-box;
}
```

4. **行や行コンテナに transform を入れない** (詳細パネル開閉アニメで `transform` 使う場合は注意) :

- 開閉アニメには `max-height` + `opacity` だけを使い、`transform: scaleY()` 等は避ける
- どうしても transform が必要なら、sticky 親の z-index を 1000 以上に

#### 検証

- スクロール中にアイコン (天気/評価/カテゴリ/バッジ) が見出しの下に潜る (上に出ない)
- 詳細パネル開いた時のグラフ ・ 服装サジェスト ・ ショースケジュール要素も同じ挙動
- スマホ 375px でも sticky 見出しが最前面
- 「行クリックで開いたパネル内のアイコン」も sticky 見出しを超えない

#### 該当ファイル

- `src/styles.css` のみ (HTML 構造変更不要)

### 0.21 「この日に決めた」「同行者 NG」ボタン削除 (Yuka さん指摘)

Yuka さん指摘 : 使わないので削除。

#### 削除対象

- 詳細パネル下部の「この日に決めた」ボタン
- 詳細パネル下部の「同行者 NG」ボタン
- 関連 CSS / state / localStorage キー (掃除)
- §3.5 フィルター中の「同行者 NG マーキング」記述
- §3.9 決定フロー : セクション全廃 or「廃止」注記

#### 該当ファイル

- `src/ui/detailPanel.js` の決定ボタン ・ NG ボタン削除
- `src/styles.css` 関連スタイル削除
- `src/main.js` から状態管理コード削除
- README から「決定フロー」記述削除

### 0.22 スマホ可変レイアウト (カード化、Yuka さん指摘)

問題 : Yuka さん指摘 ・ スマホ実機スクショ確認 :

- テーブル本体で「日付 / スコア / 風 / 雨」しか見えず、「熱 / 気象庁 / Open-Meteo」が右見切れ
- 横スクロールで見るのは不便 ・ 主要情報 (天気アイコン) が一目で分からない

対応 : スマホ (< 768px) 時、テーブルを **カード形式** に変換 (各日が1枚カード)。

#### カード形式 (スマホ)

```
┌─ 5/30 (土) ────────────────┐
│ [block] 別日 0   (中央大)   │
│ 朝(40) 昼(5) 夜(50)         │
├─────────────────────────────┤
│ 風 14m/s ほぼ中止          │
│ 雨 0% 通常                 │
│ 熱 27 通常                 │
├─────────────────────────────┤
│ 気象庁 ☀ 29°/29° 雨0%     │
│ Open-Meteo ☀ 26°/17° 雨53%│
│                  [chevron] →│
└─────────────────────────────┘
```

#### 実装方針

CSS only で、`@media (max-width: 767px)` のとき table 系要素を block 系に切替 :

```css
@media (max-width: 767px) {
  /* table → block 化 */
  .disney-table,
  .disney-table tbody,
  .disney-table tr,
  .disney-table td,
  .disney-table th {
    display: block;
    width: 100%;
    box-sizing: border-box;
  }

  /* header は非表示 (各行内にラベル付きで表示) */
  .disney-table thead {
    display: none;
  }

  /* 各行をカード化 */
  .disney-table tr.calendar-row {
    display: grid;
    grid-template-areas:
      "date score"
      "subscores subscores"
      "wind rain"
      "heat heat"
      "jma openmeteo";
    gap: 8px;
    padding: 12px;
    margin-bottom: 8px;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }

  .disney-table td.cell-date     { grid-area: date; }
  .disney-table td.cell-score    { grid-area: score; }
  .disney-table td.cell-subscores{ grid-area: subscores; }
  .disney-table td.cell-wind     { grid-area: wind; }
  .disney-table td.cell-rain     { grid-area: rain; }
  .disney-table td.cell-heat     { grid-area: heat; }
  .disney-table td.cell-jma      { grid-area: jma; }
  .disney-table td.cell-openmeteo{ grid-area: openmeteo; }

  /* 各セル内にラベル併記 (ヘッダーが見えないので) */
  .disney-table td::before {
    content: attr(data-label);
    display: block;
    font-size: 11px;
    color: var(--text-sub);
    font-weight: 600;
    margin-bottom: 2px;
  }
}
```

#### HTML 側

`td` に `data-label="風"` 等を追加 (`::before` で表示するため) :

```html
<td class="cell-wind" data-label="風">14 m/s ほぼ中止</td>
```

#### 検証

- スマホ 375px で全7セル (日付 / スコア / サブスコア / 風 / 雨 / 熱 / 気象庁 / Open-Meteo) が1カード内に収まる
- 横スクロールなし ・ 縦に全日カードが並ぶ
- 行末 chevron で詳細パネル展開
- 詳細パネルも縦1カラム (§0.12 と整合)
- スクロール時に sticky 見出しは無効化 (カード化したので不要)

#### 該当ファイル

- `src/ui/table.js` の td 生成箇所に `data-label` 追加
- `src/styles.css` の @media (max-width: 767px) にカード化スタイル
- thead 非表示なので sticky は PC のみ

### 0.23 日付セル内にスコア統合 ・ 1列削減 (Yuka さん指摘)

問題 : Yuka さん指摘「日付の下にスコア入れちゃえば1列減らせるのでは」

現状 7列 (日付 / スコア / 風 / 雨 / 熱 / 気象庁 / Open-Meteo) → **6列に削減**。横幅余裕 ・ スマホでも見やすい。

#### 統合後の列構成

| 列 | 内容 |
|---|---|
| 日付 + スコア | 上 : 日付 ・ 曜日 ／ 下 : スコアピル |
| 風 | 風速 + バッジ |
| 雨 | 降水確率 + バッジ |
| 熱 (WBGT) | WBGT 値 + バッジ |
| 気象庁 | 天気アイコン + 概況 + 気温 + 降水確率 |
| Open-Meteo | 同上 |

#### DOM 構造

```html
<thead>
  <tr>
    <th>日付</th>              <!-- 「スコア」列ヘッダー削除 -->
    <th>風</th>
    <th>雨</th>
    <th>熱 (WBGT)</th>
    <th>気象庁</th>
    <th>Open-Meteo</th>
  </tr>
</thead>
<tbody>
  <tr class="calendar-row">
    <td class="cell-date-score" data-label="日付">
      <div class="date-line">5/30 <span class="weekday">(土)</span></div>
      <div class="score-pill score-poor">
        <span class="material-symbols-rounded" aria-hidden="true">block</span>
        <span class="label">別日</span>
        <span class="value">0</span>
      </div>
    </td>
    <td class="cell-wind" data-label="風">14 m/s ほぼ中止</td>
    ...
  </tr>
</tbody>
```

#### CSS

```css
.cell-date-score {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.cell-date-score .date-line {
  font-size: 1.05rem;
  font-weight: 600;
}
.cell-date-score .weekday {
  margin-left: 2px;
  font-size: 0.85rem;
  color: var(--text-sub);
}
.cell-date-score .score-pill {
  align-self: flex-start;
}
```

#### スマホ (< 768px) カード形式 (§0.22 と整合)

`grid-template-areas` も更新 :

```css
.disney-table tr.calendar-row {
  display: grid;
  grid-template-areas:
    "date-score date-score"
    "wind rain"
    "heat heat"
    "jma openmeteo";
  gap: 8px;
}
.disney-table td.cell-date-score { grid-area: date-score; }
```

#### 検証

- PC で 6列構成 ・ 横幅余裕
- スマホで日付 + スコアが1ブロック内に縦並び
- ARIA は日付セル全体を1つの role="cell" ・ 内部のスコアピルに既存の aria-label
- スクロール時の sticky 見出しも 6列に追従
- npm test 緑、npm run build 通る

#### 該当ファイル

- `src/ui/table.js` : テーブルヘッダー ・ ボディの列定義を6列に
- `src/styles.css` : `.cell-date-score` スタイル ・ スマホ grid 更新

### 0.24 スマホカードの視認性 ・ タップ可改善 (Yuka さん指摘)

問題 : Yuka さん指摘「スマホのカードのデザインが見づらい、クリックできることも分かりづらい」。

#### 現状の課題

- カード内が密集 ・ 各セクションの区切りが弱い
- データラベル (data-label「風」「雨」等) が控えめすぎ
- カードが「クリッカブル」と一目で分からない (PC は行末 chevron で分かるが、スマホでは無い)
- スコアセルが他と同サイズ ・ 一番大事な情報が目立たない

#### 改善方針

1. **カードを明確に「ボタン感」のあるデザインに**
   - 明確な border ＋ box-shadow
   - tap で軽く凹む (`transform: scale(0.99)`) ・ shadow が深くなる
   - `cursor: pointer` (PC で hover でも有効)

2. **カード末尾に「タップして詳細」インジケータ**
   - 「詳細を見る ›」 (or chevron) を明示
   - 展開済みは「閉じる ✕」
   - ダッシュライン区切りでセクション感

3. **3段構成で情報密度を整理**
   - 上段 : 日付 (左) ＋ スコアピル (右、大きく)
   - 中段 : 風 / 雨 / 熱 を 3列等幅で横並び
   - 下段 : 気象庁 / Open-Meteo を 2列で横並び (天気アイコン中央寄せ)
   - 各セクション間に薄い区切り線

4. **data-label を強調**
   - 色 : `var(--primary)` (ブルー)
   - フォント : 11px ・ 太字 ・ letter-spacing
   - 各セルの先頭に明示

#### CSS 実装

```css
@media (max-width: 767px) {
  /* カード本体 ・ クリッカブル感 */
  .disney-table tr.calendar-row {
    display: block;
    padding: 16px;
    margin-bottom: 12px;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-card);
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.1s;
  }
  .disney-table tr.calendar-row:active {
    transform: scale(0.99);
    box-shadow: var(--shadow-hover);
  }

  /* 上段 : 日付 + スコアピル (横並び) */
  .disney-table td.cell-date-score {
    display: flex !important;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .cell-date-score::before { content: none; }   /* data-label は不要 */
  .cell-date-score .date-line {
    font-size: 1.15rem;
    font-weight: 600;
  }
  .cell-date-score .score-pill {
    font-size: 1.1rem;
    padding: 8px 14px;
  }

  /* 中段 : 風 / 雨 / 熱 を3列横並び */
  .disney-table td.cell-wind,
  .disney-table td.cell-rain,
  .disney-table td.cell-heat {
    display: inline-block;
    width: 33.33%;
    box-sizing: border-box;
    padding-right: 6px;
    vertical-align: top;
    margin-bottom: 12px;
  }

  /* 下段 : 気象庁 / Open-Meteo を2列横並び */
  .disney-table td.cell-jma,
  .disney-table td.cell-openmeteo {
    display: inline-block;
    width: 50%;
    box-sizing: border-box;
    padding: 12px 4px 0;
    border-top: 1px solid var(--border);
    margin-top: 4px;
    text-align: center;
  }

  /* data-label を強調 */
  .disney-table td::before {
    content: attr(data-label);
    display: block;
    font-size: 11px;
    color: var(--primary);
    font-weight: 600;
    margin-bottom: 4px;
    letter-spacing: 0.5px;
    text-align: left;
  }

  /* カード末尾に「タップで詳細」インジケータ */
  .calendar-row::after {
    content: '詳細を見る ›';
    display: block;
    text-align: center;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed var(--border);
    color: var(--primary);
    font-size: 12px;
    font-weight: 600;
  }
  .calendar-row[aria-expanded="true"]::after {
    content: '閉じる ✕';
  }

  /* thead 非表示 (data-label で代替) */
  .disney-table thead {
    display: none;
  }
}
```

#### DOM (HTML 変更不要)

すでに §0.22 で `data-label` を各 td に設定済の想定。`tr` に `aria-expanded` も §0.6.7 で実装済。
CSS のみで実現。

#### 視覚イメージ

```
┌──────────────────────────────────────┐
│  5/30 (土)            [⊘] 別日 0    │  ← 上段、横並び大きく
│  ──────────────────────────────────  │
│  風              雨            熱    │  ← data-label (青)
│  14m/s          0%            27    │
│  ほぼ中止       通常          通常   │  ← バッジ
│  ──────────────────────────────────  │
│  気象庁            Open-Meteo        │
│  ☀ 晴れ            ☀ 晴れ           │  ← 天気アイコン中央
│  29°/29° 雨0%      26°/17° 雨53%    │
│  ──── 詳細を見る ›  ───────────────  │  ← クリック明示
└──────────────────────────────────────┘
```

#### 該当ファイル

- `src/styles.css` の `@media (max-width: 767px)` 修正 (HTML 構造変更不要)

#### 0.24.2 タイポ ・ スペーシング段階を絞る (Yuka さん追加指摘)

Yuka さん指摘 : 「文字サイズや余白が微妙、余白も無駄が多い」 = 全体的に間延び ・ サイズばらつき。

#### スペーシング段階を絞る (CSS 変数で統一)

```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
}
```

過剰な余白を圧縮 :

| 箇所 | 旧 | 新 |
|---|---|---|
| カード padding (スマホ) | 16px | **12px** |
| カード margin-bottom (gap) | 12-16px | **8px** |
| カード内セクション間 margin | 12px | **8px** |
| 「詳細を見る ›」 padding-top | 12px | **8px** |
| data-label と値の gap | 4px | **2px** |
| スコアピル padding | 8px 14px | **6px 10px** |
| 風/雨/熱 各セル margin-bottom | 12px | **8px** |
| ヘッダー帯 padding | 24px | **16px** |
| 凡例カード padding | 16px | **12px** |
| テーブル td 上下 padding (PC) | 16px | **10px** |

#### タイポ段階を絞る (CSS 変数で統一)

```css
:root {
  --fs-xs: 11px;    /* data-label / 注釈 */
  --fs-sm: 13px;    /* バッジ / サブテキスト */
  --fs-md: 14px;    /* 本文 */
  --fs-lg: 16px;    /* 強調 */
  --fs-xl: 18px;    /* セクション見出し */
  --fs-2xl: 22px;   /* H1 タイトル */
}
```

サイズばらつきを統一 :

| 用途 | 旧 | 新 |
|---|---|---|
| 日付 (スマホカード上段) | 1.15rem | `var(--fs-lg)` 16px |
| スコアピル (スマホ) | 1.1rem | `var(--fs-md)` 14px |
| 数値 (風/雨/熱 値) | 1rem | `var(--fs-md)` 14px |
| バッジラベル | 0.75rem | `var(--fs-xs)` 11px |
| data-label | 11px | `var(--fs-xs)` 11px (統一) |
| ヘッダー H1 | 大きすぎ気味 | `var(--fs-2xl)` 22px |
| 詳細パネル見出し | 1.15rem | `var(--fs-xl)` 18px |

副題 (「舞浜の天気から…」) のスペース ・ サイズも詰め (12px → 11px)。

#### line-height も統一

```css
body { line-height: 1.5; }       /* 1.7 → 1.5 (情報密度↑) */
.calendar-row { line-height: 1.4; }
.score-pill { line-height: 1.2; }
```

#### 該当ファイル

- `src/styles.css` 全体で `padding` `margin` `font-size` `line-height` を上記スケールに統一
- 既存の hardcode 値を CSS 変数化

#### 検証

- スマホ 375px で 1画面に 3-4カード見える (旧 : 2カード程度)
- PC でも余白が引き締まって行数増 ・ スクロール量減
- フォントサイズが2-3段階に整理されて視覚的にまとまる

### 0.25 スマホカード grid 化 ・ inline-block 廃止 (Yuka さん実機スクショ確認)

問題 : §0.24 実装後の実機スクショで以下が崩れている :

- **熱 (WBGT) が左単独配置** → 3列等幅になっていない (風 / 雨 / 熱)
- **気象庁 / Open-Meteo が縦並び** → 2列横並びになっていない (気象庁の天気アイコンが幅広く Open-Meteo を下に押し出した)
- Code が「ブラウザ実測」と言っていたが、Chrome DevTools の Device toolbar (375px iPhone エミュレーション) で確認しないと実機の崩れが見えない

#### 原因

- `display: inline-block + width: 33.33% / 50%` はコンテンツ高さ ・ 内部 white-space で行が崩れる
- table の `tr` が `display: block` でも、子 `td` の inline-block レイアウトは脆い
- 正解は `display: grid + grid-template-areas` で領域を固定 (コンテンツ依存しない)

#### 修正 CSS (ロバスト版)

```css
@media (max-width: 767px) {
  /* table 完全 block 化 */
  .disney-table,
  .disney-table tbody {
    display: block;
    width: 100%;
  }
  .disney-table thead {
    display: none;
  }

  /* tr = カード = grid 親 (固定領域) */
  .disney-table tr.calendar-row {
    display: grid !important;
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "date-score date-score"
      "wind rain"
      "heat heat"
      "jma openmeteo"
      "more more";
    gap: 8px;
    padding: 12px;
    margin-bottom: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.1s;
  }
  .disney-table tr.calendar-row:active {
    transform: scale(0.99);
    box-shadow: var(--shadow-hover);
  }

  /* td を grid 子として block 化 */
  .disney-table td {
    display: block !important;
    box-sizing: border-box;
    width: auto !important;
    min-width: 0;
    padding: 0;
    margin: 0;
  }

  .disney-table td.cell-date-score { grid-area: date-score; }
  .disney-table td.cell-wind       { grid-area: wind; }
  .disney-table td.cell-rain       { grid-area: rain; }
  .disney-table td.cell-heat       { grid-area: heat; }
  .disney-table td.cell-jma        { grid-area: jma; text-align: center; }
  .disney-table td.cell-openmeteo  { grid-area: openmeteo; text-align: center; }

  /* 上段 : 日付＋スコア横並び ・ 下罫線 */
  .disney-table td.cell-date-score {
    display: flex !important;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .cell-date-score::before { content: none; }
  .cell-date-score .date-line { font-size: 15px; font-weight: 600; }
  .cell-date-score .score-pill { font-size: 14px; padding: 4px 10px; }

  /* 中段 ・ 下段の上罫線 */
  .disney-table td.cell-jma,
  .disney-table td.cell-openmeteo {
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  .cell-jma .weather-icon,
  .cell-openmeteo .weather-icon {
    font-size: 32px !important;
    margin-bottom: 2px;
  }

  /* data-label : 青 ・ 11px ・ 太字 */
  .disney-table td::before {
    content: attr(data-label);
    display: block;
    font-size: 11px;
    color: var(--primary);
    font-weight: 600;
    margin-bottom: 2px;
    letter-spacing: 0.3px;
  }

  /* 末尾の「タップで詳細」 (grid-area: more) */
  .disney-table tr.calendar-row::after {
    grid-area: more;
    content: '› タップで詳細';
    text-align: center;
    padding-top: 6px;
    border-top: 1px dashed var(--border);
    color: var(--primary);
    font-size: 11px;
    font-weight: 600;
  }
  .disney-table tr.calendar-row[aria-expanded="true"]::after {
    content: '✕ 閉じる';
  }
}
```

#### 重要ポイント

- `grid-template-areas` で領域を **明示宣言** ・ コンテンツ高さに左右されない
- `td` は `display: block` で grid 子に ・ `inline-block` を廃止
- 熱は1列幅いっぱい (`grid-area: heat` を2カラム占有)、気象庁/Open-Meteo は左右1ずつ確実に
- `::after` も `grid-area: more` でカード末尾領域に確実配置

#### 検証手順 (Code 必須)

1. **Chrome DevTools の Device toolbar** で iPhone (375x812) エミュレーション
2. 公開ページ or `npm run preview` で実機サイズ確認
3. 風 / 雨 / 熱 / 気象庁 / Open-Meteo すべて正しい領域に配置されているか
4. 各カードの高さがコンテンツに合わせて自動調整されるか
5. 実機 Safari スクショと比較 (Yuka さん実機テスト前提)

DevTools の通常ウィンドウサイズ (>768px) で「正しく動く」と判断するのは NG ・ Device toolbar 必須。

### 0.26 ショー表示の集約 ・ 内部ラベル削除 (Yuka さん指摘)

問題 :

1. **同ショーが時刻ごとに別行** : 例 ジャンボリミッキー! が 5回別行表示 :
   ```
   ジャンボリミッキー!レッツ･ダンス! : 12:30 (補助)
   ジャンボリミッキー!レッツ･ダンス! : 13:45 (補助)
   ジャンボリミッキー!レッツ･ダンス! : 15:00 (補助)
   ジャンボリミッキー!レッツ･ダンス! : 16:50 (補助)
   ジャンボリミッキー!レッツ･ダンス! : 18:05 (補助)
   ```
   現状 JSON の `times: ["12:30","13:45","15:00","16:50","18:05"]` を展開して別行レンダリングしてる。1行にまとめるべき。

2. **「(メイン算定窓) (参考) (補助)」内部用語が混入** : 内部 priority 仕様 (high/medium/low) のラベルがそのままユーザー表示に出てる。ユーザーには意味不明。

#### 対応 (UI レンダリング修正)

**1行集約** :

```
✕ 旧 :
  ジャンボリミッキー!レッツ･ダンス! : 12:30 (補助)
  ジャンボリミッキー!レッツ･ダンス! : 13:45 (補助)
  ...

○ 新 :
  ジャンボリミッキー!レッツ･ダンス! : 12:30 / 13:45 / 15:00 / 16:50 / 18:05
```

`times[]` を `" / "` で join して 1行表示。

**内部ラベル削除** :

- `(メイン算定窓)` ・ `(参考)` ・ `(補助)` の **テキスト併記を全廃**
- 代わりに **priority 別に色 ・ 太字で視覚区別** (CSS)

| priority | 表示スタイル |
|---|---|
| high | 太字 ・ 通常テキスト色 ・ 目立つ |
| medium | 通常ウェイト ・ 通常色 |
| low | 通常ウェイト ・ グレー (text-mute) ・ 控えめ |
| null (ショーレストラン) | 通常 ・ 補足アイコン (予約必須) |

#### 表示例 (1日分)

```
[ TDL ]

ディズニー･ハーモニー･イン･カラー : 13:00              (太字 ・ 黒 ・ プレミアアクセス)
イッツ･ア･スウィーツフルタイム! : 15:40                (太字 ・ 黒 ・ プレミアアクセス)
Reach for the Stars : 20:50                          (太字 ・ 黒 ・ プレミアアクセス)
ジャンボリミッキー!レッツ･ダンス! : 12:30 / 13:45 / 15:00 / 16:50 / 18:05   (通常 ・ 黒)
東京ディズニーランド･エレクトリカルパレード･ドリームライツ : 19:30   (通常 ・ グレー)
スカイ･フル･オブ･カラーズ : 20:30                       (通常 ・ グレー)
ミッキーのレインボー･ルアウ : 予約必須                  (通常 ・ グレー ・ アイコン)
```

priority 順序ソート ・ 凡例カードかヘルプモーダルで「太字 = 季節限定 / グレー = 通年 ・ 参考」と説明 (希望者向け)。

#### DOM 構造

```html
<ul class="show-list">
  <li class="show-item priority-high">
    <span class="show-name">ディズニー･ハーモニー･イン･カラー</span>
    <span class="show-times">13:00</span>
    <span class="show-tags">プレミアアクセス</span>
  </li>
  <li class="show-item priority-medium">
    <span class="show-name">ジャンボリミッキー!レッツ･ダンス!</span>
    <span class="show-times">12:30 / 13:45 / 15:00 / 16:50 / 18:05</span>
    <span class="show-tags">エントリー受付</span>
  </li>
  <li class="show-item priority-low">
    <span class="show-name">東京ディズニーランド･エレクトリカルパレード･ドリームライツ</span>
    <span class="show-times">19:30</span>
  </li>
</ul>
```

#### CSS

```css
.show-item { display: flex; align-items: baseline; gap: 8px; padding: 4px 0; }
.show-name { font-weight: 400; }
.show-times { color: var(--text-sub); font-variant-numeric: tabular-nums; }
.show-tags { font-size: 11px; color: var(--text-sub); }

.show-item.priority-high .show-name { font-weight: 600; color: var(--text); }
.show-item.priority-medium .show-name { font-weight: 400; color: var(--text); }
.show-item.priority-low .show-name { font-weight: 400; color: var(--text-mute); }
.show-item.priority-low .show-times { color: var(--text-mute); }
```

#### 該当ファイル

- `src/ui/detailPanel.js` (or 該当ショースケジュールレンダラ) :
  - `times[]` を ` / ` で join
  - `(メイン算定窓)` `(参考)` `(補助)` のテキスト出力を **完全削除**
  - `priority` プロパティを `<li class="priority-{priority}">` の class 名に反映
- `src/styles.css` : `.show-item.priority-{high|medium|low}` スタイル追加

#### 検証

- 詳細パネルの「ショー ・ パレード」セクションで :
  - ジャンボリミッキー!が1行 (5時刻併記) で表示
  - (メイン算定窓) (参考) (補助) のテキストが消えている
  - high (季節限定) が太字 ・ low (通年) がグレーで視覚区別される
  - TDL/TDS タブ両方で同じ修正適用

### 0.27 スマホカード 4点微調整 (Yuka さん実機指摘)

実機スクショで以下4点を確認 :

1. **風 ・ 雨 ・ 熱を1列3分割にしたい** : 現状は風雨が2列 ・ 熱が次行全幅 (§0.25 grid-template-areas が `"wind rain"/"heat heat"` で2行に分かれてる)
2. **「タップで詳細」と chevron arrow が二重** : 左下に `^` chevron、別途「› タップで詳細」テキスト両方表示 → どちらか一方に
3. **カードデザインと toggle (chevron) デザインが不一致** : chevron が浮いてる → 廃止して統一
4. **「別日 25」スコアピルが浮く ・ サイズ ・ 位置** : 日付の下に左寄せで縦並びになっていて統一感欠落 → 横並びで右寄せ

#### CSS 修正 (src/styles.css の @media (max-width: 767px))

```css
/* 1. 風 ・ 雨 ・ 熱を3分割 ・ grid-template-areas を 6列ベースに */
.disney-table tr.calendar-row {
  display: grid !important;
  grid-template-columns: repeat(6, 1fr);
  grid-template-areas:
    "date-score date-score date-score date-score date-score date-score"
    "wind wind rain rain heat heat"
    "jma jma jma openmeteo openmeteo openmeteo"
    "more more more more more more";
  gap: 8px;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.1s;
}

/* 4. 日付＋スコアを横並び ・ space-between でスコア右寄せ */
.disney-table td.cell-date-score {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center;
  width: 100%;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.cell-date-score::before { content: none; }
.cell-date-score .date-line {
  font-size: 16px;
  font-weight: 600;
}
.cell-date-score .score-pill {
  font-size: 14px;
  padding: 4px 10px;
  flex-shrink: 0;       /* 縮まないように */
}

/* 2 & 3. chevron 廃止 ・ 「タップで詳細」テキスト一本に */
.disney-table tr.calendar-row .chevron,
.disney-table tr.calendar-row .toggle-icon,
.disney-table tr.calendar-row [class*="expand-icon"] {
  display: none !important;
}

/* 「タップで詳細」テキストは ::after で grid-area: more に表示 (既存維持) */
.disney-table tr.calendar-row::after {
  grid-area: more;
  content: '› タップで詳細';
  text-align: center;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
  color: var(--primary);
  font-size: 11px;
  font-weight: 600;
}
.disney-table tr.calendar-row[aria-expanded="true"]::after {
  content: '✕ 閉じる';
}
```

#### 視覚イメージ (修正後)

```
┌───────────────────────────────────────┐
│ 5/30 (土)              [別日 25]      │  ← 横並び ・ スコア右寄せ
│ ─────────────────────────────────     │
│ 風          雨          熱            │  ← data-label
│ 12m/s       0%          26            │
│ 中止リスク高 通常       暑さ注意       │  ← 3列等幅
│ ─────────────────────────────────     │
│ 気象庁              Open-Meteo        │
│ ☀ 晴れ               ☀ 晴れ           │  ← 大きい天気アイコン
│ 29°/29° 雨0%        26°/17° 雨53%    │
│ ─ ─ ─ › タップで詳細 ─ ─ ─           │  ← chevron なし ・ テキストのみ
└───────────────────────────────────────┘
```

#### 検証 (Chrome DevTools 375px iPhone エミュレーション必須)

- 風 / 雨 / 熱 が3列等幅で並ぶ (熱が全幅にならない)
- chevron `^` が表示されない (CSS で非表示)
- 「タップで詳細」テキストだけが下部に出る
- 開いた状態は「✕ 閉じる」に変わる
- 日付 (左) と「別日 25」(右) が横並び ・ スコアピル右寄せ
- 開閉時 ・ ダーク ・ ライト両方で破綻なし
- npm test 緑、build 通る

#### 該当ファイル

- `src/styles.css` の @media (max-width: 767px) のみ修正
- HTML / JS 変更不要 (chevron は既存 DOM のまま非表示)

### 0.28 Phase 2 第3弾 : 公式運営状況の蓄積

概要 : TDR 公式運営状況ページから当日の中止 ・ 内容変更告知を 1日3回取得して蓄積。第4弾 (的中追跡) の基礎データとなる。

#### データ源

- TDL : `https://www.tokyodisneyresort.jp/info/operation.html`
- TDR 公式運営カレンダー (個別日付) : 既存 §0.8 で取得済の `tdl/daily/calendar/{YYYYMMDD}/` / `tds/...` ページにも「赤字 = 当日変更」の情報が出る

#### 取得頻度

- 1日3回 (08:00 / 12:00 / 18:00 JST)
- 取得失敗時は次回再試行 (Akamai 一時的ブロック対策)

#### 実装方針 (3段階)

**Stage 1 (Phase 2 で実装) : 手動 ・ ローカル Mac スクリプト**

```
scripts/fetch-operation.mjs (新規)

引数 : なし (デフォルト今日) or YYYYMMDD
動作 :
  - Playwright (headless Chrome) で operation.html + daily/calendar を取得
  - 中止 ・ 変更告知をパース
  - src/data/operation-log/{YYYY-MM-DD}.json に書き込み (1日1ファイル ・ 取得タイミング別配列)
  - リクエスト間 3秒 sleep、User-Agent 明示
```

JSON 例 :

```json
{
  "date": "2026-06-05",
  "snapshots": [
    {
      "fetchedAt": "2026-06-05T08:00:00+09:00",
      "park": "TDS",
      "closedShows": ["ビリーヴ!〜シー･オブ･ドリームス〜", "【環境演出】スパークリング･ジュビリー･ナイト"],
      "modifiedShows": [
        { "name": "ダンス･ザ･グローブ!", "originalTimes": ["13:00","14:45","17:05","18:50"], "actualTimes": ["13:00","14:45","17:05"] }
      ],
      "earlyClose": "18:30",
      "closedAttractions": [],
      "rawTextSnippet": "..."
    },
    { "fetchedAt": "2026-06-05T12:00:00+09:00", ... },
    { "fetchedAt": "2026-06-05T18:00:00+09:00", ... }
  ]
}
```

**Stage 2 (Phase 3 で検討) : GitHub Actions cron で自動化**

- `.github/workflows/fetch-operation.yml` で 1日3回 cron 実行
- Playwright を Actions の Ubuntu で動かす (Akamai のリスクあり、ローカル Mac の方が確実かも)
- 取得 ・ commit & push 自動化

**Stage 3 (将来) : Cloudflare Workers + Browser Rendering API**

- Workers cron で完全自動化 ・ 蓄積を R2 に
- ただし Browser Rendering は有料の可能性 (CF 課金確認)

#### artifact 側 UI

詳細パネル内の「ショー ・ パレード」セクションの直下に **「当日中止情報」** を追加表示 :

```
─── 当日中止情報 (xx時時点) ───
✕ ビリーヴ!〜シー･オブ･ドリームス〜 中止 (天候不良)
⚠ ダンス･ザ･グローブ! 一部省略 (18:50 公演 中止)
```

#### package.json script

```
"scripts": {
  "fetch-operation": "node scripts/fetch-operation.mjs"
}
```

#### 運用フロー (Phase 2 段階)

- Yuka さんが必要時に Mac で `npm run fetch-operation` 実行 (手動)
- Phase 3 で cron 化検討

#### 該当ファイル

- `scripts/fetch-operation.mjs` (新規)
- `src/data/operation-log/.gitkeep` (新規ディレクトリ)
- `src/data/operationLog.js` (新規 ・ 取得結果 import + UI 提供)
- `src/ui/detailPanel.js` に「当日中止情報」セクション追加
- `README.md` に運用フロー追加

#### 検証

- `npm run fetch-operation` 実行で当日 JSON が出力
- 公開ページの詳細パネルに「当日中止情報」セクション表示 (取得済の日)
- 取得失敗時は表示なし (UI 壊さない)
- ローカル取得は Akamai 通過確認 (Cowork Chrome MCP 同様の挙動)

### 0.29 Phase 2 第4弾 : 過去予報の的中追跡

概要 : 各天気予報ソース (JMA / Open-Meteo / 環境省 WBGT) の **前日予報** と **当日実測** を比較してログ蓄積 ・ ソース別の平均誤差を出す。最終的にソース信頼度補正 (重み付け) に発展。

#### データ源

- **予報スナップショット** : 既存の予報取得 (artifact 起動時 fetch) を Workers KV or repo に保存
- **実測値** : 気象庁アメダス `https://www.jma.go.jp/bosai/amedas/data/point/44132/{YYYYMMDD}_{HH}.json` (船橋) ・ 環境省 WBGT 実測

#### 実装方針 (3段階)

**Stage 1 (Phase 2 で実装) : 予報スナップショット保存**

- artifact が予報取得時に **`src/data/forecast-snapshots/{YYYY-MM-DD}.json` に書き込み** (公開ページからは Cloudflare Workers 経由で R2 / KV に書く ・ ローカル開発時はファイル)
- 1日1回 (午前) スナップショット作成 ・ その日の前日に取得した予報のみ保持

**Stage 2 : 観測値取得 ・ 比較スクリプト**

```
scripts/track-accuracy.mjs (新規)

動作 :
  - 引数 (or 今日) の日付について :
    - src/data/forecast-snapshots/{YYYY-MM-DD}.json (前日の予報) を読む
    - 気象庁アメダスから当日実測値を取得 (全 24時間 ・ 風速 ・ 降水量 ・ 気温)
    - 環境省 WBGT 実測値 (取得済) と比較
    - ソース別の誤差を計算 (RMS / MAE)
  - 結果を src/data/accuracy-log.json に追記 (日次)
```

JSON 例 :

```json
{
  "2026-06-05": {
    "park": "TDR",
    "actualMaxWind": 11.5,
    "actualMaxPop": 60,
    "actualMaxTemp": 27,
    "actualMaxWbgt": 28,
    "forecasts": {
      "jma": { "predictedMaxWind": 10, "windError": 1.5, "predictedPop": 50, "popError": 10 },
      "open-meteo": { "predictedMaxWind": 12, "windError": 0.5, "predictedPop": 65, "popError": 5 },
      "env-jp": { "predictedMaxWbgt": 27, "wbgtError": 1 }
    }
  }
}
```

**Stage 3 (将来) : ソース信頼度補正**

- 30日 蓄積 → 各ソースの平均誤差から重み計算
- スコアリングで weighted average に変更 (`src/score/scoring.js`)
- artifact に「ソース信頼度」表示 ・ 「JMA は風速を5%過小評価しがち」等

#### artifact 側 UI

別 artifact (or 詳細パネル末尾) に「予報精度ダッシュボード」 :

- 過去N日の各ソース誤差の折れ線グラフ
- 平均誤差比較
- 直近の的中例 ・ 外し例

#### package.json script

```
"scripts": {
  "track-accuracy": "node scripts/track-accuracy.mjs"
}
```

#### 運用フロー

- Yuka さんが Mac で `npm run track-accuracy` を翌日朝に実行 (手動)
- Phase 3 で GitHub Actions cron で 1日1回自動

#### 該当ファイル

- `scripts/track-accuracy.mjs` (新規)
- `src/data/forecast-snapshots/.gitkeep` (新規ディレクトリ)
- `src/data/accuracy-log.json` (新規)
- 予報スナップショット保存ロジック (Phase 2 では手動取得 ・ 後日 artifact 内自動保存)
- (Phase 3) artifact に「予報精度ダッシュボード」セクション

#### 検証

- `npm run track-accuracy` 実行で前日の的中ログ作成
- accuracy-log.json に日次追記
- 30日蓄積後にソース別平均誤差が見える

### 0.30 アメブロ風キャン記録の統合 (Phase 2 第4弾 強化版 ・ Yuka さん発掘)

#### 経緯

Yuka さんが TSUBASA のディズニーパークブログ記事を共有 :
<https://ameblo.jp/tsu-disney/entry-12962621607.html>

このブロガーが X (旧 Twitter) `@tdr_syopare_can` の投稿をまとめて、月別 PDF で配布している。Google Drive 共有リンクで 5ヶ月分 (2025/12 〜 2026/04) 入手可能。

→ **Phase 2 第4弾 (的中追跡) の本命データソース**。30日待たずに、いきなり 5ヶ月 150日分の正解ラベル + 実測風速取得済 → 即座にショー別中止予測モデル構築可能。

#### データ構造 (PDF 抽出後の構造化案)

各ショーごとに :

- **風キャン閾値** (一次情報) :
  - ディズニー・ハーモニー・イン・カラー : 風バ 6m〜 / 風キャン 12m〜
  - イッツ・ア・スウィーツ・フルタイム! : 風キャン 12m〜
  - Reach for the Stars : **パイロカット 8m〜** (花火部分のみ削除)
  - エレクトリカル・パレード・ドリームライツ : 風キャン 10m〜
  - ビリーヴ! : 風バ 5m〜 / 風キャン 12m〜
  - スパークリング・ジュビリー・セレブレーション : 風キャン 12m〜

- **日別実測 + 公演実施状況** :
  - date / time / avgWind / maxWind / status (ok / cancel / partial / suspended) / note

#### JSON スキーマ

```json
{
  "month": "2026-04",
  "source": "TSUBASA のディズニーパークブログ + X @tdr_syopare_can",
  "sourceUrl": "https://drive.google.com/file/d/{fileId}/view",
  "weatherSource": "東京 / 江戸川臨海 アメダス",
  "fetchedAt": "ISO8601",
  "shows": [
    {
      "name": "ディズニー･ハーモニー･イン･カラー",
      "park": "TDL",
      "windBaThreshold": 6,
      "windCancelThreshold": 12,
      "records": [
        { "date": "2026-04-01", "time": "14:15", "avgWind": 4.1, "maxWind": 6.8, "status": "ok", "note": "雨バージョン (ダンサーあり)" },
        { "date": "2026-04-03", "time": "14:15", "avgWind": 7.3, "maxWind": 9.6, "status": "ok" },
        { "date": "2026-04-09", "time": "15:15", "avgWind": 9.7, "maxWind": 13.9, "status": "cancel", "note": "強風のため" },
        { "date": "2026-04-08", "status": "suspended" }
      ]
    },
    {
      "name": "Reach for the Stars",
      "park": "TDL",
      "pyroLimitThreshold": 8,
      "records": [
        { "date": "2026-04-04", "time": "20:35", "avgWind": 10.3, "maxWind": 14.1, "status": "ok", "note": "パイロカット (強風)" }
      ]
    }
  ]
}
```

#### ステータス分類

| status | 意味 | パターン例 |
|---|---|---|
| `ok` | 通常実施 | ○ |
| `partial` | 一部省略 ・ 風バ ・ パイロカット | ○パイロカット(強風) / ○※風バの可能性あり / ○強風のため公演内容一部変更 |
| `cancel` | 中止 | ×強風のため / ×悪天候のため |
| `partial-cancel` | 途中中止 | ×悪天候のため途中中止 |
| `suspended` | 休止 (季節入れ替え等) | 休止 |
| `system-issue` | システム不具合 | ×システム不具合のため |

#### 取得元 PDF (Google Drive ・ ブロガー公開)

| 月 | fileId |
|---|---|
| 2025-12 | `1JGnoew4XA8U_L8NlYCYqkbUtIT9fEieD` |
| 2026-01 | `1d-HdjSiisQ0i0KbGwS9KIrW_V6Uzzbar` |
| 2026-02 | `1eLc5UOEPC8fZFRd5z61-4-Q4MkltCpFJ` |
| 2026-03 | `1NHs70ZEzTR9ZI75HHcOeUx41Q4r_diJJ` |
| 2026-04 | `1EOF8gF_VvAnr7wOMa1iqg0CUB7f5ChUm` |

ダウンロード : `https://drive.google.com/uc?export=download&id={fileId}`

#### 取得 ・ パーサ実装

```
scripts/import-cancel-history.mjs (新規)

引数 : YYYY-MM (省略時は全月)
動作 :
  - 該当月の PDF を Google Drive からダウンロード
  - pdftotext -layout で抽出 (poppler-utils 必要)
  - テキスト pattern match で ショー別 ・ 日別レコードに変換
  - src/data/cancel-history/{YYYY-MM}.json に保存
  - ショー閾値テーブルも自動生成 (windBaThreshold / windCancelThreshold / pyroLimitThreshold)
```

pdftotext 出力例 (4月ハーモニー部分) :

```
4月1日    14:15     4.1    6.8 ○雨バージョン（ダンサーあり）
4月2日    14:15     2.8    3.9 ○雨バージョン（ダンサーあり）
4月3日    14:15     7.3    9.6 ○
4月8日    休止
4月9日    15:15     9.7   13.9 ×強風のため
```

正規表現 : `^\s*(\d+)月(\d+)日\s+(?:(\d{1,2}:\d{2})\s+([\d.]+)\s+([\d.]+)\s+(.+))?$`

注 : TDL と TDS が左右2カラム並列 ・ TDS のショースケジュールは更に4カラム並列の月もあり (PDF レイアウト依存)。パーサは「ショー見出し」検出 + 列幅位置 (col offset) で分割が必要。

#### 統合先

`src/data/cancel-history/` に 5ヶ月分 JSON を配置 + `src/data/show-thresholds.js` (ショー別風キャン閾値テーブル)。

#### 予測モデルへの統合

(Phase 3 で実装、まずはデータ蓄積)

1. **ショー別閾値を §5.5 のバッジ判定に反映** :
   - 現状 : 全ショー一律 `8m/s 風バ / 10m/s 中止`
   - 新 : ショー別 (例 Reach for the Stars は 8m/s でパイロカット、ハーモニーは 6m/s 風バ)
   - これだけで判定精度大幅向上

2. **過去同条件の中止率表示** (詳細パネル) :
   - 「過去 150日のうち、平均風速 8m/s でハーモニーが中止された確率 : 15%」
   - 各日のスコアセルにツールチップで補助情報

3. **統計予測モデル** (将来) :
   - 過去 150日 + 気象データで分類器
   - 「明日のハーモニー中止確率 38%」みたいな予測

#### ライセンス ・ 出典

- データ源 : TSUBASA のディズニーパークブログ + X `@tdr_syopare_can` の投稿
- 個人利用範囲 ・ 商用利用しない
- 公開ページ ・ README に出典明記 (リンク含む)
- スクレイピング頻度 : 月1回程度 (新月分のみダウンロード)
- ブロガーの記事 ・ X 投稿は二次情報 ・ 一次情報源は X
- もし削除依頼があれば即時撤去

#### 該当ファイル

- `scripts/import-cancel-history.mjs` (新規 ・ PDF ダウンロード + パース + JSON 化)
- `src/data/cancel-history/.gitkeep` (新規ディレクトリ)
- `src/data/cancel-history/2025-12.json` 等 (5ヶ月分)
- `src/data/show-thresholds.js` (新規 ・ ショー別閾値テーブル)
- `src/score/scoring.js` (ショー別閾値を反映 ・ §5.5 更新)
- README に出典セクション追加

#### 検証

- `npm run import-cancel-history -- 2026-04` で 4月 JSON 出力
- 5ヶ月分すべて出力後、合計 record 数が 150 × 6 = 900 程度
- ショー別風キャン閾値テーブル生成
- スコアリングがショー別閾値で動作
- npm test 緑

#### 将来のデータソース候補 (Phase 3 で検討)

Phase 2 第4弾は **アメブロ PDF 5ヶ月分のみ** で実装。以下は確認済の追加データ源 (今回は見送り、将来取得可能) :

**1. X (Twitter) `@tdr_syopare_can` の熱キャン投稿 (画像)**

- 2024年 7/1 〜 10/10 の **ハーモニー・イン・カラー 熱キャン** データ (約 102日分)
- 投稿例 :
  - 気温順 : <https://x.com/tdr_syopare_can/status/1931658617029357857>
  - 日付順 : <https://x.com/tdr_syopare_can/status/1931696134566859032>
- 形式 : Excel テーブルの画像投稿 (テキスト抽出不可、画像認識必要)
- 取得方法 : Yuka さんが Cowork チャットに画像 upload → Claude vision で JSON 化
- 同様の投稿が他ショー ・ 他年も存在する可能性

**2. Wix サイト `amane66.wixsite.com` のフレンジー (ハロウィーン期間パレード) 記録**

- URL : <https://amane66.wixsite.com/my-site-5/フレンジー-1>
- 2025年9〜11月の フレンジー (ハロウィーン期間) 中止記録
- 形式 : 日付順 / 風速順 / 気温順の 3テーブル ・ ただし HTML テキスト取得不可 (Wix の埋め込み画像/iframe)
- 取得方法 : 同上 (画像 upload → vision)
- 他のショーのページもサイト内にあるかも (要ナビゲーション確認)

**Phase 3 での運用案** :

- 月初 ・ 季節パレード追加時に、Yuka さんが上記ソースのスクショを Cowork チャットに upload
- Cowork が vision で読み取り → JSON 化 → `src/data/cancel-history/{YYYY-MM}-{show-key}.json` 追記
- Code は既存 import-cancel-history.mjs + getCancelHistory(date, show) で参照

**現状の規模感** :

- Phase 2 (PDF のみ) : 900 records (6ショー × 5ヶ月)
- Phase 3 統合後 : + 約 200 records (熱キャン + フレンジー)
- ML 分類器 / 過去同条件中止率 表示が可能になる規模

### 0.31 過去 N 日中 X% 中止表示 (Phase 3 第1弾)

概要 : §0.30 で取り込んだ cancel-history JSON (5ヶ月 2,111件) を使い、各日の予報に対して「過去同条件で何% 中止だったか」を表示。バッジだけでは伝わらない予測信頼度をユーザーに直接見せる。

#### ロジック (src/score/cancelProbability.js 新規)

```js
export function getCancelProbability(showName, predictedAvgWind, predictedMaxWind, currentMonth) {
  // 1. cancel-history からショー別 records を取得
  const records = getAllRecordsForShow(showName);
  if (records.length < 20) return null;   // サンプル少なすぎ → 表示しない
  
  // 2. 同条件フィルタ : 風速 ±2m/s
  const similar = records.filter(r =>
    r.maxWind != null &&
    Math.abs(r.maxWind - predictedMaxWind) <= 2.0
  );
  
  // 3. (オプション) 同月フィルタも適用 (季節性)
  // const sameMonth = similar.filter(r => r.date.slice(5,7) === currentMonth);
  
  if (similar.length < 5) return null;
  
  // 4. 中止率算出
  const cancelStatuses = ['cancel', 'partial-cancel'];
  const cancelCount = similar.filter(r => cancelStatuses.includes(r.status)).length;
  const probability = cancelCount / similar.length;
  
  return {
    probability: Math.round(probability * 100),  // %
    sampleSize: similar.length,
    cancelCount,
    conditionWind: predictedMaxWind,
  };
}
```

#### 表示位置 (詳細パネル内 ・ ショー別)

```
┌─ ショー ・ パレード TDL ─────────────────────┐
│ ディズニー・ハーモニー・イン・カラー 13:00      │
│   ↳ 予報 max 9m/s → 過去同条件 18件中 4件中止  │
│      (22% 中止リスク)                         │
│                                              │
│ イッツ ・ ア ・ スウィーツフルタイム! 16:25      │
│   ↳ 予報 max 9m/s → 過去同条件 12件中 1件中止  │
│      (8% 中止リスク)                          │
└──────────────────────────────────────────────┘
```

#### 表示パターン

- サンプル 20件以上 ・ 同条件 5件以上 : 「過去 N件中 M件中止 (X%)」表示
- サンプル不足 : 表示しない (誤情報回避)
- 中止率 ≧ 50% : 赤系警告
- 中止率 30 - 49% : 黄系注意
- 中止率 < 30% : グレー (参考表示)

#### スコアセル ・ サマリへの統合 (オプション)

- スコアセル右側に小さく「中止 22%」バッジ
- TOP3 のサマリにも「中止リスク 20%」併記

#### 該当ファイル

- `src/score/cancelProbability.js` 新規
- `src/data/cancelHistoryLoader.js` 新規 (or 既存) ・ cancel-history JSON を統合読み込み
- `src/ui/table.js` の詳細パネル ショー表示部に中止確率追加
- `src/score/scoring.js` の総合スコアにも中止確率を反映 (オプション ・ Phase 3.5)

#### 検証

- 公開ページの詳細パネル内、各ショーに「過去 N件中 M件中止 (X%)」表示
- サンプル少ない日 (台風レベルの極端風 等) は表示なし
- npm test 緑

### 0.32 予報精度ダッシュボード (Phase 3 第2弾)

概要 : §0.29 で蓄積される accuracy-log.json を可視化。30日以上溜まれば各ソース (JMA / Open-Meteo / 環境省 WBGT) の平均誤差 ・ バイアスが見える。

#### UI (別 artifact or 詳細パネル拡張)

**案A : 別 artifact「マイハマびより 予報精度ダッシュボード」** (推奨)

- 公開ページとは別 URL (例 `disney-weather.pages.dev/accuracy`)
- 毎日 accuracy-log.json から自動更新
- Yuka さんが時々見て「JMA より Open-Meteo の方が風速を当ててる」みたいな知見得る

**案B : 詳細パネル拡張**

- 既存詳細パネルに「予報精度 (ベータ)」セクション
- その日の各ソースの過去30日平均誤差を小さく表示
- 「JMA : 風速 RMS 1.2m/s ・ Open-Meteo : 1.5m/s」

#### 表示要素

1. **時系列グラフ** (Chart.js) :
   - 横軸 : 過去 30日
   - 縦軸 : 各ソースの誤差 (RMS)
   - 系列 : JMA wind / Open-Meteo wind / 環境省 WBGT

2. **平均誤差 ・ バイアス表** :
   ```
   | ソース      | wind RMS | wind バイアス | pop RMS | WBGT RMS |
   | JMA        | 1.2 m/s  | +0.3 (過大評価)| 12%    | -        |
   | Open-Meteo | 1.5 m/s  | -0.5 (過小評価)| 8%     | -        |
   | 環境省 WBGT |  -      |  -            |  -      | 0.8     |
   ```

3. **直近の的中例 ・ 外し例**
   - 「6/5 風予報 8m/s ・ 実測 12m/s ・ JMA 4m/s 外し」
   - 「6/8 ピタリ ・ 全ソース誤差 < 0.5」

4. **インサイト自動生成** (Claude askClaude で簡易)
   - 「JMA は雨予報を 5% 過小評価しがち、傘持参を推奨」
   - 「Open-Meteo は風速のピークを 1m/s 過大評価しがち、安心係数として使える」

#### 該当ファイル

- `src/ui/accuracyDashboard.js` 新規 (別 artifact or 詳細パネル拡張)
- `dist/accuracy.html` 新規 (別 artifact の場合)
- `src/data/accuracyLogLoader.js` 新規 (or 既存) ・ accuracy-log.json 統合読み込み + 集計関数

#### 検証

- accuracy-log.json に最低 7日分溜まればグラフ描画開始
- 30日以上で各ソース平均誤差表示
- Chart.js 時系列描画 OK
- npm test 緑

#### 運用前提

- Yuka さんが毎朝 (or 隔日) `npm run snapshot-forecast` + 翌日 `npm run track-accuracy` を Mac で実行
- (Phase 3.5) GitHub Actions cron で自動化検討

### 0.33 (α) 熱キャン / フレンジー追加運用 (Yuka さん画像 upload → Cowork vision 読み取り)

概要 : §0.30 で見送った X 熱キャン画像 + Wix フレンジー HTML (画像) を、運用ベースで追加取り込む仕組み。Yuka さんが画像をチャットに添付 → Cowork (Claude vision) が読み取り → JSON 化 → 既存 cancel-history と統合。

#### Yuka さん運用フロー

1. X (`@tdr_syopare_can`) や Wix amane66 サイトで気になる画像を見つけたら、スクショを Cowork チャットに添付
2. 1行コメントで補足 (例「2024年7-10月のハーモニー熱キャン、気温順」)
3. Cowork が vision で表構造を読み取り → 一次確認のため JSON サンプルを表示
4. Yuka さん OK → Cowork が `src/data/cancel-history/{YYYY-MM}-{show-key}.json` に保存
5. Yuka さんが git commit & push (or Cowork から PR)

#### ファイル命名規則

```
src/data/cancel-history/
├── 2025-12.json          (アメブロ PDF ・ 全ショー風キャン)
├── 2026-01.json
├── ...
├── 2024-07-harmony-heat.json    (X 熱キャン ・ ハーモニー ・ 月別)
├── 2024-08-harmony-heat.json
├── 2025-09-frenzy-wind.json     (Wix ・ フレンジー)
└── 2025-10-frenzy-wind.json
```

スキーマは §0.30 と同じ (`shows[].records[]`)、ファイル単位で「ショー × 月 × 種別」で分割。

#### Code 側修正 (Phase 3 で必要なら)

- `src/data/cancelHistoryLoader.js` が `src/data/cancel-history/*.json` を全部マージして `getAllRecordsForShow(showName)` で取得できれば、ファイル分割しても何もせず統合される
- 既に §0.30 で全 JSON マージ実装済なら追加コード不要

#### Cowork (vision) 読み取り精度

- Excel 風細セル : 約 85-95% (Claude Sonnet vision)
- 不明セル / 欠損は `null` ・ 取り込まない (誤情報回避)
- Yuka さんが事前に確認 → 怪しい値は手動修正

#### 出典明記

- README ・ 公開ページのデータ出典に X `@tdr_syopare_can` + Wix amane66 を追加 (既に §0.30 末尾に記載済)

### 0.34 (ν) iOS PWA インストール促進バナー

概要 : iOS Safari で公開ページを開いた初回ユーザーに「ホーム画面に追加してアプリのように使う」案内を表示。リピート利用 ・ 同行者シェア時の体験向上。

#### 表示条件

- ブラウザ : iOS Safari (UA 判定)
- PWA 環境ではない (`display-mode: standalone` false)
- localStorage で `pwaBannerDismissed !== 'true'`
- 訪問 2回目以降 (1回目はバナー邪魔なので非表示、`visitCount >= 2`)

#### バナー UI

画面下部 (sticky) に控えめなバナー :

```
┌─────────────────────────────────────────────┐
│ アプリのように使えます ・ ホーム画面に追加 ›  ✕ │
└─────────────────────────────────────────────┘
```

- 「ホーム画面に追加 ›」 タップ → モーダルで手順案内
- 「✕」 タップ → 1週間非表示 (localStorage に dismissedUntil)
- 「もう表示しない」 (モーダル内) → 永続非表示

#### モーダル内 案内

```
ホーム画面に追加する方法 (iPhone Safari)

1. 画面下部の共有ボタン (□↑) をタップ
2. 「ホーム画面に追加」を選ぶ
3. 名前 (デフォルト : マイハマびより) を確認して「追加」

→ ホーム画面のアイコンから アプリのように起動できます
   (フルスクリーン / オフライン対応 / 通信が軽い)
```

(可能なら手順の動画 GIF or イラスト併記、Phase 3.5 で実装)

#### 該当ファイル

- `src/ui/installBanner.js` 新規
- `src/utils/visitTracker.js` 新規 (or 既存) ・ 訪問回数カウント
- `src/styles.css` バナー + モーダルスタイル
- `src/main.js` から初期化

#### 検証

- iOS Safari で2回目訪問にバナー表示
- 「ホーム画面に追加」モーダル動作
- ✕ で1週間非表示 ・ 「もう表示しない」で永続非表示
- PWA 環境 (ホーム画面から起動) では非表示
- Android Chrome / PC では非表示

### 0.35 (ξ) ヘルプ ・ FAQ 充実 (用語集 ・ 同行者向け案内)

概要 : 既存のヘルプモーダルを拡張、同行者 ・ 初見ユーザーが「これ何?」と思う点を全部解消。

#### セクション構成

1. **このアプリは何?**
   - 「舞浜 (TDL ・ TDS) の天気予報を比較して、ショー ・ パレード中止リスクを判定するツール」
   - 1-2文で

2. **スコアの見方**
   - ベスト / OK / 微妙 / 別日 の意味 (色 + アイコン併記)
   - 算定根拠 (風 ・ 雨 ・ 熱 を昼パレード時刻 ±1h の平均値で評価)

3. **各バッジの説明**
   - 風 : 通常 / 風バ / 中止リスク高 / ほぼ中止 (閾値はショー別、過去風キャン記録に基づく)
   - 雨 : 通常 / 雨バ / 雨キャン濃厚 / ほぼ中止
   - 熱 (WBGT) : 通常 / 暑さ注意 / 熱バ / 熱キャン濃厚 / ほぼ中止

4. **用語集**
   - 風バ ・ 風キャン ・ 熱バ ・ 熱キャン ・ パイロカット ・ キャングリ ・ プレミアアクセス ・ エントリー受付

5. **データソース**
   - 気象庁 / Open-Meteo / 環境省 WBGT / TDR 公式 / TSUBASA のブログ + X
   - 各リンク + 出典明記

6. **取得頻度**
   - 天気 : リロードのたびに最新 (10分キャッシュ)
   - ショースケジュール : 月1 (Yuka さん手動更新)
   - 過去風キャン記録 : 月1追加 (Yuka さん手動)
   - WBGT : 環境省実値 (4-10月) ・ 期間外は簡易計算

7. **FAQ**
   - Q. 同行者と共有するには? → A. ヘッダー「URL コピー」 (既に削除済 ・ 案内変更要) → URL を直接コピー or QR
   - Q. なぜ今日「別日」表示? → A. 風 ・ 雨 ・ 熱のいずれかでショー中止リスクが高いから
   - Q. 公式公演時刻と違う日がある → A. 公式更新を月1で取得しているため、直近の変更は反映遅延
   - Q. 印刷したい → A. ブラウザの印刷機能で OK (印刷モードは廃止済)
   - Q. 通知が欲しい → A. (Phase 3 LINE 通知 が来たら案内)
   - Q. バグ ・ 要望 → A. GitHub Issues or Yuka さんに直接

8. **連絡先 ・ ソースコード**
   - GitHub repo リンク
   - Yuka さん連絡先 (or 任意)
   - 「個人ツールとして開発」明記 (公式 TDR とは無関係)

#### 該当ファイル

- `src/ui/help.js` の拡張 (新セクション追加)
- `src/data/help-content.js` 新規 (or インライン)
- `src/styles.css` ヘルプモーダルのレイアウト (タブ式 or アコーディオン)

#### 検証

- ヘッダー右の「ヘルプ」ボタンでモーダル開く
- 全 8セクション表示
- 同行者向けに「これ何?」が全部解消
- スマホでもスクロール可

### 0.36 UI 微調整 11点 (公開ページ確認後 ・ Yuka さん指摘)

公開ページ実機確認で見つかった改善点を 1 PR にまとめる。
(TOP3 sticky と連続赤サマリは見送り)

#### 1. 雨量の単位明示 + 集計幅整理

問題 : 雨セル「86% 113.6mm」 ・ 113.6mm が日合計か時間量か曖昧。判定 (「ほぼ中止」) は時間ピーク値で行うが、表示が日合計だと整合しない。

対応 :

- セル表記 : `pop% precip_max_mm/h` のみ (例「86% 6mm/h」)
- 日合計は **ホバー title** で「日合計 113.6mm」と補助表示
- 「ほぼ中止」判定は引き続き precip_max ベース
- precip_max が 0 (今後降る予定なし) の時は「86% 雨なし」or 「86%」のみ

該当ファイル :
- `src/ui/table.js` の雨セルレンダラ
- `src/data/openMeteo.js` 等の正規化で precip_max (precipitation_max_hourly) を確実に取得

#### 2-3. バッジラベル短縮

問題 : 「風バ可能性あり」「雨キャン濃厚」「熱キャン濃厚」「ほぼ中止」「中止リスク高」 ・ 長くてカード幅圧迫。

| 旧 | 新 |
|---|---|
| 風バ可能性あり | **風バ** |
| 中止リスク高 | **中止リスク** |
| ほぼ中止 | **中止** |
| 雨バ可能性 | **雨バ** |
| 雨キャン濃厚 | **雨キャン** |
| 暑さ注意 | **暑さ注意** (維持) |
| 熱バ可能性あり | **熱バ** |
| 熱キャン濃厚 | **熱キャン** |
| 通常 | **通常** (維持) |

該当 : `src/score/scoring.js` のバッジラベル定義 + テスト更新。

#### 4. 天気概況の日本語整形

問題 : 「くもり 夕方 から 晴れ」のような raw 文字列が出る (Open-Meteo / 気象庁 はスペース区切り)。

対応 : `src/utils/weatherText.js` 新規 ・ 正規化関数 :

```js
export function normalizeWeatherText(raw) {
  return raw
    .replace(/\s+/g, '')                    // 不要な空白削除
    .replace(/から/g, 'から')               // 接続詞前後の整形
    .replace(/時々/g, '時々')
    .replace(/(.+?)(夕方|朝晩|昼前|昼過ぎ|夜)/, '$1、$2')   // 句読点
    .replace(/^くもり/, '曇り');            // 表記統一
}
```

例 :
- `くもり 夕方 から 晴れ` → `曇り、夕方から晴れ`
- `晴れ 時々 曇り` → `晴れ時々曇り`
- `晴れ 朝晩 くもり` → `晴れ、朝晩曇り`

該当 : `src/ui/table.js` の気象庁/Open-Meteo セルレンダラで `normalizeWeatherText(forecast.weatherText)` を経由。

#### 5. 気象庁 / Open-Meteo セル高さ詰め

問題 : 天気アイコン 40px + 概況 + 気温 + 雨% でセル縦に長い ・ 1日の縦幅が増えて行数減る。

対応 :

- 天気アイコン : `40px → 32px`
- セル内 padding : `8px → 6px`
- 気温 ・ 雨% フォントサイズ : `13px → 12px`
- 概況テキスト : `13px → 12px`
- 雨 0% は表示しない (precip_sum 0 なら省略)

該当 : `src/styles.css` の `.weather-icon` `.cell-jma` `.cell-openmeteo` `.temp-row` `.pop`

#### 7. 極端値の信頼度ヒント

問題 : 6/3 のような風 23m/s 雨 113mm は気象的に台風レベル ・ 予報単独で出てると誤情報の可能性。

対応 : 極端値 (`gust_max ≧ 20 m/s` or `precip_max ≧ 30 mm/h`) の場合、セルに小さく `(要確認)` バッジ追加 ・ ホバーで「○○ の単独予報 ・ 他ソースを確認推奨」表示。

該当 : `src/score/extremeWarning.js` 新規 + `src/ui/table.js` セルに表示組込み。

#### 9. カード gap 拡大 (スマホ)

問題 : カード間 margin-bottom 8px がやや窮屈。

対応 : `src/styles.css` @media (max-width: 767px) の `.calendar-row { margin-bottom: 12px }` (8→12)。

#### 10. PC 詳細パネル chevron 視認性

問題 : PC で行末 chevron `›` が薄い (var(--text-mute)) ・ クリック可と分かりづらい。

対応 :

- chevron 色を `var(--primary)` (ブルー) に
- ホバー時に行背景がもう少し濃く + chevron が一回り大きく
- カーソル `pointer` 維持

該当 : `src/styles.css` のテーブル行 + chevron スタイル。

#### 11. 「おすすめ日のみ」位置 ・ 強調

問題 : フィルター行の右端 ・ 控えめ。

対応 :

- 位置 : 並び順 ・ 曜日 の **左** に移動 (最も使う絞り込み)
- ラベル前にアイコン (`star`) 追加
- 選択時 : 背景塗りつぶし強め (現在のアクティブピル と同等)

該当 : `src/ui/filters.js` の DOM 並び + `src/styles.css` のチェックボックススタイル。

#### 12. 更新ボタンの鮮度具体化

問題 : 「更新 ・ 今」だと「いつ更新したか」が曖昧。

対応 :

- 取得直後 (< 1分) : 「更新 ・ 今」(維持)
- 1分以上経過 : 「更新 ・ 2分前」「更新 ・ 12分前」
- 60分以上 : 「更新 ・ 14:23」(時刻)
- ホバー title で詳細「気象庁 2分前 ・ Open-Meteo 5分前 ・ WBGT 環境省」(既存維持)

該当 : `src/utils/freshness.js` (or 同等) の「経過時間 → 表示文字列」関数を拡張。

#### 13. 副題短縮 (スマホ)

問題 : スマホでヘッダー副題「舞浜の天気からショー・パレード中止リスクを予測」が長い (21文字) ・ 折り返しの恐れ。

対応 : メディアクエリで切替 :

- PC (≧ 768px) : 「舞浜の天気からショー・パレード中止リスクを予測」(維持)
- スマホ (< 768px) : **「舞浜のショー・パレード中止予測」** (15文字)

該当 : `src/ui/header.js` で `window.matchMedia('(max-width: 767px)')` 判定して切替 + `src/styles.css` で `.subtitle-mobile` / `.subtitle-pc` を媒体別表示。

#### 検証

- 公開ページで各項目反映確認
- スマホ 375px DevTools エミュ + 実機両方
- バッジ短縮で全行が画面内に収まる
- 天気概況「曇り、夕方から晴れ」のように自然な日本語
- 極端値日 (6/3 等) に「(要確認)」表示
- 更新ボタンが「2分前」「14:23」と変動
- npm test 緑、build 通る

### 0.37 UI 改善 6項目 (細かい仕上げ ・ Yuka さん指摘)

#### 0.37.1 バッジラベル長短を PC / スマホで切替

問題 : §0.36 でバッジ全部短縮したが、PC では幅余裕あって長文の方が情報量多い。スマホは短縮維持。

対応 :

| バッジ | PC (長) | スマホ (短) |
|---|---|---|
| 風 | 風バ可能性あり / 中止リスク高 / ほぼ中止 | 風バ / 中止リスク / 中止 |
| 雨 | 雨バ可能性 / 雨キャン濃厚 / ほぼ中止 | 雨バ / 雨キャン / 中止 |
| 熱 | 熱バ可能性あり / 熱キャン濃厚 / ほぼ中止 | 熱バ / 熱キャン / 中止 |
| 通常 / 暑さ注意 (削除予定) | (維持) | (維持) |

実装案 : CSS `@media (max-width: 767px)` で `.badge .label-long` を非表示 ・ `.label-short` を表示、media クエリ反転で逆。

DOM :

```html
<span class="badge badge-warn">
  <span class="label-long">風バ可能性あり</span>
  <span class="label-short">風バ</span>
</span>
```

または JS で `matchMedia` 判定して 動的に切替。

該当 : `src/score/scoring.js` のラベル定数 (long + short の両方持つ) + `src/ui/table.js` + `src/styles.css`

#### 0.37.2 熱バッジ階層を風・雨と統一 (5階層 → 4階層)

問題 : 現状の熱バッジ階層 (通常 / 暑さ注意 / 熱バ / 熱キャン / 中止) は 5階層で、風 (通常/風バ/中止リスク/中止) と雨 (通常/雨バ/雨キャン/中止) の 4階層と不揃い。「暑さ注意」だけ風・雨に該当する用語がない。

対応 : 「暑さ注意」を「熱バ」に統合 ・ 4階層に統一。

| WBGT | 旧階層 (5) | 新階層 (4) |
|---|---|---|
| < 25 | 通常 | 通常 |
| 25 - 28 | 暑さ注意 | **熱バ** (merge) |
| 28 - 31 | 熱バ | **熱バ** (merge) |
| 31 - 33 | 熱キャン | 熱キャン (維持) |
| ≥ 33 | 中止 | 中止 (維持) |

階層 :

- 風 : 通常 / 風バ / 中止リスク / 中止
- 雨 : 通常 / 雨バ / 雨キャン / 中止
- 熱 : 通常 / **熱バ** / 熱キャン / 中止
- (4階層で揃う)

スコア減点ロジック (`src/score/scoring.js`) も新階層に合わせて変更 (現状の 5階層減点を 4階層に再マッピング)。

#### 0.37.3 ショー ・ パレード欄の見直し

問題 : 詳細パネル内「ショー ・ パレード」の表示が見づらい。

対応 (推奨実装) :

- 各ショーを **カード形式** に (現状フラットリスト) :
  ```
  ┌─────────────────────────────────────────┐
  │ [icon] ハーモニー・イン・カラー  13:00    │  ← 大きめ・太字
  │ [tags] プレミアアクセス                   │
  │ [prob] 過去 26件中 1件中止 (4%)           │
  └─────────────────────────────────────────┘
  ```
- 各ショー間に余白 (`margin-bottom: 12px`)
- priority high はカード背景を薄く色付け (accent-2 系)
- 時刻は `font-variant-numeric: tabular-nums` で揃える
- TDL/TDS タブ切替時のフェード ・ または横スライドアニメ
- 折り畳み可 ・ デフォルト展開

該当 : `src/ui/table.js` (or `detailPanel.js`) のショー一覧レンダラ + `src/styles.css` `.show-item` `.show-card`

#### 0.37.4 PC でスコア列を別列に戻す

問題 : §0.23 で日付+スコア列統合したが、PC ではスコア列を独立させた方が視認性良い (Yuka さん指摘)。

対応 :

- スマホ : カード形式 ・ 統合維持 (§0.27)
- PC : 7列に戻す
  - 日付 / **スコア** / 風 / 雨 / 熱 / 気象庁 / Open-Meteo

CSS media query で切替 :

```css
/* PC : スコア列復活 */
@media (min-width: 768px) {
  table thead .cell-score-header { display: table-cell; }
  table tbody td.cell-score { display: table-cell; }
  table tbody td.cell-date-score { display: none; }   /* 統合セルは隠す */
  table tbody td.cell-date { display: table-cell; }
}

/* スマホ : 統合維持 */
@media (max-width: 767px) {
  table thead .cell-score-header { display: none; }
  table tbody td.cell-score { display: none; }
  table tbody td.cell-date-score { display: block; }  /* 統合セル grid-area: date-score */
}
```

該当 : `src/ui/table.js` で td を `cell-date` `cell-score` `cell-date-score` の3つ用意 (PC は date+score、スマホは統合) + CSS で切替。

#### 0.37.5 スマホ詳細パネル内の見出しと中身の色統一

問題 : スマホで詳細パネル開いた時、セクション見出しと中身の色が違って統一感ない。

対応 : セクション全体を同じトーンに :

```css
@media (max-width: 767px) {
  .detail-panel section,
  .detail-panel .panel-section {
    background: var(--surface-2);   /* 統一背景 */
    color: var(--text);              /* 統一テキスト */
    padding: 12px;
    border-radius: var(--radius-sm);
    margin-bottom: 8px;
  }
  .detail-panel section h3,
  .detail-panel .panel-heading {
    color: var(--text);              /* 見出しも本文と同色 */
    background: transparent;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }
}
```

(必要に応じてアクセントカラーは罫線 ・ アイコンだけに留める)

該当 : `src/styles.css` のスマホ向け詳細パネルスタイル。

#### 0.37.6 スマホで二重シャドウ解消

問題 : スマホ実機で「白背景 + シャドウ」の上にカードのシャドウが乗っていて二重デザインになってる。

原因仮説 :

- テーブルコンテナ (`.calendar-container` or `.disney-table` ラッパー) に `background: var(--surface)` + `box-shadow` が付いている
- 個々のカード (`.calendar-row`) にも `background` + `box-shadow` (§0.27)
- 両方 重なって二重に見える

対応 (どちらか) :

A. **テーブルコンテナのシャドウ ・ 背景を削除** (推奨)

```css
@media (max-width: 767px) {
  .calendar-container,
  .disney-table {
    background: transparent;
    box-shadow: none;
    border: none;
  }
}
```

B. カード側のシャドウを削除 (コンテナ側を残す)

A の方がカードが浮き出て見えるので推奨。

該当 : `src/styles.css` のテーブルコンテナ ・ ラッパー (スマホ media クエリ内)。

#### 検証

- PC : スコア列が独立復活 ・ バッジが長文 ・ ショー一覧がカード形式
- スマホ : バッジ短縮維持 ・ 詳細パネルの色統一 ・ 二重シャドウ解消 ・ ショー一覧カード
- 熱バッジ 4階層で動作 ・ 「暑さ注意」が「熱バ」になっている
- npm test 緑 (スコアロジック変更でテスト調整必要)
- ESLint 0

#### 0.37.7 スマホ雨セルの幅 + アイコン位置調整

問題 : スマホ (iPhone 16 Pro 横幅) で雨量 100mm 超えると 2行に折り返し ・ 崩れる。
かつアイコンと降水確率% が縦並びで読みにくい。

対応 :

1. **アイコン + 降水確率% を横並び** (現状縦並びを修正) :
   ```
   旧 :              新 :
   [umbrella]        [umbrella] 6%
   6%                通常
   通常              (雨量があれば「14mm/h」 or 補助行)
   ```

2. **雨セル の grid 幅を広げる** : 風・熱より 1.5倍程度
   現状 (§0.27) : `"wind wind rain rain heat heat"` (各 2/6 = 等分)
   新案 : `"wind rain rain rain heat heat"` (風 1/6 / 雨 3/6 / 熱 2/6)
   または別案 : 「降水量に値あり」のときだけ雨セル幅拡張 (responsive)

3. **雨量 mm/h 表記** : 100mm/h 超は四捨五入 or 小数点削除で 1行に収まる文字数に
   例 : `113mm/h` (現状 `113.6mm/h`) → 「mm/h」を「mm」に省略可

該当 :
- `src/styles.css` のスマホ grid-template-areas + cell-rain スタイル
- `src/ui/table.js` の雨セルレンダラ (アイコン horizontal flex に)

#### 0.37.8 スマホヘッダー再構成

問題 : 現状ヘッダーは「更新ボタン (テキスト付き) + ヘルプ (テキスト付き)」で 場所食う ・ 更新ボタンが何の更新か直感的じゃない。

対応 :

**スマホ (< 768px) ヘッダー** :

```
┌────────────────────────────────┐
│ マイハマびより             [?] │  ← 右上にヘルプ (アイコンのみ)
│ 舞浜のショー・パレード中止予測  │
└────────────────────────────────┘

[フィルター行]

[ 🔄 天気データを更新 ・ 8分前 ]  ← フィルター下に明示的なボタン
```

- 右上 : ヘルプ (`help` Material icon のみ、テキストなし)
- 更新ボタン : フィルター行の下 ・ アクセント色 ・ 「天気データを更新」と明示
- 更新ボタンは sticky でも OK (フィルター動作時にも見えるよう)

**PC (≧ 768px) ヘッダー** :

- 現状維持 (右側に「更新 ・ 8分前」「ヘルプ」テキスト付き)

該当 :
- `src/ui/header.js` でヘッダー要素再構成 + media query で表示切替
- `src/styles.css` でスマホ用 `.refresh-button-mobile` `.help-icon-only`

#### 0.37.9 曜日フィルター文言短縮 (スマホ)

問題 : スマホで「すべて」「平日のみ」「土日祝のみ」が長い ・ 文字数削減で「のみ」削除。

対応 :

| PC | スマホ |
|---|---|
| すべて | すべて |
| 平日のみ | **平日** |
| 土日祝のみ | **土日祝** |

実装 : ボタン内に label-long / label-short を持つ (§0.37.1 と同じパターン) or JS で matchMedia 判定。

該当 :
- `src/ui/filters.js` のフィルターボタンラベル
- `src/styles.css` で `.label-long` / `.label-short` 切替

#### 0.37.10 スコア理由の解説 ・ 各日の「なぜ?」表示

問題 : スコア「微妙 60」「別日 0」だけだと「なぜそうなのか」が分からない。同行者にも説明しづらい。

対応 : スコアラベル直下に 1行で **支配的な減点要因** を解説。

例 :

```
微妙 60   → 「昼の風 9m/s で風バ可能性」
別日 25  → 「14m/s でハーモニー風キャン濃厚」
ベスト 92 → 「風弱め晴れ ・ 全ショー安全」
別日 0   → 「強風 14m/s + 暑さ 28℃ で多重リスク」
```

#### ロジック実装

`src/score/scoreReason.js` 新規 :

```js
export function getScoreReason(forecast, badges, dayDate) {
  const reasons = [];

  // 最も severity 高いバッジ順に要因 pickup
  const severityOrder = { critical: 4, danger: 3, warn: 2, normal: 1 };

  const sortedBadges = ['wind', 'rain', 'heat']
    .map(k => ({ k, b: badges[k] }))
    .sort((a, b) => severityOrder[b.b.severity] - severityOrder[a.b.severity]);

  for (const { k, b } of sortedBadges) {
    if (b.severity === 'normal') continue;
    if (k === 'wind') reasons.push(`風 ${forecast.gust_show_window}m/s ${b.label}`);
    if (k === 'rain') reasons.push(`雨 ${forecast.pop_show_window}% ${b.label}`);
    if (k === 'heat') reasons.push(`WBGT ${forecast.wbgt_show_window} ${b.label}`);
  }

  if (reasons.length === 0) return '風 ・ 雨 ・ 熱 全部OK';

  // 上位 2要因まで、それ以上は「他」
  if (reasons.length > 2) return reasons.slice(0, 2).join(' / ') + ' / 他';
  return reasons.join(' / ');
}
```

#### 表示位置

- スコアラベル直下 (例「微妙 60」の下に 11-12px のサブテキスト)
- PC : 「微妙 60 ・ 風 9m/s 風バ可能性」横並び
- スマホ : 縦並び (「微妙 60」のすぐ下に解説)
- 色 : `var(--text-sub)` (控えめ)

#### DOM 例

```html
<div class="score-cell">
  <span class="score-pill score-fair">
    <span class="material-symbols-rounded">warning</span>
    <span class="label">微妙</span>
    <span class="value">60</span>
  </span>
  <span class="score-reason">風 9m/s 風バ可能性</span>
</div>
```

#### CSS

```css
.score-reason {
  display: block;
  font-size: 11px;
  color: var(--text-sub);
  margin-top: 4px;
  line-height: 1.3;
}
@media (min-width: 768px) {
  .score-cell { display: flex; align-items: baseline; gap: 8px; }
  .score-reason { margin-top: 0; }
}
```

該当 :
- `src/score/scoreReason.js` 新規
- `src/ui/table.js` のスコアセルに reason 表示
- `src/styles.css` に `.score-reason` スタイル

#### 検証

- スマホ実機 (iPhone 16 Pro 等) で 雨量 100mm 超の日も1行に収まる
- アイコン + 降水確率% が横並び
- ヘッダー : 右上ヘルプアイコンのみ ・ 更新ボタンはフィルター下に「天気データを更新」と明示
- 曜日 : スマホ「すべて / 平日 / 土日祝」 ・ PC「すべて / 平日のみ / 土日祝のみ」
- 各日のスコア下に「風 9m/s 風バ」のような理由表示
- 「全部OK」の日も「風 ・ 雨 ・ 熱 全部OK」と肯定的に表示
- npm test 緑 (scoreReason のユニットテスト追加推奨)
- ESLint 0

#### 0.37.11 時系列グラフの色 ・ アイコン改善

問題 : Chart.js 詳細パネルのグラフが、雨と風の系列色が同系 (青系) で区別しづらい ・ 凡例にアイコンなしで「これは雨? 風?」が一目で分かりにくい。

対応 :

1. **系列ごとに色を明確に分離** :
   - **降水確率** : 青 (`#4A90D2` ディズニーブルー)
   - **風速 (gust)** : ティール / グリーン (`#3A8AB8` 青緑) or グレー
   - **気温 (max/min)** : 赤系 / 青系 (上下分け)
   - **WBGT** : オレンジ (`#E48732`)

2. **凡例にアイコン併用** :
   ```
   [umbrella] 降水確率 (%)
   [air]      風速 (m/s)
   [thermostat] 気温 (℃)
   [device_thermostat]  WBGT
   ```
   Chart.js の凡例コールバックで `<i class="material-symbols-rounded">umbrella</i> 降水確率` のような HTML 注入。

3. **線種を区別** : 主要 (降水確率 ・ 風速) は実線 ・ 補助 (気温 ・ WBGT) は破線 で視覚層別。

4. **背景帯** (既存): 風速 10m/s ライン上を薄い赤で「中止域」表示 ・ 維持。

該当ファイル :

- `src/ui/chart.js` (or 該当ファイル) の Chart.js 設定 :
  - `datasets[i].borderColor` を個別指定
  - `datasets[i].borderDash` で線種区別
  - `plugins.legend.labels.generateLabels` でアイコン併用

#### 0.37.12 TOP3 「14日のうちベスト3」上マージン拡大

問題 : ページ下部の「14日のうちベスト3」セクションの上余白が狭く、テーブルとの区切り感がない ・ 見落としやすい。

対応 :

```css
.top3-section {
  margin-top: 48px;           /* 旧 16-24px → 48px */
  padding-top: 24px;
  border-top: 2px solid var(--border);
}
.top3-section h2 {
  font-family: var(--font-heading);
  font-size: var(--fs-xl);
  margin-bottom: 16px;
  color: var(--primary);
}
```

加えて :
- セクション全体に薄い背景 (`background: var(--surface-2); padding: 24px; border-radius: var(--radius);`)
- TOP3 カードを横並び (PC) / 縦並び (スマホ) で配置 ・ 既存維持

該当 : `src/styles.css` の `.top3-section` (or 該当クラス) + `src/ui/top3.js` のラッパースタイル

#### 検証 (§0.37 全 12項目)

- PC : スコア列復活 (#4)・バッジ長文 (#1)・ショー一覧カード (#3)・グラフ色分離 + アイコン (#11)・TOP3 余白 (#12)
- スマホ : バッジ短縮 (#1)・詳細パネル色統一 (#5)・二重シャドウ解消 (#6)・雨セル幅 (#7)・ヘッダー再構成 (#8)・曜日短縮 (#9)・スコア理由 (#10)
- 熱バッジ 4階層 (#2)・「暑さ注意」消滅
- npm test 緑 (スコア・熱中症減点・scoreReason 等のテスト更新)
- ESLint 0

---

### 0.38 持ち物拡充 + UI 改善 第2弾 (Yuka 指摘)

公開ページの追加指摘。持ち物 ・ 服装サジェスト拡充 (元 §0.37.13) と、ヘルプ被り ・ 表記統一 ・ 時刻明記 ・ 降水確率欠損 ・ 雨セル単位 ・ 見出しアイコン。

#### 0.38.1 持ち物 ・ 服装サジェスト拡充

問題 : Yuka さん指摘 「雨予報なのに持ち物に傘がない」 ・ 現状ロジックが薄く、ユーザーが実際持っていくべきアイテムが網羅されてない。

対応 : 条件別アイテムテーブルを大幅拡充。

#### 拡充マッピング (src/ui/outfit.js or src/score/outfit.js)

**雨対策 (pop / precip_max ベース)** :

| 条件 | アイテム |
|---|---|
| pop < 30% & precip 0 | (雨対策なし) |
| 30 ≦ pop < 50% or precip_max < 1mm/h | **折りたたみ傘** |
| 50 ≦ pop < 70% or 1 ≦ precip_max < 3mm/h | **折りたたみ傘 + ポンチョ** (パレード時傘 NG) |
| pop ≥ 70% or 3 ≦ precip_max < 10mm/h | **ポンチョ必須 + 折りたたみ傘** |
| precip_max ≥ 10mm/h | **ポンチョ必須 + タオル + 着替え** (傘は風で飛ぶ) |

**気温対策 (temp_max ベース)** :

| 気温帯 | アイテム |
|---|---|
| ≥ 35℃ | **ハンディファン + ネッククーラー + 保冷剤 + 塩飴 + 凍らせたペットボトル + 日傘** |
| 32 - 34℃ | **ハンディファン + ネッククーラー + 凍らせたペットボトル + 日傘** |
| 28 - 31℃ | **日傘 + 汗拭きタオル + 多めの水分** |
| 22 - 27℃ | (特に対策なし、薄手で OK) |
| 15 - 21℃ | **薄手の上着 (朝晩用)** |
| 10 - 14℃ | **薄手のジャケット + カーディガン** |
| 5 - 9℃ | **コート + マフラー** |
| < 5℃ | **ヒートテック + ダウン + 手袋 + マフラー + カイロ** |

**WBGT 対策 (現状熱バ ・ 熱キャン以上)** :

| WBGT | 追加アイテム |
|---|---|
| ≥ 31 (熱キャン濃厚) | **塩飴 + 着替え (帰り涼しい服)** |
| 28 - 30 (熱バ) | **塩飴 + 多めの水分** |

**UV 対策 (uv_max ベース)** :

| UV | アイテム |
|---|---|
| ≥ 8 | **日焼け止め SPF50 + 帽子 + サングラス** |
| 5 - 7 | **日焼け止め SPF30 + 帽子** |
| < 5 | (なし) |

**風対策 (gust_max ベース)** :

| 風 | アイテム |
|---|---|
| ≥ 10 m/s | **髪留め + 帽子の紐 (飛ばされ防止)** |
| 5 - 9 m/s | **髪留め** |

**昼夜温度差** (既存維持) :

| 差 | アイテム |
|---|---|
| ≥ 12℃ | **羽織りもの + ストール** |
| 8 - 11℃ | **羽織りもの** |

**ショー ・ パレード対策** (priority high ショーが scheduled かつ風 ・ 雨 ・ 熱が中止リスク低 = スコア OK 以上) :

| 条件 | アイテム |
|---|---|
| 季節限定昼パレード or ショー (ハーモニー ・ ハピネス ・ ジュビレ等) ある日でスコア OK 以上 | **レジャーシート + クッション** (鑑賞場所取り) |
| 上記 + 1時間以上前から待つ予定 | **携帯椅子 (折りたたみ)** (公式 OK 範囲のもの) |

注 : 公式の場所取りルール (時間 ・ サイズ等) に従う。携帯椅子はエリアによって NG な場合あり。

**天気別 (天気概況ベース)** :

| 天気 | アイテム |
|---|---|
| 晴れ (sunny ・ clear) | **帽子** (UV 数値に関わらず ・ 夏場は熱中症対策、冬場は防寒も) |
| 曇り (cloudy) | (特に追加なし、UV/熱対策に従う) |
| 雨 (rain) | 雨対策セクション参照 |
| 雪 (snow) | **滑り止め靴 + 防水 + 手袋** |

**全日共通 (常時表示 or 注意書き)** :

- **歩きやすい靴** (パンプス NG ・ スニーカー推奨)
- **モバイルバッテリー** (アプリ常時起動 + 写真 + 待ち時間)

#### アイコン併用 (Material Symbols)

| アイテム | アイコン |
|---|---|
| 折りたたみ傘 | `umbrella` |
| ポンチョ | `dry_cleaning` or `coat` |
| 日傘 | `beach_access` |
| 日焼け止め | `sunny` |
| 帽子 | (絵文字禁止なので) `face` or テキストのみ |
| ハンディファン | `air` |
| ネッククーラー | `ac_unit` |
| 保冷剤 | `ac_unit` |
| 凍らせたペットボトル | `local_drink` |
| 塩飴 | `cookie` (代替) |
| カイロ | `local_fire_department` |
| 上着 ・ ダウン | `checkroom` |
| マフラー | `dry_cleaning` |
| 髪留め | `face` |
| スニーカー | `directions_run` |
| モバイルバッテリー | `battery_charging_full` |
| 帽子 | `sports` (キャップ風) or `sun_cap` (なければ `face`) |
| レジャーシート | `event_seat` or `weekend` |
| クッション ・ 携帯椅子 | `chair` |

#### 表示

- 詳細パネル内「持ち物 ・ 服装サジェスト」セクション
- 条件該当アイテムを列挙 (重複削除)
- 上限 8アイテムまで、それ以上は「他」表記
- 各アイテムにアイコン + テキスト
- 雨対策 ・ 暑さ対策 ・ 寒さ対策 ・ UV ・ 風 ・ 共通 のグルーピング (見出し付き)

#### 該当ファイル

- `src/score/outfit.js` (or 既存) のロジック拡充
- `src/ui/table.js` (or detailPanel.js) の服装サジェスト表示部
- `src/styles.css` で `.outfit-item` `.outfit-group` のスタイル

#### 0.38.2 ヘルプモーダルが画面に被る (sticky 見出しと重なる)

問題 : ヘルプモーダルを開くと、テーブルの sticky ヘッダー (風 / 雨 / 熱 / 気象庁 / Open-Meteo) がモーダルの上に出てしまう。z-index 不整合。

対応 :

```css
.help-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 9000;          /* sticky thead (z-index: 10 程度) より高く */
  display: flex;
  align-items: center;
  justify-content: center;
}
.help-modal {
  z-index: 9001;
  position: relative;
  max-width: 720px;
  max-height: 85vh;
  overflow-y: auto;
}
```

加えて、モーダル open 中は body にスクロールロック (`document.body.style.overflow = 'hidden'`)、close で復元。

該当 : `src/styles.css` の `.help-modal*` z-index + `src/ui/help.js` の open/close 関数

#### 0.38.3 「ディズニープレミアアクセス (DPA)」表記統一

問題 : 「ディズニープレミアアクセス」表記が長すぎて表幅を圧迫。基本は「DPA」短縮形が読みやすい。

対応 :

| 表示場所 | 表記 |
|---|---|
| ヘルプ ・ 用語集 | **ディズニープレミアアクセス (DPA)** (初出のみ full、以降 DPA) |
| バッジ ・ カード ・ 詳細パネル | **DPA** |
| FAQ | full → 以降 DPA |
| ショー名横バッジ ・ 説明文 | **DPA** |

実装 :
- 用語集に「DPA = ディズニープレミアアクセス」エントリ追加 (ヘルプから参照可)
- 既存「ディズニープレミアアクセス」文字列を全部 grep して、ヘルプ ・ 用語集以外は `DPA` に置換

該当 : 全 src/* を grep & 置換 + 用語集追記 (`src/ui/help.js` glossary タブ)

#### 0.38.4 時間帯スコアの時刻明記

問題 : 「時間帯スコア (朝 ・ 昼 ・ 夜)」が何時を指すか分からない。重み (朝 0.5 / 昼 2.0 / 夜 0.3) は内部値だが、ユーザーには時刻範囲が必要。

対応 :

詳細パネル内の時間帯スコア表示を :

```
時間帯スコア
朝 (7:00 - 11:00)   75  OK
昼 (11:00 - 17:00)  90  ベスト ← 太字
夜 (17:00 - 21:00)  60  微妙
```

- 各時間帯ラベルに時刻範囲を併記 (例 「朝 (7-11)」)
- スコアが最も重視される昼を太字 + 「最重視」マークで強調 (重み 2.0 反映)
- ヘルプ「スコアの見方」タブにも時間帯定義を追記

該当 : `src/ui/detailPanel.js` (or 該当) の時間帯スコア表示部 + `src/score/scoring.js` で時刻定数を named export

#### 0.38.5 気象庁データに降水確率がない日のフォールバック

問題 : 気象庁データに pop (降水確率) が欠損する日がある (画像 6/3 等)。これは気象庁 API の仕様 (3日先以降は時間別なし、地域別週間予報のみ)。現状「-」表示で空白に見える。

対応 :

優先順位 :
1. 気象庁 「府県天気予報 + 週間天気予報」 を組み合わせる :
   - 今日 + 明日 : 府県天気予報 (時間別 pop)
   - 明後日以降 : 週間予報 (1日 pop)
2. それでも欠損する場合は Open-Meteo 値で補完 (出典「気象庁 (補完 : Open-Meteo)」と注記)
3. 完全欠損なら「データなし」と明示 (空白でなく)

該当 :
- `src/api/jma.js` の取得関数を週間予報も組み合わせ
- `src/ui/table.js` で欠損時のフォールバック表示 (「補」マーク or 「データなし」)
- ヘルプ FAQ に「気象庁の降水確率が出ない日がある理由」を追加

#### 0.38.6 雨セルの単位文字サイズ縮小

問題 : 雨セル「86% 113.6mm」の数字 + 単位が同じサイズで読みづらい。風セルでは既に単位 (m/s) を小さく表示してるので統一。

対応 :

```html
<td class="cell-rain">
  <span class="num">86</span><span class="unit">%</span>
  <span class="num">113.6</span><span class="unit">mm</span>
  <span class="badge">雨キャン濃厚</span>
</td>
```

```css
.cell-rain .num { font-size: var(--fs-md); font-weight: 600; }
.cell-rain .unit { font-size: var(--fs-xs); color: var(--text-sub); margin-left: 2px; margin-right: 8px; }
```

風 ・ 熱セルも同じ命名規則に揃える (`.num` / `.unit`)。

該当 : `src/ui/table.js` の cell 生成 + `src/styles.css`

#### 0.38.7 気象庁 / Open-Meteo 見出しにアイコン追加

問題 : テーブル見出し行「風 / 雨 / 熱 (WBGT)」にはアイコンがあるのに、「気象庁」「Open-Meteo」列だけアイコンがなくバランスが悪い。

対応 :

| 見出し | アイコン | 意味 |
|---|---|---|
| 気象庁 | `cloud` | 雲 (一般的な天気) |
| Open-Meteo | `partly_cloudy_day` or `cloud_queue` | 雲 (補助 ・ 別ソース) |

両者とも「天気予報」を示すので、別アイコンで「ソース違い」を視覚化。代替 :
- 気象庁 : `language_japanese_kana` (日本) or `flag_circle` (公式国)
- Open-Meteo : `public` (国際 OSS)

選択 : Yuka さんに 1案 (cloud / partly_cloudy_day) で見てもらい、違和感あれば変更。

該当 : `src/ui/table.js` の `<thead>` 部

#### 0.38.8 「熱 (WBGT)」列名は維持 ・ info アイコンと「暑さ指数」説明を追加

問題 : 「熱 (WBGT)」の WBGT が分からない ・ 値「27」が気温なのか不明。ただし列名「熱 (WBGT)」自体は熱キャン指数なので **そのまま維持**。

対応 : **列名は変更せず、info アイコンによる補足説明とヘルプ用語集の追記** で対応。

| 表示場所 | 旧 | 新 |
|---|---|---|
| 列見出し | 熱 (WBGT) | **熱 (WBGT) ［?］** (列名は維持 ・ Material `info` アイコンを追加) |
| セル | 27 | **27** (単位なし維持、ただし `info` 経由で意味分かる) |
| バッジ | 通常 ・ 熱バ | 維持 |
| 詳細パネル | WBGT 27 | **熱 (WBGT) 27** (維持) |
| ヘルプ用語集 | (新規) | **熱 (WBGT ・ 暑さ指数)** — 気温 + 湿度 + 日射から算出する体感的な暑さ指標 (単位なし、≥ 28 で警戒、≥ 31 で危険) |
| ヘルプ FAQ | (新規) | **「熱の数値って何?」** → 「WBGT (湿球黒球温度) ・ 通称『暑さ指数』のことで、熱中症リスクを表します。気温そのものではなく、湿度 ・ 日射を加味した体感温度に近い指標です。」 |

`info` アイコンをタップ / hover で小さなツールチップ :
> 暑さ指数 (WBGT)。気温 + 湿度 + 日射から算出する熱中症リスク指標。28+ で警戒、31+ で危険。

該当 : `src/ui/table.js` の `<thead>` (info アイコン追加のみ) + `src/ui/help.js` 用語集 ・ FAQ + 新規 tooltip 機構

#### 0.38.9 「雨キャン / 風キャン / 熱キャン」と「キャンセル」「中止」用語整理

問題 : 「アメキャン」「風キャン」「熱キャン」「キャンセル」「中止」が混在し違いが不明瞭。

対応 :

定義 :

| 用語 | 意味 |
|---|---|
| **雨キャン** | 雨を理由にキャンセル (公式表記「雨天により中止」) |
| **風キャン** | 強風を理由にキャンセル (公式表記「強風により中止」) |
| **熱キャン** | 熱中症リスクを理由にキャンセル (公式表記「熱中症対策のため中止」) |
| **中止** | 上記いずれかでショーが行われない総称 |
| **キャンセル** | (廃止) ・ 「中止」に統一 |

UI 統一 :
- バッジ : 「雨キャン濃厚」「風キャン濃厚」「熱キャン濃厚」 → 短縮 ・ 揃える
- スコア理由 : 「雨で中止リスク高」 (一般語) / 詳細ヘルプで「= 雨キャン」と紐付け
- ヘルプ用語集に上記表を明記
- 「アメキャン」表記揺れがあれば「雨キャン」に統一 (grep)

該当 : 用語集 (`src/ui/help.js`) + 表記揺れ grep & 置換 + バッジラベル定数 (`src/score/scoring.js`)

#### 0.38.10 「(要確認)」の説明をクリックで表示

問題 : スコア横「(要確認)」が何の確認なのか不明。

対応 :

「(要確認)」をクリック可能にし、ツールチップ or 小モーダルで理由を表示 :

```
要確認の理由
- 過去同条件の中止記録が少ない (3件未満)
- 当日 ・ 翌日の予報は精度が高いが、6日以降は誤差大
- 公式運営状況 (Phase 3 第3弾) との不一致がある
- 当日朝の発表で覆る可能性

詳細はヘルプ「(要確認) って何?」を参照
```

UI :
- (要確認) を `<button>` 化 ・ tabindex + aria-describedby
- クリックで popover (簡易ツールチップ実装) を表示
- ヘルプ FAQ にも「(要確認) の意味」エントリ追加

該当 : `src/ui/table.js` (cell 内 ・ 詳細パネル内の (要確認) 表記) + ヘルプ FAQ

#### 0.38.11 中止確率表記を 「［過去中止 43% (3/7件)］」 形式に短縮

問題 : 「予報 12m/s → 過去 7件中 3件中止 (43%)」 は冗長。

対応 :

```
旧 : 予報 12m/s → 過去 7件中 3件中止 (43%)
新 : 予報 12m/s ［過去中止 43% (3/7件)］
```

- 「→」を ［ ］ にして視覚的にコンパクトに
- 「43%」を先頭 (重要情報先出し)、件数を補足カッコに
- 件数 3件未満は「(要確認)」マーク併用 (§0.38.10 と連動)
- スマホは 1行に収まるよう Font-size 微調整

該当 : `src/score/cancelProbability.js` (or 該当) の表示文字列生成部 + `src/ui/table.js` の表示部

#### 0.38.12 時系列グラフのショー時刻ラベル重なり解消

問題 : 時系列グラフ上に並ぶショー時刻ラベル (10:55, 12:20, 13:00, 13:45, 14:00, 15:15, 15:50, 16:25, 17:35, 18:20, 19:30, 20:20, 20:50) が水平方向に密集 ・ 文字が重なって読めない。

原因 : Chart.js の annotation plugin で全ショー時刻を縦線 + 上端ラベルで表示しているが、ラベルの水平方向重なり制御なし。

対応 :

#### 案A : マーカー + 下部チップ (推奨)

グラフ上は **三角マーカー (▼) のみ** にして、グラフ下に「ショー時刻一覧」chips を別表示 :

```
グラフ
   ▼     ▼ ▼  ▼     ▼   ▼ ▼  ▼   ▼   ▼   ▼  ▼   (マーカーのみ)
─────────────────────────────────────────
9 10 11 12 13 14 15 16 17 18 19 20 21 22 時

下に chips :
[10:55 ハピネスインザスカイ] [12:20 パレード] [13:00 ハーモニー] ...
```

- マーカー hover / tap で当該 chip 強調
- chips は priority high (季節限定) を太字 + アクセント色
- グラフ自体は降水確率 ・ 風速の線だけクリーンに

#### 案B : ラベル縦書き + 重なり間引き (補助)

案A を採らない場合 :
- ラベルを -45度 or -90度 (縦書き) に回転
- Chart.js の `clip: false` + `rotation: -45`
- 水平距離 < 30px の隣接ラベルは間引き (代表1つを「他N件」表記)

#### 案C : 重要ショーのみ強調 (補助)

priority high (季節限定昼パレード等) のみ ラベル表示 ・ 他は ▼ マーカーのみ。詳細は chips で。

#### 推奨

**案A (マーカー + chips) で実装**。Chart.js annotation を ▼ マーカーに変更 + グラフ直下に flex chips。

該当 :
- `src/ui/chart.js` (or 該当) の annotation 設定
- `src/ui/detailPanel.js` でグラフ下 chips コンポーネント追加
- `src/styles.css` の `.show-time-chips` スタイル

仕様 :
- chip 形式 : `<span class="chip">10:55 ハピネスインザスカイ</span>`
- priority high : `chip-highlight` で太字 + var(--primary) 背景
- 折り返し (flex-wrap)
- chip hover / tap → グラフ上対応マーカーを強調 (色変更)

#### 0.38.13 PWA バナー (ホーム画面追加) を画面追随でなくページ下部固定に

問題 : §0.34 で追加した iOS PWA インストール促進バナー (「アプリのように使えます」) が画面追随 (position: fixed) でスクロール中ずっと画面下に表示され、コンテンツを覆って邪魔。

対応 :

- `position: fixed` を撤廃
- ページ下部 (TOP3 セクションのさらに下、フッターの直前) に通常の要素として配置
- スクロールで到達したときだけ目に入る
- 「もう表示しない」/ 「✕」ボタンは維持 (永続 dismiss + 1週間 dismiss)
- iOS Safari 判定 + 訪問2回以上の条件は維持

CSS :

```css
.pwa-install-banner {
  /* position: fixed; を削除 */
  position: static;
  margin: 32px auto 24px;
  max-width: 720px;
  padding: 16px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
}
```

DOM 配置 :

```html
<main>
  ... テーブル ...
  ... TOP3 セクション ...
  <div class="pwa-install-banner">...</div>  <!-- ここに移動 -->
  <footer>...</footer>
</main>
```

該当 : `src/ui/pwaBanner.js` (or 該当) の配置先 + `src/styles.css` の `.pwa-install-banner`

#### 0.38.14 スマホカードの気象庁 ・ Open-Meteo の上の区切り線 2本を削除

問題 : スマホカード内で「気象庁」「Open-Meteo」セクションの上にそれぞれ horizontal divider が入っていて、計 2本の線が冗長 ・ ノイズ感がある。

対応 :

- カード内セクション間の `<hr>` or `border-top` を全削除
- セクション間の余白 (`margin-top`) で視覚的に区切る
- 必要なら background 色を `var(--surface-2)` で交互にする (zebra) 等の代替

該当 :
- `src/styles.css` の `.mobile-card .forecast-section`(or 該当) の `border-top` 削除
- `<hr>` 要素を削除
- `margin-top: 16px;` で代替

#### 0.38.15 スマホの「別日 0 (要確認)」の表示位置調整

問題 : スマホカード上で「別日 0 要確認」のスコアバッジ + (要確認) テキストが配置崩れ。バッジと (要確認) が改行されたり、隣接せず位置が変。

対応 :

- スコアバッジ「別日 0」と (要確認) を **1つの flex container** にまとめる
- (要確認) はバッジの **直下** or **右隣** に配置 (改行なしの場合は右隣)
- flex-wrap で必要時のみ改行
- (要確認) のフォントサイズを小さく (`var(--fs-xs)`)、色は `var(--text-sub)`

```html
<div class="score-row">
  <span class="score-badge score-bad">別日 0</span>
  <button class="check-required">(要確認)</button>
</div>
```

```css
.score-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.check-required {
  font-size: var(--fs-xs);
  color: var(--text-sub);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
}
```

該当 : `src/ui/mobileCard.js` (or 該当) のスコア行構造 + `src/styles.css`

#### 0.38.16 曜日に色付け (土曜 = 青 ・ 日曜祝 = 赤)

問題 : 日付セルの曜日表記が全部同色 (グレー or 黒) ・ カレンダー慣習に従って色分けすると視覚的に「週末 or 平日」が即判別可能。

対応 :

| 曜日 | 色 |
|---|---|
| 月 - 金 (平日) | `var(--text)` (デフォルト ・ 黒系) |
| 土 | `var(--saturday)` = #1976D2 (青系) |
| 日 ・ 祝日 | `var(--sunday)` = #D32F2F (赤系) |

実装 :

```javascript
// src/ui/dateUtils.js (or 該当)
function getDayClass(date) {
  const day = date.getDay();
  if (isHoliday(date)) return 'day-sun'; // 祝日も赤扱い
  if (day === 0) return 'day-sun';
  if (day === 6) return 'day-sat';
  return 'day-weekday';
}
```

```css
.day-weekday { color: var(--text); }
.day-sat { color: var(--saturday); font-weight: 600; }
.day-sun { color: var(--sunday); font-weight: 600; }

:root {
  --saturday: #1976D2;
  --sunday: #D32F2F;
}
```

祝日判定 :
- 既存の祝日 JSON or `holiday_jp` ライブラリで判定
- 振替休日 ・ 国民の休日も赤
- PC / スマホ両方適用

該当 :
- `src/ui/table.js` (PC 日付セル) + `src/ui/mobileCard.js` (スマホカード日付)
- `src/styles.css` の色変数 + 曜日クラス
- 祝日判定ロジック (既存なければ追加)

#### 0.38.17 ショー/パレード名の色変更廃止 ・ 左寄せ統一

問題 :
- 現状ショー一覧で priority high (季節限定) のショー名が色付け (アクセント色) されてるが、視覚的にノイズ ・ 太字だけで十分
- ショー名が中央寄せになっていて読みにくい ・ 通常テキストは左寄せが自然

対応 :

- 全ショー名 ・ パレード名を **`color: var(--text)` (デフォルト色)** に統一
- priority high は **太字 (`font-weight: 600`) のみ** で区別 (色付けなし)
- ショー名 ・ 時刻 ・ バッジを **左寄せ** (`text-align: left`)
- ショーカード or 行 (`flex` + `justify-content: flex-start`)

該当 :
- `src/styles.css` の `.show-item .show-name`、`.show-item.priority-high .show-name` から `color` 削除
- `text-align: center` を `text-align: left` に変更

#### 0.38.18 「エントリー」 → 「抽選」 表記変更

問題 : 「エントリー受付」は公式用語だが、「抽選」のほうが内容 (当落) が直感的に伝わる。

対応 :

- 「エントリー受付」 → **「抽選」**
- 「エントリー対象」 → **「抽選対象」**
- ヘルプ用語集に「抽選 = 公式アプリの『エントリー受付』のこと」と紐付け

該当 :
- `src/data/show-thresholds.js` (or 該当) のショーメタデータ
- バッジ ・ ラベル定数
- ヘルプ用語集

#### 0.38.19 ショーレストラン (ルアウ等) の「時刻未定」削除 ・ 「予約必須」のみ表記

問題 : ショーレストラン (ポリネシアンテラス ・ ルアウ等) に「時刻未定 ・ 予約必須」と表示されてるが、レストラン予約ページから時刻は見られる ・ 「時刻未定」は誤誘導。

対応 :

- ショーレストランの表記を **「予約必須」のみ** に変更
- 「時刻未定」表記を削除
- 詳細パネルにレストラン予約ページへのリンク追加 (任意):
  - TDL : <https://reserve.tokyodisneyresort.jp/restaurant/list/?searchType=stage>
  - TDS : (同 search 条件)

該当 :
- `src/data/show-thresholds.js` のショーレストランエントリで `time: '未定'` フラグを削除
- `src/ui/showList.js` (or 該当) のレストラン用バッジ生成
- 必要なら予約ページリンクボタン追加

#### 0.38.20 「公式取得済み」 → 「確定情報」 表記変更

問題 : 「公式取得済み」は内部用語的 ・ ユーザーには「確定情報」のほうが意味が伝わる (= 推測ではなく公式発表値)。

対応 :

- 「公式取得済み」 → **「確定情報」**
- バッジ ・ ステータス表記 ・ tooltip 全て統一
- ヘルプ FAQ に「確定情報 = 公式アプリ / 公式サイトから取得した公式発表の時刻 ・ 演目」と説明

該当 :
- `src/ui/showList.js` (or 該当) のラベル定数
- ヘルプ FAQ

#### 0.38.21 ショー行ごとの 風 ・ 熱情報を toggle (展開) 内に移動

問題 : 詳細パネルのショー一覧で、各ショー行に「風 8m/s 風バ ・ 熱 WBGT27 熱バ」が常時表示されてしまい、ノイズ ・ 縦方向に冗長。

対応 :

- ショー行は **デフォルト折りたたみ** (ショー名 ・ 時刻 ・ バッジ ・ priority のみ)
- ショー行をタップ / クリックで **展開** ・ そのときだけ「風 8m/s 風バ ・ 熱 WBGT27 熱バ」等の詳細リスク情報を表示
- 展開時に追加情報 :
  - 時刻範囲の平均風速 ・ 最大風速
  - 時刻範囲の降水確率
  - 時刻範囲の WBGT
  - 過去同条件の中止確率 (§0.38.11 形式)
  - キャン閾値 (このショーは XX m/s で風キャン)
- バッジ自体 (風バ ・ 熱バ等) はショー行に残す (一目で risk が分かる必要あり)

UI :

```
[折りたたみ時]
> ハーモニーインカラー  13:00  ［風バ］［熱バ］  ← priority high (太字)

[展開時]
v ハーモニーインカラー  13:00  ［風バ］［熱バ］
   風 : 8m/s (avg) / 9m/s (max) ・ 風バ閾値 6m/s
   雨 : 30% / 0.5mm
   熱 : WBGT 27 ・ 熱バ閾値 25 - 28
   過去中止率 : 43% (3/7件)
```

該当 :
- `src/ui/showList.js` のショー行 (折りたたみ機構)
- `src/styles.css` の `.show-item` (collapsed/expanded ステート)
- `<details><summary>` ネイティブ要素利用も検討 (a11y 優位)

#### 検証 (§0.38 全 21項目)

- 持ち物 ・ 服装サジェスト拡充 (#1) : 雨予報日に「折りたたみ傘」/ ポンチョが出る ・ 35℃ 予報日にハンディファン等が出る ・ UV 8 日に SPF50 が出る
- ヘルプモーダル (#2) : sticky thead がモーダル背後に潜る (PC 1280px / スマホ 375px 両方)
- DPA 表記 (#3) : テーブル ・ カードは「DPA」、ヘルプ用語集は full
- 時間帯スコア (#4) : 朝/昼/夜に時刻範囲 (7-11/11-17/17-21) 併記
- 気象庁降水確率 (#5) : 明後日以降も値が出る (週間予報補完) ・ 欠損時は「データなし」or「補」マーク
- 雨セル単位 (#6) : 数字大 ・ 単位小 (風セルと同サイズ感)
- 見出しアイコン (#7) : 気象庁 / Open-Meteo にもアイコン
- 熱の意味明示 (#8) : 列見出し「熱 (WBGT) ［?］」(列名維持) ・ info ツールチップで「暑さ指数」説明 ・ ヘルプ用語集 FAQ に項目
- キャン用語整理 (#9) : 「雨/風/熱キャン」「中止」定義 ・ 「キャンセル」廃止 ・ アメキャン表記揺れなし
- (要確認) クリック (#10) : 理由が popover で表示 ・ ヘルプにも項目
- 中止確率表記 (#11) : 「予報 12m/s ［過去中止 43% (3/7件)］」形式 ・ スマホ 1行収まり
- 時系列グラフラベル (#12) : ショー時刻ラベル重なり解消 ・ ▼マーカー + グラフ下 chips ・ priority high 強調
- PWA バナー位置 (#13) : 画面追随 (fixed) 撤廃 ・ ページ下部 (TOP3 下 ・ フッター上) に通常配置 ・ dismiss は維持
- スマホ区切り線削除 (#14) : 気象庁 ・ Open-Meteo の上の border-top 2本削除 ・ margin で代替
- (要確認) 位置調整 (#15) : スコアバッジと flex 1container ・ 改行崩れ解消 ・ underline + var(--text-sub)
- 曜日色付け (#16) : 土曜青 (#1976D2) ・ 日曜祝赤 (#D32F2F) ・ 平日デフォルト ・ 祝日判定込み
- ショー名色廃止 ・ 左寄せ (#17) : priority high は太字のみ ・ 中央寄せ廃止
- エントリー → 抽選 (#18) : 表記統一 ・ ヘルプ用語集に紐付け
- ショーレストラン (#19) : 「時刻未定」削除 ・ 「予約必須」のみ ・ 必要なら予約ページリンク
- 確定情報 (#20) : 「公式取得済み」→「確定情報」 表記統一
- ショー行情報を toggle 内 (#21) : 風 ・ 熱詳細はデフォルト非表示 ・ 展開時のみ ・ バッジは行に残す

---

#### 検証 (§0.37 全 13項目)

- PC : スコア列復活 (#4)・バッジ長文 (#1)・ショー一覧カード (#3)・グラフ色分離 + アイコン (#11)・TOP3 余白 (#12)
- スマホ : バッジ短縮 (#1)・詳細パネル色統一 (#5)・二重シャドウ解消 (#6)・雨セル幅 (#7)・ヘッダー再構成 (#8)・曜日短縮 (#9)・スコア理由 (#10)
- 熱バッジ 4階層 (#2)・「暑さ注意」消滅
- npm test 緑 (スコア・熱中症減点・scoreReason 等のテスト更新)
- ESLint 0

### 0.40 UI 改善 第3弾 (スマホ詳細統一 ・ タグ統一 ・ 見出し整理)

公開ページ §0.38 反映後の Yuka さん指摘 8項目。スマホ詳細をカード内に格納、全ショー同形式、見出し統一。

#### 0.40.1 スマホ詳細パネルをカード内に格納

問題 : スマホで詳細パネルがカードの外 (or 別位置) に展開され、カード ・ パネルの所属関係が分かりにくい。

対応 :

- カード内に **toggle コンテンツ領域** を新設
- 構造 :
  ```
  ┌─────────────────────┐
  │  カード (日付 + スコア + 風 + 雨 + 熱 + 気象庁 + Open-Meteo) │
  │  - - - - - - - - - - - - - - - - - -  ← 点線 |
  │  [展開時のみ] toggle コンテンツ        │
  │    ・ この日の概要 (§0.40.2)            │
  │    ・ ショー ・ パレード (§0.40.5)       │
  │    ・ 持ち物 ・ 服装                  │
  │    ・ 雨雲レーダー (§0.40.7)            │
  │    ・ 降水確率 ・ 風速 (時系列) (§0.40.8) │
  │  [タップで詳細 / 閉じる] ボタン        │
  └─────────────────────┘
  ```
- カード自体を border で囲み ・ toggle コンテンツも同じカード内に
- 開閉アニメーション (max-height transition) で滑らかに

該当 : `src/ui/mobileCard.js` (or 該当) ・ `src/styles.css` の `.mobile-card`

#### 0.40.2 「別日 X」横の説明を toggle 内 「この日の概要」見出しへ

問題 : 「別日 0 (要確認)」の右に説明テキストが出てるが、カード上では冗長 ・ 詳細展開時に出すべき。

対応 :

- カード上 (折りたたみ時) : スコアバッジ + 風/雨/熱バッジのみ (説明は出さない)
- toggle 内 (展開時) :
  - 新規見出し **「この日の概要」**
  - 内容 :
    - スコア理由 (§0.37.10 の scoreReason) 1-2行
    - 解説テキスト (例 : 「風 9m/s で風バ可能性高 ・ 過去同条件 43% 中止」)
    - (要確認) の理由 (§0.38.10 の popover 内容)

該当 : `src/ui/mobileCard.js` + `src/score/scoreReason.js` (or 該当)

#### 0.40.3 雨セルを中央配置に

問題 : スマホカードで風 ・ 熱は中央寄せだが、雨だけ左寄せ or 配置が違って違和感。

対応 :

- 雨セルを **中央配置** に統一 (風 ・ 熱と同じ `text-align: center` + flex justify-content: center)
- grid-template-areas の wind/rain/heat 各セルに `align-self: center; justify-self: center;` を統一適用

該当 : `src/styles.css` の `.cell-rain` 配置

#### 0.40.4 通常タグを緑に統一

問題 : 風バ / キャン = 黄 ・ 赤 のタグはあるが、通常タグ (= リスクなし) が灰色 or 無色で「OK」感が出ない。

対応 :

| タグ | 色 |
|---|---|
| 通常 | **緑** (`#2E7D32` background, white text) |
| 風バ ・ 雨バ可能性 ・ 熱バ可能性 | 黄 (既存維持) |
| ほぼ中止 ・ キャン濃厚 | 赤 (既存維持) |

`var(--ok-green)` 色トークン追加 ・ `.badge-ok` クラス。

該当 : `src/styles.css` の `.badge-ok` 追加 + `src/ui/table.js` (or 該当) の通常時クラス付与

#### 0.40.5 ショー ・ パレードはデザインなし ・ 同形式 ・ DPA/抽選タグ化 ・ 左寄せ

問題 : §0.37.3 でカード化、§0.38.17 で色廃止したが、まだ priority high の背景色 (warn-bg) や中央寄せが残ってる。完全に同形式にしてほしい。

対応 :

- **全ショーを同形式の行で表示** (背景色 ・ カード化なし)
- priority high も含めて :
  - 背景なし ・ 罫線最小限 (or `<details>` の summary だけ)
  - **テキスト左寄せ** (`text-align: left`)
  - フォントは通常太さ (太字なし) ・ priority 区別は **タグ** で
- **「DPA」「抽選」をタグ化** (現状テキストっぽく見えるが、明確にバッジに) :
  - DPA タグ : `background: var(--accent)`、white text、`padding: 2px 8px`、`border-radius: 4px`
  - 抽選タグ : `background: var(--info)` 等
  - 季節限定タグ (priority high) : `background: var(--ok-green)` 「期間限定」
- 中央寄せ完全撤廃 (§0.38.17 が不完全だったので再徹底)

該当 :
- `src/styles.css` の `.show-item`、`.show-item.priority-high`、`.show-name` を全部リセット
- `src/ui/showList.js` の DPA / 抽選 / 季節限定をタグ化

#### 0.40.6 ショー toggle 文言 「詳細」 → 「開催予想」

問題 : ショー一覧の展開 toggle ラベル 「タップで詳細 / 閉じる」 → ショー固有の文脈で「詳細」は曖昧。

対応 :

- ショー行展開時の summary text を **「開催予想」** に変更
- 折りたたみ時 : `▶ 開催予想`
- 展開時 : `▼ 開催予想` (中身は §0.38.21 の風 ・ 過去中止率 ・ 熱 (per-show 追加なら))

該当 : `src/ui/showList.js` (or 該当) の details summary

#### 0.40.7 雨雲レーダーを通常見出しに

問題 : 「雨雲レーダー」セクションが、他セクション (時系列等) と見出しスタイルが異なる ・ 統一感欠如。

対応 :

- 雨雲レーダーセクションを `<h3 class="section-heading">雨雲レーダー</h3>` (他と同じ通常見出し) に変更
- アイコン `cloud_queue` or `umbrella` を見出し横に
- 内容 (気象庁レーダー iframe or 直リンク) は既存維持

該当 : `src/ui/detailPanel.js` (or 該当) の見出し

#### 0.40.8 「時系列 (降水確率 ・ 風速)」 → 「降水確率 ・ 風速 (時系列)」

問題 : 見出し「時系列 (降水確率 ・ 風速)」は「時系列」が主語 ・ 「何の時系列か」が補足。実際は「降水確率 ・ 風速」を時系列で見せたい → 順序逆。

対応 :

- 見出しを **「降水確率 ・ 風速 (時系列)」** に変更
- アイコンは現状の `umbrella` or `air` (or 両方) を維持

該当 : `src/ui/detailPanel.js` (or 該当) の見出しテキスト

#### 検証 (§0.40 全 8項目)

- 詳細パネルがカード内 (#1) : スマホで点線とボタンの間に toggle 展開
- 「この日の概要」(#2) : toggle 内に新規見出し + スコア理由 + (要確認) 理由
- 雨セル中央配置 (#3) : 風 ・ 熱と同じ位置揃え
- 通常タグ緑 (#4) : 通常 = 緑、風バ等 = 黄/赤
- ショー同形式 (#5) : priority high も背景なし ・ 左寄せ ・ DPA/抽選/季節限定はタグ
- 「開催予想」(#6) : ショー toggle 文言
- 雨雲レーダー見出し (#7) : 通常見出しスタイル統一
- 「降水確率 ・ 風速 (時系列)」(#8) : 見出し順序入れ替え

---

### 0.41 UI 改善 第4弾 (タグ色統一 ・ ショー並列 ・ §0.40 残統合 ・ §0.38 既存修正)

公開ページ §0.40 反映後の Yuka さん指摘 + 私が画面確認で見つけた未実装/誤実装。

#### 0.41.1 通常タグの形式統一 (白文字撤廃 ・ 黄/赤と同形式に)

問題 : 通常タグが「緑背景 + 白文字」で、風バ/雨バ等の「黄背景 + 濃黄文字」「赤背景 + 濃赤文字」と形式が違う。統一感欠如。

対応 :

| タグ | 背景色 | 文字色 |
|---|---|---|
| 通常 | `#E8F5E9` (薄緑) | `#1B5E20` (濃緑) |
| 風バ/雨バ/熱バ (注意) | `#FFF8E1` (薄黄) | `#F57F17` (濃黄) |
| 風キャン/雨キャン/熱キャン濃厚 (警告) | `#FFEBEE` (薄赤) | `#C62828` (濃赤) |
| ほぼ中止 | `#FFEBEE` (薄赤) | `#B71C1C` (濃赤 ・ 太字) |

全タグ「薄色背景 + 濃色文字」パターンに統一 ・ 白文字は撤廃。

該当 : `src/styles.css` の `.badge-ok`、`.badge-warn`、`.badge-danger` 等

#### 0.41.2 ショー ・ パレード完全並列化 (priority high 装飾を全撤廃)

問題 : §0.38.17 ・ §0.40.5 で「priority high の色 ・ 背景 ・ 中央寄せ撤廃」と仕様化したが、まだ太字 or 色付けが残ってる可能性。

対応 :

- **全ショーを完全同形式** で表示
- priority high のフラグは **タグ「期間限定」** のみで区別 (フォントは通常太さ ・ 色変更なし ・ 背景なし)
- 全ショーのフォントサイズ ・ 色 ・ 太さ ・ 配置 を完全に揃える
- ジャンボリミッキー等の複数公演も同形式

該当 : `src/styles.css` の `.show-item`、`.show-item.priority-high` のすべての visual 差分を撤廃

#### 0.41.3 期間限定タグの色変更 (「ベスト」と被らない色)

問題 : §0.40 で期間限定タグを緑にしたが、スコアの「ベスト」(緑) と被って区別困難。

対応 :

- 期間限定タグを **別色** に変更 :
  - 候補1 : **紫系** `background: #F3E5F5; color: #6A1B9A;` (推奨)
  - 候補2 : オレンジ系 `background: #FFF3E0; color: #E65100;`
  - 候補3 : 青緑系 `background: #E0F2F1; color: #00695C;`
- 文字色白でなく ・ 薄色背景 + 濃色文字パターン (§0.41.1 と統一)
- 「ベスト」(緑) と完全に視覚区別

推奨 : **紫系** (使われてない色 ・ 「特別感」演出)

該当 : `src/styles.css` の `.badge-limited` or `.tag-seasonal`

#### 0.41.4 DPA / 抽選表記 + タグ化 (再徹底)

問題 : §0.38.3 で「プレミアアクセス → DPA」、§0.38.18 で「エントリー → 抽選」、§0.40.5 で「DPA / 抽選はタグ化」と複数回仕様化したが、現状 :

- 「プレミアアクセス」表記がまだ残ってる
- 「エントリー受付」表記がまだ残ってる
- タグ化されてない (テキストっぽい表示)

対応 :

- 全 src/* を grep し、「プレミアアクセス」を **「DPA」** に置換 (ヘルプ用語集のみ初出 full)
- 「エントリー受付」「エントリー対象」を **「抽選」** に置換
- 「DPA」「抽選」を **タグ化**:
  - DPA : `background: #E3F2FD; color: #1565C0;` (青系) ・ 4px padding
  - 抽選 : `background: #FFF3E0; color: #E65100;` (オレンジ系) ・ 4px padding
- スクリーン取得時 (公式 calendar 取得) の表示テキストも変換

該当 :
- `src/data/scheduleLoader.js` のテキスト変換
- `src/data/schedule/*.json` 内のテキスト (再 sync 不要なら表示時変換)
- `src/ui/showList.js` のタグ化
- `src/styles.css` の `.tag-dpa`、`.tag-lottery`

#### 0.41.5 (要確認) クリック説明 + 「この日の概要」見出し新設

問題 : §0.38.10 (要確認) popover ・ §0.40.2 「この日の概要」見出しが両方未実装。

対応 :

詳細パネル (toggle 内) の冒頭に **新規見出し「この日の概要」** を追加し、以下を表示 :

```
## この日の概要
[スコア理由] 風 9m/s で風バ可能性高 ・ 過去同条件 43% 中止
[要確認の理由] 過去同条件の中止記録が少ない (3件未満) ・ 6日以降の予報誤差大
[その日の解説] 天気概況 ・ 鑑賞条件
```

- 「(要確認)」テキストはカード上では残す ・ クリックで toggle 開く + 「この日の概要」セクションへスクロール
- スコア理由 (§0.37.10) はカードからは削除、概要内に集約

該当 :
- `src/ui/mobileCard.js` (カードから (要確認) クリック制御)
- `src/ui/detailPanel.js` (「この日の概要」セクション)
- `src/score/scoreReason.js` (既存活用)
- `src/score/checkRequiredReason.js` (新規 ・ (要確認) の理由生成)

#### 0.41.6 スマホ詳細パネルをカード内に完全格納 (§0.40.1 完全版)

問題 : §0.40.1 で「カード内 toggle 化」と仕様化したが、現状まだ詳細パネルがカードの白色背景の外にある。

対応 :

- カード全体を `<article class="day-card">` で囲む
- 折りたたみ時 : カード内のサマリーのみ
- 展開時 : 同じカード内に toggle コンテンツが展開 (背景白 ・ 影 ・ border 継続)
- 「タップで閉じる」ボタンもカード内に
- detail-row (`<tr>`) を使わず、`<details>` ネイティブ or 純粋 div 展開
- アニメーション (max-height transition)

該当 :
- `src/ui/mobileCard.js` の構造改修
- `src/styles.css` の `.day-card` (open/closed ステート)
- PC は別レイアウト維持 (テーブル + detail-row も可)

#### 0.41.7 §0.40.8 修正 「降水量」 → 「降水確率」

問題 : 仕様 §0.40.8 は「時系列 (降水確率 ・ 風速)」→「降水確率 ・ 風速 (時系列)」だが、現状実装は「**降水量** ・ 風速 (時系列)」になっており、「降水確率」が「降水量」に化けている。

対応 :

- 見出しを **「降水確率 ・ 風速 (時系列)」** に修正
- グラフの Y 軸ラベル ・ 凡例も「降水確率 (%)」を維持

該当 : `src/ui/detailPanel.js` (or 該当) の見出し + Chart.js dataset label

#### 0.41.8 ショー時刻列挙の整形

問題 : ジャンボリミッキー等の複数公演ショー が「11:00 / 13:30 / 14:30 / 15:30 / 16:30」と横並び ・ 折り返して読みにくい。

対応 :

選択肢 :
- **A** : 時刻 chips で表示 (`<span class="time-chip">11:00</span>`)
- **B** : 「開催予想」toggle 内に格納 ・ 折りたたみ時は最初の時刻 + 「他N回」
- **C** : 縦並び (各時刻を改行で)

推奨 : **B (toggle 内に格納)** ・ 折りたたみ時は「11:00 (他4回)」、展開時に全時刻表示。

該当 : `src/ui/showList.js` の複数時刻処理

#### 0.41.9 「Liveアクト」タグの定義 ・ 必要なら統合/削除

問題 : 「Liveアクト」タグが表示されてるが、用語不明 ・ DPA / 期間限定 / 抽選 と性質違い ・ ユーザーには伝わらない。

対応 :

- 「Liveアクト」が何を意味するか確認 :
  - 推測 : 生演奏付きショー (歌 ・ ダンサー出演) を意味?
  - or 通常のショー区分?
- 不要なら **削除**
- 必要なら ヘルプ用語集に定義追加 + タグ色明示
- 推奨 : 一旦削除 ・ 必要性が出たら戻す

該当 : `src/data/show-thresholds.js` (or 該当) のタグ定義

#### 0.41.10 「タップで詳細閉じる」 → 「タップで閉じる」 or 「閉じる」

問題 : 「タップで詳細閉じる」は文言として違和感 (「で」「閉じる」の繋ぎ)。

対応 :

- 展開時のボタン文言を **「閉じる」** に統一
- 折りたたみ時 : **「タップで詳細」** (現状維持)

該当 : `src/ui/mobileCard.js` (or 該当) のボタン text

#### 0.41.11 詳細冒頭「78」 (謎数字) の意味明示

問題 : 詳細展開時の冒頭に「78」という数字が出てるが、何のスコアか不明 (時間帯スコア? 総合?)。

対応 :

- 「時間帯スコア」セクションの「昼 76 ベスト ← 最重視」のような **ラベル + 値 + 評価** 形式に
- 単独の数字「78」表示は撤廃
- §0.38.4 (時間帯スコア時刻明記) の延長で対応

該当 : `src/ui/detailPanel.js` (or 該当) のスコア表示

#### 0.41.12 雨雲レーダー説明文の文末整形

問題 : 「気象庁のウェブサイトで現在の雨をご覧」が文章途中で切れた感 (「ご覧ください」?)。

対応 :

- 「気象庁のウェブサイトで現在の雨雲をご覧ください」
- or 「気象庁の雨雲レーダーを見る ↗」 (シンプル + リンク矢印)
- リンクボタンは Material `open_in_new` アイコン併用

該当 : `src/ui/detailPanel.js` (or 該当) の雨雲レーダーセクション

#### 検証 (§0.41 全 12項目)

- 通常タグ (#1) : 薄緑背景 + 濃緑文字 ・ 全タグ「薄色背景 + 濃色文字」統一
- ショー並列 (#2) : 全ショー同フォント ・ priority high 装飾全撤廃
- 期間限定色 (#3) : ベストと被らない色 (紫推奨) ・ 文字白でない
- DPA / 抽選 (#4) : 表記置換 + タグ化 (青 / オレンジ)
- 「この日の概要」(#5) : 見出し新設 + (要確認) クリック動作
- カード内格納 (#6) : スマホ詳細がカードの白背景内に
- 降水確率 (#7) : 「降水量」誤実装修正
- 時刻列挙 (#8) : 開催予想 toggle 内に格納 (B案)
- Liveアクト (#9) : 一旦削除 or 用語集追加
- 「閉じる」文言 (#10) : 「タップで詳細閉じる」→「閉じる」
- 「78」謎数字 (#11) : ラベル付き表示に
- 雨雲レーダー説明 (#12) : 「ご覧ください」or リンクボタン化

---

### 0.42 UI 改善 第5弾 + スコア整合性バグ修正 (Yuka さん指摘 4項目)

公開ページ §0.41 反映後の指摘。枠装飾の削除 ・ 複合天気アイコン ・ 時間帯スコアと日スコアの整合性バグ修正。

#### 0.42.1 「14日のうちベスト3」セクションの枠 ・ 背景を削除

問題 : §0.37.12 で「上マージン拡大 + 薄い背景 + padding + border-top」と仕様化したが、結果的に「枠で囲った」感が出てメイン領域から浮いて見える。

対応 :

- **枠 (border, background) を完全削除**
- `border-top` (細線 1px) のみ残す or それも削除
- `margin-top` で視覚区切り (48px)
- セクション内のカード (TOP3 アイテム) は既存維持

```css
.top3-section {
  margin-top: 48px;
  padding-top: 0;          /* 削除 */
  background: transparent; /* 削除 */
  border-top: none;        /* or 1px solid var(--border-light) */
  border-radius: 0;
}
.top3-section h2 {
  /* 見出しは維持 ・ 余白で区切る */
  margin-bottom: 16px;
}
```

該当 : `src/styles.css` の `.top3-section` (or 該当)

#### 0.42.2 スマホ詳細 toggle 内の水色背景 + 枠削除 ・ 横幅拡大

問題 : スマホ詳細展開時、toggle 内に水色 (light blue) 背景がついていて、枠で囲まれてる ・ 「カードと別物感」が出る ・ §0.41.6 でカード内格納したが、内部の装飾が残ってる。

対応 :

- 水色背景を **白統一** (`background: white` or `var(--surface)`)
- 内部の枠 ・ border を完全削除
- 横幅をカード全幅と同等に (内側 padding 最小 ・ 外側 margin 0)
- §0.41.6 の「1枚カードに格納」をさらに徹底

```css
@media (max-width: 768px) {
  .detail-content,
  .detail-section {
    background: white;       /* 水色削除 */
    border: none;            /* 枠削除 */
    border-radius: 0;        /* カードの下角丸に依存 */
    margin: 0;               /* 全幅 */
    padding: 12px 16px;      /* 内側のみ */
  }
}
```

該当 : `src/styles.css` の詳細パネル系 (スマホ media query)

#### 0.42.3 天気概況の合体アイコン化 (複合天気対応)

問題 : 天気概況「晴れ、夜曇り所により、昼前まで霧」のような複雑な天気が、霧 1つのアイコンだけで表現されてしまい、晴れ要素 ・ 曇り要素が伝わらない。

対応 :

選択肢 :

**A. 複数アイコン並列** (推奨)
時間帯別に主要天気アイコンを並べる :
```
[wb_sunny] → [cloud] → [foggy]
  朝         昼          夜
```

**B. 統合アイコン (Material Symbols)**
- 「晴れ時々曇り」: `partly_cloudy_day`
- 「曇り時々晴れ」: `cloudy` + 小さい sun
- 「霧」: `foggy`
- 「雨」: `rainy`
- 「晴れのち雨」: `cloud_storm` etc.

複合パターンをマッピングテーブル化 :
```javascript
const WEATHER_ICONS = {
  '晴れ': 'wb_sunny',
  '曇り': 'cloud',
  '霧': 'foggy',
  '雨': 'rainy',
  '晴れ時々曇り': 'partly_cloudy_day',
  '晴れ夜曇り': ['wb_sunny', 'cloud'],  // 並列
  '昼前まで霧': 'foggy',
  '晴れ、夜曇り所により、昼前まで霧': ['wb_sunny', 'cloud', 'foggy']  // 複数並列
  ...
};
```

**推奨 : A (複数アイコン並列)** ・ 複雑天気を「、」で分割して各要素をアイコン化。

該当 :
- `src/data/weatherIcons.js` (新規 ・ マッピングテーブル)
- `src/ui/detailPanel.js` (or 該当) のアイコン生成
- 既存単一アイコン使ってる箇所も統合

#### 0.42.4 ★ 時間帯スコアと日スコアの整合性バグ (最優先)

問題 : 6/10 (水) の例 :
- 朝 75 ・ 昼 75 ・ 夜 75 (時間帯スコア全部 75)
- 日スコア = **別日 25**
- 平均でも (75*0.5 + 75*2.0 + 75*0.3)/2.8 = 75 のはず
- ユーザーから見ると **明らかに矛盾**

原因推測 :
- 雨 40% 13mm = 「ほぼ中止」バッジ → §0.16 バッジ floor guard (日スコア 25 強制)
- でも時間帯スコアには floor guard が適用されてない
- 結果 : 時間帯 75 ・ 日 25 の乖離

対応 :

選択肢 :

**A. 時間帯スコアにも同じ floor guard を適用** (推奨)
- 時間帯ごとに「その時刻に雨が降ってる ・ 風が強い ・ 暑い」を判定
- 「ほぼ中止」相当のリスクがある時間帯は floor 25 適用
- 結果 : 時間帯 25 ・ 日 25 で整合 ・ ユーザー混乱なし

**B. 日スコアの floor を緩和 ・ 平均ベースに**
- バッジ floor を撤廃 ・ 平均が低い場合のみ低スコア
- バッジは別軸で表示
- 「雨で中止リスク高」(バッジ) + 「平均 75 (時間帯次第)」(スコア) として両立

**C. 表示時に整合性チェック ・ 警告**
- 日 < min(時間帯) の場合「日スコアは雨バッジで強制ダウン」と注釈
- ロジックは変えず、表示で説明

**推奨 : A** ・ ロジックを整合させるのが最もシンプル ・ ユーザーは「数値の不一致」を見るとアプリへの信頼を失う。

詳細 (A 案) :

```javascript
// src/score/scoring.js (or 該当)
function getTimeSlotScore(forecast, slot /* 朝/昼/夜 */) {
  const baseScore = computeBaseScore(forecast.weather[slot]);
  const badges = getBadges(forecast.weather[slot]);
  
  // 時間帯にもバッジ floor guard を適用
  if (badges.some(b => b.level === 'extreme')) {
    return Math.min(baseScore, 25);
  }
  if (badges.some(b => b.level === 'severe')) {
    return Math.min(baseScore, 50);
  }
  return baseScore;
}
```

時刻別の風 ・ 雨 ・ 熱データから時間帯バッジを動的計算 (現状日単位のバッジを時間帯にも適用)。

該当 :
- `src/score/scoring.js` の `getTimeSlotScore`
- `src/score/badges.js` (or 該当) を時間帯対応に
- スコアテスト追加 (時間帯 = 日スコアの最大値以下を保証)

#### 検証 (§0.42 全 4項目)

- TOP3 枠 (#1) : 枠 ・ 背景削除 ・ シンプル
- スマホ詳細 (#2) : 水色背景削除 ・ 枠削除 ・ 全幅
- 複合天気アイコン (#3) : 「晴れ、夜曇り所により、昼前まで霧」が複数アイコンで表現
- スコア整合 (#4) : 時間帯 75 ・ 日 25 のような乖離が消失
  - 採用 : **時間帯 ≦ 日 (クランプ)** ・ 時間帯スコアは日スコアを上限とする
  - 理由 : ユーザー視点で「日が悪いのに時間帯だけ良い」表示は混乱 ・ 日 = floor guard 適用済の値を時間帯にも反映
  - 実装 : Code 採用 (commit 5ade3bb) ・ Vitest 追加で検証済
  - (旧仕様文 「時間帯 ≧ 日」「日 = min(時間帯)」 は Cowork 仕様書ミス ・ 上記が正)

---

### 0.43 ショー詳細の風速表示重複バグ修正

公開ページ §0.42 反映後の Yuka さん指摘 1項目。

#### 0.43.1 ショー詳細の風速 2重表示 (6m/s vs 8m/s) を統合

問題 : ハーモニーインカラー 13:00 詳細展開時 :
```
風 6m/s ・ 熱 WBGT21         ← §0.38.21+ (#18) per-show 時刻別 (13:00 ピンポイント)
予報 8m/s ［過去中止 4% (1/27件)］ ← §0.38.11 cancelProbability (時刻範囲 max)
```

両方とも正しい予想値だが、計算方法が違うだけ ・ ユーザーには「6m/s なのか 8m/s なのか」が伝わらず混乱。

原因 :
- §0.38.21+ (#18) 実装時に既存の §0.38.11 cancelProbability 表示と統合せず追加してしまった
- 結果 : per-show 時刻別 ・ cancelProbability 用 max ・ 2系統の風速値が並列表示

対応 :

**A. 1行統合 (推奨)**

```
風 6m/s (avg) / max 8m/s ・ 熱 WBGT21 ［過去中止 4% (1/27件)］
```

- avg = ショー時刻 (13:00) ピンポイント
- max = ショー時刻 ±1時間の最大 (cancelProbability 用)
- 並列で「両方分かる」+「同じ風だが値が違う理由」をツールチップで補足

**B. 「現在予想」と「ピーク予想」で見出し付き**

```
[ショー時刻 13:00] 風 6m/s ・ 熱 WBGT21
[±1時間ピーク]   風 8m/s ［過去中止 4% (1/27件)］
```

- 2行だが明確に区別 ・ 用語で「ショー時刻」「ピーク」と説明

**C. avg のみ採用 (cancelProbability の max は内部利用に)**

```
風 6m/s ・ 熱 WBGT21 ［過去中止 4% (1/27件)］
```

- 表示は per-show (6m/s) のみ
- 過去中止率の参照ロジックは max (8m/s) ベース継続 (内部)
- 最もシンプルだが「過去中止率の閾値判定がなぜ 6m/s なのに 4%?」の疑問残り得る

**推奨 : A (1行統合)**

理由 :
- 1行で済む (詳細パネルの行数増えない)
- avg / max 両方見える ・ 上級ユーザーが「最悪ケース」を判断可能
- ツールチップで補足

詳細 :

```html
<div class="show-risk-line">
  <span class="metric">風 <strong>6</strong> <span class="unit">m/s</span> (avg)</span>
  <span class="metric-aux"> / max <strong>8</strong> <span class="unit">m/s</span></span>
  <span class="metric">熱 <strong>WBGT 21</strong></span>
  <span class="cancel-prob">［過去中止 4% (1/27件)］</span>
</div>
```

ツールチップ (info アイコン or hover):
> avg = ショー開始時刻 (13:00) の予測 / max = ショー時刻前後 1時間の最大予測 (中止判定 ・ 過去事例検索のベース)

該当 :
- `src/ui/table.js` L283- (#18) の per-show 風 ・ 熱表示と L148 cancelProbability 表示を統合
- `src/score/showRisk.js` の avg / max 両方を返す
- `src/score/cancelProbability.js` の wind は内部値として継続

#### 検証 (§0.43.1)

- ショー詳細展開時、風速の数字が 1行に統合 (avg + max)
- 「6m/s と 8m/s が並ぶ」混乱が消える
- 過去中止率の表示は維持
- ツールチップで avg/max の意味分かる

#### 0.43.2 ★ 「平均 > max」問題を「平均風速 / 突風 (gust)」表記に修正

問題 : §0.43.1 完了後、「平均 13 / max 12」のような 平均 > max が起きる日がある (例 6/1)。原因は :

- 「平均」表記 = Open-Meteo `windspeed_10m` (1時間平均風速 ・ sustained wind)
- 「max」表記 = Open-Meteo `wind_gusts_10m` (1時間最大瞬間風速 ・ gust)
- これらは **別物** (平均風速 vs 突風) だが、UI 表記が「avg / max」になっており、数値の大小関係 (avg ≦ max) を期待してしまう
- 突風 (gust) は平均風速より大きいのが普通だが、計算窓の違いや時刻別データの揺らぎで avg > max が発生し得る

対応 : **気象用語に揃える** ・ 「平均風速 / 突風 (gust)」表記に変更。

| 旧 | 新 |
|---|---|
| 風 13m/s (平均) / max 12m/s | **風 13m/s ・ 突風 12m/s** |
| or 「max」 | **「突風 (gust)」** |

仕様詳細 :

- avg → **平均風速** (windspeed_10m 由来 ・ sustained wind)
- max → **突風 (gust)** (wind_gusts_10m 由来 ・ instantaneous peak)
- 過去中止率の判定は **突風 (gust)** をベース継続 (実運休は突風で判断されるため)
- 表示 :
  ```
  風 13m/s ・ 突風 12m/s ・ 熱 WBGT28 ［過去中止 60% (3/5件)］
  ```
- ツールチップ更新 :
  > 平均風速 = ショー時刻の 1時間平均 (sustained) / 突風 = 1時間最大瞬間風速 (gust)。突風は中止判定や過去事例検索のベースです。

ユーザー視点 :
- 「平均 13 ・ 突風 12」は気象的に成立する (平均は持続風速 ・ 突風はピーク瞬間値 ・ 計算窓のズレ等で逆転あり得る) → **直感的に違和感なし**
- 「平均 < 突風」が通常だが、「平均 > 突風」も「あり得る」と認知できる

該当 :
- `src/score/showRisk.js` の表記
- `src/ui/table.js` の `showRiskLineHtml()` ラベル変更
- ツールチップ (info アイコン or hover)
- ヘルプ用語集に「平均風速 / 突風 (gust)」追加

#### 検証 (§0.43.2)

- 全ショー詳細展開時 ・ 「平均 / 突風」表記
- ヘルプ用語集に「平均風速」「突風 (gust)」エントリ
- 過去中止率は突風 (gust) ベース継続
- 6/1 のような「平均 > 突風」日も違和感なく表示

#### 検証 (§0.43 全 2項目)

- §0.43.1 風速重複統合 (1行化) ✅ 完了
- §0.43.2 平均/突風 表記化 (新規)

---

### 0.44 UI 改善 第6弾 (toggle 内整理 ・ ショー欄並列徹底 ・ タグ色再調整)

公開ページ §0.43 反映後の Yuka さん指摘 14項目。toggle 内構造再編 + ショー欄 (priority 装飾完全撤廃) + 屋内ショー対応 + データ整合性。

#### 0.44.1 toggle 内 「時間帯スコア」 にその日の総合スコアも併記

問題 : 詳細パネル内に「時間帯スコア (朝/昼/夜)」は出てるが、その日の総合スコア (例 「微妙 65」) との対応がないとピンと来ない。

対応 :

```
時間帯スコア (昼を最重視)
[日全体]      65 微妙
[朝 9-12時]   75
[昼 12-16時]  65 ← 最重視
[夜 18-21時]  60
```

- 「日全体」を時間帯スコアの先頭に追加 ・ ラベル + スコア値 + 評価
- 4列 (日/朝/昼/夜) ・ 「日」は強調表示 (太字 or 縦線)
- §0.42.4 のクランプ (時間帯 ≦ 日) が一目で検証できる

該当 : `src/ui/detailPanel.js` (or 該当) の時間帯スコア表示

#### 0.44.2 警報 ・ 注意報を 「この日の概要」 内に移動

問題 : §0.39.3 (#21) で実装した「気象庁 濃霧注意報」バッジが、カード外 (or 詳細パネルの外) に出てる。同じ詳細パネル内の「この日の概要」セクションに集約したい。

対応 :

- 警報 ・ 注意報バッジを **「この日の概要」内に移動** (スコア理由の隣 or 下に)
- カード上 (折りたたみ時) には現状維持 (当日 ・ 翌日は警告必要)
- 「この日の概要」表示例 :
  ```
  ## この日の概要
  [警報] 気象庁 濃霧注意報 (06/10 5:00 発表)
  スコア理由 : 風 6m/s 風バ ・ 雨 40% 中止
  (要確認) : 6日先以降は予報の誤差大きめ
  天気概況 : 霧雨 ・ 最高 17° / 最低 14°
  ```

該当 : `src/ui/detailPanel.js` 「この日の概要」セクション + 警報バッジ表示制御

#### 0.44.3 「気象庁」 / 「Open-Meteo」 見出し統一 + 晴れアイコン

問題 : 「気象庁」「Open-Meteo」列の見出し ・ アイコンがバラバラ ・ 統一感欠如。

対応 :

| 列 | 旧 | 新 |
|---|---|---|
| 気象庁 | 「気象庁」 + `cloud` アイコン | **「天気 (気象庁)」** + `wb_sunny` (晴れマーク) |
| Open-Meteo | 「Open-Meteo」 + `partly_cloudy_day` | **「天気 (Open-Meteo)」** + `wb_sunny` (晴れマーク) |

- 両方とも晴れマーク (`wb_sunny`) で統一 ・ 「天気予報を示すシンボル」として
- 見出し名前は「天気 (ソース名)」(半角カッコ)
- ソース別 ・ アイコンは共通

該当 : `src/ui/table.js` の `<thead>` ヘッダー部

#### 0.44.4 雨セル「7% 0.5mm」の単位アキを 1px に詰める

問題 : 雨セル表記「7% 0.5mm」が「7 % 0.5 mm」のように数字と単位の間が広く見える ・ 風セルと比べて違和感。

対応 :

```css
.cell-rain .num + .unit,
.cell-wind .num + .unit {
  margin-left: 1px;          /* 旧 2-4px → 1px */
  margin-right: 6px;         /* 単位の後ろは適度に */
}
```

該当 : `src/styles.css` の `.cell-rain .unit`、`.cell-wind .unit`

#### 0.44.5 「降水確率 ・ 風速 (時系列)」を 2グラフに分割 + 風速を緑

問題 :
- 降水確率 (%) と風速 (m/s) を 1つのグラフに 2軸で表示してて、軸違いで読みづらい
- 色も両方青系で区別困難

対応 :

**A. 2グラフ分割**
- グラフ 1 : **「降水確率 (時系列)」** ・ 単軸 (%) ・ 青系
- グラフ 2 : **「風速 (時系列)」** ・ 単軸 (m/s) ・ 緑系
- それぞれ独立したカード ・ Y 軸が独立で読みやすい

**B. 色変更**
- 降水確率 : 青 (`#4A90D2`)
- 風速 : 緑 (`#2E7D32` or `#43A047`) ・ 既存青系から変更

該当 : `src/ui/chart.js` (or 該当) ・ Chart.js 設定を 2 instance に + dataset 色

#### 0.44.6 持ち物 ・ 服装 から天気不変アイテム除外

問題 : 持ち物リストに「モバイルバッテリー」「歩きやすい靴」など天気に関係ないアイテムが常時表示されてる ・ 「天気予報からの服装サジェスト」の主旨と異なる。

対応 :

- **天気依存アイテムのみ表示** :
  - 雨対策 (折りたたみ傘 ・ ポンチョ)
  - 暑さ対策 (ハンディファン ・ ネッククーラー)
  - 寒さ対策 (上着 ・ ダウン)
  - UV 対策 (日焼け止め ・ 帽子 ・ サングラス)
  - 風対策 (髪留め)
  - ショー対策 (レジャーシート ・ クッション)
- **天気不変は除外** :
  - モバイルバッテリー
  - 歩きやすい靴

(これらは「マイハマびより」ユーザーマニュアル §持ち物 で別途案内 ・ サジェストには出さない)

該当 :
- `src/score/outfit.js` (or 該当) のマッピングテーブルから「全日共通」セクション除去
- ヘルプ ・ マニュアルに「常備品」を別途記載

#### 0.44.7 ★ ショー ・ パレード 色 ・ 太字 完全撤廃 (再々々々指摘)

問題 : §0.38.17 ・ §0.40.5 ・ §0.41.2 と 3回仕様化してるが、まだ priority high の色付け or 太字 or 薄色背景が残ってる。

対応 (今度こそ完全に) :

- **すべてのショー ・ パレードを完全同形式で表示**
- priority high のフラグは **タグ (「期間限定」) のみ** で区別 ・ ショー名自体は :
  - `font-weight: 400` (normal)
  - `color: var(--text)` (デフォルト)
  - `background: transparent`
  - `border: none`
- 季節限定や DPA も背景色 ・ 薄色 etc. なし
- 全行 ・ 同じフォント ・ 同じ色 ・ 同じレイアウト

該当 :
- `src/styles.css` の `.show-item`、`.show-item.priority-high`、`.show-name`、すべての修飾 ・ media query を完全リセット
- 既存仕様 §0.38.17 ・ §0.40.5 ・ §0.41.2 の上書きで決着

#### 0.44.8 ショーレストランの「予約必須」重複削除

問題 : ミッキーのレインボー ・ ルアウ ・ シーのダッフィー (例) で「予約必須予約必須」と 2回出てる ・ どちらかが斜線スタイル ・ 重複。

対応 :

- ショーレストランの「予約必須」表記を **1回のみ** に
- バッジ + テキスト両方出してた場合、**バッジのみ残す** (斜線テキストを削除)

該当 :
- `src/data/show-thresholds.js` (or 該当) のショーレストランエントリ
- `src/ui/showList.js` (or 該当) の重複表示制御

#### 0.44.9 「開催予想」 toggle 撤廃 ・ 全表示

問題 : §0.40.6 で「開催予想」 toggle 化したが、各ショーごとに開閉操作が必要 = 全体把握が面倒。常時展開でいい。

対応 :

- `<details>` ・ `<summary>` 構造を撤廃
- 各ショー行に **常時** 「風 / 突風 / 熱 / 過去中止率」 を表示
- 縦に積む or 1行 inline (画面幅次第)

該当 :
- `src/ui/showList.js` (or 該当) ・ details を div に置換
- `src/styles.css` ・ `.show-toggle` スタイル削除

#### 0.44.10 行の並び順 : 時間先 ・ ショータイトル後

問題 : 現状 「ディズニー ・ ハーモニー ・ イン ・ カラー 13:00」 のようにタイトル先 ・ 時刻後。これを **時刻先 ・ タイトル後** に変更 (時刻順で一覧したいユーザーの自然な順)。

対応 :

```
旧 : ディズニー ・ ハーモニー ・ イン ・ カラー  13:00  [期間限定] [DPA]
新 : 13:00  ディズニー ・ ハーモニー ・ イン ・ カラー  [期間限定] [DPA]
```

- 時刻 (`hh:mm`) を行頭に
- ショー名 ・ タグ続く
- 等幅フォント (`font-variant-numeric: tabular-nums`) で時刻を揃える

該当 : `src/ui/showList.js` (or 該当) の行レンダリング順

#### 0.44.11 スカイ ・ フル ・ オブ ・ カラーズを TDL / TDS 両方に表示

問題 : 「スカイ ・ フル ・ オブ ・ カラーズ」はランドとシー共通の花火 (両パーク上空で見える) なのに、現状 TDS のみに表示されてる。

対応 :

- `src/data/schedule/{YYYY-MM}.json` のスカイ ・ フル ・ オブ ・ カラーズエントリを **TDL/TDS 両方** に追加
- or `src/data/show-thresholds.js` で `park: 'both'` フラグを定義
- 両パーク詳細パネル (TDL / TDS タブ) どちらにも表示

該当 :
- `src/data/scheduleLoader.js` の park フィルター
- `src/data/schedule/2026-{05,06,07,...}.json` の修正 (今月分から ・ 翌月分は Cowork 取得時に対応)

#### 0.44.12 屋内ショー ・ プロジェクションは風速バッジ非表示

問題 : 屋内ショー (例 ルアウ ・ ルアウは屋外? ・ マジカルミュージックワールド) や、プロジェクションマッピング (スパークリング ・ ジュビリー ・ ナイト) は屋根あり/演出のみで風速関係ない ・ にも関わらず風バッジが出てる。

対応 :

`src/data/show-thresholds.js` に **`indoor: true`** or **`weatherless: true`** フラグ追加。該当ショー :

| ショー | パーク | カテゴリ |
|---|---|---|
| ミッキーのレインボー ・ ルアウ | TDL | 屋内ショーレストラン |
| ミッキーのマジカルミュージックワールド | TDL | 屋内ステージ |
| ダッフィー & フレンズのワンダフル ・ フレンドシップ | TDS | 屋内ステージ |
| ドリームス ・ テイク ・ フライト | TDS | 屋内ステージ |
| 【環境演出】スパークリング ・ ジュビリー ・ ナイト | TDS | プロジェクションマッピング (壁面投影 ・ 風影響少) |

これら `weatherless: true` のショーは :
- 風バッジ ・ 過去中止率非表示
- 「屋内 ・ 天候影響なし」マーク (or 単に空欄)
- 熱バッジは継続 (屋内でも夏は暑い ・ ただし WBGT は屋外値なので参考程度)

該当 :
- `src/data/show-thresholds.js` の weatherless フラグ
- `src/ui/showList.js` の風バッジ表示制御

#### 0.44.13 複数公演ショーの 2行レイアウト (時刻並列 + ショー名)

問題 : ジャンボリミッキー ・ マジカルミュージックワールド等の複数公演ショーが「11:00 / 12:20 / 13:45 (...)  ミッキーのマジカルミュージックワールド」と 1行で続いて読みづらい。

対応 :

```
旧 : 12:45 / 14:00 ほか3回  ミッキーのマジカルミュージックワールド  抽選 DPA

新 : 10:55 / 12:20 / 13:45 / 15:50 / 17:15
     ミッキーのマジカルミュージックワールド  抽選 DPA
```

- 1行目 : 全時刻を `/` 区切りで並列
- 2行目 : ショー名 + タグ
- 改行 ・ インデント揃え
- §0.41.8 の「toggle 内格納」(B案) を撤廃 ・ 全時刻常時表示
- 5件以上は 「4回」省略なく全部出す

該当 :
- `src/ui/showList.js` 複数公演レンダリング
- `src/styles.css` `.show-item-times` (1行目) + `.show-item-name` (2行目)

#### 0.44.14 抽選 / DPA タグの色変更 (文字白撤廃 ・ 薄色+濃文字)

問題 : 抽選 (赤) ・ DPA (青) タグが文字色白で主張強すぎる ・ 「確定情報」(薄緑+濃緑) のような落ち着いた配色にしたい。

対応 :

| タグ | 旧 | 新 |
|---|---|---|
| DPA | 青背景 + 白文字 | **薄水色** (`#E1F5FE` 背景 + `#0277BD` 濃文字) |
| 抽選 | オレンジ背景 + 白文字 | **薄紫** (`#F3E5F5` 背景 + `#6A1B9A` 濃文字) |
| 期間限定 (§0.41.3 で紫) | 維持 | 維持 |
| 確定情報 (§0.38.20) | 薄緑 + 濃緑 | 維持 |

全タグ「薄色背景 + 濃色文字」パターン統一 (§0.41.1 と同方針) ・ 文字白撤廃。

該当 :
- `src/styles.css` の `.tag-dpa`、`.tag-lottery`、`.tag-limited`、`.tag-confirmed`
- 色トークン整理 (用済み white text 削除)

#### 検証 (§0.44 全 14項目)

- 時間帯スコア (#1) : 「日」を冒頭に併記
- 警報を概要に (#2) : 「この日の概要」内に集約
- 天気見出し (#3) : 「天気 (気象庁) / 天気 (Open-Meteo)」+ 晴れアイコン共通
- 雨セル単位アキ (#4) : 1px 詰め
- グラフ分割 (#5) : 降水確率 ・ 風速を 2グラフ ・ 風速緑
- 持ち物天気依存のみ (#6) : 「モバイルバッテリー」「歩きやすい靴」 等を撤廃
- ショー完全並列 (#7) : 色 ・ 太字 ・ 薄色 全部撤廃
- 予約必須重複 (#8) : 1回のみ
- 「開催予想」常時展開 (#9) : toggle 撤廃
- 時刻先 (#10) : 「13:00 ショー名」順
- スカイ両パーク (#11) : TDL/TDS 両方に
- 屋内ショー (#12) : 風バッジ非表示 (該当 5ショー)
- 複数公演レイアウト (#13) : 時刻 1行目 ・ ショー名 2行目
- タグ色 (#14) : 薄水色 (DPA) ・ 薄紫 (抽選) ・ 文字白撤廃

---

### 0.45 タグ色一貫性確保 (期間限定タグの「文字白撤廃」)

公開ページ §0.44 反映後の Yuka さん指示。§0.44.14 で文字白撤廃を全タグに適用したが、期間限定タグだけ「紫 + 白文字」で残ってしまった ・ 「薄色背景 + 濃色文字」原則に揃える。

#### 0.45.1 期間限定タグを薄ピンク + 濃ピンクに

問題 : 期間限定タグが「紫 + 白文字」のまま ・ 他タグ (DPA / 抽選 / 確定情報) と統一感欠如。抽選が既に薄紫なので、期間限定は **別の薄色系** に。

対応 :

| タグ | 背景色 | 文字色 |
|---|---|---|
| 期間限定 (新) | **薄ピンク** `#FCE4EC` | **濃ピンク** `#AD1457` |
| 抽選 (§0.44.14) | 薄紫 `#F3E5F5` | 濃紫 `#6A1B9A` |
| DPA (§0.44.14) | 薄水色 `#E1F5FE` | 濃水色 `#0277BD` |
| 確定情報 | 薄緑 | 濃緑 |
| 通常 (§0.41.1) | 薄緑 | 濃緑 |
| 風バ/雨バ/熱バ | 薄黄 | 濃黄 |
| キャン濃厚 | 薄赤 | 濃赤 |

選定理由 :

- **薄ピンク** = 紫系の隣接色 (抽選の薄紫と区別可)
- 「期間限定 = 季節限定 = 特別感 ・ お祝い」イメージにピンクが合う
- 既存色 (DPA 青 ・ 抽選紫 ・ 確定情報緑 ・ バッジ黄/赤) と被らない
- 「薄色背景 + 濃色文字」原則に統一

該当 :
- `src/styles.css` の `.tag-limited` (or `.tag-seasonal`) 色値
- 色トークン整理

#### 検証 (§0.45)

- 期間限定タグが薄ピンク + 濃ピンク
- 抽選 (薄紫) と視覚区別可能
- 全タグが「薄色背景 + 濃色文字」原則統一
- ヘルプ用語集 ・ FAQ で色マッピング表更新 (必要なら)

---

### 0.46 UI 改善 第7弾 + 文字サイズ機能 (12項目)

公開ページ §0.44/§0.45 反映後の Yuka さん指摘 12項目。スマホ警報未反映 ・ 概要内左寄せ ・ 時間帯スコア拡大 ・ ショー並び順 ・ スマホ雨セル中央 (4度目) ・ 文字サイズ機能新規。

#### 0.46.1 ★ PC + スマホ両方で警報 ・ 注意報を toggle 内に (§0.44.2 完全未実装)

問題 : §0.44.2 で「この日の概要」内に警報を集約する仕様化したが、**PC ・ スマホ両方とも未反映** ・ 警報が「この日の概要」セクションでなくカード外 (toggle 外) に出てる。Yuka さん再確認指摘。

対応 :

- **PC ・ スマホ両方** で警報 ・ 注意報を「この日の概要」内に集約 (§0.44.2 仕様の完全実装)
- カード上 (折りたたみ時) には現状維持 (当日 ・ 翌日は警告必要)
- 詳細展開時に「この日の概要」セクション内にバッジ表示
- 表示例 :
  ```
  ## この日の概要
  [警報] 気象庁 濃霧注意報 (06/10 5:00 発表)
  スコア理由 : 風 6m/s 風バ ・ 雨 40% 中止
  (要確認) : 6日先以降は予報の誤差大きめ
  天気概況 : 霧雨 ・ 最高 17° / 最低 14°
  ```
- PC レイアウト ・ スマホ media query 両方を網羅
- DOM 構造 ・ CSS の両方で「この日の概要」内に来ることを確認

該当 :
- `src/ui/detailPanel.js` (PC + スマホ共通) の「この日の概要」セクションに警報を append
- `src/ui/mobileCard.js` (or 該当) のスマホレイアウト
- `src/styles.css` の警報バッジ配置 (PC 用 + スマホ media query 両方)
- **検証必須 : chrome-devtools MCP で PC 1280px + スマホ 375px 両方で実描画確認**

#### 0.46.2 chevron アイコンに「閉じる」文言併用

問題 : `expand_less` chevron アイコンだけで「閉じる」操作が伝わりづらい。

対応 :

```html
<button class="card-toggle-close">
  <span class="material-symbols-rounded">expand_less</span>
  <span class="label">閉じる</span>
</button>
```

- chevron アイコン + 「閉じる」テキスト併用
- aria-label = "閉じる" (a11y)
- 折りたたみ時は `expand_more` + 「タップで詳細」

該当 : `src/ui/mobileCard.js` (or 該当) のトグルボタン

#### 0.46.3 「この日の概要」内の項目を完全左揃え

問題 : 「この日の概要」内に表示される「スコア理由」「(要確認)」「天気概況」 が中央寄せ or 不揃いに見える (天気概況の前にスペース or padding が違う?)。

対応 :

- セクション内のすべての行を **`text-align: left`** + **同じ左 padding** に統一
- 各項目 :
  ```html
  <div class="summary-row">
    <span class="label">スコア理由 :</span>
    <span class="value">風 6m/s 風バ ・ 雨 40% 中止</span>
  </div>
  <div class="summary-row">
    <span class="label">(要確認) :</span>
    <span class="value">6日先以降は予報の誤差大きめ</span>
  </div>
  ```
- すべてラベル + 値で同じ構造 ・ flex で左揃え

該当 : `src/ui/detailPanel.js` (or 該当) の「この日の概要」セクション + CSS

#### 0.46.4 時間帯スコアのフォント拡大 + 日全体スコアをカード上と同デザインに

問題 :
- 時間帯スコア「朝/昼/夜」の文字 (65点等) が小さい ・ 余白も狭い
- 「日全体」スコアが時間帯と同じスタイルだが、カード上のスコアバッジと別物に見える

対応 :

```
[日全体]
[微妙 65] ← カード上と同じデザインのバッジ (高さ + 太字 + 色)

[時間帯スコア]
朝 9-12時   75 ← フォント 1.2× ・ 余白 1.5×
昼 12-16時  65 (最重視) ← 同上 + 強調
夜 18-21時  60 ← 同上
```

- 「日全体」は **カード上のスコアバッジと同じ DOM ・ CSS** を使い、視覚的に「これがその日の総合」と分かるように
- 時間帯スコアは **font-size 拡大** (例 `1.1rem` → `1.3rem`)、余白 (例 `padding: 4px 8px` → `padding: 8px 16px`) を増やす
- 「最重視」マークも強調 (太字 + 縦線 or 背景)

該当 : `src/ui/detailPanel.js` の時間帯スコア表示 + `src/styles.css`

#### 0.46.5 ショー開催時刻を太字

問題 : 「13:00 ディズニー ・ ハーモニー ・ イン ・ カラー」の時刻部分がショー名と同じ太さで、区別つきにくい。

対応 :

- 時刻 (`hh:mm`) を **太字** (`font-weight: 600`) に
- ショー名 ・ タグは現状維持 (normal weight)
- 等幅フォント (`font-variant-numeric: tabular-nums`) で時刻列揃え

```html
<div class="show-item">
  <span class="show-time">13:00</span>  <!-- 太字 -->
  <span class="show-name">ディズニー ・ ハーモニー ・ イン ・ カラー</span>
  <span class="tag tag-dpa">DPA</span>
</div>
```

```css
.show-time { font-weight: 600; font-variant-numeric: tabular-nums; }
.show-name { font-weight: 400; }
```

該当 : `src/ui/showList.js` の時刻スパン + `src/styles.css`

#### 0.46.6 ハーモニーインカラーから「期間限定」タグ削除

問題 : 「ディズニー ・ ハーモニー ・ イン ・ カラー」は通年演目 ・ 「期間限定」タグ不要。

対応 :

- `src/data/show-thresholds.js` の「ディズニー ・ ハーモニー ・ イン ・ カラー」エントリから `priority: 'high'` or `seasonal: true` を削除
- 他に通年演目誤分類されているショーがあれば併せて確認 :
  - Reach for the Stars : 期間限定?
  - イッツ ・ ア ・ スウィーツフルタイム! : 期間限定 (継続)
  - ジュビレーション : 終了
  - エレクトリカルパレード ・ ドリームライツ : 通年 → タグなし
  - スカイ ・ フル ・ オブ ・ カラーズ : 期間限定?

正式期間限定 (推定):
- イッツ ・ ア ・ スウィーツフルタイム! (4-6月の春パレード)
- Reach for the Stars (期間限定 ・ 公式情報要確認)
- スカイ ・ フル ・ オブ ・ カラーズ (期間限定花火)

該当 : `src/data/show-thresholds.js` の seasonal フラグ見直し

#### 0.46.7 スカイ ・ フル ・ オブ ・ カラーズ TDS の表示位置修正

問題 : シー (TDS) で「スカイ ・ フル ・ オブ ・ カラーズ」が一番上に表示されている ・ 閉園前の花火 (20:30 頃) なのに最上位は不自然 ・ 時刻順なら下のほう (ビリーヴ 19:00 の後) のはず。

対応 :

- ショー並びを **時刻昇順** (現状そのはずだが、何か壊れてる?)
- TDS のショー時刻データ ・ 並びを確認 :
  - 通常 : ハピネス ・ パレード等 13:00 〜 → エントリー受付 → ナイトショー (ビリーヴ 19:00) → スカイ ・ フル ・ オブ ・ カラーズ (20:30) の順
- データ or ソートロジックバグなら修正

該当 : `src/ui/showList.js` のソートロジック + `src/data/schedule/*.json` のデータ

#### 0.46.8 レストラン系 ・ 予約必須を一番下にソート

問題 : ダッフィー & フレンズのワンダフル ・ フレンドシップ (TDS) ・ ミッキーのレインボー ・ ルアウ (TDL) などのショーレストラン (予約必須) が時刻順で中間に出てしまい目立つ ・ 通常パレード ・ ショーと混ざる。

対応 :

ショー並びを **2段階ソート** :
1. メイン順 (時刻昇順) ・ 屋外ショー ・ パレード ・ プロジェクション ・ 屋内ステージ
2. 末尾 (時刻に関わらず) ・ **予約必須レストラン** (`reservation: required`)

```javascript
// src/ui/showList.js
shows.sort((a, b) => {
  if (a.reservationRequired && !b.reservationRequired) return 1;
  if (!a.reservationRequired && b.reservationRequired) return -1;
  return a.time - b.time;
});
```

該当 :
- `src/data/show-thresholds.js` の `reservationRequired: true` フラグ
- `src/ui/showList.js` のソートロジック

#### 0.46.9 ナウキャスト (雨雲レーダー) 文字左寄せ

問題 : 雨雲レーダーセクションの説明文 (例「気象庁の雨雲レーダーを見る」) が中央寄せに見える ・ 他セクションと不揃い。

対応 :

- `text-align: left` に統一
- リンクボタンも左揃え
- 他セクション (時系列 ・ 持ち物 ・ ショー) と同じ pattern

該当 : `src/ui/detailPanel.js` (or 該当) の雨雲レーダーセクション + CSS

#### 0.46.10 ★★★ スマホ雨セル中央配置 (4度目の指摘 ・ 根本修正)

問題 : §0.40.3 ・ §0.41 ・ §0.44 などで再三仕様化したが、まだスマホで雨セルが「左に寄ってる」「熱の右側が空いてる」 ・ Yuka さん 4度目の指摘。

根本原因推測 :
- grid-template-areas で `wind / rain / heat` の各セルに `align-self`、`justify-self` が不一致
- または grid 内 padding の左右非対称
- または 雨セルだけ `text-align` 漏れ
- または `.cell-rain` 内の `.num` / `.unit` の子要素が左寄せ

対応 (根本修正 ・ 4度目の決着) :

```css
/* スマホカード内 grid (横 6カラム想定) */
.mobile-card-metrics {
  display: grid;
  grid-template-columns: 1fr 3fr 2fr;  /* wind / rain / heat */
  align-items: center;
  justify-items: center;             /* 全セル中央揃え */
}

.cell-wind,
.cell-rain,
.cell-heat {
  display: flex;
  flex-direction: column;
  align-items: center;               /* 子要素 (アイコン ・ 数字 ・ バッジ) 中央 */
  justify-content: center;
  text-align: center;
  width: 100%;                        /* セル幅一杯 */
  padding: 0;
  margin: 0;
}

.cell-rain .icon,
.cell-rain .num,
.cell-rain .unit,
.cell-rain .badge {
  display: inline-block;
  margin: 0 auto;                     /* インライン要素も中央 */
}
```

- セル全体 ・ セル内子要素両方を中央寄せ
- grid 内 margin / padding の左右非対称を撲滅
- 開発者ツールで「セルの bounding box の中心 = セル内コンテンツの中心」を確認

検証 (Code が必ず実機 + DevTools で確認):

1. iPhone 14 Pro Max エミュ (430px) で雨セルの left/right padding が等しい
2. 雨セル内のアイコン ・ 数字 ・ バッジが完全中央
3. PC でも崩れない
4. 風 ・ 雨 ・ 熱 すべて視覚的に中央
5. CSS の `text-align: center` が継承されてる (子要素オーバーライドなし)

該当 :
- `src/styles.css` の `.mobile-card-metrics` ・ `.cell-rain` ・ 子要素すべて
- `src/ui/mobileCard.js` の DOM 構造 (centering を阻害してる要素ないか確認)
- **必須 : chrome-devtools MCP で実描画 + コンピューテッドスタイル確認**

#### 0.46.11 スマホ全体フォントサイズ底上げ

問題 : スマホ全体のフォントが小さめ ・ 視認性低い。

対応 :

- スマホ media query (`max-width: 768px`) でルートフォントサイズを **底上げ** :
  ```css
  @media (max-width: 768px) {
    :root {
      font-size: 17px;   /* 旧 14-15px → 17px */
    }
  }
  ```
- 各要素は rem ベースなので全体的に拡大
- 重要箇所 (見出し ・ スコア) は更に拡大 (§0.46.4 と整合)

該当 : `src/styles.css` のスマホ media query

#### 0.46.12 ★ 新機能 : 文字サイズ変更オプション (老眼配慮)

問題 : Yuka さんお母様 (老眼) のため、ユーザーが文字サイズを変更できる機能が欲しい。

対応 :

**3段階切替 ・ 現状を「小」基準に 2段階上げる**

```
ヘッダーに「文字サイズ」ボタン (or 設定アイコン)
↓
ドロップダウン or トグル :
  [小 (デフォルト)] [中] [大]
↓
ルート font-size を変更 :
  小 (デフォルト) : 現状サイズ
  中 : +1段階 (約 1.15×)
  大 : +2段階 (約 1.3×)
```

実装 :

```javascript
// src/ui/settings.js (新規)
function setFontSize(size /* 'small' | 'medium' | 'large' */) {
  document.documentElement.dataset.fontSize = size;
  localStorage.setItem('fontSize', size);
}

// 起動時に復元 (未設定なら 'small' = 現状)
const saved = localStorage.getItem('fontSize') || 'small';
setFontSize(saved);
```

```css
:root { font-size: 16px; }   /* デフォルト = 小 */

:root[data-font-size='small']  { font-size: 16px; }  /* 現状 */
:root[data-font-size='medium'] { font-size: 18px; }  /* +1段階 */
:root[data-font-size='large']  { font-size: 21px; }  /* +2段階 (老眼向け) */

@media (max-width: 768px) {
  :root[data-font-size='small']  { font-size: 17px; }  /* スマホ底上げ (§0.46.11) */
  :root[data-font-size='medium'] { font-size: 19px; }
  :root[data-font-size='large']  { font-size: 22px; }
}
```

**重要な変更点** :
- 「小」がデフォルト (現状サイズ)
- 「中」「大」は「上げる」方向のみ (下げる選択肢なし)
- 老眼配慮で「大」は思い切って 1.3× (21px)

UI :
- ヘッダー右上 (ヘルプアイコンの隣) に「文字サイズ」アイコン (`text_increase` Material Symbol)
- タップで小モーダル or ドロップダウン
- 3つのボタン「小 / 中 / 大」・ 現在選択中をハイライト
- ヘルプ用語集に「文字サイズ変更について」追加

該当 :
- `src/ui/settings.js` (新規)
- `src/styles.css` の `:root[data-font-size]` セレクタ
- `src/index.html` の `<head>` に initialize script
- ヘッダー UI (`src/ui/header.js` or 該当)

#### 検証 (§0.46 全 12項目)

- PC + スマホ警報 (#1) : 両方とも「この日の概要」内に警報集約 (§0.44.2 完全実装)
- chevron + 「閉じる」 (#2) : アイコン + テキスト併用
- 概要内左揃え (#3) : スコア理由 ・ (要確認) ・ 天気概況 すべて左揃え
- 時間帯スコア拡大 (#4) : フォント 1.2× ・ 余白 1.5× ・ 日全体はカード上と同デザイン
- ショー時刻太字 (#5) : 時刻のみ font-weight: 600
- ハーモニータグ削除 (#6) : 期間限定タグ消失
- スカイ並び (#7) : 時刻順で適切な位置 (ビリーヴの下)
- レストラン末尾 (#8) : 予約必須は一番下
- ナウキャスト左寄せ (#9) : text-align: left
- ★★★ 雨セル中央 (#10) : スマホで完全中央 ・ DevTools で bounding box 確認
- スマホ全体フォント (#11) : ルート 17px ・ 全体的に拡大
- 文字サイズ変更 (#12) : 3段階切替 (小=現状 / 中=+1段階 / 大=+2段階 老眼向け) ・ localStorage 保存 ・ ヘッダーボタン

---

### 0.47 ★ スコア過剰減点バグ修正 (日全体バッジの閾値見直し)

公開ページ §0.46 反映後の Yuka さん指摘 ・ 14日間で「OK」「ベスト」が 1日もなく「微妙」「別日」のみ。**スコアロジックの過剰減点バグ** ・ 信頼性問題。

#### 0.47.1 ★ 日全体バッジの閾値を一般ショー基準に (ハーモニー特例を除外)

問題 : 公開ページ 14日分の実データ :

| 日 | 風 | スコア | 風バッジ |
|---|---|---|---|
| 6/4 (木) | **6m/s** | 微妙 65 | **風バ** ← 過剰判定 |
| 6/5 (金) | **7m/s** | 微妙 65 | **風バ** ← 過剰判定 |

**原因** : 日全体の「風バ」バッジ判定が、最も厳しいショー (ハーモニーインカラー = 6m/s から風バ可能性) の閾値を基準にしている ・ 結果 6m/s 出ただけで日全体「風バ」 → 9割の日がそうなる ・ スコアも floor guard で下げられる。

実際は :
- 6-7m/s は一般的な風速 ・ 屋外ショーの大半は普通に開催される (主流閾値 8-10m/s)
- ハーモニーだけが特に厳しい (花火 ・ ドローン使用で 6m/s で中止)

対応 :

**日全体バッジ判定を「一般ショー閾値」に変更** ・ ハーモニー特例は **詳細パネルのみ** で表示。

| バッジレベル | 旧閾値 (ハーモニー基準) | **新閾値 (一般ショー基準)** |
|---|---|---|
| 通常 | < 6 m/s | **< 8 m/s** |
| 風バ可能性 | 6 - 9 m/s | **8 - 11 m/s** |
| 風キャン濃厚 | 9 - 11 m/s | **11 - 13 m/s** |
| ほぼ中止 | ≥ 12 m/s | **≥ 13 m/s** |

ショー個別バッジ (詳細パネル内 ・ §0.44.7 の per-show 風 ・ 突風) :

- ハーモニー : 6m/s で「風バ可能性 ・ ハーモニー」と固有名併記 (日全体バッジには影響しない)
- 他ショー : 個別閾値で判定 ・ 詳細パネルで「○○は風キャン濃厚」と表示

#### 0.47.2 スコア減点係数の緩和

問題 : 過剰減点の二次的要因 ・ 風 ・ 雨 ・ 熱の減点が大きすぎ。

対応 :

| 要素 | 値 | 旧減点 (推定) | 新減点 |
|---|---|---|---|
| 風 | 6 m/s | -10 ~ -15 | **-5** |
| 風 | 8 m/s | -25 ~ -35 | **-15** |
| 風 | 10 m/s | -50 ~ -65 | **-30** |
| 風 | 12 m/s | -80 ~ -95 | **-50** |
| 雨 | 30% | -10 | -5 |
| 雨 | 50% | -25 | -15 |
| 雨 | 70% | -50 | -35 |
| 雨 | 90% | -80 | -65 |

期待される結果 :
- 6m/s + 雨 13% = -5 + -5 = -10 → スコア 90 (現状 65)
- 一般的な日 (風 5m/s + 雨 30%) = -0 + -5 = -5 → スコア 95
- 14日中、ベスト ・ OK が出るようになる

#### 0.47.3 バッジ floor guard (§0.16) の緩和

問題 : §0.16 のバッジ floor guard で「風バ」が出るとスコアが強制的に低い値 (25 or 50) にクランプされてる。

対応 :

| バッジ | 旧 floor | 新 floor |
|---|---|---|
| 通常 | なし | なし |
| 風バ可能性 | 50 | **70** (緩和) |
| 風キャン濃厚 | 25 | **40** (緩和) |
| ほぼ中止 | 10 | **20** (緩和) |
| (中止) | 0 | 0 |

#### 0.47.4 表示確認 + テスト

検証 :

- 14日分のスコア分布を確認 ・ ベスト/OK/微妙/別日 が **バランスよく出る** (例 ベスト 2 ・ OK 4 ・ 微妙 5 ・ 別日 3)
- 風 6m/s で「風バ」バッジが日全体に出ない (ショー個別のみ)
- 風 18m/s では「ほぼ中止」が出る (6/3 のような日)
- スコアテスト更新 (Vitest)

データ取得バグも確認 :
- 6/3 (水) : 風 18m/s ・ 雨 75% ・ バッジ「通常」表示 → 表示バグ? 取得バグ? Code が調査して修正

該当 :
- `src/score/scoring.js` の閾値 + 減点係数
- `src/score/badges.js` (or 該当) の判定閾値
- `src/score/floorGuard.js` (or 該当) の floor 値
- ショー固有閾値は `src/data/show-thresholds.js` で維持 (詳細パネル用)
- Vitest テスト更新 + 14日 dist preview 確認

#### 検証 (§0.47 全 4項目)

- バッジ閾値 (#1) : 風 6m/s で日全体バッジが「通常」(風バ ではない)
- 減点係数 (#2) : 14日中 ベスト ・ OK が出る (バランス)
- floor guard (#3) : 風バでも 70 floor (微妙 ではなく OK)
- 表示確認 (#4) : 6/3 のような風 18m/s 日は「ほぼ中止」+ 別日 0 がちゃんと出る

---

### 0.39 機能拡張 第3弾 (実用性 ・ データ精度 ・ 運用自動化 ・ a11y/perf)

公開ページの仕上げ後の発展機能。実用性 4 ・ データ精度 3 ・ 運用 2 ・ a11y/perf 2 の計 11項目。共有/操作性カテゴリは Yuka さん判断で見送り。

#### 実用性

#### 0.39.1 当日朝の予報変更マーク (前日比 ↑↓)

問題 : 昨日見たときと当日朝で予報が変わってる場合、ユーザーは気付かない。

対応 :

- `src/data/forecast-snapshots/` に毎朝の予報を保存 (既存 §0.32 ベース)
- 当日表示時に **24時間前のスナップショット** とスコア差分を比較
- カードに 「↑ +10 (改善)」 「↓ -15 (悪化)」 マーク表示
- 詳細パネルに「予報変更履歴」(直近 7日のスコア推移ミニグラフ)

UI :
```
6/4 (木) 微妙 65 ↓-10 (前日比)
```

該当 :
- `src/score/scoring.js` の差分計算
- `src/ui/table.js` の差分バッジ表示
- `src/ui/detailPanel.js` の予報変更履歴

#### 0.39.2 熱中症警戒アラート取り込み

問題 : 環境省が発表する「熱中症警戒アラート」(WBGT ≥ 33 予測時) を独立した警告として表示すべき。

対応 :

- 環境省 API : <https://www.wbgt.env.go.jp/alert.php> (アラート発令日)
- アラート発令日のカードに **「⚠ 熱中症警戒アラート発令中」** バナー表示
- スコアに自動で「ほぼ中止」マーク
- ヘルプ用語集にアラート定義追加

該当 :
- `workers/wbgt-proxy.js` (or 別 worker) でアラート取得
- `src/data/heatAlerts.js` (or 該当) でロード
- `src/ui/table.js` のカード警告バナー

#### 0.39.3 気象庁の警報 ・ 注意報 (大雨 ・ 強風)

問題 : 気象庁の「大雨警報」「強風注意報」等は予報数値以上に重要 ・ 当日 ・ 翌日の判断材料。

対応 :

- 気象庁 API : <https://www.jma.go.jp/bosai/warning/> (警報 ・ 注意報 JSON)
- 千葉県浦安市の警報 ・ 注意報を取得
- 当日 ・ 翌日のカードに警告バッジ表示 :
  - 大雨警報 / 注意報
  - 強風注意報
  - 雷注意報
  - 暴風警報
- 警報級は赤 ・ 注意報級は黄
- 警報級は自動で「別日」マーク

該当 :
- `src/api/jma.js` の警報取得関数追加
- `src/ui/table.js` の警告バッジ

#### 0.39.4 アトラクション運休予測

問題 : 強風で BBB (ビッグサンダーマウンテン) ・ レイジングスピリッツ ・ ストームライダー等の屋外コースターが運休することがある ・ ショー以外の楽しみが減るので別軸の判断材料。

対応 :

- アトラクション別運休閾値テーブル (`src/data/attraction-thresholds.js`):
  ```javascript
  export const ATTRACTION_THRESHOLDS = {
    'BBB': { park: 'TDL', windCutoff: 15, type: 'roller-coaster' },
    'レイジングスピリッツ': { park: 'TDS', windCutoff: 13, type: 'roller-coaster' },
    'ジェットコースター系全般': { ... }
  };
  ```
- 詳細パネル内に新タブ「アトラクション運休予測」(or ショー横に追加)
- 当該風速でカット予測される運休一覧
- 過去運休実績データがあれば併記 (なくても予測ベースで可)

該当 :
- `src/data/attraction-thresholds.js` (新規)
- `src/score/attractionForecast.js` (新規)
- `src/ui/detailPanel.js` に新セクション

#### データ精度

#### 0.39.5 予報ソース重み付け (気象庁 vs Open-Meteo の bias 学習)

問題 : 気象庁 ・ Open-Meteo は同じ天気でも値が異なる ・ どちらを信じるべきか不明。過去蓄積で精度比較できる。

対応 :

- `src/data/accuracy-log.json` (Phase 3 §0.32) に蓄積した予報 vs 実測の差を分析
- 各ソース ・ 各要素 (風 ・ 雨 ・ 気温) の平均誤差 (MAE) を計算
- 誤差小さい方を優先 ・ 重み付き平均で総合スコアを更新
- 精度ダッシュボードに weight 表示

該当 :
- `src/score/scoring.js` の weighted average ロジック
- `src/score/sourceWeight.js` (新規) で bias 計算
- 精度ダッシュボード (Phase 3 §0.32) に「ソース重み」可視化

#### 0.39.6 TDL vs TDS の気象差 (場所別補正)

問題 : 現状単一の予報を両パークに適用しているが、TDS は海側で風が強い傾向 ・ TDL は内陸寄りで雨雲分布が異なる場合あり。

対応 :

- Open-Meteo の座標を **TDL : 35.6329, 139.8804** / **TDS : 35.6267, 139.8851** で別取得
- (距離 500m 程度なので差は小さいが、海風で 1-2m/s 違うことあり)
- 詳細パネルのパーク切替時にスコアも再計算
- 計算コスト増 → デフォルトはまとめ、詳細時のみ別取得

該当 :
- `src/api/openMeteo.js` の座標切替
- `src/score/scoring.js` のパーク別スコア
- `src/ui/detailPanel.js` のパークタブ切替時の再計算

#### 0.39.7 季節限定ショーの自動期間管理

問題 : 季節限定ショー (ハーモニーインカラー ・ ジュビレーション等) を `show-thresholds.js` に登録してるが、終了後も表示候補に残ってしまう。

対応 :

- `show-thresholds.js` に `period` フィールド追加 :
  ```javascript
  'ハーモニーインカラー': {
    park: 'TDL',
    period: ['2026-04-15', '2026-06-30'],  // 開始 - 終了
    windCutoff: 12,
    priority: 'high'
  }
  ```
- ショースケジュール JSON 読み込み時、`period` 外なら自動除外
- 期間情報は公式発表をもとに Yuka さんが手動更新 (or Cowork で取得)

該当 :
- `src/data/show-thresholds.js` の data 構造拡張
- `src/data/scheduleLoader.js` の期間フィルター

#### 運用 ・ 自動化

#### 0.39.8 GitHub Actions cron で自動化

問題 : `snapshot-forecast` ・ `track-accuracy` ・ 月初ショースケジュール取得を Yuka さんが毎朝手動実行している。

対応 :

- `.github/workflows/daily-snapshot.yml` (毎朝 7:00 JST):
  ```yaml
  on:
    schedule:
      - cron: '0 22 * * *'  # UTC 22:00 = JST 7:00
  jobs:
    snapshot:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - run: npm install
        - run: npm run snapshot-forecast
        - run: npm run track-accuracy
        - uses: stefanzweifel/git-auto-commit-action@v5
  ```
- `monthly-schedule.yml` (毎月 10日 ・ 翌月分取得):
  - Akamai bot 検知でブロックされる場合は Cowork 経由のままにする (cron はリトライのみ)
- secrets で API key 等管理

該当 :
- `.github/workflows/daily-snapshot.yml` 新規
- `.github/workflows/monthly-schedule.yml` 新規
- `package.json` の `scripts` 整理

#### 0.39.9 新月分ショースケジュール取得通知

問題 : 公式が翌月分を公開しても、Yuka さんは気付かず古いまま運用される可能性。

対応 :

- 月初 cron で「翌月分の取得を試行」→ Akamai でブロックされたら Slack / メール通知
- 取得成功 → commit + push 自動
- 失敗 → Yuka さん宛にメール (or Cowork に通知して手動取得依頼)

該当 :
- §0.39.8 の `monthly-schedule.yml` に通知ステップ追加
- Slack webhook or email 設定

#### アクセシビリティ ・ パフォーマンス

#### 0.39.10 色覚多様性対応

問題 : スコア色 (赤 ・ 黄 ・ 緑) のみで判別している箇所が、赤緑色覚多様性の人には区別困難。

対応 :

- スコアバッジ ・ 風 / 雨 / 熱バッジに **アイコン併用** (既に一部実装済):
  - ベスト : `check_circle`
  - OK : `check`
  - 微妙 : `warning`
  - 別日 : `block` (or `cancel`)
- カードの背景色帯ではなく **左端 4px 縦線** + アイコンで重複表現
- 色だけに依存しない設計テスト (Chrome DevTools の vision deficiency simulator で検証)

該当 :
- `src/ui/table.js` の score badge にアイコン追加 (既存箇所は維持)
- `src/styles.css` のカード左端 indicator

#### 0.39.11 Lighthouse 90+ (パフォーマンス最適化)

問題 : Vite + Chart.js + 大量 JSON でビルドサイズが大きく、初回読み込みが遅い可能性。

対応 :

- **Chart.js を動的 import** : 詳細パネル展開時のみロード
- **Critical CSS インライン化** : Above-the-fold だけ inline、残りは link rel=preload
- **font を遅延ロード** : フォールバックフォントで初回 paint、メインフォント後追い
- **Image optimization** : OG image を WebP、faviconは SVG (現状 OK?)
- **Service Worker キャッシュ** : 既存 PWA 化 (§0.34) で manifest はあるが SW 未実装ならキャッシュ戦略追加
- **JSON 分割** : `cancel-history/` の大きい月を遅延ロード
- 目標 : Lighthouse PWA + Performance + Accessibility + Best Practices + SEO すべて 90+

該当 :
- `vite.config.js` の rollup options (manualChunks)
- `src/index.html` の critical CSS インライン
- `src/main.js` の Chart.js dynamic import
- `service-worker.js` (新規) の cache strategy

#### 検証 (§0.39 全 11項目)

- 予報変更マーク (#1) : 24時間前との差分でカードに ↑↓ 表示
- 熱中症警戒アラート (#2) : 環境省 API 発令日にバナー
- 気象庁警報 (#3) : 当日 ・ 翌日の警報 ・ 注意報バッジ
- アトラクション運休予測 (#4) : 詳細パネル新タブ ・ 風速別の運休一覧
- ソース重み付け (#5) : accuracy-log から MAE 計算 ・ weight 反映
- パーク別補正 (#6) : TDL/TDS 別座標 ・ 詳細時のみ別取得
- ショー期間管理 (#7) : period 期間外は自動除外
- 毎朝 cron (#8) : GitHub Actions で snapshot ・ track-accuracy
- 月初通知 (#9) : 翌月分取得失敗で通知
- 色覚多様性 (#10) : 色 + アイコン + 線 で重複表現
- Lighthouse 90+ (#11) : 全カテゴリ 90+

---

### 0.7 公開ページ化 (Cloudflare Pages) ＋ ランタイム判定

Yuka さん要望 : 「Mac 開いてなくても他の人も見れる公開ページ」

#### 方針 (確定)

- ホスティング : **Cloudflare Pages** (将来の Workers 連携シナジー優先)
- 配布形態 : **Cowork artifact (個人用) ＋ Cloudflare Pages (公開閲覧用) の2系統並行**
- 同じ `dist/artifact.html` を両方に置く
- Notion / GCal 連携は **Cowork 版でのみ** 有効 (公開ページは閲覧専用)

#### 実装 : ランタイム判定でボタン出し分け

```js
const isCoworkRuntime = typeof window !== 'undefined' && typeof window.cowork === 'object';
```

- `isCoworkRuntime === true` : Notion 送信ボタン ・ GCal 登録ボタン ・ ハンバーガーメニュー内の関連項目を **表示**
- `isCoworkRuntime === false` : 上記を **非表示**、disclaimer に「個人連携機能は Cowork 版でのみ動作」を1行追記

該当ファイル :

- `src/utils/runtime.js` 新規 : `isCowork(): boolean` をエクスポート
- `src/ui/header.js` ・ `src/ui/menu.js` でボタン表示制御
- `src/integrations/notion.js` ・ `src/integrations/gcal.js` の関数を呼ぶ前に `isCowork()` チェック

#### GitHub ・ Cloudflare Pages 連携

1. GitHub repo `yukasasaki/disney-weather` (個人 ・ public) を作成 ・ push
2. Cloudflare Pages ダッシュボードで GitHub 連携
   - Build command : `npm run build`
   - Output directory : `dist`
   - Production branch : `main`
3. 自動デプロイ完了で `https://disney-weather.pages.dev` が発行
4. 同行者に URL 共有

#### 注意点

- リポジトリは **public** にする (Cloudflare Pages の無料プランは public 推奨、private でも可だが認証連携が必要)
- README に「Notion / GCal 連携機能は Cowork ランタイムでのみ動作」と明記
- 公開版で誤って Cowork コネクタを呼ばないよう、SSR 環境想定外の `window.cowork` アクセスはガードする

詳細仕様 : §13 デプロイ ・ 配布。

### 0.8 スコア記号の図形 (■ ▲ ●) を廃止

Yuka さん指摘 : 「■×0」が何の意味か分かりにくい。

旧 : ◎ → 緑 ＋ ● / ○ → 薄緑 ＋ ● / △ → 黄 ＋ ▲ / × → 赤 ＋ ■
新 : ◎○△× の **文字 ＋ 色 ＋ 数値 ＋ 補助アイコン** の4重表現

| 記号 | 補助アイコン (Material Symbols) |
|---|---|
| ◎ | `check_circle` |
| ○ | `check` |
| △ | `warning` |
| × | `block` |

セル表記 : `(check_circle) ◎ 92` (アイコン → 記号 → 数値)。

影響ファイル :

- `src/ui/table.js` のセルレンダラから ■ ▲ ● を削除、Material Symbols 描画に差し替え
- `src/styles.css` の `.score-x` クラスから図形周りの装飾を削除
- ARIA ラベルは `aria-label="◯月◯日 スコアXX ◯記号意味"` 形式を維持

---

## 1. Breaking (コード書き換え必要)

### 1.1 スコア式の刷新

旧 : `総合スコア = 100 - (風減点 ＋ 雨減点 ＋ 気温減点)`
新 : `総合スコア = 100 - (風減点 ＋ 雨減点 ＋ 熱中症減点 ＋ 寒さ減点 ＋ UV減点)`

変更点 :

- 「気温減点」を **熱中症減点 (WBGT ベース)** と **寒さ減点** の2つに分離
- **UV減点** を新規追加
- 風減点 ・ 雨減点 ・ 熱中症減点はすべて「ショー時刻 ±1h ウィンドウ値」を優先使用
- TDS のみ風減点 ×1.2 (ハーバーショー対応)

熱中症減点 (新規) :

```
wbgt < 25       → 0
25 ≦ wbgt < 28  → 10  (警戒)
28 ≦ wbgt < 31  → 30  (厳重警戒 ・ 熱バ域)
31 ≦ wbgt < 33  → 60  (危険 ・ 熱キャン域)
wbgt ≧ 33       → 90  (極めて危険)
＋ feels_like_max ≧ 35 なら ＋10
－ wind_show_window ≧ 5m/s なら -5 (風で緩和)
```

寒さ減点 (新規) :

```
feels_like_max ≧ 10 → 0
5 ≦ feels_like_max < 10 → 10
feels_like_max < 5      → 25
```

UV減点 (新規) :

```
uv_max < 8  → 0
8 ≦ uv_max < 11 → 5
uv_max ≧ 11 → 10
```

`src/score/scoring.js` の修正必須。境界値テストも `tests/scoring.test.js` を更新。

### 1.2 ショースケジュールが priority 付きに

旧 : 全ショー時刻を一律に「ショー時刻ウィンドウ」として使用
新 : 各ショーに `priority: 'high' | 'medium' | 'low'` を付け、`high` のみメインスコア算定窓に使う

Yuka さん要望 :

- **昼の季節限定パレード = high (最重要)** 例 : ハーモニー ・ イン ・ カラー、イッツ ・ ア ・ スウィーツフルタイム!、Reach for the Stars
- 屋内 ・ エントリー受付対象 = medium 例 : ジャンボリミッキー!
- **夜のパレード ・ 花火 = low (通年で常に同じ、気にしない)** 例 : エレクトリカルパレード ・ ドリームライツ、スカイ ・ フル ・ オブ ・ カラーズ

`src/data/showSchedule.js` のスキーマ変更 ＋ `src/data/showPriority.js` を新設。

時間帯サブスコアの重み変更 :

- 朝 (9-12) : 0.5
- 昼 (12-16) : 2.0 ← 最重要
- 夜 (18-21) : 0.3

### 1.3 データ構造に WBGT 系を追加

`DailyForecast` interface に追加 :

```ts
wbgtMax: number | null;
wbgtSource: 'env-jp' | 'derived' | null;
```

`HourlyPoint` に追加 :

```ts
humidity: number | null;  // WBGT 計算用
wbgt: number | null;
```

全 fetch モジュール (`jma.js` `openMeteo.js` `openWeather.js`) の正規化で `humidity` を埋める必要あり (Open-Meteo の `relative_humidity_2m` 等)。

### 1.4 観測地点コードを細分化

旧 : 気象庁 `120000` (千葉県全体) のみ
新 :

| 用途 | コード |
|---|---|
| 予報 | `120010` (千葉県北西部) |
| 観測 (アメダス) | `44132` (船橋) ＋ `44166` (千葉) |
| WBGT | `44132` (船橋) ＋ 東京 (大手町) |

`src/config/location.js` を新設し、全 fetch モジュールから参照させる。

---

## 2. 機能追加 (Non-Breaking、新規実装)

### 2.1 環境省 WBGT データソース追加

`src/data/envWbgt.js` を新規作成。

- URL : `https://www.wbgt.env.go.jp/data_service.php` 配下 (CSV)
- 観測地点 : 船橋 (`44132`)
- 取得項目 : 3時間刻みの WBGT 予測値
- 期間 : 4 - 10月のみ提供 → 期間外は呼ばない
- フォールバック : 取得失敗時は `src/score/wbgt.js` の簡易計算 (`WBGT ≒ 0.567×T + 0.393×e + 3.94`) を使用

### 2.2 熱キャン / 雨キャン バッジ追加

風キャンバッジに加えて、雨キャン ・ 熱キャン の2バッジを並列表示 (§5.5 / §5.6) :

雨バッジ :

```
pop < 30                      → "雨なし"
30 ≦ pop < 60 かつ precip < 1 → "雨バ可能性"
60 ≦ pop or precip ≧ 1mm/h    → "雨キャン濃厚"
precip ≧ 2mm/h                → "ほぼ中止"
```

熱バッジ :

```
wbgt < 25  → "通常運行"
25 ≦ wbgt < 28 → "暑さ注意"
28 ≦ wbgt < 31 → "熱バ可能性あり"
31 ≦ wbgt < 33 → "熱キャン濃厚"
wbgt ≧ 33      → "ほぼ中止"
```

`src/ui/table.js` のバッジ列を3つに増やす。

### 2.3 公式ショースケジュール自動取得 (Phase 2)

確認済み URL :

- TDL : `https://www.tokyodisneyresort.jp/tdl/daily/calendar/{YYYYMMDD}/`
- TDS : `https://www.tokyodisneyresort.jp/tds/daily/calendar/{YYYYMMDD}/`

ただし SPA でクライアントレンダリング (生 HTML fetch は空)。3段戦略 :

1. **検証 (最優先)** : Network タブで内部 API (`/api/calendar/...`) を探す → 見つかれば直接 fetch
2. 内部 API がなければ Cloudflare Workers + Browser Rendering で日次バッチ取得 ・ R2 / KV 保存
3. フォールバック : `src/data/showSchedule.js` の固定 JSON ＋ 手動メンテ

実データ例 (TDL 2026/6/4) から取れる項目 : 開園 / 閉園時刻、パレード ・ ショー名 ・ 時刻 ・ 属性 (プレミアアクセス / エントリー受付 / 予約必須)、キャラグリ、休止情報。

### 2.4 Phase 1 で追加する画面 ・ 機能

- **観測地点細分化** (§3.13) ← Breaking 1.4 と連動
- **データ鮮度ラベル** (§3.14) : 各セルに「最終更新 ◯分前」 ＋ ツールチップで API 更新サイクル
- **disclaimer** (§3.15) : 「本ツールは公開予報からの推定であり公式ではない」をフッター固定
- **用語集 / ヘルプモーダル** (§3.16) : 風バ / 熱バ / キャングリ 等の解説
- **印刷モード** (§3.17 / §6.9) : `@media print` で A4 1枚に当日サマリ
- **雨雲レーダー** (§3.18) : JMA ナウキャストを当日 ・ 前日のみ iframe 埋め込み
- **自動通知 (scheduled task)** (§3.19) : 決定日に対し 3日前 21:00 / 前日 18:00 / 当日 6:30 の3段階 Slack 通知
- **ダークモード** (§6.6) : OS追従＋手動切替
- **自動バックグラウンド更新** (§6.7) : 60秒ごとの silent reload (非アクティブ時停止)
- **PWA 対応** (§6.8) : manifest.json ＋ SW
- **ブラウザ互換チェックリスト** (§6.10) : iOS Safari / Android Chrome / Edge / 200% ズーム / VoiceOver

### 2.5 Phase 2 機能 (運用しながら)

- **TDR 公式運営状況取得** (§3.20) : `/info/operation.html` を 1日3回 ・ 中止フラグを Notion 蓄積
- **混雑予想連携** (§3.21) : 待ち時間予想と天気スコアの合成スコア
- **Claude AI サマリ ・ 質問応答** (§3.22) : `window.cowork.askClaude` 経由
- **同行者投票** (§3.23) : Notion DB リアクション集計
- **的中追跡ダッシュボード** (§3.12) : 別 artifact

### 2.6 テスト体制の追加

- **msw** : `tests/mocks/handlers.js` 全外部 API モック → オフラインでもテスト可
- **Playwright E2E** : `tests/e2e/` にハッピーパス、スクリーンショット差分テスト
- **axe-core** : E2E にアクセシビリティ自動チェック
- カバレッジ目標 : スコアロジック ≧95%、データ層 ≧80%

---

## 3. ディレクトリ追加分

新規作成が必要なファイル :

```
src/
├── service-worker.js        # PWA (§6.8)
├── manifest.json
├── config/
│   └── location.js          # 観測地点 (Breaking 1.4)
├── data/
│   ├── jmaNowcast.js        # 雨雲レーダー (§3.18)
│   ├── envWbgt.js           # 環境省 WBGT (§4.4)
│   ├── tdrOperation.js      # TDR 公式運営 (§3.20)
│   ├── crowd.js             # 混雑予想 (§3.21)
│   ├── showSchedule.js      # 公式ショースケジュール fetch ＋ フォールバック
│   └── showPriority.js      # ショー名 → priority マッピング (Breaking 1.2)
├── score/
│   └── wbgt.js              # WBGT 簡易計算 (§3.11)
├── ui/
│   ├── help.js              # 用語集モーダル (§3.16)
│   ├── vote.js              # 同行者投票 (§3.23)
│   ├── aiSummary.js         # AI サマリ (§3.22)
│   ├── nowcast.js           # 雨雲レーダー埋め込み (§3.18)
│   ├── print.js             # 印刷モード制御
│   └── theme.js             # ダークモード (§6.6)
├── integrations/
│   ├── slack.js             # Slack 通知 (§3.19)
│   └── scheduler.js         # scheduled task 登録 (§3.19)
└── utils/
    ├── units.js             # m/s, ℃ 単位統一
    └── freshness.js         # 鮮度ラベル算出 (§3.14)

tests/
├── mocks/handlers.js
├── e2e/
└── wbgt.test.js

workers/
└── tdr-scraper.js           # Browser Rendering バッチ (§3.10 ・ §3.20)
```

---

## 4. 既存ファイルへの追加修正

| 既存ファイル | 修正内容 |
|---|---|
| `src/score/scoring.js` | スコア式刷新 (Breaking 1.1) |
| `src/data/jma.js` | エリアコードを `120010` に、観測値取得を追加 |
| `src/data/openMeteo.js` | `relative_humidity_2m` `uv_index` を fetch 項目に追加 |
| `src/data/openWeather.js` | `uvi` `humidity` を正規化対象に追加 |
| `src/ui/table.js` | バッジ列を3つに (風 / 雨 / 熱)、鮮度ラベル ・ priority サブスコア表示 |
| `src/ui/chart.js` | 縦線でショー時刻ハイライト、WBGT 折れ線追加 |
| `src/ui/outfit.js` | UV指数 ・ 湿度に応じた提案を追加 |
| `src/integrations/notion.js` | DB プロパティに「ショー時刻スコア」「投票リアクション」追加 |
| `src/integrations/gcal.js` | 説明欄に当日 WBGT を含める |
| `tests/scoring.test.js` | WBGT 境界値テスト追加 |
| `.env.example` | (追加なし、Notion / GCal は MCP 経由) |
| `README.md` | スクレイピング非採用ポリシー ・ 出典明記 ・ ショー時刻更新フロー追加 |
| `CHANGELOG.md` | 新規作成 |

---

## 5. リスクと運用 (要 README 反映)

新たに明文化したリスク :

- WBGT 簡易計算の誤差 (±1.5℃ 許容、環境省取得を最優先)
- 環境省 WBGT は4 - 10月のみ提供 → 期間外は簡易計算
- TDR 公式ページの規約遵守 (User-Agent 明示 ・ 1日数回 ・ robots.txt)
- ナウキャスト iframe の CSP → 失敗時は「公式ページを開く」リンクへ
- Service Worker キャッシュの古さ問題 → バージョン文字列で強制更新
- Cowork artifact API レート制限 → askClaude / Notion 失敗時は静かに非表示
- 同行者 Notion 同時編集衝突 → last-write-wins ＋ コメント追記
- 単位ミス (m/s ↔ km/h、℃ ↔ ℉) → `src/utils/units.js` で内部単位統一

運用フロー :

- CHANGELOG.md セマンティックバージョニング
- ショー時刻データは月初に Yuka さんが priority 確認 (新規ショー追加時)
- 古い localStorage キーは1週間 grace period でマイグレーション

---

## 6. 受け入れ基準 (DoD) 追加分

Phase 1 完了時に以下が満たされていること (既存 DoD に追加) :

- [ ] 風キャン / 雨キャン / 熱キャン の3バッジが出る
- [ ] WBGT が表示される (環境省取得 or 簡易計算、ソース区別)
- [ ] データ鮮度ラベル「最終更新 ◯分前」が全セルに出る
- [ ] disclaimer が常時表示
- [ ] 用語集モーダルが開ける
- [ ] 印刷モードが機能する
- [ ] 雨雲レーダーが当日 ・ 前日のみ表示
- [ ] 決定日に対し 3日前 / 前日 / 当日朝 の scheduled task が登録される
- [ ] ダークモード切替が機能する (OS 連動 ＋ 手動)
- [ ] PWA としてホーム画面追加できる
- [ ] msw モックでオフラインでも全画面動作
- [ ] Playwright E2E ハッピーパスが CI で通る
- [ ] iOS Safari / Android Chrome / macOS Safari / Edge で表示崩れ0
- [ ] 200% ズームで崩れ0
- [ ] VoiceOver で主要要素が読み上げられる

---

## 7. 進め方の提案

優先順位順に対応をすすめると効率的です :

1. **即対応** : Breaking (1.1 ・ 1.2 ・ 1.3 ・ 1.4) → 既存コードを直さないと整合が崩れる
2. **Phase 1 仕上げ** : §2.1 - §2.4、§3 ディレクトリ追加、§6 DoD 追加分
3. **Phase 2 切り出し** : §2.5、§2.3 の公式ショースケジュール自動化 → 別 PR で
4. **継続** : §2.6 テスト、§5 README ・ CHANGELOG 反映

詳細は最新仕様書 `disney-weather-spec.md` の各 §セクションを参照してください。

---

## 8. 不明点があれば確認したいこと

- 既存実装で Phase 0 のどこまで進んでる? → 既に WBGT 関連を入れてしまった部分があれば調整したい
- ショースケジュールの内部 API 探索は誰がやる? (Yuka さん環境のブラウザで Network タブを見てもらうのが一番早い)
- Cloudflare Workers のセットアップ可否 (アカウント有 / 無)
