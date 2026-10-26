# PROGRESS

## Trạng thái các session

| Session | Trạng thái | Ngày | Ghi chú |
|---|---|---|---|
| 01 Khởi tạo | Xong trên Linux, chờ kiểm trên Windows | 2026-10-24 | typecheck, lint, 67 test xanh. Chạy dev và bản AppImage đã kiểm. Bản Windows đã build nhưng chưa chạy thử |
| 02 Kho và database | Xong trên Linux, chờ kiểm trên Windows | 2026-10-24 | typecheck, lint, 133 test xanh. Đã chạy thử toàn bộ luồng bằng app thật (tạo kho, dự án, khởi động lại, xóa, rút kho). Hộp thoại chọn thư mục của hệ điều hành chưa kiểm tay |
| 03 Logic thuần và YAML | Xong trên Linux | 2026-10-24 | typecheck, lint, 270 test xanh. Đã nạp dữ liệu mẫu bằng app thật (MAPAPP_SEED=1) và đối chiếu trong SQLite: 4 nhóm, 31 khối, 37 kênh, 9 kịch bản, 34 bước, tọa độ đúng mục layout |
| 04 Canvas và khối | Xong trên Linux | 2026-10-24 | typecheck, lint, 292 test xanh. Đã chạy checklist bằng app thật (Electron, dữ liệu mẫu): 4 khung, 31 khối đúng tọa độ, double click F9.4 sáng đúng 7 khối, P-01 cộng F8.2 sáng F8.1, F8.2, F9.1, Esc, đổi tên tại chỗ, mở file FS và nút đỏ khi đổi tên file, kéo ra và vào khung, kéo rồi tắt app, thu gọn nhóm thành ô. Độ mượt khi pan và zoom chưa đo được trên máy build (không có GPU) |
| 05 Kênh liên kết | Xong trên Linux | 2026-10-24 | typecheck, lint, 303 test xanh. Đã chạy checklist bằng app thật: chế độ một dây có huy hiệu, F9.5/F9.6 với Payment Provider ghi 3 và popover liệt kê đủ 3 kênh, rê chuột tách dây không nhấp nháy, chế độ nhiều dây 37 dây, chọn dây, Delete, kéo cổng tạo kênh F8.1 tới Database Parent_Profile ra via Database, sửa loại và nhãn trong panel, kéo vào khối Start bị từ chối kèm toast, thả ra nền chỉ hủy, kéo đầu dây nối lại, khối REQ thử đỏ rồi thành 1 function, bộ lọc REQ chưa phủ, double click F9.4 sáng đúng các cặp lân cận |
| 06 Vòng chọn và chỉnh sửa | Xong trên Linux | 2026-10-25 | typecheck, lint, 334 test xanh. Đã chạy checklist bằng app thật: vuốt phải lên tạo Function đúng chỗ bấm và đang sửa tên, cuộn hai nấc ở ô Tech ra Service và nhớ cho lần sau, bấm nhanh giữ vòng mở, phím Q trên khối vuốt xuống ra hộp xóa liệt kê A-01, N-05, E-02 kèm ghi chú N-05 thành kịch bản gốc, Ctrl+Z trả khối, kênh và bước, kéo dây ra nền chọn Tech ra khối mới và kênh REST (ô không hợp lệ mờ đi), chọn ba khối rồi Căn hàng trái và hoàn tác, Shift kéo chọn khung, Nối tới, vòng của kênh (Tách dây), phím / tìm funding ra F9.4 và Sổ cái EA, Enter phóng tới, lọc Nơi sửa, kho khối (bấm thêm vào giữa), đổi tên nhóm, kéo bám lưới 16 px |
| 07 Ảnh và ghim | Xong trên Linux | 2026-10-25 | typecheck, lint, 364 test xanh (có 17 test tích hợp ảnh, ghim, giao thức và 13 test logic nhìn ảnh). Đã chạy checklist bằng app thật (Electron, ảnh thật fs09-swimlane.png, fs08-flow.png, fs09-split.png, fs09-states.png): thêm bằng nút, kéo thả vào F9.3, Ctrl+V ảnh từ clipboard khi F9.3 đang chọn, ảnh nhỏ tải qua mapimg://, rê dừng 250 ms mới hiện peek, lightbox có 5 ghim của fs09-swimlane, ghim 3 nằm giữa khung với callout bên phải và chữ giữ 12 px, Ghim trước, Ghim sau, mũi tên quay vòng, Toàn ảnh, kéo ghim, kéo đổi thứ tự ghim, xóa khối có ảnh rồi Ctrl+Z còn đủ 2 ảnh và 5 ghim, ảnh thứ 9 bị từ chối, ô Thêm ảnh của vòng tròn, cửa sổ 1280 x 800 vẫn vừa, giảm chuyển động không có ảnh bay và zoom tức thì |
| 08 Kịch bản và Play | Xong trên Linux | 2026-10-25 | typecheck, lint, 396 test xanh (32 test mới: bộ điều khiển Play với đồng hồ giả, quy tắc ghi kịch bản, hoàn tác tạo, sửa, xóa kịch bản). Đã chạy checklist bằng app thật (Electron, dữ liệu mẫu, ảnh fs08-flow.png): cây kịch bản P-01, A-01, N-05, E-02 thụt 16 px, chọn A-01 rồi Ctrl+N-05 hiện 2 đường lệch nhau và nhãn rẽ nhánh ở khối rẽ của cả hai, bấm lại thì bỏ chọn, Play P-01 chạy đủ 13 bước và ở F8.1 hiện thẻ ảnh với ghim SingPass, bấm thẻ mở lightbox đúng ghim và Play tạm dừng cho tới khi đóng, Play N-05 chạy 14 bước và dừng ở End Invoice, Tạm dừng, Tiếp tục, tốc độ 2x, Dừng giữa chừng không còn chấm hay khối sáng, Esc và nhấp đôi vào khoảng trống dừng Play, ghi kịch bản 4 bước rồi rẽ nhánh ở bước 2 (nhánh chỉ lưu từ bước 2 trở đi), khối ngoài đường của kịch bản cha bị chặn kèm thông báo, sửa tên, xóa kịch bản cha bằng cả hai cách rồi Ctrl+Z, giảm chuyển động không có chấm |
| 09 YAML AI và bố cục | Xong trên Linux, còn một mục thử tay | 2026-10-25 | typecheck, lint, 437 test xanh (41 test mới: Mermaid, JSON Canvas, ELK không chồng lấn với 200 khối và 400 kênh trong khoảng 1,5 s, nhập và xuất qua service, pngScene, tô màu YAML). Đã chạy checklist bằng app thật (e2e09, 49 kiểm tra) và chạy lại e2e05 đến e2e08: import mẫu ở màn chào ra 31 khối, 37 kênh, 9 kịch bản; import lần hai báo 0 thêm, 0 sửa, 0 xóa; sửa một từ `body` trong panel YAML rồi Áp dụng đổi nội dung mà khối không dời; đổi `to: LDG` thành `to: LDX` báo lỗi đúng dòng, bấm lỗi nhảy tới dòng đó, Chép lỗi cho AI chép đúng; mẫu bỏ phần `layout` nhập vào dự án mới được sắp xong trong khoảng 0,3 s, không khối nào chồng nhau, khung nhóm không chồng nhau; xuất YAML, Mermaid, JSON Canvas, PNG ra `xuat/`. Chưa làm: thử bằng chat AI thật (xem Việc tồn) |
| 10 Đóng gói và nghiệm thu | Xong trên Linux, còn các mục cần máy Windows thật và studyapp thật | 2026-10-25 | typecheck, lint, 480 test xanh (thêm 6 test hiệu năng với file 200 khối, 1 test `createDiagramApi`, 70 ca tương phản). Bảng hiệu năng và bảng AC ở dưới. Đã chạy e2e05 đến e2e11 bằng app thật (e2e10: hiệu năng, bàn phím, tương phản, giảm chuyển động, kill giữa kéo và giữa import; e2e11: bản đóng gói Linux trong bố cục USB). Chưa làm được vì thiếu máy: chạy bản Windows từ USB exFAT, chạy bản Linux từ USB trên Ubuntu 22.04, nhánh thử studyapp thật (xem mục Nghiệm thu Session 10) |

## Quyết định

