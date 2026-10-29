/** Hoa gió (SVG): 16 hướng gió THỔI TỪ, cột chồng theo dải tốc độ, Bắc thật ở trên. Màu dải: nhạt (yếu) → đậm (mạnh). */
import { t } from '../i18n/i18n';
import { hoaGio, MOC_HOA_GIO, type PhanBoGio } from '../tinh/nangGio/gio';
import { fmtSo } from '../ui/so';

const MAU_DAI = ['#cfe3ea', '#9cc9d6', '#64a8bd', '#3a7f9a', '#1f5a73', '#123b4d'];
const nhanH = (i: number) => (i % 2 ? '' : t(`view.h8.${i / 2}`));

export function HoaGio({ p, huongXem }: { p: PhanBoGio; huongXem?: number }) {
  const { dai, tongHuong } = hoaGio(p);
  const max = Math.max(...tongHuong, 1e-6), R = 78, r0 = 10;
  const vong = [0.25, 0.5, 0.75, 1].map((k) => k * max);
  const cung = (i: number, a: number, b: number) => {
    const g0 = ((i * 22.5 - 9) * Math.PI) / 180, g1 = ((i * 22.5 + 9) * Math.PI) / 180;
    const ra = r0 + (a / max) * (R - r0), rb = r0 + (b / max) * (R - r0);
    const P = (r: number, g: number) => `${(r * Math.sin(g)).toFixed(2)},${(-r * Math.cos(g)).toFixed(2)}`;
    return `M${P(ra, g0)} L${P(rb, g0)} A${rb},${rb} 0 0 1 ${P(rb, g1)} L${P(ra, g1)} A${ra},${ra} 0 0 0 ${P(ra, g0)} Z`;
  };
  return (
    <figure class="hoa-gio-ng">
      <svg viewBox="-100 -100 200 200" role="img" aria-label={t('ng.gio.hoaGio')}>
        {vong.map((v) => <circle key={v} r={r0 + (v / max) * (R - r0)} fill="none" stroke="var(--line)" stroke-width="0.6" />)}
        {huongXem !== undefined && <path d={cung(huongXem, 0, max)} fill="var(--soft)" stroke="var(--green)" stroke-width="1" />}
        {dai.map((d, i) => {
          let a = 0;
          return d.map((v, j) => { const b = a + v, el = v > 0 ? <path key={`${i}-${j}`} d={cung(i, a, b)} fill={MAU_DAI[j]} stroke="var(--panel)" stroke-width="0.4"><title>{`${nhanH(i) || i * 22.5 + '°'} · ${fmtSo(v * 100, { thapPhan: 1 })} %`}</title></path> : null; a = b; return el; });
        })}
        {Array.from({ length: 16 }, (_, i) => nhanH(i)).map((h, i) => h && <text key={i} x={92 * Math.sin((i * 22.5 * Math.PI) / 180)} y={-92 * Math.cos((i * 22.5 * Math.PI) / 180) + 3} text-anchor="middle" font-size="10" font-weight={i === 0 ? 700 : 500} fill="var(--ink)">{h}</text>)}
        <text x="2" y={-(r0 + (R - r0)) - 2} font-size="7" fill="var(--muted-text)">{fmtSo(max * 100, { thapPhan: 0 })}%</text>
      </svg>
      <figcaption>
        {MOC_HOA_GIO.map((m, j) => <span key={m}><i style={{ background: MAU_DAI[j] }} />{j < MOC_HOA_GIO.length - 1 ? `${fmtSo(m, { thapPhan: 1 })}–${fmtSo(MOC_HOA_GIO[j + 1], { thapPhan: 0 })}` : `≥ ${m}`}</span>)}
        <span class="muted">m/s</span>
      </figcaption>
    </figure>
  );
}
