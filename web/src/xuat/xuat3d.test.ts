import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { taoLo, taoPAMoi } from '../tinh/macDinh';
import type { ToaDat, TrangThaiPA } from '../tinh/kieu';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import { unzipSync, strFromU8 } from 'fflate';
import { dichPA, gocDuAn, xuat3d, type KetQua3d } from './xuat3d';

const lib = new URL('../../public/lib/', import.meta.url);
const fetchGoc = globalThis.fetch;
beforeAll(() => {
  // `tai` đọc /lib/... bằng fetch: trả tệp thư viện trên đĩa
  globalThis.fetch = (async (u: string) => {
    const f = new URL(String(u).replace(/^\//, ''), new URL('../../public/', import.meta.url));
    return existsSync(fileURLToPath(f)) ? new Response(readFileSync(f), { status: 200 }) : new Response('', { status: 404 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = fetchGoc; void lib; });

function paThu(): { pa: TrangThaiPA; tv: ReturnType<typeof napThuVien>['tv'] } {
  const { tv } = napThuVien();
  const mk = (id: string, mauId: string, x: number, y: number, goc: number, lat = false): ToaDat => ({ ...toaThu(mauId, 12), id, loId: 'L', x, y, gocDo: goc, lat });
  const pa: TrangThaiPA = { ...taoPAMoi(), lo: [taoLo('L', 'CT-1', 'tm', [[0, 0], [400, 0], [400, 300], [0, 300]])], toa: [mk('t1', 'tm-v1', 120, 150, 30), mk('t2', 'tm-i1', 300, 150, 0, true)] };
  return { pa, tv };
}

/** Các tệp trong kết quả, theo tên. */
function cacTep(r: KetQua3d): Record<string, string> {
  if (typeof r.noiDung === 'string') return { [r.tenTep]: r.noiDung };
  return Object.fromEntries(Object.entries(unzipSync(r.noiDung)).map(([k, v]) => [k, strFromU8(v)]));
}

describe('xuất 3D / BIM', () => {
  it('DAE theo mẫu: mỗi mẫu một tệp, đơn vị mét, Z lên, có kính, tầng giống nhau chỉ đặt lại component', async () => {
    const { pa, tv } = paThu();
    const r = await xuat3d('dae-mau', { pa, tv, tenDuAn: 'Thử M7' });
    expect(r.soToa).toBe(2);
    expect(r.soTep).toBe(2);
    expect(r.tenTep.endsWith('.zip')).toBe(true);
    expect(r.soTamGiac).toBeGreaterThan(5000);
    const tep = cacTep(r), ds = Object.keys(tep).filter((k) => k.endsWith('.dae')).map((k) => tep[k]);
    expect(Object.keys(tep)).toContain('unitmix_dat_ten.rb');
    expect(ds).toHaveLength(2);
    for (const s of ds) {
      expect(s).toContain('<up_axis>Z_UP</up_axis>');
      expect(s).toMatch(/<unit name="meter" meter="1"\/>/);
      expect(s).toContain('name="Kinh"');
      // tòa 12 tầng: nhiều tầng đặt lại, ít định nghĩa tầng; hình chỉ gắn trong library_nodes
      const lanDat = (s.match(/<instance_node /g) ?? []).length, dinhNghia = (s.match(/<node id="tang/g) ?? []).length;
      expect(lanDat).toBeGreaterThan(dinhNghia * 2);
      expect(s.slice(s.indexOf('<library_visual_scenes>'))).not.toContain('<instance_geometry');
      for (const m of s.matchAll(/url="#((?:tang|toa)\d+)"/g)) expect(s, m[1]).toContain(`<node id="${m[1]}"`);
    }
  }, 120000);
  it('một mẫu thì tải thẳng một tệp, hai tòa cùng bố cục (một tòa lật) gộp thành một', async () => {
    const { pa, tv } = paThu();
    const p2 = { ...pa, toa: [pa.toa[0], { ...pa.toa[0], id: 't3', lat: true, x: 200 }] };
    const r = await xuat3d('dae-mau', { pa: p2, tv, tenDuAn: 'Thử M7' });
    expect(r.soTep).toBe(1);
    expect(r.tenTep.endsWith('.dae')).toBe(true);
    expect((r.noiDung as string).match(/<rotate>0 0 1 /g)).toHaveLength(1);
    expect(r.noiDung).toContain('(2 toa, 12T)');
  }, 120000);
  it('xuất riêng một tòa: giữ vị trí, góc theo gốc tệp tổng thể', async () => {
    const { pa, tv } = paThu();
    const r = await xuat3d('dae-mau', { pa, tv, tenDuAn: 'Thử M7', chiToa: ['t2'] });
    const g = gocDuAn(pa), s = r.noiDung as string;
    expect(r.soTep).toBe(1);
    expect(s).toContain(`<translate>${300 - g[0]} ${150 - g[1]} 0</translate>`);
  }, 120000);
  it('gói BIM: có .bim.json và đúng tệp .dxf của Xuất CAD kèm gốc toạ độ', async () => {
    const { pa, tv } = paThu();
    const r = await xuat3d('bim-mau', { pa, tv, tenDuAn: 'Thử M7' });
    const ds = cacTep(r), json = Object.keys(ds).filter((k) => k.endsWith('.bim.json'));
    expect(json).toHaveLength(2);
    expect(Object.keys(ds).some((k) => k.endsWith('unitmix_dung_bim.py'))).toBe(true);
    for (const k of json) {
      const g = JSON.parse(ds[k]), dxf = ds[k.replace('.bim.json', '.dxf')];
      expect(dxf).toContain('MDI-BAO');
      expect(dxf).toContain('A-WALL');
      expect(g.gocCad).toHaveLength(2);
      const dh = g.boCuc.find((b: { id: string }) => b.id === 'dh');
      expect(dh.tuong.length).toBeGreaterThan(50);
      expect(dh.cua.length).toBeGreaterThan(10);
      expect(g.tang.filter((t: { loai: string }) => t.loai === 'dien_hinh')).toHaveLength(12);
    }
  }, 120000);
  it('IFC theo mẫu: đủ phần đầu, một IfcBuilding, có tầng + tường + sàn + kính, chỉ số tam giác trong phạm vi', async () => {
    const { pa, tv } = paThu();
    const r = await xuat3d('ifc-mau', { pa: { ...pa, toa: [pa.toa[0]] }, tv, tenDuAn: 'Thử M7' });
    const s = r.noiDung as string;
    expect(s.startsWith('ISO-10303-21;')).toBe(true);
    expect(s.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true);
    expect((s.match(/=IFCBUILDING\(/g) ?? []).length).toBe(1);
    expect((s.match(/=IFCBUILDINGSTOREY\(/g) ?? []).length).toBeGreaterThan(10);
    for (const k of ['IFCWALL', 'IFCSLAB', 'IFCPLATE', 'IFCTRIANGULATEDFACESET']) expect(s).toContain(`=${k}(`);
    // mọi tham chiếu #n tồn tại; chỉ số mặt trong 1..số điểm
    const co = new Set([...s.matchAll(/^#(\d+)=/gm)].map((m) => m[1]));
    for (const m of s.matchAll(/#(\d+)/g)) expect(co.has(m[1]), `#${m[1]}`).toBe(true);
    for (const m of s.matchAll(/IFCCARTESIANPOINTLIST3D\(\((.*?)\)\);\n#\d+=IFCTRIANGULATEDFACESET\(#\d+,\$,\$,\((.*?)\),\$\)/gs)) {
      const n = (m[1].match(/\(/g) ?? []).length, mx = Math.max(...[...m[2].matchAll(/\d+/g)].map((x) => +x[0]));
      expect(mx).toBeLessThanOrEqual(n);
    }
  }, 120000);
  it('DAE tổng thể dựng được, không cây', async () => {
    const { pa, tv } = paThu();
    const r = await xuat3d('dae-du-an', { pa, tv, tenDuAn: 'Thử M7' });
    expect(r.soTamGiac).toBeGreaterThan(100);
    expect(r.noiDung).toContain('<library_geometries>');
  }, 120000);
  it('DAE tổng thể ở toạ độ VN2000: dời về gần gốc, giữ đúng cm, ghi gốc trong tệp', async () => {
    const { pa, tv } = paThu();
    const X = 590531.71, Y = 2326992.56, xa = dichPA(pa, -X, -Y);
    const goc = gocDuAn(xa);
    expect(goc[0] % 10).toBe(0);
    const r = await xuat3d('dae-du-an', { pa: xa, tv, tenDuAn: 'Thử M7' });
    expect(r.goc).toEqual(goc);
    const s = r.noiDung as string;
    expect(s).toContain(`Goc (0,0) = VN2000 X ${goc[0]}, Y ${goc[1]}`);
    const xs = [...s.matchAll(/<float_array[^>]*>([^<]*)</g)].flatMap((m) => m[1].split(' ').map(Number));
    expect(Math.max(...xs.map(Math.abs))).toBeLessThan(1000);
    // ranh lô (0, 0)…: sau khi dời phải còn đúng đến mm, Float32 ở toạ độ gốc sẽ lệch 6–25 cm
    const k = xs.findIndex((v, i) => i % 3 === 0 && Math.abs(v - (X - goc[0])) < 0.002 && Math.abs(xs[i + 1] - (Y - goc[1])) < 0.002);
    expect(k).toBeGreaterThanOrEqual(0);
  }, 120000);
});
