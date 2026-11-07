/**
 * Xuất 3D từ phương án đang soạn, KHÔNG cần mở tab 3D: dựng lại cảnh bằng đúng bộ dựng của khung 3D (dungDuAn / dungToa) trên three
 * tải lười, thu lưới tam giác (luoi3d.ts) rồi ghi:
 *   · 'dae-du-an' COLLADA .dae nhẹ — tổng thể cả dự án cho SketchUp (ô đất, đường, khối tòa, tum; không cây, không chi tiết căn)
 *   · 'dae-mau'   chi tiết mỗi mẫu tòa một tệp .dae (từng căn, cửa, ban công…) cho SketchUp
 *   · 'ifc-mau'   chi tiết mỗi mẫu tòa một tệp IFC4 .ifc cho Revit, chia tầng
 *   · 'bim-mau'   gói BIM .json mỗi bố cục (xuatBim.ts) + script dựng model gốc và hồ sơ bản vẽ trong Revit
 * Nhiều mẫu thì gói một tệp .zip. Mẫu có nhiều bố cục tầng: mỗi bố cục một tòa cao nhất, đặt cạnh nhau trong tệp của mẫu.
 * Mọi toạ độ mét, Z lên. Tổng thể dời về gần gốc (`gocDuAn`): hình học three là Float32, ở toạ độ VN2000 sai 6–25 cm; SketchUp và Revit
 * cũng xử lý kém mô hình cách gốc hàng trăm km. Tệp chi tiết tính từ tâm tòa, không xoay.
 */
import type { ThuVien, ToaDat, TrangThaiPA, Diem } from '../tinh/kieu';
import { mauToa } from '../tinh/canThem';
import { boCucTang, canDangDung, coMat, nhomTang, viTriCan } from '../tinh/matBang';
import { tangCoRieng, type NetVe } from '../tinh/matBang';
import { choDuLieuMB, mauCuaToa } from '../man/tuChinhTang';
import { idTepCan, veTheoId } from '../tinh/stretch';
import { idLoi, tai, taiVeCan, type HinhLoi } from '../ve/hinhHocThuVien';
import type { ToaVe } from '../ve/MatBangTang';
import { chayHet } from '../ve3d/chiaNho';
import { nhomMoi, taoVatLieu, THAM_SO_MAC, type Khoi3d, type T3 } from '../ve3d/dungCan';
import { dungDuAnTung } from '../ve3d/dungDuAn';
import { CAO_TANG_DE_MM, CAO_TUM_MM, COT_DE_MM, cotTheoMatBang, dungToa, ranhTumCo, type LoiHinh } from '../ve3d/dungToa';
import { khoi3dTheoId } from '../ve3d/stretch3d';
import { bangTenVL, demTamGiac, tachTang, thuLuoi, type LuoiVL, type TangLuoi } from './luoi3d';
import { taoDae } from './xuatDae';
import { taoGoiBim, type LoiDayDu, type MauTangBim } from './xuatBim';
import { danhSachChen, taoDxf } from './xuatCad';
import { taoIfc } from './xuatIfc';

export type LoaiXuat3d = 'dae-du-an' | 'dae-mau' | 'ifc-mau' | 'bim-mau';
/** Một tệp trong kết quả (tệp chi tiết có thể nhiều tệp). */
export type Tep3d = { tenTep: string; noiDung: string };
/** `soToa`: số tòa của PA được tính; `soTep`: số tệp sau khi tách theo mẫu; `goc`: điểm VN2000 ứng với (0, 0) của tệp tổng thể. */
export type KetQua3d = { tenTep: string; noiDung: string | Uint8Array; mime: string; soTamGiac: number; soToa: number; soTep: number; goc?: Diem };
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
function bienDoiToa(d: TieuToa, dat: boolean, xoay = true, boLat = false) {
  const xs = d.m0.duong_bao.map((p) => p[0]), ys = d.m0.duong_bao.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const a = xoay ? (d.x.gocDo * Math.PI) / 180 : 0, c = Math.cos(a), s = Math.sin(a), lat = !boLat && !!d.x.lat;
  return {
    lat,
    f: (X: number, Y: number, Z: number): [number, number, number] => {
      const px = (lat ? -1 : 1) * (X - cx * K), py = Y - cy * K;
      return [(dat ? d.x.x : 0) + px * c - py * s, (dat ? d.x.y : 0) + px * s + py * c, Z];
    },
  };
}

