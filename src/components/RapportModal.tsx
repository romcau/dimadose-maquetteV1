/* ─────────────────────────────────────────────────────────────────────────────
 * Le rapport de traitement, en fenêtre centrée.
 *
 * Ce qui était le « moment D » : les quatre moments ont disparu, leur contenu
 * ayant rejoint les étapes du workflow — la recommandation ATP/ATS est dans la
 * fenêtre de décision, les contraintes dans l'étape Adaptation. Le rapport,
 * lui, n'appartient à aucune étape : c'est un document qu'on ouvre pour le
 * lire, d'où une fenêtre au centre plutôt qu'un panneau de côté.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useEffect } from 'react'
import RapportTraitement from './RapportTraitement'

interface Props {
  ouvert: boolean
  onFermer: () => void
}

export default function RapportModal({ ouvert, onFermer }: Props) {
  useEffect(() => {
    if (!ouvert) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [ouvert, onFermer])

  if (!ouvert) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-app-sidebar/50 backdrop-blur-sm" onClick={onFermer} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        {/* Le rapport porte des tableaux larges — frise des séances, dose cumulée.
            Le panneau latéral qu'il remplaçait leur donnait 72 % de l'écran ;
            la fenêtre doit en offrir autant, sinon les dernières colonnes
            passent sous un défilement horizontal. */}
        <div className="flex flex-col w-full max-w-7xl max-h-full bg-app-bg rounded-3xl overflow-hidden pointer-events-auto">

          <div className="bg-app-sidebar flex items-center justify-between px-6 py-4 shrink-0 border-b border-white/8">
            <div>
              <div className="text-white font-bold text-sm">Rapport de traitement</div>
              <div className="text-white/40 text-xs mt-0.5">Synthèse · Journal · Export PDF</div>
            </div>
            <button
              onClick={onFermer}
              className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
              title="Fermer (Échap)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <RapportTraitement />
          </div>
        </div>
      </div>
    </>
  )
}
