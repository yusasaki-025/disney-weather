// §0.38.21+ (#18) : ショー個別の時刻別リスク情報 (風速 ・ WBGT)。
// 各ショーの開催時刻 (複数可) を含む hourly データから、全ソース横断の平均値を返す。
// 新規 fetch はせず既存 forecasts.hourly (gust / wbgt) のみ使用 (低リスク)。
// showRiskInfo(forecasts, times) -> { wind, wbgt } | null
//   forecasts : 予報オブジェクトの配列 (各 .hourly = [{ hour, gust, wbgt, ... }])
//   times     : "HH:MM" 文字列の配列 (ショー開催時刻)

export function showRiskInfo(forecasts, times) {
  if (!Array.isArray(forecasts) || !Array.isArray(times) || times.length === 0) return null;
  const hours = new Set(
    times
      .map((t) => parseInt(String(t).slice(0, 2), 10))
      .filter((h) => Number.isInteger(h)),
  );
  if (hours.size === 0) return null;

  // §0.51.4 / §0.65.1 : decimals で丸め桁を指定。風速 ・ WBGT とも小数 1 桁で呼ぶ。
  const meanAt = (field, decimals = 0) => {
    const vals = [];
    for (const f of forecasts) {
      if (!f || !Array.isArray(f.hourly)) continue;
      for (const p of f.hourly) {
        if (hours.has(p.hour) && p[field] != null) vals.push(p[field]);
      }
    }
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const f = 10 ** decimals;
    return Math.round(avg * f) / f;
  };

  // §0.43.2 : 「風」は平均風速 (windspeed_10m ・ sustained)。突風 (gust) は別途 cancelProbability 用の
  //           predWind (wind_gusts_10m) を使い、表示で「風 / 突風」を併記する。
  // §0.51.4 / §0.65.1 : 風速 ・ WBGT とも小数 1 桁で返す (表示精度を統一)。
  const wind = meanAt('wind', 1);
  const wbgt = meanAt('wbgt', 1);
  if (wind == null && wbgt == null) return null;
  return { wind, wbgt };
}
