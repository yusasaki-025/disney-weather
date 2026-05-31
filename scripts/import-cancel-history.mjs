// アメブロ風キャン記録 PDF (pdftotext 抽出済 .txt) を構造化 JSON に変換する (§0.30)。
//
// 使い方:
//   npm run import-cancel-history            (docs/cancel-history-pdf/ の全月)
//   npm run import-cancel-history -- 2026-04 (指定月)
//   → src/data/cancel-history/{YYYY-MM}.json を生成。
//
// 出典: TSUBASA のディズニーパークブログ + X @tdr_syopare_can (個人利用 ・ 出典明記)。
// 気象は東京 / 江戸川臨海アメダス。
//
// パース方針 (固定幅 PDF を全角幅に依存せず処理):
//   - "東京ディズニーランド/シー" で park を判定
//   - 直後の見出し行を 2 連続スペースで分割 → そのバンドのショー名リスト (左→右カラム順)
//   - 風キャン基準行から各ショーの windBa / windCancel / pyroLimit を抽出
//   - データ行を /(\d+)月(\d+)日/ で複数セグメントに分割し、カラム index でショーに割当
//   - 各セグメントから 時刻 / 平均風速 / 最大風速 / 状況記号 を抽出し status 分類
//   注意: 固定幅 PDF のため完璧ではない。月ごとに record 数 ・ status 分布をログ出力する。

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(__dirname, '../docs/cancel-history-pdf');
const OUT_DIR = resolve(__dirname, '../src/data/cancel-history');

const SOURCE = 'TSUBASA のディズニーパークブログ + X @tdr_syopare_can';
const WEATHER_SOURCE = '東京 / 江戸川臨海 アメダス';

// 状況記号 + note から status を分類 (§0.30 ステータス分類表)
function classifyStatus(mark, note) {
  const n = note || '';
  if (mark === '×') {
    if (/途中中止/.test(n)) return 'partial-cancel';
    if (/システム/.test(n)) return 'system-issue';
    return 'cancel';
  }
  if (mark === '○') {
    if (/カット|一部変更|風バ|内容.*変更|短縮|通過/.test(n)) return 'partial';
    return 'ok';
  }
  if (/休止/.test(mark) || /休止/.test(n)) return 'suspended';
  return 'ok';
}

// 風キャン基準テキストから閾値を抽出
function parseThresholds(text) {
  const t = {};
  const ba = text.match(/風バ[：:]\s*(\d+)\s*m/);
  const cancel = text.match(/風キャン[：:]\s*(\d+)\s*m/);
  const pyro = text.match(/パイロ[^0-9]*(\d+)\s*m/);
  if (ba) t.windBaThreshold = Number(ba[1]);
  if (cancel) t.windCancelThreshold = Number(cancel[1]);
  if (pyro) t.pyroLimitThreshold = Number(pyro[1]);
  return t;
}

