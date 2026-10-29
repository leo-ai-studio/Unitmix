/**
 * Lối dự phòng của Leo AI: đọc các điều khiển đang HIỆN trên giao diện (nút, ô nhập, chọn, tab, hộp kiểm) và bấm / nhập như người dùng.
 * Id ổn định = vùng + vai trò + nhãn (+ số thứ tự khi trùng), gắn vào `data-leo-id` để bấm lại. Không đụng vào chính khung Leo AI.
 * Nút tải tệp / xoá hỏi người dùng xác nhận trước (`xacNhan`).
 */
import type { MucUi } from './congCu/nguCanh';
import { LoiCongCu } from './congCu/nguCanh';

const CHON = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="option"]';
const NGOAI = '.leo-ai';

function vungCua(el: Element): string {
  if (el.closest('[role="dialog"], .hop, .lop-noi, dialog')) return 'dialog';
  if (el.closest('.thanh-tren')) return 'top';
  if (el.closest('.panel-trai')) return 'left';
  if (el.closest('.panel-phai')) return 'right';
  if (el.closest('.dock-duoi')) return 'dock';
  if (el.closest('.panel-giua')) return 'center';
  return 'khac';
}
const hien = (el: HTMLElement) => {
  if (el.closest('[inert], [aria-hidden="true"]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none';
};
const nhanCua = (el: HTMLElement) => {
  const lb = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : null;
  const boc = el.closest('label')?.textContent;
  const x = el.getAttribute('aria-label') || el.getAttribute('title') || lb || (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' ? boc || el.getAttribute('placeholder') || el.getAttribute('name') : el.textContent) || '';
  return x.replace(/\s+/g, ' ').trim().slice(0, 70);
};
const vaiCua = (el: HTMLElement) => {
  const r = el.getAttribute('role');
  if (r) return r;
  if (el.tagName === 'INPUT') { const ty = (el as HTMLInputElement).type; return ty === 'checkbox' || ty === 'radio' ? ty : 'input'; }
  return el.tagName.toLowerCase();
};
const ma = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);

export function chupUi(vung = 'all', goc: ParentNode = document): MucUi[] {
  const ra: MucUi[] = [];
  const dem = new Map<string, number>();
  for (const el of goc.querySelectorAll<HTMLElement>(CHON)) {
    if (el.closest(NGOAI) || !hien(el)) continue;
    const v = vungCua(el);
    if (vung !== 'all' && v !== vung) continue;
    const nhan = nhanCua(el);
    const vai = vaiCua(el);
    if (!nhan && vai !== 'input' && vai !== 'select') continue;
    const goc0 = `${v}.${vai}.${ma(nhan) || 'o'}`;
    const n = (dem.get(goc0) ?? 0) + 1;
    dem.set(goc0, n);
    const id = n > 1 ? `${goc0}.${n}` : goc0;
    el.setAttribute('data-leo-id', id);
    const m: MucUi = { id, vai, nhan, vung: v };
    if (el instanceof HTMLInputElement) { if (el.type === 'checkbox' || el.type === 'radio') m.chon = el.checked; else m.giaTri = el.value; }
    else if (el instanceof HTMLSelectElement) m.giaTri = `${el.value} (chọn: ${[...el.options].map((o) => o.value).slice(0, 12).join(' | ')})`;
    else if (el instanceof HTMLTextAreaElement) m.giaTri = el.value.slice(0, 60);
    const p = el.getAttribute('aria-pressed') ?? el.getAttribute('aria-selected') ?? el.getAttribute('aria-checked');
    if (p !== null) m.chon = p === 'true';
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') m.tat = true;
    ra.push(m);
  }
  return ra;
}

function timEl(id: string): HTMLElement {
  let el = document.querySelector<HTMLElement>(`[data-leo-id="${CSS.escape(id)}"]`);
  if (!el || !el.isConnected || !hien(el)) { chupUi(); el = document.querySelector<HTMLElement>(`[data-leo-id="${CSS.escape(id)}"]`); }
  if (!el || el.closest(NGOAI)) throw new LoiCongCu(`Không thấy điều khiển "${id}" trên giao diện — gọi lại ui_snapshot.`);
  return el;
}

const NHAY_CAM = /(xuat|xuất|tai |tải|download|export|xoa|xoá|xóa|delete|remove)/i;
const cho = () => new Promise((r) => setTimeout(r, 80));

export async function bamUi(id: string, xacNhan: (c: string) => Promise<boolean>): Promise<string> {
  const el = timEl(id);
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') throw new LoiCongCu(`"${nhanCua(el)}" đang bị khoá (disabled).`);
  const nhan = nhanCua(el);
  if (NHAY_CAM.test(nhan) && !(await xacNhan(`Leo AI muốn bấm "${nhan}". Đồng ý?`))) throw new LoiCongCu('Người dùng không đồng ý.');
  // Hộp xác nhận gốc của trình duyệt (window.confirm) không bấm hộ được: tạm cho qua bằng chip xác nhận đã hỏi ở trên.
  const goc = window.confirm;
  window.confirm = () => true;
  try { el.click(); } finally { setTimeout(() => { window.confirm = goc; }, 0); }
  await cho();
  return `đã bấm "${nhan}"`;
}

export async function datUi(id: string, v: string | boolean): Promise<string> {
  const el = timEl(id);
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    if (el.checked !== !!v) el.click();
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (el.disabled) throw new LoiCongCu(`"${nhanCua(el)}" đang bị khoá.`);
    if (el instanceof HTMLSelectElement && ![...el.options].some((o) => o.value === String(v))) throw new LoiCongCu(`Giá trị "${v}" không có trong danh sách chọn.`);
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur'));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  } else throw new LoiCongCu('Điều khiển này không nhập giá trị được — dùng ui_click.');
  await cho();
  return `đã đặt "${nhanCua(el)}" = ${String(v)}`;
}
