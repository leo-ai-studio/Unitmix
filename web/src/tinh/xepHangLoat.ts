/**
 * Xếp hàng loạt nhiều lô (app cũ "▦ Xếp hàng loạt" `tm_hl` · `xepHangLoat`, QT-86 / QT-92): chạy gợi ý xếp tòa MT-05
 * (`sinhGoiY`, tinh/xepToa.ts) LẦN LƯỢT từng lô đã chọn, lô lớn trước. Tòa của phương án đang chọn ở các lô đã chạy là "tòa lô
 * bên cạnh" cho lô sau → lô sau giữ khoảng cách §2.6.1 (LO-02) tới chúng. Mỗi lô giữ danh sách phương án; người dùng chọn phương án
 * nào thì áp phương án đó; áp cả lượt là một phép `sua` (một bước hoàn tác). Hàm thuần.
 */
import { dienTich } from './hinhHoc';
import type { Lo, ThuVien, ToaDat, TrangThaiPA } from './kieu';
import { hinhToa, kiemViPham } from './thaoTacToa';
import { sinhGoiY, type GoiYXep, type LuatXep } from './xepToa';

/** Lô gợi ý được: không phải đất "khác", có ranh, có MĐXD + HSSDĐ (như nút Gợi ý xếp tòa). */
export const loXepDuoc = (lo: Lo): boolean =>
  lo.temDat.chucNang !== 'khac' && lo.ranh.length >= 3 && lo.temDat.chiTieu.matDoMax > 0 && lo.temDat.chiTieu.hssddMax > 0;

/** Thứ tự chạy: lô xếp được trong danh sách chọn, diện tích lớn trước (app cũ sắp `tmDT` giảm dần). */
export function thuTuLo(pa: TrangThaiPA, loIds: string[]): Lo[] {
  return pa.lo.filter((l) => loIds.includes(l.id) && loXepDuoc(l)).sort((a, b) => dienTich(b.ranh) - dienTich(a.ranh));
}

export type KetQuaLo = {
  loId: string;
  /** Phương án đã xếp hạng (như gợi ý một lô). */
  ds: GoiYXep[];
  /** Chỉ số phương án chọn; null = giữ nguyên tòa hiện có của lô. */
  chon: number | null;
  ms: number;
};

/** PA sau khi thay tòa của mỗi lô trong `kq` bằng phương án đang chọn (lô `chon = null` giữ nguyên). id tòa = id tạm của gợi ý. */
export function paVoiChon(pa: TrangThaiPA, kq: KetQuaLo[], idMoi?: () => string): TrangThaiPA {
  let toa = pa.toa;
  for (const r of kq) {
    const g = r.chon === null ? null : r.ds[r.chon];
    if (!g) continue;
    const moi: ToaDat[] = g.toa.map((x) => ({ ...x, id: idMoi ? idMoi() : `${r.loId}~${x.id}` }));
    toa = [...toa.filter((x) => x.loId !== r.loId), ...moi];
  }
  return { ...pa, toa };
}

export type DauVaoHangLoat = {
  pa: TrangThaiPA;
  tv: ThuVien;
  luat: LuatXep;
  /** Thứ tự lô đã chốt (`thuTuLo`). */
  lo: Lo[];
  /** Tim cửa căn theo nhóm sản phẩm (đo thoát nạn). */
  cuaCan?: (lo: Lo) => Record<string, number> | undefined;
  /** Kết quả các lô đầu đã có (chạy lại từ một lô): giữ nguyên, chỉ chạy các lô còn lại. */
  truoc?: KetQuaLo[];
  /** Chỉ chạy tới lô thứ `den` (không gồm) — chạy nền từng lô một. */
  den?: number;
  soGoiY?: number;
};
export type TienDoHangLoat = { lo: number; tongLo: number; loId: string; phan: number };

/**
 * Bộ sinh: nhả lượt sau mỗi mẫu tòa của mỗi lô (tiến độ = (lô xong + phần lô đang chạy) / số lô). Lô sau thấy tòa phương án đầu
 * (đang chọn) của mọi lô trước. Trả kết quả từng lô theo thứ tự chạy.
 */
