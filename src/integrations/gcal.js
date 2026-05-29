// Google Calendar 連携 (§3.9, §12)。Cowork artifact ランタイム経由で予定を追加する。
// 実行前に確認ダイアログを出す (誤クリック防止)。

import { dateLabel, fmtNum } from '../ui/components.js';
import { suggestOutfit } from '../ui/outfit.js';

export const GCAL_CONFIG = {
  // Cowork が公開する Google Calendar コネクタのツール ID (環境ごとに異なる)
  createTool: 'mcp__0d41b0a4-c542-42f1-a379-349e38735111__create_event',
};

function getBridge() {
  if (typeof window === 'undefined' || !window.cowork || typeof window.cowork.callMcpTool !== 'function') {
    throw new Error('カレンダー連携は Cowork artifact 上でのみ動作します');
  }
  return window.cowork.callMcpTool;
}

function buildDescription(row) {
  const m = row.eval.metrics;
  const gust = m.gustShowWindow != null ? m.gustShowWindow : m.gustMax;
  const pop = m.popShowWindow != null ? m.popShowWindow : m.popMax;
  const outfit = suggestOutfit(m).map((o) => `･ ${o.text}`).join('\n');
  return [
    `予報スコア : ${row.eval.score} (${row.eval.symbol.symbol})`,
    `風 : ${fmtNum(gust, 0, 'm/s')} / 降水確率 : ${fmtNum(pop, 0, '%')}`,
    `風キャン : ${row.eval.badges.wind.text} / 雨キャン : ${row.eval.badges.rain.text} / 熱キャン : ${row.eval.badges.wbgt.text}`,
    '',
    '持ち物 ･ 服装 :',
    outfit,
  ].join('\n');
}

// 当日 8:00 - 22:00 の予定を追加する。確認は呼び出し側 (main) で取る。
export async function addToCalendar(row, park) {
  const call = getBridge();
  return call(GCAL_CONFIG.createTool, {
    summary: `ディズニー (${park})`,
    location: '東京ディズニーリゾート',
    startTime: `${row.date}T08:00:00`,
    endTime: `${row.date}T22:00:00`,
    timeZone: 'Asia/Tokyo',
    description: buildDescription(row),
  });
}

export function confirmText(row, park) {
  return `${dateLabel(row.date)} を ${park} の予定として Google カレンダーに追加しますか?\n(8:00 - 22:00)`;
}
