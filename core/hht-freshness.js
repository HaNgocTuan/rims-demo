/* hht-freshness.js — MỘT nguồn sự thật cho "độ tươi" toàn hệ
 * ---------------------------------------------------------------------------
 * BÊ TỪ HydroNet Hà Tĩnh (app/viewer/hht-freshness.js), theo QUYẾT ĐỊNH
 * 28/08/2026 §1–§4. Xem docs/PORT_LOG.md — mốc RIMS-04.
 *
 * Nguyên lý (giữ nguyên của HydroNet):
 *  - Màu = THỜI GIAN TUYỆT ĐỐI, KHÔNG theo nhịp nguồn. Nó trả lời "lúc này có
 *    tin được số này để ra quyết định không", chứ không phải "cảm biến còn
 *    khoẻ không". Một trạm báo đều đặn 6 tiếng một lần vẫn là số CŨ khi lũ về.
 *  - Hai bộ ngưỡng theo chế độ: lu (lũ) / can (cạn) — mặc định lu{1h,2h},
 *    can{3h,6h}. Lũ về thì cùng một con số 90 phút tuổi đã là đáng ngại, còn
 *    mùa cạn thì chưa.
 *  - Dải: tuổi ≤ xanh → XANH (TRUNG TÍNH, xám) · xanh<tuổi≤vàng → VÀNG ·
 *    tuổi>vàng → ĐỎ. Chỉ vàng/đỏ mới "nổi"; xanh để trung tính cho khỏi nhờn
 *    màu — màn hình 3.713 chấm mà chấm nào cũng xanh lá thì mắt bỏ qua hết.
 *  - Số ngưỡng đọc từ HYDRO_SETTINGS.freshness, người dùng chỉnh được.
 *
 * ⚑ KHÁC HYDRONET ĐÚNG MỘT ĐIỂM — NGUỒN QUYẾT ĐỊNH CHẾ ĐỘ LŨ/CẠN.
 *   HydroNet đọc `flood_live_status.json` do engine ngập lụt Ngàn Sâu sinh ra.
 *   RIMS chưa có engine đó, và ở quy mô toàn quốc thì "đang lũ" cũng không còn
 *   là một trạng thái duy nhất cho cả nước — Bắc Bộ lũ trong khi Nam Bộ cạn.
 *   Nên ở đây:
 *     · Đường dẫn trạng thái lấy từ RIMS_CONFIG.REGIME_URL. Bỏ trống (mặc
 *       định) thì KHÔNG gọi mạng và giữ chế độ "cạn" — ngưỡng rộng 3h/6h.
 *     · Đặt tay bằng HHTFresh.setRegime('lu'|'can') khi cần.
 *   Việc phải làm về sau: chế độ theo TỪNG LƯU VỰC, không phải một cờ toàn
 *   quốc. Ghi trong docs/PORT_LOG.md.
 *
 * Đăng ký: window.HHTFresh. Idempotent (nạp nhiều lần không đè).
 */
(function () {
  "use strict";
  if (window.HHTFresh) return;

  var COL = { ok: "#9aa1a9", warn: "#e0b34a", err: "#e3564d" }; // xanh trung tính · vàng · đỏ

  var _regime = "can", _fetchedAt = 0, _fetching = false, _floodFcAt = null, _tay = false;

  function _regimeUrl() {
    var u = (window.RIMS_CONFIG && window.RIMS_CONFIG.REGIME_URL) || null;
    return (typeof u === "string" && u) ? u : null;
  }

  function refreshRegime() {
    if (_tay) return;                                          // đã đặt tay thì tôn trọng
    var url = _regimeUrl();
    if (!url) return;                                          // RIMS chưa nối engine → giữ "can"
    var now = Date.now();
    if (_fetching || now - _fetchedAt < 20000) return;         // tối đa ~20s/lần
    _fetching = true; _fetchedAt = now;
    fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "_=" + now, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) {
        if (s) {
          var st = s.stats || {}, lv = s.levels || {}, bl = s.baseline || {}, ob = false;
          if (+st.n_overbank_cells > 0) ob = true;
          if (s.computed && s.computed !== "skipped-dry") ob = true;
          Object.keys(lv).forEach(function (k) {
            var v = lv[k] && lv[k].v, b = bl[k];
            if (v != null && b != null && +v >= +b) ob = true;
          });
          _regime = ob ? "lu" : "can";
          _floodFcAt = (s.source_freshness && s.source_freshness.forecast_generated_at)
            ? new Date(s.source_freshness.forecast_generated_at) : null;
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
    /* ⚑ THÊM SO VỚI HYDRONET: đặt chế độ bằng tay, vì RIMS chưa có engine
       ngập lụt để tự suy. Gọi setRegime(null) để trả lại tự động.        */
    setRegime: function (r) {
      if (r === null || r === undefined) { _tay = false; return _regime; }
      _tay = true; _regime = (r === "lu") ? "lu" : "can"; return _regime;
    },
    dangDatTay: function () { return _tay; },
    nguongPhut: function () { return _mins(_regime); },
    refreshRegime: refreshRegime,
    floodFcAt: function () { refreshRegime(); return _floodFcAt; },
    sev: function (l) { return l === "red" ? 2 : l === "yellow" ? 1 : 0; },
    colors: COL, hm: hm, hmd: hmd, ago: ago
  };
  refreshRegime();
})();
