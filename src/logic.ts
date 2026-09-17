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
  affectationsDensite,
  dossier,
  formatNombre,
  mesuresSeances,
  structures,
  type AffectationDensite,
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
  /** Qualification de la séance en fin de workflow — voir `VerdictSeance`. */
  verdict?: VerdictSeance
  /**
   * Comment s'est passé le recalage du jour, et quelle affectation de densité
   * a été retenue. Texte libre : ce sont des observations que rien ne calcule,
   * et qui expliquent après coup pourquoi une séance ressemble à ce qu'elle
   * est. Elles suivent au rapport et au journal.
   */
  noteRecalage?: string
  noteDensites?: string
  /**
   * Données facultatives rechargées après une séance ATP.
   *
   * Une séance ATP applique le plan de référence, et n'a donc en principe rien
   * à réimporter. Mais le plan peut avoir été retouché en séance, et une IRM
   * de vérification peut avoir été acquise. Quand ces objets reviennent, la
   * dose de la séance cesse d'être une estimation — c'est ce qui fait sortir
   * la séance de l'état « information réduite ».
   */
  /** Ce que l'équipe rapporte de la délivrance — voir `SuiviGating`. */
  gating?: SuiviGating
  /**
   * Commentaire libre laissé au bas d'une étape, par identifiant d'étape.
   *
   * Facultatif, et destiné à la séance suivante : c'est ce qu'un opérateur
   * dirait de vive voix à celui qui prendra la main demain, et que rien
   * d'autre ne transporte. Repris au rapport de traitement.
   */
  commentairesEtape?: Record<string, string>
  /** IRM acquise après la séance, facultative — voir l'étape 5. */
  irmPostTraitement?: boolean
  atpOptionnel?: {
    /** Plan effectivement délivré, s'il diffère du plan de référence. */
    rtplan?: boolean
    /** Dose recalculée sur le plan délivré — candidate au cumul. */
    rtdose?: boolean
    /** IRM de vérification post-adaptation. */
    irmv?: boolean
  }
}

export type Decisions = Record<number, DecisionsSeance>

// ─── Qualification d'une séance ──────────────────────────────────────────────

/**
 * Le code posé par l'équipe à la fin d'une séance. Il résume, d'un coup d'œil
 * sur le tableau de bord, ce que les écrans détaillent — et il est *dit* par
 * quelqu'un : ce n'est pas une valeur calculée, c'est un jugement humain, au
 * même titre que la décision ATP/ATS.
 */
export type CodeSeance = 'vert' | 'orange' | 'rouge'

export interface VerdictSeance {
  code: CodeSeance
  /** Ce qui s'est passé. Obligatoire dès que le code n'est pas vert. */
  commentaire: string
  par: string
  horodatage: string
}

export const libellesCodeSeance: Record<CodeSeance, string> = {
  vert: 'Conforme',
  orange: 'Point particulier',
  rouge: 'Non conforme',
}

export const explicationsCodeSeance: Record<CodeSeance, string> = {
  vert: "La séance s'est déroulée comme attendu",
  orange: 'Quelque chose mérite d’être signalé, sans remettre la séance en cause',
  rouge: "La séance ne correspond pas à ce qui était attendu",
}

/** Jetons de couleur, pour que le tableau de bord et le workflow s'accordent. */
export const couleursCodeSeance: Record<CodeSeance, { pastille: string; texte: string; fond: string; bord: string }> = {
  vert:   { pastille: 'bg-ok',     texte: 'text-ok-text',     fond: 'bg-ok-bg',     bord: 'border-ok-border' },
  orange: { pastille: 'bg-warn',   texte: 'text-warn-text',   fond: 'bg-warn-bg',   bord: 'border-warn-border' },
  rouge:  { pastille: 'bg-danger', texte: 'text-danger-text', fond: 'bg-danger-bg', bord: 'border-danger-border' },
}

/**
 * Un code orange ou rouge sans explication ne transmet rien : la personne qui
 * lira le tableau de bord dans trois semaines saura qu'il s'est passé quelque
 * chose, sans savoir quoi. Le commentaire est donc exigé dès qu'on s'écarte du
 * vert.
 */
