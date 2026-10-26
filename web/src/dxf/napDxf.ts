import DxfParser from 'dxf-parser';
import { dienTich } from '../tinh/hinhHoc';
import type { ChucNang, Diem, Lo } from '../tinh/kieu';
import { taoLo } from '../tinh/macDinh';

type Thuc = {
  type: string; layer: string; vertices?: { x: number; y: number }[]; shape?: boolean; text?: string;
  startPoint?: { x: number; y: number }; position?: { x: number; y: number };
  center?: { x: number; y: number }; radius?: number; startAngle?: number; endAngle?: number; // ARC, góc theo radian
};
export type Chu = { noiDung: string; diem: Diem };
export type LoiLop = 'ranh_khong_kin' | 'lop_trong';

export type BanDxf = {
  lop: string[];
  donVi: 'm' | 'mm';
  /** Các đa giác kín trên lớp (m). LWPOLYLINE/POLYLINE đóng, hoặc đỉnh cuối trùng đỉnh đầu. */
  polyKin(lop: string): Diem[][];
  /** Mọi đường (kể cả hở) trên lớp (m). */
  duong(lop: string): Diem[][];
  chu(lop: string): Chu[];
  /** Các lớp có HATCH (ô đất tô màu). */
  lopHatch: string[];
  /** Vòng ngoài của mọi HATCH trên lớp (m); vòng nằm trong vòng khác của cùng hatch là lỗ, bị bỏ. */
  hatch(lop: string): Diem[][];
  loiLop(lop: string): LoiLop | null;
};

const DON_VI_MM = new Set([4]); // $INSUNITS: 4 = mm, 6 = m

type Hatch = { lop: string; vong: { x: number; y: number }[][] };

/** dxf-parser bỏ qua HATCH nên đọc thẳng các cặp mã nhóm trong mục ENTITIES.
 *  Cạnh thẳng, cung tròn, đa tuyến (bỏ qua độ phình), ellip và spline (lấy điểm điều khiển) đều thành đa giác. */
function docHatch(text: string): Hatch[] {
  const dong = text.split(/\r?\n/);
  const cap: [number, string][] = [];
  for (let i = 0; i + 1 < dong.length; i += 2) cap.push([Number(dong[i].trim()), dong[i + 1].trim()]);
  const batDau = cap.findIndex(([c, v], i) => c === 2 && v === 'ENTITIES' && cap[i - 1]?.[1] === 'SECTION');
  if (batDau < 0) return [];
  const kq: Hatch[] = [];
  let i = batDau + 1;
  while (i < cap.length && !(cap[i][0] === 0 && cap[i][1] === 'ENDSEC')) {
    if (!(cap[i][0] === 0 && cap[i][1] === 'HATCH')) { i++; continue; }
    let j = i + 1;
    while (j < cap.length && cap[j][0] !== 0) j++;
    const h = cap.slice(i + 1, j);
    i = j;
    let k = 0;
    const tim = (ma: number) => { while (k < h.length && h[k][0] !== ma) k++; return k < h.length ? h[k++][1] : '0'; };
    const so = (ma: number) => Number(tim(ma));
    const lop = h.find(([c]) => c === 8)?.[1] ?? '0';
    const soVong = so(91);
    const vong: { x: number; y: number }[][] = [];
    for (let v = 0; v < soVong && k < h.length; v++) {
      const co = so(92);
      const pts: { x: number; y: number }[] = [];
      if (co & 2) {
        const phinh = so(72);
        so(73);
        const n = so(93);
        for (let p = 0; p < n; p++) {
          pts.push({ x: so(10), y: so(20) });
          if (phinh && h[k]?.[0] === 42) k++;
        }
      } else {
        const n = so(93);
        for (let e = 0; e < n; e++) {
          const loai = so(72);
          if (loai === 1) {
            pts.push({ x: so(10), y: so(20) });
            so(11); so(21);
          } else if (loai === 2 || loai === 3) {
            const cx = so(10), cy = so(20);
            const [tx, ty] = loai === 3 ? [so(11), so(21)] : [0, 0];
            const r = so(40), a0 = so(50), a1 = so(51), ccw = so(73) !== 0;
            // Cung cùng chiều kim đồng hồ ghi góc lấy đối xứng qua trục x.
            const [g0, g1] = ccw ? [a0, a1 > a0 ? a1 : a1 + 360] : [-a0, -a1 < -a0 ? -a1 : -a1 - 360];
            const buoc = Math.max(2, Math.ceil(Math.abs(g1 - g0) / 10));
            const truc = loai === 3 ? Math.hypot(tx, ty) : r;
            const goc = loai === 3 ? Math.atan2(ty, tx) : 0;
            const phu = loai === 3 ? truc * r : r;
            for (let s = 0; s < buoc; s++) {
              const a = ((g0 + ((g1 - g0) * s) / buoc) * Math.PI) / 180;
              const [u, w] = [truc * Math.cos(a), phu * Math.sin(a)];
              pts.push({ x: cx + u * Math.cos(goc) - w * Math.sin(goc), y: cy + u * Math.sin(goc) + w * Math.cos(goc) });
            }
          } else if (loai === 4) {
            so(94); so(73); so(74);
            const nk = so(95), nc = so(96);
            for (let q = 0; q < nk; q++) so(40);
            for (let q = 0; q < nc; q++) pts.push({ x: so(10), y: so(20) });
          }
        }
      }
      if (pts.length >= 3) vong.push(pts);
    }
    kq.push({ lop, vong });
  }
  return kq;
}

