/* ─────────────────────────────────────────────────────────────────────────────
 * DIMADOSE — État partagé du dossier
 *
 * Un seul endroit détient les décisions de l'utilisateur ; tout le reste est
 * recalculé à partir d'elles par `logic.ts`. C'est ce qui fait qu'un choix pris
 * au moment A (exclure une séance, retenir la dose IRM plutôt que sCT, réviser
 * un verdict) change réellement la recommandation du moment B, le tableau de
 * contraintes du moment C et le rapport du moment D.
 *
 * Chaque action humaine est inscrite dans un journal en ajout seul, et
 * l'ensemble est enregistré dans le navigateur : une revue interrompue reprend
 * là où elle s'était arrêtée.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Contexte,
  type ActionTracee,
  type DossierContexte,
  type Utilisateur,
} from './dossierContext'
import {
  dossier,
  libellesEtapes,
  libellesRoles,
  MACHINES,
  MACHINE_PAR_DEFAUT,
  type CritereComparaison,
  type Machine,
  type Voie,
} from './data'
import {
  alertesDossier,
  construireRapport,
  cumuler,
  droits as calculerDroits,
  evaluerSeances,
  identiteAffichee,
  verdictIncomplet,
  suiviGatingIncomplet,
  libellesDeroulementGating,
  libellesCodeSeance,
  labelDeformation,
  labelModeCumul,
  labelQualite,
  proposerContraintes,
  labelReferentiel,
  recommanderVoie,
  REFERENTIEL_PAR_DEFAUT,
  type CandidateDose,
  type Decisions,
  type EntreeTrace,
  type CodeSeance,
  type VerdictSeance,
  type SuiviGating,
  type IdentiteDossier,
  type ModeCumul,
  type VerdictDeformation,
  type VerdictQualite,
} from './logic'
import { charger, effacer, sauvegarder, stockageDisponible } from './persistence'

/**
 * Historique enregistré du dossier de démonstration (§9 du brief).
 * Ce sont d'anciennes décisions humaines, pas des valeurs calculées : elles ont
 * donc leur place dans l'état, et non dans le moteur.
 */
export const decisionsEnregistrees: Decisions = {
  1: { voie: 'ATS', modeCumul: 'deformable', doseRetenue: 'sct', validee: true },
  2: { voie: 'ATP', modeCumul: 'deformable', doseRetenue: 'irm', validee: true },
  3: { voie: 'ATS', modeCumul: 'deformable', doseRetenue: 'sct', validee: true },
}

const utilisateurParDefaut: Utilisateur = { nom: 'Utilisateur', role: 'physicien' }

const virgule = (v: number, dec = 2) => v.toFixed(dec).replace('.', ',')

/**
 * Alertes d'un dossier calculées hors de son écran (liste patients).
 * Elles repartent de l'état enregistré, pour que le tableau de bord n'affiche
 * jamais autre chose que ce que montrera le dossier une fois ouvert.
 */
export function alertesPourDossier(dossierId: string, seanceCourante: number) {
  const etat = charger(dossierId)
  const seances = evaluerSeances(etat?.decisions ?? decisionsEnregistrees, etat?.critere ?? 'dvh')
  const numero = etat?.seanceCourante ?? seanceCourante
  const cumul = cumuler(seances, Math.max(numero - 1, 0))
  return {
    alertes: alertesDossier(cumul, recommanderVoie(seances, cumul, numero)),
    confiance: cumul.confiance,
  }
}

/**
 * Les qualifications de séance d'un dossier, pour le tableau de bord.
 *
 * Le tableau de bord vit hors du provider : il lit l'état enregistré, comme
 * pour les alertes. Un dossier jamais ouvert n'a pas de qualification — la
 * séance reste alors sans couleur, ce qui est la vérité : personne ne s'est
 * prononcé.
 */
export function verdictsPourDossier(dossierId: string): Record<number, VerdictSeance> {
  const etat = charger(dossierId)
  const decisions = etat?.decisions ?? decisionsEnregistrees
  const verdicts: Record<number, VerdictSeance> = {}
  for (const [numero, d] of Object.entries(decisions)) {
    if (d?.verdict) verdicts[Number(numero)] = d.verdict
  }
  return verdicts
}

