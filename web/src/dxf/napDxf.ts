import DxfParser from 'dxf-parser';
import type { Diem, Lo } from '../tinh/kieu';
import { taoLo } from '../tinh/macDinh';

type Thuc = { type: string; layer: string; vertices?: { x: number; y: number }[]; shape?: boolean; text?: string; startPoint?: { x: number; y: number }; position?: { x: number; y: number } };
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
  loiLop(lop: string): LoiLop | null;
};

const DON_VI_MM = new Set([4]); // $INSUNITS: 4 = mm, 6 = m

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

  return {
    lop: [...new Set(ents.map((e) => e.layer))].sort(),
    donVi,
    polyKin: (lop) => theoLop(lop).filter((e) => laDuong(e) && kin(e)).map((e) => boTrungCuoi(e.vertices!.map(diem))),
    duong: (lop) => theoLop(lop).filter(laDuong).map((e) => e.vertices!.map(diem)),
    chu: (lop) =>
      theoLop(lop)
        .filter((e) => (e.type === 'TEXT' || e.type === 'MTEXT') && e.text)
        .map((e) => ({ noiDung: e.text!.replace(/\\[A-Za-z][^;]*;|[{}]/g, '').trim(), diem: diem((e.startPoint ?? e.position)!) })),
    loiLop(lop) {
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

/** Mỗi đa giác kín trên lớp ranh thành một lô; tem đất và chỉ giới gán cho lô chứa chúng. */
export function taoLoTuDxf(ban: BanDxf, chon: ChonLop): Lo[] {
  const chiGioi = chon.chiGioi ? ban.polyKin(chon.chiGioi) : [];
  const tem = chon.tem ? ban.chu(chon.tem) : [];
  const xq = chon.xungQuanh ? ban.duong(chon.xungQuanh) : [];
  return ban.polyKin(chon.ranh).map((ranh, i) => {
    const kyHieu = tem.find((c) => trongDaGiac(c.diem, ranh))?.noiDung ?? `Lô ${i + 1}`;
    const lo = taoLo(`lo-${i + 1}`, kyHieu, /XH/i.test(kyHieu) ? 'xh' : 'tm', ranh);
    lo.chiGioi = chiGioi.find((c) => trongDaGiac(trongTam(c), ranh)) ?? null;
    if (i === 0) lo.xungQuanh = xq;
    return lo;
  });
}
