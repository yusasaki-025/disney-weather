// 印刷モード (§3.17 / §6.9)。決定日を選んだ状態で、その日の詳細 (時系列 ・ ショー時刻 ・
// 服装 ・ 注意バッジ) を A4 1 枚に収める。@media print 側で不要 UI を隠す。

export function setupPrint({ getDecidedDate, openDetail }) {
  document.getElementById('btn-print').addEventListener('click', () => {
    const date = getDecidedDate();
    if (!date) {
      alert('印刷する前に、行を開いて「この日に決めた」で決定日を選んでください');
      return;
    }
    // 決定日の詳細を開いてグラフを描画させてから印刷
    openDetail(date);
    setTimeout(() => window.print(), 350);
  });
}
