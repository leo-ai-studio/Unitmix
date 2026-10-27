import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import DxfParser from 'dxf-parser';
import { taoThuVien, type CanMau, type Diem } from '../tinh/kieu';
import type { NetVe, ToaCoMat } from '../tinh/matBang';
import { danhSachChen, duongXref, khungCatCan, lenhXclip, LOP_NHAN_CAN, nhanCanDxf, taoDxf, taoScr, type DuLieuXuat } from './xuatCad';

const lib = new URL('../../public/lib/', import.meta.url);
const cad = new URL('../../../cad/xref/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<(ToaCoMat & { duong_bao: Diem[]; hanhlang_ve: Diem[][] })[]>('toa.json');
const tv = taoThuVien(toaDs, doc<CanMau[]>('can.json'));
const veCan = (id: string) => doc<{ ve: NetVe[] }>(`can/${id}.json`).ve;

const du = (id: string): DuLieuXuat => {
  const mau = toaDs.find((t) => t.id === id)!;
  const hinh = new Map<string, NetVe[]>();
  for (const c of tv.can.values()) hinh.set(c.id, veCan(c.id));
  return { mau, toa: { canTheo: {} }, tv, ten: 'Toa ' + id, goc: './xref', hinh };
};
const coFile = (p: string) => existsSync(new URL(p.replace('./xref/', ''), cad));

describe('xuất CAD', () => {
  it('mọi mẫu tòa: số lượt chèn căn = số căn/tầng, tệp XREF căn có trong thư viện CAD', () => {
    for (const t of toaDs) {
      const ds = danhSachChen(du(t.id));
      const can = ds.filter((x) => x.loai === 'can');
      expect(can.length, t.id).toBe(t.so_can_tang);
      for (const c of can) expect(coFile(duongXref('can', c.ten, './xref')!), `${t.id} ${c.ten}`).toBe(true);
    }
  });
  it('lõi / thang bộ có tệp XREF (liệt kê tệp thiếu nếu có)', () => {
    const thieu = new Set<string>();
    for (const t of toaDs) for (const x of danhSachChen(du(t.id))) if (x.loai !== 'can' && !coFile(duongXref(x.loai, x.ten, './xref')!)) thieu.add(x.ten);
    expect([...thieu]).toEqual([]);
  });
  it('.scr: SAVEAS trước XREF đầu tiên, ASCII thuần, đủ lượt attach và XCLIP cho căn', () => {
    const d = du('tm-u2'), s = taoScr(d), ds = danhSachChen(d);
    expect(s.indexOf('_SAVEAS')).toBeGreaterThan(-1);
    expect(s.indexOf('_SAVEAS')).toBeLessThan(s.indexOf('_-XREF'));
    expect(s.match(/_-XREF/g)!.length).toBe(ds.length);
    expect(s.match(/_\.XCLIP/g)!.length).toBe(ds.filter((x) => x.loai === 'can').length);
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(s)).toBe(true);
    expect(s).toContain('"./xref/x-canho-bt/');
    expect(s).toContain('INSUNITS\r\n4');
  });
  it('XCLIP: căn song song trục dùng hình chữ nhật thế giới; căn lệch trục (tòa Y 30°) xoay UCS', () => {
    const base = { loai: 'can', ten: 'x', x: 1000, y: 2000, sx: 1, sy: 1, rong: 5000, sau: 8500 };
    expect(lenhXclip({ ...base, rot: 90 })).not.toContain('UCS');
    expect(lenhXclip({ ...base, rot: 30 })).toContain('"_.UCS"');
    expect(lenhXclip({ ...base, loai: 'thang_bo', rot: 0 })).toBeNull();
  });
  it('khung cắt căn V mở rộng theo nét khung', () => {
    const k: NetVe[] = [{ cat: 'khung', pts: [[0, 0], [1.3, 0], [1.3, 1], [-0.1, 1.2]] }];
    expect(khungCatCan(k, 1000, 1000)).toEqual([-100, 0, 1300, 1200]);
    expect(khungCatCan([], 1000, 1000)).toBeNull();
  });
  it('.dxf đọc lại được: đủ INSERT căn, BLOCK theo mẫu căn, nét bao DTXD', () => {
    const d = du('tm-u2'), ds = danhSachChen(d).filter((x) => x.loai === 'can');
    const dxf = new DxfParser().parseSync(taoDxf(d))!;
    const ent = dxf.entities as { type: string; layer: string }[];
    expect(ent.filter((e) => e.type === 'INSERT').length).toBe(ds.length);
    expect(Object.keys(dxf.blocks).length).toBe(new Set(ds.map((x) => x.no)).size);
    expect(ent.some((e) => e.layer === 'MDI-BAO')).toBe(true);
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(taoDxf(d))).toBe(true);
  });
});

describe('nhãn phòng trong DXF', () => {
  it('mỗi căn có 2 TEXT (tên mẫu + DT thông thủy) trên lớp nhãn', () => {
    const d = du('tm-u2'), n = danhSachChen(d).filter((x) => x.loai === 'can').length;
    const nh = nhanCanDxf(d);
    expect(nh).toHaveLength(n);
    for (const x of nh) {
      expect(Number.isFinite(x.x) && Number.isFinite(x.y)).toBe(true);
      expect(x.dt).toMatch(/^\d+\.\d m2$/);
      expect(/^[\x20-\x7e]+$/.test(x.ten)).toBe(true);
    }
    const dxf = new DxfParser().parseSync(taoDxf(d))!;
    const chu = (dxf.entities as { type: string; layer: string; text?: string }[]).filter((e) => e.type === 'TEXT' && e.layer === LOP_NHAN_CAN);
    expect(chu).toHaveLength(2 * n);
    expect(chu.some((e) => /m2$/.test(e.text ?? ''))).toBe(true);
    expect(dxf.tables.layer.layers[LOP_NHAN_CAN]).toBeDefined();
  });
});