// 見出し行を 2 連続スペース以上で分割しショー名リストへ ("(休止)" 等の付記も保持)
function splitColumns(line) {
  return line
    .trim()
    .split(/\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 1 データ行を /(\d+)月(\d+)日/ で分割し [{date, rest}] に
function splitByDate(line, year) {
  const re = /(\d+)月(\d+)日/g;
  const out = [];
  let m;
  const positions = [];
  while ((m = re.exec(line)) !== null) {
    positions.push({ idx: m.index, mo: Number(m[1]), d: Number(m[2]), end: re.lastIndex });
  }
  for (let i = 0; i < positions.length; i += 1) {
    const p = positions[i];
    const next = positions[i + 1];
    const rest = line.slice(p.end, next ? next.idx : undefined).trim();
    const date = `${year}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
    out.push({ date, rest });
  }
  return out;
}

// セグメント rest 文字列から time/avg/max/status を抽出
function parseSegment(rest) {
  if (!rest || /^休止/.test(rest)) return rest ? { status: 'suspended' } : null;
  const time = (rest.match(/(\d{1,2}:\d{2})/) || [])[1] || null;
  // 「平均 最大」= 数値 2 つ (データなしは「データなし」表記)
  const nums = rest.match(/(\d+\.\d+)\s+(\d+\.\d+|データなし)/);
  const avgWind = nums ? Number(nums[1]) : null;
  const maxWind = nums && nums[2] !== 'データなし' ? Number(nums[2]) : null;
  const mark = (rest.match(/[○×]/) || [])[0] || null;
  // note = 記号の後ろの説明
  let note = '';
  if (mark) {
    const after = rest.slice(rest.indexOf(mark) + 1).trim();
    note = after.replace(/\s+/g, ' ').slice(0, 60);
  }
  if (!time && !mark && avgWind == null) return null; // 空セグメント
  const status = classifyStatus(mark, note);
  const rec = { time, avgWind, maxWind, status };
  if (note) rec.note = note;
  return rec;
}

function parseMonth(text, ym) {
  const [year] = ym.split('-');
  const lines = text.split(/\r?\n/);
  const showsByName = new Map();
  const order = [];
  let park = null;
  let bandShows = []; // [{name, thresholds}]

  const ensureShow = (rawName, park2, thresholds) => {
    // 表記ゆれ吸収: 前後空白 ・ 全角空白除去。同名 (同 park) は records を集約。
    const name = rawName.replace(/\s+/g, ' ').trim();
    const key = `${park2}:${name}`;
    if (!showsByName.has(key)) {
      const s = { name, park: park2, ...thresholds, records: [] };
      showsByName.set(key, s);
      order.push(s);
    } else {
      // 後続バンドで閾値が出たら補完
      const s = showsByName.get(key);
      for (const [k, v] of Object.entries(thresholds)) if (s[k] == null) s[k] = v;
    }
    return showsByName.get(key);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/東京ディズニーランド/.test(line)) {
      park = 'TDL';
      continue;
    }
    if (/東京ディズニーシー/.test(line)) {
      park = 'TDS';
      continue;
    }
    // 見出し候補: 次行が「風キャン基準」を含む → この行はショー名カラム
    if (lines[i + 1] && /風キャン基準/.test(lines[i + 1]) && !/風キャン情報|日付/.test(line)) {
      const names = splitColumns(line);
      const thresholdCols = lines[i + 1].split(/風キャン基準/).map((s) => s.trim()).filter(Boolean);
      bandShows = names.map((name, idx) => {
        const th = parseThresholds(thresholdCols[idx] || '');
        return ensureShow(name, park, th);
      });
      continue;
    }
    // データ行: 行頭付近に "M月D日" がある
    if (/\d+月\d+日/.test(line) && bandShows.length > 0 && !/風キャン情報|日付|公演実施状況/.test(line)) {
      const segs = splitByDate(line, year);
      // セグメント数 = カラム数。bandShows と index 対応。
      segs.forEach((seg, idx) => {
        const show = bandShows[idx];
        if (!show) return;
        const rec = parseSegment(seg.rest);
        if (!rec) return;
        show.records.push({ date: seg.date, ...rec });
      });
    }
  }

  return order;
}

function summarize(shows) {
  let total = 0;
  const dist = {};
  for (const s of shows) {
    for (const r of s.records) {
      total += 1;
      dist[r.status] = (dist[r.status] || 0) + 1;
    }
  }
  return { total, dist };
}

async function processMonth(ym) {
  const txtPath = resolve(SRC_DIR, `${ym}.txt`);
  let text;
  try {
    text = await readFile(txtPath, 'utf-8');
  } catch {
    console.error(`スキップ: ${ym}.txt が無い`);
    return;
  }
  const shows = parseMonth(text, ym);
  const { total, dist } = summarize(shows);
  const out = {
    month: ym,
    source: SOURCE,
    weatherSource: WEATHER_SOURCE,
    fetchedAt: new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00'),
    shows,
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(resolve(OUT_DIR, `${ym}.json`), `${JSON.stringify(out, null, 2)}\n`, 'utf-8');
  console.error(
    `${ym}: ショー ${shows.length} / record ${total} / status ${JSON.stringify(dist)}`,
  );
  for (const s of shows) {
    console.error(`   [${s.park}] ${s.name} (records ${s.records.length}, windCancel ${s.windCancelThreshold ?? '-'})`);
  }
}

async function main() {
  const arg = process.argv[2];
  let months;
  if (arg && /^\d{4}-\d{2}$/.test(arg)) {
    months = [arg];
  } else {
    const files = await readdir(SRC_DIR);
    months = files.filter((f) => /^\d{4}-\d{2}\.txt$/.test(f)).map((f) => f.replace('.txt', '')).sort();
  }
  for (const ym of months) {
    await processMonth(ym);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
