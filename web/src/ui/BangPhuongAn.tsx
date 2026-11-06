import { t } from '../i18n/i18n';
import type { Lo, ThuVien } from '../tinh/kieu';
import type { GoiYXep } from '../tinh/xepToa';
import { DiemNam, HinhGoiY } from './GoiYXepToa';
import { LopNoi } from './LopNoi';
import { fmtSo } from './so';
import { useDongHop } from './useDongHop';

export type NhomPhuongAn = { khoa: string; tieuDe: string; lo: Lo; ds: GoiYXep[]; chon?: number | null; onChon: (i: number) => void; nhanChon: string };

/** Bảng so sánh phương án: lớp phủ cả màn, mỗi nhóm (chế độ xếp hoặc một lô) một lưới hình + số + 5 thanh điểm, khung giữa không đổi. */
export function BangPhuongAn({ tieuDe, nhom, tv, chiXem, dang, dong }: { tieuDe: string; nhom: NhomPhuongAn[]; tv: ThuVien; chiXem: boolean; dang?: boolean; dong: () => void }) {
  const { lop, dongMem } = useDongHop(dong);
  return (
    <LopNoi>
      <div class={`hop-3d${lop}`} role="dialog" aria-modal="true" aria-label={tieuDe} onClick={(e) => { if (e.target === e.currentTarget) dongMem(); }}>
        <div class="bang-pa">
          <button type="button" class="dong-hop" onClick={dongMem} aria-label={t('m3d.dong')}>×</button>
          <h3>{tieuDe}</h3>
          {dang && <p class="muted"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" />{t('xep.bangDangChay')}</p>}
          {nhom.map((n) => (
            <section key={n.khoa}>
              <h4>{n.tieuDe} · {n.ds.length}</h4>
              <ol class="bang-pa-luoi">
                {n.ds.map((g, i) => (
                  <li key={g.khoa} class={n.chon === i ? 'chon' : ''}>
                    <HinhGoiY lo={n.lo} g={g} tv={tv} />
                    <b>{i + 1}. {t(`xep.kieu.${g.kieu}`)}</b>
                    <span>{g.mau.map(([m, k]) => `${k} × ${tv.toa.get(m)?.ten_vi.split(' · ')[0] ?? m}`).join(' + ')} · {g.soTangDH + 1} T</span>
                    <span class="muted">{t('xep.tongCan').replace('{n}', fmtSo(g.soCan))} · {t('xep.goiYMatDo')} {fmtSo(g.matDo, { thapPhan: 1, donVi: '%' })} · {t('xep.goiYLech')} {fmtSo(g.lech, { thapPhan: 1 })}</span>
                    {g.boCuc && <span class="muted">{t('xep.san')} {fmtSo(g.boCuc.sanM2, { donVi: 'm²' })}</span>}
                    {g.boCuc && <DiemNam d={g.boCuc} />}
                    {g.loiQH > 0 && <span class="canh-bao">{t('xep.vuotChiTieu').replace('{n}', String(g.loiQH))}</span>}
                    <button type="button" class="nut-phu" disabled={chiXem} onClick={() => n.onChon(i)}>{n.nhanChon}</button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </LopNoi>
  );
}
