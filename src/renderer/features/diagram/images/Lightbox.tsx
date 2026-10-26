import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { IMAGE_LIMITS, imageUrl } from '../../../../shared/diagram/imagerules'
import {
  calloutMetrics,
  cssTransform,
  fitView,
  pinView,
  pointToPct,
  stepPin,
  type ImageView,
  type Size
} from '../../../../shared/diagram/pinview'
import type { PinData } from '../../../../shared/diagram/types'
import { CloseIcon, GripIcon, PinIcon, TrashIcon } from '../icons'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import { reducedMotion } from './motion'
import styles from './Lightbox.module.css'

const ZOOM_IN_DELAY_MS = 350
const FLY_MS = 380
const EMPTY_PINS: PinData[] = []

/** Full window viewer of one image with its pins (SCR-04, FR-AN-03 to FR-AN-05). */
export function Lightbox() {
  const request = useDiagram((s) => s.viewer)
  const image = useDiagram((s) =>
    s.viewer ? s.data?.images.find((i) => i.id === s.viewer?.imageId) : undefined
  )
  if (!request || !image) return null
  return <LightboxView key={image.id} />
}

function LightboxView() {
  const request = useDiagram((s) => s.viewer)!
  const projectId = useDiagram((s) => s.data?.project.id ?? 0)
  const image = useDiagram((s) => s.data?.images.find((i) => i.id === s.viewer?.imageId))!
  const allPins = useDiagram((s) => s.data?.pins ?? EMPTY_PINS)
  const pins = useMemo(
    () =>
      allPins
        .filter((p) => p.imageId === image.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [allPins, image.id]
  )
  const act = useDiagram.getState

  const stageRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<Size>({ w: 0, h: 0 })
  const [pinIdx, setPinIdx] = useState(-1)
  const [view, setView] = useState<ImageView>({ scale: 1, tx: 0, ty: 0 })
  const [instant, setInstant] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [flying, setFlying] = useState(request.from !== null && !reducedMotion())
  const [drag, setDrag] = useState<{ id: number; xPct: number; yPct: number } | null>(null)
  const [dragRow, setDragRow] = useState<number | null>(null)
  const imageSize: Size = useMemo(
    () => ({ w: image.width, h: image.height }),
    [image.width, image.height]
  )
  const reduce = reducedMotion()

  // --- stage size ------------------------------------------------------------------------
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // --- the view follows the chosen pin, or the whole image --------------------------------
  const initial = useRef(request.pin)
  const first = useRef(true)
  useEffect(() => {
    if (stage.w === 0 || stage.h === 0) return
    if (first.current) {
      first.current = false
      setInstant(true)
      setView(fitView(imageSize, stage))
      const want = initial.current
      if (want >= 0 && want < pins.length) {
        const go = () => {
          setInstant(reduce)
          setPinIdx(want)
          setView(pinView(imageSize, stage, pins[want]!))
        }
        if (reduce) go()
        else window.setTimeout(go, ZOOM_IN_DELAY_MS)
      }
      return
    }
    setInstant(true)
    setView(
      pinIdx >= 0 && pins[pinIdx]
        ? pinView(imageSize, stage, pins[pinIdx])
        : fitView(imageSize, stage)
    )
    // Only a new stage size recomputes the view; moving between pins does it on purpose below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.w, stage.h])

  const goPin = useCallback(
    (i: number) => {
      if (stage.w === 0) return
      const pin = pins[i]
      setInstant(reduce)
      if (i < 0 || !pin) {
        setPinIdx(-1)
        setView(fitView(imageSize, stage))
      } else {
        setPinIdx(i)
        setView(pinView(imageSize, stage, pin))
      }
    },
    [imageSize, pins, reduce, stage]
  )

  // A deleted pin must not leave the index pointing past the end: show the whole image again.
  const [seenPins, setSeenPins] = useState(pins.length)
  if (seenPins !== pins.length) {
    setSeenPins(pins.length)
    if (pinIdx >= pins.length) {
      setPinIdx(-1)
      setInstant(reduce)
      if (stage.w > 0) setView(fitView(imageSize, stage))
    }
  }

  // --- FLIP: the image grows out of the thumbnail ------------------------------------------
  const flyer = useRef<HTMLImageElement>(null)
  useLayoutEffect(() => {
    if (!flying || stage.w === 0) return
    const from = request.from
    const el = flyer.current
    const box = stageRef.current?.getBoundingClientRect()
    if (!from || !el || !box) {
      setFlying(false)
      return
    }
    const fit = fitView(imageSize, stage)
    const target = {
      x: box.left + fit.tx,
      y: box.top + fit.ty,
      w: imageSize.w * fit.scale,
      h: imageSize.h * fit.scale
    }
    const animation = el.animate(
      [
        {
          transform: `translate(${from.x - target.x}px, ${from.y - target.y}px) scale(${from.w / target.w}, ${from.h / target.h})`,
          opacity: 0.9
        },
        { transform: 'none', opacity: 1 }
      ],
      { duration: FLY_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' }
    )
    el.style.left = `${target.x}px`
    el.style.top = `${target.y}px`
    el.style.width = `${target.w}px`
    el.style.height = `${target.h}px`
    animation.finished.then(
      () => setFlying(false),
      () => setFlying(false)
    )
    return () => animation.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flying, stage.w])

  // --- keyboard, focus and the canvas keys ------------------------------------------------
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    boxRef.current?.focus()
    act().setOverlayOpen(true)
    act().setPeek(null)
    return () => {
      act().setOverlayOpen(false)
      previous?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const state = useRef({ pinIdx, pins, placing })
  useEffect(() => {
    state.current = { pinIdx, pins, placing }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        if (typing) {
          el.blur()
          return
        }
        if (state.current.placing) setPlacing(false)
        else act().closeViewer()
        return
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      const n = state.current.pins.length
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        goPin(stepPin(state.current.pinIdx, n, 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        goPin(stepPin(state.current.pinIdx, n, -1))
      } else if (e.key === 'Tab') {
        // Keep the focus inside the dialog.
        const focusable = boxRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, textarea, [tabindex="0"]'
        )
        if (!focusable || focusable.length === 0) return
        const firstEl = focusable[0]!
        const last = focusable[focusable.length - 1]!
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goPin])

  // --- pointer: place a pin, move a pin, pan, zoom ---------------------------------------
  const panning = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(
    null
  )
  const stagePoint = (e: { clientX: number; clientY: number }) => {
    const box = stageRef.current!.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }

  const onStageDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-lb-pin]')) return
    const p = stagePoint(e)
    if (placing) {
      const pct = pointToPct(imageSize, view, p.x, p.y)
      if (p.x < view.tx || p.y < view.ty) return
      if (pct.xPct <= 0 && pct.yPct <= 0) return
      setPlacing(false)
      void act()
        .createPin(image.id, pct)
        .then((pin) => {
          if (!pin) return
          // The new pin is the last one. It becomes the active one without moving the view, so the next
          // pin can be placed right away, and its note can be typed at once.
          window.setTimeout(() => {
            const list = useDiagram.getState().data?.pins.filter((x) => x.imageId === image.id)
            if (list) setPinIdx(list.length - 1)
            noteFocus.current = pin.id
            setFocusTick((n) => n + 1)
          }, 0)
        })
      return
    }
    panning.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onStageMove = (e: React.PointerEvent) => {
    const pan = panning.current
    if (!pan) return
    const dx = e.clientX - pan.x
    const dy = e.clientY - pan.y
    if (!pan.moved && Math.hypot(dx, dy) < 3) return
    pan.moved = true
    setInstant(true)
    setView((v) => ({ ...v, tx: pan.tx + dx, ty: pan.ty + dy }))
  }
  const onStageUp = () => {
    panning.current = null
  }
  const onWheel = (e: React.WheelEvent) => {
    const p = stagePoint(e)
    const fit = fitView(imageSize, stage)
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    setInstant(true)
    setView((v) => {
      const scale = Math.min(fit.scale * 8, Math.max(fit.scale * 0.5, v.scale * factor))
      const k = scale / v.scale
      return { scale, tx: p.x - (p.x - v.tx) * k, ty: p.y - (p.y - v.ty) * k }
    })
  }

  // Dragging a pin moves it; a click without movement zooms to it.
  const pinDown = (e: React.PointerEvent, pin: PinData, index: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const start = { x: e.clientX, y: e.clientY }
    let moved = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return
      moved = true
      const p = stagePoint(ev)
      const pct = pointToPct(imageSize, view, p.x, p.y)
      setDrag({ id: pin.id, ...pct })
    }
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      if (!moved) {
        goPin(index)
        return
      }
      const p = stagePoint(ev)
      const pct = pointToPct(imageSize, view, p.x, p.y)
      setDrag(null)
      void act().updatePin(pin.id, { xPct: pct.xPct, yPct: pct.yPct })
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  // --- notes ------------------------------------------------------------------------------
  const noteFocus = useRef<number | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  const noteRefs = useRef(new Map<number, HTMLTextAreaElement>())
  useEffect(() => {
    const id = noteFocus.current
    if (id === null) return
    const el = noteRefs.current.get(id)
    if (el) {
      el.focus()
      noteFocus.current = null
    }
  }, [focusTick, pins])

  const active = pinIdx >= 0 ? pins[pinIdx] : undefined
  const callout = calloutMetrics(view.scale)
  const countLabel = t.image.pins.replace('{n}', String(pins.length))
  const markerScale = 1 / view.scale

  return (
    <div
      className={`${styles.lb} ${reduce ? styles.still : ''}`}
      data-lightbox={image.id}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) act().closeViewer()
      }}
    >
      <div
        ref={boxRef}
        className={styles.box}
        role="dialog"
        aria-modal="true"
        aria-label={image.caption || t.image.viewer.region}
        tabIndex={-1}
      >
        <div
          ref={stageRef}
          className={`${styles.stage} ${placing ? styles.placing : ''}`}
          data-lb-stage
          onPointerDown={onStageDown}
          onPointerMove={onStageMove}
          onPointerUp={onStageUp}
          onPointerCancel={onStageUp}
          onWheel={onWheel}
        >
          <div
            className={styles.wrap}
            data-lb-wrap
            data-scale={view.scale.toFixed(3)}
            style={{
              width: image.width,
              height: image.height,
              transform: cssTransform(view),
              transition: instant || reduce ? 'none' : undefined,
              visibility: flying ? 'hidden' : 'visible'
            }}
          >
            <img
              src={imageUrl(projectId, image.relPath)}
              alt={image.caption}
              width={image.width}
              height={image.height}
              draggable={false}
            />
            {pins.map((pin, i) => {
              const at = drag?.id === pin.id ? drag : pin
              return (
                <span
                  key={pin.id}
                  className={`${styles.pin} ${i === pinIdx ? styles.act : ''}`}
                  data-lb-pin={i}
                  style={{
                    left: `${at.xPct}%`,
                    top: `${at.yPct}%`,
                    transform: `scale(${i === pinIdx ? markerScale * 1.25 : markerScale})`
                  }}
                  onPointerDown={(e) => pinDown(e, pin, i)}
                >
                  {i + 1}
                </span>
              )
            })}
            <div
              className={styles.callout}
              data-callout
              style={{
                left: active ? `${(drag?.id === active.id ? drag : active).xPct}%` : 0,
                top: active ? `${(drag?.id === active.id ? drag : active).yPct}%` : 0,
                fontSize: callout.fontSize,
                maxWidth: callout.maxWidth,
                transform: `translate(${callout.offset}px, -50%)`,
                opacity: active ? 1 : 0,
                ['--dg-inv' as string]: markerScale
              }}
            >
              {active
                ? active.note || t.image.viewer.pinLabel.replace('{n}', String(pinIdx + 1))
                : ''}
            </div>
          </div>
          {flying && (
            <img
              ref={flyer}
              className={styles.flyer}
              src={imageUrl(projectId, image.relPath)}
              alt=""
              draggable={false}
            />
          )}
          {placing && <div className={styles.placeHint}>{t.image.viewer.placing}</div>}
        </div>

        <div className={styles.side}>
          <div className={styles.head}>
            <div>
              <b>{image.caption}</b>
              <span>{pins.length === 0 ? t.image.viewer.noPins : t.image.viewer.hint}</span>
            </div>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={t.image.viewer.close}
              onClick={() => act().closeViewer()}
            >
              <CloseIcon size={16} />
            </button>
          </div>
          <ol className={styles.list} aria-label={countLabel}>
            {pins.map((pin, i) => (
              <li
                key={pin.id}
                className={`${styles.row} ${i === pinIdx ? styles.rowAct : ''} ${dragRow === i ? styles.rowDrag : ''}`}
                draggable
                onDragStart={(e) => {
                  if ((e.target as HTMLElement).closest('input, textarea')) {
                    e.preventDefault()
                    return
                  }
                  e.dataTransfer.setData('text/plain', String(i))
                  e.dataTransfer.effectAllowed = 'move'
                  setDragRow(i)
                }}
                onDragOver={(e) => {
                  if (dragRow !== null) e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = Number(e.dataTransfer.getData('text/plain'))
                  setDragRow(null)
                  if (!Number.isInteger(from) || from === i) return
                  const order = pins.map((p) => p.id)
                  const [moved] = order.splice(from, 1)
                  if (moved === undefined) return
                  order.splice(i, 0, moved)
                  void act().reorderPins(image.id, order)
                }}
                onDragEnd={() => setDragRow(null)}
              >
                <span className={styles.grip} title={t.image.viewer.dragPin}>
                  <GripIcon size={12} />
                </span>
                <button
                  type="button"
                  className={styles.num}
                  data-pin-row={i}
                  aria-label={t.image.viewer.pinLabel.replace('{n}', String(i + 1))}
                  aria-pressed={i === pinIdx}
                  onClick={() => goPin(i)}
                >
                  {i + 1}
                </button>
                <NoteField
                  pin={pin}
                  active={i === pinIdx}
                  onRegister={(el) => {
                    if (el) noteRefs.current.set(pin.id, el)
                    else noteRefs.current.delete(pin.id)
                  }}
                  onSelect={() => setPinIdx(i)}
                />
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={`${t.image.viewer.removePin} ${i + 1}`}
                  title={t.image.viewer.removePin}
                  onClick={() => void act().removePin(pin.id)}
                >
                  <TrashIcon size={14} />
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.foot}>
            <button type="button" className={styles.btn} id="lb-all" onClick={() => goPin(-1)}>
              {t.image.viewer.all}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${placing ? styles.btnOn : ''}`}
              aria-pressed={placing}
              disabled={pins.length >= IMAGE_LIMITS.pinsPerImage}
              onClick={() => setPlacing(!placing)}
            >
              <PinIcon size={13} /> {t.image.viewer.place}
            </button>
            <button
              type="button"
              className={styles.btn}
              id="lb-prev"
              disabled={pins.length === 0}
              onClick={() => goPin(stepPin(pinIdx, pins.length, -1))}
            >
              {t.image.viewer.prev}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.primary}`}
              id="lb-next"
              disabled={pins.length === 0}
              onClick={() => goPin(stepPin(pinIdx, pins.length, 1))}
            >
              {t.image.viewer.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** One note, saved when the field loses the cursor or Enter is pressed. */
function NoteField({
  pin,
  active,
  onRegister,
  onSelect
}: {
  pin: PinData
  active: boolean
  onRegister: (el: HTMLTextAreaElement | null) => void
  onSelect: () => void
}) {
  const [value, setValue] = useState(pin.note)
  const [seen, setSeen] = useState(pin.note)
  if (seen !== pin.note) {
    setSeen(pin.note)
    setValue(pin.note)
  }
  const commit = () => {
    const next = value.trim()
    if (next !== pin.note) void useDiagram.getState().updatePin(pin.id, { note: next })
  }
  return (
    <textarea
      ref={onRegister}
      rows={1}
      className={`${styles.note} ${active ? styles.noteAct : ''}`}
      value={value}
      maxLength={IMAGE_LIMITS.pinNote}
      placeholder={t.image.viewer.emptyNote}
      aria-label={t.image.viewer.pinNote}
      onFocus={onSelect}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}
