import { chuanHoaMatBang, ganLoaiThang, goTuDong, laLoaiThang, loaiTheoChung, THANG_MAX, THANG_MIN } from './loiThang';
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
/**
 * Đơn giá (đ/m² sàn) lấy từ định mức suất đầu tư của app cũ: `MDI_Unitmix_v4/data/master/dinh_muc_du_toan.json`,
 * bóc từ hồ sơ "240508_SĐT NOXH cao tầng" (Q2/2024, Hà Nội, trước VAT). Lấy bình quân mẫu I15 / Z15 (nhóm > 8 tầng),
 * quy về mặt bằng 2026 bằng trượt giá từng nhóm A–E của hồ sơ (8,8–9,6 %), cộng gói thầu theo nhóm dòng:
 *   cọc = cọc + TN cọc · kết cấu = TT kết cấu + cung ứng thép + KCT / inox · hoàn thiện = TT hoàn thiện + thạch cao, sơn bả
 *   + đá + sàn gỗ + gạch + TBVS + VSCN + chống mối + biển bảng · cửa = cửa thép / chống cháy + nhôm kính + cửa gỗ + khoá ·
 *   thang máy · PCCC = TB báo cháy + chữa cháy · ME = thi công M&E, điện nhẹ, trung thế và các gói cung ứng còn lại.
 * Tổng 9,12 tr/m² sàn nổi. Lưu ý từ hồ sơ: SĐT ĐÃ GỒM dự phòng khối lượng 10 % → dự phòng KL mặc định 0.
 * Hầm 6,31 tr/m² sàn hầm: số đối chứng duy nhất có hầm (sheet "SĐT Saphire", hầm 2 tầng), chưa quy đổi trượt giá.
 * Hạ tầng ngoài nhà: hồ sơ không có — vẫn là số tạm. Tất cả chờ QS chốt.
 */
