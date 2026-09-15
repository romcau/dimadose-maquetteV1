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

      {/* Situer la suite : le moment A n'appartient pas au workflow en séance */}
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-800">Et après la séance ?</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Ce qui suit ne se passe pas dans la salle, mais entre deux séances
          </div>
        </div>
        <div className="p-5 flex flex-col gap-3 text-xs text-slate-600 leading-relaxed">
          <p>
            Les quatre étapes ci-dessus sont le <strong className="text-slate-700">workflow en
            séance</strong> : le patient est installé, l'équipe travaille dans Monaco et sur la
            console. Une fois la séance délivrée, les données partent vers DIMADOSE par export
            DICOM — donc <strong className="text-slate-700">après</strong> la séance.
          </p>
          <p>
            C'est seulement à ce moment-là qu'un traitement automatique évalue la séance et met à
            jour la dose cumulée. Les courbes et les verdicts que vous avez vus en ouvrant
            « Récap de la séance » appartiennent à la <strong className="text-slate-700">validation
            inter-séance</strong> (moment A) : elle se fait hors ligne, sans contrainte de temps,
            et c'est le physicien qui la valide avant la séance suivante.
          </p>
          <div className="bg-slate-50 rounded-2xl px-4 py-3 font-mono text-slate-500">
            séance N délivrée → export DICOM → <span className="text-clinical">moment A</span> —
            évaluation et cumul → séance N+1 → <span className="text-clinical">moment B</span> —
            recommandation ATP / ATS
          </div>
          <p className="text-slate-400">
            Les quatre moments sont accessibles à tout instant depuis le bandeau
            « Aide à la décision » de la barre latérale, qui indique pour chacun quand il intervient
            et ce qu'il reste à y faire.
          </p>
        </div>
      </div>
    </div>
  )
}
