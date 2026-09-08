import { useState, useRef } from 'react'
import { type PatientRecord } from '../Dashboard'

type FileStatus = 'pending' | 'uploading' | 'done' | 'missing'

interface UploadFile {
  id: string
  label: string
  hint: string
  status: FileStatus
  uploadable: boolean
}

interface Props {
  patient: PatientRecord
  canUpload: boolean
  locked: boolean
}

function useUploadFiles(initial: UploadFile[]) {
  const [files, setFiles] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<string | null>(null)

  const trigger = (id: string) => { setPending(id); inputRef.current?.click() }
  const remove = (id: string) => setFiles(f => f.map(x => x.id === id ? { ...x, status: 'missing' } : x))
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !pending) return
    setFiles(f => f.map(x => x.id === pending ? { ...x, status: 'uploading' } : x))
    setTimeout(() => {
      setFiles(f => f.map(x => x.id === pending ? { ...x, status: 'done' } : x))
      setPending(null)
    }, 800)
    e.target.value = ''
  }

  return { files, trigger, remove, onChange, inputRef }
}

// ── Données initiales (aussi visibles dans le Dossier DICOM) ──
const initialData: UploadFile[] = [
  { id: 'CTp',     label: 'CTp',          hint: 'Scanner de planification',                status: 'missing', uploadable: true },
  { id: 'IRMp',    label: 'IRMp',         hint: 'IRM de planification — devient IRMref (S1)', status: 'missing', uploadable: true },
  { id: 'RTSSp',   label: 'RTSSp',        hint: 'Contours cibles + OARs',                  status: 'missing', uploadable: true },
  { id: 'PP',      label: 'PP',           hint: 'Plan de traitement de référence',         status: 'missing', uploadable: true },
  { id: 'Dose',    label: 'Dose',         hint: 'Distribution de dose de référence',       status: 'missing', uploadable: true },
  { id: 'RegCTp',  label: 'Reg CTp–IRMp', hint: 'Recalage rigide — calculé par DIMADOSE',  status: 'pending', uploadable: false },
]

// ── Configuration par localisation ──
const LOC_CONFIG: Record<string, {
  modes: string[]
  defaultMode: string
  modeHint: string
  gating: { key: string; val: string }[]
}> = {
  'Prostate': {
    modes: ['Non-Respiratory', 'Average', 'Exhale', 'Breath-hold'],
    defaultMode: 'Non-Respiratory',
    modeHint: 'Pelvis — mouvement respiratoire négligeable',
    gating: [
      { key: 'APM_Registration', val: 'Prostate' },
      { key: 'Target',           val: 'Prostate' },
      { key: 'Gating_Envelope',  val: 'PTV' },
    ],
  },
  'Col de l’utérus': {
    modes: ['Non-Respiratory', 'Average', 'Exhale', 'Breath-hold'],
    defaultMode: 'Non-Respiratory',
    modeHint: 'Pelvis — remplissage vessie/rectum à surveiller',
    gating: [
      { key: 'APM_Registration', val: 'Utérus' },
      { key: 'Target',           val: 'CTV col + utérus' },
      { key: 'Gating_Envelope',  val: 'PTV + marge' },
    ],
  },
}

function resolveLoc(protocole: string) {
  if (/col/i.test(protocole) || /utérus/i.test(protocole)) return 'Col de l’utérus'
  return 'Prostate'
}

