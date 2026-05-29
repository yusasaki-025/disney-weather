// WBGT (暑さ指数)。
// 主経路: Open-Meteo の気温 ＋ 相対湿度から簡易式で派生計算 (deriveWbgt)。
// 優先経路: 環境省 暑さ指数 電子情報提供サービスの予測値 (fetchEnvWbgt)。
//   ただし当 CSV は CORS ヘッダーを返さないため、ブラウザ artifact からの直接 fetch は
//   通常ブロックされる (プロキシ経由なら利用可)。失敗時は派生計算にフォールバックする。
//   提供期間は概ね 4 - 10 月 (夏季) のみ。期間外は派生計算で代替。

import { logger } from '../utils/logger.js';

export const WBGT_SOURCE = {
  ENV_JP: 'env-jp',
  DERIVED: 'derived',
};

// 舞浜は東京寄りのため東京 (44132) を最寄りに採用。千葉 = 45106 を代替候補とする。
export const ENV_WBGT_POINT = '44132';
const ENV_WBGT_URL = (point) =>
  `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${point}.csv`;

// 簡易 WBGT 推定 (屋外、日射 ・ 風補正なし)。
//   e    = (RH/100) × 6.105 × exp(17.27·Ta / (237.7 + Ta))   [水蒸気圧 hPa]
//   WBGT ≒ 0.567·Ta + 0.393·e + 3.94
export function deriveWbgt(tempC, rhPercent) {
  if (tempC == null || rhPercent == null) return null;
  if (Number.isNaN(tempC) || Number.isNaN(rhPercent)) return null;
  const e = (rhPercent / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return 0.567 * tempC + 0.393 * e + 3.94;
}

// 環境省 WBGT 予測 CSV をパースする。
// 形式: 1 行目ヘッダ ',,YYYYMMDDHH,YYYYMMDDHH,...' / 2 行目 'point,更新時刻,値×10,...'
// 値は WBGT を 10 倍した整数 (例 260 → 26.0℃)。
// 戻り値: { 'YYYY-MM-DD': { wbgtMax, hourly: [{ hour, wbgt }] } }
export function parseEnvWbgtCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return {};
  const header = lines[0].split(',');
  const values = lines[1].split(',');
  const byDate = {};
  for (let i = 2; i < header.length; i += 1) {
    const stamp = header[i].trim(); // 'YYYYMMDDHH'
    const raw = (values[i] ?? '').trim();
    if (!/^\d{10}$/.test(stamp) || raw === '') continue;
    const wbgt = Number(raw) / 10;
    if (Number.isNaN(wbgt)) continue;
    const date = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
    const hour = Number(stamp.slice(8, 10));
    if (!byDate[date]) byDate[date] = { wbgtMax: null, hourly: [] };
    byDate[date].hourly.push({ hour, wbgt });
    if (byDate[date].wbgtMax == null || wbgt > byDate[date].wbgtMax) {
      byDate[date].wbgtMax = wbgt;
    }
  }
  return byDate;
}

// 環境省 CSV を取得してパース。失敗 (CORS / 期間外 / ネットワーク) は null を返す。
export async function fetchEnvWbgt(point = ENV_WBGT_POINT) {
  try {
    const res = await fetch(ENV_WBGT_URL(point));
    if (!res.ok) return null;
    const text = await res.text();
    const parsed = parseEnvWbgtCsv(text);
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch (e) {
    // CORS 等で失敗するのは想定内。派生計算へフォールバックする。
    logger.info('環境省 WBGT 取得は不可 (派生計算にフォールバック):', e.message);
    return null;
  }
}
