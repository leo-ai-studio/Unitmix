# Gửi đội CAD — khung `MDI-BAO-TM` của lõi thang lệch nét tường (2/10/2026)

Bóc lại toàn bộ thư viện sau đợt sửa tối 1/10 (34 căn · 26 lõi/thang · 33 mẫu tòa). Đợt sửa đã hết 6 lỗi
(z3 chồng lõi, lõi xh_z2 lệch 2.825 mm, điểm kéo hành lang xh_u1/xh_z1/xh_z3). Còn 9 lõi có khung
`MDI-BAO-TM` **không trùng** nét tường lõi (A-WALL / A-CONC). App xếp căn theo khung này, nên căn đè lên
tường lõi hoặc hở khe.

| Lõi (tòa) | Lệch | Khung `MDI-BAO-TM` so với nét tường (hệ toạ độ cục bộ của lõi) |
|---|---|---|
| `x_tmdv_i1_tm_09` (hn_tm_i1) | 215 mm | mép trái BAO-TM −8.700, tường −8.915 |
| `x_tmdv_y1_tm_11` (hn_tm_y1) | 130 mm | BAO-TM rộng hơn tường 130 mm mỗi bên, sâu hơn 150 mm |
| `x_tmdv_y2_tm_07` (hn_tm_y2) | 691 mm | BAO-TM đối xứng ±9.436, tường −8.745 … +9.131 → căn CH-12/13 đè lõi 2.135 mm |
| `x_xh_y1_tm_07` (hn_xh_y1) | 714 mm | mép trái BAO-TM −9.300, tường −8.586 → căn CH-13/14 đè lõi 2.206 mm |
| `x_tmdv_v1_tm_06` (hn_tm_v1/v2/v3, hn_xh_v1) | 750 mm | mép phải BAO-TM rộng hơn tường 750 mm |
| `x_tmdv_v2_tm_06` (hn_tm_v4) | 886 mm | mép phải BAO-TM rộng hơn tường ~887 mm |

Ngoài ra: `hn_xh_z2` — Circle điểm kéo ở mút hành lang B chưa sửa (kéo hành lang làm DTXD lệch ±4,2 m²).

## Cần đội CAD trả lời một câu
**Khung `MDI-BAO-TM` có phải ôm đúng mép ngoài tường lõi không?**
- **Có** → nhờ sửa 9 lõi trên cho BAO-TM trùng mép ngoài tường; app không phải sửa gì.
- **Không** (BAO-TM được phép rộng hơn, ví dụ chừa sảnh/hộp kỹ thuật) → báo quy tắc, app sẽ đổi phép kiểm
  QT-22 sang so với BAO-TM và xếp căn theo đó.

## Tồn từ trước, vẫn chưa sửa
- `mttm_hn_u3` vẫn mất XREF lõi/thang.
- Circle lạc ở i1 / i2 / i3 / l1.
- Ranh tim tường `chtm_hn_2pn_y2`, `chxh_hn_2pn_y1` vẫn nằm trên `A-WALL-PRTN`.
- Lõi `x_tmdv_z3_tm_06` có 4 giếng nhưng tên ghi `06`.
- `x-thang/_QUY_TAC_TEN_FILE.md` vẫn ghi `x_tb_n1` (đã đổi thành `x_tb_n2`).

Chi tiết kỹ thuật: `docs/GIAO_VIEC_TIEP.md §A37`.
