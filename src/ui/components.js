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

// スコアピル HTML (§0.6.5 テキスト + §0.18 評価アイコン併用)
export function scorePillHtml(ev) {
  const s = ev.symbol;
  return `<span class="score-pill" data-level="${s.key}" style="background:${s.color}">
    <span class="material-symbols-rounded" aria-hidden="true">${s.icon}</span><span class="label">${s.label}</span><span class="value">${ev.score}</span>
  </span>`;
}

// 風 / 雨 / 熱 のキャンセルバッジ HTML (§0.6.6 でセル側にカテゴリアイコンを持つためバッジ内アイコンは廃止)
export function cancelBadgeHtml(badge) {
  return `<span class="cancel-badge cancel-lv${badge.level}">${esc(badge.text)}</span>`;
}

// 朝/昼/夜 サブスコア HTML (§0.6.5 : 記号廃止、色付き数値ピル)。
// 背景色 = スコア帯。数値のみ表示。昼は subscore-main で少し大きく強調。未取得は灰色ピル + "-"。
export function subscoreHtml(subscores, bands) {
  const ariaParts = bands.map((b) => {
    const ss = subscores[b.key];
    if (!ss || !ss.hasData) return `${b.label} データなし`;
    return `${b.label} ${ss.symbol.label} ${ss.score}`;
  });
  const cells = bands.map((b) => {
    const ss = subscores[b.key];
    const has = ss && ss.hasData;
    const main = b.key === 'noon' ? ' subscore-main' : '';
    if (!has) {
      return `<span class="subscore-pill${main}" data-level="none"><span class="time-label">${b.label}</span><span class="value">-</span></span>`;
    }
    return `<span class="subscore-pill${main}" data-level="${ss.symbol.key}" style="background:${ss.symbol.color}"><span class="time-label">${b.label}</span><span class="material-symbols-rounded" aria-hidden="true">${ss.symbol.icon}</span><span class="value">${ss.score}</span></span>`;
  });
  return `<span class="subscore-group" role="img" aria-label="${esc(ariaParts.join('、'))}">${cells.join('')}</span>`;
}

// スコアの読み上げ用ラベル (記号なし)
export function scoreAria(date, ev) {
  return `${formatMd(date).replace('/', '月')}日 ${weekday(date)}曜日 スコア${ev.score} ${ev.symbol.label}`;
}
