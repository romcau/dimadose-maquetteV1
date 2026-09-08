import { useState } from 'react'
import { dossier, libellesRoles, motifsDeviation } from '../data'
import { fmt, formatDateCourte, type Niveau, type Voie } from '../logic'
import { useDossier } from '../store'
import { ConfianceIndicator, DoseReconstruiteNote } from './shared'

const niveauStyles: Record<Niveau, string> = {
  ok: 'bg-ok-bg border-ok-border text-ok-text',
  warn: 'bg-warn-bg border-warn-border text-warn-text',
  danger: 'bg-danger-bg border-danger-border text-danger-text',
  neutral: 'bg-slate-50 border-slate-200 text-slate-600',
}

interface Props {
  onAtsConfirmed?: () => void
}

export default function MomentB({ onAtsConfirmed }: Props) {
  const d = useDossier()
  const n = d.seanceCourante
  const reco = d.recommandation
  const seance = d.seance(n)
  const autreVoie: Voie = reco.voie === 'ATS' ? 'ATP' : 'ATS'

  const [etape, setEtape] = useState<'verdict' | 'motif'>('verdict')
  const [motifs, setMotifs] = useState<string[]>([])
  const [texte, setTexte] = useState('')

  const decisionPrise = seance.voie !== null
  const recoSuivie = seance.voie === reco.voie

  const toggle = (m: string) =>
    setMotifs(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]))

  const suivre = () => {
    d.enregistrerVoie(n, reco.voie)
    setEtape('verdict')
  }

  const confirmerAutre = () => {
    d.enregistrerVoie(n, autreVoie, motifs, texte.trim() || undefined)
    setEtape('verdict')
  }

  const reprendre = () => {
    d.annulerVoie(n)
    setMotifs([])
    setTexte('')
    setEtape('verdict')
  }

  // ── Décision déjà enregistrée ──
  if (decisionPrise) {
    return (
      <div className="max-w-2xl mx-auto py-10 flex flex-col items-center gap-5">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl">✓</div>
        <div className="text-xl font-semibold text-slate-800">Décision enregistrée</div>
        <div className="text-slate-500 text-sm text-center">
          <strong className="text-slate-700">{seance.voie}</strong> retenu pour la séance {n} ·{' '}
          {recoSuivie ? 'recommandation suivie' : 'autre voie choisie'} ·{' '}
          {formatDateCourte(seance.mesures.date)}
        </div>

        {!recoSuivie && seance.motifsDeviationEnregistres.length > 0 && (
          <div className="w-full bg-slate-50 border border-slate-200 rounded-sm p-4">
            <div className="text-xs font-semibold text-slate-600 mb-2">
              Motifs enregistrés (recommandation {reco.voie} non suivie)
            </div>
            <ul className="text-xs text-slate-600 flex flex-col gap-1">
              {seance.motifsDeviationEnregistres.map(m => <li key={m}>· {m}</li>)}
            </ul>
          </div>
        )}

        {seance.voie === 'ATS' && onAtsConfirmed && (
          <div className="w-full max-w-sm bg-warn-bg border border-warn-border rounded-sm p-5 text-center">
            <div className="text-sm font-semibold text-warn-text mb-2">ATS retenu — étape suivante</div>
            <p className="text-xs text-slate-600 mb-4">
              Consulter les contraintes d'optimisation proposées pour la réoptimisation du plan
              de la séance {n}.
            </p>
            <button
              onClick={onAtsConfirmed}
              className="w-full bg-warn hover:bg-amber-700 text-white font-semibold py-2.5 rounded-sm text-sm transition-colors"
            >
              Aller aux contraintes ATS →
            </button>
          </div>
        )}

        <button onClick={reprendre} className="text-sm text-slate-400 hover:text-slate-600">
          Modifier la décision
        </button>
      </div>
    )
  }

  const styleVerdict = reco.voie === 'ATS'
    ? 'bg-warn-bg border-warn-border text-warn'
    : 'bg-ok-bg border-ok-border text-ok'

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">

      {/* ── Verdict — lisible sans défilement ── */}
      <div className={`border-2 rounded-sm p-8 text-center ${styleVerdict}`}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3 opacity-80">
          Recommandation — Séance {n} / {dossier.nbSeances}
        </div>
        <div className="text-8xl font-bold tracking-tight leading-none mb-3">{reco.voie}</div>
        <div className="text-base font-medium">
          {reco.voie === 'ATS' ? 'Adaptation complète recommandée' : 'Adaptation simple suffisante'}
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs opacity-80">
          <ConfianceIndicator niveau={reco.confiance} motifs={d.cumul.motifsConfiance} />
          <span>·</span>
          <span>Basé sur l'historique S1–S{n - 1}</span>
          <span>·</span>
          <DoseReconstruiteNote />
        </div>
      </div>

      {/* ── Frise historique ── */}
      <div className="bg-white border border-slate-200 rounded-sm px-5 py-3 flex items-center gap-4">
        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider shrink-0">Historique</span>
        <div className="flex items-center gap-2 flex-1">
          {d.seances.map(s => {
            const passee = s.numero < n
            const courante = s.numero === n
            return (
              <div key={s.numero} className="flex flex-col items-center gap-1">
                <span
                  title={passee ? s.confiance.motifs.join(' · ') : undefined}
                  className={`text-xs font-bold px-2.5 py-1 rounded-sm border ${
                    courante
                      ? 'bg-slate-900 border-slate-700 text-white'
                      : !passee
                        ? 'border-dashed border-slate-300 text-slate-400 opacity-50'
                        : s.voie === 'ATS'
                          ? 'bg-warn-bg border-warn-border text-warn-text'
                          : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  {courante ? '?' : (s.voie ?? '—')}
                </span>
                <span className="text-xs text-slate-400 font-mono">S{s.numero}</span>
                {passee && (
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    !s.incluse
                      ? 'bg-slate-300'
                      : s.confiance.niveau === 'haute'
                        ? 'bg-ok'
                        : s.confiance.niveau === 'moyenne'
                          ? 'bg-warn'
                          : 'bg-danger'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
        <span className="text-xs text-slate-400 shrink-0 text-right">
          {reco.historique.ats} ATS / {reco.historique.atp} ATP<br />
          sur {reco.historique.total} séance(s)
        </span>
      </div>

      {/* ── Justifications ── */}
      <div className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Justification — historique cumulé et recalage rigide du jour
          </div>
          <div className="text-xs text-slate-400 font-mono" title="Somme des poids des critères déclenchés">
            score {fmt(reco.score, 1)} / seuil {fmt(reco.seuil, 1)}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {reco.justifications.map(j => (
            <div key={j.titre} className={`flex gap-3 items-start p-3 border rounded-sm ${niveauStyles[j.niveau]}`}>
              <span className="font-bold text-base mt-0.5 shrink-0">{j.icone}</span>
              <div className="min-w-0">
                <div className="font-semibold text-sm flex items-center gap-2">
                  {j.titre}
                  {j.poids > 0 && (
                    <span className="text-xs font-mono opacity-50">+{fmt(j.poids, 1)}</span>
                  )}
                </div>
                <div className="text-xs mt-0.5 opacity-80 font-mono leading-relaxed">{j.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
          Aucun contour, DVH ni volume du jour n'existe à ce stade : l'IRMj vient d'être acquise et
          seulement recalée rigidement. L'évaluation repose uniquement sur le cumul reconstruit
          S1–S{n - 1} et sur les décalages du recalage.
        </p>

        {d.cumul.seancesNonValidees.length > 0 && (
          <p className="mt-2 text-xs text-warn-text bg-warn-bg border border-warn-border rounded-sm px-3 py-2">
            Séance(s) S{d.cumul.seancesNonValidees.join(', S')} incluse(s) au cumul mais pas encore
            validée(s) par le physicien.
          </p>
        )}
        {d.cumul.seancesExclues.length > 0 && (
          <p className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-sm px-3 py-2">
            Séance(s) S{d.cumul.seancesExclues.join(', S')} exclue(s) du cumul — la recommandation
            ne décrit qu'une partie du traitement délivré.
          </p>
        )}
      </div>

      {/* ── Deux sorties de poids visuel égal ── */}
      {!d.droits.peutDeciderVoie && (
        <div className="bg-slate-100 border border-slate-200 rounded-sm px-5 py-4 text-sm text-slate-600">
          Profil <strong>{libellesRoles[d.utilisateur.role]}</strong> — écran de consultation.
          La décision entre ATP et ATS est tranchée par le radiothérapeute.
        </div>
      )}

      {d.droits.peutDeciderVoie && etape === 'verdict' && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={suivre}
            className="bg-white hover:bg-slate-50 border-2 border-slate-800 text-slate-800 py-6 px-5 rounded-sm font-semibold text-base transition-colors text-left"
          >
            Suivre la recommandation
            <div className="text-xs font-normal mt-1.5 opacity-80">
              {reco.voie === 'ATS'
                ? "Lancer l'adaptation complète (recontourage + réoptimisation)"
                : 'Procéder par ATP (décalage de table, plan de référence)'}
            </div>
          </button>
          <button
            onClick={() => setEtape('motif')}
            className="bg-white hover:bg-slate-50 border-2 border-slate-800 text-slate-800 py-6 px-5 rounded-sm font-semibold text-base transition-colors text-left"
          >
            Choisir l'autre voie
            <div className="text-xs font-normal mt-1.5 text-slate-500">
              {autreVoie === 'ATS'
                ? 'Recontourer et réoptimiser malgré la recommandation'
                : 'Décalage de table uniquement, plan de référence conservé'}
            </div>
          </button>
        </div>
      )}

      {/* ── Motif de déviation ── */}
      {d.droits.peutDeciderVoie && etape === 'motif' && (
        <div className="bg-white border border-slate-200 rounded-sm p-5">
          <div className="text-sm font-semibold text-slate-800 mb-1">
            Motif du choix {autreVoie}
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Requis pour la traçabilité. Sélectionner au moins un motif — il sera repris dans le
            rapport de fin de traitement.
          </p>
          <div className="flex flex-col gap-2 mb-4">
            {motifsDeviation.map(m => (
              <label key={m} className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={motifs.includes(m)}
                  onChange={() => toggle(m)}
                  className="w-4 h-4 accent-blue-600 shrink-0"
                />
                {m}
              </label>
            ))}
          </div>
          <textarea
            value={texte}
            onChange={e => setTexte(e.target.value)}
            placeholder="Précisions libres (facultatif)…"
            className="w-full border border-slate-200 rounded-sm p-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:border-blue-400 transition-colors"
            rows={3}
          />
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={confirmerAutre}
              disabled={motifs.length === 0}
              className="bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-sm text-sm font-medium transition-colors"
            >
              Confirmer le choix {autreVoie}
            </button>
            <button onClick={() => setEtape('verdict')} className="text-sm text-slate-500 hover:text-slate-700">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
