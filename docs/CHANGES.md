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
