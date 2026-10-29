/**
 * Phân tích PCCC một mặt bằng tầng đang xem (hàm thuần, nhớ kết quả): gom các lớp của màn Tầng — thoát nạn (cảnh báo), thang máy
 * + thang máy chữa cháy (bán kính 60 / 45 m), họng chờ 45 m (QCVN 04 2.5.3), tủ họng nước (QT-77), cửa ngăn cháy, chia khoang
 * hành lang. Đọc đúng mặt bằng KPI dùng (`mauCuaToa` hiệu dụng + `matDaDon`) nên cập nhật sau mỗi lần sửa.
 *
 * Căn cứ từng phần ghi ở chỗ tính; trích dẫn đầy đủ ở docs/pccc_tang.md.
 */
import type { Diem, ThuVien } from './kieu';
import { canDangDung, congNangTai, matDaDon, viTriCan, type BoCuc } from './matBang';
import { cuaTrenMat, dungDoThi, gioiHanThoatNan, thoatNan, tuPCCC, TIM_CUA_THANG_MM, BAN_KINH_TU_MM, type KetQuaTu, type MatToa, type ToaPCCC } from './pccc';
import { KHONG_KIEM_TN, type DuLieuMB, type ToaMB } from './loiThang';
import { cuaBienThe } from './toiUu';
import { banKinhTMCC, canTMCC, chonThangChuaChay, giengThangMay, kiemThangMay, type GiengThang, type KiemThangMay, type LoiGieng } from './thangMay';
import { chiaHanhLang, doKhoang, gioiHanKhoangHL, type CuaHL } from './chiaHanhLang';

export type LoaiCuaNC = 'thang' | 'can' | 'tmcc' | 'rac' | 'hanhLang';
/** Cửa ngăn cháy cần đánh dấu: vị trí (mm), hướng mặt / hành lang, loại, nhãn giới hạn chịu lửa, căn cứ. */
export type CuaNganChay = { p: Diem; huong: Diem; loai: LoaiCuaNC; ei: string; canCu: string };
export type MucPC = 'ok' | 'canh_bao' | 'vuot' | 'khong_ap';
export type CanhBaoPC = { id: string; muc: MucPC; khoa: string; so?: Record<string, string | number> };

export type DauVaoPCCCTang = {
  mau: ToaMB;
  bc: BoCuc;
  tv: ThuVien;
  dl: DuLieuMB | null;
  /** chiều cao PCCC (m) */
  H: number;
  /** số tầng căn hộ (Bảng 11) và tổng số tầng nổi (QCVN 04 2.4.1) */
  soTangDH: number;
  soTangNoi: number;
  /** cả tòa: số căn, dân (null = chưa tính) — QCVN 04 2.4.2 */
  soCanToa: number;
  danToa: number | null;
  /** vị trí tủ họng nước đặt tay (mm); null = tự đặt */
  tuTay?: Diem[] | null;
  hanhLangMm?: number;
};

export type KetQuaPCCCTang = {
  H: number;
  thoatNan: {
    can: { so: number; khoa: string; p: Diem; cuLy: number | null; cut: boolean; nguong: number; vuot: boolean }[];
    cut: number; doi: number; canCu: string; soVuot: number; maxTravel: number;
  };
  thangBo: { p: Diem; huong: Diem; loai: 'N2' | 'N3' | '' }[];
  thangMay: KiemThangMay & { gieng: GiengThang[] };
  tmcc: { batBuoc: boolean; r: number; canCu: string; chon: GiengThang[]; ngoai: Diem[]; xaNhat: number | null; muc: MucPC };
  hongCho: { apDung: boolean; nguong: number; xaNhat: number | null; vuot: number[]; nguon: Diem[]; muc: MucPC };
  tu: KetQuaTu & { r: number; muc: MucPC };
  hanhLang: { gioiHan: number; canCu: string; cua: CuaHL[]; khoang: number[]; tong: number; muc: MucPC; hutKhoi: boolean };
  cuaNC: CuaNganChay[];
  /** điểm phải phủ (góc trong căn + cửa căn) — dùng cho lớp bán kính */
  diemPhu: Diem[];
  canhBao: CanhBaoPC[];
};

