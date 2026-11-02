/**
 * Hộp "Vị trí · Nắng · Gió" (kiểu Forma): đặt toạ độ dự án (dán link Google Maps / Earth, nhập số, khớp hai điểm, dời / xoay cho khớp ảnh),
 * lớp ảnh nền 2D / 3D; nắng: ngày + giờ (chạy hoạt ảnh bóng đổ), đường mặt trời, phân tích giờ nắng; gió: hoa gió Open-Meteo + mô phỏng
 * tiện nghi gió mức đi bộ. Lớp phủ trên khung giữa (máy bàn: thẻ bên phải dưới thanh công cụ; màn hẹp: tấm đáy), không bóp khung.
 * Mã nặng (worker nắng, LBM) chỉ nạp khi bấm chạy — tệp này được tải lười từ `nangGio/index.tsx`.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, useLang } from '../i18n/i18n';
import type { ThuVien, TrangThaiPA } from '../tinh/kieu';
import { mocLan, muiGioTheoKinhDo, NGAY_DONG_CHI, NGAY_HA_CHI } from '../tinh/matTroi';
import { huongChuDao, SO_HUONG } from '../tinh/nangGio/gio';
import { thongKeGio } from '../tinh/nangGio/gioNang';
import { buocChay, docGio, gioPhut, kepGio } from '../tinh/nangGio/dongHo';
import { KINH_TUYEN_TRUC, nhanDangDaoTruc, tinhTuTen } from '../tinh/nangGio/vn2000';
import { docLienKet, ganViTri, khopHaiDiem, viTriPA, datSangLl, type LatLng } from '../tinh/viTri';
import { fmtSo } from '../ui/so';
import { useNgheChange } from '../ui/ngheChange';
import { useManHep } from '../ui/manHep';
import { ThangMau } from '../ui/ThangMau';
import { chayGio, huyGio, taiHoaGio, xemHuong } from './chayGio';
import { chayNang, huyNang } from './chayNang';
import { HoaGio } from './HoaGio';
import { datNG, layNG, useNG, type NguonBanDo } from './kho';
import { GRADIENT_K, GRADIENT_NANG, MAU_GIO_CSS } from './mau';
import { docCauHinh } from './nguonBanDo';
import { TEN_LOP_GIO } from './hienThi';
import { timDiaDiem, type DiaDiem } from './timDiaDiem';
import { apDungTuBanVe, coToaDoThat } from './viTriTuDong';
import { taiKml } from '../xuat/xuatKml';

type Props = { pa: TrangThaiPA; tv: ThuVien | null; sua: (fn: (p: TrangThaiPA) => TrangThaiPA) => void; chiXem: boolean; /** đang ở 3D (ẩn chọn điểm trên bản vẽ) */ la3D?: boolean; /** tên / địa điểm dự án: đoán tỉnh để đặt vị trí từ toạ độ bản vẽ */ diaDiem?: string };


export default function HopNangGio({ pa, tv, sua, chiXem, la3D, diaDiem }: Props) {
  useLang();
  const s = useNG((x) => ({ moHop: x.moHop, tab: x.tab }));
  if (!s.moHop) return null;
  return (
    <section class="hop-nang-gio" role="dialog" aria-label={t('ng.tieuDe')}>
      <header class="hng-dau">
        <div class="hng-tab" role="tablist">
          {(['viTri', 'nang', 'gio'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={s.tab === k} onClick={() => datNG({ tab: k })}>{t(`ng.tab.${k}`)}</button>
          ))}
        </div>
        <button type="button" class="hng-dong" aria-label={t('ng.dong')} title={t('ng.dong')} onClick={() => datNG({ moHop: false, chonDiem: null })}>✕</button>
      </header>
      <div class="hng-than">
        {s.tab === 'viTri' && <TabViTri pa={pa} tv={tv} sua={sua} chiXem={chiXem} la3D={la3D} diaDiem={diaDiem} />}
        {s.tab === 'nang' && <TabNang pa={pa} tv={tv} la3D={la3D} />}
        {s.tab === 'gio' && <TabGio pa={pa} tv={tv} la3D={la3D} />}
      </div>
    </section>
  );
}

