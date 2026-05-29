// 持ち物 / 服装サジェスト (§3.8)。予報メトリクスから動的に生成する純関数。

export function suggestOutfit(m) {
  const out = [];
  const tempMax = m.tempMax;
  const pop = m.popShowWindow != null ? m.popShowWindow : m.popMax;
  const uv = m.uvMax;
  const feelsDiff =
    m.feelsLikeMax != null && m.feelsLikeMin != null ? m.feelsLikeMax - m.feelsLikeMin : null;

  if (tempMax != null && tempMax < 12) {
    out.push({ icon: 'ac_unit', text: 'ヒートテック / コート (冷え込みます)' });
  }
  if (tempMax != null && tempMax > 28) {
    out.push({ icon: 'wb_sunny', text: '日傘 / 帽子 / 凍らせたペットボトル' });
  }
  if (pop != null && pop >= 50) {
    out.push({ icon: 'umbrella', text: 'ポンチョ (傘はキャストに止められることあり)' });
  }
  if (uv != null && uv >= 7) {
    out.push({ icon: 'wb_sunny', text: '日焼け止め SPF50' });
  }
  if (feelsDiff != null && feelsDiff >= 10) {
    out.push({ icon: 'checkroom', text: '羽織りもの (昼夜の体感差が大きい)' });
  }
  if (out.length === 0) {
    out.push({ icon: 'check_circle', text: '特別な対策は不要そうです' });
  }
  return out;
}
