// §0.39.4 (#22) : 屋外アトラクションの運休予測閾値 (最大瞬間風速 m/s)。
// 公式の確定値ではなく、過去の運休傾向からの推定値 (UI に「推定」と明記する)。
// 屋外コースター ・ 高所 ・ 水上ライドは強風で順次クローズされる傾向がある。
// windCutoff : この風速 (m/s) 以上で運休が予測される目安。
export const ATTRACTION_THRESHOLDS = {
  'ビッグサンダー・マウンテン': { park: 'TDL', windCutoff: 15, type: 'coaster' },
  'スプラッシュ・マウンテン': { park: 'TDL', windCutoff: 15, type: 'coaster' },
  'ガジェットのゴーコースター': { park: 'TDL', windCutoff: 14, type: 'coaster' },
  'レイジングスピリッツ': { park: 'TDS', windCutoff: 13, type: 'coaster' },
  'フランダーのフライングフィッシュコースター': { park: 'TDS', windCutoff: 14, type: 'coaster' },
  'アクアトピア': { park: 'TDS', windCutoff: 14, type: 'water' },
  'ディズニーシー・トランジットスチーマーライン': { park: 'TDS', windCutoff: 15, type: 'water' },
};
