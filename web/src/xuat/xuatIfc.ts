/**
 * Xuất mô hình BIM ra IFC4 (.ifc) — Revit nhập trực tiếp (Chèn › Liên kết IFC, hoặc Mở tệp IFC).
 * Mỗi tòa là một IfcBuilding (gốc toạ độ = điểm đặt tòa trên lô, trục Z lên, mét), chia IfcBuildingStorey theo tầng, mỗi tầng một
 * cấu kiện cho mỗi nhóm vật liệu (tường → IfcWall, sàn → IfcSlab, kính → IfcPlate, khung nhôm → IfcMember, lan can → IfcRailing, còn lại
 * IfcBuildingElementProxy) với hình học IfcTriangulatedFaceSet (Reference View) + màu / độ đục (IfcSurfaceStyle). Chỉ gồm các tòa
 * (không có 3D quy hoạch: ô đất, đường, cây). Hàm thuần: nhận lưới đã thu (luoi3d.ts), trả chuỗi STEP.
 */
import type { PhanTang, TangLuoi } from './luoi3d';

export type ToaIfc = {
  ten: string;
  /** Điểm đặt tòa trên lô (m, toạ độ dự án) và góc xoay quanh trục đứng (độ, ngược chiều kim đồng hồ nhìn từ trên). */
  x: number; y: number; goc: number;
  /** Tầng theo cao độ tăng dần (m, tính từ mặt đất tòa); hình mỗi tầng tính từ mặt tầng, tầng giống nhau dùng chung một hình (IfcMappedItem). */
  tang: TangLuoi[];
};

const BANG64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
/** GlobalId 22 ký tự (nén 128 bit theo bảng IFC). */
export function guidIfc(): string {
  const b = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  let s = '';
  for (let i = 0; i < 22; i++) { s = BANG64[Number(n & 63n)] + s; n >>= 6n; }
  return s;
}