- [Session 01] Không có studyapp trên máy build, nên phần 1 của `tokens.css` (tên biến chung theo TDD 9.1) và `computeAppDir` được viết lại theo mô tả trong TDD, không chép từ studyapp. Khi gộp module cần đối chiếu giá trị token và logic `resolveRoot()` với studyapp.
- [Session 01] Quy ước `computeAppDir`: `appDir` là thư mục `app/` của Kho. Windows: cha của thư mục chứa `MapApp.exe` (`<Kho>/app/win/MapApp.exe`). AppImage: cha của thư mục chứa file AppImage, lấy từ `APPIMAGE_ORIG_DIR` (do `mo-mapapp-linux.sh` đặt) rồi mới đến `APPIMAGE`. Dev: `<cwd>/.dev-app`, nên hàm có tham số thứ tư `cwd` (mặc định `.`) để vẫn là hàm thuần.
- [Session 01] Chưa cài `better-sqlite3`. Prompt 01 không dùng database, và thư viện native cần bước rebuild cho Electron. Session 02 sẽ thêm, bản ghi cố định 13.0.3 theo TDD. Mục `asarUnpack` trong `electron-builder.yml` đã khai sẵn.
- [Session 01] Phiên bản ghi cố định đúng TDD mục 2: Electron 44.4.5, React 19.3.0, TypeScript 5.9.3, Vite 7.3.6, electron-vite 5.0.0, Zustand 5.0.15, Vitest 5.0.2. TDD không nêu số cho `@xyflow/react` (12.12.0), `elkjs` (0.12.0), `yaml` (2.9.1), `@fontsource/*` (5.3.0), electron-builder (26.18.0), nên lấy bản ổn định mới nhất ở ngày cài.
- [Session 01] Công cụ phát triển ngoài bảng TDD, cần chủ dự án xác nhận: `@vitejs/plugin-react` 5.2.0 (bản 6 đòi Vite 8), `eslint` 9.39.5, `@eslint/js`, `typescript-eslint` 8.72.0, `eslint-plugin-react-hooks` 7.1.1, `globals`, `prettier` 3.9.10, `@types/node`, `@types/react`, `@types/react-dom`. Prompt 01 yêu cầu ESLint và Prettier nên các gói này là bắt buộc về mặt kỹ thuật. Không thêm jsx-a11y: luật "không onClick trên div" được viết bằng `no-restricted-syntax`.
- [Session 01] `package-lock.json` được tạo bằng npm 11 vì npm 10.9.9 lỗi `Cannot read properties of null (reading 'edgesOut')` khi giải peer dependency của vitest. Lockfile đã kiểm với `npm ci --dry-run` của npm 10 và chạy được.
- [Session 01] Thanh bên (`Sidebar`) đặt ở `features/diagram/panels/` đúng TDD mục 3, nhận dữ liệu qua props. `shell/App.tsx` ghép Sidebar và `DiagramPage` cạnh nhau. Từ Session 04 có thể đưa Sidebar vào trong `DiagramPage`.
- [Session 01] Thêm vài biến `--dg-*` ngoài danh sách TDD 9.2 vì bản demo dùng: `--dg-bg`, `--dg-line-soft`, `--dg-accent-ink`, `--dg-focus`, `--dg-shadow`. Các tên chung (`--bg`, `--surface`, `--line`, `--ink`, `--muted`, `--primary`...) được ánh xạ sang biến `--dg-*` bên trong `.dg-root`, nên shell đổi theo nền sáng tối cùng module.
- [Session 01] Các nút "Một dây | Nhiều dây", "Ảnh khi Play" đổi trạng thái hiển thị trong bộ nhớ nhưng chưa tác động tới gì. Nút "Vừa màn hình" chưa làm gì. Nút "Sáng / tối" hoạt động, trạng thái chỉ nằm trong bộ nhớ.

- [Session 02] Kết quả IPC thành công có dạng `{ ok: true, data }`, lỗi là `{ ok: false, code, message }`. TDD chỉ nêu dạng lỗi "như studyapp", nên dạng thành công do mình chọn. Renderer đổi `code` thành câu tiếng Việt, `message` tiếng Anh chỉ để ghi log.
- [Session 02] `config.json` nằm ở `<appDir>/config.json`, gồm kho gần đây (tối đa 8), kho dùng lần trước và dự án dùng lần trước của từng kho. Ghi qua file tạm rồi đổi tên. File hỏng thì dùng mặc định.
- [Session 02] `resolveRoot` chọn kho theo thứ tự: kho dùng lần trước nếu còn, rồi thư mục chứa `app/` nếu là kho (trường hợp USB đổi ký tự ổ đĩa), nếu không thì hiện màn chào. Một thư mục là kho khi có `data/mapapp.db`.
- [Session 02] "Tạo kho mới" chỉ nhận thư mục trống, hoặc thư mục chỉ có `app/` và hai script mở app. Thư mục có file khác bị từ chối `KHO_NOT_EMPTY`, để không tạo `data/`, `du-an/` giữa một thư mục đang dùng.
- [Session 02] Mã dự án (`code`) không dùng lại: lấy số lớn nhất trong database, trong `du-an/` và trong `thung-rac/`, rồi cộng 1. Không đổi schema vì TDD 5.2 chốt `dg_schema_version` là 1. Hạn chế: nếu người dùng tự xóa hẳn thư mục `thung-rac/` thì mã của dự án cuối cùng đã xóa có thể được dùng lại.
- [Session 02] `better-sqlite3` 13.0.3 đi kèm bản dựng sẵn N-API cho Windows, Linux, macOS. Không cần rebuild cho Electron và cùng một bản chạy được cả trong Electron lẫn Vitest. `electron-builder.yml` giữ `npmRebuild: false`. Thêm `@types/better-sqlite3` (bản dev) để có kiểu.
- [Session 02] Sao lưu chạy mỗi lần mở kho, trước khi mở kết nối database, kể cả kho vừa tạo. Sao lưu lỗi chỉ ghi log, không chặn việc mở kho. Khi kho tự nối lại sau khi bị rút, app mở lại kết nối nhưng không sao lưu thêm.
- [Session 02] Kho do shell giữ (`main/shell/kho/manager.ts`). `registerDiagramIpc` trả về hàm gỡ handler, shell gọi hàm này khi đổi kho hoặc khi kho nối lại, rồi đăng ký lại với kết nối mới.
- [Session 02] `setDocsRoot` mở hộp thoại ngay trong `ipc.ts` (nạp `electron` bằng `import()` lúc gọi) để phần còn lại của module chạy được dưới Node khi test. Service `setDocsRoot(id, path)` là hàm thuần theo đường dẫn.
- [Session 02] Cài đặt giao diện của dự án (nền sáng tối, một dây hay nhiều dây, ảnh khi Play) được lưu ngay vào `settings_json` mỗi lần đổi, và thanh trên hiện "Đang lưu", "Đã lưu". Các nút Một dây, Nhiều dây, Ảnh khi Play mới chỉ lưu giá trị, chưa tác động lên canvas.
- [Session 02] Bấm "Danh sách dự án" trên thanh trên thì quên dự án dùng lần trước, nên lần mở app sau vào màn chào. Chỉ khi đóng app lúc đang xem một dự án thì lần sau mới vào thẳng dự án đó.
- [Session 02] Đã bỏ `renderer/shell/dev/fixtures.ts`. Thanh bên giờ dựng từ `ProjectData` bằng `buildSidebarModel`, các mục trống hiện câu "Chưa có ...". Nút Import YAML trong thanh bên và ở màn chào bị vô hiệu, ghi chú "Có ở Session 09".

