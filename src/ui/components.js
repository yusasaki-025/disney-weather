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

// §0.37-1 : バッジは PC で長文 ・ スマホで短縮 (CSS @media で .badge-long/.badge-short 切替)。
// badge.text は短縮形 (§0.36)。長文はここで対応付ける。
const BADGE_LONG = {
  通常: '通常',
  風バ: '風バ可能性あり',
  中止リスク: '中止リスク高',
  中止: 'ほぼ中止',
  雨バ: '雨バ可能性',
  雨キャン: '雨キャン濃厚',
  熱バ: '熱バ可能性あり',
  熱キャン: '熱キャン濃厚',
  '—': '—',
};

// 風 / 雨 / 熱 のキャンセルバッジ HTML。
// §0.39.10 (#28) : 色覚多様性対応。警告レベル (lv≥1) に severity アイコンを併用し、
//   色のみに依存せず警戒度を判別できるようにする (lv0 通常はクリーン維持 ・ 縦線は使わない)。
const BADGE_ICON = { 1: 'warning', 2: 'priority_high', 3: 'block' };
export function cancelBadgeHtml(badge) {
  const short = badge.text;
  const long = BADGE_LONG[short] || short;
  const icon = BADGE_ICON[badge.level];
  const iconHtml = icon
    ? `<span class="material-symbols-rounded badge-icon" aria-hidden="true">${icon}</span>`
    : '';
  return `<span class="cancel-badge cancel-lv${badge.level}">${iconHtml}<span class="badge-long">${esc(long)}</span><span class="badge-short">${esc(short)}</span></span>`;
}

// 朝/昼/夜 サブスコア HTML (§0.64.3 : 案A シンプル縦並び)。
// 「理由 : ...」行 + 時間帯ごとに「朝 9-12時  50  ⚠ FAIR」を 1 行ずつ並べる。昼に「← 最重視」。
// 日全体スコアは見出し側 (table.js h4) に併記するため、ここでは内訳のみ描く。dayEval は aria 用。
export function subscoreHtml(subscores, bands, _dayEval = null, reasonText = '') {
  // §0.38-4 : 各時間帯に時刻範囲を併記 (朝 9-12時 等)。BANDS は hours (Set) を持つ。
  const range = (b) => {
    if (!b.hours || b.hours.size === 0) return '';
    const hs = [...b.hours];
    return `${Math.min(...hs)}-${Math.max(...hs) + 1}時`;
  };
  const ariaParts = bands.map((b) => {
    const ss = subscores[b.key];
    const r = range(b) ? ` (${range(b)})` : '';
    if (!ss || !ss.hasData) return `${b.label}${r} データなし`;
    return `${b.label}${r} ${ss.symbol.label} ${ss.score}`;
  });
  // §0.64.3 : 各時間帯を 1 行に (時刻 / 点 / 評価バッジ / 最重視マーク)。
  const rows = bands.map((b) => {
    const ss = subscores[b.key];
    const has = ss && ss.hasData;
    const isNoon = b.key === 'noon';
    const noonMark = isNoon ? '<span class="ss-row-key">← 最重視</span>' : '';
    const timeHtml = `<span class="ss-row-time">${b.label}<span class="ss-row-range">${range(b)}</span></span>`;
    if (!has) {
      return `<li class="ss-row${isNoon ? ' ss-row-main' : ''}" data-level="none">${timeHtml}<span class="ss-row-score">-</span><span class="ss-row-badge">データなし</span>${noonMark}</li>`;
    }
    const c = ss.symbol.color;
    return `<li class="ss-row${isNoon ? ' ss-row-main' : ''}" data-level="${ss.symbol.key}">${timeHtml}<span class="ss-row-score" style="color:${c}">${ss.score}</span><span class="ss-row-badge" style="color:${c}"><span class="material-symbols-rounded" aria-hidden="true">${ss.symbol.icon}</span>${esc(ss.symbol.label)}</span>${noonMark}</li>`;
  });
  const reasonHtml = reasonText
    ? `<p class="score-reason-line"><span class="srl-key">理由</span><span class="srl-val">${esc(reasonText)}</span></p>`
    : '';
  return `<div class="subscore-block">${reasonHtml}<ul class="ss-rows" role="img" aria-label="${esc(ariaParts.join('、'))}">${rows.join('')}</ul></div>`;
}

// スコアの読み上げ用ラベル (記号なし)
export function scoreAria(date, ev) {
  return `${formatMd(date).replace('/', '月')}日 ${weekday(date)}曜日 スコア${ev.score} ${ev.symbol.label}`;
}
