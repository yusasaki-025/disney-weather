import { describe, it, expect } from 'vitest';
import { isWeatherless, isSeasonal, thresholdForShow } from '../src/data/show-thresholds.js';

describe('thresholdForShow (§0.75 ショー個別の風閾値 + isDefault)', () => {
  it('固有閾値ショー (ハーモニー) は windBa6/windCancel12 ・ isDefault=false', () => {
    const t = thresholdForShow('ディズニー･ハーモニー･イン･カラー');
    expect(t.windBa).toBe(6);
    expect(t.windCancel).toBe(12);
    expect(t.isDefault).toBe(false);
  });
  it('エレクトリカルは windCancel10 (windBa は DEFAULT 8) ・ isDefault=false', () => {
    const t = thresholdForShow('東京ディズニーランド･エレクトリカルパレード･ドリームライツ');
    expect(t.windBa).toBe(8);
    expect(t.windCancel).toBe(10);
    expect(t.isDefault).toBe(false);
  });
  it('一般ショー (該当なし) は DEFAULT 8/12 ・ isDefault=true', () => {
    const t = thresholdForShow('架空ショー');
    expect(t.windBa).toBe(8);
    expect(t.windCancel).toBe(12);
    expect(t.isDefault).toBe(true);
  });
  it('名前なしも DEFAULT ・ isDefault=true', () => {
    expect(thresholdForShow().isDefault).toBe(true);
  });
  // §0.87 回帰 : pyroLimit のみ登録のショー (Reach for the Stars) は windBa/windCancel を個別上書き
  //   していないため、風の基準としては一般基準 (DEFAULT) = isDefault:true であるべき。旧実装は
  //   SHOW_THRESHOLDS に 1 件ヒットしただけで isDefault:false にし、「個別検証済みの風基準」と誤表示していた。
  it('pyroLimit のみのショー (Reach for the Stars) は風基準は DEFAULT ・ isDefault=true', () => {
    const t = thresholdForShow('Reach for the Stars: Everlasting Dreams');
    expect(t.pyroLimit).toBe(8); // 花火カット基準は保持
    expect(t.windBa).toBe(8); // 風バは DEFAULT
    expect(t.windCancel).toBe(12); // 中止も DEFAULT
    expect(t.isDefault).toBe(true); // 風の個別上書きが無いので一般基準扱い
  });
});

describe('isWeatherless (§0.44.12 屋内ショー判定)', () => {
  it('屋内ショー ・ プロジェクションは true', () => {
    expect(isWeatherless('ミッキーのレインボー･ルアウ')).toBe(true);
    expect(isWeatherless('ミッキーのマジカルミュージックワールド')).toBe(true);
    expect(isWeatherless('ダッフィー&フレンズのワンダフル･フレンドシップ')).toBe(true);
    expect(isWeatherless('ドリームス･テイク･フライト')).toBe(true);
    expect(isWeatherless('【環境演出】スパークリング･ジュビリー･ナイト')).toBe(true);
    // 屋内レストランショー。WEATHERLESS 未登録で一般基準 (風バ 8 / 中止 12) が誤表示されていた回帰ガード。
    // 公式表記の全角中黒と、既存データの半角中黒の両方で判定できること。
    expect(isWeatherless('ザ・ダイヤモンド・バラエティマスター')).toBe(true);
    expect(isWeatherless('ザ･ダイヤモンド･バラエティマスター')).toBe(true);
  });

  it('屋外ショー ・ 花火は false (セレブレーションを誤検知しない)', () => {
    expect(isWeatherless('スパークリング･ジュビリー･セレブレーション')).toBe(false);
    expect(isWeatherless('ディズニー･ハーモニー･イン･カラー')).toBe(false);
    expect(isWeatherless('スカイ･フル･オブ･カラーズ')).toBe(false);
    expect(isWeatherless('')).toBe(false);
    expect(isWeatherless(null)).toBe(false);
  });
});

describe('isSeasonal (§0.46.6 期間限定タグ判定)', () => {
  it('季節限定演目は true', () => {
    expect(isSeasonal('イッツ･ア･スウィーツフルタイム!')).toBe(true);
    expect(isSeasonal('Reach for the Stars')).toBe(true);
    expect(isSeasonal('スカイ･フル･オブ･カラーズ')).toBe(true);
  });

  it('通年演目は false (ハーモニー ・ イン ・ カラーに期間限定を付けない)', () => {
    expect(isSeasonal('ディズニー･ハーモニー･イン･カラー')).toBe(false);
    expect(isSeasonal('東京ディズニーランド･エレクトリカルパレード･ドリームライツ')).toBe(false);
    expect(isSeasonal('ジャンボリミッキー!レッツ･ダンス!')).toBe(false);
    expect(isSeasonal('')).toBe(false);
    expect(isSeasonal(null)).toBe(false);
  });
});
