# Thời khoá biểu

App iPhone xem lịch dạy/học, lấy ý tưởng từ classtimetable.app, làm lại theo cách xếp lịch của trường phổ thông Việt Nam.

- **Thời gian biểu** (tiết mấy → mấy giờ): cố định, sửa ở Cài đặt. Mặc định là giờ của THPT Nguyễn Trãi – Ba Đình.
- **Thời khoá biểu** (tiết nào dạy lớp nào): nhập trên lưới giống tờ giấy. Mỗi lần trường đổi lịch thì lưu bản mới kèm ngày áp dụng; tới ngày đó app tự chuyển.
- Tab Hôm nay, TKB theo tuần, Việc cần làm.
- **App iPhone thật**: widget màn hình chính (nhỏ / vừa / lớn) và màn hình khoá, chuông báo trước giờ vào lớp.

## Cấu trúc

| Chỗ | Là gì |
|---|---|
| `src/` | Toàn bộ giao diện và cách tính lịch (React) — dùng chung cho bản web và app iPhone |
| `src/widget.ts` | Tính sẵn lịch 14 ngày gửi sang widget |
| `src/native.ts` | Chỉ chạy trong app iPhone: cập nhật widget + đặt chuông báo |
| `ios/App/TKBWidget/` | Widget, viết bằng Swift |
| `ios/App/App/WidgetBridgePlugin.swift` | Cầu nối app → widget |
| `ios/App/project.yml` | Mô tả dự án Xcode; máy Mac trên GitHub sinh `App.xcodeproj` từ file này |
| `.github/workflows/ios.yml` | Máy Mac của GitHub tự build app iPhone mỗi lần đẩy code lên |

## Lệnh (gõ trong PowerShell ở `F:\AI\timetable`)

| Lệnh | Làm gì |
|---|---|
| `npm run dev` | Chạy thử bản web trên máy |
| `npm test` | Chạy bộ kiểm tra tự động |
| `npm run build` | Đóng gói bản web (thư mục `dist`) |
| `npm run build:ios` | Đóng gói phần web cho app iPhone và chép sang `ios/` |

Biểu tượng app tạo lại bằng `node scripts/make-icons.mjs`.

(C) August87 - 0982722036
