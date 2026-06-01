// 候補日比較テーブル + 行クリックで開く時系列詳細パネル (§3.2, §3.4)。

import {
  esc,
  fmtNum,
  scorePillHtml,
  cancelBadgeHtml,
  subscoreHtml,
  scoreAria,
} from './components.js';
import { formatMd, weekday, todayJst } from '../utils/date.js';
import { getScoreDiff, getScoreHistory } from '../data/forecastSnapshots.js';
import { BANDS } from '../score/scoring.js';
import { renderPopWindChart, renderTempChart } from './chart.js';
import { suggestOutfit } from './outfit.js';
import { getDaySchedule } from '../data/showSchedule.js';
import { latestOperation } from '../data/operationLog.js';
import { getCancelProbability } from '../score/cancelProbability.js';
import { extremeWarning } from '../score/extremeWarning.js';
import { getScoreReason } from '../score/scoreReason.js';
import { showRiskInfo } from '../score/showRisk.js';
import { getAttractionClosures } from '../score/attractionForecast.js';
import { heatAlertLevel } from '../score/heatAlert.js';
import { freshnessLabel } from '../utils/freshness.js';
import { nowcastHtml } from './nowcast.js';
import { getTempColor, getTempBandKey } from '../utils/tempColor.js';
import { getWeatherIcon, getWeatherIcons } from '../utils/weatherIcon.js';
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

// §0.43.1 : ショー詳細のリスク表示を 1 行に統合 (#18 per-show と §0.31 過去中止率の風速 2 重表示を解消)。
//   風 : avg = ショー時刻ピンポイント (#18 showRisk) / max = ショー窓 ±1h 最大 (§0.31 中止率の参照値)
//   熱 : ショー時刻の WBGT (#18) ・ ［過去中止 N%］: 過去同条件 (max ±2m/s) の中止率 (§0.31)
function showRiskLineHtml(showName, park, risk, predWind) {
  const riskParts = [];
  // §0.43.2 : 平均風速 (sustained ・ windspeed_10m) と 突風 (gust ・ wind_gusts_10m) を気象用語で併記。
  //           突風 ≧ 平均風速 が通常だが、算出窓の違いで逆転もあり得る (別物なので違和感なし)。
  const windPieces = [];
  if (risk && risk.wind != null) windPieces.push(`風 ${risk.wind}m/s`);
  if (predWind != null) windPieces.push(`突風 ${fmtNum(predWind, 0)}m/s`);
  if (windPieces.length) {
    riskParts.push(
      `<span class="sr-wind" title="風 (平均風速) = ショー時刻の 1時間平均 (sustained) / 突風 = 1時間最大瞬間風速 (gust)。突風は中止判定 ・ 過去事例検索のベースです">${windPieces.join(' ・ ')}</span>`,
    );
  }
  if (risk && risk.wbgt != null) riskParts.push(`熱 WBGT${risk.wbgt}`);
  // 過去中止率 (§0.31)。サンプル不足は表示せず (誤情報回避)、3 件未満は (要確認) 併記 (§0.38-10)。
  const r = getCancelProbability(showName, park, predWind);
  let cancelHtml = '';
  if (r) {
    const cls = r.probability >= 50 ? 'cp-danger' : r.probability >= 30 ? 'cp-warn' : 'cp-mute';
    const lowSample = r.sampleSize < 3 ? '<span class="cp-check">(要確認)</span>' : '';
    cancelHtml = `<span class="cancel-prob ${cls}" title="過去同条件 (突風 ${fmtNum(predWind, 0)}m/s ±2m/s) ${r.sampleSize}件中 ${r.cancelCount}件中止">［過去中止 ${r.probability}% (${r.cancelCount}/${r.sampleSize}件)］${lowSample}</span>`;
  }
  if (riskParts.length === 0 && !cancelHtml) return '';
  const body = [riskParts.join(' ・ '), cancelHtml].filter(Boolean).join(' ');
  return `<div class="show-risk-line">${body}</div>`;
}

