import { DataUploadZone, type DicomEntry } from '../DataUploadZone'
import { dossier, formatNombre } from '../../data'
import { fmt, fmtPct, fmtSigne, labelDirection } from '../../logic'
import { useDossier } from '../../store'

interface Props {
  canUpload: boolean
  onGoToConstraints: () => void
  onGoToReport: () => void
}

const atsFiles: DicomEntry[] = [
  { id: 'RTSSj',   nom: 'RTSSj',   description: 'Contours du jour — corrigés/validés dans Monaco', status: 'manquant', uploadable: true },
  { id: 'RTPj',    nom: 'RTPj',    description: 'Plan du jour réoptimisé (planning inverse)',      status: 'manquant', uploadable: true },
  { id: 'RTDosej', nom: 'RTDosej', description: 'Dose du jour calculée — candidate au cumul',      status: 'manquant', uploadable: true },
]

const optionalFiles: DicomEntry[] = [
  { id: 'IRMv', nom: 'IRMv', description: "IRM de vérification après adaptation (optionnel) — non conservée par la machine", status: 'optionnel', uploadable: true },
]

export default function StepAdaptation({ canUpload, onGoToConstraints, onGoToReport }: Props) {
  const d = useDossier()
  const n = d.seanceCourante
  const seance = d.seance(n)
  const decision = seance.voie
  const reco = d.recommandation

  // Contraintes effectivement retenues pour la séance (proposition ou saisie manuelle)
  const contraintes = d.propositions.filter(p => p.structure.type === 'oar')

  // Cumul par structure, avec la part de l'objectif déjà consommée
  const cumulBarres = d.cumul.lignes.filter(l =>
    ['ptv-d95', 'rectum-d05', 'rectum-v29', 'vessie-d05'].includes(l.structure.id),
  )

  const showCumul = d.cumul.seancesIncluses.length > 0

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">

      {/* ── En-tête ── */}
      <div className="bg-app-sidebar rounded-3xl px-6 py-5 text-white flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">
            Étape 3 · Séance {n} / {dossier.nbSeances}
          </div>
          <div className="text-xl font-bold">Adaptation</div>
          <div className="text-sm opacity-70 mt-1">
            {decision === 'ATS'
              ? 'Adapt To Shape — recontourage + réoptimisation dans Monaco'
              : decision === 'ATP'
                ? 'Adapt To Position — décalage de table, plan de référence appliqué'
                : 'En attente de la décision clinique'}
          </div>
        </div>
        {decision && (
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold mt-1 ${
            decision === 'ATS' ? 'bg-clinical text-white' : 'bg-ok text-white'
          }`}>
            {decision}
          </span>
        )}
      </div>

      {/* ── Traçabilité de la décision ── */}
      {!decision ? (
        <div className="bg-warn-bg border border-warn-border rounded-3xl px-6 py-5 flex items-center gap-3">
          <span className="text-warn text-lg">⚠</span>
          <div className="text-sm text-warn-text">
            <strong>Aucune décision clinique enregistrée.</strong> Retournez à l'étape « IRM du jour »
            pour que le radiothérapeute tranche entre ATP et ATS. DIMADOSE recommande{' '}
            <strong>{reco.voie}</strong>.
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl px-5 py-3.5 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <span className="w-6 h-6 rounded-full bg-ok-bg text-ok flex items-center justify-center shrink-0">✓</span>
          Décision <strong className="text-slate-700">{decision}</strong> enregistrée pour la séance {n}
          {decision === reco.voie
            ? <span className="text-slate-400">· recommandation suivie</span>
            : <span className="text-warn-text">· recommandation {reco.voie} non suivie</span>}
          {seance.motifsDeviationEnregistres.length > 0 && (
            <span className="text-slate-400" title={seance.motifsDeviationEnregistres.join(' · ')}>
              · motif enregistré ⓘ
            </span>
          )}
          <span className="ml-auto text-slate-400">Traçabilité conservée dans le dossier</span>
        </div>
      )}

      {/* ── Vue ATP ── */}
      {decision === 'ATP' && (
        <div className="bg-white rounded-3xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-sm font-bold text-slate-800">Adapt To Position</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Plan de référence appliqué avec décalage de table — aucune réoptimisation
            </div>
          </div>
          <div className="p-5 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-clinical-light border border-clinical-border rounded-2xl px-4 py-3">
                <div className="text-xs text-slate-500">Plan appliqué</div>
                <div className="text-sm font-bold text-clinical font-mono mt-0.5">RTPp — plan de référence</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                <div className="text-xs text-slate-500">Décalages du recalage rigide (Δx · Δy · Δz)</div>
                <div className="text-sm font-bold text-slate-700 font-mono mt-0.5">
                  {seance.mesures.decalages.map(v => fmtSigne(v, 1)).join(' · ')} mm
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 rounded-2xl px-4 py-2.5">
              Une séance ATP ne produit ni RTSSj, ni RTPj, ni RTDosej : rien à réimporter. La dose de
              la séance sera estimée en appliquant le plan de référence sur le recalage rigide, d'où
              une confiance dégradée et un état « séance à information réduite » dans la frise.
              <span className="text-clinical"> [récupérabilité des décalages de table — point non arrêté]</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Vue ATS ── */}
      {decision === 'ATS' && (
        <>
          <DataUploadZone
            title="Données ATS — à importer depuis Monaco"
            entries={atsFiles}
            accentColor="clinical"
            readOnly={!canUpload}
          />

          <div className="bg-white rounded-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-800">
                  Contraintes retenues pour la séance {n}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Jeu proposé par DIMADOSE à partir du cumul S1–S{d.cumul.jusqua}, à ressaisir dans Monaco
                  {d.contraintesModifiees && ' · valeurs ajustées à la main'}
                </div>
              </div>
              <button
                onClick={onGoToConstraints}
                className="text-xs text-clinical border border-clinical-border bg-clinical-light hover:bg-clinical hover:text-white px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0"
              >
                Détail et export →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {['OAR', 'Contrainte', 'Référence', 'Retenue', 'Ajustement', 'Cumul / Prévu'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contraintes.map(p => {
                    const s = p.structure
                    const dir = labelDirection[p.direction]
                    const valeur = d.valeurContrainte(p.id)
                    const signe = s.sens === 'max' ? '≤' : '≥'
                    return (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-700">{s.nom}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{s.metrique}</td>
                        <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                          {signe} {fmt(p.valeurRef)} {s.unite}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                          {signe} {fmt(valeur)} {s.unite}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            dir.niveau === 'danger'
                              ? 'bg-danger-bg text-danger-text border-danger-border'
                              : dir.niveau === 'ok'
                                ? 'bg-ok-bg text-ok-text border-ok-border'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {dir.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          <span className={p.cumul.niveau === 'danger' ? 'text-danger font-semibold' : 'text-slate-600'}>
                            {formatNombre(p.cumul.cumul, 1)}
                          </span>
                          <span className="text-slate-400"> / {formatNombre(p.cumul.prevu, 1)} {s.unite}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-400 italic">
              Aucun échange automatique avec le TPS : ces valeurs sont recopiées à la main par le physicien.
            </div>
          </div>

          <DataUploadZone
            title="Données optionnelles"
            entries={optionalFiles}
            accentColor="blue"
            readOnly={!canUpload}
          />
        </>
      )}

      {/* ── Cumul du patient ── */}
      {decision && (
        showCumul ? (
          <div className="bg-white rounded-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-800">Cumul reconstruit du patient</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Séances S{d.cumul.seancesIncluses.join(', S')} sommées sur l'IRMref · part de l'objectif de fin de traitement
                </div>
              </div>
              <button
                onClick={onGoToReport}
                className="text-xs text-clinical border border-clinical-border bg-clinical-light hover:bg-clinical hover:text-white px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0"
              >
                Rapport →
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              {cumulBarres.map(l => {
                const part = Math.min((l.cumul / l.structure.objectifTotal) * 100, 100)
                const partPrevue = Math.min((l.prevu / l.structure.objectifTotal) * 100, 100)
                return (
                  <div key={l.structure.id} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                      {l.structure.nom} <span className="text-slate-400 font-normal">{l.structure.metrique}</span>
                    </span>
                    <div className="relative flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${l.niveau === 'danger' ? 'bg-danger' : 'bg-clinical'}`}
                        style={{ width: `${part}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-px bg-slate-500"
                        style={{ left: `${partPrevue}%` }}
                        title={`Prévu à ce stade : ${formatNombre(l.prevu, 1)} ${l.structure.unite}`}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-500 w-40 text-right shrink-0">
                      {formatNombre(l.cumul, 1)} / {formatNombre(l.structure.objectifTotal, 1)} {l.structure.unite}
                      <span className={`ml-1 ${l.niveau === 'danger' ? 'text-danger' : 'text-slate-400'}`}>
                        {fmtPct(l.ecartRelatif)}
                      </span>
                    </span>
                  </div>
                )
              })}
              <div className="text-xs text-slate-400 border-t border-slate-100 pt-2">
                Le trait vertical marque le prévisionnel au même stade. Pourcentage = écart du cumul
                au prévisionnel. Dose reconstruite, non délivrée.
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4 text-sm text-slate-500 flex items-center gap-3">
            <span className="text-slate-400">ⓘ</span>
            Première séance — aucun cumul disponible. Le cumul apparaîtra à partir de la séance 2,
            une fois la séance 1 évaluée et validée.
          </div>
        )
      )}
    </div>
  )
}
