/**
 * Hộp THƯ VIỆN MẪU TÒA · MẪU CĂN: xem, kiểm quy tắc, thử phá và đặt vào lô các mẫu tòa / mẫu căn của thư viện (33 + 34) và các mẫu
 * tòa người dùng đã lưu (kho/mauToaLuu.ts); xuất / nhập tệp JSON; kiểm cả thư viện (tinh/kiemThuVien.ts). Lớp phủ `.hop-thoai`
 * (portal, khung giữa không đổi). Trạng thái cấp module (không lưu PA). Sửa mẫu tòa làm ở màn Tầng (panel "Mẫu tòa · lõi thang máy").
 */
import { useEffect, useState } from 'preact/hooks';
import { t, useLang } from '../i18n/i18n';
import { choDuLieuMB } from '../man/tuChinhTang';
import { docMauToaLuu, doiTenMauToaLuu, ghiMauToaLuu, nhapMauToaLuu, taoToaTuMauLuu, xoaMauToaLuu, xuatMauToaLuu, type MauToaLuu } from '../kho/mauToaLuu';
import { taoToaTrenLo } from '../tinh/hopLo';
import { kiemMauCan, type KetQuaThuVien, type ViPhamCan } from '../tinh/kiemThuVien';
import type { Ctx, ViPhamMau } from '../tinh/kiemMauToa';
import type { CanMau, Lo, ThuVien, ToaDat, ToaMau, TrangThaiPA } from '../tinh/kieu';
import { laCaoTang } from '../tinh/loaiDat';
import { toaAo } from '../tinh/soSanhMau';
import type { KetQuaThu } from '../tinh/thuMauToa';
import { dieuPhoiTay } from '../tinh/tayNen';
import { xacNhan } from './HopHoi';
import { chuViPham, chuViPhamCan } from './chuKiem';
import { LopNoi } from './LopNoi';
import { fmtSo } from './so';
import { useDongHop } from './useDongHop';
import '../styles/thu-vien-mau.css';

type Tab = 'toa' | 'can' | 'luu' | 'kiem';
type TrangThai = { mo: boolean; tab: Tab };
let tt: TrangThai = { mo: false, tab: 'toa' };
const nghe = new Set<() => void>();
const datTT = (p: Partial<TrangThai>) => { tt = { ...tt, ...p }; nghe.forEach((f) => f()); };
function useTT(): TrangThai {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); nghe.add(f); return () => void nghe.delete(f); }, []);
  return tt;
}
/** Mở hộp thư viện (tab mẫu tòa mặc định). */
export const moThuVienMau = (tab: Tab = tt.tab) => datTT({ mo: true, tab });
export const dongThuVienMau = () => datTT({ mo: false });

type Props = { pa: TrangThaiPA; tv: ThuVien | null; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; loId: string | null; daDat?: (loId: string, toaId: string) => void };
export function HopThuVienMau(p: Props) {
  const s = useTT();
  if (!s.mo || !p.tv) return null;
  return <LopNoi><NoiDung {...p} tv={p.tv} /></LopNoi>;
}

