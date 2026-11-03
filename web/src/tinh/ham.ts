/**
 * Tầng hầm: ranh hầm, lõi + cột kế thừa từ tòa, ram, rải chỗ đỗ / xe máy / kho / kỹ thuật theo từng tầng,
 * và các phép kiểm theo QCVN 13:2018/BXD, QCVN 04:2021/BXD (khu xe điện theo DỰ THẢO SĐ 01:2026 — chỉ cảnh báo).
 * Hàm thuần, toạ độ mét.
 */
import { thongTinLoi } from './doiCan';
import type { MucDo } from './chiTieu';
import { demCan } from './coCau';
import { khoiDeLo } from './deLo';
import { chanToa, trongTam, xoayTinhTien } from './hinhHoc';
import { vungDat } from './hopLo';
import type { Diem, KhuXeDien, LoaiRam, Lo, RamHam, ThuVien, TrangThaiPA } from './kieu';
import { chuanHoaHam, type HAM_MAC_DINH } from './macDinh';
import { canCuaToa, coMat } from './matBang';
import type { PhanTuMat } from './pccc';
import { gocCanhDaiNhat, lechLanTai, raiChoDo, type Hcn } from './raiCho';
import { mauToa } from './canThem';
import { catDai, coVao, dai, diemTrong, dtCoDau, dtHop, dtTru, giao, giaoNhau, hcnUv, hcnXoay, heTruc, hieu, khungUv, namTrongRanh, type HeTruc } from './hamHinh';
import { chuongTrinhPhong, type LoaiPhong, type MucPhong, type SoLieuPhong } from './hamPhong';
import { chiaKhoang, chonSac, chonXeLan, datThang, demCutDuong, type DuongNoi, khungHeTruc, soXeLanQCVN10, timChoCanhLoi, timChoSatTuong, type KhoangChay, type OngGio, type ThangThoat } from './hamBoTri';
import { danSoLo } from './danSo';

export type HamDayDu = typeof HAM_MAC_DINH;

/* Hình học dùng chung: tinh/hamHinh.ts (giữ export cũ dtTru / dtHop / coVao cho nơi gọi). */
export { coVao, dtHop, dtTru } from './hamHinh';

/* ---------- Ranh, lõi, cột, ram ---------- */

/** Ranh hầm: ranh đã cố định trong PA, không thì chỉ giới (hoặc ranh lô) co vào `lui` mét. */
export const ranhHam = (lo: Lo, ts: Pick<HamDayDu, 'ranh' | 'lui'>): Diem[] =>
  ts.ranh && ts.ranh.length >= 3 ? ts.ranh : coVao(vungDat(lo), ts.lui);

/**
 * Lõi (thang bộ, thang máy, hộp kỹ thuật) và cột của các tòa trên lô, kéo xuống hầm.
 * Lõi: khung bao nét vẽ của phần tử không phải căn trên mặt tầng mẫu. Cột: tại đỉnh và dọc cạnh chân tháp, cách ≤ nhịp.
 */
export function loiCotTuToa(pa: TrangThaiPA, tv: ThuVien, loId: string, cotRong: number, nhip: number): { loi: Diem[][]; cot: Diem[][]; thangLoi: Diem[][]; loiToa: { toaId: string; poly: Diem[] }[] } {
  const loi: Diem[][] = [];
  const thangLoi: Diem[][] = [];
  const loiToa: { toaId: string; poly: Diem[] }[] = [];
  const diemCot: Diem[] = [];
  const cot: Diem[][] = [];
  for (const t of pa.toa) {
    const mau = t.loId === loId ? mauToa(tv, t) : undefined;
    if (!mau) continue;
    const xs = mau.duong_bao.map((p) => p[0]), ys = mau.duong_bao.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const dat = (pts: Diem[]) => xoayTinhTien(pts.map(([x, y]): Diem => [((t.lat ? -1 : 1) * (x - cx)) / 1000, (y - cy) / 1000]), t.x, t.y, t.gocDo);
    if (coMat(mau)) {
      mau.mat.forEach((m, mi) => {
        (m.phan_tu as (PhanTuMat & { bb_ve_mm?: number[] })[]).forEach((q, qi) => {
          const b = q.bb_ve_mm;
          if (q.loai === 'can' || !b || b.length < 4) return;
          // Lõi đã khai không có thang bộ / thang máy / hộp kỹ thuật nào xuống hầm (menu lõi ở màn Tầng) thì không đặt trong hầm.
          const tt = thongTinLoi(t, `${mi}:${qi}`);
          if (!tt.thangBo.ham && !tt.thangMay.ham && !tt.hopKT.ham) return;
          const p = dat([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]);
          loi.push(p);
          loiToa.push({ toaId: t.id, poly: p });
          if (q.loai === 'thang_bo' && tt.thangBo.ham) thangLoi.push(p);
        });
      });
    }
    if (cotRong > 0 && nhip > 0) {
      const chan = chanToa(mau, t);
      for (let i = 0; i < chan.length; i++) {
        const a = chan[i], b = chan[(i + 1) % chan.length];
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / nhip));
        for (let k = 0; k < n; k++) {
          const p: Diem = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
          if (diemCot.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < nhip / 2)) continue;
          diemCot.push(p);
          cot.push(hcnXoay(p[0], p[1], cotRong, cotRong, t.gocDo));
        }
      }
    }
  }
  return { loi, cot, thangLoi, loiToa };
}

/** Ram: theo toạ độ đã nhập, không thì tự đặt sát cạnh dài nhất của ranh hầm, cách đầu cạnh 2 m. Bề rộng gồm vỉa hè nếu có người đi. */
export function hinhRam(ranh: Diem[], ram: RamHam): { poly: Diem[]; x: number; y: number; gocDo: number } | null {
  const rong = ram.rong + (ram.coNguoiDi ? ram.viaHe : 0);
  if (ram.x !== null && ram.y !== null && ram.gocDo !== null) return { poly: hcnXoay(ram.x, ram.y, ram.dai, rong, ram.gocDo), x: ram.x, y: ram.y, gocDo: ram.gocDo };
  if (ranh.length < 3) return null;
  let i0 = 0, dai = -1;
  for (let i = 0; i < ranh.length; i++) {
    const a = ranh[i], b = ranh[(i + 1) % ranh.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > dai) { dai = l; i0 = i; }
  }
  const a = ranh[i0], b = ranh[(i0 + 1) % ranh.length];
  const u: Diem = [(b[0] - a[0]) / dai, (b[1] - a[1]) / dai];
  const trai = dtCoDau(ranh) > 0; // ngược kim đồng hồ: phần trong nằm bên trái cạnh
  const n: Diem = trai ? [-u[1], u[0]] : [u[1], -u[0]];
  const doc = 2 + ram.dai / 2;
  const x = a[0] + u[0] * doc + n[0] * (rong / 2), y = a[1] + u[1] * doc + n[1] * (rong / 2);
  const gocDo = Math.round(((Math.atan2(u[1], u[0]) * 180) / Math.PI) * 100) / 100;
  return { poly: hcnXoay(x, y, ram.dai, rong, gocDo), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, gocDo };
}

/* ---------- Rải từng tầng ---------- */

export type PhongDat = { ma: string; loai: LoaiPhong; tang: number; poly: Diem[][]; dt: number; dtYeuCau: number };

export type KetQuaTangHam = {
  tang: number; // 1 = B1
  dtSan: number;
  cho: Diem[][];
  xeLan: Diem[][];
  lan: Diem[][];
  kho: Diem[][];
  xeMay: Diem[][];
  /** Mọi phòng kỹ thuật của tầng (gộp, giữ cho nơi vẽ cũ); chi tiết từng phòng ở `phong`. */
  kyThuat: Diem[][];
  /** Chỗ sạc ô tô theo phân vùng (dự thảo SĐ 01:2026). */
  vungSac: Diem[][][];
  soCho: number; // gồm chỗ xe lăn
  soXeLan: number;
  soKho: number;
  dtOto: number; // DT khu ô tô gồm đường nội bộ, ram (đã trừ lõi, cột, dải khác)
  dtXeMay: number;
  dtKyThuat: number;
  dtLoi: number; // lõi + cột trong ranh
  dtSacOto: number; // ước DT khu sạc ô tô
  /* Đợt 2 */
  phong: PhongDat[];
  /** Ô đỗ xe máy (trong dải xe máy). */
  choXeMay: Diem[][];
  soXeMay: number;
  soSac: number;
  /** Đường xe chạy ngang hai đầu (nối các làn thành vòng). */
  lanNgang: Diem[][];
  /** Đầu làn cụt (thế giới). */
  cutDuong: Diem[];
  /** Rèm / cửa ngăn cháy chỗ làn xe cắt tường ngăn cháy. */
  remChay: Diem[][];
  /** Đoạn thẳng trước đỉnh ram xuống tầng dưới (chỉ tầng còn ram xuống tiếp). */
  ramThang: Diem[] | null;
  /** Đỉnh ram xuống tầng dưới nối được làn / đường ngang (tầng cuối: null). */
  ramNoi: boolean | null;
};

