// 天気概況テキスト → Material Symbol 名 ＋ 色 (§0.6.6)。
// JMA は複合表記 ("晴れ 時々 くもり" 等) なのでキーワードの優先順で判定する。

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
