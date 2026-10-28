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
  canTaiDiem, chonSauBamToa, chonTiaToa, dangChon, doiTuongDangChonToa, hinhNhanToa, khoaDoiTuong, tangTaiCao, tiaVaoLangTru, trongDaGiac,
  type BanDoChonToa, type CanChon,
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
    expect(chonTiaToa(bd, ...tuNam(5, 4))).toBeNull(); // trúng khối đế
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
    expect(chonSauBamToa(c5)).toEqual({ canKhoa: '0:1', tang: 5 });
    expect(chonSauBamToa({ loai: 'tang', id: 't3', tang: 3 })).toEqual({ canKhoa: null, tang: 3 });
    expect(chonSauBamToa(null)).toEqual({ canKhoa: null, tang: null });
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
    expect(trung).toBeGreaterThanOrEqual(ds.length - 2); // căn góc lõm có thể bị căn bên cạnh che
  });
});
