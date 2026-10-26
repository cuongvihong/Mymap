# Định dạng file import: Flowmap YAML

Đây là tài liệu để biết file nào import được vào MapApp và viết nó thế nào. File có đuôi `.flowmap.yaml`, là chữ thường, mở bằng Notepad cũng được. Bạn có thể tự viết, hoặc nhờ chat AI viết từ file FS (xem mục 7).

Muốn xem một file đầy đủ ngay: mở `docs/samples/moe-ea.flowmap.yaml` (4 nhóm, 31 khối, 37 kênh, 9 kịch bản). Muốn hiểu cách dùng app sau khi import, đọc `HUONG-DAN-SU-DUNG.md`.

## 1. Ví dụ nhỏ nhất chạy được

```yaml
flowmap: 1
project:
  name: Demo thanh toán
groups:
  - id: R9
    title: Thanh toán
    fs: 'FS 09.docx'
nodes:
  - id: START
    type: start
    subtype: user
    title: Parent bấm Thanh toán
  - id: F94
    type: fnc
    group: R9
    code: R9 · F9.4
    title: Trả bằng EA
    body: Gọi sổ cái trừ tiền một lần theo FundingReference.
    fix: Nhánh EA trong service thanh toán
    chips: [Idempotency key]
    section: '§3.1.2 bước 6'
  - id: LDG
    type: tech
    subtype: database
    title: Sổ cái EA
  - id: OK
    type: end
    subtype: ok
    title: Invoice về Paid
links:
  - { from: START, to: F94, via: ui, label: Chọn trả bằng EA }
  - { from: F94, to: LDG, via: rest, label: Ghi nợ theo FundingReference }
  - { from: F94, to: OK, via: ui }
scenarios:
  - id: P-01
    type: pos
    title: Parent trả bằng EA
    steps:
      - [START, Parent bấm Thanh toán]
      - [F94, Trừ tiền EA]
      - [OK, Invoice thành Paid]
```

Import file này vào dự án trống sẽ ra 4 khối, 3 kênh, 1 nhóm, 1 kịch bản. Không cần tọa độ: app tự sắp bố cục.

## 2. Năm phần của file

| Phần         | Bắt buộc | Ý nghĩa                                        |
| ------------ | -------- | ---------------------------------------------- |
| `flowmap: 1` | Có       | Phiên bản định dạng, luôn là 1                 |
| `project`    | Không    | `name` và `docs_root` (thư mục chứa file FS)   |
| `groups`     | Không    | Khung bao các khối của cùng một tài liệu FS    |
| `nodes`      | Có       | Các khối                                       |
| `links`      | Không    | Các kênh nối khối                              |
| `scenarios`  | Không    | Các kịch bản                                   |
| `layout`     | Không    | Tọa độ. App tự ghi khi xuất, bạn đừng viết tay |

Ảnh và ghim không nằm trong YAML. Bạn gắn ảnh bằng tay trong app, và import không xóa ảnh đã có.

## 3. Khối (`nodes`)

| Trường    | Bắt buộc | Giới hạn            | Ý nghĩa                                                                            |
| --------- | -------- | ------------------- | ---------------------------------------------------------------------------------- |
| `id`      | Có       | 40 ký tự            | Mã để tham chiếu trong file. Chỉ chữ không dấu, số và `. _ -`. Duy nhất trong file |
| `type`    | Có       |                     | Loại khối, xem bảng dưới                                                           |
| `title`   | Có       | 80                  | Tiêu đề hiện trên khối                                                             |
| `subtype` | Tùy loại |                     | Xem bảng dưới                                                                      |
| `group`   | Không    |                     | `id` của một nhóm. Một khối thuộc tối đa một nhóm                                  |
| `code`    | Không    | 40                  | Chữ hiện ở dòng đầu khối. Mặc định bằng `id`                                       |
| `body`    | Không    | 600                 | Khối làm gì, tối đa khoảng 4 câu                                                   |
| `fix`     | Không    | 200                 | Nơi sửa: màn hình, service hay job cần tìm khi có lỗi                              |
| `chips`   | Không    | 6 chip, mỗi chip 24 | Nhãn ngắn, viết `[A, B, C]`                                                        |
| `fs`      | Không    |                     | Tên file FS. Mặc định lấy `fs` của nhóm                                            |
| `section` | Không    | 80                  | Mục trong FS, ví dụ `§3.1.2 bước 4`                                                |

**Loại khối (`type`)**

