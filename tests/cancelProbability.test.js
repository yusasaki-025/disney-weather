import { describe, it, expect, vi, beforeEach } from 'vitest';

// cancelHistoryLoader は import.meta.glob で実 JSON を読むため、テストではモックして
// getCancelProbability の純粋ロジック (±2m/s フィルタ ・ サンプル下限 ・ 中止率) を検証する。
vi.mock('../src/data/cancelHistoryLoader.js', () => ({
  getAllRecordsForShow: vi.fn(),
}));

import { getAllRecordsForShow } from '../src/data/cancelHistoryLoader.js';
import { getCancelProbability } from '../src/score/cancelProbability.js';

// maxWind の records を量産するヘルパ
const recs = (...pairs) => pairs.map(([maxWind, status]) => ({ maxWind, status }));

describe('getCancelProbability (§0.31)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('予報 max 風速が null なら null', () => {
    expect(getCancelProbability('X', 'TDL', null)).toBeNull();
  });

  it('全体サンプルが 20 未満なら null', () => {
    getAllRecordsForShow.mockReturnValue(recs([10, 'ok'], [10, 'cancel']));
    expect(getCancelProbability('X', 'TDL', 10)).toBeNull();
  });

  it('同風速帯 (±2) が 5 未満なら null', () => {
    // 全体 25 件だが、12m/s 付近は 3 件しかない
    const r = [...Array(22)].map(() => ({ maxWind: 3, status: 'ok' })).concat(recs([12, 'cancel'], [13, 'cancel'], [11, 'ok']));
    getAllRecordsForShow.mockReturnValue(r);
    expect(getCancelProbability('X', 'TDL', 12)).toBeNull();
  });

  it('同条件で中止率を算出 (cancel + partial-cancel を中止扱い)', () => {
    // 12m/s±2 に 10 件: cancel3 + partial-cancel1 + ok6 = 40%
    const near = recs(
      [11, 'cancel'], [12, 'cancel'], [13, 'cancel'], [12, 'partial-cancel'],
      [10, 'ok'], [11, 'ok'], [12, 'ok'], [13, 'ok'], [14, 'ok'], [10.5, 'partial'],
    );
    const far = [...Array(15)].map(() => ({ maxWind: 3, status: 'ok' })); // 全体 25 件に到達させる
    getAllRecordsForShow.mockReturnValue([...near, ...far]);
    const r = getCancelProbability('X', 'TDL', 12);
    expect(r.sampleSize).toBe(10);
    expect(r.cancelCount).toBe(4); // cancel3 + partial-cancel1。partial は実施扱い
    expect(r.probability).toBe(40);
  });

  it('maxWind が null の record は除外', () => {
    const r = [...Array(25)].map(() => ({ maxWind: 5, status: 'ok' })).concat([{ maxWind: null, status: 'cancel' }]);
    getAllRecordsForShow.mockReturnValue(r);
    const res = getCancelProbability('X', 'TDL', 5);
    expect(res.probability).toBe(0); // null は数えない
  });
});
