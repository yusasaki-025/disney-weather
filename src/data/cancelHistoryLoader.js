// 過去風キャン記録 (§0.30 で取り込んだ cancel-history/*.json) のローダ (§0.31)。
// ショー名は出典 (全角中黒「・」) と表示 (半角中黒「･」) で表記ゆれがあるため正規化して突合する。

// 全月 JSON を eager import (vite)。{ './cancel-history/2026-04.json': {month, shows} }
const files = import.meta.glob('./cancel-history/*.json', { eager: true });
const MONTHS = [];
for (const [, mod] of Object.entries(files)) {
  const data = mod.default || mod;
  if (data?.shows) MONTHS.push(data);
}

// ショー名正規化: 中黒 (・/･) ・ 空白 ・ 感嘆符 ・ 長音前後の揺れを吸収し比較キーにする。
export function normalizeShowName(name) {
  return (name || '')
    .replace(/[・･·]/g, '') // 全角/半角中黒を除去
    .replace(/[！!]/g, '') // 感嘆符を除去
    .replace(/[\s　]/g, '') // 空白除去
    .replace(/[～〜~]/g, '') // 波ダッシュ除去
    .toLowerCase();
}

// 正規化名 → records[] の索引 (全月集約)。同名は park をまたいで結合しない (park 別に保持)。
const byKey = new Map();
for (const data of MONTHS) {
  for (const s of data.shows) {
    if (!s.records || s.records.length === 0) continue; // ゴミ抽出 (rec=0) は除外
    const key = `${s.park}|${normalizeShowName(s.name)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(...s.records);
  }
}

// 指定ショー (park + 名前) の全 records を返す。表記ゆれは正規化で吸収。
export function getAllRecordsForShow(showName, park) {
  const key = `${park}|${normalizeShowName(showName)}`;
  return byKey.get(key) || [];
}
