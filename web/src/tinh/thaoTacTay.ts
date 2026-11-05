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
import { dsLoi, mauHieuDung, apMatBang, chupThangTay, deKhung, doDeKhe, ganLoaiThang, HL_TAY, laLoaiThang, matBangCua, matBangTang, THANG_MAX, THANG_MIN, THANG_N2, THANG_N3, tuChinhSauSua, tuChinhToa, type ChanSua, type DuLieuMB, type LoaiThangBo, type ToaMB } from './loiThang';
import { boCucTang, canDangDung, congNangTai, tangCoRieng, viTriCan, type ViTriCan } from './matBang';
import { duocDatVaoO, idMauGoc, nhomViTri } from './quyTacViTriCan';
import { stretchTay } from './stretch';
import { loiThayDuoc, lyDoKhongThay, thayLoiMau, ungVienLoiThay } from './thayLoi';

export type LyDoTay = 'de' | 'khe' | 'khong_bo' | 'khong_vua' | 'it_thang' | 'nhieu_thang' | 'khong_dat_thang' | 'khong_dau_tu_do' | 'khong_doi' | 'thoat_nan' | 'sai_vi_tri' | 'khong_thay_loi' | 'thieu_hinh_loi';
export type KetQuaTay = { ok: true; toa: ToaDat; chan: ChanSua[]; canhBao?: 'nhieu_thang' | 'it_thang' } | { ok: false; lyDo: LyDoTay; chiTiet?: string };

export type Ctx = { tv: ThuVien; dl: DuLieuMB | null | undefined };

/** Đè / khe của tầng `tang` sau tự chỉnh (tinh/khe.ts) + số cặp đè của căn góc V theo hình bao thật. */
function doTang(toa: ToaDat, tang: number | null, { tv, dl }: Ctx) {
  const mau = mauToa(tv, toa) as ToaMB | undefined;
  if (!mau) return { de: 0, mm: 0, san: 0, khung: 0 };
  const mb = matBangTang(toa, mau, dl, tang), bc = boCucTang(toa, tang);
  return { ...doDeKhe(mau, mb, dl, tv, bc), khung: deKhung(mau, mb, dl, tv, bc) };
}

/**
 * Độ dời đầu hành lang kéo tay đang CÓ HIỆU LỰC (mm): `hanhLangTay` lưu số người dùng kéo, nhưng tự chỉnh cắt về giới hạn (không ngắn quá
 * cửa căn xa nhất + 500 mm, đoạn ≥ 3 m, dài thêm ≤ 20 m) — kéo quá giới hạn thì số lưu (−20 m) lớn hơn hiệu lực, các lần kéo sau theo số
 * lưu nên "không kéo được". Đo hiệu lực bằng hai mặt bằng có / không có hành lang tay.
 */
export function hlHieuDung(toa: ToaDat, c: Ctx): Record<string, [number, number]> | undefined {
  const tay = toa.hanhLangTay;
  const mau = tay ? mauToa(c.tv, toa) as ToaMB | undefined : undefined;
  if (!tay || !mau) return tay;
  const A = matBangTang(toa, mau, c.dl, null), B = matBangTang(tuChinhToa({ ...toa, hanhLangTay: undefined, matBang: undefined } as ToaDat, mau, c.tv, c.dl), mau, c.dl, null); // mặt bằng lưu sẵn (`matBang`) đã gồm hành lang tay → dựng lại không có
  const lam = (x: number) => (Math.abs(x) < 50 ? 0 : Math.round(x / HL_TAY.buoc) * HL_TAY.buoc);
  const ra: Record<string, [number, number]> = {};
  for (const [k, dd] of Object.entries(tay)) {
    const i = Number(k), sA = A.hanhLang[i], sB = B.hanhLang[i];
    if (!sA || !sB) { ra[k] = dd; continue; }
    const L = Math.hypot(sA.p1[0] - sA.p0[0], sA.p1[1] - sA.p0[1]) || 1, u = [(sA.p1[0] - sA.p0[0]) / L, (sA.p1[1] - sA.p0[1]) / L];
    const e0 = lam((sB.p0[0] - sA.p0[0]) * u[0] + (sB.p0[1] - sA.p0[1]) * u[1]), e1 = lam((sA.p1[0] - sB.p1[0]) * u[0] + (sA.p1[1] - sB.p1[1]) * u[1]);
    if (e0 || e1) ra[k] = [e0, e1];
  }
  return Object.keys(ra).length ? ra : undefined;
}
/** `hanhLangTay` về đúng độ dời có hiệu lực (xem hlHieuDung); không đổi gì nếu đã khớp. */
function chuanHoaHLTay(toa: ToaDat, c: Ctx): ToaDat {
  if (!toa.hanhLangTay) return toa;
  const hd = hlHieuDung(toa, c), cu = toa.hanhLangTay;
  const khop = hd && Object.keys(hd).length === Object.keys(cu).length && Object.entries(hd).every(([k, v]) => cu[k] && Math.abs(cu[k][0] - v[0]) < 50 && Math.abs(cu[k][1] - v[1]) < 50);
  return khop || (!hd && !Object.keys(cu).length) ? toa : { ...toa, hanhLangTay: hd };
}

