// 持ち物 / 服装サジェスト (§3.8 / §0.38.1 拡充)。予報メトリクスから動的に生成する純関数。
// 入力は evaluateDay の metrics (popShowWindow/popMax, precipSum, tempMax, tempMin,
// wbgtShowWindow/wbgtMax, uvMax, gustShowWindow/gustMax, feelsLikeMax/Min)。
// 返り値は {icon, text}[] (table.js が <li> 化)。重複削除 + 8件上限。

import { showWindowOrMax } from '../utils/metrics.js';

// §0.62 : 各アイテムに reason (理由ラベル) + cat (色カテゴリ : rain/heat/cold/uv/wind/sun/show) を付与。
// 雨対策 (pop% + 日合計 precipSum mm ベース。時間 mm/h は metrics に無いため日合計で代替)
function rainGear(pop, precipSum) {
  const items = [];
  if (pop == null && precipSum == null) return items;
  const pp = pop ?? 0;
  const pr = precipSum ?? 0;
  if (pr >= 20 || pp >= 80) {
    items.push({ icon: 'dry_cleaning', text: 'ポンチョ必須', reason: '強雨', cat: 'rain' });
    items.push({ icon: 'checkroom', text: 'タオル・着替え', reason: '強雨', cat: 'rain' });
    items.push({ icon: 'umbrella', text: '折りたたみ傘', reason: '強雨', cat: 'rain' });
  } else if (pp >= 70 || pr >= 5) {
    items.push({ icon: 'dry_cleaning', text: 'ポンチョ必須', reason: '雨', cat: 'rain' });
    items.push({ icon: 'umbrella', text: '折りたたみ傘', reason: '雨', cat: 'rain' });
  } else if (pp >= 50 || pr >= 1) {
    items.push({ icon: 'umbrella', text: '折りたたみ傘', reason: '雨', cat: 'rain' });
    items.push({ icon: 'dry_cleaning', text: 'ポンチョ (パレード時)', reason: '雨', cat: 'rain' });
  } else if (pp >= 30) {
    items.push({ icon: 'umbrella', text: '折りたたみ傘', reason: '小雨', cat: 'rain' });
  }
  return items;
}

// 気温対策 (temp_max ベース)
function clothingFor(tempMax) {
  const items = [];
  if (tempMax == null) return items;
  if (tempMax >= 35) {
    items.push({ icon: 'air', text: 'ハンディファン', reason: '猛暑', cat: 'heat' });
    items.push({ icon: 'ac_unit', text: 'ネッククーラー・保冷剤', reason: '猛暑', cat: 'heat' });
    items.push({ icon: 'local_drink', text: '凍らせたペットボトル', reason: '猛暑', cat: 'heat' });
    items.push({ icon: 'beach_access', text: '日傘', reason: '猛暑', cat: 'heat' });
  } else if (tempMax >= 32) {
    items.push({ icon: 'air', text: 'ハンディファン', reason: '暑さ', cat: 'heat' });
    items.push({ icon: 'ac_unit', text: 'ネッククーラー', reason: '暑さ', cat: 'heat' });
    items.push({ icon: 'beach_access', text: '日傘', reason: '暑さ', cat: 'heat' });
  } else if (tempMax >= 28) {
    items.push({ icon: 'beach_access', text: '日傘', reason: '暑さ', cat: 'heat' });
    items.push({ icon: 'dry_cleaning', text: '汗拭きタオル', reason: '暑さ', cat: 'heat' });
    items.push({ icon: 'local_drink', text: '多めの水分', reason: '暑さ', cat: 'heat' });
  } else if (tempMax >= 22) {
    // 特に対策なし (薄手で OK)
  } else if (tempMax >= 15) {
    items.push({ icon: 'checkroom', text: '薄手の上着 (朝晩用)', reason: '朝晩冷え', cat: 'cold' });
  } else if (tempMax >= 10) {
    items.push({ icon: 'checkroom', text: '薄手のジャケット・カーディガン', reason: '寒さ', cat: 'cold' });
  } else if (tempMax >= 5) {
    items.push({ icon: 'checkroom', text: 'コート', reason: '寒さ', cat: 'cold' });
    items.push({ icon: 'dry_cleaning', text: 'マフラー', reason: '寒さ', cat: 'cold' });
  } else {
    items.push({ icon: 'checkroom', text: 'ヒートテック・ダウン', reason: '厳寒', cat: 'cold' });
    items.push({ icon: 'dry_cleaning', text: 'マフラー・手袋', reason: '厳寒', cat: 'cold' });
    items.push({ icon: 'local_fire_department', text: 'カイロ', reason: '厳寒', cat: 'cold' });
  }
  return items;
}

