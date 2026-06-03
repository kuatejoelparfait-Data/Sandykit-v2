---
description: Générer le plan technique d'implémentation depuis la spécification.
handoffs:
  - label: Créer les tâches
    agent: sandykit.tasks
    prompt: Décompose le plan en tâches
---

## Entrée utilisateur

$ARGUMENTS

## Étapes

1. **Trouve la spec** :
   - Cherche `specs/NNN-nom/spec.md` (dernier dossier modifié ou spécifié en argument)
   - Lis et analyse la spécification complète

2. **Analyse le projet existant** :
   - Lis les fichiers de configuration à la racine (package.json, pyproject.toml, go.mod, etc.)
   - Identifie le langage, les dépendances, les patterns existants
   - Si nouveau projet : propose le stack optimal pour les besoins de la spec

3. **Génère `specs/NNN-nom/plan.md`** en utilisant la structure ci-dessous

## Structure du fichier plan.md à générer

```markdown
# Plan Technique : [NOM FEATURE]

**Créé** : [DATE]
**Spec** : [lien vers spec.md]
**Statut** : Brouillon

## Résumé technique

[2-3 phrases décrivant l'approche technique]

## Stack technique

- **Langage/Version** : [ex: TypeScript 5, Python 3.11]
- **Dépendances principales** : [ex: Express, FastAPI]
- **Base de données** : [si applicable]
- **Tests** : [ex: vitest, pytest]

## Architecture

### Composants

| Composant | Rôle | Fichier(s) |
|-----------|------|-----------|
| [Composant 1] | [Rôle] | `src/...` |

### Modèle de données *(si applicable)*

### Contrats API *(si applicable)*

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/...` | [Description] |

## Risques et dépendances

- [Risque 1] → [Mitigation]
```

## Directives

- Propose le stack minimal qui répond aux besoins
- Aucune sur-ingénierie — YAGNI
- Documente les décisions et leurs raisons