/** Chạy tự chỉnh sau phép sửa tay `sau` rồi kiểm không đè / khe mới trên các tầng `ks`. */
function chotSua(truoc: ToaDat, sau0: ToaDat, ks: (number | null)[], c: Ctx, thangTuDat = false): KetQuaTay {
  const mau = mauToa(c.tv, sau0) as ToaMB | undefined;
  // sửa tay KHÔNG tự dời / thêm / bớt thang (app cũ: thang là một ô trong dãy, chỉ người dùng dời): chưa có thang tay thì chụp tập
  // thang đang có → PC-11 chạy `coDinh`. Thang về tự động chỉ khi người dùng bấm ⟲ (thangTuDongLai bỏ `thangTay`).
  const sau = sau0.thangTay || !mau || thangTuDat ? sau0 : { ...sau0, thangTay: thangTayCua(truoc, c) };
  const r = tuChinhSauSua(truoc, sau, mau, c.tv, c.dl);
  for (const k of ks) {
    const a = doTang(truoc, k, c), b = doTang(r.toa, k, c);
    // căn góc V đè ô khác theo hình bao thật (đổi chỗ / lật căn V sang chỗ không phải góc) cũng là đè
    if (b.de > a.de || b.khung > a.khung) return { ok: false, lyDo: 'de' };
    if (b.mm > a.mm + 200 || b.san > a.san) return { ok: false, lyDo: 'khe', chiTiet: String(Math.round(b.mm - a.mm)) };
  }
  return { ok: true, toa: chuanHoaHLTay(r.toa, c), chan: r.chan };
}

// ---------------- căn ----------------

