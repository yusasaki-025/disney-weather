// Notion 連携 (§3.6, §11)。Cowork artifact ランタイムの window.cowork.callMcpTool 経由で呼ぶ。
// artifact 配布版にはキーを埋め込まず、Cowork 接続済みコネクタを使う。

import { dateLabel } from '../ui/components.js';
import { fmtNum } from '../ui/components.js';
import { logger } from '../utils/logger.js';

// === 設定 (Cowork 環境ごとに合わせる) =====================================
// ディズニー行く日候補 DB を作成したら、その data source ID (collection://<id> の <id>) を入れる。
// database_id しか分からない場合は dataSourceId を空にして databaseId に設定する。
export const NOTION_CONFIG = {
  dataSourceId: '', // 例: 'f336d0bc-b841-465b-8045-024475c079dd'
  databaseId: '', // dataSourceId が無いときのフォールバック
  // Cowork が公開する Notion コネクタのツール ID (環境ごとに異なる)
  createTool: 'mcp__0659b728-c5ec-4b9c-b289-01bef999914e__notion-create-pages',
  // DB のタイトル列名 (作成時に決めた名前に合わせる)
  titleProp: '候補日',
};
// ==========================================================================

// DB が設定済みかどうか (未設定なら決定時の自動送信をスキップする)
export function isNotionConfigured() {
  return Boolean(NOTION_CONFIG.dataSourceId || NOTION_CONFIG.databaseId);
}

function getBridge() {
  if (typeof window === 'undefined' || !window.cowork || typeof window.cowork.callMcpTool !== 'function') {
    throw new Error('Notion 連携は Cowork artifact 上でのみ動作します');
  }
  return window.cowork.callMcpTool;
}

function parentRef() {
  if (NOTION_CONFIG.dataSourceId) {
    return { type: 'data_source_id', data_source_id: NOTION_CONFIG.dataSourceId };
  }
  if (NOTION_CONFIG.databaseId) {
    return { type: 'database_id', database_id: NOTION_CONFIG.databaseId };
  }
  throw new Error('NOTION_CONFIG に dataSourceId / databaseId が未設定です');
}

// row → Notion ページ properties (§11.1 のスキーマに対応)
function rowToProperties(row, park) {
  const m = row.eval.metrics;
  const gust = m.gustShowWindow != null ? m.gustShowWindow : m.gustMax;
  const pop = m.popShowWindow != null ? m.popShowWindow : m.popMax;
  const sub = row.eval.subscores;
  const subText = `朝${sub.morning?.symbol?.symbol ?? '-'} 昼${sub.noon?.symbol?.symbol ?? '-'} 夜${sub.night?.symbol?.symbol ?? '-'}`;
  return {
    [NOTION_CONFIG.titleProp]: `${dateLabel(row.date)} ${park}`,
    日付: row.date,
    '候補時のスコア': row.eval.score,
    '風速予報 (m/s)': gust != null ? Math.round(gust) : null,
    '降水確率 (%)': pop != null ? Math.round(pop) : null,
    パーク: park,
    'ショー時刻スコア': subText,
    ステータス: row.isDecided ? '決定' : '検討中',
  };
}

// 候補日のスナップショットを Notion DB に追加する。
// 既定では ◎ ○ (スコア 70 以上) の候補を送る。
export async function sendCandidatesToNotion(rows, park, { minScore = 70, limit = 10 } = {}) {
  const call = getBridge();
  const parent = parentRef();
  const targets = rows
    .filter((r) => r.eval && r.eval.score >= minScore && !r.isNg)
    .slice(0, limit);
  if (targets.length === 0) {
    throw new Error('送信できる候補 (◎ ○) がありません');
  }
  const pages = targets.map((row) => ({
    properties: rowToProperties(row, park),
    content: `スコア ${row.eval.score} / 風 ${fmtNum(
      row.eval.metrics.gustShowWindow ?? row.eval.metrics.gustMax,
      0,
      'm/s',
    )} / 降水 ${fmtNum(row.eval.metrics.popShowWindow ?? row.eval.metrics.popMax, 0, '%')}`,
  }));
  logger.info('Notion に候補を送信', { count: pages.length });
  return call(NOTION_CONFIG.createTool, { parent, pages });
}

// 決定日を「決定」ステータスで 1 ページ追加する (§3.9-2)。
// 真の「更新」は page_id 追跡が要るため、artifact 単体ではステータス=決定の追加で代替。
export async function markDecidedInNotion(row, park) {
  const call = getBridge();
  const parent = parentRef();
  const properties = rowToProperties({ ...row, isDecided: true }, park);
  return call(NOTION_CONFIG.createTool, {
    parent,
    pages: [{ properties, content: `この日に決定 : ${dateLabel(row.date)} ${park}` }],
  });
}