// §0.39.1 : 予報変更履歴 (直近 7 スナップショットのスコア推移)。点が 2 未満なら非表示。
function forecastHistoryHtml(date, park, currentScore) {
  const hist = getScoreHistory(date, park, currentScore, todayJst(), 7);
  if (hist.length < 2) return '';
  const rows = hist
    .map((p) => {
      const w = Math.max(2, Math.round(p.score)); // 0-100 を % 幅に
      const label = p.current ? '今日' : esc(formatMd(p.date));
      return `<div class="fh-row${p.current ? ' fh-current' : ''}"><span class="fh-date">${label}</span><span class="fh-bar" style="width:${w}%"></span><span class="fh-val">${p.score}</span></div>`;
    })
    .join('');
  return `<div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">trending_up</span>予報変更履歴 (スコア推移)</h4>
        <div class="forecast-history">${rows}</div>
      </div>`;
}

// §0.39.4 (#22) : その日の予報 max 風速で運休が予測される屋外アトラクション一覧。
// 風が穏やか (該当なし) のときはセクションごと非表示。閾値は推定値なので UI に明記。
function attractionHtml(park, gust) {
  const closures = getAttractionClosures(park, gust);
  if (!closures.length) return '';
  const items = closures
    .map(
      (a) =>
        `<li class="attraction-item"><span class="material-symbols-rounded" aria-hidden="true">block</span><span class="attraction-name">${esc(a.name)}</span><span class="attraction-cut">${a.windCutoff}m/s〜</span></li>`,
    )
    .join('');
  return `<div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">attractions</span>アトラクション運休予測 (${esc(park)})</h4>
        <p class="attraction-note">予報 max ${Math.round(gust)}m/s ・ 屋外コースター ・ 水上系は強風で運休することがあります (推定閾値)</p>
        <ul class="attraction-list">${items}</ul>
      </div>`;
}

// §0.41.5 : 「この日の概要」セクション。スコア理由 (§0.37.10) ・ (要確認) の理由 ・ 天気概況を
//           詳細パネル冒頭に集約 (カード上の score-reason は撤去し、ここに一本化)。
function dayOverviewHtml(row, today) {
  const m = row.eval.metrics;
  const reason = getScoreReason(m, row.eval.badges);
  // (要確認) の理由 : 単独ソースの極端値 + 6 日先以降の予報誤差
  const checks = [];
  const precipMaxHourly = Math.max(
    0,
    ...Object.values(row.forecasts)
      .filter(Boolean)
      .flatMap((f) => (f.hourly || []).map((h) => h.precip ?? 0)),
  );
  const ex = extremeWarning({ gustMax: m.gustMax, precipMaxHourly });
  if (ex) checks.push(ex.title || ex.text);
  const daysAhead = Math.round((new Date(row.date) - new Date(today)) / 86400000);
  if (daysAhead >= 6) checks.push('6 日先以降は予報の誤差が大きめ ・ 当日朝に再確認を');
  // 天気概況 (主要ソースの天気 + 気温レンジ)
  const f =
    row.forecasts.jma || row.forecasts['open-meteo'] || Object.values(row.forecasts).filter(Boolean)[0];
  const t = (v) => (v != null ? `${Math.round(v)}°` : '—');
  const overview = f ? `${normalizeWeatherText(f.weatherText)} ・ 最高 ${t(f.tempMax)} / 最低 ${t(f.tempMin)}` : '';
  // §0.42.3 : 複合天気 (「晴れ、夜曇り、昼前まで霧」等) を「、」分割で複数アイコン並列表示
  const wIconsHtml = f
    ? getWeatherIcons(f.weatherText)
        .map((ic) => `<span class="material-symbols-rounded ds-wicon" style="color:${ic.color}" aria-hidden="true">${ic.name}</span>`)
        .join('')
    : '';
  const parts = [
    `<p class="ds-line"><span class="ds-key">スコア理由</span><span class="score-reason ds-val">${esc(reason)}</span></p>`,
  ];
  if (checks.length)
    parts.push(`<p class="ds-line ds-check"><span class="ds-key">(要確認)</span><span class="ds-val">${esc(checks.join(' ・ '))}</span></p>`);
  if (overview)
    parts.push(`<p class="ds-line"><span class="ds-key">天気概況</span><span class="ds-val">${wIconsHtml}${esc(overview)}</span></p>`);
  return `<div class="detail-section day-summary js-day-summary">
        <h4><span class="material-symbols-rounded" aria-hidden="true">summarize</span>この日の概要</h4>
        ${parts.join('\n        ')}
      </div>`;
}

