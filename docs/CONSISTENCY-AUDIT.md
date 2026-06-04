# CONSISTENCY AUDIT (§0.67) — マイハマびより (disney-weather)

§0.61 〜 §0.66 の大規模改修後の総整合性監査。DESIGN-AUDIT.md (§0.60) と並列の文書。
**本監査は調査のみ ・ UI / ロジック変更は行っていない。** 修正は Yuka さん確認後 ・ §0.68 以降で別 PR。

- 監査日 : 2026-06-04 (§0.65 / §0.66 反映後の状態)
- 方法 : 静的解析 (3 並列エージェントで src 全読) + chrome-devtools MCP 実描画 (PC 1280 / モバイル 375 / 文字サイズ大 / 詳細展開 / park タブ) + ESLint + Vitest カバレッジ
- 各項目 : 現状 (file:line) / 修正案 / 重要度 (高 ・ 中 ・ 低) / 影響範囲

---

## 優先度サマリ (高 ・ 中のみ)

| # | 重要度 | カテゴリ | 要点 |
|---|---|---|---|
| L-1 | **高** | ロジック | `capped = score < rawScore` が §0.66 後に基準ズレ → `score < base` にすべき |
| D-1 | **高** | データ | 格下げツールチップが旧 `rawScore` を「平均値スコア」と誤表示 (§0.66 で base は band 平均に) |
| S-1 | **高** | データソース | `top3` の `isNg` デッドフィルタ — 常に undefined で NG 日が TOP3 に出る |
| L-2 | 中 | ロジック | 寒さ (cold) / UV が band 日スコアをバイパス (冬日で誤った高スコア) |
| L-3 | 中 | ロジック | band=ピーク (windowMax) / 日バッジ=平均 (showWindow) で同日内の評価軸が逆 |
| D-2 | 中 | データ | TOP3 の WBGT が `wbgtMax`、カードは `wbgtShowWindow` で食い違い |
| S-2 | 中 | データソース | 環境省 WBGT 実値が hourly に反映されず、「環境省」ラベルなのに派生値で採点 |
| S-3 | 中 | データソース | fallback スケジュールに期間限定公演がハードコード (翌月以降で陳腐化) |
| L-4 | 中 | ロジック | floorCap と warnCountCap が冗長 ・ 効いた cap を特定不能 |
| C-1 | 中 | コード品質 | dead CSS 約 120-150 行 (§0.64.3 で置換された subscore-pill 系) |
| C-2 | 中 | コード品質 | showRisk.js:17 の stale comment (WBGT 整数 → 実装は小数 1 桁) |
| C-3 | 中 | コード品質 | `showWindow ?? max` パターンが 14 箇所に重複 |
| C-4 | 中 | コード品質 | daySummary.js / extremeWarning.js がテスト 0 件 (スコア表示直結) |
| A-1 | 中 | a11y | park タブに `aria-selected` / `aria-controls` 欠落 (選択中パークが SR で不明) |

---

## 1. データ整合性

### D-1【高】格下げツールチップが §0.66 後に内容矛盾 (「平均値スコア」+ rawScore 参照)
- 現状 : `src/ui/table.js:535` `scoreTitle = `平均値スコア ${ev.rawScore} だが ${reasonBadge} により…格下げ``。§0.66 で日スコアの基準は `rawScore` (全要素加重平均) から `base = weightedBandTotal` (時間帯加重平均) に変わった (scoring.js:430) のに、ツールチップは旧基準 `rawScore` を「平均値スコア」と称して表示。実スコア `score` は `base` 起点なので数値が一致しない。
- 修正案 : 文言を「時間帯平均スコア ${ev.base} だが…」に、参照を `ev.base` に変更。
- 重要度 : 高 / 影響範囲 : カードのスコアセル title。納得感に直結。L-1 とセットで修正。

### D-2【中】TOP3 と カードで WBGT 参照軸が不一致
- 現状 : カードセル `table.js:514` は `wbgtShowWindow ?? wbgtMax` (ショー窓平均) を表示。TOP3 `top3.js:45-46` と heatAlert バナー `table.js:562` は `wbgtMax` (日次最大の加重平均)。同じ日でカード「熱 28.3」/ TOP3「WBGT 31.0」のように食い違う。§0.57.1 でカードは showWindow に統一した経緯に TOP3 が未追随。
- 修正案 : TOP3 も `wbgtShowWindow ?? wbgtMax` に統一。heatAlert はピーク警戒の意図なら wbgtMax 維持 + コメント明記。
- 重要度 : 中 / 影響範囲 : TOP3 カードの WBGT 値。

