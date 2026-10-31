# Leo AI — trợ lý Claude trong Unitmix

Leo AI là khung trò chuyện trong trình soạn (nút **Leo AI** trên thanh trên; điện thoại: nút logo LEO ở dock dưới). Người dùng nói hoặc gõ việc cần làm; Leo AI (Claude) tự gọi công cụ để đọc số liệu và **sửa dự án thật** — đúng như người dùng bấm: cùng kho PA, cùng ngăn hoàn tác (Ctrl+Z), cùng tự chỉnh mặt bằng, cùng tự lưu.

Ảnh: `docs/anh/tro-ly/` (máy tính 1440×900, điện thoại 390×844; sinh bằng `scripts/leo_ai_e2e.mjs`).

## Kiến trúc

```
LeoAI.tsx (khung, lazy chunk)                         worker/src/ai.ts (khoá chung)
  │ câu hỏi + <ngu_canh> trạng thái màn hình            ▲ POST /api/ai/v1/messages?beta=true
  ▼                                                     │ (SDK baseURL = /api/ai, header X-Du-An + X-Ma-Sua)
vongLap.ts  chayVong ──► KhachClaude ──► khachThat.ts ──┤
  │ stop_reason → tool_use                              └► api.anthropic.com (khoá riêng, dangerouslyAllowBrowser)
  ▼
congCu/index.ts  chayCongCu (kiểm schema → chạy → JSON gọn / is_error)
  ▼
congCu/{doc,tmb,tang,khac}.ts ──► NguCanh (congCu/nguCanh.ts) ──► nguCanhSoan.ts
                                     kho thật (kho/khoLoi.ts)        setter chọn của SoanThao, chonTangNgoai,
                                     tv / dl / luật / cửa căn         api PA, xuất tệp, uiDom.ts (DOM)
```

- **Kho**: `kho/khoLoi.ts` là lõi thuần của `useKho` (sửa = một bước hoàn tác, bỏ phép sửa không đổi gì, luôn sửa trên bản PA mới nhất). Giao diện và Leo AI dùng chung một lõi → hoàn tác / làm lại / tự lưu như nhau.
- **Công cụ** gọi đúng hàm các màn gọi: `taoToaTrenLo`, `suaNhom` + `dichNhom / xoayNhom / latNhom`, `viTriNhanBan`, `goiYXepToaNen`, `xepHangLoatNen` + `apHangLoat`, `datCanhDuong`, `doiCanTaiViTri / doiCanTheoTang` trong `suaTuChinh` (tự chỉnh XC-03…PC-11, `tuChinhSauSua`), `chayPhep(phepTay(...))` cho thanh công cụ tay màn Tầng (đổi chỗ, thêm / xoá căn, lật, thang bộ), `toiUuCoCau`, `stretchTay`, `suaHam`, `chuanHoaChiPhi`… Không có mô hình song song.
- **Quy tắc thang bộ** (AI_START 7) giữ nguyên vì công cụ thang đi qua `themThangTay / xoaThangTay / doiLoaiThangTay / thangTuDongLai` (tối đa 3, tối thiểu 2, luôn N2 + N3).
- **Chế độ Chỉ xem**: mọi công cụ sửa trả lỗi giải thích (cần link có mã sửa / chuyển TỰ ĐỘNG).
- **Xác nhận**: xoá PA, tải Excel, bấm nút có chữ xuất / tải / xoá qua `ui_click` → chip "Đồng ý / Không" trong khung chat trước khi chạy. Xuất CAD chỉ mở hộp (người dùng tự bấm tải).

## Danh sách công cụ (45, thứ tự cố định — tiền tố prompt cache không đổi)

