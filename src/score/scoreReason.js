// スコア理由の 1 行解説 (§0.66.3)。日スコアが時間帯加重平均ベースになったため、
// 理由も時間帯ベースに変更。最重視の「昼」を先頭に、各時間帯の評価 (+ 主因) を並べる。
// 例 : 「昼 (最重視) FAIR (45) 風強め・朝 FAIR (45)・夜 OK (74)」

const BAND_LABEL = { morning: '朝', noon: '昼', night: '夜' };
const FACTOR_TEXT = { 風: '風強め', 雨: '雨', 暑さ: '暑さ', 寒さ: '寒さ', UV: 'UV 強め' };
// 昼を最重視として先頭に出す並び順。
const ORDER = ['noon', 'morning', 'night'];

// getScoreReason(evaluation) -> string
//   evaluation : evaluateDay の戻り値 (subscores を持つ)。
export function getScoreReason(evaluation) {
  const subscores = evaluation?.subscores;
  if (!subscores) return '';
  const parts = [];
  for (const key of ORDER) {
    const s = subscores[key];
    if (!s || !s.hasData) continue;
    const tag = key === 'noon' ? '昼 (最重視)' : BAND_LABEL[key];
    // FAIR 以下のときだけ主因 (風強め / 雨 / 暑さ) を併記して「なぜ低いか」を示す。
    const why = s.score < 60 && s.factor ? ` ${FACTOR_TEXT[s.factor]}` : '';
    parts.push(`${tag} ${s.symbol.label} (${s.score})${why}`);
  }
  if (parts.length === 0) return '時間帯データなし';
  return parts.join('・');
}