const rad = (d: number) => (d * Math.PI) / 180;
const kc = (a: Diem, b: Diem) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Cửa buồng thang trên mặt (như cuaTrenMat của pccc.ts) kèm loại N2 / N3 theo tên khối (QT-63). */
function cuaThang(mat: MatToa[]) {
  const kq: { p: Diem; huong: Diem; loai: 'N2' | 'N3' | '' }[] = [];
  for (const m of mat) {
    const r = rad(m.goc_deg), u: Diem = [Math.cos(r), Math.sin(r)], n: Diem = [-u[1], u[0]];
    for (const q of m.phan_tu) {
      if (q.loai !== 'thang_bo') continue;
      const a = q.x * u[0] + q.y * u[1] + (q.sx < 0 ? -1 : 1) * TIM_CUA_THANG_MM;
      const p: Diem = [u[0] * a + n[0] * m.truc_mm, u[1] * a + n[1] * m.truc_mm];
      if (kq.some((t) => kc(t.p, p) < 1000)) continue;
      kq.push({ p, huong: u, loai: q.block === 'x_tb_n2' ? 'N2' : q.block === 'x_tb_n3' ? 'N3' : '' });
    }
  }
  return kq;
}

/** Phòng rác trong lõi (tên "P.RÁC" trong loi/*.json `phong`) — vị trí tâm nhãn phòng, mm thế giới. */
function phongRac(mat: MatToa[], loi: (b: string) => (LoiGieng & { phong?: { ten: string; x: number; y: number }[] }) | undefined) {
  const kq: Diem[] = [];
  for (const m of mat) for (const q of m.phan_tu) {
    if (q.loai === 'can' || q.loai === 'thang_bo' || q.bang) continue;
    const c = Math.cos(rad(q.rot)), s = Math.sin(rad(q.rot));
    for (const ph of loi(q.block)?.phong ?? []) {
      if (!/R[ÁA]C/i.test(ph.ten)) continue;
      const X = ph.x * q.sx, Y = ph.y * q.sy, p: Diem = [q.x + X * c - Y * s, q.y + X * s + Y * c];
      if (!kq.some((x) => kc(x, p) < 500)) kq.push(p);
    }
  }
  return kq;
}

