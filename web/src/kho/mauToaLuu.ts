/**
 * Mẫu tòa ĐÃ LƯU của người dùng: chụp bố cục một tòa (đổi / thêm / bớt / lật / STRETCH căn, thang, kéo hành lang, lõi thay, mặt bằng
 * tự chỉnh từng tầng) thành một mẫu đặt lại được trên lô khác — mẫu thư viện gốc (`mauId`) không đổi. Lưu ở localStorage của trình
 * duyệt (khoá `unitmix.mauToaLuu.v1`, như preset), xuất / nhập tệp JSON để chuyển máy. Hàm thuần, kho lưu truyền vào được để test.
 */
import type { Lo, ThuVien, ToaDat, ToaMau } from '../tinh/kieu';
import { taoToaTrenLo } from '../tinh/hopLo';

export const KHOA_MAU_TOA_LUU = 'unitmix.mauToaLuu.v1';
export const DINH_DANG_MAU_TOA = 'unitmix-mau-toa';
export const TEN_TOI_DA = 60;
export const SO_MAU_TOI_DA = 100;

/** Trường của tòa KHÔNG thuộc bố cục: vị trí trên lô, số tầng / chiều cao, định danh. */
const TRUONG_RIENG = ['id', 'loId', 'x', 'y', 'gocDo', 'soTangDH', 'soTangDe', 'caoDe', 'caoDH', 'coApMai', 'deOffset', 'khoa', 'mauId'] as const;
export type BoCucLuu = Omit<ToaDat, (typeof TRUONG_RIENG)[number]>;

export type MauToaLuu = {
  id: string;
  ten: string;
  /** mẫu thư viện gốc */
  mauId: string;
  ngay: string;
  ghiChu?: string;
  /** số căn / tầng và DTXD (m²) lúc lưu — để liệt kê, không dùng để tính */
  soCan?: number;
  dtxdM2?: number;
  bo: BoCucLuu;
};

export type KhoLuu = Pick<Storage, 'getItem' | 'setItem'>;

const sao = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const laDoiTuong = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Chụp bố cục của `toa` thành mẫu đã lưu (bản sao sâu, không tham chiếu tới tòa). */
export function taoMauToaLuu(toa: ToaDat, ten: string, id: string, extra: { ghiChu?: string; soCan?: number; dtxdM2?: number; ngay?: string } = {}): MauToaLuu {
  const bo = sao(toa) as Partial<ToaDat>;
  for (const k of TRUONG_RIENG) delete (bo as Record<string, unknown>)[k];
  return {
    id, ten: ten.trim().slice(0, TEN_TOI_DA) || toa.mauId, mauId: toa.mauId, ngay: extra.ngay ?? new Date().toISOString().slice(0, 10),
    ...(extra.ghiChu ? { ghiChu: extra.ghiChu.slice(0, 300) } : {}),
    ...(extra.soCan !== undefined ? { soCan: extra.soCan } : {}), ...(extra.dtxdM2 !== undefined ? { dtxdM2: extra.dtxdM2 } : {}),
    bo: bo as BoCucLuu,
  };
}

/** Áp mẫu đã lưu lên `toa`: giữ vị trí / số tầng / định danh của `toa`, thay bố cục + mẫu gốc. */
export function apMauToaLuu(toa: ToaDat, m: MauToaLuu): ToaDat {
  const r = { ...sao(m.bo), mauId: m.mauId } as Partial<ToaDat>;
  for (const k of TRUONG_RIENG) if (k !== 'mauId') (r as Record<string, unknown>)[k] = (toa as Record<string, unknown>)[k];
  if (toa.khoa === undefined) delete r.khoa;
  return r as ToaDat;
}

/** Tòa mới trên lô từ mẫu đã lưu (vị trí / góc hợp lô như `taoToaTrenLo`, bố cục theo mẫu lưu). */
export function taoToaTuMauLuu(m: MauToaLuu, tv: ThuVien, lo: Lo, id: string): ToaDat | null {
  const goc = tv.toa.get(m.mauId) as ToaMau | undefined;
  return goc ? apMauToaLuu(taoToaTrenLo(goc, lo, id), m) : null;
}

