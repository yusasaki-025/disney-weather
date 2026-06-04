// 過去同条件での中止確率 (§0.31)。cancel-history (§0.30) の実測 records から、
// 「予報 max 風速 ±2m/s の過去事例で何 % 中止したか」を算出し、予測信頼度をユーザーに見せる。

import { getAllRecordsForShow } from '../data/cancelHistoryLoader.js';
import { isSharedShow } from '../data/showSchedule.js';

const WIND_TOLERANCE = 2; // 同条件とみなす最大瞬間風速の許容差 [m/s]
const MIN_TOTAL = 20; // ショー全体のサンプル下限 (これ未満は信頼できない)
const MIN_SAMEWIND = 5; // 同風速帯のサンプル下限

// 中止扱いの status (cancel + 途中中止)。partial (一部変更/パイロカット) は「実施」側。
const CANCEL_STATUSES = new Set(['cancel', 'partial-cancel']);

// §0.64.2 : 共通ショー (スカイ等) は両パーク上空で同時開催の同一花火なので、中止も共通。
//   履歴が片パーク (実態は TDS) にしか無いため、両パークの records を合算して左右で一致させる。
function recordsForShow(showName, park) {
  if (isSharedShow(showName)) {
    return [...getAllRecordsForShow(showName, 'TDL'), ...getAllRecordsForShow(showName, 'TDS')];
  }
  return getAllRecordsForShow(showName, park);
}

// getCancelProbability(showName, park, predictedMaxWind)
//   -> { probability, sampleSize, cancelCount } または null (サンプル不足/データ無し)
export function getCancelProbability(showName, park, predictedMaxWind) {
  if (predictedMaxWind == null) return null;
  const all = recordsForShow(showName, park).filter((r) => r.maxWind != null);
  if (all.length < MIN_TOTAL) return null;

  const same = all.filter((r) => Math.abs(r.maxWind - predictedMaxWind) <= WIND_TOLERANCE);
  if (same.length < MIN_SAMEWIND) return null;

  const cancelCount = same.filter((r) => CANCEL_STATUSES.has(r.status)).length;
  return {
    probability: Math.round((cancelCount / same.length) * 100),
    sampleSize: same.length,
    cancelCount,
  };
}
