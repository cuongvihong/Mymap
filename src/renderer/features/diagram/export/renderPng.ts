import { blockWidth, DEFAULT_BLOCK_HEIGHT } from '../../../../shared/diagram/frames'
import {
  buildPngScene,
  pngScale,
  type DrawOp,
  type PngScene,
  type PngTheme
} from '../../../../shared/diagram/pngScene'
import {
  NODE_TYPES,
  VIA_TYPES,
  type NodeType,
  type ProjectData,
  type ViaType
} from '../../../../shared/diagram/types'

/** Colours and fonts of the open project, read from the tokens of `.dg-root`. */
export function readTheme(): PngTheme {
  const root = document.querySelector('.dg-root') ?? document.documentElement
  const style = getComputedStyle(root)
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  const type = Object.fromEntries(
    NODE_TYPES.map((t) => [t, v(`--dg-t-${t}`, '#378add')])
  ) as Record<NodeType, string>
  const via = Object.fromEntries(VIA_TYPES.map((t) => [t, v(`--dg-v-${t}`, '#8f939c')])) as Record<
    ViaType,
    string
  >
  return {
    background: v('--dg-canvas', '#1a1b1f'),
    frameStroke: v('--dg-edge', '#5d6069'),
    frameText: v('--dg-ink-2', '#bdbab3'),
    blockFill: v('--dg-panel', '#202126'),
    blockStroke: v('--dg-line', '#34373e'),
    ink: v('--dg-ink', '#ecebe7'),
    muted: v('--dg-muted', '#96938b'),
    type,
    via,
    fontUi: v('--font-ui', 'sans-serif'),
    fontMono: v('--font-mono', 'monospace')
  }
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const k = Math.min(r, w / 2, h / 2)
  c.beginPath()
  c.moveTo(x + k, y)
  c.arcTo(x + w, y, x + w, y + h, k)
  c.arcTo(x + w, y + h, x, y + h, k)
  c.arcTo(x, y + h, x, y, k)
  c.arcTo(x, y, x + w, y, k)
  c.closePath()
}

function paint(c: CanvasRenderingContext2D, op: DrawOp): void {
  if (op.kind === 'rect') {
    roundRect(c, op.rect.x, op.rect.y, op.rect.w, op.rect.h, op.radius)
    if (op.fill) {
      c.fillStyle = op.fill
      c.fill()
    }
    if (op.stroke) {
      c.setLineDash(op.dash ? [...op.dash] : [])
      c.lineWidth = op.width ?? 1
      c.strokeStyle = op.stroke
      c.stroke()
      c.setLineDash([])
    }
  } else if (op.kind === 'text') {
    c.font = op.font
    c.fillStyle = op.color
    c.fillText(op.text, op.x, op.y)
  } else if (op.kind === 'curve') {
    c.beginPath()
    c.moveTo(op.p1[0], op.p1[1])
    c.bezierCurveTo(op.c1[0], op.c1[1], op.c2[0], op.c2[1], op.p2[0], op.p2[1])
    c.lineWidth = op.width
    c.strokeStyle = op.color
    c.stroke()
  } else {
    const dx = op.tip[0] - op.from[0]
    const dy = op.tip[1] - op.from[1]
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    c.beginPath()
    c.moveTo(op.tip[0], op.tip[1])
    c.lineTo(
      op.tip[0] - ux * op.size - uy * op.size * 0.5,
      op.tip[1] - uy * op.size + ux * op.size * 0.5
    )
    c.lineTo(
      op.tip[0] - ux * op.size + uy * op.size * 0.5,
      op.tip[1] - uy * op.size - ux * op.size * 0.5
    )
    c.closePath()
    c.fillStyle = op.color
    c.fill()
  }
}

/** Builds the scene of the whole map with the real font metrics of the page. */
export async function buildMapScene(
  data: ProjectData,
  sizes: Readonly<Record<number, { w: number; h: number }>>
): Promise<{ scene: PngScene; theme: PngTheme }> {
  const theme = readTheme()
  // Make sure the embedded fonts are ready before text is measured.
  try {
    await Promise.all([
      document.fonts.load(`600 13px ${theme.fontUi}`),
      document.fonts.load(`400 11.5px ${theme.fontUi}`),
      document.fonts.load(`500 10.5px ${theme.fontMono}`)
    ])
  } catch {
    // Fonts that cannot load fall back to the system ones.
  }
  const probe = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
  const measure = (text: string, font: string) => {
    probe.font = font
    return probe.measureText(text).width
  }
  const scene = buildPngScene({
    nodes: data.nodes,
    groups: data.groups.map((g) => ({
      id: g.id,
      title: g.title,
      frame: g.frame ? { x: g.frame.x, y: g.frame.y, w: g.frame.w, h: g.frame.h } : null
    })),
    links: data.links,
    rectOf: (n) => ({
      x: n.x,
      y: n.y,
      w: blockWidth(n.type),
      h: sizes[n.id]?.h ?? DEFAULT_BLOCK_HEIGHT
    }),
    theme,
    measure
  })
  return { scene, theme }
}

/** PNG of the whole map as a data URL, or null when the browser cannot make a picture that big. */
export async function renderMapPng(
  data: ProjectData,
  sizes: Readonly<Record<number, { w: number; h: number }>>
): Promise<string | null> {
  const { scene, theme } = await buildMapScene(data, sizes)
  const scale = pngScale(scene.width, scene.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(scene.width * scale))
  canvas.height = Math.max(1, Math.round(scene.height * scale))
  const c = canvas.getContext('2d')
  if (!c) return null
  c.fillStyle = theme.background
  c.fillRect(0, 0, canvas.width, canvas.height)
  c.scale(scale, scale)
  c.translate(-scene.origin.x, -scene.origin.y)
  c.textBaseline = 'alphabetic'
  for (const op of scene.ops) paint(c, op)
  const url = canvas.toDataURL('image/png')
  return url.startsWith('data:image/png') ? url : null
}
