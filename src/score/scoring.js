// §5 スコアリングロジック。
// 総合スコア = 100 - (風減点 + 雨減点 + 熱中症減点 + 寒さ減点 + UV減点)。
// 純関数として実装し、境界値をテストで担保する。

import { mean, maxOf, minOf } from '../utils/units.js';
import { showWindowOrMax } from '../utils/metrics.js';
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
// §0.52 : スコアラベルを 5 段階英語化 (BEST/GOOD/OK/FAIR/NG)。中段 (70点台) を GOOD/OK に分割し、
//   緑系の偏りを是正。判定は scoreToSymbol が min 降順で先頭一致。
// §0.52 : 信号機グラデーション (案 A)。BEST/NG は白文字、GOOD は白文字、OK/FAIR は薄色背景なので
//   濃文字 (CSS data-level で #33691E / #E65100 を当てる)。
export const SYMBOLS = [
  { min: 90, key: 'best', label: 'BEST', color: '#2E7D32', icon: 'star' },
  { min: 75, key: 'good', label: 'GOOD', color: '#66BB6A', icon: 'check_circle' },
  { min: 60, key: 'ok', label: 'OK', color: '#C0CA33', icon: 'check' },
  { min: 40, key: 'fair', label: 'FAIR', color: '#FFA726', icon: 'warning' },
  { min: -Infinity, key: 'ng', label: 'NG', color: '#E53935', icon: 'block' },
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
export function rainDeduction(pop, precipHourly) {
  // §0.55.2 : 雨確率と時間最大降水量を「合算」で減点 (§0.47/§0.48 で緩めすぎた反動修正)。
  //   確率 : 30% -10 / 50% -20 / 70% -35 / 90% -55。雨量 : <1 -5 / 1-3 -15 / 3-5 -30 / ≥5 -55。
  //   両方効くが二重減点を抑えるため合計 80 でキャップ。
  let d = 0;
  if (pop != null) {
    if (pop < 20) d = 0;
    else if (pop < 30) d = 5;
    else if (pop < 50) d = 10;
    else if (pop < 70) d = 20;
    else if (pop < 90) d = 35;
    else d = 55;
  }
  let p = 0;
  if (precipHourly != null && precipHourly > 0) {
    if (precipHourly < 1) p = 5;
    else if (precipHourly < 3) p = 15;
    else if (precipHourly < 5) p = 30;
    else p = 55;
  }
  return Math.min(80, d + p);
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

// §0.48.2 : 雨バッジは時間最大降水量 (mm/h) ベース。< 1 通常 / 1-3 雨バ / 3-5 雨キャン / ≥ 5 ほぼ中止。
//   降水量が弱くても降水確率が高ければ「雨バ可能性」。§0.48.3 : 霧雨 (drizzle) は長時間弱雨で
//   ショーは原則開催のため、雨バ可能性で上限固定する。
export function rainBadge(pop, precipHourly, drizzle = false) {
  if (pop == null && precipHourly == null) return { level: 0, text: '—' };
  const p = pop ?? 0;
  const r = precipHourly ?? 0;
  let badge;
  if (r >= 5) badge = { level: 3, text: '中止' };
  else if (r >= 3) badge = { level: 2, text: '雨キャン' };
  else if (r >= 1) badge = { level: 1, text: '雨バ' };
  else if (p >= 50) badge = { level: 1, text: '雨バ' }; // 降水量は弱いが高確率
  else badge = { level: 0, text: '通常' };
  if (drizzle && badge.level > 1) badge = { level: 1, text: '雨バ' };
  return badge;
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
// §0.47.3 / §0.52.3 : floor guard。風バ → 80 (= GOOD) / 中止リスク ・ キャン → 40 (= FAIR) / ほぼ中止 → 20 (= NG)。
//   §0.52 で 5 段階化 ・ warn cap を 70 → 80 に引き上げ、風バ日を GOOD 帯へ分離 (旧 70 だと風バ日が
//   全て OK に張り付き GOOD が空だった)。BEST(快適 90+) / GOOD(風バ等 75-89) / OK(60-74) を使い分ける。
const SEVERITY_CAP = { critical: 20, danger: 40, warn: 80 };

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

// §0.55.1 : 雨確率に応じたスコア上限 (降りそうな日は BEST にしない)。
//   < 30% 上限なし / 30-49% GOOD(89) / 50-69% OK(74) / 70%+ FAIR(59)。
//   霧雨 (drizzle) は弱雨が長時間 ・ ショー原則開催のため緩和 : < 1mm/h は OK(74) まで許容、≥ 1mm/h は FAIR(59)。
export function popScoreCap(pop, drizzle = false, precipHourly = null) {
  if (drizzle) return precipHourly != null && precipHourly >= 1 ? 59 : 74;
  if (pop == null || pop < 30) return 100;
  if (pop < 50) return 89; // GOOD
  if (pop < 70) return 74; // OK
  return 59; // FAIR
}

// §0.72 : 注意バッジ (風バ/雨バ/熱バ = warn) の要素別上限 (§0.55.5 の個数ベースを置換)。
//   実態 (Yuka 知見) : 風は緩い (注意でも開催されやすい) / 雨 ・ 熱は厳しい (悪化で確定キャン)。
//   風単独 = GOOD(89) / 雨 or 熱単独 = OK(74) / 雨+熱 = FAIR(59) / 風+雨 or 風+熱 = OK(74) / 3つ = FAIR(59)。
//   中止リスク/キャン/中止 (danger/critical) は applyBadgeGuard 側で別途キャップ。
export function warnElementCap(badges) {
  const isWarn = (b) => !!b && badgeSeverity(b.text) === 'warn';
  const hasWind = isWarn(badges.wind);
  const hasRain = isWarn(badges.rain);
  const hasHeat = isWarn(badges.wbgt);
  let cap = 100;
  if (hasRain && hasHeat) cap = Math.min(cap, 59); // 雨+熱 = FAIR
  else if (hasRain || hasHeat) cap = Math.min(cap, 74); // 雨単独 or 熱単独 = OK
  if (hasWind && (hasRain || hasHeat)) cap = Math.min(cap, 74); // 風+雨 or 風+熱 = OK
  else if (hasWind) cap = Math.min(cap, 89); // 風単独 = GOOD
  return cap;
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

// §0.57.1c : その日の全ソース hourly から field の「最低 〜 最高」レンジを返す
// ({ min, max } | null)。「この日の概要」のレンジ表示用。ショー窓平均 (windowMean) や
// 日次最大の加重平均 (windMax 等) とは別軸で、1 日の振れ幅をそのまま示す。
export function hourlyRange(forecasts, field) {
  const vals = forecasts.flatMap((f) => (f.hourly || []).map((p) => p[field]));
  const min = minOf(vals);
  const max = maxOf(vals);
  return min == null || max == null ? null : { min, max };
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
    // §0.48.1 : 時間最大降水量 (mm/h)。中止判定 ・ 雨セル表示はこちらを使う (日合計 precipSum は梅雨 ・
    //   霧雨が長時間続いた累積で、中止判定とは別軸。13mm/日 の霧雨を「ほぼ中止」と誤判定しないため)。
    precipMaxHourly: maxOf(
      forecasts.flatMap((f) => (f.hourly || []).map((h) => h.precip).filter((v) => v != null)),
    ),
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
    // §0.57.1c : 「この日の概要」用の 1 日の振れ幅レンジ ({ min, max } | null)。
    // 全ソース hourly の最低 〜 最高。カード上 (ショー窓) との食い違いを「レンジ内」として吸収する。
    windRange: hourlyRange(forecasts, 'wind'),
    gustRange: hourlyRange(forecasts, 'gust'),
    popRange: hourlyRange(forecasts, 'pop'),
    precipRange: hourlyRange(forecasts, 'precip'),
    wbgtRange: hourlyRange(forecasts, 'wbgt'),
  };
}

// 指標 → 総合スコア ＋ 内訳 (§5.2)
export function scoreFromMetrics(m, park) {
  const gust = showWindowOrMax(m, 'gust');
  const pop = showWindowOrMax(m, 'pop');
  const wbgt = showWindowOrMax(m, 'wbgt');
  const deductions = {
    wind: windDeduction(gust, park),
    // §0.48.2 : 雨減点は時間最大降水量 (mm/h) ベース (日合計 precipSum は使わない)。
    rain: rainDeduction(pop, m.precipMaxHourly),
    heat: heatDeduction(wbgt, m.feelsLikeMax, m.windShowWindow),
    cold: coldDeduction(m.feelsLikeMax, m.tempMax),
    uv: uvDeduction(m.uvMax),
  };
  const total = Object.values(deductions).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - total)));
  return { score, deductions, symbol: scoreToSymbol(score) };
}