const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const chu = (s: string) => `'${boDau(s).replace(/[^\x20-\x7e]/g, '?').replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
const r = (n: number) => { const s = (Math.round(n * 10000) / 10000).toFixed(4); return s.replace(/0+$/, '').replace(/\.$/, '.0'); };
const rgb = (c: number): [number, number, number] => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

/** Lớp IFC theo tên vật liệu. */
function lopIfc(ten: string): string {
  if (/^(Tuong|Khoi-de|Tum|Loi-tum)/.test(ten)) return 'IFCWALL';
  if (/^San/.test(ten)) return 'IFCSLAB';
  if (/^Kinh/.test(ten)) return 'IFCPLATE';
  if (/^Khung/.test(ten)) return 'IFCMEMBER';
  if (/^Lan-can/.test(ten)) return 'IFCRAILING';
  return 'IFCBUILDINGELEMENTPROXY';
}
const nhanVN: Record<string, string> = { Tuong: 'Tuong', 'Khoi-de': 'Khoi de', Tum: 'Tum', 'Loi-tum': 'Loi - tum', San: 'San', 'San-mo': 'San (mo)', Kinh: 'Kinh', 'Kinh-dai': 'Kinh (dai cua)', 'Khung-nhom': 'Khung nhom', 'Lan-can': 'Lan can', Lover: 'Lover', Go: 'Go' };

export function taoIfc(toas: ToaIfc[], tenDuAn: string, tenTep = 'Unitmix.ifc'): string {
  const dong: string[] = [];
  let id = 0;
  const e = (noiDung: string): number => { dong.push(`#${++id}=${noiDung};`); return id; };
  const toaDo3 = (x: number, y: number, z: number) => e(`IFCCARTESIANPOINT((${r(x)},${r(y)},${r(z)}))`);

  const goc = toaDo3(0, 0, 0);
  const truc = e(`IFCAXIS2PLACEMENT3D(#${goc},$,$)`);
  const ctx = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${truc},$)`);
  const ctxCon = e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#${ctx},$,.MODEL_VIEW.,$)`);
  const don = [e('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'), e('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'), e('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'), e('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)')];
  const donVi = e(`IFCUNITASSIGNMENT((${don.map((x) => '#' + x).join(',')}))`);
  const duAn = e(`IFCPROJECT('${guidIfc()}',$,${chu(tenDuAn)},$,$,$,$,(#${ctx}),#${donVi})`);
  const datGoc = e(`IFCLOCALPLACEMENT($,#${truc})`);
  const site = e(`IFCSITE('${guidIfc()}',$,${chu(tenDuAn + ' - Site')},$,$,#${datGoc},$,$,.ELEMENT.,$,$,$,$,$)`);
  e(`IFCRELAGGREGATES('${guidIfc()}',$,$,$,#${duAn},(#${site}))`);

  const kieuNho = new Map<string, number>();
  const kieu = (l: PhanTang): number => {
    let k = kieuNho.get(l.khoa);
    if (k === undefined) {
      const [rr, gg, bb] = rgb(l.mau);
      const mauId = e(`IFCCOLOURRGB($,${r(rr)},${r(gg)},${r(bb)})`);
      const hienThi = e(`IFCSURFACESTYLERENDERING(#${mauId},${r(1 - l.doDuc)},$,$,$,$,$,$,.NOTDEFINED.)`);
      k = e(`IFCSURFACESTYLE(${chu(nhanVN[l.ten] ?? l.ten)},.BOTH.,(#${hienThi}))`);
      kieuNho.set(l.khoa, k);
    }
    return k;
  };

  // hình dùng chung: mỗi hình tầng ghi một lần (IfcRepresentationMap), các tầng / tòa giống nhau chỉ tham chiếu
  const banDo = new Map<string, number>();
  const opId = e(`IFCCARTESIANTRANSFORMATIONOPERATOR3D($,$,#${goc},1.,$)`);
  const hinhChung = (p: PhanTang): number | null => {
    let m = banDo.get(p.id);
    if (m !== undefined) return m;
    const bang = new Map<string, number>(), pts: string[] = [], tam: string[] = [];
    const dinh = (x: number, y: number, z: number) => {
      const kk = `${r(x)},${r(y)},${r(z)}`;
      let v = bang.get(kk);
      if (v === undefined) { v = bang.size + 1; bang.set(kk, v); pts.push(`(${kk})`); }
      return v;
    };
    for (let i = 0; i + 8 < p.P.length; i += 9) {
      const a = dinh(p.P[i], p.P[i + 1], p.P[i + 2]), b = dinh(p.P[i + 3], p.P[i + 4], p.P[i + 5]), c = dinh(p.P[i + 6], p.P[i + 7], p.P[i + 8]);
      if (a !== b && b !== c && a !== c) tam.push(`(${a},${b},${c})`);
    }
    if (!tam.length) return null;
    const ds3 = e(`IFCCARTESIANPOINTLIST3D((${pts.join(',')}))`);
    const mat = e(`IFCTRIANGULATEDFACESET(#${ds3},$,$,(${tam.join(',')}),$)`);
    e(`IFCSTYLEDITEM(#${mat},(#${kieu(p)}),$)`);
    const hinh = e(`IFCSHAPEREPRESENTATION(#${ctxCon},'Body','Tessellation',(#${mat}))`);
    m = e(`IFCREPRESENTATIONMAP(#${truc},#${hinh})`);
    banDo.set(p.id, m);
    return m;
  };

  const toaId: number[] = [];
  for (const toa of toas) {
    const rad = (toa.goc * Math.PI) / 180;
    const truc3 = e(`IFCAXIS2PLACEMENT3D(#${toaDo3(toa.x, toa.y, 0)},$,#${e(`IFCDIRECTION((${r(Math.cos(rad))},${r(Math.sin(rad))},0.))`)})`);
    const datToa = e(`IFCLOCALPLACEMENT(#${datGoc},#${truc3})`);
    const nha = e(`IFCBUILDING('${guidIfc()}',$,${chu(toa.ten)},$,$,#${datToa},$,$,.ELEMENT.,$,$,$)`);
    toaId.push(nha);
    const dsTang: number[] = [];
    toa.tang.forEach((t) => {
      const datTang = e(`IFCLOCALPLACEMENT(#${datToa},#${e(`IFCAXIS2PLACEMENT3D(#${toaDo3(0, 0, t.caoDo)},$,$)`)})`);
      const tangId = e(`IFCBUILDINGSTOREY('${guidIfc()}',$,${chu(t.ten)},$,$,#${datTang},$,$,.ELEMENT.,${r(t.caoDo)})`);
      dsTang.push(tangId);
      const cauKien: number[] = [];
      for (const p of t.phan) {
        const m = hinhChung(p);
        if (m === null) continue;
        const item = e(`IFCMAPPEDITEM(#${m},#${opId})`);
        const hinh = e(`IFCSHAPEREPRESENTATION(#${ctxCon},'Body','MappedRepresentation',(#${item}))`);
        const sp = e(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${hinh}))`);
        const dat = e(`IFCLOCALPLACEMENT(#${datTang},#${truc})`);
        const lop = lopIfc(p.ten);
        cauKien.push(e(`${lop}('${guidIfc()}',$,${chu(`${nhanVN[p.ten] ?? p.ten} - ${t.ten}`)},$,$,#${dat},#${sp},$,.NOTDEFINED.)`));
      }
      if (cauKien.length) e(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guidIfc()}',$,$,$,(${cauKien.map((x) => '#' + x).join(',')}),#${tangId})`);
    });
    if (dsTang.length) e(`IFCRELAGGREGATES('${guidIfc()}',$,$,$,#${nha},(${dsTang.map((x) => '#' + x).join(',')}))`);
  }
  if (toaId.length) e(`IFCRELAGGREGATES('${guidIfc()}',$,$,$,#${site},(${toaId.map((x) => '#' + x).join(',')}))`);

  const ngay = new Date().toISOString().slice(0, 19);
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');
FILE_NAME(${chu(tenTep)},'${ngay}',('Unitmix'),('LEO AI'),'Unitmix','Unitmix','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
${dong.join('\n')}
ENDSEC;
END-ISO-10303-21;
`;
}
