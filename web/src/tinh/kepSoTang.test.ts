import { describe, expect, it } from 'vitest';
import { kepSoTangDe, kepSoTangDH, SO_TANG_DE_MAX, SO_TANG_DH_MAX } from './macDinh';

describe('kẹp số tầng nhập tay', () => {
  it('giữ số hợp lệ, làm tròn', () => {
    expect(kepSoTangDH(11)).toBe(11);
    expect(kepSoTangDH(12.4)).toBe(12);
    expect(kepSoTangDe(2)).toBe(2);
  });
  it('999 tầng về trần, không tạo tòa 1.000 tầng', () => {
    expect(kepSoTangDH(999)).toBe(SO_TANG_DH_MAX);
    expect(kepSoTangDe(999)).toBe(SO_TANG_DE_MAX);
  });
  it('tầng điển hình ít nhất 1, tầng đế có thể 0', () => {
    expect(kepSoTangDH(0)).toBe(1);
    expect(kepSoTangDe(-3)).toBe(0);
  });
});
