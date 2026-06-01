// §0.46.12 : 文字サイズ 3 段階切替 (老眼配慮)。小 = 現状サイズ (デフォルト) / 中 / 大 の
//   「上げる」方向のみ (下げる選択肢なし)。選択は localStorage に永続化する。
//
// このアプリは寸法を px ベースで持つため、:root の font-size (rem) を変えても全体は拡大しない。
// そこで html[data-font-size] に応じて CSS 側で body 全体を zoom 拡大し、文字 ・ レイアウトを
// まとめて大きくする (styles.css 参照)。data-font-size の付与だけをここで行う。

const KEY = 'fontSize';
const SIZES = ['small', 'medium', 'large'];

export function savedFontSize() {
  try {
    return localStorage.getItem(KEY) || 'small';
  } catch {
    return 'small';
  }
}

// html に data-font-size を付与し localStorage に保存。未知値は 'small' に丸める。
export function applyFontSize(size) {
  const s = SIZES.includes(size) ? size : 'small';
  document.documentElement.dataset.fontSize = s;
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* private mode 等で書けなくても表示は継続 */
  }
  return s;
}

// 起動時の復元 (index.html の head インラインで先行適用済みだが、保険として再適用)。
export function initFontSize() {
  applyFontSize(savedFontSize());
}

// ヘッダーのセグメント (小/中/大) を結線し、現在値をハイライト ・ aria-checked 同期する。
export function wireFontSizeControl(root) {
  if (!root) return;
  const buttons = [...root.querySelectorAll('[data-size]')];
  const sync = () => {
    const cur = document.documentElement.dataset.fontSize || 'small';
    for (const b of buttons) {
      const on = b.dataset.size === cur;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  };
  for (const b of buttons) {
    b.addEventListener('click', () => {
      applyFontSize(b.dataset.size);
      sync();
    });
  }
  sync();
}
