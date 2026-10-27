/**
 * Đọc bảng chỉ tiêu sử dụng đất (Excel) của quy hoạch: tự nhận cột theo tiêu đề, gộp dòng "Công trình…" vào nhóm đất,
 * rồi ghép các dòng với lô đọc từ DXF (theo ký hiệu, theo DT từng lô, theo tổng DT nhiều lô).
 */
import { dienTich } from '../tinh/hinhHoc';
import type { ChiTieuQH, ChucNang, Lo } from '../tinh/kieu';
import { boDau, chuTrongO, soTrongO, type Luoi, type Sheet } from './luoi';

export type TruongBang = 'dtDat' | 'matDoDe' | 'matDoThap' | 'tangHam' | 'tangDe' | 'tangThap' | 'tangCao' | 'hssdd' | 'danSo' | 'soCan' | 'cayXanh';
export const TRUONG_BANG: TruongBang[] = ['dtDat', 'matDoDe', 'matDoThap', 'tangHam', 'tangDe', 'tangThap', 'tangCao', 'hssdd', 'danSo', 'soCan'];

export type DongBang = {
  dong: number; // số hàng Excel (đếm từ 1)
  stt: string;
  ten: string;
  gt: Partial<Record<TruongBang, number>>;
  /** Hàng Excel của dòng "Công trình…" đã góp giá trị cho dòng này. */
  gopTu: number[];
  chucNangDoan: ChucNang | null;
  /** Dòng chia bên trong một lô (công trình, cây xanh / giao thông nội khu của nhóm đất ở): không ghép với lô. */
  noiBo: boolean;
  /** Dòng cộng của các dòng con (Tổng, nhóm I/II, "1" khi có "1.1"…): không cần lô riêng. */
  tongHop: boolean;
};
export type BangChiTieu = { sheet: string; hangTieuDe: number[]; cot: Partial<Record<TruongBang | 'ten' | 'stt', number>>; dong: DongBang[] };

/** Nhận một cột theo chuỗi tiêu đề đã bỏ dấu (ghép tiêu đề nhóm + tiêu đề con). */
function nhanCot(h: string): TruongBang | 'ten' | 'stt' | null {
  if (!h) return null;
  if (/^(stt|tt|so tt)$/.test(h)) return 'stt';
  if (/ky hieu|ma lo|ten lo|o dat$|hang muc|chuc nang|loai dat/.test(h)) return 'ten';
  if (/lanh nan|do xe|ty le|tb can|trung binh|dien tich xay dung|dien tich san|tong dien tich|tong san|dtxd|thoi gian|ghi chu|chi chu|noi dung/.test(h)) return null;
  if (/mdxd|mat do/.test(h)) return /thap/.test(h) ? 'matDoThap' : 'matDoDe';
  if (/he so|hssdd|^sdd/.test(h)) return 'hssdd';
  if (/dan so/.test(h)) return 'danSo';
  if (/so can|can ho|can\/lo/.test(h)) return 'soCan';
  if (/tang/.test(h)) {
    if (/ham/.test(h)) return 'tangHam';
    if (/\bde\b/.test(h)) return 'tangDe';
    if (/thap/.test(h)) return 'tangThap';
    return 'tangCao';
  }
  if (/dien tich|^dt\b/.test(h)) return 'dtDat';
  return null;
}

/** Tìm hàng tiêu đề: hàng đầu tiên (trong 15 hàng) nhận được ≥ 3 cột; hàng ngay dưới là tiêu đề con nếu ít số. */
function timTieuDe(luoi: Luoi): number[] | null {
  for (let r = 0; r < Math.min(15, luoi.length); r++) {
    const hang = luoi[r] ?? [];
    const nhan = hang.filter((o) => typeof o === 'string' && nhanCot(boDau(o)) !== null).length;
    if (nhan < 3) continue;
    const duoi = luoi[r + 1] ?? [];
    const so = duoi.filter((o) => soTrongO(o) !== null).length;
    const chu = duoi.filter((o) => typeof o === 'string' && o.trim()).length;
    return chu > 0 && so === 0 ? [r, r + 1] : [r];
  }
  return null;
}

