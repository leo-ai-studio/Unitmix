import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { chanToa, dienTich } from './hinhHoc';
import { tongKhe } from './khe';
import { taoThuVien, type CanMau, type MatBangSua, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import {
  apMatBang, banSaoMatBang, daiLoi, doKhitLoi, hocLogia, matBangMacDinh, O_THANG_MM, sanhCuaToa, soMangHL, trucQuaSanh, tuChinhMatBang, tuChinhToa,
  TUONG_CHUNG_MM, type DuLieuMB, type HinhLoiMB, type ToaMB,
} from './loiThang';
import { chuanHoaPA, taoPAMoi } from './macDinh';
import { canDangDung, doanCan, donKhit, matDaDon, viTriCan, type BoCuc } from './matBang';
import { chieuCaoPCCC, cuaTrenMat, thoatNan, tinhCuaCan, type ToaPCCC } from './pccc';
import { stretchTay, themBienThe } from './stretch';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const idLoi = (b: string) => 'loi-' + b.replace(/^x_/, '').replace(/_/g, '-');
const dl: DuLieuMB = { loi: new Map(), cuaCan: {} };
for (const t of toaDs) for (const m of (t as unknown as ToaMB).mat) for (const q of m.phan_tu)
  if (q.loai !== 'can' && !dl.loi.has(q.block) && existsSync(new URL(`loi/${idLoi(q.block)}.json`, lib))) dl.loi.set(q.block, doc<HinhLoiMB>(`loi/${idLoi(q.block)}.json`));
dl.loi.set('x_tb_n2', doc<HinhLoiMB>('loi/loi-tb-n2.json')); // thang N2 (QT-63) — mẫu chỉ chèn N3
for (const c of canDs) dl.cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);

const mau = (id: string) => tv.toa.get(id) as unknown as ToaMB;
const trong: BoCuc = { canTheo: {} };
const H24 = chieuCaoPCCC(1, 4.5, 24, 3.3); // 81,8 m: ngưỡng cụt 15 / đôi 20 m
const H12 = chieuCaoPCCC(1, 4.5, 12, 3.3); // 42,2 m: ngưỡng cụt 25 / đôi 40 m
const dtDG = (P: [number, number][]) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const MAU_THU = ['tm-i1', 'tm-u2', 'xh-i1'];

describe('XC-03 · ô thang bộ 3.000 mm (QT-10 · QT-60)', () => {
  it.each(MAU_THU)('%s: mọi ô thang ≥ 3.000 mm (hút khe ≤ 600), không căn nào xê dịch, cửa thang đúng điểm chèn CAD', (id) => {
    const m = mau(id), mb = matBangMacDinh(m, dl);
    expect(mb.thangBo.length).toBeGreaterThanOrEqual(2);
    for (const t of mb.thangBo) { expect(t.rong).toBeGreaterThanOrEqual(O_THANG_MM - 20); expect(t.rong).toBeLessThanOrEqual(O_THANG_MM + 40); }
    expect(Object.values(mb.dich ?? {}).every((d) => d === 0)).toBe(true);
    const hd = apMatBang(m, mb, dl);
    const cua = cuaTrenMat(hd as unknown as ToaPCCC).thang.map((x) => x.p);
    for (const p of m.cua_thang ?? []) expect(Math.min(...cua.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])))).toBeLessThan(10); // xh-i1: app cũ ghi cửa lệch 7,7 mm
  });
  it('xh-z5: ô thang bản vẽ chỉ 2.550 mm → nới 3.000, căn phía đầu tự do dồn theo, nét bao + DTXD dài thêm, không đè', () => {
    const m = mau('xh-z5'), mb = matBangMacDinh(m, dl);
    const t = mb.thangBo.find((x) => x.matIdx === 2)!;
    expect(t.rong).toBe(O_THANG_MM);
    const them = dtDG(mb.duongBao!) - dtDG(m.duong_bao);
    expect(them / 1e6).toBeCloseTo((450 * 8500) / 1e6, 0);
    const hd = apMatBang(m, mb, dl);
    expect(tongKhe(hd, tv).de).toBeLessThanOrEqual(tongKhe(m, tv).de);
  });
});

