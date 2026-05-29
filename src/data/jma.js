// 気象庁 (JMA) の取得 ＆ 内部正規化。千葉県 forecast (120000.json) を使う。
// 取得できるのは降水確率 (3時間 / 週間)・気温・天気概況のみ。
// 風速は overview の文章中にしか無く構造化されていないため null とし、他ソースで補完する。
// hourly も構造化されていないため空配列。認証不要・CORS 許可済み。

import { withRetry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import { nowIso } from '../utils/date.js';

export const SOURCE_ID = 'jma';
const URL = 'https://www.jma.go.jp/bosai/forecast/data/forecast/120000.json';

// 浦安 = 千葉県北西部 (120010)。週間気温は最寄りの 銚子 (45148)、短期気温は 千葉 (45212)。
const AREA_NW = '120010';
const AREA_TEMP_SHORT = '45212';
const AREA_TEMP_WEEK = '45148';

// JMA 天気コード → 概況 (代表値)。未収録は先頭桁でカテゴリ推定。
const JMA_WEATHER = {
  100: '晴れ', 101: '晴れ時々曇り', 102: '晴れ一時雨', 104: '晴れ一時雪',
  110: '晴れ後曇り', 112: '晴れ後雨', 115: '晴れ後雪',
  200: '曇り', 201: '曇り時々晴れ', 202: '曇り一時雨', 203: '曇り時々雨',
  204: '曇り一時雪', 206: '曇り後雨', 210: '曇り後晴れ', 212: '曇り後雨', 218: '曇り後雨',
  300: '雨', 301: '雨時々晴れ', 302: '雨時々曇り', 303: '雨時々雪', 308: '大雨',
  311: '雨後晴れ', 313: '雨後曇り', 314: '雨後雪',
  400: '雪', 401: '雪時々晴れ', 402: '雪時々曇り', 403: '雪時々雨',
  411: '雪後晴れ', 413: '雪後曇り',
};

export function jmaWeatherText(code) {
  if (code == null || code === '') return null;
  const n = Number(code);
  if (JMA_WEATHER[n]) return JMA_WEATHER[n];
  const head = String(code)[0];
  return { 1: '晴れ', 2: '曇り', 3: '雨', 4: '雪' }[head] ?? '不明';
}

const jstDate = (iso) => iso.slice(0, 10); // '2026-05-30T17:00:00+09:00' → '2026-05-30'
const jstHour = (iso) => Number(iso.slice(11, 13));

function pickArea(timeSeries, code) {
  if (!timeSeries) return null;
  return timeSeries.areas.find((a) => a.area.code === code) || timeSeries.areas[0];
}

function emptyDay(date, fetchedAt) {
  return {
    source: SOURCE_ID,
    date,
    weatherText: null,
    tempMax: null,
    tempMin: null,
    feelsLikeMax: null,
    feelsLikeMin: null,
    popMax: null,
    precipSum: null,
    windMax: null, // JMA は構造化された風速を持たない
    gustMax: null,
    wbgtMax: null,
    wbgtSource: null,
    uvMax: null,
    hourly: [], // JMA は hourly を持たない
    fetchedAt,
  };
}

export function normalize(json) {
  const fetchedAt = nowIso();
  if (!Array.isArray(json) || json.length === 0) return [];
  const byDate = {};
  const ensure = (date) => (byDate[date] ||= emptyDay(date, fetchedAt));

  const short = json[0];
  const weekly = json[1];

  // --- 短期予報 ---
  if (short?.timeSeries) {
    for (const ts of short.timeSeries) {
      const sample = ts.areas[0];
      if (sample.pops) {
        // 3 時間刻み降水確率 → 日別最大
        const area = pickArea(ts, AREA_NW);
        ts.timeDefines.forEach((td, i) => {
          const v = area.pops[i];
          if (v == null || v === '') return;
          const d = ensure(jstDate(td));
          const pop = Number(v);
          d.popMax = d.popMax == null ? pop : Math.max(d.popMax, pop);
        });
      } else if (sample.weathers || sample.weatherCodes) {
        // 天気概況
        const area = pickArea(ts, AREA_NW);
        ts.timeDefines.forEach((td, i) => {
          const d = ensure(jstDate(td));
          if (d.weatherText == null) {
            d.weatherText = area.weathers?.[i]
              ? area.weathers[i].replace(/\u3000+/g, ' ').trim()
              : jmaWeatherText(area.weatherCodes?.[i]);
          }
        });
      } else if (sample.temps) {
        // 気温 (00 時付近 = 最低、09 時付近 = 最高)
        const area = pickArea(ts, AREA_TEMP_SHORT);
        ts.timeDefines.forEach((td, i) => {
          const v = area.temps[i];
          if (v == null || v === '') return;
          const d = ensure(jstDate(td));
          const t = Number(v);
          if (jstHour(td) < 9) {
            d.tempMin = d.tempMin == null ? t : Math.min(d.tempMin, t);
          } else {
            d.tempMax = d.tempMax == null ? t : Math.max(d.tempMax, t);
          }
        });
      }
    }
  }

  // --- 週間予報 (短期で埋まっていない日を補完) ---
  if (weekly?.timeSeries) {
    for (const ts of weekly.timeSeries) {
      const sample = ts.areas[0];
      if (sample.pops || sample.weatherCodes) {
        const area = pickArea(ts, '120000');
        ts.timeDefines.forEach((td, i) => {
          const d = ensure(jstDate(td));
          const pop = area.pops?.[i];
          if (d.popMax == null && pop != null && pop !== '') d.popMax = Number(pop);
          if (d.weatherText == null && area.weatherCodes?.[i]) {
            d.weatherText = jmaWeatherText(area.weatherCodes[i]);
          }
        });
      } else if (sample.tempsMax || sample.tempsMin) {
        const area = pickArea(ts, AREA_TEMP_WEEK);
        ts.timeDefines.forEach((td, i) => {
          const d = ensure(jstDate(td));
          const tmax = area.tempsMax?.[i];
          const tmin = area.tempsMin?.[i];
          if (d.tempMax == null && tmax != null && tmax !== '') d.tempMax = Number(tmax);
          if (d.tempMin == null && tmin != null && tmin !== '') d.tempMin = Number(tmin);
        });
      }
    }
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchJma() {
  try {
    const json = await withRetry(
      async () => {
        const res = await fetch(URL);
        if (!res.ok) throw new Error(`JMA HTTP ${res.status}`);
        return res.json();
      },
      { label: 'JMA' },
    );
    return normalize(json);
  } catch (e) {
    logger.error('JMA 取得に失敗', e.message);
    return [];
  }
}