| Nhóm | Công cụ |
|---|---|
| Đọc | `get_state`, `get_kpi` (project / lot / floor), `get_floor_plan`, `list_templates` (towers / units, ứng viên đổi căn), `check_rules` (chỉ tiêu QH, LO-01/02/05, QCVN 04, thang N2+N3), `get_cost`, `get_population`, `get_basement`, `compare_pas` |
| Điều hướng | `navigate` (màn TMB / Tầng / Hầm, 2D / 3D / Chi phí, lô, tòa, tầng, ô, tầng hầm), `zoom_to_fit` |
| TMB | `suggest_arrangements`, `apply_arrangement`, `batch_arrange`, `add_tower`, `update_tower` (x, y, góc, tầng, đế, đổi mẫu), `transform_towers` (dời / xoay / lật nhóm), `duplicate_towers`, `delete_towers`, `lock_towers`, `set_road_edges`, `add_lot`, `update_lot` (ký hiệu, chức năng, chỉ tiêu, cơ cấu mục tiêu, khai dân số tỉnh, `round_area` làm tròn DT khi tính dân), `recommend_tower_shapes` (so sánh / gợi ý dạng tòa không đặt lên TMB — tiêu chí có cấu trúc, `show_in_app` mở hộp So sánh mẫu tòa), `update_coefficients` |
| Tầng | `change_units` (theo unit_id hoặc loại căn, nhiều ô một bước), `swap_units`, `add_unit`, `delete_units`, `flip_units`, `set_cell_function`, `stairs` (add / delete / move / set_type N2·N3 / reset_auto), `optimize_floor` (PC-11 + cơ cấu), `reset_floor_units`, `stretch_unit`, `set_floor_mix_target`, `repack_floor` |
| Khác | `update_basement`, `update_cost`, `manage_pa` (nhân bản / đổi tên / tạo / xoá có xác nhận / mở), `export_file` (xls có xác nhận, cad mở hộp), `undo`, `redo` |
| Dự phòng | `ui_snapshot` (nút / ô nhập đang hiện, id ổn định theo vùng + vai trò + nhãn), `ui_click`, `ui_set_value` — bấm được mọi nút như người dùng khi chưa có công cụ riêng |

Mỗi công cụ sửa trả tóm tắt số sau sửa (số tòa / căn lô, chỉ tiêu chưa đạt, cảnh báo LO-01/02/05, tầng sau sửa theo loại, căn bị chặn, số bước hoàn tác) để Claude tự kiểm. Thao tác mới (không có trên giao diện): `update_tower.template_id` — đổi mẫu tòa giữ vị trí / tầng, bỏ sửa mặt bằng tầng.

## Gọi Claude (theo tài liệu Claude API)

- SDK chính thức `@anthropic-ai/sdk` (`client.beta.messages.stream`), vòng tay (`troLy/vongLap.ts`): kiểm `stop_reason` trước khi chạy công cụ (`refusal` dừng; `max_tokens` có tool_use dở thì không chạy, không nối lượt hỏng; `pause_turn` gửi lại), mọi `tool_result` của một lượt trả trong MỘT tin user, lỗi = `is_error`, nối nguyên `response.content` (khối thinking giữ chữ ký).
- `thinking: { type: "adaptive", display: "summarized" }` (không gửi `disabled` / `budget_tokens`); `output_config.effort` đặt rõ; `tool_choice: auto` (ép công cụ trả 400 trên Opus / Sonnet 5.5); `eager_input_streaming: true` trên mọi công cụ → luôn tự kiểm đầu vào theo schema trước khi chạy.
- Opus 5.5 / Sonnet 5.5: `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`. Haiku 5.5: không gửi fallback (không hỗ trợ).
- Prompt cache: lời hệ thống cố định (`troLy/heThong.ts`, không ngày giờ / id) + danh sách công cụ cố định có `cache_control`, thêm cache tự động phần hội thoại. Trạng thái màn hình gửi trong khối `<ngu_canh>` ở đầu mỗi câu hỏi (không làm vỡ tiền tố).
- Tiết kiệm token: công cụ đọc trả số gọn; kết quả > 12.000 ký tự bị cắt; lịch sử dài (> 60.000 ký tự) thì lúc bắt đầu câu mới rút kết quả công cụ cũ còn ~300 ký tự, bỏ ảnh cũ và bỏ khối thinking (sửa tin cũ thì bỏ thinking — tránh lỗi ràng buộc khối); trần `max_tokens` 16.000 (Haiku 8.000); tối đa 24 vòng / câu.

