/* =============================================================================
 * openmeteo.js  ·  RIMS  ·  ADAPTER VÍ DỤ — nguồn mở Open-Meteo
 * -----------------------------------------------------------------------------
 * MỤC ĐÍCH: chứng minh cơ chế cắm nguồn mở. Thêm một nguồn = một khối JSON
 * trong sources.json + file này. Không sửa một dòng nào của mã lõi.
 *
 * CHƯA KIỂM CHỨNG trong RIMS. Nguồn tham khảo, KHÔNG dùng làm căn cứ phát
 *   hành bản tin. Điều khoản sử dụng phải đọc kỹ trước khi dùng trong hệ thống
 *   nhà nước. Trạng thái trong sources.json để 'du_kien' và tắt mặc định.
 *
 * Giá trị thực tế nếu bật: đối chứng mưa dự báo của WeatherPlus bằng một mô
 * hình toàn cầu độc lập — có ích khi đánh giá độ bất định trước một trận lũ.
 * =========================================================================== */
(function () {
  "use strict";

  var ID = "openmeteo";

  if (!window.RIMSSources) {
    console.error("[RIMS/adapter " + ID + "] thiếu rims-sources.js — nạp nó trước.");
    return;
  }

  function buildUrl(lat, lon) {
    return window.RIMSSources.url(
      ID,
      "v1/forecast?latitude=" + encodeURIComponent(lat) +
      "&longitude=" + encodeURIComponent(lon) +
      "&hourly=precipitation&timezone=Asia%2FBangkok"
    );
  }

  window.RIMSSources.registerAdapter(ID, {

    mo_ta: "Mưa dự báo theo giờ tại một điểm toạ độ — dùng ĐỐI CHỨNG với mưa dự báo của WeatherPlus. Không cần khoá.",

    /* Kiểm tra bằng một điểm cố định (tâm vùng cấu hình) */
    check: function () {
      var C = window.RIMS_CONFIG || {};
      var lat = C.CENTER_LAT || 16.0, lon = C.CENTER_LNG || 107.5;
      return fetch(buildUrl(lat, lon))
        .then(function (r) {
          if (!r.ok) return { ok: false, note: "HTTP " + r.status };
          return r.json().then(function (j) {
            var n = (j && j.hourly && j.hourly.time && j.hourly.time.length) || 0;
            return { ok: n > 0, note: n > 0 ? ("nhận " + n + " mốc giờ") : "phản hồi rỗng" };
          });
        })
        .catch(function (e) { return { ok: false, note: String(e.message || e) }; });
    },

    /* params: {lat, lon} */
    fetch: function (params) {
      params = params || {};
      var C = window.RIMS_CONFIG || {};
      var lat = params.lat != null ? params.lat : (C.CENTER_LAT || 16.0);
      var lon = params.lon != null ? params.lon : (C.CENTER_LNG || 107.5);
      return fetch(buildUrl(lat, lon))
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (raw) {
          window.RIMSSources.report(ID, { ok: true, note: "lấy mưa dự báo tại " + lat + "," + lon });
          return raw;
        })
        .catch(function (e) {
          window.RIMSSources.report(ID, { ok: false, note: String(e.message || e) });
          throw e;
        });
    },

    /* Chuẩn hoá tối thiểu về dạng chuỗi thời gian của RIMS */
    toRims: function (raw) {
      var h = (raw && raw.hourly) || {};
      var t = h.time || [], p = h.precipitation || [];
      var chuoi = t.map(function (ts, i) {
        return { thoi_gian: ts, gia_tri: (p[i] == null ? null : p[i]) };
      });
      return {
        nguon: { id: ID, lay_luc: new Date().toISOString(), muc_tin_cay: "tham_khao" },
        bien: "mua_du_bao",
        don_vi: (raw && raw.hourly_units && raw.hourly_units.precipitation) || "mm",
        chuoi: chuoi
      };
    }
  });
})();
