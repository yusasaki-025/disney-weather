// 用語集 ・ ヘルプ (§3.16 / §0.35)。モーダルで 8 セクションをタブ式に表示する。
// 内容は help-content.js に集約 (固定テキスト、外部入力なし)。setupHelp() が開閉 ・ タブ切替を結線。

import { HELP_SECTIONS } from './help-content.js';

function helpHtml() {
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

export function setupHelp() {
  const modal = document.getElementById('help-modal');
  const body = document.getElementById('help-body');
  body.innerHTML = helpHtml();

  // タブ切替
  body.querySelectorAll('.help-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.helpTab;
      body.querySelectorAll('.help-tab').forEach((t) => t.classList.toggle('active', t === tab));
      body.querySelectorAll('.help-panel').forEach((p) => {
        p.hidden = p.dataset.helpPanel !== id;
      });
    });
  });

  // §0.38-2 : モーダル open 中は背面スクロールをロック (sticky thead が裏に潜るのは z-index で担保済)
  const open = () => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };
  document.getElementById('btn-help').addEventListener('click', open);
  document.getElementById('help-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}
