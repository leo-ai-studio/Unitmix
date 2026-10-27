import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { doiCanTaiViTri } from '../tinh/doiCan';
import { taoThuVien, type CanMau, type Diem, type ToaMau } from '../tinh/kieu';
import { viTriCan, type BoCuc, type ToaCoMat } from '../tinh/matBang';
import { stretchTay, themBienThe } from '../tinh/stretch';
import { dungCan, nhomMoi, taoVatLieu, THAM_SO_MAC, type Khoi3d } from './dungCan';
import { dungToa } from './dungToa';
import { khoi3dBienThe, khoi3dTheoId } from './stretch3d';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const k3 = (id: string) => doc<{ khoi3d: Khoi3d | null }>(`can/${id}.json`).khoi3d!;

const hop = (d: Khoi3d, st = 0) => {
  const M = taoVatLieu(THREE, []), goc = new THREE.Group();
  dungCan(THREE, d, THAM_SO_MAC, M, goc, nhomMoi());
  return new THREE.Box3().setFromObject(goc);
};

describe('3D căn STRETCH (DC-04 · QT-81)', () => {
  it('đỉnh bên phải đường cắt dời st, bên trái đứng yên; bb rộng thêm st', () => {
    const g = tv.can.get('tm-2pn-m2')!, d = k3('tm-2pn-m2'), xc = g.stretch!.x_mm;
    for (const st of [300, -200]) {
      const b = khoi3dBienThe(d, g, st);
      d.walls.forEach((r, i) => r.forEach(([x, y], k) => {
        expect(b.walls[i][k][0]).toBe(x > xc ? x + st : x);
        expect(b.walls[i][k][1]).toBe(y);
      }));
      expect(b.bb[2] - b.bb[0]).toBe(d.bb[2] - d.bb[0] + st);
      expect(b.openings).toHaveLength(d.openings.length);
      expect(b.rails).toHaveLength(d.rails.length);
    }
    expect(khoi3dBienThe(d, g, 0)).toBe(d);
  });
  it('khối dựng ra rộng đúng bằng mẫu gốc + st (theo mm → three m)', () => {
    const g = tv.can.get('tm-2pn-m2')!, d = k3('tm-2pn-m2');
    const w0 = hop(d), w1 = hop(khoi3dBienThe(d, g, 300)), w2 = hop(khoi3dBienThe(d, g, -300));
    expect(w1.max.x - w1.min.x).toBeCloseTo(w0.max.x - w0.min.x + 0.3, 2);
    expect(w2.max.x - w2.min.x).toBeCloseTo(w0.max.x - w0.min.x - 0.3, 2);
    expect(w1.min.x).toBeCloseTo(w0.min.x, 3); // bên trái đứng yên
    expect(w1.max.z - w1.min.z).toBeCloseTo(w0.max.z - w0.min.z, 3); // chiều sâu không đổi
  });
  it('khoi3dTheoId: id biến thể kéo theo mẫu gốc, id gốc / mẫu không kéo được trả nguyên', () => {
    const d = k3('tm-2pn-m2');
    expect(khoi3dTheoId('tm-2pn-m2~s+300', d, tv)!.bb[2]).toBe(d.bb[2] + 300);
    expect(khoi3dTheoId('tm-2pn-m2', d, tv)).toBe(d);
    expect(khoi3dTheoId('tm-2pn-m2~s+300', null, tv)).toBeNull();
    expect(khoi3dTheoId('tm-2pn-m2~s+300', d, null)).toBe(d);
  });
  it('dựng tòa: căn đã kéo dùng khối kéo (hộp bao tầng khác khối mẫu gốc đặt vào cùng chỗ), không lỗi', () => {
    const mau = toaDs.map((t) => tv.toa.get(t.id) as ToaCoMat & { duong_bao: Diem[] }).find((m) => Array.isArray(m.mat) && viTriCan(m, tv).some((vt) => stretchTay(m, { canTheo: {} }, tv, vt.khoa, 100).ok))!;
    const vts = viTriCan(mau, tv), vt = vts.find((v) => stretchTay(mau, { canTheo: {} }, tv, v.khoa, 100).ok)!;
    const r = stretchTay(mau, { canTheo: {} }, tv, vt.khoa, 100);
    if (!r.ok) throw new Error();
    const bc = r.doi.reduce((a, [kh, id]) => doiCanTaiViTri(a as never, vts.find((v) => v.khoa === kh)!, id, vts, false) as BoCuc, { canTheo: {} } as BoCuc);
    const ids = [...new Set(vts.map((v) => bc.canViTri?.[v.khoa] ?? v.canGocId))];
    const lay = (kieuKeo: boolean) => {
      const khoi3d = new Map<string, Khoi3d | null>();
      for (const id of ids) {
        const goc = id.replace(/~s[+-]\d+$/, '');
        const j = doc<{ khoi3d: Khoi3d | null }>(`can/${goc}.json`).khoi3d;
        khoi3d.set(id, kieuKeo ? khoi3dTheoId(id, j, tv) : j);
      }
      const M = taoVatLieu(THREE, []), G = nhomMoi(), goc = new THREE.Group();
      dungToa(THREE, goc, M, G, THAM_SO_MAC, { mau, toa: { ...bc, soTangDe: 0, soTangDH: 1 }, tv, khoi3d, loi: new Map(), idLoi: (b) => b });
      let n = 0, sx = 0;
      goc.traverse((o) => {
        const p = (o as THREE.Mesh).geometry?.getAttribute?.('position');
        if (!p) return;
        o.updateWorldMatrix(true, false);
        const v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); sx += v.x; n++; }
      });
      return { n, sx, hop: new THREE.Box3().setFromObject(goc) };
    };
    const keo = lay(true), nguyenMau = lay(false);
    expect(keo.hop.isEmpty()).toBe(false);
    expect(keo.n).toBe(nguyenMau.n); // cùng số đỉnh: chỉ vị trí đỉnh đổi
    // căn rộng thêm 100 mm, căn bù hẹp 100 mm: hình học tầng khác khi dùng khối kéo, không dùng nguyên khối mẫu gốc
    expect(keo.sx).not.toBeCloseTo(nguyenMau.sx, 3);
  });
});
