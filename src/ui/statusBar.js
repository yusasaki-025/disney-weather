// ステータスバー (§0.6-4)。鮮度をソース別に 1 か所へ集約 (各セルの鮮度ラベルは廃止)。
// 「JMA 24分前 ･ Open-Meteo 18分前 [キャッシュ表示中] [強制更新]」をテーブル上部に出す。

import { esc } from './components.js';
import { freshnessLabel, UPDATE_CYCLE } from '../utils/freshness.js';

const SOURCE_LABEL = { jma: '気象庁', 'open-meteo': 'Open-Meteo', openweather: 'OpenWeather' };

// そのソースの全日分のうち最も古い取得時刻 (バッチ全体の鮮度)
function oldestFetchedAt(byDate) {
  let oldest = null;
  for (const f of Object.values(byDate || {})) {
    if (f.fetchedAt && (oldest == null || f.fetchedAt < oldest)) oldest = f.fetchedAt;
  }
  return oldest;
}

export function renderStatusBar(el, { sources, sourceStatus, rawBySourceDate, onRefresh, loading }) {
  if (loading) {
    el.innerHTML = '<span class="sb-loading">予報を取得しています…</span>';
    return;
  }
  const parts = sources.map((s) => {
    const st = sourceStatus[s] || {};
    if (!st.ok) return `<span class="sb-src sb-fail">${SOURCE_LABEL[s]} 取得失敗</span>`;
    const fresh = freshnessLabel(oldestFetchedAt(rawBySourceDate[s]));
    return `<span class="sb-src" title="${esc(UPDATE_CYCLE[s] || '')}">${SOURCE_LABEL[s]} <b>${fresh}</b></span>`;
  });
  const allCached =
    sources.length > 0 && sources.every((s) => sourceStatus[s]?.cached || sourceStatus[s]?.stale);
  const anyStale = sources.some((s) => sourceStatus[s]?.stale);
  const cachePill = allCached
    ? `<span class="sb-cache">${anyStale ? 'オフライン ・ キャッシュ表示中' : 'キャッシュ表示中'}</span>`
    : '';

  el.innerHTML = `
    <span class="sb-srcs">${parts.join('<span class="sb-dot" aria-hidden="true">･</span>')}</span>
    ${cachePill}
    <button type="button" class="btn sb-refresh">
      <span class="material-symbols-rounded" aria-hidden="true">refresh</span>強制更新
    </button>
  `;
  el.querySelector('.sb-refresh').addEventListener('click', onRefresh);
}
