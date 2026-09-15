/* ─────────────────────────────────────────────────────────────────────────────
 * Replie dist/ en un seul fichier .html, à envoyer pour relecture.
 *
 * Le dépôt est privé et le reste : il n'y a pas de publication en ligne. Pour
 * faire relire la maquette, on produit un fichier unique qui s'ouvre hors
 * ligne, sans serveur, et qui ne fait sortir la maquette d'aucun réseau
 * interne. Son nom porte la version, pour qu'un retour de relecture désigne
 * sans ambiguïté ce qui a été regardé.
 *
 *   pnpm run build && pnpm run fichier-unique
 * ──────────────────────────────────────────────────────────────────────────── */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

/**
 * Le dépôt porte-t-il des modifications non commitées ?
 *
 * Un fichier produit depuis un dépôt modifié ne correspond à aucun commit : on
 * ne peut pas retrouver le code qu'un relecteur a eu sous les yeux. Ce n'est pas
 * une erreur — c'est normal pour un essai en cours de travail — mais un tel
 * fichier ne doit pas pouvoir se faire passer pour une version livrée, ni
 * écraser celle qui porte le même numéro.
 */
function depotModifie() {
  try {
    return execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim().length > 0
  } catch {
    return false // Pas de git : rien à affirmer, on ne bloque pas.
  }
}

const DIST = 'dist'
const actifs = readdirSync(join(DIST, 'assets'))
const unSeul = (ext) => {
  const trouves = actifs.filter((f) => f.endsWith(ext))
  if (trouves.length !== 1) {
    throw new Error(`dist/assets attendait un seul fichier ${ext}, il y en a ${trouves.length}. `
      + `Le repliage ne sait pas traiter un build découpé en plusieurs morceaux.`)
  }
  return readFileSync(join(DIST, 'assets', trouves[0]), 'utf8')
}

let html = readFileSync(join(DIST, 'index.html'), 'utf8')
const css = unSeul('.css')
const js = unSeul('.js')

// Un « </script> » à l'intérieur du code fermerait la balise qui le contient.
const js_inline = js.replaceAll('</script>', '<\\/script>')

html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`)
html = html.replace(/<script[^>]*src="[^"]*\.js"[^>]*><\/script>/, () => `<script type="module">\n${js_inline}\n</script>`)

if (/(?:src|href)="[^"]*assets\//.test(html)) {
  throw new Error('Le fichier référence encore dist/assets : il ne tiendrait pas seul.')
}

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const modifie = depotModifie()
const sortie = `DIMADOSE-maquette-v${version}${modifie ? '-modifie' : ''}.html`
writeFileSync(sortie, html, 'utf8')

const ko = Math.round(statSync(sortie).size / 1024)
console.log(`${sortie} — ${ko} ko, autonome, s'ouvre hors ligne.`)
if (modifie) {
  console.warn(
    `\n  Dépôt modifié : ce fichier ne correspond à aucun commit.\n`
    + `  Bon pour un essai, pas pour une relecture — un retour ne pourrait pas être\n`
    + `  rattaché à du code. Pour livrer une version : commitez, puis « npm version ».\n`,
  )
}
