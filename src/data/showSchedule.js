// ショー ･ パレードの実在公演名 ＋ 代表時刻 (§0.6.9)。
// 公式の公開 JSON が無いため固定値。時刻はシーズンで変わる代表値で、Phase 2 の公式取得で置換予定。
// priority: high = 季節限定の昼公演 (最重要・メインスコア算定窓) / medium = 屋内・短時間 (補助) /
//           low = 通年演目のナイト公演 (参考表示のみ)。

export const SHOW_SCHEDULE = {
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

// 'HH:MM' → 小数時間 (13:30 → 13.5)
export function toDecimalHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

// 指定パーク ･ priority の全時刻 (小数時間) を返す
export function showTimes(park, priority) {
  return (SHOW_SCHEDULE[park] || [])
    .filter((s) => priority == null || s.priority === priority)
    .map((s) => toDecimalHour(s.time));
}

// 指定 priority の各時刻 ±windowH の範囲に入る整数時 (hourly データ突合用) の集合を返す。
// 例: TDL high (13:00 / 15:00), windowH=1 → {12, 13, 14, 15, 16}
export function showWindowHours(park, priority = 'high', windowH = 1) {
  const hours = new Set();
  for (const t of showTimes(park, priority)) {
    for (let h = 9; h <= 22; h += 1) {
      if (h >= t - windowH && h <= t + windowH) hours.add(h);
    }
  }
  return hours;
}

// 縦線ハイライト用: パーク内の全ショーを {hour, time, name, priority, type} で返す
export function allShowMarkers(park) {
  return (SHOW_SCHEDULE[park] || []).map((s) => ({
    hour: toDecimalHour(s.time),
    time: s.time,
    name: s.name,
    priority: s.priority,
    type: s.type,
  }));
}