### D-3【低】WBGT 1dp は全箇所徹底済 (確認結果)
- 現状 : `table.js:179/515/522/297`, `top3.js:46`, `heatAlert.js:11` すべて小数 1 桁。整数丸めの残存なし。気温行 `table.js:305` の `Math.round` は気温なので整数で正しい。
- 重要度 : 低 (問題なし)

### D-4【低】ソースレベル (気象庁 / Open-Meteo) 値表示は整合
- 現状 : `sourceCellHtml` (table.js:98-125) は各ソース生値、集計セルは加重平均で役割分担明確。雨量は rainSub (table.js:92) ・ 集計セル (table.js:508) とも 1dp で単位統一済。
- 重要度 : 低 (問題なし)

---

## 2. ロジック整合性

### L-1【高】`capped` フラグが新基準と不整合
- 現状 : `src/score/scoring.js:441` `const capped = score < rawScore;`。最終 `score` は `base` (band 平均) 起点なのに `rawScore` (旧 ・ 要素平均) と比較。キャップが一切効いていない日でも `rawScore > score` だと capped=true になり、D-1 のツールチップが誤って出る (逆も然り)。
- 修正案 : `const capped = score < base;` (キャップ群で base から下がった時のみ true)。
- 重要度 : 高 / 影響範囲 : 格下げツールチップの出現条件 (table.js:527)。D-1 と一体修正。

### L-2【中】寒さ (cold) / UV が band 日スコアをバイパス
- 現状 : `bandSubscore` (scoring.js:357-369) は風 ・ 雨 ・ 熱のみ。§0.66 で日スコアは `base = weightedBandTotal(subscores)` が基準になったため、cold / uv 減点 (rawScore には入る) が band データのある日は捨てられる (scoring.js:430)。真冬の体感 3℃ でも band に問題なければ日スコアが 100 近くに出る (「全部 OK だが寒い」が乗らない = §0.66 が解いた問題の cold / UV 版)。cold / UV にバッジが無く applyBadgeGuard でも救済されない。
- 修正案 : `bandSubscore` に `coldDeduction` を加える、または `base = Math.min(bandAvg, rawScore)` で要素ベースを下限ガードに (後者が surgical)。
- 重要度 : 中 (夏季中心の現状は露出小、冬日で顕在化) / 影響範囲 : 寒い日 ・ 高 UV 日の日スコア。

### L-3【中】band=ピーク / 日バッジ=平均 で評価軸が逆
- 現状 : `bandSubscore` (scoring.js:360-361) は `windowMax` (時間帯ピーク) で減点。日バッジ (evaluateDay:411-423) は `gustShowWindow = windowMean` (ショー窓平均)。詳細パネルは両者を縦に並べる (table.js:424 と 575) ため「夜 FAIR なのに風バッジは通常」が同画面に並ぶ。コメント (scoring.js:184/248「スコア=平均 / バッジ=ピーク」) とも逆 (band は「スコア=ピーク」)。§0.66 は band-日スコアの整合は取ったが band-日バッジは未整合。
- 修正案 : band サブスコアも `windowMean` に揃える (要 §0.55 分布再確認)。windowMax 採用が意図的かを確定。
- 重要度 : 中 / 影響範囲 : 詳細パネルの時間帯サブスコア値 ・ 日スコア全体 (ピーク基準のため辛め)。

### L-4【中】floorCap と warnCountCap / popScoreCap が多重適用
- 現状 : `scoring.js:440` `score = Math.min(guard.score, pCap, cCap, floorCap)`。4 経路が同じ 59 / 74 / 89 の天井を別根拠で出す。`Math.min` なので結果は壊れないが、(1) どの cap が効いたか特定できずツールチップは badge 由来しか説明しない、(2) floorCap (band FAIR→74) と warnCountCap (warn 1個→89) は同日に発火しやすく冗長。
- 修正案 : §0.66 で floorCap を入れた以上 warnCountCap は役割重複。一本化するか、残すなら「安全網の二重化 (band データ欠落日向け)」とコメント明記 + 効いた cap を戻り値に持たせ D-1 のツールチップで出し分け。
- 重要度 : 中 / 影響範囲 : スコア算定の説明可能性 (数値は不変)。

### L-5【低】§0.42.4 クランプの dead code は無し (コメントのみ)
- 現状 : `scoring.js:443` に「§0.42.4 クランプは撤廃」の履歴コメントが残るのみ。実コード (clamp ループ) は全 src で該当 0 件。
- 重要度 : 低 (履歴コメントとして妥当 ・ 対応不要)

