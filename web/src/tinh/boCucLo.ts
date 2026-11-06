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
import { chanToa, dienTich, hopDienTich, trongTam } from './hinhHoc';
import { BoDemView, boiCanhView, caiDatView, tongHopView, datMatCan, viewXoayMau, viTriMatTroi, type ToaView } from './huongView';
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
/** Điểm sân: nửa theo diện tích mảnh sân liền (đủ 40 % lô = 100), nửa theo vòng tròn trống lớn nhất (bán kính 60 m = 100). */
const diemSan = (m2: number, r: number, dtLo: number) => 50 * Math.min(1, m2 / (0.4 * dtLo)) + 50 * Math.min(1, r / 60);
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
const KIEU_DS: KieuBoCuc[] = ['hai_day', 'so_le', 'ba_day', 'ket_hop', 'om_goc', 'mot_day', 'vien'];

/** Tòa cần đặt: mẫu + tòa gốc (giữ số tầng, căn đã sửa) + trục dài của mẫu ở góc 0. */
type Goi = { mau: ToaMau; goc: ToaDat; truc: number };
type Dat = { goi: Goi; x: number; y: number; g: number; F: Diem[]; r: number };
type Khung = { u: Diem; n: Diem };
type BoCuc = { kieu: KieuBoCuc; ho: string; dat: Dat[]; diem: Omit<DiemBoCuc, 'view' | 'tong' | 'cheNangPct'> & { tam: number } };

const cham2 = (a: Diem, b: Diem) => a[0] * b[0] + a[1] * b[1];
const chuanGoc = (g: number) => Math.round((((g % 360) + 360) % 360) * 10) / 10;
const khung = (goc: number): Khung => { const c = Math.cos(goc * RAD), s = Math.sin(goc * RAD); return { u: [c, s], n: [-s, c] }; };

/**
 * Trục của chân tòa ở góc 0 (độ): hướng có tổng chiều dài cạnh lớn nhất, gộp theo bước 5°. Không dùng thành phần chính vì tòa chữ L, V sẽ ra
 * đường chéo hai cánh, xoay theo đó thì không tòa nào song song cạnh lô.
 */
export function trucDai(F: Diem[]): number {
  const dem = new Map<number, { dai: number; c: number; s: number }>();
  F.forEach((p, i) => {
    const q = F[(i + 1) % F.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 1e-6) return;
    const g = ((Math.atan2(q[1] - p[1], q[0] - p[0]) / RAD) % 180 + 180) % 180, k = Math.round(g / 5) % 36;
    const o = dem.get(k) ?? { dai: 0, c: 0, s: 0 };
    o.dai += L; o.c += L * Math.cos(2 * g * RAD); o.s += L * Math.sin(2 * g * RAD);
    dem.set(k, o);
  });
  const tot = [...dem.values()].sort((x, y) => y.dai - x.dai)[0];
  return tot ? (0.5 * Math.atan2(tot.s, tot.c)) / RAD : 0;
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

/** Hai mặt đối diện cùng chạy song song quá chừng này mới tính là cạnh dài đối cạnh dài (§2.6.1); ngắn hơn là đầu hồi. */
const DAI_MAT_DOI_DIEN = 24;
const kcDiemDoan = (p: Diem, a: Diem, b: Diem): [number, Diem] => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  const q: Diem = [a[0] + t * dx, a[1] + t * dy];
  return [Math.hypot(p[0] - q[0], p[1] - q[1]), q];
};
const kcDiemDa = (p: Diem, F: Diem[]): [number, Diem] => {
  let m: [number, Diem] = [Infinity, p];
  for (let i = 0; i < F.length; i++) { const k = kcDiemDoan(p, F[i], F[(i + 1) % F.length]); if (k[0] < m[0]) m = k; }
  return m;
};
/**
 * Hai đa giác đối nhau bằng đầu hồi: lấy phương nối hai điểm gần nhất, chỉ xét phần mỗi tòa nằm sát tòa kia, đo đoạn hai phần đó chồng nhau
 * theo phương vuông góc. Chồng ngắn nghĩa là chỉ đầu tòa nhìn nhau, kể cả tòa chữ L có hai cánh dài.
 */
