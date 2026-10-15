/* ─────────────────────────────────────────────────────────────────────────────
 * Évaluation des séances déjà délivrées — ce qui entre au cumul.
 *
 * Le brief en fait un temps à part (« entre deux séances ») : la séance est
 * passée, rien ne presse, et trois vérifications s'enchaînent avant que sa dose
 * rejoigne le cumul — qualité de l'IRM, ampleur de la déformation, distribution
 * de dose retenue. Chacune est révisable, aucune n'est imposée.
 *
 * Elle vit ici, au haut de l'étape 2, et non sur un écran séparé : c'est le
 * cumul des séances précédentes qui motive la décision ATP / ATS prise juste
 * après. Repliée par défaut, elle s'ouvre d'elle-même quand une séance réclame
 * un arbitrage — sans quoi l'écran du jour, qui doit se lire en trente
 * secondes, se noierait dans l'historique.
 *
 * Rien ne s'y valide : la validation inter-séance a été retirée du parcours.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState, type ReactNode } from 'react'
import { criteresComparaisonDose } from '../data'
import {
  fmt,
  fmtSigne,
  formatDateCourte,
  labelDeformation,
  labelModeCumul,
  labelQualite,
  niveauDeformation,
  niveauQualite,
  type CandidateDose,
  type ModeCumul,
  type VerdictDeformation,
  type VerdictQualite,
} from '../logic'
import { useDossier } from '../store'
import { ConfianceIndicator, StatusBadge, ValeurVsPrevu } from './shared'

/* Les trois issues prévues au brief quand la déformation est importante. */
const modesCumul: { val: ModeCumul; label: string; sub: string }[] = [
  {
    val: 'deformable',
    label: "Cumuler par recalage déformable — en signalant l'incertitude",
    sub: 'La dose entre au cumul ; la séance portera une confiance dégradée.',
  },
  {
    val: 'rigide',
    label: 'Cumuler par recalage rigide seulement',
    sub: "Moins fidèle à l'anatomie du jour, mais robuste aux grandes déformations.",
  },
  {
    val: 'exclure',
    label: 'Exclure la séance du cumul',
    sub: 'La séance est listée comme exclue dans le rapport de traitement.',
  },
]

interface Props {
  /** Séance du jour : on évalue celles qui la précèdent. */
  seance: number
  /** Faux en lecture seule ou étape verrouillée. */
  modifiable: boolean
}

