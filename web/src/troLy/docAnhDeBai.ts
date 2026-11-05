/**
 * Đọc đề bài kinh doanh từ ẢNH / PDF bằng mô hình có thị giác (cùng nguồn đã cấu hình cho Leo AI: cầu tài khoản Claude, khoá riêng, khoá
 * chung, nhà cung cấp khác): trả bảng chữ cách nhau bằng tab, đưa vào đúng bộ đọc `docDeBai` như bảng dán, người dùng xem trước rồi mới áp.
 */
import { layMaSua } from '../kho/maSua';
import { cauDungDuoc, chonNguon, docDiaChiCau, docMaGhep, kiemCau } from './cau';
import { docNhaKhac, nhaKhacDungDuoc, taoKhachKhac } from './khachKhac';
import { taoKhach } from './khachThat';
import { docCaiDat, docKhoaApi } from './moHinh';
import type { KhachClaude, ThanYeuCau } from './vongLap';

export const CAU_HOI_DE_BAI = `Ảnh / tài liệu này có bảng cơ cấu căn hộ (unit mix) đề bài kinh doanh. Chép lại ĐÚNG số trong bảng thành văn bản thuần:
dòng đầu là "Loại căn<TAB>Tỷ lệ<TAB>Số căn<TAB>DT (m²)", mỗi loại căn một dòng, cột cách nhau bằng một dấu TAB.
Loại căn giữ tên trong bảng (Studio, 1PN, 1PN+, 2PN, 2PN+1, 3PN…). Tỷ lệ ghi kèm dấu %. Ô không có để trống, không tự suy ra số.
Bỏ dòng tổng, hiệu suất, thang máy. Nhiều bảng thì lấy bảng tổng hợp của toàn tòa / toàn lô. Chỉ trả về bảng, không giải thích.`;

const b64 = (buf: ArrayBuffer) => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };

/** Ảnh thu ≤ 2000 px (đủ đọc số trong bảng), PDF gửi nguyên. */
async function khoiNoiDung(f: File) {
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
    return { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: b64(await f.arrayBuffer()) } };
  }
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, loi) => { const i = new Image(); i.onload = () => ok(i); i.onerror = loi; i.src = url; });
    const k = Math.min(1, 2000 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    return { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: cv.toDataURL('image/jpeg', 0.9).split(',')[1] } };
  } finally { URL.revokeObjectURL(url); }
}

/** Khách theo cài đặt Leo AI hiện tại. */
async function khachHienTai(): Promise<KhachClaude> {
  const nk = docNhaKhac();
  if (nhaKhacDungDuoc(nk)) return taoKhachKhac(nk);
  const cai = docCaiDat(), khoa = docKhoaApi(), cau = await kiemCau().catch(() => null), maGhep = docMaGhep();
  const maDuAn = /\/du-an\/([^/?#]+)/.exec(location.pathname)?.[1] ?? '';
  return taoKhach({
    nguon: chonNguon(cai.nguon, { khoaRieng: !!khoa, cau: cauDungDuoc(cau ?? null) || (!cau && !!maGhep) }), khoaRieng: khoa, maDuAn,
    maSua: maDuAn ? layMaSua(maDuAn) : null, diaChiCau: docDiaChiCau(), qua: cau?.qua ?? (maGhep ? 'tram' : 'may'), maGhep: maGhep ?? undefined,
  });
}

/** Rút chữ trong trả lời, bỏ rào ``` nếu mô hình bọc bảng trong khối mã. */
export const rutBang = (chu: string): string => chu.replace(/^\s*```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();

/** Đọc tệp ảnh / PDF, trả bảng dạng tab. Lỗi mạng / chưa nối AI thì ném (hộp thoại hiện câu lỗi). */
export async function anhThanhBang(f: File, khach?: KhachClaude): Promise<string> {
  const k = khach ?? await khachHienTai();
  const than = { model: 'claude-sonnet-5-5', max_tokens: 1500, messages: [{ role: 'user', content: [await khoiNoiDung(f), { type: 'text', text: CAU_HOI_DE_BAI }] }] } as unknown as ThanYeuCau;
  const msg = await k.luong(than, { signal: new AbortController().signal }).finalMessage();
  return rutBang(msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n'));
}
