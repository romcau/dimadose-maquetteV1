/* ─────────────────────────────────────────────────────────────────────────────
 * DIMADOSE — Contexte du dossier
 *
 * Isolé dans son propre module, sans aucune dépendance d'exécution : le
 * rechargement à chaud d'un écran ou des données ne recrée donc pas l'objet
 * de contexte, ce qui casserait le lien entre le provider et ses consommateurs.
 * ──────────────────────────────────────────────────────────────────────────── */

import { createContext, useContext } from 'react'
import type { CritereComparaison, Role, Voie } from './data'
import type {
  AlerteDossier,
  CandidateDose,
  CategorieTrace,
  Cumul,
  Decisions,
  Droits,
  EntreeTrace,
  ModeCumul,
  PropositionContrainte,
  Rapport,
  Recommandation,
  SeanceEvaluee,
  VerdictDeformation,
  VerdictQualite,
} from './logic'

export interface Utilisateur {
  nom: string
  role: Role
}

/** Ce qu'une action à tracer fournit ; le reste est ajouté par le store. */
export interface ActionTracee {
  categorie: CategorieTrace
  seance: number | null
  libelle: string
  detail?: string
  ecart?: boolean
}

export interface DossierContexte {
  // ── État brut ──
  dossierId: string
  utilisateur: Utilisateur
  droits: Droits
  seanceCourante: number
  decisions: Decisions
  critere: CritereComparaison
  irmref: string
  /** Valeurs de contraintes éditées à la main, par séance puis par structure. */
  contraintesEditees: Record<number, Record<string, number>>
  /** Journal des actions humaines, en ajout seul, du plus récent au plus ancien. */
  trace: EntreeTrace[]

  // ── Valeurs dérivées ──
  seances: SeanceEvaluee[]
  seance: (numero: number) => SeanceEvaluee
  /** Cumul des séances 1 → N-1, base de la décision du jour. */
  cumul: Cumul
  cumulJusqua: (numero: number) => Cumul
  recommandation: Recommandation
  propositions: PropositionContrainte[]
  /** Valeur retenue pour une contrainte (édition manuelle ou proposition). */
  valeurContrainte: (structureId: string) => number
  contraintesModifiees: boolean
  rapport: Rapport
  irmrefLabel: string
  alertes: AlerteDossier[]

  // ── Enregistrement ──
  /** `false` quand le navigateur refuse le stockage : l'état ne vit qu'en mémoire. */
  stockagePersistant: boolean
  enregistreLe: string | null
  reinitialiser: () => void

  // ── Actions ──
  tracer: (action: ActionTracee) => void
  setSeanceCourante: (n: number) => void
  reviserQualite: (numero: number, v: VerdictQualite | undefined) => void
  reviserDeformation: (numero: number, v: VerdictDeformation | undefined) => void
  choisirModeCumul: (numero: number, m: ModeCumul) => void
  choisirDose: (numero: number, d: CandidateDose) => void
  validerSeance: (numero: number) => void
  devaliderSeance: (numero: number) => void
  demanderReacquisition: (numero: number, demandee: boolean) => void
  enregistrerVoie: (numero: number, voie: Voie, motifs?: string[], texte?: string) => void
  annulerVoie: (numero: number) => void
  setCritere: (c: CritereComparaison) => void
  setIrmref: (id: string) => void
  editerContrainte: (structureId: string, valeur: number) => void
  reinitialiserContrainte: (structureId: string) => void
  reinitialiserContraintes: () => void
}

export const Contexte = createContext<DossierContexte | null>(null)

export function useDossier(): DossierContexte {
  const ctx = useContext(Contexte)
  if (!ctx) throw new Error('useDossier doit être utilisé dans un <DossierProvider>')
  return ctx
}
