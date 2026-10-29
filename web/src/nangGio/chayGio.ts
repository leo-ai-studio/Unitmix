/**
 * Điều phối phân tích gió mức đi bộ: tải hoa gió (Open-Meteo), mô phỏng LBM 2D trên GPU cho 8 hướng gió (mỗi 45°, máy cảm ứng lưới thô hơn),
 * mỗi khung chỉ xếp một nhóm bước GPU (tự giảm khi khung chậm), đọc kết quả không chặn (PBO + fence), rồi ghép các hướng thành hệ số
 * tăng tốc theo 16 hướng và lớp tiện nghi Lawson trên lưới bản vẽ. Hiện dần sau mỗi hướng; huỷ được bất cứ lúc nào.
 */
import type { Diem, ThuVien, TrangThaiPA } from '../tinh/kieu';
import { heSoCaoDiBo, huongChuDao, lopTienNghi, SO_HUONG, vuotTheoHuong, type PhanBoGio } from '../tinh/nangGio/gio';
import { khungBao, taoLuoi, toDaGiac } from '../tinh/nangGio/gioNang';
import { khoiPA, khungPA } from '../tinh/nangGio/khoiPA';
import { viTriPA } from '../tinh/viTri';
import { datNG, layNG, mayYeu, type KetQuaGio } from './kho';
import { taoBoGiai, type BoGiai } from './lbm';
import { taiPhanBoGio } from './taiGio';

let luot = 0;
let dangGiai: BoGiai | null = null;
let hamHuy: AbortController | null = null;

export function huyGio(): void {
  luot++;
  dangGiai?.huy(); dangGiai = null;
  hamHuy?.abort(); hamHuy = null;
  const g = layNG().gio;
  if (g.dang || g.dangTai) datNG({ gio: { ...g, dang: false, dangTai: false } });
}

/** Tải hoa gió (nhớ theo vị trí). */
export async function taiHoaGio(pa: TrangThaiPA): Promise<PhanBoGio | null> {
  const vt = viTriPA(pa);
  hamHuy?.abort(); hamHuy = new AbortController();
  datNG((t) => ({ gio: { ...t.gio, dangTai: true, loiTai: '' } }));
  try {
    const p = await taiPhanBoGio(vt.lat, vt.lng, hamHuy.signal);
    datNG((t) => ({ gio: { ...t.gio, phanBo: p, dangTai: false } }));
    return p;
  } catch (e) {
    if ((e as Error).name !== 'AbortError') datNG((t) => ({ gio: { ...t.gio, dangTai: false, loiTai: String((e as Error).message ?? e) } }));
    return null;
  }
}

const khung = () => new Promise<number>((ok) => requestAnimationFrame(ok));

/** Hệ trục lưới LBM cho gió thổi TỪ hướng `tu` (° từ Bắc thật): trục x lưới = chiều gió đi trên bản vẽ. */
export function heTrucGio(tu: number, gocBac: number, c: Diem, dx: number, N: number) {
  const a = ((tu + 180 - gocBac) * Math.PI) / 180, f: Diem = [Math.sin(a), Math.cos(a)], v: Diem = [-f[1], f[0]];
  const ox = 0.4 * N, oy = 0.5 * N;
  return {
    sangLuoi: (p: Diem): Diem => { const x = p[0] - c[0], y = p[1] - c[1]; return [(x * f[0] + y * f[1]) / dx + ox, (x * v[0] + y * v[1]) / dx + oy]; },
    sangVe: (l: Diem): Diem => [c[0] + ((l[0] - ox) * f[0] + (l[1] - oy) * v[0]) * dx, c[1] + ((l[0] - ox) * f[1] + (l[1] - oy) * v[1]) * dx],
    f, v,
  };
}

