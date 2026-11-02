/**
 * Thao tác tay trên Tổng mặt bằng (màn ③ app cũ `phimTMB`, `doiCoKhoa`, `nhanBanToa`, `lyDoNhanToa`): bắt dính khi kéo,
 * bắt góc khi xoay, xoay / lật / dời nhóm tòa, nhân bản vào chỗ trống, kiểm vi phạm trực tiếp (LO-01 · LO-02 · LO-05) và kích
 * thước tới ranh / chỉ giới / tòa khác. Hàm thuần, toạ độ mét (y lên). Ngưỡng luật đọc từ quy_tac.json qua `luiBang27` /
 * `kcToa261` (tinh/xepToa.ts) — không chép số.
 */
import { chanToa } from './hinhHoc';
import { vungDat } from './hopLo';
import type { Diem, Lo, ThuVien, ToaDat, TrangThaiPA } from './kieu';
import type { Luat } from './quyTac';
import { duLuiTungCanh, kcToa261, luiTungCanh, RONG_DUONG_MAC_DINH, rongCanh } from './xepToa';

export type Doan = [Diem, Diem];
export type LuatTMB = { lo01: Luat; lo02: Luat };

// ---------- hình học cơ bản ----------
const tru = (a: Diem, b: Diem): Diem => [a[0] - b[0], a[1] - b[1]];
const cham = (a: Diem, b: Diem) => a[0] * b[0] + a[1] * b[1];
const cheo = (a: Diem, b: Diem) => a[0] * b[1] - a[1] * b[0];
const dai = (a: Diem) => Math.hypot(a[0], a[1]);

export const canhCua = (P: Diem[]): Doan[] => P.map((p, i) => [p, P[(i + 1) % P.length]] as Doan);

/** Điểm gần p nhất trên đoạn ab. */
export function chieuDoan(p: Diem, a: Diem, b: Diem): Diem {
  const d = tru(b, a), L = cham(d, d) || 1;
  const t = Math.max(0, Math.min(1, cham(tru(p, a), d) / L));
  return [a[0] + t * d[0], a[1] + t * d[1]];
}

const catNhau = (a: Diem, b: Diem, c: Diem, d: Diem) => {
  const o = (p: Diem, q: Diem, r: Diem) => Math.sign(cheo(tru(q, p), tru(r, p)));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};

