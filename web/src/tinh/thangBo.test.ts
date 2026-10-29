/**
 * Quy tắc thang bộ MỌI tòa / MỌI phương án (chủ nhiệm 2026-10-29): mặc định 2 thang, tối đa 3 (PC-11, thêm tay, tối ưu đều không
 * vượt), xoá chặn ở 2, luôn có ít nhất một N2 (`x_tb_n2`) và một N3 (`x_tb_n3`); đổi loại theo từng ô như QT-63 (điểm chèn giữ
 * nguyên); PA cũ sai số / loại thang thì tự chỉnh lại khi mở (chuanHoaPA).
 */
import { describe, expect, it } from 'vitest';
import { layMau } from '../thu/layMau';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import type { ToaDat, TrangThaiPA } from './kieu';
import { chuanHoaPA, taoPAMoi } from './macDinh';
import { apMatBang, demLoaiThang, ganLoaiThang, matBangCua, matBangMacDinh, THANG_N2, THANG_N3, thangDungLuat, tuChinhToa, type ToaMB } from './loiThang';
import { viTriCan } from './matBang';
import { doiLoaiThangTay, themThangTay, xoaThangTay, type KetQuaTay } from './thaoTacTay';

const { tv, dl, toaDs } = napThuVien();
const c = { tv, dl };
const mau = (id: string) => tv.toa.get(id) as unknown as ToaMB;
const tuChinh = (id: string, them: Partial<ToaDat> = {}) => tuChinhToa({ ...toaThu(id), ...them }, mau(id), tv, dl);
const ok = (r: KetQuaTay): ToaDat => { if (!r.ok) throw new Error(`không áp được: ${r.lyDo}`); return r.toa; };
const mb = (t: ToaDat) => matBangCua(t, mau(t.mauId), dl);

