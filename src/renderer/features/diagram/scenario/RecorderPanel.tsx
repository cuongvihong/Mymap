import { useMemo, useState } from 'react'
import { dataScenarios } from '../../../../shared/diagram/flowmap/convert'
import { inheritedSteps } from '../../../../shared/diagram/recorder'
import { descendants } from '../../../../shared/diagram/scenario'
import { LIMITS, SCENARIO_TYPES } from '../../../../shared/diagram/types'
import { CloseIcon, GripIcon, TrashIcon } from '../icons'
import { diagramStrings as t } from '../strings'
import { useDiagram } from '../store/diagramStore'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import styles from './RecorderPanel.module.css'

/**
 * Panel at the lower edge of the canvas while a scenario is recorded or edited (SCR-07, FR-KB-03,
 * FR-KB-07). Blocks clicked on the map become steps; here they get notes, a new order, or go away.
 */
export function RecorderPanel() {
  const recorder = useDiagram((s) => s.recorder)
  const data = useDiagram((s) => s.data)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const act = useDiagram.getState

  const tree = useMemo(() => (data ? dataScenarios(data) : []), [data])
  const draft = recorder?.draft
  const inherited = useMemo(() => (draft ? inheritedSteps(tree, draft) : []), [tree, draft])
  const parents = useMemo(() => {
    if (!data || !draft) return []
    const banned = new Set<number>(
      draft.scenarioId === null
        ? []
        : [draft.scenarioId, ...(descendants(tree, draft.scenarioId) as number[])]
    )
    return data.scenarios.filter((s) => !banned.has(s.id))
  }, [data, draft, tree])

  if (!recorder || !draft || !data) return null
  const editing = draft.scenarioId !== null
  const current = editing ? data.scenarios.find((s) => s.id === draft.scenarioId) : undefined
  const nodeOf = (id: number) => data.nodes.find((n) => n.id === id)
  const base = inherited.length
  const branch = draft.parentId !== null

  return (
    <section
      className={styles.panel}
      aria-label={t.scenario.panelLabel}
      data-recorder
      data-editing={editing}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !recorder.confirmCancel) {
          // preventDefault: the dialog that opens now must not take this same Esc as its own cancel.
          e.preventDefault()
          e.stopPropagation()
          act().requestCancelRecording()
        }
      }}
    >
      <header className={styles.head}>
        <h2>
          {editing
            ? t.scenario.editingTitle.replace('{key}', current?.key ?? '')
            : t.scenario.recordingTitle}
        </h2>
        <div className={styles.seg} role="group" aria-label={t.scenario.type}>
          {SCENARIO_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={draft.type === type}
              data-record-type={type}
              onClick={() => act().setDraftMeta({ type })}
            >
              <i style={{ background: `var(--dg-s-${type})` }} />
              {t.scenarioType[type]}
            </button>
          ))}
        </div>
        <input
          className={styles.name}
          value={draft.title}
          maxLength={LIMITS.title}
          placeholder={t.scenario.namePlaceholder}
          aria-label={t.scenario.name}
          data-record-title
          onChange={(e) => act().setDraftMeta({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void act().saveRecording()
          }}
        />
        <label className={styles.parent}>
          <span>{t.scenario.parent}</span>
          <select
            value={draft.parentId ?? ''}
            disabled={editing}
            data-record-parent
            onChange={(e) =>
              act().setDraftMeta({
                parentId: e.target.value === '' ? null : Number(e.target.value)
              })
            }
          >
            <option value="">{t.scenario.noParent}</option>
            {parents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.key} {s.title}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.btn}
          disabled={recorder.step === null}
          title={t.scenario.branchHint}
          data-record-branch
          onClick={() => recorder.step !== null && void act().branchFromStep(recorder.step)}
        >
          {t.scenario.branchHere}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.primary}`}
          data-record-done
          onClick={() => void act().saveRecording()}
        >
          {t.scenario.done}
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t.scenario.cancel}
          title={t.scenario.cancel}
          data-record-cancel
          onClick={() => act().requestCancelRecording()}
        >
          <CloseIcon size={14} />
        </button>
      </header>

      {recorder.problem && (
        <p className={styles.problem} role="alert" data-record-problem={recorder.problem}>
          {t.scenario.problem[recorder.problem]}
        </p>
      )}

      <ol className={styles.steps} aria-label={t.scenario.steps}>
        {inherited.length > 0 && (
          <li className={styles.inherited} data-record-inherited={inherited.length}>
            <span>{t.scenario.inherited.replace('{n}', String(inherited.length))}</span>
            <span className={styles.inheritedList}>
              {inherited.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={recorder.step === i ? styles.chipOn : styles.chip}
                  onClick={() => act().selectDraftStep(i)}
                >
                  {nodeOf(s.nodeId as number)?.code ?? '?'}
                </button>
              ))}
            </span>
          </li>
        )}
        {draft.steps.map((step, i) => {
          const node = nodeOf(step.nodeId)
          const index = base + i
          return (
            <li
              key={`${i}-${step.nodeId}`}
              className={`${styles.step} ${recorder.step === index ? styles.stepOn : ''} ${over === i && dragFrom !== i ? styles.stepOver : ''}`}
              data-record-step={i + 1}
              onClick={() => act().selectDraftStep(index)}
              onDragOver={(e) => {
                if (dragFrom === null) return
                e.preventDefault()
                setOver(i)
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault()
                const from = dragFrom
                setDragFrom(null)
                setOver(null)
                if (from !== null && from !== i) act().moveDraftStep(from, i)
              }}
            >
              <div className={styles.stepHead}>
                <span
                  className={styles.grip}
                  draggable
                  title={t.scenario.dragStep.replace('{n}', String(index + 1))}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(i))
                    e.dataTransfer.effectAllowed = 'move'
                    setDragFrom(i)
                  }}
                  onDragEnd={() => {
                    setDragFrom(null)
                    setOver(null)
                  }}
                >
                  <GripIcon size={12} />
                </span>
                <b className={styles.num}>{index + 1}</b>
                <span className={styles.code} title={node?.title}>
                  {node?.code ?? '?'}
                </span>
                {branch && i === 0 && <span className={styles.fork}>{t.scenario.forkBadge}</span>}
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={t.scenario.removeStep.replace('{n}', String(index + 1))}
                  data-record-remove={i + 1}
                  onClick={(e) => {
                    e.stopPropagation()
                    act().removeDraftStep(i)
                  }}
                >
                  <TrashIcon size={12} />
                </button>
              </div>
              <div className={styles.stepTitle}>{node?.title}</div>
              <input
                value={step.note}
                maxLength={LIMITS.stepNote}
                placeholder={t.scenario.stepNotePlaceholder}
                aria-label={t.scenario.stepNote.replace('{n}', String(index + 1))}
                data-record-note={i + 1}
                onFocus={() => act().selectDraftStep(index)}
                onChange={(e) => act().setDraftNote(i, e.target.value)}
              />
            </li>
          )
        })}
        {draft.steps.length === 0 && (
          <li className={styles.empty}>{branch ? t.scenario.emptyBranch : t.scenario.emptyRoot}</li>
        )}
      </ol>

      {recorder.confirmCancel && (
        <ConfirmDialog
          title={t.scenario.cancelTitle}
          onClose={() => act().resumeRecording()}
          actions={[
            { label: t.scenario.keepRecording, onClick: () => act().resumeRecording() },
            { label: t.scenario.discard, kind: 'danger', onClick: () => act().cancelRecording() }
          ]}
        >
          {t.scenario.cancelAsk}
        </ConfirmDialog>
      )}
    </section>
  )
}
