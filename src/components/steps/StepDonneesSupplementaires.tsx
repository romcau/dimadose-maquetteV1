/* ─────────────────────────────────────────────────────────────────────────────
 * Étape 5 — Données supplémentaires (post-traitement) et clôture de la séance.
 *
 * Ce qui arrive après la délivrance : une IRM de contrôle si elle a été
 * acquise, puis les trois gestes qui ferment la séance — finaliser, relire le
 * récapitulatif, poser la date de la suivante. On repart ensuite au tableau de
 * bord, qui est à jour.
 *
 * Rien ici n'est exigé : la séance est délivrée, l'étape ne fait que
 * l'enregistrer proprement.
 * ──────────────────────────────────────────────────────────────────────────── */

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
  onFinaliser: () => void
  onVoirRecap: () => void
  onVoirRapport: () => void
  onRetourDashboard: () => void
  peutSaisir: boolean
}

export default function StepDonneesSupplementaires({
  sessionNum, totalSeances, voie, finalisee,
  prochaineSeance, onChangerProchaineSeance,
  onFinaliser, onVoirRecap, onVoirRapport, onRetourDashboard, peutSaisir,
}: Props) {
  const d = useDossier()
  const chargee = d.decisions[sessionNum]?.irmPostTraitement === true
  const derniereSeance = sessionNum >= totalSeances

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
          <div className="text-sm font-bold text-slate-800">Clôture de la séance {sessionNum}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {finalisee
              ? 'La séance est enregistrée et le tableau de bord est à jour.'
              : `Voie retenue : ${voie ?? 'non tranchée'} — finaliser inscrit la séance au dossier.`}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {!finalisee ? (
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
                Finaliser la séance {sessionNum}
              </button>
              {!peutSaisir && (
                <span className="text-xs text-slate-400">
                  Réservé au physicien et au radiothérapeute.
                </span>
              )}
            </div>
          ) : (
            <>
              {/* Date de la séance suivante — sans objet à la dernière */}
              {!derniereSeance && (
                <label className="flex flex-col gap-1.5 max-w-xs">
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

              <div className="flex items-center gap-3 flex-wrap pt-1">
                <button
                  onClick={onVoirRecap}
                  className="text-sm font-semibold px-4 py-2.5 rounded-2xl border border-slate-200
                    text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Récapitulatif de la séance
                </button>
                {derniereSeance && (
                  <button
                    onClick={onVoirRapport}
                    className="text-sm font-semibold px-4 py-2.5 rounded-2xl border border-slate-200
                      text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Rapport de fin de traitement
                  </button>
                )}
                <button
                  onClick={onRetourDashboard}
                  className="flex items-center gap-2 bg-clinical hover:bg-clinical-mid text-white
                    text-sm font-semibold px-5 py-2.5 rounded-2xl transition-colors ml-auto"
                >
                  Revenir au tableau de bord
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="text-xs text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
                {derniereSeance
                  ? "Dernière séance du protocole : le rapport de fin de traitement est disponible."
                  : `L'évaluation inter-séance de la séance ${sessionNum} reste à valider (moment A), `
                    + 'hors ligne, avant la séance suivante.'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
