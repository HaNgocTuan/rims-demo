// config_ntr.sample.js — đổi tên thành config_ntr.js (đặt cạnh console_ntr.html).
// Ngàn Trươi có BACKEND RIÊNG: URL mặc định trong API_JS đã trỏ ngantruoi.seho.vn/api/renew. File này để override nếu cần.
window.HHT_CONFIG = {
  dataUrl:    'https://ngantruoi.seho.vn/api/renew/v1/Dashboard/data/fromto', // [XÁC NHẬN domain/route]
  loginUrl:   'https://ngantruoi.seho.vn/api/renew/Auth/login',               // [XÁC NHẬN]
  refreshUrl: 'https://ngantruoi.seho.vn/api/renew/Auth/refresh-token',       // [XÁC NHẬN]
  outletUrl:  'https://ngantruoi.seho.vn/api/renew/v1/dashboard/outlet/getall', // base — KHÔNG kèm ?fillSensor
  fillSensor: false,     // NT: chưa rõ cảm biến cửa van; Q xả để "–" (Z-a-Q · N-01) tới khi có dữ liệu.
  hydroCode:  '',        // '' = nhà máy chính của ngantruoi.seho.vn = Ngàn Trươi. Chỉ điền nếu backend NT yêu cầu mã riêng.
  /* ⚑ 20/08/2026 · HHT-TICK + FL-57 — HAI KHOÁ ĐÃ CHẾT, ĐÃ GỠ:
       · `pollMs`   — console không còn tự đặt nhịp. Nhịp DUY NHẤT của toàn hệ là
         `settings.json → tickMin`, và người kéo dữ liệu nay là MÁY CHỦ
         (`app/server/dam_pull_live.mjs`), không phải trình duyệt.
       · `liveness` — ngưỡng độ tươi không còn đóng cứng ở console; nó SUY TỪ
         `meta.sourceCadenceMin` mà puller khai trong `dam_history_ngantruoi.json`
         (null = nguồn nhập tay, nhịp bất định ⇒ bỏ chấm màu theo tuổi).
     Ba khoá URL + fillSensor bên trên GIỮ LẠI: puller đọc chúng để biết gọi đâu,
     và chế độ REPLAY (tua lũ 2025) vẫn dùng `dataUrl` để nhận diện kênh. */
};
