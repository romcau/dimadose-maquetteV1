/* ─────────────────────────────────────────────────────────────────────────────
 * Observation libre sur une séance.
 *
 * Deux choses que rien ne calcule et qu'aucun fichier DICOM ne porte : comment
 * s'est passé le recalage, et quelle affectation de densité a été retenue.
 * Elles expliquent après coup pourquoi une séance ressemble à ce qu'elle est.
 *
 * Enregistrées à la validation et non à la frappe : le journal garderait sinon
 * une entrée par caractère.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import { useDossier } from '../../store'

interface Props {
  seance: number
  champ: 'recalage' | 'densites'
  label: string
  placeholder: string
  /** Faux en lecture seule : le texte reste lisible, le champ est inerte. */
  modifiable: boolean
}

export default function NoteSeance({ seance, champ, label, placeholder, modifiable }: Props) {
  const d = useDossier()
  const enregistre = (champ === 'recalage'
    ? d.decisions[seance]?.noteRecalage
    : d.decisions[seance]?.noteDensites) ?? ''

  const [texte, setTexte] = useState(enregistre)

  // Changer de séance doit recharger la note de celle-ci, pas garder l'ancienne.
  useEffect(() => { setTexte(enregistre) }, [enregistre, seance])

  const modifie = texte.trim() !== enregistre

  return (
    <div className="mt-2">
      <label className="block text-xs font-semibold text-slate-400 mb-1">{label}</label>
      <textarea
        value={texte}
        onChange={e => setTexte(e.target.value)}
        disabled={!modifiable}
        rows={2}
        placeholder={placeholder}
        className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 resize-none
          focus:outline-none focus:border-clinical disabled:bg-slate-50 disabled:cursor-not-allowed"
      />
      {modifiable && modifie && (
        <div className="flex items-center gap-2 mt-1.5">
          <button
            type="button"
            onClick={() => d.noterSeance(seance, champ, texte)}
            className="text-xs px-3 py-1.5 bg-clinical text-white rounded-xl font-semibold hover:bg-clinical-mid transition-colors"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setTexte(enregistre)}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Annuler
          </button>
        </div>
      )}
      {!modifiable && !enregistre && (
        <div className="text-xs text-slate-300 italic mt-1">Lecture seule — rien de noté</div>
      )}
    </div>
  )
}
