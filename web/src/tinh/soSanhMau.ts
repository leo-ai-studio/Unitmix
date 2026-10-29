/**
 * SO SÁNH MẪU TÒA không đặt lên TMB (lãnh đạo 29/10/2026: "Cho tự động so sánh các dạng sắp lõi thang L1 L2 L3 để xem cách nào
 * có được tối ưu hơn"). Mỗi mẫu (và biến thể "tối ưu cơ cấu + STRETCH" của nó) dựng thành MỘT tòa ảo đứng một mình, chạy đúng các
 * bước app làm khi người dùng đặt tòa rồi mở màn Tầng: (biến thể) tối ưu cơ cấu DC-05 · QT-79 có đổi bề ngang / STRETCH DC-04 →
 * tự chỉnh mặt bằng XC-03/05/06/07 · PC-11 · QT-69 + gỡ căn vượt cự ly (tinh/loiThang.ts `tuChinhToa`). Rồi đo tầng điển hình:
 * căn / tầng, cơ cấu + điểm lệch so với mục tiêu, DTSD (Σ DT thông thủy), DTXD 1 sàn (nét bao sau tự chỉnh), hiệu suất =
 * DTSD / DTXD (MT-03, như KPI tinh/kpi.ts), thang bộ (PC-11), thang máy (số giếng của khối lõi `so_gieng`), căn vượt cự ly thoát
 * nạn sau tự chỉnh (QCVN 06, tinh/pccc.ts), dân / tầng (tinh/danSo.ts theo khai của lô — gồm cả làm tròn DT), kích thước chân
 * tháp, tỉ lệ lõi + thang / DTXD, số căn góc. Hàm thuần, không đụng PA; nặng (tự chỉnh mỗi mẫu vài chục ms) → giao diện gọi qua
 * Web Worker (`soSanhMau.worker.ts`, `soSanhMauNen`).
 * Điểm view: chỗ móc `diemView` (tinh/huongView.ts của agent khác sẽ điền) — chưa tính ở đây.
 */
import { mauToa } from './canThem';
import { diemLechCoCau, phanTram } from './coCau';
import { danSoLo } from './danSo';
import { chanToa } from './hinhHoc';
import {
  HE_SO_MAC_DINH, LOAI_CAN, NGUONG_MAC_DINH, type CanMau, type ChiTieuQH, type Diem, type LoaiCan, type Lo, type ThuVien, type ToaDat, type TrangThaiPA,
} from './kieu';
import { dtxdTang } from './kpi';
import { BAY_MM, daGiacCacLoi, dsLoi, mauHieuDung, tuChinhToa, type DuLieuMB, type ToaMB } from './loiThang';
import { boCucTang, canCuaToa, coMat, viTriCan, type ToaCoMat } from './matBang';
import { chieuCaoPCCC, thoatNan, type ToaPCCC } from './pccc';
import { toiUuCoCau } from './toiUu';

/** Biến thể so sánh: mẫu gốc của thư viện, hoặc mẫu sau "Tối ưu cơ cấu" có đổi bề ngang + STRETCH (như nút ở màn Tầng). */
export type BienTheMau = 'goc' | 'toiUu';
export const BIEN_THE: BienTheMau[] = ['goc', 'toiUu'];

export type DauVaoSoSanh = {
  mauIds: string[];
  /** Mặc định chỉ mẫu gốc. 'toiUu' chỉ thêm khi tối ưu đổi được ít nhất một căn. */
  bienThe?: BienTheMau[];
  /** Cơ cấu mục tiêu % (lô / yêu cầu người dùng). */
  mucTieu: Record<LoaiCan, number>;
  /** Số tầng điển hình (chiều cao PCCC); mặc định theo chỉ tiêu lô, không có thì 24. */
  soTangDH?: number;
  soTangDe?: number;
  /** Lô lấy quy tắc dân số + DT đề bài KD; thiếu = hệ số chung `nguoiMoiCan`. */
  lo?: Lo | null;
  nguoiMoiCan?: number;
};

