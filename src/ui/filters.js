// フィルター ・ ソートの状態管理 (§3.5)。localStorage に永続化し、リロード後も維持する。
// 決定日 ・ 同行者 NG は §0.21 で廃止。

import { logger } from '../utils/logger.js';

const STORAGE_KEY = 'disney_weather_ui_v1';

const DEFAULTS = {
  park: 'TDL',
  sortBy: 'date', // 'date' (デフォルト) | 'score' (§3.5)
  dayFilter: 'all', // 'all' | 'weekday' | 'holiday'
  onlyGood: false,
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
    const { park, sortBy, dayFilter, onlyGood } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ park, sortBy, dayFilter, onlyGood }));
  } catch (e) {
    logger.warn('UI 状態の保存に失敗', e.message);
  }
}

// フィルター + ソートした配列を返す
export function applyFilterSort(rows, state) {
  let out = rows.slice();

  if (state.dayFilter === 'weekday') out = out.filter((r) => !r.dayType.isOff);
  else if (state.dayFilter === 'holiday') out = out.filter((r) => r.dayType.isOff);

  if (state.onlyGood) out = out.filter((r) => r.eval && r.eval.score >= 70);

  out.sort((a, b) => {
    if (state.sortBy === 'date') return a.date.localeCompare(b.date);
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
  const onlyGood = document.getElementById('only-good');
  onlyGood.checked = state.onlyGood;
  // 塗りつぶしトグルの ON クラス (:has 非対応環境でも確実に効かせる)
  onlyGood.closest('.check')?.classList.toggle('is-on', state.onlyGood);

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

  onlyGood.addEventListener('change', (e) => {
    state.onlyGood = e.target.checked;
    e.target.closest('.check')?.classList.toggle('is-on', state.onlyGood);
    saveState(state);
    onChange();
  });
}
