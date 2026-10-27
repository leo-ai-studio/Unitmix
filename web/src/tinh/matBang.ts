/**
 * Mặt bằng tầng điển hình ghép từ mẫu tòa (`mat[].phan_tu`) + hình học mẫu căn / lõi trong thư viện.
 * Hàm thuần, toạ độ mm như toa.json. Một mặt có hệ trục: thế giới = a·u + (truc + b)·n, căn chiếm a ∈ [a0, a1], b ∈ [0, sâu].
 */
import type { CanMau, Diem, ThuVien, ToaDat, ToaMau } from './kieu';
import type { MatToa, PhanTuMat } from './pccc';

export type ToaCoMat = ToaMau & { mat: MatToa[] };
export type NetVe = { cat: string; pts: Diem[] };
export type ViTriCan = {
  khoa: string; // "<mặt>:<chỉ số phần tử>" — ổn định theo mẫu tòa, dùng làm khoá đổi căn theo vị trí
  matIdx: number;
  canGocId: string; // id căn trong thư viện theo mẫu tòa gốc
  a0: number;
  a1: number;
  sau: number;
  guong: boolean; // sx < 0: căn lật gương theo trục dọc hành lang
  goc: Diem[]; // 4 góc căn (mm, thế giới)
};

const rad = (d: number) => (d * Math.PI) / 180;
function coSo(gocDeg: number, truc: number) {
  const u: Diem = [Math.cos(rad(gocDeg)), Math.sin(rad(gocDeg))];
  const n: Diem = [-u[1], u[0]];
  return { pt: (a: number, b: number): Diem => [u[0] * a + n[0] * (truc + b), u[1] * a + n[1] * (truc + b)] };
}

let nho: { tv: ThuVien; theoMa: Map<string, string> } | null = null;
const idTheoMa = (tv: ThuVien, ma: string): string | undefined => {
  if (nho?.tv !== tv) nho = { tv, theoMa: new Map([...tv.can.values()].map((c) => [c.ma_goc, c.id])) };
  return nho.theoMa.get(ma);
};

/** Các vị trí căn trên một tầng của mẫu tòa, theo thứ tự mặt rồi phần tử. */
export function viTriCan(mau: ToaCoMat, tv: ThuVien): ViTriCan[] {
  const kq: ViTriCan[] = [];
  mau.mat.forEach((m, matIdx) => {
    const B = coSo(m.goc_deg, m.truc_mm);
    m.phan_tu.forEach((q, i) => {
      if (q.loai !== 'can') return;
      const id = idTheoMa(tv, q.ma_thu_vien || q.block);
      if (!id) return;
      const sau = q.sau_mm || 8500;
      kq.push({
        khoa: `${matIdx}:${i}`, matIdx, canGocId: id, a0: q.a0, a1: q.a1, sau, guong: q.sx < 0,
        goc: [B.pt(q.a0, 0), B.pt(q.a1, 0), B.pt(q.a1, sau), B.pt(q.a0, sau)],
      });
    });
  });
  return kq;
}

type DoiCan = Pick<ToaDat, 'canTheo' | 'canViTri'>;

/** Căn đang dùng ở từng vị trí: đổi theo vị trí thắng đổi theo mẫu, rồi mới đến căn gốc. */
export const canDangDung = (vt: ViTriCan, toa: DoiCan): string => toa.canViTri?.[vt.khoa] ?? toa.canTheo[vt.canGocId] ?? vt.canGocId;

export const coMat = (m: ToaMau): m is ToaCoMat => Array.isArray((m as ToaCoMat).mat);

/**
 * Căn của một tầng điển hình dạng gộp [id căn, số căn]. Tòa chưa đổi theo vị trí thì lấy thẳng `co_cau` (mẫu thư viện không cần
 * hình học mặt tầng); có đổi theo vị trí thì đếm theo từng vị trí. Hai đường cho cùng kết quả khi không có đổi theo vị trí.
 */
export function canCuaToa(mau: ToaMau, toa: DoiCan, tv: ThuVien): [string, number][] {
  if (toa.canViTri && Object.keys(toa.canViTri).length && coMat(mau)) {
    const dem = new Map<string, number>();
    for (const vt of viTriCan(mau, tv)) dem.set(canDangDung(vt, toa), (dem.get(canDangDung(vt, toa)) ?? 0) + 1);
    return [...dem];
  }
  return Object.entries(mau.co_cau).map(([g, n]) => [toa.canTheo[g] ?? g, n]);
}

