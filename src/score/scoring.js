// §5 スコアリングロジック。
// 総合スコア = 100 - (風減点 + 雨減点 + 熱中症減点 + 寒さ減点 + UV減点)。
// 純関数として実装し、境界値をテストで担保する。

import { mean, maxOf } from '../utils/units.js';
import { showWindowHours } from '../data/showSchedule.js';

// --- スコア → レベル (§5.3, §0.6.5) ---
// ◎ ○ △ × の記号は廃止。用途が直感的に伝わる日本語テキストラベル + 色で表現する。
// 評価系アイコン (§0.18-2)。4 種とも Unicode 形状が異なり、フォント未読込時も判別可。
export const SYMBOLS = [
  { min: 85, key: 'excellent', label: 'ベスト', color: '#2D8F3E', icon: 'star' },
  { min: 70, key: 'good', label: 'OK', color: '#88C057', icon: 'done' },
  { min: 50, key: 'fair', label: '微妙', color: '#F2A93B', icon: 'warning' },
  { min: -Infinity, key: 'bad', label: '別日', color: '#D24A4A', icon: 'block' },
];

export function scoreToSymbol(score) {
  return SYMBOLS.find((s) => score >= s.min);
}

// --- 個別減点 (§5.2) ---

// 風減点 (gust_show_window 優先、無ければ gust_max)。TDS は全体 × 1.2。
export function windDeduction(gust, park) {
  if (gust == null) return 0;
  let d;
  if (gust < 5) d = 0;
  else if (gust < 8) d = 10;
  else if (gust < 10) d = 30; // 風バ域
  else if (gust < 13) d = 60; // パレード中止域
  else d = 90; // アトラクションも止まる域
  if (park === 'TDS') d *= 1.2;
  return d;
}

// 雨減点 (pop_show_window 優先、無ければ pop_max)。precip_sum ≧ 5mm で +10。
export function rainDeduction(pop, precipSum) {
  let d = 0;
  if (pop != null) {
    if (pop < 20) d = 0;
    else if (pop < 50) d = 15;
    else if (pop < 70) d = 30;
    else d = 50;
  }
  if (precipSum != null && precipSum >= 5) d += 10;
  return d;
}

// 熱中症減点 (wbgt_show_window 優先、無ければ wbgt_max)。風で緩和、体感高で悪化。
export function heatDeduction(wbgt, feelsLikeMax, windShowWindow) {
  if (wbgt == null) return 0;
  let d;
  if (wbgt < 25) d = 0;
  else if (wbgt < 28) d = 10; // 警戒
  else if (wbgt < 31) d = 30; // 厳重警戒・熱バ域
  else if (wbgt < 33) d = 60; // 危険・熱キャン域
  else d = 90; // 極めて危険
  if (feelsLikeMax != null && feelsLikeMax >= 35) d += 10;
  if (windShowWindow != null && windShowWindow >= 5) d -= 5; // 風で緩和
  return Math.max(0, d);
}

// 寒さ減点 (feels_like_max を使う、無ければ temp_max)
export function coldDeduction(feelsLikeMax, tempMax) {
  const t = feelsLikeMax != null ? feelsLikeMax : tempMax;
  if (t == null) return 0;
  if (t >= 10) return 0;
  if (t >= 5) return 10;
  return 25;
}

// UV減点
export function uvDeduction(uvMax) {
  if (uvMax == null) return 0;
  if (uvMax < 8) return 0;
  if (uvMax < 11) return 5;
  return 10;
}

// --- バッジ (§5.5, §5.6) ---

export function windBadge(gust) {
  if (gust == null) return { level: 0, text: '—' };
  if (gust < 8) return { level: 0, text: '通常' };
  if (gust < 10) return { level: 1, text: '風バ可能性あり' };
  if (gust < 13) return { level: 2, text: '中止リスク高' };
  return { level: 3, text: 'ほぼ中止' };
}

export function rainBadge(pop, precip) {
  if (pop == null && precip == null) return { level: 0, text: '—' };
  const p = pop ?? 0;
  const r = precip ?? 0;
  if (r >= 2) return { level: 3, text: 'ほぼ中止' };
  if (p >= 60 || r >= 1) return { level: 2, text: '雨キャン濃厚' };
  if (p >= 30 && r < 1) return { level: 1, text: '雨バ可能性' };
  return { level: 0, text: '通常' };
}

