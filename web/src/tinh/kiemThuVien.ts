/**
 * Kiểm cả THƯ VIỆN mẫu (màn Thư viện mẫu — nút "Kiểm thư viện"): mẫu căn (kích thước khớp tên, DT thông thủy, phòng, STRETCH, cửa,
 * QCVN 04 theo căn) và mẫu tòa (dựng được mặt bằng, 0 lỗi so với nền, số căn khớp, mọi căn tham chiếu có trong thư viện).
 * Hàm thuần. Lỗi = dữ liệu thư viện sai / thiếu; cảnh báo = lệch quy định hoặc thiếu dữ liệu tuỳ chọn.
 */
import { mauToa } from './canThem';
import { kiemMauToa, type Ctx, type ViPhamMau } from './kiemMauToa';
import { LOAI_CAN, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { tuChinhToa, type ToaMB } from './loiThang';
import { coMat } from './matBang';
import { kiemDtCanToiThieu, kiemPhongNgu9 } from './qcvn04';
import { ST_BUOC, ST_MAX, maBienThe } from './stretch';

export type MaKiemCan = 'khong_hop_le' | 'ten_kich_thuoc' | 'dt_thong_thuy' | 'phong' | 'stretch' | 'cua' | 'qcvn04_dt' | 'qcvn04_phong_ngu';
export type ViPhamCan = { ma: MaKiemCan; muc: 'loi' | 'canh_bao'; tham: Record<string, number | string> };
export type KetQuaCan = { id: string; ten: string; vi: ViPhamCan[] };
export type KetQuaToaThuVien = { id: string; ten: string; vi: ViPhamMau[]; soCan: number; soLoi: number; soCanhBao: number };
export type KetQuaThuVien = { can: KetQuaCan[]; toa: KetQuaToaThuVien[]; soLoi: number; soCanhBao: number };

/** Mẫu căn gốc (không phải biến thể STRETCH `id~s±N`). */
const laGoc = (c: CanMau) => !c.stretchGoc;

/** Kiểm một mẫu căn gốc. */
export function kiemMauCan(c: CanMau, tv: Ctx['tv']): ViPhamCan[] {
  const vi: ViPhamCan[] = [];
  const them = (ma: MaKiemCan, muc: ViPhamCan['muc'], tham: ViPhamCan['tham'] = {}) => vi.push({ ma, muc, tham });
  if (!(c.rong_mm > 0 && c.sau_mm > 0) || !LOAI_CAN.includes(c.loai) || !['giua', 'goc'].includes(c.vi_tri) || !(c.dt_tt_m2 > 0)) { them('khong_hop_le', 'loi'); return vi; }
  // tên mô-đun `…_<sâu>x<rộng>` (vd chtm_hn_2pn_g1_8500x9000) phải khớp kích thước thật
  const m = /_(\d{4,5})x(\d{4,5})$/.exec(c.ma_goc);
  if (m && (Number(m[1]) !== c.sau_mm || Number(m[2]) !== c.rong_mm)) them('ten_kich_thuoc', 'loi', { ten: `${m[1]}×${m[2]}`, that: `${c.sau_mm}×${c.rong_mm}` });
  // DT thông thủy không lớn hơn DT trong tim tường; tim tường không lớn hơn DT ô mô-đun + 10 % (căn góc V / Y có hình bao riêng nên không xét)
  if (c.dt_tt_m2 > c.dt_tim_m2 + 0.01 || (!c.khung && !/^[vy]\d/.test(c.vi_tri_ma) && c.dt_tim_m2 > (c.rong_mm * c.sau_mm) / 1e6 * 1.1)) them('dt_thong_thuy', 'loi', { tt: c.dt_tt_m2, tim: c.dt_tim_m2, modun: Math.round((c.rong_mm * c.sau_mm) / 1e4) / 100 });
  if (!c.phong?.length) them('phong', 'canh_bao');
  if (cuaThieu(c)) them('cua', 'canh_bao');
  if (c.stretch) {
    // đủ biến thể ±ST_MAX mỗi ST_BUOC, bề rộng tăng đúng bước
    const thieu: number[] = [];
    for (let st = -ST_MAX; st <= ST_MAX; st += ST_BUOC) {
      if (!st) continue;
      const b = tv.can.get(maBienThe(c.id, st));
      if (!b || Math.abs(b.rong_mm - (c.rong_mm + st)) > 1) thieu.push(st);
    }
    if (thieu.length) them('stretch', 'loi', { thieu: thieu.join(', ') });
  }
  const dt = kiemDtCanToiThieu([{ can: c, n: 1 }]);
  if (dt.trangThai === 'vuot') them('qcvn04_dt', 'canh_bao', { dt: c.dt_tt_m2, ...dt.tham });
  const ng = kiemPhongNgu9([{ can: c, n: 1 }]);
  if (ng.trangThai === 'vuot') them('qcvn04_phong_ngu', 'canh_bao', { ...ng.tham });
  return vi;
}
const cuaThieu = (c: CanMau) => c.cua_x === undefined;

/** Kiểm cả thư viện: mọi mẫu căn gốc + mọi mẫu tòa (tự chỉnh mặc định rồi `kiemMauToa`). */
export function kiemThuVien(c: Ctx, mauTheo?: (id: string) => ToaDat): KetQuaThuVien {
  const can: KetQuaCan[] = [...c.tv.can.values()].filter(laGoc).map((x) => ({ id: x.id, ten: x.ten_vi, vi: kiemMauCan(x, c.tv) }));
  const toa: KetQuaToaThuVien[] = [];
  for (const m of c.tv.toa.values()) toa.push(kiemToaThuVien(m, c, mauTheo));
  const dem = (muc: 'loi' | 'canh_bao') => can.reduce((a, x) => a + x.vi.filter((v) => v.muc === muc).length, 0) + toa.reduce((a, x) => a + x.vi.filter((v) => v.muc === muc).length, 0);
  return { can, toa, soLoi: dem('loi'), soCanhBao: dem('canh_bao') };
}

/** Kiểm một mẫu tòa thư viện (đặt 24 tầng, tự chỉnh mặc định). */
export function kiemToaThuVien(m: ToaMau, c: Ctx, mauTheo?: (id: string) => ToaDat): KetQuaToaThuVien {
  const vi: ViPhamMau[] = [];
  const ket = (): KetQuaToaThuVien => ({ id: m.id, ten: m.ten_vi, vi, soCan: m.so_can_tang, soLoi: vi.filter((x) => x.muc === 'loi').length, soCanhBao: vi.filter((x) => x.muc === 'canh_bao').length });
  if (!coMat(m)) { vi.push({ ma: 'khong_dung_mau', muc: 'loi', tham: { mau: m.id }, tang: null }); return ket(); }
  const goc: ToaDat = mauTheo?.(m.id) ?? { id: 'thu', loId: 'thu', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} };
  const toa = tuChinhToa(goc, mauToa(c.tv, goc) as ToaMB, c.tv, c.dl);
  const r = kiemMauToa(toa, c);
  vi.push(...r.vi);
  // mọi căn tham chiếu trong mẫu có trong thư viện; số căn trên mặt bằng khớp `so_can_tang`
  const thieu = new Set<string>();
  let dem = 0;
  for (const f of m.mat) for (const q of f.phan_tu) if (q.loai === 'can') { dem++; if (q.ma_thu_vien && !c.tv.can.has(q.ma_thu_vien) && ![...c.tv.can.values()].some((x) => x.ma_goc === q.ma_thu_vien)) thieu.add(q.ma_thu_vien); }
  if (thieu.size) vi.push({ ma: 'khong_dung_mau', muc: 'loi', tham: { thieu: [...thieu].join(', ') }, tang: null });
  if (dem !== m.so_can_tang) vi.push({ ma: 'so_can', muc: 'loi', tham: { baoCao: m.so_can_tang, matBang: dem }, tang: null });
  return ket();
}
