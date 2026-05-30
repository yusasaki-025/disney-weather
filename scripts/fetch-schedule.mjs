// 公式 TDR 日別カレンダーから 1 か月分のショー ・ パレード時刻を取得する (§0.8 / SPEC §3.10)。
//
// 使い方:
//   npm run fetch-schedule -- 2026-07
//   → src/data/schedule/2026-07.json を生成。
//
// 規約遵守 (SPEC §18.1):
//   - User-Agent を明示 (連絡先 URL 入り)
//   - リクエスト間 3 秒 sleep (サーバー負荷を抑制)
//   - 1 か月分を 1 回だけ取得する想定 (高頻度アクセスしない)
//   - robots.txt は WAF で機械取得できないため、公式の利用規約を別途確認のうえ自己責任で実行すること
//   - 公式ページは SPA でクライアントレンダリングのため Playwright (headless Chrome) で DOM 確定後にパース
//
// 注意: 公式 DOM は予告なく変わる。取得 0 件や明らかに異常な結果のときは
//       SELECTORS と parseDay() を実 DOM に合わせて調整する。失敗時はアプリ側が
//       固定値 (showSchedule.js の FALLBACK) に自動フォールバックするので、本スクリプトの
//       失敗がアプリを壊すことはない。

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../src/data/schedule');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0 Safari/537.36 maihama-biyori/1.0 (+https://disney-weather.pages.dev)';
const SLEEP_MS = 3000; // リクエスト間隔 (規約配慮)
const NAV_TIMEOUT = 30000;

const PARKS = ['tdl', 'tds'];

// 公演名 → priority / kind の分類 (SPEC §3.10 の showPriority 相当)。
// high: 季節限定の昼公演 (最重要)、medium: 屋内 ・ エントリー受付、low: 通年のナイト演目。
const PRIORITY_RULES = [
  { re: /ハーモニー[・･]イン[・･]カラー/, priority: 'high', kind: 'parade-day' },
  { re: /スウィーツフルタイム/, priority: 'high', kind: 'show-day' },
  { re: /Reach for the Stars/i, priority: 'high', kind: 'show-day' },
  { re: /ジュビレーション/, priority: 'high', kind: 'parade-day' },
  { re: /スパークリング[・･]ジュビリー/, priority: 'high', kind: 'show-day' },
  { re: /ウィッシュ/, priority: 'high', kind: 'show-day' },
  { re: /ジャンボリミッキー/, priority: 'medium', kind: 'show-indoor' },
  { re: /エレクトリカルパレード|ドリームライツ/, priority: 'low', kind: 'parade-night' },
  { re: /スカイ[・･]フル[・･]オブ[・･]カラーズ/, priority: 'low', kind: 'show-night' },
  { re: /ビリーヴ|ナイトハーバー/, priority: 'low', kind: 'show-night' },
];

function classify(name) {
  for (const r of PRIORITY_RULES) {
    if (r.re.test(name)) return { priority: r.priority, kind: r.kind };
  }
  // 未知の公演: 時刻が昼帯 (11-16) なら medium、それ以外 low (安全側)
  return { priority: 'medium', kind: 'show-unknown' };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 'YYYY-MM' → その月の 'YYYY-MM-DD' 配列
function daysOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= last; d += 1) {
    out.push(`${ym}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

const ymd = (date) => date.replace(/-/g, ''); // 2026-07-01 → 20260701

// ブラウザ内で実行する DOM パーサ。公式 DOM 構造に依存するため、
// 変わったらこの関数を実 DOM に合わせて調整する。複数の手がかりを順に試す。
function parseDayInBrowser() {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const timeRe = /([0-2]?\d:[0-5]\d)/g;

  // 開園 ・ 閉園時刻 (「9:00 - 21:00」「9:00〜21:00」等の表記を拾う)
  let openHour = null;
  let closeHour = null;
  const bodyText = document.body ? document.body.innerText : '';
  const openClose = bodyText.match(/([0-2]?\d:[0-5]\d)\s*[-〜~–]\s*([0-2]?\d:[0-5]\d)/);
  if (openClose) {
    openHour = openClose[1];
    closeHour = openClose[2];
  }

  // ショー ・ パレード項目。代表的なコンテナ候補を順に試す。
  const itemSelectors = [
    '[class*="schedule"] li',
    '[class*="program"] li',
    '[class*="show"] li',
    '.daily-calendar li',
    'main li',
  ];
  let nodes = [];
  for (const sel of itemSelectors) {
    nodes = Array.from(document.querySelectorAll(sel));
    if (nodes.length > 0) break;
  }

  const shows = [];
  const seen = new Set();
  for (const node of nodes) {
    const t = text(node);
    if (!t) continue;
    const times = (t.match(timeRe) || []).filter((x, i, a) => a.indexOf(x) === i);
    if (times.length === 0) continue;
    // 時刻部分を除いた名前 (先頭の名前を採用)
    const name = t.replace(timeRe, '').replace(/[（(].*?[)）]/g, '').trim().slice(0, 40);
    if (!name || name.length < 2) continue;
    const key = name + times.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const tags = [];
    if (/プレミアアクセス/.test(t)) tags.push('プレミアアクセス');
    if (/エントリー受付/.test(t)) tags.push('エントリー受付');
    if (/予約/.test(t)) tags.push('予約必須');
    shows.push({ name, times, tags });
  }
  return { openHour, closeHour, shows };
}

async function fetchMonth(ym) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      'playwright が見つかりません。`npm install` 後に `npx playwright install chromium` を実行してください。',
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'ja-JP' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  const days = {};
  const dates = daysOfMonth(ym);
  console.error(`${ym}: ${dates.length} 日 × ${PARKS.length} パークを取得します (間隔 ${SLEEP_MS}ms)`);

  for (const date of dates) {
    days[date] = {};
    for (const park of PARKS) {
      const url = `https://www.tokyodisneyresort.jp/${park}/daily/calendar/${ymd(date)}/`;
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        const parsed = await page.evaluate(parseDayInBrowser);
        const shows = parsed.shows.map((s) => ({ ...s, ...classify(s.name) }));
        days[date][park.toUpperCase()] = {
          openHour: parsed.openHour,
          closeHour: parsed.closeHour,
          shows,
        };
        console.error(`  ${date} ${park.toUpperCase()}: ${shows.length} 公演`);
      } catch (e) {
        console.error(`  ${date} ${park.toUpperCase()}: 取得失敗 (${e.message})`);
        days[date][park.toUpperCase()] = { openHour: null, closeHour: null, shows: [] };
      }
      await sleep(SLEEP_MS);
    }
  }

  await browser.close();
  return days;
}

async function main() {
  const ym = process.argv[2];
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    console.error('使い方: npm run fetch-schedule -- YYYY-MM  (例: 2026-07)');
    process.exit(1);
  }

  const days = await fetchMonth(ym);
  // 取得時刻は JST 表記 (実行環境に依存しないよう +09:00 固定で簡易表記)
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00');
  const out = {
    month: ym,
    fetchedAt: jst,
    source: 'https://www.tokyodisneyresort.jp/{tdl|tds}/daily/calendar/{YYYYMMDD}/',
    days,
  };

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, `${ym}.json`);
  await writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf-8');
  console.error(`保存しました: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