/** Điểm trong đa giác (tia chẵn lẻ). */
export function trongDaGiac(p: Diem, P: Diem[]): boolean {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [x1, y1] = P[i], [x2, y2] = P[j];
    if ((y1 > p[1]) !== (y2 > p[1]) && p[0] < ((x2 - x1) * (p[1] - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}

/** Đa giác F nằm trọn trong V (mọi đỉnh trong, không cạnh nào cắt) — đủ nhanh để chạy mỗi frame khi kéo. */
export const namTrongNhanh = (F: Diem[], V: Diem[]): boolean =>
  V.length >= 3 && F.every((p) => trongDaGiac(p, V)) && !F.some((p, i) => V.some((q, j) => catNhau(p, F[(i + 1) % F.length], q, V[(j + 1) % V.length])));

/**
 * Cặp điểm gần nhất giữa hai đường bao (coi là đường gấp khúc kín, KHÔNG xét chứa nhau). 0 khi cắt nhau.
 * Chạy mỗi frame khi kéo tòa (mọi cặp tòa + mọi cạnh lô) nên viết không cấp phát mảng trong vòng lặp, và bỏ qua cặp cạnh có hộp
 * bao cách nhau ≥ khoảng cách tốt nhất đã có (cạnh đó không thể cho kết quả nhỏ hơn).
 */
export function capGanBien(P: Diem[], Q: Diem[]): { kc: number; a: Diem; b: Diem } {
  const np = P.length, nq = Q.length;
  let tot2 = Infinity, ta = P[0], tb = Q[0];
  const qx0 = new Float64Array(nq), qx1 = new Float64Array(nq), qy0 = new Float64Array(nq), qy1 = new Float64Array(nq);
  for (let j = 0; j < nq; j++) {
    const u = Q[j], v = Q[(j + 1) % nq];
    qx0[j] = Math.min(u[0], v[0]); qx1[j] = Math.max(u[0], v[0]); qy0[j] = Math.min(u[1], v[1]); qy1[j] = Math.max(u[1], v[1]);
  }
  // điểm p tới đoạn s–e: bình phương khoảng cách; cải thiện thì ghi lại cặp (đảo = điểm của Q là p)
  const thu = (p: Diem, s: Diem, e: Diem, dao: boolean) => {
    const dx = e[0] - s[0], dy = e[1] - s[1], L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / L));
    const cx = s[0] + t * dx, cy = s[1] + t * dy, ex = p[0] - cx, ey = p[1] - cy, k2 = ex * ex + ey * ey;
    if (k2 < tot2) { tot2 = k2; if (dao) { ta = [cx, cy]; tb = p; } else { ta = p; tb = [cx, cy]; } }
  };
  for (let i = 0; i < np; i++) {
    const a1 = P[i], a2 = P[(i + 1) % np];
    const ax0 = Math.min(a1[0], a2[0]), ax1 = Math.max(a1[0], a2[0]), ay0 = Math.min(a1[1], a2[1]), ay1 = Math.max(a1[1], a2[1]);
    for (let j = 0; j < nq; j++) {
      const gx = Math.max(0, ax0 - qx1[j], qx0[j] - ax1), gy = Math.max(0, ay0 - qy1[j], qy0[j] - ay1);
      if (gx * gx + gy * gy >= tot2) continue;
      const b1 = Q[j], b2 = Q[(j + 1) % nq];
      if (catNhau(a1, a2, b1, b2)) return { kc: 0, a: a1, b: a1 };
      thu(a1, b1, b2, false); thu(a2, b1, b2, false); thu(b1, a1, a2, true); thu(b2, a1, a2, true);
    }
  }
  return { kc: Math.sqrt(tot2), a: ta, b: tb };
}

/** Khoảng cách hai tòa (0 khi chồng / chứa nhau) kèm cặp điểm để vẽ. */
export function capGanToa(P: Diem[], Q: Diem[]): { kc: number; a: Diem; b: Diem } {
  const c = capGanBien(P, Q);
  if (c.kc > 0 && (trongDaGiac(P[0], Q) || trongDaGiac(Q[0], P))) return { kc: 0, a: c.a, b: c.b };
  return c;
}

/** Diện tích có dấu (> 0 = ngược chiều kim đồng hồ). */
const dtDau = (P: Diem[]) => P.reduce((s, p, i) => s + cheo(p, P[(i + 1) % P.length]), 0) / 2;

/** Chiều cao xây dựng của tòa (m) — như xepToa / app cũ (không tính áp mái). */
export const caoToa = (x: ToaDat): number => x.soTangDe * x.caoDe + x.soTangDH * x.caoDH;

const chuanGoc = (g: number) => Math.round(((((g % 360) + 360) % 360)) * 100) / 100;
const tron2 = (v: number) => Math.round(v * 100) / 100;

// ---------- bắt dính khi kéo ----------
export type LoaiBat = 'canh' | 'chiGioi' | 'lui' | 'kc261' | 'thang' | 'truc';
export type MucBat = { doan: Doan; loai: LoaiBat; /** đường thẳng vô hạn (thẳng hàng), không cần chồng hình chiếu */ vohan?: boolean; nhan?: string };
export type KetQuaBat = { dx: number; dy: number; dan: MucBat[] };

/** Dịch đoạn ab theo pháp tuyến đơn vị n một khoảng d. */
const dichDoan = ([a, b]: Doan, n: Diem, d: number): Doan => [[a[0] + n[0] * d, a[1] + n[1] * d], [b[0] + n[0] * d, b[1] + n[1] * d]];
/** Pháp tuyến đơn vị phía trong của cạnh i (đa giác chiều `chieu` = dấu diện tích). */
const phapTrong = ([a, b]: Doan, chieu: number): Diem => {
  const d = tru(b, a), L = dai(d) || 1;
  return chieu > 0 ? [-d[1] / L, d[0] / L] : [d[1] / L, -d[0] / L];
};

/**
 * Các đích bắt dính quanh một lô cho tòa đang kéo: cạnh ranh lô, cạnh chỉ giới, đường lùi LO-01 (cạnh lô dời vào trong đúng
 * khoảng lùi Bảng 2.7), mép tòa khác (thẳng hàng), đường cách tòa khác đúng mức đầu hồi / cạnh dài §2.6.1 (LO-02).
 */
export function dichBatDinh(lo: Lo | undefined, khac: { F: Diem[]; H: number }[], H: number, luat: LuatTMB | null, rongDuong = RONG_DUONG_MAC_DINH): MucBat[] {
  const ds: MucBat[] = [];
  if (lo && lo.ranh.length >= 3) {
    const chieu = Math.sign(dtDau(lo.ranh)) || 1;
    for (const c of canhCua(lo.ranh)) ds.push({ doan: c, loai: 'canh' });
    if (luat) {
      // LO-01 theo lộ giới từng cạnh: cạnh không giáp đường (lùi 0) không có đường lùi riêng
      const lui = luiTungCanh(luat.lo01, lo, H, rongDuong);
      canhCua(lo.ranh).forEach((c, i) => { if (lui[i] > 0) ds.push({ doan: dichDoan(c, phapTrong(c, chieu), lui[i]), loai: 'lui', nhan: `LO-01 ${lui[i]} m` }); });
    }
    if (lo.chiGioi && lo.chiGioi.length >= 3) for (const c of canhCua(lo.chiGioi)) ds.push({ doan: c, loai: 'chiGioi' });
  }
  for (const o of khac) {
    const chieu = Math.sign(dtDau(o.F)) || 1;
    const kc = luat ? kcToa261(luat.lo02, Math.max(H, o.H)) : null;
    for (const c of canhCua(o.F)) {
      ds.push({ doan: c, loai: 'thang', vohan: true });
      if (kc) {
        const n = phapTrong(c, chieu), ra: Diem = [-n[0], -n[1]];
        if (kc.hoi > 0) ds.push({ doan: dichDoan(c, ra, kc.hoi), loai: 'kc261', nhan: `§2.6.1 ${tron2(kc.hoi)} m` });
        if (kc.dai > 0 && kc.dai !== kc.hoi) ds.push({ doan: dichDoan(c, ra, kc.dai), loai: 'kc261', nhan: `§2.6.1 ${tron2(kc.dai)} m` });
      }
    }
  }
  return ds;
}

/**
 * Bắt dính: F là chân tòa ĐÃ dời theo tay. Tìm cạnh của F song song (lệch < 1,5°) và cách một đích dưới `nguong` m, lấy đích
 * gần nhất, rồi đích thứ hai theo phương khác (giải hệ 2 ẩn để giữ cả hai). Thêm bắt trục: tâm thẳng hàng tâm tòa khác theo
 * trục cục bộ của tòa. Trả độ dời bù (dx, dy) và các đích đã bắt để vẽ nét gợi ý.
 */
export function batDinh(F: Diem[], tam: Diem, gocDo: number, muc: MucBat[], tamKhac: Diem[], nguong: number): KetQuaBat {
  type UV = { n: Diem; d: number; m: MucBat };
  const uv: UV[] = [];
  const SIN = Math.sin((1.5 * Math.PI) / 180);
  for (const [a, b] of canhCua(F)) {
    const u = tru(b, a), Lu = dai(u);
    if (Lu < 0.5) continue;
    for (const m of muc) {
      const [p, q] = m.doan, v = tru(q, p), Lv = dai(v);
      if (Lv < 0.5 || Math.abs(cheo(u, v)) / (Lu * Lv) > SIN) continue;
      const n: Diem = [-v[1] / Lv, v[0] / Lv];
      const d = cham(tru(p, a), n); // dời F theo n một khoảng d thì cạnh nằm trên đường đích
      if (Math.abs(d) > nguong) continue;
      if (!m.vohan) {
        // hình chiếu hai đoạn lên phương v phải chồng nhau (không bắt vào phần kéo dài của cạnh lô xa)
        const t = (x: Diem) => cham(tru(x, p), v) / Lv;
        const [s1, s2] = [t(a), t(b)].sort((x, y) => x - y);
        if (s2 < -nguong || s1 > Lv + nguong) continue;
      }
      uv.push({ n, d, m });
    }
  }
  const g = (gocDo * Math.PI) / 180;
  for (const ax of [[Math.cos(g), Math.sin(g)], [-Math.sin(g), Math.cos(g)]] as Diem[]) {
    for (const c of tamKhac) {
      const d = cham(tru(c, tam), ax);
      if (Math.abs(d) <= nguong) uv.push({ n: ax, d, m: { doan: [tam, c], loai: 'truc', vohan: true } });
    }
  }
  if (!uv.length) return { dx: 0, dy: 0, dan: [] };
  uv.sort((x, y) => Math.abs(x.d) - Math.abs(y.d));
  const c1 = uv[0];
  const c2 = uv.find((c) => Math.abs(cheo(c.n, c1.n)) > 0.3);
  if (!c2) return { dx: c1.n[0] * c1.d, dy: c1.n[1] * c1.d, dan: [c1.m] };
  // o·n1 = d1, o·n2 = d2
  const det = cheo(c1.n, c2.n);
  const ox = (c1.d * c2.n[1] - c2.d * c1.n[1]) / det, oy = (c1.n[0] * c2.d - c2.n[0] * c1.d) / det;
  return { dx: ox, dy: oy, dan: [c1.m, c2.m] };
}

// ---------- xoay ----------
/** Góc các cạnh lô (độ, 0–180) để bắt khi xoay — "xoay theo cạnh lô". */
export const gocCanhLo = (lo: Lo | undefined): number[] =>
  lo ? canhCua(lo.chiGioi ?? lo.ranh).filter(([a, b]) => dai(tru(b, a)) > 2).map(([a, b]) => chuanGoc((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI) % 180) : [];

/**
 * Bắt góc: Shift → bội 15°; không thì bắt về hướng trục (0/90…) hoặc song song / vuông góc cạnh lô khi lệch < `nguong`°;
 * còn lại làm tròn 1°.
 */
export function batGoc(goc: number, gocCanh: number[], shift = false, nguong = 3): { goc: number; theo: number | null } {
  if (shift) return { goc: chuanGoc(Math.round(goc / 15) * 15), theo: null };
  let tot: { goc: number; theo: number; lech: number } | null = null;
  for (const c of [0, ...gocCanh]) for (const k of [0, 90, 180, 270]) {
    const dich = c + k, lech = Math.abs(((goc - dich + 540) % 360) - 180);
    if (lech < nguong && (!tot || lech < tot.lech)) tot = { goc: chuanGoc(dich), theo: c, lech };
  }
  return tot ? { goc: tot.goc, theo: tot.theo } : { goc: chuanGoc(Math.round(goc)), theo: null };
}

/** Tâm nhóm (trung bình tâm tòa). */
export const tamNhom = (ds: ToaDat[]): Diem => [ds.reduce((s, x) => s + x.x, 0) / (ds.length || 1), ds.reduce((s, x) => s + x.y, 0) / (ds.length || 1)];

/** Xoay nhóm tòa một góc dGoc (độ, ngược chiều kim đồng hồ) quanh `tam`: tâm tòa quay theo, góc mỗi tòa cộng dGoc. */
export function xoayNhom(ds: ToaDat[], tam: Diem, dGoc: number): ToaDat[] {
  const a = (dGoc * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return ds.map((x) => {
    const px = x.x - tam[0], py = x.y - tam[1];
    return { ...x, x: tron2(tam[0] + px * c - py * s), y: tron2(tam[1] + px * s + py * c), gocDo: chuanGoc(x.gocDo + dGoc) };
  });
}

/** Dời nhóm tòa (m). */
export const dichNhom = (ds: ToaDat[], dx: number, dy: number): ToaDat[] => ds.map((x) => ({ ...x, x: tron2(x.x + dx), y: tron2(x.y + dy) }));

/**
 * Lật tòa (QT-85 app cũ `latToa`): đối xứng chân tòa qua trục dọc cục bộ, ghi `lat`. Nhiều tòa: mỗi tòa lật tại chỗ, tâm đối
 * xứng qua trục đứng đi qua tâm nhóm theo góc tòa đầu (giữ bố cục nhóm như gương).
 */
export function latNhom(ds: ToaDat[]): ToaDat[] {
  if (ds.length <= 1) return ds.map((x) => ({ ...x, lat: !x.lat }));
  const tam = tamNhom(ds), g = (ds[0].gocDo * Math.PI) / 180, u: Diem = [Math.cos(g), Math.sin(g)];
  return ds.map((x) => {
    const d = cham(tru([x.x, x.y], tam), u);
    // phản xạ qua đường đi qua tâm, phương vuông góc u; góc tòa: θ → 2φ − θ với φ = góc trục gương (g + 90°)
    return { ...x, x: tron2(x.x - 2 * d * u[0]), y: tron2(x.y - 2 * d * u[1]), gocDo: chuanGoc(2 * (ds[0].gocDo + 90) - x.gocDo + 180), lat: !x.lat };
  });
}

// ---------- kiểm vi phạm ----------
/** Thiếu khoảng lùi LO-01 ở cạnh `canh` của lô (lộ giới `rong` m; lô chưa khai thì là đường mặc định 12 m). */
export type ViPhamLui = { toaId: string; kc: number; can: number; a: Diem; b: Diem; canh: number; rong: number | null };
export type ViPhamCap = { a: string; b: string; kc: number; hoi: number; dai: number; muc: 'loi' | 'canh'; pa: Diem; pb: Diem };
export type KetQuaKiem = {
  /** Tòa ra ngoài chỉ giới / ranh lô (LO-05). */
  ngoai: Set<string>;
  lui: ViPhamLui[];
  cap: ViPhamCap[];
  /** Mức tệ nhất từng tòa. */
  muc: Map<string, 'loi' | 'canh'>;
};

export type ToaHinh = { toa: ToaDat; F: Diem[]; H: number };

/** Chân tòa + chiều cao của mọi tòa có mẫu (có thể ghi đè vị trí tòa đang kéo). */
export function hinhToa(pa: TrangThaiPA, tv: ThuVien, deTam?: Map<string, ToaDat>): ToaHinh[] {
  return pa.toa.filter((x) => tv.toa.has(x.mauId)).map((x0) => {
    const x = deTam?.get(x0.id) ?? x0;
    return { toa: x, F: chanToa(tv.toa.get(x.mauId)!, x), H: caoToa(x) };
  });
}

/**
 * Cạnh lô "tệ nhất" với F theo LO-01 từng cạnh: cạnh thiếu lùi nhiều nhất (kc − cần nhỏ nhất). Không cạnh nào cần lùi thì cạnh
 * gần nhất (cần 0). Trả kèm cặp điểm gần nhất để vẽ.
 */
export function canhLuiTe(F: Diem[], lo: Lo, lui: number[]): { canh: number; kc: number; can: number; a: Diem; b: Diem } | null {
  let tot: { canh: number; kc: number; can: number; a: Diem; b: Diem } | null = null;
  canhCua(lo.ranh).forEach(([p, q], i) => {
    const c = capGanBien(F, [p, q]), can = lui[i] ?? 0;
    if (!tot || c.kc - can < tot.kc - tot.can) tot = { canh: i, kc: c.kc, can, a: c.a, b: c.b };
  });
  return tot;
}

/**
 * Kiểm trực tiếp: LO-05 trong chỉ giới / ranh lô, LO-01 khoảng lùi Bảng 2.7 theo lộ giới TỪNG cạnh lô (`Lo.canhDuong`; cạnh
 * không giáp đường lùi 0; lô chưa khai thì mọi cạnh giáp đường `rongDuong` như gợi ý xếp tòa), LO-02 §2.6.1 giữa mọi cặp tòa (cả
 * lô bên cạnh, theo tòa cao hơn): dưới mức đầu hồi = lỗi, giữa đầu hồi và cạnh dài = cảnh báo (`cach_tinh` LO-02).
 */
export function kiemViPham(pa: TrangThaiPA, hinh: ToaHinh[], luat: LuatTMB | null, rongDuong = RONG_DUONG_MAC_DINH): KetQuaKiem {
  const kq: KetQuaKiem = { ngoai: new Set(), lui: [], cap: [], muc: new Map() };
  const nang = (id: string, m: 'loi' | 'canh') => { if (kq.muc.get(id) !== 'loi') kq.muc.set(id, m); };
  for (const h of hinh) {
    const lo = pa.lo.find((l) => l.id === h.toa.loId);
    if (!lo) continue;
    const V = vungDat(lo);
    if (!namTrongNhanh(h.F, V)) { kq.ngoai.add(h.toa.id); nang(h.toa.id, 'loi'); }
    if (luat && lo.ranh.length >= 3) {
      const c = canhLuiTe(h.F, lo, luiTungCanh(luat.lo01, lo, h.H, rongDuong));
      if (c && c.can > 0 && c.kc < c.can - 1e-6) {
        kq.lui.push({ toaId: h.toa.id, kc: c.kc, can: c.can, a: c.a, b: c.b, canh: c.canh, rong: rongCanh(lo, c.canh, rongDuong) });
        nang(h.toa.id, 'loi');
      }
    }
  }
  if (luat) {
    // hộp bao từng tòa: hai tòa cách nhau ≥ khoảng yêu cầu theo hộp bao thì chắc chắn không vi phạm — bỏ qua phép đo đa giác (dự án nhiều tòa)
    const hop = hinh.map((h) => { const xs = h.F.map((p) => p[0]), ys = h.F.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; });
    const kcTheoH = new Map<number, ReturnType<typeof kcToa261>>(); // khoảng yêu cầu chỉ phụ thuộc chiều cao: tính một lần mỗi giá trị
    for (let i = 0; i < hinh.length; i++) for (let j = i + 1; j < hinh.length; j++) {
      const A = hinh[i], B = hinh[j];
      const hMax = Math.max(A.H, B.H);
      let k = kcTheoH.get(hMax);
      if (!k) kcTheoH.set(hMax, (k = kcToa261(luat.lo02, hMax)));
      const a = hop[i], b = hop[j];
      if (Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3])) >= k.dai - 1e-6) continue;
      const c = capGanToa(A.F, B.F);
      if (c.kc >= k.dai - 1e-6) continue;
      const muc = c.kc < k.hoi - 1e-6 ? 'loi' : 'canh';
      kq.cap.push({ a: A.toa.id, b: B.toa.id, kc: c.kc, hoi: k.hoi, dai: k.dai, muc, pa: c.a, pb: c.b });
      nang(A.toa.id, muc); nang(B.toa.id, muc);
    }
  }
  return kq;
}