| Giá trị | Là gì                                        | `subtype`                                                     |
| ------- | -------------------------------------------- | ------------------------------------------------------------- |
| `fnc`   | Function                                     | không có                                                      |
| `req`   | Requirement. Chỉ là điểm đầu của kênh `impl` | không có                                                      |
| `tech`  | Thành phần kỹ thuật                          | `api`, `database`, `service`, `ui`, `queue`, `storage`, `job` |
| `ext`   | Hệ thống ngoài                               | không có                                                      |
| `start` | Điểm bắt đầu                                 | `user`, `schedule`, `api`, `event`                            |
| `end`   | Điểm kết thúc                                | **bắt buộc**: `ok`, `fail`, `warn`                            |
| `cond`  | Điều kiện, rẽ Đúng hoặc Sai                  | không có                                                      |
| `note`  | Ghi chú, không có kênh                       | không có                                                      |

Khi viết chữ có dấu hai chấm, dấu `#` hoặc bắt đầu bằng `[`, `§`, `"`, hãy đặt cả chuỗi trong dấu nháy kép. Ví dụ `section: "§3.1.2"`.

## 4. Kênh (`links`)

Mỗi dòng là một cách hai khối nói chuyện với nhau. Giữa hai khối có thể có nhiều kênh.

```yaml
- { from: F94, to: LDG, via: rest, label: Ghi nợ, note: Gửi lại cùng mã chỉ trừ một lần. }
```

| Trường       | Bắt buộc | Giới hạn                                    |
| ------------ | -------- | ------------------------------------------- |
| `from`, `to` | Có       | `id` của khối có trong `nodes`              |
| `via`        | Có       | Loại kênh, xem bảng dưới                    |
| `label`      | Không    | 80 ký tự                                    |
| `note`       | Không    | 300 ký tự                                   |
| `id`         | Không    | Không ghi thì app tự đặt từ hai đầu và loại |

| `via`      | Dùng cho                                                         |
| ---------- | ---------------------------------------------------------------- |
| `impl`     | REQ được một function hiện thực. **Chỉ xuất phát từ khối `req`** |
| `rest`     | Gọi REST, API                                                    |
| `webhook`  | Webhook                                                          |
| `db`       | Đọc ghi database                                                 |
| `ui`       | Điều hướng giao diện                                             |
| `call`     | Gọi nội bộ                                                       |
| `redirect` | Redirect                                                         |
| `job`      | Lịch chạy                                                        |
| `event`    | Event                                                            |
| `queue`    | Hàng đợi                                                         |
| `file`     | Trao đổi file                                                    |

**Những kênh bị từ chối:** nối khối vào chính nó, nối vào `start`, nối vào `req`, nối ra từ `end`, nối từ hoặc tới `note`, và `impl` không xuất phát từ `req`.

## 5. Kịch bản (`scenarios`)

Kịch bản là một dãy khối theo thứ tự chạy.

| Trường   | Bắt buộc        | Ý nghĩa                                                                                |
| -------- | --------------- | -------------------------------------------------------------------------------------- |
| `id`     | Có              | Ví dụ `P-01`                                                                           |
| `type`   | Có              | `pos` (thành công), `neg` (thất bại), `alt` (phương án khác), `edge` (trường hợp biên) |
| `title`  | Có              | Tên kịch bản                                                                           |
| `steps`  | Có              | Danh sách bước                                                                         |
| `parent` | Không           | `id` kịch bản cha, nếu đây là một nhánh                                                |
| `at`     | Khi có `parent` | Khối là điểm rẽ                                                                        |

Mỗi bước viết `[idKhối, ghi chú]` (ghi chú tối đa 160 ký tự), hoặc `{ node: idKhối, note: ghi chú }`.

**Nhánh:** kịch bản con chỉ ghi các bước từ điểm rẽ trở đi. Phần trước điểm rẽ lấy từ cha.

```yaml
- id: A-01
  type: alt
  parent: P-01
  at: F94 # điểm rẽ, phải nằm trên đường đi đầy đủ của P-01
  title: Chia đôi EA và thẻ
  steps:
    - [F94, Trừ trước phần EA] # bước đầu của nhánh phải là điểm rẽ
    - [OK, Invoice về Paid]
```

Quy tắc: điểm rẽ phải nằm trên đường đi đầy đủ của cha, bước đầu của nhánh phải chính là điểm rẽ, và không được có vòng cha con.

## 6. Khi import báo lỗi

App kiểm tra cả file trước khi ghi. Có lỗi thì **không ghi gì**, và cửa sổ kết quả liệt kê từng lỗi kèm dòng, cột. Bấm lỗi để nhảy tới đúng dòng.

