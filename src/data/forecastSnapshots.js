// §0.39.1 : 過去の予報スナップショット (scripts/snapshot-forecast.mjs が毎朝書く) を読み込む。
// import.meta.glob で src/data/forecast-snapshots/*.json を eager import (Vite)。
// 各ファイル : { date, generatedAt, scores: [{ date, park, score, symbol }] }

import { scoreDiff, scoreHistory } from '../score/scoreDiff.js';

const modules = import.meta.glob('./forecast-snapshots/*.json', { eager: true });

// snapshot 配列 (snapshot 日の昇順)
const snapshots = Object.entries(modules)
  .map(([path, mod]) => {
    const m = path.match(/(\d{4}-\d{2}-\d{2})\.json$/);
    const data = mod.default || mod;
    return m ? { snapDate: m[1], scores: data.scores || [] } : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.snapDate.localeCompare(b.snapDate));

// 当日 (today) より前の最新スナップショットと比べたスコア差分 (§0.39.1)。
// 差が無い ・ 比較対象が無いときは null。
export function getScoreDiff(targetDate, park, currentScore, today) {
  return scoreDiff(snapshots, targetDate, park, currentScore, today);
}

// 直近 N 日のスコア推移 (詳細パネルの予報変更履歴用)。今日の値は currentScore で補う。
export function getScoreHistory(targetDate, park, currentScore, today, n = 7) {
  return scoreHistory(snapshots, targetDate, park, currentScore, today, n);
}