/** Đọc văn bản DXF. Bản vẽ ghi mm ($INSUNITS = 4, hoặc toạ độ quá lớn) được đổi sang m. */
export function napDxf(text: string): BanDxf {
  type KetQuaDoc = { header?: Record<string, unknown>; entities?: Thuc[] };
  let dxf: KetQuaDoc | null = null;
  try {
    dxf = new DxfParser().parseSync(text) as unknown as KetQuaDoc;
  } catch {
    dxf = null;
  }
  if (!dxf || !Array.isArray(dxf.entities)) throw new Error('Tệp không phải DXF hợp lệ (cần xuất DXF từ AutoCAD).');
  const ents = dxf.entities;
  const insunits = Number(dxf.header?.['$INSUNITS']);
  const maxToaDo = Math.max(0, ...ents.flatMap((e) => (e.vertices ?? []).map((v) => Math.max(Math.abs(v.x), Math.abs(v.y)))));
  const donVi: 'm' | 'mm' = DON_VI_MM.has(insunits) || (!insunits && maxToaDo > 20000) ? 'mm' : 'm';
  const k = donVi === 'mm' ? 1 / 1000 : 1;
  const diem = (p: { x: number; y: number }): Diem => [p.x * k, p.y * k];

  const theoLop = (lop: string) => ents.filter((e) => e.layer === lop);
  const laDuong = (e: Thuc) => (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && (e.vertices?.length ?? 0) >= 2;
  const kin = (e: Thuc) => {
    const v = e.vertices!;
    const trung = v.length > 3 && Math.hypot(v[0].x - v.at(-1)!.x, v[0].y - v.at(-1)!.y) < 1e-6;
    return v.length >= 3 && (!!e.shape || trung);
  };
  const boTrungCuoi = (pts: Diem[]) => (pts.length > 3 && pts[0][0] === pts.at(-1)![0] && pts[0][1] === pts.at(-1)![1] ? pts.slice(0, -1) : pts);
  const hatches = docHatch(text);
  const lopHatch = [...new Set(hatches.map((h) => h.lop))].sort();

  return {
    lop: [...new Set([...ents.map((e) => e.layer), ...lopHatch])].sort(),
    donVi,
    lopHatch,
    hatch: (lop) =>
      hatches
        .filter((h) => h.lop === lop)
        .flatMap((h) => {
          const vong = h.vong.map((v) => boTrungCuoi(v.map(diem)));
          return vong.filter((v, i) => !vong.some((w, j) => j !== i && dienTich(w) > dienTich(v) && trongDaGiac(trongTam(v), w)));
        }),
    polyKin: (lop) => theoLop(lop).filter((e) => laDuong(e) && kin(e)).map((e) => boTrungCuoi(e.vertices!.map(diem))),
    duong: (lop) =>
      theoLop(lop).flatMap((e): Diem[][] => {
        if (laDuong(e) || (e.type === 'LINE' && e.vertices?.length === 2)) return [e.vertices!.map(diem)];
        if (e.type === 'ARC' && e.center && e.radius) {
          const a0 = e.startAngle ?? 0;
          const a1 = (e.endAngle ?? 0) > a0 ? e.endAngle! : e.endAngle! + 2 * Math.PI;
          const n = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 18)));
          return [Array.from({ length: n + 1 }, (_, i) => {
            const a = a0 + ((a1 - a0) * i) / n;
            return diem({ x: e.center!.x + e.radius! * Math.cos(a), y: e.center!.y + e.radius! * Math.sin(a) });
          })];
        }
        return [];
      }),
    chu: (lop) =>
      theoLop(lop)
        .filter((e) => (e.type === 'TEXT' || e.type === 'MTEXT') && e.text)
        .map((e) => ({ noiDung: e.text!.replace(/\\[A-Za-z][^;]*;|[{}]/g, '').trim(), diem: diem((e.startPoint ?? e.position)!) })),
    loiLop(lop) {
      if (lop === RANH_HATCH) return lopHatch.length ? null : 'lop_trong';
      const ds = theoLop(lop).filter(laDuong);
      if (!ds.length) return 'lop_trong';
      return ds.some(kin) ? null : 'ranh_khong_kin';
    },
  };
}

