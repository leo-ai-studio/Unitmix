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

/** Loại hình nhà ở để tra bảng dân số: thương mại / xã hội / tái định cư. */
export type LoaiHinh = 'notm' | 'noxh' | 'tdc';
/** Giai đoạn hồ sơ: `qh` lập quy hoạch chi tiết / TMB (chủ trương đầu tư); `cp` thẩm định BCNCKT và cấp GPXD. */
export type GiaiDoan = 'qh' | 'cp';
/**
 * Khai báo cách tính dân số theo QĐ tỉnh (`tinh/quyTacDanSo.ts`). Thiếu = PA cũ / chưa khai: dân số = số căn × `nguoiMoiCan`
 * (hệ số chung). `tinh` theo địa giới CŨ trước 1/7/2025. `loaiHinh` thiếu = lấy theo chức năng lô / nhóm mẫu căn.
 * `cach` 'bq' = bình quân người / căn mà QĐ cho phép thay bảng.
 */
export type KhaiDanSo = { tinh: string; giaiDoan: GiaiDoan; loaiHinh?: LoaiHinh; cach?: 'bang' | 'bq' };

export type TemDat = {
  kyHieu: string;
  chucNang: ChucNang;
  chiTieu: ChiTieuQH;
  coCauMucTieu: Record<LoaiCan, number>;
  deBai?: DeBaiKD;
  nguonChiTieu?: NguonChiTieu;
  /** Tuỳ chọn: tính dân số theo QĐ tỉnh, từng căn. */
  danSo?: KhaiDanSo;
};
/**
 * Lô đất. `canhDuong` (tuỳ chọn, theo thứ tự cạnh của `ranh`: cạnh i = ranh[i] → ranh[i+1]): số = cạnh giáp đường, bề rộng lộ giới
 * (m) để tra khoảng lùi LO-01 · QCVN 01:2021 Bảng 2.7; null = không giáp đường (lô bên cạnh, cây xanh…) — lùi 0 như app cũ (`lo.canh`,
 * `lui_ben` mặc định 0). Chưa khai (hoặc số cạnh không khớp ranh) thì mọi cạnh coi là giáp đường 12 m (hành vi cũ, `tm_rong`).
 */
