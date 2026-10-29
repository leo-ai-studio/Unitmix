/**
 * Lớp điểm VIEW trên mặt bằng tầng (màn Tầng): mặt ngoài mỗi căn có quầng sáng mềm + nét màu theo thang liên tục (tinh/mauView.ts),
 * chip điểm bo tròn trong căn sát mặt ngoài; rê chuột (máy cảm ứng: chạm) chip → thẻ thành phần hướng · thoáng · cảnh quan · nắng
 * (thẻ HTML cỡ cố định trên màn, portal ra <body> — không phóng theo bản vẽ, không chiếm chỗ khung giữa).
 * Điểm theo `danhGiaViewTang`: mắt ở đúng tầng đang xem, mọi tòa khác của PA là vật cản. Bật / tắt / lọc chung với lớp view TMB.
 * Toạ độ mm như MatBangTang (nhóm scale(0.001 −0.001)). Chỉ đọc.
 */
import { useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { caiDatView, danhGiaViewTang, type KcTheoH } from '../tinh/huongView';
import type { ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { chuTrenView, mauViewCss } from '../tinh/mauView';
import { soCanChuVi, viTriCan, type BoCuc, type ToaCoMat } from '../tinh/matBang';
import { kcToa261 } from '../tinh/xepToa';
import { TheDiemCan, ThanhMauView, datLopView, trongLoc, useLocView, useLopView } from '../man/lopView';
import { useLuatTMB } from '../man/tmbThaoTac';
import { LopNoi } from '../ui/LopNoi';
import { fmtSo } from '../ui/so';

type Props = { pa: TrangThaiPA; tv: ThuVien; toa: ToaDat; mau: ToaCoMat; bc: BoCuc; tang: number | null };

export function LopViewTang(p: Props) {
  const on = useLopView();
  return on ? <LopTrong {...p} /> : null;
}

function LopTrong({ pa, tv, toa, mau, bc, tang }: Props) {
  const luat = useLuatTMB();
  const loc = useLocView();
  const [ro, setRo] = useState<{ khoa: string; x: number; y: number; ghim: boolean } | null>(null);
  const cai = useMemo(() => caiDatView(pa.huongView), [pa.huongView]);
  const ds = useMemo(() => {
    const kc: KcTheoH | undefined = luat ? (H) => kcToa261(luat.lo02, H).dai : undefined;
    const diem = new Map(danhGiaViewTang(pa, tv, toa, mau, bc, tang, { kc }).map((d) => [d.khoa, d]));
    const vts = viTriCan(mau, tv, bc), so = soCanChuVi(mau.duong_bao, vts);
    return vts.flatMap((vt) => {
      const d = diem.get(vt.khoa);
      if (!d) return [];
      const A = vt.goc[3], B = vt.goc[2], M: [number, number] = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      // pháp tuyến vào trong căn (ngược phía ngoài): từ mặt ngoài về hành lang
      const vao: [number, number] = [vt.goc[0][0] - vt.goc[3][0], vt.goc[0][1] - vt.goc[3][1]];
      const lv = Math.hypot(vao[0], vao[1]) || 1;
      const nhan: [number, number] = [M[0] + (vao[0] / lv) * 1900, M[1] + (vao[1] / lv) * 1900];
      return [{ khoa: vt.khoa, A, B, nhan, d, so: so.get(vt.khoa) ?? 0 }];
    });
  }, [pa, tv, toa, mau, bc, tang, luat]);
  const dangRo = ro && ds.find((x) => x.khoa === ro.khoa);
  const moThe = (khoa: string, el: Element, ghim: boolean) => {
    const r = el.getBoundingClientRect();
    setRo({ khoa, x: r.right + 10, y: r.top + r.height / 2, ghim });
  };
  return (
    <g class="lop-view-tang" transform="scale(0.001 -0.001)">
      <g pointer-events="none">
        {ds.map(({ khoa, A, B, d }) => {
          const vao = trongLoc(d.tong, loc), mau = vao ? mauViewCss(d.tong) : 'var(--secondary)';
          return (
            <g key={khoa} opacity={vao ? 1 : 0.35}>
              {/* quầng sáng mềm: nét rộng mờ + nét vừa, rồi nét chính có viền sáng */}
              <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={mau} stroke-opacity="0.16" stroke-width="22" stroke-linecap="round" vector-effect="non-scaling-stroke" />
              <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={mau} stroke-opacity="0.3" stroke-width="11" stroke-linecap="round" vector-effect="non-scaling-stroke" />
              <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke="var(--panel)" stroke-width="6" stroke-linecap="round" vector-effect="non-scaling-stroke" />
              <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={mau} stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            </g>
          );
        })}
      </g>
      {ds.map(({ khoa, nhan, d }) => {
        const vao = trongLoc(d.tong, loc);
        return (
          <g key={khoa} class={`chip-view${ro?.khoa === khoa ? ' ro' : ''}`} transform={`translate(${Math.round(nhan[0])} ${Math.round(nhan[1])}) scale(1 -1)`} opacity={vao ? 1 : 0.4}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse' && !ro?.ghim) moThe(khoa, e.currentTarget, false); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setRo((r) => (r?.khoa === khoa && !r.ghim ? null : r)); }}
            onClick={(e) => { e.stopPropagation(); if (ro?.khoa === khoa && ro.ghim) setRo(null); else moThe(khoa, e.currentTarget, true); }}
            role="button" aria-label={`${t('view.ngan')} ${fmtSo(d.tong, { thapPhan: 0 })}`}>
            <rect x="-1500" y="-820" width="3000" height="1640" rx="820" fill={vao ? mauViewCss(d.tong) : 'var(--line)'} stroke="var(--panel)" stroke-width="140" />
            <text x="0" y="20" text-anchor="middle" dominant-baseline="central" font-size="1150" font-weight="700" fill={vao ? chuTrenView(d.tong) : 'var(--muted-text)'}>{fmtSo(d.tong, { thapPhan: 0 })}</text>
          </g>
        );
      })}
      {dangRo && ro && (
        <LopNoi>
          <div class={`tip-view-3d tip-view-tang${ro.ghim ? ' ghim' : ''}`} role="status"
            style={{ left: `${Math.min(ro.x, window.innerWidth - 270)}px`, top: `${Math.max(8, Math.min(ro.y - 90, window.innerHeight - 230))}px` }}>
            <TheDiemCan tieuDe={`CH-${String(dangRo.so).padStart(2, '0')}${dangRo.d.loai ? ' · ' + t(`loai.${dangRo.d.loai}`) : ''}`}
              tong={dangRo.d.tong} huong={dangRo.d.huong} thoang={dangRo.d.thoang} canh={dangRo.d.canh} nang={dangRo.d.nang}
              h8={dangRo.d.h8} kcCan={dangRo.d.kcCan} gioNang={dangRo.d.gioNang} cai={cai} />
            {ro.ghim && <button type="button" class="nut-dong-view" aria-label={t('view.dong')} onClick={() => setRo(null)}>×</button>}
          </div>
        </LopNoi>
      )}
    </g>
  );
}

/** Chú giải lớp view màn Tầng (lớp phủ góc dưới trái khung giữa, chỉ khi bật lớp). */
export function ChuGiaiViewTang({ pa }: { pa: TrangThaiPA }) {
  const on = useLopView();
  if (!on) return null;
  return (
    <div class="chu-giai-view tang" role="note" aria-label={t('view.chuGiai')}>
      <div class="cgv-dau">
        <b>{t('view.phanTich')}</b><span class="muted">{t('view.tangDangXem')}</span>
        <span class="gian" />
        <button type="button" class="nut-dong-view" aria-label={t('view.tatLop')} title={t('view.tatLop')} onClick={() => datLopView(false)}>×</button>
      </div>
      <ThanhMauView cai={caiDatView(pa.huongView)} gon />
    </div>
  );
}
