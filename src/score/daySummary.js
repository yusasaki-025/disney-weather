// §0.77 : 「この日の概要」の解説テキスト。曖昧表現 (原則 / ことが多い / 見込み) を排し、
//   ショーの開催可否を 3 段階 (開催予定 / 中止の可能性 / 中止濃厚) で明示する。
//   主要ショー (priority high) があれば時間帯ラベル (昼のパレード / ナイトショー) を併記して
//   「結局ショーは見れるのか」を一目で。§0.79 : 個別ショー名は改廃が多いため出さない。

const ELEM = { wind: '風', rain: '雨', wbgt: '熱' };

// バッジ text → severity (0 通常 / 1 注意 / 2 中止リスク ・ キャン / 3 ほぼ中止)。
function sev(badge) {
  const t = badge?.text;
  if (t === '中止') return 3;
  if (t === '中止リスク' || t === '雨キャン' || t === '熱キャン') return 2;
  if (t === '風バ' || t === '雨バ' || t === '熱バ') return 1;
  return 0;
}

// バッジ群 → ショー状況の述語 (「{ショー名} 等のショーは ___」に入る形)。警告なしは null。
function statusPhrase(badges) {
  const entries = [
    ['wind', badges?.wind],
    ['rain', badges?.rain],
    ['wbgt', badges?.wbgt],
  ];
  const worst = Math.max(0, ...entries.map(([, b]) => sev(b)));
  if (worst === 3) return '中止濃厚';
  if (worst === 2) return '中止の可能性が高い';
  const warns = entries.filter(([, b]) => sev(b) === 1);
  if (warns.length >= 2) return `中止の可能性 (${warns.map(([k]) => ELEM[k]).join('・')})`;
  if (warns.length === 1) return `開催予定 (${warns[0][1].text}可能性)`;
  return null;
}

// 解説テキストを返す。
// daySummary({ weather, warningLabel, badges, highShows }) -> string
//   highShows : priority high の時間帯ラベル [{ label }] (任意 ・ 概要に併記。ショー名は含めない)。
export function daySummary({ weather, warningLabel, badges, highShows } = {}) {
  const out = [];
  if (weather) out.push(weather);
  if (warningLabel) out.push(`${warningLabel}発表中`);

  const phrase = statusPhrase(badges);
  if (!phrase) {
    out.push('全ショー開催予定');
  } else if (highShows && highShows.length) {
    out.push(`${highShows[0].label} 等のショーは${phrase}`);
  } else {
    out.push(`屋外ショーは${phrase}`);
  }
  return `${out.filter(Boolean).join('。')}。`;
}
