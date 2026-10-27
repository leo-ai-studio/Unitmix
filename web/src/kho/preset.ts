import { laCaoTang } from '../tinh/loaiDat';
import { CHI_TIEU_MAC_DINH } from '../tinh/macDinh';
import { LOAI_CAN, type ChiTieuQH, type Lo, type LoaiCan, type NguongMau, type ThongSoHam, type TrangThaiPA } from '../tinh/kieu';

/** Preset hai tầng: nhóm `cap` (cả bộ cấu hình) và các nhóm theo mục. Lưu ở localStorage, khoá `unitmix.preset.<nhóm>`. */
export type NhomPreset = 'cap' | 'chiTieu' | 'coCau' | 'heSo' | 'nguong' | 'ham';
export type PhamViPreset = 'lo' | 'pa';
export type HamPreset = Omit<ThongSoHam, 'ranh'>;

/** Dữ liệu một preset. `heSo` là một khối JSON nguyên (kiểu HeSoDTSan có thể đổi), không truy cập trường bên trong. */
export type DuLieuPreset = {
  chiTieu?: ChiTieuQH;
  coCau?: Record<LoaiCan, number>;
  heSo?: unknown;
  phanHam?: unknown; // khối JSON nguyên của pa.phanHam (nếu PA có)
  nguong?: NguongMau;
  ham?: HamPreset;
};
export type Preset = { ten: string; du: DuLieuPreset };
export type KhoPreset = Pick<Storage, 'getItem' | 'setItem'>;

export const DS_NHOM: NhomPreset[] = ['cap', 'chiTieu', 'coCau', 'heSo', 'nguong', 'ham'];
const TRUONG_NHOM: Record<NhomPreset, (keyof DuLieuPreset)[]> = {
  cap: ['chiTieu', 'coCau', 'heSo', 'phanHam', 'nguong', 'ham'],
  chiTieu: ['chiTieu'],
  coCau: ['coCau'],
  heSo: ['heSo', 'phanHam'],
  nguong: ['nguong'],
  ham: ['ham'],
};
const TRUONG_LO: (keyof DuLieuPreset)[] = ['chiTieu', 'coCau'];
const DINH_DANG = 'unitmix-preset';
const TEN_TOI_DA = 60;

export const khoaPreset = (nhom: NhomPreset) => `unitmix.preset.${nhom}`;

const laSo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const laDoiTuong = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const sao = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const CT_CHO_NULL = new Set(['matDoThapMax', 'tangDe', 'tangCanHo', 'tangHam', 'soCanMax']);
const KHOA_NGUONG: (keyof NguongMau)[] = ['dtCanM2', 'kichThuocM', 'coCauDiem'];
// Chỉ các thông số số của hầm; ram, khu xe điện, cờ gara cơ khí nằm ngoài preset.
const KHOA_HAM: (keyof HamPreset)[] = ['soTang', 'nhip', 'rongLan', 'choDai', 'choRong', 'dtKho', 'lui', 'caoTang', 'dayKetCau', 'cotRong', 'choXeLan', 'rongKho', 'lanKho', 'khoMoiTang', 'tangXeMay', 'tyLeKyThuat'];

/** Làm sạch dữ liệu đọc từ máy / file: trường lạ bỏ, số hỏng thì lấy giá trị mặc định. */
function sachChiTieu(v: unknown): ChiTieuQH | null {
  if (!laDoiTuong(v)) return null;
  const kq: Record<string, number | null> = {};
  for (const [k, mac] of Object.entries(CHI_TIEU_MAC_DINH)) {
    const x = v[k];
    kq[k] = laSo(x) && x >= 0 ? x : x === null && CT_CHO_NULL.has(k) ? null : (mac as number | null);
  }
  return kq as unknown as ChiTieuQH;
}
function sachCoCau(v: unknown): Record<LoaiCan, number> | null {
  if (!laDoiTuong(v) || !LOAI_CAN.every((k) => laSo(v[k]) && (v[k] as number) >= 0)) return null;
  return Object.fromEntries(LOAI_CAN.map((k) => [k, v[k]])) as Record<LoaiCan, number>;
}
function sachSoCoKhoa<K extends string>(v: unknown, khoa: K[]): Record<K, number> | null {
  if (!laDoiTuong(v) || !khoa.every((k) => laSo(v[k]) && (v[k] as number) >= 0)) return null;
  return Object.fromEntries(khoa.map((k) => [k, v[k]])) as Record<K, number>;
}

