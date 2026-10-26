# MapApp: hướng dẫn sử dụng

MapApp vẽ bản đồ chức năng của một dự án phần mềm từ các tài liệu FS. Mỗi khối là một chức năng, một yêu cầu, một hệ thống ngoài hay một điều kiện. Mỗi kênh là một đường nối giữa hai khối. Kịch bản là một đường đi qua các khối, bấm Play để xem nó chạy.

Mọi dữ liệu nằm trong một thư mục gọi là **kho**. Copy kho sang USB là mang được cả bản đồ, ảnh và app.

## 1. Mở app

**Windows, lần đầu:**

1. Mở thư mục kho (thư mục có `app\win\MapApp.exe`). Bấm đúp **`MapApp.exe`**, hoặc `Mo-MapApp-Windows.bat`.
2. Làm bước 2 bên dưới để tạo kho (chỉ một lần).
3. Bấm đúp **`Tao-Shortcut-MapApp.bat`** để tạo shortcut **MapApp** (có icon) ngoài Desktop. Muốn ghim lên thanh tác vụ thì bấm phải vào shortcut, chọn Pin to taskbar.

**Windows, những lần sau:** chỉ cần bấm icon MapApp. App nhớ kho dùng lần trước và mở thẳng vào dự án gần nhất, không hỏi gì thêm. Chép cả thư mục kho sang USB hoặc ổ khác vẫn chạy: bấm `MapApp.exe` trong thư mục đó, kho nằm ngay cạnh. Shortcut cũ trỏ vào chỗ cũ thì chạy lại `Tao-Shortcut-MapApp.bat` ở chỗ mới.

**Linux (Ubuntu 22.04 trở lên):** mở terminal ở gốc kho, chạy `./mo-mapapp-linux.sh`. Lần đầu có thể cần `chmod +x mo-mapapp-linux.sh`.

App không ghi gì vào AppData hay `~/.config`. Nhật ký lỗi nằm trong thư mục `app/logs` của kho.

## 2. Tạo kho

Lần đầu mở app thấy màn hình chào.

1. Bấm **Tạo kho mới**.
2. Chọn một **thư mục trống** (ví dụ thư mục trên USB). Nếu thư mục không trống, app báo lỗi và không làm gì.
3. App tạo các thư mục con: `data` (cơ sở dữ liệu), `du-an` (mỗi dự án một thư mục, chứa ảnh), `xuat` (file xuất ra), `backup` (10 bản sao gần nhất của cơ sở dữ liệu), `thung-rac` (thứ bị xóa được chuyển vào đây).

Lần sau app tự mở lại kho gần nhất. Muốn mở kho khác, bấm **Mở kho có sẵn** và chọn thư mục kho. Danh sách **Kho gần đây** giúp mở nhanh.

Nếu USB bị rút khi đang dùng, app hiện thông báo và tự thử lại mỗi 3 giây. Cắm lại là quay về đúng chỗ cũ.

## 3. Tạo dự án

1. Bấm **Tạo dự án**.
2. Gõ tên dự án (tối đa 80 ký tự, không trùng tên dự án khác, không phân biệt dấu và hoa thường).
3. Bấm **Tạo**. Dự án mới mở ra một bản đồ trống.

Trong danh sách dự án có thể **Mở**, **Đổi tên**, **Xóa**. Xóa phải gõ lại đúng tên dự án. Thư mục dự án chuyển vào `thung-rac`, không mất hẳn.

Muốn quay về danh sách dự án, bấm **Danh sách dự án** ở góc trái thanh trên.

## 4. Chọn thư mục tài liệu

Để mở nhanh file FS từ khối, hãy cho app biết tài liệu nằm ở đâu.

1. Ở thanh bên, mục **Tài liệu FS**, bấm **Chọn thư mục tài liệu**.
2. Chọn thư mục chứa các file FS (Word, PDF, Excel, bất cứ loại gì).

