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
    const lt = g.lat && Object.keys(g.lat).length ? g.lat : undefined;
    // mặt bằng tự chỉnh riêng của tầng giữ tới lần tự chỉnh sau (chỉ còn nghĩa khi tầng còn đổi căn / công năng / lật)
    if (cv || cn || lt || g.coCauMucTieu) kq[Number(k)] = { ...(cv ? { canViTri: cv } : {}), ...(cn ? { congNang: cn } : {}), ...(lt ? { lat: lt } : {}), ...(g.coCauMucTieu ? { coCauMucTieu: g.coCauMucTieu } : {}), ...((cv || cn || lt) && g.matBang ? { matBang: g.matBang } : {}) };
  }
  return Object.keys(kq).length ? kq : undefined;
}

type GhiDeSua = { canViTri: Record<string, string>; congNang: Record<string, CongNangO>; lat: Record<string, boolean>; coCauMucTieu?: Record<LoaiCan, number> };
/** Sửa ghi đè của các tầng `tangs` bằng `fn` (nhận bản sao để sửa tại chỗ), rồi dọn gọn. */
function suaTang<T extends Pick<ToaDat, 'tangRieng'>>(toa: T, tangs: number[], fn: (g: GhiDeSua, tang: number) => void): T {
  const tr: Record<string, BoCucTang> = { ...(toa.tangRieng ?? {}) };
  for (const k of tangs) {
    const cu = tr[k] ?? {};
    const g = { canViTri: { ...(cu.canViTri ?? {}) }, congNang: { ...(cu.congNang ?? {}) }, lat: { ...(cu.lat ?? {}) }, coCauMucTieu: cu.coCauMucTieu };
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
  suaTang(toa, tangs, (g) => { g.canViTri = {}; g.congNang = {}; g.lat = {}; });

// ---- Công cụ tay màn Tầng: lật gương, đổi chỗ (app cũ mirrorSel · move / commitMove, QT-8 · QT-30) ----

type BoCucToaLat = BoCucToa & Pick<ToaDat, 'lat'>;
const latChung = (toa: Pick<ToaDat, 'lat'>, k: string) => !!toa.lat?.[k];

/**
 * Lật gương (⇄) các ô `khoas` trên phạm vi `tangs` (null = bố cục chung): mỗi ô đảo so với bố cục đang xem của tầng đầu. Trùng bố
 * cục chung thì bỏ ghi đè. Hàng loạt (QT-102): cả danh sách trong một lần gọi = một bước hoàn tác.
 */
export function latO<T extends BoCucToaLat>(toa: T, tangs: number[] | null, khoas: string[]): T {
  if (tangs === null) {
    const lat = { ...(toa.lat ?? {}) };
    for (const k of khoas) if (lat[k]) delete lat[k]; else lat[k] = true;
    return { ...toa, lat: Object.keys(lat).length ? lat : undefined };
  }
  const dang = boCucTang(toa, tangs[0]).lat ?? {};
  return suaTang(toa, tangs, (g) => {
    for (const k of khoas) {
      const moi = !dang[k];
      if (moi === latChung(toa, k)) delete g.lat[k]; else g.lat[k] = moi;
    }
  });
}

/**
 * Đổi chỗ nội dung hai ô `a`, `b` (kéo căn sang ô khác — Sắp xếp căn ✥): mẫu căn đang dùng, công năng ô (ô trống / phòng KT…) và lật
 * gương đổi cho nhau; vị trí ô (khoá mẫu tòa) đứng yên, dãy dồn khít lại theo bề ngang mới (XC-04 · QT-30 · QT-8). `tangs` null =
 * bố cục chung, không thì chỉ các tầng đó (ghi đè).
 */
export function doiChoO<T extends BoCucToaLat>(toa: T, tangs: number[] | null, a: ViTriCan, b: ViTriCan): T {
  if (a.khoa === b.khoa) return toa;
  const bc = boCucTang(toa, tangs?.[0] ?? null);
  const can = (v: ViTriCan) => canDangDung(v, bc), cn = (v: ViTriCan) => congNangTai(v.khoa, bc), lt = (v: ViTriCan) => !!bc.lat?.[v.khoa];
  // `a`, `b` lấy từ viTriCan có bố cục (guong = hướng THẬT, đã tính lật). Căn giữ hướng thật khi sang ô khác (app cũ: "|m" đi theo
  // căn): lat ô mới = guong gốc của ô XOR hướng thật của căn chuyển tới
  const gocO = (v: ViTriCan) => v.guong !== lt(v);
  const moi = [
    { v: a, id: can(b), cn: cn(b), lat: gocO(a) !== b.guong },
    { v: b, id: can(a), cn: cn(a), lat: gocO(b) !== a.guong },
  ];
  if (tangs === null) {
    const canViTri = { ...(toa.canViTri ?? {}) }, congNang: Record<string, CongNangO> = { ...(toa.congNang ?? {}) }, lat = { ...(toa.lat ?? {}) };
    for (const m of moi) {
      if (m.id === (toa.canTheo[m.v.canGocId] ?? m.v.canGocId)) delete canViTri[m.v.khoa]; else canViTri[m.v.khoa] = m.id;
      if (m.cn === 'can') delete congNang[m.v.khoa]; else congNang[m.v.khoa] = m.cn;
      if (m.lat) lat[m.v.khoa] = true; else delete lat[m.v.khoa];
    }
    return { ...toa, canViTri: gon(canViTri), congNang: Object.keys(congNang).length ? congNang : undefined, lat: Object.keys(lat).length ? lat : undefined };
  }
  return suaTang(toa, tangs, (g) => {
    for (const m of moi) {
      if (m.id === canDangDung(m.v, toa)) delete g.canViTri[m.v.khoa]; else g.canViTri[m.v.khoa] = m.id;
      if (m.cn === congNangTai(m.v.khoa, toa)) delete g.congNang[m.v.khoa]; else g.congNang[m.v.khoa] = m.cn;
      if (m.lat === latChung(toa, m.v.khoa)) delete g.lat[m.v.khoa]; else g.lat[m.v.khoa] = m.lat;
    }
  });
}

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