### L-6【低】bandSubscore の factor tie-break が決め打ち
- 現状 : `scoring.js:368` 風と雨が同点最大のとき常に「風」。scoreReason の主因表示が恣意的。
- 重要度 : 低 / 影響範囲 : スコア理由の主因ラベルのみ。

---

## 3. UI 整合性

### U-1【中】(D-2 再掲) カード vs TOP3 の WBGT 数値不一致 → 視覚的にも別値
- D-2 参照。同じ日で違う WBGT が出る UI 不整合。重要度 中。

### U-2【低】欠損プレースホルダの記号が混在 (`—` vs `-`)
- 現状 : 数値欠損は全面的に `'—'` (EM DASH) で統一 (fmtNum 等)。ただし `components.js:85` のサブスコア行だけスコア欄に半角 `-`、バッジに「データなし」。同じ欠損概念に `—` / `-` / `データなし` の 3 表記。
- 修正案 : `components.js:85` の `-` を `—` に統一 (バッジ「データなし」はラベルとして可)。
- 重要度 : 低 / 影響範囲 : 詳細パネルの朝 / 昼 / 夜サブスコア。

### U-3【確認 OK】文字サイズ「大」/ PC・モバイルでのレイアウト
- 現状 : DevTools で文字サイズ大 (data-font-size=large) に設定 → スコアセクション (score-head / ss-row) ・ 気候 dc-row とも overflow なし。PC 1280 / モバイル 375 とも §0.64.3 案A の band 行が崩れず描画。アクセントバー (禁止パターン) は 0 件 ([No accent bars] 遵守)。
- 重要度 : なし (良好)

### U-4【低】(C-1 と同根) dead CSS の存在は UI トークンの肥大化につながる
- C-1 参照。styles.css 3075 行 ・ 旧 subscore 系の死蔵。色 / フォントトークンは §0.60.A で :root 一本化済みで重複新規発生は確認されず。

---

## 4. データソース統合

### S-2【中】環境省 WBGT 実値が hourly に反映されず採点に乗らない
- 現状 : `main.js:75-85` applyEnvWbgt は環境省実値を日次 `wbgtMax` のみ上書きし `wbgtSource='env-jp'` を立てるが `hourly[].wbgt` には書かない。表示 (table.js:514) ・ スコア (scoring.js:332) は `wbgtShowWindow`(= hourly 由来 = 常に派生値 deriveWbgt) を優先。結果、hourly のある通常日は「環境省」ラベルなのに実際は派生計算値で採点。`parseEnvWbgtCsv` (wbgt.js:51-71) は hourly もパース済なのに applyEnvWbgt が捨てている。
- 修正案 : applyEnvWbgt で `info.hourly` を OM の `f.hourly[].wbgt` に時刻一致でマージ + 各 point の wbgtSource 更新。あるいはラベル判定を「実際に使った値の source」に直す。
- 重要度 : 中 (環境省取得成功日のデータ正確性 ・ ラベル信頼性) / 影響範囲 : WBGT セル ・ ツールチップ ・ WBGT スコア。

### S-3【中】fallback スケジュールに期間限定公演がハードコード
- 現状 : `showSchedule.js:8-24` FALLBACK_SCHEDULE に「スカイ･フル･オブ･カラーズ」等の期間限定ナイト公演を固定保持。official JSON は 2 ヶ月分のみ (schedule/2026-05 ・ 06) で、表は 15 日先まで表示 (main.js)。翌月分 ・ 取得失敗日は fallback になり、終了済みショーを high (メインスコア算定窓) として採点し続けるリスク。`getDaySchedule` は official 有無のみで切替え fallback の鮮度を検証しない。
- 補足 : §0.64.2 で fallback にスカイを追加したのは「現行期間に出ない」問題の解消だったが、期間終了後は逆に陳腐化する両刃。
- 修正案 : fallback エントリに `validUntil` を持たせ期限切れ除外、または fallback 日は high をスコア算定窓に使わず medium 相当に降格。最低限 UI で「予定は代表値」明示。
- 重要度 : 中 / 影響範囲 : showWindowHours → 全スコア ・ TOP3 ・ ショー一覧。7 月以降に顕在化。

### S-4【低】import.meta.glob パターンは概ね一貫
- 現状 : glob 4 箇所 (cancelHistoryLoader / forecastSnapshots / operationLog / showSchedule) すべて `{ eager:true }` + `mod.default || mod`。cancelHistoryLoader だけ path を捨てる (各 JSON 内 month/park を信頼する設計) が動作上問題なし。
- 重要度 : 低 (報告のみ)

