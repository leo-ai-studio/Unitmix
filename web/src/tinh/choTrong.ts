/**
 * Chỗ trống thêm được căn trên một tầng (công cụ "Thêm căn" màn Tầng — app cũ tAdd · QT-30 · QT-32 "khe người dùng tạo luôn là Còn
 * trống" · QT-69): khe giữa hai vật thể đủ một căn (khe XC-02 loại 'trong'), đầu dãy hở (mép mặt còn sàn trong nét bao mà dãy chưa
 * tới), ô công năng "Ô trống" và ô căn người dùng đã xoá (công năng 'bo' do người dùng đặt — tự chỉnh gỡ thoát nạn không tính).
 * Mỗi chỗ kèm neo chèn (sau / trước căn kề, hoặc chính ô) và căn kề để gợi ý mẫu vừa (`dsMauThem`).
 */
import { mauToa } from './canThem';
import { kheTrenMat } from './khe';
import type { ThuVien, ToaDat } from './kieu';
import { apMatBang, BAY_MM, matBangTang, type DuLieuMB, type ToaMB } from './loiThang';
import { boCucTang, canDangDung, viTriCan, type ViTriCan } from './matBang';

export type ChoTrong = {
  /** 'khe' giữa hai vật thể · 'dau' đầu dãy hở · 'o' ô trống / ô đã xoá (đặt lại căn vào chính ô). */
  loai: 'khe' | 'dau' | 'o';
  matIdx: number;
  /** Đoạn trống trên mặt (mm, hệ mặt của mặt bằng đang xem) và bề ngang. */
  a0: number;
  a1: number;
  rong: number;
  /** Ô căn neo: chèn sau / trước ô này; loai 'o' = chính ô cần đặt lại. */
  neo: ViTriCan;
  truoc: boolean;
  /** Mẫu căn kề (lấy nhóm, chiều sâu để gợi ý mẫu). */
  canKe: string;
  /** Ô căn đã xoá (không dựng trên mặt bằng — dãy đã co): a0 / a1 là chỗ theo mẫu, không vẽ lên bản vẽ. */
  daXoa?: boolean;
};

/** Chỗ nhỏ hơn mức này không đặt được căn nào (studio hẹp nhất thư viện ~ 3,6 m) — giá trị tạm, chờ chủ nhiệm chốt. */
export const CHO_MIN_MM = 3000;

const trongDG = (p: [number, number], P: [number, number][]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

/** Các chỗ trống thêm được căn ở tầng `tang` (null = bố cục chung) của tòa. */
export function choTrong(toa: ToaDat, tv: ThuVien, dl: DuLieuMB | null | undefined, tang: number | null): ChoTrong[] {
  const mau = mauToa(tv, toa) as ToaMB | undefined;
  if (!mau || !Array.isArray(mau.mat)) return [];
  const mb = matBangTang(toa, mau, dl, tang);
  const ap = apMatBang(mau, mb, dl), bc = boCucTang(toa, tang);
  const vts = viTriCan(ap, tv, bc);
  const kq: ChoTrong[] = [];
  // 1. khe giữa hai vật thể (đủ một căn, không phải sân / hành lang / chỗ chừa lõi)
  for (const k of kheTrenMat(ap, tv, bc).khe) {
    if (k.loai !== 'trong' || k.rong < CHO_MIN_MM) continue;
    const truoc = vts.find((v) => v.matIdx === k.matIdx && Math.abs(v.a1 - k.a0) <= 5);
    const sau = vts.find((v) => v.matIdx === k.matIdx && Math.abs(v.a0 - k.a1) <= 5);
    const neo = truoc ?? sau;
    if (!neo) continue;
    kq.push({ loai: 'khe', matIdx: k.matIdx, a0: k.a0, a1: k.a1, rong: k.rong, neo, truoc: !truoc, canKe: canDangDung(neo, bc) });
  }
  // 2. đầu dãy hở: giữa mép mặt và căn đầu / cuối dãy còn sàn trong nét bao
  ap.mat.forEach((m, mi) => {
    const ds = m.phan_tu.filter((q) => q.a1 - q.a0 > 1).sort((a, b) => a.a0 - b.a0);
    if (!ds.length) return;
    const r = (m.goc_deg * Math.PI) / 180, u = [Math.cos(r), Math.sin(r)], n = [-u[1], u[0]];
    const pt = (a: number, b: number): [number, number] => [u[0] * a + n[0] * (m.truc_mm + b), u[1] * a + n[1] * (m.truc_mm + b)];
    for (const cuoi of [false, true]) {
      const q = cuoi ? ds[ds.length - 1] : ds[0];
      const a0 = cuoi ? q.a1 : m.a_dau, a1 = cuoi ? m.a_cuoi : q.a0;
      if (a1 - a0 < CHO_MIN_MM) continue;
      const neo = vts.find((v) => v.khoa === q.khoa);
      if (!neo) continue;
      // sàn thật: điểm giữa chỗ trống (giữa bay) nằm trong nét bao
      const g = pt((a0 + a1) / 2, BAY_MM / 2);
      if (!trongDG(g, ap.duong_bao)) continue;
      // không phải chỗ căn của mặt khác (góc trong tòa L / U) đang đứng
      if (vts.some((v) => v.matIdx !== mi && trongDG(g, v.goc as [number, number][]))) continue;
      if (kq.some((x) => x.matIdx === mi && Math.abs(x.a0 - a0) < 5)) continue;
      kq.push({ loai: 'dau', matIdx: mi, a0, a1, rong: a1 - a0, neo, truoc: !cuoi, canKe: canDangDung(neo, bc) });
    }
  });
  // 3. ô trống / ô người dùng đã xoá (bỏ ô tự chỉnh gỡ — chạy lại tự chỉnh sẽ gỡ lại)
  const tuDong = new Set((toa.tuDong ?? []).filter((d) => d.truong === 'congNang' && (d.tang === tang || d.tang === null)).map((d) => d.khoa));
  const goc = viTriCan(mau, tv);
  for (const [khoa, cn] of Object.entries(bc.congNang ?? {})) {
    if ((cn !== 'trong' && cn !== 'bo') || tuDong.has(khoa)) continue;
    const v = vts.find((x) => x.khoa === khoa) ?? goc.find((x) => x.khoa === khoa);
    if (!v) continue;
    const id = canDangDung(v, bc), w = tv.can.get(id)?.rong_mm ?? v.a1 - v.a0;
    kq.push({ loai: 'o', matIdx: v.matIdx, a0: v.a0, a1: v.a0 + w, rong: w, neo: v, truoc: false, canKe: id, ...(cn === 'bo' ? { daXoa: true } : {}) });
  }
  return kq.sort((a, b) => a.matIdx - b.matIdx || a.a0 - b.a0);
}
