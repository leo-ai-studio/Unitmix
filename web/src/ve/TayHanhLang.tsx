import { useRef, useState } from 'preact/hooks';
import { t } from '../i18n/i18n';
import type { Diem } from '../tinh/kieu';
import { dauHanhLangNgoai, HL_TAY, type ToaMB } from '../tinh/loiThang';
import { batHanhLang } from '../tinh/thaoTacTay';
import { fmtSo } from '../ui/so';

/**
 * Tay nắm co kéo đầu hành lang (app cũ p14 `startAxDrag` · QT-38 · QT-39 · QT-55): vòng tròn ở hai đầu mút NGOÀI của mỗi trục hành
 * lang (đầu nối góc / chạm lõi không có). Kéo dọc trục — bóng nét đứt + số "± m" bám tay (bước 100 mm, hít về vị trí tự động trong
 * 400 mm); thả thì chạy phép `keoHanhLangTay` (nền, nét bao + DTXD + cự ly thoát nạn tính lại). Bấm đúp = đầu đó về tự động.
 * Toạ độ mm như MatBangTang (nhóm scale(0.001 −0.001)); `hanhLangTay` = độ dời đang có của tòa.
 */
export function TayHanhLang({ mau, hanhLangTay, onKeo, khoa }: {
  mau: ToaMB;
  hanhLangTay: Record<string, [number, number]> | undefined;
  /** Trả promise (nếu có) → tay nắm giữ ở vị trí vừa thả cho tới khi phép nền xong (không nhảy về chỗ cũ rồi mới chạy tới). */
  onKeo: (i: number, dau: 0 | 1, d: number) => unknown;
  /** Phép tay khác đang chạy nền: tay nắm vẫn hiện (không biến mất rồi hiện lại) nhưng mờ, chưa kéo được. */
  khoa?: boolean;
}) {
  const g = useRef<SVGGElement>(null);
  const [keo, setKeo] = useState<{ i: number; dau: 0 | 1; d0: number; d: number } | null>(null);
  // vừa thả, chờ phép nền: giữ tổng độ dời đã thả (so với tự động) thay cho giá trị trong PA
  const [cho, setCho] = useState<{ i: number; dau: 0 | 1; tong: number } | null>(null);
  const luot = useRef(0);
  const hl = mau.hanh_lang ?? [];
  const nua = (mau.hanh_lang_mm || 1800) / 2;
  const diemMm = (e: PointerEvent): Diem | null => {
    const m = g.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  const batDau = (e: PointerEvent, i: number, dau: 0 | 1) => {
    if (e.button !== 0 || khoa) return;
    e.stopPropagation();
    e.preventDefault();
    const s = hl[i], L = Math.hypot(s.p1[0] - s.p0[0], s.p1[1] - s.p0[1]) || 1;
    const u: Diem = [(s.p1[0] - s.p0[0]) / L, (s.p1[1] - s.p0[1]) / L], huong = dau ? 1 : -1;
    const p0 = diemMm(e);
    if (!p0) return;
    const d0 = hanhLangTay?.[String(i)]?.[dau] ?? 0;
    let cur = { i, dau, d0, d: 0 };
    setKeo(cur);
    const di = (ev: PointerEvent) => {
      const p = diemMm(ev);
      if (!p) return;
      const d = ((p[0] - p0[0]) * u[0] + (p[1] - p0[1]) * u[1]) * huong;
      // bắt theo tổng độ dời so với tự động (hít về 0 trong 400 mm), giới hạn ±20 m
      const tong = Math.max(-HL_TAY.daiMax, Math.min(HL_TAY.daiMax, batHanhLang(d0 + d)));
      cur = { ...cur, d: tong - d0 };
      setKeo(cur);
    };
    const tha = () => {
      window.removeEventListener('pointermove', di);
      window.removeEventListener('pointerup', tha);
      window.removeEventListener('pointercancel', tha);
      setKeo(null);
      if (Math.abs(cur.d) >= 1) giaoKeo(i, dau, cur.d0 + cur.d);
    };
    window.addEventListener('pointermove', di);
    window.addEventListener('pointerup', tha);
    window.addEventListener('pointercancel', tha);
  };
  const giaoKeo = (i: number, dau: 0 | 1, tong: number) => {
    const n = ++luot.current;
    setCho({ i, dau, tong });
    const xong = () => { if (luot.current === n) setCho(null); };
    try { Promise.resolve(onKeo(i, dau, tong)).then(xong, xong); } catch (err) { xong(); throw err; }
  };
  const r = Math.max(450, nua * 0.5);
  return (
    <g ref={g} class={`tay-hl${khoa ? ' khoa' : ''}`}>
      {hl.map((s, i) => dauHanhLangNgoai(hl, i, mau.duong_bao).map((dau) => {
        const p = dau ? s.p1 : s.p0, L = Math.hypot(s.p1[0] - s.p0[0], s.p1[1] - s.p0[1]) || 1;
        const u: Diem = [(s.p1[0] - s.p0[0]) / L, (s.p1[1] - s.p0[1]) / L], huong = dau ? 1 : -1;
        const dang = keo && keo.i === i && keo.dau === dau ? keo : null;
        const hienCo = hanhLangTay?.[String(i)]?.[dau] ?? 0;
        const giu = !dang && cho && cho.i === i && cho.dau === dau ? cho : null;
        const dich = dang ? dang.d : giu ? giu.tong - hienCo : 0;
        const q: Diem = dich ? [p[0] + u[0] * dich * huong, p[1] + u[1] * dich * huong] : p;
        const tong = hienCo + dich;
        return (
          <g key={`${i}-${dau}`}>
            {dang && (
              <>
                <line class="tay-hl-bong" x1={Math.round(p[0])} y1={Math.round(p[1])} x2={Math.round(q[0])} y2={Math.round(q[1])} stroke-width={nua * 2} />
                <text class="tay-hl-so" x="0" y="0" text-anchor="middle" font-size="900"
                  transform={`translate(${Math.round(q[0] + u[0] * huong * 1600)} ${Math.round(q[1] + u[1] * huong * 1600)}) scale(1 -1)`}>
                  {tong === 0 ? t('cc.hl.tuDong') : `${tong > 0 ? '+' : '−'}${fmtSo(Math.abs(tong) / 1000, { thapPhan: 1 })} m`}
                </text>
              </>
            )}
            <circle class={`tay-hl-nut${tong ? ' da-keo' : ''}`} cx={Math.round(q[0])} cy={Math.round(q[1])} r={r} vector-effect="non-scaling-stroke"
              data-hl={`${i}:${dau}`} onPointerDown={(e) => batDau(e as unknown as PointerEvent, i, dau)}
              onDblClick={(e) => { e.stopPropagation(); if (hanhLangTay?.[String(i)]?.[dau]) giaoKeo(i, dau, 0); }}>
              <title>{t('cc.hl.gt')}</title>
            </circle>
          </g>
        );
      }))}
    </g>
  );
}
