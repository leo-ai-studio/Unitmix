/**
 * Phần 3D của gói Vị trí · Nắng · Gió (nạp lười khi mở 3D Toàn dự án), gắn vào Khung3D qua `ve3d/moRong3D.ts`:
 * - mặt trời theo toạ độ dự án + ngày / giờ đang chọn (bóng đổ thật của Khung3D chạy theo, kể cả hoạt ảnh giờ);
 * - đường đi mặt trời (ngày chọn + Hạ chí / Đông chí, vòng chân trời, chữ B / Đ / N / T, chấm giờ, mặt trời hiện tại);
 * - ảnh nền mặt đất: hai vòng (gần nét, xa thô — LOD theo khoảng cách), ô ghép trong Web Worker thành 1 texture mỗi vòng,
 *   trần 2048² (máy cảm ứng 1024²), giải phóng texture cũ khi đổi;
 * - lớp phân tích: giờ nắng trên mặt đất / mái (texture theo từng cao độ) + mặt đứng (lưới ô màu theo đỉnh), gió (texture + đường dòng);
 *   số đọc dưới con trỏ (tia chỉ dò các lớp này, rAF).
 * Toạ độ three: X = x bản vẽ, Y = cao, Z = −y bản vẽ.
 */
import type * as THREE from 'three';
import type { CanhDung } from '../ve3d/Khung3D';
import type { GanMoRong, NguCanhMoRong } from '../ve3d/moRong3D';
import { t } from '../i18n/i18n';
import type { Diem, TrangThaiPA } from '../tinh/kieu';
import { duongDi, matTroi, NGAY_DONG_CHI, NGAY_HA_CHI } from '../tinh/matTroi';
import { chonMuc, datSangBanVe, khungLl, khungODat, llSangO, viTriPA, type ODb, type ViTri } from '../tinh/viTri';
import { fmtSo } from '../ui/so';
import { anhPhanTich, docTai } from './hienThi';
import { datNG, layNG, mayYeu, ngheNG } from './kho';
import { mauNang } from './mau';
import { mauO } from './nguonBanDo';

type LayPA = () => TrangThaiPA;
const RAD = Math.PI / 180;

