/**
 * Một nguồn giờ nắng giữa kho (`luc`), vỏ gói 3D (`moRongVo`) + phần thân thật (`moRong3DImpl`) và một Khung3D giả làm đúng như Khung3D:
 * đặt mặt trời = `mr.nang(gioDung())`, `gioDung = mr.gio?.() ?? state`. Lỗi cũ (thanh giờ giật lùi): phần 3D làm tròn 0,1 h, đặt vào state
 * khung rồi lượt đặt mặt trời đọc state CŨ và đẩy ngược vào kho.
 */
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TrangThaiPA } from '../tinh/kieu';
import type { GanMoRong, NguCanhMoRong } from '../ve3d/moRong3D';
import { buocChay } from '../tinh/nangGio/dongHo';
import { datNG, layNG } from './kho';
import { taoMoRongNangGio } from './moRongVo';

const hang: (() => void)[] = [];
const xaKhung = () => { const ds = hang.splice(0); ds.forEach((f) => f()); };
const g0 = globalThis as unknown as Record<string, unknown>;
const cu = { raf: g0.requestAnimationFrame, caf: g0.cancelAnimationFrame, doc: g0.document };

beforeAll(() => {
  g0.requestAnimationFrame = (f: () => void) => { hang.push(f); return hang.length; };
  g0.cancelAnimationFrame = () => {};
  const el = () => ({ hidden: false, className: '', textContent: '', style: {}, remove() {}, append() {} });
  g0.document = { createElement: el };
});
afterAll(() => { g0.requestAnimationFrame = cu.raf; g0.cancelAnimationFrame = cu.caf; g0.document = cu.doc; });

const PA = { viTri: { lat: 21.0122, lng: 105.7865, neo: [0, 0] }, huongView: { gocBac: 0 } } as unknown as TrangThaiPA;

/** Khung3D giả: state giờ riêng (chỉ dùng khi không có nguồn ngoài), ghi lại mỗi lần đặt mặt trời. */
async function khungGia() {
  let ext: GanMoRong | null = null;
  const lan: { gio: number; cao: number; pv: number }[] = [];
  const stateGio = 14;
  const gioDung = () => ext?.gio?.() ?? stateGio;
  const datNang = () => { const g = gioDung(); const m = ext?.nang?.(g); if (m) lan.push({ gio: g, cao: m.gocCao, pv: m.phuongVi }); };
  const dom = { parentElement: null, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }) };
  const c: NguCanhMoRong = {
    T: THREE, R: {} as THREE.WebGLRenderer, scene: new THREE.Scene(), phu: new THREE.Group(), apLop() {},
    cam: new THREE.PerspectiveCamera(), sun: new THREE.DirectionalLight(), ve() {}, capNang: () => datNang(), dom: dom as unknown as HTMLCanvasElement,
  };
  ext = taoMoRongNangGio(() => PA).gan(c);
  await vi.waitFor(() => expect(lan.length).toBeGreaterThan(0)); // phần thân nạp xong gọi capNang
  return { ext, lan };
}

describe('một nguồn giờ nắng: kho ↔ 3D', () => {
  it('kéo thanh giờ từng 0,05 h: kho đơn điệu, không bị đẩy lùi, mặt trời 3D đổi MỖI bước theo đúng giờ kho', async () => {
    datNG({ luc: 9 });
    const { ext, lan } = await khungGia();
    xaKhung();
    let truoc = lan.at(-1)!;
    for (let k = 1; k <= 60; k++) {
      const g = +(9 + k * 0.05).toFixed(2); // giá trị ô trượt step 0,05
      datNG({ luc: g });
      xaKhung();
      expect(layNG().luc).toBe(g); // không có ai ghi giờ cũ / làm tròn ngược lại
      const m = lan.at(-1)!;
      expect(m.gio).toBe(g);
      expect(m.pv).not.toBe(truoc.pv); // bóng đổi mỗi bước (bản cũ: cách một bước)
      truoc = m;
    }
    ext.huy();
  });

  it('nhiều lần đổi trong một khung → mặt trời theo giờ mới nhất ngay (vẽ lại do Khung3D gộp rAF)', async () => {
    datNG({ luc: 10 });
    const { ext, lan } = await khungGia();
    datNG({ luc: 10.05 }); datNG({ luc: 10.1 }); datNG({ luc: 10.15 });
    expect(lan.map((x) => x.gio).slice(-3)).toEqual([10.05, 10.1, 10.15]);
    expect(layNG().luc).toBe(10.15);
    ext.huy();
  });

  it('nang(giờ khác kho) không ghi ngược vào kho; datGio (góc nhìn có giờ) ghi đúng giá trị, không làm tròn', async () => {
    datNG({ luc: 9.25 });
    const { ext } = await khungGia();
    ext.nang?.(9.2); ext.nang?.(8);
    xaKhung();
    expect(layNG().luc).toBe(9.25);
    ext.datGio?.(16.55);
    expect(layNG().luc).toBe(16.55);
    expect(ext.gio?.()).toBe(16.55);
    ext.huy();
  });

  it('▶ chạy giờ: mỗi khung giờ tăng đều, 3D theo kịp mỗi khung', async () => {
    datNG({ luc: 7 });
    const { ext, lan } = await khungGia();
    xaKhung();
    let g = layNG().luc;
    for (let i = 0; i < 120; i++) {
      const n = buocChay(layNG().luc, 1 / 60, 6.25, 17.5);
      datNG({ luc: n });
      xaKhung();
      expect(layNG().luc).toBeCloseTo(g + 1 / 60, 9);
      expect(lan.at(-1)!.gio).toBe(layNG().luc);
      g = layNG().luc;
    }
    ext.huy();
  });
});