- [Session 03] Kênh trong YAML không có `id`, trong khi database cần `key` duy nhất. Khóa kênh được suy ra từ hai đầu và loại: `<from>_<to>_<via>`, kênh trùng bộ ba thì thêm `_2`, `_3` theo thứ tự trong file (hàm `deriveLinkKey`). File có thể ghi `id` cho kênh để chọn khóa riêng. Khi export, chỉ kênh có khóa khác khóa suy ra mới ghi `id`, nên file xuất ra vẫn gọn và import lại ra 0 thay đổi. Khóa của kênh tạo bằng tay trong app cũng được suy ra theo cách này.
- [Session 03] Dùng schema `failsafe` của thư viện `yaml`: mọi giá trị đều là chữ, nên `id: 1.1` hay `flowmap: 1` không bị đổi kiểu. Số trong `layout` được đổi lại sang số khi dựng tài liệu.
- [Session 03] Bước kịch bản dạng mảng có hơn hai phần tử, ví dụ `[F9B, Số dư 20.00, invoice 50.00, chọn chia đôi]` như ví dụ trong TDD 6.2 (AI hay viết thế khi ghi chú có dấu phẩy), được ghép lại: phần tử đầu là khối, phần còn lại nối bằng ", " thành ghi chú, giữ nguyên chữ gốc. Bước chỉ có một phần tử thì ghi chú rỗng.
- [Session 03] TDD 6.4 không có mã cho lỗi sai kiểu giá trị (ví dụ `chips` là chữ thay vì danh sách). Các lỗi này dùng mã `ENUM`. Lỗi `subtype` ghi cho loại không dùng subtype (fnc, req, ext, cond) chỉ là cảnh báo `UNKNOWN_KEY`, không chặn import. `note` nhận mọi chữ không quá 20 ký tự làm màu vì TDD chưa liệt kê màu.
- [Session 03] Giới hạn độ dài: ngoài các giới hạn FR-KH-02 và FR-LK-01, tiêu đề nhóm và kịch bản tối đa 80 ký tự, ghi chú bước 160 ký tự (FR-KB). Mã hiển thị (`code`) không bắt buộc duy nhất dù FR-KH-02 ghi "duy nhất trong dự án", vì file mẫu dùng chung mã "Database", "External", "Start", "End" cho nhiều khối.
- [Session 03] Khối mới không có tọa độ nằm trên lưới 300 x 200, mỗi hàng 6 ô, bắt đầu dưới khối thấp nhất đã có tọa độ thật. Các khối chờ bố cục tiếp nối nhau theo thứ tự tạo. Ghi `has_layout = 0` để Session 09 chạy ELK chỉ cho các khối này.
- [Session 03] `layout` trong file: khối đã có tọa độ thật mà file ghi tọa độ khác thì tính là một lần "sửa" với trường `layout`. Khối chưa có tọa độ thật (`has_layout = 0`) nhận tọa độ từ file và chuyển sang `has_layout = 1`. File không có `layout` thì không bao giờ đụng tới tọa độ (BR-04).
- [Session 03] `geometry.chooseOrientation` dùng đúng luật của bản demo đã duyệt: nối cạnh trái phải khi `|dx| > 0.55 |dy|` hoặc khi hai tâm cách nhau hơn 0.9 chiều rộng khối nguồn. TDD 8.3 chỉ nêu vế đầu. Vế sau giữ lại để dây giữa hai khối ở rất xa nhau theo chiều ngang không bị nối dọc.
- [Session 03] `focus.litNodes` nhận thêm tham số `links` vì `neighbors` cần danh sách kênh. Các hàm trong `focus.ts` và `scenario.ts` làm việc với id kiểu số hoặc chữ nên dùng được cho cả dữ liệu database lẫn dữ liệu từ file YAML (các hàm đổi kiểu nằm ở `flowmap/convert.ts`).
- [Session 03] Xóa kịch bản có nhánh con, lựa chọn "chuyển lên làm con của cha" (FR-KB-07) giữ nguyên đường đi đầy đủ của từng nhánh: nhánh nhận kịch bản cha của kịch bản bị xóa làm cha, và nếu điểm rẽ của nó nằm trong phần bước riêng của kịch bản bị xóa thì các bước đó được chép lên đầu nhánh, điểm rẽ chuyển về nơi kịch bản bị xóa từng rẽ. Kịch bản bị xóa là kịch bản gốc thì các nhánh thành kịch bản gốc, mang theo toàn bộ đoạn đường phía trước.
- [Session 03] `scenario.update` và `scenario.setSteps` từ chối thay đổi làm hỏng BR-06 đến BR-08 của chính kịch bản hoặc của một nhánh bên dưới (mã `SCENARIO_RULE`, nêu tên nhánh). Giao diện Session 08 cần báo lỗi này thay vì để người dùng sửa dở. Xóa khối thì khác: nhánh rẽ ở khối bị xóa tự thành kịch bản gốc (FR-SUA-06), không báo lỗi.
- [Session 03] Xóa khối chỉ xóa dòng trong database. File ảnh của khối (nếu có) nằm lại trong `du-an/<mã>/anh/`. Session 07 xử lý chuyển file ảnh vào thùng rác khi làm phần ảnh.
- [Session 03] `yaml.apply` đọc `project.docs_root` trong file chỉ khi dự án chưa có thư mục tài liệu và thư mục đó tồn tại trên máy này. Tên dự án trong file không đổi tên dự án đang có. `yaml.export` ghi `xuat/<tên-dự-án-không-dấu>.flowmap.yaml`, ghi đè nếu đã có.
- [Session 03] Thêm các kênh IPC `diagram:node:*` (create, update, remove, impact, move, set-group), `diagram:group:*`, `diagram:link:*`, `diagram:scenario:*` (create, update, remove, set-steps), `diagram:yaml:*` (export, preview, apply), và các mã lỗi mới `NODE_NOT_FOUND`, `GROUP_NOT_FOUND`, `LINK_NOT_FOUND`, `SCENARIO_NOT_FOUND`, `KEY_INVALID`, `KEY_DUPLICATE`, `FIELD_REQUIRED`, `FIELD_TOO_LONG`, `ENUM_INVALID`, `LINK_SELF`, `LINK_RULE`, `SCENARIO_RULE`, `YAML_INVALID`. Có thêm `node.impact(ids)` ngoài danh sách TDD 7 để hộp xác nhận xóa nêu tên kịch bản mà chưa xóa gì.
- [Session 03] Dữ liệu mẫu cho dev: `MAPAPP_SEED=1 npm run dev` (trên Windows PowerShell: `$env:MAPAPP_SEED=1; npm run dev`). Sau khi mở một Kho (tạo mới hoặc mở có sẵn), nếu chưa có dự án nào tên "MOE Education Account" thì app tạo dự án đó từ `docs/samples/moe-ea.flowmap.yaml` (không có thì dùng `tests/fixtures/moe-ea.flowmap.yaml`). Chỉ chạy khi không đóng gói. Chạy lại không tạo thêm.

- [Session 04] Khung nhóm không phải node group của React Flow và khối thành viên không có `parentId` (prompt 04 mục 4 nêu có). Lý do: với `parentId`, tọa độ khối thành tương đối theo cha, khung không thể tự co giãn khi kéo khối ra, và lưu tọa độ tuyệt đối trong database phải đổi qua lại. Thay vào đó khung và kênh được vẽ trong `ViewportPortal` ngay phía sau các khối, tính từ vị trí thành viên (hàm thuần `frameBounds`, `buildCanvasModel`), nên khung co giãn theo từng bước kéo. Hành vi giữ nguyên: nhãn ở mép trên, đổi nhóm bằng kéo vào ra, khung sáng lên khi khối lơ lửng, thu gọn thành ô, xóa nhóm hỏi giữ hay xóa khối. Kênh không dùng edge của React Flow vì Session 05 cần popover, một dây và nhiều dây, cổng nối.
- [Session 04] Kéo khối: tọa độ cập nhật vào store ở mỗi bước, `node.move` gọi một lần khi thả, sau đó `node.setGroup` nếu nhóm đổi. Nhóm mới là khung nhỏ nhất chứa tâm khối, dùng các khung lúc bắt đầu kéo, cho phép lệch ra ngoài 40 đơn vị (`DROP_SLOP`) vì khung co lại khi khối rời đi nên chỗ cũ có thể nằm sát ngoài khung mới.
- [Session 04] Chiều rộng khối: 250 cho `fnc`, `req`, `cond`, `note`; 210 cho `start`, `end`, `ext`, `tech` (theo bản demo). Chiều cao do React Flow đo, chưa đo thì tạm 130.
- [Session 04] Đơn vị chọn: bấm khối mở panel chi tiết, double click khối đặt `focusId` và mở panel, double click nền hoặc Esc gọi `clearHighlight()` (xóa focus, xóa kịch bản đang chọn, đóng panel). Bấm kịch bản ở thanh bên chọn một kịch bản, Ctrl cộng bấm chọn thêm. Esc không làm gì khi đang đổi tên khối hoặc đang mở hộp thoại.
- [Session 04] Kiểm tồn tại file FS chạy khi mở dự án, khi cửa sổ lấy lại focus, khi đổi thư mục tài liệu và sau mỗi lần mở file. Sự kiện `diagram:fs-missing` của TDD chưa dùng. `fs.open` từ chối đường dẫn thoát khỏi thư mục tài liệu (`..`, đường dẫn tuyệt đối).
- [Session 04] Cấu hình build renderer đặt `assetsInlineLimit: 0` vì CSP chỉ cho font từ `'self'`, mà Vite nhúng font nhỏ thành `data:` nên bị chặn.
- [Session 04] Thêm các mã lỗi `FS_NO_ROOT`, `FS_NOT_FOUND`, `FS_OPEN_FAILED` và nhóm kênh `diagram:fs:*` (open, exists, pick). `fs.pick` dùng chung hộp thoại với `project.setDocsRoot`.
- [Session 04] Nút "Vừa màn hình" của thanh trên cùng nối vào canvas, cùng phím F. Sidebar nay tự đọc dữ liệu từ store của module, không nhận props.
- [Session 05] Kênh không dùng edge của React Flow. `ChannelLayer` vẽ hai lớp SVG trong `ViewportPortal`: lớp dây và huy hiệu nằm dưới khối (z-index âm), lớp chọn (dây đang chọn, hai tay nắm, đường nối lại) nằm trên khối vì đầu dây chạm mép khối và tay nắm bị khối che nếu để dưới. Handle của React Flow chỉ dùng để bắt đầu kéo nối, khối đích tìm bằng `document.elementsFromPoint` nên thả lên bất kỳ chỗ nào của khối đều nhận.
- [Session 05] Gộp kênh theo cặp khối không phân biệt hướng (`groupByPair`). Dây một dây vẽ theo hướng kênh đầu tiên, có mũi tên hai đầu khi cặp có kênh hai chiều. Huy hiệu hiện trên mọi cặp, kể cả cặp một kênh, để bấm vào sửa được. Hover dây hoặc huy hiệu thì cặp tách thành các dây song song, có độ trễ 90 ms khi rời để không nhấp nháy. Nhãn dây ẩn khi zoom dưới 0.4.
- [Session 05] Popover kênh vẽ theo tọa độ màn hình, đóng khi bấm ra ngoài, Esc, hoặc khi pan và zoom. Esc theo thứ tự: popover, kênh đang chọn, rồi mới đến `clearHighlight`. Bấm nền một lần bỏ chọn kênh, Delete xóa kênh đang chọn.
- [Session 05] `defaultVia` (kênh mặc định khi nối bằng kéo): REQ tới bất kỳ là Hiện thực. Start tới khối là Lịch chạy nếu Start kiểu schedule, ngược lại Điều hướng UI. Function tới Function là Gọi nội bộ. Function tới Tech chọn theo kiểu Tech (database là Database, api là REST, ui là Điều hướng UI, queue là Queue, storage là File, job là Lịch chạy, còn lại Gọi nội bộ). Function tới hệ thống ngoài là REST. Function tới End là Điều hướng UI. Phần Tech do mình mở rộng, prompt chỉ nêu Database.
- [Session 05] Luật nối kiểm ở `linkProblem` trước khi gọi service, lý do hiện bằng toast. Cùng luật áp khi nối lại đầu dây. Khối đang kéo đổi màu cổng đích hợp lệ và không hợp lệ.
- [Session 05] Độ phủ REQ tính theo số function khác nhau nối bằng kênh Hiện thực. Bộ lọc "REQ chưa phủ" ở thanh bên làm sáng các REQ chưa phủ. Khi đang có focus hoặc kịch bản thì lấy giao của hai tập sáng.
- [Session 05] Chế độ Một dây hoặc Nhiều dây lưu trong cài đặt dự án (đã có từ thanh trên cùng), `DiagramPage` nhận `channelMode` và đẩy vào store. Thả dây ra nền trống chỉ hủy, menu tròn thuộc Session 06.
- [Session 05] Kênh đã có sẵn trong bản demo giữa F8.1 và Parent_Profile nên kéo thêm một kênh cùng cặp là hợp lệ, hai kênh cùng cặp có key khác nhau (`_2`).

