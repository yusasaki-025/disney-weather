// §5 スコアリングロジック。
// 総合スコア = 100 - (風減点 + 雨減点 + 熱中症減点 + 寒さ減点 + UV減点)。
// 純関数として実装し、境界値をテストで担保する。

import { mean, maxOf } from '../utils/units.js';
import { showWindowHours } from '../data/showSchedule.js';
import { DEFAULT_THRESHOLD } from '../data/show-thresholds.js';
import { computeSourceWeights, weightFor } from './sourceWeight.js';

// §0.47.1 : 日全体の風バッジ判定に使う一般ショー基準の閾値 (windBa 8 / windCancel 11)。
//   通常 < 8 / 風バ 8-11 / 中止リスク 11-13 / 中止 ≥ 13。ショー固有の厳しい閾値 (ハーモニー 6m/s 等)
//   は詳細パネルの per-show 表示でのみ使い、日全体バッジには影響させない。
const DAY_WIND_THRESHOLD = { windBa: 8, windCancel: 11 };

// §0.39.5 (#23) : 起動時に 1 度だけソース重みを学習 (accuracy-log は静的 import なので不変)。
//   データ不足時は空 = 全ソース等重みで、従来の単純平均と同じ挙動になる。
const SOURCE_WEIGHTS = computeSourceWeights();

// 日次集計キー → 学習カテゴリ (wind/temp/wbgt)。該当なし (pop/precip 等) は等重み。
const WEIGHT_CATEGORY = {
  windMax: 'wind',
  gustMax: 'wind',
  tempMax: 'temp',
  tempMin: 'temp',
  feelsLikeMax: 'temp',
  feelsLikeMin: 'temp',
  wbgtMax: 'wbgt',
};

// ソース重みでの加重平均。category 未指定 ・ 学習なしのソースは weight 1.0 (= 単純平均) に縮退。
export function weightedMean(forecasts, key, category) {
  let num = 0;
  let den = 0;
  for (const f of forecasts) {
    const v = f[key];
    if (v == null || Number.isNaN(v)) continue;
    const w = category ? weightFor(SOURCE_WEIGHTS, category, f.source) : 1;
    num += v * w;
    den += w;
  }
  return den === 0 ? null : num / den;
}

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
  // §0.47.2 : 過剰減点を緩和 (6m/s -5 / 8m/s -15 / 10m/s -30 / 12m/s -50)。
  //   6-7m/s は一般的な風速で屋外ショーの大半は通常開催されるため軽い減点に留める。
  let d;
  if (gust < 6) d = 0;
  else if (gust < 8) d = 5;
  else if (gust < 10) d = 15; // 風バ域
  else if (gust < 12) d = 30; // 中止リスク域
  else d = 50; // 中止域
  if (park === 'TDS') d *= 1.2;
  return d;
}

// 雨減点 (pop_show_window 優先、無ければ pop_max)。precip_sum ≧ 5mm で +10。
export function rainDeduction(pop, precipSum) {
  // §0.47.2 : 過剰減点を緩和 (30% -5 / 50% -15 / 70% -35 / 90% -65)。precip_sum ≧ 5mm で +10。
  let d = 0;
  if (pop != null) {
    if (pop < 20) d = 0;
    else if (pop < 50) d = 5;
    else if (pop < 70) d = 15;
    else if (pop < 90) d = 35;
    else d = 65;
  }
  if (precipSum != null && precipSum >= 5) d += 10;
  return d;
}

