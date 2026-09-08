import { useState, type ReactNode } from 'react'
import { criteresComparaisonDose, dossier, formatNombre, libellesRoles } from '../data'
import {
  fmt,
  fmtSigne,
  formatDateCourte,
  labelDeformation,
  labelEtatObjet,
  labelModeCumul,
  labelQualite,
  niveauDeformation,
  niveauQualite,
  objetsDicom,
  type CandidateDose,
  type ModeCumul,
  type VerdictDeformation,
  type VerdictQualite,
} from '../logic'
import { useDossier } from '../store'
import {
  Card,
  ConfianceIndicator,
  DoseReconstruiteNote,
  DVHPlaceholder,
  ImagePlaceholder,
  SectionTitle,
  StatusBadge,
  TrajectoireCumul,
  ValeurVsPrevu,
} from './shared'

const modesCumul: { val: ModeCumul; label: string; sub: string }[] = [
  {
    val: 'deformable',
    label: "Cumuler par recalage déformable — signaler l'incertitude",
    sub: 'La dose entre dans le cumul. La séance portera une confiance dégradée.',
  },
  {
    val: 'rigide',
    label: 'Cumuler par recalage rigide uniquement',
    sub: "Moins précis sur l'anatomie du jour, mais robuste aux grandes déformations.",
  },
  {
    val: 'exclure',
    label: 'Exclure la séance du cumul',
    sub: "La séance n'est pas intégrée. Elle sera listée comme séance exclue dans le rapport.",
  },
]