// ---------- kích thước khi kéo ----------
export type KichThuoc = { a: Diem; b: Diem; kc: number; loai: 'ranh' | 'chiGioi' | 'toa'; can?: number };

/** Kích thước từ tòa F tới ranh lô, chỉ giới và tòa gần nhất (kèm mức yêu cầu để tô đỏ khi thiếu). */
export function kichThuocToa(F: Diem[], H: number, lo: Lo | undefined, khac: { F: Diem[]; H: number }[], luat: LuatTMB | null, rongDuong = RONG_DUONG_MAC_DINH): KichThuoc[] {
  const ds: KichThuoc[] = [];
  if (lo && lo.ranh.length >= 3) {
    // tới ranh: cạnh thiếu lùi nhất theo lộ giới từng cạnh (không có luật thì cạnh gần nhất)
    if (luat) {
      const c = canhLuiTe(F, lo, luiTungCanh(luat.lo01, lo, H, rongDuong));
      if (c) ds.push({ a: c.a, b: c.b, kc: c.kc, loai: 'ranh', can: c.can });
    } else ds.push({ ...capGanBien(F, lo.ranh), loai: 'ranh' });
    if (lo.chiGioi && lo.chiGioi.length >= 3) ds.push({ ...capGanBien(F, lo.chiGioi), loai: 'chiGioi' });
  }
  let gan: KichThuoc | null = null;
  for (const o of khac) {
    const c = capGanToa(F, o.F);
    if (!gan || c.kc < gan.kc) gan = { ...c, loai: 'toa', can: luat ? kcToa261(luat.lo02, Math.max(H, o.H)).hoi : undefined };
  }
  if (gan) ds.push(gan);
  return ds;
}

