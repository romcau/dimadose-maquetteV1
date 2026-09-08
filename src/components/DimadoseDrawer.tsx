import { useEffect } from 'react'
import MomentA from './MomentA'
import MomentB from './MomentB'
import MomentC from './MomentC'
import MomentD from './MomentD'

export type MomentId = 'moment-A' | 'moment-B' | 'moment-C' | 'moment-D'

export const momentMeta: Record<MomentId, { label: string; sub: string; tag: string }> = {
  'moment-A': { label: 'Validation inter-séance',  sub: 'Qualité · Déformation · Dose cumulée',  tag: 'A' },
  'moment-B': { label: 'Recommandation ATP / ATS', sub: 'Aide à la décision en séance',           tag: 'B' },
  'moment-C': { label: 'Contraintes ATS',          sub: "Tableau d'optimisation des OARs",        tag: 'C' },
  'moment-D': { label: 'Rapport final',            sub: 'Synthèse · Export PDF',                  tag: 'D' },
}

interface Props {
  open: MomentId | null
  onClose: () => void
  onAtsConfirmed?: () => void
}

export default function DimadoseDrawer({ open, onClose, onAtsConfirmed }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const meta = momentMeta[open]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-app-sidebar/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel — slides in from right */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[72%] max-w-5xl bg-app-bg">

        {/* Drawer header */}
        <div className="bg-app-sidebar flex items-center justify-between px-6 py-4 shrink-0 border-b border-white/8">
          <div className="flex items-center gap-4">
            {/* Tag badge */}
            <div className="w-9 h-9 rounded-xl bg-clinical flex items-center justify-center text-white font-bold text-sm shrink-0">
              {meta.tag}
            </div>
            <div>
              <div className="text-white font-bold text-sm">{meta.label}</div>
              <div className="text-white/40 text-xs mt-0.5">{meta.sub}</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
            title="Fermer (Échap)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer content — scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {open === 'moment-A' && <MomentA />}
          {open === 'moment-B' && (
            <MomentB onAtsConfirmed={() => { onAtsConfirmed?.(); onClose() }} />
          )}
          {open === 'moment-C' && <MomentC />}
          {open === 'moment-D' && <MomentD />}
        </div>
      </div>
    </>
  )
}
