import { describe, it, expect } from 'vitest';
import { suggestOutfit } from '../src/ui/outfit.js';

const has = (items, t) => items.some((i) => i.text.includes(t));

describe('suggestOutfit (§0.38.1)', () => {
  it('雨予報日は折りたたみ傘 + ポンチョが出る (Yuka 主訴)', () => {
    const r = suggestOutfit({ popMax: 70, precipSum: 5, tempMax: 24, tempMin: 18 });
    expect(has(r, '折りたたみ傘')).toBe(true);
    expect(has(r, 'ポンチョ')).toBe(true);
  });

  it('猛暑 35℃ + WBGT32 + UV9 で暑さ対策一式', () => {
    const r = suggestOutfit({ popMax: 0, precipSum: 0, tempMax: 36, wbgtMax: 32, uvMax: 9, tempMin: 26 });
    expect(has(r, 'ハンディファン')).toBe(true);
    expect(has(r, '塩飴')).toBe(true);
    expect(has(r, '日焼け止め')).toBe(true);
  });

  it('厳冬 < 5℃ で防寒一式', () => {
    const r = suggestOutfit({ popMax: 0, precipSum: 0, tempMax: 3, uvMax: 2, tempMin: -2 });
    expect(has(r, 'ヒートテック')).toBe(true);
    expect(has(r, 'カイロ')).toBe(true);
  });

  it('§0.44.6 : 天気不変の常備品 (靴 ・ バッテリー) はサジェストに出さない', () => {
    const r = suggestOutfit({ popMax: 90, precipSum: 25, tempMax: 36, wbgtMax: 32, uvMax: 9, gustMax: 11, tempMin: 18 });
    expect(has(r, '歩きやすい靴')).toBe(false);
    expect(has(r, 'モバイルバッテリー')).toBe(false);
  });

  it('天気が穏やかなら提案ゼロもあり得る (常備品で埋めない)', () => {
    const r = suggestOutfit({ popMax: 10, precipSum: 0, tempMax: 24, tempMin: 20, uvMax: 2 });
    expect(r.length).toBe(0);
  });

  it('8件を超えたら「他 N点」にまとめる', () => {
    const r = suggestOutfit({
      popMax: 90, precipSum: 25, tempMax: 36, wbgtMax: 32, uvMax: 9, gustMax: 11,
      tempMin: 18, feelsLikeMax: 40, feelsLikeMin: 24,
    });
    expect(r.length).toBeLessThanOrEqual(8);
    expect(r.every((i) => i.icon && i.text)).toBe(true);
  });

  it('showWindow 値を Max より優先する', () => {
    const r = suggestOutfit({ popShowWindow: 80, popMax: 10, precipSum: 0, tempMax: 24, tempMin: 20 });
    expect(has(r, 'ポンチョ')).toBe(true); // pop80 → ポンチョ域
  });
});