- [Session 06] Hoàn tác theo TDD 8.8: mỗi thao tác ghi là một `Command {label, undo, redo}`, tối đa 200 bước, xóa lịch sử khi mở dự án khác. Xóa khối, nhóm, kênh và dán được khôi phục bằng kênh IPC mới `diagram:history:restore` với id cũ (khối, kênh, bước, nhánh rẽ nối theo khóa nên không lệch). Sau mỗi lần hoàn tác hoặc làm lại, store nạp lại dự án từ database.
- [Session 06] Bảng `dg_group` thêm cột `frame` (migration 002) để nhóm rỗng giữ được khung 400 x 260 lúc tạo. Nhóm có khối thì khung vẫn tính từ các khối.
- [Session 06] Vòng chọn là một hook (`radial/useRadial.tsx`) nghe sự kiện ở cấp cửa sổ: chuột phải nhấn giữ và vuốt, bấm nhanh dưới 220 ms và dưới 6 px thì giữ vòng mở tới lần bấm kế, phím Q giữ và thả, cuộn chuột đổi loại con của ô đang rê (nhớ riêng từng ô trong phiên), Esc hoặc thả ở giữa là hủy. Tâm vòng kẹp cách mép canvas ít nhất 130 px, nhưng khối mới tạo đúng tại điểm bấm. Vòng bỏ qua thanh công cụ, panel, popover, hộp thoại và minimap.
- [Session 06] Ô "Nối tới" vẽ một đường đứt nét từ mép phải khối nguồn theo con trỏ, bấm khối đích để tạo kênh, bấm nền hoặc Esc để hủy. Ô Rẽ nhánh, Thêm ảnh, Bố cục tự động mờ đi kèm chú thích session sẽ làm.
- [Session 06] Vòng của kênh: một cặp có nhiều kênh thì ba ô Đổi via, Sửa nhãn, Xóa mờ đi (không biết kênh nào), Thêm kênh và Tách dây hoặc Gộp dây vẫn dùng được. Tách hoặc gộp là trạng thái riêng của từng cặp, chồng lên chế độ Một dây hoặc Nhiều dây chung, và không lưu vào database.
- [Session 06] Thả dây ra nền trống mở vòng của canvas ở chế độ giữ mở. Ô nào cho ra khối vi phạm luật nối (khối REQ, Ghi chú, Start) hoặc là nhóm thì mờ đi. Tech theo loại con đang nhớ, nên nếu trước đó đã cuộn sang Service thì kênh mặc định là Gọi nội bộ thay vì REST.
- [Session 06] Chọn khối: bấm chọn một, Ctrl hoặc Shift bấm thêm bớt, Shift kéo ở nền để chọn khung (tắt cơ chế chọn của React Flow). Nhấn xuống một khối chưa chọn thì chọn riêng khối đó trước khi kéo, để kéo cả nhóm hoạt động. Kéo nhiều khối không đổi nhóm. Bấm nền khi đang chọn nhiều thì bỏ chọn. Ctrl+Z, Ctrl+Y hoặc Ctrl+Shift+Z, Ctrl+C, Ctrl+V, Ctrl+D, Delete, / (tìm kiếm) bỏ qua khi đang gõ chữ hoặc đang mở hộp thoại.
- [Session 06] Kéo khối bám lưới 16 px, hoặc bám cạnh và tâm của khối khác khi gần dưới 6 px, kèm đường dóng. Tính trong `onNodesChange` bằng `snapDrag`, nên cả nhóm đang kéo di chuyển cùng một độ lệch.
- [Session 06] Hộp xóa nêu mã các khối, số kênh bị xóa kèm, kịch bản có đường đi qua khối (cắt đường) và kịch bản rẽ nhánh tại khối đó (thành kịch bản gốc). Hai danh sách dùng đúng hai hàm tra cứu mà service dùng khi xóa thật.
- [Session 06] Thanh bên có mục "Thêm khối" (kéo thả HTML5 hoặc bấm để thêm vào giữa màn hình) và ô lọc "Nơi sửa", làm sáng giao với các bộ lọc khác. Ô tìm kiếm đặt trên thanh trên cùng, tìm không phân biệt dấu trên mã, khóa, tiêu đề, nội dung, Nơi sửa và chip.

