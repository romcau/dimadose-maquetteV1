/* ─────────────────────────────────────────────────────────────────────────────
 * Étape 5 — Données supplémentaires (post-traitement) et clôture de la séance.
 *
 * Trois gestes, dans cet ordre : charger l'IRM de contrôle si elle existe,
 * finaliser la séance — ce qui ouvre le rapport —, puis clôturer et revenir au
 * tableau de bord.
 *
 * Pas de validation d'étape ici : la séance est délivrée, il n'y a plus rien à
 * vérifier avant de passer à la suite. Il reste à l'enregistrer et à partir.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import { DataUploadZone, type DicomEntry } from '../DataUploadZone'
import { formatDateCourte } from '../../logic'
import { useDossier } from '../../store'

interface Props {
  sessionNum: number
  totalSeances: number
  /** Voie retenue, pour rappeler ce qui a été fait. */
  voie: string | null
  /** La séance a été finalisée : le tableau de bord en tient compte. */
  finalisee: boolean
  prochaineSeance: string
  onChangerProchaineSeance: (iso: string) => void
  /** Finalise la séance et ouvre le rapport de traitement. */
  onFinaliser: () => void
  /** Ferme le dossier et revient au tableau de bord. */
  onCloturer: () => void
  peutSaisir: boolean
}

export default function StepDonneesSupplementaires({
  sessionNum, totalSeances, voie, finalisee,
  prochaineSeance, onChangerProchaineSeance,
  onFinaliser, onCloturer, peutSaisir,
}: Props) {
  const d = useDossier()
  const chargee = d.decisions[sessionNum]?.irmPostTraitement === true
  const derniereSeance = sessionNum >= totalSeances

  // Le commentaire n'est plus porté par une barre de validation : il vit ici,
  // au moment où l'on quitte la séance pour la suivante.
  const enregistre = d.decisions[sessionNum]?.commentairesEtape?.['step-5'] ?? ''
  const [commentaire, setCommentaire] = useState(enregistre)
  const [ouvert, setOuvert] = useState(enregistre.length > 0)
  useEffect(() => {
    setCommentaire(enregistre)
    setOuvert(enregistre.length > 0)
  }, [enregistre, sessionNum])
  const commentaireModifie = commentaire.trim() !== enregistre

  const fichiers: DicomEntry[] = [
    {
      id: 'IRMpt',
      nom: 'IRMpt',
      description: "IRM acquise après la séance — contrôle facultatif, hors chaîne de calcul",
      status: chargee ? 'charge' : 'optionnel',
      uploadable: true,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">

      {/* Header */}
      <div className="bg-app-sidebar rounded-3xl px-6 py-5 text-white flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">
            Étape 5 · Séance {sessionNum}
          </div>
          <div className="text-xl font-bold">Données supplémentaires</div>
          <div className="text-sm opacity-70 mt-1">
            Post-traitement et clôture de la séance
          </div>
        </div>
        {finalisee && (
          <span className="px-3 py-1.5 rounded-full text-xs font-bold mt-1 bg-ok text-white whitespace-nowrap">
            Séance finalisée
          </span>
        )}
      </div>

      <DataUploadZone
        title="IRM post-traitement — facultative"
        entries={fichiers}
        accentColor="blue"
        readOnly={!peutSaisir}
        onUpload={() => d.chargerIrmPostTraitement(sessionNum, true)}
      />

      <div className="bg-white rounded-3xl px-5 py-3 text-xs text-slate-400 leading-relaxed">
        Cette image sert au contrôle de l'équipe. Elle n'entre dans aucun calcul de la maquette :
        la dose de la séance a été établie à l'adaptation, et le cumul ne s'en trouve pas changé.
      </div>

      {/* ── Clôture ── */}
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-800">Fin de la séance {sessionNum}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {finalisee
              ? 'Séance enregistrée — le tableau de bord est à jour.'
              : `Voie retenue : ${voie ?? 'non tranchée'}. Finaliser inscrit la séance au dossier et ouvre le rapport.`}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* 1 — Finaliser : la séance entre au dossier, le rapport s'ouvre */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={onFinaliser}
              disabled={!peutSaisir}
              className="flex items-center gap-2 bg-clinical hover:bg-clinical-mid disabled:opacity-40
                disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-2xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {finalisee ? `Revoir le rapport de la séance ${sessionNum}` : `Finaliser la séance ${sessionNum}`}
            </button>
            {!peutSaisir && (
              <span className="text-xs text-slate-400">
                Réservé au physicien et au radiothérapeute.
              </span>
            )}
          </div>

          {finalisee && (
            <>
              {/* 2 — La date de la suivante, sans objet à la dernière séance */}
              {!derniereSeance && (
                <label className="flex flex-col gap-1.5 max-w-xs border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Prochaine séance
                  </span>
                  <input
                    type="date"
                    value={prochaineSeance}
                    onChange={e => onChangerProchaineSeance(e.target.value)}
                    disabled={!peutSaisir}
                    className="border border-slate-200 rounded-2xl px-4 py-2.5 text-sm
                      focus:outline-none focus:border-clinical disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs text-slate-400">
                    {prochaineSeance
                      ? `Annoncée au tableau de bord : ${formatDateCourte(prochaineSeance)}`
                      : 'À planifier — le tableau de bord le signalera.'}
                  </span>
                </label>
              )}

              {/* Un mot pour la séance suivante, comme aux autres étapes */}
              {peutSaisir && (
                <div className="border-t border-slate-100 pt-4">
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
                        value={commentaire}
                        onChange={e => setCommentaire(e.target.value)}
                        rows={2}
                        placeholder="Ce qu'il faut savoir avant la prochaine séance…"
                        className="mt-1.5 w-full text-sm rounded-2xl border border-slate-200 px-4 py-2.5 resize-none
                          focus:outline-none focus:border-clinical"
                      />
                      {commentaireModifie && (
                        <button
                          type="button"
                          onClick={() => d.commenterEtape(sessionNum, 'step-5', commentaire)}
                          className="mt-2 text-xs px-3 py-1.5 bg-clinical hover:bg-clinical-mid text-white
                            rounded-xl font-semibold transition-colors"
                        >
                          Enregistrer le commentaire
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 3 — Clôturer et repartir */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="text-xs text-slate-400 leading-relaxed max-w-md">
                  {derniereSeance
                    ? 'Dernière séance du protocole : le rapport de fin de traitement reste accessible depuis le dossier.'
                    : `L'évaluation inter-séance de la séance ${sessionNum} reste à valider (moment A), `
                      + 'hors ligne, avant la séance suivante.'}
                </div>
                <button
                  onClick={() => {
                    if (commentaireModifie) d.commenterEtape(sessionNum, 'step-5', commentaire)
                    onCloturer()
                  }}
                  className="flex items-center gap-2 bg-app-sidebar hover:bg-app-sidebar/80 text-white
                    text-sm font-semibold px-5 py-2.5 rounded-2xl transition-colors shrink-0"
                >
                  Clôturer la séance
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
