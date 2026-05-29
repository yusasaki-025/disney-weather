import { describe, it, expect } from 'vitest';
import { deriveWbgt, parseEnvWbgtCsv } from '../src/data/wbgt.js';

describe('deriveWbgt (§3.11 簡易式)', () => {
  it('欠損は null', () => {
    expect(deriveWbgt(null, 70)).toBeNull();
    expect(deriveWbgt(30, null)).toBeNull();
  });
  it('既知の入力で妥当な推定値', () => {
    // Ta=30, RH=70 → 約 32.6
    expect(deriveWbgt(30, 70)).toBeCloseTo(32.58, 1);
    // 気温・湿度が高いほど大きい
    expect(deriveWbgt(35, 80)).toBeGreaterThan(deriveWbgt(30, 70));
    expect(deriveWbgt(20, 50)).toBeLessThan(deriveWbgt(30, 70));
  });
});

describe('parseEnvWbgtCsv', () => {
  const csv = [
    ',,2026053009,2026053012,2026053015,2026053109',
    '44132,2026/05/30 01:25, 250, 280, 310, 200',
  ].join('\n');
  const parsed = parseEnvWbgtCsv(csv);

  it('日付別に集計し値は ÷10', () => {
    expect(parsed['2026-05-30'].wbgtMax).toBe(31.0); // max(25,28,31)
    expect(parsed['2026-05-30'].hourly).toHaveLength(3);
    expect(parsed['2026-05-31'].wbgtMax).toBe(20.0);
  });

  it('hourly に hour と wbgt が入る', () => {
    const h = parsed['2026-05-30'].hourly.find((x) => x.hour === 12);
    expect(h.wbgt).toBe(28.0);
  });

  it('空 ・ 不正は空オブジェクト', () => {
    expect(parseEnvWbgtCsv('')).toEqual({});
    expect(parseEnvWbgtCsv('only one line')).toEqual({});
  });
});
