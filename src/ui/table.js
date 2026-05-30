// 候補日比較テーブル + 行クリックで開く時系列詳細パネル (§3.2, §3.4)。

import {
  esc,
  fmtNum,
  dateLabel,
  scorePillHtml,
  cancelBadgeHtml,
  subscoreHtml,
  scoreAria,
} from './components.js';
import { BANDS } from '../score/scoring.js';
import { renderPopWindChart, renderTempChart } from './chart.js';
import { suggestOutfit } from './outfit.js';
import { SHOW_SCHEDULE } from '../data/showSchedule.js';
import { freshnessLabel } from '../utils/freshness.js';
import { nowcastHtml } from './nowcast.js';
import { getTempColor, getTempBandKey } from '../utils/tempColor.js';
import { getWeatherIcon } from '../utils/weatherIcon.js';

// 気温セルを暖寒色で着色 (§0.6-2)。data-tb はダークモード CSS 上書き用。
function tempSpan(c) {
  if (c == null) return '—';
  return `<span class="tcolor" data-tb="${getTempBandKey(c)}" style="color:${getTempColor(c)}">${fmtNum(c, 0, '°')}</span>`;
}

const SOURCE_LABEL = { jma: '気象庁', 'open-meteo': 'Open-Meteo', openweather: 'OpenWeather' };
const CAT_ICON = { wind: 'air', rain: 'umbrella', wbgt: 'thermostat' };

// 風 / 雨 / 熱セル : カテゴリアイコン(頭) ＋ 実数値(主) ＋ バッジ(副) (§0.5.2 / §0.6.6-3)
function metricCell(kind, valueHtml, badge, title = '') {
  return `<td${title ? ` title="${esc(title)}"` : ''}>
    <div class="metric-cell">
      <span class="cat-val"><span class="material-symbols-rounded cat-icon" aria-hidden="true">${CAT_ICON[kind]}</span>${valueHtml}</span>
      ${cancelBadgeHtml(badge)}
    </div>
  </td>`;
}

function dayBadges(dt) {
  const out = [];
  if (dt.holidayName) out.push(`<span class="badge-holiday">${esc(dt.holidayName)}</span>`);
  if (dt.vacation) out.push(`<span class="badge-vacation">${esc(dt.vacation)}</span>`);
  return out.join(' ');
}

// その日の WBGT 表示元 (環境省 > 推定)
function wbgtSourceLabel(forecasts) {
  const sources = forecasts.map((f) => f.wbgtSource).filter(Boolean);
  if (sources.includes('env-jp')) return '環境省';
  if (sources.includes('derived')) return '推定';
  return null;
}

function sourceCellHtml(source, forecast, status) {
  if (status && !status.ok) {
    return `<td class="source-cell"><span class="cell-fail">取得失敗 <button type="button" data-retry>再試行</button></span></td>`;
  }
  if (!forecast) {
    return `<td class="source-cell is-empty">—</td>`;
  }
  const temp =
    forecast.tempMax != null || forecast.tempMin != null
      ? `${tempSpan(forecast.tempMax)} / ${tempSpan(forecast.tempMin)}`
      : '—';
  // 鮮度はステータスバーに集約 (§0.6-4)。セルはホバー title で補助表示のみ。
  const title = `${SOURCE_LABEL[source] || source} ${freshnessLabel(forecast.fetchedAt)}`;
  // 大きな天気アイコン (40px) を主役に (§0.6.6-2)
  const wi = getWeatherIcon(forecast.weatherText);
  return `<td class="source-cell" title="${esc(title)}">
    <span class="material-symbols-rounded weather-icon" style="color:${wi.color}" aria-hidden="true">${wi.name}</span>
    <div class="sc-sub">${esc(forecast.weatherText || '')}</div>
    <div class="sc-main">${temp}</div>
    <div class="sc-sub">雨 ${fmtNum(forecast.popMax, 0, '%')}</div>
  </td>`;
}

