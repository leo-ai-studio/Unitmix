import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { viTriMatTroi } from '../ba_chieu/nang';
import { t, useLang } from '../i18n/i18n';
import { nhomMoi, taoVatLieu, THAM_SO_MAC, type NhomHien, type T3, type ThamSo3D, type VatLieu3D } from './dungCan';

/** Kết quả dựng: tâm cảnh (m, toạ độ three), cỡ cảnh (m) và chiều cao (m) để đặt camera, mặt trời và thanh cắt. */
export type CanhDung = { tam: [number, number, number]; coCanh: number; cao: number };
export type NguCanh = { T: T3; goc: import('three').Group; M: VatLieu3D; G: NhomHien; P: ThamSo3D };

type Props = {
  /** Khoá thay đổi thì dựng lại cảnh. */
  khoa: string;
  dung: (c: NguCanh) => CanhDung | null;
  /** Hướng Bắc so với trục +Y của bản vẽ (độ, ngược chiều kim đồng hồ từ +Y tới Bắc); dùng đặt mặt trời. */
  gocBac?: number;
  /** Cho đổi tham số đứng (cao cửa, lan can…) — chỉ có ý nghĩa khi cảnh là căn / tầng. */
  chinhThamSo?: boolean;
  /** Cả tòa: tầng điển hình đã gộp hình nên bỏ các nút bật / tắt chi tiết căn. */
  toaNguyen?: boolean;
  tieuDe?: string;
};

const LUU = 'unitmix.tham-so-3d';
const doc = (): ThamSo3D => {
  try { return { ...THAM_SO_MAC, ...(JSON.parse(localStorage.getItem(LUU) ?? '{}') as Partial<ThamSo3D>) }; } catch { return { ...THAM_SO_MAC }; }
};
const NHAN_TS: [keyof ThamSo3D, string][] = [['cuaDi', 'm3d.cuaDi'], ['cuaTruot', 'm3d.cuaTruot'], ['bauSo', 'm3d.bauSo'], ['caoSo', 'm3d.caoSo'], ['lanCan', 'm3d.lanCan'], ['dam', 'm3d.damCao'], ['san', 'm3d.san'], ['tang', 'm3d.caoTang']];

