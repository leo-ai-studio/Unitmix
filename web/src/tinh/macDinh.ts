import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, type ChiTieuQH, type ChucNang, type Diem, type LoaiCan, type Lo, type TrangThaiPA } from './kieu';

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
  ham: { soTang: 2, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 },
});

/** Lô đang làm: lô đã chọn; chưa chọn thì lô đất ở đầu tiên, không có đất ở thì lô đầu. */
export const loDangChonHoacDatO = (ds: Lo[], id: string | null): Lo | null =>
  ds.find((l) => l.id === id) ?? ds.find((l) => l.temDat.chucNang !== 'khac') ?? ds[0] ?? null;

/** PA lưu từ bản cũ thiếu trường chỉ tiêu mới: điền giá trị mặc định (null = chưa quy định). */
export const chuanHoaPA = (pa: TrangThaiPA): TrangThaiPA => ({
  ...pa,
  lo: pa.lo.map((l) => ({ ...l, temDat: { ...l.temDat, chiTieu: { ...CHI_TIEU_MAC_DINH, ...l.temDat.chiTieu } } })),
});
