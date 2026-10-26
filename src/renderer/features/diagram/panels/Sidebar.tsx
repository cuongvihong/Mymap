import { useId, useMemo, useState, type ReactNode } from 'react'
import { ChevronIcon, CopyIcon, PencilIcon, PlayIcon, PlusIcon, TrashIcon } from '../icons'
import { diagramStrings as t } from '../strings'
import { fullDocPath } from './DetailPanel'
import { reqCoverage } from '../../../../shared/diagram/channels'
import { blockSpec } from '../../../../shared/diagram/radialMenus'
import { fixMatches } from '../../../../shared/diagram/search'
import type { NodeType } from '../../../../shared/diagram/types'
import { PALETTE_MIME, useDiagram, type BlockSpec } from '../store/diagramStore'
import { buildSidebarModel, type SidebarModel } from './sidebarModel'
import styles from './Sidebar.module.css'

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        <button
          type="button"
          className={styles.headingButton}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={`${open ? t.sidebar.collapse : t.sidebar.expand}: ${title}`}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{title}</span>
          <span className={open ? styles.chevronOpen : styles.chevron}>
            <ChevronIcon />
          </span>
        </button>
      </h2>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  )
}

function viaClass(via: string): string | undefined {
  if (via === 'db') return styles.legendDash
  if (via === 'impl') return styles.legendDot
  return undefined
}

const PALETTE: { id: string; type: NodeType | 'group'; label: string }[] = [
  { id: 'fnc', type: 'fnc', label: t.nodeType.fnc },
  { id: 'req', type: 'req', label: t.nodeType.req },
  { id: 'tech', type: 'tech', label: t.nodeType.tech },
  { id: 'ext', type: 'ext', label: t.nodeType.ext },
  { id: 'cond', type: 'cond', label: t.nodeType.cond },
  { id: 'note', type: 'note', label: t.nodeType.note },
  { id: 'start', type: 'start', label: t.nodeType.start },
  { id: 'end', type: 'end', label: t.nodeType.end },
  { id: 'group', type: 'group', label: t.sidebar.paletteGroup }
]

function paletteSpec(item: (typeof PALETTE)[number]): BlockSpec {
  if (item.type === 'group') return { type: 'group' }
  if (item.type === 'start' || item.type === 'end') {
    return blockSpec('startend', item.type) ?? { type: item.type }
  }
  const spec = blockSpec(item.id, null)
  return spec ?? { type: item.type }
}

const EMPTY_MODEL: SidebarModel = {
  fsDocs: [],
  scenarios: [],
  blocks: [],
  channels: [],
  nodeTypes: []
}

