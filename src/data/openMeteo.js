// Open-Meteo の取得 ＆ 内部正規化フォーマット (DailyForecast[]) への変換。
// 風速 ･ 突風 ･ 降水確率 ･ UV ･ 体感温度を hourly / daily で取得できるメインソース。
// 認証不要 ・ CORS 許可済み。WBGT は気温 ＋ 湿度から派生計算する。

import { withRetry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import { nowIso } from '../utils/date.js';
import { deriveWbgt, WBGT_SOURCE } from './wbgt.js';
import { maxOf } from '../utils/units.js';

export const SOURCE_ID = 'open-meteo';
const BASE = 'https://api.open-meteo.com/v1/forecast';

// WMO weather code → 日本語概況 (代表値)
const WMO_TEXT = {
  0: '快晴',
  1: '晴れ',
  2: '晴れ時々曇り',
  3: '曇り',
  45: '霧',
  48: '霧 (着氷)',
  51: '霧雨 (弱)',
  53: '霧雨',
  55: '霧雨 (強)',
  56: '着氷性霧雨',
  57: '着氷性霧雨 (強)',
  61: '小雨',
  63: '雨',
  65: '大雨',
  66: '着氷性の雨',
  67: '着氷性の雨 (強)',
  71: '小雪',
  73: '雪',
  75: '大雪',
  77: '霧雪',
  80: 'にわか雨 (弱)',
  81: 'にわか雨',
  82: 'にわか雨 (激)',
  85: 'にわか雪 (弱)',
  86: 'にわか雪 (強)',
  95: '雷雨',
  96: '雷雨 (雹を伴う)',
  99: '雷雨 (強い雹)',
};

export function wmoText(code) {
  return WMO_TEXT[code] ?? '不明';
}

function buildUrl({ lat, lon }, forecastDays) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly:
      'temperature_2m,apparent_temperature,precipitation_probability,precipitation,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,uv_index',
    daily:
      'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,weather_code',
    wind_speed_unit: 'ms', // 内部は m/s 統一
    timezone: 'Asia/Tokyo',
    forecast_days: String(forecastDays),
  });
  return `${BASE}?${params.toString()}`;
}

// 生レスポンス → DailyForecast[] (テスト用に分離)
export function normalize(json) {
  const fetchedAt = nowIso();
  const daily = json.daily;
  if (!daily || !Array.isArray(daily.time)) return [];

  // hourly を日付 → [HourlyPoint] にまとめる (9:00 - 22:00)
  const hourlyByDate = {};
  const h = json.hourly;
  if (h && Array.isArray(h.time)) {
    for (let i = 0; i < h.time.length; i += 1) {
      const [date, hm] = h.time[i].split('T');
      const hour = Number(hm.slice(0, 2));
      if (hour < 9 || hour > 22) continue;
      const temp = h.temperature_2m?.[i] ?? null;
      const humidity = h.relative_humidity_2m?.[i] ?? null;
      const point = {
        hour,
        pop: h.precipitation_probability?.[i] ?? null,
        precip: h.precipitation?.[i] ?? null,
        wind: h.wind_speed_10m?.[i] ?? null,
        gust: h.wind_gusts_10m?.[i] ?? null,
        temp,
        feelsLike: h.apparent_temperature?.[i] ?? null,
        humidity,
        wbgt: deriveWbgt(temp, humidity),
      };
      (hourlyByDate[date] ||= []).push(point);
    }
  }

  return daily.time.map((date, i) => {
    const hourly = (hourlyByDate[date] || []).sort((a, b) => a.hour - b.hour);
    const wbgtMax = maxOf(hourly.map((p) => p.wbgt));
    return {
      source: SOURCE_ID,
      date,
      weatherText: wmoText(daily.weather_code?.[i]),
      tempMax: daily.temperature_2m_max?.[i] ?? null,
      tempMin: daily.temperature_2m_min?.[i] ?? null,
      feelsLikeMax: daily.apparent_temperature_max?.[i] ?? null,
      feelsLikeMin: daily.apparent_temperature_min?.[i] ?? null,
      popMax: daily.precipitation_probability_max?.[i] ?? null,
      precipSum: daily.precipitation_sum?.[i] ?? null,
      windMax: daily.wind_speed_10m_max?.[i] ?? null,
      gustMax: daily.wind_gusts_10m_max?.[i] ?? null,
      wbgtMax,
      wbgtSource: wbgtMax == null ? null : WBGT_SOURCE.DERIVED,
      uvMax: daily.uv_index_max?.[i] ?? null,
      hourly,
      fetchedAt,
    };
  });
}

// エラー時は空配列を返し、テーブルは表示を続行する。
export async function fetchOpenMeteo({ lat, lon }, { forecastDays = 16 } = {}) {
  try {
    const url = buildUrl({ lat, lon }, forecastDays);
    const json = await withRetry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
        return res.json();
      },
      { label: 'Open-Meteo' },
    );
    return normalize(json);
  } catch (e) {
    logger.error('Open-Meteo 取得に失敗', e.message);
    return [];
  }
}
