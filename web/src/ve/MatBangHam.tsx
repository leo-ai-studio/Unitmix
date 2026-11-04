import { useMemo } from 'preact/hooks';
import { t, useLang } from '../i18n/i18n';
import { trongTam } from '../tinh/hinhHoc';
import type { KetQuaHam, KetQuaTangHam } from '../tinh/ham';
import type { Diem, Lo } from '../tinh/kieu';
import { fmtSo } from '../ui/so';
import { doanTruc, luoiCotHam } from '../tinh/luoiCot';
import { useLopHam } from './lopHam';
import { s, sPoly } from './BanVe';

const vNS = { 'vector-effect': 'non-scaling-stroke' } as const;
/** Góc chữ dễ đọc: đưa về (−90°, 90°] để chữ không lộn ngược. */
const gocDoc = (g: number) => {
  const a = ((((g + 180) % 360) + 360) % 360) - 180;
  return a > 90 ? a - 180 : a <= -90 ? a + 180 : a;
};
/** Nhiều đa giác → một chuỗi `d` (mỗi đa giác một subpath; các ô không chồng nhau nên tô như từng polygon). */
const duong = (ds: Diem[][]) => ds.filter((p) => p && p.length >= 3).map((p) => `M${p.map(s).join(' L')} Z`).join(' ');
/** Nhãn hai dòng (tên + DT) tại trọng tâm mảnh lớn nhất. */
function NhanPhong({ poly, ten, dt, coChu }: { poly: Diem[][]; ten: string; dt?: number; coChu: number }) {
  const p = poly.filter((x) => x.length >= 3).sort((a, b) => b.length - a.length)[0];
  if (!p) return null;
  const [x, y] = trongTam(p);
  return (
    <text x={x} y={-y} text-anchor="middle" font-size={coChu * 0.45} class="nhan-phong">
      <tspan x={x} dy={0}>{ten}</tspan>
      {dt !== undefined && <tspan x={x} dy={coChu * 0.5}>{fmtSo(dt, { donVi: 'm²' })}</tspan>}
    </text>
  );
}

/**
 * Mặt bằng một tầng hầm (trong `BanVe`): ranh, làn + đường ngang, chỗ đỗ, xe lăn, khu sạc, xe máy, kho, phòng kỹ thuật, khoang cháy
 * (tường + rèm), thang thoát nạn, hộp gió, lõi, cột, ram + lưới cột. Chia BA lớp để zoom không vẽ lại hình nặng:
 *  - HÌNH (path gộp mỗi loại ô, nhớ theo kết quả + tầng + lớp khoang cháy) — không phụ thuộc cỡ chữ;
 *  - LƯỚI CỘT (trục, bong bóng, nhịp) — theo cỡ chữ;
 *  - NHÃN (chữ, điểm lán cụt) — theo cỡ chữ, chỉ vẽ khi bật lớp "Nhãn" / "Thoát nạn" (mặc định tắt cho gọn).
 * `coChu` đổi theo thước tỷ lệ của BanVe nên chữ luôn cỡ đọc được ở mọi mức zoom.
 */
export function MatBangHam({ kq, tang, coChu }: { kq: KetQuaHam; tang: KetQuaTangHam; coChu: number }) {
  const [lang] = useLang();
  const lop = useLopHam();
  const hinh = useMemo(() => <HinhHam kq={kq} tang={tang} khoang={lop.khoang} />, [kq, tang, lop.khoang]);
  const luoi = useMemo(() => (lop.luoi ? <LuoiCotHam kq={kq} coChu={coChu} /> : null), [kq, coChu, lop.luoi]);
  const nhan = useMemo(() => <NhanHam kq={kq} tang={tang} coChu={coChu} nhan={lop.nhan} thoat={lop.thoat} khoang={lop.khoang} />, [kq, tang, coChu, lang, lop.nhan, lop.thoat, lop.khoang]);
  return <g class="ham-ve">{luoi}{hinh}{nhan}</g>;
}

