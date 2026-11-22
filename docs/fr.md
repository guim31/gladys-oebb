# ÖBB

Les prochains trains de vos gares en Autriche, dans Gladys : Railjet, Intercity, REX, S-Bahn, et
les bus, trams et U-Bahn que l'horaire des ÖBB couvre aussi, en temps réel, avec retards, voies et
suppressions.

Les données viennent de [Scotty](https://fahrplan.oebb.at), l'horaire public des ÖBB : **ni
compte, ni clé**. C'est un usage **non officiel** de ses tableaux de départs publics, pas une API
officielle : il peut changer sans préavis. Cette intégration n'est pas affiliée aux ÖBB
(Österreichische Bundesbahnen).

> **Développée hors d'Autriche : vos retours sont les bienvenus.** Elle a été construite et testée
> sur le vrai service Scotty (Wien Hbf, Salzburg Hbf, petites gares de Salzbourg et de Carinthie),
> pas encore à l'usage quotidien.

## Ce que vous obtenez

- **Un appareil par gare suivie**, filtré au besoin par type de transport (trains, grandes lignes,
  régional, transport urbain) et par une gare de passage : minutes avant le prochain départ et le
  suivant, retard du prochain, son heure, son train et sa direction (« 12:07 RJX 161 → Wien
  Hbf »), sa voie, et le nombre de trains supprimés au tableau.
- **Un widget de tableau de bord** : les prochains départs d'une gare, colorés selon le retard,
  suppressions comprises.
- **Trois déclencheurs de scène** : il est temps de partir (1 à 30 minutes avant un départ, le
  temps qu'il vous faut pour rejoindre la gare), train en retard (5 à 60 minutes) et train
  supprimé, chacun une fois par train.
- **Une action de scène** : lire les prochains trains d'une gare, avec une phrase prête à envoyer
  par message ou sur une enceinte.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Un accès à Internet depuis la machine de Gladys (l'intégration appelle `fahrplan.oebb.at`).

## Installation

1. Dans Gladys, ouvrez **Intégrations → Installer depuis GitHub**.
2. Collez `https://github.com/guim31/gladys-oebb` et installez.
3. Ouvrez l'onglet **Configuration** de l'intégration pour suivre des gares (ci-dessous).

## Configuration

### Réglages

- **Langue des textes** : langue des noms de fonctionnalités, des textes des appareils et des
  phrases envoyées à vos scènes (français par défaut). Les noms sont fixés à la création d'un
  appareil.
- **Intervalle de rafraîchissement** : 1, 2 ou 5 minutes. Chaque rafraîchissement lit un tableau
  par gare suivie.

### Suivre une gare

1. **Chercher une gare** : tapez son nom ou une partie (« Salzburg », « Wien Hbf », « Linz »). La
   réponse liste les gares trouvées avec leur numéro, comme `[8100002]`. La recherche de Scotty
   est tolérante : elle propose toujours quelque chose, même loin.
2. **Suivre une gare** : tapez son nom complet ou son numéro. Filtres facultatifs :
   - **Type de transport** : trains seulement (Railjet, ICE, IC, EC, Nightjet, REX, R, CJX,
     S-Bahn), grandes lignes seulement, régionaux seulement (REX, R, CJX, S-Bahn) ou transport
     urbain seulement (U-Bahn, tram, bus). Vide : tout ce que dessert l'arrêt.
   - **Gare de passage** : ne garde que les départs qui s'y arrêtent ensuite — `Linz/Donau Hbf`
     depuis Wien garde les trains vers l'ouest, quelle que soit leur destination finale.
     Un nom qui correspond à plusieurs gares répond par leur liste : tapez le nom complet ou le
     numéro.
3. Ouvrez l'onglet **Découverte** et créez l'appareil.

La même gare peut être suivie plusieurs fois avec d'autres filtres : chacune est un appareil. Les
grandes gares ont plusieurs entrées dans Scotty (Wien Hbf (U) couvre tout le pôle, Wien Hbf
(Bahnsteige 3-12) seulement les quais principaux) : choisissez celle dont vous voulez le tableau.

### Retirer, vérifier l'état

- **Ne plus suivre une gare** : tapez le nom affiché par **État**. Son appareil reste dans Gladys
  jusqu'à ce que vous le supprimiez.
- **État** : les gares suivies, si leur appareil est créé, la dernière lecture de Scotty et la
  dernière erreur.

Un échec (rien trouvé, Scotty injoignable) s'affiche en rouge, un succès en vert.

## Appareils

Chaque gare suivie a six fonctionnalités :

| Fonctionnalité                | Valeur                                                                   |
| ----------------------------- | ------------------------------------------------------------------------ |
| Prochain train                | minutes avant le prochain départ qui circule ; 1440 si aucun n'est prévu |
| Train suivant                 | minutes avant le suivant ; 1440 si aucun                                 |
| Retard du prochain train      | minutes de retard (un train en avance compte à l'heure) ; 0 si aucun     |
| Prochain train et destination | « 12:07 RJX 161 → Wien Hbf », ou « Aucun train annoncé »                 |
| Voie du prochain train        | la voie annoncée par Scotty, changements compris ; « – » si inconnue     |
| Trains supprimés              | le nombre de départs supprimés au tableau de la gare suivie              |

Les heures sont celles de l'Autriche, retard compris. Un train supprimé n'est jamais « le
prochain train ». Les ÖBB donnent un retard en temps réel pour la plupart des trains, pas pour
chaque bus ou tram : sans lui, le départ compte à l'heure. Entre deux lectures, les comptes à
rebours continuent depuis la dernière réponse.

## Widgets du tableau de bord

**Prochains trains** : choisissez une gare suivie. Chaque ligne montre l'heure et la direction,
puis l'attente, le train, sa voie et son retard : vert à l'heure, orange dès 3 minutes de retard,
rouge dès 10 ou s'il est supprimé. Réglages : le nombre de départs affichés (3 à 10), la légende
et les trains supprimés, qu'on peut masquer. Le titre est le nom de l'appareil dans Gladys.

## Déclencheurs de scène

- **Il est temps de partir** : un train part de la gare choisie dans le nombre de minutes choisi
  (1 à 30) : choisissez le temps qu'il vous faut pour rejoindre la gare.
- **Train en retard** : un train encore à partir de la gare choisie atteint le retard choisi (5 à
  60 minutes).
- **Train supprimé** : un train encore à partir de la gare choisie est annoncé supprimé.

Chaque seuil se déclenche une fois par train. Rien ne se déclenche à la première lecture après un
démarrage : ce qui était déjà au tableau n'est pas une nouvelle. Variables : gare, destination,
catégorie (RJX, REX, S…), numéro du train, minutes d'attente, retard, heure prévue et heure
théorique, voie.

## Actions de scène

**Obtenir les prochains trains** : pour une gare suivie, renvoie `sentence` (« ICE 118 pour
Münster(Westf)Hbf au départ de Salzburg Hbf : dans 1 min, voie 1, puis RJX 19952 pour Ötztal dans
3 min. »), `station_name`, `destination`, `category`, `train_number`, `minutes`,
`following_minutes`, `delay`, `expected_time`, `scheduled_time`, `platform` et `cancelled` (nombre
de trains supprimés). Sans train, `minutes` vaut 1440 et la phrase le dit.

## Exemples de scènes

- _Chaque jour de semaine à 7 h 30_ → **Obtenir les prochains trains** (St. Pölten Hbf, trains, via
  Wien Hbf) → envoyer `sentence` sur votre téléphone.
- **Il est temps de partir** (votre gare, 12 min) → l'annoncer sur une enceinte.
- **Train supprimé** (votre gare) → envoyer un message avec le numéro du train et son heure.

## Données, rafraîchissement et quotas

L'intégration lit, pour les seuls appareils créés, le tableau des départs de chaque gare suivie
(`stboard.exe`, les 20 prochains départs, filtrés par Scotty lui-même) à l'intervalle choisi ; la
recherche de gares (`ajax-getstop.exe`) seulement quand vous cherchez ou ajoutez une gare. Les ÖBB
ne publient ni quota ni conditions pour cet usage : gardez-le personnel. Une requête par gare
suivie et par minute au plus reste un usage léger. Seul `/data/watch.json` est écrit : les gares
suivies et leurs filtres.

## Dépannage

- **Pas de valeur sur un nouvel appareil** : attendez le prochain rafraîchissement (une minute),
  ou consultez **État**.
- **« Scotty est illisible »** : le site est injoignable ou répond une page d'erreur ;
  l'intégration réessaie à chaque rafraîchissement et les comptes à rebours continuent.
- **Un train manque** : il est parti, ou il est au-delà des 20 prochains départs, ou il ne
  correspond pas aux filtres de la gare suivie.
- **Logs** : réglez `LOG_LEVEL=debug` pour voir chaque lecture.

## Limites

- Les départs que montre Scotty : ÖBB, les chemins de fer privés, les bus et trams de son horaire.
  Les trains de la Westbahn apparaissent quand Scotty les liste.
- Les pages publiques de Scotty sont non officielles et non documentées : un changement de leur
  côté peut casser l'intégration jusqu'à une mise à jour.
- La suppression d'un seul arrêt ou une suppression partielle peut ne pas être signalée.
- 10 gares suivies au plus. Les noms de fonctionnalités sont fixés à la création de l'appareil.

## Crédits

Données : [Scotty](https://fahrplan.oebb.at), ÖBB. Les pages de tableau des départs utilisées
sont celles des moniteurs de départs de la communauté (capteur `oebb` de Home Assistant, MIT).
Logo de la couverture : ÖBB (marque de son propriétaire).
