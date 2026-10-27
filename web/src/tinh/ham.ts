/**
 * Tầng hầm: ranh hầm, lõi + cột kế thừa từ tòa, ram, rải chỗ đỗ / xe máy / kho / kỹ thuật theo từng tầng,
 * và các phép kiểm theo QCVN 13:2018/BXD, QCVN 04:2021/BXD (khu xe điện theo DỰ THẢO SĐ 01:2026 — chỉ cảnh báo).
 * Hàm thuần, toạ độ mét.
 */
import ClipperLib from 'clipper-lib';
import type { MucDo } from './chiTieu';
import { demCan } from './coCau';
import { chanToa, xoayTinhTien } from './hinhHoc';
import { vungDat } from './hopLo';
import type { Diem, KhuXeDien, LoaiRam, Lo, RamHam, ThuVien, TrangThaiPA } from './kieu';
import { chuanHoaHam, type HAM_MAC_DINH } from './macDinh';
import { canCuaToa, coMat } from './matBang';
import type { PhanTuMat } from './pccc';
import { gocCanhDaiNhat, raiChoDo } from './raiCho';

export type HamDayDu = typeof HAM_MAC_DINH;

/* ---------- Hình học Clipper (mm nguyên) ---------- */
type Path = ClipperLib.IntPoint[];
const TL = 1000;
const toPath = (p: Diem[]): Path => p.map(([x, y]) => ({ X: Math.round(x * TL), Y: Math.round(y * TL) }));
const toDiem = (p: Path): Diem[] => p.map((q) => [q.X / TL, q.Y / TL]);
const dtPaths = (ps: Path[]): number => ps.reduce((a, p) => a + ClipperLib.Clipper.Area(p), 0) / (TL * TL);

function chay(loai: number, a: Path[], b: Path[] = []): Path[] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  if (b.length) c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  const kq: Path[] = [];
  c.Execute(loai, kq, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return kq;
}
const sach = (ds: Diem[][]) => ds.filter((p) => p && p.length >= 3).map(toPath);
/** Phần giao của a với b (có thể nhiều mảnh; lỗ thủng có hướng ngược). */
const giao = (a: Diem[][], b: Diem[][]): Diem[][] => chay(ClipperLib.ClipType.ctIntersection, sach(a), sach(b)).map(toDiem);
/** Diện tích a trừ b (m²). */
export const dtTru = (a: Diem[][], b: Diem[][]): number => {
  const pa = sach(a);
  if (!pa.length) return 0;
  const pb = sach(b);
  return dtPaths(pb.length ? chay(ClipperLib.ClipType.ctDifference, pa, pb) : chay(ClipperLib.ClipType.ctUnion, pa));
};
/** Diện tích hợp (không cộng trùng). */
export const dtHop = (a: Diem[][]): number => {
  const pa = sach(a);
  return pa.length ? dtPaths(chay(ClipperLib.ClipType.ctUnion, pa)) : 0;
};

/** Co đa giác vào trong d mét (góc vuông); nhiều mảnh thì giữ mảnh lớn nhất. Co hết thì []. */
export function coVao(poly: Diem[], d: number): Diem[] {
  if (!poly || poly.length < 3) return [];
  if (!(d > 0)) return poly;
  const o = new ClipperLib.ClipperOffset(4, 0.25 * TL);
  o.AddPath(toPath(poly), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const kq: Path[] = [];
  o.Execute(kq, -d * TL);
  const ngoai = kq.filter((p) => ClipperLib.Clipper.Area(p) > 0).sort((a, b) => ClipperLib.Clipper.Area(b) - ClipperLib.Clipper.Area(a));
  return ngoai.length ? toDiem(ngoai[0]) : [];
}

const hcnXoay = (cx: number, cy: number, dai: number, rong: number, gocDo: number): Diem[] =>
  xoayTinhTien([[-dai / 2, -rong / 2], [dai / 2, -rong / 2], [dai / 2, rong / 2], [-dai / 2, rong / 2]], cx, cy, gocDo);

const dtCoDau = (p: Diem[]) => p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0) / 2;

