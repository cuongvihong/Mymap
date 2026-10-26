import type { FlowmapDoc } from '../types'
import { serializeFlowmap } from './serialize'

/** A short, valid example taken from the sample file: 3 blocks, 3 channels, 1 scenario. */
export const PROMPT_EXAMPLE: FlowmapDoc = {
  project: { name: 'MOE Education Account', docsRoot: null },
  groups: [{ id: 'R9', title: 'Outstanding Fees và Payment', fs: '[Agile] FS 09.docx' }],
  nodes: [
    {
      id: 'F9B',
      type: 'fnc',
      subtype: null,
      group: 'R9',
      code: 'R9 · F9.3',
      title: 'Chọn cách thanh toán',
      body: 'EA, online hoặc chia đôi. Số dư EA nhỏ hơn số phải trả thì tắt lựa chọn chỉ EA và đề xuất chia đôi, phần EA bằng toàn bộ số dư.',
      fix: 'e-Service Portal, màn chọn phương thức và xác nhận',
      chips: ['SCR-04', 'SCR-05'],
      fs: '[Agile] FS 09.docx',
      section: '§3.1.2 bước 4 đến 6'
    },
    {
      id: 'F9C',
      type: 'fnc',
      subtype: null,
      group: 'R9',
      code: 'R9 · F9.4',
      title: 'Trả bằng EA',
      body: 'Gọi sổ cái Function 1 trừ tiền một lần theo FundingReference. Thành công thì invoice Paid, lỗi thì invoice về Issued.',
      fix: 'Nhánh EA trong service thanh toán',
      chips: ['Idempotency key'],
      fs: '[Agile] FS 09.docx',
      section: '§3.1.2 bước 6, BR-F9-03'
    },
    {
      id: 'F9D',
      type: 'fnc',
      subtype: null,
      group: 'R9',
      code: 'R9 · F9.5, F9.6',
      title: 'Trả online và nhận kết quả',
      body: 'Tạo phiên thanh toán ở provider sandbox. Kết quả về qua webhook ký HMAC, kèm job hỏi lại provider cho các nhánh còn Pending.',
      fix: 'Nhánh online, endpoint webhook và job đối soát',
      chips: ['Webhook HMAC', 'Sandbox'],
      fs: '[Agile] FS 09.docx',
      section: '§3.1.2 bước 6, 7, BR-F9-06'
    }
  ],
  links: [
    {
      id: 'F9B_F9C_ui',
      from: 'F9B',
      to: 'F9C',
      via: 'ui',
      label: 'Chọn EA hoặc chia đôi',
      note: 'Nút xác nhận khóa sau lần bấm đầu, gửi kèm idempotency key.'
    },
    { id: 'F9B_F9D_ui', from: 'F9B', to: 'F9D', via: 'ui', label: 'Chọn online', note: '' },
    {
      id: 'F9C_F9D_call',
      from: 'F9C',
      to: 'F9D',
      via: 'call',
      label: 'Chia đôi: trừ EA xong mới mở online',
      note: 'Nhánh EA lỗi thì dừng, không thu online.'
    }
  ],
  scenarios: [
    {
      id: 'P-01',
      type: 'pos',
      title: 'Chia đôi EA và online',
      parent: null,
      at: null,
      steps: [
        { node: 'F9B', note: 'Số dư 20.00, invoice 50.00: chọn chia đôi' },
        { node: 'F9C', note: 'Trừ trước phần EA 20.00' },
        { node: 'F9D', note: 'Mở phiên online cho 30.00, webhook báo thành công' }
      ]
    }
  ],
  layout: {}
}

/** Table of valid values (TDD 6.3), as plain lines the AI can read. */
export const VALUE_TABLE = [
  'Giá trị hợp lệ:',
  'nodes[].type: fnc, req, tech, ext, start, end, cond, note',
  'subtype khi type là tech: api, database, service, ui, queue, storage, job',
  'subtype khi type là start: user, schedule, api, event',
  'subtype khi type là end: ok, fail, warn (bắt buộc)',
  'links[].via: impl, rest, webhook, db, ui, call, redirect, job, event, queue, file. Via impl chỉ dùng từ node req',
  'scenarios[].type: pos, neg, alt, edge',
  'steps[]: [id node, ghi chú] hoặc { node: id node, note: ghi chú }',
  'id: chỉ gồm chữ không dấu, số và các ký tự . _ -, tối đa 40 ký tự, không trùng trong cùng loại',
  'Giới hạn: title 80 ký tự, body 600, fix 200, section 80, chip 24 (tối đa 6 chip), label của link 80, note của link 300, ghi chú bước 160',
  'Kênh không được nối vào node start hoặc req, không được nối ra từ node end, không được nối tới node note',
  'Kịch bản nhánh có parent và at. Node at phải nằm trên đường đi của kịch bản cha, và bước đầu của nhánh phải là node at'
].join('\n')

const HEAD = `Bạn là BA. Đọc các tài liệu FS đính kèm và viết bản đồ chức năng theo định dạng Flowmap YAML phiên bản 1.
Chỉ trả về một khối YAML, không giải thích.
Quy tắc:
1. Mỗi FS là một group. Mỗi function hoặc sub-function chính là một node type fnc.
   Requirement có mã riêng trong FS (ví dụ BR, US, FR) mà quan trọng cho luồng thì là node type req, nối tới fnc bằng via impl.
2. Cơ sở dữ liệu, API nội bộ, job là node type tech. Hệ thống bên ngoài là ext.
3. Mỗi cách hai node nói chuyện với nhau là một link riêng, kèm via. Giữa hai node có thể có nhiều link.
4. body tối đa 4 câu, nói function làm gì. fix ghi màn hình, service hoặc job cần tìm khi có lỗi, chỉ ghi những gì FS nói, không bịa tên repo.
5. section ghi mục trong FS để người đọc mở đúng chỗ.
6. Viết một kịch bản positive đi hết luồng chính, rồi các nhánh negative, alternative, edge rẽ từ đúng bước.
7. Không viết mục layout.
8. Điểm nào các FS mâu thuẫn nhau thì ghi vào note của link hoặc body của node, bắt đầu bằng "Cần thống nhất:".`

/** The text of "Chép mẫu prompt" (FR-YM-04, TDD 6.6). */
export function buildPrompt(): string {
  return `${HEAD}\n\n${VALUE_TABLE}\n\nVí dụ rút gọn:\n${serializeFlowmap(PROMPT_EXAMPLE)}`
}

/**
 * The text of "Chép lỗi cho AI" (FR-YM-03): the error lines plus one sentence of instruction.
 */
export function buildErrorReport(messages: readonly string[]): string {
  return `Sửa các lỗi sau trong file Flowmap YAML, chỉ trả về file đã sửa, không giải thích. YAML bạn vừa viết còn ${messages.length} lỗi:\n\n${messages.join('\n')}`
}