/** Lưới cột: trục dài mảnh nét chấm gạch, bong bóng tên trục ở hai đầu, nhịp (m) giữa hai trục kề ở mép dưới / trái. */
function LuoiCotHam({ kq, coChu }: { kq: KetQuaHam; coChu: number }) {
  const l = useMemo(() => luoiCotHam(kq.cot, kq.ranh, kq.ts.nhip), [kq]);
  if (!l) return null;
  const r = coChu * 0.45, lui = coChu * 1.4;
  const ve = (u: number, v: number): Diem => [u * Math.cos(l.goc) - v * Math.sin(l.goc), u * Math.sin(l.goc) + v * Math.cos(l.goc)];
  // bong bóng chỉ vẽ khi cách bong bóng trước đủ xa (zoom xa thì thưa bớt, không đè chữ lên nhau)
  const thua = (ds: { ten: string; gia: number }[]) => { let cuoi = -Infinity; return new Set(ds.filter((x) => (x.gia - cuoi >= r * 2.6 ? ((cuoi = x.gia), true) : false)).map((x) => x.ten)); };
  const hienU = thua(l.u), hienV = thua(l.v);
  const bong = (p: Diem, chu: string, k: string) => (
    <g key={k}>
      <circle cx={p[0]} cy={-p[1]} r={r} class="luoi-bong" {...vNS} />
      <text x={p[0]} y={-p[1]} text-anchor="middle" dominant-baseline="central" font-size={r * 1.15} class="luoi-chu">{chu}</text>
    </g>
  );
  return (
    <g class="luoi-cot" aria-hidden="true">
      {l.u.map((x) => { const [a, b] = doanTruc(l, 'u', x.gia, lui * 0.6); return <line key={`u${x.ten}`} class="luoi-truc" x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} {...vNS} />; })}
      {l.v.map((x) => { const [a, b] = doanTruc(l, 'v', x.gia, lui * 0.6); return <line key={`v${x.ten}`} class="luoi-truc" x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} {...vNS} />; })}
      {l.u.filter((x) => hienU.has(x.ten)).map((x) => bong(ve(x.gia, l.hop[1] - lui), x.ten, `bu${x.ten}`))}
      {l.v.filter((x) => hienV.has(x.ten)).map((x) => bong(ve(l.hop[0] - lui, x.gia), x.ten, `bv${x.ten}`))}
      {l.u.slice(1).map((x, i) => { const g = x.gia - l.u[i].gia, p = ve((x.gia + l.u[i].gia) / 2, l.hop[1] - lui); if (g < r * 6) return null; return <text key={`nu${i}`} x={p[0]} y={-p[1]} text-anchor="middle" dominant-baseline="central" font-size={r * 1.05} class="luoi-nhip">{fmtSo(g, { thapPhan: 1 })}</text>; })}
      {l.v.slice(1).map((x, i) => { const g = x.gia - l.v[i].gia, p = ve(l.hop[0] - lui, (x.gia + l.v[i].gia) / 2); if (g < r * 6) return null; return <text key={`nv${i}`} x={p[0]} y={-p[1]} text-anchor="middle" dominant-baseline="central" font-size={r * 1.05} class="luoi-nhip">{fmtSo(g, { thapPhan: 1 })}</text>; })}
    </g>
  );
}

