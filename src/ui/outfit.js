// 持ち物 / 服装サジェスト (§3.8 / §0.38.1 拡充)。予報メトリクスから動的に生成する純関数。
// 入力は evaluateDay の metrics (popShowWindow/popMax, precipSum, tempMax, tempMin,
// wbgtShowWindow/wbgtMax, uvMax, gustShowWindow/gustMax, feelsLikeMax/Min)。
// 返り値は {icon, text}[] (table.js が <li> 化)。重複削除 + 8件上限。

// 雨対策 (pop% + 日合計 precipSum mm ベース。時間 mm/h は metrics に無いため日合計で代替)
function rainGear(pop, precipSum) {
  const items = [];
  if (pop == null && precipSum == null) return items;
  const pp = pop ?? 0;
  const pr = precipSum ?? 0;
  if (pr >= 20 || pp >= 80) {
    items.push({ icon: 'dry_cleaning', text: 'ポンチョ必須' });
    items.push({ icon: 'checkroom', text: 'タオル ・ 着替え' });
    items.push({ icon: 'umbrella', text: '折りたたみ傘' });
  } else if (pp >= 70 || pr >= 5) {
    items.push({ icon: 'dry_cleaning', text: 'ポンチョ必須' });
    items.push({ icon: 'umbrella', text: '折りたたみ傘' });
  } else if (pp >= 50 || pr >= 1) {
    items.push({ icon: 'umbrella', text: '折りたたみ傘' });
    items.push({ icon: 'dry_cleaning', text: 'ポンチョ (パレード時)' });
  } else if (pp >= 30) {
    items.push({ icon: 'umbrella', text: '折りたたみ傘' });
  }
  return items;
}

// 気温対策 (temp_max ベース)
function clothingFor(tempMax) {
  const items = [];
  if (tempMax == null) return items;
  if (tempMax >= 35) {
    items.push({ icon: 'air', text: 'ハンディファン' });
    items.push({ icon: 'ac_unit', text: 'ネッククーラー ・ 保冷剤' });
    items.push({ icon: 'local_drink', text: '凍らせたペットボトル' });
    items.push({ icon: 'beach_access', text: '日傘' });
  } else if (tempMax >= 32) {
    items.push({ icon: 'air', text: 'ハンディファン' });
    items.push({ icon: 'ac_unit', text: 'ネッククーラー' });
    items.push({ icon: 'beach_access', text: '日傘' });
  } else if (tempMax >= 28) {
    items.push({ icon: 'beach_access', text: '日傘' });
    items.push({ icon: 'dry_cleaning', text: '汗拭きタオル' });
    items.push({ icon: 'local_drink', text: '多めの水分' });
  } else if (tempMax >= 22) {
    // 特に対策なし (薄手で OK)
  } else if (tempMax >= 15) {
    items.push({ icon: 'checkroom', text: '薄手の上着 (朝晩用)' });
  } else if (tempMax >= 10) {
    items.push({ icon: 'checkroom', text: '薄手のジャケット ・ カーディガン' });
  } else if (tempMax >= 5) {
    items.push({ icon: 'checkroom', text: 'コート' });
    items.push({ icon: 'dry_cleaning', text: 'マフラー' });
  } else {
    items.push({ icon: 'checkroom', text: 'ヒートテック ・ ダウン' });
    items.push({ icon: 'dry_cleaning', text: 'マフラー ・ 手袋' });
    items.push({ icon: 'local_fire_department', text: 'カイロ' });
  }
  return items;
}

// WBGT 対策 (熱バ ・ 熱キャン域)
function wbgtGear(wbgt) {
  const items = [];
  if (wbgt == null) return items;
  if (wbgt >= 31) {
    items.push({ icon: 'cookie', text: '塩飴' });
    items.push({ icon: 'checkroom', text: '着替え (帰り用)' });
  } else if (wbgt >= 28) {
    items.push({ icon: 'cookie', text: '塩飴' });
    items.push({ icon: 'local_drink', text: '多めの水分' });
  }
  return items;
}

// UV 対策 (uv_max ベース)
function uvGear(uv) {
  const items = [];
  if (uv == null) return items;
  if (uv >= 8) {
    items.push({ icon: 'sunny', text: '日焼け止め SPF50' });
    items.push({ icon: 'sports', text: '帽子 ・ サングラス' });
  } else if (uv >= 5) {
    items.push({ icon: 'sunny', text: '日焼け止め SPF30' });
    items.push({ icon: 'sports', text: '帽子' });
  }
  return items;
}

// 風対策 (gust_max ベース)
function windGear(gust) {
  const items = [];
  if (gust == null) return items;
  if (gust >= 10) items.push({ icon: 'face', text: '髪留め ・ 帽子の紐' });
  else if (gust >= 5) items.push({ icon: 'face', text: '髪留め' });
  return items;
}

// 昼夜の体感差
function tempDiffGear(feelsMax, feelsMin) {
  const items = [];
  if (feelsMax == null || feelsMin == null) return items;
  const diff = feelsMax - feelsMin;
  if (diff >= 12) items.push({ icon: 'dry_cleaning', text: '羽織りもの ・ ストール' });
  else if (diff >= 8) items.push({ icon: 'checkroom', text: '羽織りもの' });
  return items;
}

// メイン : metrics から服装サジェストの配列を返す (重複削除 + 8件上限)
export function suggestOutfit(m) {
  const pop = m.popShowWindow != null ? m.popShowWindow : m.popMax;
  const wbgt = m.wbgtShowWindow != null ? m.wbgtShowWindow : m.wbgtMax;
  const gust = m.gustShowWindow != null ? m.gustShowWindow : m.gustMax;
  const raw = [
    ...rainGear(pop, m.precipSum),
    ...clothingFor(m.tempMax),
    ...wbgtGear(wbgt),
    ...uvGear(m.uvMax),
    ...windGear(gust),
    ...tempDiffGear(m.feelsLikeMax, m.feelsLikeMin),
    // 全日共通
    { icon: 'directions_run', text: '歩きやすい靴' },
    { icon: 'battery_charging_full', text: 'モバイルバッテリー' },
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
