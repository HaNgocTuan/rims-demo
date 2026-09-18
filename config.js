/* =====================================================================
 * RIMS — Hệ thống tích hợp quản lý hồ chứa — CẤU HÌNH KỸ THUẬT (config.js)
 * ---------------------------------------------------------------------
 * Nền tảng trực tuyến hỗ trợ ra quyết định vận hành hồ chứa thủy lợi có cửa van.
 * Kế thừa từ HydroNet Hà Tĩnh (app/viewer/config.js) — xem docs/PORT_LOG.md
 *
 * MỤC ĐÍCH
 *   Gom MỌI cấu hình kỹ thuật / endpoint về MỘT chỗ duy nhất. Không hiển
 *   thị trên UI người dùng cuối. Đây là phôi "hợp đồng tích hợp" giữa
 *   nền tảng RIMS (thuộc Nhà nước) và engine tính toán (thuộc WP).
 *
 * NGUYÊN TẮC KIẾN TRÚC (bám tài liệu kiến trúc tổng thể RIMS)
 *   - Nền tảng, vỏ DSS và TOÀN BỘ DỮ LIỆU thuộc Nhà nước.
 *   - Engine tính toán (dự báo mưa, Q đến, mô phỏng, RAT) nối qua API.
 *   - Không hardcode endpoint trong mã lớp/mã giao diện — đọc từ file này.
 *
 * KHI DEPLOY THẬT
 *   - Các endpoint dưới chuyển sang BIẾN MÔI TRƯỜNG (.env dev/stg/prod).
 *   - API key sống ở BACKEND, KHÔNG bao giờ để trình duyệt nhìn thấy.
 *     Client gọi BE của RIMS → BE gắn khoá rồi mới đi tiếp.
 *     (HydroNet đang để khoá ở secret.local.js phía client — RIMS KHÔNG
 *      được lặp lại điều này khi lên môi trường thật.)
 * ===================================================================== */

