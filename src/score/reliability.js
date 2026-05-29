// ソース信頼度補正 (§5.4・Phase 2)。
// 的中ログ (§3.12) が 30 日たまったら各ソースの平均誤差から重み (0.5 - 1.5) を出す。
// 初期は全ソース 1.0。ログが不足する間は補正をかけない。

export const DEFAULT_WEIGHT = 1.0;
const MIN_SAMPLES = 30;

// 平均絶対誤差 → 重み。誤差が小さいほど重い。基準誤差 refError で 1.0。
export function weightFromError(meanAbsError, refError = 2.0) {
  if (meanAbsError == null) return DEFAULT_WEIGHT;
  const w = refError / (meanAbsError + refError * 0.5);
  return Math.max(0.5, Math.min(1.5, w));
}

// accuracyLog: { [source]: number[] } 各日の絶対誤差
// 30 日未満のソースは 1.0 のまま。
export function sourceWeights(accuracyLog = {}) {
  const weights = {};
  for (const [source, errors] of Object.entries(accuracyLog)) {
    if (!Array.isArray(errors) || errors.length < MIN_SAMPLES) {
      weights[source] = DEFAULT_WEIGHT;
      continue;
    }
    const mae = errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length;
    weights[source] = weightFromError(mae);
  }
  return weights;
}
