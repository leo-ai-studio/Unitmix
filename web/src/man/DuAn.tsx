import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { api, LoiApi, type Toi } from '../api';
import { t, useLang } from '../i18n/i18n';
import { useDongHop } from '../ui/useDongHop';
import {
  boKhoiDanhSach, dsDuAnDaMo, ghiNhoDuAn, hoanTacBo, layMaSua, layTenNguoi, luuTenNguoi, linkChiaSe, linkSua, linkXem, luuMaSua, phanTichLink, type LoaiLink,
} from '../kho/maSua';
import { taoPAMoi } from '../tinh/macDinh';
import { LOAI_CAN } from '../tinh/kieu';
import { ChonLang, TacGiaBan, ThuongHieu } from '../ui/ThanhTren';
import { BieuTuong, NutBieuTuong } from '../ui/NutBieuTuong';
import { fmtSo } from '../ui/so';
import { luoi } from '../ui/Luoi';
import { ChaoDangNhap } from './ChaoDangNhap';
import { xacNhan } from '../ui/HopHoi';
import { locDuAn, sapDuAn, type CachSap, type DongDuAn } from './locDuAn';

// So sánh PA (kèm tính chi phí): chunk riêng, tải khi mở hộp.
const SoSanhPA = luoi(() => import('./SoSanhPA').then((m) => m.SoSanhPA), 'hop');

function ChepNut({ chu }: { chu: string }) {
  const [daChep, setDaChep] = useState(false);
  return (
    <button type="button" class="nut-phu" onClick={() => navigator.clipboard?.writeText(chu).then(() => setDaChep(true))}>
      {t(daChep ? 'duAn.daChep' : 'duAn.chep')}
    </button>
  );
}

