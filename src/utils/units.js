// 単位換算ユーティリティ。内部表現は風速 = m/s に統一する。
// (km/h と m/s の取り違えがスコア大誤算につながるため一箇所に集約)

// km/h → m/s
export function kmhToMs(kmh) {
  if (kmh == null) return null;
  return kmh / 3.6;
}

// m/s → km/h
export function msToKmh(ms) {
  if (ms == null) return null;
  return ms * 3.6;
}

// 小数第 n 位に丸める (null 透過)
export function round(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

// 数値配列の平均 (null/NaN は除外、全て欠損なら null)
export function mean(values) {
  const nums = values.filter((v) => v != null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// 数値配列の最大 (null/NaN は除外、全て欠損なら null)
export function maxOf(values) {
  const nums = values.filter((v) => v != null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return Math.max(...nums);
}
