/**
 * Tự chỉnh mặt bằng tầng — phần mở rộng (đợt 2): PC-11 chuyển thang sang mặt / đoạn khác như datThangBo app cũ, thang theo từng
 * tầng có bố cục riêng, 3D + xuất CAD đi theo mặt bằng đã tự chỉnh. Chạy trên mẫu thật của thư viện (public/lib).
 */
import { describe, expect, it } from 'vitest';
import { layMau } from '../thu/layMau';
import { existsSync, readFileSync } from 'node:fs';
import { tongKhe } from './khe';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { apMatBang, chuKyMatBang, matBangMacDinh, matBangRiengTang, mauHieuDung, tuChinhMatBang, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { chuanHoaPA, taoLo, taoPAMoi } from './macDinh';
import { boCucTang, matDaDon, viTriCan, type BoCuc, type NetVe } from './matBang';
import { chieuCaoPCCC, thoatNan, tinhCuaCan, type ToaPCCC } from './pccc';
import { tinhChiTieu } from './chiTieu';
import { themBienThe } from './stretch';
import { boTangRieng, doiCanTheoTang } from './doiCan';
import { ranhTum, sanHanhLangNgoai, type LoiHinh } from '../ve3d/dungToa';
import { danhSachChen, daiHanhLangKeo, taoDxf, taoScr } from '../xuat/xuatCad';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const idLoi = (b: string) => 'loi-' + b.replace(/^x_/, '').replace(/_/g, '-');
const dl: DuLieuMB = { loi: new Map(), cuaCan: {} };
for (const t of toaDs) for (const m of (t as unknown as ToaMB).mat) for (const q of m.phan_tu)
  if (q.loai !== 'can' && !dl.loi.has(q.block) && existsSync(new URL(`loi/${idLoi(q.block)}.json`, lib))) dl.loi.set(q.block, doc<HinhLoiMB>(`loi/${idLoi(q.block)}.json`));
for (const c of canDs) dl.cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);

const mau = (id: string) => tv.toa.get(id) as unknown as ToaMB;
const trong: BoCuc = { canTheo: {} };
const H24 = chieuCaoPCCC(1, 4.5, 24, 3.3); // 81,8 m: ngưỡng cụt 15 / đôi 20 m
const toaThu = (m: ToaMB, them: Partial<ToaDat> = {}): ToaDat =>
  ({ id: 't', loId: 'l', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {}, ...them });
const vuotDoc = (m: ToaMB, mb: ReturnType<typeof matBangMacDinh>, bc: BoCuc) => {
  const hd = apMatBang(m, mb, dl);
  return thoatNan({ ...(hd as unknown as ToaPCCC), mat: matDaDon(hd, bc, tv) }, { cuaCan: dl.cuaCan, chieuCaoPCCC: H24 }).soVuot;
};

