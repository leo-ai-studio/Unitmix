import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { viTriMatTroi } from '../ba_chieu/nang';
import { t, useLang } from '../i18n/i18n';
import { chayRaf, easeInOut, giamChuyenDong, tron } from '../ui/chuyenDong';
import type { GocNhin } from '../tinh/kieu';
import { GocBanVe } from '../ui/GocBanVe';
import { coDaGiac } from '../tinh/matBang';
import { dangChon, doiTuongTrung, khoaDoiTuong, laBam, laBamDup, trungRo, type DangChon3D, type DiemBam, type DoiTuong3D } from './chon3d';
import { DS_KIEU_3D, nhomMoi, taoVatLieu, THAM_SO_MAC, type KieuVe3D, type NhomHien, type T3, type ThamSo3D, type VatLieu3D } from './dungCan';

type V3 = [number, number, number];
/** Góc nhìn đề xuất của cảnh (m, toạ độ three). */
export type GocDeXuat = { ten: string; vt: V3; dich: V3; gio?: number };
/** Kết quả dựng: tâm cảnh, cỡ cảnh và chiều cao (m) để đặt camera, mặt trời, thanh cắt; góc đề xuất; có mặt đất hay không. */
export type CanhDung = {
  tam: V3; coCanh: number; cao: number; goc?: GocDeXuat[]; nen?: boolean; /** Mặt đất bán trong suốt (để thấy công trình ngầm như hầm). */ nenTrongSuot?: boolean;
  /** Chọn bằng tia (cảnh đã gộp hình, không gắn `userData.chon` từng phần — 3D Công trình): gốc, hướng tia, cao độ mặt cắt ngang (m). */
  chonTia?: (goc: V3, huong: V3, catY: number) => DoiTuong3D | null;
  /** Hình tô nhấn (lớp phủ bán trong suốt + viền) của đối tượng chọn bằng tia: chân (m, toạ độ bản vẽ) + cao độ đáy / đỉnh. */
  hinhNhan?: (d: DoiTuong3D) => { chan: [number, number][]; y0: number; y1: number; /** Khối thể tích (căn / tầng / đế nằm trong khối gộp): tô mặt nhìn thấy bên trong khối, theo chiều sâu. */ theTich?: boolean } | null;
  /** Đối tượng chọn bằng tia ứng với state chọn hiện tại (để tô nhấn khi chọn từ 2D / dải cấp). */
  doiTuongChon?: (c: DangChon3D) => DoiTuong3D | null;
};
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
  /** Đang chọn (tòa / lô): đối tượng dựng có `userData.chon` trùng thì tô viền `--green`, không dựng lại cảnh. */
  chon?: DangChon3D;
  /** Có thì bấm (chuột / chạm) chọn được đối tượng có `userData.chon`; bấm nền → null. Kéo quá ngưỡng px là xoay camera. */
  onChon?: (d: DoiTuong3D | null) => void;
  /** Bấm đúp (hoặc chạm hai lần) vào đối tượng chọn được. */
  onMo?: (d: DoiTuong3D) => void;
  /** Lớp phủ chữ trong khung 3D (vd. thông tin căn / tầng đang chọn), không chiếm chỗ khung. */
  chuThich?: ComponentChildren;
};

