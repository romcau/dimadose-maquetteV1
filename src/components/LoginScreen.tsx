import { useState } from 'react'

type Role = 'physicien' | 'medecin' | 'manipulateur'

const roles: { id: Role; label: string; sub: string }[] = [
  { id: 'physicien', label: 'Physicien médical', sub: 'Valide les étapes du workflow' },
  { id: 'medecin', label: 'Radiothérapeute', sub: 'Valide les étapes + décision ATP / ATS' },
  { id: 'manipulateur', label: 'Manipulateur', sub: 'Consultation en lecture seule' },
]

interface Props {
  onLogin: (user: { name: string; role: Role }) => void
}

export default function LoginScreen({ onLogin }: Props) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('physicien')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || !password.trim()) {
      setError('Identifiant et mot de passe requis.')
      return
    }
    setError('')
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const names: Record<Role, string> = {
        physicien: 'Mme Korhonen',
        medecin: 'Dr Fontaine',
        manipulateur: 'M. Perrin',
      }
      onLogin({ name: names[role], role })
    }, 700)
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

        {/* Card */}
        <div className="bg-white rounded-3xl p-7 border border-violet-100">
          <h2 className="text-xl font-bold text-slate-800 mb-5">Connexion</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Role selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Profil
              </label>
              <div className="flex flex-col gap-2">
                {roles.map(r => (
                  <label
                    key={r.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border cursor-pointer transition-all ${
                      role === r.id
                        ? 'border-clinical bg-clinical-light'
                        : 'border-slate-200 hover:border-clinical/40 bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.id}
                      checked={role === r.id}
                      onChange={() => setRole(r.id)}
                      className="accent-clinical shrink-0"
                    />
                    <div>
                      <div className={`text-sm font-medium ${role === r.id ? 'text-clinical' : 'text-slate-700'}`}>
                        {r.label}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{r.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Identifier */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Identifiant
              </label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Identifiant établissement"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/15 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/15 transition-all"
              />
            </div>

            {error && (
              <div className="text-xs text-danger-text bg-danger-bg border border-danger-border rounded-2xl px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-clinical hover:bg-clinical-mid disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl text-sm transition-all mt-1"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Centre Hospitalier · Service de Radiothérapie · Usage interne uniquement
        </p>
      </div>
    </div>
  )
}
