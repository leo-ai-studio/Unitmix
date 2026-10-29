/**
 * (Thân bài thử phá hoại — tệp test: phaHoai.test.ts hạt gốc, phaHoaiHat*.test.ts hạt 101 / 202 / 303 × 24 bước.)
 * Thử PHÁ HOẠI công cụ tay màn Tầng (như `scripts/thu_pha_hoai.js` + `chay_pha_hoai.js` app cũ MDI_Unitmix_v4): mỗi mẫu tòa chạy một
 * chuỗi thao tác ngẫu nhiên (hạt cố định) — xoá / thêm / đổi chỗ / lật căn, thêm / xoá / dời thang, đổi N2 ↔ N3, dồn khít (chạy lại
 * tự chỉnh), thang về tự động, hoàn tác — rồi sau MỖI bước kiểm bất biến người dùng thấy, so với NỀN của chính tòa đó (lệch sẵn có
 * của bản vẽ không tính):
 *  - 0 đè mới, 0 khe mới (tinh/khe.ts qua doDeKhe; khe ≤ nền + 200 mm — không cộng dồn qua nhiều bước);
 *  - nét bao khớp ô đặc (căn góc V theo hình bao thật `CanMau.khung`): góc mọi ô căn / thang nằm trong nét bao (±700 mm), đỉnh nét
 *    bao cách ô đặc gần nhất ≤ nền + 60 mm,
 *    DTXD = diện tích nét bao;
 *  - 2 ≤ số thang ≤ 3, luôn có N2 + N3;
 *  - số căn báo cáo = số căn trên mặt bằng = số căn đếm cơ cấu (coCau.demCan) / tầng; dồn khít lại không đổi gì (tự chỉnh bất động).
 * Kiểm nhanh (`KIEM_NHANH=1`) chạy 1/4 mẫu (layMau). Số vi phạm phải = 0 với mọi hạt.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { layMau } from '../thu/layMau';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import { mauToa } from './canThem';
import { demCan } from './coCau';
import type { Diem, ToaDat, TrangThaiPA } from './kieu';
import { apMatBang, daGiacCacLoi, dauHanhLangNgoai, demLoaiThang, doDeKhe, matBangCua, matBangMacDinh, THANG_N2, THANG_N3, thangDungLuat, tuChinhToa, type ToaMB } from './loiThang';
import { taoPAMoi } from './macDinh';
import { boCucTang, canDangDung, congNangTai, hinhLogia, khungTaiO, viTriCan } from './matBang';
import { chayPhep, phepTay, type PhepTay } from './tayNen';
import { mauThem, type KetQuaTay } from './thaoTacTay';

const { tv, dl, toaDs } = napThuVien();
const c = { tv, dl };

/** PRNG hạt cố định (mulberry32). */
function rng(hat: number) {
  let a = hat >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hatCua = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

const dtDG = (P: Diem[]) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const trongDG = (p: Diem, P: Diem[]) => {
  let r = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) r = !r;
  }
  return r;
};
const kcDoan = (p: Diem, a: Diem, b: Diem) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const kcBien = (p: Diem, P: Diem[]) => P.reduce((m, a, i) => Math.min(m, kcDoan(p, a, P[(i + 1) % P.length])), Infinity);
/** Khoảng cách điểm tới hình chữ nhật (đa giác lồi 4 đỉnh); trong = 0. */
const kcO = (p: Diem, R: Diem[]) => (trongDG(p, R) ? 0 : kcBien(p, R));