// ---------- kẹp trong chỉ giới (LO-05) ----------
/**
 * LO-05 · QT-118: tòa không ra khỏi chỉ giới khi dời / xoay. `thu` là các phương án theo thứ tự ưu tiên (dời cả hai trục, rồi
 * trượt riêng X, riêng Y — tòa "tì" vào chỉ giới thay vì đứng khựng). Tòa vốn đã ra ngoài thì cho phép (không làm tệ hơn chỉ
 * được kiểm ở `kiemViPham`). Trả phương án đầu tiên hợp lệ, hoặc null.
 */
export function kepChiGioi<T>(thu: T[], chan: (x: T) => Diem[], V: Diem[], banDauTrong: boolean): T | null {
  if (!banDauTrong || V.length < 3) return thu[0] ?? null;
  return thu.find((x) => namTrongNhanh(chan(x), V)) ?? null;
}

// ---------- nhân bản ----------
/**
 * Nhân bản (app cũ `nhanBanToa` / Ctrl+V): bản sao cùng mẫu · góc · lật · số tầng, thử các vị trí quanh tòa gốc (8 hướng × 3
 * vòng, bắt đầu theo phương ngang thân tòa) và lấy chỗ đầu tiên nằm trong chỉ giới, đủ lùi LO-01 từng cạnh và cách mọi tòa ≥ mức
 * cạnh dài §2.6.1.
 * Không có chỗ trống thì đặt cạnh tòa gốc (người dùng kéo tiếp, cảnh báo hiện ngay).
 */
