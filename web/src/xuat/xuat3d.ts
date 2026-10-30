/**
 * Xuất 3D từ phương án đang soạn, KHÔNG cần mở tab 3D: dựng lại cảnh bằng đúng bộ dựng của khung 3D (dungDuAn / dungToa) trên three
 * tải lười, thu lưới tam giác (luoi3d.ts) rồi ghi:
 *   · 'dae-du-an'      COLLADA .dae — 3D TMB cả dự án (ô đất, đường, khối tòa, hầm, tum…) cho SketchUp (không cây: nặng, SketchUp có thư viện riêng)
 *   · 'dae-cong-trinh' COLLADA .dae — 3D công trình chi tiết (từng căn, cửa, ban công…) của các tòa, đặt đúng chỗ trên lô
 *   · 'ifc'            IFC4 .ifc — chỉ các tòa (BIM, Revit nhập trực tiếp), mỗi tòa một IfcBuilding, chia tầng
 * Mọi toạ độ mét, Z lên.
 */
import type { ThuVien, ToaDat, TrangThaiPA, Diem } from '../tinh/kieu';
import { mauToa } from '../tinh/canThem';
import { boCucTang, canDangDung, coMat, nhomTang, viTriCan } from '../tinh/matBang';
import { choDuLieuMB, mauCuaToa } from '../man/tuChinhTang';
import { idTepCan } from '../tinh/stretch';
import { idLoi, tai, type HinhLoi } from '../ve/hinhHocThuVien';
import type { ToaVe } from '../ve/MatBangTang';
import { chayHet } from '../ve3d/chiaNho';
import { nhomMoi, taoVatLieu, THAM_SO_MAC, type Khoi3d, type T3 } from '../ve3d/dungCan';
import { dungDuAnTung } from '../ve3d/dungDuAn';
import { CAO_TANG_DE_MM, dungToa, ranhTumCo, type LoiHinh } from '../ve3d/dungToa';
import { khoi3dTheoId } from '../ve3d/stretch3d';
import { bangTenVL, demTamGiac, tachTang, thuLuoi, type LuoiVL } from './luoi3d';
import { taoDae, type NhomDae } from './xuatDae';
import { taoIfc, type ToaIfc } from './xuatIfc';

export type LoaiXuat3d = 'dae-du-an' | 'dae-cong-trinh' | 'ifc';
export type KetQua3d = { tenTep: string; noiDung: string; mime: string; soTamGiac: number; soToa: number };
type Nap = { khoi3d: Map<string, Khoi3d | null>; loi: Map<string, LoiHinh> };

const K = 0.001;
const asciiHoa = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');

/** Tải khối 3D các mẫu căn + hình lõi cần cho các tòa (như `useNap3d`, không hook). */
async function nap3d(canIds: string[], loiIds: string[], tv: ThuVien): Promise<Nap> {
  const [a, b] = await Promise.all([
    Promise.all([...new Set(canIds)].map((id) => tai<{ khoi3d: Khoi3d | null }>(`/lib/can/${idTepCan(id)}.json`).then((j) => [id, khoi3dTheoId(id, j?.khoi3d ?? null, tv)] as const))),
    Promise.all([...new Set(loiIds)].map((id) => tai<HinhLoi>(`/lib/loi/${id}.json`).then((j) => [id, { bao_tuong_mm: j?.bao_tuong_mm, bao_tm: j?.bao_tm }] as const))),
  ]);
  return { khoi3d: new Map(a), loi: new Map(b) };
}