/**
 * Số căn CH-01… chạy liên tục quanh chu vi tòa, như app cũ: chiếu điểm giữa cạnh ngoài của căn lên đường bao,
 * mốc 0 là đỉnh thấp nhất bên trái, chiều ngược kim đồng hồ.
 */
export function soCanChuVi(duongBao: Diem[], vts: ViTriCan[]): Map<string, number> {
  let P = duongBao.map((q): Diem => [q[0], q[1]]);
  while (P.length > 3 && Math.abs(P[0][0] - P.at(-1)![0]) < 1 && Math.abs(P[0][1] - P.at(-1)![1]) < 1) P.pop();
  if (P.length < 3) return new Map(vts.map((v, i) => [v.khoa, i + 1]));
  let dt = 0;
  for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; dt += P[i][0] * P[j][1] - P[j][0] * P[i][1]; }
  if (dt < 0) P.reverse();
  let k0 = 0;
  for (let i = 1; i < P.length; i++) if (P[i][1] < P[k0][1] - 1 || (Math.abs(P[i][1] - P[k0][1]) <= 1 && P[i][0] < P[k0][0])) k0 = i;
  P = P.slice(k0).concat(P.slice(0, k0));
  const cum = [0];
  const doan = P.map((a, i) => {
    const b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    cum.push(cum[i] + L);
    return { x: a[0], y: a[1], dx, dy, L };
  });
  const chieu = (q: Diem) => {
    let tot = Infinity, s = 0;
    doan.forEach((g, i) => {
      const L2 = g.dx * g.dx + g.dy * g.dy;
      const t = L2 ? Math.max(0, Math.min(1, ((q[0] - g.x) * g.dx + (q[1] - g.y) * g.dy) / L2)) : 0;
      const d = Math.hypot(q[0] - (g.x + t * g.dx), q[1] - (g.y + t * g.dy));
      if (d < tot - 1e-6) { tot = d; s = cum[i] + t * g.L; }
    });
    return s;
  };
  return new Map(
    vts
      .map((vt, i) => ({ vt, i, s: chieu([(vt.goc[2][0] + vt.goc[3][0]) / 2, (vt.goc[2][1] + vt.goc[3][1]) / 2]) }))
      .sort((a, b) => a.s - b.s || a.i - b.i)
      .map((o, k) => [o.vt.khoa, k + 1]),
  );
}

/** Mẫu căn có thể đổi vào chỗ `canId`: cùng nhóm, cùng bề ngang và chiều sâu. `cungViTri` giữ đúng giữa/góc (cách tối ưu tự động dùng). */
export function ungVienDoi(canId: string, tv: ThuVien, cungViTri = false): CanMau[] {
  const g = tv.can.get(canId);
  if (!g) return [];
  return [...tv.can.values()]
    .filter((c) => c.id !== canId && c.nhom === g.nhom && c.rong_mm === g.rong_mm && c.sau_mm === g.sau_mm && (!cungViTri || c.vi_tri === g.vi_tri))
    .sort((a, b) => Number(b.vi_tri === g.vi_tri) - Number(a.vi_tri === g.vi_tri) || a.id.localeCompare(b.id));
}

/** Nét vẽ mẫu căn (toạ độ chuẩn hoá 0..1 theo rộng × sâu) đặt vào vị trí trên mặt tòa. */
export function veCanTaiViTri(ve: NetVe[], vt: ViTriCan, mau: ToaCoMat): NetVe[] {
  const m = mau.mat[vt.matIdx], B = coSo(m.goc_deg, m.truc_mm), w = vt.a1 - vt.a0;
  return ve.map((n) => ({ cat: n.cat, pts: n.pts.map(([x, y]) => B.pt(vt.a0 + (vt.guong ? 1 - x : x) * w, y * vt.sau)) }));
}

/** Hình học lõi (mm cục bộ) đặt theo điểm chèn, góc quay và tỷ lệ của phần tử (tỷ lệ trước, quay sau, rồi dời). */
export function veLoiTaiViTri(paths: NetVe[], q: Pick<PhanTuMat, 'x' | 'y' | 'rot' | 'sx' | 'sy'>): NetVe[] {
  const c = Math.cos(rad(q.rot)), s = Math.sin(rad(q.rot));
  return paths.map((n) => ({
    cat: n.cat,
    pts: n.pts.map(([x, y]): Diem => {
      const X = x * q.sx, Y = y * q.sy;
      return [q.x + X * c - Y * s, q.y + X * s + Y * c];
    }),
  }));
}

const dtDG = (P: Diem[]): number => {
  let a = 0;
  for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length]; a += A[0] * B[1] - B[0] * A[1]; }
  return Math.abs(a) / 2;
};