describe('quy tắc thang bộ: 2–3 thang, luôn một N2 + một N3', () => {
  it('ganLoaiThang: mặc định thang thứ hai là N2, còn lại N3; chọn tay được giữ, vẫn đủ hai loại', () => {
    const t = (khoa: string, a0: number) => ({ khoa, matIdx: 0, a0, rong: 3000, sx: 1 as const, dIns: 0, bIns: 0, block: THANG_N3, nguon: 'mau' as const });
    const ds = [t('b', 20000), t('a', 0), t('c', 40000)];
    expect(ganLoaiThang(ds).map((x) => x.block)).toEqual([THANG_N2, THANG_N3, THANG_N3]);
    // chọn a = N2 → b về N3
    expect(ganLoaiThang(ds, { a: THANG_N2 }).map((x) => x.block)).toEqual([THANG_N3, THANG_N2, THANG_N3]);
    // chọn tay cả hai thang N3 (2 thang) → vẫn phải có N2: đổi thang chọn tay cuối
    const hai = ganLoaiThang(ds.slice(0, 2), { a: THANG_N3, b: THANG_N3 });
    expect(demLoaiThang(hai)).toMatchObject({ n2: 1, n3: 1 });
    // không đổi mảng vào
    expect(ds.every((x) => x.block === THANG_N3)).toBe(true);
  });

  it.each(layMau(toaDs.map((x) => x.id), 3))('%s: mặt bằng mẫu + sau tự chỉnh (PC-11) đúng luật; 3 thang chỉ khi 2 thang còn căn vượt', (id) => {
    const m = mau(id);
    if (!Array.isArray(m.mat)) return;
    const goc = matBangMacDinh(m, dl);
    expect(thangDungLuat(goc.thangBo), `${id} mẫu`).toBe(true);
    const t = tuChinh(id), ds = mb(t).thangBo;
    expect(thangDungLuat(ds), `${id} tự chỉnh ${JSON.stringify(demLoaiThang(ds))}`).toBe(true);
    // điểm chèn / ô thang không đổi khi đổi loại → nét bao như cũ
    expect(apMatBang(m, mb(t), dl).duong_bao.length).toBeGreaterThan(2);
  });

  it('thêm tay: tòa đã đủ 3 thang thì chặn (nhieu_thang); tòa 2 thang thêm được tới 3', () => {
    const t3 = tuChinh('tm-t2');
    expect(mb(t3).thangBo.length).toBe(3);
    const vt = viTriCan(apMatBang(mau('tm-t2'), mb(t3), dl), tv)[0];
    const r = themThangTay(t3, vt.matIdx, vt.khoa, c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.lyDo).toBe('nhieu_thang');
    const t2 = tuChinh('tm-l1');
    expect(mb(t2).thangBo.length).toBe(2);
    let kq: KetQuaTay | null = null;
    for (const v of viTriCan(apMatBang(mau('tm-l1'), mb(t2), dl), tv)) { kq = themThangTay(t2, v.matIdx, v.khoa, c); if (kq.ok) break; }
    const t3b = ok(kq!);
    expect(mb(t3b).thangBo.length).toBe(3);
    expect(thangDungLuat(mb(t3b).thangBo)).toBe(true);
    const v2 = viTriCan(apMatBang(mau('tm-l1'), mb(t3b), dl), tv)[0];
    const r4 = themThangTay(t3b, v2.matIdx, v2.khoa, c);
    expect(r4.ok).toBe(false);
  });

  it('xoá: bỏ thang N2 duy nhất của tòa 3 thang → còn 2 thang, vẫn một N2 + một N3; còn 2 thì chặn', () => {
    let t = tuChinh('tm-t2');
    const n2 = mb(t).thangBo.find((x) => x.block === THANG_N2)!;
    let xoa = false;
    for (const k of [n2.khoa, ...mb(t).thangBo.map((x) => x.khoa)]) { const r = xoaThangTay(t, k, c); if (r.ok) { t = r.toa; xoa = true; break; } }
    expect(xoa).toBe(true);
    expect(demLoaiThang(mb(t).thangBo)).toMatchObject({ so: 2, n2: 1, n3: 1 });
    const r = xoaThangTay(t, mb(t).thangBo[0].khoa, c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.lyDo).toBe('it_thang');
  });

  it('đổi loại N2 ↔ N3 (QT-63): điểm chèn + vị trí mọi căn + DTXD giữ nguyên; thang N2 duy nhất sang N3 thì thang kia thành N2', () => {
    for (const id of ['tm-l1', 'tm-t2']) {
      const t = tuChinh(id), ds = mb(t).thangBo;
      const n2 = ds.find((x) => x.block === THANG_N2)!;
      const t1 = ok(doiLoaiThangTay(t, n2.khoa, THANG_N3, c)), ds1 = mb(t1).thangBo;
      expect(ds1.find((x) => x.khoa === n2.khoa)!.block, id).toBe(THANG_N3);
      expect(demLoaiThang(ds1).n2, id).toBe(1);
      expect(ds1.map((x) => [x.khoa, x.matIdx, x.a0, x.sx, x.dIns])).toEqual(ds.map((x) => [x.khoa, x.matIdx, x.a0, x.sx, x.dIns]));
      const hd0 = apMatBang(mau(id), mb(t), dl), hd1 = apMatBang(mau(id), mb(t1), dl);
      expect(viTriCan(hd1, tv).map((v) => [v.khoa, Math.round(v.a0)])).toEqual(viTriCan(hd0, tv).map((v) => [v.khoa, Math.round(v.a0)]));
      expect(hd1.dtxd_m2).toBe(hd0.dtxd_m2);
      // chạy lại tự chỉnh vẫn giữ loại đã chọn
      const t2 = tuChinhToa(t1, mau(id), tv, dl);
      expect(mb(t2).thangBo.find((x) => x.khoa === n2.khoa)?.block, id).toBe(THANG_N3);
      expect(thangDungLuat(mb(t2).thangBo)).toBe(true);
      // đổi lại loại cũ / đổi trùng loại
      expect(doiLoaiThangTay(t1, n2.khoa, THANG_N3, c).ok).toBe(false);
    }
    // tòa chưa tự chỉnh (mặt bằng mẫu): đổi loại chạy tự chỉnh, vẫn đúng luật
    const t0 = toaThu('tm-i2'), g = matBangCua(t0, mau('tm-i2'), dl).thangBo;
    const t1 = ok(doiLoaiThangTay(t0, g.find((x) => x.block === THANG_N3)!.khoa, THANG_N2, c));
    expect(demLoaiThang(mb(t1).thangBo)).toMatchObject({ so: 2, n2: 1, n3: 1 });
  });

  it('thang tay > 3 (PA cũ cho đặt 4 thang) → tự chỉnh cắt về 3, vẫn một N2 + một N3', () => {
    const t = tuChinh('tm-t2');
    const ds = mb(t).thangBo;
    // thang tay: 3 thang hiện có + 1 thang thêm sau căn đầu
    const vt = viTriCan(apMatBang(mau('tm-t2'), mb(t), dl), tv).find((v) => !ds.some((x) => x.matIdx === v.matIdx && Math.abs(x.a0 - v.a1) < 5))!;
    const thangTay = { them: [...ds.map((x) => ({ khoa: x.khoa, mat: x.matIdx, sx: x.sx, tu: x.khoa })), { khoa: 'tay9', mat: vt.matIdx, sau: vt.khoa, sx: 1 as const }], bo: [] };
    const t4 = tuChinhToa({ ...t, thangTay }, mau('tm-t2'), tv, dl);
    expect(thangDungLuat(mb(t4).thangBo), JSON.stringify(demLoaiThang(mb(t4).thangBo))).toBe(true);
  });

  it('mở PA cũ (chuanHoaPA): mặt bằng lưu toàn N3 → gán N2; 4 thang → bỏ mặt bằng lưu, về mẫu (2–3 thang); loại sai giá trị bỏ', () => {
    const t = tuChinh('tm-t2');
    const toanN3 = { ...t, id: 'a', matBang: { ...t.matBang!, thangBo: t.matBang!.thangBo.map((x) => ({ ...x, block: THANG_N3 })) }, loaiThang: { x: 'sai' } };
    const thua = { ...t, id: 'b', matBang: { ...t.matBang!, thangBo: [...t.matBang!.thangBo, { ...t.matBang!.thangBo[0], khoa: 'tay9', a0: t.matBang!.thangBo[0].a0 + 50000 }] } };
    const pa: TrangThaiPA = { ...taoPAMoi(), toa: [toanN3, thua] };
    const ra = chuanHoaPA(JSON.parse(JSON.stringify(pa)) as TrangThaiPA);
    const a = ra.toa.find((x) => x.id === 'a')!, b = ra.toa.find((x) => x.id === 'b')!;
    expect(demLoaiThang(a.matBang!.thangBo)).toMatchObject({ so: 3, n2: 1, n3: 2 });
    expect(a.loaiThang).toBeUndefined();
    expect(b.matBang).toBeUndefined();
    expect(b.duongBao).toBeUndefined();
    expect(thangDungLuat(mb(b).thangBo)).toBe(true);
  });
});
