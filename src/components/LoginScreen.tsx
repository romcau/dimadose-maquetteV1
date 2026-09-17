import { useState, type FormEvent } from 'react'
import { versionCourte, versionDetaillee } from '../version'
import DimadoseLogo from './DimadoseLogo'
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
          <DimadoseLogo width={320} />
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
        <p className="text-center text-xs text-slate-300 mt-1 font-mono cursor-help" title={versionDetaillee()}>
          {versionCourte()}
        </p>
      </div>
    </div>
  )
}