/** Đổi chỗ hai ô (kéo căn sang ô khác — QT-8 · QT-30): mẫu căn, công năng, lật đổi cho nhau; dãy dồn khít lại. */
export function doiChoTay(toa: ToaDat, tangs: number[] | null, a: ViTriCan, b: ViTriCan, c: Ctx): KetQuaTay {
  if (a.khoa === b.khoa) return { ok: false, lyDo: 'khong_doi' };
  // quy tắc vị trí căn: căn góc chỉ sang ô góc, căn giữa chỉ sang ô giữa, căn V / Y không rời chỗ (tinh/quyTacViTriCan.ts)
  for (const k of tangs ?? [null]) {
    const bc = boCucTang(toa, k);
    if (congNangTai(a.khoa, bc) === 'can' && !duocDatVaoO(b.canGocId, canDangDung(a, bc))) return { ok: false, lyDo: 'sai_vi_tri' };
    if (congNangTai(b.khoa, bc) === 'can' && !duocDatVaoO(a.canGocId, canDangDung(b, bc))) return { ok: false, lyDo: 'sai_vi_tri' };
  }
  const r = chotSua(toa, doiChoO(toa, tangs, a, b), tangs ?? [null], c);
  if (!r.ok) return r;
  // đổi chỗ là MỘT phép: căn vừa chọn không vừa ô bên kia (dãy kẹp — tự chỉnh chặn, giữ căn cũ ở ô đó) thì không nhận nửa vời
  // (một bên đổi, một bên giữ = thành đổi mẫu căn, cơ cấu lệch)
  const goc = (id: string) => c.tv.can.get(id)?.stretchGoc?.id ?? id;
  for (const k of tangs ?? [null]) {
    const bc0 = boCucTang(toa, k), bc1 = boCucTang(r.toa, k);
    if (goc(canDangDung(a, bc1)) !== goc(canDangDung(b, bc0)) || goc(canDangDung(b, bc1)) !== goc(canDangDung(a, bc0))) return { ok: false, lyDo: 'khong_vua' };
    // tự chỉnh khít không được đổi mẫu căn của ô THỨ BA (1PN ↔ STU khác bề ngang → căn bên cạnh bị biến thành STU)
    const mauSau = mauToa(c.tv, r.toa) as ToaMB | undefined, mauTruoc = mauToa(c.tv, toa) as ToaMB | undefined;
    if (mauSau && mauTruoc) {
      const v0 = viTriCan(apMatBang(mauTruoc, matBangTang(toa, mauTruoc, c.dl, k), c.dl), c.tv, bc0);
      const v1 = new Map(viTriCan(apMatBang(mauSau, matBangTang(r.toa, mauSau, c.dl, k), c.dl), c.tv, bc1).map((v) => [v.khoa, v]));
      for (const v of v0) if (v.khoa !== a.khoa && v.khoa !== b.khoa && v1.has(v.khoa) && goc(canDangDung(v1.get(v.khoa)!, bc1)) !== goc(canDangDung(v, bc0))) return { ok: false, lyDo: 'khong_vua' };
    }
  }
  return r;
}

/**
 * Chuyển căn `a` sang DÃY KHÁC (mặt khác của tòa): chèn cùng mẫu căn ngay sau ô `b` (hoặc ngay TRƯỚC khi `truoc`) rồi bỏ ô `a` —
 * dãy đích dài ra, dãy gốc ngắn lại ở đầu tự do (QT-69), mỗi dãy dồn khít (XC-04). Khác `doiChoTay` (hai ô đổi cho nhau, số căn mỗi dãy
 * giữ nguyên). Căn góc chuyển đi thành căn giữa cùng nhóm (mauThem); dãy đích không còn đầu tự do thì trả lý do, không đổi gì.
 */
