import { describe, it, expect } from 'vitest';
import { mergeSharedShows, FALLBACK_SCHEDULE, inPeriod } from '../src/data/showSchedule.js';

describe('inPeriod (§0.68.H.a 季節限定ショーの期間フィルタ)', () => {
  it('period 無し (undefined / 不正) は常時表示', () => {
    expect(inPeriod('2026-12-31', undefined)).toBe(true);
    expect(inPeriod('2026-12-31', ['2026-04-01'])).toBe(true); // 要素数不正
  });
  it('期間内は true ・ 期間外は false', () => {
    const p = ['2026-04-15', '2026-06-30'];
    expect(inPeriod('2026-04-15', p)).toBe(true); // 開始日含む
    expect(inPeriod('2026-06-30', p)).toBe(true); // 終了日含む
    expect(inPeriod('2026-05-20', p)).toBe(true);
    expect(inPeriod('2026-04-14', p)).toBe(false); // 開始前
    expect(inPeriod('2026-07-01', p)).toBe(false); // 終了後
  });
  it('片側 null は無制限', () => {
    expect(inPeriod('2026-01-01', [null, '2026-06-30'])).toBe(true);
    expect(inPeriod('2026-12-31', ['2026-04-01', null])).toBe(true);
  });
});

// §0.64.2 : 両パーク共通ショー (スカイ ・ フル ・ オブ ・ カラーズ) が両パークに必ず出ることを保証。
const sky = { name: 'スカイ･フル･オブ･カラーズ', times: ['20:30'], priority: 'low', kind: 'fireworks', tags: [] };
const harmony = { name: 'ディズニー･ハーモニー･イン･カラー', time: '13:00', priority: 'high', type: 'parade' };

describe('mergeSharedShows (§0.64.2 両パーク共通ショー補完)', () => {
  it('当パークにスカイが無く他パークにある → 補完される', () => {
    const tdl = [harmony]; // TDL にスカイ無し
    const merged = mergeSharedShows(tdl, [sky]); // TDS の生データにスカイ
    expect(merged.some((s) => s.name.includes('スカイ'))).toBe(true);
  });

  it('当パークに既にスカイがある → 重複追加しない', () => {
    const tdl = [harmony, { name: 'スカイ･フル･オブ･カラーズ', time: '20:30', priority: 'low' }];
    const merged = mergeSharedShows(tdl, [sky]);
    const skyCount = merged.filter((s) => s.name.includes('スカイ')).length;
    expect(skyCount).toBe(1);
  });

  it('他パークにもスカイが無い → 何も足さない', () => {
    const tdl = [harmony];
    const merged = mergeSharedShows(tdl, [{ name: 'ビリーヴ', times: ['19:30'], priority: 'low' }]);
    expect(merged.some((s) => s.name.includes('スカイ'))).toBe(false);
  });

  it('全角 ・ 半角どちらの中黒でも共通ショーとして判定', () => {
    const full = { name: 'スカイ・フル・オブ・カラーズ', times: ['20:30'], priority: 'low' };
    expect(mergeSharedShows([], [full]).some((s) => s.name.includes('スカイ'))).toBe(true);
  });
});

describe('FALLBACK_SCHEDULE (§0.64.2 official 未取得日もスカイを表示)', () => {
  it('TDL の fallback にスカイ・フル・オブ・カラーズが含まれる', () => {
    expect(FALLBACK_SCHEDULE.TDL.some((s) => s.name.includes('スカイ'))).toBe(true);
  });
  it('TDS の fallback にもスカイ・フル・オブ・カラーズが含まれる', () => {
    expect(FALLBACK_SCHEDULE.TDS.some((s) => s.name.includes('スカイ'))).toBe(true);
  });
});
