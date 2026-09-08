/* ─────────────────────────────────────────────────────────────────────────────
 * DIMADOSE — Moteur de décision
 *
 * Fonctions pures : mesures brutes + décisions utilisateur → verdicts, cumul,
 * recommandation, contraintes proposées, rapport final.
 *
 * Aucune de ces fonctions ne déclenche quoi que ce soit : elles calculent ce
 * que l'outil *propose*. Les décisions de l'utilisateur sont toujours passées
 * en entrée et l'emportent sur le calcul automatique.
 *
 * Tous les seuils sont regroupés dans `SEUILS` pour être discutables devant
 * l'écran (§8 du brief : plusieurs critères ne sont pas encore arrêtés).
 * ──────────────────────────────────────────────────────────────────────────── */

import {
  dossier,
  formatNombre,
  mesuresSeances,
  structures,
  type CritereComparaison,
  type MesuresDeformation,
  type MesuresQualite,
  type MesuresSeance,
  type Role,
  type Structure,
  type Voie,
} from './data'

// ─── Vocabulaire ─────────────────────────────────────────────────────────────

/** Réexporté pour que les écrans n'aient qu'un seul point d'import. */
export type { Role, Structure, Voie } from './data'

export type Niveau = 'ok' | 'warn' | 'danger' | 'neutral'
export type Confiance = 'haute' | 'moyenne' | 'faible'
export type VerdictQualite = 'exploitable' | 'degradee' | 'inexploitable'
export type VerdictDeformation = 'acceptable' | 'importante'
export type ModeCumul = 'deformable' | 'rigide' | 'exclure'
export type CandidateDose = 'irm' | 'sct'
export type Direction = 'tighter' | 'looser' | 'unchanged'

/** Décisions prises par l'utilisateur pour une séance. Toutes optionnelles. */
export interface DecisionsSeance {
  /** Voie retenue (moment B). */
  voie?: Voie
  /** Verdict qualité révisé manuellement (§ moment A, étape 1). */
  qualite?: VerdictQualite
  /** Verdict déformation révisé manuellement (étape 2). */
  deformation?: VerdictDeformation
  /** Mode de sommation retenu (étape 2, si déformation importante). */
  modeCumul?: ModeCumul
  /** Distribution de dose retenue pour le cumul (étape 3). */
  doseRetenue?: CandidateDose
  /** Le physicien a validé et enregistré le cumul de cette séance. */
  validee?: boolean
  /** Motifs enregistrés quand la recommandation n'est pas suivie. */
  motifsDeviation?: string[]
  texteDeviation?: string
  /** Nouvelle acquisition demandée (IRM inexploitable). */
  reacquisition?: boolean
}

export type Decisions = Record<number, DecisionsSeance>

// ─── Droits par profil ───────────────────────────────────────────────────────

export interface Droits {
  /** Valider une étape du workflow. */
  peutValiderEtape: boolean
  /** Trancher entre ATP et ATS — réservé au radiothérapeute (§2 du brief). */
  peutDeciderVoie: boolean
  /** Réviser un verdict et valider le cumul d'une séance — travail du physicien. */
  peutEvaluerSeance: boolean
  /** Charger des données dans le dossier. */
  peutCharger: boolean
  lectureSeule: boolean
}

export function droits(role: Role): Droits {
  const lectureSeule = role === 'manipulateur'
  return {
    peutValiderEtape: role === 'physicien' || role === 'medecin',
    peutDeciderVoie: role === 'medecin',
    peutEvaluerSeance: role === 'physicien',
    peutCharger: !lectureSeule,
    lectureSeule,
  }
}

// ─── Seuils ──────────────────────────────────────────────────────────────────

export const SEUILS = {
  qualite: {
    /** Grade d'artefacts à partir duquel l'image est dégradée / inexploitable. */
    artefactsDegrade: 2,
    artefactsInexploitable: 3,
    /** Rapport signal / bruit. */
    rsbNormal: 20,
    rsbDegrade: 14,
    /** Distorsion géométrique, mm. */
    distorsionAcceptable: 2,
    distorsionLimite: 4,
  },
  deformation: {
    jacobienMax: 1.6,
    deplacementMax: 8, // mm
    volumeRectum: 25, // %
  },
  dose: {
    /** Écart entre RTDosej et RTDose sCT jugé significatif, en Gy. */
    ecartSignificatif: 0.3,
    /** Tolérance dosimétrique du critère gamma (3 %). */
    toleranceGamma: 0.03,
    /** Taux de points conformes attendu pour conclure à une concordance. */
    tauxGammaAcceptable: 0.95,
  },
  cumul: {
    /** Dérive relative au-dessus du prévisionnel déclenchant un resserrement. */
    deriveHaute: 0.08,
    /** Marge relative sous le prévisionnel autorisant un relâchement. */
    margeBasse: 0.15,
    /** Sous-couverture relative d'une cible déclenchant un durcissement. */
    sousCouverture: 0.03,
    /** Fraction de l'objectif total au-delà de laquelle on passe en vigilance. */
    partObjectifVigilance: 0.9,
  },
  contraintes: {
    /** Amplitude maximale d'ajustement, en fraction de la contrainte de référence. */
    ajustementMax: 0.25,
    /** Pas d'arrondi des valeurs proposées (ressaisie manuelle dans le TPS). */
    arrondi: 0.05,
  },
  recommandation: {
    /** Score à partir duquel l'ATS est recommandé. */
    seuilATS: 3,
    /** Amplitude de décalage jugée inhabituelle, en multiple de la moyenne. */
    facteurDecalageInhabituel: 1.5,
  },
} as const

// ─── Utilitaires ─────────────────────────────────────────────────────────────

export const fmt = formatNombre

