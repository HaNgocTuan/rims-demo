// tower_config.js — Tham số vận hành tháp báo lũ (nạp tay / từ khảo sát)
// Đây là chỗ khai báo tham số CHO TỪNG THÁP, giống config.js của đập/trạm thủy văn.
// Console theo dõi CHỈ ĐỌC file này; việc chỉnh sửa sẽ do giao diện quản lý tham số
// của chương trình chính đảm nhiệm sau. Khoá theo mã trạm (code = station_id của WATEC).
//
//  thresholds : [Nhẹ, Vừa, Nặng] — theo ĐN mức ngập chung của hệ: Nhẹ 0,15 m · Vừa 0,5 m · Nặng 1,0 m (mucOf console ngập). Trước 18/09 để [1,2,3] là ĐẶT ĐẠI.
//  (cũ: [Mức 1, Mức 2, Mức 3]) — độ sâu ngập (m) cảnh báo, đặt theo từng thôn.
//  datum      : cao trình mốc "0" của thước (hệ VN-2000, m) — TỪ KHẢO SÁT.
//               API WATEC KHÔNG trả giá trị này (đã kiểm: altitude = null).
//               null = chưa khảo sát; khi có, dùng để quy đổi số đo ↔ mực ngập thật.

window.HNT_TOWER_CONFIG = {
  // Nhịp lấy dữ liệu (live).
  //  ⚑ 18/08/2026 — ĐÃ GỠ `pollSeconds: 300`. Đó là CONFIG CHẾT: không file nào đọc nữa.
  //    Nhịp làm tươi lớp tháp trên bản đồ nay bám `HYDRO_SETTINGS.refreshMin` (tower-layer.js
  //    `pollMs()`), tức nhóm "Mưa, mực nước & lớp tháp trên bản đồ" ở panel Cài đặt.
  //    Còn nhịp MÁY CHỦ kéo WATEC nằm ở `settings.json → towerCadence` (nhóm "Tháp báo lũ").
  //    Để lại số ở đây chỉ khiến người sau sửa nhầm chỗ. (Đóng nợ #13 trên thực tế.)
  //  sensorCadenceMin: nhịp gửi KỲ VỌNG của cảm biến (WATEC ~10') — dùng để cảnh báo CHẬM/MẤT,
  //    KHÔNG phải nhịp gọi. Vẫn còn hiệu lực, giữ lại.
  cadence: { sensorCadenceMin: 10 },
  default: { thresholds: [0.15, 0.5, 1.0], datum: null },
  towers: {
    // Tháp báo lũ khu vực Chợ Hôm — xã Hà Linh (Điền Mỹ, Hương Khê)
    "380005": { thresholds: [0.15, 0.5, 1.0], datum: null }
  }
};