// kiểu 3D: khoá mới (v2) để mặc định Vật liệu áp cho cả máy đã lưu 'brand' từ trước (trước đây khung luôn ghi kiểu đang xem)
const LUU = 'unitmix.tham-so-3d', LUU_KIEU = 'unitmix.kieu-3d.v2';
const doc = (): ThamSo3D => {
  try { return { ...THAM_SO_MAC, ...(JSON.parse(localStorage.getItem(LUU) ?? '{}') as Partial<ThamSo3D>) }; } catch { return { ...THAM_SO_MAC }; }
};
const docKieu = (): KieuVe3D => { try { const k = localStorage.getItem(LUU_KIEU) as KieuVe3D | null; return k && DS_KIEU_3D.includes(k) ? k : 'vatlieu'; } catch { return 'vatlieu'; } };
const NHAN_TS: [keyof ThamSo3D, string][] = [['cuaDi', 'm3d.cuaDi'], ['cuaTruot', 'm3d.cuaTruot'], ['bauSo', 'm3d.bauSo'], ['caoSo', 'm3d.caoSo'], ['lanCan', 'm3d.lanCan'], ['dam', 'm3d.damCao'], ['san', 'm3d.san'], ['tang', 'm3d.caoTang']];
/** Nền khung (trời), mặt đất, đèn bán cầu. Vật liệu: nền ngà #F1F0EA của brand, đất be xám đậm hơn để tách khỏi nền. */
const NEN: Record<KieuVe3D, { troi: number; dat: number; hemi: [number, number] }> = {
  vatlieu: { troi: 0xf1f0ea, dat: 0xc9c3b2, hemi: [0xfffefa, 0xb8b0a3] },
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
export function Khung3D({ khoa, khoaNhe, dung, gocBac = 0, chinhThamSo, toaNguyen, tieuDe, dauThanh, gocLuu, onLuuGoc, onXoaGoc, tenAnh = 'Unitmix-3D', chon, onChon, onMo, chuThich }: Props) {
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
  const chonRef = useRef({ chon, onChon, onMo });
  chonRef.current = { chon, onChon, onMo };
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
        // stencil: tô nhấn khối căn / tầng / đế chỉ trên mặt nhìn thấy (veNhan); three r163+ mặc định không có bộ đệm stencil
        // không giữ bộ đệm vẽ (preserveDrawingBuffer): xuất ảnh vẽ lại rồi đọc ngay trong cùng lượt (anh); giữ thì iOS tốn thêm một bộ đệm cỡ màn hình + chép mỗi khung
        try { R = new T.WebGLRenderer({ canvas: cv.current, antialias: true, stencil: true }); } catch { setLoi(t('m3d.khongWebGL')); setDang(false); return; }
        const kieuVe = tr.current.kieu, N = NEN[kieuVe];
        // máy cảm ứng (điện thoại / máy tính bảng, màn @3x): mật độ điểm ảnh ≤ 1,5 và bản đồ bóng 2048 — đỡ 2–4 lần điểm ảnh tô, GPU / pin
        const camUng = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
        R.setPixelRatio(Math.min(window.devicePixelRatio || 1, camUng ? 1.5 : 2));
        R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.localClippingEnabled = true;
        const scene = new T.Scene();
        scene.background = new T.Color(N.troi);
        const vatLieu = kieuVe === 'vatlieu';
        scene.add(new T.HemisphereLight(N.hemi[0], N.hemi[1], kieuVe === 'trang' ? 2.4 : vatLieu ? 1.25 : 2.1));
        const sun = new T.DirectionalLight(0xfff6e8, vatLieu ? 2.1 : 2.6);
        sun.castShadow = true; sun.shadow.mapSize.setScalar(camUng ? 2048 : 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
        if (vatLieu) {
          sun.shadow.intensity = 0.55; // bóng đổ nhẹ
          // môi trường phòng sáng dịu cho kính / nhôm phản chiếu; vật liệu mờ chỉ nhận một phần
          try {
            const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
            const pm = new T.PMREMGenerator(R);
            scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
            scene.environmentIntensity = 0.35;
            pm.dispose();
          } catch { /* không có môi trường: kính vẫn vẽ, chỉ không phản chiếu */ }
          if (huy) { R.dispose(); return; }
        }
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
        // Cảm ứng: một ngón xoay, hai ngón chụm phóng + dời (canvas touch-action: none nên trang không phóng theo).
        ctl.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };
        ctl.enablePan = true; ctl.screenSpacePanning = true;
        let canh: CanhDung | null = null, G = nhomMoi(), cho = 0;
        // --- chọn trong 3D: mesh / nét có userData.chon; tô nhấn bằng cách đổi vật liệu (nhớ vật liệu gốc), không dựng lại ---
        type VL = import('three').Material;
        let dsChon: import('three').Object3D[] = [], ro: DoiTuong3D | null = null;
        const vlNhan = new Map<VL, VL>(), vlRo = new Map<VL, VL>();
        const XANH = 0x174f52; // --green
        const nhan = (m: VL, dam: boolean) => {
          const bang = dam ? vlNhan : vlRo;
          let c = bang.get(m);
          if (!c) {
            c = m.clone();
            const s = c as import('three').MeshStandardMaterial & import('three').LineBasicMaterial;
            if ((c as import('three').LineBasicMaterial).isLineBasicMaterial) { s.color.set(XANH); s.opacity = dam ? 1 : 0.85; s.transparent = !dam; }
            // pha màu về --green (emissive tối quá trong không gian tuyến tính, gần như không thấy)
            else if (s.color) s.color.lerp(new T.Color(XANH), dam ? 0.42 : 0.18);
            bang.set(m, c);
          }
          return c;
        };
        // lớp phủ tô nhấn cho cảnh chọn bằng tia (căn / tầng trong khối đã gộp): khối bán trong suốt + viền --green, cắt theo mặt cắt ngang
        const lopNhan = new T.Group();
        scene.add(lopNhan);
        const vlPhu = (dam: boolean) => new T.MeshBasicMaterial({ color: XANH, transparent: true, opacity: dam ? 0.36 : 0.18, depthWrite: false, side: T.DoubleSide, clippingPlanes: [mp], polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
        const vlPhuNet = (dam: boolean) => new T.LineBasicMaterial({ color: XANH, transparent: !dam, opacity: dam ? 1 : 0.7, clippingPlanes: [mp] });
        /**
         * Khối thể tích (căn / tầng / đế nằm trong khối đã gộp hình): tô đúng các mặt NHÌN THẤY nằm trong khối, theo chiều sâu — không
         * xuyên vật che (trước đây vẽ tắt depthTest nên căn bị tòa / cánh khác che vẫn hiện, kiểu tia X). Đếm stencil như bóng khối
         * (shadow volume): lượt 1 mặt sau của khối nằm SAU mặt cảnh → +1; lượt 2 mặt trước nằm sau mặt cảnh → −1; còn ≠ 0 = mặt cảnh ở
         * trong khối (khối lõm chữ L / V vẫn đúng vì đếm chẵn lẻ). Lượt 3 tô màu chỗ stencil ≠ 0 rồi xoá về 0. Mặt cắt ngang cắt cả khối
         * nên nhìn từ trên xuống thấy sàn / tường trong căn đã cắt. Ba lượt vẽ (+ viền) mỗi đối tượng tô, chỉ khi có chọn / rê.
         */
        const vlKhoi = (dam: boolean) => {
          const chung = { transparent: true, depthWrite: false, clippingPlanes: [mp], stencilWrite: true };
          const dem = (side: import('three').Side, op: import('three').StencilOp) => new T.MeshBasicMaterial({
            ...chung, colorWrite: false, side, depthFunc: T.GreaterEqualDepth, stencilFunc: T.AlwaysStencilFunc, stencilZPass: op, stencilZFail: T.KeepStencilOp, stencilFail: T.KeepStencilOp,
          });
          const to = new T.MeshBasicMaterial({
            ...chung, color: XANH, opacity: dam ? 0.55 : 0.28, side: T.BackSide, depthTest: false,
            stencilFunc: T.NotEqualStencilFunc, stencilRef: 0, stencilZPass: T.ZeroStencilOp, stencilFail: T.KeepStencilOp, stencilZFail: T.ZeroStencilOp,
          });
          return [dem(T.BackSide, T.IncrementWrapStencilOp), dem(T.FrontSide, T.DecrementWrapStencilOp), to] as const;
        };
        const VL_PHU = { chon: { phu: vlPhu(true), net: vlPhuNet(true), khoi: vlKhoi(true) }, ro: { phu: vlPhu(false), net: vlPhuNet(false), khoi: vlKhoi(false) } } as const;
        // khối nở ra ngoài 0,25 m (tường ngoài nhô khỏi khung căn tới ~0,2 m) và hạ 3 cm (gồm mặt sàn của tầng, bỏ mặt sàn tầng trên)
        const NO_KHOI = 0.25, HA_KHOI = 0.03;
        const veNhan = (d: DoiTuong3D | null, kieuNhan: 'chon' | 'ro') => {
          const h = d && canh?.hinhNhan?.(d);
          if (!h || h.chan.length < 3 || h.y1 <= h.y0) return;
          const chan = h.theTich ? coDaGiac(h.chan, -NO_KHOI) : h.chan, y0 = h.theTich ? h.y0 - HA_KHOI : h.y0, y1 = h.theTich ? h.y1 - HA_KHOI : h.y1;
          const sh = new T.Shape();
          chan.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
          const g = new T.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false });
          g.rotateX(-Math.PI / 2);
          const vl = VL_PHU[kieuNhan], goc0 = kieuNhan === 'chon' ? 10 : 20; // vẽ sau cảnh (kể cả kính trong suốt); chọn trước rê
          const l = new T.LineSegments(new T.EdgesGeometry(g, 25), vl.net);
          l.position.y = y0; l.renderOrder = goc0 + 3;
          if (h.theTich) vl.khoi.forEach((m, i) => { const me = new T.Mesh(g, m); me.position.y = y0; me.renderOrder = goc0 + i; lopNhan.add(me); });
          else { const me = new T.Mesh(g, vl.phu); me.position.y = y0; me.renderOrder = goc0; lopNhan.add(me); }
          lopNhan.add(l);
        };
        const apNhan = () => {
          const c = chonRef.current.chon ?? { toaId: null, loId: null };
          for (const o of dsChon) {
            const d = o.userData.chon as DoiTuong3D, me = o as import('three').Mesh;
            const goc0 = (o.userData.vlGoc ??= me.material) as VL;
            const laChon = dangChon(d, c), laRo = !laChon && trungRo(d, ro);
            me.material = laChon ? nhan(goc0, true) : laRo ? nhan(goc0, false) : goc0;
          }
          lopNhan.children.forEach((o) => (o as import('three').Mesh).geometry.dispose());
          lopNhan.clear();
          if (canh?.hinhNhan) {
            const dc = canh.doiTuongChon?.(c) ?? null;
            veNhan(dc, 'chon');
            if (ro && khoaDoiTuong(ro) !== khoaDoiTuong(dc)) veNhan(ro, 'ro');
          }
        };
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
          sun.intensity = (gocCao > 2 ? 2.6 : 0.8) * (tr.current.kieu === 'vatlieu' ? 0.8 : 1);
          ve();
        };
        const rc = new T.Raycaster(), v2 = new T.Vector2();
        const trung = (x: number, y: number): DoiTuong3D | null => {
          const r = R.domElement.getBoundingClientRect();
          v2.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
          rc.setFromCamera(v2, cam);
          if (canh?.chonTia) { // cảnh gộp hình: dò tia theo bản đồ chọn (thuần), phần trên mặt cắt ngang đã ẩn
            const o = rc.ray.origin, h = rc.ray.direction;
            return canh.chonTia([o.x, o.y, o.z], [h.x, h.y, h.z], mp.constant);
          }
          return doiTuongTrung(rc.intersectObjects(dsChon.filter((o) => (o as import('three').Mesh).isMesh), false));
        };
        // bấm / chạm: chỉ thêm nghe sự kiện, không đổi điều khiển camera (OrbitControls vẫn nhận đủ, không chặn lan truyền)
        let xuong: DiemBam | null = null, bamTruoc: (DiemBam & { d: DoiTuong3D | null }) | null = null, choRo = 0, roXY = [0, 0];
        const cv0 = R.domElement;
        // ngón đang đặt: thêm ngón thứ hai (chụm / dời camera) thì cả lượt không còn là chạm — nhấc ngón đầu không chọn nhầm
        const dangCham = new Set<number>();
        const onDown = (e: PointerEvent) => {
          dangCham.add(e.pointerId);
          if (dangCham.size > 1) { xuong = null; bamTruoc = null; return; }
          xuong = e.isPrimary && e.button <= 0 ? { x: e.clientX, y: e.clientY, t: performance.now(), kieu: e.pointerType } : null;
        };
        const onUp = (e: PointerEvent) => {
          dangCham.delete(e.pointerId);
          const x0 = xuong; xuong = null;
          const cb = chonRef.current;
          if (!x0 || !e.isPrimary || !cb.onChon) return;
          const len: DiemBam = { x: e.clientX, y: e.clientY, t: performance.now(), kieu: e.pointerType };
          if (!laBam(x0, len)) return; // kéo xoay camera
          const d = trung(e.clientX, e.clientY);
          const dup = laBamDup(bamTruoc, len) && !!d && khoaDoiTuong(bamTruoc?.d) === khoaDoiTuong(d);
          bamTruoc = dup ? null : { ...len, d };
          if (dup && cb.onMo) cb.onMo(d!); else cb.onChon(d);
        };
        const onMove = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse' || e.buttons || !chonRef.current.onChon) return;
          roXY = [e.clientX, e.clientY];
          if (choRo) return;
          choRo = requestAnimationFrame(() => {
            choRo = 0;
            const d = trung(roXY[0], roXY[1]);
            if (khoaDoiTuong(d) !== khoaDoiTuong(ro)) { ro = d; cv0.style.cursor = d ? 'pointer' : ''; apNhan(); ve(); }
          });
        };
        const onLeave = () => { if (ro) { ro = null; cv0.style.cursor = ''; apNhan(); ve(); } };
        const onCancel = (e: PointerEvent) => { dangCham.delete(e.pointerId); xuong = null; };
        cv0.addEventListener('pointerdown', onDown);
        cv0.addEventListener('pointerup', onUp);
        cv0.addEventListener('pointermove', onMove);
        cv0.addEventListener('pointerleave', onLeave);
        cv0.addEventListener('pointercancel', onCancel);
        type HH = import('three').BufferGeometry;
        const hinhCua = (o: import('three').Object3D, ds: Set<HH>) => o.traverse((x) => { const g = (x as import('three').Mesh).geometry; if (g) ds.add(g); });
        /** Gỡ cảnh cũ. `giu` = hình học cảnh mới còn dùng (bộ nhớ hình dungToa): không huỷ để khỏi nạp lại lên GPU. */
        const xoa = (giu?: Set<HH>) => {
          const cu = new Set<HH>();
          while (goc.children.length) {
            const c = goc.children[0];
            goc.remove(c);
            hinhCua(c, cu);
            c.traverse((o) => { if ((o as import('three').InstancedMesh).isInstancedMesh) (o as import('three').InstancedMesh).dispose(); });
          }
          cu.forEach((g) => { if (!giu?.has(g)) g.dispose(); });
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
        let msDung = 0;
        const dungLai = (giuGoc: boolean) => {
          // dựng cảnh mới vào nhóm tạm trước, rồi mới gỡ cảnh cũ: hình học dùng lại (nhớ ở dungToa) không bị huỷ / nạp lại GPU
          const moi = new T.Group();
          G = nhomMoi();
          const t0 = performance.now();
          canh = dungRef.current({ T, goc: moi, M, G, P: tr.current.ts, kieu: kieuVe });
          msDung = performance.now() - t0;
          const giu = new Set<HH>();
          hinhCua(moi, giu);
          xoa(giu);
          while (moi.children.length) goc.add(moi.children[0]);
          ro = null;
          dsChon = [];
          goc.traverse((o) => { if (o.userData.chon) dsChon.push(o); });
          apNhan();
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
        const hopEl = hop.current as HTMLDivElement & { _cap?: () => void; _nhan?: () => void; _chieuDoiTuong?: () => { loai: string; id: string; x: number; y: number }[] };
        hopEl._cap = () => { apHien(); datNang(); };
        hopEl._nhan = () => { apNhan(); ve(); };        // để chụp tự động: phóng camera về / ra khỏi điểm nhìn `k` lần (k < 1 = lại gần)
        (hopEl as typeof hopEl & { _phong?: (k: number) => void })._phong = (k: number) => {
          cam.position.sub(ctl.target).multiplyScalar(k).add(ctl.target); ctl.update(); ve();
        };
        // để đo: một lượt vẽ đồng bộ → draw call / tam giác thật của renderer (gồm pass bóng) và thời gian
        (hopEl as typeof hopEl & { _doVe?: () => { calls: number; tris: number; ms: number; dung: number } })._doVe = () => {
          const t0 = performance.now(); R.render(scene, cam); R.getContext().finish();
          return { calls: R.info.render.calls, tris: R.info.render.triangles, ms: performance.now() - t0, dung: msDung };
        };
        // để kiểm tự động: đối tượng trúng khi bấm ở (x, y) px trong khung (cùng đường dò như bấm chuột thật)
        (hopEl as typeof hopEl & { _chamThu?: (x: number, y: number) => DoiTuong3D | null })._chamThu = (x: number, y: number) => {
          const r = R.domElement.getBoundingClientRect();
          return trung(r.left + x, r.top + y);
        };
        // để đo FPS: xoay camera quanh điểm nhìn `giay` giây bằng requestAnimationFrame, mỗi khung vẽ một lượt (như kéo xoay liên tục)
        (hopEl as typeof hopEl & { _doFps?: (giay: number) => Promise<{ fps: number; khung: number; msTB: number; ms95: number; calls: number; tris: number }> })._doFps = (giay: number) =>
          new Promise((xong) => {
            const ds: number[] = [], t0 = performance.now(), v = cam.position.clone().sub(ctl.target);
            let truoc = t0, buoc = 0;
            const vong1 = (bay: number) => {
              ds.push(bay - truoc); truoc = bay; buoc++;
              const a = buoc * 0.012, c = Math.cos(a), s2 = Math.sin(a);
              cam.position.set(ctl.target.x + v.x * c - v.z * s2, ctl.target.y + v.y, ctl.target.z + v.x * s2 + v.z * c);
              cam.lookAt(ctl.target);
              R.render(scene, cam);
              if (bay - t0 < giay * 1000) requestAnimationFrame(vong1);
              else {
                const k = ds.slice(1).sort((p, q) => p - q), tb = k.reduce((p, q) => p + q, 0) / Math.max(1, k.length);
                xong({ fps: +(1000 / tb).toFixed(1), khung: k.length, msTB: +tb.toFixed(2), ms95: +(k[Math.floor(k.length * 0.95)] ?? 0).toFixed(2), calls: R.info.render.calls, tris: R.info.render.triangles });
              }
            };
            requestAnimationFrame((b) => { truoc = b; requestAnimationFrame(vong1); });
          });
        // để kiểm / chụp tự động: tâm màn hình (px trong khung) của từng đối tượng chọn được
        hopEl._chieuDoiTuong = () => {
          const r = R.domElement.getBoundingClientRect(), da = new Set<string>(), kq: { loai: string; id: string; x: number; y: number }[] = [];
          for (const o of dsChon) {
            const d = o.userData.chon as DoiTuong3D, k = d.loai + ':' + d.id;
            if (da.has(k) || !(o as import('three').Mesh).isMesh) continue;
            da.add(k);
            const c = new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(cam);
            kq.push({ loai: d.loai, id: d.id, x: ((c.x + 1) / 2) * r.width, y: ((1 - c.y) / 2) * r.height });
          }
          return kq;
        };
        don = () => {
          huyBay(); cancelAnimationFrame(vong); cancelAnimationFrame(choRo); ob.disconnect(); cancelAnimationFrame(cho);
          cv0.removeEventListener('pointerdown', onDown); cv0.removeEventListener('pointerup', onUp); cv0.removeEventListener('pointermove', onMove);
          cv0.removeEventListener('pointerleave', onLeave); cv0.removeEventListener('pointercancel', onCancel);
          ctl.dispose(); xoa(); lopNhan.children.forEach((o) => (o as import('three').Mesh).geometry.dispose()); Object.values(VL_PHU).flatMap((v) => [v.phu, v.net, ...v.khoi]).forEach((m) => m.dispose()); vlNhan.forEach((m) => m.dispose()); vlRo.forEach((m) => m.dispose()); scene.environment?.dispose(); R.dispose(); he.current = null;
        };
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
  useEffect(() => { (hop.current as (HTMLDivElement & { _nhan?: () => void }) | null)?._nhan?.(); }, [chon?.toaId, chon?.loId, chon?.tang, chon?.canKhoa]);

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
          {DS_KIEU_3D.map((k) => <button type="button" key={k} aria-pressed={kieu === k} onClick={() => setKieu(k)}>{t(`m3d.kieu.${k}`)}</button>)}
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
        {chuThich && !dang && !loi && <div class="the-chon-3d" role="status">{chuThich}</div>}
      </div>
      <GocBanVe troGiup={t('m3d.goiY')} />
    </div>
  );
}