### S-5【低】リモート 4 ローダの fetch / parse / error 構造はソース間で一貫
- 現状 : jma / openMeteo / openWeather / jmaWarning は「withRetry + res.ok + normalize 分離 + catch で空配列/null」の同型。設計品質良好。
- 重要度 : 低 (良好)

---

## 5. エラーハンドリング

### S-1【高】top3 の `isNg` デッドフィルタ
- 現状 : `top3.js:30` `.filter((r) => r.eval && !r.isNg)`。しかし buildRows (main.js:117-138) は row に `isNg` を設定せず (grep 0 件) 常に undefined → 全件通過。NG 日除外の意図が不達。全候補が NG (悪天候続き) でも最高スコアの NG 日が「第1位」推奨に出る。
- 修正案 : `r.eval.symbol.key !== 'ng'` (または `r.eval.score >= 40`) に修正。
- 重要度 : 高 (推奨ロジックのバグ ・ アプリ中核「行く日を選ぶ」の意図不達) / 影響範囲 : TOP3 候補選定。

### E-1【中】(C-4) daySummary / extremeWarning のエラー分岐がテスト未検証
- C-4 参照。

### E-2【低】「全ソース失敗」判定が render と updateStatus で二重定義 ・ 条件微差
- 現状 : main.js:199 (render, rows.length も条件) と main.js:159/182 (updateStatus, ok のみ) で「失敗」定義が別。stale フォールバック時 (main.js:61 で ok=true) の挙動は妥当だが将来の不整合リスク。
- 修正案 : `allSourcesDown()` ヘルパに集約。重要度 : 低。

### E-3【低】欠損記号は概ね `—` 統一 (U-2 再掲)、JMA 単独日の風欠損は silent
- 現状 : OM 全滅 + JMA stale のみの日は風 null → 減点 0 = 高スコアになり得る (悪天見落とし方向)。ただし OM が 16 日まで風を返すため発生は稀。
- 重要度 : 低 (発生条件稀)

---

## 6. アクセシビリティ

### A-1【中】park タブに `aria-selected` / `aria-controls` 欠落
- 現状 : `table.js:422-427` park-tabs は `role="tablist"` ・ タブは `role="tab"` を持つが、アクティブ判定は class `active` のみで **`aria-selected` が未設定**。`aria-controls` で show-list パネルとも紐付いておらず、show-list に `role="tabpanel"` も無い。スクリーンリーダーが選択中パークを判別できない。
- 修正案 : アクティブタブに `aria-selected="true"` (他は false)、`aria-controls="<show-list id>"`、show-list に `role="tabpanel"` + id を付与。クリックハンドラ (table.js:606-609) で aria-selected もトグル。
- 重要度 : 中 / 影響範囲 : 詳細パネルの TDL/TDS タブ。

### A-2【確認 OK】良好な点
- カレンダー行 : `role="button"` ・ `tabindex="0"` ・ `aria-expanded` 設定済 (Enter/Space 対応も実装あり)。
- ss-rows : `role="img"` + aria-label (55 文字の時間帯サマリ) で SR 対応。
- バッジ : §0.39.10 で severity アイコン併用済 ・ 色のみ依存していない (色覚多様性対応)。
- 文字サイズ機能 : `data-font-size` を html に設定する方式で動作 ・ 大でも崩れず (U-3)。

---

## 7. コード品質

### C-1【中】dead CSS 約 120-150 行 (§0.64.3 で置換された subscore-pill 系)
- 現状 : §0.64.3 のスコア体系刷新で旧 UI が ss-rows / ss-row 系に置換され、JS から emit されない CSS が残存。確認済み dead (grep 0 件) :
  - `.subscore-pill` (styles.css:419 のセレクタ行 / 438-440 / 1327 / 2604-2615)
  - `.subscore-group` (564-569 / 1884)
  - `.subscore` ・ `.subscore .time-label` ・ `.subscore .symbol` (571-587)
  - `.subscore-main` 系 (590-614)
  - `.time-label` / `.time-range` / `.time-key` (580 / 600 / 2604-2613)
  - その他 : `.sb-wbgt` 系 (1725-1738), `.cancel-lv4` (651 セレクタ行のみ ・ level は 0-3 のみ), `.wbgt-tag` (700-707), `.show-tags` (823), `.legend-toggle` (1471-1487) 他
- **削除禁止 (動的生成で生存)** : `.cell-rain`/`.cell-wind` (cell-${kind}), `.reason-*` 6種 (reason-${cat}), `.priority-low`/`-medium` (priority-${cls}), `.cancel-lv0..3`。
- 修正案 : 上記 dead ブロックを削除 (約 120-150 行減)。カンマ群 (419/1327/1331) は該当セレクタ行のみ除去。削除後 `npm run build` 確認。
- 重要度 : 中 / 影響範囲 : 描画影響なし ・ styles.css 肥大 (3075 行) の解消。

