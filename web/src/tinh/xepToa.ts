/**
 * Gợi ý xếp tòa trên một lô (MT-05 · QT-67 / QT-82 "Tối ưu lô" app cũ `toiUuLo`): vét mọi mẫu tòa đúng dòng sản phẩm của lô
 * (MT-01) × cách xếp, chấm bằng chính bộ kiểm tra của app. Hàm thuần, toạ độ mét như lô.
 *
 * Mỗi mẫu: xếp tham lam nhiều tòa nhất (lưới 3 m, góc theo cạnh dài nhất của lô + 90/180/270°, neo "tâm" lô và "góc" đầu cạnh
 * dài, như `tuDatToaG`), mỗi lần đặt kiểm: trong chỉ giới / ranh lô (LO-05), khoảng lùi Bảng 2.7 theo lộ giới TỪNG cạnh lô
 * (LO-01 · `Lo.canhDuong`; cạnh không giáp đường lùi 0; lô chưa khai thì áp mọi cạnh đường 12 m như app cũ khi thiếu `lo.canh`), khoảng cách cạnh dài §2.6.1 với
 * tòa đã đặt và tòa lô bên cạnh trong 60 m (LO-02), dừng khi chạm MĐXD (CT-01). Mỗi số tòa 1..n là một phương án; số tầng điển
 * hình lớn nhất ≤ trần QH mà `tinhChiTieu` không vượt (MĐXD, HSSDĐ gồm hầm, tầng cao, số căn, dân số — CT-01…04), như
 * `tangToiDa` (QT-68). Sau đó trộn mẫu: lấp chỗ trống của phương án tốt nhất bằng mẫu khác.
 * Xếp hạng (`khoaHangPA` app cũ): đạt QH → ít căn vượt thoát nạn (PCCC, pccc.ts) → điểm (sát số căn chỉ tiêu, ít lệch cơ cấu,
 * tận dụng HSSDĐ, % hướng tốt MT-06).
 */
import { tinhChiTieu } from './chiTieu';
import { diemLechCoCau } from './coCau';
import { chanToa, dienTich, trongTam } from './hinhHoc';
import { taoToaTrenLo, vungDat } from './hopLo';
import type { Diem, Lo, LoaiCan, ThuVien, ToaDat, ToaMau, TrangThaiPA } from './kieu';
import { coMat, viTriCan, type ToaCoMat } from './matBang';
import { chieuCaoPCCC, thoatNan, type ToaPCCC } from './pccc';
import type { Luat } from './quyTac';
import { sucChua } from './sucChua';

// ---------- luật LO-01 / LO-02 đọc từ quy_tac.json ----------

/** LO-01 · Bảng 2.7: khoảng lùi (m) theo bề rộng đường × chiều cao công trình, đọc bảng trong luật. */
export function luiBang27(luat: Luat, rongDuong: number, H: number): number {
  const b = luat.bang as { cot_cao_m: string[]; hang_duong_m: Record<string, number[]> } | undefined;
  if (!b) return 0;
  const moc = (nhan: string[]) => nhan.slice(1).map((s) => Number(/[\d.]+/.exec(s)?.[0] ?? Infinity));
  const cot = moc(b.cot_cao_m).filter((m) => H >= m).length;
  const hang = Object.keys(b.hang_duong_m);
  const r = moc(hang).filter((m) => rongDuong >= m).length;
  return b.hang_duong_m[hang[r]]?.[cot] ?? 0;
}

/** Bề rộng đường mặc định khi lô chưa khai lộ giới từng cạnh — app cũ `TMB.rong` = 12 m ("Bề rộng đường tiếp giáp" `tm_rong`). */
export const RONG_DUONG_MAC_DINH = 12;

/** Lô đã khai lộ giới từng cạnh (số phần tử khớp số cạnh ranh). */
export const coCanhDuong = (lo: Lo): boolean => Array.isArray(lo.canhDuong) && lo.canhDuong.length === lo.ranh.length && lo.ranh.length >= 3;

