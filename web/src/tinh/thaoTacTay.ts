/**
 * Công cụ tay màn Tầng (như thanh công cụ app cũ MDI_Unitmix_v4 `prototype/shell.src.html` ~1250: tMove · tAdd · tAddStair · tDel ·
 * mirrorSel · nhXoa; luật docs/QUY_TAC_XEP_CAN.md QT-8 · QT-10 · QT-30 · QT-32 · QT-33 · QT-69 · QT-102). Mỗi thao tác:
 *  1. sửa bố cục tòa (đổi chỗ / lật / bỏ căn theo phạm vi tầng; căn thêm, thang tay cho mọi tầng);
 *  2. chạy lại tự chỉnh (XC-03/05/06/07 · PC-11 · QT-69, `tuChinhSauSua`) — DT, số căn, thoát nạn, DTXD, nét bao tính lại;
 *  3. kiểm: không đè mới, không khe mới (tinh/khe.ts qua `doDeKhe`), thao tác thật sự áp được — không thì trả lý do, KHÔNG sửa
 *     (app cũ: "Không đủ chỗ … Đã hoàn tác").
 * Hàm thuần; màn Tầng gọi trong một `kho.sua` nên cả lượt (kể cả hàng loạt) là MỘT bước hoàn tác.
 */
import { chiSoCanThem, moRong, khoaCanThem, mauToa, rutCanThem } from './canThem';
import { doiCanTaiViTri, doiCanTheoTang, doiChoO, doiCongNang, latO } from './doiCan';
import { LOAI_CAN, type CanMau, type CanThem, type ThangTay, type ThuVien, type ToaDat } from './kieu';
import { chupThangTay, doDeKhe, ganLoaiThang, laLoaiThang, matBangCua, matBangTang, THANG_MAX, THANG_MIN, THANG_N2, THANG_N3, tuChinhSauSua, type ChanSua, type DuLieuMB, type LoaiThangBo, type ToaMB } from './loiThang';
import { boCucTang, canDangDung, congNangTai, tangCoRieng, viTriCan, type ViTriCan } from './matBang';

export type LyDoTay = 'de' | 'khe' | 'khong_bo' | 'it_thang' | 'nhieu_thang' | 'khong_dat_thang' | 'khong_dau_tu_do' | 'khong_doi' | 'thoat_nan';
export type KetQuaTay = { ok: true; toa: ToaDat; chan: ChanSua[]; canhBao?: 'nhieu_thang' | 'it_thang' } | { ok: false; lyDo: LyDoTay; chiTiet?: string };

export type Ctx = { tv: ThuVien; dl: DuLieuMB | null | undefined };

/** Đè / khe của tầng `tang` sau tự chỉnh (tinh/khe.ts). */
function doTang(toa: ToaDat, tang: number | null, { tv, dl }: Ctx) {
  const mau = mauToa(tv, toa) as ToaMB | undefined;
  if (!mau) return { de: 0, mm: 0, san: 0 };
  return doDeKhe(mau, matBangTang(toa, mau, dl, tang), dl, tv, boCucTang(toa, tang));
}

/** Chạy tự chỉnh sau phép sửa tay `sau` rồi kiểm không đè / khe mới trên các tầng `ks`. */
function chotSua(truoc: ToaDat, sau: ToaDat, ks: (number | null)[], c: Ctx): KetQuaTay {
  const mau = mauToa(c.tv, sau) as ToaMB | undefined;
  const r = tuChinhSauSua(truoc, sau, mau, c.tv, c.dl);
  for (const k of ks) {
    const a = doTang(truoc, k, c), b = doTang(r.toa, k, c);
    if (b.de > a.de) return { ok: false, lyDo: 'de' };
    if (b.mm > a.mm + 200 || b.san > a.san) return { ok: false, lyDo: 'khe', chiTiet: String(Math.round(b.mm - a.mm)) };
  }
  return { ok: true, toa: r.toa, chan: r.chan };
}

// ---------------- căn ----------------

