/** Vietnamese UI strings of the MapApp shell (MASTER 4.11). Punctuation: comma, period, middle dot only. */
export const shellStrings = {
  appTitle: 'MapApp',
  tagline: 'Bản đồ chức năng của dự án phần mềm',
  loading: 'Đang mở kho',
  topbar: {
    label: 'Thanh công cụ',
    back: 'Danh sách dự án',
    backHint: 'Quay về danh sách dự án',
    projectCode: 'Mã',
    channelMode: 'Chế độ kênh',
    oneWire: 'Một dây',
    manyWires: 'Nhiều dây',
    playImages: 'Ảnh khi Play',
    fitView: 'Vừa màn hình',
    fitViewHint: 'Đưa toàn bộ bản đồ vào màn hình (phím F)',
    theme: 'Sáng / tối',
    themeToLight: 'Đang ở nền tối, bấm để chuyển sang nền sáng',
    themeToDark: 'Đang ở nền sáng, bấm để chuyển sang nền tối',
    saved: 'Đã lưu',
    saving: 'Đang lưu'
  },
  welcome: {
    createProject: 'Tạo dự án',
    openKho: 'Mở kho có sẵn',
    createKho: 'Tạo kho mới',
    importYaml: 'Import YAML hoặc Mermaid',
    importYamlHint: 'Chọn một file rồi tạo dự án mới từ file đó',
    khoOpen: 'Kho đang mở',
    noKho: 'Chưa mở kho nào. Chọn Mở kho có sẵn hoặc Tạo kho mới để bắt đầu.',
    recentKho: 'Kho gần đây',
    projects: 'Dự án',
    emptyProjects: 'Kho này chưa có dự án nào. Bấm Tạo dự án để bắt đầu.',
    blocks: 'khối',
    lastEdit: 'Sửa lần cuối',
    code: 'Mã',
    open: 'Mở',
    rename: 'Đổi tên',
    remove: 'Xóa',
    openProject: 'Mở dự án'
  },
  dialogs: {
    create: {
      title: 'Tạo dự án',
      label: 'Tên dự án',
      hint: 'Tối đa 80 ký tự, không trùng tên dự án khác. So sánh không dấu và không phân biệt hoa thường.',
      submit: 'Tạo'
    },
    rename: {
      title: 'Đổi tên dự án',
      label: 'Tên mới',
      submit: 'Lưu tên'
    },
    remove: {
      title: 'Xóa dự án',
      intro: 'Gõ lại đúng tên dự án để xác nhận:',
      label: 'Tên dự án',
      note: 'Thư mục dự án và ảnh được chuyển vào thung-rac/ của kho, không bị xóa hẳn.',
      submit: 'Xóa dự án'
    },
    cancel: 'Hủy',
    close: 'Đóng'
  },
  lost: {
    title: 'Không truy cập được kho',
    body: 'Có thể ổ đĩa hoặc USB chứa kho đã bị rút ra. Cắm lại, app sẽ tự thử lại mỗi 3 giây và quay về chỗ cũ.',
    retrying: 'Đang thử lại'
  },
  toast: {
    dismiss: 'Đóng thông báo'
  },
  errors: {
    NAME_EMPTY: 'Tên dự án không được để trống.',
    NAME_TOO_LONG: 'Tên dự án tối đa 80 ký tự.',
    NAME_DUPLICATE:
      'Đã có dự án trùng tên này. Tên được so sánh không dấu và không phân biệt hoa thường.',
    PROJECT_NOT_FOUND: 'Không tìm thấy dự án. Có thể dự án đã bị xóa.',
    DOCS_ROOT_INVALID: 'Thư mục tài liệu không tồn tại.',
    VIEWPORT_INVALID: 'Vị trí khung nhìn không hợp lệ.',
    SETTINGS_INVALID: 'Cài đặt không hợp lệ.',
    INVALID_ARGUMENT: 'Dữ liệu gửi đi không hợp lệ.',
    NODE_NOT_FOUND: 'Không tìm thấy khối. Có thể khối đã bị xóa.',
    GROUP_NOT_FOUND: 'Không tìm thấy nhóm. Có thể nhóm đã bị xóa.',
    LINK_NOT_FOUND: 'Không tìm thấy kênh. Có thể kênh đã bị xóa.',
    SCENARIO_NOT_FOUND: 'Không tìm thấy kịch bản. Có thể kịch bản đã bị xóa.',
    KEY_INVALID: 'Mã định danh chỉ gồm chữ không dấu, số và các ký tự . _ -, tối đa 40 ký tự.',
    KEY_DUPLICATE: 'Mã định danh này đã được dùng trong dự án.',
    FIELD_REQUIRED: 'Còn thiếu một trường bắt buộc, ví dụ tiêu đề.',
    FIELD_TOO_LONG: 'Có trường dài quá giới hạn cho phép.',
    ENUM_INVALID: 'Có giá trị không nằm trong danh sách cho phép.',
    LINK_SELF: 'Không thể nối một khối vào chính nó.',
    LINK_RULE: 'Kênh này vi phạm quy tắc nối khối.',
    SCENARIO_RULE: 'Kịch bản vi phạm quy tắc điểm rẽ hoặc vòng cha con.',
    YAML_INVALID: 'File YAML còn lỗi, chưa thể áp dụng.',
    FS_NO_ROOT: 'Chưa chọn thư mục tài liệu. Bấm Chọn thư mục tài liệu ở thanh bên.',
    FS_NOT_FOUND: 'Không tìm thấy file',
    FS_OPEN_FAILED: 'Hệ điều hành không mở được file này.',
    IMAGE_NOT_FOUND: 'Không tìm thấy ảnh. Có thể ảnh đã bị xóa.',
    IMAGE_FORMAT: 'Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF.',
    IMAGE_TOO_LARGE: 'Ảnh lớn quá 15 MB.',
    IMAGE_LIMIT: 'Mỗi khối chỉ có tối đa 8 ảnh.',
    IMAGE_UNREADABLE: 'Không đọc được file ảnh này.',
    CLIPBOARD_EMPTY: 'Bộ nhớ tạm không có ảnh.',
    IMPORT_TOO_LARGE: 'File lớn hơn 5 MB, không nhập được.',
    IMPORT_UNREADABLE: 'Không đọc được file này.',
    EXPORT_IMAGE_INVALID: 'Ảnh xuất ra không hợp lệ, thử lại.',
    EXPORT_OPEN_FAILED: 'Không mở được thư mục xuất.',
    PIN_NOT_FOUND: 'Không tìm thấy ghim. Có thể ghim đã bị xóa.',
    CANCELLED: 'Đã hủy.',
    KHO_INVALID: 'Thư mục này không phải kho MapApp. Kho phải có file data/mapapp.db.',
    KHO_NOT_EMPTY: 'Thư mục này không trống. Hãy chọn một thư mục trống để tạo kho mới.',
    KHO_EXISTS: 'Thư mục này đã là một kho. Dùng Mở kho có sẵn.',
    KHO_NOT_ALLOWED: 'Kho này không có trong danh sách gần đây.',
    INTERNAL: 'Có lỗi không mong đợi. Chi tiết nằm trong thư mục logs của app.',
    fallback: 'Có lỗi không mong đợi. Chi tiết nằm trong thư mục logs của app.'
  } as Record<string, string>
}
