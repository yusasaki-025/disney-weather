// 候補日比較テーブル + 行クリックで開く時系列詳細パネル (§3.2, §3.4)。

import {
  esc,
  fmtNum,
  scorePillHtml,
  cancelBadgeHtml,
  subscoreHtml,
  scoreAria,
} from './components.js';
import { formatMd, weekday } from '../utils/date.js';
import { BANDS } from '../score/scoring.js';
import { renderPopWindChart, renderTempChart } from './chart.js';
import { suggestOutfit } from './outfit.js';
import { getDaySchedule } from '../data/showSchedule.js';
import { latestOperation } from '../data/operationLog.js';
import { getCancelProbability } from '../score/cancelProbability.js';
import { extremeWarning } from '../score/extremeWarning.js';
import { getScoreReason } from '../score/scoreReason.js';
import { freshnessLabel } from '../utils/freshness.js';
import { nowcastHtml } from './nowcast.js';
import { getTempColor, getTempBandKey } from '../utils/tempColor.js';
import { getWeatherIcon } from '../utils/weatherIcon.js';
import { normalizeWeatherText } from '../utils/weatherText.js';

// 気温セルを暖寒色で着色 (§0.6-2)。data-tb はダークモード CSS 上書き用。
function tempSpan(c) {
  if (c == null) return '—';
  return `<span class="tcolor" data-tb="${getTempBandKey(c)}" style="color:${getTempColor(c)}">${fmtNum(c, 0, '°')}</span>`;
}

const SOURCE_LABEL = { jma: '気象庁', 'open-meteo': 'Open-Meteo', openweather: 'OpenWeather' };
const CAT_ICON = { wind: 'air', rain: 'umbrella', wbgt: 'thermostat' };
// §0.38-7 : 気象庁 / Open-Meteo 見出しにもアイコン (ソース違いを視覚化)
const SOURCE_ICON = { jma: 'cloud', 'open-meteo': 'partly_cloudy_day', openweather: 'cloud_queue' };

