/**
 * Giọng nói của Leo AI — chỉ API của trình duyệt, không dịch vụ ngoài, không khoá:
 * - nói → chữ: SpeechRecognition / webkitSpeechRecognition (Chrome, Edge, Safari iOS 14.5+, Chrome Android), vi-VN / en-US theo
 *   ngôn ngữ app, kết quả tạm hiện ngay trong ô nhập; bấm lại để dừng. Không hỗ trợ / bị từ chối quyền → mã lỗi để báo tiếng Việt.
 * - đọc to: speechSynthesis, chọn giọng vi-VN nếu máy có.
 */
type SR = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SRCtor = new () => SR;

const lopNghe = (): SRCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const coNghe = () => !!lopNghe();
export const coDoc = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export type LoiNghe = 'khong_ho_tro' | 'tu_choi' | 'khong_nghe_thay' | 'khong_co_mic' | 'mang' | 'khac';
const maLoi = (e: string): LoiNghe =>
  e === 'not-allowed' || e === 'service-not-allowed' ? 'tu_choi' : e === 'no-speech' ? 'khong_nghe_thay' : e === 'audio-capture' ? 'khong_co_mic' : e === 'network' ? 'mang' : 'khac';

export type PhienNghe = { dung: () => void; huy: () => void };

/** Bắt đầu nghe. `khiTam(chu)` = toàn bộ chữ đã nghe (chốt + tạm), `khiXong(chu)` khi dừng. */
export function batDauNghe(lang: 'vi' | 'en', cb: { khiTam: (chu: string) => void; khiXong: (chu: string) => void; khiLoi: (l: LoiNghe) => void }): PhienNghe | null {
  const L = lopNghe();
  if (!L) { cb.khiLoi('khong_ho_tro'); return null; }
  const r = new L();
  r.lang = lang === 'en' ? 'en-US' : 'vi-VN';
  r.continuous = true; // iOS Safari tự dừng sau một câu dù continuous — onend vẫn gọi khiXong
  r.interimResults = true;
  r.maxAlternatives = 1;
  let chot = '', tam = '', daLoi = false;
  r.onresult = (e) => {
    tam = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const x = e.results[i];
      if (x.isFinal) chot += x[0].transcript; else tam += x[0].transcript;
    }
    cb.khiTam((chot + tam).trim());
  };
  r.onerror = (e) => { if (e.error === 'aborted') return; daLoi = true; cb.khiLoi(maLoi(e.error)); };
  r.onend = () => { if (!daLoi || chot) cb.khiXong((chot + tam).trim()); };
  try { r.start(); } catch { cb.khiLoi('khac'); return null; }
  return { dung: () => r.stop(), huy: () => { daLoi = true; r.abort(); } };
}

/** Bỏ Markdown / mã để đọc to cho tự nhiên. */
export const chuDeDoc = (md: string) => md
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\|/g, ', ')
  .replace(/^[-:| ]{3,}$/gm, '')
  .replace(/[#>*_]+/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

let dangDoc: SpeechSynthesisUtterance | null = null;
/** Đọc to; trả Promise xong khi đọc xong / bị dừng. */
export function docTo(md: string, lang: 'vi' | 'en'): Promise<void> {
  if (!coDoc()) return Promise.resolve();
  dungDoc();
  const u = new SpeechSynthesisUtterance(chuDeDoc(md).slice(0, 4000));
  const ma = lang === 'en' ? 'en' : 'vi';
  const giong = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(ma));
  if (giong) u.voice = giong;
  u.lang = lang === 'en' ? 'en-US' : 'vi-VN';
  u.rate = 1.05;
  dangDoc = u;
  return new Promise((xong) => { u.onend = () => xong(); u.onerror = () => xong(); speechSynthesis.speak(u); });
}
export function dungDoc() { if (coDoc()) speechSynthesis.cancel(); dangDoc = null; }
export const dangDocTo = () => !!dangDoc && coDoc() && speechSynthesis.speaking;
