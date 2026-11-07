/**
 * Xuất mô hình 3D ra COLLADA (.dae) — SketchUp mở trực tiếp (Tệp › Nhập / kéo thả), lưu lại thành .skp.
 * Trình duyệt không ghi được .skp (định dạng đóng của SketchUp), nên .dae là cầu nối chuẩn: giữ đơn vị mét, trục Z lên,
 * vật liệu có màu + độ đục, mỗi lớp là một nhóm (node) → vào SketchUp thành Group đặt tên.
 * Tòa ghi lồng hai cấp trong `library_nodes` (tòa › tầng) và đặt bằng `instance_node`: SketchUp đọc thành Component dùng lại, tầng giống
 * nhau chỉ giữ một bản hình. `instance_geometry` lặp lại thì SketchUp trải thành hình riêng từng chỗ (tệp 45 MB dựng 85 triệu tam giác).
 * Hàm thuần: nhận lưới đã thu (luoi3d.ts), trả chuỗi XML.
 */
import type { LuoiVL, TangLuoi } from './luoi3d';

/** Một nhóm trong tệp: lưới phẳng (cả dự án) hoặc một tòa đặt theo (x, y, góc) với các tầng giống nhau dùng lại một hình. */
export type NhomDae = { ten: string; luoi: LuoiVL[] } | { ten: string; x: number; y: number; goc: number; tang: TangLuoi[] };
/** `ghiChu`: ghi vào phần đầu tệp (vd gốc toạ độ VN2000 khi đã dời mô hình về gần 0). */
export type TuyChonDae = { ghiChu?: string };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const idAn = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^A-Za-z0-9_.-]+/g, '_');
const mauRgb = (c: number) => `${((c >> 16) & 255) / 255} ${((c >> 8) & 255) / 255} ${(c & 255) / 255}`;
const so = (n: number) => String(Math.round(n * 10000) / 10000);

/** Gộp đỉnh trùng (làm tròn 0,1 mm) → mảng toạ độ + chỉ số tam giác; tam giác suy biến sau làm tròn thì bỏ. */
function chiSoHoa(P: Float32Array): { toaDo: number[]; chiSo: number[] } {
  const bang = new Map<string, number>(), toaDo: number[] = [], chiSo: number[] = [];
  for (let i = 0; i < P.length; i += 3) {
    const x = so(P[i]), y = so(P[i + 1]), z = so(P[i + 2]), k = `${x},${y},${z}`;
    let v = bang.get(k);
    if (v === undefined) { v = bang.size; bang.set(k, v); toaDo.push(+x, +y, +z); }
    chiSo.push(v);
    if (chiSo.length % 3 === 0) {
      const n = chiSo.length, a = chiSo[n - 3], b = chiSo[n - 2], c = chiSo[n - 1];
      if (a === b || b === c || a === c) chiSo.length = n - 3;
    }
  }
  return { toaDo, chiSo };
}

