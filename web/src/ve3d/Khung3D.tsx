import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { viTriMatTroi } from '../ba_chieu/nang';
import { t, useLang } from '../i18n/i18n';
import { chayRaf, easeInOut, giamChuyenDong, tron } from '../ui/chuyenDong';
import type { GocNhin } from '../tinh/kieu';
import { GocBanVe } from '../ui/GocBanVe';
import { coDaGiac } from '../tinh/matBang';
import { dangChon, doiTuongTrung, khoaDoiTuong, laBam, laBamDup, trungRo, type DangChon3D, type DiemBam, type DoiTuong3D } from './chon3d';
import type { GanMoRong, MoRong3D } from './moRong3D';
import { capDo3D, coBoDem, huongMatTroi, THONG_SO_CAP, type CapDo3D } from './khungVe';
import { bauTroi } from './moiTruong';
import { catY, chepVa, dichBong, dichDan, locMoiTruong, moiTruongGia, nhuong, thieuDich } from './dichShader';
import { chayDan, laTung, type Tung } from './chiaNho';
import type { NutHienThi } from '../ui/ThanhHienThi';
import { DS_KIEU_3D, nhomMoi, taoVatLieu, THAM_SO_MAC, type KieuVe3D, type NhomHien, type T3, type ThamSo3D, type VatLieu3D } from './dungCan';
import type { HinhView3D, OView } from './lopView3d';

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
  /** Lớp hiển thị làm mặt đất bán trong suốt khi bật (vd. 'ham': nhìn xuyên xuống khối hầm). */
  nenLop?: string;
};
/**
 * Lớp phân tích (điểm view) phủ lên cảnh: lưới ô mặt ngoài tô màu đỉnh (ve3d/lopView3d.ts). Bật / tắt hiện dần 0,4 s và làm nhạt
 * cảnh (công trình, lô) về xám ngà; rê chuột / chạm một ô → bong bóng `doc(ô)`. Không dựng lại cảnh khi bật / tắt / lọc.
 */
export type PhanTich3D = {
  bat: boolean;
  /** Chữ ký dữ liệu: đổi thì dựng lại hình lớp. */
  khoa: string;
  /** Dựng hình lớp; null = đang tính (lớp chưa hiện). */
  dung: ((T: T3, P: ThamSo3D) => HinhView3D | null) | null;
  doc: (o: OView) => ComponentChildren;
  /** Chú giải (thang màu) lớp phủ góc dưới khung 3D. */
  chuGiai?: ComponentChildren;
  /** Lọc khoảng điểm: ô ngoài khoảng tô xám. */
  loc: [number, number] | null;
};
export type NguCanh = { T: T3; goc: import('three').Group; M: VatLieu3D; G: NhomHien; P: ThamSo3D; kieu: KieuVe3D; /** Bậc chất lượng thiết bị (số cây, cây đổ bóng…). */ capDo: CapDo3D };