export type Lo = { id: string; temDat: TemDat; ranh: Diem[]; chiGioi: Diem[] | null; xungQuanh: Diem[][]; canhDuong?: (number | null)[] };

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
  /** Lật chân tòa trên TMB (đối xứng qua trục dọc cục bộ, QT-85 app cũ); mặt bằng căn của mẫu không đổi. */
  lat?: boolean;
  /** Có ít nhất 1 thang máy chở được băng ca (QCVN 04 chú thích 2.4.1); chưa khai = undefined. */
  thangBangCa?: boolean;
  /** Không gian nhân viên quản lý, trông xe, bảo vệ, kỹ thuật của tòa (QCVN 04 2.2.18); chưa khai = undefined. */
  nhanVien?: { so: number; dtM2: number };
  congNang?: Record<string, CongNangO>; // khoá vị trí -> công năng ô của bố cục chung (thiếu = căn hộ)
  /** Bố cục riêng theo tầng: số thứ tự tầng điển hình (1..soTangDH) -> ghi đè lên bố cục chung. Thiếu = mọi tầng như nhau. */
  tangRieng?: Record<number, BoCucTang>;
  /** Lõi thang: khoá "mặt:phần tử" của lõi -> cửa vào, đi xuống hầm / lên mái. Chỉ lưu, màn hầm đọc sau. */
  loi?: Record<string, ThongTinLoi>;
  /**
   * Mặt bằng tầng đã tự chỉnh (XC-03 · XC-05 · XC-06 · XC-07 · PC-11, tinh/loiThang.ts): ô thang bộ, độ dời căn, nét bao,
   * hành lang. Thiếu = theo mẫu tòa (đã chuẩn hoá ô thang 3.000 mm). Ghi lại sau mỗi lần đổi căn / STRETCH / tối ưu.
   */
  matBang?: MatBangSua;
  /** false = tắt tự chỉnh mặt bằng tầng; thiếu = bật (như app cũ). */
  tuChinhMB?: boolean;
  /**
   * false = KHÔNG tự gỡ căn vượt cự ly thoát nạn (giữ nguyên căn, chỉ báo "vượt"); thiếu = bật như app cũ: xếp lại dãy căn
   * (giữ cơ cấu) rồi giamCanThoatNan (bỏ căn giữa gần mép / đổi ô thành phòng kỹ thuật).
   */
  giamCanTN?: boolean;
  /** Thang bộ liền suốt chiều cao khi có tầng riêng: 'hop' (mặc định) = hợp thang mọi tầng; 'chung' = ép theo tầng chung. */
  thangLien?: 'hop' | 'chung';
  /** Thay đổi do tự chỉnh tự ghi (đổi căn / công năng ô) — gỡ ra trước mỗi lần tự chỉnh lại, tắt thì trả về như cũ. */
  tuDong?: ThayDoiTuDong[];
  /**
   * Nét bao sàn tầng điển hình RIÊNG của tòa (mm, hệ toạ độ mẫu tòa) khi dãy dài ra / ngắn lại (QT-69 STRETCH đầu cánh,
   * PC-11 thêm / bớt thang): chanToa, chỉ tiêu, dự toán đọc nét này thay nét bao mẫu. Thiếu = nét bao mẫu.
   */
  duongBao?: Diem[];
  /** DTXD (m²) theo `duongBao`; thiếu = `dtxd_m2` của mẫu. */
  dtxdM2?: number;
  /**
   * Thang bộ người dùng đặt tay (công cụ màn Tầng · p17d · QT-10 app cũ): thêm ô 3.000 mm ngay sau ô đang chọn, bỏ / dời thang.
   * Có thì tự chỉnh coi tập thang là lựa chọn tay — PC-11 không dời / bỏ / thêm thang. Áp cho MỌI tầng (thang liền suốt chiều cao).
   */
  thangTay?: ThangTay;
  /** Lật gương căn theo vị trí ở bố cục chung (khoá ô -> true = lật so với mẫu); tầng riêng ghi đè ở `BoCucTang.latO`. */
  latO?: Record<string, boolean>;
  /** Căn thêm tay (công cụ "Thêm căn" · QT-69): chèn ngay sau ô `sau` trên mặt `mat`, dãy dài ra ở đầu tự do. Mọi tầng. */
  canThem?: CanThem[];
};
/**
 * Thang bộ thêm tay: chèn ô 3.000 mm ngay sau vật thể `sau` (khoá căn / thang) — hoặc ngay trước vật thể `truoc` (thang đầu dãy) —
 * trên mặt `mat`; `tu` = dời thang có sẵn (giữ khoá) tới đó.
 */
export type ThangTayThem = { khoa: string; mat: number; sau?: string; truoc?: string; sx: 1 | -1; tu?: string };
export type ThangTay = { them: ThangTayThem[]; bo: string[] };
/**
 * Căn thêm tay: mẫu căn `id` chèn ngay sau ô `sau` (khoá vị trí) — hoặc ngay TRƯỚC ô `truoc` (chèn đầu dãy, app cũ tAdd ở ô đầu)
 * — trên mặt `mat`. Có `sau` thì bỏ qua `truoc`.
 */
export type CanThem = { mat: number; sau?: string; truoc?: string; id: string };

