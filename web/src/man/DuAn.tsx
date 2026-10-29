import { nhanPhienBan } from '../phienBan';
import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { api, type DuAnApi } from '../api';
import { t, useLang } from '../i18n/i18n';
import { useDongHop } from '../ui/useDongHop';
import { dsDuAnDaMo, ghiNhoDuAn, layMaSua, linkSua, linkXem, luuMaSua, phanTichLink } from '../kho/maSua';
import { taoPAMoi } from '../tinh/macDinh';
import { LOAI_CAN } from '../tinh/kieu';
import { ChonLang, ThuongHieu } from '../ui/ThanhTren';
import { fmtSo } from '../ui/so';
import { luoi } from '../ui/Luoi';

// So sánh PA (kèm tính chi phí): chunk riêng, tải khi mở hộp.
const SoSanhPA = luoi(() => import('./SoSanhPA').then((m) => m.SoSanhPA), 'hop');

type Dong = { ma: string; da: DuAnApi | null; loi: boolean };

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

/** Màn 0 · Dự án của tôi: các dự án đã mở trên máy này, mỗi dự án kèm tóm tắt phương án. */
export function DuAn() {
  const [lang] = useLang();
  const { route } = useLocation();
  const [dong, setDong] = useState<Dong[]>(() => dsDuAnDaMo().map((d) => ({ ma: d.ma, da: null, loi: false })));
  const [moTao, setMoTao] = useState(false);
  const [link, setLink] = useState('');
  const [loiLink, setLoiLink] = useState(false);
  const [suaDa, setSuaDa] = useState<{ ma: string; ten: string; diaDiem: string } | null>(null);
  const [suaPA, setSuaPA] = useState<{ ma: string; id: string; ten: string } | null>(null);
  const [loiHang, setLoiHang] = useState('');
  const [soSanh, setSoSanh] = useState<string | null>(null);

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
    if (!confirm(t('duAn.xoaHoi').replace('{ten}', ten))) return;
    await ghi(ma, (m) => api.xoaPA(ma, id, m));
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

  /** Nhân bản một phương án trong cùng dự án (cần mã sửa); lỗi thì báo, thành công thì nạp lại danh sách. */
  async function nhanBan(ma: string, id: string) {
    await ghi(ma, (m) => api.nhanBan(ma, id, m));
  }

  return (
    <div class="khung">
      <header class="thanh-tren">
        <ThuongHieu />
        <span class="gian" />
        <ChonLang />
      </header>
      <main class="trang">
        <h1>{t('duAn.tieuDe')}</h1>
        <p style={{ margin: 0, textAlign: 'center', color: 'var(--muted-text)' }}>{t('duAn.moTa')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
          <form onSubmit={moLink} style={{ display: 'flex', gap: '8px', flex: '1 1 360px' }}>
            <input aria-label={t('duAn.danLink')} placeholder={t('duAn.danLink')} value={link}
              onInput={(e) => { setLink(e.currentTarget.value); setLoiLink(false); }}
              style={{ flex: 1, padding: '8px', border: '1px solid var(--line)', borderRadius: '5px' }} />
            <button type="submit" class="nut-phu">{t('duAn.mo')}</button>
          </form>
          <button type="button" class="nut-chinh" onClick={() => setMoTao(true)}>{t('duAn.moi')}</button>
        </div>
        {loiLink && <p class="vuot" role="alert" style={{ margin: 0 }}>{t('duAn.linkSai')}</p>}

        {!dong.length && <p style={{ color: 'var(--muted-text)' }}>{t('duAn.trong')}</p>}
        {dong.map(({ ma, da, loi }) => {
          const coMa = !!layMaSua(ma);
          return (
            <section class="bang-du-an" key={ma} aria-label={da?.ten ?? ma}>
              <div class="hang dau">
                {suaDa?.ma === ma ? (
                  <form class="sua-ten" style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); luuTenDa(); }}>
                    <input aria-label={t('duAn.ten')} value={suaDa.ten} required autoFocus onInput={(e) => setSuaDa({ ...suaDa, ten: e.currentTarget.value })} />
                    <input aria-label={t('duAn.diaDiem')} placeholder={t('duAn.diaDiem')} value={suaDa.diaDiem} onInput={(e) => setSuaDa({ ...suaDa, diaDiem: e.currentTarget.value })} />
                    <button type="submit" class="nut-chinh">{t('duAn.luu')}</button>
                    <button type="button" class="nut-phu" onClick={() => setSuaDa(null)}>{t('duAn.huy')}</button>
                  </form>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{da ? `${da.ten}${da.dia_diem ? ' · ' + da.dia_diem : ''}` : ma}</span>
                    {coMa && da && <button type="button" class="nut-phu" onClick={() => { setSuaPA(null); setSuaDa({ ma, ten: da.ten, diaDiem: da.dia_diem }); }}>{t('duAn.doiTenDA')}</button>}
                  </>
                )}
                {!coMa && <span class="so">{t('duAn.chiXem')}</span>}
                <span class="so">{t('duAn.soPA')}: <b>{da ? da.phuong_an.length : '—'}</b></span>
                {da && da.phuong_an.length >= 2 && <button type="button" class="nut-phu" onClick={() => setSoSanh(ma)}>{t('ss.nut')}</button>}
                <code style={{ fontSize: '12px' }}>{linkXem(ma).replace(/^https?:\/\//, '')}</code>
                <ChepNut chu={linkXem(ma)} />
              </div>
              {loi && <div class="hang vuot">{t('duAn.khongTai')}</div>}
              {loiHang && (suaDa?.ma === ma || suaPA?.ma === ma || da?.phuong_an.length) ? <div class="hang vuot" role="alert">{loiHang}</div> : null}
              {da?.phuong_an.map((p) => (
                <div class="hang" key={p.id}>
                  <span style={{ width: '120px' }}>{new Date(p.sua_luc).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB')}</span>
                  {suaPA?.ma === ma && suaPA.id === p.id ? (
                    <form class="sua-ten" style={{ width: '260px' }} onSubmit={(e) => { e.preventDefault(); luuTenPA(); }}>
                      <input aria-label={t('duAn.tenPA')} value={suaPA.ten} required autoFocus onInput={(e) => setSuaPA({ ...suaPA, ten: e.currentTarget.value })} />
                      <button type="submit" class="nut-chinh">{t('duAn.luu')}</button>
                      <button type="button" class="nut-phu" onClick={() => setSuaPA(null)}>{t('duAn.huy')}</button>
                    </form>
                  ) : <b style={{ width: '200px' }}>{p.ten}</b>}
                  <span style={{ flex: 1 }} />
                  {LOAI_CAN.map((l) => (
                    <span class="so" key={l}>{t(`loai.${l}`)}: <b>{fmtSo(p.tom_tat.coCau?.[l] ?? null)}</b></span>
                  ))}
                  <span class="so">{t('duAn.tongCan')}: <b>{fmtSo(p.tom_tat.soCan ?? null)}</b></span>
                  <span class="so">{t('duAn.dtSan')}: <b>{fmtSo(p.tom_tat.dtSan ?? null, { donVi: 'm²' })}</b></span>
                  {coMa && <button type="button" class="nut-phu" onClick={() => { setSuaDa(null); setSuaPA({ ma, id: p.id, ten: p.ten }); }}>{t('duAn.doiTenPA')}</button>}
                  {coMa && <button type="button" class="nut-phu" onClick={() => nhanBan(ma, p.id)}>{t('duAn.nhanBan')}</button>}
                  {coMa && <button type="button" class="nut-phu nut-xoa" onClick={() => xoaPA(ma, p.id, p.ten)}>{t('duAn.xoaPA')}</button>}
                  <a class="nut-chinh" href={`/du-an/${ma}?pa=${p.id}`}>{t('duAn.moPA')}</a>
                </div>
              ))}
            </section>
          );
        })}
      </main>
      <footer class="chan-trang">{t('app.tacGia')} · <span class="phien-ban">{nhanPhienBan()}</span></footer>
      {moTao && <HopTaoDuAn dong={() => setMoTao(false)} />}
      {soSanh && dong.find((x) => x.ma === soSanh)?.da && <SoSanhPA ma={soSanh} da={dong.find((x) => x.ma === soSanh)!.da!} dong={() => setSoSanh(null)} />}
    </div>
  );
}
