/**
 * Minimal syntax colouring of Flowmap YAML for the YAML panel (FR-YM-05). A line at a time, no
 * state between lines, so the editor can colour only the lines it shows. Not a YAML parser.
 */

export type YamlTokenKind = 'plain' | 'comment' | 'key' | 'dash' | 'string' | 'number' | 'punct'

export interface YamlToken {
  text: string
  kind: YamlTokenKind
}

const push = (out: YamlToken[], text: string, kind: YamlTokenKind) => {
  if (text !== '') out.push({ text, kind })
}

/** Quoted text and a trailing comment inside a value. */
function value(text: string, out: YamlToken[]): void {
  if (/^\s*-?\d+(?:\.\d+)?\s*$/.test(text)) {
    push(out, text, 'number')
    return
  }
  let i = 0
  let plain = ''
  const flush = () => {
    push(out, plain, 'plain')
    plain = ''
  }
  while (i < text.length) {
    const ch = text.charAt(i)
    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < text.length) {
        if (text.charAt(j) === '\\' && ch === '"') j += 2
        else if (text.charAt(j) === ch) break
        else j++
      }
      flush()
      push(out, text.slice(i, Math.min(j + 1, text.length)), 'string')
      i = j + 1
      continue
    }
    if (ch === '#' && (i === 0 || /\s/.test(text.charAt(i - 1)))) {
      flush()
      push(out, text.slice(i), 'comment')
      return
    }
    plain += ch
    i++
  }
  flush()
}

export function highlightLine(line: string): YamlToken[] {
  const out: YamlToken[] = []
  const indent = /^\s*/.exec(line)?.[0] ?? ''
  let rest = line.slice(indent.length)
  push(out, indent, 'plain')
  if (rest.startsWith('#')) {
    push(out, rest, 'comment')
    return out
  }
  while (rest.startsWith('- ') || rest === '-') {
    push(out, '-', 'dash')
    const gap = /^-\s*/.exec(rest)?.[0] ?? '-'
    push(out, gap.slice(1), 'plain')
    rest = rest.slice(gap.length)
  }
  const key = /^([A-Za-z0-9_.-]+)(:)(?=\s|$)/.exec(rest)
  if (key) {
    push(out, key[1] as string, 'key')
    push(out, ':', 'punct')
    rest = rest.slice(key[0].length)
  }
  value(rest, out)
  return out
}