type TieuToa = { x: ToaDat; m0: ToaVe; mau: ToaVe; mauTang: (tang: number | null) => ToaVe };
/** Các tòa có mặt bằng (đã tự chỉnh) trong PA, hoặc chỉ những tòa trong `chi`. */
function cacToa(pa: TrangThaiPA, tv: ThuVien, chi?: string[]): TieuToa[] {
  return pa.toa.flatMap((x) => {
    if (chi && !chi.includes(x.id)) return [];
    const m0 = mauToa(tv, x);
    return m0 && coMat(m0) ? [{ x, m0: m0 as ToaVe, mau: mauCuaToa(x, m0 as ToaVe, null), mauTang: (tang: number | null) => mauCuaToa(x, m0 as ToaVe, tang) }] : [];
  });
}
const canIdsToa = (d: TieuToa, tv: ThuVien): string[] => nhomTang(d.x).flatMap(({ tang }) => { const bc = boCucTang(d.x, tang); return viTriCan(d.mauTang(tang), tv).map((vt) => canDangDung(vt, bc)); });
const loiIdsToa = (d: TieuToa): string[] => nhomTang(d.x).flatMap(({ tang }) => d.mauTang(tang).mat.flatMap((m) => m.phan_tu.filter((q) => q.loai !== 'can').map((q) => idLoi(q.block))));

/** Biến đổi mặt bằng mẫu → toạ độ tòa (tâm khung bao về gốc, lật, xoay theo gocDo) như `chanToa`; `dat` = có dời tới (x, y) trên lô. */
function bienDoiToa(d: TieuToa, dat: boolean, xoay = true) {
  const xs = d.m0.duong_bao.map((p) => p[0]), ys = d.m0.duong_bao.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const a = xoay ? (d.x.gocDo * Math.PI) / 180 : 0, c = Math.cos(a), s = Math.sin(a), lat = !!d.x.lat;
  return {
    lat,
    f: (X: number, Y: number, Z: number): [number, number, number] => {
      const px = (lat ? -1 : 1) * (X - cx * K), py = Y - cy * K;
      return [(dat ? d.x.x : 0) + px * c - py * s, (dat ? d.x.y : 0) + px * s + py * c, Z];
    },
  };
}

/** Dựng 3D chi tiết một tòa, thu lưới: `dat` = toạ độ lô (xoay + dời); không thì toạ độ tòa (tâm về gốc, chưa xoay, chỉ lật nếu có). */
function luoiToa(T: T3, d: TieuToa, tv: ThuVien, n: Nap, dat: boolean): LuoiVL[] {
  const M = taoVatLieu(T, [], 'vatlieu'), goc = new T.Group();
  dungToa(T, goc, M, nhomMoi(), THAM_SO_MAC, { mau: d.mau, toa: d.x, tv, khoi3d: n.khoi3d, loi: n.loi, idLoi, mauTang: d.mauTang });
  return thuLuoi(T, goc, bangTenVL(M), { boVL: new Set(['top']), bienDoi: bienDoiToa(d, dat, dat) });
}

/** Tầng của tòa: đế (CAO_TANG_DE_MM mỗi tầng) rồi các tầng căn hộ (THAM_SO_MAC.tang); thêm "Mái · tum" trên cùng. */
function tangCuaToa(x: ToaDat): { ten: string; caoDo: number }[] {
  const ds: { ten: string; caoDo: number }[] = [];
  for (let i = 0; i < x.soTangDe; i++) ds.push({ ten: `De ${i + 1}`, caoDo: i * CAO_TANG_DE_MM * K });
  const hDe = x.soTangDe * CAO_TANG_DE_MM * K;
  for (let j = 0; j < x.soTangDH; j++) ds.push({ ten: `Tang ${x.soTangDe + j + 1}`, caoDo: hDe + j * THAM_SO_MAC.tang * K });
  ds.push({ ten: 'Mai - tum', caoDo: hDe + x.soTangDH * THAM_SO_MAC.tang * K });
  return ds;
}

/** Tên tòa trong tệp xuất: mã mẫu + ký hiệu lô + số thứ tự trong lô nếu trùng mẫu. */
function tenToa(pa: TrangThaiPA, tv: ThuVien, x: ToaDat): string {
  const lo = pa.lo.find((l) => l.id === x.loId)?.temDat.kyHieu ?? '';
  const mau = (tv.toa.get(x.mauId)?.ten_vi ?? x.mauId).split(' · ')[0];
  const cung = pa.toa.filter((q) => q.loId === x.loId && q.mauId === x.mauId);
  return `${lo ? lo + ' - ' : ''}${mau}${cung.length > 1 ? ' ' + (cung.indexOf(x) + 1) : ''}`;
}

