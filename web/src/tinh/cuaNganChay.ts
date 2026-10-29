/**
 * CỬA NGĂN CHÁY / NGĂN KHÓI HÀNH LANG — chép bộ giải app cũ MDI_Unitmix_v4 (prototype/shell.src.html `hlDoThi` · `cncVatCan` ·
 * `cncDem` · `cuaNganChay0`, QT-95 / 98 / 100 / 103 / 104 / 104c / 105). Hàm thuần.
 *
 * Giới hạn khoang (R1): H ≤ 75 m → QCVN 06:2022 (SĐ1:2023) 3.3.5 ≤ 60 m; H > 75 m → A.3.1.7 → A.2.14 ≤ 30 m (khối căn hộ).
 * Khoang = phần hành lang liền nhau giữa hai cửa trên ĐỒ THỊ TUYẾN (trục thẳng hàng gộp, nút giao), SẢNH THANG MÁY tính chung
 * khoang (QT-100 / QT-104 — đoạn sảnh chép theo khối lõi ở lib/sanh_hl.json), vòng kín chỉ tính cây khung, cửa chỉ trên CẦU.
 * Luật cứng (`cam`, QT-105): R2 bám tường hai bên (hoặc bù tường 150 ở chế độ nới) · R3 không trong / trước sảnh thang máy ·
 * R4a khuôn cửa không đứng trên ô cửa căn / thang / lõi / tủ (≥ 500 + 100) · R5 không trong lõi (trừ lối xuyên lõi, chế độ nới) ·
 * R6 vuông góc hành lang. Mềm: R4b cánh mở không chồng cửa (chi phí 1000 / cửa), hai cửa cách ≥ 6 m (CNC_GAN), khoang ≥ 5 m
 * (CNC_VUN), ít khoang < 15 m, ít cửa, khoang ngắn nhất dài hơn.
 * Bộ giải: tham lam lá → gốc · tinh chỉnh cục bộ · thêm / bớt cửa · thay cửa bẩn bằng hai cửa sạch · QUY HOẠCH ĐỘNG chính xác trên
 * cây cầu (bảng Pareto số cửa → đoạn hở) · chế độ NỚI (bù tường + xuyên lõi) khi lời giải còn xấu — đúng thứ tự app cũ.
 *
 * Khác app cũ (dữ liệu app mới không có): cửa căn = tim cửa ± 450 (app cũ dùng nét cửa CAD khi có); nét bao căn = hình chữ nhật ô
 * (căn góc V dùng khung nếu có); trục căn thuộc tuyến = căn có mặt sát mép tuyến (app cũ theo tên trục `c.axis`).
 */
import type { CanMau, Diem, ThuVien } from './kieu';
import type { MatToa } from './pccc';
import SANH_HL from './sanhHL.json';

/** Đoạn sảnh thang máy (toạ độ khối lõi) của khối `block` ở mẫu tòa `toaId` — chép app cũ `hlSanhTruc` (scripts/chep_sanh_hl.py). */
export function sanhCuaLoi(block: string, toaId?: string): SanhHL[] | undefined {
  const n = (SANH_HL.loi as Record<string, { toa: string[]; ds: { p0: number[]; p1: number[]; w: number; tm: boolean }[] }[]>)[block];
  if (!n) return undefined;
  return (n.find((x) => toaId && x.toa.includes(toaId)) ?? n[0]).ds.map((s) => ({ p0: [s.p0[0], s.p0[1]], p1: [s.p1[0], s.p1[1]], w: s.w, tm: s.tm }));
}

/** Nét cửa trên tường hành lang của mẫu căn (biến thể STRETCH: điểm bên phải đường cắt dời theo mức kéo, như cuaBienThe). */
export function cuaHlCan(c: CanMau, tv: ThuVien): [number, number][] | undefined {
  if (!c.stretchGoc) return c.cua_hl;
  const g = tv.can.get(c.stretchGoc.id);
  if (!g?.cua_hl || !g.stretch) return undefined;
  const st = c.stretchGoc.st;
  return g.cua_hl.map(([x, y]) => { const X = x * g.rong_mm; return [(X > g.stretch!.x_mm ? X + st : X) / c.rong_mm, y]; });
}

// ---------- hằng số app cũ ----------
export const CNC_MAX = 30000, CNC_MAX_HL = 60000;
const CNC_CACH = 1000, CNC_VUN = 5000, CNC_NGAN = 15000, CNC_GAN = 6000, CNC_BAM = 350, CNC_NOI = 2500;
const CNC_HO = 100, CNC_BUOC = 500;
const TCC_CUA = 450; // ½ ô cửa căn khi không có nét cửa CAD
/** Giới hạn khoang (mm) theo chiều cao PCCC — `cncGioiHan`. */
export const cncGioiHan = (H: number) => (H > 75 ? CNC_MAX : CNC_MAX_HL);
/** Giới hạn khoang (m) + căn cứ để hiển thị. */
export const gioiHanKhoangHL = (H: number) =>
  H > 75 ? { m: 30, canCu: 'QCVN 06:2022 A.3.1.7 → A.2.14' } : { m: 60, canCu: 'QCVN 06:2022 3.3.5' };