Từ đó, mỗi khối có trường file và mục FS. Mở một khối, bấm **Mở file FS** để mở bằng chương trình của máy. Nếu file đã bị đổi tên hoặc xóa, khối hiện **Không tìm thấy file**. Bấm **Chép đường dẫn** để lấy đường dẫn. Muốn đổi, bấm **Đổi thư mục tài liệu**.

## 5. Vẽ bản đồ bằng vòng chọn

Vòng chọn là menu hình tròn hiện ra ngay tại con trỏ.

**Mở vòng chọn**

- Nhấn giữ **chuột phải**, rê về phía ô muốn chọn rồi thả.
- Hoặc bấm nhanh chuột phải: vòng ở lại, bấm trái vào ô để chọn.
- Hoặc giữ phím **Q**, rê, thả Q.
- **Esc** hoặc thả ở giữa vòng là hủy.
- Cuộn chuột khi đang rê lên ô có nhiều loại con để đổi loại con.

**Bấm chuột phải vào chỗ trống: thêm khối.** Các ô: Function, REQ, Tech (có loại con), Hệ thống ngoài, Ghi chú, Điều kiện, Start/End, Nhóm FS. Khối mới xuất hiện đúng tại điểm bấm.

**Bấm chuột phải vào một khối:** Mở FS, Thêm ảnh, Nối tới, Rẽ nhánh, Xóa, Nhân bản, Thu gọn hoặc Mở rộng, Sửa.

**Bấm chuột phải vào một kênh:** Thêm kênh, Đổi via, Tách dây hoặc Gộp dây, Sửa nhãn, Xóa.

**Chọn từ hai khối trở lên** (giữ Ctrl rồi bấm, hoặc kéo khung chọn): Căn hàng, Giãn đều, Gom vào nhóm, Bố cục tự động, Xóa, Nhân bản.

Cách khác để thêm khối: ở thanh bên, mục **Thêm khối**, kéo một loại vào canvas hoặc bấm để thêm vào giữa màn hình.

**Nối hai khối:** kéo từ cổng của khối này sang khối kia. Một số cách nối không hợp lệ (ví dụ nối khối vào chính nó), app sẽ báo lý do.

**Phím tắt hay dùng**

| Phím                   | Việc                                                                        |
| ---------------------- | --------------------------------------------------------------------------- |
| Ctrl+Z, Ctrl+Y         | Hoàn tác, làm lại                                                           |
| Ctrl+C, Ctrl+V, Ctrl+D | Chép, dán, nhân bản khối                                                    |
| Delete                 | Xóa khối đang chọn (app hỏi xác nhận và cho biết kịch bản nào bị ảnh hưởng) |
| F                      | Vừa màn hình                                                                |
| L                      | Bố cục tự động                                                              |
| /                      | Ô tìm kiếm                                                                  |
| Giữ Space rồi kéo      | Di chuyển bản đồ                                                            |
| Cuộn chuột             | Phóng to, thu nhỏ                                                           |
| Esc                    | Hủy thao tác đang làm                                                       |

Mọi thay đổi lưu ngay vào kho, góc thanh trên hiện **Đã lưu**.

## 6. Nhờ chat (AI) viết YAML

Bạn không phải vẽ tay hết. Hãy đưa file FS cho một chat AI (Claude hoặc bất kỳ chat nào), nhờ nó trả về file **Flowmap YAML**, rồi import vào app. App không chạy AI bên trong, chỉ đọc file YAML.

1. Trong bản đồ, bấm **Import** ở thanh trên, chọn **Chép mẫu prompt**. Prompt đã nằm trong bộ nhớ tạm.
2. Mở chat, dán prompt, đính kèm file FS, gửi.
3. Chat trả về một khối YAML. Lưu nó thành file, đuôi `.flowmap.yaml`.
4. Qua bước 7 để import.

Muốn tự viết hoặc sửa file YAML, đọc `DINH-DANG-FLOWMAP.md` (các trường, giá trị hợp lệ, mã lỗi và cách sửa).

