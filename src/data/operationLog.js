// 当日の公式運営状況ログ (§0.28 / Phase 2 第3弾)。
// scripts/fetch-operation.mjs が src/data/operation-log/YYYY-MM-DD.json に書き込む。
// 中止 ・ 内容変更 ・ 早閉め等の「当日変更」を蓄積し、詳細パネルに表示する。
// JSON が無い日は null を返し、UI 側はセクションを出さない (取得失敗時は表示なし)。

import { normalizeShowName } from './cancelHistoryLoader.js';

// 日別 JSON を eager import (vite)。{ './operation-log/2026-06-05.json': {date, snapshots} }
const files = import.meta.glob('./operation-log/*.json', { eager: true });
const BY_DATE = {};
for (const [path, mod] of Object.entries(files)) {
  const data = mod.default || mod;
  const d = path.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1];
  if (d && data?.snapshots) BY_DATE[d] = data;
}

// その日の運営状況を返す。{ date, snapshots:[...] } または null。
export function getDayOperation(date) {
  return BY_DATE[date] || null;
}

// その日の最新スナップショット (取得時刻が一番新しいもの) を park 別にまとめて返す。
// 戻り値: { fetchedAt, parks: { TDL: snapshot, TDS: snapshot } } または null。
export function latestOperation(date) {
  const log = getDayOperation(date);
  if (!log || !Array.isArray(log.snapshots) || log.snapshots.length === 0) return null;
  const parks = {};
  let fetchedAt = null;
  for (const s of log.snapshots) {
    const prev = parks[s.park];
    if (!prev || (s.fetchedAt || '') > (prev.fetchedAt || '')) parks[s.park] = s;
    if (!fetchedAt || (s.fetchedAt || '') > fetchedAt) fetchedAt = s.fetchedAt;
  }
  return { fetchedAt, parks };
}

// §0.92 : ショー別の「運用ログ由来」中止 ・ 変更実績 (@kazekyanbunseki 由来の operation-log)。
//   cancel-history (§0.30 PDF由来) は風速の実測値が無いショーだと該当0件になりやすいため、
//   風速に依らない「直近どれくらい ・ 何が原因で中止/変更になったか」の補助情報として使う。
//   text 中の【風キャン】【雨キャン】【熱キャン】タグ、無ければ強風/悪天候/高気温等のキーワードで
//   原因を推定する ("その他" は不具合 ・ ステージコンディション不良等)。
const CAUSE_RULES = [
  [/風キャン|強風/, 'wind'],
  [/雨キャン|悪天候/, 'rain'],
  [/熱キャン|高気温/, 'heat'],
];

function inferCause(text) {
  for (const [re, key] of CAUSE_RULES) {
    if (re.test(text)) return key;
  }
  return 'other';
}

// 指定ショー ( park 込み ) の運用ログ上の中止 ・ 変更事例一覧を新しい順で返す。
// [{ date, cause: 'wind'|'rain'|'heat'|'other', text }]
export function getShowIncidents(showName, park) {
  const target = normalizeShowName(showName);
  if (!target) return [];
  const out = [];
  for (const date of Object.keys(BY_DATE).sort().reverse()) {
    const log = BY_DATE[date];
    for (const snap of log.snapshots || []) {
      if (snap.park !== park) continue;
      const items = [...(snap.closedShows || []), ...(snap.modifiedShows || [])];
      for (const item of items) {
        const text = item.text || item.name || '';
        if (!text || !normalizeShowName(text).includes(target)) continue;
        out.push({ date, cause: inferCause(text), text });
      }
    }
  }
  return out;
}