// 熱中症減点 (wbgt_show_window 優先、無ければ wbgt_max)。風で緩和、体感高で悪化。
// §0.37 : バッジ 4 階層に合わせ < 25 通常 / 25-31 熱バ / 31-33 熱キャン / ≥ 33 中止 にマッピング。
export function heatDeduction(wbgt, feelsLikeMax, windShowWindow) {
  if (wbgt == null) return 0;
  let d;
  if (wbgt < 25) d = 0;
  else if (wbgt < 31) d = 30; // 熱バ域 (旧 警戒 + 厳重警戒 を merge)
  else if (wbgt < 33) d = 60; // 熱キャン域
  else d = 90; // 中止域
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

// §0.30 : 風バッジはショー別閾値 (windBa/windCancel) で判定する。
// threshold 省略時は DEFAULT (windBa 8 / windCancel 12)。
// level0 通常 < windBa ≤ level1 風バ < windCancel ≤ level2 中止リスク高 < windCancel+2 ≤ level3 ほぼ中止
export function windBadge(gust, threshold = DEFAULT_THRESHOLD) {
  if (gust == null) return { level: 0, text: '—' };
  const ba = threshold.windBa ?? DEFAULT_THRESHOLD.windBa;
  const cancel = threshold.windCancel ?? DEFAULT_THRESHOLD.windCancel;
  if (gust < ba) return { level: 0, text: '通常' };
  if (gust < cancel) return { level: 1, text: '風バ' };
  if (gust < cancel + 2) return { level: 2, text: '中止リスク' };
  return { level: 3, text: '中止' };
}

export function rainBadge(pop, precip) {
  if (pop == null && precip == null) return { level: 0, text: '—' };
  const p = pop ?? 0;
  const r = precip ?? 0;
  if (r >= 2) return { level: 3, text: '中止' };
  if (p >= 60 || r >= 1) return { level: 2, text: '雨キャン' };
  if (p >= 30 && r < 1) return { level: 1, text: '雨バ' };
  return { level: 0, text: '通常' };
}

// WBGT バッジ。§0.37 で風 ・ 雨と同じ 4 階層に統一 (旧「暑さ注意」を熱バに merge)。
// < 25 通常 / 25-31 熱バ / 31-33 熱キャン / ≥ 33 中止。風で 1 段階下げ、体感 38℃ 以上で 1 段階上げ。
export function wbgtBadge(wbgt, windShowWindow, feelsLikeMax) {
  if (wbgt == null) return { level: 0, text: '—' };
  let level;
  if (wbgt < 25) level = 0;
  else if (wbgt < 31) level = 1;
  else if (wbgt < 33) level = 2;
  else level = 3;
  if (windShowWindow != null && windShowWindow >= 5) level -= 1;
  if (feelsLikeMax != null && feelsLikeMax >= 38) level += 1;
  level = Math.max(0, Math.min(3, level));
  const TEXTS = ['通常', '熱バ', '熱キャン', '中止'];
  return { level, text: TEXTS[level] };
}

// --- バッジ severity と スコア上限ガード (§0.16) ---
// スコアは平均値ベース (§0.13.2)、バッジはピーク (最大) ベースなので、
// 「OK 75 なのに 雨ほぼ中止」のような矛盾が出る。バッジの危険度でスコアに上限キャップを掛ける。
const SEVERITY_RANK = { normal: 0, warn: 1, danger: 2, critical: 3 };
// §0.47.3 : floor guard を緩和 (風バ → 70 / 中止リスク ・ キャン → 40 / ほぼ中止 → 20)。
//   風バでもスコアは最大 70 (= OK) まで許容し、過剰格下げ (微妙固定) を解消する。
const SEVERITY_CAP = { critical: 20, danger: 40, warn: 70 };

export function badgeSeverity(text) {
  // §0.36 でラベル短縮 (ほぼ中止→中止 / 中止リスク高→中止リスク / 雨キャン濃厚→雨キャン 等)
  if (text === '中止') return 'critical';
  if (text === '中止リスク' || text === '雨キャン' || text === '熱キャン') return 'danger';
  if (text === '風バ' || text === '雨バ' || text === '熱バ') return 'warn';
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
export function aggregateMetrics(forecasts, park, date = null) {
  // §0.39.5 (#23) : ソース別 MAE で学習した重みでの加重平均 (データ不足時は等重み = 単純平均)。
  const avg = (key) => weightedMean(forecasts, key, WEIGHT_CATEGORY[key]);
  // §0.8 fix: date を渡してその日の実スケジュール窓でスコア算定する
  // (渡し忘れると常に FALLBACK 時刻窓になり、日別の実時刻が score に反映されない)
  const highHours = showWindowHours(park, 'high', 1, date);
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
  // §0.30 : その日 ・ パークの high 優先ショーで最も中止しやすい閾値を使う (安全側)
  // §0.47.1 : 日全体の風バッジは「一般ショー基準」(windBa 8 / windCancel 11) で判定する。
  //   旧実装は最も厳しいショー (ハーモニー 6m/s) の閾値を使い、6-7m/s で日全体が「風バ」に
  //   過剰判定され 9 割の日が格下げされていた。ショー個別の厳しい閾値は詳細パネル
  //   (per-show 風 ・ 過去中止率) で引き続き扱う。strictestThreshold/highShows は使わない。
  const badges = {
    wind: windBadge(gustForBadge, DAY_WIND_THRESHOLD),
    rain: rainBadge(popForBadge, metrics.precipSum),
    wbgt: wbgtBadge(wbgtForBadge, metrics.windShowWindow, metrics.feelsLikeMax),
  };

  // §0.16 : バッジ危険度でスコアに上限キャップ (スコアとバッジの矛盾解消)
  const guard = applyBadgeGuard(rawScore, badges);
  const score = guard.score;

  // §0.42.4 : 日スコアの floor guard を時間帯サブスコアにも波及させ整合を取る。
  // 日 = 別日 25 なのに 朝/昼/夜 = 75 のような乖離はユーザーの信頼を損なうため、
  // 各時間帯スコアを日スコア以下にクランプする (時間帯 ≦ 日)。
  for (const b of BANDS) {
    const s = subscores[b.key];
    if (s && s.hasData && s.score > score) {
      s.score = score;
      s.symbol = scoreToSymbol(score);
    }
  }

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
