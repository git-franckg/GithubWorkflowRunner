# GitHub Workflow Reporter

Un système simple pour exécuter des scripts dans GitHub Actions et conserver leurs résultats dans un Gist.

## Objectif

Permettre l'exécution facile de scripts dans GitHub Actions tout en conservant de manière permanente leurs résultats. Au lieu de perdre les outputs dans les logs de GitHub Actions (qui expirent), ce système sauvegarde automatiquement tous les résultats dans un Gist GitHub.

## Cas d'usage

- Exécuter des scripts de scraping périodiques et conserver les données
- Lancer des scripts de monitoring et garder l'historique
- Collecter des statistiques au fil du temps
- Sauvegarder n'importe quel output de script pour analyse ultérieure

## Fonctionnement

1. Vos scripts écrivent leurs résultats dans des fichiers (format libre, ligne par ligne)
2. Le reporter détecte automatiquement ces fichiers
3. Il les ajoute au Gist existant pour conserver l'historique complet
4. Les fichiers locaux sont supprimés après upload réussi

## Installation

```bash
# Installer les dépendances
yarn install
```

## Configuration

Variables d'environnement requises :
- `GIST_ID` : L'ID du Gist où stocker les résultats
- `GITHUB_TOKEN` : Token GitHub avec permission `gist`

## Utilisation dans GitHub Actions

```yaml
name: Mon Script Périodique

on:
  schedule:
    - cron: '0 */6 * * *'  # Toutes les 6 heures

jobs:
  run-script:
    runs-on: ubuntu-latest
    steps:
      - name: Exécuter mon script
        run: |
          # Votre script qui produit des résultats
          echo "Résultat du $(date)" > /app/results/output.txt
          curl https://api.example.com/data >> /app/results/data.jsonl
          
      - name: Sauvegarder les résultats
        uses: docker://your-reporter-image
        env:
          GIST_ID: ${{ secrets.GIST_ID }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Format des résultats

Aucun format imposé ! Écrivez simplement vos résultats ligne par ligne :

```
2025-07-16 10:00:00 - Début du traitement
2025-07-16 10:00:05 - 150 éléments trouvés
2025-07-16 10:00:10 - Traitement terminé avec succès
```

Ou en JSON si vous préférez :
```
{"date":"2025-07-16","count":150,"status":"ok"}
{"date":"2025-07-17","count":162,"status":"ok"}
```

## Structure du projet

```
.
├── reporter-src/
│   ├── main.ts          # Reporter qui upload vers Gist
│   └── main.test.ts     # Tests unitaires
├── src/
│   └── index.ts         # Exemple de script qui génère des résultats
├── package.json
└── README.md
```

## Fonctionnalités

- ✅ Conservation permanente des résultats dans un Gist
- ✅ Support de n'importe quel format de fichier
- ✅ Agrégation automatique avec l'historique existant
- ✅ Scan toutes les 3 minutes
- ✅ Nettoyage automatique après upload
- ✅ Résistant aux erreurs réseau

## Tests

```bash
# Lancer les tests
yarn vitest

# Mode watch pour le développement
yarn vitest --watch
```

## Développement local

Pour tester localement :

```bash
# 1. Créer un Gist de test sur GitHub

# 2. Lancer le script d'exemple qui génère des résultats
yarn tsx src/index.ts

# 3. Dans un autre terminal, lancer le reporter
GIST_ID=votre_gist_id GITHUB_TOKEN=votre_token yarn tsx reporter-src/main.ts
```

## Avantages

- **Simplicité** : Écrivez vos résultats dans des fichiers, c'est tout
- **Persistance** : Les résultats sont conservés indéfiniment dans un Gist
- **Historique** : Tous les résultats passés restent accessibles
- **Flexibilité** : Aucun format imposé, adaptable à tout type de script

## Exemple de Gist résultant

Après plusieurs exécutions, votre Gist contiendra l'historique complet :

```
=== Exécution du 2025-07-16 10:00 ===
Données collectées : 150 éléments
Temps de traitement : 5.2s

=== Exécution du 2025-07-16 16:00 ===
Données collectées : 162 éléments
Temps de traitement : 5.5s

=== Exécution du 2025-07-16 22:00 ===
Données collectées : 143 éléments
Temps de traitement : 4.9s
```