/* ---------- Ranh, lõi, cột, ram ---------- */

/** Ranh hầm: ranh đã cố định trong PA, không thì chỉ giới (hoặc ranh lô) co vào `lui` mét. */
export const ranhHam = (lo: Lo, ts: Pick<HamDayDu, 'ranh' | 'lui'>): Diem[] =>
  ts.ranh && ts.ranh.length >= 3 ? ts.ranh : coVao(vungDat(lo), ts.lui);

/**
 * Lõi (thang bộ, thang máy, hộp kỹ thuật) và cột của các tòa trên lô, kéo xuống hầm.
 * Lõi: khung bao nét vẽ của phần tử không phải căn trên mặt tầng mẫu. Cột: tại đỉnh và dọc cạnh chân tháp, cách ≤ nhịp.
 */
export function loiCotTuToa(pa: TrangThaiPA, tv: ThuVien, loId: string, cotRong: number, nhip: number): { loi: Diem[][]; cot: Diem[][] } {
  const loi: Diem[][] = [];
  const diemCot: Diem[] = [];
  const cot: Diem[][] = [];
  for (const t of pa.toa) {
    const mau = t.loId === loId ? tv.toa.get(t.mauId) : undefined;
    if (!mau) continue;
    const xs = mau.duong_bao.map((p) => p[0]), ys = mau.duong_bao.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const dat = (pts: Diem[]) => xoayTinhTien(pts.map(([x, y]): Diem => [(x - cx) / 1000, (y - cy) / 1000]), t.x, t.y, t.gocDo);
    if (coMat(mau)) {
      for (const m of mau.mat) {
        for (const q of m.phan_tu as (PhanTuMat & { bb_ve_mm?: number[] })[]) {
          const b = q.bb_ve_mm;
          if (q.loai === 'can' || !b || b.length < 4) continue;
          loi.push(dat([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]));
        }
      }
    }
    if (cotRong > 0 && nhip > 0) {
      const chan = chanToa(mau, t);
      for (let i = 0; i < chan.length; i++) {
        const a = chan[i], b = chan[(i + 1) % chan.length];
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / nhip));
        for (let k = 0; k < n; k++) {
          const p: Diem = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
          if (diemCot.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < nhip / 2)) continue;
          diemCot.push(p);
          cot.push(hcnXoay(p[0], p[1], cotRong, cotRong, t.gocDo));
        }
      }
    }
  }
  return { loi, cot };
}

/** Ram: theo toạ độ đã nhập, không thì tự đặt sát cạnh dài nhất của ranh hầm, cách đầu cạnh 2 m. Bề rộng gồm vỉa hè nếu có người đi. */
export function hinhRam(ranh: Diem[], ram: RamHam): { poly: Diem[]; x: number; y: number; gocDo: number } | null {
  const rong = ram.rong + (ram.coNguoiDi ? ram.viaHe : 0);
  if (ram.x !== null && ram.y !== null && ram.gocDo !== null) return { poly: hcnXoay(ram.x, ram.y, ram.dai, rong, ram.gocDo), x: ram.x, y: ram.y, gocDo: ram.gocDo };
  if (ranh.length < 3) return null;
  let i0 = 0, dai = -1;
  for (let i = 0; i < ranh.length; i++) {
    const a = ranh[i], b = ranh[(i + 1) % ranh.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > dai) { dai = l; i0 = i; }
  }
  const a = ranh[i0], b = ranh[(i0 + 1) % ranh.length];
  const u: Diem = [(b[0] - a[0]) / dai, (b[1] - a[1]) / dai];
  const trai = dtCoDau(ranh) > 0; // ngược kim đồng hồ: phần trong nằm bên trái cạnh
  const n: Diem = trai ? [-u[1], u[0]] : [u[1], -u[0]];
  const doc = 2 + ram.dai / 2;
  const x = a[0] + u[0] * doc + n[0] * (rong / 2), y = a[1] + u[1] * doc + n[1] * (rong / 2);
  const gocDo = Math.round(((Math.atan2(u[1], u[0]) * 180) / Math.PI) * 100) / 100;
  return { poly: hcnXoay(x, y, ram.dai, rong, gocDo), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, gocDo };
}