/** Hình thu nhỏ (m, hệ mẫu tòa, y lên): nét bao sàn, căn theo loại, lõi, ô thang bộ. */
export type HinhThu = { bao: Diem[]; can: { loai: LoaiCan; pts: Diem[] }[]; loi: Diem[][]; thang: Diem[][] };

export type KetQuaMau = {
  /** `<mauId>|<biến thể>` */
  khoa: string;
  mauId: string;
  bienThe: BienTheMau;
  nhom: 'tm' | 'xh';
  hinh: string;
  soTangDH: number;
  /** Căn / tầng điển hình sau tự chỉnh (ô đổi công năng / bỏ thoát nạn không tính). */
  soCan: number;
  coCau: Record<LoaiCan, number>;
  coCauPct: Record<LoaiCan, number>;
  /** Điểm lệch cơ cấu Σ |% − % mục tiêu| (thấp là tốt). */
  lech: number;
  dtsd: number;
  dtxd: number;
  /** DTSD / DTXD (0–1). */
  hieuSuat: number | null;
  soThangBo: number;
  /** Tổng số giếng thang máy của các khối lõi (`so_gieng`); null = khối lõi chưa có số liệu. */
  soThangMay: number | null;
  /** Căn vượt cự ly thoát nạn sau tự chỉnh; null = không kiểm được (mẫu thiếu đồ thị hành lang / chưa có dữ liệu lõi). */
  vuot: number | null;
  /** Căn tự chỉnh đã bỏ / đổi phòng kỹ thuật để hết vượt cự ly (giamCanThoatNan). */
  canGo: number;
  /** Dân / tầng theo quy tắc dân số của lô. */
  danTang: number;
  soCanGoc: number;
  /** Kích thước khung bao chân tháp (m): dài ≥ rộng. */
  dai: number;
  rong: number;
  /** DT lõi + ô thang bộ (m²) và tỉ lệ trên DTXD (thấp = lõi gọn). */
  dtLoi: number | null;
  tyLeLoi: number | null;
  /** Số căn tối ưu đã đổi (biến thể 'toiUu'). */
  soDoi: number;
  /** Đổi căn theo vị trí của biến thể (đặt lên lô thì ghi vào ToaDat.canViTri). */
  canViTri?: Record<string, string>;
  /** Móc điểm view 0–100 (tinh/huongView.ts — chưa có); null / thiếu = chưa tính, không vào điểm. */
  diemView?: number | null;
  hinhThu: HinhThu;
};

const dtDaGiac = (P: Diem[]) => Math.abs(P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const m2 = (P: Diem[]): Diem[] => P.map(([x, y]) => [Math.round(x) / 1000, Math.round(y) / 1000]);
const rad = (d: number) => (d * Math.PI) / 180;

/** Tòa ảo của mẫu (không thuộc PA): tâm 0, góc 0, số tầng theo đầu vào. */
export function toaAo(mauId: string, loId: string, soTangDH: number, soTangDe: number): ToaDat {
  return { id: `ss-${mauId}`, loId, mauId, x: 0, y: 0, gocDo: 0, soTangDH, soTangDe, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} };
}

/** Số tầng điển hình mặc định: tầng căn hộ QH, không có thì tầng cao tối đa − tầng đế; thiếu lô thì 24 (như test quét mẫu). */
export const soTangMacDinh = (lo: Lo | null | undefined): number => {
  const ct = lo?.temDat.chiTieu;
  if (!ct) return 24;
  return Math.max(1, ct.tangCanHo ?? Math.round(ct.tangCaoMax) - (ct.tangDe ?? 1));
};

const CHI_TIEU_GIA: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 10, tangCaoMax: 30, tangDe: 1, tangCanHo: null, tangHam: null, danSoMax: 0, soCanMax: null, nguoiMoiCan: 3.5, choDoOtoMoiCan: 0, choXeMayMoiCan: 0, cayXanhMin: 0 };
const loGia = (nguoiMoiCan: number, mucTieu: Record<LoaiCan, number>): Lo => ({
  id: 'ss-lo', ranh: [], chiGioi: null, xungQuanh: [],
  temDat: { kyHieu: '—', chucNang: 'tm', chiTieu: { ...CHI_TIEU_GIA, nguoiMoiCan }, coCauMucTieu: mucTieu },
});
const paMot = (lo: Lo, toa: ToaDat): TrangThaiPA => ({
  phienBan: 1, lo: [lo], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: [toa],
  ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 },
});

