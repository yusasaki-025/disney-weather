import { describe, it, expect } from 'vitest';
import { showRiskInfo } from '../src/score/showRisk.js';

const mk = (hourly) => ({ hourly });

describe('showRiskInfo (§0.38.21+ per-show 時刻別リスク)', () => {
  it('開催時刻の hour を含む値を全ソース平均する', () => {
    const forecasts = [
      mk([{ hour: 11, gust: 8, wbgt: 26 }, { hour: 14, gust: 10, wbgt: 28 }]),
      mk([{ hour: 11, gust: 6, wbgt: 24 }, { hour: 14, gust: 12, wbgt: 30 }]),
    ];
    // 11:00 と 14:00 → gust [8,10,6,12]平均=9、wbgt [26,28,24,30]平均=27
    expect(showRiskInfo(forecasts, ['11:00', '14:00'])).toEqual({ wind: 9, wbgt: 27 });
  });

  it('該当 hour のみ抽出する', () => {
    const forecasts = [mk([{ hour: 11, gust: 8, wbgt: 26 }, { hour: 18, gust: 20, wbgt: 31 }])];
    expect(showRiskInfo(forecasts, ['11:30'])).toEqual({ wind: 8, wbgt: 26 });
  });

  it('times が空なら null', () => {
    expect(showRiskInfo([mk([{ hour: 11, gust: 8, wbgt: 26 }])], [])).toBeNull();
  });

  it('該当データが無ければ null', () => {
    expect(showRiskInfo([mk([{ hour: 9, gust: 8, wbgt: 26 }])], ['15:00'])).toBeNull();
  });

  it('片方の指標のみでも返す (欠損は null)', () => {
    const forecasts = [mk([{ hour: 11, gust: 8, wbgt: null }])];
    expect(showRiskInfo(forecasts, ['11:00'])).toEqual({ wind: 8, wbgt: null });
  });

  it('不正入力は null', () => {
    expect(showRiskInfo(null, ['11:00'])).toBeNull();
    expect(showRiskInfo([], ['11:00'])).toBeNull();
  });
});
