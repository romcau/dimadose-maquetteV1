# Brief maquette — Outil d'aide à la décision DIMADOSE (WP5)

> À coller dans Figma Make. Tout le texte de l'interface doit être en français.
> Les valeurs chiffrées de ce document sont des exemples à afficher tels quels dans la maquette.

---

## 1. Ce qu'est le produit

Un outil web destiné aux équipes de radiothérapie qui traitent des patients sur un
IRM-linac Elekta Unity (localisation prostate). Le patient reçoit plusieurs séances
d'irradiation. À chaque séance, le plan de traitement peut être réadapté à l'anatomie du
jour.

L'outil ne pilote rien et ne calcule rien en direct. Il **regarde ce qui s'est passé aux
séances précédentes** et aide l'équipe à décider quoi faire à la séance du jour.

Positionnement à respecter dans tous les écrans : **l'outil propose, l'humain décide.**
Aucune action n'est jamais déclenchée automatiquement. Chaque recommandation est
accompagnée de ce qui la motive, et reste refusable en un clic.

### Les objectifs à servir, mot pour mot

Ce sont les objectifs du projet. Tout écran de la maquette doit pouvoir se rattacher à l'un
d'eux ; si ce n'est pas le cas, l'écran est hors périmètre.

> **1 — Évaluer le traitement délivré de la séance 1 à la séance N-1 afin de fournir un outil
> d'aide à la décision à la séance N sur :**
>
> - Adaptation simple (ATP) ou complète (ATS)
> - Si adaptation ATS : quelles sont les contraintes à prendre en compte à la séance N ?
>   Y a-t-il des marges de manœuvre sur certains OAR ? Ou faut-il des contraintes plus fortes ?
>
> **2 — Fournir une évaluation de l'ensemble du traitement réalisé.**

Et pour y parvenir, l'évaluation de la séance N-1 se décompose ainsi :

> - Évaluer la qualité de l'IRM à la séance N-1. Si IRM de mauvaise qualité → nouvelle
>   acquisition.
> - Évaluer la déformation interne à la séance N-1. Si déformation acceptable → sommation par
>   recalage déformable.
> - Comparaison du RTDose IRM calculé lors du traitement N-1 contre le RTDose sCT (recalculé à
>   partir de la balistique N-1). Choix du RTDose utilisé pour la sommation.

## 2. Qui l'utilise

- **Physicien médical** — utilisateur principal, valide les calculs de dose, prépare les
  contraintes d'optimisation.
- **Radiothérapeute (médecin)** — tranche les décisions cliniques, consulte le rapport de
  fin de traitement.
- **Manipulateur** — consulte l'écran de séance pendant que le patient est installé.

## 3. Les quatre moments à couvrir

L'outil sert à quatre instants très différents. Ce sont quatre écrans distincts, avec des
contraintes de temps opposées. **Ne pas les fusionner en un tableau de bord unique.**

### Moment A — Entre deux séances (hors ligne, sans contrainte de temps)

Après chaque séance, un traitement automatique évalue la séance qui vient d'avoir lieu et
met à jour la dose cumulée. L'écran présente le résultat au physicien pour validation.

Trois vérifications s'enchaînent, chacune pouvant être révisée manuellement :

1. **Qualité de l'image IRM de la séance.** Verdict : exploitable / dégradée / inexploitable.
   Afficher les motifs (artefacts de mouvement, rapport signal sur bruit, distorsion
   géométrique) avec l'image en vignette cliquable.
2. **Ampleur de la déformation anatomique** par rapport à l'image de référence. Verdict :
   déformation acceptable / importante. Si acceptable, le cumul de dose se fait par recalage
   déformable. Si importante, l'écran doit demander à l'utilisateur quoi faire, avec trois
   options explicites : cumuler quand même en signalant l'incertitude, cumuler en recalage
   rigide seulement, ou exclure la séance du cumul.
