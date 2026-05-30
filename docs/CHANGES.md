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