export async function chayGio(pa: TrangThaiPA, tv: ThuVien): Promise<void> {
  huyGio();
  const ma = ++luot;
  const conChay = () => ma === luot;
  const p = layNG().gio.phanBo ?? (await taiHoaGio(pa));
  if (!conChay()) return;
  if (!p) { datNG((t) => ({ gio: { ...t.gio, loi: 'khongSoLieu' } })); return; }
  const vt = viTriPA(pa), khoi = khoiPA(pa, tv).filter((k) => k.z0 < 1.5);
  const diem = khungPA(pa, khoiPA(pa, tv));
  if (!diem.length || !khoi.length) { datNG((t) => ({ gio: { ...t.gio, loi: 'khongKhoi' } })); return; }
  const yeu = mayYeu(), N = yeu ? 128 : 256;
  const kb = khungBao(diem), c: Diem = [(kb[0] + kb[2]) / 2, (kb[1] + kb[3]) / 2];
  const D = Math.max(60, Math.hypot(kb[2] - kb[0], kb[3] - kb[1]));
  const dx = D / (0.5 * N);
  const luoi = taoLuoi(kb, Math.min(60, D * 0.15), yeu ? 20_000 : 60_000, 1.5);
  const nO = luoi.nx * luoi.ny;
  // ô lưới kết quả nằm trong khối (đi bộ không tới) → NaN
  const trong = new Uint8Array(nO);
  for (const k of khoi) toDaGiac(k.chan, luoi, (i) => { trong[i] = 1; });
  const tam = (i: number): Diem => [luoi.x0 + ((i % luoi.nx) + 0.5) * luoi.buoc, luoi.y0 + (Math.floor(i / luoi.nx) + 0.5) * luoi.buoc];
  const HUONG_MP = [0, 45, 90, 135, 180, 225, 270, 315];
  const tongBuoc = Math.round((2.2 * N) / 0.08), batDauCong = Math.round(tongBuoc * 0.55);
  const kMP: Float32Array[] = [];
  const vMP: { u: Float32Array; tr: ReturnType<typeof heTrucGio> }[] = [];
  const chuDao = huongChuDao(p)[0]?.i ?? 0;
  const huongXem = Math.round((chuDao * 22.5) / 45) % 8; // hướng mô phỏng gần hướng chủ đạo
  const thuTu = [huongXem, ...HUONG_MP.map((_, i) => i).filter((i) => i !== huongXem)]; // hướng chủ đạo trước — hiện kết quả sớm
  const kq: KetQuaGio = { luoi, lop: new Uint8Array(nO).fill(255), k: new Float32Array(nO).fill(NaN), kHuong: [], huongXem: huongXem * 2, dong: [], daXong: 0, tong: HUONG_MP.length };
  datNG((t) => ({ lop: 'gio', gio: { ...t.gio, dang: true, loi: '', kq: { ...kq } } }));
  // một bộ giải cho cả 8 hướng (shader dịch một lần, song song nếu trình duyệt hỗ trợ)
  let bg: BoGiai | null;
  try { bg = taoBoGiai(N); if (bg) { dangGiai = bg; await bg.sanSang(); } } catch (e) { datNG((t) => ({ gio: { ...t.gio, dang: false, loi: String((e as Error).message) } })); return; }
  if (!bg) { datNG((t) => ({ gio: { ...t.gio, dang: false, loi: 'khongWebGL2' } })); return; }
  if (!conChay()) return;
  for (const iH of thuTu) {
    if (!conChay()) return;
    const tr = heTrucGio(HUONG_MP[iH], vt.gocBac, c, dx, N);
    const mask = new Uint8Array(N * N);
    for (const k of khoi) toDaGiac(k.chan.map(tr.sangLuoi), { x0: 0, y0: 0, buoc: 1, nx: N, ny: N }, (i) => { mask[i] = 1; });
    bg.batDau(mask);
    let da = 0, moiKhung = yeu ? 20 : 60, t0 = performance.now();
    while (da < tongBuoc) {
      if (!conChay()) return;
      const n = Math.min(moiKhung, tongBuoc - da);
      bg.chay(n, da >= batDauCong);
      da += n;
      const t1 = await khung();
      const dt = t1 - t0; t0 = t1;
      // khung > 40 ms (GPU nghẽn): bớt bước; khung nhanh: thêm (trần 200)
      moiKhung = dt > 40 ? Math.max(5, Math.round(moiKhung * 0.7)) : dt < 20 ? Math.min(200, Math.round(moiKhung * 1.15) + 1) : moiKhung;
    }
    let tb: Float32Array;
    try { tb = await bg.doc(); } catch (e) { datNG((t) => ({ gio: { ...t.gio, dang: false, loi: String((e as Error).message) } })); return; }
    if (!conChay()) return;
    // vận tốc trung bình (đơn vị lưới) → hệ số K = tốc độ TB / U0 trên lưới bản vẽ (nội suy song tuyến)
    const u = new Float32Array(N * N * 2), sp = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) {
      const n = tb[i * 4 + 3];
      if (n > 0 && !mask[i]) { u[i * 2] = tb[i * 4] / n; u[i * 2 + 1] = tb[i * 4 + 1] / n; sp[i] = tb[i * 4 + 2] / n / bg.U0; } else sp[i] = NaN;
    }
    const kO = new Float32Array(nO);
    for (let i = 0; i < nO; i++) {
      if (trong[i]) { kO[i] = NaN; continue; }
      const [lx, ly] = tr.sangLuoi(tam(i));
      kO[i] = noiSuy(sp, N, lx - 0.5, ly - 0.5);
    }
    kMP[iH] = kO; vMP[iH] = { u, tr };
    kq.daXong++;
    if (iH === huongXem) { kq.k = kO; kq.dong = duongDong(u, mask, N, tr); }
    // hiện dần: hệ số K của hướng đang xem ngay khi xong; lớp tiện nghi khi đủ 8 hướng
    datNG((t) => ({ gio: { ...t.gio, kq: { ...kq } } }));
    await khung();
  }
  bg.huy(); dangGiai = null;
  if (!conChay()) return;
  // 16 hướng: hướng chẵn = mô phỏng, hướng lẻ = trung bình hai hướng kề
  const kHuong: Float32Array[] = [];
  for (let s = 0; s < SO_HUONG; s++) {
    if (s % 2 === 0) { kHuong[s] = kMP[s / 2]; continue; }
    const a = kMP[(s - 1) / 2], b = kMP[((s + 1) / 2) % 8], m = new Float32Array(nO);
    for (let i = 0; i < nO; i++) m[i] = (a[i] + b[i]) / 2;
    kHuong[s] = m;
  }
  const vuot = vuotTheoHuong(p), hs = heSoCaoDiBo();
  const kh = new Float32Array(SO_HUONG);
  // tính lớp theo từng khúc, nhường luồng chính giữa các khúc (không tác vụ dài > 50 ms)
  for (let i0 = 0; i0 < nO; i0 += 1500) {
    if (!conChay()) return;
    for (let i = i0; i < Math.min(nO, i0 + 1500); i++) {
      if (trong[i] || !Number.isFinite(kHuong[0][i])) continue;
      for (let s = 0; s < SO_HUONG; s++) kh[s] = kHuong[s][i];
      kq.lop[i] = lopTienNghi(kh, vuot, hs).lop;
    }
    await new Promise((ok) => setTimeout(ok, 0));
  }
  kq.kHuong = kHuong;
  datNG((t) => ({ gio: { ...t.gio, dang: false, kq: { ...kq } } }));
  // giữ trường vận tốc để vẽ đường dòng khi đổi hướng xem
  truongV = vMP.map((x, i) => ({ ...x, mask: maskCua(x.tr, khoi, N), i }));
}

