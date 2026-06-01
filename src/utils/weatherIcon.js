// 天気概況テキスト → Material Symbol 名 ＋ 色 (§0.6.6)。
// JMA は複合表記 ("晴れ 時々 くもり" 等) なのでキーワードの優先順で判定する。

import { normalizeWeatherText } from './weatherText.js';

export function getWeatherIcon(weatherText) {
  const t = weatherText || '';
  if (t.includes('雷')) return { name: 'bolt', color: '#9B59B6' };
  if (t.includes('雪')) return { name: 'ac_unit', color: '#3A8AB8' };
  if (t.includes('大雨') || t.includes('暴風')) return { name: 'thunderstorm', color: '#2C4D8E' };
  if (t.includes('雨')) return { name: 'rainy', color: '#3F6FAE' };
  if (t.includes('霧')) return { name: 'foggy', color: '#A0A8B5' };

  const sunny = t.includes('晴');
  const cloudy = t.includes('曇') || t.includes('くもり');
  if (sunny && cloudy) {
    // 先頭が晴れなら「晴れ時々曇り」扱い、曇りが先なら曇り扱い
    return t.trimStart().startsWith('晴')
      ? { name: 'partly_cloudy_day', color: '#E48732' }
      : { name: 'cloud', color: '#7C8696' };
  }
  if (cloudy) return { name: 'cloud', color: '#7C8696' };
  if (sunny) return { name: 'wb_sunny', color: '#F2A93B' };
  return { name: 'cloud', color: '#7C8696' };
}

// §0.42.3 : 複合天気 (「晴れ、夜曇り所により、昼前まで霧」等) を「、」区切りで分解し、
// 各要素のアイコンを並列で返す。連続重複は除去。1 要素なら単一天気と同じ。
export function getWeatherIcons(weatherText) {
  const normalized = normalizeWeatherText(weatherText);
  if (!normalized) return [];
  const segments = normalized.split('、').filter(Boolean);
  const icons = [];
  for (const seg of segments) {
    const ic = getWeatherIcon(seg);
    const prev = icons[icons.length - 1];
    if (!prev || prev.name !== ic.name) icons.push(ic);
  }
  return icons.length ? icons : [getWeatherIcon(weatherText)];
}
