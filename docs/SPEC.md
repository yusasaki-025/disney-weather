# ディズニー行く日決め weather 比較ダッシュボード 仕様書

最終更新 : 2026/05/30
依頼者 : Yuka (komorebi-inc)
実装担当 : Claude Code
リポジトリ予定 : `komorebi-tools/disney-weather`

---

## 1. 目的とゴール

TDL･TDS に行く日を決めるために、複数の天気予報サービスを横並びで比較し、「パレードが中止にならない快適な日」を一目で判断できる Web ダッシュボードを作る。同行者と画面を共有しながら相談できることを重視する。

成功条件 :

- 候補日 (今後14日間) ごとに、複数ソースの予報を一覧で比較できる
- パレード中止リスク (主に風速) と雨リスクが直感的に分かる
- 同行者と URL 1本で共有できる
- リロードすれば常に最新の予報が表示される
- ショー･パレードの開催時刻に焦点を当てたスコアが出る (朝より 13時 ･ 20時 の風が大事)

---

## 2. ユースケース

1. Yuka さんが Cowork で artifact を開く → 候補日と予報を眺める → 良さそうな日を見つける
2. 同行者に URL を共有 (または画面共有) → その日のスコアを一緒に見て合意
3. 決まった候補日と相談メモは Notion ページ「ディズニー行く日候補」に追記 (ボタン押下で自動)
4. 決定日が固まったら「Google Calendar に予定追加」ボタンで予定化
5. 訪問前日にチェックリスト (持ち物･服装) が天気に応じて動的に出る

---

## 3. 機能要件

### 3.1 候補日リスト

- 表示範囲 : 今日 ＋ 14日間 (15日分)
- 各日について、TDL･TDS どちらにも対応 (両パークは座標が近いので予報は共通でOK)
- 曜日 / 祝日 / 学校休暇区分 (春休み･GW･夏休み･冬休み) を併記
- 連休がひと目で分かるよう、連続する◎ ○ にはグルーピング枠を表示

### 3.2 予報ソースの横並び比較

複数の予報ソースから同じ日のデータを取得し、行 ＝ 日付、列 ＝ ソース のマトリックスを表示。

| 取得項目 | 単位 |
|---|---|
| 最高気温 / 最低気温 | ℃ |
| 体感温度 (最高 / 最低) | ℃ |
| 降水確率 | % |
| 1時間降水量 (最大) | mm/h |
| 平均風速 / 最大風速 / 最大突風 | m/s |
| 天気概況 | 晴れ･曇り･雨 等 |
| UV指数 | 0 - 11+ |

セルには、各指標の値 ＋ リスクに応じた色を付け、色だけでなく記号 ・ 数値でも判別できるようにする。

**気温セルの色分け (Yuka さん要望)** :

最高気温 ・ 最低気温は値だけだと暑い ・ 寒いの直感が出ないので、温度帯で文字色を変える (太陽 ・ 雪の暖寒イメージ) :

| 気温帯 | 文字色 (色名 ・ 用途) |
|---|---|
| ≧ 35℃ | `#9B1C1C` (深紅 ・ 危険な暑さ) |
| 30 - 34℃ | `#D24A4A` (赤 ・ 暑い) |
| 25 - 29℃ | `#E48732` (オレンジ ・ 夏日寄り) |
| 20 - 24℃ | `#2D8F3E` (緑 ・ 快適) |
| 15 - 19℃ | `#3A8AB8` (青緑 ・ 涼しい) |
| 10 - 14℃ | `#3F6FAE` (青 ・ 肌寒い) |
| 5 - 9℃ | `#2C4D8E` (濃青 ・ 寒い) |
| < 5℃ | `#1A2D5E` (紺 ・ 厳寒) |

セル表記 : `<span style="color:#D24A4A">32℃</span> / <span style="color:#3F6FAE">12℃</span>` (最高 / 最低)。ダークモードでは彩度を上げて明度を保つ。

凡例 (footer 近くに小さく) : 「気温の色 : 赤系 ＝ 暑い ／ 緑 ＝ 快適 ／ 青系 ＝ 寒い」

### 3.3 総合スコア (パーク別 ･ 日別 ･ 時間帯別)

各日のスコアを 4段階で表示 :

- ◎ : 行くべき
- ○ : 行ってよい
- △ : 微妙 (風 or 雨に注意)
- × : 別日推奨