/** Ô thang bộ trên một mặt tòa (mm, hệ mặt): ô [a0, a0 + rong], điểm chèn khối thang = (a0 + dIns, bIns), lật theo `sx`. */
export type ThangBoMB = { khoa: string; matIdx: number; a0: number; rong: number; sx: 1 | -1; dIns: number; bIns: number; block: string; nguon: 'mau' | 'them' };
/** Đoạn hành lang (tim, mm thế giới); `noi` = đoạn nối giữa các trục / qua sảnh. */
export type DoanHanhLangMB = { ten: string; noi: boolean; p0: Diem; p1: Diem };
/** Sảnh thang máy đo trên lõi (XC-06): bề rộng (mm, null = không đo thẳng được), loại hình theo ngưỡng 2.800 mm. */
export type SanhMB = { khoaLoi: string; block: string; rong: number | null; loai: 'tm' | 'xh' };
export type MucTuChinh = 'ok' | 'da_sua' | 'canh_bao' | 'vuot';
/** Kết quả một quy tắc tự chỉnh: mức, số chỗ đã sửa, ghi chú ngắn (tiếng Việt, để báo cáo / tooltip). */
export type KetQuaTuChinh = { ma: 'XC-03' | 'XC-05' | 'XC-06' | 'XC-07' | 'PC-11' | 'QT-69'; muc: MucTuChinh; sua: number; ghiChu: string };
export type BaoCaoTuChinh = {
  quyTac: KetQuaTuChinh[];
  soThangTruoc: number;
  soThangSau: number;
  /** Số căn vượt cự ly thoát nạn trước / sau tự chỉnh (tinh/pccc.ts); null = không kiểm được. */
  vuotTruoc: number | null;
  vuotSau: number | null;
  soCan: number;
  dtxdM2: number;
  dtHanhLangM2: number;
  /** Gỡ căn vượt cự ly sau PC-11 (app cũ tự sinh + giamCanThoatNan); thiếu = không cần (không có căn vượt). */
  giamCan?: BaoCaoGiamCan;
  /** Thang bộ liền suốt chiều cao (tòa có tầng riêng): kết quả hợp / ép thang. */
  thangLien?: BaoCaoThangLien;
  /** Khít đoạn kẹp (dãy căn giữa hai mốc mà tổng bề ngang đổi): căn đã đổi / bỏ cho hết đè, khe; thiếu = không cần. */
  khitKep?: BaoCaoKhitKep;
  /** QT-69 · dãy dài ra (mm > 0) / ngắn lại ở đầu hở ra sân trong, nét bao + DTXD theo; thiếu = không có. */
  daiSan?: { so: number; mm: number };
};
/** Căn đổi / bỏ để dãy căn kẹp giữa hai mốc (lõi, ô thang) khít lại; `conMm` = đè + khe còn lại (mm) sau khi khít. */
export type BaoCaoKhitKep = {
  doi: { khoa: string; tu: string; den: string }[];
  bo: { khoa: string; id: string }[];
  conMm: number;
};
/** Một thay đổi tự chỉnh tự ghi vào bố cục: `tang` null = bố cục chung; `cu` = giá trị trước (thiếu = không có ghi đè). */
export type ThayDoiTuDong = { tang: number | null; truong: 'canViTri' | 'congNang'; khoa: string; cu?: string; moi: string };
export type BaoCaoGiamCan = {
  bat: boolean;
  /** Số vị trí xếp lại giữ cơ cấu (co STRETCH, đổi mẫu cùng loại hẹp hơn, đổi chỗ hai căn). */
  xepLai: number;
  /** Số ô căn đổi thành phòng kỹ thuật / số căn bỏ (co cánh). */
  doi: number;
  bo: number;
  vuotTruoc: number;
  vuotSau: number;
  soCanTruoc: number;
  soCanSau: number;
  coCauTruoc: Record<LoaiCan, number>;
  coCauSau: Record<LoaiCan, number>;
};
export type BaoCaoThangLien = {
  cheDo: 'hop' | 'chung';
  /** Số thang bộ chung cả tòa sau khi hợp / ép. */
  soThang: number;
  /** Số tầng riêng phải đặt lại thang cho liền. */
  soTang: number;
  /** Thang không đặt được ở tầng này (không có chỗ cắt / không có đầu tự do). */
  khongDat: number;
  /** Căn vượt cự ly ở tầng này sau khi ép thang (trước gỡ căn). */
  vuot: number;
  /** Số căn co / giãn STRETCH nhường chỗ cho ô thang ở tầng này; phần lệch (mm) chưa khít được. */
  nhuong: number;
  conLech: number;
};
export type MatBangSua = {
  phienBan: 1;
  thangBo: ThangBoMB[];
  /** Độ dời dọc mặt (mm) của căn theo khoá vị trí do thêm / bớt / dời thang. */
  dich?: Record<string, number>;
  /** Mép đầu / cuối mặt sau khi dài ra, ngắn đi (mm, hệ mặt) theo chỉ số mặt. */
  mep?: Record<number, [number, number]>;
  /** Nét bao sàn sau khi mặt dài ra / ngắn đi; thiếu = nét bao mẫu. */
  duongBao?: Diem[];
  hanhLang: DoanHanhLangMB[];
  /** Nét hành lang vẽ thêm (để tính DT hành lang) khi trục kéo dài tới cửa căn xa nhất. */
  hanhLangThem?: Diem[][];
  /** Căn bỏ (giamCanThoatNan, công năng 'bo'): ô không dựng, căn phía đầu tự do dồn vào, mặt co lại. */
  boCan?: string[];
  sanh?: SanhMB[];
  baoCao?: BaoCaoTuChinh;
};