export default function MomentA() {
  const d = useDossier()
  const evaluables = d.seances.filter(s => s.realisee)
  const [selection, setSelection] = useState(
    evaluables.find(s => !s.validee)?.numero ?? evaluables[evaluables.length - 1]?.numero ?? 1,
  )
  const [panneauOuvert, setPanneauOuvert] = useState(true)

  const seance = d.seance(selection)
  const cumul = d.cumulJusqua(selection)
  const objets = objetsDicom(seance)
  const atp = seance.voie === 'ATP'
  const reacquisitionDemandee = d.decisions[selection]?.reacquisition === true

  return (
    <div className="flex gap-5 items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-5">

        {d.droits.lectureSeule && (
          <div className="bg-slate-100 border border-slate-200 rounded-sm px-4 py-2.5 text-xs text-slate-600">
            Profil <strong>{libellesRoles[d.utilisateur.role]}</strong> — consultation en lecture
            seule. La révision des verdicts et la validation du cumul relèvent du physicien médical.
          </div>
        )}

        {/* ── Sélection de la séance ── */}
        <Card className="p-4">
          <div className="flex items-baseline justify-between mb-3">
            <SectionTitle>Séance à valider</SectionTitle>
            <span className="text-xs text-slate-400">
              Référentiel de sommation : <span className="font-mono text-slate-600">{d.irmrefLabel}</span> — inchangé pendant tout le traitement
            </span>
          </div>
          <div className="flex gap-2">
            {evaluables.map(s => (
              <button
                key={s.numero}
                onClick={() => setSelection(s.numero)}
                className={`flex flex-col items-center px-4 py-2.5 rounded-sm border text-sm font-medium transition-colors ${
                  selection === s.numero
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="font-mono text-xs mb-1">S{s.numero}</span>
                <span className={`text-xs font-semibold ${
                  selection === s.numero ? 'text-blue-100' : s.voie === 'ATS' ? 'text-warn' : 'text-slate-500'
                }`}>
                  {s.voie}
                </span>
                <span className="mt-1 flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${
                    s.confiance.niveau === 'haute' ? 'bg-ok' : s.confiance.niveau === 'moyenne' ? 'bg-warn' : 'bg-danger'
                  }`} />
                  {!s.validee && <span className="text-xs text-warn" title="Non validée">•</span>}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
            <span>{formatDateCourte(seance.mesures.date)}</span>
            {seance.mesures.commentaire && <span>· {seance.mesures.commentaire}</span>}
            {atp && (
              <StatusBadge level="neutral">Séance à information réduite</StatusBadge>
            )}
            <span className="ml-auto">
              {seance.validee ? 'Évaluation validée' : 'Évaluation en attente de validation'}
            </span>
          </div>
        </Card>

        {/* ── Étape 1 — Qualité de l'IRM ── */}
        <EtapeCard
          index={1}
          titre={`Qualité de l'IRM — S${selection}`}
          badge={
            <StatusBadge level={niveauQualite[seance.qualite.verdict]}>
              {labelQualite[seance.qualite.verdict]}
            </StatusBadge>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <ImagePlaceholder
              height={160}
              label={`IRMj S${selection} — contrôle qualité`}
              showDeformation={seance.deformation.verdict === 'importante'}
            />
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold text-slate-600 mb-1">Critères évalués</div>
              {seance.qualite.criteres.map(c => (
                <div key={c.label} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50">
                  <span className="text-slate-600" title={`Seuil : ${c.seuil}`}>{c.label}</span>
                  <StatusBadge level={c.niveau}>{c.valeur}</StatusBadge>
                </div>
              ))}
              {seance.qualite.motifs.length > 0 && (
                <p className="text-xs text-warn-text bg-warn-bg border border-warn-border rounded-sm px-2 py-1.5 mt-2">
                  {seance.qualite.motifs.join(' · ')}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-2">
                Contrôle qualité rétrospectif : la séance a déjà eu lieu, une nouvelle acquisition
                n'est plus possible.
                <span className="text-blue-500"> [emplacement prévu pour un contrôle en séance — point non arrêté]</span>
              </p>
            </div>
          </div>

          <RevisionVerdict
            libelle="Verdict automatique"
            valeurAuto={labelQualite[seance.qualite.verdictAuto]}
            revise={seance.qualite.revise}
            modifiable={!d.droits.lectureSeule}
            options={(['exploitable', 'degradee', 'inexploitable'] as VerdictQualite[]).map(v => ({
              val: v,
              label: labelQualite[v],
              actif: seance.qualite.verdict === v,
            }))}
            onChoose={v => d.reviserQualite(selection, v as VerdictQualite)}
            onReset={() => d.reviserQualite(selection, undefined)}
          />

          {seance.qualite.verdict !== 'exploitable' && (
            <div className={`mt-3 rounded-sm px-4 py-3 text-xs flex items-start gap-3 ${
              seance.qualite.verdict === 'inexploitable'
                ? 'bg-danger-bg border border-danger-border text-danger-text'
                : 'bg-warn-bg border border-warn-border text-warn-text'
            }`}>
              <div className="flex-1">
                {seance.qualite.verdict === 'inexploitable'
                  ? "IRM inexploitable — une nouvelle acquisition serait requise. En contrôle "
                    + 'rétrospectif, la séance ne peut plus être réacquise : elle doit être exclue du '
                    + 'cumul ou cumulée avec une incertitude explicite (étape 2).'
                  : "IRM dégradée — la séance reste exploitable, mais l'incertitude portée par son "
                    + 'cumul est majorée.'}
                {reacquisitionDemandee && (
                  <div className="mt-1.5 font-semibold">
                    Nouvelle acquisition demandée — consigne enregistrée pour les séances suivantes
                    et reprise au rapport.
                  </div>
                )}
              </div>
              {!d.droits.lectureSeule && (
                <button
                  onClick={() => d.demanderReacquisition(selection, !reacquisitionDemandee)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-sm border font-medium transition-colors ${
                    reacquisitionDemandee
                      ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      : 'bg-white border-current hover:bg-slate-50'
                  }`}
                >
                  {reacquisitionDemandee ? 'Annuler la demande' : 'Demander une nouvelle acquisition'}
                </button>
              )}
            </div>
          )}
        </EtapeCard>

        {/* ── Étape 2 — Déformation ── */}
        <EtapeCard
          index={2}
          titre={`Amplitude de la déformation anatomique — S${selection}`}
          badge={
            <StatusBadge level={niveauDeformation[seance.deformation.verdict]}>
              Déformation {labelDeformation[seance.deformation.verdict].toLowerCase()}
            </StatusBadge>
          }
        >
          <div className="grid grid-cols-2 gap-4 mb-4">
            <ImagePlaceholder
              height={160}
              label="Champ de déformation IRMj → IRMref"
              showDeformation={seance.deformation.verdict === 'importante'}
            />
            <div className="text-xs space-y-2">
              <div className="font-semibold text-slate-700">Métriques de déformation</div>
              <div className="bg-slate-50 rounded-sm p-3 space-y-1.5">
                {seance.deformation.criteres.map(c => (
                  <div key={c.label} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{c.label}</span>
                    <span className="flex items-center gap-2 font-mono">
                      <span className={c.niveau === 'ok' ? 'text-slate-800 font-medium' : 'text-warn font-medium'}>
                        {c.valeur}
                      </span>
                      <span className="text-slate-400">seuil {c.seuil}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-slate-500">composant existant — recalage déformable</p>
            </div>
          </div>

          {seance.deformation.verdict === 'importante' ? (
            <div className="border border-warn-border bg-warn-bg rounded-sm p-4">
              <p className="text-xs font-semibold text-warn-text mb-3">
                Déformation importante — le mode de sommation doit être choisi explicitement pour S{selection} :
              </p>
              <div className="flex flex-col gap-2">
                {modesCumul.map(opt => (
                  <label
                    key={opt.val}
                    className={`flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${
                      seance.modeCumul === opt.val ? 'bg-white border-blue-400' : 'bg-white/50 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`cumul-${selection}`}
                      checked={seance.modeCumul === opt.val}
                      onChange={() => d.choisirModeCumul(selection, opt.val)}
                      disabled={d.droits.lectureSeule}
                      className="mt-0.5 accent-blue-600 shrink-0 disabled:cursor-not-allowed"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{opt.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
              {seance.modeCumulEnAttente && (
                <p className="mt-3 text-xs text-warn-text font-medium">
                  Aucune option n'est présélectionnée. Tant que le choix n'est pas fait, la séance
                  n'entre pas dans le cumul.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
              Déformation acceptable — sommation par recalage déformable, appliquée d'office.
            </p>
          )}

          <RevisionVerdict
            libelle="Verdict automatique"
            valeurAuto={labelDeformation[seance.deformation.verdictAuto]}
            revise={seance.deformation.revise}
            modifiable={!d.droits.lectureSeule}
            options={(['acceptable', 'importante'] as VerdictDeformation[]).map(v => ({
              val: v,
              label: labelDeformation[v],
              actif: seance.deformation.verdict === v,
            }))}
            onChoose={v => d.reviserDeformation(selection, v as VerdictDeformation)}
            onReset={() => d.reviserDeformation(selection, undefined)}
          />
        </EtapeCard>

        {/* ── Étape 3 — Choix de la distribution de dose ── */}
        <EtapeCard
          index={3}
          titre={`Choix de la distribution de dose — S${selection}`}
          badge={
            <StatusBadge level="neutral">
              Retenu : {seance.doseRetenue === 'sct' ? 'RTDose sCT' : 'RTDosej (IRM)'}
              {seance.doseRetenueParDefaut && ' — par défaut'}
            </StatusBadge>
          }
        >
          {!seance.comparaison.disponible ? (
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-4 text-xs text-slate-600">
              {seance.comparaison.motifDefaut}
              <div className="mt-2 font-mono text-slate-500">
                Candidate unique : RTDosej (IRM) · RTDose sCT non calculable sans balistique du jour
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {(['irm', 'sct'] as CandidateDose[]).map(type => (
                  <div
                    key={type}
                    onClick={() => { if (!d.droits.lectureSeule) d.choisirDose(selection, type) }}
                    className={`border rounded-sm overflow-hidden transition-colors ${
                      d.droits.lectureSeule ? 'cursor-default' : 'cursor-pointer'
                    } ${
                      seance.doseRetenue === type ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`px-3 py-2 flex items-center justify-between ${
                      seance.doseRetenue === type ? 'bg-blue-50' : 'bg-slate-50'
                    }`}>
                      <span className="text-xs font-semibold text-slate-700">
                        {type === 'irm' ? 'RTDosej (IRM)' : 'RTDose sCT'}
                      </span>
                      <input
                        type="radio"
                        name={`dose-${selection}`}
                        checked={seance.doseRetenue === type}
                        onChange={() => d.choisirDose(selection, type)}
                        disabled={d.droits.lectureSeule}
                        className="accent-blue-600 disabled:cursor-not-allowed"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <ImagePlaceholder height={130} label={`Isodoses — ${type === 'irm' ? 'RTDosej' : 'RTDose sCT'}`} />
                    <div className="px-3 py-2 text-xs text-slate-500">
                      {type === 'irm'
                        ? "Calculée sur l'IRM pendant le traitement (densités approchées)"
                        : 'Recalculée sur le sCT à partir de la même balistique'}
                    </div>
                  </div>
                ))}
              </div>

              <DVHPlaceholder height={160} title={`DVH comparatif — RTDosej vs RTDose sCT (S${selection})`} />

              <div className="mt-3 grid grid-cols-4 gap-2 text-xs font-mono">
                {seance.comparaison.lignes
                  .filter(l => ['ptv-d95', 'rectum-d05', 'vessie-d05', 'uretre-d10'].includes(l.structure.id))
                  .map(l => (
                    <div key={l.structure.id} className="bg-slate-50 rounded-sm p-2 border border-slate-100">
                      <div className="text-slate-600 font-sans font-medium mb-1">
                        {l.structure.nom} {l.structure.metrique}
                      </div>
                      <div className="text-slate-500">IRM : {fmt(l.irm)} {l.structure.unite}</div>
                      <div className="text-slate-500">sCT : {fmt(l.sct)} {l.structure.unite}</div>
                      <div className={`mt-0.5 font-semibold ${l.niveau === 'warn' ? 'text-warn' : 'text-slate-600'}`}>
                        Écart : {fmtSigne(l.ecart)} {l.structure.unite}
                      </div>
                    </div>
                  ))}
              </div>

              {seance.comparaison.indicateur && (
                <div className={`mt-3 flex items-center gap-3 rounded-sm border px-3 py-2 text-xs ${
                  seance.comparaison.indicateur.niveau === 'ok'
                    ? 'bg-ok-bg border-ok-border text-ok-text'
                    : 'bg-warn-bg border-warn-border text-warn-text'
                }`}>
                  <span className="font-semibold">{seance.comparaison.indicateur.label}</span>
                  <span className="font-mono">{seance.comparaison.indicateur.valeur}</span>
                  <span className="opacity-70 font-mono">seuil {seance.comparaison.indicateur.seuil}</span>
                  <StatusBadge level={seance.comparaison.indicateur.niveau}>
                    {seance.comparaison.indicateur.concordant ? 'Candidates concordantes' : 'Écart à trancher'}
                  </StatusBadge>
                </div>
              )}

              <div className="mt-3 flex items-start gap-3 border-t border-slate-100 pt-3">
                <div className="flex-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Choix par défaut proposé : </span>
                  {seance.comparaison.motifDefaut}
                </div>
                <div className="shrink-0">
                  <div className="text-xs text-slate-400 mb-1">Critère de comparaison</div>
                  <div className="flex gap-1">
                    {criteresComparaisonDose.map(c => (
                      <button
                        key={c.id}
                        onClick={() => d.setCritere(c.id)}
                        disabled={d.droits.lectureSeule}
                        title={c.sub}
                        className={`text-xs px-2 py-1 rounded-sm border transition-colors ${
                          d.critere === c.id
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-blue-500 mt-1">[paramétrable — point non arrêté]</div>
                </div>
              </div>
            </>
          )}
        </EtapeCard>

        {/* ── Sortie — dose cumulée ── */}
        <Card className="p-5">
          <div className="flex items-baseline justify-between mb-3">
            <SectionTitle>Sortie — dose cumulée S1–S{selection}</SectionTitle>
            <DoseReconstruiteNote />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <DVHPlaceholder height={160} title={`DVH cumulé S1–S${selection}`} />
              <TrajectoireCumul ligne={cumul.parStructure['rectum-d05']} height={110} />
              <p className="text-xs text-slate-400">
                Trajectoire du Rectum D0.5cc — cumul reconstruit contre prévisionnel
              </p>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-700">Cumul par structure</span>
                <span className="text-slate-400">cumul / prévu au même stade</span>
              </div>
              {cumul.lignes.map(l => (
                <div key={l.structure.id} className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-600">
                    {l.structure.nom} <span className="text-slate-400">{l.structure.metrique}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <ValeurVsPrevu cumul={l.cumul} prevu={l.prevu} unite={l.structure.unite} niveau={l.niveau} />
                    <span className="text-slate-300 font-mono" title="Incertitude héritée des séances incluses">
                      ±{formatNombre(l.incertitude, 2)}
                    </span>
                  </span>
                </div>
              ))}
              <div className="mt-2 text-xs text-slate-400">
                {cumul.seancesIncluses.length} séance(s) incluse(s) : S{cumul.seancesIncluses.join(', S') || '—'}
                {cumul.seancesExclues.length > 0 && ` · exclue(s) : S${cumul.seancesExclues.join(', S')}`}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3">
            <ConfianceIndicator niveau={cumul.confiance} motifs={cumul.motifsConfiance} />
            <span className="text-xs text-slate-400">
              héritée des verdicts des séances incluses
            </span>
            <div className="ml-auto flex items-center gap-2">
              {seance.validee && (
                <button
                  onClick={() => d.devaliderSeance(selection)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Rouvrir
                </button>
              )}
              <button
                onClick={() => d.validerSeance(selection)}
                disabled={seance.validee || seance.modeCumulEnAttente || d.droits.lectureSeule}
                className={`text-xs px-4 py-2 rounded-sm font-medium transition-colors ${
                  seance.validee
                    ? 'bg-ok-bg text-ok-text border border-ok-border cursor-default'
                    : seance.modeCumulEnAttente || d.droits.lectureSeule
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {seance.validee
                  ? '✓ Validé'
                  : d.droits.lectureSeule
                    ? 'Validation réservée au physicien'
                    : seance.modeCumulEnAttente
                      ? 'Choix de sommation requis'
                      : 'Valider et enregistrer le cumul'}
              </button>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-400 border-t border-slate-100 pt-2">
            Trace de la séance : voie {seance.voie} · qualité {labelQualite[seance.qualite.verdict].toLowerCase()}
            {seance.qualite.revise && ' (révisée)'} · déformation {labelDeformation[seance.deformation.verdict].toLowerCase()}
            {seance.deformation.revise && ' (révisée)'} ·{' '}
            {seance.modeCumul ? labelModeCumul[seance.modeCumul].toLowerCase() : 'sommation non tranchée'} ·
            dose retenue {seance.doseRetenue === 'sct' ? 'RTDose sCT' : 'RTDosej (IRM)'}
          </div>
        </Card>
      </div>

      {/* ── Panneau latéral — objets DICOM ── */}
      <div className={`shrink-0 transition-all ${panneauOuvert ? 'w-60' : 'w-8'}`}>
        <div className="bg-white border border-slate-200 rounded-sm">
          <button
            onClick={() => setPanneauOuvert(!panneauOuvert)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {panneauOuvert && <span>Objets disponibles — S{selection}</span>}
            <span className="ml-auto text-slate-400">{panneauOuvert ? '→' : '←'}</span>
          </button>
          {panneauOuvert && (
            <div className="px-3 pb-3 flex flex-col gap-1">
              {objets.map(obj => (
                <div key={obj.nom} className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
                  <div className="flex flex-col" title={obj.role}>
                    <span className={`text-xs font-mono ${obj.source === 'dimadose' ? 'text-blue-700' : 'text-slate-700'}`}>
                      {obj.nom}
                    </span>
                    {obj.source === 'dimadose' && (
                      <span className="text-blue-400" style={{ fontSize: '10px' }}>DIMADOSE</span>
                    )}
                  </div>
                  <span
                    title={labelEtatObjet[obj.etat].long}
                    className={`shrink-0 text-xs font-medium rounded-sm px-1.5 py-0.5 ${
                      obj.etat === 'present'
                        ? 'bg-ok-bg text-ok-text'
                        : obj.etat === 'non-exporte'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-slate-50 text-slate-400'
                    }`}
                  >
                    {labelEtatObjet[obj.etat].court}
                  </span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-0.5" style={{ fontSize: '10px' }}>
                <div className="flex gap-1.5 text-slate-500">
                  <span className="bg-ok-bg text-ok-text px-1 rounded-sm">✓</span> Présent
                </div>
                <div className="flex gap-1.5 text-slate-500">
                  <span className="bg-slate-100 text-slate-500 px-1 rounded-sm">N/E</span> Non exporté par la machine
                </div>
                <div className="flex gap-1.5 text-slate-500">
                  <span className="bg-slate-50 text-slate-400 px-1 rounded-sm">—</span> Absent
                </div>
                <div className="flex gap-1.5 text-blue-500 mt-1">
                  <span className="font-mono">DIMADOSE</span> = objet produit par l'outil
                </div>
              </div>
              {atp && (
                <p className="mt-2 text-xs text-slate-500 leading-snug">
                  Séance ATP : ni contours, ni plan, ni dose du jour ne sont exportés — d'où une
                  information plus pauvre pour le suivi.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 bg-white border border-slate-200 rounded-sm p-3 text-xs text-slate-500">
          <div className="font-semibold text-slate-600 mb-1">Dossier</div>
          <div>{dossier.nom} {dossier.prenom}</div>
          <div className="font-mono text-slate-400">{dossier.id}</div>
          <div className="mt-1">{dossier.protocole}</div>
          <div className="text-slate-400">
            {formatNombre(dossier.prescriptionTotale)} Gy / {dossier.nbSeances} fr
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Carte d'étape ── */
function EtapeCard({
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
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-sm">
            Étape {index} / 3
          </span>
          <span className="text-sm font-semibold text-slate-800">{titre}</span>
        </div>
        {badge}
      </div>
      {children}
    </Card>
  )
}

/* ── Révision manuelle d'un verdict ── */
function RevisionVerdict({
  libelle,
  valeurAuto,
  revise,
  modifiable,
  options,
  onChoose,
  onReset,
}: {
  libelle: string
  valeurAuto: string
  revise: boolean
  modifiable: boolean
  options: { val: string; label: string; actif: boolean }[]
  onChoose: (v: string) => void
  onReset: () => void
}) {
  const [ouvert, setOuvert] = useState(false)

  return (
    <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3 flex-wrap">
      <span className="text-xs text-slate-500">{libelle} :</span>
      <span className="text-xs font-medium text-slate-700">{valeurAuto}</span>
      {revise && (
        <StatusBadge level="warn">Révisé manuellement</StatusBadge>
      )}
      {!modifiable ? (
        <span className="ml-auto text-xs text-slate-400">Révision réservée au physicien</span>
      ) : ouvert ? (
        <div className="flex items-center gap-1 ml-auto">
          {options.map(o => (
            <button
              key={o.val}
              onClick={() => { onChoose(o.val); setOuvert(false) }}
              className={`text-xs px-2 py-1 rounded-sm border transition-colors ${
                o.actif ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
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
            <button onClick={onReset} className="text-xs text-slate-400 hover:text-slate-600">
              Revenir au verdict automatique
            </button>
          )}
          <button onClick={() => setOuvert(true)} className="text-xs text-blue-600 hover:underline">
            Modifier le verdict
          </button>
        </div>
      )}
    </div>
  )
}
