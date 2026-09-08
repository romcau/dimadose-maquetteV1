import { type PatientRecord } from './Dashboard'
import { formatDateCourte, objetsDicom, type ObjetDicom } from '../logic'
import { useDossier } from '../store'

interface Props {
  patient: PatientRecord
  onClose: () => void
}

type Etat = 'charge' | 'calcule' | 'non-exporte' | 'absent' | 'optionnel'

const etatStyle: Record<Etat, { label: string; cls: string; icon: string }> = {
  charge:        { label: 'Présent',          cls: 'bg-ok-bg text-ok-text border-ok-border',                 icon: '✓' },
  calcule:       { label: 'Produit par DIMADOSE', cls: 'bg-clinical-light text-clinical border-clinical-border', icon: '⟳' },
  'non-exporte': { label: 'Non exporté',      cls: 'bg-warn-bg text-warn-text border-warn-border',           icon: '⊘' },
  absent:        { label: 'Absent',           cls: 'bg-slate-100 text-slate-400 border-slate-200',           icon: '—' },
  optionnel:     { label: 'Optionnel',        cls: 'bg-slate-100 text-slate-400 border-slate-200',           icon: '○' },
}

interface FileRow { nom: string; desc: string; etat: Etat }

/** Traduit l'état dérivé par le moteur en état d'affichage. */
const etatDepuisObjet = (o: ObjetDicom): Etat => {
  if (o.etat === 'non-exporte') return 'non-exporte'
  if (o.etat === 'absent') return 'absent'
  return o.source === 'dimadose' ? 'calcule' : 'charge'
}

function FileList({ rows }: { rows: FileRow[] }) {
  return (
    <div className="divide-y divide-slate-50">
      {rows.map(r => {
        const s = etatStyle[r.etat]
        return (
          <div key={r.nom} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 border ${s.cls}`}>
              {s.icon}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-mono font-semibold text-slate-800">{r.nom}</span>
              <span className="text-xs text-slate-400 ml-2">{r.desc}</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${s.cls}`}>{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// Objets du planning initial — produits une seule fois, avant la première séance.
const planning: FileRow[] = [
  { nom: 'CTp',           desc: 'Scanner de planification (donnée d\'entrée)', etat: 'charge' },
  { nom: 'IRMp',          desc: 'IRM de planification',                        etat: 'charge' },
  { nom: 'RTSSp',         desc: 'Contours de référence — cibles et OAR',       etat: 'charge' },
  { nom: 'RTPp',          desc: 'Plan de référence — source des contraintes',  etat: 'charge' },
  { nom: 'RTDosep',       desc: 'Dose de référence — prévisionnel du cumul',   etat: 'charge' },
  { nom: 'Reg CTp–IRMp',  desc: 'Recalage rigide — affectation des densités',  etat: 'calcule' },
]

export default function DicomRecap({ patient: p, onClose }: Props) {
  const d = useDossier()
  const seances = d.seances.filter(s => s.realisee)

  const parSeance = seances.map(s => ({
    numero: s.numero,
    voie: s.voie,
    date: formatDateCourte(s.mesures.date),
    incluse: s.incluse,
    rows: objetsDicom(s).map<FileRow>(o => ({
      nom: `${o.nom} — S${s.numero}`,
      desc: o.role,
      etat: etatDepuisObjet(o),
    })),
  }))

  const totalObjets = planning.length + 1 + parSeance.reduce((a, s) => a + s.rows.length, 0)
  const nonExportes = parSeance.reduce(
    (a, s) => a + s.rows.filter(r => r.etat === 'non-exporte').length,
    0,
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-app-sidebar/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-app-bg w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col">

        <div className="bg-app-sidebar text-white px-6 py-5 flex items-start justify-between shrink-0 sticky top-0 z-10">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">
              Dossier DICOM — traçabilité
            </div>
            <div className="text-lg font-bold">{p.nom} {p.prenom}</div>
            <div className="text-xs opacity-60 mt-0.5 font-mono">
              {p.id} · {p.protocole} · {totalObjets} objets · {nonExportes} non exporté(s)
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">

          {/* Planning initial */}
          <div className="bg-white rounded-3xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-800">Planning initial</div>
                <div className="text-xs text-slate-400 mt-0.5">Produit une seule fois — verrouillé</div>
              </div>
              <span className="text-xs bg-clinical-light text-clinical border border-clinical-border px-2.5 py-1 rounded-full font-medium">
                Étape 1
              </span>
            </div>
            <FileList rows={planning} />
            <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-2 text-xs">
              <span className="font-mono font-semibold text-slate-700">IRMref</span>
              <span className="text-slate-400">Référentiel de sommation</span>
              <span className="ml-auto font-mono text-clinical">{d.irmrefLabel}</span>
            </div>
          </div>

          {/* Une carte par séance réalisée */}
          {parSeance.map(s => (
            <div key={s.numero} className="bg-white rounded-3xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Séance {s.numero}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {s.date} · {s.incluse ? 'incluse au cumul' : 'exclue du cumul'}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                  s.voie === 'ATS'
                    ? 'bg-clinical-light text-clinical border-clinical-border'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {s.voie}
                </span>
              </div>
              <FileList rows={s.rows} />
            </div>
          ))}

          <div className="bg-white rounded-3xl px-5 py-4 text-xs text-slate-500 leading-relaxed">
            <strong className="text-slate-700">Ce que la machine n'exporte pas.</strong> L'imagerie ciné 2D,
            le critère de recouvrement VOICE et les décalages temps réel acquis pendant l'irradiation
            restent dans un espace propriétaire et ne sont pas récupérables. L'IRM de vérification
            (IRMv) n'est pas conservée : une reprise peut être signalée, jamais illustrée. La dose
            affichée dans l'outil est donc une <em>dose reconstruite</em>, pas la dose délivrée.
          </div>
        </div>
      </div>
    </div>
  )
}
