import { describe, it, expect } from 'vitest';
import {
  windDeduction,
  rainDeduction,
  heatDeduction,
  coldDeduction,
  uvDeduction,
  scoreToSymbol,
  windBadge,
  rainBadge,
  wbgtBadge,
  windowMax,
  windowMean,
  windowPeak,
  aggregateMetrics,
  scoreFromMetrics,
  bandSubscore,
  weightedBandTotal,
  evaluateDay,
  badgeSeverity,
  applyBadgeGuard,
  BANDS,
} from '../src/score/scoring.js';

describe('windDeduction (§5.2)', () => {
  it('境界値', () => {
    expect(windDeduction(4.9, 'TDL')).toBe(0);
    expect(windDeduction(5, 'TDL')).toBe(10);
    expect(windDeduction(7.9, 'TDL')).toBe(10);
    expect(windDeduction(8, 'TDL')).toBe(30);
    expect(windDeduction(9.9, 'TDL')).toBe(30);
    expect(windDeduction(10, 'TDL')).toBe(60);
    expect(windDeduction(12.9, 'TDL')).toBe(60);
    expect(windDeduction(13, 'TDL')).toBe(90);
    expect(windDeduction(20, 'TDL')).toBe(90);
  });
  it('欠損は 0', () => {
    expect(windDeduction(null, 'TDL')).toBe(0);
  });
  it('TDS は ×1.2', () => {
    expect(windDeduction(10, 'TDS')).toBeCloseTo(72, 5);
    expect(windDeduction(13, 'TDS')).toBeCloseTo(108, 5);
    expect(windDeduction(4.9, 'TDS')).toBe(0);
  });
});

describe('rainDeduction (§5.2)', () => {
  it('境界値', () => {
    expect(rainDeduction(19, 0)).toBe(0);
    expect(rainDeduction(20, 0)).toBe(15);
    expect(rainDeduction(49, 0)).toBe(15);
    expect(rainDeduction(50, 0)).toBe(30);
    expect(rainDeduction(69, 0)).toBe(30);
    expect(rainDeduction(70, 0)).toBe(50);
  });
  it('precip_sum ≧ 5mm で +10', () => {
    expect(rainDeduction(70, 5)).toBe(60);
    expect(rainDeduction(10, 5)).toBe(10);
    expect(rainDeduction(10, 4.9)).toBe(0);
  });
  it('欠損は 0', () => {
    expect(rainDeduction(null, null)).toBe(0);
  });
});

describe('heatDeduction (§5.2)', () => {
  it('§0.37 4階層 : <25 通常(0) / 25-31 熱バ(30) / 31-33 熱キャン(60) / ≥33 中止(90)', () => {
    expect(heatDeduction(24, null, null)).toBe(0);
    expect(heatDeduction(25, null, null)).toBe(30);
    expect(heatDeduction(27, null, null)).toBe(30);
    expect(heatDeduction(30, null, null)).toBe(30);
    expect(heatDeduction(31, null, null)).toBe(60);
    expect(heatDeduction(33, null, null)).toBe(90);
    expect(heatDeduction(35, null, null)).toBe(90);
    expect(heatDeduction(null, null, null)).toBe(0);
  });
  it('体感 35℃ 以上で +10', () => {
    expect(heatDeduction(28, 36, null)).toBe(40); // 30 + 10
    expect(heatDeduction(33, 36, null)).toBe(100); // 90 + 10
  });
  it('風 (show window) 5m/s 以上で緩和 -5', () => {
    expect(heatDeduction(28, null, 5)).toBe(25); // 30 - 5
    expect(heatDeduction(33, null, 8)).toBe(85); // 90 - 5
  });
  it('欠損は 0', () => {
    expect(heatDeduction(null, null, null)).toBe(0);
  });
});

describe('coldDeduction (§5.2)', () => {
  it('境界値 (feels_like_max 優先)', () => {
    expect(coldDeduction(10, null)).toBe(0);
    expect(coldDeduction(9.9, null)).toBe(10);
    expect(coldDeduction(5, null)).toBe(10);
    expect(coldDeduction(4.9, null)).toBe(25);
  });
  it('feels_like 欠損時は temp_max にフォールバック', () => {
    expect(coldDeduction(null, 12)).toBe(0);
    expect(coldDeduction(null, 3)).toBe(25);
    expect(coldDeduction(null, null)).toBe(0);
  });
});

