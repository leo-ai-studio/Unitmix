/**
 * Tự chỉnh mặt bằng tầng như app cũ MDI_Unitmix_v4 (prototype/shell.src.html: regenerate · datThangBo · sanhLoi ·
 * ganTrucSanh / capNhatTrucSanh · donHubLoi), bật mặc định, chạy lại sau mỗi lần đổi căn / STRETCH / tối ưu:
 *  - XC-03 (QT-10 · QT-60) ô thang bộ rộng 3.000 mm: hút khe ≤ 600 mm hai bên vào ô; ô thiếu thì nới, căn phía sau dồn theo.
 *  - XC-05 (QT-22b · QT-56) căn quanh lõi khít nét bao lõi MDI-BAO-TM: dải lõi chiếu lên từng mặt làm MỐC dồn khít,
 *    đo chồng / hở giữa khung mô-đun căn và nét bao; hở / đè quá tường chung thì dời đoạn căn về khít (đầu tự do co / giãn theo);
 *    đoạn kẹp (không đầu tự do) dời trong khoảng giữa hai mốc, thiếu / thừa thì STRETCH QT-81 (khitKepLoi).
 *  - XC-06 (QT-72) sảnh thang máy NOTM 3,0 m · NOXH 2,6 m (phân loại ở 2.800 mm): đo sảnh trên nét tường lõi, nét hành lang
 *    nối xuyên lõi dời về tim sảnh.
 *  - XC-07 (QT-19 · QT-25 · QT-51 · QT-54) hành lang liền qua góc, vuông góc: kiểm đồ thị liền, kéo trục tới cửa xa nhất.
 *  - PC-11 (QT-44 · QT-63) thang bộ tự động: dời / thêm thang cạnh căn xa lối thoát nhất (đo thật bằng tinh/pccc.ts),
 *    còn căn vượt thì dò rộng như datThangBo app cũ: thêm ở mọi đoạn, CHUYỂN thang sang mặt / đoạn khác, dời đôi khi kẹt;
 *    rồi cắt bớt thang thừa theo thứ tự cố định, giữ ≥ 2 thang. Tầng có bố cục riêng tự chỉnh riêng (tuChinhToa).
 *
 * Mẫu tòa trong thư viện không đổi. Kết quả là `MatBangSua` lưu trong `ToaDat.matBang` (hoàn tác qua kho.sua);
 * `apMatBang` dựng "mẫu tòa hiệu dụng" (mặt đã dời căn / thang, dải lõi, nét bao, hành lang) cho mọi chỗ vẽ, đếm, kiểm.
 * Hàm thuần, toạ độ mm như toa.json.
 */
import { LOAI_CAN, type BaoCaoGiamCan, type BaoCaoKhitKep, type BaoCaoTuChinh, type CongNangO, type Diem, type DoanHanhLangMB, type KetQuaTuChinh, type LoaiCan, type MatBangSua, type SanhMB, type ThangBoMB, type ThangTay, type ThangTayThem, type ThayDoiTuDong, type ThuVien, type ToaDat } from './kieu';
import { KHE_HL_THEM_MM, KHE_TUONG_MM, kheTrenMat, tongKhe, TUONG_CHUNG_LOI_MM } from './khe';
import { netBaoTheoO, NOI_MAT_MM, soChongKhung, suaHocLogia } from './netBao';
import { boCucTang, canDangDung, chenhRong, congNangTai, doanCan, donKhit, ghiDeTang, KHIT_MM, khungTaiO, matDaDon, tangCoRieng, veLoiTaiViTri, viTriCan, type BoCuc, type ToaCoMat } from './matBang';
import { dtHanhLangTang } from './phanChung';
import { chieuCaoPCCC, cuaTrenMat, dungDoThi, gioiHanThoatNan, thoatNan, TIM_CUA_THANG_MM, type MatToa, type PhanTuMat, type ToaPCCC } from './pccc';
import { maBienThe, ST_BUOC as ST_BUOC_MM, ST_MAX, tachMa } from './stretch';
import { cuaBienThe } from './toiUu';

// ---------- hằng số (app cũ) ----------
/** XC-03 · QT-10: ô thang bộ luôn rộng 3.000 mm (STAIR_W). */
export const O_THANG_MM = 3000;
/** XC-03 · QT-10: khe ≤ 600 mm hai bên được hút vào ô thang. */
export const KHE_HUT_MM = 600;
/** Chiều sâu bay chuẩn của thư viện căn (BAY). */
export const BAY_MM = 8500;
/** XC-05 · QT-22b: chồng ≤ 200 mm giữa khung căn và nét bao lõi = tường chung (TUONG_CHUNG_MM). Hở ≤ 200 mm cũng coi là khít:
 * CAD gốc có căn hở 150–165 mm (tường căn dày 150 chạm nét bao) — phía hở là giá trị tạm, chờ chủ nhiệm chốt. */
export const TUONG_CHUNG_MM = 200;
/** Dải lõi chiếu lên mặt lệch quá 1 m so với căn kề = lõi hub chéo (T · V · Y), không đo theo mặt — giá trị tạm, chờ chủ nhiệm chốt. */
export const LECH_DAI_LOI_MM = 1000;
/** XC-06 · QT-72: sảnh thang máy NOTM 3,0 m, NOXH / tái định cư 2,6 m; phân loại lõi theo bề rộng sảnh ở 2.800 mm. */
export const SANH_MM = { tm: 3000, xh: 2600 } as const;
export const SANH_PHAN_LOAI_MM = 2800;
/** QT-72: nét hành lang qua sảnh cách tim sảnh ≤ 100 mm là đúng nét CAD; lệch hơn thì dời về tim. */
export const TRUC_SANH_SAI_MM = 100;
/** PC-11 · QT-44: 2–3 thang (GEN_THANG app cũ), tối đa 8 lượt dò. */
export const THANG_MIN = 2;
export const THANG_MAX = 3;
export const LUOT_MAX = 8;
/** PC-11: số lượt dò rộng (thêm / chuyển thang sang mặt khác, như datThangBo app cũ: GEN_THANG.LAP = 3). */
export const LUOT_RONG = 4;
/** Khối thang bộ mặc định và nửa bề ngang khung tường của nó (x_tb_n3: bao −100…3.030 → giữa 1.465; app cũ chenThang). */
export const THANG_KHOI = 'x_tb_n3';
const THANG_GIUA_MM = 1465;

// ---------- loại thang bộ N2 / N3 (QT-63 app cũ: loại của TỪNG ô, bao / điểm chèn / cửa hành lang giống nhau) ----------
/** Thang N3 (có buồng đệm) và N2 (không buồng đệm) của thư viện — cùng khung bao [−100…3.030] × [0…8.500]. */
export const THANG_N3 = THANG_KHOI;
export const THANG_N2 = 'x_tb_n2';
export type LoaiThangBo = typeof THANG_N2 | typeof THANG_N3;
export const laLoaiThang = (b: unknown): b is LoaiThangBo => b === THANG_N2 || b === THANG_N3;

/**
 * Quy tắc thang bộ MỌI tòa / MỌI phương án (chủ nhiệm 2026-10-29): 2–3 thang (mặc định 2), luôn có ít nhất MỘT N2 và MỘT N3.
 * Loại theo lựa chọn tay `chon` (khoá thang → loại, `ToaDat.loaiThang`); thang chưa chọn là N3, rồi nếu chưa có N2 thì thang thứ hai
 * theo thứ tự (mặt, vị trí) — không phải thang chọn tay — thành N2; chưa có N3 thì tương tự. Chỉ đổi `block` (ô 3.000 mm, điểm chèn
 * giữ nguyên nên không căn nào xê dịch, DTXD không đổi). Trả mảng mới (đối tượng thang đổi loại được chép), không đổi `ds`.
 */
export function ganLoaiThang(ds: readonly ThangBoMB[], chon?: Readonly<Record<string, string>> | null): ThangBoMB[] {
  const thu = [...ds.keys()].sort((i, j) => ds[i].matIdx - ds[j].matIdx || ds[i].a0 - ds[j].a0);
  const coChon = (i: number) => laLoaiThang(chon?.[ds[i].khoa]);
  const loai: string[] = ds.map((t) => (laLoaiThang(chon?.[t.khoa]) ? chon![t.khoa] : THANG_N3));
  const bu = (can: LoaiThangBo, uuTien: number) => {
    if (ds.length < 2 || loai.includes(can)) return;
    // thang chưa chọn tay, gần vị trí ưu tiên nhất (thứ tự mặt rồi vị trí); hết thì đành đổi thang chọn tay cuối cùng
    const ung = thu.filter((i) => !coChon(i)), ds2 = ung.length ? ung : [...thu].reverse();
    const k = ds2.slice().sort((a, b) => Math.abs(thu.indexOf(a) - uuTien) - Math.abs(thu.indexOf(b) - uuTien))[0];
    if (k !== undefined) loai[k] = can;
  };
  bu(THANG_N2, 1);
  bu(THANG_N3, 0);
  return ds.map((t, i) => (t.block === loai[i] ? t : { ...t, block: loai[i] }));
}
/** Đếm loại thang: số thang, số N2, số N3 (khối khác — lõi tmdv… — không tính loại). */
export const demLoaiThang = (ds: readonly ThangBoMB[]) =>
  ({ so: ds.length, n2: ds.filter((t) => t.block === THANG_N2).length, n3: ds.filter((t) => t.block === THANG_N3).length });
/** Tập thang đúng quy tắc: 2 ≤ số ≤ 3, có N2 và N3. */
export const thangDungLuat = (ds: readonly ThangBoMB[]) => { const d = demLoaiThang(ds); return d.so >= THANG_MIN && d.so <= THANG_MAX && d.n2 > 0 && d.n3 > 0; };
/**
 * Gỡ căn vượt cự ly (app cũ giamCanThoatNan): ô không có người ở thường xuyên (phòng kỹ thuật, ô trống, căn bỏ) không đo cự ly
 * thoát nạn — QCVN 06 đo từ cửa CĂN HỘ; coi phòng kỹ thuật như vậy là giá trị tạm, chờ chủ nhiệm chốt. SHCĐ / thương mại vẫn đo.
 */
export const KHONG_KIEM_TN: ReadonlySet<CongNangO> = new Set<CongNangO>(['ky_thuat', 'trong', 'bo']);
/** Ô căn vượt cự ly đổi thành công năng này khi không bỏ được (giá trị tạm, chờ chủ nhiệm chốt). */
export const O_DOI_THOAT_NAN: CongNangO = 'ky_thuat';
/** Số lượt gỡ căn tối đa mỗi tầng (mỗi lượt đổi / bỏ một căn) và số lượt xếp lại giữ cơ cấu — giá trị tạm, chờ chủ nhiệm chốt. */
export const LUOT_GIAM_MAX = 8;
export const LUOT_XEP_LAI = 6;
/** Hình lõi không có hướng sảnh thẳng xuyên lõi (hub chéo, chữ T) — app cũ QT-72 không đo, phân loại theo dòng khối. */
const HINH_HUB = new Set(['t', 'v', 'y']);

// ---------- kiểu ----------
export type HinhLoiMB = { bao_tm?: Diem[]; bao_tuong_mm?: number[]; paths?: { cat: string; pts: Diem[] }[] };
/** Dữ liệu tải trước cho tự chỉnh: hình lõi theo tên khối (x_…), tim cửa căn theo ma_goc (tinhCuaCan). */
export type DuLieuMB = { loi: Map<string, HinhLoiMB>; cuaCan: Record<string, number> };
/** Mẫu tòa có mặt + các trường đồ thị hành lang của toa.json. */
export type ToaMB = ToaCoMat & Partial<Pick<ToaPCCC, 'truc' | 'hanhlang_ve' | 'hanh_lang' | 'cua_thang'>>;
export type DaiLoi = { khoaLoi: string; block: string; matIdx: number; t0: number; t1: number };

// ---------- hình học ----------
const rad = (d: number) => (d * Math.PI) / 180;
function coSo(gocDeg: number, truc: number) {
  const u: Diem = [Math.cos(rad(gocDeg)), Math.sin(rad(gocDeg))];
  const n: Diem = [-u[1], u[0]];
  return {
    u, n,
    pt: (a: number, b: number): Diem => [u[0] * a + n[0] * (truc + b), u[1] * a + n[1] * (truc + b)],
    ab: (p: Diem): Diem => [p[0] * u[0] + p[1] * u[1], p[0] * n[0] + p[1] * n[1] - truc],
  };
}
const kc = (a: Diem, b: Diem) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dtDG = (P: Diem[]) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const trongDG = (p: Diem, P: Diem[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
/** Cắt đa giác theo nửa mặt phẳng f(p) ≥ 0 (Sutherland–Hodgman). */
function catNua(P: Diem[], f: (p: Diem) => number): Diem[] {
  const R: Diem[] = [];
  for (let i = 0; i < P.length; i++) {
    const A = P[i], B = P[(i + 1) % P.length], fa = f(A), fb = f(B);
    if (fa >= 0) R.push(A);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); R.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]); }
  }
  return R;
}
const laMatThat = (m: MatToa) => m.a_cuoi - m.a_dau > 1;

// ---------- lõi: dải trên mặt (XC-05), sảnh (XC-06) ----------
const daGiacLoi = (K: HinhLoiMB): Diem[] | null => {
  if (K.bao_tm?.length) return K.bao_tm;
  const b = K.bao_tuong_mm;
  return b && b.length === 4 ? [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]] : null;
};

/** Đa giác khung tường các lõi của mẫu (mm thế giới) — ô đặc khi dựng / kiểm nét bao. */
export function daGiacCacLoi(mau: ToaMB, dl: DuLieuMB | null | undefined): Diem[][] {
  if (!dl) return [];
  const kq: Diem[][] = [];
  for (const { q } of dsLoi(mau)) {
    const K = dl.loi.get(q.block), P = K && daGiacLoi(K);
    if (P) kq.push(veLoiTaiViTri([{ cat: 'b', pts: P }], q)[0].pts);
  }
  return kq;
}

/** Các lõi của mẫu (bỏ lượt chèn lặp như app cũ: cùng khối, lệch < 50 mm). */
export function dsLoi(mau: ToaMB): { khoa: string; matIdx: number; q: PhanTuMat }[] {
  const kq: { khoa: string; matIdx: number; q: PhanTuMat }[] = [];
  mau.mat.forEach((m, mi) => m.phan_tu.forEach((q, i) => {
    if (q.loai !== 'loi' || q.bang) return;
    if (kq.some((o) => o.q.block === q.block && Math.abs(o.q.x - q.x) < 50 && Math.abs(o.q.y - q.y) < 50)) return;
    kq.push({ khoa: q.khoa ?? `${mi}:${i}`, matIdx: mi, q });
  }));
  return kq;
}

/** Dải lõi trên từng mặt: nét bao MDI-BAO-TM (thiếu thì khung tường) cắt theo dải bay [0, 8.500] của mặt; chồng ≥ 2 m mới tính. */
export function daiLoi(mau: ToaMB, dl: DuLieuMB | null | undefined): DaiLoi[] {
  if (!dl) return [];
  const kq: DaiLoi[] = [];
  for (const { khoa, q } of dsLoi(mau)) {
    const K = dl.loi.get(q.block), P = K && daGiacLoi(K);
    if (!P) continue;
    const W = veLoiTaiViTri([{ cat: 'b', pts: P }], q)[0].pts;
    mau.mat.forEach((m, mi) => {
      if (!laMatThat(m)) return;
      const B = coSo(m.goc_deg, m.truc_mm);
      let c = catNua(W.map(B.ab), (p) => p[1] - 1);
      c = catNua(c, (p) => BAY_MM - 1 - p[1]);
      if (c.length < 3) return;
      const b0 = Math.min(...c.map((p) => p[1])), b1 = Math.max(...c.map((p) => p[1]));
      if (b1 - b0 < 2000) return;
      const t0 = Math.min(...c.map((p) => p[0])), t1 = Math.max(...c.map((p) => p[0]));
      // lõi hub chéo (T · V · Y) chiếu lên mặt có thể trùm căn vẽ đúng CAD hàng mét: không coi là dải của mặt này
      const trum = Math.max(0, ...m.phan_tu.filter((x) => x.rong_mm > 0 && !x.bang).map((x) => Math.min(x.a1, t1) - Math.max(x.a0, t0)));
      if (trum > LECH_DAI_LOI_MM) return;
      kq.push({ khoaLoi: khoa, block: q.block, matIdx: mi, t0, t1 });
    });
  }
  return kq;
}

/**
 * Sảnh = dải trống xuyên hết chiều sâu khối lõi (app cũ `sanhLoi`): quét x = const bước 25 mm trong khung tường, bỏ 200 mm
 * hai mép; dải liền ≥ 1.000 mm rộng nhất. Trả toạ độ khối (x0, x1, bề rộng, tim) hoặc null.
 */
export function doSanh(K: HinhLoiMB): { x0: number; x1: number; w: number; tim: number } | null {
  const b = K.bao_tuong_mm;
  if (!b || b.length !== 4 || !K.paths) return null;
  const W = K.paths.filter((p) => p.cat === 'wall').map((p) => p.pts);
  const [x0, y0, x1, y1] = b, yA = y0 + 200, yB = y1 - 200, BUOC = 25;
  const cat = (x: number) => W.some((pts) => {
    for (let k = 0; k + 1 < pts.length; k++) {
      const p = pts[k], q = pts[k + 1];
      if ((p[0] - x) * (q[0] - x) < 0) { const y = p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0]); if (y > yA && y < yB) return true; }
    }
    return false;
  });
  let tot: { x0: number; x1: number; w: number; tim: number } | null = null, st: number | null = null;
  for (let x = x0 + 50; x <= x1 - 50 + 1e-6; x += BUOC) {
    const trong = !cat(x), cuoi = x + BUOC > x1 - 50 + 1e-6;
    if (trong && st == null) st = x;
    if (st != null && (!trong || cuoi)) {
      const e = trong ? x : x - BUOC;
      if (e - st >= 1000 && (!tot || e - st > tot.w)) tot = { x0: st, x1: e, w: e - st, tim: (st + e) / 2 };
      st = null;
    }
  }
  return tot;
}

/** Sảnh của từng lõi: đo thẳng (tòa I · L · U · Z), lõi hub T · V · Y thì phân loại theo dòng khối (x_xh_… = NOXH). */
export function sanhCuaToa(mau: ToaMB, dl: DuLieuMB | null | undefined): SanhMB[] {
  if (!dl) return [];
  return dsLoi(mau).map(({ khoa, q }) => {
    const K = dl.loi.get(q.block), s = K && !HINH_HUB.has(mau.hinh) ? doSanh(K) : null;
    return { khoaLoi: khoa, block: q.block, rong: s ? Math.round(s.w) : null, loai: s ? (s.w >= SANH_PHAN_LOAI_MM ? 'tm' : 'xh') : /^x_xh_/.test(q.block) ? 'xh' : 'tm' };
  });
}

// ---------- mặt bằng hiệu dụng ----------
export const banSaoMatBang = (mb: MatBangSua): MatBangSua => ({
  ...mb,
  thangBo: mb.thangBo.map((t) => ({ ...t })),
  dich: { ...(mb.dich ?? {}) },
  neo: mb.neo ? { ...mb.neo } : undefined,
  mep: Object.fromEntries(Object.entries(mb.mep ?? {}).map(([k, v]) => [k, [v[0], v[1]] as [number, number]])),
  duongBao: mb.duongBao?.map((p): Diem => [p[0], p[1]]),
  hanhLang: mb.hanhLang.map((s) => ({ ...s, p0: [s.p0[0], s.p0[1]], p1: [s.p1[0], s.p1[1]] })),
  hanhLangThem: mb.hanhLangThem?.map((pl) => pl.map((p): Diem => [p[0], p[1]])),
  boCan: mb.boCan ? [...mb.boCan] : undefined,
});

const mepMat = (mau: ToaMB, mb: MatBangSua, mi: number): [number, number] => mb.mep?.[mi] ?? [mau.mat[mi].a_dau, mau.mat[mi].a_cuoi];

const nhoApDung = new WeakMap<MatBangSua, { mau: ToaMB; dl: DuLieuMB | null | undefined; kq: ToaMB }>();

/**
 * Mẫu tòa hiệu dụng: căn dời theo `dich`, thang bộ theo `thangBo` (thay thang của mẫu), dải lõi (XC-05) thêm làm mốc,
 * mép mặt, nét bao, hành lang theo `mb`. Khoá vị trí căn / lõi giữ nguyên ("mặt:chỉ số" của mẫu) qua trường `khoa`.
 */
export function apMatBang<T extends ToaMB>(mau: T, mb: MatBangSua, dl?: DuLieuMB | null): T {
  const nho = nhoApDung.get(mb);
  if (nho && nho.mau === mau && nho.dl === dl) return nho.kq as T;
  const kq = dung(mau, mb, dl);
  nhoApDung.set(mb, { mau, dl, kq });
  return kq;
}

/** Như apMatBang nhưng không nhớ (dùng trong lúc dò, `mb` còn bị sửa tại chỗ). */
function dung<T extends ToaMB>(mau: T, mb: MatBangSua, dl?: DuLieuMB | null): T {
  const dai = daiLoi(mau, dl);
  const mat: MatToa[] = mau.mat.map((m, mi) => {
    const [aDau, aCuoi] = mepMat(mau, mb, mi);
    const B = coSo(m.goc_deg, m.truc_mm);
    const pt: PhanTuMat[] = [];
    m.phan_tu.forEach((q, i) => {
      const khoa = `${mi}:${i}`;
      if (q.loai === 'thang_bo') return;
      if (q.loai === 'can') {
        if (mb.boCan?.includes(khoa)) return; // căn bỏ (giamCanThoatNan): không dựng
        const d = mb.dich?.[khoa] ?? 0;
        pt.push({ ...q, khoa, a0: q.a0 + d, a1: q.a1 + d, x: q.x + B.u[0] * d, y: q.y + B.u[1] * d, ...(mb.neo?.[khoa] ? { neo: mb.neo[khoa] } : {}) } as PhanTuMat);
      } else pt.push({ ...q, khoa });
    });
    for (const t of mb.thangBo) {
      if (t.matIdx !== mi) continue;
      const p = B.pt(t.a0 + t.dIns, t.bIns);
      pt.push({ loai: 'thang_bo', ma: t.block, block: t.block, ma_thu_vien: null, a0: t.a0, a1: t.a0 + t.rong, rong_mm: t.rong, sau_mm: BAY_MM, x: p[0], y: p[1], rot: m.goc_deg, sx: t.sx, sy: 1, khoa: t.khoa });
    }
    for (const d of dai) {
      if (d.matIdx !== mi) continue;
      const p = B.pt((d.t0 + d.t1) / 2, 0);
      pt.push({ loai: 'loi', bang: true, ma: d.block, block: d.block, ma_thu_vien: null, a0: d.t0, a1: d.t1, rong_mm: d.t1 - d.t0, sau_mm: null, x: p[0], y: p[1], rot: m.goc_deg, sx: 1, sy: 1, khoa: `${d.khoaLoi}@${mi}` });
    }
    return { ...m, a_dau: aDau, a_cuoi: aCuoi, phan_tu: pt };
  });
  const duong_bao = mb.duongBao ?? mau.duong_bao;
  const kq: T = {
    ...mau,
    mat,
    duong_bao,
    dtxd_m2: mb.duongBao ? Math.round(dtDG(duong_bao) / 1e4) / 100 : mau.dtxd_m2,
    hanh_lang: mb.hanhLang.length ? mb.hanhLang : mau.hanh_lang,
    hanhlang_ve: [...(mau.hanhlang_ve ?? []), ...(mb.hanhLangThem ?? [])],
    cua_thang: undefined,
  };
  return kq;
}

// ---------- mặt bằng mặc định: mẫu tòa + XC-03 (ô thang 3.000) ----------

/** Điểm chèn khối thang canh giữa ô (app cũ chenThang): lệch so với mép đầu ô. */
export const dInsThang = (sx: 1 | -1) => O_THANG_MM / 2 - sx * THANG_GIUA_MM;

type VatThe = { k: string; loai: 'can' | 'thang'; a0: number; w: number };
/** Căn + thang bộ trên một mặt theo `mb` (vị trí trước dồn khít), sắp theo a0. */
function vatThe(mau: ToaMB, mb: MatBangSua, mi: number): VatThe[] {
  const ds: VatThe[] = [];
  mau.mat[mi].phan_tu.forEach((q, i) => {
    if (q.loai !== 'can') return;
    const k = `${mi}:${i}`;
    if (mb.boCan?.includes(k)) return;
    ds.push({ k, loai: 'can', a0: q.a0 + (mb.dich?.[k] ?? 0), w: q.a1 - q.a0 });
  });
  for (const t of mb.thangBo) if (t.matIdx === mi) ds.push({ k: t.khoa, loai: 'thang', a0: t.a0, w: t.rong });
  return ds.sort((a, b) => a.a0 - b.a0);
}
function dich(mb: MatBangSua, v: VatThe, d: number) {
  if (v.loai === 'can') { mb.dich ??= {}; mb.dich[v.k] = (mb.dich[v.k] ?? 0) + d; } else { const t = mb.thangBo.find((x) => x.khoa === v.k); if (t) t.a0 += d; }
}

/** Đầu mặt tự do = điểm cách mép 1 m ra ngoài, giữa bay, nằm ngoài nét bao (đầu cánh, không phải góc nối cánh khác). */
function dauTuDo(mau: ToaMB, mb: MatBangSua, mi: number, cuoi: boolean): boolean {
  const m = mau.mat[mi], B = coSo(m.goc_deg, m.truc_mm), [aDau, aCuoi] = mepMat(mau, mb, mi);
  return !trongDG(B.pt(cuoi ? aCuoi + 1000 : aDau - 1000, BAY_MM / 2), mb.duongBao ?? mau.duong_bao);
}

type Doan = { lo: number; hi: number; tuDau: boolean; tuCuoi: boolean };
/** Đoạn giữa hai mốc (dải lõi / đầu mặt) chứa vị trí a trên mặt mi. */
function doanTai(mau: ToaMB, mb: MatBangSua, dai: DaiLoi[], mi: number, a: number): Doan {
  const [aDau, aCuoi] = mepMat(mau, mb, mi);
  let lo = aDau, hi = aCuoi, coLo = false, coHi = false;
  for (const d of dai) {
    if (d.matIdx !== mi) continue;
    if (d.t1 <= a + 1 && d.t1 > lo) { lo = d.t1; coLo = true; }
    if (d.t0 >= a - 1 && d.t0 < hi) { hi = d.t0; coHi = true; }
  }
  return { lo, hi, tuDau: !coLo && dauTuDo(mau, mb, mi, false), tuCuoi: !coHi && dauTuDo(mau, mb, mi, true) };
}

/**
 * Gọn đa giác nét bao: bỏ đỉnh trùng, đỉnh thẳng hàng và GAI (đi tới rồi quay lại trên cùng một đường — nét bao co lại ở đầu dãy
 * mà không gọt, để lại nét thừa ngoài ô; app cũ duongBao bo theo ô). Lặp tới khi không bỏ được nữa.
 */
