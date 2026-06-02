// §0.63.2 : 「この日の概要」の解説テキストを生成する純関数 (テンプレートベース)。
//   データの羅列でなく「要約」にするため、天気 + 警報 + 状況 (バッジ) + 霧雨注記 を数行にまとめる。
//   詳細データ (風/雨/熱のレンジ等) は「この日の気候」(§0.63.3) 側に分離。

// バッジ群から状況を 1 フレーズに要約 (最悪要素を優先)。
function conditionPhrase(badges, drizzle) {
  const wind = badges?.wind?.text || '';
  const rain = badges?.rain?.text || '';
  const wbgt = badges?.wbgt?.text || '';
  if (drizzle) return '弱い雨が続きますが、ショーは原則開催の見込み';
  if (rain === '中止' || wind === '中止') return '雨や風でショー中止のリスクが高い一日';
  if (rain === '雨キャン' || wind === '中止リスク') return '雨や風でショー中止の可能性あり';
  if ((wind === '風バ' && rain === '雨バ')) return '風と雨にやや注意';
  if (wind === '風バ' || wind === '中止リスク') return '風がやや強め';
  if (rain === '雨バ' || rain === '雨キャン') return '雨がぱらつく可能性あり';
  if (wbgt === '熱バ' || wbgt === '熱キャン' || wbgt === '中止') return '暑さに注意';
  return 'ショー鑑賞に大きな支障はなさそう';
}

// 解説テキストを返す。weather は正規化済みの天気概況文字列、warningLabel は警報名 (なければ空)。
// daySummary({ weather, warningLabel, badges, drizzle }) -> string
export function daySummary({ weather, warningLabel, badges, drizzle } = {}) {
  const out = [];
  if (weather) out.push(weather);
  if (warningLabel) out.push(`${warningLabel}が出ています`);
  out.push(conditionPhrase(badges, drizzle));
  return `${out.filter(Boolean).join('。')}。`;
}
