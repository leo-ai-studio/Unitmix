import { useEffect, useState } from 'preact/hooks';
import { docKieuMb, ghiKieuMb, type KieuMb } from '../ve/kieuMb';

/** Cài đặt hiển thị của màn Tầng / Căn: dùng chung giữa panel trái, bản vẽ, panel phải. Chỉ lưu kiểu hiển thị trong trình duyệt. */
export type CaiTang = { kieu: KieuMb; noiThat: boolean; hienTem: boolean; chamMau: boolean; suaNhieu: boolean };

// Nội thất tắt sẵn: vào màn Tầng chỉ ~9 request / 0,35 MB (đề xuất hiệu năng mục 8); bật ở nút Lớp góc bản vẽ khi cần.
let cai: CaiTang = { kieu: docKieuMb(), noiThat: false, hienTem: true, chamMau: true, suaNhieu: true };
const nghe = new Set<() => void>();

export function datCaiTang(p: Partial<CaiTang>): void {
  cai = { ...cai, ...p };
  if (p.kieu) ghiKieuMb(p.kieu);
  nghe.forEach((f) => f());
}

export function useCaiTang(): CaiTang {
  const [, ve] = useState(0);
  useEffect(() => {
    const f = () => ve((n) => n + 1);
    nghe.add(f);
    return () => void nghe.delete(f);
  }, []);
  return cai;
}