/** Khung WebGL: xoay / di / phóng bằng chuột hoặc cảm ứng, mặt trời theo giờ, cắt ngang, bật tắt dầm / lover / cửa mở. Three.js nạp lười. */
export function Khung3D({ khoa, dung, gocBac = 0, chinhThamSo, toaNguyen, tieuDe }: Props) {
  useLang();
  const hop = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const he = useRef<{ ve: () => void; datGoc: (k: 'persp' | 'top' | 'out') => void } | null>(null);
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(true);
  const [ts, setTs] = useState<ThamSo3D>(doc);
  const [hien, setHien] = useState({ dam: true, lov: true, top: false, vien: true, mo: true });
  const [gio, setGio] = useState(14);
  const [cat, setCat] = useState(1);
  const tr = useRef({ ts, hien, gio, cat, gocBac });
  tr.current = { ts, hien, gio, cat, gocBac };
  const dungRef = useRef(dung);
  dungRef.current = dung;
  const kt = useMemo(() => JSON.stringify(ts), [ts]);

  useEffect(() => {
    let huy = false;
    let don: (() => void) | undefined;
    (async () => {
      try {
        const T = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        if (huy || !cv.current || !hop.current) return;
        let R: import('three').WebGLRenderer;
        try { R = new T.WebGLRenderer({ canvas: cv.current, antialias: true }); } catch { setLoi(t('m3d.khongWebGL')); setDang(false); return; }
        R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.localClippingEnabled = true;
        const scene = new T.Scene();
        scene.background = new T.Color(0x0e1c2d);
        scene.add(new T.HemisphereLight(0xffffff, 0x8a8f98, 0.75));
        const sun = new T.DirectionalLight(0xffffff, 0.8);
        sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
        scene.add(sun); scene.add(sun.target);
        const mp = new T.Plane(new T.Vector3(0, -1, 0), 3.3);
        const M = taoVatLieu(T, [mp]);
        const cam = new T.PerspectiveCamera(40, 1, 0.1, 3000);
        const goc = new T.Group();
        scene.add(goc);
        const ctl = new OrbitControls(cam, R.domElement);
        ctl.enableDamping = false; ctl.maxPolarAngle = Math.PI / 2 - 0.02;
        let canh: CanhDung | null = null, G = nhomMoi(), cho = 0;
        const ve = () => { if (!cho) cho = requestAnimationFrame(() => { cho = 0; R.render(scene, cam); }); };
        ctl.addEventListener('change', ve);
        const kichCo = () => {
          const w = Math.max(hop.current!.clientWidth, 50), h = Math.max(hop.current!.clientHeight, 50);
          R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); ve();
        };
        const apHien = () => {
          const { hien: h, ts: p } = tr.current;
          G.dam.forEach((o) => { o.visible = h.dam; });
          G.lov.forEach((o) => { o.visible = h.lov; });
          G.top.forEach((o) => { o.visible = h.top; });
          G.vien.forEach((o) => { o.visible = h.vien && (!G.dam.includes(o) || h.dam); });
          G.mo.forEach((o) => { o.pg.rotation.y = h.mo ? o.ang : 0; });
          if (canh) mp.constant = tr.current.cat * (canh.cao + 0.01) + 0.001;
          void p; ve();
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
          sun.intensity = gocCao > 2 ? 0.8 : 0.25;
          ve();
        };
        const xoa = () => {
          while (goc.children.length) {
            const c = goc.children[0];
            goc.remove(c);
            c.traverse((o) => { const g = (o as import('three').Mesh).geometry; if (g && !(o as import('three').Mesh & { chung?: boolean }).chung) g.dispose?.(); });
          }
        };
        const datGoc = (k: 'persp' | 'top' | 'out') => {
          if (!canh) return;
          const [x, y, z] = canh.tam, c = canh.coCanh;
          if (k === 'top') cam.position.set(x, y + c * 1.9, z + 0.001);
          else if (k === 'out') cam.position.set(x, y + c * 0.25, z + c * 1.6);
          else cam.position.set(x + c * 1.0, y + c * 1.1, z + c * 1.6);
          ctl.target.set(x, y, z); ctl.update(); ve();
        };
        const dungLai = (giuGoc: boolean) => {
          xoa(); G = nhomMoi();
          canh = dungRef.current({ T, goc, M, G, P: tr.current.ts });
          if (canh) {
            const [x, y, z] = canh.tam;
            ctl.target.set(x, y, z); ctl.minDistance = 1; ctl.maxDistance = Math.max(50, canh.coCanh * 6);
            cam.near = 0.1; cam.far = Math.max(500, canh.coCanh * 20); cam.updateProjectionMatrix();
            if (!giuGoc) datGoc('persp');
            apHien(); datNang();
          }
          setDang(false); ve();
        };
        const ob = new ResizeObserver(kichCo);
        ob.observe(hop.current);
        kichCo();
        dungLai(false);
        he.current = { ve: () => { dungLai(true); }, datGoc };
        (hop.current as HTMLDivElement & { _cap?: () => void })._cap = () => { apHien(); datNang(); };
        don = () => { ob.disconnect(); cancelAnimationFrame(cho); ctl.dispose(); xoa(); R.dispose(); he.current = null; };
      } catch (e) {
        if (!huy) { setLoi(t('m3d.khongNap') + ' ' + String((e as Error).message ?? e)); setDang(false); }
      }
    })();
    return () => { huy = true; don?.(); };
  }, [khoa]);

  // Đổi tham số đứng: dựng lại giữ góc nhìn. Đổi hiển thị / giờ / cắt: cập nhật nhẹ.
  useEffect(() => { he.current?.ve(); try { localStorage.setItem(LUU, kt); } catch { /* không lưu được */ } }, [kt]);
  useEffect(() => { (hop.current as (HTMLDivElement & { _cap?: () => void }) | null)?._cap?.(); }, [hien, gio, cat, gocBac]);

  const dsHien: [keyof typeof hien, string][] = [['dam', 'm3d.dam'], ['lov', 'm3d.lover'], ['mo', 'm3d.moCua'], ['top', 'm3d.sanTren'], ['vien', 'm3d.vien']];
  return (
    <div class="khung-3d">
      <div class="thanh-3d">
        {tieuDe && <b class="tieu-de-3d">{tieuDe}</b>}
        <span class="nhom-3d">
          {([['persp', 'm3d.phoiCanh'], ['top', 'm3d.matBang'], ['out', 'm3d.tuNgoai']] as const).map(([k, n]) => <button type="button" key={k} onClick={() => he.current?.datGoc(k)}>{t(n)}</button>)}
        </span>
        {!toaNguyen && <span class="nhom-3d">
          {dsHien.map(([k, n]) => <label class="o-tg" key={k}><input type="checkbox" checked={hien[k]} onChange={(e) => setHien({ ...hien, [k]: e.currentTarget.checked })} /><span>{t(n)}</span></label>)}
        </span>}
        <label class="o-tg"><span>{t('m3d.cat')}</span><input type="range" min="0.05" max="1" step="0.01" value={cat} onInput={(e) => setCat(+e.currentTarget.value)} /></label>
        <label class="o-tg"><span>{t('m3d.gio')} {gio}h</span><input type="range" min="6" max="18" step="0.5" value={gio} onInput={(e) => setGio(+e.currentTarget.value)} /></label>
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
      <div class="vung-3d" ref={hop}>
        <canvas ref={cv} />
        {dang && !loi && <div class="giua-man"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" /><span>{t('m3d.dangDung')}</span></div>}
        {loi && <div class="giua-man"><span>{loi}</span></div>}
      </div>
      <p class="goi-y-3d">{t('m3d.goiY')}</p>
    </div>
  );
}
