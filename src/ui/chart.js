// 詳細パネルの時系列折れ線 (§3.4)。Chart.js (CDN グローバル) を使う。
// 左Y=降水確率(%)、右Y=風速(m/s)+10m/s パレード中止帯、ショー時刻の縦線。
// 別パネルで気温 / 体感温度。
// §0.37-11 : 色は指標別 (降水=青 / 風速=ティール / 気温=赤 / 体感=橙)、ソースは線種で区別
//   (Open-Meteo=実線 ・ 気象庁ほか=破線)。指標がひと目で分かるようにする。

import { allShowMarkers } from '../data/showSchedule.js';

// §0.37-11 指標別カラー
const METRIC_COLOR = {
  pop: '#4A90D2', // 降水確率 = 青
  wind: '#3A8AB8', // 風速 = ティール
  temp: '#D24A4A', // 気温 = 赤
  feelsLike: '#E89A3C', // 体感 = 橙
};
const SOURCE_LABEL = { 'open-meteo': 'Open-Meteo', jma: '気象庁', openweather: 'OpenWeather' };
// ソースを線種で区別 (主要ソース Open-Meteo は実線、それ以外は破線)
const sourceDash = (source) => (source === 'open-meteo' ? [] : [6, 3]);

function destroy(canvas) {
  if (canvas._chart) canvas._chart.destroy();
}

function points(f, key) {
  return (f.hourly || []).map((p) => ({ x: p.hour, y: p[key] }));
}

// ショー時刻の縦線
function showLinePlugin(park, date) {
  return {
    id: 'showLines',
    afterDatasetsDraw(chart) {
      const x = chart.scales.x;
      const { ctx, chartArea } = chart;
      ctx.save();
      for (const mk of allShowMarkers(park, date)) {
        if (mk.hour < x.min || mk.hour > x.max) continue;
        const px = x.getPixelForValue(mk.hour);
        ctx.beginPath();
        ctx.setLineDash(mk.priority === 'high' ? [] : [4, 3]);
        ctx.strokeStyle = mk.priority === 'high' ? 'rgba(47,111,176,0.8)' : 'rgba(120,120,120,0.5)';
        ctx.lineWidth = mk.priority === 'high' ? 2 : 1;
        ctx.moveTo(px, chartArea.top);
        ctx.lineTo(px, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = mk.priority === 'high' ? '#2f6fb0' : '#888';
        ctx.font = '10px sans-serif';
        ctx.fillText(mk.time, px + 3, chartArea.top + 10);
      }
      ctx.restore();
    },
  };
}

function baseXScale() {
  return {
    type: 'linear',
    min: 9,
    max: 22,
    ticks: { stepSize: 1, callback: (v) => `${v}時` },
    title: { display: false },
  };
}

// 1 系列分の dataset を作る (指標色 + ソース線種)
function makeDataset(f, metricKey, jpLabel, yAxisID) {
  const color = METRIC_COLOR[metricKey] || '#666';
  return {
    label: `${SOURCE_LABEL[f.source] || f.source} ${jpLabel}`,
    data: points(f, metricKey),
    borderColor: color,
    backgroundColor: color,
    borderDash: sourceDash(f.source),
    yAxisID,
    tension: 0.3,
    pointRadius: metricKey === 'pop' || metricKey === 'temp' ? 2 : 0,
  };
}

// 降水確率 + 風速チャート
export function renderPopWindChart(canvas, forecasts, park, date = null) {
  if (typeof Chart === 'undefined') return;
  destroy(canvas);
  const withHourly = forecasts.filter((f) => f.hourly && f.hourly.length > 0);
  const datasets = [];
  for (const f of withHourly) {
    datasets.push(makeDataset(f, 'pop', '降水確率', 'pop'));
    datasets.push(makeDataset(f, 'wind', '風速', 'wind'));
  }
  // eslint-disable-next-line no-undef
  canvas._chart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: baseXScale(),
        pop: { type: 'linear', position: 'left', min: 0, max: 100, title: { display: true, text: '降水確率 %' } },
        wind: {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 20,
          grid: { drawOnChartArea: false },
          title: { display: true, text: '風速 m/s' },
        },
      },
      plugins: { legend: { labels: { boxWidth: 12, font: { size: 10 } } } },
    },
    plugins: [showLinePlugin(park, date)],
  });
}

// 気温 + 体感温度チャート
export function renderTempChart(canvas, forecasts, park, date = null) {
  if (typeof Chart === 'undefined') return;
  destroy(canvas);
  const withHourly = forecasts.filter((f) => f.hourly && f.hourly.length > 0);
  const datasets = [];
  for (const f of withHourly) {
    datasets.push(makeDataset(f, 'temp', '気温', undefined));
    datasets.push(makeDataset(f, 'feelsLike', '体感', undefined));
  }
  // eslint-disable-next-line no-undef
  canvas._chart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: { x: baseXScale() },
      plugins: { legend: { labels: { boxWidth: 12, font: { size: 10 } } } },
    },
    plugins: [showLinePlugin(park, date)],
  });
}
