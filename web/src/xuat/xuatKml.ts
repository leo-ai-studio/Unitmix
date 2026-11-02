/**
 * Xuất KML cho Google Earth (web / Pro): ranh lô, chỉ giới xây dựng và khối tòa (đùn lên theo chiều cao) tại đúng vị trí đã đặt
 * trong hộp Vị trí · Nắng · Gió. Dữ liệu của chính dự án, không lấy ảnh nền Google. Hàm thuần — tải tệp ở `taiKml`.
 */
import { mauToa } from '../tinh/canThem';
import { chanToa } from '../tinh/hinhHoc';
import type { Diem, ThuVien, TrangThaiPA } from '../tinh/kieu';
import { banVeSangLl, viTriPA, type ViTri } from '../tinh/viTri';
import { taiVeTep } from './taiTep';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Vòng toạ độ KML "kinh,vĩ,cao" (khép kín). */
function vong(p: Diem[], v: ViTri, cao: number): string {
  const ds = p.map((q) => { const ll = banVeSangLl(q, v); return `${ll.lng.toFixed(8)},${ll.lat.toFixed(8)},${cao}`; });
  ds.push(ds[0]);
  return ds.join(' ');
}

function dagiac(ten: string, kieu: string, p: Diem[], v: ViTri, cao: number, moTa?: string): string {
  if (p.length < 3) return '';
  const dh = cao > 0 ? '<extrude>1</extrude><altitudeMode>relativeToGround</altitudeMode>' : '<altitudeMode>clampToGround</altitudeMode>';
  return `<Placemark><name>${esc(ten)}</name>${moTa ? `<description>${esc(moTa)}</description>` : ''}<styleUrl>#${kieu}</styleUrl>`
    + `<Polygon>${dh}<outerBoundaryIs><LinearRing><coordinates>${vong(p, v, cao)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
}

/** Chuỗi KML; null nếu PA chưa đặt toạ độ thật (không có chỗ để neo lên Google Earth). */
export function taoKml(pa: TrangThaiPA, tv: ThuVien | null, ten: string): string | null {
  const v = viTriPA(pa);
  if (!v.coToaDo) return null;
  const lo = pa.lo.map((l, i) => dagiac(`Lô ${i + 1}`, 'ranh', l.ranh, v, 0)
    + (l.chiGioi ? dagiac(`Chỉ giới lô ${i + 1}`, 'chiGioi', l.chiGioi, v, 0) : '')).join('');
  const toa = tv ? pa.toa.map((x, i) => {
    const m = mauToa(tv, x);
    if (!m) return '';
    const cao = x.soTangDe * x.caoDe + x.soTangDH * x.caoDH;
    return dagiac(`Tòa ${i + 1}`, 'toa', chanToa(m, x), v, +cao.toFixed(2), `${x.soTangDe + x.soTangDH} tầng · cao ${cao.toFixed(1)} m`);
  }).join('') : '';
  const kieu = (id: string, vien: string, nen: string, w: number) => `<Style id="${id}"><LineStyle><color>${vien}</color><width>${w}</width></LineStyle><PolyStyle><color>${nen}</color><fill>${nen === '00ffffff' ? 0 : 1}</fill></PolyStyle></Style>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(ten)}</name>`
    + kieu('ranh', 'ff00ffff', '00ffffff', 2) + kieu('chiGioi', 'ff0000ff', '00ffffff', 2) + kieu('toa', 'ffffffff', 'b3d9b48a', 1)
    + `<Folder><name>Lô &amp; chỉ giới</name>${lo}</Folder><Folder><name>Tòa</name>${toa}</Folder></Document></kml>\n`;
}

export function taiKml(pa: TrangThaiPA, tv: ThuVien | null, ten: string): boolean {
  const k = taoKml(pa, tv, ten);
  if (!k) return false;
  taiVeTep(k, `${ten.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Unitmix'}.kml`, 'application/vnd.google-earth.kml+xml');
  return true;
}
