import { idProblem } from '../ids'
import { checkLinkRules, type LinkRuleReason } from '../linkrules'
import { checkScenario, type ScenarioNode } from '../scenario'
import {
  END_SUBTYPES,
  LIMITS,
  NODE_TYPES,
  SCENARIO_TYPES,
  START_SUBTYPES,
  TECH_SUBTYPES,
  VIA_TYPES,
  type FlowmapIssue,
  type FlowmapIssueCode,
  type NodeType,
  type ViaType
} from '../types'
import type { ParsedFlowmap, PathSeg } from './parse'

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)

const KNOWN_KEYS = {
  top: ['flowmap', 'project', 'groups', 'nodes', 'links', 'scenarios', 'layout'],
  project: ['name', 'docs_root'],
  group: ['id', 'title', 'fs'],
  node: [
    'id',
    'type',
    'subtype',
    'group',
    'code',
    'title',
    'body',
    'fix',
    'chips',
    'fs',
    'section'
  ],
  link: ['id', 'from', 'to', 'via', 'label', 'note'],
  scenario: ['id', 'type', 'title', 'parent', 'at', 'steps'],
  step: ['node', 'note']
} as const

const LINK_RULE_DETAIL: Record<LinkRuleReason, (from: string, to: string) => string> = {
  note: () => 'nối với khối Ghi chú, khối Ghi chú không có kênh',
  'to-start': (_f, to) => `nối vào khối Start "${to}", Start chỉ là điểm đầu`,
  'to-req': (_f, to) => `nối vào khối REQ "${to}", REQ chỉ là điểm đầu của kênh impl`,
  'from-end': (from) => `nối ra từ khối End "${from}", End chỉ là điểm cuối`,
  'impl-not-req': (from) =>
    `dùng via impl nhưng "${from}" không phải khối REQ, impl chỉ xuất phát từ REQ`
}

export function formatPath(path: readonly PathSeg[]): string {
  return path.map((s, i) => (typeof s === 'number' ? `[${s}]` : `${i ? '.' : ''}${s}`)).join('')
}

const len = (s: string) => [...s].length
const list = (values: readonly string[]) => values.join(', ')

/**
 * Checks a parsed Flowmap YAML against TDD 6.4. Every issue carries line and column (from 1),
 * the path of the field, a code, and a Vietnamese message that starts with "dòng L, cột C:".
 * UNKNOWN_KEY is a warning, every other code is an error.
 */
