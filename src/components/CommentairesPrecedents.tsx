/* ─────────────────────────────────────────────────────────────────────────────
 * Ce que la séance précédente a laissé dire.
 *
 * Les commentaires d'étape sont écrits à l'intention de la séance suivante :
 * c'est ici qu'ils arrivent. Le bandeau n'apparaît que s'il y a quelque chose
 * à transmettre — un cadre vide sur chaque écran cesserait vite d'être lu.
 * ──────────────────────────────────────────────────────────────────────────── */

import { libellesEtapes } from '../data'
import { useDossier } from '../store'

interface Props {
  /** Séance en cours : on affiche les commentaires de la précédente. */
  seance: number
}

export default function CommentairesPrecedents({ seance }: Props) {
  const d = useDossier()
  const precedente = seance - 1
  if (precedente < 1) return null

  const commentaires = d.decisions[precedente]?.commentairesEtape ?? {}
  const entrees = Object.entries(commentaires).filter(([, texte]) => texte.trim().length > 0)
  if (entrees.length === 0) return null

  return (
    <div className="max-w-4xl mx-auto mb-5">
      <div className="bg-clinical-light border border-clinical-border rounded-3xl px-5 py-4">
        <div className="text-xs font-bold text-clinical uppercase tracking-wider mb-2">
          Laissé par la séance {precedente}
        </div>
        <div className="flex flex-col gap-2">
          {entrees.map(([etape, texte]) => (
            <div key={etape} className="flex items-start gap-3">
              <span className="text-xs font-semibold text-clinical shrink-0 w-28 pt-0.5">
                {libellesEtapes[etape] ?? etape}
              </span>
              <span className="text-sm text-slate-700 leading-snug">{texte}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
