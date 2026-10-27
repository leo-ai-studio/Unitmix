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

/**
 * Tỷ lệ (0–1) DT từng hạng mục được tính vào DT sàn tính HSSDĐ (QCVN 01:2021/BXD 1.4.21: tổng DT sàn gồm cả tầng hầm,
 * trừ DT phục vụ kỹ thuật, PCCC, lánh nạn và đỗ xe). `ham` = phần hầm còn lại sau khi trừ đỗ xe / kỹ thuật (`PhanHam`).
 * `apMai` thiếu thì coi là 1.
 */
export type HeSoDTSan = { can: number; chung: number; thuongMai: number; ham: number; apMai?: number };
/** Tỷ lệ (0–1) sàn hầm dùng cho đỗ xe và kỹ thuật / PCCC — phần này không tính HSSDĐ. Giá trị tạm khi chưa đo từ màn Hầm. */
export type PhanHam = { doXe: number; kyThuat: number };
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
  canViTri?: Record<string, string>; // khoá vị trí trên tầng ("mặt:phần tử") -> id căn thay; thắng canTheo
  khoa?: boolean; // khoá: không kéo, không sửa thông số
  /** Có ít nhất 1 thang máy chở được băng ca (QCVN 04 chú thích 2.4.1); chưa khai = undefined. */
  thangBangCa?: boolean;
  /** Không gian nhân viên quản lý, trông xe, bảo vệ, kỹ thuật của tòa (QCVN 04 2.2.18); chưa khai = undefined. */
  nhanVien?: { so: number; dtM2: number };
};

/** Thông số cấu tạo dùng tính thông thủy: thông thủy = cao tầng − dày sàn + trần. Giá trị tạm, chờ chủ nhiệm chốt. */
export type CauTao = { daySanTranM: number };
export const CAU_TAO_MAC_DINH: CauTao = { daySanTranM: 0.3 };

export type ThongSoHam = {
  soTang: number;
  ranh: Diem[] | null;
  nhip: number;
  rongLan: number;
  choDai: number;
  choRong: number;
  dtKho: number;
  /* Các trường dưới đây thêm cho màn Hầm; PA cũ thiếu thì `hamDayDu` (tinh/ham.ts) điền mặc định. */
  /** Lùi ranh hầm vào trong so với chỉ giới (nếu có) hoặc ranh lô, m. */
  lui?: number;
  /** Chiều cao tầng hầm (sàn tới sàn), m. */
  caoTang?: number;
  /** Chiều dày kết cấu sàn + dầm (để tính thông thủy), m. */
  dayKetCau?: number;
  /** Cạnh cột kế thừa từ chân tòa, m. */
  cotRong?: number;
  /** Số chỗ ô tô cho người khuyết tật (xe lăn, rộng 3,5 m) mỗi tầng hầm. */
  choXeLan?: number;
  /** Bề rộng ô kho, m; hành lang kho, m; số kho mỗi tầng. */
  rongKho?: number;
  lanKho?: number;
  khoMoiTang?: number;
  /** Tầng hầm (1 = B1) đặt khu xe máy, xe đạp; DT dành cho xe máy (m²), null = lấy đúng DT yêu cầu. */
  tangXeMay?: number;
  dtXeMay?: number | null;
  /** Tỷ lệ (0–1) sàn mỗi tầng hầm dành cho phòng kỹ thuật. */
  tyLeKyThuat?: number;
  /** Dùng gara cơ khí (QCVN 04:2021 2.2.17.1 d). */
  garaCoKhi?: boolean;
  ram?: RamHam;
  xeDien?: KhuXeDien;
};

