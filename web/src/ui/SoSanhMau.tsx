/**
 * Hộp SO SÁNH MẪU TÒA + GỢI Ý DẠNG TÒA (lãnh đạo 29/10/2026). Mở từ panel trái TMB (Thư viện mẫu tòa) và từ KPI màn Tầng; là lớp
 * phủ `.hop-thoai` (portal, khung giữa không đổi). Chọn họ mẫu (VD L: tm-l1 / l2 / l3) hoặc tick từng mẫu, kèm biến thể "tối ưu cơ
 * cấu + STRETCH" → đo trong Web Worker (tinh/soSanhMau.ts) → bảng sắp xếp được + hình thu nhỏ. Ô "Yêu cầu" đọc bằng luật
 * (tinh/goiYHinhToa.ts, 0 token) → trọng số tiêu chí sửa tay được → xếp hạng + top 3 kèm ưu / nhược. "Đặt vào lô…" là bước riêng.
 * Trạng thái cấp module (không lưu PA), như GoiYXepToa / Xếp hàng loạt.
 */
import { useEffect, useState } from 'preact/hooks';
import { t, useLang } from '../i18n/i18n';
import { choDuLieuMB } from '../man/tuChinhTang';
import { hopCoCau, phanTichYeuCau, TIEU_CHI, THANG, uuNhuoc, xepHang, yeuCauMacDinh, type HangMau, type Nhan, type TieuChi, type YeuCauMau } from '../tinh/goiYHinhToa';
import { taoToaTrenLo } from '../tinh/hopLo';
import { LOAI_CAN, type Diem, type LoaiCan, type Lo, type ThuVien, type ToaDat, type TrangThaiPA } from '../tinh/kieu';
import { laCaoTang } from '../tinh/loaiDat';
import { tuChinhToa, type ToaMB } from '../tinh/loiThang';
import { dsHinh, hoMau, soSanhMauNen, soTangMacDinh, soToaTheoChiTieu, toaAo, type KetQuaMau } from '../tinh/soSanhMau';
import { LopNoi } from './LopNoi';
import { BieuTuong } from './NutBieuTuong';
import { fmtSo } from './so';
import { useDongHop } from './useDongHop';
import '../styles/so-sanh-mau.css';
import { NhapChot } from './NhapChot';

type CotSap = 'hang' | 'diem' | 'soCan' | 'lech' | 'hieuSuat' | 'dtxd' | 'dtsd' | 'soThangBo' | 'soThangMay' | 'vuot' | 'danTang' | 'dai' | 'tyLeLoi' | 'diemView';
type TrangThai = {
  mo: boolean;
  nhom: 'tm' | 'xh';
  chon: string[];
  toiUu: boolean;
  soTang: number | null;
  yeuCau: string;
  yc: YeuCauMau;
  ds: KetQuaMau[] | null;
  khoaDs: string | null;
  chay: boolean;
  tienDo: number;
  loi: string | null;
  ms: number | null;
  sap: { cot: CotSap; giam: boolean };
  dat: string | null; // khoá dòng đang chọn để đặt vào lô
  loDat: string | null;
  baoDat: string | null;
};
const TT0: TrangThai = {
  mo: false, nhom: 'tm', chon: [], toiUu: true, soTang: null, yeuCau: '', yc: yeuCauMacDinh(), ds: null, khoaDs: null, chay: false,
  tienDo: 0, loi: null, ms: null, sap: { cot: 'hang', giam: false }, dat: null, loDat: null, baoDat: null,
};
let tt: TrangThai = TT0;
const nghe = new Set<() => void>();
const datTT = (p: Partial<TrangThai>) => { tt = { ...tt, ...p }; nghe.forEach((f) => f()); };
function useTT(): TrangThai {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); nghe.add(f); return () => void nghe.delete(f); }, []);
  return tt;
}

/** Mở hộp so sánh: nhóm, danh sách mẫu (thiếu = họ `hinh`, thiếu nữa = họ L), câu yêu cầu (đọc ngay), tự chạy. */
export function moSoSanhMau(p: { tv: ThuVien | null; nhom?: 'tm' | 'xh'; mauIds?: string[]; hinh?: string | null; yeuCau?: string; toiUu?: boolean }) {
  const nhom = p.nhom ?? tt.nhom;
  const chon = p.mauIds?.length ? p.mauIds : p.tv ? hoMau(p.tv, nhom, p.hinh ?? 'l') : [];
  const yeuCau = p.yeuCau ?? tt.yeuCau;
  datTT({ mo: true, nhom, chon, yeuCau, yc: phanTichYeuCau(yeuCau), toiUu: p.toiUu ?? tt.toiUu, dat: null, baoDat: null });
}
export const dongSoSanhMau = () => datTT({ mo: false, dat: null });
export const soSanhMauDangMo = () => tt.mo;

