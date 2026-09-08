import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import DicomRecap from './DicomRecap'
import SessionRecap from './SessionRecap'
import { DossierProvider, alertesPourDossier } from '../store'
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
    totalSeances: 5,
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

// Deux localisations traitées par la plateforme
const localisations = [
  { label: 'Prostate',        dose: '36,25 Gy', seances: '5' },
  { label: 'Col de l’utérus', dose: '45 Gy',    seances: '25' },
]

interface AddPatientForm {
  nom: string
  prenom: string
  ddn: string
  localisation: string
  prescriptionMode: 'dose' | 'seances'
  dose: string
  totalSeances: string
  premiereSeance: string
}

const emptyForm: AddPatientForm = {
  nom: '', prenom: '', ddn: '',
  localisation: localisations[0].label,
  prescriptionMode: 'seances',
  dose: localisations[0].dose,
  totalSeances: localisations[0].seances,
  premiereSeance: '',
}

interface Props {
  patients: PatientRecord[]
  setPatients: Dispatch<SetStateAction<PatientRecord[]>>
  onSelectPatient: (p: PatientRecord) => void
  userName: string
  userRole: string
  readOnly?: boolean
  onLogout: () => void
}

type NavPage = 'dashboard' | 'guide' | 'utilisateurs'

const mockUsers = [
  { nom: 'Korhonen', prenom: 'Aino',    role: 'Physicien médical',  statut: 'actif',    email: 'a.korhonen@chu.fr' },
  { nom: 'Fontaine', prenom: 'Laurent', role: 'Radiothérapeute',    statut: 'actif',    email: 'l.fontaine@chu.fr' },
  { nom: 'Marchand', prenom: 'Sophie',  role: 'Radiothérapeute',    statut: 'actif',    email: 's.marchand@chu.fr' },
  { nom: 'Dupas',    prenom: 'Marc',    role: 'Physicien médical',  statut: 'actif',    email: 'm.dupas@chu.fr' },
  { nom: 'Perrin',   prenom: 'Théo',   role: 'Manipulateur',       statut: 'actif',    email: 't.perrin@chu.fr' },
  { nom: 'Girard',   prenom: 'Élise',  role: 'Physicien médical',  statut: 'inactif',  email: 'e.girard@chu.fr' },
]

const roleColors: Record<string, string> = {
  'Physicien médical': 'bg-clinical-light text-clinical border border-clinical-border',
  'Radiothérapeute':   'bg-blue-50 text-blue-700 border border-blue-200',
  'Manipulateur':      'bg-slate-100 text-slate-600 border border-slate-200',
}

