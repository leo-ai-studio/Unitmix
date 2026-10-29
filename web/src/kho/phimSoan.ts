import { useEffect, useRef } from 'preact/hooks';

/** Lệnh phím tắt cấp trình soạn (như app cũ: Ctrl+Z hoàn tác, Ctrl+Y / Ctrl+Shift+Z làm lại, Ctrl+S lưu ngay). */
export type LenhPhim = 'hoanTac' | 'lamLai' | 'luu';

/** Đang gõ trong ô nhập (input / textarea / select / contenteditable): để trình duyệt tự hoàn tác chữ, không bắt phím. */
export function dangGo(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null;
  if (!e || typeof e.tagName !== 'string') return false;
  const tag = e.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || e.isContentEditable === true;
}

type PhimVao = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'target'>;

/** Đổi sự kiện phím ra lệnh; không phải phím tắt của trình soạn thì null. */
export function lenhTuPhim(e: PhimVao): LenhPhim | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const k = e.key.toLowerCase();
  if (k === 's') return 'luu'; // Ctrl+S lưu cả khi đang gõ (chặn hộp "Lưu trang" của trình duyệt)
  if (dangGo(e.target)) return null;
  if (k === 'z') return e.shiftKey ? 'lamLai' : 'hoanTac';
  if (k === 'y' && !e.shiftKey) return 'lamLai';
  return null;
}

type TuyChon = {
  /** Chế độ chỉ xem: khoá hoàn tác / làm lại / lưu. */
  chiXem: boolean;
  hoanTac: () => void;
  lamLai: () => void;
  luuNgay: () => void;
  /** Còn thay đổi chưa lên máy chủ → hỏi lại khi đóng / tải lại tab. */
  conChuaLuu: () => boolean;
};

/** Phím tắt cấp trình soạn + cảnh báo đóng tab khi còn thay đổi chưa lưu (`beforeunload`). */
export function usePhimSoan(o: TuyChon): void {
  const ref = useRef(o);
  ref.current = o;
  useEffect(() => {
    const phim = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const lenh = lenhTuPhim(e);
      if (!lenh) return;
      e.preventDefault();
      const x = ref.current;
      if (x.chiXem || (lenh === 'luu' && e.repeat)) return;
      if (lenh === 'hoanTac') x.hoanTac();
      else if (lenh === 'lamLai') x.lamLai();
      else x.luuNgay();
    };
    const roi = (e: BeforeUnloadEvent) => {
      if (!ref.current.conChuaLuu()) return;
      e.preventDefault();
      e.returnValue = ''; // trình duyệt cũ cần returnValue để hiện hộp hỏi
    };
    window.addEventListener('keydown', phim);
    window.addEventListener('beforeunload', roi);
    return () => {
      window.removeEventListener('keydown', phim);
      window.removeEventListener('beforeunload', roi);
    };
  }, []);
}