/* ---------- Dải chức năng (xe máy, kho, kỹ thuật) cắt theo trục dãy đỗ ---------- */

/** Phần ranh nằm trong dải u ∈ [u0, u1] của hệ trục xoay góc `goc`. */
function dai(ranh: Diem[], goc: number, u0: number, u1: number, v0: number, v1: number): Diem[][] {
  const c = Math.cos(goc), s = Math.sin(goc);
  const ve = (u: number, v: number): Diem => [u * c - v * s, u * s + v * c];
  return giao([ranh], [[ve(u0, v0), ve(u1, v0), ve(u1, v1), ve(u0, v1)]]);
}

/** Cắt dải bắt đầu tại u0 có diện tích ≈ dtMuc (tìm nhị phân). */
function catDai(ranh: Diem[], goc: number, u0: number, bb: [number, number, number, number], dtMuc: number): { u1: number; manh: Diem[][] } {
  if (!(dtMuc > 0) || u0 >= bb[2]) return { u1: u0, manh: [] };
  let lo = u0, hi = bb[2];
  if (dtHop(dai(ranh, goc, u0, hi, bb[1], bb[3])) <= dtMuc) return { u1: hi, manh: dai(ranh, goc, u0, hi, bb[1], bb[3]) };
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (dtHop(dai(ranh, goc, u0, m, bb[1], bb[3])) < dtMuc) lo = m;
    else hi = m;
  }
  return { u1: hi, manh: dai(ranh, goc, u0, hi, bb[1], bb[3]) };
}

/* ---------- Rải từng tầng ---------- */

export type KetQuaTangHam = {
  tang: number; // 1 = B1
  dtSan: number;
  cho: Diem[][];
  xeLan: Diem[][];
  lan: Diem[][];
  kho: Diem[][];
  xeMay: Diem[][];
  kyThuat: Diem[][];
  /** Chỗ sạc ô tô theo phân vùng (dự thảo SĐ 01:2026). */
  vungSac: Diem[][][];
  soCho: number; // gồm chỗ xe lăn
  soXeLan: number;
  soKho: number;
  dtOto: number; // DT khu ô tô gồm đường nội bộ, ram (đã trừ lõi, cột, dải khác)
  dtXeMay: number;
  dtKyThuat: number;
  dtLoi: number; // lõi + cột trong ranh
  dtSacOto: number; // ước DT khu sạc ô tô
};

export type YeuCauDoXe = { heSo: number; theoCan: number; theoDT: number; tong: number; xeMay: number; garaCoKhi: boolean };

/**
 * DT chỗ để xe yêu cầu theo QCVN 04:2021/BXD 2.2.17.1:
 * b) ≥ 25 m² / 4 căn nhưng ≥ 20 m² / 100 m² DT sử dụng căn, trong đó ≥ 6 m² xe máy, xe đạp mỗi căn;
 * c) NOXH, tái định cư, thu nhập thấp: lấy 60% định mức b) và vẫn ≥ 6 m² xe máy mỗi căn;
 * d) gara cơ khí: ≥ 12 m² / 100 m² DT sử dụng căn (ở đây cộng thêm phần xe máy 6 m²/căn).
 */
export function yeuCauDoXe(soCan: number, dtsd: number, noxh: boolean, garaCoKhi: boolean): YeuCauDoXe {
  const heSo = noxh ? 0.6 : 1;
  const theoCan = (heSo * 25 * soCan) / 4;
  const theoDT = heSo * 0.2 * dtsd;
  const xeMay = 6 * soCan;
  const tong = garaCoKhi ? 0.12 * dtsd + xeMay : Math.max(theoCan, theoDT, xeMay);
  return { heSo, theoCan, theoDT, tong, xeMay, garaCoKhi };
}