export function verdictIncomplet(code: CodeSeance, commentaire: string): string | null {
  if (code === 'vert') return null
  return commentaire.trim().length === 0
    ? `Un code ${libellesCodeSeance[code].toLowerCase()} demande une explication : dites ce qui s'est passé.`
    : null
}

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
  /**
   * Voir qui est le patient — nom, prénom, date de naissance, identifiant.
   *
   * Faux pour un partenaire extérieur à l'établissement : il regarde comment
   * l'outil raisonne, ce qui ne demande pas de savoir qui est traité.
   */
  voitIdentitePatient: boolean
  /** Créer ou supprimer un dossier patient. */
  peutGererPatients: boolean
}

export function droits(role: Role): Droits {
  const interne = role !== 'partenaire'
  const lectureSeule = role === 'manipulateur' || role === 'partenaire'
  return {
    peutValiderEtape: role === 'physicien' || role === 'medecin',
    peutDeciderVoie: role === 'medecin',
    peutEvaluerSeance: role === 'physicien',
    peutCharger: !lectureSeule,
    lectureSeule,
    voitIdentitePatient: interne,
    peutGererPatients: interne && !lectureSeule,
  }
}

// ─── Score d'une contrainte ──────────────────────────────────────────────────

export interface ScoreContrainte {
  /** 0 à 100. */
  valeur: number
  niveau: Niveau
  libelle: string
  /** Marge restante sur l'objectif de fin de traitement, dans l'unité de la structure. */
  marge: number
}

/**
 * Où en est une contrainte, sur une échelle de 0 à 100.
 *
 * **Ce n'est pas un indice clinique validé.** C'est une lecture : elle place
 * la projection de fin de traitement par rapport à l'objectif, à l'échelle de
 * la tolérance admise. Elle sert à parcourir un tableau d'un coup d'œil, pas à
 * décider — la décision reste sur les valeurs elles-mêmes.
 *
 *   100 — la projection reste à une tolérance entière du plafond
 *    50 — la projection est exactement sur l'objectif
 *     0 — la projection dépasse l'objectif d'une tolérance entière
 *
 * Entre ces points, la variation est linéaire. La tolérance est donnée par
 * séance ; elle est ramenée à l'échelle du traitement par `nbSeances`.
 */
export function scorerContrainte(
  structure: Structure,
  projection: number,
  toleranceParSeance: number,
  nbSeances: number,
): ScoreContrainte {
  const toleranceTotale = Math.max(toleranceParSeance * nbSeances, 1e-6)
  // Marge positive = du bon côté de l'objectif, quel que soit le sens.
  const marge = structure.sens === 'max'
    ? structure.objectifTotal - projection
    : projection - structure.objectifTotal

  const brut = 50 + 50 * (marge / toleranceTotale)
  const valeur = Math.round(Math.min(100, Math.max(0, brut)))

  const niveau: Niveau = valeur >= 75 ? 'ok' : valeur >= 50 ? 'warn' : 'danger'
  const libelle = valeur >= 75 ? 'Confortable' : valeur >= 50 ? 'Juste' : 'Dépassé'

  return { valeur, niveau, libelle, marge }
}

/**
 * Score d'ensemble, moyenne simple des contraintes affichées.
 *
 * Moyenne simple et non pondérée : pondérer supposerait une hiérarchie entre
 * organes que la maquette n'a pas à décréter.
 */
export function scoreGlobal(scores: ScoreContrainte[]): ScoreContrainte | null {
  if (scores.length === 0) return null
  const valeur = Math.round(scores.reduce((a, s) => a + s.valeur, 0) / scores.length)
  const niveau: Niveau = valeur >= 75 ? 'ok' : valeur >= 50 ? 'warn' : 'danger'
  const libelle = valeur >= 75 ? 'Confortable' : valeur >= 50 ? 'Juste' : 'Dépassé'
  return { valeur, niveau, libelle, marge: 0 }
}

// ─── Gating et délivrance ────────────────────────────────────────────────────

