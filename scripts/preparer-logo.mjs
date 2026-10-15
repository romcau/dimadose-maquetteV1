/* ─────────────────────────────────────────────────────────────────────────────
 * Prépare le logo fourni pour l'interface.
 *
 * Le fichier d'origine est un PNG opaque sur fond gris clair. Ce gris occupe
 * aussi les interstices du viseur : posé tel quel sur la barre latérale bleu
 * nuit, le logo apparaîtrait dans un rectangle gris, viseur bouché.
 *
 * On le rend donc transparent — pas par un seuil brutal, qui laisserait un
 * liseré gris sur chaque contour, mais en estimant l'opacité de chaque pixel
 * d'après sa distance au fond, puis en retrouvant sa couleur d'origine
 * (démultiplication). Les bords restent nets.
 *
 * Il en sort le symbole seul, recadré et réduit : c'est ce qu'affichent les
 * en-têtes, où la hauteur ne permet pas d'empiler symbole et wordmark. Le
 * fichier d'origine reste dans `src/assets/`, inchangé.
 *
 *   node scripts/preparer-logo.mjs
 * ──────────────────────────────────────────────────────────────────────────── */

import { lirePng, ecrirePng } from './png.mjs'

const SOURCE = 'src/assets/logo-dimadose.png'
const SORTIE_SYMBOLE = 'src/assets/logo-dimadose-symbole.png'

/**
 * Le fond n'est pas d'un gris parfaitement uniforme — il varie de quelques
 * unités d'un coin à l'autre. En deçà de ce plancher, l'écart au fond est du
 * bruit, pas du dessin : le pixel disparaît.
 */
const PLANCHER = 16

/** Au-delà de cette distance au fond, le pixel est entièrement opaque. */
const SEUIL = 48

const image = lirePng(SOURCE)
const { largeur, hauteur, pixels } = image

/** Couleur du fond, prise à la moyenne des quatre coins. */
const coins = [[2, 2], [largeur - 3, 2], [2, hauteur - 3], [largeur - 3, hauteur - 3]]
const fond = [0, 1, 2].map(c =>
  Math.round(coins.reduce((s, [x, y]) => s + pixels[(y * largeur + x) * 4 + c], 0) / coins.length),
)

const sortie = Buffer.alloc(pixels.length)

for (let i = 0; i < largeur * hauteur; i++) {
  const r = pixels[i * 4], v = pixels[i * 4 + 1], b = pixels[i * 4 + 2]
  const distance = Math.hypot(r - fond[0], v - fond[1], b - fond[2])
  const alpha = Math.max(0, Math.min(1, (distance - PLANCHER) / (SEUIL - PLANCHER)))

  if (alpha <= 0.004) {
    sortie[i * 4] = 0; sortie[i * 4 + 1] = 0; sortie[i * 4 + 2] = 0; sortie[i * 4 + 3] = 0
    continue
  }
  // P = alpha·F + (1-alpha)·Fond  →  F = Fond + (P - Fond) / alpha
  const borne = (x) => Math.max(0, Math.min(255, Math.round(x)))
  sortie[i * 4]     = borne(fond[0] + (r - fond[0]) / alpha)
  sortie[i * 4 + 1] = borne(fond[1] + (v - fond[1]) / alpha)
  sortie[i * 4 + 2] = borne(fond[2] + (b - fond[2]) / alpha)
  sortie[i * 4 + 3] = Math.round(alpha * 255)
}

/** Recadre une zone, en écartant les marges entièrement transparentes. */
function recadrer(px, x0, y0, x1, y1) {
  const l = x1 - x0, h = y1 - y0
  const dst = Buffer.alloc(l * h * 4)
  for (let y = 0; y < h; y++) {
    px.copy(dst, y * l * 4, ((y0 + y) * largeur + x0) * 4, ((y0 + y) * largeur + x1) * 4)
  }
  return { largeur: l, hauteur: h, pixels: dst }
}

/** Bornes de ce qui n'est pas transparent, sur une bande de lignes. */
function bornes(px, yDebut, yFin) {
  let xMin = largeur, xMax = 0, yMin = yFin, yMax = 0
  for (let y = yDebut; y < yFin; y++) {
    for (let x = 0; x < largeur; x++) {
      if (px[(y * largeur + x) * 4 + 3] > 12) {
        if (x < xMin) xMin = x
        if (x > xMax) xMax = x
        if (y < yMin) yMin = y
        if (y > yMax) yMax = y
      }
    }
  }
  return { xMin, xMax, yMin, yMax }
}

// Le symbole occupe les trois quarts supérieurs ; le wordmark suit en dessous.
// On cherche la ligne vide qui les sépare plutôt que de couper à l'aveugle.
let separation = Math.round(hauteur * 0.72)
for (let y = Math.round(hauteur * 0.66); y < Math.round(hauteur * 0.84); y++) {
  let vide = true
  for (let x = 0; x < largeur && vide; x++) if (sortie[(y * largeur + x) * 4 + 3] > 12) vide = false
  if (vide) { separation = y; break }
}

const b = bornes(sortie, 0, separation)
const marge = 4
const symbole = recadrer(
  sortie,
  Math.max(0, b.xMin - marge), Math.max(0, b.yMin - marge),
  Math.min(largeur, b.xMax + 1 + marge), Math.min(hauteur, b.yMax + 1 + marge),
)
/**
 * Réduit par moyenne de blocs.
 *
 * Le symbole s'affiche entre 24 et 56 pixels ; le conserver en 589 carré
 * coûtait 368 ko dans le build, et autant en base64 dans le fichier de
 * relecture. 256 carré couvre le double de la plus grande taille utilisée,
 * ce qui suffit aux écrans à forte densité.
 */
function reduire({ largeur: L, hauteur: H, pixels: src }, cible) {
  const l = cible, h = Math.round((H / L) * cible)
  const dst = Buffer.alloc(l * h * 4)
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * H / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * H / h))
    for (let x = 0; x < l; x++) {
      const x0 = Math.floor(x * L / l), x1 = Math.max(x0 + 1, Math.floor((x + 1) * L / l))
      let r = 0, v = 0, b = 0, a = 0, n = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * L + sx) * 4, al = src[i + 3] / 255
          // Moyenne pondérée par l'opacité : sinon les pixels transparents,
          // de couleur nulle, assombriraient les bords.
          r += src[i] * al; v += src[i + 1] * al; b += src[i + 2] * al
          a += src[i + 3]; n++
        }
      }
      const opacite = a / n
      const poids = opacite / 255 * n || 1
      const j = (y * l + x) * 4
      dst[j] = Math.round(r / poids)
      dst[j + 1] = Math.round(v / poids)
      dst[j + 2] = Math.round(b / poids)
      dst[j + 3] = Math.round(opacite)
    }
  }
  return { largeur: l, hauteur: h, pixels: dst }
}

const symboleReduit = reduire(symbole, 256)
ecrirePng(SORTIE_SYMBOLE, symboleReduit)

console.log(`Fond détecté : rgb(${fond.join(', ')})`)
console.log(`${SORTIE_SYMBOLE} — ${symboleReduit.largeur}×${symboleReduit.hauteur}`
  + ` (recadré de ${symbole.largeur}×${symbole.hauteur}, séparation à y=${separation})`)
