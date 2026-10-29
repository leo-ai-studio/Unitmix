import { describe, expect, it } from 'vitest';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import { bienDongCan, soCanTang } from './baoThaoTac';
import { mauHieuDung, type ToaMB } from './loiThang';
import { boCucTang, congNangTai, viTriCan } from './matBang';
import { xoaCanTay } from './thaoTacTay';

// Câu báo "Căn / tầng: trước → sau" (tinh/baoThaoTac.ts) ở thao tác tay đầu tiên trên PA mới: tòa chưa có mặt bằng lưu.
const { tv, dl } = napThuVien();
const c = { tv, dl };

/** Số căn đang vẽ ở màn Tầng (như ManTang: soLieuTang trên mauCuaToa) — chỉ căn công năng 'can'. */
const soCanVe = (id: string) => {
  const toa = toaThu(id), mau = tv.toa.get(id) as unknown as ToaMB, bc = boCucTang(toa, null);
  return viTriCan(mauHieuDung(toa, mau, dl, null), tv, bc).filter((v) => congNangTai(v.khoa, bc) === 'can').length;
};

describe('biến động số căn ở thao tác đầu tiên (PA chưa có mặt bằng lưu)', () => {
  it.each(['tm-u1', 'xh-z4', 'tm-t2'])('%s: số căn trước lấy từ mặt bằng đang vẽ, không phải 0', (id) => {
    const toa = toaThu(id);
    expect(toa.matBang).toBeUndefined();
    const n = soCanVe(id);
    expect(n).toBeGreaterThan(0);
    expect(soCanTang(toa, c, null)).toBe(n);
  });

  it('xoá một căn trên PA mới: báo N → N-1 (± căn tự chỉnh gỡ), không 0 → N', () => {
    const toa = toaThu('tm-u1');
    const mau = tv.toa.get('tm-u1') as unknown as ToaMB;
    const vt = viTriCan(mau, tv).filter((v) => congNangTai(v.khoa, toa) === 'can');
    let r: ReturnType<typeof xoaCanTay> | null = null;
    for (const v of vt) { r = xoaCanTay(toa, null, [v.khoa], c); if (r.ok) break; }
    expect(r?.ok).toBe(true);
    if (!r?.ok) return;
    const bd = bienDongCan(toa, r.toa, c, null);
    expect(bd.truoc).toBe(soCanVe('tm-u1'));
    expect(bd.truoc).toBeGreaterThan(0);
    expect(bd.sau).toBeLessThan(bd.truoc);
    expect(bd.sau).toBeGreaterThanOrEqual(bd.truoc - 1 - bd.goTN.length - bd.goKhit.length);
  });
});