3. **Choix de la distribution de dose à cumuler.** Deux candidates sont comparées : la dose
   calculée sur l'IRM pendant le traitement, et la dose recalculée sur le scanner synthétique
   (sCT) à partir de la même balistique. Afficher les deux côte à côte, l'écart entre elles
   sur les points DVH cliniques, et laisser l'utilisateur choisir laquelle entre dans le cumul.
   Proposer un choix par défaut, jamais l'imposer. La comparaison elle-même (isodoses, DVH
   superposés) s'appuie sur les composants existants décrits en section 4 : ce qui est nouveau
   ici, c'est le verdict, le choix retenu et sa trace.

En sortie : la dose cumulée des séances 1 à N-1, avec un indicateur de confiance qui hérite
des trois verdicts ci-dessus.

### Moment B — Pendant la séance, avant l'adaptation (contrainte de temps forte)

C'est l'écran le plus important. Le patient est allongé dans la machine. L'IRM du jour vient
d'être acquise et recalée rigidement sur l'image de référence. L'équipe doit choisir entre
deux voies :

- **ATP** (adaptation simple) — on décale la table, on garde le plan tel quel. Rapide.
- **ATS** (adaptation complète) — on recontoure et on réoptimise le plan. Long, patient
  immobilisé plus longtemps.

L'outil affiche une recommandation ATP ou ATS et la justifie à partir de l'historique.

**Contraintes de conception non négociables :**

- L'écran doit être lisible et compris en moins de 30 secondes. Verdict en très gros, en
  haut, immédiatement visible sans défilement.
- **Aucun contour du jour n'existe encore à ce moment-là.** Il est donc impossible d'afficher
  un DVH du jour, un volume d'organe du jour, ou une dose du jour. Ne pas en inventer.
  L'écran ne dispose que de : l'image IRM du jour brute, les décalages de recalage rigide en
  x/y/z, et tout l'historique des séances précédentes.
- La justification s'appuie donc sur des tendances : dérive du cumul par rapport au
  prévisionnel, fréquence des ATS aux séances précédentes, OAR dont le cumul approche sa
  limite, amplitude inhabituelle des décalages du jour.
- Deux boutons de sortie, de poids visuel égal : « Suivre la recommandation » et
  « Choisir l'autre voie ». Si l'utilisateur choisit l'autre voie, lui demander pourquoi
  (liste courte de motifs + champ libre) et l'enregistrer.

### Moment C — Si ATS a été retenu, juste après

Écran de proposition des contraintes d'optimisation pour la réoptimisation du plan du jour.

Partir des contraintes du plan de référence et proposer, pour chaque structure, un ajustement
motivé par le cumul :

- Structures où il existe une **marge de manœuvre** (le cumul est en dessous de ce qui était
  prévu à ce stade) : la contrainte peut être relâchée.
- Structures où il faut **durcir** (le cumul dérive vers la limite) : la contrainte doit être
  resserrée.
- Structures **inchangées**.

Présenter sous forme de tableau : structure / contrainte de référence / contrainte proposée /
motif en une ligne / cumul actuel par rapport au prévisionnel. Chaque ligne est éditable et
peut être remise à sa valeur de référence. Un bouton global « Tout remettre aux contraintes de
référence ».

Prévoir un export du jeu de contraintes retenu (le physicien le ressaisit dans le TPS).

### Moment D — Fin de traitement

Rapport de synthèse de l'ensemble du traitement réalisé, consultable et exportable en PDF.

Contenu : dose cumulée finale par structure comparée à l'objectif initial, historique des
séances sous forme de frise (une ligne par séance, avec ATP/ATS, verdicts qualité et
déformation, dose retenue), écarts notables et leur explication, liste des séances exclues ou
dégradées.

## 4. Briques logicielles existantes — ne pas les redessiner

L'éditeur de cet outil (AQUILAB by Coexya) dispose déjà de composants industrialisés et
validés pour tout ce qui relève de la visualisation et de l'évaluation dosimétrique. La
maquette **réutilise** ces composants, elle ne les réinvente pas.

Composants considérés comme existants et disponibles :

