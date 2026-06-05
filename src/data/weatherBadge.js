// §0.80 : 天気の 5 段階バッジ (表示用 ・ スコア計算には影響しない)。
//   気象庁 ・ Open-Meteo とも weatherText を持つのでテキストから判定する。
//   降水 (雪 > 雷/大雨 > 霧雨/小雨 > 雨) を晴/曇より優先し、雨の日が必ず注意以上になるようにする
//   (「ぱっと見で良い天気/悪い天気」を判別しやすくするのが目的)。
//   返り値 { level, text, key } ・ key は CSS クラス (.wb-<key>) 用。

const COMFORT = { level: 0, text: '快適', key: 'comfort' };
const NORMAL = { level: 0, text: 'ふつう', key: 'normal' };
const CAUTION = { level: 1, text: '注意', key: 'caution' };
const WARN = { level: 2, text: '警告', key: 'warn' };
const SEVERE = { level: 3, text: '悪天候', key: 'severe' };

export function weatherBadge(weatherText) {
  const t = weatherText || '';
  if (!t) return NORMAL;
  if (/雪|吹雪/.test(t)) return SEVERE; // 雪 ・ 暴風雪
  if (/雷|大雨|豪雨|暴風/.test(t)) return WARN; // 雷雨 ・ 強雨 ・ 暴風
  if (/霧雨|小雨/.test(t)) return CAUTION; // 弱い雨
  if (/雨/.test(t)) return WARN; // その他の雨
  if (/晴/.test(t)) return COMFORT; // 晴れ (晴れ時々曇り含む)
  if (/曇|くもり/.test(t)) return NORMAL; // 曇り
  return NORMAL;
}
