import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { viTriMatTroi } from '../ba_chieu/nang';
import { t, useLang } from '../i18n/i18n';
import { chayRaf, easeInOut, giamChuyenDong, tron } from '../ui/chuyenDong';
import type { GocNhin } from '../tinh/kieu';
import { nhomMoi, taoVatLieu, THAM_SO_MAC, type KieuVe3D, type NhomHien, type T3, type ThamSo3D, type VatLieu3D } from './dungCan';

type V3 = [number, number, number];
/** Góc nhìn đề xuất của cảnh (m, toạ độ three). */
export type GocDeXuat = { ten: string; vt: V3; dich: V3; gio?: number };
/** Kết quả dựng: tâm cảnh, cỡ cảnh và chiều cao (m) để đặt camera, mặt trời, thanh cắt; góc đề xuất; có mặt đất hay không. */
export type CanhDung = { tam: V3; coCanh: number; cao: number; goc?: GocDeXuat[]; nen?: boolean; /** Mặt đất bán trong suốt (để thấy công trình ngầm như hầm). */ nenTrongSuot?: boolean };
export type NguCanh = { T: T3; goc: import('three').Group; M: VatLieu3D; G: NhomHien; P: ThamSo3D; kieu: KieuVe3D };

type Props = {
  /** Khoá thay đổi thì dựng lại cảnh. */
  khoa: string;
  /** Khoá đổi thì dựng lại cảnh nhưng giữ góc nhìn (vd. bật / tắt hầm). */
  khoaNhe?: string;
  dung: (c: NguCanh) => CanhDung | null;
  /** Góc (độ, chiều kim đồng hồ) từ trục +Y bản vẽ tới hướng Bắc; dùng đặt mặt trời. */
  gocBac?: number;
  /** Cho đổi tham số đứng (cao cửa, lan can…) — chỉ có ý nghĩa khi cảnh là căn / tầng. */
  chinhThamSo?: boolean;
  /** Cảnh đã gộp hình (cả tòa, cả dự án) nên bỏ các nút bật / tắt chi tiết căn. */
  toaNguyen?: boolean;
  tieuDe?: string;
  /** Nút thêm đặt đầu thanh công cụ (vd. chọn Toàn dự án / Công trình). */
  dauThanh?: ComponentChildren;
  /** Góc đã lưu của cảnh này; có `onLuuGoc` thì hiện nút Lưu góc. */
  gocLuu?: GocNhin[];
  onLuuGoc?: (g: Omit<GocNhin, 'id' | 'che' | 'toaId'>) => void;
  onXoaGoc?: (id: string) => void;
  /** Tên tệp ảnh xuất (không đuôi). */
  tenAnh?: string;
};

const LUU = 'unitmix.tham-so-3d', LUU_KIEU = 'unitmix.kieu-3d';
const doc = (): ThamSo3D => {
  try { return { ...THAM_SO_MAC, ...(JSON.parse(localStorage.getItem(LUU) ?? '{}') as Partial<ThamSo3D>) }; } catch { return { ...THAM_SO_MAC }; }
};
const docKieu = (): KieuVe3D => { try { return localStorage.getItem(LUU_KIEU) === 'trang' ? 'trang' : 'brand'; } catch { return 'brand'; } };
const NHAN_TS: [keyof ThamSo3D, string][] = [['cuaDi', 'm3d.cuaDi'], ['cuaTruot', 'm3d.cuaTruot'], ['bauSo', 'm3d.bauSo'], ['caoSo', 'm3d.caoSo'], ['lanCan', 'm3d.lanCan'], ['dam', 'm3d.damCao'], ['san', 'm3d.san'], ['tang', 'm3d.caoTang']];
const NEN: Record<KieuVe3D, { troi: number; dat: number; hemi: [number, number] }> = {
  brand: { troi: 0xf1f0ea, dat: 0xe4e6dd, hemi: [0xfffef6, 0x9aa79d] },
  trang: { troi: 0xffffff, dat: 0xf4f4f2, hemi: [0xffffff, 0xb9bdba] },
};

