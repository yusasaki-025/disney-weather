import { describe, it, expect } from 'vitest';
import { daySummary } from '../src/score/daySummary.js';

// §0.68.G : daySummary (この日の概要テキスト) の分岐網羅。
const b = (wind, rain, wbgt) => ({ wind: { text: wind }, rain: { text: rain }, wbgt: { text: wbgt } });

describe('daySummary (§0.63.2 / §0.68.G)', () => {
  it('天気 + 警報 + 状況を 。区切りで連結し末尾に 。', () => {
    const r = daySummary({ weather: '晴れ', warningLabel: '強風注意報', badges: b('通常', '通常', '通常') });
    expect(r).toBe('晴れ。強風注意報が出ています。ショー鑑賞に大きな支障はなさそう。');
  });

  it('drizzle 最優先', () => {
    const r = daySummary({ weather: '曇り', badges: b('中止', '中止', '通常'), drizzle: true });
    expect(r).toContain('弱い雨が続きますが、ショーは原則開催の見込み');
  });

  it('中止 → 中止リスク高フレーズ', () => {
    expect(daySummary({ badges: b('通常', '中止', '通常') })).toContain('ショー中止のリスクが高い');
    expect(daySummary({ badges: b('中止', '通常', '通常') })).toContain('ショー中止のリスクが高い');
  });

  it('雨キャン / 中止リスク → 中止の可能性', () => {
    expect(daySummary({ badges: b('通常', '雨キャン', '通常') })).toContain('ショー中止の可能性あり');
    expect(daySummary({ badges: b('中止リスク', '通常', '通常') })).toContain('ショー中止の可能性あり');
  });

  it('風バ + 雨バ → 風と雨にやや注意', () => {
    expect(daySummary({ badges: b('風バ', '雨バ', '通常') })).toContain('風と雨にやや注意');
  });

  it('風バ単独 → 風がやや強め / 雨バ単独 → 雨がぱらつく / 熱バ → 暑さに注意', () => {
    expect(daySummary({ badges: b('風バ', '通常', '通常') })).toContain('風がやや強め');
    expect(daySummary({ badges: b('通常', '雨バ', '通常') })).toContain('雨がぱらつく可能性あり');
    expect(daySummary({ badges: b('通常', '通常', '熱バ') })).toContain('暑さに注意');
  });

  it('全通常 → 支障なし ・ 引数なしでも落ちない', () => {
    expect(daySummary({ badges: b('通常', '通常', '通常') })).toBe('ショー鑑賞に大きな支障はなさそう。');
    expect(daySummary()).toBe('ショー鑑賞に大きな支障はなさそう。');
  });
});
