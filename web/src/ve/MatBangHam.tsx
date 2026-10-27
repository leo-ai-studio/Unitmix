import { t } from '../i18n/i18n';
import { trongTam } from '../tinh/hinhHoc';
import type { KetQuaHam, KetQuaTangHam } from '../tinh/ham';
import type { Diem } from '../tinh/kieu';
import { fmtSo } from '../ui/so';
import { s, sPoly } from './BanVe';

const vNS = { 'vector-effect': 'non-scaling-stroke' } as const;
/** Góc chữ dễ đọc: đưa về (−90°, 90°] để chữ không lộn ngược. */
const gocDoc = (g: number) => {
  const a = ((((g + 180) % 360) + 360) % 360) - 180;
  return a > 90 ? a - 180 : a <= -90 ? a + 180 : a;
};
const duong =(ds: Diem[][]) => ds.map((p) => `M${p.map(s).join(' L')} Z`).join(' ');

/** Mặt bằng một tầng hầm (trong `BanVe`): ranh, làn, chỗ đỗ, xe lăn, khu sạc, xe máy, kho, kỹ thuật, lõi, cột, ram. */
export function MatBangHam({ kq, tang, coChu }: { kq: KetQuaHam; tang: KetQuaTangHam; coChu: number }) {
  const ram = kq.ram;
  const docRam = kq.ts.ram.dai > 0 ? (kq.ts.caoTang / kq.ts.ram.dai) * 100 : null;
  const nhanVung = (ds: Diem[][], chu: string, key: string) =>
    ds.filter((p) => p.length >= 3).map((p, i) => {
      const [x, y] = trongTam(p);
      return <text key={`${key}${i}`} x={x} y={-y} text-anchor="middle" font-size={coChu * 0.8} font-weight="700">{chu}</text>;
    });
  return (
    <g class="ham-ve">
      <polygon class="ranh-ham" points={sPoly(kq.ranh)} {...vNS} />
      <path class="lan" d={duong(tang.lan)} />
      <path class="ky-thuat" d={duong(tang.kyThuat)} fill-rule="evenodd" {...vNS} />
      <path class="xe-may" d={duong(tang.xeMay)} fill-rule="evenodd" {...vNS} />
      {tang.cho.map((p, i) => <polygon key={`c${i}`} class="cho" points={sPoly(p)} {...vNS} />)}
      {tang.xeLan.map((p, i) => <polygon key={`x${i}`} class="xe-lan" points={sPoly(p)} {...vNS} />)}
      {tang.vungSac.map((vung, v) => vung.map((p, i) => (
        <polygon key={`s${v}-${i}`} class="sac" points={sPoly(p)} fill="var(--ham-sac)" fill-opacity={v % 2 ? 0.6 : 1} {...vNS} />
      )))}
      {tang.vungSac.map((vung, v) => {
        const tam = vung.map(trongTam);
        const x = tam.reduce((a, p) => a + p[0], 0) / tam.length, y = tam.reduce((a, p) => a + p[1], 0) / tam.length;
        return <text key={`sv${v}`} x={x} y={-y} text-anchor="middle" font-size={coChu * 0.75} font-weight="700">{`${t('ham.vungSac')} ${v + 1}`}</text>;
      })}
      {tang.kho.map((p, i) => <polygon key={`k${i}`} class="kho" points={sPoly(p)} {...vNS} />)}
      {kq.loi.map((p, i) => <polygon key={`l${i}`} class="loi" points={sPoly(p)} />)}
      {kq.cot.map((p, i) => <polygon key={`o${i}`} class="cot" points={sPoly(p)} />)}
      {ram && (
        <g>
          <polygon class="ram" points={sPoly(ram.poly)} {...vNS} />
          <text x={ram.x} y={-ram.y} text-anchor="middle" font-size={coChu * 0.8} font-weight="700"
            transform={`rotate(${-gocDoc(ram.gocDo)} ${ram.x} ${-ram.y})`}>
            {`${t('ham.ram')} ${docRam === null ? '' : fmtSo(docRam, { thapPhan: 1, donVi: '%' })} →`}
          </text>
        </g>
      )}
      {nhanVung(tang.xeMay, t('ham.xeMay'), 'nm')}
      {nhanVung(tang.kyThuat, t('ham.kyThuat'), 'nk')}
    </g>
  );
}

/** Chú giải màu bản vẽ hầm. */
export function ChuGiaiHam({ coSac }: { coSac: boolean }) {
  const ds: [string, string, string][] = [
    ['var(--ham-cho)', 'var(--muted)', 'ham.choOto'],
    ['var(--ham-xe-lan)', 'var(--thua)', 'ham.choXeLan'],
    ...(coSac ? [['var(--ham-sac)', 'var(--ok)', 'ham.choSac'] as [string, string, string]] : []),
    ['var(--ham-xe-may)', '#c7aa76', 'ham.xeMay'],
    ['var(--ham-kho)', '#8f7bb0', 'ham.kho'],
    ['var(--ham-ky-thuat)', 'var(--muted)', 'ham.kyThuat'],
    ['var(--ham-loi)', 'var(--ham-loi)', 'ham.loiCot'],
    ['var(--ham-ram)', '#a15c1d', 'ham.ram'],
  ];
  return (
    <div class="chu-giai-dat" aria-label={t('ham.chuGiai')}>
      {ds.map(([nen, vien, k]) => <span key={k}><i style={{ background: nen, borderColor: vien }} />{t(k)}</span>)}
    </div>
  );
}