/** Số căn và DT sử dụng (thông thủy) căn của các tòa trên lô. */
export function canTrenLo(pa: TrangThaiPA, tv: ThuVien, loId: string): { soCan: number; dtsd: number } {
  const dem = demCan(pa, tv);
  let soCan = 0, dtsd = 0;
  for (const t of pa.toa) {
    if (t.loId !== loId) continue;
    soCan += Object.values(dem[t.id] ?? {}).reduce((a, b) => a + b, 0);
    const mau = tv.toa.get(t.mauId);
    if (!mau) continue;
    for (const [id, n] of canCuaToa(mau, t, tv)) dtsd += n * t.soTangDH * (tv.can.get(id)?.dt_tt_m2 ?? 0);
  }
  return { soCan, dtsd };
}

/* ---------- Phép kiểm ---------- */

export type KiemHam = {
  khoa: string;
  dat: number | null;
  mucTieu: number | null;
  chieu: '<=' | '>=';
  donVi: string;
  thapPhan: number;
  muc: MucDo;
  canCu: string;
  /** Theo dự thảo: chỉ cảnh báo, không tính là vượt. */
  duThao: boolean;
};

const SAT_NGUONG = 0.03; // như chiTieu.ts: trong 3% so với giới hạn thì cảnh báo

type TuyChonKiem = { donVi?: string; canCu: string; thapPhan?: number; duThao?: boolean; khongSat?: boolean };

/** Một dòng kiểm, màu theo quy ước MucDo của chiTieu.ts. `khongSat`: số đếm / số tầng, không cảnh báo sát ngưỡng. */
export function dongKiem(khoa: string, dat: number | null, mucTieu: number | null, chieu: '<=' | '>=', o: TuyChonKiem): KiemHam {
  const { donVi = '', canCu, thapPhan = 0, duThao = false } = o;
  let muc: MucDo = 'ok';
  if (dat !== null && mucTieu !== null && Number.isFinite(dat)) {
    const chenh = dat - mucTieu;
    const vuot = chieu === '<=' ? chenh > 1e-9 : chenh < -1e-9;
    const sat = !o.khongSat && Math.abs(chenh) <= Math.abs(mucTieu) * SAT_NGUONG;
    muc = vuot ? (duThao ? 'canh_bao' : 'vuot') : sat ? 'canh_bao' : 'ok';
  }
  return { khoa, dat, mucTieu, chieu, donVi, thapPhan, muc, canCu, duThao };
}

/** Độ dốc dọc tối đa (%) theo QCVN 13:2018/BXD 2.2.1.28 a). */
export const DOC_DOC_MAX: Record<LoaiRam, number> = { thang_mai: 18, cong: 13, ho: 10 };

/** Kiểm ram: dốc dọc = chiều cao tầng hầm / chiều dài ram (đỉnh ram ở cốt 0); dốc ngang ≤ 6%; vỉa hè ≥ 0,8 m khi có người đi bộ. */
export function kiemRam(ram: RamHam, caoTang: number): KiemHam[] {
  const QC = 'QCVN 13:2018/BXD 2.2.1.28';
  const kq = [
    dongKiem('ramDoc', ram.dai > 0 ? (caoTang / ram.dai) * 100 : null, DOC_DOC_MAX[ram.loai], '<=', { donVi: '%', canCu: `${QC} a)`, thapPhan: 1 }),
    dongKiem('ramNgang', ram.docNgang, 6, '<=', { donVi: '%', canCu: `${QC} b)`, thapPhan: 1 }),
  ];
  if (ram.coNguoiDi) kq.push(dongKiem('ramViaHe', ram.viaHe, 0.8, '>=', { donVi: 'm', canCu: `${QC} c)`, thapPhan: 2 }));
  return kq;
}

