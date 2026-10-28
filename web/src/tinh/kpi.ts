import { mauToa } from './canThem';
import type { KetQuaChiTieu } from './chiTieu';
import { coCauRong, phanTram } from './coCau';
import { danSoLo } from './danSo';
import { chanToa, dienTich } from './hinhHoc';
import { LOAI_CAN, type CongNangO, type LoaiCan, type Lo, type ThuVien, type ToaDat, type TrangThaiPA } from './kieu';
import { laCaoTang } from './loaiDat';
import { canCaToa, ghiDeTang, nhomTang } from './matBang';

/**
 * KPI cho lãnh đạo (panel phải Tổng mặt bằng và màn Tầng). Định nghĩa theo app cũ `MDI_Unitmix_v4` `metrics()`:
 * - DT sử dụng (DTSD) = Σ DT THÔNG THỦY các căn (`dt_tt_m2`, QCVN 04:2021/BXD 1.4.13) — không cộng phần chung, không phải NSA.
 * - DTXD một sàn = DT nét bao sàn một tầng (chân tháp; tầng / tòa có nét bao tự chỉnh thì đo nét đó, như `tinhChiTieu`).
 * - Hiệu suất = DTSD / DTXD (app cũ `eff: tt / foot`; luật MT-03 `mdi_eff` ≥ 75 %, quy_tac.json). Cả tòa / cả lô: Σ DTSD mọi tầng
 *   ÷ Σ DT sàn tháp mọi tầng (bình quân có trọng số).
 * - Tổng DT sàn xây dựng = DT sàn tính HSSDĐ của `tinhChiTieu` (tháp + đế + áp mái + hầm phần tính, QCVN 01:2021 1.4.21),
 *   so với HSSDĐ tối đa × DT lô.
 * Hàm thuần: không đọc gì ngoài PA, thư viện và kết quả chỉ tiêu.
 */

/** Ngưỡng hiệu suất MT-03 (`mdi_eff`, quy_tac.json "MDI target ≥75 %"). Giao diện đọc lại từ quy_tac.json khi có. */
export const HIEU_SUAT_MIN = 0.75;

/** So với chỉ tiêu: `dat` trong ngưỡng · `sat` trong 3 % ngưỡng · `vuot` vượt trần · `chuaDat` dưới sàn. null = không có ngưỡng. */
export type TrangThaiKpi = 'dat' | 'sat' | 'vuot' | 'chuaDat' | null;
export type OKpi = { gt: number | null; nguong: number | null; chieu: '<=' | '>='; tyLe: number | null; tt: TrangThaiKpi };

const SAT = 0.03;
/** So một số với ngưỡng (trần `<=` / sàn `>=`). */
export function soVoi(gt: number | null, nguong: number | null, chieu: '<=' | '>=' = '<='): OKpi {
  if (gt === null || !Number.isFinite(gt) || nguong === null || !(nguong > 0)) return { gt, nguong, chieu, tyLe: null, tt: null };
  const tyLe = gt / nguong;
  const tt: TrangThaiKpi = chieu === '<='
    ? (tyLe > 1 + 1e-9 ? 'vuot' : tyLe >= 1 - SAT ? 'sat' : 'dat')
    : (tyLe < 1 - 1e-9 ? 'chuaDat' : 'dat');
  return { gt, nguong, chieu, tyLe, tt };
}

/** Số liệu sàn của một tòa: DTSD cả tòa, DT sàn tháp cả tòa, DTXD tầng điển hình. */
export type SanToa = { dtsd: number; dtSanThap: number; dtxd1San: number; soCan: number };

/** DT nét bao một tầng `tang` (null = bố cục chung) — cùng cách `tinhChiTieu` đo sàn tháp. m². */
export function dtxdTang(tv: ThuVien, toa: ToaDat, tang: number | null): number {
  const mau = mauToa(tv, toa);
  if (!mau) return 0;
  const mbT = tang !== null ? ghiDeTang(toa, tang)?.matBang : undefined;
  return dienTich(chanToa(mau, mbT ? { ...toa, duongBao: mbT.duongBao } : toa));
}

export function sanToa(tv: ThuVien, toa: ToaDat): SanToa {
  const mau = mauToa(tv, toa);
  if (!mau) return { dtsd: 0, dtSanThap: 0, dtxd1San: 0, soCan: 0 };
  let dtsd = 0, soCan = 0;
  for (const [id, n] of canCaToa(mau, toa, tv)) { dtsd += n * (tv.can.get(id)?.dt_tt_m2 ?? 0); soCan += n; }
  const dtxd1San = dtxdTang(tv, toa, null);
  const dtSanThap = nhomTang(toa).reduce((a, g) => a + g.so * (g.tang !== null ? dtxdTang(tv, toa, g.tang) : dtxd1San), 0);
  return { dtsd, dtSanThap, dtxd1San, soCan };
}