export function DossierProvider({
  children,
  dossierId = dossier.id,
  utilisateur = utilisateurParDefaut,
  machine = MACHINE_PAR_DEFAUT,
  seanceInitiale = dossier.seanceCourante,
}: {
  children: ReactNode
  /** Clé d'enregistrement — un dossier, un état. */
  dossierId?: string
  utilisateur?: Utilisateur
  /** Machine du dossier ; par défaut celle dont le flux est décrit. */
  machine?: Machine
  /** Séance sur laquelle ouvrir le dossier (séance du jour). */
  seanceInitiale?: number
}) {
  const [persistant] = useState(stockageDisponible)
  const [initial] = useState(() => charger(dossierId))

  const [seanceCourante, setSeanceCouranteState] = useState(initial?.seanceCourante ?? seanceInitiale)
  const [decisions, setDecisions] = useState<Decisions>(initial?.decisions ?? decisionsEnregistrees)
  const [critere, setCritereState] = useState<CritereComparaison>(initial?.critere ?? 'dvh')
  const [irmref, setIrmrefState] = useState(initial?.irmref ?? REFERENTIEL_PAR_DEFAUT)
  const [contraintesEditees, setContraintesEditees] =
    useState<Record<number, Record<string, number>>>(initial?.contraintesEditees ?? {})
  const [tolerancesEditees, setTolerancesEditees] =
    useState<Record<number, Record<string, number>>>(initial?.tolerancesEditees ?? {})
  const [trace, setTrace] = useState<EntreeTrace[]>(initial?.trace ?? [])
  const [enregistreLe, setEnregistreLe] = useState<string | null>(initial?.enregistreLe ?? null)

  const compteur = useRef(0)

  // ── Journal ──

  const tracer = useCallback((action: ActionTracee) => {
    compteur.current += 1
    const entree: EntreeTrace = {
      id: `${Date.now()}-${compteur.current}`,
      horodatage: new Date().toISOString(),
      auteur: utilisateur.nom,
      role: libellesRoles[utilisateur.role],
      ...action,
    }
    setTrace(prev => [entree, ...prev].slice(0, 200))
  }, [utilisateur.nom, utilisateur.role])

  const patch = useCallback((numero: number, valeurs: Partial<Decisions[number]>) => {
    setDecisions(prev => ({ ...prev, [numero]: { ...prev[numero], ...valeurs } }))
  }, [])

  // ── Dérivations ──

  const seances = useMemo(() => evaluerSeances(decisions, critere), [decisions, critere])

  const seance = useCallback(
    (numero: number) => seances.find(s => s.numero === numero) ?? seances[0],
    [seances],
  )

  const cumulJusqua = useCallback((numero: number) => cumuler(seances, numero), [seances])

  const cumul = useMemo(
    () => cumuler(seances, Math.max(seanceCourante - 1, 0)),
    [seances, seanceCourante],
  )

  const recommandation = useMemo(
    () => recommanderVoie(seances, cumul, seanceCourante),
    [seances, cumul, seanceCourante],
  )

  const propositions = useMemo(() => proposerContraintes(cumul), [cumul])

  const rapport = useMemo(
    () => construireRapport(seances, cumuler(seances, dossier.nbSeances)),
    [seances],
  )

  const alertes = useMemo(() => alertesDossier(cumul, recommandation), [cumul, recommandation])

  const droits = useMemo(() => calculerDroits(utilisateur.role), [utilisateur.role])

  // Lié aux droits une fois pour toutes : un écran ne peut pas se tromper de
  // second argument, ni oublier de poser la question.
  const identite = useCallback(
    (p: IdentiteDossier) => identiteAffichee(p, droits.voitIdentitePatient),
    [droits.voitIdentitePatient],
  )

  const editions = contraintesEditees[seanceCourante] ?? {}

  const valeurContrainte = useCallback(
    (structureId: string) =>
      editions[structureId]
      ?? propositions.find(p => p.id === structureId)?.valeurProposee
      ?? 0,
    [editions, propositions],
  )

  const contraintesModifiees = Object.keys(editions).length > 0

  // ── Enregistrement ──

  useEffect(() => {
    const horodatage = sauvegarder({
      dossierId,
      seanceCourante,
      decisions,
      contraintesEditees,
      tolerancesEditees,
      critere,
      irmref,
      trace,
    })
    if (horodatage) setEnregistreLe(horodatage)
  }, [dossierId, seanceCourante, decisions, contraintesEditees, tolerancesEditees, critere, irmref, trace])

  const reinitialiser = useCallback(() => {
    effacer(dossierId)
    setSeanceCouranteState(seanceInitiale)
    setDecisions(decisionsEnregistrees)
    setCritereState('dvh')
    setIrmrefState(REFERENTIEL_PAR_DEFAUT)
    setContraintesEditees({})
    setTrace([])
    setEnregistreLe(null)
  }, [dossierId, seanceInitiale])

  // ── Actions, chacune inscrite au journal ──

  const actions = useMemo(() => ({
    // Passer d'une séance à l'autre est de la navigation, pas un acte : le
    // journal n'en garde rien. Ce qui compte est tracé par validerEtape et
    // par la fin de séance.
    setSeanceCourante: (n: number) => setSeanceCouranteState(n),

    validerEtape: (etape: string, validee: boolean) => {
      tracer({
        categorie: 'etape',
        seance: seanceCourante,
        libelle: validee
          ? `Étape « ${libellesEtapes[etape] ?? etape} » validée`
          : `Étape « ${libellesEtapes[etape] ?? etape} » rouverte`,
        detail: validee
          ? 'Données et configuration de l’étape vérifiées avant de poursuivre.'
          : undefined,
      })
    },

    tracerExport: (quoi: string, detail?: string) => {
      tracer({ categorie: 'export', seance: seanceCourante, libelle: quoi, detail })
    },

    reviserQualite: (numero: number, v: VerdictQualite | undefined) => {
      const auto = seance(numero).qualite.verdictAuto
      patch(numero, { qualite: v })
      tracer({
        categorie: 'verdict',
        seance: numero,
        libelle: v === undefined
          ? `Qualité IRM — retour au verdict automatique (${labelQualite[auto].toLowerCase()})`
          : `Qualité IRM révisée en « ${labelQualite[v].toLowerCase()} »`,
        detail: `Verdict automatique : ${labelQualite[auto].toLowerCase()}`,
        ecart: v !== undefined && v !== auto,
      })
    },

    reviserDeformation: (numero: number, v: VerdictDeformation | undefined) => {
      const auto = seance(numero).deformation.verdictAuto
      patch(numero, { deformation: v })
      tracer({
        categorie: 'verdict',
        seance: numero,
        libelle: v === undefined
          ? `Déformation — retour au verdict automatique (${labelDeformation[auto].toLowerCase()})`
          : `Déformation révisée en « ${labelDeformation[v].toLowerCase()} »`,
        detail: `Verdict automatique : ${labelDeformation[auto].toLowerCase()}`,
        ecart: v !== undefined && v !== auto,
      })
    },

    choisirModeCumul: (numero: number, m: ModeCumul) => {
      patch(numero, { modeCumul: m })
      tracer({
        categorie: 'sommation',
        seance: numero,
        libelle: `Mode de sommation : ${labelModeCumul[m].toLowerCase()}`,
        detail: m === 'exclure'
          ? "La dose de cette séance n'entre pas dans le cumul reconstruit."
          : 'Choix requis par une déformation anatomique importante.',
        ecart: m !== 'deformable',
      })
    },

    choisirDose: (numero: number, choix: CandidateDose) => {
      const s = seance(numero)
      patch(numero, { doseRetenue: choix })
      tracer({
        categorie: 'dose',
        seance: numero,
        libelle: `Dose retenue pour le cumul : ${choix === 'sct' ? 'RTDose sCT' : 'RTDosej (IRM)'}`,
        detail: s.comparaison.indicateur
          ? `${s.comparaison.indicateur.label} : ${s.comparaison.indicateur.valeur} `
            + `(seuil ${s.comparaison.indicateur.seuil})`
          : undefined,
        ecart: choix !== s.comparaison.defaut,
      })
    },

    validerSeance: (numero: number) => {
      const s = seance(numero)
      patch(numero, { validee: true })
      tracer({
        categorie: 'validation',
        seance: numero,
        libelle: `Cumul de la séance ${numero} validé et enregistré`,
        detail: `Confiance ${s.confiance.niveau} · ${s.confiance.motifs.join(' · ')}`,
      })
    },

    /**
     * Qualification de la séance en fin de workflow : un code couleur et ce qui
     * s'est passé. C'est un acte humain, donc il part au journal — et comme
     * tout acte, il porte son auteur.
     */
    qualifierSeance: (numero: number, code: CodeSeance, commentaire: string) => {
      const texte = commentaire.trim()
      if (verdictIncomplet(code, texte)) return
      patch(numero, {
        verdict: {
          code,
          commentaire: texte,
          par: utilisateur.nom,
          horodatage: new Date().toISOString(),
        },
      })
      tracer({
        categorie: 'validation',
        seance: numero,
        libelle: `Séance ${numero} qualifiée « ${libellesCodeSeance[code].toLowerCase()} »`,
        detail: texte || undefined,
        // Le rouge et l'orange signalent une séance qui n'a pas suivi le cours
        // attendu : le journal doit les distinguer d'une séance ordinaire.
        ecart: code !== 'vert',
      })
    },

    /**
     * Observations libres de la séance : déroulement du recalage, affectation
     * de densité retenue. Rien ne les calcule — c'est ce qui explique après
     * coup pourquoi une séance ressemble à ce qu'elle est.
     *
     * Tracées à l'enregistrement, pas à chaque frappe : le journal garderait
     * sinon une entrée par caractère.
     */
    noterSeance: (numero: number, champ: 'recalage' | 'densites', texte: string) => {
      const propre = texte.trim()
      patch(numero, champ === 'recalage' ? { noteRecalage: propre } : { noteDensites: propre })
      const quoi = champ === 'recalage' ? 'Déroulement du recalage' : 'Affectation de densité'
      tracer({
        categorie: 'note',
        seance: numero,
        libelle: propre
          ? `${quoi} noté pour la séance ${numero}`
          : `${quoi} effacé pour la séance ${numero}`,
        detail: propre || undefined,
      })
    },

    /**
     * Données facultatives rechargées après une séance ATP.
     *
     * Le RTDose modifié change la nature de la séance : sa dose n'est plus
     * estimée. Le journal doit donc en garder trace comme d'un acte, pas
     * comme d'un réglage.
     */
    chargerOptionnelATP: (numero: number, objet: 'rtplan' | 'rtdose' | 'irmv', charge: boolean) => {
      const libelles = {
        rtplan: 'RTPj modifié',
        rtdose: 'RTDosej modifié',
        irmv: 'IRM de vérification',
      } as const
      patch(numero, {
        atpOptionnel: { ...decisions[numero]?.atpOptionnel, [objet]: charge },
      })
      tracer({
        categorie: 'dose',
        seance: numero,
        libelle: charge
          ? `${libelles[objet]} chargé pour la séance ${numero} (ATP)`
          : `${libelles[objet]} retiré de la séance ${numero}`,
        detail: objet === 'rtdose' && charge
          ? "La dose de la séance n'est plus estimée : elle vient du plan délivré."
          : undefined,
      })
    },

    /**
     * Ce que l'équipe rapporte de la délivrance : déroulement de
     * l'asservissement, seuil appliqué, durée. Rien de cela n'est exporté par
     * la machine — c'est la seule trace qu'il en reste, donc elle part au
     * journal.
     */
    enregistrerGating: (numero: number, suivi: Omit<SuiviGating, 'par' | 'horodatage'>) => {
      if (suiviGatingIncomplet(suivi.deroulement, suivi.commentaire)) return
      patch(numero, {
        gating: { ...suivi, commentaire: suivi.commentaire.trim(), par: utilisateur.nom, horodatage: new Date().toISOString() },
      })
      const details = [
        suivi.commentaire.trim(),
        suivi.dureeMinutes !== null ? `Durée ${suivi.dureeMinutes} min` : null,
        suivi.seuilAdapte ? `Seuil adapté : ${suivi.seuilApplique || 'non précisé'}` : null,
      ].filter(Boolean).join(' · ')
      tracer({
        categorie: 'seance',
        seance: numero,
        libelle: `Délivrance séance ${numero} — ${libellesDeroulementGating[suivi.deroulement].toLowerCase()}`,
        detail: details || undefined,
        // Un ajustement du seuil ou de gros ajustements sortent du cours prévu.
        ecart: suivi.deroulement !== 'ras' || suivi.seuilAdapte,
      })
    },

    /**
     * Commentaire de fin d'étape, adressé à la séance suivante.
     *
     * Tracé comme une observation : il n'engage aucune dose, mais il explique
     * ce que les chiffres ne disent pas.
     */
    commenterEtape: (numero: number, etape: string, texte: string) => {
      const propre = texte.trim()
      patch(numero, {
        commentairesEtape: { ...decisions[numero]?.commentairesEtape, [etape]: propre },
      })
      const nom = libellesEtapes[etape] ?? etape
      tracer({
        categorie: 'note',
        seance: numero,
        libelle: propre
          ? `Commentaire laissé sur l'étape ${nom} (séance ${numero})`
          : `Commentaire retiré de l'étape ${nom} (séance ${numero})`,
        detail: propre || undefined,
      })
    },

    devaliderSeance: (numero: number) => {
      patch(numero, { validee: false })
      tracer({
        categorie: 'validation',
        seance: numero,
        libelle: `Évaluation de la séance ${numero} rouverte`,
      })
    },

    demanderReacquisition: (numero: number, demandee: boolean) => {
      patch(numero, { reacquisition: demandee })
      tracer({
        categorie: 'reacquisition',
        seance: numero,
        libelle: demandee
          ? `Nouvelle acquisition IRM demandée pour la séance ${numero}`
          : `Demande de nouvelle acquisition annulée (séance ${numero})`,
        detail: demandee
          ? 'Contrôle qualité rétrospectif : la séance est passée. La demande vaut consigne '
            + 'pour les séances suivantes et sera reprise au rapport.'
          : undefined,
      })
    },

    enregistrerVoie: (numero: number, voie: Voie, motifs?: string[], texte?: string) => {
      const suivie = voie === recommandation.voie
      patch(numero, { voie, motifsDeviation: motifs, texteDeviation: texte })
      tracer({
        categorie: 'voie',
        seance: numero,
        libelle: `Voie retenue : ${voie}`
          + (suivie ? ' — recommandation suivie' : ` — recommandation ${recommandation.voie} non suivie`),
        detail: [
          `Score ${virgule(recommandation.score, 1)} / seuil ${virgule(recommandation.seuil, 1)}`
            + ` · confiance ${recommandation.confiance}`,
          ...(motifs ?? []),
          ...(texte ? [`Précisions : ${texte}`] : []),
        ].join(' · '),
        ecart: !suivie,
      })
    },

    annulerVoie: (numero: number) => {
      patch(numero, { voie: undefined, motifsDeviation: undefined, texteDeviation: undefined })
      tracer({
        categorie: 'voie',
        seance: numero,
        libelle: `Décision de la séance ${numero} annulée`,
      })
    },

    setCritere: (c: CritereComparaison) => {
      setCritereState(c)
      tracer({
        categorie: 'critere',
        seance: null,
        libelle: 'Critère de comparaison des doses : '
          + (c === 'gamma' ? 'indice gamma' : 'écarts sur points DVH cliniques'),
        detail: 'Point non arrêté du projet — le critère peut changer le verdict de concordance.',
      })
    },

    setIrmref: (id: string) => {
      setIrmrefState(id)
      tracer({
        categorie: 'referentiel',
        seance: null,
        libelle: 'Référentiel de sommation : '
          + labelReferentiel(id),
      })
    },
  }), [patch, tracer, seance, recommandation, seanceCourante, utilisateur.nom, decisions])

  const editerContrainte = useCallback((structureId: string, valeurSaisie: number) => {
    setContraintesEditees(prev => ({
      ...prev,
      [seanceCourante]: { ...prev[seanceCourante], [structureId]: valeurSaisie },
    }))
    const p = propositions.find(x => x.id === structureId)
    if (!p) return
    tracer({
      categorie: 'contrainte',
      seance: seanceCourante,
      libelle: `${p.structure.nom} ${p.structure.metrique} fixé à `
        + `${virgule(valeurSaisie)} ${p.structure.unite}`,
      detail: `Proposition : ${virgule(p.valeurProposee)} · `
        + `référence : ${virgule(p.valeurRef)} ${p.structure.unite}`,
      ecart: Math.abs(valeurSaisie - p.valeurProposee) > 1e-9,
    })
  }, [seanceCourante, propositions, tracer])

  /**
   * Tolérance admise sur une contrainte, pour la séance en cours.
   *
   * Elle vient du protocole et reste ajustable : c'est une convention
   * d'équipe, pas une constante physique. La modifier change la lecture du
   * score, jamais la dose — d'où un rang de simple réglage au journal.
   */
  const editerTolerance = useCallback((structureId: string, valeurSaisie: number) => {
    setTolerancesEditees(prev => ({
      ...prev,
      [seanceCourante]: { ...prev[seanceCourante], [structureId]: valeurSaisie },
    }))
    const p = propositions.find(x => x.id === structureId)
    if (!p) return
    tracer({
      categorie: 'contrainte',
      seance: seanceCourante,
      libelle: `Tolérance ${p.structure.nom} ${p.structure.metrique} fixée à `
        + `${virgule(valeurSaisie)} ${p.structure.unite}`,
      detail: `Tolérance du protocole : ${virgule(p.structure.toleranceRef)} ${p.structure.unite} par séance`,
      ecart: Math.abs(valeurSaisie - p.structure.toleranceRef) > 1e-9,
    })
  }, [seanceCourante, propositions, tracer])

  const valeurTolerance = useCallback(
    (structureId: string) =>
      tolerancesEditees[seanceCourante]?.[structureId]
      ?? propositions.find(p => p.id === structureId)?.structure.toleranceRef
      ?? 0,
    [tolerancesEditees, seanceCourante, propositions],
  )

  const reinitialiserContrainte = useCallback((structureId: string) => {
    setContraintesEditees(prev => {
      const pourSeance = { ...prev[seanceCourante] }
      delete pourSeance[structureId]
      return { ...prev, [seanceCourante]: pourSeance }
    })
    const p = propositions.find(x => x.id === structureId)
    tracer({
      categorie: 'contrainte',
      seance: seanceCourante,
      libelle: p
        ? `${p.structure.nom} ${p.structure.metrique} remis à la proposition DIMADOSE`
        : 'Contrainte remise à la proposition DIMADOSE',
    })
  }, [seanceCourante, propositions, tracer])

  const reinitialiserContraintes = useCallback(() => {
    setContraintesEditees(prev => ({ ...prev, [seanceCourante]: {} }))
    tracer({
      categorie: 'contrainte',
      seance: seanceCourante,
      libelle: 'Toutes les contraintes remises aux contraintes de référence',
    })
  }, [seanceCourante, tracer])

  const valeur = useMemo<DossierContexte>(() => ({
    dossierId,
    utilisateur,
    droits,
    machine: MACHINES[machine],
    identite,
    seanceCourante,
    decisions,
    critere,
    irmref,
    contraintesEditees,
    tolerancesEditees,
    valeurTolerance,
    trace,

    seances,
    seance,
    cumul,
    cumulJusqua,
    recommandation,
    propositions,
    valeurContrainte,
    contraintesModifiees,
    rapport,
    irmrefLabel: labelReferentiel(irmref),
    alertes,

    stockagePersistant: persistant,
    enregistreLe,
    reinitialiser,

    tracer,
    ...actions,
    editerContrainte,
    editerTolerance,
    reinitialiserContrainte,
    reinitialiserContraintes,
  }), [
    dossierId, utilisateur, droits, machine, identite, seanceCourante, decisions, critere, irmref,
    contraintesEditees, tolerancesEditees, valeurTolerance, trace, seances, seance, cumul, cumulJusqua, recommandation,
    propositions, valeurContrainte, contraintesModifiees, rapport, alertes,
    persistant, enregistreLe, reinitialiser, tracer, actions,
    editerContrainte, editerTolerance, reinitialiserContrainte, reinitialiserContraintes,
  ])

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export { useDossier } from './dossierContext'
