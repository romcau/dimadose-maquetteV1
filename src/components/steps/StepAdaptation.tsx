import { DataUploadZone, type DicomEntry } from '../DataUploadZone'
import { dossier, formatNombre } from '../../data'
import {
  comparerAuPlanReference,
  fmt,
  scorerContrainte,
  scoreGlobal,
  fmtPct,
  fmtSigne,
  labelDirection,
  SEUIL_ECART_PLAN_PCT,
} from '../../logic'
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

/**
 * Une séance ATP applique le plan de référence, et n'a donc en principe rien à
 * réimporter. Mais le plan peut avoir été retouché en séance, et une IRM de
 * vérification acquise : ces objets restent facultatifs, et changent la nature
 * de la séance quand ils reviennent.
 */
const atpFilesRef: DicomEntry[] = [
  { id: 'rtplan', nom: 'RTPj modifié',   description: "Plan réellement délivré, s'il diffère du plan de référence", status: 'optionnel', uploadable: true },
  { id: 'rtdose', nom: 'RTDosej modifié', description: 'Dose recalculée sur le plan délivré — candidate au cumul',     status: 'optionnel', uploadable: true },
  { id: 'irmv',   nom: 'IRMv',            description: 'IRM de vérification après adaptation — non conservée par la machine', status: 'optionnel', uploadable: true },
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

  // Données facultatives rechargées après l'ATP
  const optionnel = d.decisions[n]?.atpOptionnel ?? {}
  const doseRechargee = optionnel.rtdose === true
  const atpFiles: DicomEntry[] = atpFilesRef.map(f => ({
    ...f,
    status: optionnel[f.id as 'rtplan' | 'rtdose' | 'irmv'] ? 'charge' : 'optionnel',
  }))

  // Écart du plan délivré au plan de référence — n'a de sens qu'une fois la
  // dose du plan délivré rechargée.
  const ecartsPlan = doseRechargee ? comparerAuPlanReference(seance.points) : []
  const ecartsNotables = ecartsPlan.filter(l => l.notable)

  // Contraintes effectivement retenues pour la séance (proposition ou saisie manuelle)
  const contraintes = d.propositions.filter(p => p.structure.type === 'oar')

  // Le score compare la projection de fin de traitement à l'objectif : il lui
  // faut donc la durée du protocole, pas seulement la séance du jour.
  const totalSeances = dossier.nbSeances
  const scoreEnsemble = scoreGlobal(
    contraintes.map(p => scorerContrainte(p.structure, p.cumul.projection, d.valeurTolerance(p.id), totalSeances)),
  )

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
            {/* Ce que l'ATP produit dépend de ce qui est revenu de la machine. */}
            {doseRechargee ? (
              <div className="text-xs text-ok-text bg-ok-bg border border-ok-border rounded-2xl px-4 py-2.5">
                La dose du plan délivré a été rechargée : la dose de cette séance n'est plus une
                estimation, et la séance sort de l'état « information réduite ».
              </div>
            ) : (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-2xl px-4 py-2.5">
                Sans rechargement, la dose de la séance est estimée en appliquant le plan de
                référence sur le recalage rigide, d'où une confiance dégradée et un état
                « séance à information réduite » dans la frise.
                <span className="text-clinical"> [récupérabilité des décalages de table — point non arrêté]</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Données facultatives d'une séance ATP ── */}
      {decision === 'ATP' && (
        <DataUploadZone
          title="Données facultatives — si le plan a été retouché ou vérifié"
          entries={atpFiles}
          accentColor="blue"
          readOnly={!canUpload}
          onUpload={id => d.chargerOptionnelATP(n, id as 'rtplan' | 'rtdose' | 'irmv', true)}
        />
      )}

      {/* ── Écart du plan délivré au plan de référence ── */}
      {decision === 'ATP' && doseRechargee && (
        <div className="bg-white rounded-3xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-800">Plan délivré contre plan de référence</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Ce que change la retouche du plan, structure par structure, pour cette séance
              </div>
            </div>
            <span className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap ${
              ecartsNotables.length === 0
                ? 'bg-ok-bg text-ok-text border-ok-border'
                : 'bg-warn-bg text-warn-text border-warn-border'
            }`}>
              {ecartsNotables.length === 0
                ? `Aucun écart au-delà de ${SEUIL_ECART_PLAN_PCT} %`
                : `${ecartsNotables.length} écart(s) au-delà de ${SEUIL_ECART_PLAN_PCT} %`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="text-left font-semibold px-5 py-2.5">Structure</th>
                  <th className="text-right font-semibold px-5 py-2.5">Plan de référence</th>
                  <th className="text-right font-semibold px-5 py-2.5">Plan délivré</th>
                  <th className="text-right font-semibold px-5 py-2.5">Écart</th>
                </tr>
              </thead>
              <tbody>
                {ecartsPlan.map(l => (
                  <tr key={l.structure.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5 text-slate-700 whitespace-nowrap">
                      {l.structure.nom} <span className="text-slate-400">{l.structure.metrique}</span>
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs text-slate-400 whitespace-nowrap">
                      {fmt(l.reference, 2)} {l.structure.unite}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs text-slate-700 whitespace-nowrap">
                      {fmt(l.delivre, 2)} {l.structure.unite}
                    </td>
                    <td className={`px-5 py-2.5 text-right font-mono text-xs whitespace-nowrap ${
                      l.notable ? 'text-warn-text font-semibold' : 'text-slate-400'
                    }`}>
                      {fmtSigne(l.ecart, 2)} ({fmtPct(l.ecartPct)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 leading-relaxed">
            Le plan de référence n'a pas été appliqué tel quel : le cumul retient la dose du plan
            délivré, pas celle qu'aurait donnée le plan de référence.
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
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {['OAR', 'Contrainte', 'Référence', 'Retenue', 'Tolérance', 'Ajustement', 'Cumul / Prévu', 'Score'].map(h => (
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
                    const tolerance = d.valeurTolerance(p.id)
                    const signe = s.sens === 'max' ? '\u2264' : '\u2265'
                    const score = scorerContrainte(s, p.cumul.projection, tolerance, totalSeances)
                    const contrainteModifiee = Math.abs(valeur - p.valeurProposee) > 1e-9
                    const toleranceModifiee = Math.abs(tolerance - s.toleranceRef) > 1e-9
                    return (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-700">{s.nom}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{s.metrique}</td>
                        <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                          {signe} {fmt(p.valeurRef)} {s.unite}
                        </td>

                        {/* Contrainte retenue \u2014 modifiable ici, sans quitter le workflow */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-mono">{signe}</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              value={valeur}
                              disabled={!canUpload}
                              onChange={e => {
                                const v = parseFloat(e.target.value)
                                if (isFinite(v) && v >= 0) d.editerContrainte(p.id, v)
                              }}
                              className={`w-20 font-mono font-semibold rounded-lg border px-2 py-1
                                focus:outline-none focus:border-clinical disabled:bg-slate-50 disabled:cursor-not-allowed
                                ${contrainteModifiee ? 'border-clinical text-clinical bg-clinical-light' : 'border-slate-200 text-slate-700'}`}
                            />
                            <span className="text-slate-400">{s.unite}</span>
                            {contrainteModifiee && (
                              <button
                                onClick={() => d.reinitialiserContrainte(p.id)}
                                title="Revenir à la proposition DIMADOSE"
                                className="text-slate-300 hover:text-clinical transition-colors px-1"
                              >
                                &#8634;
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Tolérance admise \u2014 convention d'équipe, pas une constante */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-mono">&#177;</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              value={tolerance}
                              disabled={!canUpload}
                              onChange={e => {
                                const v = parseFloat(e.target.value)
                                if (isFinite(v) && v >= 0) d.editerTolerance(p.id, v)
                              }}
                              className={`w-20 font-mono rounded-lg border px-2 py-1
                                focus:outline-none focus:border-clinical disabled:bg-slate-50 disabled:cursor-not-allowed
                                ${toleranceModifiee ? 'border-clinical text-clinical bg-clinical-light' : 'border-slate-200 text-slate-600'}`}
                            />
                            <span className="text-slate-400">{s.unite}</span>
                          </div>
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

                        {/* Score : lecture de la projection contre l'objectif, a l'echelle
                            de la tolerance. Le detail est en pied de tableau. */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div
                            className="flex items-center gap-2 cursor-help"
                            title={`Projection fin de traitement ${formatNombre(p.cumul.projection, 1)} ${s.unite} `
                              + `pour un objectif de ${formatNombre(s.objectifTotal, 1)} ${s.unite} \u00b7 `
                              + `marge ${fmtSigne(score.marge, 1)} ${s.unite}`}
                          >
                            <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
                              <div
                                className={`h-full rounded-full ${
                                  score.niveau === 'ok' ? 'bg-ok' : score.niveau === 'warn' ? 'bg-warn' : 'bg-danger'
                                }`}
                                style={{ width: `${score.valeur}%` }}
                              />
                            </div>
                            <span className={`font-mono font-semibold ${
                              score.niveau === 'ok' ? 'text-ok-text' : score.niveau === 'warn' ? 'text-warn-text' : 'text-danger-text'
                            }`}>
                              {score.valeur}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {scoreEnsemble && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-100 bg-slate-50/70">
                      <td colSpan={7} className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wider">
                        Score d&#39;ensemble
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-mono text-base font-bold ${
                          scoreEnsemble.niveau === 'ok' ? 'text-ok-text' : scoreEnsemble.niveau === 'warn' ? 'text-warn-text' : 'text-danger-text'
                        }`}>
                          {scoreEnsemble.valeur}
                        </span>
                        <span className="text-slate-400"> / 100</span>
                        <span className="text-slate-400 ml-2">{scoreEnsemble.libelle}</span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 leading-relaxed">
              <p>
                Aucun échange automatique avec le TPS : ces valeurs sont recopiées à la main par le
                physicien. Contraintes et tolérances se modifient ici ; chaque changement part au
                journal avec sa valeur d'origine.
              </p>
              <p className="mt-1.5">
                <strong className="text-slate-500">Le score n'est pas un indice clinique validé.</strong>{' '}
                Il place la projection de fin de traitement par rapport à l'objectif, à l'échelle de
                la tolérance : 100 quand la projection reste à une tolérance entière du plafond,
                50 quand elle est exactement sur l'objectif, 0 quand elle le dépasse d'une tolérance
                entière. Il sert à parcourir le tableau, pas à décider — la décision reste sur les
                valeurs.
              </p>
              <p className="mt-1.5">
                Il ne dit pas la même chose que la colonne <em>Cumul / Prévu</em>, et les deux
                peuvent diverger : une structure peut dériver nettement par rapport au prévisionnel
                tout en restant loin de son objectif de fin de traitement — elle aura alors un écart
                signalé et un score confortable. L'écart dit la tendance, le score dit la marge.
              </p>
            </div>
          </div>

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

      {/* ── Données optionnelles, après le cumul : elles ne conditionnent rien ── */}
      {decision === 'ATS' && (
        <DataUploadZone
          title="Données optionnelles"
          entries={optionalFiles}
          accentColor="blue"
          readOnly={!canUpload}
        />
      )}
    </div>
  )
}