- [Session 07] Ảnh nhỏ là PNG chứ không phải WebP như prompt ghi: `nativeImage` của Electron chỉ mã hóa được PNG và JPEG. File nằm cạnh ảnh gốc: `anh/<uuid>.png` và `anh/<uuid>.thumb.png`, cạnh dài nhất 240 px. Ảnh WEBP và GIF `nativeImage` không giải mã được nên không có ảnh nhỏ, và giao thức `mapimg://` trả ảnh gốc khi không thấy ảnh nhỏ, nên giao diện luôn xin ảnh nhỏ. Cỡ ảnh đọc thẳng từ phần đầu file (PNG, JPEG, GIF, WEBP, hàm `imageDimensions`), không cần bộ giải mã, đồng thời chặn file đổi đuôi giả ảnh (`IMAGE_UNREADABLE`).
- [Session 07] Giao thức `mapimg://<mã dự án>/anh/<file>`. Chromium coi host toàn số là địa chỉ IPv4 và đổi `1` thành `0.0.0.1`, nên `parseImageUrl` đọc cả hai dạng. Chỉ phục vụ file ảnh nằm trực tiếp trong `<dự án>/anh/`, từ chối mọi đoạn `.`, `..`, rỗng, có `\` hoặc `:`, kể cả dạng `%2e%2e` hay `..%2f`. Test: `mapimg://1/../../data/mapapp.db` bị từ chối. CSP `img-src` đã có `mapimg:` từ Session 01, còn `connect-src` vẫn là `'self'` nên trang không `fetch` được ảnh, chỉ dùng thẻ img.
- [Session 07] Xóa khối không xóa file ảnh ngay. Dòng trong database mất (kéo theo ghim), file nằm lại trong `anh/` để Ctrl+Z khôi phục dòng cũ cùng id. Khi mở dự án và khi đóng dự án (rời trang), `image.sweep` chuyển các file trong `anh/` không còn dòng nào trỏ tới (kể cả ảnh nhỏ) sang `thung-rac/<thư mục dự án>_anh_<giờ>/`. Không có file nào bị xóa hẳn. Cố ý không quét trong `project.load` của main vì store gọi lại hàm này sau mỗi lần xóa hoặc hoàn tác, quét ở đó sẽ làm mất ảnh trước khi kịp hoàn tác. Hạn chế: tắt app đột ngột lúc đang xem dự án thì file mồ côi nằm lại tới lần mở dự án kế tiếp.
- [Session 07] Ba cách thêm ảnh: nút Thêm ảnh trong panel và ô Thêm ảnh của vòng tròn (hộp thoại chọn nhiều file, `image.pick`), kéo file thả lên khối, Ctrl+V khi đúng một khối được chọn. Kéo thả dùng `webUtils.getPathForFile` trong preload để lấy đường dẫn, nếu hệ thống không cho thì gửi nội dung file (`addFromBytes`). Ctrl+V thử ảnh trong clipboard trước, nếu không có thì dán khối như cũ. Để Ctrl+C khối rồi Ctrl+V vẫn dán khối, cờ `blocksCopied` bật khi sao chép khối và tắt khi cửa sổ lấy lại focus (lúc đó clipboard hệ thống có thể đã đổi). Electron 44 bỏ `clipboard.readImage()`, nên đọc bằng `clipboard.read()` lấy mục `image/png`.
- [Session 07] Lô nhiều file được kiểm hết trước khi chép (định dạng theo đuôi, 15 MB, tối đa 8 ảnh mỗi khối kể cả lô đang thêm), một file xấu thì cả lô không thêm gì. Tên ảnh mặc định là tên file bỏ đuôi, ảnh dán là "Ảnh dán", sửa được trong panel. Mỗi ảnh tối đa 40 ghim (do mình thêm), ghi chú ghim tối đa 120 ký tự, tọa độ ghim làm tròn 0.1 phần trăm.
- [Session 07] Mọi thao tác ảnh và ghim đều vào lịch sử hoàn tác (thêm, xóa, đổi tên, đổi thứ tự, đặt, dời, sửa, xóa ghim) qua `history.restore` có id cũ. Đặt một ghim và gõ ghi chú là hai bước hoàn tác.
- [Session 07] Lightbox: ảnh vẽ ở kích thước gốc và chỉ dịch chuyển bằng `translate scale` (hàm thuần `fitView`, `pinView`, `pinZoom` trong `shared/diagram/pinview.ts`). Zoom tới ghim `z = min(1.15, max(0.7, min(W/700, H/520)))`, đúng bản demo. Chữ callout, đệm và mũi tên chia cho zoom hiện tại để giữ 12 px trên màn hình, ghim cũng nhân `1 / zoom`. Ảnh bay từ ảnh nhỏ bằng Web Animations API (FLIP) 380 ms, đóng lightbox thì tắt ngay. Có thêm cuộn chuột để zoom và kéo nền để dời ảnh (prompt không đòi). Đặt ghim xong ghim đó thành ghim đang chọn nhưng khung nhìn giữ nguyên, để đặt liên tiếp nhiều ghim. Chọn ô ghi chú cũng chỉ chọn ghim, không zoom. Bấm số ghim, Ghim trước, Ghim sau hay mũi tên mới zoom tới.
- [Session 07] Peek khi rê chuột: chờ 250 ms, ảnh hiện ở bên phải khối, đổi sang bên trái nếu hết chỗ, không bắt chuột. Thành phần `PlayPeek` (thẻ 280 x 170 cho Session 08) nhận `image`, `pins`, `stepNote` hoặc `pinIndex`, chọn ghim bằng `pickPin`, cắt quanh ghim, ghim nhấp nháy, chú thích bên dưới. Logic nằm trong `playPeekModel` (có test). Session 08 chỉ việc đặt nó và truyền `onOpen` để mở lightbox ở đúng ghim bằng `openViewer({ imageId, pin, from })`.
- [Session 07] `prefers-reduced-motion`: không ảnh bay, không gợn sóng của ghim, zoom tới ghim tức thì, không hiệu ứng vào của peek và lightbox. Kiểm bằng `emulateMedia({ reducedMotion: 'reduce' })`. Chromium báo thời gian chuyển là 1e-5 giây thay vì 0, coi như tức thì.
- [Session 07] Thêm kênh IPC `diagram:image:*` (pick, add-from-paths, add-from-bytes, add-from-clipboard, update, remove, reorder, sweep) và `diagram:pin:*` (create, update, remove, reorder), mã lỗi `IMAGE_NOT_FOUND`, `IMAGE_FORMAT`, `IMAGE_TOO_LARGE`, `IMAGE_LIMIT`, `IMAGE_UNREADABLE`, `CLIPBOARD_EMPTY`, `PIN_NOT_FOUND`, và hàm `pathOfFile` trong `window.api.diagram`. Có sẵn thêm `image.update` (đổi tên) ngoài danh sách prompt.
- [Session 08] Mọi thao tác kịch bản (tạo, sửa, xóa) vào lịch sử hoàn tác qua `history.restore` với id cũ. Xóa có nhánh con hiện hộp hỏi: "Chuyển nhánh con lên cha" (nhánh con thành con của cha, giữ nguyên bước) hoặc "Xóa cả nhánh con". Ctrl+Z khôi phục cả hai trường hợp cùng bước và điểm rẽ. Không có nhánh con thì hộp chỉ có Hủy và Xóa.
- [Session 08] Ghi kịch bản: bấm khối trên canvas thêm bước, ô ghi chú mỗi bước tối đa 160 ký tự, kéo tay cầm để đổi thứ tự, Esc hỏi xác nhận nếu đã có nội dung. Khi ghi, canvas bỏ chọn và đóng panel chi tiết. Nhánh: bước đầu luôn là điểm rẽ và phải nằm trên đường đi đầy đủ của kịch bản cha (BR-06), không xóa hay dời được bước đó (BR-08), không có vòng cha con (BR-07). Lỗi hiện ngay trong panel (`data-record-problem`).
- [Session 08] "Rẽ nhánh tại bước này" lưu kịch bản đang ghi rồi mở bản nháp nhánh có bước đầu là khối ở bước đã chọn. Ô "Rẽ nhánh kịch bản" của vòng tròn chỉ dùng khi đúng một kịch bản đang chọn và khối nằm trên đường của nó, nếu không thì hiện thông báo.
- [Session 08] Play dùng `createPlayer` thuần trong `shared/diagram/player.ts` với đồng hồ tiêm vào (test dùng đồng hồ giả). Mỗi bước giữ 1500 ms rồi chấm chạy 750 ms (ease in out bậc hai), chia cho tốc độ 0.5x, 1x, 2x. Camera lướt 500 ms chia cho tốc độ. Tạm dừng chốt tỉ lệ đã đi, đổi tốc độ giữ nguyên vị trí. Khi Play, chỉ kịch bản đang chạy sáng, bấm khối bị bỏ qua. Dừng bằng nút Dừng, Esc hoặc nhấp đôi vào khoảng trống, rồi mọi khối sáng lại.
- [Session 08] Thẻ ảnh Play (`PlayPeekHost`, góc trên phải) chọn ảnh và ghim bằng `pickPeek` (khớp ghi chú bước với ghi chú ghim). Bấm thẻ thì Play tạm dừng và mở lightbox ở ghim đó, đóng lightbox thì Play chạy tiếp.
- [Session 08] Giảm chuyển động: không có chấm, camera không lướt (chỉ nhảy khi khối nằm ngoài màn hình), nét chấm của đường kịch bản không chạy, chỉ khối sáng và thẻ chú thích đổi.
- [Session 08] Đường kịch bản vẽ bằng svg trong ViewportPortal phía sau khối, nét `2 9`, mũi tên màu theo loại. Nhiều kịch bản cùng chọn lệch nhau 7 px (`lineOffset`). Nhãn "rẽ nhánh" gắn vào khối điểm rẽ của các kịch bản đang chọn. Các nút Sửa và Xóa của hàng kịch bản chỉ hiện khi rê chuột vào hàng.
- [Session 08] Sửa lỗi tìm được khi chạy thật: bấm Esc để hủy ghi mở hộp xác nhận, nhưng cùng cú Esc đó lại bị hộp `dialog` vừa mở coi là yêu cầu đóng nên hộp biến mất ngay. Đã `preventDefault` ở cả hai nơi xử lý Esc của lúc ghi. Các hộp xác nhận khác mở bằng click nên không bị.

- [Session 09] Import nhận cả YAML lẫn Mermaid, phân biệt bằng `looksLikeMermaid`. Mermaid bị bỏ các dòng không hỗ trợ (`classDef`, `style`, `click`, hình dạng lạ như `((` thì thành Function) và mỗi dòng bỏ là một cảnh báo hiện trong hộp kết quả. Nguyên tắc ánh xạ: `{}` là Điều kiện, `([])` là Start (không có kênh vào) hoặc End subtype `ok` (không có kênh ra), còn lại Function, nét đứt là kênh `db`, nét khác là `call`. Import một file Mermaid vào dự án đã có sẽ "sửa" các khối cùng mã (mất nội dung dài), nên hộp kết quả luôn cho xem bảng trước khi áp dụng.
- [Session 09] Import không hoàn tác được bằng Ctrl+Z: sau khi áp dụng, lịch sử hoàn tác bị xóa, và hộp kết quả nói rõ điều này. Lý do: một lần import có thể thêm, sửa, xóa hàng trăm dòng nhiều bảng, mà `history.restore` chỉ khôi phục từng gói nhỏ. Người dùng muốn lùi thì có file YAML đã xuất ra `xuat/`.
- [Session 09] Bố cục tự động chạy ELK trong Web Worker. Worker là chính `elkjs/lib/elk-worker.min.js` (khi nạp trong worker, nó tự cài bộ nhận tin nhắn) và luồng chính dùng `elkjs/lib/elk-api.js` với `workerFactory`. Dùng `elk.bundled.js` trong worker bị lỗi `_Worker is not a constructor`, đã thử thật và bỏ. CSP không cần `worker-src` vì worker nạp từ `'self'`. Phần logic dựng đồ thị và đọc kết quả là hàm thuần trong `shared/diagram/autolayout.ts` nhận ELK qua giao diện `ElkLike`, nên test và service xuất JSON Canvas dùng ELK bản Node.
- [Session 09] Khối mới chưa có tọa độ (`has_layout = 0`) được sắp thành một cụm đặt dưới mọi khối đã có chỗ, mép trái trùng mép trái các khối cố định, rồi camera vừa màn hình. Lệch so với prompt ("quanh khối cố định"): ELK không có lối đặt cụm mới sát bên các khối bị ghim mà không đụng chúng, nên chọn cách chắc chắn không chồng lấn. Hệ quả: khối mới của một nhóm đã có sẽ kéo khung nhóm đó giãn tới chỗ khối mới. Dự án mới nhập từ file không có `layout` thì mọi khối là "mới" nên được sắp toàn bộ.
- [Session 09] Phím L và nút trên thanh công cụ canvas: chọn từ hai khối trở lên thì chỉ sắp các khối đó (tọa độ góc trên trái của hộp bao hiện tại giữ nguyên), còn lại sắp cả bản đồ. Ô "Bố cục tự động" của vòng chọn nhiều khối làm như nhau. Mỗi lần là một bước hoàn tác tên "Bố cục tự động". Kích thước khối lấy từ phần đo của canvas, chưa đo thì dùng ước tính (đợi tối đa 1,5 s).
- [Session 09] Panel YAML (SCR-05) là `textarea` trong suốt đặt trên một lớp `<pre>` tô màu từng dòng (`shared/diagram/yamlHighlight.ts`, không dùng thư viện soạn thảo), có cột số dòng, đường kéo chia đôi (cũng dùng được bằng mũi tên trái phải) và nền đánh dấu dòng lỗi. Nội dung YAML sinh ngay trong renderer bằng `serializeFlowmap(projectToDoc(data))` chứ không gọi IPC, không ghi file. Canvas đổi thì sau 300 ms YAML sinh lại, nhưng nếu người dùng đang có chỗ sửa chưa áp dụng thì giữ nguyên chữ của họ (trạng thái "Có chỗ sửa chưa áp dụng", nút Hoàn lại lấy lại bản của bản đồ).
- [Session 09] Lỗi import từ file: panel YAML mở với nội dung của file và bấm lỗi nhảy tới dòng. Ở màn chào chưa có panel nên danh sách lỗi chỉ để đọc và chép cho AI. Lỗi lấy từ panel thì dòng tính theo chữ trong panel, đúng như người dùng thấy. "Chép lỗi cho AI" chép câu "Sửa các lỗi sau trong file Flowmap YAML, chỉ trả về file đã sửa, không giải thích." kèm từng thông điệp "dòng L, cột C: ...".
- [Session 09] Xuất: YAML, Mermaid (`.mmd`), JSON Canvas 1.0 (`.canvas`, khung nhóm là node `group`, khối là node `text` viết Markdown, kênh là edge có nhãn `via: nhãn`) và PNG vào `xuat/` của Kho. Sau khi xong có toast hiện đường dẫn và nút "Mở thư mục". PNG vẽ bằng canvas 2D tự viết (`shared/diagram/pngScene.ts` dựng danh sách lệnh vẽ, `export/renderPng.ts` vẽ), không chụp DOM, nên toàn bộ bản đồ vào ảnh bất kể đang zoom thế nào. Tỷ lệ tối đa 2, cạnh dài tối đa 8000 px, tối đa 36 triệu điểm ảnh. Main chỉ kiểm chữ ký PNG và giới hạn 64 MB rồi ghi file.
- [Session 09] Thanh trên: thêm menu Import (Import file, Chép mẫu prompt), menu Xuất và nút bật tắt YAML. Thanh trên không còn xuống dòng (trước đó với ba nút mới nó thành hai hàng và làm lệch vị trí trong canvas): ô tìm kiếm và tên dự án co lại, mã dự án ẩn khi cửa sổ hẹp hơn 1400 px. Cột lưới của `App` đổi thành `minmax(0, 1fr)` để hàng không rộng hơn cửa sổ.
- [Session 09] Thêm kênh IPC `diagram:yaml:pick-file`, `preview-new`, `apply-new` và `diagram:export:*` (mermaid, json-canvas, png, open-folder), mã lỗi `IMPORT_TOO_LARGE` (5 MB), `IMPORT_UNREADABLE`, `EXPORT_IMAGE_INVALID`, `EXPORT_OPEN_FAILED`. Toast có thêm loại `info` (kết quả, viền xanh) và nút hành động tùy chọn.