/** Giữ đúng các trường của nhóm; trả null nếu nhóm thiếu dữ liệu hợp lệ. */
export function lamSachDuLieu(nhom: NhomPreset, v: unknown): DuLieuPreset | null {
  if (!laDoiTuong(v)) return null;
  const kq: DuLieuPreset = {};
  for (const f of TRUONG_NHOM[nhom]) {
    if (v[f] === undefined) continue;
    if (f === 'chiTieu') { const x = sachChiTieu(v[f]); if (x) kq.chiTieu = x; }
    else if (f === 'coCau') { const x = sachCoCau(v[f]); if (x) kq.coCau = x; }
    else if (f === 'nguong') { const x = sachSoCoKhoa(v[f], KHOA_NGUONG); if (x) kq.nguong = x as NguongMau; }
    else if (f === 'ham') { const x = sachSoCoKhoa(v[f], KHOA_HAM); if (x) kq.ham = x as unknown as HamPreset; }
    else if (laDoiTuong(v[f])) kq[f as 'heSo' | 'phanHam'] = sao(v[f]);
  }
  // Nhóm theo mục phải có đúng trường của nó; nhóm cấp cần ít nhất một trường.
  return Object.keys(kq).length ? kq : null;
}

const taiTen = (s: unknown) => (typeof s === 'string' ? s.trim().slice(0, TEN_TOI_DA) : '');

function lamSachDs(nhom: NhomPreset, v: unknown): Preset[] {
  if (!Array.isArray(v)) return [];
  const ra: Preset[] = [];
  for (const x of v) {
    if (!laDoiTuong(x)) continue;
    const ten = taiTen(x.ten);
    const du = lamSachDuLieu(nhom, x.du);
    if (ten && du && !ra.some((p) => p.ten === ten)) ra.push({ ten, du });
  }
  return ra;
}

/** Danh sách preset của nhóm; kho lỗi hoặc dữ liệu hỏng thì trả rỗng. */
export function docPreset(kho: KhoPreset, nhom: NhomPreset): Preset[] {
  try {
    const chu = kho.getItem(khoaPreset(nhom));
    return chu ? lamSachDs(nhom, JSON.parse(chu)) : [];
  } catch {
    return [];
  }
}

function ghiPreset(kho: KhoPreset, nhom: NhomPreset, ds: Preset[]): boolean {
  try {
    kho.setItem(khoaPreset(nhom), JSON.stringify(ds));
    return true;
  } catch {
    return false;
  }
}

/** Lưu (trùng tên thì ghi đè). Trả danh sách mới, hoặc null nếu tên rỗng / dữ liệu rỗng / kho đầy. */
export function luuPreset(kho: KhoPreset, nhom: NhomPreset, ten: string, du: DuLieuPreset): Preset[] | null {
  const tenSach = taiTen(ten);
  const duSach = lamSachDuLieu(nhom, du);
  if (!tenSach || !duSach) return null;
  const ds = docPreset(kho, nhom);
  const i = ds.findIndex((p) => p.ten === tenSach);
  const moi: Preset = { ten: tenSach, du: duSach };
  if (i >= 0) ds[i] = moi;
  else ds.push(moi);
  return ghiPreset(kho, nhom, ds) ? ds : null;
}

export function xoaPreset(kho: KhoPreset, nhom: NhomPreset, ten: string): Preset[] {
  const ds = docPreset(kho, nhom).filter((p) => p.ten !== ten);
  ghiPreset(kho, nhom, ds);
  return ds;
}

/** Nội dung file JSON để chia sẻ giữa máy. */
export const xuatPreset = (nhom: NhomPreset, ds: Preset[]): string =>
  JSON.stringify({ dinhDang: DINH_DANG, phienBan: 1, nhom, ds }, null, 2);

export type KetQuaNhap = { ok: true; them: number; ds: Preset[] } | { ok: false; loi: 'hong' | 'sai_nhom' | 'rong' | 'kho' };

