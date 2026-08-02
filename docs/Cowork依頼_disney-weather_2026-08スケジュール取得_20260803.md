# Cowork 依頼 : disney-weather 2026-08 公式スケジュール取得

作成 : 2026-08-03 / 依頼元 : Claude Code セッション

## ミッション

`~/claude/personal/disney-weather` の **`src/data/schedule/2026-08.json` を新規作成**してください。
公式サイトから 8 月分のショー ･ パレード時刻を取得して構造化するだけの作業です。**git 操作は不要**です (コミット ･ push は Claude Code 側で行います) 。

## なぜ Cowork に依頼するか

公式サイト (tokyodisneyresort.jp) は Akamai Bot Manager で保護されており、**headless ブラウザや curl からは応答が返りません** (TCP は繋がるが HTTP 無応答) 。
既存の `2026-06.json` も `"source": "Cowork Chrome MCP (Browser 2) 経由で取得"` ･ 注記に「Akamai Bot Manager は個人 Chrome 経由なら通過」とあり、実ブラウザ経由が唯一の取得手段です。

## 取得範囲

- **日付 : 2026-08-03 〜 2026-08-17 (15 日分)**
  アプリの予報が 16 日先までなので、表示に必要なのはこの範囲です。月末まで取る必要はありません。
- **パーク : TDL ･ TDS の両方** (計 30 ページ)

## URL

```
https://www.tokyodisneyresort.jp/tdl/daily/calendar/{YYYYMMDD}/
https://www.tokyodisneyresort.jp/tds/daily/calendar/{YYYYMMDD}/
```

例 : `https://www.tokyodisneyresort.jp/tdl/daily/calendar/20260803/`

サーバー負荷に配慮し、**ページ間は 3 秒空けてください** (既存スクリプトの規約遵守方針に合わせています) 。

## 抽出コード (動作確認済み)

現在の公式 DOM は `li > a > div.listTextArea > p.heading3` 構造です。
既存スクリプト `scripts/fetch-schedule.mjs` の `parseDay()` のセレクタは**すべて 0 件で古くなっている**ので使わないでください。
下記は 2026-08-10 の TDL ページで実際に正しく取れることを確認済みです。ページ読み込み完了後に評価してください。

```js
() => {
  const out = [];
  for (const li of Array.from(document.querySelectorAll('li'))) {
    const nameEl = li.querySelector('.listTextArea .heading3, .listTextArea h4, .listTextArea p');
    if (!nameEl) continue;
    const name = (nameEl.textContent || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const full = (li.innerText || '').replace(/\s+/g, ' ').trim();
    const times = (full.match(/([0-2]?\d:[0-5]\d)/g) || []).filter((x, i, a) => a.indexOf(x) === i);
    out.push({ name, times, full });
  }
  const openClose = (document.body.innerText.match(/([0-2]?\d:[0-5]\d)\s*[-〜~–]\s*([0-2]?\d:[0-5]\d)/) || [])[0] || null;
  return { openClose, items: out };
}
```

## 出力スキーマ

`2026-06.json` と**完全に同じ形**にしてください。

```json
{
  "month": "2026-08",
  "fetchedAt": "2026-08-03T00:00:00+09:00",
  "source": "Cowork Chrome MCP 経由で取得",
  "note": "8/3〜8/17 (15日分) を取得。<気づいた点をここに書く>",
  "days": {
    "2026-08-03": {
      "TDL": {
        "openHour": "09:00",
        "closeHour": "21:00",
        "shows": [
          { "name": "ディズニー･ハーモニー･イン･カラー", "times": ["17:00"], "priority": "medium", "kind": "parade-day", "tags": ["プレミアアクセス"] }
        ]
      },
      "TDS": { "openHour": "...", "closeHour": "...", "shows": [] }
    }
  }
}
```

## 取捨選択のルール (重要)

