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
  hourlyRange,
  aggregateMetrics,
  scoreFromMetrics,
  bandSubscore,
  weightedBandTotal,
  evaluateDay,
  badgeSeverity,
  applyBadgeGuard,
  popScoreCap,
  warnCountCap,
  BANDS,
} from '../src/score/scoring.js';

describe('windDeduction (§5.2 / §0.47.2 緩和)', () => {
  it('境界値', () => {
    expect(windDeduction(5.9, 'TDL')).toBe(0);
    expect(windDeduction(6, 'TDL')).toBe(5);
    expect(windDeduction(7.9, 'TDL')).toBe(5);
    expect(windDeduction(8, 'TDL')).toBe(15);
    expect(windDeduction(9.9, 'TDL')).toBe(15);
    expect(windDeduction(10, 'TDL')).toBe(30);
    expect(windDeduction(11.9, 'TDL')).toBe(30);
    expect(windDeduction(12, 'TDL')).toBe(50);
    expect(windDeduction(20, 'TDL')).toBe(50);
  });
  it('欠損は 0', () => {
    expect(windDeduction(null, 'TDL')).toBe(0);
  });
  it('TDS は ×1.2', () => {
    expect(windDeduction(10, 'TDS')).toBeCloseTo(36, 5);
    expect(windDeduction(12, 'TDS')).toBeCloseTo(60, 5);
    expect(windDeduction(5.9, 'TDS')).toBe(0);
  });
});

