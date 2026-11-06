/**
 * Chuẩn bị dữ liệu cho tài liệu in (PDF): nhóm tòa theo mẫu + bố cục, tải hình học căn / lõi (có hay không nội thất), mặt bằng đã tự chỉnh,
 * số liệu từng căn (CH-xx), thống kê theo lô so với quy hoạch / đề bài KD. Hàm thuần sau khi dữ liệu nạp xong — không chạm giao diện.
 */
import { mauToa } from '../../tinh/canThem';
import { tinhChiTieu, type KetQuaChiTieu } from '../../tinh/chiTieu';
import { demCan } from '../../tinh/coCau';
import { danSoLo } from '../../tinh/danSo';
import { DS_LOAI_NHA, loaiNhaCuaLo, type LoaiNhaO } from '../../tinh/loaiNha';
import { giengThangMay, kiemThangMay, type KiemThangMay, type LoiGieng } from '../../tinh/thangMay';
import { LOAI_CAN, type CanMau, type LoaiCan, type ThuVien, type ToaDat, type TrangThaiPA } from '../../tinh/kieu';
import { chuKyMatBang, daGiacCacLoi, type DuLieuMB, type ToaMB } from '../../tinh/loiThang';
import { boCucTang, canCuaToa, coMat, type BoCuc } from '../../tinh/matBang';
import { idTepCan, veTheoId } from '../../tinh/stretch';
import { mauCuaToa, choDuLieuMB } from '../../man/tuChinhTang';
import { idLoi, tai, taiVeCan, type HinhHocTai, type HinhLoi } from '../../ve/hinhHocThuVien';
import { soLieuTang, type ToaVe } from '../../ve/MatBangTang';
import type { Diem } from '../../tinh/kieu';
import type { PhanBoGio } from '../../tinh/nangGio/gio';
import { TC_MAC_DINH, type TuyChonBC } from './tuyChonIn';

/** Một nhóm tòa cùng mẫu + cùng bố cục tầng: in một mặt bằng cho cả nhóm, ghi ký hiệu lô / số tòa. */
export type NhomToaIn = {
  khoa: string;
  mauId: string;
  ten: string;
  toas: ToaDat[];
  /** Tòa đại diện (để lấy số tầng, bố cục). */
  dai: ToaDat;
  mau: ToaVe;
  bc: BoCuc;
  sl: ReturnType<typeof soLieuTang>;
  loiDG: Diem[][];
  /** Mẫu căn có mặt ở tầng điển hình: số căn mỗi tầng. */
  canTang: { can: CanMau; n: number }[];
  /** Mỗi loại căn (mẫu) → danh sách số CH-xx. */
  chTheoMau: Map<string, number[]>;
};

export type DuLieuIn = {
  pa: TrangThaiPA;
  tv: ThuVien;
  tenDuAn: string;
  tenPA: string;
  ngay: string;
  kq: KetQuaChiTieu;
  nhom: NhomToaIn[];
  hinh: HinhHocTai;
  dl: DuLieuMB;
  /** Tuỳ chọn báo cáo. */
  tc: TuyChonBC;
  /** Hoa gió tại vị trí dự án; null khi chưa đặt vị trí hoặc không tải được. */
  gio: PhanBoGio | null;
};

const tenNgan = (s: string) => s.split(' · ')[0];

/**
 * Nạp mọi thứ tài liệu in cần. `noiThat` = vẽ kèm nét nội thất (Salekit, HĐMB); báo cáo bỏ cho gọn.
 * Chờ dữ liệu tự chỉnh mặt bằng để mặt bằng in đúng như trên màn.
 */
