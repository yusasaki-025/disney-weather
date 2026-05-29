// OpenWeather One Call 3.0 のプロキシ (任意・Phase 2)。
// API キーを artifact に埋め込まず、ここ (Workers Secret) に置く。
// デプロイ: cd workers && npx wrangler deploy
// Secret 設定: npx wrangler secret put OPENWEATHER_API_KEY
//
// artifact 側の CONFIG.openWeatherProxyUrl にこの Worker の URL を設定すると
// OpenWeather 列が有効になる。

const ALLOWED_ORIGIN = '*'; // 必要なら artifact の配信元に絞る

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    if (!lat || !lon) {
      return json({ error: 'lat/lon required' }, 400);
    }
    if (!env.OPENWEATHER_API_KEY) {
      return json({ error: 'API key not configured' }, 500);
    }

    const target = new URL('https://api.openweathermap.org/data/3.0/onecall');
    target.searchParams.set('lat', lat);
    target.searchParams.set('lon', lon);
    target.searchParams.set('units', 'metric');
    target.searchParams.set('lang', 'ja');
    target.searchParams.set('exclude', 'minutely,alerts');
    target.searchParams.set('appid', env.OPENWEATHER_API_KEY);

    const res = await fetch(target, { cf: { cacheTtl: 600 } });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': ALLOWED_ORIGIN,
        'cache-control': 'public, max-age=600',
      },
    });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': ALLOWED_ORIGIN,
    },
  });
}
