// データ鮮度ラベルの算出 (§3.14)。取得時刻 (ISO8601) からの経過を人間可読にする。

import { ageMs } from './date.js';

// 取得元の更新サイクル (ツールチップ用)
export const UPDATE_CYCLE = {
  jma: '気象庁は 5時 / 11時 / 17時頃に更新',
  'open-meteo': 'Open-Meteo は概ね1時間ごとに更新',
  openweather: 'OpenWeather は数十分ごとに更新',
};

// '今' / '◯分前' / '◯時間前'
export function freshnessLabel(iso) {
  if (!iso) return '';
  const min = Math.floor(ageMs(iso) / 60000);
  if (min <= 0) return '今';
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  return `${hour}時間前`;
}