export const fmtSigne = (v: number, dec = 2): string =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatNombre(Math.abs(v), dec)}`

export const fmtPct = (ratio: number): string =>
  `${ratio > 0 ? '+' : ratio < 0 ? '−' : ''}${Math.abs(ratio * 100).toFixed(1).replace('.', ',')} %`

const arrondir = (v: number, pas: number): number => Math.round(v / pas) * pas

const pire = (niveaux: Niveau[]): Niveau =>
  niveaux.includes('danger') ? 'danger' : niveaux.includes('warn') ? 'warn' : 'ok'

const confianceDepuisScore = (score: number): Confiance =>
  score >= 2.5 ? 'haute' : score >= 1.5 ? 'moyenne' : 'faible'

const scoreDepuisConfiance = (c: Confiance): number =>
  c === 'haute' ? 3 : c === 'moyenne' ? 2 : 1

export const labelQualite: Record<VerdictQualite, string> = {
  exploitable: 'Exploitable',
  degradee: 'Dégradée',
  inexploitable: 'Inexploitable',
}

export const niveauQualite: Record<VerdictQualite, Niveau> = {
  exploitable: 'ok',
  degradee: 'warn',
  inexploitable: 'danger',
}

export const labelDeformation: Record<VerdictDeformation, string> = {
  acceptable: 'Acceptable',
  importante: 'Importante',
}

export const niveauDeformation: Record<VerdictDeformation, Niveau> = {
  acceptable: 'ok',
  importante: 'warn',
}

export const labelModeCumul: Record<ModeCumul, string> = {
  deformable: 'Recalage déformable — incertitude signalée',
  rigide: 'Recalage rigide uniquement',
  exclure: 'Séance exclue du cumul',
}

// ─── Étape 1 — Qualité de l'IRM ──────────────────────────────────────────────

export interface Critere {
  label: string
  valeur: string
  niveau: Niveau
  seuil: string
}

export interface EvaluationQualite {
  verdictAuto: VerdictQualite
  criteres: Critere[]
  motifs: string[]
}

export function evaluerQualite(m: MesuresQualite): EvaluationQualite {
  const s = SEUILS.qualite

  const artefactsLabels = ['Absents', 'Légers', 'Modérés', 'Sévères']
  const critereArtefacts: Critere = {
    label: 'Artefacts de mouvement',
    valeur: artefactsLabels[m.artefacts],
    niveau: m.artefacts >= s.artefactsInexploitable
      ? 'danger'
      : m.artefacts >= s.artefactsDegrade
        ? 'warn'
        : 'ok',
    seuil: `dégradée à partir de « ${artefactsLabels[s.artefactsDegrade]} »`,
  }

  const critereRsb: Critere = {
    label: 'Rapport signal / bruit',
    valeur: m.rsb >= s.rsbNormal
      ? `Normal (${fmt(m.rsb, 1)})`
      : m.rsb >= s.rsbDegrade
        ? `Légèrement dégradé (${fmt(m.rsb, 1)})`
        : `Insuffisant (${fmt(m.rsb, 1)})`,
    niveau: m.rsb >= s.rsbNormal ? 'ok' : m.rsb >= s.rsbDegrade ? 'warn' : 'danger',
    seuil: `normal ≥ ${fmt(s.rsbNormal, 0)}`,
  }

  const critereDistorsion: Critere = {
    label: 'Distorsion géométrique',
    valeur: m.distorsion <= s.distorsionAcceptable
      ? `Acceptable (${fmt(m.distorsion, 1)} mm)`
      : m.distorsion <= s.distorsionLimite
        ? `Limite (${fmt(m.distorsion, 1)} mm)`
        : `Inacceptable (${fmt(m.distorsion, 1)} mm)`,
    niveau: m.distorsion <= s.distorsionAcceptable
      ? 'ok'
      : m.distorsion <= s.distorsionLimite
        ? 'warn'
        : 'danger',
    seuil: `acceptable ≤ ${fmt(s.distorsionAcceptable, 0)} mm`,
  }

  const criteres = [critereArtefacts, critereRsb, critereDistorsion]
  const global = pire(criteres.map(c => c.niveau))

  return {
    verdictAuto: global === 'danger' ? 'inexploitable' : global === 'warn' ? 'degradee' : 'exploitable',
    criteres,
    motifs: criteres.filter(c => c.niveau !== 'ok').map(c => `${c.label} — ${c.valeur.toLowerCase()}`),
  }
}

// ─── Étape 2 — Déformation anatomique ────────────────────────────────────────

export interface EvaluationDeformation {
  verdictAuto: VerdictDeformation
  criteres: Critere[]
  motifs: string[]
}

export function evaluerDeformation(m: MesuresDeformation): EvaluationDeformation {
  const s = SEUILS.deformation

  const criteres: Critere[] = [
    {
      label: 'Jacobien max',
      valeur: fmt(m.jacobienMax, 2),
      niveau: m.jacobienMax > s.jacobienMax ? 'warn' : 'ok',
      seuil: `≤ ${fmt(s.jacobienMax, 2)}`,
    },
    {
      label: 'Déplacement max',
      valeur: `${fmt(m.deplacementMax, 1)} mm`,
      niveau: m.deplacementMax > s.deplacementMax ? 'warn' : 'ok',
      seuil: `≤ ${fmt(s.deplacementMax, 0)} mm`,
    },
    {
      label: 'Volume rectum vs IRMref',
      valeur: `${fmtSigne(m.volumeRectum, 0)} %`,
      niveau: Math.abs(m.volumeRectum) > s.volumeRectum ? 'warn' : 'ok',
      seuil: `≤ ${fmt(s.volumeRectum, 0)} %`,
    },
  ]

  const depasses = criteres.filter(c => c.niveau !== 'ok')

  return {
    verdictAuto: depasses.length > 0 ? 'importante' : 'acceptable',
    criteres,
    motifs: depasses.map(c => `${c.label} = ${c.valeur} (seuil ${c.seuil})`),
  }
}

/** Mode de sommation appliqué d'office quand la déformation est acceptable. */
export function modeCumulParDefaut(verdict: VerdictDeformation): ModeCumul | null {
  return verdict === 'acceptable' ? 'deformable' : null
}

// ─── Étape 3 — Choix de la distribution de dose ──────────────────────────────

export interface LigneComparaison {
  structure: Structure
  irm: number
  sct: number
  ecart: number
  ecartRelatif: number
  niveau: Niveau
}

export interface ComparaisonDose {
  disponible: boolean
  lignes: LigneComparaison[]
  ecartMax: LigneComparaison | null
  defaut: CandidateDose
  motifDefaut: string
  critere: CritereComparaison
  /**
   * Verdict du critère de comparaison retenu. Les deux critères prévus au §8 du
   * brief ne mesurent pas la même chose et peuvent donc conclure différemment :
   * c'est précisément ce qui reste à trancher dans le projet.
   */
  indicateur: {
    label: string
    valeur: string
    seuil: string
    niveau: Niveau
    concordant: boolean
  } | null
  /** Taux de points conformes au critère gamma, sur les points DVH disponibles. */
  tauxGamma: number
}

/**
 * Compare les deux candidates au cumul (RTDosej sur IRM vs RTDose sCT).
 * Retourne un choix par défaut motivé — jamais imposé (§ moment A).
 */
export function comparerCandidates(
  seance: MesuresSeance,
  critere: CritereComparaison = 'dvh',
): ComparaisonDose {
  if (!seance.doseSCT) {
    return {
      disponible: false,
      lignes: [],
      ecartMax: null,
      defaut: 'irm',
      motifDefaut: 'Séance ATP — aucune balistique du jour, donc aucun sCT ni RTDose sCT. '
        + 'Le cumul reprend le plan de référence recalé rigidement.',
      critere,
      indicateur: null,
      tauxGamma: 0,
    }
  }

  const sct = seance.doseSCT
  const lignes: LigneComparaison[] = structures.map(s => {
    const vIrm = seance.doseIRM[s.id] ?? 0
    const vSct = sct[s.id] ?? 0
    const ecart = vSct - vIrm
    const reference = Math.max(Math.abs(vIrm), Math.abs(vSct))
    const ecartRelatif = reference === 0 ? 0 : ecart / reference
    return {
      structure: s,
      irm: vIrm,
      sct: vSct,
      ecart,
      ecartRelatif,
      niveau: critere === 'gamma'
        ? (Math.abs(ecartRelatif) > SEUILS.dose.toleranceGamma ? 'warn' : 'ok')
        : (Math.abs(ecart) >= SEUILS.dose.ecartSignificatif ? 'warn' : 'ok'),
    }
  })

  const ecartMax = lignes.reduce<LigneComparaison | null>(
    (acc, l) => (!acc || Math.abs(l.ecart) > Math.abs(acc.ecart) ? l : acc),
    null,
  )

  const conformes = lignes.filter(l => Math.abs(l.ecartRelatif) <= SEUILS.dose.toleranceGamma)
  const tauxGamma = lignes.length === 0 ? 1 : conformes.length / lignes.length

  const nomEcartMax = ecartMax
    ? `${ecartMax.structure.nom} ${ecartMax.structure.metrique}`
    : '—'

  const indicateur = critere === 'gamma'
    ? {
        label: `Indice gamma ${(SEUILS.dose.toleranceGamma * 100).toFixed(0)} % / 3 mm`,
        valeur: `${(tauxGamma * 100).toFixed(0)} % de points conformes `
          + `(${conformes.length} / ${lignes.length})`,
        seuil: `≥ ${(SEUILS.dose.tauxGammaAcceptable * 100).toFixed(0)} %`,
        niveau: (tauxGamma >= SEUILS.dose.tauxGammaAcceptable ? 'ok' : 'warn') as Niveau,
        concordant: tauxGamma >= SEUILS.dose.tauxGammaAcceptable,
      }
    : {
        label: 'Écart maximal sur points DVH cliniques',
        valeur: ecartMax
          ? `${fmtSigne(ecartMax.ecart)} ${ecartMax.structure.unite} sur ${nomEcartMax}`
          : '—',
        seuil: `< ${fmt(SEUILS.dose.ecartSignificatif)} ${ecartMax?.structure.unite ?? 'Gy'}`,
        niveau: (ecartMax && Math.abs(ecartMax.ecart) >= SEUILS.dose.ecartSignificatif
          ? 'warn'
          : 'ok') as Niveau,
        concordant: !ecartMax || Math.abs(ecartMax.ecart) < SEUILS.dose.ecartSignificatif,
      }

  const precision = critere === 'gamma'
    ? 'Taux évalué sur les points DVH disponibles ; le calcul gamma 3D relève du composant existant.'
    : `Écart maximal : ${indicateur.valeur}.`

  return {
    disponible: true,
    lignes,
    ecartMax,
    defaut: 'sct',
    motifDefaut: indicateur.concordant
      ? `Les deux candidates concordent au sens du critère retenu (${indicateur.label} : `
        + `${indicateur.valeur}, seuil ${indicateur.seuil}). ${precision} `
        + 'Défaut proposé : sCT, recalculé sur les densités du jour.'
      : `Les deux candidates diffèrent au sens du critère retenu (${indicateur.label} : `
        + `${indicateur.valeur}, seuil ${indicateur.seuil}) — le choix mérite d'être tranché. `
        + `${precision} Défaut proposé : sCT, recalculé sur les densités du jour.`,
    critere,
    indicateur,
    tauxGamma,
  }
}

