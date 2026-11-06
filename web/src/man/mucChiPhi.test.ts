import { describe, expect, it } from 'vitest';
import { mucDangDoc } from './ManChiPhi';

describe('mục đang đọc ở panel trái Chi phí', () => {
  it('đầu trang: mục đầu', () => expect(mucDangDoc([16, 900, 1600], false)).toBe(0));
  it('mục đã chạm mép trên thì là mục đang đọc', () => expect(mucDangDoc([-850, 30, 700], false)).toBe(1));
  it('mục chưa dựng (Infinity) không được chọn', () => expect(mucDangDoc([-100, Infinity, Infinity], false)).toBe(0));
  it('cuộn hết trang: mục cuối dù đỉnh còn thấp', () => expect(mucDangDoc([-1400, -500, 200], true)).toBe(2));
});