export function viTriNhanBan(goc: ToaDat, pa: TrangThaiPA, tv: ThuVien, luat: LuatTMB | null, id: string): { toa: ToaDat; hopLe: boolean } {
  const mau = tv.toa.get(goc.mauId);
  const ban: ToaDat = { ...goc, id, khoa: false };
  if (!mau) return { toa: { ...ban, x: tron2(goc.x + 20), y: goc.y }, hopLe: false };
  const F0 = chanToa(mau, goc), H = caoToa(goc);
  const r = Math.max(...F0.map((p) => Math.hypot(p[0] - goc.x, p[1] - goc.y)));
  const lo = pa.lo.find((l) => l.id === goc.loId), V = lo ? vungDat(lo) : [];
  const khac = hinhToa(pa, tv);
  const g = (goc.gocDo * Math.PI) / 180;
  // mỗi hướng: khoảng tâm–tâm vừa đủ = bề rộng chân tòa theo hướng đó + cạnh dài §2.6.1, rồi xa dần
  const kcDai = luat ? kcToa261(luat.lo02, H).dai : 0;
  const thu: Diem[] = [];
  for (const them of [0, 0.25, 0.5, 1]) for (let k = 0; k < 8; k++) {
    const a = g - Math.PI / 2 + (k * Math.PI) / 4; // vuông góc thân tòa trước
    const u: Diem = [Math.cos(a), Math.sin(a)];
    const chieu = F0.map((p) => (p[0] - goc.x) * u[0] + (p[1] - goc.y) * u[1]);
    const d = (Math.max(...chieu) - Math.min(...chieu) + kcDai + 0.5) * (1 + them);
    thu.push([goc.x + u[0] * d, goc.y + u[1] * d]);
  }
  for (const [x, y] of thu) {
    const c = { ...ban, x: tron2(x), y: tron2(y) }, F = chanToa(mau, c);
    if (V.length >= 3 && !namTrongNhanh(F, V)) continue;
    if (luat && lo && !duLuiTungCanh(F, lo.ranh, luiTungCanh(luat.lo01, lo, H))) continue;
    if (khac.some((o) => capGanToa(F, o.F).kc < (luat ? kcToa261(luat.lo02, Math.max(H, o.H)).dai : 0) - 1e-6 || capGanToa(F, o.F).kc === 0)) continue;
    return { toa: c, hopLe: true };
  }
  // hết chỗ: ưu tiên vị trí thử đầu tiên còn trong ranh lô, không thì lệch nhẹ khỏi tòa gốc — luôn nhìn thấy trên bản vẽ
  const trongLo = lo && lo.ranh.length >= 3 ? thu.find(([x, y]) => namTrongNhanh(chanToa(mau, { ...ban, x, y }), lo.ranh)) : undefined;
  const [x, y] = trongLo ?? [goc.x + r * 0.25, goc.y - r * 0.25];
  return { toa: { ...ban, x: tron2(x), y: tron2(y) }, hopLe: false };
}

