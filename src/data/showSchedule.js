// ショー ･ パレードの時刻データ (§0.6.9 / §0.8)。
// 公式の月別 JSON (src/data/schedule/YYYY-MM.json、scripts/fetch-schedule.mjs で生成) があれば
// その日の実時刻を使い、無ければ下の FALLBACK (典型的な代表時刻) を使う。
// priority: high = 季節限定の昼公演 (最重要・メインスコア算定窓) / medium = 屋内・短時間 (補助) /
//           low = 通年演目のナイト公演 (参考表示のみ)。

// 典型値 (公式取得が無い日・取得失敗時の FALLBACK)
// 2026-08-02 公式サイト (tokyodisneyresort.jp) の月間スケジュールで確認 ・ 更新。
// ジュビレーション！(TDL) ・ ウィッシュ (TDS) は公式一覧から消滅しており終了済みのため削除。
export const FALLBACK_SCHEDULE = {
  TDL: [
    // §0.76 : ハーモニー ・ イン ・ カラーは通年演目なので high → medium (showWindow 判定対象外)。
    { name: 'ハーモニー･イン･カラー', time: '17:00', priority: 'medium', type: 'parade' },
    // ジャンボリミッキー！は現在 3 回公演 (18:00 / 19:20 / 20:35)。
    { name: 'ジャンボリミッキー！', time: '18:00', priority: 'medium', type: 'show' },
    { name: 'ジャンボリミッキー！', time: '19:20', priority: 'medium', type: 'show' },
    { name: 'ジャンボリミッキー！', time: '20:35', priority: 'medium', type: 'show' },
    { name: 'エレクトリカルパレード･ドリームライツ', time: '19:45', priority: 'low', type: 'parade' },
    // §0.64.2 : 両パーク共通の期間限定ナイト花火。official 未取得日 (fallback) でも TDL/TDS 両方に出す。
    // §0.76 : 期間限定花火なので high (showWindow 判定対象)。
    // §0.83 : 2026-06-15 〜 2026-09-14 は夏季休止 (両パーク) のため period で除外する。
    //   period 未設定だと休止中の 8 月にも fallback 表示されてしまっていた。
    //   再開後の単発休止日 (TDL : 2026-10-02 / 2026-12-04、TDS : 2026-09-25 / 2026-11-27) と
    //   2026-12-26 〜 2027-01-12 の休止は、公式発表ベースで Yuka さんが手動更新する (§0.39.7 運用方針)。
    { name: 'スカイ･フル･オブ･カラーズ', time: '20:30', priority: 'high', type: 'show', period: ['2026-09-15', null] },
  ],
  TDS: [
    // ウィッシュ終了に伴い、後継のスパークリング ・ ジュビリー ・ セレブレーションが high 枠を引き継ぎ。
    { name: 'スパークリング･ジュビリー･セレブレーション', time: '17:00', priority: 'high', type: 'show' },
    { name: 'ビリーヴ！～シー･オブ･ドリームス～', time: '20:15', priority: 'low', type: 'show' },
    // §0.64.2 / §0.76 : 期間限定ナイト花火 (fallback 日も表示) ・ high。
    // §0.83 : 夏季休止 (2026-06-15 〜 2026-09-14) を period で除外。詳細は TDL 側のコメント参照。
    { name: 'スカイ･フル･オブ･カラーズ', time: '20:30', priority: 'high', type: 'show', period: ['2026-09-15', null] },
  ],
};

// 後方互換 (旧名)。FALLBACK を指す。
export const SHOW_SCHEDULE = FALLBACK_SCHEDULE;

// 月別 JSON を eager import (vite)。{ '../data/schedule/2026-07.json': {month, days, ...} }
const monthFiles = import.meta.glob('./schedule/*.json', { eager: true });
const MONTHLY = {};
for (const [path, mod] of Object.entries(monthFiles)) {
  const data = mod.default || mod;
  const ym = path.match(/(\d{4}-\d{2})\.json$/)?.[1];
  if (ym && data?.days) MONTHLY[ym] = data;
}

// 月別 JSON の 1 公演 {name, times[], priority, kind, tags} を内部形 {name, time, priority, type} 群へ。
// times が複数あれば time ごとに展開 (high の複数回公演に対応)。
// §0.26.1: レストランショー (priority:null / kind:'show-restaurant' で時刻未定) は
//   time:null の 1 件として残し、一覧に「時刻未定 ・ 要予約」で表示する (算定窓には使わない)。
function expandShows(shows) {
  const out = [];
  for (const s of shows || []) {
    const tags = s.tags || [];
    const validTimes = (s.times || []).filter((t) => t && /^\d{1,2}:\d{2}$/.test(t));
    if (validTimes.length === 0) {
      // 時刻未定のレストランショーは情報として 1 件だけ残す (kind を保持して描画側で判別)
      if (s.kind === 'show-restaurant') {
        out.push({ name: s.name, time: null, priority: s.priority || null, type: 'restaurant', kind: s.kind, tags });
      }
      continue;
    }
    const priority = s.priority || 'medium';
    const type = (s.kind || '').includes('parade') ? 'parade' : 'show';
    for (const t of validTimes) {
      out.push({ name: s.name, time: t, priority, type, kind: s.kind, tags });
    }
  }
  return out;
}

