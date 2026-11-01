import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { docChuDocx } from './docDocx';

/** Zip tối thiểu một mục (đủ cho bộ đọc): tiêu đề cục bộ + mục lục + cuối mục lục. */
function zip(ten: string, noi: Buffer, nen: boolean): ArrayBuffer {
  const tenB = Buffer.from(ten), du = nen ? deflateRawSync(noi) : noi;
  const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(nen ? 8 : 0, 8); loc.writeUInt32LE(du.length, 18); loc.writeUInt32LE(noi.length, 22); loc.writeUInt16LE(tenB.length, 26);
  const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(nen ? 8 : 0, 10); cen.writeUInt32LE(du.length, 20); cen.writeUInt32LE(noi.length, 24); cen.writeUInt16LE(tenB.length, 28); cen.writeUInt32LE(0, 42);
  const dauCen = loc.length + tenB.length + du.length;
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(cen.length + tenB.length, 12); eocd.writeUInt32LE(dauCen, 16);
  const b = Buffer.concat([loc, tenB, du, cen, tenB, eocd]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

const XML = '<w:document><w:body><w:p><w:r><w:t>Tờ trình &amp; phương án</w:t></w:r></w:p><w:p><w:r><w:t>Z1</w:t></w:r><w:tab/><w:r><w:t>220 căn</w:t></w:r></w:p></w:body></w:document>';

describe('docChuDocx — đọc chữ trong tệp Word', () => {
  it('giải nén deflate, xuống dòng theo đoạn, tab, giải mã &amp;', async () => {
    expect(await docChuDocx(zip('word/document.xml', Buffer.from(XML), true))).toBe('Tờ trình & phương án\nZ1\t220 căn');
  });
  it('mục lưu không nén cũng đọc được', async () => {
    expect(await docChuDocx(zip('word/document.xml', Buffer.from(XML), false))).toContain('220 căn');
  });
  it('tệp không phải zip / thiếu document.xml → lỗi rõ', async () => {
    await expect(docChuDocx(new TextEncoder().encode('khong phai zip').buffer as ArrayBuffer)).rejects.toThrow();
    await expect(docChuDocx(zip('word/khac.xml', Buffer.from(XML), true))).rejects.toThrow();
  });
});
