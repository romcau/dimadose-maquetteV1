/* ─────────────────────────────────────────────────────────────────────────────
 * DIMADOSE — Données brutes du dossier de démonstration
 *
 * Ce fichier ne contient QUE des mesures brutes (ce que la machine ou l'outil
 * ont produit). Aucun verdict, aucune recommandation, aucune contrainte
 * proposée n'y figure : tout cela est *dérivé* dans `logic.ts`.
 *
 * Règle : si une valeur affichée à l'écran peut se déduire d'une autre,
 * elle n'a pas sa place ici.
 * ──────────────────────────────────────────────────────────────────────────── */

// ─── Dossier patient ─────────────────────────────────────────────────────────

export const dossier = {
  nom: 'DUPONT',
  prenom: 'Michel',
  id: '19480312-M',
  protocole: 'Prostate SBRT',
  prescriptionTotale: 36.25, // Gy
  nbSeances: 5,
  seanceCourante: 4,
  medecin: 'Dr Fontaine',
  physicien: 'Mme Korhonen',
}

// ─── Profils utilisateurs ────────────────────────────────────────────────────

export type Role = 'physicien' | 'medecin' | 'manipulateur'

export const libellesRoles: Record<Role, string> = {
  physicien: 'Physicien médical',
  medecin: 'Radiothérapeute',
  manipulateur: 'Manipulateur',
}

export const sousTitresRoles: Record<Role, string> = {
  physicien: 'Valide les étapes, révise les verdicts, enregistre le cumul',
  medecin: 'Valide les étapes et tranche la décision ATP / ATS',
  manipulateur: 'Consultation en lecture seule',
}

/**
 * Annuaire des utilisateurs. La traçabilité nomme une personne, pas un rôle :
 * chaque action du journal porte le compte qui l'a réalisée.
 *
 * L'authentification elle-même relève du socle web multi-utilisateurs, listé
 * au §4 du brief parmi les composants existants — la maquette ne conserve
 * aucun mot de passe.
 */
export interface Compte {
  /** Identifiant de connexion, unique dans l'établissement. */
  identifiant: string
  /** Civilité ou titre affiché dans la traçabilité. Facultatif. */
  titre?: string
  nom: string
  prenom: string
  role: Role
  email: string
  statut: 'actif' | 'inactif'
}

export const comptesInitiaux: Compte[] = [
  { identifiant: 'a.korhonen', titre: 'Mme', nom: 'Korhonen', prenom: 'Aino',    role: 'physicien',    email: 'a.korhonen@chu.fr', statut: 'actif' },
  { identifiant: 'l.fontaine', titre: 'Dr',  nom: 'Fontaine', prenom: 'Laurent', role: 'medecin',      email: 'l.fontaine@chu.fr', statut: 'actif' },
  { identifiant: 's.marchand', titre: 'Dr',  nom: 'Marchand', prenom: 'Sophie',  role: 'medecin',      email: 's.marchand@chu.fr', statut: 'actif' },
  { identifiant: 'm.dupas',    titre: 'M.',  nom: 'Dupas',    prenom: 'Marc',    role: 'physicien',    email: 'm.dupas@chu.fr',    statut: 'actif' },
  { identifiant: 't.perrin',   titre: 'M.',  nom: 'Perrin',   prenom: 'Théo',    role: 'manipulateur', email: 't.perrin@chu.fr',   statut: 'actif' },
  { identifiant: 'e.girard',   titre: 'Mme', nom: 'Girard',   prenom: 'Élise',   role: 'physicien',    email: 'e.girard@chu.fr',   statut: 'inactif' },
]

/** Nom porté par le journal de traçabilité et l'en-tête. */
export const nomAffiche = (c: Compte): string =>
  c.titre ? `${c.titre} ${c.nom}` : `${c.prenom} ${c.nom}`

export const compteParIdentifiant = (comptes: Compte[], identifiant: string): Compte | undefined =>
  comptes.find(c => c.identifiant.trim().toLowerCase() === identifiant.trim().toLowerCase())

/** Images candidates comme référentiel de sommation (IRMref). */
export const referentielsDisponibles = [
  { id: 'irmp', label: 'IRMp — IRM de planification', sub: 'Référentiel standard' },
  { id: 'irmj1', label: 'IRMj — Séance 1', sub: 'Si la planification préalable est supprimée' },
  { id: 'irmj2', label: 'IRMj — Séance 2', sub: 'Désignation manuelle' },
]

// ─── Catalogue des structures et contraintes de référence (RTPp) ─────────────

export type TypeStructure = 'cible' | 'oar'

export interface Structure {
  id: string
  nom: string
  type: TypeStructure
  /** Métrique DVH, affichée telle quelle. */
  metrique: string
  /** `max` → contrainte « ≤ », `min` → contrainte « ≥ ». */
  sens: 'max' | 'min'
  unite: 'Gy' | 'cc'
  /** Contrainte de référence du plan (RTPp), par séance. */
  contrainteRef: number
  /** Objectif sur l'ensemble du traitement. */
  objectifTotal: number
  /**
   * Valeur attendue par séance d'après le prévisionnel RTDosep.
   * C'est le « prévu au même stade » exigé par le brief (§10).
   */
  prevuParSeance: number
}

