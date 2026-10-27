import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, PHAN_HAM_MAC_DINH, type ChiTieuQH, type ChucNang, type Diem, type KhuXeDien, type RamHam, type ThongSoHam, type LoaiCan, type Lo, type ToaDat, type TrangThaiPA } from './kieu';

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
});
