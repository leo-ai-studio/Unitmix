import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { taoLo, taoPAMoi } from '../tinh/macDinh';
import type { ToaDat, TrangThaiPA } from '../tinh/kieu';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import { xuat3d } from './xuat3d';

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

describe('xuất 3D / BIM', () => {
  it('DAE công trình: XML hợp lệ, đơn vị mét, Z lên, có kính, mỗi tòa một nhóm', async () => {
    const { pa, tv } = paThu();
    const r = await xuat3d('dae-cong-trinh', { pa, tv, tenDuAn: 'Thử M7' });
    expect(r.soToa).toBe(2);
    expect(r.soTamGiac).toBeGreaterThan(5000);
    expect(r.noiDung).toContain('<up_axis>Z_UP</up_axis>');
    expect(r.noiDung).toMatch(/<unit name="meter" meter="1"\/>/);
    expect(r.noiDung).toContain('name="Kinh"');
    expect((r.noiDung.match(/<rotate>0 0 1 /g) ?? []).length).toBe(2);
    console.log('DAE công trình', r.tenTep, (r.noiDung.length / 1e6).toFixed(1), 'MB', r.soTamGiac, 'tam giác');
  }, 120000);
  it('IFC: đủ phần đầu, mỗi tòa một IfcBuilding, có tầng + tường + sàn + kính, chỉ số tam giác trong phạm vi', async () => {
    const { pa, tv } = paThu();
    const r = await xuat3d('ifc', { pa, tv, tenDuAn: 'Thử M7' });
    const s = r.noiDung;
    expect(s.startsWith('ISO-10303-21;')).toBe(true);
    expect(s.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true);
    expect((s.match(/=IFCBUILDING\(/g) ?? []).length).toBe(2);
    expect((s.match(/=IFCBUILDINGSTOREY\(/g) ?? []).length).toBeGreaterThan(20);
    for (const k of ['IFCWALL', 'IFCSLAB', 'IFCPLATE', 'IFCTRIANGULATEDFACESET']) expect(s).toContain(`=${k}(`);
    // mọi tham chiếu #n tồn tại; chỉ số mặt trong 1..số điểm
    const co = new Set([...s.matchAll(/^#(\d+)=/gm)].map((m) => m[1]));
    for (const m of s.matchAll(/#(\d+)/g)) expect(co.has(m[1]), `#${m[1]}`).toBe(true);
    for (const m of s.matchAll(/IFCCARTESIANPOINTLIST3D\(\((.*?)\)\);\n#\d+=IFCTRIANGULATEDFACESET\(#\d+,\$,\$,\((.*?)\),\$\)/gs)) {
      const n = (m[1].match(/\(/g) ?? []).length, mx = Math.max(...[...m[2].matchAll(/\d+/g)].map((x) => +x[0]));
      expect(mx).toBeLessThanOrEqual(n);
    }
    console.log('IFC', r.tenTep, (s.length / 1e6).toFixed(1), 'MB', r.soTamGiac, 'tam giác');
  }, 120000);
  it('DAE toàn dự án (3D TMB) dựng được, không cây', async () => {
    const { pa, tv } = paThu();
    const r = await xuat3d('dae-du-an', { pa, tv, tenDuAn: 'Thử M7' });
    expect(r.soTamGiac).toBeGreaterThan(100);
    expect(r.noiDung).toContain('<library_geometries>');
    console.log('DAE TMB', (r.noiDung.length / 1e6).toFixed(2), 'MB', r.soTamGiac, 'tam giác');
  }, 120000);
});