/** Công năng một ô căn trên tầng. Ô khác 'can' không tính là căn (số căn, cơ cấu, dân số); DT cộng vào hạng mục tương ứng. */
/** 'bo' = căn bị bỏ khi gỡ thoát nạn (giamCanThoatNan app cũ): không dựng ô, dãy co lại — chỉ tự chỉnh đặt, không có trong menu. */
export type CongNangO = 'can' | 'shcd' | 'ky_thuat' | 'thuong_mai' | 'trong' | 'bo';
export const CONG_NANG_O: CongNangO[] = ['can', 'shcd', 'ky_thuat', 'thuong_mai', 'trong'];
/** Ghi đè một tầng: chỉ các vị trí khác bố cục chung; `coCauMucTieu` = mục tiêu cơ cấu riêng của tầng (vd. tầng áp mái). */
export type BoCucTang = {
  canViTri?: Record<string, string>;
  congNang?: Record<string, CongNangO>;
  coCauMucTieu?: Record<LoaiCan, number>;
  /** Lật gương riêng của tầng (ghi đè `ToaDat.latO`; false = bỏ lật). */
  latO?: Record<string, boolean>;
  /** Mặt bằng tự chỉnh RIÊNG của tầng (thang, căn dồn, nét bao, hành lang theo căn của tầng); thiếu = như bố cục chung. */
  matBang?: MatBangSua;
};
/** Thang trong lõi có đi xuống hầm / lên mái không. */
export type DiXuyen = { ham: boolean; mai: boolean };
export type ThongTinLoi = { cua: 'trai' | 'phai'; thangBo: DiXuyen; thangMay: DiXuyen; hopKT: DiXuyen };

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
  /** Đơn giá dự toán và giá bán (số tạm, chờ chủ nhiệm / QS chốt). Thiếu = PA cũ; `chuanHoaPA` điền mặc định. */
  chiPhi?: ChiPhiPA;
};

/* ---------- Chi phí (dự toán sơ bộ + hiệu quả tài chính). Mọi số mặc định là SỐ TẠM, chờ chủ nhiệm / QS chốt. ---------- */