const idMoi = () => `toa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const tenNgan = (m: ToaMau) => m.ten_vi;

type KqDong = { loai: 'toa'; vi: ViPhamMau[]; soCan: number } | { loai: 'can'; vi: ViPhamCan[] } | { loai: 'thu'; thu: KetQuaThu };

function NoiDung({ pa, tv, sua, chiXem, loId, daDat }: Props & { tv: ThuVien }) {
  useLang();
  const s = useTT();
  const { lop, dongMem } = useDongHop(dongThuVienMau);
  const [dl, setDl] = useState<Ctx['dl']>(null);
  const [luu, setLuu] = useState<MauToaLuu[]>(() => docMauToaLuu());
  const [kq, setKq] = useState<Record<string, KqDong>>({});
  const [bao, setBao] = useState<string | null>(null);
  const [dangTen, setDangTen] = useState<{ id: string; ten: string } | null>(null);
  const [kiemAll, setKiemAll] = useState<KetQuaThuVien | 'dang' | null>(null);
  const [nhom, setNhom] = useState<'tm' | 'xh'>('tm');
  const [dangLam, setDangLam] = useState<string | null>(null); // mẫu đang kiểm / thử nền
  const loDs = pa.lo.filter(laCaoTang);
  const lo: Lo | null = pa.lo.find((l) => l.id === loId && laCaoTang(l)) ?? loDs[0] ?? null;

  // hình lõi + tim cửa mọi mẫu: tải một lần khi mở (cùng đường với hộp so sánh mẫu)
  useEffect(() => {
    let huy = false;
    const paAo: TrangThaiPA = { ...pa, toa: [...tv.toa.keys()].map((id) => toaAo(id, 'tv', 24, 1)) };
    void choDuLieuMB(paAo, tv).then((d) => { if (!huy) setDl(d); });
    return () => { huy = true; };
  }, [tv]);
  const ctx: Ctx | null = dl ? { tv, dl } : null;

  const ghiKq = (k: string, v: KqDong) => setKq((x) => ({ ...x, [k]: v }));
  const datMau = (mauId: string, taoToa: (lo: Lo, id: string) => ToaDat | null, ten: string) => {
    if (!lo) { setBao(t('tv.chonLo')); return; }
    const moi = taoToa(lo, idMoi());
    if (!moi) return;
    sua((x) => ({ ...x, toa: [...x.toa, moi] }));
    setBao(t('tv.daDat').replace('{ten}', ten).replace('{lo}', lo.temDat.kyHieu));
    daDat?.(lo.id, moi.id);
    void mauId;
  };
  const toaThuVien = (m: ToaMau): ToaDat => toaMoi(m.id);
  const kiemToa = async (m: ToaMau) => {
    if (!ctx) return;
    setDangLam(m.id);
    const r = await dieuPhoiTay.chay('kiemToaThuVien', ctx, m);
    setDangLam((x) => (x === m.id ? null : x));
    if (r) ghiKq(m.id, { loai: 'toa', vi: r.vi, soCan: r.soCan });
  };
  const thuToa = async (m: ToaMau) => {
    if (!ctx) return;
    setDangLam(m.id);
    const r = await dieuPhoiTay.chay('thuToaThuVien', ctx, toaThuVien(m), { hat: 7, buoc: 24, hanMs: 8000 });
    setDangLam((x) => (x === m.id ? null : x));
    if (r) ghiKq(m.id, { loai: 'thu', thu: r });
  };
  const kiemCan = (c: CanMau) => ghiKq(c.id, { loai: 'can', vi: kiemMauCan(c, tv) });
  const luuDoi = (ds: MauToaLuu[]) => { setLuu(ds); if (!ghiMauToaLuu(ds)) setBao(t('mt.luuLoi')); };
  const chayKiemAll = async () => {
    if (!ctx) return;
    setKiemAll('dang');
    setKiemAll(await dieuPhoiTay.chay('kiemThuVien', ctx));
  };
  const xuat = () => {
    const url = URL.createObjectURL(new Blob([xuatMauToaLuu(luu)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'mau-toa-da-luu.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const nhap = async (f: File | undefined) => {
    if (!f) return;
    const r = nhapMauToaLuu(await f.text(), luu, tv);
    if (!r) { setBao(t('tv.nhapLoi')); return; }
    luuDoi(r.ds);
    setBao(t('tv.nhapXong').replace('{nhan}', String(r.nhan)).replace('{bo}', String(r.bo)));
  };

  const dsToa = [...tv.toa.values()].filter((m) => m.nhom === nhom).sort((a, b) => a.hinh.localeCompare(b.hinh) || a.so - b.so);
  const dsCan = [...tv.can.values()].filter((c) => !c.stretchGoc && c.nhom === nhom);
  const kqToa = (id: string) => {
    const r = kq[id];
    if (!r) return null;
    if (r.loai === 'thu') {
      return (
        <div class="tvm-kq" role="status">
          <b class={r.thu.soLoi ? 'vuot' : 'ok'}>{t('mt.thuXong').replace('{buoc}', String(r.thu.soBuoc)).replace('{nhan}', String(r.thu.soNhan)).replace('{tuChoi}', String(r.thu.soTuChoi)).replace('{loi}', String(r.thu.soLoi))}</b>
          <ul>{r.thu.loi.slice(0, 6).map((b) => <li key={b.buoc} class="vuot"><i>{t('mt.buoc').replace('{b}', String(b.buoc)).replace('{op}', b.op)}</i> — {b.vi.map(chuViPham).join(' ')}</li>)}</ul>
        </div>
      );
    }
    if (r.loai === 'toa') {
      const loi = r.vi.filter((v) => v.muc === 'loi').length;
      return (
        <div class="tvm-kq" role="status">
          <b class={loi ? 'vuot' : 'ok'}>{loi ? t('mt.kiemLoi').replace('{loi}', String(loi)).replace('{canhBao}', String(r.vi.length - loi)) : t('tv.sach')}</b>
          <ul>{r.vi.slice(0, 10).map((v, i) => <li key={i} class={v.muc === 'loi' ? 'vuot' : 'canh'}>{chuViPham(v)}</li>)}</ul>
        </div>
      );
    }
    return null;
  };

  const tab = (k: Tab, nhan: string) => <button type="button" aria-pressed={s.tab === k} onClick={() => datTT({ tab: k })}>{nhan}</button>;
  return (
    <div class={`hop-thoai${lop}`} role="dialog" aria-modal="true" aria-labelledby="tieu-de-tvm" onClick={(e) => { if (e.target === e.currentTarget) dongMem(); }}>
      <div class="hop-rong thu-vien-mau">
        <div class="tvm-dau">
          <h2 id="tieu-de-tvm">{t('tv.tieuDe')}</h2>
          <button type="button" class="nut-phu" onClick={dongMem}>{t('tv.dong')}</button>
        </div>
        <p class="muted tvm-ghi">{t('tv.moTa')}</p>
        <div class="nhom-nut" role="tablist">
          {tab('toa', t('tv.tabToa'))}{tab('can', t('tv.tabCan'))}{tab('luu', `${t('tv.tabLuu')} · ${luu.length}`)}{tab('kiem', t('tv.tabKiem'))}
        </div>
        {(s.tab === 'toa' || s.tab === 'can') && (
          <div class="nhom-nut" role="group">
            {(['tm', 'xh'] as const).map((k) => <button key={k} type="button" aria-pressed={nhom === k} onClick={() => setNhom(k)}>{t(k === 'tm' ? 'xep.nhomTm' : 'xep.nhomXh')}</button>)}
          </div>
        )}
        {bao && <p class="ok tvm-bao" role="status">{bao}</p>}

        {s.tab === 'toa' && (
          <div class="tvm-ds">
            {dsToa.map((m) => (
              <div class="tvm-the" key={m.id}>
                <div class="tvm-hang">
                  <b>{tenNgan(m)}</b>
                  <span class="muted">{t('tv.canTang').replace('{n}', String(m.so_can_tang))} · {fmtSo(m.dtxd_m2, { donVi: 'm²' })}</span>
                  <span class="tvm-nut">
                    <button type="button" disabled={!ctx} onClick={() => (dangLam === m.id ? dieuPhoiTay.huy() : void kiemToa(m))}>{dangLam === m.id ? t('mt.huy') : t('tv.kiem')}</button>
                    <button type="button" disabled={!ctx || dangLam === m.id} onClick={() => void thuToa(m)}>{dangLam === m.id ? t('mt.thuDang') : t('tv.thu')}</button>
                    <button type="button" class="nut-phu" disabled={chiXem || !lo} onClick={() => datMau(m.id, (l, id) => taoToaTrenLo(m, l, id), m.ten_vi)}>{t('tv.dat')}</button>
                  </span>
                </div>
                {kqToa(m.id)}
              </div>
            ))}
          </div>
        )}

        {s.tab === 'can' && (
          <div class="tvm-ds">
            {dsCan.map((c) => {
              const r = kq[c.id];
              return (
                <div class="tvm-the" key={c.id}>
                  <div class="tvm-hang">
                    <b>{c.ten_vi}</b>
                    <span class="muted">{t('tv.mauCanDong').replace('{r}', String(c.rong_mm)).replace('{s}', String(c.sau_mm)).replace('{dt}', fmtSo(c.dt_tt_m2))}</span>
                    <span class="tvm-nut"><button type="button" onClick={() => kiemCan(c)}>{t('tv.kiem')}</button></span>
                  </div>
                  {r?.loai === 'can' && (
                    <div class="tvm-kq" role="status">
                      <b class={r.vi.some((v) => v.muc === 'loi') ? 'vuot' : 'ok'}>{r.vi.length ? '' : t('tv.sach')}</b>
                      <ul>{r.vi.map((v, i) => <li key={i} class={v.muc === 'loi' ? 'vuot' : 'canh'}>{chuViPhamCan(v)}</li>)}</ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {s.tab === 'luu' && (
          <div class="tvm-ds">
            <div class="tvm-hang">
              <button type="button" disabled={!luu.length} onClick={xuat}>{t('tv.xuat')}</button>
              <label class="nut-phu tvm-nhap">{t('tv.nhap')}<input type="file" accept="application/json,.json" hidden onChange={(e) => { void nhap(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} /></label>
            </div>
            {!luu.length && <p class="muted">{t('tv.chuaLuu')}</p>}
            {luu.map((m) => (
              <div class="tvm-the" key={m.id}>
                <div class="tvm-hang">
                  {dangTen?.id === m.id
                    ? <input type="text" value={dangTen.ten} maxLength={60} aria-label={t('tv.dongTen')} onInput={(e) => setDangTen({ id: m.id, ten: e.currentTarget.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { luuDoi(doiTenMauToaLuu(luu, m.id, dangTen.ten)); setDangTen(null); } if (e.key === 'Escape') setDangTen(null); }} />
                    : <b>{m.ten}</b>}
                  <span class="muted">{tv.toa.get(m.mauId)?.ten_vi ?? m.mauId}{m.soCan ? ` · ${t('tv.canTang').replace('{n}', String(m.soCan))}` : ''}{m.ngay ? ` · ${m.ngay}` : ''}</span>
                  <span class="tvm-nut">
                    <button type="button" class="nut-phu" disabled={chiXem || !lo} onClick={() => datMau(m.mauId, (l, id) => taoToaTuMauLuu(m, tv, l, id), m.ten)}>{t('tv.dat')}</button>
                    <button type="button" onClick={() => (dangTen?.id === m.id ? (luuDoi(doiTenMauToaLuu(luu, m.id, dangTen.ten)), setDangTen(null)) : setDangTen({ id: m.id, ten: m.ten }))}>{t('tv.doiTen')}</button>
                    <button type="button" onClick={() => { void xacNhan(`${t('tv.xoa')} “${m.ten}”?`).then((ok) => { if (ok) luuDoi(xoaMauToaLuu(luu, m.id)); }); }}>{t('tv.xoa')}</button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {s.tab === 'kiem' && (
          <div class="tvm-ds">
            <div class="tvm-hang">
              <button type="button" class="nut-chinh" disabled={!ctx} onClick={() => (kiemAll === 'dang' ? dieuPhoiTay.huy() : void chayKiemAll())}>{kiemAll === 'dang' ? `${t('tv.dangKiem')} · ${t('mt.huy')}` : t('tv.chayKiem')}</button>
              {kiemAll && kiemAll !== 'dang' && <b class={kiemAll.soLoi ? 'vuot' : 'ok'}>{t('tv.kiemXong').replace('{toa}', String(kiemAll.toa.length)).replace('{can}', String(kiemAll.can.length)).replace('{loi}', String(kiemAll.soLoi)).replace('{canhBao}', String(kiemAll.soCanhBao))}</b>}
            </div>
            {kiemAll && kiemAll !== 'dang' && (
              <>
                {kiemAll.toa.filter((x) => x.vi.length).map((x) => (
                  <div class="tvm-the" key={x.id}><b>{x.ten}</b><ul class="tvm-kq">{x.vi.slice(0, 8).map((v, i) => <li key={i} class={v.muc === 'loi' ? 'vuot' : 'canh'}>{chuViPham(v)}</li>)}</ul></div>
                ))}
                {kiemAll.can.filter((x) => x.vi.some((v) => v.muc === 'loi')).map((x) => (
                  <div class="tvm-the" key={x.id}><b>{x.ten}</b><ul class="tvm-kq">{x.vi.map((v, i) => <li key={i} class={v.muc === 'loi' ? 'vuot' : 'canh'}>{chuViPhamCan(v)}</li>)}</ul></div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Tòa thử đặt mẫu thư viện `mauId` (24 tầng, như các bài quét). */
const toaMoi = (mauId: string): ToaDat => ({ id: 'tv-thu', loId: 'tv', mauId, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} });
