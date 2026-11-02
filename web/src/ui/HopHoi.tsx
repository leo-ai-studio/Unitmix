import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';

/**
 * Hộp hỏi riêng của app, thay `confirm()` / `prompt()` của trình duyệt (hộp gốc có kiểu chữ và nút khác hẳn app, trông lạc quẻ).
 * Dùng bất đồng bộ: `if (!(await xacNhan('…'))) return;` · `const ten = await hoiChu('…', 'mặc định');` (null = bỏ qua).
 * Cần gắn `<HopHoi />` một lần ở gốc app (main.tsx).
 */
type Tuy = { tieuDe?: string; dongY?: string; huy?: string; nguyHiem?: boolean };
type Hoi = Tuy & { loai: 'xn' | 'chu'; noiDung: string; macDinh?: string; xong: (v: boolean | string | null) => void };

let dangHien: Hoi | null = null;
const nghe = new Set<(h: Hoi | null) => void>();
const dat = (h: Hoi | null) => { dangHien = h; nghe.forEach((f) => f(h)); };
/** Hộp mới đến khi hộp cũ còn mở thì hộp cũ coi như bỏ qua. */
const mo = <T,>(h: Omit<Hoi, 'xong'>, huy: T) => new Promise<T>((xong) => {
  dangHien?.xong(dangHien.loai === 'xn' ? false : null);
  dat({ ...h, xong: (v) => xong((v ?? huy) as T) });
});

export const xacNhan = (noiDung: string, o: Tuy = {}) => mo<boolean>({ loai: 'xn', noiDung, ...o }, false);
export const hoiChu = (noiDung: string, macDinh = '', o: Tuy = {}) => mo<string | null>({ loai: 'chu', noiDung, macDinh, ...o }, null);

export function HopHoi() {
  const [h, setH] = useState<Hoi | null>(dangHien);
  const [chu, setChu] = useState('');
  const nutChinh = useRef<HTMLButtonElement>(null);
  const oChu = useRef<HTMLInputElement>(null);
  useEffect(() => { nghe.add(setH); return () => void nghe.delete(setH); }, []);
  useEffect(() => {
    if (!h) return;
    setChu(h.macDinh ?? '');
    const id = requestAnimationFrame(() => (h.loai === 'chu' ? oChu.current : nutChinh.current)?.focus());
    return () => cancelAnimationFrame(id);
  }, [h]);
  if (!h) return null;
  const dong = (v: boolean | string | null) => { const x = h.xong; dat(null); x(v); };
  const dongY = () => dong(h.loai === 'xn' ? true : chu.trim() ? chu : null);
  return (
    <div
      class="hop-thoai hop-hoi" role="alertdialog" aria-modal="true" aria-labelledby="hop-hoi-tieu-de"
      onClick={(e) => { if (e.target === e.currentTarget) dong(h.loai === 'xn' ? false : null); }}
      onKeyDown={(e) => { if (e.key === 'Escape') dong(h.loai === 'xn' ? false : null); }}
    >
      <form onSubmit={(e) => { e.preventDefault(); dongY(); }}>
        <h2 id="hop-hoi-tieu-de">{h.tieuDe ?? t(h.loai === 'xn' ? 'hoi.xacNhan' : 'hoi.nhap')}</h2>
        <p class="hop-hoi-chu">{h.noiDung}</p>
        {h.loai === 'chu' && <input ref={oChu} value={chu} maxLength={120} aria-labelledby="hop-hoi-tieu-de" onInput={(e) => setChu(e.currentTarget.value)} />}
        <div class="chan-hop">
          <button type="button" class="nut-phu" onClick={() => dong(h.loai === 'xn' ? false : null)}>{h.huy ?? t('hoi.huy')}</button>
          <button type="submit" ref={nutChinh} class={`nut-chinh${h.nguyHiem ? ' nut-nguy' : ''}`}>{h.dongY ?? t('hoi.dongY')}</button>
        </div>
      </form>
    </div>
  );
}
