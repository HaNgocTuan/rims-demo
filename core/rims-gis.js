/* =====================================================================
 * RIMS — LỚP DỮ LIỆU GIS (core/rims-gis.js)
 * ---------------------------------------------------------------------
 * Sông ngòi · công trình thuỷ lợi · bộ lọc.
 *
 * NGUỒN
 *   · data/hydro/song_chinh.geojson   — 434 vùng mặt nước sông lớn (từ KMZ
 *     Songchinh_Songlon). Là VÙNG chứ không phải đường: sông lớn có bề rộng.
 *   · data/hydro/song_nhanh.geojson   — 64.051 đoạn sông nhánh, gộp từ ba
 *     KMZ miền Bắc / miền Trung / miền Nam.
 *   · data/congtrinh/congtrinh_*.geojson — 1.467 công trình, tách theo
 *     ĐÚNG cột "Loại công trình" của danh sách master.
 *
 * VÌ SAO SÔNG NHÁNH CHỈ HIỆN KHI PHÓNG GẦN
 *   64.051 đoạn vẽ ở mức toàn quốc thì vừa đơ máy vừa thành một mảng đen
 *   không đọc được gì. Ngưỡng zoom ở NGUONG_SONG_NHANH.
 *
 * BIỂU TƯỢNG ĐẬP giữ nguyên của HydroNet (hht-overlays.js, hàm damIcon):
 *   hình thang xám bê tông, đáy rộng về phía hồ, đỉnh hẹp về hạ lưu.
 * ===================================================================== */
