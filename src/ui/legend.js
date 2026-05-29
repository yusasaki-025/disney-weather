// スコア凡例カード (§0.6.5)。テーブル上部に常時表示。折りたたみ可、状態は localStorage 保存。

import { SYMBOLS } from '../score/scoring.js';
import { esc } from './components.js';

const KEY = 'disney_weather_legend_open';

const DESC = {
  excellent: '風 ・ 雨 ・ 暑さ全部 OK',
  good: '軽微な注意のみ',
  fair: '風バ or 雨バ域',
  bad: '中止リスク高',
};

function isOpen() {
  try {
    const v = localStorage.getItem(KEY);
    return v == null ? true : v === '1'; // 初回は展開
  } catch {
    return true;
  }
}

function save(open) {
  try {
    localStorage.setItem(KEY, open ? '1' : '0');
  } catch {
    /* noop */
  }
}

export function renderScoreLegend(el) {
  const pills = SYMBOLS.map(
    (s) =>
      `<span class="legend-item">
        <span class="score-pill legend-pill" data-level="${s.key}" style="background:${s.color}">${esc(s.label)}</span>
        <span class="legend-desc">${esc(DESC[s.key] || '')}</span>
      </span>`,
  ).join('');

  function paint() {
    const open = isOpen();
    el.innerHTML = `
      <button class="legend-toggle" type="button" aria-expanded="${open}" aria-controls="legend-body">
        <span class="material-symbols-rounded" aria-hidden="true">${open ? 'expand_more' : 'chevron_right'}</span>
        スコアの見方
      </button>
      <div id="legend-body" class="legend-body" ${open ? '' : 'hidden'}>${pills}</div>
    `;
    el.querySelector('.legend-toggle').addEventListener('click', () => {
      save(!isOpen());
      paint();
    });
  }
  paint();
}