- [Session 10] Hiệu năng đo trong app Electron thật trên Linux không GPU (Xvfb, vẽ bằng phần mềm), nên số khung hình là cận dưới. Để đạt NFR-04: `elk.layered.thoroughness` từ 7 xuống 2 (bố cục vẫn không chồng lấn, kiểm bằng test 200 khối), và `warmElk()` chạy một đồ thị nhỏ khi hộp import bắt đầu và 1,5 s sau khi mở bản đồ, để lần chạy ELK thật không trả giá nạp worker. Nếu máy văn phòng chậm hơn rõ rệt, phương án B là hạ `thoroughness` xuống 1.
- [Session 10] Màu chữ trạng thái (ok, cảnh báo, lỗi) dùng ba token mới `--dg-tx-ok`, `--dg-tx-warn`, `--dg-tx-fail`, tách khỏi màu nền chấm trạng thái, vì nền sáng cần màu chữ tối hơn để đạt 4.5:1. `tests/contrast.test.ts` có thêm các cặp chữ của panel YAML và hộp import cho cả hai nền.
- [Session 10] Bộ cài: `electron-builder.yml` lọc bản dựng sẵn của `better-sqlite3` theo nền tảng (Windows giữ win32-x64, Linux giữ linux-x64). Thư mục native bung ra từ 27 MB còn 13 MB, AppImage từ 138 MB còn khoảng 131 MB. Việc tồn "lọc bớt prebuild" của Session 02 xong.
- [Session 10] `scripts/stage-kho.mjs` chép thêm `HUONG-DAN-SU-DUNG.md` vào gốc `dist/kho`, cạnh file mở app.
- [Session 10] Khi thử gộp studyapp tìm ra ba chỗ module phụ thuộc vào shell, đều là lỗi thiết kế nên sửa ngay trong MapApp: (1) preload tự viết tay cả đối tượng `DiagramApi`, nay là `createDiagramApi(invoke, pathOfFile)` trong `src/shared/diagram/ipcClient.ts` (không import electron), preload của host chỉ cần một lời gọi; (2) các biến `--dg-*` và hai nền sáng tối nằm trong `src/renderer/styles/tokens.css` của shell, nay ở `features/diagram/styles/dg-tokens.css` do `DiagramPage` tự nạp, phần ánh xạ tên chung (`--bg`, `--surface`...) sang `--dg-*` ở lại trong `tokens.css` của shell vì chỉ MapApp cần; (3) đăng ký giao thức `mapimg://` nằm tay trong `main/shell/index.ts`, nay là `DIAGRAM_SCHEME` và `handleDiagramProtocol(protocol, net)` trong `src/main/diagram/electronProtocol.ts` (nhận đối tượng Electron qua tham số).

## Nghiệm thu Session 10

### Hiệu năng (NFR-02, 03, 04)

Đo bằng `scripts/gen-big-project.mjs` (200 khối, 400 kênh, 8 nhóm, 30 kịch bản, 40 ảnh giả) trong app Electron thật (`e2e10`) và trong test tự động `tests/session10-perf.test.ts`. Máy đo là container Linux không GPU, vẽ bằng phần mềm, nên số khung hình là cận dưới của máy văn phòng.

| Mục | Ngưỡng | Đo được | Kết quả |
|---|---|---|---|
| NFR-03 `project.load` qua IPC (200 khối, 400 kênh, 40 ảnh) | dưới 2 s mở dự án | 5 đến 7 ms; từ bấm Mở tới khi thấy khối đầu tiên 370 đến 400 ms | Đạt |
| NFR-03 trong test Node | dưới 2 s | 2 đến 3 ms | Đạt |
| NFR-04 chọn file tới hộp kết quả | | 217 ms | |
| NFR-04 bấm Áp dụng tới khi mọi khối có tọa độ | | 2,0 đến 2,1 s | |
| NFR-04 tổng import 200 khối kể cả kiểm tra và bố cục | dưới 3 s | khoảng 2,3 s (ELK trong worker khoảng 1,4 đến 1,5 s) | Đạt |
| NFR-04 trong test Node (kiểm tra 47 ms, ghi 172 ms, ELK nguội 1,3 s) | dưới 3 s | khoảng 1,5 s, không khối nào chồng nhau | Đạt |
| Xem trước import lần hai (không đổi gì) | | 44 ms | |
| NFR-02 zoom | từ 50 khung hình/giây | khoảng 59 | Đạt (trên phần mềm vẽ) |
| NFR-02 pan | từ 50 khung hình/giây | 56 đến 57; khung hình p95 từ 16,8 đến 33 ms | Đạt (trên phần mềm vẽ) |

Chưa đo bằng Performance panel của DevTools trên máy Windows văn phòng thật. Nếu NFR-02 hụt ở đó: kiểm `onlyRenderVisibleElements`, hạ `thoroughness` ELK (xem Quyết định), đo lại.

### Các NFR khác

| Mã | Kết quả |
|---|---|
| NFR-01 | Linux: chạy `npm run dev`, AppImage, và thư mục unpacked trong bố cục USB (e2e11). Windows: build chưa chạy trên máy thật, chưa kiểm |
| NFR-05 | Đạt theo thiết kế: font nhúng bằng `@fontsource`, CSP `default-src 'self'` chặn mọi tài nguyên ngoài, không có mã gọi mạng. Chưa chạy thử khi rút mạng |
| NFR-06 | Đạt: với `prefers-reduced-motion: reduce`, không phần tử nào còn transition hoặc animation (e2e10, quét toàn bộ DOM) |
| NFR-07 | Đạt: mọi nút và ô nhập có tên truy cập; Tab đi từ thanh trên qua thanh bên tới canvas; toàn bộ cặp màu chữ đạt từ 4.5:1 ở nền tối và nền sáng (70 ca trong `tests/contrast.test.ts`) |
| NFR-08 | Đạt: cửa sổ có `minWidth` 1280, chuẩn 1440 × 900; thanh trên không xuống dòng ở 1280 (sửa ở Session 09 và e2e08 kiểm) |
| NFR-09 | Đạt: `kill -9` khi đang kéo khối, và khi đang import ở 20, 80 và 200 ms, rồi mở lại: `PRAGMA integrity_check` trả `ok`, dự án không bao giờ nằm nửa chừng |
| NFR-10 | Đạt trên mô phỏng (xem bên dưới). Chưa thử trên nhánh studyapp thật |

### Đóng gói

- `npm run dist:linux` ra AppImage khoảng 131 MB. Thư mục unpacked đặt trong bố cục kho (`KHO/app/linux`) chạy được: import mẫu, ELK trong `app.asar`, xuất PNG, Play P-01. Không có gì ghi vào `$HOME`. Bản AppImage chạy bằng `mo-mapapp-linux.sh --appimage-extract-and-run --no-sandbox` sống đủ 20 s trong container.
- `npm run dist:win` chưa chạy trên Windows. Cấu hình đã lọc prebuild cho win32-x64.
- Lệnh gộp bản build vào bố cục USB là `node scripts/stage-kho.mjs win|linux` (đã gắn vào `dist:win` và `dist:linux`), nó chép cả `HUONG-DAN-SU-DUNG.md`.

### Thử gộp studyapp (NFR-10)

studyapp không có trên máy build (đã ghi từ Session 01), nên không có nhánh thử thật. Thay bằng một mô phỏng: chép **chỉ** ba thư mục (`src/shared/diagram`, `src/main/diagram`, `src/renderer/features/diagram`) vào một dự án trống cùng phiên bản thư viện, dựng sáu bước của TDD 11 bằng một host tối thiểu (main gọi `runDiagramMigrations` rồi `registerDiagramIpc`, preload gọi `createDiagramApi`, trang Bản đồ render `<DiagramPage />`, kiểu `Window.api`).