function detailPanelHtml(row, park) {
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
        const allTimes = g.times.map(esc);
        // §0.44.13 : 全時刻を常時表示 (§0.41.1 の「ほか N 回」畳みを撤廃)。複数公演は時刻を独立行に。
        // §0.44.8 : レストランショーの「予約必須」はタグ (バッジ) で 1 回のみ表示し、時刻スロットには出さない。
        const timesText = allTimes.join(' / ');
        const multiShow = allTimes.length >= 2;
        // §0.40.5 / §0.41.4 : DPA / 抽選 / 期間限定 を独立タグ化。
        //   schedule の内部表記 (プレミアアクセス / エントリー受付) を表示用 (DPA / 抽選) にマップ。
        const TAG_MAP = {
          プレミアアクセス: { label: 'DPA', cls: 'tag-dpa' },
          エントリー受付: { label: '抽選', cls: 'tag-chusen' },
          期間限定: { label: '期間限定', cls: 'tag-season' },
        };
        const tagList = [...(g.cls === 'high' ? ['期間限定'] : []), ...g.tags];
        const tagsHtml = tagList
          .map((t) => {
            const m = TAG_MAP[t] || { label: t, cls: 'tag-note' };
            return `<span class="show-tag ${m.cls}">${esc(m.label)}</span>`;
          })
          .join('');
        // §0.44.10 : 時刻を行頭に ・ ショー名 ・ タグを後続。
        // §0.44.13 : 複数公演は 1 行目=全時刻 ・ 2 行目=ショー名 + タグ。単独公演は時刻先頭の 1 行。
        const timesHtml = timesText ? `<span class="show-times">${timesText}</span>` : '';
        const nameTagsHtml = `<span class="show-name">${esc(g.name)}</span>${tagsHtml}`;
        const summary = multiShow
          ? `<div class="show-times-line">${timesHtml}</div><div class="show-name-line">${nameTagsHtml}</div>`
          : `${timesHtml}${nameTagsHtml}`;
        const detailParts = [];
        // §0.43.1 : per-show 時刻別リスク (#18) と過去中止率 (§0.31) を 1 行に統合し風速の 2 重表示を解消
        const risk = showRiskInfo(Object.values(row.forecasts).filter(Boolean), g.times);
        const riskLine = showRiskLineHtml(g.name, p, risk, predWind);
        if (riskLine) detailParts.push(riskLine);
        const detail = detailParts.join('');
        // §0.44.9 : 「開催予想」 toggle (details/summary) を撤廃し、風 / 突風 / 熱 / 過去中止率を常時表示。
        const detailHtml = detail ? `<div class="show-detail">${detail}</div>` : '';
        return `<li class="show-item priority-${g.cls}">${summary}${detailHtml}</li>`;
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
      ${dayOverviewHtml(row, todayJst())}
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">schedule</span>時間帯スコア (昼を最重視)</h4>
        <div class="subscore-detail">${subscoreHtml(row.eval.subscores, BANDS)}</div>
        <p class="subscore-note">各時間帯の快適度 (100点満点)</p>
      </div>
      ${forecastHistoryHtml(row.date, park || 'TDL', row.eval.score)}
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
      ${attractionHtml(park || 'TDL', row.eval.metrics.gustShowWindow ?? row.eval.metrics.gustMax)}
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">checkroom</span>持ち物 ･ 服装</h4>
        <ul class="outfit-list">${outfit}</ul>
      </div>
      ${nowcastHtml(row.date)}
    </div>
    <div class="detail-charts">
      <div class="detail-section">
        <h4><span class="material-symbols-rounded" aria-hidden="true">water_drop</span>降水確率 ･ 風速 (時系列)</h4>
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
    <th class="col-score">スコア</th>
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

      // §0.39.1 : 前日スナップショットとのスコア差分マーク (改善↑ / 悪化↓)。比較対象が無ければ非表示。
      const diff = getScoreDiff(row.date, state.park, row.eval.score, todayJst());
      const diffHtml = diff
        ? `<span class="score-diff ${diff.delta > 0 ? 'up' : 'down'}" title="前回予報 (${esc(diff.snapDate)}) ${diff.prev}点 から ${diff.delta > 0 ? '改善' : '悪化'}">${diff.delta > 0 ? '↑' : '↓'}${diff.delta > 0 ? '+' : ''}${diff.delta}</span>`
        : '';
      // §0.23 : 日付セルにスコアピルを統合 (1 列削減)。§0.22 : data-label でスマホカードのラベル。
      // §0.37.4 : PC は独立スコア列 (cell-score-pc) ・ スマホはカード内 (.card-score) に統合 (CSS で出し分け)。
      const scoreInner = `<div class="score-row">${scorePillHtml(row.eval)}${diffHtml}${extremeHtml}</div>`;
      // §0.39.2 (#20) : WBGT 予測から熱中症警戒級を導出しカードにバナー表示 (score は既存ロジックで別日化済)
      const heatAlert = heatAlertLevel(m.wbgtMax);
      const heatAlertHtml = heatAlert
        ? `<div class="heat-alert"><span class="material-symbols-rounded" aria-hidden="true">warning</span>${esc(heatAlert.label)} (WBGT予測${heatAlert.wbgt})</div>`
        : '';
      const mainRow = `<tr class="${cls} calendar-row" data-date="${row.date}" tabindex="0"
        role="button" aria-expanded="false" aria-label="${esc(scoreAria(row.date, row.eval))}">
        <td class="col-date cell-date-score" data-label="日付"${scoreTitle ? ` title="${esc(scoreTitle)}"` : ''}>
          <div class="date-line">${state.sortBy === 'score' && i < 3 ? `<span class="rank-badge">${i + 1}位</span>` : ''}${esc(formatMd(row.date))} <span class="weekday ${dt.isHoliday || dt.weekdayIndex === 0 ? 'day-sun' : dt.weekdayIndex === 6 ? 'day-sat' : 'day-weekday'}">(${esc(weekday(row.date))})</span></div>
          <div class="date-sub">${dayBadges(dt)}</div>
          ${heatAlertHtml}
          <div class="score-row card-score">${scorePillHtml(row.eval)}${diffHtml}${extremeHtml}</div>
        </td>
        <td class="col-score cell-score-pc" data-label="スコア">${scoreInner}</td>
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
    detail.firstElementChild.innerHTML = detailPanelHtml(row, state.park);
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
      const toCheck = e.target.closest('.extreme-warn');
      openDetail(date);
      // §0.41.5 : (要確認) クリックは詳細を開いて「この日の概要」へスクロール
      if (toCheck) {
        const d = tbody.querySelector(`.detail-row[data-detail="${date}"]`);
        d?.querySelector('.js-day-summary')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
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

// §0.39.3 (#21) : 気象庁の現在発表中の警報 ・ 注意報を「当日」カードに表示する。
// この API は日別予報ではないため当日のみ。再描画のたびに呼ぶ前提で既存要素を作り直す。
const WARN_ICON = { emergency: 'crisis_alert', warning: 'warning', advisory: 'info' };
export function renderTodayWarning(els, todayDate, warningData) {
  els.tbody.querySelectorAll('.jma-warning').forEach((e) => e.remove());
  if (!warningData || !warningData.warnings || warningData.warnings.length === 0) return;
  const row = els.tbody.querySelector(`.row-main[data-date="${todayDate}"]`);
  const cell = row && row.querySelector('.cell-date-score');
  if (!cell) return;
  const badges = warningData.warnings
    .map(
      (w) =>
        `<span class="jma-warn-badge ${w.level === 'advisory' ? 'jw-advisory' : 'jw-warning'}"><span class="material-symbols-rounded" aria-hidden="true">${WARN_ICON[w.level] || 'info'}</span>${esc(w.label)}</span>`,
    )
    .join('');
  const ttl = warningData.reportDatetime
    ? ` title="${esc(warningData.reportDatetime.slice(0, 16).replace('T', ' '))} 発表"`
    : '';
  const el = document.createElement('div');
  el.className = 'jma-warning';
  el.innerHTML = `<span class="jw-source"${ttl}>気象庁</span>${badges}`;
  cell.appendChild(el);
}
