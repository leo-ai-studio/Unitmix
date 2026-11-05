/**
 * Gợi ý xếp tòa (MT-05) ở màn Tổng mặt bằng: nút chạy cho lô đang chọn, danh sách gợi ý trong panel trái, rê để xem trước
 * nét đứt trên bản vẽ (lớp SVG trong BanVe — khung giữa không đổi), "Áp dụng" thay các tòa của lô qua `sua` (hoàn tác được).
 * Lô có chỉ tiêu mà chưa có tòa thì tự chạy một lần.
 */
import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { chanToa } from '../tinh/hinhHoc';
import type { Lo, ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { taiQuyTac, traLuat } from '../tinh/quyTac';
import { sinhBoCuc } from '../tinh/boCucLo';
import { DS_UU_TIEN, goiYXepToaNen, type CheDoBoCuc, type GoiYXep, type UuTienXep } from '../tinh/xepToa';
import { sPoly } from '../ve/BanVe';
import { taiCuaCan } from '../ve/hinhHocThuVien';
import { fmtSo } from './so';
import { mauToa } from '../tinh/canThem';

// ---- trạng thái dùng chung panel trái ↔ bản vẽ (cấp module, không lưu vào PA) ----
type TrangThai = { cheDo: CheDoBoCuc | null; uuTien: UuTienXep; chiMau: string[]; khoa: string | null; ds: GoiYXep[] | null; chay: boolean; tienDo: number; xem: number | null; loi: string | null; ms: number | null };
let tt: TrangThai = { cheDo: null, uuTien: 'can_bang', chiMau: [], khoa: null, ds: null, chay: false, tienDo: 0, xem: null, loi: null, ms: null };
const nghe = new Set<() => void>();
const dat = (p: Partial<TrangThai>) => { tt = { ...tt, ...p }; nghe.forEach((f) => f()); };
function useTT(): TrangThai {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); nghe.add(f); return () => void nghe.delete(f); }, []);
  return tt;
}
/** Mẫu tòa người dùng chọn cho lượt xếp tự động (rỗng = mọi mẫu): dùng chung danh sách mẫu ở cùng khối với nút Đặt tay. */
export function useChiMau(): [string[], (id: string) => void, () => void] {
  const s = useTT();
  return [s.chiMau, (id) => dat({ chiMau: s.chiMau.includes(id) ? s.chiMau.filter((x) => x !== id) : [...s.chiMau, id] }), () => dat({ chiMau: [] })];
}
const daChay = new Set<string>(); // lô đã tự chạy (không tự chạy lại sau khi người dùng xoá hết tòa)

/** Chữ ký đầu vào của lô: đổi ranh, chỉ giới, chỉ tiêu, cơ cấu mục tiêu, tòa lô bên cạnh hay cài đặt view thì gợi ý cũ hết hiệu lực. */
const khoaLo = (pa: TrangThaiPA, lo: Lo) =>
  lo.id + '|' + JSON.stringify([lo.ranh, lo.chiGioi, lo.canhDuong ?? null, lo.temDat.chucNang, lo.temDat.chiTieu, lo.temDat.coCauMucTieu, pa.toa.filter((x) => x.loId !== lo.id).map((x) => [x.mauId, x.x, x.y, x.gocDo, x.soTangDH]), pa.huongView ?? null]);
const coChiTieu = (lo: Lo) => lo.temDat.chucNang !== 'khac' && lo.ranh.length >= 3 && lo.temDat.chiTieu.matDoMax > 0 && lo.temDat.chiTieu.hssddMax > 0;

let lanChay = 0;
async function chay(pa: TrangThaiPA, lo: Lo, tv: ThuVien, cheDo: CheDoBoCuc) {
  const lan = ++lanChay, khoa = khoaLo(pa, lo);
  dat({ khoa, ds: null, chay: true, tienDo: 0, xem: null, loi: null, ms: null });
  try {
    const [bo, cuaCan] = await Promise.all([taiQuyTac(), taiCuaCan(tv, lo.temDat.chucNang === 'xh' ? 'xh' : 'tm')]);
    const lo01 = traLuat(bo, 'LO-01'), lo02 = traLuat(bo, 'LO-02');
    if (!lo01 || !lo02) throw new Error('LO-01 / LO-02');
    const t0 = performance.now();
    const ds = await goiYXepToaNen({ pa, lo, tv, luat: { lo01, lo02 }, cuaCan, chiMau: tt.chiMau, cheDoBoCuc: cheDo, uuTien: tt.uuTien }, (x, n) => lan === lanChay && dat({ tienDo: x / n }), () => lan !== lanChay, sinhBoCuc);
    if (ds && lan === lanChay) dat({ ds, chay: false, tienDo: 1, ms: performance.now() - t0 });
  } catch (e) {
    if (lan === lanChay) dat({ chay: false, loi: String((e as Error).message ?? e) });
  }
}

