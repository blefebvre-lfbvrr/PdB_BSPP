# Prise de bilans – Garde BSPP

Application web (PWA) pour faire un **bilan complet en garde BSPP, rapidement et sans rien oublier**,
en suivant la démarche **S · X · A · B · C · D**, puis le **rendre à son chef** : à l’oral, en le lisant à l’écran,
ou par message.
Même architecture que [Prise de bilans](https://github.com/blefebvre-lfbvrr/Prise_de_bilans).

**Aucune donnée n’est envoyée sur Internet** : pas de serveur, pas de cloud, pas de compte.
Le bilan en cours est seulement gardé dans le navigateur du téléphone (pour ne rien perdre si l’app se ferme)
et effacé avec « Supprimer ce bilan ».

## Déroulé (colonne de gauche)

| Étape | Contenu |
| --- | --- |
| **S** · Situation | Départ (motif, adresse, heures), **sécurité** (dangers, supprimé / balisé / dégagement d’urgence, renforts), **scène** (lieu, accès, témoins), **situation** (victime, que s’est-il passé, plainte, impliqués / UR / UA / décédés). |
| **X** · Hémorragie | Signes, localisation, compression, PCU, GISH, garrot avec heure de pose (durée affichée). |
| **A** · Voies aériennes | Obstruction, encombrement, désobstruction, LVA, aspiration, retrait du casque. |
| **B** · Respiration | Signes de détresse, FR (ample, régulière, symétrique…), SpO2 à l’air ou sous O2 (débit, masque). |
| **C** · Circulation | Signes de détresse, arrêt cardiaque (heure, témoin, RCP, DAE et chocs), FC, pouls, TA droite / gauche / habituelle, TRC. |
| **D** · Neurologique | Signes de détresse, Glasgow détaillé, PC, orientation, pupilles, motricité / sensibilité, FAST et heure des premiers signes. |
| Bilan compl. | **Bilans spécifiques** du mémo (malaise, douleur thoracique, asthme / OAP, douleur abdominale, AVC, convulsions, méningite, TC, traumatisme avec fiches lésion, rachis, plaie / brûlure, intoxication, grossesse / accouchement, hyper / hypothermie), **OPQRST**, signes associés, glycémie / température, antécédents **MHTA** (comme eFiBi). |
| Gestes | Position d’attente, gestes, transmission (au chef, CM, 18 / 15 / 17, contact urgent), devenir (évacuation, LSP, refus avec décharge…), horaires. |
| Surveillance | Une série de constantes horodatée à chaque contrôle, avec l’évolution. |
| Identité | Nom, naissance, adresse, téléphone, personne à prévenir. |
| Bilan | **Lire le bilan au chef** (plein écran), **Envoyer par message**, ou copier partie par partie : synthèse, circonstanciel, bilan vital (détresses en tête), complémentaire, gestes, surveillance, devenir, identité. |

Chaque lettre a sa couleur ; un « ! » rouge sur la lettre signale un signe de détresse coché.
Les valeurs anormales (FR, SpO2, FC, TA, Glasgow…) sont signalées et peuvent être cochées comme signes de détresse en un geste.
Des alertes reprennent le mémo (FR ≤ 6, SpO2 < 94 %, TA < 90 ou écart entre les bras > 20 mmHg, hypoglycémie,
classement de la température, état de mal convulsif, score de Malinas, APGAR, décision d’immobilisation du rachis…).
Chaque étape a un **aide-mémoire** repliable (mémo urgence et mémo bilans spécifiques).

Glisser le doigt sur la colonne de gauche fait défiler les étapes, comme l’index des Contacts.

## Rendre le bilan au chef

- **Lire le bilan au chef** ouvre le bilan en plein écran et en gros caractères, dans l’ordre où on le donne :
  « En bref » (la synthèse en quelques lignes), circonstanciel, signes de détresse en rouge, puis un bloc par lettre
  X, A, B, C, D, le complémentaire, les gestes, la surveillance, le devenir et l’identité.
  A− / A+ règlent la taille du texte ; l’écran reste allumé pendant la lecture (si le téléphone le permet).
- **Envoyer par message** ouvre la feuille de partage d’iOS / Android (Messages, WhatsApp…) avec le bilan complet en texte.
- Les antécédents suivent le format **MHTA** (maladies, hospitalisations, traitements, allergies), comme eFiBi.

**Plusieurs victimes** : le bouton en haut à droite liste les bilans en cours et permet de passer de l’un à l’autre.

## Installation sur iPhone

1. Ouvrir l’adresse du site dans **Safari**.
2. Bouton Partager → **Sur l’écran d’accueil**.

L’application fonctionne ensuite hors-ligne.

## Publication (GitHub Pages)

Le workflow `.github/workflows/pages.yml` lance les tests puis publie le site à chaque push sur `main`.
À activer une fois : *Settings → Pages → Source : GitHub Actions*.

Les données (`pdb-bspp:*`) et le cache hors-ligne (`pdb-bspp-*`) sont séparés de ceux de Prise de bilans,
publiée sur la même adresse GitHub Pages.

## Développement

Aucune dépendance ni compilation : HTML, CSS et JavaScript (modules ES).

```sh
python3 -m http.server 8000   # puis http://localhost:8000
npm test                      # tests du générateur de bilan (Node ≥ 20)
```

- `js/schema.js` : les étapes, les champs, leur formulation dans le bilan, les alertes et les aide-mémoire
  (à modifier pour ajouter un signe, un bilan spécifique ou changer une phrase).
- `js/report.js` : assemblage du texte du bilan et suggestions de signes de détresse.
- `js/app.js` : interface.

Contenu médical repris de la fiche bilan, du mémo urgence (v2.0, recommandations PS 2022) et du mémo
bilans spécifiques (mars 2026). L’application est une aide-mémoire : elle ne remplace ni la formation ni l’avis médical.
