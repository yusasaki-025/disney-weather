// 予報スナップショット保存 (§0.29 / Phase 2 第4弾 Stage 1)。
// 既存 fetch (jma / openMeteo / wbgt) を流用し、その日時点の予報を
// src/data/forecast-snapshots/{YYYY-MM-DD}.json に保存する。翌日 track-accuracy.mjs が読む。
//
// 使い方: npm run snapshot-forecast   (今日)
// 運用  : 毎朝 1 回 (Phase 3 で GitHub Actions cron 化)。

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJma } from '../src/data/jma.js';
import { fetchOpenMeteo } from '../src/data/openMeteo.js';
import { fetchEnvWbgt } from '../src/data/wbgt.js';
import { LOCATION } from '../src/config/location.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../src/data/forecast-snapshots');
const WBGT_PROXY = 'https://wbgt-proxy.pi-pi-pi-025.workers.dev';

const todayJst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// forecast 配列 → { date: {gustMax, windMax, popMax, tempMax, wbgtMax} }
function compact(list) {
  const out = {};
  for (const f of list) {
    out[f.date] = {
      gustMax: f.gustMax ?? null,
      windMax: f.windMax ?? null,
      popMax: f.popMax ?? null,
      tempMax: f.tempMax ?? null,
      wbgtMax: f.wbgtMax ?? null,
    };
  }
  return out;
}

async function main() {
  const date = todayJst();
  console.error(`予報スナップショット取得: ${date}`);

  const [jma, om] = await Promise.all([
    fetchJma().catch((e) => {
      console.error('JMA 失敗:', e.message);
      return [];
    }),
    fetchOpenMeteo(LOCATION.coords).catch((e) => {
      console.error('Open-Meteo 失敗:', e.message);
      return [];
    }),
  ]);

  // 環境省 WBGT 実値をプロキシ経由で取得し Open-Meteo の各日に載せる (取れた日のみ)
  try {
    const env = await fetchEnvWbgt(undefined, { proxyUrl: WBGT_PROXY });
    if (env) for (const f of om) if (env[f.date]?.wbgtMax != null) f.wbgtMax = env[f.date].wbgtMax;
  } catch (e) {
    console.error('WBGT 失敗:', e.message);
  }

  const snapshot = {
    date,
    fetchedAt: new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00'),
    sources: { jma: compact(jma), 'open-meteo': compact(om) },
  };

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, `${date}.json`);
  await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8');
  console.error(`保存: ${outPath} (JMA ${jma.length}日 / Open-Meteo ${om.length}日)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
