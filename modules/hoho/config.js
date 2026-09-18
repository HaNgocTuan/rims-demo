/* =====================================================================
 * HNT HydroNet — CẤU HÌNH KỸ THUẬT (config.js)
 * ---------------------------------------------------------------------
 * Mã liên quan: D-12 (data contract) · D-13 (adapter HYDRO_DATA) · R-09
 *
 * MỤC ĐÍCH
 *   Gom MỌI cấu hình kỹ thuật / nguồn nội bộ WP về MỘT chỗ duy nhất,
 *   KHÔNG hiển thị trên tab Cài đặt cho người dùng (đã gỡ khỏi UI).
 *   Đây là phôi "data contract" để Dev team chuẩn hoá khi deploy thật.
 *
 * GIAI ĐOẠN HIỆN TẠI (prototype tĩnh, python http.server)
 *   - File này nạp TRƯỚC các module lớp và lõi viewer.
 *   - Chứa endpoint nội bộ + tâm vùng dự án. KHÔNG chứa token (xem
 *     secret.local.js — tách riêng vì là credential).
 *
 * KHI DEPLOY THẬT (Dev team — đúng nhất)
 *   - 3 endpoint dưới => chuyển sang BIẾN MÔI TRƯỜNG (.env dev/stg/prod),
 *     nạp lúc build/deploy; KHÔNG nằm trong mã nguồn FE.
 *   - Token RMA => sống ở BACKEND (secret/secrets-manager); client gọi
 *     BE của WP, BE gắn Bearer rồi mới tới RMA. Trình duyệt KHÔNG bao giờ
 *     thấy token (D-09 kiến trúc FE/BE/DB · D-11 RMA single-source chỉ-đọc).
 *   - Mọi fetch hội tụ qua adapter HYDRO_DATA (D-13): pilot đọc file này;
 *     bản thật trỏ về BE. Đổi môi trường = đổi MỘT chỗ.
 *
 * ⚑ TRUNG THỰC: tên KHOÁ dưới đây là HỢP ĐỒNG ĐỀ XUẤT (D-12). Việc nối
 *   code hiện hành (thay URL hardcode trong index.html/weather-layers.js…
 *   bằng cách đọc từ đây) là D-13 — làm khi có file thật đính kèm. Nếu
 *   tên biến code đang dùng khác, adapter sẽ ánh xạ, KHÔNG sửa mò.
 * ===================================================================== */

window.HHT_CONFIG = {

  /* --- Endpoint nội bộ WP (KHÔNG expose UI) --------------------------- */
  RMA_GATEWAY : 'https://wpe-tools.seho.vn/api/rma',     // API gateway RMA (trạm, ngưỡng BĐ1/2/3 — chỉ đọc, D-11)
  RESOURCES   : 'https://resources.weatherplus.vn',      // tile vệ tinh / radar / mưa / gió
  STORMS      : 'https://resources.weatherplus.vn',      // bão — đường đi (track GeoJSON)

  /* --- Vùng dự án: tâm căn khung "xem toàn lưu vực" ------------------- */
  CENTER_LAT  : 18.2,
  CENTER_LNG  : 105.65,
  DEFAULT_ZOOM: null,   // ⚑ CHỜ trích lại từ index.html hiện hành (giá trị zoom mặc định thật)

  /* --- Nhịp cập nhật định kỳ (mưa & mực nước) ------------------------- */
  REFRESH_MINUTES_DEFAULT : 15,          // mặc định 15'
  REFRESH_MINUTES_OPTIONS : [15, 30, 45] // chỉ 3 mốc; không gọi thưa hơn 45'
};
