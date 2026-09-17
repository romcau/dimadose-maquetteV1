import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import DicomRecap from './DicomRecap'
import DimadoseLogo from './DimadoseLogo'
import SessionRecap from './SessionRecap'
import { DossierProvider, alertesPourDossier } from '../store'
import { versionCourte, versionDetaillee } from '../version'
import { libellesRoles, nomAffiche, type Compte, type Role } from '../data'
import { effacer as effacerDossierEnregistre, effacerListePatients } from '../persistence'

/**
 * Seul ce dossier possède des mesures par séance : ses alertes sont donc
 * calculées par le moteur, à partir de l'état enregistré, comme dans les
 * écrans. Les autres patients de la liste restent illustratifs.
 */
const DOSSIER_MESURE = 'P-2024-0148'

function alertesAffichees(p: PatientRecord): string[] {
  if (p.id !== DOSSIER_MESURE) return p.alertes
  const { alertes } = alertesPourDossier(p.id, p.seanceCourante)
  return alertes.filter(a => a.niveau === 'danger').map(a => a.texte)
}

export interface PatientRecord {
  id: string
  nom: string
  prenom: string
  ddn: string
  protocole: string
  prescription: string
  seanceCourante: number
  totalSeances: number
  dernierSeanceDate: string
  prochaineSeanceDate: string
  statut: 'en-cours' | 'termine' | 'planification' | 'en-attente'
  action: 'validation-requise' | 'decision-en-seance' | 'rapport-disponible' | 'planification' | 'aucune'
  confiance: 'haute' | 'moyenne' | 'faible' | null
  alertes: string[]
  medecin: string
  physicien: string
  dernierePar?: string
  historique?: { etape: string; par: string; date: string }[]
}

export const patientsDemo: PatientRecord[] = [
  {
    id: 'P-2024-0148',
    nom: 'DUPONT',
    prenom: 'Michel',
    ddn: '12/03/1948',
    protocole: 'Prostate',
    prescription: '36,25 Gy / 5 fr',
    seanceCourante: 4,
    totalSeances: 5,
    dernierSeanceDate: '30 août 2026',
    prochaineSeanceDate: "Aujourd'hui",
    statut: 'en-cours',
    action: 'decision-en-seance',
    confiance: 'faible',
    alertes: ['Rectum D0.5cc : +2,4 Gy au-dessus du prévisionnel', 'Déformation importante à S3 (confiance faible)'],
    medecin: 'Dr Fontaine',
    physicien: 'Mme Korhonen',
  },
  {
    id: 'P-2024-0162',
    nom: 'MARTIN',
    prenom: 'Claire',
    ddn: '07/09/1961',
    protocole: 'Prostate',
    prescription: '36,25 Gy / 5 fr',
    seanceCourante: 2,
    totalSeances: 5,
    dernierSeanceDate: '29 août 2026',
    prochaineSeanceDate: '04 sept. 2026',
    statut: 'en-cours',
    action: 'validation-requise',
    confiance: 'haute',
    alertes: [],
    medecin: 'Dr Fontaine',
    physicien: 'Mme Korhonen',
  },
  {
    id: 'P-2024-0171',
    nom: 'LEFEBVRE',
    prenom: 'Jean',
    ddn: '22/11/1955',
    protocole: 'Prostate',
    prescription: '36,25 Gy / 5 fr',
    seanceCourante: 5,
    totalSeances: 5,
    dernierSeanceDate: '28 août 2026',
    prochaineSeanceDate: '—',
    statut: 'termine',
    action: 'rapport-disponible',
    confiance: 'haute',
    alertes: [],
    medecin: 'Dr Marchand',
    physicien: 'M. Dupas',
  },
  {
    id: 'P-2024-0183',
    nom: 'BERNARD',
    prenom: 'Sophie',
    ddn: '14/06/1970',
    protocole: 'Col de l’utérus',
    prescription: '45 Gy / 25 fr',
    seanceCourante: 1,
    totalSeances: 25,
    dernierSeanceDate: '01 sept. 2026',
    prochaineSeanceDate: '05 sept. 2026',
    statut: 'en-cours',
    action: 'validation-requise',
    confiance: 'haute',
    alertes: [],
    medecin: 'Dr Marchand',
    physicien: 'Mme Korhonen',
  },
  {
    id: 'P-2024-0194',
    nom: 'THOMAS',
    prenom: 'René',
    ddn: '03/01/1952',
    protocole: 'Prostate',
    prescription: '36,25 Gy / 5 fr',
    seanceCourante: 0,
    totalSeances: 5,
    dernierSeanceDate: '—',
    prochaineSeanceDate: '08 sept. 2026',
    statut: 'planification',
    action: 'planification',
    confiance: null,
    alertes: [],
    medecin: 'Dr Fontaine',
    physicien: 'M. Dupas',
  },
]

