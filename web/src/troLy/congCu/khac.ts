/**
 * Công cụ khác của Leo AI: hầm, chi phí, phương án (PA), xuất tệp, hoàn tác / làm lại, và lối dự phòng điều khiển giao diện
 * (ui_snapshot / ui_click / ui_set_value) để bấm được MỌI nút như người dùng khi chưa có công cụ riêng.
 */
import { chuanHoaChiPhi, chuanHoaHam } from '../../tinh/macDinh';
import type { ChiPhiPA, ThongSoHam } from '../../tinh/kieu';
import { S, type CongCu } from './dinhNghia';
import { buocHoanTac, kiemSua, LoiCongCu, suaPA, type NguCanh } from './nguCanh';

/** Trường hầm sửa được + giới hạn như ô nhập màn Hầm (man/ManHam.tsx). */
const HAM_SO: Record<string, { min?: number; max?: number; nguyen?: boolean; phanTram?: boolean }> = {
  soTang: { min: 1, max: 6, nguyen: true }, caoTang: { min: 2 }, dayKetCau: { min: 0 }, lui: { min: 0 }, choDai: { min: 5 }, choRong: { min: 2.3 },
  rongLan: { min: 1 }, choXeLan: { min: 0, nguyen: true }, nhip: { min: 3 }, cotRong: { min: 0 }, tangXeMay: { min: 1, nguyen: true },
  khoMoiTang: { min: 0, nguyen: true }, dtKho: { min: 1 }, rongKho: { min: 1 }, lanKho: { min: 0 }, tyLeKyThuat: { min: 0, max: 50, phanTram: true },
  // đợt 2 (bố trí hầm)
  dtKhoangMax: { min: 300 }, cuLyThoat: { min: 10 }, thangRong: { min: 2.4 }, thangDai: { min: 4 },
  qSinhHoat: { min: 80 }, ngayDuTru: { min: 0.5 }, kvaMoiCan: { min: 0 }, xeMayRong: { min: 0.75 }, xeMayDai: { min: 2 }, xeMayLan: { min: 1.5 },
};

const suaCP = (ng: NguCanh, f: (c: ChiPhiPA) => ChiPhiPA) => suaPA(ng, (p) => ({ ...p, chiPhi: f(chuanHoaChiPhi(p.chiPhi)) }));