function detailPanelHtml(row) {
  const PRIORITY_NOTE = { high: ' (メイン算定窓)', medium: ' (補助)', low: ' (参考)' };
  const showRowsFor = (p) =>
    (SHOW_SCHEDULE[p] || [])
      .map(
        (s) =>
          `<div class="${s.priority === 'high' ? 'st-high' : ''}">${esc(s.name)} : ${esc(s.time)}${
            PRIORITY_NOTE[s.priority] || ''
          }</div>`,
      )
      .join('');
  const outfit = suggestOutfit(row.eval.metrics)
    .map(
      (o) =>
        `<li><span class="material-symbols-rounded" aria-hidden="true">${o.icon}</span>${esc(o.text)}</li>`,
    )
    .join('');
  const decided = row.isDecided;
  const ng = row.isNg;
  // §0.6.8 : 左カラム = 情報、右カラム = グラフ。
  return `<div class="detail-panel">
    <div class="detail-info">
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">schedule</span>時間帯スコア (朝 ･ 昼 ･ 夜)</h4>
        <div class="subscore-detail">${subscoreHtml(row.eval.subscores, BANDS)}</div>
      </div>
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">theater_comedy</span>ショー ･ パレード</h4>
        <div class="park-tabs" role="tablist" aria-label="パーク切替">
          <button class="park-tab active" role="tab" data-park-tab="TDL" type="button">TDL</button>
          <button class="park-tab" role="tab" data-park-tab="TDS" type="button">TDS</button>
        </div>
        <div class="show-times" data-park-shows="TDL">${showRowsFor('TDL')}</div>
        <div class="show-times" data-park-shows="TDS" hidden>${showRowsFor('TDS')}</div>
      </div>
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">checkroom</span>持ち物 ･ 服装</h4>
        <ul class="outfit-list">${outfit}</ul>
      </div>
      ${nowcastHtml(row.date)}
      <div class="detail-actions">
        <button type="button" class="btn ${decided ? 'btn-primary' : ''}" data-action="decide">
          <span class="material-symbols-rounded" aria-hidden="true">event_available</span>${decided ? '決定済み' : 'この日に決めた'}
        </button>
        <button type="button" class="btn" data-action="ng">
          <span class="material-symbols-rounded" aria-hidden="true">${ng ? 'undo' : 'block'}</span>${ng ? 'NG 解除' : '同行者 NG'}
        </button>
      </div>
    </div>
    <div class="detail-charts">
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">water_drop</span>時系列 (降水確率 ･ 風速)</h4>
        <div class="chart-box"><div style="position:relative;height:240px"><canvas data-chart="popwind"></canvas></div></div>
      </div>
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">thermostat</span>気温 ･ 体感温度</h4>
        <div class="chart-box"><div style="position:relative;height:200px"><canvas data-chart="temp"></canvas></div></div>
      </div>
    </div>
  </div>`;
}