const actionLabels: Record<PatientRecord['action'], { label: string; style: string }> = {
  'decision-en-seance': { label: 'Décision en séance',  style: 'bg-warn-bg text-warn border border-warn-border' },
  'validation-requise': { label: 'Validation requise',  style: 'bg-clinical-light text-clinical border border-clinical-border' },
  'rapport-disponible': { label: 'Rapport disponible',  style: 'bg-ok-bg text-ok border border-ok-border' },
  'planification':      { label: 'En planification',    style: 'bg-slate-100 text-slate-500 border border-slate-200' },
  'aucune':             { label: '—',                   style: 'text-slate-400' },
}

// Étapes du workflow (3) et position courante selon l'action du patient
const workflowStepLabels = ['Planning', 'IRM du jour', 'Adaptation']
const workflowStepIndex: Record<PatientRecord['action'], number> = {
  'planification':      0,
  'validation-requise': 1,
  'decision-en-seance': 2,
  'rapport-disponible': 3,
  'aucune':             1,
}

const statutStyles: Record<PatientRecord['statut'], string> = {
  'en-cours':     'bg-clinical-light text-clinical border border-clinical-border',
  'termine':      'bg-ok-bg text-ok-text border border-ok-border',
  'planification':'bg-slate-100 text-slate-500 border border-slate-200',
  'en-attente':   'bg-warn-bg text-warn-text border border-warn-border',
}

const statutLabels: Record<PatientRecord['statut'], string> = {
  'en-cours':     'En cours',
  'termine':      'Terminé',
  'planification':'Planification',
  'en-attente':   'En attente',
}

// Deux localisations traitées par la plateforme. Dose et fractionnement sont des
// valeurs de départ proposées, pas une règle : l'hypofractionnement est un choix
// clinique, les deux champs restent librement modifiables.
const localisations = [
  { label: 'Prostate',        doseGy: '36,25', fractions: '5'  },
  { label: 'Col de l’utérus', doseGy: '45',    fractions: '25' },
]

interface AddPatientForm {
  nom: string
  prenom: string
  ddn: string
  localisation: string
  /** Dose totale prescrite, en Gy. */
  doseGy: string
  /** Nombre de fractions du protocole. Indépendant de la dose. */
  nbFractions: string
  premiereSeance: string
}

const emptyForm: AddPatientForm = {
  nom: '', prenom: '', ddn: '',
  localisation: localisations[0].label,
  doseGy: localisations[0].doseGy,
  nbFractions: localisations[0].fractions,
  premiereSeance: '',
}

/** Dose par fraction, seule valeur réellement déduite des deux autres. */
function doseParFraction(doseGy: string, nbFractions: string): string | null {
  const dose = parseFloat(doseGy.replace(',', '.'))
  const n = parseInt(nbFractions, 10)
  if (!isFinite(dose) || dose <= 0 || !n || n <= 0) return null
  return (dose / n).toFixed(2).replace('.', ',')
}

interface Props {
  patients: PatientRecord[]
  setPatients: Dispatch<SetStateAction<PatientRecord[]>>
  /** Annuaire partagé avec l'écran de connexion. */
  comptes: Compte[]
  setComptes: Dispatch<SetStateAction<Compte[]>>
  onSelectPatient: (p: PatientRecord) => void
  userName: string
  userRole: string
  readOnly?: boolean
  onLogout: () => void
}

type NavPage = 'dashboard' | 'utilisateurs'

const roleColors: Record<Role, string> = {
  physicien:    'bg-clinical-light text-clinical border border-clinical-border',
  medecin:      'bg-blue-50 text-blue-700 border border-blue-200',
  manipulateur: 'bg-slate-100 text-slate-600 border border-slate-200',
}


const compteVide: Compte = {
  identifiant: '',
  titre: '',
  nom: '',
  prenom: '',
  role: 'physicien',
  email: '',
  statut: 'actif',
}

interface UsersPageProps {
  comptes: Compte[]
  setComptes: Dispatch<SetStateAction<Compte[]>>
  readOnly?: boolean
}

/**
 * Annuaire du service. C'est la même liste que celle de l'écran de connexion :
 * désactiver un compte ici empêche la connexion, et un compte créé à la
 * connexion apparaît ici.
 */