const khoaO = (R: Diem[]) => R.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join(';');
const nhoMau = new Map<ToaMB, Set<string>>();
/** Khoá các ô (căn + thang) của mặt bằng mặc định của mẫu. */
function khoaOMau(mau: ToaMB): Set<string> {
  let k = nhoMau.get(mau);
  if (k) return k;
  const hd = apMatBang(mau, matBangMacDinh(mau, dl), dl), ds: Diem[][] = [];
  const hcn = (mi: number, a0: number, a1: number, sau: number): Diem[] => {
    const m = hd.mat[mi], r = (m.goc_deg * Math.PI) / 180, u: Diem = [Math.cos(r), Math.sin(r)], n: Diem = [-u[1], u[0]];
    const pt = (a: number, b: number): Diem => [u[0] * a + n[0] * (m.truc_mm + b), u[1] * a + n[1] * (m.truc_mm + b)];
    return [pt(a0, 0), pt(a1, 0), pt(a1, sau), pt(a0, sau)];
  };
  for (const v of viTriCan(hd, tv)) {
    const cm = tv.can.get(v.canGocId), sau = cm?.sau_mm ?? v.sau ?? 8500;
    ds.push(khungTaiO(hd, v.matIdx, v.a0, v.a1, sau, v.guong, cm?.khung) ?? hcn(v.matIdx, v.a0, v.a1, sau));
  }
  hd.mat.forEach((m, mi) => m.phan_tu.forEach((q) => { if (q.loai === 'thang_bo') ds.push(hcn(mi, q.a0, q.a1, q.sau_mm ?? 8500)); }));
  k = new Set(ds.map(khoaO));
  nhoMau.set(mau, k);
  return k;
}

/** Đo một trạng thái tòa (bố cục chung). */
function doTrangThai(toa: ToaDat) {
  const mau = mauToa(tv, toa) as ToaMB, mb = matBangCua(toa, mau, dl), bc = boCucTang(toa, null);
  const hd = apMatBang(mau, mb, dl), dk = doDeKhe(mau, mb, dl, tv, bc);
  const o: Diem[][] = [], oThat: Diem[][] = [];
  const hcn = (mi: number, a0: number, a1: number, sau: number): Diem[] => {
    const m = hd.mat[mi], r = (m.goc_deg * Math.PI) / 180, u: Diem = [Math.cos(r), Math.sin(r)], n: Diem = [-u[1], u[0]];
    const pt = (a: number, b: number): Diem => [u[0] * a + n[0] * (m.truc_mm + b), u[1] * a + n[1] * (m.truc_mm + b)];
    return [pt(a0, 0), pt(a1, 0), pt(a1, sau), pt(a0, sau)];
  };
  const vts = viTriCan(hd, tv, bc);
  let soCan = 0;
  for (const v of vts) {
    // căn góc V: hình bao thật (CanMau.khung), không phải ô chữ nhật
    const id = canDangDung(v, bc), cm = tv.can.get(id), sau = cm?.sau_mm ?? v.sau ?? 8500;
    const R = khungTaiO(hd, v.matIdx, v.a0, v.a1, sau, v.guong, cm?.khung) ?? hcn(v.matIdx, v.a0, v.a1, sau);
    o.push(R);
    // góc ô ra ngoài nét bao: căn logia theo hình thật trừ hốc logia (QT-59b — nét bao khoét hốc theo căn); đỉnh nét bao đo tới ô mô-đun
    // (app cũ bienCan) nên đỉnh trong hốc logia vẫn là của căn
    oThat.push(cm?.khung ? R : hinhLogia({ ...v, sau }, hd, cm?.logia_lui) ?? R);
    if (congNangTai(v.khoa, bc) === 'can') soCan++;
  }
  hd.mat.forEach((m, mi) => m.phan_tu.forEach((q) => { if (q.loai === 'thang_bo') { const R = hcn(mi, q.a0, q.a1, q.sau_mm ?? 8500); o.push(R); oThat.push(R); } }));
  const bao = hd.duong_bao;
  // ô y nguyên như mẫu (cùng chỗ, cùng bề ngang): nét bao CAD ôm căn thật (hốc giếng trời giữa hai căn…) — không kiểm góc ô chữ nhật
  const goc = khoaOMau(mau);
  const gocDs = oThat.filter((_, i) => !goc.has(khoaO(o[i]))).flatMap((R) => R.map((p) => ({ p, d: trongDG(p, bao) ? 0 : kcBien(p, bao) }))).sort((a, b) => b.d - a.d);
  const gocNgoai = gocDs[0]?.d ?? 0, gocXa = gocDs[0]?.p.map(Math.round).join(',');
  // ô đặc cho kiểm đỉnh nét bao: căn + thang + dải hành lang (tim ± nửa bề rộng — nét bao ôm hành lang như app cũ duongBao0)
  const hl = (hd.hanh_lang_mm || 1800) / 2;
  const dai = (hd.hanh_lang ?? []).map((s) => {
    const dx = s.p1[0] - s.p0[0], dy = s.p1[1] - s.p0[1], L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * hl, ny = (dx / L) * hl;
    return [[s.p0[0] + nx, s.p0[1] + ny], [s.p1[0] + nx, s.p1[1] + ny], [s.p1[0] - nx, s.p1[1] - ny], [s.p0[0] - nx, s.p0[1] - ny]] as Diem[];
  });
  // + khung tường lõi (nét bao ôm lõi)
  dai.push(...daGiacCacLoi(mau, dl));
  // + chỗ gập hành lang (hai dải chữ nhật gặp nhau theo góc để hở một cái nêm ở mép ngoài chỗ gập — nét bao đi theo mép vát đó)
  for (const s of hd.hanh_lang ?? []) for (const q of [s.p0, s.p1]) dai.push(Array.from({ length: 8 }, (_, k): Diem => [q[0] + hl * 1.1 * Math.cos((k * Math.PI) / 4), q[1] + hl * 1.1 * Math.sin((k * Math.PI) / 4)]));
  // đỉnh nằm trên nét bao CAD gốc của mẫu (sảnh hub tòa Y, góc lõi…) là nét bản vẽ, không phải nét bao dựng theo ô — không xét
  const P0 = mau.duong_bao, trenP0 = (p: Diem) => P0.some((a, i) => kcDoan(p, a, P0[(i + 1) % P0.length]) <= 2);
  const dinhDs = bao.filter((p) => !trenP0(p)).map((p) => ({ p, d: Math.min(...[...o, ...dai].map((R) => (R.length === 4 ? kcO(p, R) : trongDG(p, R) ? 0 : kcBien(p, R)))) })).sort((a, b) => b.d - a.d);
  const dinhXa = dinhDs[0]?.d ?? 0, dinhXaO = dinhDs[0]?.p.map(Math.round).join(',');
  return { mau, mb, hd, de: dk.de, kheMm: dk.mm, soCan, gocNgoai, gocXa, dinhXa, dinhXaO, dtBao: dtDG(bao) / 1e6, dtxd: hd.dtxd_m2, thang: mb.thangBo, vts };
}

