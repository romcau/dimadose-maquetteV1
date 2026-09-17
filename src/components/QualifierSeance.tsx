/* ─────────────────────────────────────────────────────────────────────────────
 * Qualification d'une séance, en fin de workflow.
 *
 * Les écrans de la séance disent ce qui s'est passé en détail. Ce panneau
 * demande une chose de plus, que rien ne peut déduire : est-ce que la séance
 * s'est déroulée comme attendu, et sinon, quoi. C'est un jugement humain — il
 * part au journal avec son auteur, et c'est lui que le tableau de bord montre.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from 'react'
import { useDossier } from '../dossierContext'
import {
  couleursCodeSeance,
  explicationsCodeSeance,
  libellesCodeSeance,
  verdictIncomplet,
  type CodeSeance,
} from '../logic'

const CODES: CodeSeance[] = ['vert', 'orange', 'rouge']

interface Props {
  seance: number
  /** Faux pour un profil en lecture seule : le panneau montre sans permettre. */
  peutQualifier: boolean
}

export default function QualifierSeance({ seance, peutQualifier }: Props) {
  const d = useDossier()
  const enregistre = d.decisions[seance]?.verdict

  const [code, setCode] = useState<CodeSeance>(enregistre?.code ?? 'vert')
  const [commentaire, setCommentaire] = useState(enregistre?.commentaire ?? '')
  const [touche, setTouche] = useState(false)

  const manque = verdictIncomplet(code, commentaire)
  // Reproche seulement après une tentative : on n'accueille pas l'utilisateur
  // par un message d'erreur sur un champ qu'il n'a pas encore vu.
  const erreur = touche ? manque : null

  const inchange = enregistre
    && enregistre.code === code
    && enregistre.commentaire === commentaire.trim()

  const valider = () => {
    setTouche(true)
    if (manque) return
    d.qualifierSeance(seance, code, commentaire)
  }

  return (
    <div className="max-w-4xl mx-auto w-full bg-white rounded-3xl border border-slate-200 px-6 py-5">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-bold text-slate-800">
            Qualifier la séance {seance}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Ce que le tableau de bord montrera de cette séance, et le commentaire au survol.
          </div>
        </div>
        {enregistre && (
          <div className="text-xs text-slate-400">
            {libellesCodeSeance[enregistre.code]} · {enregistre.par}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {CODES.map(c => {
          const choisi = code === c
          const couleur = couleursCodeSeance[c]
          return (
            <button
              key={c}
              type="button"
              disabled={!peutQualifier}
              onClick={() => setCode(c)}
              aria-pressed={choisi}
              className={`flex items-start gap-3 text-left px-4 py-3 rounded-2xl border transition-colors disabled:cursor-not-allowed ${
                choisi
                  ? `${couleur.fond} ${couleur.bord}`
                  : 'bg-white border-slate-200 hover:bg-slate-50 disabled:hover:bg-white'
              }`}
            >
              <span className={`w-3 h-3 rounded-full shrink-0 mt-1 ${couleur.pastille} ${choisi ? '' : 'opacity-30'}`} />
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${choisi ? couleur.texte : 'text-slate-700'}`}>
                  {libellesCodeSeance[c]}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  {explicationsCodeSeance[c]}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <label className="block mt-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Commentaire {code !== 'vert' && <span className="text-danger">— requis</span>}
        </span>
        <textarea
          value={commentaire}
          onChange={e => setCommentaire(e.target.value)}
          disabled={!peutQualifier}
          rows={2}
          placeholder={code === 'vert'
            ? 'Facultatif — une précision si vous en voyez une'
            : 'Ce qui s’est passé, en une phrase'}
          className={`mt-1.5 w-full text-sm rounded-2xl border px-4 py-2.5 resize-none transition-colors
            focus:outline-none focus:border-clinical disabled:bg-slate-50 disabled:cursor-not-allowed
            ${erreur ? 'border-danger-border bg-danger-bg' : 'border-slate-200'}`}
        />
      </label>

      {erreur && <div className="text-xs text-danger-text mt-1.5">{erreur}</div>}

      {peutQualifier && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={valider}
            disabled={!!inchange}
            className="bg-clinical hover:bg-clinical-mid disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-2xl transition-colors"
          >
            {enregistre ? 'Mettre à jour la qualification' : 'Enregistrer la qualification'}
          </button>
          {inchange && <span className="text-xs text-slate-400">Déjà enregistrée</span>}
        </div>
      )}
    </div>
  )
}
