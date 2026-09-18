/* ─────────────────────────────────────────────────────────────────────────────
 * Barre de fin d'étape : valider, commenter, revenir en arrière.
 *
 * Le commentaire vit ici et non dans un cadre séparé : on le laisse au moment
 * où l'on valide, et « Valider l'étape » l'enregistre avec la validation. Un
 * seul geste, parce qu'il n'y a qu'un seul moment.
 *
 * Il est facultatif et replié par défaut. Une zone de texte ouverte au bas de
 * chaque étape réclamerait d'être remplie ; celle-ci se demande.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import { useDossier } from '../store'

interface Props {
  validated: boolean
  onValidate: () => void
  onUnvalidate: () => void
  nextLabel?: string
  onNext?: () => void
  canValidate?: boolean
  validatorLabel?: string
  /** Revenir à l'étape précédente en annulant celle-ci. Absent sur la première. */
  onBack?: () => void
  /** Séance et étape auxquelles rattacher le commentaire. */
  seance: number
  etape: string
}

/** Lien de retour, identique dans les trois états de la barre. */
function Retour({ onBack }: { onBack?: () => void }) {
  if (!onBack) return null
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors shrink-0"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Annuler et revenir à l'étape précédente
    </button>
  )
}

export default function StepValidateBar({
  validated, onValidate, onUnvalidate, nextLabel, onNext,
  canValidate = true, validatorLabel, onBack, seance, etape,
}: Props) {
  const d = useDossier()
  const enregistre = d.decisions[seance]?.commentairesEtape?.[etape] ?? ''

  const [ouvert, setOuvert] = useState(enregistre.length > 0)
  const [texte, setTexte] = useState(enregistre)

  // Changer d'étape ou de séance recharge le commentaire correspondant.
  useEffect(() => {
    setTexte(enregistre)
    setOuvert(enregistre.length > 0)
  }, [enregistre, seance, etape])

  const modifie = texte.trim() !== enregistre

  /** Valider enregistre aussi le commentaire : un seul geste. */
  const validerEtCommenter = () => {
    if (modifie) d.commenterEtape(seance, etape, texte)
    onValidate()
  }

  const champ = (
    <div className="mb-3 pb-3 border-b border-slate-100">
      {!ouvert ? (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="text-xs text-slate-400 hover:text-clinical transition-colors"
        >
          + Ajouter un commentaire pour la séance suivante (facultatif)
        </button>
      ) : (
        <>
          <div className="text-xs font-semibold text-slate-500">
            Commentaire pour la séance suivante
            <span className="font-normal text-slate-400"> — facultatif, repris au rapport</span>
          </div>
          <textarea
            value={texte}
            onChange={e => setTexte(e.target.value)}
            rows={2}
            placeholder="Ce qu'il faut savoir avant la prochaine séance…"
            className="mt-1.5 w-full text-sm rounded-2xl border border-slate-200 px-4 py-2.5 resize-none
              focus:outline-none focus:border-clinical"
          />
          {validated && modifie && (
            <button
              type="button"
              onClick={() => d.commenterEtape(seance, etape, texte)}
              className="mt-2 text-xs px-3 py-1.5 bg-clinical hover:bg-clinical-mid text-white rounded-xl font-semibold transition-colors"
            >
              Enregistrer le commentaire
            </button>
          )}
        </>
      )}
    </div>
  )

  // ── Lecture seule ──
  if (!canValidate && !validated) {
    return (
      <div className="max-w-4xl mx-auto mt-4">
        <div className="bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4">
          {/* Le commentaire déjà laissé reste lisible, sans être modifiable. */}
          {enregistre && (
            <div className="mb-3 pb-3 border-b border-slate-200 text-sm text-slate-600">
              <span className="text-xs font-semibold text-slate-400 block mb-1">
                Commentaire pour la séance suivante
              </span>
              {enregistre}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-600">Consultation en lecture seule</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {validatorLabel ?? 'La validation de cette étape est réservée au physicien médical.'}
              </div>
            </div>
            <div className="ml-auto">
              <Retour onBack={onBack} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Étape validée ──
  if (validated) {
    return (
      <div className="max-w-4xl mx-auto mt-4">
        <div className="bg-ok-bg border border-ok-border rounded-3xl px-6 py-4">
          {canValidate && champ}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-ok flex items-center justify-center text-white text-sm font-bold shrink-0">
                ✓
              </div>
              <div>
                <div className="text-sm font-bold text-ok-text">Étape validée</div>
                <div className="text-xs text-ok-text/70 mt-0.5">Cette étape est marquée comme complète.</div>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap justify-end">
              <Retour onBack={onBack} />
              {canValidate && (
                <button
                  onClick={onUnvalidate}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline"
                >
                  Annuler la validation
                </button>
              )}
              {onNext && nextLabel && (
                <button
                  onClick={onNext}
                  className="flex items-center gap-2 bg-clinical hover:bg-clinical-mid text-white text-sm font-semibold px-5 py-2.5 rounded-2xl transition-colors"
                >
                  {nextLabel}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Étape à valider ──
  return (
    <div className="max-w-4xl mx-auto mt-4">
      <div className="bg-white border border-slate-200 rounded-3xl px-6 py-4">
        {champ}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-slate-500">
            Vérifiez que toutes les données et configurations sont correctes avant de valider.
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-end">
            <Retour onBack={onBack} />
            <button
              onClick={validerEtCommenter}
              className="flex items-center gap-2 bg-app-sidebar hover:bg-app-sidebar/80 text-white text-sm font-semibold px-6 py-2.5 rounded-2xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Valider l'étape
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