/** Dòng dự toán tính khối lượng tự động từ mô hình. */
/** Dòng dự toán theo nhóm gói thầu của định mức suất đầu tư app cũ (MDI_Unitmix_v4 `dinh_muc_du_toan.json`). */
export type KhoaDongDuToan = 'ngam' | 'coc' | 'ketCau' | 'hoanThien' | 'cua' | 'haTang' | 'thangMay' | 'pccc' | 'me';
/** Nhóm chi phí: xây dựng, thiết bị. */
export type NhomChiPhi = 'xd' | 'tb';
/** Các lớp tỷ lệ (%) tính trên chi phí xây dựng + thiết bị (QLDA, tư vấn, khác) và dự phòng (trên tổng trước dự phòng). */
export type TyLeChiPhi = { qlda: number; tuVan: number; khac: number; duPhongKL: number; duPhongTruotGia: number };
/** Giá bán và chi phí bán hàng. Giá căn: đ/m² thông thủy; % theo tầng; chỗ đỗ: đ/chỗ; thương mại đế: đ/m² sàn khả bán. */
export type GiaBan = {
  can: Record<LoaiCan, number>;
  tangMoiTang: number; // % tăng mỗi tầng điển hình lên trên
  soTangThap: number; // số tầng điển hình tính là "tầng thấp"
  tangThap: number; // % riêng tầng thấp (thường âm)
  tangTren: number; // % riêng tầng trên cùng / áp mái
  oTo: number;
  xeMay: number;
  thuongMai: number;
  tyLeBanDe: number; // % sàn đế bán / cho thuê được
  phatLech: number; // % doanh thu trừ trên mỗi điểm lệch cơ cấu
  chiPhiDat: number; // đ, nhập tay
  banHang: number; // % doanh thu
};
export type ChiPhiPA = {
  donGia: Record<KhoaDongDuToan, number>; // đ / đơn vị
  dieuChinh: Record<NhomChiPhi, number>; // % điều chỉnh giá (trượt giá) theo nhóm, −75…+200
  khac: Record<NhomChiPhi, number>; // đ, dòng "Khác" nhập tay
  tyLe: TyLeChiPhi;
  /** true = tỷ lệ QLDA tự tra Bảng 1.1 TT 38/2026/TT-BXD theo quy mô (bỏ qua `tyLe.qlda`). */
  qldaTT38: boolean;
  ban: GiaBan;
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
  /** Phòng bóc từ CAD (scripts/boc_cad/boc_phong.py); thiếu khi bản vẽ không bóc được. */
  phong?: Phong[];
  /** Căn có cửa sổ tường ngoài lỗ thông thủy ≥ 600×600 mm làm cửa cứu nạn (tuỳ chọn). */
  cua_cuu_nan?: boolean;
  /** Đường cắt STRETCH qua phòng khách (DC-04 · QT-81, scripts/boc_stretch.py app cũ): x cắt (mm), chiều sâu cắt qua
   * thông thủy / tim tường, nét thuộc block [chỉ số nét, 1 dời / 0 đứng]. Thiếu = không kéo được. */
  stretch?: { x_mm: number; sau_tt_mm: number; sau_tim_mm: number; cung: [number, number][] };
  /** Có ở mẫu biến thể STRETCH (tinh/stretch.ts): id mẫu gốc + mức kéo (mm). */
  stretchGoc?: { id: string; st: number };
};

export type LoaiPhong = 'ngu' | 'khach' | 'bep' | 'wc' | 'khac';
/** Một phòng của mẫu căn. `ranh` tính bằng mm trong hệ của mẫu căn: x = u × rong_mm, y = v × sau_mm (y = 0 phía hành lang). */
export type Phong = {
  ten: string;
  loai: LoaiPhong;
  ranh: Diem[];
  dt_m2: number;
  /** Đường kính đường tròn nội tiếp lớn nhất (m). */
  d_min_m: number;
  /** Phòng giáp mặt ngoài (thông thoáng, chiếu sáng tự nhiên — QCVN 04:2021/BXD 2.2.4.4). */
  ke_mat_ngoai: boolean;
  /** true = loại phòng suy theo quy tắc (CAD không có nhãn tên phòng). */
  doan?: boolean;
};

/** Tên cũ dùng ở luật QCVN 04 (tinh/qcvn04.ts). */
export type PhongCan = Phong;

export type ThuVien = { toa: Map<string, ToaMau>; can: Map<string, CanMau> };

export const taoThuVien = (toa: ToaMau[], can: CanMau[]): ThuVien => ({
  toa: new Map(toa.map((t) => [t.id, t])),
  can: new Map(can.map((c) => [c.id, c])),
});

export const HE_SO_MAC_DINH: HeSoDTSan = { can: 1, chung: 1, thuongMai: 1, ham: 1, apMai: 1 };
export const PHAN_HAM_MAC_DINH: PhanHam = { doXe: 0.75, kyThuat: 0.1 };
export const NGUONG_MAC_DINH: NguongMau = { dtCanM2: 2, kichThuocM: 0.2, coCauDiem: 5 };