## Mô hình, mức suy nghĩ, gợi ý 0 token

| Mô hình | Mã | Giá vào / ra (USD / triệu token) | Dùng cho |
|---|---|---|---|
| Claude Sonnet 5.5 (**mặc định**, mức Cân bằng = `medium`) | `claude-sonnet-5-5` | 2 / 10 | đa số việc sửa |
| Claude Opus 5.5 | `claude-opus-5-5` | 4 / 20 | nhiều bước, tối ưu, rà quy chuẩn, đọc ảnh |
| Claude Haiku 5.5 | `claude-haiku-5-5` | 0,10 / 0,50 | tra cứu, giải thích, điều hướng |

Giá theo bảng chủ nhiệm đưa (2026-10-29) — kiểm lại trên trang giá Anthropic khi đổi. Mức suy nghĩ: Nhanh / Cân bằng / Kỹ = `low` / `medium` / `high`.

**Gợi ý mô hình khi đang gõ** (`troLy/goiYMoHinh.ts`, luật trên máy, không gọi API): chờ 400 ms sau phím cuối rồi hiện chip "Gợi ý: Haiku 5.5 · Nhanh — tra cứu đơn giản (≈ 1/40 chi phí Opus)" với nút Áp dụng / Luôn tự chọn. Luật:
- **Opus · Kỹ**: có ảnh / tệp đính kèm; mục tiêu tối ưu ("tối ưu…", "đạt 55% …", "sát mục tiêu"); xếp lại / xếp tự động nhiều lô / tòa ("xếp lại", "xếp tòa tự động" + ≥ 2 thực thể hoặc "mọi / tất cả / cả dự án"); rà QCVN / PCCC / thoát nạn toàn dự án; động từ sửa + phạm vi rộng; câu > 280 ký tự hoặc ≥ 3 phần việc (tách theo dấu phẩy, chấm phẩy, "rồi", "sau đó") có ≥ 2 động từ sửa.
- **Haiku · Nhanh**: không có động từ sửa, ≤ 120 ký tự, và là câu hỏi (bao nhiêu, là gì, ?), giải thích (tại sao…), điều hướng (mở / xem / chuyển…) hoặc hỏi số (KPI, số căn, dân số, mật độ, chi phí…).
- **Sonnet · Cân bằng**: còn lại (một vài thao tác sửa, tóm tắt, so sánh PA).
- Động từ sửa so khớp trên chữ CÓ dấu (bỏ dấu thì "tầng" = "tăng"); gõ không dấu chỉ dùng từ không nhập nhằng.

Chế độ **Tự chọn** (Cài đặt) = tự áp gợi ý cho mỗi câu. Người dùng đã chọn mô hình riêng cho cuộc trò chuyện (ô chọn cạnh ô nhập) thì không tự đổi, kể cả khi Tự chọn bật.

## Tài khoản Claude — không cần khoá API (cầu trên máy)

Leo AI dùng chính tài khoản Claude (Pro/Max) đã đăng nhập trong Claude Code trên máy tính. Nguồn gọi chọn ở Cài đặt Leo AI: **Tự động** (khoá riêng → tài khoản Claude → khoá chung) hoặc ép một nguồn.

```
trình duyệt (SDK, baseURL = cầu)  ──►  scripts/cau_claude.py (127.0.0.1:3032)  ──►  claude -p  (tài khoản đã đăng nhập)
điện thoại (taoFetchTram)  ──►  Worker /api/tram (Durable Object)  ◄── WebSocket ── cầu trên máy tính
```