describe('rainDeduction (§0.55.2 確率 + 雨量 合算強化)', () => {
  it('確率の境界値 (雨量 0)', () => {
    expect(rainDeduction(19, 0)).toBe(0);
    expect(rainDeduction(20, 0)).toBe(5);
    expect(rainDeduction(29, 0)).toBe(5);
    expect(rainDeduction(30, 0)).toBe(10);
    expect(rainDeduction(49, 0)).toBe(10);
    expect(rainDeduction(50, 0)).toBe(20);
    expect(rainDeduction(69, 0)).toBe(20);
    expect(rainDeduction(70, 0)).toBe(35);
    expect(rainDeduction(89, 0)).toBe(35);
    expect(rainDeduction(90, 0)).toBe(55);
  });
  it('雨量 (mm/h) を合算 (<1 -5 / 1-3 -15 / 3-5 -30 / ≥5 -55)', () => {
    expect(rainDeduction(0, 0.5)).toBe(5); // 霧雨相当
    expect(rainDeduction(10, 2.9)).toBe(15); // 確率小 + 1-3mm/h
    expect(rainDeduction(70, 3)).toBe(65); // 35 + 30
    expect(rainDeduction(90, 5)).toBe(80); // 55 + 55 = 110 → 80 でキャップ
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

describe('scoreToSymbol (§5.3 / §0.52 5 段階)', () => {
  it('境界値 (BEST 90+ / GOOD 75-89 / OK 60-74 / FAIR 40-59 / NG 0-39)', () => {
    expect(scoreToSymbol(100).label).toBe('BEST');
    expect(scoreToSymbol(90).label).toBe('BEST');
    expect(scoreToSymbol(89).label).toBe('GOOD');
    expect(scoreToSymbol(75).label).toBe('GOOD');
    expect(scoreToSymbol(74).label).toBe('OK');
    expect(scoreToSymbol(60).label).toBe('OK');
    expect(scoreToSymbol(59).label).toBe('FAIR');
    expect(scoreToSymbol(40).label).toBe('FAIR');
    expect(scoreToSymbol(39).label).toBe('NG');
    expect(scoreToSymbol(0).label).toBe('NG');
  });
  it('全レベルに label ・ icon ・ color があり undefined が無い (§0.18)', () => {
    for (const s of [100, 80, 65, 50, 0]) {
      const sym = scoreToSymbol(s);
      expect(sym.label).toBeTruthy();
      expect(sym.icon).toBeTruthy();
      expect(sym.color).toMatch(/^#/);
      expect(sym.symbol).toBeUndefined(); // 旧 symbol.symbol 参照は廃止済み
    }
    expect(['star', 'check_circle', 'check', 'warning', 'block']).toContain(scoreToSymbol(100).icon);
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

describe('rainBadge (§5.5 / §0.48.2 時間最大降水量ベース)', () => {
  it('境界値 (mm/h)', () => {
    expect(rainBadge(0, 0).text).toBe('通常');
    expect(rainBadge(40, 0.9).text).toBe('通常'); // 低確率 ・ 弱雨
    expect(rainBadge(50, 0).text).toBe('雨バ'); // 高確率だが降水量弱
    expect(rainBadge(0, 1).text).toBe('雨バ'); // 1mm/h (霧雨相当)
    expect(rainBadge(0, 2.9).text).toBe('雨バ');
    expect(rainBadge(0, 3).text).toBe('雨キャン'); // 3mm/h
    expect(rainBadge(0, 4.9).text).toBe('雨キャン');
    expect(rainBadge(0, 5).text).toBe('中止'); // 5mm/h 強雨
    expect(rainBadge(0, 6).text).toBe('中止');
    expect(rainBadge(null, null).text).toBe('—');
  });
  it('§0.48.3 : 霧雨 (drizzle) は雨バ可能性で上限固定', () => {
    expect(rainBadge(80, 10, true).text).toBe('雨バ'); // 本来は中止級でも drizzle なら雨バ
    expect(rainBadge(80, 10, false).text).toBe('中止');
    expect(rainBadge(0, 0.5, true).text).toBe('通常'); // 元が通常なら通常のまま
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

describe('hourlyRange (§0.57.1c 「この日の概要」レンジ)', () => {
  const f1 = fakeForecast('open-meteo', {}, [
    { hour: 9, gust: 6, pop: 10, wind: 3, precip: 0, wbgt: 18 },
    { hour: 13, gust: 18, pop: 70, wind: 12, precip: 19.8, wbgt: 26 },
    { hour: 18, gust: 9, pop: 40, wind: 5, precip: 1.2, wbgt: 22 },
  ]);
  it('全 hourly の最低 〜 最高を返す', () => {
    expect(hourlyRange([f1], 'wind')).toEqual({ min: 3, max: 12 });
    expect(hourlyRange([f1], 'gust')).toEqual({ min: 6, max: 18 });
    expect(hourlyRange([f1], 'pop')).toEqual({ min: 10, max: 70 });
    expect(hourlyRange([f1], 'precip')).toEqual({ min: 0, max: 19.8 });
    expect(hourlyRange([f1], 'wbgt')).toEqual({ min: 18, max: 26 });
  });
  it('複数ソースを横断して min/max を取る', () => {
    const f2 = fakeForecast('open-weather', {}, [
      { hour: 13, wind: 2, wbgt: 30 },
    ]);
    expect(hourlyRange([f1, f2], 'wind')).toEqual({ min: 2, max: 12 });
    expect(hourlyRange([f1, f2], 'wbgt')).toEqual({ min: 18, max: 30 });
  });
  it('hourly が無い / 全欠損は null', () => {
    expect(hourlyRange([fakeForecast('jma', {})], 'wind')).toBeNull();
    const sparse = fakeForecast('open-meteo', {}, [{ hour: 12, pop: 50 }]);
    expect(hourlyRange([sparse], 'wbgt')).toBeNull(); // wbgt 欠損
    expect(hourlyRange([sparse], 'pop')).toEqual({ min: 50, max: 50 });
  });
  it('aggregateMetrics が *Range フィールドを公開する', () => {
    const m = aggregateMetrics([f1], 'TDL');
    expect(m.windRange).toEqual({ min: 3, max: 12 });
    expect(m.gustRange).toEqual({ min: 6, max: 18 });
    expect(m.popRange).toEqual({ min: 10, max: 70 });
    expect(m.precipRange).toEqual({ min: 0, max: 19.8 });
    expect(m.wbgtRange).toEqual({ min: 18, max: 26 });
  });
  it('§0.57.1 整合性 : ShowWindow 値はレンジ内に収まる (カード表示 = ShowWindow)', () => {
    // カード ・ スコア理由は wbgtShowWindow を表示。これが日レンジ [min,max] に収まることで
    // 「カード値がレンジ外」という食い違いが起きないことを保証する。
    const m = aggregateMetrics([f1], 'TDL');
    expect(m.wbgtShowWindow).not.toBeNull();
    expect(m.wbgtShowWindow).toBeGreaterThanOrEqual(m.wbgtRange.min);
    expect(m.wbgtShowWindow).toBeLessThanOrEqual(m.wbgtRange.max);
    expect(m.popShowWindow).toBeGreaterThanOrEqual(m.popRange.min);
    expect(m.popShowWindow).toBeLessThanOrEqual(m.popRange.max);
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
    // §0.47.2 : wind 50 + rain 35 = 85 → score 15 → NG (§0.52)
    expect(r.deductions.wind).toBe(50);
    expect(r.deductions.rain).toBe(35);
    expect(r.score).toBe(15);
    expect(r.symbol.label).toBe('NG');
  });
  it('show-window が無ければ daily 最大にフォールバック', () => {
    const m = {
      gustShowWindow: null, gustMax: 6,
      popShowWindow: null, popMax: 25,
      wbgtShowWindow: null, wbgtMax: null,
      precipSum: 0, feelsLikeMax: 22, tempMax: 25, windShowWindow: null, uvMax: 0,
    };
    const r = scoreFromMetrics(m, 'TDL');
    // §0.47.2 : wind 5 + rain 5 = 10 → score 90 → BEST (§0.52)
    expect(r.score).toBe(90);
    expect(r.symbol.label).toBe('BEST');
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
    expect(s.symbol.label).toBe('BEST');
    expect(s.hasData).toBe(true);
  });
  it('重み付き平均 (朝1.5 / 昼2.0 / 夜1.0)', () => {
    const sub = {
      morning: { score: 100, hasData: true },
      noon: { score: 50, hasData: true },
      night: { score: 0, hasData: true },
    };
    // §0.66.1 : (100*1.5 + 50*2.0 + 0*1.0) / (1.5+2.0+1.0) = 250/4.5 ≈ 56
    expect(weightedBandTotal(sub)).toBe(56);
  });
  it('§0.66.1 仕様例 (朝45 / 昼45 / 夜74 → 51)', () => {
    const sub = {
      morning: { score: 45, hasData: true },
      noon: { score: 45, hasData: true },
      night: { score: 74, hasData: true },
    };
    // (45*1.5 + 45*2.0 + 74*1.0) / 4.5 = 231.5/4.5 = 51.4 → 51
    expect(weightedBandTotal(sub)).toBe(51);
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
    // §0.52.3 : cap (critical 20=NG / danger 40=FAIR / warn 80=GOOD)
    expect(g(90, '中止')).toBe(20); // critical
    expect(g(90, '雨キャン')).toBe(40); // danger
    expect(g(90, '雨バ')).toBe(80); // warn → GOOD
    expect(g(80, '通常')).toBe(80); // normal はキャップなし
    expect(g(15, '中止')).toBe(15); // キャップは上限のみ (引き下げ済みは保持)
  });
  it('最も厳しいバッジが効く', () => {
    const r = applyBadgeGuard(80, {
      wind: { text: '風バ' }, // warn
      rain: { text: '中止' }, // critical
      wbgt: { text: '通常' },
    });
    expect(r.worstSeverity).toBe('critical');
    expect(r.score).toBe(20);
    expect(r.capped).toBe(true);
  });
});

describe('§0.55 evaluateDay 統合 (キャップで過剰評価を防ぐ ・ 各段階到達可能)', () => {
  it('風バ単独 + 晴れ (雨少) → GOOD まで (BEST にしない)', () => {
    const om = fakeForecast(
      'open-meteo',
      { gustMax: 8, popMax: 10, precipSum: 0, feelsLikeMax: 24, tempMax: 27, uvMax: 5 },
      [
        { hour: 12, gust: 8, pop: 10, wind: 6, wbgt: 24, precip: 0 },
        { hour: 13, gust: 8, pop: 10, wind: 6, wbgt: 24, precip: 0 },
        { hour: 14, gust: 8, pop: 10, wind: 6, wbgt: 24, precip: 0 },
      ],
    );
    const r = evaluateDay([om], 'TDL');
    expect(r.badges.wind.text).toBe('風バ');
    expect(['GOOD']).toContain(r.symbol.label); // 風バ単独 → GOOD (BEST/OK ではない)
  });
  it('高い雨確率 (70%) → BEST にならない (FAIR 以下)', () => {
    const om = fakeForecast(
      'open-meteo',
      { gustMax: 3, popMax: 70, precipSum: 0, feelsLikeMax: 22, tempMax: 24, uvMax: 3 },
      [
        { hour: 12, gust: 3, pop: 70, wind: 2, wbgt: 22, precip: 0 },
        { hour: 13, gust: 3, pop: 70, wind: 2, wbgt: 22, precip: 0 },
        { hour: 14, gust: 3, pop: 70, wind: 2, wbgt: 22, precip: 0 },
      ],
    );
    const r = evaluateDay([om], 'TDL');
    expect(r.score).toBeLessThanOrEqual(59); // 70%+ は FAIR 上限
    expect(['FAIR', 'NG']).toContain(r.symbol.label);
  });
});

describe('popScoreCap (§0.55.1 雨確率キャップ)', () => {
  it('確率帯ごとの上限', () => {
    expect(popScoreCap(29)).toBe(100); // 上限なし
    expect(popScoreCap(30)).toBe(89); // GOOD
    expect(popScoreCap(49)).toBe(89);
    expect(popScoreCap(50)).toBe(74); // OK
    expect(popScoreCap(69)).toBe(74);
    expect(popScoreCap(70)).toBe(59); // FAIR
    expect(popScoreCap(null)).toBe(100);
  });
  it('霧雨は緩和 (<1mm/h は OK 許容 ・ ≥1mm/h は FAIR)', () => {
    expect(popScoreCap(80, true, 0.7)).toBe(74); // 高確率でも軽霧雨は OK まで
    expect(popScoreCap(80, true, 1.2)).toBe(59); // 1mm/h 以上は FAIR
  });
});

describe('warnCountCap (§0.55.5 複数注意バッジ)', () => {
  const b = (wind, rain, wbgt) => ({ wind: { text: wind }, rain: { text: rain }, wbgt: { text: wbgt } });
  it('注意バッジ数で上限', () => {
    expect(warnCountCap(b('通常', '通常', '通常'))).toBe(100);
    expect(warnCountCap(b('風バ', '通常', '通常'))).toBe(89); // 1 → GOOD
    expect(warnCountCap(b('風バ', '雨バ', '通常'))).toBe(74); // 2 → OK (6/11 ケース)
    expect(warnCountCap(b('風バ', '雨バ', '熱バ'))).toBe(59); // 3 → FAIR
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
    // §0.47.1 : 日全体バッジは一般ショー基準 (windBa8/windCancel11)。gust window 平均 11 → 中止リスク域。
    expect(r.badges.wind.text).toBe('中止リスク');
    // §0.48.2 : hourly に precip が無いので降水量 0 ・ pop window 60 → 高確率で「雨バ」
    expect(r.badges.rain.text).toBe('雨バ');
    expect(r.subscores.noon).toBeTruthy();
    expect(['BEST', 'GOOD', 'OK', 'FAIR', 'NG']).toContain(r.subscores.noon.symbol.label);
  });

  it('§0.66.4 : 時間帯クランプは撤廃 ・ 時間帯は日スコアを超えてよい (夜が日より高い)', () => {
    // 朝 ・ 昼が風で低め、夜は穏やか → 夜のサブスコアが日 (加重平均) を上回る。
    const om = fakeForecast(
      'open-meteo',
      { gustMax: 9, popMax: 10, feelsLikeMax: 22, tempMax: 24, uvMax: 3 },
      [
        { hour: 10, gust: 9, pop: 10, wind: 7, wbgt: 22 },
        { hour: 13, gust: 9, pop: 10, wind: 7, wbgt: 22 },
        { hour: 19, gust: 2, pop: 0, wind: 2, wbgt: 21 },
      ],
    );
    const r = evaluateDay([om], 'TDL');
    // 夜は減点なし (100) で日スコアより高い = クランプされていない。
    expect(r.subscores.night.score).toBeGreaterThan(r.score);
  });

  it('§0.66.1 : 日スコアは時間帯加重平均ベース (weightedTotal = 加重平均)', () => {
    // 全時間帯 風 9m/s (風バ) → 各バンド 85。加重平均 85。
    // 日スコアは warn (風バ) キャップ 80 が併用されるため 80 (= GOOD)。楽観的に BEST にならない。
    const om = fakeForecast(
      'open-meteo',
      { gustMax: 9, popMax: 10, feelsLikeMax: 22, tempMax: 24, uvMax: 3 },
      [
        { hour: 10, gust: 9, pop: 10, wind: 7, wbgt: 22 },
        { hour: 13, gust: 9, pop: 10, wind: 7, wbgt: 22 },
        { hour: 19, gust: 9, pop: 10, wind: 7, wbgt: 22 },
      ],
    );
    const r = evaluateDay([om], 'TDL');
    expect(r.weightedTotal).toBe(85);
    expect(r.score).toBe(80); // warn cap 80
  });

  it('§0.66.2 : いずれかの時間帯が NG なら日 ≤ 59 (FAIR) に制限', () => {
    // 昼が強風 (12m/s) + 強雨 (95%) で NG、朝夜は穏やか → floor guard で日 ≤ 59。
    const om = fakeForecast(
      'open-meteo',
      { gustMax: 12, popMax: 95, feelsLikeMax: 22, tempMax: 24, uvMax: 3 },
      [
        { hour: 10, gust: 2, pop: 0, wind: 2, wbgt: 21 },
        { hour: 13, gust: 12, pop: 95, wind: 2, wbgt: 21 },
        { hour: 19, gust: 2, pop: 0, wind: 2, wbgt: 21 },
      ],
    );
    const r = evaluateDay([om], 'TDL');
    expect(r.subscores.noon.score).toBeLessThan(40); // 昼 NG
    expect(r.floorCap).toBe(59);
    expect(r.score).toBeLessThanOrEqual(59);
  });
});