export function gonDaGiac(P: Diem[], tol = 2): Diem[] {
  let R = P.slice();
  for (let doi = true; doi && R.length > 3;) {
    doi = false;
    for (let k = 0; k < R.length && R.length > 3; k++) {
      const a = R[(k + R.length - 1) % R.length], p = R[k], c = R[(k + 1) % R.length];
      const L = kc(a, c);
      const lech = L < 1e-6 ? kc(a, p) : Math.abs((c[0] - a[0]) * (p[1] - a[1]) - (c[1] - a[1]) * (p[0] - a[0])) / L;
      // gai: đi tới rồi quay lại (tích vô hướng âm) gần như trên cùng đường — nét CAD lệch vài chục mm vẫn là gai
      const quay = (p[0] - a[0]) * (c[0] - p[0]) + (p[1] - a[1]) * (c[1] - p[1]) < 0;
      if (kc(p, a) <= 1 || lech <= tol || (quay && lech <= 60)) { R.splice(k, 1); doi = true; k--; }
    }
  }
  return R;
}

/**
 * Nối nét bao: đổi đoạn biên a = aE (hệ mặt) phủ dải b ∈ [b0, b1] thành đường vòng lồi ra (d > 0) hoặc lõm vào (d < 0)
 * theo hướng `huong` (+1 = về phía a tăng). Không tìm được cạnh biên phủ dải thì trả null (không đoán).
 */
export function noiNetBao(P: Diem[], gocDeg: number, truc: number, aE: number, huong: 1 | -1, d: number, b0 = 0, b1 = BAY_MM): Diem[] | null {
  const B = coSo(gocDeg, truc), Q = P.map(B.ab);
  for (let i = 0; i < Q.length; i++) {
    const A = Q[i], C = Q[(i + 1) % Q.length];
    if (Math.abs(A[0] - aE) > 5 || Math.abs(C[0] - aE) > 5) continue;
    const lo = Math.min(A[1], C[1]), hi = Math.max(A[1], C[1]);
    if (lo > b0 + 60 || hi < b1 - 60) continue;
    const c0 = Math.abs(lo - b0) <= 60 ? lo : b0, c1 = Math.abs(hi - b1) <= 60 ? hi : b1, a2 = aE + huong * d;
    const chen: Diem[] = A[1] > C[1] ? [[aE, c1], [a2, c1], [a2, c0], [aE, c0]] : [[aE, c0], [a2, c0], [a2, c1], [aE, c1]];
    const R = [...Q.slice(0, i + 1), ...chen, ...Q.slice(i + 1)];
    return gonDaGiac(R).map(([a, b]) => B.pt(a, b));
  }
  return null;
}

/** Mặt mi dài thêm d (âm = ngắn lại) ở đầu tự do; nối nét bao. Sai thì false (không đổi gì). */
function gianMat(mau: ToaMB, mb: MatBangSua, mi: number, cuoi: boolean, d: number): boolean {
  const m = mau.mat[mi], [aDau, aCuoi] = mepMat(mau, mb, mi);
  const P = noiNetBao(mb.duongBao ?? mau.duong_bao, m.goc_deg, m.truc_mm, cuoi ? aCuoi : aDau, cuoi ? 1 : -1, d);
  if (!P) return false;
  mb.duongBao = P;
  mb.mep = { ...(mb.mep ?? {}), [mi]: cuoi ? [aDau, aCuoi + d] : [aDau - d, aCuoi] };
  return true;
}

/**
 * Nét bao BO THEO Ô (app cũ duongBao0: nét bao ôm căn thật): ở đầu mặt TỰ DO, phần mặt thừa ra ngoài vật thể đầu / cuối dãy (căn
 * bị gỡ / xoá ở đầu kia, ép thang về chỗ cũ làm dãy dời) được gọt về khít ô — chỉ phần thừa HƠN mặt bằng mặc định của mẫu.
 * Trả số đầu đã gọt.
 */
function gotDauThua(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc): number {
  const goc = matBangMacDinh(mau, dl);
  // ô thật (căn đã dồn khít theo bố cục — đổi mẫu khác bề ngang, STRETCH — và ô thang)
  const oThat = (x: MatBangSua, b?: BoCuc) => {
    const hd = dung(mau, x, dl), vts = viTriCan(hd, tv, b);
    return (mi: number) => [...vts.filter((v) => v.matIdx === mi).map((v) => ({ a0: v.a0, w: v.a1 - v.a0 })),
      ...x.thangBo.filter((t) => t.matIdx === mi).map((t) => ({ a0: t.a0, w: t.rong }))].sort((p, q) => p.a0 - q.a0);
  };
  const oMoi = oThat(mb, bc), oGoc = oThat(goc);
  let n = 0;
  mau.mat.forEach((m, mi) => {
    if (!laMatThat(m)) return;
    const ds = oMoi(mi), d0 = oGoc(mi);
    if (!ds.length || !d0.length) return;
    const [aDau, aCuoi] = mepMat(mau, mb, mi), [gDau, gCuoi] = mepMat(mau, goc, mi);
    const thuaDau = ds[0].a0 - aDau - Math.max(0, d0[0].a0 - gDau);
    const cuoiDs = ds[ds.length - 1], cuoiD0 = d0[d0.length - 1];
    const thuaCuoi = aCuoi - (cuoiDs.a0 + cuoiDs.w) - Math.max(0, gCuoi - (cuoiD0.a0 + cuoiD0.w));
    // thừa (> 0): gọt về khít ô; thiếu (< 0, ô dồn khít tràn qua đầu mặt): nới ra cho nét bao ôm ô
    if (Math.abs(thuaDau) > KHIT_MM && dauTuDo(mau, mb, mi, false) && gianMat(mau, mb, mi, false, -thuaDau)) n++;
    if (Math.abs(thuaCuoi) > KHIT_MM && dauTuDo(mau, mb, mi, true) && gianMat(mau, mb, mi, true, -thuaCuoi)) n++;
  });
  return n;
}

/** Ô đặc của mặt bằng (căn đã dồn khít theo bố cục, ô thang) và phần giữ (dải hành lang tim ± nửa bề rộng, lõi), mm thế giới. */
function oDacMB(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc?: BoCuc): { o: Diem[][]; hl: Diem[][]; khung: number[] } {
  const hd = dung(mau, mb, dl), o: Diem[][] = [], khung: number[] = [];
  const hcn = (mi: number, a0: number, a1: number, sau: number): Diem[] => {
    const m = mau.mat[mi], B = coSo(m.goc_deg, m.truc_mm);
    return [B.pt(a0, 0), B.pt(a1, 0), B.pt(a1, sau), B.pt(a0, sau)];
  };
  // căn góc V: hình bao thật (CanMau.khung) — ô chữ nhật để nét bao thừa / thiếu cả cái nêm góc khi căn dời / xoá (app cũ bienCan)
  for (const v of viTriCan(hd, tv, bc)) {
    const cm = tv.can.get(bc ? canDangDung(v, bc) : v.canGocId), sau = (bc ? cm?.sau_mm : undefined) ?? v.sau ?? BAY_MM;
    const kh = khungTaiO(mau, v.matIdx, v.a0, v.a1, sau, v.guong, cm?.khung);
    if (kh) khung.push(o.length);
    o.push(kh ?? hcn(v.matIdx, v.a0, v.a1, sau));
  }
  for (const t of mb.thangBo) o.push(hcn(t.matIdx, t.a0, t.a0 + t.rong, BAY_MM));
  // khung tường lõi: ô đặc cố định — chỉ trừ khỏi phần sàn mất, không kéo nét bao ra ngoài (dải lõi chữ nhật cả bay thì quá thô:
  // mặt kề có thể chồng bay lên dải lõi)
  const loi = daGiacCacLoi(mau, dl);
  const r = (mau.hanh_lang_mm || 1800) / 2;
  const hl = (mb.hanhLang.length ? mb.hanhLang : mau.hanh_lang ?? []).map((s): Diem[] => {
    const dx = s.p1[0] - s.p0[0], dy = s.p1[1] - s.p0[1], L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * r, ny = (dx / L) * r;
    return [[s.p0[0] + nx, s.p0[1] + ny], [s.p1[0] + nx, s.p1[1] + ny], [s.p1[0] - nx, s.p1[1] - ny], [s.p0[0] - nx, s.p0[1] - ny]];
  });
  return { o, hl: [...hl, ...loi], khung };
}

/** Tường căn bên cạnh mà hốc logia ĐỨNG LẺ dừng trước (app cũ LUI_TUONG_CAN / LUI_TUONG_THANG, đo trên 115 hốc CAD NOXH). */
const LUI_TUONG_CAN_MM = 150, LUI_TUONG_THANG_MM = 85;
/**
 * Hốc logia của mọi căn trên mặt bằng (app cũ QT-59b `hocDay`): mỗi căn có `logia_lui` [x0, x1, y] khoét phần x0..x1 (lật gương
 * theo căn) từ độ sâu y tới mặt ngoài. Hốc chạm mép căn mà căn kề (sát < 600 mm) cũng có hốc chạm cùng mép thì GHÉP CẶP (trọn tới
 * mép); không thì dừng trước mép đúng bề dày tường căn bên cạnh (150 mm, 85 mm khi bên cạnh là thang bộ). Trả hình chữ nhật (thế giới).
 */
export function hocLogia(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc?: BoCuc): Diem[][] {
  const hd = dung(mau, mb, dl), kq: Diem[][] = [];
  type O = { a0: number; w: number; sau: number; thang: boolean; L: number[][] | null; guong: boolean };
  const theoMat = new Map<number, O[]>();
  for (const v of viTriCan(hd, tv, bc)) {
    if (bc && congNangTai(v.khoa, bc) === 'bo') continue;
    const cm = tv.can.get(bc ? canDangDung(v, bc) : v.canGocId);
    const ds = theoMat.get(v.matIdx) ?? [];
    ds.push({ a0: v.a0, w: v.a1 - v.a0, sau: cm?.sau_mm ?? v.sau ?? BAY_MM, thang: false, L: cm?.khung ? null : cm?.logia_lui?.length ? cm.logia_lui : null, guong: v.guong });
    theoMat.set(v.matIdx, ds);
  }
  for (const t of mb.thangBo) { const ds = theoMat.get(t.matIdx) ?? []; ds.push({ a0: t.a0, w: t.rong, sau: BAY_MM, thang: true, L: null, guong: false }); theoMat.set(t.matIdx, ds); }
  for (const [mi, ds] of theoMat) {
    ds.sort((p, q) => p.a0 - q.a0);
    const B = coSo(mau.mat[mi].goc_deg, mau.mat[mi].truc_mm);
    const sat = (p?: O, q?: O) => !!p && !!q && Math.abs(p.a0 + p.w - q.a0) < 600;
    const khoang = (o: O, z: number[]) => (o.guong ? [(1 - z[1]) * o.w, (1 - z[0]) * o.w] : [z[0] * o.w, z[1] * o.w]);
    // ô `o` có hốc chạm mép trái (ben < 0) / phải (ben > 0) của chính nó không
    const cham = (o: O | undefined, ben: number) => !!o?.L && o.L.some((z) => { const [s0, s1] = khoang(o, z); return ben < 0 ? s0 < 1 : s1 > o.w - 1; });
    const lui = (nb?: O) => (nb?.thang ? LUI_TUONG_THANG_MM : LUI_TUONG_CAN_MM);
    ds.forEach((o, k) => {
      for (const z of o.L ?? []) {
        let [s0, s1] = khoang(o, z);
        if (s0 < 1) { const nb = sat(ds[k - 1], o) ? ds[k - 1] : undefined; if (!cham(nb, 1)) s0 += lui(nb); }
        if (s1 > o.w - 1) { const nb = sat(o, ds[k + 1]) ? ds[k + 1] : undefined; if (!cham(nb, -1)) s1 -= lui(nb); }
        if (s1 - s0 > 1) { const y = z[2] * o.sau; kq.push([B.pt(o.a0 + s0, y), B.pt(o.a0 + s1, y), B.pt(o.a0 + s1, o.sau + 150), B.pt(o.a0 + s0, o.sau + 150)]); }
      }
    });
  }
  return kq;
}

/**
 * Nét bao bo theo ô (app cũ duongBao0 — tinh/netBao.ts): so ô đặc của mặt bằng `mb` với mặt bằng mặc định của mẫu, trừ phần
 * sàn mất (nở 700 mm, trừ lại ô còn + hành lang), cộng phần mọc thêm. Không đổi gì thì undefined (= nét bao mẫu).
 */
function baoTheoO(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc): Diem[] | undefined | null {
  const goc = matBangMacDinh(mau, dl), a = oDacMB(mau, goc, dl, tv), b = oDacMB(mau, mb, dl, tv, bc);
  // nét bao nối dần (noiNetBao ở đầu mặt — đúng tới mm khi dãy dài ra / ngắn lại) còn khớp ô thì giữ; hỏng (gai, viền thừa quanh
  // chỗ trống, ô lòi ra ngoài) mới dựng lại bằng phép boolean như app cũ
  const P1 = mb.duongBao ?? mau.duong_bao;
  const P = !baoHong(P1, mau, a, b) ? P1 : netBaoTheoO(mau.duong_bao, a.o, b.o, b.hl, a.hl);
  if (!P) return null;
  // hốc logia đi theo căn (QT-59b): căn dời / đổi chỗ / lật thì hốc cũ lấp lại, hốc mới khoét theo căn
  const Q = suaHocLogia(P, hocLogia(mau, goc, dl, tv), hocLogia(mau, mb, dl, tv, bc), b.o);
  if (Q === mau.duong_bao) return undefined;
  return Q === P1 ? mb.duongBao : gonDaGiac(Q);
}

/** Khoảng cách điểm tới đa giác (trong = 0). */
const kcDG = (p: Diem, P: Diem[]) => {
  if (trongDG(p, P)) return 0;
  let m = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], c = P[(i + 1) % P.length], dx = c[0] - a[0], dy = c[1] - a[1], L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    m = Math.min(m, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return m;
};
/** Đỉnh nét bao xa ô đặc nhất (mm). */
const dinhXaNhat = (P: Diem[], ds: Diem[][]) => Math.max(0, ...P.map((p) => Math.min(...ds.map((R) => kcDG(p, R)))));
const nhoXaGoc = new WeakMap<ToaMB, Map<DuLieuMB | null, number>>();
/**
 * Nét bao `P` hỏng so với ô đặc: (1) có đỉnh cách ô đặc / hành lang / lõi xa hơn mức của chính mẫu + 60 mm (gai, viền thừa ở đầu
 * dãy đã co); (2) góc ô đã đổi (dời / đổi mẫu / thêm) nằm ngoài nét bao quá 700 mm.
 */
function baoHong(P: Diem[], mau: ToaMB, a: { o: Diem[][]; hl: Diem[][] }, b: { o: Diem[][]; hl: Diem[][] }): boolean {
  let m = nhoXaGoc.get(mau);
  if (!m) nhoXaGoc.set(mau, (m = new Map()));
  let xa0 = m.get(null);
  if (xa0 === undefined) { xa0 = dinhXaNhat(mau.duong_bao, [...a.o, ...a.hl]); m.set(null, xa0); }
  if (dinhXaNhat(P, [...b.o, ...b.hl]) > xa0 + 60) return true;
  const khoa = (R: Diem[]) => R.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join(';');
  const k0 = new Set(a.o.map(khoa));
  return b.o.some((R) => !k0.has(khoa(R)) && R.some((p) => kcDG(p, P) > NOI_MAT_MM));
}

// ---------- QT-69 · đầu dãy hở ra sân trong ----------
/**
 * Sân trong hở của mẫu: khoảng trống trên một mặt, giữa hai dãy, cỡ hành lang trở lên (XC-02, tinh/khe.ts), mà dải giữa bay
 * nằm TRỌN ngoài nét bao mẫu — phía ngoài đầu dãy là không gian mở, không lõi / thang / cánh khác (app cũ `dauKet`: đầu không
 * kẹt thì dãy dài ra / ngắn lại ở đó). Vd tm-u1 mặt B: hai cánh nhìn nhau qua sân 24,5 m. `s0`, `s1` = hai mép sân (hệ mặt).
 */
export type SanHo = { matIdx: number; s0: number; s1: number };
const nhoSan = new WeakMap<ToaMB, Map<DuLieuMB | null, SanHo[]>>();
export function sanHo(mau: ToaMB, dl: DuLieuMB | null | undefined, tv: ThuVien): SanHo[] {
  let theoDl = nhoSan.get(mau);
  const co = theoDl?.get(dl ?? null);
  if (co) return co;
  const hd = dung(mau, matBangMacDinh(mau, dl), dl), ds: SanHo[] = [];
  for (const x of kheTrenMat(hd, tv).khe) {
    if (x.loai !== 'hanh_lang') continue;
    const m = mau.mat[x.matIdx], B = coSo(m.goc_deg, m.truc_mm);
    let ngoai = true;
    for (let a = x.a0 + 250; a < x.a1 && ngoai; a += 500) ngoai = !trongDG(B.pt(a, BAY_MM / 2), mau.duong_bao);
    if (ngoai) ds.push({ matIdx: x.matIdx, s0: x.a0, s1: x.a1 });
  }
  if (!theoDl) nhoSan.set(mau, (theoDl = new Map()));
  theoDl.set(dl ?? null, ds);
  return ds;
}
/** Bề rộng sân tối thiểu còn lại khi dãy dài ra: vẫn là khoảng trống cỡ hành lang (XC-02: > căn rộng nhất của mặt + 500 mm). */
const sanConMin = (rongMax: number) => rongMax + KHE_HL_THEM_MM;
/** Đầu dãy ở mép sân hở (đầu cuối → mép s0, đầu đầu → mép s1), sai lệch ≤ khe tường. */
const sanTaiDau = (san: SanHo[], mi: number, a: number, cuoi: boolean) =>
  san.find((s) => s.matIdx === mi && Math.abs(a - (cuoi ? s.s0 : s.s1)) <= KHE_TUONG_MM);
/** Nét bao nối theo đầu dãy dài ra (d > 0) / ngắn lại (d < 0) vào sân hở ở vị trí aE (mép mặt không đổi). */
function noiDauSan(mau: ToaMB, mb: MatBangSua, mi: number, aE: number, cuoi: boolean, d: number): boolean {
  const m = mau.mat[mi], P0 = mb.duongBao ?? mau.duong_bao, B = coSo(m.goc_deg, m.truc_mm);
  // cạnh nét bao ở đầu dãy có thể lệch mép khung căn vài chục mm (bản vẽ: tm-u1 cánh phải lệch 65 mm) — lấy cạnh gần nhất ≤ khe tường
  const Q = P0.map(B.ab), canh = Q.map((p, i) => [p, Q[(i + 1) % Q.length]] as const)
    .filter(([p, q]) => Math.abs(p[0] - q[0]) <= 5 && Math.abs(p[0] - aE) <= KHE_TUONG_MM && Math.min(p[1], q[1]) <= 60 && Math.max(p[1], q[1]) >= BAY_MM - 60)
    .sort(([p], [q]) => Math.abs(p[0] - aE) - Math.abs(q[0] - aE))[0];
  if (!canh) return false;
  const P = noiNetBao(P0, m.goc_deg, m.truc_mm, canh[0][0], cuoi ? 1 : -1, d);
  if (!P) return false;
  mb.duongBao = P;
  return true;
}

const nhoMacDinh = new WeakMap<ToaMB, Map<DuLieuMB | null, MatBangSua>>();

/**
 * Mặt bằng mặc định của mẫu: thang của bản vẽ thành ô 3.000 mm (XC-03 · QT-10: hút khe ≤ 600 mm hai bên, điểm chèn giữ nguyên
 * nên không căn nào xê dịch; QT-60: ô còn thiếu thì nới, thang canh giữa ô, căn phía đầu tự do dồn theo, mặt dài ra).
 */
export function matBangMacDinh(mau: ToaMB, dl?: DuLieuMB | null): MatBangSua {
  let theoDl = nhoMacDinh.get(mau);
  const co = theoDl?.get(dl ?? null);
  if (co) return co;
  const mb: MatBangSua = { phienBan: 1, thangBo: [], dich: {}, hanhLang: (mau.hanh_lang ?? []).map((s) => ({ ...s })) };
  const dai = daiLoi(mau, dl);
  mau.mat.forEach((m, mi) => {
    if (!laMatThat(m)) return;
    const B = coSo(m.goc_deg, m.truc_mm);
    const ps = m.phan_tu.map((q, i) => ({ q, i })).filter((o) => o.q.rong_mm > 0).sort((a, b) => a.q.a0 - b.q.a0);
    ps.forEach(({ q, i }, k) => {
      if (q.loai !== 'thang_bo') return;
      const eL = k > 0 ? ps[k - 1].q.a1 : m.a_dau, eR = k < ps.length - 1 ? ps[k + 1].q.a0 : m.a_cuoi;
      const a0 = q.a0 - eL <= KHE_HUT_MM ? eL : q.a0, a1 = eR - q.a1 <= KHE_HUT_MM ? eR : q.a1;
      const [aIns, bIns] = B.ab([q.x, q.y]);
      mb.thangBo.push({ khoa: `${mi}:${i}`, matIdx: mi, a0, rong: a1 - a0, sx: q.sx < 0 ? -1 : 1, dIns: aIns - a0, bIns, block: q.block || THANG_KHOI, nguon: 'mau' });
    });
  });
  // QT-60: ô thang thiếu so với 3.000 mm → nới, dồn phần phía đầu tự do
  for (const t of mb.thangBo) {
    const thieu = O_THANG_MM - t.rong;
    if (thieu <= 20) continue;
    const dn = doanTai(mau, mb, dai, t.matIdx, t.a0 + t.rong / 2);
    const vt = vatThe(mau, mb, t.matIdx).filter((v) => v.a0 >= dn.lo - 1 && v.a0 + v.w <= dn.hi + 1 && v.k !== t.khoa);
    if (dn.tuCuoi && gianMat(mau, mb, t.matIdx, true, thieu)) {
      vt.filter((v) => v.a0 >= t.a0 + t.rong - 1).forEach((v) => dich(mb, v, thieu));
    } else if (dn.tuDau && gianMat(mau, mb, t.matIdx, false, thieu)) {
      vt.filter((v) => v.a0 + v.w <= t.a0 + 1).forEach((v) => dich(mb, v, -thieu));
      t.a0 -= thieu;
    } else continue;
    t.rong = O_THANG_MM;
    t.dIns = dInsThang(t.sx);
  }
  // loại thang mặc định: một N2 + một N3 (mẫu tòa chỉ chèn N3)
  mb.thangBo = ganLoaiThang(mb.thangBo);
  if (!theoDl) nhoMacDinh.set(mau, (theoDl = new Map()));
  theoDl.set(dl ?? null, mb);
  return mb;
}

/** Mặt bằng đang dùng của tòa: đã tự chỉnh (lưu trong PA) hoặc mặc định của mẫu. */
export const matBangCua = (toa: Pick<ToaDat, 'matBang'>, mau: ToaMB, dl?: DuLieuMB | null): MatBangSua => toa.matBang ?? matBangMacDinh(mau, dl);

type ToaCoTang = Pick<ToaDat, 'matBang' | 'tangRieng' | 'soTangDH'>;
/** Mặt bằng đã tự chỉnh RIÊNG của tầng `tang` (bố cục riêng khác bố cục chung), không có thì null. */
export const matBangRiengTang = (toa: Partial<ToaCoTang>, tang: number | null | undefined): MatBangSua | null =>
  (tang != null && toa.tangRieng && toa.soTangDH != null ? ghiDeTang(toa as ToaCoTang, tang)?.matBang : null) ?? null;
/** Mặt bằng đang dùng ở tầng `tang` (null = bố cục chung): riêng của tầng, không thì chung / mặc định của mẫu. */
export const matBangTang = (toa: Partial<ToaCoTang>, mau: ToaMB, dl: DuLieuMB | null | undefined, tang: number | null | undefined): MatBangSua =>
  matBangRiengTang(toa, tang) ?? toa.matBang ?? matBangMacDinh(mau, dl);

/** Mẫu tòa hiệu dụng của một tòa (dùng thay mẫu thư viện ở màn Tầng). */
export const mauHieuDung = <T extends ToaMB>(toa: Partial<ToaCoTang>, mau: T, dl?: DuLieuMB | null, tang?: number | null): T => apMatBang(mau, matBangTang(toa, mau, dl, tang), dl);

// ---------- đo ----------
type DanhGia = { vuot: number; vuotMax: number; xaNhat: number; khongToi: number; ok: boolean };
const tot = (a: DanhGia, b: DanhGia | null) => !b || a.vuot < b.vuot || (a.vuot === b.vuot && (a.vuotMax < b.vuotMax - 1e-6 || (Math.abs(a.vuotMax - b.vuotMax) <= 1e-6 && a.xaNhat < b.xaNhat - 1e-6)));

/** Tim cửa căn (khoá ma_goc) cho các căn đang dùng, gồm biến thể STRETCH. */
function cuaCanDung(ids: Iterable<string>, tv: ThuVien, cuaCan: Record<string, number>): Record<string, number> {
  const kq: Record<string, number> = {};
  for (const id of new Set(ids)) { const c = tv.can.get(id), x = c && cuaBienThe(c, cuaCan, tv); if (c && x !== undefined) kq[c.ma_goc] = x; }
  return kq;
}

function danhGia(mauHD: ToaMB, bc: BoCuc, tv: ThuVien, cuaCan: Record<string, number>, H: number) {
  const mat = matDaDon(mauHD, bc, tv);
  // ô không có người ở thường xuyên (KHONG_KIEM_TN) không đo cự ly; `khoaCan[so - 1]` = khoá vị trí của căn số `so`
  const khoaCan: string[] = [];
  const matTN = mat.map((m) => ({ ...m, phan_tu: m.phan_tu.filter((q) => {
    if (q.loai !== 'can') return true;
    if (KHONG_KIEM_TN.has(congNangTai(q.khoa ?? '', bc))) return false;
    khoaCan.push(q.khoa ?? '');
    return true;
  }) }));
  const tn = thoatNan({ ...(mauHD as unknown as ToaPCCC), mat: matTN, truc: mauHD.truc ?? [], hanhlang_ve: mauHD.hanhlang_ve ?? [] }, { cuaCan, chieuCaoPCCC: H });
  const xau = tn.can.filter((c) => c.vuot);
  const dg: DanhGia = {
    vuot: tn.soVuot,
    vuotMax: Math.max(0, ...xau.map((c) => (c.cuLy === null ? 1e3 : c.cuLy - c.nguong))),
    xaNhat: tn.maxTravel,
    khongToi: tn.can.filter((c) => c.cuLy === null).length,
    ok: true,
  };
  return { dg, tn, mat, khoaCan };
}

// ---------- PC-11: thang bộ tự động ----------