export function chuyenCanTay(toa: ToaDat, tangs: number[] | null, a: ViTriCan, b: ViTriCan, truoc: boolean, c: Ctx): KetQuaTay {
  if (a.matIdx === b.matIdx) return { ok: false, lyDo: 'khong_doi' };
  const bc = boCucTang(toa, tangs?.[0] ?? null);
  if (congNangTai(a.khoa, bc) !== 'can') return { ok: false, lyDo: 'khong_doi' };
  const them = themCanTay(toa, tangs, b, mauThem(c.tv, canDangDung(a, bc)), c, truoc);
  if (!them.ok) return them;
  return xoaCanTay(them.toa, tangs, [a.khoa], c);
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
  if (nhomViTri(id) !== 'giua') return { ok: false, lyDo: 'sai_vi_tri' }; // căn thêm là căn giữa, không thêm căn góc / V / Y
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
  if (!duocDatVaoO(vt.canGocId, id)) return { ok: false, lyDo: 'sai_vi_tri' };
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
 * `choO` = mẫu GỐC của chính ô cần đặt lại (chỗ loại 'o'): đặt lại đúng quy tắc vị trí của ô đó — ô góc nhận căn góc thường, ô V / Y chỉ
 * nhận lại chính mẫu đó (tinh/quyTacViTriCan.ts); không có `choO` (chèn thêm) thì chỉ căn giữa.
 */
export function dsMauThem(tv: ThuVien, id: string, rong?: number, choO?: string): CanMau[] {
  const c0 = tv.can.get(id), c = c0?.stretchGoc ? tv.can.get(c0.stretchGoc.id) ?? c0 : c0;
  if (!c) return [];
  const hopO = (x: CanMau) => (choO === undefined ? x.vi_tri === 'giua' : duocDatVaoO(choO, x.id) && (nhomViTri(choO) !== 'khoa' || idMauGoc(x.id) === idMauGoc(choO)));
  const ds = [...tv.can.values()].filter((x) => !x.stretchGoc && !x.id.includes('~') && hopO(x) && x.nhom === c.nhom && x.sau_mm === c.sau_mm
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

/**
 * Lật gương thang bộ (⇄): giữ nguyên ô 3.000 mm và chỗ đứng, đảo hướng `sx` — cửa / buồng đệm và chiều vế thang đổi sang bên kia.
 * Chụp tập thang thành thang đặt tay (như dời / xoá) rồi đổi `sx` của thang đó; mọi tầng đổi theo (thang liền suốt chiều cao).
 */
export function latThangTay(toa: ToaDat, khoa: string, c: Ctx): KetQuaTay {
  const mau = mauToa(c.tv, toa) as ToaMB;
  const t = matBangCua(toa, mau, c.dl).thangBo.find((x) => x.khoa === khoa);
  if (!t) return { ok: false, lyDo: 'khong_doi' };
  const tt = thangTayCua(toa, c);
  const e = tt.them.find((x) => x.khoa === khoa);
  if (!e) return { ok: false, lyDo: 'khong_doi' };
  e.sx = t.sx === 1 ? -1 : 1;
  const r = chotSua(toa, { ...toa, thangTay: tt }, [null], c);
  if (!r.ok) return r;
  const sau = matBangCua(r.toa, mauToa(c.tv, r.toa) as ToaMB, c.dl).thangBo.find((x) => x.khoa === khoa);
  if (!sau) return { ok: false, lyDo: 'khong_dat_thang' };
  if (sau.sx === t.sx) return { ok: false, lyDo: 'khong_doi' };
  return r;
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
  if (!sauT) return { ok: false, lyDo: 'khong_dat_thang' };
  // thả ngay chỗ cũ (sau đúng ô đứng trước nó): không có gì đổi — không báo "không đặt được"
  if (truoc && Math.abs(sauT.a0 - truoc.a0) < 1 && sauT.matIdx === truoc.matIdx) return { ok: false, lyDo: 'khong_doi' };
  return r;
}

/** Bỏ thang đặt tay: PC-11 lại tự đặt thang (dò lại từ đầu — bỏ cả tập thang giữ từ lần tự chỉnh trước). */
export const thangTuDongLai = (toa: ToaDat, c: Ctx): KetQuaTay => {
  if (!toa.thangTay) return { ok: false, lyDo: 'khong_doi' };
  const tangRieng = toa.tangRieng && Object.fromEntries(Object.entries(toa.tangRieng).map(([k, g]) => { const { matBang: _b, ...con } = g; void _b; return [k, con]; }));
  return chotSua(toa, { ...toa, thangTay: undefined, matBang: undefined, ...(tangRieng ? { tangRieng } : {}) }, [null], c, true);
};

// ---------------- đầu hành lang (app cũ p14 · QT-38 · QT-55: co kéo đầu hành lang) ----------------

/** Bắt dời đầu hành lang: bước 100 mm, hít về vị trí tự động (0) trong 400 mm (app cũ: bước 50 mm, nam châm 400 mm). */
export const batHanhLang = (d: number): number => (Math.abs(d) < HL_TAY.namCham ? 0 : Math.round(d / HL_TAY.buoc) * HL_TAY.buoc);

/**
 * Kéo đầu `dau` (0 = p0, 1 = p1) của đoạn hành lang `i` dài ra (d > 0) / ngắn lại (d < 0) so với vị trí tự động. Nét bao + DTXD + cự
 * ly thoát nạn tính lại; giới hạn như app cũ (không ngắn quá cửa căn xa nhất + 500 mm, đoạn ≥ 3 m, dài thêm ≤ 20 m). Căn không xê
 * dịch (app cũ: chỉ hành lang và nét bao đổi). d = 0 ở cả hai đầu → hành lang đoạn đó về tự động.
 */
export function keoHanhLangTay(toa: ToaDat, i: number, dau: 0 | 1, d: number, c: Ctx): KetQuaTay {
  const cu = toa.hanhLangTay?.[String(i)] ?? [0, 0];
  const moi: [number, number] = dau ? [cu[0], batHanhLang(d)] : [batHanhLang(d), cu[1]];
  if (moi[0] === cu[0] && moi[1] === cu[1]) return { ok: false, lyDo: 'khong_doi' };
  const tay = { ...(toa.hanhLangTay ?? {}) };
  if (moi[0] || moi[1]) tay[String(i)] = moi; else delete tay[String(i)];
  return chotSua(toa, { ...toa, hanhLangTay: Object.keys(tay).length ? tay : undefined }, [null], c);
}

/** Bỏ mọi đầu hành lang kéo tay (app cũ "↺ Hành lang tự động"). */
export function hanhLangTuDong(toa: ToaDat, c: Ctx): KetQuaTay {
  if (!toa.hanhLangTay) return { ok: false, lyDo: 'khong_doi' };
  return chotSua(toa, { ...toa, hanhLangTay: undefined }, [null], c);
}

// ---------------- thay lõi thang máy ----------------

/** Mặt bằng đã lưu của tòa bỏ đi (chung + từng tầng riêng): lõi đổi thì tự chỉnh dựng lại từ mẫu tòa mang lõi mới. */
const boMatBangLuu = (t: ToaDat): ToaDat => ({
  ...t, matBang: undefined, duongBao: undefined, dtxdM2: undefined,
  ...(t.tangRieng ? { tangRieng: Object.fromEntries(Object.entries(t.tangRieng).map(([k, g]) => { const { matBang: _b, ...r } = g; void _b; return [k, r]; })) } : {}),
});

/** Khối lõi của lõi `khoa` (khoá theo mẫu thư viện) đang dùng trong tòa. */
export function loiDangDung(toa: ToaDat, c: Ctx, khoa: string): string | null {
  const goc = c.tv.toa.get(toa.mauId);
  const m = goc && (thayLoiMau(goc, toa.loiThay) as unknown as ToaMB);
  const q = m && m.mat?.[Number(khoa.split(':')[0])]?.phan_tu[Number(khoa.split(':')[1])];
  return q?.loai === 'loi' ? q.block : null;
}

/** Các lõi (khoá theo mẫu thư viện) của tòa và khối đang dùng. */
export function dsLoiToa(toa: ToaDat, c: Ctx): { khoa: string; block: string; matIdx: number }[] {
  const goc = c.tv.toa.get(toa.mauId) as ToaMB | undefined;
  if (!goc || !Array.isArray(goc.mat)) return [];
  const m = thayLoiMau(goc, toa.loiThay) as unknown as ToaMB;
  return dsLoi(goc).map((l) => ({ khoa: l.khoa, matIdx: l.matIdx, block: loiDangDung(toa, c, l.khoa) ?? m.mat[l.matIdx].phan_tu[Number(l.khoa.split(':')[1])].block }));
}

/**
 * Thay lõi thang máy `khoa` bằng khối `block` (app cũ QT-71 · QT-72 · QT-74): cùng dạng, cùng loại hình, tòa mẫu riêng chỉ lõi cùng
 * mẫu. Thử lần lượt các độ dời điểm chèn (sát hành lang / tâm / hai mép), nhận độ dời đầu tiên mà tự chỉnh khít được (không đè, không
 * khe mới) — căn dồn vào lõi mới, dãy dài ra / ngắn lại ở đầu tự do, nét bao + DTXD theo, nét hành lang qua tim sảnh lõi mới.
 */
export function thayLoiTay(toa: ToaDat, khoa: string, block: string, c: Ctx): KetQuaTay {
  const goc = c.tv.toa.get(toa.mauId) as ToaMB | undefined, dl = c.dl;
  if (!goc || !Array.isArray(goc.mat)) return { ok: false, lyDo: 'khong_doi' };
  if (!dl) return { ok: false, lyDo: 'thieu_hinh_loi' };
  // luôn tính từ lõi của BẢN VẼ mẫu (khoá lõi theo mẫu thư viện): đổi sang lõi khác nữa thì thay thế lần trước, về lõi bản vẽ thì bỏ thay
  const l = dsLoi(goc).find((x) => x.khoa === khoa);
  if (!l) return { ok: false, lyDo: 'khong_doi' };
  if (l.q.block === block) return huyThayLoiTay(toa, khoa, c);
  if (toa.loiThay?.[khoa]?.block === block) return { ok: false, lyDo: 'khong_doi' };
  const f = goc.mat[l.matIdx], ly = lyDoKhongThay(goc, l.q.block, block, l.q, f.goc_deg, f.truc_mm, dl);
  if (ly === 'thieu_hinh') return { ok: false, lyDo: 'thieu_hinh_loi', chiTiet: block };
  if (ly) return { ok: false, lyDo: 'khong_thay_loi', chiTiet: ly };
  const ks: (number | null)[] = [null, ...tangCoRieng(toa)];
  let loi: KetQuaTay = { ok: false, lyDo: 'de' };
  for (const uv of ungVienLoiThay(goc, khoa, block, dl)) {
    const r = chotSua(toa, boMatBangLuu({ ...toa, loiThay: { ...(toa.loiThay ?? {}), [khoa]: uv } }), ks, c, true);
    if (r.ok) return r;
    loi = r;
  }
  return loi;
}

/** Trả lõi `khoa` về lõi của bản vẽ mẫu (bỏ thay). */
export function huyThayLoiTay(toa: ToaDat, khoa: string, c: Ctx): KetQuaTay {
  if (!toa.loiThay?.[khoa]) return { ok: false, lyDo: 'khong_doi' };
  const { [khoa]: _bo, ...con } = toa.loiThay;
  void _bo;
  return chotSua(toa, boMatBangLuu({ ...toa, loiThay: Object.keys(con).length ? con : undefined }), [null, ...tangCoRieng(toa)], c, true);
}

/** Khối lõi thay được cho lõi `khoa` của tòa (theo lõi đang dùng), không gồm khối đang dùng. */
export function loiThayDuocToa(toa: ToaDat, c: Ctx, khoa: string): string[] {
  const goc = c.tv.toa.get(toa.mauId);
  if (!goc || !c.dl || !Array.isArray((goc as ToaMB).mat)) return [];
  const hienTai = thayLoiMau(goc, toa.loiThay) as unknown as ToaMB, dang = dsLoi(hienTai).find((x) => x.khoa === khoa)?.q.block;
  // theo lõi của bản vẽ mẫu (thư viện), bỏ khối đang dùng; khối của bản vẽ thì là "trả về" (huyThayLoiTay)
  return loiThayDuoc(c.tv, goc, khoa, c.dl).filter((b) => b !== dang);
}

// ---------------- STRETCH tay ----------------

/**
 * STRETCH tay một căn (app cũ QT-81): kéo `khoa` thêm `d` mm (±ST_BUOC, tổng ≤ ±ST_MAX) — căn kề cùng đoạn bù ngược, không có căn bù
 * thì dãy dài ra / ngắn lại ở đầu tự do (QT-69). Cùng đường với công cụ Leo AI `stretch_cell`; chạy tự chỉnh + kiểm không đè / khe mới.
 */
export function stretchCanTay(toa: ToaDat, khoa: string, d: number, c: Ctx): KetQuaTay {
  const goc = mauToa(c.tv, toa) as ToaMB | undefined;
  if (!goc || !Array.isArray(goc.mat)) return { ok: false, lyDo: 'khong_doi' };
  const mau = mauHieuDung(toa, goc, c.dl, null), bc = boCucTang(toa, null);
  const r = stretchTay(mau, bc, c.tv, khoa, d, { choDaiRa: true });
  if (!r.ok) return { ok: false, lyDo: 'khong_doi', chiTiet: r.lyDo };
  const vts = viTriCan(mau, c.tv, bc);
  let sau = toa;
  for (const [kh, id] of r.doi) {
    const vt = vts.find((x) => x.khoa === kh);
    if (vt) sau = doiCanTaiViTri(sau, vt, id, vts, false);
  }
  return chotSua(toa, sau, [null], c);
}
