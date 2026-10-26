import { describe, expect, it } from 'vitest'
import { blockDisplay, edgeDisplay, frameDisplay } from '../src/shared/diagram/display'
import { litNodes } from '../src/shared/diagram/focus'
import { sampleDoc } from './helpers/sample'
import { docLinkEnds, docScenarios } from '../src/shared/diagram/flowmap/convert'
import { pathNodeIds } from '../src/shared/diagram/scenario'

const doc = sampleDoc()
const links = docLinkEnds(doc)
const scenarios = docScenarios(doc)
const nodeIds = doc.nodes.map((n) => n.id)

function state(focusId: string | null, selected: string[] = []) {
  const lit = litNodes({
    links,
    focusId,
    scenarioPaths: selected.map((s) => pathNodeIds(scenarios, s))
  })
  return { lit, focusId }
}

describe('display classes', () => {
  it('draws everything normally when nothing is focused or selected', () => {
    const s = state(null)
    for (const id of nodeIds) expect(blockDisplay(id, s)).toBe('normal')
    for (const l of links) expect(edgeDisplay(l, s)).toBe('normal')
  })

  it('focus on F9C (F9.4) lights exactly the 7 blocks of the checklist and dims the rest', () => {
    const s = state('F9C')
    const shown = nodeIds.filter((id) => blockDisplay(id, s) !== 'dim').sort()
    expect(shown).toEqual(['DTX', 'F1B', 'F9B', 'F9C', 'F9D', 'F9E', 'LDG'].sort())
    expect(blockDisplay('F9C', s)).toBe('focus')
    expect(blockDisplay('F9D', s)).toBe('lit')
    expect(blockDisplay('F8A', s)).toBe('dim')
  })

  it('keeps only the channels that touch the focused block', () => {
    const s = state('F9C')
    for (const l of links) {
      const touches = l.from === 'F9C' || l.to === 'F9C'
      expect(edgeDisplay(l, s)).toBe(touches ? 'lit' : 'dim')
    }
  })

  it('a scenario alone lights the blocks of its path and the channels between them', () => {
    const s = state(null, ['P-01'])
    const path = new Set(pathNodeIds(scenarios, 'P-01'))
    for (const id of nodeIds) expect(blockDisplay(id, s)).toBe(path.has(id) ? 'lit' : 'dim')
    for (const l of links) {
      expect(edgeDisplay(l, s)).toBe(path.has(l.from) && path.has(l.to) ? 'lit' : 'dim')
    }
  })

  it('scenario plus focus uses the intersection (FR-CV-07)', () => {
    const s = state('F8B', ['P-01'])
    const lit = nodeIds.filter((id) => blockDisplay(id, s) !== 'dim').sort()
    expect(lit).toEqual(['F8A', 'F8B', 'F9A'])
  })

  it('dims a group frame only when none of its blocks is lit', () => {
    const s = state('F9C')
    expect(frameDisplay(['F9C', 'F9D'], s)).toBe('normal')
    expect(frameDisplay(['F8A', 'F8B'], s)).toBe('dim')
    expect(frameDisplay(['F8A'], state(null))).toBe('normal')
  })
})

import {
  blockWidth,
  dropTarget,
  frameBounds,
  FRAME_PAD,
  unionRect
} from '../src/shared/diagram/frames'

describe('frames', () => {
  it('wraps the members with the demo padding and is empty for an empty group', () => {
    expect(frameBounds([])).toBeNull()
    const b = frameBounds([
      { x: 100, y: 100, w: 250, h: 100 },
      { x: 400, y: 300, w: 210, h: 80 }
    ])
    expect(b).toEqual({
      x: 100 - FRAME_PAD.left,
      y: 100 - FRAME_PAD.top,
      w: 510 + FRAME_PAD.left + FRAME_PAD.right,
      h: 280 + FRAME_PAD.top + FRAME_PAD.bottom
    })
  })

  it('shrinks when a member leaves', () => {
    const a = { x: 0, y: 0, w: 250, h: 100 }
    const far = { x: 900, y: 0, w: 250, h: 100 }
    const both = frameBounds([a, far])!
    const alone = frameBounds([a])!
    expect(alone.w).toBeLessThan(both.w)
  })

  it('picks the smallest frame under the centre of the dropped block, or none', () => {
    const frames = [
      { id: 'big', rect: { x: 0, y: 0, w: 1000, h: 800 } },
      { id: 'small', rect: { x: 100, y: 100, w: 400, h: 300 } }
    ]
    expect(dropTarget({ x: 150, y: 150, w: 250, h: 100 }, frames)).toBe('small')
    expect(dropTarget({ x: 600, y: 500, w: 250, h: 100 }, frames)).toBe('big')
    expect(dropTarget({ x: 2000, y: 2000, w: 250, h: 100 }, frames)).toBeNull()
  })

  it('forgives a drop just outside a frame, but not far outside', () => {
    const frames = [{ id: 'g', rect: { x: 100, y: 100, w: 400, h: 300 } }]
    // centre at (300, 80): 20 above the frame
    expect(dropTarget({ x: 175, y: 30, w: 250, h: 100 }, frames)).toBe('g')
    // centre 200 above the frame
    expect(dropTarget({ x: 175, y: -170, w: 250, h: 100 }, frames)).toBeNull()
    // a strict hit wins over a slop hit
    const both = [
      { id: 'wide', rect: { x: 0, y: 0, w: 2000, h: 2000 } },
      { id: 'near', rect: { x: 100, y: 100, w: 400, h: 300 } }
    ]
    expect(dropTarget({ x: 175, y: 30, w: 250, h: 100 }, both)).toBe('wide')
  })

  it('uses a narrower block for start, end, ext and tech', () => {
    expect(blockWidth('fnc')).toBe(250)
    expect(blockWidth('req')).toBe(250)
    expect(blockWidth('tech')).toBe(210)
    expect(blockWidth('start')).toBe(210)
  })

  it('unionRect covers all rectangles', () => {
    expect(unionRect([])).toBeNull()
    expect(
      unionRect([
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 20, y: 30, w: 10, h: 10 }
      ])
    ).toEqual({ x: 0, y: 0, w: 30, h: 40 })
  })
})