export type YeuCauDoXe = { heSo: number; theoCan: number; theoDT: number; tong: number; xeMay: number; garaCoKhi: boolean };

/**
 * DT chỗ để xe yêu cầu theo QCVN 04:2021/BXD 2.2.17.1:
 * b) ≥ 25 m² / 4 căn nhưng ≥ 20 m² / 100 m² DT sử dụng căn, trong đó ≥ 6 m² xe máy, xe đạp mỗi căn;
 * c) NOXH, tái định cư, thu nhập thấp: lấy 60% định mức b) và vẫn ≥ 6 m² xe máy mỗi căn;
 * d) gara cơ khí: ≥ 12 m² / 100 m² DT sử dụng căn (ở đây cộng thêm phần xe máy 6 m²/căn).
 */
export function yeuCauDoXe(soCan: number, dtsd: number, noxh: boolean, garaCoKhi: boolean): YeuCauDoXe {
  const heSo = noxh ? 0.6 : 1;
  const theoCan = (heSo * 25 * soCan) / 4;
  const theoDT = heSo * 0.2 * dtsd;
  const xeMay = 6 * soCan;
  const tong = garaCoKhi ? 0.12 * dtsd + xeMay : Math.max(theoCan, theoDT, xeMay);
  return { heSo, theoCan, theoDT, tong, xeMay, garaCoKhi };
}

/** Số căn và DT sử dụng (thông thủy) căn của các tòa trên lô. */
export function canTrenLo(pa: TrangThaiPA, tv: ThuVien, loId: string): { soCan: number; dtsd: number } {
  const dem = demCan(pa, tv);
  let soCan = 0, dtsd = 0;
  for (const t of pa.toa) {
    if (t.loId !== loId) continue;
    soCan += Object.values(dem[t.id] ?? {}).reduce((a, b) => a + b, 0);
    const mau = mauToa(tv, t);
    if (!mau) continue;
    for (const [id, n] of canCuaToa(mau, t, tv)) dtsd += n * t.soTangDH * (tv.can.get(id)?.dt_tt_m2 ?? 0);
  }
  return { soCan, dtsd };
}

/* ---------- Phép kiểm ---------- */

export type KiemHam = {
  khoa: string;
  dat: number | null;
  mucTieu: number | null;
  chieu: '<=' | '>=';
  donVi: string;
  thapPhan: number;
  muc: MucDo;
  canCu: string;
  /** Theo dự thảo: chỉ cảnh báo, không tính là vượt. */
  duThao: boolean;
};

const SAT_NGUONG = 0.03; // như chiTieu.ts: trong 3% so với giới hạn thì cảnh báo

type TuyChonKiem = { donVi?: string; canCu: string; thapPhan?: number; duThao?: boolean; khongSat?: boolean };

/** Một dòng kiểm, màu theo quy ước MucDo của chiTieu.ts. `khongSat`: số đếm / số tầng, không cảnh báo sát ngưỡng. */
export function dongKiem(khoa: string, dat: number | null, mucTieu: number | null, chieu: '<=' | '>=', o: TuyChonKiem): KiemHam {
  const { donVi = '', canCu, thapPhan = 0, duThao = false } = o;
  let muc: MucDo = 'ok';
  if (dat !== null && mucTieu !== null && Number.isFinite(dat)) {
    const chenh = dat - mucTieu;
    const vuot = chieu === '<=' ? chenh > 1e-9 : chenh < -1e-9;
    const sat = !o.khongSat && Math.abs(chenh) <= Math.abs(mucTieu) * SAT_NGUONG;
    muc = vuot ? (duThao ? 'canh_bao' : 'vuot') : sat ? 'canh_bao' : 'ok';
  }
  return { khoa, dat, mucTieu, chieu, donVi, thapPhan, muc, canCu, duThao };
}

/** Độ dốc dọc tối đa (%) theo QCVN 13:2018/BXD 2.2.1.28 a). */
export const DOC_DOC_MAX: Record<LoaiRam, number> = { thang_mai: 18, cong: 13, ho: 10 };

/** Dốc dọc phần dốc chính (%): hai đoạn chuyển nửa dốc dài c ở hai đầu nằm trong `dai` → cao = s·(dai − c). */
export const docRam = (ram: RamHam, caoTang: number): number | null => {
  const c = Math.max(0, ram.doanChuyen ?? 0);
  const L = ram.dai - c;
  return L > 0 ? (caoTang / L) * 100 : null;
};

/**
 * Kiểm ram: dốc dọc ≤ QCVN 13:2018 2.2.1.28 a); dốc ngang ≤ 6% (b); vỉa hè ≥ 0,8 m khi có người đi bộ (c);
 * đổi dốc ở đỉnh / chân ≤ 12,5% (QCVN 07-11:2025 dự thảo 2.4.3.8.3, chỉ cảnh báo); ram cong bán kính ≥ 6 m (dự thảo 2.4.7.4.3).
 */
export function kiemRam(ram: RamHam, caoTang: number): KiemHam[] {
  const QC = 'QCVN 13:2018/BXD 2.2.1.28';
  const DT = 'QCVN 07-11:2025/BXD (dự thảo)';
  const s = docRam(ram, caoTang);
  const kq = [
    dongKiem('ramDoc', s, DOC_DOC_MAX[ram.loai], '<=', { donVi: '%', canCu: `${QC} a)`, thapPhan: 1 }),
    dongKiem('ramNgang', ram.docNgang, 6, '<=', { donVi: '%', canCu: `${QC} b)`, thapPhan: 1 }),
  ];
  if (ram.coNguoiDi) kq.push(dongKiem('ramViaHe', ram.viaHe, 0.8, '>=', { donVi: 'm', canCu: `${QC} c)`, thapPhan: 2 }));
  if (s !== null) kq.push(dongKiem('ramDoiDoc', (ram.doanChuyen ?? 0) > 0 ? s / 2 : s, 12.5, '<=', { donVi: '%', canCu: `${DT} 2.4.3.8.3`, thapPhan: 1, duThao: true }));
  if (ram.loai === 'cong') kq.push(dongKiem('ramBanKinh', ram.banKinh ?? null, 6, '>=', { donVi: 'm', canCu: `${DT} 2.4.7.4.3`, thapPhan: 1, duThao: true }));
  return kq;
}

/**
 * Khu xe điện theo DỰ THẢO Sửa đổi 01:2026 QCVN 04:2021/BXD (chưa số hiệu, chưa hiệu lực) — chỉ cảnh báo:
 * 2.10.2.1 b) phân vùng sạc ở hầm ≤ 25 chỗ ô tô / ≤ 50 chỗ xe máy; 2.10.1.1 b), 2.10.2.1 b) giữa các khu cách ≥ 2 m
 * hoặc tường / vách không cháy cao ≥ 2 m; 2.10.2.1 f) khoang cháy khu sạc ô tô ở hầm ≤ 1 200 m²; g) xe máy ≤ 300 m²;
 * 2.11.1 b) khu đổi pin chỉ tới tầng hầm 1.
 */
export function kiemXeDien(xd: KhuXeDien, dtSacOto: number): KiemHam[] {
  const DT = 'Dự thảo SĐ 01:2026 QCVN 04:2021/BXD';
  const kq: KiemHam[] = [];
  if (xd.choOto > 0) {
    kq.push(dongKiem('xdVungOto', Math.min(xd.vungOto, xd.choOto), 25, '<=', { canCu: `${DT} 2.10.2.1 b)`, duThao: true, khongSat: true }));
    kq.push(dongKiem('xdKhoangOto', dtSacOto, 1200, '<=', { donVi: 'm²', canCu: `${DT} 2.10.2.1 f)`, duThao: true }));
  }
  if (xd.choXeMay > 0) {
    kq.push(dongKiem('xdVungXeMay', Math.min(xd.vungXeMay, xd.choXeMay), 50, '<=', { canCu: `${DT} 2.10.2.1 b)`, duThao: true, khongSat: true }));
    kq.push(dongKiem('xdKhoangXeMay', xd.choXeMay * xd.dtXeMayMoiCho, 300, '<=', { donVi: 'm²', canCu: `${DT} 2.10.2.1 g)`, duThao: true }));
  }
  if (xd.choOto > 0 || xd.choXeMay > 0) {
    // Có tường ngăn không cháy ≥ 2 m thì không cần khoảng cách: coi như đạt.
    kq.push(dongKiem('xdKhoangCach', xd.tuongNgan ? null : xd.khoangCach, 2, '>=', { donVi: 'm', canCu: `${DT} 2.10.1.1 b), 2.10.2.1 b)`, thapPhan: 1, duThao: true }));
  }
  if (xd.tuDoiPinTang !== null) kq.push(dongKiem('xdDoiPin', xd.tuDoiPinTang, 1, '<=', { canCu: `${DT} 2.11.1 b)`, duThao: true, khongSat: true }));
  return kq;
}

