// ランタイム判定 (§0.7)。Cowork artifact 上か、公開ページ (閲覧専用) かを見分ける。
// Cowork ランタイムでのみ window.cowork が注入されるので、それで個人連携機能を出し分ける。

export function isCowork() {
  return typeof window !== 'undefined' && typeof window.cowork === 'object' && window.cowork !== null;
}
