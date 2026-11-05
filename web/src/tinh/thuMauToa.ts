/**
 * Thử ngẫu nhiên MỘT tòa (màn Thư viện mẫu — nút "Thử phá"): chạy chuỗi thao tác tay như người dùng — xoá / thêm / đổi chỗ / lật / STRETCH
 * căn, thêm / xoá / dời / đổi loại thang, co kéo đầu hành lang, thay / trả lõi, dồn khít — rồi sau MỖI bước kiểm bằng `kiemMauToa`
 * (so với nền của mẫu). Thao tác bị từ chối (không đủ chỗ…) thì bỏ qua, tòa giữ nguyên. Hạt cố định → lặp lại được.
 * Cùng bảng phép với giao diện (tinh/tayNen.ts) nên kết quả đúng như bấm thật; bài phá hoại đầy đủ ở tinh/phaHoaiChay.ts.
 */
import { mauToa } from './canThem';
import { ST_BUOC } from './stretch';
import type { ToaDat } from './kieu';
import { dauHanhLangNgoai, THANG_N2, tuChinhToa, type ToaMB } from './loiThang';
import { kiemMauToa, toaNen, trangThaiMau, type Ctx, type ViPhamMau } from './kiemMauToa';
import { boCucTang, canDangDung, congNangTai } from './matBang';
import { chayPhep, phepTay, type PhepTay } from './tayNen';
import { dsLoiToa, loiThayDuocToa, mauThem } from './thaoTacTay';