export function renderTable(els, rows, state, sources, sourceStatus, handlers) {
  const { thead, tbody } = els;

  // ヘッダー
  const catHead = (kind, label) =>
    `<th><span class="material-symbols-rounded cat-head" aria-hidden="true">${CAT_ICON[kind]}</span><span class="cat-head-label">${label}</span></th>`;
  thead.innerHTML = `<tr>
    <th class="col-date">日付</th>
    <th>スコア</th>
    ${catHead('wind', '風')}
    ${catHead('rain', '雨')}
    ${catHead('wbgt', '熱 (WBGT)')}
    ${sources.map((s) => `<th>${esc(SOURCE_LABEL[s] || s)}</th>`).join('')}
    <th class="col-chev" aria-hidden="true"></th>
  </tr>`;

  // フィルター結果が 0 件 (おすすめ日のみ ON で該当無し等) のときは案内を出す
  if (rows.length === 0) {
    const colspan = 6 + sources.length;
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="table-empty">
      今は条件に合う日がありません。フィルターを外すと全日が表示されます。
    </td></tr>`;
    return;
  }

  // 連休グルーピング: 直前行も休日なら境界に枠
  tbody.innerHTML = rows
    .map((row, i) => {
      const dt = row.dayType;
      const prevOff = i > 0 ? rows[i - 1].dayType.isOff : false;
      const groupStart = dt.isOff && !prevOff && state.sortBy === 'date';
      // 風 / 雨 / 熱の実数値 (ショー窓優先) (§0.5.2)
      const m = row.eval.metrics;
      const gust = m.gustShowWindow != null ? m.gustShowWindow : m.gustMax;
      const pop = m.popShowWindow != null ? m.popShowWindow : m.popMax;
      const windVal = gust != null ? `${fmtNum(gust, 0)}<span class="unit">m/s</span>` : '—';
      const rainVal =
        pop != null
          ? `${fmtNum(pop, 0)}%${m.precipSum != null && m.precipSum >= 0.5 ? ` ${fmtNum(m.precipSum, 1)}mm` : ''}`
          : '—';
      const wbgtLabel = wbgtSourceLabel(Object.values(row.forecasts));
      // セルは数値のみ (列ヘッダーが「熱 (WBGT)」なので WBGT/(推定) は冗長)。詳細は title で補助。
      const wbgtVal = m.wbgtMax != null ? `${fmtNum(m.wbgtMax, 0)}` : '—';
      // §0.13.2 : スコアは平均ベース。ピーク (最大) は補助ツールチップに表示。
      const peakTxt = (peak, unit) =>
        peak ? `ピーク ${fmtNum(peak.value, 0)}${unit} (${peak.hour}時)` : '';
      const windTitle = peakTxt(m.gustPeak, 'm/s');
      const wbgtBase = wbgtLabel === '環境省' ? 'WBGT 環境省取得値' : 'WBGT 簡易計算による推定値';
      const wbgtPeakTxt = peakTxt(m.wbgtPeak, '');
      const wbgtTitle = wbgtPeakTxt ? `${wbgtBase} ・ ${wbgtPeakTxt}` : wbgtBase;

      // §0.16 : バッジ格下げ時はスコアセルに理由ツールチップ
      let scoreTitle = '';
      if (row.eval.capped) {
        const ev = row.eval;
        const worstBadge = [
          ['wind', ev.badges.wind, peakTxt(m.gustPeak, 'm/s')],
          ['rain', ev.badges.rain, peakTxt(m.popPeak, '%')],
          ['wbgt', ev.badges.wbgt, peakTxt(m.wbgtPeak, '')],
        ].find(([, b]) => `${b.text}` && b.level >= 2 && b.text !== '—');
        const reasonBadge = worstBadge ? `バッジ「${worstBadge[1].text}」${worstBadge[2] ? ` (${worstBadge[2]})` : ''}` : 'バッジ判定';
        scoreTitle = `平均値スコア ${ev.rawScore} だが ${reasonBadge} により「${ev.symbol.label}」に格下げ`;
      }

      const cls = [
        'row-main',
        row.isDecided ? 'is-decided' : '',
        row.isNg ? 'is-ng' : '',
        groupStart ? 'holiday-group-start' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const mainRow = `<tr class="${cls}" data-date="${row.date}" tabindex="0"
        role="button" aria-expanded="false" aria-label="${esc(scoreAria(row.date, row.eval))}">
        <td class="col-date">
          <div class="date-cell">
            <span class="date-main">${esc(dateLabel(row.date))}</span>
            <span class="date-sub">${dayBadges(dt)}</span>
          </div>
        </td>
        <td${scoreTitle ? ` title="${esc(scoreTitle)}"` : ''}>${scorePillHtml(row.eval)}</td>
        ${metricCell('wind', windVal, row.eval.badges.wind, windTitle)}
        ${metricCell('rain', rainVal, row.eval.badges.rain)}
        ${metricCell('wbgt', wbgtVal, row.eval.badges.wbgt, wbgtTitle)}
        ${sources.map((s) => sourceCellHtml(s, row.forecasts[s], sourceStatus[s])).join('')}
        <td class="col-chev"><span class="material-symbols-rounded chevron" aria-hidden="true">expand_more</span></td>
      </tr>`;

      const colspan = 6 + sources.length;
      const detailRow = `<tr class="detail-row" data-detail="${row.date}" hidden>
        <td colspan="${colspan}"></td>
      </tr>`;
      return mainRow + detailRow;
    })
    .join('');

  // 行展開
  const openDetail = (date) => {
    const main = tbody.querySelector(`.row-main[data-date="${date}"]`);
    const detail = tbody.querySelector(`.detail-row[data-detail="${date}"]`);
    if (!main || !detail) return;
    const willOpen = detail.hidden;
    // 他を閉じる
    tbody.querySelectorAll('.detail-row').forEach((d) => {
      d.hidden = true;
      d.firstElementChild.innerHTML = '';
    });
    tbody.querySelectorAll('.row-main').forEach((r) => r.setAttribute('aria-expanded', 'false'));
    if (!willOpen) return;

    const row = rows.find((r) => r.date === date);
    detail.firstElementChild.innerHTML = detailPanelHtml(row);
    detail.hidden = false;
    main.setAttribute('aria-expanded', 'true');

    const forecasts = Object.values(row.forecasts).filter(Boolean);
    renderPopWindChart(detail.querySelector('[data-chart="popwind"]'), forecasts, state.park);
    renderTempChart(detail.querySelector('[data-chart="temp"]'), forecasts, state.park);

    // ショー ・ パレードの TDL/TDS タブ切替 (パークが近接のため詳細内タブで分離)
    detail.querySelectorAll('.park-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const p = tab.dataset.parkTab;
        detail.querySelectorAll('.park-tab').forEach((t) => t.classList.toggle('active', t === tab));
        detail.querySelectorAll('[data-park-shows]').forEach((el) => {
          el.hidden = el.dataset.parkShows !== p;
        });
      });
    });

    // 詳細内アクション
    detail.querySelector('[data-action="decide"]').addEventListener('click', () => handlers.onDecide(date));
    detail.querySelector('[data-action="ng"]').addEventListener('click', () => handlers.onToggleNg(date));
  };

  tbody.querySelectorAll('.row-main').forEach((tr) => {
    const date = tr.dataset.date;
    tr.addEventListener('click', (e) => {
      if (e.target.closest('[data-retry]')) {
        handlers.onRetrySource(e.target.closest('[data-retry]'));
        return;
      }
      openDetail(date);
    });
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(date);
      }
    });
  });

  // 再試行ボタン (ソース単位)
  tbody.querySelectorAll('[data-retry]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onRetryAll();
    });
  });
}

// 下部凡例 : スコアは上部カード (legend.js) に移したので、ここは気温色 ＋ 注記のみ。
export function renderLegend(el) {
  const tempLegend = `<span class="lg">気温色 :
    <span class="tlg" style="background:#D24A4A"></span>暑い
    <span class="tlg" style="background:#2D8F3E"></span>快適
    <span class="tlg" style="background:#3F6FAE"></span>寒い</span>`;
  el.innerHTML = [
    '<span class="lg">昼パレード時刻 ±1h を最重視</span>',
    tempLegend,
  ].join('');
}