/** Góc đề xuất mặc định từ tâm / cỡ cảnh: chim bay hai hướng, mắt người, từ trên. */
export function gocMacDinh(c: Pick<CanhDung, 'tam' | 'coCanh' | 'cao'>): GocDeXuat[] {
  const [x, y, z] = c.tam, k = c.coCanh;
  return [
    { ten: t('m3d.g.chimBayDN'), vt: [x + k * 1.0, y + k * 1.1, z + k * 1.6], dich: [x, y, z] },
    { ten: t('m3d.g.chimBayTB'), vt: [x - k * 1.4, y + k * 0.9, z - k * 1.2], dich: [x, y, z] },
    { ten: t('m3d.g.matNguoi'), vt: [x + k * 0.9, 1.6, z + k * 1.3], dich: [x, Math.min(c.cao * 0.45, 40), z], gio: 16.5 },
    { ten: t('m3d.g.tuTren'), vt: [x, y + k * 2.2, z + 0.01], dich: [x, 0, z] },
  ];
}

/** Khung WebGL: xoay / di / phóng, mặt trời theo giờ, cắt ngang, kiểu Brand / mô hình trắng, góc đề xuất, lưu góc, xuất ảnh. Three.js nạp lười. */
export function Khung3D({ khoa, khoaNhe, dung, gocBac = 0, chinhThamSo, toaNguyen, tieuDe, dauThanh, gocLuu, onLuuGoc, onXoaGoc, tenAnh = 'Unitmix-3D' }: Props) {
  useLang();
  const hop = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const he = useRef<{ ve: () => void; datGoc: (g: GocDeXuat, bay?: boolean) => void; layGoc: () => { vt: V3; dich: V3 }; anh: (heSo: number) => string } | null>(null);
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(true);
  const [ts, setTs] = useState<ThamSo3D>(doc);
  const [kieu, setKieu] = useState<KieuVe3D>(docKieu);
  const [hien, setHien] = useState({ dam: true, lov: true, top: false, vien: true, mo: true });
  const [gio, setGio] = useState(14);
  const [cat, setCat] = useState(1);
  const [deXuat, setDeXuat] = useState<GocDeXuat[]>([]);
  const [baoChep, setBaoChep] = useState('');
  const tr = useRef({ ts, hien, gio, cat, gocBac, kieu });
  tr.current = { ts, hien, gio, cat, gocBac, kieu };
  const dungRef = useRef(dung);
  dungRef.current = dung;
  const kt = useMemo(() => JSON.stringify(ts), [ts]);

  useEffect(() => {
    let huy = false;
    let don: (() => void) | undefined;
    hop.current?.classList.remove('da-dung');
    (async () => {
      try {
        const T = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        if (huy || !cv.current || !hop.current) return;
        let R: import('three').WebGLRenderer;
        try { R = new T.WebGLRenderer({ canvas: cv.current, antialias: true, preserveDrawingBuffer: true }); } catch { setLoi(t('m3d.khongWebGL')); setDang(false); return; }
        const kieuVe = tr.current.kieu, N = NEN[kieuVe];
        R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.localClippingEnabled = true;
        const scene = new T.Scene();
        scene.background = new T.Color(N.troi);
        scene.add(new T.HemisphereLight(N.hemi[0], N.hemi[1], kieuVe === 'trang' ? 2.4 : 2.1));
        const sun = new T.DirectionalLight(0xfff6e8, 2.6);
        sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
        scene.add(sun); scene.add(sun.target);
        const mp = new T.Plane(new T.Vector3(0, -1, 0), 3.3);
        const M = taoVatLieu(T, [mp], kieuVe);
        const matDat = new T.MeshStandardMaterial({ color: N.dat, roughness: 1 });
        const matDatTrong = new T.MeshStandardMaterial({ color: N.dat, roughness: 1, transparent: true, opacity: 0.4, depthWrite: false });
        const cam = new T.PerspectiveCamera(40, 1, 0.1, 5000);
        const goc = new T.Group();
        scene.add(goc);
        const ctl = new OrbitControls(cam, R.domElement);
        ctl.enableDamping = !giamChuyenDong(); ctl.dampingFactor = 0.08; ctl.maxPolarAngle = Math.PI / 2 - 0.01;
        let canh: CanhDung | null = null, G = nhomMoi(), cho = 0;
        const ve = () => { if (!cho) cho = requestAnimationFrame(() => { cho = 0; R.render(scene, cam); }); };
        // Có đà (damping): update() phải gọi mỗi frame tới khi hết đà; xong thì về render theo yêu cầu.
        let vong = 0;
        const chayDa = () => {
          vong = ctl.update() ? requestAnimationFrame(chayDa) : 0; // vong còn khác 0 trong update() nên sự kiện change không xếp thêm vòng
        };
        let huyBay = () => {};
        ctl.addEventListener('change', () => { ve(); if (ctl.enableDamping && !vong) vong = requestAnimationFrame(chayDa); });
        ctl.addEventListener('start', () => huyBay()); // người dùng nắm lại camera thì dừng bay
        const kichCo = () => {
          const w = Math.max(hop.current!.clientWidth, 50), h = Math.max(hop.current!.clientHeight, 50);
          R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); ve();
        };
        const apHien = () => {
          const h = tr.current.hien;
          G.dam.forEach((o) => { o.visible = h.dam; });
          G.lov.forEach((o) => { o.visible = h.lov; });
          G.top.forEach((o) => { o.visible = h.top; });
          G.vien.forEach((o) => { o.visible = h.vien && (!G.dam.includes(o) || h.dam); });
          G.mo.forEach((o) => { o.pg.rotation.y = h.mo ? o.ang : 0; });
          if (canh) mp.constant = tr.current.cat * (canh.cao + 0.01) + 0.001;
          ve();
        };
        const datNang = () => {
          if (!canh) return;
          const h = new Date(); // giờ Việt Nam (UTC+7) của ngày hôm nay
          const { gocCao, phuongVi } = viTriMatTroi(21.03, 105.85, new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate(), 0, 0, 0) + (tr.current.gio - 7) * 3600e3));
          const el = Math.max(8, gocCao) * (Math.PI / 180), az = (phuongVi - tr.current.gocBac) * (Math.PI / 180); // Bắc = +Y bản vẽ = −Z three
          const c = canh.coCanh, [tx, ty, tz] = canh.tam;
          sun.position.set(tx + c * 1.6 * Math.sin(az) * Math.cos(el), ty + c * 1.6 * Math.sin(el), tz - c * 1.6 * Math.cos(az) * Math.cos(el));
          sun.target.position.set(tx, 0, tz);
          const s = sun.shadow.camera; s.left = -c; s.right = c; s.top = c; s.bottom = -c; s.near = 0.5; s.far = c * 6; s.updateProjectionMatrix();
          sun.intensity = gocCao > 2 ? 2.6 : 0.8;
          ve();
        };
        const xoa = () => {
          while (goc.children.length) {
            const c = goc.children[0];
            goc.remove(c);
            c.traverse((o) => { (o as import('three').Mesh).geometry?.dispose?.(); });
          }
        };
        const datGoc = (g: GocDeXuat, bay = false) => {
          huyBay();
          if (!bay) { cam.position.set(...g.vt); ctl.target.set(...g.dich); ctl.update(); ve(); return; }
          const p0 = cam.position.clone(), t0 = ctl.target.clone(), p1 = new T.Vector3(...g.vt), t1 = new T.Vector3(...g.dich);
          huyBay = chayRaf(500, easeInOut, (p) => {
            cam.position.set(tron(p0.x, p1.x, p), tron(p0.y, p1.y, p), tron(p0.z, p1.z, p));
            ctl.target.set(tron(t0.x, t1.x, p), tron(t0.y, t1.y, p), tron(t0.z, t1.z, p));
            ctl.update(); ve();
          });
        };
        const layGoc = () => ({ vt: cam.position.toArray().map((v) => +v.toFixed(2)) as V3, dich: ctl.target.toArray().map((v) => +v.toFixed(2)) as V3 });
        /** Ảnh PNG của khung hiện tại, phóng `heSo` lần (giữ nguyên tỷ lệ khung). */
        const anh = (heSo: number) => {
          const w = R.domElement.width, h = R.domElement.height, pr = R.getPixelRatio();
          R.setPixelRatio(pr * heSo); R.setSize(w / pr, h / pr, false); R.render(scene, cam);
          const url = R.domElement.toDataURL('image/png');
          R.setPixelRatio(pr); R.setSize(w / pr, h / pr, false); R.render(scene, cam);
          return url;
        };
        const dungLai = (giuGoc: boolean) => {
          xoa(); G = nhomMoi();
          canh = dungRef.current({ T, goc, M, G, P: tr.current.ts, kieu: kieuVe });
          if (canh) {
            const [x, y, z] = canh.tam;
            if (canh.nen) {
              const dat = new T.Mesh(new T.PlaneGeometry(canh.coCanh * 8, canh.coCanh * 8), canh.nenTrongSuot ? matDatTrong : matDat);
              dat.rotation.x = -Math.PI / 2; dat.position.set(x, -0.05, z); dat.receiveShadow = true;
              goc.add(dat);
            }
            ctl.minDistance = 1; ctl.maxDistance = Math.max(80, canh.coCanh * 8);
            cam.near = 0.1; cam.far = Math.max(800, canh.coCanh * 30); cam.updateProjectionMatrix();
            const ds = canh.goc?.length ? canh.goc : gocMacDinh(canh);
            setDeXuat(ds);
            if (!giuGoc) { ctl.target.set(x, y, z); datGoc(ds[0]); }
            apHien(); datNang();
          }
          setDang(false); ve();
          requestAnimationFrame(() => hop.current?.classList.add('da-dung')); // hiện dần canvas sau lượt dựng
        };
        const ob = new ResizeObserver(kichCo);
        ob.observe(hop.current);
        kichCo();
        dungLai(false);
        he.current = { ve: () => { dungLai(true); }, datGoc, layGoc, anh };
        (hop.current as HTMLDivElement & { _cap?: () => void })._cap = () => { apHien(); datNang(); };
        don = () => { huyBay(); cancelAnimationFrame(vong); ob.disconnect(); cancelAnimationFrame(cho); ctl.dispose(); xoa(); R.dispose(); he.current = null; };
      } catch (e) {
        if (!huy) { setLoi(t('m3d.khongNap') + ' ' + String((e as Error).message ?? e)); setDang(false); }
      }
    })();
    return () => { huy = true; don?.(); };
  }, [khoa, kieu]);

  // Đổi tham số đứng: dựng lại giữ góc nhìn. Đổi hiển thị / giờ / cắt: cập nhật nhẹ.
  useEffect(() => { he.current?.ve(); }, [khoaNhe]);
  useEffect(() => { he.current?.ve(); try { localStorage.setItem(LUU, kt); } catch { /* không lưu được */ } }, [kt]);
  useEffect(() => { (hop.current as (HTMLDivElement & { _cap?: () => void }) | null)?._cap?.(); }, [hien, gio, cat, gocBac]);
  useEffect(() => { try { localStorage.setItem(LUU_KIEU, kieu); } catch { /* không lưu được */ } }, [kieu]);

  const apGoc = (g: GocDeXuat) => { if (g.gio !== undefined) setGio(g.gio); he.current?.datGoc(g, true); };
  const taiAnh = () => {
    const url = he.current?.anh(2);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = `${tenAnh}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const chepPrompt = async () => {
    const p = t('m3d.promptAI').replace('{ten}', tieuDe ?? 'Unitmix').replace('{gio}', String(gio));
    try { await navigator.clipboard.writeText(p); setBaoChep(t('m3d.daChep')); } catch { setBaoChep(p); }
    setTimeout(() => setBaoChep(''), 4000);
  };
  const luuGoc = () => {
    const g = he.current?.layGoc();
    if (!g || !onLuuGoc) return;
    const ten = prompt(t('m3d.tenGoc'), `${t('m3d.goc')} ${(gocLuu?.length ?? 0) + 1}`);
    if (ten?.trim()) onLuuGoc({ ten: ten.trim(), vt: g.vt, dich: g.dich, gio });
  };

  const dsHien: [keyof typeof hien, string][] = [['dam', 'm3d.dam'], ['lov', 'm3d.lover'], ['mo', 'm3d.moCua'], ['top', 'm3d.sanTren'], ['vien', 'm3d.vien']];
  return (
    <div class="khung-3d">
      <div class="noi-tren">
      <div class="thanh-3d">
        {dauThanh}
        {tieuDe && <b class="tieu-de-3d">{tieuDe}</b>}
        <span class="nhom-3d" role="group" aria-label={t('m3d.gocDeXuat')}>
          {deXuat.map((g) => <button type="button" key={g.ten} onClick={() => apGoc(g)}>{g.ten}</button>)}
        </span>
        <span class="gian" />
        <span class="nhom-3d" role="group" aria-label={t('m3d.kieu')}>
          {(['brand', 'trang'] as const).map((k) => <button type="button" key={k} aria-pressed={kieu === k} onClick={() => setKieu(k)}>{t(`m3d.kieu.${k}`)}</button>)}
        </span>
        <label class="o-tg"><span>{t('m3d.gio')} {gio}h</span><input type="range" min="6" max="18" step="0.5" value={gio} onInput={(e) => setGio(+e.currentTarget.value)} /></label>
        <label class="o-tg"><span>{t('m3d.cat')}</span><input type="range" min="0.05" max="1" step="0.01" value={cat} onInput={(e) => setCat(+e.currentTarget.value)} /></label>
      </div>
      <div class="thanh-3d thanh-3d-phu">
        <span class="muted">{t('m3d.gocLuu')}</span>
        {(gocLuu ?? []).map((g) => (
          <span class="chip-goc" key={g.id}>
            <button type="button" onClick={() => apGoc(g)}>{g.ten}</button>
            {onXoaGoc && <button type="button" class="xoa" aria-label={t('m3d.xoaGoc')} onClick={() => onXoaGoc(g.id)}>×</button>}
          </span>
        ))}
        {!gocLuu?.length && <span class="muted">—</span>}
        {onLuuGoc && <button type="button" class="nut-phu" onClick={luuGoc}>＋ {t('m3d.luuGoc')}</button>}
        <span class="gian" />
        {!toaNguyen && dsHien.map(([k, n]) => <label class="o-tg" key={k}><input type="checkbox" checked={hien[k]} onChange={(e) => setHien({ ...hien, [k]: e.currentTarget.checked })} /><span>{t(n)}</span></label>)}
        <button type="button" class="nut-phu" onClick={chepPrompt} title={t('m3d.aiGiaiThich')}>{t('m3d.promptNut')}</button>
        <button type="button" class="nut-chinh" onClick={taiAnh}>⤓ {t('m3d.xuatAnh')}</button>
        {baoChep && <span class="ok" role="status">{baoChep}</span>}
      </div>
      {chinhThamSo && (
        <details class="tham-so-3d">
          <summary>{t('m3d.thamSo')}</summary>
          <div class="luoi-tham-so">
            {NHAN_TS.map(([k, n]) => (
              <label key={k}><span>{t(n)}</span><input type="number" min="50" max="9000" step="10" value={ts[k] as number} onChange={(e) => { const v = +e.currentTarget.value; if (v >= 50 && v <= 9000) setTs({ ...ts, [k]: v }); }} /></label>
            ))}
            <label><span>{t('m3d.kieuLanCan')}</span>
              <select value={ts.kieuLC} onChange={(e) => setTs({ ...ts, kieuLC: e.currentTarget.value as ThamSo3D['kieuLC'] })}>
                <option value="thep">{t('m3d.thep')}</option><option value="kinh">{t('m3d.kinh')}</option>
              </select>
            </label>
            <button type="button" class="nut-phu" onClick={() => setTs({ ...THAM_SO_MAC })}>{t('m3d.macDinh')}</button>
          </div>
        </details>
      )}
      </div>
      <div class="vung-3d" ref={hop}>
        <canvas ref={cv} />
        {dang && !loi && <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('m3d.dangDung')}</span></div>}
        {loi && <div class="giua-man"><span>{loi}</span></div>}
      </div>
      <div class="noi-duoi"><p class="goi-y-3d">{t('m3d.goiY')}</p></div>
    </div>
  );
}
