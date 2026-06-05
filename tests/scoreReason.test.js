import { describe, it, expect } from 'vitest';
import { getScoreReason } from '../src/score/scoreReason.js';

// §0.71.2 : 直接理由 (警告バッジの有無 ・ 数)。加重平均等の中間計算は出さない。
const ev = (badges, metrics = {}) => ({ badges, metrics });
const badge = (level, text) => ({ level, text });
const ok = badge(0, '通常');

describe('getScoreReason (§0.71.2 直接理由)', () => {
  it('警告 0 → 風・雨・熱 通常', () => {
    expect(getScoreReason(ev({ wind: ok, rain: ok, wbgt: ok }))).toBe('風・雨・熱 通常');
  });

  it('警告 1 (風バ) → 長文 + 実測値 (§0.77.1 曖昧な補足は削除)', () => {
    const r = getScoreReason(ev({ wind: badge(1, '風バ'), rain: ok, wbgt: ok }, { gustShowWindow: 8.2 }));
    expect(r).toBe('風バ可能性あり (8.2m/s)');
  });

  it('警告 2 (雨バ + 熱バ) → 「雨と熱の両方が注意」 (§0.72.3)', () => {
    const r = getScoreReason(ev({ wind: ok, rain: badge(1, '雨バ'), wbgt: badge(1, '熱バ') }));
    expect(r).toBe('雨と熱の両方が注意');
  });

  it('警告 1 (熱バ) → WBGT 値併記', () => {
    const r = getScoreReason(ev({ wind: ok, rain: ok, wbgt: badge(1, '熱バ') }, { wbgtShowWindow: 25.4 }));
    expect(r).toBe('熱バ可能性あり (WBGT 25.4)');
  });

  it('警告 1 (雨キャン ・ 強雨) → mm/h 表記', () => {
    const r = getScoreReason(ev({ wind: ok, rain: badge(2, '雨キャン'), wbgt: ok }, { precipMaxHourly: 3.5, popShowWindow: 80 }));
    expect(r).toBe('雨キャン濃厚 (3.5mm/h)');
  });

  it('警告 1 (雨バ ・ 弱雨) → % 表記', () => {
    const r = getScoreReason(ev({ wind: ok, rain: badge(1, '雨バ'), wbgt: ok }, { precipMaxHourly: 0.3, popShowWindow: 60 }));
    expect(r).toBe('雨バ可能性 (60%)');
  });

  it('警告 3 → 「警告 3つ (風バ + 雨バ + 熱バ)」', () => {
    const r = getScoreReason(ev({ wind: badge(1, '風バ'), rain: badge(1, '雨バ'), wbgt: badge(1, '熱バ') }));
    expect(r).toBe('警告 3つ (風バ + 雨バ + 熱バ)');
  });

  it('警告 2 → 件数 + 短縮名', () => {
    const r = getScoreReason(ev({ wind: badge(1, '風バ'), rain: ok, wbgt: badge(1, '熱バ') }));
    expect(r).toBe('警告 2つ (風バ + 熱バ)');
  });

  it('badges 欠損は空文字', () => {
    expect(getScoreReason(null)).toBe('');
    expect(getScoreReason({})).toBe('');
  });
});
