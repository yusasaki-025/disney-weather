// 指標の共通ヘルパー (§0.68.C ・ 監査 C-3/C-6 で重複を集約)。

// ショー窓の値があればそれを、無ければ日次最大の加重平均を返す。
// key : 'gust' | 'pop' | 'wbgt' | 'wind' (それぞれ <key>ShowWindow / <key>Max が対応)。
export function showWindowOrMax(m, key) {
  return m?.[`${key}ShowWindow`] ?? m?.[`${key}Max`] ?? null;
}

// 小数 1 桁に丸める (null はそのまま)。表示前の数値丸め用 (§0.65.1)。
export function round1(x) {
  return x == null ? null : Math.round(x * 10) / 10;
}