/** Đổi chỗ hai ô (kéo căn sang ô khác — QT-8 · QT-30): mẫu căn, công năng, lật đổi cho nhau; dãy dồn khít lại. */
export function doiChoTay(toa: ToaDat, tangs: number[] | null, a: ViTriCan, b: ViTriCan, c: Ctx): KetQuaTay {
  if (a.khoa === b.khoa) return { ok: false, lyDo: 'khong_doi' };
  return chotSua(toa, doiChoO(toa, tangs, a, b), tangs ?? [null], c);
}

/** Lật gương (⇄) một hoặc nhiều ô (QT-102 hàng loạt). */
export function latTay(toa: ToaDat, tangs: number[] | null, khoas: string[], c: Ctx): KetQuaTay {
  if (!khoas.length) return { ok: false, lyDo: 'khong_doi' };
  return chotSua(toa, latO(toa, tangs, khoas), tangs ?? [null], c);
}

/**
 * Xoá căn (QT-69 · QT-30: bỏ hẳn ô, dồn khít, dãy ngắn lại ở đầu tự do, nét bao co theo — QT-31 · QT-33). Công năng ô 'bo' trên phạm
 * vi tầng đang chọn. Ô không bỏ được (không có đầu tự do mà dồn lại để khe) thì trả lý do.
 */
export function xoaCanTay(toa: ToaDat, tangs: number[] | null, khoas: string[], c: Ctx): KetQuaTay {
  if (!khoas.length) return { ok: false, lyDo: 'khong_doi' };
  let sua = doiCongNang(toa, tangs, khoas, 'bo');
  // căn thêm tay không còn là căn ở tầng nào (chung + mọi tầng riêng) → rút hẳn khỏi `canThem` (không để ô 'bo')
  const goc = c.tv.toa.get(toa.mauId);
  const rut = goc ? khoas.map((k) => ({ k, i: chiSoCanThem(goc, sua.canThem, k) })).filter(({ k, i }) => i >= 0
    && [null, ...tangCoRieng(sua)].every((t) => congNangTai(k, boCucTang(sua, t)) === 'bo')).sort((a, b) => b.i - a.i) : [];
  for (const { k } of rut) sua = rutCanThem(sua, goc!, k) ?? sua;
  const conBo = khoas.filter((k) => !rut.some((x) => x.k === k));
  const r = chotSua(toa, sua, tangs ?? [null], c);
  if (!r.ok) return r;
  const mau = mauToa(c.tv, r.toa) as ToaMB;
  for (const k of tangs ?? [null]) {
    const mb = matBangTang(r.toa, mau, c.dl, k);
    const sot = conBo.filter((x) => !mb.boCan?.includes(x));
    if (sot.length) return { ok: false, lyDo: 'khong_bo', chiTiet: sot.join(', ') };
  }
  return r;
}

/**
 * Thêm căn (app cũ tAdd): mẫu `id` chèn ngay sau ô `neo` — `truoc` = chèn ngay TRƯỚC ô đó (đầu dãy) — dãy dài ra ở đầu tự do
 * (QT-69). Căn thêm có ở mọi tầng; đang chọn tầng riêng thì ô mới là 'bo' ở bố cục chung và là căn ở các tầng đang chọn.
 */
export function themCanTay(toa: ToaDat, tangs: number[] | null, neo: ViTriCan, id: string, c: Ctx, truoc = false): KetQuaTay {
  const goc = c.tv.toa.get(toa.mauId);
  if (!goc) return { ok: false, lyDo: 'khong_doi' };
  const ds: CanThem[] = [...(toa.canThem ?? []), truoc ? { mat: neo.matIdx, truoc: neo.khoa, id } : { mat: neo.matIdx, sau: neo.khoa, id }];
  const { hong } = moRong(goc, ds, c.tv);
  if (hong.includes(ds.length - 1)) return { ok: false, lyDo: 'khong_dau_tu_do' };
  const khoa = khoaCanThem(goc, ds, ds.length - 1)!;
  let sua: ToaDat = { ...toa, canThem: ds };
  if (tangs) {
    sua = doiCongNang(sua, null, [khoa], 'bo');
    sua = doiCongNang(sua, tangs, [khoa], 'can');
  }
  const r = chotSua(toa, sua, tangs ?? [null], c);
  if (!r.ok) return r;
  // căn thêm làm căn khác vượt cự ly thoát nạn → tự chỉnh phải bỏ / đổi căn: số căn không tăng thì không nhận
  const soCan = (x: ToaDat) => { const m = mauToa(c.tv, x) as ToaMB; return matBangTang(x, m, c.dl, tangs?.[0] ?? null).baoCao?.soCan ?? 0; };
  if (soCan(r.toa) <= soCan(toa)) return { ok: false, lyDo: 'thoat_nan' };
  return r;
}