1. **時刻のある公演だけ入れる。** アトラクション ･ レストラン ･ ショップ ･ 各国語の案内リンクは全部捨ててください。ページ末尾に大量にぶら下がっています。
2. **グリーティング施設の営業時間は捨てる。** `9:00 - 19:15` のような「開始 - 終了」形式はショーではありません。`10:00 / 12:50 / 14:55` のようなスラッシュ区切りが公演時刻です。
3. **時刻が入っていない公演は入れない。** 例 : 2026-08 の `スカイ･フル･オブ･カラーズ` は項目として存在しますが時刻がありません (夏季休止 2026-06-15 〜 2026-09-14) 。これは**除外**してください。
4. **例外 : 事前予約制のショーレストラン**は時刻が無くても 1 件残してください。
   例 : `ミッキーのレインボー･ルアウ` → `{ "name": "...", "times": [], "priority": null, "kind": "show-restaurant", "tags": ["予約必須"] }`
5. **ショー名の中黒は半角 `･`** にしてください (既存データがすべて半角です) 。公式表記は全角 `・` なので置換が必要です。

## priority / kind の割り当て

`scripts/fetch-schedule.mjs` の `PRIORITY_RULES` に準拠してください。

| 判定 | priority | kind |
|---|---|---|
| ハーモニー ･ イン ･ カラー | medium | parade-day |
| Reach for the Stars | high | show-day |
| スパークリング ･ ジュビリー | high | show-day |
| スウィーツフルタイム | high | show-day |
| ジャンボリミッキー | medium | show-indoor |
| エレクトリカルパレード / ドリームライツ | low | parade-night |
| ビリーヴ / ナイトハーバー | low | show-night |
| スカイ ･ フル ･ オブ ･ カラーズ | high | fireworks |
| 上記以外 | medium | show-unknown |

**注意 : ハーモニーは `medium`** です。`PRIORITY_RULES` には high と書かれていますが、§0.76 で medium に降格済みで、`2026-06.json` の実データも medium です。実データ側に合わせてください。

### 新しく出てきたショー

8/10 の TDL ページで、既存ルールに無いショーを 2 件確認しています。いずれも `medium` / `show-unknown` で構いません。判断に迷ったら `medium` に倒してください (`high` はスコア算定窓に直接効くため、安全側は medium です) 。

- `ベイマックスのミッション･クールダウン` (10:00 / 12:50 / 14:55)
- `ミッキーのマジカルミュージックワールド` (10:50 / 12:15 / 13:40 / 15:45 / 17:10)

## やってはいけないこと

- **git 操作は一切しない** (`git add` / `commit` / `push`) 。ファイルを置くだけにしてください
- `docs/CHANGES.md` を触らない (無関係な未コミット差分が残っています)
- `src/data/showSchedule.js` の `FALLBACK_SCHEDULE` を編集しない (公式データが入れば fallback は使われません)
- 取れなかった日を**推測で埋めない**。取得できなければその日は `days` に入れず、`note` に「8/xx は取得失敗」と書いてください

## 完了報告に含めてほしいこと

1. 実際に取得できた日付の範囲と日数
2. 取得に失敗した日があればその日付と理由
3. 既存ルールに無い新規ショーがあれば名前 ･ 時刻 ･ 割り当てた priority
4. 休止 ･ 早閉め ･ 時刻の大きなズレなど気づいた点

## 参考 : 既に判明していること

- `2026-08-10` の TDL は開園 9:00 - 21:00
  - ハーモニー ･ イン ･ カラー 17:00 / エレパレ 19:45 / ジャンボリミッキー 18:00 ･ 19:20 ･ 20:35
  - Reach for the Stars: Everlasting Dreams 20:55
  - ミッキーのマジカルミュージックワールド 10:50 ･ 12:15 ･ 13:40 ･ 15:45 ･ 17:10
  - ベイマックスのミッション ･ クールダウン 10:00 ･ 12:50 ･ 14:55
  - スカイ ･ フル ･ オブ ･ カラーズ は**時刻なし** (夏季休止)
- 7 月の運航ログ由来 (TDS) : ダンス ･ ザ ･ グローブ！は 16:05 / 17:55 / 19:40 で公演実績あり

ファイルが置かれたら、Claude Code 側で内容を検証してコミット ･ push します。
