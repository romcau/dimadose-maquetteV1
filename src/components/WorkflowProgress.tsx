import { useState } from 'react'
import { type Page } from './Sidebar'

interface Props {
  current: Page
  onChange: (p: Page) => void
  completions: Record<'step-1' | 'step-2' | 'step-3' | 'step-4', number>
  collapsed?: Set<string>
  onOpenDicom?: () => void
  sessionNum?: number
  totalSeances?: number
}

const steps: {
  id: 'step-1' | 'step-2' | 'step-3' | 'step-4'
  label: string
  sub: string
  headerColor: string
  fillColor: string
  textColor: string
}[] = [
  {
    id: 'step-1',
    label: '1. Planning initial',
    sub: 'Une seule fois · verrouillé',
    headerColor: 'bg-clinical',
    fillColor: 'bg-clinical-mid',
    textColor: 'text-clinical',
  },
  {
    id: 'step-2',
    label: '2. IRM du jour',
    sub: 'Acquisition · Recalage',
    headerColor: 'bg-clinical',
    fillColor: 'bg-clinical-mid',
    textColor: 'text-clinical',
  },
  {
    id: 'step-3',
    label: '3. Adaptation',
    sub: 'ATP / ATS · Cumul dose',
    headerColor: 'bg-clinical',
    fillColor: 'bg-clinical-mid',
    textColor: 'text-clinical',
  },
  {
    id: 'step-4',
    label: '4. Gating',
    sub: 'Traitement asservi',
    headerColor: 'bg-gating',
    fillColor: 'bg-gating',
    textColor: 'text-gating',
  },
]

const completionLabel = (pct: number) => {
  if (pct === 100) return { icon: '✓', cls: 'text-ok font-bold' }
  if (pct > 0) return { icon: `${pct}%`, cls: 'text-blue-600 font-medium' }
  return { icon: '○', cls: 'text-slate-300' }
}

export default function WorkflowProgress({ current, onChange, completions, collapsed, onOpenDicom, sessionNum, totalSeances }: Props) {
  const [showAll, setShowAll] = useState(false)

  // Une étape terminée (ex. planning initial) est masquée du fil, sauf si l'on est dessus
  // ou si l'utilisateur a demandé à tout afficher via la roue dentelée.
  const isCollapsed = (id: string) => !!collapsed?.has(id) && current !== id && !showAll
  const visibleSteps = steps.filter(s => !isCollapsed(s.id))
  const hiddenCount = steps.length - visibleSteps.length
  const hasCollapsible = (collapsed?.size ?? 0) > 0

  return (
    <div className="bg-white/70 backdrop-blur-sm border-b border-white shrink-0">
      <div className="flex items-stretch">

        {/* Séance en cours */}
        {sessionNum != null && (
          <div className="flex items-center gap-2 pl-4 pr-3 shrink-0 border-r border-slate-100">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:inline">Séance</span>
            <span className="text-sm font-bold font-mono text-clinical bg-clinical-light border border-clinical-border px-2.5 py-1 rounded-xl whitespace-nowrap">
              S{sessionNum}{totalSeances ? <span className="text-slate-400 font-medium"> / {totalSeances}</span> : null}
            </span>
          </div>
        )}

        {/* Roue dentelée — afficher/masquer les étapes terminées + accès dossier DICOM */}
        {hasCollapsible && (
          <div className="flex items-center gap-1 pl-3 pr-2 shrink-0 border-r border-slate-100">
            <button
              onClick={() => setShowAll(v => !v)}
              title={showAll ? 'Masquer le planning initial terminé' : 'Afficher toutes les étapes (dont le planning initial terminé)'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                showAll ? 'bg-clinical text-white' : 'bg-slate-100 text-slate-400 hover:text-clinical hover:bg-clinical-light'
              }`}
            >
              <svg className={`w-4 h-4 transition-transform ${showAll ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {onOpenDicom && (
              <button
                onClick={onOpenDicom}
                title="Dossier DICOM — tout afficher"
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 text-slate-400 hover:text-clinical hover:bg-clinical-light transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Rappel discret des étapes masquées */}
        {hiddenCount > 0 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1.5 px-3 shrink-0 text-xs text-slate-400 hover:text-clinical transition-colors border-r border-slate-100"
            title="Afficher l'étape terminée"
          >
            <span className="w-4 h-4 rounded-full bg-ok-bg text-ok flex items-center justify-center text-xs">✓</span>
            <span className="hidden lg:inline">{hiddenCount} terminée{hiddenCount > 1 ? 's' : ''}</span>
          </button>
        )}

        {visibleSteps.map((step, i) => {
          const pct = completions[step.id]
          const isCurrent = current === step.id
          const isWorkflowPage = current.startsWith('step-')
          const lbl = completionLabel(pct)

          return (
            <div key={step.id} className="flex items-stretch flex-1 min-w-0">
              <button
                onClick={() => onChange(step.id)}
                className={`flex-1 flex flex-col text-left transition-all ${
                  isCurrent ? 'bg-clinical-light/60' : 'hover:bg-slate-50/60'
                }`}
              >
                {/* Progress fill bar */}
                <div className="relative h-1 w-full overflow-hidden bg-slate-100">
                  <div
                    className={`h-full transition-all duration-500 ${step.fillColor}`}
                    style={{ width: `${pct}%` }}
                  />
                  {isCurrent && isWorkflowPage && (
                    <div className="absolute inset-0 bg-clinical/20" />
                  )}
                </div>

                <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold truncate ${
                      isCurrent ? step.textColor : 'text-slate-600'
                    }`}>
                      {step.label}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">{step.sub}</div>
                  </div>
                  <span className={`text-xs shrink-0 ${lbl.cls}`}>{lbl.icon}</span>
                </div>
              </button>

              {i < visibleSteps.length - 1 && (
                <div className="flex items-center px-1 text-slate-300 shrink-0 self-center">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
