// §0.39.3 (#21) : 気象庁の警報 ・ 注意報 (千葉県北西部 120010 = 浦安を含む)。
// この API は「現在発表中」の状態 (イベント駆動) で日別予報ではないため、当日カードにのみ表示する。
import { withRetry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';

const URL = 'https://www.jma.go.jp/bosai/warning/data/warning/120000.json';
const AREA_NW = '120010'; // 千葉県北西部 (浦安を含む)

// JMA 警報コード → { label, level }。level: emergency(特別警報) / warning(警報) / advisory(注意報)
const WARNING_CODES = {
  '02': { label: '暴風雪警報', level: 'warning' },
  '03': { label: '大雨警報', level: 'warning' },
  '04': { label: '洪水警報', level: 'warning' },
  '05': { label: '暴風警報', level: 'warning' },
  '06': { label: '大雪警報', level: 'warning' },
  '07': { label: '波浪警報', level: 'warning' },
  '08': { label: '高潮警報', level: 'warning' },
  '10': { label: '大雨注意報', level: 'advisory' },
  '12': { label: '大雪注意報', level: 'advisory' },
  '13': { label: '風雪注意報', level: 'advisory' },
  '14': { label: '雷注意報', level: 'advisory' },
  '15': { label: '強風注意報', level: 'advisory' },
  '16': { label: '波浪注意報', level: 'advisory' },
  '18': { label: '洪水注意報', level: 'advisory' },
  '19': { label: '高潮注意報', level: 'advisory' },
  '20': { label: '濃霧注意報', level: 'advisory' },
  '21': { label: '乾燥注意報', level: 'advisory' },
  '22': { label: 'なだれ注意報', level: 'advisory' },
  '23': { label: '低温注意報', level: 'advisory' },
  '24': { label: '霜注意報', level: 'advisory' },
  '25': { label: '着氷注意報', level: 'advisory' },
  '26': { label: '着雪注意報', level: 'advisory' },
  '32': { label: '暴風雪特別警報', level: 'emergency' },
  '33': { label: '大雨特別警報', level: 'emergency' },
  '35': { label: '暴風特別警報', level: 'emergency' },
  '36': { label: '大雪特別警報', level: 'emergency' },
  '37': { label: '波浪特別警報', level: 'emergency' },
  '38': { label: '高潮特別警報', level: 'emergency' },
};

const RANK = { emergency: 0, warning: 1, advisory: 2 };

// parseWarning(json) -> { warnings: [{code,label,level}], reportDatetime } | null  (pure ・ テスト可能)
export function parseWarning(json) {
  if (!json || !Array.isArray(json.areaTypes)) return null;
  const at = json.areaTypes[0]; // 一次細分区域
  if (!at || !Array.isArray(at.areas)) return null;
  const area = at.areas.find((a) => a.code === AREA_NW);
  const reportDatetime = json.reportDatetime || null;
  if (!area || !Array.isArray(area.warnings)) return { warnings: [], reportDatetime };
  const warnings = area.warnings
    .filter((w) => w.status !== '解除' && w.status !== '解除予報')
    .map((w) => {
      const meta = WARNING_CODES[w.code];
      return meta ? { code: w.code, label: meta.label, level: meta.level } : null;
    })
    .filter(Boolean)
    .sort((a, b) => RANK[a.level] - RANK[b.level]);
  return { warnings, reportDatetime };
}

export async function fetchJmaWarning() {
  try {
    const json = await withRetry(
      async () => {
        const res = await fetch(URL);
        if (!res.ok) throw new Error(`JMA warning HTTP ${res.status}`);
        return res.json();
      },
      { label: 'JMA警報' },
    );
    return parseWarning(json);
  } catch (e) {
    logger.info('気象庁警報 取得スキップ', e.message);
    return null;
  }
}