- visualiseur d'images multimodal, avec fusion et affichage de contours ;
- affichage de distribution de dose en isodoses superposées à l'image ;
- courbes DVH, comparaison de plusieurs DVH sur un même graphique ;
- recalage rigide et déformable, comparaison de contours ;
- sommation de doses ;
- entrées/sorties DICOM et DICOM RT ;
- socle web multi-utilisateurs et gestion de bases patients.

**Instruction pour la maquette :** partout où l'un de ces composants intervient, le
représenter par un bloc à l'échelle réelle qu'il occupera, avec un rendu simplifié mais
crédible (une vraie silhouette de courbe DVH, une vraie coupe axiale avec isodoses) et le
libellé « composant existant » en légende discrète. Ne pas passer d'effort de conception
dessus, ne pas en proposer de variantes, ne pas les enrichir de fonctions nouvelles.

**Là où l'effort de conception doit se concentrer**, parce que rien n'existe encore :

- les trois verdicts de la séance (qualité de l'image, ampleur de la déformation, dose
  retenue) et la façon de les rendre lisibles d'un coup d'œil ;
- l'indicateur de confiance porté par chaque séance, et sa propagation au cumul ;
- la trajectoire du cumul comparée au prévisionnel, séance après séance, par structure ;
- la recommandation ATP/ATS et sa justification ;
- le tableau de proposition d'ajustement des contraintes ;
- la frise historique des séances ;
- le rapport de fin de traitement.

Autrement dit : la valeur de la maquette est dans la **couche de décision** qui s'appuie sur
les briques existantes, pas dans les briques elles-mêmes.

## 5. Les outils du workflow — et où se situe notre application

À chaque étape, l'équipe travaille dans un logiciel donné. Aucun n'est le nôtre.

| Étape | Outils utilisés par l'équipe |
|---|---|
| 1 — Planning initial | IRM Unity, TPS Monaco |
| 2 — IRM du jour | Console machine (TSM) pour activer l'acquisition IRM, TPS Monaco module fusion |
| 3 — Adaptation | TPS Monaco, modules AdaptPlan et contourage |
| 4 — Gating (CMM) | Console machine (TSM), acquisition IRM ciné 2D sagittale et coronale |

Le plan validé est ensuite exporté automatiquement vers le système d'enregistrement et de
vérification.

**Conséquences pour la maquette, importantes :**

- Notre outil est une **application séparée**, consultée à côté de Monaco et de la console,
  jamais intégrée dedans. La maquette ne doit donc jamais imiter l'interface d'un TPS, ni
  suggérer qu'elle pilote la machine, modifie un plan ou écrit dans le système
  d'enregistrement.
- Aucun échange automatisé n'est supposé. Ce que l'outil produit doit pouvoir être
  **retranscrit à la main** par le physicien dans Monaco. Le tableau de contraintes du moment C
  doit donc afficher des valeurs propres, arrondies, faciles à lire et à ressaisir, avec une
  fonction de copie et d'impression.
- Au moment B, les mains de l'utilisateur sont sur la console ou dans Monaco. Notre écran est
  **regardé, pas manipulé**. D'où l'exigence d'un verdict lisible sans interaction, et de deux
  boutons seulement.
- Les données arrivent chez nous par export DICOM depuis Monaco, donc **après** la séance. Cela
  confirme que toute l'évaluation lourde se fait entre les séances, et qu'à la séance N on ne
  fait que consulter un résultat déjà calculé.

## 6. Les données manipulées, étape par étape

Le traitement suit toujours la même chaîne :

**Planning initial → IRM du jour → Adaptation → Gating (CMM)**

Chaque étape produit des objets DICOM que l'outil consomme. Ce sont les noms à afficher
tels quels dans l'interface, dans les panneaux « données de la séance », les journaux et les
info-bulles. Ne pas les traduire, ne pas en inventer d'autres.

### Étape 1 — Planning initial (une seule fois, avant la première séance)

Donnée d'entrée : **CTp**, le scanner de planification.

Données produites :