/** Ranh tô màu của căn: đường bao tim tường lớn nhất (nét `tim`, đã loại hốc logia), toạ độ thế giới. Không có thì null. */
export function ranhTo(nets: NetVe[]): Diem[] | null {
  let tot: Diem[] | null = null, dtTot = 0;
  for (const n of nets) {
    if (n.cat !== 'tim' || n.pts.length < 4) continue;
    const dt = dtDG(n.pts);
    if (dt > dtTot) { dtTot = dt; tot = n.pts; }
  }
  return tot;
}

/** Ranh căn hình đặc biệt (nét `khung`, căn góc tòa V): đa giác kín DefPoints. Không có thì null. */
export const khungCanNet = (nets: NetVe[]): Diem[] | null => nets.find((n) => n.cat === 'khung' && n.pts.length >= 3)?.pts ?? null;

/** Ô module của căn có hốc logia lùi (khuyết ở góc ngoài): đa giác 6 hoặc 4 đỉnh theo thế giới. Không có hốc thì null. */
export function hinhLogia(vt: ViTriCan, mau: ToaCoMat, logia: number[][] | null | undefined): Diem[] | null {
  const h = logia?.[0];
  if (!h) return null;
  const m = mau.mat[vt.matIdx], B = coSo(m.goc_deg, m.truc_mm), w = vt.a1 - vt.a0, d = vt.sau;
  const [x0, x1] = vt.guong ? [1 - h[1], 1 - h[0]] : [h[0], h[1]];
  const s0 = x0 * w, s1 = x1 * w, yb = h[2] * d;
  const L: Diem[] = [[0, 0], [w, 0]];
  if (s1 > w - 1) L.push([w, yb]); else L.push([w, d], [s1, d], [s1, yb]);
  if (s0 < 1) L.push([0, yb]); else L.push([s0, yb], [s0, d], [0, d]);
  return L.map(([x, y]) => B.pt(vt.a0 + x, y));
}

/** Đa giác co vào trong `d` mm (giao các cạnh đã tịnh tiến), như coDaGiac của app cũ — dùng vẽ vành tường quanh căn. */
export function coDaGiac(P: Diem[], d: number): Diem[] {
  const n = P.length;
  let ar = 0;
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; }
  const sg = ar > 0 ? 1 : -1;
  const L = P.map((a, i) => {
    const b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return { p: [a[0] + (-dy / l) * sg * d, a[1] + (dx / l) * sg * d] as Diem, r: [dx, dy] as Diem };
  });
  return L.map((e, i) => {
    const f = L[(i + n - 1) % n], den = f.r[0] * e.r[1] - f.r[1] * e.r[0];
    if (Math.abs(den) < 1e-9) return e.p;
    const k = ((e.p[0] - f.p[0]) * e.r[1] - (e.p[1] - f.p[1]) * e.r[0]) / den;
    return [f.p[0] + f.r[0] * k, f.p[1] + f.r[1] * k] as Diem;
  });
}

/**
 * Căn có vừa khít ô module không: nét không tràn quá ±(125 mm + 300) theo bề ngang và [−320, 1360]/1000 theo chiều sâu.
 * Vừa thì cắt nét về module ± 125 mm để tường chung (vẽ một lần, nhô một bên 0–194 mm) không bị nhân đôi hay thiếu.
 * Căn góc / nêm (tòa Y, T, V) trải ra ngoài module nên không cắt — cắt sẽ xén mất nội thất.
 */
export function canVuaModule(ve: NetVe[], rongMm: number, coKhung: boolean): boolean {
  if (coKhung) return false;
  const hx = (125 / rongMm) * 1000;
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (const n of ve) for (const [x, y] of n.pts) { mnx = Math.min(mnx, x * 1000); mxx = Math.max(mxx, x * 1000); mny = Math.min(mny, y * 1000); mxy = Math.max(mxy, y * 1000); }
  return mnx >= -(hx + 300) && mxx <= 1000 + hx + 300 && mny >= -320 && mxy <= 1360;
}

/** Vùng cắt nét căn: ô module mở ra 125 mm hai bên theo bề ngang và 2 % chiều sâu hai đầu. */
export function vungCatCan(vt: ViTriCan, mau: ToaCoMat): Diem[] {
  const m = mau.mat[vt.matIdx], B = coSo(m.goc_deg, m.truc_mm), e = 0.02 * vt.sau;
  return [B.pt(vt.a0 - 125, -e), B.pt(vt.a1 + 125, -e), B.pt(vt.a1 + 125, vt.sau + e), B.pt(vt.a0 - 125, vt.sau + e)];
}