/**
 * Comment la délivrance s'est passée, du point de vue de l'asservissement.
 *
 * Ce n'est pas une mesure : la machine n'exporte ni l'imagerie ciné 2D, ni le
 * critère de gating, ni les décalages temps réel (§ du brief). C'est donc
 * l'équipe qui le dit, et c'est la seule trace qu'il en reste.
 */
export type DeroulementGating = 'ras' | 'ajustements' | 'gros-ajustements'

export const libellesDeroulementGating: Record<DeroulementGating, string> = {
  'ras': 'RAS — rien de notable',
  'ajustements': "Besoin d'ajuster",
  'gros-ajustements': 'Gros ajustements',
}

export const explicationsDeroulementGating: Record<DeroulementGating, string> = {
  'ras': "L'asservissement a tenu, aucune reprise",
  'ajustements': 'Quelques reprises, sans remettre la séance en cause',
  'gros-ajustements': 'Reprises nombreuses ou prolongées — à signaler au cumul',
}

export const niveauDeroulementGating: Record<DeroulementGating, Niveau> = {
  'ras': 'ok',
  'ajustements': 'warn',
  'gros-ajustements': 'danger',
}

export interface SuiviGating {
  deroulement: DeroulementGating
  /** Ce qui s'est passé. Exigé dès qu'on sort du RAS. */
  commentaire: string
  /** Durée de la séance en minutes, de l'installation à la fin de délivrance. */
  dureeMinutes: number | null
  /** Le seuil de gating a été adapté pour cette séance. */
  seuilAdapte: boolean
  /** Le seuil réellement appliqué, quand il diffère du seuil du protocole. */
  seuilApplique: string | null
  par: string
  horodatage: string
}

/**
 * Comme pour la qualification de séance : un signalement sans explication ne
 * transmet rien à qui lira le dossier plus tard.
 */
export function suiviGatingIncomplet(
  deroulement: DeroulementGating,
  commentaire: string,
): string | null {
  if (deroulement === 'ras') return null
  return commentaire.trim().length === 0
    ? "Dites ce qui a demandé un ajustement : sans cela, le signalement ne transmet rien."
    : null
}

// ─── Plan délivré comparé au plan de référence ───────────────────────────────

export interface LigneEcartPlan {
  structure: Structure
  /** Ce que prévoyait le plan de référence pour une séance. */
  reference: number
  /** Ce que donne la dose rechargée du plan réellement délivré. */
  delivre: number
  ecart: number
  ecartPct: number
  /** L'écart dépasse le seuil au-delà duquel il mérite un regard. */
  notable: boolean
}

/** Au-delà de 5 %, l'écart au plan de référence mérite d'être regardé. */
export const SEUIL_ECART_PLAN_PCT = 5

/**
 * Écart entre le plan délivré et le plan de référence, structure par structure.
 *
 * Utile après une séance ATP dont le plan a été retouché : le plan de référence
 * n'a alors pas été appliqué tel quel, et le cumul ne doit pas faire comme si.
 */
export function comparerAuPlanReference(pointsDelivres: Record<string, number>): LigneEcartPlan[] {
  return structures.map(structure => {
    const reference = structure.prevuParSeance
    const delivre = pointsDelivres[structure.id] ?? reference
    const ecart = delivre - reference
    const ecartPct = reference === 0 ? 0 : (ecart / reference) * 100
    return {
      structure,
      reference,
      delivre,
      ecart,
      ecartPct,
      notable: Math.abs(ecartPct) >= SEUIL_ECART_PLAN_PCT,
    }
  })
}

// ─── Convention des axes du recalage ─────────────────────────────────────────

export type Axe = 'x' | 'y' | 'z'

/**
 * Ce que désignent X, Y et Z, et dans quel sens.
 *
 * Convention IEC 61217 telle que Monaco l'emploie pour un patient en décubitus
 * dorsal, tête en premier. **Elle n'est pas arrêtée** : à confirmer auprès de
 * l'établissement, et elle peut différer sur MRIdian. Un décalage lu à
 * l'envers déplacerait la table du mauvais côté — c'est pourquoi la maquette
 * affiche la convention plutôt que de la sous-entendre.
 */