// ─── Confiance d'une séance ──────────────────────────────────────────────────

export interface EvaluationConfiance {
  niveau: Confiance
  score: number
  motifs: string[]
  /** Incertitude relative portée par la séance, propagée au cumul. */
  incertitudeRelative: number
}

export function confianceSeance(input: {
  voie: Voie | null
  qualite: VerdictQualite
  deformation: VerdictDeformation
  modeCumul: ModeCumul | null
  reprise?: boolean
}): EvaluationConfiance {
  const motifs: string[] = []
  let score = 3
  let incertitude = 0.01

  if (input.voie === 'ATP') {
    score -= 1
    incertitude += 0.04
    motifs.push('Séance ATP — ni contours, ni plan, ni dose du jour exportés')
  }

  if (input.qualite === 'degradee') {
    score -= 1
    incertitude += 0.03
    motifs.push('IRM dégradée')
  } else if (input.qualite === 'inexploitable') {
    score -= 2
    incertitude += 0.08
    motifs.push('IRM inexploitable')
  }

  if (input.deformation === 'importante') {
    score -= 1
    incertitude += 0.05
    motifs.push('Déformation anatomique importante')
  }

  if (input.modeCumul === 'rigide') {
    score -= 1
    incertitude += 0.08
    motifs.push('Sommation par recalage rigide uniquement')
  }

  if (input.modeCumul === 'exclure') {
    motifs.push('Séance exclue du cumul')
    return { niveau: 'faible', score: 0, motifs, incertitudeRelative: 0 }
  }

  if (input.reprise) {
    motifs.push('Reprise du recalage après IRM de vérification (image non conservée)')
  }

  if (motifs.length === 0) motifs.push('Aucune réserve — image exploitable, déformation acceptable')

  return {
    niveau: confianceDepuisScore(Math.max(score, 1)),
    score: Math.max(score, 1),
    motifs,
    incertitudeRelative: incertitude,
  }
}

// ─── Séance évaluée (agrégat verdicts + décisions) ───────────────────────────

export interface SeanceEvaluee {
  mesures: MesuresSeance
  numero: number
  voie: Voie | null
  realisee: boolean
  /** Verdicts automatiques et verdicts effectifs (après révision manuelle). */
  qualite: EvaluationQualite & { verdict: VerdictQualite; revise: boolean }
  deformation: EvaluationDeformation & { verdict: VerdictDeformation; revise: boolean }
  modeCumul: ModeCumul | null
  /** `true` quand la déformation est importante et qu'aucun mode n'a été choisi. */
  modeCumulEnAttente: boolean
  comparaison: ComparaisonDose
  doseRetenue: CandidateDose
  doseRetenueParDefaut: boolean
  /** Points de dose effectivement versés au cumul. */
  points: Record<string, number>
  confiance: EvaluationConfiance
  incluse: boolean
  validee: boolean
  /** Une nouvelle acquisition IRM a été demandée pour cette séance. */
  reacquisitionDemandee: boolean
  /** Motifs enregistrés si la recommandation n'a pas été suivie. */
  motifsDeviationEnregistres: string[]
}