/**
 * Khu xe điện theo DỰ THẢO Sửa đổi 01:2026 QCVN 04:2021/BXD (chưa số hiệu, chưa hiệu lực) — chỉ cảnh báo:
 * 2.10.2.1 b) phân vùng sạc ở hầm ≤ 25 chỗ ô tô / ≤ 50 chỗ xe máy; 2.10.1.1 b), 2.10.2.1 b) giữa các khu cách ≥ 2 m
 * hoặc tường / vách không cháy cao ≥ 2 m; 2.10.2.1 f) khoang cháy khu sạc ô tô ở hầm ≤ 1 200 m²; g) xe máy ≤ 300 m²;
 * 2.11.1 b) khu đổi pin chỉ tới tầng hầm 1.
 */
export function kiemXeDien(xd: KhuXeDien, dtSacOto: number): KiemHam[] {
  const DT = 'Dự thảo SĐ 01:2026 QCVN 04:2021/BXD';
  const kq: KiemHam[] = [];
  if (xd.choOto > 0) {
    kq.push(dongKiem('xdVungOto', Math.min(xd.vungOto, xd.choOto), 25, '<=', { canCu: `${DT} 2.10.2.1 b)`, duThao: true, khongSat: true }));
    kq.push(dongKiem('xdKhoangOto', dtSacOto, 1200, '<=', { donVi: 'm²', canCu: `${DT} 2.10.2.1 f)`, duThao: true }));
  }
  if (xd.choXeMay > 0) {
    kq.push(dongKiem('xdVungXeMay', Math.min(xd.vungXeMay, xd.choXeMay), 50, '<=', { canCu: `${DT} 2.10.2.1 b)`, duThao: true, khongSat: true }));
    kq.push(dongKiem('xdKhoangXeMay', xd.choXeMay * xd.dtXeMayMoiCho, 300, '<=', { donVi: 'm²', canCu: `${DT} 2.10.2.1 g)`, duThao: true }));
  }
  if (xd.choOto > 0 || xd.choXeMay > 0) {
    // Có tường ngăn không cháy ≥ 2 m thì không cần khoảng cách: coi như đạt.
    kq.push(dongKiem('xdKhoangCach', xd.tuongNgan ? null : xd.khoangCach, 2, '>=', { donVi: 'm', canCu: `${DT} 2.10.1.1 b), 2.10.2.1 b)`, thapPhan: 1, duThao: true }));
  }
  if (xd.tuDoiPinTang !== null) kq.push(dongKiem('xdDoiPin', xd.tuDoiPinTang, 1, '<=', { canCu: `${DT} 2.11.1 b)`, duThao: true, khongSat: true }));
  return kq;
}

/* ---------- Toàn bộ hầm ---------- */

export type KetQuaHam = {
  ts: HamDayDu;
  ranh: Diem[];
  loi: Diem[][];
  cot: Diem[][];
  ram: { poly: Diem[]; x: number; y: number; gocDo: number } | null;
  tang: KetQuaTangHam[];
  soCan: number;
  dtsd: number;
  noxh: boolean;
  yeuCau: YeuCauDoXe;
  tong: { dtSan: number; soCho: number; soXeLan: number; soKho: number; dtOto: number; dtXeMay: number; dtKyThuat: number; dtLoi: number };
  /** Tỷ lệ đo được trên sàn hầm: đỗ xe (ô tô + xe máy, gồm đường nội bộ) và kỹ thuật (phòng kỹ thuật + lõi, cột). */
  tyLe: { doXe: number; kyThuat: number };
  kiem: KiemHam[];
};