| Mã             | Nghĩa là                                                                   | Cách sửa                                                               |
| -------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `YAML_SYNTAX`  | Sai cú pháp YAML                                                           | Kiểm thụt dòng (dùng dấu cách, không dùng Tab), dấu nháy, dấu hai chấm |
| `VERSION`      | Thiếu hoặc sai `flowmap: 1`                                                | Thêm dòng `flowmap: 1` ở đầu file                                      |
| `REQUIRED`     | Thiếu trường bắt buộc                                                      | Thêm `id`, `type`, `title`, hoặc `from`, `to`, `via`, hoặc `steps`     |
| `ID_FORMAT`    | `id` có dấu hoặc ký tự lạ                                                  | Chỉ dùng chữ không dấu, số, `. _ -`                                    |
| `ID_DUPLICATE` | Hai khối cùng `id`                                                         | Đổi một trong hai                                                      |
| `ENUM`         | Giá trị không có trong danh sách                                           | Dùng đúng giá trị ở các bảng trên, viết chữ thường                     |
| `REF_MISSING`  | `group`, `from`, `to`, `parent`, `at` hoặc bước trỏ tới `id` chưa khai báo | Khai báo khối đó trong `nodes` hoặc sửa chính tả                       |
| `LINK_SELF`    | Kênh nối khối vào chính nó                                                 | Xóa kênh                                                               |
| `LINK_RULE`    | Kênh vi phạm quy tắc nối                                                   | Xem cuối mục 4                                                         |
| `SCN_CYCLE`    | Kịch bản cha con tạo vòng                                                  | Gỡ một quan hệ `parent`                                                |
| `SCN_FORK`     | Điểm rẽ sai                                                                | Xem cuối mục 5                                                         |
| `LENGTH`       | Vượt giới hạn ký tự                                                        | Rút gọn                                                                |
| `UNKNOWN_KEY`  | Khóa lạ (chỉ cảnh báo)                                                     | Không chặn import. Kiểm lại chính tả tên trường                        |

Bấm **Chép lỗi cho AI** để chép cả danh sách kèm câu hướng dẫn, dán lại vào chat để AI sửa file.

## 7. Nhờ chat AI viết file này

1. Trong app, thanh trên, **Import**, **Chép mẫu prompt**. Prompt đã nằm trong bộ nhớ tạm. Nó có sẵn các quy tắc, bảng giá trị hợp lệ và một ví dụ.
2. Mở chat AI, dán prompt, đính kèm các file FS, gửi.
3. Lưu phần YAML AI trả về thành file `ten-du-an.flowmap.yaml`.
4. Import. Nếu có lỗi, **Chép lỗi cho AI** rồi dán lại. Thường chỉ cần một đến hai vòng.

Mẹo để bản đồ tốt:

- Mỗi file FS là một nhóm. Mỗi function trong FS là một khối `fnc`.
- Requirement có mã riêng trong FS (BR, US, FR) mà quan trọng cho luồng thì là khối `req`, nối tới function bằng `impl`.
- Database, API nội bộ, job là `tech`. Hệ thống bên ngoài là `ext`.
- Viết một kịch bản `pos` đi hết luồng chính, rồi các nhánh `neg`, `alt`, `edge` rẽ đúng bước.
- Chỗ nào các FS mâu thuẫn nhau, ghi vào `body` hoặc `note` của kênh, bắt đầu bằng "Cần thống nhất:".

## 8. Import lần hai thì sao

- Khối khớp theo `id`. Khối đã có thì cập nhật nội dung nhưng **giữ nguyên vị trí** bạn đã kéo, trừ khi file có phần `layout`.
- Khối mới không có tọa độ được app tự sắp bố cục.
- Khối có trong dự án mà không có trong file được **giữ lại**, trừ khi bạn bật ô **Xóa những khối không có trong file**.
- Import cùng một file hai lần thì lần hai báo 0 thêm, 0 sửa, 0 xóa.
- Import không hoàn tác được bằng Ctrl+Z. Xuất YAML trước khi import lớn để có bản lùi, hoặc dùng bản sao trong thư mục `backup` của kho.

## 9. Mermaid

Ngoài YAML, app đọc được sơ đồ Mermaid `flowchart` hoặc `graph`: node thường thành Function, `A{nhãn}` thành Điều kiện, `A([nhãn])` thành Start hoặc End, `subgraph` thành nhóm, mũi tên nét đứt `-.->` thành kênh `db`, các mũi tên khác thành kênh `call`. Cú pháp lạ bị bỏ qua và báo cảnh báo kèm số dòng. Mermaid không mang kịch bản, ảnh hay Nơi sửa.
