/** Kiểu dữ liệu phương án (PA) và thư viện. Toạ độ hình học tính bằng mét, trục y hướng lên như CAD. */
export type Diem = [number, number];
export type LoaiCan = 'stu' | '1pn' | '2pn' | '2pnp' | '3pn';
export const LOAI_CAN: LoaiCan[] = ['stu', '1pn', '2pn', '2pnp', '3pn'];
export type ChucNang = 'tm' | 'xh' | 'khac';

export type ChiTieuQH = {
  matDoMax: number; // % — MĐXD khối đế (hoặc MĐXD chung khi bảng QH không tách đế/tháp)
  matDoThapMax: number | null; // % — MĐXD khối tháp; null = bảng QH không quy định
  hssddMax: number;
  tangCaoMax: number; // tổng tầng cao (không tính hầm)
  tangDe: number | null; // số tầng khối đế theo QH
  tangCanHo: number | null; // số tầng khối tháp (tầng căn hộ) theo QH
  tangHam: number | null;
  danSoMax: number; // người
  soCanMax: number | null; // số căn theo bảng QH; null = ước từ dân số
  nguoiMoiCan: number;
  choDoOtoMoiCan: number;
  choXeMayMoiCan: number;
  cayXanhMin: number; // % DT lô
};

/** Đề bài cơ cấu của kinh doanh: tỷ lệ % (ghi vào coCauMucTieu) và DT căn mong muốn theo loại. */
export type DeBaiKD = { dtCan: Partial<Record<LoaiCan, number>>; soCan: Partial<Record<LoaiCan, number>>; nguon: string };
/** Dòng bảng chỉ tiêu Excel đã áp cho lô (để lần sau đối chiếu lại). */
export type NguonChiTieu = { tep: string; sheet: string; dong: number; ten: string; dtBang: number | null; soLo: number };

export type TemDat = {
  kyHieu: string;
  chucNang: ChucNang;
  chiTieu: ChiTieuQH;
  coCauMucTieu: Record<LoaiCan, number>;
  deBai?: DeBaiKD;
  nguonChiTieu?: NguonChiTieu;
};
export type Lo = { id: string; temDat: TemDat; ranh: Diem[]; chiGioi: Diem[] | null; xungQuanh: Diem[][] };

/** Tỷ lệ (0–1) DT từng hạng mục được tính vào DT sàn chỉ tiêu. Giá trị mặc định chờ chủ nhiệm chốt. */
export type HeSoDTSan = { can: number; chung: number; thuongMai: number; ham: number };
export type NguongMau = { dtCanM2: number; kichThuocM: number; coCauDiem: number };

export type ToaDat = {
  id: string;
  loId: string;
  mauId: string;
  x: number; // tâm tòa trên lô (m)
  y: number;
  gocDo: number;
  soTangDH: number;
  soTangDe: number;
  caoDe: number;
  caoDH: number;
  coApMai: boolean;
  deOffset: number; // m; 0 = đế bằng đúng chân tháp
  canTheo: Record<string, string>; // id căn gốc -> id căn thay
  khoa?: boolean; // khoá: không kéo, không sửa thông số
};

export type ThongSoHam = {
  soTang: number;
  ranh: Diem[] | null;
  nhip: number;
  rongLan: number;
  choDai: number;
  choRong: number;
  dtKho: number;
};

export type TrangThaiPA = {
  phienBan: 1;
  lo: Lo[];
  heSo: HeSoDTSan;
  nguong: NguongMau;
  toa: ToaDat[];
  ham: ThongSoHam;
};

/** Một mẫu tòa trong web/public/lib/toa.json (toạ độ mm như CAD). */
export type ToaMau = {
  id: string;
  ma_goc: string;
  nhom: 'tm' | 'xh';
  hinh: string;
  so: number;
  ten_vi: string;
  ten_en: string;
  so_can_tang: number;
  dtxd_m2: number;
  hanh_lang_mm: number;
  sau_can_mm: number;
  duong_bao: Diem[];
  co_cau: Record<string, number>;
  loi: string[];
};

/** Một mẫu căn trong web/public/lib/can.json. */
export type CanMau = {
  id: string;
  ma_goc: string;
  nhom: 'tm' | 'xh';
  loai: LoaiCan;
  vi_tri: 'giua' | 'goc';
  vi_tri_ma: string;
  sau_mm: number;
  rong_mm: number;
  ten_vi: string;
  ten_en: string;
  dt_tt_m2: number;
  dt_tim_m2: number;
};

export type ThuVien = { toa: Map<string, ToaMau>; can: Map<string, CanMau> };

export const taoThuVien = (toa: ToaMau[], can: CanMau[]): ThuVien => ({
  toa: new Map(toa.map((t) => [t.id, t])),
  can: new Map(can.map((c) => [c.id, c])),
});

export const HE_SO_MAC_DINH: HeSoDTSan = { can: 1, chung: 1, thuongMai: 1, ham: 0 };
export const NGUONG_MAC_DINH: NguongMau = { dtCanM2: 2, kichThuocM: 0.2, coCauDiem: 5 };