export async function chuanBiIn(pa: TrangThaiPA, tv: ThuVien, o: { tenDuAn: string; tenPA: string; noiThat: boolean }): Promise<DuLieuIn> {
  const dl = await choDuLieuMB(pa, tv);
  const nhomMap = new Map<string, NhomToaIn>();
  for (const x of pa.toa) {
    const m0 = mauToa(tv, x);
    if (!m0 || !coMat(m0)) continue;
    const khoa = [x.mauId, chuKyMatBang(x), JSON.stringify([x.canTheo, x.canViTri, x.congNang, x.latO])].join('|');
    let n = nhomMap.get(khoa);
    if (!n) {
      const mau = mauCuaToa(x, m0 as ToaVe, null), bc = boCucTang(x, null), sl = soLieuTang(mau, bc, tv);
      const can = canCuaToa(m0, bc, tv).flatMap(([id, k]) => { const c = tv.can.get(id); return c ? [{ can: c, n: k }] : []; });
      const chTheoMau = new Map<string, number[]>();
      sl.can.forEach((c) => { if (c.cn === 'can') (chTheoMau.get(c.canId) ?? chTheoMau.set(c.canId, []).get(c.canId)!).push(c.no); });
      n = { khoa, mauId: x.mauId, ten: tenNgan(m0.ten_vi), toas: [], dai: x, mau, bc, sl, loiDG: daGiacCacLoi(mau as unknown as ToaMB, dl), canTang: can, chTheoMau };
      nhomMap.set(khoa, n);
    }
    n.toas.push(x);
  }
  const nhom = [...nhomMap.values()];
  const canIds = [...new Set(nhom.flatMap((n) => n.sl.can.map((c) => c.canId)))];
  const loiIds = [...new Set(nhom.flatMap((n) => n.mau.mat.flatMap((m) => m.phan_tu.filter((q) => q.loai !== 'can').map((q) => idLoi(q.block)))))];
  const [a, b] = await Promise.all([
    Promise.all(canIds.map((id) => taiVeCan(idTepCan(id), o.noiThat).then((ve) => [id, veTheoId(id, ve, tv)] as const))),
    Promise.all(loiIds.map((id) => tai<HinhLoi>(`/lib/loi/${id}.json`).then((j) => [id, j ?? { paths: [] }] as const))),
  ]);
  return {
    pa, tv, tenDuAn: o.tenDuAn, tenPA: o.tenPA, ngay: new Date().toLocaleDateString('vi-VN'),
    kq: tinhChiTieu(pa, tv), nhom, hinh: { can: new Map(a), loi: new Map(b), dangTai: false }, dl, tc: TC_MAC_DINH, gio: null,
  };
}

/** Cơ cấu và DT thông thủy bình quân theo loại của một lô: số căn cả lô (mọi tầng), % và DT bình quân (m²) mỗi loại. */
export function thongKeLo(d: DuLieuIn, loId: string): { soCan: Record<LoaiCan, number>; tong: number; pct: Record<LoaiCan, number>; dtBq: Record<LoaiCan, number | null> } {
  const dem = demCan(d.pa, d.tv);
  const soCan = Object.fromEntries(LOAI_CAN.map((l) => [l, 0])) as Record<LoaiCan, number>;
  const dt = Object.fromEntries(LOAI_CAN.map((l) => [l, 0])) as Record<LoaiCan, number>;
  const sl = Object.fromEntries(LOAI_CAN.map((l) => [l, 0])) as Record<LoaiCan, number>; // số căn theo bố cục chung — mẫu số của DT bình quân
  for (const x of d.pa.toa.filter((q) => q.loId === loId)) {
    for (const l of LOAI_CAN) soCan[l] += dem[x.id]?.[l] ?? 0;
    const m0 = mauToa(d.tv, x);
    if (!m0 || !coMat(m0)) continue;
    // DT theo mẫu căn: số căn mỗi tầng × số tầng (bố cục chung; tầng riêng lệch ít — ghi chú trên tài liệu)
    for (const [id, k] of canCuaToa(m0, boCucTang(x, null), d.tv)) { const c = d.tv.can.get(id); if (c) { dt[c.loai] += k * x.soTangDH * c.dt_tt_m2; sl[c.loai] += k * x.soTangDH; } }
  }
  const tong = LOAI_CAN.reduce((s, l) => s + soCan[l], 0);
  const pct = Object.fromEntries(LOAI_CAN.map((l) => [l, tong ? (soCan[l] / tong) * 100 : 0])) as Record<LoaiCan, number>;
  const dtBq = Object.fromEntries(LOAI_CAN.map((l) => [l, sl[l] ? dt[l] / sl[l] : null])) as Record<LoaiCan, number | null>;
  return { soCan, tong, pct, dtBq };
}

/** Ngưỡng căn nhỏ trong bảng tổng mặt bằng (m² thông thủy), theo mẫu báo cáo TMB dự án: thống kê, không phải luật kiểm. */
export const DT_CAN_NHO = 45;

/** Số căn cả lô và số căn nhỏ hơn `DT_CAN_NHO`, theo bố cục chung × số tầng điển hình. */
export function canNhoLo(d: DuLieuIn, loId: string): { tong: number; nho: number } {
  let tong = 0, nho = 0;
  for (const x of d.pa.toa.filter((q) => q.loId === loId)) {
    const m0 = mauToa(d.tv, x);
    if (!m0 || !coMat(m0)) continue;
    for (const [id, k] of canCuaToa(m0, boCucTang(x, null), d.tv)) {
      const c = d.tv.can.get(id);
      if (!c) continue;
      tong += k * x.soTangDH;
      if (c.dt_tt_m2 < DT_CAN_NHO) nho += k * x.soTangDH;
    }
  }
  return { tong, nho };
}

export type DongUnitmix = { can: CanMau; dt: number; tyLe: number; canTang: number; canToa: number; nguoi: number; danToa: number };
export type UnitmixToa = { dong: DongUnitmix[]; soTang: number; canTang: number; canToa: number; danToa: number; dtsd: number; dtxd: number | null; hieuSuat: number | null; thang: KiemThangMay };

