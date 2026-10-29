import { describe, expect, it } from 'vitest';
import { boDau, goiYMoHinh } from './goiYMoHinh';
import { tyLeSoOpus } from './moHinh';

const mh = (c: string, n = {}) => goiYMoHinh(c, n)?.moHinh;

describe('gợi ý mô hình (luật, 0 token)', () => {
  it('rỗng / quá ngắn → không gợi ý', () => {
    expect(goiYMoHinh('')).toBeNull();
    expect(goiYMoHinh('  a ')).toBeNull();
  });
  it('Haiku · Nhanh: tra cứu, đọc KPI, giải thích, điều hướng', () => {
    for (const c of ['Dự án có bao nhiêu căn?', 'mật độ lô A là bao nhiêu', 'mở tầng 5', 'xem 3D', 'Tại sao hiệu suất thấp?', 'dan so du an', 'How many units?', 'KPI lô B'])
      expect(mh(c), c).toBe('claude-haiku-5-5');
    expect(goiYMoHinh('mở tầng 5')!.nghi).toBe('low');
  });
  it('Sonnet · Cân bằng: một vài thao tác sửa, tóm tắt, so sánh 2 PA', () => {
    for (const c of ['đổi 2 căn 3PN thành 2PN ở tầng điển hình', 'thêm một tòa mẫu I1 vào lô B', 'xoay tòa 90 độ', 'so sánh PA 1 và PA 2', 'tóm tắt phương án này', 'Nhờ bạn xem giúp lô A'])
      expect(mh(c), c).toBe('claude-sonnet-5-5');
  });
  it('Opus · Kỹ: tối ưu, xếp lại nhiều lô / tòa, quy chuẩn toàn dự án, đính kèm, yêu cầu dài', () => {
    for (const c of ['tối ưu hiệu suất', 'đạt 55% 2PN cho cả dự án', 'xếp lại tòa cho tất cả các lô', 'kiểm tra QCVN toàn bộ dự án', 'đổi tất cả căn 1PN ở mọi tòa thành studio', 'toi uu co cau tang 5'])
      expect(mh(c), c).toBe('claude-opus-5-5');
    expect(mh('xem ảnh này', { coDinhKem: true })).toBe('claude-opus-5-5');
    expect(mh('a'.repeat(300) + ' đổi căn')).toBe('claude-opus-5-5');
    expect(goiYMoHinh('tối ưu hiệu suất')!.nghi).toBe('high');
  });
  it('chi phí tương đối so Opus theo giá ra', () => {
    expect(tyLeSoOpus('claude-opus-5-5')).toBe(1);
    expect(tyLeSoOpus('claude-sonnet-5-5')).toBe(0.5);
    expect(tyLeSoOpus('claude-haiku-5-5')).toBe(0.025);
    expect(goiYMoHinh('mở tầng 5')!.tyLe).toBe(0.025);
  });
  it('bỏ dấu', () => { expect(boDau('Tối ưu Đường')).toBe('toi uu duong'); });
});
