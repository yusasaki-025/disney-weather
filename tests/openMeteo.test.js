import { describe, it, expect } from 'vitest';
import { normalize, wmoText } from '../src/data/openMeteo.js';
import fixture from './fixtures/openMeteo.json';

describe('openMeteo.normalize', () => {
  const days = normalize(fixture);
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));

  it('daily を 2 日分返す', () => {
    expect(days.map((d) => d.date)).toEqual(['2026-05-30', '2026-05-31']);
  });

  it('daily 値をそのまま写す', () => {
    const d = byDate['2026-05-31'];
    expect(d.tempMax).toBe(30.2);
    expect(d.gustMax).toBe(18.0);
    expect(d.popMax).toBe(80);
    expect(d.precipSum).toBe(6.5);
    expect(d.uvMax).toBe(9.2);
    expect(d.weatherText).toBe('雨'); // code 63
  });

  it('weather_code 0/1 のマッピング', () => {
    expect(byDate['2026-05-30'].weatherText).toBe('晴れ'); // code 1
    expect(wmoText(0)).toBe('快晴');
    expect(wmoText(999)).toBe('不明');
  });

  it('hourly は 9 - 22 時のみ (08 時 ・ 23 時は除外)', () => {
    expect(byDate['2026-05-30'].hourly.map((p) => p.hour)).toEqual([13, 14]);
    expect(byDate['2026-05-31'].hourly.map((p) => p.hour)).toEqual([13]);
  });

  it('WBGT は派生計算され source は derived', () => {
    const d = byDate['2026-05-30'];
    expect(d.wbgtSource).toBe('derived');
    expect(d.wbgtMax).toBeGreaterThan(20);
    expect(d.hourly[0].wbgt).toBeGreaterThan(0);
  });

  it('daily が無ければ空配列', () => {
    expect(normalize({})).toEqual([]);
  });
});