Nếu import báo lỗi, bấm **Chép lỗi cho AI**, dán lại vào chat, chat sửa và gửi YAML mới. Thường chỉ cần một đến hai vòng.

## 7. Import

Có hai cách:

- **Dự án mới từ file:** ở màn hình danh sách dự án, bấm **Import YAML hoặc Mermaid**, chọn file, gõ tên dự án, bấm **Tạo dự án và nhập**.
- **Vào dự án đang mở:** thanh trên, **Import**, **Import YAML hoặc Mermaid**. Cũng có nút cùng tên ở thanh bên.

App kiểm tra file trước khi ghi bất cứ thứ gì. Cửa sổ **Kết quả import** cho biết:

- Có lỗi: hiện danh sách lỗi, bấm một lỗi để mở panel YAML ở đúng dòng. **Chưa có gì được ghi vào bản đồ.**
- Cảnh báo: không chặn, nên đọc.
- **Sẽ thay đổi:** bảng số khối, kênh, nhóm, kịch bản được thêm, sửa, xóa, giữ nguyên.
- Tùy chọn **Xóa những khối không có trong file**. Tắt thì khối chỉ có trong bản đồ được giữ lại.

Bấm **Áp dụng**. Khối mới chưa có tọa độ được app tự sắp bố cục. Import lại cùng một file thì không có gì thay đổi.

Lưu ý: **import không hoàn tác được bằng Ctrl+Z.** Có bản sao cơ sở dữ liệu trong thư mục `backup` của kho nếu cần quay lại.

File tối đa 5 MB. Ngoài YAML, app còn đọc được sơ đồ **Mermaid flowchart**.

### Panel YAML

Nút **YAML** ở thanh trên mở một panel song song với bản đồ, hiện YAML hiện tại. Sửa chữ ở đây rồi bấm **Áp dụng** (kiểm tra rồi ghi vào bản đồ), hoặc **Hoàn lại** để bỏ chỗ sửa. Dòng lỗi được tô màu. Kéo mép panel để đổi độ rộng.

### Xuất file

Thanh trên, **Xuất**: **Flowmap YAML**, **Mermaid**, **JSON Canvas (Obsidian)**, **Ảnh PNG toàn bản đồ**. File ghi vào thư mục `xuat` của kho, bấm **Mở thư mục** trên thông báo để xem.

## 8. Kịch bản và Play

Kịch bản là một dãy khối theo thứ tự chạy, ví dụ "Parent trả học phí bằng EA".

**Ghi một kịch bản**

1. Ở thanh bên, mục **Kịch bản**, bấm **Ghi kịch bản**.
2. Bấm lần lượt các khối theo thứ tự chạy. Mỗi bấm là một bước, có thể ghi chú cho từng bước và kéo để đổi thứ tự.
3. Đặt tên, chọn loại, bấm **Xong**.

**Kịch bản con (nhánh):** chọn **Kịch bản cha**, đặt **điểm rẽ** ("Rẽ nhánh tại bước này"). Kịch bản con thừa hưởng các bước của cha tới điểm rẽ.

**Xem đường đi:** bấm một kịch bản ở thanh bên, các khối và kênh trên đường đi sáng lên, phần còn lại mờ đi. Giữ **Ctrl** và bấm thêm kịch bản để so sánh nhiều đường cùng lúc.

**Play:** bấm **Chạy kịch bản** cạnh kịch bản. Một thanh điều khiển hiện ra với **Tạm dừng, Tiếp tục, Dừng, Tốc độ**. Khối chạy lần lượt, dòng **Bước đang chạy** hiện ghi chú của bước. Nếu bật **Ảnh khi Play** ở thanh trên, khối có ảnh sẽ hiện ảnh và các ghim của nó trong lúc chạy.

## 9. Ảnh và ghim