function phanTich0(v: DauVaoPCCCTang): KetQuaPCCCTang {
  const { mau, bc, tv, dl, H } = v;
  const mat = matDaDon(mau, bc, tv);
  // ô không có người ở thường xuyên không đo cự ly / không phải phủ (như loiThang danhGia)
  const khoaCan: string[] = [];
  const matTN: MatToa[] = mat.map((m) => ({ ...m, phan_tu: m.phan_tu.filter((q) => {
    if (q.loai !== 'can') return true;
    if (KHONG_KIEM_TN.has(congNangTai(q.khoa ?? '', bc))) return false;
    khoaCan.push(q.khoa ?? '');
    return true;
  }) }));
  const cuaCan: Record<string, number> = {};
  if (dl) for (const vt of viTriCan(mau, tv, bc)) {
    const c = tv.can.get(canDangDung(vt, bc)), x = c && cuaBienThe(c, dl.cuaCan, tv);
    if (c && x !== undefined) cuaCan[c.ma_goc] = x;
  }
  const toa: ToaPCCC = { ...(mau as unknown as ToaPCCC), mat: matTN, truc: mau.truc ?? [], hanhlang_ve: mau.hanhlang_ve ?? [] };
  const hlMm = v.hanhLangMm ?? toa.hanh_lang_mm ?? 1800;
  toa.hanh_lang_mm = hlMm;
  const G = dungDoThi(toa);
  const { can } = cuaTrenMat(toa, cuaCan);
  const canhBao: CanhBaoPC[] = [];

  // ---- thoát nạn (QCVN 06 Bảng G.1 / A.2.19 — chỉ cảnh báo trên mặt bằng) ----
  const tn = thoatNan(toa, { cuaCan, chieuCaoPCCC: H });
  const gh = gioiHanThoatNan(H);
  const tnCan = tn.can.map((c, i) => ({ ...c, khoa: khoaCan[i] ?? '', p: can[i]?.p ?? [0, 0] as Diem }));
  if (tn.soVuot) canhBao.push({ id: 'thoat_nan', muc: 'canh_bao', khoa: 'pc.cb.thoatNan', so: { n: tn.soVuot, c: gh.cut, d: gh.doi } });

  // ---- thang bộ ----
  const thangBo = cuaThang(matTN);

  // ---- thang máy (QCVN 04 2.4.1 · 2.4.2) ----
  const layLoi = (b: string) => dl?.loi.get(b) as (LoiGieng & { phong?: { ten: string; x: number; y: number }[] }) | undefined;
  const gm = giengThangMay(mat, layLoi);
  const km = kiemThangMay(gm.so, v.soTangNoi, v.soCanToa, v.danToa, gm.thieuHinh);
  if (km.muc !== 'ok') canhBao.push({ id: 'so_thang_may', muc: 'vuot', khoa: 'pc.cb.thangMay', so: { co: km.co, can: km.can } });

  // ---- điểm phải phủ: cửa căn + 4 góc trong căn (tccDiemCan) ----
  const diemPhu: Diem[] = [];
  for (const c of can) { diemPhu.push(c.p); diemPhu.push(...c.goc); }

  // ---- thang máy chữa cháy (QCVN 06 6.13 / A.2.12; QCVN 04 2.4.3) ----
  const bk = banKinhTMCC(H), batBuoc = canTMCC(H);
  const n3 = thangBo.filter((t) => t.loai === 'N3').map((t) => t.p);
  const chonTM = gm.gieng.length ? chonThangChuaChay(gm.gieng.map((g) => g.p), diemPhu, bk.r * 1000, n3, 1) : null;
  const chon = chonTM ? chonTM.chon.map((i) => gm.gieng[i]) : [];
  const ngoai = chonTM ? chonTM.ngoai.map((i) => diemPhu[i]) : [];
  const tmMuc: MucPC = !batBuoc ? 'khong_ap' : !chon.length ? (gm.thieuHinh ? 'canh_bao' : 'vuot') : ngoai.length ? 'vuot' : 'ok';
  if (tmMuc === 'vuot' || tmMuc === 'canh_bao') canhBao.push({ id: 'tmcc', muc: tmMuc, khoa: chon.length ? 'pc.cb.tmccBanKinh' : 'pc.cb.tmccThieu', so: { r: bk.r, n: ngoai.length } });

  // ---- họng chờ DN65 trong khoang đệm: QCVN 04 2.5.3 — H > 50 m, cửa căn xa nhất ≤ 45 m theo đường đi ----
  const hcAp = H > 50;
  const nguonHC: Diem[] = [...n3, ...chon.map((g) => g.p)];
  let hcXa: number | null = null;
  const hcVuot: number[] = [];
  if (hcAp && nguonHC.length) {
    const B = nguonHC.map((p) => G.chieu(p)).filter((x): x is NonNullable<typeof x> => !!x);
    for (const c of can) {
      const A = G.chieu(c.p, c.huong);
      if (!A || !B.length) continue;
      let d = Infinity;
      for (const b of B) { const r = G.doKC(A, b); d = Math.min(d, r.i, r.j); }
      if (!isFinite(d)) continue;
      hcXa = Math.max(hcXa ?? 0, d / 1000);
      if (d > 45000) hcVuot.push(c.so);
    }
  }
  const hcMuc: MucPC = !hcAp ? 'khong_ap' : !nguonHC.length ? 'canh_bao' : hcVuot.length ? 'vuot' : 'ok';
  if (hcMuc === 'vuot' || hcMuc === 'canh_bao') canhBao.push({ id: 'hong_cho', muc: hcMuc, khoa: 'pc.cb.hongCho', so: { n: hcVuot.length, d: hcXa === null ? '—' : r1(hcXa) } });

  // ---- tủ họng nước (QT-77, R 18 m đo thẳng — chủ nhiệm chốt 20/10/2026) ----
  const tu = tuPCCC(toa, { cuaCan, chieuCaoPCCC: H, soTang: v.soTangDH, viTriTu: v.tuTay?.length ? v.tuTay : undefined });
  const tuMuc: MucPC = !tu.viTri.length || tu.thieu.length ? 'vuot' : 'ok';
  if (tuMuc !== 'ok') canhBao.push({ id: 'tu_pccc', muc: 'vuot', khoa: 'pc.cb.tu', so: { n: tu.thieu.length } });

  // ---- chia khoang hành lang (3.3.5 / A.2.14) ----
  const ghHL = gioiHanKhoangHL(H);
  const tranh = [...can.map((c) => c.p), ...thangBo.map((t) => t.p), ...tu.viTri];
  const cuaHL = chiaHanhLang(G.canh, G.nut.length, ghHL.m * 1000, tranh);
  const khoang = doKhoang(G.canh, G.nut.length, cuaHL).map((x) => x / 1000);
  const hlMuc: MucPC = khoang.some((x) => x > ghHL.m + 0.01) ? 'vuot' : 'ok';
  if (cuaHL.length) canhBao.push({ id: 'chia_hl', muc: 'canh_bao', khoa: 'pc.cb.chiaHL', so: { n: cuaHL.length, m: ghHL.m } });

  // ---- cửa ngăn cháy ----
  const cuaNC: CuaNganChay[] = [
    ...thangBo.map((t) => ({ p: t.p, huong: t.huong, loai: 'thang' as const, ei: 'EI 60', canCu: H > 75 ? 'QCVN 06 3.2.11 · A.3.1.12' : 'QCVN 06 3.2.11' })),
    ...can.map((c) => ({ p: c.p, huong: c.huong, loai: 'can' as const, ei: 'EI 30', canCu: 'QCVN 06 3.3.5' })),
    ...(batBuoc ? chon.map((g) => ({ p: g.p, huong: [1, 0] as Diem, loai: 'tmcc' as const, ei: 'EI 30', canCu: 'QCVN 06 6.13 · Bảng 3 · Bảng 2' })) : []),
    ...phongRac(mat, layLoi).map((p) => ({ p, huong: [1, 0] as Diem, loai: 'rac' as const, ei: H > 75 ? 'EI 60' : 'NC', canCu: H > 75 ? 'QCVN 06 4.24 · A.2.30.2' : 'QCVN 06 4.24' })),
    ...cuaHL.map((c) => ({ p: c.p, huong: c.huong, loai: 'hanhLang' as const, ei: H > 75 ? 'EI 30' : 'NC', canCu: ghHL.canCu })),
  ];

  return {
    H,
    thoatNan: { can: tnCan, cut: gh.cut, doi: gh.doi, canCu: gh.canCu, soVuot: tn.soVuot, maxTravel: tn.maxTravel },
    thangBo,
    thangMay: { ...km, gieng: gm.gieng },
    tmcc: { batBuoc, r: bk.r, canCu: bk.canCu, chon, ngoai, xaNhat: chonTM && chon.length ? chonTM.xaNhat / 1000 : null, muc: tmMuc },
    hongCho: { apDung: hcAp, nguong: 45, xaNhat: hcXa, vuot: hcVuot, nguon: nguonHC, muc: hcMuc },
    tu: { ...tu, r: BAN_KINH_TU_MM / 1000, muc: tuMuc },
    hanhLang: { gioiHan: ghHL.m, canCu: ghHL.canCu, cua: cuaHL, khoang, tong: G.daiTong / 1000, muc: hlMuc, hutKhoi: H > 28 },
    cuaNC,
    diemPhu,
    canhBao,
  };
}

// ---------- nhớ kết quả: mặt bằng hiệu dụng giữ nguyên đối tượng khi PA không đổi (apMatBang nhớ theo mặt bằng) ----------
const nho = new WeakMap<object, Map<string, KetQuaPCCCTang>>();
const maDl = new WeakMap<object, number>();
let demDl = 0;

export function phanTichPCCCTang(v: DauVaoPCCCTang): KetQuaPCCCTang {
  const dlId = v.dl ? (maDl.get(v.dl) ?? (maDl.set(v.dl, ++demDl), demDl)) : 0;
  const khoa = JSON.stringify([v.bc.canTheo, v.bc.canViTri ?? null, v.bc.congNang ?? null, v.bc.latO ?? null, v.H, v.soTangDH, v.soTangNoi,
    v.soCanToa, v.danToa, v.tuTay ?? null, v.hanhLangMm ?? null, dlId, v.dl?.loi.size ?? 0]);
  let m = nho.get(v.mau);
  if (!m) nho.set(v.mau, (m = new Map()));
  const co = m.get(khoa);
  if (co) return co;
  const kq = phanTich0(v);
  if (m.size > 16) m.delete(m.keys().next().value!);
  m.set(khoa, kq);
  return kq;
}
