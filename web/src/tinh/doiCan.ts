import type { BoCucTang, CongNangO, LoaiCan, ThongTinLoi, ToaDat } from './kieu';
import { boCucTang, canDangDung, congNangTai, type BoCucToa, type ViTriCan } from './matBang';

type DoiCan = Pick<ToaDat, 'canTheo' | 'canViTri'>;

const gon = (canViTri: Record<string, string>): Record<string, string> | undefined => (Object.keys(canViTri).length ? canViTri : undefined);

/**
 * Đổi căn tại một vị trí sang mẫu `canMoi`.
 * `nhieu` (Sửa nhiều căn): đổi mọi căn cùng mẫu gốc trong tòa (đổi theo mẫu, xoá đổi theo vị trí của các căn đó).
 * Không bật thì chỉ đổi đúng vị trí này; đổi về đúng mẫu mà luật theo mẫu đã cho thì bỏ khoá vị trí.
 */
export function doiCanTaiViTri<T extends DoiCan>(toa: T, vt: ViTriCan, canMoi: string, vts: ViTriCan[], nhieu: boolean): T {
  const canTheo = { ...toa.canTheo };
  const canViTri = { ...(toa.canViTri ?? {}) };
  if (nhieu) {
    if (canMoi === vt.canGocId) delete canTheo[vt.canGocId]; else canTheo[vt.canGocId] = canMoi;
    for (const v of vts) if (v.canGocId === vt.canGocId) delete canViTri[v.khoa];
  } else if (canMoi === (canTheo[vt.canGocId] ?? vt.canGocId)) delete canViTri[vt.khoa];
  else canViTri[vt.khoa] = canMoi;
  return { ...toa, canTheo, canViTri: gon(canViTri) };
}

/** Bỏ mọi đổi căn (chung và theo tầng): về đúng mẫu căn gốc của mẫu tòa. Công năng ô giữ nguyên. */
export const veMauGoc = <T extends DoiCan & Pick<ToaDat, 'tangRieng'>>(toa: T): T => ({
  ...toa, canTheo: {}, canViTri: undefined,
  ...(toa.tangRieng ? { tangRieng: gonTang(Object.fromEntries(Object.entries(toa.tangRieng).map(([k, g]) => [k, { ...g, canViTri: undefined }]))) } : {}),
});

/** Áp kết quả tối ưu: thay toàn bộ đổi theo vị trí (đổi theo mẫu giữ nguyên). */
export const apDoiViTri = <T extends DoiCan>(toa: T, canViTri: Record<string, string>): T => ({ ...toa, canViTri: gon(canViTri) });

// ---- Bố cục theo tầng (L10) và công năng ô (L8) ----

/** Ghi đè tầng rỗng thì bỏ; không còn tầng nào thì undefined. */
function gonTang(tr: Record<string, BoCucTang>): Record<number, BoCucTang> | undefined {
  const kq: Record<number, BoCucTang> = {};
  for (const [k, g] of Object.entries(tr)) {
    const cv = g.canViTri && Object.keys(g.canViTri).length ? g.canViTri : undefined;
    const cn = g.congNang && Object.keys(g.congNang).length ? g.congNang : undefined;
    // mặt bằng tự chỉnh riêng của tầng giữ tới lần tự chỉnh sau (chỉ còn nghĩa khi tầng còn đổi căn / công năng)
    if (cv || cn || g.coCauMucTieu) kq[Number(k)] = { ...(cv ? { canViTri: cv } : {}), ...(cn ? { congNang: cn } : {}), ...(g.coCauMucTieu ? { coCauMucTieu: g.coCauMucTieu } : {}), ...((cv || cn) && g.matBang ? { matBang: g.matBang } : {}) };
  }
  return Object.keys(kq).length ? kq : undefined;
}

/** Sửa ghi đè của các tầng `tangs` bằng `fn` (nhận bản sao để sửa tại chỗ), rồi dọn gọn. */
function suaTang<T extends Pick<ToaDat, 'tangRieng'>>(toa: T, tangs: number[], fn: (g: { canViTri: Record<string, string>; congNang: Record<string, CongNangO>; coCauMucTieu?: Record<LoaiCan, number> }, tang: number) => void): T {
  const tr: Record<string, BoCucTang> = { ...(toa.tangRieng ?? {}) };
  for (const k of tangs) {
    const cu = tr[k] ?? {};
    const g = { canViTri: { ...(cu.canViTri ?? {}) }, congNang: { ...(cu.congNang ?? {}) }, coCauMucTieu: cu.coCauMucTieu };
    fn(g, k);
    tr[k] = g;
  }
  return { ...toa, tangRieng: gonTang(tr) };
}

