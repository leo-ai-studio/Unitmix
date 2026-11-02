import { useState } from 'preact/hooks';
import { api, LoiApi, type Toi } from '../api';
import { t, useLang } from '../i18n/i18n';
import '../styles/chao.css';

type Buoc = 'vao' | 'dk' | 'gui' | 'cho' | 'tuChoi' | 'saiMien';

/** Buớc mở đầu theo trạng thái của người đang vào: chưa đăng nhập / chưa khai hồ sơ / chờ duyệt / bị từ chối / sai miền. */
function buocDau(toi: Toi): Buoc {
  if (!toi.email) return 'vao';
  if (toi.lyDo === 'sai_mien') return 'saiMien';
  if (toi.trangThai === 'tu_choi') return 'tuChoi';
  return toi.daDangKy ? 'cho' : 'dk';
}

const Ic = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>
);

/**
 * Màn chờ đăng nhập / đăng ký phủ lên trang chủ (nền là trang app bị làm mờ). Chỉ hiện khi máy chủ yêu cầu đăng nhập công ty
 * (`toi.yeuCau`) và người này chưa được tạo dự án. Link dự án (`/du-an/…`) vẫn mở tự do, không qua màn này.
 */
export function ChaoDangNhap({ toi, napLai }: { toi: Toi; napLai: () => Promise<void> }) {
  const [lang, setLang] = useLang();
  const [buoc, setBuoc] = useState<Buoc>(() => buocDau(toi));
  const [hoTen, setHoTen] = useState('');
  const [mail, setMail] = useState('');
  const [phong, setPhong] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState('');
  const [dangKiem, setDangKiem] = useState(false);
  const mien = toi.mien || 'meygroup.vn';
  const daDn = !!toi.email;

  const dangNhap = () => { location.href = `${toi.dangNhap}?quay=${encodeURIComponent(location.pathname + location.search)}`; };
  const doiMail = () => { location.href = '/cdn-cgi/access/logout'; };
  const kiemLai = async () => {
    setDangKiem(true);
    try { await napLai(); } finally { setDangKiem(false); }
  };

  async function gui(e: Event) {
    e.preventDefault();
    setLoi('');
    const email = daDn ? toi.email! : `${mail.trim().replace(/@.*$/, '')}@${mien}`;
    setDangGui(true);
    try {
      await api.dangKy({ email, ho_ten: hoTen, phong, ghi_chu: ghiChu });
      setBuoc(daDn ? 'cho' : 'gui');
      if (daDn) await napLai();
    } catch (x) {
      setLoi(t(x instanceof LoiApi && x.trangThai === 403 ? 'chao.loiMien' : x instanceof LoiApi && x.trangThai === 400 ? 'chao.loiThieu' : 'soan.loiMang').replace('{mien}', mien));
    } finally {
      setDangGui(false);
    }
  }

  return (
    <div class="chao" role="dialog" aria-modal="true" aria-labelledby="chao-tieu-de">
      <main class="chao-the">
        <div class="chao-logo"><img alt="" src="/brand/leo_ai_o.png" /></div>
        <h1 class="chao-ten">UNITMIX</h1>
        <p class="chao-khau">{t('chao.khau')}</p>
        <div class="chao-gach" />

        {buoc === 'vao' && (
          <section>
            <h2 id="chao-tieu-de">{t('chao.vaoTieuDe')}</h2>
            <p class="chao-mota">{t('chao.vaoMoTa')}</p>
            <button type="button" class="chao-nut chinh" onClick={dangNhap}><Ic d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />{t('chao.dangNhap')}</button>
            <button type="button" class="chao-nut phu" onClick={() => setBuoc('dk')}><Ic d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M19 8v6M22 11h-6M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />{t('chao.dangKy')}</button>
            <div class="chao-luu-y"><Ic d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" /><span>{t('chao.luuY').replace('{mien}', mien)}</span></div>
          </section>
        )}

        {buoc === 'dk' && (
          <section>
            <div class="chao-buoc" aria-hidden="true"><i class="on" /><i /></div>
            <h2 id="chao-tieu-de">{t(daDn ? 'chao.hoanTat' : 'chao.dkTieuDe')}</h2>
            <p class="chao-mota">{t(daDn ? 'chao.hoanTatMoTa' : 'chao.dkMoTa')}</p>
            <form onSubmit={gui}>
              <label>{t('chao.hoTen')}
                <input required value={hoTen} maxLength={80} autoComplete="name" placeholder="Nguyễn Văn A" onInput={(e) => setHoTen(e.currentTarget.value)} />
              </label>
              <label>{t('chao.mail')}
                {daDn ? <input readOnly value={toi.email!} /> : (
                  <span class="chao-mien">
                    <input required value={mail} autoComplete="username" placeholder="ten.ban" onInput={(e) => setMail(e.currentTarget.value)} />
                    <i>@{mien}</i>
                  </span>
                )}
              </label>
              <label>{t('chao.phong')} <small>{t('chao.khongBatBuoc')}</small>
                <input value={phong} maxLength={120} placeholder={t('chao.phongVD')} onInput={(e) => setPhong(e.currentTarget.value)} />
              </label>
              <label>{t('chao.ghiChu')} <small>{t('chao.khongBatBuoc')}</small>
                <textarea value={ghiChu} maxLength={500} placeholder={t('chao.ghiChuVD')} onInput={(e) => setGhiChu(e.currentTarget.value)} />
              </label>
              {loi && <p class="chao-loi" role="alert">{loi}</p>}
              <button type="submit" class="chao-nut chinh" disabled={dangGui}>{t('chao.gui')}</button>
              {!daDn && <button type="button" class="chao-nut chu" onClick={() => setBuoc('vao')}>{t('chao.quayLai')}</button>}
            </form>
          </section>
        )}

        {buoc === 'gui' && (
          <section>
            <div class="chao-buoc" aria-hidden="true"><i class="on" /><i class="on" /></div>
            <div class="chao-tron"><Ic d="M20 6 9 17l-5-5" /></div>
            <h2 id="chao-tieu-de">{t('chao.daGui')}</h2>
            <p class="chao-mota">{t('chao.daGuiMoTa')}</p>
            <div class="chao-tom">
              <div><span>{t('chao.hoTen')}</span><b>{hoTen}</b></div>
              <div><span>{t('chao.mail')}</span><b>{mail.trim().replace(/@.*$/, '')}@{mien}</b></div>
              <div><span>{t('chao.trangThai')}</span><b class="chao-tag">{t('chao.choDuyet')}</b></div>
            </div>
            <ol class="chao-cac-buoc">
              <li class="xong">{t('chao.b1')}</li>
              <li>{t('chao.b2')}</li>
              <li>{t('chao.b3')}</li>
            </ol>
            <button type="button" class="chao-nut chinh" onClick={dangNhap}>{t('chao.dangNhap')}</button>
            <button type="button" class="chao-nut chu" onClick={() => setBuoc('vao')}>{t('chao.veDau')}</button>
          </section>
        )}

        {buoc === 'cho' && (
          <section>
            <div class="chao-tron cho"><Ic d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2" /></div>
            <h2 id="chao-tieu-de">{t('chao.choTieuDe')}</h2>
            <p class="chao-mota" dangerouslySetInnerHTML={{ __html: t('chao.choMoTa').replace('{mail}', `<b>${esc(toi.email ?? '')}</b>`) }} />
            <div class="chao-tom">
              <div><span>{t('chao.hoTen')}</span><b>{toi.hoTen}</b></div>
              <div><span>{t('chao.trangThai')}</span><b class="chao-tag">{t('chao.choDuyet')}</b></div>
            </div>
            <p class="chao-mota" style={{ marginTop: '14px' }}>{t('chao.choGap')}</p>
            <button type="button" class="chao-nut chinh" disabled={dangKiem} onClick={kiemLai}>{t('chao.kiemLai')}</button>
            <button type="button" class="chao-nut chu" onClick={doiMail}>{t('chao.mailKhac')}</button>
          </section>
        )}

        {buoc === 'tuChoi' && (
          <section>
            <div class="chao-tron tu"><Ic d="M18 6 6 18M6 6l12 12" /></div>
            <h2 id="chao-tieu-de">{t('chao.tuChoiTieuDe')}</h2>
            <p class="chao-mota" dangerouslySetInnerHTML={{ __html: t('chao.tuChoiMoTa').replace('{mail}', `<b>${esc(toi.email ?? '')}</b>`) }} />
            <button type="button" class="chao-nut chinh" disabled={dangKiem} onClick={kiemLai}>{t('chao.kiemLai')}</button>
            <button type="button" class="chao-nut chu" onClick={doiMail}>{t('chao.mailKhac')}</button>
          </section>
        )}

        {buoc === 'saiMien' && (
          <section>
            <div class="chao-tron tu"><Ic d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></div>
            <h2 id="chao-tieu-de">{t('chao.saiMienTieuDe')}</h2>
            <p class="chao-mota" dangerouslySetInnerHTML={{ __html: t('chao.saiMienMoTa').replace('{mail}', `<b>${esc(toi.email ?? '')}</b>`).replace('{mien}', `<b>@${esc(mien)}</b>`) }} />
            <button type="button" class="chao-nut chinh" onClick={doiMail}>{t('chao.mailKhac')}</button>
          </section>
        )}

        <div class="chao-chan">
          <span>Unitmix · LEO AI · NghiaVT</span>
          <span class="chao-ngon" role="group" aria-label="Language">
            {(['vi', 'en'] as const).map((l) => <button type="button" key={l} class={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </span>
        </div>
      </main>
    </div>
  );
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
