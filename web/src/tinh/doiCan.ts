import { LOAI_CAN, type BoCucTang, type CanMau, type CongNangO, type LoaiCan, type ThongTinLoi, type ThuVien, type ToaDat } from './kieu';
import { boCucTang, canDangDung, congNangTai, type BoCucToa, type ViTriCan } from './matBang';
import { duocDatVaoO } from './quyTacViTriCan';

type DoiCan = Pick<ToaDat, 'canTheo' | 'canViTri'>;

const gon = (canViTri: Record<string, string>): Record<string, string> | undefined => (Object.keys(canViTri).length ? canViTri : undefined);

/**
 * Đổi căn tại một vị trí sang mẫu `canMoi`.
 * `nhieu` (Sửa nhiều căn): đổi mọi căn cùng mẫu gốc trong tòa (đổi theo mẫu, xoá đổi theo vị trí của các căn đó).
 * Không bật thì chỉ đổi đúng vị trí này; đổi về đúng mẫu mà luật theo mẫu đã cho thì bỏ khoá vị trí.
 */
export function doiCanTaiViTri<T extends DoiCan>(toa: T, vt: ViTriCan, canMoi: string, vts: ViTriCan[], nhieu: boolean): T {
  if (!duocDatVaoO(vt.canGocId, canMoi)) return toa; // sai loại vị trí (căn góc ở giữa / căn giữa ở góc / đổi V·Y): không nhận
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

/** Mọi sửa tay / kết quả tự chỉnh của mặt bằng tòa (ToaDat): bỏ hết thì mặt bằng chạy lại từ mẫu gốc. Giữ vị trí, thông số, khoá, lật chân tòa trên TMB. */
const KHOA_SUA_MB = [
  'canViTri', 'congNang', 'tangRieng', 'latO', 'canThem', 'loiThay', 'thangTay', 'hanhLangTay', 'loaiThang', 'tuPCCCTay', 'cncTay', 'tuDong',
  'matBang', 'duongBao', 'dtxdM2',
] as const;

/** Đưa MẶT BẰNG tòa về mẫu gốc của app: bỏ đổi căn, công năng ô, lật ô, tầng riêng, căn / thang / hành lang / tủ PCCC đặt tay, STRETCH và mặt bằng tự chỉnh. */
export const veMauGocMB = <T extends ToaDat>(toa: T): T => {
  const kq = { ...toa, canTheo: {} } as T & Record<string, unknown>;
  for (const k of KHOA_SUA_MB) delete kq[k];
  return kq;
};

/** Áp kết quả tối ưu: thay toàn bộ đổi theo vị trí (đổi theo mẫu giữ nguyên). */
export const apDoiViTri = <T extends DoiCan>(toa: T, canViTri: Record<string, string>): T => ({ ...toa, canViTri: gon(canViTri) });

// ---- Bố cục theo tầng (L10) và công năng ô (L8) ----

/** Ghi đè tầng rỗng thì bỏ; không còn tầng nào thì undefined. */
function gonTang(tr: Record<string, BoCucTang>): Record<number, BoCucTang> | undefined {
  const kq: Record<number, BoCucTang> = {};
  for (const [k, g] of Object.entries(tr)) {
    const cv = g.canViTri && Object.keys(g.canViTri).length ? g.canViTri : undefined;
    const cn = g.congNang && Object.keys(g.congNang).length ? g.congNang : undefined;
    const lt = g.latO && Object.keys(g.latO).length ? g.latO : undefined;
    // mặt bằng tự chỉnh riêng của tầng giữ tới lần tự chỉnh sau (chỉ còn nghĩa khi tầng còn đổi căn / công năng / lật)
    if (cv || cn || lt || g.coCauMucTieu) kq[Number(k)] = { ...(cv ? { canViTri: cv } : {}), ...(cn ? { congNang: cn } : {}), ...(lt ? { latO: lt } : {}), ...(g.coCauMucTieu ? { coCauMucTieu: g.coCauMucTieu } : {}), ...((cv || cn || lt) && g.matBang ? { matBang: g.matBang } : {}) };
  }
  return Object.keys(kq).length ? kq : undefined;
}

type GhiDeSua = { canViTri: Record<string, string>; congNang: Record<string, CongNangO>; latO: Record<string, boolean>; coCauMucTieu?: Record<LoaiCan, number> };
/** Sửa ghi đè của các tầng `tangs` bằng `fn` (nhận bản sao để sửa tại chỗ), rồi dọn gọn. */
function suaTang<T extends Pick<ToaDat, 'tangRieng'>>(toa: T, tangs: number[], fn: (g: GhiDeSua, tang: number) => void): T {
  const tr: Record<string, BoCucTang> = { ...(toa.tangRieng ?? {}) };
  for (const k of tangs) {
    const cu = tr[k] ?? {};
    const g = { canViTri: { ...(cu.canViTri ?? {}) }, congNang: { ...(cu.congNang ?? {}) }, latO: { ...(cu.latO ?? {}) }, coCauMucTieu: cu.coCauMucTieu };
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
  if (!duocDatVaoO(vt.canGocId, canMoi)) return toa;
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
  suaTang(toa, tangs, (g) => { g.canViTri = {}; g.congNang = {}; g.latO = {}; });

// ---- Công cụ tay màn Tầng: lật gương, đổi chỗ (app cũ mirrorSel · move / commitMove, QT-8 · QT-30) ----

type BoCucToaLat = BoCucToa & Pick<ToaDat, 'latO'>;
const latChung = (toa: Pick<ToaDat, 'latO'>, k: string) => !!toa.latO?.[k];

/**
 * Lật gương (⇄) các ô `khoas` trên phạm vi `tangs` (null = bố cục chung): mỗi ô đảo so với bố cục đang xem của tầng đầu. Trùng bố
 * cục chung thì bỏ ghi đè. Hàng loạt (QT-102): cả danh sách trong một lần gọi = một bước hoàn tác.
 */
export function latO<T extends BoCucToaLat>(toa: T, tangs: number[] | null, khoas: string[]): T {
  if (tangs === null) {
    const lat = { ...(toa.latO ?? {}) };
    for (const k of khoas) if (lat[k]) delete lat[k]; else lat[k] = true;
    return { ...toa, latO: Object.keys(lat).length ? lat : undefined };
  }
  const dang = boCucTang(toa, tangs[0]).latO ?? {};
  return suaTang(toa, tangs, (g) => {
    for (const k of khoas) {
      const moi = !dang[k];
      if (moi === latChung(toa, k)) delete g.latO[k]; else g.latO[k] = moi;
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
  const can = (v: ViTriCan) => canDangDung(v, bc), cn = (v: ViTriCan) => congNangTai(v.khoa, bc), lt = (v: ViTriCan) => !!bc.latO?.[v.khoa];
  // `a`, `b` lấy từ viTriCan có bố cục (guong = hướng THẬT, đã tính lật). Căn giữ hướng thật khi sang ô khác (app cũ: "|m" đi theo
  // căn): lat ô mới = guong gốc của ô XOR hướng thật của căn chuyển tới
  const gocO = (v: ViTriCan) => v.guong !== lt(v);
  const moi = [
    { v: a, id: can(b), cn: cn(b), latO: gocO(a) !== b.guong },
    { v: b, id: can(a), cn: cn(a), latO: gocO(b) !== a.guong },
  ];
  if (tangs === null) {
    const canViTri = { ...(toa.canViTri ?? {}) }, congNang: Record<string, CongNangO> = { ...(toa.congNang ?? {}) }, lat = { ...(toa.latO ?? {}) };
    for (const m of moi) {
      if (m.id === (toa.canTheo[m.v.canGocId] ?? m.v.canGocId)) delete canViTri[m.v.khoa]; else canViTri[m.v.khoa] = m.id;
      if (m.cn === 'can') delete congNang[m.v.khoa]; else congNang[m.v.khoa] = m.cn;
      if (m.latO) lat[m.v.khoa] = true; else delete lat[m.v.khoa];
    }
    return { ...toa, canViTri: gon(canViTri), congNang: Object.keys(congNang).length ? congNang : undefined, latO: Object.keys(lat).length ? lat : undefined };
  }
  return suaTang(toa, tangs, (g) => {
    for (const m of moi) {
      if (m.id === canDangDung(m.v, toa)) delete g.canViTri[m.v.khoa]; else g.canViTri[m.v.khoa] = m.id;
      if (m.cn === congNangTai(m.v.khoa, toa)) delete g.congNang[m.v.khoa]; else g.congNang[m.v.khoa] = m.cn;
      if (m.latO === latChung(toa, m.v.khoa)) delete g.latO[m.v.khoa]; else g.latO[m.v.khoa] = m.latO;
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

/** Nhãn ngắn của mẫu căn khi chọn đổi: `2pn-m2-8500x6000` (loại · mã vị trí · sâu × rộng, mm). */
export const nhanMauCan = (c: Pick<CanMau, 'loai' | 'vi_tri_ma' | 'sau_mm' | 'rong_mm'>): string => `${c.loai}-${c.vi_tri_ma}-${c.sau_mm}x${c.rong_mm}`;

/**
 * Mẫu căn đổi được cho ô đang dùng mẫu gốc `canGocId`: CÙNG nhóm tòa (NOTM / NOXH), CÙNG vị trí (giữa M / góc G), cùng chiều sâu và
 * đặt được vào loại ô đó (căn V / Y chỉ đổi cho nhau theo quy tắc vị trí). Không gồm biến thể STRETCH. Sắp: loại căn, rộng, mã.
 */
export function dsMauDoiCan(tv: ThuVien, canGocId: string): CanMau[] {
  const cu = tv.can.get(canGocId.split('~')[0]);
  if (!cu) return [];
  return [...tv.can.values()]
    .filter((x) => !x.id.includes('~') && !x.stretchGoc && x.nhom === cu.nhom && x.vi_tri === cu.vi_tri && x.sau_mm === cu.sau_mm && duocDatVaoO(cu.id, x.id))
    .sort((a, b) => LOAI_CAN.indexOf(a.loai) - LOAI_CAN.indexOf(b.loai) || a.rong_mm - b.rong_mm || a.id.localeCompare(b.id));
}