/**
 * Đặt lại căn vào ô trống / ô đã xoá `khoa` (công năng 'trong' / 'bo' → căn, mẫu `id` vừa ô) trên phạm vi tầng. Ô 'bo' trả lại thì
 * dãy giãn lại đúng chỗ cũ (QT-69); số căn phải tăng, không thì trả lý do.
 */
export function themVaoO(toa: ToaDat, tangs: number[] | null, vt: ViTriCan, id: string, c: Ctx): KetQuaTay {
  let sua = doiCongNang(toa, tangs, [vt.khoa], 'can');
  const k0 = tangs?.[0] ?? null;
  if (id !== canDangDung(vt, boCucTang(sua, k0))) {
    const vts = viTriCan(mauToa(c.tv, sua) as ToaMB, c.tv);
    const v = vts.find((x) => x.khoa === vt.khoa) ?? vt;
    sua = tangs ? doiCanTheoTang(sua, tangs, v, id, vts, false) : doiCanTaiViTri(sua, v, id, vts, false);
  }
  const r = chotSua(toa, sua, tangs ?? [null], c);
  if (!r.ok) return r;
  const soCan = (x: ToaDat) => { const m = mauToa(c.tv, x) as ToaMB; return matBangTang(x, m, c.dl, k0).baoCao?.soCan ?? 0; };
  if (soCan(r.toa) <= soCan(toa)) return { ok: false, lyDo: 'thoat_nan' };
  return r;
}

/**
 * Mẫu căn chọn được khi thêm căn cạnh căn `id` (menu Thêm căn): căn GIỮA cùng nhóm (NOTM / NOXH) và cùng chiều sâu, không gồm biến
 * thể STRETCH. `rong` (mm, chỗ trống cần lấp) thì chỉ mẫu rộng ≤ chỗ + STRETCH co tối đa (QT-81 ±500), vừa nhất trước; không thì theo
 * loại rồi bề ngang.
 */
export function dsMauThem(tv: ThuVien, id: string, rong?: number): CanMau[] {
  const c0 = tv.can.get(id), c = c0?.stretchGoc ? tv.can.get(c0.stretchGoc.id) ?? c0 : c0;
  if (!c) return [];
  const ds = [...tv.can.values()].filter((x) => !x.stretchGoc && !x.id.includes('~') && x.vi_tri === 'giua' && x.nhom === c.nhom && x.sau_mm === c.sau_mm
    && (rong === undefined || x.rong_mm <= rong + CO_TOI_DA_MM));
  return rong === undefined
    ? ds.sort((a, b) => LOAI_CAN.indexOf(a.loai) - LOAI_CAN.indexOf(b.loai) || a.rong_mm - b.rong_mm || a.id.localeCompare(b.id))
    : ds.sort((a, b) => Math.abs(rong - a.rong_mm) - Math.abs(rong - b.rong_mm) || a.id.localeCompare(b.id));
}
/** STRETCH co tối đa một căn (QT-81: bước 100 mm, ±500 mm). */
const CO_TOI_DA_MM = 500;

/** Mẫu căn chèn khi "Thêm căn" sau ô có căn `id`: cùng mẫu gốc (bỏ biến thể STRETCH); căn góc thì lấy căn giữa cùng loại, nhóm, chiều sâu. */
export function mauThem(tv: ThuVien, id: string): string {
  const c0 = tv.can.get(id), c = c0?.stretchGoc ? tv.can.get(c0.stretchGoc.id) ?? c0 : c0;
  if (!c) return id;
  if (c.vi_tri !== 'goc') return c.id;
  const giua = [...tv.can.values()].filter((x) => !x.stretchGoc && x.vi_tri === 'giua' && x.nhom === c.nhom && x.sau_mm === c.sau_mm)
    .sort((a, b) => Number(b.loai === c.loai) - Number(a.loai === c.loai) || a.rong_mm - b.rong_mm || a.id.localeCompare(b.id));
  return giua[0]?.id ?? c.id;
}

