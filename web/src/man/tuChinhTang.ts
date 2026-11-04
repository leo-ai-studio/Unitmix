import { useEffect, useState } from 'preact/hooks';
import type { ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { mauHieuDung, THANG_KHOI, THANG_N2, tuChinhSauSua, tuChinhToa, type ChanSua, type DuLieuMB, type HinhLoiMB, type ToaMB } from '../tinh/loiThang';
import { coMat } from '../tinh/matBang';
import { idLoi, tai, taiCuaCan } from '../ve/hinhHocThuVien';
import { mauToa } from '../tinh/canThem';
import { khoiLoiThuVien } from '../tinh/thayLoi';

/**
 * Dữ liệu cho tự chỉnh mặt bằng tầng (tinh/loiThang.ts): hình lõi (nét bao MDI-BAO-TM, tường để đo sảnh) của các khối lõi / thang
 * mà các tòa TRONG PA dùng + tim cửa căn (`cua_x` tiền tính trong can.json). Tải dần theo khối thực dùng (de_xuat_hieu_nang P3),
 * nhớ cấp module để hàm thuần dùng đồng bộ. Đang tải thêm khối thì `layDuLieuMB` trả null (sửa vẫn được, chưa tự chỉnh).
 */
let dl: DuLieuMB | null = null;
let choTai = 0;
const daHoi = new Set<string>();
const nghe = new Set<() => void>();

export const layDuLieuMB = (): DuLieuMB | null => (choTai ? null : dl);

/** Tên khối lõi / thang các tòa của PA cần: khối trên mặt mẫu tòa, thang thêm tay (THANG_KHOI) + N2 (quy tắc luôn có một N2) và khối ghi trong mặt bằng đã sửa. */
export function khoiCuaPA(pa: TrangThaiPA, tv: ThuVien): string[] {
  const khoi = new Set<string>([THANG_KHOI, THANG_N2]);
  for (const t of pa.toa) {
    const m = tv.toa.get(t.mauId);
    if (m && coMat(m)) for (const f of m.mat) for (const q of f.phan_tu) if (q.loai !== 'can' && q.block) khoi.add(q.block);
    if (t.matBang) for (const x of JSON.stringify(t.matBang).matchAll(/"block":"([^"]+)"/g)) khoi.add(x[1]);
  }
  return [...khoi].sort();
}

function napChoPA(khoi: string[], tv: ThuVien): void {
  const moi = khoi.filter((b) => !daHoi.has(b));
  if (!moi.length && (dl || choTai)) return;
  moi.forEach((b) => daHoi.add(b));
  choTai++;
  void Promise.all([
    Promise.all(moi.map((b) => tai<HinhLoiMB>(`/lib/loi/${idLoi(b)}.json`).then((j) => [b, j] as const))),
    dl ? dl.cuaCan : Promise.all([taiCuaCan(tv, 'tm'), taiCuaCan(tv, 'xh')]).then(([a, b]) => ({ ...a, ...b })),
  ]).then(([loi, cuaCan]) => {
    const m = new Map(dl?.loi ?? []);
    for (const [b, j] of loi) if (j) m.set(b, j);
    dl = { loi: m, cuaCan };
    choTai--;
    nghe.forEach((f) => f());
  });
}

/** Nạp hình MỌI khối lõi của thư viện (để liệt kê lõi thay được — khối lõi khác không có trong PA); gọi lúc rảnh, tải một lần. */
export function napLoiThayDuoc(tv: ThuVien): void { napChoPA(khoiLoiThuVien(tv), tv); }

/** Chờ dữ liệu tự chỉnh đủ cho các khối PA `pa` dùng (trợ lý Leo AI gọi trước phép tay; giao diện dùng `useDuLieuMB`). */
export function choDuLieuMB(pa: TrangThaiPA, tv: ThuVien): Promise<DuLieuMB> {
  napChoPA(khoiCuaPA(pa, tv), tv);
  return new Promise((xong) => {
    const thu = () => { const d = layDuLieuMB(); if (d) { nghe.delete(thu); xong(d); return true; } return false; };
    if (!thu()) nghe.add(thu);
  });
}

/** Hook: tải dữ liệu (lõi theo PA `pa`) và vẽ lại khi xong. Không truyền `pa` thì chỉ nghe (nơi khác đã tải). */
export function useDuLieuMB(tv: ThuVien | null, pa?: TrangThaiPA): DuLieuMB | null {
  const [, ve] = useState(0);
  const khoa = tv && pa ? khoiCuaPA(pa, tv).join() : '';
  useEffect(() => {
    const f = () => ve((n) => n + 1);
    nghe.add(f);
    return () => void nghe.delete(f);
  }, []);
  useEffect(() => {
    if (tv && khoa) napChoPA(khoa.split(','), tv);
  }, [tv, khoa]);
  return layDuLieuMB();
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
  tuy: { tay?: boolean; baoChan?: (ds: ChanSua[]) => void; /** Tòa sau tự chỉnh (gọi đồng bộ, sau khi PA đã đổi; không gọi khi chặn). */ ketQua?: (toa: ToaDat) => void } = {}) =>
  (fn: (p: TrangThaiPA) => TrangThaiPA) => {
    let chan: ChanSua[] = [], sau: ToaDat | undefined;
    sua((q) => {
      const p = fn(q);
      chan = []; sau = undefined;
      const dl = layDuLieuMB();
      return { ...p, toa: p.toa.map((x) => {
        if (x.id !== toaId || !dl) return x;
        const mau = mauToa(tv, x) as ToaMB | undefined;
        if (tuy.tay === false) return tuChinhToa(x, mau, tv, dl);
        const truoc = q.toa.find((o) => o.id === toaId);
        if (!truoc) return tuChinhToa(x, mau, tv, dl);
        const r = tuChinhSauSua(truoc, x, mau, tv, dl);
        chan = r.chan; sau = r.toa;
        return r.toa;
      }) };
    });
    if (chan.length) tuy.baoChan?.(chan);
    else if (sau) tuy.ketQua?.(sau);
  };