function doanChucNang(ten: string): ChucNang | null {
  const h = boDau(ten);
  if (/xa hoi|noxh/.test(h)) return 'xh';
  if (/thuong mai|notm|hon hop|chung cu|nha o cao tang|^hh/.test(h)) return 'tm';
  if (/giao duc|cong cong|cay xanh|giao thong|ha tang|nghia trang|dich vu|tmdv|van hoa|y te|tdtt|cho|truong|mam non/.test(h)) return 'khac';
  return null;
}

/** Đọc một sheet thành bảng chỉ tiêu. Không nhận được tiêu đề thì null. */
export function docBangChiTieu(sh: Sheet): BangChiTieu | null {
  const { luoi } = sh;
  const hangTieuDe = timTieuDe(luoi);
  if (!hangTieuDe) return null;
  const soCot = Math.max(...luoi.slice(0, hangTieuDe.at(-1)! + 1).map((h) => h.length));
  const cot: BangChiTieu['cot'] = {};
  for (let c = 0; c < soCot; c++) {
    // Ghép tiêu đề nhóm + tiêu đề con; ô gộp đã được chép sang nên nhóm "Tầng cao" phủ cả "Hầm", "Đế", "Tháp".
    const phan = hangTieuDe.map((r) => boDau(chuTrongO(luoi[r]?.[c] ?? null)));
    const h = [...new Set(phan.filter(Boolean))].join(' ');
    const k = nhanCot(h);
    if (k && cot[k] === undefined) cot[k] = c;
  }
  if (cot.ten === undefined) {
    // Không có cột tên: lấy cột chữ đầu tiên của vùng dữ liệu.
    const dau = luoi.slice(hangTieuDe.at(-1)! + 1, hangTieuDe.at(-1)! + 10);
    for (let c = 0; c < soCot && cot.ten === undefined; c++) if (dau.filter((h) => typeof h[c] === 'string' && soTrongO(h[c]) === null).length >= 3) cot.ten = c;
  }
  if (cot.ten === undefined) return null;
  // Cột ha: DT đất nhân 10.000.
  const dtHa = cot.dtDat !== undefined && hangTieuDe.some((r) => /\(ha\)|\bha\b/.test(boDau(chuTrongO(luoi[r]?.[cot.dtDat!] ?? null))));

  const ds: DongBang[] = [];
  for (let r = hangTieuDe.at(-1)! + 1; r < luoi.length; r++) {
    const hang = luoi[r] ?? [];
    const ten = chuTrongO(hang[cot.ten] ?? null).replace(/\s+/g, ' ');
    if (!ten || soTrongO(ten) !== null) continue;
    const gt: DongBang['gt'] = {};
    for (const k of TRUONG_BANG) {
      if (cot[k] === undefined) continue;
      const v = soTrongO(hang[cot[k]!] ?? null);
      if (v !== null) gt[k] = k === 'dtDat' && dtHa ? v * 10000 : v;
    }
    if (!Object.keys(gt).length) continue;
    const stt = cot.stt !== undefined ? chuTrongO(hang[cot.stt] ?? null) : '';
    ds.push({ dong: r + 1, stt, ten, gt, gopTu: [], chucNangDoan: doanChucNang(ten), noiBo: false, tongHop: false });
  }
  // Dòng "Công trình…" không số thứ tự nằm dưới một nhóm đất: góp các giá trị nhóm còn thiếu (tầng, HSSDĐ, số căn…).
  let nhom: DongBang | null = null;
  for (const d of ds) {
    if (d.stt) { nhom = d; continue; }
    const h = boDau(d.ten);
    d.noiBo = /noi khu|^cong trinh/.test(h) || (nhom !== null && nhom.chucNangDoan !== null && nhom.chucNangDoan !== 'khac');
    // "Cây xanh nội khu" của nhóm đất ở: tỷ lệ cây xanh tối thiểu = DT cây xanh / DT nhóm.
    if (nhom && d.noiBo && /^cay xanh/.test(h) && d.gt.dtDat && nhom.gt.dtDat && nhom.gt.cayXanh === undefined) nhom.gt.cayXanh = (d.gt.dtDat / nhom.gt.dtDat) * 100;
    if (!nhom || !/^cong trinh/.test(h)) continue;
    for (const k of TRUONG_BANG) if (k !== 'dtDat' && k !== 'cayXanh' && nhom.gt[k] === undefined && d.gt[k] !== undefined) nhom.gt[k] = d.gt[k];
    nhom.gopTu.push(d.dong);
    if (!nhom.chucNangDoan) nhom.chucNangDoan = d.chucNangDoan;
  }
  // Dòng tổng hợp: tên "Tổng…", STT La Mã, có dòng con "x.y", hoặc DT bằng tổng các dòng không STT ngay dưới.
  ds.forEach((d, i) => {
    const h = boDau(d.ten);
    let conDuoi = 0;
    for (let j = i + 1; j < ds.length && !ds[j].stt; j++) if (!ds[j].noiBo) conDuoi += ds[j].gt.dtDat ?? 0;
    d.tongHop = /^tong/.test(h) || /^[ivx]+$/i.test(d.stt) || (!!d.stt && ds.some((x) => x.stt.startsWith(`${d.stt}.`)))
      || (!!d.stt && !!d.gt.dtDat && conDuoi > 0 && Math.abs(conDuoi - d.gt.dtDat) <= d.gt.dtDat * SAI_SO_GHEP);
  });
  return { sheet: sh.ten, hangTieuDe: hangTieuDe.map((r) => r + 1), cot, dong: ds };
}

