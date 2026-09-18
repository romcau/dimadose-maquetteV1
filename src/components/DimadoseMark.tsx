/* ─────────────────────────────────────────────────────────────────────────────
 * Le symbole DIMADOSE : viseur, bassin, maillage.
 *
 * ⚠ Reproduction vectorielle, pas le fichier d'origine. Le viseur — cercles et
 * croix — est géométrique et donc fidèle ; le bassin, les vertèbres et le
 * maillage sont redessinés d'après le logo et en approchent la forme sans
 * l'égaler. Dès que le SVG de la marque est déposé dans `src/assets/`, ce
 * composant se remplace par une balise <img> et disparaît.
 *
 * Il se décline sur fond clair et sur fond sombre : seuls le bleu du viseur et
 * le fond du disque changent, l'orange et le bleu clair restent ceux du logo.
 * ──────────────────────────────────────────────────────────────────────────── */

interface Props {
  size?: number
  /** `dark` : sur fond clair. `light` : sur fond sombre. */
  variant?: 'dark' | 'light'
  className?: string
}

/**
 * Sommets du maillage — le jumeau numérique de l'os, à droite du trait.
 * Forme allongée verticalement, qui répond à celle du bassin.
 */
const MAILLAGE: [number, number][] = [
  [236, 148], [266, 136], [290, 158], [282, 186],
  [252, 184], [268, 214], [296, 222], [292, 254],
  [262, 268], [238, 246], [248, 212],
]

const ARETES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [4, 5], [5, 3], [5, 6],
  [6, 7], [7, 8], [8, 9], [9, 10], [10, 5], [10, 4], [8, 5], [9, 5],
]

export default function DimadoseMark({ size = 40, variant = 'dark', className = '' }: Props) {
  const clair = variant === 'light'
  const bleu = clair ? 'rgba(255,255,255,0.95)' : 'var(--color-marque-bleu)'
  const disque = clair ? 'rgba(255,255,255,0.14)' : 'var(--color-marque-bleu)'
  const trait = clair ? 'rgba(255,255,255,0.95)' : '#ffffff'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="DIMADOSE"
    >
      <circle cx="200" cy="200" r="104" fill={disque} />

      {/* Hémibassin, à gauche du trait */}
      <g fill="#f7941e">
        {/* Aile iliaque, col et branches ischio-pubiennes autour du trou obturateur */}
        <path
          d="M158 130
             c24 -6 44 10 46 34
             c2 20 -6 36 -18 46
             c10 4 18 12 22 22
             c6 -2 12 0 16 6
             c6 10 2 24 -8 30
             c-4 3 -9 4 -14 3
             c-2 16 -14 28 -30 30
             c-18 2 -34 -10 -38 -28
             c-4 -18 6 -36 22 -42
             c-10 -10 -18 -24 -20 -40
             c-4 -28 6 -54 22 -61 z
             M150 236
             c-11 2 -18 13 -16 24
             c2 11 13 18 24 15
             c10 -3 16 -14 14 -24
             c-2 -10 -12 -17 -22 -15 z"
          fillRule="evenodd"
        />
        {/* Deux vertèbres, au-dessus du bassin */}
        <path d="M196 116 h44 a11 11 0 0 1 0 22 h-44 a11 11 0 0 1 0 -22 z
                 M210 106 h16 a8 8 0 0 1 0 16 h-16 a8 8 0 0 1 0 -16 z" />
        <path d="M196 156 h44 a11 11 0 0 1 0 22 h-44 a11 11 0 0 1 0 -22 z
                 M210 146 h16 a8 8 0 0 1 0 16 h-16 a8 8 0 0 1 0 -16 z" />
      </g>

      {/* Maillage déformable, à droite du trait */}
      <g stroke="#66c2e5" strokeWidth="2.6" strokeLinecap="round" fill="none">
        {ARETES.map(([a, b], i) => (
          <line
            key={i}
            x1={MAILLAGE[a][0]} y1={MAILLAGE[a][1]}
            x2={MAILLAGE[b][0]} y2={MAILLAGE[b][1]}
          />
        ))}
      </g>
      <g fill="#66c2e5">
        {MAILLAGE.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.4" />
        ))}
      </g>

      {/* Le trait qui sépare l'os de son jumeau numérique */}
      <line x1="272" y1="112" x2="188" y2="222" stroke={trait} strokeWidth="14" strokeLinecap="round" />

      {/* Viseur : deux anneaux et la croix */}
      <g stroke={bleu} fill="none">
        <circle cx="200" cy="200" r="150" strokeWidth="13" />
        <circle cx="200" cy="200" r="126" strokeWidth="13" />
      </g>
      <g stroke={bleu} strokeWidth="13">
        <line x1="200" y1="14" x2="200" y2="386" />
        <line x1="14" y1="200" x2="110" y2="200" />
        <line x1="290" y1="200" x2="386" y2="200" />
      </g>
    </svg>
  )
}
