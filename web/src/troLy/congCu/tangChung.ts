/**
 * Mặt bằng một tầng của một tòa cho công cụ Leo AI — đúng cách màn Tầng dựng (`toaDangXem` → `mauHieuDung`, `boCucTang`,
 * `soLieuTang`): ô căn đánh số CH-xx theo chu vi như bản vẽ, khoá ô "mặt:phần tử", thang bộ theo khoá trên mặt bằng hiệu dụng.
 */
import { mauToa } from '../../tinh/canThem';
import type { LoaiCan, ThuVien, ToaDat, TrangThaiPA } from '../../tinh/kieu';
import { mauHieuDung, THANG_N2, tuChinhSauSua, tuChinhToa, type ChanSua, type DuLieuMB, type ToaMB } from '../../tinh/loiThang';
import { boCucTang, type ViTriCan } from '../../tinh/matBang';
import { soLieuTang, type ToaVe } from '../../ve/MatBangTang';
import { LoiCongCu, tron } from './nguCanh';

export const tenCH = (so: number) => `CH-${String(so).padStart(2, '0')}`;

export type OTang = { vt: ViTriCan; canId: string; no: number; cn: string };

export function dungTang(tv: ThuVien, dl: DuLieuMB | null, toa: ToaDat, k: number | null) {
  const goc = mauToa(tv, toa) as ToaMB | undefined;
  if (!goc || !('mat' in goc)) throw new LoiCongCu(`Mẫu tòa "${toa.mauId}" không có mặt bằng tầng.`);
  const mau = mauHieuDung(toa, goc, dl, k) as ToaMB & ToaVe;
  const bc = boCucTang(toa, k);
  const sl = soLieuTang(mau, bc, tv);
  const thang = mau.mat.flatMap((m, mi) => m.phan_tu.map((q, i) => ({ q, mi, i })).filter((x) => x.q.loai === 'thang_bo')
    .map(({ q, mi: m2, i }) => ({ khoa: (q as { khoa?: string }).khoa ?? `${m2}:t${i}`, matIdx: m2, loai: q.block === THANG_N2 ? 'N2' : 'N3' })));
  return { goc, mau, bc, sl, thang };
}

/** Kiểm số tầng điển hình (1..soTangDH); trả mảng tầng hoặc null (mặt bằng điển hình chung). */
export function tangHopLe(toa: ToaDat, tangs: unknown): number[] | null {
  if (tangs === undefined || tangs === null) return null;
  const ds = (Array.isArray(tangs) ? tangs : [tangs]) as number[];
  if (!ds.length) return null;
  for (const k of ds) if (!Number.isInteger(k) || k < 1 || k > toa.soTangDH)
    throw new LoiCongCu(`Tầng ${k} không hợp lệ: tòa có ${toa.soTangDH} tầng điển hình (1..${toa.soTangDH}; tầng thật = ${toa.soTangDe} + số này). Bỏ trống = mặt bằng điển hình chung.`);
  return [...new Set(ds)].sort((a, b) => a - b);
}

/** Tìm ô theo khoá "mặt:phần tử" hoặc nhãn "CH-05" / "5". */
export function timO(can: OTang[], ref: string): OTang {
  const r = String(ref).trim();
  const so = /^(?:CH-?)?0*(\d+)$/i.exec(r);
  const o = can.find((c) => c.vt.khoa === r) ?? (so ? can.find((c) => c.no === Number(so[1])) : undefined);
  if (!o) throw new LoiCongCu(`Không có ô "${ref}" trên tầng này. Dùng get_floor_plan để xem khoá ô (key) hoặc nhãn CH-xx.`);
  return o;
}

/** Tóm tắt một tầng: số căn theo loại, danh sách ô (gọn). */
export function tomTatTang(tv: ThuVien, dl: DuLieuMB | null, toa: ToaDat, k: number | null, chiTiet = true) {
  const { sl, thang } = dungTang(tv, dl, toa, k);
  const dem: Partial<Record<LoaiCan, number>> = {};
  let dtTT = 0;
  for (const c of sl.can) if (c.cn === 'can') { const m = tv.can.get(c.canId); if (m) { dem[m.loai] = (dem[m.loai] ?? 0) + 1; dtTT += m.dt_tt_m2; } }
  const soCan = Object.values(dem).reduce((s, x) => s + (x ?? 0), 0);
  return {
    tang: k ?? 'dien_hinh',
    so_can: soCan,
    theo_loai: dem,
    dt_thong_thuy_m2: tron(dtTT, 1),
    thang_bo: thang.map((x) => ({ key: x.khoa, loai: x.loai })),
    ...(chiTiet ? {
      o: sl.can.map((c) => {
        const m = tv.can.get(c.canId);
        return { ch: tenCH(c.no), key: c.vt.khoa, unit_id: c.canId, loai: m?.loai ?? null, dt: tron(m?.dt_tt_m2, 1), rong_mm: m?.rong_mm ?? null, cong_nang: c.cn, mat: c.vt.matIdx };
      }),
    } : {}),
  };
}

/**
 * `suaTuChinh` (man/tuChinhTang.ts) với `dl` truyền vào: sửa rồi tự chỉnh mặt bằng tòa (XC-03…PC-11) như giao diện;
 * `tay` = căn người dùng vừa chọn không bị tự đổi loại (không vừa thì chặn, giữ căn cũ, báo `chan`).
 */
export function suaTuChinhVoi(q: TrangThaiPA, tv: ThuVien, dl: DuLieuMB | null, toaId: string, fn: (p: TrangThaiPA) => TrangThaiPA, tay = true): { pa: TrangThaiPA; chan: ChanSua[] } {
  const p = fn(q);
  let chan: ChanSua[] = [];
  const pa = { ...p, toa: p.toa.map((x) => {
    if (x.id !== toaId || !dl) return x;
    const mau = mauToa(tv, x) as ToaMB | undefined;
    if (!tay) return tuChinhToa(x, mau, tv, dl);
    const truoc = q.toa.find((o) => o.id === toaId);
    if (!truoc) return tuChinhToa(x, mau, tv, dl);
    const r = tuChinhSauSua(truoc, x, mau, tv, dl);
    chan = r.chan;
    return r.toa;
  }) };
  return { pa, chan };
}

export const doiToa = (p: TrangThaiPA, id: string, fn: (x: ToaDat) => ToaDat): TrangThaiPA => ({ ...p, toa: p.toa.map((x) => (x.id === id ? fn(x) : x)) });