export const CHI_PHI_MAC_DINH: ChiPhiPA = {
  donGia: {
    ngam: 6_310_000, coc: 354_559, ketCau: 2_438_253, hoanThien: 2_802_057, cua: 760_900,
    haTang: 1_000_000, thangMay: 215_501, pccc: 132_253, me: 2_421_212,
  },
  dieuChinh: { xd: 0, tb: 0 },
  khac: { xd: 0, tb: 0 },
  tyLe: { qlda: 1.5, tuVan: 3.5, khac: 2, duPhongKL: 0, duPhongTruotGia: 3 },
  qldaTT38: true,
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
    // Đơn giá kiểu cũ (dòng tháp / đế / mặt ngoài, trước khi lấy định mức app cũ) không đổi được sang gói thầu → dùng mặc định.
    donGia: tronSo(m.donGia, o.donGia && typeof o.donGia === 'object' && 'ketCau' in o.donGia ? o.donGia : null),
    dieuChinh: { xd: kep(dc.xd, DIEU_CHINH_MIN, DIEU_CHINH_MAX), tb: kep(dc.tb, DIEU_CHINH_MIN, DIEU_CHINH_MAX) },
    khac: tronSo(m.khac, o.khac),
    tyLe: tronSo(m.tyLe, o.tyLe),
    qldaTT38: typeof o.qldaTT38 === 'boolean' ? o.qldaTT38 : m.qldaTT38,
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

/**
 * Quy tắc thang bộ MỌI tòa / MỌI phương án khi mở PA cũ (chủ nhiệm 2026-10-29): 2–3 thang, luôn có ít nhất một N2 + một N3.
 * `loaiThang` sai giá trị thì bỏ. Mặt bằng tự chỉnh đã lưu (chung / tầng riêng) có số thang ngoài 2…3 (PA cũ cho đặt tay > 3) thì
 * bỏ mặt bằng đã lưu + nét bao riêng + thay đổi tự ghi — tòa về theo mẫu (2–3 thang) và tự chỉnh lại ở lần sửa sau, thang tay > 3
 * bị cắt (catThangThua). Số thang đúng thì chỉ gán lại loại (ganLoaiThang — đổi `block`, không căn nào xê dịch).
 */
export function chuanHoaThang(t: ToaDat): ToaDat {
  const lt0 = t.loaiThang && typeof t.loaiThang === 'object' ? Object.entries(t.loaiThang).filter(([, v]) => laLoaiThang(v)) : [];
  const loaiThang = lt0.length ? Object.fromEntries(lt0) : undefined;
  const sai = (m: unknown) => {
    const ds = (m as { thangBo?: unknown[] } | undefined)?.thangBo;
    return Array.isArray(ds) && (ds.length < THANG_MIN || ds.length > THANG_MAX);
  };
  const t1: ToaDat = { ...t, loaiThang };
  if (sai(t.matBang) || Object.values(t.tangRieng ?? {}).some((g) => sai(g?.matBang))) {
    const g = goTuDong(t1);
    const tangRieng = g.tangRieng && Object.fromEntries(Object.entries(g.tangRieng).map(([k, x]) => { const { matBang: _b, ...con } = x ?? {}; void _b; return [k, con]; }));
    return { ...g, matBang: undefined, duongBao: undefined, dtxdM2: undefined, ...(tangRieng ? { tangRieng } : {}) };
  }
  const mb = t1.matBang as ToaDat['matBang'] | undefined;
  return mb && Array.isArray(mb.thangBo) ? { ...t1, matBang: { ...mb, thangBo: ganLoaiThang(mb.thangBo, loaiThang) } } : t1;
}

/** Bố cục theo tầng: bỏ khoá không phải số tầng nguyên dương (PA cũ không có trường này thì giữ nguyên). */
const chuanHoaToa = (t0: ToaDat): ToaDat => {
  const t = chuanHoaThang(t0);
  // mặt bằng tự chỉnh + nét bao riêng (tinh/loiThang.ts): sai cấu trúc thì bỏ, về theo mẫu tòa
  const diem = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === 'number' && Number.isFinite(x));
  const duongBao = Array.isArray(t.duongBao) && t.duongBao.length >= 3 && t.duongBao.every(diem) ? t.duongBao : undefined;
  const mb = { matBang: chuanHoaMatBang(t.matBang), duongBao, dtxdM2: duongBao && typeof t.dtxdM2 === 'number' && Number.isFinite(t.dtxdM2) ? t.dtxdM2 : undefined };
  if (!t.tangRieng) return { ...t, ...mb, canTheo: t.canTheo ?? {} };
  const tangRieng = Object.fromEntries(Object.entries(t.tangRieng).filter(([k, g]) => Number.isInteger(Number(k)) && Number(k) >= 1 && g && typeof g === 'object')
    .map(([k, g]) => {
      const { matBang, ...con } = g;
      const m = chuanHoaMatBang(matBang);
      // thang liền: loại thang tầng riêng theo thang cùng chỗ ở tầng chung
      return [k, m ? { ...con, matBang: mb.matBang ? { ...m, thangBo: loaiTheoChung(m.thangBo, mb.matBang.thangBo) } : m } : con];
    }));
  return { ...t, ...mb, canTheo: t.canTheo ?? {}, tangRieng: Object.keys(tangRieng).length ? tangRieng : undefined };
};

/**
 * Lộ giới từng cạnh lô (`Lo.canhDuong`, LO-01): sai cấu trúc hoặc số cạnh không khớp ranh thì bỏ (về hành vi cũ: mọi cạnh giáp
 * đường 12 m); phần tử không phải số dương / null thì coi là null (không giáp đường).
 */
export const chuanHoaCanhDuong = (l: Lo): Lo => {
  const c = l.canhDuong;
  if (c === undefined) return l;
  const { canhDuong: _bo, ...con } = l;
  if (!Array.isArray(c) || c.length !== l.ranh.length) return con;
  return { ...con, canhDuong: c.map((v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)) };
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
  lo: pa.lo.map((l) => chuanHoaCanhDuong({ ...l, temDat: { ...l.temDat, chiTieu: { ...CHI_TIEU_MAC_DINH, ...l.temDat.chiTieu } } })),
  toa: (pa.toa ?? []).map(chuanHoaToa),
  chiPhi: chuanHoaChiPhi(pa.chiPhi),
});
