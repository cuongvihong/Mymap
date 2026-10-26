import {
  LineCounter,
  Scalar,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Document,
  type Node as YamlNode,
  type YAMLSeq
} from 'yaml'
import type { FlowmapIssue } from '../types'

export type PathSeg = string | number

export interface Position {
  line: number
  col: number
}

export interface ParsedFlowmap {
  /**
   * The document as plain JavaScript. Every scalar is a string, because the failsafe schema is used:
   * `id: 1.1` stays "1.1" and `flowmap: 1` is "1". Null when the text has syntax errors or is empty.
   */
  raw: unknown
  /** YAML_SYNTAX issues. When there are any, `raw` is null and validation is skipped. */
  syntaxIssues: FlowmapIssue[]
  /** Line and column (from 1) of a path. `key` points at the key instead of the value. */
  locate(path: readonly PathSeg[], at?: 'value' | 'key'): Position
}

const SYNTAX_TEXT: Record<string, string> = {
  BAD_INDENT: 'thụt lề không đúng',
  DUPLICATE_KEY: 'khóa bị khai báo hai lần trong cùng một khối',
  MISSING_CHAR: 'thiếu một ký tự cần có, ví dụ dấu đóng ngoặc hoặc dấu hai chấm',
  TAB_AS_INDENT: 'dùng ký tự Tab để thụt lề, YAML chỉ nhận dấu cách',
  BLOCK_AS_IMPLICIT_KEY: 'khóa và giá trị phải nằm trên cùng một dòng',
  BLOCK_IN_FLOW: 'khối nhiều dòng nằm trong ngoặc [ ] hoặc { }',
  MULTILINE_IMPLICIT_KEY: 'khóa không được xuống dòng',
  UNEXPECTED_TOKEN: 'ký tự không mong đợi',
  BAD_SCALAR_START: 'giá trị bắt đầu bằng ký tự không hợp lệ, hãy đặt trong dấu nháy',
  BAD_ALIAS: 'tham chiếu alias không hợp lệ',
  BAD_DIRECTIVE: 'chỉ thị % không hợp lệ',
  KEY_OVER_1024_CHARS: 'khóa dài quá 1024 ký tự',
  IMPOSSIBLE: 'không đọc được'
}

const MAX_SYNTAX_ISSUES = 20

function plainSource(text: string, node: YamlNode): string {
  if (isScalar(node) && node.type === 'PLAIN' && node.range) {
    return text.slice(node.range[0], node.range[1])
  }
  return isScalar(node) ? String(node.value ?? '') : ''
}

/**
 * AI often writes `[F9B, Số dư 20.00, invoice 50.00, chọn chia đôi]` where the note has commas.
 * Everything after the first item is joined back into one note, keeping the original text.
 */
function mergeLongSteps(doc: Document.Parsed, text: string): void {
  const scenarios = doc.get('scenarios', true)
  if (!isSeq(scenarios)) return
  for (const scenario of scenarios.items) {
    if (!isMap(scenario)) continue
    const steps = scenario.get('steps', true)
    if (!isSeq(steps)) continue
    for (const step of steps.items) {
      if (!isSeq(step) || step.items.length <= 2) continue
      const seq = step as YAMLSeq<YamlNode>
      const first = seq.items[0]
      const rest = seq.items
        .slice(1)
        .map((item) => plainSource(text, item))
        .join(', ')
      if (first) seq.items = [first, new Scalar(rest)]
    }
  }
}

export function parseFlowmap(input: string): ParsedFlowmap {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const lineCounter = new LineCounter()
  const doc = parseDocument(text, {
    schema: 'failsafe',
    lineCounter,
    prettyErrors: false,
    uniqueKeys: true
  })

  const pos = (offset: number): Position => {
    const p = lineCounter.linePos(offset)
    return { line: p.line, col: p.col }
  }

  const locate: ParsedFlowmap['locate'] = (path, at = 'value') => {
    let current = [...path]
    if (at === 'key' && current.length > 0) {
      const last = current[current.length - 1]
      const parent = doc.getIn(current.slice(0, -1), true)
      if (isMap(parent)) {
        const pair = parent.items.find((p) => isScalar(p.key) && String(p.key.value) === last)
        const range = isScalar(pair?.key) ? pair.key.range : null
        if (range) return pos(range[0])
      }
    }
    // A missing key has no node. Walk up to the nearest container that exists.
    while (current.length > 0) {
      const node = doc.getIn(current, true)
      if (node && typeof node === 'object' && 'range' in node && node.range) {
        return pos((node.range as [number, number, number])[0])
      }
      current = current.slice(0, -1)
    }
    return { line: 1, col: 1 }
  }

  if (doc.errors.length > 0) {
    const issues: FlowmapIssue[] = doc.errors
      .map((e) => {
        const start = e.pos?.[0] ?? 0
        const p = e.linePos?.[0] ?? pos(start)
        const why = SYNTAX_TEXT[e.code] ?? `lỗi cú pháp (${e.code})`
        return {
          line: p.line,
          col: p.col,
          path: '',
          code: 'YAML_SYNTAX' as const,
          severity: 'error' as const,
          message: `dòng ${p.line}, cột ${p.col}: cú pháp YAML sai, ${why}`
        }
      })
      .sort((a, b) => a.line - b.line || a.col - b.col)
      .slice(0, MAX_SYNTAX_ISSUES)
    return { raw: null, syntaxIssues: issues, locate }
  }

  mergeLongSteps(doc, text)
  const raw: unknown = doc.toJS()
  return { raw, syntaxIssues: [], locate }
}
