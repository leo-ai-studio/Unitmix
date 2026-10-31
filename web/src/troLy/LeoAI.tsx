/**
 * Khung Leo AI (trợ lý Claude trong trình soạn): lớp phủ bên phải trên máy tính, tấm toàn màn trên điện thoại — KHÔNG bóp khung giữa.
 * Trò chuyện chảy chữ (Markdown), bước công cụ gọn (mở rộng xem đầu vào / kết quả), tiến trình suy nghĩ thu gọn, dừng, cuộc mới,
 * lịch sử theo dự án (đổi tên / xoá), chép / thử lại / sửa câu cuối, đính kèm ảnh / PDF / Excel, nói (mic) + đọc to + chế độ rảnh tay,
 * chọn mô hình + mức suy nghĩ, gợi ý mô hình 0 token khi đang gõ, cài đặt khoá riêng. Logo LEO: vòng O quay khi đang chạy.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { langHienTai, t, useLang } from '../i18n/i18n';
import { BieuTuong } from '../ui/NutBieuTuong';
import type { KhoaBieuTuong } from '../ui/bieuTuong';
import { congCuTheoTen } from './congCu';
import { tomTatTrangThai } from './congCu/doc';
import type { NguCanh } from './congCu/nguCanh';
import { batDauNghe, coDoc, coNghe, docTo, dungDoc, type LoiNghe, type PhienNghe } from './giongNoi';
import { goiYMoHinh, type GoiYMH } from './goiYMoHinh';
import { GOI_Y_MO } from './heThong';
import { docCuoc, ghiCuoc, idCuoc, tenTuCau, type CuocTroChuyen } from './hoiThoai';
import { cauDungDuoc, chonNguon, docDiaChiCau, DS_NGUON, kiemCau, moDangNhapCau, type TrangThaiCau } from './cau';
import { loiTiengViet, taoKhach, type NguonKhoa } from './khachThat';
import { phanTichMd, type Inl, type KhoiMd } from './markdown';
import { cheKhoa, DS_MO_HINH, docCaiDat, docKhoaApi, ghiCaiDat, ghiKhoaApi, moHinhTheoId, type CaiDatLeo, type MaMoHinh, type MucNghi } from './moHinh';
import { chayVong, gonLichSu, type KhachClaude, type KetThuc, type SuKien, type TinNhan } from './vongLap';

export type PropsLeo = {
  ng: NguCanh;
  maDuAn: string;
  maSua: string | null;
  dong: () => void;
  /** chip xác nhận: TrinhSoan chuyển `ng.xacNhan` vào đây */
  datXacNhan: (f: (c: string) => Promise<boolean>) => void;
  /** báo đang chạy (logo thanh trên quay theo) */
  khiChay?: (dang: boolean) => void;
  /** test / kịch bản E2E: khách giả thay Claude thật (window.__leoKhachGia) */
  khachGia?: KhachClaude | null;
};

type DinhKem = { ten: string; loai: 'anh' | 'pdf' | 'bang'; khoi: Anthropic.Beta.BetaContentBlockParam; xem?: string };
type Dang = { chu: string; nghi: string; congCu: { id: string; ten: string }[] };
const DANG_RONG: Dang = { chu: '', nghi: '', congCu: [] };
const NGHI: [MucNghi, string][] = [['low', 'leo.nghi.low'], ['medium', 'leo.nghi.medium'], ['high', 'leo.nghi.high']];
const NGU_CANH = /^<ngu_canh>[\s\S]*<\/ngu_canh>$/;

const BT_NHOM: Record<string, KhoaBieuTuong> = { doc: 'leoLichSu', dieu_huong: 'leoXuong', tmb: 'leoMoi', tang: 'leoSua', khac: 'leoCaiDat', ui: 'leoGui' };