export const CONG_CU_KHAC: CongCu[] = [
  {
    ten: 'update_basement', nhom: 'khac', sua: true,
    moTa: 'Sửa thông số hầm (màn Hầm chỉ tính số: soTang, caoTang, dayKetCau, lui, dtXeMay, garaCoKhi có tác dụng; các trường bố trí mặt bằng — ô đỗ, ram, phòng, khoang cháy, xe điện — được lưu nhưng chưa dùng, layout ở nhánh feat/ham-layout), một bước hoàn tác: soTang (1–6), caoTang, dayKetCau, lui, choDai, choRong, rongLan, choXeLan, nhip, cotRong, tangXeMay, khoMoiTang, dtKho, rongKho, lanKho, tyLeKyThuat (%), dtXeMay (m² hoặc null = tự), dtKhoangMax (m², khoang cháy QCVN 13 Bảng 4), cuLyThoat (m, Bảng 3), thangRong, thangDai (thang thoát nạn thêm), qSinhHoat (L/người/ngày, ≥ 80), ngayDuTru, kvaMoiCan, xeMayRong, xeMayDai, xeMayLan, garaCoKhi, auto_rooms (bật / tắt tự bố trí phòng kỹ thuật), auto_accessible (chỗ xe lăn theo QCVN 10:2024 Bảng 1), rooms {loại phòng: {dt m² | null, bo}} (loại: beSH, bomSH, bePCCC, bomPCCC, xlnt, vanHanhXlnt, tba, mayPhat, baoVe, trucPCCC, dienNhe, khoVatTu, quatHut, quatCap, rac); ram {loai thang_mai|cong|ho, dai, rong, docNgang %, coNguoiDi, viaHe, doanChuyen, doanThangDuoi, doanThangTren, banKinh}; ev {bat, tang, choOto, tyLeOto %}',
    schema: S.doiTuong({
      fields: { type: 'object', additionalProperties: { type: 'number', nullable: true }, description: 'trường số → giá trị' },
      garaCoKhi: S.bool(),
      ram: S.doiTuong({ loai: S.chon(['thang_mai', 'cong', 'ho']), dai: S.so(undefined, 1), rong: S.so(undefined, 2), docNgang: S.so(), coNguoiDi: S.bool(), viaHe: S.so(undefined, 0),
        doanChuyen: S.so(undefined, 0), doanThangDuoi: S.so(undefined, 0), doanThangTren: S.so(undefined, 0), banKinh: S.so(undefined, 1) }),
      auto_rooms: S.bool(),
      auto_accessible: S.bool(),
      rooms: { type: 'object', additionalProperties: { type: 'object', properties: { dt: { type: 'number', nullable: true }, bo: { type: 'boolean' } } }, description: 'loại phòng → {dt, bo}' },
      ev: S.doiTuong({ bat: S.bool(), tang: S.so(undefined, 1), choOto: S.so(undefined, 0), tyLeOto: S.so(undefined, 0, 100) }),
    }),
    chay: async (v, ng) => {
      kiemSua(ng);
      const f = (v.fields ?? {}) as Record<string, number | null>;
      const moi: Partial<ThongSoHam> = {};
      for (const [k, x] of Object.entries(f)) {
        if (k === 'dtXeMay') { if (x !== null && x < 0) throw new LoiCongCu('dtXeMay ≥ 0 hoặc null.'); moi.dtXeMay = x; continue; }
        const g = HAM_SO[k];
        if (!g) throw new LoiCongCu(`Trường hầm "${k}" không có. Có: ${[...Object.keys(HAM_SO), 'dtXeMay'].join(', ')}.`);
        if (x === null) throw new LoiCongCu(`${k} không được null.`);
        if (g.nguyen && !Number.isInteger(x)) throw new LoiCongCu(`${k} phải là số nguyên.`);
        if ((g.min !== undefined && x < g.min) || (g.max !== undefined && x > g.max)) throw new LoiCongCu(`${k} trong khoảng ${g.min ?? '−∞'}…${g.max ?? '∞'}.`);
        (moi as Record<string, number>)[k] = g.phanTram ? x / 100 : x;
      }
      if (v.garaCoKhi !== undefined) moi.garaCoKhi = v.garaCoKhi as boolean;
      if (v.auto_rooms !== undefined) moi.tuDongPhong = v.auto_rooms as boolean;
      if (v.auto_accessible !== undefined) moi.xeLanTuDong = v.auto_accessible as boolean;
      const LOAI_PHONG = ['beSH', 'bomSH', 'bePCCC', 'bomPCCC', 'xlnt', 'vanHanhXlnt', 'tba', 'mayPhat', 'baoVe', 'trucPCCC', 'dienNhe', 'khoVatTu', 'quatHut', 'quatCap', 'rac'];
      const rooms = (v.rooms ?? null) as Record<string, { dt?: number | null; bo?: boolean }> | null;
      if (rooms) for (const k of Object.keys(rooms)) if (!LOAI_PHONG.includes(k)) throw new LoiCongCu(`Loại phòng "${k}" không có. Có: ${LOAI_PHONG.join(', ')}.`);
      const tyLe: { doXe: number; kyThuat: number } | null = null;
      suaPA(ng, (p) => {
        const h = chuanHoaHam(p.ham);
        const ram = v.ram ? { ...h.ram, ...(v.ram as object) } : h.ram;
        const xeDien = v.ev ? { ...h.xeDien, ...(v.ev as object) } : h.xeDien;
        const phong = rooms ? { ...h.phong, ...Object.fromEntries(Object.entries(rooms).map(([k, x]) => [k, { ...h.phong?.[k], ...x }])) } : h.phong;
        return { ...p, ham: { ...h, ...moi, ram, xeDien, phong, tangXeMay: Math.min(moi.tangXeMay ?? h.tangXeMay, moi.soTang ?? h.soTang) }, ...(tyLe ? { phanHam: tyLe } : {}) };
      });
      const h = chuanHoaHam(ng.kho.lay().ham);
      if (ng.ui.lay().tangHam > h.soTang) ng.ui.dat({ tangHam: h.soTang });
      return { ham: { soTang: h.soTang, caoTang: h.caoTang, lui: h.lui, nhip: h.nhip, choDai: h.choDai, choRong: h.choRong, rongLan: h.rongLan, tyLeKyThuat: h.tyLeKyThuat, ram: h.ram.loai }, ...(tyLe ? { phan_ham: tyLe } : {}), buoc_hoan_tac: buocHoanTac(ng), goi_y: 'gọi get_basement để xem số chỗ đỗ sau khi rải lại' };
    },
  },
  {
    ten: 'update_cost', nhom: 'khac', sua: true,
    moTa: 'Sửa thông số chi phí (tab Chi phí; đều là số tạm chờ QS chốt), một bước hoàn tác: unit_prices (đ/đơn vị theo dòng ngam, coc, ketCau, hoanThien, cua, haTang, thangMay, pccc, me), adjustments {xd, tb} (% −75…200), other {xd, tb} (đ), rates {qlda, tuVan, khac, duPhongKL, duPhongTruotGia} (%), qlda_tt38 (bool, tự tra TT 38/2026), sale {can {stu,1pn,2pn,2pnp,3pn} đ/m² TT, tangMoiTang, soTangThap, tangThap, tangTren, oTo, xeMay, thuongMai, tyLeBanDe, phatLech, chiPhiDat, banHang}.',
    schema: S.doiTuong({
      unit_prices: { type: 'object', additionalProperties: { type: 'number', minimum: 0 } },
      adjustments: S.doiTuong({ xd: S.so(undefined, -75, 200), tb: S.so(undefined, -75, 200) }),
      other: S.doiTuong({ xd: S.so(undefined, 0), tb: S.so(undefined, 0) }),
      rates: S.doiTuong({ qlda: S.so(undefined, 0), tuVan: S.so(undefined, 0), khac: S.so(undefined, 0), duPhongKL: S.so(undefined, 0), duPhongTruotGia: S.so(undefined, 0) }),
      qlda_tt38: S.bool(),
      sale: { type: 'object', additionalProperties: true },
    }),
    chay: (v, ng) => {
      const cu = chuanHoaChiPhi(ng.kho.lay().chiPhi);
      const dg = (v.unit_prices ?? {}) as Record<string, number>;
      for (const k of Object.keys(dg)) if (!(k in cu.donGia)) throw new LoiCongCu(`Dòng đơn giá "${k}" không có. Có: ${Object.keys(cu.donGia).join(', ')}.`);
      const ban = (v.sale ?? {}) as Record<string, unknown>;
      for (const [k, x] of Object.entries(ban)) {
        if (!(k in cu.ban)) throw new LoiCongCu(`Giá bán "${k}" không có. Có: ${Object.keys(cu.ban).join(', ')}.`);
        if (k === 'can') { for (const [l, g] of Object.entries(x as object)) if (!(l in cu.ban.can) || typeof g !== 'number' || g < 0) throw new LoiCongCu(`sale.can.${l} không hợp lệ.`); }
        else if (typeof x !== 'number' || !Number.isFinite(x)) throw new LoiCongCu(`sale.${k} phải là số.`);
      }
      suaCP(ng, (c) => ({
        ...c,
        donGia: { ...c.donGia, ...dg },
        dieuChinh: { ...c.dieuChinh, ...((v.adjustments ?? {}) as object) },
        khac: { ...c.khac, ...((v.other ?? {}) as object) },
        tyLe: { ...c.tyLe, ...((v.rates ?? {}) as object) },
        ...(v.qlda_tt38 !== undefined ? { qldaTT38: v.qlda_tt38 as boolean } : {}),
        ban: { ...c.ban, ...(ban as object), can: { ...c.ban.can, ...((ban.can ?? {}) as object) } },
      }));
      return { ok: true, buoc_hoan_tac: buocHoanTac(ng), goi_y: 'gọi get_cost để xem tổng mức / lợi nhuận mới' };
    },
  },
  {
    ten: 'manage_pa', nhom: 'khac', sua: true,
    moTa: 'Phương án (PA) của dự án trên máy chủ: duplicate (nhân bản pa_id), rename (pa_id + name), create (PA trống mới, name), delete (pa_id — HỎI người dùng xác nhận trên giao diện trước khi xoá), open (mở PA khác — trang tải lại, cuộc trò chuyện dừng; chỉ dùng khi người dùng muốn chuyển).',
    schema: S.doiTuong({ action: S.chon(['duplicate', 'rename', 'create', 'delete', 'open']), pa_id: S.chu(), name: S.chu() }, ['action']),
    chay: async (v, ng) => {
      const api = ng.paApi;
      if (!api) throw new LoiCongCu('Không quản lý PA được ở chế độ này.');
      const ds = ng.duAn.dsPA();
      const id = v.pa_id as string | undefined;
      const can = () => { if (!id || !ds.some((p) => p.id === id)) throw new LoiCongCu(`Không có PA "${id ?? ''}". PA: ${ds.map((p) => `${p.id} (${p.ten})`).join(', ')}.`); return id; };
      if (v.action === 'open') { const x = can(); api.mo(x); return { ok: true, ghi_chu: 'đang mở PA khác — trang sẽ tải lại' }; }
      if (!ng.duAn.coMaSua) throw new LoiCongCu('Dự án mở không có mã sửa — không quản lý PA được.');
      switch (v.action) {
        case 'duplicate': return { ok: true, pa_moi: await api.nhanBan(can()) };
        case 'rename': { const x = can(); const ten = String(v.name ?? '').trim(); if (!ten) throw new LoiCongCu('Thiếu name.'); await api.doiTen(x, ten); return { ok: true }; }
        case 'create': return { ok: true, pa_moi: await api.taoMoi(String(v.name ?? '').trim() || 'PA mới') };
        default: {
          const x = can();
          if (x === ng.duAn.paId) throw new LoiCongCu('Không xoá PA đang mở — mở PA khác trước.');
          const ten = ds.find((p) => p.id === x)!.ten;
          if (!(await ng.xacNhan(`Xoá phương án "${ten}"? Không hoàn tác được.`))) throw new LoiCongCu('Người dùng không đồng ý xoá.');
          await api.xoa(x);
          return { ok: true, da_xoa: x };
        }
      }
    },
  },
  {
    ten: 'export_file', nhom: 'khac',
    moTa: 'Xuất tệp: xls (báo cáo Excel PA — tải tệp xuống, HỎI người dùng xác nhận trước) hoặc cad (mở hộp Xuất CAD của tòa đang xem; người dùng tự bấm tải trong hộp).',
    schema: S.doiTuong({ kind: S.chon(['xls', 'cad']) }, ['kind']),
    chay: async (v, ng) => {
      if (!ng.xuat) throw new LoiCongCu('Không xuất được ở chế độ này.');
      if (v.kind === 'cad') { if (!ng.xuat.moCad()) throw new LoiCongCu('Chưa có tòa để xuất CAD.'); return { ok: true, ghi_chu: 'đã mở hộp Xuất CAD — người dùng chọn tầng và bấm tải' }; }
      if (!(await ng.xacNhan('Tải tệp Excel báo cáo phương án về máy?'))) throw new LoiCongCu('Người dùng không đồng ý tải tệp.');
      await ng.xuat.xls();
      return { ok: true, ghi_chu: 'đã tải tệp Excel' };
    },
  },
  {
    ten: 'undo', nhom: 'khac', sua: true,
    moTa: 'Hoàn tác (Ctrl+Z) `steps` bước (mặc định 1) — cùng ngăn hoàn tác với người dùng.',
    schema: S.doiTuong({ steps: S.nguyen(undefined, 1, 50) }),
    chay: (v, ng) => {
      kiemSua(ng);
      let n = 0;
      for (let i = 0; i < ((v.steps as number) ?? 1); i++) if (ng.kho.hoanTac()) n++; else break;
      if (!n) throw new LoiCongCu('Không còn bước để hoàn tác.');
      return { da_hoan_tac: n, con: ng.kho.soBuoc() };
    },
  },
  {
    ten: 'redo', nhom: 'khac', sua: true,
    moTa: 'Làm lại (Ctrl+Y) `steps` bước.',
    schema: S.doiTuong({ steps: S.nguyen(undefined, 1, 50) }),
    chay: (v, ng) => {
      kiemSua(ng);
      let n = 0;
      for (let i = 0; i < ((v.steps as number) ?? 1); i++) if (ng.kho.lamLai()) n++; else break;
      if (!n) throw new LoiCongCu('Không còn bước để làm lại.');
      return { da_lam_lai: n, con: ng.kho.soBuoc() };
    },
  },
  {
    ten: 'ui_snapshot', nhom: 'ui',
    moTa: 'Lối dự phòng: liệt kê các nút / ô nhập / tab đang HIỆN trên giao diện (id ổn định, vai trò, nhãn, giá trị, vùng top/left/center/right/dialog/dock). Chỉ dùng khi không có công cụ riêng cho việc cần làm.',
    schema: S.doiTuong({ region: S.chon(['all', 'top', 'left', 'center', 'right', 'dialog', 'dock']), query: S.chu('lọc theo chữ trong nhãn') }),
    chay: (v, ng) => {
      if (!ng.dom) throw new LoiCongCu('Không có giao diện.');
      const q = ((v.query as string) ?? '').toLowerCase();
      const ds = ng.dom.chup((v.region as string) ?? 'all').filter((m) => !q || m.nhan.toLowerCase().includes(q));
      return { so: ds.length, muc: ds.slice(0, 120) };
    },
  },
  {
    ten: 'ui_click', nhom: 'ui', sua: true,
    moTa: 'Bấm một nút / tab / ô chọn theo id từ ui_snapshot, như người dùng bấm. Nút tải tệp / xoá sẽ hỏi người dùng xác nhận.',
    schema: S.doiTuong({ id: S.chu() }, ['id']),
    chay: async (v, ng) => {
      if (!ng.dom) throw new LoiCongCu('Không có giao diện.');
      return { ok: true, ket_qua: await ng.dom.bam(v.id as string), buoc_hoan_tac: buocHoanTac(ng) };
    },
  },
  {
    ten: 'ui_set_value', nhom: 'ui', sua: true,
    moTa: 'Nhập giá trị vào ô nhập / chọn (select) / hộp kiểm theo id từ ui_snapshot (như gõ rồi rời ô).',
    schema: S.doiTuong({ id: S.chu(), value: { type: 'string', description: 'giá trị (chuỗi; hộp kiểm: "true"/"false")' } }, ['id', 'value']),
    chay: async (v, ng) => {
      if (!ng.dom) throw new LoiCongCu('Không có giao diện.');
      const gt = v.value === 'true' ? true : v.value === 'false' ? false : (v.value as string);
      return { ok: true, ket_qua: await ng.dom.datGiaTri(v.id as string, gt), buoc_hoan_tac: buocHoanTac(ng) };
    },
  },
];