- **Cầu** (`scripts/cau_claude.py`, chỉ thư viện chuẩn Python): nói giao thức Anthropic Messages (stream SSE) nên vòng tác tử, 45 công cụ, Dừng, hoàn tác giữ nguyên. Công cụ của app đưa vào lời hệ thống, đầu ra ép `--json-schema` `{chu, goi[]}` → khối `tool_use`; mỗi lượt là một `claude -p --no-session-persistence --tools "" --strict-mcp-config` (không Bash / ghi tệp / MCP; chỉ `Read` khi có ảnh / PDF). Bấm Dừng → ngắt kết nối → cầu giết tiến trình. Chỉ nghe 127.0.0.1, chỉ nhận nguồn `file://` / localhost / địa chỉ app khai ở `cau_claude.json`.
- **Điện thoại**: cầu tự nối WebSocket ra trạm (`worker/src/tram.ts`, phòng = SHA-256 mã ghép, ≤ 30 câu/phút, chờ 25 s rồi hỏi tiếp bằng `/kq`). Ghép MỘT lần: Cài đặt Leo AI trên máy tính → "Chép link ghép điện thoại" → mở link trên điện thoại (`/#ghep=<mã>`, mã lưu `localStorage`, xoá khỏi thanh địa chỉ). "Đổi mã ghép" làm các điện thoại cũ hết dùng.
- **Cài**: nút "Tải bộ cài cầu AI (Windows)" tải `Cai_Cau_AI_Unitmix.bat` (nhúng địa chỉ app) → tải `cau_claude.py` + `cai_cau_ai.ps1` từ `/cau/*` (Vite chép từ `scripts/` vào `dist/cau`) → cài Claude Code / Python nhúng nếu thiếu, hướng dẫn đăng nhập, tự chạy ngầm khi đăng nhập Windows. Máy khác: `python scripts/cau_claude.py` (thêm `{"tram": "https://<app>"}` vào `cau_claude.json` cạnh cầu để ghép điện thoại).
- **Giới hạn**: mỗi lượt khởi động `claude -p` nên chậm hơn API 2–8 s, không có prompt cache / mức suy nghĩ / fallback của API (cầu chỉ chuyển `--model` và `--effort`); máy tính phải bật và cầu đang chạy; tính vào hạn mức gói Claude của người dùng. Điều khoản Anthropic về dùng gói thuê bao ngoài app chính thức đã đổi nhiều lần (2/2026 cấm OAuth ở app bên thứ ba; 6/2026 hạn mức Agent SDK riêng) — chỉ dùng cho tài khoản của chính mình / nhóm nội bộ, kiểm lại điều khoản hiện hành trước khi mở rộng.
- **Kiểm**: `tests/test_cau_claude.py` (Claude Code giả `tests/fake_claude.py`), `worker/test/tram.test.ts`, `web/src/troLy/cau.test.ts`. Đã chạy thật: SDK → cầu → Claude Code thật (Haiku 5.5) hai lượt tool_use / tool_result, cả đường trực tiếp lẫn qua Worker cục bộ (wrangler dev). **Chưa chạy**: `cai_cau_ai.ps1` trên Windows thật (môi trường làm không có PowerShell), trạm trên Cloudflare thật (cần `wrangler deploy`, migration Durable Object `v1-tram`), trình duyệt thật gọi 127.0.0.1 từ trang https (Chrome có thể hỏi quyền "mạng cục bộ").

## Khoá API — chủ app phải làm

