import { describe, it, expect } from 'vitest';
import { selectTop3 } from '../src/ui/top3.js';

// §0.68.B (監査 S-1) : TOP3 は NG 日を除外し、スコア降順で上位 3 件。
const row = (date, score, key) => ({ date, eval: { score, symbol: { key } } });

describe('selectTop3 (§0.68.B NG 除外)', () => {
  it('NG 日は候補から除外される', () => {
    const rows = [
      row('d1', 90, 'best'),
      row('d2', 30, 'ng'),
      row('d3', 70, 'ok'),
      row('d4', 20, 'ng'),
    ];
    const r = selectTop3(rows);
    expect(r.map((x) => x.date)).toEqual(['d1', 'd3']);
    expect(r.some((x) => x.eval.symbol.key === 'ng')).toBe(false);
  });

  it('全日 NG なら空 (NG を第1位に出さない)', () => {
    const rows = [row('d1', 35, 'ng'), row('d2', 10, 'ng')];
    expect(selectTop3(rows)).toEqual([]);
  });

  it('スコア降順で上位 3 件 ・ 4 件目以降は切り捨て', () => {
    const rows = [
      row('a', 60, 'ok'),
      row('b', 95, 'best'),
      row('c', 80, 'good'),
      row('d', 70, 'ok'),
    ];
    expect(selectTop3(rows).map((x) => x.date)).toEqual(['b', 'c', 'd']);
  });

  it('eval が無い行はスキップ', () => {
    const rows = [{ date: 'x' }, row('y', 50, 'fair')];
    expect(selectTop3(rows).map((x) => x.date)).toEqual(['y']);
  });
});