export function evaluerSeance(
  mesures: MesuresSeance,
  decisions: DecisionsSeance | undefined,
  critere: CritereComparaison = 'dvh',
): SeanceEvaluee {
  const d = decisions ?? {}
  const voie = d.voie ?? mesures.voie
  const realisee = voie !== null

  const qualiteEval = evaluerQualite(mesures.qualite)
  const qualiteVerdict = d.qualite ?? qualiteEval.verdictAuto

  const deformationEval = evaluerDeformation(mesures.deformation)
  const deformationVerdict = d.deformation ?? deformationEval.verdictAuto

  const modeCumul = d.modeCumul ?? modeCumulParDefaut(deformationVerdict)
  const comparaison = comparerCandidates(mesures, critere)

  const doseRetenue: CandidateDose = comparaison.disponible
    ? (d.doseRetenue ?? comparaison.defaut)
    : 'irm'

  const points = doseRetenue === 'sct' && mesures.doseSCT ? mesures.doseSCT : mesures.doseIRM

  const confiance = confianceSeance({
    voie,
    qualite: qualiteVerdict,
    deformation: deformationVerdict,
    modeCumul,
    reprise: mesures.reprise,
  })

  return {
    mesures,
    numero: mesures.numero,
    voie,
    realisee,
    qualite: { ...qualiteEval, verdict: qualiteVerdict, revise: d.qualite !== undefined && d.qualite !== qualiteEval.verdictAuto },
    deformation: { ...deformationEval, verdict: deformationVerdict, revise: d.deformation !== undefined && d.deformation !== deformationEval.verdictAuto },
    modeCumul,
    modeCumulEnAttente: deformationVerdict === 'importante' && d.modeCumul === undefined,
    comparaison,
    doseRetenue,
    doseRetenueParDefaut: d.doseRetenue === undefined,
    points,
    confiance,
    incluse: realisee && modeCumul !== null && modeCumul !== 'exclure',
    validee: d.validee ?? false,
    reacquisitionDemandee: d.reacquisition === true,
    motifsDeviationEnregistres: [
      ...(d.motifsDeviation ?? []),
      ...(d.texteDeviation ? [`Précisions : ${d.texteDeviation}`] : []),
    ],
  }
}

export function evaluerSeances(
  decisions: Decisions,
  critere: CritereComparaison = 'dvh',
): SeanceEvaluee[] {
  return mesuresSeances.map(m => evaluerSeance(m, decisions[m.numero], critere))
}

// ─── Cumul de dose ───────────────────────────────────────────────────────────

export interface LigneCumul {
  structure: Structure
  cumul: number
  prevu: number
  ecart: number
  ecartRelatif: number
  /** Incertitude absolue héritée des séances incluses. */
  incertitude: number
  niveau: Niveau
  /** Contribution séance par séance, pour la trajectoire. */
  trajectoire: { seance: number; valeur: number; cumul: number; prevu: number }[]
  /** Projection en fin de traitement au rythme prévisionnel. */
  projection: number
  partObjectif: number
}

export interface Cumul {
  /** Dernière séance prise en compte. */
  jusqua: number
  lignes: LigneCumul[]
  parStructure: Record<string, LigneCumul>
  seancesIncluses: number[]
  seancesExclues: number[]
  /** Séances incluses dont le physicien n'a pas encore validé l'évaluation. */
  seancesNonValidees: number[]
  seancesRestantes: number
  confiance: Confiance
  motifsConfiance: string[]
}

/**
 * Cumule la dose reconstruite des séances 1 à `jusqua` incluses.
 * Le prévisionnel est recalculé sur le même nombre de séances incluses, pour
 * que la comparaison reste comparable même si une séance a été exclue.
 */
export function cumuler(seances: SeanceEvaluee[], jusqua: number): Cumul {
  const retenues = seances.filter(s => s.numero <= jusqua && s.incluse)
  const exclues = seances.filter(s => s.numero <= jusqua && s.realisee && !s.incluse)
  const n = retenues.length
  // Séances qu'il reste à couvrir : celles non encore sommées, y compris une
  // séance exclue dont la dose ne peut être estimée qu'au rythme prévisionnel.
  const restantes = Math.max(dossier.nbSeances - n, 0)

  const lignes: LigneCumul[] = structures.map(structure => {
    let cumul = 0
    let cumulPrevu = 0
    let incertitude = 0
    const trajectoire = retenues.map(s => {
      const valeur = s.points[structure.id] ?? 0
      cumul += valeur
      cumulPrevu += structure.prevuParSeance
      incertitude += valeur * s.confiance.incertitudeRelative
      return { seance: s.numero, valeur, cumul, prevu: cumulPrevu }
    })

    const prevu = structure.prevuParSeance * n
    const ecart = cumul - prevu
    const ecartRelatif = prevu === 0 ? 0 : ecart / prevu
    const projection = cumul + structure.prevuParSeance * restantes
    const partObjectif = structure.objectifTotal === 0 ? 0 : projection / structure.objectifTotal

    return {
      structure,
      cumul,
      prevu,
      ecart,
      ecartRelatif,
      incertitude,
      niveau: niveauEcart(structure, ecartRelatif),
      trajectoire,
      projection,
      partObjectif,
    }
  })

  const scores = retenues.map(s => scoreDepuisConfiance(s.confiance.niveau))
  const moyenne = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

  const motifsConfiance: string[] = []
  for (const s of retenues) {
    if (s.confiance.niveau !== 'haute') {
      motifsConfiance.push(`S${s.numero} — ${s.confiance.motifs[0]}`)
    }
  }
  for (const s of exclues) {
    motifsConfiance.push(`S${s.numero} — ${s.modeCumulEnAttente ? 'mode de sommation non choisi' : 'exclue du cumul'}`)
  }
  if (motifsConfiance.length === 0 && n > 0) {
    motifsConfiance.push('Toutes les séances incluses sont de confiance haute')
  }

  return {
    jusqua,
    lignes,
    parStructure: Object.fromEntries(lignes.map(l => [l.structure.id, l])),
    seancesIncluses: retenues.map(s => s.numero),
    seancesExclues: exclues.map(s => s.numero),
    seancesNonValidees: retenues.filter(s => !s.validee).map(s => s.numero),
    seancesRestantes: restantes,
    confiance: n === 0 ? 'faible' : confianceDepuisScore(moyenne),
    motifsConfiance,
  }
}

/** Un écart n'a pas le même sens sur une cible et sur un OAR. */
function niveauEcart(structure: Structure, ecartRelatif: number): Niveau {
  const { deriveHaute, margeBasse, sousCouverture } = SEUILS.cumul

  if (structure.type === 'cible') {
    if (structure.sens === 'min') {
      return ecartRelatif < -sousCouverture ? 'warn' : 'ok'
    }
    return ecartRelatif > deriveHaute ? 'warn' : 'ok'
  }

  if (ecartRelatif > deriveHaute) return 'danger'
  if (ecartRelatif < -margeBasse) return 'ok'
  return 'neutral'
}

// ─── Moment B — Recommandation ATP / ATS ─────────────────────────────────────

export interface Justification {
  niveau: Niveau
  icone: string
  titre: string
  detail: string
  poids: number
}

export interface Recommandation {
  voie: Voie
  score: number
  seuil: number
  confiance: Confiance
  justifications: Justification[]
  /** Amplitude des décalages du jour, comparée à l'historique. */
  decalages: {
    axe: 'x' | 'y' | 'z'
    valeur: number
    moyenne: number
    inhabituel: boolean
  }[]
  historique: { ats: number; atp: number; total: number }
}

