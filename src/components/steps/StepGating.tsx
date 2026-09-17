/* ─────────────────────────────────────────────────────────────────────────────
 * Gating et délivrance du traitement.
 *
 * Particularité de cette étape : la machine n'exporte ni l'imagerie ciné 2D,
 * ni le critère d'asservissement, ni les décalages temps réel. Ce qui s'y
 * passe n'a donc aucune trace automatique — ce que l'équipe rapporte ici est
 * la seule qui existe.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import { type PatientRecord } from '../Dashboard'
import { seuilGatingProtocole } from '../../data'
import {
  explicationsDeroulementGating,
  libellesDeroulementGating,
  niveauDeroulementGating,
  suiviGatingIncomplet,
  type DeroulementGating,
} from '../../logic'
import { useDossier } from '../../store'

interface Props {
  patient: PatientRecord
  sessionNum: number
  /** Faux en lecture seule : l'écran montre sans permettre. */
  peutSaisir: boolean
}

const DEROULEMENTS: DeroulementGating[] = ['ras', 'ajustements', 'gros-ajustements']

const PASTILLE: Record<string, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
}

const CADRE: Record<string, string> = {
  ok: 'bg-ok-bg border-ok-border',
  warn: 'bg-warn-bg border-warn-border',
  danger: 'bg-danger-bg border-danger-border',
}

