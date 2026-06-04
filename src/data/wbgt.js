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

// §0.68.E (監査 S-2) : 環境省 WBGT 実値を Open-Meteo forecast にマージする (forecast を破壊的に更新)。
//   info = { wbgtMax, hourly: [{ hour, wbgt }] } (parseEnvWbgtCsv の 1 日分)。
//   日次 wbgtMax だけでなく hourly[].wbgt も時刻一致で上書きし wbgtSource を env-jp にする。
//   showWindow ・ スコア ・ カード表示はすべて hourly 由来なので、これで「環境省」ラベルと実値が一致する
//   (旧実装は wbgtMax のみ上書きし hourly を捨てていたため、ラベルは環境省でも採点は派生値だった)。
export function mergeEnvWbgt(forecast, info) {
  if (!forecast || !info) return;
  if (info.wbgtMax != null) {
    forecast.wbgtMax = info.wbgtMax;
    forecast.wbgtSource = WBGT_SOURCE.ENV_JP;
  }
  if (Array.isArray(info.hourly) && info.hourly.length && Array.isArray(forecast.hourly)) {
    const byHour = new Map(info.hourly.map((h) => [h.hour, h.wbgt]));
    for (const p of forecast.hourly) {
      const v = byHour.get(p.hour);
      if (v != null) {
        p.wbgt = v;
        p.wbgtSource = WBGT_SOURCE.ENV_JP;
      }
    }
  }
}

// 浦安直近の予測値として 44132 (船橋) を採用 (§3.13)。
export const ENV_WBGT_POINT = '44132';
const ENV_WBGT_URL = (point) =>
  `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${point}.csv`;
// プロキシ経由の URL (workers/wbgt-proxy.js)。CONFIG.wbgtProxyUrl が設定されていれば使う。
const PROXY_URL = (base, point) => `${base.replace(/\/$/, '')}/wbgt?point=${point}`;

// 簡易 WBGT 推定 (屋外、日射 ・ 風補正なし)。
//   e    = (RH/100) × 6.105 × exp(17.27·Ta / (237.7 + Ta))   [水蒸気圧 hPa]
//   WBGT ≒ 0.567·Ta + 0.393·e + 3.94
export function deriveWbgt(tempC, rhPercent) {
  if (tempC == null || rhPercent == null) return null;
  if (Number.isNaN(tempC) || Number.isNaN(rhPercent)) return null;
  const e = (rhPercent / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return 0.567 * tempC + 0.393 * e + 3.94;
}

// 環境省 WBGT 予測 CSV のヘッダー時刻 stamp を { date:'YYYY-MM-DD', hour:Number } に正規化。
// 実データ形式は 'YYYY/MM/DD HH:MM' (3 時間毎、24:00 表記あり)。
// 旧ドキュメント/テスト互換で 'YYYYMMDDHH' (10 桁) も受ける。対応しない形式は null。
function parseStamp(stamp) {
  const slash = stamp.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):\d{2}$/);
  if (slash) {
    const [, y, mo, d, h] = slash;
    return { date: `${y}-${mo}-${d}`, hour: Number(h) };
  }
  if (/^\d{10}$/.test(stamp)) {
    return { date: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`, hour: Number(stamp.slice(8, 10)) };
  }
  return null;
}

// 環境省 WBGT 予測 CSV をパースする。
// 形式: 1 行目ヘッダ ',,<時刻>,<時刻>,...' / 2 行目 'point,更新時刻,値×10,...'
// 値は WBGT を 10 倍した整数 (例 260 → 26.0℃)。空欄 (期間外) はスキップ。
// 戻り値: { 'YYYY-MM-DD': { wbgtMax, hourly: [{ hour, wbgt }] } }
export function parseEnvWbgtCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return {};
  const header = lines[0].split(',');
  const values = lines[1].split(',');
  const byDate = {};
  for (let i = 2; i < header.length; i += 1) {
    const parsed = parseStamp(header[i].trim());
    const raw = (values[i] ?? '').trim();
    if (!parsed || raw === '') continue;
    const wbgt = Number(raw) / 10;
    if (Number.isNaN(wbgt)) continue;
    const { date, hour } = parsed;
    if (!byDate[date]) byDate[date] = { wbgtMax: null, hourly: [] };
    byDate[date].hourly.push({ hour, wbgt });
    if (byDate[date].wbgtMax == null || wbgt > byDate[date].wbgtMax) {
      byDate[date].wbgtMax = wbgt;
    }
  }
  return byDate;
}

// 環境省 CSV を取得してパース。失敗 (CORS / 期間外 / ネットワーク) は null を返す。
// proxyUrl を渡すと workers/wbgt-proxy.js 経由で取得する (CORS 回避、実値取得の主経路)。
// proxyUrl 無し時は直 fetch を試みる (通常 CORS でブロックされ派生計算にフォールバック)。
export async function fetchEnvWbgt(point = ENV_WBGT_POINT, { proxyUrl = '' } = {}) {
  const target = proxyUrl ? PROXY_URL(proxyUrl, point) : ENV_WBGT_URL(point);
  try {
    const res = await fetch(target);
    if (!res.ok) return null;
    const text = await res.text();
    const parsed = parseEnvWbgtCsv(text);
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch (e) {
    // CORS / 期間外 等で失敗するのは想定内。派生計算へフォールバックする。
    logger.info('環境省 WBGT 取得は不可 (派生計算にフォールバック):', e.message);
    return null;
  }
}