/** Dựng 3D chi tiết một tòa theo toạ độ tòa (tâm về gốc, chưa xoay, chưa lật: tòa lật cùng mẫu chung một hình; `giuLat` khi đặt đúng chỗ), thu lưới. */
function luoiToa(T: T3, d: TieuToa, tv: ThuVien, n: Nap, giuLat = false): LuoiVL[] {
  const M = taoVatLieu(T, [], 'vatlieu'), goc = new T.Group();
  dungToa(T, goc, M, nhomMoi(), THAM_SO_MAC, { mau: d.mau, toa: d.x, tv, khoi3d: n.khoi3d, loi: n.loi, idLoi, mauTang: d.mauTang });
  return thuLuoi(T, goc, bangTenVL(M), { boVL: new Set(['top']), bienDoi: bienDoiToa(d, false, false, !giuLat) });
}

/** Điểm (0, 0) của tệp tổng thể: tâm khung bao các tòa, làm tròn 10 m. */
export function gocDuAn(pa: TrangThaiPA): Diem {
  const ds = pa.toa.length ? pa.toa.map((x): Diem => [x.x, x.y]) : pa.lo.flatMap((l) => l.ranh);
  const xs = ds.map((p) => p[0]), ys = ds.map((p) => p[1]);
  const tron = (a: number[]) => (ds.length ? Math.round((Math.min(...a) + Math.max(...a)) / 20) * 10 : 0);
  return [tron(xs), tron(ys)];
}