function UsersPage({ comptes, setComptes, readOnly = false }: UsersPageProps) {
  const [modal, setModal] = useState<{ open: boolean; idx: number | null }>({ open: false, idx: null })
  const [form, setForm] = useState<Compte>(compteVide)
  const [err, setErr] = useState('')

  function openAdd() { setForm({ ...compteVide }); setErr(''); setModal({ open: true, idx: null }) }
  function openEdit(i: number) { setForm({ ...comptes[i] }); setErr(''); setModal({ open: true, idx: i }) }
  function closeModal() { setModal({ open: false, idx: null }) }

  function handleSave() {
    if (!form.nom.trim() || !form.prenom.trim() || !form.identifiant.trim()) {
      setErr('Nom, prénom et identifiant sont obligatoires.')
      return
    }
    const identifiant = form.identifiant.trim().toLowerCase()
    const doublon = comptes.some((c, i) => i !== modal.idx && c.identifiant.toLowerCase() === identifiant)
    if (doublon) {
      setErr('Cet identifiant est déjà utilisé par un autre compte.')
      return
    }
    const compte: Compte = {
      ...form,
      identifiant,
      titre: form.titre?.trim() || undefined,
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      email: form.email.trim() || `${identifiant}@chu.fr`,
    }
    if (modal.idx === null) {
      setComptes(prev => [...prev, compte])
    } else {
      setComptes(prev => prev.map((c, i) => (i === modal.idx ? compte : c)))
    }
    closeModal()
  }

  function toggleStatut(i: number) {
    setComptes(prev => prev.map((c, idx) =>
      idx === i ? { ...c, statut: c.statut === 'actif' ? 'inactif' : 'actif' } : c
    ))
  }

  const actifs = comptes.filter(c => c.statut === 'actif').length

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-2xl font-bold text-slate-800">Gestion des utilisateurs</div>
          <div className="text-sm text-slate-400 mt-1">
            {actifs} compte{actifs > 1 ? 's' : ''} actif{actifs > 1 ? 's' : ''} sur {comptes.length}
            {' · '}les actions du journal de traçabilité portent ces noms
          </div>
        </div>
        {!readOnly && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-clinical hover:bg-clinical-mid text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter un utilisateur
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {['Utilisateur', 'Identifiant', 'Rôle', 'Email', 'Statut', ''].map((h, i) => (
                <th key={i} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comptes.map((c, i) => (
              <tr key={c.identifiant || i} className="border-b border-slate-50 hover:bg-clinical-light/30 transition-colors group">
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-slate-800">{c.nom} {c.prenom}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Traçabilité : <span className="font-medium text-slate-500">{nomAffiche(c)}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-600 font-mono">{c.identifiant}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleColors[c.role]}`}>
                    {libellesRoles[c.role]}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">{c.email}</td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => !readOnly && toggleStatut(i)}
                    disabled={readOnly}
                    title={c.statut === 'actif' ? 'Désactiver — le compte ne pourra plus se connecter' : 'Réactiver le compte'}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
                      c.statut === 'actif'
                        ? `bg-ok-bg text-ok-text border border-ok-border ${readOnly ? '' : 'hover:bg-ok-border'}`
                        : `bg-slate-100 text-slate-400 border border-slate-200 ${readOnly ? '' : 'hover:bg-slate-200'}`
                    }`}
                  >
                    {c.statut === 'actif' ? 'Actif' : 'Inactif'}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {!readOnly && (
                    <button
                      onClick={() => openEdit(i)}
                      className="text-xs text-slate-400 hover:text-clinical font-medium transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Modifier
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
          Le socle web multi-utilisateurs est un composant existant : cet annuaire sert la
          traçabilité, la maquette ne gère pas les mots de passe.
        </div>
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-app-sidebar/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-md">
            <div className="text-lg font-bold text-slate-800 mb-5">
              {modal.idx === null ? 'Nouvel utilisateur' : "Modifier l'utilisateur"}
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[80px_1fr_1fr] gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Titre</label>
                  <input
                    value={form.titre ?? ''}
                    onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-clinical focus:ring-1 focus:ring-clinical/30 outline-none"
                    placeholder="Dr"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Nom</label>
                  <input
                    value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-clinical focus:ring-1 focus:ring-clinical/30 outline-none"
                    placeholder="DUPONT"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Prénom</label>
                  <input
                    value={form.prenom}
                    onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-clinical focus:ring-1 focus:ring-clinical/30 outline-none"
                    placeholder="Marie"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Identifiant</label>
                  <input
                    value={form.identifiant}
                    onChange={e => setForm(f => ({ ...f, identifiant: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-clinical focus:ring-1 focus:ring-clinical/30 outline-none font-mono"
                    placeholder="m.dupont"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-clinical focus:ring-1 focus:ring-clinical/30 outline-none"
                    placeholder="m.dupont@chu.fr"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Rôle</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-clinical focus:ring-1 focus:ring-clinical/30 outline-none bg-white"
                >
                  {(['physicien', 'medecin', 'manipulateur'] as Role[]).map(r => (
                    <option key={r} value={r}>{libellesRoles[r]}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1.5">
                  Le rôle fixe les droits : seul le radiothérapeute tranche la décision ATP / ATS.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-2 block">Statut</label>
                <div className="flex gap-2">
                  {(['actif', 'inactif'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setForm(f => ({ ...f, statut: s }))}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                        form.statut === s
                          ? s === 'actif'
                            ? 'bg-ok-bg text-ok-text border-ok-border'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {s === 'actif' ? 'Actif' : 'Inactif'}
                    </button>
                  ))}
                </div>
              </div>

              {err && <div className="text-xs text-danger font-medium">{err}</div>}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 text-xs font-semibold bg-clinical hover:bg-clinical-mid text-white rounded-xl transition-colors"
              >
                {modal.idx === null ? 'Créer' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const navItems: { id: NavPage; label: string; sub: string; icon: ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Mon dashboard',
    sub: 'Patients & workflow',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    id: 'utilisateurs',
    label: 'Gestion des utilisateurs',
    sub: 'Équipes & permissions',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
]

export default function Dashboard({
  patients,
  setPatients,
  comptes,
  setComptes,
  onSelectPatient,
  userName,
  userRole,
  readOnly = false,
  onLogout,
}: Props) {
  const [navPage, setNavPage] = useState<NavPage>('dashboard')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'tous' | PatientRecord['statut']>('tous')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<AddPatientForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [dicomPatient, setDicomPatient] = useState<PatientRecord | null>(null)
  const [recapPatient, setRecapPatient] = useState<PatientRecord | null>(null)
  const [aSupprimer, setASupprimer] = useState<PatientRecord | null>(null)

  // Le titre de l'en-tête suit la page ouverte : « Tableau de bord » figé était
  // faux dès qu'on allait dans le guide ou la gestion des utilisateurs.
  const pageCourante = navItems.find(i => i.id === navPage) ?? navItems[0]

  // Comparer aussi le contenu : jouer des séances modifie les dossiers sans
  // toucher à la composition de la liste, et il faut pouvoir revenir au
  // scénario de référence dans ce cas aussi.
  const listeModifiee = JSON.stringify(patients) !== JSON.stringify(patientsDemo)

  /**
   * Rétablir la démonstration, c'est remettre la liste *et* l'état de chaque
   * dossier : sinon la ligne annonce une séance et le dossier en montre une
   * autre, parce que les décisions enregistrées survivent à la liste.
   */
  const retablirListeDemo = () => {
    effacerListePatients()
    for (const p of [...patients, ...patientsDemo]) effacerDossierEnregistre(p.id)
    setPatients(patientsDemo)
  }

  // Retirer un patient de la liste efface aussi son état enregistré : décisions
  // et journal de traçabilité partent avec le dossier, pas d'orphelin.
  const supprimerPatient = (patient: PatientRecord) => {
    setPatients(prev => prev.filter(x => x.id !== patient.id))
    effacerDossierEnregistre(patient.id)
    if (dicomPatient?.id === patient.id) setDicomPatient(null)
    if (recapPatient?.id === patient.id) setRecapPatient(null)
    setASupprimer(null)
  }

  const filtered = patients.filter(p => {
    const matchSearch =
      !search.trim() ||
      p.nom.toLowerCase().includes(search.toLowerCase()) ||
      p.prenom.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'tous' || p.statut === filter
    return matchSearch && matchFilter
  })

  const urgents = patients.filter(p => p.action === 'decision-en-seance' || p.alertes.length > 0)
  const enCours = patients.filter(p => p.statut === 'en-cours').length
  const aValider = patients.filter(p => p.action === 'validation-requise').length

  const handleLocalisationChange = (val: string) => {
    const loc = localisations.find(l => l.label === val)
    setForm(f => ({
      ...f,
      localisation: val,
      doseGy: loc?.doseGy ?? f.doseGy,
      nbFractions: loc?.fractions ?? f.nbFractions,
    }))
  }

  const handleAddPatient = () => {
    if (!form.nom.trim() || !form.prenom.trim() || !form.ddn.trim()) {
      setFormError('Nom, prénom et date de naissance sont requis.')
      return
    }
    const dose = parseFloat(form.doseGy.replace(',', '.'))
    const fractions = parseInt(form.nbFractions, 10)
    if (!isFinite(dose) || dose <= 0) {
      setFormError('La dose prescrite doit être un nombre de Gy supérieur à zéro.')
      return
    }
    if (!fractions || fractions <= 0) {
      setFormError('Le nombre de fractions doit être supérieur à zéro.')
      return
    }
    setFormError('')
    const nextNum = String(patients.length + 200).padStart(4, '0')
    const seances = fractions
    const prescription = `${form.doseGy.trim()} Gy / ${fractions} fr`
    const newPatient: PatientRecord = {
      id: `P-2026-0${nextNum}`,
      nom: form.nom.trim().toUpperCase(),
      prenom: form.prenom.trim(),
      ddn: form.ddn,
      protocole: form.localisation,
      prescription,
      seanceCourante: 0,
      totalSeances: seances,
      dernierSeanceDate: '—',
      prochaineSeanceDate: form.premiereSeance || '—',
      statut: 'planification',
      action: 'planification',
      confiance: null,
      alertes: [],
      medecin: '',
      physicien: '',
      dernierePar: userName,
      historique: [{ etape: 'Création du dossier', par: userName, date: new Date().toLocaleDateString('fr-FR') }],
    }
    setPatients(prev => [newPatient, ...prev])
    setShowModal(false)
    setForm(emptyForm)
  }

  return (
    <div className="h-screen bg-app-bg flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <header className="bg-app-sidebar text-white h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/8">
        <div className="flex items-center gap-4 min-w-0">
          <DimadoseLogo width={160} variant="light" />
          <div className="w-px h-5 bg-white/10 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white/90 leading-tight truncate">
              {pageCourante.label}
            </div>
            <div className="text-xs text-white/35 leading-tight truncate">{pageCourante.sub}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!readOnly && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-clinical hover:bg-clinical-mid text-white text-xs font-semibold pl-3 pr-4 py-2.5 rounded-2xl transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nouveau patient
            </button>
          )}

          {/* Identité : un seul bloc, pour ne pas éparpiller nom, rôle et avatar */}
          <div className="flex items-center gap-2.5 bg-white/6 border border-white/8 rounded-2xl pl-3 pr-1.5 py-1.5">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white/90 leading-tight whitespace-nowrap">
                {userName}
              </div>
              <div className="text-xs text-white/40 leading-tight whitespace-nowrap">{userRole}</div>
            </div>
            <div
              title={`${userName} — ${userRole}`}
              className="w-8 h-8 rounded-xl bg-clinical flex items-center justify-center text-white text-xs font-bold shrink-0"
            >
              {userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="w-9 h-9 rounded-2xl flex items-center justify-center text-white/35 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Body: left nav + main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left nav ── */}
        <nav className="w-60 bg-app-sidebar flex flex-col shrink-0 border-r border-white/8">

          <div className="px-5 pt-4 pb-2 text-xs font-semibold text-white/25 uppercase tracking-wider">
            Navigation
          </div>

          <div className="flex-1 px-3 flex flex-col gap-1">
            {navItems.map(item => {
              const isCurrent = navPage === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setNavPage(item.id)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`group relative w-full flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-2xl text-left transition-colors ${
                    isCurrent ? 'bg-white/8' : 'hover:bg-white/5'
                  }`}
                >
                  {/* Repère d'état actif : un trait, pas un aplat coloré */}
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full transition-all ${
                      isCurrent ? 'h-6 bg-clinical' : 'h-0 bg-transparent'
                    }`}
                  />
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isCurrent
                      ? 'bg-clinical text-white'
                      : 'bg-white/6 text-white/35 group-hover:text-white/60'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold truncate transition-colors ${
                      isCurrent ? 'text-white' : 'text-white/65 group-hover:text-white/85'
                    }`}>
                      {item.label}
                    </div>
                    <div className={`text-xs truncate mt-0.5 transition-colors ${
                      isCurrent ? 'text-white/40' : 'text-white/25'
                    }`}>
                      {item.sub}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="px-5 py-4 border-t border-white/8">
            <div className="text-xs text-white/20 font-mono cursor-help" title={versionDetaillee()}>
              {versionCourte()}
            </div>
          </div>
        </nav>

        {/* ── Main content ── */}
        <div className="flex-1 overflow-y-auto">
          {navPage === 'utilisateurs' && <UsersPage comptes={comptes} setComptes={setComptes} readOnly={readOnly} />}
          {navPage === 'dashboard'   && (
      <main className="p-6 flex flex-col gap-5">

        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Patients actifs', val: enCours, sub: 'traitements en cours', color: 'text-clinical' },
            { label: 'À valider', val: aValider, sub: 'validations inter-séance en attente', color: 'text-clinical' },
            { label: 'Décision en séance', val: urgents.filter(p => p.action === 'decision-en-seance').length, sub: 'recommandation ATP/ATS en attente', color: 'text-warn' },
            { label: 'Alertes actives', val: urgents.filter(p => p.alertes.length > 0).length, sub: 'patients avec dérive du cumul', color: 'text-danger' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-medium mb-1">{s.label}</div>
              <div className={`text-3xl font-bold font-mono ${s.color}`}>{s.val}</div>
              <div className="text-xs text-slate-400 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Urgences ── */}
        {urgents.length > 0 && (
          <div className="bg-warn-bg border border-warn-border rounded-3xl p-4">
            <div className="text-xs font-semibold text-warn-text uppercase tracking-wider mb-3 px-1">
              Actions requises maintenant
            </div>
            <div className="flex flex-col gap-2">
              {urgents.map(p => (
                <button
                  key={p.id}
                  onClick={() => onSelectPatient(p)}
                  className="flex items-center justify-between bg-white border border-warn-border rounded-2xl px-4 py-3 hover:bg-warn-bg/50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-800 text-sm">{p.nom} {p.prenom}</span>
                    <span className="font-mono text-xs text-slate-400">{p.id}</span>
                    <span className="text-xs text-slate-500">S{p.seanceCourante}/{p.totalSeances} · {p.protocole}</span>
                    {alertesAffichees(p).slice(0, 1).map((a, i) => (
                      <span key={i} className="text-xs text-danger-text bg-danger-bg border border-danger-border px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${actionLabels[p.action].style}`}>
                      {actionLabels[p.action].label}
                    </span>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Liste patients ── */}
        <div className="bg-white rounded-3xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              {(['tous', 'en-cours', 'termine', 'planification'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    filter === f
                      ? 'bg-clinical text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {f === 'tous' ? 'Tous' :
                   f === 'en-cours' ? 'En cours' :
                   f === 'termine' ? 'Terminés' : 'Planification'}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un patient…"
              className="border border-slate-200 rounded-2xl px-4 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/10 transition-all w-56 bg-slate-50"
            />
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {['Patient', 'Localisation', 'Séance', 'Étapes', 'Dernière séance', 'Prochaine séance', 'Statut', 'Action', 'Traçabilité', 'Suivi', ''].map((h, i) => (
                  <th key={i} className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-sm text-slate-400">
                    Aucun patient trouvé
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 hover:bg-clinical-light/40 transition-colors cursor-pointer group"
                  onClick={() => onSelectPatient(p)}
                >
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-800">{p.nom} {p.prenom}</div>
                    <div className="font-mono text-xs text-slate-400 mt-0.5">{p.id} · {p.ddn}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-slate-700 font-medium text-xs">{p.protocole}</div>
                    <div className="text-slate-400 text-xs">{p.prescription}</div>
                  </td>
                  {/* Numéro de séance */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-clinical bg-clinical-light border border-clinical-border px-2 py-0.5 rounded-lg whitespace-nowrap">
                        {p.statut === 'planification' ? '—' : `S${p.seanceCourante}`}
                      </span>
                      <span className="font-mono text-xs text-slate-400">/ {p.totalSeances}</span>
                    </div>
                    {/* Largeur totale fixe, segments proportionnels : un protocole
                        hypofractionné (5 fr) et un protocole normofractionné (25 fr)
                        occupent la même place dans la colonne. */}
                    <div className={`flex mt-1.5 w-20 ${p.totalSeances > 10 ? 'gap-px' : 'gap-0.5'}`}>
                      {Array.from({ length: p.totalSeances }).map((_, i) => (
                        <div key={i} className={`flex-1 h-1.5 rounded-full ${
                          i < p.seanceCourante - 1 ? 'bg-ok' :
                          i === p.seanceCourante - 1 && p.statut !== 'planification' ? 'bg-clinical' :
                          'bg-slate-200'
                        }`} />
                      ))}
                    </div>
                  </td>
                  {/* Étape courante du workflow */}
                  <td className="px-5 py-3.5">
                    {(() => {
                      const cur = workflowStepIndex[p.action]
                      const done = cur >= workflowStepLabels.length
                      const name = done ? 'Terminé' : workflowStepLabels[cur]
                      return (
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? 'bg-ok' : 'bg-clinical'}`} />
                          <div>
                            <div className={`text-xs font-semibold ${done ? 'text-ok-text' : 'text-slate-700'}`}>{name}</div>
                            {!done && <div className="text-xs text-slate-400">Étape {cur + 1} / {workflowStepLabels.length}</div>}
                          </div>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{p.dernierSeanceDate}</td>
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                    <span className={p.prochaineSeanceDate === "Aujourd'hui" ? 'text-warn font-semibold' : 'text-slate-500'}>
                      {p.prochaineSeanceDate}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statutStyles[p.statut]}`}>
                      {statutLabels[p.statut]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {p.action !== 'aucune' && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${actionLabels[p.action].style}`}>
                        {actionLabels[p.action].label}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-xs text-slate-600">{p.dernierePar ?? p.physicien ?? '—'}</div>
                    <div className="text-xs text-slate-400">{p.dernierSeanceDate !== '—' ? p.dernierSeanceDate : 'Création'}</div>
                    <button
                      onClick={e => { e.stopPropagation(); window.print() }}
                      title="Exporter la traçabilité (PDF)"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-clinical font-medium transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" />
                      </svg>
                      PDF
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1.5 items-start">
                      <button
                        onClick={e => { e.stopPropagation(); setRecapPatient(p) }}
                        title="Récap des séances, étapes et traçabilité"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-clinical border border-clinical-border bg-clinical-light hover:bg-clinical hover:text-white px-2.5 py-1.5 rounded-xl transition-all w-full"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                        </svg>
                        Récap séances
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDicomPatient(p) }}
                        title="Voir le dossier DICOM chargé"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:text-slate-700 px-2.5 py-1.5 rounded-xl transition-all w-full"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m0 0h7.5" />
                        </svg>
                        DICOM
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {!readOnly && (
                        <button
                          onClick={e => { e.stopPropagation(); setASupprimer(p) }}
                          title={`Supprimer le dossier de ${p.nom} ${p.prenom}`}
                          aria-label={`Supprimer le dossier de ${p.nom} ${p.prenom}`}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-7 h-7 rounded-xl flex items-center justify-center text-slate-300 hover:text-danger hover:bg-danger-bg transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-clinical transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-3">
              {filtered.length} patient{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
              {listeModifiee && !readOnly && (
                <button
                  onClick={retablirListeDemo}
                  className="text-clinical hover:underline"
                  title="Remettre la liste de patients et l'état de chaque dossier du scénario de démonstration — décisions et journaux enregistrés effacés"
                >
                  Rétablir la liste de démonstration
                </button>
              )}
            </span>
            <span className="text-slate-300 italic">Dose reconstruite — non délivrée · Outil d'aide à la décision uniquement</span>
          </div>
        </div>
      </main>
          )}
        </div>{/* end main content */}
      </div>{/* end body flex */}

      {/* ── Modal ajout patient ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-app-sidebar/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-3xl w-full max-w-lg overflow-hidden">

            {/* Modal header */}
            <div className="bg-clinical px-6 py-5">
              <div className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-0.5">Nouveau patient</div>
              <div className="text-lg font-bold text-white">Créer un dossier patient</div>
            </div>

            <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

              {/* Identité */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nom *</label>
                  <input
                    value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    placeholder="NOM"
                    className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/10 transition-all uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Prénom *</label>
                  <input
                    value={form.prenom}
                    onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                    placeholder="Prénom"
                    className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Date de naissance *</label>
                <input
                  type="date"
                  value={form.ddn}
                  onChange={e => setForm(f => ({ ...f, ddn: e.target.value }))}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/10 transition-all"
                />
              </div>

              {/* Traitement */}
              <div className="border-t border-slate-100 pt-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Traitement</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Localisation</label>
                    <select
                      value={form.localisation}
                      onChange={e => handleLocalisationChange(e.target.value)}
                      className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/10 transition-all"
                    >
                      {localisations.map(l => <option key={l.label}>{l.label}</option>)}
                    </select>
                    <div className="text-xs text-slate-400 mt-1.5">
                      La localisation détermine la configuration du workflow (modes d'acquisition, structures de gating).
                    </div>
                  </div>

                  {/* Prescription : dose et fractionnement sont deux données
                      indépendantes — l'hypofractionnement est un choix clinique,
                      pas une conséquence de la dose. */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Dose prescrite
                      </label>
                      <div className="relative">
                        <input
                          value={form.doseGy}
                          onChange={e => setForm(f => ({ ...f, doseGy: e.target.value }))}
                          placeholder="36,25"
                          inputMode="decimal"
                          className="w-full border border-slate-200 rounded-2xl pl-4 pr-10 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/10 transition-all font-mono"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">Gy</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Nombre de fractions
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={form.nbFractions}
                          onChange={e => setForm(f => ({ ...f, nbFractions: e.target.value }))}
                          placeholder="5"
                          className="w-full border border-slate-200 rounded-2xl pl-4 pr-10 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/10 transition-all font-mono"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">fr</span>
                      </div>
                    </div>
                  </div>

                  {/* Seule valeur réellement déduite des deux saisies */}
                  <div className="-mt-1 text-xs text-slate-400">
                    {doseParFraction(form.doseGy, form.nbFractions)
                      ? <>Soit <strong className="text-slate-600 font-mono">{doseParFraction(form.doseGy, form.nbFractions)} Gy</strong> par fraction. Les deux champs se saisissent indépendamment.</>
                      : <>Renseignez la dose totale et le nombre de fractions.</>}
                  </div>


                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Première séance</label>
                    <input
                      type="date"
                      value={form.premiereSeance}
                      onChange={e => setForm(f => ({ ...f, premiereSeance: e.target.value }))}
                      className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/10 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Traçabilité */}
              <div className="border-t border-slate-100 pt-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Traçabilité</div>
                <div className="bg-clinical-light border border-clinical-border rounded-2xl px-4 py-3 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-clinical text-white flex items-center justify-center text-xs shrink-0 mt-0.5">✎</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Dossier créé par <strong className="text-slate-800">{userName}</strong> le {new Date().toLocaleDateString('fr-FR')}.
                    Chaque avancement d'étape est ensuite horodaté et attribué à son opérateur (visible sur les étapes et à l'export PDF).
                  </div>
                </div>
              </div>

              {formError && (
                <div className="text-xs text-danger-text bg-danger-bg border border-danger-border rounded-2xl px-4 py-2.5">
                  {formError}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setForm(emptyForm); setFormError('') }}
                className="px-5 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-2xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAddPatient}
                className="px-5 py-2.5 text-sm font-semibold bg-clinical text-white rounded-2xl hover:bg-clinical-mid transition-colors"
              >
                Créer le dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation de suppression ── */}
      {aSupprimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-app-sidebar/60 backdrop-blur-sm" onClick={() => setASupprimer(null)} />
          <div className="relative bg-white rounded-3xl w-full max-w-md overflow-hidden">
            <div className="bg-app-sidebar px-6 py-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-0.5">
                Suppression d'un dossier
              </div>
              <div className="text-lg font-bold">{aSupprimer.nom} {aSupprimer.prenom}</div>
              <div className="text-xs opacity-60 mt-0.5 font-mono">
                {aSupprimer.id} · {aSupprimer.protocole} · S{aSupprimer.seanceCourante}/{aSupprimer.totalSeances}
              </div>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Le dossier sort de la liste et son état enregistré est effacé : décisions des
                séances, contraintes ajustées et journal de traçabilité.
              </p>

              {aSupprimer.statut === 'en-cours' && (
                <div className="bg-warn-bg border border-warn-border rounded-2xl px-4 py-3 text-xs text-warn-text">
                  Ce patient est <strong>en cours de traitement</strong> (séance{' '}
                  {aSupprimer.seanceCourante} sur {aSupprimer.totalSeances}). Vérifiez qu'il s'agit
                  bien du bon dossier avant de continuer.
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-500">
                Les objets DICOM restent dans le système source : cette suppression ne concerne que
                le dossier de suivi DIMADOSE.
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => supprimerPatient(aSupprimer)}
                  className="flex-1 bg-danger hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-2xl transition-colors"
                >
                  Supprimer le dossier
                </button>
                <button
                  onClick={() => setASupprimer(null)}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold py-2.5 rounded-2xl transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Récap DICOM ── */}
      {dicomPatient && (
        <DossierProvider
          dossierId={dicomPatient.id}
          seanceInitiale={Math.max(dicomPatient.seanceCourante, 1)}
        >
          <DicomRecap patient={dicomPatient} onClose={() => setDicomPatient(null)} />
        </DossierProvider>
      )}

      {/* ── Récap des séances (étapes + traçabilité) ── */}
      {recapPatient && (
        <SessionRecap patient={recapPatient} onClose={() => setRecapPatient(null)} />
      )}
    </div>
  )
}