/** Cơ cấu mục tiêu khi chưa có lô cao tầng (giá trị tạm). */
const MUC_MAC_DINH: Record<LoaiCan, number> = { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 10, '3pn': 15 };
const tenMau = (tv: ThuVien, id: string) => tv.toa.get(id)?.ten_vi.split(' · ')[0] ?? id;
const tenDayDu = (tv: ThuVien, id: string) => tv.toa.get(id)?.ten_vi ?? id;
const pct = (v: number | null) => (v === null ? '—' : fmtSo(v * 100, { thapPhan: 1, donVi: '%' }));

/** Dịch một nhãn (khoá i18n + tham số) — tham số `tc` là tên tiêu chí, `g` nhóm. */
export function dichNhan(n: Nhan): string {
  let s = t(n.k);
  for (const [k, v] of Object.entries(n.p ?? {})) {
    if (k === 'tot') continue;
    const gt = k === 'tc' ? t(`gh.tc.${v}`) : k === 'g' ? t(v === 'xh' ? 'xep.nhomXh' : 'xep.nhomTm') : typeof v === 'number' ? fmtSo(v, { thapPhan: Number.isInteger(v) ? 0 : Number.isInteger(Math.round(v * 1000) / 100) ? 1 : 2 }) : String(v);
    s = s.replace(`{${k}}`, gt);
  }
  return s.replace(/\s*\{tot\}/, n.p?.tot ? ` ${t('gh.totNhat')}` : '');
}

/** Hình thu nhỏ mặt bằng tầng điển hình: nét bao, căn tô theo loại, lõi, ô thang bộ. */
export function HinhMau({ h, co = 72, nhan }: { h: KetQuaMau['hinhThu']; co?: number; nhan?: string }) {
  const xs = h.bao.map((p) => p[0]), ys = h.bao.map((p) => p[1]);
  if (!xs.length) return <span class="ssm-hinh" style={{ width: `${co}px`, height: `${co}px` }} />;
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = x1 - x0 || 1, hh = y1 - y0 || 1, dem = Math.max(w, hh) * 0.04;
  const pts = (P: Diem[]) => P.map(([x, y]) => `${(x - x0).toFixed(2)},${(y1 - y).toFixed(2)}`).join(' ');
  return (
    <svg class="ssm-hinh" viewBox={`${-dem} ${-dem} ${w + 2 * dem} ${hh + 2 * dem}`} width={co} height={co} role="img" aria-label={nhan}>
      {h.can.map((c, i) => <polygon key={`c${i}`} points={pts(c.pts)} fill={`var(--u-${c.loai})`} stroke="var(--panel)" stroke-width={Math.max(w, hh) * 0.006} />)}
      {h.loi.map((p, i) => <polygon key={`l${i}`} points={pts(p)} class="ssm-loi" />)}
      {h.thang.map((p, i) => <polygon key={`t${i}`} points={pts(p)} class="ssm-thang" />)}
      <polygon points={pts(h.bao)} fill="none" stroke="var(--ink)" stroke-width={Math.max(w, hh) * 0.012} />
    </svg>
  );
}

const giaTriCot = (r: HangMau, c: CotSap): number => {
  switch (c) {
    case 'hang': return r.hang;
    case 'diem': return r.diem.tong;
    case 'hieuSuat': return r.hieuSuat ?? -1;
    case 'soThangMay': return r.soThangMay ?? -1;
    case 'vuot': return r.vuot ?? 99;
    case 'tyLeLoi': return r.tyLeLoi ?? 9;
    case 'diemView': return r.diemView ?? -1;
    default: return r[c] as number;
  }
};

type Props = {
  pa: TrangThaiPA; tv: ThuVien | null; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean;
  loId: string | null;
  /** Đặt xong: chọn lô + tòa mới, về TMB. */
  daDat: (loId: string, toaId: string) => void;
};

