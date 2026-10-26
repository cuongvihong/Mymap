#!/usr/bin/env node
/**
 * Generates a random Flowmap YAML for measuring (TDD 13, NFR-02 to NFR-04): by default 200 blocks,
 * 400 channels, 8 groups and 30 scenarios, and a folder of 40 fake PNG screenshots.
 *
 *   node scripts/gen-big-project.mjs --out big.flowmap.yaml [--images big-images] [--seed 7] [--layout]
 *
 * `--layout` adds a `layout` section (a plain grid), without it no block has coordinates, which is
 * the case that needs the automatic layout. The same seed always gives the same file.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const DEFAULTS = {
  nodes: 200,
  links: 400,
  groups: 8,
  scenarios: 30,
  images: 40,
  seed: 1,
  layout: false
}

/** Small deterministic generator (mulberry32). */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const quote = (s) => `'${String(s).replaceAll("'", "''")}'`

const WORDS = [
  'Đăng nhập',
  'Kiểm tra',
  'Tạo',
  'Cập nhật',
  'Xóa',
  'Gửi',
  'Nhận',
  'Đồng bộ',
  'Tính phí',
  'Đối soát',
  'Xác thực',
  'Thông báo',
  'Hoàn tiền',
  'Phát hành',
  'Duyệt'
]
const THINGS = [
  'hồ sơ',
  'học sinh',
  'invoice',
  'giao dịch',
  'tài khoản',
  'phiên',
  'báo cáo',
  'lịch',
  'phí',
  'biên lai',
  'yêu cầu',
  'thanh toán'
]
const FIX = [
  'Admin Portal, màn Fee',
  'Service thanh toán',
  'Job đồng bộ',
  'e-Service Portal',
  'Bảng invoice',
  'Lớp tích hợp'
]

/** Mix of block types for `n` blocks. Always at least one Start and one End per group. */
function typeMix(n, groups) {
  const fixed = [
    ['start', groups],
    ['end', groups * 2],
    ['req', Math.round(n * 0.1)],
    ['tech', Math.round(n * 0.1)],
    ['ext', Math.round(n * 0.075)],
    ['cond', Math.round(n * 0.05)],
    ['note', Math.round(n * 0.06)]
  ]
  const out = []
  for (const [type, count] of fixed) for (let i = 0; i < count; i++) out.push(type)
  while (out.length < n) out.push('fnc')
  return out.slice(0, n)
}

const TECH_SUB = ['api', 'database', 'service', 'ui', 'queue', 'storage', 'job']
const START_SUB = ['user', 'schedule', 'api', 'event']
const END_SUB = ['ok', 'fail', 'warn']
const VIA_FOR = {
  fnc: {
    tech: ['rest', 'db', 'queue', 'file'],
    fnc: ['call', 'event'],
    ext: ['rest', 'webhook'],
    end: ['ui', 'redirect'],
    cond: ['call']
  },
  start: { fnc: ['ui', 'job'], tech: ['rest'], cond: ['ui'], ext: ['rest'] },
  tech: {
    fnc: ['call', 'event'],
    tech: ['db', 'queue'],
    ext: ['rest'],
    end: ['ui'],
    cond: ['call']
  },
  ext: { fnc: ['webhook', 'event'], tech: ['rest'], end: ['ui'], cond: ['event'] },
  cond: { fnc: ['call'], tech: ['call'], ext: ['call'], end: ['ui'], cond: ['call'] },
  req: { fnc: ['impl'], tech: ['impl'] }
}