/* ---------- Toàn bộ hầm ---------- */

export type RamKetQua = {
  poly: Diem[]; x: number; y: number; gocDo: number;
  /** Phần dốc; đoạn thẳng sau chân ram (trong hầm); đoạn thẳng trước đỉnh (tầng 1 / tầng có ram xuống tiếp). */
  doc?: Diem[]; thangDuoi?: Diem[] | null; thangTren?: Diem[] | null;
  dinh?: Diem; chan?: Diem;
};

export type ThongGioKhoang = {
  khoang: number;
  /** Lưu lượng hút khói mỗi tầng, m³/h (9 lần/h × thể tích khoang — QCVN 04:2021 2.6.5). */
  qHut: number;
  qCap: number;
  /** DT hộp gió thải / cấp cần (mọi tầng, ống riêng từng tầng — QCVN 13:2018 2.3.3.1), m². */
  dtOngThai: number;
  dtOngCap: number;
  /** DT louver ở tầng 1 cần (thải + cấp), m². */
  dtLouver: number;
  /** DT lỗ mở tự nhiên tham chiếu 0,2% sàn (QCVN 13:2018 2.3.3.5 — không áp cho gara trong nhà có công năng khác). */
  dtMoTuNhien: number;
  daDat: boolean;
};

export type KetQuaTang1 = {
  chan: Diem[][];
  de: Diem[][];
  /** Miệng ram (phần dốc) + đoạn thẳng trước đỉnh ram ở tầng 1. */
  ramMo: Diem[] | null;
  ramThang: Diem[] | null;
  /** Đường vào từ đầu đoạn thẳng tới mép lô gần nhất giáp đường. */
  duongVao: [Diem, Diem] | null;
  kcDuong: number | null;
  /** Thang thoát nạn hầm đặt thêm, ra thẳng tầng 1. */
  thangRa: Diem[][];
  miengGio: OngGio[];
  /** Hộp gió nằm dưới chân tháp / đế (phải dời). */
  gioDuoiToa: number;
  /** Thang thêm nằm dưới chân tháp / đế (không ra thẳng ngoài nhà — QCVN 06:2022 3.2.2 a). */
  thangDuoiToa: number;
  dtLo: number;
  dtCanhQuan: number;
};

export type KetQuaHam = {
  ts: HamDayDu;
  ranh: Diem[];
  loi: Diem[][];
  cot: Diem[][];
  ram: RamKetQua | null;
  tang: KetQuaTangHam[];
  soCan: number;
  dtsd: number;
  noxh: boolean;
  yeuCau: YeuCauDoXe;
  tong: {
    dtSan: number; soCho: number; soXeLan: number; soKho: number; dtOto: number; dtXeMay: number; dtKyThuat: number; dtLoi: number;
    soXeMay: number; soSac: number; soCutDuong: number;
  };
  /** Tỷ lệ đo được trên sàn hầm: đỗ xe (ô tô + xe máy, gồm đường nội bộ) và kỹ thuật (phòng kỹ thuật + lõi, cột). */
  tyLe: { doXe: number; kyThuat: number };
  kiem: KiemHam[];
  /* Đợt 2 */
  danSo: number;
  /** Số chỗ yêu cầu: ô tô, xe máy (chỉ tiêu lô × số căn), xe lăn (QCVN 10:2024 Bảng 1), sạc (≥ 10% dự thảo). */
  yeuCauCho: { oto: number; xeMay: number; xeLan: number; sac: number };
  phongCT: MucPhong[];
  soLieuPhong: SoLieuPhong;
  khoang: KhoangChay[];
  tuongChay: [Diem, Diem][];
  thang: ThangThoat[];
  ongGio: OngGio[];
  thongGio: ThongGioKhoang[];
  t1: KetQuaTang1;
};

/*
 * Nhớ kết quả rải theo ĐẦU VÀO THẬT của raiHamTinh (không theo cả PA): thông số hầm, lô (ranh / chỉ giới / tem đất), các tòa
 * trên lô (vị trí, mẫu, lõi, số căn) và thư viện. Sửa đơn giá, tên, cơ cấu mục tiêu, tòa ở lô khác… không rải lại.
 * Dùng chung cho màn Hầm, Chi phí (tinhKhoiLuong) và 3D bật Hầm. Kết quả coi là bất biến: nơi gọi không được sửa.
 */
/** Mỗi kết quả ~1 MB JSON (vài MB trong bộ nhớ). 12 từng làm dự án > 12 lô có tòa rải đi rải lại không dứt (đẩy nhau khỏi cache). */
const NHO_HAM_TOI_DA = 64;
const nhoHam = new WeakMap<object, Map<string, KetQuaHam | null>>();
const TV_RONG = {};
/** Khoá cache: mọi thứ raiHamTinh đọc từ PA (pa.ham, lô, tòa thuộc lô). */
export const khoaRaiHam = (pa: TrangThaiPA, lo: Lo): string =>
  JSON.stringify([pa.ham ?? null, lo, pa.toa.filter((t) => t.loId === lo.id)]);

const nhoTheoTv = (tv: ThuVien | null): Map<string, KetQuaHam | null> => {
  const theoTv = nhoHam.get(tv ?? TV_RONG) ?? new Map<string, KetQuaHam | null>();
  nhoHam.set(tv ?? TV_RONG, theoTv);
  return theoTv;
};

/** Tra cache theo khoá: có thì trả (kể cả null = ranh rỗng), chưa có thì undefined. */
export function layNhoHam(tv: ThuVien | null, khoa: string): KetQuaHam | null | undefined {
  const theoTv = nhoTheoTv(tv);
  if (!theoTv.has(khoa)) return undefined;
  const kq = theoTv.get(khoa)!;
  theoTv.delete(khoa); theoTv.set(khoa, kq); // dùng gần nhất xếp cuối (LRU)
  return kq;
}

/** Ghi kết quả vào cache (worker rải xong cũng ghi vào đây). */
export function datNhoHam(tv: ThuVien | null, khoa: string, kq: KetQuaHam | null): void {
  const theoTv = nhoTheoTv(tv);
  theoTv.delete(khoa); theoTv.set(khoa, kq);
  if (theoTv.size > NHO_HAM_TOI_DA) theoTv.delete(theoTv.keys().next().value!);
}

/** Rải toàn bộ các tầng hầm dưới lô `lo` và kiểm (có nhớ theo đầu vào), ĐỒNG BỘ. Ranh không hợp lệ thì null.
 *  Giao diện không gọi thẳng hàm này (chặn luồng chính vài giây): dùng `tinh/hamNen.ts` (Web Worker). */
export function raiHam(pa: TrangThaiPA, tv: ThuVien | null, lo: Lo): KetQuaHam | null {
  const khoa = khoaRaiHam(pa, lo);
  const co = layNhoHam(tv, khoa);
  if (co !== undefined) return co;
  const kq = raiHamTinh(pa, tv, lo);
  datNhoHam(tv, khoa, kq);
  return kq;
}

/** PA thu gọn gửi sang worker: chỉ phần raiHamTinh đọc (khoá cache = pa.ham, lô, tòa thuộc lô). */
export const paGonChoHam = (pa: TrangThaiPA, lo: Lo): TrangThaiPA => ({ ...pa, lo: [lo], toa: pa.toa.filter((t) => t.loId === lo.id) });

/* ---------- Bố trí đợt 2: ram, phòng, thông gió ---------- */

/** Gió trong hộp gió, qua louver, tỷ lệ thông thoáng louver — giá trị tạm, chờ chủ nhiệm chốt (không có TCVN 5687 trong kho). */
export const GIO_TAM = { vOng: 8, vLouver: 5, thongThoang: 0.6 };
/** Số lần trao đổi không khí khi hút khói, lần/h (QCVN 04:2021/BXD 2.6.5). */
const LAN_HUT_KHOI = 9;
/** Cấp gió tươi ≈ 80% gió thải (tham khảo DAHY, docs/ham_tham_khao.md). */
const TY_LE_CAP = 0.8;

