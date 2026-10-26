import { memo, useCallback, useEffect, useMemo, useRef, type PointerEvent } from 'react'
import { highlightLine } from '../../../../shared/diagram/yamlHighlight'
import { useDiagram } from '../store/diagramStore'
import { yamlOf, YAML_PANEL_MIN_WIDTH } from '../store/dataSlice'
import { diagramStrings as t } from '../strings'
import styles from './yaml.module.css'

const act = () => useDiagram.getState()

/** Time the canvas may rest before the YAML is written again (FR-YM-05). */
export const YAML_SYNC_DELAY = 300

const Line = memo(function Line({ text }: { text: string }) {
  const tokens = highlightLine(text)
  return (
    <>
      {tokens.map((tok, i) => (
        <span key={i} className={styles[tok.kind]}>
          {tok.text}
        </span>
      ))}
      {'\n'}
    </>
  )
})

/** SCR-05: Flowmap YAML next to the canvas. The text is an editor, Áp dụng checks it like an import. */
export function YamlPanel() {
  const data = useDiagram((s) => s.data)
  const text = useDiagram((s) => s.yamlText)
  const base = useDiagram((s) => s.yamlBase)
  const errorLines = useDiagram((s) => s.yamlErrorLines)
  const jump = useDiagram((s) => s.yamlJump)
  const dirty = text !== base

  const area = useRef<HTMLTextAreaElement>(null)
  const code = useRef<HTMLPreElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const marks = useRef<HTMLDivElement>(null)

  // The canvas changed: write the YAML again after a short rest. A clean editor follows, a dirty one keeps the user's text.
  useEffect(() => {
    if (!data) return
    const timer = window.setTimeout(() => act().syncYaml(yamlOf(data)), YAML_SYNC_DELAY)
    return () => window.clearTimeout(timer)
  }, [data])

  // The first fill must not wait: the panel would open empty.
  useEffect(() => {
    const d = useDiagram.getState().data
    if (d && useDiagram.getState().yamlBase === '') act().syncYaml(yamlOf(d))
  }, [])

  const lines = useMemo(() => text.split('\n'), [text])
  const errors = useMemo(() => new Set(errorLines), [errorLines])

  const follow = useCallback(() => {
    const el = area.current
    if (!el) return
    if (code.current)
      code.current.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`
    if (marks.current)
      marks.current.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`
    if (gutter.current) gutter.current.style.transform = `translateY(${-el.scrollTop}px)`
  }, [])

  useEffect(follow, [follow, text, errorLines])

  // A click on an error of the import dialog: put the caret on that line and show it.
  useEffect(() => {
    const el = area.current
    if (!jump || !el) return
    const all = el.value.split('\n')
    const row = Math.max(1, Math.min(jump.line, all.length))
    let offset = 0
    for (let i = 0; i < row - 1; i++) offset += (all[i]?.length ?? 0) + 1
    const col = Math.max(0, Math.min(jump.col - 1, all[row - 1]?.length ?? 0))
    el.focus()
    el.setSelectionRange(offset + col, offset + (all[row - 1]?.length ?? col))
    const lineHeight = 18
    const top = (row - 1) * lineHeight
    if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - lineHeight * 3)
      el.scrollTop = Math.max(0, top - el.clientHeight / 3)
    follow()
  }, [jump, follow])

  const dragging = useRef<{ x: number; width: number } | null>(null)
  const onSplitDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = { x: e.clientX, width: useDiagram.getState().yamlWidth }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onSplitMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragging.current
    if (!d) return
    // The panel is on the right, so dragging left makes it wider.
    const max = Math.max(YAML_PANEL_MIN_WIDTH, window.innerWidth - 290 - 280)
    act().setYamlWidth(Math.min(max, d.width + (d.x - e.clientX)))
  }
  const onSplitUp = () => {
    dragging.current = null
  }
  const onSplitKey = (e: React.KeyboardEvent) => {
    const w = useDiagram.getState().yamlWidth
    if (e.key === 'ArrowLeft') act().setYamlWidth(w + 24)
    else if (e.key === 'ArrowRight') act().setYamlWidth(w - 24)
    else return
    e.preventDefault()
  }

  const width = useDiagram((s) => s.yamlWidth)
  const digits = String(lines.length).length

  return (
    <>
      <div
        className={styles.split}
        role="separator"
        aria-orientation="vertical"
        aria-label={t.yaml.resize}
        tabIndex={0}
        data-yaml-split
        onPointerDown={onSplitDown}
        onPointerMove={onSplitMove}
        onPointerUp={onSplitUp}
        onPointerCancel={onSplitUp}
        onKeyDown={onSplitKey}
      />
      <aside className={styles.panel} aria-label={t.yaml.panel} data-yaml-panel style={{ width }}>
        <header className={styles.head}>
          <h2 className={styles.title}>{t.yaml.title}</h2>
          <span className={styles.state} data-yaml-state={dirty ? 'dirty' : 'synced'} role="status">
            {dirty ? t.yaml.dirty : t.yaml.synced}
          </span>
          <button
            type="button"
            className={styles.btn}
            title={t.yaml.revertHint}
            disabled={!dirty}
            onClick={() => act().revertYaml()}
          >
            {t.yaml.revert}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.primary}`}
            title={t.yaml.applyHint}
            data-yaml-apply
            disabled={!dirty}
            onClick={() => void act().importFromPanel()}
          >
            {t.yaml.apply}
          </button>
          <button
            type="button"
            className={styles.btn}
            aria-label={t.yaml.close}
            title={t.yaml.close}
            onClick={() => act().closeYaml()}
          >
            ×
          </button>
        </header>
        <div className={styles.editor} style={{ ['--digits' as string]: digits }}>
          <div className={styles.gutterClip} aria-hidden="true">
            <div className={styles.gutter} ref={gutter}>
              {lines.map((_, i) => (
                <div key={i} className={errors.has(i + 1) ? styles.numError : styles.num}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.codeClip}>
            <div className={styles.marks} aria-hidden="true">
              <div className={styles.marksInner} ref={marks}>
                {errors.size > 0 &&
                  [...errors].map((line) => (
                    <div
                      key={line}
                      className={styles.errorBand}
                      data-yaml-error-line={line}
                      style={{ top: (line - 1) * 18 + 6 }}
                    />
                  ))}
              </div>
            </div>
            <pre className={styles.code} ref={code} aria-hidden="true">
              {lines.map((line, i) => (
                <Line key={i} text={line} />
              ))}
            </pre>
            <textarea
              ref={area}
              className={styles.area}
              aria-label={t.yaml.editor}
              data-yaml-editor
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              wrap="off"
              value={text}
              onChange={(e) => {
                act().setYamlText(e.target.value)
              }}
              onScroll={follow}
            />
          </div>
        </div>
      </aside>
    </>
  )
}
