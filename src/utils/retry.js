// ネットワーク fetch の指数バックオフ付きリトライ (§9.1)。
// 既定: 2 回までリトライ、待機 500ms / 1500ms。

import { logger } from './logger.js';

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function withRetry(fn, { retries = 2, delays = [500, 1500], label = 'fetch' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        const wait = delays[attempt] ?? delays[delays.length - 1] ?? 500;
        logger.warn(`${label} 失敗 (試行 ${attempt + 1}/${retries + 1})、${wait}ms 後に再試行`, e.message);
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}
