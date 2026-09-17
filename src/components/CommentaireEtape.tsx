/* ─────────────────────────────────────────────────────────────────────────────
 * Commentaire de fin d'étape.
 *
 * Facultatif, et adressé à la séance suivante : c'est ce qu'un opérateur
 * dirait de vive voix à celui qui prendra la main demain, et que ni les
 * fichiers DICOM ni les verdicts ne transportent.
 *
 * Replié par défaut. Une zone de texte ouverte au bas de chaque étape
 * réclamerait d'être remplie ; celle-ci se demande.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import { useDossier } from '../store'

interface Props {
  seance: number
  etape: string
  /** Faux en lecture seule : le texte existant reste lisible. */
  modifiable: boolean
}

export default function CommentaireEtape({ seance, etape, modifiable }: Props) {
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

  if (!ouvert) {
    if (!modifiable) return null
    return (
      <div className="max-w-4xl mx-auto mt-4">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="text-xs text-slate-400 hover:text-clinical transition-colors"
        >
          + Laisser un commentaire pour la séance suivante
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto mt-4">
      <div className="bg-white border border-slate-200 rounded-3xl px-6 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-slate-700">Commentaire pour la séance suivante</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Facultatif — lu par qui prendra la séance d'après, et repris au rapport
            </div>
          </div>
          {!modifiable && <span className="text-xs text-slate-400 shrink-0">Lecture seule</span>}
        </div>

        <textarea
          value={texte}
          onChange={e => setTexte(e.target.value)}
          disabled={!modifiable}
          rows={2}
          placeholder="Ce qu'il faut savoir avant la prochaine séance…"
          className="mt-3 w-full text-sm rounded-2xl border border-slate-200 px-4 py-2.5 resize-none
            focus:outline-none focus:border-clinical disabled:bg-slate-50 disabled:cursor-not-allowed"
        />

        {modifiable && (
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => d.commenterEtape(seance, etape, texte)}
              disabled={!modifie}
              className="text-xs px-3 py-1.5 bg-clinical hover:bg-clinical-mid disabled:opacity-40
                disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
            >
              Enregistrer
            </button>
            {modifie && (
              <button
                type="button"
                onClick={() => setTexte(enregistre)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Annuler
              </button>
            )}
            {!modifie && enregistre && (
              <span className="text-xs text-slate-400">Enregistré</span>
            )}
            {!enregistre && !modifie && (
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Replier
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