describe('PC-11 · chuyển thang sang mặt / đoạn khác (datThangBo app cũ)', () => {
  // trước đợt này: tm-i1 còn 2, xh-z4 còn 1, tm-z3 / tm-l3 / xh-z6 còn 1 căn vượt ở 24 tầng
  it.each([['tm-i1', 2], ['xh-z4', 6], ['tm-z3', 5], ['tm-l3', 1], ['xh-z6', 2]] as const)('%s 24 tầng: căn vượt %i → 0, 2–3 thang, số căn giữ, không khe / đè mới', (id, truoc) => {
    const m = mau(id), r = tuChinhMatBang(m, tv, dl, { bc: trong, chieuCaoPCCC: H24 });
    expect(r.baoCao.vuotTruoc).toBe(truoc);
    expect(r.baoCao.vuotSau).toBe(0);
    expect(vuotDoc(m, r.matBang, trong)).toBe(0); // đo lại độc lập
    expect(r.matBang.thangBo.length).toBeGreaterThanOrEqual(2);
    expect(r.matBang.thangBo.length).toBeLessThanOrEqual(3);
    const hd = apMatBang(m, r.matBang, dl), goc = apMatBang(m, matBangMacDinh(m, dl), dl);
    expect(tongKhe(hd, tv).de).toBeLessThanOrEqual(tongKhe(goc, tv).de);
    expect(tongKhe(hd, tv).mm).toBeLessThanOrEqual(tongKhe(goc, tv).mm + 200);
    expect(viTriCan(hd, tv).length).toBe(viTriCan(m, tv).length);
  });
  it('tm-z1: có thang được chuyển sang đoạn khác (báo "chuyển mặt"), vẫn 0 căn vượt', () => {
    const r = tuChinhMatBang(mau('tm-z1'), tv, dl, { bc: trong, chieuCaoPCCC: H24 });
    const q = r.baoCao.quyTac.find((x) => x.ma === 'PC-11')!;
    expect(q.ghiChu).toMatch(/chuyển mặt [1-9]/);
    expect(r.baoCao.vuotSau).toBe(0);
  });
  it.each(['tm-t2', 'tm-u1'])('%s 24 tầng: app cũ cũng không gỡ được với ≤ 3 thang → mức "vượt" kèm lý do', (id) => {
    const r = tuChinhMatBang(mau(id), tv, dl, { bc: trong, chieuCaoPCCC: H24 });
    const q = r.baoCao.quyTac.find((x) => x.ma === 'PC-11')!;
    expect(r.baoCao.vuotSau).toBeGreaterThan(0);
    expect(r.baoCao.vuotSau).toBeLessThan(r.baoCao.vuotTruoc!);
    expect(q.muc).toBe('vuot');
    expect(q.ghiChu).toMatch(/còn vượt: .*đã đủ 3 thang/);
    expect(q.ghiChu).toMatch(/chủ nhiệm/);
  });
  it('mọi mẫu 24 tầng: không mẫu nào tệ hơn mặt bằng bản vẽ, chạy dưới 1 s / mẫu', () => {
    for (const t of layMau(toaDs, 3)) {
      const m = mau(t.id);
      if (!Array.isArray(m.mat)) continue;
      const t0 = performance.now();
      const r = tuChinhMatBang(m, tv, dl, { bc: trong, chieuCaoPCCC: H24 });
      expect(performance.now() - t0, t.id).toBeLessThan(1000);
      expect(r.baoCao.vuotSau!, t.id).toBeLessThanOrEqual(r.baoCao.vuotTruoc!);
    }
  });
});

/** tm-i1: tầng 5 đổi một căn 1PN (5.800) ở đoạn có đầu tự do sang 2PN (7.500) → dãy dài 1.700 mm ở tầng đó (QT-69). */
function tangRiengThu() {
  const m = mau('tm-i1');
  const vt = viTriCan(m, tv).find((v) => v.matIdx === 0 && v.canGocId === 'tm-1pn-m1' && v.a0 < 30000)!;
  const moi = tv.can.get('tm-2pn-m2')!;
  const toa0 = toaThu(m);
  const toa = doiCanTheoTang(toa0, [5], vt, moi.id, viTriCan(m, tv), false);
  return { m, vt, moi, toa: tuChinhToa(toa, m, tv, dl) };
}

