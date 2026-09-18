# Dữ liệu nền RIMS

Thư mục này **cố ý để trống** khi bê code từ HydroNet. Dữ liệu của HydroNet gắn chặt vào Hà Tĩnh / lưu vực Ngàn Sâu; RIMS cần bộ nền **toàn quốc**.

## Bố cục

```
data/
├─ base/         nền địa hình, giao thông (quốc lộ, tỉnh lộ, đường sắt)
├─ admin/        ranh giới tỉnh / xã (bộ SAU sáp nhập 2025), kèm dân số & diện tích
├─ hydro/        lưu vực & tiểu lưu vực · sông suối · mặt nước · trạm KTTV
├─ labels/       nhãn địa danh curated (thay nhãn của nền bản đồ)
└─ reservoirs/   danh mục hồ chứa — reservoirs_rims.json
```

## Cần lấy từ đâu

Theo Yêu cầu kỹ thuật 07/8/2026, **NAWAPI chịu trách nhiệm cung cấp** dữ liệu nền: dữ liệu VN-WIS, hồ chứa, lưu vực, công trình, trạm quan trắc, ảnh nền, viễn thám, DEM và dữ liệu Big Data hiện có.

| Nhóm | Nội dung tối thiểu | Nguồn |
|---|---|---|
| Hành chính | ranh giới tỉnh/xã hiện hành, dân số, diện tích | cơ quan đo đạc bản đồ |
| Lưu vực | ranh lưu vực & tiểu lưu vực, mạng sông suối, điểm kiểm soát dòng chảy, điểm khống chế hạ du | NAWAPI |
| Công trình | 235 hồ có cửa van, thủy điện lớn, công trình ảnh hưởng vận hành liên hồ | VN-WIS (ưu tiên) |
| Trạm | khí hậu, đo mưa, thủy văn, mực nước sông/hồ, lưu lượng, quan trắc chuyên dùng | NAWAPI + KTTV |
| Bản đồ / viễn thám | ảnh nền, DEM, sử dụng đất, dân cư, hạ tầng, bản đồ ngập | NAWAPI |

## Quy tắc kỹ thuật (kế thừa HydroNet — đã kiểm chứng)

- **CRS EPSG:4326** (lat/lon) cho mọi lớp vector đưa lên Leaflet.
- **UTF-8**; dữ liệu MapInfo cũ mã TCVN3/ABC phải giải mã sang Unicode trước.
- Làm tròn toạ độ 6 chữ số; cắt theo vùng quan tâm trước khi đưa lên web.
- Lớp nặng (nhà cửa, mạng khe suối, DEM) **không** nạp thẳng — dùng tile / cắt theo lưu vực / index tiền tính.
- Nạp qua `fetch()` → `L.geoJSON(...)` vào **pane riêng theo thứ tự z**: nền → ranh giới → thuỷ hệ → công trình → trạm → **nhãn (trên cùng)**.
- Lớp tham chiếu tĩnh **không** ghi đè ngưỡng báo động của trạm — ngưỡng chỉ có một nguồn là engine.
- Lọc giá trị rác dạng `"<Null>"` / `nan` khi render.

## Trạng thái hiện tại

| File | Trạng thái |
|---|---|
| `reservoirs/reservoirs_rims.json` | có — 04 hồ ANQG, chỉ điền trường có nguồn xác thực, còn lại `null` |
| tất cả còn lại | **chưa có** |
