import { describe, it, expect, vi, afterEach } from 'vitest';
import { deriveWbgt, parseEnvWbgtCsv, fetchEnvWbgt } from '../src/data/wbgt.js';

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
