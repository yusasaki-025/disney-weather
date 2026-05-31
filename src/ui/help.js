// 用語集 ・ ヘルプ (§3.16 / §0.35)。モーダルで 8 セクションをタブ式に表示する。
// 開閉は main.js が制御。内容は help-content.js に集約 (固定テキスト、外部入力なし)。

import { HELP_SECTIONS } from './help-content.js';

export function helpHtml() {
  const tabs = HELP_SECTIONS.map(
    (s, i) =>
      `<button type="button" class="help-tab${i === 0 ? ' active' : ''}" role="tab" data-help-tab="${s.id}">${s.label}</button>`,
  ).join('');
  const panels = HELP_SECTIONS.map(
    (s, i) =>
      `<div class="help-panel" data-help-panel="${s.id}"${i === 0 ? '' : ' hidden'}>${s.html}</div>`,
  ).join('');
  return `<div class="help-content">
    <h2>マイハマびより の使い方</h2>
    <div class="help-tabs" role="tablist">${tabs}</div>
    <div class="help-panels">${panels}</div>
  </div>`;
}

// タブ切替を結線する (モーダルを開いて innerHTML 設定後に呼ぶ)。
export function wireHelpTabs(root) {
  root.querySelectorAll('.help-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.helpTab;
      root.querySelectorAll('.help-tab').forEach((t) => t.classList.toggle('active', t === tab));
      root.querySelectorAll('.help-panel').forEach((p) => {
        p.hidden = p.dataset.helpPanel !== id;
      });
    });
  });
}
