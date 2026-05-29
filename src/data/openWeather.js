// OpenWeather One Call 3.0 の取得 ＆ 正規化 (Phase 2・任意)。
// API キーは artifact に埋め込まず、Cloudflare Workers プロキシ経由で叩く。
// プロキシ URL 未設定なら無効 (空配列) として Open-Meteo + JMA だけで動かす。
// daily は 8 日分のみ取得できるので、15 日表示では後半が空欄になる。

import { withRetry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import { nowIso } from '../utils/date.js';
import { deriveWbgt, WBGT_SOURCE } from './wbgt.js';
import { maxOf } from '../utils/units.js';

export const SOURCE_ID = 'openweather';

// unix 秒 (UTC) → JST の 'YYYY-MM-DD' と時
function jstParts(unixSec) {
  const d = new Date(unixSec * 1000);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      hour12: false,
    }).format(d),
  );
  return { date, hour };
}

export function normalize(json) {
  const fetchedAt = nowIso();
  if (!json?.daily) return [];

  // hourly を日付別にまとめる (9 - 22)
  const hourlyByDate = {};
  for (const h of json.hourly || []) {
    const { date, hour } = jstParts(h.dt);
    if (hour < 9 || hour > 22) continue;
    const temp = h.temp ?? null;
    const humidity = h.humidity ?? null;
    (hourlyByDate[date] ||= []).push({
      hour,
      pop: h.pop != null ? Math.round(h.pop * 100) : null,
      precip: h.rain?.['1h'] ?? 0,
      wind: h.wind_speed ?? null,
      gust: h.wind_gust ?? null,
      temp,
      feelsLike: h.feels_like ?? null,
      humidity,
      wbgt: deriveWbgt(temp, humidity),
    });
  }

  return json.daily.map((d) => {
    const { date } = jstParts(d.dt);
    const hourly = (hourlyByDate[date] || []).sort((a, b) => a.hour - b.hour);
    const wbgtMax = maxOf(hourly.map((p) => p.wbgt));
    return {
      source: SOURCE_ID,
      date,
      weatherText: d.weather?.[0]?.description ?? null,
      tempMax: d.temp?.max ?? null,
      tempMin: d.temp?.min ?? null,
      feelsLikeMax: d.feels_like?.day ?? null,
      feelsLikeMin: d.feels_like?.night ?? null,
      popMax: d.pop != null ? Math.round(d.pop * 100) : null,
      precipSum: d.rain ?? null,
      windMax: d.wind_speed ?? null,
      gustMax: d.wind_gust ?? null,
      wbgtMax,
      wbgtSource: wbgtMax == null ? null : WBGT_SOURCE.DERIVED,
      uvMax: d.uvi ?? null,
      hourly,
      fetchedAt,
    };
  });
}

// proxyUrl 経由で取得。未設定や失敗時は空配列。
export async function fetchOpenWeather({ lat, lon }, { proxyUrl } = {}) {
  if (!proxyUrl) return []; // 無効 (キー未設定)
  try {
    const url = `${proxyUrl}?lat=${lat}&lon=${lon}`;
    const json = await withRetry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OpenWeather HTTP ${res.status}`);
        return res.json();
      },
      { label: 'OpenWeather' },
    );
    return normalize(json);
  } catch (e) {
    logger.error('OpenWeather 取得に失敗', e.message);
    return [];
  }
}
