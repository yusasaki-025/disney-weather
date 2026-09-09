import { describe, it, expect } from 'vitest';
import { classify } from '../scripts/fetch-schedule.mjs';

// §0.95 : 公式取得スクリプトの分類ロジック。priority:high は showWindow (スコア ・ バッジの算定窓)
//   に直結するため、季節イベントの演目が high から漏れないこと ・ 通年 ｡ 屋内 ｡ レストランが
//   誤って high にならないことを固定する。classify は公式表記 (全角中黒) のまま呼ばれる。
describe('classify (§0.95 季節イベント = high)', () => {
  it('登録済みの季節イベント演目は high ＋ 会場に応じた kind', () => {
    expect(classify('ザ・ヴィランズ・ハロウィーン“Into the Frenzy”')).toEqual({
      priority: 'high',
      kind: 'parade-day',
    });
    expect(classify('ナイトハイ・ハロウィーン')).toEqual({ priority: 'high', kind: 'fireworks' });
    expect(classify('ディズニー・ハロウィーン・グリーティング')).toEqual({ priority: 'high', kind: 'show-day' });
    expect(classify('トイズ・ワンダラス・クリスマス！')).toEqual({ priority: 'high', kind: 'parade-day' });
    expect(classify('スターブライト・クリスマス')).toEqual({ priority: 'high', kind: 'fireworks' });
    expect(classify('ディズニー・クリスマス・グリーティング')).toEqual({ priority: 'high', kind: 'show-day' });
  });

  it('ルール未登録でも季節イベント名なら high (次のシーズンで窓が空にならない保険)', () => {
    expect(classify('ディズニー・イースター・グリーティング').priority).toBe('high');
    expect(classify('ミッキーの夏まつり').priority).toBe('high');
  });

  it('屋内の演目は季節イベント名でも high にしない', () => {
    // 屋内 (ショーベース)。isWeatherless で除外される。
    expect(classify('The D-Groovationz4 Live: Happy! Funky! Groovy! Tour')).toEqual({
      priority: 'medium',
      kind: 'show-indoor',
    });
    // 屋内の季節ディナーショーを想定 (架空名)。予約必須タグでレストラン扱いに倒す。
    expect(classify('ミッキーのクリスマス・ディナーショー', ['予約必須'])).toEqual({
      priority: null,
      kind: 'show-restaurant',
    });
  });

  it('通年演目は据え置き (季節イベントに巻き込まない)', () => {
    expect(classify('ディズニー・ハーモニー・イン・カラー')).toEqual({ priority: 'medium', kind: 'parade-day' });
    expect(classify('東京ディズニーランド・エレクトリカルパレード・ドリームライツ')).toEqual({
      priority: 'low',
      kind: 'parade-night',
    });
    expect(classify('ミッキーのマジカルミュージックワールド')).toEqual({ priority: 'medium', kind: 'show-unknown' });
    expect(classify('ミッキーのレインボー・ルアウ')).toEqual({ priority: null, kind: 'show-restaurant' });
  });
});
