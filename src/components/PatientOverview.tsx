import { type PatientRecord } from './Dashboard'

type Moment = 'A' | 'B' | 'C' | 'D'

interface Props {
  patient: PatientRecord
  onGoToMoment: (m: Moment) => void
}

type StepState = 'done' | 'active' | 'action' | 'pending'

interface Step {
  num: number
  title: string
  sub: string
  state: StepState
  data?: { label: string; value: string; highlight?: boolean }[]
  action?: { label: string; moment: Moment; style?: 'primary' | 'warn' }
  note?: string
}

const stateRing: Record<StepState, string> = {
  done:   'bg-slate-700 text-white',
  active: 'bg-blue-600 text-white ring-2 ring-blue-200',
  action: 'bg-warn text-white ring-2 ring-amber-200',
  pending:'bg-slate-100 text-slate-400',
}
const stateBar: Record<StepState, string> = {
  done:   'bg-slate-300',
  active: 'bg-blue-300',
  action: 'bg-amber-300',
  pending:'bg-slate-100',
}

function StepIcon({ n, state }: { n: number; state: StepState }) {
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${stateRing[state]}`}>
      {state === 'done' ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : n}
    </div>
  )
}

export default function PatientOverview({ patient: p, onGoToMoment }: Props) {
  const sessionDate = p.seanceCourante === 4 ? "Aujourd'hui — 02 Sep 2026" : `Séance ${p.seanceCourante}`

  const steps: Step[] = [
    {
      num: 1,
      title: 'Planning initial',
      sub: 'Fait une seule fois — avant la première séance',
      state: 'done',
      data: [
        { label: 'IRMref', value: 'IRMp (séance 1) — référentiel stable' },
        { label: 'Objets', value: 'IRMp · RTSSp · RTPp · RTDosep · Reg CTp–IRMp' },
        { label: 'Outil', value: 'IRM Unity + TPS Monaco' },
      ],
    },
    {
      num: 2,
      title: 'IRM du jour',
      sub: `Séance ${p.seanceCourante} — IRM acquise, recalage rigide calculé`,
      state: 'done',
      data: [
        { label: 'IRMj', value: 'Acquise — qualité à valider (inter-séance)' },
        { label: 'Δx', value: '+2,4 mm', highlight: true },
        { label: 'Δy', value: '−1,6 mm', highlight: true },
        { label: 'Δz', value: '+3,2 mm — amplitude supérieure à la moyenne S1–S3', highlight: true },
        { label: 'Outil', value: 'TSM (Marlin) + Monaco fusion' },
      ],
      note: 'Décalages Reg IRMj/IRMref — amplitude inhabituelle ce jour',
    },
    {
      num: 3,
      title: 'Décision ATP / ATS',
      sub: "DIMADOSE a analysé l'historique S1–S3 et propose une recommandation",
      state: 'action',
      data: [
        { label: 'Recommandation', value: 'ATS — adaptation complète', highlight: true },
        { label: 'Motif principal', value: 'Rectum D0.5cc : +2,4 Gy au-dessus du prévisionnel', highlight: true },
        { label: 'Marge disponible', value: 'Vessie : −2,8 Gy sous le prévisionnel' },
      ],
      action: { label: 'Voir la recommandation complète', moment: 'B', style: 'warn' },
      note: "Aucun contour du jour disponible à ce stade — décision basée sur l'historique et le recalage rigide uniquement",
    },
    {
      num: 4,
      title: 'Adaptation (si ATS retenu)',
      sub: 'Recontourer + réoptimiser le plan selon les contraintes proposées',
      state: 'pending',
      data: [
        { label: 'Contraintes S4', value: 'Rectum resserré · Vessie relâchée · Autres inchangés' },
        { label: 'Outil', value: 'TPS Monaco — AdaptPlan + contourage' },
        { label: 'Données produites', value: 'RTSSj · RTPj · RTDosej (si ATS)' },
      ],
      action: { label: 'Consulter les contraintes proposées', moment: 'C', style: 'primary' },
    },
    {
      num: 5,
      title: 'Traitement avec Gating (CMM)',
      sub: 'Irradiation avec asservissement faisceau ON/OFF selon VOICE',
      state: 'pending',
      data: [
        { label: 'Outil', value: 'TSM · IRM ciné 2D SAG/COR (bTFE)' },
        { label: 'Données gating', value: 'Non exportées — espace propriétaire Elekta' },
        { label: 'Données produites', value: 'RTPj validé → export Mosaiq' },
      ],
      note: "Les données acquises pendant l'irradiation (VOICE, ciné 2D, Δ3D temps réel) ne sont pas récupérables par DIMADOSE",
    },
  ]

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">

      {/* ── Current session banner ── */}
      <div className="bg-white border border-slate-200 rounded-sm px-5 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Séance {p.seanceCourante} / {p.totalSeances}</span>
            <span className="text-slate-200">·</span>
            <span className="text-xs font-medium text-blue-600">{sessionDate}</span>
          </div>
          <div className="font-semibold text-slate-800">{p.nom} {p.prenom}</div>
          <div className="text-sm text-slate-500 mt-0.5">{p.protocole} · {p.prescription}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Session progress */}
          <div className="flex gap-1">
            {Array.from({ length: p.totalSeances }).map((_, i) => (
              <div key={i} className={`w-6 h-2 rounded-sm ${
                i < p.seanceCourante - 1 ? 'bg-ok' :
                i === p.seanceCourante - 1 ? 'bg-blue-500' : 'bg-slate-200'
              }`} />
            ))}
          </div>
          {p.alertes.length > 0 && (
            <div className="text-xs font-semibold text-danger-text bg-danger-bg border border-danger-border px-2 py-0.5 rounded-sm">
              ▲ {p.alertes.length} alerte{p.alertes.length > 1 ? 's' : ''} dosimétrique{p.alertes.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── Workflow steps ── */}
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Workflow de la séance — Planning initial → IRM du jour → Adaptation → Gating
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {steps.map((step, i) => (
            <div key={i} className={`flex gap-4 px-5 py-4 transition-colors ${
              step.state === 'action' ? 'bg-warn-bg' :
              step.state === 'active' ? 'bg-blue-50/30' : ''
            }`}>
              {/* Left: icon + connector */}
              <div className="flex flex-col items-center gap-0 shrink-0">
                <StepIcon n={step.num} state={step.state} />
                {i < steps.length - 1 && (
                  <div className={`w-0.5 h-full mt-1 min-h-4 ${stateBar[step.state]}`} />
                )}
              </div>

              {/* Right: content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={`font-semibold text-sm ${
                      step.state === 'pending' ? 'text-slate-400' : 'text-slate-800'
                    }`}>
                      {step.title}
                    </div>
                    <div className={`text-xs mt-0.5 ${
                      step.state === 'pending' ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {step.sub}
                    </div>
                  </div>

                  {/* State badge */}
                  <div className="shrink-0">
                    {step.state === 'done' && (
                      <span className="text-xs font-medium text-ok bg-ok-bg border border-ok-border px-2 py-0.5 rounded-sm">
                        Terminé
                      </span>
                    )}
                    {step.state === 'action' && (
                      <span className="text-xs font-semibold text-warn-text bg-warn-bg border border-warn-border px-2 py-0.5 rounded-sm">
                        Action requise
                      </span>
                    )}
                    {step.state === 'active' && (
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-sm">
                        En cours
                      </span>
                    )}
                    {step.state === 'pending' && (
                      <span className="text-xs text-slate-300 border border-slate-100 px-2 py-0.5 rounded-sm">
                        En attente
                      </span>
                    )}
                  </div>
                </div>

                {/* Data points */}
                {step.data && step.state !== 'pending' && (
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                    {step.data.map((d, j) => (
                      <div key={j} className="flex items-baseline gap-2 min-w-0">
                        <span className="text-xs text-slate-400 shrink-0 w-24">{d.label}</span>
                        <span className={`text-xs font-mono truncate ${
                          d.highlight
                            ? step.state === 'action' ? 'text-warn font-semibold' : 'text-blue-600'
                            : 'text-slate-600'
                        }`}>
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {step.data && step.state === 'pending' && step.num <= 4 && (
                  <div className="mt-2 flex gap-4">
                    {step.data.slice(0, 2).map((d, j) => (
                      <span key={j} className="text-xs text-slate-300 font-mono">{d.value}</span>
                    ))}
                  </div>
                )}

                {/* Note */}
                {step.note && step.state !== 'pending' && (
                  <p className="mt-2 text-xs text-slate-400 italic">{step.note}</p>
                )}

                {/* Action button */}
                {step.action && (
                  <button
                    onClick={() => onGoToMoment(step.action!.moment)}
                    className={`mt-3 text-xs font-semibold px-4 py-2 rounded-sm transition-colors ${
                      step.action.style === 'warn'
                        ? 'bg-warn text-white hover:bg-amber-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } ${step.state === 'pending' ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                  >
                    {step.action.label} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Inter-session tools ── */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onGoToMoment('A')}
          className="bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 rounded-sm p-4 text-left transition-colors group"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Moment A — Validation inter-séance
              </div>
              <div className="text-sm font-medium text-slate-700">
                Qualité IRM · Déformation · Choix de la dose
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Valider les données de S3 avant d'intégrer la dose cumulée
              </div>
            </div>
            <span className="text-slate-300 group-hover:text-blue-400 transition-colors text-lg leading-none">→</span>
          </div>
        </button>

        <button
          onClick={() => onGoToMoment('D')}
          className="bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-sm p-4 text-left transition-colors group"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Moment D — Rapport de fin de traitement
              </div>
              <div className="text-sm font-medium text-slate-700">
                Synthèse · Frise des séances · Export PDF
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Disponible à la fin du traitement (après S5)
              </div>
            </div>
            <span className="text-slate-200 group-hover:text-slate-400 transition-colors text-lg leading-none">→</span>
          </div>
        </button>
      </div>

    </div>
  )
}
