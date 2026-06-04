import { describe, it, expect } from 'vitest';
import {
  addDays,
  candidateDates,
  formatMd,
  weekday,
  weekdayIndex,
  isWeekend,
  formatYmdSlash,
} from '../src/utils/date.js';
import { kmhToMs, msToKmh, round, mean, maxOf } from '../src/utils/units.js';
import { isHoliday, holidayName, schoolVacation, dayType } from '../src/data/holidays.js';
import { weightFromError, sourceWeights } from '../src/score/reliability.js';
import { showWindowHours, showTimes, allShowMarkers } from '../src/data/showSchedule.js';
import { suggestOutfit } from '../src/ui/outfit.js';

describe('date utils (JST 固定)', () => {
  it('addDays は月またぎ ・ 年またぎを正しく処理', () => {
    expect(addDays('2026-05-30', 2)).toBe('2026-06-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('candidateDates は連続 15 日', () => {
    const ds = candidateDates(15, '2026-05-30');
    expect(ds).toHaveLength(15);
    expect(ds[0]).toBe('2026-05-30');
    expect(ds[14]).toBe('2026-06-13');
  });
  it('曜日 ・ 表示整形', () => {
    expect(weekday('2026-05-30')).toBe('土'); // 2026-05-30 は土曜
    expect(weekdayIndex('2026-05-31')).toBe(0); // 日
    expect(isWeekend('2026-05-30')).toBe(true);
    expect(isWeekend('2026-06-01')).toBe(false); // 月
    expect(formatMd('2026-06-02')).toBe('6/2');
    expect(formatYmdSlash('2026-06-02')).toBe('2026/06/02');
  });
});

describe('units', () => {
  it('m/s ⇄ km/h 換算', () => {
    expect(kmhToMs(36)).toBeCloseTo(10, 5);
    expect(msToKmh(10)).toBeCloseTo(36, 5);
    expect(kmhToMs(null)).toBeNull();
  });
  it('round は null 透過', () => {
    expect(round(3.146, 1)).toBe(3.1);
    expect(round(null)).toBeNull();
  });
  it('mean / maxOf は欠損除外', () => {
    expect(mean([10, null, 20])).toBe(15);
    expect(mean([null, null])).toBeNull();
    expect(maxOf([1, null, 9, 3])).toBe(9);
    expect(maxOf([])).toBeNull();
  });
});

describe('holidays', () => {
  it('祝日判定', () => {
    expect(isHoliday('2026-05-05')).toBe(true);
    expect(holidayName('2026-05-05')).toBe('こどもの日');
    expect(isHoliday('2026-06-02')).toBe(false);
  });
  it('学校休暇区分', () => {
    expect(schoolVacation('2026-08-10')).toBe('夏休み');
    expect(schoolVacation('2026-05-01')).toBe('GW');
    expect(schoolVacation('2026-01-03')).toBe('冬休み'); // 年またぎ
    expect(schoolVacation('2026-06-15')).toBeNull();
  });
  it('dayType まとめ', () => {
    const t = dayType('2026-05-05'); // こどもの日 (火)
    expect(t.isHoliday).toBe(true);
    expect(t.isOff).toBe(true);
    expect(dayType('2026-06-03').isOff).toBe(false); // 平日
  });
});

describe('reliability (Phase 2)', () => {
  it('誤差が小さいほど重みが大きい', () => {
    expect(weightFromError(0)).toBeGreaterThan(weightFromError(5));
    expect(weightFromError(null)).toBe(1.0);
    expect(weightFromError(100)).toBeGreaterThanOrEqual(0.5);
    expect(weightFromError(0)).toBeLessThanOrEqual(1.5);
  });
  it('サンプル 30 日未満は 1.0 のまま', () => {
    const w = sourceWeights({ jma: [1, 2, 3], 'open-meteo': new Array(30).fill(0) });
    expect(w.jma).toBe(1.0); // サンプル不足
    expect(w['open-meteo']).toBe(1.5); // 誤差 0 → 上限 1.5
  });
});

describe('showSchedule', () => {
  it('TDL high (13:00 / 15:00) の ±1h 窓は {12,13,14,15,16}', () => {
    expect([...showWindowHours('TDL', 'high', 1)].sort((a, b) => a - b)).toEqual([12, 13, 14, 15, 16]);
  });
  it('TDS high 時刻 (11:30 / 14:00) ・ TDL は全 5 公演 (§0.64.2 スカイ追加)', () => {
    expect(showTimes('TDS', 'high')).toEqual([11.5, 14]);
    expect(allShowMarkers('TDL').length).toBe(5);
    expect(allShowMarkers('TDL')[0].name).toBe('ハーモニー･イン･カラー');
    // §0.64.2 : fallback TDL にもスカイ (20:30) が含まれる
    expect(allShowMarkers('TDL').some((s) => s.name.includes('スカイ'))).toBe(true);
  });
});

describe('suggestOutfit (§0.38.1)', () => {
  const texts = (m) => suggestOutfit(m).map((o) => o.text).join(' | ');
  it('閾値ごとの提案', () => {
    expect(texts({ tempMax: 3 })).toContain('ヒートテック'); // < 5℃
    expect(texts({ tempMax: 30 })).toContain('日傘');
    expect(texts({ popMax: 60 })).toContain('ポンチョ');
    expect(texts({ uvMax: 8 })).toContain('日焼け止め');
    expect(texts({ feelsLikeMax: 25, feelsLikeMin: 12 })).toContain('羽織りもの');
  });
  it('show-window の降水を優先', () => {
    expect(texts({ popShowWindow: 60, popMax: 0 })).toContain('ポンチョ');
  });
  it('§0.44.6 : 天気不変の常備品 (靴 ・ バッテリー) はサジェストに出さない', () => {
    // 天気依存の提案のみ表示し、天候に関わらず必携の常備品はヘルプで別途案内する
    const t = texts({ tempMax: 22, popMax: 10, uvMax: 3 });
    expect(t).not.toContain('歩きやすい靴');
    expect(t).not.toContain('モバイルバッテリー');
  });
});
