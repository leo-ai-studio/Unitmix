import { mauToa } from './canThem';
import { LOAI_CAN, type LoaiCan, type LoaiHinh, type Lo, type ThuVien, type TrangThaiPA } from './kieu';
import { canCaToa } from './matBang';
import { FALLBACK_QG, timQuyTac, type BangDanSo, type PhuongPhap, type QuyTacTinh } from './quyTacDanSo';

/**
 * Dân số theo TỪNG CĂN (tài liệu nguồn `quy-tac-tinh-dan-so-chung-cu.md` app cũ, 4 bước): tỉnh cũ → QĐ tỉnh → loại hình +
 * giai đoạn → bảng / công thức; tỉnh chưa có QĐ → P = S / 32 m²/người. DT căn dùng = DT thông thủy (`dt_tt_m2`) = DT sử dụng
 * căn (QCVN 04:2021/BXD 1.4.13) — đúng đại lượng các bảng QĐ ghi ("diện tích sử dụng"). Người / căn giữ số thực (1,5 · S ÷ 32),
 * không làm tròn từng căn; tổng cộng dồn số thực.
 * Lô chưa khai `temDat.danSo` (PA cũ): mỗi căn = `chiTieu.nguoiMoiCan` (hệ số chung) — giữ cách cũ, báo rõ trên giao diện.
 */

export type NgoaiBang = 'duoi' | 'tren' | null;
export type PhuongPhapApDung = 'bang' | 'sTb' | 'qd83' | 'bq' | 'heSoChung';
export type MotCan = { nguoi: number; dieu: string; ngoaiBang: NgoaiBang };

const EPS = 1e-9;

/** Tra một bảng thang DT: DT < DT tối thiểu → dòng đầu (cờ `duoi`); vượt mốc cuối → dòng cuối (cờ `tren`). */
export function traBang(b: BangDanSo, dt: number): MotCan {
  if (dt < b.dtMin - EPS) return { nguoi: b.moc[0].nguoi, dieu: b.dieu, ngoaiBang: 'duoi' };
  for (const m of b.moc) if (m.nho ? dt < m.den - EPS : dt <= m.den + EPS) return { nguoi: m.nguoi, dieu: b.dieu, ngoaiBang: null };
  return { nguoi: b.moc[b.moc.length - 1].nguoi, dieu: b.dieu, ngoaiBang: 'tren' };
}

/** Bảng cho một loại hình: kiểu A có đủ 3 bảng; B dùng chung NOXH + TĐC; C TĐC → NOTM; D chỉ `chung`. */
export const bangTheoLoaiHinh = (pp: Extract<PhuongPhap, { kieu: 'bang' }>, lh: LoaiHinh): BangDanSo =>
  (pp.bang[lh] ?? pp.bang.chung ?? pp.bang.notm)!;

/** Số người của một căn DT `dt` (m² sử dụng) theo phương pháp `pp`. */
export function nguoiMotCan(dt: number, lh: LoaiHinh, pp: PhuongPhap): MotCan {
  const duoi: NgoaiBang = dt < 25 - EPS ? 'duoi' : null;
  if (pp.kieu === 'bang') return traBang(bangTheoLoaiHinh(pp, lh), dt);
  if (pp.kieu === 'sTb') return { nguoi: dt / pp.sTb, dieu: pp.dieu, ngoaiBang: duoi };
  // QĐ 83/2026: ≤ 45 m² → 1 (dưới 25 m² cũng 1, như app cũ); NOXH > 45 → S ÷ 32; NOTM / TĐC > 45–160 → S ÷ 32, > 160 → 5
  if (dt <= 45 + EPS) return { nguoi: 1, dieu: pp.dieu, ngoaiBang: duoi };
  if (lh === 'noxh') return { nguoi: dt / pp.sTb, dieu: pp.dieu, ngoaiBang: null };
  return dt <= 160 + EPS ? { nguoi: dt / pp.sTb, dieu: pp.dieu, ngoaiBang: null } : { nguoi: 5, dieu: pp.dieu, ngoaiBang: null };
}

/** Quy tắc thực áp cho một khai báo: theo tỉnh (đi qua `theo` khi QĐ cũ hết hiệu lực), phương pháp theo giai đoạn. */
export type QuyTacApDung = {
  khai: QuyTacTinh | null; // tỉnh người dùng chọn
  ap: QuyTacTinh | null; // tỉnh có quy tắc thực áp (BR-VT cũ → TP.HCM)
  pp: PhuongPhap;
  /** Đang dùng mốc quốc gia vì tỉnh chưa có QĐ / chưa có trị số. */
  fallback: boolean;
  /** Trị số chưa có căn cứ đủ: giá trị tạm, chờ chủ nhiệm chốt. */
  tam: boolean;
  bq: { so: number; dieu: string; tam?: boolean } | null;
};

export function quyTacApDung(lo: Lo): QuyTacApDung | null {
  const k = lo.temDat.danSo;
  if (!k) return null;
  const khai = timQuyTac(k.tinh) ?? null;
  const ap = khai?.theo ? (timQuyTac(khai.theo) ?? khai) : khai;
  const pp0 = ap?.phuongPhap?.[k.giaiDoan] ?? null;
  const pp = pp0 ?? FALLBACK_QG;
  const fallback = pp0 === null;
  // tỉnh có số hiệu QĐ mà chưa có trị số → tạm; tỉnh chưa có QĐ → fallback đúng tài liệu nguồn §3 (không tạm)
  const tam = (fallback && !!ap?.qd) || (pp.kieu === 'sTb' && !!pp.tam) || !ap;
  return { khai, ap, pp, fallback, tam, bq: ap?.bqCan ?? null };
}