/**
 * Recommande une voie pour la séance du jour.
 *
 * Contrainte majeure du brief : aucun contour, volume ni DVH du jour n'existe
 * à ce moment-là. Les seules entrées autorisées sont l'historique cumulé et
 * les décalages du recalage rigide du jour.
 */
export function recommanderVoie(
  seances: SeanceEvaluee[],
  cumul: Cumul,
  seanceCourante: number,
): Recommandation {
  const justifications: Justification[] = []
  const precedentes = seances.filter(s => s.numero < seanceCourante && s.realisee)
  const courante = seances.find(s => s.numero === seanceCourante)

  // 1 — OAR en dérive au-dessus du prévisionnel
  for (const l of cumul.lignes) {
    if (l.structure.type !== 'oar' || l.ecartRelatif <= SEUILS.cumul.deriveHaute) continue

    const responsable = l.trajectoire.reduce<{ seance: number; ecart: number } | null>(
      (acc, t) => {
        const ecart = t.valeur - l.structure.prevuParSeance
        return !acc || ecart > acc.ecart ? { seance: t.seance, ecart } : acc
      },
      null,
    )

    justifications.push({
      niveau: 'danger',
      icone: '▲',
      titre: `${l.structure.nom} · ${l.structure.metrique} en dérive`,
      detail: `Cumul S1–S${cumul.jusqua} = ${fmt(l.cumul, 1)} ${l.structure.unite} · `
        + `Prévu à ce stade : ${fmt(l.prevu, 1)} ${l.structure.unite} · `
        + `Écart : ${fmtSigne(l.ecart, 1)} ${l.structure.unite} (${fmtPct(l.ecartRelatif)})`
        + (responsable ? ` · Séance la plus contributive : S${responsable.seance}` : ''),
      poids: 2,
    })
  }

  // 2 — OAR disposant d'une marge de manœuvre
  for (const l of cumul.lignes) {
    if (l.structure.type !== 'oar' || l.ecartRelatif >= -SEUILS.cumul.margeBasse) continue
    justifications.push({
      niveau: 'ok',
      icone: '▼',
      titre: `${l.structure.nom} · ${l.structure.metrique} — marge disponible`,
      detail: `Cumul S1–S${cumul.jusqua} = ${fmt(l.cumul, 1)} ${l.structure.unite} · `
        + `Prévu : ${fmt(l.prevu, 1)} ${l.structure.unite} · `
        + `Marge de ${fmtSigne(l.ecart, 1)} ${l.structure.unite} exploitable par une réoptimisation`,
      poids: 0.5,
    })
  }

  // 3 — Projection en fin de traitement approchant l'objectif
  for (const l of cumul.lignes) {
    if (l.structure.type !== 'oar' || l.partObjectif < SEUILS.cumul.partObjectifVigilance) continue
    justifications.push({
      niveau: 'warn',
      icone: '◆',
      titre: `${l.structure.nom} · ${l.structure.metrique} — objectif approché`,
      detail: `Projection fin de traitement = ${fmt(l.projection, 1)} ${l.structure.unite} `
        + `pour un objectif de ${fmt(l.structure.objectifTotal, 1)} ${l.structure.unite} `
        + `(${(l.partObjectif * 100).toFixed(0)} % de la limite)`,
      poids: 1,
    })
  }

  // 4 — Fréquence des ATS aux séances précédentes
  const ats = precedentes.filter(s => s.voie === 'ATS').length
  const atp = precedentes.filter(s => s.voie === 'ATP').length
  if (precedentes.length > 0 && ats / precedentes.length >= 0.5) {
    justifications.push({
      niveau: 'warn',
      icone: '↺',
      titre: 'Historique majoritairement ATS',
      detail: `${ats} ATS / ${atp} ATP sur ${precedentes.length} séance(s) précédente(s) · `
        + "l'anatomie de ce patient a nécessité un recontourage à la majorité des séances",
      poids: 1,
    })
  }

  // 5 — Amplitude des décalages du jour vs historique
  const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z']
  const decalages = axes.map((axe, i) => {
    const valeur = courante?.mesures.decalages[i] ?? 0
    const historiques = precedentes.map(s => Math.abs(s.mesures.decalages[i]))
    const moyenne = historiques.length > 0
      ? historiques.reduce((a, b) => a + b, 0) / historiques.length
      : 0
    return {
      axe,
      valeur,
      moyenne,
      inhabituel: moyenne > 0
        && Math.abs(valeur) > moyenne * SEUILS.recommandation.facteurDecalageInhabituel,
    }
  })
  const inhabituels = decalages.filter(d => d.inhabituel)
  justifications.push({
    niveau: inhabituels.length > 0 ? 'warn' : 'neutral',
    icone: '↕',
    titre: inhabituels.length > 0
      ? 'Décalages rigides inhabituels'
      : 'Décalages rigides comparables à l\'historique',
    detail: `Recalage IRMj/IRMref S${seanceCourante} · `
      + decalages.map(d => `Δ${d.axe} = ${fmtSigne(d.valeur, 1)} mm`).join(' · ')
      + ` · Moyenne S1–S${seanceCourante - 1} : `
      + decalages.map(d => `±${fmt(d.moyenne, 1)}`).join(' · ')
      + ' mm'
      + (inhabituels.length > 0
        ? ` · Amplitude > ${fmt(SEUILS.recommandation.facteurDecalageInhabituel, 1)}× la moyenne sur `
          + inhabituels.map(d => `Δ${d.axe}`).join(', ')
        : ''),
    poids: inhabituels.length > 0 ? 1 : 0,
  })

  // 6 — Incertitude portée par le cumul
  if (cumul.seancesExclues.length > 0) {
    justifications.push({
      niveau: 'warn',
      icone: '⊘',
      titre: 'Séance(s) exclue(s) du cumul',
      detail: `S${cumul.seancesExclues.join(', S')} non intégrée(s) — le cumul décrit une partie `
        + 'seulement du traitement délivré, ce qui plaide pour une adaptation prudente',
      poids: 1,
    })
  } else if (cumul.confiance === 'faible') {
    justifications.push({
      niveau: 'warn',
      icone: '⊘',
      titre: 'Confiance du cumul faible',
      detail: cumul.motifsConfiance.join(' · '),
      poids: 1,
    })
  }

  const score = justifications.reduce((a, j) => a + j.poids, 0)
  const seuil = SEUILS.recommandation.seuilATS
  const marge = Math.abs(score - seuil)
  const confianceMarge: Confiance = marge >= 2 ? 'haute' : marge >= 1 ? 'moyenne' : 'faible'

  return {
    voie: score >= seuil ? 'ATS' : 'ATP',
    score,
    seuil,
    confiance: confianceDepuisScore(
      Math.min(scoreDepuisConfiance(confianceMarge), scoreDepuisConfiance(cumul.confiance)),
    ),
    justifications: justifications.sort((a, b) => b.poids - a.poids),
    decalages,
    historique: { ats, atp, total: precedentes.length },
  }
}

