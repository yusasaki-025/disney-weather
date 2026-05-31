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

// 風 / 雨 / 熱 のキャンセルバッジ HTML (§0.6.6 でセル側にカテゴリアイコンを持つためバッジ内アイコンは廃止)
export function cancelBadgeHtml(badge) {
  const short = badge.text;
  const long = BADGE_LONG[short] || short;
  return `<span class="cancel-badge cancel-lv${badge.level}"><span class="badge-long">${esc(long)}</span><span class="badge-short">${esc(short)}</span></span>`;
}

// 朝/昼/夜 サブスコア HTML (§0.6.5 : 記号廃止、色付き数値ピル)。
// 背景色 = スコア帯。数値のみ表示。昼は subscore-main で少し大きく強調。未取得は灰色ピル + "-"。
export function subscoreHtml(subscores, bands) {
  // §0.38-4 : 各時間帯に時刻範囲を併記 (朝 8-11時 等)。昼は重み最大なので「最重視」表示。
  const range = (b) => (b.start != null && b.end != null ? `${b.start}-${b.end}時` : '');
  const labelHtml = (b) =>
    `<span class="time-label">${b.label}${b.key === 'noon' ? ' <span class="time-key">最重視</span>' : ''}<span class="time-range">${range(b)}</span></span>`;
  const ariaParts = bands.map((b) => {
    const ss = subscores[b.key];
    const r = range(b) ? ` (${range(b)})` : '';
    if (!ss || !ss.hasData) return `${b.label}${r} データなし`;
    return `${b.label}${r} ${ss.symbol.label} ${ss.score}`;
  });
  const cells = bands.map((b) => {
    const ss = subscores[b.key];
    const has = ss && ss.hasData;
    const main = b.key === 'noon' ? ' subscore-main' : '';
    if (!has) {
      return `<span class="subscore-pill${main}" data-level="none">${labelHtml(b)}<span class="value">-</span></span>`;
    }
    return `<span class="subscore-pill${main}" data-level="${ss.symbol.key}" style="background:${ss.symbol.color}">${labelHtml(b)}<span class="material-symbols-rounded" aria-hidden="true">${ss.symbol.icon}</span><span class="value">${ss.score}</span></span>`;
  });
  return `<span class="subscore-group" role="img" aria-label="${esc(ariaParts.join('、'))}">${cells.join('')}</span>`;
}

// スコアの読み上げ用ラベル (記号なし)
export function scoreAria(date, ev) {
  return `${formatMd(date).replace('/', '月')}日 ${weekday(date)}曜日 スコア${ev.score} ${ev.symbol.label}`;
}