/** Các chỗ cắt hợp lệ trong đoạn: giữa hai vật thể liền nhau, nơi tổng chênh bề ngang căn tính từ đầu dãy căn = 0 (vị trí trước và sau dồn khít trùng nhau). */
function choCat(vt: VatThe[], dn: Doan, chenh: Map<string, number>): number[] {
  const trong = vt.filter((v) => v.a0 >= dn.lo - 1 && v.a0 + v.w <= dn.hi + 1);
  const kq = new Set<number>();
  if (trong.length) { kq.add(Math.round(trong[0].a0 * 10) / 10); }
  let tong = 0;
  trong.forEach((v, i) => {
    tong = v.loai === 'can' ? tong + (chenh.get(v.k) ?? 0) : 0;
    const hetDay = i === trong.length - 1 || Math.abs(trong[i + 1].a0 - (v.a0 + v.w)) > 2 || trong[i + 1].loai !== 'can';
    if (Math.abs(tong) <= 1 || v.loai !== 'can') kq.add(Math.round((v.a0 + v.w) * 10) / 10);
    if (hetDay) tong = 0;
  });
  return [...kq];
}

function themThang(mau: ToaMB, mb: MatBangSua, dai: DaiLoi[], mi: number, p: number, sx: 1 | -1, khoa: string): boolean {
  const dn = doanTai(mau, mb, dai, mi, p);
  const vt = vatThe(mau, mb, mi).filter((v) => v.a0 >= dn.lo - 1 && v.a0 + v.w <= dn.hi + 1);
  if (dn.tuCuoi && gianMat(mau, mb, mi, true, O_THANG_MM)) {
    vt.filter((v) => v.a0 >= p - 1).forEach((v) => dich(mb, v, O_THANG_MM));
    mb.thangBo.push({ khoa, matIdx: mi, a0: p, rong: O_THANG_MM, sx, dIns: dInsThang(sx), bIns: 0, block: THANG_KHOI, nguon: 'them' });
    return true;
  }
  if (dn.tuDau && gianMat(mau, mb, mi, false, O_THANG_MM)) {
    vt.filter((v) => v.a0 + v.w <= p + 1).forEach((v) => dich(mb, v, -O_THANG_MM));
    mb.thangBo.push({ khoa, matIdx: mi, a0: p - O_THANG_MM, rong: O_THANG_MM, sx, dIns: dInsThang(sx), bIns: 0, block: THANG_KHOI, nguon: 'them' });
    return true;
  }
  return false;
}

function boThang(mau: ToaMB, mb: MatBangSua, dai: DaiLoi[], khoa: string): boolean {
  const t = mb.thangBo.find((x) => x.khoa === khoa);
  if (!t) return false;
  const dn = doanTai(mau, mb, dai, t.matIdx, t.a0 + t.rong / 2);
  const vt = vatThe(mau, mb, t.matIdx).filter((v) => v.a0 >= dn.lo - 1 && v.a0 + v.w <= dn.hi + 1 && v.k !== khoa);
  if (dn.tuCuoi && gianMat(mau, mb, t.matIdx, true, -t.rong)) vt.filter((v) => v.a0 >= t.a0 + t.rong - 1).forEach((v) => dich(mb, v, -t.rong));
  else if (dn.tuDau && gianMat(mau, mb, t.matIdx, false, -t.rong)) vt.filter((v) => v.a0 + v.w <= t.a0 + 1).forEach((v) => dich(mb, v, t.rong));
  else return false;
  mb.thangBo = mb.thangBo.filter((x) => x !== t);
  return true;
}

// ---------- thang bộ đặt tay (công cụ màn Tầng · p17d app cũ: "Thêm thang bộ" chèn ô __STAIR__ sau ô chọn; xoá / dời thang) ----------
/** Chỗ chèn (mm, hệ mặt): cuối vật thể `sau`, không thì đầu vật thể `truoc` (căn / thang) trên mặt `mat` theo `mb`; không có thì null. */
function choChen(mau: ToaMB, mb: MatBangSua, e: ThangTayThem): number | null {
  const ds = vatThe(mau, mb, e.mat);
  const s = e.sau ? ds.find((x) => x.k === e.sau) : undefined;
  if (s) return s.a0 + s.w;
  const t = e.truoc ? ds.find((x) => x.k === e.truoc) : undefined;
  if (t) return t.a0;
  // vật thể neo đã bị bỏ (gỡ thoát nạn / xoá căn): neo theo vật thể còn lại gần nhất theo thứ tự của mẫu — thang không mất chỗ
  const neo = e.sau ?? e.truoc;
  const m = mau.mat[e.mat];
  if (!neo || !m || !mb.boCan?.includes(neo)) return null;
  const thu = m.phan_tu.map((q, i) => ({ k: `${e.mat}:${i}`, a: q.a0, can: q.loai === 'can' })).filter((x) => x.can).sort((x, y) => x.a - y.a).map((x) => x.k);
  const i0 = thu.indexOf(neo);
  if (i0 < 0) return null;
  for (let i = i0 - 1; i >= 0; i--) { const v = ds.find((x) => x.k === thu[i]); if (v) return v.a0 + v.w; }
  for (let i = i0 + 1; i < thu.length; i++) { const v = ds.find((x) => x.k === thu[i]); if (v) return v.a0; }
  return null;
}

/**
 * Áp thang đặt tay lên mặt bằng xuất phát: bỏ thang (`bo`: dãy co lại ở đầu tự do như boThang), rồi thêm / dời thang (`them`):
 * dời trong cùng đoạn thì đổi chỗ với các vật thể ở giữa (mặt không dài ra, doiThang); khác đoạn / thêm mới thì chèn ô 3.000 mm ngay sau
 * vật thể `sau`, căn phía đầu tự do dời đi, mặt dài ra (themThang · QT-10 · QT-69). Trả các khoá thang KHÔNG áp được.
 */
export function apThangTay(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tt: ThangTay): string[] {
  const dai = daiLoi(mau, dl), hong: string[] = [];
  for (const k of tt.bo) if (mb.thangBo.some((t) => t.khoa === k) && !boThang(mau, mb, dai, k)) hong.push(k);
  for (const e of tt.them) {
    const p = choChen(mau, mb, e);
    if (p === null) { hong.push(e.khoa); continue; }
    const cu = e.tu ? mb.thangBo.find((t) => t.khoa === e.tu) : undefined;
    if (cu && cu.matIdx === e.mat) {
      const d0 = doanTai(mau, mb, dai, e.mat, cu.a0 + cu.rong / 2), d1 = doanTai(mau, mb, dai, e.mat, p - 1);
      if (Math.abs(d0.lo - d1.lo) < 1 && Math.abs(d0.hi - d1.hi) < 1) {
        if (!doiThang(mau, mb, cu.khoa, p, e.sx)) hong.push(e.khoa);
        continue;
      }
    }
    const thu = banSaoMatBang(mb);
    if (cu && !boThang(mau, thu, dai, cu.khoa)) { hong.push(e.khoa); continue; }
    const p2 = choChen(mau, thu, e);
    // thang dời giữ khoá cũ (để chọn / dời tiếp), thang thêm mới mang khoá của nó
    if (p2 === null || !themThang(mau, thu, dai, e.mat, p2, e.sx, cu?.khoa ?? e.khoa)) { hong.push(e.khoa); continue; }
    Object.assign(mb, thu);
  }
  return hong;
}

/**
 * Quy tắc tối đa 3 thang (THANG_MAX) cho thang đặt tay: mặt bằng `mb` (đã áp thang tay) còn > 3 thang thì bỏ thang THÊM tay sau
 * cùng (thứ tự `tt.them` ngược), rồi thang khác bỏ được ở đầu tự do. Trả số thang đã bỏ.
 */
function catThangThua(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tt: ThangTay): number {
  const dai = daiLoi(mau, dl);
  let n = 0;
  const thu = [...tt.them].reverse().map((e) => e.khoa).filter((k) => !tt.them.find((e) => e.khoa === k)?.tu);
  for (const k of [...thu, ...mb.thangBo.map((t) => t.khoa).reverse()]) {
    if (mb.thangBo.length <= THANG_MAX) break;
    if (mb.thangBo.some((t) => t.khoa === k) && boThang(mau, mb, dai, k)) n++;
  }
  return n;
}

/**
 * Chụp tập thang đang có (`mb`: mặt bằng đã tự chỉnh — thang của mẫu đã dời, thang PC-11 thêm) thành thang đặt tay, để lần sửa thang
 * tay đầu tiên không làm mất phần PC-11 đã làm: thang mẫu không còn → `bo`; mỗi thang (theo thứ tự trên mặt) chèn sau vật thể đứng
 * ngay trước nó (hoặc trước vật thể đứng ngay sau, nếu thang ở đầu dãy), thang mẫu mang `tu` = chính nó.
 */
export function chupThangTay(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined): ThangTay {
  const goc = matBangMacDinh(mau, dl);
  const laMau = (k: string) => goc.thangBo.some((t) => t.khoa === k);
  const bo = goc.thangBo.filter((t) => !mb.thangBo.some((u) => u.khoa === t.khoa)).map((t) => t.khoa);
  const them: ThangTayThem[] = [];
  for (const t of [...mb.thangBo].sort((a, b) => a.matIdx - b.matIdx || a.a0 - b.a0)) {
    const ds = vatThe(mau, mb, t.matIdx).filter((v) => v.k !== t.khoa);
    const truoc = ds.filter((v) => Math.abs(v.a0 + v.w - t.a0) <= KHIT_MM).at(-1), sau = ds.find((v) => Math.abs(v.a0 - (t.a0 + t.rong)) <= KHIT_MM);
    them.push({ khoa: t.khoa, mat: t.matIdx, sx: t.sx, ...(truoc ? { sau: truoc.k } : sau ? { truoc: sau.k } : {}), ...(laMau(t.khoa) ? { tu: t.khoa } : {}) });
  }
  return { them, bo };
}

// ---------- gỡ thoát nạn: bỏ căn (giamCanThoatNan app cũ) ----------
/**
 * Bỏ căn `khoa` khỏi mặt bằng như app cũ cắt căn: các vật thể giữa ô đó và đầu mặt TỰ DO gần hơn dồn vào đúng bề ngang ô,
 * mặt co lại, nét bao nối theo. Không có đầu tự do / phía đó có thang bộ (thang phải giữ vị trí cho liền các tầng) thì false.
 */
export function boCanTren(mau: ToaMB, mb: MatBangSua, dai: DaiLoi[], khoa: string): boolean {
  const mi = Number(khoa.split(':')[0]);
  if (!Number.isInteger(mi) || !mau.mat[mi]) return false;
  const ds = vatThe(mau, mb, mi), v = ds.find((x) => x.k === khoa);
  if (!v) return false;
  const dn = doanTai(mau, mb, dai, mi, v.a0 + v.w / 2);
  const vt = ds.filter((x) => x.a0 >= dn.lo - 1 && x.a0 + x.w <= dn.hi + 1 && x.k !== khoa);
  const sau = vt.filter((x) => x.a0 >= v.a0 + v.w - 1), truoc = vt.filter((x) => x.a0 + x.w <= v.a0 + 1);
  // thang bộ không là mốc (QT-48 app cũ): thang giữa căn bỏ và đầu tự do trượt vào cùng các căn
  const okCuoi = dn.tuCuoi, okDau = dn.tuDau;
  // phía đầu tự do gần hơn (app cũ: cắt căn giữa gần mép, căn góc ở mép trượt vào)
  const cuoi = okCuoi && (!okDau || dn.hi - (v.a0 + v.w) <= v.a0 - dn.lo);
  if (!(cuoi ? gianMat(mau, mb, mi, true, -v.w) : okDau && gianMat(mau, mb, mi, false, -v.w))) return false;
  (cuoi ? sau : truoc).forEach((x) => dich(mb, x, cuoi ? -v.w : v.w));
  mb.boCan = [...(mb.boCan ?? []), khoa];
  return true;
}

/**
 * Dồn khít QUA thang bộ (app cũ `donKhitMat` + QT-48: thang bộ KHÔNG là mốc — là một ô trong cụm như căn hộ; chỉ lõi thang máy là
 * mốc). Dãy căn + thang giữa hai mốc thật (dải lõi, khe > 600 mm, đầu mặt) mà tổng bề ngang căn đổi (đổi chỗ / đổi mẫu căn khác
 * bề ngang) thì cả dãy dồn lại từ đầu neo, thang trượt theo căn, đầu tự do dài ra / ngắn lại (nét bao nối theo). Không có thang
 * trong dãy thì để donKhit + QT-69 như cũ. Đầu neo: mốc lõi / đầu không tự do; dãy kẹp (không đầu tự do) để khít đoạn kẹp xử lý
 * như cũ. Ghi `MatBangSua.neo` để donKhit dồn đoạn căn về đúng đầu đó. Trả các mặt đã dồn.
 */
function donQuaThang(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc, giu: ReadonlySet<string>): { mat: Set<number>; so: number; mm: number } {
  const xong = new Set<number>();
  let so = 0, mm = 0;
  const dai = daiLoi(mau, dl);
  const goc = new Map(viTriCan(mau, tv).map((v) => [v.khoa, v]));
  const san = sanHo(mau, dl, tv);
  mau.mat.forEach((m, mi) => {
    if (!laMatThat(m) || !mb.thangBo.some((t) => t.matIdx === mi)) return;
    type O = { v: VatThe; wT: number; wA: number };
    const ds: O[] = vatThe(mau, mb, mi).map((v) => {
      if (v.loai === 'thang') return { v, wT: v.w, wA: v.w };
      const g = goc.get(v.k);
      return { v, wT: v.w, wA: v.w + (g ? chenhRong(g, canDangDung(g, bc), tv) : 0) };
    });
    const loi = dai.filter((d) => d.matIdx === mi);
    // chia dãy ở dải lõi / khe lớn
    const day: O[][] = [];
    ds.forEach((o, k) => {
      const tr = ds[k - 1];
      const tach = !tr || o.v.a0 - (tr.v.a0 + tr.wT) > KHE_HUT_MM || loi.some((d) => (d.t0 + d.t1) / 2 > tr.v.a0 + tr.wT / 2 && (d.t0 + d.t1) / 2 < o.v.a0 + o.wT / 2);
      if (tach) day.push([o]); else day[day.length - 1].push(o);
    });
    const [aDau, aCuoi] = mepMat(mau, mb, mi);
    for (const d of day) {
      if (!d.some((o) => o.v.loai === 'thang') || !d.some((o) => o.v.loai === 'can')) continue;
      const chenh = d.reduce((s, o) => s + o.wA - o.wT, 0);
      // chỉ khi căn NGƯỜI DÙNG chọn (bố cục vào, không phải căn tự chỉnh STRETCH / đổi để khít) đổi bề ngang
      if (Math.abs(chenh) <= KHIT_MM || !d.some((o) => o.v.loai === 'can' && giu.has(o.v.k) && Math.abs(o.wA - o.wT) > KHIT_MM)) continue;
      const a0 = d[0].v.a0, a1 = d[d.length - 1].v.a0 + d[d.length - 1].wT;
      const sat = (a: number) => loi.some((x) => Math.abs(x.t1 - a) <= 400 || Math.abs(x.t0 - a) <= 400);
      const tuDau = !sat(a0) && Math.abs(a0 - aDau) <= 1500 && dauTuDo(mau, mb, mi, false);
      const tuCuoi = !sat(a1) && Math.abs(a1 - aCuoi) <= 1500 && dauTuDo(mau, mb, mi, true);
      // dãy kẹp (không đầu tự do) / đầu hở ra sân trong: để khít đoạn kẹp, QT-69 sân hở (noiDauSan) xử lý như cũ
      if ((!tuDau && !tuCuoi) || sanTaiDau(san, mi, a1, true) || sanTaiDau(san, mi, a0, false)) continue;
      const neoDau = !tuDau;
      const khe = d.map((o, k) => (k + 1 < d.length ? Math.max(0, d[k + 1].v.a0 - (o.v.a0 + o.wT)) : 0));
      // vị trí mới (bề ngang thật)
      const moi: number[] = new Array(d.length);
      if (neoDau) { let p = a0; d.forEach((o, k) => { moi[k] = p; p += o.wA + khe[k]; }); }
      else { let p = a1; for (let k = d.length - 1; k >= 0; k--) { p -= d[k].wA; moi[k] = p; p -= k > 0 ? khe[k - 1] : 0; } }
      // đoạn căn giữa hai thang: ô (bề ngang mẫu) liền nhau neo đúng đầu dồn, donKhit đặt căn theo bề ngang thật
      let k = 0;
      while (k < d.length) {
        if (d[k].v.loai === 'thang') { const t = mb.thangBo.find((x) => x.khoa === d[k].v.k); if (t) t.a0 = moi[k]; k++; continue; }
        let j = k;
        while (j + 1 < d.length && d[j + 1].v.loai === 'can') j++;
        const doan = d.slice(k, j + 1);
        if (neoDau) {
          let p = moi[k];
          doan.forEach((o, i) => { mb.dich ??= {}; mb.dich[o.v.k] = (mb.dich[o.v.k] ?? 0) + p - o.v.a0; p += o.wT + khe[k + i]; });
        } else {
          let p = moi[j] + d[j].wA;
          for (let i = doan.length - 1; i >= 0; i--) { const o = doan[i]; p -= o.wT; mb.dich ??= {}; mb.dich[o.v.k] = (mb.dich[o.v.k] ?? 0) + p - o.v.a0; p -= i > 0 ? khe[k + i - 1] : 0; }
        }
        mb.neo = { ...(mb.neo ?? {}), [doan[0].v.k]: neoDau ? 'dau' : 'cuoi' };
        k = j + 1;
      }
      // đầu tự do dài ra / ngắn lại, nét bao nối theo
      if (neoDau ? gianMat(mau, mb, mi, true, chenh) : gianMat(mau, mb, mi, false, chenh)) { so++; mm += chenh; }
      xong.add(mi);
    }
  });
  return { mat: xong, so, mm };
}

/** Căn bỏ theo bố cục (công năng 'bo'), dựng vào mặt bằng theo thứ tự khoá cố định. Trả số căn bỏ được. */
function apBoCan(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, bc: BoCuc): number {
  const ds = Object.keys(bc.congNang ?? {}).filter((k) => bc.congNang![k] === 'bo').sort();
  if (!ds.length) return 0;
  const dai = daiLoi(mau, dl);
  return ds.filter((k) => boCanTren(mau, mb, dai, k) || boCanKep(mau, mb, dai, k)).length;
}

/**
 * Bỏ căn trong dãy KẸP giữa hai mốc (không có đầu tự do — khít đoạn kẹp): căn bỏ không dựng, các căn còn lại trong dãy liền
 * xích vào cho liền nhau về phía mốc giữ chỗ (dải lõi nếu chỉ một đầu sát lõi, không thì đầu trái — như donKhit); chỗ trống
 * ở đầu kia do các căn còn lại giãn / đổi mẫu lấp (khitDoanKep chọn cùng lúc).
 */
function boCanKep(mau: ToaMB, mb: MatBangSua, dai: DaiLoi[], khoa: string): boolean {
  const mi = Number(khoa.split(':')[0]);
  if (!Number.isInteger(mi) || !mau.mat[mi]) return false;
  const ds = vatThe(mau, mb, mi), i = ds.findIndex((x) => x.k === khoa);
  if (i < 0) return false;
  const v = ds[i];
  let s = i, e = i;
  while (s > 0 && ds[s - 1].loai === 'can' && Math.abs(ds[s - 1].a0 + ds[s - 1].w - ds[s].a0) <= KHIT_MM) s--;
  while (e < ds.length - 1 && ds[e + 1].loai === 'can' && Math.abs(ds[e].a0 + ds[e].w - ds[e + 1].a0) <= KHIT_MM) e++;
  const a0 = ds[s].a0, a1 = ds[e].a0 + ds[e].w;
  const loiDau = dai.some((d) => d.matIdx === mi && Math.abs(d.t1 - a0) <= TUONG_CHUNG_LOI_MM);
  const loiCuoi = dai.some((d) => d.matIdx === mi && Math.abs(d.t0 - a1) <= TUONG_CHUNG_LOI_MM);
  if (loiCuoi && !loiDau) ds.slice(s, i).forEach((x) => dich(mb, x, v.w));
  else ds.slice(i + 1, e + 1).forEach((x) => dich(mb, x, -v.w));
  mb.boCan = [...(mb.boCan ?? []), khoa];
  return true;
}

// ---------- thang liền suốt chiều cao: ép tập thang ----------
/** Điểm chèn khối thang (mm, hệ mặt) — cùng mặt, cùng điểm chèn, cùng chiều cửa = cùng một buồng thang ở mọi tầng. */
const chenThang = (t: ThangBoMB) => t.a0 + t.dIns;
export const cungThang = (a: ThangBoMB, b: ThangBoMB) => a.matIdx === b.matIdx && a.sx === b.sx && Math.abs(chenThang(a) - chenThang(b)) < 1;
/** Hai ô thang cùng mặt chồng lên nhau (không thể cùng có ở một tầng). */
const chongThang = (a: ThangBoMB, b: ThangBoMB) => a.matIdx === b.matIdx && Math.abs(chenThang(a) - chenThang(b)) < O_THANG_MM - 1;

/** Đo một mặt bằng như PC-11 (sau khi kéo trục hành lang tới cửa đã dời). */
function doMB(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc, cuaCan: Record<string, number>, H: number) {
  const c = banSaoMatBang(mb);
  hanhLangToiCua(mau, c, dl, cuaCan);
  return danhGia(dung(mau, c, dl), bc, tv, cuaCan, H);
}

type MocMat = { a0: number; a1: number; loi: boolean };

/**
 * Ép tập thang `U` lên mặt bằng `mb0` (thay PC-11 khi thang phải liền suốt chiều cao). Ô thang giữ ĐÚNG chỗ như mọi tầng khác;
 * trên mỗi mặt có thang, căn xếp lại vào các khe giữa mốc (dải lõi, ô thang) theo thứ tự, gán khe theo tâm căn ở mặt bằng
 * xuất phát, rồi dồn khít (XC-04) về phía mốc như tinh/matBang.ts `donKhit`:
 *  - khe có đầu mặt tự do: dãy dài ra / ngắn lại ở đầu đó (QT-69), nét bao nối theo;
 *  - khe kẹp hai mốc mà tổng bề ngang căn lệch (tầng đổi căn khác bề ngang): căn NHƯỜNG CHỖ — căn giữa co / giãn STRETCH
 *    (DC-04, bước 100, ≤ ±500) tới khi khít; phần không khít được báo `conLech` (mm).
 * Thang của mẫu không có trong U mà nằm ở đoạn kẹp (bỏ đi để lại khe 3 m) thì giữ lại và báo `thua` (thừa thang = phía an toàn).
 */
