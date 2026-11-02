import ClipperLib from 'clipper-lib';
import type { Diem, ToaDat, ToaMau } from './kieu';

/* Hình học phẳng bằng Clipper (số nguyên mm, ổn định khi cắt/nở đa giác). Toạ độ vào/ra tính bằng mét. */
type Path = ClipperLib.IntPoint[];
const TL = 1000; // m -> mm

/* Toạ độ dự án (VN2000) cỡ 10^6 m = 10^9 mm vượt giới hạn int32 của Clipper → nó rơi sang đường BigInteger (chậm ~20×).
   Mỗi phép tính dời gốc về mét nguyên gần vùng đang làm (`datGoc`) rồi cộng lại khi ra; kết quả giữ nguyên đến 1e-9 m. */
let OX = 0;
let OY = 0;
const datGoc = (p?: Diem[]) => { OX = p?.length ? Math.round(p[0][0]) : 0; OY = p?.length ? Math.round(p[0][1]) : 0; };
const toPath = (p: Diem[]): Path => p.map(([x, y]) => ({ X: Math.round((x - OX) * TL), Y: Math.round((y - OY) * TL) }));
const toDiem = (p: Path): Diem[] => p.map((q) => [(q.X + OX * TL) / TL, (q.Y + OY * TL) / TL]);

