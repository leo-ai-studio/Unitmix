import { mauToa } from './canThem';
import { LOAI_CAN, type LamTronDT, type LoaiCan, type LoaiHinh, type Lo, type ThuVien, type TrangThaiPA } from './kieu';
import { canCaToa } from './matBang';
import {
  coPhanBietKhuVuc, DIEU_PHONG_O, FALLBACK_QG, FALLBACK_QG_LH, LOAI_HINH, SO_PHONG_O, theoKhuVuc, timQuyTac,
  type BangDanSo, type KhuVuc, type PhuongPhap, type QuyTacTinh, type SoPhongO,
} from './quyTacDanSo';

/**
 * Dân số theo TỪNG CĂN (tài liệu nguồn `quy-tac-tinh-dan-so-chung-cu.md` app cũ, 4 bước): tỉnh cũ → QĐ tỉnh → loại hình +
 * giai đoạn → bảng / công thức; tỉnh chưa có QĐ → P = S / 32 m²/người. DT căn dùng = DT thông thủy (`dt_tt_m2`) = DT sử dụng
 * căn (QCVN 04:2021/BXD 1.4.13) — đúng đại lượng các bảng QĐ ghi ("diện tích sử dụng"). Người / căn giữ số thực (1,5 · S ÷ 32),
 * không làm tròn từng căn; tổng cộng dồn số thực.
 * Lô chưa khai `temDat.danSo` (PA cũ): mỗi căn = `chiTieu.nguoiMoiCan` (hệ số chung) — giữ cách cũ, báo rõ trên giao diện.
 */

export type NgoaiBang = 'duoi' | 'tren' | null;
export type PhuongPhapApDung = PhuongPhap['kieu'] | 'bq' | 'heSoChung';
export type MotCan = { nguoi: number; dieu: string; ngoaiBang: NgoaiBang };

const EPS = 1e-9;

/** Tra một bảng thang DT: DT < DT tối thiểu → dòng đầu (cờ `duoi`); vượt mốc cuối → dòng cuối (cờ `tren`). */
export function traBang(b: BangDanSo, dt: number): MotCan {
  if (b.tuTren ? dt <= b.dtMin + EPS : dt < b.dtMin - EPS) return { nguoi: b.moc[0].nguoi, dieu: b.dieu, ngoaiBang: 'duoi' };
  for (const m of b.moc) if (m.nho ? dt < m.den - EPS : dt <= m.den + EPS) return { nguoi: m.nguoi, dieu: b.dieu, ngoaiBang: null };
  return { nguoi: b.moc[b.moc.length - 1].nguoi, dieu: b.dieu, ngoaiBang: 'tren' };
}

/** Bảng cho một loại hình: kiểu A có đủ 3 bảng; B dùng chung NOXH + TĐC; C TĐC → NOTM; D chỉ `chung`. */
export const bangTheoLoaiHinh = (pp: Extract<PhuongPhap, { kieu: 'bang' }>, lh: LoaiHinh): BangDanSo =>
  (pp.bang[lh] ?? pp.bang.chung ?? pp.bang.notm)!;

/**
 * Tra `bangPhong`: cột theo số phòng ở của loại căn (`SO_PHONG_O`, QCVN 04:2021 1.4.21). DT nằm ngoài dải cột đó = "không thống
 * nhất giữa DT và cơ cấu phòng ở" (Đồng Nai khoản 4) → theo DT: cột số phòng GẦN NHẤT có dải chứa DT (bằng nhau lấy ít phòng
 * hơn). Không biết loại căn → cột ít phòng nhất chứa DT. Không cột nào chứa (dưới 25 m²…) → dòng gần nhất cột gốc + cờ.
 */
