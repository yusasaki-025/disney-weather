import { describe, it, expect } from 'vitest';
import { parseWarning } from '../src/data/jmaWarning.js';

const mk = (warnings) => ({
  reportDatetime: '2026-06-01T05:00:00+09:00',
  areaTypes: [{ areas: [{ code: '120010', warnings }] }],
});

describe('parseWarning (§0.39.3 気象庁警報 ・ 注意報)', () => {
  it('発表中の警報 ・ 注意報を label/level 付きで返す', () => {
    const r = parseWarning(mk([{ code: '15', status: '発表' }, { code: '03', status: '発表' }]));
    expect(r.warnings.map((w) => w.label)).toContain('強風注意報');
    expect(r.warnings.map((w) => w.label)).toContain('大雨警報');
    expect(r.reportDatetime).toBe('2026-06-01T05:00:00+09:00');
  });

  it('重大度順 (警報 → 注意報) にソート', () => {
    const r = parseWarning(mk([{ code: '15', status: '発表' }, { code: '05', status: '発表' }]));
    expect(r.warnings[0].level).toBe('warning'); // 暴風警報
    expect(r.warnings[1].level).toBe('advisory'); // 強風注意報
  });

  it('解除は除外', () => {
    const r = parseWarning(mk([{ code: '15', status: '解除' }, { code: '14', status: '発表' }]));
    expect(r.warnings.map((w) => w.label)).toEqual(['雷注意報']);
  });

  it('未知コード (00 等) は無視', () => {
    const r = parseWarning(mk([{ code: '00', status: '発表' }]));
    expect(r.warnings).toEqual([]);
  });

  it('特別警報は emergency', () => {
    const r = parseWarning(mk([{ code: '33', status: '発表' }]));
    expect(r.warnings[0]).toMatchObject({ label: '大雨特別警報', level: 'emergency' });
  });

  it('不正入力は null', () => {
    expect(parseWarning(null)).toBeNull();
    expect(parseWarning({})).toBeNull();
  });

  it('該当エリアなし時は空配列', () => {
    const r = parseWarning({ reportDatetime: 'x', areaTypes: [{ areas: [{ code: '999999', warnings: [] }] }] });
    expect(r.warnings).toEqual([]);
  });
});