// ─── Moment C — Proposition de contraintes ───────────────────────────────────

export interface PropositionContrainte {
  id: string
  structure: Structure
  valeurRef: number
  valeurProposee: number
  direction: Direction
  motif: string
  cumul: LigneCumul
}

/**
 * Propose un jeu de contraintes pour la séance du jour, à partir des
 * contraintes de référence du RTPp et de la dérive du cumul.
 *
 * Règle d'ajustement : l'écart constaté est réparti sur les séances restantes,
 * plafonné à ±25 % de la contrainte de référence, puis arrondi au pas de 0,05
 * pour une ressaisie manuelle propre dans le TPS (§5 du brief).
 */
export function proposerContraintes(cumul: Cumul): PropositionContrainte[] {
  const restantes = Math.max(cumul.seancesRestantes, 1)
  const { ajustementMax, arrondi } = SEUILS.contraintes

  return cumul.lignes.map(ligne => {
    const s = ligne.structure
    const ref = s.contrainteRef
    let direction: Direction = 'unchanged'
    let valeur = ref
    let motif = 'Cumul conforme au prévisionnel — contrainte de référence conservée'

    const sousCouvert = s.type === 'cible'
      && s.sens === 'min'
      && ligne.ecartRelatif < -SEUILS.cumul.sousCouverture

    if (s.type === 'oar' && ligne.ecartRelatif > SEUILS.cumul.deriveHaute) {
      direction = 'tighter'
      const brut = ref - ligne.ecart / restantes
      valeur = Math.max(brut, ref * (1 - ajustementMax))
      motif = `Cumul ${fmtSigne(ligne.ecart, 1)} ${s.unite} au-dessus du prévisionnel `
        + `(${fmtPct(ligne.ecartRelatif)}) — écart réparti sur ${restantes} séance(s) restante(s)`
        + (brut < ref * (1 - ajustementMax) ? `, plafonné à −${(ajustementMax * 100).toFixed(0)} %` : '')
    } else if (s.type === 'oar' && ligne.ecartRelatif < -SEUILS.cumul.margeBasse) {
      direction = 'looser'
      const brut = ref - ligne.ecart / restantes
      valeur = Math.min(brut, ref * (1 + ajustementMax))
      motif = `Marge de ${fmtSigne(ligne.ecart, 1)} ${s.unite} sous le prévisionnel `
        + `(${fmtPct(ligne.ecartRelatif)}) — relâchement possible au profit des cibles`
        + (brut > ref * (1 + ajustementMax) ? `, plafonné à +${(ajustementMax * 100).toFixed(0)} %` : '')
    } else if (sousCouvert) {
      direction = 'tighter'
      const brut = ref - ligne.ecart / restantes
      valeur = Math.min(brut, ref * (1 + ajustementMax))
      motif = `Couverture cumulée ${fmtSigne(ligne.ecart, 1)} ${s.unite} sous le prévisionnel `
        + `(${fmtPct(ligne.ecartRelatif)}) — objectif de couverture à durcir`
    }

    return {
      id: s.id,
      structure: s,
      valeurRef: ref,
      // Une contrainte inchangée reprend la référence au chiffre près : l'arrondi
      // ne s'applique qu'aux valeurs réellement ajustées.
      valeurProposee: direction === 'unchanged' ? ref : arrondir(valeur, arrondi),
      direction,
      motif,
      cumul: ligne,
    }
  })
}

export const labelDirection: Record<Direction, { label: string; niveau: Niveau }> = {
  tighter: { label: 'Resserrement', niveau: 'danger' },
  looser: { label: 'Relâchement', niveau: 'ok' },
  unchanged: { label: 'Inchangée', niveau: 'neutral' },
}

/** Export texte du jeu de contraintes, pour copie / ressaisie dans le TPS. */
export function exporterContraintes(
  propositions: PropositionContrainte[],
  valeurs: Record<string, number>,
  entete: string[],
): string {
  const lignes = propositions.map(p => {
    const v = valeurs[p.id] ?? p.valeurProposee
    const signe = p.structure.sens === 'max' ? '≤' : '≥'
    return `${p.structure.nom}\t${p.structure.metrique} ${signe} ${fmt(v)} ${p.structure.unite}`
      + `\t(réf. ${fmt(p.valeurRef)})\t${labelDirection[p.direction].label}`
  })
  return [...entete, '', ...lignes].join('\n')
}

// ─── Moment D — Rapport de fin de traitement ─────────────────────────────────

export type StatutFinal = 'conforme' | 'vigilance' | 'depassement'

export interface LigneRapport {
  structure: Structure
  cumulRealise: number
  /** Cumul projeté en fin de traitement au rythme prévisionnel. */
  projection: number
  objectif: number
  ecartObjectif: number
  ecartPrevisionnel: number
  statut: StatutFinal
  incertitude: number
}

export interface Evenement {
  seance: number
  niveau: Niveau
  titre: string
  detail: string
}

export interface Rapport {
  complet: boolean
  seancesRealisees: number[]
  seancesRestantes: number
  lignes: LigneRapport[]
  evenements: Evenement[]
  recap: {
    ats: number
    atp: number
    degradees: number
    deformations: number
    exclues: number
    confiance: Confiance
  }
}

