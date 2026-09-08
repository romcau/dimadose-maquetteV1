import { useState } from 'react'
import { dossier, formatNombre } from '../data'
import {
  exporterContraintes,
  fmt,
  fmtPct,
  fmtSigne,
  formatDateCourte,
  labelDirection,
  SEUILS,
  type PropositionContrainte,
} from '../logic'
import { useDossier } from '../store'
import {
  Card,
  DoseReconstruiteNote,
  SectionTitle,
  SectionTitleRow,
  StatusBadge,
  TrajectoireCumul,
  ValeurVsPrevu,
} from './shared'

export default function MomentC() {
  const d = useDossier()
  const n = d.seanceCourante
  const [enEdition, setEnEdition] = useState<string | null>(null)
  const [saisie, setSaisie] = useState('')
  const [copie, setCopie] = useState(false)
  const [exporte, setExporte] = useState(false)
  const [structureTracee, setStructureTracee] = useState('rectum-d05')

  const seance = d.seance(n)
  const voie = seance.voie

  const commencerEdition = (p: PropositionContrainte) => {
    setEnEdition(p.id)
    setSaisie(formatNombre(d.valeurContrainte(p.id)))
  }

  const validerEdition = (id: string) => {
    const num = parseFloat(saisie.replace(',', '.'))
    if (!isNaN(num) && num > 0) d.editerContrainte(id, num)
    setEnEdition(null)
  }

  const texteExport = () =>
    exporterContraintes(
      d.propositions,
      Object.fromEntries(d.propositions.map(p => [p.id, d.valeurContrainte(p.id)])),
      [
        `DIMADOSE — jeu de contraintes proposé pour la séance ${n} / ${dossier.nbSeances}`,
        `${dossier.nom} ${dossier.prenom} · ${dossier.id} · ${dossier.protocole}`,
        `Basé sur le cumul reconstruit S1–S${d.cumul.jusqua} (${d.cumul.seancesIncluses.length} séance(s) incluse(s))`,
        `Confiance du cumul : ${d.cumul.confiance}`,
        'À ressaisir manuellement dans le TPS Monaco — aucun échange automatique.',
      ],
    )

  const copier = () => {
    navigator.clipboard.writeText(texteExport()).then(() => {
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    })
  }

  const exporter = () => {
    const blob = new Blob([texteExport()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dimadose-contraintes-S${n}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setExporte(true)
    setTimeout(() => setExporte(false), 2000)
  }

  // ── Indicateurs de tête, dérivés du cumul ──
  const oars = d.cumul.lignes.filter(l => l.structure.type === 'oar')
  const pireDerive = oars.reduce((a, b) => (b.ecartRelatif > a.ecartRelatif ? b : a), oars[0])
  const plusGrandeMarge = oars.reduce((a, b) => (b.ecartRelatif < a.ecartRelatif ? b : a), oars[0])
  const ptv = d.cumul.parStructure['ptv-d95']
  const traceable = d.cumul.parStructure[structureTracee] ?? ptv

  return (
    <div className="flex flex-col gap-5">

      {/* ── Contexte ── */}
      <Card className="p-4 border-l-4 border-l-warn">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-semibold text-slate-800 mb-1">
              Contraintes proposées pour l'optimisation — séance {n}
              {voie ? ` (${voie})` : ' (voie non encore tranchée)'}
            </div>
            <p className="text-xs text-slate-600 max-w-3xl">
              Établies à partir du cumul S1–S{d.cumul.jusqua} (<DoseReconstruiteNote />). L'écart au
              prévisionnel est réparti sur les {d.cumul.seancesRestantes} séance(s) restante(s),
              plafonné à ±{(SEUILS.contraintes.ajustementMax * 100).toFixed(0)} % de la contrainte de
              référence, puis arrondi au pas de {formatNombre(SEUILS.contraintes.arrondi)} pour une
              ressaisie propre dans le TPS. Chaque ligne reste éditable et refusable.
            </p>
            {voie === 'ATP' && (
              <p className="mt-2 text-xs text-warn-text bg-warn-bg border border-warn-border rounded-sm px-3 py-2">
                La voie ATP a été retenue pour cette séance : le plan de référence est appliqué tel
                quel, aucune réoptimisation n'a lieu. Ce jeu de contraintes n'est présenté qu'à titre
                d'information.
              </p>
            )}
          </div>
          <div className="shrink-0 text-right text-xs text-slate-400">
            <div>{formatDateCourte(seance.mesures.date)}</div>
            <div>Physicien : {dossier.physicien}</div>
            <div>Médecin : {dossier.medecin}</div>
          </div>
        </div>
      </Card>

      {/* ── Récapitulatif du cumul ── */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-slate-500 mb-1">Séances incluses au cumul</div>
          <div className="text-xl font-bold font-mono text-slate-800">
            {d.cumul.seancesIncluses.length} / {dossier.nbSeances}
          </div>
          <div className="text-xs mt-1 text-slate-400">
            {d.cumul.seancesIncluses
              .map(num => `S${num} ${d.seance(num).voie}`)
              .join(' · ') || 'aucune séance incluse'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-slate-500 mb-1">PTV D95% cumulé</div>
          <div className="text-xl font-bold font-mono text-slate-800">
            {formatNombre(ptv.cumul, 1)} Gy
          </div>
          <div className="text-xs mt-1 text-slate-400">
            Prévu {formatNombre(ptv.prevu, 1)} Gy · {fmtPct(ptv.ecartRelatif)}
          </div>
        </Card>

        <Card className={`p-4 ${pireDerive.niveau === 'danger' ? 'border-danger-border' : ''}`}>
          <div className="text-xs text-slate-500 mb-1">
            Dérive maximale — {pireDerive.structure.nom} {pireDerive.structure.metrique}
          </div>
          <div className={`text-xl font-bold font-mono ${pireDerive.niveau === 'danger' ? 'text-danger' : 'text-slate-800'}`}>
            {formatNombre(pireDerive.cumul, 1)} {pireDerive.structure.unite}
          </div>
          <div className={`text-xs mt-1 ${pireDerive.niveau === 'danger' ? 'text-danger-text' : 'text-slate-400'}`}>
            Prévu {formatNombre(pireDerive.prevu, 1)} · {fmtSigne(pireDerive.ecart, 1)} {pireDerive.structure.unite} ▲
          </div>
        </Card>

        <Card className={`p-4 ${plusGrandeMarge.ecartRelatif < -SEUILS.cumul.margeBasse ? 'border-ok-border' : ''}`}>
          <div className="text-xs text-slate-500 mb-1">
            Marge maximale — {plusGrandeMarge.structure.nom} {plusGrandeMarge.structure.metrique}
          </div>
          <div className={`text-xl font-bold font-mono ${plusGrandeMarge.ecartRelatif < -SEUILS.cumul.margeBasse ? 'text-ok' : 'text-slate-800'}`}>
            {formatNombre(plusGrandeMarge.cumul, 1)} {plusGrandeMarge.structure.unite}
          </div>
          <div className={`text-xs mt-1 ${plusGrandeMarge.ecartRelatif < -SEUILS.cumul.margeBasse ? 'text-ok-text' : 'text-slate-400'}`}>
            Prévu {formatNombre(plusGrandeMarge.prevu, 1)} · {fmtSigne(plusGrandeMarge.ecart, 1)} {plusGrandeMarge.structure.unite} ▼
          </div>
        </Card>
      </div>

      {/* ── Tableau des contraintes ── */}
      <Card>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <SectionTitleRow>Tableau des contraintes — séance {n}</SectionTitleRow>
          <div className="flex gap-2">
            <button
              onClick={d.reinitialiserContraintes}
              disabled={!d.contraintesModifiees}
              className="text-xs px-3 py-1.5 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Tout remettre aux contraintes de référence
            </button>
            <button
              onClick={copier}
              className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                copie ? 'bg-ok-bg text-ok-text border-ok-border' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {copie ? '✓ Copié' : 'Copier'}
            </button>
            <button
              onClick={() => window.print()}
              className="text-xs px-3 py-1.5 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Imprimer
            </button>
            <button
              onClick={exporter}
              className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                exporte ? 'bg-ok-bg text-ok-text border-ok-border' : 'bg-slate-800 text-white border-slate-800 hover:bg-slate-900'
              }`}
            >
              {exporte ? '✓ Exporté' : 'Exporter (.txt)'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Structure', 'Contrainte réf.', `Proposée (S${n})`, 'Ajustement', 'Motif', 'Cumul / Prévu', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.propositions.map(p => {
                const s = p.structure
                const dir = labelDirection[p.direction]
                const valeur = d.valeurContrainte(p.id)
                const edite = valeur !== p.valeurProposee
                const signe = s.sens === 'max' ? '≤' : '≥'

                return (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                      s.type === 'cible' ? 'bg-blue-50/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 text-sm">{s.nom}</div>
                      <div className={`text-xs mt-0.5 ${s.type === 'cible' ? 'text-blue-500' : 'text-slate-400'}`}>
                        {s.type === 'cible' ? 'Cible' : 'OAR'}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono text-sm text-slate-600 whitespace-nowrap">
                      {s.metrique} {signe} {fmt(p.valeurRef)} {s.unite}
                    </td>

                    <td className="px-4 py-3">
                      {enEdition === p.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="text"
                            value={saisie}
                            onChange={e => setSaisie(e.target.value)}
                            onBlur={() => validerEdition(p.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') validerEdition(p.id)
                              if (e.key === 'Escape') setEnEdition(null)
                            }}
                            className="w-20 border border-blue-400 rounded-sm px-2 py-1 text-sm font-mono focus:outline-none"
                          />
                          <span className="text-xs text-slate-400">{s.unite}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => commencerEdition(p)}
                          title="Cliquer pour modifier"
                          className={`font-mono text-sm px-2 py-1 rounded-sm border transition-colors hover:border-blue-300 ${
                            edite
                              ? 'border-blue-200 bg-blue-50 text-blue-800'
                              : p.direction === 'unchanged'
                                ? 'border-transparent text-slate-800'
                                : 'border-slate-200 text-slate-800'
                          }`}
                        >
                          {s.metrique} {signe} {fmt(valeur)} {s.unite}
                        </button>
                      )}
                      {edite && (
                        <div className="text-xs text-blue-500 mt-1">
                          Saisie manuelle · proposition {fmt(p.valeurProposee)} {s.unite}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge level={dir.niveau}>{dir.label}</StatusBadge>
                      {p.direction !== 'unchanged' && (
                        <div className="text-xs text-slate-400 font-mono mt-1">
                          {fmtSigne(p.valeurProposee - p.valeurRef)} {s.unite}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">{p.motif}</td>

                    <td className="px-4 py-3 text-xs">
                      <ValeurVsPrevu
                        cumul={p.cumul.cumul}
                        prevu={p.cumul.prevu}
                        unite={s.unite}
                        niveau={p.cumul.niveau}
                      />
                      <div className="text-slate-400 font-mono mt-0.5">
                        {fmtPct(p.cumul.ecartRelatif)}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        {edite && (
                          <button
                            onClick={() => d.reinitialiserContrainte(p.id)}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            Revenir à la proposition
                          </button>
                        )}
                        {valeur !== p.valeurRef && (
                          <button
                            onClick={() => d.editerContrainte(p.id, p.valeurRef)}
                            className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                          >
                            Contrainte de référence
                          </button>
                        )}
                        <button
                          onClick={() => setStructureTracee(p.id)}
                          className={`text-xs hover:underline ${
                            structureTracee === p.id ? 'text-slate-700 font-medium' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Trajectoire
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-400">
          <span>Cliquer sur une valeur proposée pour la modifier · Entrée pour valider · Échap pour annuler</span>
          <span className="ml-auto italic">
            Valeurs à ressaisir manuellement dans le TPS Monaco. Aucun échange automatique.
          </span>
        </div>
      </Card>

      {/* ── Trajectoire du cumul ── */}
      <Card className="p-5">
        <SectionTitle>
          Trajectoire du cumul — {traceable.structure.nom} {traceable.structure.metrique} contre prévisionnel
        </SectionTitle>
        <TrajectoireCumul ligne={traceable} height={130} />
        <p className="mt-2 text-xs text-slate-400">
          {traceable.trajectoire.length === 0
            ? 'Aucune séance incluse au cumul pour le moment.'
            : `Cumul S1–S${d.cumul.jusqua} = ${formatNombre(traceable.cumul, 1)} ${traceable.structure.unite} `
              + `contre ${formatNombre(traceable.prevu, 1)} ${traceable.structure.unite} prévus (${fmtPct(traceable.ecartRelatif)}) · `
              + `projection fin de traitement ${formatNombre(traceable.projection, 1)} ${traceable.structure.unite} `
              + `pour un objectif de ${formatNombre(traceable.structure.objectifTotal, 1)} ${traceable.structure.unite}.`}
        </p>
      </Card>
    </div>
  )
}
