# Historique des versions

La version affichée dans la maquette — en bas de l'écran de connexion, de la barre latérale et
de la navigation du tableau de bord — porte le numéro, le commit et la date de construction.
Un `+` après le commit signale un build issu d'un dépôt modifié : il ne correspond pas
exactement au code du commit.

Le numéro vit dans `package.json`. Chaque version fusionnée sur `main` est étiquetée `vX.Y.Z`.

## v3.0.0 — 15 septembre 2026

Retours de relecture et refonte du journal de traçabilité.

**Planning initial.** Les objets DICOM s'affichaient sous des noms inventés : `PP` pour `RTPp`,
`Dose` pour `RTDosep`. Le §6 du brief impose de les nommer tels quels.

**Référentiel de sommation.** Il était verrouillé dès qu'une séance était sommée, donc dès la
séance 2, ce qui contredisait le §6 et le §8. La liste est maintenant dérivée des séances
réalisées, le changement reste possible et annonce sa conséquence, et l'IRMref apparaît dans la
fiche patient.

**Les quatre moments.** Ils n'étaient accessibles que par des chemins conditionnels. Un bandeau
« Aide à la décision » permanent les situe dans le temps et donne leur état du jour.

**Guide d'utilisation supprimé.** Il décrivait des accès qui n'existaient plus. L'information
vit désormais dans l'interface, depuis une source unique partagée avec la barre latérale.

**Création de patient.** Dose prescrite et nombre de fractions deviennent deux champs
indépendants — le fractionnement est un choix clinique, pas une conséquence de la dose.

**Journal de traçabilité.** La validation des étapes n'était pas tracée, la navigation l'était.
Les actes sont classés en trois rangs et présentés en frise groupée par séance, avec filtres.

**Défauts corrigés en test.** Rétablissement de la démonstration qui n'apparaissait jamais puis
restait incomplet ; ambiguïté entre la séance de la fiche patient et celle du workflow ouvert.

## v2.0.0 — 8 septembre 2026

**Comptes et identification.** Le rôle était choisi par bouton radio à la connexion, et le nom
affiché en découlait : le journal nommait un rôle, pas une personne. Connexion par identifiant,
création de compte, annuaire partagé avec la page de gestion des utilisateurs.

**Journal de traçabilité.** Chaque action humaine inscrite avec son auteur et son horodatage,
les écarts aux propositions de l'outil signalés comme tels, export `.txt`.

**Enregistrement local.** Décisions, contraintes ajustées, journal et liste des patients
survivent au rechargement.

**Suppression de patients**, avec confirmation et effacement de l'état enregistré.

**Mise à jour du tableau de bord en fin de séance**, avec saisie de la date de prochaine séance.

## v1.0.0 — 8 septembre 2026

**Couche de décision.** La maquette portait ses valeurs en dur, avec des contradictions entre
écrans — le cumul rectal valait 16,2 Gy au moment C, 30,8 Gy à l'étape Adaptation et 24,1 Gy au
moment D. Tout est désormais dérivé de mesures brutes par un moteur de décision :

- `src/data.ts` — mesures brutes uniquement, aucun verdict ;
- `src/logic.ts` — moteur pur : verdicts, cumul contre prévisionnel, confiance et sa
  propagation, recommandation ATP/ATS scorée, contraintes proposées, rapport, alertes ;
- `src/store.tsx` — décisions humaines et journal.

Conséquence vérifiable : exclure la séance 3 du cumul au moment A fait basculer la
recommandation du moment B de ATS à ATP.