export interface ConventionAxe {
  axe: Axe
  /** Ce que l'axe parcourt. */
  plan: string
  /** Direction quand la valeur est positive, puis négative. */
  positif: string
  negatif: string
  /** Formes courtes, pour les lignes serrées. */
  positifCourt: string
  negatifCourt: string
}

export const CONVENTION_AXES: ConventionAxe[] = [
  { axe: 'x', plan: 'Latéral',      positif: 'gauche',    negatif: 'droite',     positifCourt: 'G',    negatifCourt: 'D' },
  { axe: 'y', plan: 'Longitudinal', positif: 'supérieur', negatif: 'inférieur',  positifCourt: 'sup',  negatifCourt: 'inf' },
  { axe: 'z', plan: 'Vertical',     positif: 'antérieur', negatif: 'postérieur', positifCourt: 'ant',  negatifCourt: 'post' },
]

export interface DecalageLu extends ConventionAxe {
  valeur: number
  /** Direction correspondant au signe. `null` quand la valeur est nulle. */
  direction: string | null
  directionCourte: string | null
}

export function lireDecalages(decalages: readonly [number, number, number]): DecalageLu[] {
  return CONVENTION_AXES.map((c, i) => {
    const valeur = decalages[i]
    return {
      ...c,
      valeur,
      direction: valeur === 0 ? null : valeur > 0 ? c.positif : c.negatif,
      directionCourte: valeur === 0 ? null : valeur > 0 ? c.positifCourt : c.negatifCourt,
    }
  })
}

/** Phrase de rappel de la convention, affichée sous les décalages. */
export const RAPPEL_CONVENTION_AXES =
  CONVENTION_AXES.map(c => `${c.axe.toUpperCase()} ${c.negatif} ↔ ${c.positif}`).join(' · ')

// ─── Densités affectées au RTSSp ─────────────────────────────────────────────

export interface LigneDensite extends AffectationDensite {
  /** Aucune densité affectée : la structure hérite du contour externe. */
  absente: boolean
  /** La densité affectée diffère de celle prévue par le protocole. */
  ecart: boolean
  /** Écart en g/cm³, signé. `null` quand il n'y a rien à comparer. */
  delta: number | null
}

/**
 * Lecture des affectations de densité.
 *
 * Deux choses seulement méritent l'attention d'un physicien qui relit le
 * RTSSp : une structure sans affectation, qui prend alors la densité du
 * contour externe sans que personne l'ait décidé, et une densité qui s'écarte
 * du protocole. Le reste est conforme et doit se lire d'un coup d'œil.
 */
export function lireAffectationsDensite(): LigneDensite[] {
  return affectationsDensite.map(a => {
    const absente = a.densiteAffectee === null
    return {
      ...a,
      absente,
      ecart: !absente && a.densiteAffectee !== a.densiteProtocole,
      delta: absente ? null : a.densiteAffectee! - a.densiteProtocole,
    }
  })
}

/** Ce qu'il y a à signaler, pour l'annoncer sans parcourir le tableau. */
export function resumeDensites(lignes: LigneDensite[]) {
  const ecarts = lignes.filter(l => l.ecart).length
  const absentes = lignes.filter(l => l.absente).length
  return { total: lignes.length, ecarts, absentes, conforme: ecarts === 0 && absentes === 0 }
}

// ─── Morphologie ─────────────────────────────────────────────────────────────

/**
 * IMC, en kg/m². Déduit de la taille et du poids : ce sont eux qui sont
 * saisis et conservés, l'indice n'est qu'une lecture.
 */
export function imc(tailleCm: number, poidsKg: number): number | null {
  if (!isFinite(tailleCm) || !isFinite(poidsKg) || tailleCm <= 0 || poidsKg <= 0) return null
  const m = tailleCm / 100
  return poidsKg / (m * m)
}