// 風 / 雨 / 熱セル : カテゴリアイコン(頭) ＋ 実数値(主) ＋ バッジ(副) (§0.5.2 / §0.6.6-3)
// kind: wind/rain/wbgt。cellClass/label はスマホカード化 (§0.22) 用。
const METRIC_LABEL = { wind: '風', rain: '雨', wbgt: '熱 (WBGT)' };
function metricCell(kind, valueHtml, badge, title = '') {
  const cellClass = kind === 'wbgt' ? 'cell-heat' : `cell-${kind}`;
  return `<td class="${cellClass}" data-label="${esc(METRIC_LABEL[kind])}"${title ? ` title="${esc(title)}"` : ''}>
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

// §0.36-1/5 : 雨表示。pop% ＋ 時間最大 mm/h。pop=0 は省略 (非表示)。日合計は title。
function rainSub(forecast) {
  const pop = forecast.popMax;
  if (pop == null || pop <= 0) return ''; // 雨 0% は非表示
  const hourlyPrecip = (forecast.hourly || []).map((h) => h.precip ?? 0);
  const precipMax = hourlyPrecip.length ? Math.max(...hourlyPrecip) : 0;
  const mmh = precipMax > 0 ? ` ${fmtNum(precipMax, 0)}mm/h` : '';
  const title =
    forecast.precipSum != null && forecast.precipSum > 0 ? ` title="日合計 ${fmtNum(forecast.precipSum, 1)}mm"` : '';
  return `<div class="sc-sub"${title}>${fmtNum(pop, 0)}%${mmh}</div>`;
}

function sourceCellHtml(source, forecast, status) {
  // スマホカード化 (§0.22) 用のクラス ・ ラベル
  const cellClass = source === 'jma' ? 'cell-jma' : 'cell-openmeteo';
  const label = SOURCE_LABEL[source] || source;
  if (status && !status.ok) {
    return `<td class="source-cell ${cellClass}" data-label="${esc(label)}"><span class="cell-fail">取得失敗 <button type="button" data-retry>再試行</button></span></td>`;
  }
  if (!forecast) {
    return `<td class="source-cell ${cellClass} is-empty" data-label="${esc(label)}">—</td>`;
  }
  const temp =
    forecast.tempMax != null || forecast.tempMin != null
      ? `${tempSpan(forecast.tempMax)} / ${tempSpan(forecast.tempMin)}`
      : '—';
  // 鮮度はステータスバーに集約 (§0.6-4)。セルはホバー title で補助表示のみ。
  const title = `${label} ${freshnessLabel(forecast.fetchedAt)}`;
  // 大きな天気アイコン (40px) を主役に (§0.6.6-2)
  const wi = getWeatherIcon(forecast.weatherText);
  return `<td class="source-cell ${cellClass}" data-label="${esc(label)}" title="${esc(title)}">
    <span class="material-symbols-rounded weather-icon" style="color:${wi.color}" aria-hidden="true">${wi.name}</span>
    <div class="sc-sub">${esc(normalizeWeatherText(forecast.weatherText))}</div>
    <div class="sc-main">${temp}</div>
    ${rainSub(forecast)}
  </td>`;
}

// §0.28 : 当日の公式運営状況 (中止 ・ 内容変更 ・ 早閉め)。取得済の日のみ表示。
function operationHtml(date) {
  const op = latestOperation(date);
  if (!op) return '';
  const rows = [];
  for (const park of ['TDL', 'TDS']) {
    const s = op.parks[park];
    if (!s) continue;
    for (const c of s.closedShows || []) {
      rows.push(
        `<li class="op-item op-closed"><span class="material-symbols-rounded" aria-hidden="true">block</span><span class="op-park">${park}</span>${esc(c.text || c.name || '')}</li>`,
      );
    }
    for (const m of s.modifiedShows || []) {
      const t = m.time ? `${esc(m.time)} ` : '';
      rows.push(
        `<li class="op-item op-modified"><span class="material-symbols-rounded" aria-hidden="true">warning</span><span class="op-park">${park}</span>${t}${esc(m.text || m.name || '')}</li>`,
      );
    }
    if (s.earlyClose) {
      rows.push(
        `<li class="op-item op-modified"><span class="material-symbols-rounded" aria-hidden="true">schedule</span><span class="op-park">${park}</span>早閉め ${esc(s.earlyClose)}</li>`,
      );
    }
  }
  if (rows.length === 0) return '';
  const time = op.fetchedAt ? `${esc(op.fetchedAt.slice(11, 16))} 時点` : '';
  return `<div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">campaign</span>当日中止情報${time ? `<span class="op-time">${time}</span>` : ''}</h4>
        <ul class="op-list">${rows.join('')}</ul>
      </div>`;
}

// §0.31 : 過去同条件 (max 風速 ±2m/s) での中止率。サンプル不足は表示しない (誤情報回避)。
function cancelProbHtml(showName, park, predWind) {
  const r = getCancelProbability(showName, park, predWind);
  if (!r) return '';
  const cls = r.probability >= 50 ? 'cp-danger' : r.probability >= 30 ? 'cp-warn' : 'cp-mute';
  const wind = fmtNum(predWind, 0);
  // §0.38-11 : 「予報 12m/s ［過去中止 43% (3/7件)］」形式に短縮 (% を先出し ・ コンパクト)。
  // 件数 3 件未満は信頼度が低いので (要確認) を併記 (§0.38-10 と連動)。
  const lowSample = r.sampleSize < 3 ? '<span class="cp-check">(要確認)</span>' : '';
  return `<span class="cancel-prob ${cls}" title="予報 max ${wind}m/s ・ 過去同条件 ${r.sampleSize}件中 ${r.cancelCount}件中止">予報 ${wind}m/s ［過去中止 ${r.probability}% (${r.cancelCount}/${r.sampleSize}件)］${lowSample}</span>`;
}

function detailPanelHtml(row) {
  // §0.8 : その日の実スケジュール (公式取得があれば official、無ければ fallback)
  const schedFor = (p) => getDaySchedule(row.date, p);
  // §0.26 : 同名ショーを 1 行に集約 (times を " / " 連結)。内部用語 (メイン算定窓/補助/参考) は
  //          表示せず、priority は CSS class (.priority-high/-medium/-low) で視覚区別する。
  // §0.31 : 中止確率に使う予報 max 風速 (ショー窓優先、無ければ日最大)
  const predWind = row.eval.metrics.gustShowWindow ?? row.eval.metrics.gustMax;
  const showRowsFor = (p) => {
    const order = [];
    const byName = new Map();
    for (const s of schedFor(p).shows) {
      let g = byName.get(s.name);
      if (!g) {
        // §0.26.1 : 時刻未定のレストランショー (kind:'show-restaurant') は priority-restaurant 扱い
        const isRestaurant = s.kind === 'show-restaurant';
        g = {
          name: s.name,
          cls: isRestaurant ? 'restaurant' : s.priority || 'medium',
          restaurant: isRestaurant,
          tags: s.tags || [],
          times: [],
        };
        byName.set(s.name, g);
        order.push(g);
      }
      if (s.time) g.times.push(s.time);
    }
    return order
      .map((g) => {
        const timesText = g.restaurant && g.times.length === 0 ? '予約必須' : g.times.map(esc).join(' / ');
        const tagsHtml = g.tags.length ? `<span class="show-tags">${esc(g.tags.join(' '))}</span>` : '';
        const summary = `<span class="show-name">${esc(g.name)}</span><span class="show-times">${timesText}</span>${tagsHtml}`;
        // §0.38-21 : 過去中止率などの詳細は既定で折りたたみ、行クリックで展開 (details/summary, a11y)。
        const detail = cancelProbHtml(g.name, p, predWind);
        if (!detail) return `<li class="show-item priority-${g.cls}">${summary}</li>`;
        return `<li class="show-item priority-${g.cls}"><details class="show-toggle"><summary>${summary}</summary><div class="show-detail">${detail}</div></details></li>`;
      })
      .join('');
  };
  // パーク別に official/fallback が混ざりうるが、どちらかが official なら「公式取得済」とする
  const isOfficial = schedFor('TDL').source === 'official' || schedFor('TDS').source === 'official';
  const schedBadge = isOfficial
    ? '<span class="sched-badge official">確定情報</span>'
    : '<span class="sched-badge fallback">典型値で代替</span>';
  const outfit = suggestOutfit(row.eval.metrics)
    .map(
      (o) =>
        `<li><span class="material-symbols-rounded" aria-hidden="true">${o.icon}</span>${esc(o.text)}</li>`,
    )
    .join('');
  // §0.6.8 : 左カラム = 情報、右カラム = グラフ。
  return `<div class="detail-panel">
    <div class="detail-info">
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">schedule</span>時間帯スコア (昼を最重視)</h4>
        <div class="subscore-detail">${subscoreHtml(row.eval.subscores, BANDS)}</div>
      </div>
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">theater_comedy</span>ショー ･ パレード${schedBadge}</h4>
        <div class="park-tabs" role="tablist" aria-label="パーク切替">
          <button class="park-tab active" role="tab" data-park-tab="TDL" type="button">TDL</button>
          <button class="park-tab" role="tab" data-park-tab="TDS" type="button">TDS</button>
        </div>
        <ul class="show-list" data-park-shows="TDL">${showRowsFor('TDL')}</ul>
        <ul class="show-list" data-park-shows="TDS" hidden>${showRowsFor('TDS')}</ul>
      </div>
      ${operationHtml(row.date)}
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">checkroom</span>持ち物 ･ 服装</h4>
        <ul class="outfit-list">${outfit}</ul>
      </div>
      ${nowcastHtml(row.date)}
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
    ${catHead('wind', '風')}
    ${catHead('rain', '雨')}
    <th><span class="material-symbols-rounded cat-head" aria-hidden="true">${CAT_ICON.wbgt}</span><span class="cat-head-label">熱 (WBGT)</span><span class="material-symbols-rounded wbgt-info" tabindex="0" role="img" title="暑さ指数 (WBGT)。気温 + 湿度 + 日射から算出する熱中症リスク指標。28+ で警戒、31+ で危険。" aria-label="暑さ指数 (WBGT) とは : 気温 ・ 湿度 ・ 日射から算出する熱中症リスク指標。28 以上で警戒、31 以上で危険。">info</span></th>
    ${sources
      .map(
        (s) =>
          `<th><span class="material-symbols-rounded cat-head" aria-hidden="true">${SOURCE_ICON[s] || 'cloud'}</span><span class="cat-head-label">${esc(SOURCE_LABEL[s] || s)}</span></th>`,
      )
      .join('')}
    <th class="col-chev" aria-hidden="true"></th>
  </tr>`;

  // フィルター結果が 0 件 (おすすめ日のみ ON で該当無し等) のときは案内を出す
  if (rows.length === 0) {
    const colspan = 5 + sources.length;
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
          ? `${fmtNum(pop, 0)}<span class="unit">%</span>${m.precipSum != null && m.precipSum >= 0.5 ? ` ${fmtNum(m.precipSum, 1)}<span class="unit">mm</span>` : ''}`
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

      const cls = ['row-main', groupStart ? 'holiday-group-start' : ''].filter(Boolean).join(' ');

      // §0.36-7 : 極端値の信頼度ヒント (単独ソースの外れ値で誤判断しないよう「(要確認)」)
      const precipMaxHourly = Math.max(
        0,
        ...Object.values(row.forecasts)
          .filter(Boolean)
          .flatMap((f) => (f.hourly || []).map((h) => h.precip ?? 0)),
      );
      const extreme = extremeWarning({ gustMax: m.gustMax, precipMaxHourly });
      // §0.38-10 : (要確認) はクリック / フォーカスで理由を表示するボタンに (詳細はヘルプ FAQ)。
      const extremeHtml = extreme
        ? `<button type="button" class="extreme-warn" title="${esc(extreme.title)} ／ 詳細はヘルプ「(要確認) って何 ?」参照">${esc(extreme.text)}</button>`
        : '';

      // §0.23 : 日付セルにスコアピルを統合 (1 列削減)。§0.22 : data-label でスマホカードのラベル。
      const mainRow = `<tr class="${cls} calendar-row" data-date="${row.date}" tabindex="0"
        role="button" aria-expanded="false" aria-label="${esc(scoreAria(row.date, row.eval))}">
        <td class="col-date cell-date-score" data-label="日付"${scoreTitle ? ` title="${esc(scoreTitle)}"` : ''}>
          <div class="date-line">${esc(formatMd(row.date))} <span class="weekday ${dt.isHoliday || dt.weekdayIndex === 0 ? 'day-sun' : dt.weekdayIndex === 6 ? 'day-sat' : 'day-weekday'}">(${esc(weekday(row.date))})</span></div>
          <div class="date-sub">${dayBadges(dt)}</div>
          <div class="score-row">${scorePillHtml(row.eval)}${extremeHtml}</div>
          <div class="score-reason">${esc(getScoreReason(row.eval.metrics, row.eval.badges))}</div>
        </td>
        ${metricCell('wind', windVal, row.eval.badges.wind, windTitle)}
        ${metricCell('rain', rainVal, row.eval.badges.rain)}
        ${metricCell('wbgt', wbgtVal, row.eval.badges.wbgt, wbgtTitle)}
        ${sources.map((s) => sourceCellHtml(s, row.forecasts[s], sourceStatus[s])).join('')}
        <td class="col-chev"><span class="material-symbols-rounded chevron" aria-hidden="true">expand_more</span></td>
      </tr>`;

      const colspan = 5 + sources.length;
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
    renderPopWindChart(detail.querySelector('[data-chart="popwind"]'), forecasts, state.park, date);
    renderTempChart(detail.querySelector('[data-chart="temp"]'), forecasts, state.park, date);

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