// WBGT バッジ。風で 1 段階下げ、体感 38℃ 以上で 1 段階上げ。
export function wbgtBadge(wbgt, windShowWindow, feelsLikeMax) {
  if (wbgt == null) return { level: 0, text: '—' };
  let level;
  if (wbgt < 25) level = 0;
  else if (wbgt < 28) level = 1;
  else if (wbgt < 31) level = 2;
  else if (wbgt < 33) level = 3;
  else level = 4;
  if (windShowWindow != null && windShowWindow >= 5) level -= 1;
  if (feelsLikeMax != null && feelsLikeMax >= 38) level += 1;
  level = Math.max(0, Math.min(4, level));
  const TEXTS = ['通常', '暑さ注意', '熱バ可能性あり', '熱キャン濃厚', 'ほぼ中止'];
  return { level, text: TEXTS[level] };
}

// --- バッジ severity と スコア上限ガード (§0.16) ---
// スコアは平均値ベース (§0.13.2)、バッジはピーク (最大) ベースなので、
// 「OK 75 なのに 雨ほぼ中止」のような矛盾が出る。バッジの危険度でスコアに上限キャップを掛ける。
const SEVERITY_RANK = { normal: 0, warn: 1, danger: 2, critical: 3 };
const SEVERITY_CAP = { critical: 25, danger: 45, warn: 65 };

export function badgeSeverity(text) {
  if (text === 'ほぼ中止') return 'critical';
  if (text === '中止リスク高' || text === '雨キャン濃厚' || text === '熱キャン濃厚') return 'danger';
  if (text === '風バ可能性あり' || text === '雨バ可能性' || text === '熱バ可能性あり' || text === '暑さ注意')
    return 'warn';
  return 'normal';
}

// rawScore とバッジ群から、最悪 severity に応じてキャップした最終スコアを返す。
export function applyBadgeGuard(rawScore, badges) {
  let worst = 'normal';
  for (const b of Object.values(badges)) {
    const s = badgeSeverity(b.text);
    if (SEVERITY_RANK[s] > SEVERITY_RANK[worst]) worst = s;
  }
  const cap = SEVERITY_CAP[worst];
  const score = cap != null ? Math.min(rawScore, cap) : rawScore;
  return { score, rawScore, worstSeverity: worst, capped: score < rawScore };
}

// --- 指標の集計 (§5.1) ---

// 指定時間帯 hours の field (hourly) について、各ソースの最大値を取り、ソース間平均を返す。
// (詳細パネルの「ピーク」参考表示用。スコアには使わない。)
export function windowMax(forecasts, hours, field) {
  const perSource = [];
  for (const f of forecasts) {
    if (!f.hourly || f.hourly.length === 0) continue;
    const vals = f.hourly.filter((p) => hours.has(p.hour)).map((p) => p[field]);
    const m = maxOf(vals);
    if (m != null) perSource.push(m);
  }
  return mean(perSource);
}

// 指定時間帯 hours の field について、各ソースの平均を取り、ソース間平均を返す (§0.13.2)。
// 一瞬の突風で全体評価が落ちないよう、スコア算定窓は平均ベースにする。
export function windowMean(forecasts, hours, field) {
  const perSource = [];
  for (const f of forecasts) {
    if (!f.hourly || f.hourly.length === 0) continue;
    const vals = f.hourly.filter((p) => hours.has(p.hour)).map((p) => p[field]);
    const m = mean(vals);
    if (m != null) perSource.push(m);
  }
  return mean(perSource);
}

// 窓内ピーク時刻 (ツールチップ「ピーク 15m/s (15時)」用)。{ value, hour } | null。
export function windowPeak(forecasts, hours, field) {
  let best = null;
  for (const f of forecasts) {
    if (!f.hourly || f.hourly.length === 0) continue;
    for (const p of f.hourly) {
      if (!hours.has(p.hour)) continue;
      const v = p[field];
      if (v == null || Number.isNaN(v)) continue;
      if (best == null || v > best.value) best = { value: v, hour: p.hour };
    }
  }
  return best;
}

// その日の複数ソースを単純平均して指標オブジェクトを作る
export function aggregateMetrics(forecasts, park) {
  const avg = (key) => mean(forecasts.map((f) => f[key]));
  const highHours = showWindowHours(park, 'high', 1);
  return {
    windMax: avg('windMax'),
    gustMax: avg('gustMax'),
    popMax: avg('popMax'),
    precipSum: avg('precipSum'),
    tempMax: avg('tempMax'),
    tempMin: avg('tempMin'),
    feelsLikeMax: avg('feelsLikeMax'),
    feelsLikeMin: avg('feelsLikeMin'),
    wbgtMax: avg('wbgtMax'),
    uvMax: avg('uvMax'),
    // ショー時刻 ±1h の窓 (hourly から)。スコア算定は平均ベース (§0.13.2)。
    windShowWindow: windowMean(forecasts, highHours, 'wind'),
    gustShowWindow: windowMean(forecasts, highHours, 'gust'),
    popShowWindow: windowMean(forecasts, highHours, 'pop'),
    wbgtShowWindow: windowMean(forecasts, highHours, 'wbgt'),
    // 窓内ピーク (詳細ツールチップ参考表示用)
    gustPeak: windowPeak(forecasts, highHours, 'gust'),
    popPeak: windowPeak(forecasts, highHours, 'pop'),
    wbgtPeak: windowPeak(forecasts, highHours, 'wbgt'),
  };
}