const gio = (ms: number) => new Date(ms).toLocaleString(langHienTai() === 'en' ? 'en-GB' : 'vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const fmtTyLe = (r: number) => (r >= 1 ? '1' : `1/${Math.round(1 / r)}`);

function DongMd({ c }: { c: Inl[] }) {
  return <>{c.map((x, i) => x.t === 'chu' ? x.v : x.t === 'dam' ? <strong key={i}><DongMd c={x.c} /></strong> : x.t === 'nghieng' ? <em key={i}><DongMd c={x.c} /></em>
    : x.t === 'ma' ? <code key={i}>{x.v}</code> : <a key={i} href={x.href} target="_blank" rel="noopener noreferrer"><DongMd c={x.c} /></a>)}</>;
}
function KhoiMa({ k }: { k: Extract<KhoiMd, { t: 'ma' }> }) {
  const [chep, setChep] = useState(false);
  return (
    <div class="leo-ma">
      <div class="leo-ma-dau"><span>{k.ngonNgu || t('leo.ma')}</span>
        <button type="button" class="leo-nut-nho" onClick={() => void navigator.clipboard?.writeText(k.v).then(() => { setChep(true); setTimeout(() => setChep(false), 1500); })}>
          <BieuTuong k="leoSaoChep" /><span>{chep ? t('leo.daChep') : t('leo.chep')}</span></button></div>
      <pre><code>{k.v}</code></pre>
    </div>
  );
}
export function Md({ chu }: { chu: string }) {
  const ks = useMemo(() => phanTichMd(chu), [chu]);
  return (
    <div class="leo-md">
      {ks.map((k, i) => k.t === 'h' ? (k.n <= 2 ? <h3 key={i}><DongMd c={k.c} /></h3> : <h4 key={i}><DongMd c={k.c} /></h4>)
        : k.t === 'p' ? <p key={i}><DongMd c={k.c} /></p>
        : k.t === 'ds' ? (k.so ? <ol key={i}>{k.muc.map((m, j) => <li key={j}><DongMd c={m} /></li>)}</ol> : <ul key={i}>{k.muc.map((m, j) => <li key={j}><DongMd c={m} /></li>)}</ul>)
        : k.t === 'ma' ? <KhoiMa key={i} k={k} />
        : k.t === 'bang' ? <div key={i} class="leo-bang"><table><thead><tr>{k.dau.map((c, j) => <th key={j}><DongMd c={c} /></th>)}</tr></thead>
          <tbody>{k.hang.map((h, j) => <tr key={j}>{h.map((c, l) => <td key={l}><DongMd c={c} /></td>)}</tr>)}</tbody></table></div>
        : k.t === 'trich' ? <blockquote key={i}><DongMd c={k.c} /></blockquote>
        : <hr key={i} />)}
    </div>
  );
}

/** Logo LEO hai lớp: vòng O quay khi đang chạy, dừng đúng vị trí khi xong (hết vòng hiện tại mới dừng — như initBrandSpin của kit). */
function MarkLeo({ quay, nho = false, vuong = false }: { quay: boolean; nho?: boolean; vuong?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const o = ref.current;
    if (!o) return;
    if (quay) { o.classList.add('spinning'); return; }
    const tat = () => { if (!quayRef.current) o.classList.remove('spinning'); };
    o.addEventListener('animationiteration', tat);
    if (!o.getAnimations?.().length) o.classList.remove('spinning');
    return () => o.removeEventListener('animationiteration', tat);
  }, [quay]);
  const quayRef = useRef(quay);
  quayRef.current = quay;
  const mark = (
    <span class={`mark leo-mark${nho ? ' nho' : ''}`} aria-hidden="true">
      <img class="brand-nen" src="/brand/leo_ai_mark_base.png" alt="" />
      <img ref={ref} class="brand-o" src="/brand/leo_ai_o.png" alt="" />
    </span>
  );
  // ảnh đại diện: logo nằm giữa ô vuông bo góc (logo 1041 × 682 không méo, vòng O giữ đúng tỉ lệ 1 : 1)
  return vuong ? <span class={`leo-o-vuong${nho ? ' nho' : ''}`} aria-hidden="true">{mark}</span> : mark;
}

function NutNho({ k, nhan, onClick, tat, bat }: { k: KhoaBieuTuong; nhan: string; onClick: () => void; tat?: boolean; bat?: boolean }) {
  return <button type="button" class="leo-nut-nho" title={nhan} aria-label={nhan} disabled={tat} aria-pressed={bat} onClick={onClick}><BieuTuong k={k} /></button>;
}

/** Một bước công cụ: biểu tượng + một dòng, bấm mở xem đầu vào / kết quả. */
function BuocCongCu({ ten, dauVao, ketQua, loi, dang }: { ten: string; dauVao?: unknown; ketQua?: string; loi?: boolean; dang?: boolean }) {
  const cc = congCuTheoTen.get(ten);
  const nhan = t(`leo.cc.${ten}`) !== `leo.cc.${ten}` ? t(`leo.cc.${ten}`) : ten;
  const tom = ketQua ? (loi ? ketQua : ketQua.replace(/[{}"[\]]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 90) : '';
  return (
    <details class={`leo-buoc${loi ? ' loi' : ''}${dang ? ' dang' : ''}`}>
      <summary>
        {dang ? <img class="spin-o" src="/brand/leo_ai_o.png" alt="" /> : <BieuTuong k={BT_NHOM[cc?.nhom ?? 'ui']} />}
        <b>{nhan}</b>{tom && <span class="leo-buoc-tom">{tom}</span>}
      </summary>
      {dauVao !== undefined && <pre class="leo-json">{JSON.stringify(dauVao, null, 1)}</pre>}
      {ketQua && <pre class="leo-json">{ketQua}</pre>}
    </details>
  );
}

/** Đọc tệp đính kèm thành khối nội dung API: ảnh (thu ≤ 1600 px), PDF (document), Excel / CSV (đổi sang CSV chữ). */
async function docTep(f: File): Promise<DinhKem> {
  const b64 = (buf: ArrayBuffer) => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
  if (f.type.startsWith('image/')) {
    const url = URL.createObjectURL(f);
    const img = await new Promise<HTMLImageElement>((ok, loi) => { const i = new Image(); i.onload = () => ok(i); i.onerror = loi; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    const data = cv.toDataURL('image/jpeg', 0.85);
    URL.revokeObjectURL(url);
    return { ten: f.name || 'anh.jpg', loai: 'anh', xem: data, khoi: { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: data.split(',')[1] } } };
  }
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
    if (f.size > 5_000_000) throw new Error(t('leo.loi.tepLon'));
    return { ten: f.name, loai: 'pdf', khoi: { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64(await f.arrayBuffer()) }, title: f.name } };
  }
  if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await f.arrayBuffer());
    const chu = wb.SheetNames.slice(0, 5).map((n) => `## ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n]).slice(0, 30_000)}`).join('\n\n');
    return { ten: f.name, loai: 'bang', khoi: { type: 'text', text: `<tep ten="${f.name}">\n${chu}\n</tep>` } };
  }
  throw new Error(t('leo.loi.kieuTep'));
}