1. **Khoá chung của máy chủ** (để người dùng không cần khoá riêng): trong `worker/`
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY      # dán khoá, không ghi vào tệp nào
   npx wrangler d1 migrations apply unitmix --remote   # bảng ai_luot (0002_ai_luot.sql)
   ```
   Tuỳ chọn trần lượt / ngày: biến `AI_GIOI_HAN_DU_AN` (mặc định 300 / dự án / ngày), `AI_GIOI_HAN_IP` (500 / IP / ngày) trong `wrangler.toml` `[vars]` hoặc Dashboard. Chưa đặt secret thì cổng trả 503 `chua_cau_hinh` và khung Leo AI mời dán khoá riêng.
2. **Khoá riêng** (người dùng tự dán trong Cài đặt Leo AI): chỉ lưu `localStorage` trình duyệt đó (`unitmix.leoAi.khoaApi`), hiện dạng che, xoá được, gọi thẳng `api.anthropic.com`, không qua máy chủ Unitmix.

Cổng khoá chung (`worker/src/ai.ts`): chỉ dự án mở bằng mã sửa đúng (`X-Du-An` + `X-Ma-Sua`); danh sách mô hình cho phép (3 mã trên, khớp `web/src/troLy/moHinh.ts`); trần `max_tokens` 16.000; chỉ chuyển các trường đã biết và beta `server-side-fallback-2026-07-01`; đếm lượt trong D1 (IP lưu dạng băm); không ghi log khoá, khoá chỉ ở header gửi Anthropic, không trả header thượng nguồn thô; lỗi theo dạng lỗi Anthropic kèm `x-should-retry: false`.

## Giao diện

- Máy tính: ngăn phải nổi (lớp phủ `position: fixed`, đè panel Số liệu) — khung giữa TMB / MB / 3D không đổi kích thước (E2E đo). Màn hẹp ≤ 1024 px: tấm từ đáy; ≤ 600 px: toàn màn, vùng an toàn, cao theo `--vv-h` (bàn phím ảo — ô nhập, mic, gửi luôn ngay trên bàn phím), nút ≥ 44 px, ô nhập 16 px (iOS không tự phóng). Chạy được trong PWA màn hình chính.
- Trò chuyện: chữ chảy + Markdown (tiêu đề, danh sách, bảng, khối mã có nút chép), "Tiến trình" (thinking tóm tắt) thu gọn, bước công cụ một dòng mở rộng xem đầu vào / kết quả, chép / đọc to / thử lại, sửa và gửi lại câu cuối, nút Dừng (huỷ luồng; công cụ còn lại trả lỗi "đã dừng" để lịch sử hợp lệ), cuộc mới, lịch sử theo dự án (đổi tên / xoá; 20 cuộc, bản lưu bỏ ảnh), giờ khi rê chuột, nút xuống cuối, câu mở gợi ý theo màn.
- Enter gửi, Shift+Enter xuống dòng, bỏ qua khi bộ gõ tiếng Việt đang ghép chữ (`isComposing` / keyCode 229); ô nhập tự giãn.
- Đính kèm: ảnh (dán / kéo thả / chọn; thu ≤ 1600 px JPEG), PDF ≤ 5 MB (khối document), Excel / CSV (đổi sang CSV chữ, ≤ 5 sheet).
- Giọng nói (chỉ API trình duyệt): mic → `SpeechRecognition` (vi-VN / en-US theo ngôn ngữ app, chữ tạm hiện ngay, bấm lại để dừng), đọc to `speechSynthesis` (giọng vi-VN nếu có), chế độ rảnh tay (nghe → gửi → đọc trả lời → nghe tiếp). Không hỗ trợ / bị từ chối micro → câu báo tiếng Việt.
- Logo LEO hai lớp, vòng O quay khi Leo AI đang chạy, dừng ở cuối vòng (giảm chuyển động: nhấp nháy). Tải dùng `img.spin-o`. Biểu tượng nét tự vẽ trong `ui/bieuTuongSvg.ts` (`leo*`).

## Kiểm

- `web/src/troLy/congCu/congCu.test.ts` — mỗi công cụ trên thư viện thật: đúng → PA đổi + đúng một bước hoàn tác; sai → `is_error`, PA giữ nguyên; Chỉ xem → từ chối; test "phủ đủ" bắt mọi công cụ phải có ca thử.
- `web/src/troLy/vongLap.test.ts` — khách Claude giả: luồng tool_use → chạy → tool_result gom một tin, nhiều công cụ một lượt (công cụ sau thấy kết quả công cụ trước), refusal, max_tokens, Dừng giữa luồng / giữa công cụ, giới hạn vòng, thân yêu cầu đúng luật từng mô hình, tiền tố cache ổn định, gọn lịch sử.
- `web/src/troLy/goiYMoHinh.test.ts`, `markdown.test.ts`, `kho/khoLoi.test.ts`.
- `worker/test/ai.test.ts` — thiếu secret, mã sửa, danh sách mô hình, trần token, lọc trường / beta, trần lượt, không lộ khoá.
- `scripts/leo_ai_e2e.mjs` — kịch bản E2E trên giao diện thật với mô hình giả (không gọi API): "Xếp tòa tự động cho lô NO-02, đổi 2 căn 3PN thành 2PN ở tầng điển hình, rồi cho tôi xem KPI dự án" → get_state → apply_arrangement → get_floor_plan → change_units + navigate → get_kpi → trả lời có bảng; kiểm khung giữa không đổi, PA lưu ở máy chủ có tòa mới + căn đổi, điện thoại toàn màn + bàn phím giả. Cần vite dev (`window.__leoKhachGia` chỉ nhận ở bản dev) + API.
- `scripts/kiem_man_hep.mjs` — thêm hộp `leo-ai`: nút đầu khung, ô nhập ≥ 16 px, bàn phím giả → nút gửi / mic / đính kèm (`.leo-soan-duoi.chan-hop`) trong phần nhìn thấy, bấm × đóng được.

## Chi phí (ước)

Một câu sửa điển hình 5–6 lượt gọi: mỗi lượt gửi lại lời hệ thống + 46 công cụ (~12.000 token, đọc từ cache sau lượt đầu: 0,1× giá vào) + hội thoại. Ví dụ Sonnet 5.5: lượt đầu ghi cache ~12k × $2,5/MTok ≈ $0,03; các lượt sau ~1–3k token mới + ~12k đọc cache ($0,2/MTok) + 200–500 token ra ≈ $0,01 / lượt → cả câu ≈ $0,06–0,10. Haiku rẻ hơn ~20 lần, Opus đắt gấp đôi Sonnet. Đặt trần lượt / ngày ở Worker nếu dùng khoá chung.

## Còn hạn chế

- Chưa thử với Claude thật (không có khoá trong môi trường làm): kịch bản E2E dùng mô hình giả phát lại tool_use; cổng Worker thử với thượng nguồn giả.
- Một số thao tác chỉ có trên bản vẽ (kéo thả tự do, vẽ ranh hầm, đo) chưa có công cụ riêng — dùng `ui_click` / `ui_set_value` hoặc công cụ tương đương (dời tòa theo dx / dy, `swap_units` thay kéo căn). Nhập DXF / Excel chỉ tiêu cần người dùng chọn tệp.
- `switch PA` (`manage_pa open`) tải lại trang → cuộc trò chuyện dừng (lịch sử vẫn còn).
- Giọng nói phụ thuộc trình duyệt: Firefox chưa có SpeechRecognition; iOS Safari tự dừng nghe sau một câu (chế độ rảnh tay vẫn nối tiếp).
- Gọn lịch sử bỏ khối thinking cũ khi hội thoại dài — Claude mất phần suy nghĩ của các lượt rất cũ (kết quả công cụ vẫn còn bản rút gọn).

## Xếp tòa THEO MỤC TIÊU (DTXD + cơ cấu căn)

Ô "Theo mục tiêu: DTXD + cơ cấu" ở panel Gợi ý xếp tòa (hoặc `target_mode: true` ở `suggest_arrangements` / `apply_arrangement` của Leo AI) bật `theoMucTieu` trong `tinh/xepToa.ts`: app tự suy ra tổ hợp tối đa 3 mẫu tòa × số tòa (≤ 8) sao cho tổng DT chân tòa nằm trong [85 % × MĐXD tối đa, MĐXD tối đa] của lô và cơ cấu căn sát `coCauMucTieu` (Σ |% − % mục tiêu| nhỏ nhất), rồi đặt từng tòa theo lưới + LO-01 / LO-02 như gợi ý thường. Phương án ra có `theoMucTieu {duKien, thieuToa, dtxdPct, thieuDtxd}`; nếu lô chật nên không đặt đủ tòa dự kiến thì báo "không đặt được n tòa" và xếp hạng theo lệch cơ cấu + phần thiếu DTXD. Leo AI chọn `target_mode`, đặt cơ cấu mục tiêu (`update_lot`) rồi so sánh / áp phương án.
