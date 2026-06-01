// §0.39.4 (#22) : 予報風速で運休が予測される屋外アトラクションを返す pure 関数。
// 新規 fetch はせず、既存の予報 gust と推定閾値テーブルのみ使用 (低リスク)。
import { ATTRACTION_THRESHOLDS } from '../data/attraction-thresholds.js';

// getAttractionClosures(park, gust) -> [{ name, windCutoff, type }]
//   gust (m/s) >= windCutoff のアトラクションを windCutoff 昇順で返す。
export function getAttractionClosures(park, gust) {
  if (gust == null || Number.isNaN(gust)) return [];
  return Object.entries(ATTRACTION_THRESHOLDS)
    .filter(([, a]) => a.park === park && gust >= a.windCutoff)
    .map(([name, a]) => ({ name, windCutoff: a.windCutoff, type: a.type }))
    .sort((a, b) => a.windCutoff - b.windCutoff);
}
