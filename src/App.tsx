import { useEffect, useState } from 'react'
import LoginScreen from './components/LoginScreen'
import Dashboard, { patientsDemo, type PatientRecord } from './components/Dashboard'
import Sidebar, { type Page } from './components/Sidebar'
import WorkflowProgress from './components/WorkflowProgress'
import StepPlanning from './components/steps/StepPlanning'
import StepIRM from './components/steps/StepIRM'
import StepAdaptation from './components/steps/StepAdaptation'
import StepGating from './components/steps/StepGating'
import StepValidateBar from './components/StepValidateBar'
import DimadoseDrawer, { type MomentId } from './components/DimadoseDrawer'
import DicomRecap from './components/DicomRecap'
import { DossierProvider, useDossier } from './store'
import { libellesRoles, type Role, type Voie } from './data'
import { etatApresSeance, formatDateCourte, formatHorodatage } from './logic'
import { chargerListePatients, sauvegarderListePatients } from './persistence'

type AppView = 'login' | 'dashboard' | 'patient'
interface User { name: string; role: Role }

const defaultPage: Record<PatientRecord['action'], Page> = {
  'decision-en-seance': 'step-2',
  'validation-requise':  'step-2',
  'rapport-disponible':  'step-3',
  'planification':       'step-1',
  'aucune':              'step-2',
}

const stepNextLabel: Record<Page, string> = {
  'step-1': "Passer à l'IRM du jour",
  'step-2': "Passer à l'adaptation",
  'step-3': 'Passer au gating',
  'step-4': 'Terminer le workflow',
}

export default function App() {
  const [view, setView] = useState<AppView>('login')
  const [user, setUser] = useState<User | null>(null)

  // App détient la liste : le dossier ouvert et le tableau de bord lisent la
  // même donnée, donc terminer une séance se voit immédiatement dans la liste.
  const [patients, setPatients] = useState<PatientRecord[]>(
    () => chargerListePatients<PatientRecord>() ?? patientsDemo,
  )
  const [patientId, setPatientId] = useState<string | null>(null)

  useEffect(() => { sauvegarderListePatients(patients) }, [patients])

  const patient = patients.find(p => p.id === patientId) ?? null

  const handleSelectPatient = (p: PatientRecord) => {
    setPatientId(p.id)
    setView('patient')
  }

  /** Applique au dossier de la liste ce qu'une séance terminée change. */
  const majPatient = (id: string, maj: Partial<PatientRecord>) => {
    setPatients(prev => prev.map(p => (p.id === id ? { ...p, ...maj } : p)))
  }

  if (view === 'login' || !user) {
    return <LoginScreen onLogin={u => { setUser(u); setView('dashboard') }} />
  }

  if (view === 'dashboard' || !patient) {
    return (
      <Dashboard
        patients={patients}
        setPatients={setPatients}
        onSelectPatient={handleSelectPatient}
        userName={user.name}
        userRole={libellesRoles[user.role]}
        readOnly={user.role === 'manipulateur'}
        onLogout={() => { setUser(null); setView('login') }}
      />
    )
  }

  // Un dossier = un provider. Changer de patient repart d'un état propre.
  return (
    <DossierProvider
      key={patient.id}
      dossierId={patient.id}
      utilisateur={{ nom: user.name, role: user.role }}
      seanceInitiale={Math.max(patient.seanceCourante, 1)}
    >
      <PatientView
        patient={patient}
        user={user}
        pageInitiale={defaultPage[patient.action] ?? 'step-2'}
        onSeanceTerminee={maj => majPatient(patient.id, maj)}
        onBackToDashboard={() => { setPatientId(null); setView('dashboard') }}
        onLogout={() => { setUser(null); setPatientId(null); setView('login') }}
      />
    </DossierProvider>
  )
}

/* ───────────────────────────────────────────────────────────────────────────── */

interface PatientViewProps {
  patient: PatientRecord
  user: User
  pageInitiale: Page
  onSeanceTerminee: (maj: Partial<PatientRecord>) => void
  onBackToDashboard: () => void
  onLogout: () => void
}

