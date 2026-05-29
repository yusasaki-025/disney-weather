// JST (Asia/Tokyo) 統一の日付ユーティリティ。
// 生の `new Date(...)` による日付演算は timezone バグの温床なので、
// 現在時刻取得と日付計算はすべてこのモジュールに集約する。

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// 'YYYY-MM-DD' (JST) を返す。ホスト OS の timezone に依存しない。
export function todayJst() {
  // en-CA ロケールは 'YYYY-MM-DD' 形式を返す
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// 現在時刻 (ISO8601, キャッシュ用)。現在時刻取得はここだけで行う。
export function nowIso() {
  return new Date().toISOString();
}

export function nowMs() {
  return Date.now();
}

// 'YYYY-MM-DD' を UTC 正午の Date に変換 (日付演算用、tz ドリフトを避ける)
function toUtcDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function fromUtcDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// dateStr に days 日を足した 'YYYY-MM-DD' を返す
export function addDays(dateStr, days) {
  const dt = toUtcDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtcDate(dt);
}

// 今日 + (count-1) 日分の候補日リスト (既定 15 日 = 今日 + 14 日)
export function candidateDates(count = 15, start = todayJst()) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(addDays(start, i));
  }
  return out;
}

// '2026-06-02' → '6/2'
export function formatMd(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

// '2026-06-02' → '月'
export function weekday(dateStr) {
  return WEEKDAYS[toUtcDate(dateStr).getUTCDay()];
}

// 0=日 .. 6=土
export function weekdayIndex(dateStr) {
  return toUtcDate(dateStr).getUTCDay();
}

export function isWeekend(dateStr) {
  const w = weekdayIndex(dateStr);
  return w === 0 || w === 6;
}

// ISO8601 文字列 → 経過ミリ秒 (キャッシュ TTL 判定用)
export function ageMs(iso) {
  return nowMs() - new Date(iso).getTime();
}

// '2026-06-02' を表示用 'YYYY/MM/DD' に (約物ルール: 日付スラッシュは前後スペース無し)
export function formatYmdSlash(dateStr) {
  return dateStr.replace(/-/g, '/');
}