/** Chọn sheet chỉ tiêu: nhận được nhiều cột nhất; hòa thì sheet có số ngày (vd 261019) lớn nhất, rồi sheet có dấu "@". */
export function chonSheet(ds: Sheet[]): BangChiTieu | null {
  const ngay = (t: string) => Math.max(0, ...(t.match(/\d{6}/g) ?? []).map(Number));
  const hon = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
  let tot: { b: BangChiTieu; diem: number[] } | null = null;
  for (const sh of ds) {
    const b = docBangChiTieu(sh);
    if (!b || !b.dong.length) continue;
    const diem = [Object.keys(b.cot).length, ngay(sh.ten), sh.ten.includes('@') ? 1 : 0];
    if (!tot || hon(diem, tot.diem)) tot = { b, diem };
  }
  return tot?.b ?? null;
}

// ——— Ghép dòng bảng với lô DXF ———

export type CachGhep = 'ky_hieu' | 'dien_tich' | 'nhom' | 'tay';
export type GhepDong = { dong: number; loIds: string[]; cach: CachGhep | null; dtDxf: number; lechPct: number | null };
export type KetQuaGhep = { ghep: GhepDong[]; loChuaGhep: string[] };

const SAI_SO_GHEP = 0.01; // lệch DT ≤ 1 % thì coi là cùng lô
const maKyHieu = (s: string) => boDau(s).replace(/[^a-z0-9]/g, '').replace(/([a-z])0+(\d)/g, '$1$2');
const dtLo = (l: Lo) => (l.ranh.length >= 3 ? dienTich(l.ranh) : 0);
/** Cấp của số thứ tự: "1.1" sâu hơn "1"; dòng sâu được ghép trước để dòng tổng không giành lô. */
const capSTT = (stt: string) => (stt ? stt.split('.').filter(Boolean).length : 9);

