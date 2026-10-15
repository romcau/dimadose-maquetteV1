/* ─────────────────────────────────────────────────────────────────────────────
 * Récapitulatif de la séance précédente, en tête du workflow.
 *
 * Ce que la personne qui ouvre la séance du jour doit savoir de la veille sans
 * avoir à ouvrir quoi que ce soit : la voie suivie, comment elle s'est passée,
 * et ce que l'équipe a laissé dire.
 *
 * Il n'apparaît qu'à partir de la deuxième séance, et seulement si la
 * précédente a laissé quelque chose — un cadre vide sur chaque écran cesserait
 * vite d'être lu.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from 'react'
import { libellesEtapes } from '../data'
import {
  couleursCodeSeance,
  libellesCodeSeance,
  libellesDeroulementGating,
  niveauDeroulementGating,
} from '../logic'
import { useDossier } from '../store'

interface Props {
  /** Séance en cours : on récapitule la précédente. */
  seance: number
}

const PASTILLE: Record<string, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
}

export default function RecapSeancePrecedente({ seance }: Props) {
  const d = useDossier()
  const [deplie, setDeplie] = useState(true)

  const numero = seance - 1
  if (numero < 1) return null

  const dec = d.decisions[numero]
  if (!dec) return null

  const commentaires = Object.entries(dec.commentairesEtape ?? {})
    .filter(([, texte]) => texte.trim().length > 0)

  const verdict = dec.verdict
  const gating = dec.gating
  const voie = dec.voie

  // Rien à transmettre : le bandeau ne s'affiche pas.
  if (!voie && !verdict && !gating && commentaires.length === 0) return null

  return (
    <div className="max-w-4xl mx-auto mb-5">
      <div className="bg-clinical-light border border-clinical-border rounded-3xl px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs font-bold text-clinical uppercase tracking-wider">
            Séance {numero} — ce qu'il faut en savoir
          </div>
          <button
            onClick={() => setDeplie(v => !v)}
            className="text-xs text-clinical/70 hover:text-clinical transition-colors shrink-0"
          >
            {deplie ? 'Replier' : 'Déplier'}
          </button>
        </div>

        {/* Toujours visible : l'essentiel tient sur une ligne. */}
        <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
          {voie && (
            <span className="font-bold text-slate-700">Voie {voie}</span>
          )}
          {verdict && (
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${couleursCodeSeance[verdict.code].pastille}`} />
              <span className="text-slate-600">{libellesCodeSeance[verdict.code]}</span>
            </span>
          )}
          {gating && (
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${PASTILLE[niveauDeroulementGating[gating.deroulement]]}`} />
              <span className="text-slate-600">{libellesDeroulementGating[gating.deroulement]}</span>
              {gating.dureeMinutes !== null && (
                <span className="text-slate-400">· {gating.dureeMinutes} min</span>
              )}
            </span>
          )}
          {commentaires.length > 0 && !deplie && (
            <span className="text-slate-400">
              · {commentaires.length} commentaire{commentaires.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {deplie && (
          <div className="mt-3 flex flex-col gap-2 border-t border-clinical-border/60 pt-3">
            {verdict?.commentaire && (
              <Ligne libelle="Qualification" texte={verdict.commentaire} auteur={verdict.par} />
            )}
            {gating?.commentaire && (
              <Ligne libelle="Délivrance" texte={gating.commentaire} auteur={gating.par} />
            )}
            {gating?.seuilAdapte && (
              <Ligne
                libelle="Seuil de gating"
                texte={`Adapté pour la séance — ${gating.seuilApplique || 'valeur non précisée'}`}
              />
            )}
            {commentaires.map(([etape, texte]) => (
              <Ligne key={etape} libelle={libellesEtapes[etape] ?? etape} texte={texte} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Ligne({ libelle, texte, auteur }: { libelle: string; texte: string; auteur?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-semibold text-clinical shrink-0 w-28 pt-0.5">{libelle}</span>
      <span className="text-sm text-slate-700 leading-snug">
        {texte}
        {auteur && <span className="text-slate-400 text-xs"> — {auteur}</span>}
      </span>
    </div>
  )
}
