/* ─────────────────────────────────────────────────────────────────────────────
 * Lecture et écriture de PNG, sans dépendance.
 *
 * Juste ce qu'il faut pour préparer le logo : décoder les lignes filtrées,
 * réencoder sans filtre. Le projet n'a pas de bibliothèque d'images, et en
 * ajouter une pour deux fichiers ne se justifie pas.
 * ──────────────────────────────────────────────────────────────────────────── */

import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'

/** Décode un PNG 8 bits RGBA ou RGB en { largeur, hauteur, pixels } RGBA. */
export function lirePng(chemin) {
  const b = readFileSync(chemin)
  let o = 8, largeur = 0, hauteur = 0, typeCouleur = 0
  const morceaux = []

  while (o < b.length) {
    const taille = b.readUInt32BE(o)
    const type = b.toString('ascii', o + 4, o + 8)
    if (type === 'IHDR') {
      largeur = b.readUInt32BE(o + 8)
      hauteur = b.readUInt32BE(o + 12)
      if (b[o + 16] !== 8) throw new Error('Seuls les PNG 8 bits par canal sont lus.')
      typeCouleur = b[o + 17]
      if (b[o + 20] !== 0) throw new Error('Les PNG entrelacés ne sont pas lus.')
    }
    if (type === 'IDAT') morceaux.push(b.subarray(o + 8, o + 8 + taille))
    if (type === 'IEND') break
    o += 12 + taille
  }

  const canaux = { 2: 3, 6: 4 }[typeCouleur]
  if (!canaux) throw new Error(`Type de couleur ${typeCouleur} non pris en charge.`)

  const brut = inflateSync(Buffer.concat(morceaux))
  const pas = largeur * canaux
  const lignes = Buffer.alloc(hauteur * pas)
  let p = 0

  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[p++]
    for (let i = 0; i < pas; i++) {
      const x = brut[p + i]
      const a = i >= canaux ? lignes[y * pas + i - canaux] : 0
      const h = y > 0 ? lignes[(y - 1) * pas + i] : 0
      const d = (i >= canaux && y > 0) ? lignes[(y - 1) * pas + i - canaux] : 0
      let v
      switch (filtre) {
        case 0: v = x; break
        case 1: v = x + a; break
        case 2: v = x + h; break
        case 3: v = x + ((a + h) >> 1); break
        default: {
          const pa = Math.abs(h - d), pb = Math.abs(a - d), pc = Math.abs(a + h - 2 * d)
          v = x + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? h : d))
        }
      }
      lignes[y * pas + i] = v & 255
    }
    p += pas
  }

  // Toujours rendre du RGBA, pour n'avoir qu'un cas à traiter ensuite.
  const pixels = Buffer.alloc(largeur * hauteur * 4)
  for (let i = 0, j = 0; i < largeur * hauteur; i++) {
    pixels[i * 4] = lignes[j]
    pixels[i * 4 + 1] = lignes[j + 1]
    pixels[i * 4 + 2] = lignes[j + 2]
    pixels[i * 4 + 3] = canaux === 4 ? lignes[j + 3] : 255
    j += canaux
  }
  return { largeur, hauteur, pixels }
}

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

const crc = (buf) => {
  let c = -1
  for (const octet of buf) c = crcTable[(c ^ octet) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

const morceau = (type, donnees) => {
  const entete = Buffer.alloc(8)
  entete.writeUInt32BE(donnees.length, 0)
  entete.write(type, 4, 'ascii')
  const somme = Buffer.alloc(4)
  somme.writeUInt32BE(crc(Buffer.concat([Buffer.from(type, 'ascii'), donnees])), 0)
  return Buffer.concat([entete, donnees, somme])
}

/** Écrit un PNG 8 bits RGBA, sans filtre — la compression suffit ici. */
export function ecrirePng(chemin, { largeur, hauteur, pixels }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largeur, 0)
  ihdr.writeUInt32BE(hauteur, 4)
  ihdr[8] = 8    // bits par canal
  ihdr[9] = 6    // RGBA
  const pas = largeur * 4
  const lignes = Buffer.alloc(hauteur * (pas + 1))
  for (let y = 0; y < hauteur; y++) {
    lignes[y * (pas + 1)] = 0
    pixels.copy(lignes, y * (pas + 1) + 1, y * pas, (y + 1) * pas)
  }
  writeFileSync(chemin, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', ihdr),
    morceau('IDAT', deflateSync(lignes, { level: 9 })),
    morceau('IEND', Buffer.alloc(0)),
  ]))
}
