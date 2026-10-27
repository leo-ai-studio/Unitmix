import { describe, expect, it } from 'vitest';
import { docDeBai, loaiTheoNhan } from './deBaiKD';
import { luoiTuChuDan } from './docExcel';

describe('đề bài unitmix của kinh doanh', () => {
  it('nhận nhãn loại căn', () => {
    expect(['Studio', '1PN', '1 PN + 1', '2 phòng ngủ', '2PN+1', '2PN + 1', '3PN', '4PN', 'Tổng'].map(loaiTheoNhan))
      .toEqual(['stu', '1pn', '1pn', '2pn', '2pnp', '2pnp', '3pn', '3pn', null]);
  });
  it('bảng dán có tiêu đề: tỷ lệ, số căn, DT', () => {
    const d = docDeBai(luoiTuChuDan('Loại căn\tTỷ lệ\tSố căn\tDT thông thủy (m2)\nStudio\t5%\t50\t30,5\n1PN\t20%\t200\t45\n2PN\t45%\t450\t65\n2PN+1\t15%\t150\t75\n3PN\t15%\t150\t90\nTổng\t100%\t1000\t'));
    expect(d.coCau).toEqual({ stu: 5, '1pn': 20, '2pn': 45, '2pnp': 15, '3pn': 15 });
    expect(d.dong.map((x) => x.dtCan)).toEqual([30.5, 45, 65, 75, 90]);
    expect(d.dong.map((x) => x.soCan)).toEqual([50, 200, 450, 150, 150]);
    expect(d.canhBao).toEqual([]);
  });
  it('tỷ lệ dạng 0,35 nhân 100; chỉ có số căn thì suy tỷ lệ; 3PN + 4PN gộp', () => {
    expect(docDeBai([['Loại', 'Tỷ lệ'], ['1PN', 0.3], ['2PN', 0.7]]).coCau).toMatchObject({ '1pn': 30, '2pn': 70 });
    const d = docDeBai([['Loại căn', 'Số lượng'], ['2PN', 60], ['3PN', 30], ['4PN', 10]]);
    expect(d.coCau).toMatchObject({ '2pn': 60, '3pn': 40 });
    expect(d.canhBao).toEqual(['"4PN" xếp vào 3PN']);
  });
  it('không có tiêu đề: ô % là tỷ lệ, số lẻ là DT', () => {
    const d = docDeBai(luoiTuChuDan('1PN\t40%\t48,5\n2PN\t60%\t68,2'));
    expect(d.dong.map((x) => [x.loai, x.tyLe, x.dtCan])).toEqual([['1pn', 40, 48.5], ['2pn', 60, 68.2]]);
  });
  it('báo khi tổng khác 100 % hoặc không có dòng nào', () => {
    expect(docDeBai([['Loại', 'Tỷ lệ'], ['1PN', 30]]).canhBao).toEqual(['tổng tỷ lệ 30.0 % (khác 100 %)']);
    expect(docDeBai([['abc']]).canhBao).toEqual(['không nhận được dòng loại căn nào']);
  });
});