// ---------------- thang bộ (mọi tầng — thang liền suốt chiều cao) ----------------

/** Thang đặt tay hiện có; chưa có thì chụp từ mặt bằng đang dùng (giữ phần PC-11 đã làm). */
function thangTayCua(toa: ToaDat, c: Ctx): ThangTay {
  if (toa.thangTay) return { them: toa.thangTay.them.map((e) => ({ ...e })), bo: [...toa.thangTay.bo] };
  const mau = mauToa(c.tv, toa) as ToaMB;
  return chupThangTay(mau, matBangCua(toa, mau, c.dl), c.dl);
}
const soThang = (toa: ToaDat, c: Ctx) => { const mau = mauToa(c.tv, toa) as ToaMB; return matBangCua(toa, mau, c.dl).thangBo.length; };
const coThang = (toa: ToaDat, khoa: string, c: Ctx) => { const mau = mauToa(c.tv, toa) as ToaMB; return matBangCua(toa, mau, c.dl).thangBo.some((t) => t.khoa === khoa); };

/**
 * Thêm thang bộ (p17d · QT-10): ô 3.000 mm chèn ngay sau ô `sau` (căn / thang) trên mặt `mat`. Quy tắc thang bộ mọi tòa: tối đa 3
 * thang (THANG_MAX) — đã đủ 3 thì CHẶN (`nhieu_thang`). Thang mới là N3 trừ khi tòa chưa có N2 (ganLoaiThang).
 */
export function themThangTay(toa: ToaDat, mat: number, sau: string, c: Ctx): KetQuaTay {
  if (soThang(toa, c) >= THANG_MAX) return { ok: false, lyDo: 'nhieu_thang' };
  const tt = thangTayCua(toa, c);
  const dang = new Set([...tt.them.map((e) => e.khoa), ...(matBangCua(toa, mauToa(c.tv, toa) as ToaMB, c.dl).thangBo.map((t) => t.khoa))]);
  let n = 1;
  while (dang.has(`tay${n}`)) n++;
  const khoa = `tay${n}`;
  tt.them.push({ khoa, mat, sau, sx: 1 });
  const r = chotSua(toa, { ...toa, thangTay: tt }, [null], c);
  if (!r.ok) return r;
  if (!coThang(r.toa, khoa, c)) return { ok: false, lyDo: 'khong_dat_thang' };
  return r;
}

/** Xoá thang bộ: giữ ≥ 2 thang (THANG_MIN, như app cũ cảnh báo dưới 2) — còn 2 thì chặn. */
export function xoaThangTay(toa: ToaDat, khoa: string, c: Ctx): KetQuaTay {
  if (soThang(toa, c) <= THANG_MIN) return { ok: false, lyDo: 'it_thang' };
  const tt = thangTayCua(toa, c);
  const e = tt.them.find((x) => x.khoa === khoa);
  tt.them = tt.them.filter((x) => x.khoa !== khoa);
  if (!e || e.tu) if (!tt.bo.includes(khoa)) tt.bo.push(khoa);
  // loại chọn tay của thang bị xoá bỏ theo (thang còn lại vẫn ≥ 1 N2 + ≥ 1 N3 — ganLoaiThang trong tự chỉnh)
  const lt = toa.loaiThang && Object.fromEntries(Object.entries(toa.loaiThang).filter(([k]) => k !== khoa));
  const r = chotSua(toa, { ...toa, thangTay: tt, loaiThang: lt && Object.keys(lt).length ? lt : undefined }, [null], c);
  if (!r.ok) return r;
  if (coThang(r.toa, khoa, c)) return { ok: false, lyDo: 'khong_bo' };
  return r;
}

/**
 * Đổi loại thang bộ N3 ↔ N2 (QT-63 `doiThangBo`): loại của TỪNG ô, ô 3.000 mm và điểm chèn giữ nguyên nên không căn nào xê dịch,
 * DTXD không đổi; hình thang, cửa (buồng đệm N3 / một cửa N2), 3D, CAD đổi theo. Quy tắc mọi tòa: sau khi đổi vẫn phải có ít nhất
 * một N2 và một N3 — đổi thang N2 duy nhất sang N3 thì thang N3 gần nhất (thứ tự mặt, vị trí) đổi sang N2 (đổi chỗ hai loại).
 * Ghi đủ loại mọi thang vào `ToaDat.loaiThang`; mặt bằng đã tự chỉnh chỉ đổi `block` (không chạy lại tự chỉnh — nhanh).
 */