export function doiDauHoi(P: Diem[], Q: Diem[]): boolean {
  let d = Infinity, a: Diem = P[0], b: Diem = Q[0];
  for (const p of P) { const k = kcDiemDa(p, Q); if (k[0] < d) { d = k[0]; a = p; b = k[1]; } }
  for (const q of Q) { const k = kcDiemDa(q, P); if (k[0] < d) { d = k[0]; a = k[1]; b = q; } }
  if (!(d > 0)) return false;
  const u: Diem = [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
  const sat = (F: Diem[], G: Diem[]) => F.filter((p) => kcDiemDa(p, G)[0] <= d + 8).map((p) => cham2(p, u));
  const x = sat(P, Q), y = sat(Q, P);
  return Math.min(Math.max(...x), Math.max(...y)) - Math.max(Math.min(...x), Math.min(...y)) < DAI_MAT_DOI_DIEN;
}

/** Gió theo mọi hướng chủ đạo, gộp theo trọng số. */
export function gioTheoHuong(R: Diem[], ds: Diem[][], huong: { pv: number; ts: number }[], gocBac = 0): number {
  const tong = huong.reduce((a, h) => a + h.ts, 0) || 1;
  return huong.reduce((a, h) => a + h.ts * gioXuyen(R, ds, h.pv, gocBac), 0) / tong;
}

/** Tia từ p theo hướng (dx, dy), dài L, có cắt đa giác F không. */
function tiaCat(p: Diem, dx: number, dy: number, L: number, F: Diem[]): boolean {
  const q: Diem = [p[0] + dx * L, p[1] + dy * L];
  const o = (a: Diem, b: Diem, c: Diem) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < F.length; i++) {
    const a = F[i], b = F[(i + 1) % F.length];
    if (o(p, q, a) * o(p, q, b) < 0 && o(a, b, p) * o(a, b, q) < 0) return true;
  }
  return false;
}

/**
 * % điểm trên chu vi tòa (ở nửa chiều cao) bị tòa khác che nắng, 8–16 h ngày Đông chí. Chỉ xét điểm đang quay về phía mặt trời
 * (tia không đi xuyên chính tòa đó). `vatCan` gồm tòa lô bên cạnh.
 */
