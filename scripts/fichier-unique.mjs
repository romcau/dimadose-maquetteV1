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
const sortie = `DIMADOSE-maquette-v${version}.html`
writeFileSync(sortie, html, 'utf8')

const ko = Math.round(statSync(sortie).size / 1024)
console.log(`${sortie} — ${ko} ko, autonome, s'ouvre hors ligne.`)
