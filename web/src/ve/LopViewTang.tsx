/**
 * Lớp điểm VIEW trên mặt bằng tầng (màn Tầng): mặt ngoài mỗi căn tô Tốt / Khá / Kém + nhãn điểm nhỏ trong căn sát mặt ngoài
 * (tinh/huongView.ts `danhGiaViewTang`: mắt ở đúng tầng đang xem, mọi tòa khác của PA là vật cản). Bật / tắt chung với lớp view TMB
 * (nút Lớp › Điểm view). Toạ độ mm như MatBangTang (nhóm scale(0.001 −0.001)). Chỉ đọc.
 */
import { useMemo } from 'preact/hooks';
import { danhGiaViewTang, type KcTheoH } from '../tinh/huongView';
import type { ThuVien, ToaDat, TrangThaiPA } from '../tinh/kieu';
import { viTriCan, type BoCuc, type ToaCoMat } from '../tinh/matBang';
import { kcToa261 } from '../tinh/xepToa';
import { MAU_XEP, TEN_HUONG, useLopView } from '../man/lopView';
import { useLuatTMB } from '../man/tmbThaoTac';
import { fmtSo } from '../ui/so';

type Props = { pa: TrangThaiPA; tv: ThuVien; toa: ToaDat; mau: ToaCoMat; bc: BoCuc; tang: number | null };

export function LopViewTang(p: Props) {
  const on = useLopView();
  return on ? <LopTrong {...p} /> : null;
}

function LopTrong({ pa, tv, toa, mau, bc, tang }: Props) {
  const luat = useLuatTMB();
  const ds = useMemo(() => {
    const kc: KcTheoH | undefined = luat ? (H) => kcToa261(luat.lo02, H).dai : undefined;
    const diem = new Map(danhGiaViewTang(pa, tv, toa, mau, bc, tang, { kc }).map((d) => [d.khoa, d]));
    return viTriCan(mau, tv, bc).flatMap((vt) => {
      const d = diem.get(vt.khoa);
      if (!d) return [];
      const A = vt.goc[3], B = vt.goc[2], M: [number, number] = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
      // pháp tuyến vào trong căn (ngược phía ngoài): từ mặt ngoài về hành lang
      const vao: [number, number] = [vt.goc[0][0] - vt.goc[3][0], vt.goc[0][1] - vt.goc[3][1]];
      const lv = Math.hypot(vao[0], vao[1]) || 1;
      const nhan: [number, number] = [M[0] + (vao[0] / lv) * 1100, M[1] + (vao[1] / lv) * 1100];
      return [{ khoa: vt.khoa, A, B, nhan, d, rong: L }];
    });
  }, [pa, tv, toa, mau, bc, tang, luat]);
  return (
    <g class="lop-view-tang" transform="scale(0.001 -0.001)" pointer-events="none">
      {ds.map(({ khoa, A, B, nhan, d }) => (
        <g key={khoa}>
          <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={MAU_XEP[d.xep]} stroke-width="5" vector-effect="non-scaling-stroke" />
          <g transform={`translate(${Math.round(nhan[0])} ${Math.round(nhan[1])}) scale(1 -1)`}>
            <title>{`${fmtSo(d.tong, { thapPhan: 0 })} · ${TEN_HUONG(d.h8)}`}</title>
            <rect x="-760" y="-430" width="1520" height="860" rx="430" fill={MAU_XEP[d.xep]} fill-opacity="0.92" />
            <text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-size="600" font-weight="700" fill="#fff">{fmtSo(d.tong, { thapPhan: 0 })}</text>
          </g>
        </g>
      ))}
    </g>
  );
}
