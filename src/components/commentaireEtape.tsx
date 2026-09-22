/* ─────────────────────────────────────────────────────────────────────────────
 * Le commentaire laissé à la séance suivante.
 *
 * Il apparaît au bas de chaque étape — dans la barre de validation pour les
 * étapes 1 à 4, dans la clôture pour l'étape 5, qui n'a pas de barre. Les deux
 * s'en servaient avec le même code recopié : il vit ici, et le geste qui
 * termine l'étape l'enregistre au passage.
 *
 * Facultatif et replié par défaut : une zone de texte ouverte au bas de chaque
 * étape réclamerait d'être remplie, celle-ci se demande.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import { useDossier } from '../store'

export interface CommentaireEtape {
  ouvert: boolean
  ouvrir: () => void
  texte: string
  setTexte: (v: string) => void
  /** Le texte diffère de ce qui est enregistré. */
  modifie: boolean
  /** Ce qui est déjà enregistré pour cette étape. */
  enregistre: string
  /** Écrit le commentaire dans le dossier — à appeler en terminant l'étape. */
  enregistrer: () => void
}

export function useCommentaireEtape(seance: number, etape: string): CommentaireEtape {
  const d = useDossier()
  const enregistre = d.decisions[seance]?.commentairesEtape?.[etape] ?? ''

  const [ouvert, setOuvert] = useState(enregistre.length > 0)
  const [texte, setTexte] = useState(enregistre)

  // Changer d'étape ou de séance recharge le commentaire correspondant.
  useEffect(() => {
    setTexte(enregistre)
    setOuvert(enregistre.length > 0)
  }, [enregistre, seance, etape])

  return {
    ouvert,
    ouvrir: () => setOuvert(true),
    texte,
    setTexte,
    modifie: texte.trim() !== enregistre,
    enregistre,
    enregistrer: () => d.commenterEtape(seance, etape, texte),
  }
}

interface Props {
  champ: CommentaireEtape
  /** Faux en lecture seule : le texte déjà laissé reste lisible. */
  modifiable: boolean
  /** Bouton d'enregistrement propre, quand aucun autre geste ne le porte. */
  avecBouton?: boolean
  className?: string
}

export function ChampCommentaire({ champ, modifiable, avecBouton = false, className = '' }: Props) {
  if (!modifiable) {
    if (!champ.enregistre) return null
    return (
      <div className={`text-sm text-slate-600 ${className}`}>
        <span className="text-xs font-semibold text-slate-400 block mb-1">
          Commentaire pour la séance suivante
        </span>
        {champ.enregistre}
      </div>
    )
  }

  if (!champ.ouvert) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={champ.ouvrir}
          className="text-xs text-slate-400 hover:text-clinical transition-colors"
        >
          + Ajouter un commentaire pour la séance suivante (facultatif)
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="text-xs font-semibold text-slate-500">
        Commentaire pour la séance suivante
        <span className="font-normal text-slate-400"> — facultatif, repris au rapport</span>
      </div>
      <textarea
        value={champ.texte}
        onChange={e => champ.setTexte(e.target.value)}
        rows={2}
        placeholder="Ce qu'il faut savoir avant la prochaine séance…"
        className="mt-1.5 w-full text-sm rounded-2xl border border-slate-200 px-4 py-2.5 resize-none
          focus:outline-none focus:border-clinical"
      />
      {avecBouton && champ.modifie && (
        <button
          type="button"
          onClick={champ.enregistrer}
          className="mt-2 text-xs px-3 py-1.5 bg-clinical hover:bg-clinical-mid text-white
            rounded-xl font-semibold transition-colors"
        >
          Enregistrer le commentaire
        </button>
      )}
    </div>
  )
}
