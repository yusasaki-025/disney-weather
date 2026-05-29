// 用語集 ・ ヘルプモーダル (§3.16)。バッジの意味・スコア根拠・中止判断タイミング・FAQ・用語集。

const HELP_HTML = `
  <h2>用語集 ・ ヘルプ</h2>

  <h3>スコアの見方</h3>
  <ul>
    <li><strong>◎ (85+)</strong> 行くべき / <strong>○ (70+)</strong> 行ってよい / <strong>△ (50+)</strong> 微妙 / <strong>× (50 未満)</strong> 別日推奨</li>
    <li>総合スコア ＝ 100 - (風減点 ＋ 雨減点 ＋ 熱中症減点 ＋ 寒さ減点 ＋ UV減点)</li>
    <li>風 ・ 雨 ・ 熱は <strong>季節限定の昼パレード時刻 (TDL 13:00 / 14:30 ・ TDS 11:30 / 14:00) の前後 1 時間</strong>を最優先で評価します。</li>
    <li>朝 / 昼 / 夜のサブスコアは重みが違い、昼 (季節パレード) を最重視します。</li>
  </ul>

  <h3>3 つのバッジ</h3>
  <ul>
    <li><strong>風バッジ</strong> : 突風から、パレード中止リスクの目安 (通常運行 → 風バ可能性あり → 中止リスク高 → ほぼ中止)</li>
    <li><strong>雨バッジ</strong> : 降水確率 ・ 雨量から (雨なし → 雨バ可能性 → 雨キャン濃厚 → ほぼ中止)</li>
    <li><strong>熱バッジ (WBGT)</strong> : 暑さ指数から (通常運行 → 暑さ注意 → 熱バ可能性あり → 熱キャン濃厚 → ほぼ中止)</li>
  </ul>

  <h3>用語</h3>
  <ul>
    <li><strong>風バ</strong> : 強風でパレード ・ ショーが一部省略バージョンになること</li>
    <li><strong>風キャン</strong> : 強風 (目安 風速 10m/s 前後) でパレード ・ ショーが中止になること</li>
    <li><strong>熱バ</strong> : 暑さでショー ・ パレードが一部省略になること</li>
    <li><strong>熱キャン</strong> : 暑さ (目安 WBGT 31 以上 ・ 気温 35℃ 以上) でショー ・ パレードが中止になること</li>
    <li><strong>キャングリ</strong> : キャラクターグリーティング (キャラクターと触れ合えるイベント)</li>
  </ul>

  <h3>中止判断のタイミング</h3>
  <ul>
    <li>当日の中止 ・ 変更は、東京ディズニーリゾート公式サイト ・ アプリ ・ 公式 X で発表されます。</li>
    <li>このツールは事前の <strong>目安</strong> です。最終的な運営状況は必ず公式でご確認ください。</li>
  </ul>

  <h3>よくある質問</h3>
  <ul>
    <li><strong>予報が外れたら?</strong> 天気予報なので外れることがあります。複数ソースを横並びにして傾向で判断してください。</li>
    <li><strong>同行者と共有するには?</strong> 右上の「QR」ボタンか、Cowork の共有 URL を渡してください。</li>
    <li><strong>WBGT の「推定」って?</strong> 環境省データが取れないときは気温 ・ 湿度からの簡易計算値です (誤差 ±1.5℃ 程度)。</li>
  </ul>
`;

export function setupHelp() {
  const modal = document.getElementById('help-modal');
  const body = document.getElementById('help-body');
  body.innerHTML = HELP_HTML;

  const open = () => {
    modal.hidden = false;
  };
  const close = () => {
    modal.hidden = true;
  };

  document.getElementById('btn-help').addEventListener('click', open);
  document.getElementById('help-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}
