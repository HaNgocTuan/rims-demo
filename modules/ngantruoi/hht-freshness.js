/* hht-freshness.js — MỘT nguồn sự thật cho "độ tươi" toàn hệ (việc 4, QUYETDINH 28/08/2026)
 * HNT HydroNet · viewer + console modules (same-origin)
 *
 * Nguyên lý (doc QUYETDINH §1–§4):
 *  - Màu = THỜI GIAN TUYỆT ĐỐI, KHÔNG theo nhịp nguồn. Trả lời "lúc này có tin được số này
 *    để ra quyết định không", không phải "cảm biến khoẻ không".
 *  - Hai bộ theo regime: lu (lũ) / can (cạn) — mặc định lu{1h,2h}, can{3h,6h}. Regime do engine
 *    quyết, đọc từ flood_live_status.json (có ô tràn / computed≠skipped-dry / mực ≥ ngang bờ).
 *  - Dải: tuổi ≤ xanh → XANH (TRUNG TÍNH, xám) · xanh<tuổi≤vang → VÀNG · tuổi>vang → ĐỎ.
 *    Chỉ vàng/đỏ mới "nổi"; xanh trung tính để không nhờn màu.
 *  - Tháp: bộ riêng `thap` {15′,60′}, CHỈ áp khi cảnh báo tràn bờ đã nổ (mode hoạt động).
 *  - Số cấu hình đọc từ HYDRO_SETTINGS.freshness (settings.json) — người dùng chỉnh được.
 *
 * Đăng ký: window.HHTFresh. Idempotent (nạp nhiều lần không đè).
 */
(function () {
  "use strict";
  if (window.HHTFresh) return;

  var COL = { ok: "#9aa1a9", warn: "#e0b34a", err: "#e3564d" }; // xanh trung tính · vàng · đỏ

  var _regime = "can", _fetchedAt = 0, _fetching = false, _floodFcAt = null;
  function refreshRegime() {
    var now = Date.now();
    if (_fetching || now - _fetchedAt < 20000) return;         // tối đa ~20s/lần
    _fetching = true; _fetchedAt = now;
    fetch("flood_live_status.json?_=" + now, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) {
        if (s) {
          var st = s.stats || {}, lv = s.levels || {}, bl = s.baseline || {}, ob = false;
          if (+st.n_overbank_cells > 0) ob = true;
          if (s.computed && s.computed !== "skipped-dry") ob = true;
          ["chu_le", "hoa_duyet"].forEach(function (k) {
            var v = lv[k] && lv[k].v, b = bl[k];
            if (v != null && b != null && +v >= +b) ob = true;
          });
          _regime = ob ? "lu" : "can";
          _floodFcAt = (s.source_freshness && s.source_freshness.forecast_generated_at) ? new Date(s.source_freshness.forecast_generated_at) : null;
        }
      })
      .catch(function () {})
      .then(function () { _fetching = false; });
  }

  function _mins(reg) {
    var F = (window.HYDRO_SETTINGS && window.HYDRO_SETTINGS.freshness) || {};
    var d = (reg === "lu") ? { x: 1, v: 2 } : { x: 3, v: 6 };   // GIỜ mặc định
    var s = F[reg === "lu" ? "lu" : "can"] || {};
    var x = parseFloat(s.xanh), v = parseFloat(s.vang);
    return { xanh: (isFinite(x) && x > 0 ? x : d.x) * 60, vang: (isFinite(v) && v > 0 ? v : d.v) * 60 };
  }
  function _thapMins() {
    var F = (window.HYDRO_SETTINGS && window.HYDRO_SETTINGS.freshness) || {}, s = F.thap || {};
    var x = parseFloat(s.xanh), v = parseFloat(s.vang);
    return { xanh: (isFinite(x) && x > 0 ? x : 15), vang: (isFinite(v) && v > 0 ? v : 60) }; // PHÚT
  }

  function _apply(ageMin, T) {
    if (ageMin == null || !isFinite(ageMin)) return { color: COL.ok, level: "unknown" };
    if (ageMin > T.vang) return { color: COL.err, level: "red" };
    if (ageMin > T.xanh) return { color: COL.warn, level: "yellow" };
    return { color: COL.ok, level: "green" };
  }

  // Nguồn thường (trạm, đập, Tank…): màu theo bộ lu/can hiện hành.
  function band(ageMin, regimeOverride) {
    refreshRegime();
    return _apply(ageMin, _mins(regimeOverride || _regime));
  }
  // Tháp ở MODE HOẠT ĐỘNG: bộ thap 15/60.
  function tower(ageMin) { return _apply(ageMin, _thapMins()); }

  function _2(n) { return String(n).padStart(2, "0"); }
  function _d(ms) { var d = new Date(ms); return isNaN(d) ? null : d; }
  function hm(ms) { var d = _d(ms); return d ? _2(d.getHours()) + ":" + _2(d.getMinutes()) : "—"; }
  function hmd(ms) { var d = _d(ms); return d ? _2(d.getHours()) + ":" + _2(d.getMinutes()) + " " + _2(d.getDate()) + "/" + _2(d.getMonth() + 1) : "—"; }
  function ago(min) {
    if (min == null || !isFinite(min)) return "";
    var m = Math.max(0, Math.round(min));
    if (m < 1) return "vừa xong";
    if (m < 60) return m + " phút trước";
    var h = m / 60;
    if (h < 24) return (Math.round(h * 10) / 10).toString().replace(".", ",") + " giờ trước";
    return Math.floor(h / 24) + " ngày trước";
  }

  window.HHTFresh = {
    band: band, tower: tower,
    regime: function () { refreshRegime(); return _regime; },
    refreshRegime: refreshRegime,
    floodFcAt: function () { refreshRegime(); return _floodFcAt; },
    sev: function (l) { return l === "red" ? 2 : l === "yellow" ? 1 : 0; },
    colors: COL, hm: hm, hmd: hmd, ago: ago
  };
  refreshRegime();
})();