const tron2 = (x: number) => Math.round(x * 100) / 100;

/** Ram đặt tay: phần dốc tâm (x, y) dài `dai` theo hướng xuống `gocDo`; đoạn thẳng dưới sau chân, đoạn thẳng trên trước đỉnh. */
function ramTay(ram: RamHam): RamKetQua {
  const rong = ram.rong + (ram.coNguoiDi ? ram.viaHe : 0);
  const h = heTruc((ram.gocDo! * Math.PI) / 180);
  const [cu, cv] = h.uv([ram.x!, ram.y!]);
  const Ld = Math.max(0, ram.doanThangDuoi ?? 0), Lt = Math.max(0, ram.doanThangTren ?? 0);
  const u0 = cu - ram.dai / 2, u1 = cu + ram.dai / 2, v0 = cv - rong / 2, v1 = cv + rong / 2;
  return {
    poly: hcnUv(h, u0, v0, u1 + Ld, v1), x: ram.x!, y: ram.y!, gocDo: ram.gocDo!,
    doc: hcnUv(h, u0, v0, u1, v1), thangDuoi: Ld > 0 ? hcnUv(h, u1, v0, u1 + Ld, v1) : null, thangTren: Lt > 0 ? hcnUv(h, u0 - Lt, v0, u0, v1) : null,
    dinh: h.ve(u0, cv), chan: h.ve(u1 + Ld, cv),
  };
}

/**
 * Ram tự đặt: dọc tường phía v nhỏ của hệ trục, chân ram (cuối đoạn thẳng dưới) ở `uChan` = mép đường ngang cuối hầm, xe xuống theo
 * chiều +u. Phần dốc thẳng (không cong), đoạn thẳng bằng ở cả hai đầu. Trượt vào trong 0,5 m / bước tới khi nằm trọn trong ranh.
 */
function datRamTuDong(ranh: Diem[], ht: HeTruc, bb: [number, number, number, number], ram: RamHam, uChan: number): RamKetQua | null {
  const rong = ram.rong + (ram.coNguoiDi ? ram.viaHe : 0);
  const Ld = Math.max(0, ram.doanThangDuoi ?? 0), Lt = Math.max(0, ram.doanThangTren ?? 0);
  const uDinh = uChan - Ld - ram.dai;
  if (uDinh - Lt < bb[0]) return null;
  for (let v0 = bb[1] + 0.05; v0 < bb[1] + 40; v0 += 0.5) {
    const poly = hcnUv(ht, uDinh, v0, uChan, v0 + rong);
    const tren = Lt > 0 ? hcnUv(ht, uDinh - Lt, v0, uDinh, v0 + rong) : null;
    if (!namTrongRanh(poly, ranh) || (tren && !namTrongRanh(tren, ranh))) continue;
    const vm = v0 + rong / 2;
    const [x, y] = ht.ve(uDinh + ram.dai / 2, vm);
    return {
      poly, x: tron2(x), y: tron2(y), gocDo: tron2((((ht.goc * 180) / Math.PI) % 360 + 540) % 360 - 180),
      doc: hcnUv(ht, uDinh, v0, uDinh + ram.dai, v0 + rong), thangDuoi: Ld > 0 ? hcnUv(ht, uDinh + ram.dai, v0, uChan, v0 + rong) : null, thangTren: tren,
      dinh: ht.ve(uDinh, vm), chan: ht.ve(uChan, vm),
    };
  }
  return null;
}

