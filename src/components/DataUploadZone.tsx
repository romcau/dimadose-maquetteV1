import { useState, useRef, useCallback } from 'react'

export type FileStatus = 'charge' | 'manquant' | 'calcule' | 'non-exportable' | 'optionnel' | 'en-attente'

export interface DicomEntry {
  id: string
  nom: string
  description: string
  status: FileStatus
  uploadable?: boolean
  filename?: string
}

interface Props {
  title: string
  entries: DicomEntry[]
  onUpload?: (id: string, file: File) => void
  accentColor?: 'clinical' | 'gating' | 'blue'
  readOnly?: boolean
}

const statusConfig: Record<FileStatus, { label: string; iconCls: string; rowCls: string }> = {
  charge:           { label: 'Chargé',         iconCls: 'text-ok font-bold',     rowCls: '' },
  manquant:         { label: 'Manquant',        iconCls: 'text-danger',           rowCls: '' },
  calcule:          { label: 'Calculé auto.',   iconCls: 'text-clinical-mid',     rowCls: '' },
  'non-exportable': { label: 'Non exporté',     iconCls: 'text-slate-400',        rowCls: 'opacity-60' },
  optionnel:        { label: 'Optionnel',       iconCls: 'text-slate-400 italic', rowCls: 'opacity-60' },
  'en-attente':     { label: 'En attente',      iconCls: 'text-slate-300',        rowCls: 'opacity-40' },
}

const statusIcon: Record<FileStatus, string> = {
  charge:           '✓',
  manquant:         '✗',
  calcule:          '⟳',
  'non-exportable': '⊘',
  optionnel:        '○',
  'en-attente':     '○',
}

const accentBadge: Record<NonNullable<Props['accentColor']>, string> = {
  clinical: 'bg-clinical text-white',
  gating:   'bg-gating text-white',
  blue:     'bg-blue-600 text-white',
}
const accentBar: Record<NonNullable<Props['accentColor']>, string> = {
  clinical: 'bg-clinical',
  gating:   'bg-gating',
  blue:     'bg-blue-500',
}
const accentDrop: Record<NonNullable<Props['accentColor']>, string> = {
  clinical: 'border-clinical bg-clinical-light text-clinical',
  gating:   'border-gating bg-gating-light text-gating',
  blue:     'border-blue-400 bg-blue-50 text-blue-600',
}

export function DataUploadZone({ title, entries, onUpload, accentColor = 'clinical', readOnly = false }: Props) {
  const [statuses, setStatuses] = useState<Record<string, FileStatus>>(
    Object.fromEntries(entries.map(e => [e.id, e.status]))
  )
  const [uploading, setUploading] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const handleFileSelect = (id: string) => {
    setPendingId(id)
    inputRef.current?.click()
  }

  const processFile = useCallback((id: string, file: File) => {
    setUploading(id)
    setTimeout(() => {
      setStatuses(prev => ({ ...prev, [id]: 'charge' }))
      setUploading(null)
      onUpload?.(id, file)
    }, 900)
  }, [onUpload])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingId) return
    processFile(pendingId, file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (readOnly) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const firstUploadable = currentEntries.find(
      en => en.uploadable && (statuses[en.id] === 'manquant' || en.status === 'manquant')
    )
    if (firstUploadable) processFile(firstUploadable.id, file)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const currentEntries = entries.map(e => ({ ...e, status: statuses[e.id] ?? e.status }))
  const loaded = currentEntries.filter(e => e.status === 'charge' || e.status === 'calcule').length
  const required = currentEntries.filter(e => !['non-exportable', 'optionnel', 'en-attente'].includes(e.status)).length

  return (
    <div
      className={`bg-white rounded-2xl overflow-hidden border-2 transition-all ${
        dragOver
          ? accentDrop[accentColor].split(' ').slice(0, 2).join(' ')
          : 'border-transparent'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${accentBadge[accentColor]}`} style={{borderRadius: '14px 14px 0 0'}}>
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs opacity-80 bg-white/20 px-2 py-0.5 rounded-full">
          {loaded} / {required}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className={`h-full transition-all duration-500 ${accentBar[accentColor]}`}
          style={{ width: required > 0 ? `${(loaded / required) * 100}%` : '0%' }}
        />
      </div>

      {/* File list */}
      <div className="divide-y divide-slate-50 bg-white">
        {currentEntries.map(entry => {
          const cfg = statusConfig[entry.status]
          const isUploading = uploading === entry.id
          return (
            <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 ${cfg.rowCls}`}>
              <span className={`text-sm w-4 text-center shrink-0 ${cfg.iconCls}`}>
                {isUploading ? (
                  <span className="inline-block animate-spin text-clinical">↻</span>
                ) : statusIcon[entry.status]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-semibold text-slate-800">{entry.nom}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    entry.status === 'charge' ? 'bg-ok-bg text-ok-text border-ok-border' :
                    entry.status === 'calcule' ? 'bg-clinical-light text-clinical border-clinical-border' :
                    entry.status === 'manquant' ? 'bg-danger-bg text-danger-text border-danger-border' :
                    'bg-slate-50 text-slate-400 border-slate-200'
                  }`}>
                    {isUploading ? 'Chargement…' : cfg.label}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 leading-tight">{entry.description}</div>
              </div>
              {entry.uploadable && entry.status === 'manquant' && !isUploading && !readOnly && (
                <button
                  onClick={() => handleFileSelect(entry.id)}
                  className="shrink-0 text-xs px-3 py-1.5 bg-clinical-light text-clinical border border-clinical-border hover:bg-clinical hover:text-white rounded-xl transition-all font-medium"
                >
                  Charger
                </button>
              )}
              {entry.status === 'charge' && entry.uploadable && !readOnly && (
                <button
                  onClick={() => setStatuses(prev => ({ ...prev, [entry.id]: 'manquant' }))}
                  className="shrink-0 text-xs text-slate-300 hover:text-danger transition-colors w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50"
                  title="Retirer"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Hidden file input */}
      <input ref={inputRef} type="file" accept=".dcm,.zip,.nii,.nii.gz" className="hidden" onChange={handleFileChange} />

      {/* Drop zone hint */}
      {!readOnly && (
      <div
        className={`mx-3 mb-3 mt-1 rounded-xl border-2 border-dashed px-4 py-3 text-center cursor-pointer transition-all ${
          dragOver
            ? `${accentDrop[accentColor]} border-solid`
            : 'border-slate-200 hover:border-clinical/40 hover:bg-clinical-light/50'
        }`}
        onClick={() => {
          const first = entries.find(e => e.uploadable && statuses[e.id] === 'manquant')
          if (first) handleFileSelect(first.id)
        }}
      >
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span className="text-xs">
            Glisser un fichier DICOM ici ou{' '}
            <span className="text-clinical font-medium">parcourir</span>
          </span>
        </div>
      </div>
      )}
    </div>
  )
}
