/* ─────────────────────────────────────────────────────────────────────────────
 * Densités affectées aux structures du RTSSp.
 *
 * L'IRM ne donne pas de densité électronique : le calcul de dose s'appuie sur
 * des densités affectées en bloc aux structures. Ce qui est affecté change
 * donc la dose calculée, et rien dans les images ne le montre — d'où ce
 * tableau, qui n'apparaît qu'une fois le RTSSp chargé, puisqu'il le lit.
 * ──────────────────────────────────────────────────────────────────────────── */

import { libellesOrigineDensite } from '../../data'
import { lireAffectationsDensite, resumeDensites } from '../../logic'

/** Trois décimales : l'air vaut 0,0012 g/cm³, deux ne suffiraient pas. */
const densite = (v: number) => v.toFixed(v < 0.01 ? 4 : 3).replace('.', ',')

export default function TableauDensites() {
  const lignes = lireAffectationsDensite()
  const resume = resumeDensites(lignes)

  return (
    <div className="bg-white rounded-3xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-slate-800">Affectations de densité (RTSSp)</div>
          <div className="text-xs text-slate-400 mt-0.5">
            L'IRM ne porte pas de densité électronique : ces valeurs servent au calcul de dose
          </div>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap ${
          resume.conforme
            ? 'bg-ok-bg text-ok-text border-ok-border'
            : 'bg-warn-bg text-warn-text border-warn-border'
        }`}>
          {resume.conforme
            ? `${resume.total} structures conformes`
            : [
                resume.ecarts && `${resume.ecarts} écart${resume.ecarts > 1 ? 's' : ''}`,
                resume.absentes && `${resume.absentes} sans affectation`,
              ].filter(Boolean).join(' · ')}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <th className="text-left font-semibold px-5 py-2.5">Structure</th>
              <th className="text-left font-semibold px-5 py-2.5">Matériau</th>
              <th className="text-right font-semibold px-5 py-2.5 whitespace-nowrap">Protocole</th>
              <th className="text-right font-semibold px-5 py-2.5 whitespace-nowrap">Affectée</th>
              <th className="text-left font-semibold px-5 py-2.5">Origine</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(l => (
              <tr
                key={l.structure}
                className={`border-b border-slate-50 last:border-0 ${
                  l.absente ? 'bg-warn-bg/40' : l.ecart ? 'bg-warn-bg/40' : ''
                }`}
              >
                <td className="px-5 py-2.5 font-medium text-slate-700 whitespace-nowrap">{l.structure}</td>
                <td className="px-5 py-2.5 text-slate-500">{l.materiau}</td>
                <td className="px-5 py-2.5 text-right font-mono text-xs text-slate-400 whitespace-nowrap">
                  {densite(l.densiteProtocole)}
                </td>
                <td className="px-5 py-2.5 text-right whitespace-nowrap">
                  {l.absente ? (
                    <span className="text-xs text-warn-text font-medium">aucune</span>
                  ) : (
                    <span className={`font-mono text-xs font-semibold ${l.ecart ? 'text-warn-text' : 'text-slate-700'}`}>
                      {densite(l.densiteAffectee!)}
                    </span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-xs text-slate-500">
                  {libellesOrigineDensite[l.origine]}
                  {l.ecart && l.delta !== null && (
                    <span className="text-warn-text font-medium">
                      {' '}· {l.delta > 0 ? '+' : '−'}{densite(Math.abs(l.delta))} g/cm³ sur le protocole
                    </span>
                  )}
                  {l.absente && (
                    <span className="text-warn-text font-medium"> · hérite du contour externe</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 leading-relaxed">
        L'outil relit ce que porte le RTSSp, il ne l'écrit pas. Une structure sans affectation
        prend la densité du contour externe : le calcul aboutit quand même, sans que personne
        l'ait décidé. Les corrections se font dans le TPS, puis le RTSSp est rechargé.
      </div>
    </div>
  )
}