type ViPham = { mau: string; buoc: number; op: string; loi: string };

function kiem(id: string, buoc: number, op: string, toa: ToaDat, nen: ReturnType<typeof doTrangThai>, vi: ViPham[]) {
  const s = doTrangThai(toa), them = (loi: string) => vi.push({ mau: id, buoc, op, loi });
  if (s.de > nen.de) them(`đè ${nen.de} → ${s.de}`);
  if (s.kheMm > nen.kheMm + 200) them(`khe ${Math.round(nen.kheMm)} → ${Math.round(s.kheMm)} mm`);
  if (s.gocNgoai > Math.max(700, nen.gocNgoai + 60)) them(`góc ô ra ngoài nét bao ${Math.round(nen.gocNgoai)} → ${Math.round(s.gocNgoai)} mm (${s.gocXa})`);
  if (s.dinhXa > nen.dinhXa + 60) them(`đỉnh nét bao cách ô đặc ${Math.round(nen.dinhXa)} → ${Math.round(s.dinhXa)} mm (${s.dinhXaO})`);
  if (Math.abs(s.dtBao - s.dtxd) > 0.6) them(`DTXD ${s.dtxd} ≠ DT nét bao ${s.dtBao.toFixed(1)}`);
  if (toa.dtxdM2 !== undefined && Math.abs(toa.dtxdM2 - s.dtBao) > 0.6) them(`ToaDat.dtxdM2 ${toa.dtxdM2} ≠ ${s.dtBao.toFixed(1)}`);
  if (!thangDungLuat(s.thang)) them(`thang ${JSON.stringify(demLoaiThang(s.thang))}`);
  const bc = s.mb.baoCao;
  if (bc && bc.soCan !== s.soCan) them(`số căn báo cáo ${bc.soCan} ≠ mặt bằng ${s.soCan}`);
  const pa: TrangThaiPA = { ...taoPAMoi(), toa: [toa] };
  const dem = Object.values(demCan(pa, tv)[toa.id] ?? {}).reduce((a, b) => a + b, 0);
  if (dem !== s.soCan * toa.soTangDH) them(`cơ cấu đếm ${dem} ≠ ${s.soCan} × ${toa.soTangDH}`);
  return s;
}