export function* sinhHangLoat(v: DauVaoHangLoat): Generator<TienDoHangLoat, KetQuaLo[]> {
  const kq: KetQuaLo[] = [...(v.truoc ?? [])];
  const tongLo = v.lo.length;
  for (let i = kq.length; i < Math.min(tongLo, v.den ?? tongLo); i++) {
    const lo = v.lo[i];
    const t0 = Date.now();
    // tòa lô này bỏ ra (sẽ thay), tòa phương án đang chọn ở các lô trước thành tòa lô bên cạnh
    const paLo = paVoiChon(v.pa, kq);
    const g = sinhGoiY({ pa: { ...paLo, toa: paLo.toa.filter((x) => x.loId !== lo.id) }, lo, tv: v.tv, luat: v.luat, cuaCan: v.cuaCan?.(lo), soGoiY: v.soGoiY });
    let ds: GoiYXep[];
    for (;;) {
      const r = g.next();
      if (r.done) { ds = r.value; break; }
      yield { lo: i, tongLo, loId: lo.id, phan: r.value.xong / r.value.tong };
    }
    kq.push({ loId: lo.id, ds, chon: ds.length ? 0 : null, ms: Date.now() - t0 });
  }
  return kq;
}

/** Chạy đồng bộ (test). */
export function xepHangLoat(v: DauVaoHangLoat): KetQuaLo[] {
  const g = sinhHangLoat(v);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}

/**
 * Chạy trên trình duyệt: nhả luồng sau mỗi bước; `huy()` true thì dừng và trả các lô ĐÃ XONG (như app cũ "đã dừng"),
 * kèm `dung: true`.
 */
export async function xepHangLoatNen(v: DauVaoHangLoat, tienDo?: (t: TienDoHangLoat) => void, huy?: () => boolean): Promise<{ kq: KetQuaLo[]; dung: boolean }> {
  const kq: KetQuaLo[] = [...(v.truoc ?? [])];
  for (let i = kq.length; i < v.lo.length; i++) {
    const g = sinhHangLoat({ ...v, den: i + 1, truoc: kq });
    for (;;) {
      const r = g.next();
      if (r.done) { kq.splice(0, kq.length, ...r.value); break; }
      tienDo?.(r.value);
      await new Promise((ok) => setTimeout(ok, 0));
      if (huy?.()) return { kq, dung: true };
    }
  }
  return { kq, dung: false };
}

/** Áp cả lượt: thay tòa các lô có phương án chọn (id mới). Gọi trong MỘT `sua` → một bước hoàn tác. */
export const apHangLoat = (pa: TrangThaiPA, kq: KetQuaLo[], idMoi: () => string): TrangThaiPA => paVoiChon(pa, kq, idMoi);

/**
 * Xung đột §2.6.1 (LO-02) giữa tòa của một lô trong lượt với tòa lô KHÁC sau khi áp lựa chọn hiện tại (đổi phương án một lô có thể
 * làm lô chạy sau nó không còn đủ khoảng cách vì lô sau được xếp theo phương án cũ). Trả số cặp lỗi (< đầu hồi) / cảnh báo (< cạnh
 * dài) theo lô.
 */
export function xungDotCheo(pa: TrangThaiPA, kq: KetQuaLo[], tv: ThuVien, luat: LuatXep): Map<string, { loi: number; canh: number }> {
  const p = paVoiChon(pa, kq);
  const kiem = kiemViPham(p, hinhToa(p, tv), luat);
  const loCua = new Map(p.toa.map((x) => [x.id, x.loId]));
  const trong = new Set(kq.map((r) => r.loId));
  const ra = new Map<string, { loi: number; canh: number }>();
  for (const c of kiem.cap) {
    const la = loCua.get(c.a)!, lb = loCua.get(c.b)!;
    if (la === lb) continue;
    for (const l of [la, lb]) {
      if (!trong.has(l)) continue;
      const d = ra.get(l) ?? { loi: 0, canh: 0 };
      d[c.muc === 'loi' ? 'loi' : 'canh']++;
      ra.set(l, d);
    }
  }
  return ra;
}