// ---------- vector ----------
const cong = (a: Diem, b: Diem): Diem => [a[0] + b[0], a[1] + b[1]];
const tru = (a: Diem, b: Diem): Diem => [a[0] - b[0], a[1] - b[1]];
const nhan = (a: Diem, s: number): Diem => [a[0] * s, a[1] * s];
const dai = (a: Diem) => Math.hypot(a[0], a[1]);
const trongDa = (p: Diem, P: Diem[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
const kcDoan = (p: Diem, [a, b]: [Diem, Diem]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

// ---------- đầu vào ----------
/** Trục hành lang (tim, mm): `link` = đoạn nối; `sanhLoi` / `sanhTM` = đoạn sảnh thêm (QT-100 / QT-104). */
export type TrucHL = { ten: string; p0: Diem; p1: Diem; corr: number; link: boolean; sanhLoi?: boolean; sanhTM?: boolean };
/** Ô (căn / thang bộ) dọc mặt: gốc `o` trên mép hành lang, phương `u`, bề ngang `w`; `vien` = nét bao. */
export type OMat = { loai: 'can' | 'thang'; o: Diem; u: Diem; w: number; vien: Diem[] };
/** Vật cản cánh cửa: tim + nửa bề rộng dọc tường. */
export type VatCan = { p: Diem; ban: number };
export type DauVaoCNC = {
  truc: TrucHL[];
  o: OMat[];
  /** dấu chân lõi (BAO-TM, toạ độ thế giới) */
  loiP: Diem[][];
  /** nét `wall` của lõi; `netLoi` = wall + detail (vách giếng) */
  tuongLoi: [Diem, Diem][];
  netLoi: [Diem, Diem][];
  vatCan: VatCan[];
  /** bề rộng hành lang mặc định loại hình (S.corr: TM 1800 · NOXH 1600) */
  corr: number;
};

type Tuyen = {
  o: Diem; u: Diem; lo: number; hi: number; w: number; src: number[];
  ung: number[]; dac: number[];
  cam: (x: number) => boolean; camLoi: (x: number) => boolean; bam: (x: number, rr?: number) => boolean; bam0: (x: number, rr?: number) => boolean;
  camSanh: (x: number) => boolean; khongChan: (x: number) => boolean; vuong: (x: number) => boolean; sau: (x: number) => number;
  sach: (x: number) => boolean; sachQuet: (x: number, rr: number) => boolean; vach: (x: number) => number[];
  buOK: (x: number) => boolean; xuyen: (x: number) => boolean; buDo: (x: number) => number[] | null;
};
type Canh = { ti: number; ta: number; tb: number; a: number; b: number; L: number; cau: boolean; khung: boolean; Lk: number };
export type DoThiCNC = { tuyen: Tuyen[]; canh: Canh[]; nut: number[]; mieng: Diem[]; axes: TrucHL[]; _tm?: (x: number) => number };

/** Cửa ngăn cháy: cạnh `ci`, tham số `t` trên tuyến `ti`, tim `p`, phương tuyến `u`, bề rộng `w`; cờ như app cũ. */
export type CuaCNC = { ci: number; ti: number; t: number; p: Diem; u: Diem; w: number; tuong: boolean; sach: boolean; loi: boolean; bu: number[] | null; xuyen: boolean };

// ---------- hlDoThi ----------
export function hlDoThi(v: DauVaoCNC, boTM = false, noi = false): DoThiCNC {
  const S_CORR = v.corr;
  const axes = v.truc.filter((a) => !(boTM && a.sanhTM));
  const tuyen: Tuyen[] = [];
  const ttOf = (t: { o: Diem; u: Diem }, p: Diem) => (p[0] - t.o[0]) * t.u[0] + (p[1] - t.o[1]) * t.u[1];
  const lechOf = (t: { o: Diem; u: Diem }, p: Diem) => Math.abs(-(p[0] - t.o[0]) * t.u[1] + (p[1] - t.o[1]) * t.u[0]);
  // 1 · gộp trục thẳng hàng thành tuyến
  axes.forEach((ax, ai) => {
    const d = tru(ax.p1, ax.p0), L = dai(d);
    if (!(L > 0)) return;
    tuyen.push({ o: ax.p0, u: nhan(d, 1 / L), lo: 0, hi: L, w: ax.corr || S_CORR, src: [ai] } as Tuyen);
  });
  for (let doi = true; doi;) {
    doi = false;
    for (let i = 0; i < tuyen.length && !doi; i++) for (let j = i + 1; j < tuyen.length && !doi; j++) {
      const a = tuyen[i], b = tuyen[j];
      if (Math.abs(a.u[0] * b.u[1] - a.u[1] * b.u[0]) > 0.02) continue;
      const b0 = cong(b.o, nhan(b.u, b.lo)), b1 = cong(b.o, nhan(b.u, b.hi));
      if (lechOf(a, b0) > 400 || lechOf(a, b1) > 400) continue;
      const x0 = Math.min(ttOf(a, b0), ttOf(a, b1)), x1 = Math.max(ttOf(a, b0), ttOf(a, b1));
      if (x0 > a.hi + CNC_NOI || x1 < a.lo - CNC_NOI) continue;
      a.lo = Math.min(a.lo, x0); a.hi = Math.max(a.hi, x1); a.w = Math.max(a.w, b.w); a.src.push(...b.src); tuyen.splice(j, 1); doi = true;
    }
  }
  // 2 · nút: đầu tuyến + giao điểm
  const cha: number[] = [];
  const tim = (x: number): number => { while (cha[x] !== x) { cha[x] = cha[cha[x]]; x = cha[x]; } return x; };
  const moi = () => { cha.push(cha.length); return cha.length - 1; };
  const moc = tuyen.map((t) => [{ t: t.lo, id: moi() }, { t: t.hi, id: moi() }]);
  const ngoai = (t: Tuyen, x: number) => Math.max(0, t.lo - x, x - t.hi);
  for (let i = 0; i < tuyen.length; i++) for (let j = i + 1; j < tuyen.length; j++) {
    const a = tuyen[i], b = tuyen[j];
    const det = -a.u[0] * b.u[1] + a.u[1] * b.u[0];
    if (Math.abs(det) < 0.02) continue;
    const rx = b.o[0] - a.o[0], ry = b.o[1] - a.o[1], ta = (-rx * b.u[1] + ry * b.u[0]) / det, X = cong(a.o, nhan(a.u, ta)), tb = ttOf(b, X);
    if (ngoai(a, ta) > CNC_NOI || ngoai(b, tb) > CNC_NOI) continue;
    const id = moi(); moc[i].push({ t: ta, id }); moc[j].push({ t: tb, id });
  }
  // 3 · cạnh
  const canh: Canh[] = [];
  tuyen.forEach((_, ti) => {
    const m = moc[ti].sort((x, y) => x.t - y.t);
    for (let k = 1; k < m.length; k++) {
      if (m[k].t - m[k - 1].t < 50) { cha[tim(m[k].id)] = tim(m[k - 1].id); m[k].t = m[k - 1].t; continue; }
      canh.push({ ti, ta: m[k - 1].t, tb: m[k].t, a: m[k - 1].id, b: m[k].id, L: 0, cau: false, khung: false, Lk: 0 });
    }
  });
  canh.forEach((c) => { c.a = tim(c.a); c.b = tim(c.b); c.L = c.tb - c.ta; });
  // 4 · tường chung hai căn: mép ô căn có mặt sát mép tuyến (± ½ HL ± 300), chiếu lên tuyến
  tuyen.forEach((t) => {
    const hw = t.w / 2, ung: number[] = [];
    for (const c of v.o) {
      if (c.loai !== 'can') continue;
      if (Math.abs(c.u[0] * t.u[0] + c.u[1] * t.u[1]) < 0.99) continue;
      const e = [c.o, cong(c.o, nhan(c.u, c.w))];
      const laTruc = Math.abs(lechOf(t, c.o) - hw) <= 300;
      const laNoi = t.src.some((ai) => axes[ai].link) && e.every((p) => lechOf(t, p) <= hw + 8500 + 500);
      if (!laTruc && !laNoi) continue;
      e.forEach((p) => ung.push(Math.round(ttOf(t, p))));
    }
    t.ung = [...new Set(ung)].sort((a, b) => a - b);
  });
  // 4b · chỗ sạch, luật cứng
  const vc = v.vatCan, loiP = v.loiP;
  const sanhVung = axes.filter((a) => a.sanhTM).map((a) => { const e = tru(a.p1, a.p0), L = dai(e); return { o: a.p0, u: nhan(e, 1 / (L || 1)), L, w: a.corr || 3000, them: 1900 }; });
  const tuongDoan: [Diem, Diem][] = [];
  for (const c of v.o) c.vien.forEach((a, i) => tuongDoan.push([a, c.vien[(i + 1) % c.vien.length]]));
  tuongDoan.push(...v.tuongLoi);
  const netLoi = v.netLoi;
  tuyen.forEach((t) => {
    const hw = t.w / 2, r = (S_CORR || t.w) / 2, n: Diem = [-t.u[1], t.u[0]];
    const ben: Record<string, [number, number][]> = { '1': [], '-1': [] };
    const lechKy = (p: Diem) => (p[0] - t.o[0]) * n[0] + (p[1] - t.o[1]) * n[1];
    for (const c of v.o) {
      if (Math.abs(c.u[0] * t.u[0] + c.u[1] * t.u[1]) < 0.99) continue;
      const l = lechKy(c.o);
      if (Math.abs(Math.abs(l) - hw) > 300) continue;
      const a = ttOf(t, c.o), b = ttOf(t, cong(c.o, nhan(c.u, c.w)));
      if (Math.max(a, b) < t.lo - CNC_NOI || Math.min(a, b) > t.hi + CNC_NOI) continue;
      ben[l > 0 ? '1' : '-1'].push([Math.min(a, b), Math.max(a, b)]);
    }
    const phu = (ds: [number, number][], x0: number, x1: number) => {
      ds.sort((p, q) => p[0] - q[0]);
      let x = x0;
      for (const [a, b] of ds) { if (a > x + 30) break; if (b > x) x = b; }
      return x >= x1;
    };
    const vct = vc.filter((o) => lechOf(t, o.p) <= hw + 1600 && ttOf(t, o.p) > t.lo - r - 2000 && ttOf(t, o.p) < t.hi + r + 2000).map((o) => ({ x: ttOf(t, o.p), ban: o.ban }));
    const camLoi0 = (x: number) => [x - r, x, x + r].some((vv) => { const p = cong(t.o, nhan(t.u, vv)); return loiP.some((P) => trongDa(p, P)); });
    const gan = tuongDoan.filter(([a, b]) => [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Diem].some((q) => lechOf(t, q) <= hw + CNC_BAM + dai(tru(b, a)) / 2));
    const bamNho = new Map<string, boolean>();
    const bam0 = (x: number, rr?: number) => {
      rr = rr || r;
      const k = Math.round(x / 50) + '|' + rr;
      const co = bamNho.get(k);
      if (co !== undefined) return co;
      let ok = true;
      for (const sg of [1, -1]) {
        for (const f of [-0.9, -0.6, -0.45, -0.3, 0, 0.3, 0.45, 0.6, 0.9]) {
          if (!ok) break;
          const q = cong(cong(t.o, nhan(t.u, x + f * rr)), nhan(n, sg * hw));
          if (!gan.some((d) => kcDoan(q, d) <= CNC_BAM)) ok = false;
        }
        if (!ok) break;
      }
      bamNho.set(k, ok);
      return ok;
    };
    const laTMt = t.src.every((ai) => axes[ai] && axes[ai].sanhTM);
    const camSanh = (x: number) => {
      if (laTMt) return false;
      const p = cong(t.o, nhan(t.u, x));
      return sanhVung.some((z) => {
        const s = Math.max(-z.them, Math.min(z.L + z.them, (p[0] - z.o[0]) * z.u[0] + (p[1] - z.o[1]) * z.u[1])), q = cong(z.o, nhan(z.u, s));
        return dai(tru(p, q)) - z.w / 2 < r + 1000;
      });
    };
    const sachQuet = (x: number, rr: number) => vct.every((o) => Math.abs(o.x - x) >= rr + o.ban + CNC_HO);
    const khongChan = (x: number) => sachQuet(x, 500);
    // tia ± n: vách gần nhất (R6 vuông góc, bù tường)
    const ds = netLoi.concat(tuongDoan).filter(([A, B]) => [A, B].some((q) => lechOf(t, q) <= hw + 3000)
      && Math.min(ttOf(t, A), ttOf(t, B)) <= t.hi + 500 && Math.max(ttOf(t, A), ttOf(t, B)) >= t.lo - 500);
    const tia = (M: Diem, h: Diem): { m: number; seg: Diem | null } => {
      let m = Infinity, seg: Diem | null = null;
      for (const [A, B] of ds) {
        const e: Diem = [B[0] - A[0], B[1] - A[1]], den = h[0] * e[1] - h[1] * e[0];
        if (Math.abs(den) < 1e-9) continue;
        const r0: Diem = [A[0] - M[0], A[1] - M[1]], k = (r0[0] * e[1] - r0[1] * e[0]) / den, s2 = (r0[0] * h[1] - r0[1] * h[0]) / den;
        if (k > 1 && s2 >= 0 && s2 <= 1 && k < m) { m = k; seg = e; }
      }
      return { m, seg };
    };
    const songNho = new Map<number, boolean>();
    const vuong = (x: number) => {
      const k = Math.round(x / 50), co = songNho.get(k);
      if (co !== undefined) return co;
      const ok = [1, -1].every((sg) => [-r, 0, r].filter((dx) => {
        const e = tia(cong(t.o, nhan(t.u, x + dx)), nhan(n, sg)).seg;
        if (!e) return false;
        const L = Math.hypot(e[0], e[1]) || 1;
        return Math.abs((e[0] * n[0] + e[1] * n[1]) / L) <= 0.087;
      }).length >= 2);
      songNho.set(k, ok);
      return ok;
    };
    const vachNho = new Map<number, number[]>();
    const vach = (x: number) => {
      const k = Math.round(x / 50), co = vachNho.get(k);
      if (co) return co;
      const vv = [1, -1].map((sg) => Math.max(...[-75, 75].map((dx) => tia(cong(t.o, nhan(t.u, x + dx)), nhan(n, sg)).m)));
      vachNho.set(k, vv);
      return vv;
    };
    const sau0 = (x: number) => { let k = 0; for (let vv = x - r; vv <= x + r + 1; vv += r / 4) { const p = cong(t.o, nhan(t.u, vv)); if (loiP.some((P) => trongDa(p, P))) k++; } return k; };
    const laSanh = t.src.some((ai) => axes[ai] && (axes[ai].sanhTM || axes[ai].sanhLoi));
    const buOK = (x: number) => vach(x).every((d) => d >= r - 50 && d <= hw + 1500);
    const xuyen = (x: number) => !laSanh && camLoi0(x) && sachQuet(x, r) && buOK(x);
    Object.assign(t, {
      bam0, camSanh, sachQuet, khongChan, vuong, vach, buOK, xuyen,
      buDo: (x: number) => (!bam0(x) && buOK(x) ? vach(x) : null),
      camLoi: noi ? (x: number) => camLoi0(x) && !xuyen(x) : camLoi0,
      bam: noi ? (x: number, rr?: number) => bam0(x, rr) || buOK(x) : bam0,
      sau: noi ? (x: number) => (xuyen(x) ? 0 : sau0(x)) : sau0,
    });
    t.cam = (x: number) => t.camLoi(x) || !t.bam(x) || t.camSanh(x) || !t.khongChan(x) || !t.vuong(x);
    t.sach = (x: number) => !t.cam(x) && phu(ben['1'], x - r, x + r) && phu(ben['-1'], x - r, x + r) && vct.every((o) => Math.abs(o.x - x) >= r + o.ban + CNC_HO);
    t.ung = t.ung.filter(t.sach);
    t.dac = [];
    for (let x = Math.ceil(t.lo / CNC_BUOC) * CNC_BUOC; x <= t.hi; x += CNC_BUOC) if (t.sach(x) && !t.ung.some((vv) => Math.abs(vv - x) < CNC_BUOC / 2)) t.dac.push(x);
  });
  // 5 · cầu (Tarjan) + cây khung nhỏ nhất (Kruskal)
  const nut = [...new Set(canh.flatMap((c) => [c.a, c.b]))], ke = new Map<number, number[]>(nut.map((x) => [x, []]));
  canh.forEach((c, ci) => { ke.get(c.a)!.push(ci); if (c.b !== c.a) ke.get(c.b)!.push(ci); });
  const vao = new Map<number, number>(), thap = new Map<number, number>(), cau = new Set<number>();
  let dem = 0;
  const dfsCau = (x: number, ciVao: number) => {
    vao.set(x, dem); thap.set(x, dem); dem++;
    for (const ci of ke.get(x)!) {
      if (ci === ciVao) continue;
      const c = canh[ci], w = c.a === x ? c.b : c.a;
      if (!vao.has(w)) { dfsCau(w, ci); thap.set(x, Math.min(thap.get(x)!, thap.get(w)!)); if (thap.get(w)! > vao.get(x)!) cau.add(ci); }
      else thap.set(x, Math.min(thap.get(x)!, vao.get(w)!));
    }
  };
  nut.forEach((x) => { if (!vao.has(x)) dfsCau(x, -1); });
  const kr: Record<number, number> = {};
  const tkr = (x: number): number => (kr[x] === x ? x : (kr[x] = tkr(kr[x])));
  nut.forEach((x) => { kr[x] = x; });
  canh.map((_, ci) => ci).sort((x, y) => canh[x].L - canh[y].L).forEach((ci) => {
    const c = canh[ci], x = tkr(c.a), y = tkr(c.b);
    c.khung = x !== y;
    if (c.khung) kr[x] = y;
  });
  canh.forEach((c, ci) => { c.cau = cau.has(ci); c.Lk = c.khung ? c.L : 0; });
  const mieng = axes.filter((a) => a.sanhLoi).flatMap((a) => [a.p0, a.p1]);
  return { tuyen, canh, nut, mieng, axes };
}

// ---------- cncDem ----------
export function cncDem(dt: DoThiCNC, cua: Pick<CuaCNC, 'ci' | 't'>[]) {
  const { canh, nut } = dt;
  if (!dt._tm) {
    const mg: Record<number, number> = {};
    const tm = (x: number): number => (mg[x] === x ? x : (mg[x] = tm(mg[x])));
    nut.forEach((x) => { mg[x] = x; });
    canh.forEach((c) => { mg[tm(c.a)] = tm(c.b); });
    dt._tm = tm;
  }
  const tm = dt._tm;
  const kh: Record<string, string> = {};
  const tkh = (x: string): string => (kh[x] === x ? x : (kh[x] = tkh(kh[x])));
  const them = (x: string) => { if (kh[x] == null) kh[x] = x; return x; };
  const manh: [string, string, number, number, number, number][] = [];
  let sinh = 0;
  const theoCanh = new Map<number, number[]>();
  cua.forEach((x) => { let a = theoCanh.get(x.ci); if (!a) theoCanh.set(x.ci, (a = [])); a.push(x.t); });
  canh.forEach((c, ci) => {
    const ds = (theoCanh.get(ci) || []).sort((a, b) => a - b), k = c.khung ? 1 : 0;
    let dau = them('n' + c.a), t0 = c.ta;
    ds.forEach((t) => { const cuoi = them('d' + sinh++); manh.push([dau, cuoi, (t - t0) * k, ci, t0, t]); dau = them('d' + sinh++); t0 = t; });
    manh.push([dau, them('n' + c.b), (c.tb - t0) * k, ci, t0, c.tb]);
  });
  manh.forEach(([x, y]) => { kh[tkh(x)] = tkh(y); });
  const daiK: Record<string, number> = {}, khMang: Record<string, number> = {};
  manh.forEach(([x, , l, ci]) => { const r = tkh(x); daiK[r] = (daiK[r] || 0) + l; khMang[r] = tm(canh[ci].a); });
  const kq = new Map<number, { goc: number; L: number; doan: number[] }>();
  const mang = (r: number) => { if (!kq.has(r)) kq.set(r, { goc: r, L: 0, doan: [] }); return kq.get(r)!; };
  canh.forEach((c) => { mang(tm(c.a)).L += c.Lk; });
  Object.keys(daiK).forEach((r) => mang(khMang[r]).doan.push(daiK[r]));
  return {
    mang: [...kq.values()], cuaMang: (x: Pick<CuaCNC, 'ci'>) => tm(canh[x.ci].a),
    manh: manh.filter((m) => m[2] > 0).map(([x, , L, ci, t0, t1]) => ({ ci, t0, t1, L, kh: tkh(x), khL: daiK[tkh(x)] })),
  };
}

export type MangCNC = { L: number; doan: number[]; K: number; cua: CuaCNC[]; toiThieu: number };
export type KetQuaCNC = MangCNC[] & { khoa?: number[] };

const hon = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) { if (a[i] < b[i] - 1e-6) return true; if (a[i] > b[i] + 1e-6) return false; } return false; };

// ---------- cuaNganChay0 ----------
export function cuaNganChay(v: DauVaoCNC, K0: number, boTM = false, noi = false): KetQuaCNC {
  const K = K0 - 1; // 1 mm an toàn
  const dt = hlDoThi(v, boTM, noi), { tuyen, canh, nut } = dt;
  const S_CORR = v.corr;
  const kc: Record<number, number> = {};
  const tk = (x: number): number => (kc[x] === x ? x : (kc[x] = tk(kc[x])));
  nut.forEach((x) => { kc[x] = x; });
  const gop = (c: Canh) => !c.cau || tuyen[c.ti].src.every((ai) => dt.axes[ai] && dt.axes[ai].sanhTM);
  canh.forEach((c) => { if (gop(c)) kc[tk(c.a)] = tk(c.b); });
  const nang: Record<number, number> = {};
  canh.forEach((c) => { if (gop(c)) { const r = tk(c.a); nang[r] = (nang[r] || 0) + c.Lk; } });
  const keCay = new Map<number, number[]>();
  canh.forEach((c, ci) => { if (!gop(c)) [tk(c.a), tk(c.b)].forEach((r) => { if (!keCay.has(r)) keCay.set(r, []); keCay.get(r)!.push(ci); }); });
  const taoCua = (ci: number, t: number): CuaCNC => {
    const tu = tuyen[canh[ci].ti];
    return { ci, ti: canh[ci].ti, t, p: cong(tu.o, nhan(tu.u, t)), u: tu.u, w: S_CORR || tu.w, tuong: tu.ung.some((x) => Math.abs(x - t) < 1), sach: tu.sach(t), loi: tu.camLoi(t),
      bu: noi ? tu.buDo(t) : null, xuyen: noi && tu.xuyen(t) };
  };
  const veT = (ci: number, con: number, s: number) => { const c = canh[ci]; return con === c.a ? c.ta + s : c.tb - s; };
  const ngoaiLoi = (ci: number, con: number, x: number, lo: number) => {
    const tu = tuyen[canh[ci].ti];
    for (let y = x; y > lo; y -= 100) if (!tu.cam(veT(ci, con, y))) return y;
    let tot = x, it = tu.sau(veT(ci, con, x));
    for (let y = x; y > lo; y -= 100) { const k = tu.sau(veT(ci, con, y)); if (k < it - 1) { it = k; tot = y; } }
    return tot;
  };
  const ungT = (ci: number) => { const c = canh[ci], tu = tuyen[c.ti]; return [...tu.ung, ...tu.dac].filter((t) => t > c.ta + CNC_CACH && t < c.tb - CNC_CACH).sort((a, b) => a - b); };
  const ungCanh = (ci: number, con: number) => { const c = canh[ci]; return ungT(ci).map(con === c.a ? (t: number) => t - c.ta : (t: number) => c.tb - t).sort((x, y) => x - y); };
  // (a) tham lam lá → gốc
  let cua: CuaCNC[] = [];
  const xong = new Set<number>();
  const dauCat = (ci: number, con: number) => {
    const s = ungCanh(ci, con);
    if (s.length) return s[0];
    const c = canh[ci];
    for (let y = CNC_CACH; y < c.L - CNC_CACH; y += 100) if (!tuyen[c.ti].cam(veT(ci, con, y))) return y;
    return c.L;
  };
  const duyet = (x: number, ciCha: number, Kv = K): number => {
    xong.add(x);
    let tong = nang[x] || 0;
    const nhanh: { ci: number; con: number; s: number[]; last: number; b: number }[] = [];
    for (const ci of keCay.get(x) || []) {
      if (ci === ciCha) continue;
      const c = canh[ci], con = tk(c.a) === x ? c.b : c.a;
      if (xong.has(tk(con))) continue;
      const Le = c.L, s = ungCanh(ci, con), f = dauCat(ci, con), n0 = cua.length, x0 = new Set(xong);
      let cur = duyet(tk(con), ci), last = 0;
      if (cur + Le > K && cur + f > K && K - f >= 0) { cua.length = n0; xong.clear(); x0.forEach((z) => xong.add(z)); cur = duyet(tk(con), ci, K - f); }
      while (cur + (Le - last) > K) {
        let xx: number | null = null;
        for (const q of s) if (q > last + CNC_CACH && cur + (q - last) <= K) xx = q;
        if (xx == null) xx = ngoaiLoi(ci, con, Math.max(last + 1, last + K - cur - 1), last + 1);
        cua.push(taoCua(ci, veT(ci, con, xx))); cur = 0; last = xx;
      }
      nhanh.push({ ci, con, s, last, b: cur + Le - last });
      tong += cur + Le - last;
    }
    while (tong > Kv) {
      let tot: { n: typeof nhanh[number]; x: number; giam: number; tuong: boolean } | null = null;
      for (const n of nhanh) {
        const Le = canh[n.ci].L;
        let xx: number | null = null;
        for (const q of n.s) if (q > n.last + CNC_CACH) xx = q;
        const tuong = xx != null;
        if (!tuong) { xx = ngoaiLoi(n.ci, n.con, Le - CNC_CACH, n.last); if (tuyen[canh[n.ci].ti].cam(veT(n.ci, n.con, xx))) continue; }
        if (!(xx! > n.last)) continue;
        const giam = n.b - (Le - xx!);
        if (giam <= 0) continue;
        if (!tot || (tuong && !tot.tuong) || (tuong === tot.tuong && giam > tot.giam)) tot = { n, x: xx!, giam, tuong };
      }
      if (!tot) break;
      cua.push(taoCua(tot.n.ci, veT(tot.n.ci, tot.n.con, tot.x))); tot.n.last = tot.x; tot.n.b -= tot.giam; tong -= tot.giam;
    }
    return tong;
  };
  nut.forEach((x) => { if (!xong.has(tk(x))) duyet(tk(x), -1); });
  // (b) chỗ thử + điểm xếp hạng
  const viTri: [number, number][] = [];
  canh.forEach((c, ci) => {
    if (!c.cau) return;
    const tu = tuyen[c.ti];
    ungT(ci).forEach((t) => viTri.push([ci, t]));
    for (let t = c.ta + CNC_CACH; t < c.tb - CNC_CACH; t += CNC_BUOC)
      if (!tu.cam(t) && !viTri.some(([cj, tj]) => cj === ci && Math.abs(tj - t) < CNC_BUOC / 2)) viTri.push([ci, t]);
    for (let t = c.ta + 100; t < c.tb; t += 100) { const k = tu.sau(t); if (k > 0 && k <= 4 && tu.bam(t)) viTri.push([ci, t]); }
  });
  const viTriSach = viTri.filter(([ci, t]) => tuyen[canh[ci].ti].sach(t));
  const diem = (ds: CuaCNC[]) => {
    const d = cncDem(dt, ds).mang.flatMap((m) => m.doan);
    let sat = 0;
    ds.forEach((x, i) => ds.slice(i + 1).forEach((y) => { if (dai(tru(x.p, y.p)) < CNC_GAN) sat++; }));
    const kemieng = ds.filter((x) => (dt.mieng || []).some((q) => dai(tru(x.p, q)) < x.w / 2 + 2000)).length;
    return [d.reduce((t, x) => t + Math.max(0, x - K), 0), ds.filter((x) => !tuyen[x.ti].bam(x.t)).length, sat, ds.filter((x) => x.loi).length,
      ds.reduce((t, x) => t + (x.loi ? tuyen[x.ti].sau(x.t) : 0), 0), ds.filter((x) => !x.sach).length,
      d.filter((x) => x < CNC_NGAN).length, -Math.min(100000, ...d), kemieng, ds.filter((x) => !x.tuong).length, Math.max(0, ...d)];
  };
  let hien = diem(cua);
  const tinhChinh = () => {
    for (let vong = 0; vong < 12; vong++) {
      let doi = false;
      for (let i = 0; i < cua.length; i++) { const thu = cua.filter((_, j) => j !== i), d = diem(thu); if (d[0] <= hien[0] + 1e-6) { cua = thu; hien = d; doi = true; i--; } }
      for (let i = 0; i < cua.length; i++) {
        let tot: CuaCNC[] | null = null, dTot = hien;
        for (const [ci, t] of viTri) {
          if (cua.some((x) => x.ci === ci && Math.abs(x.t - t) < 1)) continue;
          const thu = cua.slice(); thu[i] = taoCua(ci, t);
          const d = diem(thu);
          if (hon(d, dTot)) { tot = thu; dTot = d; }
        }
        if (tot) { cua = tot; hien = dTot; doi = true; }
      }
      if (!doi) break;
    }
  };
  {
    hien = diem(cua);
    tinhChinh();
    // (b2) còn vượt: thêm cửa
    for (let k = 0; k < 6 && hien[0] > 1e-6; k++) {
      let tot: CuaCNC[] | null = null, dTot: number[] | null = null;
      for (const [ci, t] of viTri) {
        if (cua.some((x) => x.ci === ci && Math.abs(x.t - t) < 1)) continue;
        const thu = [...cua, taoCua(ci, t)], d = diem(thu);
        if (!dTot || hon(d, dTot)) { tot = thu; dTot = d; }
      }
      if (!tot) break;
      cua = tot; hien = dTot!; tinhChinh();
    }
    // (b3) bớt cửa: bỏ một, dời một
    const giua = (ds: CuaCNC[]) => ds.filter((x) => tuyen[x.ti].sau(x.t) > 4).length;
    for (let doi = true; doi && hien[0] <= 1e-6 && cua.length > 1;) {
      doi = false;
      let tot: CuaCNC[] | null = null, dTot: number[] | null = null;
      const g0 = giua(cua);
      for (let i = 0; i < cua.length; i++) {
        const bo = cua.filter((_, j) => j !== i);
        for (let j = 0; j < bo.length; j++) for (const [ci, t] of viTri) {
          if (bo.some((x) => x.ci === ci && Math.abs(x.t - t) < 1)) continue;
          const thu = bo.slice(); thu[j] = taoCua(ci, t);
          const d = diem(thu);
          if (d[0] <= 1e-6 && d[1] <= hien[1] && giua(thu) <= g0 && (!dTot || hon(d, dTot))) { tot = thu; dTot = d; }
        }
      }
      if (tot) { cua = tot; hien = dTot!; doi = true; tinhChinh(); }
    }
    // cửa giữa lõi / lơ lửng: bỏ, thêm lại ở chỗ bám tường ngoài lõi
    const viTriNgoai = viTri.filter(([ci, t]) => { const tu = tuyen[canh[ci].ti]; return tu.bam(t) && tu.sau(t) <= 4; });
    for (let i = cua.length - 1; hien[0] <= 1e-6 && i >= 0; i--) {
      const tu = tuyen[cua[i].ti];
      if (tu.bam(cua[i].t) && tu.sau(cua[i].t) <= 4) continue;
      let thu = cua.filter((_, j) => j !== i), d = diem(thu);
      for (let k = 0; k < 4 && d[0] > 1e-6; k++) {
        let tot: CuaCNC[] | null = null, dT: number[] | null = null;
        for (const [ci, t] of viTriNgoai) {
          if (thu.some((x) => x.ci === ci && Math.abs(x.t - t) < 1)) continue;
          const th = [...thu, taoCua(ci, t)], dd = diem(th);
          if (!dT || hon(dd, dT)) { tot = th; dT = dd; }
        }
        if (!tot) break;
        thu = tot; d = dT!;
      }
      if (d[0] <= 1e-6 && (d[1] < hien[1] || (d[1] <= hien[1] && giua(thu) < giua(cua)))) { cua = thu; hien = d; tinhChinh(); i = cua.length; }
    }
    // (c) cửa không sạch → hai cửa sạch cùng mạng
    for (let i = cua.length - 1; hien[0] <= 1e-6 && i >= 0; i--) {
      if (cua[i].sach) continue;
      const goc = cncDem(dt, cua).cuaMang, mi = goc(cua[i]), bo = cua.filter((_, j) => j !== i);
      const vt = viTriSach.filter(([ci]) => goc({ ci }) === mi);
      let tot: CuaCNC[] | null = null, dTot: number[] | null = null;
      for (let a = 0; a < vt.length; a++) for (let b = a + 1; b < vt.length; b++) {
        const thu = [...bo, taoCua(vt[a][0], vt[a][1]), taoCua(vt[b][0], vt[b][1])], d = diem(thu);
        if (d[0] <= 1e-6 && (d[1] < hien[1] || (d[1] === hien[1] && d[4] < hien[4])) && (!dTot || hon(d, dTot))) { tot = thu; dTot = d; }
      }
      if (tot) { cua = tot; hien = dTot!; i = cua.length; }
    }
    tinhChinh();
  }
  // QT-105 · bộ giải chính xác (quy hoạch động trên cây cầu)
  {
    const hop = (ci: number, t: number) => !tuyen[canh[ci].ti].cam(t), rCua = (S_CORR || 1800) / 2;
    const choHop = new Map<number, number[]>(), choSach = new Map<number, number[]>();
    canh.forEach((c, ci) => {
      if (gop(c)) return;
      const ds: number[] = [];
      for (let t = c.ta + 100; t <= c.tb - 100; t += 100) if (hop(ci, t)) ds.push(t);
      choHop.set(ci, ds);
      choSach.set(ci, ds.filter((t) => tuyen[c.ti].sachQuet(t, rCua)));
    });
    const CNC_PHAT = 1000;
    type Chon = { ci: number; con0: number; con: number; kc: number; ds: number[] };
    type O = { o: number; chon: Chon[] };
    const thamDP = new Set<number>(), F = new Map<number, Map<number, O>>();
    const giai = (x: number, ciCha: number): Map<number, O> => {
      thamDP.add(x);
      let bang = new Map<number, O>([[0, { o: nang[x] || 0, chon: [] }]]);
      for (const ci of keCay.get(x) || []) {
        if (ci === ciCha) continue;
        const c = canh[ci], con0 = tk(c.a) === x ? c.b : c.a, con = tk(con0);
        if (thamDP.has(con)) continue;
        giai(con, ci);
        const Fc = F.get(con);
        if (!Fc || !Fc.size) { bang = new Map(); continue; }
        const doiS = (t: number) => (con0 === c.a ? t - c.ta : c.tb - t);
        const sHop = (choHop.get(ci) || []).map(doiS).sort((p, q) => p - q), sSach = new Set((choSach.get(ci) || []).map(doiS));
        const sSachDs = sHop.filter((q) => sSach.has(q));
        const xaNhat = (ds: number[], pos: number, cur: number) => {
          let xx: number | null = null;
          for (const q of ds) { if (q <= pos + 1 || cur + (q - pos) < CNC_VUN) continue; if (cur + (q - pos) <= K) xx = q; else break; }
          return xx;
        };
        const tuyChon: { k: number; o: number; ds: number[]; kc: number }[] = [];
        Fc.forEach((r, k) => {
          if (r.o + c.L <= K) tuyChon.push({ k, o: r.o + c.L, ds: [], kc: k });
          const gen = (pos: number, cur: number, ds: number[], cost: number, m: number) => {
            if (m > Math.ceil(c.L / 1000) + 1) return;
            const xs = [xaNhat(sSachDs, pos, cur), xaNhat(sHop, pos, cur)];
            xs.forEach((xx, i) => {
              if (xx == null || (i === 1 && sSach.has(xx))) return;
              const c2 = cost + 1 + (sSach.has(xx) ? 0 : CNC_PHAT), d2 = [...ds, xx];
              if (c.L - xx <= K) tuyChon.push({ k: c2, o: c.L - xx, ds: d2, kc: k });
              gen(xx, 0, d2, c2, m + 1);
            });
          };
          gen(0, r.o, [], k, 1);
        });
        const moi = new Map<number, O>();
        bang.forEach((b, kb) => tuyChon.forEach((tc) => {
          const k = kb + tc.k, o = b.o + tc.o;
          if (o > K) return;
          const cu = moi.get(k);
          if (!cu || o < cu.o - 1e-6) moi.set(k, { o, chon: [...b.chon, { ci, con0, con, kc: tc.kc, ds: tc.ds }] });
        }));
        const ks = [...moi.keys()].sort((p, q) => p - q);
        let oMin = Infinity;
        bang = new Map();
        ks.forEach((k) => { const r = moi.get(k)!; if (r.o < oMin - 1e-6) { bang.set(k, r); oMin = r.o; } });
      }
      F.set(x, bang);
      return bang;
    };
    const dungCua = (x: number, k: number, ra: CuaCNC[]): boolean => {
      const r = F.get(x)?.get(k);
      if (!r) return false;
      for (const ch of r.chon) {
        ch.ds.forEach((sx) => ra.push(taoCua(ch.ci, ch.con0 === canh[ch.ci].a ? canh[ch.ci].ta + sx : canh[ch.ci].tb - sx)));
        if (!dungCua(ch.con, ch.kc, ra)) return false;
      }
      return true;
    };
    const cuaDP: CuaCNC[] = [];
    let duoc = true;
    nut.forEach((v0) => {
      const x = tk(v0);
      if (thamDP.has(x)) return;
      const b = giai(x, -1);
      if (!b.size) { duoc = false; return; }
      const k = Math.min(...b.keys());
      if (!dungCua(x, k, cuaDP)) duoc = false;
    });
    if (duoc) {
      const viPham = (ds: CuaCNC[]) => ds.filter((x) => tuyen[x.ti].cam(x.t)).length;
      const khoaDP = (ds: CuaCNC[], d: number[]) => {
        const dd = cncDem(dt, ds).mang.flatMap((m) => m.doan);
        return [d[0] > 1e-6 ? 1 : 0, viPham(ds), ds.filter((x) => !tuyen[x.ti].sachQuet(x.t, rCua)).length, dd.some((x) => x < CNC_VUN) ? 1 : 0, ds.length, -Math.min(...dd)];
      };
      const cu = cua, hCu = hien, vtCu = viTri.slice();
      cua = cuaDP; hien = diem(cua);
      viTri.length = 0;
      vtCu.forEach((q) => { if (hop(q[0], q[1]) && tuyen[canh[q[0]].ti].sachQuet(q[1], rCua)) viTri.push(q); });
      canh.forEach((c, ci) => { (choSach.get(ci) || []).forEach((t) => { if (t % 500 === 0 || t === c.ta + 100 || t === c.tb - 100) viTri.push([ci, t]); }); });
      tinhChinh();
      viTri.length = 0;
      vtCu.forEach((q) => viTri.push(q));
      if (!hon(khoaDP(cua, hien), khoaDP(cu, hCu))) { cua = cu; hien = hCu; }
    }
  }
  const giuaN = (ds: CuaCNC[]) => ds.filter((x) => tuyen[x.ti].sau(x.t) > 4).length;
  const rC = (S_CORR || 1800) / 2;
  const khoaX = (ds: CuaCNC[], d: number[]) => [d[0] > 1e-6 ? 1 : 0, ds.filter((x) => tuyen[x.ti].cam(x.t)).length, giuaN(ds), d[1], -d[7] < CNC_VUN ? 1 : 0,
    ds.filter((x) => !tuyen[x.ti].sachQuet(x.t, rC)).length, ds.length];
  const kx = khoaX(cua, hien);
  if (!noi && !boTM && kx.slice(0, 6).some((x) => x > 0)) {
    const kq2 = cuaNganChay(v, K + 1, false, true);
    if (kq2.khoa && kq2.khoa.join() !== kx.join() && hon(kq2.khoa, kx)) return kq2;
  }
  const { mang, cuaMang } = cncDem(dt, cua);
  const kq: KetQuaCNC = mang.map((m) => ({ L: m.L, doan: m.doan, K: K + 1, cua: cua.filter((x) => cuaMang(x) === m.goc).sort((x, y) => x.ti - y.ti || x.t - y.t),
    toiThieu: Math.max(0, Math.ceil((m.L - 1) / (K + 1)) - 1) }));
  kq.khoa = khoaX(cua, hien);
  return kq;
}

/**
 * Nét cửa căn NẰM TRÊN tường hành lang (app cũ `cncVatCan`: khuôn / ô cửa vào, sâu ≤ 300 mm), toạ độ thế giới. `ve(ma)` = nét
 * chuẩn hoá 0..1 của mẫu căn (can/<id>.json `ve`); thiếu nét thì căn đó dùng tim cửa ± 450 (bỏ qua ở đây).
 */
export function netCuaCan(mat: MatToa[], ve: (ma: string) => { cat: string; pts: Diem[] }[] | undefined): Diem[] {
  const kq: Diem[] = [];
  for (const m of mat) {
    const r = rad(m.goc_deg), u: Diem = [Math.cos(r), Math.sin(r)], n: Diem = [-u[1], u[0]];
    for (const q of m.phan_tu) {
      if (q.loai !== 'can') continue;
      const ds = ve(q.ma_thu_vien || q.block);
      if (!ds) continue;
      const w = q.a1 - q.a0, sau = q.sau_mm || 8500;
      for (const p of ds) {
        if (p.cat !== 'door') continue;
        for (const [x, y] of p.pts) {
          if (y * sau > 300) continue;
          const a = q.a0 + (q.sx < 0 ? 1 - x : x) * w, b = y * sau;
          kq.push([u[0] * a + n[0] * (m.truc_mm + b), u[1] * a + n[1] * (m.truc_mm + b)]);
        }
      }
    }
  }
  return kq;
}

// ---------- dựng đầu vào từ mặt bằng app mới ----------
export type LoiCNC = { bao_tm?: Diem[]; paths?: { cat: string; pts: Diem[] }[] };
export type SanhHL = { p0: Diem; p1: Diem; w: number; tm: boolean };
const rad = (d: number) => (d * Math.PI) / 180;
const veLoi = (q: { x: number; y: number; rot: number; sx: number; sy: number }, [x, y]: Diem): Diem => {
  const c = Math.cos(rad(q.rot)), s = Math.sin(rad(q.rot)), X = x * q.sx, Y = y * q.sy;
  return [q.x + X * c - Y * s, q.y + X * s + Y * c];
};

/**
 * Đầu vào bộ giải từ mặt bằng tầng (mặt đã dồn khít `matDaDon`, trục hành lang `hanh_lang` / tim trục, hình lõi, đoạn sảnh theo
 * khối lõi). `cuaCan` / `cuaThang` = tim cửa căn / cửa buồng đệm; `tu` = tủ PCCC (½ rộng).
 */
export function dauVaoCNC(p: {
  mat: MatToa[]; truc: { ten: string; noi: boolean; p0: Diem; p1: Diem }[]; hanhLangMm: number; corr: number;
  loi: (block: string) => LoiCNC | undefined; sanh: (block: string) => SanhHL[] | undefined;
  cuaCan: Diem[]; cuaThang: Diem[]; tu: { p: Diem; ban: number }[];
  /** nét cửa căn trên tường hành lang (điểm, ½ rộng 0) — có thì dùng thay tim cửa ± 450 như app cũ */
  cuaCanNet?: Diem[];
}): DauVaoCNC {
  const o: OMat[] = [], loiP: Diem[][] = [], tuongLoi: [Diem, Diem][] = [], netLoi: [Diem, Diem][] = [], vatCan: VatCan[] = [];
  const truc: TrucHL[] = p.truc.map((a) => ({ ten: a.ten, p0: a.p0, p1: a.p1, corr: p.hanhLangMm, link: a.noi }));
  const da = new Set<string>();
  for (const m of p.mat) {
    const r = rad(m.goc_deg), u: Diem = [Math.cos(r), Math.sin(r)], n: Diem = [-u[1], u[0]];
    const pt = (a: number, b: number): Diem => [u[0] * a + n[0] * (m.truc_mm + b), u[1] * a + n[1] * (m.truc_mm + b)];
    for (const q of m.phan_tu) {
      if (q.loai === 'can' || q.loai === 'thang_bo') {
        const sau = q.sau_mm || 8500;
        o.push({ loai: q.loai === 'can' ? 'can' : 'thang', o: pt(q.a0, 0), u, w: q.a1 - q.a0, vien: [pt(q.a0, 0), pt(q.a1, 0), pt(q.a1, sau), pt(q.a0, sau)] });
        continue;
      }
      if (q.bang || !q.block) continue;
      const k = `${q.block}@${Math.round(q.x / 50)},${Math.round(q.y / 50)}`;
      if (da.has(k)) continue;
      da.add(k);
      const h = p.loi(q.block);
      if (h?.bao_tm?.length) loiP.push(h.bao_tm.map((z) => veLoi(q, z)));
      for (const pa of h?.paths ?? []) {
        const pts = pa.pts.map((z) => veLoi(q, z));
        if (pa.cat === 'door') pts.forEach((z) => vatCan.push({ p: z, ban: 0 }));
        if (pa.cat === 'wall' || pa.cat === 'detail') for (let i = 0; i + 1 < pts.length; i++) {
          netLoi.push([pts[i], pts[i + 1]]);
          if (pa.cat === 'wall') tuongLoi.push([pts[i], pts[i + 1]]);
        }
      }
      (p.sanh(q.block) ?? []).forEach((s, i) => truc.push({ ten: `sảnh ${q.block}.${i}`, p0: veLoi(q, s.p0), p1: veLoi(q, s.p1), corr: s.w, link: true, sanhLoi: true, sanhTM: s.tm }));
    }
  }
  if (p.cuaCanNet) p.cuaCanNet.forEach((z) => vatCan.push({ p: z, ban: 0 }));
  else p.cuaCan.forEach((z) => vatCan.push({ p: z, ban: TCC_CUA }));
  p.cuaThang.forEach((z) => vatCan.push({ p: z, ban: 650 }));
  p.tu.forEach((z) => vatCan.push(z));
  return { truc, o, loiP, tuongLoi, netLoi, vatCan, corr: p.corr };
}