/**
 * Một phép ngẫu nhiên dạng dữ liệu (tên + đối số) — đúng dạng màn Tầng gửi worker (tinh/tayNen.ts `PhepTay`), nên bài phá hoại chạy
 * qua cùng bảng phép với giao diện; 'donKhit' = chạy lại tự chỉnh. null = không có phép hợp lệ để thử.
 */
export function phepNgauNhien(toa: ToaDat, r: () => number): { op: string; ph: PhepTay | 'donKhit' } | null {
  const s = doTrangThai(toa);
  const can = s.vts.filter((v) => congNangTai(v.khoa, boCucTang(toa, null)) === 'can');
  const chon = <T,>(ds: T[]) => ds[Math.floor(r() * ds.length)];
  const x = r();
  if (!can.length) return null;
  if (x < 0.14) { const v = chon(can); return { op: `xoá ${v.khoa}`, ph: phepTay('xoaCanTay', toa, null, [v.khoa]) }; }
  if (x < 0.26) { const v = chon(can); return { op: `thêm sau ${v.khoa}`, ph: phepTay('themCanTay', toa, null, v, mauThem(tv, canDangDung(v, boCucTang(toa, null))), r() < 0.3) }; }
  if (x < 0.38) { const a = chon(can), b = chon(can); return { op: `đổi chỗ ${a.khoa} ↔ ${b.khoa}`, ph: phepTay('doiChoTay', toa, null, a, b) }; }
  if (x < 0.5) { const ds = [...new Set([chon(can).khoa, ...(r() < 0.4 ? [chon(can).khoa] : [])])]; return { op: `lật ${ds.join(',')}`, ph: phepTay('latTay', toa, null, ds) }; }
  if (x < 0.6) { const v = chon(can); return { op: `thêm thang sau ${v.khoa}`, ph: phepTay('themThangTay', toa, v.matIdx, v.khoa) }; }
  if (x < 0.7) { const t = chon(s.thang); return { op: `xoá thang ${t.khoa}`, ph: phepTay('xoaThangTay', toa, t.khoa) }; }
  if (x < 0.8) { const t = chon(s.thang), v = chon(can); return { op: `dời thang ${t.khoa} → sau ${v.khoa}`, ph: phepTay('doiThangTay', toa, t.khoa, v.matIdx, v.khoa) }; }
  if (x < 0.88) { const t = chon(s.thang); return { op: `đổi loại ${t.khoa}`, ph: phepTay('doiLoaiThangTay', toa, t.khoa, t.block === THANG_N2 ? THANG_N3 : THANG_N2) }; }
  if (x < 0.91) {
    // co kéo đầu hành lang (app cũ p14 axAdj): đầu ngoài ngẫu nhiên, −4 … +6 m
    const ds = (s.hd.hanh_lang ?? []).flatMap((_, i) => dauHanhLangNgoai(s.hd.hanh_lang ?? [], i, s.hd.duong_bao).map((dau) => [i, dau] as const));
    const [i, dau] = ds.length ? chon(ds) : [0, 0 as const];
    const d = Math.round((r() * 10 - 4) * 10) * 100;
    if (ds.length) return { op: `kéo hành lang ${i}:${dau} ${d}`, ph: phepTay('keoHanhLangTay', toa, i, dau, d) };
  }
  if (x < 0.95) return { op: 'dồn khít (tự chỉnh lại)', ph: 'donKhit' };
  return { op: 'thang về tự động', ph: phepTay('thangTuDongLai', toa) };
}

/** Một bước ngẫu nhiên: trả tên phép + kết quả (chạy đồng bộ `chayPhep` — bản chuẩn của đường nền). */
function buocNgauNhien(toa: ToaDat, r: () => number): { op: string; ph: PhepTay | 'donKhit'; kq: KetQuaTay | { ok: true; toa: ToaDat; chan: [] } } | null {
  const p = phepNgauNhien(toa, r);
  if (!p) return null;
  return { op: p.op, ph: p.ph, kq: p.ph === 'donKhit' ? { ok: true, toa: tuChinhToa(toa, mauToa(tv, toa) as ToaMB, tv, dl), chan: [] } : chayPhep(p.ph, c) };
}