/** Điểm gần nhất trên cạnh lô giáp đường (`canhDuong[i]` là số; lô chưa khai = mọi cạnh, như xepToa) và khoảng cách. */
function ganDuong(lo: Lo, p: Diem): { kc: number; diem: Diem } | null {
  let tot: { kc: number; diem: Diem } | null = null;
  const n = lo.ranh.length;
  for (let i = 0; i < n; i++) {
    if (lo.canhDuong && typeof lo.canhDuong[i] !== 'number') continue;
    const a = lo.ranh[i], b = lo.ranh[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    const q: Diem = [a[0] + t * dx, a[1] + t * dy];
    const kc = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (!tot || kc < tot.kc) tot = { kc, diem: q };
  }
  return tot;
}

/** Khung bao hai đa giác chồng nhau (lọc nhanh trước phép Clipper). */
const khungChong = (a: Diem[], b: Diem[]): boolean => {
  const ka = [Math.min(...a.map((p) => p[0])), Math.min(...a.map((p) => p[1])), Math.max(...a.map((p) => p[0])), Math.max(...a.map((p) => p[1]))];
  const kb = [Math.min(...b.map((p) => p[0])), Math.min(...b.map((p) => p[1])), Math.max(...b.map((p) => p[0])), Math.max(...b.map((p) => p[1]))];
  return ka[0] < kb[2] && kb[0] < ka[2] && ka[1] < kb[3] && kb[1] < ka[3];
};

/** Chia các mảnh dải kỹ thuật thành phòng (lớn trước), cắt theo v. */
function chiaPhong(manh: Diem[][], ht: HeTruc, ds: MucPhong[], tang: number): PhongDat[] {
  const con = manh.filter((p) => p.length >= 3 && dtCoDau(p) > 0).map((p) => ({ p, bb: khungHeTruc(ht, p), dt: dtHop([p]) })).sort((a, b) => b.dt - a.dt);
  const kq: PhongDat[] = [];
  let i = 0;
  let vCur = con[0]?.bb[1] ?? 0;
  for (const m of [...ds].sort((a, b) => b.dt - a.dt)) {
    let can = m.dt;
    const poly: Diem[][] = [];
    while (can > 0.5 && i < con.length) {
      const pc = con[i], b = pc.bb;
      const phan = (v1: number) => giao([pc.p], [hcnUv(ht, b[0] - 1, vCur, b[2] + 1, v1)]);
      const conLai = dtHop(phan(b[3] + 1));
      if (conLai <= can + 0.5) {
        poly.push(...phan(b[3] + 1));
        can -= conLai;
        i++;
        vCur = con[i]?.bb[1] ?? 0;
        continue;
      }
      let lo = vCur, hi = b[3];
      for (let k = 0; k < 24; k++) { const g = (lo + hi) / 2; if (dtHop(phan(g)) < can) lo = g; else hi = g; }
      poly.push(...phan(hi));
      vCur = hi;
      can = 0;
    }
    kq.push({ ma: m.ma, loai: m.loai, tang, poly, dt: dtHop(poly), dtYeuCau: m.dt });
  }
  return kq;
}

/** Bản không nhớ (test so sánh). Chạy trong Web Worker (tinh/raiHam.worker.ts). */
export function raiHamTinh(pa: TrangThaiPA, tv: ThuVien | null, lo: Lo): KetQuaHam | null {
  const ts = chuanHoaHam(pa.ham);
  const ranh = ranhHam(lo, ts);
  if (ranh.length < 3) return null;
  const { loi, cot, thangLoi, loiToa } = tv ? loiCotTuToa(pa, tv, lo.id, ts.cotRong, ts.nhip) : { loi: [], cot: [], thangLoi: [], loiToa: [] };
  const { soCan, dtsd } = tv ? canTrenLo(pa, tv, lo.id) : { soCan: 0, dtsd: 0 };
  const ct = lo.temDat.chiTieu;
  let danSo = soCan * (ct.nguoiMoiCan ?? 0);
  if (tv && soCan) {
    try { const d = danSoLo(pa, lo, tv); if (d.tong > 0) danSo = d.tong; } catch { /* dân số theo QĐ tỉnh lỗi: dùng hệ số chung */ }
  }
  const noxh = lo.temDat.chucNang === 'xh';
  const yeuCau = yeuCauDoXe(soCan, dtsd, noxh, ts.garaCoKhi);
  const dtSan = dtHop([ranh]);
  const soTang = Math.max(1, Math.min(6, Math.round(ts.soTang)));
  const tangXeMay = Math.min(soTang, Math.max(1, Math.round(ts.tangXeMay)));
  const d = ts.choDai, lan = ts.rongLan;
  const toaLo = tv ? pa.toa.filter((t) => t.loId === lo.id).map((t) => { const m = mauToa(tv, t); return m ? { t, m, chan: chanToa(m, t) } : null; }).filter((x) => !!x) : [];
  const yeuCauCho = { oto: soCan ? Math.ceil(soCan * (ct.choDoOtoMoiCan ?? 0)) : 0, xeMay: soCan ? Math.ceil(soCan * (ct.choXeMayMoiCan ?? 0)) : 0, xeLan: 0, sac: 0 };

  // Trục dãy + ram (chọn góc hầm có đỉnh ram gần cạnh lô giáp đường nhất).
  const goc0 = gocCanhDaiNhat(ranh);
  const ramCoToaDo = ts.ram.x !== null && ts.ram.y !== null && ts.ram.gocDo !== null;
  let ht = heTruc(goc0);
  let ram: RamKetQua | null = null;
  if (ramCoToaDo) ram = ramTay(ts.ram);
  else {
    let tot: { h: HeTruc; r: RamKetQua; kc: number } | null = null;
    for (const g of [goc0, goc0 + Math.PI]) {
      const h = heTruc(g);
      const b = khungUv(h, ranh);
      const r = datRamTuDong(ranh, h, b, ts.ram, b[2] - d - lan);
      if (!r) continue;
      const kc = ganDuong(lo, r.thangTren ? trongTam(r.thangTren) : r.dinh!)?.kc ?? 0;
      if (!tot || kc < tot.kc - 1) tot = { h, r, kc };
    }
    if (tot) { ht = tot.h; ram = tot.r; }
    else ram = hinhRam(ranh, ts.ram);
  }
  const goc = ht.goc;
  const bbR = khungUv(ht, ranh);
  const bb: [number, number, number, number] = [bbR[0], bbR[1] - 1, bbR[2], bbR[3] + 1];
  const ramVc: Diem[][] = ram ? [ram.poly] : [];
  const ramTren = ram?.thangTren ?? null;
  // Lưới dãy chung mọi tầng: một làn chạy sát mép trong ram (nối đỉnh + chân ram), không có ram thì dãy chỗ sát tường v nhỏ.
  const modDay = 2 * d + lan;
  const vMepRam = ram ? khungHeTruc(ht, ram.poly)[3] : null;
  const lechV = vMepRam !== null ? lechLanTai(vMepRam, ts, bbR[1]) : 0;
  const v0Luoi = bbR[1] - modDay + lechV;
  // Cao độ v bắt đầu các dãy chỗ (đặt cụm quạt trong sàn khi khoang không giáp tường ngoài).
  const dayCho: number[] = [];
  for (let vv = v0Luoi; vv < bbR[3]; vv += modDay) dayCho.push(vv, vv + d + lan);
  // Dải làn (để thang / phòng / hộp gió không đặt lên làn), bỏ hai đầu u (dải chỗ quay + đường ngang).
  const daiLan: Diem[][] = [];
  for (let vv = v0Luoi + d; vv < bbR[3]; vv += modDay) daiLan.push(hcnUv(ht, bbR[0] + d + 0.5, vv + 0.25, bbR[2] - d - 0.5, vv + lan - 0.25));

  // Khoang cháy + thang thoát nạn (chung mọi tầng: cùng ranh, cùng lõi).
  const { khoang, tuong, catU } = chiaKhoang(ranh, ht, bbR, ts.dtKhoangMax, { v0: v0Luoi, mod: modDay });
  const thang = datThang(ranh, ht, khoang, tuong, thangLoi, [...loi, ...cot, ...ramVc, ...(ramTren ? [ramTren] : []), ...daiLan], { rong: ts.thangRong, dai: ts.thangDai, cuLy: ts.cuLyThoat }, toaLo.map((x) => x.chan));
  const thangThem = thang.filter((x) => x.nguon === 'them').map((x) => x.poly);

  // Chương trình phòng.
  const chanDs = toaLo.map((x) => x.chan);
  const toaPhong = toaLo.map(({ t, chan }) => {
    const dtxd = dtHop([chan]);
    const canh = Math.max(...chan.map((p, i) => { const q = chan[(i + 1) % chan.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); }));
    return { id: t.id, dtxd, soTang: t.soTangDH + t.soTangDe, khoiTich: dtxd * (t.soTangDH * t.caoDH + t.soTangDe * t.caoDe), daiHanhLangMm: canh * 1000 };
  });
  const ctPhong = chuongTrinhPhong({ soCan, danSo, soTangHam: soTang, dtSanHam: dtSan, caoTang: ts.caoTang, soKhoang: khoang.length, toa: toaPhong, ts });
  const phongCT = ts.tuDongPhong ? ctPhong.ds : [];

  // Đế (tầng 1) để tránh miệng gió.
  const coDe = toaLo.filter((x) => x.t.soTangDe > 0);
  const de = coDe.length ? khoiDeLo(lo, coDe.map((x) => x.chan), coDe.map((x) => x.t.deOffset ?? 0)).vung : [];
  const treTren = [...chanDs, ...de];

  // Cụm quạt + hộp gió mỗi khoang (cùng vị trí mọi tầng), sát tường ngoài, không dưới chân tháp / đế.
  const vcBoTri: Hcn[] = [...loi, ...cot, ...ramVc, ...(ramTren ? [ramTren] : []), ...thang.map((x) => x.poly), ...daiLan].map((p) => khungHeTruc(ht, p));
  const ongGio: OngGio[] = [];
  const thongGio: ThongGioKhoang[] = [];
  const cum: { khoang: number; hut: Diem[] | null; cap: Diem[] | null }[] = [];
  for (const k of khoang) {
    const V = k.dt * ts.caoTang;
    const qHut = LAN_HUT_KHOI * V, qCap = TY_LE_CAP * qHut;
    const dtOngThai = (soTang * qHut) / 3600 / GIO_TAM.vOng, dtOngCap = (soTang * qCap) / 3600 / GIO_TAM.vOng;
    const dtLouver = (soTang * (qHut + qCap)) / 3600 / GIO_TAM.vLouver / GIO_TAM.thongThoang;
    const D = Math.max(3, d);
    const dtPhong = (loai: LoaiPhong) => phongCT.find((p) => p.loai === loai && p.khoang === k.so)?.dt ?? 0;
    const wT = Math.max(1, dtOngThai / D), wC = Math.max(1, dtOngCap / D), wH = dtPhong('quatHut') / D, wP = dtPhong('quatCap') / D;
    const r = timChoSatTuong(ranh, ht, { u0: k.u0 + 0.5, u1: k.u1 - 0.5, v0: k.v0, v1: k.v1 }, wT + wH + wP + wC, D, vcBoTri,
      (x) => { const p = hcnUv(ht, x[0], x[1], x[2], x[3]); return treTren.some((c) => khungChong(p, c) && giaoNhau(p, c)); }, dayCho);
    if (r) {
      vcBoTri.push(r);
      let u = r[0];
      const doan = (w: number) => { const p = w > 0 ? hcnUv(ht, u, r[1], u + w, r[3]) : null; u += w; return p; };
      const thai = doan(wT)!, hut = doan(wH), cap = doan(wP), capOng = doan(wC)!;
      ongGio.push({ poly: thai, loai: 'thai', khoang: k.so, dt: dtOngThai }, { poly: capOng, loai: 'cap', khoang: k.so, dt: dtOngCap });
      cum.push({ khoang: k.so, hut, cap });
    }
    thongGio.push({ khoang: k.so, qHut, qCap, dtOngThai, dtOngCap, dtLouver, dtMoTuNhien: 0.002 * k.dt, daDat: !!r });
  }
  const polyCum = [...ongGio.map((g) => g.poly), ...cum.flatMap((c) => [c.hut, c.cap]).filter((p): p is Diem[] => !!p)];

  // Phòng rác cạnh lõi mỗi tòa (hầm 1).
  const rac: PhongDat[] = [];
  for (const m of phongCT.filter((p) => p.loai === 'rac')) {
    const loiCua = loiToa.filter((x) => x.toaId === m.toaId).map((x) => x.poly);
    const r = timChoCanhLoi(ranh, ht, loiCua, 3, m.dt / 3, vcBoTri);
    if (!r) continue;
    vcBoTri.push(r);
    const p = hcnUv(ht, r[0], r[1], r[2], r[3]);
    rac.push({ ma: m.ma, loai: 'rac', tang: 1, poly: [p], dt: dtHop([p]), dtYeuCau: m.dt });
  }

  const tamLoi = loiToa.map((x) => trongTam(x.poly));
  const sauKho = ts.rongKho > 0 ? ts.dtKho / ts.rongKho : 0;
  const tsKho = { choRong: ts.rongKho, choDai: sauKho, rongLan: ts.lanKho };
  const tsXM = { choRong: ts.xeMayRong, choDai: ts.xeMayDai, rongLan: ts.xeMayLan };

  const tang: KetQuaTangHam[] = [];
  for (let k = 1; k <= soTang; k++) {
    // Cột tòa chỉ chặn chỗ đỗ, không chặn làn (giả định lưới cột hầm đi theo dãy đỗ / chuyển tại sàn đế — chờ chủ nhiệm chốt).
    const coDinh: Diem[][] = [
      ...loi, ...ramVc, ...(k < soTang && ramTren ? [ramTren] : []), ...thangThem, ...polyCum, ...(k === 1 ? rac.flatMap((x) => x.poly) : []),
    ];
    const coDinhCot = [...coDinh, ...cot];
    let u = bb[0];
    // Dải kỹ thuật: phòng lớn của tầng (tự động) hoặc tỷ lệ cũ.
    const dsDai = phongCT.filter((p) => p.tang === k && p.nhom === 'dai');
    const dtDai = ts.tuDongPhong ? dsDai.reduce((a, p) => a + p.dt, 0) : ts.tyLeKyThuat * dtSan;
    let kt: { u1: number; manh: Diem[][] } = { u1: u, manh: [] };
    if (dtDai > 0) {
      let muc = dtDai * 1.15;
      for (let i = 0; i < 4; i++) {
        kt = catDai(ranh, goc, u, bb, muc);
        const dung = dtTru(kt.manh, coDinhCot);
        if (!ts.tuDongPhong || dung >= dtDai * 1.05 || kt.u1 >= bb[2]) break;
        muc *= (dtDai * 1.1) / Math.max(1, dung);
      }
    }
    u = kt.u1;
    const phongDai = ts.tuDongPhong ? chiaPhong(hieu(kt.manh, coDinhCot), ht, dsDai, k) : [];

    // Dải xe máy (tầng đã chọn): đủ số xe theo chỉ tiêu lô và ≥ 6 m²/căn (QCVN 04 2.2.17.1 b); ô tô xếp trước, xe máy riêng khu.
    let xm: { u1: number; manh: Diem[][] } = { u1: u, manh: [] };
    let choXeMay: Diem[][] = [];
    if (k === tangXeMay && (ts.dtXeMay != null || yeuCauCho.xeMay > 0 || yeuCau.xeMay > 0)) {
      const gop = ts.xeMayRong * (ts.xeMayDai + ts.xeMayLan / 2);
      let muc = Math.min(dtSan * 0.7, ts.dtXeMay ?? Math.max(yeuCauCho.xeMay * gop * 1.25, yeuCau.xeMay));
      for (let i = 0; i < 6; i++) {
        xm = catDai(ranh, goc, u, bb, muc);
        choXeMay = xm.manh.filter((p) => dtCoDau(p) > 0).flatMap((p) => raiChoDo(p, coDinhCot, tsXM, { goc, yeuCauLan: true }).cho);
        if (ts.dtXeMay != null || xm.u1 >= bb[2] || muc >= dtSan * 0.7) break;
        const dtCo = dtTru(xm.manh, [...loi, ...cot]);
        const thieuSo = yeuCauCho.xeMay / Math.max(1, choXeMay.length), thieuDt = yeuCau.xeMay / Math.max(1, dtCo);
        if (thieuSo <= 1 && thieuDt <= 1) break;
        muc = Math.min(dtSan * 0.7, muc * Math.max(1.02, Math.max(thieuSo, thieuDt) * 1.01));
      }
    }
    u = xm.u1;

    // Dải kho: bắt đầu từ DT ước tính, nới dần tới khi đủ số kho.
    let kh: { u1: number; manh: Diem[][] } = { u1: u, manh: [] };
    let kho: Diem[][] = [];
    if (ts.khoMoiTang > 0 && sauKho > 0) {
      let muc = Math.max(ts.khoMoiTang * ts.dtKho * (1 + ts.lanKho / (2 * sauKho)) * 1.25, ts.rongKho * 1.5 * (bb[3] - bb[1]));
      for (let lanThu = 0; lanThu < 10; lanThu++) {
        kh = catDai(ranh, goc, u, bb, muc);
        kho = [];
        for (const manh of kh.manh) {
          if (kho.length >= ts.khoMoiTang || dtCoDau(manh) <= 0) continue;
          kho.push(...raiChoDo(manh, coDinhCot, tsKho, { goc }).cho.slice(0, ts.khoMoiTang - kho.length));
        }
        if (kho.length >= ts.khoMoiTang || kh.u1 >= bb[2]) break;
        muc *= 1.3;
      }
    }
    u = kh.u1;

    // Khu ô tô: đường ngang hai đầu nối mọi làn thành vòng (không cụt); dải chỗ đỗ vuông góc ở đầu hầm không có dải chức năng.
    const duongNgang: [number, number][] = [];
    const daiDau: Diem[][] = [];
    let a1 = u;
    if (u <= bbR[0] + 0.01) { daiDau.push(hcnUv(ht, bbR[0] - 1, bb[1], bbR[0] + d, bb[3])); a1 = bbR[0] + d; }
    duongNgang.push([a1, a1 + lan]);
    const a2 = bbR[2] - d - lan;
    if (a2 >= a1 + 2 * lan + 2 * d - 1e-6) { duongNgang.push([a2, a2 + lan]); daiDau.push(hcnUv(ht, a2 + lan, bb[1], bbR[2] + 1, bb[3])); }
    const vcNgang = [...loi, ...thangThem, ...polyCum, ...(k === 1 ? rac.flatMap((x) => x.poly) : [])];
    const lanNgang = duongNgang.flatMap(([x0, x1]) => hieu(dai(ranh, goc, x0, x1, bb[1], bb[3]), vcNgang)).filter((p) => dtCoDau(p) > 0.5);
    const moO = (uu: number, vv: number) => { const w = ht.ve(uu, vv); return lanNgang.some((p) => diemTrong(w[0], w[1], p)); };
    const dung = ts.choRong + 0.1;
    const noiNgang: DuongNoi[] = duongNgang.map(([x0, x1]) => ({ r: [x0, bb[1], x1, bb[3]] as Hcn, mo: moO }));
    const vcOto: Diem[][] = [
      ...coDinh, hcnUv(ht, bbR[0] - 1, bb[1], u, bb[3]),
      ...duongNgang.map(([x0, x1]) => hcnUv(ht, x0, bb[1], x1, bb[3])), ...daiDau,
    ];
    const tuongCho = catU.map((uc) => hcnUv(ht, uc - 0.15, bb[1], uc + 0.15, bb[3]));
    const vcCung = [...coDinh, ...daiDau].map((p) => khungHeTruc(ht, p)); // vật cản cứng cho đoạn nối
    // Đầu làn cụt (lõi tòa, thang, phòng chắn ngang): mở đoạn nối ngắn sang làn kề (qua hai dãy chỗ) ngay trước vật cản → làn thành vòng.
    const noiThem: Hcn[] = [];
    let r = raiChoDo(ranh, vcOto, ts, { goc, yeuCauLan: true, vatCanCho: [...cot, ...tuongCho], lechV: [lechV], phatLan: (g) => demCutDuong(g, noiNgang, dung).so });
    for (let lanThu = 0; lanThu < 2; lanThu++) {
      const c0 = demCutDuong(r.lanUv ?? [], [...noiNgang, ...noiThem.map((x) => ({ r: x }))], dung);
      if (!c0.so) break;
      let moi = 0;
      for (const dc of c0.dau) {
        const u0 = dc.phia > 0 ? dc.u - lan : dc.u, u1 = u0 + lan;
        if (u1 - u0 < 1 || dc.lan[2] - dc.lan[0] < lan) continue;
        for (const huong of [1, -1]) {
          const vDich = dc.v + huong * modDay;
          const nr: Hcn = [u0, Math.min(dc.v, vDich) - lan / 2, u1, Math.max(dc.v, vDich) + lan / 2];
          if (vcCung.some((x) => x[0] < nr[2] - 0.05 && nr[0] < x[2] - 0.05 && x[1] < nr[3] - 0.05 && nr[1] < x[3] - 0.05)) continue;
          if (!namTrongRanh(hcnUv(ht, nr[0], nr[1], nr[2], nr[3]), ranh)) continue;
          // làn đích phải có ở khúc này (không bị lõi chặn)
          if (!(r.lanUv ?? []).some((x) => Math.abs((x[1] + x[3]) / 2 - vDich) < 0.1 && x[0] <= u0 + 0.1 && x[2] >= u1 - 0.1)) continue;
          noiThem.push(nr); moi++;
          break;
        }
      }
      if (!moi) break;
      const vcNoi = noiThem.map((x) => hcnUv(ht, x[0], x[1], x[2], x[3]));
      r = raiChoDo(ranh, vcOto, ts, { goc, yeuCauLan: true, vatCanCho: [...cot, ...tuongCho, ...vcNoi], lechV: [lechV],
        phatLan: (g) => demCutDuong(g, [...noiNgang, ...noiThem.map((x) => ({ r: x }))], dung).so });
    }
    // Dải đầu: chỗ quay vuông góc, vào thẳng từ đường ngang.
    const choDau: Diem[][] = [];
    for (const band of daiDau) {
      for (const p of giao([ranh], [band])) {
        if (dtCoDau(p) <= 0) continue;
        choDau.push(...raiChoDo(p, coDinhCot, ts, { goc: goc + Math.PI / 2 }).cho);
      }
    }
    const lanUv = r.lanUv ?? [];
    const cut = demCutDuong(lanUv, [...noiNgang, ...noiThem.map((x) => ({ r: x }))], dung);
    const lanNoi = noiThem.map((x) => hcnUv(ht, x[0], x[1], x[2], x[3]));
    // Đỉnh ram xuống tầng dưới phải nối làn (sát mép ram) hoặc đường ngang.
    let ramNoi: boolean | null = null;
    if (k < soTang && ramTren) {
      const [tu0, tv0, , tv1] = khungHeTruc(ht, ramTren);
      ramNoi = lanUv.some((x) => Math.abs(x[1] - tv1) < 0.3 && x[0] <= tu0 + 0.5 && x[2] >= tu0 + 1.5) || moO(tu0 - 0.5, (tv0 + tv1) / 2);
    }
    // Rèm / cửa ngăn cháy: làn cắt tường u; đường ngang / đoạn nối cắt tường v.
    const remChay: Diem[][] = [];
    for (const uc of catU) for (const x of lanUv) if (x[0] < uc - 0.2 && x[2] > uc + 0.2) remChay.push(hcnUv(ht, uc - 0.2, x[1], uc + 0.2, x[3]));
    for (const w of tuong) {
      if (w.huong !== 'v') continue;
      for (const x of [...duongNgang.map(([x0, x1]) => [x0, bb[1], x1, bb[3]] as Hcn), ...noiThem]) {
        if (x[1] < w.c && x[3] > w.c && x[0] < w.t1 && x[2] > w.t0) remChay.push(hcnUv(ht, Math.max(x[0], w.t0), w.c - 0.2, Math.min(x[2], w.t1), w.c + 0.2));
      }
    }

    const phongTang: PhongDat[] = [
      ...phongDai,
      ...cum.flatMap((c) => {
        const ds: PhongDat[] = [];
        const ph = (loai: LoaiPhong, p: Diem[] | null) => {
          const m = phongCT.find((x) => x.loai === loai && x.khoang === c.khoang && x.tang === k);
          if (p && m) ds.push({ ma: m.ma, loai, tang: k, poly: [p], dt: dtHop([p]), dtYeuCau: m.dt });
        };
        ph('quatHut', c.hut); ph('quatCap', c.cap);
        return ds;
      }),
      ...(k === 1 ? rac : []),
    ];
    const kyThuat = ts.tuDongPhong ? [...kt.manh, ...phongTang.filter((p) => !phongDai.includes(p)).flatMap((p) => p.poly)] : kt.manh;
    const daiKhac = [...kt.manh, ...xm.manh, ...kh.manh];
    const dtOto = dtTru([ranh], [...daiKhac, ...loi, ...cot, ...thangThem, ...polyCum, ...(k === 1 ? rac.flatMap((x) => x.poly) : [])]);
    const dtXeMay = dtTru(xm.manh, [...loi, ...cot]);
    const dtKyThuat = dtHop(kyThuat);
    const dtLoi = dtHop(giao([ranh], [...loi, ...cot, ...thangThem]));
    const cho = [...r.cho, ...choDau];
    tang.push({
      tang: k, dtSan, cho, xeLan: [], lan: [...r.lan, ...lanNgang, ...lanNoi], kho, xeMay: xm.manh, kyThuat, vungSac: [],
      soCho: cho.length, soXeLan: 0, soKho: kho.length, dtOto, dtXeMay, dtKyThuat, dtLoi, dtSacOto: 0,
      phong: phongTang, choXeMay, soXeMay: choXeMay.length, soSac: 0, lanNgang, cutDuong: cut.diem.map(([uu, vv]) => ht.ve(uu, vv)),
      remChay, ramThang: k < soTang ? ramTren : null, ramNoi,
    });
  }

  // Chỗ xe lăn: số theo QCVN 10:2024 Bảng 1 trên tổng chỗ, gần lõi thang máy, tầng trên trước.
  const tongTruoc = tang.reduce((a, x) => a + x.soCho, 0);
  const nXeLan = ts.xeLanTuDong ? soXeLanQCVN10(tongTruoc) : ts.choXeLan * soTang;
  yeuCauCho.xeLan = soXeLanQCVN10(tongTruoc);
  let conXeLan = nXeLan;
  for (const x of tang) {
    const n = ts.xeLanTuDong ? conXeLan : ts.choXeLan;
    if (n <= 0) continue;
    const { thuong, xeLan } = chonXeLan(x.cho, ht, n, 3.5, tamLoi);
    x.cho = thuong; x.xeLan = xeLan; x.soXeLan = xeLan.length; x.soCho = thuong.length + xeLan.length;
    conXeLan -= xeLan.length;
  }
  // Chỗ sạc ô tô: % tổng chỗ (dự thảo), ở tầng đã chọn, gần trạm biến áp (nguồn điện).
  const tongCho = tang.reduce((a, x) => a + x.soCho, 0);
  const xd = ts.xeDien;
  yeuCauCho.sac = Math.ceil(((xd.tyLeOto ?? 10) / 100) * tongCho);
  let nSac = 0;
  if (xd.bat) {
    const x = tang.find((t) => t.tang === xd.tang);
    if (x) {
      nSac = Math.min(x.cho.length, xd.choOto > 0 ? xd.choOto : yeuCauCho.sac);
      const tba = x.phong.find((p) => p.loai === 'tba' && p.poly.length);
      const goc1 = tba ? trongTam(tba.poly[0]) : x.kyThuat.length ? trongTam(x.kyThuat[0]) : ranh[0];
      x.vungSac = chonSac(x.cho, nSac, goc1, xd.vungOto);
      x.soSac = nSac;
      x.dtSacOto = x.soCho > 0 ? (nSac * x.dtOto) / x.soCho : 0;
    }
  }

  const cong = (f: (x: KetQuaTangHam) => number) => tang.reduce((a, x) => a + f(x), 0);
  const tong = {
    dtSan: cong((x) => x.dtSan), soCho: cong((x) => x.soCho), soXeLan: cong((x) => x.soXeLan), soKho: cong((x) => x.soKho),
    dtOto: cong((x) => x.dtOto), dtXeMay: cong((x) => x.dtXeMay), dtKyThuat: cong((x) => x.dtKyThuat), dtLoi: cong((x) => x.dtLoi),
    soXeMay: cong((x) => x.soXeMay), soSac: cong((x) => x.soSac), soCutDuong: cong((x) => x.cutDuong.length),
  };
  const tyLe = tong.dtSan > 0
    ? { doXe: (tong.dtOto + tong.dtXeMay) / tong.dtSan, kyThuat: (tong.dtKyThuat + tong.dtLoi) / tong.dtSan }
    : { doXe: 0, kyThuat: 0 };

  // Tầng 1: chân tháp / đế, miệng ram + đoạn thẳng, đường vào, thang ra, miệng gió, cảnh quan.
  const diemVao = ramTren ? trongTam(ramTren) : ram?.dinh ?? null;
  const gd = diemVao ? ganDuong(lo, diemVao) : null;
  const duongVao: [Diem, Diem] | null = diemVao && gd ? [diemVao, gd.diem] : null;
  const rongRam = ts.ram.rong + (ts.ram.coNguoiDi ? ts.ram.viaHe : 0);
  const daiDuong = duongVao && gd!.kc > 0.1 ? (() => {
    const [p, q] = duongVao, l = gd!.kc, nx = -(q[1] - p[1]) / l, ny = (q[0] - p[0]) / l, w = rongRam / 2;
    return [[p[0] + nx * w, p[1] + ny * w], [q[0] + nx * w, q[1] + ny * w], [q[0] - nx * w, q[1] - ny * w], [p[0] - nx * w, p[1] - ny * w]] as Diem[];
  })() : null;
  const gioDuoiToa = ongGio.filter((g) => treTren.some((c) => giaoNhau(g.poly, c))).length;
  const ramMo = ram?.doc ?? ram?.poly ?? null;
  const t1: KetQuaTang1 = {
    chan: chanDs, de, ramMo, ramThang: ramTren, duongVao, kcDuong: gd ? gd.kc : null,
    thangRa: thangThem, miengGio: ongGio, gioDuoiToa, thangDuoiToa: thangThem.filter((p) => treTren.some((c) => khungChong(p, c) && giaoNhau(p, c))).length, dtLo: dtHop([lo.ranh]),
    dtCanhQuan: dtTru([lo.ranh], [...chanDs, ...de, ...(ramMo ? [ramMo] : []), ...(ramTren ? [ramTren] : []), ...(daiDuong ? [daiDuong] : []), ...thangThem, ...ongGio.map((g) => g.poly)]),
  };

  const QC04 = 'QCVN 04:2021/BXD';
  const QC13 = 'QCVN 13:2018/BXD';
  const DT0711 = 'QCVN 07-11:2025/BXD (dự thảo)';
  const khoangLon = khoang.reduce((a, k) => Math.max(a, k.dt), 0);
  const loiRaMin = khoang.length ? Math.min(...khoang.map((k) => k.thang.length)) : 0;
  const cuLyMax = khoang.reduce((a, k) => Math.max(a, k.cuLyMax), 0);
  const soLanRam = rongRam >= 6 ? 2 : 1;
  const canLanRam = tongCho <= 100 ? 1 : tongCho <= 1000 ? 2 : 4;
  const ramNoiThieu = tang.filter((x) => x.ramNoi === false).length;
  const kiem: KiemHam[] = [
    dongKiem('dtDoXe', soCan ? tong.dtOto + tong.dtXeMay : null, soCan ? yeuCau.tong : null, '>=', { donVi: 'm²', canCu: `${QC04} 2.2.17.1 ${ts.garaCoKhi ? 'd)' : noxh ? 'b), c)' : 'b)'}` }),
    dongKiem('dtXeMay', soCan ? tong.dtXeMay : null, soCan ? yeuCau.xeMay : null, '>=', { donVi: 'm²', canCu: `${QC04} 2.2.17.1 b)` }),
    dongKiem('choOto', soCan ? tong.soCho : null, soCan ? yeuCauCho.oto : null, '>=', { canCu: 'QH' }),
    dongKiem('soXeMay', soCan ? tong.soXeMay : null, soCan ? yeuCauCho.xeMay : null, '>=', { canCu: 'QHXM' }),
    dongKiem('xeLan', tong.soXeLan, yeuCauCho.xeLan, '>=', { canCu: 'QCVN 10:2024/BXD 2.1.1, Bảng 1', khongSat: true }),
    dongKiem('choDai', ts.choDai, 5, '>=', { donVi: 'm', canCu: `${QC13} 2.2.1.25`, thapPhan: 2 }),
    dongKiem('choRong', ts.choRong, 2.3, '>=', { donVi: 'm', canCu: `${QC13} 2.2.1.25`, thapPhan: 2 }),
    dongKiem('thongThuy', ts.caoTang - ts.dayKetCau, 2, '>=', { donVi: 'm', canCu: `${QC04} 2.2.10`, thapPhan: 2 }),
    dongKiem('cutDuong', tong.soCutDuong, 0, '<=', { canCu: 'Nguyên tắc nội bộ: làn xe nối vòng, không cụt (tham khảo hồ sơ)', khongSat: true }),
    dongKiem('ramNoi', ramNoiThieu, 0, '<=', { canCu: 'Nguyên tắc nội bộ: đỉnh ram xuống tầng dưới nối làn', khongSat: true }),
    dongKiem('khoangDt', khoang.length ? khoangLon : null, ts.dtKhoangMax, '<=', { donVi: 'm²', canCu: `${QC13} 2.2.2 a), Bảng 4` }),
    dongKiem('khoangLoiRa', khoang.length ? loiRaMin : null, 2, '>=', { canCu: `${QC13} 2.2.1.14; QCVN 06:2022/BXD 3.2.6.1`, khongSat: true }),
    dongKiem('khoangCuLy', khoang.length ? cuLyMax : null, ts.cuLyThoat, '<=', { donVi: 'm', canCu: `${QC13} Bảng 3 (ngầm)`, thapPhan: 1 }),
    dongKiem('gioKhoang', thongGio.filter((g) => !g.daDat).length, 0, '<=', { canCu: `${QC13} 2.3.3.4; QCVN 06:2022/BXD D.2 h)`, khongSat: true }),
    dongKiem('soLanRam', soLanRam, canLanRam, '>=', { canCu: `${QC13} 2.2.1.11`, khongSat: true }),
    dongKiem('rongLan', ts.rongLan, 6, '>=', { donVi: 'm', canCu: `${DT0711} 2.4.3.4`, thapPhan: 1, duThao: true }),
    ...kiemRam(ts.ram, ts.caoTang),
    ...(soCan ? [dongKiem('qSinhHoat', ts.qSinhHoat, 80, '>=', { donVi: 'L', canCu: 'QCVN 01:2021/BXD 2.10.2', khongSat: true })] : []),
    ...(xd.bat ? [dongKiem('sacOto', nSac, yeuCauCho.sac, '>=', { canCu: `${DT0711} 2.3.5`, duThao: true, khongSat: true })] : []),
    ...(xd.bat ? kiemXeDien({ ...xd, choOto: nSac }, tang.find((x) => x.tang === xd.tang)?.dtSacOto ?? 0) : []),
  ];
  return {
    ts, ranh, loi, cot, ram, tang, soCan, dtsd, noxh, yeuCau, tong, tyLe, kiem,
    danSo, yeuCauCho, phongCT: ts.tuDongPhong ? ctPhong.ds : [], soLieuPhong: ctPhong.soLieu, khoang, tuongChay: tuong.map((w): [Diem, Diem] => [w.a, w.b]), thang, ongGio, thongGio, t1,
  };
}

/* ---------- Vẽ tay ranh hầm, khối hầm 3D ---------- */

/** Điểm gần nhất trong `ds` cách `p` không quá `banKinh` (m); không có thì null. Dùng bắt điểm vào đỉnh ranh lô / chỉ giới. */
export function batDiemRanh(p: Diem, ds: Diem[], banKinh: number): Diem | null {
  let tot: Diem | null = null, dMin = banKinh;
  for (const q of ds) {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d <= dMin) { dMin = d; tot = q; }
  }
  return tot;
}