/** Nhập file JSON: gộp vào kho, trùng tên thì ghi đè. */
export function nhapPreset(kho: KhoPreset, nhom: NhomPreset, chu: string): KetQuaNhap {
  let j: unknown;
  try {
    j = JSON.parse(chu);
  } catch {
    return { ok: false, loi: 'hong' };
  }
  if (!laDoiTuong(j) || j.dinhDang !== DINH_DANG) return { ok: false, loi: 'hong' };
  if (j.nhom !== nhom) return { ok: false, loi: 'sai_nhom' };
  const vao = lamSachDs(nhom, j.ds);
  if (!vao.length) return { ok: false, loi: 'rong' };
  const ds = docPreset(kho, nhom);
  for (const p of vao) {
    const i = ds.findIndex((x) => x.ten === p.ten);
    if (i >= 0) ds[i] = p;
    else ds.push(p);
  }
  return ghiPreset(kho, nhom, ds) ? { ok: true, them: vao.length, ds } : { ok: false, loi: 'kho' };
}

/** Chụp cấu hình hiện tại thành dữ liệu preset. `lo` null thì bỏ phần theo lô. */
export function chupPreset(nhom: NhomPreset, pa: TrangThaiPA, lo: Lo | null | undefined): DuLieuPreset {
  const du: DuLieuPreset = {};
  for (const f of TRUONG_NHOM[nhom]) {
    if (f === 'chiTieu' && lo) du.chiTieu = sao(lo.temDat.chiTieu);
    else if (f === 'coCau' && lo) du.coCau = sao(lo.temDat.coCauMucTieu);
    else if (f === 'heSo') du.heSo = sao(pa.heSo);
    else if (f === 'phanHam') { if (pa.phanHam !== undefined) du.phanHam = sao(pa.phanHam); }
    else if (f === 'nguong') du.nguong = sao(pa.nguong);
    else if (f === 'ham') { const { ranh: _ranh, ...con } = pa.ham; du.ham = sao(con); }
  }
  return du;
}

/**
 * Áp preset vào PA. Phần theo lô (chỉ tiêu, cơ cấu): `lo` = lô đang chọn, `pa` = mọi lô nhà ở cao tầng.
 * Phần chung PA (hệ số, ngưỡng, hầm) chỉ áp khi phạm vi `pa`, hoặc khi là preset theo mục của chính phần đó.
 */
export function apPreset(nhom: NhomPreset, pa: TrangThaiPA, du: DuLieuPreset, pham: PhamViPreset, loId: string | null): TrangThaiPA {
  const chung = pham === 'pa' || nhom !== 'cap';
  const trungLo = (l: Lo) => (pham === 'pa' && nhom === 'cap' ? laCaoTang(l) : l.id === loId);
  let ra = pa;
  if (TRUONG_LO.some((f) => du[f] && TRUONG_NHOM[nhom].includes(f))) {
    ra = {
      ...ra,
      lo: ra.lo.map((l) => {
        if (!trungLo(l)) return l;
        const td = { ...l.temDat };
        if (du.chiTieu && TRUONG_NHOM[nhom].includes('chiTieu')) td.chiTieu = sao(du.chiTieu);
        if (du.coCau && TRUONG_NHOM[nhom].includes('coCau')) td.coCauMucTieu = sao(du.coCau);
        return { ...l, temDat: td };
      }),
    };
  }
  if (chung) {
    const ok = (f: keyof DuLieuPreset) => du[f] !== undefined && TRUONG_NHOM[nhom].includes(f);
    if (ok('heSo')) ra = { ...ra, heSo: sao(du.heSo) as TrangThaiPA['heSo'] };
    if (ok('phanHam')) ra = { ...ra, phanHam: sao(du.phanHam) as TrangThaiPA['phanHam'] };
    if (ok('nguong')) ra = { ...ra, nguong: sao(du.nguong!) };
    if (ok('ham')) ra = { ...ra, ham: { ...ra.ham, ...sao(du.ham!) } };
  }
  return ra;
}

/** localStorage của trình duyệt, hoặc null nếu bị chặn. */
export function khoTrinhDuyet(): KhoPreset | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
