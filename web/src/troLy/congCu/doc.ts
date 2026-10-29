/** Công cụ ĐỌC + ĐIỀU HƯỚNG của Leo AI: chỉ trả số gọn (tiết kiệm token), không sửa PA. */
import { ketQua as ketQuaChiPhi } from '../../man/ManChiPhi';
import { mauToa } from '../../tinh/canThem';
import { tinhChiTieu } from '../../tinh/chiTieu';
import { danSoDuAn } from '../../tinh/danSo';
import { chiSoPA, diemLechPA } from '../../tinh/diemPA';
import { raiHam } from '../../tinh/ham';
import { hopLo, vungDat } from '../../tinh/hopLo';
import { LOAI_CAN, type LoaiCan, type ThuVien, type TrangThaiPA } from '../../tinh/kieu';
import { kpiTang, kpiTmb, loDuAn, sanToa } from '../../tinh/kpi';
import { laCaoTang } from '../../tinh/loaiDat';
import { coCauRiengTang, ungVienDoi, ungVienKhacRong } from '../../tinh/matBang';
import { kiemQCVN04 } from '../../tinh/qcvn04';
import { QUY_TAC_DAN_SO } from '../../tinh/quyTacDanSo';
import { hinhToa, kiemViPham } from '../../tinh/thaoTacToa';
import { tomTatPA } from '../../tinh/tomTat';
import { chieuCaoPCCC } from '../../tinh/pccc';
import { phanTichPCCCTang, soLieuToaPCCC } from '../../tinh/pcccTang';
import { S, type CongCu } from './dinhNghia';
import { canTV, LoiCongCu, timLo, timToa, tron, type NguCanh } from './nguCanh';
import { dungTang, tangHopLe, timO, tomTatTang } from './tangChung';

const pct = (r: Record<LoaiCan, number>) => Object.fromEntries(LOAI_CAN.map((k) => [k, tron(r[k], 1)]));
const tenMau = (tv: ThuVien, id: string) => tv.toa.get(id)?.ten_vi ?? id;

/** Tóm tắt trạng thái chung — dùng cả cho get_state và ngữ cảnh gửi kèm mỗi câu hỏi. */
export function tomTatTrangThai(ng: NguCanh, chiTiet = true) {
  const pa = ng.kho.lay();
  const tv = ng.tv();
  const ui = ng.ui.lay();
  const tt = tv ? tomTatPA(pa, tv) : null;
  return {
    du_an: { ma: ng.duAn.ma, ten: ng.duAn.ten },
    pa: { id: ng.duAn.paId, ten: ng.duAn.tenPA, ds: ng.duAn.dsPA() },
    che_do: ng.chiXem() ? 'chi_xem' : 'sua_duoc',
    hoan_tac: ng.kho.soBuoc(),
    man_hinh: { buoc: ui.buoc, xem: ui.xem, lo: ui.loId, toa: ui.toaId, tang: ui.tangs, can: ui.canKhoa, tang_ham: ui.tangHam },
    tong: tt ? { so_can: tt.soCan, co_cau: tt.coCau, dt_san_m2: tron(tt.dtSan, 0) } : null,
    lo: pa.lo.map((l) => ({
      id: l.id, ky_hieu: l.temDat.kyHieu, chuc_nang: l.temDat.chucNang, cao_tang: laCaoTang(l),
      ...(chiTiet ? {
        chi_tieu: l.temDat.chiTieu, co_cau_muc_tieu: l.temDat.coCauMucTieu,
        so_canh: l.ranh.length, canh_duong: l.canhDuong ?? 'mac_dinh_12m_moi_canh', dan_so: l.temDat.danSo ?? null,
      } : {}),
      toa: pa.toa.filter((x) => x.loId === l.id).map((x) => ({
        id: x.id, mau: x.mauId, ...(chiTiet && tv ? { ten: tenMau(tv, x.mauId), so_can: sanToa(tv, x).soCan } : {}),
        x: tron(x.x), y: tron(x.y), goc: tron(x.gocDo, 1), tang_dh: x.soTangDH, tang_de: x.soTangDe, ...(x.khoa ? { khoa: true } : {}), ...(x.lat ? { lat: true } : {}),
      })),
    })),
  };
}