/** Rải toàn bộ các tầng hầm dưới lô `lo` và kiểm. Ranh không hợp lệ thì null. */
export function raiHam(pa: TrangThaiPA, tv: ThuVien | null, lo: Lo): KetQuaHam | null {
  const ts = chuanHoaHam(pa.ham);
  const ranh = ranhHam(lo, ts);
  if (ranh.length < 3) return null;
  const { loi, cot } = tv ? loiCotTuToa(pa, tv, lo.id, ts.cotRong, ts.nhip) : { loi: [], cot: [] };
  const ram = hinhRam(ranh, ts.ram);
  const { soCan, dtsd } = tv ? canTrenLo(pa, tv, lo.id) : { soCan: 0, dtsd: 0 };
  const noxh = lo.temDat.chucNang === 'xh';
  const yeuCau = yeuCauDoXe(soCan, dtsd, noxh, ts.garaCoKhi);
  const dtSan = dtHop([ranh]);
  const loiCot = giao([ranh], [...loi, ...cot]);
  const dtLoi = dtHop(loiCot);
  const vatCan = [...loi, ...cot, ...(ram ? [ram.poly] : [])];

  const goc = gocCanhDaiNhat(ranh);
  const c = Math.cos(goc), s = Math.sin(goc);
  const uv = ranh.map(([x, y]) => [x * c + y * s, -x * s + y * c]);
  const bb: [number, number, number, number] = [
    Math.min(...uv.map((p) => p[0])), Math.min(...uv.map((p) => p[1])) - 1, Math.max(...uv.map((p) => p[0])), Math.max(...uv.map((p) => p[1])) + 1,
  ];
  const soTang = Math.max(1, Math.min(6, Math.round(ts.soTang)));
  const tangXeMay = Math.min(soTang, Math.max(1, Math.round(ts.tangXeMay)));
  const dtXeMayMuc = Math.min(ts.dtXeMay ?? yeuCau.xeMay, dtSan * 0.7);
  const sauKho = ts.rongKho > 0 ? ts.dtKho / ts.rongKho : 0;
  const tsKho = { choRong: ts.rongKho, choDai: sauKho, rongLan: ts.lanKho };

  const tang: KetQuaTangHam[] = [];
  for (let k = 1; k <= soTang; k++) {
    let u = bb[0];
    const xm = catDai(ranh, goc, u, bb, k === tangXeMay ? dtXeMayMuc : 0);
    u = xm.u1;
    // Dải kho: bắt đầu từ DT ước tính (ô kho + nửa hành lang, dư 25%), nới dần tới khi đủ số kho.
    let kh: { u1: number; manh: Diem[][] } = { u1: u, manh: [] };
    let kho: Diem[][] = [];
    if (ts.khoMoiTang > 0 && sauKho > 0) {
      let muc = Math.max(ts.khoMoiTang * ts.dtKho * (1 + ts.lanKho / (2 * sauKho)) * 1.25, ts.rongKho * 1.5 * (bb[3] - bb[1]));
      for (let lan = 0; lan < 10; lan++) {
        kh = catDai(ranh, goc, u, bb, muc);
        kho = [];
        for (const manh of kh.manh) {
          if (kho.length >= ts.khoMoiTang || dtCoDau(manh) <= 0) continue;
          kho.push(...raiChoDo(manh, vatCan, tsKho, { goc }).cho.slice(0, ts.khoMoiTang - kho.length));
        }
        if (kho.length >= ts.khoMoiTang || kh.u1 >= bb[2]) break;
        muc *= 1.3;
      }
    }
    u = kh.u1;
    const kt = catDai(ranh, goc, u, bb, ts.tyLeKyThuat * dtSan);
    const daiKhac = [...xm.manh, ...kh.manh, ...kt.manh];
    const r = raiChoDo(ranh, [...vatCan, ...daiKhac], ts, { soXeLan: ts.choXeLan, rongXeLan: 3.5, goc });
    const dtOto = dtTru([ranh], [...daiKhac, ...loi, ...cot]);
    const dtXeMay = dtTru(xm.manh, [...loi, ...cot]);
    const dtKyThuat = dtHop(kt.manh);
    // Khu sạc ô tô (dự thảo): lấy các chỗ xa dải xe máy / kho nhất, chia phân vùng.
    const vungSac: Diem[][][] = [];
    let dtSacOto = 0;
    const xd = ts.xeDien;
    if (xd.bat && xd.tang === k && xd.choOto > 0 && r.cho.length) {
      const uCua = (p: Diem[]) => p.reduce((a, q) => a + q[0] * c + q[1] * s, 0) / p.length;
      const chon = [...r.cho].sort((a, b) => uCua(b) - uCua(a)).slice(0, xd.choOto);
      const mo = Math.max(1, Math.round(xd.vungOto));
      for (let i = 0; i < chon.length; i += mo) vungSac.push(chon.slice(i, i + mo));
      dtSacOto = r.soCho > 0 ? (chon.length * dtOto) / r.soCho : 0;
    }
    tang.push({
      tang: k, dtSan, cho: r.cho, xeLan: r.xeLan, lan: r.lan, kho, xeMay: xm.manh, kyThuat: kt.manh, vungSac,
      soCho: r.soCho, soXeLan: r.xeLan.length, soKho: kho.length, dtOto, dtXeMay, dtKyThuat, dtLoi, dtSacOto,
    });
  }

  const cong = (f: (x: KetQuaTangHam) => number) => tang.reduce((a, x) => a + f(x), 0);
  const tong = {
    dtSan: cong((x) => x.dtSan), soCho: cong((x) => x.soCho), soXeLan: cong((x) => x.soXeLan), soKho: cong((x) => x.soKho),
    dtOto: cong((x) => x.dtOto), dtXeMay: cong((x) => x.dtXeMay), dtKyThuat: cong((x) => x.dtKyThuat), dtLoi: cong((x) => x.dtLoi),
  };
  const tyLe = tong.dtSan > 0
    ? { doXe: (tong.dtOto + tong.dtXeMay) / tong.dtSan, kyThuat: (tong.dtKyThuat + tong.dtLoi) / tong.dtSan }
    : { doXe: 0, kyThuat: 0 };

  const ct = lo.temDat.chiTieu;
  const QC04 = 'QCVN 04:2021/BXD';
  const QC13 = 'QCVN 13:2018/BXD';
  const kiem: KiemHam[] = [
    dongKiem('dtDoXe', soCan ? tong.dtOto + tong.dtXeMay : null, soCan ? yeuCau.tong : null, '>=', { donVi: 'm²', canCu: `${QC04} 2.2.17.1 ${ts.garaCoKhi ? 'd)' : noxh ? 'b), c)' : 'b)'}` }),
    dongKiem('dtXeMay', soCan ? tong.dtXeMay : null, soCan ? yeuCau.xeMay : null, '>=', { donVi: 'm²', canCu: `${QC04} 2.2.17.1 b)` }),
    dongKiem('choOto', soCan ? tong.soCho : null, soCan ? Math.ceil(soCan * ct.choDoOtoMoiCan) : null, '>=', { canCu: 'QH' }),
    dongKiem('xeLan', tong.soXeLan, 1, '>=', { canCu: `${QC04} 2.2.17.3`, khongSat: true }),
    dongKiem('choDai', ts.choDai, 5, '>=', { donVi: 'm', canCu: `${QC13} 2.2.1.25`, thapPhan: 2 }),
    dongKiem('choRong', ts.choRong, 2.3, '>=', { donVi: 'm', canCu: `${QC13} 2.2.1.25`, thapPhan: 2 }),
    dongKiem('thongThuy', ts.caoTang - ts.dayKetCau, 2, '>=', { donVi: 'm', canCu: `${QC04} 2.2.10`, thapPhan: 2 }),
    ...kiemRam(ts.ram, ts.caoTang),
    ...(ts.xeDien.bat ? kiemXeDien(ts.xeDien, tang.find((x) => x.tang === ts.xeDien.tang)?.dtSacOto ?? 0) : []),
  ];
  return { ts, ranh, loi, cot, ram, tang, soCan, dtsd, noxh, yeuCau, tong, tyLe, kiem };
}
