import { describe, expect, it } from 'vitest';
import { taoPAMoi } from '../tinh/macDinh';
import { GIOI_HAN_HOAN_TAC, taoKhoLoi } from './khoLoi';

describe('lõi kho PA', () => {
  it('sửa = một bước; sửa không đổi gì không ghi bước; hai lần sửa liền đọc bản mới nhất', () => {
    const da: unknown[] = [];
    const k = taoKhoLoi(taoPAMoi(), (p) => da.push(p));
    expect(k.sua((p) => p)).toBe(false);
    expect(k.sua((p) => ({ ...p, nguong: { ...p.nguong, dtCanM2: 1 } }))).toBe(true);
    expect(k.sua((p) => ({ ...p, nguong: { ...p.nguong, kichThuocM: 2 } }))).toBe(true);
    expect(k.lay().nguong).toMatchObject({ dtCanM2: 1, kichThuocM: 2 });
    expect(k.soBuoc()).toEqual({ truoc: 2, sau: 0 });
    expect(da).toHaveLength(2);
  });
  it('hoàn tác / làm lại; sửa mới xoá ngăn làm lại; giới hạn bước', () => {
    const k = taoKhoLoi(taoPAMoi(), () => {});
    k.sua((p) => ({ ...p, nguong: { ...p.nguong, dtCanM2: 1 } }));
    expect(k.hoanTac()).toBe(true);
    expect(k.hoanTac()).toBe(false);
    expect(k.lamLai()).toBe(true);
    expect(k.lay().nguong.dtCanM2).toBe(1);
    k.hoanTac();
    k.sua((p) => ({ ...p, nguong: { ...p.nguong, dtCanM2: 5 } }));
    expect(k.lamLai()).toBe(false);
    for (let i = 0; i < GIOI_HAN_HOAN_TAC + 20; i++) k.sua((p) => ({ ...p, nguong: { ...p.nguong, dtCanM2: 10 + i } }));
    expect(k.soBuoc().truoc).toBe(GIOI_HAN_HOAN_TAC);
  });
});
