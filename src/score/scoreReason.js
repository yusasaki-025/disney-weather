// スコア理由の 1 行解説 (§0.37-10)。スコアラベル直下に「なぜこのスコアか」を簡潔に示す。
// 風 ・ 雨 ・ 熱のうちバッジが立っている (level≥1) ものを「風 9m/s 風バ」形式で列挙。
// 全て通常なら「風 ・ 雨 ・ 熱 全部OK」。

// getScoreReason(metrics, badges) -> string
export function getScoreReason(metrics, badges) {
  if (!metrics || !badges) return '';
  const parts = [];
  // §0.65.1/.2 : 風速 ・ WBGT は小数 1 桁、雨確率は整数で表示精度を統一。
  const d1 = (v) => Math.round(v * 10) / 10;

  const wind = metrics.gustShowWindow ?? metrics.gustMax;
  if (badges.wind && badges.wind.level >= 1 && wind != null) {
    parts.push(`風 ${d1(wind)}m/s ${badges.wind.text}`);
  }
  const pop = metrics.popShowWindow ?? metrics.popMax;
  if (badges.rain && badges.rain.level >= 1 && pop != null) {
    parts.push(`雨 ${Math.round(pop)}% ${badges.rain.text}`);
  }
  const wbgt = metrics.wbgtShowWindow ?? metrics.wbgtMax;
  if (badges.wbgt && badges.wbgt.level >= 1 && wbgt != null) {
    parts.push(`熱 WBGT${d1(wbgt)} ${badges.wbgt.text}`);
  }

  if (parts.length === 0) return '風・雨・熱 全部OK';
  return parts.join('・');
}