export default function StepPlanning({ patient, canUpload, locked }: Props) {
  const data = useUploadFiles(initialData)

  const locKey = resolveLoc(patient.protocole)
  const cfg = LOC_CONFIG[locKey]
  const [modeAcq, setModeAcq] = useState(cfg.defaultMode)

  const allRequiredDone = data.files.filter(f => f.uploadable).every(f => f.status === 'done')
  const canEdit = canUpload && !locked

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="bg-app-sidebar rounded-3xl px-6 py-5 text-white flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold opacity-60 uppercase tracking-widest mb-1">Étape 1 · {locKey}</div>
          <div className="text-xl font-bold">Planning initial</div>
          <div className="text-sm opacity-70 mt-1">Réalisé une seule fois avant la première séance</div>
        </div>
        {locked && (
          <span className="flex items-center gap-1.5 bg-ok/20 text-ok-bg border border-ok/30 px-3 py-1.5 rounded-full text-xs font-semibold mt-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Verrouillé
          </span>
        )}
      </div>

      {locked && (
        <div className="bg-ok-bg border border-ok-border rounded-2xl px-5 py-3 text-sm text-ok-text flex items-center gap-2">
          <span>✓</span>
          Planning initial validé et verrouillé. Ces données de référence restent stables pour tout le traitement.
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">

        {/* Left — configuration */}
        <div className="flex flex-col gap-4">

          {/* Mode d'acquisition */}
          <div className="bg-white rounded-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-800">Mode d'acquisition IRM</div>
              <div className="text-xs text-slate-400 mt-0.5">Adapté à la localisation · {cfg.modeHint}</div>
            </div>
            <div className="p-4 flex flex-wrap gap-1.5">
              {cfg.modes.map(m => (
                <button
                  key={m}
                  disabled={!canEdit}
                  onClick={() => setModeAcq(m)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium border transition-all disabled:cursor-not-allowed ${
                    modeAcq === m
                      ? 'bg-clinical text-white border-clinical'
                      : 'bg-slate-50 text-slate-500 border-slate-200 enabled:hover:border-clinical/40'
                  }`}
                >
                  {m}
                  {m === cfg.defaultMode && <span className="ml-1 opacity-60">(reco.)</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Paramètres de gating */}
          <div className="bg-white rounded-3xl overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-800">Paramètres de gating</div>
              <div className="text-xs text-slate-400 mt-0.5">Structures définies selon la localisation</div>
            </div>
            <div className="p-4 flex flex-col gap-1.5">
              {cfg.gating.map(g => (
                <div key={g.key} className="flex items-center justify-between bg-clinical-light border border-clinical-border rounded-xl px-3 py-2">
                  <span className="text-xs text-slate-500 font-mono">{g.key}</span>
                  <span className="text-xs font-bold text-clinical">{g.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — données initiales */}
        <FileSection
          title="Données initiales (DICOM)"
          subtitle="Récupérées depuis le PACS / Monaco"
          files={data.files}
          onUpload={data.trigger}
          onRemove={data.remove}
          inputRef={data.inputRef}
          onChange={data.onChange}
          canUpload={canEdit}
        />
      </div>

      {/* ── Prêt pour la suite ── */}
      <div className={`rounded-3xl p-5 border transition-all ${
        allRequiredDone ? 'bg-ok-bg border-ok-border' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-sm font-bold ${allRequiredDone ? 'text-ok-text' : 'text-slate-700'}`}>
              {allRequiredDone ? 'Toutes les données requises sont présentes' : 'Données requises incomplètes'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {allRequiredDone
                ? 'Vous pouvez valider le planning initial et passer à l’IRM du jour.'
                : `${data.files.filter(f => f.uploadable && f.status === 'done').length}/${data.files.filter(f => f.uploadable).length} fichiers chargés · mode ${modeAcq}`}
            </div>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
            allRequiredDone ? 'bg-ok text-white' : 'bg-slate-100 text-slate-300'
          }`}>
            {allRequiredDone ? '✓' : '…'}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── File section sub-component ── */
interface FileSectionProps {
  title: string
  subtitle: string
  files: UploadFile[]
  onUpload: (id: string) => void
  onRemove: (id: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  canUpload: boolean
}

function FileSection({ title, subtitle, files, onUpload, onRemove, inputRef, onChange, canUpload }: FileSectionProps) {
  const done = files.filter(f => f.status === 'done').length
  const uploadable = files.filter(f => f.uploadable).length

  return (
    <div className="bg-white rounded-3xl overflow-hidden">
      <div className="bg-app-sidebar px-5 py-3 flex items-center justify-between" style={{ borderRadius: '22px 22px 0 0' }}>
        <div>
          <div className="text-sm font-bold text-white">{title}</div>
          <div className="text-xs text-white/60 mt-0.5">{subtitle}</div>
        </div>
        <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
          {done}/{uploadable} fichiers
        </span>
      </div>

      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-clinical transition-all duration-500"
          style={{ width: uploadable > 0 ? `${(done / uploadable) * 100}%` : '0%' }}
        />
      </div>

      <div className="divide-y divide-slate-50">
        {files.map(file => (
          <div key={file.id} className="flex items-center gap-3 px-4 py-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
              file.status === 'done'     ? 'bg-ok-bg text-ok' :
              file.status === 'uploading'? 'bg-clinical-light text-clinical' :
              file.status === 'pending'  ? 'bg-slate-100 text-slate-400' :
              'bg-danger-bg text-danger'
            }`}>
              {file.status === 'done'      ? '✓' :
               file.status === 'uploading' ? '↻' :
               file.status === 'pending'   ? '—' : ''}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono text-slate-800">{file.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  file.status === 'done'      ? 'bg-ok-bg text-ok-text border border-ok-border' :
                  file.status === 'uploading' ? 'bg-clinical-light text-clinical border border-clinical-border' :
                  file.status === 'pending'   ? 'bg-slate-100 text-slate-400 border border-slate-200' :
                  'bg-danger-bg text-danger-text border border-danger-border'
                }`}>
                  {file.status === 'done'      ? 'Chargé' :
                   file.status === 'uploading' ? 'Chargement…' :
                   file.status === 'pending'   ? 'Auto-calculé' :
                   'Manquant'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{file.hint}</div>
            </div>

            {file.uploadable && file.status === 'missing' && canUpload && (
              <button
                onClick={() => onUpload(file.id)}
                className="shrink-0 text-xs px-3 py-1.5 bg-clinical-light text-clinical border border-clinical-border rounded-xl hover:bg-clinical hover:text-white transition-all font-semibold"
              >
                Charger
              </button>
            )}
            {file.status === 'done' && file.uploadable && canUpload && (
              <button
                onClick={() => onRemove(file.id)}
                className="shrink-0 w-5 h-5 flex items-center justify-center text-slate-300 hover:text-danger hover:bg-red-50 rounded-full transition-all text-xs"
                title="Retirer"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Drop zone */}
      {canUpload && (
        <div
          className="mx-3 mb-3 mt-1 border-2 border-dashed border-slate-200 hover:border-clinical/50 hover:bg-clinical-light/40 rounded-2xl px-4 py-3 cursor-pointer transition-all"
          onClick={() => {
            const first = files.find(f => f.uploadable && f.status === 'missing')
            if (first) onUpload(first.id)
          }}
        >
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-xs">Glisser un fichier DICOM ou <span className="text-clinical font-medium">parcourir</span></span>
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" accept=".dcm,.zip,.nii,.nii.gz" className="hidden" onChange={onChange} />
    </div>
  )
}