スコア算出ロジックは [§5 スコアリング](#5-スコアリング) を参照。

**最重要は「昼パレード時刻 (13:00 / 14:30 周辺)」**。理由 : Yuka さんが見たいのは季節限定の昼デイパレード。ナイトパレードは通年同じ演目で、運休になっても優先度が低い。

時間帯サブスコアは 3区分で出すが、それぞれ重みを変える :

- 朝 (9 - 12) : 重み 0.5 (アトラクション中心、パレードは無いことが多い)
- **昼 (12 - 16) : 重み 2.0 (季節パレード、最重要)**
- 夜 (18 - 21) : 重み 0.3 (ナイトパレードは通年演目、参考表示)

総合スコアは時間帯サブスコアを重み付き平均する形にも対応する (§5.2 参照)。

#### サブスコアの表示仕様 (Yuka さん指摘 : `◎/◎/○` も `朝×昼×0夜×` も何を意味するか分かりにくい)

各セルに **時間帯ラベル ＋ 記号 (＋ 数値)** をペアで表示。昼は重要なので大きく強調。**3つの時間帯を視覚的に分離するためピル (背景色付き小ブロック) として描画する**。

```
PC :
  ┌──────────────────────────────────┐
  │ [ 朝 ○ ]   [ 昼 ◎ 92 ]   [ 夜 △ ] │
  └──────────────────────────────────┘
     灰色ピル      枠付き太字       灰色ピル
     (薄)          (アクセント色)   (薄)

スマホ :
  [朝 ○] [昼 ◎ 92] [夜 △]    ← ピルは小さく、間隔保持
```

- 時間帯ラベルは必須 (`朝` `昼` `夜`)
- 朝 ・ 夜 : 薄い背景色 (`var(--surface-2)`) の角丸ピル、控えめ
- 昼 : アクセントカラーの **枠 ＋ 太字 ＋ 数値併記** で主役
- ピル間の `gap` は **12px 以上** (字面で繋がらない明確な空白)
- ピル内 padding `4px 8px` で字とブロック境界に余白
- 記号間にもスペース (`time-label` と `symbol` のあいだ)
- アイコン併用は **しない** (✓ フォールバック問題)

DOM :

```html
<span class="subscore-group">
  <span class="subscore">
    <span class="time-label">朝</span>
    <span class="symbol">○</span>
  </span>
  <span class="subscore subscore-main">
    <span class="time-label">昼</span>
    <span class="symbol">◎</span>
    <span class="value">92</span>
  </span>
  <span class="subscore">
    <span class="time-label">夜</span>
    <span class="symbol">△</span>
  </span>
</span>
```

CSS 必須要件 :

```css
.subscore-group {
  display: inline-flex;
  align-items: center;
  gap: 12px;                    /* 6px → 12px に拡大 */
}
.subscore {
  display: inline-flex;
  flex-direction: row;          /* column → row : 横並びで「朝 ○」と読ませる */
  align-items: center;
  gap: 4px;                     /* ラベルと記号の間に明示的なスペース */
  padding: 4px 8px;             /* ピル内余白 */
  border-radius: 999px;         /* 角丸ピル */
  background: var(--surface-2); /* 薄い背景色 */
  font-size: 12px;
}
.subscore-main {
  border: 1.5px solid var(--accent);  /* 昼は枠付き */
  background: var(--surface);          /* 背景は本体カラー */
  font-weight: 700;
  font-size: 13px;
}
```

ARIA : `aria-label="朝 行ってよい、昼 行くべき スコア92、夜 微妙"`

### 3.4 詳細パネル (Yuka さん指摘 : パッと見が分かりづらい / グラフは右 / 見出し区切り不明)

#### 行クリックの可視化

行が「クリックできる」と一目で分かるように :

- 行ホバーで `cursor: pointer` ＋ 背景色をわずかに変化 (`var(--surface-2)`)
- 行末に右向き chevron アイコン (`chevron_right` / 開いた行は `expand_more`)
- 行末に「詳細を見る」テキスト (PC のみ、スマホはアイコンのみ)
- `aria-expanded` `role="button"` `tabindex="0"`
- Enter / Space キーで開閉

#### 詳細パネルの構成 (2カラム ・ グラフ右)

PC (≧ 768px) は **左に情報 ・ 右にグラフ** の2カラム :

```
┌─────────────────────────────────────────────────────────┐
│  ─── 6/14 (土) の詳細 ───                  [閉じる ×]    │
├─────────────────────────────┬───────────────────────────┤
│ ◆ ショースケジュール (TDL)    │ ◆ 時系列予報              │
│                              │                            │
│  デイパレード ・ ショー (主算定)│   (Chart.js 折れ線)        │
│  ・ ハーモニー･イン･カラー    │  - 降水確率 (左Y)          │
│     13:00 プレミアアクセス     │  - 風速 (右Y)             │
│  ・ Reach for the Stars       │  - 縦線 : ショー時刻       │
│     20:50 季節限定             │  - 背景帯 : 10m/s ライン   │
│  ナイトパレード (参考)         │                            │
│  ・ ドリームライツ 19:30      │ ◆ 気温推移                 │
│                              │   (小さい別チャート)        │
├─────────────────────────────┴───────────────────────────┤
│ ◆ 服装サジェスト                                         │
│  ・ ポンチョ (傘はキャストに止められる)                    │
│  ・ 日焼け止め SPF50                                     │
│  ・ 羽織りもの (昼夜温度差 10℃)                          │
├─────────────────────────────────────────────────────────┤
│ ◆ 当日のキャラクターグリーティング (折りたたみ)            │
│ ◆ 当日の休止情報 (折りたたみ)                            │
└─────────────────────────────────────────────────────────┘
```

スマホ (< 768px) は **1カラム縦並び** : ショースケジュール → グラフ → 気温 → 服装 → グリ ・ 休止。

#### 見出し区切りの強化 (Yuka さん指摘 : 区切りが分かりづらい)

各セクションの見出しは「**装飾 ＋ ラベル ＋ 罫線**」で明確化 :

```html
<h3 class="panel-heading">
  <span class="panel-bullet"></span>
  ショースケジュール (TDL)
</h3>
```

CSS :

```css
.panel-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  margin: 24px 0 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--accent);  /* ピンク or ブルーの太線 */
}
.panel-bullet {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
}
```

セクション間には `margin-top: 24px` の余白を空け、ヘッダー以外にも淡い区切り線 `border-top: 1px solid var(--border)` を入れる。

#### グラフ仕様

- Chart.js v4.5.0 ・ ハイトは 300px 固定 (デスクトップ) / 240px (スマホ)
- 横軸 : 時刻 (9:00 - 22:00)
- 左Y軸 : 降水確率 (%) ・ 青系の塗り
- 右Y軸 : 風速 (m/s) ・ オレンジ系の線
- 風速10m/s に水平ライン ＋ 上側を薄い赤で塗り「パレード中止域」と注釈
- ショー時刻 (`priority: 'high'`) を縦線でハイライト ＋ ショー名のラベル吹き出し
- 別チャート : 気温 / 体感温度 (赤系) ・ WBGT (オレンジ系)
- 凡例とツールチップで全項目見える

### 3.5 ソート ･ フィルター

- 並び順 : **「日付順 (デフォルト)」** ・ 「総合スコア順」を切り替え
- フィルター : 「平日のみ」「土日祝のみ」「◎ ○ のみ」
- localStorage に保存 (リロード後も維持)
- 「同行者の都合NG日」を手動で × マーキングできる (localStorage / Notion 同期)

### 3.6 同行者共有

- ページ右上に「現在の表示を Notion に送る」ボタン
  - クリックで `mcp__0659b728-c5ec-4b9c-b289-01bef999914e__notion-create-pages` を呼び、候補日のスナップショットを Notion DB に追加
- URL は Cowork artifact の共有リンクをそのまま使う想定
- 「QRコード表示」ボタン (画面共有が難しい場でも見せられる)

### 3.7 推奨日 TOP3 (下部サマリ)

**ページ下部** に「今からの14日でベスト3」をサマリとして表示 (Yuka さん要望 : メインはカレンダー、TOP3 は補助)。スコア / 風速 / 降水確率の主要指標と「行くべき理由」自然文 (`window.cowork.askClaude` で生成) を1行添える。

メイン UI は §3.1 の日付順カレンダー。TOP3 は「テーブルを眺めたあとに改めて確認するベスト候補」という位置付け。

### 3.8 持ち物 / 服装サジェスト

選択した日の予報に応じて自動生成 :

- 最高気温 < 12℃ → 「ヒートテック / コート」
- 最高気温 > 28℃ → 「日傘 / 帽子 / 凍らせたペットボトル」
- 降水確率 ≧ 50% → 「ポンチョ (傘はキャストに止められることあり)」
- UV指数 ≧ 7 → 「日焼け止め SPF50」
- 体感温度差 (昼夜) ≧ 10℃ → 「羽織りもの」

### 3.9 決定フロー

「この日に決めた」ボタンを押すと :

1. localStorage に決定日を保存 (画面上にバッジ表示)
2. Notion DB の該当行を「決定」ステータスに更新
3. Google Calendar 連携 (`mcp__0d41b0a4-c542-42f1-a379-349e38735111__create_event`) で予定追加 (確認ダイアログ後)

### 3.10 ショー / パレード時刻データ (公式運営カレンダー連携)

#### データ源 (確認済み)

TDR 公式の日別運営カレンダーから日替わりスケジュールを取得 :

- TDL : `https://www.tokyodisneyresort.jp/tdl/daily/calendar/{YYYYMMDD}/`
- TDS : `https://www.tokyodisneyresort.jp/tds/daily/calendar/{YYYYMMDD}/`

確認した実データ例 (TDL 2026/6/4) :

- 開園時間 9:00 - 21:00
- ディズニー ・ ハーモニー ・ イン ・ カラー 13:00 (プレミアアクセス対象)
- イッツ ・ ア ・ スウィーツフルタイム! 16:25 (プレミアアクセス対象、季節パルパルーザ枠)
- Reach for the Stars 20:50 (プレミアアクセス対象)
- 東京ディズニーランド ・ エレクトリカルパレード ・ ドリームライツ 19:30
- スカイ ・ フル ・ オブ ・ カラーズ 20:30
- ジャンボリミッキー! 12:45 / 14:00 / 15:15 / 17:05 / 18:20 (エントリー受付対象)
- ミッキーのレインボー ・ ルアウ (予約必須ショーレストラン)
- キャラクターグリーティング各種 ・ 休止情報

#### 取得方法

ページは SPA でクライアントサイドレンダリング (生 HTML fetch では空)。3段構えで取得 :

1. **検証推奨 : 内部 API を Network タブで探す** (`/api/calendar/{YYYYMMDD}` 等が存在するか確認) → 見つかれば直接 fetch (Phase 2 最優先タスク)
2. **代替 : Cloudflare Workers ＋ Browser Rendering API** で日次バッチ実行、JSON 化して R2 に保存、artifact はその静的 JSON を取得
3. **フォールバック : `src/data/showSchedule.js` に典型時刻 JSON を手動メンテ** (Phase 1 ・ 月1更新運用)

規約遵守 : 1日1回 (深夜帯) の取得に抑制、User-Agent 明示、robots.txt 遵守。

#### 取得項目

- 開園 / 閉園時刻
- パレード / ショー名 ・ 時刻 ・ 属性 (プレミアアクセス対象 / エントリー受付対象 / 予約必須)
- 当日のイベント / プログラム名 (パルパルーザ等)
- キャラクターグリーティング場所 ・ 時間帯
- 休止情報 (アトラクション ・ ショー ・ レストラン)

#### ショースケジュール現状の前提 (Yuka さん指摘「実際の時間引けてないってこと?」)

回答 : **Phase 1 では公式 calendar からの自動取得は未実装**。`src/data/showSchedule.js` の固定 JSON で代替している。Phase 2 で公式 `/tdl/daily/calendar/{YYYYMMDD}/` ・ `/tds/daily/calendar/{YYYYMMDD}/` から日別取得する。

ただし Phase 1 でも **固定 JSON に実在のショー名 ・ 時刻を入れて、ぱっと見の正確性を担保** する。「デイパレード (季節)」のような汎用ラベルは廃止、必ず実在公演名で表示。

#### showSchedule.js の構造 (実在ショー名 ・ パーク別)

公式 calendar (2026/6/4 時点) を確認した実データ :

```js
// src/data/showSchedule.js
export const SHOW_SCHEDULE = {
  TDL: [
    // high : 季節限定 ・ デイ ・ メイン算定窓
    { name: 'ディズニー･ハーモニー･イン･カラー', times: ['13:00'], priority: 'high', kind: 'parade-day', tag: 'プレミアアクセス' },
    { name: 'イッツ･ア･スウィーツフルタイム!', times: ['16:25'], priority: 'high', kind: 'show-day', tag: 'パルパルーザ枠 ・ 季節限定' },
    { name: 'Reach for the Stars', times: ['20:50'], priority: 'high', kind: 'show-day', tag: '季節限定 ・ プレミアアクセス' },
    // medium : 屋内 ・ エントリー受付対象
    { name: 'ジャンボリミッキー!レッツ･ダンス!', times: ['12:45','14:00','15:15','17:05','18:20'], priority: 'medium', kind: 'show-indoor', tag: 'エントリー受付' },
    // low : 通年ナイト ・ 花火 ・ 参考表示のみ
    { name: '東京ディズニーランド･エレクトリカルパレード･ドリームライツ', times: ['19:30'], priority: 'low', kind: 'parade-night', tag: '通年' },
    { name: 'スカイ･フル･オブ･カラーズ', times: ['20:30'], priority: 'low', kind: 'fireworks', tag: '通年花火' },
    // ショーレストラン (時間別ロジック対象外)
    { name: 'ミッキーのレインボー･ルアウ', times: [], priority: null, kind: 'show-restaurant', tag: '予約必須' },
  ],
  TDS: [
    // high : 25周年記念デイハーバーショー (季節限定)
    { name: 'スパークリング･ジュビリー･セレブレーション', times: ['11:30','14:00','16:00'], priority: 'high', kind: 'harbor-day', tag: '25周年 ・ 季節限定' },
    // medium : エントリー受付対象屋内
    { name: 'ダンス･ザ･グローブ!', times: ['13:00','14:45','17:05','18:50'], priority: 'medium', kind: 'show-indoor', tag: 'エントリー ・ プレミアアクセス' },
    { name: 'ドリームス･テイク･フライト', times: ['11:00','12:25','13:50','15:55','17:20'], priority: 'medium', kind: 'show-indoor', tag: 'エントリー ・ プレミアアクセス' },
    // low : 通年メインナイト ・ 環境演出 ・ 花火
    { name: 'ビリーヴ!〜シー･オブ･ドリームス〜', times: ['19:30'], priority: 'low', kind: 'harbor-night', tag: '通年 ・ プレミアアクセス' },
    { name: '【環境演出】スパークリング･ジュビリー･ナイト', times: ['20:15','20:40','20:55'], priority: 'low', kind: 'environment', tag: '季節 ・ 短時間' },
    { name: 'スカイ･フル･オブ･カラーズ', times: ['20:30'], priority: 'low', kind: 'fireworks', tag: '通年花火' },
    // ショーレストラン
    { name: 'ダッフィー＆フレンズのワンダフル･フレンドシップ', times: [], priority: null, kind: 'show-restaurant', tag: '予約必須' },
  ],
};
```

#### スコア算定窓

- `priority: 'high'` の時刻 ±1h を **メインスコアの算定窓** (§5.1 の `wind_show_window` ・ `pop_show_window` ・ `wbgt_show_window`)
- `priority: 'medium'` は補助スコア
- `priority: 'low'` はサブスコア (夜) の参考表示のみ
- `priority: null` (ショーレストラン) はスケジュール窓判定対象外

#### UI 表示

詳細パネルや行ホバーで「当日のショースケジュール」を表示するときは、固定ラベルではなく **実在公演名で表示** :

```
TDL :
  デイパレード ・ ショー
    ・ ディズニー･ハーモニー･イン･カラー  13:00  [プレミアアクセス]
    ・ イッツ･ア･スウィーツフルタイム!   16:25  [パルパルーザ枠 ・ 季節限定]
    ・ Reach for the Stars             20:50  [季節限定 ・ プレミアアクセス]
  ナイトパレード ・ 花火 (参考)
    ・ エレクトリカルパレード ・ ドリームライツ  19:30
    ・ スカイ ・ フル ・ オブ ・ カラーズ        20:30
  屋内 (エントリー受付)
    ・ ジャンボリミッキー! レッツ ・ ダンス!   12:45 / 14:00 / 15:15 / 17:05 / 18:20
```

TDS も同様に実在公演名で。

#### 月初メンテナンス

公式は「翌月分は前月 8日頃に掲載」。月初に Yuka さんが `showSchedule.js` を公式 calendar と照合し、新規ショー ・ 終了ショーを差分更新 (README に手順)。Phase 2 で公式取得が動けば自動同期される。

#### 未知のショー名の priority 判定 (Phase 2)

公式取得で未知のショー名が出てきた場合は、Claude AI (`askClaude`) に「季節限定か通年か」「デイハーバー / ナイトハーバー / 屋内 / 花火」を判定させ、priority を自動付与。判定結果は `showPriority.js` のキャッシュに保存。

#### スコア算定窓

- `priority: 'high'` の時刻 ±1h を **メインスコアの算定窓** (§5.1 の `wind_show_window` ・ `pop_show_window` ・ `wbgt_show_window`)
- `priority: 'medium'` は補助スコア
- `priority: 'low'` はサブスコア (夜) の参考表示のみ

#### キャッシュ ・ 取得頻度

- 取得した日別スケジュールを localStorage に **24時間キャッシュ**
- 前日 ・ 当日 ・ 翌日のみ自動再取得 (日替わりで更新されやすい)
- 14日先までを Cloudflare Workers のバッチで前日深夜 02:00 に一括取得 ・ R2 保存

#### キャラグリーティング情報の活用

- グリ場所 ・ 時間帯は服装サジェスト (§3.8) と当日プラン作成の参考情報として表示
- 詳細パネルに「当日のグリ一覧」を折りたたみで併記

### 3.11 熱キャン / 熱バ リスク

夏のショー･パレードは熱中症対策で「熱バ (一部省略)」「熱キャン (中止)」になる。公式基準は非公開だが、目安は以下 :

- 気温30℃以上 → 熱キャン発生の可能性あり
- 気温35℃以上 → 熱キャン発生率高
- WBGT (暑さ指数) 31以上 → 屋外活動原則中止レベル
- 風 / 湿度も加味される (風があれば緩和されることも)

→ **WBGT (暑さ指数) ベースで独立バッジを表示する** (風キャンバッジと並列)。基準は §5.6 を参照。

データソース優先順位 :

1. 環境省 暑さ指数 電子情報提供サービス (CSV / WebAPI 順次対応) の予測値
2. Open-Meteo の `temperature_2m` ＋ `relative_humidity_2m` から簡易式で派生計算 (フォールバック)

簡易計算式 (屋外、日射 ・ 風は補正なし) :

```
e = (RH / 100) × 6.105 × exp(17.27 × Ta / (237.7 + Ta))
WBGT ≒ 0.567 × Ta + 0.393 × e + 3.94
  Ta : 気温 (℃)
  RH : 相対湿度 (%)
  e  : 水蒸気圧 (hPa)
```

精度は公式 WBGT より低めなので、表示時は「推定値」と但し書きを付ける。環境省 API 取得が成功した場合はそちらを優先。

### 3.12 過去予報の的中追跡 (簡易版)

- 1日1回 (Cowork scheduled task で 21:00) 各ソースの「今日の予報 (前日時点)」と「実績 (気象庁の観測値)」を比較してログを Notion に追記
- これを30日蓄積するとソースごとに「外しがちかどうか」が分かる
- 集計結果は別 artifact で可視化 (Phase 2)

### 3.13 観測地点の選定 (粒度)

千葉県全体の予報だと舞浜の風が読めない。実装では以下を優先 :

| 用途 | エリアコード / 地点コード | 説明 |
|---|---|---|
| 予報 (気象庁 Forecast) | `120010` (千葉県北西部) | 浦安市を含む二次細分 |
| 観測 (アメダス) | `44132` (船橋) ＋ `44166` (千葉) | 舞浜近傍。両方取得して平均 |
| WBGT (環境省) | 観測地点 `44132` 船橋 もしくは 東京 (大手町) | 浦安直近の予測値 |
| 風予報 (Open-Meteo / OpenWeather) | `lat=35.6329, lon=139.8804` | 舞浜駅直近のグリッド |

座標 ・ コードは `src/config/location.js` に集約。

### 3.14 データ鮮度表示

Yuka さん指摘 : 各セルに「最終更新 24分前 キャッシュ」が並ぶと冗長 ・ ノイズ。同じバッチ取得なら同じ値が全列に出るので意味が薄い。

→ **ステータスバー (テーブル上部のフィルター行付近) にソース別1か所だけ集約** する。

#### ステータスバー仕様

```
┌────────────────────────────────────────────────────────┐
│ [パーク TDL/TDS] [平日/土日祝] [日付順/スコア順]              │
│ JMA 24分前 ・ Open-Meteo 18分前   [キャッシュ表示中]  [強制更新] │
└────────────────────────────────────────────────────────┘
```

- ソース別に「ソース名 ＋ 取得後経過時間」を1か所だけ表示
- 取得時刻は全日分のうち最も古いものを採用 (バッチ全体の鮮度)
- 全ソースがキャッシュなら **「キャッシュ表示中」黄色ピル** を1つだけ
- 「強制更新」ボタンで全 fetch (キャッシュ無視)

#### セル側の表示

- 各セルからは「最終更新」ラベルを **削除**
- セルにホバー / フォーカスすると `title` 属性または ARIA で「JMA 24分前」と表示 (補助のみ)
- 取得失敗セルは「取得失敗 [再試行]」のみ表示 (前の仕様どおり)

#### 取得元更新サイクル

「気象庁は 5時 / 11時 / 17時に更新」のような周期はステータスバーのソース名にツールチップで添える (ホバーで表示)。

該当ファイル : `src/ui/statusBar.js` 新規 ＋ `src/ui/table.js` から鮮度セルを削除 ＋ `src/utils/freshness.js` の役割を縮小 (ステータスバー専用に)。

### 3.15 disclaimer (法的安全弁)

画面下に固定で表示 :

> 本ツールは公開予報からの推定であり、運営の公式発表ではありません。当日の正確な運営状況は東京ディズニーリゾート公式サイト ・ アプリで必ずご確認ください。

`<footer role="contentinfo">` で配置、画面サイズに応じて折り返し。

### 3.16 用語集 / ヘルプ

- 「風バ」「風キャン」「熱バ」「熱キャン」「キャングリ」をその場のツールチップで説明
- 別ページ `/help` (実態は SPA 内のモーダル) に :
  - 各バッジの意味
  - スコアの計算根拠 (§5 へのリンク)
  - 中止判断の発表タイミング (公式 X 等)
  - FAQ (「予報が外れたら?」「同行者と共有するには?」)

### 3.17 印刷モード

「決定日」を選択した状態で印刷すると、A4 1枚に :

- 日付 ・ 曜日 ・ パーク
- 当日の予報 (時系列グラフ)
- ショー時刻一覧
- 服装 ・ 持ち物リスト
- 注意バッジ (風キャン / 熱キャン / 雨キャン)

CSS `@media print` で実装。背景色は白、不要な UI を非表示。

### 3.18 雨雲レーダー (当日判断)

- 気象庁ナウキャストの公式ページ <https://www.jma.go.jp/bosai/nowc/> を埋め込み iframe または直リンク
- 当日 ・ 前日のみ表示 (それ以前は意味がないので非表示)
- iframe が CSP 等で動かない場合は新規タブ遷移ボタンに切替

### 3.19 自動通知 (scheduled task)

決定日が確定したら、Cowork scheduled task で 3段階の自動チェック :

| タイミング | 内容 | 通知先 |
|---|---|---|
| 3日前 21:00 | 最新予報を取得しスコア再計算。前回から悪化したら警告 | Slack DM |
| 前日 18:00 | 翌日のピンポイント予報 ・ WBGT ・ 風予測 | Slack DM ＋ Notion 更新 |
| 当日 6:30 | ナウキャスト ・ 公式運営情報を確認、注意点要約 | Slack DM |

`mcp__scheduled-tasks__create_scheduled_task` で「この日に決めた」フロー内から自動セットアップ。

### 3.20 TDR 公式運営状況 ・ ショースケジュールの取得

§3.10 と統合して以下の3エンドポイントを定期取得 :

| 用途 | URL パターン | 頻度 | 取得方法 |
|---|---|---|---|
| 当日 ・ 翌日ショー時刻 (TDL) | `/tdl/daily/calendar/{YYYYMMDD}/` | 1日1回 (02:00) ＋ 当日 6:00 | Workers Browser Rendering |
| 当日 ・ 翌日ショー時刻 (TDS) | `/tds/daily/calendar/{YYYYMMDD}/` | 同上 | 同上 |
| 当日運営状況 (中止 ・ 変更告知) | `/info/operation.html` | 1日3回 (8:00 / 12:00 / 18:00) | Workers fetch |

- 取得結果を Notion DB「ショー実績」に追記 (日別 ・ ショー別 ・ 開催/中止フラグ)
- §3.12 の的中追跡データと突き合わせると「予想 vs 実際の中止判定」精度が見える
- 規約遵守 : User-Agent 明示 ・ 上記頻度を超えない ・ robots.txt 確認 ・ Workers 側でレート制御

### 3.21 混雑予想連携

- 待ち時間予想を扱う公開サービス (15Cube 等) から日別混雑指数を取得
- 「天気スコア × 空きやすさ」の合成スコア欄を追加 (オプション表示、デフォルト OFF)
- 同サービス側に API がない場合は手入力で代替可能なフィールドを Notion に持つ

### 3.22 Claude AI による自然文サマリ ・ 質問応答

- ページ上部に Claude 生成の今週サマリ : 「今週は土曜午後がベスト、水曜は風強め、来週月曜は熱中症リスク高」
- 自由質問欄 : 「来週の中でデイパレードを快適に見られるのはいつ?」のような質問に `window.cowork.askClaude` で回答
- 入力にはデータを添えて投げる (Haiku 推論)

### 3.23 同行者投票機能

- 各候補日に Notion DB のリアクション (絵文字) を集計
- 表示形式 : 「Yuka : ◎、A : △、B : ×」
- 全員 ◎ ・ ○ の日は強調表示
- 1人でも × を付けた日は「却下候補」セクションに分離

---

## 4. データソース

優先順位順に3つ。1つが落ちても他で表示できるように、独立に取得する。

### 4.1 気象庁 (JMA)

- URL : `https://www.jma.go.jp/bosai/forecast/data/forecast/120000.json` (千葉県)
- 認証 : 不要
- 取得項目 : 降水確率 (3時間刻み)、最高 / 最低気温、天気概況、週間予報
- 利用規約 : 政府標準利用規約 (商用可、出典明記)
- 注意 : 風速は overview_forecast の文章中に含まれるのみで構造化されていない。風速は他ソースで補完する
- 観測値 (的中追跡用) : `https://www.jma.go.jp/bosai/amedas/data/point/44132/{YYYYMMDD}_{HH}.json` 等 (千葉市 ・ 浦安近傍)

### 4.2 Open-Meteo

- URL : `https://api.open-meteo.com/v1/forecast`
- パラメータ例 :

  ```
  latitude=35.6329&longitude=139.8804
  &hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,uv_index
  &daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max
  &timezone=Asia/Tokyo&forecast_days=16
  ```

- 認証 : 不要
- 利用規約 : 非商用無料、商用は要相談 (本ツールは個人用なので非商用扱い)
- 強み : 風速 ･ 突風 ･ 降水確率 ･ UV ･ 体感温度すべて hourly / daily で取れる

### 4.3 OpenWeather One Call API 3.0

- URL : `https://api.openweathermap.org/data/3.0/onecall`
- パラメータ : `lat=35.6329&lon=139.8804&units=metric&lang=ja&appid={API_KEY}`
- 認証 : API キー必須 (環境変数 `OPENWEATHER_API_KEY`)
- 無料枠 : 1,000 calls / day
- 取得項目 : hourly (48時間, pop / wind_speed / wind_gust / temp / feels_like / uvi), daily (8日)
- 注意 : 8日分しか取れないので、15日表示の場合は後半空欄でOK

### 4.4 環境省 暑さ指数 (WBGT)

- URL : `https://www.wbgt.env.go.jp/data_service.php` 配下 (CSV)
- 観測地点コード : 千葉県浦安付近の最寄り (千葉 = 45106 / 銚子 = 45148 等から最近接を採用、舞浜は東京寄りなので東京 = 44132 と比較して採用)
- 認証 : 不要
- 取得項目 : WBGT 予測値 (3時間刻み、当日含む2 - 3日先まで)
- 形式 : CSV (要パース)
- 利用規約 : 環境省 ・ 政府標準利用規約 (出典明記)
- フォールバック : 取得失敗時は §3.11 の簡易式で計算

### 4.5 採用見送り

- tenki.jp : 公式API は法人向け有料。スクレイピングは規約上不可
- Yahoo! 天気 : 公開された天気予報API なし
- ウェザーニュース : 公式 API は法人契約のみ

---

## 5. スコアリング

座標は TDL･TDS 共通で `lat=35.6329, lon=139.8804` (舞浜駅近辺) を使う。
TDS のみハーバーショーがあるので、`park='TDS'` 選択時は風減点を 1.2 倍する。

### 5.1 入力指標 (各ソースの値を単純平均、不在は除外)

ショー時刻ウィンドウは `priority: 'high'` の昼パレード時刻 (TDL 13:00 / 14:30 ・ TDS 11:30 / 14:00) ±1h を採用。

- `wind_max` : 1日の最大風速 (m/s)
- `gust_max` : 1日の最大突風速 (m/s)
- `wind_show_window` : 昼パレード時刻 ±1h の最大風速 / 突風 (m/s)
- `pop_max` : 1日の最大降水確率 (%)
- `pop_show_window` : 昼パレード時刻 ±1h の最大降水確率 (%)
- `precip_sum` : 1日の降水量合計 (mm)
- `temp_max` / `temp_min` : 最高 / 最低気温 (℃)
- `feels_like_max` / `feels_like_min` : 体感気温 (℃)
- `wbgt_max` : 1日の最大 WBGT (環境省取得 ＞ 簡易計算)
- `wbgt_show_window` : 昼パレード時刻 ±1h の最大 WBGT
- `uv_max` : 最大 UV 指数

### 5.2 スコア式

総合スコア = 100 - (風減点 ＋ 雨減点 ＋ 熱中症減点 ＋ 寒さ減点 ＋ UV減点)

```
風減点 (gust_show_window を優先、無ければ gust_max) :
  gust < 5      → 0
  5 ≦ gust < 8  → 10
  8 ≦ gust < 10 → 30   (風バ域)
  10 ≦ gust < 13 → 60  (パレード中止域)
  gust ≧ 13     → 90   (アトラクションも止まる域)
  park === 'TDS' なら全体に × 1.2

雨減点 (pop_show_window を優先、無ければ pop_max) :
  pop < 20     → 0
  20 ≦ pop < 50 → 15
  50 ≦ pop < 70 → 30
  pop ≧ 70     → 50
  ＋ precip_sum ≧ 5mm なら ＋10

熱中症減点 (wbgt_show_window を優先、無ければ wbgt_max。風がある日は補正) :
  wbgt < 25       → 0
  25 ≦ wbgt < 28  → 10  (警戒)
  28 ≦ wbgt < 31  → 30  (厳重警戒 ・ 熱バ域)
  31 ≦ wbgt < 33  → 60  (危険 ・ 熱キャン域)
  wbgt ≧ 33       → 90  (極めて危険)
  ＋ feels_like_max ≧ 35 なら ＋10
  － wind_show_window ≧ 5m/s なら -5 (風で緩和)

寒さ減点 (feels_like_max を使う、無ければ temp_max) :
  feels_like_max ≧ 10 → 0
  5 ≦ feels_like_max < 10 → 10
  feels_like_max < 5      → 25

UV減点 :
  uv_max < 8  → 0
  8 ≦ uv_max < 11 → 5
  uv_max ≧ 11 → 10
```

注 : 旧 §5.2 の単純な気温減点は熱中症減点に統合し、夏場の判定は WBGT を主指標に切り替えた。冬場の寒さは寒さ減点で別途扱う。

### 5.3 スコア → 記号

```
score ≧ 85 → ◎
score ≧ 70 → ○
score ≧ 50 → △
score < 50  → ×
```

### 5.4 ソース信頼度補正 (Phase 2)

§3.11 で蓄積した的中ログを使い、各ソースの平均誤差から重み (0.5 - 1.5) を算出。
初期は全ソース重み1.0で開始し、ログが30日たまったら自動で重み付けに切替。

### 5.5 パレード中止リスク (風キャン / 雨キャン バッジ)

スコアとは別に行頭にバッジで出す。3指標を併記 (**Yuka さん要望 : ラベルだけでなく実数値も必ず併記**)。

**風バッジ (gust_show_window ベース)**

| 突風 | ラベル | 表示例 (PC) | 表示例 (スマホ) |
|---|---|---|---|
| gust < 8 | 通常運行 | `8m/s 通常` | `8 通常` |
| 8 ≦ gust < 10 | 風バ可能性あり | `9m/s 風バ` | `9 風バ` |
| 10 ≦ gust < 13 | 中止リスク高 | `11m/s 中止リスク` | `11 中止` |
| gust ≧ 13 | ほぼ中止 | `14m/s ほぼ中止` | `14 中止濃厚` |

根拠 : 風速10m/s 前後でパレード中止 / 風速8m/s 前後で風バ (一部省略バージョン) という公開情報に基づく目安。

**雨バッジ (pop_show_window と precip_sum ベース)**

| pop / precip | ラベル | 表示例 (PC) | 表示例 (スマホ) |
|---|---|---|---|
| pop < 30 | 雨なし | `10% 雨なし` | `10%` |
| 30 ≦ pop < 60 ・ precip < 1 | 雨バ可能性 | `45% 雨バ` | `45% 雨バ` |
| 60 ≦ pop or precip ≧ 1 | 雨キャン濃厚 | `70% 2mm 雨キャン` | `70% 雨キャン` |
| precip ≧ 2mm/h | ほぼ中止 | `90% 3mm 中止` | `90% 中止` |

降水量 (precip) は0でない時のみ併記 (0mm/h は冗長なので非表示)。

根拠 : 1時間2mm以上の雨でショー･パレード中止傾向、傘をさす程度の雨で判断が出るという公開情報。

### 5.6 熱キャン / 熱バ リスク (WBGT バッジ)

夏季のショー･パレード中止リスクを WBGT ベースで独立表示。風キャンバッジと並列。**実数値必須**。

| WBGT | ラベル | 表示例 (PC) | 表示例 (スマホ) |
|---|---|---|---|
| < 25 | 通常運行 | `WBGT 22 通常` | `22 通常` |
| 25 ≦ wbgt < 28 | 暑さ注意 | `WBGT 26 注意` | `26 注意` |
| 28 ≦ wbgt < 31 | 熱バ可能性あり | `WBGT 29 熱バ` | `29 熱バ` |
| 31 ≦ wbgt < 33 | 熱キャン濃厚 | `WBGT 32 熱キャン` | `32 熱キャン` |
| ≧ 33 | ほぼ中止 | `WBGT 34 中止` | `34 中止` |

`wbgtSource === 'derived'` の場合は値の末尾に小さく `(推定)` を付ける (例 `WBGT 29 (推定) 熱バ`)。

補正条件 (バッジ判定のみ、表示値は素値) :

- `wind_show_window ≧ 5m/s` の場合は1段階下げる (風で体感緩和)
- `feels_like_max ≧ 38` の場合は1段階上げる (湿度高で体感悪化)

根拠 : WBGT 31以上 ＝ 屋外活動原則中止 (環境省基準)、ディズニーは公式基準非公開だが気温35℃以上で中止頻発という公開情報に基づく目安。

### 5.7 セルの共通レイアウト : 「カテゴリアイコン (大) ＋ 実数 ＋ バッジ」

Yuka さん指摘 : 「風 / 雨 / 熱 / JMA / Open-Meteo は文字ばっかりで分かりづらい。普通の天気予報はもっとアイコン大きめでぱっと見が分かる」

→ **カテゴリアイコン (32 - 40px) を主役に、数値とバッジは補足** に再設計。

#### 列ヘッダー (各列の頂上に大きいアイコン)

| 列 | アイコン (Material Symbols) | サイズ | ラベル |
|---|---|---|---|
| 風 | `air` | 28px | 「風」 |
| 雨 | `umbrella` | 28px | 「雨」 |
| 熱 (WBGT) | `thermostat` | 28px | 「熱」 |
| JMA / Open-Meteo の天気概況 | (各セルで天気アイコン) | - | 「気象庁」「Open-Meteo」 |

#### 各セルの構造

```
┌──────────────────┐
│   (air アイコン)  │  ← 32px、控えめ色
│   9m/s            │  ← 数値、大きめ
│   [風バ]          │  ← 色付きバッジ
└──────────────────┘
```

JMA / Open-Meteo セルは **天気状況アイコンを主役** に :

```
┌──────────────────────┐
│ (wb_sunny 40px 黄)   │  ← 大きい天気アイコン
│ 晴れ                  │  ← 概況テキスト
│ 26℃ / 18℃            │  ← 気温 (色分け §3.2)
│ 雨 30%                │  ← 降水確率
└──────────────────────┘
```

#### 天気概況 → アイコンマッピング

`src/utils/weatherIcon.js` 新規。天気概況テキストから Material Symbols 名を返す :

| 天気 | アイコン | 色 |
|---|---|---|
| 晴れ | `wb_sunny` | `#F2A93B` (黄) |
| 晴れ時々曇り | `partly_cloudy_day` | `#E48732` (オレンジ) |
| 曇り | `cloud` | `#7C8696` (灰) |
| 曇り時々晴れ | `cloud` | `#7C8696` (灰) |
| 雨 | `rainy` (または `umbrella`) | `#3F6FAE` (青) |
| 大雨 | `thunderstorm` | `#2C4D8E` (濃青) |
| 雪 | `ac_unit` | `#3A8AB8` (青緑) |
| 雷 | `bolt` | `#9B59B6` (紫) |
| 霧 | `foggy` | `#A0A8B5` (灰青) |

#### 数値 (主表示)

- 文字サイズ : 16-18px (大きめ)
- 色 : 本文と同じ黒 (ダークモードでは白)
- 等幅 : `font-variant-numeric: tabular-nums`
- 単位 : PC は併記 (`9m/s` `45%` `WBGT 29`)、スマホは省略可

#### バッジ (副表示)

- 色 : 危険度に応じた背景色 (通常 ＝ 緑系、注意 ＝ 黄系、危険 ＝ 赤系)
- サイズ : 角丸の小さいラベル (`border-radius: 4px ; padding: 2px 6px ; font-size: 0.75rem`)
- 「通常」「雨無」のように危険でないラベルは控えめなグレー背景にして主張を抑える

#### DOM 構造

```html
<!-- 風 ・ 雨 ・ 熱セル -->
<span class="cell">
  <span class="material-symbols-rounded cat-icon">air</span>
  <span class="value">9m/s</span>
  <span class="badge badge-warn">風バ</span>
</span>

<!-- JMA / Open-Meteo セル -->
<span class="cell weather-cell">
  <span class="material-symbols-rounded weather-icon weather-sunny">wb_sunny</span>
  <span class="weather-text">晴れ</span>
  <span class="temp-row">
    <span class="temp-max">26℃</span> / <span class="temp-min">18℃</span>
  </span>
  <span class="pop">雨 30%</span>
</span>
```

#### バッジクラス対応 (CSS)

| クラス | 用途 | 背景色 |
|---|---|---|
| `badge-normal` | 通常運行 ・ 雨なし | `#E8F3EA` (薄緑) ＋ 文字 `#2D8F3E` |
| `badge-warn` | 風バ ・ 雨バ ・ 暑さ注意 ・ 熱バ | `#FBE9A6` (薄黄) ＋ 文字 `#8A5A00` |
| `badge-danger` | 中止リスク高 ・ 雨キャン濃厚 ・ 熱キャン濃厚 | `#FAD7D7` (薄赤) ＋ 文字 `#A12626` |
| `badge-critical` | ほぼ中止 | `#D24A4A` (赤背景) ＋ 文字白 |

#### ツールチップ

各セルの hover / focus で補足を表示 :

- 「この数値はショー時刻 ±1h の最大値です」
- 「全日最大値は ◯◯」
- 「WBGT は環境省取得 / 簡易計算」を明示

---

## 6. 画面要件

### 6.1 レイアウト (PC 想定 1280px)

```
┌────────────────────────────────────────────────────────┐
│ Disney 行く日きめるダッシュボード     [更新] [Notion送信] [QR] │
├────────────────────────────────────────────────────────┤
│ [パーク TDL/TDS]  [平日/土日祝]  [日付順/スコア順] [○以上のみ] │
├────────────────────────────────────────────────────────┤
│ ◆ カレンダー (日付順 ・ デフォルト表示)                    │
│ 日付 曜 スコア 朝/昼/夜 風         雨        熱        JMA Open-Meteo OW │
│ 6/2  月 ◎ 92  ◎/◎/○   5m/s 通常 10% 雨無  WBGT22 通常 ...               │
│ 6/3  火 △ 58  ○/△/×   9m/s 風バ 45% 雨バ  WBGT26 注意 ...               │
│ 6/4  水 ◎ 88  ◎/◎/○   6m/s 通常 15% 雨無  WBGT24 通常 ...               │
│ ...                                                                       │
│ 7/15 水 × 32  △/×/△   4m/s 通常 5% 雨無   WBGT32 熱キャン ...           │
├────────────────────────────────────────────────────────┤
│ (行クリックで時系列詳細 折れ線グラフ ＋ 服装サジェスト)       │
├────────────────────────────────────────────────────────┤
│ ★ 14日のうちベスト3 (下部サマリ)                          │
│  ◎ 6/14 (日) スコア92  風弱め晴れ                        │
│  ◎ 6/15 (月) スコア90  ...                               │
│  ◎ 6/22 (月) スコア87  ...                               │
└────────────────────────────────────────────────────────┘
```

並び順の意図 : 上から下に「全体カレンダー → 詳細 → 厳選ベスト3」と進む。Yuka さんは日付順カレンダーを主に見て、決めかねたら下のベスト3で再確認、という想定。

デフォルトソートは **日付順** (旧 : スコア順)。localStorage に前回設定が保存されていない場合は日付順。

### 6.2 スマホ (375px) 対応

- テーブルは横スクロール可
- 1行に「日付 ･ スコア ･ パレードバッジ」だけ、各ソースの詳細はタップで展開
- 順序は PC と同じ : フィルター → カレンダー → 詳細 → TOP3 サマリ
- TOP3 は下部にカード型で表示
- **ヘッダーの操作群はハンバーガーメニューに集約 (Yuka さん要望)** : §6.11 参照

### 6.11 ハンバーガーメニュー (狭幅時のヘッダー)

PC 幅 (≧ 768px) では従来どおりヘッダー右側に操作ボタンを横並びで表示。
スマホ ・ タブレット狭幅 (< 768px) では右上に `menu` アイコンボタン (3本線) を置き、タップでドロワーを開く。

#### メニュー項目 (上から)

1. URL をコピー (旧 QR 機能)
2. Notion 送信
3. カレンダー登録
4. 印刷
5. ダークモード切替
6. 用語集 / ヘルプ
7. 強制更新
8. 出典 (フッターへスクロール)

#### 仕様

- 開閉アニメ : 200ms スライドイン (右からドロワー)
- 閉じるトリガー : 外側タップ ・ `Esc` キー ・ メニュー項目選択後
- ARIA : ボタンに `aria-expanded` 、ドロワーに `role="menu"` ＋ 各項目 `role="menuitem"`
- フォーカス制御 : 開いた瞬間に先頭項目へ `focus()` 、閉じたら開閉ボタンに戻す
- スワイプで閉じる (オプション、Phase 2)
- 閉じ時はオーバーレイで背景をやや暗くする

#### 該当ファイル

`src/ui/header.js` ＋ `src/ui/menu.js` 新規 ＋ `src/styles.css` のメディアクエリ追加

### 6.3 スコア表記と配色 (テキストラベル化 ・ Yuka さん再指摘)

旧仕様で `◎ ○ △ ×` を主表示としたが、「何を示してるか分からない」(Yuka さん指摘)。記号自体は学校の通知簿風で日本人になじみがあるものの、初めて見る人 (同行者含む) には意味が伝わらない。

→ **直接的な日本語テキストラベルに変更** :

| 旧記号 | 新テキスト | 文字色 |
|---|---|---|
| ◎ | **行くべき** | `#2D8F3E` (緑) |
| ○ | **行ってよい** | `#88C057` (薄緑) |
| △ | **微妙** | `#F2A93B` (黄) |
| × | **別日** | `#D24A4A` (赤) |

セル表記 :

```
旧 :  ◎ 92           → 「これは何?」状態
新 :  行くべき 92    (太字 ・ 緑色)
新 :  行ってよい 78  (太字 ・ 薄緑)
新 :  微妙 58       (太字 ・ 黄)
新 :  別日 32       (太字 ・ 赤)
```

- ラベルが太字 ・ 主役、数値はラベル右に同サイズ or 一回り小さく
- 色は危険度を補強 (緑 ＝ いい日、赤 ＝ ダメな日)
- 記号 ◎ ○ △ × は **完全廃止** (本文 ・ ARIA から削除)

#### サブスコア (朝/昼/夜)

サブスコアも記号廃止、**数値だけのカラーピル**に変える :

```
旧 :  朝×昼×0夜×             (字面が詰まって読めない)
新 :  [朝 78]  [昼 92]  [夜 58]
       薄緑     濃緑       黄
```

- ピル背景色 ＝ スコア帯の色 (薄緑/濃緑/黄/赤)
- 数値の文字色は背景に合わせて読みやすく (白 or 黒)
- 昼ピルだけ少し大きめ ・ 太字で強調
- スコア未取得 (データなし) は灰色ピル + `-`

#### スコア凡例カード (常時表示)

テーブル上部 ・ ステータスバーの下に常時表示する :

```
スコア凡例 :  [行くべき] = 風 ・ 雨 ・ 暑さすべて OK  /  [行ってよい] = 軽微  /  [微妙] = 風バ or 雨バ域  /  [別日] = 中止リスク高
```

折りたたみ可。初回ロード時のみ展開、以降 localStorage に保存。

ARIA : `aria-label="6月2日 月曜日 行くべき スコア92"` (記号を含めない)

中止リスク高のバッジは `#D24A4A` 背景 ＋ 白文字 ＋ **テキストラベル「中止リスク高」を明示** (アイコン依存にしない)。

スコアセル以外のアイコン (気象 ・ 操作) は引き続き Material Symbols を使用 (詳細は §6.10) :

- 操作 : `refresh` (更新) `print` (印刷) `share` (共有) `dark_mode` (ダーク切替)
- フォント未読み込み時のフォールバック : `font-display: swap` ＋ アイコン直下にテキストラベルを併記 (例 `[更新]` `[印刷]`)

絵文字は使わない (CLAUDE.md ルール : web 成果物は絵文字禁止)。

**スコアセルへのアイコン併記は廃止** :

- 旧仕様の図形記号 `■ ▲ ●` を廃止 (§0.3 / §0.5)
- 続いて Material Symbols アイコン (`check_circle` `check` `warning` `block`) もスコアセルから廃止 (Yuka さん指摘 : フォント未読み込み時に `check_circle` も `check` も `✓` になり、「✓○80」のように ◎ と ○ の区別がつかない)
- ◎ ○ △ × の文字記号自体が学校の評価でなじみがあり、色 ＋ 数値と組み合わせれば判別に十分

ARIA (スクリーンリーダー対応) :

```html
<span role="img" aria-label="6月2日 月曜日 スコア92 行くべき">
  <span class="symbol">◎</span>
  <span class="score">92</span>
</span>
```

中止リスク高のバッジは `#D24A4A` 背景 ＋ 白文字 ＋ **テキストラベル「中止リスク高」を明示** (アイコン依存にしない)。

スコアセル以外のアイコン (気象 ・ 操作) は引き続き Material Symbols を使用 :

- 気象 : `wb_sunny` (晴れ) `cloud` (曇り) `umbrella` (雨) `air` (風) `thermostat` (気温) `wb_twilight` (UV)
- 操作 : `refresh` (更新) `print` (印刷) `share` (共有) `dark_mode` (ダーク切替)
- フォント未読み込み時のフォールバック : `font-display: swap` ＋ アイコン直下にテキストラベルを併記 (例 `[更新]` `[印刷]`)

絵文字は使わない (CLAUDE.md ルール : web 成果物は絵文字禁止)。

### 6.4 アクセシビリティ

- すべてのスコア表記に `aria-label` (例 `aria-label="6月2日 月曜日 スコア92 ◎"`)
- 色だけでなく記号でも識別可
- フォントサイズ最小14px、行高1.5以上
- フォーカスインジケータを明示 (キーボード操作対応)

### 6.5 ローディング / エラー UI

- 初回 fetch 中は各ソース列にスケルトン表示
- 取得失敗時 : セルに「取得失敗 [再試行]」リンク
- 全ソース失敗時のみ全画面エラー画面 (それまでは部分表示で継続)

### 6.6 ダークモード

- OS 設定 (`prefers-color-scheme`) に追従、画面右上トグルで明示切替も可
- ダークでは ◎ ○ の緑をやや明るめに調整 (彩度↑)、× の赤も視認性確保
- 設定は localStorage 保存

### 6.7 自動バックグラウンド更新

- ページが開いている間、60秒ごとに silent reload (API キャッシュ TTL を上回ったときだけ実 fetch)
- タブが非アクティブの間は停止 (battery / quota 配慮)

### 6.8 PWA 対応

- `manifest.json` ＋ Service Worker でホーム画面追加可能に
- オフライン時は直前キャッシュからの表示にフォールバック
- アイコンは Material Symbols ベースの SVG をアプリアイコン化

### 6.9 印刷用 CSS

- §3.17 と整合。`@media print` で TOP3 / 決定日サマリのみを 1ページに収める
- 不要 UI (ナビ ・ ボタン ・ グラフのインタラクション) を非表示
- バッジは黒枠 ＋ 記号 (色印刷を前提にしない)

### 6.9.5 デザイントークン (公式 TDR トーン準拠 ・ Yuka さん指摘「寂しい」対応)

Yuka さん要望 : <https://www.tokyodisneyresort.jp/> の雰囲気に寄せる。

公式トップを確認した結果 (2026/05/30) :

- 背景は白 ・ 写真主導 ・ メインビジュアルが大きい
- ヘッダーアイコンは色分け (赤 / 緑 / 青 / ピンク / オレンジ)
- ロゴはレトロ風セリフ ・ 手書き要素
- 色味 : 青空 ・ ピンク ・ ゴールド ・ 鮮やか
- 親しみやすい角丸 ・ 柔らかいシャドウ

これを踏まえたデザイントークン (CSS 変数) :

```css
:root {
  /* 色 : ディズニートーン */
  --primary       : #4A90D2;  /* ディズニーブルー (パーク青空) */
  --primary-dark  : #2C6EAE;
  --primary-light : #B8E0FE;
  --accent        : #E84A8C;  /* ピンク (ミニーリボン) */
  --accent-2      : #F0B040;  /* ゴールド (キラキラ) */

  /* 状態色 */
  --excellent     : #2D8F3E;  /* 行くべき (緑) */
  --good          : #88C057;  /* 行ってよい (薄緑) */
  --fair          : #F2A93B;  /* 微妙 (黄) */
  --poor          : #D24A4A;  /* 別日 (赤) */

  /* 背景 ・ 面 */
  --background    : #FBFCFE;  /* オフホワイト (青み) */
  --surface       : #FFFFFF;
  --surface-2     : #EEF4FB;  /* 淡い水色 */
  --surface-hover : #DCE7F5;
  --border        : #D5E2F0;
  --border-strong : #4A90D2;  /* 強調区切り線 */

  /* テキスト */
  --text          : #1E2A3A;
  --text-sub      : #5A6B82;
  --text-mute     : #8693A8;

  /* タイポ */
  --font-heading  : "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
  --font-body     : "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", sans-serif;
  --font-numeric  : "Inter", "Segoe UI", system-ui, sans-serif;  /* 数値の見やすさ */

  /* 形 */
  --radius        : 12px;
  --radius-sm     : 8px;
  --radius-pill   : 999px;

  /* 影 (柔らかく ・ 青み) */
  --shadow-soft   : 0 4px 16px rgba(74, 144, 210, 0.10);
  --shadow-card   : 0 2px 8px rgba(74, 144, 210, 0.06);
  --shadow-hover  : 0 8px 24px rgba(74, 144, 210, 0.16);

  /* グラデーション (ヒーロー ・ アクセント) */
  --gradient-hero    : linear-gradient(135deg, #4A90D2 0%, #B8E0FE 100%);
  --gradient-magic   : linear-gradient(135deg, #E84A8C 0%, #F0B040 50%, #4A90D2 100%);
  --gradient-subtle  : linear-gradient(180deg, #FBFCFE 0%, #EEF4FB 100%);
}

[data-theme="dark"] {
  --primary       : #5BA3E0;
  --primary-light : #3A5A78;
  --accent        : #FF6FA8;
  --accent-2      : #FFC661;

  --background    : #0F1828;   /* 深い夜のネイビー */
  --surface       : #1A2638;
  --surface-2     : #243349;
  --surface-hover : #2E4060;
  --border        : #324560;
  --border-strong : #5BA3E0;

  --text          : #E8EEF6;
  --text-sub      : #A7B3C4;
  --text-mute     : #6C7B91;

  --shadow-soft   : 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-card   : 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-hover  : 0 8px 24px rgba(0, 0, 0, 0.5);

  --gradient-hero    : linear-gradient(135deg, #2C6EAE 0%, #4A90D2 100%);
  --gradient-magic   : linear-gradient(135deg, #FF6FA8 0%, #FFC661 50%, #5BA3E0 100%);
  --gradient-subtle  : linear-gradient(180deg, #0F1828 0%, #1A2638 100%);
}
```

#### 装飾要素

- **ヘッダー** : `--gradient-hero` 帯 (上部 80px ・ 高さ可変) ＋ タイトルロゴをセリフ体で大きく
- **TOP3 カード** : `--shadow-soft` ＋ `--radius` 16px ＋ アクセントカラーの斜めリボン (例「ベスト!」「2位」)
- **カレンダー行** : 通常は白、ホバーで `--surface-hover`、行末に chevron アイコン (`--primary` 色)
- **スコアラベル ・ バッジ** : それぞれの状態色に淡い背景 ＋ 太字テキスト
- **詳細パネル** : 開いた瞬間に下から slide-down 200ms、左カラム上に `--gradient-magic` の細い水平リボン
- **見出し** : `border-bottom: 2px solid var(--accent)` ＋ 左の丸ドット (`--primary`)
- **アイコン** : Material Symbols ＋ 状態色 ・ アクセントカラー
- **ボタン** : ピンクアクセント (`--accent`) 背景 ＋ 白文字 ＋ 角丸 ＋ ホバーでわずかに膨張

#### タイポグラフィ

- 見出し (h1, h2, h3) : `var(--font-heading)` (Noto Serif JP) ・ 太字 700
- 本文 : `var(--font-body)` (Noto Sans JP) ・ 400-500
- 数値 (スコア ・ 気温 ・ 風速等) : `var(--font-numeric)` (Inter) ・ `font-variant-numeric: tabular-nums`
- 日付 : ボディとサイズ違いでメリハリ (大きい数字 ＋ 小さい曜日)

#### 写真要素 (任意 ・ Phase 1.5)

公式の「メインビジュアルが大きい写真」のトーンを真似て、TOP3 セクション上部にうっすらパーク風景 (フリーの夕焼け空 / 花火 / シルエット) のグラデーション。著作権配慮のため画像素材は使わず、CSS グラデーションだけで「夢っぽさ」を表現。

#### 削除 ・ 簡素化

- 灰色背景 ・ 没個性のボーダーを廃止
- 単調なテーブルラインは細く目立たなく
- 余白を多めにとって伸び伸びと

詳細は CHANGES.md §0.6.10 を参照。

### 6.10 ブラウザ互換テスト (チェックリスト)

- iOS Safari (最新 ＋ 1世代前)
- Android Chrome (最新)
- macOS Safari / Chrome / Firefox
- Windows Edge / Chrome
- 200% ズーム時の崩れ無し
- スクリーンリーダー (VoiceOver / TalkBack) 読み上げ確認

---

## 7. 技術スタック

### 7.1 推奨構成

Cowork Artifact (単一 HTML) として実装。理由 : Yuka さんが日常使い、リロード ＝ 最新取得を artifact のキャッシュ機構と合わせやすい、デプロイ不要、同行者には URL 共有 or 画面共有で対応。

- HTML / CSS / Vanilla JS (単一ファイル)
- Chart.js (CDN) で時系列グラフ
- Grid.js (CDN) でテーブル
- Material Symbols (CDN) でアイコン
- localStorage で UI 状態 (ソート ･ フィルター ･ 決定日) を保存

### 7.2 API 呼び出し

artifact 内から `fetch()` で直接呼ぶ。CORS は :

- JMA : CORS 許可されている
- Open-Meteo : CORS 許可されている
- OpenWeather : CORS 許可されている

OpenWeather の API キーは artifact 内に書かず、Cloudflare Workers のプロキシ経由で渡す。
**初期実装では Open-Meteo ＋ JMA のみで動くようにし、OpenWeather は後付け** (キー管理が面倒なので)。

### 7.3 ディレクトリ構成

artifact 化するので最終的には単一 HTML だが、開発用には以下に分けてビルド :

```
disney-weather/
├── README.md
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml          # lint + test on PR
├── CHANGELOG.md
├── src/
│   ├── index.html
│   ├── main.js
│   ├── service-worker.js   # PWA / オフラインキャッシュ
│   ├── manifest.json
│   ├── config/
│   │   └── location.js     # 観測地点 ・ コード (§3.13)
│   ├── data/
│   │   ├── jma.js          # 気象庁 fetch & 正規化
│   │   ├── jmaNowcast.js   # 雨雲レーダー (§3.18)
│   │   ├── openMeteo.js    # Open-Meteo fetch & 正規化
│   │   ├── openWeather.js  # OpenWeather fetch & 正規化 (任意)
│   │   ├── envWbgt.js      # 環境省 WBGT (§4.4)
│   │   ├── tdrOperation.js # TDR 公式運営状況 (§3.20)
│   │   ├── crowd.js        # 混雑予想連携 (§3.21)
│   │   ├── holidays.js     # 祝日 ･ 学校休暇判定
│   │   └── showSchedule.js # ショー ･ パレード時刻 (固定 JSON、priority 付き)
│   ├── score/
│   │   ├── scoring.js      # §5 のロジック
│   │   ├── wbgt.js         # WBGT 簡易計算 (§3.11)
│   │   └── reliability.js  # ソース信頼度補正 (Phase 2)
│   ├── ui/
│   │   ├── table.js
│   │   ├── chart.js
│   │   ├── filters.js
│   │   ├── top3.js
│   │   ├── outfit.js       # 服装サジェスト
│   │   ├── help.js         # 用語集 ・ FAQ モーダル (§3.16)
│   │   ├── vote.js         # 同行者投票 (§3.23)
│   │   ├── aiSummary.js    # Claude AI サマリ ・ 質問応答 (§3.22)
│   │   ├── nowcast.js      # 雨雲レーダー埋め込み (§3.18)
│   │   ├── print.js        # 印刷モード制御 (§3.17 / §6.9)
│   │   └── theme.js        # ダークモード切替 (§6.6)
│   ├── integrations/
│   │   ├── notion.js
│   │   ├── gcal.js
│   │   ├── slack.js        # 自動通知の Slack 投稿 (§3.19)
│   │   └── scheduler.js    # scheduled task 自動登録 (§3.19)
│   ├── utils/
│   │   ├── date.js         # JST 統一ユーティリティ
│   │   ├── units.js        # m/s, km/h, ℃ 統一
│   │   ├── cache.js        # localStorage キャッシュ (10分TTL)
│   │   ├── freshness.js    # データ鮮度ラベル算出 (§3.14)
│   │   └── logger.js
│   └── styles.css
├── tests/
│   ├── scoring.test.js
│   ├── jma.test.js
│   ├── openMeteo.test.js
│   ├── wbgt.test.js
│   ├── utils/date.test.js
│   ├── mocks/handlers.js   # msw 共通モック
│   ├── e2e/                # Playwright シナリオ
│   └── fixtures/           # 各 API のレスポンスサンプル
├── workers/
│   └── openweather-proxy.js # Cloudflare Workers (任意)
└── dist/
    └── artifact.html       # ビルド成果物 (Cowork に登録するもの)
```

ビルドは `npm run build` で `dist/artifact.html` を生成 (vite-plugin-singlefile を使う)。

### 7.4 テスト

- **ユニット (Vitest)**
  - `tests/scoring.test.js` : 各スコア式の境界値テスト (gust=4.9 / 5.0 / 7.9 / 8.0、wbgt=27.9 / 28.0 / 30.9 / 31.0 等)
  - `tests/jma.test.js` `tests/openMeteo.test.js` `tests/wbgt.test.js` : 各 API レスポンスのモック → 正規化結果が期待通り
  - `tests/utils/date.test.js` : JST 境界 (23:59 ↔ 00:00) の日付計算
  - カバレッジ目標 : スコアロジック 95% 以上、データ層 80% 以上
- **モック (msw)**
  - `tests/mocks/handlers.js` で全外部 API をモックし、ネット接続なしでテスト可能
  - 開発時の「オフラインデモ」モードでも流用
- **E2E (Playwright)**
  - シナリオ : ロード → スコア表示 → 行クリック → 詳細展開 → Notion 送信ボタン → カレンダー追加
  - スクリーンショット差分テストで UI 崩れ検知 (各ブレークポイント)
  - CI でヘッドレス実行

### 7.5 CI

`.github/workflows/ci.yml` で PR 時に :

1. `npm ci`
2. `npm run lint` (ESLint)
3. `npm run test` (Vitest)
4. `npm run build` (ビルドが通るか)

### 7.6 パフォーマンス目標

- 初回ロード ＜ 1.5s (3 sources を `Promise.all` で並列 fetch)
- 詳細パネル展開 ＜ 100ms (データはメモリ内)
- artifact サイズ ＜ 300KB (gzip 前)

---

## 8. データ構造 (内部正規化フォーマット)

全ソースを以下の形に揃えてから比較 ･ スコアリングする。

```ts
interface DailyForecast {
  source: 'jma' | 'open-meteo' | 'openweather';
  date: string;           // 'YYYY-MM-DD' (JST)
  weatherText: string;    // '晴れ時々曇り' 等
  tempMax: number | null; // ℃
  tempMin: number | null;
  feelsLikeMax: number | null;
  feelsLikeMin: number | null;
  popMax: number | null;  // 降水確率 %
  precipSum: number | null; // mm
  windMax: number | null;   // m/s
  gustMax: number | null;   // m/s
  wbgtMax: number | null;   // WBGT 暑さ指数 (環境省取得 > 簡易計算)
  wbgtSource: 'env-jp' | 'derived' | null;
  uvMax: number | null;
  hourly: HourlyPoint[];  // 9:00 - 22:00 を1時間刻みで
  fetchedAt: string;      // ISO8601 (キャッシュ用)
}

interface HourlyPoint {
  hour: number;            // 9, 10, ..., 22
  pop: number | null;
  precip: number | null;
  wind: number | null;
  gust: number | null;
  temp: number | null;
  feelsLike: number | null;
  humidity: number | null; // WBGT 計算用 (Open-Meteo の relative_humidity_2m)
  wbgt: number | null;
}
```

各 fetch モジュールは `Promise<DailyForecast[]>` を返す。エラー時は空配列を返してテーブルは表示を続行 (該当列だけ「取得失敗」)。

時刻はすべて JST 固定 (`Asia/Tokyo`)。`src/utils/date.js` に集約し、生の `new Date()` 直書き禁止 (timezone バグの典型)。

---

## 9. エラーハンドリング / キャッシュ / リトライ

### 9.1 fetch 失敗時

- ネットワークエラー → 2回までリトライ (指数バックオフ 500ms / 1500ms)
- それでも失敗 → 該当ソース列は「取得失敗 [再試行]」表示、他ソースは表示続行
- すべて失敗 → 「ネットワーク確認してね」全画面表示

### 9.2 キャッシュ

- localStorage に `weather_cache_v1_{source}_{date}` で保存
- TTL : 10分 (短時間に何度開いても無駄リクエストしない)
- 「強制更新」ボタンでキャッシュ無視

### 9.3 オフライン

- 直前キャッシュがあればそれを表示し「オフライン中 ・ {取得時刻}時点」と注意書き

### 9.4 ロギング

- `src/utils/logger.js` で `console.warn` / `console.error` をラップ
- artifact 内では Sentry までは入れない (個人ツール)。ただし将来差し替えやすく抽象化

---

## 10. 環境変数 ･ シークレット

`.env.example` :

```
# OpenWeather 連携を有効にする場合のみ
OPENWEATHER_API_KEY=
# Cloudflare Workers プロキシ URL (Workers にキーを置く場合)
OPENWEATHER_PROXY_URL=
```

- `.gitignore` には `.env`, `.env.*`, `.env.local`, `*.pem`, `*.key`, `credentials.json`, `*-service-account.json` を含める
- artifact 配布版にはキーを埋め込まない
- Notion / Google Calendar の認証は Cowork 接続済みコネクタを介して MCP 呼び出しするので、ローカル.env 不要

---

## 11. Notion 連携 (§3.6 補足)

### 11.1 連携先

Notion に「ディズニー行く日候補」DB を作る (Yuka さんが手動で作成 → URL を `src/integrations/notion.js` の定数 `NOTION_DB_ID` に設定)。

DB のプロパティ案 :

| プロパティ | 型 |
|---|---|
| 日付 | Date |
| 候補時のスコア | Number |
| 風速予報 (m/s) | Number |
| 降水確率 (%) | Number |
| パーク | Select (TDL / TDS / どちらでも) |
| ショー時刻スコア | Text (朝/昼/夜) |
| 同行者コメント | Text |
| ステータス | Select (検討中 / 決定 / 却下) |
| 取得時刻 | Created Time |

### 11.2 書き込み実装

artifact 内の「Notion 送信」ボタンが `window.cowork.callMcpTool('mcp__0659b728-c5ec-4b9c-b289-01bef999914e__notion-create-pages', { ... })` を呼ぶ。`mcp_tools` に Notion 連携 ID を登録する必要あり。

### 11.3 同期方向

artifact → Notion : 候補追加 ･ ステータス更新 (一方向)
Notion → artifact : 「同行者の都合NG日」と「投票リアクション」のみ取り込み (1日1回 fetch)

### 11.4 競合解消ポリシー

同行者と同時に Notion を書いて衝突した場合 :

- 基本は last-write-wins (Notion 側のタイムスタンプを真とする)
- ただし「コメント」プロパティだけは追記 (古いコメントを残し新規を末尾追加)
- ステータス変更で対立がある場合 (「決定」vs「却下」) は artifact 側で警告表示

---

## 12. Google Calendar 連携 (§3.9 補足)

「この日に決めた」フローで `mcp__0d41b0a4-c542-42f1-a379-349e38735111__create_event` を呼ぶ。

イベント内容 :

- タイトル : 「ディズニー (TDL / TDS)」
- 場所 : 「東京ディズニーリゾート」
- 開始 / 終了 : 当日 8:00 - 22:00 (パークオープン目安)
- 説明 : 当日の予報スコア ･ パレード時刻 ･ 持ち物リスト

実行前に確認ダイアログ (誤クリック防止)。

---

## 13. デプロイ ･ 配布

2系統並行で配布する。同じビルド成果物を両方に置き、ランタイムで挙動を出し分ける。

### 13.1 Cowork artifact (Yuka さん個人用 / Notion ・ GCal 連携あり)

1. ローカルで `npm install` → `npm run dev` で動作確認
2. `npm test` でユニットテスト通過確認
3. `npm run build` で `dist/artifact.html` を生成
4. Cowork の `mcp__cowork__create_artifact` で artifact 化
5. artifact を Yuka さん自身が日常的に使用

### 13.2 Cloudflare Pages 公開ページ (同行者共有 / 閲覧専用)

1. GitHub に push (個人 `yukasasaki/disney-weather` リポジトリ、public)
2. Cloudflare Pages ダッシュボードで GitHub 連携を設定
   - Build command : `npm run build`
   - Output directory : `dist`
   - Production branch : `main`
3. 初回ビルドで `https://disney-weather.pages.dev` 等の URL が発行される
4. (任意) 独自ドメインを Cloudflare で取得 ・ 設定
5. `main` へ push するたびに自動再デプロイ

### 13.3 ランタイム判定によるボタン出し分け

artifact ・ 公開ページの両方で同じ HTML を使い、`window.cowork` の有無で機能差を吸収 :

```js
const isCoworkRuntime = typeof window !== 'undefined' && typeof window.cowork === 'object';

if (isCoworkRuntime) {
  // Notion 送信 ・ カレンダー登録ボタンを表示
  // window.cowork.callMcpTool 経由で連携
} else {
  // 公開ページ : 上記ボタンを非表示
  // disclaimer に「個人連携機能は Cowork 版でのみ動作」を1行追記
}
```

ハンバーガーメニュー (§6.11) も同じ判定で項目を出し分ける。

### 13.4 公開ページの注意

- Notion / GCal ボタンは非表示
- 「URL をコピー」「印刷」「ダーク切替」「用語集」「強制更新」「出典」は全て動く
- 同行者が iPhone Safari / Android Chrome で直接開ける
- データは引き続きブラウザ側で気象庁 / Open-Meteo / 環境省 (簡易計算) を直接 fetch

### 13.5 OpenWeather プロキシ (Phase 2 任意)

1. `cd workers && npx wrangler deploy` (Cloudflare Workers)
2. 出力された URL を `OPENWEATHER_PROXY_URL` 定数に設定
3. Cloudflare Pages と Workers は同じアカウントで完結

---

## 14. 受け入れ基準 (Definition of Done)

機能 (Phase 1) :

- [ ] 今日 ＋ 14日分の日付がテーブルに並ぶ
- [ ] JMA (北西部) ＋ アメダス ＋ Open-Meteo の予報が表示される (片方落ちても他方は表示)
- [ ] 各日に総合スコア (◎ ○ △ ×) ＋ 朝/昼/夜 サブスコアが出る (昼が最重要)
- [ ] 各日に風キャン / 雨キャン / 熱キャン の3バッジが出る
- [ ] WBGT が表示される (環境省取得 or 簡易計算、ソースを区別表示)
- [ ] TOP3 が画面上部にハイライトされる
- [ ] 行クリックで時系列グラフ ＋ 服装サジェストが開く
- [ ] フィルター (平日/土日祝/○以上のみ) とソート (スコア/日付) が動く
- [ ] フィルター状態と決定日が localStorage で永続化される
- [ ] スマホ (375px) でも閲覧できる
- [ ] 「Notion 送信」ボタンで候補日が DB に記録される
- [ ] 「カレンダー登録」ボタンで Google Calendar に予定追加される
- [ ] 「同行者NG日」を手動 × マークできる
- [ ] データ鮮度ラベル (「最終更新 ◯分前」) が全セルに出る
- [ ] disclaimer が常時表示
- [ ] 用語集モーダルが開ける (風バ / 熱バ / キャングリ 等)
- [ ] 印刷モード (`@media print`) が機能する
- [ ] 雨雲レーダー (ナウキャスト) が当日 ・ 前日のみ表示
- [ ] 決定日に対し 3日前 / 前日 / 当日朝 の scheduled task が登録される
- [ ] ダークモード切替が機能する (OS連動 ＋ 手動)
- [ ] PWA としてホーム画面追加できる

機能 (Phase 2) :

- [ ] TDR 公式運営状況ページが1日3回取得され、的中追跡に蓄積される
- [ ] 混雑予想と合成スコアがオプションで表示できる
- [ ] Claude AI 自然文サマリが TOP3 横に表示される
- [ ] 同行者投票 (Notion リアクション集計) が表示される
- [ ] 的中ダッシュボード別 artifact が動く

品質 :

- [ ] スコアロジックのテストカバレッジ ≧ 95%、データ層 ≧ 80%
- [ ] msw モックでオフラインでも全画面動作
- [ ] Playwright E2E ハッピーパスがCIで通る
- [ ] スクリーンショット差分テストで UI 崩れ0
- [ ] ESLint エラー0
- [ ] 初回ロード ＜ 1.5s、 artifact サイズ ＜ 300KB (gzip前)
- [ ] WCAG AA 相当のコントラスト (ダークモード含む)
- [ ] キーボードのみで全操作可
- [ ] iOS Safari / Android Chrome / macOS Safari / Edge で表示崩れ0
- [ ] 200% ズームで崩れ0
- [ ] スクリーンリーダー (VoiceOver) で主要要素が読み上げられる
- [ ] 絵文字を含まない (Material Symbols で代用)
- [ ] 約物ルール準拠 (中黒は半角 `･` 等)

---

## 15. リスク ･ 懸念

| リスク | 影響 | 対策 |
|---|---|---|
| JMA JSON 構造が非公式で予告なく変わる | 取得失敗 | fetch モジュールを薄く保ち、変わったら正規化部分だけ直す。テストでサンプル固定 |
| Open-Meteo の非商用ライセンス | 商用利用不可 | 個人用途のみ。社内配布する場合は再確認 |
| OpenWeather 1000 calls/day 超過 | 表示欠落 | キャッシュ10分 + プロキシ側でレートリミット |
| パレード時刻が公式と乖離 | スコアずれ | 公式サイト目視更新を月1で運用 (READMEに手順) |
| 同行者の Notion アクセス権 | 共有失敗 | Notion ページは「リンクを知っている人全員 閲覧可」前提 |
| Cowork artifact 共有時の権限 | 同行者が開けない | 事前に artifact 共有可否を Cowork で確認 |
| 風速の m/s vs km/h 換算ミス | スコア大誤算 | `src/utils/date.js` 同様に `units.js` を作り、内部は m/s 統一 |
| timezone (UTC vs JST) ずれ | 日付が1日ずれる | 全 fetch モジュールで `timezone=Asia/Tokyo` を明示。`new Date()` 直書き禁止 |
| 色覚多様性で◎○△×の色が伝わらない | 判別不能 | 色 ＋ 記号 (◎○△×) ＋ 数値 ＋ アイコン の4重表現。`■▲●` 図形記号は混乱を生むので廃止 |
| WBGT 簡易計算の精度限界 | 熱キャン判定が外れる | 環境省取得を最優先、フォールバック時は「推定値」表示。±1.5℃ 程度の誤差を許容 |
| 環境省 WBGT 予測の提供期間 | 夏期 (4 - 10月) のみ | 期間外は簡易計算で代替し、注釈表示。コードで分岐 (現在月で API 切替) |
| ディズニー公式中止基準の非公開 | スコアと実態がズレる | 過去の中止実績を §3.12 の追跡データで補正 |
| TDR 公式ページのスクレイピング規約 | アクセス拒否 ・ 法的リスク | User-Agent 明示 ・ 1日3回上限 ・ robots.txt 確認 ・ 取得失敗時は黙って外す |
| ナウキャスト iframe の CSP | 表示不可 | 失敗検知後は「公式ページを開く」リンクにフォールバック |
| Service Worker のキャッシュ古い問題 | 古いスコアロジックが動き続ける | バージョン文字列を URL に埋め、SW 更新時に強制リフレッシュ |
| Cowork artifact API のレート制限 | askClaude / Notion 連携が失敗 | 失敗時は静かに非表示、UI は天気だけで動く設計 |
| 同行者 Notion 同時編集衝突 | データ破損 | §11.4 last-write-wins ＋ コメント追記 |
| アクセシビリティ非対応の UI 残存 | スクリーンリーダーで使えない | E2E に axe-core を組み込み CI 失敗で気付く |
| WBGT 計算の単位ミス (℃ vs ℉) | スコア大誤算 | `units.js` で内部単位を ℃ 統一、テストで境界確認 |
| Phase 1 のままで凍結 | 機能要望が溜まる | CHANGELOG.md と Notion 「要望リスト」DB で見える化 |

---

## 16. 将来拡張 (Phase 3)

- 過去中止実績との照合 ML : §3.12 ・ §3.20 のログから「この気象条件は過去◯%中止」を統計予測
- マルチパーク展開 (USJ ・ 富士急ハイランド ・ 沖縄美ら海 等) : 座標 ＋ ショー時刻データを足すだけで横展開
- LINE / メール通知 : 個人向けプッシュ通知 (家族同行者がいる場合に重宝)
- パスポート連動 : 販売状況 ・ 価格変動を画面に併記
- ホテル ・ 駐車場連動 : 周辺ホテル価格 ・ 舞浜駅周辺駐車場の混雑予想
- 「行ったあと」フォトログ自動連携 (Google Photos)
- 健康警告 : 花粉症シーズン ・ インフル流行期 ・ 紫外線アレルギー 等

---

## 17. 開発上の注意 (組織ポリシー再掲)

- リポジトリは `komorebi-tools` 組織下に作る (`gh repo create komorebi-tools/disney-weather`)
- `.env` 系はコミット禁止
- web 成果物に絵文字を使わない (アイコンは Material Symbols)
- 約物ルール (中黒は半角 `･`、全角括弧禁止 等) を web 表示テキストにも適用
- `git push --force` 禁止、`git reset --hard` 指示無しでは実行禁止

---

## 18. 法務 / 倫理 / 出典

### 18.1 スクレイピング非採用ポリシー

- tenki.jp / Yahoo! 天気 / ウェザーニュース は公式 API があれば使う。スクレイピングは規約上不可なので採用しない
- TDR 公式 (`tokyodisneyresort.jp`) は公開ページの軽量取得のみ許容 (User-Agent 明示 ・ 1日3回以内 ・ robots.txt 遵守)
- 規約変更があればすぐに該当機能を停止する運用 (README に明記)

### 18.2 出典明記 (フッター固定)

画面下と README に常時表示 :

- 気象庁 (政府標準利用規約)
- Open-Meteo (CC BY 4.0、非商用無料)
- 環境省 暑さ指数 (政府標準利用規約)
- OpenWeather (利用規約に従う、API キー保持者の責任)
- 東京ディズニーリゾート公式ページの引用 (出典明記、リンク復元可能な形)

### 18.3 disclaimer

§3.15 と整合。「本ツールは公開予報からの推定であり、公式発表ではない」を画面下に常時表示。

### 18.4 個人情報

- 同行者名は localStorage に保存しない、Notion DB の「同行者コメント」プロパティでのみ管理
- Cookie / トラッキングは入れない (個人ツール)

---

## 19. 運用 ・ メンテ

### 19.1 CHANGELOG.md

- セマンティックバージョニング (`MAJOR.MINOR.PATCH`)
- 変更分類 : `Added` / `Changed` / `Fixed` / `Removed` / `Security`
- 仕様書 (この MD) も「変更履歴」セクションを末尾に持つ

### 19.2 ショー時刻データの更新フロー

- TDR 公式の日別ショースケジュールページ (`/tdl/daily/calendar/{YYYYMMDD}/` ・ `/tds/daily/calendar/{YYYYMMDD}/`) を Cloudflare Workers + Browser Rendering で取得 (§3.10)
- 取得頻度 : 深夜 02:00 に 14日分一括 ＋ 当日 06:00 に当日分を再取得
- パース後の正規化 JSON を Workers KV / R2 に保存し、artifact から `fetch` で取得
- 失敗時のフォールバック : `src/data/showSchedule.js` 内の典型時刻 JSON
- 「翌月分は前月8日頃に公式更新」を踏まえ、月初に Yuka さんが UI で新規ショー名を確認、`showPriority.js` を更新 (PR 提出)
- 内部 API が見つかった場合は Browser Rendering 不要 → コスト削減のため定期的に再調査

### 19.3 WBGT 期間外対応

- 環境省 WBGT 予測は概ね 4 - 10月のみ提供
- 期間外は `envWbgt.js` がエラーを返す → `wbgt.js` の簡易計算に自動切替
- 画面には「11月 - 3月は WBGT 簡易計算」と注釈

### 19.4 古い localStorage キーのマイグレーション

- スキーマ変更時は `weather_cache_v{N}_*` の N を上げる
- 旧キーは1週間 grace period で残し、自動消去
- `migration.js` を起動時に1回実行

### 19.5 監視 ・ アラート

- 各 API のエラー率を console に出すだけでなく、週1で Slack に「サマリ通知」(scheduled task)
- 「過去7日で X 回失敗、最頻はこのソース」のレポート

### 19.6 リポジトリ運用

- `main` ブランチは保護 (Yuka さん承認なしでは push 不可)
- 機能ごとに feature ブランチ → PR → squash merge
- artifact は `release/` ディレクトリにバージョン別保管

---

## 20. Phase 分割案 (進め方)

完成度を上げつつ、動くものを早く見たいので段階リリース推奨。Phase の整合を以下に整理。

### Phase 0 : MVP (半日)

- JMA (北西部 120010) ＋ Open-Meteo の2ソース
- テーブル表示 (15日 × 主要指標)
- 総合スコア ＋ 風キャン / 雨キャン / 熱キャン 3バッジ
- 観測地点ロジック (§3.13)
- データ鮮度ラベル (§3.14)
- disclaimer (§3.15)

### Phase 1 : 完成版 (1 - 2日)

- TOP3 ハイライト (§3.7)
- 時系列詳細パネル (§3.4)
- 服装サジェスト (§3.8)
- 決定フロー ＋ Notion / GCal 連携 (§3.9 ・ §11 ・ §12)
- ショー時刻データ (§3.10、フォールバックの固定 JSON ＋ `showPriority.js`)
- WBGT 取得 ＋ 計算 (§3.11 ・ §4.4)
- 用語集 (§3.16) ・ 印刷モード (§3.17) ・ 雨雲レーダー (§3.18) ・ 自動通知 (§3.19)
- ダークモード (§6.6) ・ 自動更新 (§6.7) ・ PWA (§6.8)
- Vitest ＋ msw ＋ Playwright E2E

### Phase 2 : 運用しながら強化 (2週目以降)

- OpenWeather 追加 (§4.3)
- TDR 公式ショースケジュール自動取得 (§3.10 ・ §3.20 ・ §19.2)
  - 内部 API 探索 (Network タブで `/api/calendar/...` 等を確認)
  - 見つからなければ Cloudflare Workers Browser Rendering でバッチ取得
- 公式運営状況 (`/info/operation.html`) 取得と中止フラグ蓄積
- 混雑予想連携 (§3.21)
- Claude AI サマリ ・ 質問応答 ・ 新規ショー名の priority 自動判定 (§3.22)
- 同行者投票 (§3.23)
- 過去予報の的中追跡 ＋ ダッシュボード (§3.12)
- ソース信頼度補正 (§5.4)

### Phase 3 : 将来拡張

- 過去中止実績との ML
- マルチパーク展開
- LINE / メール通知
- パスポート ・ ホテル ・ 駐車場連携
- 健康警告

Yuka さんは Phase 0 → Phase 1 → 使ってみて → Phase 2 へ という流れがおすすめ。

---

## 参考リンク

- 気象庁 API : <https://www.jma.go.jp/bosai/forecast/data/forecast/120000.json>
- 気象庁 開発者向けポータル : <https://www.data.jma.go.jp/developer/index.html>
- Open-Meteo Docs : <https://open-meteo.com/en/docs>
- OpenWeather One Call 3.0 : <https://openweathermap.org/api/one-call-3>
- 環境省 暑さ指数 電子情報提供サービス : <https://www.wbgt.env.go.jp/data_service.php>
- TDR 公式 日別運営カレンダー (TDL 例) : <https://www.tokyodisneyresort.jp/tdl/daily/calendar/20260604/>
- TDR 公式 運営状況 (中止 ・ 変更告知) : <https://www.tokyodisneyresort.jp/info/operation.html>
- Cloudflare Workers Browser Rendering : <https://developers.cloudflare.com/browser-rendering/>
- パレード中止基準 (参考記事) :
  - <https://ddtrip.jp/tdr-wind-cancel/>
  - <https://nata-note.com/disney-windcancel/>
  - <https://castel.jp/p/2485>
- 熱キャン基準 (参考記事) :
  - <https://ddtrip.jp/tdr-heat-cancel/>
  - <https://nata-note.com/disney-heatcancel/>
  - <https://castel.jp/p/8381>
- vite-plugin-singlefile : <https://github.com/richardtallent/vite-plugin-singlefile>
