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

const git = (commande) =>
  execSync(`git ${commande}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()

/**
 * Comment nommer ce fichier, et faut-il prévenir ?
 *
 * Seul un build pris sur une version étiquetée porte le nom nu de la version.
 * Tout le reste est un essai, et doit se distinguer — sinon un fichier produit
 * en cours de travail écrase celui de la version réellement livrée, sous le
 * même nom, sans rien dire.
 *
 * Deux façons de ne pas être une version livrée :
 *  — le dépôt est modifié : le fichier ne correspond à aucun commit ;
 *  — le dépôt est propre mais HEAD ne porte pas d'étiquette : le code est
 *    commité, il n'est pas livré. Le commit suffit alors à le désigner.
 */
function nature(version) {
  let modifie = false
  try {
    modifie = git('status --porcelain').length > 0
  } catch {
    return { suffixe: '', avertissement: '' } // Pas de git : rien à affirmer.
  }

  if (modifie) {
    return {
      suffixe: '-modifie',
      avertissement: 'Dépôt modifié : ce fichier ne correspond à aucun commit.\n'
        + '  Bon pour un essai, pas pour une relecture — un retour ne pourrait pas\n'
        + '  être rattaché à du code. Pour livrer : commitez, puis « npm version ».',
    }
  }

  try {
    git(`describe --exact-match --tags HEAD`)
    return { suffixe: '', avertissement: '' } // Version étiquetée : c'est une livraison.
  } catch {
    const commit = git('rev-parse --short=7 HEAD')
    return {
      suffixe: `-${commit}`,
      avertissement: `Aucune étiquette sur ce commit : v${version} n'est pas livrée ici.\n`
        + `  Le fichier porte le commit (${commit}) pour ne pas écraser celui de la\n`
        + `  version livrée. Pour livrer : « npm version » sur main.`,
    }
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
const { suffixe, avertissement } = nature(version)
const sortie = `DIMADOSE-maquette-v${version}${suffixe}.html`
writeFileSync(sortie, html, 'utf8')

const ko = Math.round(statSync(sortie).size / 1024)
console.log(`${sortie} — ${ko} ko, autonome, s'ouvre hors ligne.`)
if (avertissement) console.warn(`\n  ${avertissement}\n`)
