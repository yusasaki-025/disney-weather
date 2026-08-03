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

// §0.83 : スカイ ･ フル ･ オブ ･ カラーズは 2026-06-15 〜 2026-09-14 が夏季休止。
//   period 未設定だと休止中の日にも fallback で表示されてしまっていた回帰ガード。
//   判定は FALLBACK_SCHEDULE + inPeriod に対して直接行う。getDaySchedule を日付で叩くと、
//     その月の official 月別 JSON が入った瞬間に fallback 経路を通らなくなり前提が崩れるため。
describe('§0.83 スカイの夏季休止 (fallback の period)', () => {
  const skyOf = (park) => FALLBACK_SCHEDULE[park].find((s) => s.name.includes('スカイ'));
  const activeFallback = (park, date) => FALLBACK_SCHEDULE[park].filter((s) => inPeriod(date, s.period));

  it('両パークのスカイに夏季休止を除外する period が入っている', () => {
    for (const park of ['TDL', 'TDS']) {
      const sky = skyOf(park);
      expect(sky).toBeTruthy();
      expect(inPeriod('2026-08-10', sky.period)).toBe(false); // 休止中
      expect(inPeriod('2026-09-14', sky.period)).toBe(false); // 休止最終日
      expect(inPeriod('2026-09-15', sky.period)).toBe(true); // 再開日
    }
  });
  it('休止中の fallback 日は両パークともスカイが除外される', () => {
    for (const park of ['TDL', 'TDS']) {
      expect(activeFallback(park, '2026-08-10').some((s) => s.name.includes('スカイ'))).toBe(false);
      expect(activeFallback(park, '2026-09-15').some((s) => s.name.includes('スカイ'))).toBe(true);
    }
  });
  it('休止中は TDL の fallback から high が消える (TDS はスパークリング 17:00 が残る)', () => {
    const highs = (park, date) => activeFallback(park, date).filter((s) => s.priority === 'high').map((s) => s.time);
    expect(highs('TDL', '2026-08-10')).toEqual([]);
    expect(highs('TDS', '2026-08-10')).toEqual(['17:00']);
    expect(highs('TDL', '2026-09-15')).toEqual(['20:30']);
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
