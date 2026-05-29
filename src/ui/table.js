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
import { freshnessLabel, UPDATE_CYCLE } from '../utils/freshness.js';
import { nowcastHtml } from './nowcast.js';
import { getTempColor, getTempBandKey } from '../utils/tempColor.js';

// 気温セルを暖寒色で着色 (§0.6-2)。data-tb はダークモード CSS 上書き用。
function tempSpan(c) {
  if (c == null) return '—';
  return `<span class="tcolor" data-tb="${getTempBandKey(c)}" style="color:${getTempColor(c)}">${fmtNum(c, 0, '°')}</span>`;
}

const SOURCE_LABEL = { jma: '気象庁', 'open-meteo': 'Open-Meteo', openweather: 'OpenWeather' };

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
  const subParts = [`降水 ${fmtNum(forecast.popMax, 0, '%')}`];
  if (forecast.gustMax != null) subParts.push(`風 ${fmtNum(forecast.gustMax, 0)}`);
  // 鮮度ラベル (§3.14) : キャッシュ / オフラインは黄ラベル
  const fresh = freshnessLabel(forecast.fetchedAt);
  const cacheTag = status?.stale
    ? '<span class="fresh-tag cache">キャッシュ</span>'
    : status?.cached
      ? '<span class="fresh-tag cache">キャッシュ</span>'
      : '';
  const freshLine = `<div class="sc-fresh" title="${esc(UPDATE_CYCLE[source] || '')}">最終更新 ${fresh}${cacheTag}</div>`;
  return `<td class="source-cell">
    <div class="sc-main">${temp}</div>
    <div class="sc-sub">${esc(forecast.weatherText || '')}</div>
    <div class="sc-sub">${subParts.join(' ')}</div>
    ${freshLine}
  </td>`;
}

function detailPanelHtml(row, park) {
  const showRows = (SHOW_SCHEDULE[park] || [])
    .map(
      (s) =>
        `<div class="${s.priority === 'high' ? 'st-high' : ''}">${esc(s.type)} : ${s.times.join(' / ')}${
          s.priority === 'high' ? ' (メイン算定窓)' : ' (参考)'
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
  return `<div class="detail-panel">
    <div class="detail-charts">
      <h3>時系列 (降水確率 ･ 風速)</h3>
      <div class="chart-box"><div style="position:relative;height:240px"><canvas data-chart="popwind"></canvas></div></div>
      <h3 style="margin-top:14px">気温 ･ 体感温度</h3>
      <div class="chart-box"><div style="position:relative;height:200px"><canvas data-chart="temp"></canvas></div></div>
    </div>
    <div class="detail-side">
      <div>
        <h3>${esc(park)} のショー ･ パレード時刻</h3>
        <div class="show-times">${showRows}</div>
      </div>
      <div>
        <h3>持ち物 ･ 服装</h3>
        <ul class="outfit-list">${outfit}</ul>
      </div>
      ${nowcastHtml(row.date)}
      <div class="detail-actions">
        <button type="button" class="btn ${decided ? 'btn-primary' : ''}" data-action="decide">
          <span class="material-symbols-rounded" aria-hidden="true">event_available</span>${decided ? '決定済み' : 'この日に決めた'}
        </button>
        <button type="button" class="btn" data-action="calendar">
          <span class="material-symbols-rounded" aria-hidden="true">calendar_add_on</span>カレンダー登録
        </button>
        <button type="button" class="btn" data-action="ng">
          <span class="material-symbols-rounded" aria-hidden="true">${ng ? 'undo' : 'block'}</span>${ng ? 'NG 解除' : '同行者 NG'}
        </button>
      </div>
    </div>
  </div>`;
}

export function renderTable(els, rows, state, sources, sourceStatus, handlers) {
  const { thead, tbody } = els;

  // ヘッダー
  thead.innerHTML = `<tr>
    <th class="col-date">日付</th>
    <th>スコア</th>
    <th>朝 / 昼 / 夜</th>
    <th>風</th>
    <th>雨</th>
    <th>熱 (WBGT)</th>
    ${sources.map((s) => `<th>${esc(SOURCE_LABEL[s] || s)}</th>`).join('')}
  </tr>`;

  // 連休グルーピング: 直前行も休日なら境界に枠
  tbody.innerHTML = rows
    .map((row, i) => {
      const dt = row.dayType;
      const prevOff = i > 0 ? rows[i - 1].dayType.isOff : false;
      const groupStart = dt.isOff && !prevOff && state.sortBy === 'date';
      const wbgtLabel = wbgtSourceLabel(Object.values(row.forecasts));
      const wbgtVal = row.eval.metrics.wbgtMax;
      const wbgtTag =
        wbgtVal != null
          ? `<div class="wbgt-tag ${wbgtLabel === '推定' ? 'derived' : ''}">WBGT ${fmtNum(wbgtVal, 0)} (${wbgtLabel})</div>`
          : '';

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
        <td>${scorePillHtml(row.eval)}</td>
        <td>${subscoreHtml(row.eval.subscores, BANDS)}</td>
        <td>${cancelBadgeHtml('wind', row.eval.badges.wind)}</td>
        <td>${cancelBadgeHtml('rain', row.eval.badges.rain)}</td>
        <td>${cancelBadgeHtml('wbgt', row.eval.badges.wbgt)}${wbgtTag}</td>
        ${sources.map((s) => sourceCellHtml(s, row.forecasts[s], sourceStatus[s])).join('')}
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
    detail.firstElementChild.innerHTML = detailPanelHtml(row, state.park);
    detail.hidden = false;
    main.setAttribute('aria-expanded', 'true');

    const forecasts = Object.values(row.forecasts).filter(Boolean);
    renderPopWindChart(detail.querySelector('[data-chart="popwind"]'), forecasts, state.park);
    renderTempChart(detail.querySelector('[data-chart="temp"]'), forecasts, state.park);

    // 詳細内アクション
    detail.querySelector('[data-action="decide"]').addEventListener('click', () => handlers.onDecide(date));
    detail.querySelector('[data-action="ng"]').addEventListener('click', () => handlers.onToggleNg(date));
    detail
      .querySelector('[data-action="calendar"]')
      .addEventListener('click', () => handlers.onCalendar(date));
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

// 凡例 (§6.3 : 記号 ＋ アイコン ＋ 色)
export function renderLegend(el) {
  const item = (icon, color, text) =>
    `<span class="lg"><span class="material-symbols-rounded" style="color:${color}" aria-hidden="true">${icon}</span>${text}</span>`;
  const tempLegend = `<span class="lg">気温色 :
    <span class="tlg" style="background:#D24A4A"></span>暑い
    <span class="tlg" style="background:#2D8F3E"></span>快適
    <span class="tlg" style="background:#3F6FAE"></span>寒い</span>`;
  el.innerHTML = [
    item('check_circle', '#2D8F3E', '◎ 行くべき (85+)'),
    item('check', '#88C057', '○ 行ってよい (70+)'),
    item('warning', '#F2A93B', '△ 微妙 (50+)'),
    item('block', '#D24A4A', '× 別日推奨 (50 未満)'),
    '<span class="lg">昼パレード時刻 ±1h を最重視</span>',
    tempLegend,
  ].join('');
}