| Bước TDD 11 | Kết quả mô phỏng |
|---|---|
| 1 Chép ba thư mục | `tsc` node và `tsc` web đều sạch, tức là không có import nào ra ngoài ba thư mục, `src/shared/api.ts` hay `shell/` |
| 2 Thư viện | Cần `@xyflow/react`, `elkjs`, `yaml` (và `better-sqlite3` đã có ở host); `vite build` của host thành công, ra một file js và một file css, thêm `elk.worker` |
| 3 `runDiagramMigrations(db)` | Chạy cạnh một bảng host có sẵn: chỉ thêm bảng `dg_*`, bảng host và dữ liệu host nguyên vẹn |
| 4 `registerDiagramIpc` và preload | 50 kênh, tất cả bắt đầu bằng `diagram:`; preload của host chỉ cần `createDiagramApi(ipcRenderer.invoke, webUtils.getPathForFile)`; thêm `DIAGRAM_SCHEME` vào danh sách scheme và gọi `handleDiagramProtocol` |
| 5 Trang Bản đồ | `<DiagramPage projectId channelMode playImages />` biên dịch và đóng gói được; host phải bọc trong phần tử có lớp `dg-root` và `data-theme`, nạp font Be Vietnam Pro và JetBrains Mono, và khai báo kiểu `Window.api.diagram` |
| 6 `study_item_id` | Cột đã có trong schema, chưa có giao diện (đúng phạm vi) |
| Chạy mẫu | Test chạy thật qua IPC giả: `yaml.applyNew` với `moe-ea.flowmap.yaml` ra đúng 31 khối, 37 kênh, 9 kịch bản; gỡ đăng ký không còn handler nào |

Ba chỗ phải sửa trong module đã sửa ngược vào MapApp (xem Quyết định Session 10). Còn lại cho lần gộp thật: đối chiếu giá trị token chung và `computeAppDir` với studyapp (từ Session 01), CSP của studyapp phải cho `img-src mapimg:` và `worker-src 'self'`, chạy test của cả hai bên. Chưa chạy được test của studyapp.

### Bảng tiêu chí chấp nhận (FSD mục 5)

Cột Bằng chứng: **App** là chạy trong app Electron thật trên Linux (e2e05 đến e2e11 và checklist từng session), **Test** là test tự động, **Chưa kiểm Windows** là phần phụ thuộc hệ điều hành thật chưa thử.

| AC | Nội dung ngắn | Kết quả | Bằng chứng |
|---|---|---|---|
| FR-DA-01 AC1 | Mở lần hai vào thẳng dự án lần trước | Đạt | App (Session 02), hộp thoại chọn thư mục thật chưa kiểm tay |
| FR-DA-02 AC1 | Tạo dự án, canvas trống, có nút Import YAML | Đạt | App |
| FR-DA-02 AC2 | Xóa dự án, ảnh vào `thung-rac/` | Đạt | App, Test |
| FR-DA-03 AC1 | Đổi thư mục tài liệu, mọi nút mở FS vẫn đúng | Đạt | Test (đường dẫn lưu tương đối); chép sang ổ khác trên máy thật chưa thử |
| FR-DA-04 AC1 | Kéo khối, tắt app, mở lại đúng chỗ | Đạt | App; kill -9 giữa kéo (NFR-09) |
| FR-DA-05 | Sao lưu mỗi lần mở kho, giữ 10 bản | Đạt | Test |
| FR-CV-01, 02, 04 | Canvas, vừa màn hình, nhớ khung nhìn | Đạt | App |
| FR-CV-03 | Minimap | Đạt | App |
| FR-CV-05 AC1 | Double click F9.4 sáng đúng 7 khối | Đạt | App (Session 04) |
| FR-CV-05 AC2, AC3 | Vẫn kéo, zoom được; khối không kênh chỉ sáng chính nó | Đạt | App, Test |
| FR-CV-06 AC1, AC2 | Double click nền sáng lại, dừng Play | Đạt | App (Session 04, 08) |
| FR-CV-07 | Giao của tập trung và kịch bản, rỗng thì chỉ tập trung | Đạt | Test, App (Session 05) |
| FR-KH-01, 02, 03, 04, 05, 07 | Loại, trường, trạng thái, thu gọn, sửa, panel chi tiết | Đạt | App |
| FR-KH-06 AC1 | Bấm nút FS mở file trong Word | Đạt một phần | `shell.openPath` được gọi đúng đường dẫn (App, bản giả); mở Word thật chưa kiểm, Chưa kiểm Windows |
| FR-KH-06 AC2 | Đổi tên file thì nút FS đỏ | Đạt | App (Session 04) |
| FR-KH-08 AC1 | REQ chưa nối đỏ, nối Hiện thực thành "1 function" | Đạt | App (Session 05) |
| FR-ANH-01 AC1 | Ctrl+V ảnh vào dải ảnh | Đạt | App (Session 07); ảnh chụp bằng Win+Shift+S chưa kiểm, Chưa kiểm Windows |
| FR-ANH-02, 03, 04 | Xem nhanh, trình xem, ghim | Đạt | App (Session 07) |
| FR-ANH-05 AC1 | Ghim 3 nằm giữa khung, bong bóng đúng chú thích | Đạt | App (Session 07) |
| FR-ANH-06 | Thẻ ảnh khi Play, bấm mở đúng ghim | Đạt | App (Session 08) |
| FR-NH-01 đến 04 | Khung nhóm, vào ra, thu gọn, xóa nhóm | Đạt | App (Session 04) |
| FR-LK-01 đến 03, 05, 06 | Kênh, tạo, kiểm tra hợp lệ, màu via, nối lại | Đạt | App (Session 05, 06) |
| FR-LK-04 AC1 | F9.5/F9.6 và Payment Provider: huy hiệu "3", popover đủ 3 kênh | Đạt | App (Session 05) |
| FR-KB-01, 02, 04, 05 | Loại, cây, làm sáng, so sánh | Đạt | App (Session 08) |
| FR-KB-03 AC1 | Ghi P-01 13 bước, rẽ nhánh A-01 chỉ lưu từ điểm rẽ | Đạt | App, Test |
| FR-KB-06 AC1 | Play N-05 ra 14 bước tới End "Invoice về Issued" | Đạt | App (Session 08) |
| FR-KB-07 | Sửa, xóa kịch bản, hỏi về nhánh con | Đạt | App, Test |
| FR-VC-01 đến 05 | Vòng chọn, hai cách dùng, loại con, phím Q, ngữ cảnh | Đạt | App (Session 06); chuột phải vẩy nhanh và cuộn chuột trên Windows, trackpad chưa kiểm |
| FR-VC AC1, AC2 | Vẩy lên ra Function; cuộn hai nấc ở Tech ra Queue | Đạt | App (Session 06) |
| FR-SUA-01 đến 05 | Bảng khối, chọn, di chuyển, sao chép, hoàn tác 100 bước | Đạt | App, Test |
| FR-SUA-06 AC1 | Xóa F9.5/F9.6 nêu A-01, N-05, E-02 và "N-05 sẽ thành kịch bản gốc" | Đạt | App (Session 06) |
| FR-TIM-01 AC1 | "funding" ra F9.4 và Sổ cái EA | Đạt | App (Session 06) |
| FR-TIM-02 | Lọc theo Nơi sửa | Đạt | App (Session 06) |
| FR-BC-01 AC1 | Import 200 khối không tọa độ, dưới 3 s, không chồng | Đạt | App và Test (khoảng 2,3 s) |
| FR-YM-01 | Export YAML kèm layout | Đạt | Test, App |
| FR-YM-02 AC1 | Import hai lần, lần hai 0 thêm, 0 sửa, 0 xóa | Đạt | App (Session 09) |
| FR-YM-02 AC2 | Sửa nội dung rồi import lại, vị trí kéo tay không đổi | Đạt | App, Test |
| FR-YM-02 bước 3 | Khối mới chưa tọa độ được bố cục "quanh các khối nối với nó" | Lệch, có lý do | Khối mới đặt thành một cụm dưới khối cố định để chắc chắn không chồng (xem Quyết định Session 09) |
| FR-YM-03, 04 | Chép lỗi cho AI, chép mẫu prompt | Đạt | App, Test; vòng thử với chat AI thật chưa làm |
| FR-YM-05 | Panel YAML | Đạt | App (Session 09) |
| FR-YM-06 | Mermaid vào ra | Đạt | Test; mở bằng trình xem Mermaid thật chưa kiểm |
| FR-YM-07, 08 | JSON Canvas, PNG | Đạt | Test, App; mở trong Obsidian chưa kiểm |

Không còn mục **Chưa đạt**. Còn ba nhóm cần xác nhận ngoài máy build: mọi thứ phụ thuộc Windows thật, vòng thử với chat AI thật, và gộp vào studyapp thật. Một mục lệch có lý do (FR-YM-02 bước 3) cần chủ dự án đồng ý.

### Tiêu chí hoàn thành của prompt 10