/** Hình thu nhỏ từ mẫu hiệu dụng (mặt bằng tự chỉnh): căn theo vị trí đang dùng, lõi, ô thang bộ. */
function dungHinhThu(toa: ToaDat, mau: ToaMB, tv: ThuVien, dl: DuLieuMB | null): HinhThu {
  const hd = mauHieuDung(toa, mau, dl, null) as ToaMB;
  const bc = boCucTang(toa, null);
  const can: HinhThu['can'] = [];
  for (const vt of viTriCan(hd as ToaCoMat, tv, bc)) {
    if ((bc.congNang?.[vt.khoa] ?? 'can') !== 'can') continue;
    const c = tv.can.get(bc.canViTri?.[vt.khoa] ?? bc.canTheo[vt.canGocId] ?? vt.canGocId);
    if (c) can.push({ loai: c.loai, pts: m2(vt.goc) });
  }
  const thang: Diem[][] = [];
  for (const m of hd.mat) {
    const u: Diem = [Math.cos(rad(m.goc_deg)), Math.sin(rad(m.goc_deg))], n: Diem = [-u[1], u[0]];
    const pt = (a: number, b: number): Diem => [u[0] * a + n[0] * (m.truc_mm + b), u[1] * a + n[1] * (m.truc_mm + b)];
    for (const q of m.phan_tu) if (q.loai === 'thang_bo') thang.push(m2([pt(q.a0, 0), pt(q.a1, 0), pt(q.a1, BAY_MM), pt(q.a0, BAY_MM)]));
  }
  return { bao: m2(toa.duongBao ?? mau.duong_bao), can, loi: daGiacCacLoi(hd, dl).map(m2), thang };
}

/** Số giếng thang máy + DT các khối lõi (m²) của mẫu. */
function loiCuaMau(mau: ToaMB, dl: DuLieuMB | null): { soGieng: number | null; dt: number | null } {
  if (!dl) return { soGieng: null, dt: null };
  let so = 0, co = false, dt = 0;
  for (const { q } of dsLoi(mau)) {
    const K = dl.loi.get(q.block) as (DuLieuMB['loi'] extends Map<string, infer V> ? V : never) & { so_gieng?: number; rong_mm?: number; sau_mm?: number } | undefined;
    if (!K) continue;
    if (typeof K.so_gieng === 'number') { so += K.so_gieng; co = true; }
    if (K.bao_tm?.length) dt += dtDaGiac(K.bao_tm) / 1e6;
    else if (K.rong_mm && K.sau_mm) dt += (K.rong_mm * K.sau_mm) / 1e6;
  }
  return { soGieng: co ? so : null, dt: dt || null };
}

