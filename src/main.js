// エントリポイント : 取得 → 正規化 → スコア → 描画 → イベント結線。
import './styles.css';
import { candidateDates, todayJst } from './utils/date.js';
import { loadCacheFresh, loadCacheRaw, saveCache } from './utils/cache.js';
import { setupHelp } from './ui/help.js';
import { renderScoreLegend } from './ui/legend.js';
import { freshnessLabel, UPDATE_CYCLE } from './utils/freshness.js';
import { logger } from './utils/logger.js';
import { fetchJma, SOURCE_ID as JMA } from './data/jma.js';
import { fetchOpenMeteo, SOURCE_ID as OM } from './data/openMeteo.js';
import { fetchOpenWeather, SOURCE_ID as OW } from './data/openWeather.js';
import { fetchEnvWbgt, WBGT_SOURCE } from './data/wbgt.js';
import { dayType } from './data/holidays.js';
import { evaluateDay } from './score/scoring.js';
import { renderTop3 } from './ui/top3.js';
import { renderTable, renderLegend } from './ui/table.js';
import { loadState, applyFilterSort, wireControls } from './ui/filters.js';
import { LOCATION } from './config/location.js';

const CONFIG = {
  coords: LOCATION.coords, // 舞浜駅近辺 (TDL/TDS 共通、§3.13)
  openWeatherProxyUrl: '', // 設定すると OpenWeather 列が有効化 (Phase 2)
  days: 15,
};

const state = loadState();
let rawBySourceDate = {}; // { source: { date: forecast } }
const sourceStatus = {}; // { source: { ok, error, stale, fetchedAt } }
let activeSources = [JMA, OM];

const els = {
  thead: document.querySelector('#forecast-table thead'),
  tbody: document.querySelector('#forecast-table tbody'),
  top3: document.getElementById('top3'),
  legend: document.getElementById('legend'),
  errorScreen: document.getElementById('error-screen'),
};

// --- データ取得 (キャッシュ + 失敗時 stale フォールバック) ---
async function loadSource(source, fetchFn, force) {
  if (!force) {
    const fresh = loadCacheFresh(source);
    if (fresh) {
      sourceStatus[source] = { ok: true, cached: true };
      return fresh;
    }
  }
  const data = await fetchFn();
  if (data.length > 0) {
    saveCache(source, data);
    sourceStatus[source] = { ok: true };
    return data;
  }
  const stale = loadCacheRaw(source);
  if (stale) {
    sourceStatus[source] = { ok: true, stale: true, fetchedAt: stale.fetchedAt };
    return stale.data;
  }
  sourceStatus[source] = { ok: false, error: '取得失敗' };
  return [];
}

function indexByDate(list) {
  const map = {};
  for (const f of list) map[f.date] = f;
  return map;
}

// 環境省 WBGT が取れた場合、日別最大を上書き (取れなければ派生計算のまま)
function applyEnvWbgt(envWbgt) {
  if (!envWbgt) return;
  const omByDate = rawBySourceDate[OM] || {};
  for (const [date, info] of Object.entries(envWbgt)) {
    const f = omByDate[date];
    if (f && info.wbgtMax != null) {
      f.wbgtMax = info.wbgtMax;
      f.wbgtSource = WBGT_SOURCE.ENV_JP;
    }
  }
}

async function loadAll(force = false) {
  activeSources = [JMA, OM];
  if (CONFIG.openWeatherProxyUrl) activeSources.push(OW);

  const tasks = [
    loadSource(JMA, () => fetchJma(), force),
    loadSource(OM, () => fetchOpenMeteo(CONFIG.coords), force),
  ];
  if (CONFIG.openWeatherProxyUrl) {
    tasks.push(loadSource(OW, () => fetchOpenWeather(CONFIG.coords, { proxyUrl: CONFIG.openWeatherProxyUrl }), force));
  }
  const results = await Promise.all(tasks);

  rawBySourceDate = {};
  activeSources.forEach((src, i) => {
    rawBySourceDate[src] = indexByDate(results[i]);
  });

  // WBGT 優先ソース (環境省) を試行 (CORS で失敗したら派生計算のまま)
  try {
    applyEnvWbgt(await fetchEnvWbgt());
  } catch (e) {
    logger.info('環境省 WBGT スキップ', e.message);
  }
}

// --- 行の組み立て (park でスコアが変わるので描画時に都度計算) ---
function buildRows() {
  const dates = candidateDates(CONFIG.days, todayJst());
  const rows = [];
  for (const date of dates) {
    const forecasts = {};
    const list = [];
    for (const src of activeSources) {
      const f = rawBySourceDate[src]?.[date];
      if (f) {
        forecasts[src] = f;
        list.push(f);
      }
    }
    rows.push({
      date,
      dayType: dayType(date),
      forecasts,
      eval: list.length ? evaluateDay(list, state.park, date) : null,
    });
  }
  return rows.filter((r) => r.eval); // 全ソース欠損日は除外 (通常は起きない)
}

