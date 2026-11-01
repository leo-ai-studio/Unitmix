import { t } from '../i18n/i18n';

/** Chữ trong tệp Word (.docx = zip, đọc word/document.xml) — không cần thư viện: đọc mục lục zip rồi giải nén deflate-raw. */
export async function docChuDocx(buf: ArrayBuffer): Promise<string> {
  const v = new DataView(buf), u = new Uint8Array(buf);
  let cuoi = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 70_000); i--) if (v.getUint32(i, true) === 0x06054b50) { cuoi = i; break; }
  if (cuoi < 0) throw new Error(t('leo.loi.kieuTep'));
  const n = v.getUint16(cuoi + 10, true);
  let o = v.getUint32(cuoi + 16, true);
  for (let k = 0; k < n; k++) {
    const phuong = v.getUint16(o + 10, true), nen = v.getUint32(o + 20, true), vt = v.getUint32(o + 42, true);
    const dai = v.getUint16(o + 28, true), them = v.getUint16(o + 30, true) + v.getUint16(o + 32, true);
    const ten = new TextDecoder().decode(u.subarray(o + 46, o + 46 + dai));
    o += 46 + dai + them;
    if (ten !== 'word/document.xml') continue;
    const dauTep = vt + 30 + v.getUint16(vt + 26, true) + v.getUint16(vt + 28, true);
    const tho = u.subarray(dauTep, dauTep + nen);
    const xml = phuong === 0 ? new TextDecoder().decode(tho)
      : await new Response(new Blob([tho]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    return xml.replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
  }
  throw new Error(t('leo.loi.kieuTep'));
}
