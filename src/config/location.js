// 観測地点 ・ コードの集約 (§3.13)。
// 千葉県全体だと舞浜の風が読めないため、二次細分 ・ アメダス ・ グリッドを使い分ける。

export const LOCATION = {
  // 風予報 (Open-Meteo / OpenWeather) : 舞浜駅直近のグリッド
  coords: { lat: 35.6329, lon: 139.8804 },
  // 予報 (気象庁 Forecast) : 千葉県北西部 (浦安市を含む二次細分)
  jmaForecastArea: '120010',
  // 観測 (アメダス) : 舞浜近傍。船橋 ＋ 千葉を両取りして平均 (的中追跡 Phase 2 用)
  amedasPoints: ['44132', '44166'],
  // WBGT (環境省) : 浦安直近の予測値。44132 = 船橋
  wbgtPoint: '44132',
};