/** Bản sao PA dời toạ độ tuyệt đối đi (−ox, −oy): lô, chỉ giới, đế, hầm, ram, vị trí tòa. Hình tòa tính từ tâm tòa nên giữ nguyên. */
export function dichPA(pa: TrangThaiPA, ox: number, oy: number): TrangThaiPA {
  const d = (p: Diem): Diem => [p[0] - ox, p[1] - oy];
  const ds = (a: Diem[]) => a.map(d);
  const ham = pa.ham;
  return {
    ...pa,
    lo: pa.lo.map((l) => ({ ...l, ranh: ds(l.ranh), chiGioi: l.chiGioi ? ds(l.chiGioi) : l.chiGioi, xungQuanh: l.xungQuanh.map(ds), de: l.de?.ranh ? { ...l.de, ranh: l.de.ranh.map(ds) } : l.de })),
    toa: pa.toa.map((x) => ({ ...x, x: x.x - ox, y: x.y - oy })),
    ham: { ...ham, ranh: ham.ranh ? ds(ham.ranh) : ham.ranh, ram: ham.ram && ham.ram.x != null && ham.ram.y != null ? { ...ham.ram, x: ham.ram.x - ox, y: ham.ram.y - oy } : ham.ram },
  };
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

const KHE_BO_CUC = 30; // m, khe giữa các bố cục đặt cạnh nhau trong tệp một mẫu

type BoCucMau = { d: TieuToa; tang: TangLuoi[]; soTam: number; soCung: number };
/** Tên ngắn mẫu tòa (không có số tòa, lô). */
const tenMau = (tv: ThuVien, id: string) => (tv.toa.get(id)?.ten_vi ?? id).split(' · ')[0];

/** Gom các tòa theo mẫu; trong mỗi mẫu gom theo bố cục các tầng điển hình (bỏ qua số tầng), giữ tòa cao nhất của mỗi bố cục. */
function gomTheoMau(T: T3, toas: TieuToa[], tv: ThuVien, n: Nap, giuLat = false): Map<string, BoCucMau[]> {
  const ra = new Map<string, Map<string, BoCucMau>>();
  for (const d of toas) {
    const luoi = luoiToa(T, d, tv, n, giuLat), tang = tachTang(luoi, tangCuaToa(d.x));
    const dienHinh = new Set(tang.filter((t) => t.ten.startsWith('Tang')).map((t) => t.phan.map((p) => p.id).join('+')));
    const khoa = [...dienHinh].sort().join('|');
    let m = ra.get(d.x.mauId);
    if (!m) ra.set(d.x.mauId, (m = new Map()));
    const cu = m.get(khoa), soTam = demTamGiac(luoi);
    if (!cu) m.set(khoa, { d, tang, soTam, soCung: 1 });
    else {
      cu.soCung++;
      if (d.x.soTangDH > cu.d.x.soTangDH) { cu.d = d; cu.tang = tang; cu.soTam = soTam; }
    }
  }
  return new Map([...ra].map(([id, m]) => [id, [...m.values()].sort((a, b) => b.soCung - a.soCung)]));
}

/** Xếp các bố cục của một mẫu thành hàng dọc theo X, cách nhau theo bề ngang tòa. */
function datHang(ds: BoCucMau[]): number[] {
  const rong = (b: BoCucMau) => { const xs = b.d.m0.duong_bao.map((p) => p[0] * K); return Math.max(...xs) - Math.min(...xs); };
  let x = 0;
  return ds.map((b, i) => { if (i) x += (rong(ds[i - 1]) + rong(b)) / 2 + KHE_BO_CUC; return x; });
}

/** Một tệp thì ghi thẳng, nhiều tệp thì gói .zip. */
async function goiTep(ds: Tep3d[], tenGoi: string, mime: string): Promise<Pick<KetQua3d, 'tenTep' | 'noiDung' | 'mime'>> {
  if (ds.length === 1) return { tenTep: ds[0].tenTep, noiDung: ds[0].noiDung, mime };
  const { zipSync, strToU8 } = await import('fflate');
  return { tenTep: tenGoi, noiDung: zipSync(Object.fromEntries(ds.map((t) => [t.tenTep, strToU8(t.noiDung)]))), mime: 'application/zip' };
}

export async function xuat3d(loai: LoaiXuat3d, o: { pa: TrangThaiPA; tv: ThuVien; tenDuAn: string; chiToa?: string[]; tienDo?: (s: string) => void }): Promise<KetQua3d> {
  const { tv, tenDuAn } = o, bao = o.tienDo ?? (() => {});
  await choDuLieuMB(o.pa, tv); // mặt bằng đã tự chỉnh như trên màn (thang, căn dồn, nét bao)
  const T = (await import('three')) as unknown as T3;
  const goiTen = asciiHoa(tenDuAn) || 'Unitmix';
  const goc = gocDuAn(o.pa);
  const pa = loai === 'dae-du-an' ? dichPA(o.pa, goc[0], goc[1]) : o.pa;
  const toas = cacToa(pa, tv, loai === 'dae-du-an' ? undefined : o.chiToa);
  if (!toas.length) throw new Error('khong-co-toa');
  bao('nap');
  const n = await nap3d(toas.flatMap((d) => canIdsToa(d, tv)), toas.flatMap(loiIdsToa), tv);

  if (loai === 'dae-du-an') {
    bao('dung');
    const M = taoVatLieu(T, [], 'vatlieu'), goc3d = new T.Group();
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
    chayHet(dungDuAnTung(T, goc3d, M, 'vatlieu', pa, tv, null, { capDo: 'thap', tumToa }));
    bao('thu');
    const luoi = thuLuoi(T, goc3d, bangTenVL(M), { boLop: new Set(['cay', 'gio', 'thang']), boVL: new Set(['top', 'kinhDai']) }); // dải cửa chiếm ~3/4 số tam giác, bỏ cho tệp tổng thể nhẹ
    const ghiChu = `Goc (0,0) = VN2000 X ${goc[0]}, Y ${goc[1]}`;
    return { tenTep: `${goiTen}_3D-tong-the.dae`, noiDung: taoDae([{ ten: tenDuAn, luoi }], tenDuAn, { ghiChu }), mime: 'model/vnd.collada+xml', soTamGiac: demTamGiac(luoi), soToa: toas.length, soTep: 1, goc };
  }

  bao('dung');
  // xuất riêng tòa đang xem: giữ đúng vị trí, góc, lật theo cùng gốc của tệp tổng thể để ghép lại được
  const datDung = loai === 'dae-mau' && !!o.chiToa;
  const theoMau = gomTheoMau(T, toas, tv, n, datDung);
  if (loai === 'bim-mau') {
    const dayDu = new Map<string, LoiDayDu>();
    for (const id of new Set(toas.flatMap(loiIdsToa))) dayDu.set(id, (await tai<LoiDayDu>(`/lib/loi/${id}.json`)) ?? {});
    const tepBim: Tep3d[] = [];
    // nét bản vẽ lấy đúng nguồn của nút Xuất CAD (kèm nội thất): mặt bằng Revit là chính tệp .dxf này
    const canIds = [...new Set(toas.flatMap((d) => danhSachChen({ mau: d.mauTang(null), toa: boCucTang(d.x, null), tv, ten: '', goc: '', hinh: new Map() }).filter((q) => q.loai === 'can' && q.no).map((q) => q.no!)))];
    const hinh = new Map<string, NetVe[]>(await Promise.all(canIds.map((id) => taiVeCan(idTepCan(id), true).then((ve) => [id, veTheoId(id, ve, tv)] as const))));
    const loiCad = new Map<string, { paths: NetVe[] }>();
    for (const b of new Set(toas.flatMap((d) => d.mau.mat.flatMap((m) => m.phan_tu.filter((q) => q.loai !== 'can').map((q) => q.block))))) loiCad.set(b, (dayDu.get(idLoi(b)) as { paths: NetVe[] } | undefined) ?? { paths: [] });
    for (const [mauId, ds] of theoMau) ds.forEach((b, i) => {
      const x = b.d.x, foot = b.d.mau.duong_bao, xs = b.d.m0.duong_bao.map((p) => p[0]), ys = b.d.m0.duong_bao.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, ten = tenMau(tv, mauId);
      const goi = taoGoiBim({ tv, toa: x, mauTang: (tg) => b.d.mauTang(tg) as unknown as MauTangBim, khoi3d: n.khoi3d, loi: dayDu, idLoi, P: THAM_SO_MAC }, {
        duAn: tenDuAn, mau: `${ten}${ds.length > 1 ? ` BC${i + 1}` : ''}`, soToaCung: b.soCung, soTangDe: x.soTangDe, soTangDH: x.soTangDH, caoDeMm: CAO_TANG_DE_MM, caoTumMm: CAO_TUM_MM,
        rieng: tangCoRieng(x), cot: x.soTangDe > 0 ? cotTheoMatBang(foot, viTriCan(b.d.mau, tv, { canTheo: x.canTheo, canViTri: x.canViTri, latO: undefined }).map((v) => v.goc)) : [], canhCot: COT_DE_MM,
        tum: ranhTumCo(b.d.mau, n.loi, idLoi).map((r) => r.pts), cx, cy,
      });
      const goc = `${goiTen}_${asciiHoa(ten) || mauId}${ds.length > 1 ? `_BC${i + 1}` : ''}`;
      tepBim.push({ tenTep: `${goc}.bim.json`, noiDung: JSON.stringify({ ...goi, gocCad: [cx, cy] }) });
      tepBim.push({ tenTep: `${goc}.dxf`, noiDung: taoDxf({ mau: b.d.mauTang(null) as never, toa: boCucTang(x, null), tv, ten: goc, goc: '', hinh, loi: loiCad }) });
    });
    const script = await fetch('/lib/revit/unitmix_dung_bim.py').then((r) => (r.ok ? r.text() : ''), () => '');
    if (script) tepBim.push({ tenTep: 'unitmix_dung_bim.py', noiDung: script });
    const soBoCuc = tepBim.filter((t) => t.tenTep.endsWith('.json')).length;
    const { zipSync, strToU8 } = await import('fflate');
    return { tenTep: `${goiTen}_BIM-Revit.zip`, noiDung: zipSync(Object.fromEntries(tepBim.map((t) => [t.tenTep, strToU8(t.noiDung)]))), mime: 'application/zip', soTamGiac: 0, soToa: toas.length, soTep: soBoCuc };
  }
  const tep: Tep3d[] = [];
  let soTam = 0;
  for (const [mauId, ds] of theoMau) {
    const ten = tenMau(tv, mauId), viTri = datHang(ds), goiMau = `${goiTen}_${asciiHoa(ten) || mauId}`;
    const tenBoCuc = (b: BoCucMau, i: number) => `${ten}${ds.length > 1 ? ` - Bo cuc ${i + 1}` : ''} (${b.soCung} toa, ${b.d.x.soTangDH}T)`;
    const dat = ds.map((b, i) => (datDung ? { ten: tenBoCuc(b, i), x: b.d.x.x - goc[0], y: b.d.x.y - goc[1], goc: b.d.x.gocDo, tang: b.tang } : { ten: tenBoCuc(b, i), x: viTri[i], y: 0, goc: 0, tang: b.tang }));
    soTam += ds.reduce((s, b) => s + b.soTam, 0);
    tep.push(loai === 'dae-mau'
      ? { tenTep: `${goiMau}.dae`, noiDung: taoDae(dat, `${tenDuAn} - ${ten}`) }
      : { tenTep: `${goiMau}.ifc`, noiDung: taoIfc(dat, `${tenDuAn} - ${ten}`, `${goiMau}.ifc`) });
  }
  if (loai === 'dae-mau' && tep.length > 1) { // kèm plugin đặt tên tầng
    const rb = await fetch('/lib/sketchup/unitmix_dat_ten.rb').then((r) => (r.ok ? r.text() : ''), () => '');
    if (rb) tep.push({ tenTep: 'unitmix_dat_ten.rb', noiDung: rb });
  }
  const goi = await goiTep(tep, `${goiTen}_${loai === 'dae-mau' ? 'SketchUp' : 'Revit'}-theo-mau.zip`, loai === 'dae-mau' ? 'model/vnd.collada+xml' : 'application/x-step');
  return { ...goi, soTamGiac: soTam, soToa: toas.length, soTep: tep.filter((q) => !q.tenTep.endsWith('.rb')).length };
}