export default function EvaluationSeances({ seance: courante, modifiable }: Props) {
  const d = useDossier()

  const evaluables = d.seances.filter(s => s.realisee && s.numero < courante)
  const derniere = evaluables[evaluables.length - 1]
  // Ce qui réclame un arbitrage : une sommation non tranchée (la séance reste
  // alors hors du cumul) ou une image qui n'est pas pleinement exploitable.
  const aRevoir = evaluables.filter(s => s.modeCumulEnAttente || s.qualite.verdict !== 'exploitable')

  const [ouvert, setOuvert] = useState(aRevoir.length > 0)
  const [selection, setSelection] = useState(aRevoir[0]?.numero ?? derniere?.numero ?? 1)

  if (evaluables.length === 0) return null

  const s = d.seance(selection)
  const cumul = d.cumulJusqua(courante - 1)
  const peut = modifiable && !d.droits.lectureSeule

  return (
    <div className="bg-white rounded-3xl overflow-hidden">

      {/* ── En-tête : l'essentiel reste lisible replié ── */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800">
            Séances précédentes — ce qui entre au cumul
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {cumul.seancesIncluses.length} séance(s) sommée(s)
            {cumul.seancesIncluses.length > 0 && ` : S${cumul.seancesIncluses.join(', S')}`}
            {cumul.seancesExclues.length > 0 && ` · exclue(s) : S${cumul.seancesExclues.join(', S')}`}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ConfianceIndicator niveau={cumul.confiance} motifs={cumul.motifsConfiance} />
          {aRevoir.length > 0 && <StatusBadge level="warn">{aRevoir.length} à revoir</StatusBadge>}
          <button
            onClick={() => setOuvert(v => !v)}
            className="text-xs text-clinical/70 hover:text-clinical transition-colors"
          >
            {ouvert ? 'Replier' : 'Déplier'}
          </button>
        </div>
      </div>

      {ouvert && (
        <div className="p-4 flex flex-col gap-4">

          {/* ── Quelle séance ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {evaluables.map(e => (
              <button
                key={e.numero}
                onClick={() => setSelection(e.numero)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  selection === e.numero
                    ? 'bg-clinical text-white border-clinical'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-clinical/40'
                }`}
              >
                <span className="font-mono">S{e.numero}</span>
                <span className={selection === e.numero ? 'opacity-80' : 'text-slate-400'}>
                  {e.voie ?? '—'}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    e.confiance.niveau === 'haute'
                      ? 'bg-ok'
                      : e.confiance.niveau === 'moyenne'
                        ? 'bg-warn'
                        : 'bg-danger'
                  }`}
                />
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-400">
              {formatDateCourte(s.mesures.date)}
              {s.voie === 'ATP' && ' · séance à information réduite'}
            </span>
          </div>

          {/* ── 1. Qualité de l'IRM ── */}
          <Bloc
            index={1}
            titre={`Qualité de l'IRM — S${selection}`}
            badge={
              <StatusBadge level={niveauQualite[s.qualite.verdict]}>
                {labelQualite[s.qualite.verdict]}
              </StatusBadge>
            }
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {s.qualite.criteres.map(c => (
                <div
                  key={c.label}
                  className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-50"
                >
                  <span className="text-slate-500" title={`Seuil : ${c.seuil}`}>{c.label}</span>
                  <StatusBadge level={c.niveau}>{c.valeur}</StatusBadge>
                </div>
              ))}
            </div>

            {s.qualite.motifs.length > 0 && (
              <p className="mt-2 text-xs text-warn-text bg-warn-bg border border-warn-border rounded-2xl px-3 py-2">
                {s.qualite.motifs.join(' · ')}
              </p>
            )}

            <Revision
              valeurAuto={labelQualite[s.qualite.verdictAuto]}
              revise={s.qualite.revise}
              modifiable={peut}
              options={(['exploitable', 'degradee', 'inexploitable'] as VerdictQualite[]).map(v => ({
                val: v,
                label: labelQualite[v],
                actif: s.qualite.verdict === v,
              }))}
              onChoisir={v => d.reviserQualite(selection, v as VerdictQualite)}
              onRevenir={() => d.reviserQualite(selection, undefined)}
            />

            {s.qualite.verdict !== 'exploitable' && (
              <div
                className={`mt-3 rounded-2xl px-4 py-3 text-xs flex items-start gap-3 ${
                  s.qualite.verdict === 'inexploitable'
                    ? 'bg-danger-bg border border-danger-border text-danger-text'
                    : 'bg-warn-bg border border-warn-border text-warn-text'
                }`}
              >
                <div className="flex-1 leading-relaxed">
                  {s.qualite.verdict === 'inexploitable'
                    ? "Image inexploitable. Le contrôle qualité est rétrospectif : la séance ne peut "
                      + 'plus être réacquise. Elle doit être exclue du cumul, ou cumulée avec une '
                      + 'incertitude explicite — le choix se fait au point 2.'
                    : "Image dégradée : la séance reste exploitable, mais l'incertitude portée par "
                      + 'son cumul est majorée.'}
                  {s.reacquisitionDemandee && (
                    <div className="mt-1.5 font-semibold">
                      Nouvelle acquisition demandée — consigne enregistrée pour les séances
                      suivantes, et reprise au rapport.
                    </div>
                  )}
                </div>
                {peut && (
                  <button
                    onClick={() => d.demanderReacquisition(selection, !s.reacquisitionDemandee)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-xl border border-current font-semibold bg-white/70 hover:bg-white transition-colors"
                  >
                    {s.reacquisitionDemandee ? 'Annuler la demande' : 'Demander une nouvelle acquisition'}
                  </button>
                )}
              </div>
            )}
          </Bloc>

          {/* ── 2. Déformation anatomique ── */}
          <Bloc
            index={2}
            titre={`Déformation anatomique — S${selection}`}
            badge={
              <StatusBadge level={niveauDeformation[s.deformation.verdict]}>
                Déformation {labelDeformation[s.deformation.verdict].toLowerCase()}
              </StatusBadge>
            }
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {s.deformation.criteres.map(c => (
                <div
                  key={c.label}
                  className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-50"
                >
                  <span className="text-slate-500">{c.label}</span>
                  <span className="flex items-center gap-2 font-mono">
                    <span className={c.niveau === 'ok' ? 'text-slate-700 font-semibold' : 'text-warn-text font-semibold'}>
                      {c.valeur}
                    </span>
                    <span className="text-slate-300">seuil {c.seuil}</span>
                  </span>
                </div>
              ))}
            </div>

            {s.deformation.verdict === 'importante' ? (
              <div className="mt-3 border border-warn-border bg-warn-bg rounded-2xl p-3">
                <div className="text-xs font-semibold text-warn-text mb-2">
                  Déformation importante — la façon de sommer S{selection} doit être choisie :
                </div>
                <div className="flex flex-col gap-1.5">
                  {modesCumul.map(opt => (
                    <label
                      key={opt.val}
                      className={`flex items-start gap-3 px-3 py-2 rounded-xl border transition-colors ${
                        peut ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        s.modeCumul === opt.val
                          ? 'bg-white border-clinical'
                          : 'bg-white/60 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`cumul-${selection}`}
                        checked={s.modeCumul === opt.val}
                        onChange={() => d.choisirModeCumul(selection, opt.val)}
                        disabled={!peut}
                        className="mt-0.5 accent-clinical shrink-0 disabled:cursor-not-allowed"
                      />
                      <div>
                        <div className="text-xs font-semibold text-slate-700">{opt.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {s.modeCumulEnAttente && (
                  <p className="mt-2 text-xs font-semibold text-warn-text">
                    Aucune option n'est présélectionnée. Tant que le choix n'est pas fait, la
                    séance n'entre pas dans le cumul.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Déformation acceptable — sommation par recalage déformable.
              </p>
            )}

            <Revision
              valeurAuto={labelDeformation[s.deformation.verdictAuto]}
              revise={s.deformation.revise}
              modifiable={peut}
              options={(['acceptable', 'importante'] as VerdictDeformation[]).map(v => ({
                val: v,
                label: labelDeformation[v],
                actif: s.deformation.verdict === v,
              }))}
              onChoisir={v => d.reviserDeformation(selection, v as VerdictDeformation)}
              onRevenir={() => d.reviserDeformation(selection, undefined)}
            />
          </Bloc>

          {/* ── 3. Distribution de dose versée au cumul ── */}
          <Bloc
            index={3}
            titre={`Dose versée au cumul — S${selection}`}
            badge={
              <StatusBadge level="neutral">
                {s.doseRetenue === 'sct' ? 'RTDose sCT' : 'RTDosej (IRM)'}
                {s.doseRetenueParDefaut && ' — par défaut'}
              </StatusBadge>
            }
          >
            {!s.comparaison.disponible ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-600">
                {s.comparaison.motifDefaut}
                <div className="mt-1 font-mono text-slate-400">Candidate unique : RTDosej (IRM)</div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(['irm', 'sct'] as CandidateDose[]).map(type => (
                    <label
                      key={type}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-2xl border transition-colors ${
                        peut ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        s.doseRetenue === type
                          ? 'bg-clinical-light border-clinical'
                          : 'bg-white border-slate-200 hover:border-clinical/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`dose-${selection}`}
                        checked={s.doseRetenue === type}
                        onChange={() => d.choisirDose(selection, type)}
                        disabled={!peut}
                        className="mt-0.5 accent-clinical shrink-0 disabled:cursor-not-allowed"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-700">
                          {type === 'irm' ? 'RTDosej (IRM)' : 'RTDose sCT'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-snug">
                          {type === 'irm'
                            ? "Calculée sur l'IRM pendant le traitement — densités approchées"
                            : 'Recalculée sur le sCT, à balistique identique'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* L'écart entre les deux candidates, sur les points qui parlent. */}
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  {s.comparaison.lignes
                    .filter(l => ['ptv-d95', 'rectum-d05', 'vessie-d05', 'uretre-d10'].includes(l.structure.id))
                    .map(l => (
                      <div key={l.structure.id} className="bg-slate-50 rounded-2xl px-3 py-2">
                        <div className="font-semibold text-slate-600">
                          {l.structure.nom} <span className="text-slate-400">{l.structure.metrique}</span>
                        </div>
                        <div className="font-mono text-slate-500 mt-0.5">IRM {fmt(l.irm)}</div>
                        <div className="font-mono text-slate-500">sCT {fmt(l.sct)}</div>
                        <div
                          className={`font-mono font-semibold mt-0.5 ${
                            l.niveau === 'warn' ? 'text-warn-text' : 'text-slate-600'
                          }`}
                        >
                          Δ {fmtSigne(l.ecart)} {l.structure.unite}
                        </div>
                      </div>
                    ))}
                </div>

                {s.comparaison.indicateur && (
                  <div
                    className={`mt-3 flex items-center gap-3 flex-wrap rounded-2xl border px-4 py-2.5 text-xs ${
                      s.comparaison.indicateur.niveau === 'ok'
                        ? 'bg-ok-bg border-ok-border text-ok-text'
                        : 'bg-warn-bg border-warn-border text-warn-text'
                    }`}
                  >
                    <span className="font-semibold">{s.comparaison.indicateur.label}</span>
                    <span className="font-mono">{s.comparaison.indicateur.valeur}</span>
                    <span className="font-mono opacity-70">seuil {s.comparaison.indicateur.seuil}</span>
                    <span className="ml-auto font-semibold">
                      {s.comparaison.indicateur.concordant ? 'Candidates concordantes' : 'Écart à trancher'}
                    </span>
                  </div>
                )}

                {/* Le critère lui-même n'est pas arrêté dans le projet : il reste
                    un paramètre affiché, pas une constante câblée. */}
                <div className="mt-3 flex items-end justify-between gap-4 border-t border-slate-100 pt-3">
                  <div className="text-xs text-slate-500 leading-relaxed">
                    <span className="font-semibold text-slate-600">Proposé par défaut : </span>
                    {s.comparaison.motifDefaut}
                  </div>
                  <div className="shrink-0">
                    <div className="text-xs text-slate-400 mb-1">
                      Critère de comparaison <span className="italic">— non arrêté</span>
                    </div>
                    <div className="flex gap-1">
                      {criteresComparaisonDose.map(c => (
                        <button
                          key={c.id}
                          onClick={() => d.setCritere(c.id)}
                          disabled={!peut}
                          title={c.sub}
                          className={`text-xs px-2.5 py-1 rounded-xl border transition-colors disabled:cursor-not-allowed ${
                            d.critere === c.id
                              ? 'bg-clinical-light border-clinical text-clinical font-semibold'
                              : 'bg-white border-slate-200 text-slate-500 enabled:hover:border-clinical/40'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </Bloc>

          {/* ── Ce qui en sort : le cumul porté à la décision du jour ── */}
          <div className="bg-slate-50 rounded-2xl px-4 py-3">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs font-bold text-slate-600">
                Ce qui en sort — cumul reconstruit S1–S{courante - 1}
                <span className="font-normal text-slate-400"> · porté à la décision du jour</span>
              </span>
              <span className="text-xs text-slate-400">cumul / prévu au même stade</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6">
              {cumul.lignes.map(l => (
                <div
                  key={l.structure.id}
                  className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-200/60"
                >
                  <span className="text-slate-500">
                    {l.structure.nom} <span className="text-slate-400">{l.structure.metrique}</span>
                  </span>
                  <ValeurVsPrevu cumul={l.cumul} prevu={l.prevu} unite={l.structure.unite} niveau={l.niveau} />
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-400 leading-relaxed">
              Trace de S{selection} : voie {s.voie ?? '—'} · qualité{' '}
              {labelQualite[s.qualite.verdict].toLowerCase()}
              {s.qualite.revise && ' (révisée)'} · déformation{' '}
              {labelDeformation[s.deformation.verdict].toLowerCase()}
              {s.deformation.revise && ' (révisée)'} ·{' '}
              {s.modeCumul ? labelModeCumul[s.modeCumul].toLowerCase() : 'sommation non tranchée'} ·
              dose {s.doseRetenue === 'sct' ? 'sCT' : 'IRM'}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

/* ── Un des trois points de l'évaluation ── */
function Bloc({
  index,
  titre,
  badge,
  children,
}: {
  index: number
  titre: string
  badge: ReactNode
  children: ReactNode
}) {
  return (
    <div className="border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg shrink-0">
            {index} / 3
          </span>
          <span className="text-sm font-semibold text-slate-700 truncate">{titre}</span>
        </div>
        {badge}
      </div>
      {children}
    </div>
  )
}

/* ── Révision manuelle d'un verdict automatique ── */
function Revision({
  valeurAuto,
  revise,
  modifiable,
  options,
  onChoisir,
  onRevenir,
}: {
  valeurAuto: string
  revise: boolean
  modifiable: boolean
  options: { val: string; label: string; actif: boolean }[]
  onChoisir: (v: string) => void
  onRevenir: () => void
}) {
  const [ouvert, setOuvert] = useState(false)

  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-slate-100 pt-2.5">
      <span className="text-xs text-slate-400">Verdict automatique :</span>
      <span className="text-xs font-semibold text-slate-600">{valeurAuto}</span>
      {revise && <StatusBadge level="warn">Révisé à la main</StatusBadge>}

      {!modifiable ? (
        <span className="ml-auto text-xs text-slate-400">Révision en lecture seule</span>
      ) : ouvert ? (
        <div className="ml-auto flex items-center gap-1">
          {options.map(o => (
            <button
              key={o.val}
              onClick={() => {
                onChoisir(o.val)
                setOuvert(false)
              }}
              className={`text-xs px-2.5 py-1 rounded-xl border transition-colors ${
                o.actif
                  ? 'bg-clinical-light border-clinical text-clinical font-semibold'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-clinical/40'
              }`}
            >
              {o.label}
            </button>
          ))}
          <button onClick={() => setOuvert(false)} className="text-xs text-slate-400 hover:text-slate-600 px-1">
            Annuler
          </button>
        </div>
      ) : (
        <div className="ml-auto flex items-center gap-3">
          {revise && (
            <button onClick={onRevenir} className="text-xs text-slate-400 hover:text-slate-600">
              Revenir au verdict automatique
            </button>
          )}
          <button onClick={() => setOuvert(true)} className="text-xs text-clinical hover:underline">
            Modifier le verdict
          </button>
        </div>
      )}
    </div>
  )
}