function TabViTri({ pa, tv, sua, chiXem, la3D, diaDiem }: { pa: TrangThaiPA; tv: ThuVien | null; sua: Props['sua']; chiXem: boolean; la3D?: boolean; diaDiem?: string }) {
  const vt = viTriPA(pa);
  const s = useNG((x) => ({ banDo2D: x.banDo2D, banDo3D: x.banDo3D, doMo: x.doMo, nguon: x.nguon, A: x.diemA, B: x.diemB, chon: x.chonDiem }));
  const [dan, setDan] = useState('');
  const [bao, setBao] = useState('');
  const [llA, setLlA] = useState(''), [llB, setLlB] = useState('');
  const [coGoogle, setCoGoogle] = useState(false);
  // đặt vị trí khỏi dán link: (1) từ toạ độ thật của bản vẽ quy hoạch, (2) tìm theo tên địa điểm
  const coThat = useMemo(() => coToaDoThat(pa), [pa.lo]);
  const daoTruc = useMemo(() => nhanDangDaoTruc(pa.lo.flatMap((l) => l.ranh)), [pa.lo]);
  const [tinhId, setTinhId] = useState(() => tinhTuTen(diaDiem ?? '')?.id ?? KINH_TUYEN_TRUC[0].id);
  const [ktt, setKtt] = useState('105');
  const [q, setQ] = useState(''), [kqTim, setKqTim] = useState<DiaDiem[] | null>(null), [dangTim, setDangTim] = useState(false);
  useEffect(() => { docCauHinh().then((c) => setCoGoogle(!!c.google)); }, []);
  const tam = useMemo(() => {
    const ds = pa.lo.flatMap((l) => l.ranh);
    if (!ds.length) return [0, 0] as [number, number];
    const xs = ds.map((p) => p[0]), ys = ds.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] as [number, number];
  }, [pa.lo]);
  const hep = useManHep();
  const datToaDo = (ll: LatLng, cach: 'lienKet' | 'tay' | 'timKiem') => {
    sua((p) => ganViTri(p, { lat: ll.lat, lng: ll.lng, neo: tam, cachDat: cach }));
    if (!layNG().banDo2D && !layNG().banDo3D) datNG({ banDo2D: true, banDo3D: true });
    if (hep) datNG({ moHop: false }); // màn hẹp: thu hộp để thấy ngay ảnh vệ tinh (mở lại để chỉnh góc Bắc)
  };
  const datTuBanVe = () => {
    const k = tinhId === 'khac' ? Number(ktt) : KINH_TUYEN_TRUC.find((x) => x.id === tinhId)?.ktt ?? NaN;
    const moi = Number.isFinite(k) && k > 90 && k < 120 ? apDungTuBanVe(pa, k) : null;
    if (!moi) { setBao(t('ng.vt.tuBanVeKhong')); return; }
    const v = viTriPA(moi);
    sua((p) => apDungTuBanVe(p, k) ?? p);
    if (!layNG().banDo2D && !layNG().banDo3D) datNG({ banDo2D: true, banDo3D: true });
    if (hep) datNG({ moHop: false });
    setBao(t('ng.vt.tuBanVeXong').replace('{lat}', v.lat.toFixed(6)).replace('{lng}', v.lng.toFixed(6)).replace('{goc}', fmtSo(v.gocBac, { thapPhan: 2 })));
  };
  const tim = async () => {
    setDangTim(true); setBao('');
    try {
      const r = await timDiaDiem(q);
      setKqTim(r);
      if (!r.length) setBao(t('ng.vt.timRong'));
    } catch { setKqTim(null); setBao(t('ng.vt.timLoi')); } finally { setDangTim(false); }
  };
  const chonDiaDiem = (d: DiaDiem) => {
    datToaDo({ lat: d.lat, lng: d.lng }, 'timKiem');
    setBao(t('ng.vt.timDat').replace('{ten}', d.ten.split(',').slice(0, 3).join(',')));
    setKqTim(null);
  };
  const apDan = () => {
    const r = docLienKet(dan);
    if ('loi' in r) { setBao(t(`ng.vt.loi.${r.loi}`)); return; }
    datToaDo(r, r.nguon === 'chuoi' || r.nguon === 'dms' ? 'tay' : 'lienKet');
    setBao(t('ng.vt.daDat').replace('{lat}', r.lat.toFixed(6)).replace('{lng}', r.lng.toFixed(6)));
    setDan('');
  };
  // dời bản vẽ trên ảnh: đổi kinh vĩ của điểm neo theo mét Đông / Bắc
  const doi = (de: number, dn: number) => {
    if (!vt.coToaDo) return;
    const ll = datSangLl([-de, -dn], vt);
    sua((p) => ganViTri(p, { ...p.viTri!, lat: ll.lat, lng: ll.lng }));
  };
  const xoay = (d: number) => sua((p) => ganViTri(p, p.viTri ?? null, viTriPA(p).gocBac + d));
  const khop = () => {
    const a = docLienKet(llA), b = docLienKet(llB);
    if (!s.A || !s.B || 'loi' in a || 'loi' in b) { setBao(t('ng.vt.khopThieu')); return; }
    const r = khopHaiDiem(s.A, a, s.B, b);
    if (!r) { setBao(t('ng.vt.khopTrung')); return; }
    sua((p) => ganViTri(p, r.viTri, r.gocBac));
    setBao(t('ng.vt.khopXong').replace('{goc}', fmtSo(r.gocBac, { thapPhan: 2 })).replace('{tl}', fmtSo(r.tyLe, { thapPhan: 4 })) + (r.lech > 0.02 ? ' ' + t('ng.vt.khopLech') : ''));
    datNG({ diemA: null, diemB: null });
  };
  const so = (v: number) => (Number.isFinite(v) ? v.toFixed(6) : '');
  const tat = chiXem;
  return (
    <div class="hng-muc">
      {tat && <p class="hng-trang canh" role="note">{t('soan.chiXem')}</p>}
      <p class={vt.coToaDo ? 'hng-trang ok' : 'hng-trang canh'}>
        {vt.coToaDo ? `${so(vt.lat)}, ${so(vt.lng)} · ${t('ng.vt.gocBac')} ${fmtSo(vt.gocBac, { thapPhan: 1 })}°` : t('ng.vt.chuaDat')}
      </p>
      {daoTruc && <p class="hng-trang canh" role="note">{t('ng.vt.daoTruc')}</p>}
      {coThat && (
        <div class="hng-tu-ban-ve">
          <h4>{t('ng.vt.tuBanVe')}</h4>
          <p class="hng-goi-y">{t('ng.vt.tuBanVeGiai')}</p>
          <label class="hng-o"><span>{t('ng.vt.tinh')}</span>
            <select value={tinhId} disabled={tat} onChange={(e) => setTinhId(e.currentTarget.value)}>
              {KINH_TUYEN_TRUC.map((x) => <option key={x.id} value={x.id}>{x.ten} · {x.ktt}°</option>)}
              <option value="khac">{t('ng.vt.tinhKhac')}</option>
            </select>
          </label>
          {tinhId === 'khac' && <label class="hng-o"><span>{t('ng.vt.ktt')}</span><input type="number" step="0.25" value={ktt} disabled={tat} onInput={(e) => setKtt(e.currentTarget.value)} /></label>}
          <button type="button" class="nut-chinh" disabled={tat} onClick={datTuBanVe}>{t('ng.vt.datTuBanVe')}</button>
        </div>
      )}
      <label class="hng-o">
        <span>{t('ng.vt.tim')}</span>
        <span class="hng-hang">
          <input type="text" value={q} disabled={tat} placeholder="KĐT Tây Hồ Tây, Hà Nội" onInput={(e) => setQ(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && q.trim().length >= 3 && !dangTim && void tim()} />
          <button type="button" class="nut-chinh" disabled={tat || dangTim || q.trim().length < 3} onClick={() => void tim()}>{dangTim ? '…' : t('ng.vt.timNut')}</button>
        </span>
      </label>
      <p class="hng-goi-y">{t('ng.vt.timGoiY')}</p>
      {kqTim && kqTim.length > 0 && (
        <ul class="hng-kq-tim">
          {kqTim.map((d) => <li key={`${d.lat},${d.lng}`}><button type="button" class="nut-phu" disabled={tat} onClick={() => chonDiaDiem(d)}>{d.ten}</button></li>)}
        </ul>
      )}
      <details class="hng-khop">
        <summary>{t('ng.vt.danTuyChon')}</summary>
      <label class="hng-o">
        <span>{t('ng.vt.dan')}</span>
        <span class="hng-hang">
          <input type="text" inputMode="url" value={dan} disabled={tat} placeholder="https://www.google.com/maps/@21.0285,105.8542,17z" onInput={(e) => setDan(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && apDan()} />
          <button type="button" class="nut-chinh" disabled={tat || !dan.trim()} onClick={apDan}>{t('ng.vt.dat')}</button>
        </span>
      </label>
      <p class="hng-goi-y">{t('ng.vt.goiYDan')}</p>
      </details>
      {vt.coToaDo && (
        <>
      <div class="hng-luoi2">
        <label><span>{t('ng.vt.viDo')}</span><input type="number" step="0.000001" disabled={tat} value={vt.coToaDo ? so(vt.lat) : ''} onChange={(e) => { const v = +e.currentTarget.value; if (Math.abs(v) <= 90) datToaDo({ lat: v, lng: vt.coToaDo ? vt.lng : 105.85 }, 'tay'); }} /></label>
        <label><span>{t('ng.vt.kinhDo')}</span><input type="number" step="0.000001" disabled={tat} value={vt.coToaDo ? so(vt.lng) : ''} onChange={(e) => { const v = +e.currentTarget.value; if (Math.abs(v) <= 180) datToaDo({ lat: vt.lat, lng: v }, 'tay'); }} /></label>
      </div>
      <div class="hng-hang hng-chinh">
        <span>{t('ng.vt.gocBac')}</span>
        <input type="number" step="0.1" disabled={tat} value={fmtSo(vt.gocBac, { thapPhan: 2 }).replace(',', '.')} onChange={(e) => { const v = +e.currentTarget.value; if (Number.isFinite(v)) sua((p) => ganViTri(p, p.viTri ?? null, v)); }} />
        {[-1, -0.1, 0.1, 1].map((d) => <button key={d} type="button" class="nut-phu" disabled={tat} onClick={() => xoay(d)}>{d > 0 ? '+' : '−'}{Math.abs(d)}°</button>)}
      </div>
      {vt.coToaDo && (
        <div class="hng-hang hng-chinh">
          <span>{t('ng.vt.doi')}</span>
          <button type="button" class="nut-phu" disabled={tat} aria-label={t('ng.vt.doiTay')} onClick={() => doi(-1, 0)}>←</button>
          <button type="button" class="nut-phu" disabled={tat} aria-label={t('ng.vt.doiDong')} onClick={() => doi(1, 0)}>→</button>
          <button type="button" class="nut-phu" disabled={tat} aria-label={t('ng.vt.doiBac')} onClick={() => doi(0, 1)}>↑</button>
          <button type="button" class="nut-phu" disabled={tat} aria-label={t('ng.vt.doiNam')} onClick={() => doi(0, -1)}>↓</button>
          <span class="muted">1 m</span>
        </div>
      )}
      {!la3D && (
        <details class="hng-khop">
          <summary>{t('ng.vt.khop')}</summary>
          <p class="hng-goi-y">{t('ng.vt.khopGoiY')}</p>
          {(['A', 'B'] as const).map((k) => {
            const p = k === 'A' ? s.A : s.B, ll = k === 'A' ? llA : llB, setLl = k === 'A' ? setLlA : setLlB;
            return (
              <div key={k} class="hng-hang">
                <b>{k}</b>
                <button type="button" class="nut-phu" disabled={tat} aria-pressed={s.chon === k.toLowerCase()} onClick={() => datNG({ chonDiem: s.chon === k.toLowerCase() ? null : (k.toLowerCase() as 'a' | 'b') })}>
                  {p ? `${fmtSo(p[0], { thapPhan: 1 })}; ${fmtSo(p[1], { thapPhan: 1 })}` : t('ng.vt.chonTrenVe')}
                </button>
                <input type="text" disabled={tat} placeholder="21.0285, 105.8542" value={ll} onInput={(e) => setLl(e.currentTarget.value)} />
              </div>
            );
          })}
          <button type="button" class="nut-chinh" disabled={tat} onClick={khop}>{t('ng.vt.khopNut')}</button>
        </details>
      )}
        </>
      )}
      {bao && <p class="hng-bao" role="status">{bao}</p>}
      {vt.coToaDo && (
        <>
      <h4>{t('ng.nen.tieuDe')}</h4>
      <label class="hng-o"><span>{t('ng.nen.nguon')}</span>
        <select value={s.nguon} onChange={(e) => datNG({ nguon: e.currentTarget.value as NguonBanDo })}>
          <option value="esri">{t('ng.nen.esri')}</option>
          <option value="osm">{t('ng.nen.osm')}</option>
          <option value="google" disabled={!coGoogle}>{t('ng.nen.google')}{coGoogle ? '' : ' — ' + t('ng.nen.chuaKhoa')}</option>
        </select>
      </label>
      <label class="hng-o"><span>{t('ng.nen.doMo')} {Math.round(s.doMo * 100)} %</span>
        <input type="range" min="0.1" max="1" step="0.05" value={s.doMo} onInput={(e) => datNG({ doMo: +e.currentTarget.value })} />
      </label>
        </>
      )}
      {vt.coToaDo && (
        <p class="hng-hang">
          <a class="nut-phu" href={`https://www.google.com/maps/@${vt.lat.toFixed(6)},${vt.lng.toFixed(6)},18z/data=!3m1!1e3`} target="_blank" rel="noopener noreferrer">{t('ng.vt.moGoogle')}</a>
          <a class="nut-phu" href={`https://earth.google.com/web/@${vt.lat.toFixed(6)},${vt.lng.toFixed(6)},10a,500d,35y,${Math.round(vt.gocBac)}h,60t,0r`} target="_blank" rel="noopener noreferrer">{t('ng.vt.moEarth')}</a>
          <button type="button" class="nut-phu" title={t('ng.vt.xuatKmlGoiY')} onClick={() => taiKml(pa, tv, diaDiem || 'Unitmix')}>{t('ng.vt.xuatKml')}</button>
          {!tat && <button type="button" class="nut-phu" onClick={() => sua((p) => ganViTri(p, null))}>{t('ng.vt.xoa')}</button>}
        </p>
      )}
    </div>
  );
}

function TabNang({ pa, tv, la3D }: { pa: TrangThaiPA; tv: ThuVien | null; la3D?: boolean }) {
  const vt = viTriPA(pa);
  const s = useNG((x) => ({ ngay: x.ngay, luc: x.luc, duongMT: x.duongMT, n: x.nang, lop: x.lop, hien2D: x.hien2D, hien3D: x.hien3D, matDung: x.matDung, bong2D: x.bong2D }));
  const [chay, setChay] = useState(false);
  const ml = useMemo(() => mocLan(vt.lat, vt.lng, s.ngay), [vt.lat, vt.lng, s.ngay]);
  const mg = muiGioTheoKinhDo(vt.lng);
  const g0 = ml ? Math.ceil(ml.moc * 4) / 4 : 6, g1 = ml ? Math.floor(ml.lan * 4) / 4 : 18;
  // hoạt ảnh giờ: tốc độ đều 1 giờ / giây (bước khung kẹp 0,1 s — tab ẩn không nhảy cóc), vòng lại từ mọc khi tới lặn; giờ liên tục, không làm tròn
  const raf = useRef(0);
  useEffect(() => {
    if (!chay) return;
    let truoc = performance.now();
    const vong = (bay: number) => {
      const dt = (bay - truoc) / 1000; truoc = bay;
      datNG({ luc: buocChay(layNG().luc, dt, g0, g1) });
      raf.current = requestAnimationFrame(vong);
    };
    raf.current = requestAnimationFrame(vong);
    return () => cancelAnimationFrame(raf.current);
  }, [chay, g0, g1]);
  // kéo / phím mũi tên / đặt bằng mã (input + change): một đường ghi vào kho; giá trị trùng thì bỏ (không vẽ lại thừa)
  const nhapGio = (e: Event) => {
    const g = docGio((e.currentTarget as HTMLInputElement).value);
    if (g === null) return;
    setChay(false);
    if (g !== layNG().luc) datNG({ luc: kepGio(g, g0, g1) });
  };
  const refGio = useNgheChange(nhapGio); // `change` thuần (preact/compat gộp onChange vào onInput)
  const kq = s.n.kq;
  const tk = useMemo(() => (kq ? thongKeGio(kq.gio, kq.tongGio, 2, (i) => kq.cao[i] === 0) : null), [kq]);
  const tkMat = useMemo(() => {
    if (!kq || !kq.mat.length) return null;
    const g: number[] = [];
    for (let j = 0; j < kq.mat.length / 9; j++) g.push(kq.mat[j * 9 + 7]);
    return thongKeGio(g, kq.tongGio, 2);
  }, [kq]);
  const ngayNhanh = [[NGAY_DONG_CHI(), 'ng.nang.dongChi'], [NGAY_HA_CHI(), 'ng.nang.haChi'], [`${new Date().getFullYear()}-03-21`, 'ng.nang.xuanPhan'], [new Date().toLocaleDateString('sv-SE'), 'ng.nang.homNay']] as const;
  return (
    <div class="hng-muc">
      {!vt.coToaDo && <p class="hng-trang canh">{t('ng.vt.chuaDatTam')}</p>}
      <label class="hng-o"><span>{t('ng.nang.ngay')}</span>
        <input type="date" value={s.ngay} onChange={(e) => e.currentTarget.value && datNG({ ngay: e.currentTarget.value })} />
      </label>
      <div class="hng-hang hng-boc">
        {ngayNhanh.map(([d, k]) => <button key={k} type="button" class="nut-phu" aria-pressed={s.ngay === d} onClick={() => datNG({ ngay: d })}>{t(k)}</button>)}
      </div>
      <div class="hng-o">
        <span>{t('ng.nang.gio')} <b>{gioPhut(s.luc)}</b> (UTC+{mg}){ml ? ` · ${t('ng.nang.moc')} ${gioPhut(ml.moc)} · ${t('ng.nang.lan')} ${gioPhut(ml.lan)}` : ''}</span>
        <span class="hng-hang">
          <button type="button" class="nut-phu hng-chay" aria-label={chay ? t('ng.nang.dung') : t('ng.nang.chay')} title={chay ? t('ng.nang.dung') : t('ng.nang.chay')} onClick={() => setChay(!chay)}>{chay ? '❚❚' : '▶'}</button>
          <input type="range" min={g0} max={g1} step="0.05" value={s.luc} aria-valuetext={gioPhut(s.luc)} ref={refGio} onInput={nhapGio} />
        </span>
      </div>
      <div class="hng-hang hng-boc">
        {la3D && <label class="o-tg"><input type="checkbox" checked={s.duongMT} onChange={(e) => datNG({ duongMT: e.currentTarget.checked })} /> <span>{t('ng.nang.duongMT')}</span></label>}
        {!la3D && <label class="o-tg"><input type="checkbox" checked={s.bong2D} onChange={(e) => datNG({ bong2D: e.currentTarget.checked })} /> <span>{t('ng.nang.bong2D')}</span></label>}
      </div>
      <h4>{t('ng.nang.gioNang')}</h4>
      <p class="hng-goi-y">{t('ng.nang.gioNangGiai')}</p>
      <div class="hng-hang">
        {!s.n.dang
          ? <button type="button" class="nut-chinh" disabled={!tv || !pa.toa.length} onClick={() => tv && chayNang(pa, tv, s.ngay)}>{t('ng.nang.tinh')} {s.ngay.slice(8, 10)}/{s.ngay.slice(5, 7)}</button>
          : <button type="button" class="nut-phu" onClick={huyNang}>{t('ng.huy')}</button>}
        {s.n.dang && <span class="hng-tien-do" role="status"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" />{kq ? `${kq.daXong}/${kq.tong}` : ''}</span>}
        {kq && !s.n.dang && <button type="button" class="nut-phu" aria-pressed={s.lop === 'nang'} onClick={() => datNG({ lop: s.lop === 'nang' ? null : 'nang' })}>{t(s.lop === 'nang' ? 'ng.an' : 'ng.hien')}</button>}
      </div>
      {s.n.loi && <p class="hng-bao canh">{t(`ng.loi.${s.n.loi}`) === `ng.loi.${s.n.loi}` ? s.n.loi : t(`ng.loi.${s.n.loi}`)}</p>}
      {kq && tk && (
        <ThangMau tieuDe={`${t('ng.nang.thang')} · ${kq.luoi.buoc} m`} gradient={GRADIENT_NANG} cot={tk.cot}
          moc={[{ t: 0, nhan: '0 h' }, { t: 0.5, nhan: `${fmtSo(kq.tongGio / 2, { thapPhan: 1 })}` }, { t: 1, nhan: `${fmtSo(kq.tongGio, { thapPhan: 1 })} h` }]}
          chiSo={[
            { nhan: t('ng.nang.tbDat'), gt: `${fmtSo(tk.tb, { thapPhan: 1 })} h` },
            { nhan: t('ng.nang.dat2h'), gt: `${fmtSo(tk.datNguong * 100, { thapPhan: 0 })} %` },
            ...(tkMat ? [{ nhan: t('ng.nang.tbMat'), gt: `${fmtSo(tkMat.tb, { thapPhan: 1 })} h` }, { nhan: t('ng.nang.mat2h'), gt: `${fmtSo(tkMat.datNguong * 100, { thapPhan: 0 })} %` }] : []),
          ]}
          ghiChu={t('ng.nang.ghiChu')} />
      )}
      {kq && (
        <div class="hng-hang hng-boc">
          <label class="o-tg"><input type="checkbox" checked={s.hien2D} onChange={(e) => datNG({ hien2D: e.currentTarget.checked })} /> <span>2D</span></label>
          <label class="o-tg"><input type="checkbox" checked={s.hien3D} onChange={(e) => datNG({ hien3D: e.currentTarget.checked })} /> <span>3D</span></label>
          <label class="o-tg"><input type="checkbox" checked={s.matDung} onChange={(e) => datNG({ matDung: e.currentTarget.checked })} /> <span>{t('ng.nang.matDung')}</span></label>
        </div>
      )}
    </div>
  );
}

function TabGio({ pa, tv }: { pa: TrangThaiPA; tv: ThuVien | null; la3D?: boolean }) {
  const vt = viTriPA(pa);
  const s = useNG((x) => ({ g: x.gio, gioXem: x.gioXem, dongGio: x.dongGio, lop: x.lop }));
  const p = s.g.phanBo;
  useEffect(() => { if (!p && !s.g.dangTai && !s.g.loiTai && vt.coToaDo) void taiHoaGio(pa); }, [vt.coToaDo]);
  const kq = s.g.kq;
  const tyLe = useMemo(() => {
    if (!kq || !kq.kHuong.length) return null;
    const d = [0, 0, 0, 0, 0]; let n = 0;
    for (let i = 0; i < kq.lop.length; i++) if (kq.lop[i] < 5) { d[kq.lop[i]]++; n++; }
    return d.map((x) => (n ? x / n : 0));
  }, [kq]);
  const chuDao = p ? huongChuDao(p).slice(0, 3) : [];
  const nhanH16 = (i: number) => `${t(`ng.h16.${i}`)}`;
  return (
    <div class="hng-muc">
      {!vt.coToaDo && <p class="hng-trang canh">{t('ng.vt.chuaDatTam')}</p>}
      {p ? (
        <>
          <HoaGio p={p} huongXem={kq && s.gioXem === 'k' ? kq.huongXem : undefined} />
          <p class="hng-goi-y">{p.nguon} · {t('ng.gio.tb')} {fmtSo(p.vTb, { thapPhan: 1 })} m/s · {t('ng.gio.lang')} {fmtSo(p.lang * 100, { thapPhan: 0 })} % · {t('ng.gio.chuDao')} {chuDao.map((c) => nhanH16(c.i)).join(', ')}</p>
        </>
      ) : (
        <div class="hng-hang">
          <button type="button" class="nut-phu" disabled={s.g.dangTai} onClick={() => void taiHoaGio(pa)}>{t('ng.gio.tai')}</button>
          {s.g.dangTai && <img class="spin-o" src="/brand/leo_ai_o.png" alt="" style={{ width: '16px' }} />}
        </div>
      )}
      {s.g.loiTai && <p class="hng-bao canh">{t('ng.gio.loiTai')} ({s.g.loiTai})</p>}
      <h4>{t('ng.gio.tienNghi')}</h4>
      <p class="hng-goi-y canh">{t('ng.gio.canhBao')}</p>
      <div class="hng-hang">
        {!s.g.dang
          ? <button type="button" class="nut-chinh" disabled={!tv || !pa.toa.length || s.g.dangTai} onClick={() => tv && void chayGio(pa, tv)}>{t('ng.gio.chay')}</button>
          : <button type="button" class="nut-phu" onClick={huyGio}>{t('ng.huy')}</button>}
        {s.g.dang && <span class="hng-tien-do" role="status"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" />{t('ng.gio.huong')} {kq ? kq.daXong : 0}/8</span>}
        {kq && !s.g.dang && <button type="button" class="nut-phu" aria-pressed={s.lop === 'gio'} onClick={() => datNG({ lop: s.lop === 'gio' ? null : 'gio' })}>{t(s.lop === 'gio' ? 'ng.an' : 'ng.hien')}</button>}
      </div>
      {s.g.loi && <p class="hng-bao canh">{t(`ng.loi.${s.g.loi}`) === `ng.loi.${s.g.loi}` ? s.g.loi : t(`ng.loi.${s.g.loi}`)}</p>}
      {kq && (
        <>
          <div class="hng-hang hng-boc">
            <button type="button" class="nut-phu" aria-pressed={s.gioXem === 'lop'} disabled={!kq.kHuong.length} onClick={() => datNG({ gioXem: 'lop' })}>{t('ng.gio.xemLop')}</button>
            <button type="button" class="nut-phu" aria-pressed={s.gioXem === 'k'} onClick={() => datNG({ gioXem: 'k' })}>{t('ng.gio.xemK')}</button>
            {s.gioXem === 'k' && kq.kHuong.length === SO_HUONG && (
              <select aria-label={t('ng.gio.huong')} value={kq.huongXem} onChange={(e) => xemHuong(+e.currentTarget.value)}>
                {Array.from({ length: SO_HUONG }, (_, i) => <option key={i} value={i}>{nhanH16(i)}</option>)}
              </select>
            )}
            <label class="o-tg"><input type="checkbox" checked={s.dongGio} onChange={(e) => datNG({ dongGio: e.currentTarget.checked })} /> <span>{t('ng.gio.dong')}</span></label>
          </div>
          {s.gioXem === 'lop' && tyLe
            ? <ThangMau tieuDe={t('ng.gio.thangLop')} lop={tyLe.map((v, i) => ({ mau: MAU_GIO_CSS[i], nhan: TEN_LOP_GIO(i), tyLe: v }))} ghiChu={t('ng.gio.ghiLawson')} />
            : <ThangMau tieuDe={`${t('ng.gio.thangK')} · ${nhanH16(kq.huongXem)}`} gradient={GRADIENT_K} moc={[{ t: 0, nhan: '0' }, { t: 0.625, nhan: '1,0' }, { t: 1, nhan: '≥ 1,6' }]} ghiChu={t('ng.gio.ghiK')} />}
        </>
      )}
    </div>
  );
}
