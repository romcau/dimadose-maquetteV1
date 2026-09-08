interface Props {
  validated: boolean
  onValidate: () => void
  onUnvalidate: () => void
  nextLabel?: string
  onNext?: () => void
  canValidate?: boolean
  validatorLabel?: string
}

export default function StepValidateBar({ validated, onValidate, onUnvalidate, nextLabel, onNext, canValidate = true, validatorLabel }: Props) {
  if (!canValidate && !validated) {
    return (
      <div className="max-w-4xl mx-auto mt-4">
        <div className="bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-600">Consultation en lecture seule</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {validatorLabel ?? 'La validation de cette étape est réservée au physicien médical.'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (validated) {
    return (
      <div className="max-w-4xl mx-auto mt-4">
        <div className="bg-ok-bg border border-ok-border rounded-3xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-ok flex items-center justify-center text-white text-sm font-bold shrink-0">
              ✓
            </div>
            <div>
              <div className="text-sm font-bold text-ok-text">Étape validée</div>
              <div className="text-xs text-ok-text/70 mt-0.5">Cette étape est marquée comme complète.</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canValidate && (
              <button
                onClick={onUnvalidate}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline"
              >
                Annuler la validation
              </button>
            )}
            {onNext && nextLabel && (
              <button
                onClick={onNext}
                className="flex items-center gap-2 bg-clinical hover:bg-clinical-mid text-white text-sm font-semibold px-5 py-2.5 rounded-2xl transition-colors"
              >
                {nextLabel}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto mt-4">
      <div className="bg-white border border-slate-200 rounded-3xl px-6 py-4 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Vérifiez que toutes les données et configurations sont correctes avant de valider.
        </div>
        <button
          onClick={onValidate}
          className="flex items-center gap-2 bg-app-sidebar hover:bg-app-sidebar/80 text-white text-sm font-semibold px-6 py-2.5 rounded-2xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Valider l'étape
        </button>
      </div>
    </div>
  )
}
