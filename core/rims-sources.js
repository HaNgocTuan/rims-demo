/* =============================================================================
 * rims-sources.js  ·  RIMS  ·  SỔ ĐĂNG KÝ NGUỒN DỮ LIỆU (runtime)
 * -----------------------------------------------------------------------------
 * Ba việc, chỉ ba việc:
 *   1. NẠP + KIỂM TRA  data/sources.json  → mọi nguồn đều khai báo được, máy đọc được.
 *   2. PHÂN GIẢI KHOÁ  theo 'key_ref' → giá trị lấy từ config/secret. Sổ đăng ký
 *      chỉ biết TÊN khoá; giá trị không bao giờ nằm trong sources.json.
 *   3. CẮM NGUỒN       registerAdapter() cho nguồn cần biến đổi dữ liệu riêng.
 *
 * Giao diện Cài đặt (settings.html) đọc thẳng từ đây → không có nguồn nào chạy
 * "ngầm" trong mã mà người quản trị không nhìn thấy.
 *
 * AN TOAN: getKey() tra gia tri khoa cho tang goi API; hasKey()/maskKey() dung
 *   cho hien thi. TUYET DOI khong log gia tri khoa ra console.
 * =========================================================================== */
(function (global) {
  "use strict";

  var VERSION = "0.1";
  var DEFAULT_FILE = "data/sources.json";

  var _doc = null;            // nội dung sources.json
  var _byId = {};             // id -> nguồn
  var _adapters = {};         // id -> adapter đã đăng ký
  var _health = {};           // id -> { ok, at, note }
  var _disabled = {};         // id -> true (người dùng tắt trong Cài đặt)

  /* --------------------------------------------------------------------- */
  /* Khoá: sổ đăng ký chỉ ghi TÊN, giá trị lấy từ đây                       */
  /* --------------------------------------------------------------------- */
  function keyStore() {
    // Thứ tự ưu tiên: RIMS_SECRET (secret.local.js) → HYDRO_SETTINGS (tương thích ngược)
    var s = global.RIMS_SECRET || {};
    var h = global.HYDRO_SETTINGS || {};
    return {
      RMA_API_KEY: s.RMA_API_KEY || h.rmaKey || "",
      VNWIS_TOKEN: s.VNWIS_TOKEN || ""
    };
  }

  function getKey(ref) {
    if (!ref) return "";
    return keyStore()[ref] || "";
  }

  function hasKey(ref) { return !!getKey(ref); }

  function maskKey(ref) {
    var v = getKey(ref);
    if (!v) return "(chưa cấu hình)";
    if (v.length <= 8) return "••••";
    return v.slice(0, 3) + "••••••" + v.slice(-3);
  }

  /* --------------------------------------------------------------------- */
  /* Kiểm tra tính hợp lệ của một khai báo nguồn                            */
  /* --------------------------------------------------------------------- */
  var BAT_BUOC = ["id", "ten", "nha_cung_cap", "phan_loai", "trang_thai", "cap_du_lieu"];

  function validate(n) {
    var loi = [];
    BAT_BUOC.forEach(function (k) {
      if (n[k] === undefined || n[k] === null || n[k] === "") loi.push("thiếu trường bắt buộc: " + k);
    });
    if (n.trang_thai === "hoat_dong" && !n.base_url && (!n.endpoints || !n.endpoints.length)) {
      loi.push("trạng thái 'hoat_dong' nhưng không khai báo base_url/endpoints");
    }
    if (n.auth && n.auth.type === "api_key" && !n.auth.key_ref) {
      loi.push("auth kiểu api_key nhưng thiếu key_ref");
    }
    // chặn rò rỉ: sổ đăng ký không được chứa giá trị khoá
    var raw = JSON.stringify(n);
    if (/"(api_key|token|secret|password)"\s*:\s*"(?!\s*$)[A-Za-z0-9_\-]{12,}"/i.test(raw)) {
      loi.push("NGHI VẤN RÒ RỈ: khai báo chứa chuỗi giống giá trị khoá — sổ đăng ký chỉ được ghi key_ref");
    }
    return loi;
  }

  /* --------------------------------------------------------------------- */
  /* API công khai                                                          */
  /* --------------------------------------------------------------------- */
  var API = {
    version: VERSION,

    /** Nạp sổ đăng ký. Trả về Promise<{ nguon, loi }>. */
    load: function (url) {
      url = url || (global.RIMS_CONFIG && global.RIMS_CONFIG.SOURCES_FILE) || DEFAULT_FILE;
      return fetch(url + "?v=" + Date.now())
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (j) {
          _doc = j;
          _byId = {};
          var loi = [];
          (j.nguon || []).forEach(function (n) {
            if (_byId[n.id]) loi.push(n.id + ": trùng id");
            _byId[n.id] = n;
            validate(n).forEach(function (e) { loi.push(n.id + ": " + e); });
          });
          // khôi phục trạng thái bật/tắt do người dùng đặt
          try {
            var saved = JSON.parse(localStorage.getItem("RIMS_SOURCES_OFF") || "{}");
            _disabled = saved || {};
          } catch (e) { _disabled = {}; }

          if (loi.length) console.warn("[RIMS/sources] khai báo có vấn đề:\n - " + loi.join("\n - "));
          console.log("%c[RIMS] sổ đăng ký nguồn: " + (j.nguon || []).length + " nguồn, " +
                      loi.length + " cảnh báo", "color:#065a82;font-weight:700");
          return { nguon: j.nguon || [], loi: loi };
        });
    },

    doc: function () { return _doc; },
    all: function () { return (_doc && _doc.nguon) || []; },
    get: function (id) { return _byId[id] || null; },

    /** Nguồn theo phân loại (khi_tuong / thuy_van / mo_hinh / gis_nen / …) */
    byCategory: function (cat) {
      return API.all().filter(function (n) { return (n.phan_loai || []).indexOf(cat) >= 0; });
    },

    /** Chỉ những nguồn đang hoạt động VÀ chưa bị tắt trong Cài đặt */
    active: function () {
      return API.all().filter(function (n) {
        return n.trang_thai === "hoat_dong" && !_disabled[n.id];
      });
    },

    /* --- bật / tắt nguồn (người quản trị) ------------------------------- */
    isEnabled: function (id) { return !_disabled[id]; },
    setEnabled: function (id, on) {
      if (on) delete _disabled[id]; else _disabled[id] = true;
      try { localStorage.setItem("RIMS_SOURCES_OFF", JSON.stringify(_disabled)); } catch (e) {}
      return on;
    },

    /* --- khoá ------------------------------------------------------------ */
    getKey: getKey,
    hasKey: hasKey,
    maskKey: maskKey,

    /** Nguồn này đã đủ điều kiện chạy chưa? */
    readiness: function (id) {
      var n = _byId[id];
      if (!n) return { ok: false, ly_do: "không có trong sổ đăng ký" };
      if (n.trang_thai !== "hoat_dong") return { ok: false, ly_do: "trạng thái: " + n.trang_thai };
      if (_disabled[id]) return { ok: false, ly_do: "đã tắt trong Cài đặt" };
      var a = n.auth || {};
      if (a.type === "api_key" && !hasKey(a.key_ref)) {
        return { ok: false, ly_do: "thiếu khoá " + a.key_ref };
      }
      return { ok: true, ly_do: "sẵn sàng" };
    },

    /** Header xác thực dựng sẵn cho một nguồn (dùng ở tầng gọi API). */
    authHeaders: function (id, json) {
      var n = _byId[id]; if (!n || !n.auth) return {};
      var a = n.auth, h = {};
      if (a.type === "api_key" && a.vi_tri === "header") h[a.ten_truong || "x-api-key"] = getKey(a.key_ref);
      if (a.type === "bearer") h["Authorization"] = "Bearer " + getKey(a.key_ref);
      if (json) h["Content-Type"] = "application/json";
      return h;
    },

    /** Ghép base_url + path, không nhân đôi dấu / */
    url: function (id, path) {
      var n = _byId[id]; if (!n || !n.base_url) return null;
      return n.base_url.replace(/\/+$/, "") + "/" + String(path || "").replace(/^\/+/, "");
    },

    /* --- CẮM NGUỒN: đăng ký adapter -------------------------------------- */
    /**
     * registerAdapter(id, impl)
     *   impl = {
     *     mo_ta   : "…",                       // hiển thị trong Cài đặt
     *     check   : function(){ return Promise<{ok, note}> },   // tuỳ chọn — nút "Kiểm tra"
     *     fetch   : function(params){ … },      // lấy dữ liệu thô
     *     toRims  : function(raw){ … }          // chuẩn hoá về schema RIMS
     *   }
     * Adapter KHÔNG được tự chứa khoá — luôn gọi RIMSSources.getKey(ref).
     */
    registerAdapter: function (id, impl) {
      if (!_byId[id]) {
        console.warn("[RIMS/sources] adapter '" + id + "' chưa có khai báo trong sources.json — " +
                     "thêm khối khai báo trước, nếu không nguồn sẽ vô hình với người quản trị.");
      }
      _adapters[id] = impl || {};
      console.log("[RIMS/sources] đã cắm adapter: " + id);
      return _adapters[id];
    },
    adapter: function (id) { return _adapters[id] || null; },
    adapters: function () { return Object.keys(_adapters); },

    /* --- tình trạng hoạt động (adapter tự báo) ---------------------------- */
    report: function (id, st) {
      _health[id] = { ok: !!(st && st.ok), at: new Date().toISOString(), note: (st && st.note) || "" };
      return _health[id];
    },
    health: function (id) { return id ? (_health[id] || null) : _health; },

    /** Chạy check() của adapter nếu có (nút "Kiểm tra" trong Cài đặt) */
    check: function (id) {
      var ad = _adapters[id];
      if (!ad || typeof ad.check !== "function") {
        return Promise.resolve(API.report(id, { ok: false, note: "adapter không hỗ trợ kiểm tra tự động" }));
      }
      return Promise.resolve()
        .then(function () { return ad.check(); })
        .then(function (r) { return API.report(id, r || { ok: true }); })
        .catch(function (e) { return API.report(id, { ok: false, note: String(e && e.message || e) }); });
    }
  };

  global.RIMSSources = API;
})(window);
