// スコア理由の 1 行解説 (§0.71.2)。日スコアの「直接の理由」を簡潔に示す。
// 「加重平均 71 → 上限 → FAIR 59」のような中間計算は出さず (Yuka 指摘)、
// 警告バッジ (風/雨/熱) の有無 ・ 数を直接の理由文にする。時間帯別は別途 ss-rows に参考表示。
// 例 : 警告 0 →「風・雨・熱 通常」/ 警告 1 →「風バ可能性あり (8.2m/s)」/
//      警告 2-3 →「警告 3つ (風バ + 雨バ + 熱バ)」。

import { showWindowOrMax, round1 } from '../utils/metrics.js';

// バッジ短縮テキスト → 長文 (単独警告時に使う)。
const LONG = {
  風バ: '風バ可能性あり',
  中止リスク: '中止リスク高',
  中止: 'ほぼ中止',
  雨バ: '雨バ可能性',
  雨キャン: '雨キャン濃厚',
  熱バ: '熱バ可能性あり',
  熱キャン: '熱キャン濃厚',
};

const KEYS = ['wind', 'rain', 'wbgt'];

// 単独警告の「長文 (実測値)」表現。
function warnDetail(key, badge, metrics) {
  const long = LONG[badge.text] || badge.text;
  if (!metrics) return long;
  if (key === 'wind') {
    const g = showWindowOrMax(metrics, 'gust');
    return g != null ? `${long} (${round1(g)}m/s)` : long;
  }
  if (key === 'rain') {
    const precip = metrics.precipMaxHourly;
    if (precip != null && precip >= 1) return `${long} (${round1(precip)}mm/h)`;
    const pop = showWindowOrMax(metrics, 'pop');
    return pop != null ? `${long} (${Math.round(pop)}%)` : long;
  }
  const w = showWindowOrMax(metrics, 'wbgt');
  return w != null ? `${long} (WBGT ${round1(w)})` : long;
}

// getScoreReason(evaluation) -> string
//   evaluation : evaluateDay の戻り値 (badges ・ metrics を持つ)。
export function getScoreReason(evaluation) {
  const badges = evaluation?.badges;
  if (!badges) return '';
  const warns = KEYS.filter((k) => badges[k] && badges[k].level >= 1);
  if (warns.length === 0) return '風・雨・熱 通常';
  if (warns.length === 1) {
    const k = warns[0];
    const detail = warnDetail(k, badges[k], evaluation.metrics);
    // §0.72.3 : 風単独 (注意レベル) は「通常開催されやすい」を補足し過度に避けさせない (風 < 雨 ・ 熱)。
    if (k === 'wind' && badges.wind.text === '風バ') return `${detail} ・ 風は通常開催されることが多い`;
    return detail;
  }
  // §0.72.3 : 雨バ + 熱バ (風なし ・ どちらも厳しい要素) は要素を明示。
  if (warns.length === 2 && badges.rain?.text === '雨バ' && badges.wbgt?.text === '熱バ') {
    return '雨と熱の両方が注意';
  }
  // それ以外の複数警告は「警告 N つ (短縮名 + ...)」で直接列挙 (中止リスク/キャン等もそのまま含む)。
  const shorts = warns.map((k) => badges[k].text);
  return `警告 ${warns.length}つ (${shorts.join(' + ')})`;
}
