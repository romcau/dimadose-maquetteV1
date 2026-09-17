import { type PatientRecord } from './Dashboard'
import { useDossier } from '../store'
import { etatsMoments, type MomentId } from '../logic'
import { versionCourte, versionDetaillee } from '../version'

export type Page = 'step-1' | 'step-2' | 'step-3' | 'step-4'

interface Props {
  patient: PatientRecord
  current: Page
  onChange: (p: Page) => void
  validatedSteps: Set<Page>
  onOpenDicom?: () => void
  /** Ouvre l'un des quatre moments de l'aide à la décision. */
  onOpenMoment?: (id: MomentId) => void
}

const workflowSteps: { id: Page; num: string; label: string; sub: string; gating?: boolean }[] = [
  { id: 'step-1', num: '1', label: 'Planning initial',  sub: 'Une seule fois · verrouillé'   },
  { id: 'step-2', num: '2', label: 'IRM du jour',       sub: 'Acquisition · Recalage' },
  { id: 'step-3', num: '3', label: 'Adaptation',        sub: 'ATP / ATS · Cumul dose'  },
  { id: 'step-4', num: '4', label: 'Gating',            sub: 'Traitement asservi', gating: true },
]

export default function Sidebar({
  patient: p,
  current,
  onChange,
  validatedSteps = new Set(),
  onOpenDicom,
  onOpenMoment,
}: Props) {
  const currentIdx  = workflowSteps.findIndex(s => s.id === current)
  const d = useDossier()

  // Les alertes sont dérivées du cumul, jamais saisies : elles suivent donc les
  // décisions prises dans les écrans A à D.
  const alertes = d.alertes.filter(a => a.niveau === 'danger' || a.niveau === 'warn').slice(0, 2)

  // Le numéro de séance vient du dossier ouvert, pas de la fiche patient : les
  // deux restent ainsi d'accord quand on enchaîne sur la séance suivante.
  const seance = d.seanceCourante

  const moments = etatsMoments(d.seances, d.recommandation, seance, p.totalSeances)

  const identite = d.identite(p)

  // Le dossier patient a avancé, mais le workflow de la séance suivante n'est
  // pas encore ouvert : les deux numéros diffèrent légitimement.
  const seanceTerminee = p.seanceCourante > seance

  return (
    <aside className="w-56 bg-app-sidebar flex flex-col shrink-0 overflow-y-auto">

      {/* Patient card */}
      <div className="mx-3 mt-3 mb-2 bg-white/8 rounded-2xl p-4 border border-white/8">
        <div className="font-bold text-white text-sm leading-tight">{identite.libelle}</div>
        <div className="text-xs font-mono text-white/40 mt-0.5">{identite.identifiant}</div>
        <div className="text-xs text-white/50 mt-1">{p.protocole}</div>
        <div className="text-xs text-white/40">{p.prescription}</div>

        {/* §6 : le référentiel de sommation doit être explicite dans l'en-tête du dossier */}
        <div
          className="mt-2 flex items-baseline gap-1.5 text-xs cursor-help"
          title="Référentiel de toutes les sommations. Il doit rester le même sur l'ensemble du protocole ; il se change à l'étape « IRM du jour »."
        >
          <span className="text-white/30">IRMref</span>
          <span className="font-mono text-clinical truncate">{d.irmrefLabel}</span>
        </div>

        {/* Session progress */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-0.5 flex-1">
            {Array.from({ length: p.totalSeances }).map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full ${
                i < seance - 1 ? 'bg-ok' :
                // Sur le fond sombre de la barre, le bleu de la marque
                // disparaîtrait : c'est le bleu clair du logo qui ressort.
                i === seance - 1 ? 'bg-marque-cyan' : 'bg-white/10'
              }`} />
            ))}
          </div>
          <span className="text-xs font-mono text-white/50 shrink-0">
            S{seance}/{p.totalSeances}
          </span>
        </div>

        {/* La fiche patient peut être en avance sur le dossier ouvert : la séance
            est délivrée, celle d'après n'est pas encore lancée. Le dire évite de
            croire à une incohérence entre la liste et l'écran. */}
        {seanceTerminee && (
          <div className="mt-1.5 text-xs text-white/40 leading-snug">
            Séance {seance} délivrée — séance {p.seanceCourante} à lancer
          </div>
        )}
        <div className="hidden">
        </div>

        {alertes.map((a, i) => (
          <div
            key={i}
            className={`mt-2 text-xs px-2 py-1.5 rounded-xl leading-snug border ${
              a.niveau === 'danger'
                ? 'text-danger-text bg-danger-bg border-danger-border'
                : 'text-warn-text bg-warn-bg border-warn-border'
            }`}
          >
            {a.texte}
          </div>
        ))}
      </div>

      {/* Workflow steps */}
      <div className="flex-1 px-3 py-2">
        <div className="px-2 py-1.5 text-xs font-semibold text-white/30 uppercase tracking-wider mb-1">
          Workflow clinique
        </div>

        <div className="flex flex-col gap-0.5">
          {workflowSteps.map((step, idx) => {
            const isCurrent   = current === step.id
            const isDone      = validatedSteps.has(step.id)
            const isAccessible = idx <= currentIdx + 1 || isDone
            const isPending   = !isDone && !isCurrent && idx > currentIdx

            return (
              <button
                key={step.id}
                onClick={() => onChange(step.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isCurrent
                    ? 'bg-clinical/25 ring-1 ring-clinical/30'
                    : 'hover:bg-white/6'
                }`}
              >
                {/* Number badge */}
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  isDone
                    ? 'bg-ok text-white'
                    : isCurrent
                    ? (step.gating ? 'bg-gating text-white' : 'bg-clinical text-white')
                    : isPending
                    ? 'bg-white/8 text-white/25'
                    : (step.gating ? 'bg-gating/60 text-white/70' : 'bg-clinical/60 text-white/70')
                }`}>
                  {isDone ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : step.num}
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-semibold truncate ${
                    isCurrent ? 'text-white' :
                    isPending ? 'text-white/25' : 'text-white/65'
                  }`}>
                    {step.label}
                  </div>
                  <div className={`text-xs truncate mt-0.5 ${
                    isCurrent ? 'text-white/50' :
                    isPending ? 'text-white/15' : 'text-white/30'
                  }`}>
                    {step.sub}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Les quatre moments ──
          §3 du brief : quatre instants distincts, pas des onglets. On les situe
          dans le temps et on dit ce qui s'y joue, pour ne pas tomber dessus par
          hasard depuis une étape du workflow. */}
      <div className="px-3 pb-2">
        <div className="px-2 py-1.5 text-xs font-semibold text-white/30 uppercase tracking-wider mb-1">
          Aide à la décision
        </div>
        <div className="flex flex-col gap-1">
          {moments.map(m => (
            <button
              key={m.id}
              onClick={() => onOpenMoment?.(m.id)}
              title={`${m.quand} — ${m.etat}`}
              className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors hover:bg-white/8 group"
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                m.niveau === 'warn'
                  ? 'bg-warn text-white'
                  : m.niveau === 'ok'
                    ? 'bg-clinical/25 text-clinical'
                    : 'bg-white/8 text-white/35'
              }`}>
                {m.tag}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white/75 group-hover:text-white truncate">
                  {m.label}
                </div>
                <div className="text-white/30 truncate" style={{ fontSize: '10px' }}>{m.quand}</div>
                <div className={`truncate mt-0.5 ${
                  m.niveau === 'warn' ? 'text-warn' : 'text-white/25'
                }`} style={{ fontSize: '10px' }}>
                  {m.etat}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* DICOM shortcut */}
      <div className="px-3 pb-2">
        <button
          onClick={onOpenDicom}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all bg-white/6 hover:bg-white/10 border border-white/8"
        >
          <div className="w-7 h-7 rounded-lg bg-clinical/20 text-clinical flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white/80 truncate">Dossier DICOM</div>
            <div className="text-xs text-white/30 truncate mt-0.5">Tous les fichiers chargés</div>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/8 flex flex-col gap-1">
        <div className="text-xs text-white/20 italic leading-snug">
          Dose reconstruite — non délivrée
        </div>
        <div className="text-xs text-white/20 font-mono cursor-help" title={versionDetaillee()}>
          {versionCourte()}
        </div>
      </div>
    </aside>
  )
}
