// ショー ･ パレードの時刻データ (§0.6.9 / §0.8)。
// 公式の月別 JSON (src/data/schedule/YYYY-MM.json、scripts/fetch-schedule.mjs で生成) があれば
// その日の実時刻を使い、無ければ下の FALLBACK (典型的な代表時刻) を使う。
// priority: high = 季節限定の昼公演 (最重要・メインスコア算定窓) / medium = 屋内・短時間 (補助) /
//           low = 通年演目のナイト公演 (参考表示のみ)。

// 典型値 (公式取得が無い日・取得失敗時の FALLBACK)
export const FALLBACK_SCHEDULE = {
  TDL: [
    { name: 'ハーモニー･イン･カラー', time: '13:00', priority: 'high', type: 'parade' },
    { name: 'ジュビレーション！', time: '15:00', priority: 'high', type: 'parade' },
    { name: 'ジャンボリミッキー！', time: '11:00', priority: 'medium', type: 'show' },
    { name: 'エレクトリカルパレード･ドリームライツ', time: '19:30', priority: 'low', type: 'parade' },
  ],
  TDS: [
    { name: 'スパークリング･ジュビリー･セレブレーション', time: '11:30', priority: 'high', type: 'show' },
    { name: 'ウィッシュ', time: '14:00', priority: 'high', type: 'show' },
    { name: 'ビリーヴ！～シー･オブ･ドリームス～', time: '19:45', priority: 'low', type: 'show' },
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
function expandShows(shows) {
  const out = [];
  for (const s of shows || []) {
    const priority = s.priority || 'medium';
    const type = (s.kind || '').includes('parade') ? 'parade' : 'show';
    for (const t of s.times || []) {
      // レストランショー等は時刻が null/空のことがある。時刻なしは窓計算 ・ 縦線に使えないため除外。
      if (!t || !/^\d{1,2}:\d{2}$/.test(t)) continue;
      out.push({ name: s.name, time: t, priority, type, tags: s.tags || [] });
    }
  }
  return out;
}

// その日 ・ パークのショー配列を返す。{ shows, source: 'official' | 'fallback' }。
// date: 'YYYY-MM-DD'、park: 'TDL' | 'TDS'
export function getDaySchedule(date, park) {
  const ym = (date || '').slice(0, 7);
  const day = MONTHLY[ym]?.days?.[date]?.[park];
  if (day && Array.isArray(day.shows) && day.shows.length > 0) {
    return { shows: expandShows(day.shows), source: 'official' };
  }
  return { shows: FALLBACK_SCHEDULE[park] || [], source: 'fallback' };
}

// 'HH:MM' → 小数時間 (13:30 → 13.5)
export function toDecimalHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

// 指定パーク ･ priority の全時刻 (小数時間) を返す。date 指定時はその日の実スケジュール。
export function showTimes(park, priority, date = null) {
  const shows = date ? getDaySchedule(date, park).shows : FALLBACK_SCHEDULE[park] || [];
  return shows.filter((s) => priority == null || s.priority === priority).map((s) => toDecimalHour(s.time));
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
  return shows.map((s) => ({
    hour: toDecimalHour(s.time),
    time: s.time,
    name: s.name,
    priority: s.priority,
    type: s.type,
  }));
}
