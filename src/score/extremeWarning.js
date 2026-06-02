// 極端値の信頼度ヒント (§0.36-7)。単独ソースが極端な値を出しているとき「(要確認)」を促す。
// gustMax ≧ 20m/s または precipMaxHourly ≧ 30mm/h で警告を返す。
// 他ソースとの突合をユーザーに促す目的 (1 ソースの外れ値で誤判断しないため)。

const GUST_LIMIT = 20; // m/s
const PRECIP_LIMIT = 30; // mm/h

// extremeWarning({ gustMax, precipMaxHourly }) -> { text, title } または null
export function extremeWarning({ gustMax, precipMaxHourly } = {}) {
  const reasons = [];
  if (gustMax != null && gustMax >= GUST_LIMIT) reasons.push(`最大瞬間風速 ${Math.round(gustMax)}m/s`);
  if (precipMaxHourly != null && precipMaxHourly >= PRECIP_LIMIT) {
    reasons.push(`時間雨量 ${Math.round(precipMaxHourly)}mm/h`);
  }
  if (reasons.length === 0) return null;
  return {
    text: '(要確認)',
    title: `${reasons.join('・')} の単独予報・他ソースの確認を推奨`,
  };
}