(function () {
  "use strict";
  if (window.RIMSGis) return;

  var map = window.HYDRO_MAP;
  if (!map) { console.warn("[gis] chưa có bản đồ"); return; }

  var NGUONG_SONG_NHANH = 9;

  var NGUONG_XA = 9;          // ranh giới phường/xã
  var NGUONG_TIEU_LV = 7;     // tiểu lưu vực
  var NGUONG_NHA = 15;        // footprint nhà cửa — như HydroNet

  /* ── Khung vẽ riêng, xếp dưới lớp trạm khí tượng ─────────────────────
     ⚑ BẢN ĐỒ CHẠY CHẾ ĐỘ CANVAS (preferCanvas). Mỗi khung vẽ canvas là
     MỘT TẤM PHỦ KÍN bản đồ, nên tấm nằm trên nuốt sạch chuột — lớp bên
     dưới không bao giờ nhận được rê hay bấm. Đó là lý do ranh giới tỉnh
     (khung thấp nhất) không phản ứng gì.

     Cách chữa: các lớp VÙNG vẽ bằng SVG. SVG thì mỗi vùng là một hình
     riêng, chuột chỉ bị bắt đúng chỗ có hình, chỗ trống lọt xuống lớp
     dưới. Riêng sông nhánh 64.051 đoạn thì phải giữ canvas — SVG chừng
     ấy hình là đơ máy — nên tắt bắt chuột ở khung đó (xem BAT_CHUOT).  */
  [["gis-dem", 250], ["gis-hc", 396], ["gis-lv", 398], ["gis-song", 402], ["gis-songnhanh", 401],
   ["gis-nha", 420], ["gis-ct", 452]].forEach(function (p) {
    if (!map.getPane(p[0])) { map.createPane(p[0]); map.getPane(p[0]).style.zIndex = p[1]; }
  });
  /* Sông nhánh chỉ để nhìn. Nếu để canvas của nó bắt chuột thì nó nằm
     trên ranh giới hành chính và lưu vực, nuốt hết rê chuột của hai lớp
     kia. Đổi lại: đoạn sông nhánh không bấm ra popup được.             */
  map.getPane("gis-songnhanh").style.pointerEvents = "none";
  /* Nhà cửa cũng vẽ bằng canvas (gis-nha, z 420), nằm TRÊN ranh giới
     hành chính và lưu vực. interactive:false đặt từng lớp KHÔNG đủ —
     canvas vẫn để pointer-events:auto nên nuốt sạch rê chuột của các lớp
     dưới ở MỌI điểm, cả lúc phủ sóng lẫn lúc vẽ footprint. Nhà cửa chỉ là
     nền cho lớp ngập tô đè, không cần bấm — tắt bắt chuột cả pane, giống
     gis-songnhanh. (RIMS-17: trước khi sửa elementFromPoint 5/5 điểm chạm
     canvas nhà cửa; sau khi sửa xuyên xuống đúng path ranh giới.)       */
  map.getPane("gis-nha").style.pointerEvents = "none";

  var veSVG = {};   // pane -> bộ vẽ SVG dùng chung cho pane đó
  function boVe(pane) {
    if (!veSVG[pane]) veSVG[pane] = L.svg({ pane: pane });
    return veSVG[pane];
  }

  var lop = {};      // id -> layer đã dựng (giữ lại kể cả khi đã tắt)
  var muon = {};     // id -> người dùng CÓ MUỐN bật lớp này không
  var dangTai = {};  // id -> Promise

  /* ══════════════ BIỂU TƯỢNG ══════════════ */

  /* ── HUY HIỆU HNT (17/09/2026) ─────────────────────────────────────────────
     Gắn logo HNT (rotor tuabin) lên góc marker đập ĐÃ kết nối HNT:
       full (đậm) = có vận hành + dự báo · fc (nhạt) = chỉ có dự báo.
     Trạng thái nạp từ data/hnt/roster.json (HNT_STATE, dưới), khớp theo tên. */
  var HNT_LOGO = "data:image/png;base64,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";
  var HNT_STATE = {};   // tên chuẩn hoá -> 'full' | 'fc'
  function hntState(ten){ if(!ten) return ''; var f=_khongDau(ten); var a=f.replace(/^(ho chua|ho|dap)\s+/,'').trim(); return HNT_STATE[f]||HNT_STATE[a]||''; }
  function hntBadgeSVG(st, cx, cy, R){
    if(!st) return '';
    var full=(st==='full'), ir=R*0.82, op=full?1:0.4;
    return "<circle cx='"+cx+"' cy='"+cy+"' r='"+R+"' fill='#ffffff' stroke='"+(full?'#1f93e3':'#8fbcda')+"' stroke-width='1.1'/>"+
           "<image href='"+HNT_LOGO+"' x='"+(cx-ir)+"' y='"+(cy-ir)+"' width='"+(2*ir)+"' height='"+(2*ir)+"' opacity='"+op+"'/>";
  }
  /* Đập — bê nguyên của HydroNet. Hình thang bê tông. (+ huy hiệu HNT khi kết nối) */
  function bieuTuongDap(mau, ten) {
    var body = "<polygon points='9,4 21,4 27,18 3,18' fill='" + (mau || "#7e8287") +
      "' stroke='#ffffff' stroke-width='1.6' stroke-linejoin='round'/>" +
      "<line x1='9' y1='4' x2='21' y2='4' stroke='#ffffff' stroke-width='1.4'/>";
    var st = hntState(ten);
    if (!st) {
      var svg = "<svg width='26' height='19' viewBox='0 0 30 22'>" + body + "</svg>";
      return L.divIcon({ className: "gis-ic", html: svg, iconSize: [26, 19], iconAnchor: [13, 10], popupAnchor: [0, -9] });
    }
    var svg2 = "<svg width='30' height='23' viewBox='0 -4 34 26'>" + body + hntBadgeSVG(st, 25.5, 4, 7) + "</svg>";
    return L.divIcon({ className: "gis-ic", html: svg2, iconSize: [30, 23], iconAnchor: [13, 13], popupAnchor: [0, -12] });
  }
  /* Hồ trọng điểm quốc gia — vẫn hình đập, thêm vòng nhấn để nhận ra ngay */
  function bieuTuongTrongDiem(ten) {
    var st = hntState(ten);
    var svg = "<svg width='34' height='27' viewBox='0 0 34 27'>" +
      "<circle cx='17' cy='13' r='12.4' fill='none' stroke='#C4453F' stroke-width='2'/>" +
      "<g transform='translate(2,2.5)'>" +
      "<polygon points='9,4 21,4 27,18 3,18' fill='#8C5A3C' stroke='#ffffff' stroke-width='1.6' stroke-linejoin='round'/>" +
      "<line x1='9' y1='4' x2='21' y2='4' stroke='#ffffff' stroke-width='1.4'/></g>" +
      hntBadgeSVG(st, 27, 6, 6) + "</svg>";
    return L.divIcon({ className: "gis-ic", html: svg, iconSize: [34, 27], iconAnchor: [17, 13], popupAnchor: [0, -12] });
  }
  function chamTron(mau, r) {
    r = r || 5;
    var d = r * 2 + 4;
    var svg = "<svg width='" + d + "' height='" + d + "' viewBox='0 0 " + d + " " + d + "'>" +
      "<circle cx='" + (d / 2) + "' cy='" + (d / 2) + "' r='" + r + "' fill='" + mau + "' stroke='#fff' stroke-width='1.5'/></svg>";
    return L.divIcon({ className: "gis-ic", html: svg, iconSize: [d, d], iconAnchor: [d / 2, d / 2], popupAnchor: [0, -r] });
  }

  /* ══════════════ PHÂN CẤP HỒ ══════════════
     Theo Nghị định 114/2018 về quản lý an toàn đập, hồ chứa nước —
     phân theo DUNG TÍCH TOÀN BỘ. Đây là phân cấp pháp lý, không phải do
     ta tự đặt ra.                                                       */
  function capHo(w) {
    if (w == null) return null;
    if (w >= 1000) return "dac_biet";   // quan trọng đặc biệt
    if (w >= 3)    return "lon";
    if (w >= 0.5)  return "vua";
    return "nho";
  }
  var TEN_CAP = { dac_biet: "Quan trọng đặc biệt", lon: "Lớn", vua: "Vừa", nho: "Nhỏ" };

  /* Bốn hồ trọng điểm quốc gia theo Yêu cầu kỹ thuật 07/8/2026.
     ⚑ CHỈ áp cho HỒ CHỨA THUỶ LỢI. Cửa Đạt còn có một nhà máy thuỷ điện
     cùng tên trên cùng con đập; nếu không chặn theo loại thì bộ lọc đếm
     thành 5 thay vì 4 — mà danh hiệu trọng điểm quốc gia là của hồ chứa
     thuỷ lợi, không phải của nhà máy điện.                              */
  var TRONG_DIEM = ["Cửa Đạt", "Ngàn Trươi", "Tả Trạch", "Dầu Tiếng"];
  function laTrongDiem(p) {
    if (!p) return false;
    var pr = (typeof p === "string") ? { ten: p, loai: "Hồ chứa" } : p;
    if (pr.loai && pr.loai !== "Hồ chứa") return false;
    var t = String(pr.ten || "").toLowerCase();
    return TRONG_DIEM.some(function (x) { return t.indexOf(x.toLowerCase()) >= 0; });
  }

  /* ══════════════ POPUP THUỘC TÍNH ══════════════
     Cách bày theo HydroNet (hht-overlays.js, wsPopup): bảng ba cột
     tên · đơn vị · giá trị, nhóm theo chủ đề. Ô nào không có số thì
     KHÔNG hiện dòng — thà thiếu dòng còn hơn hiện dấu gạch đầy bảng.  */
  function dong(ten, dv, v) {
    if (v === null || v === undefined || v === "") return "";
    var so = (typeof v === "number");
    if (so && v === 0) return "";
    var val = so ? String(v).replace(".", ",") : String(v);
    return "<tr><td class='k'>" + ten + "</td><td class='u'>" + (so ? (dv || "") : "") +
           "</td><td class='v'>" + val + "</td></tr>";
  }
  function nhom(tieude, than) {
    if (!than) return "";
    return "<tr><td colspan='3' class='g'>" + tieude.toUpperCase() + "</td></tr>" + than;
  }
  /* Đập -> console giám sát (băng phải). Chỉ đập ĐÃ có console mới hiện nút Theo dõi. */
  var DAP_MODULE = [ ['ngan truoi','dam.ngantruoi'], ['ho ho','dam.hoho'] ];
  function _khongDau(s){ try{ return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim(); }catch(e){ return String(s==null?'':s).toLowerCase(); } }
  function damModuleId(ten){ var f=_khongDau(ten); var a=f.replace(/^(ho chua|ho|dap)\s+/,'').trim(); for(var i=0;i<DAP_MODULE.length;i++){ var k=DAP_MODULE[i][0]; if(f===k||a===k) return DAP_MODULE[i][1]; } return ''; }
  /* 17/09/2026: NẠP ĐỘNG bản đồ tên→console từ data/hnt/roster.json (hồ has_op).
     Thêm hồ sau chỉ cần sửa roster + modules.json, KHÔNG sửa mã. Chạy async — popup mở
     bằng click nên roster đã nạp xong; ho ho/ngan truoi vẫn có sẵn ở trên để chắc chắn. */
  (function(){ try{ fetch('data/hnt/roster.json',{cache:'no-store'})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(j){ if(!j||!j.dams)return; j.dams.forEach(function(d){ if(!d.key)return;
      var n=_khongDau(d.gis||d.ten||''), a=n.replace(/^(ho chua|ho|dap)\s+/,'').trim();
      // Huy hiệu: MỌI hồ HNT (đều có dự báo tank). full=có vận hành, fc=chỉ dự báo.
      var st=d.has_op?'full':'fc';
      [n,a].forEach(function(k){ if(k&&k.length>=3&&!HNT_STATE[k]) HNT_STATE[k]=st; });
      // Console Theo dõi: mọi hồ có module (has_op = console vận hành đầy đủ; fc = console dự báo).
      if(d.module){ var id='dam.'+d.key;
        function add(k){ if(k&&k.length>=3&&!DAP_MODULE.some(function(p){return p[0]===k;})) DAP_MODULE.push([k,id]); }
        add(n); add(a); }
    }); })
    .catch(function(){}); }catch(e){} })();
  window.RIMS_theoDoi = function(id, ten){ try{ var b=document.querySelector('.leaflet-popup-close-button'); if(b) b.click(); }catch(e){} if(window.RIMS_openModule) window.RIMS_openModule(id, ten); };
  function nutTheoDoi(ten){ var id=damModuleId(ten); if(!id) return ''; var t=String(ten==null?'':ten).replace(/'/g,'').replace(/"/g,'&quot;'); return "<button type='button' onclick=\"window.RIMS_theoDoi('"+id+"','"+t+"')\" style='margin-top:8px;width:100%;appearance:none;border:0;cursor:pointer;background:#1f93e3;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:8px 10px;border-radius:7px'>&#128065; Theo dõi</button>"; }
  var damSpecs = {};
  (function(){ try{ fetch('data/congtrinh/dam_specs.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){ if(j) damSpecs=j; }).catch(function(){}); }catch(e){} })();
  function _specFor(ten){ var f=_khongDau(ten); var a=f.replace(/^(ho chua|ho|dap)\s+/,'').trim(); return damSpecs[f]||damSpecs[a]||null; }
  function _specRows(bang){ return (bang||[]).map(function(r){ return "<tr><td class='k'>"+r[0]+"</td><td class='u'>"+(r[1]||'')+"</td><td class='v'>"+r[2]+"</td></tr>"; }).join(''); }
  function popupDapSpec(spec, ten){ var head="<b>"+(spec.ten||ten||'(chưa có tên)')+"</b>"; var src=spec.src?"<div class='thieu' style='opacity:.7;margin-top:4px'>"+spec.src+"</div>":""; return "<div class='gis-pop'>"+head+"<table>"+_specRows(spec.bang)+"</table>"+src+nutTheoDoi(ten||spec.ten)+"</div>"; }
  function popupDapMong(ten){ var _sp=_specFor(ten); if(_sp) return popupDapSpec(_sp, ten); return "<div class='gis-pop'><b>"+(ten||'(chưa có tên)')+"</b><div class='thieu'>Chưa có thông số thiết kế trong danh mục.</div>"+nutTheoDoi(ten)+"</div>"; }
  function popupCongTrinh(p) {
    var _sp = _specFor(p && p.ten); if (_sp) return popupDapSpec(_sp, p && p.ten);
    var cap = capHo(p.w_toanbo);
    var g0 = dong("Loại công trình", "", p.loai) + dong("Cấp hồ", "", cap ? TEN_CAP[cap] : null) +
             dong("Lưu vực", "", p.luu_vuc) + dong("F lưu vực", "km²", p.flv_km2) +
             dong("Năm xây dựng", "", p.nam_xd);
    var g1 = dong("Dung tích toàn bộ", "×10⁶ m³", p.w_toanbo) +
             dong("Dung tích hữu ích", "×10⁶ m³", p.w_huu_ich) +
             dong("Diện tích tưới TK", "ha", p.dt_tuoi);
    var g2 = dong("MNDBT", "m", p.mndbt) + dong("MNDGC", "m", p.mndgc) + dong("MNC", "m", p.mnc);
    var g3 = dong("Đơn vị quản lý", "", p.don_vi) + dong("Mã định danh", "", p.ma);

    var head = "<b>" + (p.ten || "(chưa có tên)") + "</b>";
    /* ⚑ Cột "Tỉnh/TP" trong danh sách master là MÃ SỐ (42, 38…), không phải
       tên. Hiện mã lên màn hình thì người dùng không hiểu gì, mà đoán tên
       thì có nguy cơ đoán sai. Nên tạm chỉ hiện Vùng — thứ vốn đã là chữ.
       Khi có bảng tra mã tỉnh thì mở lại.                                */
    var tinhChu = (p.tinh && !/^\d+$/.test(String(p.tinh))) ? p.tinh : null;
    var sub = [tinhChu, p.vung].filter(Boolean).join(" · ");
    if (laTrongDiem(p)) sub = "Hồ trọng điểm quốc gia" + (sub ? " · " + sub : "");
    if (sub) head += "<div class='sub'>" + sub + "</div>";

    var than = nhom("Công trình", g0) + nhom("Dung tích", g1) + nhom("Mực nước thiết kế", g2) + nhom("Quản lý", g3);
    var chua = "";
    if (!p.mndbt && !p.w_toanbo) chua = "<div class='thieu'>Chưa có thông số thiết kế trong danh mục.</div>";
    return "<div class='gis-pop'>" + head + "<table>" + than + "</table>" + chua + nutTheoDoi(p.ten) + "</div>";
  }
  function popupSong(p) {
    var ten = p.ten || p.Name || null;
    return "<div class='gis-pop'><b>" + (ten || "Sông không tên trong dữ liệu") + "</b></div>";
  }

  /* Số có hàng nghìn + đơn vị. Khác dong() ở chỗ dong() chỉ hiện đơn vị khi
     giá trị là kiểu số thuần, mà số dân số/diện tích thì phải tách hàng
     nghìn nên đã thành chuỗi — không dùng chung được.                   */
  function dongSo(ten, dv, v) {
    var n = Number(v);
    if (v === null || v === undefined || v === "" || !isFinite(n) || n === 0) return "";
    return "<tr><td class='k'>" + ten + "</td><td class='u'>" + (dv || "") +
           "</td><td class='v'>" + n.toLocaleString("vi-VN") + "</td></tr>";
  }
  /* Ranh giới hành chính — dữ liệu sau sáp nhập 2025: 34 tỉnh, 3.321 xã.
     Trường "sap_nhap" cho biết đơn vị này gộp từ những đơn vị cũ nào —
     đúng thứ người dùng cần khi đối chiếu hồ sơ cũ với địa danh mới.   */
  function popupHanhChinh(p) {
    var g0 = dong("Loại", "", p.loai) + dong("Thuộc tỉnh", "", p.tinh) +
             dong("Mã", "", p.ma) + dong("Trụ sở", "", p.tru_so);
    var g1 = dongSo("Diện tích", "km²", p.dt_km2) + dongSo("Dân số", "người", p.dan_so) +
             dongSo("Mật độ", "người/km²", p.matdo) + dong("Quy mô", "", p.quy_mo);
    var g2 = (p.sap_nhap && !/^không/i.test(p.sap_nhap)) ? dong("Hợp nhất từ", "", p.sap_nhap) : "";
    return "<div class='gis-pop'><b>" + (p.ten || "(chưa có tên)") + "</b><table>" +
           nhom("Đơn vị", g0) + nhom("Quy mô", g1) + nhom("Sáp nhập 2025", g2) +
           "</table></div>";
  }
  /* Lưu vực — vùng hứng nước tính tới tuyến đập của từng công trình.
     Trên các bậc thang, lưu vực dưới BAO lưu vực trên; trường "nam_trong"
     giữ đúng quan hệ đó nên đọc popup là biết mình đang ở bậc nào.      */
  function popupLuuVuc(p) {
    var g = dongSo("Diện tích hứng nước", "km²", p.dt_km2) +
            dong("Loại công trình", "", p.loai_ct) +
            dong("Nằm trong lưu vực", "", p.nam_trong);
    return "<div class='gis-pop'><b>" + (p.ten || "(chưa có tên)") + "</b>" +
           "<div class='sub'>Lưu vực tính tới tuyến công trình</div>" +
           "<table>" + g + "</table></div>";
  }

  /* ══════════════ DÂN SINH — NHÀ CỬA ══════════════
     Nguồn quốc tế, cùng họ với thứ HydroNet dùng: Google Open Buildings +
     Microsoft ML + OSM (HydroNet lấy qua Overture, RIMS lấy bản VIDA đã
     gộp sẵn theo quốc gia). Phân lớp theo diện tích GIỮ NGUYÊN ngưỡng của
     HydroNet — dưới 60 m² là công trình phụ, 60–350 m² là nhà ở, từ 350 m²
     là công trình lớn — để sau này bê engine ngập lụt sang thì khớp luôn.

     Dữ liệu do tools/tai_nha_cua.py sinh ra, phải chạy trên máy có mạng
     thật. Chưa chạy thì hai dòng menu tự khoá lại, không báo lỗi.       */
  /* Bậc thang mật độ. Mốc chọn theo phân bố thật của 3.321 xã: đa số xã
     nông thôn dưới 150 nhà/km², nội đô lên tới gần 8.000. Thang tuyến tính
     sẽ dồn hết cả nước vào một màu nên chia theo bậc, cách nhau ~2,5 lần. */
  var THANG_MATDO = [
    [0,    "#eef2f4"], [20,  "#cfe0e6"], [60,  "#a8cbd6"],
    [150,  "#7fb0c4"], [400, "#4f8ba8"], [1000, "#2c6382"]
  ];
  function mauMatDo(v) {
    if (v == null || !isFinite(v)) return "#e8eaec";
    for (var i = THANG_MATDO.length - 1; i >= 0; i--)
      if (v >= THANG_MATDO[i][0]) return THANG_MATDO[i][1];
    return THANG_MATDO[0][1];
  }
  function popupMatDo(p) {
    var g0 = dong("Thuộc tỉnh", "", p.tinh) + dong("Loại", "", p.loai);
    var g1 = dongSo("Tổng số nhà", "công trình", p.nha_tong) +
             dongSo("Trong đó nhà ở", "công trình", p.nha_o) +
             dongSo("Công trình lớn", "công trình", p.nha_lon) +
             dongSo("Mật độ", "nhà/km²", p.matdo_nha);
    var g2 = dongSo("Diện tích", "km²", p.dt_km2) + dongSo("Dân số", "người", p.dan_so);
    return "<div class='gis-pop'><b>" + (p.ten || "(chưa có tên)") + "</b>" +
           "<table>" + nhom("Đơn vị", g0) + nhom("Nhà cửa, công trình", g1) +
           nhom("Quy mô", g2) + "</table></div>";
  }
  function lopMatDoNha(d) {
    return L.geoJSON(d, {
      pane: "gis-hc", renderer: boVe("gis-hc"),
      style: function (f) {
        var p = f.properties || {};
        return { color: "#8c959c", weight: .4, opacity: .55,
                 fillColor: mauMatDo(p.matdo_nha), fillOpacity: p.nha_tong ? .72 : .25 };
      },
      onEachFeature: function (f, l) {
        var p = f.properties || {};
        l.bindPopup(popupMatDo(p), { minWidth: 240, maxWidth: 360, className: "gis-popup" });
        l.bindTooltip(p.ten + (p.nha_tong ? " · " + p.nha_tong.toLocaleString("vi-VN") + " nhà" : ""),
                      { sticky: true });
        l.on("mouseover", function () { l.setStyle({ color: "#C4453F", weight: 1.6, opacity: 1 }); });
        l.on("mouseout",  function () { l.setStyle({ color: "#8c959c", weight: .4, opacity: .55 }); });
      }
    });
  }
  /* Footprint nhà: viền mảnh, nền rất nhạt — chừa chỗ cho lớp ngập tô đỏ
     đè lên sau. Bê cách tô của HydroNet (buildings-layer.js).           */
  function kieuNha(f) {
    var b = (f.properties || {}).bang;
    return { color: b === "lon" ? "#5a7d99" : "#6b8299",
             weight: b === "lon" ? .9 : .6, opacity: .9,
             fillColor: "#cfdae3", fillOpacity: .18 };
  }

  /* Vùng có viền: tô rất nhạt để còn nhìn xuyên xuống nền, đậm lên khi rê
     chuột. Tô đặc thì che mất ảnh vệ tinh và các chấm trạm bên dưới.   */
  function lopVung(pane, kieu, kieuRe, popup) {
    return function (d) {
      return L.geoJSON(d, {
        pane: pane, renderer: boVe(pane), style: kieu,
        onEachFeature: function (f, l) {
          l.bindPopup(popup(f.properties || {}), { minWidth: 230, maxWidth: 360, className: "gis-popup" });
          if (f.properties && f.properties.ten) l.bindTooltip(f.properties.ten, { sticky: true });
          l.on("mouseover", function () { l.setStyle(kieuRe); if (l.bringToFront) l.bringToFront(); });
          l.on("mouseout", function () { l.setStyle(kieu); });
        }
      });
    };
  }

  /* ══════════════ ĐỊNH NGHĨA LỚP ══════════════ */
  var DINH_NGHIA = {
    hc_tinh: {
      ten: "Tỉnh, thành phố", tep: "data/hanhchinh/tinh.geojson", pane: "gis-hc",
      dung: lopVung("gis-hc",
        { color: "#6F7B87", weight: 1.3, opacity: .85, fillColor: "#8FA3B5", fillOpacity: .05 },
        { color: "#C4453F", weight: 2.0, opacity: 1,   fillColor: "#C4453F", fillOpacity: .13 },
        popupHanhChinh)
    },
    hc_xa: {
      ten: "Phường, xã", tep: "data/hanhchinh/xa.geojson", pane: "gis-hc",
      zoomToiThieu: NGUONG_XA, theoKhungNhin: true,
      dung: lopVung("gis-hc",
        { color: "#8A939C", weight: .6, opacity: .7, dashArray: "3 2", fillOpacity: 0 },
        { color: "#C4453F", weight: 1.6, opacity: 1, dashArray: null, fillColor: "#C4453F", fillOpacity: .12 },
        popupHanhChinh)
    },
    /* ⚑ HAI DÒNG MENU, MỘT FILE. "Lưu vực" và "tiểu lưu vực" không phải
       thuộc tính của bản thân lưu vực — nó là quan hệ với những lưu vực
       khác đang có trong bộ dữ liệu. Có thêm một hồ hạ lưu bao lấy nó là
       một lưu vực gốc thành tiểu lưu vực, mà đó là ĐÚNG về thuỷ văn.
       Nên cái được lưu là QUAN HỆ (trường `cha`, `cap`); nhãn chỉ là CÁCH
       NHÌN, lọc ra lúc hiển thị. Tách hai file theo nhãn thì khi phân cấp
       đổi, lưu vực NHẢY FILE — mọi thứ trỏ vào file cũ hỏng lặng lẽ.
       Xem tools/dung_luuvuc.py.                                        */
    luu_vuc: {
      ten: "Lưu vực", tep: "data/luuvuc/luuvuc.geojson", pane: "gis-lv",
      loc: function (p) { return !p.cap; },
      dung: lopVung("gis-lv",
        { color: "#3E8F7C", weight: 1.2, opacity: .9, fillColor: "#3E8F7C", fillOpacity: .09 },
        { color: "#2C6B5D", weight: 2.2, opacity: 1,  fillColor: "#3E8F7C", fillOpacity: .22 },
        popupLuuVuc)
    },
    tieu_luu_vuc: {
      ten: "Tiểu lưu vực", tep: "data/luuvuc/luuvuc.geojson", pane: "gis-lv",
      loc: function (p) { return p.cap > 0; },
      zoomToiThieu: NGUONG_TIEU_LV,
      dung: lopVung("gis-lv",
        { color: "#7FA86B", weight: .9, opacity: .85, dashArray: "4 3", fillColor: "#7FA86B", fillOpacity: .07 },
        { color: "#4F7A3C", weight: 2.0, opacity: 1, dashArray: null, fillColor: "#7FA86B", fillOpacity: .2 },
        popupLuuVuc)
    },
    song_chinh: {
      ten: "Sông chính, sông lớn", tep: "data/hydro/song_chinh.geojson", pane: "gis-song",
      dung: function (d) {
        return L.geoJSON(d, { pane: "gis-song", renderer: boVe("gis-song"),
          style: { color: "#3E7CA6", weight: 0.6, fillColor: "#2F6D96", fillOpacity: 0.75 },
          onEachFeature: function (f, l) { l.bindPopup(popupSong(f.properties || {})); } });
      }
    },
    song_nhanh: {
      ten: "Sông nhánh, suối", tep: "data/hydro/song_nhanh.geojson", pane: "gis-songnhanh",
      zoomToiThieu: NGUONG_SONG_NHANH,
      dung: function (d) {
        return L.geoJSON(d, { pane: "gis-songnhanh",
          style: { color: "#4E8EB5", weight: 0.8, opacity: 0.8 },
          onEachFeature: function (f, l) {
            var t = (f.properties || {}).ten;
            if (t) l.bindPopup(popupSong(f.properties));
          } });
      }
    },
    matdo_nha: {
      ten: "Mật độ nhà cửa (theo xã)", tep: "data/dansinh/matdo_nha_xa.geojson",
      pane: "gis-hc", canDuLieu: true, theoKhungNhin: true, dung: lopMatDoNha
    },
    nha_cua: {
      ten: "Nhà cửa, công trình", thuMuc: "data/dansinh/nha_xa", pane: "gis-nha",
      tep: "data/dansinh/nha_xa/manifest.json", canDuLieu: true, theoO: true
    },
    ho_thuyloi:  { ten: "Hồ chứa thuỷ lợi",  tep: "data/congtrinh/congtrinh_ho_thuyloi.geojson",  diem: true, mau: "#7e8287", dap: true },
    ho_thuydien: { ten: "Hồ chứa thuỷ điện", tep: "data/congtrinh/congtrinh_ho_thuydien.geojson", diem: true, mau: "#5E7D8C", dap: true },
    dap_dang:    { ten: "Đập dâng",          tep: "data/congtrinh/congtrinh_dap_dang.geojson",    diem: true, mau: "#8C7A5C", dap: true },
    cong:        { ten: "Cống",              tep: "data/congtrinh/congtrinh_cong.geojson",        diem: true, mau: "#5A8C6A" },
    tram_bom:    { ten: "Trạm bơm",          tep: "data/congtrinh/congtrinh_tram_bom.geojson",    diem: true, mau: "#8C6A9B" }
  };

  /* ══════════════ BỘ LỌC ══════════════
     Chỉ lọc theo thuộc tính CÓ THẬT trong danh mục. Xem docs/PORT_LOG.md
     về hai bộ lọc anh Tuấn yêu cầu mà dữ liệu chưa cho phép làm.        */
  var LOC = {
    tat_ca:     { ten: "Tất cả",                 hop: function () { return true; } },
    trong_diem: { ten: "Trọng điểm quốc gia",    hop: function (p) { return laTrongDiem(p); } },
    dac_biet:   { ten: "Quan trọng đặc biệt",    hop: function (p) { return capHo(p.w_toanbo) === "dac_biet"; } },
    lon:        { ten: "Hồ lớn",                 hop: function (p) { return capHo(p.w_toanbo) === "lon"; } },
    vua_nho:    { ten: "Hồ vừa và nhỏ",          hop: function (p) { var c = capHo(p.w_toanbo); return c === "vua" || c === "nho"; } },
    co_api:     { ten: "Đã kết nối số liệu",     hop: function (p) { return !!p.ma_api; } },
    dap_dang:   { ten: "Đập dâng",               hop: function (p) { return p.loai === "Đập dâng"; } },
    thieu_hs:   { ten: "Thiếu thông số thiết kế", hop: function (p) { return p.mndbt == null || p.w_toanbo == null; } }
  };
  var locHienTai = "tat_ca";

  /* ══════════════ NẠP & BẬT/TẮT ══════════════ */
  /* Nhớ theo ĐƯỜNG DẪN FILE, không theo id lớp: hai lớp dùng chung một file
     thì chỉ tải một lần. Sau đó mỗi lớp tự lọc phần của mình.           */
  function taiTep(id) {
    var dn = DINH_NGHIA[id];
    if (!dangTai[dn.tep]) {
      dangTai[dn.tep] = fetch(dn.tep, { cache: "force-cache" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    }
    return dangTai[dn.tep].then(function (d) {
      if (!dn.loc) { dn._data = d; return d; }
      if (!dn._data) {
        dn._data = { type: "FeatureCollection",
          features: (d.features || []).filter(function (f) { return dn.loc(f.properties || {}); }) };
      }
      return dn._data;
    });
  }

  /* ══════════ VẼ THEO KHUNG NHÌN ══════════
     3.321 xã vẽ hết một lượt mất ~10 giây và mỗi lần kéo bản đồ lại phải
     lo cho từng ấy hình. Nhưng ở mức phóng 9 trở lên thì màn hình chỉ
     chứa vài trăm xã — số còn lại vẽ ra cũng không ai thấy. Nên chỉ dựng
     hình cho xã nằm trong khung nhìn (nới rộng 25% để kéo nhẹ không giật),
     và dựng tới đâu giữ lại tới đó, không dựng lại lần hai.            */
  function khungCuaFeature(f) {
    var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    (function di(c) {
      if (typeof c[0] === "number") {
        if (c[0] < x1) x1 = c[0]; if (c[0] > x2) x2 = c[0];
        if (c[1] < y1) y1 = c[1]; if (c[1] > y2) y2 = c[1];
        return;
      }
      for (var i = 0; i < c.length; i++) di(c[i]);
    })(f.geometry.coordinates);
    return [x1, y1, x2, y2];
  }
  function capNhatKhungNhin(id) {
    var g = lop[id]; if (!g || !g._muc) return 0;
    var b = map.getBounds().pad(0.25);
    var t = b.getWest(), p = b.getEast(), d = b.getSouth(), tr = b.getNorth(), n = 0;
    g._muc.forEach(function (m) {
      var hien = !(m.b[2] < t || m.b[0] > p || m.b[3] < d || m.b[1] > tr);
      if (hien) {
        if (!m.l) m.l = DINH_NGHIA[id].dung({ type: "FeatureCollection", features: [m.f] });
        if (!g.hasLayer(m.l)) g.addLayer(m.l);
        n++;
      } else if (m.l && g.hasLayer(m.l)) g.removeLayer(m.l);
    });
    return n;
  }

  /* ══════════════ NẠP LƯỜI TỪNG XÃ (footprint nhà) ══════════════
     Bê cách của HydroNet (buildings-layer.js): manifest ghi bbox từng xã,
     chỉ tải file xã nào giao khung nhìn, tải rồi thì giữ lại. Khác một
     điểm — HydroNet cố định 7 xã của dự án, RIMS chọn theo khung nhìn nên
     thêm xã về sau chỉ là thêm dòng vào manifest, không phải sửa mã.   */
  /* ⚑ NẠP THEO Ô LƯỚI, KHÔNG THEO XÃ.
     HydroNet cắt mỗi xã một file vì 7 xã Hương Khê đều thưa (~9.000 nhà).
     RIMS có cả vùng Dầu Tiếng sát TP.HCM — một xã ở đó có thể trên 100.000
     nhà. Nạp theo xã nghĩa là chạm rìa xã cũng phải tải NGUYÊN file 30 MB
     và vẽ 100.000 hình, dù chỉ nhìn một góc phố. Đủ để treo máy.

     Cắt theo ô 0,02° (~2,2 km) thì mỗi file bị chặn trên tự nhiên, và ở mức
     phóng 15 khung nhìn chỉ chạm 1–4 ô. Toạ độ ô suy ra từ mã nên manifest
     chỉ cần danh sách mã + số nhà, không cần bbox từng ô.               */
  function oTrongKhung(b, do_) {
    var t = Math.floor(b.getWest() / do_),  p = Math.floor(b.getEast() / do_);
    var d = Math.floor(b.getSouth() / do_), n = Math.floor(b.getNorth() / do_);
    var ds = [];
    for (var x = t; x <= p; x++) for (var y = d; y <= n; y++) ds.push(x + "_" + y);
    return ds;
  }
  /* ⚑ CHO THẤY VÙNG NÀO CÓ DỮ LIỆU.
     Lớp nhà cửa chỉ phủ hạ du 4 hồ trọng điểm, không phải cả nước. Nếu
     dưới mức phóng 15 mà không vẽ gì thì người dùng phóng vào Hà Nội,
     không thấy nhà, tưởng hỏng. Nên dưới ngưỡng ta vẽ chính các Ô CÓ DỮ
     LIỆU thành mảng mờ — nhìn là biết đi đâu mà phóng. Không cần dữ liệu
     thêm: toạ độ ô suy ra từ mã ô trong manifest.                      */
  function lopPhuSong(mf) {
    var do_ = (mf._meta && mf._meta.o_do) || 0.02, hop = [];
    Object.keys(mf.o || {}).forEach(function (k) {
      var t = k.split("_"), x = +t[0], y = +t[1];
      hop.push(L.rectangle([[y * do_, x * do_], [(y + 1) * do_, (x + 1) * do_]],
        { pane: "gis-nha", stroke: false, fillColor: "#4f8ba8", fillOpacity: .3, interactive: false }));
    });
    return L.layerGroup(hop, { pane: "gis-nha" });
  }

  var O_TOI_DA = 40;   // chặn trên, phòng khi ai đó gọi ở mức phóng quá xa
  function capNhatTheoO(id) {
    var g = lop[id], dn = DINH_NGHIA[id];
    if (!g || !g._mf) return 0;
    var mf = g._mf, do_ = (mf._meta && mf._meta.o_do) || 0.02;

    /* Dưới ngưỡng phóng: chỉ vẽ mảng phủ sóng, không nạp nhà. */
    if (map.getZoom() < NGUONG_NHA) {
      Object.keys(g._con).forEach(function (k) {
        if (g.hasLayer(g._con[k])) g.removeLayer(g._con[k]);
      });
      if (!g._phu) g._phu = lopPhuSong(mf);
      if (!g.hasLayer(g._phu)) g.addLayer(g._phu);
      return 0;
    }
    if (g._phu && g.hasLayer(g._phu)) g.removeLayer(g._phu);

    var can = oTrongKhung(map.getBounds(), do_).filter(function (k) { return mf.o[k]; });
    if (can.length > O_TOI_DA) can = can.slice(0, O_TOI_DA);
    var giu = {};
    can.forEach(function (k) { giu[k] = 1; });
    Object.keys(g._con).forEach(function (k) {
      if (!giu[k] && g.hasLayer(g._con[k])) g.removeLayer(g._con[k]);
    });
    can.forEach(function (k) {
      if (g._con[k]) { if (!g.hasLayer(g._con[k])) g.addLayer(g._con[k]); return; }
      if (g._dangTai[k]) return;
      g._dangTai[k] = true;
      fetch(dn.thuMuc + "/o_" + k + ".geojson", { cache: "force-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (gj) {
          if (!gj) return;
          /* Vẽ bằng CANVAS, không phải SVG: một ô có thể vài nghìn hình,
             SVG là vài nghìn thẻ DOM. Nhà cửa chỉ là nền cho lớp ngập tô
             đè lên, không cần bấm — nên khung vẽ này TẮT BẮT CHUỘT, giữ
             nguyên rê chuột cho ranh giới hành chính và lưu vực bên dưới.
             Xem RIMS-08 về chuyện canvas nuốt chuột.                    */
          g._con[k] = L.geoJSON(gj, {
            pane: dn.pane, renderer: L.canvas({ pane: dn.pane }),
            interactive: false, style: kieuNha
          });
          if (muon[id] && map.hasLayer(g) && giu[k]) g.addLayer(g._con[k]);
        })
        .catch(function () {})
        .then(function () { g._dangTai[k] = false; });
    });
    return can.length;
  }

  function dungLop(id, d) {
    var dn = DINH_NGHIA[id];
    if (dn.theoO) {
      var gx = L.layerGroup([]);
      gx._mf = d; gx._con = {}; gx._dangTai = {};
      return gx;
    }
    if (dn.theoKhungNhin) {
      var g = L.layerGroup([]);
      g._muc = (d.features || []).map(function (f) { return { f: f, b: khungCuaFeature(f), l: null }; });
      return g;
    }
    if (!dn.diem) return dn.dung(d);
    /* lớp điểm — công trình */
    var g = L.layerGroup([], { pane: "gis-ct" });
    g._diem = [];
    (d.features || []).forEach(function (f) {
      var c = f.geometry && f.geometry.coordinates; if (!c) return;
      var p = f.properties || {};
      var td = dn.dap && laTrongDiem(p);
      var ic = dn.dap ? (td ? bieuTuongTrongDiem(p.ten) : bieuTuongDap(dn.mau, p.ten)) : chamTron(dn.mau, 4);
      var mk = L.marker([c[1], c[0]], { pane: "gis-ct", icon: ic, riseOnHover: true });
      mk.bindPopup(function () { return popupCongTrinh(p); }, { minWidth: 250, maxWidth: 380, className: "gis-popup" });
      mk.bindTooltip(p.ten || "(chưa có tên)", { direction: "top" });
      mk._p = p; mk._td = td;
      g._diem.push(mk);
    });
    return g;
  }

  function apLoc(id) {
    var g = lop[id]; if (!g || !g._diem) return 0;
    var f = LOC[locHienTai] || LOC.tat_ca, n = 0;
    g._diem.forEach(function (mk) {
      var hop = f.hop(mk._p);
      if (hop) { if (!g.hasLayer(mk)) g.addLayer(mk); n++; }
      else if (g.hasLayer(mk)) g.removeLayer(mk);
    });
    return n;
  }

  /* Lớp đi KÈM: bật "Hồ chứa thuỷ lợi" thì nạp luôn đập dâng. Đập dâng là
     công trình đầu mối tưới cùng họ, nhưng không đứng riêng một dòng menu —
     nó nằm ở BỘ LỌC (chỉ đạo 03/9/2026).                                */
  function demBat(on){ muon.dem = !!on; return (window.RIMSDem ? window.RIMSDem.toggle(on) : Promise.resolve(0)); }
  var DI_KEM = { ho_thuyloi: ["dap_dang"] };

  function bat(id, on) {
    if (id === 'dem') return demBat(on);
    var dn = DINH_NGHIA[id]; if (!dn) return Promise.resolve(0);
    (DI_KEM[id] || []).forEach(function (k) { batMot(k, on); });
    return batMot(id, on);
  }
  function batMot(id, on) {
    var dn = DINH_NGHIA[id]; if (!dn) return Promise.resolve(0);
    muon[id] = !!on;
    if (!on) { if (lop[id]) map.removeLayer(lop[id]); return Promise.resolve(0); }
    return taiTep(id).then(function (d) {
      if (!muon[id]) return 0;          // người dùng đã tắt trong lúc đang nạp
      if (!lop[id]) lop[id] = dungLop(id, d);
      var n;
      if (dn.theoO) {                       // manifest: cộng số nhà của mọi ô
        n = 0; var o = d.o || {};
        Object.keys(o).forEach(function (k) { n += o[k]; });
      } else n = dn.diem ? apLoc(id) : (d.features || []).length;
      if (!dn.zoomToiThieu || map.getZoom() >= dn.zoomToiThieu) {
        lop[id].addTo(map);
        if (dn.theoKhungNhin) capNhatKhungNhin(id);
        if (dn.theoO) capNhatTheoO(id);
      }
      if (window.RIMSGis && RIMSGis.xepLai) RIMSGis.xepLai();
      return n;
    });
  }

  /* Lớp có ngưỡng zoom: tự ẩn/hiện theo mức phóng, KHÔNG tự tắt ô chọn —
     người dùng vẫn thấy mình đã bật lớp đó, chỉ là chưa tới mức phóng.
     ⚑ Điều kiện là muon[id], KHÔNG phải lop[id]. Lớp đã tắt vẫn còn nằm
     trong lop[] (giữ lại để bật lần sau khỏi dựng lại từ đầu), nên nếu
     xét theo lop[] thì phóng gần là lớp đã tắt tự hiện lại.            */
  map.on("zoomend", function () {
    Object.keys(DINH_NGHIA).forEach(function (id) {
      var dn = DINH_NGHIA[id];
      if (!dn.zoomToiThieu) return;
      var nen = map.getZoom() >= dn.zoomToiThieu;
      if (lop[id]) {
        if (muon[id] && nen && !map.hasLayer(lop[id])) lop[id].addTo(map);
        if ((!muon[id] || !nen) && map.hasLayer(lop[id])) map.removeLayer(lop[id]);
      }
      if (muon[id] && window.RIMS_gisNhipZoom) window.RIMS_gisNhipZoom(id, nen);
    });
  });

  /* Kéo hoặc phóng xong thì bù thêm phần vừa lọt vào khung nhìn. */
  map.on("moveend", function () {
    Object.keys(DINH_NGHIA).forEach(function (id) {
      var dn = DINH_NGHIA[id];
      if (!muon[id] || !lop[id] || !map.hasLayer(lop[id])) return;
      if (dn.theoKhungNhin) capNhatKhungNhin(id);
      if (dn.theoO) capNhatTheoO(id);
    });
  });

  /* ══════════════ LỚP CHƯA CÓ DỮ LIỆU ══════════════
     Lớp đánh dấu `canDuLieu` chỉ dùng được khi file đã có trên đĩa. Dữ
     liệu nhà cửa phải chạy tools/tai_nha_cua.py trên máy có mạng thật
     mới sinh ra. Chưa chạy thì KHOÁ dòng menu lại — không để người dùng
     bấm vào rồi nhận một lỗi mạng không hiểu gì.                       */
  function doDuLieu() {
    var ds = Object.keys(DINH_NGHIA).filter(function (id) { return DINH_NGHIA[id].canDuLieu; });
    return Promise.all(ds.map(function (id) {
      return fetch(DINH_NGHIA[id].tep, { method: "HEAD" })
        .then(function (r) { return { id: id, co: r.ok }; })
        .catch(function () { return { id: id, co: false }; });
    })).then(function (kq) {
      var m = {};
      kq.forEach(function (x) { m[x.id] = x.co; DINH_NGHIA[x.id]._co = x.co; });
      if (window.RIMS_gisKhoaLop) window.RIMS_gisKhoaLop(m);
      return m;
    });
  }

  /* ══════════════ ĐÁM ĐẬP THEO HỆ THỐNG SÔNG (demo chọn hệ thống) ══════════════
     Chọn hệ thống ở ô tìm (RIMS_chonHeThong): hiện icon đập của MỌI hồ thuộc lưu
     vực đó — đám đông làm mờ, đập TRỌNG ĐIỂM nổi bật (vòng đỏ) và bấm nổ console.
     Chọn một đập ở ô tìm hồ chứa: đập đó NẢY LÊN (vòng vàng) giữa đám + pan tới.
     Toạ độ + lưu vực lấy từ data/congtrinh/*.geojson (đã có sẵn).            */
  (function () {
    var HT_LV = { hong:["Sông Hồng"], ma:["Sông Mã"], ca:["Sông Cả"], huong:["Sông Hương"],
      vugia_thubon:["Sông Vu Gia-Thu Bồn"], trakhuc:["Sông Trà Bồng-Trà Khúc","Sông Trà Khúc"],
      kon_hathanh:["Sông Kôn"], ba:["Sông Ba"], sesan:["Sông Sê San"], srepok:["Sông Srêpôk"],
      dongnai:["Sông Đồng Nai"] };
    var DAP_CONSOLE = { "Hồ Cửa Đạt":"dam.cuadat", "Hồ Ngàn Trươi":"dam.ngantruoi",
      "Hồ Tả Trạch":"dam.tatrach", "Hồ Dầu Tiếng":"dam.dautieng" };
    var lopHT = L.layerGroup([], { pane: "gis-ct" });
    var mkTen = {}; var damCache = null; var ctByName = null;
    /* SCOPE: loại đập cho hiện trong đám basin + đập chờ nảy (vẽ bất đồng bộ). */
    var loaiHien = { loi:true, dien:true };
    var pendingBat = null;
    var pendingPopup = null;
    function _keysCT(ten){ var f=_khongDau(ten); var a=f.replace(/^(ho chua|ho|dap)\s+/,'').trim(); var out=[f]; if(a&&a!==f) out.push(a); return out; }
    function _idxCT(){ if(ctByName) return; ctByName={}; (damCache||[]).forEach(function(ft){ var pp=(ft&&ft.properties)||{}; _keysCT(pp.ten).forEach(function(k){ if(k&&!ctByName[k]) ctByName[k]=pp; }); }); }
    function timCT(ten){ _idxCT(); var ks=_keysCT(ten); for(var i=0;i<ks.length;i++){ if(ctByName[ks[i]]) return ctByName[ks[i]]; } return null; }
    function apLoaiHT(){
      Object.keys(mkTen).forEach(function(t){
        var mk=mkTen[t], lo=mk._loai||'loi';
        if (loaiHien[lo]){ if(!lopHT.hasLayer(mk)) lopHT.addLayer(mk); }
        else if (lopHT.hasLayer(mk)) lopHT.removeLayer(mk);
      });
    }
    function apPending(){ if (pendingBat && mkTen[pendingBat]){ var t=pendingBat; pendingBat=null; noiBat(t); } if (pendingPopup && mkTen[pendingPopup]){ var t2=pendingPopup; pendingPopup=null; if(mkTen[t2].openPopup) mkTen[t2].openPopup(); } }
    function taiDap(){
      if (damCache) return Promise.resolve(damCache);
      var fs = ["data/congtrinh/congtrinh_ho_thuyloi.geojson","data/congtrinh/congtrinh_ho_thuydien.geojson"];
      return Promise.all(fs.map(function(f){ return fetch(f).then(function(r){return r.ok?r.json():{features:[]};}).catch(function(){return {features:[]};}); }))
        .then(function(js){ var out=[]; js.forEach(function(j,idx){ var _lo=(idx===0?'loi':'dien'); (j.features||[]).forEach(function(ft){ ft._loai=_lo; out.push(ft); }); }); damCache=out; return out; });
    }
    function icNoiBat(){
      var svg="<svg width='40' height='32' viewBox='0 0 40 32'>"+
        "<circle cx='20' cy='16' r='15' fill='none' stroke='#F2B705' stroke-width='3'/>"+
        "<g transform='translate(5,5)'><polygon points='9,4 21,4 27,18 3,18' fill='#8C5A3C' stroke='#fff' stroke-width='1.6' stroke-linejoin='round'/>"+
        "<line x1='9' y1='4' x2='21' y2='4' stroke='#fff' stroke-width='1.4'/></g></svg>";
      return L.divIcon({ className:"gis-ic", html:svg, iconSize:[40,32], iconAnchor:[20,16], popupAnchor:[0,-14] });
    }
    function icThuong(td, ten){ return td ? bieuTuongTrongDiem(ten) : bieuTuongDap("#6b7280", ten); }
    function noiBat(ten){
      Object.keys(mkTen).forEach(function(t){
        var mk=mkTen[t];
        if (t===ten){ mk.setIcon(icNoiBat()); mk.setOpacity(1); if(mk.setZIndexOffset) mk.setZIndexOffset(1000); }
        else { mk.setIcon(icThuong(mk._td, mk._ten)); mk.setOpacity(mk._td?1:0.6); if(mk.setZIndexOffset) mk.setZIndexOffset(0); }
      });
      if (mkTen[ten]) map.panTo(mkTen[ten].getLatLng(), { animate:false });
    }
    /* ve(hop): hop(p) trả về true nếu công trình thuộc hệ thống đang chọn.
       Trước đây chỉ lọc theo trường luu_vuc của geojson; nay nhận HÀM để
       còn lọc theo DANH MỤC LIÊN HỒ luật định (roster) — vì 8/11 hồ hệ Mã
       chưa gắn luu_vuc, lọc theo luu_vuc sẽ rơi mất phần lớn chuỗi hồ.    */
    function ve(hop){
      return taiDap().then(function(fs){
        lopHT.clearLayers(); mkTen={}; var pts=[];
        fs.forEach(function(ft){
          var p=ft.properties||{}; if (!hop(p)) return;
          var gm=ft.geometry, c=gm&&gm.coordinates; if(!c) return;
          var td=laTrongDiem(p), ten=p.ten||"";
          var mk=L.marker([c[1],c[0]], { pane:"gis-ct", icon:icThuong(td, ten), riseOnHover:true, opacity: td?1:0.6 });
          mk.bindTooltip(ten, { direction:"top" }); mk._td=td; mk._ten=ten; mk._loai=ft._loai||'loi';
          mk.bindPopup((function(pp){ return function(){ return popupCongTrinh(pp); }; })(p), { minWidth:250, maxWidth:380, className:"gis-popup" });
          mk.on("click", function(){
            var cid = DAP_CONSOLE[ten] || damModuleId(ten);
            if (typeof window.RIMS_hoPicker === 'function' && window.RIMS_hoPicker({ ten: ten, console_id: cid, ma_tam: (p.ma_tam || p.ma || '') }) === true) { noiBat(ten); return; }
            noiBat(ten);   /* click = định vị + đánh dấu; console mở qua nút Theo dõi trong popup */
          });
          mk.addTo(lopHT); mkTen[ten]=mk; pts.push([c[1],c[0]]);
        });
        if (!map.hasLayer(lopHT)) lopHT.addTo(map);
        apLoaiHT(); apPending();
        if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding:[60,60], maxZoom:11, animate:false });
        return pts.length;
      });
    }
    /* veTuRoster: vẽ đám đập TỪ TOẠ ĐỘ trong danh mục liên hồ, KHÔNG quét tên
       geojson. Lý do: geojson có những hồ TRÙNG TÊN ở lưu vực khác (vd hai "Hồ
       Núi Một" — Bình Định và Ninh Thuận); lọc theo tên sẽ nảy cả cái sai vị
       trí. Toạ độ đã chốt sẵn trong danh mục (đúng feature theo luu_vuc của hệ)
       nên mỗi hồ = đúng một marker, đúng chỗ. Hồ luật định chưa có trên bản đồ
       (thiếu lon/lat) thì bỏ qua — vẫn nằm trong ô tìm, chỉ không nảy.        */
    function veTuRoster(ds){
      taiDap().then(function(){
        lopHT.clearLayers(); mkTen={}; var pts=[];
        ds.forEach(function(h){
          if (h.lat==null || h.lon==null) return;
          var td=!!h.anqg, ten=h.ten_ban_do||h.ten;
          var mk=L.marker([h.lat,h.lon], { pane:"gis-ct", icon:icThuong(td, ten), riseOnHover:true, opacity: td?1:0.6 });
          mk.bindTooltip(ten, { direction:"top" }); mk._td=td; mk._ten=ten; mk._loai=/điện/i.test(h.loai||'')?'dien':'loi';
          var _ctp = timCT(h.ten) || timCT(ten);
          mk.bindPopup((function(tn,pp){ return function(){ return pp ? popupCongTrinh(pp) : popupDapMong(tn); }; })(ten,_ctp), { minWidth:250, maxWidth:380, className:"gis-popup" });
          mk.on("click", (function(hh,tn){ return function(){
            if (typeof window.RIMS_hoPicker === 'function' && window.RIMS_hoPicker({ ten: hh.ten, console_id: hh.console_id, ma_tam: (hh.ma_tam || hh.ma || '') }) === true) { noiBat(tn); return; }
            noiBat(tn);
          };})(h,ten));
          mk.addTo(lopHT); mkTen[ten]=mk; pts.push([h.lat,h.lon]);
        });
        if (!map.hasLayer(lopHT)) lopHT.addTo(map);
        apLoaiHT(); apPending();
        if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding:[60,60], maxZoom:11, animate:false });
      });
      return 0;
    }
    window.RIMS_chonHeThong = function(id, ten){
      if (!id){ lopHT.clearLayers(); mkTen={}; pendingBat=null; if(map.hasLayer(lopHT)) map.removeLayer(lopHT); return; }
      /* Ưu tiên DANH MỤC LIÊN HỒ luật định nếu hệ thống đã có (window.RIMS_ROSTER
         do index.html nạp từ data/hethong/*.json) — vẽ theo toạ độ danh mục.
         Chưa có roster thì rơi về cách cũ: lọc geojson theo trường luu_vuc.    */
      var roster = window.RIMS_ROSTER && window.RIMS_ROSTER[id];
      if (roster && roster.ds) {
        veTuRoster(roster.ds);
      } else {
        var lvs = HT_LV[id] || [ten||""];
        ve(function(p){ return lvs.indexOf(p.luu_vuc) >= 0; });
      }
    };
    window.RIMS_noiBatDap = function(ten){ if (mkTen[ten]) noiBat(ten); else pendingBat = ten; };
    window.RIMS_moPopupDap = function(ten){ if (mkTen[ten]) { noiBat(ten); if(mkTen[ten].openPopup) mkTen[ten].openPopup(); pendingPopup=null; } else { pendingPopup = ten; } };

    /* ── GLOW + BAY TỚI HỒ (cho công cụ Dự báo mưa-dòng chảy) ────────────────────
       Làm phát sáng marker các hồ có lũ; bay bản đồ tới một hồ theo tên. */
    (function(){ if(document.getElementById('hnt-glow-css'))return; var st=document.createElement('style'); st.id='hnt-glow-css';
      st.textContent='@keyframes hntGlowPulse{0%,100%{filter:drop-shadow(0 0 3px #ffd34d) drop-shadow(0 0 6px #ff9d2e)}50%{filter:drop-shadow(0 0 7px #ffd34d) drop-shadow(0 0 13px #ff7a1a)}}'
        +'.gis-ic.hnt-glow{animation:hntGlowPulse 1.5s ease-in-out infinite;z-index:1200!important}';
      document.head.appendChild(st); })();
    var GLOW_NAMES={};
    function _glowKeys(ten){ var f=_khongDau(ten), a=f.replace(/^(ho chua|ho|dap|thuy loi\s*-\s*thuy dien|thuy dien|nha may)\s+/,'').trim(); return [f,a]; }
    function _iterDamMarkers(cb){
      ['ho_thuydien','ho_thuyloi'].forEach(function(id){ var g=lop[id]; if(g&&g._diem)g._diem.forEach(function(mk){ cb(mk,(mk._p&&mk._p.ten)||''); }); });
      try{ for(var t in mkTen){ if(mkTen.hasOwnProperty(t)) cb(mkTen[t],t); } }catch(e){}
    }
    /* Khớp tên: trùng đầy đủ hoặc trùng sau khi bỏ tiền tố (đã gồm cả tiền tố
       dài "Thủy lợi - Thủy điện …"). Không dùng chứa-nhau để tránh sáng nhầm
       hồ khác tên gần giống (Thác Bà ↔ Thác Bay, Đa Nhim ↔ Đa Nhim Thượng). */
    function _glowHit(ten){ var ks=_glowKeys(ten); return !!(GLOW_NAMES[ks[0]]||GLOW_NAMES[ks[1]]); }
    function _applyGlow(){ _iterDamMarkers(function(mk,ten){ var ic=mk._icon; if(ic)ic.classList.toggle('hnt-glow',_glowHit(ten)); }); }
    var _glowTimers=[];
    function _glowSoon(){ _glowTimers.forEach(clearTimeout); _glowTimers=[]; [150,500,1100,2200,3500].forEach(function(ms){ _glowTimers.push(setTimeout(_applyGlow,ms)); }); }
    try{ map.on('moveend zoomend layeradd', _applyGlow); }catch(e){}
    window.RIMS_glowDams=function(names){ GLOW_NAMES={}; (names||[]).forEach(function(n){ _glowKeys(n).forEach(function(k){ if(k&&k.length>=3)GLOW_NAMES[k]=1; }); }); _applyGlow(); _glowSoon(); };
    window.RIMS_glowClear=function(){ GLOW_NAMES={}; _glowTimers.forEach(clearTimeout); _glowTimers=[]; _applyGlow(); };
    window.RIMS_reGlow=_applyGlow;   // gọi lại sau khi lớp vẽ lại
    window.RIMS_bayToiHo=function(ten){ var found=null; _iterDamMarkers(function(mk,t){ if(found)return; if(_glowHitTo(t,ten))found=mk; }); if(found){ try{ map.setView(found.getLatLng(),11,{animate:true}); }catch(e){} if(found.openPopup)found.openPopup(); _applyGlow(); return true; } return false; };
    function _glowHitTo(markerTen,target){ var a=_glowKeys(markerTen),b=_glowKeys(target); return a[0]===b[0]||a[1]===b[1]; }
    /* index.html gọi: lọc đám basin theo loại đang bật ở băng trái. */
    window.RIMS_scopeLoai = function(loai){ if(loai){ loaiHien.loi=!!loai.loi; loaiHien.dien=!!loai.dien; } apLoaiHT(); };
  })();

  window.RIMSGis = {
    dinhNghia: DINH_NGHIA,
    boLoc: LOC,
    bat: bat,
    /* dangBat = người dùng đã bật (dù mức phóng chưa cho vẽ).
       dangVe  = thực sự đang vẽ trên bản đồ.                            */
    dangBat: function (id) { return !!muon[id]; },
    dangVe: function (id) { return !!(muon[id] && lop[id] && map.hasLayer(lop[id])); },
    daNap: function (id) { return !!lop[id]; },
    datLoc: function (k) {
      locHienTai = LOC[k] ? k : "tat_ca";
      var tong = 0;
      Object.keys(lop).forEach(function (id) { if (DINH_NGHIA[id].diem) tong += apLoc(id); });
      return tong;
    },
    locHienTai: function () { return locHienTai; },
    demTheoLoc: function (k) {
      var f = LOC[k] || LOC.tat_ca, n = 0;
      Object.keys(DINH_NGHIA).forEach(function (id) {
        var dn = DINH_NGHIA[id];
        if (!dn.diem || !dn._data) return;
        (dn._data.features || []).forEach(function (ft) { if (f.hop(ft.properties || {})) n++; });
      });
      return n;
    },
    nguongSongNhanh: NGUONG_SONG_NHANH,
    doDuLieu: doDuLieu,
    thangMatDo: function () { return THANG_MATDO.slice(); },
    coDuLieu: function (id) { return DINH_NGHIA[id] && DINH_NGHIA[id]._co !== false; },
    /* Lớp vùng chồng nhau: cái vẽ sau đè cái vẽ trước. Ranh giới hành chính
       phải nằm dưới cùng, không thì viền tỉnh cắt ngang lưu vực.        */
    xepLai: function () {
      ["tieu_luu_vuc", "luu_vuc", "hc_xa", "hc_tinh"].forEach(function (id) {
        if (lop[id] && lop[id].bringToBack) lop[id].bringToBack();
      });
    },
    capHo: capHo, laTrongDiem: laTrongDiem
  };
})();
