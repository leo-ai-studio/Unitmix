/**
 * Khung định nghĩa công cụ Leo AI: tên (snake_case tiếng Anh — Claude quen), mô tả tiếng Việt, JSON schema đầu vào, cờ sửa
 * (mutating) và hàm chạy. Đầu vào luôn được kiểm theo schema trước khi chạy (eager_input_streaming tắt kiểm phía máy chủ).
 */
import type { NguCanh } from './nguCanh';

export type Schema = {
  type: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: (string | number | null)[];
  minimum?: number;
  maximum?: number;
  /** cho phép null (JSON schema: type ["x","null"]) */
  nullable?: boolean;
  additionalProperties?: boolean | Schema;
};

export type CongCu = {
  ten: string;
  moTa: string;
  schema: Schema;
  /** Công cụ sửa PA / dự án (bị chặn ở chế độ Chỉ xem). */
  sua?: boolean;
  /** Nhóm hiển thị (biểu tượng bước trong khung chat). */
  nhom: 'doc' | 'dieu_huong' | 'tmb' | 'tang' | 'khac' | 'ui';
  chay: (dauVao: Record<string, unknown>, ng: NguCanh) => Promise<unknown> | unknown;
};

const kieuCua = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** Kiểm đầu vào theo schema rút gọn; trả câu lỗi (tiếng Việt) hoặc null. */
export function kiemDauVao(s: Schema, v: unknown, duong = 'input'): string | null {
  if (v === null) return s.nullable || s.enum?.includes(null) ? null : `${duong}: không được null`;
  if (v === undefined) return `${duong}: thiếu`;
  const k = kieuCua(v);
  if (s.type === 'integer') {
    if (k !== 'number' || !Number.isInteger(v)) return `${duong}: phải là số nguyên`;
  } else if (s.type === 'number') {
    if (k !== 'number' || !Number.isFinite(v as number)) return `${duong}: phải là số`;
  } else if (s.type !== k) return `${duong}: phải là ${s.type}, nhận ${k}`;
  if (s.enum && !s.enum.includes(v as string)) return `${duong}: phải là một trong ${s.enum.map((x) => JSON.stringify(x)).join(', ')}`;
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) return `${duong}: tối thiểu ${s.minimum}`;
    if (s.maximum !== undefined && v > s.maximum) return `${duong}: tối đa ${s.maximum}`;
  }
  if (s.type === 'array' && s.items) {
    const a = v as unknown[];
    for (let i = 0; i < a.length; i++) { const l = kiemDauVao(s.items, a[i], `${duong}[${i}]`); if (l) return l; }
  }
  if (s.type === 'object') {
    const o = v as Record<string, unknown>;
    for (const r of s.required ?? []) if (o[r] === undefined) return `${duong}.${r}: thiếu (bắt buộc)`;
    for (const [kh, gt] of Object.entries(o)) {
      const con = s.properties?.[kh];
      if (!con) {
        if (s.additionalProperties === false || (s.properties && s.additionalProperties === undefined)) return `${duong}.${kh}: không có trường này`;
        if (typeof s.additionalProperties === 'object') { const l = kiemDauVao(s.additionalProperties, gt, `${duong}.${kh}`); if (l) return l; }
        continue;
      }
      if (gt === undefined) continue;
      const l = kiemDauVao(con, gt, `${duong}.${kh}`);
      if (l) return l;
    }
  }
  return null;
}

/** Schema gửi API: bỏ cờ `nullable` riêng → type ["x","null"]. */
export function schemaApi(s: Schema): Record<string, unknown> {
  const { nullable, properties, items, additionalProperties, ...con } = s;
  const r: Record<string, unknown> = { ...con };
  if (nullable) r.type = [s.type, 'null'];
  if (properties) r.properties = Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, schemaApi(v)]));
  if (items) r.items = schemaApi(items);
  if (additionalProperties !== undefined) r.additionalProperties = typeof additionalProperties === 'object' ? schemaApi(additionalProperties) : additionalProperties;
  else if (s.type === 'object' && properties) r.additionalProperties = false;
  return r;
}

// Mảnh schema dùng lại
export const S = {
  so: (description?: string, min?: number, max?: number): Schema => ({ type: 'number', description, minimum: min, maximum: max }),
  nguyen: (description?: string, min?: number, max?: number): Schema => ({ type: 'integer', description, minimum: min, maximum: max }),
  chu: (description?: string): Schema => ({ type: 'string', description }),
  bool: (description?: string): Schema => ({ type: 'boolean', description }),
  chon: (vals: string[], description?: string): Schema => ({ type: 'string', enum: vals, description }),
  ds: (items: Schema, description?: string): Schema => ({ type: 'array', items, description }),
  doiTuong: (properties: Record<string, Schema>, required: string[] = [], description?: string): Schema => ({ type: 'object', properties, required, description }),
};

export const LOAI_CAN_SCHEMA = (description: string): Schema => S.doiTuong({
  stu: S.so('Studio %', 0, 100), '1pn': S.so('1PN %', 0, 100), '2pn': S.so('2PN %', 0, 100), '2pnp': S.so('2PN+ %', 0, 100), '3pn': S.so('3PN %', 0, 100),
}, [], description);
