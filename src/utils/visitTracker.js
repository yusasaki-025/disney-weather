// 訪問回数 ・ バナー再表示時刻の管理 (§0.34)。localStorage に永続化する。

const VISIT_KEY = 'visitCount';
const DISMISS_KEY = 'pwaBannerDismissedUntil';

// 訪問回数を +1 して返す (起動時に 1 回だけ呼ぶ想定)
export function incrementVisit() {
  let n = 0;
  try {
    n = Number(localStorage.getItem(VISIT_KEY)) || 0;
    n += 1;
    localStorage.setItem(VISIT_KEY, String(n));
  } catch {
    /* localStorage 不可環境では 0 のまま */
  }
  return n;
}

export function getVisitCount() {
  try {
    return Number(localStorage.getItem(VISIT_KEY)) || 0;
  } catch {
    return 0;
  }
}

// バナーが今表示してよいか (dismissedUntil 未設定 or 過去なら true)
export function canShowBanner(now = Date.now()) {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY)) || 0;
    return until < now;
  } catch {
    return true;
  }
}

// days 日後まで非表示にする。days を省略すると「永続」(遠い未来)。
export function dismissBanner(days, now = Date.now()) {
  try {
    const until = days == null ? Number.MAX_SAFE_INTEGER : now + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
  } catch {
    /* 保存できなくても致命的でない */
  }
}
