import { describe, it, expect } from 'vitest';
import { scoreDiff, scoreHistory } from '../src/score/scoreDiff.js';

const SNAPS = [
  { snapDate: '2026-05-29', scores: [{ date: '2026-06-01', park: 'TDL', score: 50 }] },
  { snapDate: '2026-05-30', scores: [{ date: '2026-06-01', park: 'TDL', score: 60 }, { date: '2026-06-01', park: 'TDS', score: 40 }] },
];

describe('scoreDiff (§0.39.1)', () => {
  it('当日より前の最新スナップショットと差分を取る', () => {
    const d = scoreDiff(SNAPS, '2026-06-01', 'TDL', 70, '2026-05-31');
    expect(d).toEqual({ delta: 10, prev: 60, snapDate: '2026-05-30' });
  });

  it('悪化は負の delta', () => {
    const d = scoreDiff(SNAPS, '2026-06-01', 'TDL', 45, '2026-05-31');
    expect(d.delta).toBe(-15);
  });

  it('同値なら null (ガード)', () => {
    expect(scoreDiff(SNAPS, '2026-06-01', 'TDL', 60, '2026-05-31')).toBeNull();
  });

  it('比較対象が無ければ null', () => {
    expect(scoreDiff(SNAPS, '2026-12-25', 'TDL', 80, '2026-05-31')).toBeNull();
    expect(scoreDiff([], '2026-06-01', 'TDL', 80, '2026-05-31')).toBeNull();
  });

  it('park 違いは混ざらない', () => {
    const d = scoreDiff(SNAPS, '2026-06-01', 'TDS', 50, '2026-05-31');
    expect(d).toEqual({ delta: 10, prev: 40, snapDate: '2026-05-30' });
  });

  it('today 以降のスナップショットは比較に使わない', () => {
    const future = [{ snapDate: '2026-06-02', scores: [{ date: '2026-06-05', park: 'TDL', score: 10 }] }];
    expect(scoreDiff(future, '2026-06-05', 'TDL', 90, '2026-05-31')).toBeNull();
  });

  it('currentScore 欠損は null', () => {
    expect(scoreDiff(SNAPS, '2026-06-01', 'TDL', null, '2026-05-31')).toBeNull();
  });
});

describe('scoreHistory (§0.39.1)', () => {
  it('過去スナップショット + 今日の現在値を時系列で返す', () => {
    const h = scoreHistory(SNAPS, '2026-06-01', 'TDL', 70, '2026-05-31');
    expect(h).toEqual([
      { date: '2026-05-29', score: 50 },
      { date: '2026-05-30', score: 60 },
      { date: '2026-05-31', score: 70, current: true },
    ]);
  });

  it('n で末尾を切る', () => {
    const h = scoreHistory(SNAPS, '2026-06-01', 'TDL', 70, '2026-05-31', 2);
    expect(h).toHaveLength(2);
    expect(h[1].current).toBe(true);
  });
});