/** Diện tích đa giác (shoelace), luôn dương. */
export function dienTich(poly: Diem[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

function chay(loai: number, a: Path[], b: Path[] = []): Path[] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  if (b.length) c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  const kq: Path[] = [];
  c.Execute(loai, kq, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return kq;
}

const hop = (a: Path[]) => chay(ClipperLib.ClipType.ctUnion, a);
const tru = (a: Path[], b: Path[]) => chay(ClipperLib.ClipType.ctDifference, a, b);
const giao = (a: Path[], b: Path[]) => chay(ClipperLib.ClipType.ctIntersection, a, b);

/** Nở (d > 0) hoặc co (d < 0) vùng d mét, góc vuông (miter). */
function offset(paths: Path[], d: number): Path[] {
  if (Math.abs(d) < 1e-9) return paths;
  const o = new ClipperLib.ClipperOffset(4, 0.25 * TL);
  o.AddPaths(paths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const kq: Path[] = [];
  o.Execute(kq, d * TL);
  return kq;
}

/** Diện tích vùng (lỗ thủng có hướng ngược nên tự trừ). */
const dtPaths = (ps: Path[]): number => ps.reduce((a, p) => a + ClipperLib.Clipper.Area(p), 0) / (TL * TL);

/** Diện tích một vùng do khoiDe trả về (gồm cả lỗ thủng). */
export const dtVung = (vung: Diem[][]): number => { datGoc(vung[0]); return dtPaths(vung.map(toPath)); };

/** Diện tích phần hợp (không cộng trùng phần chồng). */
export function hopDienTich(polys: Diem[][]): number {
  datGoc(polys.find((p) => p.length >= 3));
  const ps = polys.filter((p) => p.length >= 3).map(toPath);
  return ps.length ? dtPaths(hop(ps)) : 0;
}

/** `poly` nằm trọn trong `vung` (phần chờm ra ngoài dưới 0,01 m²). */
export const namTrong = (poly: Diem[], vung: Diem[]): boolean => {
  if (poly.length < 3 || vung.length < 3) return false;
  datGoc(poly);
  return dtPaths(tru([toPath(poly)], [toPath(vung)])) < 0.01;
};

/** Trọng tâm diện tích của đa giác (đa giác suy biến thì lấy trung bình đỉnh). */
export function trongTam(poly: Diem[]): Diem {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const k = x1 * y2 - x2 * y1;
    a += k;
    cx += (x1 + x2) * k;
    cy += (y1 + y2) * k;
  }
  if (Math.abs(a) < 1e-9) return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
  return [cx / (3 * a), cy / (3 * a)];
}

export function xoayTinhTien(poly: Diem[], x: number, y: number, gocDo: number): Diem[] {
  const a = (gocDo * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return poly.map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]);
}

/**
 * Chân tháp của một tòa trên lô (m): đường bao mẫu, tâm khung bao về gốc, xoay rồi dời tới (x, y). Tòa có nét bao riêng
 * (`toa.duongBao`: dãy dài ra / ngắn lại — QT-69, PC-11) thì dùng nét đó, vẫn lấy tâm theo nét bao MẪU để tòa không xê dịch trên lô.
 */
export function chanToa(mau: ToaMau, toa: ToaDat): Diem[] {
  const xs = mau.duong_bao.map((p) => p[0]), ys = mau.duong_bao.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const bao = toa.duongBao && toa.duongBao.length >= 3 ? toa.duongBao : mau.duong_bao;
  const m = bao.map(([px, py]) => [((toa.lat ? -1 : 1) * (px - cx)) / 1000, (py - cy) / 1000] as Diem);
  // lật: đảo thứ tự đỉnh để giữ chiều vòng như nét bao gốc
  return xoayTinhTien(toa.lat ? m.reverse() : m, toa.x, toa.y, toa.gocDo);
}

/**
 * Khối đế trên một lô: hợp các chân tháp nở theo deOffset từng tòa, rồi lấp khe hẹp hơn nguongKhe (m) giữa các khối.
 * Chỉ thêm phần "cầu" chạm từ hai khối trở lên, nên góc lõm của riêng một tòa giữ nguyên diện tích.
 * Kết quả gồm cả đường lỗ thủng (hướng ngược); đo bằng dtVung.
 */
const BO_NHO_DE = new Map<string, Diem[][]>();
/** Nhớ theo nội dung đầu vào (mỗi lần kéo tòa chỉ lô có tòa đó đổi; các lô còn lại lấy từ bộ nhớ, ~10 → ~2 ms). Kết quả chỉ đọc. */
export function khoiDe(chan: Diem[][], deOffset: number[], nguongKhe = 6): Diem[][] {
  const khoa = `${nguongKhe}|${deOffset.join(',')}|${chan.map((p) => p.map((q) => `${q[0]},${q[1]}`).join(' ')).join(';')}`;
  const co = BO_NHO_DE.get(khoa);
  if (co) return co;
  const kq = khoiDeTinh(chan, deOffset, nguongKhe);
  if (BO_NHO_DE.size >= 96) BO_NHO_DE.delete(BO_NHO_DE.keys().next().value as string);
  BO_NHO_DE.set(khoa, kq);
  return kq;
}

function khoiDeTinh(chan: Diem[][], deOffset: number[], nguongKhe: number): Diem[][] {
  datGoc(chan.find((p) => p.length >= 3));
  const khoi = chan.flatMap((p, i) => (p.length >= 3 ? offset([toPath(p)], deOffset[i] ?? 0) : []));
  if (!khoi.length) return [];
  let goc = hop(khoi);
  const ngoai = () => goc.filter((p) => ClipperLib.Clipper.Orientation(p));
  const k = nguongKhe / 2;
  if (ngoai().length > 1 && k > 0) {
    const phanThem = tru(offset(offset(goc, k), -k), goc);
    const thanhPhan = ngoai();
    const cau = phanThem.filter((manh) => {
      const vienManh = offset([manh], 0.05);
      return thanhPhan.filter((g) => giao(vienManh, [g]).length > 0).length >= 2;
    });
    if (cau.length) goc = hop([...goc, ...cau]);
  }
  return goc.map(toDiem);
}

/** Hợp nhiều vùng (mỗi vùng = các vòng; vòng ngoài ngược chiều kim đồng hồ, lỗ thuận chiều) → vùng mới. */
export const hopVung = (vung: Diem[][]): Diem[][] => { datGoc(vung.find((p) => p.length >= 3)); return hop(vung.filter((p) => p.length >= 3).map(toPath)).map(toDiem); };
/** Phần chung của vùng `a` với vùng `b`. */
export const giaoVung = (a: Diem[][], b: Diem[][]): Diem[][] => { datGoc(a.find((p) => p.length >= 3) ?? b.find((p) => p.length >= 3)); return giao(a.filter((p) => p.length >= 3).map(toPath), b.filter((p) => p.length >= 3).map(toPath)).map(toDiem); };
/** Diện tích CÓ DẤU của một vòng (dương = vòng ngoài, ngược chiều kim đồng hồ khi y hướng lên). */
export function dtCoDau(poly: Diem[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; s += x1 * y2 - x2 * y1; }
  return s / 2;
}

/** Số khối liền (đường bao ngoài) của một vùng. */
export const soKhoi = (vung: Diem[][]): number => vung.map(toPath).filter((p) => ClipperLib.Clipper.Orientation(p)).length;
