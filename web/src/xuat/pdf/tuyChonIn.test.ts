import { describe, expect, it } from 'vitest';
import { chuanTuyChon, TC_MAC_DINH } from './tuyChonIn';

describe('tuỳ chọn báo cáo PDF', () => {
  it('giá trị hỏng về mặc định', () => {
    for (const x of [null, undefined, 'x', 7, {}]) expect(chuanTuyChon(x)).toEqual(TC_MAC_DINH);
    const v = chuanTuyChon({ trinhBay: 'la', bangMau: 'hd_mb', coChu: 9, net: { day: 99, mauTuong: 'red' } });
    expect(v).toEqual(TC_MAC_DINH);
  });
  it('bản lưu cũ thiếu khoá mới vẫn đủ lớp, giữ khoá đã chọn', () => {
    const v = chuanTuyChon({ lop: { temCan: false }, net: { day: 1.5, mauTuong: '#112233' } });
    expect(v.lop.temCan).toBe(false);
    expect(v.lop.toLo).toBe(true);
    expect(v.net).toEqual({ day: 1.5, mauTuong: '#112233', mauToa: null, mauRanh: null, mauChiGioi: null });
  });
});