// §0.61 : 両パーク共通ショー (TDL/TDS 上空で見える花火等)。片パークの取得漏れに備え、
//   もう片方に存在すれば自動補完する (§0.44.11 のデータ依存対応を再発防止ロジック化)。
const SHARED_SHOWS = [/スカイ[・･]フル[・･]オブ[・･]カラーズ/];

// §0.64.2 : 両パーク上空で見える共通ショー (スカイ等) か判定。過去中止履歴の両パーク合算等に使う。
export function isSharedShow(name) {
  return SHARED_SHOWS.some((re) => re.test(name || ''));
}

// §0.61/§0.64.2 : 純関数版。展開済み shows に、他パークの「生」ショー (otherRawShows) から
//   共通ショー (SHARED_SHOWS) で欠けているものを補完して返す。重複ガード付き。テスト可能。
export function mergeSharedShows(shows, otherRawShows) {
  if (!Array.isArray(otherRawShows) || !otherRawShows.length) return shows;
  const out = shows.slice();
  for (const re of SHARED_SHOWS) {
    if (out.some((s) => re.test(s.name))) continue; // 当パークに既にある
    for (const s of otherRawShows) {
      if (re.test(s.name) && !out.some((o) => o.name === s.name)) out.push(...expandShows([s]));
    }
  }
  return out;
}

// §0.61 : 同日 ・ 他パークの official データから共通ショーを補完 (当パークが official のときのみ)。
function injectSharedShows(date, park, shows) {
  const ym = (date || '').slice(0, 7);
  const otherPark = park === 'TDL' ? 'TDS' : 'TDL';
  const otherDay = MONTHLY[ym]?.days?.[date]?.[otherPark];
  return mergeSharedShows(shows, otherDay?.shows);
}

// §0.68.H.a (§0.39.7 ・ 監査 S-3) : 季節限定ショーの自動期間管理。
//   FALLBACK_SCHEDULE のエントリに任意で period: ['YYYY-MM-DD', 'YYYY-MM-DD'] を持たせると、
//   その期間外の日には fallback から自動除外する (official JSON は日付別キュレートなので対象外)。
//   period 無しのエントリは常時表示 (= 既存挙動そのまま)。日付は ISO 文字列なので辞書順比較で OK。
//   ※ 実際の開始/終了日は公式発表ベースで Yuka さんが手動更新する (§0.39.7 運用方針)。
export function inPeriod(date, period) {
  if (!Array.isArray(period) || period.length !== 2) return true;
  const [start, end] = period;
  return (!start || date >= start) && (!end || date <= end);
}

// その日 ・ パークのショー配列を返す。{ shows, source: 'official' | 'fallback' }。
// date: 'YYYY-MM-DD'、park: 'TDL' | 'TDS'
export function getDaySchedule(date, park) {
  const ym = (date || '').slice(0, 7);
  const day = MONTHLY[ym]?.days?.[date]?.[park];
  if (day && Array.isArray(day.shows) && day.shows.length > 0) {
    // §0.61 : official の日のみ共通ショー (スカイ等) を他パークから補完。
    return { shows: injectSharedShows(date, park, expandShows(day.shows)), source: 'official' };
  }
  // §0.68.H.a : fallback は period でフィルタ (期間外の季節限定公演を除外)。
  const shows = (FALLBACK_SCHEDULE[park] || []).filter((s) => inPeriod(date, s.period));
  return { shows, source: 'fallback' };
}

// 'HH:MM' → 小数時間 (13:30 → 13.5)
export function toDecimalHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

// 指定パーク ･ priority の全時刻 (小数時間) を返す。date 指定時はその日の実スケジュール。
export function showTimes(park, priority, date = null) {
  const shows = date ? getDaySchedule(date, park).shows : FALLBACK_SCHEDULE[park] || [];
  return shows
    .filter((s) => s.time && (priority == null || s.priority === priority))
    .map((s) => toDecimalHour(s.time));
}

// 指定 priority の各時刻 ±windowH の範囲に入る整数時 (hourly データ突合用) の集合を返す。
// 例: TDL high (13:00 / 15:00), windowH=1 → {12, 13, 14, 15, 16}
export function showWindowHours(park, priority = 'high', windowH = 1, date = null) {
  const hours = new Set();
  for (const t of showTimes(park, priority, date)) {
    for (let h = 9; h <= 22; h += 1) {
      if (h >= t - windowH && h <= t + windowH) hours.add(h);
    }
  }
  return hours;
}

// 縦線ハイライト用: パーク内の全ショーを {hour, time, name, priority, type} で返す。
export function allShowMarkers(park, date = null) {
  const shows = date ? getDaySchedule(date, park).shows : FALLBACK_SCHEDULE[park] || [];
  return shows
    .filter((s) => s.time)
    .map((s) => ({
    hour: toDecimalHour(s.time),
    time: s.time,
    name: s.name,
    priority: s.priority,
    type: s.type,
  }));
}
