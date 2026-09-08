import { ReactNode } from 'react'
import { dossier, formatNombre } from '../data'
import { fmtSigne, type Confiance, type LigneCumul, type Niveau } from '../logic'

// ─── Status badges ───────────────────────────────────────────────────────────

type StatusLevel = Niveau

const statusStyles: Record<StatusLevel, string> = {
  ok: 'bg-ok-bg text-ok-text border border-ok-border',
  warn: 'bg-warn-bg text-warn-text border border-warn-border',
  danger: 'bg-danger-bg text-danger-text border border-danger-border',
  neutral: 'bg-slate-100 text-slate-600 border border-slate-200',
}

export function StatusBadge({ level, children }: { level: StatusLevel; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold ${statusStyles[level]}`}>
      {children}
    </span>
  )
}

// ─── Delta chip ───────────────────────────────────────────────────────────────

export function DeltaChip({
  actual,
  forecast,
  unit,
  invertedOk = false,
}: {
  actual: number
  forecast: number
  unit: string
  invertedOk?: boolean
}) {
  const delta = actual - forecast
  const absDelta = Math.abs(delta)
  const isOver = delta > 0
  const level: StatusLevel = absDelta < 0.5
    ? 'ok'
    : (isOver === !invertedOk ? 'warn' : 'ok')

  return (
    <span className={`font-mono text-xs px-1.5 py-0.5 rounded-sm ${statusStyles[level]}`}>
      {delta > 0 ? '+' : ''}{delta.toFixed(1)} {unit}
    </span>
  )
}

// ─── Section title ────────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
      {children}
    </h2>
  )
}

/** Même titre, sans marge basse — pour un en-tête sur une seule ligne. */
export function SectionTitleRow({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
      {children}
    </h2>
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-sm ${className}`}>
      {children}
    </div>
  )
}

// ─── DVH placeholder (existing component mock) ────────────────────────────────

export function DVHPlaceholder({ height = 180, title = 'DVH — Histogramme Dose-Volume' }: { height?: number; title?: string }) {
  return (
    <div className="relative bg-slate-950 rounded-sm overflow-hidden" style={{ height }}>
      <svg viewBox="0 0 400 200" className="w-full h-full" preserveAspectRatio="none">
        {/* grid lines */}
        {[0, 100, 200, 300, 400].map(x => (
          <line key={x} x1={x} y1="0" x2={x} y2="200" stroke="#1e293b" strokeWidth="1" />
        ))}
        {[0, 50, 100, 150, 200].map(y => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#1e293b" strokeWidth="1" />
        ))}
        {/* PTV — steep prescriptive drop */}
        <polyline
          points="0,6 190,6 220,18 260,130 290,178 400,192"
          fill="none" stroke="#4ade80" strokeWidth="1.8"
        />
        {/* Prostate */}
        <polyline
          points="0,8 180,8 215,22 255,100 285,160 400,188"
          fill="none" stroke="#86efac" strokeWidth="1.2" strokeDasharray="6,2"
        />
        {/* Rectum — drifting high */}
        <polyline
          points="0,22 110,24 170,52 230,110 290,158 400,190"
          fill="none" stroke="#fb923c" strokeWidth="1.8"
        />
        {/* Vessie — under forecast */}
        <polyline
          points="0,38 95,40 155,75 220,130 295,170 400,192"
          fill="none" stroke="#60a5fa" strokeWidth="1.8"
        />
        {/* Urètre */}
        <polyline
          points="0,10 155,10 200,35 248,105 400,192"
          fill="none" stroke="#c084fc" strokeWidth="1.4" strokeDasharray="3,2"
        />
        {/* Axes labels */}
        <text x="4" y="196" fill="#475569" fontSize="10">0</text>
        <text x="182" y="196" fill="#475569" fontSize="10">36 Gy</text>
        <text x="4" y="12" fill="#475569" fontSize="10">100%</text>
      </svg>
      <div className="absolute top-1.5 left-2 text-xs text-slate-400 font-mono">{title}</div>
      <div className="absolute bottom-1.5 right-2 text-xs text-slate-600 italic">composant existant</div>
      <div className="absolute top-1.5 right-2 flex flex-col gap-0.5 items-end">
        <span className="text-xs text-green-400 font-mono">— PTV</span>
        <span className="text-xs text-orange-400 font-mono">— Rectum</span>
        <span className="text-xs text-blue-400 font-mono">— Vessie</span>
        <span className="text-xs text-purple-400 font-mono">-- Urètre</span>
      </div>
    </div>
  )
}

