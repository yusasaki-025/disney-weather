import { describe, it, expect } from 'vitest';
import { weatherBadge } from '../src/data/weatherBadge.js';

// §0.80 : 天気 5 段階バッジ (降水を晴/曇より優先)。
describe('weatherBadge (§0.80)', () => {
  it('晴れ系 → 快適 (緑)', () => {
    expect(weatherBadge('晴れ')).toMatchObject({ text: '快適', key: 'comfort' });
    expect(weatherBadge('晴れ時々曇り')).toMatchObject({ text: '快適', key: 'comfort' });
  });
  it('曇り → ふつう (グレー)', () => {
    expect(weatherBadge('曇り')).toMatchObject({ text: 'ふつう', key: 'normal' });
    expect(weatherBadge('くもり')).toMatchObject({ key: 'normal' });
  });
  it('霧雨 ・ 小雨 → 注意 (黄)', () => {
    expect(weatherBadge('霧雨')).toMatchObject({ text: '注意', key: 'caution', level: 1 });
    expect(weatherBadge('小雨')).toMatchObject({ key: 'caution' });
  });
  it('雨 ・ 雷 ・ 大雨 → 警告 (赤) ・ 降水は晴/曇より優先', () => {
    expect(weatherBadge('雨')).toMatchObject({ text: '警告', key: 'warn', level: 2 });
    expect(weatherBadge('曇り、夜雨')).toMatchObject({ key: 'warn' });
    expect(weatherBadge('雷雨')).toMatchObject({ key: 'warn' });
    expect(weatherBadge('晴れのち雨')).toMatchObject({ key: 'warn' }); // 雨を優先
  });
  it('雪 → 悪天候 (濃赤)', () => {
    expect(weatherBadge('大雪')).toMatchObject({ text: '悪天候', key: 'severe', level: 3 });
    expect(weatherBadge('雪')).toMatchObject({ key: 'severe' });
  });
  it('空 ・ 不明 → ふつう', () => {
    expect(weatherBadge('')).toMatchObject({ key: 'normal' });
    expect(weatherBadge(null)).toMatchObject({ key: 'normal' });
  });
});