describe('Thang bộ / tự chỉnh theo từng tầng có bố cục riêng', () => {
  it('tầng riêng có mặt bằng tự chỉnh riêng (dãy dài ra theo căn của tầng); tầng chung giữ mặt bằng chung', () => {
    const { m, toa } = tangRiengThu();
    const mb5 = matBangRiengTang(toa, 5);
    expect(mb5).toBeTruthy();
    expect(matBangRiengTang(toa, 6)).toBeNull();
    // QT-69 ở tầng 5: mặt 0 dài thêm đúng 1.700 mm ở đầu tự do (căn 5.800 → 7.500), nét bao tầng khác nét bao chung
    expect(mb5!.baoCao!.quyTac.find((q) => q.ma === 'QT-69')!.muc).toBe('da_sua');
    expect(mb5!.baoCao!.quyTac.find((q) => q.ma === 'QT-69')!.ghiChu).toMatch(/1700 mm/);
    expect(JSON.stringify(mb5!.duongBao)).not.toBe(JSON.stringify(toa.matBang!.duongBao));
    // DTXD báo cáo của tầng = diện tích nét bao của tầng
    const dt = (P: [number, number][]) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    expect(mb5!.baoCao!.dtxdM2).toBeCloseTo(dt(mb5!.duongBao ?? m.duong_bao) / 1e6, 1);
    // thang tầng riêng khác tầng chung → hợp thang, ép liền suốt chiều cao; căn 2PN rộng hơn kẹp giữa hai thang: STRETCH chỉ co
    // được 1.500 / 1.700 mm → khít đoạn kẹp đổi căn 2PN khác trong đoạn sang 1PN (cùng loại không đủ), hết lệch, không đè
    const q11 = mb5!.baoCao!.quyTac.find((q) => q.ma === 'PC-11')!;
    expect(q11.ghiChu).toMatch(/liền suốt chiều cao/);
    expect(q11.ghiChu).not.toMatch(/còn lệch/);
    expect(mb5!.baoCao!.thangLien).toMatchObject({ cheDo: 'hop', soTang: 1, conLech: 0 });
    expect(mb5!.baoCao!.khitKep).toEqual({ doi: [{ khoa: '0:7', tu: 'tm-2pn-m2', den: 'tm-1pn-m1' }], bo: [], conMm: 0 });
    // ghi vào bố cục tầng 5 (tuDong, gỡ được), căn người dùng chọn giữ nguyên
    expect(toa.tuDong).toEqual([{ tang: 5, truong: 'canViTri', khoa: '0:7', moi: 'tm-1pn-m1' }]);
    expect(boCucTang(toa, 5).canViTri?.['0:1']).toBe('tm-2pn-m2');
    // mẫu hiệu dụng theo tầng
    expect(mauHieuDung(toa, m, dl, 5)).not.toBe(mauHieuDung(toa, m, dl, null));
    expect(mauHieuDung(toa, m, dl, 6)).toBe(mauHieuDung(toa, m, dl, null));
  });
  it('thoát nạn kiểm theo đúng bố cục của tầng riêng (báo cáo = đo lại độc lập), không khe / đè', () => {
    const { m, toa } = tangRiengThu();
    const mb5 = matBangRiengTang(toa, 5)!, bc5 = boCucTang(toa, 5);
    expect(mb5.baoCao!.vuotSau).toBe(vuotDoc(m, mb5, bc5));
    expect(mb5.baoCao!.vuotSau).toBe(0);
    const hd = apMatBang(m, mb5, dl);
    // khít đoạn kẹp: tầng riêng và tầng chung đều không khe / đè
    expect(tongKhe(hd, tv, bc5)).toEqual({ mm: 0, de: 0 });
    expect(tongKhe(apMatBang(m, toa.matBang!, dl), tv, boCucTang(toa, null))).toEqual({ mm: 0, de: 0 });
    expect(viTriCan(hd, tv).length).toBe(viTriCan(m, tv).length);
  });
  it('DT sàn tháp cộng nét bao riêng của tầng (1 tầng × phần dài thêm × hệ số phần chung)', () => {
    const { m, toa } = tangRiengThu();
    const pa: TrangThaiPA = { ...taoPAMoi(), lo: [taoLo('l', 'A', 'tm', [[0, 0], [300, 0], [300, 300], [0, 300]])], toa: [toa] };
    const coRieng = tinhChiTieu(pa, tv).theoLo.l.dtSanChiTiet.thap;
    const tr = { ...toa.tangRieng!, 5: { ...toa.tangRieng![5], matBang: undefined } };
    const khongRieng = tinhChiTieu({ ...pa, toa: [{ ...toa, tangRieng: tr }] }, tv).theoLo.l.dtSanChiTiet.thap;
    const dt = (P: [number, number][]) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    const them = (dt(matBangRiengTang(toa, 5)!.duongBao ?? m.duong_bao) - dt(toa.duongBao ?? m.duong_bao)) / 1e6;
    expect(Math.abs(them)).toBeGreaterThan(1);
    expect((coRieng - khongRieng) / pa.heSo.chung).toBeCloseTo(them, 1);
  });
  it('bỏ bố cục riêng của tầng → mặt bằng riêng hết hiệu lực; lưu / chuẩn hoá PA giữ mặt bằng riêng hợp lệ', () => {
    const { m, toa } = tangRiengThu();
    expect(matBangRiengTang(boTangRieng(toa, [5]), 5)).toBeNull();
    const pa: TrangThaiPA = { ...taoPAMoi(), toa: [toa] };
    const ra = chuanHoaPA(JSON.parse(JSON.stringify(pa)) as TrangThaiPA).toa[0];
    expect(matBangRiengTang(ra, 5)?.thangBo.length).toBe(matBangRiengTang(toa, 5)!.thangBo.length);
    const hong = JSON.parse(JSON.stringify(pa)) as TrangThaiPA;
    (hong.toa[0].tangRieng![5] as { matBang: unknown }).matBang = { phienBan: 1, thangBo: 'x' };
    expect(chuanHoaPA(hong).toa[0].tangRieng![5].matBang).toBeUndefined();
    void m;
  });
  it('tuChinhToa vẫn thuần (tòa vào không đổi) khi có tầng riêng; chữ ký mặt bằng đổi theo tầng riêng', () => {
    const m = mau('tm-i1');
    const vt = viTriCan(m, tv).find((v) => v.matIdx === 0 && v.canGocId === 'tm-1pn-m1')!;
    const toa = doiCanTheoTang(toaThu(m), [5], vt, 'tm-2pn-m2', viTriCan(m, tv), false);
    const truoc = JSON.stringify(toa);
    const sau = tuChinhToa(toa, m, tv, dl);
    expect(JSON.stringify(toa)).toBe(truoc);
    expect(chuKyMatBang(sau)).not.toBe(chuKyMatBang({ ...sau, tangRieng: undefined }));
  });
});

