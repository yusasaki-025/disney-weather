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
  // 全角/半角の余分な空白を一旦すべて除去 (日本語天気概況に語間スペースは不要)
  s = s.replace(/[\s　]+/g, '');
  // 時間帯語の前に読点を挿入 (文頭は除く)。長い語から先に処理して部分一致の取りこぼしを防ぐ。
  for (const w of TIME_WORDS) {
    s = s.replace(new RegExp(`(.)(${w})`, 'g'), (match, prev, word) => {
      // 直前が既に読点 ・ 区切りならそのまま
      if (prev === '、' || prev === '。') return match;
      return `${prev}、${word}`;
    });
  }
  return s;
}