| Objet | Nature | Rôle pour l'outil |
|---|---|---|
| **IRMp** | Image IRM de planification | Image de base du dossier |
| **RTSSp** | Contours de référence (cibles et OAR) | Structures de référence de tout le suivi |
| **RTPp** | Plan de traitement de référence | Source des contraintes de référence |
| **RTDosep** | Distribution de dose de référence | Prévisionnel auquel le cumul est comparé |
| **Reg CTp–IRMp** | Recalage rigide entre scanner et IRM de planification | Porte l'affectation des densités |
| **IRMref** | Image de référence du suivi | Référentiel unique de toutes les sommations |

Point important sur **IRMref** : c'est l'IRMp dans le cas standard, mais l'utilisateur peut
désigner l'image d'une autre séance comme référence (typiquement J1 comme référence pour J2).
L'outil doit donc afficher explicitement, dans l'en-tête du dossier, quelle image sert de
référence, et permettre de la consulter. **L'IRMref n'est jamais modifiée en cours de
traitement** : le référentiel est stable du début à la fin, ce qui garantit que les
sommations ne chaînent pas les erreurs de recalage.

### Étape 2 — IRM du jour (à chaque séance)

| Objet | Nature | Rôle pour l'outil |
|---|---|---|
| **IRMj** | Image IRM de la séance | Support du contrôle qualité image et de l'évaluation de déformation |
| **Reg IRMj / IRMref** | Recalage rigide sur la référence | Fournit les décalages patient en x, y, z |

Les décalages de table appliqués lors d'une séance ATP ne sont pas disponibles en tant que
tels ; ils sont contenus implicitement dans ce recalage rigide. Voir section 8.

### Étape 3 — Adaptation (seulement si la voie ATS a été retenue)

| Objet | Nature | Rôle pour l'outil |
|---|---|---|
| **RTSSj** | Contours du jour, corrigés | Géométrie réelle de la séance |
| **RTPj** | Plan du jour réoptimisé | Balistique effectivement utilisée |
| **RTDosej** | Dose du jour calculée sur l'IRM | Première candidate pour le cumul |

Une image de vérification (**IRMv**) peut être acquise en fin d'adaptation pour contrôler que
rien n'a bougé. Elle déclenche éventuellement une reprise à l'étape 2, **mais elle n'est pas
conservée** : l'outil peut signaler qu'une reprise a eu lieu, jamais l'illustrer.

Une séance ATP ne produit aucun de ces trois objets. Elle réutilise le plan de référence,
d'où sa pauvreté en information pour le suivi.

### Étape 4 — Traitement avec gating (CMM)

| Objet | Nature | Rôle pour l'outil |
|---|---|---|
| **RTPj validé** | Plan exporté vers le système d'enregistrement et vérification | Confirme que la séance a bien été délivrée avec ce plan |
| **IRMpost** | Image 3D optionnelle après délivrance | Rarement présente ; à traiter comme facultative |

Les données produites pendant l'irradiation — imagerie ciné 2D, critère VOICE, décalages temps
réel dans les trois directions — restent dans un espace propriétaire de la machine et ne sont
pas exportées. Voir section 7.

### Objets créés par l'outil lui-même

Ceux-là n'existent pas dans le workflow machine, ils sont produits par DIMADOSE et doivent
être clairement distingués visuellement des objets ci-dessus :

- **sCT** — scanner synthétique généré à partir de l'IRM du jour ;
- **RTDose sCT** — dose recalculée sur le sCT à partir de la balistique du jour, seconde
  candidate pour le cumul ;
- **champ de déformation** entre l'IRM du jour et l'IRMref ;
- **dose cumulée** des séances 1 à N-1, accompagnée de son indicateur de confiance.

### Ce qui doit apparaître dans l'interface

Prévoir, sur les écrans du moment A et du moment D, un panneau latéral repliable listant les
objets réellement disponibles pour la séance consultée, avec pour chacun un état : présent,
absent, ou non exporté par la machine. Ce panneau est un outil de traçabilité autant que de
navigation — il rend immédiatement visible pourquoi une séance ATP est moins informative
qu'une séance ATS.

## 7. Ce que l'outil ne sait pas — à afficher honnêtement

Ce point est structurant, ne pas le masquer.