// WBGT 対策 (熱バ ・ 熱キャン域)
function wbgtGear(wbgt) {
  const items = [];
  if (wbgt == null) return items;
  if (wbgt >= 31) {
    items.push({ icon: 'cookie', text: '塩飴', reason: '熱中症対策', cat: 'heat' });
    items.push({ icon: 'checkroom', text: '着替え (帰り用)', reason: '熱中症対策', cat: 'heat' });
  } else if (wbgt >= 28) {
    items.push({ icon: 'cookie', text: '塩飴', reason: '熱中症対策', cat: 'heat' });
    items.push({ icon: 'local_drink', text: '多めの水分', reason: '熱中症対策', cat: 'heat' });
  }
  return items;
}

// UV 対策 (uv_max ベース)
function uvGear(uv) {
  const items = [];
  if (uv == null) return items;
  if (uv >= 8) {
    items.push({ icon: 'sunny', text: '日焼け止め SPF50', reason: '強UV', cat: 'uv' });
    items.push({ icon: 'sports', text: '帽子・サングラス', reason: '強UV', cat: 'uv' });
  } else if (uv >= 5) {
    items.push({ icon: 'sunny', text: '日焼け止め SPF30', reason: 'UV', cat: 'uv' });
    items.push({ icon: 'sports', text: '帽子', reason: '晴れ', cat: 'sun' });
  }
  return items;
}

// 風対策 (gust_max ベース)
function windGear(gust) {
  const items = [];
  if (gust == null) return items;
  if (gust >= 10) items.push({ icon: 'face', text: '髪留め・帽子の紐', reason: '強風', cat: 'wind' });
  else if (gust >= 5) items.push({ icon: 'face', text: '髪留め', reason: '風', cat: 'wind' });
  return items;
}

// 昼夜の体感差
function tempDiffGear(feelsMax, feelsMin) {
  const items = [];
  if (feelsMax == null || feelsMin == null) return items;
  const diff = feelsMax - feelsMin;
  if (diff >= 12) items.push({ icon: 'dry_cleaning', text: '羽織りもの・ストール', reason: '寒暖差', cat: 'cold' });
  else if (diff >= 8) items.push({ icon: 'checkroom', text: '羽織りもの', reason: '寒暖差', cat: 'cold' });
  return items;
}

// メイン : metrics から服装サジェストの配列を返す (重複削除 + 8件上限)
export function suggestOutfit(m) {
  const pop = showWindowOrMax(m, 'pop');
  const wbgt = showWindowOrMax(m, 'wbgt');
  const gust = showWindowOrMax(m, 'gust');
  const raw = [
    ...rainGear(pop, m.precipSum),
    ...clothingFor(m.tempMax),
    ...wbgtGear(wbgt),
    ...uvGear(m.uvMax),
    ...windGear(gust),
    ...tempDiffGear(m.feelsLikeMax, m.feelsLikeMin),
    // §0.44.6 : 天気に依存する提案のみ表示。天気不変の常備品 (歩きやすい靴 ・ モバイルバッテリー) は
    //           サジェストから除外し、ヘルプの「常備品」で別途案内する。
  ];
  // テキストで重複削除 (先勝ち)
  const seen = new Set();
  const items = [];
  for (const it of raw) {
    if (seen.has(it.text)) continue;
    seen.add(it.text);
    items.push(it);
  }
  // 8件上限。超過分は「他 N点」にまとめる
  if (items.length > 8) {
    const rest = items.length - 7;
    return [...items.slice(0, 7), { icon: 'more_horiz', text: `他 ${rest}点` }];
  }
  return items;
}