export function doiLoaiThangTay(toa: ToaDat, khoa: string, loai: LoaiThangBo, c: Ctx): KetQuaTay {
  const mau = mauToa(c.tv, toa) as ToaMB | undefined;
  if (!mau || !laLoaiThang(loai)) return { ok: false, lyDo: 'khong_doi' };
  const ds = matBangCua(toa, mau, c.dl).thangBo;
  const t = ds.find((x) => x.khoa === khoa);
  if (!t || t.block === loai) return { ok: false, lyDo: 'khong_doi' };
  const chon: Record<string, string> = Object.fromEntries(ds.map((x) => [x.khoa, laLoaiThang(x.block) ? x.block : THANG_N3]));
  chon[khoa] = loai;
  const khac = loai === THANG_N2 ? THANG_N3 : THANG_N2;
  if (!Object.values(chon).includes(khac)) {
    const thu = [...ds].sort((a, b) => a.matIdx - b.matIdx || a.a0 - b.a0), i0 = thu.indexOf(t);
    const doi = thu.filter((x) => x !== t).sort((a, b) => Math.abs(thu.indexOf(a) - i0) - Math.abs(thu.indexOf(b) - i0))[0];
    if (!doi) return { ok: false, lyDo: 'it_thang' };
    chon[doi.khoa] = khac;
  }
  const sua: ToaDat = { ...toa, loaiThang: chon };
  if (!toa.matBang) return chotSua(toa, sua, [null], c);
  const datLoai = (mb: NonNullable<ToaDat['matBang']>) => ({ ...mb, thangBo: ganLoaiThang(mb.thangBo, chon) });
  const tangRieng = toa.tangRieng && Object.fromEntries(Object.entries(toa.tangRieng).map(([k, g]) => [k, g.matBang ? { ...g, matBang: datLoai(g.matBang) } : g]));
  return { ok: true, toa: { ...sua, matBang: datLoai(toa.matBang), ...(tangRieng ? { tangRieng } : {}) }, chan: [] };
}

/** Dời thang bộ (kéo thang thả lên ô khác): thang đứng ngay sau ô `sau`. */
export function doiThangTay(toa: ToaDat, khoa: string, mat: number, sau: string, c: Ctx): KetQuaTay {
  if (khoa === sau) return { ok: false, lyDo: 'khong_doi' };
  const tt = thangTayCua(toa, c);
  const i = tt.them.findIndex((x) => x.khoa === khoa);
  const cu = i >= 0 ? tt.them[i] : undefined;
  const moi = { khoa, mat, sau, sx: cu?.sx ?? 1, ...(cu?.tu || !cu ? { tu: cu?.tu ?? khoa } : {}) } as const;
  // thang dời áp sau cùng (sau khi các thang khác đã vào chỗ)
  tt.them = [...tt.them.filter((x) => x.khoa !== khoa), moi];
  const truoc = matBangCua(toa, mauToa(c.tv, toa) as ToaMB, c.dl).thangBo.find((t) => t.khoa === khoa);
  const r = chotSua(toa, { ...toa, thangTay: tt }, [null], c);
  if (!r.ok) return r;
  const sauT = matBangCua(r.toa, mauToa(c.tv, r.toa) as ToaMB, c.dl).thangBo.find((t) => t.khoa === khoa);
  if (!sauT || (truoc && Math.abs(sauT.a0 - truoc.a0) < 1 && sauT.matIdx === truoc.matIdx)) return { ok: false, lyDo: 'khong_dat_thang' };
  return r;
}

/** Bỏ thang đặt tay: PC-11 lại tự đặt thang. */
export const thangTuDongLai = (toa: ToaDat, c: Ctx): KetQuaTay =>
  toa.thangTay ? chotSua(toa, { ...toa, thangTay: undefined }, [null], c) : { ok: false, lyDo: 'khong_doi' };