export type DongToaKpi = SanToa & { toaId: string; loId: string; mauId: string; soTang: number; dan: number; hieuSuat: number | null };
export type KpiTmb = {
  soLo: number;
  danSo: OKpi;
  soCan: OKpi;
  dtSan: OKpi; // tổng DT sàn xây dựng (tính HSSDĐ) so với HSSDĐ × DT lô
  dtsd: number; // tổng DT sàn sử dụng
  dtxd1San: number; // Σ DTXD tầng điển hình các tòa
  matDo: OKpi; // MĐXD (%) so với tối đa — DT khối đế / DT lô
  hieuSuat: OKpi; // so với HIEU_SUAT_MIN (sàn)
  toa: DongToaKpi[];
};

/** KPI Tổng mặt bằng cho tập lô `loIds` (một lô, hoặc mọi lô cao tầng = cả dự án). */
export function kpiTmb(pa: TrangThaiPA, tv: ThuVien, kq: KetQuaChiTieu, loIds: string[], hsMin = HIEU_SUAT_MIN): KpiTmb {
  const dsLo = pa.lo.filter((l) => loIds.includes(l.id));
  let dan = 0, danMax = 0, soCan = 0, soCanMax: number | null = 0, dtSan = 0, dtSanMax = 0, dtLo = 0, dtDe = 0, matDoMax = 0;
  const toa: DongToaKpi[] = [];
  for (const lo of dsLo) {
    const r = kq.theoLo[lo.id];
    if (!r) continue;
    const ct = lo.temDat.chiTieu;
    const coToa = pa.toa.some((t) => t.loId === lo.id && tv.toa.has(t.mauId));
    const ds = coToa ? danSoLo(pa, lo, tv) : null;
    // dân số: lô đã khai QĐ tỉnh → từng căn; chưa khai → số căn × hệ số (cùng số với dòng chỉ tiêu `danSo`)
    dan += r.dong.find((d) => d.khoa === 'danSo')?.dat ?? 0;
    danMax += ct.danSoMax;
    soCan += r.soCan;
    soCanMax = soCanMax !== null && ct.soCanMax !== null ? soCanMax + ct.soCanMax : null;
    if (coToa) { dtSan += r.dtSanTinhHSSDD; dtDe += r.dtDe; }
    dtSanMax += ct.hssddMax * r.dtLo;
    dtLo += r.dtLo;
    matDoMax += ct.matDoMax * r.dtLo;
    for (const t of pa.toa) {
      if (t.loId !== lo.id || !tv.toa.has(t.mauId)) continue;
      const s = sanToa(tv, t);
      toa.push({ ...s, toaId: t.id, loId: lo.id, mauId: t.mauId, soTang: t.soTangDH, dan: ds?.coKhai ? (ds.theoToa[t.id]?.nguoi ?? 0) : s.soCan * ct.nguoiMoiCan,
        hieuSuat: s.dtSanThap > 0 ? s.dtsd / s.dtSanThap : null });
    }
  }
  const coToa = toa.length > 0;
  const dtsd = toa.reduce((a, x) => a + x.dtsd, 0);
  const dtThap = toa.reduce((a, x) => a + x.dtSanThap, 0);
  return {
    soLo: dsLo.length,
    danSo: soVoi(coToa ? dan : null, danMax || null),
    soCan: soVoi(coToa ? soCan : null, soCanMax || null),
    dtSan: soVoi(coToa ? dtSan : null, dtSanMax || null),
    dtsd,
    dtxd1San: toa.reduce((a, x) => a + x.dtxd1San, 0),
    matDo: soVoi(coToa && dtLo > 0 ? (dtDe / dtLo) * 100 : null, dtLo > 0 ? matDoMax / dtLo : null),
    hieuSuat: soVoi(dtThap > 0 ? dtsd / dtThap : null, hsMin, '>='),
    toa,
  };
}

/** Lô tính vào "cả dự án": mọi lô ở cao tầng. */
export const loDuAn = (pa: TrangThaiPA): string[] => pa.lo.filter(laCaoTang).map((l) => l.id);