/** Điểm cách `a` đúng `d` mét theo hướng từ `a` tới `huong`; hướng trùng `a` thì null. */
export function diemTheoDoDai(a: Diem, huong: Diem, d: number): Diem | null {
  const dx = huong[0] - a[0], dy = huong[1] - a[1], l = Math.hypot(dx, dy);
  if (l < 1e-9 || !(d > 0)) return null;
  return [a[0] + (dx / l) * d, a[1] + (dy / l) * d];
}

const catNhau = (a: Diem, b: Diem, c: Diem, d: Diem): boolean => {
  const ccw = (p: Diem, q: Diem, r: Diem) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return ccw(a, b, c) * ccw(a, b, d) < 0 && ccw(c, d, a) * ccw(c, d, b) < 0;
};

/**
 * Đóng đa giác ranh vừa vẽ: bỏ đỉnh trùng liên tiếp (và đỉnh cuối trùng đỉnh đầu), đưa về ngược chiều kim đồng hồ.
 * Trả null nếu < 3 đỉnh, diện tích < 1 m² hoặc có hai cạnh không kề cắt nhau.
 */
export function dongRanhVe(pts: Diem[]): Diem[] | null {
  const p: Diem[] = [];
  for (const q of pts) { const l = p[p.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) p.push(q); }
  while (p.length > 1 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) <= 1e-6) p.pop();
  if (p.length < 3) return null;
  const dt = dtCoDau(p);
  if (Math.abs(dt) < 1) return null;
  const n = p.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (catNhau(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return null;
    }
  }
  return dt < 0 ? p.slice().reverse() : p;
}

/** Khối hầm 3D (mét): ranh, cốt đỉnh 0, cốt đáy âm, cốt sàn từng tầng (từ đỉnh xuống). */
export function khoiHam(ranh: Diem[], soTang: number, caoTang: number): { ranh: Diem[]; yDuoi: number; yTang: number[] } | null {
  const n = Math.round(soTang);
  if (ranh.length < 3 || n < 1 || !(caoTang > 0)) return null;
  return { ranh, yDuoi: -n * caoTang, yTang: Array.from({ length: n + 1 }, (_, i) => -i * caoTang) };
}