### C-2【中】showRisk.js:17 の stale comment
- 現状 : `showRisk.js:17` 「風速は小数 1 桁、WBGT は整数」とあるが、§0.65.1 で line 34/38 (`meanAt('wbgt', 1)`) で WBGT も小数 1 桁化済。コメントが実装と矛盾。
- 修正案 : line 17 を「風速 ・ WBGT とも小数 1 桁 (§0.65.1)」に修正。
- 重要度 : 中 (読み手を誤誘導) / 影響範囲 : コメントのみ。

### C-3【中】`showWindow ?? max` パターンが 14 箇所に重複
- 現状 : `m.xShowWindow != null ? m.xShowWindow : m.xMax` が scoring.js:330-332/411-413, table.js:500-501/514, outfit.js:112-114, top3.js:14/42-43 に散在。
- 修正案 : `showWindowOrMax(m, 'gust')` 共有ヘルパ化、または `m.gustShowWindow ?? m.gustMax` で三項を簡素化。
- 重要度 : 中 / 影響範囲 : scoring + ui 3 ファイル。

### C-4【中】daySummary.js / extremeWarning.js がテスト 0 件
- 現状 : ESLint クリーン ・ Vitest 160 件 ・ src/score 全体 93.4%。ただし `daySummary.js` (28 行) と `extremeWarning.js` (20 行) はカバレッジ 0% + 対応テストなし。いずれもスコア表示 (この日の概要 ・ 極端警報) に直結する分岐を持つ。
- 修正案 : `tests/daySummary.test.js` / `tests/extremeWarning.test.js` 追加。
- 重要度 : 中 / 影響範囲 : テスト網羅性。

### C-5【低】evaluateDay の `base` フィールドが未使用 (dead field)
- 現状 : §0.66 で追加した戻り値 `base` は src/ui ・ テストとも未消費 (`weightedTotal`/`floorCap`/`worstSeverity` はテストでのみ assert)。
- 修正案 : D-1/L-1 修正で `ev.base` をツールチップに使えば解消。それまで保持で可 (報告のみ ・ 勝手削除しない)。
- 重要度 : 低 / 影響範囲 : 戻り値オブジェクト。

### C-6【低】1 桁丸め `Math.round(v*10)/10` の重複
- 現状 : accuracyLogLoader.js:24 (round1) / heatAlert.js:11 (インライン) / showRisk.js (10**decimals 版) で別実装。
- 修正案 : utils に `round1` 切り出して共有。重要度 : 低。

---

## §0.60 DESIGN 系問題の再発チェック

- 色トークン : §0.60.A で :root 一本化済 ・ 新規重複の発生なし (確認 OK)。
- アクセントバー (禁止) : 0 件 (U-3)。
- dead CSS : §0.60.B でも .subscore-pill が報告されていたが、§0.64.3 でさらに増えた (C-1 で網羅)。**未解消 ・ 今回 PR §C で一括除去推奨。**

---

## 修正の PR 分割推奨 (§0.68 以降)

§0.60 と同様、重要度と独立性で分割。

- **§A (高 ・ スコア基準ズレ)** : L-1 + D-1 を一体で。`capped = score < base` + ツールチップを base 基準に。dead field `base` 活用 (C-5 解消)。← 最優先
- **§B (高 ・ 推奨ロジック)** : S-1 top3 の isNg フィルタ修正。
- **§C (中 ・ コード品質一括)** : C-1 dead CSS 削除 + C-2 stale comment + C-3 重複ヘルパ化 + C-6 round1 共通化。UI 無変更 ・ 低リスク。
- **§D (中 ・ ロジック整合)** : L-2 (cold/UV バイパス) + L-3 (band ピーク/平均軸) + L-4 (cap 冗長 ・ 出し分け)。要 §0.55 分布再確認。
- **§E (中 ・ データソース)** : S-2 環境省 WBGT hourly マージ + D-2 TOP3 WBGT 軸統一。
- **§F (中 ・ a11y + 表記)** : A-1 park タブ aria-selected + U-2 欠損記号統一。
- **§G (中 ・ テスト)** : C-4 daySummary / extremeWarning テスト追加。
- **§H (要運用判断)** : S-3 fallback スケジュール陳腐化 (validUntil or 降格)。official JSON の月次投入運用とセットで。

最優先は **§A + §B** (§0.66 導入で取り残された capped 基準ズレ → 格下げ理由の誤表示、および推奨から NG を外す中核機能のバグ)。