/**
 * Bề rộng lộ giới cạnh i của lô (m); null = cạnh không giáp đường. Lô chưa khai thì mọi cạnh giáp đường `macDinh` m (hành vi cũ).
 */
export function rongCanh(lo: Lo, i: number, macDinh = RONG_DUONG_MAC_DINH): number | null {
  if (!coCanhDuong(lo)) return macDinh;
  const v = lo.canhDuong![i];
  return typeof v === 'number' && v > 0 ? v : null;
}

/**
 * LO-01 · Bảng 2.7 theo TỪNG cạnh lô (`cach_tinh` LO-01, app cũ `luiCanh`): cạnh giáp đường lùi theo lộ giới của chính cạnh đó ×
 * chiều cao H; cạnh không giáp đường lùi 0. Trả mảng theo thứ tự cạnh của `ranh`.
 */
export function luiTungCanh(luat: Luat, lo: Lo, H: number, macDinh = RONG_DUONG_MAC_DINH): number[] {
  return lo.ranh.map((_, i) => { const r = rongCanh(lo, i, macDinh); return r === null ? 0 : luiBang27(luat, r, H); });
}

/** LO-02 · §2.6.1: khoảng cách tối thiểu cạnh dài / đầu hồi (m) theo chiều cao công trình cao hơn, đọc ngưỡng trong luật. */
export function kcToa261(luat: Luat, H: number): { dai: number; hoi: number } {
  const giaTri = (v: number | string): number => {
    if (typeof v === 'number') return v;
    const m = /max\(\s*H\s*\/\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/.exec(v);
    return m ? Math.max(H / Number(m[1]), Number(m[2])) : Number(v);
  };
  const ds = luat.nguong.map((n) => {
    const dk = n.dieu_kien ?? '';
    const moc = Number(/H\s*[<≥>]=?\s*([\d.]+)/.exec(dk)?.[1] ?? NaN);
    const duoi = /H\s*</.test(dk);
    return { hop: Number.isFinite(moc) ? (duoi ? H < moc : H >= moc) : true, dai: /cạnh dài/.test(dk), v: n.gia_tri };
  }).filter((x) => x.hop);
  const dai = ds.find((x) => x.dai), hoi = ds.find((x) => !x.dai);
  return { dai: dai ? giaTri(dai.v) : 0, hoi: hoi ? giaTri(hoi.v) : 0 };
}

// ---------- hình học nhanh (không dùng Clipper trong vòng lặp lưới) ----------
const trong = (p: Diem, P: Diem[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [x1, y1] = P[i], [x2, y2] = P[j];
    if ((y1 > p[1]) !== (y2 > p[1]) && p[0] < ((x2 - x1) * (p[1] - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
};
const kcDoan = (p: Diem, a: Diem, b: Diem) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const cat = (a: Diem, b: Diem, c: Diem, d: Diem) => {
  const o = (p: Diem, q: Diem, r: Diem) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
/** Khoảng cách nhỏ nhất giữa hai đa giác (0 khi cắt / chứa nhau) — `tmKC` app cũ. */
export function kcDaGiac(P: Diem[], Q: Diem[]): number {
  for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) if (cat(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length])) return 0;
  if (trong(P[0], Q) || trong(Q[0], P)) return 0;
  let m = Infinity;
  for (const p of P) for (let j = 0; j < Q.length; j++) m = Math.min(m, kcDoan(p, Q[j], Q[(j + 1) % Q.length]));
  for (const q of Q) for (let i = 0; i < P.length; i++) m = Math.min(m, kcDoan(q, P[i], P[(i + 1) % P.length]));
  return m;
}
const namTrongNhanh = (F: Diem[], V: Diem[]) =>
  F.every((p) => trong(p, V)) && !F.some((p, i) => V.some((q, j) => cat(p, F[(i + 1) % F.length], q, V[(j + 1) % V.length])));
/** Khoảng cách nhỏ nhất từ đa giác F tới đoạn ab (cạnh lô). */
export const kcToiDoan = (F: Diem[], a: Diem, b: Diem) => {
  let m = Infinity;
  for (const p of F) m = Math.min(m, kcDoan(p, a, b));
  for (const q of [a, b]) for (let k = 0; k < F.length; k++) m = Math.min(m, kcDoan(q, F[k], F[(k + 1) % F.length]));
  return m;
};
/** F đủ khoảng lùi `lui[i]` tới từng cạnh i của ranh R (cạnh lùi 0 bỏ qua). */
export const duLuiTungCanh = (F: Diem[], R: Diem[], lui: number[]) =>
  R.every((a, i) => !(lui[i] > 0) || kcToiDoan(F, a, R[(i + 1) % R.length]) >= lui[i] - 1e-6);

// ---------- kiểu kết quả ----------
export type LuatXep = { lo01: Luat; lo02: Luat };
export type DauVaoXep = {
  pa: TrangThaiPA;
  lo: Lo;
  tv: ThuVien;
  luat: LuatXep;
  /** Bề rộng đường áp mọi cạnh lô (m) khi lô chưa khai lộ giới từng cạnh (`Lo.canhDuong`) — app cũ mặc định 12 m (`TMB.rong`). */
  rongDuong?: number;
  /** Tim cửa căn (ma_goc → 0..1) để đo thoát nạn; thiếu thì 0,5. */
  cuaCan?: Record<string, number>;
  /** Bước lưới (m), mặc định 3 như "Tối ưu lô" app cũ. */
  buoc?: number;
  /** Số phương án trả về. */
  soGoiY?: number;
};
export type GoiYXep = {
  khoa: string;
  /** Tòa đặt trên lô (id tạm `goiy-…`; áp dụng thì đổi id mới). */
  toa: ToaDat[];
  /** Mẫu × số tòa, vd [["tm-i1", 3]]. */
  mau: [string, number][];
  soTangDH: number;
  soCan: number;
  soCanMuc: number | null;
  lech: number;
  /** DT sàn tính HSSDĐ / trần (0–1). */
  tyLeSan: number;
  matDo: number;
  danSo: number;
  /** Số chỉ tiêu vượt (MĐXD, HSSDĐ, tầng, số căn, dân số) — phương án gợi ý luôn 0. */
  loiQH: number;
  /** Căn vượt cự ly thoát nạn mỗi tầng (pccc.ts), null = mẫu chưa có đồ thị hành lang. */
  pcccVuot: number | null;
  /** % căn hướng tốt (Đ · ĐN · N, quy ước MDI app cũ `thongKeHuong`). */
  huongTot: number;
  /** Cặp tòa giữa mức đầu hồi và cạnh dài §2.6.1 (cảnh báo). */
  canhBao: string[];
  diem: number;
};

// ---------- MT-06: % căn hướng tốt (app cũ `huongThat` + nhóm mặc định TỐT = Đ · ĐN · N) ----------
const HUONG_TOT = [2, 3, 4];
function phanTramHuongTot(mau: ToaCoMat, tv: ThuVien, gocDo: number): number {
  const vts = viTriCan(mau, tv);
  if (!vts.length) return 0;
  let tot = 0;
  for (const vt of vts) {
    const m = mau.mat[vt.matIdx], a = ((m.goc_deg + gocDo) * Math.PI) / 180;
    const n: Diem = [-Math.sin(a), Math.cos(a)]; // pháp tuyến phía căn (b ≥ 0) = hướng ban công
    const b = (((90 - (Math.atan2(n[1], n[0]) * 180) / Math.PI) % 360) + 360) % 360;
    if (HUONG_TOT.includes(((Math.round(b / 45) % 8) + 8) % 8)) tot++;
  }
  return (tot / vts.length) * 100;
}

const CAO_DE = 4.5, CAO_DH = 3.3; // như taoToaTrenLo
const XET_LO_BEN_M = 60; // §2.6.1 với tòa lô bên cạnh: chỉ xét cặp cách < 60 m (cach_tinh LO-02)

type Dat = { mauId: string; x: number; y: number; goc: number; F: Diem[]; r: number };

/**
 * Bộ sinh phương án: nhả lượt (yield) sau mỗi mẫu tòa để giao diện không treo; kết quả cuối là danh sách gợi ý đã xếp hạng.
 */
export function* sinhGoiY(v: DauVaoXep): Generator<{ xong: number; tong: number }, GoiYXep[]> {
  const { lo, tv, luat, pa } = v;
  const buoc = v.buoc ?? 3, rongDuong = v.rongDuong ?? 12;
  const R = lo.ranh, V = vungDat(lo);
  if (R.length < 3 || V.length < 3 || lo.temDat.chucNang === 'khac') return [];
  const ct = lo.temDat.chiTieu, dtLo = dienTich(R);
  const nhom = lo.temDat.chucNang === 'xh' ? 'xh' : 'tm';
  const mauDs = [...tv.toa.values()].filter((m): m is ToaCoMat & ToaMau => m.nhom === nhom && coMat(m));
  const soTangDe = ct.tangDe ?? 1;
  const nMax = Math.max(1, ct.tangCanHo ?? Math.round(ct.tangCaoMax) - soTangDe);
  const Hmax = soTangDe * CAO_DE + nMax * CAO_DH;
  const lui = luiTungCanh(luat.lo01, lo, Hmax, rongDuong); // LO-01 theo lộ giới từng cạnh
  const kc = kcToa261(luat.lo02, Hmax);

  // tòa đã đặt ở lô khác (LO-02 · lô bên cạnh)
  const ngoai = pa.toa.filter((t) => t.loId !== lo.id && tv.toa.has(t.mauId)).map((t) => ({ F: chanToa(tv.toa.get(t.mauId)!, t), H: t.soTangDe * t.caoDe + t.soTangDH * t.caoDH }));

  // góc thử: theo cạnh dài nhất của ranh lô (+ 90 / 180 / 270), như app cũ
  let dai = 0, gocL = 0, iL = 0;
  R.forEach((p, i) => { const q = R[(i + 1) % R.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L > dai) { dai = L; iL = i; gocL = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI; } });
  const gocs = [0, 90, 180, 270].map((k) => Math.round(((((gocL + k) % 360) + 360) % 360) * 10) / 10);
  const xs = V.map((p) => p[0]), ys = V.map((p) => p[1]);
  const diemLuoi: Diem[] = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += buoc) for (let y = Math.min(...ys); y <= Math.max(...ys); y += buoc) if (trong([x, y], V)) diemLuoi.push([x, y]);
  const neo: Record<'tam' | 'goc', Diem> = { tam: trongTam(V), goc: R[iL] };

  // ứng viên tĩnh của một mẫu: điểm lưới × góc mà chân tòa trong vùng đặt + đủ lùi (không phụ thuộc tòa khác) — `ungVienTinh`
  const ungVienTinh = (mau: ToaCoMat & ToaMau) => {
    const kq: Dat[] = [];
    for (const [x, y] of diemLuoi) for (const goc of gocs) {
      const F = chanToa(mau, { x, y, gocDo: goc } as ToaDat);
      if (!namTrongNhanh(F, V)) continue;
      if (!duLuiTungCanh(F, R, lui)) continue;
      if (ngoai.some((o) => kcDaGiac(F, o.F) < XET_LO_BEN_M && kcDaGiac(F, o.F) < kcToa261(luat.lo02, Math.max(Hmax, o.H)).dai)) continue;
      kq.push({ mauId: mau.id, x, y, goc, F, r: Math.max(...F.map((p) => Math.hypot(p[0] - x, p[1] - y))) });
    }
    return kq;
  };
  // xếp tham lam từ neo: mỗi lần lấy ứng viên gần neo nhất còn đủ khoảng cách cạnh dài với các tòa đã có; dừng khi chạm MĐXD
  const xepThamLam = (uv: Dat[], nNeo: Diem, daCo: Dat[], dtChan: number) => {
    const ds = uv.slice().sort((a, b) => Math.hypot(a.x - nNeo[0], a.y - nNeo[1]) - Math.hypot(b.x - nNeo[0], b.y - nNeo[1]));
    const dat = daCo.slice();
    let foot = daCo.reduce((s, d) => s + dienTich(d.F), 0);
    while (dat.length < 40) {
      if (((foot + dtChan) / dtLo) * 100 > ct.matDoMax + 1e-6) break;
      const ch = ds.find((u) => dat.every((d) => Math.hypot(u.x - d.x, u.y - d.y) - u.r - d.r >= kc.dai || kcDaGiac(u.F, d.F) >= kc.dai));
      if (!ch) break;
      dat.push(ch);
      foot += dtChan;
    }
    return dat;
  };

  // số tầng lớn nhất ≤ nMax mà không vượt chỉ tiêu (đơn điệu theo số tầng → tìm nhị phân)
  const muc = sucChua(lo).soCanUoc;
  const thuPA = (dat: Dat[], n: number) => {
    const toa = dat.map((d, i) => ({ ...taoToaTrenLo(tv.toa.get(d.mauId)!, lo, `goiy-${i}`), x: Math.round(d.x * 100) / 100, y: Math.round(d.y * 100) / 100, gocDo: d.goc, soTangDH: n, soTangDe, caoDe: CAO_DE, caoDH: CAO_DH }));
    const kq = tinhChiTieu({ ...pa, lo: [lo], toa }, tv).theoLo[lo.id];
    return { toa, kq, loi: kq.dong.filter((d) => d.muc === 'vuot' && ['matDo', 'matDoThap', 'dtSan', 'tangCao', 'tangCanHo', 'soCan', 'danSo'].includes(d.khoa)).length };
  };
  const pccc = new Map<string, number | null>();
  const vuotPCCC = (mauId: string, n: number) => {
    const k = `${mauId}|${n}`;
    if (!pccc.has(k)) {
      const m = tv.toa.get(mauId) as unknown as ToaPCCC;
      let r: number | null = null;
      try { if (Array.isArray(m.truc)) r = thoatNan(m, { cuaCan: v.cuaCan, chieuCaoPCCC: chieuCaoPCCC(soTangDe, CAO_DE, n, CAO_DH) }).soVuot; } catch { r = null; }
      pccc.set(k, r);
    }
    return pccc.get(k)!;
  };
  const cham = (dat: Dat[], khoa: string): GoiYXep | null => {
    if (!dat.length) return null;
    let lo_ = 1, hi = nMax, tot: ReturnType<typeof thuPA> | null = null, nTot = 0;
    while (lo_ <= hi) {
      const mid = (lo_ + hi) >> 1, r = thuPA(dat, mid);
      if (r.loi === 0) { tot = r; nTot = mid; lo_ = mid + 1; } else hi = mid - 1;
    }
    if (!tot) return null;
    const kq = tot.kq;
    const dem = new Map<string, number>();
    dat.forEach((d) => dem.set(d.mauId, (dem.get(d.mauId) ?? 0) + 1));
    // §2.6.1: cặp tòa dưới mức cạnh dài theo H thật (≥ đầu hồi vì đã đặt theo H lớn nhất) = cảnh báo
    const H = soTangDe * CAO_DE + nTot * CAO_DH, kcH = kcToa261(luat.lo02, H), canhBao: string[] = [];
    for (let i = 0; i < dat.length; i++) for (let j = i + 1; j < dat.length; j++) {
      const d = kcDaGiac(dat[i].F, dat[j].F);
      if (d < kcH.dai) canhBao.push(`LO-02 ${i + 1}↔${j + 1} ${d.toFixed(1)} m`);
    }
    const pc = [...dem.keys()].map((m) => vuotPCCC(m, nTot));
    const pcccVuot = pc.some((x) => x === null) ? null : pc.reduce<number>((a, b) => a + (b ?? 0), 0);
    const huongTot = dat.reduce((s, d) => s + phanTramHuongTot(tv.toa.get(d.mauId) as ToaCoMat, tv, d.goc), 0) / dat.length;
    const lech = diemLechCoCau(kq.coCauPct, lo.temDat.coCauMucTieu as Record<LoaiCan, number>);
    const tran = ct.hssddMax * dtLo, tyLeSan = tran > 0 ? kq.dtSanTinhHSSDD / tran : 0;
    const tyLeCan = muc ? Math.min(1, kq.soCan / muc) : 0;
    return {
      khoa, toa: tot.toa, mau: [...dem], soTangDH: nTot, soCan: kq.soCan, soCanMuc: muc, lech, tyLeSan,
      matDo: kq.dong.find((d) => d.khoa === 'matDo')?.dat ?? 0, danSo: kq.soCan * ct.nguoiMoiCan, loiQH: tot.loi,
      pcccVuot, huongTot, canhBao,
      // điểm: sát số căn chỉ tiêu (≤ 100) − ½ lệch cơ cấu (như diemPA "cân bằng") + tận dụng HSSDĐ + % hướng tốt (nhẹ)
      diem: 100 * tyLeCan - 0.5 * lech + 20 * Math.min(1, tyLeSan) + 0.05 * huongTot - 2 * canhBao.length,
    };
  };

  const ketQua: GoiYXep[] = [];
  const tot1: { dat: Dat[]; diem: number }[] = [];
  const uvTheoMau = new Map<string, Dat[]>();
  for (let k = 0; k < mauDs.length; k++) {
    const mau = mauDs[k];
    const uv = ungVienTinh(mau);
    uvTheoMau.set(mau.id, uv);
    const dtChan = uv[0] ? dienTich(uv[0].F) : 0;
    // hai cách neo, giữ cách đặt được nhiều tòa hơn (bằng nhau: "tâm")
    const cach = (['tam', 'goc'] as const).map((n) => xepThamLam(uv, neo[n], [], dtChan)).sort((a, b) => b.length - a.length)[0] ?? [];
    for (let n = 1; n <= cach.length; n++) {
      const g = cham(cach.slice(0, n), `${mau.id}×${n}`);
      if (g) { ketQua.push(g); tot1.push({ dat: cach.slice(0, n), diem: g.diem }); }
    }
    yield { xong: k + 1, tong: mauDs.length + 1 };
  }
  // trộn mẫu: lấp chỗ trống của phương án tốt nhất bằng mẫu khác (vẫn giữ MĐXD + lùi + §2.6.1)
  tot1.sort((a, b) => b.diem - a.diem);
  if (tot1.length && mauDs.length > 1) {
    let dat = tot1[0].dat;
    for (const mau of mauDs) {
      const uv = uvTheoMau.get(mau.id) ?? [];
      if (!uv.length) continue;
      dat = xepThamLam(uv, neo.tam, dat, dienTich(uv[0].F));
    }
    if (dat.length > tot1[0].dat.length && new Set(dat.map((d) => d.mauId)).size > 1) {
      const g = cham(dat, `tron×${dat.length}`);
      if (g) ketQua.push(g);
    }
  }
  yield { xong: mauDs.length + 1, tong: mauDs.length + 1 };
  // xếp hạng: đạt QH → ít căn vượt PCCC → điểm; bỏ trùng số liệu
  ketQua.sort((a, b) => a.loiQH - b.loiQH || (a.pcccVuot ?? 99) - (b.pcccVuot ?? 99) || b.diem - a.diem);
  const daCo = new Set<string>(), top: GoiYXep[] = [];
  for (const g of ketQua) {
    const k = `${g.mau.map((m) => m.join('×')).join('+')}|${g.soTangDH}|${g.soCan}`;
    if (daCo.has(k)) continue;
    daCo.add(k);
    top.push(g);
    if (top.length >= (v.soGoiY ?? 5)) break;
  }
  return top;
}

/** Chạy đồng bộ (test, máy chủ). */
export function goiYXepToa(v: DauVaoXep): GoiYXep[] {
  const g = sinhGoiY(v);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}

/** Thư gửi worker gợi ý (tinh/goiYXep.worker.ts): `tv` chỉ gửi khi worker chưa có đúng thư viện này. */
export type ThuGoiY = { id: number; v: Omit<DauVaoXep, 'tv'>; tv?: ThuVien };
export type ThuGoiYVe = { id: number; xong?: number; tong?: number; ds?: GoiYXep[]; loi?: string };

let workerGoiY: Worker | null = null, tvCuaWorker: ThuVien | null = null, soIdGoiY = 0;
let huyLuotGoiY: (() => void) | null = null;
const taoWorkerGoiY = (): Worker | null => {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./goiYXep.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
};

/**
 * Chạy trên trình duyệt. Có Worker: chạy hẳn trong worker (lô lớn như CT-2 36 000 m² mỗi mẫu tốn hàng trăm ms – vài giây,
 * nhả luồng giữa các mẫu vẫn đứng giao diện); `huy()` được hỏi mỗi lần nhận tiến độ và mỗi 100 ms — true thì terminate worker, trả null.
 * Không có Worker (vitest / node): chạy trên luồng chính, nhả luồng sau mỗi mẫu như cũ.
 */
export async function goiYXepToaNen(v: DauVaoXep, tienDo?: (xong: number, tong: number) => void, huy?: () => boolean): Promise<GoiYXep[] | null> {
  huyLuotGoiY?.(); // lượt cũ còn chạy: giết worker, lượt cũ trả null — chỉ giữ lượt mới nhất
  if (!workerGoiY) { workerGoiY = taoWorkerGoiY(); tvCuaWorker = null; }
  const w = workerGoiY;
  if (w) {
    const id = ++soIdGoiY;
    const { tv, ...con } = v;
    const thu: ThuGoiY = { id, v: con };
    if (tvCuaWorker !== tv) { thu.tv = tv; tvCuaWorker = tv; }
    return new Promise((xong, hong) => {
      const ket = (giet: boolean) => {
        clearInterval(hoi);
        w.onmessage = null;
        w.onerror = null;
        huyLuotGoiY = null;
        if (giet) { w.terminate(); if (workerGoiY === w) workerGoiY = null; }
      };
      const huyNgay = () => { ket(true); xong(null); };
      huyLuotGoiY = huyNgay;
      const hoi = setInterval(() => { if (huy?.()) huyNgay(); }, 100);
      w.onmessage = (e: MessageEvent<ThuGoiYVe>) => {
        const m = e.data;
        if (m.id !== id) return;
        if (huy?.()) return huyNgay();
        if (m.loi !== undefined) { ket(true); hong(new Error(m.loi.split('\n')[0])); return; }
        if (m.ds) { ket(false); xong(m.ds); return; }
        if (m.xong !== undefined) tienDo?.(m.xong, m.tong ?? 0);
      };
      w.onerror = () => { ket(true); hong(new Error('goiYXep worker')); };
      w.postMessage(thu);
    });
  }
  const g = sinhGoiY(v);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
    tienDo?.(r.value.xong, r.value.tong);
    await new Promise((ok) => setTimeout(ok, 0));
    if (huy?.()) return null;
  }
}
