import { describe, it, expect } from 'vitest';
import { isWeatherless } from '../src/data/show-thresholds.js';

describe('isWeatherless (§0.44.12 屋内ショー判定)', () => {
  it('屋内ショー ・ プロジェクションは true', () => {
    expect(isWeatherless('ミッキーのレインボー･ルアウ')).toBe(true);
    expect(isWeatherless('ミッキーのマジカルミュージックワールド')).toBe(true);
    expect(isWeatherless('ダッフィー&フレンズのワンダフル･フレンドシップ')).toBe(true);
    expect(isWeatherless('ドリームス･テイク･フライト')).toBe(true);
    expect(isWeatherless('【環境演出】スパークリング･ジュビリー･ナイト')).toBe(true);
  });

  it('屋外ショー ・ 花火は false (セレブレーションを誤検知しない)', () => {
    expect(isWeatherless('スパークリング･ジュビリー･セレブレーション')).toBe(false);
    expect(isWeatherless('ディズニー･ハーモニー･イン･カラー')).toBe(false);
    expect(isWeatherless('スカイ･フル･オブ･カラーズ')).toBe(false);
    expect(isWeatherless('')).toBe(false);
    expect(isWeatherless(null)).toBe(false);
  });
});