// ヘッダー「更新」ボタンに鮮度を集約 (§0.13.3。旧ステータスバーは廃止)。
function oldestFetchedAt(byDate) {
  let oldest = null;
  for (const f of Object.values(byDate || {})) {
    if (f.fetchedAt && (oldest == null || f.fetchedAt < oldest)) oldest = f.fetchedAt;
  }
  return oldest;
}

function updateStatus() {
  const label = document.getElementById('refresh-label');
  const btn = document.getElementById('btn-refresh');
  if (!label || !btn) return;

  const SRC = { jma: '気象庁', 'open-meteo': 'Open-Meteo', openweather: 'OpenWeather' };
  // 全ソースのうち最も古い鮮度をボタンに出す
  let oldest = null;
  const detail = [];
  let anyCached = false;
  let allFail = activeSources.length > 0;
  for (const s of activeSources) {
    const st = sourceStatus[s] || {};
    if (st.ok) allFail = false;
    if (st.cached || st.stale) anyCached = true;
    const fa = oldestFetchedAt(rawBySourceDate[s]);
    if (fa && (oldest == null || fa < oldest)) oldest = fa;
    detail.push(st.ok ? `${SRC[s]} ${freshnessLabel(fa)}` : `${SRC[s]} 取得失敗`);
    if (UPDATE_CYCLE[s]) detail.push(UPDATE_CYCLE[s]);
  }
  // WBGT ソース (環境省 / 簡易計算) も title に格下げ表示
  let wbgtSrc = null;
  for (const byDate of Object.values(rawBySourceDate || {})) {
    for (const f of Object.values(byDate || {})) {
      if (f.wbgtSource === 'env-jp') wbgtSrc = 'env-jp';
      else if (f.wbgtSource === 'derived' && !wbgtSrc) wbgtSrc = 'derived';
    }
    if (wbgtSrc === 'env-jp') break;
  }
  if (wbgtSrc) detail.push(wbgtSrc === 'env-jp' ? 'WBGT 環境省' : 'WBGT 簡易計算');

  const fresh = freshnessLabel(oldest);
  label.textContent = allFail ? '更新' : fresh ? `更新 ・ ${fresh}` : '更新';
  btn.title = detail.join(' ・ ');
  btn.classList.toggle('is-cached', anyCached && !allFail);
}

// --- 描画 ---
function render() {
  const rows = buildRows();
  const allFailed = activeSources.every((s) => !sourceStatus[s]?.ok) && rows.length === 0;
  els.errorScreen.hidden = !allFailed;
  document.getElementById('table-section').hidden = allFailed;
  document.getElementById('top3-section').hidden = allFailed;
  if (allFailed) {
    updateStatus();
    return;
  }

  const view = applyFilterSort(rows, state);
  renderTop3(els.top3, rows, { onSelect: openByDate });
  renderTable(els, view, state, activeSources, sourceStatus, handlers);
  renderLegend(els.legend);
  updateStatus();
}

function openByDate(date) {
  const tr = els.tbody.querySelector(`.row-main[data-date="${date}"]`);
  if (tr) {
    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tr.click();
  }
}

// --- テーブルのハンドラ (§0.21 で決定/NG は廃止、再試行のみ) ---
const handlers = {
  onRetryAll() {
    refresh(true);
  },
};

// --- ヘッダーボタン ---
async function refresh(force, silent = false) {
  if (!silent) renderSkeleton();
  await loadAll(force);
  render();
}

// 60秒自動更新 (§6.7) : 非アクティブ時は停止、キャッシュ TTL 超過時のみ実 fetch
function silentTick() {
  if (document.hidden) return;
  const stale = activeSources.some((s) => loadCacheFresh(s) == null);
  if (stale) refresh(false, true);
}

function renderSkeleton() {
  els.thead.innerHTML = '';
  els.tbody.innerHTML = Array.from({ length: 8 })
    .map(
      () =>
        `<tr><td colspan="8" style="padding:12px"><span class="skeleton" style="width:80%"></span></td></tr>`,
    )
    .join('');
  const label = document.getElementById('refresh-label');
  if (label) label.textContent = '取得中…';
}

function setupHeader() {
  document.getElementById('btn-refresh').addEventListener('click', () => refresh(true));
  document.getElementById('btn-retry-all').addEventListener('click', () => refresh(true));

}

async function init() {
  setupHeader();
  setupHelp();
  renderScoreLegend(document.getElementById('score-legend'));
  wireControls(state, render);
  renderSkeleton();
  await loadAll(false);
  render();
  // 60秒自動更新 (§6.7)
  setInterval(silentTick, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) silentTick();
  });
}

init();