| Tiêu chí | Trạng thái |
|---|---|
| Bảng hiệu năng, NFR-02, 03, 04 đạt | Xong (đo trên Linux không GPU) |
| Bản Windows chạy từ USB exFAT trên máy Windows thật, Play P-01 | **Chưa làm được**, cần máy Windows |
| Bản Linux chạy từ USB trên Ubuntu 22.04+ bằng script mở app | Chạy được trong bố cục USB trên Linux của máy build; chưa thử trên USB và Ubuntu thật |
| Không có dữ liệu mới trong AppData hoặc `~/.config` | Đạt trên Linux (e2e11); Windows chưa kiểm |
| Nhánh thử studyapp chạy trang Bản đồ, test studyapp xanh | **Chưa làm được**, không có studyapp; đã thay bằng mô phỏng ở trên |
| Bảng AC không còn Chưa đạt | Xong, kèm một mục lệch có lý do |
| `HUONG-DAN-SU-DUNG.md` đủ các mục | Xong (ở gốc dự án và trong `dist/kho`) |
| typecheck, lint, test xanh, PROGRESS cập nhật | Xong |

## Lệch so với tài liệu

- `--dg-muted` ở nền tối là `#96938b`, TDD 9.2 ghi `#8c8981`. Giá trị gốc chỉ đạt 4.16:1 trên `--dg-panel-2` (nền khi rê chuột vào hàng thanh bên), trái NFR-07 (tối thiểu 4.5:1). Test `tests/contrast.test.ts` khóa yêu cầu này cho hai nền.
- Mỗi mục của thanh bên có mũi tên thu gọn, ảnh 01 không có. Prompt 01 yêu cầu "thu gọn được" nên giữ.
- Thanh trên cao 52 px theo ảnh 01. Chữ và khoảng cách chưa đo từng điểm so với ảnh, sai khác dự kiến dưới 4 px.
- [Session 06] Tài liệu FSD AC2 và prompt 06 khác nhau về loại con mặc định của ô Tech (FSD mô tả Database trước, prompt đặt API đầu danh sách). Đã theo prompt và `TECH_SUBTYPES`: API trước, cuộn hai nấc ra Service.

## Lỗi đã biết

- Chữ trắng đặt trên màu loại khối theo TDD 9.2 chỉ đạt 2.1 đến 3.9:1, thấp hơn 4.5:1 của NFR-07. Đã chốt ở Session 04: không đặt chữ lên các màu này. Màu loại khối chỉ làm thanh bên trái của khối và chấm nhỏ, còn thẻ loại kênh trong panel chi tiết dùng nền `--dg-panel-2`, chữ `--dg-ink-2` và một chấm màu. Giữ nguyên quy ước này cho huy hiệu REQ ở Session 05.
- Ubuntu 24.04 trở lên hạn chế user namespace, AppImage có thể đòi `--no-sandbox` mới mở được. Chưa kiểm vì máy build chạy bằng quyền root. Nếu gặp, chạy `./mo-mapapp-linux.sh --no-sandbox` và báo lại để chốt cách xử lý.
- Trên Linux, hệ đồ họa (Mesa) và GTK (dconf) mặc định ghi cache vào `~/.cache`. `mo-mapapp-linux.sh` đã chuyển hai thứ này vào Kho. Khi chạy `npm run dev` thì không có biến này, nên `~/.cache` vẫn có vài file nhỏ. Không có gì được ghi vào `~/.config`, AppData hoặc registry.
- Windows (thử 2026-10-25, Node 24.20): `npm install` thường tự chạy `node-gyp rebuild` cho `better-sqlite3` và đòi Visual Studio C++, dù gói đã có sẵn bản dựng `win32-x64`. Dùng `npm install --ignore-scripts` rồi `node node_modules/electron/install.js` (các file `Chay-thu-Windows.bat` và `Dong-goi-Windows.bat` ở gốc `D:\mymap` làm sẵn việc này). `npm run typecheck` sạch trên Windows; `npm test` 478/480 lần đầu, hai lỗi là lỗi của test chứ không phải của app: (1) mẫu YAML trỏ `docs_root` tới `D:\AIQA\...` mà thư mục này có thật trên máy Windows của chủ dự án, nên test "chỉ dùng docs_root khi thư mục tồn tại" giờ thay đường dẫn đó trước khi chạy; (2) Windows không cho đổi tên thư mục đang giữ file SQLite mở (EPERM), nên test mô phỏng rút USB bị bỏ qua trên win32 và phải thử tay (rút USB khi app đang chạy).
- Với npm 11, bước tải binary Electron khi `npm install` không chạy trên máy build. Nếu `npm run dev` báo Electron chưa cài đúng, chạy `node node_modules/electron/install.js` một lần.

## Việc tồn

- Session 02: hộp thoại chọn thư mục thật của hệ điều hành chưa được kiểm tay (khi test tự động, mình thay `dialog.showOpenDialog` bằng giá trị cố định). Kiểm tay "Tạo kho mới" và "Mở kho có sẵn" trên Windows.
- Session 04: nút "Chọn thư mục tài liệu" ở thanh bên và `saveViewport` khi dừng pan hoặc đóng dự án đã có. Hộp thoại chọn thư mục thật và việc `shell.openPath` mở Word thật chưa kiểm tay, khi test tự động hai hàm này được thay bằng bản giả.
- Session 04: panel chi tiết đóng lại thì nội dung biến mất ngay, chỉ khung trượt ra. Chưa có hiệu ứng mờ dần nội dung.
- Session 07: chưa kiểm trên Windows: kéo file ảnh từ Explorer thả lên khối (đường dẫn lấy bằng `webUtils`, trên Linux chỉ thử nhánh gửi nội dung file), Ctrl+V ảnh chụp bằng Win+Shift+S, hộp thoại chọn ảnh thật của hệ điều hành, và đường dẫn có dấu tiếng Việt. Ảnh WEBP và GIF chưa có ảnh nhỏ nên khối hiện ảnh gốc thu nhỏ bằng CSS. Chưa có cách dán file ảnh đã sao chép trong Explorer (clipboard chứa đường dẫn, không phải ảnh).
- Session 08: chưa kiểm trên Windows việc kéo tay cầm đổi thứ tự bước trong panel ghi (Linux thử bằng sự kiện kéo giả), độ mượt của chấm chạy và camera lướt (máy build không có GPU), và phím Esc trong hộp xác nhận hủy ghi trên Windows.
- Session 09: chưa thử vòng đủ "chép mẫu prompt, dán cùng file FS vào chat AI, nhận YAML, import trong tối đa hai vòng chép lỗi" (cần một cuộc chat thật). Mẫu prompt và câu chép lỗi đã có và đã kiểm bằng test. Cần chủ dự án thử tay một lần với file FS thật rồi ghi kết quả vào đây.
- Session 09: chưa kiểm trên Windows: hộp thoại chọn file import thật (e2e thay `dialog.showOpenDialog`), `shell.openPath` mở thư mục `xuat/` thật (e2e thay bằng hàm giả), xem file `.canvas` trong Obsidian và file `.mmd` trong một trình xem Mermaid (đã kiểm cấu trúc bằng test và đọc file, chưa mở bằng các chương trình đó), tải clipboard bằng `navigator.clipboard` trong cửa sổ Electron thật trên Windows (có đường lui `execCommand`).
- Session 09: khối mới của một nhóm đã có được đặt dưới mọi khối cố định (xem Quyết định), nên có thể kéo khung nhóm giãn. Nếu thấy vướng, cải tiến sau là sắp lại cả nhóm đó.
- Session 06: kiểm bằng tay trên Windows việc bấm phải và vuốt, phím Q, cuộn chuột trên vòng chọn (trên Linux chạy bằng Playwright giả lập chuột). Trackpad không có cuộn chuột thì chưa có cách đổi loại con ngoài phím Q cộng cuộn hai ngón.
- Session 06: `e2e04` trong thư mục tạm có ba kiểm tra cũ (đếm 37 dây, màu thanh F9C, 37 kênh sáng hoặc mờ) đã lỗi thời từ Session 05 vì kênh nay gộp theo cặp. Không ảnh hưởng ứng dụng.

- Kiểm trên Windows: `npm install`, `npm run dev`, `npm run dist:win`, rồi mở `dist/kho/Mo-MapApp-Windows.bat`. Đây là các mục chưa kiểm của Session 01.
- Biểu tượng ứng dụng: đã có `build/icon.ico` (16 đến 256 px) và `build/icon.png`, gắn vào exe Windows qua `win.icon` của electron-builder và vào cửa sổ qua `BrowserWindow.icon`. Chưa kiểm trên Windows thật: icon có hiện trên exe, thanh tác vụ và shortcut không. Nếu `dist:win` báo lỗi "Cannot create symbolic link" khi giải nén winCodeSign (công cụ nhúng icon), bật Developer Mode của Windows hoặc chạy terminal bằng quyền Administrator.
- `Tao-Shortcut-MapApp.bat` (ở gốc `dist/kho`) tạo `MapApp.lnk` ngoài Desktop trỏ tới `app\win\MapApp.exe` với icon của exe. Chưa chạy trên Windows thật. Đã sửa `createKho` cho phép các file này, `HUONG-DAN-SU-DUNG.md` và `DINH-DANG-FLOWMAP.md` nằm sẵn trong thư mục kho mới (trước đó "Tạo kho mới" trong `dist/kho` sẽ báo không trống).
- Session 10, cần máy thật: (1) `npm run dist:win` trên Windows rồi chạy `dist/kho/Mo-MapApp-Windows.bat` từ USB exFAT, mở dự án mẫu, Play P-01, kiểm AppData không có gì mới; (2) chạy `mo-mapapp-linux.sh` từ USB trên Ubuntu 22.04 trở lên; (3) gộp thử vào nhánh studyapp thật theo TDD 11 và chạy test cả hai bên; (4) đo NFR-02 bằng DevTools trên máy văn phòng.
- Chưa `git init` thư mục dự án. Chủ dự án commit sau khi kiểm xong Session 01.