function epThang(mau: ToaMB, mb0: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, cuaCan: Record<string, number>, H: number, bc0: BoCuc, U: ThangBoMB[], ref?: MatBangSua) {
  const dai = daiLoi(mau, dl);
  const truoc = doMB(mau, mb0, dl, tv, bc0, cuaCan, H).dg;
  const thua = mb0.thangBo.filter((t) => {
    if (U.some((u) => cungThang(u, t) || chongThang(u, t))) return false;
    const d = doanTai(mau, mb0, dai, t.matIdx, t.a0 + t.rong / 2);
    return !d.tuDau && !d.tuCuoi;
  }).map((t) => ({ ...t }));
  const T = [...U.map((u) => ({ ...u })), ...thua];
  const mb = banSaoMatBang(mb0), sanDs = sanHo(mau, dl, tv);
  mb.thangBo = T;
  mb.dich ??= {};
  const vtTheoKhoa = new Map(viTriCan(mau, tv).map((v) => [v.khoa, v]));
  let bc = bc0, conLech = 0;
  const daNhuong = new Set<string>();
  const rongDung = (k: string, w: number) => { const v = vtTheoKhoa.get(k); return v ? w + chenhRong(v, canDangDung(v, bc), tv) : w; };
  // vị trí sau dồn khít ở mặt bằng xuất phát (giữ khoảng dư giữa căn cuối và mép mặt tự do)
  const hd0 = dung(mau, mb0, dl), don0 = new Map(viTriCan(hd0, tv, bc).map((v) => [v.khoa, v]));
  let soThayMat = 0;
  mau.mat.forEach((m, mi) => {
    if (!laMatThat(m)) return;
    const tMat = T.filter((t) => t.matIdx === mi), tGoc = mb0.thangBo.filter((t) => t.matIdx === mi);
    if (!tMat.length && !tGoc.length) return;
    if (tMat.length === tGoc.length && tMat.every((t) => tGoc.some((g) => cungThang(g, t) && Math.abs(g.a0 - t.a0) < 1 && Math.abs(g.rong - t.rong) < 1))) return;
    soThayMat++;
    const ds = vatThe(mau, mb0, mi).filter((v) => v.loai === 'can');
    const moc: MocMat[] = [...dai.filter((d) => d.matIdx === mi).map((d) => ({ a0: d.t0, a1: d.t1, loi: true })),
      ...tMat.map((t) => ({ a0: t.a0, a1: t.a0 + t.rong, loi: false }))].sort((a, b) => a.a0 - b.a0);
    // gán căn vào khe theo vị trí căn ở mặt bằng MẪU của tập thang (mặt bằng chung đã có đủ thang) — mọi tầng cùng một cách chia;
    // không có thì theo vị trí chưa dồn của mặt bằng xuất phát
    const refVt = ref ? new Map(vatThe(mau, ref, mi).map((v) => [v.k, v])) : null;
    const viTri = (v: VatThe) => refVt?.get(v.k) ?? v;
    const khe: VatThe[][] = moc.map(() => []);
    khe.push([]);
    for (const v of ds) {
      const r = viTri(v), c = r.a0 + r.w / 2;
      khe[moc.filter((o) => (o.a0 + o.a1) / 2 <= c).length].push(v);
    }
    // nhóm căn liền: tách ở khoảng hở > 600 mm (lõi hub không có dải, chỗ trống của bản vẽ) — mép khoảng hở giữ đúng chỗ
    // 'san' = đầu nhóm hở ra sân trong (QT-69): dãy dài ra / ngắn lại ở đó, không kẹp
    type Bien = { loai: 'thang' | 'loi' | 'giu' | 'tu' | 'san'; a: number };
    const giuHaySan = (a: number, trai: boolean): Bien => ({ loai: sanTaiDau(sanDs, mi, a, !trai) ? 'san' : 'giu', a });
    const bien = (o: MocMat | null, trai: boolean, a: number): Bien =>
      o ? (o.loi ? { loai: 'loi', a } : { loai: 'thang', a: trai ? o.a1 : o.a0 }) : dauTuDo(mau, mb, mi, !trai) ? { loai: 'tu', a } : { loai: 'giu', a };
    const nhom: { vs: VatThe[]; trai: Bien; phai: Bien }[] = [];
    khe.forEach((vs, si) => {
      if (!vs.length) return;
      const g: VatThe[][] = [[vs[0]]];
      for (let i = 1; i < vs.length; i++) {
        const a = viTri(vs[i - 1]), b = viTri(vs[i]);
        if (b.a0 - (a.a0 + a.w) > KHE_HUT_MM) g.push([]);
        g[g.length - 1].push(vs[i]);
      }
      g.forEach((gv, gi) => {
        const d0 = viTri(gv[0]), d1 = viTri(gv[gv.length - 1]);
        nhom.push({
          vs: gv,
          trai: gi === 0 ? bien(si > 0 ? moc[si - 1] : null, true, d0.a0) : giuHaySan(d0.a0, true),
          phai: gi === g.length - 1 ? bien(si < moc.length ? moc[si] : null, false, d1.a0 + d1.w) : giuHaySan(d1.a0 + d1.w, false),
        });
      });
    });
    const goc = (k: string) => { const [mm, ii] = k.split(':').map(Number); return mau.mat[mm].phan_tu[ii].a0; };
    for (const { vs, trai, phai } of nhom) {
      const dau = vs[0], cuoi = vs[vs.length - 1];
      const tuL = trai.loai === 'tu', tuR = phai.loai === 'tu', L = trai.a, R = phai.a;
      const sanL = trai.loai === 'san', sanR = phai.loai === 'san';
      const tong = () => vs.reduce((s, v) => s + rongDung(v.k, v.w), 0);
      if (!tuL && !tuR && !sanL && !sanR && (trai.loai === 'thang' || phai.loai === 'thang')) {
        // kẹp hai mốc (có ô thang): căn nhường chỗ (STRETCH căn giữa) cho dãy khít — không đè; hở ≤ 400 mm là tường (khe.ts)
        const viPham = (l: number) => (l > 2 ? l : 0) + (l < -KHE_TUONG_MM ? -l - KHE_TUONG_MM : 0);
        const l0 = L + tong() - R;
        let can = l0 > 2 ? -Math.ceil((l0 - 2) / ST_BUOC_MM) * ST_BUOC_MM : l0 < -KHE_TUONG_MM ? Math.ceil((-l0 - KHE_TUONG_MM) / ST_BUOC_MM) * ST_BUOC_MM : 0;
        const coKeo = vs.filter((v) => congNangTai(v.k, bc) === 'can' && tv.can.get(canDangDung(vtTheoKhoa.get(v.k)!, bc))?.vi_tri === 'giua'
          && tv.can.get(tachMa(canDangDung(vtTheoKhoa.get(v.k)!, bc)).goc)?.stretch);
        for (let vong = 0; can !== 0 && vong < (2 * ST_MAX) / ST_BUOC_MM; vong++) {
          let doi = false;
          for (const v of coKeo) {
            if (can === 0) break;
            const id = canDangDung(vtTheoKhoa.get(v.k)!, bc), { goc: g, st } = tachMa(id), b = Math.sign(can) * ST_BUOC_MM, moi = maBienThe(g, st + b);
            if (Math.abs(st + b) > ST_MAX || !tv.can.has(moi)) continue;
            bc = voiCanViTri(bc, v.k, moi);
            daNhuong.add(v.k);
            can -= b;
            doi = true;
          }
          if (!doi) break;
        }
        // còn lệch: đổi căn giữa sang mẫu CÙNG LOẠI khác bề ngang (kể cả biến thể STRETCH) — giữ cơ cấu, chọn phép khít nhất
        for (let lan = 0; lan < 3 && viPham(L + tong() - R) > 0; lan++) {
          const lech = L + tong() - R;
          let tot3: { k: string; id: string; con: number } | null = null;
          for (const v of vs) {
            const vt = vtTheoKhoa.get(v.k);
            const c = vt && congNangTai(v.k, bc) === 'can' ? tv.can.get(canDangDung(vt, bc)) : undefined;
            if (!vt || !c || c.vi_tri !== 'giua') continue;
            for (const x of tv.can.values()) {
              if (x.nhom !== c.nhom || x.loai !== c.loai || x.vi_tri !== 'giua' || x.sau_mm !== c.sau_mm || x.id === c.id) continue;
              const con = viPham(lech + x.rong_mm - c.rong_mm);
              if (con < viPham(lech) - 1 && (!tot3 || con < tot3.con - 1e-6 || (Math.abs(con - tot3.con) <= 1e-6 && x.id < tot3.id))) tot3 = { k: v.k, id: x.id, con };
            }
          }
          if (!tot3) break;
          bc = voiCanViTri(bc, tot3.k, tot3.id);
          daNhuong.add(tot3.k);
        }
        conLech += viPham(L + tong() - R);
      }
      // dồn từ mốc giữ chỗ (như donKhit: lõi trước, rồi thang, không thì đầu trái); đầu tự do dài ra / ngắn lại
      const tuTrai = tuR || sanR ? true : tuL || sanL ? false : trai.loai === 'loi' ? true : phai.loai === 'loi' ? false : trai.loai === 'thang' ? true : phai.loai !== 'thang';
      if (tuTrai) {
        let a = L;
        for (const v of vs) { mb.dich![v.k] = a - goc(v.k); a += v.w; }
        if (tuR) {
          const [, aC] = mepMat(mau, mb, mi), du = aC - (don0.get(cuoi.k)?.a1 ?? aC);
          const d = L + tong() + du - aC;
          if (Math.abs(d) > 1) gianMat(mau, mb, mi, true, d);
        } else if (sanR) {
          // đầu sân: nét bao (đã theo dãy ở mặt bằng xuất phát) nối tiếp tới đầu dãy mới
          const aE = don0.get(cuoi.k)?.a1 ?? R, d = L + tong() - aE;
          if (Math.abs(d) > 1) noiDauSan(mau, mb, mi, aE, true, d);
        }
      } else {
        let a = R;
        for (const v of [...vs].reverse()) { a -= v.w; mb.dich![v.k] = a - goc(v.k); }
        if (tuL) {
          const [aD] = mepMat(mau, mb, mi), du = (don0.get(dau.k)?.a0 ?? aD) - aD;
          const d = aD - (R - tong() - du);
          if (Math.abs(d) > 1) gianMat(mau, mb, mi, false, -d);
        } else if (sanL) {
          const aE = don0.get(dau.k)?.a0 ?? L, d = aE - (R - tong());
          if (Math.abs(d) > 1) noiDauSan(mau, mb, mi, aE, false, d);
        }
      }
    }
  });
  if (!soThayMat) return { mb, bc, truoc, sau: truoc, tn: doMB(mau, mb, dl, tv, bc, cuaCan, H).tn, soThem: 0, soDoi: 0, soBo: 0, soChuyen: 0, khongDat: 0, thua, soNhuong: 0, conLech: 0 };
  const cuaMoi = cuaCanDung(viTriCan(mau, tv).map((v) => canDangDung(v, bc)), tv, dl?.cuaCan ?? {});
  const r = doMB(mau, mb, dl, tv, bc, { ...cuaCan, ...cuaMoi }, H);
  const soThem = U.filter((u) => !mb0.thangBo.some((t) => cungThang(t, u))).length;
  const soBo = mb0.thangBo.filter((t) => !T.some((u) => cungThang(u, t))).length;
  return { mb, bc, truoc, sau: r.dg, tn: r.tn, soThem, soDoi: 0, soBo, soChuyen: 0, khongDat: 0, thua, soNhuong: daNhuong.size, conLech: Math.round(conLech) };
}

/** Dời thang trong cùng đoạn tới chỗ cắt p (đổi chỗ với các vật thể ở giữa, mặt không dài ra), lật cửa theo sx. */
function doiThang(mau: ToaMB, mb: MatBangSua, khoa: string, p: number, sx: 1 | -1): boolean {
  const t = mb.thangBo.find((x) => x.khoa === khoa);
  if (!t) return false;
  const vt = vatThe(mau, mb, t.matIdx).filter((v) => v.k !== khoa);
  if (p > t.a0 + t.rong - 1) {
    vt.filter((v) => v.a0 >= t.a0 + t.rong - 1 && v.a0 + v.w <= p + 1).forEach((v) => dich(mb, v, -t.rong));
    t.a0 = p - t.rong;
  } else if (p < t.a0 + 1) {
    vt.filter((v) => v.a0 >= p - 1 && v.a0 + v.w <= t.a0 + 1).forEach((v) => dich(mb, v, t.rong));
    t.a0 = p;
  }
  if (t.sx !== sx || t.nguon === 'them' || Math.abs(t.rong - O_THANG_MM) > 20) { t.sx = sx; t.dIns = dInsThang(sx); }
  return true;
}

/** Các đoạn (giữa hai mốc dải lõi / đầu mặt) trên mặt mi. */
function dsDoan(mau: ToaMB, mb: MatBangSua, dai: DaiLoi[], mi: number): Doan[] {
  const [aDau] = mepMat(mau, mb, mi);
  const kq: Doan[] = [];
  for (const a of [aDau + 1, ...dai.filter((d) => d.matIdx === mi).map((d) => d.t1 + 1)]) {
    const dn = doanTai(mau, mb, dai, mi, a);
    if (dn.hi - dn.lo > 1 && !kq.some((o) => Math.abs(o.lo - dn.lo) < 1 && Math.abs(o.hi - dn.hi) < 1)) kq.push(dn);
  }
  return kq;
}

/**
 * Trạm của thang trên trục hành lang (app cũ `station`): chiếu cửa buồng thang lên đoạn trục (không phải đoạn nối) song song
 * mặt gần nhất; trả chỉ số đoạn + toạ độ dọc trục (không kẹp, để hai thang ngoài đầu trục vẫn đo đúng).
 */
function tramThang(mau: ToaMB, mb: MatBangSua, t: ThangBoMB): { truc: number; s: number } | null {
  const p = cuaThang(mau, t), u = coSo(mau.mat[t.matIdx].goc_deg, 0).u;
  let tot3: { truc: number; s: number; d: number } | null = null;
  mb.hanhLang.forEach((ax, i) => {
    if (ax.noi) return;
    const v: Diem = [ax.p1[0] - ax.p0[0], ax.p1[1] - ax.p0[1]], L = Math.hypot(v[0], v[1]);
    if (L < 1) return;
    const w: Diem = [v[0] / L, v[1] / L];
    if (Math.abs(u[0] * w[0] + u[1] * w[1]) < 0.999) return;
    const q: Diem = [p[0] - ax.p0[0], p[1] - ax.p0[1]], s = q[0] * w[0] + q[1] * w[1], a = Math.max(0, Math.min(L, s));
    const d = Math.hypot(q[0] - a * w[0], q[1] - a * w[1]);
    if (!tot3 || d < tot3.d) tot3 = { truc: i, s, d };
  });
  return tot3;
}

/** Cửa buồng thang (mm, thế giới) theo ô thang. */
function cuaThang(mau: ToaMB, t: ThangBoMB): Diem {
  const m = mau.mat[t.matIdx], B = coSo(m.goc_deg, m.truc_mm);
  return B.pt(t.a0 + t.dIns + t.sx * TIM_CUA_THANG_MM, 0);
}

/** `thangEp`: tập thang phải đặt đúng chỗ (thang liền suốt chiều cao) — thay PC-11 tự dò. */
/** `giu`: khoá các ô người dùng tự chọn căn (không bỏ, chỉ đổi cùng loại khi khít đoạn kẹp); thiếu = các khoá trong `bc.canViTri`. */
/**
 * `giu` = ô người dùng tự chọn căn (khít đoạn kẹp không bỏ); `chan` = ô người dùng VỪA chọn tay ở phép sửa này — khít không được
 * đổi sang loại khác, không vừa thì báo chặn (`KetQuaGiam.chan`). Bộ tối ưu tự động không truyền `chan` nên vẫn được đổi loại.
 */
/** `thangTay`: thang người dùng đặt tay — áp lên mặt bằng xuất phát, PC-11 giữ nguyên tập thang (lựa chọn tay). */
/** `loaiThang`: loại thang chọn tay (khoá → N2 / N3, `ToaDat.loaiThang`) — ganLoaiThang giữ ≥ 1 N2 + ≥ 1 N3. */
/** `thangTruoc`: tập thang của lần tự chỉnh trước (PC-11 giữ nếu vẫn đạt — thang không nhảy chỗ khi sửa căn). */
export type TuyChonTuChinh = { chieuCaoPCCC: number; bc: BoCuc; thangEp?: ThangBoMB[]; thangMau?: MatBangSua; giu?: string[]; chan?: string[]; thangTay?: ThangTay; loaiThang?: Record<string, string>; thangTruoc?: ThangBoMB[]; thangTruocVuot?: number;
  /** Bố cục của một tầng riêng: thang liền suốt chiều cao nên thang là mốc (không dồn qua thang — donQuaThang). */
  tangRieng?: boolean };

/**
 * PC-11 (QT-44): xuất phát từ thang của bản vẽ; mỗi lượt đo thật (thoatNan) rồi chọn MỘT phép tốt nhất: dời một thang tới chỗ
 * cắt khác trong đoạn của nó (lật cửa hai chiều), hoặc thêm một thang (≤ 3) cạnh căn tệ nhất. Hết căn vượt / hết phép tốt hơn /
 * 8 lượt thì dừng; còn căn vượt thì dò rộng (doRong: thêm mọi đoạn / chuyển mặt / dời đôi, hai điểm xuất phát). Sau đó cắt bớt
 * thang theo thứ tự cố định (mặt rồi vị trí) chừng nào vẫn không thêm căn vượt và còn ≥ 2 thang.
 * Hai thang trên cùng một mặt phải cách nhau ≥ ngưỡng hành lang cụt (luật nội bộ MDI do chủ nhiệm chốt, QT-44).
 */
function thangTuDong(mau: ToaMB, mb0: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, cuaCan: Record<string, number>, H: number, bc: BoCuc, coDinh = false,
  truocTB?: readonly ThangBoMB[], truocVuot?: number) {
  const dai = daiLoi(mau, dl);
  const kcMin = gioiHanThoatNan(H).cut * 1000;
  const vtsGoc = viTriCan(mau, tv);
  const chenh = new Map(vtsGoc.map((v) => [v.khoa, chenhRong(v, canDangDung(v, bc), tv)]));
  const hopLe = (mb: MatBangSua, moi: string) => {
    const t = mb.thangBo.find((x) => x.khoa === moi);
    if (!t) return true;
    const p = cuaThang(mau, t);
    if (!mb.thangBo.every((o) => o === t || o.matIdx !== t.matIdx || kc(cuaThang(mau, o), p) >= kcMin)) return false;
    // app cũ (datThangBo · legal): hai thang chiếu lên CÙNG trục hành lang phải cách nhau ≥ ngưỡng cụt (kể cả khác mặt)
    const a = tramThang(mau, mb, t);
    return !a || mb.thangBo.every((o) => { if (o === t) return true; const b = tramThang(mau, mb, o); return !b || b.truc !== a.truc || Math.abs(b.s - a.s) >= kcMin; });
  };
  // đo trên mặt bằng đã kéo trục hành lang tới cửa thang / căn đã dời (XC-07 chạy sau PC-11): thang ở đầu dãy mới tính đúng
  // phép tạo khe / đè (tinh/khe.ts) nhiều hơn mặt bằng xuất phát thì loại ngay trong lúc dò (không đợi gác cuối bỏ cả PC-11)
  const kheGoc = tongKhe(dung(mau, mb0, dl), tv, bc);
  const xet = (mb: MatBangSua) => {
    const c = banSaoMatBang(mb);
    hanhLangToiCua(mau, c, dl, cuaCan);
    const hd = dung(mau, c, dl), r = danhGia(hd, bc, tv, cuaCan, H);
    if (mb !== mb0) { const k = tongKhe(hd, tv, bc); if (k.de > kheGoc.de || k.mm > kheGoc.mm + 200) r.dg = { ...r.dg, vuot: 1e6 }; }
    return r;
  };
  const truoc = xet(mb0).dg;
  type Loai = 'doi' | 'them' | 'chuyen';
  type Dem = { doi: number; them: number; chuyen: number };
  type KqLeo = { c: MatBangSua; dg: ReturnType<typeof xet>; dem: Dem };
  const daXet = new Map<string, ReturnType<typeof xet>>();
  const xetNho = (mb: MatBangSua) => {
    const k = JSON.stringify([mb.thangBo.map((t) => [t.matIdx, Math.round(t.a0), t.sx]).sort(), mb.dich, mb.mep]);
    let r = daXet.get(k);
    if (!r) { r = xet(mb); daXet.set(k, r); }
    return r;
  };
  /** Leo gần: mỗi lượt MỘT phép tốt nhất — dời một thang trong đoạn (lật cửa), hoặc (choThem) thêm một thang cạnh căn tệ nhất. */
  const leoGan = (goc: MatBangSua, dgGoc: ReturnType<typeof xet>, choThem: boolean): KqLeo => {
    let cur = goc, dgCur = dgGoc;
    const dem: Dem = { doi: 0, them: 0, chuyen: 0 };
    for (let luot = 0; luot < LUOT_MAX && dgCur.dg.vuot > 0; luot++) {
      let tot1: { mb: MatBangSua; r: ReturnType<typeof xet>; loai: 'doi' | 'them' } | null = null;
      const thu = (mb: MatBangSua, loai: 'doi' | 'them') => {
        const r = xetNho(mb);
        if (tot(r.dg, dgCur.dg) && (!tot1 || tot(r.dg, tot1.r.dg))) tot1 = { mb, r, loai };
      };
      for (const t of cur.thangBo) {
        const dn = doanTai(mau, cur, dai, t.matIdx, t.a0 + t.rong / 2);
        for (const p of choCat(vatThe(mau, cur, t.matIdx), dn, chenh)) {
          for (const sx of [1, -1] as const) {
            if ((Math.abs(p - t.a0) < 1 || Math.abs(p - t.a0 - t.rong) < 1) && sx === t.sx) continue;
            const mb = banSaoMatBang(cur);
            if (doiThang(mau, mb, t.khoa, p, sx) && hopLe(mb, t.khoa)) thu(mb, 'doi');
          }
        }
      }
      if (choThem && cur.thangBo.length < THANG_MAX) {
        const xau = dgCur.tn.can.filter((c) => c.vuot).sort((a, b) => (b.cuLy ?? 1e9) - b.nguong - ((a.cuLy ?? 1e9) - a.nguong))[0];
        const vts = viTriCan(dung(mau, cur, dl), tv), kXau = xau && dgCur.khoaCan[xau.so - 1];
        const vtXau = kXau ? vts.find((v) => v.khoa === kXau) : undefined;
        if (vtXau) {
          const mi = vtXau.matIdx, khoa = `tb${luot}:${mi}:${Math.round(vtXau.a0)}`;
          const dn = doanTai(mau, cur, dai, mi, (vtXau.a0 + vtXau.a1) / 2);
          for (const p of choCat(vatThe(mau, cur, mi), dn, chenh)) {
            if (Math.abs(p - (vtXau.a0 + vtXau.a1) / 2) > kcMin) continue;
            for (const sx of [1, -1] as const) {
              const mb = banSaoMatBang(cur);
              if (themThang(mau, mb, dai, mi, p, sx, khoa) && hopLe(mb, khoa)) thu(mb, 'them');
            }
          }
        }
      }
      if (!tot1) break;
      const t1 = tot1 as { mb: MatBangSua; r: ReturnType<typeof xet>; loai: 'doi' | 'them' };
      cur = t1.mb; dgCur = t1.r; dem[t1.loai]++;
    }
    return { c: cur, dg: dgCur, dem };
  };
  /**
   * Dò rộng như datThangBo app cũ: dời trong đoạn, CHUYỂN một thang sang mặt / đoạn khác (bỏ ở đoạn cũ: dãy co lại ở đầu tự do; đặt
   * ở chỗ cắt mới: dãy dài ra), kẹt thì dời HAI thang cùng lúc; `choThem` = được thêm một thang (≤ 3) ở bất kỳ đoạn nào.
   */
  const doRong = (goc: MatBangSua, dgGoc: ReturnType<typeof xet>, choThem: boolean): KqLeo => {
    let c = goc, dg = dgGoc;
    const dem: Dem = { doi: 0, them: 0, chuyen: 0 };
    for (let luot = 0; luot < LUOT_RONG && dg.dg.vuot > 0; luot++) {
      let tot2: { mb: MatBangSua; r: ReturnType<typeof xet>; loai: Loai } | null = null;
      const thu = (mb: MatBangSua, loai: Loai) => {
        const r = xetNho(mb);
        if (tot(r.dg, dg.dg) && (!tot2 || tot(r.dg, tot2.r.dg))) tot2 = { mb, r, loai };
      };
      const datMoiCho = (nen: MatBangSua, khoa: string, loai: Loai) => {
        mau.mat.forEach((m, mi) => {
          if (!laMatThat(m)) return;
          for (const dn of dsDoan(mau, nen, dai, mi)) {
            if (!dn.tuDau && !dn.tuCuoi) continue;
            for (const p of choCat(vatThe(mau, nen, mi), dn, chenh)) for (const sx of [1, -1] as const) {
              const mb = banSaoMatBang(nen);
              if (themThang(mau, mb, dai, mi, p, sx, khoa) && hopLe(mb, khoa)) thu(mb, loai);
            }
          }
        });
      };
      for (const t of c.thangBo) {
        const dn = doanTai(mau, c, dai, t.matIdx, t.a0 + t.rong / 2);
        for (const p of choCat(vatThe(mau, c, t.matIdx), dn, chenh)) for (const sx of [1, -1] as const) {
          if ((Math.abs(p - t.a0) < 1 || Math.abs(p - t.a0 - t.rong) < 1) && sx === t.sx) continue;
          const mb = banSaoMatBang(c);
          if (doiThang(mau, mb, t.khoa, p, sx) && hopLe(mb, t.khoa)) thu(mb, 'doi');
        }
      }
      if (choThem && c.thangBo.length < THANG_MAX) datMoiCho(c, `tbr${luot}`, 'them');
      for (const t of c.thangBo) {
        const bo = banSaoMatBang(c);
        if (boThang(mau, bo, dai, t.khoa)) datMoiCho(bo, t.khoa, 'chuyen');
      }
      // kẹt (không phép đơn nào tốt hơn): dời HAI thang cùng lúc trong đoạn của chúng (giữ chiều cửa)
      if (!tot2) {
        const cats = c.thangBo.map((t) => choCat(vatThe(mau, c, t.matIdx), doanTai(mau, c, dai, t.matIdx, t.a0 + t.rong / 2), chenh));
        for (let i = 0; i < c.thangBo.length; i++) for (let j = i + 1; j < c.thangBo.length; j++) {
          const ti = c.thangBo[i], tj = c.thangBo[j];
          for (const p of cats[i]) {
            if (Math.abs(p - ti.a0) < 1 || Math.abs(p - ti.a0 - ti.rong) < 1) continue;
            const mi = banSaoMatBang(c);
            if (!doiThang(mau, mi, ti.khoa, p, ti.sx)) continue;
            for (const q of choCat(vatThe(mau, mi, tj.matIdx), doanTai(mau, mi, dai, tj.matIdx, mi.thangBo[j].a0 + tj.rong / 2), chenh)) {
              const tj1 = mi.thangBo[j];
              if (Math.abs(q - tj1.a0) < 1 || Math.abs(q - tj1.a0 - tj1.rong) < 1) continue;
              const mb = banSaoMatBang(mi);
              if (doiThang(mau, mb, tj.khoa, q, tj.sx) && hopLe(mb, ti.khoa) && hopLe(mb, tj.khoa)) thu(mb, 'doi');
            }
          }
        }
      }
      if (!tot2) break;
      const t2 = tot2 as { mb: MatBangSua; r: ReturnType<typeof xet>; loai: Loai };
      c = t2.mb; dg = t2.r; dem[t2.loai]++;
    }
    return { c, dg, dem };
  };
  const cong = (a: Dem, b: Dem): Dem => ({ doi: a.doi + b.doi, them: a.them + b.them, chuyen: a.chuyen + b.chuyen });
  /** Đặt lại tập thang `ds` (lần tự chỉnh trước) lên mb0: thang mẫu trùng chỗ giữ, thang khác bỏ, rồi chèn ds theo chỗ cũ. */
  function datLaiThang(ds: readonly ThangBoMB[]): KqLeo | null {
    if (ds.length < THANG_MIN || ds.length > THANG_MAX) return null;
    const mb = banSaoMatBang(mb0);
    for (const t of [...mb.thangBo]) {
      if (ds.some((u) => cungThang(u, t))) continue;
      // thang mẫu đã dời (PC-11 / XC-05) ở lần trước: dời lại tới đúng chỗ cũ trong đoạn của nó
      const u = ds.find((x) => x.khoa === t.khoa && x.matIdx === t.matIdx);
      if (u) {
        const muc = u.a0 < t.a0 ? u.a0 : u.a0 + u.rong;
        const cuts = choCat(vatThe(mau, mb, t.matIdx), doanTai(mau, mb, dai, t.matIdx, t.a0 + t.rong / 2), chenh);
        const p = cuts.sort((x, y) => Math.abs(x - muc) - Math.abs(y - muc))[0];
        if (p !== undefined && Math.abs(p - muc) < 1 && doiThang(mau, mb, t.khoa, p, u.sx)) continue;
      }
      if (!boThang(mau, mb, dai, t.khoa)) return null;
    }
    const con = ds.filter((u) => !mb.thangBo.some((t) => cungThang(u, t)));
    const h = con.length ? hopThang(mau, mb, dl, tv, bc, con.map((t) => ({ ...t }))) : { mb, khongDat: 0 };
    if (h.khongDat || h.mb.thangBo.length !== ds.length) return null;
    // khoá giữ như lần trước (thang mẫu trùng chỗ mang khoá mẫu — đổi về khoá cũ để loại thang chọn tay không mất)
    // đặt lại phải ĐÚNG chỗ cũ (điểm chèn, chiều cửa) — lệch thì dò lại từ đầu (tự chỉnh bất động: chạy lại không trôi thang)
    if (!ds.every((u) => h.mb.thangBo.some((t) => cungThang(u, t)))) return null;
    for (const t of h.mb.thangBo) { const u = ds.find((x) => cungThang(x, t)); if (u) t.khoa = u.khoa; }
    if (new Set(h.mb.thangBo.map((t) => t.khoa)).size !== h.mb.thangBo.length || !h.mb.thangBo.every((t) => hopLe(h.mb, t.khoa))) return null;
    const r = xetNho(h.mb);
    // không tệ hơn lần trước (số căn vượt trước khi gỡ) thì giữ — tòa cao mà ≤ 3 thang không gỡ hết được vẫn giữ thang
    return r.dg.vuot <= (truocVuot ?? 0) ? { c: h.mb, dg: r, dem: { doi: 0, them: 0, chuyen: 0 } } : null;
  }
  /** Tối ưu từ `goc`: leo gần rồi (còn vượt) dò rộng từ hai điểm xuất phát (kết quả leo gần và chính `goc`). */
  const toiUu = (goc: MatBangSua, choThem: boolean, nhanh = false): KqLeo => {
    const dg0 = xetNho(goc);
    const a = leoGan(goc, dg0, choThem);
    if (a.dg.dg.vuot === 0 || nhanh) return a;
    const r1 = doRong(a.c, a.dg, choThem);
    if (a.c === goc || r1.dg.dg.vuot === 0) return { ...r1, dem: cong(a.dem, r1.dem) };
    const r2 = doRong(goc, dg0, choThem);
    return tot(r2.dg.dg, r1.dg.dg) ? r2 : { ...r1, dem: cong(a.dem, r1.dem) };
  };
  // Mặc định 2 thang bộ (app cũ datThangBo: hạt giống là từng CẶP thang của bản vẽ, tối ưu vị trí với 2 thang); chỉ khi 2 thang
  // vẫn còn căn vượt cự ly mới thử thang thứ 3 (≤ THANG_MAX) và nhận nếu tốt hơn.
  let kq: KqLeo = { c: mb0, dg: xetNho(mb0), dem: { doi: 0, them: 0, chuyen: 0 } };
  let soBo = 0;
  // Giữ thang ổn định qua các lần sửa (và nhanh): tập thang của lần tự chỉnh trước đặt lại vào mặt bằng mới (chỗ cắt gần nhất,
  // giữ khoá → giữ loại N2 / N3 đã chọn); vẫn 0 căn vượt + không khe / đè mới thì nhận luôn, không dò lại từ đầu.
  const giuTruoc = !coDinh && truocTB ? datLaiThang(truocTB) : null;
  if (giuTruoc) kq = giuTruoc;
  if (!coDinh && !giuTruoc) {
    const hat: { mb: MatBangSua; bo: number }[] = [];
    if (mb0.thangBo.length <= THANG_MIN) hat.push({ mb: mb0, bo: 0 });
    else {
      // bỏ bớt thang cho còn 2: mọi cặp thang của bản vẽ (bỏ được ở đầu tự do)
      const thuBo = (nen: MatBangSua, con: string[], bo: number) => {
        if (nen.thangBo.length <= THANG_MIN) { hat.push({ mb: nen, bo }); return; }
        con.forEach((k, i) => {
          const mb = banSaoMatBang(nen);
          if (boThang(mau, mb, dai, k)) thuBo(mb, con.slice(i + 1), bo + 1);
        });
      };
      thuBo(mb0, mb0.thangBo.map((t) => t.khoa), 0);
    }
    let tot2: (KqLeo & { bo: number }) | null = null;
    // mẫu vẽ 3 thang: cặp thang thử nhanh (leo gần) — dò rộng dành cho tập 3 thang của bản vẽ
    const ba = mb0.thangBo.length > THANG_MIN;
    for (const h of hat) {
      const r = toiUu(h.mb, false, ba);
      if (!tot2 || tot(r.dg.dg, tot2.dg.dg)) tot2 = { ...r, bo: h.bo };
      if (tot2.dg.dg.vuot === 0) break;
    }
    if (tot2) { kq = tot2; soBo = tot2.bo; }
    if (kq.dg.dg.vuot > 0) {
      // 3 thang: thêm một thang vào kết quả 2 thang, hoặc giữ 3 thang của bản vẽ và tối ưu vị trí
      let them = toiUu(kq.c, true, ba);
      // hạt giống thứ hai: thang của bản vẽ (2 thang) rồi thêm thang thứ 3 cạnh căn tệ nhất
      if (!ba && kq.c !== mb0) { const b = toiUu(mb0, true); if (tot(b.dg.dg, them.dg.dg)) them = b; }
      const giu = mb0.thangBo.length > THANG_MIN && mb0.thangBo.length <= THANG_MAX ? toiUu(mb0, false) : null;
      if (giu && tot(giu.dg.dg, kq.dg.dg) && !tot(them.dg.dg, giu.dg.dg)) { kq = giu; soBo = 0; }
      else if (tot(them.dg.dg, kq.dg.dg)) kq = { ...them, dem: cong(kq.dem, them.dem) };
    }
  }
  let cur = kq.c, dgCur = kq.dg;
  let soThem = kq.dem.them;
  const soDoi = kq.dem.doi, soChuyen = kq.dem.chuyen;
  // cắt bớt: thứ tự cố định (mặt rồi vị trí), giữ ≥ 2 thang, không thêm căn vượt
  if (cur.thangBo.length > THANG_MIN && dgCur.dg.vuot === 0 && !coDinh) {
    for (const t of [...cur.thangBo].sort((a, b) => a.matIdx - b.matIdx || a.a0 - b.a0)) {
      if (cur.thangBo.length <= THANG_MIN) break;
      const mb = banSaoMatBang(cur);
      if (!boThang(mau, mb, dai, t.khoa)) continue;
      const r = xetNho(mb);
      if (r.dg.vuot === 0 && r.dg.khongToi <= dgCur.dg.khongToi) { cur = mb; dgCur = r; soBo++; }
    }
  }
  void soThem; void soBo; void soDoi; void soChuyen;
  // số thao tác báo cáo = so với thang của bản vẽ (mb0), không theo đường dò — dò lại hay giữ thang lần trước đều báo như nhau
  const cu = new Map(mb0.thangBo.map((t) => [t.khoa, t]));
  const dem = { them: 0, doi: 0, bo: 0, chuyen: 0 };
  for (const t of cur.thangBo) {
    const g = cu.get(t.khoa);
    if (!g) dem.them++;
    else if (g.matIdx !== t.matIdx) dem.chuyen++;
    else if (!cungThang(g, t)) dem.doi++;
  }
  dem.bo = mb0.thangBo.filter((g) => !cur.thangBo.some((t) => t.khoa === g.khoa)).length;
  if (dem.them && dem.bo) { const n = Math.min(dem.them, dem.bo); dem.them -= n; dem.bo -= n; dem.chuyen += n; }
  return { mb: cur, truoc, sau: dgCur.dg, tn: dgCur.tn, soThem: dem.them, soDoi: dem.doi, soBo: dem.bo, soChuyen: dem.chuyen };
}

