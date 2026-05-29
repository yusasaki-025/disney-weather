// localStorage ベースのソース別キャッシュ。TTL 10 分。
// 1 回の fetch で全 15 日分が返るので、ソース単位でまとめてキャッシュする。

import { nowIso, ageMs } from './date.js';
import { logger } from './logger.js';

const PREFIX = 'disney_weather_cache_v1_';
export const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 分

function key(source) {
  return `${PREFIX}${source}`;
}

// localStorage が無い環境 (テスト等) でも落ちないようにガード
function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

// { data, fetchedAt } を保存
export function saveCache(source, data) {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(key(source), JSON.stringify({ data, fetchedAt: nowIso() }));
  } catch (e) {
    logger.warn('cache 保存に失敗', source, e);
  }
}

// 保存済みエントリを返す ({ data, fetchedAt } | null)。TTL 判定はしない。
export function loadCacheRaw(source) {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(key(source));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    logger.warn('cache 読み込みに失敗', source, e);
    return null;
  }
}

// TTL 内なら data を返す。期限切れ / 無しなら null。
export function loadCacheFresh(source, ttlMs = DEFAULT_TTL_MS) {
  const entry = loadCacheRaw(source);
  if (!entry) return null;
  if (ageMs(entry.fetchedAt) > ttlMs) return null;
  return entry.data;
}

export function clearCache(source) {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(key(source));
  } catch {
    /* noop */
  }
}