function traBangPhong(pp: Extract<PhuongPhap, { kieu: 'bangPhong' }>, dt: number, loai?: LoaiCan): MotCan {
  const goc: SoPhongO = loai ? SO_PHONG_O[loai] : 1;
  const mc = traBang(pp.phong[goc], dt);
  if (loai && mc.ngoaiBang === null) return { ...mc, dieu: `${mc.dieu} · ${DIEU_PHONG_O}` };
  const chua = ([1, 2, 3, 4] as SoPhongO[])
    .filter((n) => traBang(pp.phong[n], dt).ngoaiBang === null)
    .sort((a, b) => Math.abs(a - goc) - Math.abs(b - goc) || a - b);
  if (!chua.length) return mc;
  const kq = traBang(pp.phong[chua[0]], dt);
  return loai ? { ...kq, dieu: `${kq.dieu} — theo DT (khoản 4: DT không khớp ${goc} phòng ở)` } : kq;
}

/** Số người của một căn DT `dt` (m² sử dụng) theo phương pháp `pp`; `loai` cần cho bảng theo số phòng ở. */
export function nguoiMotCan(dt: number, lh: LoaiHinh, pp: PhuongPhap, loai?: LoaiCan): MotCan {
  const duoi: NgoaiBang = dt < 25 - EPS ? 'duoi' : null;
  if (pp.kieu === 'bang') return traBang(bangTheoLoaiHinh(pp, lh), dt);
  if (pp.kieu === 'bangPhong') return traBangPhong(pp, dt, loai);
  if (pp.kieu === 'sTb') return { nguoi: dt / pp.sTb, dieu: pp.dieu, ngoaiBang: duoi };
  // QĐ 83/2026: ≤ 45 m² → 1 (dưới 25 m² cũng 1, như app cũ); NOXH > 45 → S ÷ 32; NOTM / TĐC > 45–160 → S ÷ 32, > 160 → 5
  if (dt <= 45 + EPS) return { nguoi: 1, dieu: pp.dieu, ngoaiBang: duoi };
  if (lh === 'noxh') return { nguoi: dt / pp.sTb, dieu: pp.dieu, ngoaiBang: null };
  return dt <= 160 + EPS ? { nguoi: dt / pp.sTb, dieu: pp.dieu, ngoaiBang: null } : { nguoi: 5, dieu: pp.dieu, ngoaiBang: null };
}

/* ---------- Làm tròn DT căn khi tính dân / căn sát mốc dải (chủ nhiệm 29/10/2026: "không thiệt dân cho CĐT") ---------- */

/** Dung sai mặc định (m²): căn trên mốc dải không quá chừng này coi là "sát mốc". Giá trị tạm, chờ chủ nhiệm chốt; sửa được ở lô. */
export const DUNG_SAI_MAC_DINH = 0.5;
/** Bước DT nhỏ nhất (m², 2 chữ số lẻ như DT ghi trong hồ sơ): mốc "đến dưới A" thì DT lớn nhất của dải dưới là A − 0,01. */
export const BUOC_DT = 0.01;
const tron2 = (v: number) => Math.round(v * 100) / 100;

/** Khai làm tròn của lô (thiếu = tắt, dung sai mặc định). */
export const lamTronKhai = (lo: Lo): LamTronDT => {
  const l = lo.temDat.danSo?.lamTron;
  return { bat: !!l?.bat, dungSai: l && Number.isFinite(l.dungSai) && l.dungSai >= 0 ? l.dungSai : DUNG_SAI_MAC_DINH };
};

/**
 * Các mốc DT (m²) mà số người đổi bậc của phương pháp `pp` cho loại hình `lh`: mốc từng dòng + DT tối thiểu của bảng (Đồng Nai cột
 * 02 phòng ở "từ trên 45"); `bangPhong` gộp mốc mọi cột (khoản 4 có thể chuyển cột); QĐ 83/2026 mốc 45 và 160. `sTb` (P = S ÷ S_tb)
 * liên tục, không có mốc — làm tròn không có tác dụng (không làm tròn S trước khi chia: văn bản không cho, và không có bậc để "nhảy").
 */
export function mocDT(pp: PhuongPhap, lh: LoaiHinh): number[] {
  const ds: number[] = [];
  const them = (b: BangDanSo) => { ds.push(b.dtMin); for (const m of b.moc) if (Number.isFinite(m.den)) ds.push(m.den); };
  if (pp.kieu === 'bang') them(bangTheoLoaiHinh(pp, lh));
  else if (pp.kieu === 'bangPhong') for (const n of [1, 2, 3, 4] as SoPhongO[]) them(pp.phong[n]);
  else if (pp.kieu === 'qd83') ds.push(45, 160);
  return [...new Set(ds)].sort((a, b) => a - b);
}

