// §0.39.2 (#20) : 熱中症警戒級の判定。
// 環境省の official「熱中症警戒アラート」は CORS + 専用 worker が必要なため、
// 既存の WBGT 予測値から相当する警戒級を導出する (UI に「WBGT 予測」と明記)。
// 環境省アラートの発令基準 = 暑さ指数 (WBGT) の予測値が 33 以上。
import { round1 } from '../utils/metrics.js';

const ALERT_WBGT = 33;

// heatAlertLevel(wbgtMax) -> { label, wbgt } | null
export function heatAlertLevel(wbgtMax) {
  if (wbgtMax == null || Number.isNaN(wbgtMax)) return null;
  // §0.65.1 : WBGT は小数 1 桁で統一。
  if (wbgtMax >= ALERT_WBGT) return { label: '熱中症警戒級', wbgt: round1(wbgtMax) };
  return null;
}
