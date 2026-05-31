# マイハマびより 運用マニュアル

Yuka さん自身が運用する手順集。
Cowork (Claude desktop) / Claude Code (CLI) に何を頼めばよいかを明示。

公開 URL : <https://disney-weather.pages.dev>
リポジトリ : <https://github.com/yusasaki-025/disney-weather>

---

## 月初運用 (毎月 10日前後)

### 1. 翌月の公式ショースケジュール取得

公式の「翌月分は前月 8日頃に掲載」。Akamai bot 保護で自動取得不可、Cowork Chrome MCP (Yuka さん個人 Chrome 経由) でのみ通る。

**Cowork に依頼** :

```
disney-weather のショースケジュールを取得して。来月 (YYYY-MM) の TDL/TDS。
```

Cowork が Chrome MCP で 1日ずつ navigate ・ パース ・ JSON 化して `src/data/schedule/YYYY-MM.json` に保存。
全月分取得には 5-10分。完了後 Claude Code に commit & push 依頼。

### 2. 過去風キャン記録の追加 (TSUBASA のブログが新月分 PDF を公開したら)

公式は <https://ameblo.jp/tsu-disney/entry-12962621607.html> ・ 月末頃に新月分が追加される。

**Claude Code に依頼** :

```
disney-weather で新月分の風キャン記録を取り込んで。
Google Drive 共有リンク : https://drive.google.com/file/d/{fileId}/view
月 : YYYY-MM
```

Claude Code が curl で PDF ダウンロード → pdftotext → JSON 化 → `src/data/cancel-history/YYYY-MM.json` 保存 → commit & push。

### 3. 予報精度の蓄積 (毎朝の運用)

**毎朝 (起きてから外出前)** : Mac terminal で

```
cd ~/claude/personal/disney-weather && npm run snapshot-forecast
```

その時点の予報を保存 (`src/data/forecast-snapshots/YYYY-MM-DD.json`)。

**翌朝** :

```
npm run track-accuracy
```

前日予報と当日実測を比較し `src/data/accuracy-log.json` に追記。30日蓄積すれば精度ダッシュボード (Phase 3) が機能。

(将来は GitHub Actions cron で自動化予定)

---

## ディズニー行く日決め (実利用)

1. <https://disney-weather.pages.dev> をブラウザで開く (or iPhone ホーム画面アイコン)
2. **「おすすめ日のみ」チェック** で ベスト / OK の日に絞る
3. 候補日の **カードをタップ** → 詳細パネルで :
   - 時間帯スコア (朝 / 昼 / 夜)
   - ショースケジュール (TDL / TDS タブ ・ priority high の昼パレード太字)
   - 持ち物 ・ 服装サジェスト
   - 時系列グラフ
4. 同行者に **URL を共有** (LINE / メッセージで `https://disney-weather.pages.dev` を送る)
5. 行く日決定 → 公式 (Tokyo Disney Resort) チケット予約

---

## 緊急対応

### WBGT が「環境省」じゃなく「簡易計算」になっている

期間外 (11月 - 3月) は仕様。それ以外なら Workers (wbgt-proxy) のダウンの可能性。

**確認 ・ 復旧** :

```
disney-weather の WBGT プロキシの状態を確認して、必要なら再デプロイ
```

Cowork or Code が Cloudflare ダッシュボードで Workers のログ確認 → 必要なら `npx wrangler deploy --config workers/wrangler.toml`。

### 公式ショースケジュール取得失敗

Akamai bot 検知でブロック ・ 一時的な可能性大。

**対処** :
- 数時間後に再試行 (Cowork に再依頼)
- どうしてもダメなら手動で公式アプリ確認 ・ Cowork に「ハーモニーは 13:00 と 16:30 ・ ジュビレーションは 11:30 / 14:00 / 16:00」のように伝える

### 公開ページの表示異常

CF Pages のデプロイ失敗の可能性。

**確認** :
1. <https://dash.cloudflare.com> → Pages → disney-weather → Deployments
2. 最新ビルドが Success か確認
3. Failed なら ログを Cowork or Code に貼る

---

## 季節イベント切替時

### 新規ショー登場 (例 ハロウィーン期間「フレンジー」)

1. Cowork に「新ショー X の風キャン閾値が分からない、TSUBASA ブログ / X で過去記録を探して」と依頼
2. Cowork が情報収集 → `src/data/show-thresholds.js` に追加 → Code に commit 依頼
3. JSON スキーマも `src/data/schedule/YYYY-MM.json` に追加

### 季節パレード終了 (例 イッツ ・ ア ・ スウィーツフルタイム! が 6/30 終了)

1. 公式 calendar 取得時に自動で次月の JSON から消える
2. `show-thresholds.js` の項目は残しても害なし (将来再開時に使える)

---

## メンテナンス

### 月1コマンド集 (Mac terminal)

```sh
# 翌月のショースケジュール (Cowork 経由が推奨だが、ローカル試行も可)
# → 通常は Cowork に依頼

# 新月分の風キャン PDF 取り込み
npm run import-cancel-history -- YYYY-MM

# 毎朝
npm run snapshot-forecast

# 翌朝
npm run track-accuracy

# ビルド ・ 確認
npm test
npm run build
git push  # → CF Pages 自動再デプロイ
```

### データ削除 (誤情報修正)

JSON を直接編集 or 削除 → commit & push。
公開ページは数分で反映。

### バックアップ

GitHub repo がバックアップを兼ねる (yusasaki-025/disney-weather)。
ローカル消失しても `git clone` で復元可能。

---

## アクセス先まとめ

| 場所 | URL ・ 用途 |
|---|---|
| 公開ページ | <https://disney-weather.pages.dev> |
| GitHub repo | <https://github.com/yusasaki-025/disney-weather> |
| Cloudflare Dashboard | <https://dash.cloudflare.com> (Pi.pi.pi.025@gmail.com) |
| 仕様書 | repo の `docs/SPEC.md` |
| 変更履歴 | repo の `docs/CHANGES.md` |
| ユーザーマニュアル (同行者向け) | repo の `docs/USER-MANUAL.md` |
| アーキテクチャ | repo の `docs/ARCHITECTURE.md` |
| 運用マニュアル | この文書 (`docs/OPERATIONS.md`) |
| ショー時刻データ | repo の `src/data/schedule/` |
| 過去風キャン記録 | repo の `src/data/cancel-history/` |

---

## 連絡 ・ 質問

- 動作不具合 : GitHub Issues
- 開発依頼 : Claude Code (CLI) / Cowork (Claude desktop)
- 仕様変更 : docs/CHANGES.md に追記してから実装

---

(このページは Notion `Claude Code` ページに転載してもよい ・ md ベースで repo にも残す)