type Props = {
  /** Khoá thay đổi thì dựng lại cảnh. */
  khoa: string;
  /** Khoá đổi thì dựng lại cảnh nhưng giữ góc nhìn (vd. bật / tắt hầm). */
  khoaNhe?: string;
  /** Dựng cảnh: trả thẳng kết quả, hoặc generator `yield` ở chỗ dừng được (chiaNho.ts) để khung chạy từng mẩu ~8 ms, không giật. */
  dung: (c: NguCanh) => CanhDung | null | Tung<CanhDung | null>;
  /**
   * Phần cảnh dựng riêng (vd. hầm theo kết quả rải nền, tầng tum khi hình lõi nạp xong): khoá một phần đổi thì chỉ dựng lại phần đó
   * vào nhóm riêng trong cảnh (vài ms), không dựng lại cả cảnh. Dựng lại cả cảnh thì các phần dựng theo.
   */
  phan?: { khoa: string; dung: (c: NguCanh) => void | Tung<void> }[];
  /** Góc (độ, chiều kim đồng hồ) từ trục +Y bản vẽ tới hướng Bắc; dùng đặt mặt trời. */
  gocBac?: number;
  /** Vĩ độ dự án (độ, TMB › Điểm view › Cài đặt); mặc định Hà Nội 21,03°. */
  viDo?: number;
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
  /** Gói mở rộng cảnh (ve3d/moRong3D.ts) — vd. ảnh nền, đường mặt trời, lớp phân tích nắng / gió. Đọc lúc tạo khung. */
  moRong?: MoRong3D;
  /**
   * Lớp hiển thị (menu "Lớp" ở góc như bản vẽ 2D). Đối tượng dựng gắn `userData.lop = khoá` thì ẩn / hiện theo `lopAn` tức thì, không dựng
   * lại; `userData.vlTheoLop = { lop, vl, vlThuong }` đổi vật liệu theo lớp (vd. lô bán trong suốt khi bật Hầm).
   */
  lop?: NutHienThi[];
  lopAn?: string[];
  /** Lớp phân tích view phủ lên cảnh. */
  phanTich?: PhanTich3D;
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
  vatlieu: { troi: 0xf1f0ea, dat: 0xd8cfba, hemi: [0xeef1ef, 0xc2b59b] }, // trời trắng ấm hơi lạnh / đất be phản xạ; đất ngà brand đậm hơn nền một bậc
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
export function Khung3D({ khoa, khoaNhe, dung, phan, gocBac = 0, viDo = 21.03, chinhThamSo, toaNguyen, tieuDe, dauThanh, gocLuu, onLuuGoc, onXoaGoc, tenAnh = 'Unitmix-3D', chon, onChon, onMo, chuThich, lop, lopAn, phanTich, moRong }: Props) {
  useLang();
  const hop = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const he = useRef<{ ve: () => void; phan: () => void; datGoc: (g: GocDeXuat, bay?: boolean) => void; layGoc: () => { vt: V3; dich: V3 }; anh: (heSo: number) => string } | null>(null);
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(true);
  const [ts, setTs] = useState<ThamSo3D>(doc);
  const [kieu, setKieu] = useState<KieuVe3D>(docKieu);
  const [hien, setHien] = useState({ dam: true, lov: true, top: false, vien: true, mo: true });
  const [gio, setGio] = useState(14);
  const [cat, setCat] = useState(1);
  const [deXuat, setDeXuat] = useState<GocDeXuat[]>([]);
  const [baoChep, setBaoChep] = useState('');
  const tr = useRef({ ts, hien, gio, cat, gocBac, kieu, lopAn, viDo });
  tr.current = { ts, hien, gio, cat, gocBac, kieu, lopAn, viDo };
  const dungRef = useRef(dung);
  dungRef.current = dung;
  const phanRef = useRef(phan);
  phanRef.current = phan;
  const khoaPhan = (phan ?? []).map((p) => p.khoa).join('§');
  const moRongRef = useRef(moRong);
  moRongRef.current = moRong;
  const ptRef = useRef(phanTich);
  ptRef.current = phanTich;
  /** Ô đang rê / chạm của lớp phân tích (toạ độ px trong khung) và hình lớp hiện tại. */
  const [tip, setTip] = useState<{ x: number; y: number; o: OView; ghim: boolean } | null>(null);
  const chonRef = useRef({ chon, onChon, onMo });
  chonRef.current = { chon, onChon, onMo };
  const kt = useMemo(() => JSON.stringify(ts), [ts]);

  useEffect(() => {
    let huy = false;
    let don: (() => void) | undefined;
    hop.current?.classList.remove('da-dung'); hop.current?.removeAttribute('data-chat-luong');
    (async () => {
      try {
        const T = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        if (huy || !cv.current || !hop.current) return;
        let R: import('three').WebGLRenderer;
        // stencil: tô nhấn khối căn / tầng / đế chỉ trên mặt nhìn thấy (veNhan); three r163+ mặc định không có bộ đệm stencil
        // không giữ bộ đệm vẽ (preserveDrawingBuffer): xuất ảnh vẽ lại rồi đọc ngay trong cùng lượt (anh); giữ thì iOS tốn thêm một bộ đệm cỡ màn hình + chép mỗi khung
        try { R = new T.WebGLRenderer({ canvas: cv.current, antialias: true, stencil: true }); } catch { setLoi(t('m3d.khongWebGL')); setDang(false); return; }
        await nhuong(); // tạo ngữ cảnh WebGL là một tác vụ riêng (điện thoại ~40 ms), phần dựng sau đó chia mẩu
        if (huy || !hop.current) { R.dispose(); return; }
        const kieuVe = tr.current.kieu, N = NEN[kieuVe];
        // bậc chất lượng: máy cảm ứng (điện thoại / máy tính bảng, màn @3x) hoặc máy yếu → mật độ điểm ảnh ≤ 1,5, bóng 2048 PCF thường,
        // ít cây, cây không đổ bóng — đỡ 2–4 lần điểm ảnh tô, GPU / pin (khungVe.THONG_SO_CAP)
        const camUng = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
        const capDo = capDo3D({ camUng, soLoi: navigator.hardwareConcurrency, boNho: (navigator as Navigator & { deviceMemory?: number }).deviceMemory });
        const TS = THONG_SO_CAP[capDo];
        R.setPixelRatio(Math.min(window.devicePixelRatio || 1, TS.dpr));
        R.shadowMap.enabled = true; R.shadowMap.type = TS.bongMem ? T.PCFSoftShadowMap : T.PCFShadowMap; R.localClippingEnabled = true;
        const scene = new T.Scene();
        scene.background = new T.Color(N.troi);
        const vatLieu = kieuVe === 'vatlieu';
        // Vật liệu: ánh xạ tông Khronos PBR Neutral (giữ đúng màu brand / be hơn ACES, vẫn nén vùng sáng của nắng + phản chiếu) + sRGB ra
        if (vatLieu) { R.toneMapping = T.NeutralToneMapping; R.toneMappingExposure = 1.05; }
        scene.add(new T.HemisphereLight(N.hemi[0], N.hemi[1], kieuVe === 'trang' ? 2.4 : vatLieu ? 1.15 : 2.1));
        const sun = new T.DirectionalLight(vatLieu ? 0xfff0da : 0xfff6e8, vatLieu ? 2.6 : 2.6);
        sun.castShadow = true; sun.shadow.mapSize.setScalar(TS.bong); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
        // Vật liệu: bóng đổ dịu (trời nhiều ánh sáng tán xạ). Môi trường (bầu trời thủ tục lọc PMREM) tạo SAU frame đầu, không chặn (batDau)
        if (vatLieu) sun.shadow.intensity = 0.62;
        scene.add(sun); scene.add(sun.target);
        const mp = new T.Plane(new T.Vector3(0, -1, 0), 3.3);
        // mặt cắt ngang = bản vá shader theo cao độ thế giới (dichShader.catY) — clippingPlanes làm renderer.compile dịch sai khoá
        const uCat = { value: mp.constant };
        const M = taoVatLieu(T, uCat, kieuVe);
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
        let canh: CanhDung | null = null, G = nhomMoi(), cho = 0, mr: GanMoRong | null = null;
        // --- chọn trong 3D: mesh / nét có userData.chon; tô nhấn bằng cách đổi vật liệu (nhớ vật liệu gốc), không dựng lại ---
        type VL = import('three').Material;
        let dsChon: import('three').Object3D[] = [], ro: DoiTuong3D | null = null;
        const vlNhan = new Map<VL, VL>(), vlRo = new Map<VL, VL>();
        const XANH = 0x174f52; // --green
        const nhan = (m: VL, dam: boolean) => {
          const bang = dam ? vlNhan : vlRo;
          let c = bang.get(m);
          if (!c) {
            c = chepVa(m, m.clone()); // bản sao giữ bản vá shader (mặt cắt, tường sơn): cùng chương trình với vật liệu gốc
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
        // --- lớp phân tích view: nhóm riêng trong scene (không thuộc `goc`, dựng lại cảnh không gỡ), một vật liệu màu đỉnh ---
        // nhóm của gói mở rộng (ảnh nền mặt đất…): làm nhạt khi phân tích view, ẩn / hiện theo Lớp như `goc`, không bị gỡ khi dựng lại
        const phu = new T.Group(); phu.name = 'mo-rong';
        scene.add(phu);
        const lopView = new T.Group();
        lopView.visible = false;
        scene.add(lopView);
        const vlView = catY(new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false }), uCat);
        const vienO = new T.LineLoop(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(12), 3)), catY(new T.LineBasicMaterial({ color: 0x141818 }), uCat));
        vienO.visible = false; vienO.renderOrder = 8; lopView.add(vienO);
        let hv: HinhView3D | null = null, khoaView = '', locView = '', mucView = 0, dichView = 0, huyMo = () => {};
        const XAM_NHAT = new T.Color(0xe7e6e0), mauGoc = new WeakMap<import('three').Material, import('three').Color>();
        /** Làm nhạt cảnh (m = 0 → màu gốc, 1 → gần xám ngà): pha màu mọi vật liệu của cảnh, nhớ màu gốc. */
        const lamNhat = (m: number) => {
          for (const g0 of [goc, phu]) g0.traverse((o) => {
            // vật thể tự làm nhạt theo cách riêng (vd. ảnh vệ tinh nền: giảm độ đậm — đổi màu nhân texture không đủ nhạt)
            if (typeof o.userData.lamNhat === 'function') { (o.userData.lamNhat as (m: number) => void)(m); return; }
            const mt = (o as import('three').Mesh).material as import('three').Material | import('three').Material[] | undefined;
            if (!mt) return;
            for (const x of Array.isArray(mt) ? mt : [mt]) {
              const c = (x as import('three').MeshStandardMaterial).color;
              if (!c) continue;
              let g = mauGoc.get(x);
              if (!g) { g = c.clone(); mauGoc.set(x, g); }
              c.copy(g).lerp(XAM_NHAT, m * 0.8);
            }
          });
        };
        const boView = () => { lopView.children.filter((o) => o !== vienO).forEach((o) => { lopView.remove(o); (o as import('three').Mesh).geometry.dispose(); }); hv = null; };
        /** Ô trúng tia tại (x, y) px màn hình (bỏ phần trên mặt cắt ngang), -1 nếu không. */
        const trungView = (x: number, y: number): number => {
          if (!hv || mucView < 0.5) return -1;
          const r = R.domElement.getBoundingClientRect();
          v2.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
          rc.setFromCamera(v2, cam);
          const h = rc.intersectObjects(lopView.children.filter((o) => o !== vienO), false).find((q) => q.point.y <= mp.constant + 1e-3);
          if (!h || h.faceIndex == null) return -1;
          return (h.object.userData.dau as number) + Math.floor(h.faceIndex / 2);
        };
        const roView = (i: number, x: number, y: number, ghim: boolean) => {
          if (i < 0 || !hv) { if (vienO.visible) { vienO.visible = false; ve(); } setTip((c) => (c && (!c.ghim || ghim) ? null : c)); return; }
          const a = vienO.geometry.getAttribute('position') as import('three').BufferAttribute;
          hv.goc(i).forEach((q, j) => a.setXYZ(j, q[0], q[1], q[2]));
          a.needsUpdate = true; vienO.geometry.computeBoundingSphere(); vienO.visible = true; ve();
          const r = R.domElement.getBoundingClientRect();
          setTip({ x: x - r.left, y: y - r.top, o: hv.o[i], ghim });
        };
        /** Đồng bộ lớp với prop `phanTich`: dựng lại khi khoá đổi, tô lại khi lọc đổi, hiện / ẩn dần + làm nhạt cảnh. */
        const apView = () => {
          const p = ptRef.current, hopEl = hop.current;
          const k = p?.dung ? p.khoa + '|' + JSON.stringify(tr.current.ts) : '';
          if (p?.dung && k !== khoaView) {
            boView();
            hv = p.dung(T, tr.current.ts);
            khoaView = k; locView = '';
            hv?.hinh.forEach((h) => { const me = new T.Mesh(h.g, vlView); me.userData.dau = h.dau; me.renderOrder = 6; lopView.add(me); });
            vienO.visible = false;
          }
          const kl = JSON.stringify(p?.loc ?? null);
          if (hv && kl !== locView) { hv.loc(p?.loc ?? null); locView = kl; }
          const dich = p?.bat && hv ? 1 : 0;
          if (dich !== dichView) {
            dichView = dich; huyMo();
            if (!dich) { vienO.visible = false; setTip(null); }
            const m0 = mucView, buoc = (q: number) => { const truoc = mucView > 0.5; mucView = tron(m0, dich, q); vlView.opacity = mucView; lopView.visible = mucView > 0.001; if (truoc !== mucView > 0.5) apLop(); lamNhat(mucView); ve(); };
            if (giamChuyenDong()) buoc(1); else huyMo = chayRaf(420, easeInOut, buoc);
          }
          if (hopEl) hopEl.closest('.khung-3d')?.setAttribute('data-view', p?.bat ? (hv ? 'xong' : 'dang') : 'tat');
          ve();
        };
        const vlPhu = (dam: boolean) => catY(new T.MeshBasicMaterial({ color: XANH, transparent: true, opacity: dam ? 0.36 : 0.18, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), uCat);
        const vlPhuNet = (dam: boolean) => catY(new T.LineBasicMaterial({ color: XANH, transparent: !dam, opacity: dam ? 1 : 0.7 }), uCat);
        /**
         * Khối thể tích (căn / tầng / đế nằm trong khối đã gộp hình): tô đúng các mặt NHÌN THẤY nằm trong khối, theo chiều sâu — không
         * xuyên vật che (trước đây vẽ tắt depthTest nên căn bị tòa / cánh khác che vẫn hiện, kiểu tia X). Đếm stencil như bóng khối
         * (shadow volume): lượt 1 mặt sau của khối nằm SAU mặt cảnh → +1; lượt 2 mặt trước nằm sau mặt cảnh → −1; còn ≠ 0 = mặt cảnh ở
         * trong khối (khối lõm chữ L / V vẫn đúng vì đếm chẵn lẻ). Lượt 3 tô màu chỗ stencil ≠ 0 rồi xoá về 0. Mặt cắt ngang cắt cả khối
         * nên nhìn từ trên xuống thấy sàn / tường trong căn đã cắt. Ba lượt vẽ (+ viền) mỗi đối tượng tô, chỉ khi có chọn / rê.
         */
        const vlKhoi = (dam: boolean) => {
          const chung = { transparent: true, depthWrite: false, stencilWrite: true };
          const dem = (side: import('three').Side, op: import('three').StencilOp) => catY(new T.MeshBasicMaterial({
            ...chung, colorWrite: false, side, depthFunc: T.GreaterEqualDepth, stencilFunc: T.AlwaysStencilFunc, stencilZPass: op, stencilZFail: T.KeepStencilOp, stencilFail: T.KeepStencilOp,
          }), uCat);
          const to = catY(new T.MeshBasicMaterial({
            ...chung, color: XANH, opacity: dam ? 0.55 : 0.28, side: T.BackSide, depthTest: false,
            stencilFunc: T.NotEqualStencilFunc, stencilRef: 0, stencilZPass: T.ZeroStencilOp, stencilFail: T.KeepStencilOp, stencilZFail: T.ZeroStencilOp,
          }), uCat);
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
        // theHe: số lần đổi cỡ bộ đệm; daVeTheHe: lần đổi cỡ đã có lượt vẽ theo sau (khác nhau = khung đang hiện ảnh cũ bị kéo giãn)
        let theHe = 0, daVeTheHe = 0;
        /**
         * Vẽ theo pha (mở 3D không giật — scripts/do_mo_3d.mjs): 0 = chưa có ảnh (canvas ẩn); 1 = XEM TRƯỚC: một vật liệu Lambert trắng ngà,
         * không bóng (2–3 chương trình dịch song song, ra ảnh sớm); 2 = ĐỦ: vật liệu PBR + môi trường + bóng mềm, chỉ khi mọi chương trình
         * đã nối xong. Ở pha 2, vật liệu mới (dựng lại, tô nhấn, lớp, gói mở rộng) dịch nền; vật thể dùng chúng ẩn tạm tới khi sẵn —
         * không lượt vẽ nào chờ GPU dịch shader.
         */
        let pha = 0, envRT: import('three').WebGLRenderTarget | null = null;
        const daDich = new WeakSet<VL>(), choDich = new Set<VL>();
        const vlXem = catY(new T.MeshLambertMaterial({ color: 0xebe8df }), uCat);
        const gia = vatLieu ? moiTruongGia(T) : null;
        /** Trạng thái renderer khi tạo chương trình cho pha đủ: bật bóng, môi trường giả cùng cỡ PMREM nếu môi trường thật chưa có. */
        let ttCu: { bong: boolean; env: import('three').Texture | null } | null = null;
        const datTT = (bat: boolean) => {
          if (bat) { ttCu = { bong: R.shadowMap.enabled, env: scene.environment }; R.shadowMap.enabled = true; if (gia && !scene.environment) scene.environment = gia; }
          else if (ttCu) { R.shadowMap.enabled = ttCu.bong; scene.environment = ttCu.env; ttCu = null; }
        };
        const dichThem = (ds: { o: import('three').Object3D; m: VL }[]) => {
          ds.forEach((x) => choDich.add(x.m));
          void dichDan(T, R, ds, scene, cam, { datTrangThai: datTT, huy: () => huy }).then(() => {
            ds.forEach((x) => { choDich.delete(x.m); daDich.add(x.m); });
            ve();
          });
        };
        // đo (scripts/do_mo_3d.mjs đặt window.__ve3d = []): mỗi lượt vẽ [ms, pha, số vật liệu đang dịch, số chương trình]
        const doVe = (globalThis as unknown as { __ve3d?: unknown[] }).__ve3d;
        const veThat = (): boolean => {
          if (!doVe) return veThat0();
          const t0 = performance.now(), p0 = pha, c0 = choDich.size, k = veThat0();
          doVe.push([Math.round(performance.now() - t0), p0, c0, R.info.programs?.length ?? 0]);
          return k;
        };
        const veThat0 = (): boolean => {
          if (pha === 0) return false;
          if (pha === 1) { scene.overrideMaterial = vlXem; try { R.render(scene, cam); } finally { scene.overrideMaterial = null; } return true; }
          const moi = thieuDich(scene, daDich).filter((x) => !choDich.has(x.m));
          if (moi.length) dichThem(moi);
          if (!choDich.size) { R.render(scene, cam); return true; }
          const an: import('three').Object3D[] = [];
          scene.traverseVisible((o) => { const m = (o as import('three').Mesh).material; if (m && (Array.isArray(m) ? m : [m]).some((x) => choDich.has(x))) an.push(o); });
          an.forEach((o) => { o.visible = false; });
          try { R.render(scene, cam); } finally { an.forEach((o) => { o.visible = true; }); }
          return true;
        };
        const ve = () => { if (!cho) cho = requestAnimationFrame(() => { cho = 0; veThat(); daVeTheHe = theHe; }); };
        // Có đà (damping): update() phải gọi mỗi frame tới khi hết đà; xong thì về render theo yêu cầu.
        let vong = 0;
        const chayDa = () => {
          vong = ctl.update() ? requestAnimationFrame(chayDa) : 0; // vong còn khác 0 trong update() nên sự kiện change không xếp thêm vòng
        };
        let huyBay = () => {};
        ctl.addEventListener('change', () => { ve(); if (ctl.enableDamping && !vong) vong = requestAnimationFrame(chayDa); });
        ctl.addEventListener('start', () => huyBay()); // người dùng nắm lại camera thì dừng bay
        /**
         * Đổi cỡ khung (xoay máy, kéo cửa sổ, thanh địa chỉ điện thoại co / giãn): bộ đệm vẽ + tỷ lệ camera + VẼ NGAY trong cùng lượt
         * ResizeObserver (chạy trước lúc tô màn hình). Trước đây chỉ hẹn vẽ ở frame sau → một frame ảnh cũ bị kéo giãn theo cỡ CSS mới
         * (đo: bộ đệm 870×848 hiện trong khung 530×748) rồi mới "thẳng lại".
         */
        const kichCo = () => {
          const { w, h } = coBoDem(hop.current!.clientWidth, hop.current!.clientHeight);
          const pr = R.getPixelRatio();
          if (R.domElement.width === Math.floor(w * pr) && R.domElement.height === Math.floor(h * pr) && Math.abs(cam.aspect - w / h) < 1e-9) return;
          R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); theHe++;
          cancelAnimationFrame(cho); cho = 0; veThat(); daVeTheHe = theHe;
        };
        const apHien = () => {
          const h = tr.current.hien;
          G.dam.forEach((o) => { o.visible = h.dam; });
          G.lov.forEach((o) => { o.visible = h.lov; });
          G.top.forEach((o) => { o.visible = h.top; });
          G.vien.forEach((o) => { o.visible = h.vien && (!G.dam.includes(o) || h.dam); });
          G.mo.forEach((o) => { o.pg.rotation.y = h.mo ? o.ang : 0; });
          if (canh) { mp.constant = tr.current.cat * (canh.cao + 0.01) + 0.001; uCat.value = mp.constant; }
          ve();
        };
        const datNang = () => {
          if (!canh) return;
          const h = new Date(); // giờ Việt Nam (UTC+7) của ngày hôm nay
          const { gocCao, phuongVi } = mr?.nang?.(tr.current.gio) ?? viTriMatTroi(tr.current.viDo, 105.85, new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate(), 0, 0, 0) + (tr.current.gio - 7) * 3600e3));
          const [hx, hy, hz] = huongMatTroi(gocCao, phuongVi, tr.current.gocBac); // Bắc = +Y bản vẽ = −Z three khi gocBac = 0
          const c = canh.coCanh, [tx, ty, tz] = canh.tam;
          sun.position.set(tx + c * 1.6 * hx, ty + c * 1.6 * hy, tz + c * 1.6 * hz);
          sun.target.position.set(tx, 0, tz);
          const s = sun.shadow.camera; s.left = -c; s.right = c; s.top = c; s.bottom = -c; s.near = 0.5; s.far = c * 6; s.updateProjectionMatrix();
          // Vật liệu: nắng chiều / sáng sớm dịu và ấm hơn giữa trưa
          sun.intensity = (gocCao > 2 ? 2.6 : 0.8) * (tr.current.kieu === 'vatlieu' ? 0.75 + 0.25 * Math.min(1, Math.max(0, gocCao) / 45) : 1);
          if (tr.current.kieu === 'vatlieu') sun.color.setHSL(0.1, 0.55, 0.93 + 0.05 * Math.min(1, Math.max(0, gocCao) / 50));
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
          if (!x0 || !e.isPrimary || (!cb.onChon && !(mucView > 0.5 && hv))) return;
          const len: DiemBam = { x: e.clientX, y: e.clientY, t: performance.now(), kieu: e.pointerType };
          if (!laBam(x0, len)) return; // kéo xoay camera
          if (mucView > 0.5 && hv) { const i = trungView(e.clientX, e.clientY); roView(i, e.clientX, e.clientY, true); } // chạm = rê chuột
          const d = trung(e.clientX, e.clientY);
          const dup = laBamDup(bamTruoc, len) && !!d && khoaDoiTuong(bamTruoc?.d) === khoaDoiTuong(d);
          bamTruoc = dup ? null : { ...len, d };
          if (dup && cb.onMo) cb.onMo(d!); else cb.onChon?.(d);
        };
        const onMove = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse' || e.buttons) return;
          const coView = mucView > 0.5 && !!hv;
          if (!coView && !chonRef.current.onChon) return;
          roXY = [e.clientX, e.clientY];
          if (choRo) return;
          choRo = requestAnimationFrame(() => {
            choRo = 0;
            if (mucView > 0.5 && hv) { roView(trungView(roXY[0], roXY[1]), roXY[0], roXY[1], false); return; }
            const d = trung(roXY[0], roXY[1]);
            if (khoaDoiTuong(d) !== khoaDoiTuong(ro)) { ro = d; cv0.style.cursor = d ? 'pointer' : ''; apNhan(); ve(); }
          });
        };
        const onLeave = () => { if (hv && vienO.visible) roView(-1, 0, 0, false); if (ro) { ro = null; cv0.style.cursor = ''; apNhan(); ve(); } };
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
        /** Ẩn / hiện theo lớp (userData.lop) + đổi vật liệu theo lớp (userData.vlTheoLop) — tức thì, không dựng lại. */
        const apLop = () => {
          const an = new Set(tr.current.lopAn ?? []);
          // đang phân tích view (lớp màu ô hiện rõ): ẩn cây (che mặt đứng tầng thấp, màu từng cây không làm nhạt được) và trục thang
          // (vẽ xuyên mặt che, đè lên ô màu); tắt phân tích thì về theo menu Lớp
          if (mucView > 0.5) { an.add('cay'); an.add('thang'); }
          for (const g0 of [goc, phu]) g0.traverse((o) => {
            const l = o.userData.lop as string | undefined;
            if (l) o.visible = !an.has(l);
            const d = o.userData.vlTheoLop as { lop: string; vl: VL; vlThuong: VL } | undefined;
            if (d) { const vl = an.has(d.lop) ? d.vlThuong : d.vl; o.userData.vlGoc = vl; (o as import('three').Mesh).material = vl; }
          });
          apNhan();
          if (mucView > 0) lamNhat(mucView); // vật liệu vừa đổi theo lớp cũng làm nhạt khi đang phân tích
        };
        let msDung = 0;
        // phần cảnh dựng riêng (prop `phan`): nhóm hiện có + khoá đã dựng
        let dsPhan: { khoa: string; g: import('three').Group }[] = [];
        let lanDung = 0, lanPhan = 0, dangDungCa = false, baoDung = () => {};
        const daDungLan1 = new Promise<void>((r) => { baoDung = r; });
        const nguCanh = (g: import('three').Group, Gm: NhomHien): NguCanh => ({ T, goc: g, M, G: Gm, P: tr.current.ts, kieu: kieuVe, capDo });
        const boHinh = (o: import('three').Object3D) => { const bo = new Set<HH>(); hinhCua(o, bo); bo.forEach((g) => g.dispose()); };
        /** Dựng một phần (từng mẩu nếu là generator); bị bỏ giữa chừng thì huỷ hình đã dựng, trả undefined. */
        const dungMotPhan = async (p: { khoa: string; dung: (c: NguCanh) => void | Tung<void> }, bo: () => boolean) => {
          const g = new T.Group();
          try {
            const r = p.dung(nguCanh(g, nhomMoi()));
            if (laTung<void>(r) && !(await chayDan(r, 8, bo))) { boHinh(g); return undefined; }
          } catch (e) { console.error(e); }
          return { khoa: p.khoa, g };
        };
        /** Sau khi cảnh đổi (cả cảnh hay một phần): danh sách chọn, tô nhấn, lớp, làm nhạt. */
        const sauDoi = () => {
          ro = null;
          dsChon = [];
          goc.traverse((o) => { if (o.userData.chon) dsChon.push(o); });
          apNhan();
          apLop();
          if (mucView > 0) lamNhat(mucView);
        };
        /** Dựng lại các phần đổi khoá (không dựng lại cả cảnh); đang dựng cả cảnh thì thôi — lượt đó tự đọc phần mới nhất. */
        const dungPhanDoi = async () => {
          if (dangDungCa || !canh) return;
          const lan = ++lanPhan, ds = phanRef.current ?? [], bo = () => huy || lan !== lanPhan || dangDungCa;
          const moiDs = new Map<number, { khoa: string; g: import('three').Group }>();
          for (let i = 0; i < ds.length; i++) {
            if (dsPhan[i]?.khoa === ds[i].khoa) continue;
            const x = await dungMotPhan(ds[i], bo);
            if (!x || bo()) { if (x) boHinh(x.g); moiDs.forEach((y) => boHinh(y.g)); return; }
            moiDs.set(i, x);
          }
          let doi = false;
          moiDs.forEach((moi, i) => {
            const cu = dsPhan[i];
            if (cu) {
              goc.remove(cu.g);
              const giu = new Set<HH>(); hinhCua(moi.g, giu);
              const bo = new Set<HH>(); hinhCua(cu.g, bo);
              bo.forEach((g) => { if (!giu.has(g)) g.dispose(); });
            }
            goc.add(moi.g); dsPhan[i] = moi; doi = true;
          });
          for (let i = ds.length; i < dsPhan.length; i++) { goc.remove(dsPhan[i].g); const bo = new Set<HH>(); hinhCua(dsPhan[i].g, bo); bo.forEach((g) => g.dispose()); doi = true; }
          dsPhan.length = ds.length;
          if (doi) { sauDoi(); ve(); }
        };
        const dungLai = async (giuGoc: boolean) => {
          // dựng cảnh mới vào nhóm tạm trước, rồi mới gỡ cảnh cũ: hình học dùng lại (nhớ ở dungToa) không bị huỷ / nạp lại GPU.
          // Hàm dựng dạng generator chạy từng mẩu ~8 ms (nhường luồng chính giữa các mẩu); lượt dựng mới hơn thì bỏ lượt này.
          const lan = ++lanDung;
          dangDungCa = true;
          const moi = new T.Group(), Gm = nhomMoi();
          const t0 = performance.now();
          let canhMoi: CanhDung | null;
          const phanMoi: { khoa: string; g: import('three').Group }[] = [];
          // hình trong `moi` có thể dùng chung với cảnh đang hiện (bộ nhớ hình dungToa): bỏ lượt thì không huỷ hình
          try {
            const r = dungRef.current(nguCanh(moi, Gm));
            if (laTung<CanhDung | null>(r)) {
              const x = await chayDan(r, 8, () => huy || lan !== lanDung);
              if (!x) return;
              canhMoi = x.v;
            } else canhMoi = r;
            if (huy || lan !== lanDung) return;
            for (const p of phanRef.current ?? []) {
              const x = await dungMotPhan(p, () => huy || lan !== lanDung);
              if (!x || huy || lan !== lanDung) return;
              phanMoi.push(x);
            }
          } finally { if (lan === lanDung) dangDungCa = false; }
          phanMoi.forEach((x) => moi.add(x.g));
          msDung = performance.now() - t0;
          G = Gm; canh = canhMoi; dsPhan = phanMoi;
          const giu = new Set<HH>();
          hinhCua(moi, giu);
          xoa(giu);
          while (moi.children.length) goc.add(moi.children[0]);
          if (canh) {
            const [x, y, z] = canh.tam;
            if (canh.nen) {
              const dat = new T.Mesh(new T.PlaneGeometry(canh.coCanh * 8, canh.coCanh * 8), canh.nenTrongSuot ? matDatTrong : matDat);
              dat.rotation.x = -Math.PI / 2; dat.position.set(x, -0.05, z); dat.receiveShadow = true;
              if (canh.nenLop) dat.userData.vlTheoLop = { lop: canh.nenLop, vl: matDatTrong, vlThuong: matDat };
              goc.add(dat);
            }
            ctl.minDistance = 1; ctl.maxDistance = Math.max(80, canh.coCanh * 8);
            // Vật liệu: sương nhẹ cùng màu nền ngà — xa mờ dần vào chân trời, tách lớp gần / xa (chiều sâu)
            if (vatLieu) scene.fog = new T.Fog(N.troi, canh.coCanh * 3.5, canh.coCanh * 14);
            cam.near = 0.1; cam.far = Math.max(800, canh.coCanh * 30); cam.updateProjectionMatrix();
            const ds = canh.goc?.length ? canh.goc : gocMacDinh(canh);
            setDeXuat(ds);
            if (!giuGoc) { ctl.target.set(x, y, z); datGoc(ds[0]); }
            apHien(); datNang();
            mr?.canhMoi?.(canh);
          }
          sauDoi(); // cảnh mới khi đang phân tích: làm nhạt luôn
          baoDung();
          void dungPhanDoi(); // phần đổi khoá trong lúc dựng (đã dựng theo khoá cũ): dựng lại phần đó
          if (pha > 0) { setDang(false); ve(); }
        };
        const ob = new ResizeObserver(kichCo);
        ob.observe(hop.current);
        kichCo();
        try { mr = moRongRef.current?.gan({ T, R, scene, phu, cam, sun, ve, apLop: () => apLop(), capNang: () => datNang(), datGio: (g) => setGio(g), dom: R.domElement }) ?? null; } catch { mr = null; }
        void dungLai(false);
        apView();
        // --- mở dần: xem trước (vài chương trình) → đủ chất lượng (mọi vật liệu + bóng + môi trường), dịch song song không chặn ---
        const hienCanvas = () => { setDang(false); ve(); requestAnimationFrame(() => hop.current?.classList.add('da-dung')); }; // hiện dần canvas
        void (async () => {
          await daDungLan1; // lượt dựng đầu (có thể chia nhiều mẩu) xong mới dịch / hiện
          if (huy) return;
          const bt = vatLieu ? bauTroi(T, tr.current.gio) : null;
          try {
            R.shadowMap.enabled = false;
            // 1) xem trước: một vật liệu cho mọi vật thể — mỗi biến thể (mesh / nét / instanced có màu) một chương trình
            const bien = new Map<string, { o: import('three').Object3D; m: VL }>();
            scene.traverse((o) => {
              if (!(o as import('three').Mesh).material) return;
              const im = o as import('three').InstancedMesh;
              bien.set(im.isInstancedMesh ? (im.instanceColor ? 'ic' : 'i') : 'm', { o, m: vlXem });
            });
            await dichDan(T, R, [...bien.values()], scene, cam, { huy: () => huy });
            if (huy) return;
            pha = 1; hienCanvas();
            // cho frame xem trước lên màn hình trước khi giao GPU dịch loạt chương trình đầy đủ
            await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
            if (huy) return;
            // 2) đủ: môi trường (PMREM, dịch trước), vật liệu cảnh, chương trình bóng — chạy song song
            const ds = thieuDich(scene, daDich);
            ds.forEach((x) => choDich.add(x.m));
            const [rt] = await Promise.all([
              bt ? locMoiTruong(T, R, bt, () => huy).catch(() => null) : Promise.resolve(null),
              dichDan(T, R, ds, scene, cam, { datTrangThai: datTT, huy: () => huy }),
              dichBong(T, R, scene, cam, () => huy),
            ]);
            if (huy) { rt?.dispose(); return; }
            ds.forEach((x) => { choDich.delete(x.m); daDich.add(x.m); });
            if (rt) { envRT = rt; scene.environment = rt.texture; scene.environmentIntensity = 0.6; }
            R.shadowMap.enabled = true;
            pha = 2; ve();
            hop.current?.setAttribute('data-chat-luong', 'du');
          } catch {
            // dịch nền lỗi (trình duyệt lạ): vẽ thẳng như cũ (có thể chặn một lần), không để khung trống
            if (huy) return;
            R.shadowMap.enabled = true; pha = 2; hienCanvas();
          } finally {
            bt?.traverse((o) => { const m = o as import('three').Mesh; m.geometry?.dispose(); (m.material as import('three').Material | undefined)?.dispose(); });
          }
        })();
        he.current = { ve: () => { void dungLai(true); }, phan: () => { void dungPhanDoi(); }, datGoc, layGoc, anh };
        const hopEl = hop.current as HTMLDivElement & { _cap?: () => void; _nhan?: () => void; _chieuDoiTuong?: () => { loai: string; id: string; x: number; y: number }[] };
        hopEl._cap = () => { apHien(); datNang(); };
        hopEl._nhan = () => { apNhan(); ve(); };
        (hopEl as typeof hopEl & { _lop?: () => void })._lop = () => { apLop(); ve(); };
        (hopEl as typeof hopEl & { _view?: () => void })._view = apView;
        // để kiểm / chụp tự động: tâm (px trong khung) một ô quay về camera, gần giữa khung nhất
        (hopEl as typeof hopEl & { _oViewThu?: () => { x: number; y: number } | null })._oViewThu = () => {
          if (!hv) return null;
          const r = R.domElement.getBoundingClientRect(), v = new T.Vector3();
          let tot: { x: number; y: number; d: number } | null = null;
          const buoc = Math.max(1, Math.floor(hv.o.length / 3000));
          for (let i = 0; i < hv.o.length; i += buoc) {
            const o = hv.o[i], c = hv.tam(i);
            const nhin = (cam.position.x - c[0]) * o.n[0] + (cam.position.z - c[2]) * -o.n[1];
            if (nhin <= 0) continue;
            v.set(c[0], c[1], c[2]).project(cam);
            if (Math.abs(v.x) > 0.8 || Math.abs(v.y) > 0.8 || v.z > 1) continue;
            const x = ((v.x + 1) / 2) * r.width, y = ((1 - v.y) / 2) * r.height, d = Math.hypot(v.x * 0.6, v.y);
            if (trungView(r.left + x, r.top + y) !== i) continue;
            if (!tot || d < tot.d) tot = { x, y, d };
          }
          return tot && { x: tot.x, y: tot.y };
        };        // để chụp tự động: phóng camera về / ra khỏi điểm nhìn `k` lần (k < 1 = lại gần)
        (hopEl as typeof hopEl & { _phong?: (k: number) => void })._phong = (k: number) => {
          cam.position.sub(ctl.target).multiplyScalar(k).add(ctl.target); ctl.update(); ve();
        };
        // để đo: một lượt vẽ đồng bộ → draw call / tam giác thật của renderer (gồm pass bóng) và thời gian
        (hopEl as typeof hopEl & { _doVe?: () => { calls: number; tris: number; ms: number; dung: number; pha: number; chuongTrinh: number; choDich: number; songSong: boolean } })._doVe = () => {
          const t0 = performance.now(); veThat(); R.getContext().finish();
          return { calls: R.info.render.calls, tris: R.info.render.triangles, ms: performance.now() - t0, dung: msDung, pha, chuongTrinh: R.info.programs?.length ?? 0, choDich: choDich.size, songSong: R.extensions.has('KHR_parallel_shader_compile') };
        };
        // để kiểm méo (scripts/kiem_zoom.mjs): bộ đệm vẽ, cỡ CSS, tỷ lệ camera hiện tại
        (hopEl as typeof hopEl & { _doKhung?: () => { bufW: number; bufH: number; cssW: number; cssH: number; aspect: number; chuaVe: boolean } })._doKhung = () => {
          const c = R.domElement;
          return { bufW: c.width, bufH: c.height, cssW: c.clientWidth, cssH: c.clientHeight, aspect: cam.aspect, chuaVe: theHe !== daVeTheHe };
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
          mr?.huy(); mr = null;
          huyBay(); cancelAnimationFrame(vong); cancelAnimationFrame(choRo); ob.disconnect(); cancelAnimationFrame(cho);
          cv0.removeEventListener('pointerdown', onDown); cv0.removeEventListener('pointerup', onUp); cv0.removeEventListener('pointermove', onMove);
          cv0.removeEventListener('pointerleave', onLeave); cv0.removeEventListener('pointercancel', onCancel);
          huyMo(); boView(); vlView.dispose(); vienO.geometry.dispose(); (vienO.material as import('three').Material).dispose();
          ctl.dispose(); xoa(); lopNhan.children.forEach((o) => (o as import('three').Mesh).geometry.dispose()); Object.values(VL_PHU).flatMap((v) => [v.phu, v.net, ...v.khoi]).forEach((m) => m.dispose()); vlNhan.forEach((m) => m.dispose()); vlRo.forEach((m) => m.dispose()); envRT?.dispose(); vlXem.dispose(); R.dispose(); he.current = null;
        };
      } catch (e) {
        if (!huy) { setLoi(t('m3d.khongNap') + ' ' + String((e as Error).message ?? e)); setDang(false); }
      }
    })();
    return () => { huy = true; don?.(); };
  }, [khoa, kieu]);

  // Đổi tham số đứng: dựng lại giữ góc nhìn. Đổi hiển thị / giờ / cắt: cập nhật nhẹ.
  useEffect(() => { he.current?.ve(); }, [khoaNhe]);
  useEffect(() => { he.current?.phan(); }, [khoaPhan]);
  useEffect(() => { he.current?.ve(); try { localStorage.setItem(LUU, kt); } catch { /* không lưu được */ } }, [kt]);
  useEffect(() => { (hop.current as (HTMLDivElement & { _cap?: () => void }) | null)?._cap?.(); }, [hien, gio, cat, gocBac, viDo]);
  useEffect(() => { try { localStorage.setItem(LUU_KIEU, kieu); } catch { /* không lưu được */ } }, [kieu]);
  useEffect(() => { (hop.current as (HTMLDivElement & { _nhan?: () => void }) | null)?._nhan?.(); }, [chon?.toaId, chon?.loId, chon?.tang, chon?.canKhoa]);
  useEffect(() => { (hop.current as (HTMLDivElement & { _lop?: () => void }) | null)?._lop?.(); }, [(lopAn ?? []).join()]);
  useEffect(() => { (hop.current as (HTMLDivElement & { _view?: () => void }) | null)?._view?.(); }, [phanTich?.bat, phanTich?.khoa, !!phanTich?.dung, JSON.stringify(phanTich?.loc ?? null)]);

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
        {chuThich && !dang && !loi && !(phanTich?.bat && tip) && <div class="the-chon-3d" role="status">{chuThich}</div>}
        {phanTich?.bat && !loi && (
          <div class="chu-giai-3d-view" role="note">
            {phanTich.dung ? phanTich.chuGiai : <span class="dang-tinh-view"><img class="spin-o" src="/brand/leo_ai_o.png" alt="" />{t('view.dangTinh')}</span>}
          </div>
        )}
        {phanTich?.bat && tip && (() => {
          const w = hop.current?.clientWidth ?? 800, h = hop.current?.clientHeight ?? 600;
          const trai = tip.x > w - 280, tren = tip.y > h - 230;
          return (
            <div class={`tip-view-3d${tip.ghim ? ' ghim' : ''}`} role="status" style={{ left: `${Math.max(8, trai ? tip.x - 262 : tip.x + 16)}px`, top: `${Math.max(8, tren ? tip.y - 210 : tip.y + 16)}px` }}>
              {phanTich.doc(tip.o)}
              {tip.ghim && <button type="button" class="nut-dong-view" aria-label={t('view.dong')} onClick={() => setTip(null)}>×</button>}
            </div>
          );
        })()}
      </div>
      <GocBanVe troGiup={t('m3d.goiY')} lop={lop} />
    </div>
  );
}