/** Căn sát mốc: DT hiện `dt` → DT gợi ý (mốc, dải dưới), số người hiện / sau, giảm mỗi căn. */
export type SatMoc = { moc: number; dtGoiY: number; nguoiHien: number; nguoiGoiY: number; giam: number };

/**
 * Căn có DT trên một mốc dải không quá `dungSai` m² mà về đúng mốc thì ít người hơn → DT gợi ý = DT lớn nhất của dải dưới: mốc A
 * khi bảng lấy "≤ A" (70,18 → 70,00), A − 0,01 khi bảng ghi "đến dưới A" (45,2 → 44,99). Nhiều mốc thì lấy cách giảm nhiều người
 * nhất, bằng nhau lấy DT gần DT hiện nhất. Không giảm được (S ÷ S_tb, bình quân / căn, chưa tới mốc) → null.
 */
export function satMoc(dt: number, lh: LoaiHinh, pp: PhuongPhap, loai: LoaiCan | undefined, dungSai: number): SatMoc | null {
  if (!(dungSai > 0) || !Number.isFinite(dt)) return null;
  const hien = nguoiMotCan(dt, lh, pp, loai).nguoi;
  let tot: SatMoc | null = null;
  for (const moc of mocDT(pp, lh)) {
    if (!(moc < dt - EPS) || dt - moc > dungSai + EPS) continue;
    for (const a of [moc, tron2(moc - BUOC_DT)]) {
      const n = nguoiMotCan(a, lh, pp, loai).nguoi;
      if (!(n < hien - EPS)) continue;
      if (!tot || n < tot.nguoiGoiY - EPS || (Math.abs(n - tot.nguoiGoiY) < EPS && a > tot.dtGoiY)) tot = { moc, dtGoiY: a, nguoiHien: hien, nguoiGoiY: n, giam: hien - n };
      break; // DT lớn nhất của dải dưới đã tìm được ở mốc này
    }
  }
  return tot;
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
  /** Bình quân người / căn của QĐ ở giai đoạn đang khai (null nếu QĐ không cho ở giai đoạn này). */
  bq: { so: number; dieu: string; tam?: boolean; loaiHinh?: LoaiHinh[] } | null;
  /**
   * Phương pháp thực áp cho từng loại hình: QĐ tỉnh có quy định cho loại hình đó (`rieng`) thì theo QĐ; không thì mặc định
   * quốc gia `FALLBACK_QG_LH` (VD TĐC ở Hà Nội).
   */
  theoLoaiHinh: Record<LoaiHinh, { pp: PhuongPhap; rieng: boolean }>;
  /**
   * Khu vực đô thị / nông thôn: `ap` = khai ở lô (thiếu — PA cũ — = đô thị); `phanBiet` = QĐ ở giai đoạn này ghi trị số khác
   * nhau cho hai khu vực (khi đó mới hiện ô chọn); `sTb` = trị số m² sàn/người đang áp khi `phanBiet`.
   */
  khuVuc: { ap: KhuVuc; phanBiet: boolean; sTb: number | null };
};

/** Khu vực khai ở lô; PA cũ chưa có trường này → đô thị. */
export const khuVucKhai = (lo: Lo): KhuVuc => lo.temDat.danSo?.khuVuc ?? 'doThi';

