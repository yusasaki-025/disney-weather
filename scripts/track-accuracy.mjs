// 的中追跡 (§0.29 / Phase 2 第4弾 Stage 2)。
// 保存済み予報スナップショットと当日実測 (気象庁アメダス船橋 + 環境省 WBGT 実測) を比較し、
// ソース別の絶対誤差を src/data/accuracy-log.json に日次追記する。
//
// 使い方: npm run track-accuracy            (昨日)
//        npm run track-accuracy -- 2026-06-05
// 運用  : 翌朝 1 回。30 日蓄積で各ソースの平均誤差が見える (将来の信頼度補正の素地)。

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchEnvWbgt } from '../src/data/wbgt.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAP_DIR = resolve(__dirname, '../src/data/forecast-snapshots');
const LOG_PATH = resolve(__dirname, '../src/data/accuracy-log.json');
const AMEDAS_POINT = '44132'; // 船橋
const WBGT_PROXY = 'https://wbgt-proxy.pi-pi-pi-025.workers.dev';

const ymd = (date) => date.replace(/-/g, '');
const abs = (a, b) => (a == null || b == null ? null : Math.round(Math.abs(a - b) * 10) / 10);
const yesterdayJst = () =>
  new Date(Date.now() + 9 * 3600 * 1000 - 24 * 3600 * 1000).toISOString().slice(0, 10);

// 気象庁アメダス (3 時間ごとのファイルに 10 分値) から日最大風速 ・ 日最高気温を集約。
async function fetchAmedasDaily(date) {
  const base = `https://www.jma.go.jp/bosai/amedas/data/point/${AMEDAS_POINT}`;
  let maxWind = null;
  let maxTemp = null;
  for (const hh of ['00', '03', '06', '09', '12', '15', '18', '21']) {
    try {
      const res = await fetch(`${base}/${ymd(date)}_${hh}.json`);
      if (!res.ok) continue;
      const json = await res.json();
      for (const rec of Object.values(json)) {
        const w = rec.wind?.[0];
        const t = rec.temp?.[0];
        if (w != null && (maxWind == null || w > maxWind)) maxWind = w;
        if (t != null && (maxTemp == null || t > maxTemp)) maxTemp = t;
      }
    } catch {
      /* 欠測スキップ */
    }
  }
  return { maxWind, maxTemp };
}

async function main() {
  const arg = process.argv[2];
  const date = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : yesterdayJst();
  console.error(`的中追跡: ${date}`);

  let snap = null;
  try {
    snap = JSON.parse(await readFile(resolve(SNAP_DIR, `${date}.json`), 'utf-8'));
  } catch {
    console.error(`スナップショット無し (${date}.json)。snapshot-forecast を先に運用してください。`);
    return;
  }

  const actual = await fetchAmedasDaily(date);
  let actualWbgt = null;
  try {
    const env = await fetchEnvWbgt(undefined, { proxyUrl: WBGT_PROXY });
    actualWbgt = env?.[date]?.wbgtMax ?? null;
  } catch {
    /* WBGT 実測なし */
  }

  // 実測が一切無い (当日でデータ未完 ・ 取得失敗) なら記録しない。
  // 誤差計算できない日を残すと将来の平均誤差にゴミが入るため。翌日に再実行すれば揃う。
  if (actual.maxWind == null && actual.maxTemp == null && actualWbgt == null) {
    console.error(`実測がまだ揃っていません (${date})。翌日以降に再実行してください。記録はスキップ。`);
    return;
  }

  const forecasts = {};
  for (const [src, byDate] of Object.entries(snap.sources || {})) {
    const f = byDate[date];
    if (!f) continue;
    const predWind = f.gustMax ?? f.windMax ?? null;
    forecasts[src] = {
      predictedMaxWind: predWind,
      windError: abs(predWind, actual.maxWind),
      predictedMaxTemp: f.tempMax ?? null,
      tempError: abs(f.tempMax, actual.maxTemp),
      predictedMaxWbgt: f.wbgtMax ?? null,
      wbgtError: abs(f.wbgtMax, actualWbgt),
    };
  }

  const entry = {
    actualMaxWind: actual.maxWind,
    actualMaxTemp: actual.maxTemp,
    actualMaxWbgt: actualWbgt,
    forecasts,
  };

  let log = {};
  try {
    log = JSON.parse(await readFile(LOG_PATH, 'utf-8'));
  } catch {
    /* 新規 */
  }
  log[date] = entry;
  await mkdir(dirname(LOG_PATH), { recursive: true });
  await writeFile(LOG_PATH, `${JSON.stringify(log, null, 2)}\n`, 'utf-8');
  console.error(
    `記録: ${date} 実測 風${actual.maxWind ?? '-'} 気温${actual.maxTemp ?? '-'} WBGT${actualWbgt ?? '-'}`,
  );
  for (const [src, e] of Object.entries(forecasts)) {
    console.error(`   ${src}: 風誤差 ${e.windError ?? '-'} / 気温誤差 ${e.tempError ?? '-'} / WBGT誤差 ${e.wbgtError ?? '-'}`);
  }
  console.error(`通算 ${Object.keys(log).length} 日`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
