import { type PatientRecord } from '../Dashboard'

interface Props {
  patient: PatientRecord
  sessionNum: number
}

export default function StepGating({ sessionNum }: Props) {
  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">

      {/* Header */}
      <div className="bg-gating rounded-3xl px-6 py-5 text-white flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Étape 4 · Séance {sessionNum}</div>
          <div className="text-xl font-bold">Gating</div>
          <div className="text-sm opacity-80 mt-1">Traitement asservi au mouvement — délivrance sous surveillance</div>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-bold mt-1 bg-white/20 text-white">À définir</span>
      </div>

      {/* Placeholder — contenu à définir */}
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-800">Contenu à définir</div>
          <div className="text-xs text-slate-400 mt-0.5">Cette étape sera précisée ultérieurement</div>
        </div>
        <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gating-light border border-gating-border flex items-center justify-center">
            <svg className="w-7 h-7 text-gating" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          </div>
          <div className="text-sm font-semibold text-slate-600">Étape Gating</div>
          <div className="text-xs text-slate-400 max-w-sm leading-relaxed">
            L'espace est réservé pour le suivi du traitement asservi (gating respiratoire / positionnel).
            Le détail des données et des actions sera défini prochainement.
          </div>
        </div>
      </div>
    </div>
  )
}