export const structures: Structure[] = [
  { id: 'ptv-d95',      nom: 'PTV',        type: 'cible', metrique: 'D95%',   sens: 'min', unite: 'Gy', contrainteRef: 6.88, objectifTotal: 34.40, prevuParSeance: 6.87 },
  { id: 'prostate-d50', nom: 'Prostate',   type: 'cible', metrique: 'D50%',   sens: 'max', unite: 'Gy', contrainteRef: 7.25, objectifTotal: 36.25, prevuParSeance: 7.03 },
  { id: 'rectum-d05',   nom: 'Rectum',     type: 'oar',   metrique: 'D0.5cc', sens: 'max', unite: 'Gy', contrainteRef: 7.60, objectifTotal: 38.00, prevuParSeance: 4.60 },
  { id: 'rectum-v29',   nom: 'Rectum',     type: 'oar',   metrique: 'V29Gy',  sens: 'max', unite: 'cc', contrainteRef: 4.00, objectifTotal: 20.00, prevuParSeance: 3.27 },
  { id: 'vessie-d05',   nom: 'Vessie',     type: 'oar',   metrique: 'D0.5cc', sens: 'max', unite: 'Gy', contrainteRef: 7.60, objectifTotal: 38.00, prevuParSeance: 4.73 },
  { id: 'uretre-d10',   nom: 'Urètre',     type: 'oar',   metrique: 'D10%',   sens: 'max', unite: 'Gy', contrainteRef: 8.40, objectifTotal: 42.00, prevuParSeance: 5.07 },
  { id: 'tf-g-d2',      nom: 'TF Gauche',  type: 'oar',   metrique: 'D2cc',   sens: 'max', unite: 'Gy', contrainteRef: 5.00, objectifTotal: 25.00, prevuParSeance: 2.37 },
  { id: 'tf-d-d2',      nom: 'TF Droite',  type: 'oar',   metrique: 'D2cc',   sens: 'max', unite: 'Gy', contrainteRef: 5.00, objectifTotal: 25.00, prevuParSeance: 2.37 },
]

/** Formatage décimal français — virgule décimale partout dans l'interface. */
export const formatNombre = (v: number, dec = 2): string =>
  v.toFixed(dec).replace('.', ',')

// ─── Mesures brutes par séance ───────────────────────────────────────────────

export type Voie = 'ATP' | 'ATS'

/** Points de dose de la séance, par structure (Gy ou cc). */
export type PointsDose = Record<string, number>

export interface MesuresQualite {
  /** Grade des artefacts de mouvement : 0 absents · 1 légers · 2 modérés · 3 sévères. */
  artefacts: 0 | 1 | 2 | 3
  /** Rapport signal / bruit mesuré. */
  rsb: number
  /** Distorsion géométrique maximale, en mm. */
  distorsion: number
}

export interface MesuresDeformation {
  /** Jacobien maximal du champ de déformation IRMj → IRMref. */
  jacobienMax: number
  /** Déplacement maximal du champ, en mm. */
  deplacementMax: number
  /** Variation du volume rectal par rapport à l'IRMref, en %. */
  volumeRectum: number
}

export interface MesuresSeance {
  numero: number
  /** Date de la séance au format ISO (`AAAA-MM-JJ`), formatée à l'affichage. */
  date: string
  /** Voie effectivement suivie. `null` = séance non encore réalisée. */
  voie: Voie | null
  qualite: MesuresQualite
  deformation: MesuresDeformation
  /** Décalages du recalage rigide IRMj / IRMref, en mm. */
  decalages: [number, number, number]
  /** RTDosej — dose calculée sur l'IRM pendant le traitement. */
  doseIRM: PointsDose
  /**
   * RTDose sCT — dose recalculée sur le scanner synthétique.
   * Absente en ATP : la séance ne produit ni RTPj ni balistique du jour.
   */
  doseSCT: PointsDose | null
  /** Une IRMv a déclenché une reprise du recalage (image non conservée). */
  reprise?: boolean
  commentaire?: string
}

