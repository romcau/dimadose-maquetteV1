# Ressources graphiques

Déposer ici le logo DIMADOSE, sous le nom `logo-dimadose.svg`.

Le composant `src/components/DimadoseLogo.tsx` ne porte aujourd'hui que le
wordmark — les lettres — repris du logo vectoriel d'origine. Le symbole (le
viseur, le bassin, le maillage) demande le fichier : il ne se redessine pas
de mémoire sans trahir la marque.

**SVG de préférence** : il reste net à toutes les tailles, pèse quelques
kilo-octets et se recolore pour les fonds sombres de l'en-tête et de la barre
latérale. Un PNG en haute résolution convient aussi, mais il en faudra deux
variantes — une claire, une sombre.
