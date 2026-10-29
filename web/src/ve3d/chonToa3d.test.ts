/**
 * Chọn căn / tầng trong 3D Công trình (chon3d.ts · chonTiaToa): dò tia thuần trên bản đồ chọn, đối chiếu với dựng tòa thật (dungToa)
 * và khoá ô / số CH-xx của màn Tầng (soLieuTang trong ve/MatBangTang.tsx dùng cùng viTriCan + soCanChuVi).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { taoThuVien, type CanMau, type Diem, type ToaMau } from '../tinh/kieu';
import { canDangDung, soCanChuVi, viTriCan, type ToaCoMat } from '../tinh/matBang';
import { themBienThe } from '../tinh/stretch';
import {
  canTaiDiem, chonSauBam, chonSauBamToa, chonTiaToa, dangChon, DE_TOA, doiTuongDangChonToa, doiTuongTrung, hinhCan, hinhNhanToa, khoaDoiTuong,
  tangTaiCao, tiaVaoLangTru, toaGanDiem, trongDaGiac, trungRo, type BanDoChonToa, type CanChon, type DoiTuong3D,
} from './chon3d';
import { nhomMoi, taoVatLieu, THAM_SO_MAC, type Khoi3d } from './dungCan';
import { dungToa } from './dungToa';

type V3 = [number, number, number];
const vuong = (x0: number, y0: number, x1: number, y1: number): Diem[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Tòa hộp 20 × 10 m, đế 8 m, 10 tầng 3,3 m; hai căn mỗi tầng (trái / phải), tầng 4 riêng chỉ một căn rộng. */
const can2: CanChon[] = [
  { khoa: '0:0', canId: 'A', no: 1, goc: vuong(0, 0, 10000, 10000) },
  { khoa: '0:1', canId: 'B', no: 2, goc: vuong(10000, 0, 20000, 10000) },
];
const can1: CanChon[] = [{ khoa: '0:0', canId: 'C', no: 1, goc: vuong(0, 0, 20000, 10000) }];
const bd: BanDoChonToa = { chan: vuong(0, 0, 20, 10), hDe: 8, caoTang: 3.3, nDH: 10, canTang: (k) => (k === 4 ? can1 : can2), canChung: () => can2 };
/** Tia từ phía Nam (−y bản vẽ = +Z three) nhìn thẳng vào mặt tòa tại (x m, cao y m). */
const tuNam = (x: number, y: number): [V3, V3] => [[x, y, 50], [0, 0, -1]];