export async function xuat3d(loai: LoaiXuat3d, o: { pa: TrangThaiPA; tv: ThuVien; tenDuAn: string; chiToa?: string[]; tienDo?: (s: string) => void }): Promise<KetQua3d> {
  const { pa, tv, tenDuAn } = o, bao = o.tienDo ?? (() => {});
  await choDuLieuMB(pa, tv); // mặt bằng đã tự chỉnh như trên màn (thang, căn dồn, nét bao)
  const T = (await import('three')) as unknown as T3;
  const goiTen = asciiHoa(tenDuAn) || 'Unitmix';
  const toas = cacToa(pa, tv, loai === 'dae-du-an' ? undefined : o.chiToa);
  if (!toas.length) throw new Error('khong-co-toa');
  bao('nap');
  const n = await nap3d(toas.flatMap((d) => canIdsToa(d, tv)), toas.flatMap(loiIdsToa), tv);

  if (loai === 'dae-du-an') {
    bao('dung');
    const M = taoVatLieu(T, [], 'vatlieu'), goc = new T.Group();
    // tum + trục thang như khung 3D: ranh lõi mỗi tòa đặt lên lô (m)
    const tumToa = (id: string) => {
      const d = toas.find((q) => q.x.id === id);
      if (!d) return [];
      const f = bienDoiToa(d, true).f;
      return ranhTumCo(d.mau, n.loi, idLoi).map((r) => {
        const m = r.pts.map(([px, py]) => { const q = f(px * K, py * K, 0); return [q[0], q[1]] as Diem; });
        return { pts: d.x.lat ? m.reverse() : m, thang: r.thang };
      });
    };
    chayHet(dungDuAnTung(T, goc, M, 'vatlieu', pa, tv, null, { capDo: 'thap', tumToa }));
    bao('thu');
    const luoi = thuLuoi(T, goc, bangTenVL(M), { boLop: new Set(['cay', 'gio', 'thang']), boVL: new Set(['top']) });
    return { tenTep: `${goiTen}_3D-TMB.dae`, noiDung: taoDae([{ ten: tenDuAn, luoi }], tenDuAn), mime: 'model/vnd.collada+xml', soTamGiac: demTamGiac(luoi), soToa: toas.length };
  }

  bao('dung');
  if (loai === 'dae-cong-trinh') {
    const dsT = toas.map((d) => ({ d, luoi: luoiToa(T, d, tv, n, false) }));
    const nhom: NhomDae[] = dsT.map(({ d, luoi }) => ({ ten: tenToa(pa, tv, d.x), x: d.x.x, y: d.x.y, goc: d.x.gocDo, tang: tachTang(luoi, tangCuaToa(d.x)) }));
    return { tenTep: `${goiTen}_3D-cong-trinh.dae`, noiDung: taoDae(nhom, tenDuAn), mime: 'model/vnd.collada+xml', soTamGiac: dsT.reduce((s, g) => s + demTamGiac(g.luoi), 0), soToa: toas.length };
  }
  const dsT = toas.map((d) => ({ d, luoi: luoiToa(T, d, tv, n, false) }));
  const ds: ToaIfc[] = dsT.map(({ d, luoi }) => ({ ten: tenToa(pa, tv, d.x), x: d.x.x, y: d.x.y, goc: d.x.gocDo, tang: tachTang(luoi, tangCuaToa(d.x)) }));
  const tenTep = `${goiTen}_BIM.ifc`;
  return { tenTep, noiDung: taoIfc(ds, tenDuAn, tenTep), mime: 'application/x-step', soTamGiac: dsT.reduce((s, g) => s + demTamGiac(g.luoi), 0), soToa: toas.length };
}
