// 雨雲レーダー (§3.18)。気象庁ナウキャストは frame-ancestors CSP で埋め込み不可のため、
// 直リンクカードで提供する (§3.18「直リンク」「新規タブ遷移ボタンに切替」に準拠)。
// 当日 ・ 前日のみ意味があるので、それ以外は非表示。

import { todayJst, addDays } from '../utils/date.js';

const NOWCAST_URL = 'https://www.jma.go.jp/bosai/nowc/';

export function nowcastHtml(date) {
  const today = todayJst();
  if (date !== today && date !== addDays(today, 1)) return '';
  return `<div class="nowcast">
    <h3>雨雲レーダー (ナウキャスト)</h3>
    <a class="nowcast-card" href="${NOWCAST_URL}" target="_blank" rel="noopener">
      <span class="material-symbols-rounded" aria-hidden="true">radar</span>
      <span class="nowcast-text">
        <span class="nowcast-title">気象庁ナウキャストで雨雲の動きを見る</span>
        <span class="nowcast-sub">当日の降り出し ・ 雨雲の接近を直前チェック (新しいタブで開きます)</span>
      </span>
      <span class="material-symbols-rounded" aria-hidden="true">open_in_new</span>
    </a>
  </div>`;
}