export function cheNangPct(ds: { F: Diem[]; H: number }[], vatCan: { F: Diem[]; H: number }[], viDo: number, gocBac = 0): number {
  let che = 0, tong = 0;
  const gioMT = [8, 10, 12, 14, 16].map((g) => viTriMatTroi(viDo, g)).filter((m) => m.cao > 3);
  ds.forEach((a, ia) => {
    const buoc = Math.max(1, Math.floor(a.F.length / 8)), mat = a.H / 2;
    for (let i = 0; i < a.F.length; i += buoc) {
      const p0 = a.F[i], p1 = a.F[(i + 1) % a.F.length], p: Diem = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      for (const m of gioMT) {
        const g = ((90 - m.phuongVi + gocBac) * Math.PI) / 180, dx = Math.cos(g), dy = Math.sin(g), tan = Math.tan((m.cao * Math.PI) / 180);
        if (tiaCat([p[0] + dx * 0.2, p[1] + dy * 0.2], dx, dy, 200, a.F)) continue; // điểm này quay lưng lại mặt trời
        tong++;
        const bi = [...ds.filter((_, k) => k !== ia), ...vatCan].some((b) => b.H > mat && tiaCat(p, dx, dy, (b.H - mat) / tan, b.F));
        if (bi) che++;
      }
    }
  });
  return tong ? (100 * che) / tong : 0;
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
  const huongGio = v.huongGio?.length ? v.huongGio : [{ pv: PHUONG_VI_GIO_HE, ts: 1 }];
  // cây xanh / mặt nước cách lô dưới 120 m: phương vị từ tâm lô tới, để đo sân có mở về phía đó không
  const tamLo = trongTam(R);
  const huongXanh = bcView.xanh.filter((x) => R !== x.P && x.P.some((p) => R.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 120))).map((x) => {
    const c = trongTam(x.P);
    return { pv: 90 + caiV.gocBac - Math.atan2(c[1] - tamLo[1], c[0] - tamLo[0]) / RAD, ts: Math.max(1, dienTich(x.P)) };
  }).sort((a, b) => b.ts - a.ts).slice(0, 3);
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
  let demDat = 0; // ngân sách theo số phép thử (không theo đồng hồ) để cùng đầu vào luôn ra cùng kết quả
  const dat = (g: Goi, goc: number, k: Khung, s: number, d: number): Dat | null => {
    demDat++;
    const h = hinh(g, goc, k);
    const x = Math.round((k.u[0] * (s - h.su) + k.n[0] * (d - h.dv)) * 100) / 100, y = Math.round((k.u[1] * (s - h.su) + k.n[1] * (d - h.dv)) * 100) / 100;
    const F = h.F.map((p): Diem => [p[0] + x, p[1] + y]);
    if (!duLuiNhanh(F)) return null;
    for (let i = 0; i < ngoai.length; i++) if (!xaKhungDat(F, ngoai[i].F, kcNgoai[i]) && !duXaDaGiac(F, ngoai[i].F, kcNgoai[i])) return null;
    return { goi: g, x, y, g: goc, F, r: h.r };
  };
  // §2.6.1: đủ mức cạnh dài thì xong; dưới đó vẫn được nếu đủ mức đầu hồi và hai tòa chỉ nhìn nhau bằng đầu hồi
  const xaDu = (a: Dat, b: Dat) => {
    if (Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r >= kc.dai || xaKhungDat(a.F, b.F, kc.dai)) return true;
    demDat += 12; // phép đo đa giác đắt hơn một lần đặt
    return duXaDaGiac(a.F, b.F, kc.hoi) && (duXaDaGiac(a.F, b.F, kc.dai) || doiDauHoi(a.F, b.F));
  };

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
  const hang = (ds: Goi[], gocs: number[], k: Khung, d: number, daCo: Dat[], le: 0 | 1 | 2, chua = 0): Dat[] | null => {
    const h0 = hinh(ds[0], gocs[0], k), h1 = hinh(ds[ds.length - 1], gocs[ds.length - 1], k);
    const sau = Math.max(...ds.map((g, i) => hinh(g, gocs[i], k).dh));
    const cat = doanCat(k, d - sau / 2, d + sau / 2);
    if (!cat) return null;
    const dauDuoc = (g: Goi, goc: number, tu: number, den: number, buoc: number) => {
      for (let s = tu, n = 0; buoc > 0 ? s <= den : s >= den; s += buoc, n++) {
        if (n > 80) return null;
        const o = dat(g, goc, k, s, d);
        if (o && daCo.every((x) => xaDu(o, x))) return s;
      }
      return null;
    };
    const a = dauDuoc(ds[0], gocs[0], cat[0] + chua + h0.sw / 2, cat[1] - h0.sw / 2, 1.5);
    if (a === null) return null;
    const b = ds.length === 1 ? a : dauDuoc(ds[ds.length - 1], gocs[ds.length - 1], cat[1] - chua - h1.sw / 2, a, -1.5);
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
      const b1 = dauDuoc(ds[0], gocs[0], cat[1] - h0.sw / 2, a, -1.5) ?? a, giua = (a + b1) / 2;
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
      for (let t = 0; t < 40 && !day; t++) {
        const lech = huong ? huong * t * 1.5 : (t % 2 ? 1 : -1) * Math.ceil(t / 2) * 3;
        day = hang(nhom[i], gs, k, moc + lech, kq, le ? (i % 2 ? 2 : 1) : 0);
      }
      if (!day) return null;
      kq.push(...day);
    }
    return kq;
  };

  /**
   * Bám viền: `so[i]` tòa trên cạnh chính thứ i, tòa nằm dọc cạnh sát khoảng lùi. Cạnh đầu bỏ trống `chua` m ở hai đầu; các cạnh sau tiến sát góc lô tới
   * mức §2.6.1 cho phép với tòa đã đặt (M7: cặp tòa ở góc cách 22–23 m). `matLat` bit i = lật 180° các tòa trên cạnh i (mặt nào quay vào sân).
   */
  const nhoSau = new Map<string, number | null>();
  /** Độ sâu nhỏ nhất đặt được tòa dọc cạnh, nhớ theo cạnh × mẫu × góc: mọi cách chia dùng lại, khỏi dò từng lần. */
  const sauBamCanh = (g: Goi, goc: number, c: (typeof canhV)[number], k: Khung, tu: number): number | null => {
    const ma = `${c.goc}|${g.mau.id}|${g.goc.lat ? 1 : 0}|${goc}`;
    if (nhoSau.has(ma)) return nhoSau.get(ma)!;
    let kq: number | null = null;
    const s0 = cham2(c.a, k.u), h = hinh(g, goc, k);
    for (let t = 0; t < 30 && kq === null; t++) for (const f of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      if (dat(g, goc, k, s0 + (cham2(c.b, k.u) - s0) * f, tu + t) && h) { kq = tu + t; break; }
    }
    nhoSau.set(ma, kq);
    return kq;
  };
  const bamVien = (ds: Goi[], so: number[], chua: number, matLat: number, coDinh: Dat[]): Dat[] | null => {
    const kq = coDinh.slice();
    let vt = 0;
    for (let i = 0; i < so.length; i++) {
      if (!so[i]) continue;
      const c = canhV[i], k: Khung = { u: c.u, n: c.n }, nhom = ds.slice(vt, vt + so[i]), mep = cham2(c.a, k.n);
      vt += so[i];
      const gs = nhom.map((g) => chuanGoc(c.goc + ((matLat >> i) & 1 ? 180 : 0) - g.truc)), sau = Math.max(...nhom.map((g, j) => hinh(g, gs[j], k).dh));
      const d = sauBamCanh(nhom[0], gs[0], c, k, mep + sau / 2);
      if (d === null) return null;
      // cạnh gộp từ nhiều đoạn gần thẳng hàng hơi cong: dãy có thể phải lùi vào thêm so với điểm dò
      let day: Dat[] | null = null;
      for (let t = 0; t < 10 && !day; t++) day = hang(nhom, gs, k, d + t * 2, kq, 0, vt === so[i] ? chua : 0);
      if (!day) return null;
      kq.push(...day);
    }
    return kq;
  };

  /**
   * Dự phòng khi quy tắc dãy không chứa đủ tòa (tòa chữ L trên lô tam giác): đặt từng tòa, dò từ cạnh `dau` theo chiều `chieu`, lớp ngoài trước lớp trong,
   * lấy chỗ đầu tiên hợp lệ. Không đẹp bằng dãy nhưng người dùng luôn có phương án để so.
   */
  const thamLam = (ds: Goi[], dau: number, chieu: 1 | -1, lech: 0 | 90, coDinh: Dat[]): Dat[] | null => {
    const kq = coDinh.slice();
    for (const g of ds) {
      let chon: Dat | null = null;
      for (let ci = 0; ci < canhV.length && !chon; ci++) {
        const c = canhV[(dau + ci) % canhV.length], k: Khung = { u: c.u, n: c.n }, mep = cham2(c.a, k.n), s0 = cham2(c.a, k.u), s1 = cham2(c.b, k.u);
        for (const doi of [0, 180]) {
          const goc = chuanGoc(c.goc + lech + doi - g.truc), h = hinh(g, goc, k);
          for (let t = 0; t < 30 && !chon; t++) {
            const d = mep + h.dh / 2 + t * 3;
            for (let i = 0; i <= 40 && !chon; i++) {
              const f = chieu > 0 ? i / 40 : 1 - i / 40, o = dat(g, goc, k, s0 + (s1 - s0) * f, d);
              if (o && kq.every((x) => xaDu(o, x))) chon = o;
            }
          }
          if (chon) break;
        }
      }
      if (!chon) return null;
      kq.push(chon);
    }
    return kq;
  };

  /** Mọi cách chia n tòa cho m cạnh chính, cạnh dài nhận nhiều trước; cạnh trống được phép (M7 CT-2 bỏ qua một cạnh). */
  const chiaCanh = (n: number, m: number): number[][] => {
    const kq: number[][] = [];
    const di = (i: number, con: number, c: number[]) => {
      if (i === m - 1) { kq.push([...c, con]); return; }
      for (let k = con; k >= 0; k--) di(i + 1, con - k, [...c, k]);
    };
    if (m > 0) di(0, n, []);
    const dai = canhV.slice(0, m).map((c) => c.dai), tong = dai.reduce((a, b) => a + b, 0) || 1;
    const lech = (c: number[]) => c.reduce((a, x, i) => a + Math.abs(x - (dai[i] / tong) * n), 0);
    return kq.filter((c) => c.filter(Boolean).length >= 2).sort((a, b) => lech(a) - lech(b));
  };

  /** Góc lô: hai cạnh chính nối nhau, gần vuông. */
  const gocLo = (() => {
    const ds = canhChinh(V), kq: { c: (typeof ds)[number]; sau: (typeof ds)[number] }[] = [];
    for (const a of ds) for (const b of ds) {
      if (a === b || Math.hypot(a.b[0] - b.a[0], a.b[1] - b.a[1]) > 8 || Math.abs(cham2(a.u, b.u)) > 0.5) continue;
      kq.push({ c: a, sau: b });
    }
    return kq.sort((x, y) => Math.min(y.c.dai, y.sau.dai) - Math.min(x.c.dai, x.sau.dai));
  })();
  /** Tòa chữ L, V đặt ôm góc lô (M7 4 tòa L): xoay sao cho lòng chữ quay vào trong lô; tòa còn lại bám viền. */
  const omGoc = (ds: Goi[], coDinh: Dat[]): Dat[] | null => {
    const L = ds.filter((g) => g.mau.hinh === 'l' || g.mau.hinh === 'v'), con = ds.filter((g) => !L.includes(g));
    if (!L.length || L.length > gocLo.length) return null;
    const kq = coDinh.slice();
    for (let i = 0; i < L.length; i++) {
      const { c, sau } = gocLo[i], k: Khung = { u: c.u, n: c.n }, vao: Diem = [c.n[0] + sau.n[0], c.n[1] + sau.n[1]];
      // chữ L: trọng tâm lệch về phía góc so với tâm khung bao, chọn góc xoay có độ lệch hướng ra ngoài lô lớn nhất
      let gTot = 0, lechTot = -Infinity;
      for (const r of [0, 90, 180, 270]) {
        const goc = chuanGoc(c.goc + r), F = chanToa(L[i].mau, { ...L[i].goc, x: 0, y: 0, gocDo: goc }), tam = trongTam(F);
        const xs = F.map((p) => p[0]), ys = F.map((p) => p[1]), lech = -((tam[0] - (Math.min(...xs) + Math.max(...xs)) / 2) * vao[0] + (tam[1] - (Math.min(...ys) + Math.max(...ys)) / 2) * vao[1]);
        if (lech > lechTot) { lechTot = lech; gTot = goc; }
      }
      const h = hinh(L[i], gTot, k), cs = cham2(c.b, k.u), cd = cham2(c.b, k.n);
      let o: Dat | null = null;
      for (let t = 0; t < 16 && !o; t++) {
        const x = dat(L[i], gTot, k, cs - h.sw / 2 - t * 3, cd + h.dh / 2 + t * 3);
        if (x && kq.every((y) => xaDu(x, y))) o = x;
      }
      if (!o) return null;
      kq.push(o);
    }
    return con.length ? bamVien(con, chiaCanh(con.length, Math.min(3, canhV.length))[0] ?? [], 0, 0, kq) : kq;
  };

  const chinhXac = (ds: Dat[]) => ds.every((d) => namTrongNhanh(d.F, V) && duLuiTungCanh(d.F, R, lui));
  const chamNhanh = (kieu: KieuBoCuc, ds: Dat[], ho: string): BoCuc => {
    const dsF = ds.map((d) => d.F), s = luoi.do(dsF), gioPct = gioTheoHuong(R, dsF, huongGio, caiV.gocBac);
    const moXanhPct = huongXanh.length ? gioTheoHuong(R, dsF, huongXanh, caiV.gocBac) : null;
    const nang = ds.reduce((a, d) => a + (coMat(d.goi.mau) ? viewXoayMau(d.goi.mau as ToaCoMat, tv, d.g, caiV).huong : 50), 0) / ds.length;
    const mat = diemMatPho(ds.map((d) => ({ F: d.F, x: d.x, y: d.y, truc: d.g + d.goi.truc })), canhPho);
    const san0 = diemSan(s.m2, s.r, dtLo), san = moXanhPct === null ? san0 : 0.8 * san0 + 0.2 * Math.min(100, moXanhPct * 2), gio = diemGio(gioPct), w = TRONG_SO[uu];
    return { kieu, ho, dat: ds, diem: { nang, gio, mat, san, sanM2: s.m2, banKinhSan: s.r, gioPct, moXanhPct, tam: (w.nang * nang + w.gio * gio + w.mat * mat + w.san * san + w.view * 50) / 100 } };
  };

  const kieuDay = (ds: Goi[], phan: number[]): KieuBoCuc => {
    if (phan.length === 1) return 'mot_day';
    // dãy kết hợp: mỗi dãy một mẫu; dãy trộn mẫu vẫn gọi theo số dãy
    let vt = 0; const mau = phan.map((n) => { const s = ds.slice(vt, vt + n); vt += n; return new Set(s.map((g) => g.mau.id)); });
    if (mau.every((m) => m.size === 1) && new Set(mau.map((m) => [...m][0])).size > 1) return 'ket_hop';
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
    const dauGom = gom.length;
    const phanDs = chiaDay(ds.length).filter((p) => !gioiHanPhan || p.length <= gioiHanPhan);
    const truc = trucThu();
    // tòa khác kiểu lật: thử cả thứ tự ngược để cặp đối nhau (chữ U) có đủ hai cách
    if (ds.length === 2 && !!ds[0].goc.lat !== !!ds[1].goc.lat) for (const goc of truc) for (const lat of [false, true]) for (const bam of [true, false]) {
      const b = cacDay([ds[1], ds[0]], [1, 1], goc, false, lat, true, bam, false, coDinh) ?? null;
      if (b && chinhXac(b)) gom.push(chamNhanh('hai_day', b.slice(coDinh.length), `dao|${Math.round(goc)}`));
    }
    const NGAN_DAY = 90_000, mocDay = demDat;
    for (const goc of truc) for (const ngang of [false, true]) for (const lat of [false, true]) for (const xen of [false, true]) for (const phan of phanDs) for (const bam of [true, false]) {
      if (phan.length === 1 && (!bam || xen)) continue;
      if (demDat - mocDay > NGAN_DAY) continue;
      const le = phan.length > 1 && phan.every((x) => x === phan[0]) && phan[0] > 1;
      const b = cacDay(ds, phan, goc, ngang, lat, xen, bam, false, coDinh);
      if (b && chinhXac(b)) gom.push(chamNhanh(kieuDay(ds, phan), b.slice(coDinh.length), `${Math.round(goc)}|${ngang}|${phan.join()}`));
      if (le) { const c = cacDay(ds, phan, goc, ngang, lat, xen, bam, true, coDinh); if (c && chinhXac(c)) gom.push(chamNhanh('so_le', c.slice(coDinh.length), `${Math.round(goc)}|${ngang}|${phan.join()}|le`)); }
    }
    const NGAN_VIEN = 60_000, moc = demDat;
    for (const so of chiaCanh(ds.length, Math.min(4, canhV.length)).slice(0, 16)) for (const chua of [0, 10, 20, 30, 40, 50]) for (let lat = 0; lat < 1 << so.length && demDat - moc < NGAN_VIEN; lat++) {
      if (lat & so.reduce((a, x, i) => a + (x ? 0 : 1 << i), 0)) continue; // cạnh trống không cần xét lật
      const b = bamVien(ds, so, chua, lat, coDinh);
      if (b && chinhXac(b)) gom.push(chamNhanh('vien', b.slice(coDinh.length), `vien|${so.join()}|${lat}`));
    }
    const g = omGoc(ds, coDinh);
    if (g && chinhXac(g)) gom.push(chamNhanh('om_goc', g.slice(coDinh.length), 'om_goc'));
    if (gom.length - dauGom < 10) {
      const NGAN_DU = 60_000, mocDu = demDat;
      for (let dau = 0; dau < Math.min(4, canhV.length); dau++) for (const chieu of [1, -1] as const) for (const lech of [0, 90] as const) {
        if (demDat - mocDu > NGAN_DU) continue;
        const b = thamLam(ds, dau, chieu, lech, coDinh);
        if (b && chinhXac(b)) gom.push(chamNhanh('vien', b.slice(coDinh.length), `tl|${dau}|${chieu}|${lech}`));
      }
    }
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
    // duyệt từ nhiều tòa xuống ít tòa (lô nhỏ không chứa nổi tổ hợp sát DTXD tối đa), mỗi số tòa thử vài tập mẫu tốt nhất; đủ tập mẫu xếp được thì dừng
    const daThu = new Set<string>(), TOI_DA = 40, DU_TAP = 8, MOI_SO_TOA = 5;
    const soToa = (h: ToHop) => h.ds.reduce((a, x) => a + x[1], 0), demN = new Map<number, number>();
    const hangDoi = th.slice().sort((a, b) => soToa(b) - soToa(a) || diemTH(a) - diemTH(b));
    let thu = 0, coBoCuc = 0;
    for (const h of hangDoi) {
      if (thu >= TOI_DA || coBoCuc >= DU_TAP) break;
      const k = h.ds.map((x) => x[0]).join('+'), n = soToa(h);
      if (daThu.has(k) || (demN.get(n) ?? 0) >= MOI_SO_TOA) continue;
      daThu.add(k); demN.set(n, (demN.get(n) ?? 0) + 1); thu++;
      const ds = h.ds.flatMap(([id, c]) => Array.from({ length: c }, (_, j) => {
        const m = tv.toa.get(id)!, g = goiCua(m, thongTin.get(id)!.toa);
        return { ...g, goc: { ...g.goc, id: `goiy-${id}-${j}` } };
      }));
      const truoc = ung.length;
      sinhCho(ds, [], ung, ds.length <= 6 ? 3 : 2);
      if (ung.length > truoc) coBoCuc++;
      yield { xong: Math.max(thu / TOI_DA, coBoCuc / DU_TAP), tong: 3 };
    }
    // luôn thử một tổ hợp toàn tòa chữ L, V để có kiểu ôm góc
    const thL = th.find((h) => h.ds.every(([id]) => ['l', 'v'].includes(tv.toa.get(id)!.hinh ?? '')) && !daThu.has(h.ds.map((x) => x[0]).join('+')));
    if (thL) sinhCho(thL.ds.flatMap(([id, c]) => Array.from({ length: c }, (_, j) => {
      const g = goiCua(tv.toa.get(id)!, thongTin.get(id)!.toa);
      return { ...g, goc: { ...g.goc, id: `goiy-${id}-${j}` } };
    })), [], ung, 2);
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
  for (const kieu of KIEU_DS) {
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
  const chamDu = (b: BoCuc, khoa: string, giuTang = cheDo === 'sap_lai'): GoiYXep | null => {
    let toa: ToaDat[], r: ReturnType<typeof tinh>;
    if (giuTang) { toa = ganToa(b, null); r = tinh(toa); } else {
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
    const vw = viewCua(toa, b.dat), viewD = vw.tb ?? 0, w = TRONG_SO[uu], d0 = b.diem;
    const che = cheNangPct(b.dat.map((x, i) => ({ F: x.F, H: toa[i].soTangDe * toa[i].caoDe + toa[i].soTangDH * toa[i].caoDH })), [...coDinh.map((x) => ({ F: x.F, H: Hmax })), ...ngoaiMoi], caiV.viDo, caiV.gocBac);
    const d = { ...d0, nang: d0.nang * (1 - (0.5 * che) / 100) };
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
      sapLai: cheDo === 'sap_lai',
      boCuc: { nang: d.nang, gio: d.gio, view: viewD, mat: d.mat, san: d.san, tong, sanM2: d.sanM2, banKinhSan: d.banKinhSan, gioPct: d.gioPct, cheNangPct: che, moXanhPct: d.moXanhPct },
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
  for (const kieu of KIEU_DS) { const x = ketQua.find((y) => y.g.kieu === kieu && duoc(y)); if (x && chon.length < soGoiY) chon.push(x); }
  for (const x of ketQua) { if (chon.length >= soGoiY) break; if (duoc(x)) chon.push(x); }
  for (const x of ketQua) { if (chon.length >= soGoiY) break; if (!chon.includes(x) && !chon.some((y) => gan(y.b.dat, x.b.dat, 4))) chon.push(x); }
  chon.sort((a, b) => a.g.loiQH - b.g.loiQH || b.g.diem - a.g.diem);
  // đầu danh sách là mỗi kiểu bố cục một phương án tốt nhất, để vài thẻ đầu đã là những cách xếp khác hẳn nhau
  const daKieu = new Set<KieuBoCuc>(), dau: typeof chon = [], sau: typeof chon = [];
  for (const x of chon) { if (daKieu.has(x.g.kieu)) sau.push(x); else { daKieu.add(x.g.kieu); dau.push(x); } }
  chon.splice(0, chon.length, ...dau, ...sau);
  yield { xong: 3, tong: 3 };
  // điểm hiện trạng cùng thang đo, để so với các phương án
  let hienTrang: DiemBoCuc | undefined;
  const dsHT = toaLo.filter((x) => cheDo !== 'sap_lai' || !x.khoa);
  if (dsHT.length) {
    const dat0 = dsHT.map((x): Dat => { const g = goiCua(tv.toa.get(x.mauId)!, x), F = chanToa(g.mau, x); return { goi: g, x: x.x, y: x.y, g: x.gocDo, F, r: 0 }; });
    hienTrang = chamDu(chamNhanh('vien', dat0, 'hien_trang'), 'hien_trang', true)?.boCuc;
  }
  return chon.map((x) => ({ ...x.g, hienTrang }));
}

/** Gió và sân của các tòa đang đặt trên lô (không cần chạy bộ xếp). */
export function chamHienTrang(v: DauVaoXep): Pick<DiemBoCuc, 'gioPct' | 'sanM2' | 'gio' | 'san'> | null {
  const { pa, lo, tv } = v;
  const F = pa.toa.filter((x) => x.loId === lo.id && tv.toa.has(x.mauId)).map((x) => chanToa(tv.toa.get(x.mauId)!, x));
  if (!F.length) return null;
  const s = taoLuoiSan(lo.ranh).do(F), dtLo = dienTich(lo.ranh), gocBac = caiDatView(pa.huongView).gocBac;
  const gioPct = gioTheoHuong(lo.ranh, F, v.huongGio?.length ? v.huongGio : [{ pv: PHUONG_VI_GIO_HE, ts: 1 }], gocBac);
  return { gioPct, sanM2: s.m2, gio: diemGio(gioPct), san: diemSan(s.m2, s.r, dtLo) };
}