/** Làm sạch một bản ghi đọc từ máy / tệp: sai cấu trúc thì null. */
export function chuanHoaMauToaLuu(v: unknown): MauToaLuu | null {
  if (!laDoiTuong(v) || typeof v.id !== 'string' || !v.id || typeof v.ten !== 'string' || typeof v.mauId !== 'string' || !laDoiTuong(v.bo)) return null;
  const bo = sao(v.bo) as Record<string, unknown>;
  for (const k of TRUONG_RIENG) delete bo[k];
  if (!laDoiTuong(bo.canTheo)) bo.canTheo = {};
  return {
    id: v.id.slice(0, 80), ten: v.ten.trim().slice(0, TEN_TOI_DA) || v.mauId, mauId: v.mauId,
    ngay: typeof v.ngay === 'string' ? v.ngay.slice(0, 10) : '',
    ...(typeof v.ghiChu === 'string' && v.ghiChu ? { ghiChu: v.ghiChu.slice(0, 300) } : {}),
    ...(typeof v.soCan === 'number' && Number.isFinite(v.soCan) ? { soCan: v.soCan } : {}),
    ...(typeof v.dtxdM2 === 'number' && Number.isFinite(v.dtxdM2) ? { dtxdM2: v.dtxdM2 } : {}),
    bo: bo as unknown as BoCucLuu,
  };
}

export function docMauToaLuu(kho: KhoLuu | null = typeof localStorage !== 'undefined' ? localStorage : null): MauToaLuu[] {
  try {
    const j = JSON.parse(kho?.getItem(KHOA_MAU_TOA_LUU) ?? '[]') as unknown;
    return (Array.isArray(j) ? j : []).map(chuanHoaMauToaLuu).filter((x): x is MauToaLuu => !!x).slice(0, SO_MAU_TOI_DA);
  } catch { return []; }
}
/** Ghi danh sách; false khi kho đầy / bị chặn (khi đó mẫu chỉ còn trong phiên). */
export function ghiMauToaLuu(ds: MauToaLuu[], kho: KhoLuu | null = typeof localStorage !== 'undefined' ? localStorage : null): boolean {
  try { kho?.setItem(KHOA_MAU_TOA_LUU, JSON.stringify(ds.slice(0, SO_MAU_TOI_DA))); return !!kho; } catch { return false; }
}

/** Mã mới không trùng mã nào trong `ds`. */
export const maMauMoi = (ds: readonly MauToaLuu[], gieo = Date.now()): string => {
  let n = gieo;
  const co = new Set(ds.map((x) => x.id));
  while (co.has(`luu-${n.toString(36)}`)) n++;
  return `luu-${n.toString(36)}`;
};

/** Thêm mẫu (mẫu đầu danh sách); đủ SO_MAU_TOI_DA thì mẫu cũ nhất bị bỏ. Trả danh sách mới. */
export const themMauToaLuu = (ds: readonly MauToaLuu[], m: MauToaLuu): MauToaLuu[] => [m, ...ds.filter((x) => x.id !== m.id)].slice(0, SO_MAU_TOI_DA);
export const xoaMauToaLuu = (ds: readonly MauToaLuu[], id: string): MauToaLuu[] => ds.filter((x) => x.id !== id);
export const doiTenMauToaLuu = (ds: readonly MauToaLuu[], id: string, ten: string): MauToaLuu[] =>
  ds.map((x) => (x.id === id ? { ...x, ten: ten.trim().slice(0, TEN_TOI_DA) || x.ten } : x));

/** Chuỗi JSON để tải xuống / chuyển máy. */
export const xuatMauToaLuu = (ds: readonly MauToaLuu[]): string => JSON.stringify({ dinhDang: DINH_DANG_MAU_TOA, phienBan: 1, mau: ds }, null, 1);

/**
 * Nhập từ chuỗi JSON (tệp xuất hoặc mảng thô): bản ghi hỏng bỏ qua; mẫu gốc không còn trong thư viện (`tv`) bỏ qua; mã trùng với mẫu
 * sẵn có thì cấp mã mới (không đè). Trả danh sách đầy đủ sau khi gộp + số bản ghi nhận / bỏ.
 */
export function nhapMauToaLuu(text: string, hien: readonly MauToaLuu[], tv?: ThuVien): { ds: MauToaLuu[]; nhan: number; bo: number } | null {
  let j: unknown;
  try { j = JSON.parse(text); } catch { return null; }
  const mang = Array.isArray(j) ? j : laDoiTuong(j) && j.dinhDang === DINH_DANG_MAU_TOA && Array.isArray(j.mau) ? j.mau : null;
  if (!mang) return null;
  let ds = [...hien], nhan = 0, bo = 0;
  for (const x of mang) {
    const m = chuanHoaMauToaLuu(x);
    if (!m || (tv && !tv.toa.has(m.mauId))) { bo++; continue; }
    ds = themMauToaLuu(ds, ds.some((y) => y.id === m.id) ? { ...m, id: maMauMoi(ds) } : m);
    nhan++;
  }
  return { ds, nhan, bo };
}
