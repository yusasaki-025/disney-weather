// iOS PWA インストール促進バナー (§0.34)。
// iOS Safari ・ 非 PWA ・ 訪問 2 回以上 ・ 未 dismiss のときだけ画面下部に出す。
// 「ホーム画面に追加」手順は iOS Safari 固有なのでモーダルで案内する。

import { incrementVisit, canShowBanner, dismissBanner } from '../utils/visitTracker.js';

// iOS Safari か判定 (iOS Chrome/Firefox/Edge は共有シートからの追加が異なるため除外)。
function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) ||
    // iPadOS 13+ は Mac を名乗るのでタッチ有無で補足
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  // Safari 以外の iOS ブラウザは UA に CriOS/FxiOS/EdgiOS を含む
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
  return /Safari/.test(ua);
}

// 既に PWA (ホーム画面から起動) で動いているか
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari は navigator.standalone
    window.navigator.standalone === true
  );
}

function bannerHtml() {
  return `<div class="install-banner" role="region" aria-label="アプリのインストール案内">
    <span class="install-banner-text">アプリのように使えます</span>
    <button type="button" class="install-banner-add" id="install-add">ホーム画面に追加 ›</button>
    <button type="button" class="install-banner-close" id="install-close" aria-label="閉じる">
      <span class="material-symbols-rounded" aria-hidden="true">close</span>
    </button>
  </div>`;
}

function modalHtml() {
  return `<div class="install-modal" id="install-modal" hidden>
    <div class="install-modal-card" role="dialog" aria-modal="true" aria-label="ホーム画面に追加する方法">
      <h2>ホーム画面に追加する方法 (iPhone Safari)</h2>
      <ol>
        <li>画面下部の共有ボタン (□↑) をタップ</li>
        <li>「ホーム画面に追加」を選ぶ</li>
        <li>「追加」をタップ</li>
      </ol>
      <div class="install-modal-actions">
        <button type="button" class="btn" id="install-never">もう表示しない</button>
        <button type="button" class="btn btn-primary" id="install-modal-close">閉じる</button>
      </div>
    </div>
  </div>`;
}

// バナーを初期化する。条件を満たさなければ何もしない。
export function initInstallBanner(now = Date.now()) {
  const visits = incrementVisit();
  if (!isIosSafari() || isStandalone() || visits < 2 || !canShowBanner(now)) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = bannerHtml() + modalHtml();
  document.body.appendChild(wrap);

  const banner = wrap.querySelector('.install-banner');
  const modal = wrap.querySelector('#install-modal');
  const removeBanner = () => banner.remove();

  wrap.querySelector('#install-add').addEventListener('click', () => {
    modal.hidden = false;
  });
  wrap.querySelector('#install-close').addEventListener('click', () => {
    dismissBanner(7, now); // 1 週間非表示
    removeBanner();
  });
  wrap.querySelector('#install-modal-close').addEventListener('click', () => {
    modal.hidden = true;
  });
  wrap.querySelector('#install-never').addEventListener('click', () => {
    dismissBanner(null, now); // 永続非表示
    modal.hidden = true;
    removeBanner();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.hidden = true;
  });
}

// テスト用に内部判定を公開
export const _internal = { isIosSafari, isStandalone };
