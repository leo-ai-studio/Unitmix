import { describe, expect, it, vi } from 'vitest';
import type { TrangThaiPA } from '../tinh/kieu';
import { viTriPA } from '../tinh/viTri';
import { timDiaDiem } from './timDiaDiem';
import { apDungTuBanVe, coToaDoThat, viecNutViTri } from './viTriTuDong';

const lo = (e: number, n: number) => ({ id: 'l', ranh: [[e, n], [e + 400, n], [e + 400, n + 300], [e, n + 300]] });
const pa = (e: number, n: number, them: Partial<TrangThaiPA> = {}) => ({ lo: [lo(e, n)], toa: [], ...them }) as unknown as TrangThaiPA;
const THAT = pa(588600, 2326100), CUC_BO = pa(124000, 100000);

describe('đặt vị trí từ bản vẽ', () => {
  it('bản vẽ VN-2000 + kinh tuyến trục → viTri, góc Bắc = hội tụ lưới, cachDat banVe', () => {
    const m = apDungTuBanVe(THAT, 105)!;
    const v = viTriPA(m);
    expect(v.coToaDo).toBe(true);
    expect(v.lat).toBeCloseTo(21.0285, 1);
    expect(v.lng).toBeCloseTo(105.8542, 1);
    expect(v.cachDat).toBe('banVe');
    expect(v.gocBac).toBeGreaterThan(0.2);
    expect(v.neo).toEqual([588800, 2326250]);
  });
  it('bản vẽ cục bộ → null; coToaDoThat phân biệt', () => {
    expect(apDungTuBanVe(CUC_BO, 105)).toBeNull();
    expect(coToaDoThat(THAT)).toBe(true);
    expect(coToaDoThat(CUC_BO)).toBe(false);
  });
});

describe('nút Vị trí', () => {
  it('đang bật → tắt; đã có toạ độ → bật', () => {
    expect(viecNutViTri(THAT, true, '', false).viec).toBe('tat');
    expect(viecNutViTri(apDungTuBanVe(THAT, 105)!, false, '', false).viec).toBe('bat');
  });
  it('chưa có toạ độ: biết tỉnh từ tên dự án → tự đặt; không biết → mở hộp', () => {
    const r = viecNutViTri(THAT, false, 'KĐT Tây Hồ Tây, Hà Nội', false);
    expect(r.viec).toBe('tuDat');
    expect('pa' in r && viTriPA(r.pa).coToaDo).toBe(true);
    expect(viecNutViTri(THAT, false, 'Thanh Hóa', false).viec).toBe('hoi');
    expect(viecNutViTri(CUC_BO, false, 'Hà Nội', false).viec).toBe('hoi');
  });
  it('chế độ chỉ xem không sửa PA → mở hộp', () => {
    expect(viecNutViTri(THAT, false, 'Hà Nội', true).viec).toBe('hoi');
  });
});

describe('tìm địa điểm (Nominatim)', () => {
  const traLoi = (j: unknown, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 429, json: async () => j })) as unknown as typeof fetch;
  it('trả danh sách có toạ độ số; bỏ kết quả hỏng', async () => {
    const f = traLoi([{ display_name: 'Tây Hồ, Hà Nội', lat: '21.0583', lon: '105.8231' }, { display_name: 'hỏng', lat: 'x', lon: '1' }]);
    expect(await timDiaDiem('Tây Hồ Hà Nội', f)).toEqual([{ ten: 'Tây Hồ, Hà Nội', lat: 21.0583, lng: 105.8231 }]);
    const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('countrycodes=vn');
    expect(url).toContain(encodeURIComponent('Tây Hồ Hà Nội'));
  });
  it('chuỗi quá ngắn không gọi mạng; lỗi HTTP ném lỗi', async () => {
    const f = traLoi([]);
    expect(await timDiaDiem('ab', f)).toEqual([]);
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    await expect(timDiaDiem('Hà Nội', traLoi({}, false))).rejects.toThrow();
  });
});
