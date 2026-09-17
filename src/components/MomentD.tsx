import { useState } from 'react'
import { dossier, formatNombre } from '../data'
import {
  exporterTrace,
  fmtSigne,
  formatDateCourte,
  grouperTraceParSeance,
  labelCategorieTrace,
  labelDeformation,
  labelQualite,
  labelRangTrace,
  labelStatutFinal,
  niveauDeformation,
  niveauQualite,
  rangCategorieTrace,
  type Niveau,
  type RangTrace,
} from '../logic'
import { useDossier } from '../store'
import {
  Card,
  ConfianceIndicator,
  DoseReconstruiteNote,
  DVHPlaceholder,
  SectionTitle,
  StatusBadge,
  TrajectoireCumul,
} from './shared'

/** Heure seule : la date est portée par l'en-tête de groupe. */
const formatHeure = (iso: string): string => {
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const fondEvenement: Record<Niveau, string> = {
  ok: 'bg-ok-bg border-ok-border',
  warn: 'bg-warn-bg border-warn-border',
  danger: 'bg-danger-bg border-danger-border',
  neutral: 'bg-slate-50 border-slate-200',
}

export default function MomentD() {
  const d = useDossier()
  const identite = d.identite(dossier)
  const r = d.rapport
  const [structureTracee, setStructureTracee] = useState('rectum-d05')
  const [journalExporte, setJournalExporte] = useState(false)
  const [filtre, setFiltre] = useState<'tout' | RangTrace>('tout')

  const traceFiltree = filtre === 'tout'
    ? d.trace
    : d.trace.filter(e => rangCategorieTrace[e.categorie] === filtre)
  const groupes = grouperTraceParSeance(traceFiltree)
  const ecarts = d.trace.filter(e => e.ecart).length

  const exporterJournal = () => {
    const texte = exporterTrace(d.trace, [
      `DIMADOSE — journal de traçabilité · ${identite.libelle} · ${identite.identifiant}`,
      `${r.seancesRealisees.length} séance(s) réalisée(s) sur ${dossier.nbSeances}`,
      'Horodatage	Séance	Rang	Nature	Acte	Détail	Auteur	Écart',
    ])
    const url = URL.createObjectURL(new Blob([texte], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `dimadose-journal-${identite.identifiant}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setJournalExporte(true)
    setTimeout(() => setJournalExporte(false), 2000)
  }

  const exporterRapport = () => {
    d.tracerExport(
      'Rapport de traitement exporté en PDF',
      `${r.seancesRealisees.length} séance(s) réalisée(s) · confiance du cumul ${r.recap.confiance}`,
    )
    window.print()
  }

  const cumulFinal = d.cumulJusqua(dossier.nbSeances)
  const traceable = cumulFinal.parStructure[structureTracee]

  return (
    <div className="flex flex-col gap-5">

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            Rapport {r.complet ? 'de fin de traitement' : 'provisoire'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {identite.libelle} · {identite.identifiant} · {dossier.protocole}{' '}
            {formatNombre(dossier.prescriptionTotale)} Gy / {dossier.nbSeances} fr ·{' '}
            {r.complet
              ? 'traitement clôturé'
              : `${r.seancesRealisees.length} séance(s) réalisée(s) sur ${dossier.nbSeances}`}
          </p>
        </div>
        <button
          onClick={exporterRapport}
          className="shrink-0 text-sm px-4 py-2 rounded-sm border font-medium bg-slate-800 text-white border-slate-800 hover:bg-slate-900 transition-colors"
        >
          Exporter en PDF
        </button>
      </div>

      {!r.complet && (
        <div className="bg-warn-bg border border-warn-border rounded-sm px-4 py-3 text-xs text-warn-text">
          <strong>Rapport provisoire.</strong> {r.seancesRestantes} séance(s) restent à réaliser.
          Les lignes « projection » prolongent le cumul au rythme du prévisionnel : elles ne
          décrivent pas une dose déjà reconstruite.
        </div>
      )}

      {/* ── Frise des séances ── */}
      <Card className="p-5">
        <SectionTitle>Frise des séances</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Séance', 'Date', 'Voie', 'Qualité IRM', 'Déformation', 'Sommation', 'Dose retenue', 'Confiance', 'Note'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.seances.map(s => {
                const atp = s.voie === 'ATP'
                if (!s.realisee) {
                  return (
                    <tr key={s.numero} className="border-b border-slate-100 text-slate-300">
                      <td className="px-3 py-3 font-mono text-sm">S{s.numero}</td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">{formatDateCourte(s.mesures.date)}</td>
                      <td className="px-3 py-3 text-xs italic" colSpan={6}>Séance à venir</td>
                      <td className="px-3 py-3" />
                    </tr>
                  )
                }
                return (
                  <tr
                    key={s.numero}
                    className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                      atp ? 'bg-slate-50/50' : ''
                    } ${!s.incluse ? 'opacity-60' : ''}`}
                  >
                    <td className="px-3 py-3 font-mono text-sm font-medium text-slate-800">S{s.numero}</td>
                    <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDateCourte(s.mesures.date)}</td>
                    <td className="px-3 py-3">
                      <span
                        title={atp ? 'Séance à information réduite' : undefined}
                        className={`text-xs font-bold px-2 py-0.5 rounded-sm border ${
                          atp
                            ? 'bg-slate-100 border-slate-200 text-slate-500'
                            : 'bg-warn-bg border-warn-border text-warn-text'
                        }`}
                      >
                        {s.voie}
                      </span>
                      {atp && <div className="text-slate-400 mt-0.5" style={{ fontSize: '10px' }}>info. réduite</div>}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge level={niveauQualite[s.qualite.verdict]}>
                        {labelQualite[s.qualite.verdict]}
                      </StatusBadge>
                      {s.qualite.revise && (
                        <div className="text-warn mt-0.5" style={{ fontSize: '10px' }}>révisé</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge level={niveauDeformation[s.deformation.verdict]}>
                        {labelDeformation[s.deformation.verdict]}
                      </StatusBadge>
                      {s.deformation.revise && (
                        <div className="text-warn mt-0.5" style={{ fontSize: '10px' }}>révisé</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {s.modeCumul === 'deformable'
                        ? 'Déformable'
                        : s.modeCumul === 'rigide'
                          ? 'Rigide'
                          : s.modeCumul === 'exclure'
                            ? 'Exclue'
                            : 'Non tranchée'}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded-sm border ${
                        s.doseRetenue === 'sct'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {s.doseRetenue === 'sct' ? 'sCT' : 'IRM'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <ConfianceIndicator niveau={s.confiance.niveau} motifs={s.confiance.motifs} />
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 max-w-xs">
                      {s.mesures.commentaire}
                      {s.motifsDeviationEnregistres.length > 0 && (
                        <div className="text-warn-text mt-0.5">
                          Recommandation non suivie — {s.motifsDeviationEnregistres[0]}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 px-4 py-2 bg-slate-50 rounded-sm border border-slate-100 text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
          <strong>Récapitulatif :</strong>
          <span>{r.seancesRealisees.length} séance(s) réalisée(s)</span>
          <span>· {r.recap.ats} ATS / {r.recap.atp} ATP</span>
          <span>· {r.recap.degradees} IRM dégradée(s)</span>
          <span>· {r.recap.deformations} déformation(s) importante(s)</span>
          <span>· {r.recap.exclues} séance(s) exclue(s) du cumul</span>
          <span>· IRMref : <span className="font-mono">{d.irmrefLabel}</span>, inchangée</span>
          <span className="ml-auto"><ConfianceIndicator niveau={r.recap.confiance} motifs={cumulFinal.motifsConfiance} /></span>
        </div>
      </Card>

      {/* ── Dose cumulée finale ── */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between mb-3">
          <SectionTitle>Dose cumulée — comparaison aux objectifs</SectionTitle>
          <DoseReconstruiteNote />
        </div>

        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Structure', 'Contrainte', 'Cumul réalisé', 'Projection fin', 'Objectif', 'Écart / objectif', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.lignes.map(l => {
                  const s = l.structure
                  const statut = labelStatutFinal[l.statut]
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                        s.type === 'cible' ? 'bg-blue-50/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-800 text-sm">{s.nom}</div>
                        <div className={`text-xs ${s.type === 'cible' ? 'text-blue-500' : 'text-slate-400'}`}>
                          {s.type === 'cible' ? 'Cible' : 'OAR'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {s.metrique} {s.sens === 'max' ? '≤' : '≥'} {formatNombre(s.objectifTotal, 1)} {s.unite}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-sm text-slate-800 whitespace-nowrap">
                        {formatNombre(l.cumulRealise, 1)}
                        <span className="text-slate-300"> ±{formatNombre(l.incertitude, 2)}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-sm whitespace-nowrap">
                        <span className={r.complet ? 'text-slate-800 font-medium' : 'text-slate-500 italic'}>
                          {formatNombre(l.projection, 1)} {s.unite}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-sm text-slate-600 whitespace-nowrap">
                        {formatNombre(l.objectif, 1)} {s.unite}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                        <span className={l.statut === 'depassement' ? 'text-danger font-semibold' : 'text-slate-500'}>
                          {fmtSigne(l.ecartObjectif, 1)} {s.unite}
                        </span>
                        <div className="text-slate-400">
                          prévisionnel {fmtSigne(l.ecartPrevisionnel, 1)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge level={statut.niveau}>{statut.label}</StatusBadge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DVHPlaceholder height={170} title={`DVH cumulé — ${r.seancesRealisees.length} séance(s)`} />
            {traceable && (
              <div className="flex flex-col gap-2">
                <TrajectoireCumul ligne={traceable} height={120} />
                <div className="flex flex-wrap gap-1">
                  {cumulFinal.lignes.filter(l => l.structure.type === 'oar').map(l => (
                    <button
                      key={l.structure.id}
                      onClick={() => setStructureTracee(l.structure.id)}
                      className={`text-xs px-2 py-1 rounded-sm border transition-colors ${
                        structureTracee === l.structure.id
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {l.structure.nom} {l.structure.metrique}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-sm text-xs text-slate-500">
          <strong>Rappel méthodologique :</strong> la dose affichée est une <em>dose reconstruite</em>,
          non une dose délivrée. Elle est calculée à partir du plan du jour, recalculé sur l'anatomie
          du jour, sans les effets des mouvements pendant l'irradiation — l'imagerie ciné 2D, le
          critère VOICE et les décalages temps réel ne sont pas exportés par la machine. La colonne
          « ± » donne l'incertitude héritée des verdicts des séances incluses.
        </div>
      </Card>

      {/* ── Événements et écarts notables ── */}
      <Card className="p-5">
        <SectionTitle>Événements et écarts notables</SectionTitle>
        {r.evenements.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun événement notable : toutes les séances réalisées sont exploitables, sans
            déformation importante ni exclusion.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {r.evenements.map((e, i) => (
              <div key={`${e.seance}-${i}`} className={`flex gap-4 p-3 rounded-sm border ${fondEvenement[e.niveau]}`}>
                <span className={`font-mono text-xs font-bold shrink-0 mt-0.5 ${
                  e.niveau === 'danger' ? 'text-danger' : e.niveau === 'warn' ? 'text-warn' : 'text-slate-500'
                }`}>
                  S{e.seance}
                </span>
                <div>
                  <div className={`text-sm font-semibold ${
                    e.niveau === 'danger' ? 'text-danger-text' : e.niveau === 'warn' ? 'text-warn-text' : 'text-slate-700'
                  }`}>
                    {e.titre}
                  </div>
                  <div className="text-xs mt-0.5 text-slate-600">{e.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Journal de traçabilité ── */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <SectionTitle>Journal de traçabilité</SectionTitle>
            <div className="flex items-center gap-3 text-xs text-slate-500 -mt-1">
              <span>{d.trace.length} acte(s) enregistré(s)</span>
              {ecarts > 0 && (
                <span className="text-warn-text bg-warn-bg border border-warn-border rounded-sm px-2 py-0.5">
                  {ecarts} écart(s) à une proposition de l'outil
                </span>
              )}
            </div>
          </div>
          <button
            onClick={exporterJournal}
            disabled={d.trace.length === 0}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-sm border transition-colors ${
              journalExporte
                ? 'bg-ok-bg text-ok-text border-ok-border'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {journalExporte ? '✓ Exporté' : 'Exporter le journal (.txt)'}
          </button>
        </div>

        {/* Filtre par nature d'acte : les décisions se lisent avant les réglages */}
        {d.trace.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(['tout', 'decision', 'verification', 'parametre'] as const).map(f => {
              const compte = f === 'tout'
                ? d.trace.length
                : d.trace.filter(e => rangCategorieTrace[e.categorie] === f).length
              return (
                <button
                  key={f}
                  onClick={() => setFiltre(f)}
                  disabled={compte === 0}
                  className={`text-xs px-3 py-1.5 rounded-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    filtre === f
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f === 'tout' ? 'Tous les actes' : labelRangTrace[f]}
                  <span className="ml-1.5 opacity-60">{compte}</span>
                </button>
              )
            })}
          </div>
        )}

        {traceFiltree.length === 0 ? (
          <p className="text-sm text-slate-500">
            {d.trace.length === 0
              ? "Aucun acte enregistré depuis l'ouverture du dossier. Les décisions des séances S1 "
                + "à S3 font partie de l'historique du patient, pas de ce journal."
              : 'Aucun acte de cette nature.'}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {groupes.map(groupe => (
              <div key={groupe.seance ?? 'dossier'}>
                {/* En-tête de groupe : le journal se lit séance par séance */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-700 font-mono">
                    {groupe.seance === null ? 'Dossier' : `Séance ${groupe.seance}`}
                  </span>
                  {groupe.seance !== null && (
                    <span className="text-xs text-slate-400">
                      {formatDateCourte(d.seance(groupe.seance).mesures.date)}
                    </span>
                  )}
                  <span className="h-px flex-1 bg-slate-100" />
                  <span className="text-xs text-slate-400">{groupe.entrees.length} acte(s)</span>
                </div>

                <ol className="border-l border-slate-200 ml-1.5 pl-4 flex flex-col gap-3">
                  {groupe.entrees.map(e => {
                    const critique = e.categorie === 'reacquisition'
                    return (
                      <li key={e.id} className="relative flex gap-3">
                        {/* Pastille sur la frise — la couleur ne marque que l'exception */}
                        <span
                          className={`absolute -left-[22px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                            critique ? 'bg-danger' : e.ecart ? 'bg-warn' : 'bg-slate-300'
                          }`}
                        />
                        <span className="text-xs font-mono text-slate-400 w-10 shrink-0 tabular-nums pt-0.5">
                          {formatHeure(e.horodatage)}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm text-slate-800 font-medium">{e.libelle}</span>
                            <span className="text-xs text-slate-400 border border-slate-200 rounded-sm px-1.5">
                              {labelCategorieTrace[e.categorie]}
                            </span>
                            {e.ecart && (
                              <span className="text-xs text-warn-text bg-warn-bg border border-warn-border rounded-sm px-1.5">
                                écart à la proposition
                              </span>
                            )}
                          </div>
                          {e.detail && (
                            <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                              {e.detail}
                            </div>
                          )}
                        </div>

                        <span className="text-xs text-slate-400 shrink-0 text-right leading-tight pt-0.5">
                          {e.auteur}
                          <span className="block text-slate-300">{e.role}</span>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 leading-relaxed">
          Journal en ajout seul, enregistré {d.stockagePersistant ? 'dans ce navigateur' : 'en mémoire uniquement'}.
          Il conserve les actes de l'équipe — étapes validées, voie retenue, verdicts révisés, cumul
          enregistré, contraintes ajustées et exports — avec ce que l'outil proposait, ce qui a été
          retenu, par qui et quand. La navigation entre écrans n'y figure pas.
        </p>
      </Card>
      <div className="text-xs text-slate-400 text-center py-4 border-t border-slate-200">
        DIMADOSE WP5 · AQUILAB by Coexya · Dose reconstruite — non délivrée ·
        Outil d'aide à la décision uniquement, ne remplace pas le jugement clinique
      </div>
    </div>
  )
}
