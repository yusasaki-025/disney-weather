// スコア凡例 (§0.6.5)。テーブル下部に常時表示 (折りたたみは廃止 = 閉じる利点が無いため)。

import { SYMBOLS } from '../score/scoring.js';
import { esc } from './components.js';

const DESC = {
  excellent: '風 ・ 雨 ・ 暑さ全部 OK',
  good: '軽微な注意のみ',
  fair: '風バ or 雨バ域',
  bad: '中止リスク高',
};
// ラベルが短くなった (ベスト / OK) ので、行ける日 = ベスト + OK と凡例で補足


export function renderScoreLegend(el) {
  const pills = SYMBOLS.map(
    (s) =>
      `<span class="legend-item">
        <span class="score-pill legend-pill" data-level="${s.key}" style="background:${s.color}"><span class="material-symbols-rounded" aria-hidden="true">${s.icon}</span>${esc(s.label)}</span>
        <span class="legend-desc">${esc(DESC[s.key] || '')}</span>
      </span>`,
  ).join('');
  el.innerHTML = `
    <div class="legend-head"><span class="material-symbols-rounded" aria-hidden="true">info</span>スコアの見方</div>
    <div class="legend-body">${pills}</div>
  `;
}
