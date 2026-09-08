/* ─────────────────────────────────────────────────────────────────────────────
 * DIMADOSE — Enregistrement local du dossier
 *
 * Les décisions humaines survivent au rechargement de la page : reprendre une
 * revue là où on l'a laissée fait partie du produit, et un journal qui
 * disparaîtrait au premier F5 ne serait pas une trace.
 *
 * Le stockage est celui du navigateur : privé au poste, jamais transmis. Il
 * peut être indisponible (navigation privée, site bloqué) — chaque accès est
 * donc protégé et l'application reste utilisable sans lui.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { CritereComparaison } from './data'
import type { Decisions, EntreeTrace } from './logic'

const PREFIXE = 'dimadose:dossier'
const VERSION = 1

export interface EtatPersiste {
  version: number
  dossierId: string
  seanceCourante: number
  decisions: Decisions
  contraintesEditees: Record<number, Record<string, number>>
  critere: CritereComparaison
  irmref: string
  trace: EntreeTrace[]
  enregistreLe: string
}

const cle = (dossierId: string) => `${PREFIXE}:v${VERSION}:${dossierId}`

/** `false` quand le navigateur refuse le stockage — l'outil fonctionne quand même. */
export function stockageDisponible(): boolean {
  try {
    const sonde = `${PREFIXE}:sonde`
    window.localStorage.setItem(sonde, '1')
    window.localStorage.removeItem(sonde)
    return true
  } catch {
    return false
  }
}

export function charger(dossierId: string): EtatPersiste | null {
  try {
    const brut = window.localStorage.getItem(cle(dossierId))
    if (!brut) return null
    const etat = JSON.parse(brut) as EtatPersiste
    // Un état d'une autre version ou d'un autre dossier est ignoré, jamais migré
    // au petit bonheur : mieux vaut repartir du scénario de référence.
    if (etat.version !== VERSION || etat.dossierId !== dossierId) return null
    if (typeof etat.decisions !== 'object' || etat.decisions === null) return null
    return { ...etat, trace: Array.isArray(etat.trace) ? etat.trace : [] }
  } catch {
    return null
  }
}

export function sauvegarder(etat: Omit<EtatPersiste, 'version' | 'enregistreLe'>): string | null {
  const enregistreLe = new Date().toISOString()
  try {
    window.localStorage.setItem(
      cle(etat.dossierId),
      JSON.stringify({ ...etat, version: VERSION, enregistreLe }),
    )
    return enregistreLe
  } catch {
    return null
  }
}

export function effacer(dossierId: string): void {
  try {
    window.localStorage.removeItem(cle(dossierId))
  } catch {
    /* rien à faire : le stockage est indisponible, l'état vivait déjà en mémoire */
  }
}

// ─── Liste des patients ──────────────────────────────────────────────────────

const CLE_PATIENTS = `${PREFIXE}:v${VERSION}:patients`

/**
 * La liste des patients est enregistrée à part : ajouter ou retirer un dossier
 * doit tenir au rechargement, sinon la suppression n'en est pas une.
 * Le type est fourni par l'appelant pour ne pas faire dépendre ce module des
 * écrans.
 */
export function chargerListePatients<T>(): T[] | null {
  try {
    const brut = window.localStorage.getItem(CLE_PATIENTS)
    if (!brut) return null
    const liste = JSON.parse(brut) as unknown
    return Array.isArray(liste) ? (liste as T[]) : null
  } catch {
    return null
  }
}

export function sauvegarderListePatients(patients: unknown[]): void {
  try {
    window.localStorage.setItem(CLE_PATIENTS, JSON.stringify(patients))
  } catch {
    /* stockage indisponible : la liste ne vit que le temps de la session */
  }
}

export function effacerListePatients(): void {
  try {
    window.localStorage.removeItem(CLE_PATIENTS)
  } catch {
    /* idem */
  }
}

// ─── Annuaire des comptes ────────────────────────────────────────────────────

const CLE_COMPTES = `${PREFIXE}:v${VERSION}:comptes`

/**
 * Les comptes créés depuis l'écran de connexion doivent survivre au
 * rechargement, sinon la personne ne peut plus se reconnecter.
 * Aucun mot de passe n'est enregistré : l'authentification relève du socle
 * multi-utilisateurs existant.
 */
export function chargerComptes<T>(): T[] | null {
  try {
    const brut = window.localStorage.getItem(CLE_COMPTES)
    if (!brut) return null
    const liste = JSON.parse(brut) as unknown
    return Array.isArray(liste) && liste.length > 0 ? (liste as T[]) : null
  } catch {
    return null
  }
}

export function sauvegarderComptes(comptes: unknown[]): void {
  try {
    window.localStorage.setItem(CLE_COMPTES, JSON.stringify(comptes))
  } catch {
    /* stockage indisponible : l'annuaire ne vit que le temps de la session */
  }
}