// ---------- XC-05: căn khít nét bao lõi ----------
type DoKhit = { khoaLoi: string; matIdx: number; ben: 'dau' | 'cuoi'; chong: number };
/** Độ chồng (+) / hở (−) giữa khung căn / ô thang kề và nét bao lõi, trên các mặt có dải lõi (sau dồn khít). */
export function doKhitLoi(mauHD: ToaMB, dai: DaiLoi[]): DoKhit[] {
  const kq: DoKhit[] = [];
  for (const d of dai) {
    const el = mauHD.mat[d.matIdx].phan_tu.filter((q) => !q.bang && q.rong_mm > 0);
    const L = el.filter((q) => q.a0 < d.t0 && q.a1 > d.t0 - 3000).sort((a, b) => b.a1 - a.a1)[0];
    const R = el.filter((q) => q.a1 > d.t1 && q.a0 < d.t1 + 3000).sort((a, b) => a.a0 - b.a0)[0];
    if (L && L.a1 - d.t0 <= LECH_DAI_LOI_MM) kq.push({ khoaLoi: d.khoaLoi, matIdx: d.matIdx, ben: 'dau', chong: L.a1 - d.t0 });
    if (R && d.t1 - R.a0 <= LECH_DAI_LOI_MM) kq.push({ khoaLoi: d.khoaLoi, matIdx: d.matIdx, ben: 'cuoi', chong: d.t1 - R.a0 });
  }
  return kq;
}

/** Kết quả sửa XC-05: số chỗ đã sửa (dời đoạn / STRETCH), bố cục sau STRETCH, lý do các chỗ không sửa được. */
type SuaKhit = { sua: number; bc: BoCuc; stretch: number; lyDo: string[] };
/** Ô người dùng vừa chọn tay (không STRETCH) / đã chọn (STRETCH sau cùng). */
type OptKhit = { khongKeo?: ReadonlySet<string>; giu?: ReadonlySet<string> };

/**
 * Sửa XC-05: hở / đè quá tường chung thì dời cả đoạn căn kề lõi về khít (chồng 0, QT-56). Đoạn có đầu tự do: đầu đó co / giãn
 * theo (nét bao nối). Đoạn kẹp (giữa lõi và thang / lõi khác / cánh khác, hoặc thang liền không được dời): dời trong khoảng giữa
 * hai mốc, thiếu / thừa thì STRETCH QT-81 (khitKepLoi). `mb` sửa tại chỗ; bố cục mới (biến thể `id~s±N`) trả trong `bc`.
 */
function suaKhitLoi(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc, giuThang = false, opt: OptKhit = {}): SuaKhit {
  const dai = daiLoi(mau, dl);
  let sua = 0, stretch = 0, cur = bc;
  const lyDo: string[] = [];
  for (const k of doKhitLoi(capNhatDonKhit(mau, mb, dl, tv, bc), dai)) {
    if (Math.abs(k.chong) <= TUONG_CHUNG_MM) continue;
    const d = dai.find((x) => x.khoaLoi === k.khoaLoi && x.matIdx === k.matIdx)!;
    const a = k.ben === 'dau' ? d.t0 - 1 : d.t1 + 1, dn = doanTai(mau, mb, dai, k.matIdx, a);
    const vt = vatThe(mau, mb, k.matIdx).filter((v) => v.a0 >= dn.lo - 1 && v.a0 + v.w <= dn.hi + 1);
    // đoạn phía đầu: dời +(-chong) về lõi, đầu tự do co / giãn theo; đoạn phía cuối: dời +chong
    const dd = k.ben === 'dau' ? -k.chong : k.chong;
    // thang liền các tầng: không dời đoạn có thang — khít trong đoạn kẹp bên dưới (thang đứng yên)
    if (!(giuThang && vt.some((v) => v.loai === 'thang'))
      && (k.ben === 'dau' ? dn.tuDau && gianMat(mau, mb, k.matIdx, false, -dd) : dn.tuCuoi && gianMat(mau, mb, k.matIdx, true, dd))) {
      vt.forEach((v) => dich(mb, v, dd));
      sua++;
      continue;
    }
    const r = khitKepLoi(mau, mb, dl, tv, cur, dai, k, opt);
    if (typeof r === 'string') { lyDo.push(`mặt ${k.matIdx + 1} (${Math.round(k.chong)} mm): ${r}`); continue; }
    Object.assign(mb, r.mb);
    cur = r.bc; sua++; stretch += r.st;
  }
  return { sua, bc: cur, stretch, lyDo };
}

/**
 * XC-05 · đoạn kẹp (QT-56 · QT-22b · QT-81 app cũ): đoạn căn kề lõi không có đầu tự do. Dời đoạn trong khoảng giữa nét bao lõi
 * và mốc phía xa (ô thang, dải lõi khác, dãy khác, đầu mặt không tự do) cho chồng / hở lõi ≤ 200 mm; tổng bề ngang không vừa
 * thì STRETCH (bước 100, ±500 mỗi căn, cắt qua phòng khách) căn kề lõi trước rồi căn khác trong đoạn, để tổng bề ngang khớp hai
 * mốc. Nhận phương án đầu tiên (ít STRETCH nhất) mà đo lại bằng tinh/khe.ts không thêm đè / khe và không thêm chỗ lệch lõi.
 * Trả mặt bằng + bố cục mới và tổng mm STRETCH, hoặc lý do không sửa được.
 */
function khitKepLoi(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc, dai: DaiLoi[], k: DoKhit, opt: OptKhit):
  { mb: MatBangSua; bc: BoCuc; st: number } | string {
  const mi = k.matIdx, cuoi = k.ben === 'cuoi', d = dai.find((x) => x.khoaLoi === k.khoaLoi && x.matIdx === mi)!;
  const hd = dung(mau, mb, dl), vts = viTriCan(hd, tv, bc), vm = vts.filter((v) => v.matIdx === mi);
  // phần tử kề lõi phải là căn (ô thang kề lõi: thang đứng yên — XC-03 / thang liền)
  const ke = cuoi ? vm.filter((v) => v.a1 > d.t1 && v.a0 < d.t1 + 3000).sort((a, b) => a.a0 - b.a0)[0]
    : vm.filter((v) => v.a0 < d.t0 && v.a1 > d.t0 - 3000).sort((a, b) => b.a1 - a.a1)[0];
  if (!ke || (cuoi ? ke.a0 - d.t1 : d.t0 - ke.a1) > LECH_DAI_LOI_MM) return 'phần tử kề lõi là ô thang (đứng yên)';
  const doan = doanCan(vts).find((o) => o.ds.some((i) => vts[i] === ke))!;
  const run = doan.ds.map((i) => vts[i]);
  // mốc phía xa: ô thang, dải lõi khác, dãy khác trên mặt; không có thì đầu mặt (đầu tự do thì không phải đoạn kẹp)
  const [aDau, aCuoi] = mepMat(mau, mb, mi);
  const moc = [
    ...mb.thangBo.filter((t) => t.matIdx === mi).map((t) => ({ a0: t.a0, a1: t.a0 + t.rong, bang: false })),
    ...dai.filter((x) => x.matIdx === mi && x !== d).map((x) => ({ a0: x.t0, a1: x.t1, bang: true })),
    ...vm.filter((v) => !run.includes(v)).map((v) => ({ a0: v.a0, a1: v.a1, bang: false })),
  ];
  // (mốc đang chồng lên đầu xa của đoạn cũng tính — đè cần gỡ)
  const xa = cuoi ? moc.filter((o) => o.a1 > doan.a1 + KHIT_MM && o.a0 > doan.a0).sort((a, b) => a.a0 - b.a0)[0]
    : moc.filter((o) => o.a0 < doan.a0 - KHIT_MM && o.a1 < doan.a1).sort((a, b) => b.a1 - a.a1)[0];
  if (!xa && dauTuDo(mau, mb, mi, cuoi)) return 'đoạn có đầu tự do nhưng không co / giãn được nét bao';
  // g: hở phía xa (+) / chồng (−); khe tường ≤ 400 mm không tính là khe, dải lõi chồng ≤ 200 mm là tường chung
  const g = xa ? (cuoi ? xa.a0 - doan.a1 : doan.a0 - xa.a1) : cuoi ? aCuoi - doan.a1 : doan.a0 - aDau;
  const gMin = xa?.bang ? -TUONG_CHUNG_MM : -KHIT_MM;
  // phía xa là khoảng trống cỡ hành lang (XC-02): đoạn không kẹp, dời / STRETCH sẽ đổi khoảng trống đó — để nguyên
  const rongMax = Math.max(0, ...vm.map((v) => v.a1 - v.a0));
  if (g > rongMax + KHE_HL_THEM_MM) return `phía xa hở ${Math.round(g)} mm (khoảng trống cỡ hành lang, không phải đoạn kẹp)`;
  // căn STRETCH được: căn hộ có đường cắt, không phải căn người dùng vừa chọn tay; kề lõi trước, căn người dùng đã chọn sau cùng
  const keo = run.filter((v) => congNangTai(v.khoa, bc) === 'can' && !opt.khongKeo?.has(v.khoa) && tv.can.get(tachMa(canDangDung(v, bc)).goc)?.stretch)
    .sort((a, b) => Number(!!opt.giu?.has(a.khoa)) - Number(!!opt.giu?.has(b.khoa)) || (cuoi ? a.a0 - b.a0 : b.a1 - a.a1));
  const truocKhe = kheTrenMat(hd, tv, bc), truocLech = doKhitLoi({ ...hd, mat: matDaDon(hd, bc, tv) }, dai).filter((x) => Math.abs(x.chong) > TUONG_CHUNG_MM).length;
  const kheMat = (kk: ReturnType<typeof kheTrenMat>) => kk.khe.filter((x) => x.matIdx === mi && x.loai !== 'tuong').reduce((a, x) => a + x.rong, 0);
  const deMat = (kk: ReturnType<typeof kheTrenMat>) => kk.de.filter((x) => x.matIdx === mi);
  // đè trước khi sửa, trừ chính chỗ chồng lõi > 200 mm đang sửa: sau sửa không được đè thêm chỗ nào / thêm mm nào (vd. đổi chồng
  // lõi thành chồng ô thang)
  const de0 = deMat(truocKhe), boDe = k.chong > TUONG_CHUNG_MM && de0.some((x) => Math.abs(x.mm - k.chong) < 1) ? k.chong : 0;
  const deSo0 = de0.length - (boDe ? 1 : 0), deMm0 = de0.reduce((a, x) => a + x.mm, 0) - boDe;
  // Δ = bề ngang đoạn thêm (+) / bớt (−); ít STRETCH trước; s = dời ra xa lõi: chồng lõi c − s, hở xa g − s − Δ
  const dsD = [0];
  for (let x = ST_BUOC_MM; x <= ST_MAX * keo.length; x += ST_BUOC_MM) dsD.push(x, -x);
  const c = k.chong;
  let lyDo = keo.length ? `STRETCH ±${ST_MAX} mm của ${keo.length} căn không đủ khớp hai mốc` : 'không căn nào trong đoạn STRETCH được, dời đoạn không đủ';
  // lượt 1: hở phía xa về ≤ 400 mm (khe tường); lượt 2: hở xa không rộng hơn trước (khe sẵn có giữ nguyên)
  for (const [gMax, D] of [KHE_TUONG_MM, Math.max(KHE_TUONG_MM, g)].flatMap((x, i) => (i && x === KHE_TUONG_MM ? [] : dsD.map((D) => [x, D] as const)))) {
    const sLo = Math.max(c - TUONG_CHUNG_MM, g - D - gMax), sHi = Math.min(c + TUONG_CHUNG_MM, g - D - gMin);
    if (sLo > sHi + 1e-6) continue;
    const s = Math.min(Math.max(c, sLo), sHi);
    // chia Δ cho căn STRETCH được, bước 100, mỗi căn tổng ≤ ±500
    let b2 = bc, con = D, st = 0;
    for (const v of keo) {
      if (!con) break;
      const { goc, st: st0 } = tachMa(canDangDung(v, b2));
      const lim = Math.sign(con) > 0 ? ST_MAX - st0 : -ST_MAX - st0, buoc = Math.abs(con) < Math.abs(lim) ? con : lim;
      if (!buoc || !tv.can.has(maBienThe(goc, st0 + buoc))) continue;
      b2 = { ...b2, canViTri: { ...(b2.canViTri ?? {}), [v.khoa]: maBienThe(goc, st0 + buoc) } };
      con -= buoc; st += Math.abs(buoc);
    }
    if (con) continue;
    // dồn khít (XC-04) có thể neo đoạn ở đầu xa khi bề ngang đổi: đo lại chồng lõi rồi dời bù (tối đa 2 lần)
    let m2 = mb, hd2 = hd, lech2: DoKhit[] = [], o: DoKhit | undefined, sd = s;
    for (let lan = 0; lan < 3; lan++) {
      m2 = banSaoMatBang(mb);
      for (const v of run) dich(m2, { k: v.khoa, loai: 'can', a0: 0, w: 0 }, cuoi ? sd : -sd);
      hd2 = dung(mau, m2, dl);
      lech2 = doKhitLoi({ ...hd2, mat: matDaDon(hd2, b2, tv) }, dai);
      o = lech2.find((x) => x.khoaLoi === k.khoaLoi && x.matIdx === mi && x.ben === k.ben);
      if (!o || Math.abs(o.chong) <= TUONG_CHUNG_MM) break;
      sd += o.chong - (c - s); // về đúng độ chồng đã định
    }
    const kh2 = kheTrenMat(hd2, tv, b2);
    if (!o || Math.abs(o.chong) > TUONG_CHUNG_MM) { lyDo = 'dồn khít lại không giữ được đoạn sát lõi'; continue; }
    if (lech2.filter((x) => Math.abs(x.chong) > TUONG_CHUNG_MM).length >= truocLech) continue;
    const de2 = deMat(kh2);
    if (de2.length > deSo0 || de2.reduce((a, x) => a + x.mm, 0) > deMm0 + 1 || kheMat(kh2) > kheMat(truocKhe) + 1 || kh2.de.length - de2.length > truocKhe.de.length - de0.length) { lyDo = 'mọi cách dời / STRETCH đều để lại đè hoặc khe mới'; continue; }
    return { mb: m2, bc: b2, st };
  }
  return lyDo;
}

/** Mặt sau dồn khít (căn đang dùng) đặt vào mẫu hiệu dụng — để đo khít lõi theo vị trí thật. */
function capNhatDonKhit(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc): ToaMB {
  const hd = dung(mau, mb, dl);
  return { ...hd, mat: matDaDon(hd, bc, tv) };
}

// ---------- XC-06: nét hành lang qua tim sảnh ----------
export function trucQuaSanh(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined): { sua: number; lechMax: number } {
  let sua = 0, lechMax = 0;
  if (!dl) return { sua, lechMax };
  for (const { matIdx, q } of dsLoi(mau)) {
    const K = dl.loi.get(q.block);
    if (!K || HINH_HUB.has(mau.hinh)) continue;
    const s = doSanh(K), b = K.bao_tuong_mm;
    if (!s || !b) continue;
    const u = coSo(mau.mat[matIdx].goc_deg, 0).u;
    const [tim] = veLoiTaiViTri([{ cat: 'b', pts: [[s.tim, (b[1] + b[3]) / 2]] }], q)[0].pts;
    const aTim = tim[0] * u[0] + tim[1] * u[1];
    const khung = veLoiTaiViTri([{ cat: 'b', pts: [[b[0], b[1] - 3000], [b[2], b[1] - 3000], [b[2], b[3] + 3000], [b[0], b[3] + 3000]] }], q)[0].pts;
    for (const sg of mb.hanhLang) {
      if (!sg.noi) continue;
      const dx = sg.p1[0] - sg.p0[0], dy = sg.p1[1] - sg.p0[1], L = Math.hypot(dx, dy) || 1;
      if (Math.abs((dx * u[0] + dy * u[1]) / L) > 0.05) continue; // phải vuông góc mặt lõi
      const g: Diem = [(sg.p0[0] + sg.p1[0]) / 2, (sg.p0[1] + sg.p1[1]) / 2];
      if (!trongDG(g, khung)) continue;
      const lech = aTim - (g[0] * u[0] + g[1] * u[1]);
      lechMax = Math.max(lechMax, Math.abs(lech));
      if (Math.abs(lech) <= TRUC_SANH_SAI_MM) continue;
      // dời đoạn nối và các đầu mút trùng nó (nằm trên trục dọc mặt nên dời dọc u vẫn trên trục)
      const cu = [sg.p0, sg.p1].map((p): Diem => [p[0], p[1]]);
      for (const o of mb.hanhLang) for (const key of ['p0', 'p1'] as const) {
        if (o !== sg && !cu.some((c) => kc(c, o[key]) < 400)) continue;
        o[key] = [o[key][0] + u[0] * lech, o[key][1] + u[1] * lech];
      }
      sua++;
    }
  }
  return { sua, lechMax };
}

// ---------- XC-07: hành lang liền, vuông góc, tới cửa xa nhất ----------
const dsCuaMB = (x: ToaMB, cuaCan: Record<string, number>) => { const { can, thang } = cuaTrenMat(x as unknown as ToaPCCC, cuaCan); return [...can.map((c) => ({ p: c.p, h: c.huong })), ...thang.map((t) => ({ p: t.p, h: t.huong }))]; };
/** Cửa căn / thang của mặt bằng mặc định — cố định theo (mẫu, dl, bảng tim cửa): PC-11 đo hàng trăm phương án, không dựng lại mỗi lần. */
const nhoCuaGoc = new WeakMap<ToaMB, Map<DuLieuMB | null, WeakMap<Record<string, number>, { ds: { p: Diem; h: Diem }[]; trung: (p: Diem) => boolean }>>>();
function cuaGoc(mau: ToaMB, dl: DuLieuMB | null | undefined, cuaCan: Record<string, number>) {
  let a = nhoCuaGoc.get(mau);
  if (!a) nhoCuaGoc.set(mau, (a = new Map()));
  let b = a.get(dl ?? null);
  if (!b) a.set(dl ?? null, (b = new WeakMap()));
  let g = b.get(cuaCan);
  if (!g) {
    const ds = dsCuaMB(dung(mau, matBangMacDinh(mau, dl), dl), cuaCan), luoi = new Map<string, Diem[]>();
    for (const c of ds) { const k = `${Math.floor(c.p[0])},${Math.floor(c.p[1])}`; (luoi.get(k) ?? luoi.set(k, []).get(k)!).push(c.p); }
    // cửa trùng cửa mẫu (cách < 1 mm): dò lưới ô 1 mm (3 × 3 ô quanh điểm) thay vì quét cả danh sách — cùng kết quả kc < 1
    g = { ds, trung: (p: Diem) => {
      const x = Math.floor(p[0]), y = Math.floor(p[1]);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of luoi.get(`${x + i},${y + j}`) ?? []) if (kc(q, p) < 1) return true;
      return false;
    } };
    b.set(cuaCan, g);
  }
  return g;
}
function hanhLangToiCua(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, cuaCan: Record<string, number>): number {
  if (!mb.hanhLang.length) return 0;
  const hd = dung(mau, mb, dl);
  const dsCua = (x: ToaMB) => dsCuaMB(x, cuaCan);
  // chỉ cửa ĐÃ DỜI so với mẫu (thêm / dời thang, dãy dài ra): đồ thị app cũ của bản vẽ gốc giữ nguyên như CAD (QT-54)
  const goc = cuaGoc(mau, dl, cuaCan);
  const cua = dsCua(hd).filter((c) => !goc.trung(c.p));
  const nuaHL = (mau.hanh_lang_mm || 1800) / 2;
  let sua = 0;
  for (const c of cua) {
    // trục song song gần nhất (không phải đoạn nối)
    let tot2: { s: DoanHanhLangMB; t: number; L: number; d: number } | null = null;
    for (const s of mb.hanhLang) {
      if (s.noi) continue;
      const v: Diem = [s.p1[0] - s.p0[0], s.p1[1] - s.p0[1]], L = Math.hypot(v[0], v[1]);
      if (L < 1 || Math.abs((v[0] * c.h[1] - v[1] * c.h[0]) / L) > 0.02) continue;
      const t = ((c.p[0] - s.p0[0]) * v[0] + (c.p[1] - s.p0[1]) * v[1]) / L;
      const d = Math.abs(((c.p[0] - s.p0[0]) * v[1] - (c.p[1] - s.p0[1]) * v[0]) / L);
      if (d > nuaHL + 600) continue;
      const ngoai = t < 0 ? -t : t > L ? t - L : 0;
      if (!tot2 || ngoai + d < tot2.t + tot2.d) tot2 = { s, t, L, d };
    }
    if (!tot2 || (tot2.t >= -1 && tot2.t <= tot2.L + 1)) continue;
    const { s, t, L } = tot2;
    const dau = t < 0 ? 'p0' : 'p1', dauMut = s[dau];
    // chỉ kéo đầu cụt (không có đoạn khác chạm đầu đó)
    if (mb.hanhLang.some((o) => o !== s && (kc(o.p0, dauMut) < 400 || kc(o.p1, dauMut) < 400))) continue;
    const v: Diem = [(s.p1[0] - s.p0[0]) / L, (s.p1[1] - s.p0[1]) / L];
    const moi: Diem = t < 0 ? [s.p0[0] + v[0] * t, s.p0[1] + v[1] * t] : [s.p0[0] + v[0] * t, s.p0[1] + v[1] * t];
    mb.hanhLangThem = [...(mb.hanhLangThem ?? []), [[dauMut[0], dauMut[1]], moi]];
    // sàn hành lang mọc thêm: nối nét bao ở đầu hành lang cũ (hệ mặt của cửa, dải b ∈ [−HL, 0]) nếu có cạnh biên phủ
    const m = mau.mat.find((f) => { const B = coSo(f.goc_deg, f.truc_mm); return Math.abs(B.u[0] * c.h[0] + B.u[1] * c.h[1]) > 0.999 && Math.abs(B.ab(c.p)[1]) < 50; });
    if (m) {
      const B = coSo(m.goc_deg, m.truc_mm), a0 = B.ab(dauMut)[0], a1 = B.ab(moi)[0];
      const P = noiNetBao(mb.duongBao ?? mau.duong_bao, m.goc_deg, m.truc_mm, a0, a1 > a0 ? 1 : -1, Math.abs(a1 - a0), -(mau.hanh_lang_mm || 1800), 0);
      if (P) mb.duongBao = P;
    }
    s[dau] = moi;
    sua++;
  }
  return sua;
}

