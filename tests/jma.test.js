import { describe, it, expect } from 'vitest';
import { normalize, jmaWeatherText } from '../src/data/jma.js';
import fixture from './fixtures/jma.json';

describe('jma.normalize', () => {
  const days = normalize(fixture);
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));

  it('日付順に並ぶ', () => {
    expect(days.map((d) => d.date)).toEqual([
      '2026-05-30',
      '2026-05-31',
      '2026-06-01',
      '2026-06-02',
    ]);
  });

  it('短期の 3 時間降水確率は日別最大になる', () => {
    expect(byDate['2026-05-30'].popMax).toBe(30); // max(10,20,30)
    expect(byDate['2026-05-31'].popMax).toBe(0);
  });

  it('天気概況は全角スペースを詰める', () => {
    expect(byDate['2026-05-30'].weatherText).toBe('晴れ 時々 くもり');
    expect(byDate['2026-05-31'].weatherText).toBe('くもり');
  });

  it('短期気温は 00 時=最低 / 09 時=最高', () => {
    expect(byDate['2026-05-30'].tempMax).toBe(28);
    expect(byDate['2026-05-31'].tempMin).toBe(18);
    expect(byDate['2026-05-31'].tempMax).toBe(27);
  });

  it('週間は短期で埋まらない日を補完する', () => {
    expect(byDate['2026-06-01'].popMax).toBe(40);
    expect(byDate['2026-06-01'].weatherText).toBe('曇り'); // code 200
    expect(byDate['2026-06-01'].tempMax).toBe(26);
    expect(byDate['2026-06-01'].tempMin).toBe(19);
    expect(byDate['2026-06-02'].weatherText).toBe('雨'); // code 300
    expect(byDate['2026-06-02'].popMax).toBe(60);
  });

  it('風 ・ 突風 ・ UV ・ hourly は構造化されないので欠損', () => {
    const d = byDate['2026-05-30'];
    expect(d.windMax).toBeNull();
    expect(d.gustMax).toBeNull();
    expect(d.uvMax).toBeNull();
    expect(d.wbgtMax).toBeNull();
    expect(d.hourly).toEqual([]);
    expect(d.source).toBe('jma');
  });

  it('空入力は空配列', () => {
    expect(normalize([])).toEqual([]);
    expect(normalize(null)).toEqual([]);
  });
});

describe('jmaWeatherText', () => {
  it('既知コード / 先頭桁フォールバック', () => {
    expect(jmaWeatherText('100')).toBe('晴れ');
    expect(jmaWeatherText('300')).toBe('雨');
    expect(jmaWeatherText('250')).toBe('曇り'); // 未収録 → 先頭桁 2
    expect(jmaWeatherText('')).toBeNull();
    expect(jmaWeatherText(null)).toBeNull();
  });
});