// --- 時間帯サブスコア (§3.3) ---
// §0.66.1 : 重みは Yuka 確定値 (朝 1.5 / 昼 2.0 / 夜 1.0)。昼を最重視しつつ朝 ・ 夜も無視しない。
//   日スコアはこの重みでの時間帯加重平均で算出する (weightedBandTotal)。
export const BANDS = [
  { key: 'morning', label: '朝', hours: new Set([9, 10, 11]), weight: 1.5 },
  { key: 'noon', label: '昼', hours: new Set([12, 13, 14, 15]), weight: 2.0 },
  { key: 'night', label: '夜', hours: new Set([18, 19, 20]), weight: 1.0 },
];

// 時間帯ごとのミニスコア (風 ・ 雨 ・ 熱 ・ 寒さ ・ UV の減点で算定)。
// §0.66.3 : スコア理由用に主因 (最大減点要素) も返す (風 / 雨 / 暑さ / 寒さ / UV / null)。
// §0.74 : §0.68.1 の時間帯別バッジ (日バッジ統合用) は撤廃 (日バッジはショー時刻 showWindow 由来に
//   一本化したため不要)。ここはスコア (時間帯ピーク) のみを返す。
export function bandSubscore(forecasts, band, park) {
  const gust = windowMax(forecasts, band.hours, 'gust');
  const pop = windowMax(forecasts, band.hours, 'pop');
  const wbgt = windowMax(forecasts, band.hours, 'wbgt');
  const wind = windowMax(forecasts, band.hours, 'wind');
  const feelsLikeMax = mean(forecasts.map((f) => f.feelsLikeMax));
  // §0.68.H.b (監査 L-2) : 寒さ ・ UV も band に組み込み、日スコア (時間帯加重平均) に反映させる。
  //   §0.66 で日スコアが band 平均ベースになり、要素ベース rawScore に入る cold/uv が捨てられて
  //   いたため (冬日 ・ 強 UV 日が過大評価)。cold/uv は日次値なので全時間帯に一律で効く。
  const tempMax = mean(forecasts.map((f) => f.tempMax));
  const uvMax = mean(forecasts.map((f) => f.uvMax));
  const dWind = windDeduction(gust, park);
  const dRain = rainDeduction(pop, null);
  const dHeat = heatDeduction(wbgt, feelsLikeMax, wind);
  const dCold = coldDeduction(feelsLikeMax, tempMax);
  const dUv = uvDeduction(uvMax);
  const score = Math.max(0, Math.min(100, Math.round(100 - (dWind + dRain + dHeat + dCold + dUv))));
  // 主因 (最大減点) — スコア理由用。cold/uv は中止バッジが無いので「寒さ」「UV」ラベルで補足。
  const factors = [
    ['風', dWind],
    ['雨', dRain],
    ['暑さ', dHeat],
    ['寒さ', dCold],
    ['UV', dUv],
  ];
  const maxD = Math.max(...factors.map(([, d]) => d));
  const factor = maxD <= 0 ? null : factors.find(([, d]) => d === maxD)[0];
  return { score, symbol: scoreToSymbol(score), hasData: gust != null || pop != null, factor };
}

