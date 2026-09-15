/* ─────────────────────────────────────────────────────────────────────────────
 * Identité de la version affichée
 *
 * Les valeurs sont injectées au build par `vite.config.ts` : numéro de version
 * du `package.json`, commit, date. Un relecteur qui signale un comportement
 * peut ainsi dire exactement sur quelle version il l'a observé, et on retrouve
 * le code correspondant.
 * ──────────────────────────────────────────────────────────────────────────── */

declare const __VERSION__: string
declare const __COMMIT__: string
declare const __BUILD_MODIFIE__: boolean
declare const __BUILD_DATE__: string

export const version = {
  numero: __VERSION__,
  commit: __COMMIT__,
  /** Le build vient d'un dépôt modifié : il ne correspond pas exactement au commit. */
  modifie: __BUILD_MODIFIE__,
  date: __BUILD_DATE__,
}

/** « v3.0.0 · 5bfa8bd » — ou « v3.0.0 · 5bfa8bd+ » si le dépôt était modifié. */
export const versionCourte = (): string =>
  `v${version.numero} · ${version.commit}${version.modifie ? '+' : ''}`

/** Détail complet, pour une infobulle. */
export const versionDetaillee = (): string => {
  const d = new Date(version.date)
  const quand = isNaN(d.getTime())
    ? version.date
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `Maquette DIMADOSE v${version.numero}\n`
    + `Commit ${version.commit}${version.modifie ? ' (dépôt modifié au moment du build)' : ''}\n`
    + `Construite le ${quand}`
}
