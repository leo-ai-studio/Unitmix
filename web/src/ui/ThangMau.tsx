/**
 * Chú giải phân tích dùng chung (kiểu LEO): thang màu liên tục (gradient CSS) hoặc các lớp rời, kèm biểu đồ cột tỷ lệ diện tích ngay trên thang
 * và dòng số tóm tắt. Thuần hiển thị, không tính gì — gói Nắng · Gió dùng; phân tích view (man/lopView.tsx) có thể dùng lại khi hợp nhất.
 * CSS: styles/thang-mau.css.
 */
import { fmtSo } from './so';

type ChiSo = { nhan: string; gt: string };
type Props = {
  tieuDe: string;
  /** Thang liên tục: gradient CSS + nhãn hai đầu / mốc giữa. */
  gradient?: string;
  moc?: { t: number; nhan: string }[];
  /** Cột (0–1) tỷ lệ diện tích theo từng khoảng đều nhau của thang. */
  cot?: number[];
  /** Thang lớp rời: màu + nhãn + tỷ lệ (0–1). */
  lop?: { mau: string; nhan: string; tyLe?: number }[];
  chiSo?: ChiSo[];
  ghiChu?: string;
};

export function ThangMau({ tieuDe, gradient, moc, cot, lop, chiSo, ghiChu }: Props) {
  const max = cot?.length ? Math.max(...cot, 1e-9) : 1;
  return (
    <div class="thang-mau" role="group" aria-label={tieuDe}>
      <b class="thang-mau-tieu-de">{tieuDe}</b>
      {gradient && (
        <div class="thang-mau-lien">
          {cot && cot.length > 0 && (
            <div class="thang-mau-cot" aria-hidden="true">
              {cot.map((c, i) => <i key={i} style={{ height: `${Math.max(c > 0 ? 6 : 0, (c / max) * 100)}%` }} title={`${fmtSo(c * 100, { thapPhan: 0 })} %`} />)}
            </div>
          )}
          <div class="thang-mau-dai" style={{ background: gradient }} />
          {moc && <div class="thang-mau-moc">{moc.map((m) => <span key={m.t} style={{ left: `${m.t * 100}%` }}>{m.nhan}</span>)}</div>}
        </div>
      )}
      {lop && (
        <div class="thang-mau-lop">
          {lop.map((l) => (
            <div key={l.nhan} class="thang-mau-dong">
              <i style={{ background: l.mau }} />
              <span>{l.nhan}</span>
              {l.tyLe !== undefined && <span class="thang-mau-thanh"><span style={{ width: `${l.tyLe * 100}%`, background: l.mau }} /></span>}
              {l.tyLe !== undefined && <span class="so">{fmtSo(l.tyLe * 100, { thapPhan: 0 })} %</span>}
            </div>
          ))}
        </div>
      )}
      {chiSo && chiSo.length > 0 && <div class="thang-mau-so">{chiSo.map((c) => <span key={c.nhan}>{c.nhan} <b>{c.gt}</b></span>)}</div>}
      {ghiChu && <p class="thang-mau-ghi">{ghiChu}</p>}
    </div>
  );
}
