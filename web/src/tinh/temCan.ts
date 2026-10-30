import type { Diem, ThuVien } from './kieu';
import { hinhLogia, khungTaiO, type ToaCoMat, type ViTriCan } from './matBang';

/**
 * TEM CĂN NGOÀI MẶT TIỀN — chép app cũ (MDI_Unitmix_v4 `prototype/shell.src.html`):
 *   QT-11 bảng thông tin căn đặt NGOÀI căn, khung một cỡ TAG_W × TAG_H (3760 × 2600 mm), cách mặt đứng TAG_OFF (900 mm);
 *   QT-34 dịch tâm ra ngoài đúng nửa bề dày hộp trục-thẳng đo theo pháp tuyến (hàm tựa r = W/2·|nx| + H/2·|ny|) — đúng cả cánh 30° / 150°;
 *   `neoTemKhung` căn góc V (chủ nhiệm 3/10/2026): tem nằm trên hàng tem của dãy KỀ có mặt tiền trùng cạnh ngoài khung căn dài nhất;
 *   `xepTem` TEM KHÔNG ĐÈ CĂN, KHÔNG ĐÈ TEM (chủ nhiệm 3/10/2026, ảnh Y2 · Z1 NOXH · T1 · T2 · Z3):
 *     0. tem không vướng (không chạm căn / lõi / thang, không chồng tem khác — lề 40 mm) giữ nguyên chỗ gốc, đặt trước;
 *     1. tem vướng xếp sau, theo thứ tự chu vi: dịch NHẸ dọc hàng tem (bước 250 mm, tới 0,6 × bề rộng tem, giữ đúng hàng);
 *     2. không được thì dời ra HÀNG NGOÀI song song (bước = bề dày tem + 400 mm, tới 3 hàng, dịch dọc tới 2,2 × bề rộng) —
 *        các tem dời của cùng mặt thẳng một hàng — chỗ mới phải cách mọi vật / tem đã đặt ≥ 150 mm;
 *     3. dời ra hàng ngoài hoặc trượt quá nửa bề rộng căn thì kẻ ĐƯỜNG DẪN gấp khúc vuông góc từ chân mặt tiền tới mép tem.
 *   App cũ hết chỗ thì giữ gốc (có thể đè). Bản web BỔ SUNG (QT-34b): vật cản thêm nét bao DTXD (đè nét bao = đè hình) và vật
 *   ngoài truyền vào; hết chỗ ở 3 hàng thì thử tiếp tới 8 hàng / dịch 4 × bề rộng, rồi vòng quanh khối — để không tem nào đè hình
 *   hay đè tem. Toạ độ mm thế giới, y lên (app cũ tính ở toạ độ SVG y xuống — hộp trục-thẳng nên kết quả như nhau).
 */
export const TEM_W = 3760;
export const TEM_H = 2600;
export const TEM_CACH = 900;
/** Chiều sâu bay chuẩn của thư viện căn (app cũ `BAY`). */
const BAY = 8500;

export type VeTem = {
  khoa: string;
  /** tâm tem (mm thế giới) */
  cx: number; cy: number;
  /** hướng "ra ngoài" của hàng tem (pháp tuyến mặt, hoặc mặt dãy kề với căn góc V) */
  huong: Diem;
  /** chân mặt tiền (giữa cạnh ngoài căn) — đầu đường dẫn */
  chan: Diem;
  /** đường dẫn gấp khúc khi tem bị dời (app cũ `dan`); null = tem ở hàng gốc */
  dan: Diem[] | null;
  /** tem bị dời khỏi chỗ gốc */
  doi: boolean;
};

export type KetQuaTem = {
  tem: VeTem[];
  /** mặt → khoảng hàng tem bị dời ra ngoài (mm), app cũ `kq.ngoai` (hàng dim lùi theo) */
  ngoai: Record<number, number>;
  /** số tem vẫn vướng sau mọi bước (0 là đạt) */
  vuong: number;
};

