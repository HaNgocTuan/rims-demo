/* =============================================================================
 * rims-data.js  ·  RIMS  ·  adapter dữ liệu (RIMSData)
 * -----------------------------------------------------------------------------
 * ĐƯỜNG KHÂU DUY NHẤT giữa giao diện và mọi nguồn dữ liệu.
 * Giao diện KHÔNG gọi fetch() trực tiếp — chỉ đọc qua window.RIMSData.
 *
 * Kế thừa nguyên tắc từ HydroNet (app/viewer/hydro-data.js, adapter HYDRO_DATA):
 *   - một công tắc nguồn duy nhất
 *   - registry lớp máy-kiểm-được
 *   - "cờ trung thực": thiếu dữ liệu = null + flag, TUYỆT ĐỐI không bịa số
 *
 * KHÁC HydroNet ở ba điểm (do yêu cầu RIMS):
 *   1. Đa hồ: mọi truy vấn có tham số `ho_id` (mã định danh thống nhất VN-WIS),
 *      không mặc định một lưu vực.
 *   2. Hai chiều dữ liệu: đọc từ nền tảng trung tâm + đọc kết quả engine WP,
 *      và đẩy dữ liệu vận hành lên trung tâm (store-and-forward).
 *   3. Trạng thái kết nối: adapter phải báo được đang ONLINE hay ĐANG SUY GIẢM
 *      (mất engine → giao diện chuyển chế độ nhập tay).
 *
 * ⚑ TRẠNG THÁI: KHUNG. Các hàm dưới đây đã chốt CHỮ KÝ (hợp đồng), phần thân
 *   trả về null + cờ "CHUA-NOI" cho tới khi có nền tảng backend RIMS.
 *   Không xoá cờ trước khi nối thật.
 * =========================================================================== */
(function (global) {
  "use strict";

  var SCHEMA_VERSION = "0.1";

  /* --- Công tắc nguồn (điểm DUY NHẤT) ------------------------------------- *
   *   mock     : dữ liệu dựng tay để dựng giao diện
   *   live      : nền tảng RIMS + engine WP qua API
   *   local     : CHẾ ĐỘ SUY GIẢM — chỉ đọc DB vận hành tại hồ + nhập tay     */
  var SOURCE = global.RIMS_SOURCE || "mock";

  var C = global.RIMS_CONFIG || {};

  function flag(what) { return ["CHUA-NOI:" + what]; }

  var API = {

    schemaVersion: SCHEMA_VERSION,
    source: function () { return SOURCE; },
    setSource: function (s) { SOURCE = s; return SOURCE; },

    /* ---------------------------------------------------------------------
     * DANH MỤC HỒ — nguồn sự thật là nền tảng trung tâm (registry VN-WIS).
     * Trả về: [{ho_id, ten, tinh, song, luu_vuc, nhom, muc_san_sang, tank_project}]
     * ------------------------------------------------------------------- */
    getReservoirs: function () {
      if (SOURCE === "mock") {
        return fetch("data/reservoirs/reservoirs_rims.json")
          .then(function (r) { return r.json(); })
          .then(function (j) { return j.ho || []; })
          .catch(function () { return []; });
      }
      return Promise.resolve({ data: null, flags: flag("registry-ho-trung-tam") });
    },

    /* ---------------------------------------------------------------------
     * TRẠNG THÁI MỘT HỒ tại thời điểm hiện tại (mực nước, Q vào, Q xả, cửa van).
     * Nguồn: DB vận hành của hồ (node) → đồng bộ lên trung tâm.
     * ------------------------------------------------------------------- */
    getState: function (ho_id) {
      return Promise.resolve({ ho_id: ho_id, data: null, flags: flag("state-ho") });
    },

    /* ---------------------------------------------------------------------
     * Q ĐẾN DỰ BÁO — kết quả engine WP (mô hình tank), hạn 12/24/48h.
     * Giao diện chỉ hiển thị; KHÔNG tính lại phía client.
     * ------------------------------------------------------------------- */
    getInflowForecast: function (ho_id) {
      return Promise.resolve({ ho_id: ho_id, data: null, flags: flag("engine-tank-qua-BE") });
    },

    /* ---------------------------------------------------------------------
     * KỊCH BẢN VẬN HÀNH / mô phỏng — engine WP.
     * ------------------------------------------------------------------- */
    runScenario: function (ho_id, kichban) {
      return Promise.resolve({ ho_id: ho_id, kichban: kichban, data: null, flags: flag("engine-mo-phong") });
    },

    /* ---------------------------------------------------------------------
     * ĐẨY DỮ LIỆU VẬN HÀNH lên trung tâm (store-and-forward).
     * Khoá idempotent: (ho_id, bien, moc_thoi_gian) — gửi lại bao nhiêu lần
     * cũng không sinh bản ghi trùng.
     * ------------------------------------------------------------------- */
    pushOperational: function (ho_id, banghi) {
      return Promise.resolve({ queued: true, ho_id: ho_id, n: (banghi || []).length, flags: flag("dong-bo-len-trung-tam") });
    },

    /* ---------------------------------------------------------------------
     * TRẠNG THÁI KẾT NỐI — giao diện dựa vào đây để chuyển chế độ.
     *   online   : đủ engine + trung tâm
     *   degraded : mất engine → chỉ còn tính cân bằng nước tại chỗ, nhập tay
     * ------------------------------------------------------------------- */
    getConnectivity: function () {
      return Promise.resolve({
        mode: SOURCE === "local" ? "degraded" : "online",
        engine: null, trungtam: null,
        du_bao_cache_luc: null,          // nhãn thời gian bản dự báo cache gần nhất
        flags: flag("health-check")
      });
    },

    /* --- tiện ích ------------------------------------------------------- */
    getConfig: function () { return C; }
  };

  global.RIMSData = API;
  console.log("%c[RIMS] rims-data.js v" + SCHEMA_VERSION + " — nguồn: " + SOURCE, "color:#065a82");
})(window);
