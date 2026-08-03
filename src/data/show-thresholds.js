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

// §0.44.12 / §0.93 : 風雨の影響を受けない演目を屋内組と屋外組に分けて管理する。
//   屋内 (INDOOR) : 会場自体が屋内のため風 ・ 雨とも影響を受けない (Yuka さん確認済み : マジカル
//     ミュージックワールド ・ ワンダフル・フレンドシップ ・ ドリームス・テイク・フライトも屋内)。
//     熱バッジのみ継続表示 (屋内でも空調が弱く夏は暑いため)。
//   屋外 ・ 風のみ (OUTDOOR_WIND_ONLY) : 会場は屋外だがプロジェクションマッピング等で風による
//     演出変更/中止が原則発生しない演目。雨 ・ 熱は通常どおり屋外の影響を受ける
//     (§0.91 で「風の影響なし」に統一したが、Yuka さん指摘のとおり「屋外なら熱・雨は普通に
//     影響を受けるはず」で、屋内組と同列に扱うのは誤りだった。表示ラベルも屋内/屋外で出し分ける)。
//   風バッジ ・ 過去中止率 (風ベース) は両方とも出さない (風の影響を受けない、という点は共通)。
const INDOOR_WEATHERLESS_SHOWS = [
  /レインボー[・･]ルアウ/,
  /マジカルミュージックワールド/,
  /ワンダフル[・･]フレンドシップ/,
  /ドリームス[・･]テイク[・･]フライト/,
  /ダイヤモンド[・･]バラエティマスター/, // §0.84 : 屋内レストランショー。WEATHERLESS 未登録のため一般基準の風バッジが誤表示されていた不具合の修正。
];
const OUTDOOR_WIND_ONLY_SHOWS = [
  /スパークリング[・･]ジュビリー[・･]ナイト/, // 【環境演出】: 屋外のプロジェクションマッピング。風のみ影響なし、雨・熱は屋外どおり。
];

// その演目が風の影響を受けない (weatherless) かを返す。
export function isWeatherless(name) {
  if (!name) return false;
  return INDOOR_WEATHERLESS_SHOWS.some((re) => re.test(name)) || OUTDOOR_WIND_ONLY_SHOWS.some((re) => re.test(name));
}

// weatherless な演目の種別を返す ('indoor' | 'outdoor-wind-only' | null)。UI のラベル出し分けに使う。
export function weatherlessKind(name) {
  if (!name) return null;
  if (INDOOR_WEATHERLESS_SHOWS.some((re) => re.test(name))) return 'indoor';
  if (OUTDOOR_WIND_ONLY_SHOWS.some((re) => re.test(name))) return 'outdoor-wind-only';
  return null;
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
// §0.75 : 固有閾値か一般基準 (DEFAULT) かを UI で出し分けるため isDefault も返す。
// §0.87 : isDefault は「windBa/windCancel を個別上書きしたか」だけで判定する。旧実装は
//   SHOW_THRESHOLDS に 1 件でもヒットすれば isDefault:false にしていたため、Reach for the Stars
//   (pyroLimit のみ上書き) が「個別検証済みの風バ/中止基準」であるかのように (一般基準) 注記なしで
//   表示されていた (実際の windBa/windCancel は DEFAULT のまま)。
export function thresholdForShow(name) {
  const hit = name ? SHOW_THRESHOLDS.find((t) => t.match.test(name)) : null;
  if (!hit) return { ...DEFAULT_THRESHOLD, isDefault: true };
  const isDefault = hit.windBa === undefined && hit.windCancel === undefined;
  return { ...DEFAULT_THRESHOLD, ...hit, isDefault };
}
