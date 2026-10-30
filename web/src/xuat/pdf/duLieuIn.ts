/**
 * Chuẩn bị dữ liệu cho tài liệu in (PDF): nhóm tòa theo mẫu + bố cục, tải hình học căn / lõi (có hay không nội thất), mặt bằng đã tự chỉnh,
 * số liệu từng căn (CH-xx), thống kê theo lô so với quy hoạch / đề bài KD. Hàm thuần sau khi dữ liệu nạp xong — không chạm giao diện.
 */
import { mauToa } from '../../tinh/canThem';
import { tinhChiTieu, type KetQuaChiTieu } from '../../tinh/chiTieu';
import { demCan } from '../../tinh/coCau';
import { LOAI_CAN, type CanMau, type LoaiCan, type ThuVien, type ToaDat, type TrangThaiPA } from '../../tinh/kieu';
import { chuKyMatBang, daGiacCacLoi, type DuLieuMB, type ToaMB } from '../../tinh/loiThang';
import { boCucTang, canCuaToa, coMat, type BoCuc } from '../../tinh/matBang';
import { idTepCan, veTheoId } from '../../tinh/stretch';
import { mauCuaToa, choDuLieuMB } from '../../man/tuChinhTang';
import { idLoi, tai, taiVeCan, type HinhHocTai, type HinhLoi } from '../../ve/hinhHocThuVien';
import { soLieuTang, type ToaVe } from '../../ve/MatBangTang';
import type { Diem } from '../../tinh/kieu';

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
    kq: tinhChiTieu(pa, tv), nhom, hinh: { can: new Map(a), loi: new Map(b), dangTai: false }, dl,
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
