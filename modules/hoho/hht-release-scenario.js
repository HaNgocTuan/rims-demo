/* hht-release-scenario.js — VẼ ĐÈ kịch bản xả Hố Hô lên biểu đồ console ĐẬP.
   ─────────────────────────────────────────────────────────────────────────────
   Điều khiển kịch bản xả ĐÃ DỜI về công cụ "Dự báo hệ thống" (topbar, toàn cục).
   File này chỉ còn:
     • Nghe TRẠNG THÁI TOÀN CỤC (localStorage 'hnt_scenario'): dạng "có đập" → đọc
       hoho_release_scenario.json (do công cụ dựng qua /api/hoho/release) và VẼ ĐÈ;
       "tự nhiên" → ẩn overlay.
     • Cung cấp window.HHT_releaseOverlay(ctx) để draw() console gọi ở cuối:
       xả (m³/s, trục Q) + mực hồ Zres (m, trục MN, đứt nét) + huy hiệu KỊCH BẢN XẢ.
   Hỗ trợ ra quyết định PCTT — không phải lệnh vận hành. */
(function () {
  "use strict";
  var COLORS = ["#1a73e8", "#d93025", "#188038", "#a142f4"];
  var STATE = { data: null, visible: false };
  window.__hhtRelease = null;
  function tms(s) { return new Date(String(s).replace(" ", "T")).getTime(); }

  // ── VẼ ĐÈ (draw() gọi qua hook) ──────────────────────────────────────────
  window.HHT_releaseOverlay = function (ctx) {
    if (!STATE.visible || !STATE.data || !STATE.data.scenarios) return;
    var d = STATE.data, root = ctx.root, el = ctx.el, Xt = ctx.Xt, Yq = ctx.Yq,
        Yz = ctx.Yz, domA = ctx.domA, domB = ctx.domB, W0 = ctx.W0, PR = ctx.PR, hdTop = ctx.hdTop;
    var gx = d.grid_t.map(tms);
    function pts(arr, Yf) {
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        var x = gx[i]; if (x < domA || x > domB) continue;
        var v = arr[i]; if (v == null || isNaN(v)) continue;
        out.push(Xt(x) + "," + Yf(v));
      }
      return out;
    }
    function poly(p, stroke, w, dash, op) {
      if (p.length < 2) return;
      var a = { points: p.join(" "), fill: "none", stroke: stroke, "stroke-width": w,
                "stroke-linejoin": "round", "stroke-linecap": "round" };
      if (dash) a["stroke-dasharray"] = dash;
      if (op != null) a["stroke-opacity"] = op;
      root.appendChild(el("polyline", a));
    }
    d.scenarios.forEach(function (s, k) {
      var c = COLORS[k % COLORS.length];
      poly(pts(s.Zres, Yz), c, 1.5, "5 4", 0.75);
      var pr = pts(s.release, Yq);
      poly(pr, c, 2.6, null, 0.98);
      if (pr.length) {
        var im = 0, mx = -1e9;
        for (var i = 0; i < s.release.length; i++) if (s.release[i] > mx && gx[i] >= domA && gx[i] <= domB) { mx = s.release[i]; im = i; }
        if (mx > -1e9) root.appendChild(el("circle", { cx: Xt(gx[im]), cy: Yq(mx), r: 3.2, fill: c, stroke: "#12161c", "stroke-width": 1.2 }));
      }
    });
    var bx = W0 - PR - 244, by = hdTop + 8;
    root.appendChild(el("rect", { x: bx, y: by, width: 236, height: 15 + 14 * d.scenarios.length,
      rx: 5, fill: "rgba(18,22,28,.82)", stroke: "#d9822b", "stroke-width": 1, "stroke-dasharray": "3 2" }));
    var badge = el("text", { x: bx + 8, y: by + 12, fill: "#d9822b", "font-size": 11, "font-weight": 700 });
    badge.textContent = "KỊCH BẢN XẢ" + (d.mode === "demo" ? " (DEMO)" : "")
      + (d.mode === "live-high" ? (d.high_source === "fallback_current" ? " · Lớn nhất (tạm=Hiện tại)" : " · Lớn nhất") : "")
      + (d.scenarios[0] && d.scenarios[0].turbine_on === false ? " · tắt máy" : "");
    root.appendChild(badge);
    d.scenarios.forEach(function (s, k) {
      var y = by + 26 + 14 * k, c = COLORS[k % COLORS.length];
      root.appendChild(el("rect", { x: bx + 8, y: y - 8, width: 12, height: 4, rx: 1, fill: c }));
      var t = el("text", { x: bx + 26, y: y - 2, fill: "#c9ced6", "font-size": 10.5 });
      t.textContent = "Đón lũ " + s.don_lu.toFixed(1) + " m — xả đỉnh " + Math.round(s.peak_release) + " · trữ " + s.store_Mm3.toFixed(1) + " tr m³";
      root.appendChild(t);
    });
  };

  // ── đồng bộ theo TRẠNG THÁI TOÀN CỤC ─────────────────────────────────────
  function showData(d) { STATE.data = d; window.__hhtRelease = d; STATE.visible = true; if (window.__hhtRedraw) window.__hhtRedraw(); }
  function hide() { if (!STATE.visible) return; STATE.visible = false; if (window.__hhtRedraw) window.__hhtRedraw(); }
  function gs() { try { return JSON.parse(localStorage.getItem("hnt_scenario") || "null") || {}; } catch (e) { return {}; } }
  function apply() {
    var s = gs();
    if (s.dang === "damop") {
      fetch("hoho_release_scenario.json?_=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.scenarios) showData(d); })
        .catch(function () {});
    } else { hide(); }
  }
  window.addEventListener("storage", function (e) { if (e.key === "hnt_scenario") apply(); });
  window.addEventListener("hnt:scenario", apply);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();
