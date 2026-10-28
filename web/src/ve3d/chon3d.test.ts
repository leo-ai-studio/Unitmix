import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BAM_TOI_DA_MS, chonSauBam, dangChon, doiTuongCua, doiTuongTrung, laBam, laBamDup, mucLod, nguongLod } from './chon3d';

describe('chọn tòa / lô trong 3D', () => {
  it('ánh xạ đối tượng 3D → id tòa / lô qua nút cha', () => {
    const nhom = new THREE.Group(), me = new THREE.Mesh(), lo = new THREE.Mesh();
    nhom.userData.chon = { loai: 'toa', id: 't1', loId: 'l1' };
    lo.userData.chon = { loai: 'lo', id: 'l1' };
    nhom.add(me);
    expect(doiTuongCua(me)).toEqual({ loai: 'toa', id: 't1', loId: 'l1' });
    expect(doiTuongCua(lo)).toEqual({ loai: 'lo', id: 'l1' });
    expect(doiTuongCua(new THREE.Mesh())).toBeNull();
    expect(doiTuongCua(null)).toBeNull();
    const rac = new THREE.Mesh(); rac.userData.chon = { loai: 'cay', id: 'x' };
    expect(doiTuongCua(rac)).toBeNull();
  });
  it('tia trúng nhiều vật: lấy vật chọn được gần nhất, bỏ qua vật không gắn (cây, đất nền)', () => {
    const cay = new THREE.Mesh(), toa = new THREE.Mesh(), lo = new THREE.Mesh();
    toa.userData.chon = { loai: 'toa', id: 't2', loId: 'l1' }; lo.userData.chon = { loai: 'lo', id: 'l1' };
    expect(doiTuongTrung([{ object: cay }, { object: toa }, { object: lo }])?.id).toBe('t2');
    expect(doiTuongTrung([{ object: cay }])).toBeNull();
    expect(doiTuongTrung([])).toBeNull();
  });
  it('raycast thật: bấm trúng khối tòa ra id tòa', () => {
    const goc = new THREE.Group();
    const toa = new THREE.Mesh(new THREE.BoxGeometry(10, 60, 10), new THREE.MeshBasicMaterial());
    toa.position.set(0, 30, 0); toa.userData.chon = { loai: 'toa', id: 'tA', loId: 'lA' };
    const lo = new THREE.Mesh(new THREE.BoxGeometry(80, 0.2, 80), new THREE.MeshBasicMaterial());
    lo.userData.chon = { loai: 'lo', id: 'lA' };
    goc.add(toa, lo); goc.updateMatrixWorld(true);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    cam.position.set(0, 30, 100); cam.lookAt(0, 30, 0); cam.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0, 0), cam);
    expect(doiTuongTrung(rc.intersectObjects(goc.children, true))?.id).toBe('tA');
    cam.position.set(0, 80, 60); cam.lookAt(30, 0, 30); cam.updateMatrixWorld(true);
    rc.setFromCamera(new THREE.Vector2(0, 0), cam);
    expect(doiTuongTrung(rc.intersectObjects(goc.children, true))).toEqual({ loai: 'lo', id: 'lA' });
    rc.setFromCamera(new THREE.Vector2(0, 0.99), cam); // lên trời: bấm nền
    expect(doiTuongTrung(rc.intersectObjects(goc.children, true))).toBeNull();
  });
  it('bấm hay kéo: theo ngưỡng px của chuột / ngón tay và thời gian giữ', () => {
    const xuong = { x: 100, y: 100, t: 0 };
    expect(laBam(xuong, { x: 103, y: 103, t: 120 })).toBe(true); // 4,2 px
    expect(laBam(xuong, { x: 106, y: 100, t: 120 })).toBe(false); // 6 px chuột = kéo
    expect(laBam({ ...xuong, kieu: 'touch' }, { x: 108, y: 106, t: 150 })).toBe(true); // 10 px ngón tay vẫn là chạm
    expect(laBam({ ...xuong, kieu: 'touch' }, { x: 120, y: 100, t: 150 })).toBe(false);
    expect(laBam(xuong, { x: 100, y: 100, t: BAM_TOI_DA_MS + 1 })).toBe(false); // giữ lâu
  });
  it('bấm đúp: hai lần gần nhau về thời gian và vị trí', () => {
    expect(laBamDup(null, { x: 0, y: 0, t: 0 })).toBe(false);
    expect(laBamDup({ x: 0, y: 0, t: 0 }, { x: 10, y: 5, t: 300 })).toBe(true);
    expect(laBamDup({ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 400 })).toBe(false);
    expect(laBamDup({ x: 0, y: 0, t: 0 }, { x: 40, y: 0, t: 100 })).toBe(false);
  });
  it('state chọn sau khi bấm và đối tượng nào được tô', () => {
    expect(chonSauBam({ loai: 'toa', id: 't1', loId: 'l1' })).toEqual({ toaId: 't1', loId: 'l1' });
    expect(chonSauBam({ loai: 'lo', id: 'l2' })).toEqual({ toaId: null, loId: 'l2' });
    expect(chonSauBam(null)).toEqual({ toaId: null, loId: null });
    expect(dangChon({ loai: 'toa', id: 't1', loId: 'l1' }, { toaId: 't1', loId: 'l1' })).toBe(true);
    expect(dangChon({ loai: 'lo', id: 'l1' }, { toaId: 't1', loId: 'l1' })).toBe(false); // tòa đang chọn: không tô lô chồng
    expect(dangChon({ loai: 'lo', id: 'l1' }, { toaId: null, loId: 'l1' })).toBe(true);
  });
  it('LOD: góc mặc định của tòa vẫn chi tiết, kéo ra xa thì vẽ dải cửa', () => {
    for (const co of [30, 80, 150]) {
      expect(mucLod(co * 2.2, co)).toBe('gan'); // khoảng cách góc mặc định (gocMacDinh)
      expect(mucLod(co * 6, co)).toBe('xa');
      expect(nguongLod(co)).toBeLessThan(co * 8); // còn với tới được trong maxDistance của khung (8 × cỡ cảnh)
    }
    expect(nguongLod(10)).toBe(120);
    expect(nguongLod(100)).toBeGreaterThan(nguongLod(50));
  });
});
