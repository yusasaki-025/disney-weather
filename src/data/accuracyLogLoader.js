// 予報精度ログ (§0.29 の accuracy-log.json) のローダ + 集計 (§0.32)。
// track-accuracy.mjs が日次で追記する { date: { actualMax*, forecasts: { src: {predicted*, *Error} } } }。
// RMS (二乗平均平方根誤差) と bias (符号付き平均誤差 = 予報 - 実測) を算出する。

import logJson from './accuracy-log.json';

const METRICS = [
  { key: 'wind', actual: 'actualMaxWind', predicted: 'predictedMaxWind', error: 'windError', label: '風速', unit: 'm/s' },
  { key: 'temp', actual: 'actualMaxTemp', predicted: 'predictedMaxTemp', error: 'tempError', label: '気温', unit: '℃' },
  { key: 'wbgt', actual: 'actualMaxWbgt', predicted: 'predictedMaxWbgt', error: 'wbgtError', label: 'WBGT', unit: '℃' },
];

export const ACCURACY_METRICS = METRICS;

// 日付昇順の配列に正規化。{ date, actual:{...}, forecasts:{...} }
export function getAccuracyLog() {
  return Object.entries(logJson)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const rms = (arr) => (arr.length ? Math.sqrt(arr.reduce((s, x) => s + x * x, 0) / arr.length) : null);
const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// ソース別 ・ 指標別の RMS / bias / サンプル数を集計。
// 戻り値: { [src]: { [metricKey]: { rms, bias, n } } }
export function computeStats(log = getAccuracyLog()) {
  const out = {};
  for (const day of log) {
    for (const [src, f] of Object.entries(day.forecasts || {})) {
      out[src] = out[src] || {};
      for (const m of METRICS) {
        const actual = day[m.actual];
        const predicted = f[m.predicted];
        if (actual == null || predicted == null) continue;
        out[src][m.key] = out[src][m.key] || { errs: [], biases: [] };
        out[src][m.key].errs.push(Math.abs(predicted - actual));
        out[src][m.key].biases.push(predicted - actual);
      }
    }
  }
  for (const src of Object.keys(out)) {
    for (const k of Object.keys(out[src])) {
      const { errs, biases } = out[src][k];
      out[src][k] = { rms: round1(rms(errs)), bias: round1(mean(biases)), n: errs.length };
    }
  }
  return out;
}

// 時系列グラフ用: { dates:[...], series: { [src]: { [metricKey]: [誤差|null,...] } } }
export function timeSeries(log = getAccuracyLog()) {
  const dates = log.map((d) => d.date);
  const series = {};
  for (const day of log) {
    for (const src of Object.keys(day.forecasts || {})) {
      series[src] = series[src] || {};
      for (const m of METRICS) {
        series[src][m.key] = series[src][m.key] || [];
      }
    }
  }
  for (const day of log) {
    for (const src of Object.keys(series)) {
      const f = day.forecasts?.[src];
      for (const m of METRICS) {
        const actual = day[m.actual];
        const predicted = f?.[m.predicted];
        series[src][m.key].push(actual != null && predicted != null ? round1(Math.abs(predicted - actual)) : null);
      }
    }
  }
  return { dates, series };
}

// 直近の的中例 ・ 外し例 (|誤差| 上位 = 外し / 下位 = 的中)。風速基準で抽出。
export function notableExamples(log = getAccuracyLog(), limit = 5) {
  const rows = [];
  for (const day of log) {
    for (const [src, f] of Object.entries(day.forecasts || {})) {
      const actual = day.actualMaxWind;
      const predicted = f.predictedMaxWind;
      if (actual == null || predicted == null) continue;
      rows.push({ date: day.date, src, predicted, actual, error: round1(Math.abs(predicted - actual)) });
    }
  }
  rows.sort((a, b) => b.error - a.error);
  return { misses: rows.slice(0, limit), hits: rows.slice(-limit).reverse() };
}