// 指標 → 総合スコア ＋ 内訳 (§5.2)
export function scoreFromMetrics(m, park) {
  const gust = m.gustShowWindow != null ? m.gustShowWindow : m.gustMax;
  const pop = m.popShowWindow != null ? m.popShowWindow : m.popMax;
  const wbgt = m.wbgtShowWindow != null ? m.wbgtShowWindow : m.wbgtMax;
  const deductions = {
    wind: windDeduction(gust, park),
    rain: rainDeduction(pop, m.precipSum),
    heat: heatDeduction(wbgt, m.feelsLikeMax, m.windShowWindow),
    cold: coldDeduction(m.feelsLikeMax, m.tempMax),
    uv: uvDeduction(m.uvMax),
  };
  const total = Object.values(deductions).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - total)));
  return { score, deductions, symbol: scoreToSymbol(score) };
}

// --- 時間帯サブスコア (§3.3) ---
export const BANDS = [
  { key: 'morning', label: '朝', hours: new Set([9, 10, 11]), weight: 0.5 },
  { key: 'noon', label: '昼', hours: new Set([12, 13, 14, 15]), weight: 2.0 },
  { key: 'night', label: '夜', hours: new Set([18, 19, 20]), weight: 0.3 },
];

// 時間帯ごとのミニスコア (風 ・ 雨 ・ 熱の減点のみで算定)
export function bandSubscore(forecasts, band, park) {
  const gust = windowMax(forecasts, band.hours, 'gust');
  const pop = windowMax(forecasts, band.hours, 'pop');
  const wbgt = windowMax(forecasts, band.hours, 'wbgt');
  const wind = windowMax(forecasts, band.hours, 'wind');
  const feelsLikeMax = mean(forecasts.map((f) => f.feelsLikeMax));
  const total =
    windDeduction(gust, park) +
    rainDeduction(pop, null) +
    heatDeduction(wbgt, feelsLikeMax, wind);
  const score = Math.max(0, Math.min(100, Math.round(100 - total)));
  return { score, symbol: scoreToSymbol(score), hasData: gust != null || pop != null };
}

// 時間帯サブスコアの重み付き平均 (§5.2 の代替総合スコア形)
export function weightedBandTotal(subscores) {
  let num = 0;
  let den = 0;
  for (const b of BANDS) {
    const s = subscores[b.key];
    if (s && s.hasData) {
      num += s.score * b.weight;
      den += b.weight;
    }
  }
  return den === 0 ? null : Math.round(num / den);
}

// --- 1 日分の総合評価 (UI が使う入口) ---
export function evaluateDay(forecasts, park, date = null) {
  const metrics = aggregateMetrics(forecasts, park, date);
  const { score: rawScore, deductions } = scoreFromMetrics(metrics, park);

  const subscores = {};
  for (const b of BANDS) subscores[b.key] = bandSubscore(forecasts, b, park);

  const gustForBadge = metrics.gustShowWindow != null ? metrics.gustShowWindow : metrics.gustMax;
  const popForBadge = metrics.popShowWindow != null ? metrics.popShowWindow : metrics.popMax;
  const wbgtForBadge = metrics.wbgtShowWindow != null ? metrics.wbgtShowWindow : metrics.wbgtMax;
  const badges = {
    wind: windBadge(gustForBadge),
    rain: rainBadge(popForBadge, metrics.precipSum),
    wbgt: wbgtBadge(wbgtForBadge, metrics.windShowWindow, metrics.feelsLikeMax),
  };

  // §0.16 : バッジ危険度でスコアに上限キャップ (スコアとバッジの矛盾解消)
  const guard = applyBadgeGuard(rawScore, badges);
  const score = guard.score;

  return {
    score,
    rawScore,
    capped: guard.capped,
    worstSeverity: guard.worstSeverity,
    symbol: scoreToSymbol(score),
    deductions,
    metrics,
    subscores,
    weightedTotal: weightedBandTotal(subscores),
    badges,
  };
}
