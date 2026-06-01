import { describe, it, expect } from 'vitest';
import { getWeatherIcon, getWeatherIcons } from '../src/utils/weatherIcon.js';

describe('getWeatherIcons (§0.42.3 複合天気アイコン)', () => {
  it('複合天気を「、」区切りで分解し並列アイコンを返す', () => {
    const icons = getWeatherIcons('晴れ夜くもり所により昼前まで霧');
    expect(icons.map((i) => i.name)).toEqual(['wb_sunny', 'cloud', 'foggy']);
  });

  it('単一天気は 1 アイコン', () => {
    expect(getWeatherIcons('晴れ').map((i) => i.name)).toEqual(['wb_sunny']);
    expect(getWeatherIcons('雨').map((i) => i.name)).toEqual(['rainy']);
  });

  it('連続する同一アイコンは重複除去', () => {
    // 「曇り、昼前から曇り」→ cloud が連続 → 1 つに
    const icons = getWeatherIcons('くもり昼前からくもり');
    expect(icons.map((i) => i.name)).toEqual(['cloud']);
  });

  it('空入力は空配列', () => {
    expect(getWeatherIcons('')).toEqual([]);
    expect(getWeatherIcons(null)).toEqual([]);
  });

  it('各アイコンは name と color を持つ', () => {
    const icons = getWeatherIcons('晴れ夜くもり');
    expect(icons.length).toBeGreaterThanOrEqual(1);
    for (const ic of icons) {
      expect(ic).toHaveProperty('name');
      expect(ic).toHaveProperty('color');
    }
  });

  it('getWeatherIcon の単一判定は従来どおり', () => {
    expect(getWeatherIcon('雷雨').name).toBe('bolt');
    expect(getWeatherIcon('霧').name).toBe('foggy');
  });
});