export interface LectureIMC {
  valeur: number
  libelle: string
  /**
   * L'IMC sort de la plage courante. Ce n'est pas un verdict : c'est un signal
   * que le jumeau numérique peut demander une adaptation, à l'équipe d'en
   * juger. La maquette ne décide pas à sa place.
   */
  horsPlage: boolean
}

export function lireIMC(valeur: number): LectureIMC {
  // Seuils OMS, donnés comme repère de lecture et non comme règle de traitement.
  if (valeur < 18.5) return { valeur, libelle: 'Maigreur', horsPlage: true }
  if (valeur < 25)   return { valeur, libelle: 'Corpulence normale', horsPlage: false }
  if (valeur < 30)   return { valeur, libelle: 'Surpoids', horsPlage: false }
  return { valeur, libelle: 'Obésité', horsPlage: true }
}

// ─── Pseudonymisation des dossiers ───────────────────────────────────────────

/**
 * Code stable d'un dossier, dérivé de son identifiant.
 *
 * Stable : le même dossier porte toujours le même code, d'une session et d'un
 * poste à l'autre. Un partenaire peut donc dire « le dossier 7C31 » et être
 * compris, sans que personne ait nommé le patient.
 *
 * Le terme juste est **pseudonymisation**, pas anonymisation : qui détient la
 * liste des dossiers peut refaire le lien. Cela protège d'un regard de passage
 * — une démonstration, une capture d'écran, un partenaire en consultation —
 * pas d'un recoupement délibéré.
 */
export function codeDossier(id: string): string {
  // FNV-1a 32 bits : court, déterministe, sans dépendance.
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36).toUpperCase().slice(-4).padStart(4, '0')
}

export interface IdentiteDossier {
  nom: string
  prenom: string
  id: string
  ddn?: string
}

export interface IdentiteAffichee {
  /** Ce qui remplace « DUPONT Michel ». */
  libelle: string
  /** Ce qui remplace « P-2024-0148 ». */
  identifiant: string
  /** Date de naissance, ou un tiret si elle est masquée. */
  ddn: string
  /** Vrai si l'identité est masquée — pour l'annoncer à l'écran. */
  masquee: boolean
}

/**
 * Comment nommer un dossier à l'écran. Point de passage unique : c'est ce qui
 * garantit qu'aucun écran n'oublie de masquer, et qu'on n'a pas à se fier à la
 * vigilance de chaque composant.
 */
