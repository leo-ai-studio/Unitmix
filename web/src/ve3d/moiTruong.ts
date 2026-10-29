/**
 * Môi trường cho kiểu 3D "Vật liệu": bầu trời thủ tục (không tải tệp) để lọc PMREM — kính / nhôm phản chiếu trời thật, mặt mờ
 * nhận ánh sáng tán xạ; vật liệu tường sơn be có biến thiên rất nhẹ + tối dần sát chân công trình (cảm giác AO, rẻ: tính trong shader
 * theo toạ độ thế giới, không thêm thuộc tính đỉnh — tương thích lớp phủ màu đỉnh của chế độ Phân tích view).
 */
import type * as THREE from 'three';
import type { T3 } from './dungCan';

/** Màu bầu trời (tuyến tính hoá khi dựng): thiên đỉnh xanh nhạt, chân trời ngà brand, đất be `--secondary`. */
const TROI = { dinh: 0x9fc0dc, chanTroi: 0xf3eee3, dat: 0xb8b0a3, mt: 0xfff3dd };

/**
 * Cảnh bầu trời: cầu lật trong (màu theo đỉnh, chuyển mượt quanh chân trời) + đĩa mặt trời sáng ở phía Nam-Tây theo giờ (gần đúng:
 * chỉ để có điểm sáng phản chiếu trên kính, không cần chính xác như nắng đổ bóng).
 */
export function bauTroi(T: T3, gio = 14): THREE.Scene {
  const sc = new T.Scene();
  const g = new T.SphereGeometry(50, 48, 24), p = g.getAttribute('position'), mau: number[] = [];
  const c0 = new T.Color(TROI.dinh), c1 = new T.Color(TROI.chanTroi), c2 = new T.Color(TROI.dat), c = new T.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50;
    if (y >= 0) c.copy(c1).lerp(c0, Math.pow(Math.min(1, y / 0.75), 0.6));
    else c.copy(c1).lerp(c2, Math.min(1, -y * 6));
    mau.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(mau, 3));
  sc.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, depthWrite: false })));
  // đĩa mặt trời: góc giờ 6h Đông → 18h Tây, cao ~ 55° giữa trưa
  const a = ((gio - 6) / 12) * Math.PI, cao = Math.max(0.12, Math.sin(a)) * 0.95;
  const d = new T.Vector3(-Math.cos(a), cao, 0.45).normalize().multiplyScalar(45);
  const dia = new T.Mesh(new T.SphereGeometry(2.2, 16, 8), new T.MeshBasicMaterial({ color: new T.Color(TROI.mt).multiplyScalar(14) }));
  dia.position.copy(d);
  sc.add(dia);
  return sc;
}

/**
 * Tường sơn / đá ốp (tường, đế, tum): biến thiên ±2,5 % theo ô ~3 m × tầng (vữa sơn không đều tuyệt đối) và tối dần 0–3,5 m sát đất
 * (ánh sáng bị che ở chân công trình). Một chương trình shader riêng (`customProgramCacheKey`).
 */
export function tuongSon(m: THREE.MeshStandardMaterial, khoa: string): THREE.MeshStandardMaterial {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vViTriTG;')
      .replace('#include <project_vertex>', `#include <project_vertex>
vec4 vtTG = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
vtTG = instanceMatrix * vtTG;
#endif
vViTriTG = ( modelMatrix * vtTG ).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vViTriTG;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 o = floor( vec3( vViTriTG.x / 3.0, vViTriTG.y / 3.3, vViTriTG.z / 3.0 ) );
  float n = fract( sin( dot( o, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
  diffuseColor.rgb *= 0.975 + 0.05 * n;
  diffuseColor.rgb *= mix( 0.7, 1.0, smoothstep( 0.0, 3.5, vViTriTG.y ) );
}`);
  };
  m.customProgramCacheKey = () => 'unitmix-' + khoa;
  return m;
}
