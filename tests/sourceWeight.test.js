import { describe, it, expect } from 'vitest';
import { computeSourceWeights, weightFor, MIN_SAMPLES } from '../src/score/sourceWeight.js';

// computeStats 形の合成データ : { src: { metric: { mae, rms, bias, n } } }
const mk = (mae, n) => ({ mae, rms: mae, bias: 0, n });

describe('computeSourceWeights (§0.39.5 #23 ソース重み)', () => {
  it('サンプル十分なら誤差の小さいソースを重く (平均 1 に正規化)', () => {
    const stats = {
      jma: { wind: mk(2, MIN_SAMPLES) }, // 誤差小
      'open-meteo': { wind: mk(6, MIN_SAMPLES) }, // 誤差大
    };
    const w = computeSourceWeights(stats);
    expect(w.wind.jma).toBeGreaterThan(w.wind['open-meteo']);
    // 2 ソースの平均は 1.0
    expect((w.wind.jma + w.wind['open-meteo']) / 2).toBeCloseTo(1, 5);
  });

  it('サンプル不足 (n < MIN_SAMPLES) は重み付け対象外 = 等重み', () => {
    const stats = {
      jma: { wind: mk(2, MIN_SAMPLES - 1) },
      'open-meteo': { wind: mk(6, MIN_SAMPLES - 1) },
    };
    const w = computeSourceWeights(stats);
    expect(w.wind).toBeUndefined();
    expect(weightFor(w, 'wind', 'jma')).toBe(1);
  });

  it('比較対象が 1 ソースのみなら等重み (重み付け不能)', () => {
    const stats = { jma: { temp: mk(1, MIN_SAMPLES) } };
    const w = computeSourceWeights(stats);
    expect(w.temp).toBeUndefined();
  });

  it('weightFor : カテゴリ無し ・ 未学習ソースは 1.0', () => {
    expect(weightFor({}, null, 'jma')).toBe(1);
    expect(weightFor({ wind: { jma: 1.5 } }, 'wind', 'open-meteo')).toBe(1);
    expect(weightFor({ wind: { jma: 1.5 } }, 'wind', 'jma')).toBe(1.5);
  });
});
