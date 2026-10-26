# MapApp

Ứng dụng desktop vẽ bản đồ chức năng của dự án phần mềm từ tài liệu FS.

## Đọc gì, khi nào

| Bạn là | Đọc | Ở đâu |
|---|---|---|
| Người cần viết hoặc sửa file import (YAML) | Các trường, giá trị hợp lệ, mã lỗi, ví dụ nhỏ chạy được, cách nhờ chat AI viết | `DINH-DANG-FLOWMAP.md`, file mẫu đầy đủ ở `docs/samples/moe-ea.flowmap.yaml` |
| Người dùng app | Hướng dẫn sử dụng từng bước: tạo kho, dự án, vẽ, import YAML, kịch bản, Play | `HUONG-DAN-SU-DUNG.md` (cũng nằm ở gốc `dist/kho` sau khi đóng gói) |
| Người chạy thử trên Windows | Bấm đúp `Chay-thu-Windows.bat` để cài, kiểm tra và mở app dev. Bấm đúp `Dong-goi-Windows.bat` để đóng gói bản chạy từ USB | gốc thư mục này |
| Người phát triển | Tiến độ, quyết định thiết kế, bảng hiệu năng, bảng tiêu chí chấp nhận, việc tồn | `docs/PROGRESS.md` |
| Người cần đặc tả | Chức năng và kỹ thuật | `docs/FSD.md`, `docs/TDD.md` |

Yêu cầu khi chạy từ mã nguồn: Node.js 22.12 trở lên. Trên Windows dùng `npm install --ignore-scripts` (hai file `.bat` đã làm sẵn), nếu không npm có thể đòi Visual Studio C++.

---

## Bộ tài liệu dự án MapApp

Bộ này dùng để giao cho AI lập trình (ví dụ Claude Code) xây MapApp theo từng session, cùng cách làm với studyapp.

```
docs/
├── FSD.md                     Đặc tả chức năng: FR, AC, quy tắc nghiệp vụ, NFR
├── TDD.md                     Thiết kế kỹ thuật: kiến trúc, schema, IPC, Flowmap YAML, tokens, đóng gói
├── design/                    Ảnh tham chiếu 1440 × 900 nền tối và hai bản demo chạy được
│   ├── 01 đến 09 *.png
│   ├── demo-moe/index.html    Bản đồ demo từ FS 1, 3, 8, 9 của dự án MOE
│   └── radial-demo.html       Vòng chọn công cụ
├── samples/moe-ea.flowmap.yaml  Dữ liệu mẫu: 4 nhóm, 31 khối, 37 kênh, 9 kịch bản
└── prompts/
    ├── 00-MASTER.md           Luật chung, đọc ở đầu MỌI session
    └── 01 đến 10              Mỗi file là một session
```

## Cách dùng

1. Tạo thư mục dự án trống, chép cả thư mục `docs/` vào.
2. Mỗi session mở một cuộc trò chuyện mới với AI lập trình trong thư mục dự án, gửi:
   `Đọc docs/prompts/00-MASTER.md, sau đó thực hiện docs/prompts/01-khoi-tao-du-an.md.`
3. AI tóm tắt phạm vi và hỏi nếu có quyết định khó đảo ngược. Trả lời rồi để AI làm.
4. Khi AI báo xong, tự kiểm thử theo "Tiêu chí hoàn thành" và so giao diện với ảnh trong `docs/design/`.
5. Đạt thì commit git rồi mới sang session sau. `docs/PROGRESS.md` do AI cập nhật, đừng xóa.

Muốn đổi yêu cầu thì sửa `FSD.md` hoặc `TDD.md` trước, ghi phiên bản và ngày ở đầu file, rồi mới yêu cầu AI làm theo.
