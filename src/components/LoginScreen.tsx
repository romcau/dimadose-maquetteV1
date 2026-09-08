import { useState, type FormEvent } from 'react'
import {
  compteParIdentifiant,
  libellesRoles,
  nomAffiche,
  sousTitresRoles,
  type Compte,
  type Role,
} from '../data'

interface Props {
  comptes: Compte[]
  /** Ajoute un compte à l'annuaire (création depuis cet écran). */
  onCreerCompte: (compte: Compte) => void
  onLogin: (user: { name: string; role: Role }) => void
}

const roles: Role[] = ['physicien', 'medecin', 'manipulateur']

const champ = 'w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 '
  + 'rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-clinical '
  + 'focus:ring-2 focus:ring-clinical/15 transition-all'

const libelle = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5'

export default function LoginScreen({ comptes, onCreerCompte, onLogin }: Props) {
  const [mode, setMode] = useState<'connexion' | 'creation'>('connexion')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)
  const [aideOuverte, setAideOuverte] = useState(false)

  // ── Connexion ──
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')

  // Compte reconnu au fil de la saisie : le rôle n'est plus choisi à la main,
  // il vient de l'annuaire — c'est ce qui rend la traçabilité fiable.
  const compteReconnu = identifiant.trim() ? compteParIdentifiant(comptes, identifiant) : undefined

  // ── Création ──
  const [titre, setTitre] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [role, setRole] = useState<Role>('physicien')
  const [nouvelIdentifiant, setNouvelIdentifiant] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const changerMode = (m: 'connexion' | 'creation') => {
    setMode(m)
    setErreur('')
  }

  const entrer = (compte: Compte) => {
    setChargement(true)
    setTimeout(() => {
      setChargement(false)
      onLogin({ name: nomAffiche(compte), role: compte.role })
    }, 500)
  }

  const seConnecter = (e: FormEvent) => {
    e.preventDefault()
    if (!identifiant.trim() || !motDePasse.trim()) {
      setErreur('Identifiant et mot de passe requis.')
      return
    }
    const compte = compteParIdentifiant(comptes, identifiant)
    if (!compte) {
      setErreur("Identifiant inconnu de l'annuaire. Créez un compte s'il s'agit d'une première connexion.")
      return
    }
    if (compte.statut === 'inactif') {
      setErreur('Ce compte est désactivé. Contactez un administrateur du service.')
      return
    }
    setErreur('')
    entrer(compte)
  }

  const creerCompte = (e: FormEvent) => {
    e.preventDefault()
    if (!prenom.trim() || !nom.trim() || !nouvelIdentifiant.trim()) {
      setErreur('Prénom, nom et identifiant sont obligatoires.')
      return
    }
    if (compteParIdentifiant(comptes, nouvelIdentifiant)) {
      setErreur("Cet identifiant est déjà utilisé dans l'annuaire.")
      return
    }
    if (nouveauMdp.length < 8) {
      setErreur('Le mot de passe doit compter au moins 8 caractères.')
      return
    }
    if (nouveauMdp !== confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas.')
      return
    }
    const identifiantPropre = nouvelIdentifiant.trim().toLowerCase()
    setErreur('')
    const compte: Compte = {
      identifiant: identifiantPropre,
      titre: titre.trim() || undefined,
      nom: nom.trim().toUpperCase(),
      prenom: prenom.trim(),
      role,
      email: `${identifiantPropre}@chu.fr`,
      statut: 'actif',
    }
    onCreerCompte(compte)
    entrer(compte)
  }

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-120px] right-[-80px] w-96 h-96 rounded-full bg-clinical/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-60px] w-80 h-80 rounded-full bg-clinical/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 w-32 h-32 rounded-2xl bg-clinical/8 blur-2xl pointer-events-none rotate-12" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand block */}
        <div className="flex flex-col items-center mb-8 gap-1">
          <svg width="320" height="55" viewBox="0 0 1737 296" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="DIMADOSE">
            <defs>
              <linearGradient id="login-dose-grad" x1="849" y1="184" x2="1737" y2="184" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0b6fa8" />
                <stop offset="100%" stopColor="#04b8c5" />
              </linearGradient>
            </defs>
            <path d="M75.375 229.5H126C133.833 229.5 140.625 228.667 146.375 227C152.208 225.333 157.042 222.667 160.875 219C164.708 215.333 167.583 210.583 169.5 204.75C171.417 198.917 172.375 191.833 172.375 183.5C172.375 175.417 171.375 168.583 169.375 163C167.458 157.417 164.542 152.875 160.625 149.375C156.792 145.875 151.958 143.375 146.125 141.875C140.375 140.292 133.667 139.5 126 139.5H75.375V229.5ZM23.75 272V97H137C149.917 97 161.75 98.7917 172.5 102.375C183.25 105.958 192.5 111.375 200.25 118.625C208.083 125.875 214.167 135 218.5 146C222.833 156.917 225 169.75 225 184.5C225 200.167 222.667 213.542 218 224.625C213.417 235.708 207.125 244.75 199.125 251.75C191.208 258.75 181.917 263.875 171.25 267.125C160.583 270.375 149.167 272 137 272H23.75ZM262.52 272V97H314.145V272H262.52ZM361.641 272V97H406.641L468.516 187L528.391 97H574.516V272H523.016V173L465.141 259.875L406.141 174.125V272H361.641ZM598.145 272L688.395 97H735.02L825.895 272H765.52L750.02 240.25H668.645L652.395 272H598.145ZM687.27 204.25H733.02L710.645 158.875L687.27 204.25Z" fill="#05192F" />
            <path d="M901.303 229.5H951.928C959.761 229.5 966.553 228.667 972.303 227C978.136 225.333 982.969 222.667 986.803 219C990.636 215.333 993.511 210.583 995.428 204.75C997.344 198.917 998.303 191.833 998.303 183.5C998.303 175.417 997.303 168.583 995.303 163C993.386 157.417 990.469 152.875 986.553 149.375C982.719 145.875 977.886 143.375 972.053 141.875C966.303 140.292 959.594 139.5 951.928 139.5H901.303V229.5ZM849.678 272V97H962.928C975.844 97 987.678 98.7917 998.428 102.375C1009.18 105.958 1018.43 111.375 1026.18 118.625C1034.01 125.875 1040.09 135 1044.43 146C1048.76 156.917 1050.93 169.75 1050.93 184.5C1050.93 200.167 1048.59 213.542 1043.93 224.625C1039.34 235.708 1033.05 244.75 1025.05 251.75C1017.14 258.75 1007.84 263.875 997.178 267.125C986.511 270.375 975.094 272 962.928 272H849.678ZM1086.17 133.125C1086.17 117.625 1090.47 107.458 1099.05 102.625C1107.72 97.7083 1119.09 95.25 1133.17 95.25H1237.8C1251.97 95.25 1263.38 97.7083 1272.05 102.625C1280.72 107.458 1285.05 117.625 1285.05 133.125V234.375C1285.05 250.458 1280.92 261.042 1272.67 266.125C1264.42 271.208 1252.8 273.75 1237.8 273.75H1133.17C1118.26 273.75 1106.67 271.208 1098.42 266.125C1090.26 260.958 1086.17 250.375 1086.17 234.375V133.125ZM1137.8 140.25V228.75H1233.55V140.25H1137.8ZM1320.27 223.75L1369.52 217.25V234.75H1455.52V203.125H1370.77C1363.6 203.125 1357.1 202.583 1351.27 201.5C1345.43 200.417 1340.52 198.458 1336.52 195.625C1332.52 192.708 1329.43 188.667 1327.27 183.5C1325.1 178.333 1324.02 171.75 1324.02 163.75V133C1324.02 125.083 1325.18 118.708 1327.52 113.875C1329.85 108.958 1333.1 105.125 1337.27 102.375C1341.43 99.5417 1346.39 97.6667 1352.14 96.75C1357.97 95.75 1364.35 95.25 1371.27 95.25H1455.27C1462.27 95.25 1468.64 95.75 1474.39 96.75C1480.14 97.6667 1485.06 99.5 1489.14 102.25C1493.31 105 1496.52 108.833 1498.77 113.75C1501.02 118.583 1502.14 124.917 1502.14 132.75V143.875L1453.02 150.125V134.25H1373.27V164H1457.64C1464.64 164 1471.02 164.5 1476.77 165.5C1482.52 166.417 1487.47 168.25 1491.64 171C1495.81 173.667 1499.02 177.458 1501.27 182.375C1503.52 187.292 1504.64 193.667 1504.64 201.5V234.5C1504.64 250.667 1500.47 261.25 1492.14 266.25C1483.81 271.25 1472.31 273.75 1457.64 273.75H1367.14C1359.97 273.75 1353.47 273.208 1347.64 272.125C1341.81 271.125 1336.85 269.208 1332.77 266.375C1328.77 263.458 1325.68 259.458 1323.52 254.375C1321.35 249.292 1320.27 242.708 1320.27 234.625V223.75ZM1543.28 272V97H1713.91V138.375H1594.91V164H1665.66V202.125H1594.91V230.625H1716.41V272H1543.28Z" fill="url(#login-dose-grad)" />
          </svg>
          <p className="text-slate-500 text-sm">Radiothérapie adaptative IRM-Linac</p>
        </div>

        <div className="bg-white rounded-3xl p-7 border border-violet-100">

          {/* Bascule connexion / création */}
          <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 mb-5">
            {([['connexion', 'Se connecter'], ['creation', 'Créer un compte']] as const).map(([m, texte]) => (
              <button
                key={m}
                type="button"
                onClick={() => changerMode(m)}
                className={`flex-1 text-xs font-semibold py-2 rounded-xl transition-colors ${
                  mode === m ? 'bg-white text-clinical' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {texte}
              </button>
            ))}
          </div>

          {mode === 'connexion' ? (
            <form onSubmit={seConnecter} className="flex flex-col gap-4">
              <div>
                <label className={libelle}>Identifiant</label>
                <input
                  type="text"
                  value={identifiant}
                  onChange={e => setIdentifiant(e.target.value)}
                  placeholder="Identifiant établissement"
                  autoComplete="username"
                  className={champ}
                />
                {/* Le rôle vient de l'annuaire, il n'est pas choisi */}
                {compteReconnu && (
                  <div className={`mt-2 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs border ${
                    compteReconnu.statut === 'actif'
                      ? 'bg-clinical-light border-clinical-border text-clinical'
                      : 'bg-warn-bg border-warn-border text-warn-text'
                  }`}>
                    <span className="font-semibold">{nomAffiche(compteReconnu)}</span>
                    <span className="opacity-70">{libellesRoles[compteReconnu.role]}</span>
                    {compteReconnu.statut === 'inactif' && (
                      <span className="ml-auto font-semibold">compte désactivé</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className={libelle}>Mot de passe</label>
                <input
                  type="password"
                  value={motDePasse}
                  onChange={e => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={champ}
                />
              </div>

              {erreur && (
                <div className="text-xs text-danger-text bg-danger-bg border border-danger-border rounded-2xl px-4 py-2.5">
                  {erreur}
                </div>
              )}

              <button
                type="submit"
                disabled={chargement}
                className="w-full bg-clinical hover:bg-clinical-mid disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl text-sm transition-all mt-1"
              >
                {chargement ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          ) : (
            <form onSubmit={creerCompte} className="flex flex-col gap-4">
              <div className="grid grid-cols-[72px_1fr] gap-2">
                <div>
                  <label className={libelle}>Titre</label>
                  <input
                    type="text"
                    value={titre}
                    onChange={e => setTitre(e.target.value)}
                    placeholder="Dr"
                    className={champ}
                  />
                </div>
                <div>
                  <label className={libelle}>Prénom</label>
                  <input
                    type="text"
                    value={prenom}
                    onChange={e => setPrenom(e.target.value)}
                    placeholder="Prénom"
                    autoComplete="given-name"
                    className={champ}
                  />
                </div>
              </div>

              <div>
                <label className={libelle}>Nom</label>
                <input
                  type="text"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder="Nom"
                  autoComplete="family-name"
                  className={champ}
                />
              </div>

              <div>
                <label className={libelle}>Rôle</label>
                <div className="flex flex-col gap-2">
                  {roles.map(r => (
                    <label
                      key={r}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border cursor-pointer transition-all ${
                        role === r
                          ? 'border-clinical bg-clinical-light'
                          : 'border-slate-200 hover:border-clinical/40 bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="accent-clinical shrink-0"
                      />
                      <div>
                        <div className={`text-sm font-medium ${role === r ? 'text-clinical' : 'text-slate-700'}`}>
                          {libellesRoles[r]}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{sousTitresRoles[r]}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Le rôle détermine les droits et sera repris dans le journal de traçabilité.
                  Il n'est plus choisi à la connexion.
                </p>
              </div>

              <div>
                <label className={libelle}>Identifiant souhaité</label>
                <input
                  type="text"
                  value={nouvelIdentifiant}
                  onChange={e => setNouvelIdentifiant(e.target.value)}
                  placeholder="p.nom"
                  autoComplete="username"
                  className={champ}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={libelle}>Mot de passe</label>
                  <input
                    type="password"
                    value={nouveauMdp}
                    onChange={e => setNouveauMdp(e.target.value)}
                    placeholder="8 caractères min."
                    autoComplete="new-password"
                    className={champ}
                  />
                </div>
                <div>
                  <label className={libelle}>Confirmer</label>
                  <input
                    type="password"
                    value={confirmation}
                    onChange={e => setConfirmation(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={champ}
                  />
                </div>
              </div>

              {erreur && (
                <div className="text-xs text-danger-text bg-danger-bg border border-danger-border rounded-2xl px-4 py-2.5">
                  {erreur}
                </div>
              )}

              <button
                type="submit"
                disabled={chargement}
                className="w-full bg-clinical hover:bg-clinical-mid disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl text-sm transition-all mt-1"
              >
                {chargement ? 'Création…' : 'Créer le compte et se connecter'}
              </button>
            </form>
          )}

          {/* Honnêteté sur le périmètre — §4 du brief */}
          <p className="text-xs text-slate-400 mt-5 pt-4 border-t border-slate-100 leading-relaxed">
            Le socle web multi-utilisateurs est un <em>composant existant</em> : la maquette
            enregistre le compte et son rôle pour la traçabilité, mais ne conserve aucun mot de
            passe et ne vérifie pas l'authentification.
          </p>
        </div>

        {/* Aide à la revue de maquette */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setAideOuverte(v => !v)}
            className="text-xs text-slate-400 hover:text-clinical transition-colors"
          >
            {aideOuverte ? 'Masquer les comptes de démonstration' : 'Comptes de démonstration'}
          </button>
          {aideOuverte && (
            <div className="mt-2 bg-white/70 border border-violet-100 rounded-2xl p-3 flex flex-col gap-1 text-left">
              {comptes.map(c => (
                <button
                  key={c.identifiant}
                  type="button"
                  onClick={() => {
                    changerMode('connexion')
                    setIdentifiant(c.identifiant)
                    setMotDePasse('demonstration')
                  }}
                  disabled={c.statut === 'inactif'}
                  className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-xl hover:bg-clinical-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                >
                  <span className="font-mono text-slate-600 w-24 shrink-0">{c.identifiant}</span>
                  <span className="text-slate-700 font-medium">{nomAffiche(c)}</span>
                  <span className="text-slate-400 ml-auto">{libellesRoles[c.role]}</span>
                </button>
              ))}
              <p className="text-xs text-slate-400 mt-1 px-2 leading-relaxed">
                N'importe quel mot de passe convient. Les comptes désactivés ne peuvent pas se
                connecter.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Centre Hospitalier · Service de Radiothérapie · Usage interne uniquement
        </p>
      </div>
    </div>
  )
}
