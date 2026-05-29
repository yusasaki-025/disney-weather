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

// スコアピル HTML (アイコン → 記号 → 数値 の順、§6.3)
export function scorePillHtml(ev) {
  const s = ev.symbol;
  return `<span class="score-pill" style="background:${s.color}">
    <span class="material-symbols-rounded" aria-hidden="true">${s.icon}</span>
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

// 朝/昼/夜 サブスコア HTML。
// 時間帯ラベルを必ず併記。昼は枠 ＋ 太字 ＋ 数値併記で強調。朝 ・ 夜は記号のみ + ホバーで数値。
// アイコンは使わない (フォント未読み込み時のフォールバック問題回避)。
export function subscoreHtml(subscores, bands) {
  const ariaParts = bands.map((b) => {
    const ss = subscores[b.key];
    if (!ss || !ss.hasData) return `${b.label} データなし`;
    if (b.key === 'noon') return `${b.label} ${ss.symbol.label} スコア${ss.score}`;
    return `${b.label} ${ss.symbol.label}`;
  });
  const cells = bands.map((b) => {
    const ss = subscores[b.key];
    const has = ss && ss.hasData;
    const sym = has ? ss.symbol.symbol : '—';
    const color = has ? ss.symbol.color : '#b4bcc6';
    if (b.key === 'noon') {
      return `<span class="subscore subscore-main">
        <span class="time-label">${b.label}</span>
        <span class="symbol" style="color:${color}" aria-hidden="true">${sym}</span>
        <span class="value">${has ? ss.score : '—'}</span>
      </span>`;
    }
    const title = has ? `${b.label} ${ss.symbol.label} スコア${ss.score}` : `${b.label} データなし`;
    return `<span class="subscore" title="${esc(title)}">
      <span class="time-label">${b.label}</span>
      <span class="symbol" style="color:${color}" aria-hidden="true">${sym}</span>
    </span>`;
  });
  return `<span class="subscore-group" role="img" aria-label="${esc(ariaParts.join('、'))}">${cells.join('')}</span>`;
}

// スコアの読み上げ用ラベル
export function scoreAria(date, ev) {
  return `${formatMd(date).replace('/', '月')}日 ${weekday(date)}曜日 スコア${ev.score} ${ev.symbol.symbol} ${ev.symbol.label}`;
}