/**
 * Đổi căn tại vị trí `vt` sang `canMoi` chỉ trên các tầng `tangs` (ghi đè lên bố cục chung). `nhieu`: mọi vị trí cùng mẫu gốc
 * trên tầng đó. Giá trị trùng bố cục chung thì bỏ ghi đè.
 */
export function doiCanTheoTang<T extends BoCucToa>(toa: T, tangs: number[], vt: ViTriCan, canMoi: string, vts: ViTriCan[], nhieu: boolean): T {
  const ds = nhieu ? vts.filter((v) => v.canGocId === vt.canGocId) : [vt];
  return suaTang(toa, tangs, (g) => {
    for (const v of ds) {
      if (canMoi === canDangDung(v, toa)) delete g.canViTri[v.khoa];
      else g.canViTri[v.khoa] = canMoi;
    }
  });
}

/** Đổi công năng các ô `khoas`: `tangs` = null là bố cục chung, không thì chỉ các tầng đó (trùng bố cục chung thì bỏ ghi đè). */
export function doiCongNang<T extends BoCucToa>(toa: T, tangs: number[] | null, khoas: string[], cn: CongNangO): T {
  if (tangs === null) {
    const congNang = { ...(toa.congNang ?? {}) };
    for (const k of khoas) if (cn === 'can') delete congNang[k]; else congNang[k] = cn;
    return { ...toa, congNang: Object.keys(congNang).length ? congNang : undefined };
  }
  return suaTang(toa, tangs, (g) => {
    for (const k of khoas) {
      if (cn === congNangTai(k, toa)) delete g.congNang[k];
      else g.congNang[k] = cn;
    }
  });
}

/** Áp kết quả tối ưu cho các tầng: `canViTri` là đổi theo vị trí ĐẦY ĐỦ của tầng (so với canTheo); chỉ lưu phần khác bố cục chung. */
export function apDoiViTriTang<T extends BoCucToa>(toa: T, tangs: number[], canViTri: Record<string, string>, vts: ViTriCan[]): T {
  return suaTang(toa, tangs, (g) => {
    g.canViTri = {};
    for (const v of vts) {
      const moi = canViTri[v.khoa] ?? toa.canTheo[v.canGocId] ?? v.canGocId;
      if (moi !== canDangDung(v, toa)) g.canViTri[v.khoa] = moi;
    }
  });
}

/** Bỏ bố cục riêng (đổi căn + công năng) của các tầng; mục tiêu cơ cấu riêng giữ nguyên. */
export const boTangRieng = <T extends Pick<ToaDat, 'tangRieng'>>(toa: T, tangs: number[]): T =>
  suaTang(toa, tangs, (g) => { g.canViTri = {}; g.congNang = {}; });

/** Đặt (hoặc bỏ khi null) mục tiêu cơ cấu riêng cho các tầng (S12). */
export const datCoCauTang = <T extends Pick<ToaDat, 'tangRieng'>>(toa: T, tangs: number[], muc: Record<LoaiCan, number> | null): T =>
  suaTang(toa, tangs, (g) => { g.coCauMucTieu = muc ?? undefined; });

/** Bố cục đang xem để vẽ: tầng đầu trong danh sách chọn, hoặc chung. */
export const boCucDangXem = (toa: BoCucToa, tangs: number[] | null) => boCucTang(toa, tangs?.length ? tangs[0] : null);

/** Thông tin lõi mặc định: cửa trái; thang bộ xuống hầm + lên mái, thang máy xuống hầm, hộp KT xuống hầm + lên mái. */
export const LOI_MAC_DINH: ThongTinLoi = { cua: 'trai', thangBo: { ham: true, mai: true }, thangMay: { ham: true, mai: false }, hopKT: { ham: true, mai: true } };
export const thongTinLoi = (toa: Pick<ToaDat, 'loi'>, khoa: string): ThongTinLoi => {
  const l = toa.loi?.[khoa];
  return l ? { ...LOI_MAC_DINH, ...l, thangBo: { ...LOI_MAC_DINH.thangBo, ...l.thangBo }, thangMay: { ...LOI_MAC_DINH.thangMay, ...l.thangMay }, hopKT: { ...LOI_MAC_DINH.hopKT, ...l.hopKT } } : LOI_MAC_DINH;
};
export const datLoi = <T extends Pick<ToaDat, 'loi'>>(toa: T, khoa: string, l: ThongTinLoi): T => ({ ...toa, loi: { ...(toa.loi ?? {}), [khoa]: l } });
