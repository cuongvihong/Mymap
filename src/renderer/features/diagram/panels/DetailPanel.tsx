import { useEffect, useMemo, useRef, useState } from 'react'
import { dataScenarios } from '../../../../shared/diagram/flowmap/convert'
import { scenariosUsingNodes } from '../../../../shared/diagram/scenario'
import {
  LIMITS,
  VIA_TYPES,
  type LinkData,
  type NodeData,
  type ViaType
} from '../../../../shared/diagram/types'
import { CloseIcon, CopyIcon, DocIcon } from '../icons'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import { typeColor } from '../canvas/BlockNode'
import { ImageSection } from '../images/ImageSection'
import styles from './DetailPanel.module.css'

/** Absolute path shown in the panel: documents folder plus the relative file, with the folder's own separator. */
export function fullDocPath(docsRoot: string | null, file: string | null): string | null {
  if (!docsRoot || !file) return null
  const sep = docsRoot.includes('\\') ? '\\' : '/'
  const root = docsRoot.replace(/[\\/]+$/, '')
  return `${root}${sep}${file.replace(/[\\/]/g, sep)}`
}

function typeLabel(node: NodeData): string {
  const base = t.nodeType[node.type]
  return node.subtype && node.type !== 'end' ? `${base}, ${node.subtype}` : base
}

interface FormState {
  code: string
  title: string
  body: string
  fixText: string
  chips: string
  fsFile: string
  fsSection: string
}

const toForm = (n: NodeData): FormState => ({
  code: n.code,
  title: n.title,
  body: n.body,
  fixText: n.fixText,
  chips: n.chips.join(', '),
  fsFile: n.fsFile ?? '',
  fsSection: n.fsSection ?? ''
})

function EditForm({ node, onClose }: { node: NodeData; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(() => toForm(node))
  const [busy, setBusy] = useState(false)
  const set = (key: keyof FormState) => (value: string) => setForm({ ...form, [key]: value })
  const f = t.detail.fields

  const save = async () => {
    setBusy(true)
    const chips = form.chips
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    const ok = await useDiagram.getState().updateNode(node.id, {
      code: form.code.trim(),
      title: form.title.trim(),
      body: form.body,
      fixText: form.fixText,
      chips,
      fsFile: form.fsFile.trim() === '' ? null : form.fsFile.trim(),
      fsSection: form.fsSection.trim() === '' ? null : form.fsSection.trim()
    })
    setBusy(false)
    if (ok) onClose()
  }

  const field = (key: keyof FormState, label: string, max: number, area = false) => (
    <label className={styles.field}>
      <span>{label}</span>
      {area ? (
        <textarea
          value={form[key]}
          maxLength={max}
          rows={4}
          onChange={(e) => set(key)(e.target.value)}
        />
      ) : (
        <input value={form[key]} maxLength={max} onChange={(e) => set(key)(e.target.value)} />
      )}
    </label>
  )

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      {field('code', f.code, LIMITS.code)}
      {field('title', f.title, LIMITS.title)}
      {field('body', f.body, LIMITS.body, true)}
      {field('fixText', f.fix, LIMITS.fix, true)}
      {field('chips', f.chips, LIMITS.chips * (LIMITS.chip + 2))}
      {field('fsFile', f.fsFile, 260)}
      {field('fsSection', f.fsSection, LIMITS.section)}
      <div className={styles.formActions}>
        <button type="button" className={styles.btn} onClick={onClose}>
          {t.detail.cancel}
        </button>
        <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={busy}>
          {t.detail.done}
        </button>
      </div>
    </form>
  )
}

