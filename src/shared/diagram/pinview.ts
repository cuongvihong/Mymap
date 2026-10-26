import { pickPin, type PinLike } from './pinpick'

/**
 * Pure geometry for the image viewer (FR-AN, TDD 8.7). The image is drawn at its natural size and
 * moved with `translate(tx, ty) scale(scale)` from the top left corner, so every view is just
 * three numbers and the pin can be counter scaled with `1 / scale`.
 */

export interface Size {
  w: number
  h: number
}

export interface ImageView {
  scale: number
  tx: number
  ty: number
}

export interface PinPoint {
  xPct: number
  yPct: number
}

/** Zoom limits of the pin view in the lightbox. */
export const PIN_ZOOM_MIN = 0.7
export const PIN_ZOOM_MAX = 1.15
/** Reference frame the zoom is measured against: a 700 x 520 stage gives zoom 1. */
export const PIN_ZOOM_REF = { w: 700, h: 520 } as const

export const CALLOUT_FONT = 12
export const CALLOUT_MAX_WIDTH = 240
export const CALLOUT_GAP = 18

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Whole image visible and centred, as large as the frame allows. */
export function fitView(image: Size, frame: Size): ImageView {
  const scale = Math.min(frame.w / image.w, frame.h / image.h)
  return { scale, tx: (frame.w - image.w * scale) / 2, ty: (frame.h - image.h * scale) / 2 }
}

/** Zoom used when a pin is shown: follows the stage size, kept between 0.7 and 1.15. */
export function pinZoom(frame: Size): number {
  return clamp(
    Math.min(frame.w / PIN_ZOOM_REF.w, frame.h / PIN_ZOOM_REF.h),
    PIN_ZOOM_MIN,
    PIN_ZOOM_MAX
  )
}

/** The view that puts the pin in the middle of the frame. */
export function pinView(
  image: Size,
  frame: Size,
  pin: PinPoint,
  zoom: number = pinZoom(frame)
): ImageView {
  const px = (pin.xPct / 100) * image.w
  const py = (pin.yPct / 100) * image.h
  return { scale: zoom, tx: frame.w / 2 - px * zoom, ty: frame.h / 2 - py * zoom }
}

export const cssTransform = (v: ImageView) => `translate(${v.tx}px, ${v.ty}px) scale(${v.scale})`

/** Callout text keeps its screen size whatever the zoom: everything is divided by the zoom. */
export function calloutMetrics(zoom: number) {
  return {
    fontSize: CALLOUT_FONT / zoom,
    maxWidth: CALLOUT_MAX_WIDTH / zoom,
    offset: CALLOUT_GAP / zoom
  }
}

/** Size of the card shown while a scenario plays (PlayPeek). */
export const PEEK_FRAME: Size = { w: 280, h: 170 }

/** View of the small card: a fixed zoom range so the pin and its surroundings both stay readable. */
export function peekView(image: Size, pin: PinPoint, frame: Size = PEEK_FRAME): ImageView {
  const zoom = Math.max(0.42, Math.min(0.6, (frame.w / image.w) * 1.6))
  return pinView(image, frame, pin, zoom)
}

/** Percent of the image under a point given in the stage (frame) coordinates, kept inside 0..100. */
export function pointToPct(image: Size, view: ImageView, x: number, y: number): PinPoint {
  const px = ((x - view.tx) / view.scale / image.w) * 100
  const py = ((y - view.ty) / view.scale / image.h) * 100
  return { xPct: clamp(round1(px), 0, 100), yPct: clamp(round1(py), 0, 100) }
}

export const round1 = (n: number) => Math.round(n * 10) / 10

/** Next index when stepping through `count` pins, wrapping at both ends. -1 means "whole image". */
export function stepPin(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return -1
  if (current < 0) return direction === 1 ? 0 : count - 1
  return (current + direction + count) % count
}

export interface PlayPeekModel {
  /** Index of the pin shown, -1 when the image has none. */
  index: number
  view: ImageView
  /** Scale of the pin marker so it keeps its size whatever the zoom. */
  markerScale: number
}

/**
 * What the play card draws (FR-KB-08): the pin whose note shares the most words with the step note
 * (or the one asked for), centred in the 280 x 170 frame, with the marker counter scaled.
 */
export function playPeekModel(
  image: Size,
  pins: readonly (PinLike & PinPoint)[],
  stepNote: string,
  pinIndex?: number
): PlayPeekModel {
  const index = pinIndex ?? pickPin(pins, stepNote)
  const pin = index >= 0 ? pins[index] : undefined
  const view = peekView(image, pin ?? { xPct: 50, yPct: 0 })
  return { index: pin ? index : -1, view, markerScale: 1 / view.scale }
}