Les données acquises pendant l'irradiation elle-même (imagerie ciné 2D, critère de
recouvrement VOICE utilisé pour l'asservissement du faisceau, décalages temps réel) restent
dans un espace propriétaire de la machine et **ne sont pas récupérables**.

Conséquence : la dose cumulée affichée n'est **pas** la dose réellement délivrée. C'est la dose
du plan du jour, recalculée sur l'anatomie du jour, sans les effets des mouvements pendant la
séance. L'interface doit employer partout le terme **« dose reconstruite »** et jamais
« dose délivrée ». Prévoir une mention discrète mais permanente, avec une infobulle qui
explique la limite.

De la même façon, l'image de vérification acquise en fin d'adaptation n'est pas conservée :
on peut afficher qu'une reprise a eu lieu, pas montrer sur quelle image (voir section 6).

## 8. Points encore non tranchés — à matérialiser dans la maquette

Ce sont des questions ouvertes du projet. La maquette doit leur donner une place visible,
pour que la discussion ait lieu devant l'écran.

- **Séances ATP** : on ignore encore si les décalages de table appliqués sont récupérables.
  Prévoir dans la frise un état visuel « séance à information réduite » pour les ATP.
- **Où se fait le contrôle qualité de l'image** : au moment de la séance (temps réel, avec
  possibilité de réacquérir) ou après coup (rétrospectif, sans possibilité de réacquérir).
  La maquette traite le cas rétrospectif ; prévoir un emplacement pour un futur contrôle en
  séance.
- **Critère de comparaison entre dose IRM et dose sCT** : non arrêté. Afficher un bloc
  « critère de comparaison » paramétrable, avec deux options proposées (indice gamma, écarts
  sur points DVH cliniques).
- **Image de référence** : aujourd'hui l'IRM de planification, mais le projet vise à
  supprimer l'étape de planification préalable, auquel cas la première séance deviendra la
  référence. Traiter la référence comme un paramètre affiché et modifiable, jamais comme une
  constante câblée.

## 9. Données de démonstration à utiliser

Patient prostate, 5 séances de 7,25 Gy (36,25 Gy au total), séance en cours = séance 4.

Structures à faire figurer : PTV, prostate, rectum, vessie, urètre, têtes fémorales.

Historique fictif cohérent à mettre en scène :

| Séance | Voie | Qualité IRM | Déformation | Dose retenue | Note |
|---|---|---|---|---|---|
| 1 | ATS | Exploitable | Faible | sCT | Séance de référence |
| 2 | ATP | Exploitable | Faible | IRM | Information réduite |
| 3 | ATS | Dégradée | Importante | sCT | Remplissage rectal important |
| 4 | — | — | — | — | Séance du jour, décision à prendre |

Scénario à illustrer au moment B : la recommandation est **ATS**, motivée par le cumul rectal
qui dérive au-dessus du prévisionnel depuis la séance 3, et par une marge disponible sur la
vessie.

## 10. Style et langage

- Français, vocabulaire de radiothérapie, sigles conservés tels quels : ATP, ATS, PTV, OAR,
  DVH, sCT, IRM, TPS.
- Interface sobre, orientée outil clinique. Pas de dégradés, pas d'illustration décorative.
- Codes couleur : un vert pour conforme, un ambre pour vigilance, un rouge pour dépassement.
  N'utiliser la couleur que pour ces états, nulle part comme ornement.
- Densité d'information élevée acceptée aux moments A, C et D. Densité très faible imposée au
  moment B.
- Afficher systématiquement, à côté de chaque valeur cumulée, ce qui était prévu au même
  stade. Une valeur seule n'a aucun sens pour l'utilisateur.

## 11. À ne pas faire

- Ne pas présenter la dose reconstruite comme une mesure.
- Ne pas afficher de contours, volumes ou DVH du jour au moment B.
- Ne pas automatiser une décision, ni pré-cocher une option irréversible.
- Ne pas fusionner les quatre moments en un seul tableau de bord.
- Ne pas inventer de données que la machine n'exporte pas (suivi temps réel, VOICE,
  image de vérification).