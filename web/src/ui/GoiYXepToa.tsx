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
import { goiYXepToaNen, type GoiYXep } from '../tinh/xepToa';
import { sPoly } from '../ve/BanVe';
import { taiCuaCan } from '../ve/hinhHocThuVien';
import { fmtSo } from './so';
import { mauToa } from '../tinh/canThem';

// ---- trạng thái dùng chung panel trái ↔ bản vẽ (cấp module, không lưu vào PA) ----
type TrangThai = { khoa: string | null; ds: GoiYXep[] | null; chay: boolean; tienDo: number; xem: number | null; loi: string | null; ms: number | null };
let tt: TrangThai = { khoa: null, ds: null, chay: false, tienDo: 0, xem: null, loi: null, ms: null };
const nghe = new Set<() => void>();
const dat = (p: Partial<TrangThai>) => { tt = { ...tt, ...p }; nghe.forEach((f) => f()); };
function useTT(): TrangThai {
  const [, ve] = useState(0);
  useEffect(() => { const f = () => ve((n) => n + 1); nghe.add(f); return () => void nghe.delete(f); }, []);
  return tt;
}
const daChay = new Set<string>(); // lô đã tự chạy (không tự chạy lại sau khi người dùng xoá hết tòa)

/** Chữ ký đầu vào của lô: đổi ranh, chỉ giới, chỉ tiêu, cơ cấu mục tiêu hay tòa lô bên cạnh thì gợi ý cũ hết hiệu lực. */
const khoaLo = (pa: TrangThaiPA, lo: Lo) =>
  lo.id + '|' + JSON.stringify([lo.ranh, lo.chiGioi, lo.temDat.chucNang, lo.temDat.chiTieu, lo.temDat.coCauMucTieu, pa.toa.filter((x) => x.loId !== lo.id).map((x) => [x.mauId, x.x, x.y, x.gocDo, x.soTangDH])]);

const coChiTieu = (lo: Lo) => lo.temDat.chucNang !== 'khac' && lo.ranh.length >= 3 && lo.temDat.chiTieu.matDoMax > 0 && lo.temDat.chiTieu.hssddMax > 0;

let lanChay = 0;
async function chay(pa: TrangThaiPA, lo: Lo, tv: ThuVien) {
  const lan = ++lanChay, khoa = khoaLo(pa, lo);
  dat({ khoa, ds: null, chay: true, tienDo: 0, xem: null, loi: null, ms: null });
  try {
    const [bo, cuaCan] = await Promise.all([taiQuyTac(), taiCuaCan(tv, lo.temDat.chucNang === 'xh' ? 'xh' : 'tm')]);
    const lo01 = traLuat(bo, 'LO-01'), lo02 = traLuat(bo, 'LO-02');
    if (!lo01 || !lo02) throw new Error('LO-01 / LO-02');
    const t0 = performance.now();
    const ds = await goiYXepToaNen({ pa, lo, tv, luat: { lo01, lo02 }, cuaCan }, (x, n) => lan === lanChay && dat({ tienDo: x / n }), () => lan !== lanChay);
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
  const coToa = pa.toa.some((x) => x.loId === lo.id);
  // lô có chỉ tiêu mà chưa có tòa: tự chạy một lần
  useEffect(() => {
    if (!tv || coToa || !coChiTieu(lo) || daChay.has(lo.id) || (s.chay && cuaLo)) return;
    daChay.add(lo.id);
    void chay(pa, lo, tv);
  }, [tv, khoa, coToa]);
  // đổi lô thì bỏ xem trước
  useEffect(() => () => dat({ xem: null }), [lo.id]);

  const apDung = (g: GoiYXep) => {
    const moi: ToaDat[] = g.toa.map((x) => ({ ...x, id: idMoi() }));
    sua((p) => ({ ...p, toa: [...p.toa.filter((x) => x.loId !== lo.id), ...moi] }));
    chonToa(moi[0]?.id ?? null);
    dat({ xem: null });
  };

  return (
    <div class="goi-y-xep">
      <div class="dong">
        <button type="button" class="nut-chinh" title={t('gt.xep.goiY')} disabled={!tv || s.chay || !coChiTieu(lo)} onClick={() => tv && void chay(pa, lo, tv)}>
          {t('xep.goiY')}
        </button>
        {s.chay && cuaLo && <span class="muted goi-y-tien-do"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" />{fmtSo(s.tienDo * 100, { donVi: '%' })}</span>}
      </div>
      {!coChiTieu(lo) && <p class="dong muted">{t('xep.goiYCanChiTieu')}</p>}
      {cuaLo && s.loi && <p class="dong vuot">{s.loi}</p>}
      {cuaLo && s.ds && !s.ds.length && <p class="dong muted">{t('xep.goiYRong')}</p>}
      {cuaLo && s.ds && s.ds.length > 0 && (
        <>
          <p class="dong muted" style={{ margin: 0 }}>{t('xep.goiYXong').replace('{n}', String(s.ds.length)).replace('{s}', fmtSo((s.ms ?? 0) / 1000, { thapPhan: 1 }))}</p>
          <ol class="goi-y-ds" onMouseLeave={() => dat({ xem: null })}>
            {s.ds.map((g, i) => (
              <li key={g.khoa} class={`goi-y-the${s.xem === i ? ' xem' : ''}`} onMouseEnter={() => dat({ xem: i })} onFocusCapture={() => dat({ xem: i })}>
                <div class="goi-y-dau">
                  <b>{i + 1}. {g.mau.map(([m, n]) => `${n} × ${tv?.toa.get(m)?.ten_vi.split(' · ')[0] ?? m}`).join(' + ')}</b>
                  <span class="muted">{1 + g.soTangDH} T</span>
                </div>
                <div class="goi-y-so">
                  <span title={t('gt.xep.goiYCan')}>{t('xep.tongCan').replace('{n}', fmtSo(g.soCan))}{g.soCanMuc ? ` / ${fmtSo(g.soCanMuc)}` : ''}</span>
                  <span title={t('xep.diemLech')}>{t('xep.goiYLech')} {fmtSo(g.lech, { thapPhan: 1 })}</span>
                  <span title={t('xep.hssdd')}>{t('xep.goiYSan')} {fmtSo(g.tyLeSan * 100, { thapPhan: 0, donVi: '%' })}</span>
                  <span title={t('xep.matDo')}>{t('xep.goiYMatDo')} {fmtSo(g.matDo, { thapPhan: 1, donVi: '%' })}</span>
                  <span title={t('gt.xep.goiYPccc')} class={g.pcccVuot ? 'canh-bao' : g.pcccVuot === 0 ? 'ok' : ''}>{t('xep.goiYPccc')} {g.pcccVuot ?? '—'}</span>
                  <span title={t('gt.xep.goiYHuong')}>{t('xep.goiYHuong')} {fmtSo(g.huongTot, { thapPhan: 0, donVi: '%' })}</span>
                </div>
                {g.canhBao.length > 0 && <p class="goi-y-cb canh-bao">{g.canhBao.join(' · ')}</p>}
                <button type="button" class="nut-phu" disabled={chiXem} title={t('gt.xep.goiYApDung')} onClick={() => apDung(g)}>{t('xep.goiYApDung')}</button>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
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