export function validateFlowmap(parsed: ParsedFlowmap): FlowmapIssue[] {
  if (parsed.syntaxIssues.length > 0) return parsed.syntaxIssues

  const issues: FlowmapIssue[] = []
  const add = (
    code: FlowmapIssueCode,
    path: readonly PathSeg[],
    text: string,
    at: 'value' | 'key' = 'value'
  ) => {
    const { line, col } = parsed.locate(path, at)
    issues.push({
      line,
      col,
      path: formatPath(path),
      code,
      severity: code === 'UNKNOWN_KEY' ? 'warning' : 'error',
      message: `dòng ${line}, cột ${col}: ${text}`
    })
  }

  const unknownKeys = (obj: Obj, known: readonly string[], path: readonly PathSeg[]) => {
    for (const key of Object.keys(obj)) {
      if (!known.includes(key)) {
        add(
          'UNKNOWN_KEY',
          [...path, key],
          `khóa "${key}" không thuộc định dạng, được bỏ qua`,
          'key'
        )
      }
    }
  }

  /** String field. Reports a wrong kind of value and returns undefined for it. */
  const text = (obj: Obj, key: string, path: readonly PathSeg[]): string | undefined => {
    const v = obj[key]
    if (v === undefined) return undefined
    if (typeof v !== 'string') {
      add('ENUM', [...path, key], `${formatPath([...path, key])} phải là một đoạn chữ`)
      return undefined
    }
    return v
  }

  const required = (
    obj: Obj,
    key: string,
    path: readonly PathSeg[],
    owner: PathSeg[] = [...path]
  ): string | undefined => {
    const v = text(obj, key, path)
    if (v === undefined) {
      // a value of the wrong kind was already reported by text()
      if (obj[key] === undefined) {
        add('REQUIRED', owner, `${formatPath(path)} thiếu trường bắt buộc "${key}"`)
      }
      return undefined
    }
    if (v.trim() === '') {
      add('REQUIRED', owner, `${formatPath(path)} trường "${key}" đang để trống`)
      return undefined
    }
    return v
  }

  const tooLong = (value: string | undefined, max: number, path: readonly PathSeg[]) => {
    if (value !== undefined && len(value) > max) {
      add('LENGTH', path, `${formatPath(path)} dài ${len(value)} ký tự, tối đa ${max}`)
    }
  }

  /** Reads a top level section that must be a list. */
  const section = (key: 'groups' | 'nodes' | 'links' | 'scenarios', root: Obj): unknown[] => {
    const v = root[key]
    if (v === undefined || v === null || v === '') return []
    if (!Array.isArray(v)) {
      add('ENUM', [key], `${key} phải là một danh sách các mục bắt đầu bằng dấu gạch đầu dòng`)
      return []
    }
    return v
  }

  const root = parsed.raw
  if (!isObj(root)) {
    add(
      'VERSION',
      [],
      'file trống hoặc không phải một khối YAML. Dòng đầu tiên phải là "flowmap: 1"'
    )
    return issues
  }

  unknownKeys(root, KNOWN_KEYS.top, [])

  // VERSION
  if (root['flowmap'] === undefined) {
    add('VERSION', [], 'thiếu dòng "flowmap: 1" ở đầu file')
  } else if (root['flowmap'] !== '1') {
    add(
      'VERSION',
      ['flowmap'],
      `phiên bản flowmap "${String(root['flowmap'])}" chưa được hỗ trợ, chỉ nhận 1`
    )
  }

  // project
  const project = root['project']
  if (project !== undefined && project !== '') {
    if (!isObj(project)) {
      add('ENUM', ['project'], 'project phải là một khối gồm name và docs_root')
    } else {
      unknownKeys(project, KNOWN_KEYS.project, ['project'])
      text(project, 'name', ['project'])
      text(project, 'docs_root', ['project'])
    }
  }

  const groupsRaw = section('groups', root)
  const nodesRaw = section('nodes', root)
  const linksRaw = section('links', root)
  const scenariosRaw = section('scenarios', root)

  // Pre-pass: ids that exist, so a reference is judged against what the file declares.
  const idsOf = (items: unknown[]): Set<string> => {
    const out = new Set<string>()
    for (const it of items) {
      if (isObj(it) && typeof it['id'] === 'string' && it['id'] !== '') out.add(it['id'])
    }
    return out
  }
  const groupIds = idsOf(groupsRaw)
  const nodeIds = idsOf(nodesRaw)
  const scenarioIds = idsOf(scenariosRaw)
  const nodeType = new Map<string, NodeType>()

  /** Checks id format and duplicates for one kind. Returns the id when usable. */
  const checkId = (
    obj: Obj,
    path: readonly PathSeg[],
    seen: Map<string, number>,
    index: number,
    kind: string
  ): string | undefined => {
    const id = text(obj, 'id', path)
    if (id === undefined || id.trim() === '') {
      add('REQUIRED', [...path], `${formatPath(path)} thiếu trường bắt buộc "id"`)
      return undefined
    }
    const problem = idProblem(id)
    if (problem) {
      add(
        'ID_FORMAT',
        [...path, 'id'],
        `${formatPath([...path, 'id'])} "${id}" không hợp lệ, ${problem}`
      )
      return undefined
    }
    const first = seen.get(id)
    if (first !== undefined) {
      add(
        'ID_DUPLICATE',
        [...path, 'id'],
        `${formatPath([...path, 'id'])} "${id}" trùng với ${kind}[${first}], mỗi id chỉ được dùng một lần`
      )
      return undefined
    }
    seen.set(id, index)
    return id
  }

  // groups
  const groupSeen = new Map<string, number>()
  groupsRaw.forEach((g, i) => {
    const path: PathSeg[] = ['groups', i]
    if (!isObj(g)) return add('ENUM', path, `${formatPath(path)} phải là một khối có id và title`)
    unknownKeys(g, KNOWN_KEYS.group, path)
    checkId(g, path, groupSeen, i, 'groups')
    tooLong(required(g, 'title', path), LIMITS.title, [...path, 'title'])
    text(g, 'fs', path)
  })

  // nodes
  const nodeSeen = new Map<string, number>()
  nodesRaw.forEach((n, i) => {
    const path: PathSeg[] = ['nodes', i]
    if (!isObj(n))
      return add('ENUM', path, `${formatPath(path)} phải là một khối có id, type và title`)
    unknownKeys(n, KNOWN_KEYS.node, path)
    const id = checkId(n, path, nodeSeen, i, 'nodes')

    const type = required(n, 'type', path)
    let validType: NodeType | undefined
    if (type !== undefined) {
      if ((NODE_TYPES as readonly string[]).includes(type)) validType = type as NodeType
      else
        add(
          'ENUM',
          [...path, 'type'],
          `${formatPath([...path, 'type'])} "${type}" không hợp lệ, chỉ nhận: ${list(NODE_TYPES)}`
        )
    }
    if (id && validType) nodeType.set(id, validType)

    tooLong(required(n, 'title', path), LIMITS.title, [...path, 'title'])
    tooLong(text(n, 'code', path), LIMITS.code, [...path, 'code'])
    tooLong(text(n, 'body', path), LIMITS.body, [...path, 'body'])
    tooLong(text(n, 'fix', path), LIMITS.fix, [...path, 'fix'])
    tooLong(text(n, 'section', path), LIMITS.section, [...path, 'section'])
    text(n, 'fs', path)

    // subtype depends on type (TDD 6.3)
    const subtype = text(n, 'subtype', path)
    if (validType) {
      const allowed: readonly string[] | null =
        validType === 'tech'
          ? TECH_SUBTYPES
          : validType === 'start'
            ? START_SUBTYPES
            : validType === 'end'
              ? END_SUBTYPES
              : null
      const sub = [...path, 'subtype']
      if (validType === 'end' && (subtype === undefined || subtype === '')) {
        add(
          'REQUIRED',
          path,
          `${formatPath(path)} có type end nên bắt buộc có "subtype": ${list(END_SUBTYPES)}`
        )
      } else if (allowed && subtype !== undefined && subtype !== '' && !allowed.includes(subtype)) {
        add(
          'ENUM',
          sub,
          `${formatPath(sub)} "${subtype}" không hợp lệ với type ${validType}, chỉ nhận: ${list(allowed)}`
        )
      } else if (validType === 'note') {
        tooLong(subtype, 20, sub)
      } else if (!allowed && subtype !== undefined && subtype !== '') {
        add(
          'UNKNOWN_KEY',
          sub,
          `type ${validType} không dùng subtype, giá trị "${subtype}" được bỏ qua`,
          'key'
        )
      }
    }

    // group reference
    const group = text(n, 'group', path)
    if (group !== undefined && group !== '' && !groupIds.has(group)) {
      add(
        'REF_MISSING',
        [...path, 'group'],
        `${formatPath([...path, 'group'])} trỏ tới "${group}" chưa được khai báo trong groups`
      )
    }

    // chips
    const chips = n['chips']
    if (chips !== undefined && chips !== '') {
      const cp = [...path, 'chips']
      if (!Array.isArray(chips)) {
        add('ENUM', cp, `${formatPath(cp)} phải là một danh sách, ví dụ [Admin Portal, GST]`)
      } else {
        if (chips.length > LIMITS.chips) {
          add('LENGTH', cp, `${formatPath(cp)} có ${chips.length} chip, tối đa ${LIMITS.chips}`)
        }
        chips.forEach((c, k) => {
          if (typeof c !== 'string')
            add('ENUM', [...cp, k], `${formatPath([...cp, k])} phải là một đoạn chữ`)
          else tooLong(c, LIMITS.chip, [...cp, k])
        })
      }
    }
  })

  // links
  const linkSeen = new Map<string, number>()
  linksRaw.forEach((l, i) => {
    const path: PathSeg[] = ['links', i]
    if (!isObj(l))
      return add('ENUM', path, `${formatPath(path)} phải là một khối có from, to và via`)
    unknownKeys(l, KNOWN_KEYS.link, path)

    if (l['id'] !== undefined) {
      const id = text(l, 'id', path)
      if (id !== undefined) {
        const problem = idProblem(id)
        if (problem)
          add(
            'ID_FORMAT',
            [...path, 'id'],
            `${formatPath([...path, 'id'])} "${id}" không hợp lệ, ${problem}`
          )
        else if (linkSeen.has(id))
          add(
            'ID_DUPLICATE',
            [...path, 'id'],
            `${formatPath([...path, 'id'])} "${id}" trùng với links[${linkSeen.get(id)}]`
          )
        else linkSeen.set(id, i)
      }
    }

    const from = required(l, 'from', path)
    const to = required(l, 'to', path)
    const via = required(l, 'via', path)

    if (via !== undefined && !(VIA_TYPES as readonly string[]).includes(via)) {
      add(
        'ENUM',
        [...path, 'via'],
        `${formatPath([...path, 'via'])} "${via}" không hợp lệ, chỉ nhận: ${list(VIA_TYPES)}`
      )
    }
    let fromOk = false
    let toOk = false
    if (from !== undefined) {
      if (nodeIds.has(from)) fromOk = true
      else
        add(
          'REF_MISSING',
          [...path, 'from'],
          `${formatPath([...path, 'from'])} trỏ tới "${from}" chưa được khai báo trong nodes`
        )
    }
    if (to !== undefined) {
      if (nodeIds.has(to)) toOk = true
      else
        add(
          'REF_MISSING',
          [...path, 'to'],
          `${formatPath([...path, 'to'])} trỏ tới "${to}" chưa được khai báo trong nodes`
        )
    }
    if (from !== undefined && from === to) {
      add('LINK_SELF', [...path, 'to'], `${formatPath(path)} nối khối "${from}" vào chính nó`)
    } else if (fromOk && toOk && from !== undefined && to !== undefined) {
      // FR-LK-03
      const ft = nodeType.get(from)
      const tt = nodeType.get(to)
      if (ft && tt && (VIA_TYPES as readonly string[]).includes(via ?? '')) {
        for (const v of checkLinkRules(ft, tt, via as ViaType)) {
          add(
            'LINK_RULE',
            [...path, v.end],
            `${formatPath(path)} ${LINK_RULE_DETAIL[v.reason](from, to)}`
          )
        }
      }
    }
    tooLong(text(l, 'label', path), LIMITS.label, [...path, 'label'])
    tooLong(text(l, 'note', path), LIMITS.note, [...path, 'note'])
  })

  // scenarios
  const scenarioSeen = new Map<string, number>()
  const tree: ScenarioNode[] = []
  const treeIndex = new Map<string, number>()
  const badSteps = new Set<string>()
  scenariosRaw.forEach((s, i) => {
    const path: PathSeg[] = ['scenarios', i]
    if (!isObj(s))
      return add('ENUM', path, `${formatPath(path)} phải là một khối có id, type, title và steps`)
    unknownKeys(s, KNOWN_KEYS.scenario, path)
    const id = checkId(s, path, scenarioSeen, i, 'scenarios')

    const type = required(s, 'type', path)
    if (type !== undefined && !(SCENARIO_TYPES as readonly string[]).includes(type)) {
      add(
        'ENUM',
        [...path, 'type'],
        `${formatPath([...path, 'type'])} "${type}" không hợp lệ, chỉ nhận: ${list(SCENARIO_TYPES)}`
      )
    }
    tooLong(required(s, 'title', path), LIMITS.title, [...path, 'title'])

    const parent = text(s, 'parent', path) || null
    const at = text(s, 'at', path) || null
    let parentOk = parent !== null
    let atOk = at !== null
    if (parent !== null && !scenarioIds.has(parent)) {
      parentOk = false
      add(
        'REF_MISSING',
        [...path, 'parent'],
        `${formatPath([...path, 'parent'])} trỏ tới kịch bản "${parent}" chưa được khai báo trong scenarios`
      )
    }
    if (at !== null && !nodeIds.has(at)) {
      atOk = false
      add(
        'REF_MISSING',
        [...path, 'at'],
        `${formatPath([...path, 'at'])} trỏ tới "${at}" chưa được khai báo trong nodes`
      )
    }

    // steps
    const stepsRaw = s['steps']
    const steps: { nodeId: string; note: string }[] = []
    let stepsOk = true
    if (stepsRaw === undefined) {
      add('REQUIRED', path, `${formatPath(path)} thiếu trường bắt buộc "steps"`)
      stepsOk = false
    } else if (stepsRaw === '' || stepsRaw === null) {
      // `steps:` with nothing after it is an empty list
    } else if (!Array.isArray(stepsRaw)) {
      add(
        'ENUM',
        [...path, 'steps'],
        `${formatPath([...path, 'steps'])} phải là một danh sách bước, mỗi bước dạng [id khối, ghi chú]`
      )
      stepsOk = false
    } else {
      stepsRaw.forEach((st, k) => {
        const sp: PathSeg[] = [...path, 'steps', k]
        let node: string | undefined
        let note = ''
        let nodePath: PathSeg[] = sp
        if (Array.isArray(st)) {
          nodePath = [...sp, 0]
          node = typeof st[0] === 'string' ? st[0] : undefined
          note = typeof st[1] === 'string' ? st[1] : ''
        } else if (isObj(st)) {
          unknownKeys(st, KNOWN_KEYS.step, sp)
          nodePath = [...sp, 'node']
          node = typeof st['node'] === 'string' ? st['node'] : undefined
          note = typeof st['note'] === 'string' ? st['note'] : ''
        } else {
          add(
            'ENUM',
            sp,
            `${formatPath(sp)} phải có dạng [id khối, ghi chú] hoặc { node: id khối, note: ghi chú }`
          )
          stepsOk = false
          return
        }
        if (node === undefined || node === '') {
          add('REQUIRED', sp, `${formatPath(sp)} thiếu id khối`)
          stepsOk = false
          return
        }
        if (!nodeIds.has(node)) {
          add(
            'REF_MISSING',
            nodePath,
            `${formatPath(nodePath)} trỏ tới "${node}" chưa được khai báo trong nodes`
          )
          stepsOk = false
          return
        }
        tooLong(note, LIMITS.stepNote, Array.isArray(st) ? [...sp, 1] : [...sp, 'note'])
        steps.push({ nodeId: node, note })
      })
    }

    if (id !== undefined) {
      if (!stepsOk) badSteps.add(id)
      treeIndex.set(id, i)
      tree.push({
        id,
        parentId: parentOk ? parent : null,
        forkNodeId: atOk ? at : null,
        steps
      })
    }
  })

  // BR-06 to BR-08, only for scenarios whose own references are all fine
  const byId = new Map(tree.map((s) => [s.id as string, s]))
  const cycleReported = new Set<string>()
  scenariosRaw.forEach((raw, i) => {
    if (!isObj(raw) || typeof raw['id'] !== 'string') return
    const id = raw['id']
    const node = byId.get(id)
    if (!node || treeIndex.get(id) !== i) return
    const path: PathSeg[] = ['scenarios', i]
    const parentDeclared = typeof raw['parent'] === 'string' && raw['parent'] !== ''
    const atDeclared = typeof raw['at'] === 'string' && raw['at'] !== ''

    if (parentDeclared) {
      // walk up the parents: a loop that returns to this scenario means it is a member
      const seen = new Set<string>([id])
      let cur: string | null = node.parentId === null ? null : (node.parentId as string)
      let member = false
      let stuck = false
      while (cur !== null) {
        if (cur === id) {
          member = true
          break
        }
        if (seen.has(cur)) {
          stuck = true
          break
        }
        seen.add(cur)
        cur = (byId.get(cur)?.parentId as string | null | undefined) ?? null
      }
      if (member) {
        if (![...seen].some((x) => cycleReported.has(x))) {
          add(
            'SCN_CYCLE',
            [...path, 'parent'],
            `${formatPath([...path, 'parent'])} tạo vòng cha con giữa các kịch bản ${[...seen].map((x) => `"${x}"`).join(', ')}, kịch bản không được là cha của chính tổ tiên mình`
          )
        }
        for (const x of seen) cycleReported.add(x)
        return
      }
      if (stuck) return
    }

    if (!parentDeclared) {
      if (atDeclared) {
        add(
          'SCN_FORK',
          [...path, 'at'],
          `${formatPath([...path, 'at'])} chỉ dùng cho nhánh, kịch bản này chưa khai báo parent`
        )
      }
      return
    }
    if (node.parentId === null) return // parent reference already reported
    if (!atDeclared) {
      add(
        'SCN_FORK',
        [...path, 'parent'],
        `${formatPath(path)} có parent "${node.parentId}" nhưng thiếu "at", cần ghi khối nơi nhánh rẽ ra`
      )
      return
    }
    if (node.forkNodeId === null) return // at reference already reported
    for (const problem of checkScenario(tree, id)) {
      if (problem === 'fork-not-on-path') {
        add(
          'SCN_FORK',
          [...path, 'at'],
          `${formatPath([...path, 'at'])} "${node.forkNodeId}" không nằm trên đường đi đầy đủ của kịch bản cha "${node.parentId}"`
        )
      } else if (problem === 'first-step-not-fork' && !badSteps.has(id)) {
        add(
          'SCN_FORK',
          [...path, 'steps', 0],
          `${formatPath([...path, 'steps', 0])} bước đầu của nhánh phải là điểm rẽ "${node.forkNodeId}"`
        )
      }
    }
  })

  // layout
  const layout = root['layout']
  if (layout !== undefined && layout !== '') {
    if (!isObj(layout)) {
      add('ENUM', ['layout'], 'layout phải là danh sách dạng ID: [x, y]')
    } else {
      for (const [key, value] of Object.entries(layout)) {
        const p: PathSeg[] = ['layout', key]
        if (!nodeIds.has(key)) {
          add(
            'REF_MISSING',
            p,
            `${formatPath(p)} trỏ tới khối "${key}" chưa được khai báo trong nodes`,
            'key'
          )
          continue
        }
        const ok =
          Array.isArray(value) &&
          value.length === 2 &&
          value.every((v) => typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
        if (!ok) add('ENUM', p, `${formatPath(p)} phải có dạng [x, y] với hai số`)
      }
    }
  }

  issues.sort((a, b) => a.line - b.line || a.col - b.col)
  return issues
}