export function generate(options = {}) {
  const o = { ...DEFAULTS, ...options }
  const rand = rng(o.seed)
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const types = typeMix(o.nodes, o.groups)
  // Shuffle so the groups get a mix of everything, then put one Start first in every group.
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[types[i], types[j]] = [types[j], types[i]]
  }

  const groups = Array.from({ length: o.groups }, (_, i) => ({
    id: `G${i + 1}`,
    title: `Chức năng ${i + 1}: ${pick(WORDS)} ${pick(THINGS)}`,
    fs: `[Agile] FS ${String(i + 1).padStart(2, '0')}.docx`
  }))
  const nodes = types.map((type, i) => {
    const node = { id: `N${String(i + 1).padStart(3, '0')}`, type }
    if (type === 'tech') node.subtype = pick(TECH_SUB)
    if (type === 'start') node.subtype = pick(START_SUB)
    if (type === 'end') node.subtype = pick(END_SUB)
    // Tech, external and End blocks may stay outside a group, the others always belong to one.
    const free = (type === 'tech' || type === 'ext' || type === 'end') && rand() < 0.3
    if (!free) node.group = groups[i % groups.length].id
    node.code = `${node.group ?? 'X'} · ${node.id}`
    node.title = `${pick(WORDS)} ${pick(THINGS)} ${i + 1}`
    node.body = `${pick(WORDS)} ${pick(THINGS)}, ${pick(WORDS).toLowerCase()} ${pick(THINGS)} theo quy tắc của FS. Mô tả dài vừa đủ để khối có vài dòng chữ trên canvas.`
    if (type === 'fnc' || type === 'req') node.fix = pick(FIX)
    return node
  })

  const byType = (...ts) => nodes.filter((n) => ts.includes(n.type))
  const sources = byType('fnc', 'start', 'tech', 'ext', 'cond', 'req')
  const links = []
  const seen = new Set()
  let guard = 0
  while (links.length < o.links && guard++ < o.links * 50) {
    const from = pick(sources)
    const rules = VIA_FOR[from.type]
    const toType = pick(Object.keys(rules))
    const targets = byType(toType)
    if (targets.length === 0) continue
    const to = pick(targets)
    if (to.id === from.id) continue
    const via = pick(rules[toType])
    const key = `${from.id}>${to.id}>${via}`
    if (seen.has(key)) continue
    seen.add(key)
    links.push({
      from: from.id,
      to: to.id,
      via,
      label: `${pick(WORDS)} ${pick(THINGS)}`,
      note: `Ghi chú kênh ${links.length + 1}`
    })
  }

  // Scenarios: random walks along the channels. A third of them fork from an earlier one.
  const out = new Map()
  for (const l of links) out.set(l.from, [...(out.get(l.from) ?? []), l.to])
  const walk = (start, maxLen) => {
    const path = [start]
    while (path.length < maxLen) {
      const next = (out.get(path[path.length - 1]) ?? []).filter((id) => !path.includes(id))
      if (next.length === 0) break
      path.push(pick(next))
    }
    return path
  }
  const startsWithLinks = nodes.filter((n) => out.has(n.id)).map((n) => n.id)
  const TYPES = ['pos', 'neg', 'alt', 'edge']
  const scenarios = []
  const roots = []
  const rootCount = Math.max(1, Math.round(o.scenarios * 0.66))
  for (let i = 0; i < o.scenarios; i++) {
    const id = `S-${String(i + 1).padStart(2, '0')}`
    const fork = i >= rootCount && roots.length > 0
    let path
    const scenario = {
      id,
      type: TYPES[i % 4],
      title: `Kịch bản ${i + 1}: ${pick(WORDS)} ${pick(THINGS)}`
    }
    if (fork) {
      const parent = pick(roots)
      const at = pick(parent.path.slice(0, -1).length > 0 ? parent.path.slice(0, -1) : parent.path)
      path = walk(at, 2 + Math.floor(rand() * 5))
      scenario.parent = parent.id
      scenario.at = at
    } else {
      path = walk(pick(startsWithLinks), 4 + Math.floor(rand() * 8))
      roots.push({ id, path })
    }
    scenario.path = path
    scenarios.push(scenario)
  }

  const lines = [
    '# Dự án sinh ngẫu nhiên bằng scripts/gen-big-project.mjs, dùng để đo hiệu năng.',
    'flowmap: 1',
    'project:',
    `  name: Dự án lớn ${o.nodes} khối`,
    'groups:'
  ]
  for (const g of groups)
    lines.push(`  - id: ${g.id}`, `    title: ${quote(g.title)}`, `    fs: ${quote(g.fs)}`)
  lines.push('nodes:')
  for (const n of nodes) {
    lines.push(`  - id: ${n.id}`, `    type: ${n.type}`)
    if (n.subtype) lines.push(`    subtype: ${n.subtype}`)
    if (n.group) lines.push(`    group: ${n.group}`)
    lines.push(
      `    code: ${quote(n.code)}`,
      `    title: ${quote(n.title)}`,
      `    body: ${quote(n.body)}`
    )
    if (n.fix) lines.push(`    fix: ${quote(n.fix)}`)
  }
  lines.push('links:')
  for (const l of links)
    lines.push(
      `  - from: ${l.from}`,
      `    to: ${l.to}`,
      `    via: ${l.via}`,
      `    label: ${quote(l.label)}`,
      `    note: ${quote(l.note)}`
    )
  lines.push('scenarios:')
  for (const s of scenarios) {
    lines.push(`  - id: ${s.id}`, `    type: ${s.type}`)
    if (s.parent) lines.push(`    parent: ${s.parent}`, `    at: ${s.at}`)
    lines.push(`    title: ${quote(s.title)}`, '    steps:')
    for (const id of s.path) lines.push(`      - [${id}, ${quote(`Bước tại ${id}`)}]`)
  }
  if (o.layout) {
    lines.push('layout:')
    const columns = Math.ceil(Math.sqrt(nodes.length * 1.6))
    nodes.forEach((n, i) =>
      lines.push(`  ${n.id}: [${(i % columns) * 320}, ${Math.floor(i / columns) * 220}]`)
    )
  }
  return { yaml: lines.join('\n') + '\n', nodes, links, groups, scenarios }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), 8 + data.length)
  return out
}

/** A plain coloured PNG, `w` by `h`, with a lighter band so it is not a flat fill. */
export function fakePng(w, h, seed) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1)
    for (let x = 0; x < w; x++) {
      const band = (y >> 5) % 2 === 0 ? 40 : 0
      raw[row + 1 + x * 3] = (seed * 37 + band + (x >> 3)) & 0xff
      raw[row + 2 + x * 3] = (seed * 91 + band + (y >> 3)) & 0xff
      raw[row + 3 + x * 3] = (seed * 53 + 90 + band) & 0xff
    }
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(w, 0)
  head.writeUInt32BE(h, 4)
  head[8] = 8
  head[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function main() {
  const args = process.argv.slice(2)
  const get = (name) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : undefined
  }
  const out = get('out') ?? 'big.flowmap.yaml'
  const seed = Number(get('seed') ?? DEFAULTS.seed)
  const { yaml, nodes } = generate({ seed, layout: args.includes('--layout') })
  writeFileSync(out, yaml)
  console.log(`Đã ghi ${out}: ${nodes.length} khối`)
  const images = get('images')
  if (images) {
    mkdirSync(images, { recursive: true })
    for (let i = 0; i < DEFAULTS.images; i++)
      writeFileSync(join(images, `${nodes[i * 5].id}.png`), fakePng(640, 400, i + 1))
    console.log(`Đã ghi ${DEFAULTS.images} ảnh giả vào ${images}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
