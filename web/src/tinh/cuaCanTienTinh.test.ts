import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CanMau } from './kieu';
import type { NetVe } from './matBang';
import { tinhCuaCan } from './pccc';
import { NET_NOI_THAT } from '../ve/kieuMb';

// Dữ liệu phái sinh của scripts/sinh_phai_sinh_can.py (de_xuat_hieu_nang P3): cua_x trong can.json và tệp nội thất tách riêng.
const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(f: string): T => JSON.parse(readFileSync(new URL(f, lib), 'utf8')) as T;
const canDs = doc<CanMau[]>('can.json');

describe('tim cửa tiền tính trong can.json', () => {
  it('mọi mẫu căn có cua_x = tinhCuaCan(nét căn) (chạy lại scripts/sinh_phai_sinh_can.py nếu lệch)', () => {
    for (const c of canDs) {
      const ve = doc<{ ve: NetVe[] }>(`can/${c.id}.json`).ve;
      expect(c.cua_x, c.id).toBe(tinhCuaCan(ve, c.rong_mm));
    }
  });

  it('tệp chính không còn nét nội thất; nội thất ở can/<id>.noithat.json', () => {
    for (const c of canDs) {
      const j = doc<{ ve: NetVe[]; tach_noi_that?: boolean; khoi3d?: unknown }>(`can/${c.id}.json`);
      expect(j.tach_noi_that, c.id).toBe(true);
      expect(j.ve.some((n) => NET_NOI_THAT.has(n.cat)), c.id).toBe(false);
      expect('khoi3d' in j, c.id).toBe(true);
      expect(existsSync(new URL(`can/${c.id}.noithat.json`, lib)), c.id).toBe(true);
      const nt = doc<{ ve: NetVe[] }>(`can/${c.id}.noithat.json`).ve;
      expect(nt.every((n) => NET_NOI_THAT.has(n.cat)), c.id).toBe(true);
    }
  });
});
