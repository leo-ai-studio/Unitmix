import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { HIEU_SUAT_MIN, type OKpi, type TrangThaiKpi } from '../tinh/kpi';
import { nguongSo, taiQuyTac, traLuat } from '../tinh/quyTac';
import { fmtSo } from './so';
import './kpi.css';

/**
 * Ô số lớn kiểu dashboard cho lãnh đạo: nhãn nhỏ · SỐ TO + đơn vị nhỏ · dòng so với chỉ tiêu (chip đạt / vượt / chưa đạt, thanh
 * tiến độ tuỳ chọn). `tip` = công thức + căn cứ (bong bóng khi rê chuột). Màu chỉ lấy biến :root (LEO + `--warn`).
 */
export function TheSo({ nhan, gt, donVi, thapPhan = 0, phu, o, tip, thanh, id }: {
  nhan: string;
  gt: number | null;
  donVi?: string;
  thapPhan?: number;
  /** Dòng phụ dưới số (so với chỉ tiêu, phép tính ngắn). */
  phu?: ComponentChildren;
  /** Kết quả so với ngưỡng: tô màu + chip trạng thái. */
  o?: OKpi | null;
  tip: string;
  /** Hiện thanh tỉ lệ gt / ngưỡng. */
  thanh?: boolean;
  id?: string;
}) {
  const tt = o?.tt ?? null;
  return (
    <div class={`the-so${tt ? ` tt-${tt}` : ''}`} title={tip} id={id} role="group" aria-label={nhan}>
      <div class="the-so-nhan"><span>{nhan}</span>{tt && <ChipTT tt={tt} />}</div>
      <div class="the-so-gt"><b>{fmtSo(gt, { thapPhan })}</b>{donVi && gt !== null && <small>{donVi}</small>}</div>
      {thanh && o?.tyLe != null && (
        <span class="the-so-thanh" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(o.tyLe * 100)} aria-label={nhan}>
          <i style={{ width: `${Math.min(100, o.tyLe * 100)}%` }} />
        </span>
      )}
      {phu && <div class="the-so-phu">{phu}</div>}
    </div>
  );
}

export function ChipTT({ tt }: { tt: Exclude<TrangThaiKpi, null> }) {
  return <span class={`chip-tt chip-${tt}`}>{t(`kpi.tt.${tt}`)}</span>;
}

/** Lưới ô số (2 cột ở panel 300 px, tự xuống 1 cột khi hẹp). */
export const LuoiSo = ({ children }: { children: ComponentChildren }) => <div class="luoi-so">{children}</div>;

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