describe('XC-05 · căn khít nét bao lõi MDI-BAO-TM (QT-22b · QT-56)', () => {
  it.each(MAU_THU)('%s: dải lõi có trên mặt, mọi mép căn kề lõi chồng / hở ≤ 200 mm', (id) => {
    const m = mau(id), hd = apMatBang(m, matBangMacDinh(m, dl), dl), dai = daiLoi(m, dl);
    expect(dai.length).toBeGreaterThan(0);
    const k = doKhitLoi(hd, dai);
    expect(k.length).toBeGreaterThan(0);
    for (const x of k) expect(Math.abs(x.chong)).toBeLessThanOrEqual(TUONG_CHUNG_MM);
  });
  it('tm-i1: dồn khít neo về LÕI (dải lõi là mốc), không neo về thang xa hơn như trước', () => {
    const m = mau('tm-i1'), hd = apMatBang(m, matBangMacDinh(m, dl), dl);
    const vts = viTriCan(hd, tv);
    // căn sát lõi phía trái mặt A (đoạn thang TB-1 … lõi): kéo +500 không bù → đầu sát lõi phải đứng yên
    const dai = daiLoi(m, dl).find((d) => d.matIdx === 0)!;
    const sat = vts.filter((v) => v.matIdx === 0 && v.a1 <= dai.t0 + TUONG_CHUNG_MM).sort((a, b) => b.a1 - a.a1)[0];
    const g = tv.can.get(sat.canGocId)!;
    const bien = [...tv.can.values()].find((c) => c.stretchGoc?.id === g.id && c.stretchGoc.st === 500)!;
    const kq = donKhit(hd, vts, { canTheo: {}, canViTri: { [sat.khoa]: bien.id } }, tv);
    const moi = kq.vts.find((v) => v.khoa === sat.khoa)!;
    expect(Math.abs(moi.a1 - sat.a1)).toBeLessThan(1);
    expect(kq.lech[0]).toMatchObject({ matIdx: 0, mm: 500, cuoi: false });
  });
});

describe('XC-06 · sảnh thang máy NOTM 3,0 m · NOXH 2,6 m (QT-72)', () => {
  it('đo sảnh trên nét tường lõi; phân loại ở 2.800 mm khớp loại hình tòa', () => {
    expect(sanhCuaToa(mau('tm-i1'), dl)).toMatchObject([{ rong: 3000, loai: 'tm' }]);
    expect(sanhCuaToa(mau('tm-u2'), dl).map((s) => s.loai)).toEqual(['tm', 'tm']);
    expect(sanhCuaToa(mau('xh-i1'), dl)).toMatchObject([{ rong: 2700, loai: 'xh' }]);
    // tòa NOXH dùng lõi NOTM (x_tmdv_v1) → cảnh báo
    const r = tuChinhMatBang(mau('xh-v1'), tv, dl, { bc: trong, chieuCaoPCCC: H24 });
    expect(r.baoCao.quyTac.find((q) => q.ma === 'XC-06')!.muc).toBe('canh_bao');
  });
  it('tm-z1: nét hành lang nối xuyên lõi lệch tim sảnh 500 mm → dời về tim (≤ 100 mm), đầu trục nối theo', () => {
    const m = mau('tm-z1'), mb = banSaoMatBang(matBangMacDinh(m, dl));
    expect(trucQuaSanh(m, mb, dl).lechMax).toBeLessThanOrEqual(100);
    const noi = mb.hanhLang.find((s) => s.noi)!, u: [number, number] = [1, 0];
    const doi = (p: [number, number]): [number, number] => [p[0] + u[0] * 500, p[1] + u[1] * 500];
    for (const s of mb.hanhLang) for (const k of ['p0', 'p1'] as const) if (s === noi || Math.hypot(s[k][0] - noi.p0[0], s[k][1] - noi.p0[1]) < 400 || Math.hypot(s[k][0] - noi.p1[0], s[k][1] - noi.p1[1]) < 400) s[k] = doi(s[k]);
    const r = trucQuaSanh(m, mb, dl);
    expect(r.sua).toBe(1);
    expect(trucQuaSanh(m, mb, dl).lechMax).toBeLessThanOrEqual(100);
    expect(soMangHL(apMatBang(m, mb, dl))).toBe(1);
  });
});

describe('XC-07 · hành lang liền qua góc, vuông góc (QT-19 · QT-25 · QT-51)', () => {
  it.each([...MAU_THU, 'tm-z1', 'tm-l1'])('%s: sau tự chỉnh một mạng hành lang, mọi căn tới được thang, không đoạn chéo', (id) => {
    const r = tuChinhMatBang(mau(id), tv, dl, { bc: trong, chieuCaoPCCC: H24 });
    expect(soMangHL(apMatBang(mau(id), r.matBang, dl))).toBe(1);
    const q = r.baoCao.quyTac.find((x) => x.ma === 'XC-07')!;
    expect(q.muc).not.toBe('canh_bao');
  });
  it('mẫu không đổi gì (tm-u4, 12 tầng) thì đồ thị hành lang và nét bao giữ đúng bản vẽ', () => {
    const m = mau('tm-u4'), r = tuChinhMatBang(m, tv, dl, { bc: trong, chieuCaoPCCC: H24 });
    expect(r.baoCao.quyTac.find((x) => x.ma === 'XC-07')!.sua).toBe(0);
    expect(r.matBang.duongBao).toBeUndefined();
  });
});

