import { diemLechCoCau, coCauRong } from './coCau';
import type { KetQuaChiTieu } from './chiTieu';
import { LOAI_CAN, type LoaiCan, type TrangThaiPA } from './kieu';

/** Các chỉ số dùng để so sánh phương án. Ô không tính được là null (giao diện hiện "—"). */
export type ChiSoPA = {
  soCan: number;
  coCau: Record<LoaiCan, number>;
  coCauPct: Record<LoaiCan, number>;
  dtSan: number;
  /** Mật độ xây dựng lớn nhất trong các lô có tòa (%). */
  matDo: number | null;
  tangCao: number | null;
  danSo: number;
  /** Số dòng chỉ tiêu ở mức "vượt" (cộng mọi lô). */
  soLuatVuot: number;
  /** Điểm lệch cơ cấu (thấp là tốt); null khi PA chưa có căn nào. */
  lech: number | null;
};

/**
 * Điểm lệch cơ cấu của cả PA = trung bình, có trọng số theo số căn từng lô, của Σ |% đạt − % mục tiêu| theo loại căn.
 * Lô chưa có căn không tính; PA chưa có căn nào thì null.
 */
export function diemLechPA(pa: TrangThaiPA, kq: KetQuaChiTieu): number | null {
  let tong = 0, trong = 0;
  for (const lo of pa.lo) {
    const k = kq.theoLo[lo.id];
    if (!k || k.soCan <= 0) continue;
    tong += diemLechCoCau(k.coCauPct, lo.temDat.coCauMucTieu ?? coCauRong()) * k.soCan;
    trong += k.soCan;
  }
  return trong > 0 ? tong / trong : null;
}

/** Số dòng chỉ tiêu vượt giới hạn trong cả PA. */
export const demLuatVuot = (kq: KetQuaChiTieu): number =>
  Object.values(kq.theoLo).reduce((a, k) => a + k.dong.filter((d) => d.muc === 'vuot').length, 0);

const lonNhat = (xs: (number | null)[]): number | null => {
  const co = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return co.length ? Math.max(...co) : null;
};

/** Gom kết quả chỉ tiêu của một PA thành bộ chỉ số so sánh. */
export function chiSoPA(pa: TrangThaiPA, kq: KetQuaChiTieu): ChiSoPA {
  const lo = Object.values(kq.theoLo);
  const dat = (khoa: string) => lonNhat(lo.map((k) => k.dong.find((d) => d.khoa === khoa)?.dat ?? null));
  return {
    soCan: kq.tong.soCan,
    coCau: kq.tong.coCau,
    coCauPct: kq.tong.coCauPct,
    dtSan: kq.tong.dtSanTinhHSSDD,
    matDo: dat('matDo'),
    tangCao: dat('tangCao'),
    danSo: kq.tong.danSo,
    soLuatVuot: demLuatVuot(kq),
    lech: diemLechPA(pa, kq),
  };
}

export type KhoaSo = 'soCan' | 'dtSan' | 'matDo' | 'tangCao' | 'soLuatVuot' | 'lech' | LoaiCan;
export type KhoaSapXep = 'ten' | KhoaSo;
export const KHOA_SO: KhoaSo[] = ['lech', 'soCan', 'dtSan', 'matDo', 'tangCao', 'soLuatVuot', ...LOAI_CAN];

/** Giá trị của một cột số (null nếu trống). Cột loại căn trả về % của loại đó. */
export function giaTriCot(c: ChiSoPA, khoa: KhoaSo): number | null {
  const v = (LOAI_CAN as string[]).includes(khoa) ? c.coCauPct[khoa as LoaiCan] : (c as unknown as Record<string, unknown>)[khoa];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Sắp xếp theo cột; ô trống luôn xuống cuối, ổn định theo thứ tự ban đầu. */
export function sapXepPA<T extends { ten: string; chiSo: ChiSoPA }>(ds: T[], khoa: KhoaSapXep, giamDan = false): T[] {
  const gt = (x: T): number | string | null => (khoa === 'ten' ? x.ten : giaTriCot(x.chiSo, khoa));
  return ds
    .map((x, i) => ({ x, i, v: gt(x) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      const c = typeof a.v === 'string' ? a.v.localeCompare(b.v as string, 'vi') : a.v - (b.v as number);
      return (giamDan ? -c : c) || a.i - b.i;
    })
    .map((e) => e.x);
}

/** Chênh (a − b) từng chỉ số; null nếu một bên trống. */
export function chenhChiSo(a: ChiSoPA, b: ChiSoPA): Record<KhoaSo, number | null> {
  const r = {} as Record<KhoaSo, number | null>;
  for (const k of KHOA_SO) {
    const x = giaTriCot(a, k), y = giaTriCot(b, k);
    r[k] = x === null || y === null ? null : x - y;
  }
  return r;
}