export default function StepGating({ sessionNum, peutSaisir }: Props) {
  const d = useDossier()
  const enregistre = d.decisions[sessionNum]?.gating

  const [deroulement, setDeroulement] = useState<DeroulementGating>(enregistre?.deroulement ?? 'ras')
  const [commentaire, setCommentaire] = useState(enregistre?.commentaire ?? '')
  const [duree, setDuree] = useState(enregistre?.dureeMinutes?.toString() ?? '')
  const [seuilAdapte, setSeuilAdapte] = useState(enregistre?.seuilAdapte ?? false)
  const [seuilApplique, setSeuilApplique] = useState(enregistre?.seuilApplique ?? '')
  const [touche, setTouche] = useState(false)

  // Changer de séance recharge son suivi, pas celui de la précédente.
  useEffect(() => {
    setDeroulement(enregistre?.deroulement ?? 'ras')
    setCommentaire(enregistre?.commentaire ?? '')
    setDuree(enregistre?.dureeMinutes?.toString() ?? '')
    setSeuilAdapte(enregistre?.seuilAdapte ?? false)
    setSeuilApplique(enregistre?.seuilApplique ?? '')
    setTouche(false)
  }, [enregistre, sessionNum])

  const manque = suiviGatingIncomplet(deroulement, commentaire)
  const erreur = touche ? manque : null

  const enregistrer = () => {
    setTouche(true)
    if (manque) return
    const minutes = parseInt(duree, 10)
    d.enregistrerGating(sessionNum, {
      deroulement,
      commentaire,
      dureeMinutes: isFinite(minutes) && minutes > 0 ? minutes : null,
      seuilAdapte,
      seuilApplique: seuilAdapte ? seuilApplique.trim() : null,
    })
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">

      {/* Header */}
      <div className="bg-gating rounded-3xl px-6 py-5 text-white flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">
            Étape 4 · Séance {sessionNum}
          </div>
          <div className="text-xl font-bold">Gating et délivrance du traitement</div>
          <div className="text-sm opacity-80 mt-1">
            Traitement asservi au mouvement — délivrance sous surveillance
          </div>
        </div>
        {enregistre && (
          <span className="px-3 py-1.5 rounded-full text-xs font-bold mt-1 bg-white/20 text-white whitespace-nowrap">
            Rapporté
          </span>
        )}
      </div>

      {/* ── Le seuil prescrit ── */}
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-800">Critère d'asservissement</div>
          <div className="text-xs text-slate-400 mt-0.5">Seuil prescrit par le protocole</div>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold font-mono text-gating bg-gating-light border border-gating-border px-3 py-1.5 rounded-xl">
              {seuilGatingProtocole.critere}
            </span>
            <span className="text-sm text-slate-600">{seuilGatingProtocole.regle}</span>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={seuilAdapte}
              onChange={e => setSeuilAdapte(e.target.checked)}
              disabled={!peutSaisir}
              className="mt-0.5 w-4 h-4 accent-gating shrink-0 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-slate-600 leading-snug">
              Le seuil a été adapté pour cette séance
              <span className="block text-xs text-slate-400 mt-0.5">
                Un seuil modifié change ce qui a été délivré : il doit être écrit quelque part,
                la machine ne le transmet pas.
              </span>
            </span>
          </label>

          {seuilAdapte && (
            <input
              type="text"
              value={seuilApplique}
              onChange={e => setSeuilApplique(e.target.value)}
              disabled={!peutSaisir}
              placeholder="Seuil réellement appliqué — ex. 95 % de la prostate dans le PTV"
              className="w-full text-sm rounded-2xl border border-slate-200 px-4 py-2.5
                focus:outline-none focus:border-gating disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          )}
        </div>
      </div>

      {/* ── Comment ça s'est passé ── */}
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-slate-800">Déroulement de la délivrance</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Rapporté par l'équipe — la machine n'en exporte rien
            </div>
          </div>
          {enregistre && (
            <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">{enregistre.par}</span>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {DEROULEMENTS.map(v => {
              const choisi = deroulement === v
              const niveau = niveauDeroulementGating[v]
              return (
                <button
                  key={v}
                  type="button"
                  disabled={!peutSaisir}
                  onClick={() => setDeroulement(v)}
                  aria-pressed={choisi}
                  className={`flex items-start gap-3 text-left px-4 py-3 rounded-2xl border transition-colors disabled:cursor-not-allowed ${
                    choisi ? CADRE[niveau] : 'bg-white border-slate-200 hover:bg-slate-50 disabled:hover:bg-white'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full shrink-0 mt-1 ${PASTILLE[niveau]} ${choisi ? '' : 'opacity-30'}`} />
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${choisi ? 'text-slate-800' : 'text-slate-700'}`}>
                      {libellesDeroulementGating[v]}
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {explicationsDeroulementGating[v]}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Commentaire {deroulement !== 'ras' && <span className="text-danger">— requis</span>}
            </span>
            <textarea
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
              disabled={!peutSaisir}
              rows={2}
              placeholder={deroulement === 'ras'
                ? 'Facultatif'
                : "Ce qui a demandé un ajustement — remplissage vésical, gaz, mouvement du patient…"}
              className={`mt-1.5 w-full text-sm rounded-2xl border px-4 py-2.5 resize-none transition-colors
                focus:outline-none focus:border-gating disabled:bg-slate-50 disabled:cursor-not-allowed
                ${erreur ? 'border-danger-border bg-danger-bg' : 'border-slate-200'}`}
            />
          </label>
          {erreur && <div className="text-xs text-danger-text -mt-2">{erreur}</div>}

          <label className="block max-w-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Durée de la séance
            </span>
            <div className="relative mt-1.5">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={duree}
                onChange={e => setDuree(e.target.value)}
                disabled={!peutSaisir}
                placeholder="28"
                className="w-full text-sm rounded-2xl border border-slate-200 px-4 py-2.5 pr-14
                  focus:outline-none focus:border-gating disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                min
              </span>
            </div>
            <span className="block text-xs text-slate-400 mt-1">
              De l'installation à la fin de délivrance. Une séance longue se paie en mouvement du
              patient, donc en incertitude sur la dose.
            </span>
          </label>

          {peutSaisir && (
            <div>
              <button
                type="button"
                onClick={enregistrer}
                className="bg-gating hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl transition-opacity"
              >
                {enregistre ? 'Mettre à jour le rapport' : 'Enregistrer le rapport'}
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
