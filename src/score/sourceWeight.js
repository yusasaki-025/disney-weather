// §0.39.5 (#23) : 予報ソース重み付け。accuracy-log (§0.32) の MAE (平均絶対誤差) から
//   各ソースの信頼度を学習し、誤差の小さいソースを重く扱う重み付き平均で総合スコアを安定させる。
//
// 安全設計 : サンプル不足 (n < MIN_SAMPLES) のソース ・ 指標は等重みにフォールバックする。
//   1〜数日のノイズで重みが乱高下し、スコアが日替わりで揺れるのを防ぐ (統計的に意味のある量が
//   貯まってから初めて効かせる)。蓄積が進めば自動で重み付けが効き始める。

import { computeStats } from '../data/accuracyLogLoader.js';

// この件数以上の比較サンプルがあるソース ・ 指標のみ重み付けの対象にする。
export const MIN_SAMPLES = 5;

// 学習対象の指標カテゴリ (accuracy-log が持つ wind / temp / wbgt)。rain はログに無いため等重み。
const WEIGHTED_METRICS = ['wind', 'temp', 'wbgt'];

// 指標カテゴリごとに、各ソースの重み { metricKey: { src: weight } } を返す。
//   weight = 1 / (MAE + ε) を、その指標で MIN_SAMPLES 以上あるソース間で正規化 (平均が 1 になるよう調整)。
//   対象ソースが 2 未満 (比較不能) ならそのカテゴリは省略 = 呼び出し側で全ソース等重み (1.0)。
export function computeSourceWeights(stats = computeStats()) {
  const weights = {};
  for (const mk of WEIGHTED_METRICS) {
    const eligible = [];
    for (const [src, byMetric] of Object.entries(stats)) {
      const s = byMetric[mk];
      if (s && s.n >= MIN_SAMPLES && s.mae != null) eligible.push([src, s.mae]);
    }
    if (eligible.length < 2) continue; // 比較対象が 2 未満 → 重み付けの意味がないので等重み
    const inv = eligible.map(([src, mae]) => [src, 1 / (mae + 0.5)]);
    const sum = inv.reduce((a, [, w]) => a + w, 0);
    const n = inv.length;
    weights[mk] = {};
    for (const [src, w] of inv) weights[mk][src] = (w / sum) * n; // 平均 1 に正規化
  }
  return weights;
}

// あるソース ・ 指標カテゴリの重み。学習が無い / カテゴリ外なら 1.0 (等重み)。
export function weightFor(weights, metricKey, src) {
  if (!metricKey) return 1;
  const w = weights && weights[metricKey] && weights[metricKey][src];
  return w == null ? 1 : w;
}
