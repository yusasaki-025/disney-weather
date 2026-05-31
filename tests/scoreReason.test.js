import { describe, it, expect } from 'vitest';
import { getScoreReason } from '../src/score/scoreReason.js';

const badge = (level, text) => ({ level, text });

describe('getScoreReason (§0.37-10)', () => {
  it('全て通常なら 全部OK', () => {
    const r = getScoreReason(
      { gustShowWindow: 3, popShowWindow: 0, wbgtShowWindow: 20 },
      { wind: badge(0, '通常'), rain: badge(0, '通常'), wbgt: badge(0, '通常') },
    );
    expect(r).toBe('風 ・ 雨 ・ 熱 全部OK');
  });

  it('風だけバッジが立つと風のみ表示', () => {
    const r = getScoreReason(
      { gustShowWindow: 9, popShowWindow: 0, wbgtShowWindow: 20 },
      { wind: badge(1, '風バ'), rain: badge(0, '通常'), wbgt: badge(0, '通常') },
    );
    expect(r).toBe('風 9m/s 風バ');
  });

  it('複数立つと ・ で連結 (風 ・ 雨 ・ 熱の順)', () => {
    const r = getScoreReason(
      { gustShowWindow: 12, popShowWindow: 70, wbgtShowWindow: 31 },
      { wind: badge(2, '中止リスク'), rain: badge(2, '雨キャン'), wbgt: badge(2, '熱キャン') },
    );
    expect(r).toBe('風 12m/s 中止リスク ・ 雨 70% 雨キャン ・ 熱 WBGT31 熱キャン');
  });

  it('showWindow が無ければ Max にフォールバック', () => {
    const r = getScoreReason(
      { gustShowWindow: null, gustMax: 10, popMax: 0, wbgtMax: 20 },
      { wind: badge(1, '風バ'), rain: badge(0, '通常'), wbgt: badge(0, '通常') },
    );
    expect(r).toBe('風 10m/s 風バ');
  });

  it('metrics/badges 欠損は空文字', () => {
    expect(getScoreReason(null, null)).toBe('');
  });
});
