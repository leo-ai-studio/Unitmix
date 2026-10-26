import { describe, expect, it } from 'vitest';
import { fmtSo } from './so';
import vi from '../i18n/vi.json';
import en from '../i18n/en.json';

describe('fmtSo', () => {
  it('định dạng kiểu Việt', () => {
    expect(fmtSo(41280, {}, 'vi')).toBe('41.280');
    expect(fmtSo(38.6, { thapPhan: 1, donVi: '%' }, 'vi')).toBe('38,6 %');
  });
  it('định dạng kiểu Anh', () => {
    expect(fmtSo(41280, {}, 'en')).toBe('41,280');
    expect(fmtSo(38.6, { thapPhan: 1, donVi: '%' }, 'en')).toBe('38.6 %');
  });
  it('không bao giờ hiện undefined, NaN, Infinity', () => {
    for (const v of [NaN, undefined, null, 1 / 0, -1 / 0]) expect(fmtSo(v as number, {}, 'vi')).toBe('—');
  });
});

describe('i18n', () => {
  it('vi và en có cùng bộ khoá', () => {
    expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
  });
});
