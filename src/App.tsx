import { useCallback, useEffect, useRef, useState } from 'react'
import LoginScreen from './components/LoginScreen'
import DimadoseLogo from './components/DimadoseLogo'
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
import QualifierSeance from './components/QualifierSeance'
import StepDonneesSupplementaires from './components/steps/StepDonneesSupplementaires'
import DecisionModal from './components/DecisionModal'
import RecapSeancePrecedente from './components/RecapSeancePrecedente'
import { DossierProvider, useDossier } from './store'
import { comptesInitiaux, libellesRoles, type Compte, type Role, type Voie } from './data'
import { droits as calculerDroits, etatApresSeance, formatDateCourte, formatHorodatage } from './logic'
import {
  chargerComptes,
  chargerListePatients,
  sauvegarderComptes,
  sauvegarderListePatients,
} from './persistence'

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
  'step-4': 'Passer aux données supplémentaires',
  'step-5': 'Terminer le workflow',
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

  // Annuaire des comptes : la tracabilite nomme une personne, donc l'annuaire
  // doit survivre au rechargement comme la liste des patients.
  const [comptes, setComptes] = useState<Compte[]>(() => {
    const enregistres = chargerComptes<Compte>()
    if (!enregistres) return comptesInitiaux
    // Un annuaire enregistré avant l'ajout d'un profil ne le contiendrait pas :
    // le profil resterait invisible sur les postes déjà utilisés. On complète
    // par identifiant, sans toucher aux comptes existants ni à leur statut.
    const connus = new Set(enregistres.map(c => c.identifiant))
    return [...enregistres, ...comptesInitiaux.filter(c => !connus.has(c.identifiant))]
  })

  useEffect(() => { sauvegarderListePatients(patients) }, [patients])
  useEffect(() => { sauvegarderComptes(comptes) }, [comptes])

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
    return (
      <LoginScreen
        comptes={comptes}
        onCreerCompte={compte => setComptes(prev => [...prev, compte])}
        onLogin={u => { setUser(u); setView('dashboard') }}
      />
    )
  }

  if (view === 'dashboard' || !patient) {
    return (
      <Dashboard
        patients={patients}
        setPatients={setPatients}
        comptes={comptes}
        setComptes={setComptes}
        onSelectPatient={handleSelectPatient}
        userName={user.name}
        userRole={libellesRoles[user.role]}
        utilisateur={{ nom: user.name, role: user.role }}
        readOnly={calculerDroits(user.role).lectureSeule}
        voitIdentite={calculerDroits(user.role).voitIdentitePatient}
        peutGererPatients={calculerDroits(user.role).peutGererPatients}
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
      machine={patient.machine}
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
  /**
   * La décision a été vue pour la séance en cours.
   *
   * Sans cela, un dossier dont la voie est déjà enregistrée — c'est le cas de
   * toutes les séances du scénario de démonstration — passait à l'adaptation
   * sans que rien ne soit demandé. La décision est le pivot du flux : on y
   * passe une fois par séance, quitte à confirmer ce qui est déjà là. Ensuite
   * on circule librement.
   */
  const [decisionVue, setDecisionVue] = useState(false)

  /**
   * Fenêtre de qualification, ouverte par « Finaliser la séance ».
   *
   * La séance n'entre au dossier qu'une fois qualifiée : c'est le seul moment
   * où l'on demande à l'équipe de dire, d'un mot, comment ça s'est passé.
   */
  const [qualificationOuverte, setQualificationOuverte] = useState(false)
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

  /**
   * Ouvrir la séance suivante : le planning initial reste acquis, on reprend à
   * l'IRM du jour.
   *
   * Déclenché en rouvrant le dossier après une séance finalisée : la fiche
   * patient a avancé, le dossier la rattrape. C'est là, et non à la fin du
   * workflow, que la séance suivante commence — on repasse par le tableau de
   * bord entre deux séances, comme dans le service.
   */
  const startNextSession = useCallback(() => {
    d.setSeanceCourante(p.seanceCourante)
    setDecisionVue(false)
    setValidatedSteps(new Set(['step-1']))
    setWorkflowDone(false)
    setActiveModal(null)
    setPage('step-2')
  }, [d, p.seanceCourante])

  /**
   * La fiche patient était déjà en avance à l'ouverture du dossier : la séance
   * d'après est à ouvrir.
   *
   * On compare à l'écart constaté **au montage**, et non à l'écart courant :
   * finaliser une séance creuse le même écart, et le rattrapage se
   * déclencherait aussitôt, fermant le rapport qu'on vient d'ouvrir. La séance
   * suivante s'ouvre en revenant au dossier, pas en le quittant.
   */
  const ecartAuMontage = useRef(p.seanceCourante - d.seanceCourante)
  const rattrapageFait = useRef(false)
  useEffect(() => {
    if (rattrapageFait.current || ecartAuMontage.current <= 0) return
    rattrapageFait.current = true
    if (p.seanceCourante <= p.totalSeances) startNextSession()
  }, [p.seanceCourante, p.totalSeances, startNextSession])

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

  // Valider une étape est un acte : il part au journal, une seule fois.
  const validate = (step: Page) => {
    if (validatedSteps.has(step)) return
    d.validerEtape(step, true)
    setValidatedSteps(prev => new Set([...prev, step]))
  }

  const unvalidate = (step: Page) => {
    if (!validatedSteps.has(step)) return
    d.validerEtape(step, false)
    setValidatedSteps(prev => { const s = new Set(prev); s.delete(step); return s })
  }

  /**
   * Toute navigation du workflow passe par ici.
   *
   * L'adaptation ne peut pas s'ouvrir sans que la voie soit tranchée : c'est
   * la décision qui dit ce que l'étape fera — un décalage de table, ou un
   * recontourage et une réoptimisation. La fenêtre s'ouvre donc quelle que
   * soit la route empruntée : le bouton du bas, la barre latérale ou le
   * bandeau du haut. Sans ce point de passage unique, deux routes sur trois
   * l'évitaient.
   */
  /**
   * La barrière ne vaut que pour qui peut trancher.
   *
   * Un physicien ou un manipulateur ne décide pas de la voie (§2 du brief) :
   * la leur opposer les empêcherait d'ouvrir l'adaptation, y compris sur une
   * séance déjà décidée. Ils y accèdent librement et lisent la décision prise.
   */
  const decisionRequise = droits.peutDeciderVoie && !decisionVue

  const ORDRE: Page[] = ['step-1', 'step-2', 'step-3', 'step-4', 'step-5']

  /**
   * Revenir à l'étape précédente en annulant celle-ci.
   *
   * « Annuler » au sens propre : la validation de l'étape quittée est levée,
   * et le journal l'enregistre. Rien d'autre n'est perdu — les saisies restent.
   */
  const revenirEnArriere = () => {
    const i = ORDRE.indexOf(page)
    if (i <= 0) return
    unvalidate(page)
    if (page === 'step-3') setWorkflowDone(false)
    setPage(ORDRE[i - 1])
  }

  const allerA = (cible: Page) => {
    if (cible === 'step-3' && decisionRequise) { setDecisionModalOpen(true); return }
    setPage(cible)
  }

  // Le bouton de bas d'étape valide l'IRM du jour au passage.
  const goToAdaptation = () => {
    if (decisionRequise) { setDecisionModalOpen(true); return }
    validate('step-2'); setPage('step-3')
  }

  const confirmDecision = (v: Voie) => {
    // Reconfirmer à l'identique n'est pas une nouvelle décision : ne pas
    // encombrer le journal d'une ligne qui ne change rien.
    if (v !== decision) {
      d.enregistrerVoie(
        sessionNum,
        v,
        v === reco.voie ? undefined : ['Décision prise depuis le workflow, hors écran de recommandation'],
      )
    }
    setDecisionVue(true)
    setDecisionModalOpen(false)
    validate('step-2')
    setPage('step-3')
  }

  const completions: Record<Page, number> = {
    'step-1': validatedSteps.has('step-1') ? 100 : 0,
    'step-2': validatedSteps.has('step-2') ? 100 : 0,
    'step-3': validatedSteps.has('step-3') ? 100 : 0,
    'step-4': validatedSteps.has('step-4') ? 100 : 0,
    // L'étape 5 ne se valide pas : elle est faite quand la séance est finalisée.
    'step-5': workflowDone ? 100 : 0,
  }

  const planningDone = validatedSteps.has('step-1') || sessionNum > 1

  return (
    <div className="h-screen flex flex-col font-sans text-slate-900 bg-app-bg overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-app-sidebar border-b border-white/5 h-12 flex items-center justify-between px-5 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <DimadoseLogo width={140} variant="light" symbole />
          <span className="text-white/20 text-xs">·</span>
          <button
            onClick={onBackToDashboard}
            className="text-xs text-white/40 hover:text-white/80 transition-colors"
          >
            Tableau de bord
          </button>
          <span className="text-white/20 text-xs">/</span>
          <span className="text-xs text-white/90 font-medium truncate max-w-48">
            {d.identite(p).libelle}
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
          onChange={allerA}
          validatedSteps={validatedSteps}
          onOpenDicom={() => setDicomOpen(true)}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <WorkflowProgress
            current={page}
            onChange={allerA}
            completions={completions}
            collapsed={planningDone ? new Set(['step-1']) : new Set()}
            onOpenDicom={() => setDicomOpen(true)}
            sessionNum={sessionNum}
            totalSeances={p.totalSeances}
          />

          <div className="flex-1 overflow-y-auto p-6">
            <RecapSeancePrecedente seance={sessionNum} />

            {page === 'step-1' && (
              <>
                <StepPlanning
                  patient={p}
                  canUpload={droits.peutCharger}
                  locked={validatedSteps.has('step-1')}
                />
                <StepValidateBar
                  validated={validatedSteps.has('step-1')}
                  seance={sessionNum}
                  etape="step-1"
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
                  seance={sessionNum}
                  etape="step-2"
                  onValidate={() => validate('step-2')}
                  onUnvalidate={() => unvalidate('step-2')}
                  nextLabel={stepNextLabel['step-2']}
                  onNext={goToAdaptation}
                  canValidate={droits.peutValiderEtape}
                  onBack={revenirEnArriere}
                />
              </>
            )}

            {page === 'step-3' && (
              <>
                <StepAdaptation
                  canUpload={droits.peutCharger}
                  onGoToReport={() => setActiveModal('moment-D')}
                />
                <StepValidateBar
                  validated={validatedSteps.has('step-3')}
                  seance={sessionNum}
                  etape="step-3"
                  onValidate={() => validate('step-3')}
                  onUnvalidate={() => unvalidate('step-3')}
                  nextLabel={stepNextLabel['step-3']}
                  onNext={() => { validate('step-3'); setPage('step-4') }}
                  canValidate={droits.peutValiderEtape}
                  onBack={revenirEnArriere}
                />
              </>
            )}

            {page === 'step-4' && (
              <>
                <StepGating patient={p} sessionNum={sessionNum} peutSaisir={droits.peutValiderEtape} />
                <StepValidateBar
                  validated={validatedSteps.has('step-4')}
                  seance={sessionNum}
                  etape="step-4"
                  onValidate={() => validate('step-4')}
                  onUnvalidate={() => unvalidate('step-4')}
                  nextLabel={stepNextLabel['step-4']}
                  onNext={() => { validate('step-4'); setPage('step-5') }}
                  canValidate={droits.peutValiderEtape}
                  onBack={revenirEnArriere}
                />

              </>
            )}

            {page === 'step-5' && (
              <>
                <StepDonneesSupplementaires
                  sessionNum={sessionNum}
                  totalSeances={p.totalSeances}
                  voie={decision ?? null}
                  finalisee={workflowDone}
                  prochaineSeance={prochaineSeance}
                  onChangerProchaineSeance={changerProchaineSeance}
                  onFinaliser={() => setQualificationOuverte(true)}
                  onConsulterRapport={() => setActiveModal('moment-D')}
                  onCloturer={onBackToDashboard}
                  peutSaisir={droits.peutValiderEtape}
                />

                {/* Pas de barre de validation : la séance est délivrée, il n'y a
                    plus rien à vérifier avant la suite. Seulement le retour. */}
                <div className="max-w-4xl mx-auto mt-4">
                  <button
                    onClick={revenirEnArriere}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Annuler et revenir à l'étape précédente
                  </button>
                </div>
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
              <div className="text-lg font-bold">{d.identite(p).libelle}</div>
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

      {/* ── Qualification de la séance — passage obligé de la finalisation ── */}
      {qualificationOuverte && (
        <QualifierSeance
          seance={sessionNum}
          peutQualifier={droits.peutValiderEtape}
          onEnregistre={() => { setQualificationOuverte(false); terminerSeance() }}
          onFermer={() => setQualificationOuverte(false)}
        />
      )}

      {/* ── Décision clinique ATP / ATS — passage obligé vers l'adaptation ── */}
      {decisionModalOpen && (
        <DecisionModal
          seance={sessionNum}
          reco={reco}
          decisionEnregistree={decision}
          peutDecider={droits.peutDeciderVoie}
          onChoisir={confirmDecision}
          onVoirAnalyse={() => { setDecisionModalOpen(false); setActiveModal('moment-B') }}
          onFermer={() => setDecisionModalOpen(false)}
        />
      )}
    </div>
  )
}
