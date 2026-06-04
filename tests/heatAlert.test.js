import { describe, it, expect } from 'vitest';
import { heatAlertLevel } from '../src/score/heatAlert.js';

describe('heatAlertLevel (§0.39.2 熱中症警戒級・WBGT 予測由来)', () => {
  it('WBGT 33 以上で警戒級', () => {
    expect(heatAlertLevel(34)).toMatchObject({ label: '熱中症警戒級', wbgt: 34 });
    expect(heatAlertLevel(33)).toMatchObject({ label: '熱中症警戒級' }); // 境界
  });

  it('WBGT 33 未満は null', () => {
    expect(heatAlertLevel(32.9)).toBeNull();
    expect(heatAlertLevel(28)).toBeNull();
    expect(heatAlertLevel(0)).toBeNull();
  });

  it('null / NaN は null', () => {
    expect(heatAlertLevel(null)).toBeNull();
    expect(heatAlertLevel(NaN)).toBeNull();
  });

  it('wbgt は小数 1 桁 (§0.65.1)', () => {
    expect(heatAlertLevel(33.64).wbgt).toBe(33.6);
    expect(heatAlertLevel(33.0).wbgt).toBe(33);
  });
});