export type MauTang = { canId: string; loai: LoaiCan; dt: number; nTang: number; nToa: number; nguoiMoiCan: number };
export type LoaiKpi = {
  nTang: number;
  nToa: number;
  pct: number; // % căn tầng
  mucTieu: number;
  lech: number | null; // điểm %; null khi tầng chưa có căn
  dtMin: number | null;
  dtMax: number | null;
  dtBq: number | null; // bình quân theo căn trên tầng
  danToa: number;
};
export type KpiTang = {
  theoLoai: Record<LoaiCan, LoaiKpi>;
  mau: MauTang[];
  soCanTang: number;
  soCanToa: number;
  soTang: number;
  danToa: number;
  danTang: number;
  dtxd: number; // DTXD sàn đang xem
  dtsd: number; // DTSD sàn đang xem
  hieuSuat: OKpi; // tầng đang xem, so với HIEU_SUAT_MIN
  hieuSuatToa: number | null;
};

/**
 * KPI một tầng của một tòa (màn Tầng). `canTang` = các ô của tầng đang xem (`soLieuTang(...).can`), ô đổi công năng không tính căn.
 * Dân số mỗi mẫu căn lấy đúng người / căn của `danSoLo` (QĐ tỉnh hoặc hệ số chung) nên cộng các loại = dân tòa ở TMB.
 */
export function kpiTang(pa: TrangThaiPA, tv: ThuVien, toa: ToaDat, lo: Lo | undefined, tang: number | null,
  canTang: { canId: string; cn: CongNangO }[], mucTieu: Record<LoaiCan, number>, hsMin = HIEU_SUAT_MIN): KpiTang {
  const ds = lo ? danSoLo(pa, lo, tv) : null;
  const heSo = lo?.temDat.chiTieu.nguoiMoiCan ?? 0;
  const nguoi = new Map(ds?.dong.map((d) => [d.canId, d.nguoiMoiCan]) ?? []);
  const nguoiCan = (id: string) => nguoi.get(id) ?? heSo;
  const mauMap = new Map<string, MauTang>();
  const lay = (id: string): MauTang | null => {
    const c = tv.can.get(id);
    if (!c) return null;
    let m = mauMap.get(id);
    if (!m) mauMap.set(id, (m = { canId: id, loai: c.loai, dt: c.dt_tt_m2, nTang: 0, nToa: 0, nguoiMoiCan: nguoiCan(id) }));
    return m;
  };
  for (const x of canTang) if (x.cn === 'can') { const m = lay(x.canId); if (m) m.nTang++; }
  const mauT = mauToa(tv, toa);
  if (mauT) for (const [id, n] of canCaToa(mauT, toa, tv)) { const m = lay(id); if (m) m.nToa += n; }
  const mau = [...mauMap.values()].sort((a, b) => LOAI_CAN.indexOf(a.loai) - LOAI_CAN.indexOf(b.loai) || a.dt - b.dt || a.canId.localeCompare(b.canId));

  const dem = coCauRong();
  for (const m of mau) dem[m.loai] += m.nTang;
  const pct = phanTram(dem);
  const soCanTang = LOAI_CAN.reduce((a, k) => a + dem[k], 0);
  const theoLoai = Object.fromEntries(LOAI_CAN.map((k) => {
    const ms = mau.filter((m) => m.loai === k);
    const tren = ms.filter((m) => m.nTang > 0);
    const dts = tren.map((m) => m.dt);
    const dtBq = dem[k] > 0 ? tren.reduce((a, m) => a + m.dt * m.nTang, 0) / dem[k] : null;
    const v: LoaiKpi = {
      nTang: dem[k], nToa: ms.reduce((a, m) => a + m.nToa, 0), pct: pct[k], mucTieu: mucTieu[k] ?? 0,
      lech: soCanTang > 0 ? pct[k] - (mucTieu[k] ?? 0) : null,
      dtMin: dts.length ? Math.min(...dts) : null, dtMax: dts.length ? Math.max(...dts) : null, dtBq,
      danToa: ms.reduce((a, m) => a + m.nToa * m.nguoiMoiCan, 0),
    };
    return [k, v];
  })) as Record<LoaiCan, LoaiKpi>;
  const dtsd = mau.reduce((a, m) => a + m.nTang * m.dt, 0);
  const dtxd = dtxdTang(tv, toa, tang);
  const s = sanToa(tv, toa);
  return {
    theoLoai, mau, soCanTang, soTang: toa.soTangDH,
    soCanToa: mau.reduce((a, m) => a + m.nToa, 0),
    danToa: mau.reduce((a, m) => a + m.nToa * m.nguoiMoiCan, 0),
    danTang: mau.reduce((a, m) => a + m.nTang * m.nguoiMoiCan, 0),
    dtxd, dtsd,
    hieuSuat: soVoi(dtxd > 0 ? dtsd / dtxd : null, hsMin, '>='),
    hieuSuatToa: s.dtSanThap > 0 ? s.dtsd / s.dtSanThap : null,
  };
}