export type CanTem = { vt: ViTriCan; canId: string; cn?: string };

type Hop = [number, number, number, number];
type Vat = { P: Diem[]; b: Hop };

const rad = (d: number) => (d * Math.PI) / 180;
function coSo(gocDeg: number, truc: number) {
  const u: Diem = [Math.cos(rad(gocDeg)), Math.sin(rad(gocDeg))];
  const n: Diem = [-u[1], u[0]];
  return { u, n, truc, pt: (a: number, b: number): Diem => [u[0] * a + n[0] * (truc + b), u[1] * a + n[1] * (truc + b)] };
}
const hopDG = (P: Diem[]): Hop => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return [x0, y0, x1, y1];
};
const giao = (A: Hop, B: Hop) => A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3];

function trongDG(q: Diem, P: Diem[]) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Hộp trục-thẳng `r` chạm đa giác `P` (app cũ `rectChamDa`): đỉnh trong hộp, góc hộp trong đa giác, hoặc cạnh cắt nhau. */
export function hopChamDG(r: Hop, P: Diem[], bP?: Hop): boolean {
  const b = bP ?? hopDG(P);
  if (b[2] <= r[0] || b[0] >= r[2] || b[3] <= r[1] || b[1] >= r[3]) return false;
  if (P.some((p) => p[0] > r[0] && p[0] < r[2] && p[1] > r[1] && p[1] < r[3])) return true;
  const cs: Diem[] = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
  if (cs.some((q) => trongDG(q, P))) return true;
  const o = (p: Diem, q: Diem, s: Diem) => (q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]);
  const cat = (a: Diem, bb: Diem, c: Diem, d: Diem) => o(a, bb, c) * o(a, bb, d) < 0 && o(c, d, a) * o(c, d, bb) < 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], bb = P[(i + 1) % P.length];
    for (let k = 0; k < 4; k++) if (cat(a, bb, cs[k], cs[(k + 1) % 4])) return true;
  }
  return false;
}

/** Hộp tem tâm (cx, cy), nới lề m. */
export const hopTem = (cx: number, cy: number, m = 0): Hop => [cx - TEM_W / 2 - m, cy - TEM_H / 2 - m, cx + TEM_W / 2 + m, cy + TEM_H / 2 + m];

/** Ô thang bộ trên mặt: [a0, a1] × [0, sâu]. */
function oThang(m: { goc_deg: number; truc_mm: number }, a0: number, a1: number, sau: number): Diem[] {
  const B = coSo(m.goc_deg, m.truc_mm);
  return [B.pt(a0, 0), B.pt(a1, 0), B.pt(a1, sau), B.pt(a0, sau)];
}

/** Hình bao căn dùng làm vật cản (app cũ `hinhLogia(c) || bienCan(c)` = hốc logia → khung căn V → ô module). */
export function hinhCanTem(mau: ToaCoMat, tv: ThuVien, vt: ViTriCan, canId: string): Diem[] {
  const c = tv.can.get(canId);
  return hinhLogia(vt, mau, c?.logia_lui) ?? khungTaiO(mau, vt.matIdx, vt.a0, vt.a1, vt.sau, vt.guong, c?.khung) ?? vt.goc;
}

/** Vật cản của tầng: căn (mọi ô), thang bộ, lõi (`loi`: đa giác tường lõi, `daGiacCacLoi`), nét bao DTXD (bổ sung), vật ngoài `them`. */
export function vatCanTem(mau: ToaCoMat, tv: ThuVien, can: CanTem[], loi: Diem[][] = [], them: Diem[][] = []): Diem[][] {
  const ds: Diem[][] = can.map((c) => hinhCanTem(mau, tv, c.vt, c.canId));
  for (const m of mau.mat) for (const q of m.phan_tu) if (q.loai === 'thang_bo' && !q.bang) ds.push(oThang(m, q.a0, q.a1, q.sau_mm ?? BAY));
  if (mau.duong_bao?.length > 2) ds.push(mau.duong_bao);
  return [...ds, ...loi, ...them].filter((P) => P.length > 2);
}