/** Hộp tạo dự án; tạo xong hiện mã sửa đúng một lần. */
function HopTaoDuAn({ dong }: { dong: () => void }) {
  const { lop, dongMem } = useDongHop(dong);
  const { route } = useLocation();
  const [ten, setTen] = useState('');
  const [diaDiem, setDiaDiem] = useState('');
  const [dangTao, setDangTao] = useState(false);
  const [loi, setLoi] = useState('');
  const [kq, setKq] = useState<{ ma: string; ma_sua: string } | null>(null);

  async function tao(e: Event) {
    e.preventDefault();
    setDangTao(true);
    setLoi('');
    try {
      const r = await api.taoDuAn(ten, diaDiem);
      luuMaSua(r.ma, r.ma_sua);
      await api.ghiPA(r.ma, 'pa-1', r.ma_sua, t('pa.mau'), taoPAMoi(), {});
      ghiNhoDuAn(r.ma, ten || r.ma);
      setKq(r);
    } catch {
      setLoi(t('soan.loiMang'));
    } finally {
      setDangTao(false);
    }
  }

  return (
    <div class={`hop-thoai${lop}`} role="dialog" aria-modal="true" aria-labelledby="tieu-de-tao">
      {!kq ? (
        <form onSubmit={tao}>
          <h2 id="tieu-de-tao">{t('duAn.moi').replace('+ ', '')}</h2>
          <label>{t('duAn.ten')}<input value={ten} onInput={(e) => setTen(e.currentTarget.value)} required autoFocus /></label>
          <label>{t('duAn.diaDiem')}<input value={diaDiem} onInput={(e) => setDiaDiem(e.currentTarget.value)} /></label>
          {loi && <p class="vuot" role="alert">{loi}</p>}
          <div class="chan-hop">
            <button type="button" class="nut-phu" onClick={dongMem}>{t('duAn.huy')}</button>
            <button type="submit" class="nut-chinh" disabled={dangTao}>
              {dangTao && <img class="spin-o" src="/brand/leo_ai_o.png" alt="" style={{ width: '16px', height: '16px', verticalAlign: '-3px', marginRight: '6px', filter: 'invert(1)' }} />}
              {t('duAn.tao')}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <h2 id="tieu-de-tao">{t('duAn.daTao')}</h2>
          <p class="canh-bao" style={{ margin: 0 }}>{t('duAn.maSuaMotLan')}</p>
          <span>{t('duAn.linkSua')}</span>
          <div class="dong-link"><code>{linkSua(kq.ma, kq.ma_sua)}</code><ChepNut chu={linkSua(kq.ma, kq.ma_sua)} /></div>
          <span>{t('duAn.linkXem')}</span>
          <div class="dong-link"><code>{linkXem(kq.ma)}</code><ChepNut chu={linkXem(kq.ma)} /></div>
          <div class="chan-hop">
            <button type="button" class="nut-chinh" onClick={() => route(`/du-an/${kq.ma}`)}>{t('duAn.moDuAn')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Báo nhỏ ở đáy trang (đã chép link, đã bỏ khỏi danh sách + Hoàn tác). */
type BaoNho = { chu: string; hoanTac?: () => void };

/**
 * Nút chép đường dẫn. Máy giữ mã sửa → menu nhỏ hai lựa chọn: link chỉ xem · link có thể sửa (kèm mã sửa).
 * Không có mã sửa → bấm là chép link xem luôn (không đưa ra lựa chọn link sửa).
 */
function NutChepLink({ ma, coMa, chep }: { ma: string; coMa: boolean; chep: (loai: LoaiLink) => void }) {
  const [mo, setMo] = useState(false);
  const boc = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mo) return;
    const dong = (e: Event) => { if (!boc.current?.contains(e.target as Node)) setMo(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMo(false); };
    addEventListener('pointerdown', dong); addEventListener('keydown', esc);
    boc.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    return () => { removeEventListener('pointerdown', dong); removeEventListener('keydown', esc); };
  }, [mo]);
  if (!coMa) return <NutBieuTuong k="chepLink" nhan={t('duAn.chepXemNut')} onClick={() => chep('xem')} />;
  const muc = (loai: LoaiLink) => (
    <button type="button" role="menuitem" class={`muc-link ${loai}`} onClick={() => { setMo(false); chep(loai); }}>
      <b>{t(loai === 'xem' ? 'duAn.chepXem' : 'duAn.chepSua')}</b>
      <small>{t(loai === 'xem' ? 'duAn.chepXemGt' : 'duAn.chepSuaGt')}</small>
    </button>
  );
  return (
    <div class="menu-link-boc" ref={boc}>
      <NutBieuTuong k="chepLink" moRong={mo} onClick={() => setMo((m) => !m)} />
      {mo && <div class="menu-link" role="menu" aria-label={t('bt.chepLink')}>{muc('xem')}{muc('sua')}</div>}
    </div>
  );
}

/** Màn 0 · Dự án của tôi: các dự án đã mở trên máy này, mỗi dự án một thẻ kèm bảng phương án gọn. */
export function DuAn() {
  const [lang] = useLang();
  const { route } = useLocation();
  const [dong, setDong] = useState<DongDuAn[]>(() => dsDuAnDaMo().map((d) => ({ ma: d.ma, da: null, loi: false })));
  const [moTao, setMoTao] = useState(false);
  const [link, setLink] = useState('');
  const [loiLink, setLoiLink] = useState(false);
  const [tim, setTim] = useState('');
  const [sap, setSap] = useState<CachSap>('gan');
  const [suaDa, setSuaDa] = useState<{ ma: string; ten: string; diaDiem: string } | null>(null);
  const [suaPA, setSuaPA] = useState<{ ma: string; id: string; ten: string } | null>(null);
  const [loiHang, setLoiHang] = useState('');
  const [tenBan, setTenBan] = useState(layTenNguoi);
  /** Đăng nhập công ty (Cloudflare Access): chỉ khi máy chủ bật yêu cầu thì nút Tạo / Nhân bản mới đòi đăng nhập. */
  const [toi, setToi] = useState<Toi | null>(null);
  const napToi = () => api.toi().then(setToi, () => {});
  useEffect(() => { napToi(); }, []);
  const diDangNhap = () => { location.href = `${toi?.dangNhap ?? '/api/dang-nhap'}?quay=${encodeURIComponent(location.pathname + location.search)}`; };
  /** Lý do chưa được tạo dự án (chờ duyệt / bị từ chối / sai miền) bằng chữ. */
  const lyDoChan = (x: Toi) => t(x.trangThai === 'cho' ? 'duAn.choDuyet' : x.trangThai === 'tu_choi' ? 'duAn.biTuChoi' : 'duAn.saiMien').replace('{mail}', x.email ?? '');
  /** Chặn thao tác tạo khi cần đăng nhập: chưa đăng nhập thì chuyển sang đăng nhập, sai miền thì báo. Trả true nếu được tiếp tục. */
  const duocTao = () => {
    if (!toi || !toi.yeuCau || toi.duocTao) return true;
    if (toi.email) baoNho({ chu: lyDoChan(toi) });
    else diDangNhap();
    return false;
  };
  const [soSanh, setSoSanh] = useState<string | null>(null);
  const [bao, setBao] = useState<BaoNho | null>(null);
  // Mục dự án mặc định THU GỌN (chỉ hiện đầu thẻ), bấm mũi tên để xổ bảng phương án.
  const [xo, setXo] = useState<Set<string>>(() => new Set());
  const doiXo = (ma: string) => setXo((s) => { const n = new Set(s); if (!n.delete(ma)) n.add(ma); return n; });
  const henBao = useRef(0);

  /** Hiện báo nhỏ; có Hoàn tác thì giữ lâu hơn. */
  function baoNho(b: BaoNho) {
    clearTimeout(henBao.current);
    setBao(b);
    henBao.current = window.setTimeout(() => setBao(null), b.hoanTac ? 6000 : 2400);
  }
  useEffect(() => () => clearTimeout(henBao.current), []);

  const napLai = async (ma: string) => {
    const da = await api.docDuAn(ma);
    setDong((ds) => ds.map((x) => (x.ma === ma ? { ...x, da } : x)));
    return da;
  };
  /** Chạy một thao tác ghi; lỗi thì hiện báo, thành công thì nạp lại dự án. */
  async function ghi(ma: string, viec: (maSua: string) => Promise<unknown>) {
    const maSua = layMaSua(ma);
    if (!maSua) return false;
    setLoiHang('');
    try {
      await viec(maSua);
      await napLai(ma);
      return true;
    } catch {
      setLoiHang(t('soan.loiMang'));
      return false;
    }
  }
  async function luuTenDa() {
    if (!suaDa || !suaDa.ten.trim()) return;
    const { ma, ten, diaDiem } = suaDa;
    if (await ghi(ma, (m) => api.doiTenDuAn(ma, m, ten.trim(), diaDiem.trim()))) { ghiNhoDuAn(ma, ten.trim()); setSuaDa(null); }
  }
  async function luuTenPA() {
    if (!suaPA || !suaPA.ten.trim()) return;
    const { ma, id, ten } = suaPA;
    if (await ghi(ma, (m) => api.doiTenPA(ma, id, m, ten.trim()))) setSuaPA(null);
  }
  async function xoaPA(ma: string, id: string, ten: string) {
    if (!(await xacNhan(t('duAn.xoaHoi').replace('{ten}', ten), { nguyHiem: true, dongY: t('qt.xoa') }))) return;
    await ghi(ma, (m) => api.xoaPA(ma, id, m));
  }
  /** Nhân bản một phương án trong cùng dự án (cần mã sửa); lỗi thì báo, thành công thì nạp lại danh sách. */
  async function nhanBan(ma: string, id: string) {
    await ghi(ma, (m) => api.nhanBan(ma, id, m));
  }

  /** Nhân bản cả dự án thành dự án mới (kèm mã sửa mới — người gọi là chủ bản sao), đưa lên đầu danh sách. */
  async function nhanBanDA(ma: string, ten: string) {
    if (!duocTao()) return;
    if (!(await xacNhan(t('duAn.nhanBanHoi').replace('{ten}', ten), { dongY: t('duAn.nhanBanDA') }))) return;
    setLoiHang('');
    try {
      const r = await api.nhanBanDuAn(ma, `${ten} (bản sao)`);
      luuMaSua(r.ma, r.ma_sua);
      ghiNhoDuAn(r.ma, `${ten} (bản sao)`);
      setDong((ds) => [{ ma: r.ma, da: null, loi: false }, ...ds]);
      baoNho({ chu: t('duAn.daNhanBan').replace('{ten}', ten) });
      await napLai(r.ma);
    } catch (e) {
      if (e instanceof LoiApi && e.trangThai === 401) diDangNhap();
      else if (e instanceof LoiApi && e.trangThai === 403) api.toi().then((x) => { setToi(x); baoNho({ chu: lyDoChan(x) }); }, () => baoNho({ chu: t('soan.loiMang') }));
      else baoNho({ chu: t('soan.loiMang') });
    }
  }

  /**
   * Xoá dự án = chuyển vào thùng rác (cần mã sửa). Luôn hỏi lại; quản trị khôi phục được trong số ngày giữ.
   */
  async function xoaDuAn(ma: string, ten: string) {
    if (!(await xacNhan(t('duAn.xoaDAHoi').replace('{ten}', ten), { nguyHiem: true, dongY: t('duAn.xoaDA') }))) return;
    const maSua = layMaSua(ma);
    if (!maSua) return;
    try {
      await api.xoaDuAn(ma, maSua);
      boKhoiDanhSach(ma);
      setDong((ds) => ds.filter((x) => x.ma !== ma));
      if (soSanh === ma) setSoSanh(null);
      baoNho({ chu: t('duAn.daXoaDA').replace('{ten}', ten) });
    } catch {
      baoNho({ chu: t('soan.loiMang') });
    }
  }

  /** Chép link xem / link sửa vào bộ nhớ tạm. Link sửa chỉ dựng khi máy có mã sửa (linkChiaSe trả null nếu không). */
  async function chep(ma: string, loai: LoaiLink) {
    const l = linkChiaSe(location.origin, ma, loai, layMaSua(ma));
    if (!l) return;
    try {
      await navigator.clipboard.writeText(l);
      baoNho({ chu: t(loai === 'sua' ? 'duAn.daChepSua' : 'duAn.daChepXem') });
    } catch {
      baoNho({ chu: t('duAn.khongChep').replace('{link}', l) });
    }
  }

  /**
   * Bỏ khỏi danh sách — chỉ trên máy này, KHÔNG xoá dự án trên server (không có API xoá dự án; mã sửa giữ nguyên).
   * Dự án sửa được thì hỏi lại trước; mọi trường hợp đều có Hoàn tác trong báo nhỏ.
   */
  async function boDs(ma: string, ten: string) {
    if (layMaSua(ma) && !(await xacNhan(t('duAn.boHoiSua').replace('{ten}', ten), { nguyHiem: true }))) return;
    const r = boKhoiDanhSach(ma);
    const cu = dong;
    setDong((ds) => ds.filter((x) => x.ma !== ma));
    if (soSanh === ma) setSoSanh(null);
    baoNho({
      chu: t('duAn.daBo').replace('{ten}', ten),
      hoanTac: r.bo ? () => { hoanTacBo(r.bo!, r.viTri); setDong(cu); setBao(null); } : undefined,
    });
  }

  useEffect(() => {
    dsDuAnDaMo().forEach((d) =>
      api.docDuAn(d.ma).then(
        (da) => setDong((ds) => ds.map((x) => (x.ma === d.ma ? { ...x, da } : x))),
        () => setDong((ds) => ds.map((x) => (x.ma === d.ma ? { ...x, loi: true } : x))),
      ),
    );
  }, []);

  function moLink(e: Event) {
    e.preventDefault();
    const r = phanTichLink(link);
    if (!r) return setLoiLink(true);
    if (r.maSua) luuMaSua(r.ma, r.maSua);
    route(`/du-an/${r.ma}`);
  }

  const loc = lang === 'vi' ? 'vi-VN' : 'en-GB';
  const ngay = (s: string) => new Date(s).toLocaleDateString(loc);
  const gio = (s: string) => new Date(s).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  /** Số căn (tỉ lệ % trên tổng căn của PA). */
  const kemPhanTram = (n: number | undefined, tong: number | undefined) => (
    n == null ? '—' : <>{fmtSo(n)}{tong ? <small class="pt"> ({fmtSo((n / tong) * 100, { thapPhan: 0 })}%)</small> : null}</>
  );
  const hien = sapDuAn(locDuAn(dong, tim), sap, lang);

  return (
    <div class="khung">
      <header class="thanh-tren tren-du-an">
        <ThuongHieu anBan />
        <span class="gian" />
        <TacGiaBan />
        {toi?.laQuanTri && <a class="nut-phu nut-qt" href="/quan-tri">{t('qt.vao')}{toi.soCho > 0 ? ` (${toi.soCho})` : ''}</a>}
        {toi?.yeuCau && toi.email && <span class="mail-dn" title={t('duAn.daDangNhap')}>{toi.email}</span>}
        <ChonLang />
      </header>
      <main class="trang trang-du-an">
        <div class="dau-trang">
          <div class="dau-chu">
            <h1>{t('duAn.tieuDe')}{dong.length > 0 && <span class="dem">{t('duAn.soDuAn').replace('{n}', String(dong.length))}</span>}</h1>
            <p>{t('duAn.moTaNgan')}</p>
          </div>
          <button type="button" class="nut-chinh nut-tao" onClick={() => { if (duocTao()) setMoTao(true); }}>
            <span aria-hidden="true" class="cong">+</span>{t('duAn.tao')}
          </button>
        </div>

        <div class="thanh-loc">
          {dong.length > 1 && (
            <>
              <label class="o-tim">
                <BieuTuong k="tim" />
                <input type="search" aria-label={t('bt.tim')} placeholder={t('duAn.timKiem')} value={tim} onInput={(e) => setTim(e.currentTarget.value)} />
              </label>
              <select class="chon-sap" aria-label={t('duAn.sapXep')} title={t('duAn.sapXep')} value={sap} onChange={(e) => setSap(e.currentTarget.value as CachSap)}>
                {(['gan', 'sua', 'ten'] as const).map((c) => <option key={c} value={c}>{t(`duAn.sx.${c}`)}</option>)}
              </select>
            </>
          )}
          {/* đã đăng nhập bằng mail công ty thì người sửa ghi mail thật — không cần ô tự khai tên */}
          {!toi?.email && (
            <label class="o-ten-ban" title={t('duAn.tenBanGt')}>
              <span>{t('duAn.tenBan')}</span>
              <input value={tenBan} maxLength={60} onInput={(e) => { setTenBan(e.currentTarget.value); luuTenNguoi(e.currentTarget.value); }} />
            </label>
          )}
          <form class="mo-link" onSubmit={moLink}>
            <input aria-label={t('duAn.danLink')} placeholder={t('duAn.danLink')} value={link}
              onInput={(e) => { setLink(e.currentTarget.value); setLoiLink(false); }} />
            <button type="submit" class="nut-phu">{t('duAn.mo')}</button>
          </form>
        </div>
        {loiLink && <p class="vuot" role="alert" style={{ margin: 0 }}>{t('duAn.linkSai')}</p>}
        {toi?.yeuCau && toi.email && !toi.duocTao && <p class="canh-bao cho-duyet" role="status" style={{ margin: 0 }}>{lyDoChan(toi)}</p>}

        {!dong.length && <p class="trong">{t('duAn.trong')}</p>}
        {dong.length > 0 && !hien.length && <p class="trong">{t('duAn.khongKhop').replace('{tu}', tim.trim())}</p>}
        {hien.map(({ ma, da, loi }) => {
          const coMa = !!layMaSua(ma);
          const ten = da?.ten ?? ma;
          const dangXo = xo.has(ma);
          return (
            <section class="the-du-an" key={ma} aria-label={ten}>
              <div class="the-dau">
                <button type="button" class={`nut-xo${dangXo ? ' mo' : ''}`} aria-expanded={dangXo} aria-label={t(dangXo ? 'duAn.thuGon' : 'duAn.xo')} title={t(dangXo ? 'duAn.thuGon' : 'duAn.xo')} onClick={() => doiXo(ma)} />
                {suaDa?.ma === ma ? (
                  <form class="sua-ten" onSubmit={(e) => { e.preventDefault(); luuTenDa(); }}>
                    <input aria-label={t('duAn.ten')} value={suaDa.ten} required autoFocus onInput={(e) => setSuaDa({ ...suaDa, ten: e.currentTarget.value })} />
                    <input aria-label={t('duAn.diaDiem')} placeholder={t('duAn.diaDiem')} value={suaDa.diaDiem} onInput={(e) => setSuaDa({ ...suaDa, diaDiem: e.currentTarget.value })} />
                    <button type="submit" class="nut-chinh">{t('duAn.luu')}</button>
                    <button type="button" class="nut-phu" onClick={() => setSuaDa(null)}>{t('duAn.huy')}</button>
                  </form>
                ) : (
                  <div class="the-ten">
                    <div class="dong-ten">
                      <a class="ten-da" href={`/du-an/${ma}`}>{ten}</a>
                      <span class={`nhan-quyen ${coMa ? 'sua' : 'xem'}`} title={t(coMa ? 'duAn.quyenSuaGt' : 'duAn.chiaSeGt')}>
                        {t(coMa ? 'duAn.quyenSua' : 'duAn.chiaSe')}
                      </span>
                    </div>
                    <div class="the-phu">
                      {da?.dia_diem && <span>{da.dia_diem}</span>}
                      <span>{t('duAn.soPANgan').replace('{n}', da ? String(da.phuong_an.length) : '—')}</span>
                      <code title={t('duAn.chepXem')}>{ma}</code>
                    </div>
                  </div>
                )}
                <div class="the-nut">
                  {da && da.phuong_an.length >= 2 && <NutBieuTuong k="soSanh" onClick={() => setSoSanh(ma)} />}
                  {coMa && da && <NutBieuTuong k="doiTen" nhan={t('duAn.doiTenDA')} onClick={() => { setSuaPA(null); setSuaDa({ ma, ten: da.ten, diaDiem: da.dia_diem }); }} />}
                  <NutBieuTuong k="nhanBan" nhan={t('duAn.nhanBanDA')} onClick={() => nhanBanDA(ma, ten)} />
                  <NutChepLink ma={ma} coMa={coMa} chep={(l) => chep(ma, l)} />
                  <NutBieuTuong k="boDs" onClick={() => boDs(ma, ten)} />
                  {coMa && <NutBieuTuong k="xoa" nhan={t('duAn.xoaDA')} onClick={() => xoaDuAn(ma, ten)} />}
                  <NutBieuTuong k="moDuAn" nhan={t('duAn.moDuAn')} onClick={() => route(`/du-an/${ma}`)} />
                </div>
              </div>
              {loi && <div class="the-loi vuot">{t('duAn.khongTai')}</div>}
              {loiHang && (suaDa?.ma === ma || suaPA?.ma === ma) ? <div class="the-loi vuot" role="alert">{loiHang}</div> : null}
              {dangXo && !!da?.phuong_an.length && (
                <div class="bang-pa">
                  <div class="hang-pa dau" aria-hidden="true">
                    <span>{t('duAn.soPA')}</span><span>{t('duAn.suaLuc')}</span>
                    {LOAI_CAN.map((l) => <span class="so" key={l}>{t(`loai.${l}`)}</span>)}
                    <span class="so">{t('duAn.tongCan')}</span><span class="so">{t('duAn.danSo')}</span><span class="so">{t('duAn.dtSan')}</span><span />
                  </div>
                  {da.phuong_an.map((p) => (
                    <div class={`hang-pa${suaPA?.ma === ma && suaPA.id === p.id ? ' dang-sua' : ''}`} key={p.id}>
                      {suaPA?.ma === ma && suaPA.id === p.id ? (
                        <form class="sua-ten" onSubmit={(e) => { e.preventDefault(); luuTenPA(); }}>
                          <input aria-label={t('duAn.tenPA')} value={suaPA.ten} required autoFocus onInput={(e) => setSuaPA({ ...suaPA, ten: e.currentTarget.value })} />
                          <button type="submit" class="nut-chinh">{t('duAn.luu')}</button>
                          <button type="button" class="nut-phu" onClick={() => setSuaPA(null)}>{t('duAn.huy')}</button>
                        </form>
                      ) : (
                        <>
                          <a class="ten-pa" href={`/du-an/${ma}?pa=${p.id}`}>{p.ten}</a>
                          <span class="ngay" title={p.sua_boi ? `${p.sua_boi} · ${ngay(p.sua_luc)} ${gio(p.sua_luc)}` : undefined}>
                            {ngay(p.sua_luc)} <b>{gio(p.sua_luc)}</b>
                            {p.sua_boi && <i class="nguoi-sua">{p.sua_boi}</i>}
                          </span>
                          {LOAI_CAN.map((l) => (
                            <span class="so" key={l} data-nhan={t(`loai.${l}`)}>{kemPhanTram(p.tom_tat.coCau?.[l], p.tom_tat.soCan)}</span>
                          ))}
                          <span class="so tong" data-nhan={t('duAn.tongCan')}>{fmtSo(p.tom_tat.soCan ?? null)}</span>
                          <span class="so" data-nhan={t('duAn.danSo')}>{fmtSo(p.tom_tat.danSo ?? null)}</span>
                          <span class="so" data-nhan={t('duAn.dtSan')}>{fmtSo(p.tom_tat.dtSan ?? null, { donVi: 'm²' })}</span>
                          <span class="nut-pa">
                            {coMa && <NutBieuTuong k="doiTen" nhan={t('duAn.doiTenPA')} onClick={() => { setSuaDa(null); setSuaPA({ ma, id: p.id, ten: p.ten }); }} />}
                            {coMa && <NutBieuTuong k="nhanBan" onClick={() => nhanBan(ma, p.id)} />}
                            {coMa && <span class="nut-xoa-pa"><NutBieuTuong k="xoa" nhan={t('duAn.xoaPA')} onClick={() => xoaPA(ma, p.id, p.ten)} /></span>}
                            <NutBieuTuong k="moDuAn" nhan={`${t('duAn.moPA')} · ${p.ten}`} onClick={() => route(`/du-an/${ma}?pa=${p.id}`)} />
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>
      {bao && (
        <div class="bao-nho" role="status">
          <span>{bao.chu}</span>
          {bao.hoanTac && <button type="button" onClick={bao.hoanTac}>{t('duAn.hoanTac')}</button>}
        </div>
      )}
      {toi?.yeuCau && !toi.laQuanTri && !toi.duocTao && <ChaoDangNhap toi={toi} napLai={napToi} />}
      {moTao && <HopTaoDuAn dong={() => setMoTao(false)} />}
      {soSanh && dong.find((x) => x.ma === soSanh)?.da && <SoSanhPA ma={soSanh} da={dong.find((x) => x.ma === soSanh)!.da!} dong={() => setSoSanh(null)} />}
    </div>
  );
}
