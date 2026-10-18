# Yay Medical English

Cartes de révision type Anki pour apprendre le vocabulaire **anglais américain** des niveaux **B2 et C1**, pensées pour un étudiant en médecine arabophone qui se prépare à exercer dans un hôpital américain : cours et TD, présentation de cas, lecture d'articles, stages et consultations, USMLE, ECFMG, inscription auprès du *state medical board*… et la vie quotidienne d'un expatrié.

- **2 073 entrées** (62 % médical, 38 % langue générale), 17 thèmes, deux exemples en anglais par mot.
- Face question **en arabe**, toujours en premier ; interface entièrement en anglais américain.
- Moteur de répétition espacée fidèle à Anki (4 boutons, facteur de facilité, réapprentissage, cartes problématiques).
- Progression fondée sur la **maîtrise réelle** : un mot est *ancré* quand son intervalle atteint 21 jours ; rangs de carrière médicale et « situations de travail ». Aucun point.
- PWA installable, **100 % hors ligne**, sans framework ni dépendance.

## Lancer en local

```bash
python3 -m http.server 8080        # ou : npm start
# puis ouvrir http://localhost:8080
```

N'importe quel serveur statique convient (le service worker ne fonctionne pas en `file://`). Tous les chemins sont relatifs : l'app marche aussi dans un sous-dossier.

Tests unitaires du moteur, du correcteur et des fichiers mis en cache (Node 18+) :

```bash
npm test
```

## Déployer

Le dossier se publie tel quel sur n'importe quel hébergement statique.

**GitHub Pages** : *Settings → Pages → Build and deployment → Source : Deploy from a branch*, branche `main`, dossier `/ (root)`. Le fichier `.nojekyll` désactive Jekyll. L'app est alors servie à `https://<utilisateur>.github.io/yaymedicalenglish/`.

À chaque modification d'un fichier de l'app, **incrémentez `CACHE_VERSION`** dans `sw.js` (`yme-v1` → `yme-v2`…) : les utilisateurs verront le message « A new version is available — Update ». Si vous ajoutez un fichier, ajoutez-le aussi à la liste `ASSETS` de `sw.js` (le test `tests/assets.test.js` le vérifie).

## Installer sur un téléphone

- **Android (Chrome)** : ouvrir l'URL, menu ⋮ → *Installer l'application* (ou *Ajouter à l'écran d'accueil*).
- **iPhone / iPad (Safari)** : ouvrir l'URL, bouton Partager → *Sur l'écran d'accueil*.

Ouvrez l'app une fois en ligne : tout est mis en cache à l'installation, ensuite elle fonctionne sans réseau. La progression est enregistrée dans le `localStorage` du téléphone (clé `yme-progress`, versionnée), indépendamment du cache ; *Settings → Export progress* permet d'en faire une sauvegarde JSON et de la réimporter sur un autre appareil.

## Mettre à jour le vocabulaire

Le vocabulaire source est dans `data/*.txt`, un fichier par thème, une entrée par ligne :

```
ID | english | arabic | level | nature | article | plural | info | alt | example 1 | example 2
ANA009 | vertebra | فقرة | C1 | n | a | vertebrae | - | - | The fracture involved the fifth lumbar vertebra. | Each vertebra has a body and an arch.
```

- `nature` : `n`, `v`, `adj`, `adv`, `expr` ; `article` : `a` / `an` pour les noms comptables, `-` sinon ; `-` pour un champ vide ; `alt` : réponses acceptées séparées par `;`.
- Pour les verbes irréguliers, indiquez les formes dans `info` (`irregular: bled, bled`) : elles servent à repérer et mettre en gras le mot dans les exemples.
- Ne renumérotez jamais un `id` : la progression y est attachée. Ajoutez de nouveaux numéros à la suite.

Puis régénérez `vocabulaire.js` :

```bash
npm run build        # node tools/build-vocab.js  (validation seule : npm run check)
```

Le script **refuse de générer** le fichier en cas d'erreur. Il vérifie notamment : doublons anglais (erreur) et doublons de traduction arabe (avertissement), forme des phrases (majuscule, ponctuation finale, espaces), présence du mot ou de son radical dans les deux exemples, au moins 4 entrées par couple thème × nature (pour les QCM), article a / an cohérent avec le son initial pour les noms comptables et dans toutes les phrases (après un auto-test qui s'assure que des erreurs injectées sont bien détectées), orthographe américaine (pas de *haemorrhage*, *colour*, *centre*…). Pensez ensuite à incrémenter `CACHE_VERSION`.

La langue cible est déclarée une seule fois, dans `vocabulaire.js` (`TARGET_LANGUAGE = "en-US"`).

## Organisation

| Fichier | Rôle |
|---|---|
| `vocabulaire.js` | Vocabulaire généré, commenté par thème et par niveau |
| `js/engine.js` | Moteur de répétition espacée (sans DOM, testable sous Node) |
| `js/corrector.js` | Correction des réponses tapées |
| `js/progress.js` | Rangs, situations de travail, série de jours |
| `js/storage.js` | Sauvegarde versionnée, export / import |
| `js/sounds.js` | Sons synthétisés (Web Audio) |
| `js/strings.js` | Tous les textes de l'interface |
| `js/wordmatch.js` | Repérage du mot dans les exemples et règle a / an |
| `js/app.js` | Interface |
| `tools/build-vocab.js` | Validation + génération du vocabulaire |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA |

## Règles du moteur

- Facilité initiale 2,5, jamais sous 1,3 ; en révision : Again −0,20, Hard −0,15, Good 0, Easy +0,15.
- Carte neuve : étapes 1 min puis 10 min ; sortie à 1 jour (Good) ou 4 jours (Easy). Hard sur la première étape = 6 min (moyenne des deux étapes, comme Anki).
- Révision : Hard ×1,2, Good ×facilité, Easy ×facilité×1,3 (chaque bouton donne au moins un jour de plus que le précédent), variation aléatoire ±5 %.
- Again en révision : réapprentissage à 10 min, intervalle suivant = moitié de l'ancien (minimum 1 jour). 8 échecs → carte signalée « problem card ».
- Plafonds réglables : 30 nouvelles cartes et 300 révisions par jour. La journée bascule à 4 h du matin.
- Nouvelles cartes : B2 puis C1, thèmes alternés par paquets de 5 (ou ordre mélangé stable avec *Shuffle*).

Polices : Inter, Space Grotesk et Noto Sans Arabic (SIL Open Font License, voir `fonts/`).
