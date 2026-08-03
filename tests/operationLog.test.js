import { describe, it, expect } from 'vitest';
import { getShowIncidents } from '../src/data/operationLog.js';

// §0.92 回帰 : cancel-history (§0.30 PDF由来・風速実測付き) は風速の無いショーだと該当0件に
//   なりやすい。運用ログ (@kazekyanbunseki 由来 operation-log/*.json) からショー別の中止・変更
//   事例と原因内訳 (風/雨/熱) を補助表示できることのガード。
//   スパークリング・ジュビリー・セレブレーション (TDS) は既存 cancel-history ではサンプル3件で
//   非表示だが、運用ログには7件 (熱5・雨2) ある (node 実データ確認済み)。
describe('getShowIncidents (§0.92 運用ログ由来の中止・変更実績)', () => {
  it('セレブレーション (TDS) は7件・原因内訳 熱5 雨2', () => {
    const incidents = getShowIncidents('スパークリング・ジュビリー・セレブレーション', 'TDS');
    expect(incidents.length).toBe(7);
    const counts = { wind: 0, rain: 0, heat: 0, other: 0 };
    incidents.forEach((it) => { counts[it.cause] += 1; });
    expect(counts.heat).toBe(5);
    expect(counts.rain).toBe(2);
    expect(counts.wind).toBe(0);
    expect(counts.other).toBe(0);
    // 新しい順 (date 降順) で返る
    const dates = incidents.map((it) => it.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('該当なし・名前なしは空配列', () => {
    expect(getShowIncidents('架空のショー', 'TDS')).toEqual([]);
    expect(getShowIncidents('', 'TDS')).toEqual([]);
    expect(getShowIncidents(null, 'TDS')).toEqual([]);
  });
});
