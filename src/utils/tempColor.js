// 気温の暖寒色マッピング (§0.6-2)。暑い=赤系 / 快適=緑 / 寒い=青系。
// ダークモードは彩度を上げ明度を保った値を別に持つ (CSS 側 data-tb 上書きでも使用)。

const BANDS = [
  { min: 35, key: 'h3', light: '#9B1C1C', dark: '#F28B82' }, // 深紅
  { min: 30, key: 'h2', light: '#D24A4A', dark: '#F0938F' }, // 赤
  { min: 25, key: 'h1', light: '#E48732', dark: '#F0A95E' }, // オレンジ
  { min: 20, key: 'cf', light: '#2D8F3E', dark: '#6FCB7E' }, // 緑 (快適)
  { min: 15, key: 'w1', light: '#3A8AB8', dark: '#6FB8DD' }, // 青緑
  { min: 10, key: 'w2', light: '#3F6FAE', dark: '#7FA6DB' }, // 青
  { min: 5, key: 'w3', light: '#2C4D8E', dark: '#7E9BD8' }, // 濃青
  { min: -Infinity, key: 'w4', light: '#1A2D5E', dark: '#9AAEDC' }, // 紺
];

function band(celsius) {
  return BANDS.find((b) => celsius >= b.min);
}

// 気温 (℃) → 文字色。欠損は null。
export function getTempColor(celsius, dark = false) {
  if (celsius == null || Number.isNaN(celsius)) return null;
  const b = band(celsius);
  return dark ? b.dark : b.light;
}

// ダークモード CSS 上書き用のバンドキー
export function getTempBandKey(celsius) {
  if (celsius == null || Number.isNaN(celsius)) return null;
  return band(celsius).key;
}

export { BANDS as TEMP_BANDS };
