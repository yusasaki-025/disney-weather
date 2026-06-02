// 予報精度ダッシュボードの描画 (§0.32)。accuracy-log.json を集計し、
// 時系列グラフ ・ 平均誤差/バイアス表 ・ 的中/外し例を表示する。
// データが少ない (7 日未満) ときは案内のみ表示する。

import { esc } from './components.js';
import {
  getAccuracyLog,
  computeStats,
  timeSeries,
  notableExamples,
  ACCURACY_METRICS,
} from '../data/accuracyLogLoader.js';
import { computeSourceWeights, MIN_SAMPLES } from '../score/sourceWeight.js';

const SOURCE_LABEL = { jma: '気象庁', 'open-meteo': 'Open-Meteo', 'env-jp': '環境省 WBGT' };
const SOURCE_COLOR = { jma: '#e0823d', 'open-meteo': '#2f6fb0', 'env-jp': '#2d8f3e' };
const MIN_DAYS = 7;

const srcLabel = (s) => SOURCE_LABEL[s] || s;

function statsTableHtml(stats) {
  const srcs = Object.keys(stats);
  if (srcs.length === 0) return '';
  const head = ACCURACY_METRICS.map((m) => `<th>${esc(m.label)} RMS</th><th>${esc(m.label)} バイアス</th>`).join('');
  const rows = srcs
    .map((src) => {
      const cells = ACCURACY_METRICS.map((m) => {
        const st = stats[src][m.key];
        if (!st) return '<td>—</td><td>—</td>';
        const bias = st.bias > 0 ? `+${st.bias}` : `${st.bias}`;
        return `<td>${st.rms}${esc(m.unit)} <span class="acc-n">(n=${st.n})</span></td><td>${bias}${esc(m.unit)}</td>`;
      }).join('');
      return `<tr><th class="acc-src">${esc(srcLabel(src))}</th>${cells}</tr>`;
    })
    .join('');
  return `<div class="acc-section">
    <h2><span class="material-symbols-rounded" aria-hidden="true">analytics</span>ソース別 平均誤差・バイアス</h2>
    <p class="acc-note">RMS = 誤差の大きさ (小さいほど正確)・バイアス = 予報 − 実測 (＋ は過大予報・− は過小予報)</p>
    <div class="acc-table-wrap"><table class="acc-table"><thead><tr><th>ソース</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}

// §0.39.5 (#23) : ソース重み (MAE 学習) の可視化。重み 1.0 = 等価、> 1 = 信頼厚く採用、< 1 = 控えめ。
const WEIGHT_METRIC_LABEL = { wind: '風速', temp: '気温', wbgt: 'WBGT' };
function weightsHtml(stats) {
  const weights = computeSourceWeights(stats);
  const rows = Object.entries(weights)
    .map(([mk, bySrc]) => {
      const cells = Object.entries(bySrc)
        .map(([src, w]) => `<span class="acc-weight-src">${esc(srcLabel(src))} <strong>×${w.toFixed(2)}</strong></span>`)
        .join('');
      return `<li><span class="acc-weight-metric">${esc(WEIGHT_METRIC_LABEL[mk] || mk)}</span>${cells}</li>`;
    })
    .join('');
  const body = rows
    ? `<ul class="acc-weight-list">${rows}</ul>`
    : `<p class="acc-note">各指標とも ${MIN_SAMPLES} 日以上の比較が貯まると、誤差の小さいソースを重く扱う重み付けが自動で効き始めます (現在は全ソース等価で算定中)。</p>`;
  return `<div class="acc-section">
    <h2><span class="material-symbols-rounded" aria-hidden="true">balance</span>ソース重み (誤差学習)</h2>
    <p class="acc-note">過去の平均絶対誤差 (MAE) が小さいソースを重く扱い、総合スコアの加重平均に反映します。×1.0 が等価です。</p>
    ${body}
  </div>`;
}

function examplesHtml(ex) {
  const row = (e) =>
    `<li><span class="acc-date">${esc(e.date)}</span><span class="acc-ex-src">${esc(srcLabel(e.src))}</span>予報 ${e.predicted}m/s・実測 ${e.actual}m/s <span class="acc-err">(誤差 ${e.error}m/s)</span></li>`;
  if (ex.misses.length === 0) return '';
  return `<div class="acc-section">
    <h2><span class="material-symbols-rounded" aria-hidden="true">target</span>直近の的中例・外し例 (風速)</h2>
    <div class="acc-examples">
      <div><h3>外し例 (誤差大)</h3><ul class="acc-ex-list miss">${ex.misses.map(row).join('')}</ul></div>
      <div><h3>的中例 (誤差小)</h3><ul class="acc-ex-list hit">${ex.hits.map(row).join('')}</ul></div>
    </div>
  </div>`;
}

function drawChart(canvas, ts) {
  if (typeof Chart === 'undefined' || !canvas) return;
  const datasets = [];
  for (const src of Object.keys(ts.series)) {
    datasets.push({
      label: `${srcLabel(src)} 風速誤差`,
      data: ts.series[src].wind,
      borderColor: SOURCE_COLOR[src] || '#666',
      backgroundColor: SOURCE_COLOR[src] || '#666',
      spanGaps: true,
      tension: 0.3,
      pointRadius: 2,
    });
  }
  new Chart(canvas, {
    type: 'line',
    data: { labels: ts.dates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { title: { display: true, text: '風速誤差 (m/s)' }, beginAtZero: true } },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

export function renderDashboard(root) {
  const log = getAccuracyLog();

  if (log.length < MIN_DAYS) {
    root.innerHTML = `<div class="acc-empty">
      <span class="material-symbols-rounded" aria-hidden="true">hourglass_empty</span>
      <h2>データを蓄積中です</h2>
      <p>予報精度の比較には最低 ${MIN_DAYS} 日分の記録が必要です (現在 ${log.length} 日)。</p>
      <p class="acc-note">毎朝 <code>npm run snapshot-forecast</code> で予報を保存し、翌朝 <code>npm run track-accuracy</code> で前日の実測と比較すると、ここにソース別の精度が表示されます。</p>
    </div>`;
    return;
  }

  const stats = computeStats(log);
  const ts = timeSeries(log);
  const ex = notableExamples(log);

  root.innerHTML = `
    <div class="acc-section">
      <h2><span class="material-symbols-rounded" aria-hidden="true">show_chart</span>過去 ${log.length} 日の風速誤差 (日次)</h2>
      <div class="acc-chart"><canvas id="acc-chart"></canvas></div>
    </div>
    ${statsTableHtml(stats)}
    ${weightsHtml(stats)}
    ${examplesHtml(ex)}
    <p class="acc-disclaimer">本ダッシュボードは公開予報と気象庁アメダス (船橋)・環境省 WBGT 実測の比較に基づく参考値です。</p>
  `;

  drawChart(root.querySelector('#acc-chart'), ts);
}