export const CONG_CU_DOC: CongCu[] = [
  {
    ten: 'get_state', nhom: 'doc',
    moTa: 'Đọc trạng thái hiện tại: dự án, phương án (PA), màn hình / lựa chọn đang xem, chế độ sửa, các lô (chỉ tiêu QH, cơ cấu mục tiêu, lộ giới) và tòa (id, mẫu, vị trí m, góc, số tầng). Gọi trước khi sửa.',
    schema: S.doiTuong({ gon: S.bool('true = bỏ chỉ tiêu chi tiết từng lô (ít token hơn)') }),
    chay: (v, ng) => tomTatTrangThai(ng, v.gon !== true),
  },
  {
    ten: 'get_kpi', nhom: 'doc',
    moTa: 'KPI lãnh đạo như panel phải: scope "project" (mọi lô cao tầng), "lot" (một lô) hoặc "floor" (một tầng của một tòa: cơ cấu tầng / tòa, hiệu suất, DTXD, DTSD). Gồm dân số, số căn, DT sàn tính HSSDĐ so trần, MĐXD, hiệu suất, chỉ tiêu QH từng dòng, cơ cấu % so mục tiêu.',
    schema: S.doiTuong({
      scope: S.chon(['project', 'lot', 'floor']),
      lot_id: S.chu('id hoặc ký hiệu lô (scope lot)'),
      tower_id: S.chu('id tòa (scope floor)'),
      floor: { ...S.nguyen('tầng điển hình 1..soTangDH; bỏ trống = điển hình chung', 1), nullable: true },
    }, ['scope']),
    chay: (v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      const kq = tinhChiTieu(pa, tv);
      if (v.scope === 'floor') {
        const toa = timToa(pa, v.tower_id as string);
        const k = tangHopLe(toa, v.floor)?.[0] ?? null;
        return ng.dl(pa).then((dl) => {
          const { sl } = dungTang(tv, dl, toa, k);
          const lo = pa.lo.find((l) => l.id === toa.loId);
          const muc = coCauRiengTang(toa, k) ?? lo?.temDat.coCauMucTieu ?? { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0 };
          const kt = kpiTang(pa, tv, toa, lo, k, sl.can.map((c) => ({ canId: c.canId, cn: c.cn as never })), muc);
          return {
            toa: toa.id, tang: k ?? 'dien_hinh', so_can_tang: kt.soCanTang, so_can_toa: kt.soCanToa, so_tang: kt.soTang,
            dan_toa: tron(kt.danToa, 0), dtxd_m2: tron(kt.dtxd, 1), dtsd_m2: tron(kt.dtsd, 1), hieu_suat: tron(kt.hieuSuat.gt, 3), hieu_suat_toa: tron(kt.hieuSuatToa, 3),
            co_cau: Object.fromEntries(LOAI_CAN.map((l) => [l, { tang: kt.theoLoai[l].nTang, toa: kt.theoLoai[l].nToa, pct: tron(kt.theoLoai[l].pct, 1), muc_tieu: kt.theoLoai[l].mucTieu, lech: tron(kt.theoLoai[l].lech, 1) }])),
          };
        });
      }
      const ids = v.scope === 'lot' ? [timLo(pa, v.lot_id as string).id] : loDuAn(pa);
      const k = kpiTmb(pa, tv, kq, ids);
      const o = (x: { gt: number | null; nguong: number | null; tt: string | null }, n = 1) => ({ gt: tron(x.gt, n), nguong: tron(x.nguong, n), tt: x.tt });
      return {
        so_lo: k.soLo, dan_so: o(k.danSo, 0), so_can: o(k.soCan, 0), dt_san_hssdd_m2: o(k.dtSan, 0), dtsd_m2: tron(k.dtsd, 0), dtxd_1san_m2: tron(k.dtxd1San, 0),
        mat_do_pct: o(k.matDo), hieu_suat: o(k.hieuSuat, 3),
        co_cau_pct: v.scope === 'lot' ? pct(kq.theoLo[ids[0]]?.coCauPct ?? kq.tong.coCauPct) : pct(kq.tong.coCauPct),
        co_cau_so: v.scope === 'lot' ? kq.theoLo[ids[0]]?.coCau : kq.tong.coCau,
        lech_co_cau: tron(diemLechPA(pa, kq), 1),
        chi_tieu_lo: Object.fromEntries(ids.map((id) => [id, (kq.theoLo[id]?.dong ?? []).map((d) => ({ k: d.khoa, dat: tron(d.dat, 2), gioi_han: tron(d.mucTieu, 2), chieu: d.chieu, muc: d.muc }))])),
        toa: k.toa.map((x) => ({ id: x.toaId, so_can: x.soCan, tang: x.soTang, dan: tron(x.dan, 0), hieu_suat: tron(x.hieuSuat, 3) })),
      };
    },
  },
  {
    ten: 'get_floor_plan', nhom: 'doc',
    moTa: 'Mặt bằng một tầng của tòa: từng ô (nhãn CH-xx, key "mặt:phần tử", unit_id mẫu căn, loại stu/1pn/2pn/2pnp/3pn, DT thông thủy, bề ngang, công năng) và thang bộ (key, N2/N3). Dùng key hoặc CH-xx cho các công cụ sửa tầng.',
    schema: S.doiTuong({ tower_id: S.chu('id tòa'), floor: { ...S.nguyen('tầng điển hình 1..soTangDH; bỏ trống = điển hình chung', 1), nullable: true } }, ['tower_id']),
    chay: async (v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      const toa = timToa(pa, v.tower_id as string);
      const k = tangHopLe(toa, v.floor)?.[0] ?? null;
      const dl = await ng.dl(pa);
      return { toa: toa.id, mau: toa.mauId, so_tang_dh: toa.soTangDH, tang_rieng: Object.keys(toa.tangRieng ?? {}).map(Number), ...tomTatTang(tv, dl, toa, k) };
    },
  },
  {
    ten: 'list_templates', nhom: 'doc',
    moTa: 'Thư viện: mẫu tòa (id, tên, nhóm tm/xh, căn/tầng, DTXD; với lot_id thì kèm "vua" = đặt vừa trong chỉ giới lô) hoặc mẫu căn (id, loại, DT, bề ngang; with unit_id thì liệt kê mẫu đổi được cùng bề ngang / khác bề ngang).',
    schema: S.doiTuong({
      kind: S.chon(['towers', 'units']),
      group: S.chon(['tm', 'xh'], 'tm = thương mại, xh = nhà ở xã hội'),
      lot_id: S.chu('lô để kiểm mẫu tòa vừa chỉ giới'),
      unit_type: S.chon(['stu', '1pn', '2pn', '2pnp', '3pn']),
      unit_id: S.chu('mẫu căn đang dùng ở ô — liệt kê mẫu đổi được'),
    }, ['kind']),
    chay: (v, ng) => {
      const tv = canTV(ng), pa = ng.kho.lay();
      if (v.kind === 'towers') {
        const lo = v.lot_id ? timLo(pa, v.lot_id as string) : null;
        return [...tv.toa.values()].filter((m) => !v.group || m.nhom === v.group).map((m) => ({
          id: m.id, ten: m.ten_vi, nhom: m.nhom, can_tang: m.so_can_tang, dtxd_m2: tron(m.dtxd_m2, 0), co_cau: m.co_cau,
          ...(lo ? { vua: hopLo(m, vungDat(lo)).hop } : {}),
        }));
      }
      if (v.unit_id) {
        const cur = tv.can.get(v.unit_id as string);
        if (!cur) throw new LoiCongCu(`Không có mẫu căn "${v.unit_id}".`);
        const ra = (ds: { id: string; loai: string; dt_tt_m2: number; rong_mm: number }[]) => ds.map((c) => ({ id: c.id, loai: c.loai, dt: tron(c.dt_tt_m2, 1), rong_mm: c.rong_mm }));
        return { hien_tai: { id: cur.id, loai: cur.loai, rong_mm: cur.rong_mm }, cung_be_ngang: ra(ungVien(tv, cur.id, true)), khac_be_ngang: ra(ungVien(tv, cur.id, false)) };
      }
      return [...tv.can.values()].filter((c) => !c.id.includes('~') && (!v.group || c.nhom === v.group) && (!v.unit_type || c.loai === v.unit_type))
        .map((c) => ({ id: c.id, loai: c.loai, nhom: c.nhom, dt: tron(c.dt_tt_m2, 1), rong_mm: c.rong_mm, sau_mm: c.sau_mm, vi_tri: c.vi_tri }));
    },
  },
  {
    ten: 'check_rules', nhom: 'doc',
    moTa: 'Kiểm tuân thủ: chỉ tiêu QH từng lô (MĐXD, HSSDĐ, tầng cao, số căn, dân số, chỗ đỗ, cây xanh), TMB (LO-01 khoảng lùi theo lộ giới, LO-02 / QCVN 01 §2.6.1 khoảng cách giữa tòa, LO-05 tòa ra ngoài chỉ giới), QCVN 04 từng tòa, quy tắc thang bộ (≥ 2 thang, một N2 + một N3, tối đa 3), PCCC tầng điển hình (số thang máy QCVN 04 2.4.1–2.4.2, thang máy chữa cháy + bán kính 60 / 45 m QCVN 06 6.13 / A.2.12, họng chờ 45 m QCVN 04 2.5.3, tủ họng nước R 18 m, chia khoang hành lang 60 / 30 m, thoát nạn — chỉ cảnh báo). Chỉ trả mục chưa đạt khi only_problems = true.',
    schema: S.doiTuong({ only_problems: S.bool('mặc định true') }),
    chay: async (v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      const loi = v.only_problems !== false;
      const kq = tinhChiTieu(pa, tv);
      const luat = await ng.luat();
      const kv = kiemViPham(pa, hinhToa(pa, tv), luat);
      const dl = await ng.dl(pa);
      const toa = pa.toa.map((x) => {
        const m = mauToa(tv, x);
        const q4 = m ? kiemQCVN04(pa, x, m, tv).filter((r) => !loi || (r.trangThai !== 'dat' && r.trangThai !== 'bo_qua')).map((r) => ({ id: r.id, tt: r.trangThai, can_cu: r.canCu, ...r.tham })) : [];
        let thang: { so: number; n2: number; n3: number } | null = null;
        let pccc: { id: string; muc: string; [k: string]: unknown }[] = [];
        try {
          const dt = dungTang(tv, dl, x, null), t = dt.thang;
          thang = { so: t.length, n2: t.filter((q) => q.loai === 'N2').length, n3: t.filter((q) => q.loai === 'N3').length };
          // PCCC + thang máy tầng điển hình (tinh/pcccTang.ts): mọi mục chỉ cảnh báo
          const sl = soLieuToaPCCC(pa, tv, x);
          const p = phanTichPCCCTang({ mau: dt.mau, bc: dt.bc, tv, dl, H: chieuCaoPCCC(x.soTangDe, x.caoDe, x.soTangDH, x.caoDH), soTangDH: x.soTangDH,
            soTangNoi: x.soTangDe + x.soTangDH, soCanToa: sl.soCan, danToa: sl.dan, tuTay: x.tuPCCCTay ?? null });
          pccc = [
            { id: 'thang_may_QCVN04_2.4.1_2.4.2', muc: p.thangMay.muc, co: p.thangMay.co, can: p.thangMay.can, theo_can: p.thangMay.theoCan, theo_dan: p.thangMay.theoDan },
            { id: `thang_chua_chay_${p.tmcc.canCu.replace('QCVN 06:2022 ', 'QCVN06_')}`, muc: p.tmcc.muc, ban_kinh_m: p.tmcc.r, so_chon: p.tmcc.chon.length, xa_nhat_m: tron(p.tmcc.xaNhat ?? 0), diem_ngoai: p.tmcc.ngoai.length },
            { id: 'hong_cho_45m_QCVN04_2.5.3', muc: p.hongCho.muc, xa_nhat_m: tron(p.hongCho.xaNhat ?? 0), can_vuot: p.hongCho.vuot },
            { id: 'tu_hong_nuoc_R18_QT77', muc: p.tu.muc, so_tu: p.tu.viTri.length, can_chua_phu: p.tu.thieu },
            { id: `chia_hanh_lang_${p.hanhLang.gioiHan}m`, muc: p.hanhLang.muc, can_cu: p.hanhLang.canCu, so_cua: p.hanhLang.cua.length, khoang_max_m: tron(Math.max(0, ...p.hanhLang.khoang)) },
            { id: 'thoat_nan', muc: p.thoatNan.soVuot ? 'canh_bao' : 'ok', can_vuot: p.thoatNan.soVuot, cut_m: p.thoatNan.cut, doi_m: p.thoatNan.doi },
          ].filter((r) => !loi || (r.muc !== 'ok' && r.muc !== 'khong_ap'));
        } catch { /* mẫu không có mặt bằng */ }
        const thangLoi = thang ? thang.so < 2 || thang.so > 3 || !thang.n2 || !thang.n3 : false;
        return { id: x.id, qcvn04: q4, ...(thang && (!loi || thangLoi) ? { thang_bo: { ...thang, dat: !thangLoi } } : {}), ...(pccc.length ? { pccc } : {}) };
      }).filter((x) => !loi || x.qcvn04.length || x.thang_bo || x.pccc);
      return {
        chi_tieu_lo: Object.fromEntries(Object.entries(kq.theoLo).map(([id, r]) => [id, r.dong.filter((d) => !loi || d.muc !== 'ok').map((d) => ({ k: d.khoa, dat: tron(d.dat), gioi_han: tron(d.mucTieu), chieu: d.chieu, muc: d.muc }))])),
        tmb: {
          ngoai_chi_gioi_LO05: [...kv.ngoai],
          lui_LO01: kv.lui.map((x) => ({ toa: x.toaId, kc_m: tron(x.kc), can_m: tron(x.can), canh: x.canh, lo_gioi_m: x.rong })),
          khoang_cach_LO02: kv.cap.map((x) => ({ a: x.a, b: x.b, kc_m: tron(x.kc), can_m: tron(x.hoi), muc: x.muc })),
          ...(luat ? {} : { ghi_chu: 'chưa tải luật LO-01/02' }),
        },
        toa,
      };
    },
  },
  {
    ten: 'get_cost', nhom: 'doc',
    moTa: 'Dự toán + tài chính như tab Chi phí (đơn vị đồng): tổng mức đầu tư (chưa gồm đất), XD, TB, QLDA, tư vấn, dự phòng, suất / m² và / căn; doanh thu, chi phí, lợi nhuận, biên LN, giá BQ, giá hòa vốn. Kèm thông số đơn giá đang dùng (đều là SỐ TẠM chờ QS chốt).',
    schema: S.doiTuong({ include_settings: S.bool('kèm đơn giá / tỷ lệ / giá bán đang dùng') }),
    chay: (v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      const r = ketQuaChiPhi(pa, tv, tinhChiTieu(pa, tv));
      return {
        so_tam: true, dang_rai_ham: r.dangRai,
        du_toan: { tong_muc: tron(r.dt.tongMuc, 0), xd: tron(r.dt.xd, 0), tb: tron(r.dt.tb, 0), qlda: tron(r.dt.qlda, 0), tu_van: tron(r.dt.tuVan, 0), khac: tron(r.dt.khac, 0),
          du_phong: tron(r.dt.duPhongKL + r.dt.duPhongTruotGia, 0), suat_m2: tron(r.dt.suatM2, 0), suat_can: tron(r.dt.suatCan, 0) },
        khoi_luong: { dt_san_m2: tron(r.kl.tong.dtSanTong, 0), so_can: r.kl.tong.tongCan, dt_tt_m2: tron(r.kl.tong.dtTT, 0), cho_oto: r.kl.tong.soChoOto, so_thang: r.kl.tong.soThang },
        tai_chinh: { doanh_thu: tron(r.tc.doanhThu, 0), tong_chi_phi: tron(r.tc.tongChiPhi, 0), loi_nhuan: tron(r.tc.loiNhuan, 0), bien_ln_pct: tron(r.tc.bienLN, 1), gia_bq: tron(r.tc.giaBQ, 0), gia_hoa_von: tron(r.tc.giaHoaVon, 0) },
        ...(v.include_settings ? { thong_so: r.cp } : {}),
      };
    },
  },
  {
    ten: 'get_population', nhom: 'doc',
    moTa: 'Dân số từng lô theo QĐ tỉnh đã khai (hoặc hệ số người/căn): tổng người, số căn, phương pháp, căn cứ, theo loại căn và loại hình (NOTM/NOXH/TĐC). Kèm danh sách mã tỉnh khai được.',
    schema: S.doiTuong({}),
    chay: (_v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      const d = danSoDuAn(pa, tv);
      return {
        tong: tron(d.tong, 0), so_can: d.soCan,
        theo_lo: Object.fromEntries(Object.entries(d.theoLo).map(([id, r]) => [id, { tong: tron(r.tong, 0), so_can: r.soCan, khai: pa.lo.find((l) => l.id === id)?.temDat.danSo ?? null, phuong_phap: r.phuongPhap, can_cu: r.canCu, theo_loai: Object.fromEntries(LOAI_CAN.map((k) => [k, { so: r.theoLoai[k].so, nguoi: tron(r.theoLoai[k].nguoi, 1) }])) }])),
        tinh: QUY_TAC_DAN_SO.map((q) => ({ id: q.id, ten: q.ten, qd: q.qd })),
      };
    },
  },
  {
    ten: 'get_basement', nhom: 'doc',
    moTa: 'Kết quả rải hầm của một lô (như màn Hầm): thông số đang dùng, tổng DT sàn hầm, số chỗ ô tô / xe máy, kho, yêu cầu đỗ xe, các mục kiểm QCVN 13 / 04 chưa đạt.',
    schema: S.doiTuong({ lot_id: S.chu('mặc định lô đang chọn / lô cao tầng đầu tiên') }),
    chay: (v, ng) => {
      const pa = ng.kho.lay(), tv = canTV(ng);
      const lo = v.lot_id ? timLo(pa, v.lot_id as string) : pa.lo.find((l) => l.id === ng.ui.lay().loId) ?? pa.lo.find(laCaoTang);
      if (!lo) throw new LoiCongCu('Chưa có lô cao tầng.');
      const r = raiHam(pa, tv, lo);
      if (!r) return { lo: lo.id, ket_qua: null, ghi_chu: 'chưa rải được hầm (lô chưa có tòa / ranh)' };
      return {
        lo: lo.id, so_tang: r.ts.soTang, tong: { dt_san_m2: tron(r.tong.dtSan, 0), cho_oto: r.tong.soCho, xe_may_m2: tron(r.tong.dtXeMay, 0), kho: r.tong.soKho },
        yeu_cau: { oto: tron(r.yeuCau.tong, 0), xe_may: tron(r.yeuCau.xeMay, 0) }, ty_le: { do_xe: tron(r.tyLe.doXe, 3), ky_thuat: tron(r.tyLe.kyThuat, 3) },
        chua_dat: r.kiem.filter((k) => k.muc !== 'ok').map((k) => ({ k: k.khoa, dat: tron(k.dat), muc_tieu: tron(k.mucTieu), chieu: k.chieu, muc: k.muc, can_cu: k.canCu })),
        thong_so: { caoTang: r.ts.caoTang, nhip: r.ts.nhip, rongLan: r.ts.rongLan, choDai: r.ts.choDai, choRong: r.ts.choRong, lui: r.ts.lui, tyLeKyThuat: r.ts.tyLeKyThuat, ram: r.ts.ram.loai },
      };
    },
  },
  {
    ten: 'compare_pas', nhom: 'doc',
    moTa: 'So sánh các phương án (PA) của dự án như hộp So sánh PA: số căn, cơ cấu %, DT sàn, MĐXD, tầng cao, dân số, số luật vượt, độ lệch cơ cấu, tổng mức, lợi nhuận. Mặc định mọi PA (≤ 6).',
    schema: S.doiTuong({ pa_ids: S.ds(S.chu(), 'id các PA (≤ 6)') }),
    chay: async (v, ng) => {
      const tv = canTV(ng);
      const ids = ((v.pa_ids as string[] | undefined)?.length ? (v.pa_ids as string[]) : ng.duAn.dsPA().map((p) => p.id)).slice(0, 6);
      const ra = [];
      for (const id of ids) {
        let pa: TrangThaiPA, ten: string;
        if (id === ng.duAn.paId) { pa = ng.kho.lay(); ten = ng.duAn.tenPA; } else {
          if (!ng.paApi) throw new LoiCongCu('Không đọc được PA khác ở chế độ này.');
          ({ pa, ten } = await ng.paApi.doc(id));
        }
        const kq = tinhChiTieu(pa, tv);
        const c = chiSoPA(pa, kq), cp = ketQuaChiPhi(pa, tv, kq);
        ra.push({ id, ten, so_can: c.soCan, co_cau_pct: pct(c.coCauPct), dt_san_m2: tron(c.dtSan, 0), mat_do: tron(c.matDo, 1), tang_cao: c.tangCao, dan_so: tron(c.danSo, 0), luat_vuot: c.soLuatVuot, lech: tron(c.lech, 1), tong_muc: tron(cp.dt.tongMuc, 0), loi_nhuan: tron(cp.tc.loiNhuan, 0) });
      }
      return ra;
    },
  },
  {
    ten: 'navigate', nhom: 'dieu_huong',
    moTa: 'Đổi màn / chọn như người dùng bấm: screen tmb (Tổng mặt bằng) / tang (mặt bằng tầng) / ham (hầm); view 2d / 3d / cost (tab Chi phí); chọn lô, tòa, tầng điển hình, ô căn (key hoặc CH-xx), tầng hầm. Mở sang màn Tầng cần tower_id.',
    schema: S.doiTuong({
      screen: S.chon(['tmb', 'tang', 'ham']), view: S.chon(['2d', '3d', 'cost']),
      lot_id: S.chu(), tower_id: S.chu(),
      floor: { ...S.nguyen('tầng điển hình 1..soTangDH; null = điển hình chung', 1), nullable: true },
      cell: { ...S.chu('ô căn (key hoặc CH-xx) trên tầng đang chọn'), nullable: true },
      basement_floor: S.nguyen('tầng hầm 1..soTang', 1, 6),
    }),
    chay: async (v, ng) => {
      const pa = ng.kho.lay();
      const p: Partial<ReturnType<NguCanh['ui']['lay']>> = {};
      if (v.lot_id) { const lo = timLo(pa, v.lot_id as string); p.loId = lo.id; if (!v.tower_id) { p.toaId = null; p.canKhoa = null; } }
      if (v.tower_id) { const toa = timToa(pa, v.tower_id as string); p.loId = toa.loId; p.toaId = toa.id; p.canKhoa = null; }
      if (v.floor !== undefined) {
        const toa = timToa(pa, (v.tower_id as string) ?? ng.ui.lay().toaId ?? '');
        p.tangs = tangHopLe(toa, v.floor);
        p.canKhoa = null;
      }
      if (v.cell !== undefined) {
        if (v.cell === null) p.canKhoa = null;
        else {
          const toa = timToa(pa, (v.tower_id as string) ?? ng.ui.lay().toaId ?? '');
          const tv = canTV(ng), dl = await ng.dl(pa);
          const k = p.tangs !== undefined ? p.tangs?.[0] ?? null : ng.ui.lay().tangs?.[0] ?? null;
          p.canKhoa = timO(dungTang(tv, dl, toa, k).sl.can, v.cell as string).vt.khoa;
          p.buoc = 'tang';
        }
      }
      if (v.basement_floor !== undefined) { p.tangHam = v.basement_floor as number; p.buoc = 'ham'; }
      if (v.screen) {
        if (v.screen === 'tang' && !(p.toaId ?? ng.ui.lay().toaId) && !pa.toa.length) throw new LoiCongCu('Chưa có tòa nào — xếp tòa ở TMB trước.');
        p.buoc = v.screen as 'tmb' | 'tang' | 'ham';
      }
      if (v.view) p.xem = v.view === '3d' ? 'mo_hinh' : v.view === 'cost' ? 'chi_phi' : 'mat_bang';
      ng.ui.dat(p);
      return { ok: true, man_hinh: ng.ui.lay() };
    },
  },
  {
    ten: 'zoom_to_fit', nhom: 'dieu_huong',
    moTa: 'Vừa khung bản vẽ 2D đang xem (như nút Vừa khung).',
    schema: S.doiTuong({}),
    chay: (_v, ng) => {
      if (!ng.vuaKhung?.()) throw new LoiCongCu('Không thấy nút Vừa khung trên bản vẽ đang mở (3D / Chi phí không có).');
      return { ok: true };
    },
  },
];

/** Ứng viên đổi mẫu căn ở một ô: cùng bề ngang (`ungVienDoi`) hoặc khác bề ngang (`ungVienKhacRong`) như màn Tầng. */
export const ungVien = (tv: ThuVien, id: string, cungRong: boolean) => (cungRong ? ungVienDoi(id, tv) : ungVienKhacRong(id, tv));
