import { useEffect, useState } from 'preact/hooks';
import type { NetVe } from '../tinh/matBang';

export type HinhLoi = { paths: NetVe[]; bao_tuong_mm?: [number, number, number, number] };

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

export type HinhHocTai = { can: Map<string, NetVe[]>; loi: Map<string, HinhLoi>; dangTai: boolean };

/** Tải làm biếng hình học các mẫu căn và lõi đang cần cho mặt bằng; trả những gì đã có, `dangTai` khi còn thiếu. */
export function useHinhHoc(canIds: string[], loiIds: string[]): HinhHocTai {
  const khoa = [...new Set(canIds)].sort().join() + '|' + [...new Set(loiIds)].sort().join();
  const [kq, setKq] = useState<HinhHocTai>({ can: new Map(), loi: new Map(), dangTai: true });
  useEffect(() => {
    let huy = false;
    const [c, l] = khoa.split('|').map((x) => (x ? x.split(',') : []));
    setKq((o) => ({ ...o, dangTai: c.length + l.length > 0 }));
    Promise.all([
      Promise.all(c.map((id) => tai<{ ve: NetVe[] }>(`/lib/can/${id}.json`).then((j) => [id, j?.ve ?? []] as const))),
      Promise.all(l.map((id) => tai<HinhLoi>(`/lib/loi/${id}.json`).then((j) => [id, j ?? { paths: [] }] as const))),
    ]).then(([a, b]) => {
      if (!huy) setKq({ can: new Map(a), loi: new Map(b), dangTai: false });
    });
    return () => {
      huy = true;
    };
  }, [khoa]);
  return kq;
}