type Goc = { cx: number; cy: number; out: Diem; tan: Diem; rTag: number; chan: Diem; fi: number; rong: number };

/** Căn góc V (`neoTemKhung`): mặt KỀ có cạnh ngoài (b = BAY) trùng cạnh khung căn dài nhất (> 1 m). */
function neoTemKhung(mau: ToaCoMat, vt: ViTriCan, P: Diem[], matCoCan: Set<number>) {
  let best: { L: number; B: ReturnType<typeof coSo>; a: number; fi: number } | null = null;
  mau.mat.forEach((f, fi) => {
    if (fi === vt.matIdx || !matCoCan.has(fi)) return;
    const B = coSo(f.goc_deg, f.truc_mm);
    let L = 0, a0 = Infinity, a1 = -Infinity;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      const bp = p[0] * B.n[0] + p[1] * B.n[1] - f.truc_mm, bq = q[0] * B.n[0] + q[1] * B.n[1] - f.truc_mm;
      if (Math.abs(bp - BAY) < 400 && Math.abs(bq - BAY) < 400) {
        const ap = p[0] * B.u[0] + p[1] * B.u[1], aq = q[0] * B.u[0] + q[1] * B.u[1];
        L += Math.abs(aq - ap); a0 = Math.min(a0, ap, aq); a1 = Math.max(a1, ap, aq);
      }
    }
    if (L > 1000 && (!best || L > best.L)) best = { L, B, a: (a0 + a1) / 2, fi };
  });
  return best as { L: number; B: ReturnType<typeof coSo>; a: number; fi: number } | null;
}

/** Vị trí gốc của tem (app cũ `temGoc`): giữa mặt tiền, đẩy ra ngoài TAG_OFF + nửa bề dày hộp theo pháp tuyến. */
function temGoc(mau: ToaCoMat, vt: ViTriCan, khung: Diem[] | null, matCoCan: Set<number>): Goc {
  const m = mau.mat[vt.matIdx], B = coSo(m.goc_deg, m.truc_mm), w = vt.a1 - vt.a0;
  const nk = khung ? neoTemKhung(mau, vt, khung, matCoCan) : null;
  const mid = nk ? nk.B.pt(nk.a, BAY + TEM_CACH) : B.pt(vt.a0 + w / 2, vt.sau + TEM_CACH);
  const chan = nk ? nk.B.pt(nk.a, BAY) : B.pt(vt.a0 + w / 2, vt.sau);
  const out = nk ? nk.B.n : B.n, tan = nk ? nk.B.u : B.u;
  const rTag = (TEM_W / 2) * Math.abs(out[0]) + (TEM_H / 2) * Math.abs(out[1]);
  return { cx: mid[0] + out[0] * rTag, cy: mid[1] + out[1] * rTag, out, tan, rTag, chan, fi: nk ? nk.fi : vt.matIdx, rong: w };
}

const nho = new WeakMap<object, Map<string, KetQuaTem>>();

/**
 * Đặt tem cho các căn `can` (chỉ ô công năng căn hộ có mẫu trong thư viện mới có tem; mọi ô vẫn là vật cản). Nhớ theo mặt bằng
 * (`mau`) + khoá bố cục: vẽ lại / đổi lớp không giải lại. `loi` = đa giác lõi (`daGiacCacLoi`, có khi đã nạp DuLieuMB), `them` = vật
 * cản ngoài (đa giác mm), ví dụ ký hiệu đặt ngoài nét bao.
 */