describe('3D + xuất CAD theo mặt bằng đã tự chỉnh', () => {
  const loi3d = new Map<string, LoiHinh>([...dl.loi].map(([b, h]) => [idLoi(b), { bao_tuong_mm: h.bao_tuong_mm as LoiHinh['bao_tuong_mm'] }]));
  const tuChinh = (id: string) => { const m = mau(id), toa = tuChinhToa(toaThu(m), m, tv, dl); return { m, toa, hd: mauHieuDung(toa, m, dl) }; };

  it('3D: tum lõi / buồng thang theo ô thang đã dời / thêm, không dựng dải lõi (mốc XC-05)', () => {
    const { m, toa, hd } = tuChinh('tm-z1');
    const tums = ranhTum(hd as never, loi3d, idLoi);
    const soKhoi = hd.mat.flatMap((f) => f.phan_tu.filter((q) => q.loai !== 'can' && !q.bang && loi3d.get(idLoi(q.block))?.bao_tuong_mm)).length;
    expect(tums.length).toBe(soKhoi);
    expect(hd.mat.some((f) => f.phan_tu.some((q) => q.bang))).toBe(true); // mẫu hiệu dụng có dải lõi, 3D bỏ qua
    // mỗi ô thang của mặt bằng tự chỉnh có một tum chứa tâm ô
    for (const t of toa.matBang!.thangBo) {
      const f = m.mat[t.matIdx], r = (f.goc_deg * Math.PI) / 180, u = [Math.cos(r), Math.sin(r)], n = [-u[1], u[0]];
      const a = t.a0 + t.rong / 2, b = 3000;
      const p: [number, number] = [u[0] * a + n[0] * (f.truc_mm + b), u[1] * a + n[1] * (f.truc_mm + b)];
      const trong1 = (P: [number, number][]) => { const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]); return p[0] > Math.min(...xs) && p[0] < Math.max(...xs) && p[1] > Math.min(...ys) && p[1] < Math.max(...ys); };
      expect(tums.some(trong1), `${t.khoa}`).toBe(true);
    }
  });
  it('3D: sàn hành lang ngoài nét bao chỉ đổ khi trục kéo dài ra ngoài (mẫu chưa sửa: không có)', () => {
    expect(sanHanhLangNgoai(mau('tm-u4') as never)).toEqual([]);
    for (const id of ['tm-z1', 'tm-i1', 'xh-z4']) for (const d of sanHanhLangNgoai(tuChinh(id).hd as never)) expect(d.length).toBe(4);
  });

  const hinh = new Map<string, NetVe[]>();
  for (const c of canDs) hinh.set(c.id, doc<{ ve: NetVe[] }>(`can/${c.id}.json`).ve);
  const duXuat = (hd: ToaMB, bc: BoCuc = trong) => ({ mau: hd as never, toa: bc, tv, ten: 'thu', goc: './xref', hinh, loi: new Map([...dl.loi].map(([b, h]) => [b, { paths: (h.paths ?? []) as NetVe[] }])) });

  it('CAD mẫu chưa sửa: điểm chèn căn giữ đúng điểm chèn bản vẽ (không đổi so với trước)', () => {
    for (const id of ['tm-u2', 'xh-i1', 'tm-l1']) {
      const m = mau(id), ds = danhSachChen(duXuat(m)).filter((x) => x.loai === 'can');
      const q = m.mat.flatMap((f) => f.phan_tu.filter((x) => x.loai === 'can'));
      for (const x of ds) expect(q.some((y) => Math.hypot(y.x - x.x, y.y - x.y) < 1), `${id} ${x.ten}`).toBe(true);
    }
  });
  it('CAD theo mặt bằng tự chỉnh: thang đúng ô mới, căn dời theo, không chèn dải lõi, nét bao = nét bao tòa', () => {
    const { m, toa, hd } = tuChinh('tm-i1');
    const d = duXuat(hd), ds = danhSachChen(d);
    // lõi chèn đúng một lần mỗi lõi của mẫu (không thêm lượt cho dải lõi)
    const soLoiMau = m.mat.flatMap((f) => f.phan_tu.filter((q) => q.loai === 'loi')).length;
    expect(ds.filter((x) => x.loai === 'loi').length).toBe(soLoiMau);
    expect(ds.filter((x) => x.loai === 'thang_bo').length).toBe(toa.matBang!.thangBo.length);
    // căn bị dời bởi thang (dich ≠ 0): điểm chèn lệch đúng độ dời dọc mặt so với bản vẽ
    const dich = Object.entries(toa.matBang!.dich ?? {}).find(([, v]) => Math.abs(v) > 1);
    expect(dich).toBeTruthy();
    const [khoa, dd] = dich!, [mi, i] = khoa.split(':').map(Number), q = m.mat[mi].phan_tu[i];
    const vt = viTriCan(hd, tv).find((v) => v.khoa === khoa)!;
    const it1 = ds.find((x) => x.loai === 'can' && Math.abs(x.rong - (vt.a1 - vt.a0)) < 1 && Math.hypot(x.x - q.x, x.y - q.y) > 1 && Math.abs(Math.hypot(x.x - q.x, x.y - q.y) - Math.abs(dd)) < 1);
    expect(it1).toBeTruthy();
    // số căn chèn = số căn tầng
    expect(ds.filter((x) => x.loai === 'can').length).toBe(viTriCan(m, tv).length);
    // DXF / SCR vẽ nét bao của tòa (dài ra theo thang thêm ở đầu cánh)
    const dxf = taoDxf(d), scr = taoScr(d);
    const bao = toa.duongBao ?? m.duong_bao;
    expect(dxf).toContain(`10\r\n${(+bao[0][0].toFixed(4))}`);
    expect(scr).toContain(bao.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join('\r\n'));
  });
  it('CAD: hành lang kéo dài (XC-07) xuất thành dải sàn trên lớp MDI-HANHLANG', () => {
    for (const id of ['tm-z1', 'xh-z4', 'tm-i1']) {
      const { hd } = tuChinh(id);
      const keo = daiHanhLangKeo({ mau: hd as never });
      const soDoan = ((hd as unknown as { hanhlang_ve?: unknown[][] }).hanhlang_ve ?? []).filter((pl) => pl.length === 2).length;
      expect(keo.length).toBe(soDoan);
      if (keo.length) expect(taoScr(duXuat(hd))).toMatch(/hanh lang keo dai/);
    }
  });
});