- Mở khối, bấm **Thêm ảnh**, kéo file ảnh thả vào khối, hoặc chọn khối rồi nhấn **Ctrl+V** để dán ảnh chụp màn hình.
- Chấp nhận PNG, JPG, WEBP, GIF; mỗi ảnh tối đa 15 MB; mỗi khối tối đa 8 ảnh.
- Bấm vào ảnh để mở trình xem. **Đặt ghim** rồi bấm lên ảnh để ghim một điểm, gõ ghi chú cho ghim (tối đa 120 ký tự). Dùng **Ghim trước, Ghim sau** để lướt qua các ghim, **Toàn ảnh** để xem cả ảnh.
- Rê chuột lên khối có ảnh để xem nhanh.

## 10. Double click: tập trung vào một khối

- **Bấm một lần vào khối:** mở panel chi tiết bên phải (sửa tiêu đề, mô tả, file FS, ảnh).
- **Double click vào khối:** chế độ **tập trung**. Chỉ khối đó và các khối nối trực tiếp với nó sáng, phần còn lại mờ đi. Double click vào nền trống hoặc nhấn **Esc** để thoát.
- **Double click vào tiêu đề khối:** đổi tên khối ngay tại chỗ.

## 11. Tìm kiếm và lọc

- Nhấn **/** để vào ô tìm kiếm trên thanh trên, gõ tên hoặc mã khối.
- Ở thanh bên, ô **Lọc theo Nơi sửa** giữ lại các khối có chữ khớp, ví dụ gõ "e-Service Portal".
- Thanh bên còn có các danh sách **Khối**, **Kênh liên kết**, **Loại khối**; bấm một dòng để nhảy tới khối đó.

## 12. Giao diện

- **Sáng / tối:** nút trên thanh trên.
- **Một dây / Nhiều dây:** chế độ vẽ kênh. Một dây gộp mọi kênh giữa hai khối thành một đường, nhiều dây vẽ riêng từng kênh.
- **Vừa màn hình:** đưa cả bản đồ vào khung nhìn (phím F).
- App hỗ trợ dùng bàn phím: Tab đi qua thanh trên, thanh bên, canvas. Nếu hệ điều hành bật "giảm chuyển động", app tắt mọi hiệu ứng chuyển động.
- Cửa sổ nhỏ nhất 1280 × 800; bố cục chuẩn ở 1440 × 900.

## 13. Sao lưu và khôi phục

- Mỗi lần mở kho, app chép cơ sở dữ liệu vào `backup/` (giữ 10 bản gần nhất).
- Muốn quay về bản cũ: đóng app, chép file trong `backup/` đè lên `data/mapapp.db`, mở lại.
- Tắt app đột ngột (rút điện, kill tiến trình) không làm hỏng dữ liệu; thao tác đang dở hoặc được ghi trọn, hoặc không ghi gì.

## 14. Khi có sự cố

| Hiện tượng                               | Cách xử lý                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "Thư mục này không trống" khi tạo kho    | Chọn thư mục trống khác                                                                               |
| "Thư mục này không phải kho MapApp"      | Thư mục phải có `data/mapapp.db`; chọn đúng gốc kho                                                   |
| "Chưa chọn thư mục tài liệu" khi mở file | Làm bước 4                                                                                            |
| Khối báo "Không tìm thấy file"           | File bị đổi tên hoặc di chuyển; sửa trường file của khối hoặc đổi thư mục tài liệu                    |
| Import báo lỗi                           | Bấm lỗi để xem dòng; hoặc **Chép lỗi cho AI**                                                         |
| Ảnh không hiện                           | Ảnh nằm trong `du-an/<dự án>/anh`; kiểm tra file còn đó                                               |
| Linux không mở được app                  | Chạy `chmod +x mo-mapapp-linux.sh`; trên Ubuntu 24.04 trở lên thử `./mo-mapapp-linux.sh --no-sandbox` |
| Lỗi khác                                 | Gửi file mới nhất trong thư mục `app/logs` cho người hỗ trợ                                           |
