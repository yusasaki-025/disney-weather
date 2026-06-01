import { describe, it, expect } from 'vitest';
import { getAttractionClosures } from '../src/score/attractionForecast.js';

describe('getAttractionClosures (§0.39.4 アトラクション運休予測)', () => {
  it('gust >= cutoff のアトラクションを返す', () => {
    const r = getAttractionClosures('TDS', 14);
    // レイジングスピリッツ (cutoff 13) は 14 で運休予測
    expect(r.map((a) => a.name)).toContain('レイジングスピリッツ');
  });

  it('park フィルタが効く (TDL 指定で TDS は出ない)', () => {
    const r = getAttractionClosures('TDL', 20);
    expect(r.every((a) => a.name !== 'レイジングスピリッツ')).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  it('穏やかな風では空配列', () => {
    expect(getAttractionClosures('TDL', 5)).toEqual([]);
    expect(getAttractionClosures('TDS', 10)).toEqual([]);
  });

  it('gust が null / NaN なら空配列', () => {
    expect(getAttractionClosures('TDL', null)).toEqual([]);
    expect(getAttractionClosures('TDL', NaN)).toEqual([]);
  });

  it('windCutoff 昇順でソートされる', () => {
    const r = getAttractionClosures('TDS', 20);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].windCutoff).toBeGreaterThanOrEqual(r[i - 1].windCutoff);
    }
  });
});