function HinhHam({ kq, tang, khoang }: { kq: KetQuaHam; tang: KetQuaTangHam; khoang: boolean }) {
  const ram = kq.ram;
  const sacChan = tang.vungSac.filter((_, v) => v % 2 === 0).flat();
  const sacLe = tang.vungSac.filter((_, v) => v % 2 === 1).flat();
  const phongDai = tang.phong ?? [];
  const thangThem = kq.thang?.filter((x) => x.nguon === 'them') ?? [];
  return (
    <g>
      <polygon class="ranh-ham" points={sPoly(kq.ranh)} {...vNS} />
      <path class="lan" d={duong(tang.lan)} />
      <path class="ky-thuat" d={duong(tang.kyThuat)} fill-rule="evenodd" {...vNS} />
      {phongDai.length > 0 && <path class="phong" d={duong(phongDai.flatMap((p) => p.poly))} {...vNS} />}
      <path class="xe-may" d={duong(tang.xeMay)} fill-rule="evenodd" {...vNS} />
      {tang.choXeMay?.length > 0 && <path class="cho-xe-may" d={duong(tang.choXeMay)} {...vNS} />}
      {tang.cho.length > 0 && <path class="cho" d={duong(tang.cho)} {...vNS} />}
      {tang.xeLan.length > 0 && <path class="xe-lan" d={duong(tang.xeLan)} {...vNS} />}
      {sacChan.length > 0 && <path class="sac" d={duong(sacChan)} fill="var(--ham-sac)" fill-opacity={1} {...vNS} />}
      {sacLe.length > 0 && <path class="sac" d={duong(sacLe)} fill="var(--ham-sac)" fill-opacity={0.6} {...vNS} />}
      {tang.kho.length > 0 && <path class="kho" d={duong(tang.kho)} {...vNS} />}
      {(kq.ongGio?.length ?? 0) > 0 && <path class="ong-gio" d={duong(kq.ongGio.map((g) => g.poly))} {...vNS} />}
      {thangThem.length > 0 && <path class="thang-thoat" d={duong(thangThem.map((x) => x.poly))} {...vNS} />}
      {kq.loi.length > 0 && <path class="loi" d={duong(kq.loi)} />}
      {kq.cot.length > 0 && <path class="cot" d={duong(kq.cot)} />}
      {ram && (
        <g>
          <polygon class="ram" points={sPoly(ram.poly)} {...vNS} />
          {tang.ramThang && <polygon class="ram-thang" points={sPoly(tang.ramThang)} {...vNS} />}
        </g>
      )}
      {khoang && (kq.tuongChay ?? []).map(([a, b], i) => <line key={`tc${i}`} class="tuong-chay" x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} {...vNS} />)}
      {khoang && (tang.remChay ?? []).length > 0 && <path class="rem-chay" d={duong(tang.remChay)} {...vNS} />}
    </g>
  );
}