/** Đoạn hành lang không vuông góc / song song với phương mặt nào (QT-19: hành lang không chạy chéo). */
function doanXien(mau: ToaMB, hl: DoanHanhLangMB[]): number {
  const huong = mau.mat.map((m) => coSo(m.goc_deg, 0).u);
  return hl.filter((s) => {
    const dx = s.p1[0] - s.p0[0], dy = s.p1[1] - s.p0[1], L = Math.hypot(dx, dy);
    if (L < 1) return false;
    return !huong.some((u) => Math.abs(dx * u[0] + dy * u[1]) > L - 2 || Math.abs(dx * u[1] - dy * u[0]) > L - 2);
  }).length;
}

/** Số mảng rời của đồ thị hành lang (dungDoThi, gộp nút 400 mm). */
export function soMangHL(hd: ToaMB): number {
  const G = dungDoThi({ ...(hd as unknown as ToaPCCC), truc: hd.truc ?? [], hanhlang_ve: hd.hanhlang_ve ?? [] });
  const goc = G.nut.map((_, i) => i);
  const tim = (x: number): number => (goc[x] === x ? x : (goc[x] = tim(goc[x])));
  G.canh.forEach((e) => { goc[tim(e.i)] = tim(e.j); });
  return new Set(G.canh.map((e) => tim(e.i))).size;
}

// ---------- QT-69: dãy dài ra / ngắn lại ở đầu tự do khi STRETCH không có căn bù ----------
/**
 * Dồn khít (XC-04) báo đoạn có tổng bề ngang đổi (`lech`): đầu chạy là đầu MẶT tự do thì mặt dài ra / ngắn lại đúng phần
 * chênh, nét bao nối theo (DTXD nhảy theo — QT-69 / QT-57c app cũ). Trả số đoạn đã nối.
 */
function noiDaiRa(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc, boQua?: ReadonlySet<number>): { so: number; mm: number; san: number; sanMm: number } {
  const hd = dung(mau, mb, dl);
  let so = 0, mm = 0, san = 0, sanMm = 0;
  // sân hở còn lại (hai cánh cùng dài vào một sân thì trừ dần)
  const sh = sanHo(mau, dl, tv).map((s) => ({ ...s }));
  const dk = donKhit(hd, viTriCan(hd, tv), bc, tv);
  for (const l of dk.lech) {
    if (boQua?.has(l.matIdx)) continue;
    const [aD, aC] = mepMat(mau, mb, l.matIdx);
    if (Math.abs(l.a - (l.cuoi ? aC : aD)) <= 50 && dauTuDo(mau, mb, l.matIdx, l.cuoi)) {
      if (gianMat(mau, mb, l.matIdx, l.cuoi, l.mm)) { so++; mm += l.mm; }
      continue;
    }
    // đầu dãy hở ra sân trong (không chạm lõi / thang / cánh khác): dãy dài ra / ngắn lại ở đó như đầu cánh tự do; sân còn lại
    // vẫn phải là khoảng trống cỡ hành lang (XC-02) — không thì để khít đoạn kẹp xử lý
    const s = sanTaiDau(sh, l.matIdx, l.a, l.cuoi);
    if (!s) continue;
    const rongMax = Math.max(0, ...dk.vts.filter((v) => v.matIdx === l.matIdx).map((v) => v.a1 - v.a0));
    if (s.s1 - s.s0 - l.mm < sanConMin(rongMax)) continue;
    if (!noiDauSan(mau, mb, l.matIdx, l.a, l.cuoi, l.mm)) continue;
    if (l.cuoi) s.s0 += l.mm; else s.s1 -= l.mm;
    so++; mm += l.mm; san++; sanMm += l.mm;
  }
  return { so, mm, san, sanMm };
}

// ---------- tổng hợp ----------
/**
 * Lý do còn căn vượt sau PC-11 (app cũ cũng dừng ở đây: GEN_THANG.MAX = 3 thang, không cắt căn khi chưa được chủ nhiệm cho):
 * đã đủ 3 thang / không còn đoạn có đầu tự do để thêm thang / căn vượt nằm ở đầu cụt.
 */