/** Bảng unit mix một tòa đại diện của nhóm: mỗi mẫu căn một dòng, dân theo QĐ tỉnh đã khai (người / căn), thang máy TK so với QCVN 04. */
export function unitmixToa(d: DuLieuIn, n: NhomToaIn): UnitmixToa {
  const lo = d.pa.lo.find((l) => l.id === n.dai.loId), soTang = n.dai.soTangDH;
  const ds = lo ? danSoLo(d.pa, lo, d.tv).dong : [];
  const canTang = n.canTang.reduce((a, c) => a + c.n, 0);
  const dong = n.canTang.map(({ can, n: k }): DongUnitmix => {
    const nguoi = ds.find((x) => x.canId === can.id)?.nguoiMoiCan ?? lo?.temDat.chiTieu.nguoiMoiCan ?? 0;
    return { can, dt: can.dt_tt_m2, tyLe: canTang ? (k / canTang) * 100 : 0, canTang: k, canToa: k * soTang, nguoi, danToa: k * soTang * nguoi };
  }).sort((a, b) => LOAI_CAN.indexOf(a.can.loai) - LOAI_CAN.indexOf(b.can.loai) || a.dt - b.dt);
  const canToa = canTang * soTang, danToa = dong.reduce((a, x) => a + x.danToa, 0);
  const dtsd = dong.reduce((a, x) => a + x.dt * x.canTang, 0), dtxd = n.dai.dtxdM2 ?? d.tv.toa.get(n.mauId)?.dtxd_m2 ?? null;
  const g = giengThangMay(n.mau.mat, (b) => d.dl.loi.get(b) as LoiGieng | undefined);
  return { dong, soTang, canTang, canToa, danToa, dtsd, dtxd, hieuSuat: dtxd ? (dtsd / dtxd) * 100 : null, thang: kiemThangMay(g.so, n.dai.soTangDe + soTang, canToa, danToa, g.thieuHinh) };
}

/** Một cột của bảng tổng hợp: QH và phương án của một loại nhà ở (hoặc cả dự án). */
export type CotTongHop = { nhan: LoaiNhaO | 'tong'; soLo: number; soToa: number; dtLo: number; dtxd: [number | null, number]; gfa: [number | null, number]; dtTt: number; soCan: [number | null, number]; danSo: [number | null, number]; dtThap: number };

/** Bảng tổng hợp so sánh chỉ tiêu: gộp các lô có tòa theo loại nhà ở + cột tổng. QH thiếu ở lô nào thì cột đó ghi — (không cộng thiếu). */
export function tongHopChiTieu(d: DuLieuIn): CotTongHop[] {
  const moi = (nhan: CotTongHop['nhan']): CotTongHop => ({ nhan, soLo: 0, soToa: 0, dtLo: 0, dtxd: [0, 0], gfa: [0, 0], dtTt: 0, soCan: [0, 0], danSo: [0, 0], dtThap: 0 });
  const cong = (a: [number | null, number], qh: number | null, pa: number) => { a[0] = a[0] === null || qh === null ? null : a[0] + qh; a[1] += pa; };
  const nhom = new Map<CotTongHop['nhan'], CotTongHop>();
  for (const lo of d.pa.lo) {
    const k = d.kq.theoLo[lo.id], l = loaiNhaCuaLo(lo), so = d.pa.toa.filter((x) => x.loId === lo.id).length;
    if (!k || !l || !so) continue;
    const ct = lo.temDat.chiTieu, tk = thongKeLo(d, lo.id), m = (khoa: string) => k.dong.find((x) => x.khoa === khoa);
    for (const c of [l, 'tong'] as const) {
      const a = nhom.get(c) ?? nhom.set(c, moi(c)).get(c)!;
      a.soLo++; a.soToa += so; a.dtLo += k.dtLo; a.dtThap += k.dtSanChiTiet.thap;
      a.dtTt += LOAI_CAN.reduce((s, x) => s + tk.soCan[x] * (tk.dtBq[x] ?? 0), 0);
      cong(a.dtxd, ct.matDoMax ? (k.dtLo * ct.matDoMax) / 100 : null, k.dtDe);
      cong(a.gfa, ct.hssddMax ? k.dtLo * ct.hssddMax : null, k.dtSanTinhHSSDD);
      cong(a.soCan, m('soCan')?.mucTieu ?? null, k.soCan);
      cong(a.danSo, m('danSo')?.mucTieu ?? null, m('danSo')?.dat ?? 0);
    }
  }
  return [...DS_LOAI_NHA, 'tong' as const].flatMap((c) => nhom.get(c) ?? []);
}
