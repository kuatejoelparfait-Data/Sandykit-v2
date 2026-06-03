---
description: Réviser l'implémentation et vérifier la conformité avec la spécification.
---

## Étapes

1. **Lis la spec** : `specs/NNN-nom/spec.md`
2. **Lis le plan** : `specs/NNN-nom/plan.md`
3. **Lis les tâches** : `specs/NNN-nom/tasks.md`
4. **Analyse le code** implémenté (fichiers listés dans tasks.md)

5. **Génère `specs/NNN-nom/review.md`** :

```markdown
# Révision : [NOM FEATURE]

**Date** : [DATE]
**Statut** : [✅ Conforme / ⚠️ Problèmes mineurs / ❌ Non conforme]

## Conformité spec

| Exigence | Statut | Notes |
|----------|--------|-------|
| [Exigence 1] | ✅ / ❌ | [Observation] |

## Qualité du code

### Points forts
- [Point fort 1]

### Problèmes identifiés

| Sévérité | Fichier | Problème | Recommandation |
|----------|---------|---------|----------------|
| 🔴 Critique | `src/...` | [Problème] | [Fix] |
| 🟡 Mineur | `src/...` | [Problème] | [Fix] |

## Critères de succès

| Critère | Vérifié | Notes |
|---------|---------|-------|
| [Critère 1] | ✅ / ❌ | |

## Verdict

[Résumé en 2-3 phrases. Prêt à merger ou actions requises.]
```

## Règles de révision

- Vérifie chaque exigence de la spec individuellement
- Cherche : sécurité, performance, maintenabilité
- Sois précis : cite les fichiers et lignes concernés
- Prioritise les problèmes critiques (sécurité > correctness > style)
