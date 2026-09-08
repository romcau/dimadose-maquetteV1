import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { dossier, referentielsDisponibles } from '../../data'
import { fmt, fmtSigne, type Voie } from '../../logic'
import { useDossier } from '../../store'

interface Props {
  canDecide: boolean
  canUpload: boolean
  onGoToDecision: () => void
}

type FileStatus = 'missing' | 'uploading' | 'done'

const confianceStyle: Record<string, string> = {
  haute:   'bg-ok-bg text-ok-text border border-ok-border',
  moyenne: 'bg-warn-bg text-warn-text border border-warn-border',
  faible:  'bg-danger-bg text-danger-text border border-danger-border',
}

export default function StepIRM({ canDecide, canUpload, onGoToDecision }: Props) {
  const d = useDossier()
  const n = d.seanceCourante
  const seance = d.seance(n)
  const reco = d.recommandation

  const [irmjStatus, setIrmjStatus] = useState<FileStatus>('missing')
  const [regStatus, setRegStatus] = useState<FileStatus>('missing')
  const inputRef = useRef<HTMLInputElement>(null)
  const regInputRef = useRef<HTMLInputElement>(null)

  const premiereSeance = n <= 1
  const historique = d.seances.filter(s => s.numero < n && s.realisee)
  const regDone = regStatus === 'done'
  const decision = seance.voie

  const upload = (setter: (s: FileStatus) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    setter('uploading')
    setTimeout(() => setter('done'), 800)
    e.target.value = ''
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">

      {/* ── En-tête ── */}
      <div className="bg-app-sidebar rounded-3xl px-6 py-5 text-white">
        <div className="text-xs font-semibold opacity-60 uppercase tracking-widest mb-1">
          Étape 2 · Séance {n} / {dossier.nbSeances}
        </div>
        <div className="text-xl font-bold">IRM du jour</div>
        <div className="text-sm opacity-70 mt-1">Acquisition · Recalage rigide · Décision clinique ATP / ATS</div>
      </div>

      {/* ── Référentiel de sommation ── */}
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-800">IRM de référence (IRMref)</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Référentiel unique de toutes les sommations. Il n'est jamais modifié en cours de
            traitement : les sommations ne chaînent donc pas les erreurs de recalage.
          </div>
        </div>
        <div className="p-4">
          {premiereSeance ? (
            <div className="flex items-center gap-2 bg-clinical-light border border-clinical-border rounded-2xl px-4 py-3">
              <span className="text-xs text-slate-500">Référence active :</span>
              <span className="text-xs font-bold text-clinical font-mono">{d.irmrefLabel}</span>
              <span className="ml-auto text-xs text-slate-400">à figer avant la première sommation</span>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {referentielsDisponibles.map(opt => (
                  <button
                    key={opt.id}
                    disabled={!canUpload || d.cumul.seancesIncluses.length > 0}
                    title={
                      d.cumul.seancesIncluses.length > 0
                        ? 'Verrouillé : des séances ont déjà été sommées sur ce référentiel'
                        : opt.sub
                    }
                    onClick={() => d.setIrmref(opt.id)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium border transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                      d.irmref === opt.id
                        ? 'bg-clinical text-white border-clinical'
                        : 'bg-slate-50 text-slate-500 border-slate-200 enabled:hover:border-clinical/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Le référentiel est un paramètre affiché, pas une constante : si l'étape de
                planification préalable disparaît, la première séance devient la référence.
                <span className="text-clinical"> [point non arrêté]</span>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">

        {/* ── Données de la séance ── */}
        <div className="bg-white rounded-3xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-sm font-bold text-slate-800">Données de la séance</div>
            <div className="text-xs text-slate-400 mt-0.5">Acquisition et recalage à charger</div>
          </div>
          <div className="p-4 flex flex-col gap-1">

            <WorkflowAction
              num="1" tool="IRM Unity" toolColor="bg-violet-100 text-violet-700"
              title="Acquisition IRM du jour (IRMj)"
              detail="Acquérir l'IRMj sur la console machine, puis la charger dans DIMADOSE."
            >
              <div className="mt-2">
                {irmjStatus === 'missing' && canUpload && (
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="text-xs px-3 py-1.5 bg-clinical text-white rounded-xl font-semibold hover:bg-clinical-mid transition-colors"
                  >
                    Charger IRMj
                  </button>
                )}
                {irmjStatus === 'missing' && !canUpload && (
                  <span className="text-xs text-slate-400 italic">Lecture seule — IRMj non chargée</span>
                )}
                {irmjStatus === 'uploading' && (
                  <span className="text-xs text-clinical font-medium animate-pulse">Chargement IRMj…</span>
                )}
                {irmjStatus === 'done' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-ok-bg text-ok-text border border-ok-border px-2.5 py-1 rounded-full font-medium">
                      IRMj chargée
                    </span>
                    {canUpload && (
                      <button
                        onClick={() => { setIrmjStatus('missing'); setRegStatus('missing') }}
                        className="text-xs text-slate-300 hover:text-danger transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}
              </div>
            </WorkflowAction>

            <WorkflowAction
              num="2" tool="TPS Monaco" toolColor="bg-blue-100 text-blue-700"
              title="Recalage IRMj / IRMref (Reg)"
              detail="Charger le recalage rigide produit dans Monaco. Il porte les décalages Δx, Δy, Δz — et, en ATP, le décalage de table appliqué."
              last
            >
              <div className="mt-2">
                {irmjStatus !== 'done' ? (
                  <span className="text-xs text-slate-400 italic">En attente de l'IRMj…</span>
                ) : regStatus === 'missing' && canUpload ? (
                  <button
                    onClick={() => regInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 bg-clinical-light text-clinical border border-clinical-border rounded-xl font-semibold hover:bg-clinical hover:text-white transition-all"
                  >
                    Charger Reg IRMj/IRMref
                  </button>
                ) : regStatus === 'missing' && !canUpload ? (
                  <span className="text-xs text-slate-400 italic">Lecture seule — recalage non chargé</span>
                ) : regStatus === 'uploading' ? (
                  <span className="text-xs text-clinical font-medium animate-pulse">Chargement du recalage…</span>
                ) : (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {reco.decalages.map(dec => (
                        <div
                          key={dec.axe}
                          title={`Moyenne S1–S${n - 1} : ±${fmt(dec.moyenne, 1)} mm`}
                          className={`rounded-xl p-2.5 border text-center ${
                            dec.inhabituel ? 'bg-warn-bg border-warn-border' : 'bg-clinical-light border-clinical-border'
                          }`}
                        >
                          <div className="text-xs text-slate-500 font-medium mb-0.5">Δ{dec.axe}</div>
                          <div className={`text-lg font-bold font-mono leading-none ${
                            dec.inhabituel ? 'text-warn' : 'text-clinical'
                          }`}>
                            {fmtSigne(dec.valeur, 1)}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">mm</div>
                        </div>
                      ))}
                    </div>
                    {historique.length > 0 && (
                      <div className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-1.5">
                        Moyennes S1–S{n - 1} :{' '}
                        {reco.decalages.map(dec => `Δ${dec.axe} ±${fmt(dec.moyenne, 1)}`).join(' · ')} mm
                      </div>
                    )}
                  </div>
                )}
              </div>
            </WorkflowAction>
          </div>
        </div>

        {/* ── Aide à la décision ── */}
        <div className="flex flex-col gap-4">

          {historique.length > 0 && (
            <div className="bg-white rounded-3xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="text-sm font-bold text-slate-800">Historique S1–S{n - 1}</div>
                <div className="text-xs text-slate-400 mt-0.5">Voie retenue, verdicts et confiance de chaque séance</div>
              </div>
              <div className="p-4 flex flex-col gap-1.5">
                {historique.map(s => (
                  <div key={s.numero} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-2xl">
                    <span className="text-xs font-bold text-slate-500 w-6 shrink-0">S{s.numero}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      s.voie === 'ATS'
                        ? 'bg-clinical-light text-clinical border border-clinical-border'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {s.voie}
                    </span>
                    <span className="text-xs text-slate-400 font-mono flex-1">
                      {s.mesures.decalages.map(v => fmtSigne(v, 1)).join(' · ')} mm
                    </span>
                    {!s.incluse && (
                      <span className="text-xs text-slate-400 italic">exclue</span>
                    )}
                    <span
                      title={s.confiance.motifs.join(' · ')}
                      className={`text-xs px-2 py-0.5 rounded-full cursor-help ${confianceStyle[s.confiance.niveau]}`}
                    >
                      {s.confiance.niveau}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommandation */}
          <div className={`rounded-3xl overflow-hidden border-2 transition-all bg-white ${
            regDone ? 'border-clinical' : 'border-slate-200'
          }`}>
            <div className={`px-5 py-4 border-b ${regDone ? 'border-clinical/20 bg-clinical-light' : 'border-slate-100'}`}>
              <div className="text-sm font-bold text-slate-800">Recommandation DIMADOSE</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {regDone
                  ? `Cumul reconstruit S1–S${n - 1} · ${d.cumul.seancesIncluses.length} séance(s) incluse(s)`
                  : 'Disponible après le recalage IRMj / IRMref'}
              </div>
            </div>

            {!regDone ? (
              <div className="p-5 flex items-center justify-center h-24 text-xs text-slate-400 italic text-center">
                Les décalages du jour manquent encore : sans eux, la recommandation resterait
                incomplète.
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-3">
                <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
                  reco.voie === 'ATS' ? 'bg-warn-bg border-warn-border' : 'bg-ok-bg border-ok-border'
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${
                      reco.voie === 'ATS' ? 'text-warn-text' : 'text-ok-text'
                    }`}>
                      Adaptation recommandée
                    </div>
                    <div className={`text-lg font-bold ${reco.voie === 'ATS' ? 'text-warn-text' : 'text-ok-text'}`}>
                      {reco.voie} — {reco.voie === 'ATS' ? 'Adapt To Shape' : 'Adapt To Position'}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 truncate" title={reco.justifications[0]?.detail}>
                      {reco.justifications[0]?.titre ?? 'Aucun critère déclenché'}
                      {reco.justifications.length > 1 && ` · +${reco.justifications.length - 1} autre(s) critère(s)`}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${confianceStyle[reco.confiance]}`}>
                    Confiance {reco.confiance}
                  </span>
                </div>

                <div className="flex items-center justify-between px-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Décision clinique</div>
                  <button onClick={onGoToDecision} className="text-xs text-clinical hover:underline">
                    Analyse complète →
                  </button>
                </div>

                {canDecide ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(['ATP', 'ATS'] as Voie[]).map(v => (
                      <button
                        key={v}
                        onClick={() => d.enregistrerVoie(n, v, v === reco.voie ? undefined : ['Décision prise en séance'])}
                        className={`flex flex-col items-start px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                          decision === v
                            ? v === 'ATS' ? 'bg-clinical-light border-clinical' : 'bg-ok-bg border-ok'
                            : 'bg-slate-50 border-slate-200 hover:border-clinical/40'
                        }`}
                      >
                        <div className={`text-sm font-bold ${
                          decision === v ? (v === 'ATS' ? 'text-clinical' : 'text-ok-text') : 'text-slate-700'
                        }`}>
                          {v}
                          {v === reco.voie && (
                            <span className="text-xs font-normal text-slate-400 ml-1.5">recommandé</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 leading-tight">
                          {v === 'ATP' ? 'Décalage de table, plan de référence' : 'Recontourer + réoptimiser'}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-500">
                    {decision
                      ? <>Décision retenue : <strong className="text-slate-700">{decision}</strong> — validée par le radiothérapeute.</>
                      : 'La décision ATP / ATS doit être validée par le radiothérapeute.'}
                  </div>
                )}

                {decision && decision !== reco.voie && (
                  <div className="text-xs text-warn-text bg-warn-bg border border-warn-border rounded-2xl px-3 py-2">
                    Recommandation {reco.voie} non suivie — motif enregistré pour la traçabilité.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <input ref={inputRef} type="file" accept=".dcm,.zip,.nii" className="hidden" onChange={upload(setIrmjStatus)} />
      <input ref={regInputRef} type="file" accept=".dcm,.zip,.nii" className="hidden" onChange={upload(setRegStatus)} />
    </div>
  )
}

/* ── Ligne d'action du workflow ── */
function WorkflowAction({
  num,
  tool,
  toolColor,
  title,
  detail,
  last,
  children,
}: {
  num: string
  tool: string
  toolColor: string
  title: string
  detail: string
  last?: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-6 h-6 rounded-full bg-clinical/10 text-clinical flex items-center justify-center text-xs font-bold shrink-0">
          {num}
        </div>
        {!last && <div className="w-px flex-1 bg-slate-100 my-1 min-h-[12px]" />}
      </div>
      <div className={`flex-1 min-w-0 ${!last ? 'pb-3' : ''}`}>
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-xs font-semibold text-slate-800">{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${toolColor}`}>{tool}</span>
        </div>
        <div className="text-xs text-slate-400 leading-relaxed">{detail}</div>
        {children}
      </div>
    </div>
  )
}
