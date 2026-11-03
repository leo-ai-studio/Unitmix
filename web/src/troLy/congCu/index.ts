/**
 * Bộ công cụ Leo AI: danh sách cố định (thứ tự cố định → tiền tố prompt cache không đổi), định nghĩa gửi API, và bộ chạy
 * (kiểm đầu vào → chạy → kết quả JSON gọn / lỗi tiếng Việt). Mọi công cụ sửa đi qua kho thật (một bước hoàn tác mỗi lần).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { CONG_CU_DOC } from './doc';
import { kiemDauVao, schemaApi, type CongCu } from './dinhNghia';
import { CONG_CU_KHAC } from './khac';
import { CONG_CU_MAU } from './mau';
import { LoiCongCu, type NguCanh } from './nguCanh';
import { CONG_CU_TANG } from './tang';
import { CONG_CU_TMB } from './tmb';

export const BO_CONG_CU: CongCu[] = [...CONG_CU_DOC, ...CONG_CU_TMB, ...CONG_CU_MAU, ...CONG_CU_TANG, ...CONG_CU_KHAC];
export const congCuTheoTen = new Map(BO_CONG_CU.map((c) => [c.ten, c]));

/** Định nghĩa gửi Claude: eager_input_streaming (đầu vào chảy ngay khi sinh) — vì vậy luôn tự kiểm đầu vào trước khi chạy. */
export const CONG_CU_API: Anthropic.Beta.BetaTool[] = BO_CONG_CU.map((c) => ({
  name: c.ten,
  description: c.moTa,
  input_schema: schemaApi(c.schema) as Anthropic.Beta.BetaTool['input_schema'],
  eager_input_streaming: true,
}));

export type KetQuaChay = { noiDung: string; loi: boolean };

/** Giới hạn độ dài kết quả gửi lại (tiết kiệm token); kết quả quá dài thì cắt kèm ghi chú. */
export const TOI_DA_KY_TU = 12_000;

/** `toiDa`: trần ký tự kết quả (vòng AI dùng mặc định; cổng ngoài / cầu MCP tự cắt gọn nên có thể nới, 0 = không cắt). */
export async function chayCongCu(ten: string, dauVao: unknown, ng: NguCanh, toiDa = TOI_DA_KY_TU): Promise<KetQuaChay> {
  const c = congCuTheoTen.get(ten);
  if (!c) return { noiDung: `Không có công cụ "${ten}".`, loi: true };
  const v = dauVao && typeof dauVao === 'object' && !Array.isArray(dauVao) ? (dauVao as Record<string, unknown>) : null;
  if (!v) return { noiDung: 'Đầu vào phải là một đối tượng JSON.', loi: true };
  const sai = kiemDauVao(c.schema, v);
  if (sai) return { noiDung: `Đầu vào không hợp lệ — ${sai}.`, loi: true };
  try {
    const kq = await c.chay(v, ng);
    let s = typeof kq === 'string' ? kq : JSON.stringify(kq);
    if (toiDa > 0 && s.length > toiDa) s = s.slice(0, toiDa) + `… [cắt bớt ${s.length - toiDa} ký tự — hỏi hẹp hơn]`;
    return { noiDung: s, loi: false };
  } catch (e) {
    if (e instanceof LoiCongCu) return { noiDung: e.message, loi: true };
    return { noiDung: `Lỗi khi chạy ${ten}: ${e instanceof Error ? e.message : String(e)}`, loi: true };
  }
}

export type { CongCu, NguCanh };
