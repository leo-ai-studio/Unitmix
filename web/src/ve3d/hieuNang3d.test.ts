/**
 * Hiệu năng dựng 3D một tòa (P8, docs/de_xuat_hieu_nang.md): đếm draw call (mesh + line + instanced, chưa tính pass bóng),
 * tam giác và thời gian dựng với three thật trên mẫu tòa trong thư viện. In số đo để ghi vào tài liệu; chặn hồi quy draw call.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { taoThuVien, type CanMau, type Diem, type ToaMau } from '../tinh/kieu';
import { viTriCan, type ToaCoMat } from '../tinh/matBang';
import { themBienThe } from '../tinh/stretch';
import { nhomMoi, taoVatLieu, THAM_SO_MAC, type Khoi3d } from './dungCan';
import { dungToa, thongKeNho, xoaNhoHinh3D, type LoiHinh } from './dungToa';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const idLoi = (block: string): string => 'loi-' + block.replace(/^x_/, '').replace(/_/g, '-');

/** Đếm draw call / tam giác như WebGLRenderer (mỗi Mesh / Line / InstancedMesh hiện = 1 lần vẽ). */
export function demVe(goc: THREE.Object3D) {
  let ve = 0, tamGiac = 0, inst = 0, bong = 0;
  goc.updateMatrixWorld(true);
  goc.traverseVisible((o) => {
    const m = o as THREE.Mesh & { isInstancedMesh?: boolean; count?: number; isLine?: boolean };
    if (!m.geometry) return;
    if (m.isMesh || m.isLine) ve++;
    if (m.isInstancedMesh) inst++;
    if (m.isMesh) {
      const g = m.geometry, n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      const tg = n * (m.isInstancedMesh ? m.count ?? 1 : 1);
      tamGiac += tg;
      if (m.castShadow) bong += tg;
    }
  });
  return { ve, tamGiac: Math.round(tamGiac), inst, bong: Math.round(bong) };
}

const napKhoi = new Map<string, Map<string, Khoi3d | null>>();
/** Dựng tòa `id`. `lanh` = lần đầu thật: xoá bộ nhớ hình + khối 3D căn đọc mới; không thì dùng lại khối đã nạp (như khung 3D dựng lại). */
function dung(id: string, soTang: number, lanh = true) {
  const mau = tv.toa.get(id) as ToaCoMat & { duong_bao: Diem[] };
  if (lanh) { xoaNhoHinh3D(); napKhoi.delete(id); }
  const khoi3d = napKhoi.get(id) ?? new Map<string, Khoi3d | null>();
  napKhoi.set(id, khoi3d);
  for (const vt of viTriCan(mau, tv)) if (!khoi3d.has(vt.canGocId)) khoi3d.set(vt.canGocId, doc<{ khoi3d: Khoi3d | null }>(`can/${vt.canGocId}.json`).khoi3d);
  const loi = new Map<string, LoiHinh>();
  for (const m of mau.mat) for (const q of m.phan_tu) if (q.loai !== 'can') {
    const f = new URL(`loi/${idLoi(q.block)}.json`, lib);
    if (existsSync(f)) loi.set(idLoi(q.block), { bao_tuong_mm: (JSON.parse(readFileSync(f, 'utf8')) as LoiHinh).bao_tuong_mm });
  }
  const M = taoVatLieu(THREE, []), goc = new THREE.Group();
  const t0 = performance.now();
  dungToa(THREE, goc, M, nhomMoi(), THAM_SO_MAC, { mau, toa: { canTheo: {}, soTangDe: 2, soTangDH: soTang }, tv, khoi3d, loi, idLoi });
  const ms = performance.now() - t0;
  const gan = demVe(goc);
  // mức xa của LOD: đặt camera xa hơn ngưỡng rồi cập nhật LOD như renderer làm mỗi lượt vẽ
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(5000, 2000, 5000); cam.updateMatrixWorld(true);
  goc.traverse((o) => { if ((o as THREE.LOD).isLOD) (o as THREE.LOD).update(cam); });
  return { ms, ...gan, xa: demVe(goc) };
}

describe('Hiệu năng 3D tòa (P8)', () => {
  it.each(['tm-t2', 'tm-i1'])('%s 24 tầng: dưới 100 draw call, dựng lại không đổi hình < 20 ms', (id) => {
    dung(id, 24); // làm nóng JIT
    const ms: number[] = [], lai: number[] = [];
    let r = dung(id, 24);
    for (let i = 0; i < 3; i++) { r = dung(id, 24); ms.push(r.ms); }
    // dựng lại khi hình không đổi (đổi chọn / giờ / kiểu vẽ / bật hầm ở khung 3D): trúng bộ nhớ hình
    let r2 = r;
    for (let i = 0; i < 5; i++) { r2 = dung(id, 24, false); lai.push(r2.ms); }
    console.log(`[3D] ${id} 24 tầng: gần ${r.ve} draw call (${r.inst} instanced), ${r.tamGiac.toLocaleString('vi')} tam giác (đổ bóng ${r.bong.toLocaleString('vi')}); xa ${r.xa.ve} draw call, ${r.xa.tamGiac.toLocaleString('vi')} tam giác; dựng lần đầu ${ms.map((x) => x.toFixed(0)).join(' / ')} ms; dựng lại ${lai.map((x) => x.toFixed(1)).join(' / ')} ms`);
    expect(r.ve).toBeLessThan(100);
    expect(r.xa.ve).toBeLessThanOrEqual(r.ve);
    expect(r.xa.tamGiac).toBeLessThan(r.tamGiac / 20);
    // dựng lại ra đúng hình như lần đầu, không dựng tầng nào mới
    expect(r2.tamGiac).toBe(r.tamGiac);
    expect(r2.ve).toBe(r.ve);
    expect(thongKeNho.tangMoi).toBe(0);
    expect(Math.min(...lai)).toBeLessThan(20);
  });
});