/** Tự ghép: 1) ký hiệu trùng; 2) một lô có DT lệch ≤ 1 %; 3) một nhóm lô cùng loại (đất ở / khác) có tổng DT lệch ≤ 1 %. */
export function ghepLo(bang: BangChiTieu, ds: Lo[]): KetQuaGhep {
  const conLai = new Set(ds.map((l) => l.id));
  const dt = new Map(ds.map((l) => [l.id, dtLo(l)]));
  const kq = new Map<number, GhepDong>();
  const coDt = bang.dong.filter((d) => !d.noiBo && (d.gt.dtDat ?? 0) > 0);
  const lech = (a: number, b: number) => ((a - b) / b) * 100;
  const theoId = new Map(ds.map((l) => [l.id, l]));
  /** Nhóm ≥ 2 lô có tổng DT lệch ≤ 1 %: ít lô nhất, rồi lệch ít nhất. Tối đa 12 lô ứng viên (lớn nhất). */
  const timNhom = (ung: string[], muc: number): { ids: string[]; e: number } | null => {
    if (ung.length > 12) ung = [...ung].sort((a, b) => dt.get(b)! - dt.get(a)!).slice(0, 12);
    let tot: { ids: string[]; e: number } | null = null;
    for (let mask = 1; mask < 1 << ung.length; mask++) {
      const ids = ung.filter((_, i) => mask & (1 << i));
      if (ids.length < 2) continue;
      const e = Math.abs(ids.reduce((a, id) => a + dt.get(id)!, 0) - muc) / muc;
      if (e <= SAI_SO_GHEP && (!tot || ids.length < tot.ids.length || (ids.length === tot.ids.length && e < tot.e))) tot = { ids, e };
    }
    return tot;
  };
  const dat = (d: DongBang, loIds: string[], cach: CachGhep) => {
    loIds.forEach((id) => conLai.delete(id));
    const tong = loIds.reduce((a, id) => a + dt.get(id)!, 0);
    kq.set(d.dong, { dong: d.dong, loIds, cach, dtDxf: tong, lechPct: d.gt.dtDat ? lech(tong, d.gt.dtDat) : null });
  };

  for (const d of bang.dong) {
    if (d.noiBo) continue;
    const m = maKyHieu(d.ten);
    const l = ds.find((x) => conLai.has(x.id) && m && maKyHieu(x.temDat.kyHieu) === m);
    if (l) dat(d, [l.id], 'ky_hieu');
  }
  // Ghép một lô: cặp (dòng, lô) lệch ít nhất trước.
  const cap: { d: DongBang; id: string; e: number }[] = [];
  for (const d of coDt) if (!kq.has(d.dong)) for (const id of conLai) { const e = Math.abs(dt.get(id)! - d.gt.dtDat!) / d.gt.dtDat!; if (e <= SAI_SO_GHEP) cap.push({ d, id, e }); }
  cap.sort((a, b) => a.e - b.e);
  for (const c of cap) if (!kq.has(c.d.dong) && conLai.has(c.id)) dat(c.d, [c.id], 'dien_tich');
  // Ghép nhóm lô cho dòng nhóm đất (dòng con sâu trước). Ưu tiên lô cùng chức năng đoán được.
  for (const d of [...coDt].sort((a, b) => capSTT(b.stt) - capSTT(a.stt))) {
    if (kq.has(d.dong)) continue;
    const vua = (ids: string[]) => ids.filter((id) => dt.get(id)! > 0 && dt.get(id)! < d.gt.dtDat! * (1 + SAI_SO_GHEP));
    // Dòng đất ở chỉ ghép với lô đất ở, dòng đất khác với lô khác (theo chức năng lô đoán từ lớp DXF); không ra thì thử mọi lô.
    const datO = d.chucNangDoan === null ? null : d.chucNangDoan !== 'khac';
    const cung = vua([...conLai].filter((id) => datO === null || (theoId.get(id)!.temDat.chucNang !== 'khac') === datO));
    const tot = timNhom(cung, d.gt.dtDat!) ?? (datO === null ? null : timNhom(vua([...conLai]), d.gt.dtDat!));
    if (tot) dat(d, tot.ids, 'nhom');
  }
  const ghep = bang.dong.map((d) => kq.get(d.dong) ?? { dong: d.dong, loIds: [], cach: null, dtDxf: 0, lechPct: null });
  return { ghep, loChuaGhep: [...conLai] };
}

/** Đổi ghép bằng tay: gán lô cho dòng (bỏ lô khỏi dòng cũ). dong = null: bỏ ghép. */
export function ghepTay(kq: KetQuaGhep, bang: BangChiTieu, ds: Lo[], loId: string, dong: number | null): KetQuaGhep {
  const dt = new Map(ds.map((l) => [l.id, dtLo(l)]));
  const ghep = kq.ghep.map((g) => {
    const loIds = g.dong === dong ? [...new Set([...g.loIds.filter((x) => x !== loId), loId])] : g.loIds.filter((x) => x !== loId);
    if (loIds.length === g.loIds.length && loIds.every((x, i) => x === g.loIds[i])) return g;
    const d = bang.dong.find((x) => x.dong === g.dong)!;
    const tong = loIds.reduce((a, id) => a + dt.get(id)!, 0);
    return { ...g, loIds, cach: loIds.length ? ('tay' as const) : null, dtDxf: tong, lechPct: d.gt.dtDat && loIds.length ? ((tong - d.gt.dtDat) / d.gt.dtDat) * 100 : null };
  });
  const daGhep = new Set(ghep.flatMap((g) => g.loIds));
  return { ghep, loChuaGhep: ds.map((l) => l.id).filter((id) => !daGhep.has(id)) };
}