/** Tóm tắt trạng thái để dò lỗi (PHA_HOAI_DUMP): nét bao + ô trên từng mặt. */
function tomTat(toa: ToaDat) {
  const s = doTrangThai(toa), bc = boCucTang(toa, null);
  return { bao: s.hd.duong_bao.map((p) => p.map(Math.round)), mep: s.mb.mep, mat: s.hd.mat.map((m, mi) => ({ mi, goc: m.goc_deg, truc: Math.round(m.truc_mm), a: [Math.round(m.a_dau), Math.round(m.a_cuoi)],
    o: [...s.vts.filter((v) => v.matIdx === mi).map((v) => `${v.khoa}:${canDangDung(v, bc)}:${Math.round(v.a0)}..${Math.round(v.a1)}`),
      ...m.phan_tu.filter((q) => q.loai !== 'can').map((q) => `${q.loai}:${q.khoa}:${Math.round(q.a0)}..${Math.round(q.a1)}`)] })) };
}
/**
 * Đăng ký bài phá hoại cho một hạt: mỗi mẫu tòa (kiểm nhanh lấy mẫu 1/4) chạy `soBuoc` bước ngẫu nhiên. Hạt 0 = bài gốc (env
 * `PHA_HOAI_HAT` cộng thêm); các hạt 101 / 202 / 303 × 24 bước nằm ở tệp test riêng để vitest chạy song song.
 */
export { rng, hatCua };
/**
 * `opt.mau` = chỉ các mẫu khớp (vd. /^(tm|xh)-[zvtl]/ — Z, V, T, L); `opt.diVe` = sau mỗi lần đổi chỗ được nhận, đổi NGƯỢC lại hai ô
 * đó: phải nhận và trả đúng mặt bằng trước (mẫu căn từng ô, vị trí căn, thang, nét bao — app cũ "kéo đi kéo về" QT-62).
 */
