// ダークモード (§6.6)。既定は OS 設定 (prefers-color-scheme) に追従。
// ヘッダーのトグルで明示的に light / dark を上書きし、localStorage に保存する。

import { logger } from '../utils/logger.js';

const KEY = 'disney_weather_theme'; // 'light' | 'dark' | 未設定(=OS追従)

function stored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function save(value) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch (e) {
    logger.warn('テーマ保存に失敗', e.message);
  }
}

function prefersDark() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

// 実効テーマ ('light' | 'dark')
function effective() {
  return stored() || (prefersDark() ? 'dark' : 'light');
}

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('btn-theme');
  if (btn) {
    const icon = btn.querySelector('.material-symbols-rounded');
    if (icon) icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    btn.setAttribute('aria-label', theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替');
  }
}

export function setupTheme() {
  apply(effective());
  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = effective() === 'dark' ? 'light' : 'dark';
      save(next);
      apply(next);
    });
  }
  // OS 設定変更に追従 (明示設定が無いときのみ)
  if (typeof matchMedia !== 'undefined') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!stored()) apply(effective());
    });
  }
}
