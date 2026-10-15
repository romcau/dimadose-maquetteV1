# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Le projet

Maquette interactive DIMADOSE (WP5) : aide à la décision pour la radiothérapie sur IRM-linac
Elekta Unity, localisation prostate. Code, commentaires, identifiants et messages de commit
sont en **français** — garder cette langue.

Principe tenu partout : **l'outil propose, l'humain décide**. Aucune action automatique ;
chaque recommandation montre ce qui la motive et reste refusable. La dose affichée est
toujours une **dose reconstruite**, jamais « délivrée ». Données fictives : seul le dossier
**DUPONT Michel** porte des mesures par séance, les autres patients peuplent la liste.

## Commandes

```bash
pnpm install
pnpm run dev              # Vite sur $PORT (8443 par défaut) ; .claude/launch.json utilise 5173
pnpm run build            # vérifie aussi que le build passe
pnpm run fichier-unique   # build + replie dist/ en un seul DIMADOSE-maquette-v<X.Y.Z>[-<commit>].html
pnpm run format           # oxfmt
npx tsc --noEmit          # contrôle de types (aucun script dédié)
```

Il n'y a **ni tests ni linter** configurés. Connexion à la maquette : n'importe quel
identifiant/mot de passe ; c'est le **profil** choisi qui fixe les droits.

## Architecture

Une seule source de vérité : toute valeur déductible d'une autre est recalculée, jamais
écrite en dur.

- `src/data.ts` — **mesures brutes uniquement** (structures, contraintes de référence, et par
  séance : qualité IRM, déformation, décalages, points de dose des candidates IRM/sCT).
  Aucun verdict ici.
- `src/logic.ts` — **moteur de décision en fonctions pures** : verdicts, cumul, confiance,
  recommandation ATP/ATS scorée, contraintes proposées, rapport, alertes, droits par profil
  (`droits(role)`), pseudonymisation (`identiteAffichee`). Tous les seuils sont dans `SEUILS`.
- `src/store.tsx` — `DossierProvider` : **décisions humaines** seulement (verdicts révisés,
  mode de cumul, dose retenue, voie, contraintes éditées, journal de traçabilité via
  `tracer`). Tout le reste est dérivé via `logic.ts`.
- `src/dossierContext.ts` — l'objet de contexte, isolé **sans dépendance d'exécution** pour
  que le HMR ne le recrée pas. Ne pas y ajouter d'import de valeurs.
- `src/persistence.ts` — `localStorage` (dossier, liste patients, comptes), clés versionnées
  `dimadose:dossier:v1:…`. Chaque accès est protégé : l'appli doit marcher sans stockage.
  Changer la forme de `EtatPersiste` impose de gérer les états déjà enregistrés.
- `src/App.tsx` — vues login → tableau de bord → dossier. App détient la liste des patients
  et l'annuaire ; un `DossierProvider` par patient (`key={patient.id}`).

Workflow clinique en cinq étapes (`src/components/steps/`) : Planning initial, IRM du jour,
Adaptation (décision ATP/ATS via `DecisionModal`, contraintes), Gating, Données
supplémentaires. Le rapport de traitement est hors étape (`RapportModal` →
`RapportTraitement`).

L'évaluation des séances déjà délivrées — qualité IRM, déformation, dose versée au cumul,
chacune révisable — vit en tête de l'étape 2 (`components/EvaluationSeances.tsx`) : c'est le
cumul qu'elle produit qui motive la décision de l'étape 3. Elle ne comporte aucune validation.

Droits et confidentialité passent par **un point unique** (`droits()` / `identiteAffichee()`) :
un écran ne doit jamais tester un rôle à la main. Le profil `partenaire` voit un code
pseudonymisé au lieu de l'identité.

**README obsolète** : sa section « Les quatre moments » (A–D) décrit un état retiré au commit
71f55cc — leur contenu a rejoint les étapes du workflow.

## Version et diffusion

- Le numéro vit dans `package.json` ; `vite.config.ts` injecte version, commit, drapeau
  « dépôt modifié » (`+`) et date (`src/version.ts`). Chaque version sur `main` est
  étiquetée `vX.Y.Z` et décrite dans `CHANGELOG.md`.
- Le dépôt est **privé** et doit le rester : ne jamais réintroduire de publication
  automatique (GitHub Pages est public même depuis un dépôt privé). La relecture passe par
  le fichier unique produit par `fichier-unique` (ignoré par git).
- Palette issue du logo : bleu `#095386`. L'orange `#f5951c` n'est **pas** une couleur
  d'interface (confusion avec l'ambre des alertes). Le wordmark passe uniquement par
  `DimadoseLogo` / `DimadoseMark` ; `scripts/preparer-logo.mjs` détoure le PNG source.