const khoiNguoiDung = (m: TinNhan) => (typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content ?? []) as Anthropic.Beta.BetaContentBlockParam[];
const laCauHoi = (m: TinNhan) => m.role === 'user' && !khoiNguoiDung(m).some((b) => b.type === 'tool_result');
const chuCauHoi = (m: TinNhan) => khoiNguoiDung(m).filter((b) => b.type === 'text' && !NGU_CANH.test((b as { text: string }).text)).map((b) => (b as { text: string }).text).join('\n');
const chuTraLoi = (m: TinNhan) => khoiNguoiDung(m).filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n\n');

export function LeoAI(p: PropsLeo) {
  const [lang] = useLang();
  const [cai, setCai] = useState<CaiDatLeo>(docCaiDat);
  const [khoaApi, setKhoaApi] = useState<string | null>(docKhoaApi);
  const [ds, setDs] = useState<CuocTroChuyen[]>(() => docCuoc(p.maDuAn));
  const [cuocId, setCuocId] = useState<string | null>(() => docCuoc(p.maDuAn)[0]?.id ?? null);
  const [man, setMan] = useState<'chat' | 'lichSu' | 'caiDat'>('chat');
  const [cau, setCau] = useState('');
  const [kem, setKem] = useState<DinhKem[]>([]);
  const [dang, setDang] = useState<Dang | null>(null);
  const [loi, setLoi] = useState<{ chu: string; can?: 'khoa' } | null>(null);
  const [hoi, setHoi] = useState<{ cau: string; xong: (b: boolean) => void } | null>(null);
  const [ve, setVe] = useState(0);
  const [goiY, setGoiY] = useState<GoiYMH | null>(null);
  const [nghe, setNghe] = useState<{ phien: PhienNghe; goc: string } | null>(null);
  const [ranhTay, setRanhTay] = useState(false);
  const [chungCo, setChungCo] = useState<boolean | null>(null);
  const [cuoiDay, setCuoiDay] = useState(true);
  const [sapTen, setSapTen] = useState<string | null>(null);
  const [nhapKhoa, setNhapKhoa] = useState('');
  /** cầu Claude trên máy (undefined = đang dò, null = không trả lời) */
  const [cauTT, setCauTT] = useState<TrangThaiCau | null | undefined>(undefined);
  const huy = useRef<AbortController | null>(null);
  const thanRef = useRef<HTMLDivElement>(null);
  const oNhap = useRef<HTMLTextAreaElement>(null);
  const tepRef = useRef<HTMLInputElement>(null);
  const ranhTayRef = useRef(false);
  ranhTayRef.current = ranhTay;

  const cuoc = ds.find((c) => c.id === cuocId) ?? null;
  const moHinh: MaMoHinh = (cuoc?.moHinh as MaMoHinh) ?? (cai.moHinh === 'tu_chon' ? 'claude-sonnet-5-5' : cai.moHinh);
  const [nghiCuoc, setNghiCuoc] = useState<MucNghi>(cai.nghi);
  const chay = !!dang;
  const nguonDung: NguonKhoa = chonNguon(cai.nguon, { khoaRieng: !!khoaApi, cau: cauDungDuoc(cauTT ?? null) });

  useEffect(() => { p.khiChay?.(chay); }, [chay]);
  useEffect(() => () => { huy.current?.abort(); dungDoc(); p.khiChay?.(false); }, []);
  // chip xác nhận cho công cụ (xoá PA, tải tệp, bấm nút nhạy cảm)
  useEffect(() => { p.datXacNhan((c) => new Promise((xong) => setHoi({ cau: c, xong: (b) => { setHoi(null); xong(b); } }))); }, []);
  // dò cầu Claude trên máy: lúc mở, mỗi 20 s, và ngay khi mở Cài đặt (0 token)
  const doCau = () => kiemCau().then(setCauTT);
  useEffect(() => { void doCau(); const h = setInterval(doCau, 20_000); return () => clearInterval(h); }, []);
  useEffect(() => { if (man === 'caiDat') void doCau(); }, [man]);
  useEffect(() => { if (man === 'caiDat' && chungCo === null) fetch('/api/ai/trang-thai').then((r) => r.json()).then((j: { coKhoaChung?: boolean }) => setChungCo(!!j.coKhoaChung), () => setChungCo(false)); }, [man]);
  // Esc đóng (khi không đang hỏi)
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape' && !hoi) { if (man !== 'chat') setMan('chat'); else p.dong(); } };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [man, hoi]);

  // Gợi ý mô hình khi đang gõ: chạy trên máy (0 token), chờ 400 ms sau phím cuối
  useEffect(() => {
    const h = setTimeout(() => setGoiY(goiYMoHinh(cau, { coDinhKem: kem.length > 0, manHinh: p.ng.ui.lay().buoc, soLuot: cuoc?.lichSu.length ?? 0 })), 400);
    return () => clearTimeout(h);
  }, [cau, kem.length]);

  // ô nhập tự giãn
  useEffect(() => { const o = oNhap.current; if (!o) return; o.style.height = 'auto'; o.style.height = `${Math.min(o.scrollHeight, 180)}px`; }, [cau]);
  // cuộn xuống khi có chữ mới (nếu đang ở đáy)
  useEffect(() => { const th = thanRef.current; if (th && cuoiDay) th.scrollTop = th.scrollHeight; }, [ve, dang, cuocId, hoi, loi]);

  const luuDs = (moi: CuocTroChuyen[]) => { setDs(moi); ghiCuoc(p.maDuAn, moi); };
  const datCai = (c: Partial<CaiDatLeo>) => { const m = { ...cai, ...c }; setCai(m); ghiCaiDat(m); };
  const datMoHinhCuoc = (id: MaMoHinh, nghi?: MucNghi) => {
    if (nghi) setNghiCuoc(nghi);
    if (cuoc) luuDs(ds.map((c) => (c.id === cuoc.id ? { ...c, moHinh: id } : c)));
    else datCai({ moHinh: id });
  };

  const cuocMoi = () => { if (chay) return; setCuocId(null); setLoi(null); setMan('chat'); setNghiCuoc(cai.nghi); oNhap.current?.focus(); };

  async function guiCau(chuCau: string, dinhKem: DinhKem[] = [], tuCuoc?: CuocTroChuyen) {
    const chuSach = chuCau.trim();
    if ((!chuSach && !dinhKem.length) || chay) return;
    setLoi(null);
    dungDoc();
    // mô hình: Tự chọn = áp gợi ý; người dùng đã chọn riêng cho cuộc thì giữ
    let mh = moHinh, nghi = nghiCuoc;
    const gy = goiYMoHinh(chuSach, { coDinhKem: dinhKem.length > 0, manHinh: p.ng.ui.lay().buoc });
    if (cai.moHinh === 'tu_chon' && !cuoc?.moHinh && gy) { mh = gy.moHinh; nghi = gy.nghi; }
    const bay = Date.now();
    const goc: CuocTroChuyen = tuCuoc ?? cuoc ?? { id: idCuoc(), ten: tenTuCau(chuSach || dinhKem[0]?.ten || ''), tao: bay, sua: bay, lichSu: [], luc: [] };
    const lichSu = gonLichSu(goc.lichSu);
    const luc = [...goc.luc];
    const nguCanh = `<ngu_canh>${JSON.stringify(tomTatTrangThai(p.ng, false))}</ngu_canh>`;
    lichSu.push({ role: 'user', content: [{ type: 'text', text: nguCanh }, ...dinhKem.map((d) => d.khoi), ...(chuSach ? [{ type: 'text' as const, text: chuSach }] : [])] });
    luc.push(bay);
    let hienTai: CuocTroChuyen = { ...goc, lichSu, luc, sua: bay };
    const capNhat = () => { hienTai = { ...hienTai, lichSu: [...lichSu], luc: [...luc], sua: Date.now() }; setDs((d) => [hienTai, ...d.filter((c) => c.id !== hienTai.id)]); setVe((n) => n + 1); };
    setCuocId(goc.id);
    capNhat();
    setCau(''); setKem([]); setCuoiDay(true);
    const ac = new AbortController();
    huy.current = ac;
    setDang({ ...DANG_RONG });
    // khách giả chỉ nhận ở bản dev (kịch bản E2E scripts/leo_ai_e2e.mjs), bản build bỏ qua
    const gia = p.khachGia ?? (import.meta.env.DEV ? (window as unknown as { __leoKhachGia?: KhachClaude }).__leoKhachGia : undefined);
    const khach: KhachClaude & { nguon?: NguonKhoa } = gia ?? taoKhach({ nguon: nguonDung, khoaRieng: khoaApi, maDuAn: p.maDuAn, maSua: p.maSua, diaChiCau: docDiaChiCau() });
    let kt: KetThuc | null = null;
    try {
      kt = await chayVong({
        khach, moHinh: mh, nghi, lichSu, ng: p.ng, signal: ac.signal,
        khiSuKien: (s: SuKien) => {
          const soTruoc = lichSu.length;
          if (s.loai === 'chu') setDang((d) => d && { ...d, chu: d.chu + s.chu });
          else if (s.loai === 'nghi') setDang((d) => d && { ...d, nghi: d.nghi + s.chu });
          else if (s.loai === 'cong_cu_bat_dau') setDang((d) => d && { ...d, congCu: [...d.congCu, { id: s.id, ten: s.ten }] });
          else if (s.loai === 'dung_luong' || s.loai === 'luot') { setDang({ ...DANG_RONG }); queueMicrotask(() => { while (luc.length < lichSu.length) luc.push(Date.now()); capNhat(); }); }
          else if (s.loai === 'cong_cu_xong') setVe((n) => n + 1);
          void soTruoc;
        },
      });
    } catch (e) {
      setLoi(loiTiengViet(e, khach.nguon ?? 'rieng'));
    } finally {
      while (luc.length < lichSu.length) luc.push(Date.now());
      huy.current = null;
      setDang(null);
      hienTai = { ...hienTai, lichSu: [...lichSu], luc: [...luc], sua: Date.now() };
      const moi = [hienTai, ...ds.filter((c) => c.id !== hienTai.id)];
      luuDs(moi);
    }
    if (kt?.lyDo === 'tu_choi') setLoi({ chu: t('leo.loi.tuChoi') + (kt.chiTiet ? ` (${kt.chiTiet})` : '') });
    else if (kt?.lyDo === 'het_token') setLoi({ chu: t('leo.loi.hetToken') });
    else if (kt?.lyDo === 'gioi_han_vong') setLoi({ chu: t('leo.loi.gioiHanVong') });
    else if (kt?.lyDo === 'xong') {
      const cuoi = [...lichSu].reverse().find((m) => m.role === 'assistant');
      const chu = cuoi ? chuTraLoi(cuoi) : '';
      if (chu && (cai.docTo || ranhTayRef.current) && coDoc()) {
        await docTo(chu, lang);
        if (ranhTayRef.current) batNghe(true);
      } else if (ranhTayRef.current) batNghe(true);
    }
  }

  const gui = () => void guiCau(cau, kem);
  const dung = () => { huy.current?.abort(); nghe?.phien.huy(); setNghe(null); dungDoc(); setRanhTay(false); };

  /** Cắt cuộc về trước câu hỏi cuối rồi chạy lại (thử lại) hoặc đưa câu đó vào ô nhập (sửa). */
  const viTriCauCuoi = () => { if (!cuoc) return -1; for (let i = cuoc.lichSu.length - 1; i >= 0; i--) if (laCauHoi(cuoc.lichSu[i])) return i; return -1; };
  const thuLai = () => {
    const i = viTriCauCuoi();
    if (!cuoc || i < 0 || chay) return;
    const cauCu = chuCauHoi(cuoc.lichSu[i]);
    const cat = { ...cuoc, lichSu: cuoc.lichSu.slice(0, i), luc: cuoc.luc.slice(0, i) };
    void guiCau(cauCu, [], cat);
  };
  const suaCau = () => {
    const i = viTriCauCuoi();
    if (!cuoc || i < 0 || chay) return;
    setCau(chuCauHoi(cuoc.lichSu[i]));
    luuDs(ds.map((c) => (c.id === cuoc.id ? { ...c, lichSu: c.lichSu.slice(0, i), luc: c.luc.slice(0, i) } : c)));
    oNhap.current?.focus();
  };

  function batNghe(tuGui = false) {
    if (nghe) { nghe.phien.dung(); return; }
    if (!coNghe()) { setLoi({ chu: t('leo.giong.khongHoTro') }); setRanhTay(false); return; }
    const goc = tuGui ? '' : cau;
    const phien = batDauNghe(lang, {
      khiTam: (chu) => setCau((goc ? goc + ' ' : '') + chu),
      khiXong: (chu) => {
        setNghe(null);
        const day = ((goc ? goc + ' ' : '') + chu).trim();
        if (ranhTayRef.current && day) void guiCau(day, []);
      },
      khiLoi: (l: LoiNghe) => { setNghe(null); if (l !== 'khong_nghe_thay' || !ranhTayRef.current) setLoi({ chu: t(`leo.giong.${l}`) }); if (l !== 'khong_nghe_thay') setRanhTay(false); },
    });
    if (phien) setNghe({ phien, goc });
  }

  const themTep = async (fs: FileList | File[]) => {
    try { const r = await Promise.all([...fs].slice(0, 4).map(docTep)); setKem((k) => [...k, ...r].slice(0, 4)); } catch (e) { setLoi({ chu: e instanceof Error ? e.message : String(e) }); }
  };

  // ---------- vẽ ----------
  const lichSu = cuoc?.lichSu ?? [];
  const ketQuaCua = new Map<string, { noiDung: string; loi: boolean }>();
  for (const m of lichSu) if (m.role === 'user') for (const b of khoiNguoiDung(m)) if (b.type === 'tool_result') ketQuaCua.set(b.tool_use_id, { noiDung: typeof b.content === 'string' ? b.content : JSON.stringify(b.content), loi: !!b.is_error });
  const iCuoiTraLoi = (() => { for (let i = lichSu.length - 1; i >= 0; i--) if (lichSu[i].role === 'assistant') return i; return -1; })();
  // nút chép / đọc to chỉ ở câu trả lời CUỐI mỗi lượt (tin assistant không nối tiếp bằng kết quả công cụ), không ở các bước giữa
  const laCuoiLuot = (i: number) => { const sau = lichSu[i + 1]; return !sau || laCauHoi(sau); };
  const iCauCuoi = viTriCauCuoi();
  const buoc = p.ng.ui.lay();
  const goiYMo = GOI_Y_MO[buoc.xem === 'chi_phi' ? 'chi_phi' : buoc.buoc];

  const tin: ComponentChildren[] = [];
  lichSu.forEach((m, i) => {
    const luc = cuoc?.luc[i];
    if (m.role === 'user') {
      if (!laCauHoi(m)) return;
      const ks = khoiNguoiDung(m);
      const chu = chuCauHoi(m);
      tin.push(
        <div key={i} class="leo-tin nguoi" title={luc ? gio(luc) : undefined}>
          <div class="leo-bong">
            {ks.filter((b) => b.type === 'image' || b.type === 'document' || (b.type === 'text' && (b as { text: string }).text.startsWith('<tep'))).map((b, j) => (
              <span key={j} class="leo-kem-chip">{b.type === 'image' ? t('leo.kem.anh') : b.type === 'document' ? t('leo.kem.pdf') : t('leo.kem.bang')}</span>))}
            {chu && <div class="leo-chu-nguoi">{chu.replace(/<tep[\s\S]*<\/tep>/g, '').trim()}</div>}
          </div>
          {i === iCauCuoi && !chay && <div class="leo-hanh-dong">
            <NutNho k="leoSaoChep" nhan={t('leo.chep')} onClick={() => void navigator.clipboard?.writeText(chu)} />
            <NutNho k="leoSua" nhan={t('leo.sua')} onClick={suaCau} />
          </div>}
        </div>,
      );
      return;
    }
    const ks = (m.content ?? []) as Anthropic.Beta.BetaContentBlock[];
    const chu = chuTraLoi(m);
    tin.push(
      <div key={i} class="leo-tin may" title={luc ? gio(luc) : undefined}>
        <MarkLeo quay={false} nho vuong />
        <div class="leo-noi-dung">
          {ks.map((b, j) => b.type === 'thinking' ? (b.thinking.trim() ? <details key={j} class="leo-nghi"><summary>{t('leo.tienTrinh')}</summary><Md chu={b.thinking} /></details> : null)
            : b.type === 'text' ? <Md key={j} chu={b.text} />
            : b.type === 'tool_use' ? <BuocCongCu key={j} ten={b.name} dauVao={b.input} ketQua={ketQuaCua.get(b.id)?.noiDung} loi={ketQuaCua.get(b.id)?.loi} dang={chay && !ketQuaCua.has(b.id)} />
            : null)}
          {chu && laCuoiLuot(i) && <div class="leo-hanh-dong">
            <NutNho k="leoSaoChep" nhan={t('leo.chep')} onClick={() => void navigator.clipboard?.writeText(chu)} />
            {coDoc() && <NutNho k="leoLoa" nhan={t('leo.docTo')} onClick={() => void docTo(chu, lang)} />}
            {i === iCuoiTraLoi && !chay && <NutNho k="leoThuLai" nhan={t('leo.thuLai')} onClick={thuLai} />}
          </div>}
        </div>
      </div>,
    );
  });

  const mhHien = moHinhTheoId(moHinh);
  const khacGoiY = goiY && (goiY.moHinh !== moHinh || goiY.nghi !== nghiCuoc);

  return (
    <aside class="leo-ai" role="dialog" aria-label={t('leo.ten')} data-lang={lang}>
      <header class="leo-dau">
        <MarkLeo quay={chay} vuong />
        <div class="leo-ten"><strong>{t('leo.ten')}</strong><small>{t(`leo.nguon.${nguonDung === 'cau' ? 'cau' : nguonDung === 'rieng' && khoaApi ? 'rieng' : 'chung'}`)} ·{mhHien.ten.replace('Claude ', '')}</small></div>
        <span class="gian" />
        <NutNho k="leoLichSu" nhan={t('leo.lichSu')} bat={man === 'lichSu'} onClick={() => setMan(man === 'lichSu' ? 'chat' : 'lichSu')} />
        <NutNho k="leoMoi" nhan={t('leo.cuocMoi')} tat={chay} onClick={cuocMoi} />
        <NutNho k="leoCaiDat" nhan={t('leo.caiDat')} bat={man === 'caiDat'} onClick={() => setMan(man === 'caiDat' ? 'chat' : 'caiDat')} />
        <NutNho k="leoDong" nhan={t('leo.dong')} onClick={p.dong} />
      </header>

      {man === 'lichSu' && (
        <div class="leo-trang">
          <h3>{t('leo.lichSu')}</h3>
          {!ds.length && <p class="muted">{t('leo.lichSuRong')}</p>}
          <ul class="leo-ds-cuoc">
            {ds.map((c) => (
              <li key={c.id} class={c.id === cuocId ? 'chon' : ''}>
                {sapTen === c.id
                  ? <input class="leo-o-ten" value={c.ten} autoFocus onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v) luuDs(ds.map((x) => (x.id === c.id ? { ...x, ten: v } : x))); setSapTen(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                  : <button type="button" class="leo-cuoc" onClick={() => { setCuocId(c.id); setMan('chat'); setLoi(null); }}><b>{c.ten}</b><small>{gio(c.sua)}</small></button>}
                <NutNho k="leoSua" nhan={t('leo.doiTen')} onClick={() => setSapTen(c.id)} />
                <NutNho k="leoDong" nhan={t('leo.xoaCuoc')} tat={chay && c.id === cuocId} onClick={() => { if (confirm(t('leo.xoaCuocHoi'))) { luuDs(ds.filter((x) => x.id !== c.id)); if (c.id === cuocId) setCuocId(null); } }} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {man === 'caiDat' && (
        <div class="leo-trang">
          <h3>{t('leo.caiDat')}</h3>
          <section class="leo-muc">
            <b>{t('leo.cau.tieuDe')}</b>
            <p class="muted">{t('leo.cau.giaiThich')}</p>
            <p class="leo-cau-tt" role="status">
              {cauTT === undefined ? '…'
                : !cauTT ? t('leo.cau.khongThay')
                : !cauTT.ok ? t('leo.cau.chuaCaiClaude')
                : cauTT.dangNhap === false ? t('leo.cau.chuaDangNhap')
                : `${t('leo.cau.daNoi')}${cauTT.taiKhoan ? ` · ${cauTT.taiKhoan}` : ''}`}
            </p>
            <div class="leo-hang">
              <button type="button" class="nut-phu" onClick={() => { setCauTT(undefined); void doCau(); }}>{t('leo.cau.kiemLai')}</button>
              {cauTT && cauTT.ok && cauTT.dangNhap === false && <button type="button" class="nut-chinh" onClick={() => { void moDangNhapCau().then(() => setTimeout(doCau, 4000)); }}>{t('leo.cau.dangNhap')}</button>}
            </div>
            <label class="leo-chon-nguon">
              <span>{t('leo.nguon.tieuDe')}</span>
              <select value={cai.nguon} onChange={(e) => datCai({ nguon: e.currentTarget.value as typeof cai.nguon })}>
                {DS_NGUON.map((k) => <option key={k} value={k}>{t(`leo.nguon.chon.${k}`)}</option>)}
              </select>
            </label>
          </section>
          <section class="leo-muc">
            <b>{t('leo.khoa.tieuDe')}</b>
            <p class="muted">{t('leo.khoa.giaiThich')}</p>
            {khoaApi ? (
              <div class="leo-hang"><code>{cheKhoa(khoaApi)}</code><button type="button" class="nut-phu" onClick={() => { ghiKhoaApi(null); setKhoaApi(null); }}>{t('leo.khoa.xoa')}</button></div>
            ) : (
              <form class="leo-hang" onSubmit={(e) => { e.preventDefault(); if (nhapKhoa.trim()) { ghiKhoaApi(nhapKhoa); setKhoaApi(nhapKhoa.trim()); setNhapKhoa(''); } }}>
                <input type="password" autoComplete="off" spellcheck={false} placeholder="sk-ant-…" value={nhapKhoa} onInput={(e) => setNhapKhoa(e.currentTarget.value)} aria-label={t('leo.khoa.tieuDe')} />
                <button type="submit" class="nut-chinh" disabled={!nhapKhoa.trim()}>{t('leo.khoa.luu')}</button>
              </form>
            )}
            <p class="muted">{khoaApi ? t('leo.khoa.dangDungRieng') : chungCo === null ? '…' : chungCo ? t('leo.khoa.coChung') : t('leo.khoa.khongChung')}</p>
          </section>
          <section class="leo-muc">
            <b>{t('leo.moHinh')}</b>
            <label class="leo-chon"><input type="radio" name="leo-mh" checked={cai.moHinh === 'tu_chon'} onChange={() => datCai({ moHinh: 'tu_chon' })} /><span><b>{t('leo.tuChon')}</b><small>{t('leo.tuChonGiai')}</small></span></label>
            {DS_MO_HINH.map((m) => (
              <label key={m.id} class="leo-chon"><input type="radio" name="leo-mh" checked={cai.moHinh === m.id} onChange={() => datCai({ moHinh: m.id })} />
                <span><b>{m.ten}{m.id === 'claude-sonnet-5-5' ? ` · ${t('leo.macDinh')}` : ''}</b><small>{t(m.moTa)}</small></span></label>
            ))}
          </section>
          <section class="leo-muc">
            <b>{t('leo.nghi')}</b>
            <div class="nhom-nut">{NGHI.map(([k, n]) => <button key={k} type="button" aria-pressed={cai.nghi === k} onClick={() => { datCai({ nghi: k }); setNghiCuoc(k); }}>{t(n)}</button>)}</div>
          </section>
          <section class="leo-muc">
            <label class="leo-chon"><input type="checkbox" checked={cai.docTo} disabled={!coDoc()} onChange={(e) => datCai({ docTo: e.currentTarget.checked })} /><span><b>{t('leo.docToTuDong')}</b><small>{coDoc() ? t('leo.docToGiai') : t('leo.giong.khongDoc')}</small></span></label>
          </section>
          <p class="muted">{t('leo.chiPhiGhiChu')}</p>
        </div>
      )}

      {man === 'chat' && (
        <div class="leo-than" ref={thanRef} onScroll={(e) => { const el = e.currentTarget; setCuoiDay(el.scrollHeight - el.scrollTop - el.clientHeight < 40); }}>
          {!lichSu.length && !dang && (
            <div class="leo-chao">
              <MarkLeo quay={false} />
              <h2>{t('leo.chao')}</h2>
              <p>{t('leo.chaoGiai')}</p>
              <div class="leo-goi-y-mo">{goiYMo.map((k) => <button key={k} type="button" onClick={() => void guiCau(t(k))}>{t(k)}</button>)}</div>
            </div>
          )}
          {tin}
          {dang && (
            <div class="leo-tin may dang">
              <MarkLeo quay nho vuong />
              <div class="leo-noi-dung">
                {dang.nghi.trim() && <details class="leo-nghi" open><summary>{t('leo.tienTrinh')}</summary><Md chu={dang.nghi} /></details>}
                {dang.chu && <Md chu={dang.chu} />}
                {dang.congCu.map((c) => <BuocCongCu key={c.id} ten={c.ten} dang />)}
                {!dang.chu && !dang.nghi && !dang.congCu.length && <p class="muted leo-dang-nghi"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" />{t('leo.dangNghi')}</p>}
              </div>
            </div>
          )}
          {hoi && (
            <div class="leo-hoi" role="alertdialog" aria-label={hoi.cau}>
              <p>{hoi.cau}</p>
              <div class="leo-hang"><button type="button" class="nut-chinh" onClick={() => hoi.xong(true)}>{t('leo.dongY')}</button><button type="button" class="nut-phu" onClick={() => hoi.xong(false)}>{t('leo.khong')}</button></div>
            </div>
          )}
          {loi && (
            <div class="leo-loi" role="alert">
              <p>{loi.chu}</p>
              {loi.can === 'khoa' && <button type="button" class="nut-phu" onClick={() => setMan('caiDat')}>{t('leo.moCaiDat')}</button>}
            </div>
          )}
        </div>
      )}
      {man === 'chat' && !cuoiDay && <button type="button" class="leo-xuong" aria-label={t('leo.xuongCuoi')} title={t('leo.xuongCuoi')} onClick={() => { const th = thanRef.current; if (th) th.scrollTop = th.scrollHeight; setCuoiDay(true); }}><BieuTuong k="leoXuong" /></button>}

      {man === 'chat' && (
        <div class="leo-soan" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer?.files.length) void themTep(e.dataTransfer.files); }}>
          {kem.length > 0 && <div class="leo-kem">{kem.map((k, i) => (
            <span key={i} class="leo-kem-chip">{k.xem ? <img src={k.xem} alt="" /> : null}{k.ten}<button type="button" aria-label={t('leo.boKem')} onClick={() => setKem(kem.filter((_, j) => j !== i))}>×</button></span>))}</div>}
          <textarea ref={oNhap} rows={1} value={cau} placeholder={nghe ? t('leo.dangNghe') : t('leo.nhapCau')} aria-label={t('leo.nhapCau')}
            onInput={(e) => setCau(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); gui(); } }}
            onPaste={(e) => { const fs = [...(e.clipboardData?.files ?? [])]; if (fs.length) { e.preventDefault(); void themTep(fs); } }} />
          {khacGoiY && goiY && (
            <div class="leo-goi-y-mh" role="status">
              <span>{t('leo.goiY')}: <b>{moHinhTheoId(goiY.moHinh).ten.replace('Claude ', '')} · {t(`leo.nghi.${goiY.nghi}`)}</b> — {t(goiY.lyDo)} <small>(≈ {fmtTyLe(goiY.tyLe)} {t('leo.chiPhiOpus')})</small></span>
              <button type="button" class="leo-nut-chu" onClick={() => datMoHinhCuoc(goiY.moHinh, goiY.nghi)}>{t('leo.apDung')}</button>
              {cai.moHinh !== 'tu_chon' && <button type="button" class="leo-nut-chu" onClick={() => datCai({ moHinh: 'tu_chon' })}>{t('leo.luonTuChon')}</button>}
            </div>
          )}
          <div class="leo-soan-duoi chan-hop">
            <input ref={tepRef} type="file" hidden multiple accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv" onChange={(e) => { const f = e.currentTarget.files; if (f?.length) void themTep(f); e.currentTarget.value = ''; }} />
            <NutNho k="leoKem" nhan={t('leo.dinhKem')} tat={chay} onClick={() => tepRef.current?.click()} />
            <select class="leo-chon-mh" aria-label={t('leo.moHinh')} value={`${moHinh}|${nghiCuoc}`} disabled={chay}
              onChange={(e) => { const [m, n] = e.currentTarget.value.split('|'); datMoHinhCuoc(m as MaMoHinh, n as MucNghi); }}>
              {DS_MO_HINH.map((m) => NGHI.map(([n, nn]) => <option key={`${m.id}|${n}`} value={`${m.id}|${n}`} title={t(m.moTa)}>{m.ten.replace('Claude ', '')} · {t(nn)}</option>))}
            </select>
            {cai.moHinh === 'tu_chon' && !cuoc?.moHinh && <span class="leo-the">{t('leo.tuChon')}</span>}
            <span class="gian" />
            {coNghe() && <NutNho k="leoGiong" nhan={t('leo.ranhTay')} bat={ranhTay} onClick={() => { if (ranhTay) { setRanhTay(false); nghe?.phien.huy(); setNghe(null); dungDoc(); } else { setRanhTay(true); ranhTayRef.current = true; batNghe(true); } }} />}
            <button type="button" class={`leo-mic${nghe ? ' dang' : ''}`} aria-label={nghe ? t('leo.dungNghe') : t('leo.noi')} title={nghe ? t('leo.dungNghe') : t('leo.noi')} aria-pressed={!!nghe} onClick={() => batNghe()}><BieuTuong k="leoMic" /></button>
            {chay
              ? <button type="button" class="leo-gui dung" aria-label={t('leo.dung')} title={t('leo.dung')} onClick={dung}><BieuTuong k="leoDung" /></button>
              : <button type="button" class="leo-gui" aria-label={t('leo.gui')} title={t('leo.gui')} disabled={!cau.trim() && !kem.length} onClick={gui}><BieuTuong k="leoGui" /></button>}
          </div>
          <p class="leo-chan">{t('leo.chan')}</p>
        </div>
      )}
    </aside>
  );
}
