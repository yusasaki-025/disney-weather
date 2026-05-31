// §0.39.1 : 予報スコアの前日比 (純関数。テスト可能なようデータを引数で受け取る)。
// snapshots: [{ snapDate: 'YYYY-MM-DD', scores: [{ date, park, score, symbol }] }] (snapDate 昇順)

// あるスナップショットから targetDate + park のスコアを引く
function scoreIn(snap, targetDate, park) {
  const e = snap.scores.find((s) => s.date === targetDate && s.park === park);
  return e ? e.score : null;
}

// 当日 (today) より前の最新スナップショットと現在スコアの差分。
// ガード : 比較対象スナップショットが無い / 同値 のときは null。
export function scoreDiff(snapshots, targetDate, park, currentScore, today) {
  if (currentScore == null) return null;
  // today より前のスナップショットを新しい順に走査し、最初に見つかった値を「前回値」とする
  const prior = snapshots.filter((s) => s.snapDate < today).reverse();
  for (const snap of prior) {
    const prev = scoreIn(snap, targetDate, park);
    if (prev != null) {
      const delta = currentScore - prev;
      if (delta === 0) return null;
      return { delta, prev, snapDate: snap.snapDate };
    }
  }
  return null;
}

// 直近 n 日のスコア推移 (古い→新しい)。各スナップショットの値 + 今日の currentScore を末尾に。
export function scoreHistory(snapshots, targetDate, park, currentScore, today, n = 7) {
  const points = [];
  for (const snap of snapshots) {
    if (snap.snapDate >= today) continue;
    const v = scoreIn(snap, targetDate, park);
    if (v != null) points.push({ date: snap.snapDate, score: v });
  }
  if (currentScore != null) points.push({ date: today, score: currentScore, current: true });
  return points.slice(-n);
}
