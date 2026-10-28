import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BIEU_TUONG } from './bieuTuong';
import { SVG_BT } from './bieuTuongSvg';

const doc = (l: string) => JSON.parse(readFileSync(new URL(`../i18n/${l}.json`, import.meta.url), 'utf8')) as Record<string, string>;

describe('bộ biểu tượng công cụ', () => {
  it('mỗi biểu tượng có tên ở cả vi.json và en.json (tooltip / aria-label)', () => {
    for (const l of ['vi', 'en']) {
      const d = doc(l);
      for (const k of Object.keys(BIEU_TUONG)) expect(d[`bt.${k}`], `${l} bt.${k}`).toBeTruthy();
    }
  });
  it('mỗi việc một biểu tượng riêng, không trùng', () => {
    const ds = Object.values(BIEU_TUONG);
    expect(new Set(ds).size).toBe(ds.length);
  });

  it('hình SVG: chỉ cho khoá có trong BIEU_TUONG, không trùng hình, chỉ dùng thẻ hình cơ bản (không script / style)', () => {
    for (const k of Object.keys(SVG_BT)) expect(k in BIEU_TUONG, k).toBe(true);
    const ds = Object.values(SVG_BT);
    expect(new Set(ds).size).toBe(ds.length);
    for (const s of ds) expect(s).toMatch(/^(<(path|rect|circle) [^<>]*\/>)+$/);
  });
});
