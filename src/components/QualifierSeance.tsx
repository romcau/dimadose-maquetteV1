/* ─────────────────────────────────────────────────────────────────────────────
 * Qualification d'une séance — le passage obligé de la finalisation.
 *
 * Les écrans de la séance disent ce qui s'est passé en détail. Cette fenêtre
 * demande une chose de plus, que rien ne peut déduire : est-ce que la séance
 * s'est déroulée comme attendu, et sinon, quoi. C'est un jugement humain — il
 * part au journal avec son auteur, et c'est lui que le tableau de bord montre.
 *
 * Elle s'ouvre sur « Finaliser la séance » et se ferme en l'enregistrant : la
 * séance n'entre au dossier qu'une fois qualifiée.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from 'react'
import { useDossier } from '../store'
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
  /** Faux pour un profil en lecture seule : la fenêtre montre sans permettre. */
  peutQualifier: boolean
  /** Appelé une fois la qualification enregistrée : la séance est finalisée. */
  onEnregistre: () => void
  onFermer: () => void
}

export default function QualifierSeance({ seance, peutQualifier, onEnregistre, onFermer }: Props) {
  const d = useDossier()
  const enregistre = d.decisions[seance]?.verdict

  const [code, setCode] = useState<CodeSeance>(enregistre?.code ?? 'vert')
  const [commentaire, setCommentaire] = useState(enregistre?.commentaire ?? '')
  const [touche, setTouche] = useState(false)

  const manque = verdictIncomplet(code, commentaire)
  // Reproche seulement après une tentative : on n'accueille pas l'utilisateur
  // par un message d'erreur sur un champ qu'il n'a pas encore vu.
  const erreur = touche ? manque : null

  const valider = () => {
    setTouche(true)
    if (manque) return
    d.qualifierSeance(seance, code, commentaire)
    onEnregistre()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-app-sidebar/60 backdrop-blur-sm" onClick={onFermer} />

      <div className="relative bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        <div className="bg-app-sidebar px-6 py-5 text-white shrink-0">
          <div className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-0.5">
            Finalisation — Séance {seance}
          </div>
          <div className="text-lg font-bold">Qualifier la séance</div>
          <div className="text-sm opacity-70 mt-1">
            Ce que le tableau de bord montrera de cette séance, et le commentaire au survol.
          </div>
        </div>

        <div className="p-6 flex flex-col gap-2 overflow-y-auto">
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

          <label className="block mt-2">
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
                : "Ce qui s'est passé, en une phrase"}
              className={`mt-1.5 w-full text-sm rounded-2xl border px-4 py-2.5 resize-none transition-colors
                focus:outline-none focus:border-clinical disabled:bg-slate-50 disabled:cursor-not-allowed
                ${erreur ? 'border-danger-border bg-danger-bg' : 'border-slate-200'}`}
            />
          </label>
          {erreur && <div className="text-xs text-danger-text">{erreur}</div>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4 shrink-0">
          <button
            onClick={onFermer}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Annuler — la séance reste ouverte
          </button>
          {peutQualifier ? (
            <button
              onClick={valider}
              className="bg-clinical hover:bg-clinical-mid text-white text-sm font-semibold px-5 py-2.5 rounded-2xl transition-colors"
            >
              Enregistrer et finaliser
            </button>
          ) : (
            <span className="text-xs text-warn-text">
              Qualifier une séance est réservé au physicien et au radiothérapeute.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