describe('PC-11 · thang bộ tự động (QT-44 · QT-63)', () => {
  it.each([['tm-z1', 6], ['xh-z2', 8], ['tm-l1', 2]] as const)('%s 24 tầng (H 81,8 m): căn vượt cự ly %i → 0, 2–3 thang, không khe / đè mới', (id, truoc) => {
    const m = mau(id), r = tuChinhMatBang(m, tv, dl, { bc: trong, chieuCaoPCCC: H24 });
    expect(r.baoCao.vuotTruoc).toBe(truoc);
    expect(r.baoCao.vuotSau).toBe(0);
    expect(r.matBang.thangBo.length).toBeGreaterThanOrEqual(2);
    expect(r.matBang.thangBo.length).toBeLessThanOrEqual(3);
    const hd = apMatBang(m, r.matBang, dl), goc = apMatBang(m, matBangMacDinh(m, dl), dl);
    expect(tongKhe(hd, tv).de).toBeLessThanOrEqual(tongKhe(goc, tv).de);
    expect(tongKhe(hd, tv).mm).toBeLessThanOrEqual(tongKhe(goc, tv).mm + 200);
    // đo lại độc lập bằng pccc.ts trên mặt đã dồn
    const tn = thoatNan({ ...(hd as unknown as ToaPCCC), mat: matDaDon(hd, trong, tv) }, { cuaCan: dl.cuaCan, chieuCaoPCCC: H24 });
    expect(tn.soVuot).toBe(0);
    // số căn không đổi (thang thêm làm dãy dài ra, không bỏ căn)
    expect(viTriCan(hd, tv).length).toBe(viTriCan(m, tv).length);
  });
  it('tm-u2 12 tầng (H 42,2 m, mọi căn đạt): cắt bớt thang thừa theo thứ tự cố định, giữ ≥ 2, vẫn 0 căn vượt', () => {
    const m = mau('tm-u2'), r = tuChinhMatBang(m, tv, dl, { bc: trong, chieuCaoPCCC: H12 });
    expect(r.baoCao.soThangTruoc).toBe(3);
    expect(r.baoCao.soThangSau).toBeGreaterThanOrEqual(2);
    expect(r.baoCao.vuotSau).toBe(0);
  });
  it('chạy hai lần ra cùng kết quả (tất định)', () => {
    const a = tuChinhMatBang(mau('tm-z1'), tv, dl, { bc: trong, chieuCaoPCCC: H24 });
    const b = tuChinhMatBang(mau('tm-z1'), tv, dl, { bc: trong, chieuCaoPCCC: H24 });
    expect(JSON.stringify(a.matBang)).toBe(JSON.stringify(b.matBang));
  });
});

/**
 * Một căn kéo +100 không có căn bù mà đầu dãy là đầu cánh tự do (QT-69): các căn khác cùng đoạn đổi sang phòng kỹ thuật
 * (không STRETCH được) để không còn căn bù.
 */
function timDaiRa() {
  for (const id of ['tm-i1', 'tm-z1', 'xh-i1', 'tm-u2']) {
    const m = mau(id), hd = apMatBang(m, matBangMacDinh(m, dl), dl), vts = viTriCan(hd, tv);
    for (const dn of doanCan(vts)) for (const i of dn.ds) {
      const vt = vts[i];
      const congNang = Object.fromEntries(dn.ds.filter((j) => j !== i).map((j) => [vts[j].khoa, 'ky_thuat' as const]));
      const bc: BoCuc = { canTheo: {}, congNang };
      const r = stretchTay(hd, bc, tv, vt.khoa, 100);
      if (r.ok && r.daiRa) return { id, m, hd, vt, r, bc };
    }
  }
  throw new Error('không tìm được ca QT-69');
}