export function construireRapport(seances: SeanceEvaluee[], cumul: Cumul): Rapport {
  const realisees = seances.filter(s => s.realisee)

  const lignes: LigneRapport[] = cumul.lignes.map(l => {
    const s = l.structure
    const projection = l.projection
    const ecartObjectif = projection - s.objectifTotal
    const depasse = s.sens === 'max' ? ecartObjectif > 0 : ecartObjectif < 0
    const partObjectif = s.objectifTotal === 0 ? 0 : projection / s.objectifTotal

    let statut: StatutFinal = 'conforme'
    if (depasse) statut = 'depassement'
    else if (
      (s.type === 'oar' && partObjectif >= SEUILS.cumul.partObjectifVigilance)
      || (s.type === 'oar' && l.ecartRelatif > 0.05)
    ) statut = 'vigilance'

    return {
      structure: s,
      cumulRealise: l.cumul,
      projection,
      objectif: s.objectifTotal,
      ecartObjectif,
      ecartPrevisionnel: l.ecart,
      statut,
      incertitude: l.incertitude,
    }
  })

  const evenements: Evenement[] = []
  for (const s of realisees) {
    if (!s.incluse) {
      evenements.push({
        seance: s.numero,
        niveau: 'danger',
        titre: 'Séance exclue du cumul',
        detail: s.modeCumulEnAttente
          ? 'Mode de sommation non tranché — la séance n\'entre pas dans le cumul.'
          : 'Exclusion décidée par le physicien. La dose de cette séance n\'entre pas dans le cumul reconstruit.',
      })
    }
    if (s.qualite.verdict !== 'exploitable') {
      evenements.push({
        seance: s.numero,
        niveau: s.qualite.verdict === 'inexploitable' ? 'danger' : 'warn',
        titre: `IRM ${labelQualite[s.qualite.verdict].toLowerCase()}`,
        detail: `${s.qualite.motifs.join(' · ')}. `
          + (s.qualite.revise
            ? `Verdict révisé manuellement (automatique : ${labelQualite[s.qualite.verdictAuto].toLowerCase()}).`
            : 'Verdict automatique conservé après revue.')
          + ' Nouvelle acquisition non réalisée (contrôle qualité rétrospectif).',
      })
    }
    if (s.deformation.verdict === 'importante') {
      evenements.push({
        seance: s.numero,
        niveau: 'warn',
        titre: 'Déformation anatomique importante',
        detail: `${s.deformation.motifs.join(' · ')}. `
          + `Sommation : ${s.modeCumul ? labelModeCumul[s.modeCumul].toLowerCase() : 'non tranchée'}. `
          + `Dose retenue : ${s.doseRetenue === 'sct' ? 'RTDose sCT' : 'RTDosej (IRM)'}.`,
      })
    }
    if (s.voie === 'ATP') {
      evenements.push({
        seance: s.numero,
        niveau: 'neutral',
        titre: 'Séance ATP — information dosimétrique réduite',
        detail: 'Aucun RTSSj, RTPj ni RTDosej exporté. La dose de la séance est estimée par '
          + 'application du plan de référence sur le recalage rigide IRMj/IRMref.',
      })
    }
    if (s.mesures.reprise) {
      evenements.push({
        seance: s.numero,
        niveau: 'neutral',
        titre: 'Reprise après IRM de vérification',
        detail: 'Une IRMv a conduit à reprendre le recalage. L\'image n\'est pas conservée par '
          + 'la machine : la reprise est signalée, elle ne peut pas être illustrée.',
      })
    }
    if (s.reacquisitionDemandee) {
      evenements.push({
        seance: s.numero,
        niveau: 'danger',
        titre: 'Nouvelle acquisition IRM demandée',
        detail: "Demandée par l'équipe au vu de la qualité de l'image. Le contrôle qualité étant "
          + "rétrospectif, la séance n'a pas pu être réacquise : la demande vaut consigne pour les "
          + 'séances suivantes.',
      })
    }
    if (s.motifsDeviationEnregistres && s.motifsDeviationEnregistres.length > 0) {
      evenements.push({
        seance: s.numero,
        niveau: 'warn',
        titre: 'Recommandation non suivie',
        detail: s.motifsDeviationEnregistres.join(' · '),
      })
    }
  }

  return {
    complet: realisees.length === dossier.nbSeances,
    seancesRealisees: realisees.map(s => s.numero),
    seancesRestantes: dossier.nbSeances - realisees.length,
    lignes,
    evenements: evenements.sort((a, b) => a.seance - b.seance),
    recap: {
      ats: realisees.filter(s => s.voie === 'ATS').length,
      atp: realisees.filter(s => s.voie === 'ATP').length,
      degradees: realisees.filter(s => s.qualite.verdict !== 'exploitable').length,
      deformations: realisees.filter(s => s.deformation.verdict === 'importante').length,
      exclues: realisees.filter(s => !s.incluse).length,
      confiance: cumul.confiance,
    },
  }
}

export const labelStatutFinal: Record<StatutFinal, { label: string; niveau: Niveau }> = {
  conforme: { label: 'Conforme', niveau: 'ok' },
  vigilance: { label: 'Vigilance', niveau: 'warn' },
  depassement: { label: 'Dépassement', niveau: 'danger' },
}

// ─── Objets DICOM disponibles par séance ─────────────────────────────────────

export type EtatObjet = 'present' | 'absent' | 'non-exporte'

export interface ObjetDicom {
  nom: string
  etat: EtatObjet
  source: 'machine' | 'dimadose'
  role: string
}

/**
 * Dérive la liste des objets réellement disponibles pour une séance.
 * Une séance ATP ne produit ni RTSSj, ni RTPj, ni RTDosej — donc pas de sCT
 * ni de RTDose sCT non plus. C'est ce qui rend une ATP moins informative (§6).
 */
export function objetsDicom(seance: SeanceEvaluee): ObjetDicom[] {
  const ats = seance.voie === 'ATS'
  const fait = seance.realisee

  const etatAdaptation: EtatObjet = !fait ? 'absent' : ats ? 'present' : 'non-exporte'
  const etatDimadose: EtatObjet = fait && ats ? 'present' : 'absent'

  return [
    { nom: 'IRMj', etat: 'present', source: 'machine', role: 'Image IRM de la séance' },
    { nom: 'Reg IRMj/IRMref', etat: 'present', source: 'machine', role: 'Recalage rigide — décalages x, y, z' },
    { nom: 'RTSSj', etat: etatAdaptation, source: 'machine', role: 'Contours du jour corrigés' },
    { nom: 'RTPj', etat: etatAdaptation, source: 'machine', role: 'Plan du jour réoptimisé' },
    { nom: 'RTDosej', etat: etatAdaptation, source: 'machine', role: 'Dose du jour calculée sur l\'IRM' },
    { nom: 'sCT', etat: etatDimadose, source: 'dimadose', role: 'Scanner synthétique généré depuis l\'IRMj' },
    { nom: 'RTDose sCT', etat: etatDimadose, source: 'dimadose', role: 'Dose recalculée sur le sCT' },
    { nom: 'Champ de déformation', etat: fait ? 'present' : 'absent', source: 'dimadose', role: 'IRMj → IRMref' },
    {
      nom: `Dose cumulée S1–S${seance.numero}`,
      etat: seance.incluse ? 'present' : 'absent',
      source: 'dimadose',
      role: 'Cumul reconstruit + indicateur de confiance',
    },
    { nom: 'IRMpost', etat: 'absent', source: 'machine', role: 'Image 3D après délivrance (facultative)' },
    { nom: 'IRMv', etat: seance.mesures.reprise ? 'non-exporte' : 'absent', source: 'machine', role: 'Image de vérification — non conservée' },
  ]
}

export const labelEtatObjet: Record<EtatObjet, { court: string; long: string; niveau: Niveau }> = {
  present: { court: '✓', long: 'Présent', niveau: 'ok' },
  'non-exporte': { court: 'N/E', long: 'Non exporté par la machine', niveau: 'neutral' },
  absent: { court: '—', long: 'Absent', niveau: 'neutral' },
}

// ─── Journal de traçabilité ──────────────────────────────────────────────────

export type CategorieTrace =
  | 'verdict'
  | 'sommation'
  | 'dose'
  | 'validation'
  | 'reacquisition'
  | 'voie'
  | 'contrainte'
  | 'export'
  | 'referentiel'
  | 'critere'
  | 'seance'

