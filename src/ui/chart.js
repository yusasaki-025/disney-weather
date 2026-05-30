// 詳細パネルの時系列折れ線 (§3.4)。Chart.js (CDN グローバル) を使う。
// 左Y=降水確率(%)、右Y=風速(m/s)+10m/s パレード中止帯、ショー時刻の縦線。
// 別パネルで気温 / 体感温度。

import { allShowMarkers } from '../data/showSchedule.js';

const SOURCE_COLORS = {
  'open-meteo': '#2f6fb0',
  jma: '#e0823d',
  openweather: '#7a4fb5',
};
const SOURCE_LABEL = {
  'open-meteo': 'Open-Meteo',
  jma: '気象庁',
  openweather: 'OpenWeather',
};

function points(forecast, field) {
  return forecast.hourly.map((p) => ({ x: p.hour, y: p[field] }));
}

function destroy(canvas) {
  if (canvas && canvas._chart) {
    canvas._chart.destroy();
    canvas._chart = null;
  }
}

// 風 10m/s 以上の「パレード中止域」帯
const windBandPlugin = {
  id: 'windBand',
  beforeDatasetsDraw(chart) {
    const wind = chart.scales.wind;
    if (!wind) return;
    const { ctx, chartArea } = chart;
    const yTop = wind.getPixelForValue(Math.max(13, wind.max));
    const y10 = wind.getPixelForValue(10);
    ctx.save();
    ctx.fillStyle = 'rgba(210, 74, 74, 0.10)';
    ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, y10 - yTop);
    ctx.restore();
  },
};

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

// 降水確率 + 風速チャート
export function renderPopWindChart(canvas, forecasts, park, date = null) {
  if (typeof Chart === 'undefined') return;
  destroy(canvas);
  const withHourly = forecasts.filter((f) => f.hourly && f.hourly.length > 0);
  const datasets = [];
  for (const f of withHourly) {
    const color = SOURCE_COLORS[f.source] || '#666';
    datasets.push({
      label: `${SOURCE_LABEL[f.source]} 降水確率`,
      data: points(f, 'pop'),
      borderColor: color,
      backgroundColor: color,
      yAxisID: 'pop',
      tension: 0.3,
      pointRadius: 2,
    });
    datasets.push({
      label: `${SOURCE_LABEL[f.source]} 風速`,
      data: points(f, 'wind'),
      borderColor: color,
      borderDash: [6, 3],
      backgroundColor: color,
      yAxisID: 'wind',
      tension: 0.3,
      pointRadius: 0,
    });
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
        pop: {
          type: 'linear',
          position: 'left',
          min: 0,
          max: 100,
          title: { display: true, text: '降水確率 (%)' },
        },
        wind: {
          type: 'linear',
          position: 'right',
          min: 0,
          suggestedMax: 15,
          grid: { drawOnChartArea: false },
          title: { display: true, text: '風速 (m/s)' },
        },
      },
      plugins: { legend: { labels: { boxWidth: 12, font: { size: 10 } } } },
    },
    plugins: [windBandPlugin, showLinePlugin(park, date)],
  });
}

// 気温 / 体感温度チャート
export function renderTempChart(canvas, forecasts, park, date = null) {
  if (typeof Chart === 'undefined') return;
  destroy(canvas);
  const withHourly = forecasts.filter((f) => f.hourly && f.hourly.length > 0);
  const datasets = [];
  for (const f of withHourly) {
    const color = SOURCE_COLORS[f.source] || '#666';
    datasets.push({
      label: `${SOURCE_LABEL[f.source]} 気温`,
      data: points(f, 'temp'),
      borderColor: color,
      backgroundColor: color,
      tension: 0.3,
      pointRadius: 2,
    });
    datasets.push({
      label: `${SOURCE_LABEL[f.source]} 体感`,
      data: points(f, 'feelsLike'),
      borderColor: color,
      borderDash: [4, 3],
      backgroundColor: color,
      tension: 0.3,
      pointRadius: 0,
    });
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
        y: { type: 'linear', title: { display: true, text: '温度 (℃)' } },
      },
      plugins: { legend: { labels: { boxWidth: 12, font: { size: 10 } } } },
    },
    plugins: [showLinePlugin(park, date)],
  });
}
