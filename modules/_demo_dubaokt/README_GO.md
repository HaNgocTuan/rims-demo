# DEMO — Hỗ trợ dự báo viên / Dự báo khí tượng

Trình diễn cho cục. KHÔNG thuộc lõi RIMS.

## Gỡ demo (2 bước)
1. Xoá cả thư mục: app/web/modules/_demo_dubaokt/
2. Trong app/web/core/rims-toolbox.js: xoá khối đánh dấu
   /* ===== DEMO HTDBV — GỠ KHI CẦN ===== */ ... /* ===== HẾT DEMO HTDBV ===== */
   và (tuỳ chọn) 2 dòng tool dbkt/dbtv + dòng nhóm 'htdbv' trong NHOM/TOOL.

## Nội dung
- index.html: cửa sổ phân tích hình thế (mở detach từ RIMS).
- maps/: ảnh synop mẫu THẬT (WeatherPlus, phiên 26/05/2026 01Z) — 4 lớp × 9 mốc (rh500 thiếu 3 mốc như thật).
- Nút "AI phân tích" = mô phỏng: trả nhận định mẫu (lấy từ nhận định thật đã lưu trong FOP 26/05/2026).
