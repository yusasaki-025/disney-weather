// ソート ・ フィルター ・ 決定日 ・ 同行者 NG 日の状態管理 (§3.5, §3.9)。
// localStorage に永続化し、リロード後も維持する。

import { logger } from '../utils/logger.js';

const STORAGE_KEY = 'disney_weather_ui_v1';

const DEFAULTS = {
  park: 'TDL',
  sortBy: 'date', // 'date' (デフォルト) | 'score' (§3.5)
  dayFilter: 'all', // 'all' | 'weekday' | 'holiday'
  onlyGood: false,
  decidedDate: null,
  ngDates: [],
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch (e) {
    logger.warn('UI 状態の読み込みに失敗', e.message);
    return { ...DEFAULTS };
  }
}

export function saveState(state) {
  try {
    const { park, sortBy, dayFilter, onlyGood, decidedDate, ngDates } = state;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ park, sortBy, dayFilter, onlyGood, decidedDate, ngDates }),
    );
  } catch (e) {
    logger.warn('UI 状態の保存に失敗', e.message);
  }
}

export function toggleNg(state, date) {
  const set = new Set(state.ngDates);
  if (set.has(date)) set.delete(date);
  else set.add(date);
  state.ngDates = [...set];
  saveState(state);
}

export function setDecided(state, date) {
  state.decidedDate = date;
  saveState(state);
}

// rows に isNg / isDecided を付け、フィルター + ソートした配列を返す
export function applyFilterSort(rows, state) {
  const ng = new Set(state.ngDates);
  let out = rows.map((r) => ({
    ...r,
    isNg: ng.has(r.date),
    isDecided: r.date === state.decidedDate,
  }));

  if (state.dayFilter === 'weekday') out = out.filter((r) => !r.dayType.isOff);
  else if (state.dayFilter === 'holiday') out = out.filter((r) => r.dayType.isOff);

  if (state.onlyGood) out = out.filter((r) => r.eval && r.eval.score >= 70);

  out.sort((a, b) => {
    if (state.sortBy === 'date') return a.date.localeCompare(b.date);
    // スコア順 (NG は末尾へ)
    if (a.isNg !== b.isNg) return a.isNg ? 1 : -1;
    return (b.eval?.score ?? -1) - (a.eval?.score ?? -1);
  });
  return out;
}

// セグメントボタン + チェックボックスの結線
export function wireControls(state, onChange) {
  const syncSeg = (segId, attr, value) => {
    document.querySelectorAll(`#${segId} .seg-btn`).forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset[attr] === value));
    });
  };

  syncSeg('sort-seg', 'sort', state.sortBy);
  syncSeg('dayfilter-seg', 'dayfilter', state.dayFilter);
  document.getElementById('only-good').checked = state.onlyGood;

  const bind = (segId, attr, key) => {
    document.querySelectorAll(`#${segId} .seg-btn`).forEach((btn) => {
      btn.addEventListener('click', () => {
        state[key] = btn.dataset[attr];
        syncSeg(segId, attr, state[key]);
        saveState(state);
        onChange();
      });
    });
  };
  bind('sort-seg', 'sort', 'sortBy');
  bind('dayfilter-seg', 'dayfilter', 'dayFilter');

  document.getElementById('only-good').addEventListener('change', (e) => {
    state.onlyGood = e.target.checked;
    saveState(state);
    onChange();
  });
}
