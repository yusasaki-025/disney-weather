import { describe, it, expect } from 'vitest';
import { daySummary } from '../src/score/daySummary.js';

// §0.77 : ショー開催可否を 3 段階 (開催予定 / 中止の可能性 / 中止濃厚) で明示 ・ 曖昧表現なし。
const b = (wind, rain, wbgt) => ({ wind: { text: wind }, rain: { text: rain }, wbgt: { text: wbgt } });

describe('daySummary (§0.77 ショー言及 ・ 3 段階)', () => {
  it('警告なし → 全ショー開催予定', () => {
    expect(daySummary({ weather: '晴れ', badges: b('通常', '通常', '通常') })).toBe('晴れ。全ショー開催予定。');
  });

  it('天気 + 警報 + 状況を 。区切り ・ 末尾 。', () => {
    const r = daySummary({ weather: '曇り', warningLabel: '強風注意報', badges: b('通常', '通常', '通常') });
    expect(r).toBe('曇り。強風注意報発表中。全ショー開催予定。');
  });

  it('警告 1 (風バ) → 開催予定 (風バ可能性) ・ high ショー名を併記', () => {
    const r = daySummary({
      weather: '晴れ',
      badges: b('風バ', '通常', '通常'),
      highShows: [{ name: 'スカイ･フル･オブ･カラーズ', time: '20:30' }],
    });
    expect(r).toBe('晴れ。スカイ･フル･オブ･カラーズ 20:30 等のショーは開催予定 (風バ可能性)。');
  });

  it('警告 2 (風 + 雨) → 中止の可能性 (要素併記)', () => {
    const r = daySummary({ weather: '雨', badges: b('風バ', '雨バ', '通常'), highShows: [{ name: 'イッツ･ア･スウィーツフルタイム!', time: '16:25' }] });
    expect(r).toBe('雨。イッツ･ア･スウィーツフルタイム! 16:25 等のショーは中止の可能性 (風・雨)。');
  });

  it('キャン濃厚 (中止リスク / 雨キャン) → 中止の可能性が高い', () => {
    expect(daySummary({ weather: '強風', badges: b('中止リスク', '通常', '通常') })).toBe('強風。屋外ショーは中止の可能性が高い。');
    expect(daySummary({ weather: '大雨', badges: b('通常', '雨キャン', '通常') })).toBe('大雨。屋外ショーは中止の可能性が高い。');
  });

  it('ほぼ中止 (中止) → 中止濃厚', () => {
    expect(daySummary({ weather: '暴風', badges: b('中止', '通常', '通常') })).toBe('暴風。屋外ショーは中止濃厚。');
  });

  it('高ショー無しでも警告時は「屋外ショーは ___」', () => {
    expect(daySummary({ weather: '晴れ', badges: b('熱バ', '通常', '通常') })).toBe('晴れ。屋外ショーは開催予定 (熱バ可能性)。');
  });

  it('引数なしでも落ちない (全ショー開催予定)', () => {
    expect(daySummary()).toBe('全ショー開催予定。');
  });
});