/**
 * Une action humaine enregistrée. Le brief exige la trace des décisions
 * (choix retenu, recommandation non suivie et son motif, révision d'un
 * verdict) : ce journal est cette trace, en ajout seul.
 */
export interface EntreeTrace {
  id: string
  horodatage: string
  auteur: string
  role: string
  categorie: CategorieTrace
  seance: number | null
  libelle: string
  detail?: string
  /** L'action s'écarte de ce que l'outil proposait. */
  ecart?: boolean
}

export const labelCategorieTrace: Record<CategorieTrace, string> = {
  verdict: 'Verdict',
  sommation: 'Sommation',
  dose: 'Dose retenue',
  validation: 'Validation',
  reacquisition: 'Acquisition',
  voie: 'Décision ATP / ATS',
  contrainte: 'Contrainte',
  export: 'Export',
  referentiel: 'Référentiel',
  critere: 'Critère',
  seance: 'Séance',
}

export const niveauCategorieTrace: Record<CategorieTrace, Niveau> = {
  verdict: 'warn',
  sommation: 'warn',
  dose: 'neutral',
  validation: 'ok',
  reacquisition: 'danger',
  voie: 'warn',
  contrainte: 'neutral',
  export: 'neutral',
  referentiel: 'neutral',
  critere: 'neutral',
  seance: 'neutral',
}

/** « 2026-08-30 » → « 30 août 2026 ». Rend la chaîne telle quelle si non datée. */
export function formatDateCourte(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatHorodatage(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${heure}`
}

/** Export texte du journal, pour archivage hors de l'outil. */
export function exporterTrace(trace: EntreeTrace[], entete: string[]): string {
  const lignes = trace.map(e =>
    [
      formatHorodatage(e.horodatage),
      e.seance === null ? 'dossier' : `S${e.seance}`,
      labelCategorieTrace[e.categorie],
      e.libelle,
      e.detail ?? '',
      `${e.auteur} (${e.role})`,
      e.ecart ? 'écart à la proposition' : '',
    ].join('\t'),
  )
  return [...entete, '', ...lignes].join('\n')
}

// ─── Suite d'une séance terminée ─────────────────────────────────────────────

export interface EtatApresSeance {
  /** Séance désormais à l'ordre du jour. */
  seanceCourante: number
  derniereSeanceDate: string
  prochaineSeanceDate: string
  /** Date proposée pour la prochaine séance, au format ISO, à confirmer. */
  prochaineSeanceISO: string
  statut: 'en-cours' | 'termine'
  /** Prochaine action attendue de l'équipe. */
  action: 'validation-requise' | 'rapport-disponible'
  confiance: Confiance
  /** Le protocole est allé au bout. */
  protocoleTermine: boolean
}

/**
 * Ce que devient le dossier quand la séance `numero` vient d'être délivrée.
 *
 * La séance est faite, mais pas encore évaluée : la prochaine action est donc
 * la validation inter-séance (moment A), sauf à la dernière séance où c'est le
 * rapport de fin de traitement.
 */
export function etatApresSeance(
  seances: SeanceEvaluee[],
  numero: number,
  nbSeances: number = dossier.nbSeances,
): EtatApresSeance {
  const protocoleTermine = numero >= nbSeances
  const suivante = seances.find(s => s.numero === numero + 1)
  const cumul = cumuler(seances, numero)

  const dateSeance = seances.find(s => s.numero === numero)?.mesures.date ?? ''
  const proposee = protocoleTermine ? '' : (suivante?.mesures.date ?? '')

  // Une date proposée antérieure à la séance qui vient d'avoir lieu n'a pas de
  // sens : mieux vaut demander la date que d'en afficher une fausse.
  const prochaineISO = proposee && proposee > dateSeance ? proposee : ''

  return {
    seanceCourante: protocoleTermine ? numero : numero + 1,
    derniereSeanceDate: dateSeance ? formatDateCourte(dateSeance) : '—',
    prochaineSeanceDate: protocoleTermine
      ? '—'
      : prochaineISO ? formatDateCourte(prochaineISO) : 'À planifier',
    prochaineSeanceISO: prochaineISO,
    statut: protocoleTermine ? 'termine' : 'en-cours',
    action: protocoleTermine ? 'rapport-disponible' : 'validation-requise',
    confiance: cumul.confiance,
    protocoleTermine,
  }
}

// ─── Alertes du dossier (vue liste patients) ─────────────────────────────────

export interface AlerteDossier {
  niveau: Niveau
  texte: string
}

/**
 * Alertes affichables hors du dossier (tableau de bord, bandeau latéral).
 * Dérivées du cumul, pour ne jamais contredire ce que montrent les écrans.
 */
export function alertesDossier(cumul: Cumul, recommandation: Recommandation): AlerteDossier[] {
  const alertes: AlerteDossier[] = []

  // Sans séance sommée, il n'y a rien à signaler : un dossier en planification
  // ne doit pas afficher une confiance ou une recommandation qu'on ne peut pas
  // encore établir.
  if (cumul.seancesIncluses.length === 0) {
    if (cumul.seancesExclues.length > 0) {
      alertes.push({
        niveau: 'danger',
        texte: `Aucune séance sommée — S${cumul.seancesExclues.join(', S')} exclue(s) du cumul`,
      })
    }
    return alertes
  }

  for (const l of cumul.lignes) {
    if (l.structure.type !== 'oar' || l.ecartRelatif <= SEUILS.cumul.deriveHaute) continue
    alertes.push({
      niveau: 'danger',
      texte: `${l.structure.nom} ${l.structure.metrique} : ${fmtSigne(l.ecart, 1)} `
        + `${l.structure.unite} au-dessus du prévisionnel`,
    })
  }

  for (const l of cumul.lignes) {
    if (l.structure.type !== 'oar' || l.partObjectif < SEUILS.cumul.partObjectifVigilance) continue
    alertes.push({
      niveau: 'warn',
      texte: `${l.structure.nom} ${l.structure.metrique} : projection à `
        + `${(l.partObjectif * 100).toFixed(0)} % de l'objectif de fin de traitement`,
    })
  }

  if (cumul.seancesExclues.length > 0) {
    alertes.push({
      niveau: 'warn',
      texte: `Séance(s) S${cumul.seancesExclues.join(', S')} exclue(s) du cumul`,
    })
  }

  if (cumul.confiance !== 'haute') {
    alertes.push({
      niveau: cumul.confiance === 'faible' ? 'danger' : 'warn',
      texte: `Confiance du cumul ${cumul.confiance} — ${cumul.motifsConfiance[0] ?? ''}`,
    })
  }

  if (cumul.seancesNonValidees.length > 0) {
    alertes.push({
      niveau: 'warn',
      texte: `Séance(s) S${cumul.seancesNonValidees.join(', S')} en attente de validation`,
    })
  }

  alertes.push({
    niveau: recommandation.voie === 'ATS' ? 'warn' : 'ok',
    texte: `Recommandation du jour : ${recommandation.voie} (confiance ${recommandation.confiance})`,
  })

  return alertes
}