// ─── MRI / dose axial placeholder ────────────────────────────────────────────

export function ImagePlaceholder({
  height = 180,
  label = 'Vue axiale — Isodoses',
  showDeformation = false,
}: {
  height?: number
  label?: string
  showDeformation?: boolean
}) {
  return (
    <div className="relative bg-slate-900 rounded-sm overflow-hidden" style={{ height }}>
      <svg viewBox="0 0 300 200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Body cross-section */}
        <ellipse cx="150" cy="105" rx="118" ry="78" fill="#0f172a" stroke="#334155" strokeWidth="1" />
        {/* Vertebra hint */}
        <ellipse cx="150" cy="52" rx="12" ry="9" fill="#1e293b" stroke="#475569" strokeWidth="0.8" />
        {/* Bladder */}
        <ellipse cx="150" cy="72" rx="28" ry="18" fill="#164e63" stroke="#0891b2" strokeWidth="0.8" opacity="0.85" />
        {/* Prostate */}
        <ellipse cx="150" cy="108" rx="22" ry="16" fill="#1d3a8a" stroke="#3b82f6" strokeWidth="0.8" opacity="0.9" />
        {/* Rectum */}
        {showDeformation ? (
          <ellipse cx="152" cy="138" rx="20" ry="14" fill="#3b0764" stroke="#a855f7" strokeWidth="0.8" opacity="0.85" />
        ) : (
          <ellipse cx="150" cy="136" rx="14" ry="10" fill="#3b0764" stroke="#a855f7" strokeWidth="0.8" opacity="0.85" />
        )}
        {/* Isodose 95% */}
        <ellipse cx="150" cy="108" rx="44" ry="34" fill="none" stroke="#dc2626" strokeWidth="1.2" opacity="0.85" />
        {/* Isodose 80% */}
        <ellipse cx="150" cy="106" rx="60" ry="46" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.7" />
        {/* Isodose 50% */}
        <ellipse cx="150" cy="104" rx="78" ry="60" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.55" />
        {/* Isodose 30% */}
        <ellipse cx="150" cy="102" rx="96" ry="72" fill="none" stroke="#3b82f6" strokeWidth="0.8" opacity="0.4" />
      </svg>
      <div className="absolute top-1.5 left-2 text-xs text-slate-400 font-mono">{label}</div>
      <div className="absolute bottom-1.5 right-2 text-xs text-slate-600 italic">composant existant</div>
      <div className="absolute bottom-1.5 left-2 flex gap-2 text-xs font-mono">
        <span className="text-red-400">— 95%</span>
        <span className="text-amber-400">— 80%</span>
        <span className="text-green-400">— 50%</span>
      </div>
    </div>
  )
}

// ─── Confidence indicator ─────────────────────────────────────────────────────

export function ConfianceIndicator({
  niveau,
  motifs = [],
}: {
  niveau: Confiance
  motifs?: string[]
}) {
  const map = {
    haute: { label: 'Confiance haute', color: 'text-ok', dots: 3, dot: 'bg-ok' },
    moyenne: { label: 'Confiance moyenne', color: 'text-warn', dots: 2, dot: 'bg-warn' },
    faible: { label: 'Confiance faible', color: 'text-danger', dots: 1, dot: 'bg-danger' },
  }
  const { label, color, dots, dot } = map[niveau]
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}
      title={motifs.length > 0 ? motifs.join('\n') : undefined}
    >
      <span className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span key={i} className={`w-2 h-2 rounded-full ${i < dots ? dot : 'bg-slate-200'}`} />
        ))}
      </span>
      {label}
      {motifs.length > 0 && <span className="text-slate-300 cursor-help">ⓘ</span>}
    </span>
  )
}

// ─── Cumul vs prévisionnel ────────────────────────────────────────────────────

/**
 * §10 du brief : une valeur cumulée ne s'affiche jamais seule, toujours à côté
 * de ce qui était prévu au même stade.
 */
