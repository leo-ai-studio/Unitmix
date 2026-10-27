/**
 * Mặt bằng tầng điển hình ghép từ mẫu tòa (`mat[].phan_tu`) + hình học mẫu căn / lõi trong thư viện.
 * Hàm thuần, toạ độ mm như toa.json. Một mặt có hệ trục: thế giới = a·u + (truc + b)·n, căn chiếm a ∈ [a0, a1], b ∈ [0, sâu].
 */
import type { BoCucTang, CanMau, CongNangO, Diem, LoaiCan, ThuVien, ToaDat, ToaMau } from './kieu';
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

/**
 * Các vị trí căn trên một tầng của mẫu tòa, theo thứ tự mặt rồi phần tử. Có bố cục `bc` thì dồn khít (XC-04) theo bề ngang
 * mẫu căn đang dùng (đổi mẫu khác bề ngang / STRETCH): xem `donKhit`. Không có thì đúng vị trí bản vẽ.
 */
export function viTriCan(mau: ToaCoMat, tv: ThuVien, bc?: Pick<ToaDat, 'canTheo' | 'canViTri'>): ViTriCan[] {
  const kq = viTriGoc(mau, tv);
  return bc ? donKhit(mau, kq, bc, tv).vts : kq;
}

function viTriGoc(mau: ToaCoMat, tv: ThuVien): ViTriCan[] {
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

/** Bố cục MỘT tầng: đổi căn theo mẫu / vị trí và công năng ô. */
export type BoCuc = Pick<ToaDat, 'canTheo' | 'canViTri' | 'congNang'>;
/** Bố cục cả tòa: bố cục chung + ghi đè theo tầng. */
export type BoCucToa = BoCuc & Pick<ToaDat, 'tangRieng' | 'soTangDH'>;

/** Căn đang dùng ở từng vị trí: đổi theo vị trí thắng đổi theo mẫu, rồi mới đến căn gốc. */
export const canDangDung = (vt: ViTriCan, toa: Pick<ToaDat, 'canTheo' | 'canViTri'>): string => toa.canViTri?.[vt.khoa] ?? toa.canTheo[vt.canGocId] ?? vt.canGocId;
/** Công năng ô tại vị trí (thiếu = căn hộ). */
export const congNangTai = (khoa: string, bc: Pick<ToaDat, 'congNang'>): CongNangO => bc.congNang?.[khoa] ?? 'can';

export const coMat = (m: ToaMau): m is ToaCoMat => Array.isArray((m as ToaCoMat).mat);

const gonMap = <V>(m: Record<string, V> | undefined): Record<string, V> | undefined => (m && Object.keys(m).length ? m : undefined);

/** Ghi đè của tầng `tang` (1..soTangDH) nếu có và còn nằm trong số tầng điển hình; không thì null. */
export function ghiDeTang(toa: Pick<ToaDat, 'tangRieng' | 'soTangDH'>, tang: number): BoCucTang | null {
  if (!Number.isInteger(tang) || tang < 1 || tang > toa.soTangDH) return null;
  const g = toa.tangRieng?.[tang];
  return g && (gonMap(g.canViTri) || gonMap(g.congNang) || g.coCauMucTieu) ? g : null;
}

/** Bố cục thực của một tầng: chung (tang = null) hoặc chung + ghi đè riêng của tầng. */
export function boCucTang(toa: BoCucToa, tang: number | null): BoCuc {
  const g = tang === null ? null : ghiDeTang(toa, tang);
  if (!g || (!gonMap(g.canViTri) && !gonMap(g.congNang))) return { canTheo: toa.canTheo, canViTri: toa.canViTri, congNang: toa.congNang };
  return {
    canTheo: toa.canTheo,
    canViTri: gonMap({ ...(toa.canViTri ?? {}), ...(g.canViTri ?? {}) }),
    congNang: gonMap({ ...(toa.congNang ?? {}), ...(g.congNang ?? {}) }),
  };
}

/** Các tầng có bố cục riêng (đã sắp, trong 1..soTangDH, có ghi đè căn / công năng). */
export const tangCoRieng = (toa: Pick<ToaDat, 'tangRieng' | 'soTangDH'>): number[] =>
  Object.keys(toa.tangRieng ?? {}).map(Number).filter((k) => { const g = ghiDeTang(toa, k); return !!g && (!!gonMap(g.canViTri) || !!gonMap(g.congNang)); }).sort((a, b) => a - b);

/** Nhóm tầng cùng bố cục: bố cục chung × số tầng không ghi đè + từng tầng có ghi đè × 1. */
export function nhomTang(toa: BoCucToa): { tang: number | null; so: number }[] {
  const rieng = tangCoRieng(toa);
  const chung = Math.max(0, toa.soTangDH - rieng.length);
  return [...(chung ? [{ tang: null, so: chung }] : []), ...rieng.map((k) => ({ tang: k, so: 1 }))];
}

/** Mục tiêu cơ cấu riêng của tầng (S12); không có thì null. */
export const coCauRiengTang = (toa: Pick<ToaDat, 'tangRieng' | 'soTangDH'>, tang: number | null): Record<LoaiCan, number> | null =>
  (tang === null ? null : ghiDeTang(toa, tang)?.coCauMucTieu) ?? null;

/**
 * Căn của MỘT tầng (bố cục `toa`) dạng gộp [id căn, số căn]; ô đổi công năng không tính. Tòa chưa đổi theo vị trí / công năng thì
 * lấy thẳng `co_cau` (mẫu thư viện không cần hình học mặt tầng); có thì đếm theo từng vị trí. Hai đường cho cùng kết quả khi không đổi.
 */
export function canCuaToa(mau: ToaMau, toa: BoCuc, tv: ThuVien): [string, number][] {
  if ((gonMap(toa.canViTri) || gonMap(toa.congNang)) && coMat(mau)) {
    const dem = new Map<string, number>();
    for (const vt of viTriCan(mau, tv)) {
      if (congNangTai(vt.khoa, toa) !== 'can') continue;
      const id = canDangDung(vt, toa);
      dem.set(id, (dem.get(id) ?? 0) + 1);
    }
    return [...dem];
  }
  return Object.entries(mau.co_cau).map(([g, n]) => [toa.canTheo[g] ?? g, n]);
}

/** Căn của cả tòa (mọi tầng điển hình, theo bố cục từng tầng) dạng gộp [id căn, số căn]. */
export function canCaToa(mau: ToaMau, toa: BoCucToa, tv: ThuVien): [string, number][] {
  const dem = new Map<string, number>();
  for (const { tang, so } of nhomTang(toa)) for (const [id, n] of canCuaToa(mau, boCucTang(toa, tang), tv)) dem.set(id, (dem.get(id) ?? 0) + n * so);
  return [...dem];
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
    .filter((c) => c.id !== canId && !c.stretchGoc && c.nhom === g.nhom && c.rong_mm === g.rong_mm && c.sau_mm === g.sau_mm && (!cungViTri || c.vi_tri === g.vi_tri))
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

// ---- Dồn khít dãy căn (XC-04 · QT-30/QT-69 app cũ) ----

/** Dung sai vị trí căn (XC-01: 2 mm). */
export const KHIT_MM = 2;

/** Một đoạn dãy căn: các vị trí liền nhau (khe ≤ KHIT_MM) trên cùng một mặt, giữa hai mốc (lõi / thang bộ / khe / đầu mặt). */
export type DoanCan = { matIdx: number; ds: number[]; a0: number; a1: number };

/** Chia vị trí căn thành đoạn liền khít; `ds` là chỉ số trong mảng `vts`, sắp theo a0. */
export function doanCan(vts: ViTriCan[]): DoanCan[] {
  const theoMat = new Map<number, number[]>();
  vts.forEach((v, i) => (theoMat.get(v.matIdx) ?? theoMat.set(v.matIdx, []).get(v.matIdx)!).push(i));
  const kq: DoanCan[] = [];
  for (const [matIdx, ds] of theoMat) {
    ds.sort((i, j) => vts[i].a0 - vts[j].a0);
    let cur: DoanCan | null = null;
    for (const i of ds) {
      const v = vts[i];
      if (cur && Math.abs(v.a0 - cur.a1) <= KHIT_MM) { cur.ds.push(i); cur.a1 = v.a1; continue; }
      cur = { matIdx, ds: [i], a0: v.a0, a1: v.a1 };
      kq.push(cur);
    }
  }
  return kq;
}

/** Chênh bề ngang (mm) của căn đang dùng so với căn gốc tại vị trí. */
export const chenhRong = (vt: ViTriCan, id: string, tv: ThuVien): number =>
  (tv.can.get(id)?.rong_mm ?? 0) - (tv.can.get(vt.canGocId)?.rong_mm ?? 0);

export type KetQuaDonKhit = {
  vts: ViTriCan[];
  /** Đoạn có tổng bề ngang đổi (mm, ≠ 0): dãy dài ra / ngắn đi ở đầu tự do — bố cục tự động không tạo trường hợp này. */
  lech: { matIdx: number; mm: number }[];
  /** Đoạn dài ra chạm mốc kế bên (lõi / thang / đoạn khác): đè. */
  de: number[];
};

/**
 * Dồn khít: mỗi đoạn giữ nguyên mốc, căn xếp liền nhau theo bề ngang mới (bề ngang ô bản vẽ + chênh bề ngang mẫu).
 * Tổng bề ngang đoạn không đổi → hai đầu đoạn đứng yên (không khe, không đè). Tổng đổi → giữ đầu sát mốc gần hơn (lõi /
 * thang, như app cũ dồn về lõi), đầu kia dài ra / co lại và báo `lech`; dài ra chạm mốc kế bên thì báo `de`.
 */
export function donKhit(mau: ToaCoMat, vtsGoc: ViTriCan[], bc: Pick<ToaDat, 'canTheo' | 'canViTri'>, tv: ThuVien): KetQuaDonKhit {
  const vts = vtsGoc.slice();
  const lech: KetQuaDonKhit['lech'] = [], de: number[] = [];
  const doan = doanCan(vtsGoc);
  doan.forEach((d, di) => {
    const rong = d.ds.map((i) => vtsGoc[i].a1 - vtsGoc[i].a0 + chenhRong(vtsGoc[i], canDangDung(vtsGoc[i], bc), tv));
    const tong = rong.reduce((a, b) => a + b, 0), chenh = tong - (d.a1 - d.a0);
    if (d.ds.every((i, k) => Math.abs(rong[k] - (vtsGoc[i].a1 - vtsGoc[i].a0)) < 1e-6)) return;
    // mốc kề hai đầu: phần tử không phải căn hoặc đoạn khác trên cùng mặt
    const m = mau.mat[d.matIdx];
    const ke = [...m.phan_tu.filter((q) => q.loai !== 'can').map((q) => [q.a0, q.a1] as const),
      ...doan.filter((o, oi) => oi !== di && o.matIdx === d.matIdx).map((o) => [o.a0, o.a1] as const)];
    const truoc = Math.max(m.a_dau - 1e9, ...ke.filter(([, b]) => b <= d.a0 + KHIT_MM).map(([, b]) => b));
    const sau = Math.min(m.a_cuoi + 1e9, ...ke.filter(([a]) => a >= d.a1 - KHIT_MM).map(([a]) => a));
    const neoDau = Math.abs(chenh) <= KHIT_MM || d.a0 - truoc <= sau - d.a1;
    let a = neoDau ? d.a0 : d.a1 - tong;
    d.ds.forEach((i, k) => {
      const v = vtsGoc[i], B = coSo(m.goc_deg, m.truc_mm), a0 = a, a1 = a + rong[k];
      vts[i] = { ...v, a0, a1, goc: [B.pt(a0, 0), B.pt(a1, 0), B.pt(a1, v.sau), B.pt(a0, v.sau)] };
      a = a1;
    });
    if (Math.abs(chenh) > KHIT_MM) {
      lech.push({ matIdx: d.matIdx, mm: chenh });
      if ((neoDau ? d.a0 + tong > sau + KHIT_MM : d.a1 - tong < truoc - KHIT_MM)) de.push(di);
    }
  });
  return { vts, lech, de };
}

/** Mặt tòa sau khi dồn khít: phần tử căn mang vị trí, bề ngang và mã thư viện của căn đang dùng (cho pccc.ts). */
export function matDaDon(mau: ToaCoMat, bc: Pick<ToaDat, 'canTheo' | 'canViTri'>, tv: ThuVien): MatToa[] {
  const vts = new Map(viTriCan(mau, tv, bc).map((v) => [v.khoa, v]));
  return mau.mat.map((m, mi) => ({
    ...m,
    phan_tu: m.phan_tu.map((q, i) => {
      const v = vts.get(`${mi}:${i}`);
      if (!v) return q;
      const c = tv.can.get(canDangDung(v, bc));
      return { ...q, a0: v.a0, a1: v.a1, rong_mm: v.a1 - v.a0, ma_thu_vien: c?.ma_goc ?? q.ma_thu_vien };
    }),
  }));
}
