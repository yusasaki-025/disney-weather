import { describe, it, expect, vi, afterEach } from 'vitest';
import { deriveWbgt, parseEnvWbgtCsv, fetchEnvWbgt, mergeEnvWbgt, WBGT_SOURCE } from '../src/data/wbgt.js';

describe('mergeEnvWbgt (§0.68.E 環境省実値を hourly にマージ)', () => {
  it('日次 wbgtMax と hourly[].wbgt を時刻一致で上書きし source を env-jp に', () => {
    const f = {
      wbgtMax: 20,
      wbgtSource: WBGT_SOURCE.DERIVED,
      hourly: [
        { hour: 12, wbgt: 22, gust: 5 },
        { hour: 13, wbgt: 23, gust: 5 },
        { hour: 14, wbgt: 24, gust: 5 },
      ],
    };
    mergeEnvWbgt(f, { wbgtMax: 27.4, hourly: [{ hour: 13, wbgt: 26.5 }, { hour: 14, wbgt: 27.4 }] });
    expect(f.wbgtMax).toBe(27.4);
    expect(f.wbgtSource).toBe(WBGT_SOURCE.ENV_JP);
    expect(f.hourly[0].wbgt).toBe(22); // 12時は環境省に無い → 派生値のまま
    expect(f.hourly[1].wbgt).toBe(26.5); // 13時 上書き
    expect(f.hourly[1].wbgtSource).toBe(WBGT_SOURCE.ENV_JP);
    expect(f.hourly[2].wbgt).toBe(27.4);
    expect(f.hourly[0].gust).toBe(5); // 他フィールドは不変
  });

  it('forecast / info が無い ・ hourly 無しでも安全', () => {
    expect(() => mergeEnvWbgt(null, { wbgtMax: 25 })).not.toThrow();
    const f = { wbgtMax: 20, hourly: [{ hour: 12, wbgt: 22 }] };
    mergeEnvWbgt(f, { wbgtMax: 26 }); // hourly 無し
    expect(f.wbgtMax).toBe(26);
    expect(f.hourly[0].wbgt).toBe(22); // hourly は不変
  });
});

describe('deriveWbgt (§3.11 簡易式)', () => {
  it('欠損は null', () => {
    expect(deriveWbgt(null, 70)).toBeNull();
    expect(deriveWbgt(30, null)).toBeNull();
  });
  it('既知の入力で妥当な推定値', () => {
    // Ta=30, RH=70 → 約 32.6
    expect(deriveWbgt(30, 70)).toBeCloseTo(32.58, 1);
    // 気温・湿度が高いほど大きい
    expect(deriveWbgt(35, 80)).toBeGreaterThan(deriveWbgt(30, 70));
    expect(deriveWbgt(20, 50)).toBeLessThan(deriveWbgt(30, 70));
  });
});

describe('parseEnvWbgtCsv', () => {
  const csv = [
    ',,2026053009,2026053012,2026053015,2026053109',
    '44132,2026/05/30 01:25, 250, 280, 310, 200',
  ].join('\n');
  const parsed = parseEnvWbgtCsv(csv);

  it('日付別に集計し値は ÷10', () => {
    expect(parsed['2026-05-30'].wbgtMax).toBe(31.0); // max(25,28,31)
    expect(parsed['2026-05-30'].hourly).toHaveLength(3);
    expect(parsed['2026-05-31'].wbgtMax).toBe(20.0);
  });

  it('hourly に hour と wbgt が入る', () => {
    const h = parsed['2026-05-30'].hourly.find((x) => x.hour === 12);
    expect(h.wbgt).toBe(28.0);
  });

  it('空 ・ 不正は空オブジェクト', () => {
    expect(parseEnvWbgtCsv('')).toEqual({});
    expect(parseEnvWbgtCsv('only one line')).toEqual({});
  });

  it('実データ形式 YYYY/MM/DD HH:MM をパースする (空欄スキップ)', () => {
    // 環境省 yohou_*.csv の実形式 (3 時間毎、空欄は期間外/未提供)
    const real = [
      ',,2026/05/31 09:00,2026/05/31 12:00,2026/05/31 15:00,2026/06/01 12:00',
      '44132,2026/05/30 09:46, 240, 250, 260, 210',
    ].join('\n');
    const out = parseEnvWbgtCsv(real);
    expect(out['2026-05-31'].wbgtMax).toBe(26.0); // max(24,25,26)
    expect(out['2026-05-31'].hourly.find((x) => x.hour === 12).wbgt).toBe(25.0);
    expect(out['2026-06-01'].wbgtMax).toBe(21.0);
  });
});

describe('fetchEnvWbgt (§0.10 プロキシ経由)', () => {
  const csv = [',,2026053009,2026053012', '44132,2026/05/30 01:25, 250, 310'].join('\n');
  afterEach(() => vi.unstubAllGlobals());

  it('proxyUrl 指定時はプロキシ URL を叩いてパース結果を返す', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => csv }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await fetchEnvWbgt('44132', { proxyUrl: 'https://wbgt-proxy.example.workers.dev' });
    expect(fetchMock).toHaveBeenCalledWith('https://wbgt-proxy.example.workers.dev/wbgt?point=44132');
    expect(out['2026-05-30'].wbgtMax).toBe(31.0);
  });

  it('proxyUrl 末尾スラッシュは正規化される', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => csv }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchEnvWbgt('44132', { proxyUrl: 'https://x.workers.dev/' });
    expect(fetchMock).toHaveBeenCalledWith('https://x.workers.dev/wbgt?point=44132');
  });

  it('取得失敗 (例外) は null を返しフォールバック可能にする', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('CORS'); }));
    expect(await fetchEnvWbgt('44132', { proxyUrl: 'https://x.workers.dev' })).toBeNull();
  });

  it('!res.ok は null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await fetchEnvWbgt('44132', { proxyUrl: 'https://x.workers.dev' })).toBeNull();
  });
});