export function taoDae(nhom: NhomDae[], tenDuAn: string, tuy: TuyChonDae = {}): string {
  const hieu = new Map<string, { id: string; ten: string; mau: number; doDuc: number }>();
  const hinh: string[] = [], node: string[] = [], thuVien: string[] = [];
  const hinhId = new Map<string, string>(); // id hình tầng → id geometry (ghi một lần)
  let dem = 0;
  const vl = (l: { khoa: string; ten: string; mau: number; doDuc: number }) => {
    let h = hieu.get(l.khoa);
    if (!h) hieu.set(l.khoa, (h = { id: `vl${hieu.size + 1}`, ten: l.ten, mau: l.mau, doDuc: l.doDuc }));
    return h;
  };
  /** Một định nghĩa trong `library_nodes`, cùng nội dung thì dùng lại; trả id. */
  const nutDung = new Map<string, string>();
  const dinhNghia = (noiDung: string, ten: string, tienTo: string): string => {
    let id = nutDung.get(noiDung);
    if (!id) { id = `${tienTo}${nutDung.size + 1}`; nutDung.set(noiDung, id); thuVien.push(`<node id="${id}" name="${esc(ten)}">${noiDung}</node>`); }
    return id;
  };
  /** Ghi geometry (nếu chưa có) và trả phần tử đặt nó. */
  const dung = (khoaHinh: string, l: { khoa: string; ten: string; mau: number; doDuc: number; P: Float32Array }): string | null => {
    const h = vl(l);
    let gid = hinhId.get(khoaHinh);
    if (!gid) {
      const { toaDo, chiSo } = chiSoHoa(l.P);
      if (chiSo.length < 3) return null;
      gid = `g${++dem}`;
      hinhId.set(khoaHinh, gid);
      hinh.push(
        `<geometry id="${gid}" name="${esc(l.ten)}"><mesh>` +
        `<source id="${gid}-p"><float_array id="${gid}-pa" count="${toaDo.length}">${toaDo.join(' ')}</float_array>` +
        `<technique_common><accessor source="#${gid}-pa" count="${toaDo.length / 3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>` +
        `<vertices id="${gid}-v"><input semantic="POSITION" source="#${gid}-p"/></vertices>` +
        `<triangles material="m" count="${chiSo.length / 3}"><input semantic="VERTEX" source="#${gid}-v" offset="0"/><p>${chiSo.join(' ')}</p></triangles>` +
        `</mesh></geometry>`,
      );
    }
    return `<instance_geometry url="#${gid}"><bind_material><technique_common><instance_material symbol="m" target="#${h.id}-m"/></technique_common></bind_material></instance_geometry>`;
  };
  for (const n of nhom) {
    const con: string[] = [];
    if ('luoi' in n) {
      for (const l of n.luoi) { const x = dung(l.khoa + '#' + con.length + '#' + dem, l); if (x) con.push(`<node name="${esc(l.ten)}">${x}</node>`); }
      if (con.length) node.push(`<node name="${esc(n.ten)}" type="NODE">${con.join('')}</node>`);
      continue;
    }
    for (const t of n.tang) {
      const cc: string[] = [];
      for (const p of t.phan) { const x = dung(p.id, p); if (x) cc.push(x); }
      if (cc.length) con.push(`<node name="${esc(t.ten)}" type="NODE"><translate>0 0 ${so(t.caoDo)}</translate><instance_node url="#${dinhNghia(cc.join(''), `${n.ten} - ${t.ten}`, 'tang')}"/></node>`);
    }
    if (con.length) node.push(`<node name="${esc(n.ten)}" type="NODE"><translate>${so(n.x)} ${so(n.y)} 0</translate><rotate>0 0 1 ${so(n.goc)}</rotate><instance_node url="#${dinhNghia(con.join(''), n.ten, 'toa')}"/></node>`);
  }
  const hieuXml = [...hieu.values()];
  const effects = hieuXml.map((h) =>
    `<effect id="${h.id}-e"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${mauRgb(h.mau)} 1</color></diffuse>` +
    (h.doDuc < 1 ? `<transparent opaque="A_ONE"><color>1 1 1 1</color></transparent><transparency><float>${so(h.doDuc)}</float></transparency>` : '') +
    `</lambert></technique></profile_COMMON></effect>`).join('');
  const mats = hieuXml.map((h) => `<material id="${h.id}-m" name="${esc(h.ten)}"><instance_effect url="#${h.id}-e"/></material>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
<asset><contributor><author>Unitmix</author><authoring_tool>Unitmix (LEO AI)</authoring_tool><comments>${esc([tenDuAn, tuy.ghiChu].filter(Boolean).join(' · '))}</comments></contributor>
<created>${new Date().toISOString()}</created><modified>${new Date().toISOString()}</modified><unit name="meter" meter="1"/><up_axis>Z_UP</up_axis></asset>
<library_effects>${effects}</library_effects>
<library_materials>${mats}</library_materials>
<library_geometries>${hinh.join('')}</library_geometries>
${thuVien.length ? `<library_nodes>${thuVien.join('')}</library_nodes>
` : ''}<library_visual_scenes><visual_scene id="canh" name="${esc(idAn(tenDuAn) || 'Unitmix')}">${node.join('')}</visual_scene></library_visual_scenes>
<scene><instance_visual_scene url="#canh"/></scene>
</COLLADA>
`;
}