const tron = (v: number, n: number) => Math.round(v * 10 ** n) / 10 ** n;

/** Chia số nguyên theo tỷ lệ, tổng giữ đúng (phần dư lớn nhất được cộng trước). */
export function chiaTheoTyLe(tong: number, tyLe: number[]): number[] {
  const s = tyLe.reduce((a, b) => a + b, 0);
  if (s <= 0) return tyLe.map(() => 0);
  const tho = tyLe.map((t) => (tong * t) / s);
  const nguyen = tho.map(Math.floor);
  let du = Math.round(tong) - nguyen.reduce((a, b) => a + b, 0);
  const thuTu = tho.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of thuTu) { if (du <= 0) break; nguyen[i]++; du--; }
  return nguyen;
}

/**
 * Áp chỉ tiêu các dòng đã ghép vào lô. Dòng ghép nhiều lô: dân số và số căn chia theo tỷ lệ DT lô, các chỉ tiêu
 * tỷ lệ (MĐXD, HSSDĐ, tầng) giữ nguyên. Chức năng lô đổi theo tên dòng nếu đoán được.
 */
export function apChiTieu(ds: Lo[], bang: BangChiTieu, kq: KetQuaGhep, tep: string): Lo[] {
  const theoLo = new Map<string, Lo>(ds.map((l) => [l.id, l]));
  for (const g of kq.ghep) {
    if (!g.loIds.length) continue;
    const d = bang.dong.find((x) => x.dong === g.dong)!;
    const tyLe = g.loIds.map((id) => dtLo(theoLo.get(id)!));
    const danSo = d.gt.danSo !== undefined ? chiaTheoTyLe(d.gt.danSo, tyLe) : null;
    const soCan = d.gt.soCan !== undefined ? chiaTheoTyLe(d.gt.soCan, tyLe) : null;
    g.loIds.forEach((id, i) => {
      const l = theoLo.get(id)!;
      const ct: ChiTieuQH = { ...l.temDat.chiTieu };
      const v = d.gt;
      // Bảng Excel hay chứa số tính ra (21,593787…): làm tròn % 2 chữ số, HSSDĐ 3 chữ số.
      if (v.matDoDe !== undefined) ct.matDoMax = tron(v.matDoDe, 2);
      if (v.matDoThap !== undefined) ct.matDoThapMax = tron(v.matDoThap, 2);
      if (v.hssdd !== undefined) ct.hssddMax = tron(v.hssdd, 3);
      if (v.cayXanh !== undefined) ct.cayXanhMin = tron(v.cayXanh, 2);
      if (v.tangHam !== undefined) ct.tangHam = v.tangHam;
      if (v.tangDe !== undefined) ct.tangDe = v.tangDe;
      if (v.tangThap !== undefined) ct.tangCanHo = v.tangThap;
      if (v.tangCao !== undefined) ct.tangCaoMax = v.tangCao;
      else if (v.tangDe !== undefined && v.tangThap !== undefined) ct.tangCaoMax = v.tangDe + v.tangThap;
      if (danSo) ct.danSoMax = danSo[i];
      if (soCan) ct.soCanMax = soCan[i];
      if (danSo && soCan && soCan[i] > 0) ct.nguoiMoiCan = Math.round((d.gt.danSo! / d.gt.soCan!) * 100) / 100;
      const chucNang = d.chucNangDoan ?? l.temDat.chucNang;
      theoLo.set(id, {
        ...l,
        temDat: {
          ...l.temDat,
          chucNang,
          chiTieu: ct,
          nguonChiTieu: { tep, sheet: bang.sheet, dong: d.dong, ten: d.ten, dtBang: d.gt.dtDat ?? null, soLo: g.loIds.length },
        },
      });
    });
  }
  return ds.map((l) => theoLo.get(l.id)!);
}