/** Hộp so sánh (gắn một lần ở trình soạn; tự ẩn khi đóng). */
export function HopSoSanhMau(p: Props) {
  const s = useTT();
  if (!s.mo) return null;
  return <LopNoi><NoiDung {...p} /></LopNoi>;
}

const idMoi = () => `toa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
let lanChay = 0;

function NoiDung({ pa, tv, sua, chiXem, loId, daDat }: Props) {
  useLang();
  const s = useTT();
  const { lop, dongMem } = useDongHop(dongSoSanhMau);
  const loDs = pa.lo.filter(laCaoTang);
  const lo: Lo | null = pa.lo.find((l) => l.id === loId && laCaoTang(l)) ?? loDs[0] ?? null;
  const muc = hopCoCau(lo?.temDat.coCauMucTieu ?? MUC_MAC_DINH, s.yc.coCau);
  const soTang = s.soTang ?? soTangMacDinh(lo);
  const khoaVao = JSON.stringify([s.chon, s.toiUu, soTang, muc, lo?.id, lo?.temDat.danSo ?? null, lo?.temDat.chiTieu.nguoiMoiCan]);

  const chay = async () => {
    if (!tv || !s.chon.length) return;
    const lan = ++lanChay;
    datTT({ chay: true, tienDo: 0, loi: null, khoaDs: khoaVao, dat: null, baoDat: null });
    try {
      const t0 = performance.now();
      const paAo = { ...pa, toa: s.chon.map((id) => toaAo(id, lo?.id ?? 'ss', soTang, 1)) };
      const dl = await choDuLieuMB(paAo, tv);
      const ds = await soSanhMauNen({ mauIds: s.chon, bienThe: s.toiUu ? ['goc', 'toiUu'] : ['goc'], mucTieu: muc, soTangDH: soTang, lo },
        tv, dl, (x, n) => lan === lanChay && datTT({ tienDo: x / n }));
      if (ds && lan === lanChay) datTT({ ds, chay: false, tienDo: 1, ms: performance.now() - t0 });
    } catch (e) {
      if (lan === lanChay) datTT({ chay: false, loi: String((e as Error).message ?? e) });
    }
  };
  // mở hộp / đổi lựa chọn → tự chạy lại (worker, lượt mới huỷ lượt cũ)
  useEffect(() => { if (tv && s.chon.length && s.khoaDs !== khoaVao) void chay(); }, [tv, khoaVao]);

  const hang = s.ds ? xepHang(s.ds, s.yc) : [];
  const sapXep = [...hang].sort((a, b) => {
    const d = giaTriCot(a, s.sap.cot) - giaTriCot(b, s.sap.cot);
    return (s.sap.giam ? -d : d) || a.hang - b.hang;
  });
  const top = hang.slice(0, 3);
  const soToa = (r: KetQuaMau) => (lo ? soToaTheoChiTieu(r, lo, soTang) : null);
  const ghiSoToa = (r: KetQuaMau) => {
    const x = soToa(r);
    return x ? t('ssm.soToaLo').replace('{n}', String(x.n)).replace('{lo}', lo!.temDat.kyHieu).replace('{c}', fmtSo(x.soCan)).replace('{chan}', t(`ssm.chan.${x.chan}`)) : null;
  };
  const coView = hang.some((r) => typeof r.diemView === 'number');
  const cu = !!s.ds && s.khoaDs !== khoaVao;
  const hinhs = tv ? dsHinh(tv, s.nhom) : [];
  const hoDangChon = (h: string | null) => tv && JSON.stringify(hoMau(tv, s.nhom, h)) === JSON.stringify(s.chon);

  const datNhom = (nhom: 'tm' | 'xh') => tv && datTT({ nhom, chon: hoMau(tv, nhom, hinhs.includes('l') ? 'l' : null) });
  const batMau = (id: string) => datTT({ chon: s.chon.includes(id) ? s.chon.filter((x) => x !== id) : [...s.chon, id] });
  const docYeuCau = (chu: string) => {
    const yc = phanTichYeuCau(chu);
    const p: Partial<TrangThai> = { yeuCau: chu, yc };
    // yêu cầu nêu dạng / nhóm → chọn luôn họ đó
    if (tv && (yc.nhom || yc.hinh.length)) {
      const nhom = yc.nhom ?? s.nhom;
      const ids = yc.hinh.length ? yc.hinh.flatMap((h) => hoMau(tv, nhom, h)) : hoMau(tv, nhom, null);
      if (ids.length) Object.assign(p, { nhom, chon: ids });
    }
    datTT(p);
  };
  const datTrongSo = (tc: TieuChi, v: number) => datTT({ yc: { ...s.yc, trongSo: { ...s.yc.trongSo, [tc]: Math.max(0, Math.min(5, v)) } } });

  const datVaoLo = (r: HangMau) => {
    const loD = pa.lo.find((l) => l.id === (s.loDat ?? lo?.id));
    const mau = tv?.toa.get(r.mauId);
    if (!tv || !loD || !mau || chiXem) return;
    let moi: ToaDat = taoToaTrenLo(mau, loD, idMoi());
    if (r.canViTri) moi = { ...moi, canViTri: { ...r.canViTri } };
    void choDuLieuMB({ ...pa, toa: [...pa.toa, moi] }, tv).then((dl) => {
      const x = tuChinhToa(moi, mau as unknown as ToaMB, tv, dl);
      sua((q) => ({ ...q, toa: [...q.toa, x] }));
      datTT({ dat: null, baoDat: t('ssm.daDat').replace('{m}', tenMau(tv, r.mauId)).replace('{lo}', loD.temDat.kyHieu) });
      daDat(loD.id, x.id);
    });
  };

  const Th = ({ c, nhan, tip }: { c: CotSap; nhan: string; tip?: string }) => (
    <th aria-sort={s.sap.cot === c ? (s.sap.giam ? 'descending' : 'ascending') : undefined} title={tip}>
      <button type="button" class="ssm-sap" onClick={() => datTT({ sap: { cot: c, giam: s.sap.cot === c ? !s.sap.giam : c === 'diem' || c === 'hieuSuat' || c === 'soCan' } })}>
        {nhan}{s.sap.cot === c ? (s.sap.giam ? ' ▾' : ' ▴') : ''}
      </button>
    </th>
  );
  const tenBien = (r: KetQuaMau) => (r.bienThe === 'toiUu' ? t('ssm.bt.toiUu') : t('ssm.bt.goc'));

  return (
    <div class={`hop-thoai${lop}`} role="dialog" aria-modal="true" aria-labelledby="tieu-de-ssm" onClick={(e) => { if (e.target === e.currentTarget) dongMem(); }}>
      <div class="hop-rong ss-mau">
        <div class="ssm-dau">
          <h2 id="tieu-de-ssm"><BieuTuong k="soSanhMau" /> {t('ssm.tieuDe')}</h2>
          <span class="muted">{lo ? t('ssm.theoLo').replace('{lo}', lo.temDat.kyHieu) : ''}</span>
        </div>
        <p class="muted ssm-ghi">{t('ssm.moTa')}</p>

        <section class="ssm-chon" aria-label={t('ssm.chonMau')}>
          <div class="ssm-hang">
            <div class="nhom-nut" role="group" aria-label={t('xep.thuVien')}>
              {(['tm', 'xh'] as const).map((k) => <button type="button" key={k} aria-pressed={s.nhom === k} onClick={() => datNhom(k)}>{t(k === 'tm' ? 'xep.nhomTm' : 'xep.nhomXh')}</button>)}
            </div>
            <div class="ssm-ho" role="group" aria-label={t('ssm.ho')}>
              {hinhs.map((h) => <button type="button" key={h} class="ssm-chip" aria-pressed={!!hoDangChon(h)} title={t('gt.ssm.ho')} onClick={() => tv && datTT({ chon: hoMau(tv, s.nhom, h) })}>{t('ssm.dang').replace('{h}', h.toUpperCase())}</button>)}
              <button type="button" class="ssm-chip" aria-pressed={!!hoDangChon(null)} onClick={() => tv && datTT({ chon: hoMau(tv, s.nhom, null) })}>{t('ssm.tatCa')}</button>
            </div>
          </div>
          <details class="ssm-mau-gap" open={typeof matchMedia === 'undefined' || !matchMedia('(max-width: 1024px)').matches}>
            <summary title={t('ssm.chonMau')}>{t('ssm.dangChon').replace('{n}', String(s.chon.length)).replace('{ds}', tv ? s.chon.map((id) => tenMau(tv, id)).join(', ') : '')}</summary>
          <div class="ssm-mau" role="group" aria-label={t('ssm.chonMau')}>
            {tv && hoMau(tv, s.nhom, null).map((id) => (
              <label key={id} class={`ssm-mau-o${s.chon.includes(id) ? ' bat' : ''}`} title={tenDayDu(tv, id)}>
                <input type="checkbox" checked={s.chon.includes(id)} onChange={() => batMau(id)} />{tenMau(tv, id)}
              </label>
            ))}
          </div>
          </details>
          <div class="ssm-hang">
            <label class="o-tg" title={t('gt.ssm.toiUu')}><input type="checkbox" checked={s.toiUu} onChange={(e) => datTT({ toiUu: e.currentTarget.checked })} /><span>{t('ssm.toiUu')}</span></label>
            <label class="o-so ssm-so-tang" title={t('gt.ssm.soTang')}><span>{t('ssm.soTang')}</span>
              <span class="o-so-nhap"><NhapChot type="number" min="1" max="80" step="1" value={soTang}
                onChange={(e) => { const v = Math.round(Number(e.currentTarget.value)); if (v >= 1 && v <= 80) datTT({ soTang: v }); }} /></span>
            </label>
            <span class="muted ssm-muc" title={t('gt.ssm.mucTieu')}>{t('ssm.mucTieu')}: {LOAI_CAN.filter((l) => muc[l] > 0).map((l) => `${t(`loai.${l}`)} ${fmtSo(muc[l], { thapPhan: 0 })}%`).join(' · ')}</span>
          </div>
        </section>

        <section class="ssm-yc" aria-label={t('ssm.yeuCau')}>
          <label class="ssm-yc-o"><span><BieuTuong k="goiYHinh" /> {t('ssm.yeuCau')}</span>
            <textarea rows={2} value={s.yeuCau} placeholder={t('ssm.yeuCauVD')} onInput={(e) => docYeuCau(e.currentTarget.value)} />
          </label>
          {s.yc.nhanDien.length > 0 && <div class="ssm-nhan" aria-label={t('ssm.hieu')}>{s.yc.nhanDien.map((n, i) => <span key={i} class="ssm-nhan-o">{dichNhan(n)}</span>)}</div>}
          <details class="ssm-ts">
            <summary title={t('gt.ssm.trongSo')}>{t('ssm.trongSo')} · {t('ssm.hsMin')} {fmtSo(s.yc.hsMin * 100, { thapPhan: 1 })} %</summary>
            <div class="ssm-ts-luoi">
              {TIEU_CHI.map((tc) => (
                <label key={tc} class="o-so" title={t(`gt.gh.tc.${tc}`)}><span>{t(`gh.tc.${tc}`)}</span>
                  <span class="o-so-nhap"><NhapChot type="number" min="0" max="5" step="1" value={s.yc.trongSo[tc]} onChange={(e) => datTrongSo(tc, Math.round(Number(e.currentTarget.value) || 0))} /></span>
                </label>
              ))}
              <label class="o-so" title={t('gt.ssm.hsMin')}><span>{t('ssm.hsMin')}</span>
                <span class="o-so-nhap"><NhapChot type="number" min="50" max="95" step="0.5" value={Math.round(s.yc.hsMin * 1000) / 10}
                  onChange={(e) => { const v = Number(e.currentTarget.value); if (v >= 50 && v <= 95) datTT({ yc: { ...s.yc, hsMin: v / 100 } }); }} /><small>%</small></span>
              </label>
            </div>
            <p class="muted ssm-ghi">{t('ssm.cachCham').replace('{a}', fmtSo(THANG.hieuSuat.tren * 100)).replace('{b}', fmtSo(THANG.hieuSuat.duoi * 100)).replace('{c}', fmtSo(THANG.loiGon.tot * 100)).replace('{d}', fmtSo(THANG.loiGon.xau * 100)).replace('{e}', fmtSo(THANG.canGoc * 100))}</p>
          </details>
        </section>

        {(s.chay || s.loi) && (
          <p class={s.loi ? 'vuot ssm-ghi' : 'muted ssm-ghi'} role="status">
            {s.loi ?? <><img class="spin-o" src="/brand/leo_ai_o.png" alt="" />{t('ssm.dangChay').replace('{p}', fmtSo(s.tienDo * 100, { donVi: '%' }))}</>}
          </p>
        )}
        {!s.chay && s.ds && s.ms !== null && <p class="muted ssm-ghi">{t('ssm.xong').replace('{n}', String(s.ds.length)).replace('{s}', fmtSo(s.ms / 1000, { thapPhan: 1 }))}{cu ? ` · ${t('ssm.cu')}` : ''}</p>}
        {s.ds && !hang.length && !s.chay && <p class="muted ssm-ghi">{t('ssm.rong')}</p>}

        {tv && top.length > 0 && (
          <section class="ssm-top" aria-label={t('ssm.top')}>
            {top.map((r) => {
              const g = uuNhuoc(r, hang, s.yc);
              return (
                <article key={r.khoa} class={`ssm-the${r.hang === 1 ? ' nhat' : ''}`}>
                  <div class="ssm-the-dau">
                    <HinhMau h={r.hinhThu} co={64} nhan={tenDayDu(tv, r.mauId)} />
                    <div>
                      <b>{r.hang}. {tenMau(tv, r.mauId)}</b> <small class="muted">{tenBien(r)}</small>
                      <div class="ssm-diem" title={TIEU_CHI.filter((tc) => r.diem.theoTC[tc] !== undefined).map((tc) => `${t(`gh.tc.${tc}`)}: ${fmtSo(r.diem.theoTC[tc]!)} × ${s.yc.trongSo[tc]}`).join('\n')}>
                        {fmtSo(r.diem.tong, { thapPhan: 1 })}<small>/100</small>
                      </div>
                    </div>
                  </div>
                  {ghiSoToa(r) && <p class="ssm-so-toa" title={t('gt.ssm.soToa')}>{ghiSoToa(r)}</p>}
                  <ul class="ssm-uu">{g.uu.map((x, i) => <li key={i}>{dichNhan(x)}</li>)}</ul>
                  <ul class="ssm-nhuoc">{g.nhuoc.map((x, i) => <li key={i}>{dichNhan(x)}</li>)}</ul>
                  <button type="button" class="nut-phu" disabled={chiXem || !loDs.length} title={t('gt.ssm.datVaoLo')} onClick={() => datTT({ dat: r.khoa, loDat: lo?.id ?? null })}>{t('ssm.datVaoLo')}</button>
                </article>
              );
            })}
          </section>
        )}

        {tv && hang.length > 0 && (
          <div class="ssm-bang-cuon">
            <table class="ssm-bang">
              <thead><tr>
                <Th c="hang" nhan="#" /><th class="ssm-ten">{t('ssm.cot.mau')}</th><Th c="diem" nhan={t('ssm.cot.diem')} tip={t('gt.ssm.diem')} />
                <Th c="soCan" nhan={t('ssm.cot.can')} /><th title={t('gt.ssm.soToa')}>{t('ssm.cot.soToa')}</th><th title={t('gt.ssm.soToa')}>{t('ssm.cot.canLo')}</th><Th c="lech" nhan={t('ssm.cot.coCau')} tip={t('xep.diemLech')} />
                <Th c="hieuSuat" nhan={t('ssm.cot.hs')} tip={t('kpi.gt.hieuSuat').replace('{n}', fmtSo(s.yc.hsMin * 100))} />
                <Th c="dtxd" nhan={t('ssm.cot.dtxd')} tip={t('kpi.gt.dtxdTang')} /><Th c="dtsd" nhan={t('ssm.cot.dtsd')} tip={t('kpi.gt.dtsdTang')} />
                <Th c="soThangBo" nhan={t('ssm.cot.thangBo')} tip={t('gt.ssm.thangBo')} /><Th c="soThangMay" nhan={t('ssm.cot.thangMay')} tip={t('gt.ssm.thangMay')} />
                <Th c="vuot" nhan={t('ssm.cot.vuot')} tip={t('gt.ssm.vuot')} /><Th c="danTang" nhan={t('ssm.cot.dan')} tip={t('gt.ssm.dan')} />
                <Th c="dai" nhan={t('ssm.cot.kichThuoc')} /><Th c="tyLeLoi" nhan={t('ssm.cot.loi')} tip={t('gt.ssm.loi')} />
                {coView && <Th c="diemView" nhan={t('ssm.cot.view')} />}
                <th />
              </tr></thead>
              <tbody>
                {sapXep.map((r) => (
                  <tr key={r.khoa} class={r.hang <= 3 ? 'top' : ''}>
                    <td>{r.hang}</td>
                    <td class="ssm-ten"><HinhMau h={r.hinhThu} co={40} nhan={tenDayDu(tv, r.mauId)} /><span><b title={tenDayDu(tv, r.mauId)}>{tenMau(tv, r.mauId)}</b><small class="muted">{tenBien(r)}{r.soDoi ? ` · ${t('ssm.soDoi').replace('{n}', String(r.soDoi))}` : ''}</small></span></td>
                    <td><b>{fmtSo(r.diem.tong, { thapPhan: 1 })}</b></td>
                    <td>{fmtSo(r.soCan)}</td>
                    <td title={soToa(r) ? t(`ssm.chan.${soToa(r)!.chan}`) : undefined}>{soToa(r)?.n ?? '—'}</td>
                    <td>{soToa(r) ? fmtSo(soToa(r)!.soCan) : '—'}</td>
                    <td>
                      <span class="ssm-thanh" title={LOAI_CAN.map((l) => `${t(`loai.${l}`)} ${fmtSo(r.coCauPct[l], { thapPhan: 0 })}% (${t('ssm.mucTieu')} ${fmtSo(muc[l], { thapPhan: 0 })}%)`).join('\n')}>
                        {LOAI_CAN.map((l) => <i key={l} style={{ flexGrow: r.coCauPct[l], background: `var(--u-${l})` }} />)}
                      </span>
                      <small>{fmtSo(r.lech, { thapPhan: 1 })}</small>
                    </td>
                    <td class={r.hieuSuat !== null && r.hieuSuat < s.yc.hsMin ? 'canh-bao' : 'ok'}>{pct(r.hieuSuat)}</td>
                    <td>{fmtSo(r.dtxd, { thapPhan: 0 })}</td>
                    <td>{fmtSo(r.dtsd, { thapPhan: 0 })}</td>
                    <td>{fmtSo(r.soThangBo)}</td>
                    <td>{fmtSo(r.soThangMay)}</td>
                    <td class={r.vuot ? 'vuot' : r.vuot === 0 ? 'ok' : ''} title={r.canGo ? t('ssm.canGo').replace('{n}', String(r.canGo)) : undefined}>{fmtSo(r.vuot)}{r.canGo ? '*' : ''}</td>
                    <td>{fmtSo(r.danTang, { thapPhan: 1 })}</td>
                    <td>{fmtSo(r.dai, { thapPhan: 1 })} × {fmtSo(r.rong, { thapPhan: 1 })}</td>
                    <td>{pct(r.tyLeLoi)}</td>
                    {coView && <td>{fmtSo(r.diemView ?? null)}</td>}
                    <td><button type="button" class="nut-bt ssm-dat-nho" disabled={chiXem || !loDs.length} title={t('gt.ssm.datVaoLo')} aria-label={`${t('ssm.datVaoLo')} ${tenMau(tv, r.mauId)}`} onClick={() => datTT({ dat: r.khoa, loDat: lo?.id ?? null })}><BieuTuong k="datToa" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {s.ds && <p class="muted ssm-ghi">{t('ssm.chuThich')}</p>}

        {tv && s.dat && (() => {
          const r = hang.find((x) => x.khoa === s.dat);
          if (!r) return null;
          return (
            <section class="ssm-dat" aria-label={t('ssm.datVaoLo')}>
              <b>{t('ssm.datTieuDe').replace('{m}', `${tenMau(tv, r.mauId)} · ${tenBien(r)}`)}</b>
              <label class="o-chon"><span>{t('ssm.loDat')}</span>
                <select value={s.loDat ?? ''} onChange={(e) => datTT({ loDat: e.currentTarget.value })}>
                  {loDs.map((l) => <option key={l.id} value={l.id}>{l.temDat.kyHieu}</option>)}
                </select>
              </label>
              <p class="muted ssm-ghi">{t('ssm.datGhi')}</p>
              <div class="ssm-hang">
                <button type="button" class="nut-chinh" disabled={chiXem} onClick={() => datVaoLo(r)}>{t('ssm.dat')}</button>
                <button type="button" class="nut-phu" onClick={() => datTT({ dat: null })}>{t('ssm.huyDat')}</button>
              </div>
            </section>
          );
        })()}
        {s.baoDat && <p class="ok ssm-ghi" role="status">{s.baoDat}</p>}

        <div class="chan-hop">
          <button type="button" class="nut-phu" onClick={dongMem}>{t('ssm.dong')}</button>
          <button type="button" class="nut-chinh" disabled={!tv || !s.chon.length || s.chay} title={t('gt.ssm.chay')} onClick={() => void chay()}>{t('ssm.chay')}</button>
        </div>
      </div>
    </div>
  );
}