window.RIMS_CONFIG = {

  /* --- Định danh hệ thống --------------------------------------------- */
  APP_NAME    : 'RIMS',
  APP_TITLE   : 'Hệ thống tích hợp quản lý hồ chứa',
  APP_TITLE_EN: 'Reservoirs Integrated Management System',
  APP_MO_TA   : 'Nền tảng trực tuyến hỗ trợ ra quyết định vận hành hồ chứa thủy lợi có cửa van điều tiết lũ',
  APP_VERSION : '0.1.0-skeleton',
  DOMAIN      : 'dss-hochua.thuyloivietnam.gov.vn',   // tên miền dự kiến

  /* --- SỔ ĐĂNG KÝ NGUỒN DỮ LIỆU ---------------------------------------- *
   * NGUỒN SỰ THẬT về "dữ liệu đến từ đâu" là file này, KHÔNG phải các hằng
   * số bên dưới. Màn hình Cài đặt (settings.html) đọc thẳng nó. Thêm nguồn
   * mới = thêm một khối vào sources.json (+ adapter nếu cần), không sửa mã
   * lõi. Xem docs/NGUON_DU_LIEU.md.                                        */
  SOURCES_FILE : 'data/sources.json',

  /* --- KHAI BÁO KHOÁ ---------------------------------------------------- *
   * Ở đây chỉ khai báo khoá TỒN TẠI, dùng làm gì, ai sở hữu, và ở môi
   * trường thật thì lấy từ biến môi trường nào.
   * GIÁ TRỊ KHOÁ KHÔNG BAO GIỜ NẰM Ở ĐÂY.
   *     - chạy thử : secret.local.js (không commit)
   *     - thật     : backend RIMS đọc từ .env / secrets manager            */
  KEYS : {
    RMA_API_KEY : {
      mo_ta      : 'Gọi gateway RMA — lớp Trạm quan trắc và Mưa dự báo',
      chu_so_huu : 'WeatherPlus',
      env        : 'RIMS_RMA_API_KEY',
      bat_buoc   : true
    },
    VNWIS_TOKEN : {
      mo_ta      : 'Kết nối VN-WIS (danh mục hồ, mã định danh, quy trình vận hành)',
      chu_so_huu : 'Bộ Nông nghiệp và Môi trường / NAWAPI',
      env        : 'RIMS_VNWIS_TOKEN',
      bat_buoc   : false,
      ghi_chu    : 'Chưa có đường dẫn — NAWAPI chịu trách nhiệm cung cấp theo Yêu cầu KT 07/8/2026'
    }
  },

  /* --- Endpoint engine tính toán (WP) --------------------------------- *
   * Các hằng số dưới đây là BẢN SAO TIỆN DỤNG của sources.json, giữ để các
   * module bê từ HydroNet chạy được mà không phải sửa mã. Khi đổi đường dẫn:
   * sửa ở sources.json TRƯỚC rồi đồng bộ xuống đây.
   * Đây là RANH GIỚI TÍCH HỢP — mọi thứ dưới đây là dịch vụ ngoài.       */
  /* ⚑ ĐI QUA MÁY CHỦ RIMS, KHÔNG GỌI THẲNG GATEWAY.
   *   Trình duyệt gọi same-origin '/api/rma/...'; serve.mjs đọc khoá từ
   *   .env, gắn x-api-key rồi mới chuyển tiếp tới
   *   https://wpe-tools.seho.vn/api/portal/gateway/rma
   *   Nhờ vậy: (a) khoá KHÔNG bao giờ ở trình duyệt; (b) có van tiết lưu
   *   đặt ở máy chủ nên một tab cũ còn mở cũng không nện được vào gateway;
   *   (c) có sổ đếm tải thật ở /api/rma/_thongke.
   *   ⛔ BẮT BUỘC chạy bằng start_RIMS.bat (Node). Chạy bằng
   *      `python -m http.server` sẽ 404 mọi lời gọi /api/rma/*.
   *   Địa chỉ gateway thật đặt ở .env (RIMS_RMA_GATEWAY).            */
  RMA_GATEWAY : '/api/rma',
  RMA_LEGACY  : '/api/rma',
  RESOURCES   : 'https://resources.weatherplus.vn',                 // tile vệ tinh / radar / mưa / gió
  STORMS      : 'https://resources.weatherplus.vn',                 // bão — track + nón (không cần auth)
  TANK_BASE   : 'https://wpe-tools.seho.vn/api/wtm/api/TankModel',  // dự báo Q đến hồ (mô hình tank)

  /* --- Khung nhìn mặc định: toàn quốc --------------------------------- *
   * HydroNet căn theo lưu vực Ngàn Sâu; RIMS căn toàn quốc rồi mới
   * drill-down theo hồ / lưu vực.                                        */
  CENTER_LAT  : 16.0,
  CENTER_LNG  : 107.5,
  DEFAULT_ZOOM: 6,

  /* --- Nền bản đồ ------------------------------------------------------ *
   * ⚑ BỎ CARTO (30/8/2026). CARTO đã chuyển sang đòi khoá truy cập cho nền
   *   bản đồ, nên hai nền sáng/tối cũ (voyager_nolabels, dark_nolabels)
   *   không dùng được nữa. HydroNet đã chuyển sang Esri Canvas; RIMS theo.
   *   Nay cả ba nền đều của Esri, KHÔNG cần khoá.
   * ⚑ Cố ý KHÔNG dùng nền có nhãn (vấn đề chuẩn hoá địa danh / Biển Đông).
   *   Ba nền dưới đây đều không nhãn; nhãn địa danh sẽ là lớp riêng do ta
   *   kiểm soát.
   * ⚑ Hai nền Canvas chỉ có tile tới mức 16 (maxNativeZoom) — Leaflet tự
   *   phóng to ảnh mức 16 cho các mức sâu hơn, KHÔNG phải lỗi.
   * ⚑ CẦN RÀ SOÁT khi lên môi trường thật đặt tại NAWAPI: đây vẫn là dịch
   *   vụ tile nước ngoài. Với 04 hồ liên quan an ninh quốc gia nhiều khả
   *   năng phải self-host tile hoặc dùng nguồn nền trong nước.            */
  BASEMAP_DEFAULT : 'sat',
  BASEMAPS : {
    sat  : { label: 'Vệ tinh', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
             opts: { maxZoom: 19, attribution: '© Esri', crossOrigin: 'anonymous' } },
    light: { label: 'Sáng',    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
             opts: { maxZoom: 19, maxNativeZoom: 16, attribution: '© Esri', crossOrigin: 'anonymous' } },
    dark : { label: 'Tối',     url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
             opts: { maxZoom: 19, maxNativeZoom: 16, attribution: '© Esri', crossOrigin: 'anonymous' } }
  },

  /* --- ĐỘ TƯƠI DỮ LIỆU (mốc RIMS-04) ----------------------------------- *
   * Bê từ QUYẾT ĐỊNH 28/08/2026 của HydroNet. Màu chấm trạm tính theo TUỔI
   * TUYỆT ĐỐI của số liệu, KHÔNG theo nhịp báo của trạm — nó trả lời "lúc
   * này có tin được số này để quyết định không", chứ không phải "cảm biến
   * còn sống không".
   *   xanh : dưới ngưỡng này coi là tươi — tô XÁM TRUNG TÍNH, cố ý không
   *          nổi, vì màn hình 3.713 chấm mà chấm nào cũng xanh lá thì mắt
   *          bỏ qua hết. Chỉ vàng và đỏ mới được nổi.
   *   vàng : chớm cũ, đáng để ý.
   *   đỏ   : quá ngưỡng vàng — quá cũ để dựa vào mà ra quyết định.
   * Đơn vị GIỜ cho lu/can, PHÚT cho tháp.                                */
  FRESHNESS : {
    lu  : { xanh: 1, vang: 2 },     // mùa lũ: siết chặt
    can : { xanh: 3, vang: 6 },     // mùa cạn: nới ra
    thap: { xanh: 15, vang: 60 }    // tháp báo lũ (phút) — RIMS chưa dùng
  },
  /* ⚑ Nguồn quyết định chế độ lũ/cạn. HydroNet đọc flood_live_status.json do
   *   engine ngập lụt Ngàn Sâu sinh ra. RIMS chưa có engine đó, và ở quy mô
   *   toàn quốc thì "đang lũ" cũng không còn là MỘT trạng thái cho cả nước —
   *   Bắc Bộ lũ trong khi Nam Bộ cạn. Để trống thì giữ chế độ "cạn" (3h/6h)
   *   và KHÔNG gọi mạng. Đặt tay: HHTFresh.setRegime('lu').
   *   Việc phải làm: chế độ theo TỪNG LƯU VỰC, không phải cờ toàn quốc.  */
  REGIME_URL : null,

  /* --- Nhịp cập nhật --------------------------------------------------- */
  REFRESH_MINUTES_DEFAULT : 15,
  REFRESH_MINUTES_OPTIONS : [15, 30, 45],
  STATION_LATE_MINUTES    : 120,   // quá ngưỡng này coi là trạm TRỄ

  /* --- Phạm vi nghiệp vụ (bám Yêu cầu kỹ thuật 07/8/2026) -------------- */
  SCOPE : {
    SO_HO_CUA_VAN   : 235,
    SO_HO_DSS_DAYDU : 4,     // Cửa Đạt, Ngàn Trươi, Tả Trạch, Dầu Tiếng
    SO_HO_SO_BO     : 231,
    HAN_DU_BAO_GIO  : [12, 24, 48]   // mở rộng sau: 3, 6, 72, hạn vừa, hạn dài
  }
};

