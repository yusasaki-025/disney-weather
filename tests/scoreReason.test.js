import { describe, it, expect } from 'vitest';
import { getScoreReason } from '../src/score/scoreReason.js';

// §0.66.3 : 時間帯ベースの理由。subscores ({score, symbol:{label}, hasData, factor}) を受け取る。
const band = (score, label, hasData = true, factor = null) => ({ score, symbol: { label }, hasData, factor });

describe('getScoreReason (§0.66.3 時間帯ベース)', () => {
  it('昼を先頭に各時間帯の評価を並べる', () => {
    const r = getScoreReason({
      subscores: {
        morning: band(45, 'FAIR', true, '風'),
        noon: band(45, 'FAIR', true, '風'),
        night: band(74, 'OK'),
      },
    });
    // 昼 (最重視) を先頭 ・ FAIR 以下は主因 (風強め) を併記 ・ OK は併記なし
    expect(r).toBe('昼 (最重視) FAIR (45) 風強め・朝 FAIR (45) 風強め・夜 OK (74)');
  });

  it('全時間帯 OK 以上なら主因は付かない', () => {
    const r = getScoreReason({
      subscores: {
        morning: band(85, 'GOOD'),
        noon: band(90, 'BEST'),
        night: band(80, 'GOOD'),
      },
    });
    expect(r).toBe('昼 (最重視) BEST (90)・朝 GOOD (85)・夜 GOOD (80)');
  });

  it('データ無しの時間帯はスキップ', () => {
    const r = getScoreReason({
      subscores: {
        morning: band(0, 'NG', false),
        noon: band(45, 'FAIR', true, '雨'),
        night: band(0, 'NG', false),
      },
    });
    expect(r).toBe('昼 (最重視) FAIR (45) 雨');
  });

  it('subscores 欠損は空文字', () => {
    expect(getScoreReason(null)).toBe('');
    expect(getScoreReason({})).toBe('');
  });
});
