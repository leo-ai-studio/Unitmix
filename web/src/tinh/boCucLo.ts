/**
 * Xếp tòa trong lô theo bố cục (docs/hoc_xep_lo.md). Hai chế độ:
 * - `sap_lai`: giữ đúng các tòa đang có trên lô (mẫu, số tầng, căn đã sửa), chỉ đổi vị trí và góc theo quy tắc. Tòa khoá đứng yên.
 * - `to_hop`: tự chọn tổ hợp mẫu × số tòa sát DTXD tối đa và cơ cấu mục tiêu rồi xếp theo cùng quy tắc.
 *
 * Quy tắc xếp là hình học thuần, chạy được hàng trăm bố cục trong vài giây: dãy song song theo trục (1–3 dãy, cạnh chính của lô hoặc trục Đông–Tây
 * đón nắng Nam), so le, bám viền quanh sân. Mọi bố cục chấm năm tiêu chí 0–100 (`DiemBoCuc`), chỉ nhóm tốt nhất mới tính chỉ tiêu và view đầy đủ.
 */
import { tinhChiTieu } from './chiTieu';
import { coCauRong, diemLechCoCau, phanTram } from './coCau';
import { chanToa, dienTich, hopDienTich } from './hinhHoc';
import { BoDemView, boiCanhView, caiDatView, tongHopView, datMatCan, viewXoayMau, type ToaView } from './huongView';
import { taoToaTrenLo, vungDat } from './hopLo';
import type { Diem, LoaiCan, ToaDat, ToaMau } from './kieu';
import { canCaToa, coMat, type ToaCoMat } from './matBang';
import { chieuCaoPCCC, thoatNan, type ToaPCCC } from './pccc';
import { sucChua } from './sucChua';
import {
  canhChinh, duLuiTungCanh, duXaDaGiac, kcDaGiac, kcToa261, kcToiDoan, luiTungCanh, namTrongNhanh, rongCanh, trongDaGiac,
  type DauVaoXep, type DiemBoCuc, type GoiYXep, type KieuBoCuc, type UuTienXep,
} from './xepToa';

/** Gió chủ đạo mùa hè Bắc Bộ: từ Đông Nam. Hằng số quy ước, chưa đọc hoa gió thật của dự án. */
export const PHUONG_VI_GIO_HE = 135;
/** Sân tập trung: phần đất liền mảnh cách tòa ≥ 12 m, cách ranh lô ≥ 3 m (chừa đường nội bộ, hè và bóng sát chân tòa). */
const CACH_TOA_SAN = 12, CACH_RANH_SAN = 3;
/** Điểm sân: nửa theo diện tích mảnh sân liền (đủ 40 % lô = 100), nửa theo vòng tròn trống lớn nhất (bán kính 45 m = 100). */
const diemSan = (m2: number, r: number, dtLo: number) => 50 * Math.min(1, m2 / (0.4 * dtLo)) + 50 * Math.min(1, r / 45);
/** Điểm gió: 50 % bề ngang lô có gió xuyên thẳng = 100. */
const diemGio = (pct: number) => Math.min(100, pct * 2);
const TRONG_SO: Record<UuTienXep, Record<'nang' | 'gio' | 'view' | 'mat' | 'san', number>> = {
  can_bang: { nang: 25, gio: 20, view: 20, mat: 15, san: 20 },
  nang: { nang: 60, gio: 10, view: 10, mat: 10, san: 10 },
  gio: { nang: 10, gio: 60, view: 10, mat: 10, san: 10 },
  view: { nang: 10, gio: 10, view: 60, mat: 10, san: 10 },
  mat_pho: { nang: 10, gio: 10, view: 10, mat: 60, san: 10 },
  san: { nang: 10, gio: 10, view: 10, mat: 10, san: 60 },
};
const CAO_DE = 4.5, CAO_DH = 3.3, RAD = Math.PI / 180;

/** Tòa cần đặt: mẫu + tòa gốc (giữ số tầng, căn đã sửa) + trục dài của mẫu ở góc 0. */
type Goi = { mau: ToaMau; goc: ToaDat; truc: number };
type Dat = { goi: Goi; x: number; y: number; g: number; F: Diem[]; r: number };
type Khung = { u: Diem; n: Diem };
type BoCuc = { kieu: KieuBoCuc; ho: string; dat: Dat[]; diem: Omit<DiemBoCuc, 'view' | 'tong'> & { tam: number } };

const cham2 = (a: Diem, b: Diem) => a[0] * b[0] + a[1] * b[1];
const chuanGoc = (g: number) => Math.round((((g % 360) + 360) % 360) * 10) / 10;
const khung = (goc: number): Khung => { const c = Math.cos(goc * RAD), s = Math.sin(goc * RAD); return { u: [c, s], n: [-s, c] }; };

/** Trục dài của chân tòa ở góc 0 (độ), theo thành phần chính của các đỉnh. */
export function trucDai(F: Diem[]): number {
  const cx = F.reduce((s, p) => s + p[0], 0) / F.length, cy = F.reduce((s, p) => s + p[1], 0) / F.length;
  let xx = 0, yy = 0, xy = 0;
  for (const p of F) { const x = p[0] - cx, y = p[1] - cy; xx += x * x; yy += y * y; xy += x * y; }
  return (0.5 * Math.atan2(2 * xy, xx - yy)) / RAD;
}

/** Mọi cách chia n tòa thành 1–3 dãy (dãy nhiều tòa quá so với bề dài bị loại lúc đặt). */
export function chiaDay(n: number): number[][] {
  const kq: number[][] = [[n]];
  for (let a = 1; a < n; a++) kq.push([a, n - a]);
  for (let a = 1; a < n - 1; a++) for (let b = 1; a + b < n; b++) kq.push([a, b, n - a - b]);
  return kq;
}

