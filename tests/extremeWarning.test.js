import { describe, it, expect } from 'vitest';
import { extremeWarning } from '../src/score/extremeWarning.js';

// §0.68.G : extremeWarning (単独ソース極端値の「(要確認)」ヒント) の分岐網羅。
describe('extremeWarning (§0.36-7 / §0.68.G)', () => {
  it('閾値未満 ・ 欠損は null', () => {
    expect(extremeWarning({ gustMax: 19, precipMaxHourly: 29 })).toBeNull();
    expect(extremeWarning({})).toBeNull();
    expect(extremeWarning()).toBeNull();
  });

  it('gustMax ≧ 20 で要確認 (丸めて表示)', () => {
    const r = extremeWarning({ gustMax: 22.6 });
    expect(r.text).toBe('(要確認)');
    expect(r.title).toContain('最大瞬間風速 23m/s');
  });

  it('precipMaxHourly ≧ 30 で要確認', () => {
    const r = extremeWarning({ precipMaxHourly: 35.2 });
    expect(r.title).toContain('時間雨量 35mm/h');
  });

  it('両方超過なら ・ で連結', () => {
    const r = extremeWarning({ gustMax: 25, precipMaxHourly: 40 });
    expect(r.title).toContain('最大瞬間風速 25m/s');
    expect(r.title).toContain('時間雨量 40mm/h');
    expect(r.title).toContain('・');
    expect(r.title).toContain('他ソースの確認を推奨');
  });
});
