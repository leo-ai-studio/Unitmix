import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { HIEU_SUAT_MIN, type OKpi } from '../tinh/kpi';
import { nguongSo, taiQuyTac, traLuat } from '../tinh/quyTac';
import { fmtSo } from './so';
import './kpi.css';

/**
 * Ô số cho lãnh đạo: nhãn đậm · SỐ TO + đơn vị nhỏ · dòng giới hạn theo chỉ tiêu QH. Trạng thái (đạt / sát / vượt) thể hiện bằng màu cả thẻ,
 * không chip, không thanh; chữ trạng thái vào aria-label và bong bóng. `tip` = công thức + căn cứ (rê chuột). Màu chỉ lấy biến CSS.
 */
export function TheSo({ nhan, gt, donVi, thapPhan = 0, phu, o, tip, id }: {
  nhan: string;
  gt: number | null;
  donVi?: string;
  thapPhan?: number;
  /** Dòng giới hạn dưới số (≤ ngưỡng quy hoạch). */
  phu?: ComponentChildren;
  /** Kết quả so với ngưỡng: tô màu cả thẻ. */
  o?: OKpi | null;
  tip: string;
  id?: string;
}) {
  const tt = o?.tt ?? null;
  const chuTT = tt ? t(`kpi.tt.${tt}`) : '';
  return (
    <div class={`the-so${tt ? ` tt-${tt}` : ''}`} title={chuTT ? `${tip}
${chuTT}` : tip} id={id} role="group" aria-label={chuTT ? `${nhan}: ${chuTT}` : nhan}>
      <div class="the-so-nhan"><span>{nhan}</span></div>
      <div class="the-so-gt"><b>{fmtSo(gt, { thapPhan })}</b>{donVi && gt !== null && <small>{donVi}</small>}</div>
      {phu && <div class="the-so-phu">{phu}</div>}
    </div>
  );
}

/** Lưới ô số (2 cột ở panel 300 px, tự xuống 1 cột khi hẹp; `cot3` = 3 cột × 2 hàng như Chỉ tiêu chính). */
export const LuoiSo = ({ children, cot3 }: { children: ComponentChildren; cot3?: boolean }) => <div class={`luoi-so${cot3 ? ' cot3' : ''}`}>{children}</div>;

/** Vòng donut tỉ lệ (tổng 100) với chữ giữa vòng. */
export function VongKpi({ phan, so, chu, nhan }: { phan: { mau: string; v: number; ten: string }[]; so: string; chu: string; nhan: string }) {
  const r = 15.915; // chu vi ≈ 100
  let daQua = 0;
  return (
    <svg class="vong-kpi" viewBox="0 0 42 42" width="96" height="96" role="img" aria-label={nhan}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="var(--line)" stroke-width="6" />
      {phan.map((p) => {
        const c = p.v > 0 ? (
          <circle key={p.ten} cx="21" cy="21" r={r} fill="none" stroke={p.mau} stroke-width="6" stroke-dasharray={`${p.v} ${100 - p.v}`} stroke-dashoffset={25 - daQua}>
            <title>{`${p.ten}: ${fmtSo(p.v, { thapPhan: 1 })} %`}</title>
          </circle>
        ) : null;
        daQua += p.v;
        return c;
      })}
      <text x="21" y="22" text-anchor="middle" class="vong-kpi-so">{so}</text>
      <text x="21" y="27.5" text-anchor="middle" class="vong-kpi-chu">{chu}</text>
    </svg>
  );
}

/** Ngưỡng hiệu suất MT-03 (`mdi_eff`) đọc từ quy_tac.json; chưa tải xong thì dùng hằng `HIEU_SUAT_MIN`. */
export function useHieuSuatMin(): number {
  const [v, setV] = useState(HIEU_SUAT_MIN);
  useEffect(() => {
    let song = true;
    taiQuyTac().then((bo) => { const l = traLuat(bo, 'mdi_eff'); const n = l ? nguongSo(l) : null; if (song && n) setV(n); }).catch(() => {});
    return () => { song = false; };
  }, []);
  return v;
}

/** % có 1 chữ số thập phân. */
export const pct1 = (v: number | null | undefined) => (v == null ? '—' : `${fmtSo(v * 100, { thapPhan: 1 })} %`);
