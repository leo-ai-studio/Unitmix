/**
 * Gợi ý mô hình + mức suy nghĩ theo câu người dùng đang gõ — chạy trên máy, theo luật, KHÔNG gọi API (0 token).
 * - Haiku 5.5 · Nhanh: câu hỏi tra cứu ngắn, đọc KPI / số liệu, giải thích một giá trị, điều hướng ("mở tầng 5", "xem 3D").
 * - Sonnet 5.5 · Cân bằng (mặc định): một vài thao tác sửa, tóm tắt, so sánh 2 PA.
 * - Opus 5.5 · Kỹ: xếp lại nhiều lô / tòa / tầng, mục tiêu tối ưu ("tối ưu hiệu suất", "đạt 55% 2PN cả dự án"), suy luận quy chuẩn
 *   trên toàn dự án, có ảnh / tệp đính kèm cần đọc, yêu cầu dài nhiều phần.
 * Tín hiệu: độ dài, động từ sửa, từ phạm vi (mọi / tất cả / cả dự án), số thực thể, tệp đính kèm, màn đang mở, số lượt đã nói.
 */
import { tyLeSoOpus, type MaMoHinh, type MucNghi } from './moHinh';

export type GoiYMH = { moHinh: MaMoHinh; nghi: MucNghi; lyDo: string; tyLe: number };
export type NguCanhGoiY = { coDinhKem?: boolean; manHinh?: 'tmb' | 'tang' | 'ham'; soLuot?: number };

/** bỏ dấu tiếng Việt → so khớp cả khi gõ không dấu */
export const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Động từ sửa: tìm trên chữ CÓ dấu (bỏ dấu thì "tầng" = "tăng", "đặt" = "đạt"); chữ gõ không dấu chỉ dùng từ không nhập nhằng.
const W = (x: string) => new RegExp(`(?<![\\p{L}])(?:${x})(?![\\p{L}])`, 'gu');
const SUA_CO_DAU = W('đổi|thay|thêm|xoá|xóa|xếp|xoay|lật|sửa|đặt|tăng|giảm|chỉnh|nhân bản|khoá|khóa|áp dụng|bỏ|chuyển|dời|change|add|delete|remove|move|rotate|set|arrange|swap|flip|duplicate|apply|update');
const SUA_KHONG_DAU = W('doi|thay|them|xoa|xep|xoay|sua|giam|chinh|nhan ban|ap dung|chuyen');
const coDau = (s: string) => /[À-ỹ]/.test(s);
const TOI_UU = /\b(toi uu|optimi[sz]e|hieu suat cao nhat|nhieu can nhat|toi da hoa|dat \d+ ?%|dat muc tieu|sat muc tieu)/;
const PHAM_VI_RONG = /\b(moi|tat ca|toan bo|ca du an|cac toa|cac lo|cac tang|tung toa|tung lo|tung tang|all|every|whole project)\b/;
const XEP_LAI = /\b(xep lai|sap xep lai|bo tri lai|xep tu dong|tu xep|xep hang loat|rearrange|re-arrange|batch)\b/;
const QUY_CHUAN = /\b(qcvn|tcvn|quy chuan|tieu chuan|tuan thu|phap ly|pccc|thoat nan)\b/;
const HOI = /(\?|\b(bao nhieu|la gi|may|the nao|o dau|co dat|how many|how much|what is|what's|which)\b)/;
const GIAI_THICH = /\b(giai thich|tai sao|vi sao|why|explain|nghia la)\b/;
const DIEU_HUONG = /^(mo|xem|chuyen|di toi|sang|ve|hien|open|show|go to|view)\b/;
const TOM_TAT_SO_SANH = /\b(tom tat|so sanh|compare|summari[sz]e|bao cao)\b/;

const ra = (moHinh: MaMoHinh, nghi: MucNghi, lyDo: string): GoiYMH => ({ moHinh, nghi, lyDo, tyLe: tyLeSoOpus(moHinh) });

/** Trả null khi chưa có gì để gợi ý (câu rỗng / quá ngắn). `lyDo` là khoá i18n `leo.gy.*`. */
export function goiYMoHinh(cau: string, ngu: NguCanhGoiY = {}): GoiYMH | null {
  const goc = cau.trim();
  if (!goc && !ngu.coDinhKem) return null;
  if (goc.length < 3 && !ngu.coDinhKem) return null;
  const s = boDau(goc);
  const thuong = goc.toLowerCase();
  const soSua = (thuong.match(SUA_CO_DAU) ?? []).length + (coDau(goc) ? 0 : (s.match(SUA_KHONG_DAU) ?? []).length);
  const soPhan = goc.split(/\n+|;|\. (?=[A-ZÀ-Ỹa-zà-ỹ])|\b(?:rồi|sau đó|then)\b/).filter((x) => x.trim().length > 3).length;
  const soThucThe = (s.match(/\b(lo|toa|tang|can|pa|phuong an)\s*[a-z0-9-]+/g) ?? []).length;

  // Opus · Kỹ
  if (ngu.coDinhKem) return ra('claude-opus-5-5', 'high', 'leo.gy.dinhKem');
  if (TOI_UU.test(s)) return ra('claude-opus-5-5', 'high', 'leo.gy.toiUu');
  if (XEP_LAI.test(s) && (PHAM_VI_RONG.test(s) || soThucThe >= 2)) return ra('claude-opus-5-5', 'high', 'leo.gy.xepNhieu');
  if (QUY_CHUAN.test(s) && (PHAM_VI_RONG.test(s) || /kiem tra|check|ra soat/.test(s))) return ra('claude-opus-5-5', 'high', 'leo.gy.quyChuan');
  if (soSua > 0 && PHAM_VI_RONG.test(s) && (soSua >= 2 || soThucThe >= 2)) return ra('claude-opus-5-5', 'high', 'leo.gy.xepNhieu');
  if (goc.length > 280 || (soPhan >= 3 && soSua >= 2)) return ra('claude-opus-5-5', 'high', 'leo.gy.dai');

  // Haiku · Nhanh
  if (soSua === 0 && goc.length <= 120) {
    if (DIEU_HUONG.test(s)) return ra('claude-haiku-5-5', 'low', 'leo.gy.dieuHuong');
    if (HOI.test(s) || GIAI_THICH.test(s)) return ra('claude-haiku-5-5', 'low', 'leo.gy.traCuu');
    if (/\b(kpi|so can|dan so|mat do|hssdd|he so|hieu suat|chi phi|tong muc|loi nhuan|co cau)\b/.test(s)) return ra('claude-haiku-5-5', 'low', 'leo.gy.traCuu');
  }

  // Sonnet · Cân bằng (mặc định)
  if (TOM_TAT_SO_SANH.test(s)) return ra('claude-sonnet-5-5', 'medium', 'leo.gy.tomTat');
  if (soSua > 0) return ra('claude-sonnet-5-5', 'medium', 'leo.gy.suaIt');
  return ra('claude-sonnet-5-5', 'medium', 'leo.gy.macDinh');
}