function lyDoVuot(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, cuoi: { tn: ReturnType<typeof thoatNan> }, nT: number): string {
  const dai = daiLoi(mau, dl);
  const coCho = mau.mat.some((m, mi) => laMatThat(m) && dsDoan(mau, mb, dai, mi).some((d) => d.tuDau || d.tuCuoi));
  const xau = cuoi.tn.can.filter((c) => c.vuot);
  const cut = xau.filter((c) => c.cut).length;
  // thang chuyển được = thang ở đoạn có đầu tự do (bỏ đi thì dãy co lại, không để khe)
  const kep = mb.thangBo.filter((t) => { const d = doanTai(mau, mb, dai, t.matIdx, t.a0 + t.rong / 2); return !d.tuDau && !d.tuCuoi; }).length;
  const ly = [
    nT >= THANG_MAX ? `đã đủ ${THANG_MAX} thang (app cũ GEN_THANG.MAX)` : !coCho ? 'không còn đoạn có đầu tự do để thêm thang' : 'không chỗ đặt thang nào làm bớt căn vượt',
    kep ? `${kep}/${nT} thang kẹp giữa lõi / góc, không chuyển mặt được nếu không xếp lại căn` : '',
  ].filter(Boolean).join(' · ');
  return `còn vượt: ${ly}` + (cut ? ` · ${cut} căn ở đầu cụt` : '')
    + ' · app cũ chỉ gỡ được bằng tự sinh (xếp lại cả dãy căn) hoặc giảm căn (giamCanThoatNan) — cần chủ nhiệm quyết';
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Chạy năm quy tắc trên bố cục chung của tòa, trả mặt bằng mới (lưu vào ToaDat.matBang) + báo cáo. Gác cuối: khe / đè
 * (tinh/khe.ts) không được nhiều hơn mặt bằng mặc định, nếu không thì bỏ phần thang tự động (PC-11) và báo.
 */
export function tuChinhMatBang(mau: ToaMB, tv: ThuVien, dl: DuLieuMB | null | undefined, opt: TuyChonTuChinh): KetQuaMB {
  const bcVao = opt.bc, H = opt.chieuCaoPCCC;
  // QT-69 trước: mặt bằng xuất phát đã theo dãy dài ra / ngắn lại (mặc định của mẫu không bị sửa — nhớ dùng chung)
  const mb0 = banSaoMatBang(matBangMacDinh(mau, dl));
  // căn bỏ (giamCanThoatNan) trước: dãy co lại ở đầu tự do, rồi mới đo dãy dài ra / ngắn lại
  apBoCan(mau, mb0, dl, bcVao);
  // thang đặt tay (công cụ màn Tầng): áp trước PC-11, PC-11 giữ nguyên tập thang
  const tay = opt.thangTay && (opt.thangTay.them.length || opt.thangTay.bo.length) ? opt.thangTay : undefined;
  const hongTay = tay ? apThangTay(mau, mb0, dl, tay) : [];
  // quy tắc 2–3 thang: thang tay (PA cũ cho đặt > 3) vượt 3 thì bỏ thang thêm sau cùng; dưới 2 thì PC-11 được tự đặt lại
  const boTay = tay ? catThangThua(mau, mb0, dl, tay) : 0;
  const tayCoDinh = !!tay && mb0.thangBo.length >= THANG_MIN && mb0.thangBo.length <= THANG_MAX;
  // dãy có thang bộ mà tổng bề ngang căn đổi: dồn qua thang (thang trượt theo căn, app cũ QT-48)
  const quaThang = opt.tangRieng || opt.thangEp ? { mat: new Set<number>(), so: 0, mm: 0 } : donQuaThang(mau, mb0, dl, tv, bcVao, new Set(opt.giu ?? Object.keys(bcVao.canViTri ?? {})));
  const d69 = noiDaiRa(mau, mb0, dl, tv, bcVao, quaThang.mat);
  d69.so += quaThang.so; d69.mm += quaThang.mm;
  const vtsGoc = viTriCan(mau, tv);
  const cuaCan0 = cuaCanDung(vtsGoc.map((v) => canDangDung(v, bcVao)), tv, dl?.cuaCan ?? {});
  const qt: KetQuaTuChinh[] = [];

  // PC-11 (hoặc ép tập thang liền suốt chiều cao)
  const ep = opt.thangEp;
  const pc = ep ? epThang(mau, mb0, dl, tv, cuaCan0, H, bcVao, ep, opt.thangMau)
    : { ...thangTuDong(mau, mb0, dl, tv, cuaCan0, H, bcVao, tayCoDinh, opt.thangTruoc, opt.thangTruocVuot), khongDat: 0, thua: [] as ThangBoMB[], bc: bcVao, soNhuong: 0, conLech: 0 };
  // ép thang có thể co / giãn căn nhường chỗ (bố cục đổi): đo tiếp theo bố cục mới
  let mb = banSaoMatBang(pc.mb);
  gotDauThua(mau, mb, dl, tv, pc.bc);
  // XC-05 (thang liền các tầng thì không dời đoạn có thang; đoạn kẹp khít bằng dời trong đoạn / STRETCH — bố cục đổi)
  const optKhit: OptKhit = { khongKeo: new Set(opt.chan ?? []), giu: new Set(opt.giu ?? Object.keys(bcVao.canViTri ?? {})) };
  // thang đặt tay vẫn để XC-05 dời cả đoạn ≤ tường chung cho khít lõi (như thang mẫu); chỉ PC-11 không dời / bỏ
  let k05 = suaKhitLoi(mau, mb, dl, tv, pc.bc, !!ep, optKhit);
  let bc = k05.bc;
  const cuaCanTheo = (b: BoCuc) => (b === bcVao ? cuaCan0 : { ...cuaCan0, ...cuaCanDung(vtsGoc.map((v) => canDangDung(v, b)), tv, dl?.cuaCan ?? {}) });
  let cuaCan = cuaCanTheo(bc);
  const sua05 = k05.sua;
  // XC-06
  const s06 = trucQuaSanh(mau, mb, dl);
  // XC-07
  const sua07 = hanhLangToiCua(mau, mb, dl, cuaCan);

  // gác khe / đè: không được tệ hơn mặt bằng mặc định
  const kheGoc = tongKhe(dung(mau, mb0, dl), tv, pc.bc), kheMoi = tongKhe(dung(mau, mb, dl), tv, bc);
  let boPC11 = false;
  if (!ep && !tay && (kheMoi.de > kheGoc.de || kheMoi.mm > kheGoc.mm + 200)) {
    boPC11 = true;
    mb = banSaoMatBang(mb0);
    k05 = suaKhitLoi(mau, mb, dl, tv, pc.bc, false, optKhit);
    bc = k05.bc; cuaCan = cuaCanTheo(bc);
    trucQuaSanh(mau, mb, dl);
    hanhLangToiCua(mau, mb, dl, cuaCan);
  }
  // nét bao bo theo ô (app cũ duongBao0): phần sàn mất / mọc thêm sau mọi bước — không để gai, viền thừa quanh chỗ trống
  const bao = baoTheoO(mau, mb, dl, tv, bc);
  if (bao !== null) mb.duongBao = bao;
  const hd = dung(mau, mb, dl);
  const cuoi = danhGia(hd, bc, tv, cuaCan, H);
  const dai = daiLoi(mau, dl);

  // QT-69
  qt.push({ ma: 'QT-69', muc: d69.so ? 'da_sua' : 'ok', sua: d69.so,
    ghiChu: d69.so ? `${d69.so} dãy ${d69.mm > 0 ? 'dài ra' : 'ngắn lại'} ${Math.abs(Math.round(d69.mm))} mm ở đầu tự do`
      + (d69.san ? ` (${d69.san} dãy ở đầu hở ra sân trong, ${Math.round(d69.sanMm)} mm)` : '') + ' · nét bao + DTXD theo' : 'không có dãy đổi chiều dài' });
  // XC-03
  const thieu = mb.thangBo.filter((t) => t.rong < O_THANG_MM - 20).length;
  const noi = mb0.thangBo.filter((t) => Math.abs(t.rong - (mau.mat[t.matIdx].phan_tu[Number(t.khoa.split(':')[1])]?.rong_mm ?? t.rong)) > 1).length;
  qt.push({ ma: 'XC-03', muc: thieu ? 'canh_bao' : noi ? 'da_sua' : 'ok', sua: noi,
    ghiChu: thieu ? `${thieu} ô thang chưa đủ 3.000 mm (không có đầu tự do để nới)` : `${mb.thangBo.length} ô thang · 3.000 mm · hút khe ≤ 600 mm` });
  // XC-05
  const khit = doKhitLoi({ ...hd, mat: cuoi.mat }, dai);
  const lech05 = khit.filter((k) => Math.abs(k.chong) > TUONG_CHUNG_MM);
  const st05 = k05.stretch ? ` · STRETCH ${k05.stretch} mm (QT-81) cho đoạn kẹp` : '';
  qt.push({ ma: 'XC-05', muc: lech05.length ? 'canh_bao' : sua05 ? 'da_sua' : 'ok', sua: sua05,
    ghiChu: !dai.length ? 'chưa có hình lõi' : lech05.length ? `${lech05.length} chỗ căn hở / đè nét bao lõi > ${TUONG_CHUNG_MM} mm (lớn nhất ${Math.round(Math.max(...lech05.map((k) => Math.abs(k.chong))))} mm)`
        + (k05.lyDo.length ? ` · không sửa được: ${k05.lyDo.join('; ')}` : '') + st05
      : `${khit.length} mép căn kề lõi khít nét bao (chồng ${Math.round(Math.min(0, ...khit.map((k) => k.chong)))}…${Math.round(Math.max(0, ...khit.map((k) => k.chong)))} mm)`
        + (sua05 ? ` · đã dời ${sua05} đoạn` : '') + st05 });
  // XC-06
  const sanh = sanhCuaToa(mau, dl);
  const sai06 = sanh.filter((s) => s.loai !== mau.nhom);
  const can06 = SANH_MM[mau.nhom];
  qt.push({ ma: 'XC-06', muc: sai06.length ? 'canh_bao' : s06.sua ? 'da_sua' : 'ok', sua: s06.sua,
    ghiChu: !sanh.length ? 'chưa có hình lõi'
      : `${sanh.map((s) => (s.rong ? `sảnh ${r1(s.rong / 1000)} m` : 'sảnh hub (theo dòng khối)') + ` · lõi ${s.loai === 'tm' ? 'NOTM' : 'NOXH'}`).join('; ')} · cần ${r1(can06 / 1000)} m`
        + (sai06.length ? ' · lõi khác loại hình tòa' : '') + (s06.lechMax ? ` · nét HL lệch tim sảnh ${Math.round(s06.lechMax)} mm` : '') });
  // XC-07
  const xien = doanXien(mau, mb.hanhLang), mang = soMangHL(hd);
  qt.push({ ma: 'XC-07', muc: mang > 1 || cuoi.dg.khongToi || xien ? 'canh_bao' : sua07 ? 'da_sua' : 'ok', sua: sua07,
    ghiChu: `${mang} mạng hành lang · ${cuoi.dg.khongToi} căn không tới thang` + (xien ? ` · ${xien} đoạn chéo` : '') + (sua07 ? ` · kéo ${sua07} đầu trục tới cửa xa nhất` : '') });
  // PC-11
  const nT = mb.thangBo.length;
  const soPC = pc.soThem + pc.soDoi + pc.soBo + pc.soChuyen;
  const lechEp = !!ep && (pc.conLech > 0 || kheMoi.de > kheGoc.de || kheMoi.mm > kheGoc.mm + 200);
  qt.push({ ma: 'PC-11', muc: boPC11 ? 'canh_bao' : cuoi.dg.vuot ? 'vuot' : lechEp ? 'canh_bao' : soPC ? 'da_sua' : 'ok', sua: boPC11 ? 0 : soPC,
    ghiChu: (boPC11 ? 'bỏ thang tự động vì tạo khe / đè · ' : '')
      + (tay ? `thang đặt tay (giữ nguyên, không tự dời)${hongTay.length ? ` · ${hongTay.length} thao tác thang không áp được (đoạn kẹp, không có đầu tự do)` : ''}${boTay ? ` · bỏ ${boTay} thang tay vượt ${THANG_MAX} thang` : ''} · ` : '')
      + (ep ? `${nT} thang liền suốt chiều cao (đặt thêm ${pc.soThem}, dời ${pc.soDoi}, bớt ${pc.soBo}${pc.khongDat ? `, KHÔNG đặt được ${pc.khongDat}` : ''}${pc.thua.length ? `, giữ thêm ${pc.thua.length} thang của mẫu` : ''}${pc.soNhuong ? `, căn nhường chỗ ${pc.soNhuong}` : ''}${pc.conLech ? `, còn lệch ${pc.conLech} mm không khít được — cần chủ nhiệm xem` : ''})`
        : `${nT} thang (thêm ${boPC11 ? 0 : pc.soThem}, dời ${boPC11 ? 0 : pc.soDoi}, chuyển mặt ${boPC11 ? 0 : pc.soChuyen}, bớt ${boPC11 ? 0 : pc.soBo})`)
      + (ep && (kheMoi.de > kheGoc.de || kheMoi.mm > kheGoc.mm + 200) ? ` · khe ${Math.round(kheMoi.mm)} mm / đè ${kheMoi.de}` : '')
      + ` · căn vượt cự ly ${pc.truoc.vuot} → ${cuoi.dg.vuot}`
      + ` · xa nhất ${r1(cuoi.dg.xaNhat)} m · ${gioiHanThoatNan(H).canCu}` + (cuoi.dg.vuot ? ` · ${lyDoVuot(mau, mb, dl, cuoi, nT)}` : '') });

  // loại thang: ≥ 1 N2 + ≥ 1 N3 (QT-63 · quy tắc thang bộ), theo lựa chọn tay
  mb.thangBo = ganLoaiThang(mb.thangBo, opt.loaiThang);
  const baoCao: BaoCaoTuChinh = {
    quyTac: qt,
    soThangTruoc: mb0.thangBo.length,
    soThangSau: nT,
    vuotTruoc: pc.truoc.vuot,
    vuotSau: cuoi.dg.vuot,
    soCan: viTriCan(hd, tv).filter((v) => congNangTai(v.khoa, bc) === 'can').length,
    dtxdM2: hd.dtxd_m2,
    dtHanhLangM2: Math.round(dtHanhLangTang(hd).m2 * 10) / 10,
    ...(d69.san ? { daiSan: { so: d69.san, mm: Math.round(d69.sanMm) } } : {}),
  };
  return { matBang: { ...mb, phienBan: 1, sanh, baoCao }, baoCao, bc, soNhuong: pc.soNhuong, conLech: pc.conLech, khongDat: pc.khongDat, thua: pc.thua, khoaVuot: cuoi.tn.can.filter((c) => c.vuot).map((c) => cuoi.khoaCan[c.so - 1]) };
}

/** Kết quả tự chỉnh một bố cục: mặt bằng + báo cáo, thang không đặt được / thang thừa khi ép, khoá các căn còn vượt. */
export type KetQuaMB = { matBang: MatBangSua; baoCao: BaoCaoTuChinh; bc: BoCuc; soNhuong: number; conLech: number; khongDat: number; thua: ThangBoMB[]; khoaVuot: string[] };

// ---------- gỡ căn vượt cự ly sau PC-11 (app cũ: tự sinh rồi giamCanThoatNan) ----------
/** Một thay đổi bố cục do gỡ căn ghi ra (chưa gắn tầng). */
type ThayDoiBC = Omit<ThayDoiTuDong, 'tang' | 'cu'>;
/** Căn người dùng vừa chọn không đặt vừa ô (khít đoạn kẹp): loại, bề rộng ô còn cho căn đó (mm), mẫu hẹp nhất của loại đó (mm). */
export type ChanKhit = { khoa: string; matIdx: number; id: string; loai: LoaiCan; rongO: number; rongMin: number; kieu: 'hep' | 'du' };
export type KetQuaGiam = KetQuaMB & { thayDoi: ThayDoiBC[]; chan: ChanKhit[] };

const coCauRong = () => Object.fromEntries(LOAI_CAN.map((k) => [k, 0])) as Record<LoaiCan, number>;
/** Cơ cấu một tầng (ô công năng căn hộ) trên mẫu hiệu dụng. */
function coCauTang(hd: ToaMB, bc: BoCuc, tv: ThuVien): Record<LoaiCan, number> {
  const d = coCauRong();
  for (const v of viTriCan(hd, tv)) {
    if (congNangTai(v.khoa, bc) !== 'can') continue;
    const c = tv.can.get(canDangDung(v, bc));
    if (c) d[c.loai]++;
  }
  return d;
}
const voiCanViTri = (bc: BoCuc, khoa: string, id: string): BoCuc => ({ ...bc, canViTri: { ...(bc.canViTri ?? {}), [khoa]: id } });
const voiCongNang = (bc: BoCuc, khoa: string, cn: CongNangO): BoCuc => ({ ...bc, congNang: { ...(bc.congNang ?? {}), [khoa]: cn } });

/**
 * Tự sinh rút gọn (giữ cơ cấu, giữ số căn): trên mặt bằng đã có thang, chỉ xếp lại các đoạn dãy căn có căn vượt và có đầu tự do —
 * co căn giữa bằng mẫu CÙNG LOẠI hẹp hơn (mẫu khác / biến thể STRETCH), hoặc đổi chỗ hai căn giữa khác bề ngang trong đoạn.
 * Leo dốc, mỗi lượt lấy phép làm ít căn vượt nhất (đo nhanh trên hình học cố định); trả bố cục mới hoặc null nếu không bớt được.
 */
function xepLaiGiuCoCau(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc, cuaCan: Record<string, number>, H: number): BoCuc | null {
  const hd = dung(mau, mb, dl), dai = daiLoi(mau, dl);
  const goc = viTriCan(hd, tv), doan = doanCan(goc);
  let cur = bc, r = danhGia(hd, cur, tv, cuaCan, H);
  const dau = r.dg;
  // mẫu giữa hẹp nhất cùng loại (cùng nhóm, chiều sâu) cho từng mẫu đang dùng — nhớ theo id
  const hepNhat = new Map<string, string[]>();
  const hep = (id: string): string[] => {
    let ds = hepNhat.get(id);
    if (ds) return ds;
    const c = tv.can.get(id);
    ds = !c || c.vi_tri !== 'giua' ? [] : [...tv.can.values()]
      .filter((x) => x.nhom === c.nhom && x.loai === c.loai && x.vi_tri === 'giua' && x.sau_mm === c.sau_mm && x.rong_mm < c.rong_mm - 1)
      .sort((a, b) => a.rong_mm - b.rong_mm || a.id.localeCompare(b.id)).slice(0, 2).map((x) => x.id);
    // biến thể co tối đa của chính mẫu (STRETCH −500) nếu chưa có trong danh sách
    const { goc: g, st } = tachMa(id), co = maBienThe(g, -ST_MAX);
    if (st > -ST_MAX && tv.can.has(co) && !ds.includes(co)) ds.push(co);
    hepNhat.set(id, ds);
    return ds;
  };
  for (let luot = 0; luot < LUOT_XEP_LAI && r.dg.vuot > 0; luot++) {
    const xau = new Set(r.tn.can.filter((c) => c.vuot).map((c) => r.khoaCan[c.so - 1]));
    let tot1: { bc: BoCuc; r: typeof r } | null = null;
    const thu = (b: BoCuc) => {
      const x = danhGia(hd, b, tv, cuaCan, H);
      if (donKhit(hd, goc, b, tv).de.length) return; // đè mốc kế bên: loại
      if (tot(x.dg, r.dg) && (!tot1 || tot(x.dg, tot1.r.dg))) tot1 = { bc: b, r: x };
    };
    for (const d of doan) {
      const ks = d.ds.map((i) => goc[i].khoa);
      if (!ks.some((k) => xau.has(k))) continue;
      const dn = doanTai(mau, mb, dai, d.matIdx, (d.a0 + d.a1) / 2);
      if (!dn.tuDau && !dn.tuCuoi) continue; // đoạn kẹp hai đầu: co / giãn để lại khe
      const giua = d.ds.map((i) => goc[i]).filter((v) => congNangTai(v.khoa, cur) === 'can' && tv.can.get(canDangDung(v, cur))?.vi_tri === 'giua');
      for (const v of giua) for (const id of hep(canDangDung(v, cur))) thu(voiCanViTri(cur, v.khoa, id));
      for (let i = 0; i < giua.length; i++) for (let j = i + 1; j < giua.length; j++) {
        const a = canDangDung(giua[i], cur), b = canDangDung(giua[j], cur);
        const ca = tv.can.get(a), cb = tv.can.get(b);
        if (!ca || !cb || Math.abs(ca.rong_mm - cb.rong_mm) < 1 || ca.sau_mm !== cb.sau_mm) continue;
        thu(voiCanViTri(voiCanViTri(cur, giua[i].khoa, b), giua[j].khoa, a));
      }
    }
    if (!tot1) break;
    const t1 = tot1 as { bc: BoCuc; r: typeof r };
    cur = t1.bc; r = t1.r;
  }
  return tot(r.dg, dau) && r.dg.vuot < dau.vuot ? cur : null;
}

/** Thay đổi bố cục `b` so với `a` (đổi căn theo vị trí, công năng ô), để ghi lại / gỡ ra. */
function khacBoCuc(a: BoCuc, b: BoCuc, mau: ToaMB, tv: ThuVien): ThayDoiBC[] {
  const kq: ThayDoiBC[] = [];
  for (const v of viTriCan(mau, tv)) {
    const ia = canDangDung(v, a), ib = canDangDung(v, b);
    if (ia !== ib) kq.push({ truong: 'canViTri', khoa: v.khoa, moi: ib });
    const ca = congNangTai(v.khoa, a), cb = congNangTai(v.khoa, b);
    if (ca !== cb) kq.push({ truong: 'congNang', khoa: v.khoa, moi: cb });
  }
  return kq;
}

const nhoGiam = new WeakMap<ToaMB, Map<string, KetQuaGiam>>();

/**
 * Tự chỉnh một bố cục rồi gỡ căn vượt cự ly như app cũ (bật mặc định, `giamCan` false = giữ nguyên căn, chỉ báo vượt):
 *  1. tự sinh rút gọn giữ cơ cấu (xepLaiGiuCoCau), nhận nếu chạy lại đủ bước tự chỉnh thật sự bớt căn vượt;
 *  2. giamCanThoatNan: mỗi lượt một căn — BỎ căn giữa gần đầu tự do (căn góc ở mép trượt vào, mặt co lại; app cũ) hoặc ĐỔI ô căn
 *     vượt thành phòng kỹ thuật; lấy phép bớt nhiều căn vượt nhất, bằng nhau thì ưu tiên bỏ căn (như app cũ), rồi DT mất ít hơn.
 * Thang giữ đúng chỗ suốt quá trình (chạy lại bằng `thangEp`), DT / số căn / thoát nạn / DTXD tính lại sau mỗi bước.
 */
export function tuChinhGiam(mau: ToaMB, tv: ThuVien, dl: DuLieuMB | null | undefined, opt: TuyChonTuChinh, giamCan = true): KetQuaGiam {
  const khoaNho = JSON.stringify([opt.bc.canTheo, opt.bc.canViTri ?? {}, opt.bc.congNang ?? {}, opt.chieuCaoPCCC, opt.thangEp ?? null,
    opt.thangMau ? [opt.thangMau.thangBo, opt.thangMau.dich ?? {}] : null, giamCan, !!dl, opt.giu ?? null, opt.chan ?? null, opt.bc.latO ?? null, opt.thangTay ?? null, opt.loaiThang ?? null, opt.thangTruoc?.map((t) => [t.khoa, t.matIdx, Math.round(t.a0 + t.dIns), t.sx]) ?? null, opt.thangTruocVuot ?? null, !!opt.tangRieng]);
  let theoMau = nhoGiam.get(mau);
  const co = theoMau?.get(khoaNho);
  if (co) return structuredClone(co);
  const kq = tinhGiam(mau, tv, dl, opt, giamCan);
  if (!theoMau) nhoGiam.set(mau, (theoMau = new Map()));
  if (theoMau.size > 40) theoMau.clear();
  theoMau.set(khoaNho, kq);
  return structuredClone(kq);
}

function tinhGiam(mau: ToaMB, tv: ThuVien, dl: DuLieuMB | null | undefined, opt: TuyChonTuChinh, giamCan: boolean): KetQuaGiam {
  const H = opt.chieuCaoPCCC;
  let r0 = tuChinhMatBang(mau, tv, dl, opt);
  // khít đoạn kẹp (sau STRETCH nhường chỗ của epThang): đổi căn khác / căn vừa chọn / bỏ căn cho hết đè, khe; chạy lại đủ bước
  // (DT, số căn, thoát nạn tính lại), nhận khi đo lại thật sự bớt đè / khe
  const san = sanHo(mau, dl, tv);
  const refKhit = refTheoNeo(loiTheoMat(dung(mau, r0.matBang, dl), tv, { canTheo: {} }, san), r0.matBang, dung(mau, r0.matBang, dl), tv, r0.bc, san);
  const doKhit = (r: KetQuaMB) => loiTheoMat(dung(mau, r.matBang, dl), tv, r.bc, san);
  let khitKep: BaoCaoKhitKep | undefined;
  const chanVao = new Set(opt.chan ?? []);
  const kq = khitDoanKep(mau, r0.matBang, dl, tv, r0.bc, new Set(opt.giu ?? Object.keys(opt.bc.canViTri ?? {})), opt.bc, chanVao);
  const kk = kq.kq;
  if (kk) {
    const loi0 = tongLoi(doKhit(r0), refKhit);
    const cach: TuyChonTuChinh[] = [{ ...opt, bc: kk.bc }];
    if (!opt.thangEp) cach.push({ ...opt, bc: kk.bc, thangEp: r0.matBang.thangBo.map((t) => ({ ...t })), thangMau: opt.thangMau ?? r0.matBang });
    for (const o of cach) {
      const r1 = tuChinhMatBang(mau, tv, dl, o);
      if (tongLoi(doKhit(r1), refKhit) >= loi0) continue;
      r0 = { ...r1, soNhuong: r0.soNhuong + r1.soNhuong };
      khitKep = { doi: kk.doi, bo: kk.bo, conMm: mmLoi(doKhit(r1), refKhit) };
      break;
    }
  }
  // thang liền suốt chiều cao: căn đã co / giãn nhường chỗ cho ô thang (epThang) — tính từ bố cục đó; phần lệch đo lại bằng khe.ts
  const bc0 = r0.bc, soNhuong = r0.soNhuong, conLech = khitKep ? khitKep.conMm : r0.conLech ? mmLoi(doKhit(r0), refKhit) : 0;
  // căn người dùng vừa chọn mà mọi bước khít (STRETCH, đổi căn khác, dãy dài ra) vẫn không vừa: báo chặn (tuChinhSauSua giữ căn cũ)
  const loiCuoi = doKhit(r0), conLoi = (mi: number) => diemLoi(loiCuoi[mi], refKhit[mi]) > 0;
  const chan = kq.chan.filter((c) => chanVao.has(c.khoa) && conLoi(c.matIdx));
  // dự phòng: căn vừa chọn nằm trên mặt còn lỗi mà khít không xét tới đoạn của nó — ô = bề ngang ô bản vẽ
  for (const v of viTriCan(dung(mau, r0.matBang, dl), tv)) {
    if (!chanVao.has(v.khoa) || chan.some((c) => c.khoa === v.khoa) || !conLoi(v.matIdx)) continue;
    const c = tv.can.get(canDangDung(v, opt.bc));
    if (!c) continue;
    const rongMin = Math.min(...[...tv.can.values()].filter((x) => x.nhom === c.nhom && x.loai === c.loai && x.vi_tri === c.vi_tri && x.sau_mm === c.sau_mm).map((x) => x.rong_mm));
    const rongO = Math.round(v.a1 - v.a0);
    chan.push({ khoa: v.khoa, matIdx: v.matIdx, id: c.id, loai: c.loai, rongO, rongMin, kieu: rongO < rongMin ? 'hep' : 'du' });
  }
  const xong = (r: KetQuaMB, bc: BoCuc): KetQuaGiam => {
    if (khitKep) { r.baoCao.khitKep = khitKep; r.matBang.baoCao = r.baoCao; }
    return { ...r, bc, thayDoi: khacBoCuc(opt.bc, bc, mau, tv), soNhuong, conLech, chan };
  };
  if (!r0.baoCao.vuotSau) return xong(r0, bc0);
  const coCau0 = coCauTang(dung(mau, r0.matBang, dl), bc0, tv);
  const baoCaoGiam = (r: KetQuaMB, bc: BoCuc, td: ThayDoiBC[]): BaoCaoGiamCan => ({
    bat: giamCan,
    xepLai: td.filter((d) => d.truong === 'canViTri').length,
    doi: td.filter((d) => d.truong === 'congNang' && d.moi === O_DOI_THOAT_NAN).length,
    bo: td.filter((d) => d.truong === 'congNang' && d.moi === 'bo').length,
    vuotTruoc: r0.baoCao.vuotSau ?? 0,
    vuotSau: r.baoCao.vuotSau ?? 0,
    soCanTruoc: r0.baoCao.soCan,
    soCanSau: r.baoCao.soCan,
    coCauTruoc: coCau0,
    coCauSau: coCauTang(dung(mau, r.matBang, dl), bc, tv),
  });
  if (!giamCan) {
    r0.baoCao.giamCan = baoCaoGiam(r0, bc0, []);
    return xong(r0, bc0);
  }
  const cuaCan = cuaCanDung(viTriCan(mau, tv).map((v) => canDangDung(v, bc0)), tv, dl?.cuaCan ?? {});
  // chạy lại đủ bước với thang giữ nguyên chỗ (thang của lần đầu, hoặc tập thang liền đang ép)
  const thang = opt.thangEp ?? r0.matBang.thangBo.map((t) => ({ ...t }));
  const chay = (bc: BoCuc) => tuChinhMatBang(mau, tv, dl, { ...opt, bc, thangEp: thang, thangMau: opt.thangMau ?? r0.matBang });
  let bc = bc0, r = r0;
  // gỡ căn không được để lại đè / khe mới (vd. bỏ căn kẹp giữa thang và căn góc → khe cả ô)
  const kheTeHon = (a: KetQuaMB, b: KetQuaMB) => tongLoi(doKhit(a), refKhit) > tongLoi(doKhit(b), refKhit);
  // 1. tự sinh rút gọn, giữ cơ cấu
  const bcA = xepLaiGiuCoCau(mau, r0.matBang, dl, tv, bc0, cuaCan, H);
  if (bcA) {
    const rA = chay(bcA);
    if ((rA.baoCao.vuotSau ?? 0) < (r.baoCao.vuotSau ?? 0) && !kheTeHon(rA, r)) { bc = rA.bc; r = rA; }
  }
  // 2. giamCanThoatNan: đổi / bỏ từng căn
  const dai = daiLoi(mau, dl);
  for (let luot = 0; luot < LUOT_GIAM_MAX && (r.baoCao.vuotSau ?? 0) > 0; luot++) {
    const geo = r.matBang, hd = dung(mau, geo, dl), vts = viTriCan(hd, tv), doan = doanCan(vts);
    type UngVien = { bc: BoCuc; mb: MatBangSua; bo: boolean; mat: number; dg: DanhGia };
    const ung: UngVien[] = [];
    const them = (b: BoCuc, mb: MatBangSua, bo: boolean, khoaMat: string) => {
      const dg = danhGia(dung(mau, mb, dl), b, tv, cuaCan, H).dg;
      ung.push({ bc: b, mb, bo, mat: tv.can.get(canDangDung(vts.find((v) => v.khoa === khoaMat)!, bc))?.dt_tt_m2 ?? 0, dg });
    };
    for (const X of r.khoaVuot) {
      if (!vts.some((v) => v.khoa === X)) continue;
      them(voiCongNang(bc, X, O_DOI_THOAT_NAN), geo, false, X);
      const d = doan.find((o) => o.ds.some((i) => vts[i].khoa === X));
      for (const i of d?.ds ?? []) {
        const G = vts[i];
        if (congNangTai(G.khoa, bc) !== 'can' || tv.can.get(canDangDung(G, bc))?.vi_tri !== 'giua') continue;
        const m2 = banSaoMatBang(geo);
        if (!boCanTren(mau, m2, dai, G.khoa)) continue;
        if (G.khoa !== X && (m2.dich?.[X] ?? 0) === (geo.dich?.[X] ?? 0)) continue; // căn vượt không xích lại gần
        them(voiCongNang(bc, G.khoa, 'bo'), m2, true, G.khoa);
      }
    }
    const xep = ung.filter((u) => u.dg.vuot < (r.baoCao.vuotSau ?? 0))
      .sort((a, b) => a.dg.vuot - b.dg.vuot || Number(b.bo) - Number(a.bo) || a.mat - b.mat || a.dg.vuotMax - b.dg.vuotMax);
    let nhan = false;
    for (const u of xep.slice(0, 3)) {
      const r2 = chay(u.bc);
      if ((r2.baoCao.vuotSau ?? 0) < (r.baoCao.vuotSau ?? 0) && !kheTeHon(r2, r)) { bc = r2.bc; r = r2; nhan = true; break; }
    }
    if (!nhan) break;
  }
  r.baoCao.giamCan = baoCaoGiam(r, bc, khacBoCuc(bc0, bc, mau, tv));
  // PC-11: giữ phần thang của lần đầu, nối kết quả gỡ căn
  const q0 = r0.baoCao.quyTac.find((x) => x.ma === 'PC-11'), q = r.baoCao.quyTac.find((x) => x.ma === 'PC-11');
  if (q0 && q) {
    const g = r.baoCao.giamCan, con = r.baoCao.vuotSau ?? 0;
    q.ghiChu = (con ? q0.ghiChu : q0.ghiChu.split(' · còn vượt:')[0])
      + ` · gỡ căn vượt (app cũ tự sinh + giamCanThoatNan): xếp lại ${g.xepLai}, đổi phòng KT ${g.doi}, bỏ ${g.bo} → còn ${con} căn vượt`;
    q.muc = con ? 'vuot' : q.muc === 'canh_bao' ? 'canh_bao' : 'da_sua';
    q.sua = q0.sua + g.xepLai + g.doi + g.bo;
  }
  r.baoCao.vuotTruoc = r0.baoCao.vuotTruoc;
  return xong(r, bc);
}

// ---------- khít đoạn kẹp: dãy căn giữa hai mốc đổi tổng bề ngang (app cũ: tự sinh dãy / dồn khít · QT-60 · QT-69) ----------
/**
 * Thứ tự ưu tiên khi khít (chi phí cộng dồn, nhỏ hơn thắng; trong mỗi bậc chênh bề ngang ít hơn thắng):
 *  1. đổi căn KHÁC trong đoạn sang mẫu cùng loại (mẫu khác / biến thể STRETCH) — giữ cơ cấu;
 *  2. đổi chính căn người dùng chọn về mẫu cùng loại rộng nhất còn vừa đoạn;
 *  3. đổi căn khác sang loại khác (đổi cơ cấu);
 *  4. bỏ căn (như giamCanThoatNan) — căn DT nhỏ nhất trước, không bỏ căn người dùng chọn;
 *  5. đường cùng (đoạn chỉ có căn người dùng chọn, không mẫu cùng loại nào vừa): đổi căn đó sang loại khác vừa đoạn — báo rõ.
 * Bậc theo app cũ — người dùng đã chốt 2026-10-29: đổi loại căn trước, bỏ căn sau. Phần dư không lấp được: chặn + gợi ý mẫu vừa ô (`goiYVuaO`).
 */
const GIA_KHIT = { cungLoai: 1e3, canChon: 1e5, khacLoai: 1e7, bo: 1e9, canChonKhacLoai: 1e11 } as const;

type LoiMat = { de: number; deMm: number; kheMm: number; hlMm: number; sanMm: number };
/**
 * Đè / khe (trừ khe tường ≤ 400 mm) theo từng mặt, đo bằng tinh/khe.ts; `hlMm` = khoảng trống cỡ hành lang (trừ sân hở);
 * `sanMm` = sân hở (QT-69) không khớp: sân bị lấp / hẹp dưới cỡ hành lang, hoặc nét bao không theo đầu dãy dài ra / ngắn lại.
 */
/**
 * Mốc so lỗi (bố cục bản vẽ `canTheo: {}`) cho mặt đã dồn qua thang bộ (`MatBangSua.neo`): thang đã trượt theo bề ngang căn thật nên
 * bề ngang bản vẽ để lại khe giả — mặt đó lấy chính lỗi của bố cục đang dùng làm mốc (không bắt khít lại).
 */
function refTheoNeo(ref: LoiMat[], mb: MatBangSua, hd: ToaMB, tv: ThuVien, bc: BoCuc, san: SanHo[]): LoiMat[] {
  const ds = new Set(Object.keys(mb.neo ?? {}).map((k) => Number(k.split(':')[0])));
  if (!ds.size) return ref;
  const that = loiTheoMat(hd, tv, bc, san);
  return ref.map((r, mi) => (ds.has(mi) ? that[mi] : r));
}
function loiTheoMat(hd: ToaMB, tv: ThuVien, bc: BoCuc, san: SanHo[]): LoiMat[] {
  const k = kheTrenMat(hd, tv, bc);
  return hd.mat.map((m, mi) => {
    const de = k.de.filter((d) => d.matIdx === mi), khe = k.khe.filter((x) => x.matIdx === mi && x.loai !== 'tuong');
    const tong = (ds: typeof khe) => ds.reduce((a, x) => a + x.rong, 0);
    const sm = san.filter((s) => s.matIdx === mi);
    const trongSan = (x: { a0: number; a1: number }) => sm.some((s) => Math.min(s.s1, x.a1) - Math.max(s.s0, x.a0) > KHE_TUONG_MM);
    let sanMm = 0;
    const B = coSo(m.goc_deg, m.truc_mm), trong = (a: number) => trongDG(B.pt(a, BAY_MM / 2), hd.duong_bao);
    for (const s of sm) {
      const x = khe.find((o) => o.loai === 'hanh_lang' && trongSan(o) && Math.min(s.s1, o.a1) > Math.max(s.s0, o.a0));
      if (!x) { sanMm += s.s1 - s.s0; continue; }
      for (let a = x.a0 + KHE_TUONG_MM; a < x.a1 - KHE_TUONG_MM; a += 500) if (trong(a)) sanMm += 500; // nét bao chưa co theo dãy ngắn lại
      if (!trong(x.a0 - 250)) sanMm += 500; // nét bao chưa nối theo dãy dài ra
      if (!trong(x.a1 + 250)) sanMm += 500;
    }
    return { de: de.length, deMm: de.reduce((a, d) => a + d.mm, 0), kheMm: tong(khe.filter((x) => x.loai !== 'hanh_lang')),
      hlMm: tong(khe.filter((x) => x.loai === 'hanh_lang' && !trongSan(x))), sanMm };
  });
}
/** Đè / khe (mm, trừ khe tường và sân hở QT-69) / sân hở không khớp (mm) của một mặt bằng — để kiểm / quét. */
/**
 * Số cặp đè của căn góc V theo hình bao thật (`CanMau.khung`) với ô / lõi khác (app cũ p20b `vaCham` theo khung): đè / khe theo ô
 * chữ nhật (`doDeKhe`) không thấy cái nêm của căn V khi căn đó bị đổi chỗ / lật sang vị trí không phải góc.
 */
export function deKhung(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc): number {
  const { o, khung } = oDacMB(mau, mb, dl, tv, bc);
  return khung.length ? soChongKhung(khung.map((i) => o[i]), [...o.filter((_, i) => !khung.includes(i)), ...daGiacCacLoi(mau, dl)]) : 0;
}

export function doDeKhe(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc): { de: number; mm: number; san: number } {
  const ls = loiTheoMat(apMatBang(mau, mb, dl), tv, bc, sanHo(mau, dl, tv));
  return { de: ls.reduce((a, l) => a + l.de, 0), mm: ls.reduce((a, l) => a + l.kheMm + l.hlMm, 0), san: ls.reduce((a, l) => a + l.sanMm, 0) };
}
/**
 * Phần lệch (mm) một mặt so với mốc: đè mới, khe mới; khoảng trống sẵn có của bản vẽ (hành lang cắt ngang…) hẹp / rộng ra = đầu
 * dãy xê dịch. Sân hở (QT-69) được hẹp / rộng ra theo đầu dãy, chỉ tính khi không khớp nét bao / lấp mất sân.
 */
const lechMat = (l: LoiMat, ref: LoiMat) => Math.max(0, l.deMm - ref.deMm) + Math.max(0, l.kheMm - ref.kheMm - 1) + Math.max(0, Math.abs(l.hlMm - ref.hlMm) - 1)
  + Math.max(0, l.sanMm - ref.sanMm);
/** Điểm lỗi một mặt so với mốc (đè / khe sẵn có của bản vẽ không tính). */
const diemLoi = (l: LoiMat, ref: LoiMat) => Math.max(0, l.de - ref.de) * 1e6 + lechMat(l, ref);
const tongLoi = (ls: LoiMat[], ref: LoiMat[]) => ls.reduce((a, l, i) => a + diemLoi(l, ref[i]), 0);
/** Phần đè + khe còn lại (mm) so với mốc. */
const mmLoi = (ls: LoiMat[], ref: LoiMat[]) => Math.round(ls.reduce((a, l, i) => a + lechMat(l, ref[i]), 0));

type UngVienKhit = { id: string | null; w: number; gia: number };
/** Chọn mỗi căn một ứng viên sao cho tổng bề ngang trong [lo, hi], chi phí nhỏ nhất (gần `muc` hơn thắng khi bằng). Quy hoạch động theo tổng. */
function chonKhit(ds: UngVienKhit[][], lo: number, hi: number, muc: number): number[] | null {
  const n = ds.length, minCon = new Array<number>(n + 1).fill(0), maxCon = new Array<number>(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    minCon[i] = minCon[i + 1] + Math.min(...ds[i].map((u) => u.w));
    maxCon[i] = maxCon[i + 1] + Math.max(...ds[i].map((u) => u.w));
  }
  let cur = new Map<number, { gia: number; vet: number[] }>([[0, { gia: 0, vet: [] }]]);
  for (let i = 0; i < n; i++) {
    const nx = new Map<number, { gia: number; vet: number[] }>();
    for (const [s, st] of cur) ds[i].forEach((u, j) => {
      const t = Math.round(s + u.w);
      if (t + minCon[i + 1] > hi || t + maxCon[i + 1] < lo) return;
      const g = st.gia + u.gia, o = nx.get(t);
      if (!o || g < o.gia - 1e-9) nx.set(t, { gia: g, vet: [...st.vet, j] });
    });
    cur = nx;
  }
  let tot1: { gia: number; vet: number[] } | null = null;
  for (const [t, st] of cur) {
    if (t < lo || t > hi) continue;
    const g = st.gia + Math.abs(t - muc) / 100;
    if (!tot1 || g < tot1.gia - 1e-9) tot1 = { gia: g, vet: st.vet };
  }
  return tot1 && tot1.vet.length === n ? tot1.vet : null;
}

/**
 * Khít đoạn kẹp: dãy căn nằm giữa hai mốc (dải lõi, ô thang, dãy khác) mà tổng bề ngang lệch chỗ (tầng đổi căn rộng / hẹp hơn,
 * STRETCH ±500 không đủ) thì sau STRETCH đổi / bỏ căn theo thứ tự GIA_KHIT cho tới khi không đè, không khe mới (tinh/khe.ts).
 * Đoạn có đầu tự do không đụng (QT-69 cho dãy dài ra / ngắn lại); đoạn một đầu sát mốc, đầu kia hở ra sân trong được dài ra /
 * ngắn lại tới khi sân còn cỡ hành lang. Ô trong `chanVao` (người dùng vừa chọn tay) không đổi sang loại khác: không vừa thì ghi
 * vào `chan` của kết quả (bề rộng ô còn cho căn đó, mẫu hẹp nhất cùng loại). `kq` = bố cục + mặt bằng (căn bỏ) mới, hoặc null
 * nếu không cần / không bớt được.
 */
function khitDoanKep(mau: ToaMB, mb: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc, giu: ReadonlySet<string>, goc: BoCuc = bc,
  chanVao: ReadonlySet<string> = new Set()):
  { kq: { bc: BoCuc; mb: MatBangSua; doi: BaoCaoKhitKep['doi']; bo: BaoCaoKhitKep['bo'] } | null; chan: ChanKhit[] } {
  const dai = daiLoi(mau, dl), san = sanHo(mau, dl, tv);
  let m = mb, hd = dung(mau, m, dl), cur = bc;
  const ref = refTheoNeo(loiTheoMat(hd, tv, { canTheo: {} }, san), m, hd, tv, cur, san);
  let loi = loiTheoMat(hd, tv, cur, san);
  const chanGap = new Map<string, ChanKhit>();
  if (!tongLoi(loi, ref)) return { kq: null, chan: [] };
  const truoc = tongLoi(loi, ref);
  // chi phí tính so với căn của bố cục vào (`goc`, trước STRETCH nhường chỗ): giữ đúng căn đó = 0
  const ungVien = (v: ReturnType<typeof viTriCan>[number]): UngVienKhit[] => {
    const id = canDangDung(v, cur), c = tv.can.get(id), w0 = v.a1 - v.a0 + chenhRong(v, id, tv);
    const g = tv.can.get(canDangDung(v, goc)) ?? c;
    if (!c || !g || c.vi_tri !== 'giua' || congNangTai(v.khoa, cur) !== 'can') return [{ id, w: w0, gia: 0 }];
    const chon = giu.has(v.khoa), cam = chanVao.has(v.khoa), ds: UngVienKhit[] = [];
    for (const x of tv.can.values()) {
      if (x.nhom !== c.nhom || x.vi_tri !== 'giua' || x.sau_mm !== c.sau_mm) continue;
      const cung = x.loai === g.loai;
      if (cam && !cung) continue; // căn người dùng vừa chọn tay: không tự đổi loại (không vừa thì chặn)
      const gia = x.id === g.id ? 0 : (chon ? (cung ? GIA_KHIT.canChon : GIA_KHIT.canChonKhacLoai) : cung ? GIA_KHIT.cungLoai : GIA_KHIT.khacLoai)
        + Math.abs(x.rong_mm - g.rong_mm) / 10;
      ds.push({ id: x.id, w: w0 + x.rong_mm - c.rong_mm, gia });
    }
    // ứng viên 0 = căn đang dùng (không đổi)
    ds.sort((a, b) => Number(b.id === id) - Number(a.id === id));
    if (!chon) ds.push({ id: null, w: 0, gia: GIA_KHIT.bo + g.dt_tt_m2 });
    return ds;
  };
  const doi = new Map<string, { tu: string; den: string }>(), bo: BaoCaoKhitKep['bo'] = [];
  for (let lan = 0; lan < 6 && tongLoi(loi, ref) > 0; lan++) {
    let sua = false;
    const vtsGoc = viTriCan(hd, tv), doan = doanCan(vtsGoc), vtsCur = viTriCan(hd, tv, cur);
    for (const d of doan) {
      const mi = d.matIdx;
      if (diemLoi(loi[mi], ref[mi]) <= 0) continue;
      const vs = d.ds.map((i) => vtsGoc[i]);
      // đoạn đã dồn qua thang bộ (donQuaThang: đầu tự do dài ra / ngắn lại theo) — không khít lại
      if (m.neo?.[vs[0].khoa]) continue;
      if (Math.abs(vs.reduce((a, v) => a + chenhRong(v, canDangDung(v, cur), tv), 0)) <= KHIT_MM) continue;
      // đoạn gây lỗi: trả về bề ngang bản vẽ thì mặt bớt lỗi
      let ve = cur;
      for (const v of vs) ve = voiCanViTri(ve, v.khoa, v.canGocId);
      if (diemLoi(loiTheoMat(hd, tv, ve, san)[mi], ref[mi]) >= diemLoi(loi[mi], ref[mi])) continue;
      // mốc hai đầu: phần tử có bề ngang (ô thang, dải lõi — chồng ≤ 200 mm là tường chung) hoặc dãy khác cùng mặt
      const moc = [...hd.mat[mi].phan_tu.filter((q) => q.loai !== 'can' && q.a1 - q.a0 > 1).map((q) => ({ a0: q.a0, a1: q.a1, bang: !!q.bang })),
        ...doan.filter((o) => o !== d && o.matIdx === mi).map((o) => ({ a0: o.a0, a1: o.a1, bang: false }))];
      const trai = moc.filter((o) => o.a0 < d.a0 && o.a1 <= d.a0 + TUONG_CHUNG_LOI_MM + KHIT_MM).sort((a, b) => b.a1 - a.a1)[0];
      const phai = moc.filter((o) => o.a1 > d.a1 && o.a0 >= d.a1 - TUONG_CHUNG_LOI_MM - KHIT_MM).sort((a, b) => a.a0 - b.a0)[0];
      if (!trai && !phai) continue;
      const T = d.a1 - d.a0, ds = vs.map(ungVien);
      const satTrai = !!trai && d.a0 - trai.a1 <= KHE_TUONG_MM, satPhai = !!phai && phai.a0 - d.a1 <= KHE_TUONG_MM;
      // QT-69 · đầu hở ra sân trong: phần tử gần nhất phía sân (vị trí đã dồn, trừ chính đoạn này), sân còn lại tối thiểu
      const khoaDoan = new Set(vs.map((v) => v.khoa));
      const khac = [...vtsCur.filter((v) => v.matIdx === mi && !khoaDoan.has(v.khoa)).map((v) => [v.a0, v.a1] as const),
        ...hd.mat[mi].phan_tu.filter((q) => q.loai !== 'can' && q.a1 - q.a0 > 1).map((q) => [q.a0, q.a1] as const)];
      const rongMax = Math.max(0, ...vtsCur.filter((v) => v.matIdx === mi).map((v) => v.a1 - v.a0));
      const sanPhai = satTrai && !satPhai ? sanTaiDau(san, mi, d.a1, true) : undefined;
      const sanTrai = satPhai && !satTrai ? sanTaiDau(san, mi, d.a0, false) : undefined;
      let hi: number, chon: number[] | null;
      if (satTrai && satPhai) {
        // kẹp hai mốc sát: khít khi neo đầu nào cũng được (donKhit chọn neo) — không vượt mốc, hở ≤ 400 mm (tường)
        const Lmin = trai!.a1 - (trai!.bang ? TUONG_CHUNG_LOI_MM : 0), Rmax = phai!.a0 + (phai!.bang ? TUONG_CHUNG_LOI_MM : 0);
        hi = Math.min(Rmax - d.a0, d.a1 - Lmin) + KHIT_MM;
        let lo = Math.max(phai!.a0 - d.a0, d.a1 - trai!.a1) - KHE_TUONG_MM;
        if (lo > hi) { hi = Rmax - d.a0 + KHIT_MM; lo = hi - KHE_TUONG_MM; }
        chon = chonKhit(ds, lo, hi, Math.min(Math.max(T, lo), hi));
      } else if (sanPhai || sanTrai) {
        // một đầu sát mốc, đầu kia hở ra sân trong: dãy dài ra / ngắn lại ở đầu sân (nét bao theo), sân còn ≥ cỡ hành lang
        const xa = sanPhai ? Math.min(sanPhai.s1, ...khac.filter(([a0]) => a0 >= sanPhai.s0 - KHIT_MM).map(([a0]) => a0))
          : Math.max(sanTrai!.s0, ...khac.filter(([, a1]) => a1 <= sanTrai!.s1 + KHIT_MM).map(([, a1]) => a1));
        hi = (sanPhai ? xa - sanConMin(rongMax) - d.a0 : d.a1 - xa - sanConMin(rongMax)) + KHIT_MM;
        chon = chonKhit(ds, 0, hi, Math.min(T, hi));
      } else {
        // một đầu hở ra khoảng trống khác (hành lang cắt ngang, cánh khác): giữ đúng chiều dài dãy bản vẽ, hai đầu không xê dịch
        hi = T + KHIT_MM;
        chon = chonKhit(ds, T - KHIT_MM, hi, T) ?? chonKhit(ds, T - KHE_TUONG_MM, hi, T);
      }
      // căn người dùng vừa chọn trong đoạn: ghi số đo để báo nếu cuối cùng mặt vẫn lỗi (ô còn cho căn đó = đoạn trừ phần tối
      // thiểu của căn khác — căn khác bỏ được thì tính 0; `du` = căn vừa bề rộng nhưng phần dư không xếp vừa căn nào)
      vs.forEach((v, i) => {
        if (!chanVao.has(v.khoa) || !ds[i].length) return;
        const c = tv.can.get(canDangDung(v, goc));
        if (!c) return;
        const khacMin = ds.reduce((a, u, k) => a + (k === i ? 0 : Math.min(...u.map((x) => x.w))), 0);
        const rongO = Math.max(0, Math.round(hi - KHIT_MM - khacMin)), rongMin = Math.round(Math.min(...ds[i].map((x) => x.w)));
        chanGap.set(v.khoa, { khoa: v.khoa, matIdx: mi, id: c.id, loai: c.loai, rongO, rongMin, kieu: rongO < rongMin ? 'hep' : 'du' });
      });
      if (!chon) continue;
      if (chon.every((j) => j === 0)) continue;
      let b2 = cur, m2 = m;
      const doi2: [string, string, string][] = [], bo2: [string, string][] = [];
      chon.forEach((j, i) => {
        if (!j) return;
        const v = vs[i], u = ds[i][j], tu = canDangDung(v, goc);
        if (u.id === null) {
          if (m2 === m) m2 = banSaoMatBang(m);
          if (boCanKep(mau, m2, dai, v.khoa)) { b2 = voiCongNang(b2, v.khoa, 'bo'); bo2.push([v.khoa, tu]); }
        } else { b2 = voiCanViTri(b2, v.khoa, u.id); doi2.push([v.khoa, tu, u.id]); }
      });
      const hd2 = m2 === m ? hd : dung(mau, m2, dl), loi2 = loiTheoMat(hd2, tv, b2, san);
      if (tongLoi(loi2, ref) >= tongLoi(loi, ref)) continue;
      cur = b2; m = m2; hd = hd2; loi = loi2; sua = true;
      for (const [k, tu, den] of doi2) doi.set(k, { tu: doi.get(k)?.tu ?? tu, den });
      for (const [k, id] of bo2) { bo.push({ khoa: k, id: doi.get(k)?.tu ?? id }); doi.delete(k); }
      if (bo2.length) break; // dãy đổi hình: chia đoạn lại
    }
    if (!sua) break;
  }
  const chan = [...chanGap.values()];
  if (tongLoi(loi, ref) >= truoc) return { kq: null, chan };
  return { kq: { bc: cur, mb: m, doi: [...doi].filter(([, x]) => x.tu !== x.den).map(([khoa, x]) => ({ khoa, ...x })), bo }, chan };
}

// ---------- tự chỉnh cả tòa: chung + tầng riêng + thang liền suốt chiều cao ----------
/** Hai mặt bằng cùng hình học (thang, độ dời căn, mép mặt, nét bao, hành lang, căn bỏ) — báo cáo không tính. */
const cungHinh = (a: MatBangSua, b: MatBangSua) => {
  const k = (m: MatBangSua) => JSON.stringify([m.thangBo, m.dich ?? {}, m.mep ?? {}, m.duongBao ?? null, m.hanhLang, m.hanhLangThem ?? [], m.boCan ?? []]);
  return k(a) === k(b);
};
/** Thang bộ của tầng riêng khác bố cục chung (vị trí điểm chèn / chiều cửa). */
export const thangLechChung = (a: MatBangSua, chung: MatBangSua): boolean => {
  const k = (m: MatBangSua) => m.thangBo.map((t) => `${t.matIdx}:${Math.round(t.a0 + t.dIns)}:${t.sx}`).sort().join('|');
  return k(a) !== k(chung);
};

/**
 * Hợp thang: chèn các thang `them` (thang riêng của tầng khác, chưa có / không chồng chỗ thang nào) vào MẶT BẰNG CHUNG `mbC`
 * như PC-11 thêm thang (chỗ cắt gần vị trí của tầng đó nhất, căn phía đầu tự do dời đi, mặt dài ra) — mọi thang cùng nằm trong
 * một mặt bằng nhất quán. Không bỏ thang nào nên thoát nạn mọi tầng không tệ đi (an toàn PCCC). Trả mặt bằng chung đã chèn
 * (tập thang + cách chia căn mẫu cho mọi tầng) và số thang không chèn được (đoạn không có đầu tự do).
 */
export function hopThang(mau: ToaMB, mbC: MatBangSua, dl: DuLieuMB | null | undefined, tv: ThuVien, bc: BoCuc, them: ThangBoMB[]): { mb: MatBangSua; khongDat: number } {
  let mb = banSaoMatBang(mbC);
  const dai = daiLoi(mau, dl);
  const chenh = new Map(viTriCan(mau, tv).map((v) => [v.khoa, chenhRong(v, canDangDung(v, bc), tv)]));
  let khongDat = 0;
  for (const e of them) {
    if (mb.thangBo.some((t) => cungThang(t, e) || chongThang(t, e))) continue;
    // quy tắc thang bộ: tối đa 3 thang — hợp thang các tầng không vượt THANG_MAX (thang tầng chung giữ)
    if (mb.thangBo.length >= THANG_MAX) continue;
    const mi = e.matIdx;
    const dn = doanTai(mau, mb, dai, mi, e.a0 + e.rong / 2);
    const cuts = choCat(vatThe(mau, mb, mi), dn, chenh).sort((a, b) => Math.abs(a - e.a0) - Math.abs(b - e.a0) || a - b);
    let khoa = e.khoa;
    for (let i = 1; mb.thangBo.some((u) => u.khoa === khoa); i++) khoa = `${e.khoa}~${i}`;
    let dat = false;
    for (const p of cuts) {
      const thu = banSaoMatBang(mb);
      if (!themThang(mau, thu, dai, mi, p, e.sx, khoa)) continue;
      if (thu.thangBo.some((t, i) => thu.thangBo.some((u, j) => j !== i && chongThang(t, u)))) continue;
      mb = thu; dat = true;
      break;
    }
    if (!dat) khongDat++;
  }
  return { mb, khongDat };
}

/** Gỡ các thay đổi tự chỉnh đã ghi (`toa.tuDong`) — giá trị người dùng đã sửa khác đi thì giữ của người dùng. */
export function goTuDong<T extends ToaDat>(toa: T): T {
  if (!toa.tuDong?.length) return toa.tuDong ? { ...toa, tuDong: undefined } : toa;
  const canViTri: Record<string, string> = { ...(toa.canViTri ?? {}) };
  const congNang: Record<string, string> = { ...(toa.congNang ?? {}) };
  const tr: Record<string, { canViTri: Record<string, string>; congNang: Record<string, string> }> = {};
  for (const [k, g] of Object.entries(toa.tangRieng ?? {})) tr[k] = { canViTri: { ...(g.canViTri ?? {}) }, congNang: { ...(g.congNang ?? {}) } };
  for (const d of [...toa.tuDong].reverse()) {
    const noi = d.tang === null ? (d.truong === 'canViTri' ? canViTri : congNang) : tr[d.tang]?.[d.truong];
    if (!noi || noi[d.khoa] !== d.moi) continue;
    if (d.cu === undefined) delete noi[d.khoa]; else noi[d.khoa] = d.cu;
  }
  const gon = <V>(m: Record<string, V>) => (Object.keys(m).length ? m : undefined);
  const tangRieng = toa.tangRieng && Object.fromEntries(Object.entries(toa.tangRieng).map(([k, g]) => [k, {
    ...g, canViTri: gon(tr[k].canViTri), congNang: gon(tr[k].congNang) as Record<string, CongNangO> | undefined,
  }]));
  return { ...toa, canViTri: gon(canViTri), congNang: gon(congNang) as Record<string, CongNangO> | undefined, ...(tangRieng ? { tangRieng } : {}), tuDong: undefined };
}

/** Ghi thay đổi của tầng `tang` (null = chung) vào bố cục tòa, nối vào `ghi` để gỡ lần sau. */
function apThayDoi<T extends ToaDat>(toa: T, tang: number | null, ds: ThayDoiBC[], ghi: ThayDoiTuDong[]): T {
  if (!ds.length) return toa;
  if (tang === null) {
    const canViTri = { ...(toa.canViTri ?? {}) }, congNang: Record<string, CongNangO> = { ...(toa.congNang ?? {}) };
    for (const d of ds) {
      const noi: Record<string, string> = d.truong === 'canViTri' ? canViTri : congNang;
      ghi.push({ tang, truong: d.truong, khoa: d.khoa, cu: noi[d.khoa], moi: d.moi });
      noi[d.khoa] = d.moi;
    }
    return { ...toa, canViTri, congNang };
  }
  const g = toa.tangRieng?.[tang] ?? {};
  const canViTri = { ...(g.canViTri ?? {}) }, congNang: Record<string, CongNangO> = { ...(g.congNang ?? {}) };
  for (const d of ds) {
    const noi: Record<string, string> = d.truong === 'canViTri' ? canViTri : congNang;
    ghi.push({ tang, truong: d.truong, khoa: d.khoa, cu: noi[d.khoa], moi: d.moi });
    noi[d.khoa] = d.moi;
  }
  return { ...toa, tangRieng: { ...(toa.tangRieng ?? {}), [tang]: { ...g, canViTri, congNang } } };
}

/**
 * Tự chỉnh MỘT tòa trong PA (bật mặc định như app cũ, chạy trong kho.sua nên hoàn tác một bước):
 *  1. gỡ thay đổi tự chỉnh lần trước (`tuDong`), chạy bố cục chung rồi TỪNG tầng có bố cục riêng (thoát nạn theo căn của tầng);
 *     mỗi bố cục: XC-03/05/06/07 · PC-11 · QT-69, còn căn vượt thì gỡ (tuChinhGiam — tắt bằng `giamCanTN: false`);
 *  2. thang bộ phải liền suốt chiều cao: tầng riêng có thang khác tầng chung thì lấy HỢP thang mọi tầng (`thangLien` 'hop',
 *     mặc định) hoặc thang tầng chung ('chung'), ép tập đó lên MỌI tầng (căn nhường chỗ, không khe / đè), rồi kiểm lại thoát nạn
 *     và gỡ căn từng tầng; thang của mẫu không bỏ được thì thêm vào tập chung và ép lại.
 * Mặt bằng riêng của tầng chỉ lưu khi khác mặt bằng chung. Tòa tắt tự chỉnh / mẫu không có mặt thì giữ nguyên.
 */
export function tuChinhToa<T extends ToaDat>(toa: T, mau: ToaMB | undefined, tv: ThuVien, dl: DuLieuMB | null | undefined): T {
  return tuChinhToaKq(toa, mau, tv, dl).toa;
}

/** Căn người dùng vừa chọn không vừa ô ở tầng `tang` (null = bố cục chung). */
export type ChanSua = ChanKhit & { tang: number | null };

/** Như tuChinhToa, kèm danh sách căn vừa chọn tay (`vuaChon`: tầng → khoá ô) không đặt vừa — khít không đổi loại các căn đó. */
export function tuChinhToaKq<T extends ToaDat>(toa: T, mau: ToaMB | undefined, tv: ThuVien, dl: DuLieuMB | null | undefined,
  vuaChon?: ReadonlyMap<number | null, string[]>): { toa: T; chan: ChanSua[] } {
  if (!mau || !Array.isArray(mau.mat) || toa.tuChinhMB === false) return { toa, chan: [] };
  const H = chieuCaoPCCC(toa.soTangDe, toa.caoDe, toa.soTangDH, toa.caoDH);
  const goc = goTuDong(toa);
  // gỡ căn vượt cự ly CHỈ khi người dùng bật (`giamCanTN: true`) — mặc định cự ly thoát nạn chỉ CẢNH BÁO như app cũ (nhãn cự ly
  // từng căn ở lớp Thoát nạn), không tự bỏ căn / đổi phòng kỹ thuật (chủ nhiệm 29/10/2026)
  const bat = toa.giamCanTN === true;
  const rieng = tangCoRieng(goc);
  // số căn vượt cự ly của lần tự chỉnh trước (trước khi gỡ) — PC-11 giữ tập thang cũ nếu không tệ hơn
  const vuotCu = (m?: MatBangSua | null) => m?.baoCao?.giamCan?.vuotTruoc ?? m?.baoCao?.vuotSau ?? 0;
  const chay = (U?: ThangBoMB[], ref?: MatBangSua) => {
    const ghi: ThayDoiTuDong[] = [];
    // ô người dùng tự chọn căn (bố cục trước tự chỉnh): khít đoạn kẹp không bỏ, chỉ đổi cùng loại
    const giu = (k: number | null) => Object.keys(boCucTang(goc, k).canViTri ?? {}).sort();
    const tay = goc.thangTay;
    const rc = tuChinhGiam(mau, tv, dl, { bc: boCucTang(goc, null), chieuCaoPCCC: H, thangEp: U, thangMau: ref, giu: giu(null), chan: vuaChon?.get(null), thangTay: tay, loaiThang: goc.loaiThang,
      thangTruoc: tay || U ? undefined : toa.matBang?.thangBo, thangTruocVuot: vuotCu(toa.matBang) }, bat);
    let t1 = apThayDoi(goc, null, rc.thayDoi, ghi);
    const rf = new Map<number, KetQuaGiam>();
    for (const k of rieng) {
      const r = tuChinhGiam(mau, tv, dl, { tangRieng: true, bc: boCucTang(t1, k), chieuCaoPCCC: H, thangEp: U, thangMau: ref, giu: giu(k), chan: vuaChon?.get(k), thangTay: tay, loaiThang: goc.loaiThang,
        thangTruoc: tay || U ? undefined : (matBangRiengTang(toa, k) ?? toa.matBang)?.thangBo, thangTruocVuot: vuotCu(matBangRiengTang(toa, k) ?? toa.matBang) }, bat);
      rf.set(k, r);
      t1 = apThayDoi(t1, k, r.thayDoi, ghi);
    }
    return { rc, rf, t1, ghi };
  };
  let kq = chay();
  const lech = [...kq.rf].filter(([, r]) => thangLechChung(r.matBang, kq.rc.matBang)).map(([k]) => k);
  if (lech.length) {
    const cheDo = toa.thangLien ?? 'hop';
    // 'hop': chèn thang riêng của các tầng vào mặt bằng chung (một mặt bằng nhất quán); 'chung': giữ thang tầng chung
    let h = hopThang(mau, kq.rc.matBang, dl, tv, kq.rc.bc, cheDo === 'hop' ? [...kq.rf.values()].flatMap((r) => r.matBang.thangBo) : []);
    let khongHop = h.khongDat, U = h.mb.thangBo.map((t) => ({ ...t }));
    for (let lap = 0; lap < 3; lap++) {
      kq = chay(U, h.mb);
      // thang của mẫu kẹp không bỏ được ở tầng nào đó: thêm vào tập chung rồi ép lại
      const thua = [kq.rc, ...kq.rf.values()].flatMap((r) => r.thua).filter((t) => !U.some((u) => cungThang(u, t) || chongThang(u, t)));
      if (!thua.length) break;
      h = hopThang(mau, kq.rc.matBang, dl, tv, kq.rc.bc, thua);
      khongHop += h.khongDat;
      U = h.mb.thangBo.map((t) => ({ ...t }));
    }
    for (const r of [kq.rc, ...kq.rf.values()]) {
      r.baoCao.thangLien = { cheDo, soThang: U.length, soTang: lech.length, khongDat: r.khongDat + khongHop, vuot: r.baoCao.giamCan?.vuotTruoc ?? r.baoCao.vuotSau ?? 0, nhuong: r.soNhuong, conLech: r.conLech };
      r.matBang.baoCao = r.baoCao;
    }
  }
  const { rc, rf, t1, ghi } = kq;
  rc.matBang.baoCao = rc.baoCao;
  const matBang = rc.matBang;
  let tangRieng = t1.tangRieng;
  if (tangRieng) {
    const moi: NonNullable<ToaDat['tangRieng']> = {};
    for (const [k, g] of Object.entries(tangRieng)) {
      const { matBang: _bo, ...conLai } = g;
      void _bo;
      const r = rf.get(Number(k));
      // mặt bằng riêng của tầng: lưu khi khác hình chung, hoặc có gỡ căn riêng (báo cáo của tầng khác tầng chung)
      const g2 = r?.baoCao.giamCan, coGiam = !!g2 && g2.xepLai + g2.doi + g2.bo > 0;
      // thang liền suốt chiều cao: loại thang của tầng riêng theo thang cùng chỗ ở tầng chung
      const mbR = r && { ...r.matBang, thangBo: loaiTheoChung(r.matBang.thangBo, matBang.thangBo) };
      moi[Number(k)] = r && mbR && (!cungHinh(mbR, matBang) || coGiam || r.baoCao.thangLien) ? { ...conLai, matBang: { ...mbR, baoCao: r.baoCao } } : conLai;
    }
    tangRieng = moi;
  }
  // nét bao + DTXD riêng của tòa (chanToa / chỉ tiêu đọc): chỉ ghi khi khác nét bao mẫu
  const bao = matBang.duongBao;
  const chan: ChanSua[] = [...rc.chan.map((c) => ({ ...c, tang: null })), ...[...rf].flatMap(([k, r]) => r.chan.map((c) => ({ ...c, tang: k })))];
  return { toa: { ...t1, matBang, duongBao: bao, dtxdM2: bao ? Math.round(dtDG(bao) / 1e4) / 100 : undefined, ...(tangRieng ? { tangRieng } : {}), tuDong: ghi.length ? ghi : undefined }, chan };
}

/** Loại thang của tập `ds` theo thang cùng khoá / cùng chỗ trong `chung` (vẫn giữ ≥ 1 N2 + ≥ 1 N3). */
export function loaiTheoChung(ds: readonly ThangBoMB[], chung: readonly ThangBoMB[]): ThangBoMB[] {
  const chon: Record<string, string> = {};
  for (const t of ds) {
    const c = chung.find((u) => u.khoa === t.khoa) ?? chung.find((u) => cungThang(u, t));
    if (c && laLoaiThang(c.block)) chon[t.khoa] = c.block;
  }
  return ganLoaiThang(ds, chon);
}

/** Ô căn người dùng đổi tay giữa hai trạng thái tòa (bố cục sau khi gỡ tự chỉnh, từng tầng chung / riêng): tầng → khoá ô. */
export function oVuaChon(truoc: ToaDat, sau: ToaDat): Map<number | null, string[]> {
  const a = goTuDong(truoc), b = goTuDong(sau), kq = new Map<number | null, string[]>();
  for (const k of [null, ...new Set([...tangCoRieng(a), ...tangCoRieng(b)])]) {
    const ca = boCucTang(a, k).canViTri ?? {}, cb = boCucTang(b, k).canViTri ?? {};
    const ds = Object.keys(cb).filter((x) => cb[x] !== ca[x]).sort();
    if (ds.length) kq.set(k, ds);
  }
  return kq;
}

/** Trả ô `khoa` của tầng `tang` về giá trị bố cục `truoc` (đã gỡ tự chỉnh). */
function traVe<T extends ToaDat>(toa: T, truoc: ToaDat, tang: number | null, khoa: string): T {
  const dat = (m: Record<string, string> | undefined, v: string | undefined) => {
    const o = { ...(m ?? {}) };
    if (v === undefined) delete o[khoa]; else o[khoa] = v;
    return Object.keys(o).length ? o : undefined;
  };
  if (tang === null) return { ...toa, canViTri: dat(toa.canViTri, truoc.canViTri?.[khoa]) };
  const g = toa.tangRieng?.[tang];
  if (!g) return toa;
  return { ...toa, tangRieng: { ...toa.tangRieng, [tang]: { ...g, canViTri: dat(g.canViTri, truoc.tangRieng?.[tang]?.canViTri?.[khoa]) } } };
}

/**
 * Tự chỉnh sau một phép sửa TAY của người dùng (đổi căn, STRETCH): căn người dùng vừa chọn không bị tự đổi sang loại khác. Sau mọi
 * bước (STRETCH, đổi căn khác, dãy dài ra ở đầu tự do / sân trong) mà căn đó vẫn không vừa ô thì CHẶN phép đổi ở ô đó — giữ căn cũ
 * (mọi tầng vừa đổi) — và trả danh sách chặn để báo. Các căn khác vẫn đổi / bỏ như khít đoạn kẹp. Bộ tối ưu tự động gọi tuChinhToa.
 */
export function tuChinhSauSua<T extends ToaDat>(truoc: T, sau: T, mau: ToaMB | undefined, tv: ThuVien, dl: DuLieuMB | null | undefined): { toa: T; chan: ChanSua[] } {
  const vua = oVuaChon(truoc, sau);
  const r = tuChinhToaKq(sau, mau, tv, dl, vua);
  if (!r.chan.length) return r;
  const goc = goTuDong(truoc), khoaChan = new Set(r.chan.map((c) => c.khoa));
  let t2 = sau;
  const conLai = new Map<number | null, string[]>();
  for (const [k, ds] of vua) {
    for (const x of ds) if (khoaChan.has(x)) t2 = traVe(t2, goc, k, x);
    const giu = ds.filter((x) => !khoaChan.has(x));
    if (giu.length) conLai.set(k, giu);
  }
  const r2 = tuChinhToaKq(t2, mau, tv, dl, conLai);
  // chặn trùng ô (chung + tầng riêng) báo một lần
  const da = new Set<string>();
  return { toa: r2.toa, chan: [...r.chan, ...r2.chan].filter((c) => !da.has(c.khoa) && !!da.add(c.khoa)) };
}

/** Chuẩn hoá `matBang` đọc từ PA cũ / tệp: sai cấu trúc thì bỏ (về mặc định của mẫu). */
export function chuanHoaMatBang(v: unknown): MatBangSua | undefined {
  const o = v as Partial<MatBangSua> | null | undefined;
  if (!o || typeof o !== 'object' || o.phienBan !== 1 || !Array.isArray(o.thangBo) || !Array.isArray(o.hanhLang)) return undefined;
  const so = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  const diem = (p: unknown) => Array.isArray(p) && p.length === 2 && so(p[0]) && so(p[1]);
  if (!o.thangBo.every((t) => t && so(t.matIdx) && so(t.a0) && so(t.rong) && (t.sx === 1 || t.sx === -1) && so(t.dIns) && so(t.bIns) && typeof t.khoa === 'string')) return undefined;
  if (!o.hanhLang.every((s) => s && diem(s.p0) && diem(s.p1))) return undefined;
  if (o.duongBao && !(Array.isArray(o.duongBao) && o.duongBao.length >= 3 && o.duongBao.every(diem))) return undefined;
  return o as MatBangSua;
}

/** Chữ ký mặt bằng đã tự chỉnh (chung + từng tầng riêng) để 3D / hộp xuất CAD dựng lại sau mỗi lần tự chỉnh. */
export const chuKyMatBang = (toa: ToaDat): string => {
  const k = (m: ToaDat['matBang']) => (m ? [m.thangBo, m.dich, m.mep, m.duongBao, m.hanhLang, m.hanhLangThem] : null);
  return JSON.stringify([k(toa.matBang), Object.entries(toa.tangRieng ?? {}).map(([t, g]) => [t, k(g.matBang)])]);
};
