/* =====================================================================
 * RIMS — MẪU KHOÁ CỤC BỘ (secret.local.example.js)
 * ---------------------------------------------------------------------
 * ✅ COMMIT file MẪU này (để trống).
 * ❌ KHÔNG commit secret.local.js (đã có trong .gitignore).
 *
 * Copy thành `secret.local.js` cùng thư mục rồi điền khoá để chạy thử
 * cục bộ (prototype).
 *
 * ⚠ CẢNH BÁO KIẾN TRÚC — KHÁC VỚI HYDRONET
 *   HydroNet để khoá RMA ở phía client (secret.local.js nạp vào trình
 *   duyệt). Chấp nhận được cho prototype một lưu vực, KHÔNG chấp nhận
 *   được với RIMS: hệ thống phục vụ nhiều cấp quản lý, có 04 hồ liên
 *   quan an ninh quốc gia, và sẽ bàn giao cho cơ quan nhà nước.
 *
 *   Khi lên môi trường thật: khoá sống ở BACKEND (secrets manager /
 *   biến môi trường). Trình duyệt gọi BE của RIMS, BE gắn khoá rồi mới
 *   gọi engine. Trình duyệt KHÔNG BAO GIỜ thấy khoá.
 *   → File này chỉ tồn tại trong giai đoạn dựng khung.
 * ===================================================================== */

window.RIMS_SECRET = {
  // Khoá gọi gateway RMA (lớp Trạm, mưa dự báo)
  RMA_API_KEY : 'PASTE_RMA_API_KEY'
};

/* Tương thích ngược với module bê từ HydroNet (đọc HYDRO_SETTINGS.rmaKey) */
window.HYDRO_SETTINGS = Object.assign(window.HYDRO_SETTINGS || {}, {
  rmaKey: window.RIMS_SECRET.RMA_API_KEY
});
