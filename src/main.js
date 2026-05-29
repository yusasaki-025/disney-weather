// エントリポイント : 取得 → 正規化 → スコア → 描画 → イベント結線。
import './styles.css';
import { candidateDates, todayJst } from './utils/date.js';
import { loadCacheFresh, loadCacheRaw, saveCache } from './utils/cache.js';
import { setupTheme } from './ui/theme.js';
import { setupHelp } from './ui/help.js';
import { setupPrint } from './ui/print.js';
import { setupMenu } from './ui/menu.js';
import { renderStatusBar } from './ui/statusBar.js';
import { renderScoreLegend } from './ui/legend.js';
import { logger } from './utils/logger.js';
import { fetchJma, SOURCE_ID as JMA } from './data/jma.js';
import { fetchOpenMeteo, SOURCE_ID as OM } from './data/openMeteo.js';
import { fetchOpenWeather, SOURCE_ID as OW } from './data/openWeather.js';
import { fetchEnvWbgt, WBGT_SOURCE } from './data/wbgt.js';
import { dayType } from './data/holidays.js';
import { evaluateDay } from './score/scoring.js';
import { renderTop3 } from './ui/top3.js';
import { renderTable, renderLegend } from './ui/table.js';
import { loadState, applyFilterSort, wireControls, toggleNg, setDecided } from './ui/filters.js';
import { sendCandidatesToNotion, markDecidedInNotion, isNotionConfigured } from './integrations/notion.js';
import { addToCalendar, confirmText } from './integrations/gcal.js';
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
  status: document.getElementById('status-bar'),
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
      eval: list.length ? evaluateDay(list, state.park) : null,
    });
  }
  return rows.filter((r) => r.eval); // 全ソース欠損日は除外 (通常は起きない)
}

function updateStatus() {
  renderStatusBar(els.status, {
    sources: activeSources,
    sourceStatus,
    rawBySourceDate,
    onRefresh: () => refresh(true),
  });
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
  const ngSet = new Set(state.ngDates);
  const rowsWithFlags = rows.map((r) => ({
    ...r,
    isNg: ngSet.has(r.date),
    isDecided: r.date === state.decidedDate,
  }));

  renderTop3(els.top3, rowsWithFlags, { onSelect: openByDate, park: state.park });
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

// --- 詳細パネル内アクション ---
const handlers = {
  onDecide(date) {
    setDecided(state, date);
    render();
    if (!isNotionConfigured()) return; // DB 未設定なら自動送信しない
    const row = buildRows().find((r) => r.date === date);
    if (row) {
      markDecidedInNotion({ ...row, isDecided: true }, state.park).catch((e) =>
        alert(`Notion 更新に失敗 : ${e.message}`),
      );
    }
  },
  onToggleNg(date) {
    toggleNg(state, date);
    render();
  },
  async onCalendar(date) {
    const rows = buildRows();
    const row = rows.find((r) => r.date === date);
    if (!row) return;
    if (!confirm(confirmText(row, state.park))) return;
    try {
      await addToCalendar(row, state.park);
      alert('Google カレンダーに追加しました');
    } catch (e) {
      alert(`カレンダー登録に失敗 : ${e.message}`);
    }
  },
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
  renderStatusBar(els.status, { loading: true });
}

function setupHeader() {
  document.getElementById('btn-refresh').addEventListener('click', () => refresh(true));
  document.getElementById('btn-retry-all').addEventListener('click', () => refresh(true));

  document.getElementById('btn-notion').addEventListener('click', async () => {
    const rows = applyFilterSort(buildRows(), state);
    try {
      const res = await sendCandidatesToNotion(rows, state.park);
      alert(`Notion に候補を送信しました (${res?.length ?? ''})`);
    } catch (e) {
      alert(`Notion 送信に失敗 : ${e.message}`);
    }
  });

  document.getElementById('btn-qr').addEventListener('click', showQr);
  document.getElementById('qr-close').addEventListener('click', () => {
    document.getElementById('qr-modal').hidden = true;
  });
  document.getElementById('qr-modal').addEventListener('click', (e) => {
    if (e.target.id === 'qr-modal') e.currentTarget.hidden = true;
  });
}

function showQr() {
  const box = document.getElementById('qr-canvas');
  box.innerHTML = '';
  try {
    // eslint-disable-next-line no-undef
    const qr = qrcode(0, 'M');
    qr.addData(window.location.href);
    qr.make();
    box.innerHTML = qr.createImgTag(5, 8);
  } catch {
    box.textContent = window.location.href;
  }
  document.getElementById('qr-modal').hidden = false;
}

// --- 起動 ---
async function copyUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    alert('URL をコピーしました');
  } catch {
    alert(window.location.href);
  }
}

// 狭幅用ドロワーの項目 (ヘッダーボタンへ委譲 ＋ 一部は直接処理)
function buildMenuItems() {
  const click = (id) => document.getElementById(id)?.click();
  return [
    { label: 'URL をコピー', icon: 'content_copy', onClick: copyUrl },
    { label: 'QR を表示', icon: 'qr_code_2', onClick: () => click('btn-qr') },
    { label: 'Notion 送信', icon: 'ios_share', onClick: () => click('btn-notion') },
    {
      label: 'カレンダー登録',
      icon: 'calendar_add_on',
      onClick: () => {
        if (!state.decidedDate) {
          alert('先に行を開いて「この日に決めた」で決定日を選んでください');
          return;
        }
        handlers.onCalendar(state.decidedDate);
      },
    },
    { label: '印刷', icon: 'print', onClick: () => click('btn-print') },
    { label: '強制更新', icon: 'refresh', onClick: () => refresh(true) },
    { label: 'ダークモード切替', icon: 'dark_mode', onClick: () => click('btn-theme') },
    { label: '用語集 / ヘルプ', icon: 'help', onClick: () => click('btn-help') },
    {
      label: '出典 ・ 注意書き',
      icon: 'info',
      onClick: () => document.querySelector('.disclaimer')?.scrollIntoView({ behavior: 'smooth' }),
    },
  ];
}

async function init() {
  setupHeader();
  setupTheme();
  setupHelp();
  setupPrint({ getDecidedDate: () => state.decidedDate, openDetail: openByDate });
  setupMenu(buildMenuItems());
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