/** Left panel, 290 px wide. Reads the open project from the diagram store. */
export function Sidebar() {
  const data = useDiagram((s) => s.data)
  const fsExists = useDiagram((s) => s.fsExists)
  const selected = useDiagram((s) => s.selectedScenarios)
  const playing = useDiagram((s) => s.play?.scenarioId ?? null)
  const recording = useDiagram((s) => s.recorder !== null)
  const detailId = useDiagram((s) => s.detailId)
  const filterUncovered = useDiagram((s) => s.filterUncovered)
  const [copied, setCopied] = useState<string | null>(null)
  const model = useMemo(() => (data ? buildSidebarModel(data) : EMPTY_MODEL), [data])
  const docsRoot = data?.project.docsRoot ?? null
  const uncoveredCount = useMemo(() => {
    if (!data) return 0
    const cov = reqCoverage(data.nodes, data.links)
    return data.nodes.filter((n) => n.type === 'req' && (cov.get(n.id) ?? 0) === 0).length
  }, [data])
  const fixFilter = useDiagram((s) => s.fixFilter)
  const fixCount = useMemo(
    () => (data ? fixMatches(data.nodes, fixFilter).size : 0),
    [data, fixFilter]
  )
  const act = useDiagram.getState

  const copy = (file: string) => {
    const text = fullDocPath(docsRoot, file) ?? file
    void navigator.clipboard
      .writeText(text)
      .then(() => setCopied(file))
      .catch(() => setCopied(null))
    window.setTimeout(() => setCopied((c) => (c === file ? null : c)), 1600)
  }

  return (
    <aside className={styles.sidebar} aria-label={t.sidebar.label}>
      <Section title={t.sidebar.sections.fs}>
        <div className={styles.rootRow}>
          <span className={styles.rootLabel}>{t.fs.rootLabel}</span>
          <span className={styles.rootPath} title={docsRoot ?? undefined}>
            {docsRoot ?? t.fs.noRoot}
          </span>
          <button
            type="button"
            className={styles.importButton}
            onClick={() => void act().pickDocsRoot()}
          >
            {docsRoot ? t.fs.changeRoot : t.fs.pickRoot}
          </button>
        </div>
        {model.fsDocs.length === 0 && <p className={styles.empty}>{t.sidebar.emptyFs}</p>}
        <div className={styles.importRow}>
          <button
            type="button"
            className={styles.importButton}
            data-sidebar-import
            onClick={() => void act().importFromFile('merge')}
          >
            {t.sidebar.importYaml}
          </button>
        </div>
        <ul className={styles.list}>
          {model.fsDocs.map((doc) => {
            const missing = fsExists !== null && fsExists[doc.file] === false
            return (
              <li key={doc.id} className={styles.fsRow}>
                <button
                  type="button"
                  className={styles.rid}
                  title={doc.title}
                  onClick={() => act().zoomToGroup(doc.groupId)}
                >
                  {doc.id}
                </button>
                <span className={styles.fsText}>
                  <b>{doc.title}</b>
                  <span className={missing ? styles.fsMissing : undefined}>
                    {doc.file}
                    {missing && ` · ${t.fs.missing}`}
                  </span>
                </span>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`${t.fs.copyPath}: ${doc.file}`}
                  title={copied === doc.file ? t.fs.copied : t.fs.copyPath}
                  onClick={() => copy(doc.file)}
                >
                  <CopyIcon />
                </button>
              </li>
            )
          })}
        </ul>
        <span role="status" className={styles.srOnly}>
          {copied ? t.fs.copied : ''}
        </span>
      </Section>

      <Section title={t.sidebar.sections.palette}>
        <ul className={styles.palette}>
          {PALETTE.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.paletteItem}
                draggable
                data-palette={item.id}
                onDragStart={(e) => {
                  e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(paletteSpec(item)))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => act().requestAdd(paletteSpec(item))}
              >
                <i
                  className={styles.paletteBar}
                  style={{
                    background:
                      item.type === 'group' ? 'var(--dg-accent)' : `var(--dg-t-${item.type})`
                  }}
                />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.hint}>{t.sidebar.paletteHint}</p>
      </Section>

      <Section title={t.sidebar.sections.scenarios}>
        {model.scenarios.length === 0 && <p className={styles.empty}>{t.sidebar.emptyScenarios}</p>}
        <div className={styles.importRow}>
          <button
            type="button"
            className={styles.importButton}
            data-record-start
            disabled={recording || data === null}
            title={t.scenario.recordHint}
            onClick={() => act().startRecording()}
          >
            <PlusIcon size={12} /> {t.scenario.record}
          </button>
        </div>
        <ul className={styles.tree}>
          {model.scenarios.map((sc) => (
            <li
              key={sc.code}
              className={`${styles.scenario} ${selected.includes(sc.id) ? styles.scenarioOn : ''} ${playing === sc.id ? styles.scenarioPlaying : ''}`}
              style={{ paddingLeft: 6 + sc.depth * 16 }}
              data-scenario={sc.code}
              data-depth={sc.depth}
            >
              <span className={styles.dot} style={{ background: `var(--dg-s-${sc.type})` }} />
              <button
                type="button"
                className={styles.scenarioLabel}
                aria-pressed={selected.includes(sc.id)}
                onClick={(e) => act().toggleScenario(sc.id, e.ctrlKey || e.metaKey)}
              >
                <b>{sc.code}</b> {sc.title}
                <em>{sc.meta}</em>
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`${t.sidebar.play}: ${sc.code}`}
                title={t.sidebar.play}
                data-play={sc.code}
                onClick={() => act().startPlay(sc.id)}
              >
                <PlayIcon />
              </button>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.rowAction}`}
                aria-label={`${t.scenario.edit}: ${sc.code}`}
                title={t.scenario.edit}
                data-scenario-edit={sc.code}
                disabled={recording}
                onClick={() => act().editScenario(sc.id)}
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.rowAction}`}
                aria-label={`${t.scenario.remove}: ${sc.code}`}
                title={t.scenario.remove}
                data-scenario-remove={sc.code}
                onClick={() => act().requestDeleteScenario(sc.id)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.hint}>
          {t.sidebar.scenarioHintBefore} <kbd>{t.sidebar.ctrlKey}</kbd>{' '}
          {t.sidebar.scenarioHintAfter} <PlayIcon size={11} /> {t.sidebar.scenarioHintEnd}
        </p>
      </Section>

      <Section title={t.sidebar.sections.blocks} defaultOpen={false}>
        {model.blocks.length === 0 && <p className={styles.empty}>{t.sidebar.emptyBlocks}</p>}
        <ul className={styles.list}>
          {model.blocks.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className={`${styles.blockRow} ${detailId === b.id ? styles.blockOn : ''}`}
                onClick={() => act().selectNode(b.id)}
              >
                <span className={styles.typeBar} style={{ background: `var(--dg-t-${b.type})` }} />
                <span className={styles.blockText}>
                  <code>{b.code}</code>
                  <span>{b.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.sidebar.sections.channels}>
        <ul className={styles.legend}>
          {model.channels.map((via) => (
            <li key={via}>
              <i className={viaClass(via)} style={{ background: `var(--dg-v-${via})` }} />
              {t.via[via]}
            </li>
          ))}
        </ul>
        <p className={styles.hint}>{t.sidebar.legendHint}</p>
        <label className={styles.fixField}>
          <span>{t.sidebar.fixLabel}</span>
          <input
            type="search"
            value={fixFilter}
            placeholder={t.sidebar.fixPlaceholder}
            onChange={(e) => act().setFixFilter(e.target.value)}
          />
        </label>
        {fixFilter.trim() !== '' && (
          <p className={styles.hint} role="status">
            {fixCount > 0 ? t.sidebar.fixCount.replace('{n}', String(fixCount)) : t.sidebar.fixNone}
          </p>
        )}
        <div className={styles.importRow}>
          <button
            type="button"
            className={styles.importButton}
            aria-pressed={filterUncovered}
            title={t.req.filterHint}
            onClick={() => act().toggleFilterUncovered()}
          >
            {t.req.filterCount.replace('{n}', String(uncoveredCount))}
          </button>
        </div>
      </Section>

      <Section title={t.sidebar.sections.types} defaultOpen={false}>
        <ul className={styles.legend}>
          {model.nodeTypes.map((type) => (
            <li key={type}>
              <i className={styles.legendBar} style={{ background: `var(--dg-t-${type})` }} />
              {t.nodeType[type]}
            </li>
          ))}
        </ul>
      </Section>
    </aside>
  )
}
