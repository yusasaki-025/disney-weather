// ショー別の風キャン閾値 (§0.30 / §5.5 の一律閾値を実態に合わせ差別化)。
// 出典: TSUBASA のディズニーパークブログ + X @tdr_syopare_can の風キャン基準 (一次情報)。
// 既定 (DEFAULT) は全ショー一律 (従来 §5.5 互換)。個別ショーは name 前方一致で上書き。
//
// windBa     : 風バ (一部演出変更 ・ バルーン/ダンサーカット等) が起こり始める最大瞬間風速 [m/s]
// windCancel : 公演中止が起こり始める最大瞬間風速 [m/s]
// pyroLimit  : 花火 (パイロ) カットが起こり始める最大瞬間風速 [m/s] (花火演目のみ)

export const DEFAULT_THRESHOLD = { windBa: 8, windCancel: 12 };

// name は showSchedule の表記ゆれを吸収するため部分一致キーで定義。
const SHOW_THRESHOLDS = [
  { match: /ハーモニー[・･]イン[・･]カラー/, windBa: 6, windCancel: 12 },
  { match: /スウィーツ[・･]?フルタイム/, windCancel: 12 },
  { match: /Reach for the Stars/i, pyroLimit: 8 },
  { match: /エレクトリカル/, windCancel: 10 },
  { match: /ビリーヴ/, windBa: 5, windCancel: 12 },
  { match: /スパークリング[・･]ジュビリー[・･]セレブレーション/, windCancel: 12 },
];

// §0.44.12 : 屋内ショー ・ プロジェクションマッピングは突風の影響を受けないため、
//   風バッジ ・ 過去中止率を出さない (熱バッジは屋内でも夏は暑いので継続)。name 部分一致で判定。
const WEATHERLESS_SHOWS = [
  /レインボー[・･]ルアウ/,
  /マジカルミュージックワールド/,
  /ワンダフル[・･]フレンドシップ/,
  /ドリームス[・･]テイク[・･]フライト/,
  /スパークリング[・･]ジュビリー[・･]ナイト/,
];

// その演目が屋内 ・ 天候影響なし (weatherless) かを返す。
export function isWeatherless(name) {
  if (!name) return false;
  return WEATHERLESS_SHOWS.some((re) => re.test(name));
}

// §0.46.6 : 「期間限定」タグを付ける季節限定演目。priority:high からの自動付与をやめ、
//   明示リストで判定する (ハーモニー ・ イン ・ カラー等の通年演目に誤って付かないように)。
const SEASONAL_SHOWS = [
  /スウィーツ[・･]?フルタイム/, // イッツ ・ ア ・ スウィーツフルタイム! (春の季節パレード)
  /Reach for the Stars/i,
  /スカイ[・･]フル[・･]オブ[・･]カラーズ/, // 期間限定花火
];

// その演目が季節限定 (「期間限定」タグ対象) かを返す。
export function isSeasonal(name) {
  if (!name) return false;
  return SEASONAL_SHOWS.some((re) => re.test(name));
}

// ショー名から閾値を返す (見つからなければ DEFAULT)。
export function thresholdForShow(name) {
  if (!name) return { ...DEFAULT_THRESHOLD };
  const hit = SHOW_THRESHOLDS.find((t) => t.match.test(name));
  return hit ? { ...DEFAULT_THRESHOLD, ...hit } : { ...DEFAULT_THRESHOLD };
}

// その日 ・ パークの high 優先ショー群から「最も中止しやすい (windCancel 最小)」閾値を返す。
// 日別スコアの風バッジ判定に使う (一番シビアなショーに合わせる = 安全側)。
export function strictestThreshold(shows) {
  let strict = null;
  for (const s of shows || []) {
    const t = thresholdForShow(s.name);
    if (!strict || t.windCancel < strict.windCancel) strict = t;
  }
  return strict || { ...DEFAULT_THRESHOLD };
}
