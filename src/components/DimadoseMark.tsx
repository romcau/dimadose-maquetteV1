/* ─────────────────────────────────────────────────────────────────────────────
 * Le symbole DIMADOSE : viseur, bassin, maillage.
 *
 * Le fichier de la marque, recadré sur le symbole seul et détouré de son fond
 * gris par `scripts/preparer-logo.mjs` — le gris occupait aussi les interstices
 * du viseur, qui doivent laisser voir ce qu'il y a derrière.
 *
 * Sur fond sombre, le bleu de la marque ne ressortirait pas : le symbole est
 * alors posé sur une pastille claire, traitement habituel d'un logo conçu pour
 * fond clair. Le recolorer serait le trahir.
 * ──────────────────────────────────────────────────────────────────────────── */

import symbole from '../assets/logo-dimadose-symbole.png'

interface Props {
  size?: number
  /** `dark` : sur fond clair. `light` : sur fond sombre. */
  variant?: 'dark' | 'light'
  className?: string
}

export default function DimadoseMark({ size = 40, variant = 'dark', className = '' }: Props) {
  const image = (
    <img
      src={symbole}
      alt=""
      width={size}
      height={size}
      className="block object-contain"
      style={{ width: size, height: size }}
    />
  )

  if (variant === 'light') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xl bg-white shrink-0 ${className}`}
        style={{ width: size, height: size, padding: Math.max(2, Math.round(size * 0.08)) }}
      >
        <img
          src={symbole}
          alt=""
          className="block object-contain w-full h-full"
        />
      </span>
    )
  }

  return <span className={`inline-flex shrink-0 ${className}`}>{image}</span>
}
