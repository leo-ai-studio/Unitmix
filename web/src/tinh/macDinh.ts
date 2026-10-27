import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, PHAN_HAM_MAC_DINH, type ChiPhiPA, type ChiTieuQH, type ChucNang, type Diem, type KhuXeDien, type RamHam, type ThongSoHam, type LoaiCan, type Lo, type ToaDat, type TrangThaiPA } from './kieu';

/** Chỉ tiêu mặc định khi chưa nhập (giá trị tạm, ghi rõ trên giao diện là chờ chủ nhiệm chốt). */
export const CHI_TIEU_MAC_DINH: ChiTieuQH = {
  matDoMax: 40,
  matDoThapMax: null,
  hssddMax: 3.5,
  tangCaoMax: 25,
  tangDe: null,
  tangCanHo: null,
  tangHam: null,
  danSoMax: 1600,
  soCanMax: null,
  nguoiMoiCan: 3.5,
  choDoOtoMoiCan: 1,
  choXeMayMoiCan: 2,
  cayXanhMin: 20,
};
export const CO_CAU_MAC_DINH: Record<LoaiCan, number> = { stu: 5, '1pn': 20, '2pn': 45, '2pnp': 15, '3pn': 15 };

/** Ram vào hầm mặc định (tự đặt dọc cạnh dài nhất ranh hầm). Kích thước tạm, chờ chủ nhiệm chốt. */
export const RAM_MAC_DINH: RamHam = { x: null, y: null, gocDo: null, dai: 22, rong: 5.5, loai: 'thang_mai', docNgang: 2, coNguoiDi: false, viaHe: 0 };
/** Khu xe điện theo dự thảo SĐ 01:2026 QCVN 04: mặc định tắt. */
export const XE_DIEN_MAC_DINH: KhuXeDien = {
  bat: false, tang: 1, choOto: 0, choXeMay: 0, vungOto: 25, vungXeMay: 50, dtXeMayMoiCho: 2.5, khoangCach: 2, tuongNgan: false, tuDoiPinTang: null,
};
/** Thông số hầm mặc định (giá trị tạm, chờ chủ nhiệm chốt). Chỗ đỗ 2,5 × 5 m ≥ tối thiểu 2,3 × 5 m của QCVN 13:2018 2.2.1.25. */
export const HAM_MAC_DINH: Required<Omit<ThongSoHam, 'dtXeMay'>> & Pick<ThongSoHam, 'dtXeMay'> = {
  soTang: 2, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6,
  lui: 3, caoTang: 3.3, dayKetCau: 0.6, cotRong: 0.6, choXeLan: 2, rongKho: 2, lanKho: 1.2, khoMoiTang: 0,
  tangXeMay: 1, dtXeMay: null, tyLeKyThuat: 0.1, garaCoKhi: false,
  ram: RAM_MAC_DINH, xeDien: XE_DIEN_MAC_DINH,
};

/**
 * Đơn giá, tỷ lệ, giá bán mặc định — TOÀN BỘ LÀ SỐ TẠM (VND), chờ chủ nhiệm / QS chốt. Không lấy từ văn bản nào.
 * Cơ cấu nhóm tham khảo tổng mức đầu tư theo Nghị định 10/2021/NĐ-CP (QS kiểm lại).
 */
export const CHI_PHI_MAC_DINH: ChiPhiPA = {
  donGia: {
    ngam: 11_000_000, thanThap: 6_500_000, thanDe: 7_000_000, thanApMai: 6_500_000,
    htCan: 3_000_000, htChung: 1_800_000, matNgoai: 3_500_000, haTang: 1_000_000,
    thangMay: 2_000_000_000, pccc: 400_000, me: 1_200_000,
  },
  dieuChinh: { xd: 0, tb: 0 },
  khac: { xd: 0, tb: 0 },
  tyLe: { qlda: 1.5, tuVan: 3.5, khac: 2, duPhongKL: 5, duPhongTruotGia: 3 },
  ban: {
    can: { stu: 45_000_000, '1pn': 45_000_000, '2pn': 42_000_000, '2pnp': 42_000_000, '3pn': 40_000_000 },
    tangMoiTang: 0.3, soTangThap: 3, tangThap: -3, tangTren: 5,
    oTo: 300_000_000, xeMay: 10_000_000, thuongMai: 60_000_000, tyLeBanDe: 60,
    phatLech: 0.1, chiPhiDat: 0, banHang: 2,
  },
};
/** Khoảng "% điều chỉnh giá" mỗi nhóm (học từ Architechtures). */
export const DIEU_CHINH_MIN = -75;
export const DIEU_CHINH_MAX = 200;