function GuidePage() {
  const sections = [
    {
      tag: '1',
      title: 'Planning initial',
      content: "Réalisé une seule fois avant la première séance. Charger le CTp, acquérir l'IRMp sur IRM Unity, réaliser le recalage CTp/IRMp dans Monaco, contourner les cibles et OARs, planifier et exporter RTPp + RTDosep vers DIMADOSE.",
    },
    {
      tag: '2',
      title: 'IRM du jour',
      content: "À chaque séance : acquérir l'IRMj sur IRM Unity, déclencher le recalage automatique IRMj/IRMref dans DIMADOSE (calcul Δx, Δy, Δz). Consulter la recommandation ATP/ATS via les outils DIMADOSE (bouton header). Valider l'étape avant de poursuivre.",
    },
    {
      tag: '3',
      title: 'Adaptation',
      content: "Si ATP : décalage de table uniquement, plan de référence appliqué sans modification, la dose délivrée est ajoutée au cumul patient. Si ATS : importer RTSSj/RTPj/RTDosej depuis Monaco, appliquer les contraintes OAR recommandées par DIMADOSE, mettre à jour le cumul des doses. IRMv optionnelle.",
    },
    {
      tag: 'A',
      title: 'Outil A — Validation inter-séance',
      content: "Accessible depuis le bouton Outils DIMADOSE à l'étape 2. Vérifie la qualité du recalage, analyse la déformation anatomique et évalue le cumul de dose depuis S1.",
    },
    {
      tag: 'B',
      title: 'Outil B — Recommandation ATP/ATS',
      content: "Fournit une recommandation basée sur l'analyse du cumul de dose S1–S(N-1), les décalages et la déformation. Accessible depuis le bouton Outils DIMADOSE à l'étape 2.",
    },
    {
      tag: 'C',
      title: 'Outil C — Contraintes ATS',
      content: "Tableau des contraintes OAR pour la séance N en cas d'ATS. Indique les marges de manœuvre (serrée / OK) et les ajustements recommandés pour Monaco.",
    },
    {
      tag: 'D',
      title: 'Outil D — Rapport final',
      content: "Synthèse complète du traitement : dose cumulée par OAR, historique des décisions, conformité au planning. Export PDF disponible en fin de traitement.",
    },
  ]

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <div className="text-2xl font-bold text-slate-800">Guide d'utilisation</div>
        <div className="text-sm text-slate-400 mt-1">Plateforme DIMADOSE — Radiothérapie adaptative IRM-Linac</div>
      </div>

      <div className="flex flex-col gap-4">
        {sections.map(s => (
          <div key={s.tag} className="bg-white rounded-2xl p-5 flex gap-4">
            <div className="w-8 h-8 rounded-xl bg-clinical text-white flex items-center justify-center text-xs font-bold shrink-0">
              {s.tag}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 mb-1">{s.title}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{s.content}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-clinical-light border border-clinical-border rounded-2xl p-5">
        <div className="text-xs font-bold text-clinical uppercase tracking-wider mb-2">Support</div>
        <div className="text-xs text-slate-600 leading-relaxed">
          Pour toute question technique ou clinique, contacter l'équipe AQUILAB by Coexya.<br />
          Outil d'aide à la décision uniquement — la dose reconstruite n'est pas la dose délivrée.
        </div>
      </div>
    </div>
  )
}

type UserRecord = { nom: string; prenom: string; role: string; statut: string; email: string }
const emptyUser: UserRecord = { nom: '', prenom: '', role: 'Physicien médical', statut: 'actif', email: '' }
const availableRoles = ['Physicien médical', 'Radiothérapeute', 'Manipulateur']

function UsersPage({ readOnly = false }: { readOnly?: boolean }) {
  const [users, setUsers] = useState<UserRecord[]>(mockUsers.map(u => ({ ...u })))
  const [modal, setModal] = useState<{ open: boolean; idx: number | null }>({ open: false, idx: null })
  const [form, setForm] = useState<UserRecord>(emptyUser)
  const [err, setErr] = useState('')

  function openAdd() { setForm({ ...emptyUser }); setErr(''); setModal({ open: true, idx: null }) }
  function openEdit(i: number) { setForm({ ...users[i] }); setErr(''); setModal({ open: true, idx: i }) }
  function closeModal() { setModal({ open: false, idx: null }) }

  function handleSave() {
    if (!form.nom.trim() || !form.prenom.trim() || !form.email.trim()) {
      setErr('Nom, prénom et email sont obligatoires.')
      return
    }
    if (modal.idx === null) {
      setUsers(prev => [...prev, { ...form }])
    } else {
      setUsers(prev => prev.map((u, i) => i === modal.idx ? { ...form } : u))
    }
    closeModal()
  }

  function toggleStatut(i: number) {
    setUsers(prev => prev.map((u, idx) =>
      idx === i ? { ...u, statut: u.statut === 'actif' ? 'inactif' : 'actif' } : u
    ))
  }

  const actifs = users.filter(u => u.statut === 'actif').length

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-2xl font-bold text-slate-800">Gestion des utilisateurs</div>
          <div className="text-sm text-slate-400 mt-1">{actifs} utilisateur{actifs > 1 ? 's' : ''} actif{actifs > 1 ? 's' : ''}</div>
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
              {['Utilisateur', 'Rôle', 'Email', 'Statut', ''].map((h, i) => (
                <th key={i} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-clinical-light/30 transition-colors group">
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-slate-800">{u.nom} {u.prenom}</div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleColors[u.role] ?? 'bg-slate-100 text-slate-500'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">{u.email}</td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => !readOnly && toggleStatut(i)}
                    disabled={readOnly}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
                      u.statut === 'actif'
                        ? `bg-ok-bg text-ok-text border border-ok-border ${readOnly ? '' : 'hover:bg-ok-border'}`
                        : `bg-slate-100 text-slate-400 border border-slate-200 ${readOnly ? '' : 'hover:bg-slate-200'}`
                    }`}
                  >
                    {u.statut === 'actif' ? 'Actif' : 'Inactif'}
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
      </div>

      {/* Add / Edit modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-3xl w-full max-w-md mx-4 p-6">
            <div className="text-lg font-bold text-slate-800 mb-5">
              {modal.idx === null ? 'Nouvel utilisateur' : "Modifier l'utilisateur"}
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
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

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Rôle</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-clinical focus:ring-1 focus:ring-clinical/30 outline-none bg-white"
                >
                  {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
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

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
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
    id: 'guide',
    label: "Guide d'utilisation",
    sub: 'Documentation',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
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

  const listeModifiee =
    patients.length !== patientsDemo.length
    || patients.some((x, i) => x.id !== patientsDemo[i]?.id)

  const retablirListeDemo = () => {
    effacerListePatients()
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
    setForm(f => ({ ...f, localisation: val, dose: loc?.dose ?? '', totalSeances: loc?.seances ?? f.totalSeances }))
  }

  const handleAddPatient = () => {
    if (!form.nom.trim() || !form.prenom.trim() || !form.ddn.trim()) {
      setFormError('Nom, prénom et date de naissance sont requis.')
      return
    }
    setFormError('')
    const nextNum = String(patients.length + 200).padStart(4, '0')
    const seances = parseInt(form.totalSeances) || 5
    const prescription = form.prescriptionMode === 'dose'
      ? form.dose
      : `${seances} séances`
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
          <svg width="160" height="27" viewBox="0 0 1737 296" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="DIMADOSE">
            <defs>
              <linearGradient id="db-dose-grad" x1="849" y1="184" x2="1737" y2="184" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0b6fa8" />
                <stop offset="100%" stopColor="#04b8c5" />
              </linearGradient>
            </defs>
            <path d="M75.375 229.5H126C133.833 229.5 140.625 228.667 146.375 227C152.208 225.333 157.042 222.667 160.875 219C164.708 215.333 167.583 210.583 169.5 204.75C171.417 198.917 172.375 191.833 172.375 183.5C172.375 175.417 171.375 168.583 169.375 163C167.458 157.417 164.542 152.875 160.625 149.375C156.792 145.875 151.958 143.375 146.125 141.875C140.375 140.292 133.667 139.5 126 139.5H75.375V229.5ZM23.75 272V97H137C149.917 97 161.75 98.7917 172.5 102.375C183.25 105.958 192.5 111.375 200.25 118.625C208.083 125.875 214.167 135 218.5 146C222.833 156.917 225 169.75 225 184.5C225 200.167 222.667 213.542 218 224.625C213.417 235.708 207.125 244.75 199.125 251.75C191.208 258.75 181.917 263.875 171.25 267.125C160.583 270.375 149.167 272 137 272H23.75ZM262.52 272V97H314.145V272H262.52ZM361.641 272V97H406.641L468.516 187L528.391 97H574.516V272H523.016V173L465.141 259.875L406.141 174.125V272H361.641ZM598.145 272L688.395 97H735.02L825.895 272H765.52L750.02 240.25H668.645L652.395 272H598.145ZM687.27 204.25H733.02L710.645 158.875L687.27 204.25Z" fill="rgba(255,255,255,0.92)" />
            <path d="M901.303 229.5H951.928C959.761 229.5 966.553 228.667 972.303 227C978.136 225.333 982.969 222.667 986.803 219C990.636 215.333 993.511 210.583 995.428 204.75C997.344 198.917 998.303 191.833 998.303 183.5C998.303 175.417 997.303 168.583 995.303 163C993.386 157.417 990.469 152.875 986.553 149.375C982.719 145.875 977.886 143.375 972.053 141.875C966.303 140.292 959.594 139.5 951.928 139.5H901.303V229.5ZM849.678 272V97H962.928C975.844 97 987.678 98.7917 998.428 102.375C1009.18 105.958 1018.43 111.375 1026.18 118.625C1034.01 125.875 1040.09 135 1044.43 146C1048.76 156.917 1050.93 169.75 1050.93 184.5C1050.93 200.167 1048.59 213.542 1043.93 224.625C1039.34 235.708 1033.05 244.75 1025.05 251.75C1017.14 258.75 1007.84 263.875 997.178 267.125C986.511 270.375 975.094 272 962.928 272H849.678ZM1086.17 133.125C1086.17 117.625 1090.47 107.458 1099.05 102.625C1107.72 97.7083 1119.09 95.25 1133.17 95.25H1237.8C1251.97 95.25 1263.38 97.7083 1272.05 102.625C1280.72 107.458 1285.05 117.625 1285.05 133.125V234.375C1285.05 250.458 1280.92 261.042 1272.67 266.125C1264.42 271.208 1252.8 273.75 1237.8 273.75H1133.17C1118.26 273.75 1106.67 271.208 1098.42 266.125C1090.26 260.958 1086.17 250.375 1086.17 234.375V133.125ZM1137.8 140.25V228.75H1233.55V140.25H1137.8ZM1320.27 223.75L1369.52 217.25V234.75H1455.52V203.125H1370.77C1363.6 203.125 1357.1 202.583 1351.27 201.5C1345.43 200.417 1340.52 198.458 1336.52 195.625C1332.52 192.708 1329.43 188.667 1327.27 183.5C1325.1 178.333 1324.02 171.75 1324.02 163.75V133C1324.02 125.083 1325.18 118.708 1327.52 113.875C1329.85 108.958 1333.1 105.125 1337.27 102.375C1341.43 99.5417 1346.39 97.6667 1352.14 96.75C1357.97 95.75 1364.35 95.25 1371.27 95.25H1455.27C1462.27 95.25 1468.64 95.75 1474.39 96.75C1480.14 97.6667 1485.06 99.5 1489.14 102.25C1493.31 105 1496.52 108.833 1498.77 113.75C1501.02 118.583 1502.14 124.917 1502.14 132.75V143.875L1453.02 150.125V134.25H1373.27V164H1457.64C1464.64 164 1471.02 164.5 1476.77 165.5C1482.52 166.417 1487.47 168.25 1491.64 171C1495.81 173.667 1499.02 177.458 1501.27 182.375C1503.52 187.292 1504.64 193.667 1504.64 201.5V234.5C1504.64 250.667 1500.47 261.25 1492.14 266.25C1483.81 271.25 1472.31 273.75 1457.64 273.75H1367.14C1359.97 273.75 1353.47 273.208 1347.64 272.125C1341.81 271.125 1336.85 269.208 1332.77 266.375C1328.77 263.458 1325.68 259.458 1323.52 254.375C1321.35 249.292 1320.27 242.708 1320.27 234.625V223.75ZM1543.28 272V97H1713.91V138.375H1594.91V164H1665.66V202.125H1594.91V230.625H1716.41V272H1543.28Z" fill="url(#db-dose-grad)" />
          </svg>
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
        </nav>

        {/* ── Main content ── */}
        <div className="flex-1 overflow-y-auto">
          {navPage === 'guide'       && <GuidePage />}
          {navPage === 'utilisateurs' && <UsersPage readOnly={readOnly} />}
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
                    <div className="flex gap-0.5 mt-1.5">
                      {Array.from({ length: p.totalSeances }).map((_, i) => (
                        <div key={i} className={`w-3 h-1.5 rounded-full ${
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
                  title="Remettre la liste de patients du scénario de démonstration"
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

                  {/* Prescription : dose OU nombre de séances */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Prescription</label>
                    <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 mb-2.5">
                      {([
                        { id: 'dose' as const,    label: 'Dose prescrite' },
                        { id: 'seances' as const, label: 'Nombre de séances' },
                      ]).map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, prescriptionMode: opt.id }))}
                          className={`flex-1 text-xs font-semibold py-1.5 rounded-xl transition-colors ${
                            form.prescriptionMode === opt.id ? 'bg-white text-clinical shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {form.prescriptionMode === 'dose' ? (
                      <input
                        value={form.dose}
                        onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
                        placeholder="ex. 36,25 Gy"
                        className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/10 transition-all font-mono"
                      />
                    ) : (
                      <input
                        type="number"
                        min="1"
                        max="35"
                        value={form.totalSeances}
                        onChange={e => setForm(f => ({ ...f, totalSeances: e.target.value }))}
                        placeholder="ex. 5"
                        className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/10 transition-all font-mono"
                      />
                    )}
                    <div className="text-xs text-slate-400 mt-1.5">
                      Renseignez la dose prescrite <em>ou</em> le nombre de séances — l'autre paramètre en découle.
                    </div>
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