let truongV: { u: Float32Array; tr: ReturnType<typeof heTrucGio>; mask: Uint8Array }[] = [];
const maskCua = (tr: ReturnType<typeof heTrucGio>, khoi: { chan: Diem[] }[], N: number) => {
  const m = new Uint8Array(N * N);
  for (const k of khoi) toDaGiac(k.chan.map(tr.sangLuoi), { x0: 0, y0: 0, buoc: 1, nx: N, ny: N }, (i) => { m[i] = 1; });
  return m;
};

/** Đổi hướng xem (16 phương): K + đường dòng của hướng đó (hướng lẻ: đường dòng của hướng mô phỏng gần nhất). */
export function xemHuong(s: number): void {
  const g = layNG().gio, kq = g.kq;
  if (!kq || kq.kHuong.length !== SO_HUONG) return;
  const v = truongV[Math.round(s / 2) % 8];
  const N = v ? Math.round(Math.sqrt(v.mask.length)) : 0;
  datNG({ gio: { ...g, kq: { ...kq, huongXem: s, k: kq.kHuong[s], dong: v ? duongDong(v.u, v.mask, N, v.tr) : [] } } });
}

function noiSuy(a: Float32Array, N: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x > N - 1 || y > N - 1) return 1;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(N - 1, x0 + 1), y1 = Math.min(N - 1, y0 + 1), fx = x - x0, fy = y - y0;
  const v = [a[y0 * N + x0], a[y0 * N + x1], a[y1 * N + x0], a[y1 * N + x1]], w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  let s = 0, ws = 0;
  for (let i = 0; i < 4; i++) if (Number.isFinite(v[i])) { s += v[i] * w[i]; ws += w[i]; }
  return ws > 0 ? s / ws : NaN;
}

/** Đường dòng từ biên gió vào (RK2 trên trường vận tốc trung bình), đổi về toạ độ bản vẽ. */
function duongDong(u: Float32Array, mask: Uint8Array, N: number, tr: ReturnType<typeof heTrucGio>): Diem[][] {
  const kq: Diem[][] = [];
  const v = (x: number, y: number): [number, number] | null => {
    const i = Math.floor(y) * N + Math.floor(x);
    if (x < 0 || y < 0 || x >= N || y >= N || mask[i]) return null;
    return [u[i * 2], u[i * 2 + 1]];
  };
  for (let s = 0.12; s < 0.9; s += 0.035) {
    let x = 0.15 * N, y = s * N;
    const d: Diem[] = [tr.sangVe([x, y])];
    for (let k = 0; k < N * 3; k++) {
      const a = v(x, y); if (!a) break;
      const la = Math.hypot(a[0], a[1]); if (la < 1e-4) break;
      const xm = x + (0.5 * a[0]) / la, ym = y + (0.5 * a[1]) / la, b = v(xm, ym); if (!b) break;
      const lb = Math.hypot(b[0], b[1]); if (lb < 1e-4) break;
      x += b[0] / lb; y += b[1] / lb;
      if (k % 3 === 2) d.push(tr.sangVe([x, y]));
      if (x > 0.92 * N) break;
    }
    if (d.length > 3) kq.push(d);
  }
  return kq;
}