export function datTemCan(mau: ToaCoMat, tv: ThuVien, can: CanTem[], loi: Diem[][] = [], them: Diem[][] = []): KetQuaTem {
  const khoa = can.map((c) => `${c.vt.khoa}|${c.canId}|${c.cn ?? 'can'}|${Math.round(c.vt.a0)}|${Math.round(c.vt.a1)}|${c.vt.guong ? 1 : 0}`).join(';')
    + `#${loi.length}:${loi.map((P) => Math.round(P[0][0]) + ',' + Math.round(P[0][1])).join(' ')}`
    + (them.length ? '#' + them.map((P) => P.map((p) => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ')).join('/') : '');
  let m = nho.get(mau);
  const cu = m?.get(khoa);
  if (cu) return cu;
  const kq = xepTem(mau, tv, can, loi, them);
  if (!m) { m = new Map(); nho.set(mau, m); }
  if (m.size > 24) m.clear();
  m.set(khoa, kq);
  return kq;
}

function xepTem(mau: ToaCoMat, tv: ThuVien, can: CanTem[], loi: Diem[][], them: Diem[][]): KetQuaTem {
  const vat: Vat[] = vatCanTem(mau, tv, can, loi, them).map((P) => ({ P, b: hopDG(P) }));
  const matCoCan = new Set(mau.mat.flatMap((f, fi) => (f.phan_tu.some((q) => q.loai === 'can') ? [fi] : [])));
  // thứ tự như GEOM.cells app cũ: theo mặt rồi dọc mặt (thứ tự quyết định tem nào giữ gốc khi hai tem chồng nhau)
  const ds = can.filter((c) => (c.cn ?? 'can') === 'can' && tv.can.has(c.canId))
    .sort((p, q) => p.vt.matIdx - q.vt.matIdx || p.vt.a0 - q.vt.a0).map((c) => {
    const khung = khungTaiO(mau, c.vt.matIdx, c.vt.a0, c.vt.a1, c.vt.sau, c.vt.guong, tv.can.get(c.canId)?.khung);
    return { c, g: temGoc(mau, c.vt, khung, matCoCan), xau: false };
  });
  const vuongCan = (r: Hop) => vat.some((v) => hopChamDG(r, v.P, v.b));
  // vướng ở chỗ GỐC: chạm căn / lõi / thang / nét bao, hoặc chồng tem khác (lề 40 mm)
  ds.forEach((t, i) => {
    const r = hopTem(t.g.cx, t.g.cy, 40);
    t.xau = vuongCan(r) || ds.some((o, j) => j !== i && giao(r, hopTem(o.g.cx, o.g.cy, 40)));
  });
  const dat: Hop[] = [];
  const kq = new Map<string, { cx: number; cy: number; dan: Diem[] | null }>();
  const ngoai: Record<number, number> = {};
  const tot = (cx: number, cy: number) => { const r = hopTem(cx, cy, 150); return !vuongCan(r) && !dat.some((R) => giao(r, R)); };
  // tem không vướng giữ nguyên, đặt trước; tem vướng xếp sau (tem đầu của một cặp chồng nhau thường giữ được gốc)
  ds.filter((t) => !t.xau).forEach((t) => dat.push(hopTem(t.g.cx, t.g.cy)));
  let vuong = 0;
  for (const t of ds.filter((x) => x.xau)) {
    const g = t.g, buoc = 2 * g.rTag + 400;
    let chon: { cx: number; cy: number; k: number; s: number } | null = null;
    const thu = (kMax: number, lim: (k: number) => number, k0 = 0) => {
      for (let k = k0; k < kMax && !chon; k++) {
        const L = lim(k);
        for (let s = 0; s <= L && !chon; s += 250) for (const sg of s ? [1, -1] : [1]) {
          const cx = g.cx + g.out[0] * buoc * k + g.tan[0] * s * sg, cy = g.cy + g.out[1] * buoc * k + g.tan[1] * s * sg;
          if (tot(cx, cy)) { chon = { cx, cy, k, s: s * sg }; break; }
        }
      }
    };
    // app cũ: hàng gốc dịch ≤ 0,6 W, rồi 3 hàng ngoài dịch ≤ 2,2 W
    thu(4, (k) => (k === 0 ? TEM_W * 0.6 : TEM_W * 2.2));
    // bổ sung: hàng gốc dịch xa hơn, rồi tới 8 hàng ngoài dịch ≤ 4 W
    if (!chon) thu(1, () => TEM_W * 4);
    if (!chon) thu(9, () => TEM_W * 4, 1);
    if (!chon) {
      // vòng quanh khối: tia từ chân mặt tiền, quét góc ±90°, ra xa dần
      for (let d = g.rTag + TEM_CACH; d < 60000 && !chon; d += 600) {
        for (let a = 0; a <= 90 && !chon; a += 10) for (const sg of a ? [1, -1] : [1]) {
          const r = rad(a * sg), ux = g.out[0] * Math.cos(r) - g.out[1] * Math.sin(r), uy = g.out[0] * Math.sin(r) + g.out[1] * Math.cos(r);
          const cx = g.chan[0] + ux * d, cy = g.chan[1] + uy * d;
          if (tot(cx, cy)) {
            const v: Diem = [cx - g.cx, cy - g.cy];
            chon = { cx, cy, k: Math.max(1, Math.round((v[0] * g.out[0] + v[1] * g.out[1]) / buoc)), s: v[0] * g.tan[0] + v[1] * g.tan[1] };
            break;
          }
        }
      }
    }
    if (!chon) { dat.push(hopTem(g.cx, g.cy)); vuong++; continue; } // hết chỗ: giữ gốc (app cũ)
    const c = chon as { cx: number; cy: number; k: number; s: number };
    dat.push(hopTem(c.cx, c.cy));
    let dan: Diem[] | null = null;
    if (c.k > 0 || Math.abs(c.s) > g.rong / 2 - 300) {
      // đường dẫn gấp khúc vuông góc: chân mặt tiền → ra ngoài nửa khoảng hở → dọc hàng → tới mép tem
      const A = g.chan, d: Diem = [c.cx - A[0], c.cy - A[1]];
      const sT = d[0] * g.tan[0] + d[1] * g.tan[1], sO = d[0] * g.out[0] + d[1] * g.out[1] - g.rTag;
      const pt = (a: number, b: number): Diem => [A[0] + g.tan[0] * a + g.out[0] * b, A[1] + g.tan[1] * a + g.out[1] * b];
      dan = Math.abs(sT) < TEM_W / 2 - 150 ? [A, pt(0, sO)] : [A, pt(0, TEM_CACH * 0.5), pt(sT, TEM_CACH * 0.5), pt(sT, sO)];
    }
    kq.set(t.c.vt.khoa, { cx: c.cx, cy: c.cy, dan });
    if (c.k > 0) ngoai[g.fi] = Math.max(ngoai[g.fi] ?? 0, buoc * c.k);
  }
  const tem = ds.map(({ c, g }): VeTem => {
    const d = kq.get(c.vt.khoa);
    return { khoa: c.vt.khoa, cx: d ? d.cx : g.cx, cy: d ? d.cy : g.cy, huong: g.out, chan: g.chan, dan: d?.dan ?? null, doi: !!d && (Math.abs(d.cx - g.cx) > 1 || Math.abs(d.cy - g.cy) > 1) };
  });
  return { tem, ngoai, vuong };
}

/** Hộp bao mọi tem (mm) — để khung "vừa màn hình" chứa cả tem bị dời ra hàng ngoài. */
export function hopCacTem(kq: KetQuaTem): Hop | null {
  if (!kq.tem.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of kq.tem) { x0 = Math.min(x0, t.cx - TEM_W / 2); x1 = Math.max(x1, t.cx + TEM_W / 2); y0 = Math.min(y0, t.cy - TEM_H / 2); y1 = Math.max(y1, t.cy + TEM_H / 2); }
  return [x0, y0, x1, y1];
}
