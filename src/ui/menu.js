// 狭幅 (< 768px) 用ハンバーガーメニュー / ドロワー (§0.6-3)。
// PC では非表示 (CSS)。外側タップ / Esc / 項目選択で閉じ、開いたら先頭へ focus、
// 閉じたらメニューボタンへ focus を戻す。Tab はドロワー内でトラップ。

export function setupMenu(items) {
  const btn = document.getElementById('btn-menu');
  const drawer = document.getElementById('menu-drawer');
  const overlay = document.getElementById('menu-overlay');
  if (!btn || !drawer || !overlay) return;

  drawer.innerHTML = items
    .map(
      (it, i) =>
        `<button class="menu-item" role="menuitem" data-i="${i}" type="button">
          <span class="material-symbols-rounded" aria-hidden="true">${it.icon}</span>${it.label}
        </button>`,
    )
    .join('');
  const itemEls = [...drawer.querySelectorAll('.menu-item')];

  function onKey(e) {
    if (e.key === 'Escape') {
      close(true);
      return;
    }
    if (e.key === 'Tab' && itemEls.length) {
      const first = itemEls[0];
      const last = itemEls[itemEls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function open() {
    overlay.hidden = false;
    drawer.hidden = false;
    requestAnimationFrame(() => {
      drawer.classList.add('open');
      overlay.classList.add('open');
    });
    btn.setAttribute('aria-expanded', 'true');
    itemEls[0]?.focus();
    document.addEventListener('keydown', onKey);
  }

  function close(returnFocus) {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      drawer.hidden = true;
      overlay.hidden = true;
    }, 220);
    if (returnFocus) btn.focus(); // 仕様: 閉じたらメニューボタンへ戻す
  }

  btn.addEventListener('click', () => (drawer.hidden ? open() : close(true)));
  overlay.addEventListener('click', () => close(true));
  itemEls.forEach((el, i) =>
    el.addEventListener('click', () => {
      close(false); // 選択後はアクション側へ focus を委ねる
      items[i].onClick();
    }),
  );
}