export function gan(c: NguCanhMoRong, layPA: LayPA): GanMoRong {
  const { T, scene } = c;
  const goc = new T.Group(); goc.name = 'nang-gio';
  scene.add(goc);
  const gNen = new T.Group(), gMT = new T.Group(), gPT = new T.Group();
  goc.add(gNen, gMT, gPT);
  let canh: CanhDung | null = null;
  const yeu = mayYeu();
  // ---- lớp DOM nhỏ: ghi nguồn ảnh + số đọc ----
  const vung = c.dom.parentElement;
  const ghi = document.createElement('div'); ghi.className = 'ng-ghi-nguon ng-3d'; ghi.hidden = true;
  const doc = document.createElement('div'); doc.className = 'ng-doc-so'; doc.hidden = true;
  vung?.append(ghi, doc);

  // ---- mặt trời ----
  let gioKhung: number | null = null, gioDay: number | null = null;
  const nang = (gio: number) => {
    const s = layNG(), vt = viTriPA(layPA());
    if (gioKhung === null) gioKhung = gio;
    else if (gio !== gioKhung && gio !== gioDay) { gioKhung = gio; if (Math.abs(gio - s.luc) > 1e-6) datNG({ luc: gio }); }
    const m = matTroi(vt.lat, vt.lng, s.ngay, layNG().luc);
    datMatTroiNho(m.cao, m.phuongVi, vt);
    return { gocCao: m.cao, phuongVi: m.phuongVi };
  };

  // ---- đường mặt trời ----
  const vlDuong = new T.LineBasicMaterial({ color: 0xf2a13a, transparent: true, opacity: 0.95, depthWrite: false });
  const vlDuongPhu = new T.LineDashedMaterial({ color: 0x8a8f86, dashSize: 2, gapSize: 2, transparent: true, opacity: 0.7, depthWrite: false });
  const vlVong = new T.LineBasicMaterial({ color: 0x6b6f68, transparent: true, opacity: 0.6, depthWrite: false });
  const vlChamGio = new T.PointsMaterial({ color: 0xf2a13a, size: 6, sizeAttenuation: false, depthWrite: false });
  const meMT = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({ color: 0xffc94a }));
  let banKinh = 100, tamMT = new T.Vector3();
  const diemMT = (cao: number, pv: number, gocBac: number) => {
    const a = (pv - gocBac) * RAD, e = cao * RAD;
    return new T.Vector3(tamMT.x + banKinh * Math.sin(a) * Math.cos(e), banKinh * Math.sin(e), tamMT.z - banKinh * Math.cos(a) * Math.cos(e));
  };
  const nhan = (chu: string) => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d')!; g.font = '700 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeText(chu, 32, 34); g.fillStyle = '#26312c'; g.fillText(chu, 32, 34);
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthWrite: false, depthTest: false, sizeAttenuation: true }));
    return sp;
  };
  const xoaNhom = (g: THREE.Group) => {
    g.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); if ((o as THREE.Sprite).isSprite) { const v = (o as THREE.Sprite).material; v.map?.dispose(); v.dispose(); } });
    g.clear();
  };
  let datMatTroiNho = (_c: number, _p: number, _v: ViTri) => {};
  const dungDuongMT = () => {
    xoaNhom(gMT);
    const s = layNG();
    if (!canh || !s.duongMT) { c.ve(); return; }
    const vt = viTriPA(layPA());
    banKinh = Math.max(40, canh.coCanh * 1.05);
    tamMT = new T.Vector3(canh.tam[0], 0, canh.tam[2]);
    // vòng chân trời + vạch 8 hướng + chữ B Đ N T (theo Bắc thật)
    const vong: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) vong.push(diemMT(0, (i / 96) * 360, vt.gocBac));
    const vongL = new T.Line(new T.BufferGeometry().setFromPoints(vong), vlVong); gMT.add(vongL);
    const vach: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) { const a = diemMT(0, i * 45, vt.gocBac), b = a.clone().sub(tamMT).multiplyScalar(i % 2 ? 0.96 : 0.9).add(tamMT); vach.push(a, b); }
    gMT.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(vach), vlVong));
    (['B', 'Đ', 'N', 'T'] as const).forEach((k, i) => {
      const sp = nhan(t(`ng.3d.${['b', 'd', 'n', 't'][i]}`) || k), p = diemMT(0, i * 90, vt.gocBac).sub(tamMT).multiplyScalar(1.07).add(tamMT);
      sp.position.copy(p).setY(2); sp.scale.setScalar(banKinh * 0.07); sp.renderOrder = 30; gMT.add(sp);
    });
    // đường Hạ chí / Đông chí (nét đứt) + ngày chọn (cam) + chấm mỗi giờ
    const duong = (ngay: string, vl: THREE.LineBasicMaterial | THREE.LineDashedMaterial, cham: boolean) => {
      const d = duongDi(vt.lat, vt.lng, ngay, 10).filter((x) => x.cao > -0.5);
      if (d.length < 2) return;
      const l = new T.Line(new T.BufferGeometry().setFromPoints(d.map((x) => diemMT(Math.max(0, x.cao), x.phuongVi, vt.gocBac))), vl);
      if ((vl as THREE.LineDashedMaterial).isLineDashedMaterial) l.computeLineDistances();
      gMT.add(l);
      if (cham) {
        const g = d.filter((x) => Math.abs(x.gio - Math.round(x.gio)) < 1e-6 && x.cao > 0).map((x) => diemMT(x.cao, x.phuongVi, vt.gocBac));
        gMT.add(new T.Points(new T.BufferGeometry().setFromPoints(g), vlChamGio));
      }
    };
    duong(NGAY_HA_CHI(), vlDuongPhu, false);
    duong(NGAY_DONG_CHI(), vlDuongPhu, false);
    duong(s.ngay, vlDuong, true);
    meMT.scale.setScalar(banKinh * 0.025);
    gMT.add(meMT);
    datMatTroiNho = (cao, pv, v) => { meMT.visible = cao > -0.5; meMT.position.copy(diemMT(Math.max(0, cao), pv, v.gocBac)); };
    const m = matTroi(vt.lat, vt.lng, s.ngay, s.luc);
    datMatTroiNho(m.cao, m.phuongVi, vt);
    c.ve();
  };

  // ---- ảnh nền mặt đất ----
  let wNen: Worker | null = null, soNen = 0, texNen: THREE.Texture[] = [];
  const xoaNen = () => { wNen?.terminate(); wNen = null; texNen.forEach((x) => x.dispose()); texNen = []; xoaNhom(gNen); ghi.hidden = true; };
  const ve3 = (p: Diem, y: number) => new T.Vector3(p[0], y, -p[1]);
  const dungNen = async () => {
    const s = layNG(), pa = layPA(), vt = viTriPA(pa);
    const so = ++soNen;
    xoaNen();
    if (!canh || !s.banDo3D || !vt.coToaDo) { c.ve(); return; }
    const m = await mauO(s.nguon);
    if (so !== soNen) return;
    ghi.textContent = m.google ? 'Google' : m.ghi; ghi.hidden = false;
    const tam: Diem = [canh.tam[0], -canh.tam[2]];
    const vong = [
      { R: Math.max(150, canh.coCanh * 1.3), px: yeu ? 1024 : 2048, y: -0.02 },
      { R: Math.max(600, canh.coCanh * 4.5), px: yeu ? 512 : 1024, y: -0.035 },
    ];
    try { wNen = new Worker(new URL('./anhNen.worker.ts', import.meta.url), { type: 'module' }); } catch { return; }
    const w = wNen;
    let id = 0;
    for (const v of vong) {
      // mức zoom để vòng (2R m) nằm trong atlas px điểm ảnh
      const k = khungLl([[tam[0] - v.R, tam[1] - v.R], [tam[0] + v.R, tam[1] + v.R], [tam[0] - v.R, tam[1] + v.R], [tam[0] + v.R, tam[1] - v.R]], vt, 0);
      let z = Math.min(m.zMax, chonMuc((2 * v.R) / v.px, vt.lat, 3, m.zMax));
      let a = llSangO(k.n, k.w, z), b = llSangO(k.s, k.e, z);
      while (z > 3 && Math.max(Math.floor(b[0]) - Math.floor(a[0]) + 1, Math.floor(b[1]) - Math.floor(a[1]) + 1) * 256 > v.px * 1.5) { z--; a = llSangO(k.n, k.w, z); b = llSangO(k.s, k.e, z); }
      const x0 = Math.floor(a[0]), y0 = Math.floor(a[1]), x1 = Math.floor(b[0]), y1 = Math.floor(b[1]);
      const urls: string[][] = [];
      for (let y = y0; y <= y1; y++) { const r: string[] = []; for (let x = x0; x <= x1; x++) r.push(m.url(z, x, y)); urls.push(r); }
      const soO = Math.max(x1 - x0 + 1, y1 - y0 + 1), px = Math.min(v.px, soO * 256);
      const kq = await new Promise<ImageBitmap | null>((ok) => {
        const myId = ++id;
        w.onmessage = (e: MessageEvent<{ id: number; anh: ImageBitmap }>) => { if (e.data.id === myId) ok(e.data.anh); };
        w.onerror = () => ok(null);
        w.postMessage({ id: myId, urls, px });
      });
      if (so !== soNen || !kq) { kq?.close(); return; }
      const o0: ODb = { z, x: x0, y: y0 }, o1: ODb = { z, x: x1, y: y1 };
      const tb = khungODat(o0, vt).tb, dn = khungODat(o1, vt).dn;
      // atlas vuông soO × soO ô: phần thừa (hàng / cột không dùng) nằm phải / dưới
      const coX = (x1 - x0 + 1) / soO, coY = (y1 - y0 + 1) / soO;
      const goc4 = [[tb[0], tb[1]], [dn[0], tb[1]], [dn[0], dn[1]], [tb[0], dn[1]]].map((d) => datSangBanVe(d as Diem, vt));
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(goc4.flatMap((p) => ve3(p, v.y).toArray()), 3));
      g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, coX, 0, coX, coY, 0, coY], 2));
      g.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      g.setIndex([0, 2, 1, 0, 3, 2]);
      const tx = new T.Texture(kq);
      tx.flipY = false; tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = Math.min(8, c.R.capabilities.getMaxAnisotropy());
      tx.generateMipmaps = true; tx.minFilter = T.LinearMipmapLinearFilter; tx.needsUpdate = true;
      tx.onUpdate = () => kq.close(); // đã lên GPU: bỏ bản CPU
      texNen.push(tx);
      const op = layNG().doMo;
      // ảnh vệ tinh đã có sáng tối riêng: nâng màu ~1,35 để bù đèn cảnh (vẫn nhận bóng đổ thật)
      const vl = new T.MeshLambertMaterial({ map: tx, transparent: op < 0.999, opacity: op, depthWrite: op >= 0.999 });
      vl.color.setScalar(1.35);
      const me = new T.Mesh(g, vl);
      me.receiveShadow = true; me.renderOrder = -2;
      me.userData.nen = true;
      gNen.add(me);
      c.ve();
    }
    w.terminate(); if (wNen === w) wNen = null;
  };
  const datDoMo = () => {
    const op = layNG().doMo;
    gNen.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined; if (m && (o as THREE.Mesh).isMesh) { m.opacity = op; m.transparent = op < 0.999; m.depthWrite = op >= 0.999; m.needsUpdate = true; } });
    c.ve();
  };

  // ---- lớp phân tích ----
  let texPT: THREE.Texture[] = [];
  let dsDo: THREE.Mesh[] = [];
  let matInfo: Float32Array | null = null;
  const xoaPT = () => { texPT.forEach((x) => x.dispose()); texPT = []; xoaNhom(gPT); dsDo = []; matInfo = null; };
  const dungPT = () => {
    xoaPT();
    const s = layNG(), a = s.hien3D ? anhPhanTich() : null;
    if (!a || !canh) { c.ve(); return; }
    const L = a.luoi, w = L.nx * L.buoc, h = L.ny * L.buoc;
    const mucs = a.cao ? [...new Set(Array.from(a.cao))].sort((p, q) => p - q) : [0];
    for (const muc of mucs) {
      let rgba = a.rgba;
      if (a.cao && mucs.length > 1) { rgba = a.rgba.slice(); for (let i = 0; i < a.cao.length; i++) if (a.cao[i] !== muc) rgba[i * 4 + 3] = 0; }
      const tx = new T.DataTexture(rgba as Uint8Array<ArrayBuffer>, L.nx, L.ny, T.RGBAFormat);
      tx.magFilter = T.LinearFilter; tx.minFilter = T.LinearFilter; tx.colorSpace = T.SRGBColorSpace; tx.needsUpdate = true;
      texPT.push(tx);
      const g = new T.PlaneGeometry(w, h);
      g.rotateX(-Math.PI / 2); // mặt phẳng XZ; uv v = 0 ở z dương (= y bản vẽ nhỏ = phía Nam) — khớp hàng 0 của lưới
      const me = new T.Mesh(g, new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      me.position.set(L.x0 + w / 2, (muc > 0 ? muc : 0.2) + 0.07, -(L.y0 + h / 2));
      me.renderOrder = 5; me.userData.mat = 'dat';
      gPT.add(me); dsDo.push(me);
    }
    // mặt đứng giờ nắng: ô vuông màu theo giờ, lùi ra ngoài 0,12 m
    const kqN = s.lop === 'nang' ? s.nang.kq : null;
    if (kqN && s.matDung && kqN.mat.length) {
      const M = kqN.mat, n = M.length / 9, T0 = Math.max(kqN.tongGio, 1e-6);
      const pos = new Float32Array(n * 12), col = new Float32Array(n * 12), idx: number[] = [];
      for (let j = 0; j < n; j++) {
        const o = j * 9, x = M[o] + M[o + 3] * 0.08, y = M[o + 1] + M[o + 4] * 0.08, z = M[o + 2], tx = -M[o + 4], ty = M[o + 3], hw = M[o + 5] / 2 * 0.98, hh = M[o + 6] / 2 * 0.98;
        const P = [[x - tx * hw, y - ty * hw, z - hh], [x + tx * hw, y + ty * hw, z - hh], [x + tx * hw, y + ty * hw, z + hh], [x - tx * hw, y - ty * hw, z + hh]];
        const cl = mauNang(M[o + 7] / T0).map((v) => (v / 255) ** 2.2);
        P.forEach((p, k) => { pos.set([p[0], p[2], -p[1]], j * 12 + k * 3); col.set(cl, j * 12 + k * 3); });
        const b = j * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setIndex(idx);
      const me = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      me.userData.mat = 'dung'; me.renderOrder = 4;
      gPT.add(me); dsDo.push(me); matInfo = M;
    }
    // đường dòng gió ở 1,5 m
    const kqG = s.lop === 'gio' ? s.gio.kq : null;
    if (kqG && s.dongGio && kqG.dong.length) {
      const v: number[] = [];
      for (const d of kqG.dong) for (let i = 1; i < d.length; i++) v.push(d[i - 1][0], 1.5, -d[i - 1][1], d[i][0], 1.5, -d[i][1]);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
      gPT.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x2b3a35, transparent: true, opacity: 0.55, depthWrite: false })));
    }
    c.ve();
  };

  // ---- số đọc dưới con trỏ ----
  const rc = new T.Raycaster(), v2 = new T.Vector2();
  let cho = 0, ev: PointerEvent | null = null;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons || !dsDo.length) { doc.hidden = true; return; }
    ev = e;
    if (cho) return;
    cho = requestAnimationFrame(() => {
      cho = 0;
      if (!ev) return;
      const r = c.dom.getBoundingClientRect();
      v2.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(v2, c.cam);
      const h = rc.intersectObjects(dsDo, false)[0];
      let chu: string | null = null;
      if (h && h.object.userData.mat === 'dung' && matInfo && h.faceIndex != null) {
        const j = Math.floor(h.faceIndex / 2);
        chu = `${fmtSo(matInfo[j * 9 + 7], { thapPhan: 1 })} h · ${t('ng.nang.matDung')} +${fmtSo(matInfo[j * 9 + 2], { thapPhan: 1 })} m`;
      } else if (h) chu = docTai([h.point.x, -h.point.z]);
      doc.hidden = !chu;
      if (chu) { doc.textContent = chu; doc.style.left = `${ev.clientX - r.left + 14}px`; doc.style.top = `${ev.clientY - r.top + 14}px`; }
    });
  };
  const onLeave = () => { doc.hidden = true; };
  c.dom.addEventListener('pointermove', onMove);
  c.dom.addEventListener('pointerleave', onLeave);

  // ---- nghe kho ----
  let cu = layNG(), viTriCu = JSON.stringify(layPA().viTri ?? null) + (layPA().huongView?.gocBac ?? 0);
  const boNghe = ngheNG(() => {
    const s = layNG(), p = cu; cu = s;
    const vtMoi = JSON.stringify(layPA().viTri ?? null) + (layPA().huongView?.gocBac ?? 0), doiVT = vtMoi !== viTriCu; viTriCu = vtMoi;
    if (s.luc !== p.luc) { gioDay = s.luc; c.datGio(s.luc); }
    if (s.luc !== p.luc || s.ngay !== p.ngay || doiVT) c.capNang();
    if (s.ngay !== p.ngay || s.duongMT !== p.duongMT || doiVT) dungDuongMT();
    if (s.banDo3D !== p.banDo3D || s.nguon !== p.nguon || doiVT) void dungNen();
    else if (s.doMo !== p.doMo) datDoMo();
    if (s.lop !== p.lop || s.hien3D !== p.hien3D || s.nang.kq !== p.nang.kq || s.gio.kq !== p.gio.kq || s.gioXem !== p.gioXem || s.matDung !== p.matDung || s.dongGio !== p.dongGio) dungPT();
  });
  gioDay = layNG().luc; c.datGio(layNG().luc);

  return {
    canhMoi(cn) {
      canh = cn;
      dungDuongMT(); void dungNen(); dungPT();
      c.capNang();
    },
    nang,
    huy() {
      boNghe(); cancelAnimationFrame(cho);
      c.dom.removeEventListener('pointermove', onMove); c.dom.removeEventListener('pointerleave', onLeave);
      xoaNen(); xoaPT(); xoaNhom(gMT);
      [vlDuong, vlDuongPhu, vlVong, vlChamGio, meMT.material as THREE.Material].forEach((m) => m.dispose());
      meMT.geometry.dispose();
      scene.remove(goc);
      ghi.remove(); doc.remove();
    },
  };
}