/** Loại hình một căn: khai ở lô thì theo khai; không thì căn nhóm XH hoặc lô NOXH → NOXH, còn lại NOTM. */
export const loaiHinhCan = (lo: Lo, nhomCan: 'tm' | 'xh'): LoaiHinh =>
  lo.temDat.danSo?.loaiHinh ?? (nhomCan === 'xh' || lo.temDat.chucNang === 'xh' ? 'noxh' : 'notm');

export type DongDanSo = {
  canId: string;
  loai: LoaiCan;
  loaiHinh: LoaiHinh;
  dt: number;
  so: number;
  nguoiMoiCan: number;
  nguoi: number;
  dieu: string;
  ngoaiBang: NgoaiBang;
};
export type NhomDanSo = { so: number; nguoi: number; dtMin: number | null; dtMax: number | null };
export type KetQuaDanSo = {
  coKhai: boolean;
  phuongPhap: PhuongPhapApDung;
  quyTac: QuyTacApDung | null;
  /** Từng mẫu căn trên lô (cộng mọi tòa), xếp theo loại rồi DT. */
  dong: DongDanSo[];
  theoLoai: Record<LoaiCan, NhomDanSo>;
  theoToa: Record<string, { so: number; nguoi: number }>;
  soCan: number;
  tong: number;
  /** Căn cứ đã dùng (không trùng). */
  canCu: string[];
  soNgoaiBang: number;
};

const nhomRong = (): Record<LoaiCan, NhomDanSo> =>
  Object.fromEntries(LOAI_CAN.map((k) => [k, { so: 0, nguoi: 0, dtMin: null, dtMax: null }])) as unknown as Record<LoaiCan, NhomDanSo>;

/** Dân số một lô: từng căn → cộng theo mẫu căn, loại căn, tòa. Hàm thuần. */
export function danSoLo(pa: TrangThaiPA, lo: Lo, tv: ThuVien): KetQuaDanSo {
  const qt = quyTacApDung(lo);
  const cach = lo.temDat.danSo?.cach === 'bq' && qt?.bq ? 'bq' : null;
  const phuongPhap: PhuongPhapApDung = !qt ? 'heSoChung' : cach ?? qt.pp.kieu;
  const heSo = lo.temDat.chiTieu.nguoiMoiCan;
  const theoMau = new Map<string, DongDanSo>();
  const theoToa: KetQuaDanSo['theoToa'] = {};
  for (const t of pa.toa) {
    if (t.loId !== lo.id) continue;
    const mau = mauToa(tv, t);
    if (!mau) continue;
    const tt = (theoToa[t.id] = { so: 0, nguoi: 0 });
    for (const [id, n] of canCaToa(mau, t, tv)) {
      const can = tv.can.get(id);
      if (!can) continue;
      let d = theoMau.get(id);
      if (!d) {
        const lh = loaiHinhCan(lo, can.nhom);
        const mc: MotCan = !qt
          ? { nguoi: heSo, dieu: '', ngoaiBang: null }
          : cach === 'bq' ? { nguoi: qt.bq!.so, dieu: qt.bq!.dieu, ngoaiBang: null }
          : nguoiMotCan(can.dt_tt_m2, lh, qt.pp);
        d = { canId: id, loai: can.loai, loaiHinh: lh, dt: can.dt_tt_m2, so: 0, nguoiMoiCan: mc.nguoi, nguoi: 0, dieu: mc.dieu, ngoaiBang: mc.ngoaiBang };
        theoMau.set(id, d);
      }
      d.so += n;
      d.nguoi += n * d.nguoiMoiCan;
      tt.so += n;
      tt.nguoi += n * d.nguoiMoiCan;
    }
  }
  const dong = [...theoMau.values()].sort((a, b) => LOAI_CAN.indexOf(a.loai) - LOAI_CAN.indexOf(b.loai) || a.dt - b.dt || a.canId.localeCompare(b.canId));
  const theoLoai = nhomRong();
  for (const d of dong) {
    const g = theoLoai[d.loai];
    g.so += d.so;
    g.nguoi += d.nguoi;
    g.dtMin = g.dtMin === null ? d.dt : Math.min(g.dtMin, d.dt);
    g.dtMax = g.dtMax === null ? d.dt : Math.max(g.dtMax, d.dt);
  }
  return {
    coKhai: !!qt, phuongPhap, quyTac: qt, dong, theoLoai, theoToa,
    soCan: dong.reduce((a, d) => a + d.so, 0),
    tong: dong.reduce((a, d) => a + d.nguoi, 0),
    canCu: [...new Set(dong.map((d) => d.dieu).filter(Boolean))],
    soNgoaiBang: dong.filter((d) => d.ngoaiBang).reduce((a, d) => a + d.so, 0),
  };
}

/** Dân số mọi lô và toàn dự án. */
export function danSoDuAn(pa: TrangThaiPA, tv: ThuVien): { theoLo: Record<string, KetQuaDanSo>; tong: number; soCan: number } {
  const theoLo: Record<string, KetQuaDanSo> = {};
  for (const lo of pa.lo) theoLo[lo.id] = danSoLo(pa, lo, tv);
  const ds = Object.values(theoLo);
  return { theoLo, tong: ds.reduce((a, k) => a + k.tong, 0), soCan: ds.reduce((a, k) => a + k.soCan, 0) };
}
