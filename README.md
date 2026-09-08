# DIMADOSE — maquette de l'outil d'aide à la décision (WP5)

Maquette interactive d'un outil web destiné aux équipes de radiothérapie traitant sur
IRM-linac Elekta Unity (localisation prostate). L'outil regarde ce qui s'est passé aux
séances précédentes et aide l'équipe à décider quoi faire à la séance du jour.

**Positionnement tenu dans tous les écrans : l'outil propose, l'humain décide.** Aucune
action n'est déclenchée automatiquement, chaque recommandation est accompagnée de ce qui la
motive et reste refusable en un clic.

Les données sont fictives. La dose affichée est partout une **dose reconstruite**, jamais une
dose délivrée : l'imagerie ciné 2D, le critère VOICE et les décalages temps réel ne sont pas
exportés par la machine.

## Démarrer

```bash
pnpm install
pnpm run dev
```

Connexion : n'importe quel identifiant et mot de passe. Le **profil** choisi change les
droits — le radiothérapeute seul tranche entre ATP et ATS, le manipulateur est en lecture
seule. Ouvrez ensuite le dossier **DUPONT Michel** : c'est le seul adossé à des mesures par
séance, les autres patients de la liste sont illustratifs.

## Les quatre moments

Ils s'ouvrent en tiroir depuis le workflow clinique.

| | Écran | Où |
|---|---|---|
| **A** | Validation inter-séance — qualité de l'IRM, déformation, dose retenue, cumul | fin de workflow → « Récap de la séance » |
| **B** | Recommandation ATP / ATS et sa justification | étape 2 → décision clinique → « Voir la justification complète » |
| **C** | Contraintes d'optimisation proposées pour la réoptimisation du jour | étape 3 → « Détail et export » |
| **D** | Rapport de traitement et journal de traçabilité | étape 3 → « Rapport », ou menu utilisateur |

## Architecture

Trois couches, une seule source de vérité. Si une valeur affichée peut se déduire d'une
autre, elle n'est pas écrite en dur.

| Fichier | Rôle |
|---|---|
| `src/data.ts` | **Mesures brutes uniquement** : structures et contraintes de référence du plan, et par séance la qualité IRM, la déformation, les décalages de recalage et les points de dose (candidates IRM et sCT). Aucun verdict. |
| `src/logic.ts` | **Moteur de décision**, fonctions pures : verdicts, comparaison des candidates au cumul, confiance et sa propagation, cumul contre prévisionnel, recommandation ATP/ATS scorée, proposition de contraintes, rapport, alertes. Tous les seuils sont regroupés dans `SEUILS`, pour être discutés devant l'écran. |
| `src/store.tsx` | **Décisions humaines** : verdicts révisés, mode de sommation, dose retenue, voie, contraintes éditées, journal de traçabilité. Tout le reste est recalculé. |
| `src/persistence.ts` | Enregistrement dans le navigateur : la revue reprend là où elle s'était arrêtée. |

Conséquence concrète : exclure la séance 3 du cumul au moment A fait retomber la dérive
rectale de +17,4 % à +2,2 %, repasse les contraintes du moment C en « inchangée », et fait
basculer la recommandation du moment B de **ATS** (score 6,5) à **ATP** (score 2,5).

## Périmètre

Les briques de visualisation et d'évaluation dosimétrique existent déjà chez l'éditeur et ne
sont pas redessinées : visualiseur multimodal, isodoses, DVH, recalage, sommation, entrées
et sorties DICOM. Elles sont représentées à l'échelle qu'elles occuperont, avec la mention
« composant existant ». L'effort de conception porte sur la **couche de décision**.

Points laissés ouverts et matérialisés dans la maquette : le critère de comparaison entre
dose IRM et dose sCT (les deux options proposées ne concluent pas toujours pareil), le lieu
du contrôle qualité image, la récupérabilité des décalages de table en ATP, et le choix de
l'image de référence.

## Limites connues de la maquette

- Seul le dossier DUPONT possède des mesures par séance ; les autres patients servent à
  peupler la liste.
- L'étape **Gating** est un emplacement réservé, son contenu reste à définir.
- L'état est enregistré dans le navigateur, pas sur un serveur : il est propre au poste.
  Le menu utilisateur permet de revenir au scénario de démonstration.
