import { describe, expect, it } from 'vitest';
import { phanTichLink } from './maSua';

describe('mở bằng link', () => {
  it('nhận link xem, link sửa và mã gõ tay', () => {
    expect(phanTichLink('https://unitmix.leo-ai.dev/du-an/x7k2p9ab')).toEqual({ ma: 'x7k2p9ab', maSua: null });
    expect(phanTichLink('https://unitmix.leo-ai.dev/du-an/x7k2p9ab?sua=Ab12Cd34Ef56Gh78Ij90')).toEqual({ ma: 'x7k2p9ab', maSua: 'Ab12Cd34Ef56Gh78Ij90' });
    expect(phanTichLink('  x7k2p9ab ')).toEqual({ ma: 'x7k2p9ab', maSua: null });
  });
  it('chuỗi không phải link dự án -> null', () => {
    expect(phanTichLink('https://example.com')).toBeNull();
    expect(phanTichLink('abc')).toBeNull();
  });
});