/** Điểm trong đa giác (tia ngang). */
export function trongDaGiac([x, y]: Diem, poly: Diem[]): boolean {
  let trong = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) trong = !trong;
  }
  return trong;
}

const trongTam = (p: Diem[]): Diem => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];

export type ChonLop = { ranh: string; chiGioi?: string; tem?: string; xungQuanh?: string };

/** Giá trị "lớp ranh" đặc biệt: lấy ô đất tô HATCH trên mọi lớp (bản vẽ SDĐ không có ranh lô và ký hiệu lô, như M7). */
export const RANH_HATCH = '*hatch';

const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Loại đất theo tên lớp hatch → tiền tố ký hiệu lô và chức năng (theo bộ bóc TMB QH của app cũ). */
const LOAI_THEO_LOP: [RegExp, string, ChucNang][] = [
  [/noxh|nhaoxahoi|nhaoxh/, 'NOXH', 'xh'],
  [/nhaochungcu|nhaocaotang|chungcu/, 'CT', 'tm'],
  [/honhop/, 'HH', 'tm'],
  [/giaoduc/, 'GD', 'khac'],
  [/vanhoa/, 'VH', 'khac'],
  [/dichvu/, 'DV', 'khac'],
  [/thuongmai/, 'TM', 'khac'],
  [/theduc/, 'TT', 'khac'],
  [/nghiatrang/, 'NT', 'khac'],
  [/cayxanh/, 'CX', 'khac'],
  [/hatang/, 'HT', 'khac'],
  [/congcong/, 'CC', 'khac'],
];

/** Lớp đường giao thông: lòng đường, hè đường, tim đường. */
export const laLopDuongGT = (lop: string): boolean => /longduong|heduong|timduong/.test(boDau(lop)) || /(^|[^a-z])tim([^a-z]|$)/i.test(lop);

function ranhVaTen(ban: BanDxf, chon: ChonLop): { ranh: Diem[]; kyHieu?: string; chucNang?: ChucNang }[] {
  if (chon.ranh !== RANH_HATCH) return ban.polyKin(chon.ranh).map((ranh) => ({ ranh }));
  const ds = ban.lopHatch.flatMap((lop) => {
    const k = boDau(lop);
    const [, tienTo, chucNang] = LOAI_THEO_LOP.find(([m]) => m.test(k)) ?? [null, 'L', 'khac' as ChucNang];
    return ban.hatch(lop).filter((r) => dienTich(r) >= 1).map((ranh) => ({ ranh, tienTo, chucNang, tam: trongTam(ranh) }));
  });
  // Đánh số từ bắc xuống nam, cùng hàng (lệch dưới 10 m) thì từ tây sang đông.
  ds.sort((a, b) => (Math.abs(a.tam[1] - b.tam[1]) < 10 ? a.tam[0] - b.tam[0] : b.tam[1] - a.tam[1]));
  const dem: Record<string, number> = {};
  return ds.map(({ ranh, tienTo, chucNang }) => ({ ranh, kyHieu: `${tienTo}-${(dem[tienTo] = (dem[tienTo] ?? 0) + 1)}`, chucNang }));
}

/** Mỗi đa giác kín trên lớp ranh (hoặc mỗi ô hatch khi chọn RANH_HATCH) thành một lô; tem đất và chỉ giới gán cho lô chứa chúng. */
export function taoLoTuDxf(ban: BanDxf, chon: ChonLop): Lo[] {
  const chiGioi = chon.chiGioi ? ban.polyKin(chon.chiGioi) : [];
  const tem = chon.tem ? ban.chu(chon.tem) : [];
  // Nền vẽ: lớp xung quanh đã chọn + mọi lớp đường giao thông (lòng, hè, tim đường) như TMB QH của app cũ.
  const lopNen = new Set([...(chon.xungQuanh ? [chon.xungQuanh] : []), ...ban.lop.filter(laLopDuongGT)]);
  const xq = [...lopNen].flatMap((l) => ban.duong(l));
  return ranhVaTen(ban, chon).map(({ ranh, kyHieu: tenTuDat, chucNang }, i) => {
    const kyHieu = tem.find((c) => trongDaGiac(c.diem, ranh))?.noiDung ?? tenTuDat ?? `Lô ${i + 1}`;
    const lo = taoLo(`lo-${i + 1}`, kyHieu, chucNang ?? (/XH/i.test(kyHieu) ? 'xh' : 'tm'), ranh);
    lo.chiGioi = chiGioi.find((c) => trongDaGiac(trongTam(c), ranh)) ?? null;
    if (i === 0) lo.xungQuanh = xq;
    return lo;
  });
}
