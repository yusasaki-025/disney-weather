// ショー ･ パレードの典型的な時刻 (公式の公開 JSON が無いため固定値で保持)。
// priority: 'high' = 季節限定の昼パレード (最重要・メインスコアの算定窓)
// priority: 'low'  = 通年演目のナイトパレード (参考表示のみ)
// 公式と乖離したらこのテーブルだけ手で直す (月 1 目視更新を想定)。

export const SHOW_SCHEDULE = {
  TDL: [
    { type: 'デイパレード (季節)', times: ['13:00', '14:30'], priority: 'high' },
    { type: 'ナイトパレード', times: ['20:00'], priority: 'low' },
  ],
  TDS: [
    { type: 'デイハーバーショー (季節)', times: ['11:30', '14:00'], priority: 'high' },
    { type: 'ナイトハーバーショー', times: ['19:40'], priority: 'low' },
  ],
};

// 'HH:MM' → 小数時間 (13:30 → 13.5)
export function toDecimalHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

// 指定パーク ･ priority の全時刻 (小数時間) を返す
export function showTimes(park, priority) {
  return (SHOW_SCHEDULE[park] || [])
    .filter((s) => priority == null || s.priority === priority)
    .flatMap((s) => s.times.map(toDecimalHour));
}

// 指定 priority の各時刻 ±windowH の範囲に入る整数時 (hourly データ突合用) の集合を返す。
// 例: TDL high (13:00 / 14:30), windowH=1 → {12, 13, 14, 15}
export function showWindowHours(park, priority = 'high', windowH = 1) {
  const hours = new Set();
  for (const t of showTimes(park, priority)) {
    for (let h = 9; h <= 22; h += 1) {
      if (h >= t - windowH && h <= t + windowH) hours.add(h);
    }
  }
  return hours;
}

// 縦線ハイライト用: パーク内の全ショー時刻を {hour, label, priority} で返す
export function allShowMarkers(park) {
  return (SHOW_SCHEDULE[park] || []).flatMap((s) =>
    s.times.map((t) => ({
      hour: toDecimalHour(t),
      time: t,
      type: s.type,
      priority: s.priority,
    })),
  );
}