export function ValeurVsPrevu({
  cumul,
  prevu,
  unite,
  niveau,
  dec = 1,
}: {
  cumul: number
  prevu: number
  unite: string
  niveau: Niveau
  dec?: number
}) {
  const couleur = niveau === 'danger' ? 'text-danger' : niveau === 'warn' ? 'text-warn' : niveau === 'ok' ? 'text-ok' : 'text-slate-700'
  return (
    <span className="font-mono whitespace-nowrap">
      <span className={`font-semibold ${couleur}`}>{formatNombre(cumul, dec)}</span>
      <span className="text-slate-400"> / {formatNombre(prevu, dec)} {unite}</span>
    </span>
  )
}

// ─── Mention permanente « dose reconstruite » ────────────────────────────────

/** §7 du brief : la limite doit être visible en permanence, jamais masquée. */
export function DoseReconstruiteNote({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-slate-400 cursor-help ${className}`}
      title={
        "Dose reconstruite, et non dose délivrée : elle est calculée à partir du plan du jour "
        + "recalculé sur l'anatomie du jour, sans les effets des mouvements pendant la séance. "
        + "L'imagerie ciné 2D, le critère VOICE et les décalages temps réel restent dans "
        + 'un espace propriétaire de la machine et ne sont pas exportés.'
      }
    >
      Dose reconstruite ⓘ
    </span>
  )
}

// ─── Trajectoire du cumul, séance après séance ───────────────────────────────

/**
 * Trace le cumul réel contre le prévisionnel pour une structure.
 * Entièrement dérivé de la trajectoire calculée — aucune courbe dessinée à la main.
 */
export function TrajectoireCumul({
  ligne,
  height = 130,
  nbSeances = dossier.nbSeances,
}: {
  ligne: LigneCumul
  height?: number
  nbSeances?: number
}) {
  const W = 500
  const H = 100
  const padY = 8

  const prevuFin = ligne.structure.prevuParSeance * nbSeances
  const yMax = Math.max(prevuFin, ...ligne.trajectoire.map(t => t.cumul)) * 1.08 || 1
  const x = (seance: number) => ((seance - 1) / Math.max(nbSeances - 1, 1)) * W
  const y = (valeur: number) => H - padY - (valeur / yMax) * (H - padY * 2)

  const pointsPrevu = Array.from({ length: nbSeances }, (_, i) => {
    const n = i + 1
    return `${x(n)},${y(ligne.structure.prevuParSeance * n)}`
  }).join(' ')

  const pointsReel = ligne.trajectoire.map(t => `${x(t.seance)},${y(t.cumul)}`).join(' ')
  const derive = ligne.ecart > 0

  return (
    <div className="relative bg-slate-50 rounded-sm border border-slate-100 overflow-hidden" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
        {Array.from({ length: nbSeances }, (_, i) => (
          <line key={i} x1={x(i + 1)} y1="0" x2={x(i + 1)} y2={H} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        <polyline points={pointsPrevu} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6,3" />
        {ligne.trajectoire.length > 1 && (
          <polyline
            points={pointsReel}
            fill="none"
            stroke={derive ? '#dc2626' : '#16a34a'}
            strokeWidth="2"
          />
        )}
        {ligne.trajectoire.map(t => (
          <circle key={t.seance} cx={x(t.seance)} cy={y(t.cumul)} r="3.5" fill={derive ? '#dc2626' : '#16a34a'} />
        ))}
        {Array.from({ length: nbSeances }, (_, i) => (
          <circle key={i} cx={x(i + 1)} cy={y(ligne.structure.prevuParSeance * (i + 1))} r="2.5" fill="#94a3b8" />
        ))}
      </svg>
      <div className="absolute top-1.5 left-3 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className={`w-5 h-0.5 inline-block ${derive ? 'bg-danger' : 'bg-ok'}`} />
          <span className="text-slate-600">Cumul reconstruit</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t border-dashed border-slate-400 inline-block" />
          <span className="text-slate-600">Prévisionnel</span>
        </span>
      </div>
      <div className="absolute top-1.5 right-3 text-xs font-mono text-slate-500">
        {fmtSigne(ligne.ecart, 1)} {ligne.structure.unite}
      </div>
      <div className="absolute bottom-1 left-0 right-0 flex justify-between text-xs text-slate-400 font-mono px-2">
        {Array.from({ length: nbSeances }, (_, i) => <span key={i}>S{i + 1}</span>)}
      </div>
    </div>
  )
}