describe('chọn căn / tầng trong 3D Công trình', () => {
  it('hình học thuần: điểm trong đa giác, căn tại điểm (dung sai tường ngoài), tầng theo cao độ', () => {
    expect(trongDaGiac([5, 5], vuong(0, 0, 10, 10))).toBe(true);
    expect(trongDaGiac([15, 5], vuong(0, 0, 10, 10))).toBe(false);
    expect(canTaiDiem(can2, [12000, 5000])?.khoa).toBe('0:1');
    expect(canTaiDiem(can2, [5000, -200])?.khoa).toBe('0:0'); // ngoài khung căn 200 mm (mặt tường ngoài): vẫn ra căn
    expect(canTaiDiem(can2, [5000, -2000])).toBeNull();
    expect(tangTaiCao(7.9, 8, 3.3, 10)).toBeNull(); // khối đế
    expect(tangTaiCao(8.1, 8, 3.3, 10)).toBe(1);
    expect(tangTaiCao(8 + 3.3 * 4.5, 8, 3.3, 10)).toBe(5);
    expect(tangTaiCao(8 + 33, 8, 3.3, 10)).toBe(10); // đúng mặt mái: tầng trên cùng
    expect(tangTaiCao(50, 8, 3.3, 10)).toBeNull();
  });
  it('tia vào lăng trụ: mặt bên, nắp trên, trượt ra ngoài', () => {
    const [o, h] = tuNam(5, 20);
    expect(tiaVaoLangTru(o, h, bd.chan, 8, 41)).toBeCloseTo(50, 6); // mặt Nam ở Z = 0 (y = 0)
    expect(tiaVaoLangTru([5, 100, -5], [0, -1, 0], bd.chan, 8, 41)).toBeCloseTo(59, 6); // từ trên xuống: nắp mái y = 41
    expect(tiaVaoLangTru([30, 20, 50], [0, 0, -1], bd.chan, 8, 41)).toBe(Infinity); // đi ngang bên cạnh
  });
  it('bấm mặt tòa: ra căn đúng tầng + ô; tầng riêng theo bố cục của nó; đế, trời, trên mặt cắt không chọn', () => {
    const tang5 = 8 + 3.3 * 4 + 1.5;
    expect(chonTiaToa(bd, ...tuNam(5, tang5))).toEqual({ loai: 'can', id: '0:0', tang: 5, canId: 'A', no: 1 });
    expect(chonTiaToa(bd, ...tuNam(15, tang5))).toEqual({ loai: 'can', id: '0:1', tang: 5, canId: 'B', no: 2 });
    expect(chonTiaToa(bd, ...tuNam(15, 8 + 3.3 * 3 + 1))).toMatchObject({ loai: 'can', tang: 4, canId: 'C' });
    expect(chonTiaToa(bd, ...tuNam(5, 4))).toEqual(DE_TOA); // trúng khối đế: chọn khối đế (trước đây không chọn được)
    expect(chonTiaToa(bd, ...tuNam(5, 60))).toBeNull(); // trời
    expect(chonTiaToa(bd, ...tuNam(5, tang5), 8 + 3.3 * 2)).toBeNull(); // tầng 5 đã bị cắt ngang ẩn đi, phía sau không có gì
    // nhìn từ trên xuống khi cắt ngang giữa tầng 3: mặt cắt lộ mặt bằng tầng 3
    expect(chonTiaToa(bd, [15, 100, -5], [0, -1, 0], 8 + 3.3 * 2.5)).toMatchObject({ loai: 'can', id: '0:1', tang: 3 });
    // trúng chỗ không có căn (tầng không căn): chọn tầng
    const bdTrong: BanDoChonToa = { ...bd, canTang: () => [] };
    expect(chonTiaToa(bdTrong, ...tuNam(5, tang5))).toEqual({ loai: 'tang', id: 't5', tang: 5 });
  });
  it('state chọn ↔ đối tượng, tô nhấn: căn theo tầng, cột căn bố cục chung, tầng', () => {
    const c5 = { loai: 'can', id: '0:1', tang: 5, canId: 'B', no: 2 } as const;
    expect(chonSauBamToa(c5)).toEqual({ canKhoa: '0:1', tang: 5, de: false });
    expect(chonSauBamToa({ loai: 'tang', id: 't3', tang: 3 })).toEqual({ canKhoa: null, tang: 3, de: false });
    expect(chonSauBamToa(null)).toEqual({ canKhoa: null, tang: null, de: false });
    expect(chonSauBamToa(DE_TOA)).toEqual({ canKhoa: null, tang: null, de: true });
    const ch = { toaId: 'x', loId: 'l', tang: 5, canKhoa: '0:1' };
    expect(dangChon(c5, ch)).toBe(true);
    expect(dangChon({ ...c5, tang: 6 }, ch)).toBe(false);
    expect(dangChon({ loai: 'tang', id: 't5', tang: 5 }, ch)).toBe(false); // đang chọn căn: không tô cả tầng
    expect(dangChon({ loai: 'tang', id: 't5', tang: 5 }, { ...ch, canKhoa: null })).toBe(true);
    expect(khoaDoiTuong(c5)).not.toBe(khoaDoiTuong({ ...c5, tang: 6 }));
    expect(doiTuongDangChonToa(bd, ch)).toEqual(c5);
    expect(doiTuongDangChonToa(bd, { ...ch, tang: null })).toMatchObject({ loai: 'can', id: '0:1', tang: null });
    expect(doiTuongDangChonToa(bd, { ...ch, canKhoa: null })).toEqual({ loai: 'tang', id: 't5', tang: 5 });
    expect(doiTuongDangChonToa(bd, { ...ch, canKhoa: 'khong-co' })).toBeNull();
    const h = hinhNhanToa(bd, c5, 3.17)!;
    expect(h.y0).toBeCloseTo(8 + 3.3 * 4, 6);
    expect(h.y1 - h.y0).toBeCloseTo(3.17, 6);
    expect(h.chan[1]).toEqual([20, 0]);
    const cot = hinhNhanToa(bd, { ...c5, tang: null }, 3.17)!;
    expect([cot.y0, cot.y1]).toEqual([8, 8 + 33]);
    const t2 = hinhNhanToa(bd, { loai: 'tang', id: 't2', tang: 2 }, 3.17)!;
    expect(t2.chan).toBe(bd.chan);
    expect(t2.y0).toBeCloseTo(8 + 3.3, 6);
    expect(t2.y1).toBeCloseTo(8 + 6.6, 6);
  });
  it('tòa thật (dungToa): bản đồ chọn cùng khoá ô / CH-xx với màn Tầng, bấm giữa mặt một căn ra đúng căn đó', () => {
    const lib = new URL('../../public/lib/', import.meta.url);
    const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
    const tv = themBienThe(taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json')));
    const mau = tv.toa.get('tm-t2') as ToaCoMat & { duong_bao: Diem[] };
    const vts = viTriCan(mau, tv), khoi3d = new Map<string, Khoi3d | null>();
    for (const vt of vts) if (!khoi3d.has(vt.canGocId)) khoi3d.set(vt.canGocId, doc<{ khoi3d: Khoi3d | null }>(`can/${vt.canGocId}.json`).khoi3d);
    const r = dungToa(THREE, new THREE.Group(), taoVatLieu(THREE, []), nhomMoi(), THAM_SO_MAC, { mau, toa: { canTheo: {}, soTangDe: 2, soTangDH: 24 }, tv, khoi3d, loi: new Map(), idLoi: (b) => b });
    const so = soCanChuVi(mau.duong_bao, vts), ds = r.chon.canTang(7);
    expect(ds.length).toBe(vts.length);
    for (const c of ds) expect(c.no).toBe(so.get(c.khoa));
    expect(ds.map((c) => c.canId)).toEqual(vts.map((v) => canDangDung(v, { canTheo: {} })));
    // mỗi căn: bắn tia từ ngoài thẳng vào giữa cạnh ngoài (goc[2] → goc[3]) ở giữa tầng 7
    const K = 0.001, yGiua = r.chon.hDe + 6.5 * r.chon.caoTang;
    let trung = 0;
    for (const c of ds) {
      const [p, q] = [c.goc[2], c.goc[3]], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      const tx = (c.goc[0][0] + c.goc[1][0]) / 2 - mx, ty = (c.goc[0][1] + c.goc[1][1]) / 2 - my, L = Math.hypot(tx, ty); // hướng vào trong căn
      const o: V3 = [(mx - (tx / L) * 30000) * K, yGiua, -(my - (ty / L) * 30000) * K], h: V3 = [tx / L, 0, -ty / L];
      const d = chonTiaToa(r.chon, o, h);
      if (d?.loai === 'can' && d.id === c.khoa && d.tang === 7) trung++;
    }
    expect(trung).toBe(ds.length);
  });
  it('căn chữ L / góc V dò theo hình thật: phần lõm thuộc căn bên cạnh, không thuộc ô bao của căn L', () => {
    // L: nửa trái cả chiều sâu + góc trên bên phải; B: góc dưới bên phải (nằm gọn trong ô bao của L)
    const L: CanChon = { khoa: '0:0', canId: 'L', no: 1, goc: vuong(0, 0, 20000, 10000), hinh: [[0, 0], [10000, 0], [10000, 5000], [20000, 5000], [20000, 10000], [0, 10000]] };
    const B: CanChon = { khoa: '0:1', canId: 'B', no: 2, goc: vuong(10000, 0, 20000, 5000) };
    const bdL: BanDoChonToa = { ...bd, canTang: () => [L, B], canChung: () => [L, B] };
    const tang5 = 8 + 3.3 * 4 + 1.5;
    expect(hinhCan(L)).toBe(L.hinh);
    expect(hinhCan(B)).toBe(B.goc);
    expect(canTaiDiem([L, B], [15000, 2000])?.canId).toBe('B'); // trước đây ra L (ô bao 20 × 10 m chứa điểm)
    expect(chonTiaToa(bdL, ...tuNam(15, tang5))).toMatchObject({ loai: 'can', canId: 'B' });
    expect(chonTiaToa(bdL, ...tuNam(5, tang5))).toMatchObject({ loai: 'can', canId: 'L' });
    const tuDong = (y: number): [V3, V3] => [[60, tang5, -y], [-1, 0, 0]]; // từ phía Đông nhìn sang Tây
    expect(chonTiaToa(bdL, ...tuDong(7.5))).toMatchObject({ loai: 'can', canId: 'L' });
    expect(chonTiaToa(bdL, ...tuDong(2.5))).toMatchObject({ loai: 'can', canId: 'B' });
    // tô nhấn theo hình thật (6 đỉnh), không theo ô bao
    expect(hinhNhanToa(bdL, { loai: 'can', id: '0:0', tang: 5, canId: 'L', no: 1 }, 3.17)!.chan).toHaveLength(6);
  });
  it('mỗi tầng dò theo nét bao của chính nó: tầng bớt nửa phải thì tia đi qua chỗ trống', () => {
    const bdT: BanDoChonToa = { ...bd, chanTang: (k) => (k === 6 ? vuong(0, 0, 10, 10) : bd.chan) };
    const y6 = 8 + 3.3 * 5 + 1.5, y5 = 8 + 3.3 * 4 + 1.5;
    expect(chonTiaToa(bdT, ...tuNam(15, y6))).toBeNull(); // trước đây ra căn B tầng 6 (theo chân tháp)
    expect(chonTiaToa(bdT, ...tuNam(5, y6))).toMatchObject({ loai: 'can', canId: 'A', tang: 6 });
    expect(chonTiaToa(bdT, ...tuNam(15, y5))).toMatchObject({ loai: 'can', canId: 'B', tang: 5 });
    // nhìn chéo từ trên xuống qua chỗ trống của tầng 6: trúng mặt sàn (nắp trên) tầng 5
    expect(chonTiaToa(bdT, [15, 8 + 3.3 * 5 + 3, -12], [0, -0.5, 1])).toMatchObject({ loai: 'can', canId: 'B', tang: 5 });
    expect(hinhNhanToa(bdT, { loai: 'tang', id: 't6', tang: 6 }, 3.17)!.chan).toEqual(vuong(0, 0, 10, 10));
  });
  it('khối đế chọn được: dò tia, tô nhấn, state chọn', () => {
    const bdD: BanDoChonToa = { ...bd, chanDe: vuong(-5, -5, 25, 15) };
    expect(chonTiaToa(bdD, [-2, 100, 2], [0, -1, 0])).toEqual(DE_TOA); // từ trên xuống phần đế nhô ra ngoài thân tháp
    expect(chonTiaToa(bdD, [5, 100, -5], [0, -1, 0])).toMatchObject({ loai: 'can', tang: 10 }); // trên thân tháp: mái tầng trên cùng
    expect(chonTiaToa(bdD, ...tuNam(5, 4))).toEqual(DE_TOA);
    expect(chonTiaToa(bdD, ...tuNam(-3, 20))).toBeNull(); // ngang thân tháp, bên cạnh: đế ở dưới không chạm
    expect(chonTiaToa(bdD, ...tuNam(5, 1), 2)).toEqual(DE_TOA); // cắt ngang trong khối đế: phần đế dưới mặt cắt vẫn chọn được
    expect(chonTiaToa(bdD, ...tuNam(5, 4), 2)).toBeNull(); // phần đế trên mặt cắt đã ẩn
    expect(chonTiaToa({ ...bdD, hDe: 0 }, ...tuNam(5, 4))).toMatchObject({ loai: 'can', tang: 2 }); // tòa không đế: thân tháp từ cốt 0
    const h = hinhNhanToa(bdD, DE_TOA, 3.17)!;
    expect([h.y0, h.y1]).toEqual([0, 8]);
    expect(h.chan).toBe(bdD.chanDe);
    expect(hinhNhanToa({ ...bd, hDe: 0 }, DE_TOA, 3.17)).toBeNull();
    const c = { toaId: 'x', loId: 'l', tang: null, canKhoa: null, de: true };
    expect(doiTuongDangChonToa(bdD, c)).toEqual(DE_TOA);
    expect(doiTuongDangChonToa({ ...bdD, hDe: 0 }, c)).toBeNull();
    expect(dangChon(DE_TOA, c)).toBe(true);
    expect(dangChon(DE_TOA, { ...c, de: false })).toBe(false);
    expect(dangChon({ loai: 'tang', id: 't5', tang: 5 }, { ...c, tang: 5 })).toBe(false); // đang chọn đế: không tô tầng
    expect(khoaDoiTuong(DE_TOA)).toBe('de:de');
  });
  it('Toàn dự án: bấm khối đế chung hai tòa → tòa gần điểm chạm; tô đế theo tòa đang chọn / rê', () => {
    const t1 = { id: 't1', loId: 'l1', chan: vuong(0, 0, 20, 10) }, t2 = { id: 't2', loId: 'l1', chan: vuong(40, 0, 60, 10) };
    expect(toaGanDiem([t1, t2], [10, 5])?.id).toBe('t1');
    expect(toaGanDiem([t1, t2], [33, 5])?.id).toBe('t2'); // ngoài chân cả hai: tòa gần hơn
    expect(toaGanDiem([], [0, 0])).toBeNull();
    const de: DoiTuong3D = { loai: 'de', id: 'l1', toaIds: ['t1', 't2'] };
    // raycast thật vào khối đế 70 × 20 m cao 8 m, bấm phần đế gần tòa t2
    const g = new THREE.Group(), me = new THREE.Mesh(new THREE.BoxGeometry(70, 8, 20), new THREE.MeshBasicMaterial());
    me.position.set(30, 4, -5); me.userData.chon = de; me.userData.deToa = [t1, t2];
    g.add(me); g.updateMatrixWorld(true);
    const rc = new THREE.Raycaster(new THREE.Vector3(50, 4, 60), new THREE.Vector3(0, 0, -1));
    expect(doiTuongTrung(rc.intersectObjects(g.children, false))).toEqual({ loai: 'toa', id: 't2', loId: 'l1' });
    rc.set(new THREE.Vector3(2, 4, 60), new THREE.Vector3(0, 0, -1));
    expect(doiTuongTrung(rc.intersectObjects(g.children, false))).toEqual({ loai: 'toa', id: 't1', loId: 'l1' });
    expect(doiTuongTrung([{ object: { userData: { chon: de } } }])).toEqual({ loai: 'lo', id: 'l1' }); // không điểm chạm: ra lô
    expect(chonSauBam({ loai: 'de', id: 'l1', toaIds: ['t1'] })).toEqual({ toaId: 't1', loId: 'l1' });
    expect(chonSauBam(de)).toEqual({ toaId: null, loId: 'l1' });
    expect(dangChon(de, { toaId: 't2', loId: 'l1' })).toBe(true);
    expect(dangChon(de, { toaId: 't9', loId: 'l1' })).toBe(false);
    expect(trungRo(de, { loai: 'toa', id: 't1', loId: 'l1' })).toBe(true);
    expect(trungRo(de, { loai: 'toa', id: 't9', loId: 'l1' })).toBe(false);
    expect(trungRo({ loai: 'lo', id: 'l1' }, { loai: 'lo', id: 'l1' })).toBe(true);
    expect(trungRo({ loai: 'lo', id: 'l1' }, null)).toBe(false);
  });
  it('tòa thật có căn góc V (tm-v1…v4, xh-v1): bắn tia vào giữa mọi cạnh ngoài của căn ra đúng căn đó', () => {
    const lib = new URL('../../public/lib/', import.meta.url);
    const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
    const tv = themBienThe(taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json')));
    const K = 0.001;
    let tong = 0, dung = 0, dungCu = 0, canV = 0;
    for (const id of ['tm-v1', 'tm-v2', 'tm-v3', 'tm-v4', 'xh-v1']) {
      const mau = tv.toa.get(id) as ToaCoMat & { duong_bao: Diem[] };
      const vts = viTriCan(mau, tv), khoi3d = new Map<string, Khoi3d | null>();
      for (const vt of vts) if (!khoi3d.has(vt.canGocId)) khoi3d.set(vt.canGocId, doc<{ khoi3d: Khoi3d | null }>(`can/${vt.canGocId}.json`).khoi3d);
      const r = dungToa(THREE, new THREE.Group(), taoVatLieu(THREE, []), nhomMoi(), THAM_SO_MAC, { mau, toa: { canTheo: {}, soTangDe: 2, soTangDH: 12 }, tv, khoi3d, loi: new Map(), idLoi: (b) => b });
      const ds = r.chon.canTang(7), yGiua = r.chon.hDe + 6.5 * r.chon.caoTang;
      canV += ds.filter((c) => c.hinh).length;
      const cu: BanDoChonToa = { ...r.chon, canTang: () => ds.map(({ hinh: _h, ...c }) => c) }; // như trước: ô chữ nhật
      for (const c of ds) {
        const P = hinhCan(c), A = P.reduce((s, p, i) => s + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0), sg = A > 0 ? 1 : -1;
        for (let i = 0; i < P.length; i++) {
          const p = P[i], q = P[(i + 1) % P.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (L < 1500) continue; // cạnh ngắn (vát góc): bỏ
          const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = ((q[1] - p[1]) / L) * sg, ny = (-(q[0] - p[0]) / L) * sg; // pháp tuyến ra ngoài căn
          const o: V3 = [(mx + nx * 30000) * K, yGiua, -(my + ny * 30000) * K], h: V3 = [-nx, 0, ny];
          // chỉ cạnh nằm trên mặt ngoài tòa: tia từ ngoài chạm nét bao tầng ngay ở cạnh này (cạnh chung với căn / lõi bên cạnh thì bỏ)
          const t = tiaVaoLangTru(o, h, r.chon.chanTang!(7), r.chon.hDe, r.chon.hDe + 12 * r.chon.caoTang);
          if (!Number.isFinite(t) || Math.abs(t - 30) > 0.4) continue;
          tong++;
          const d = chonTiaToa(r.chon, o, h), dc = chonTiaToa(cu, o, h);
          if (d?.loai === 'can' && d.id === c.khoa && d.tang === 7) dung++;
          if (dc?.loai === 'can' && dc.id === c.khoa) dungCu++;
        }
      }
    }
    expect(canV).toBeGreaterThan(0);
    expect(tong).toBeGreaterThan(50);
    expect(dung).toBe(tong);
    expect(dungCu).toBeLessThan(tong); // dò theo ô chữ nhật trả nhầm căn bên cạnh (đo 2026-10-29: 10 căn V, 137 cạnh, ô chữ nhật đúng 121)
  });
});
