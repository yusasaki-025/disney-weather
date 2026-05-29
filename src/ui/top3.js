// 推奨日 TOP3 ハイライト (§3.7)。
import { dateLabel, esc, fmtNum } from './components.js';

// ルールベースの「行くべき理由」自然文。
// window.cowork.askClaude があれば後から非同期で差し替える (任意強化)。
export function buildReason(row) {
  const m = row.eval.metrics;
  const parts = [];
  const wind = row.eval.badges.wind;
  if (wind.level === 0) parts.push('風は穏やか');
  else if (wind.level === 1) parts.push('やや風あり');
  else parts.push('風が強め');

  const pop = m.popShowWindow != null ? m.popShowWindow : m.popMax;
  if (pop != null) {
    if (pop < 20) parts.push('降水確率低め');
    else if (pop < 50) parts.push(`降水確率${Math.round(pop)}%`);
    else parts.push(`雨に注意 (${Math.round(pop)}%)`);
  }
  if (row.eval.badges.wbgt.level >= 2) parts.push('暑さ対策を');
  if (row.forecasts['open-meteo']?.weatherText) {
    parts.unshift(esc(row.forecasts['open-meteo'].weatherText));
  }
  return parts.join(' ･ ');
}

export function renderTop3(container, rows, { onSelect, park }) {
  // ◎ ○ を優先しつつスコア降順で上位 3 件
  const ranked = [...rows]
    .filter((r) => r.eval && !r.isNg)
    .sort((a, b) => b.eval.score - a.eval.score)
    .slice(0, 3);

  if (ranked.length === 0) {
    container.innerHTML = '<p class="data-status">候補がありません。</p>';
    return;
  }

  container.innerHTML = ranked
    .map((row, i) => {
      const m = row.eval.metrics;
      const gust = m.gustShowWindow != null ? m.gustShowWindow : m.gustMax;
      const pop = m.popShowWindow != null ? m.popShowWindow : m.popMax;
      const wbgtPart =
        m.wbgtMax != null && m.wbgtMax >= 25
          ? `<span>WBGT ${fmtNum(m.wbgtMax, 0)}</span>`
          : '';
      return `<article class="top3-card" role="button" tabindex="0" data-date="${row.date}"
        aria-label="${esc(dateLabel(row.date))} ${park} おすすめ第${i + 1}位 スコア${row.eval.score}">
        <span class="rank">第${i + 1}位</span>
        <span class="card-date">${esc(dateLabel(row.date))}</span>
        <span class="card-symbol" style="color:${row.eval.symbol.color}">
          <span aria-hidden="true">${row.eval.symbol.symbol}</span> スコア${row.eval.score}
        </span>
        <span class="card-metrics">
          <span>風 ${fmtNum(gust, 0, 'm/s')}</span>
          <span>降水 ${fmtNum(pop, 0, '%')}</span>
          ${wbgtPart}
        </span>
        <span class="card-reason">${buildReason(row)}</span>
      </article>`;
    })
    .join('');

  container.querySelectorAll('.top3-card').forEach((el) => {
    const date = el.dataset.date;
    el.addEventListener('click', () => onSelect(date));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(date);
      }
    });
  });
}