/** PRNG hạt cố định (mulberry32). */
export function rng(hat: number) {
  let a = hat >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export type NhomPhep = 'xoa' | 'them' | 'doiCho' | 'lat' | 'stretch' | 'themThang' | 'xoaThang' | 'doiThang' | 'doiLoaiThang' | 'hanhLang' | 'thayLoi' | 'traLoi' | 'donKhit';

/** Một phép ngẫu nhiên dạng dữ liệu; null = không có phép hợp lệ để thử. */
export function phepNgauNhienMau(toa: ToaDat, c: Ctx, r: () => number): { nhom: NhomPhep; op: string; ph: PhepTay | 'donKhit' } | null {
  const s = trangThaiMau(toa, c);
  const can = s.vts.filter((v) => congNangTai(v.khoa, boCucTang(toa, null)) === 'can');
  if (!can.length) return null;
  const chon = <T,>(ds: T[]) => ds[Math.floor(r() * ds.length)];
  const x = r();
  if (x < 0.12) { const v = chon(can); return { nhom: 'xoa', op: `xoá ${v.khoa}`, ph: phepTay('xoaCanTay', toa, null, [v.khoa]) }; }
  if (x < 0.22) { const v = chon(can); return { nhom: 'them', op: `thêm sau ${v.khoa}`, ph: phepTay('themCanTay', toa, null, v, mauThem(c.tv, canDangDung(v, boCucTang(toa, null))), r() < 0.3) }; }
  if (x < 0.32) { const a = chon(can), b = chon(can); return { nhom: 'doiCho', op: `đổi chỗ ${a.khoa} ↔ ${b.khoa}`, ph: phepTay('doiChoTay', toa, null, a, b) }; }
  if (x < 0.42) { const ds = [...new Set([chon(can).khoa, ...(r() < 0.4 ? [chon(can).khoa] : [])])]; return { nhom: 'lat', op: `lật ${ds.join(',')}`, ph: phepTay('latTay', toa, null, ds) }; }
  if (x < 0.54) { const v = chon(can), d = (r() < 0.5 ? -1 : 1) * ST_BUOC * (1 + Math.floor(r() * 3)); return { nhom: 'stretch', op: `STRETCH ${v.khoa} ${d > 0 ? '+' : ''}${d}`, ph: phepTay('stretchCanTay', toa, v.khoa, d) }; }
  if (x < 0.62) { const v = chon(can); return { nhom: 'themThang', op: `thêm thang sau ${v.khoa}`, ph: phepTay('themThangTay', toa, v.matIdx, v.khoa) }; }
  if (x < 0.70) { const t = chon(s.thang); return { nhom: 'xoaThang', op: `xoá thang ${t.khoa}`, ph: phepTay('xoaThangTay', toa, t.khoa) }; }
  if (x < 0.77) { const t = chon(s.thang), v = chon(can); return { nhom: 'doiThang', op: `dời thang ${t.khoa} → sau ${v.khoa}`, ph: phepTay('doiThangTay', toa, t.khoa, v.matIdx, v.khoa) }; }
  if (x < 0.82) { const t = chon(s.thang); return { nhom: 'doiLoaiThang', op: `đổi loại ${t.khoa}`, ph: phepTay('doiLoaiThangTay', toa, t.khoa, t.block === THANG_N2 ? 'x_tb_n3' : THANG_N2) }; }
  if (x < 0.88) {
    const ds = (s.hd.hanh_lang ?? []).flatMap((_, i) => dauHanhLangNgoai(s.hd.hanh_lang ?? [], i, s.hd.duong_bao).map((dau) => [i, dau] as const));
    if (ds.length) { const [i, dau] = chon(ds), d = Math.round((r() * 10 - 4) * 10) * 100; return { nhom: 'hanhLang', op: `kéo hành lang ${i}:${dau} ${d}`, ph: phepTay('keoHanhLangTay', toa, i, dau, d) }; }
  }
  if (x < 0.96) {
    const dangThay = Object.keys(toa.loiThay ?? {});
    if (dangThay.length && r() < 0.5) { const k = chon(dangThay); return { nhom: 'traLoi', op: `trả lõi ${k}`, ph: phepTay('huyThayLoiTay', toa, k) }; }
    const co = dsLoiToa(toa, c).flatMap((l) => loiThayDuocToa(toa, c, l.khoa).map((b) => [l.khoa, b] as const));
    if (co.length) { const [k, b] = chon(co); return { nhom: 'thayLoi', op: `thay lõi ${k} → ${b}`, ph: phepTay('thayLoiTay', toa, k, b) }; }
  }
  return { nhom: 'donKhit', op: 'dồn khít (tự chỉnh lại)', ph: 'donKhit' };
}

export type BuocThu = { buoc: number; op: string; nhom: NhomPhep; nhan: boolean; vi: ViPhamMau[] };
export type KetQuaThu = {
  soBuoc: number; soNhan: number; soTuChoi: number; soLoi: number;
  /** chỉ các bước có lỗi (nhận phép mà vi phạm bất biến) */
  loi: BuocThu[];
  /** từng nhóm phép: số lần thử / số lần nhận */
  thongKe: Partial<Record<NhomPhep, { thu: number; nhan: number }>>;
  /** tòa sau chuỗi thao tác (để người dùng xem / giữ lại) */
  toa: ToaDat;
};

/** Thử `buoc` thao tác ngẫu nhiên (hạt `hat`) trên bản sao của `toa`; dừng sớm khi hết `hanMs` (mặc định 8 s). */
export function thuMauToa(toa0: ToaDat, c: Ctx, opt: { hat?: number; buoc?: number; hanMs?: number } = {}): KetQuaThu {
  const r = rng(opt.hat ?? 1), n = opt.buoc ?? 24, han = Date.now() + (opt.hanMs ?? 8000);
  const nen = toaNen(toa0, c);
  let toa = toa0;
  const kq: KetQuaThu = { soBuoc: 0, soNhan: 0, soTuChoi: 0, soLoi: 0, loi: [], thongKe: {}, toa };
  for (let b = 0; b < n && Date.now() < han; b++) {
    const p = phepNgauNhienMau(toa, c, r);
    if (!p) break;
    kq.soBuoc++;
    const tk = (kq.thongKe[p.nhom] ??= { thu: 0, nhan: 0 });
    tk.thu++;
    const res = p.ph === 'donKhit' ? { ok: true as const, toa: tuChinhToa(toa, mauToa(c.tv, toa) as ToaMB, c.tv, c.dl) } : chayPhep(p.ph, c);
    if (!res.ok) { kq.soTuChoi++; continue; }
    tk.nhan++; kq.soNhan++;
    toa = res.toa;
    const vi = kiemMauToa(toa, c, nen).vi.filter((v) => v.muc === 'loi');
    if (vi.length) { kq.soLoi++; kq.loi.push({ buoc: b + 1, op: p.op, nhom: p.nhom, nhan: true, vi }); }
  }
  kq.toa = toa;
  return kq;
}