// ---------- đo ----------
/** Bắt điểm đo vào đỉnh gần nhất (tòa, lô, chỉ giới) trong `nguong` m; không có thì giữ điểm bấm. */
export function batDiem(p: Diem, dinh: Diem[], nguong: number): Diem {
  let tot: Diem = p, m = nguong;
  for (const q of dinh) { const k = Math.hypot(q[0] - p[0], q[1] - p[1]); if (k <= m) { m = k; tot = q; } }
  return tot;
}

/** Tòa có tâm nằm trong khung chữ nhật (hai góc bất kỳ, m) — chọn bằng khung. */
export function toaTrongKhung(hinh: ToaHinh[], a: Diem, b: Diem, caChan = false): string[] {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  const trong = (p: Diem) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
  return hinh.filter((h) => (caChan ? h.F.every(trong) : trong([h.toa.x, h.toa.y]) || h.F.some(trong))).map((h) => h.toa.id);
}

// ---------- lộ giới từng cạnh lô (LO-01) ----------
/** Cạnh lô gần điểm p nhất trong `nguong` m (bấm cạnh trên bản vẽ); null khi không có. */
export function canhGan(lo: Lo, p: Diem, nguong: number): number | null {
  let tot: number | null = null, m = nguong;
  canhCua(lo.ranh).forEach(([a, b], i) => { const k = dai(tru(p, chieuDoan(p, a, b))); if (k <= m) { m = k; tot = i; } });
  return tot;
}

/**
 * Khai lộ giới cạnh i: số = giáp đường rộng ngần ấy m, null = không giáp đường. Lô chưa khai thì các cạnh khác giữ mặc định
 * (giáp đường `RONG_DUONG_MAC_DINH` m) — không đổi khoảng lùi của cạnh người dùng chưa đụng tới.
 */
export function datCanhDuong(lo: Lo, i: number, v: number | null): Lo {
  const cu = Array.isArray(lo.canhDuong) && lo.canhDuong.length === lo.ranh.length ? lo.canhDuong : lo.ranh.map(() => RONG_DUONG_MAC_DINH);
  return { ...lo, canhDuong: cu.map((x, k) => (k === i ? (v !== null && Number.isFinite(v) && v > 0 ? v : null) : x)) };
}

/** Bỏ khai lộ giới cả lô → mọi cạnh về hành vi cũ (đường mặc định 12 m). */
export const boCanhDuong = (lo: Lo): Lo => { const { canhDuong: _bo, ...con } = lo; return con; };
