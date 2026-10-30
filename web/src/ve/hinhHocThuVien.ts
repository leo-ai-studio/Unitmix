import { useEffect, useState } from 'preact/hooks';
import { useCaiTang } from '../man/caiTang';
import type { Diem, ThuVien } from '../tinh/kieu';
import type { NetVe } from '../tinh/matBang';
import { tinhCuaCan } from '../tinh/pccc';
import { idTepCan, veTheoId } from '../tinh/stretch';

export type HinhLoi = { paths: NetVe[]; bao_tuong_mm?: [number, number, number, number]; bao_tm?: Diem[] };

const nho = new Map<string, Promise<unknown>>();
/** Tải một tệp hình học thư viện, nhớ cả khi lỗi để không gọi lại liên tục. */
export function tai<T>(duong: string): Promise<T | null> {
  let p = nho.get(duong) as Promise<T | null> | undefined;
  if (!p) {
    p = fetch(duong).then((r) => (r.ok ? (r.json() as Promise<T>) : null), () => null);
    nho.set(duong, p);
  }
  return p;
}

/** Id lõi trong thư viện từ tên block trên mặt tòa: x_tmdv_u1_tm_05 → loi-tmdv-u1-tm-05. */
export const idLoi = (block: string): string => 'loi-' + block.replace(/^x_/, '').replace(/_/g, '-');

/** Tệp can/<id>.json: nét tường / cửa / vách…; `tach_noi_that` = nét nội thất, thiết bị nằm ở can/<id>.noithat.json (scripts/sinh_phai_sinh_can.py). */
type TepCan = { ve: NetVe[]; tach_noi_that?: boolean };

/**
 * Nét vẽ của tệp mẫu căn `idTep` (mẫu gốc). `noiThat` = kèm nét nội thất / thiết bị (tải thêm tệp .noithat khi đã tách);
 * không kèm thì tệp tách rồi chỉ có tường, cửa…, tệp chưa tách vẫn trả đủ (lớp vẽ tự lọc).
 */
export async function taiVeCan(idTep: string, noiThat: boolean): Promise<NetVe[]> {
  const j = await tai<TepCan>(`/lib/can/${idTep}.json`);
  if (!j) return [];
  if (!noiThat || !j.tach_noi_that) return j.ve ?? [];
  const nt = await tai<{ ve: NetVe[] }>(`/lib/can/${idTep}.noithat.json`);
  return nt?.ve?.length ? [...(j.ve ?? []), ...nt.ve] : j.ve ?? [];
}

export type HinhHocTai = { can: Map<string, NetVe[]>; loi: Map<string, HinhLoi>; dangTai: boolean };

/**
 * Tải làm biếng hình học các mẫu căn và lõi đang cần cho mặt bằng; trả những gì đã có, `dangTai` khi còn thiếu.
 * Căn biến thể STRETCH (`id~s+300`) đọc tệp mẫu gốc rồi kéo theo đường cắt (cần `tv`).
 * Nét nội thất chỉ tải khi lớp Nội thất của màn Tầng đang bật (caiTang.noiThat).
 */
export function useHinhHoc(canIds: string[], loiIds: string[], tv?: ThuVien | null): HinhHocTai {
  const { noiThat } = useCaiTang();
  const khoa = [...new Set(canIds)].sort().join() + '|' + [...new Set(loiIds)].sort().join();
  const [kq, setKq] = useState<HinhHocTai>({ can: new Map(), loi: new Map(), dangTai: true });
  useEffect(() => {
    let huy = false;
    const [c, l] = khoa.split('|').map((x) => (x ? x.split(',') : []));
    setKq((o) => ({ ...o, dangTai: c.length + l.length > 0 }));
    Promise.all([
      Promise.all(c.map((id) => taiVeCan(idTepCan(id), noiThat).then((ve) => [id, tv ? veTheoId(id, ve, tv) : ve] as const))),
      Promise.all(l.map((id) => tai<HinhLoi>(`/lib/loi/${id}.json`).then((j) => [id, j ?? { paths: [] }] as const))),
    ]).then(([a, b]) => {
      if (!huy) setKq({ can: new Map(a), loi: new Map(b), dangTai: false });
    });
    return () => {
      huy = true;
    };
  }, [khoa, tv, noiThat]);
  return kq;
}

/**
 * Tim cửa căn (chuẩn hoá theo mặt tiền, khoá ma_goc) của mọi mẫu gốc cùng nhóm — cho kiểm thoát nạn khi tối ưu (pccc.ts).
 * Đọc `cua_x` tiền tính trong can.json (không tải tệp nào); mẫu thiếu `cua_x` mới tải can/<id>.json để tính.
 */
export function cuaCanTuThuVien(tv: ThuVien, nhom?: string): { kq: Record<string, number>; thieu: string[] } {
  const kq: Record<string, number> = {};
  const thieu: string[] = [];
  for (const c of tv.can.values()) {
    if (c.stretchGoc || (nhom && c.nhom !== nhom)) continue;
    if (typeof c.cua_x === 'number') kq[c.ma_goc] = c.cua_x;
    else thieu.push(c.id);
  }
  return { kq, thieu };
}

export async function taiCuaCan(tv: ThuVien, nhom: string): Promise<Record<string, number>> {
  const { kq, thieu } = cuaCanTuThuVien(tv, nhom);
  await Promise.all(thieu.map((id) => tai<TepCan>(`/lib/can/${id}.json`).then((j) => {
    const c = tv.can.get(id);
    if (c && j?.ve) kq[c.ma_goc] = tinhCuaCan(j.ve, c.rong_mm);
  })));
  return kq;
}