function NhanHam({ kq, tang, coChu, nhan, thoat, khoang }: { kq: KetQuaHam; tang: KetQuaTangHam; coChu: number; nhan: boolean; thoat: boolean; khoang: boolean }) {
  const ram = kq.ram;
  const cao = kq.ts.caoTang, c = kq.ts.ram.doanChuyen ?? 0;
  const docRam = kq.ts.ram.dai - c > 0 ? (cao / (kq.ts.ram.dai - c)) * 100 : null;
  const nhanVung = (ds: Diem[][], chu: string, key: string) =>
    ds.filter((p) => p.length >= 3).map((p, i) => {
      const [x, y] = trongTam(p);
      return <text key={`${key}${i}`} x={x} y={-y} text-anchor="middle" font-size={coChu * 0.8} font-weight="700">{chu}</text>;
    });
  const phongDai = tang.phong ?? [];
  const thangThem = kq.thang?.filter((x) => x.nguon === 'them') ?? [];
  const r = coChu * 0.45;
  return (
    <g>
      {/* nhãn dốc ram luôn hiện (ngắn, mốc quan trọng) */}
      {ram && (
        <text x={ram.x} y={-ram.y} text-anchor="middle" font-size={coChu * 0.8} font-weight="700"
          transform={`rotate(${-gocDoc(ram.gocDo)} ${ram.x} ${-ram.y})`}>
          {`${t('ham.ram')} ${docRam === null ? '' : fmtSo(docRam, { thapPhan: 1, donVi: '%' })} →`}
        </text>
      )}
      {khoang && !nhan && (kq.khoang ?? []).map((k) => {
        const p = k.manh.filter((x) => x.length >= 3).sort((a, b) => b.length - a.length)[0];
        if (!p) return null;
        const [x, y] = trongTam(p);
        return <text key={`kc${k.so}`} x={x} y={-y} text-anchor="middle" font-size={coChu * 0.6} font-weight="700" class="nhan-khoang">{`${t('ham.khoangNgan')} ${k.so + 1}`}</text>;
      })}
      {nhan && (
        <g>
          {tang.vungSac.map((vung, v) => {
            const tam = vung.map(trongTam);
            const x = tam.reduce((a, p) => a + p[0], 0) / tam.length, y = tam.reduce((a, p) => a + p[1], 0) / tam.length;
            return <text key={`sv${v}`} x={x} y={-y} text-anchor="middle" font-size={coChu * 0.75} font-weight="700">{`${t('ham.vungSac')} ${v + 1}`}</text>;
          })}
          {phongDai.map((p) => <NhanPhong key={p.ma} poly={p.poly} ten={t(`ham.phongNgan.${p.loai}`)} dt={p.dt} coChu={coChu} />)}
          {thangThem.map((x, i) => <text key={`tb${i}`} x={x.tam[0]} y={-x.tam[1]} text-anchor="middle" dominant-baseline="middle" font-size={coChu * 0.55} font-weight="700" class="nhan-thang">{x.chung ? 'TB*' : 'TB'}</text>)}
          {(kq.ongGio ?? []).map((g, i) => { const [x, y] = trongTam(g.poly); return <text key={`og${i}`} x={x} y={-y} text-anchor="middle" dominant-baseline="middle" font-size={coChu * 0.5} font-weight="700">{g.loai === 'thai' ? 'GT' : 'GC'}</text>; })}
          {khoang && (kq.khoang ?? []).map((k) => {
            const p = k.manh.filter((x) => x.length >= 3).sort((a, b) => b.length - a.length)[0];
            if (!p) return null;
            const [x, y] = trongTam(p);
            return <text key={`kc${k.so}`} x={x} y={-y} text-anchor="middle" font-size={coChu * 1.0} font-weight="700" class="nhan-khoang">{`${t('ham.khoangNgan')} ${k.so + 1} · ${fmtSo(k.dt, { donVi: 'm²' })}`}</text>;
          })}
          {nhanVung(tang.xeMay, `${t('ham.xeMay')} ${tang.soXeMay ? fmtSo(tang.soXeMay) : ''}`, 'nm')}
          {!(tang.phong?.length) && nhanVung(tang.kyThuat, t('ham.kyThuat'), 'nk')}
        </g>
      )}
      {thoat && (tang.cutDuong ?? []).map((p, i) => (
        <g key={`cd${i}`} class="cut-duong">
          <circle cx={p[0]} cy={-p[1]} r={r} {...vNS} />
          <line x1={p[0] - r * 0.6} y1={-p[1] - r * 0.6} x2={p[0] + r * 0.6} y2={-p[1] + r * 0.6} {...vNS} />
          <line x1={p[0] - r * 0.6} y1={-p[1] + r * 0.6} x2={p[0] + r * 0.6} y2={-p[1] - r * 0.6} {...vNS} />
        </g>
      ))}
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
    ['var(--ham-phong)', 'var(--muted)', 'ham.kyThuat'],
    ['var(--ham-thang)', 'var(--vuot)', 'ham.thangThoat'],
    ['var(--ham-gio)', '#3b6ea8', 'ham.ongGio'],
    ['transparent', 'var(--vuot)', 'ham.tuongChay'],
    ['var(--ham-loi)', 'var(--ham-loi)', 'ham.loiCot'],
    ['var(--ham-ram)', '#a15c1d', 'ham.ram'],
  ];
  return (
    <div class="chu-giai-dat" aria-label={t('ham.chuGiai')}>
      {ds.map(([nen, vien, k]) => <span key={k}><i style={{ background: nen, borderColor: vien }} />{t(k)}</span>)}
    </div>
  );
}