export function moTaPhaHoai(hatThem: number, soBuoc: number, opt: { mau?: RegExp; diVe?: boolean } = {}) {
const SO_BUOC = Number(process.env.PHA_HOAI_BUOC) || soBuoc;
const HAT = hatThem + (Number(process.env.PHA_HOAI_HAT) || 0);
const dump: { id: string; op: string; loi: string[]; truoc: unknown; sau: unknown; toa: ToaDat }[] = [];
const MAU = layMau(toaDs.filter((t) => Array.isArray((t as unknown as ToaMB).mat) && (!opt.mau || opt.mau.test(t.id))).map((t) => t.id));
const tong = { buoc: 0, nhan: 0, tuChoi: 0, hoanTac: 0, vi: [] as ViPham[], msMax: 0, msOp: '', ms: [] as { mau: string; op: string; ms: number }[] };

describe(`thử phá hoại công cụ tay màn Tầng (thu_pha_hoai.js app cũ) · hạt ${HAT} × ${SO_BUOC} bước`, () => {
  // PHA_HOAI_GHI=<tệp> thì ghi tổng kết (số bước nhận / từ chối / hoàn tác, vi phạm, phép chậm nhất) để so mốc
  afterAll(() => {
    // nhiều tệp hạt chạy song song: hạt thêm thì ghi <tệp>.<hạt>.json
    const ten = (f: string) => (hatThem ? f.replace(/(\.json)?$/, `.${HAT}$1`) : f);
    if (process.env.PHA_HOAI_GHI) writeFileSync(ten(process.env.PHA_HOAI_GHI), JSON.stringify(tong, null, 1));
    if (process.env.PHA_HOAI_DUMP) writeFileSync(ten(process.env.PHA_HOAI_DUMP), JSON.stringify(dump, null, 1));
  });
  it.each(MAU)('%s: chuỗi thao tác ngẫu nhiên, 0 vi phạm bất biến', (id) => {
    const r = rng(hatCua(id) + HAT);
    let toa = tuChinhToa(toaThu(id), tv.toa.get(id) as unknown as ToaMB, tv, dl);
    const nen = kiem(id, 0, 'nền', toa, doTrangThai(toa), tong.vi);
    const lichSu: ToaDat[] = [];
    for (let b = 1; b <= SO_BUOC; b++) {
      tong.buoc++;
      if (lichSu.length && r() < 0.12) {
        const truoc = lichSu.pop()!;
        toa = truoc; tong.hoanTac++;
        kiem(id, b, 'hoàn tác', toa, nen, tong.vi);
        continue;
      }
      const t0 = performance.now();
      const p = buocNgauNhien(toa, r);
      const ms = performance.now() - t0;
      if (p) tong.ms.push({ mau: id, op: p.op.split(' ')[0], ms: Math.round(ms) });
      if (ms > tong.msMax) { tong.msMax = ms; tong.msOp = `${id} ${p?.op}`; }
      if (!p) continue;
      if (!p.kq.ok) { tong.tuChoi++; continue; }
      tong.nhan++;
      const n0 = tong.vi.length, truoc = toa;
      lichSu.push(toa);
      toa = p.kq.toa;
      kiem(id, b, p.op, toa, nen, tong.vi);
      if (tong.vi.length > n0) {
        if (process.env.PHA_HOAI_DUMP && !dump.some((x) => x.id === id)) dump.push({ id, op: p.op, loi: tong.vi.slice(n0).map((v) => v.loi), truoc: tomTat(truoc), sau: tomTat(toa), toa: truoc });
        // vi phạm: trả về trạng thái trước (như người dùng hoàn tác) — đếm số PHÉP vi phạm, không cộng dồn qua các bước sau
        toa = lichSu.pop()!;
        continue;
      }
      // đổi chỗ đi rồi đổi về: phải về đúng mặt bằng trước (app cũ QT-62 "kéo đi kéo về")
      if (opt.diVe && p.ph !== 'donKhit' && p.ph.ten === 'doiChoTay') {
        const [, , a, b2] = p.ph.args;
        const vt = (x: ToaDat, k: string) => doTrangThai(x).vts.find((v) => v.khoa === k)!;
        const ve = chayPhep(phepTay('doiChoTay', toa, null, vt(toa, a.khoa), vt(toa, b2.khoa)), c);
        const anh = (x: ToaDat) => { const s = doTrangThai(x), bc = boCucTang(x, null);
          return JSON.stringify([s.vts.map((v) => `${v.khoa}:${canDangDung(v, bc)}:${Math.round(v.a0)}`).sort(), s.thang.map((t) => `${t.khoa}@${t.matIdx}:${Math.round(t.a0)}`).sort(), Math.round(s.dtBao)]); };
        if (!ve.ok) tong.vi.push({ mau: id, buoc: b, op: p.op, loi: `đổi về bị từ chối (${ve.lyDo})` });
        else if (anh(ve.toa) !== anh(truoc)) tong.vi.push({ mau: id, buoc: b, op: p.op, loi: 'đổi đi rồi đổi về không trả đúng mặt bằng trước' });
        else kiem(id, b, `${p.op} (đổi về)`, ve.toa, nen, tong.vi);
      }
      // dồn khít lại phải bất động (tự chỉnh chạy lại trên kết quả không đổi mặt bằng)
      const lai = tuChinhToa(toa, mauToa(tv, toa) as ToaMB, tv, dl);
      // (so tập thang theo khoá, mặt, điểm chèn làm tròn 2 mm, chiều cửa, loại — thứ tự trong mảng không tính)
      const ky = (x: ToaDat) => matBangCua(x, mauToa(tv, x) as ToaMB, dl).thangBo.map((t) => `${t.khoa}@${t.matIdx}:${Math.round((t.a0 + t.dIns) / 2)}:${t.sx}:${t.block}`).sort().join('|');
      if (ky(lai) !== ky(toa)
        || doTrangThai(lai).soCan !== doTrangThai(toa).soCan) {
        tong.vi.push({ mau: id, buoc: b, op: p.op, loi: 'tự chỉnh lại không bất động (thang / số căn đổi)' });
        if (process.env.PHA_HOAI_DUMP && !dump.some((x) => x.id === id)) dump.push({ id, op: p.op, loi: ['bất động'], truoc: tomTat(truoc), sau: tomTat(toa), toa: truoc });
      }
    }
    const cua = tong.vi.filter((v) => v.mau === id);
    expect(cua.map((v) => `#${v.buoc} ${v.op}: ${v.loi}`), id).toEqual([]);
  }, 120_000);
});
}