function NodeDetail({ node }: { node: NodeData }) {
  const data = useDiagram((s) => s.data)
  const fsExists = useDiagram((s) => s.fsExists)
  const selected = useDiagram((s) => s.selectedScenarios)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  const byOther = useMemo(() => {
    if (!data) return []
    const groups = new Map<number, LinkData[]>()
    for (const l of data.links) {
      if (l.fromNode !== node.id && l.toNode !== node.id) continue
      const other = l.fromNode === node.id ? l.toNode : l.fromNode
      groups.set(other, [...(groups.get(other) ?? []), l])
    }
    return [...groups.entries()].map(([otherId, links]) => ({
      other: data.nodes.find((n) => n.id === otherId),
      links
    }))
  }, [data, node])

  const scenarios = useMemo(() => {
    if (!data) return []
    const ids = new Set(scenariosUsingNodes(dataScenarios(data), [node.id]))
    return data.scenarios.filter((s) => ids.has(s.id))
  }, [data, node])

  if (!data) return null
  const path = fullDocPath(data.project.docsRoot, node.fsFile)
  const missing = node.fsFile && fsExists ? fsExists[node.fsFile] === false : false
  const channelCount = byOther.reduce((n, g) => n + g.links.length, 0)

  const copy = (text: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.kind}>
            <i style={{ background: typeColor(node) }} />
            {node.code} · {typeLabel(node)}
          </span>
          <h3>{node.title}</h3>
        </div>
        {!editing && (
          <button type="button" className={styles.btn} onClick={() => setEditing(true)}>
            {t.detail.edit}
          </button>
        )}
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t.detail.close}
          onClick={() => useDiagram.getState().closeDetail()}
        >
          <CloseIcon size={16} />
        </button>
      </header>

      <div className={styles.body}>
        {editing ? (
          <EditForm node={node} onClose={() => setEditing(false)} />
        ) : (
          <>
            {node.body && (
              <section>
                <h4>{t.detail.content}</h4>
                <p>{node.body}</p>
              </section>
            )}
            {node.fixText && (
              <section>
                <h4>{t.detail.fix}</h4>
                <p>{node.fixText}</p>
              </section>
            )}
            <ImageSection node={node} />
            <section>
              <h4>{t.detail.source}</h4>
              {node.fsFile ? (
                <div className={styles.src}>
                  <div className={styles.srcRow}>
                    <b>{node.fsFile}</b>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${missing ? styles.missing : ''}`}
                      aria-label={`${t.fs.openDoc}: ${node.fsFile}${missing ? `. ${t.fs.missing}` : ''}`}
                      title={missing ? t.fs.missing : t.fs.openDoc}
                      onClick={() => void useDiagram.getState().openFs(node.id)}
                    >
                      <DocIcon size={15} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={t.detail.copyPath}
                      title={t.detail.copyPath}
                      onClick={() => copy(path ?? node.fsFile ?? '')}
                    >
                      <CopyIcon size={15} />
                    </button>
                  </div>
                  {node.fsSection && (
                    <span className={styles.srcSection}>
                      {t.detail.section} {node.fsSection}
                    </span>
                  )}
                  {path ? (
                    <code>{path}</code>
                  ) : (
                    <span className={styles.note}>{t.detail.noDocsRoot}</span>
                  )}
                  {missing && <span className={styles.warn}>{t.fs.missing}</span>}
                  <span role="status" className={styles.copied}>
                    {copied ? t.detail.copied : ''}
                  </span>
                </div>
              ) : (
                <p className={styles.note}>{t.detail.noSource}</p>
              )}
            </section>
            <section>
              <h4>
                {t.detail.links}
                {channelCount > 0 &&
                  ` (${t.detail.linkCounts
                    .replace('{c}', String(channelCount))
                    .replace('{b}', String(byOther.length))})`}
              </h4>
              {byOther.length === 0 && <p className={styles.note}>{t.detail.noLinks}</p>}
              <div className={styles.links}>
                {byOther.map(({ other, links }) => (
                  <div key={other?.id ?? links[0]?.id} className={styles.group}>
                    {other && (
                      <button
                        type="button"
                        className={styles.goto}
                        title={t.detail.goTo}
                        onClick={() => useDiagram.getState().selectNode(other.id)}
                      >
                        {links[0]?.fromNode === node.id ? '→' : '←'} {other.title}
                      </button>
                    )}
                    {links.map((l) => (
                      <div key={l.id} className={styles.channel}>
                        <span className={styles.vtag}>
                          <i style={{ background: `var(--dg-v-${l.via})` }} />
                          {t.via[l.via]}
                        </span>
                        <span>
                          {l.label}
                          {l.note && <span className={styles.note}> {l.note}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h4>{t.detail.scenarios}</h4>
              {scenarios.length === 0 && <p className={styles.note}>{t.detail.noScenarios}</p>}
              <div className={styles.chips}>
                {scenarios.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.scn}
                    aria-pressed={selected.includes(s.id)}
                    onClick={(e) =>
                      useDiagram.getState().toggleScenario(s.id, e.ctrlKey || e.metaKey)
                    }
                  >
                    <i style={{ background: `var(--dg-s-${s.type})` }} />
                    {s.key}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  )
}

/** Panel of one selected channel: type, label and description, delete. Ends are moved by dragging the grips. */
function LinkDetail({ link }: { link: LinkData }) {
  const data = useDiagram((s) => s.data)
  const [label, setLabel] = useState(link.label)
  const [note, setNote] = useState(link.note)
  const from = data?.nodes.find((n) => n.id === link.fromNode)
  const to = data?.nodes.find((n) => n.id === link.toNode)
  const c = t.channel
  const act = useDiagram.getState
  const labelRef = useRef<HTMLInputElement>(null)
  const focusLabel = useDiagram((s) => s.labelFocusLinkId === link.id)
  // The ring item "Sửa nhãn" puts the cursor in the label field.
  useEffect(() => {
    if (!focusLabel) return
    labelRef.current?.focus()
    labelRef.current?.select()
    useDiagram.getState().focusLinkLabel(null)
  }, [focusLabel])

  const commit = (patch: { label?: string; note?: string }) => {
    const changed =
      (patch.label !== undefined && patch.label !== link.label) ||
      (patch.note !== undefined && patch.note !== link.note)
    if (changed) void act().updateLink(link.id, patch)
  }

  const end = (node: NodeData | undefined) =>
    node ? (
      <button type="button" className={styles.goto} onClick={() => act().selectNode(node.id)}>
        <code>{node.code}</code> {node.title}
      </button>
    ) : (
      <span className={styles.note}>?</span>
    )

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.kind}>
            <i style={{ background: `var(--dg-v-${link.via})` }} />
            {c.panel}
          </span>
          <h3>
            {from?.code ?? '?'} {c.arrow} {to?.code ?? '?'}
          </h3>
        </div>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t.detail.close}
          onClick={() => act().closeDetail()}
        >
          <CloseIcon size={16} />
        </button>
      </header>
      <div className={styles.body}>
        <section>
          <h4>{c.from}</h4>
          {end(from)}
        </section>
        <section>
          <h4>{c.to}</h4>
          {end(to)}
        </section>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <label className={styles.field}>
            <span>{c.via}</span>
            <select
              value={link.via}
              onChange={(e) => void act().updateLink(link.id, { via: e.target.value as ViaType })}
            >
              {VIA_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t.via[v]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>{c.label}</span>
            <input
              ref={labelRef}
              value={label}
              maxLength={LIMITS.label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => commit({ label: label.trim() })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
          </label>
          <label className={styles.field}>
            <span>{c.note}</span>
            <textarea
              value={note}
              maxLength={LIMITS.note}
              rows={4}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => commit({ note })}
            />
          </label>
        </form>
        <p className={styles.note}>{c.reconnectHint}</p>
        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => void act().removeLinks([link.id])}
          >
            {c.remove}
          </button>
        </div>
      </div>
    </>
  )
}

/** Right panel, 340 px, slides in when a block is clicked (FR-KH-07). Holds the image list (Session 07). */
export function DetailPanel() {
  const data = useDiagram((s) => s.data)
  const detailId = useDiagram((s) => s.detailId)
  const detailLinkId = useDiagram((s) => s.detailLinkId)
  const node = detailId !== null ? (data?.nodes.find((n) => n.id === detailId) ?? null) : null
  const link =
    detailLinkId !== null ? (data?.links.find((l) => l.id === detailLinkId) ?? null) : null
  const open = node !== null || link !== null
  return (
    <aside
      className={`${styles.panel} ${open ? styles.open : ''}`}
      aria-label={t.detail.label}
      aria-hidden={!open}
      inert={!open}
    >
      {node && <NodeDetail key={node.id} node={node} />}
      {!node && link && <LinkDetail key={link.id} link={link} />}
    </aside>
  )
}