export function quyTacApDung(lo: Lo): QuyTacApDung | null {
  const k = lo.temDat.danSo;
  if (!k) return null;
  const khai = timQuyTac(k.tinh) ?? null;
  const ap = khai?.theo ? (timQuyTac(khai.theo) ?? khai) : khai;
  const ppGoc = ap?.phuongPhap?.[k.giaiDoan] ?? null;
  const kv = khuVucKhai(lo);
  const phanBiet = coPhanBietKhuVuc(ppGoc);
  const pp0 = ppGoc && theoKhuVuc(ppGoc, kv);
  const pp = pp0 ?? FALLBACK_QG;
  const fallback = pp0 === null;
  // tỉnh có số hiệu QĐ mà chưa có trị số → tạm; tỉnh chưa có QĐ → fallback đúng tài liệu nguồn §3 (không tạm)
  const tam = (fallback && !!ap?.qd) || (pp.kieu === 'sTb' && !!pp.tam) || !ap;
  const bq0 = ap?.bqCan ?? null;
  const bq = bq0 && (!bq0.giaiDoan || bq0.giaiDoan === k.giaiDoan) ? bq0 : null;
  const theoLoaiHinh = Object.fromEntries(LOAI_HINH.map((lh) => {
    const rieng = !fallback && (!ap?.loaiHinh || ap.loaiHinh.includes(lh));
    return [lh, { pp: rieng || fallback ? pp : FALLBACK_QG_LH, rieng }];
  })) as QuyTacApDung['theoLoaiHinh'];
  const khuVuc = { ap: kv, phanBiet, sTb: phanBiet && pp.kieu === 'sTb' ? pp.sTb : null };
  return { khai, ap, pp, fallback, tam, bq, theoLoaiHinh, khuVuc };
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
  /** Phương pháp thực áp cho căn này (theo loại hình). */
  phuongPhap: PhuongPhapApDung;
  /** true = theo QĐ tỉnh; false = mặc định quốc gia (QĐ không quy định loại hình này) hoặc hệ số chung. */
  rieng: boolean;
  /** Căn sát mốc dải (trong dung sai của lô) — có cả khi chưa bật làm tròn; null = không. */
  satMoc: SatMoc | null;
  /** true = đã tính dân theo DT gợi ý (`satMoc.dtGoiY`) vì lô bật làm tròn. */
  lamTron: boolean;
  /** Số căn mẫu này theo từng tòa (mọi tầng). */
  theoToa: Record<string, number>;
};
/** Tóm tắt theo loại hình: số căn, dân, phương pháp + căn cứ đã áp (không trùng). */
export type LoaiHinhDanSo = { so: number; nguoi: number; phuongPhap: PhuongPhapApDung; rieng: boolean; dieu: string[] };
export type NhomDanSo = { so: number; nguoi: number; dtMin: number | null; dtMax: number | null };
export type KetQuaDanSo = {
  coKhai: boolean;
  phuongPhap: PhuongPhapApDung;
  quyTac: QuyTacApDung | null;
  /** Từng mẫu căn trên lô (cộng mọi tòa), xếp theo loại rồi DT. */
  dong: DongDanSo[];
  theoLoai: Record<LoaiCan, NhomDanSo>;
  /** Theo loại hình NOTM / NOXH / TĐC có căn trên lô. */
  theoLoaiHinh: Partial<Record<LoaiHinh, LoaiHinhDanSo>>;
  theoToa: Record<string, { so: number; nguoi: number }>;
  soCan: number;
  tong: number;
  /** Căn cứ đã dùng (không trùng). */
  canCu: string[];
  soNgoaiBang: number;
  /**
   * Căn sát mốc dải: `bat` = lô bật làm tròn (dân đã tính theo DT gợi ý), `dungSai` m², `dong` = mẫu căn sát mốc, `giam` = số người
   * giảm (đã giảm khi bật; giảm được khi chưa bật) = Σ số căn × giảm mỗi căn.
   */
  satMoc: { bat: boolean; dungSai: number; dong: DongDanSo[]; giam: number };
};

const nhomRong = (): Record<LoaiCan, NhomDanSo> =>
  Object.fromEntries(LOAI_CAN.map((k) => [k, { so: 0, nguoi: 0, dtMin: null, dtMax: null }])) as unknown as Record<LoaiCan, NhomDanSo>;

