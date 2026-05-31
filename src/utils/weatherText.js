// 天気概況の日本語整形 (§0.36-4)。気象庁 ・ Open-Meteo の生テキストを自然な表記に整える。
// - 余分な空白を除去
// - 時間帯語 (夕方/朝晩/昼前/昼過ぎ/夜/朝/昼) の前に読点「、」を入れて区切る
// - 「くもり」→「曇り」に表記統一
// 例: 「くもり 夕方 から 晴れ」→「曇り、夕方から晴れ」

const TIME_WORDS = ['朝晩', '昼前', '昼過ぎ', '夕方', '夜遅く', '夜', '朝', '昼'];

export function normalizeWeatherText(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  // 表記統一
  s = s.replace(/くもり/g, '曇り');
  // 余分な空白 (半角 ・ 全角) を除去。\s は全角空白 U+3000 も含む。
  s = s.replace(/\s+/g, '');
  // 時間帯語の前に読点を挿入 (文頭は除く)。長い語から先に処理。
  for (const w of TIME_WORDS) {
    s = s.replace(new RegExp(`(.)(${w})`, 'g'), (match, prev, word) => {
      if (prev === '、' || prev === '。') return match;
      return `${prev}、${word}`;
    });
  }
  return s;
}
