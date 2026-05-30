// 環境省 暑さ指数 電子情報提供サービスの予測 CSV を CORS 付きで透過するプロキシ (§0.10 / SPEC §4.4)。
// 環境省 CSV は Access-Control-Allow-Origin を返さないため、ブラウザ artifact から直接 fetch できない。
// この Worker が CSV をそのまま (text/csv) 返し、CORS ヘッダーを付与する。
// パースはクライアント側の parseEnvWbgtCsv を再利用する (Worker にパーサを複製しない = DRY)。
//
// デプロイ: cd workers && npx wrangler deploy --config wrangler.toml
// 使い方:  GET /wbgt?point=44132  → 環境省 yohou_44132.csv を CORS 付きで返す
//
// 規約: 環境省データは政府標準利用規約 (出典明記で商用可)。キャッシュ 1 時間でアクセス頻度を抑制。

const ALLOWED_ORIGIN = 'https://disney-weather.pages.dev';
const DEFAULT_POINT = '44132'; // 船橋 (浦安直近)

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    // プレビュー (*.pages.dev) ・ ローカル開発も許可
    const allowOrigin =
      origin === ALLOWED_ORIGIN || /^https:\/\/[a-z0-9-]+\.disney-weather\.pages\.dev$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)
        ? origin
        : ALLOWED_ORIGIN;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowOrigin) });
    }

    const url = new URL(request.url);
    const point = (url.searchParams.get('point') || DEFAULT_POINT).replace(/[^0-9]/g, '') || DEFAULT_POINT;
    const target = `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${point}.csv`;

    try {
      const res = await fetch(target, { cf: { cacheTtl: 3600, cacheEverything: true } });
      if (!res.ok) {
        return new Response(`upstream ${res.status}`, { status: 502, headers: corsHeaders(allowOrigin) });
      }
      const body = await res.text();
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=shift_jis',
          'cache-control': 'public, max-age=3600',
          ...corsHeaders(allowOrigin),
        },
      });
    } catch (e) {
      return new Response(`fetch error: ${e.message}`, { status: 500, headers: corsHeaders(allowOrigin) });
    }
  },
};

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