/** Dân số một lô: từng căn → cộng theo mẫu căn, loại căn, tòa. Hàm thuần. */
export function danSoLo(pa: TrangThaiPA, lo: Lo, tv: ThuVien): KetQuaDanSo {
  const qt = quyTacApDung(lo);
  const cach = lo.temDat.danSo?.cach === 'bq' && qt?.bq ? 'bq' : null;
  const phuongPhap: PhuongPhapApDung = !qt ? 'heSoChung' : cach ?? qt.pp.kieu;
  const heSo = lo.temDat.chiTieu.nguoiMoiCan;
  const lt = lamTronKhai(lo);
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
        // bình quân người / căn chỉ cho loại hình QĐ ghi (Hà Nội 3,6 chỉ nhà ở thương mại); còn lại theo DT từng căn
        const dungBq = cach === 'bq' && (!qt!.bq!.loaiHinh || qt!.bq!.loaiHinh.includes(lh));
        const ppLh = qt?.theoLoaiHinh[lh];
        const sm = qt && !dungBq ? satMoc(can.dt_tt_m2, lh, ppLh!.pp, can.loai, lt.dungSai) : null;
        const lamTron = !!sm && lt.bat;
        const mc: MotCan = !qt
          ? { nguoi: heSo, dieu: '', ngoaiBang: null }
          : dungBq ? { nguoi: qt.bq!.so, dieu: qt.bq!.dieu, ngoaiBang: null }
          : nguoiMotCan(lamTron ? sm!.dtGoiY : can.dt_tt_m2, lh, ppLh!.pp, can.loai);
        // làm tròn: căn cứ giữ nguyên (không lặp theo từng mẫu ở danh sách căn cứ); DT đã dùng ở `satMoc.dtGoiY` + cờ `lamTron`
        const pp: PhuongPhapApDung = !qt ? 'heSoChung' : dungBq ? 'bq' : ppLh!.pp.kieu;
        d = {
          canId: id, loai: can.loai, loaiHinh: lh, dt: can.dt_tt_m2, so: 0, nguoiMoiCan: mc.nguoi, nguoi: 0, dieu: mc.dieu, ngoaiBang: mc.ngoaiBang,
          phuongPhap: pp, rieng: !qt ? false : dungBq || ppLh!.rieng, satMoc: sm, lamTron, theoToa: {},
        };
        theoMau.set(id, d);
      }
      d.so += n;
      d.nguoi += n * d.nguoiMoiCan;
      d.theoToa[t.id] = (d.theoToa[t.id] ?? 0) + n;
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
  const theoLoaiHinh: KetQuaDanSo['theoLoaiHinh'] = {};
  for (const d of dong) {
    const h = (theoLoaiHinh[d.loaiHinh] ??= { so: 0, nguoi: 0, phuongPhap: d.phuongPhap, rieng: d.rieng, dieu: [] });
    h.so += d.so;
    h.nguoi += d.nguoi;
    if (d.dieu && !h.dieu.includes(d.dieu)) h.dieu.push(d.dieu);
  }
  // mọi căn cùng một phương pháp thực áp (VD khai cách bq nhưng loại hình không được bq) → báo đúng phương pháp đó
  const dongSat = dong.filter((d) => d.satMoc);
  const ppChung = dong.length > 0 && dong.every((d) => d.phuongPhap === dong[0].phuongPhap) ? dong[0].phuongPhap : phuongPhap;
  return {
    coKhai: !!qt, phuongPhap: ppChung, quyTac: qt, dong, theoLoai, theoLoaiHinh, theoToa,
    soCan: dong.reduce((a, d) => a + d.so, 0),
    tong: dong.reduce((a, d) => a + d.nguoi, 0),
    canCu: [...new Set(dong.map((d) => d.dieu).filter(Boolean))],
    soNgoaiBang: dong.filter((d) => d.ngoaiBang).reduce((a, d) => a + d.so, 0),
    satMoc: { bat: lt.bat, dungSai: lt.dungSai, dong: dongSat, giam: dongSat.reduce((a, d) => a + d.so * d.satMoc!.giam, 0) },
  };
}

/** Dân số mọi lô và toàn dự án. */
export function danSoDuAn(pa: TrangThaiPA, tv: ThuVien): { theoLo: Record<string, KetQuaDanSo>; tong: number; soCan: number } {
  const theoLo: Record<string, KetQuaDanSo> = {};
  for (const lo of pa.lo) theoLo[lo.id] = danSoLo(pa, lo, tv);
  const ds = Object.values(theoLo);
  return { theoLo, tong: ds.reduce((a, k) => a + k.tong, 0), soCan: ds.reduce((a, k) => a + k.soCan, 0) };
}