/** Đo một mẫu ở một biến thể; null khi mẫu không có mặt bằng tầng hoặc biến thể không đổi được gì. */
export function doMotMau(mauId: string, bienThe: BienTheMau, v: DauVaoSoSanh, tv: ThuVien, dl: DuLieuMB | null): KetQuaMau | null {
  const goc = tv.toa.get(mauId);
  if (!goc || !coMat(goc)) return null;
  const mau = goc as unknown as ToaMB;
  const soTangDH = v.soTangDH ?? soTangMacDinh(v.lo);
  const soTangDe = v.soTangDe ?? v.lo?.temDat.chiTieu.tangDe ?? 1;
  let toa = toaAo(mauId, v.lo?.id ?? 'ss-lo', soTangDH, soTangDe);
  const H = chieuCaoPCCC(soTangDe, toa.caoDe, soTangDH, toa.caoDH);
  let soDoi = 0;
  if (bienThe === 'toiUu') {
    const kq = toiUuCoCau(mau, toa, tv, v.mucTieu, { doiBeNgang: true, cuaCan: dl?.cuaCan, chieuCaoPCCC: H, dtDeBai: v.lo?.temDat.deBai?.dtCan });
    if (!kq.soDoi) return null;
    soDoi = kq.soDoi;
    toa = { ...toa, canViTri: kq.canViTri };
  }
  if (dl) toa = tuChinhToa(toa, mau, tv, dl);
  const mauT = mauToa(tv, toa) ?? goc;
  const dem = Object.fromEntries(LOAI_CAN.map((k) => [k, 0])) as Record<LoaiCan, number>;
  let dtsd = 0, soCan = 0, soCanGoc = 0;
  for (const [id, n] of canCuaToa(mauT, boCucTang(toa, null), tv)) {
    const c: CanMau | undefined = tv.can.get(id);
    if (!c) continue;
    dem[c.loai] += n; soCan += n; dtsd += n * c.dt_tt_m2;
    if (c.vi_tri === 'goc') soCanGoc += n;
  }
  const coCauPct = phanTram(dem);
  const dtxd = dtxdTang(tv, toa, null);
  const bc = toa.matBang?.baoCao;
  let vuot: number | null = bc ? (bc.giamCan ? bc.giamCan.vuotSau : bc.vuotSau) : null;
  if (vuot === null && Array.isArray((mau as unknown as ToaPCCC).truc)) {
    try { vuot = thoatNan(mau as unknown as ToaPCCC, { cuaCan: dl?.cuaCan, chieuCaoPCCC: H }).soVuot; } catch { vuot = null; }
  }
  const soThangBo = toa.matBang?.thangBo.length ?? mau.mat.reduce((a, m) => a + m.phan_tu.filter((q) => q.loai === 'thang_bo').length, 0);
  const loi = loiCuaMau(mau, dl);
  const dtThang = (toa.matBang?.thangBo ?? []).reduce((a, t) => a + (t.rong * BAY_MM) / 1e6, 0);
  const dtLoi = loi.dt === null ? null : loi.dt + dtThang;
  const chan = chanToa(mauT, toa);
  const xs = chan.map((p) => p[0]), ys = chan.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const lo = v.lo ?? loGia(v.nguoiMoiCan ?? 3.5, v.mucTieu);
  const danTang = danSoLo(paMot(lo, { ...toa, loId: lo.id, soTangDH: 1, tangRieng: undefined }), lo, tv).tong;
  return {
    khoa: `${mauId}|${bienThe}`, mauId, bienThe, nhom: goc.nhom, hinh: goc.hinh, soTangDH,
    soCan, coCau: dem, coCauPct, lech: diemLechCoCau(coCauPct, v.mucTieu),
    dtsd, dtxd, hieuSuat: dtxd > 0 ? dtsd / dtxd : null,
    soThangBo, soThangMay: loi.soGieng, vuot, canGo: bc?.giamCan ? bc.giamCan.bo + bc.giamCan.doi : 0,
    danTang, soCanGoc, dai: Math.max(w, h), rong: Math.min(w, h),
    dtLoi, tyLeLoi: dtLoi !== null && dtxd > 0 ? dtLoi / dtxd : null, soDoi,
    ...(bienThe === 'toiUu' ? { canViTri: toa.canViTri } : {}),
    diemView: null,
    hinhThu: dungHinhThu(toa, mau, tv, dl),
  };
}

/** Đo mọi mẫu × biến thể (đồng bộ). `tienDo` sau mỗi mẫu. */
export function soSanhMau(v: DauVaoSoSanh, tv: ThuVien, dl: DuLieuMB | null, tienDo?: (xong: number, tong: number) => void): KetQuaMau[] {
  const bt = v.bienThe?.length ? v.bienThe : (['goc'] as BienTheMau[]);
  const kq: KetQuaMau[] = [];
  v.mauIds.forEach((id, i) => {
    for (const b of bt) { const r = doMotMau(id, b, v, tv, dl); if (r) kq.push(r); }
    tienDo?.(i + 1, v.mauIds.length);
  });
  return kq;
}

