/**
 * Dịch shader KHÔNG chặn luồng chính khi mở 3D (đo `scripts/do_mo_3d.mjs`: trước đây lượt vẽ đầu chặn 600–800 ms vì three dịch + nối
 * ~25 chương trình nối tiếp — `getUniforms` → `onFirstUse` chờ từng chương trình).
 *
 * Cách làm: tạo chương trình trước bằng `renderer.compile` trên vật thể giả (cùng hình học + vật liệu → cùng khoá chương trình), chia
 * từng mẻ nhỏ qua nhiều tác vụ, rồi chờ GPU nối xong bằng KHR_parallel_shader_compile (hỏi COMPLETION_STATUS, không chặn). Chỉ vẽ một
 * vật liệu khi chương trình của nó đã sẵn (Khung3D ẩn tạm vật thể chưa sẵn).
 *
 * Lưu ý three r170: `compile()` không đặt trạng thái mặt cắt (clipping) theo vật liệu → vật liệu có `clippingPlanes` dịch sai khoá rồi
 * dịch lại đồng bộ lúc vẽ. Vì vậy mặt cắt ngang của khung 3D là bản vá shader `catY` (bỏ điểm có cao độ thế giới > uCatY), không dùng
 * `clippingPlanes`. Các bản vá shader gộp một khoá chương trình (`customProgramCacheKey`) theo danh sách bản vá — vật liệu cùng bản vá
 * dùng chung một chương trình (tường / đế / tum sơn trước đây ba khoá riêng → ba chương trình giống hệt).
 */
import type * as THREE from 'three';
import type { T3 } from './dungCan';

type Shader = THREE.WebGLProgramParametersWithUniforms;
type VaFn = (sh: Shader) => void;
const VA = new WeakMap<THREE.Material, { khoa: string[]; fn: VaFn[] }>();

/** Thêm bản vá shader `khoa` (cùng khoá = cùng mã shader) vào vật liệu; nhiều bản vá nối tiếp theo thứ tự thêm. */
export function vaShader<M extends THREE.Material>(m: M, khoa: string, fn: VaFn): M {
  let v = VA.get(m);
  if (!v) {
    const vv = (v = { khoa: [] as string[], fn: [] as VaFn[] });
    VA.set(m, vv);
    m.onBeforeCompile = (sh) => vv.fn.forEach((f) => f(sh));
    m.customProgramCacheKey = () => 'um:' + vv.khoa.join('+');
  }
  const i = v.khoa.indexOf(khoa);
  if (i >= 0) v.fn[i] = fn; else { v.khoa.push(khoa); v.fn.push(fn); }
  m.needsUpdate = true;
  return m;
}
/** Chép bản vá shader sang vật liệu khác (bản sao `clone()` của three không chép `onBeforeCompile`). */
export function chepVa<M extends THREE.Material>(tu: THREE.Material, den: M): M {
  const v = VA.get(tu);
  v?.khoa.forEach((k, i) => vaShader(den, k, v.fn[i]));
  return den;
}
export const coVa = (m: THREE.Material, khoa: string) => !!VA.get(m)?.khoa.includes(khoa);