// 時間帯サブスコアの重み付き平均 (§0.66.1 : 日スコアの基準)
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

// §0.66.2 : floor guard。時間帯に NG/FAIR が含まれる日は日スコアに上限を掛け、
//   「最重視の昼が FAIR なのに日 OK」のような楽観バイアスを防ぐ。
//   いずれか NG (< 40) → 日 ≤ 59 (FAIR) / いずれか FAIR (< 60) → 日 ≤ 74 (OK) / 全部 OK 以上 → 上限なし。
export function bandFloorCap(subscores) {
  let hasNg = false;
  let hasFair = false;
  for (const b of BANDS) {
    const s = subscores[b.key];
    if (!s || !s.hasData) continue;
    if (s.score < 40) hasNg = true;
    else if (s.score < 60) hasFair = true;
  }
  if (hasNg) return 59;
  if (hasFair) return 74;
  return 100;
}

// --- 1 日分の総合評価 (UI が使う入口) ---
export function evaluateDay(forecasts, park, date = null) {
  const metrics = aggregateMetrics(forecasts, park, date);
  const { score: rawScore, deductions } = scoreFromMetrics(metrics, park);

  // §0.48.3 : いずれかのソースが霧雨 (weatherText に「霧雨」) なら雨バッジを上限固定する。
  const drizzle = forecasts.some((f) => /霧雨/.test(f.weatherText || ''));
  const subscores = {};
  for (const b of BANDS) subscores[b.key] = bandSubscore(forecasts, b, park);

  const gustForBadge = showWindowOrMax(metrics, 'gust');
  const popForBadge = showWindowOrMax(metrics, 'pop');
  const wbgtForBadge = showWindowOrMax(metrics, 'wbgt');

  // §0.74 (案 B) : 日バッジ判定を「ショー時刻範囲 (showWindow)」に統一。表示数値 (カードの風/雨/熱の値) と
  //   同じソース (showWindowOrMax) なので、数値とバッジが必ず一致する。
  //   §0.68.1 の「全時間帯 (朝/昼/夜) の最悪値 (worstBandBadge)」は撤廃 ・ ショー時刻外 (深夜/早朝) の
  //   ピークで「ショー時刻 8.4m/s なのに中止リスク高 (別時間帯 11m/s 由来)」となる乖離を解消する。
  const badges = {
    wind: windBadge(gustForBadge, DAY_WIND_THRESHOLD),
    rain: rainBadge(popForBadge, metrics.precipMaxHourly, drizzle),
    wbgt: wbgtBadge(wbgtForBadge, metrics.windShowWindow, metrics.feelsLikeMax),
  };

  // §0.66.1 : 日スコアの基準を「全要素加重平均 (rawScore)」から「時間帯サブスコアの加重平均」に変更。
  //   全部通常なら高得点になる要素ベースだと「時間帯 FAIR なのに日 OK」が起きるため、時間帯ベースで整合。
  //   時間帯データが無い日 (fallback で hourly なし等) は従来の rawScore に縮退する。
  const bandAvg = weightedBandTotal(subscores);
  const base = bandAvg != null ? bandAvg : rawScore;

  // §0.66.2 : floor guard。時間帯に NG/FAIR があれば日スコアに上限を掛ける。
  const floorCap = bandFloorCap(subscores);

  // §0.16 / §0.55 : バッジ危険度 ・ 雨確率 ・ 注意バッジ同時数の上限も併用 (安全網)。
  //   特に band 算定は precip mm/h を見ない (pop のみ) ため、強雨日は雨バッジキャップで担保する。
  const guard = applyBadgeGuard(base, badges);
  const pCap = popScoreCap(popForBadge, drizzle, metrics.precipMaxHourly);
  const cCap = warnElementCap(badges); // §0.72 : 要素別重み付け上限 (旧 warnCountCap)
  const score = Math.min(guard.score, pCap, cCap, floorCap);
  // §0.68.A (監査 L-1) : §0.66 で日スコアの基準が rawScore → base (時間帯加重平均) に変わったので、
  //   「キャップで下がったか」の判定も base と比較する (rawScore 比較だと無関係な日に capped=true になり
  //    格下げツールチップが誤表示されていた)。
  const capped = score < base;

  // §0.66.4 : §0.42.4 (時間帯 ≦ 日 クランプ) は撤廃。日が時間帯加重平均なので自然に整合し、
  //   時間帯スコアは時刻別の独自値のまま (夜が日より高い等もそのまま表示)。

  return {
    score,
    rawScore,
    base,
    capped,
    worstSeverity: guard.worstSeverity,
    symbol: scoreToSymbol(score),
    deductions,
    metrics,
    subscores,
    weightedTotal: bandAvg,
    floorCap,
    badges,
  };
}
