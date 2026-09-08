import { type PatientRecord } from './Dashboard'

interface Props {
  patient: PatientRecord
  onClose: () => void
}

type StepState = 'done' | 'current' | 'pending'

const stepStyle: Record<StepState, { cls: string; icon: string; label: string }> = {
  done:    { cls: 'bg-ok-bg text-ok-text border-ok-border',                icon: '✓', label: 'Validée' },
  current: { cls: 'bg-clinical-light text-clinical border-clinical-border', icon: '●', label: 'En cours' },
  pending: { cls: 'bg-slate-50 text-slate-300 border-slate-200',            icon: '○', label: 'À venir' },
}

const workflowSteps = ['Planning initial', 'IRM du jour', 'Adaptation', 'Gating']

export default function SessionRecap({ patient: p, onClose }: Props) {
  const loc = p.protocole
  const done = Math.max(p.seanceCourante, 0)
  const total = p.totalSeances
  const responsable = p.dernierePar ?? p.physicien ?? '—'

  // Construction du récap par séance (mock cohérent avec l'avancement)
  const seances = Array.from({ length: Math.max(done, 1) }, (_, i) => {
    const num = i + 1
    const isPast = num < done || (num === done && p.statut === 'termine')
    const isCurrent = num === done && p.statut !== 'termine' && p.statut !== 'planification'
    const decision: 'ATP' | 'ATS' = num === 3 ? 'ATS' : 'ATP'
    const decalages = ['+1.2 · −0.8 · +1.5', '+1.8 · −1.2 · +2.1', '+2.4 · −1.6 · +3.2', '+1.4 · −0.9 · +2.0'][i] ?? '+1.5 · −1.0 · +1.8'

    // état des 4 étapes pour cette séance (Planning · IRM · Adaptation · Gating)
    const stepStates: StepState[] = isPast
      ? ['done', 'done', 'done', 'done']
      : ['done', 'done', 'current', 'pending']

    return { num, isPast, isCurrent, decision, decalages, stepStates }
  })

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-app-sidebar/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-app-bg w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col">

        {/* Header */}
        <div className="bg-app-sidebar text-white px-6 py-5 flex items-start justify-between shrink-0 sticky top-0 z-10">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">Récap des séances</div>
            <div className="text-lg font-bold">{p.nom} {p.prenom}</div>
            <div className="text-xs opacity-60 mt-0.5 font-mono">{p.id} · {loc} · {done} / {total} séances</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              title="Exporter le récap (PDF)"
              className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247" /></svg>
              PDF
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">

          {done === 0 ? (
            <div className="bg-white rounded-3xl px-6 py-8 text-center text-sm text-slate-400">
              Aucune séance réalisée pour l'instant. Le récap apparaîtra dès la première séance.
            </div>
          ) : seances.slice().reverse().map(s => (
            <div key={s.num} className="bg-white rounded-3xl overflow-hidden">
              {/* Séance header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-2xl bg-app-sidebar text-white flex items-center justify-center text-sm font-bold shrink-0">
                    S{s.num}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-slate-800">Séance {s.num}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {s.isPast ? 'Terminée' : s.isCurrent ? 'En cours' : 'Planifiée'}
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                  s.decision === 'ATS' ? 'bg-clinical-light text-clinical border-clinical-border' : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>{s.decision}</span>
              </div>

              {/* Récap des étapes */}
              <div className="px-5 py-4 border-b border-slate-50">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Étapes du workflow</div>
                <div className="flex flex-col gap-2">
                  {workflowSteps.map((label, i) => {
                    const st = s.stepStates[i]
                    // La 1re séance seule refait le planning initial ; les suivantes le conservent
                    const skipped = s.num > 1 && i === 0
                    const style = stepStyle[st]
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 border ${skipped ? 'bg-slate-50 text-slate-300 border-slate-200' : style.cls}`}>
                          {skipped ? '–' : style.icon}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 flex-1">{label}</span>
                        <span className="text-xs text-slate-400">
                          {skipped ? 'Acquis (séance 1)' : style.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Ce qu'on a — données de la séance */}
              <div className="px-5 py-4 border-b border-slate-50">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Données disponibles</div>
                <div className="grid grid-cols-2 gap-2">
                  <Data label="IRM du jour (IRMj)" value="Chargée" ok />
                  <Data label="Recalage IRMj/IRMref" value="Calculé" ok />
                  <Data label="Décalages (Δx·Δy·Δz)" value={`${s.decalages} mm`} mono />
                  <Data label="Décision clinique" value={s.decision} />
                  {s.decision === 'ATS' && <Data label="RTSSj / RTPj / RTDosej" value="Importés" ok />}
                  <Data label="Dose cumulée" value={s.num > 1 ? 'Mise à jour' : 'Initialisée'} ok />
                </div>
              </div>

              {/* Traçabilité */}
              <div className="px-5 py-4 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Traçabilité</div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-5 h-5 rounded-full bg-clinical text-white flex items-center justify-center text-xs shrink-0">
                    {responsable.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                  Étapes avancées par <strong className="text-slate-700">{responsable}</strong>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">{s.isPast ? p.dernierSeanceDate : 'en cours'}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Historique global du dossier */}
          {p.historique && p.historique.length > 0 && (
            <div className="bg-white rounded-3xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="text-sm font-bold text-slate-800">Journal de traçabilité</div>
                <div className="text-xs text-slate-400 mt-0.5">Historique complet du dossier</div>
              </div>
              <div className="divide-y divide-slate-50">
                {p.historique.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-clinical shrink-0" />
                    <span className="text-xs font-semibold text-slate-700 flex-1">{h.etape}</span>
                    <span className="text-xs text-slate-500">{h.par}</span>
                    <span className="text-xs text-slate-300 font-mono">{h.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-slate-400 italic text-center pb-2">
            Dose reconstruite — non délivrée · Outil d'aide à la décision uniquement
          </div>
        </div>
      </div>
    </div>
  )
}

function Data({ label, value, ok, mono }: { label: string; value: string; ok?: boolean; mono?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-2xl px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-xs font-semibold mt-0.5 ${ok ? 'text-ok-text' : 'text-slate-700'} ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}