const idMoi = () => `toa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Panel trái: nút Gợi ý xếp tòa + danh sách gợi ý của lô đang chọn. */
export function GoiYXepToa({ pa, lo, tv, sua, chiXem, chonToa }: { pa: TrangThaiPA; lo: Lo; tv: ThuVien | null; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; chonToa: (id: string | null) => void }) {
  const s = useTT();
  const khoa = khoaLo(pa, lo);
  const cuaLo = s.khoa === khoa;
  const soToa = pa.toa.filter((x) => x.loId === lo.id).length, coToa = soToa > 0;
  const cheDo: CheDoBoCuc = s.cheDo === 'to_hop' || !coToa ? 'to_hop' : s.cheDo ?? 'sap_lai';
  // lô có chỉ tiêu mà chưa có tòa: tự chạy một lần
  useEffect(() => {
    if (!tv || coToa || !coChiTieu(lo) || daChay.has(lo.id) || (s.chay && cuaLo)) return;
    daChay.add(lo.id);
    void chay(pa, lo, tv, 'to_hop');
  }, [tv, khoa, coToa]);
  // đổi lô thì bỏ xem trước
  useEffect(() => () => dat({ xem: null }), [lo.id]);

  const apDung = (g: GoiYXep) => {
    // sắp lại giữ id và tòa khoá; tổ hợp mới thay hết tòa của lô
    const moi: ToaDat[] = g.toa.map((x) => (x.id.startsWith('goiy-') ? { ...x, id: idMoi() } : x));
    sua((p) => ({ ...p, toa: [...p.toa.filter((x) => x.loId !== lo.id || (cheDo === 'sap_lai' && x.khoa)), ...moi] }));
    chonToa(moi[0]?.id ?? null);
    dat({ xem: null });
  };

  // mọi phương án cùng vượt một số chỉ tiêu (giữ nguyên tòa): báo một lần trên đầu danh sách
  const loiDs = cuaLo && s.ds ? [...new Set(s.ds.map((g) => g.loiQH))] : [];
  const loiChung = loiDs.length === 1 ? loiDs[0] : 0;

  return (
    <div class="goi-y-xep">
      <div class="nhom-nut xep-che-do" role="group" aria-label={t('xep.khoiXep')}>
        <button type="button" aria-pressed={cheDo === 'sap_lai'} disabled={!coToa} title={t('gt.xep.sapLai')} onClick={() => dat({ cheDo: 'sap_lai' })}>{t('xep.sapLai').replace('{n}', String(soToa))}</button>
        <button type="button" aria-pressed={cheDo === 'to_hop'} title={t('gt.xep.toHop')} onClick={() => dat({ cheDo: 'to_hop' })}>{t('xep.toHop')}</button>
      </div>
      <div class="goi-y-kieu" role="group" aria-label={t('xep.uuTien')}>
        {DS_UU_TIEN.map((k) => (
          <button type="button" key={k} title={t(`gt.xep.uu.${k}`)} aria-pressed={s.uuTien === k} onClick={() => dat({ uuTien: k })}>{t(`xep.uu.${k}`)}</button>
        ))}
      </div>
      <div class="dong">
        <button type="button" class="nut-chinh xep-nut" title={t('gt.xep.goiY')} disabled={!tv || s.chay || !coChiTieu(lo) || chiXem} onClick={() => tv && void chay(pa, lo, tv, cheDo)}>
          {cheDo === 'to_hop' && tt.chiMau.length ? t('xep.goiYMauChon').replace('{n}', String(tt.chiMau.length)) : t('xep.goiY')}
        </button>
        {s.chay && cuaLo && <span class="muted goi-y-tien-do"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" />{fmtSo(s.tienDo * 100, { donVi: '%' })}</span>}
      </div>
      {!coChiTieu(lo) && <p class="dong muted">{t('xep.goiYCanChiTieu')}</p>}
      {cuaLo && s.loi && <p class="dong vuot">{s.loi}</p>}
      {cuaLo && s.ds && !s.ds.length && <p class="dong muted">{t('xep.goiYRong')}</p>}
      {cuaLo && s.ds && s.ds.length > 0 && (
        <>
          <p class="dong muted" style={{ margin: 0 }}>{t('xep.goiYXong').replace('{n}', String(s.ds.length)).replace('{s}', fmtSo((s.ms ?? 0) / 1000, { thapPhan: 1 }))}</p>
          {loiChung > 0 && <p class="goi-y-cb canh-bao">{t('xep.vuotChiTieu').replace('{n}', String(loiChung))}</p>}
          <ol class="goi-y-ds" onMouseLeave={() => dat({ xem: null })}>
            {s.ds.map((g, i) => (
              <li key={g.khoa} class={`goi-y-the${s.xem === i ? ' xem' : ''}`} onMouseEnter={() => dat({ xem: i })} onFocusCapture={() => dat({ xem: i })}>
                {tv && <HinhGoiY lo={lo} g={g} tv={tv} />}
                <div class="goi-y-noi">
                  <b>{i + 1}. {t(`xep.kieu.${g.kieu}`)}</b>
                  <span class="goi-y-mau">{g.mau.map(([m, n]) => `${n} × ${tv?.toa.get(m)?.ten_vi.split(' · ')[0] ?? m}`).join(' + ')} · {g.soTangDH + 1} T</span>
                  <span class="muted">{t('xep.tongCan').replace('{n}', fmtSo(g.soCan))} · {t('xep.goiYMatDo')} {fmtSo(g.matDo, { thapPhan: 1, donVi: '%' })}</span>
                  {g.boCuc && <span class="muted">{t('xep.san')} {fmtSo(g.boCuc.sanM2, { donVi: 'm²' })}</span>}
                </div>
                {g.boCuc && <DiemNam d={g.boCuc} />}
                {g.loiQH > 0 && g.loiQH !== loiChung && <p class="goi-y-cb canh-bao">{t('xep.vuotChiTieu').replace('{n}', String(g.loiQH))}</p>}
                {g.canhBao.length > 0 && <p class="goi-y-cb canh-bao">{g.canhBao.join(' · ')}</p>}
                <button type="button" class="nut-phu goi-y-ap" disabled={chiXem} title={t('gt.xep.goiYApDung')} onClick={() => apDung(g)}>{t('xep.goiYApDung')}</button>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

/** Năm tiêu chí bố cục, mỗi tiêu chí một thanh 0–100. */
function DiemNam({ d }: { d: NonNullable<GoiYXep['boCuc']> }) {
  const ds: [string, number][] = [['nang', d.nang], ['gio', d.gio], ['view', d.view], ['mat', d.mat], ['san', d.san]];
  return (
    <div class="goi-y-nam">
      {ds.map(([k, v]) => (
        <span key={k} title={`${t(`gt.xep.diem.${k}`)}: ${fmtSo(v, { thapPhan: 0 })}/100`}>
          <small>{t(`xep.diem.${k}`)} <b>{fmtSo(v, { thapPhan: 0 })}</b></small><i><u style={{ width: `${Math.round(v)}%` }} /></i>
        </span>
      ))}
    </div>
  );
}

/** Hình nhỏ của phương án (ranh lô + chân tòa) để so các bố cục mà không phải rê từng thẻ. */
function HinhGoiY({ lo, g, tv }: { lo: Lo; g: GoiYXep; tv: ThuVien }) {
  const xs = lo.ranh.map((p) => p[0]), ys = lo.ranh.map((p) => p[1]);
  const x0 = Math.min(...xs), y1 = Math.max(...ys), w = Math.max(...xs) - x0 || 1, h = y1 - Math.min(...ys) || 1;
  const d = (P: [number, number][]) => P.map((p) => `${(p[0] - x0).toFixed(1)},${(y1 - p[1]).toFixed(1)}`).join(' ');
  return (
    <svg class="goi-y-hinh" viewBox={`${-w * 0.02} ${-h * 0.02} ${w * 1.04} ${h * 1.04}`} aria-hidden="true">
      <polygon points={d(lo.ranh)} fill="var(--soft)" stroke="var(--muted-text)" stroke-width="1" vector-effect="non-scaling-stroke" />
      {g.toa.map((x, i) => { const m = mauToa(tv, x); return m ? <polygon key={i} points={d(chanToa(m, x))} fill="var(--green)" /> : null; })}
    </svg>
  );
}

/** Lớp xem trước trên bản vẽ TMB: chân tháp của gợi ý đang rê, nét đứt. */
export function LopGoiY({ loId, tv }: { loId: string | null; tv: ThuVien | null }) {
  const s = useTT();
  const g = s.xem !== null && s.ds && s.khoa?.startsWith(`${loId}|`) ? s.ds[s.xem] : null;
  if (!g || !tv) return null;
  return (
    <g class="lop-goi-y" pointer-events="none">
      {g.toa.map((x, i) => {
        const m = mauToa(tv, x);
        return m ? <polygon key={i} points={sPoly(chanToa(m, x))} fill="var(--green)" fill-opacity="0.12" stroke="var(--green)" stroke-width="2" stroke-dasharray="7 5" vector-effect="non-scaling-stroke" /> : null;
      })}
    </g>
  );
}