describe('QT-69 · STRETCH đầu cánh không có căn bù: dãy dài ra, nét bao + DTXD tòa theo', () => {
  it('stretchTay nhận; tự chỉnh nối nét bao đúng +100 × 8.500 mm; chanToa / DTXD đọc nét bao riêng của tòa', () => {
    const { m, vt, r, bc } = timDaiRa();
    if (!r.ok) throw new Error();
    const toa0: ToaDat = { id: 't1', loId: 'l1', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 12, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {}, congNang: bc.congNang };
    const toa1 = tuChinhToa({ ...toa0, canViTri: { [vt.khoa]: r.doi[0][1] } }, m, tv, dl);
    const q = toa1.matBang!.baoCao!.quyTac.find((x) => x.ma === 'QT-69')!;
    expect(q.muc).toBe('da_sua');
    // so với cùng bố cục chưa kéo (PC-11 có thể đã thêm thang như nhau ở cả hai)
    const toaGoc = tuChinhToa(toa0, m, tv, dl);
    const dtGoc = toaGoc.dtxdM2 ?? m.dtxd_m2;
    // trừ phần hốc logia đổi theo căn kéo (QT-59b: hốc lùi theo tỉ lệ bề ngang căn STRETCH, nét bao khoét theo)
    const dtHoc = (x: ToaDat) => hocLogia(m, x.matBang!, dl, tv, { canTheo: {}, canViTri: x.canViTri, congNang: x.congNang })
      .reduce((a, R) => a + Math.abs(R.reduce((t, p, i) => { const q = R[(i + 1) % R.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2e6, 0);
    const hocMoi = dtHoc(toa1) - dtHoc(toaGoc);
    expect(toa1.dtxdM2! - dtGoc).toBeCloseTo((100 * 8500) / 1e6 - hocMoi, 1);
    expect(dienTich(chanToa(m, toa1)) - dienTich(chanToa(m, toaGoc))).toBeCloseTo(0.85 - hocMoi, 1);
    // không đè sau khi dồn: căn dãy dài ra không chạm mốc
    const hd1 = apMatBang(m, toa1.matBang!, dl);
    expect(donKhit(hd1, viTriCan(hd1, tv), toa1, tv).de).toEqual([]);
  });
  it('kéo +100 rồi −100: về đúng nét bao / DTXD ban đầu (hoàn tác được bằng phép ngược)', () => {
    const { m, vt, r, bc } = timDaiRa();
    if (!r.ok) throw new Error();
    const bc1: BoCuc = { ...bc, canViTri: { [vt.khoa]: r.doi[0][1] } };
    // như trên app: kéo ngược trên mặt bằng ĐÃ tự chỉnh (mép mặt đã dời +100)
    const toa0: ToaDat = { id: 't', loId: 'l', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 12, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, ...bc1 };
    const toa1 = tuChinhToa(toa0, m, tv, dl);
    const hd1 = apMatBang(m, toa1.matBang!, dl);
    const r2 = stretchTay(hd1, bc1, tv, vt.khoa, -100);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const id2 = r2.doi[0][1];
    expect(r2.daiRa).toMatchObject({ mm: -100 });
    expect(canDangDung(vt, { canTheo: {}, canViTri: { [vt.khoa]: id2 } })).toBe(vt.canGocId);
  });
});

describe('PA: lưu / chuẩn hoá / hoàn tác', () => {
  it('tuChinhToa là hàm thuần (tòa vào không đổi — kho.sua giữ bản cũ để hoàn tác)', () => {
    const m = mau('tm-z1');
    const toa: ToaDat = { id: 't', loId: 'l', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} };
    const truoc = JSON.stringify(toa);
    const sau = tuChinhToa(toa, m, tv, dl);
    expect(JSON.stringify(toa)).toBe(truoc);
    expect(sau.matBang?.thangBo.length).toBe(3);
    expect(tuChinhToa({ ...toa, tuChinhMB: false }, m, tv, dl).matBang).toBeUndefined();
  });
  it('chuanHoaPA: PA cũ không có matBang giữ nguyên; matBang hỏng thì bỏ; nét bao riêng hợp lệ giữ', () => {
    const m = mau('tm-z1');
    const toa: ToaDat = { id: 't', loId: 'l', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} };
    const pa: TrangThaiPA = { ...taoPAMoi(), toa: [toa] };
    expect(chuanHoaPA(pa).toa[0].matBang).toBeUndefined();
    const tot = tuChinhToa(toa, m, tv, dl);
    const luu = JSON.parse(JSON.stringify({ ...pa, toa: [tot] })) as TrangThaiPA;
    const ra = chuanHoaPA(luu).toa[0];
    expect(ra.matBang?.thangBo.length).toBe(3);
    expect(ra.duongBao?.length).toBeGreaterThan(3);
    expect(ra.dtxdM2).toBeCloseTo(tot.dtxdM2!, 6);
    const hong = chuanHoaPA({ ...pa, toa: [{ ...toa, matBang: { phienBan: 1, thangBo: 'x' } as unknown as MatBangSua, duongBao: [[1, 2]] as never }] }).toa[0];
    expect(hong.matBang).toBeUndefined();
    expect(hong.duongBao).toBeUndefined();
  });
});