/** Lưới sân: mặt nạ ô trong lô + khoảng cách tới ranh; giữ một lần cho mọi bố cục. */
function taoLuoiSan(R: Diem[]) {
  const xs = R.map((p) => p[0]), ys = R.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
  const W = Math.max(...xs) - x0, H = Math.max(...ys) - y0, o = Math.max(4, Math.sqrt((W * H) / 3000));
  const cot = Math.ceil(W / o) + 1, hang = Math.ceil(H / o) + 1, N = cot * hang;
  const trong = new Uint8Array(N);
  for (let j = 0; j < hang; j++) for (let i = 0; i < cot; i++) if (trongDaGiac([x0 + i * o, y0 + j * o], R)) trong[i + j * cot] = 1;
  const quet = (d: Float32Array) => {
    const c2 = Math.SQRT2;
    for (let j = 0; j < hang; j++) for (let i = 0; i < cot; i++) {
      const k = i + j * cot; let v = d[k];
      if (i) v = Math.min(v, d[k - 1] + 1);
      if (j) { v = Math.min(v, d[k - cot] + 1); if (i) v = Math.min(v, d[k - cot - 1] + c2); if (i < cot - 1) v = Math.min(v, d[k - cot + 1] + c2); }
      d[k] = v;
    }
    for (let j = hang - 1; j >= 0; j--) for (let i = cot - 1; i >= 0; i--) {
      const k = i + j * cot; let v = d[k];
      if (i < cot - 1) v = Math.min(v, d[k + 1] + 1);
      if (j < hang - 1) { v = Math.min(v, d[k + cot] + 1); if (i < cot - 1) v = Math.min(v, d[k + cot + 1] + c2); if (i) v = Math.min(v, d[k + cot - 1] + c2); }
      d[k] = v;
    }
  };
  const ranh = new Float32Array(N);
  for (let k = 0; k < N; k++) ranh[k] = trong[k] ? 1e6 : 0;
  quet(ranh);
  const d = new Float32Array(N), seen = new Uint8Array(N), hd: number[] = [];
  /** Diện tích (m²) mảnh sân liền lớn nhất và bán kính vòng tròn trống lớn nhất (m). */
  const do_ = (ds: Diem[][]) => {
    d.fill(1e6);
    for (const F of ds) {
      const fx = F.map((p) => p[0]), fy = F.map((p) => p[1]);
      const i0 = Math.max(0, Math.floor((Math.min(...fx) - x0) / o)), i1 = Math.min(cot - 1, Math.ceil((Math.max(...fx) - x0) / o));
      const j0 = Math.max(0, Math.floor((Math.min(...fy) - y0) / o)), j1 = Math.min(hang - 1, Math.ceil((Math.max(...fy) - y0) / o));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (trongDaGiac([x0 + i * o, y0 + j * o], F)) d[i + j * cot] = 0;
    }
    quet(d);
    seen.fill(0);
    const canToa = CACH_TOA_SAN / o, canRanh = CACH_RANH_SAN / o;
    let lon = 0, r = 0;
    for (let k = 0; k < N; k++) {
      if (!trong[k]) continue;
      r = Math.max(r, Math.min(d[k], ranh[k]));
      if (seen[k] || d[k] < canToa || ranh[k] < canRanh) continue;
      let dem = 0; hd.length = 0; hd.push(k); seen[k] = 1;
      while (hd.length) {
        const q = hd.pop()!; dem++;
        const i = q % cot;
        for (const m of [i ? q - 1 : -1, i < cot - 1 ? q + 1 : -1, q - cot, q + cot]) {
          if (m < 0 || m >= N || seen[m] || !trong[m] || d[m] < canToa || ranh[m] < canRanh) continue;
          seen[m] = 1; hd.push(m);
        }
      }
      if (dem > lon) lon = dem;
    }
    return { m2: lon * o * o, r: r * o };
  };
  return { do: do_ };
}

/**
 * Phần trăm bề ngang lô gió xuyên qua không vướng tòa: chiếu chân tòa lên phương vuông góc gió, lấy phần hợp bị che.
 * Dãy song song hướng gió tạo hành lang gió nên điểm cao; dãy chắn ngang gió điểm thấp.
 */
export function gioXuyen(R: Diem[], ds: Diem[][], phuongViGio: number, gocBac = 0): number {
  const a = (90 - phuongViGio + gocBac) * RAD, p: Diem = [-Math.sin(a), Math.cos(a)];
  const cL = R.map((q) => cham2(q, p)), rong = Math.max(...cL) - Math.min(...cL);
  if (rong <= 0) return 0;
  const doan = ds.map((F) => { const c = F.map((q) => cham2(q, p)); return [Math.min(...c), Math.max(...c)] as [number, number]; }).sort((x, y) => x[0] - y[0]);
  let che = 0, cuoi = -Infinity;
  for (const [x, y] of doan) { if (y <= cuoi) continue; che += y - Math.max(x, cuoi); cuoi = y; }
  return Math.max(0, 100 * (1 - che / rong));
}

