import { useEffect, useState } from 'preact/hooks';
import type { ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { mauHieuDung, tuChinhSauSua, tuChinhToa, type ChanSua, type DuLieuMB, type HinhLoiMB, type ToaMB } from '../tinh/loiThang';
import { coMat } from '../tinh/matBang';
import { idLoi, tai, taiCuaCan } from '../ve/hinhHocThuVien';
import { mauToa } from '../tinh/canThem';

/**
 * Dữ liệu cho tự chỉnh mặt bằng tầng (tinh/loiThang.ts): hình lõi (nét bao MDI-BAO-TM, tường để đo sảnh) của mọi khối lõi / thang
 * trong thư viện mẫu tòa + tim cửa căn. Tải một lần, nhớ cấp module để hàm thuần dùng đồng bộ.
 */
let dl: DuLieuMB | null = null;
let dangTai: Promise<DuLieuMB> | null = null;
const nghe = new Set<() => void>();

export const layDuLieuMB = (): DuLieuMB | null => dl;

function taiDuLieuMB(tv: ThuVien): Promise<DuLieuMB> {
  if (!dangTai) {
    const khoi = new Set<string>();
    for (const m of tv.toa.values()) if (coMat(m)) for (const f of m.mat) for (const q of f.phan_tu) if (q.loai !== 'can' && q.block) khoi.add(q.block);
    dangTai = Promise.all([
      Promise.all([...khoi].map((b) => tai<HinhLoiMB>(`/lib/loi/${idLoi(b)}.json`).then((j) => [b, j] as const))),
      taiCuaCan(tv, 'tm'),
      taiCuaCan(tv, 'xh'),
    ]).then(([loi, a, b]) => {
      dl = { loi: new Map(loi.filter((x): x is readonly [string, HinhLoiMB] => !!x[1])), cuaCan: { ...a, ...b } };
      nghe.forEach((f) => f());
      return dl;
    });
  }
  return dangTai;
}

/** Hook: tải dữ liệu (một lần) và vẽ lại khi xong. */
export function useDuLieuMB(tv: ThuVien | null): DuLieuMB | null {
  const [, ve] = useState(0);
  useEffect(() => {
    const f = () => ve((n) => n + 1);
    nghe.add(f);
    if (tv && !dl) void taiDuLieuMB(tv);
    return () => void nghe.delete(f);
  }, [tv]);
  return dl;
}

/** Mẫu tòa hiệu dụng của tòa (mặt bằng đã tự chỉnh / mặc định của mẫu); `tang` = tầng có bố cục riêng thì theo mặt bằng của tầng đó. */
export const mauCuaToa = <T extends ToaMB>(toa: ToaDat, mau: T, tang?: number | null): T => mauHieuDung(toa, mau, dl, tang);

/**
 * Bọc `sua` của màn Tầng: sau phép sửa (đổi căn, STRETCH, tối ưu) chạy lại tự chỉnh mặt bằng của tòa `toaId` trong CÙNG một bước
 * sửa — hoàn tác một lần là về trước cả phép sửa lẫn phần tự chỉnh. Chưa tải xong dữ liệu thì vẫn sửa, chưa tự chỉnh.
 * `tay` (mặc định): phép sửa người dùng chọn tay — căn vừa chọn không bị tự đổi loại; không vừa ô thì chặn ô đó (giữ căn cũ) và
 * gọi `baoChan`. Bộ tối ưu tự động / về mẫu gốc truyền `tay: false` (khít vẫn được đổi loại).
 */
export const suaTuChinh = (sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void, tv: ThuVien, toaId: string,
  tuy: { tay?: boolean; baoChan?: (ds: ChanSua[]) => void } = {}) =>
  (fn: (p: TrangThaiPA) => TrangThaiPA) => {
    let chan: ChanSua[] = [];
    sua((q) => {
      const p = fn(q);
      chan = [];
      return { ...p, toa: p.toa.map((x) => {
        if (x.id !== toaId || !dl) return x;
        const mau = mauToa(tv, x) as ToaMB | undefined;
        if (tuy.tay === false) return tuChinhToa(x, mau, tv, dl);
        const truoc = q.toa.find((o) => o.id === toaId);
        if (!truoc) return tuChinhToa(x, mau, tv, dl);
        const r = tuChinhSauSua(truoc, x, mau, tv, dl);
        chan = r.chan;
        return r.toa;
      }) };
    });
    if (chan.length) tuy.baoChan?.(chan);
  };