const soHuuHan = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** Lấy các trường số của `mau` từ `v`; thiếu / hỏng thì giữ mặc định. */
function tronSo<T extends Record<string, number>>(mau: T, v: unknown): T {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(mau).map(([k, m]) => [k, soHuuHan(o[k]) ? o[k] : m])) as T;
}
const kep = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Chi phí đủ trường từ dữ liệu bất kỳ (PA cũ, preset, file): thiếu / hỏng thì lấy mặc định; % điều chỉnh kẹp −75…+200. */
export function chuanHoaChiPhi(v: unknown): ChiPhiPA {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Record<keyof ChiPhiPA, unknown>>;
  const m = CHI_PHI_MAC_DINH;
  const dc = tronSo(m.dieuChinh, o.dieuChinh);
  const banVao = (o.ban && typeof o.ban === 'object' ? o.ban : {}) as Record<string, unknown>;
  const { can: canMac, ...banSo } = m.ban;
  return {
    donGia: tronSo(m.donGia, o.donGia),
    dieuChinh: { xd: kep(dc.xd, DIEU_CHINH_MIN, DIEU_CHINH_MAX), tb: kep(dc.tb, DIEU_CHINH_MIN, DIEU_CHINH_MAX) },
    khac: tronSo(m.khac, o.khac),
    tyLe: tronSo(m.tyLe, o.tyLe),
    ban: { ...tronSo(banSo, banVao), can: tronSo(canMac, banVao.can) as Record<LoaiCan, number> },
  };
}

/** Thông số hầm đủ trường: PA cũ thiếu trường mới thì lấy mặc định. */
export const chuanHoaHam = (h: ThongSoHam): typeof HAM_MAC_DINH => ({
  ...HAM_MAC_DINH,
  ...h,
  ram: { ...RAM_MAC_DINH, ...h.ram },
  xeDien: { ...XE_DIEN_MAC_DINH, ...h.xeDien },
});

export const taoLo = (id: string, kyHieu: string, chucNang: ChucNang, ranh: Diem[]): Lo => ({
  id,
  temDat: { kyHieu, chucNang, chiTieu: { ...CHI_TIEU_MAC_DINH }, coCauMucTieu: { ...CO_CAU_MAC_DINH } },
  ranh,
  chiGioi: null,
  xungQuanh: [],
});

/** Trạng thái một PA mới: chưa có lô, chưa có tòa. Hệ số và ngưỡng là giá trị tạm, chờ chủ nhiệm chốt. */
export const taoPAMoi = (): TrangThaiPA => ({
  phienBan: 1,
  lo: [],
  heSo: { ...HE_SO_MAC_DINH },
  nguong: { ...NGUONG_MAC_DINH },
  toa: [],
  ham: chuanHoaHam({ soTang: 2, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 }),
  phanHam: { ...PHAN_HAM_MAC_DINH },
  chiPhi: chuanHoaChiPhi(null),
});

/** Lô đang làm: lô đã chọn; chưa chọn thì lô đất ở đầu tiên, không có đất ở thì lô đầu. */
export const loDangChonHoacDatO = (ds: Lo[], id: string | null): Lo | null =>
  ds.find((l) => l.id === id) ?? ds.find((l) => l.temDat.chucNang !== 'khac') ?? ds[0] ?? null;

/** Bố cục theo tầng: bỏ khoá không phải số tầng nguyên dương (PA cũ không có trường này thì giữ nguyên). */
const chuanHoaToa = (t: ToaDat): ToaDat => {
  if (!t.tangRieng) return { ...t, canTheo: t.canTheo ?? {} };
  const tangRieng = Object.fromEntries(Object.entries(t.tangRieng).filter(([k, g]) => Number.isInteger(Number(k)) && Number(k) >= 1 && g && typeof g === 'object'));
  return { ...t, canTheo: t.canTheo ?? {}, tangRieng: Object.keys(tangRieng).length ? tangRieng : undefined };
};

/**
 * PA lưu từ bản cũ thiếu trường chỉ tiêu mới: điền giá trị mặc định (null = chưa quy định).
 * PA chưa có `phanHam` lưu từ khi hệ số hầm chưa dùng tới: chuyển sang tính hầm vào HSSDĐ theo QCVN 01 1.4.21.
 */
export const chuanHoaPA = (pa: TrangThaiPA): TrangThaiPA => ({
  ...pa,
  heSo: pa.phanHam ? pa.heSo : { ...pa.heSo, ham: HE_SO_MAC_DINH.ham, apMai: pa.heSo.apMai ?? HE_SO_MAC_DINH.apMai },
  phanHam: pa.phanHam ?? { ...PHAN_HAM_MAC_DINH },
  ham: chuanHoaHam(pa.ham ?? HAM_MAC_DINH),
  lo: pa.lo.map((l) => ({ ...l, temDat: { ...l.temDat, chiTieu: { ...CHI_TIEU_MAC_DINH, ...l.temDat.chiTieu } } })),
  toa: (pa.toa ?? []).map(chuanHoaToa),
  chiPhi: chuanHoaChiPhi(pa.chiPhi),
});