/**
 * Mặt bằng TẦNG 1 (cốt 0) phía trên hầm: ranh lô, đế / chân tháp, ranh hầm (nét đứt), miệng ram + đoạn thẳng + đường vào,
 * miệng gió (louver) của hộp gió hầm, lối ra thang thoát nạn hầm, phần còn lại = sân / cảnh quan.
 */
export function MatBangT1({ kq, lo, coChu }: { kq: KetQuaHam; lo: Lo; coChu: number }) {
  const [lang] = useLang();
  return useMemo(() => {
    const t1 = kq.t1;
    return (
      <g class="ham-ve t1-ve">
        <polygon class="t1-lo" points={sPoly(lo.ranh)} {...vNS} />
        <polygon class="t1-ranh-ham" points={sPoly(kq.ranh)} {...vNS} />
        {t1.de.length > 0 && <path class="t1-de" d={duong(t1.de)} fill-rule="evenodd" {...vNS} />}
        {t1.chan.length > 0 && <path class="t1-thap" d={duong(t1.chan)} {...vNS} />}
        {t1.duongVao && (
          <line class="t1-duong-vao" x1={t1.duongVao[0][0]} y1={-t1.duongVao[0][1]} x2={t1.duongVao[1][0]} y2={-t1.duongVao[1][1]}
            stroke-width={(kq.ts.ram.rong || 6)} />
        )}
        {t1.ramThang && <polygon class="ram-thang" points={sPoly(t1.ramThang)} {...vNS} />}
        {t1.ramMo && <polygon class="ram" points={sPoly(t1.ramMo)} {...vNS} />}
        {t1.miengGio.length > 0 && <path class="ong-gio" d={duong(t1.miengGio.map((g) => g.poly))} {...vNS} />}
        {t1.thangRa.length > 0 && <path class="thang-thoat" d={duong(t1.thangRa)} {...vNS} />}
        {kq.loi.length > 0 && <path class="loi" d={duong(kq.loi)} />}
        {t1.chan.map((p, i) => { const [x, y] = trongTam(p); return <text key={`th${i}`} x={x} y={-y} text-anchor="middle" font-size={coChu} font-weight="700">{t('ham.t1.thap')}</text>; })}
        {t1.miengGio.map((g, i) => { const [x, y] = trongTam(g.poly); return <text key={`lv${i}`} x={x} y={-y} text-anchor="middle" dominant-baseline="middle" font-size={coChu * 0.5} font-weight="700">LV</text>; })}
        {t1.thangRa.map((p, i) => { const [x, y] = trongTam(p); return <text key={`tr${i}`} x={x} y={-y} text-anchor="middle" dominant-baseline="middle" font-size={coChu * 0.5} font-weight="700" class="nhan-thang">↑TB</text>; })}
        {t1.ramMo && (() => { const [x, y] = trongTam(t1.ramMo); return <text x={x} y={-y} text-anchor="middle" font-size={coChu * 0.8} font-weight="700">{t('ham.t1.ramXuong')}</text>; })()}
      </g>
    );
  }, [kq, lo, coChu, lang]);
}

/** Chú giải tầng 1. */
export function ChuGiaiT1() {
  const ds: [string, string, string][] = [
    ['var(--ham-t1-thap)', 'var(--ink)', 'ham.t1.thap'],
    ['var(--ham-t1-de)', 'var(--muted)', 'ham.t1.de'],
    ['var(--ham-t1-xanh)', 'var(--ok)', 'ham.t1.canhQuan'],
    ['var(--ham-ram)', '#a15c1d', 'ham.t1.ramXuong'],
    ['var(--ham-gio)', '#3b6ea8', 'ham.t1.louver'],
    ['var(--ham-thang)', 'var(--vuot)', 'ham.t1.thangRa'],
  ];
  return (
    <div class="chu-giai-dat" aria-label={t('ham.chuGiai')}>
      {ds.map(([nen, vien, k]) => <span key={k}><i style={{ background: nen, borderColor: vien }} />{t(k)}</span>)}
    </div>
  );
}
