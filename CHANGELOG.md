# Historique des versions

La version affichée dans la maquette — en bas de l'écran de connexion, de la barre latérale et
de la navigation du tableau de bord — porte le numéro, le commit et la date de construction.
Un `+` après le commit signale un build issu d'un dépôt modifié : il ne correspond pas
exactement au code du commit.

Le numéro vit dans `package.json`. Chaque version fusionnée sur `main` est étiquetée `vX.Y.Z`.

## v4.0.0 — 18 septembre 2026

Revue du 17 septembre. Le workflow passe de quatre à cinq étapes, la confidentialité devient un
profil, et l'identité visuelle suit le nouveau logo.

### Identité visuelle

L'interface était bâtie sur un turquoise absent du logo. Le bleu et l'orange sont maintenant
relevés dans le fichier de la marque : `#095386` et `#f5951c`. Le turquoise donnait **2,42:1**
de contraste sur blanc, sous le minimum WCAG AA de 4,5:1 ; le bleu de la marque donne
**8,12:1**.

L'orange n'est pas repris comme couleur d'interface — trop proche de l'ambre des
avertissements, il se lirait comme une alerte.

Le logo fourni est un PNG opaque sur fond gris, ce gris occupant aussi les interstices du
viseur. `scripts/preparer-logo.mjs` le détoure en estimant l'opacité de chaque pixel, recadre
le symbole et le réduit. Sur fond sombre il est posé sur une pastille claire : le recolorer
serait le trahir.

Le wordmark était recopié en dur dans trois fichiers, chacun avec ses couleurs. Tout passe par
un composant unique.

### Confidentialité — profil partenaire

Un partenaire extérieur regarde comment l'outil raisonne, pas qui est traité. Le profil
`partenaire` est en consultation seule et voit « Dossier AY7Y » au lieu du nom, du prénom, de
la date de naissance et de l'identifiant.

Le masquage passe par un point unique lié aux droits : aucun écran n'a à s'en souvenir. Le
terme juste est **pseudonymisation** — le code dérive de l'identifiant, donc qui détient la
liste peut refaire le lien.

Trois fuites trouvées en vérifiant : le récap DICOM ouvrait son contexte sans utilisateur et
retombait sur le profil par défaut ; « Gestion des utilisateurs » restait ouverte, avec les
adresses du personnel ; les droits du tableau de bord étaient déduits d'un test écrit à la
main.

### Workflow — cinq étapes

**Planning initial.** Tableau des densités affectées au RTSSp, affiché dès son chargement.
L'IRM ne porte pas de densité électronique : ce qui est affecté change la dose calculée sans
que rien ne le montre. Deux cas sont mis en avant — une densité qui s'écarte du protocole, et
une structure sans affectation, qui prend celle du contour externe sans que personne l'ait
décidé.

**IRM du jour.** Les décalages portent leur axe et le sens correspondant à leur signe, et la
convention est affichée plutôt que sous-entendue. Une entrée RTSSj recueille deux observations
libres : déroulement du recalage, affectation de densité retenue.

**Décision ATP / ATS.** Passage obligé, une fois par séance, quelle que soit la route — deux
routes sur trois l'évitaient. La fenêtre porte les arguments classés par poids avec leurs
chiffres, les décalages du jour, et ce que l'outil n'a pas : ni contour, ni volume, ni DVH du
jour n'existent à cet instant.

**Adaptation.** Contraintes et tolérances se modifient dans le tableau. Un score place la
projection de fin de traitement par rapport à l'objectif, à l'échelle de la tolérance, avec un
score d'ensemble sur 100 — ni indice clinique validé, ni la même chose que l'écart au
prévisionnel, et le pied du tableau le dit. En ATP, des données facultatives peuvent être
rechargées ; la dose cesse alors d'être estimée.

**Gating et délivrance du traitement.** La machine n'exporte ni l'imagerie ciné, ni le critère
d'asservissement, ni les décalages temps réel : ce que l'équipe rapporte est la seule trace qui
existe. Critère affiché, seuil adapté signalé, déroulement en trois états, durée de séance.

**Données supplémentaires (post-traitement).** Étape nouvelle. IRM de contrôle facultative,
commentaire pour la séance suivante, puis trois gestes : finaliser — ce qui ouvre la
qualification —, consulter le rapport, clôturer. Les deux derniers restent inertes tant que la
première n'est pas faite.

La séance suivante ne démarre plus depuis le workflow : on repasse par le tableau de bord, et
rouvrir le dossier ouvre la séance d'après avec le récapitulatif de la précédente.

### Ailleurs

- **Création de patient** : date qualifiée (simulation ou première séance), taille et poids
  donnant l'IMC — signalé hors plage —, et machine au choix entre Unity et MRIdian.
- **Qualification de séance** : code couleur et commentaire, portés par la barre d'avancement
  du tableau de bord et affichés au survol. Orange et rouge exigent une explication.
- **Commentaires d'étape** : facultatifs, écrits avant de valider et enregistrés avec la
  validation, repris en tête de la séance suivante et au rapport.
- **Retour en arrière** : chaque étape peut être annulée pour revenir à la précédente.
- Le rapport s'ouvre au centre et non plus sur le côté.

### Défauts corrigés, trouvés en vérifiant

Finaliser une séance refermait le rapport qu'on venait d'ouvrir ; la barrière de décision
interdisait au physicien d'ouvrir l'adaptation d'une séance pourtant décidée ; le pavé de
séances débordait la colonne au-delà de dix fractions ; l'identifiant patient sortait à cinq
chiffres et la date de naissance en ISO.

### Points laissés ouverts

- Le tableau de bord compte encore des « validations inter-séance en attente » et affiche
  « Validation requise » : ces libellés désignent le moment A, retiré du flux.
- Les moments A et C n'ont plus de point d'entrée depuis la suppression du bandeau « Aide à la
  décision ». Leurs écrans restent en place.
- Les densités, l'IMC et le seuil de gating du jeu de démonstration sont plausibles, pas
  validés.
- Le logo est un PNG détouré. Un SVG diviserait le poids par dix et resterait net à toute
  taille.

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
