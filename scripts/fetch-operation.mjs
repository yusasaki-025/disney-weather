// 公式 TDR の当日運営状況 (中止 ・ 内容変更 ・ 早閉め) を取得して蓄積する (§0.28 / Phase 2 第3弾)。
//
// 使い方:
//   npm run fetch-operation            (今日)
//   npm run fetch-operation -- 20260605 (指定日)
//   → src/data/operation-log/{YYYY-MM-DD}.json に 1 スナップショットを追記。
//
// 規約遵守: User-Agent 明示 / リクエスト間 3 秒 / 低頻度。
//
// 注意: 公式サイトは Akamai Bot Manager で保護されており、headless Playwright では
//   安定取得できない (空シェルが返る)。実運用では Cowork Chrome MCP (実 Chrome 経由) で
//   取得した結果を同じ JSON 形式で書き込む。本スクリプトはローカル取得の足場として残す。
//   取得失敗時は JSON を書かず終了する (UI は当該日のセクションを出さない)。

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../src/data/operation-log');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0 Safari/537.36 maihama-biyori/1.0 (+https://disney-weather.pages.dev)';
const SLEEP_MS = 3000;
const NAV_TIMEOUT = 30000;
const PARKS = ['tdl', 'tds'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 'YYYYMMDD' → 'YYYY-MM-DD'
const hyphen = (ymd) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

function todayYmd() {
  // JST の今日 (実行環境 TZ に依存しないよう +09:00 で算出)
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10).replace(/-/g, '');
}

// 公式 calendar ページ DOM から当日変更 (赤字等) を拾う。実 DOM に合わせて要調整。
function parseOperationInBrowser() {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const timeRe = /([0-2]?\d:[0-5]\d)/;
  const closedShows = [];
  const modifiedShows = [];
  let earlyClose = null;

  // 「中止」「公演中止」「休止」を含む項目
  const items = [...document.querySelectorAll('li,dd,div,p,tr')].filter(
    (el) => (el.textContent || '').length < 120,
  );
  const seen = new Set();
  for (const el of items) {
    const t = text(el);
    if (!t || seen.has(t)) continue;
    if (/中止|休止|公演を見合わせ/.test(t)) {
      seen.add(t);
      const time = (t.match(timeRe) || [])[0] || null;
      if (time) modifiedShows.push({ text: t.slice(0, 80), time });
      else closedShows.push({ text: t.slice(0, 80) });
    } else if (/内容(を)?変更|時間(を)?変更|時刻変更/.test(t)) {
      seen.add(t);
      modifiedShows.push({ text: t.slice(0, 80), time: (t.match(timeRe) || [])[0] || null });
    }
  }
  // 早閉め (「YY:YY closing」「YY:YY 閉園」等)
  const body = document.body ? document.body.innerText : '';
  const ec = body.match(/(\d{1,2}:\d{2})\s*(?:closing|閉園|クローズ)/);
  if (ec) earlyClose = ec[1];

  return {
    closedShows,
    modifiedShows,
    earlyClose,
    closedAttractions: [],
    rawTextSnippet: body.replace(/\s+/g, ' ').slice(0, 200),
  };
}

async function fetchSnapshots(ymd) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('playwright 未導入。`npm install && npx playwright install chromium` を実行してください。');
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'ja-JP' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  const nowJst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00');
  const snapshots = [];
  for (const park of PARKS) {
    const url = `https://www.tokyodisneyresort.jp/${park}/daily/calendar/${ymd}/`;
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const parsed = await page.evaluate(parseOperationInBrowser);
      snapshots.push({ fetchedAt: nowJst, park: park.toUpperCase(), ...parsed });
      console.error(`  ${park.toUpperCase()}: 中止 ${parsed.closedShows.length} / 変更 ${parsed.modifiedShows.length}`);
    } catch (e) {
      console.error(`  ${park.toUpperCase()}: 取得失敗 (${e.message})`);
    }
    await sleep(SLEEP_MS);
  }
  await browser.close();
  return snapshots;
}

async function main() {
  const arg = process.argv[2];
  const ymd = arg && /^\d{8}$/.test(arg) ? arg : todayYmd();
  const date = hyphen(ymd);
  console.error(`当日運営状況を取得: ${date}`);

  const snapshots = await fetchSnapshots(ymd);
  if (snapshots.length === 0) {
    console.error('取得 0 件。JSON は書きません (UI は当該日のセクションを出しません)。');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, `${date}.json`);
  // 既存ファイルがあれば snapshots に追記 (取得タイミング別に蓄積)
  let existing = { date, snapshots: [] };
  try {
    existing = JSON.parse(await readFile(outPath, 'utf-8'));
  } catch {
    /* 新規 */
  }
  existing.date = date;
  existing.snapshots = [...(existing.snapshots || []), ...snapshots];
  await writeFile(outPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf-8');
  console.error(`保存: ${outPath} (累計 ${existing.snapshots.length} スナップショット)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
