---
description: Décomposer le plan technique en tâches ordonnées et priorisées.
handoffs:
  - label: Implémenter
    agent: sandykit.implement
    prompt: Implémente toutes les tâches
---

## Étapes

1. **Lis le plan** : `specs/NNN-nom/plan.md`
2. **Lis la spec** : `specs/NNN-nom/spec.md`

3. **Décompose en tâches** selon ces règles :
   - Chaque tâche = 2-4 heures de travail maximum
   - Ordre logique (les dépendances d'abord)
   - Commence toujours par la configuration/setup
   - Inclus les tests dans chaque tâche (TDD)

4. **Génère `specs/NNN-nom/tasks.md`** :

```markdown
# Tâches : [NOM FEATURE]

**Créé** : [DATE]
**Plan** : [lien vers plan.md]
**Total** : [N] tâches

## Tâches

### Tâche 1 : [Titre] *(Priorité : P1)*

**Estimation** : [X heures]
**Dépendances** : aucune / [Tâche N]
**Fichiers** :
- Créer : `chemin/exact/fichier.ts`
- Modifier : `chemin/exact/existant.ts`

**Critères d'acceptation** :
- [ ] [Critère testable 1]
- [ ] [Critère testable 2]

---
```

## Règles de décomposition

- Setup et configuration → Tâche 1
- Modèles de données → avant les services
- Services/logique métier → avant les contrôleurs
- Tests d'intégration → en dernier
- Chaque tâche livrable indépendamment