/** Khoá ô (bố cục chung) đầu tiên của tòa đang dùng mẫu căn `canId` — để chọn căn khi mở màn Tầng; không có thì null. */
export function oDungCan(tv: ThuVien, toa: ToaDat, canId: string): string | null {
  const m = mauToa(tv, toa);
  if (!m || !coMat(m)) return null;
  const bc = boCucTang(toa, null);
  return viTriCan(m, tv).find((vt) => (bc.congNang?.[vt.khoa] ?? 'can') === 'can' && (bc.canViTri?.[vt.khoa] ?? bc.canTheo[vt.canGocId] ?? vt.canGocId) === canId)?.khoa ?? null;
}

/** Họ mẫu theo dạng hình (i, l, t, u, v, y, z) trong một nhóm — VD họ L TM: tm-l1, tm-l2, tm-l3. */
export function hoMau(tv: ThuVien, nhom: 'tm' | 'xh', hinh?: string | null): string[] {
  return [...tv.toa.values()].filter((m) => m.nhom === nhom && (!hinh || m.hinh === hinh) && coMat(m)).sort((a, b) => a.hinh.localeCompare(b.hinh) || a.so - b.so).map((m) => m.id);
}

/** Các dạng hình có trong nhóm (để hiện nút họ). */
export const dsHinh = (tv: ThuVien, nhom: 'tm' | 'xh'): string[] => [...new Set(hoMau(tv, nhom).map((id) => tv.toa.get(id)!.hinh))];

// ---------- Web Worker ----------

export type ThuSoSanh = { id: number; v: DauVaoSoSanh; tv?: ThuVien; dl?: DuLieuMB | null };
export type ThuSoSanhVe = { id: number; xong?: number; tong?: number; ds?: KetQuaMau[]; loi?: string };

let worker: Worker | null = null, tvW: ThuVien | null = null, dlW: DuLieuMB | null | undefined, soId = 0;
let huyLuot: (() => void) | null = null;
const taoWorker = (): Worker | null => {
  if (typeof Worker === 'undefined') return null;
  try { return new Worker(new URL('./soSanhMau.worker.ts', import.meta.url), { type: 'module' }); } catch { return null; }
};

/**
 * Chạy so sánh trên trình duyệt: có Worker thì chạy hẳn trong worker (mỗi mẫu tự chỉnh vài chục – trăm ms, họ 10 mẫu × 2 biến
 * thể đứng giao diện cả giây); lượt mới huỷ lượt cũ (trả null). Không có Worker (vitest / node): chạy đồng bộ.
 */
export async function soSanhMauNen(v: DauVaoSoSanh, tv: ThuVien, dl: DuLieuMB | null, tienDo?: (xong: number, tong: number) => void): Promise<KetQuaMau[] | null> {
  huyLuot?.();
  if (!worker) { worker = taoWorker(); tvW = null; dlW = undefined; }
  const w = worker;
  if (!w) return soSanhMau(v, tv, dl, tienDo);
  const id = ++soId;
  const thu: ThuSoSanh = { id, v };
  if (tvW !== tv) { thu.tv = tv; tvW = tv; }
  if (dlW !== dl) { thu.dl = dl; dlW = dl; }
  return new Promise((xong, hong) => {
    const ket = (giet: boolean) => {
      w.onmessage = null; w.onerror = null; huyLuot = null;
      if (giet) { w.terminate(); if (worker === w) worker = null; }
    };
    huyLuot = () => { ket(true); xong(null); };
    w.onmessage = (e: MessageEvent<ThuSoSanhVe>) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.loi !== undefined) { ket(true); hong(new Error(m.loi.split('\n')[0])); return; }
      if (m.ds) { ket(false); xong(m.ds); return; }
      if (m.xong !== undefined) tienDo?.(m.xong, m.tong ?? 0);
    };
    w.onerror = () => { ket(true); hong(new Error('soSanhMau worker')); };
    w.postMessage(thu);
  });
}