/** Loại ram theo QCVN 13:2018 2.2.1.28 a): thẳng có mái che, cong, hở (không mái che). */
export type LoaiRam = 'thang_mai' | 'cong' | 'ho';
/** Ram vào hầm: tâm (x, y) và hướng (độ, theo trục dài ram); null = tự đặt dọc cạnh dài nhất của ranh hầm. */
export type RamHam = {
  x: number | null;
  y: number | null;
  gocDo: number | null;
  dai: number; // chiều dài phần dốc theo phương ngang, m
  rong: number;
  loai: LoaiRam;
  docNgang: number; // %
  coNguoiDi: boolean;
  viaHe: number; // m
};
/** Khu xe điện / sạc / đổi pin theo DỰ THẢO Sửa đổi 01:2026 QCVN 04:2021/BXD (chưa có số, chưa hiệu lực): chỉ cảnh báo. */
export type KhuXeDien = {
  bat: boolean;
  tang: number; // tầng hầm đặt khu sạc (1 = B1)
  choOto: number; // số chỗ sạc ô tô
  choXeMay: number; // số chỗ sạc xe máy, xe đạp điện
  vungOto: number; // số chỗ sạc ô tô mỗi phân vùng
  vungXeMay: number;
  dtXeMayMoiCho: number; // m²/chỗ xe máy gồm lối đi (để ước DT khu sạc xe máy)
  khoangCach: number; // m, giữa các khu / phân vùng
  tuongNgan: boolean; // có tường / vách ngăn không cháy cao ≥ 2 m
  tuDoiPinTang: number | null; // tầng hầm đặt tủ đổi pin; null = không có
};

/** Góc nhìn 3D đã lưu (m, toạ độ three: X = x, Y = cao, Z = −y). `che` = cảnh toàn dự án hay một công trình. */
export type GocNhin = { id: string; ten: string; che: 'du_an' | 'toa'; toaId?: string; vt: [number, number, number]; dich: [number, number, number]; gio?: number };

export type TrangThaiPA = {
  phienBan: 1;
  lo: Lo[];
  heSo: HeSoDTSan;
  nguong: NguongMau;
  toa: ToaDat[];
  ham: ThongSoHam;
  /** Thiếu = PA lưu trước khi tính hầm vào HSSDĐ; `chuanHoaPA` điền mặc định. */
  phanHam?: PhanHam;
  gocNhin?: GocNhin[];
  cauTao?: CauTao;
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
  /** Hốc logia lùi vào [x0, x1, y] chuẩn hoá theo rộng × sâu: phần x0..x1 từ độ sâu y tới mặt ngoài không thuộc căn. */
  logia_lui?: number[][] | null;
  /** Danh sách phòng của căn (tuỳ chọn). */
  phong?: PhongCan[];
  /** Căn có cửa sổ tường ngoài lỗ thông thủy ≥ 600×600 mm làm cửa cứu nạn (tuỳ chọn). */
  cua_cuu_nan?: boolean;
};

/** Một phòng trong mẫu căn (bóc từ CAD; tuỳ chọn, chưa có thì các luật cần phòng ra "chưa đủ dữ liệu"). */
export type PhongCan = {
  ten: string;
  loai: 'ngu' | 'khach' | 'bep' | 'wc' | 'khac';
  dt_m2: number;
  /** Phòng có cạnh giáp tường ngoài (thông thoáng, chiếu sáng tự nhiên); thiếu = chưa biết. */
  ke_mat_ngoai?: boolean;
};

export type ThuVien = { toa: Map<string, ToaMau>; can: Map<string, CanMau> };

export const taoThuVien = (toa: ToaMau[], can: CanMau[]): ThuVien => ({
  toa: new Map(toa.map((t) => [t.id, t])),
  can: new Map(can.map((c) => [c.id, c])),
});

export const HE_SO_MAC_DINH: HeSoDTSan = { can: 1, chung: 1, thuongMai: 1, ham: 1, apMai: 1 };
export const PHAN_HAM_MAC_DINH: PhanHam = { doXe: 0.75, kyThuat: 0.1 };
export const NGUONG_MAC_DINH: NguongMau = { dtCanM2: 2, kichThuocM: 0.2, coCauDiem: 5 };
