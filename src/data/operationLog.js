// 当日の公式運営状況ログ (§0.28 / Phase 2 第3弾)。
// scripts/fetch-operation.mjs が src/data/operation-log/YYYY-MM-DD.json に書き込む。
// 中止 ・ 内容変更 ・ 早閉め等の「当日変更」を蓄積し、詳細パネルに表示する。
// JSON が無い日は null を返し、UI 側はセクションを出さない (取得失敗時は表示なし)。

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
