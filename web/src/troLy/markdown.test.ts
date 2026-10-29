import { describe, expect, it } from 'vitest';
import { phanTichDong, phanTichMd } from './markdown';

describe('markdown rút gọn của Leo AI', () => {
  it('khối: tiêu đề, đoạn, danh sách, bảng, mã, trích, kẻ', () => {
    const k = phanTichMd('## Kết quả\nĐã đổi **2 căn**.\n\n- a\n- b\n1. x\n2. y\n\n| Loại | Trước | Sau |\n|---|---:|---:|\n| 2PN | 10 | 12 |\n\n```json\n{"a":1}\n```\n> lưu ý\n---');
    expect(k.map((x) => x.t)).toEqual(['h', 'p', 'ds', 'ds', 'bang', 'ma', 'trich', 'ke']);
    const b = k[4] as Extract<typeof k[number], { t: 'bang' }>;
    expect(b.dau).toHaveLength(3);
    expect(b.hang[0][0]).toEqual([{ t: 'chu', v: '2PN' }]);
    expect(k[5]).toEqual({ t: 'ma', ngonNgu: 'json', v: '{"a":1}' });
  });
  it('khối mã chưa đóng (đang chảy) → mã tới cuối', () => {
    expect(phanTichMd('```\nabc\ndef')).toEqual([{ t: 'ma', ngonNgu: '', v: 'abc\ndef' }]);
  });
  it('chữ trong dòng: đậm, nghiêng, mã, liên kết chỉ http(s)', () => {
    expect(phanTichDong('a **b** *c* `d` [e](https://x.vn) [f](javascript:alert(1))')).toEqual([
      { t: 'chu', v: 'a ' }, { t: 'dam', c: [{ t: 'chu', v: 'b' }] }, { t: 'chu', v: ' ' }, { t: 'nghieng', c: [{ t: 'chu', v: 'c' }] }, { t: 'chu', v: ' ' },
      { t: 'ma', v: 'd' }, { t: 'chu', v: ' ' }, { t: 'lk', href: 'https://x.vn', c: [{ t: 'chu', v: 'e' }] }, { t: 'chu', v: ' [f](javascript:alert(1))' },
    ]);
  });
});