export function identiteAffichee(p: IdentiteDossier, voitIdentite: boolean): IdentiteAffichee {
  if (voitIdentite) {
    return {
      libelle: `${p.nom} ${p.prenom}`,
      identifiant: p.id,
      ddn: p.ddn ?? '—',
      masquee: false,
    }
  }
  const code = codeDossier(p.id)
  return {
    libelle: `Dossier ${code}`,
    identifiant: code,
    ddn: '—',
    masquee: true,
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

// ─── Les quatre moments et leur place dans le temps ──────────────────────────

export type MomentId = 'moment-A' | 'moment-B' | 'moment-C' | 'moment-D'

export interface DescriptionMoment {
  id: MomentId
  tag: string
  label: string
  /** Où ce moment se situe dans le déroulement du traitement (§3 du brief). */
  quand: string
  /** À quoi il sert, en une phrase. */
  role: string
  /** Où le trouver dans l'interface. */
  acces: string
}

/**
 * Description de référence des quatre moments. Une seule source : la barre
 * latérale et le guide d'utilisation la partagent, ils ne peuvent donc plus
 * décrire des accès différents.
 */
export const MOMENTS: DescriptionMoment[] = [
  {
    id: 'moment-A',
    tag: 'A',
    label: 'Validation inter-séance',
    quand: 'Après la séance, hors ligne',
    role: "Vérifier la qualité de l'IRM, l'ampleur de la déformation et la dose retenue, "
      + 'puis valider le cumul. Sans contrainte de temps.',
    acces: 'Barre latérale « Aide à la décision », ou « Récap de la séance » en fin de workflow',
  },
  {
    id: 'moment-B',
    tag: 'B',
    label: 'Recommandation ATP / ATS',
    quand: 'En séance, avant l’adaptation',
    role: "Lire en moins de 30 secondes la voie recommandée et ce qui la motive, puis trancher. "
      + 'Aucun contour du jour n’existe encore à cet instant.',
    acces: 'Barre latérale « Aide à la décision », ou « Analyse complète » à l’étape 2',
  },
  {
    id: 'moment-C',
    tag: 'C',
    label: 'Contraintes d’optimisation',
    quand: 'Juste après, si ATS a été retenu',
    role: 'Obtenir le jeu de contraintes proposé pour la réoptimisation, le corriger si besoin, '
      + 'puis le recopier dans le TPS.',
    acces: 'Barre latérale « Aide à la décision », ou « Détail et export » à l’étape 3',
  },
  {
    id: 'moment-D',
    tag: 'D',
    label: 'Rapport de traitement',
    quand: 'Fin de traitement',
    role: 'Consulter la synthèse du traitement réalisé, les événements notables et le journal '
      + 'de traçabilité, puis exporter.',
    acces: 'Barre latérale « Aide à la décision », ou menu utilisateur',
  },
]

export interface EtatMoment extends DescriptionMoment {
  /** Ce qu'il reste à y faire, aujourd'hui. */
  etat: string
  niveau: Niveau
}

/**
 * Les quatre moments ne sont pas des onglets : ce sont quatre instants
 * différents, avec des contraintes de temps opposées (§3). Les situer et dire
 * ce qui s'y joue évite de tomber dessus par hasard.
 */
export function etatsMoments(
  seances: SeanceEvaluee[],
  recommandation: Recommandation,
  seanceCourante: number,
  nbSeances: number = dossier.nbSeances,
): EtatMoment[] {
  const realisees = seances.filter(s => s.realisee)
  const aValider = realisees.filter(s => !s.validee)
  const voie = seances.find(s => s.numero === seanceCourante)?.voie ?? null
  const decrire = (id: MomentId) => MOMENTS.find(m => m.id === id)!

  return [
    {
      ...decrire('moment-A'),
      etat: realisees.length === 0
        ? 'Aucune séance à évaluer'
        : aValider.length > 0
          ? `${aValider.length} séance(s) à valider — S${aValider.map(s => s.numero).join(', S')}`
          : 'Toutes les séances sont validées',
      niveau: aValider.length > 0 ? 'warn' : realisees.length === 0 ? 'neutral' : 'ok',
    },
    {
      ...decrire('moment-B'),
      etat: voie
        ? `${voie} retenu pour la séance ${seanceCourante}`
        : `Décision à prendre — ${recommandation.voie} recommandé`,
      niveau: voie ? 'ok' : 'warn',
    },
    {
      ...decrire('moment-C'),
      etat: voie === 'ATS'
        ? 'Jeu de contraintes proposé pour la réoptimisation'
        : voie === 'ATP'
          ? 'Sans objet — le plan de référence est appliqué tel quel'
          : 'En attente de la décision du jour',
      niveau: voie === 'ATS' ? 'ok' : 'neutral',
    },
    {
      ...decrire('moment-D'),
      etat: realisees.length >= nbSeances
        ? 'Rapport définitif'
        : `Provisoire — ${realisees.length} séance(s) sur ${nbSeances}`,
      niveau: realisees.length >= nbSeances ? 'ok' : 'neutral',
    },
  ]
}

// ─── Référentiel de sommation (IRMref) ───────────────────────────────────────

export interface OptionReferentiel {
  id: string
  label: string
  sub: string
}

export const REFERENTIEL_PAR_DEFAUT = 'irmp'

/** Libellé d'un référentiel, déduit de son identifiant. */
export function labelReferentiel(id: string): string {
  if (id === REFERENTIEL_PAR_DEFAUT) return 'IRMp — IRM de planification'
  const m = /^irmj-(\d+)$/.exec(id)
  return m ? `IRMj — séance ${m[1]}` : id
}

/**
 * Images pouvant servir de référentiel à la séance `seanceCourante`.
 *
 * §6 du brief : « l'utilisateur peut désigner l'image d'une autre séance comme
 * référence, typiquement J1 comme référence pour J2 ». La liste suit donc les
 * séances réellement réalisées, au lieu d'être figée.
 */
export function referentielsPossibles(
  seances: SeanceEvaluee[],
  seanceCourante: number,
): OptionReferentiel[] {
  const options: OptionReferentiel[] = [{
    id: REFERENTIEL_PAR_DEFAUT,
    label: labelReferentiel(REFERENTIEL_PAR_DEFAUT),
    sub: 'Référentiel standard du protocole',
  }]

  for (const s of seances) {
    if (!s.realisee || s.numero >= seanceCourante) continue
    const id = `irmj-${s.numero}`
    options.push({
      id,
      label: labelReferentiel(id),
      sub: `Image acquise le ${formatDateCourte(s.mesures.date)}`
        + (s.numero === 1 ? ' — cas typique si la planification préalable disparaît' : ''),
    })
  }

  return options
}

// ─── Journal de traçabilité ──────────────────────────────────────────────────

export type CategorieTrace =
  | 'etape'
  | 'note'
  | 'voie'
  | 'verdict'
  | 'sommation'
  | 'dose'
  | 'validation'
  | 'reacquisition'
  | 'contrainte'
  | 'referentiel'
  | 'critere'
  | 'seance'
  | 'export'

/**
 * Rang d'une action dans le journal.
 *
 * Le journal n'est pas un historique de navigation : il enregistre des actes.
 * Les trois rangs permettent de lire d'abord ce qui engage l'équipe, sans
 * perdre le reste.
 */
export type RangTrace = 'decision' | 'verification' | 'parametre'

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
  etape: "Validation d'étape",
  note: 'Observation de séance',
  voie: 'Décision ATP / ATS',
  verdict: 'Révision de verdict',
  sommation: 'Mode de sommation',
  dose: 'Dose retenue',
  validation: 'Validation du cumul',
  reacquisition: 'Nouvelle acquisition',
  contrainte: 'Contrainte',
  referentiel: 'Référentiel',
  critere: 'Critère de comparaison',
  seance: 'Séance',
  export: 'Export',
}

export const niveauCategorieTrace: Record<CategorieTrace, Niveau> = {
  etape: 'ok',
  note: 'neutral',
  voie: 'warn',
  verdict: 'warn',
  sommation: 'warn',
  dose: 'neutral',
  validation: 'ok',
  reacquisition: 'danger',
  contrainte: 'neutral',
  referentiel: 'neutral',
  critere: 'neutral',
  seance: 'neutral',
  export: 'neutral',
}

/**
 * Ce qui engage l'équipe (une voie retenue, un verdict révisé, une étape
 * validée) se lit avant les réglages d'analyse.
 */
export const rangCategorieTrace: Record<CategorieTrace, RangTrace> = {
  voie: 'decision',
  verdict: 'decision',
  sommation: 'decision',
  reacquisition: 'decision',
  etape: 'verification',
  note: 'verification',
  validation: 'verification',
  seance: 'verification',
  dose: 'verification',
  contrainte: 'parametre',
  referentiel: 'parametre',
  critere: 'parametre',
  export: 'parametre',
}

export const labelRangTrace: Record<RangTrace, string> = {
  decision: 'Décisions',
  verification: 'Validations',
  parametre: 'Réglages et exports',
}

/** Regroupe le journal par séance, séance du jour en premier. */
export function grouperTraceParSeance(
  trace: EntreeTrace[],
): { seance: number | null; entrees: EntreeTrace[] }[] {
  const groupes = new Map<number | null, EntreeTrace[]>()
  for (const e of trace) {
    const liste = groupes.get(e.seance)
    if (liste) liste.push(e)
    else groupes.set(e.seance, [e])
  }
  return [...groupes.entries()]
    .map(([seance, entrees]) => ({ seance, entrees }))
    .sort((a, b) => {
      if (a.seance === null) return 1
      if (b.seance === null) return -1
      return b.seance - a.seance
    })
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
      labelRangTrace[rangCategorieTrace[e.categorie]],
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