describe('uvDeduction (§5.2)', () => {
  it('境界値', () => {
    expect(uvDeduction(7.9)).toBe(0);
    expect(uvDeduction(8)).toBe(5);
    expect(uvDeduction(10.9)).toBe(5);
    expect(uvDeduction(11)).toBe(10);
    expect(uvDeduction(null)).toBe(0);
  });
});

describe('scoreToSymbol (§5.3)', () => {
  it('境界値', () => {
    expect(scoreToSymbol(100).label).toBe('ベスト');
    expect(scoreToSymbol(85).label).toBe('ベスト');
    expect(scoreToSymbol(84).label).toBe('OK');
    expect(scoreToSymbol(70).label).toBe('OK');
    expect(scoreToSymbol(69).label).toBe('微妙');
    expect(scoreToSymbol(50).label).toBe('微妙');
    expect(scoreToSymbol(49).label).toBe('別日');
    expect(scoreToSymbol(0).label).toBe('別日');
  });
  it('全レベルに label ・ icon ・ color があり undefined が無い (§0.18)', () => {
    for (const s of [100, 80, 60, 0]) {
      const sym = scoreToSymbol(s);
      expect(sym.label).toBeTruthy();
      expect(sym.icon).toBeTruthy();
      expect(sym.color).toMatch(/^#/);
      expect(sym.symbol).toBeUndefined(); // 旧 symbol.symbol 参照は廃止済み
    }
    expect(['star', 'done', 'warning', 'block']).toContain(scoreToSymbol(100).icon);
  });
});

describe('windBadge (§5.5)', () => {
  it('境界値', () => {
    // §0.30 : デフォルト閾値 windBa 8 / windCancel 12。
    expect(windBadge(7.9).text).toBe('通常');
    expect(windBadge(8).text).toBe('風バ');
    expect(windBadge(11.9).text).toBe('風バ');
    expect(windBadge(12).text).toBe('中止リスク');
    expect(windBadge(13.9).text).toBe('中止リスク');
    expect(windBadge(14).text).toBe('中止');
    expect(windBadge(null).text).toBe('—');
  });
  it('ショー別閾値', () => {
    // ハーモニー (windBa 6 / windCancel 12) は 7m で風バ域
    expect(windBadge(7, { windBa: 6, windCancel: 12 }).level).toBe(1);
    // エレクトリカル (windCancel 10) は 11m で中止リスク高
    expect(windBadge(11, { windBa: 8, windCancel: 10 }).level).toBe(2);
  });
});

describe('rainBadge (§5.5)', () => {
  it('境界値', () => {
    expect(rainBadge(0, 0).text).toBe('通常');
    expect(rainBadge(29, 0.9).text).toBe('通常');
    expect(rainBadge(30, 0).text).toBe('雨バ');
    expect(rainBadge(59, 0).text).toBe('雨バ');
    expect(rainBadge(60, 0).text).toBe('雨キャン');
    expect(rainBadge(0, 1).text).toBe('雨キャン');
    expect(rainBadge(0, 2).text).toBe('中止');
    expect(rainBadge(null, null).text).toBe('—');
  });
});

describe('wbgtBadge (§5.6)', () => {
  it('境界値', () => {
    // §0.37 : 4 階層 (< 25 通常 / 25-31 熱バ / 31-33 熱キャン / ≥ 33 中止)
    expect(wbgtBadge(24, null, null).text).toBe('通常');
    expect(wbgtBadge(25, null, null).text).toBe('熱バ');
    expect(wbgtBadge(30, null, null).text).toBe('熱バ');
    expect(wbgtBadge(31, null, null).text).toBe('熱キャン');
    expect(wbgtBadge(33, null, null).text).toBe('中止');
  });
  it('風で 1 段階下げ / 体感 38℃ 以上で 1 段階上げ', () => {
    expect(wbgtBadge(28, 5, null).text).toBe('通常'); // 熱バ(level1) を風で -1 → 通常
    expect(wbgtBadge(28, null, 38).text).toBe('熱キャン'); // 熱バ(level1) を体感で +1 → 熱キャン
    expect(wbgtBadge(24, 5, null).text).toBe('通常'); // 下限クランプ
  });
  it('欠損は —', () => {
    expect(wbgtBadge(null, 0, 0).text).toBe('—');
  });
});

// --- 集計・総合スコア ---

function fakeForecast(source, daily, hourly = []) {
  return {
    source,
    date: '2026-07-15',
    windMax: null,
    gustMax: null,
    popMax: null,
    precipSum: null,
    tempMax: null,
    tempMin: null,
    feelsLikeMax: null,
    feelsLikeMin: null,
    wbgtMax: null,
    uvMax: null,
    hourly,
    ...daily,
  };
}

describe('windowMax', () => {
  const f1 = fakeForecast('open-meteo', {}, [
    { hour: 12, gust: 8, pop: 10, wind: 4, wbgt: 26 },
    { hour: 13, gust: 12, pop: 30, wind: 6, wbgt: 30 },
    { hour: 18, gust: 20, pop: 90, wind: 10, wbgt: 20 },
  ]);
  it('指定時間帯の最大を取り、ソース間平均する', () => {
    expect(windowMax([f1], new Set([12, 13]), 'gust')).toBe(12);
    expect(windowMax([f1], new Set([12, 13]), 'pop')).toBe(30);
  });
  it('hourly が無いソースは寄与しない / 全欠損は null', () => {
    const noHourly = fakeForecast('jma', {});
    expect(windowMax([noHourly], new Set([12]), 'gust')).toBeNull();
    expect(windowMax([f1, noHourly], new Set([12, 13]), 'gust')).toBe(12);
  });
});

describe('windowMean (§0.13.2 平均ベース算定窓)', () => {
  const f = fakeForecast('open-meteo', {}, [
    { hour: 12, gust: 6, wind: 4 },
    { hour: 13, gust: 12, wind: 8 },
    { hour: 18, gust: 20, wind: 10 },
  ]);
  it('窓内の平均を取る (一瞬の突風で評価が落ちない)', () => {
    // 12,13 の gust 平均 = (6+12)/2 = 9 → 風バ域
    expect(windowMean([f], new Set([12, 13]), 'gust')).toBe(9);
    expect(windBadge(windowMean([f], new Set([12, 13]), 'gust')).text).toBe('風バ');
    // max なら 12 で「中止リスク」になるところ、平均で緩和
    expect(windowMax([f], new Set([12, 13]), 'gust')).toBe(12);
  });
  it('全欠損は null', () => {
    const noHourly = fakeForecast('jma', {});
    expect(windowMean([noHourly], new Set([12]), 'gust')).toBeNull();
  });
});

describe('windowPeak (ツールチップ用ピーク)', () => {
  const f = fakeForecast('open-meteo', {}, [
    { hour: 12, gust: 6 },
    { hour: 13, gust: 15 },
    { hour: 14, gust: 9 },
  ]);
  it('窓内最大の値と時刻を返す', () => {
    expect(windowPeak([f], new Set([12, 13, 14]), 'gust')).toEqual({ value: 15, hour: 13 });
  });
  it('全欠損は null', () => {
    expect(windowPeak([fakeForecast('jma', {})], new Set([12]), 'gust')).toBeNull();
  });
});

describe('aggregateMetrics は単純平均 (欠損除外)', () => {
  it('daily 値を平均する', () => {
    const a = fakeForecast('open-meteo', { gustMax: 10, popMax: 40 });
    const b = fakeForecast('jma', { gustMax: null, popMax: 60 });
    const m = aggregateMetrics([a, b], 'TDL');
    expect(m.gustMax).toBe(10); // null は除外
    expect(m.popMax).toBe(50); // (40+60)/2
  });
});

describe('scoreFromMetrics は show-window を優先', () => {
  it('show-window があればそちらで減点', () => {
    const m = {
      gustShowWindow: 12, gustMax: 4,
      popShowWindow: 70, popMax: 10,
      wbgtShowWindow: null, wbgtMax: null,
      precipSum: 0, feelsLikeMax: 20, tempMax: 25, windShowWindow: 2, uvMax: 0,
    };
    const r = scoreFromMetrics(m, 'TDL');
    // wind 60 + rain 50 = 110 → score 0
    expect(r.deductions.wind).toBe(60);
    expect(r.deductions.rain).toBe(50);
    expect(r.score).toBe(0);
    expect(r.symbol.label).toBe('別日');
  });
  it('show-window が無ければ daily 最大にフォールバック', () => {
    const m = {
      gustShowWindow: null, gustMax: 6,
      popShowWindow: null, popMax: 25,
      wbgtShowWindow: null, wbgtMax: null,
      precipSum: 0, feelsLikeMax: 22, tempMax: 25, windShowWindow: null, uvMax: 0,
    };
    const r = scoreFromMetrics(m, 'TDL');
    // wind 10 + rain 15 = 25 → score 75 → OK
    expect(r.score).toBe(75);
    expect(r.symbol.label).toBe('OK');
  });
});

describe('bandSubscore / weightedBandTotal', () => {
  const noon = BANDS.find((b) => b.key === 'noon');
  it('時間帯のミニスコアを返す', () => {
    const f = fakeForecast('open-meteo', { feelsLikeMax: 20 }, [
      { hour: 13, gust: 4, pop: 0, wind: 3, wbgt: 20 },
    ]);
    const s = bandSubscore([f], noon, 'TDL');
    expect(s.score).toBe(100);
    expect(s.symbol.label).toBe('ベスト');
    expect(s.hasData).toBe(true);
  });
  it('重み付き平均 (昼が最重要)', () => {
    const sub = {
      morning: { score: 100, hasData: true },
      noon: { score: 50, hasData: true },
      night: { score: 0, hasData: true },
    };
    // (100*0.5 + 50*2.0 + 0*0.3) / (0.5+2.0+0.3) = 150/2.8 ≈ 54
    expect(weightedBandTotal(sub)).toBe(54);
  });
  it('データ無しは null', () => {
    expect(
      weightedBandTotal({
        morning: { score: 0, hasData: false },
        noon: { score: 0, hasData: false },
        night: { score: 0, hasData: false },
      }),
    ).toBeNull();
  });
});

describe('badgeSeverity / applyBadgeGuard (§0.16)', () => {
  it('text から severity を判定', () => {
    expect(badgeSeverity('中止')).toBe('critical');
    expect(badgeSeverity('中止リスク')).toBe('danger');
    expect(badgeSeverity('雨キャン')).toBe('danger');
    expect(badgeSeverity('熱キャン')).toBe('danger');
    expect(badgeSeverity('風バ')).toBe('warn');
    expect(badgeSeverity('熱バ')).toBe('warn');
    expect(badgeSeverity('通常')).toBe('normal');
    expect(badgeSeverity('—')).toBe('normal');
  });
  it('最悪 severity に応じて上限キャップ (上限のみ・引き上げない)', () => {
    const g = (raw, text) =>
      applyBadgeGuard(raw, { wind: { text: '通常' }, rain: { text }, wbgt: { text: '通常' } }).score;
    expect(g(80, '中止')).toBe(25); // critical
    expect(g(80, '雨キャン')).toBe(45); // danger
    expect(g(80, '雨バ')).toBe(65); // warn
    expect(g(80, '通常')).toBe(80); // normal はキャップなし
    expect(g(20, '中止')).toBe(20); // キャップは上限のみ (引き下げ済みは保持)
  });
  it('最も厳しいバッジが効く', () => {
    const r = applyBadgeGuard(80, {
      wind: { text: '風バ' }, // warn
      rain: { text: '中止' }, // critical
      wbgt: { text: '通常' },
    });
    expect(r.worstSeverity).toBe('critical');
    expect(r.score).toBe(25);
    expect(r.capped).toBe(true);
  });
});

describe('evaluateDay (統合)', () => {
  it('スコア ・ 記号 ・ 3 バッジ ・ サブスコアを返す', () => {
    const om = fakeForecast(
      'open-meteo',
      { gustMax: 12, popMax: 70, precipSum: 0, feelsLikeMax: 22, tempMax: 25, uvMax: 6 },
      [
        { hour: 12, gust: 11, pop: 50, wind: 5, wbgt: 24 },
        { hour: 13, gust: 12, pop: 70, wind: 6, wbgt: 26 },
        { hour: 14, gust: 10, pop: 60, wind: 5, wbgt: 25 },
      ],
    );
    const r = evaluateDay([om], 'TDL');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.symbol).toBeTruthy();
    // §0.30 : date 無し → DEFAULT 閾値 (windBa8/windCancel12)。gust window 平均 11 → 風バ域。
    expect(r.badges.wind.text).toBe('風バ');
    expect(r.badges.rain.text).toBe('雨キャン'); // pop window 70
    expect(r.subscores.noon).toBeTruthy();
    expect(['ベスト', 'OK', '微妙', '別日']).toContain(r.subscores.noon.symbol.label);
  });
});