/** Mặt phố: tòa bám cạnh lô giáp đường thì song song cạnh, dãy nhịp đều, cả lô ít họ góc. */
function diemMatPho(ds: { F: Diem[]; x: number; y: number; truc: number }[], canh: { a: Diem; b: Diem; u: Diem; goc: number }[]): number {
  if (!ds.length || !canh.length) return 0;
  const nhom = new Map<number, number[]>();
  let song = 0;
  for (const t of ds) {
    let k = 0, m = Infinity;
    canh.forEach((c, i) => {
      const dx = c.b[0] - c.a[0], dy = c.b[1] - c.a[1], s = Math.max(0, Math.min(1, ((t.x - c.a[0]) * dx + (t.y - c.a[1]) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(t.x - c.a[0] - s * dx, t.y - c.a[1] - s * dy);
      if (d < m) { m = d; k = i; }
    });
    const lech = Math.abs(((t.truc - canh[k].goc) % 90 + 135) % 90 - 45);
    const ngang = 45 - lech <= 3 || lech <= 3 ? 1 : Math.max(0, 1 - (Math.min(lech, 45 - lech) - 3) / 22);
    song += ngang;
    (nhom.get(k) ?? nhom.set(k, []).get(k)!).push(cham2([t.x, t.y], canh[k].u));
  }
  const dao: number[] = [];
  for (const v of nhom.values()) {
    if (v.length < 2) continue;
    v.sort((a, b) => a - b);
    const nhip = v.slice(1).map((x, i) => x - v[i]), tb = nhip.reduce((a, b) => a + b, 0) / nhip.length;
    dao.push(Math.sqrt(nhip.reduce((a, b) => a + (b - tb) ** 2, 0) / nhip.length) / (tb || 1));
  }
  const deu = dao.length ? 1 - Math.min(1, dao.reduce((a, b) => a + b, 0) / dao.length) : 0.6;
  const ho = new Set(ds.map((t) => Math.round((((t.truc % 90) + 90) % 90) / 5))).size;
  return 100 * (0.5 * (song / ds.length) + 0.25 * deu + 0.25 / Math.max(1, ho * 0.75));
}

/** Bộ sinh: nhả lượt sau mỗi trục / tổ hợp để báo tiến độ. */
export function* sinhBoCuc(v: DauVaoXep): Generator<{ xong: number; tong: number }, GoiYXep[]> {
  const { lo, tv, luat, pa } = v;
  const R = lo.ranh, V = vungDat(lo), kq0: GoiYXep[] = [];
  if (R.length < 3 || V.length < 3) return kq0;
  const cheDo = v.cheDoBoCuc ?? 'to_hop', uu = v.uuTien ?? 'can_bang', soGoiY = Math.max(1, v.soGoiY ?? 10);
  const ct = lo.temDat.chiTieu, dtLo = dienTich(R), soTangDe = ct.tangDe ?? 1;
  const nMax = Math.max(1, ct.tangCanHo ?? Math.round(ct.tangCaoMax) - soTangDe);
  const toaLo = pa.toa.filter((x) => x.loId === lo.id && tv.toa.has(x.mauId));
  const Hmax = cheDo === 'sap_lai' && toaLo.length ? Math.max(...toaLo.map((x) => x.soTangDe * x.caoDe + x.soTangDH * x.caoDH)) : soTangDe * CAO_DE + nMax * CAO_DH;
  const lui = luiTungCanh(luat.lo01, lo, Hmax, v.rongDuong ?? 12), kc = kcToa261(luat.lo02, Hmax);
  const caiV = caiDatView(pa.huongView), bcView = boiCanhView(pa, caiV);
  const xV = V.map((p) => p[0]), yV = V.map((p) => p[1]);
  const bbLo = [Math.min(...xV), Math.min(...yV), Math.max(...xV), Math.max(...yV)];
  // tòa lô bên cạnh: LO-02 xét trong 60 m, view xét trong 300 m; lọc theo khung bao để không dò cả dự án
  const xaKhung = (F: Diem[], m: number) => { const fx = F.map((p) => p[0]), fy = F.map((p) => p[1]); return Math.min(...fx) > bbLo[2] + m || Math.max(...fx) < bbLo[0] - m || Math.min(...fy) > bbLo[3] + m || Math.max(...fy) < bbLo[1] - m; };
  const ngoaiMoi = pa.toa.filter((t) => t.loId !== lo.id && tv.toa.has(t.mauId)).map((t) => ({ id: t.id, loId: t.loId, F: chanToa(tv.toa.get(t.mauId)!, t), H: t.soTangDe * t.caoDe + t.soTangDH * t.caoDH })).filter((o) => !xaKhung(o.F, 300));
  const ngoai = ngoaiMoi.filter((o) => !xaKhung(o.F, 60));
  const kcNgoai = ngoai.map((o) => kcToa261(luat.lo02, Math.max(Hmax, o.H)).dai);
  const luoi = taoLuoiSan(R);
  const canhPho = canhChinh(R).filter((c) => c.dai >= 30).filter((c) => R.some((p, i) => rongCanh(lo, i, v.rongDuong ?? 12) !== null && Math.hypot(p[0] - c.a[0], p[1] - c.a[1]) < c.dai + 1));
  const canhV = canhChinh(V).filter((c) => c.dai >= 40);

  const nhoHinh = new Map<string, { F: Diem[]; su: number; sw: number; dv: number; dh: number; dt: number; r: number }>();
  const hinh = (g: Goi, goc: number, k: Khung) => {
    const ma = `${g.mau.id}|${g.goc.lat ? 1 : 0}|${goc}|${k.u[0].toFixed(4)}`;
    let h = nhoHinh.get(ma);
    if (!h) {
      const F = chanToa(g.mau, { ...g.goc, x: 0, y: 0, gocDo: goc }), us = F.map((p) => cham2(p, k.u)), ns = F.map((p) => cham2(p, k.n));
      const u0 = Math.min(...us), u1 = Math.max(...us), n0 = Math.min(...ns), n1 = Math.max(...ns);
      h = { F, su: (u0 + u1) / 2, sw: u1 - u0, dv: (n0 + n1) / 2, dh: n1 - n0, dt: dienTich(F), r: Math.max(...F.map((p) => Math.hypot(p[0], p[1]))) };
      nhoHinh.set(ma, h);
    }
    return h;
  };
  // bản đồ "còn cách ranh bao nhiêu sau khi trừ khoảng lùi từng cạnh" (âm = phạm): lúc dò chỉ đọc bản đồ, bố cục đạt mới kiểm chính xác từng cạnh
  const oLui = Math.max(3, Math.sqrt(((bbLo[2] - bbLo[0]) * (bbLo[3] - bbLo[1])) / 6000)), cotLui = Math.ceil((bbLo[2] - bbLo[0]) / oLui) + 2, hangLui = Math.ceil((bbLo[3] - bbLo[1]) / oLui) + 2;
  const banDoLui = new Float32Array(cotLui * hangLui);
  for (let j = 0; j < hangLui; j++) for (let i = 0; i < cotLui; i++) {
    const p: Diem = [bbLo[0] + i * oLui, bbLo[1] + j * oLui], vao = trongDaGiac(p, V);
    let m = Infinity, ra = Infinity;
    for (let e = 0; e < R.length; e++) { const k = kcToiDoan([p], R[e], R[(e + 1) % R.length]); m = Math.min(m, k - lui[e]); ra = Math.min(ra, k); }
    banDoLui[i + j * cotLui] = vao ? m : -ra - 1;
  }
  const BIEN_DO = 0.3; // chừa sai số nội suy, để bố cục dò được hiếm khi rớt ở bước kiểm chính xác
  const duLuiNhanh = (F: Diem[]) => {
    for (const p of F) {
      const u = (p[0] - bbLo[0]) / oLui, w = (p[1] - bbLo[1]) / oLui, i = Math.floor(u), j = Math.floor(w);
      if (i < 0 || j < 0 || i >= cotLui - 1 || j >= hangLui - 1) return false;
      const a = u - i, c = w - j, k = i + j * cotLui;
      const m = (1 - c) * ((1 - a) * banDoLui[k] + a * banDoLui[k + 1]) + c * ((1 - a) * banDoLui[k + cotLui] + a * banDoLui[k + cotLui + 1]);
      if (m < BIEN_DO) return false;
    }
    return true;
  };
  const xaKhungDat = (A: Diem[], B: Diem[], m: number) => {
    let ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity, bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (const p of A) { if (p[0] < ax0) ax0 = p[0]; if (p[0] > ax1) ax1 = p[0]; if (p[1] < ay0) ay0 = p[1]; if (p[1] > ay1) ay1 = p[1]; }
    for (const p of B) { if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0]; if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1]; }
    return Math.hypot(Math.max(0, ax0 - bx1, bx0 - ax1), Math.max(0, ay0 - by1, by0 - ay1)) >= m;
  };
  const dat = (g: Goi, goc: number, k: Khung, s: number, d: number): Dat | null => {
    const h = hinh(g, goc, k);
    const x = Math.round((k.u[0] * (s - h.su) + k.n[0] * (d - h.dv)) * 100) / 100, y = Math.round((k.u[1] * (s - h.su) + k.n[1] * (d - h.dv)) * 100) / 100;
    const F = h.F.map((p): Diem => [p[0] + x, p[1] + y]);
    if (!duLuiNhanh(F)) return null;
    for (let i = 0; i < ngoai.length; i++) if (!xaKhungDat(F, ngoai[i].F, kcNgoai[i]) && !duXaDaGiac(F, ngoai[i].F, kcNgoai[i])) return null;
    return { goi: g, x, y, g: goc, F, r: h.r };
  };
  const xaDu = (a: Dat, b: Dat) => Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r >= kc.dai || xaKhungDat(a.F, b.F, kc.dai) || duXaDaGiac(a.F, b.F, kc.dai);

  /** Đoạn [đầu, cuối] của vùng đặt trên dải sâu [d0, d1] theo khung k. */
  const doanCat = (k: Khung, d0: number, d1: number): [number, number] | null => {
    let a = -Infinity, b = Infinity;
    for (const d of [d0, (d0 + d1) / 2, d1]) {
      const c: number[] = [];
      for (let i = 0; i < V.length; i++) {
        const p = V[i], q = V[(i + 1) % V.length], dp = cham2(p, k.n), dq = cham2(q, k.n);
        if ((dp > d) !== (dq > d)) { const t = (d - dp) / (dq - dp); c.push(cham2(p, k.u) + t * (cham2(q, k.u) - cham2(p, k.u))); }
      }
      if (c.length < 2) return null;
      c.sort((x, y) => x - y);
      let dau = c[0], cuoi = c[1];
      for (let i = 2; i + 1 < c.length; i += 2) if (c[i + 1] - c[i] > cuoi - dau) { dau = c[i]; cuoi = c[i + 1]; }
      a = Math.max(a, dau); b = Math.min(b, cuoi);
    }
    return b > a ? [a, b] : null;
  };
  /** Một dãy ở độ sâu d: tìm đầu, cuối đặt được rồi dãn đều; `le` lệch nửa nhịp so với dãy bên cạnh. */
  const hang = (ds: Goi[], gocs: number[], k: Khung, d: number, daCo: Dat[], le: 0 | 1 | 2): Dat[] | null => {
    const h0 = hinh(ds[0], gocs[0], k), h1 = hinh(ds[ds.length - 1], gocs[ds.length - 1], k);
    const sau = Math.max(...ds.map((g, i) => hinh(g, gocs[i], k).dh));
    const cat = doanCat(k, d - sau / 2, d + sau / 2);
    if (!cat) return null;
    const dauDuoc = (g: Goi, goc: number, tu: number, den: number, buoc: number) => {
      for (let s = tu, n = 0; buoc > 0 ? s <= den : s >= den; s += buoc, n++) { if (n > 16) return null; if (dat(g, goc, k, s, d)) return s; }
      return null;
    };
    const a = dauDuoc(ds[0], gocs[0], cat[0] + h0.sw / 2, cat[1] - h0.sw / 2, 3);
    if (a === null) return null;
    const b = ds.length === 1 ? a : dauDuoc(ds[ds.length - 1], gocs[ds.length - 1], cat[1] - h1.sw / 2, a, -3);
    if (b === null) return null;
    const thu = (vt: number[]) => {
      const kq: Dat[] = [];
      for (let i = 0; i < ds.length; i++) {
        const o = dat(ds[i], gocs[i], k, vt[i], d);
        if (!o || !daCo.every((x) => xaDu(o, x)) || !kq.every((x) => xaDu(o, x))) return null;
        kq.push(o);
      }
      return kq;
    };
    if (ds.length === 1) {
      const b1 = dauDuoc(ds[0], gocs[0], cat[1] - h0.sw / 2, a, -3) ?? a, giua = (a + b1) / 2;
      return thu([le === 1 ? a : le === 2 ? b1 : giua]) ?? thu([giua]) ?? thu([a]) ?? thu([b1]);
    }
    const c = ds.length;
    const buoc = le ? (b - a) / (c - 0.5) : (b - a) / (c - 1);
    const deu = ds.map((_, i) => a + (i + (le === 2 ? 0.5 : 0)) * buoc);
    const sit = Math.max(...ds.map((g, i) => hinh(g, gocs[i], k).sw)) + kc.dai + 1, tam = (a + b) / 2;
    return thu(deu) ?? thu(ds.map((_, i) => tam + (i - (c - 1) / 2) * sit));
  };

  /** Bố cục các dãy song song theo trục `goc`. */
  const cacDay = (ds: Goi[], phan: number[], goc: number, ngang: boolean, lat: boolean, xen: boolean, bam: boolean, le: boolean, coDinh: Dat[]): Dat[] | null => {
    const k = khung(goc), ns = V.map((p) => cham2(p, k.n)), dMin = Math.min(...ns), dMax = Math.max(...ns), r = phan.length;
    const nhom: Goi[][] = []; let i0 = 0;
    for (const n of phan) { nhom.push(ds.slice(i0, i0 + n)); i0 += n; }
    const gocHang = (i: number) => nhom[i].map((g) => chuanGoc(goc + (ngang ? 90 : 0) + (lat ? 180 : 0) + (xen && i % 2 ? 180 : 0) - g.truc));
    const thuTu = r === 1 ? [0] : r === 2 ? [0, 1] : [0, 2, 1];
    const kq = coDinh.slice();
    for (const i of thuTu) {
      const gs = gocHang(i), sau = Math.max(...nhom[i].map((g, j) => hinh(g, gs[j], k).dh));
      const moc = r === 1 ? (dMin + dMax) / 2 : bam ? (i === 0 ? dMin + sau / 2 : i === r - 1 ? dMax - sau / 2 : (dMin + dMax) / 2) : dMin + ((i + 0.5) * (dMax - dMin)) / r;
      const huong = i === 0 ? 1 : i === r - 1 && r > 1 ? -1 : 0;
      let day: Dat[] | null = null;
      for (let t = 0; t < 14 && !day; t++) {
        const lech = huong ? huong * t * 5 : (t % 2 ? 1 : -1) * Math.ceil(t / 2) * 5;
        day = hang(nhom[i], gs, k, moc + lech, kq, le ? (i % 2 ? 2 : 1) : 0);
      }
      if (!day) return null;
      kq.push(...day);
    }
    return kq;
  };

  /** Bám viền: chia tòa cho các cạnh chính theo độ dài, tòa nằm dọc cạnh, chừa sân giữa. */
  const bamVien = (ds: Goi[], lat: boolean, dich: number, coDinh: Dat[]): Dat[] | null => {
    if (canhV.length < 3) return null;
    const dsC = canhV.slice(0, 6), tong = dsC.reduce((s, c) => s + c.dai, 0), kq = coDinh.slice();
    let con = ds.slice();
    for (let i = 0; i < dsC.length && con.length; i++) {
      const c = dsC[(i + dich) % dsC.length], k: Khung = { u: c.u, n: c.n }, mep = cham2(c.a, k.n);
      // dãy dài nhất cạnh này chứa được, không vượt phần chia theo độ dài
      for (let n = Math.min(con.length, Math.max(1, Math.round((c.dai / tong) * ds.length))); n >= 1; n--) {
        const nhom = con.slice(0, n), gs = nhom.map((g) => chuanGoc(c.goc + (lat ? 180 : 0) - g.truc)), sau = Math.max(...nhom.map((g, j) => hinh(g, gs[j], k).dh));
        let day: Dat[] | null = null;
        for (let t = 0; t < 10 && !day; t++) day = hang(nhom, gs, k, mep + sau / 2 + t * 5, kq, 0);
        if (day) { kq.push(...day); con = con.slice(n); break; }
      }
    }
    return con.length ? null : kq;
  };

  const chinhXac = (ds: Dat[]) => ds.every((d) => namTrongNhanh(d.F, V) && duLuiTungCanh(d.F, R, lui));
  const chamNhanh = (kieu: KieuBoCuc, ds: Dat[], ho: string): BoCuc => {
    const dsF = ds.map((d) => d.F), s = luoi.do(dsF), gioPct = gioXuyen(R, dsF, PHUONG_VI_GIO_HE, caiV.gocBac);
    const nang = ds.reduce((a, d) => a + (coMat(d.goi.mau) ? viewXoayMau(d.goi.mau as ToaCoMat, tv, d.g, caiV).huong : 50), 0) / ds.length;
    const mat = diemMatPho(ds.map((d) => ({ F: d.F, x: d.x, y: d.y, truc: d.g + d.goi.truc })), canhPho);
    const san = diemSan(s.m2, s.r, dtLo), gio = diemGio(gioPct), w = TRONG_SO[uu];
    return { kieu, ho, dat: ds, diem: { nang, gio, mat, san, sanM2: s.m2, banKinhSan: s.r, gioPct, tam: (w.nang * nang + w.gio * gio + w.mat * mat + w.san * san + w.view * 50) / 100 } };
  };

  const kieuDay = (ds: Goi[], phan: number[]): KieuBoCuc => {
    if (phan.length === 1) return 'mot_day';
    let vt = 0; const mau = phan.map((n) => { const s = ds.slice(vt, vt + n); vt += n; return s[0].mau.id; });
    if (new Set(mau).size > 1) return 'ket_hop';
    if (phan.length === 3) return phan[0] === phan[2] && phan[0] !== phan[1] ? 'so_le' : 'ba_day';
    return 'hai_day';
  };

  /** Trục thử: cạnh chính của lô + Đông–Tây (mặt dài nhìn Nam, QCVN 09 hạn chế nắng Tây) + vuông góc gió hè lệch 15°. */
  const trucThu = () => {
    const ds: number[] = [];
    const them = (g: number) => { const a = ((g % 180) + 180) % 180; if (!ds.some((x) => Math.min(Math.abs(x - a), 180 - Math.abs(x - a)) < 6)) ds.push(a); };
    canhChinh(V).slice(0, 4).forEach((c) => them(c.goc));
    them(caiV.gocBac); them(caiV.gocBac + 15);
    return ds.slice(0, 6);
  };

  const sinhCho = (ds: Goi[], coDinh: Dat[], gom: BoCuc[], gioiHanPhan?: number) => {
    const phanDs = chiaDay(ds.length).filter((p) => !gioiHanPhan || p.length <= gioiHanPhan);
    const truc = trucThu();
    for (const goc of truc) for (const ngang of [false, true]) for (const lat of [false, true]) for (const xen of [false, true]) for (const phan of phanDs) for (const bam of [true, false]) {
      if (phan.length === 1 && (!bam || xen)) continue;
      const le = phan.length > 1 && phan.every((x) => x === phan[0]) && phan[0] > 1;
      const b = cacDay(ds, phan, goc, ngang, lat, xen, bam, false, coDinh);
      if (b && chinhXac(b)) gom.push(chamNhanh(kieuDay(ds, phan), b.slice(coDinh.length), `${Math.round(goc)}|${ngang}|${phan.join()}`));
      if (le) { const c = cacDay(ds, phan, goc, ngang, lat, xen, bam, true, coDinh); if (c && chinhXac(c)) gom.push(chamNhanh('so_le', c.slice(coDinh.length), `${Math.round(goc)}|${ngang}|${phan.join()}|le`)); }
    }
    for (const lat of [false, true]) for (const dich of [0, 1, 2]) { const b = bamVien(ds, lat, dich, coDinh); if (b && chinhXac(b)) gom.push(chamNhanh('vien', b.slice(coDinh.length), `vien|${dich}`)); }
  };

  const goiCua = (m: ToaMau, x: ToaDat): Goi => ({ mau: m, goc: x, truc: trucDai(chanToa(m, { ...x, x: 0, y: 0, gocDo: 0 })) });
  const ung: BoCuc[] = [];
  let coDinh: Dat[] = [], gocKhoa: ToaDat[] = [];
  const muc = sucChua(lo).soCanUoc;

  if (cheDo === 'sap_lai') {
    gocKhoa = toaLo.filter((x) => x.khoa);
    coDinh = gocKhoa.map((x) => { const g = goiCua(tv.toa.get(x.mauId)!, x), F = chanToa(g.mau, x); return { goi: g, x: x.x, y: x.y, g: x.gocDo, F, r: Math.max(...F.map((p) => Math.hypot(p[0] - x.x, p[1] - x.y))) }; });
    const ds = toaLo.filter((x) => !x.khoa).sort((a, b) => a.mauId.localeCompare(b.mauId)).map((x) => goiCua(tv.toa.get(x.mauId)!, x));
    if (!ds.length) return kq0;
    yield { xong: 0, tong: 3 };
    sinhCho(ds, coDinh, ung);
    yield { xong: 1, tong: 3 };
  } else {
    const nhom = lo.temDat.chucNang === 'xh' ? 'xh' : 'tm';
    const mauDs = [...tv.toa.values()].filter((m) => coMat(m) && (v.chiMau?.length ? v.chiMau.includes(m.id) : m.nhom === nhom));
    if (!mauDs.length) return kq0;
    // DTXD tối đa: MĐXD và mật độ tháp (nếu lô có), tính theo chân tòa
    const dtMax = (dtLo * Math.min(ct.matDoMax, ct.matDoThapMax ?? Infinity)) / 100;
    const thongTin = new Map(mauDs.map((m) => {
      const toa = taoToaTrenLo(m, lo, 'dem'), dem = coCauRong();
      for (const [id, n] of canCaToa(m as ToaCoMat & ToaMau, toa, tv)) { const c = tv.can.get(id); if (c) dem[c.loai] += n; }
      return [m.id, { dt: dienTich(chanToa(m, toa)), dem, toa }] as const;
    }));
    const muc2 = lo.temDat.coCauMucTieu as Record<LoaiCan, number>, coMuc = !!muc2 && Object.values(muc2).some((x) => x > 0);
    type ToHop = { ds: [string, number][]; dt: number; lech: number };
    const th: ToHop[] = [];
    const duyet = (i: number, chon: [string, number][], dt: number, n: number) => {
      if (chon.length) {
        const dem = coCauRong();
        for (const [id, c] of chon) for (const l of Object.keys(dem) as LoaiCan[]) dem[l] += c * thongTin.get(id)!.dem[l];
        th.push({ ds: chon.slice(), dt, lech: coMuc ? diemLechCoCau(phanTram(dem), muc2) : 0 });
      }
      if (chon.length >= 3) return;
      for (let k = i; k < mauDs.length; k++) {
        const d = thongTin.get(mauDs[k].id)!.dt;
        for (let c = 1; c <= 6 && n + c <= 8 && dt + c * d <= dtMax + 1e-6; c++) duyet(k + 1, [...chon, [mauDs[k].id, c]], dt + c * d, n + c);
      }
    };
    duyet(0, [], 0, 0);
    const diemTH = (h: ToHop) => (100 * (1 - h.dt / dtMax)) * 1.5 + h.lech + (h.ds.length - 1) * 2;
    th.sort((a, b) => diemTH(a) - diemTH(b));
    // duyệt tổ hợp từ tốt xuống, mỗi tập mẫu một lần; dừng khi đủ tập mẫu xếp được (lô chật nhiều tổ hợp không xếp nổi)
    const daThu = new Set<string>(), TOI_DA = 40, DU_TAP = 8;
    let thu = 0, coBoCuc = 0;
    for (const h of th) {
      if (thu >= TOI_DA || coBoCuc >= DU_TAP) break;
      const k = h.ds.map((x) => x[0]).join('+');
      if (daThu.has(k)) continue;
      daThu.add(k); thu++;
      const ds = h.ds.flatMap(([id, c]) => Array.from({ length: c }, (_, j) => {
        const m = tv.toa.get(id)!, g = goiCua(m, thongTin.get(id)!.toa);
        return { ...g, goc: { ...g.goc, id: `goiy-${id}-${j}` } };
      }));
      const truoc = ung.length;
      sinhCho(ds, [], ung, ds.length <= 6 ? 3 : 2);
      if (ung.length > truoc) coBoCuc++;
      yield { xong: Math.max(thu / TOI_DA, coBoCuc / DU_TAP), tong: 3 };
    }
  }

  // chấm đầy đủ nhóm đứng đầu, giữ đủ kiểu bố cục
  ung.sort((a, b) => b.diem.tam - a.diem.tam);
  const ten = (g: GoiYXep) => g.mau.map(([m]) => m).join('+');
  const gan = (a: Dat[], b: Dat[], nguong = 30) => {
    if (a.length !== b.length) return false;
    const lechGoc = (p: number, q: number) => { const d = Math.abs(p - q) % 180; return Math.min(d, 180 - d); };
    return a.reduce((s, x) => s + Math.min(...b.map((y) => Math.hypot(x.x - y.x, x.y - y.y) + lechGoc(x.g, y.g))), 0) / a.length < nguong;
  };
  const nhomDau: BoCuc[] = [];
  for (const kieu of ['hai_day', 'so_le', 'ba_day', 'ket_hop', 'mot_day', 'vien'] as KieuBoCuc[]) {
    let dem = 0;
    for (const b of ung) { if (b.kieu !== kieu || nhomDau.some((x) => gan(x.dat, b.dat))) continue; nhomDau.push(b); if (++dem >= 5) break; }
  }
  for (const b of ung) { if (nhomDau.length >= 3 * soGoiY) break; if (!nhomDau.some((x) => gan(x.dat, b.dat)) && nhomDau.filter((x) => x.ho === b.ho).length < 3) nhomDau.push(b); }
  // lô chật ít bố cục khác hẳn nhau: lấy thêm bố cục khác tối thiểu cho đủ số phương án
  for (const b of ung) { if (nhomDau.length >= soGoiY + 4) break; if (!nhomDau.some((x) => gan(x.dat, b.dat, 4))) nhomDau.push(b); }

  const dsNgoai = (bo: BoDemView) => { for (const o of ngoaiMoi) bo.them({ id: o.id, loId: o.loId, F: o.F, H: o.H, can: [], eye: 0, so: 1, kc: 0 }); };
  const viewCua = (toa: ToaDat[], ds: Dat[]) => {
    const bo = new BoDemView(caiV, bcView);
    dsNgoai(bo);
    ds.forEach((d, i) => {
      const x = toa[i], H = x.soTangDe * x.caoDe + x.soTangDH * x.caoDH;
      const cuc = coMat(d.goi.mau) ? viewXoayMau(d.goi.mau as ToaCoMat, tv, d.g, caiV).cuc : [];
      const tv1: ToaView = { id: `goiy-${i}`, loId: lo.id, F: d.F, H, eye: Math.max(3, x.soTangDe * x.caoDe + (x.soTangDH * x.caoDH) / 2), so: 1, kc: kcToa261(luat.lo02, H).dai, can: datMatCan(cuc, { x: d.x, y: d.y, gocDo: d.g }) };
      bo.them(tv1);
    });
    const th = tongHopView(bo.diem());
    return { tb: th.tb, tot: th.soCan ? th.pctTot : null };
  };
  const ganToa = (b: BoCuc, n: number | null) => b.dat.map((d, i) => ({ ...d.goi.goc, id: cheDo === 'sap_lai' ? d.goi.goc.id : `goiy-${i}`, loId: lo.id, x: d.x, y: d.y, gocDo: d.g, ...(n !== null ? { soTangDH: n, soTangDe, caoDe: CAO_DE, caoDH: CAO_DH } : {}) }));
  const tinh = (toa: ToaDat[]) => {
    const kq = tinhChiTieu({ ...pa, lo: [lo], toa: [...toa, ...gocKhoa] }, tv).theoLo[lo.id];
    return { kq, loi: kq.dong.filter((d) => d.muc === 'vuot' && ['matDo', 'matDoThap', 'dtSan', 'tangCao', 'tangCanHo', 'soCan', 'danSo'].includes(d.khoa)).length };
  };
  const pccc = new Map<string, number | null>();
  const vuotPCCC = (mauId: string, n: number) => {
    const k = `${mauId}|${n}`;
    if (!pccc.has(k)) {
      const m = tv.toa.get(mauId) as unknown as ToaPCCC;
      let r: number | null = null;
      try { if (Array.isArray(m.truc)) r = thoatNan(m, { cuaCan: v.cuaCan, chieuCaoPCCC: chieuCaoPCCC(soTangDe, CAO_DE, n, CAO_DH) }).soVuot; } catch { r = null; }
      pccc.set(k, r);
    }
    return pccc.get(k)!;
  };
  const chamDu = (b: BoCuc, khoa: string): GoiYXep | null => {
    let toa: ToaDat[], r: ReturnType<typeof tinh>;
    if (cheDo === 'sap_lai') { toa = ganToa(b, null); r = tinh(toa); } else {
      let a = 1, c = nMax, tot: { toa: ToaDat[]; r: ReturnType<typeof tinh> } | null = null;
      while (a <= c) {
        const m = (a + c) >> 1, ts = ganToa(b, m), x = tinh(ts);
        if (x.loi === 0) { tot = { toa: ts, r: x }; a = m + 1; } else c = m - 1;
      }
      if (!tot) return null;
      toa = tot.toa; r = tot.r;
    }
    const kq = r.kq, nTieuBieu = Math.max(...toa.map((x) => x.soTangDH));
    const dem = new Map<string, number>();
    toa.forEach((x) => dem.set(x.mauId, (dem.get(x.mauId) ?? 0) + 1));
    const canhBao: string[] = [];
    for (let i = 0; i < b.dat.length; i++) for (let j = i + 1; j < b.dat.length; j++) {
      const H = Math.max(...[toa[i], toa[j]].map((x) => x.soTangDe * x.caoDe + x.soTangDH * x.caoDH)), d = kcDaGiac(b.dat[i].F, b.dat[j].F);
      if (d < kcToa261(luat.lo02, H).dai) canhBao.push(`LO-02 ${i + 1}↔${j + 1} ${d.toFixed(1)} m`);
    }
    const pc = [...dem.keys()].map((m) => vuotPCCC(m, nTieuBieu));
    const vw = viewCua(toa, b.dat), viewD = vw.tb ?? 0, w = TRONG_SO[uu], d = b.diem;
    const tong = (w.nang * d.nang + w.gio * d.gio + w.view * viewD + w.mat * d.mat + w.san * d.san) / 100;
    const lech = diemLechCoCau(kq.coCauPct, lo.temDat.coCauMucTieu as Record<LoaiCan, number>);
    const tran = ct.hssddMax * dtLo, matDo = kq.dong.find((x) => x.khoa === 'matDo')?.dat ?? 0;
    const dtMaxPct = Math.min(ct.matDoMax, ct.matDoThapMax ?? Infinity);
    const matThap = (hopDienTich(b.dat.map((x) => x.F)) / dtLo) * 100;
    // tổ hợp: cộng phần tận dụng DTXD và cơ cấu để phương án sát chỉ tiêu đứng trước
    const diem = cheDo === 'sap_lai' ? tong : tong + 40 * Math.min(1, matThap / dtMaxPct) - 0.5 * lech;
    return {
      khoa, kieu: b.kieu, toa, mau: [...dem], soTangDH: nTieuBieu, soCan: kq.soCan, soCanMuc: muc, lech, tyLeSan: tran > 0 ? kq.dtSanTinhHSSDD / tran : 0, matDo, danSo: kq.soCan * ct.nguoiMoiCan, loiQH: r.loi,
      pcccVuot: pc.some((x) => x === null) ? null : pc.reduce<number>((s, x) => s + (x ?? 0), 0),
      huongTot: d.nang, canhBao, diem, view: vw.tb, viewTot: vw.tot,
      boCuc: { nang: d.nang, gio: d.gio, view: viewD, mat: d.mat, san: d.san, tong, sanM2: d.sanM2, banKinhSan: d.banKinhSan, gioPct: d.gioPct },
    };
  };
  const ketQua: { g: GoiYXep; b: BoCuc }[] = [];
  for (let i = 0; i < nhomDau.length; i++) {
    const g = chamDu(nhomDau[i], `${nhomDau[i].kieu}|${i}`);
    if (g) ketQua.push({ g, b: nhomDau[i] });
    if (i % 4 === 3) yield { xong: 2 + (i + 1) / nhomDau.length, tong: 3 };
  }
  ketQua.sort((a, b) => a.g.loiQH - b.g.loiQH || b.g.diem - a.g.diem);
  // đủ kiểu trước, không lấy hai bố cục gần trùng; tổ hợp: mỗi tập mẫu tối đa 2 phương án
  const chon: typeof ketQua = [];
  // một họ bố cục (cùng trục, cùng cách chia dãy) tối đa 2 phương án để danh sách thật sự khác nhau
  const duoc = (x: (typeof ketQua)[number]) => !chon.some((y) => y === x || gan(y.b.dat, x.b.dat)) && chon.filter((y) => y.b.ho === x.b.ho).length < 2 && (cheDo === 'sap_lai' || chon.filter((y) => ten(y.g) === ten(x.g)).length < 2);
  for (const kieu of ['hai_day', 'so_le', 'ba_day', 'ket_hop', 'mot_day', 'vien'] as KieuBoCuc[]) { const x = ketQua.find((y) => y.g.kieu === kieu && duoc(y)); if (x && chon.length < soGoiY) chon.push(x); }
  for (const x of ketQua) { if (chon.length >= soGoiY) break; if (duoc(x)) chon.push(x); }
  for (const x of ketQua) { if (chon.length >= soGoiY) break; if (!chon.includes(x) && !chon.some((y) => gan(y.b.dat, x.b.dat, 4))) chon.push(x); }
  chon.sort((a, b) => a.g.loiQH - b.g.loiQH || b.g.diem - a.g.diem);
  yield { xong: 3, tong: 3 };
  return chon.map((x) => x.g);
}

/** Điểm năm tiêu chí của hiện trạng trên lô, để so với phương án mới. */
export function chamHienTrang(v: DauVaoXep): Pick<DiemBoCuc, 'gioPct' | 'sanM2' | 'gio' | 'san'> | null {
  const { pa, lo, tv } = v;
  const F = pa.toa.filter((x) => x.loId === lo.id && tv.toa.has(x.mauId)).map((x) => chanToa(tv.toa.get(x.mauId)!, x));
  if (!F.length) return null;
  const s = taoLuoiSan(lo.ranh).do(F), dtLo = dienTich(lo.ranh), gioPct = gioXuyen(lo.ranh, F, PHUONG_VI_GIO_HE, caiDatView(pa.huongView).gocBac);
  return { gioPct, sanM2: s.m2, gio: diemGio(gioPct), san: diemSan(s.m2, s.r, dtLo) };
}


