/**
 * Markdown rút gọn cho câu trả lời Leo AI (không thư viện, không innerHTML): tiêu đề, đoạn, danh sách, bảng, khối mã (có nút chép),
 * trích dẫn, đường kẻ; chữ đậm / nghiêng / mã / liên kết http(s). Chịu được chữ đang chảy dở (khối mã chưa đóng = mã tới cuối).
 */
export type Inl = { t: 'chu'; v: string } | { t: 'dam'; c: Inl[] } | { t: 'nghieng'; c: Inl[] } | { t: 'ma'; v: string } | { t: 'lk'; href: string; c: Inl[] };
export type KhoiMd =
  | { t: 'h'; n: number; c: Inl[] }
  | { t: 'p'; c: Inl[] }
  | { t: 'ds'; so: boolean; muc: Inl[][] }
  | { t: 'ma'; ngonNgu: string; v: string }
  | { t: 'bang'; dau: Inl[][]; hang: Inl[][][] }
  | { t: 'trich'; c: Inl[] }
  | { t: 'ke' };

export function phanTichDong(s: string): Inl[] {
  const ra: Inl[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/;
  let con = s;
  while (con) {
    const m = re.exec(con);
    if (!m) { ra.push({ t: 'chu', v: con }); break; }
    if (m.index) ra.push({ t: 'chu', v: con.slice(0, m.index) });
    const x = m[0];
    if (m[1]) ra.push({ t: 'ma', v: x.slice(1, -1) });
    else if (m[2]) ra.push({ t: 'dam', c: phanTichDong(x.slice(2, -2)) });
    else if (m[3]) ra.push({ t: 'nghieng', c: phanTichDong(x.slice(1, -1)) });
    else if (m[4]) { const i = x.indexOf(']('); ra.push({ t: 'lk', href: m[5], c: phanTichDong(x.slice(1, i)) }); }
    con = con.slice(m.index + x.length);
  }
  return ra;
}

const oBang = (d: string) => d.trim().replace(/^\||\|$/g, '').split('|').map((x) => phanTichDong(x.trim()));
const laKeBang = (d: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(d);

export function phanTichMd(chu: string): KhoiMd[] {
  const dong = chu.replace(/\r/g, '').split('\n');
  const ra: KhoiMd[] = [];
  let doan: string[] = [];
  const dongDoan = () => { if (doan.length) { ra.push({ t: 'p', c: phanTichDong(doan.join(' ')) }); doan = []; } };
  for (let i = 0; i < dong.length; i++) {
    const d = dong[i];
    const rao = /^\s*```\s*([\w-]*)\s*$/.exec(d);
    if (rao) {
      dongDoan();
      const ma: string[] = [];
      i++;
      while (i < dong.length && !/^\s*```\s*$/.test(dong[i])) ma.push(dong[i++]);
      ra.push({ t: 'ma', ngonNgu: rao[1], v: ma.join('\n') });
      continue;
    }
    if (!d.trim()) { dongDoan(); continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(d);
    if (h) { dongDoan(); ra.push({ t: 'h', n: h[1].length, c: phanTichDong(h[2]) }); continue; }
    if (/^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(d)) { dongDoan(); ra.push({ t: 'ke' }); continue; }
    if (d.includes('|') && i + 1 < dong.length && laKeBang(dong[i + 1])) {
      dongDoan();
      const dau = oBang(d);
      const hang: Inl[][][] = [];
      i += 2;
      while (i < dong.length && dong[i].includes('|') && dong[i].trim()) hang.push(oBang(dong[i++]));
      i--;
      ra.push({ t: 'bang', dau, hang });
      continue;
    }
    const ds = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(d);
    if (ds) {
      dongDoan();
      const so = /\d/.test(ds[1]);
      const muc: Inl[][] = [phanTichDong(ds[2])];
      while (i + 1 < dong.length) {
        const m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(dong[i + 1]);
        if (!m || /\d/.test(m[1]) !== so) break;
        muc.push(phanTichDong(m[2]));
        i++;
      }
      ra.push({ t: 'ds', so, muc });
      continue;
    }
    if (/^>\s?/.test(d)) { dongDoan(); ra.push({ t: 'trich', c: phanTichDong(d.replace(/^>\s?/, '')) }); continue; }
    doan.push(d.trim());
  }
  dongDoan();
  return ra;
}