export const mesuresSeances: MesuresSeance[] = [
  {
    numero: 1,
    date: '2026-08-22',
    voie: 'ATS',
    qualite: { artefacts: 0, rsb: 26.4, distorsion: 1.1 },
    deformation: { jacobienMax: 1.28, deplacementMax: 3.9, volumeRectum: 5 },
    decalages: [1.2, -0.8, 2.1],
    doseIRM: { 'ptv-d95': 6.98, 'prostate-d50': 7.02, 'rectum-d05': 4.42, 'rectum-v29': 3.30, 'vessie-d05': 4.15, 'uretre-d10': 4.92, 'tf-g-d2': 2.06, 'tf-d-d2': 2.16 },
    doseSCT: { 'ptv-d95': 6.95, 'prostate-d50': 7.00, 'rectum-d05': 4.50, 'rectum-v29': 3.40, 'vessie-d05': 4.10, 'uretre-d10': 4.90, 'tf-g-d2': 2.05, 'tf-d-d2': 2.15 },
    commentaire: 'Séance de référence',
  },
  {
    numero: 2,
    date: '2026-08-26',
    voie: 'ATP',
    qualite: { artefacts: 1, rsb: 24.1, distorsion: 1.3 },
    deformation: { jacobienMax: 1.32, deplacementMax: 4.2, volumeRectum: 6 },
    decalages: [0.9, -1.2, 1.8],
    doseIRM: { 'ptv-d95': 6.88, 'prostate-d50': 6.95, 'rectum-d05': 4.90, 'rectum-v29': 3.60, 'vessie-d05': 3.90, 'uretre-d10': 5.05, 'tf-g-d2': 2.10, 'tf-d-d2': 2.20 },
    doseSCT: null,
    commentaire: 'Plan de référence appliqué avec décalage de table',
  },
  {
    numero: 3,
    date: '2026-08-30',
    voie: 'ATS',
    qualite: { artefacts: 2, rsb: 17.2, distorsion: 1.6 },
    deformation: { jacobienMax: 2.14, deplacementMax: 12.8, volumeRectum: 38 },
    decalages: [3.8, -2.1, 4.6],
    doseIRM: { 'ptv-d95': 6.99, 'prostate-d50': 6.98, 'rectum-d05': 6.55, 'rectum-v29': 5.05, 'vessie-d05': 3.46, 'uretre-d10': 4.88, 'tf-g-d2': 2.06, 'tf-d-d2': 2.16 },
    doseSCT: { 'ptv-d95': 6.97, 'prostate-d50': 6.95, 'rectum-d05': 6.80, 'rectum-v29': 5.30, 'vessie-d05': 3.40, 'uretre-d10': 4.85, 'tf-g-d2': 2.05, 'tf-d-d2': 2.15 },
    reprise: true,
    commentaire: 'Remplissage rectal important',
  },
  {
    numero: 4,
    date: '2026-09-02',
    voie: null,
    qualite: { artefacts: 0, rsb: 25.8, distorsion: 1.2 },
    deformation: { jacobienMax: 1.41, deplacementMax: 5.6, volumeRectum: 11 },
    decalages: [2.4, -1.6, 3.2],
    doseIRM: { 'ptv-d95': 6.92, 'prostate-d50': 7.00, 'rectum-d05': 4.20, 'rectum-v29': 3.15, 'vessie-d05': 5.15, 'uretre-d10': 5.00, 'tf-g-d2': 2.06, 'tf-d-d2': 2.16 },
    doseSCT: { 'ptv-d95': 6.90, 'prostate-d50': 7.00, 'rectum-d05': 4.30, 'rectum-v29': 3.10, 'vessie-d05': 5.20, 'uretre-d10': 5.00, 'tf-g-d2': 2.05, 'tf-d-d2': 2.15 },
    commentaire: 'Séance du jour',
  },
  {
    numero: 5,
    date: '2026-09-09',
    voie: null,
    qualite: { artefacts: 1, rsb: 23.0, distorsion: 1.4 },
    deformation: { jacobienMax: 1.35, deplacementMax: 4.8, volumeRectum: 8 },
    decalages: [1.5, -1.0, 2.4],
    doseIRM: { 'ptv-d95': 6.97, 'prostate-d50': 7.00, 'rectum-d05': 4.15, 'rectum-v29': 3.05, 'vessie-d05': 5.05, 'uretre-d10': 5.05, 'tf-g-d2': 2.06, 'tf-d-d2': 2.16 },
    doseSCT: { 'ptv-d95': 6.95, 'prostate-d50': 7.00, 'rectum-d05': 4.20, 'rectum-v29': 3.00, 'vessie-d05': 5.10, 'uretre-d10': 5.05, 'tf-g-d2': 2.05, 'tf-d-d2': 2.15 },
    commentaire: 'Dernière séance',
  },
]

export const mesuresSeance = (numero: number): MesuresSeance | undefined =>
  mesuresSeances.find(s => s.numero === numero)

// ─── Listes de motifs (traçabilité) ──────────────────────────────────────────

export const motifsDeviation = [
  'Anatomie du jour apparemment favorable — ATP jugé suffisant',
  'Remplissage vésical ou rectal très différent de la séance précédente',
  'Contrainte de temps (créneau court disponible)',
  'Erreur supposée dans la recommandation automatique',
  'Autre (préciser ci-dessous)',
]

export const criteresComparaisonDose = [
  { id: 'dvh', label: 'Écarts sur points DVH cliniques', sub: 'Comparaison point par point des métriques du plan' },
  { id: 'gamma', label: 'Indice gamma', sub: 'Critère 3 % / 3 mm sur la distribution' },
] as const

export type CritereComparaison = (typeof criteresComparaisonDose)[number]['id']