/* --- Tương thích ngược với các module bê từ HydroNet -------------------
 * weather-layers.js / hht-overlays.js đọc window.HYDRO_SETTINGS.
 * Ánh xạ tại đây để KHÔNG phải sửa mã các module đó (giữ nguyên để còn
 * đối chiếu / nâng cấp theo bản HydroNet về sau).                        */
window.HYDRO_SETTINGS = Object.assign({
  rmaBase     : window.RIMS_CONFIG.RMA_LEGACY,
  rmaGw       : window.RIMS_CONFIG.RMA_GATEWAY,
  /* ⚑ KHÔNG PHẢI KHOÁ THẬT — chỉ là dấu hiệu "đã có đường xác thực".
   *   weather-layers.js có hàm rmaAuthOK() = !!rmaKey(); chuỗi rỗng thì nó
   *   TẮT lớp Trạm và Mưa dự báo. Khoá thật nằm ở máy chủ, nên ta đưa một
   *   chuỗi đánh dấu để hàm đó cho qua. Header x-api-key mà trình duyệt gửi
   *   bị serve.mjs BỎ QUA và thay bằng khoá thật từ .env.
   *   Giữ được weather-layers.js NGUYÊN VẸN để còn đối chiếu với HydroNet. */
  rmaKey      : (window.RIMS_SECRET && window.RIMS_SECRET.RMA_API_KEY) || 'qua-may-chu-RIMS',
  resourceUrl : window.RIMS_CONFIG.RESOURCES,
  stormBase   : window.RIMS_CONFIG.STORMS,
  centerLat   : window.RIMS_CONFIG.CENTER_LAT,
  centerLon   : window.RIMS_CONFIG.CENTER_LNG,
  basemap     : window.RIMS_CONFIG.BASEMAP_DEFAULT,
  refreshMin  : window.RIMS_CONFIG.REFRESH_MINUTES_DEFAULT,
  lateMin     : window.RIMS_CONFIG.STATION_LATE_MINUTES,
  freshness   : window.RIMS_CONFIG.FRESHNESS      // hht-freshness.js đọc ở đây
}, window.HYDRO_SETTINGS || {});
