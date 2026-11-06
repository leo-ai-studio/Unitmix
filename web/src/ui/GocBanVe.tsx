import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import { NutBieuTuong } from './NutBieuTuong';
import type { NutHienThi } from './ThanhHienThi';

type Props = {
  /** Phóng / thu / vừa khung của bản vẽ (BanVe `dk`); không có thì ẩn cụm zoom (vd 3D tự có chuột). */
  zoom?: { phong: () => void; thu: () => void; vua: () => void; vuaLo?: () => void } | null;
  /** Nút bật / tắt lớp hiển thị — gom vào một nút "Lớp" mở danh sách. */
  lop?: NutHienThi[];
  /** Nội dung chú giải — gom vào nút "Chú giải", gập mặc định. */
  chuGiai?: ComponentChildren;
  /** Hướng dẫn thao tác — tooltip + bấm để mở. */
  troGiup?: string;
};

/**
 * Điều khiển góc bản vẽ kiểu Forma: thay dải đáy (chú giải + hướng dẫn + Phóng / Thu / Vừa khung) bằng cụm nút biểu tượng nhỏ ở hai góc dưới,
 * chú giải / lớp / hướng dẫn chỉ mở khi bấm — nhường tối đa chỗ cho mặt bằng / layout / 3D. Mọi thứ là lớp phủ, không đổi kích thước khung giữa.
 */
export function GocBanVe({ zoom, lop, chuGiai, troGiup }: Props) {
  const [mo, setMo] = useState<'' | 'lop' | 'troGiup'>('');
  const bat = (k: typeof mo) => setMo((m) => (m === k ? '' : k));
  const trai = useRef<HTMLDivElement>(null), phai = useRef<HTMLDivElement>(null);
  // bấm ra ngoài hộp đang mở (kể cả lên bản vẽ / 3D) thì tự thu lại — không phải bấm lại nút
  useEffect(() => {
    if (!mo) return;
    const hop = mo === 'lop' ? phai : trai;
    const ngoai = (e: Event) => { if (!hop.current?.contains(e.target as Node)) setMo(''); };
    document.addEventListener('pointerdown', ngoai, true);
    return () => document.removeEventListener('pointerdown', ngoai, true);
  }, [mo]);
  return (
    <>
      {(chuGiai || troGiup) && (
        <div class="goc-bv trai" ref={trai}>
          {mo === 'troGiup' && (
            <div class="goc-bv-hop" role="dialog" aria-label={t('bt.troGiup')}>
              {chuGiai}
              {troGiup && <p class="goc-bv-phim" role="note">{troGiup}</p>}
            </div>
          )}
          {/* một nút "?" mở cả chú giải lẫn hướng dẫn thao tác (trước đây hai nút nhỏ cạnh nhau) */}
          <div class="nhom-bt">
            <NutBieuTuong k="troGiup" bat={mo === 'troGiup'} onClick={() => bat('troGiup')} />
          </div>
        </div>
      )}
      {(zoom || (lop && lop.length > 0)) && (
        <div class="goc-bv phai" ref={phai}>
          {mo === 'lop' && lop && (
            <div class="goc-bv-hop lop" role="group" aria-label={t('bt.lop')}>
              {lop.map((n) => (
                <label key={n.khoa}>
                  <input type="checkbox" checked={!!n.bat} onChange={() => n.onClick?.()} /> {n.nhan}
                </label>
              ))}
            </div>
          )}
          <div class="nhom-bt doc">
            {lop && lop.length > 0 && <NutBieuTuong k="lop" bat={mo === 'lop'} onClick={() => bat('lop')} />}
            {zoom && <NutBieuTuong k="phong" lop="chi-cam-ung" onClick={zoom.phong} />}
            {zoom && <NutBieuTuong k="thu" lop="chi-cam-ung" onClick={zoom.thu} />}
            {zoom?.vuaLo && <NutBieuTuong k="vuaLo" onClick={zoom.vuaLo} />}
            {zoom && <NutBieuTuong k="vuaKhung" onClick={zoom.vua} />}
          </div>
        </div>
      )}
    </>
  );
}
