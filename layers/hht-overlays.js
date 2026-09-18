/* ===========================================================================
 * hht-overlays.js — HydroNet Hà Tĩnh — LỚP GIAO THÔNG (thuần)
 *   • Đường       : roads_main (QL/TL) + roads_other (GT_khac)
 *   • Cầu/vượt dòng: crossings (Tràn tô đỏ)
 * (Thôn/cảnh báo đã tách sang hamlet-warn-layer.js)
 * Khuôn buildings-layer.js: nạp lười, ?v= chống cache, pane riêng, mặc định TẮT.
 * Gọi: HHTOverlays.init(window.HYDRO_MAP)
 * ===========================================================================*/
(function (global) {
  "use strict";
  var DATA_DIR = "./", V = "?v=" + Date.now();
  var Z_MAIN = 10, Z_OTHER = 13, Z_CROSS = 12, Z_LABEL = 12;
  // TẠM (chờ #49): nắn datum lô curated 'ten_thuyhe' về WGS84 chuẩn — đo từ mat_nuoc_tinh↔water_surface = +195m Đông/−111m Bắc (độ tản 1m).
  var LBL_DLON = 0.001844, LBL_DLAT = -0.000997;
  var map = null, on = { roads: false, cross: false, hydro: false, dam: false }, cache = {};
  var lyr = { main: null, other: null, cross: null, hydro: null, dam: null, labels: null };
  // Vùng quan tâm (AOI) = LƯU VỰC DỰ ÁN: Hòa Duyệt ∪ Ngàn Trươi (ChuLe/HoHo ⊂ HoaDuyet).
  //   Lớp Sông hồ GIẤU mọi mặt nước/sông NGOÀI vùng này — lọc tại render theo TÂM feature, KHÔNG sửa data
  //   (bật/tắt lớp là hiện lại đủ). Fail-open: chưa nạp được ranh → hiện TẤT CẢ (không mất dữ liệu).
  var AOI_FILES = ["data/luuvuc/LV_HoaDuyet.geojson", "data/luuvuc/LV_NganTruoi.geojson"];
  var _aoiRings = null;

  function panes() {
    [["hntWater", 405], ["hntRiver", 406], ["hntLabel", 407], ["hntRoadsOther", 408], ["hntRoadsMain", 420], ["hntCross", 440], ["hntDam", 450]].forEach(function (p) {
      if (!map.getPane(p[0])) { map.createPane(p[0]); map.getPane(p[0]).style.zIndex = p[1]; }
    });
  }
  // #4 (D-13): ưu tiên đọc URL qua HHTData.getLayerUrl(id) nếu adapter đã nạp; chưa có -> dùng đường dẫn tĩnh (lùi-tương-thích, URL y hệt).
  function resolve(id, file) {
    if (id && global.HHTData && typeof global.HHTData.getLayerUrl === "function") {
      try { var u = global.HHTData.getLayerUrl(id); if (u) return u; } catch (e) { /* lớp chưa khai / đa-file -> fallback tĩnh */ }
    }
    return file;
  }
  // #3: vệ sinh tên — bỏ null / "nan" / "<Null>" / ký tự điều khiển trước khi render.
  function cleanName(s) {
    if (s === null || s === undefined) return "";
    s = String(s).replace(/[\u0000-\u001f]/g, "").trim();
    var low = s.toLowerCase();
    if (!s || low === "nan" || low === "null" || low === "none" || low === "<null>") return "";
    return s;
  }
  function load(file, cb, id) {
    var path = resolve(id, file);
    if (cache[path]) { cb(cache[path]); return; }
    fetch(DATA_DIR + path + V).then(function (r) { if (!r.ok) throw new Error(path + " " + r.status); return r.json(); })
      .then(function (g) { cache[path] = g; cb(g); }).catch(function (e) { console.error("[hht-overlays] " + e.message); });
  }
  // ── Lọc theo VÙNG DỰ ÁN (AOI) — giấu Sông hồ ngoài lưu vực ──
  function _aoiAddRings(g, out) {
    (g.features || [g]).forEach(function (f) { var gt = (f.geometry || f); if (!gt || !gt.coordinates) return;
      if (gt.type === "Polygon") out.push(gt.coordinates[0]);
      else if (gt.type === "MultiPolygon") gt.coordinates.forEach(function (p) { out.push(p[0]); }); });
  }
  function _pipRing(x, y, ring) { var c = false, n = ring.length, j = n - 1;
    for (var i = 0; i < n; i++) { var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; j = i; } return c; }
  function _inAOI(lng, lat) { if (!_aoiRings) return true; for (var k = 0; k < _aoiRings.length; k++) if (_pipRing(lng, lat, _aoiRings[k])) return true; return false; }
  function _centroid(geom) { if (!geom) return null;
    var ring = geom.type === "Polygon" ? geom.coordinates[0] : (geom.type === "MultiPolygon" ? geom.coordinates[0][0] : null);
    if (!ring || !ring.length) return null; var sx = 0, sy = 0, n = ring.length;
    for (var i = 0; i < n; i++) { sx += ring[i][0]; sy += ring[i][1]; } return [sx / n, sy / n]; }
  // Chỉ giữ feature có TÂM trong vùng dự án. _aoiRings=null → giữ nguyên (fail-open, không mất dữ liệu).
  function clipAOI(fc) {
    if (!_aoiRings || !fc || !fc.features) return fc;
    return { type: "FeatureCollection", features: fc.features.filter(function (f) {
      var c = _centroid(f.geometry); return c ? _inAOI(c[0], c[1]) : true; }) };
  }
  function loadAOI() {
    var rings = [], pending = AOI_FILES.length;
    AOI_FILES.forEach(function (file) {
      load(file, function (g) { _aoiAddRings(g, rings);
        if (--pending === 0) { _aoiRings = rings.length ? rings : null;
          // Sông hồ đang bật → dựng lại lớp mặt nước + nhãn để áp bộ lọc (chạy sau khi nạp ranh xong)
          if (on.hydro) {
            if (lyr.hydro) { map.removeLayer(lyr.hydro); lyr.hydro = null; }
            if (lyr.labels) { map.removeLayer(lyr.labels); lyr.labels = null; }
            refresh();
          } } });
    });
  }
  function sMainCase() { return { color: "#fff", weight: 6, opacity: .9 }; }
  function sMainLine() { return { color: "#d1495b", weight: 3, opacity: 1 }; }
  function sOther()    { return { color: "#9a8c98", weight: 1, opacity: .7 }; }
  function midpoint(c) { if (!c || !c.length) return null; var i = Math.floor(c.length / 2); return [c[i][1], c[i][0]]; }

  function buildMain(g) {
    return L.layerGroup([
      L.geoJSON(g, { pane: "hntRoadsMain", style: sMainCase }),
      L.geoJSON(g, { pane: "hntRoadsMain", style: sMainLine,
        onEachFeature: function (f, l) { if (f.properties && f.properties.ten) l.bindTooltip(f.properties.ten, { sticky: true }); } })
    ]);
  }
  function buildOther(g) { return L.geoJSON(g, { pane: "hntRoadsOther", style: sOther }); }
  // Lớp gộp "Sông ngòi, hồ ao" = mặt nước tĩnh + sông + lòng hồ Hố Hô (1 toggle)
  // === Danh mục hồ chứa (Biểu 6) -> làm giàu popup lớp Sông hồ ===
  function _deburr(s){ return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim(); }
  function _kshort(s){ var t=_deburr(s).split(" "); while(t.length && (t[0]==="ho"||t[0]==="dap"||t[0]==="khe")) t=t.slice(1); return t.join(" "); }
  function buildResvIndex(cat){
    var idx={}, byTt={};
    // Ghép theo TÊN (không toạ độ): chỉ số theo khoá có sẵn + tự tính từ tên (bỏ tiền tố hồ/đập/khe). Nâng khớp 5→8 hồ, không nhầm.
    (cat.ho||[]).forEach(function(r){ byTt[r.tt]=r;
      [r.key_full, r.key_short, _deburr(r.ten), _kshort(r.ten)].forEach(function(k){ if(k && !(k in idx)) idx[k]=r; }); });
    // alias xác nhận thủ công (tên water_surface viết khác danh mục):
    var ALIAS={ "khe muc bai":7 };           // 'hồ Khe Mục Bài' -> #7 Hồ Mục Bài
    // (nếu 'hồ Đá Bạc - Hương Bình' mới là #8 thì thêm: "da bac huong binh":8)
    Object.keys(ALIAS).forEach(function(k){ if(byTt[ALIAS[k]]) idx[k]=byTt[ALIAS[k]]; });
    return idx;
  }
  function lookupResv(idx, ten){ return idx[_deburr(ten)] || idx[_kshort(ten)] || null; }
  // Popup bảng 3 cột (thông số / đơn vị / giá trị) — ĐỒNG BỘ damPopup; phân nhóm theo Biểu 6 Excel.
  function reservoirPopup(r){
    function row(ten, dv, v){
      if(v===null||v===undefined||v==="") return "";
      var isNum = (typeof v==="number"); if(isNum && v===0) return "";
      var val = isNum ? String(v).replace(".",",") : String(v);
      var unit = isNum ? (dv||"") : "";   // chỉ hiện đơn vị khi giá trị là số
      return "<tr><td style='padding:2px 10px 2px 0;color:#9aa1a9;vertical-align:top'>"+ten+
        "</td><td style='padding:2px 10px 2px 0;color:#cfd2d6;white-space:nowrap;vertical-align:top'>"+unit+
        "</td><td style='padding:2px 0;font-weight:600;vertical-align:top'>"+val+"</td></tr>";
    }
    function grp(title, body){ if(!body) return "";
      return "<tr><td colspan='3' style='padding:6px 0 1px;color:#5fb6e6;font-weight:700;font-size:9.5px;letter-spacing:.4px'>"
        +title.toUpperCase()+"</td></tr>"+body; }
    var g1 = row("Dung tích MNDBT","×10⁶ m³",r.w_trieu_m3)+row("F lưu vực","km²",r.flv_km2)
           + row("F tưới thiết kế","ha",r.ftuoi_tk_ha)+row("F tưới thực tế","ha",r.ftuoi_tt_ha);
    var g2 = row("MNDBT","m",r.mndbt_m)+row("Cao trình đỉnh đập","m",r.cao_dinh_dap_m)
           + row("Bề rộng đập","m",r.b_dap_m)+row("Chiều cao Hmax","m",r.hmax_m)+row("Chiều dài L","m",r.l_dap_m);
    var g3 = row("Cao trình tràn","m",r.cao_tran_m)+row("Bề rộng tràn","m",r.b_tran_m)
           + row("Lưu lượng xả TK","m³/s",r.qtk_m3s)+row("Kết cấu","",r.ket_cau_tran);
    var g4 = row("Cao trình đáy cống","m",r.cao_day_cong_m)+row("Kích thước cống","",r.kichthuoc_cong);
    var head = "<b>"+r.ten+"</b><div style='color:#9aa1a9;font-size:10px;margin:1px 0 3px'>"
      +(r.dia_diem||"")+(r.nam?(" · XD "+r.nam):"")+"</div>";
    return head+"<table style='border-collapse:collapse;font-size:11px;line-height:1.35;margin-top:5px'>"
      +grp("Hồ chứa",g1)+grp("Đập",g2)+grp("Tràn xả lũ",g3)+grp("Cống lấy nước",g4)
      +"</table><div style='margin-top:5px;opacity:.6;font-size:10px'>Nguồn: Biểu 6 — Danh mục hồ chứa phân cấp địa phương</div>";
  }
  // #1: bảng thông số hồ đọc THẲNG từ thuộc tính feature (nguồn CtyTL-HaTinh-2024 nhúng sẵn trong water_surface).
  function wsHasParams(p) {
    return !!(p && (p.mndbt != null || p.mndgc != null || p.dung_tich_ho != null || p.qxa_tk != null || p.ct_dinh_dap != null));
  }
  function wsRow(ten, dv, v) {
    if (v === null || v === undefined || v === "") return "";
    var isNum = (typeof v === "number"); if (isNum && v === 0) return "";
    var val = isNum ? String(v).replace(".", ",") : String(v);
    var unit = isNum ? (dv || "") : "";
    return "<tr><td style='padding:2px 10px 2px 0;color:#9aa1a9;vertical-align:top'>" + ten +
      "</td><td style='padding:2px 10px 2px 0;color:#cfd2d6;white-space:nowrap;vertical-align:top'>" + unit +
      "</td><td style='padding:2px 0;font-weight:600;vertical-align:top'>" + val + "</td></tr>";
  }
  function wsGrp(title, body) { if (!body) return "";
    return "<tr><td colspan='3' style='padding:6px 0 1px;color:#5fb6e6;font-weight:700;font-size:9.5px;letter-spacing:.4px'>"
      + title.toUpperCase() + "</td></tr>" + body; }
  function wsPopup(p) {
    var g0 = wsRow("Nhiệm vụ", "", cleanName(p.nhiem_vu)) + wsRow("Phân loại", "", cleanName(p.phan_loai))
           + wsRow("Chế độ điều tiết", "", cleanName(p.che_do_dieu_tiet)) + wsRow("F lưu vực", "km²", p.dt_luu_vuc_km2);
    var g1 = wsRow("Dung tích hồ", "×10⁶ m³", p.dung_tich_ho) + wsRow("Dung tích chết", "×10⁶ m³", p.dung_tich_chet)
           + wsRow("DT điều tiết lũ", "×10⁶ m³", p.dt_dieu_tiet_lu);
    var g2 = wsRow("MNDBT", "m", p.mndbt) + wsRow("MNDGC", "m", p.mndgc) + wsRow("MNC", "m", p.mnc);
    var g3 = wsRow("Cao trình đỉnh đập", "m", p.ct_dinh_dap) + wsRow("Dài đỉnh đập", "m", p.dai_dinh_dap) + wsRow("Rộng đỉnh đập", "m", p.rong_dinh_dap);
    var g4 = wsRow("Loại tràn", "", cleanName(p.loai_tran)) + wsRow("Kết cấu tràn", "", cleanName(p.ket_cau_tran))
           + wsRow("Q xả thiết kế", "m³/s", p.qxa_tk) + wsRow("CT ngưỡng tràn", "", cleanName(p.ct_nguong_tran)) + wsRow("Rộng tràn", "", cleanName(p.rong_tran));
    var ten = cleanName(p.ten_chinhthuc) || cleanName(p.ten) || "Hồ/ao";
    var sub = [cleanName(p.xa_quanly), p.nam_xd ? ("XD " + p.nam_xd) : ""].filter(Boolean).join(" · ");
    var head = "<b>" + ten + "</b>" + (sub ? "<div style='color:#9aa1a9;font-size:10px;margin:1px 0 3px'>" + sub + "</div>" : "");
    var src = cleanName(p.src);
    return head + "<table style='border-collapse:collapse;font-size:11px;line-height:1.35;margin-top:5px'>"
      + wsGrp("Hồ chứa", g0 + g1) + wsGrp("Mực nước", g2) + wsGrp("Đập", g3) + wsGrp("Tràn xả lũ", g4)
      + "</table>" + (src ? "<div style='margin-top:5px;opacity:.6;font-size:10px'>Nguồn: " + src + "</div>" : "");
  }
  // #2 (nắn datum TẠM): nhãn tên thuỷ hệ ten_thuyhe — dịch mỗi điểm +LBL_DLON/+LBL_DLAT về khung WGS84 chuẩn; hiện khi zoom>=Z_LABEL; không chặn click.
  function buildLabels(g) {
    var grp = L.layerGroup();
    (g.features || []).forEach(function (f) {
      var gt = f.geometry || {}; if (gt.type !== "Point") return;
      var t = cleanName(f.properties && f.properties.TEXTSTRING); if (!t) return;
      var c = gt.coordinates;
      if (_aoiRings && !_inAOI(c[0] + LBL_DLON, c[1] + LBL_DLAT)) return;   // giấu nhãn NGOÀI vùng dự án (theo vị trí đã nắn)
      L.marker([c[1] + LBL_DLAT, c[0] + LBL_DLON], { pane: "hntLabel", interactive: false,
        icon: L.divIcon({ className: "hnt-hydro-lbl", iconSize: [0, 0],
          html: "<span>" + t.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span>" }) }).addTo(grp);
    });
    return grp;
  }
  function buildHydro(g) {
    var grp = L.layerGroup();
    // #1: mỗi mặt nước — feature có sẵn tham số hồ (CtyTL 2024) thì nổ bảng ngay từ props; không có thì chỉ hiện tên.
    var hydW = L.geoJSON(clipAOI(g), { pane: "hntWater", style: { color: "#3a9bdb", weight: 0.6, fillColor: "#3a9bdb", fillOpacity: .55 },
      onEachFeature: function (f, l) {
        var p = f.properties || {}, t = cleanName(p.ten_chinhthuc) || cleanName(p.ten);
        if (wsHasParams(p)) l.bindPopup(wsPopup(p), { maxWidth: 340 });
        else if (t) l.bindPopup("<b>" + t + "</b>");
        if (t) l.bindTooltip(t, { sticky: true });
      } });
    grp.addLayer(hydW);
    // Fallback: hồ CHƯA có tham số trong feature -> mới tra danh mục Biểu 6 theo tên. Lỗi tải danh mục -> vẫn giữ tên.
    load("reservoirs_catalog.json", function (cat) {
      var idx = buildResvIndex(cat);
      hydW.eachLayer(function (l) {
        var p = (l.feature && l.feature.properties) || {}; if (wsHasParams(p)) return;
        var t = cleanName(p.ten); if (!t) return;
        var r = lookupResv(idx, t);
        if (r) l.bindPopup(reservoirPopup(r), { maxWidth: 340 });
      });
    });
    load("rivers.geojson", function (rg) {
      grp.addLayer(L.geoJSON(clipAOI(rg), { pane: "hntRiver", style: { color: "#2e86c1", weight: 0.6, fillColor: "#5dade2", fillOpacity: .5 },
        onEachFeature: function (f, l) { var t = cleanName(f.properties && f.properties.ten); if (t && t.toLowerCase() !== "sông") l.bindTooltip(t, { sticky: true }); } }));
    }, "rivers");
    load("hoho_reservoir.geojson", function (hg) {
      grp.addLayer(L.geoJSON(hg, { pane: "hntWater", style: { color: "#0d6efd", weight: 1.5, fillColor: "#4dabf7", fillOpacity: .8 },
        onEachFeature: function (f, l) { var p = f.properties || {};
          l.bindPopup("<b>hồ thủy điện Hố Hô</b><br>~" + p.dien_tich_ha + " ha @ MNDBT 70m<br><small>" + cleanName(p.nguon) + "</small>")
           .bindTooltip("hồ Hố Hô", { sticky: true }); } }));
    }, "hoho_reservoir");
    return grp;
  }
  // Lớp "Đê điều, đập nước" — hiện có 2 đập (đê không có tuyến nào trong lưu vực)
  // Suy id module đập từ tên (hoặc dùng p.mid nếu geojson đã có): "Hố Hô"->dam.hoho, "Ngàn Trươi"->dam.ngantruoi
  function damModuleId(p) {
    if (p.mid) return p.mid;
    var t = _deburr(p.ten || "");
    if (t.indexOf("ngan truoi") >= 0) return "dam.ngantruoi";
    if (t.indexOf("ho ho") >= 0) return "dam.hoho";
    return "";
  }
  // Nút "Theo dõi" -> mở console đối tượng ở băng phải (HHTHost.openModule); chưa có console -> báo.
  function watchBtn(mid, what) {
    var m = (mid || "").replace(/'/g, "");
    return "<button onclick=\"(function(){var H=window.HHTHost;if(H&&H.byId&&H.byId['" + m + "']){H.openModule('" + m +
      "');}else{alert('Màn hình theo dõi " + (what || "đối tượng") + " chưa sẵn — sẽ mở ở băng phải khi có console.');}})()\" " +
      "style='margin-top:7px;width:100%;appearance:none;border:0;cursor:pointer;background:#1f93e3;color:#fff;" +
      "font:600 12px/1 \"Be Vietnam Pro\",system-ui,sans-serif;padding:7px 10px;border-radius:7px'>👁 Theo dõi</button>";
  }
  function damPopup(p) {
    var rows = (p.bang || []).map(function (r) {
      return "<tr><td style='padding:2px 10px 2px 0;color:#9aa1a9;vertical-align:top'>" + r[0] +
             "</td><td style='padding:2px 10px 2px 0;color:#cfd2d6;white-space:nowrap;vertical-align:top'>" + (r[1] || "") +
             "</td><td style='padding:2px 0;font-weight:600;vertical-align:top'>" + r[2] + "</td></tr>";
    }).join("");
    return "<b>" + p.ten + "</b>" +
      "<table style='border-collapse:collapse;font-size:11px;line-height:1.35;margin-top:5px'>" + rows + "</table>" +
      (p.src ? "<div style='margin-top:5px;opacity:.6;font-size:10px'>" + p.src + "</div>" : "") +
      watchBtn(damModuleId(p), "đập");
  }
  function damIcon(huong) {
    // hình thang xám bê tông — trục dài NGANG mặc định; xoay 'huong' (góc xả) → trục dài ⟂ dòng chảy, đỉnh hẹp về hạ lưu, đáy rộng về phía hồ
    var svg = "<svg width='30' height='22' viewBox='0 0 30 22'>" +
      "<polygon points='9,4 21,4 27,18 3,18' fill='#7e8287' stroke='#ffffff' stroke-width='1.6' stroke-linejoin='round'/>" +
      "<line x1='9' y1='4' x2='21' y2='4' stroke='#ffffff' stroke-width='1.4'/></svg>";
    return L.divIcon({ className: "", iconSize: [30, 22], iconAnchor: [15, 11],
      html: "<div style='transform:rotate(" + (huong || 0) + "deg);transform-origin:center'>" + svg + "</div>" });
  }
  function buildDams(g) {
    var grp = L.layerGroup();
    (g.features || []).forEach(function (f) {
      var p = f.properties || {}, gt = f.geometry || {};
      if (gt.type === "Point") {
        var c = gt.coordinates;
        L.marker([c[1], c[0]], { pane: "hntDam", icon: damIcon(p.huong) })
          .bindTooltip(p.ten, { permanent: true, direction: "right", offset: [12, 0], className: "dam-label" })
          .bindPopup(damPopup(p), { maxWidth: 360 }).addTo(grp);
      } else {  // đê = đường
        L.geoJSON(f, { pane: "hntDam", style: { color: "#b5651d", weight: 3, dashArray: "5,3" },
          onEachFeature: function (ff, l) { if (p.ten) l.bindTooltip("Đê: " + p.ten, { sticky: true }); } }).addTo(grp);
      }
    });
    return grp;
  }
  // Biểu tượng CẦU/TRÀN — phương án C (cầu dầm trên nước).
  // color = màu phân loại đang dùng: Tràn #e15759 (đỏ) / Cầu #3d6db5 (xanh).
  // Mặt cầu mang màu (đậm) + viền trắng để đỏ/xanh rõ như chấm cũ; trụ & sóng trắng.
  function crossingIcon(color) {
    color = color || "#3d6db5";
    var svg =
      "<svg width='32' height='26' viewBox='0 0 32 26' style='filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.55))'>" +
        "<rect x='2' y='3' width='28' height='20' rx='6' fill='#121821' fill-opacity='.6'/>" +
        "<line x1='6' y1='11' x2='26' y2='11' stroke='#ffffff' stroke-width='3.6' stroke-linecap='round'/>" +
        "<line x1='6' y1='11' x2='26' y2='11' stroke='" + color + "' stroke-width='2.2' stroke-linecap='round'/>" +
        "<g stroke='#ffffff' stroke-width='1.5' stroke-linecap='round'>" +
          "<line x1='10' y1='11' x2='10' y2='17'/><line x1='16' y1='11' x2='16' y2='17'/><line x1='22' y1='11' x2='22' y2='17'/>" +
        "</g>" +
        "<path d='M5 20 q2.5 -2 5 0 t5 0 t5 0 t5 0' fill='none' stroke='#ffffff' stroke-width='1.4' stroke-linecap='round' stroke-opacity='.85'/>" +
      "</svg>";
    return L.divIcon({ className: "", html: svg, iconSize: [32, 26], iconAnchor: [16, 13], popupAnchor: [0, -11] });
  }
  function buildCross(g) {
    var grp = L.layerGroup();
    (g.features || []).forEach(function (f) {
      var p = f.properties || {}, m = midpoint(f.geometry && f.geometry.coordinates); if (!m) return;
      var t = p.loai === "Tràn", nm = p.ten && p.ten.length ? p.ten : "Cầu (không tên)";
      L.marker(m, { pane: "hntCross", icon: crossingIcon(t ? "#e15759" : "#3d6db5") })
        .bindPopup("<b>" + nm + "</b><br>" + (t ? "Tràn — ngập sớm" : "Cầu") +
                   "<br>Dài ~" + (p.len_m || "?") + " m<br>Xã: " + (p.xa || "—")).addTo(grp);
    });
    return grp;
  }

  function refresh() {
    var z = map.getZoom();
    slot("hydro",  on.hydro,                  "water_surface.geojson",           buildHydro,  "water_surface");
    slot("labels", on.hydro && z >= Z_LABEL,  "data/labels/ten_thuyhe.geojson",  buildLabels, "ten_thuyhe");
    slot("dam",    on.dam,                     "dikes_dams.geojson",             buildDams,   "dikes_dams");
    slot("main",   on.roads && z >= Z_MAIN,    "roads_main.geojson",             buildMain,   "roads_main");
    slot("other",  on.roads && z >= Z_OTHER,   "roads_other.geojson",            buildOther,  "roads_other");
    slot("cross",  on.cross && z >= Z_CROSS,   "crossings.geojson",              buildCross,  "crossings");
  }
  function slot(name, want, file, builder, id) {
    if (want && !lyr[name]) { load(file, function (g) { if (!lyr[name]) { lyr[name] = builder(g); lyr[name].addTo(map); guard(name); } }, id); }
    else if (!want && lyr[name]) { map.removeLayer(lyr[name]); lyr[name] = null; }
  }
  function guard(name) {
    var z = map.getZoom(), keep = { hydro: on.hydro, labels: on.hydro && z >= Z_LABEL, dam: on.dam, main: on.roads && z >= Z_MAIN, other: on.roads && z >= Z_OTHER, cross: on.cross && z >= Z_CROSS }[name];
    if (!keep && lyr[name]) { map.removeLayer(lyr[name]); lyr[name] = null; }
  }
  function addControl() {
    var c = L.control({ position: "bottomleft" });
    c.onAdd = function () {
      var d = L.DomUtil.create("div");
      d.style.cssText = "background:var(--surface,#2a323b);color:var(--ink,#e7e9ec);padding:9px 11px;border-radius:11px;" +
        "font:12px/1.5 'Be Vietnam Pro',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4);min-width:178px";
      d.innerHTML =
        '<div style="font-weight:600;margin-bottom:5px;font-size:11px;letter-spacing:.3px;opacity:.85">GIAO THÔNG</div>' +
        '<label style="display:flex;gap:7px;cursor:pointer"><input type="checkbox" id="hnt-roads" style="accent-color:var(--green,#5fb6e6)">Đường giao thông</label>' +
        '<label style="display:flex;gap:7px;cursor:pointer"><input type="checkbox" id="hnt-cross" style="accent-color:var(--green,#5fb6e6)">Cầu cống</label>';
      L.DomEvent.disableClickPropagation(d); return d;
    };
    c.addTo(map);
    setTimeout(function () {
      var r = document.getElementById("hnt-roads"), x = document.getElementById("hnt-cross");
      if (r) r.addEventListener("change", function () { on.roads = r.checked; refresh(); });
      if (x) x.addEventListener("change", function () { on.cross = x.checked; refresh(); });
    }, 0);
  }
  function bindPanel() {
    var r = document.getElementById("hntRoads"), x = document.getElementById("hntCross"),
        h = document.getElementById("hntHydro"), d = document.getElementById("hntDam");
    if (r) r.addEventListener("change", function () { on.roads = r.checked; refresh(); });
    if (x) x.addEventListener("change", function () { on.cross = x.checked; refresh(); });
    if (h) h.addEventListener("change", function () { on.hydro = h.checked; refresh(); });
    if (d) d.addEventListener("change", function () { on.dam = d.checked; refresh(); });
    // mặc định bật theo thuộc tính checked trong markup (Mặt nước + Đê điều, đập nước = ON)
    on.roads = !!(r && r.checked); on.cross = !!(x && x.checked);
    on.hydro = !!(h && h.checked); on.dam = !!(d && d.checked);
    refresh();
  }
  function init(leafletMap, opts) {
    map = leafletMap || global.HYDRO_MAP; opts = opts || {};
    if (opts.dataDir) DATA_DIR = opts.dataDir;
    if (!map) { console.error("[hht-overlays] thiếu map"); return; }
    panes(); map.on("zoomend", refresh);
    loadAOI();   // nạp ranh vùng dự án để giấu Sông hồ ngoài lưu vực (fail-open nếu lỗi)
    if (!document.getElementById("hoho-dam-css")) {
      var st = document.createElement("style"); st.id = "hoho-dam-css";
      st.textContent = ".dam-label{background:#6c7075;color:#fff;border:none;font:700 11px 'Be Vietnam Pro',sans-serif;" +
        "padding:1px 6px;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.5)}.dam-label:before{display:none}" +
        ".hnt-hydro-lbl{pointer-events:none}.hnt-hydro-lbl span{display:inline-block;transform:translate(-50%,-50%);white-space:nowrap;" +
        "font:italic 600 11px 'Be Vietnam Pro',sans-serif;color:#1c6fb3;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 3px #fff}";
      document.head.appendChild(st);
    }
    if (opts.panel) bindPanel(); else if (opts.control !== false) addControl();
    return API;
  }
  var API = { init: init, setRoads: function (v) { on.roads = !!v; refresh(); }, setCrossings: function (v) { on.cross = !!v; refresh(); } };
  global.HHTOverlays = API;
})(window);
