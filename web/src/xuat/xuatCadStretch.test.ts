import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import DxfParser from 'dxf-parser';
import { taoThuVien, type CanMau } from '../tinh/kieu';
import { viTriCan, type NetVe, type ToaCoMat } from '../tinh/matBang';
import { idTepCan, laBienThe, maBienThe, themBienThe, veTheoId } from '../tinh/stretch';
import { danhSachChen, diemThe, taoDxf, taoScr, type DuLieuXuat } from './xuatCad';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaCoMat[]>('toa.json');
const tvK = themBienThe(taoThuVien(toaDs, doc<CanMau[]>('can.json')));

describe('xuất CAD căn STRETCH (DC-04 · QT-81)', () => {
  const mauK = toaDs.find((x) => x.id === 'tm-u2')!;
  const vK = viTriCan(mauK, tvK);
  // nét căn đủ: tệp chính + nội thất tách riêng (scripts/sinh_phai_sinh_can.py), như hộp xuất CAD tải
  const veK = (id: string) => veTheoId(id, [...doc<{ ve: NetVe[] }>(`can/${idTepCan(id)}.json`).ve, ...doc<{ ve: NetVe[] }>(`can/${idTepCan(id)}.noithat.json`).ve], tvK);
  // hai căn khác mẫu kéo +300 và −300: tên block không trùng nhau, không trùng mẫu gốc
  const g = vK.find((v) => tvK.can.get(v.canGocId)?.stretch)!;
  const idP = maBienThe(g.canGocId, 300);
  const g2 = vK.find((v) => v.khoa !== g.khoa && v.canGocId !== g.canGocId && tvK.can.get(v.canGocId)?.stretch)!;
  const toa: DuLieuXuat['toa'] = { canTheo: {}, canViTri: { [g.khoa]: idP, [g2.khoa]: maBienThe(g2.canGocId, -300) } };
  const hinh = new Map<string, NetVe[]>();
  for (const it of danhSachChen({ mau: mauK, toa, tv: tvK, ten: '', goc: '', hinh: new Map() })) if (it.no) hinh.set(it.no, veK(it.no));
  const d: DuLieuXuat = { mau: mauK, toa, tv: tvK, ten: 'Toa keo', goc: './xref', hinh };

  it('danh sách chèn mang đúng bề rộng đã kéo', () => {
    const it = danhSachChen(d).find((x) => x.no === idP)!;
    expect(it.rong).toBe(tvK.can.get(g.canGocId)!.rong_mm + 300);
  });
  it('.dxf: mỗi mức kéo là một BLOCK riêng (không trùng tên), nét đã kéo chứ không phải nét mẫu gốc', () => {
    const dxf = new DxfParser().parseSync(taoDxf(d))!;
    const ten = Object.keys(dxf.blocks);
    expect(ten.some((n) => /_SP300$/.test(n))).toBe(true);
    expect(ten.some((n) => /_SM300$/.test(n))).toBe(true);
    expect(new Set(ten).size).toBe(ten.length);
    const goc = tvK.can.get(g.canGocId)!;
    const bk = dxf.blocks[ten.find((n) => /_SP300$/.test(n) && n.includes(g.canGocId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')))!];
    const xs = (bk.entities as { vertices?: { x: number }[] }[]).flatMap((e) => (e.vertices ?? []).map((v) => v.x));
    const x0 = Math.max(...doc<{ ve: NetVe[] }>(`can/${goc.id}.json`).ve.flatMap((n) => n.pts.map((p) => p[0] * goc.rong_mm)));
    // nét có x > x_cắt dời +300: cực đại x lớn hơn mẫu gốc đúng 300
    expect(Math.max(...xs)).toBeGreaterThan(x0 + 250);
    expect(Math.max(...xs)).toBeLessThanOrEqual(x0 + 300 + 1);
    const ent = dxf.entities as { type: string }[];
    expect(ent.filter((e) => e.type === 'INSERT').length).toBe(danhSachChen(d).filter((x) => x.loai === 'can').length);
  });
  it('.scr: căn STRETCH không XREF mà vẽ nét đã kéo lên lớp A-*, XREF còn lại đủ, ASCII', () => {
    const s = taoScr(d), ds = danhSachChen(d), keo = ds.filter((x) => x.no && laBienThe(x.no));
    expect(keo).toHaveLength(2);
    expect(s.match(/_-XREF/g)!.length).toBe(ds.length - keo.length);
    expect(s).not.toMatch(/"[^"\r\n]*~s[^"\r\n]*"/); // không có đường dẫn XREF tới tệp biến thể
    expect(s).toContain('_.PLINE');
    expect(s).toContain('A-WALL');
    expect(s).toMatch(/can STRETCH/);
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(s)).toBe(true);
    const it = keo[0], n = hinh.get(it.no!)!.find((x) => x.cat === 'wall')!;
    const w = diemThe(it, n.pts[0][0] * it.rong, n.pts[0][1] * it.sau);
    expect(s).toContain(`${w[0].toFixed(4)},${w[1].toFixed(4)}`);
  });
  it('không có căn kéo: .scr không thêm lớp A-* hay PLINE căn', () => {
    const d0: DuLieuXuat = { ...d, toa: { canTheo: {} } };
    for (const it of danhSachChen(d0)) if (it.no) d0.hinh.set(it.no, veK(it.no));
    const s = taoScr(d0);
    expect(s).not.toContain('A-WALL');
    expect(s).not.toMatch(/can STRETCH/);
  });
});