function PatientView({
  patient: p,
  user,
  pageInitiale,
  onSeanceTerminee,
  onBackToDashboard,
  onLogout,
}: PatientViewProps) {
  const d = useDossier()
  const [page, setPage] = useState<Page>(pageInitiale)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [validatedSteps, setValidatedSteps] = useState<Set<Page>>(new Set())
  const [activeModal, setActiveModal] = useState<MomentId | null>(null)
  const [decisionModalOpen, setDecisionModalOpen] = useState(false)
  const [dicomOpen, setDicomOpen] = useState(false)
  const [workflowDone, setWorkflowDone] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [prochaineSeance, setProchaineSeance] = useState('')

  const sessionNum = d.seanceCourante
  const seance = d.seance(sessionNum)
  const decision = seance.voie
  const reco = d.recommandation

  // Les droits sont calculés une seule fois, dans le moteur, et partagés.
  const droits = d.droits

  // Séance suivante : le planning initial reste acquis, on reprend à l'IRM du jour.
  const startNextSession = () => {
    d.setSeanceCourante(sessionNum + 1)
    setValidatedSteps(new Set(['step-1']))
    setWorkflowDone(false)
    setActiveModal(null)
    setPage('step-2')
  }

  /**
   * La séance vient d'être délivrée : le dossier avance dans la liste patients.
   * La séance reste à évaluer (moment A), d'où l'action « validation requise ».
   */
  const terminerSeance = () => {
    const suite = etatApresSeance(d.seances, sessionNum, p.totalSeances)
    setProchaineSeance(suite.prochaineSeanceISO)
    onSeanceTerminee({
      seanceCourante: suite.seanceCourante,
      dernierSeanceDate: suite.derniereSeanceDate,
      prochaineSeanceDate: suite.prochaineSeanceDate,
      statut: suite.statut,
      action: suite.action,
      confiance: suite.confiance,
      dernierePar: user.name,
    })
    d.tracer({
      categorie: 'seance',
      seance: sessionNum,
      libelle: `Séance ${sessionNum} terminée — voie ${decision ?? 'non tranchée'}`,
      detail: suite.protocoleTermine
        ? 'Dernière séance du protocole. Reste à produire le rapport de fin de traitement.'
        : `Prochaine séance : ${suite.prochaineSeanceDate}. Évaluation inter-séance à faire.`,
    })
    setWorkflowDone(true)
  }

  /** Report ou avance de la prochaine séance, saisi en fin de workflow. */
  const changerProchaineSeance = (iso: string) => {
    setProchaineSeance(iso)
    const libelle = iso ? formatDateCourte(iso) : 'À planifier'
    onSeanceTerminee({ prochaineSeanceDate: libelle })
    d.tracer({
      categorie: 'seance',
      seance: sessionNum,
      libelle: `Prochaine séance fixée au ${libelle}`,
    })
  }

  const validate   = (step: Page) => setValidatedSteps(prev => new Set([...prev, step]))
  const unvalidate = (step: Page) => setValidatedSteps(prev => { const s = new Set(prev); s.delete(step); return s })

  // La décision clinique est requise avant de passer à l'adaptation.
  const goToAdaptation = () => {
    if (!decision) { setDecisionModalOpen(true); return }
    validate('step-2'); setPage('step-3')
  }

  const confirmDecision = (v: Voie) => {
    d.enregistrerVoie(
      sessionNum,
      v,
      v === reco.voie ? undefined : ['Décision prise depuis le workflow, hors écran de recommandation'],
    )
    setDecisionModalOpen(false)
    validate('step-2')
    setPage('step-3')
  }

  const completions: Record<Page, number> = {
    'step-1': validatedSteps.has('step-1') ? 100 : 0,
    'step-2': validatedSteps.has('step-2') ? 100 : 0,
    'step-3': validatedSteps.has('step-3') ? 100 : 0,
    'step-4': validatedSteps.has('step-4') ? 100 : 0,
  }

  const planningDone = validatedSteps.has('step-1') || sessionNum > 1

  return (
    <div className="h-screen flex flex-col font-sans text-slate-900 bg-app-bg overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-app-sidebar border-b border-white/5 h-12 flex items-center justify-between px-5 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <svg width="140" height="24" viewBox="0 0 1737 296" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="DIMADOSE">
            <defs>
              <linearGradient id="app-dose-grad" x1="849" y1="184" x2="1737" y2="184" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0b6fa8" />
                <stop offset="100%" stopColor="#04b8c5" />
              </linearGradient>
            </defs>
            <path d="M75.375 229.5H126C133.833 229.5 140.625 228.667 146.375 227C152.208 225.333 157.042 222.667 160.875 219C164.708 215.333 167.583 210.583 169.5 204.75C171.417 198.917 172.375 191.833 172.375 183.5C172.375 175.417 171.375 168.583 169.375 163C167.458 157.417 164.542 152.875 160.625 149.375C156.792 145.875 151.958 143.375 146.125 141.875C140.375 140.292 133.667 139.5 126 139.5H75.375V229.5ZM23.75 272V97H137C149.917 97 161.75 98.7917 172.5 102.375C183.25 105.958 192.5 111.375 200.25 118.625C208.083 125.875 214.167 135 218.5 146C222.833 156.917 225 169.75 225 184.5C225 200.167 222.667 213.542 218 224.625C213.417 235.708 207.125 244.75 199.125 251.75C191.208 258.75 181.917 263.875 171.25 267.125C160.583 270.375 149.167 272 137 272H23.75ZM262.52 272V97H314.145V272H262.52ZM361.641 272V97H406.641L468.516 187L528.391 97H574.516V272H523.016V173L465.141 259.875L406.141 174.125V272H361.641ZM598.145 272L688.395 97H735.02L825.895 272H765.52L750.02 240.25H668.645L652.395 272H598.145ZM687.27 204.25H733.02L710.645 158.875L687.27 204.25Z" fill="rgba(255,255,255,0.92)" />
            <path d="M901.303 229.5H951.928C959.761 229.5 966.553 228.667 972.303 227C978.136 225.333 982.969 222.667 986.803 219C990.636 215.333 993.511 210.583 995.428 204.75C997.344 198.917 998.303 191.833 998.303 183.5C998.303 175.417 997.303 168.583 995.303 163C993.386 157.417 990.469 152.875 986.553 149.375C982.719 145.875 977.886 143.375 972.053 141.875C966.303 140.292 959.594 139.5 951.928 139.5H901.303V229.5ZM849.678 272V97H962.928C975.844 97 987.678 98.7917 998.428 102.375C1009.18 105.958 1018.43 111.375 1026.18 118.625C1034.01 125.875 1040.09 135 1044.43 146C1048.76 156.917 1050.93 169.75 1050.93 184.5C1050.93 200.167 1048.59 213.542 1043.93 224.625C1039.34 235.708 1033.05 244.75 1025.05 251.75C1017.14 258.75 1007.84 263.875 997.178 267.125C986.511 270.375 975.094 272 962.928 272H849.678ZM1086.17 133.125C1086.17 117.625 1090.47 107.458 1099.05 102.625C1107.72 97.7083 1119.09 95.25 1133.17 95.25H1237.8C1251.97 95.25 1263.38 97.7083 1272.05 102.625C1280.72 107.458 1285.05 117.625 1285.05 133.125V234.375C1285.05 250.458 1280.92 261.042 1272.67 266.125C1264.42 271.208 1252.8 273.75 1237.8 273.75H1133.17C1118.26 273.75 1106.67 271.208 1098.42 266.125C1090.26 260.958 1086.17 250.375 1086.17 234.375V133.125ZM1137.8 140.25V228.75H1233.55V140.25H1137.8ZM1320.27 223.75L1369.52 217.25V234.75H1455.52V203.125H1370.77C1363.6 203.125 1357.1 202.583 1351.27 201.5C1345.43 200.417 1340.52 198.458 1336.52 195.625C1332.52 192.708 1329.43 188.667 1327.27 183.5C1325.1 178.333 1324.02 171.75 1324.02 163.75V133C1324.02 125.083 1325.18 118.708 1327.52 113.875C1329.85 108.958 1333.1 105.125 1337.27 102.375C1341.43 99.5417 1346.39 97.6667 1352.14 96.75C1357.97 95.75 1364.35 95.25 1371.27 95.25H1455.27C1462.27 95.25 1468.64 95.75 1474.39 96.75C1480.14 97.6667 1485.06 99.5 1489.14 102.25C1493.31 105 1496.52 108.833 1498.77 113.75C1501.02 118.583 1502.14 124.917 1502.14 132.75V143.875L1453.02 150.125V134.25H1373.27V164H1457.64C1464.64 164 1471.02 164.5 1476.77 165.5C1482.52 166.417 1487.47 168.25 1491.64 171C1495.81 173.667 1499.02 177.458 1501.27 182.375C1503.52 187.292 1504.64 193.667 1504.64 201.5V234.5C1504.64 250.667 1500.47 261.25 1492.14 266.25C1483.81 271.25 1472.31 273.75 1457.64 273.75H1367.14C1359.97 273.75 1353.47 273.208 1347.64 272.125C1341.81 271.125 1336.85 269.208 1332.77 266.375C1328.77 263.458 1325.68 259.458 1323.52 254.375C1321.35 249.292 1320.27 242.708 1320.27 234.625V223.75ZM1543.28 272V97H1713.91V138.375H1594.91V164H1665.66V202.125H1594.91V230.625H1716.41V272H1543.28Z" fill="url(#app-dose-grad)" />
          </svg>
          <span className="text-white/20 text-xs">·</span>
          <button
            onClick={onBackToDashboard}
            className="text-xs text-white/40 hover:text-white/80 transition-colors"
          >
            Tableau de bord
          </button>
          <span className="text-white/20 text-xs">/</span>
          <span className="text-xs text-white/90 font-medium truncate max-w-48">
            {p.nom} {p.prenom}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="hidden lg:block text-xs text-white/30 cursor-help"
            title={
              "Dose reconstruite, et non dose délivrée : les données acquises pendant l'irradiation "
              + '(imagerie ciné 2D, critère VOICE, décalages temps réel) ne sont pas exportées par la machine.'
            }
          >
            Dose reconstruite ⓘ
          </span>

          <span className="text-white/20 text-xs hidden lg:block">·</span>

          <span
            className="hidden lg:flex items-center gap-1.5 text-xs text-white/30 cursor-help"
            title={
              d.stockagePersistant
                ? "Les décisions et le journal sont enregistrés dans ce navigateur, sur ce poste. "
                  + "Rien n'est transmis à l'extérieur."
                : "Ce navigateur refuse le stockage local : l'état ne vit qu'en mémoire et sera perdu "
                  + 'au rechargement de la page.'
            }
          >
            <span className={`w-1.5 h-1.5 rounded-full ${d.stockagePersistant ? 'bg-ok' : 'bg-warn'}`} />
            {d.stockagePersistant
              ? d.enregistreLe ? `Enregistré ${formatHorodatage(d.enregistreLe).split(' · ')[1]}` : 'Enregistrement actif'
              : 'Non enregistré'}
          </span>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              onBlur={() => setTimeout(() => setUserMenuOpen(false), 150)}
              className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-clinical flex items-center justify-center text-xs font-bold text-white">
                {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="hidden md:block text-white/70">{user.name}</span>
              <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-10 z-50 w-60 bg-white border border-violet-100 rounded-2xl py-1 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{libellesRoles[user.role]}</div>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); setActiveModal('moment-D') }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-clinical hover:bg-clinical-light transition-colors"
                >
                  Journal de traçabilité ({d.trace.length})
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); setResetOpen(true) }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-danger hover:bg-danger-bg transition-colors border-t border-slate-100"
                >
                  Réinitialiser la démonstration
                </button>
                <button
                  onClick={onLogout}
                  className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-clinical hover:bg-clinical-light transition-colors border-t border-slate-100"
                >
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Corps ── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          patient={p}
          current={page}
          onChange={setPage}
          validatedSteps={validatedSteps}
          onOpenDicom={() => setDicomOpen(true)}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <WorkflowProgress
            current={page}
            onChange={setPage}
            completions={completions}
            collapsed={planningDone ? new Set(['step-1']) : new Set()}
            onOpenDicom={() => setDicomOpen(true)}
            sessionNum={sessionNum}
            totalSeances={p.totalSeances}
          />

          <div className="flex-1 overflow-y-auto p-6">
            {page === 'step-1' && (
              <>
                <StepPlanning
                  patient={p}
                  canUpload={droits.peutCharger}
                  locked={validatedSteps.has('step-1')}
                />
                <StepValidateBar
                  validated={validatedSteps.has('step-1')}
                  onValidate={() => validate('step-1')}
                  onUnvalidate={() => unvalidate('step-1')}
                  nextLabel={stepNextLabel['step-1']}
                  onNext={() => { validate('step-1'); setPage('step-2') }}
                  canValidate={droits.peutValiderEtape}
                />
              </>
            )}

            {page === 'step-2' && (
              <>
                <StepIRM
                  canDecide={droits.peutDeciderVoie}
                  canUpload={droits.peutCharger}
                  onGoToDecision={() => setActiveModal('moment-B')}
                />
                <StepValidateBar
                  validated={validatedSteps.has('step-2')}
                  onValidate={() => validate('step-2')}
                  onUnvalidate={() => unvalidate('step-2')}
                  nextLabel={stepNextLabel['step-2']}
                  onNext={goToAdaptation}
                  canValidate={droits.peutValiderEtape}
                />
              </>
            )}

            {page === 'step-3' && (
              <>
                <StepAdaptation
                  canUpload={droits.peutCharger}
                  onGoToConstraints={() => setActiveModal('moment-C')}
                  onGoToReport={() => setActiveModal('moment-D')}
                />
                <StepValidateBar
                  validated={validatedSteps.has('step-3')}
                  onValidate={() => validate('step-3')}
                  onUnvalidate={() => unvalidate('step-3')}
                  nextLabel={stepNextLabel['step-3']}
                  onNext={() => { validate('step-3'); setPage('step-4') }}
                  canValidate={droits.peutValiderEtape}
                />
              </>
            )}

            {page === 'step-4' && (
              <>
                <StepGating patient={p} sessionNum={sessionNum} />
                <StepValidateBar
                  validated={validatedSteps.has('step-4')}
                  onValidate={() => { validate('step-4'); terminerSeance() }}
                  onUnvalidate={() => { unvalidate('step-4'); setWorkflowDone(false) }}
                  canValidate={droits.peutValiderEtape}
                />

                {workflowDone && validatedSteps.has('step-4') && (
                  <div className="max-w-4xl mx-auto w-full bg-app-sidebar rounded-3xl px-6 py-5 text-white flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-ok text-white flex items-center justify-center text-xs">✓</span>
                        Séance {sessionNum} terminée — voie {decision ?? '—'}
                      </div>
                      <div className="text-sm opacity-70 mt-1">
                        {sessionNum < p.totalSeances ? (
                          <>
                            L'évaluation inter-séance de la séance {sessionNum} reste à valider (moment A).
                            Prochaine séance{' '}
                            <strong className="opacity-100">
                              {prochaineSeance ? formatDateCourte(prochaineSeance) : 'à planifier'}
                            </strong>{' '}
                            — le tableau de bord est à jour.
                          </>
                        ) : (
                          <>Dernière séance du protocole — le rapport de fin de traitement est disponible.</>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {sessionNum < p.totalSeances && (
                        <label className="flex flex-col gap-1 mr-2">
                          <span className="text-xs opacity-60">Prochaine séance</span>
                          <input
                            type="date"
                            value={prochaineSeance}
                            onChange={e => changerProchaineSeance(e.target.value)}
                            disabled={!droits.peutValiderEtape}
                            className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-clinical disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </label>
                      )}
                      <button
                        onClick={() => setActiveModal('moment-A')}
                        title="Qualité de l'IRM, déformation, dose retenue et cumul de la séance"
                        className="text-sm font-semibold px-4 py-2.5 rounded-2xl border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
                      >
                        Récap de la séance
                      </button>
                      {sessionNum < p.totalSeances ? (
                        <button
                          onClick={startNextSession}
                          className="flex items-center gap-2 bg-clinical hover:bg-clinical-mid text-white text-sm font-semibold px-4 py-2.5 rounded-2xl transition-colors"
                        >
                          Démarrer la séance {sessionNum + 1}
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveModal('moment-D')}
                          className="bg-clinical hover:bg-clinical-mid text-white text-sm font-semibold px-4 py-2.5 rounded-2xl transition-colors"
                        >
                          Ouvrir le rapport final
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tiroir DIMADOSE ── */}
      <DimadoseDrawer
        open={activeModal}
        onClose={() => setActiveModal(null)}
        onAtsConfirmed={() => setActiveModal('moment-C')}
      />

      {/* ── Dossier DICOM ── */}
      {dicomOpen && <DicomRecap patient={p} onClose={() => setDicomOpen(false)} />}

      {/* ── Réinitialisation du dossier ── */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-app-sidebar/60 backdrop-blur-sm" onClick={() => setResetOpen(false)} />
          <div className="relative bg-white rounded-3xl w-full max-w-md overflow-hidden">
            <div className="bg-app-sidebar px-6 py-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-0.5">
                Réinitialisation
              </div>
              <div className="text-lg font-bold">{p.nom} {p.prenom}</div>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Effacer l'état enregistré de ce dossier et revenir au scénario de démonstration :
                verdicts révisés, modes de sommation, doses retenues, contraintes ajustées, décision
                du jour et journal de traçabilité ({d.trace.length} action(s)).
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-500">
                L'historique des séances S1 à S3 décrit par le dossier reste en place : c'est une
                donnée du patient, pas une action de cette session.
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    d.reinitialiser()
                    setValidatedSteps(new Set())
                    setWorkflowDone(false)
                    setActiveModal(null)
                    setPage('step-2')
                    setResetOpen(false)
                  }}
                  className="flex-1 bg-danger hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-2xl transition-colors"
                >
                  Réinitialiser
                </button>
                <button
                  onClick={() => setResetOpen(false)}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold py-2.5 rounded-2xl transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Décision clinique ATP / ATS ── */}
      {decisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-app-sidebar/60 backdrop-blur-sm" onClick={() => setDecisionModalOpen(false)} />
          <div className="relative bg-white rounded-3xl w-full max-w-lg overflow-hidden">
            <div className="bg-app-sidebar px-6 py-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-0.5">
                Décision clinique — Séance {sessionNum}
              </div>
              <div className="text-lg font-bold">Adaptation ATP ou ATS ?</div>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="text-sm text-slate-500 leading-relaxed">
                La décision d'adaptation doit être validée par le{' '}
                <strong className="text-slate-700">radiothérapeute</strong> avant de poursuivre.
                DIMADOSE recommande <strong className={reco.voie === 'ATS' ? 'text-warn' : 'text-ok'}>{reco.voie}</strong>{' '}
                pour cette séance (confiance {reco.confiance}).
              </div>

              {!droits.peutDeciderVoie ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-500">
                  Votre profil ne permet pas de valider la décision clinique. Un radiothérapeute doit
                  trancher entre ATP et ATS.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(['ATP', 'ATS'] as Voie[]).map(v => (
                    <button
                      key={v}
                      onClick={() => confirmDecision(v)}
                      className={`flex flex-col items-start px-4 py-4 rounded-2xl border-2 text-left transition-all ${
                        v === reco.voie
                          ? 'bg-clinical-light border-clinical hover:bg-clinical hover:text-white group'
                          : 'bg-slate-50 border-slate-200 hover:border-clinical/50'
                      }`}
                    >
                      <div className={`text-base font-bold ${v === reco.voie ? 'text-clinical group-hover:text-white' : 'text-slate-700'}`}>
                        {v}
                        {v === reco.voie && <span className="text-xs font-normal ml-1.5">recommandé</span>}
                      </div>
                      <div className={`text-xs mt-1 leading-tight ${v === reco.voie ? 'text-clinical/70 group-hover:text-white/80' : 'text-slate-400'}`}>
                        {v === 'ATP'
                          ? 'Adapt To Position — décalage table, plan de référence appliqué'
                          : 'Adapt To Shape — recontourage + réoptimisation'}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setDecisionModalOpen(false); setActiveModal('moment-B') }}
                className="text-xs text-clinical hover:underline self-center"
              >
                Voir la justification complète (moment B)
              </button>
              <button
                onClick={() => setDecisionModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors self-center"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