/** Đồng phục cao độ mặt cắt ngang (m, toạ độ thế giới) dùng chung mọi vật liệu của một khung. */
export type CatY = { value: number };
/** Mặt cắt ngang: bỏ điểm có Y thế giới > uCatY (thay `clippingPlanes` một mặt phẳng ngang hướng xuống). */
export function catY<M extends THREE.Material>(m: M, u: CatY): M {
  return vaShader(m, 'cat', (sh) => {
    sh.uniforms.uCatY = u;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCatY;')
      .replace('#include <project_vertex>', `#include <project_vertex>
{ vec4 cw = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
cw = instanceMatrix * cw;
#endif
vCatY = ( modelMatrix * cw ).y; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCatY;\nvarying float vCatY;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif ( vCatY > uCatY ) discard;');
  });
}

/** Nhường luồng chính (tác vụ mới): scheduler.yield nếu có, không thì MessageChannel (nhanh hơn setTimeout 0 bị kẹp 4 ms). */
export function nhuong(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
}
const ngu = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Prog = { isReady: () => boolean; getUniforms: () => unknown };
const chuongTrinh = (R: THREE.WebGLRenderer, m: THREE.Material) => (R.properties.get(m) as { currentProgram?: Prog }).currentProgram;

/**
 * Chờ chương trình của các vật liệu nối xong. Có KHR_parallel_shader_compile: hỏi trạng thái mỗi 8 ms (không chặn). Không có: ép nối
 * từng chương trình một mỗi tác vụ (mỗi tác vụ chỉ chặn bằng một chương trình thay vì cả loạt).
 */
export async function choSan(R: THREE.WebGLRenderer, ds: Iterable<THREE.Material>, huy?: () => boolean): Promise<void> {
  const con = new Set(ds);
  const songSong = R.extensions.has('KHR_parallel_shader_compile');
  while (con.size && !huy?.()) {
    for (const m of con) {
      const p = chuongTrinh(R, m);
      if (!p) { con.delete(m); continue; }
      // sẵn thì "dùng lần đầu" ngay (đọc log / vị trí đồng phục — các lệnh GL đồng bộ): làm lúc này, khi GPU rảnh, thay vì trong lượt vẽ
      if (songSong) { if (p.isReady()) { p.getUniforms(); con.delete(m); } continue; }
      p.getUniforms(); con.delete(m); break; // không song song: một chương trình mỗi tác vụ
    }
    if (con.size) await (songSong ? ngu(8) : nhuong());
  }
}

/** Một vật thể giả mang cùng hình học + vật liệu (cùng biến thể chương trình: instancing, màu từng bản…). */
function gia(T: T3, o: THREE.Object3D, m: THREE.Material): THREE.Object3D {
  const im = o as THREE.InstancedMesh;
  if (im.isInstancedMesh) { const x = new T.InstancedMesh(im.geometry, m, 1); if (im.instanceColor) x.instanceColor = im.instanceColor; return x; }
  const g = (o as THREE.Mesh).geometry;
  if ((o as THREE.LineSegments).isLineSegments) return new T.LineSegments(g, m);
  if ((o as THREE.Line).isLine) return new T.Line(g, m);
  if ((o as THREE.Points).isPoints) return new T.Points(g, m);
  return new T.Mesh(g, m);
}
const dsVatLieu = (o: THREE.Object3D): THREE.Material[] => {
  const m = (o as THREE.Mesh).material;
  return !m ? [] : Array.isArray(m) ? m : [m];
};
const veDuoc = (o: THREE.Object3D) => (o as THREE.Mesh).isMesh || (o as THREE.Line).isLine || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite;

/** Cặp (vật thể, vật liệu) trong cây `goc` có vật liệu chưa thuộc `da` (kể cả vật thể đang ẩn — bật lớp sau không phải dịch). */
export function thieuDich(goc: THREE.Object3D, da: WeakSet<THREE.Material>): { o: THREE.Object3D; m: THREE.Material }[] {
  const kq: { o: THREE.Object3D; m: THREE.Material }[] = [], thay = new Set<string>();
  goc.traverse((o) => {
    if (!veDuoc(o)) return;
    for (const m of dsVatLieu(o)) {
      if (da.has(m)) continue;
      // biến thể theo vật thể: cùng vật liệu trên mesh thường / instanced là hai chương trình
      const k = m.uuid + ((o as THREE.InstancedMesh).isInstancedMesh ? ((o as THREE.InstancedMesh).instanceColor ? '|ic' : '|i') : (o as THREE.Line).isLine ? '|l' : '');
      if (thay.has(k)) continue;
      thay.add(k); kq.push({ o, m });
    }
  });
  return kq;
}

/**
 * Tạo chương trình cho các cặp (vật thể, vật liệu) theo trạng thái cảnh `canh` (đèn, sương, môi trường), mỗi tác vụ tối đa `ms`
 * mili giây, rồi chờ nối xong. `datTrangThai` đặt / trả trạng thái renderer quanh mỗi lần `compile` (vd. môi trường giả cùng cỡ).
 */
export async function dichDan(T: T3, R: THREE.WebGLRenderer, ds: { o: THREE.Object3D; m: THREE.Material }[], canh: THREE.Scene, cam: THREE.Camera,
  tc: { ms?: number; datTrangThai?: (bat: boolean) => void; huy?: () => boolean } = {}): Promise<void> {
  const nhom = new T.Group(), ms = tc.ms ?? 8;
  let i = 0;
  while (i < ds.length) {
    if (tc.huy?.()) return;
    const t0 = performance.now();
    tc.datTrangThai?.(true);
    try {
      while (i < ds.length && performance.now() - t0 < ms) {
        const x = gia(T, ds[i].o, ds[i].m);
        nhom.add(x);
        R.compile(nhom, cam, canh);
        nhom.remove(x);
        i++;
      }
    } finally { tc.datTrangThai?.(false); }
    if (i < ds.length) await nhuong();
  }
  await choSan(R, ds.map((x) => x.m), tc.huy);
}

/**
 * Chương trình bóng đổ (MeshDepthMaterial của WebGLShadowMap): biến thể theo mặt (mặt sau / hai mặt) × instancing có / không màu.
 * Dịch trước như lượt bóng: đích vẽ là render target (không tone mapping, tuyến tính), cảnh rỗng (không sương), cùng đèn của cảnh.
 */
export async function dichBong(T: T3, R: THREE.WebGLRenderer, canh: THREE.Scene, cam: THREE.Camera, huy?: () => boolean): Promise<void> {
  const MAT_BONG: Record<number, number> = { [T.FrontSide]: T.BackSide, [T.BackSide]: T.FrontSide, [T.DoubleSide]: T.DoubleSide };
  const bienThe = new Map<string, { o: THREE.Object3D; m: THREE.Material }>();
  const vlTheoMat = new Map<number, THREE.MeshDepthMaterial>();
  canh.traverse((o) => {
    if (!o.castShadow || !(o as THREE.Mesh).isMesh) return;
    for (const m of dsVatLieu(o)) {
      const mat = m.shadowSide ?? MAT_BONG[m.side], im = o as THREE.InstancedMesh;
      const k = `${mat}|${im.isInstancedMesh ? (im.instanceColor ? 'ic' : 'i') : ''}`;
      if (bienThe.has(k)) continue;
      let vl = vlTheoMat.get(mat);
      if (!vl) { vl = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, side: mat as THREE.Side }); vlTheoMat.set(mat, vl); }
      bienThe.set(k, { o, m: vl });
    }
  });
  if (!bienThe.size) return;
  const rt = new T.WebGLRenderTarget(1, 1);
  let suong: THREE.Fog | THREE.FogExp2 | null = null, cu: THREE.WebGLRenderTarget | null = null, bong = false;
  try {
    await dichDan(T, R, [...bienThe.values()], canh, cam, {
      huy,
      datTrangThai: (bat) => {
        // chỉ đổi trạng thái trong một tác vụ đồng bộ (không giữ qua `await`: lượt vẽ xem trước chen giữa sẽ dịch sai khoá)
        if (bat) { suong = canh.fog; canh.fog = null; cu = R.getRenderTarget(); R.setRenderTarget(rt); bong = R.shadowMap.enabled; R.shadowMap.enabled = true; }
        else { canh.fog = suong; R.setRenderTarget(cu); R.shadowMap.enabled = bong; }
      },
    });
  } finally {
    rt.dispose();
    // vật liệu giả: chương trình vẫn nằm trong bộ nhớ chương trình của renderer (dùng chung theo khoá), huỷ vật liệu không gỡ chương trình
    // khi chương trình còn được tham chiếu; ở đây chỉ để dịch nên giữ nguyên (vài vật liệu nhỏ, sống theo khung)
  }
}

/** Môi trường giả cùng cỡ với PMREM 256 (cubeUV 768 × 1024) — để dịch trước đúng khoá chương trình khi PMREM chưa xong. */
export function moiTruongGia(T: T3): THREE.Texture {
  const tx = new T.Texture();
  tx.mapping = T.CubeUVReflectionMapping;
  (tx as unknown as { image: { width: number; height: number } }).image = { width: 768, height: 1024 };
  return tx;
}

/**
 * Lọc PMREM bầu trời không chặn: dịch trước (song song) ba chương trình PMREM dùng — hộp nền, bầu trời, làm mờ — rồi mới `fromScene`
 * (lúc đó chỉ còn ~20 lượt vẽ nhỏ). Dùng API riêng của PMREMGenerator r170 (`_setSize`, `_allocateTargets`, `_blurMaterial`,
 * `_lodPlanes`); thiếu thì `fromScene` thẳng (vẫn đúng, chỉ chặn lâu hơn).
 */
export async function locMoiTruong(T: T3, R: THREE.WebGLRenderer, bauTroi: THREE.Scene, huy?: () => boolean): Promise<THREE.WebGLRenderTarget | null> {
  const pm = new T.PMREMGenerator(R);
  try {
    const p = pm as unknown as { _setSize?: (n: number) => void; _allocateTargets?: () => THREE.WebGLRenderTarget; _blurMaterial?: THREE.Material | null; _lodPlanes?: THREE.BufferGeometry[] };
    if (p._setSize && p._allocateTargets) {
      p._setSize(256);
      p._allocateTargets().dispose();
      const rt = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
      const camCube = new T.PerspectiveCamera(90, 1, 0.1, 100), camPhang = new T.OrthographicCamera();
      const nen = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial({ side: T.BackSide, depthWrite: false, depthTest: false }));
      const ds: THREE.Material[] = [nen.material];
      const cu = R.getRenderTarget(), tm = R.toneMapping;
      R.setRenderTarget(rt); R.toneMapping = T.NoToneMapping;
      try {
        // không nhường giữa chừng: trạng thái (đích vẽ, tone mapping) phải trả lại trước khi tác vụ khác dịch
        R.compile(nen, camCube);
        R.compile(bauTroi, camCube);
        bauTroi.traverse((o) => ds.push(...dsVatLieu(o)));
        if (p._blurMaterial && p._lodPlanes?.[0]) { R.compile(new T.Mesh(p._lodPlanes[0], p._blurMaterial), camPhang); ds.push(p._blurMaterial); }
      } finally { R.setRenderTarget(cu); R.toneMapping = tm; }
      await choSan(R, ds, huy);
      nen.geometry.dispose(); nen.material.dispose(); rt.dispose();
      if (huy?.()) return null;
      await nhuong();
    }
    return pm.fromScene(bauTroi, 0, 0.1, 100);
  } finally { pm.dispose(); }
}
