// テーブルと TOP3 で共有する小さな描画ヘルパー。
import { formatMd, weekday } from '../utils/date.js';

// HTML エスケープ (API 由来テキストを innerHTML に入れる際の保険)
export function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtNum(v, digits = 0, unit = '') {
  if (v == null || Number.isNaN(v)) return '—';
  const f = 10 ** digits;
  return `${Math.round(v * f) / f}${unit}`;
}

// '6/14 (土)'
export function dateLabel(date) {
  return `${formatMd(date)} (${weekday(date)})`;
}

// スコアピル HTML
export function scorePillHtml(ev) {
  const s = ev.symbol;
  return `<span class="score-pill" style="background:${s.color}">
    <span class="marker" aria-hidden="true">${s.marker}</span>
    <span aria-hidden="true">${s.symbol}</span>
    <span>${ev.score}</span>
  </span>`;
}

const BADGE_ICON = { wind: 'air', rain: 'umbrella', wbgt: 'thermostat' };

// 風 / 雨 / 熱 のキャンセルバッジ HTML
export function cancelBadgeHtml(kind, badge) {
  const icon = BADGE_ICON[kind] || 'info';
  return `<span class="cancel-badge cancel-lv${badge.level}">
    <span class="material-symbols-rounded" aria-hidden="true">${icon}</span>${esc(badge.text)}
  </span>`;
}

// 朝/昼/夜 サブスコア HTML (昼を強調)
export function subscoreHtml(subscores, bands) {
  return `<span class="subscore">${bands
    .map((b) => {
      const ss = subscores[b.key];
      const sym = ss && ss.hasData ? ss.symbol.symbol : '—';
      const color = ss && ss.hasData ? ss.symbol.color : '#b4bcc6';
      const strong = b.key === 'noon' ? 'font-weight:700' : '';
      return `<span class="ss"><span class="lbl" style="${strong}">${b.label}</span><span class="sym" style="color:${color}">${sym}</span></span>`;
    })
    .join('')}</span>`;
}

// スコアの読み上げ用ラベル
export function scoreAria(date, ev) {
  return `${formatMd(date).replace('/', '月')}日 ${weekday(date)}曜日 スコア${ev.score} ${ev.symbol.symbol} ${ev.symbol.label}`;
}
