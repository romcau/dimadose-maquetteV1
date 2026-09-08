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
  libellesRoles,
  referentielsDisponibles,
  type CritereComparaison,
  type Voie,
} from './data'
import {
  alertesDossier,
  construireRapport,
  cumuler,
  droits as calculerDroits,
  evaluerSeances,
  labelDeformation,
  labelModeCumul,
  labelQualite,
  proposerContraintes,
  recommanderVoie,
  type CandidateDose,
  type Decisions,
  type EntreeTrace,
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

export function DossierProvider({
  children,
  dossierId = dossier.id,
  utilisateur = utilisateurParDefaut,
  seanceInitiale = dossier.seanceCourante,
}: {
  children: ReactNode
  /** Clé d'enregistrement — un dossier, un état. */
  dossierId?: string
  utilisateur?: Utilisateur
  /** Séance sur laquelle ouvrir le dossier (séance du jour). */
  seanceInitiale?: number
}) {
  const [persistant] = useState(stockageDisponible)
  const [initial] = useState(() => charger(dossierId))

  const [seanceCourante, setSeanceCouranteState] = useState(initial?.seanceCourante ?? seanceInitiale)
  const [decisions, setDecisions] = useState<Decisions>(initial?.decisions ?? decisionsEnregistrees)
  const [critere, setCritereState] = useState<CritereComparaison>(initial?.critere ?? 'dvh')
  const [irmref, setIrmrefState] = useState(initial?.irmref ?? referentielsDisponibles[0].id)
  const [contraintesEditees, setContraintesEditees] =
    useState<Record<number, Record<string, number>>>(initial?.contraintesEditees ?? {})
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
      critere,
      irmref,
      trace,
    })
    if (horodatage) setEnregistreLe(horodatage)
  }, [dossierId, seanceCourante, decisions, contraintesEditees, critere, irmref, trace])

  const reinitialiser = useCallback(() => {
    effacer(dossierId)
    setSeanceCouranteState(seanceInitiale)
    setDecisions(decisionsEnregistrees)
    setCritereState('dvh')
    setIrmrefState(referentielsDisponibles[0].id)
    setContraintesEditees({})
    setTrace([])
    setEnregistreLe(null)
  }, [dossierId, seanceInitiale])

  // ── Actions, chacune inscrite au journal ──

  const actions = useMemo(() => ({
    setSeanceCourante: (n: number) => {
      setSeanceCouranteState(n)
      tracer({
        categorie: 'seance',
        seance: n,
        libelle: `Ouverture du workflow de la séance ${n}`,
      })
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
          + (referentielsDisponibles.find(r => r.id === id)?.label ?? id),
      })
    },
  }), [patch, tracer, seance, recommandation])

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
    seanceCourante,
    decisions,
    critere,
    irmref,
    contraintesEditees,
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
    irmrefLabel: referentielsDisponibles.find(r => r.id === irmref)?.label ?? irmref,
    alertes,

    stockagePersistant: persistant,
    enregistreLe,
    reinitialiser,

    tracer,
    ...actions,
    editerContrainte,
    reinitialiserContrainte,
    reinitialiserContraintes,
  }), [
    dossierId, utilisateur, droits, seanceCourante, decisions, critere, irmref,
    contraintesEditees, trace, seances, seance, cumul, cumulJusqua, recommandation,
    propositions, valeurContrainte, contraintesModifiees, rapport, alertes,
    persistant, enregistreLe, reinitialiser, tracer, actions,
    editerContrainte, reinitialiserContrainte, reinitialiserContraintes,
  ])

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export { useDossier } from './dossierContext'
