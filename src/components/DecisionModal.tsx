/* ─────────────────────────────────────────────────────────────────────────────
 * Décision ATP / ATS — le passage obligé entre l'IRM du jour et l'adaptation.
 *
 * Elle s'ouvre quelle que soit la route empruntée vers l'adaptation : le
 * bouton du bas, la barre latérale ou le bandeau du haut. Passer à l'étape
 * suivante sans avoir tranché n'a pas de sens — c'est cette décision qui dit
 * ce que l'étape suivante fera.
 *
 * Elle porte de quoi décider, et non le seul nom de la voie recommandée :
 * l'outil propose, l'humain décide, et on ne décide pas sur une étiquette.
 * L'analyse complète reste à un clic (moment B).
 * ──────────────────────────────────────────────────────────────────────────── */

import { CONVENTION_AXES, fmt, fmtSigne, type Recommandation, type Voie } from '../logic'

const NIVEAU_PASTILLE: Record<string, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  neutral: 'bg-slate-300',
}

const direction = (axe: string, valeur: number) => {
  const c = CONVENTION_AXES.find(x => x.axe === axe)
  if (!c || valeur === 0) return ''
  return valeur > 0 ? c.positifCourt : c.negatifCourt
}

interface Props {
  seance: number
  reco: Recommandation
  /** Voie déjà retenue pour cette séance, s'il y en a une. */
  decisionEnregistree?: Voie | null
  /** Seul le radiothérapeute tranche (§2 du brief). */
  peutDecider: boolean
  onChoisir: (v: Voie) => void
  onVoirAnalyse: () => void
  onFermer: () => void
}

export default function DecisionModal({
  seance, reco, decisionEnregistree, peutDecider, onChoisir, onVoirAnalyse, onFermer,
}: Props) {
  // Les arguments qui pèsent le plus se lisent en premier.
  const justifications = [...reco.justifications].sort((a, b) => b.poids - a.poids)
  const decalagesInhabituels = reco.decalages.filter(x => x.inhabituel)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-app-sidebar/60 backdrop-blur-sm" onClick={onFermer} />

      <div className="relative bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* En-tête : la question, et ce que l'outil propose */}
        <div className="bg-app-sidebar px-6 py-5 text-white shrink-0">
          <div className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-0.5">
            Décision clinique — Séance {seance}
          </div>
          <div className="text-lg font-bold">Adaptation ATP ou ATS ?</div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="bg-white/10 border border-white/20 rounded-2xl px-3 py-1.5 text-sm">
              DIMADOSE propose <strong className="font-bold">{reco.voie}</strong>
            </span>
            <span className="text-xs opacity-60">
              score {fmt(reco.score, 1)} / seuil {fmt(reco.seuil, 1)} · confiance {reco.confiance}
            </span>
          </div>
          {decisionEnregistree && (
            <div className="mt-2 text-xs opacity-70">
              Une décision est déjà enregistrée pour cette séance :{' '}
              <strong className="opacity-100">{decisionEnregistree}</strong>. La confirmer ou la changer.
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto">

          {/* Sur quoi la proposition s'appuie */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Ce qui motive la proposition
            </div>
            <div className="flex flex-col gap-1.5">
              {justifications.length === 0 ? (
                <div className="text-sm text-slate-400 italic">
                  Rien ne plaide pour un recontourage : le plan de référence s'applique.
                </div>
              ) : justifications.map((j, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-2xl px-4 py-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${NIVEAU_PASTILLE[j.niveau] ?? 'bg-slate-300'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-700">{j.titre}</div>
                    <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{j.detail}</div>
                  </div>
                  <span className="text-xs font-mono text-slate-400 shrink-0 mt-0.5">+{fmt(j.poids, 1)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Les décalages du jour : la seule donnée du jour disponible (§11) */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Décalages du jour
            </div>
            <div className="grid grid-cols-3 gap-2">
              {reco.decalages.map(dec => (
                <div
                  key={dec.axe}
                  className={`rounded-2xl px-3 py-2.5 border text-center ${
                    dec.inhabituel ? 'bg-warn-bg border-warn-border' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-xs text-slate-400">Δ{dec.axe}</div>
                  <div className={`text-base font-bold font-mono leading-tight ${dec.inhabituel ? 'text-warn-text' : 'text-slate-700'}`}>
                    {fmtSigne(dec.valeur, 1)}
                  </div>
                  <div className="text-xs text-slate-400">
                    mm {direction(dec.axe, dec.valeur)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    moy. ±{fmt(dec.moyenne, 1)}
                  </div>
                </div>
              ))}
            </div>
            {decalagesInhabituels.length > 0 && (
              <div className="text-xs text-warn-text mt-2">
                {decalagesInhabituels.map(x => `Δ${x.axe}`).join(' et ')} au-delà de l'habitude du patient.
              </div>
            )}
          </div>

          {/* Ce que l'outil n'a pas — le §11 du brief, dit à l'écran */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-500 leading-relaxed">
            À cet instant, aucun contour, volume ni DVH du jour n'existe : la proposition ne
            s'appuie que sur l'historique cumulé et sur le recalage rigide du jour.
            {reco.historique.total > 0 && (
              <> Sur les {reco.historique.total} séance(s) précédente(s) : {reco.historique.ats} ATS,
              {' '}{reco.historique.atp} ATP.</>
            )}
          </div>

        </div>

        {/* La décision reste sous les yeux : c'est l'action de la fenêtre, elle
            ne doit pas dépendre d'un défilement pour être atteinte. */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0 bg-white">
          {!peutDecider ? (
            <div className="bg-warn-bg border border-warn-border rounded-2xl px-4 py-3 text-sm text-warn-text">
              Votre profil ne permet pas de trancher : la décision ATP / ATS revient au
              radiothérapeute. Vous pouvez consulter l'analyse, pas la valider.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(['ATP', 'ATS'] as Voie[]).map(v => (
                  <button
                    key={v}
                    onClick={() => onChoisir(v)}
                    className={`group flex flex-col items-start px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                      v === reco.voie
                        ? 'bg-clinical-light border-clinical hover:bg-clinical'
                        : 'bg-white border-slate-200 hover:border-clinical/50'
                    }`}
                  >
                    <div className={`text-base font-bold ${v === reco.voie ? 'text-clinical group-hover:text-white' : 'text-slate-700'}`}>
                      {v}
                      {v === reco.voie && <span className="text-xs font-normal ml-1.5">proposé</span>}
                      {v === decisionEnregistree && (
                        <span className={`text-xs font-normal ml-1.5 ${v === reco.voie ? '' : 'text-clinical'}`}>
                          retenu
                        </span>
                      )}
                    </div>
                    <div className={`text-xs mt-0.5 leading-tight ${v === reco.voie ? 'text-clinical/70 group-hover:text-white/80' : 'text-slate-400'}`}>
                      {v === 'ATP'
                        ? 'Décalage de table, plan de référence appliqué'
                        : 'Recontourage et réoptimisation du jour'}
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Choisir autre chose que la proposition est prévu : l'écart part au journal avec
                son motif.
              </div>
            </>
          )}

          <div className="flex items-center justify-between mt-3">
            <button
              onClick={onVoirAnalyse}
              className="text-xs text-clinical hover:underline font-semibold"
            >
              Analyse complète (moment B) →
            </button>
            <button
              onClick={onFermer}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Rester à l'IRM du jour
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
