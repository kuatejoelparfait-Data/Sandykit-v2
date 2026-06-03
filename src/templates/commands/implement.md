---
description: Implémenter les tâches du plan en TDD. Lit automatiquement les specs générées par sandykit dev ou sandykit.tasks.
handoffs:
  - label: Réviser le code
    agent: sandykit.review
    prompt: Révise l'implémentation
  - label: Voir l'état du projet
    agent: sandykit.continue
    prompt: Montre l'état actuel du projet
---

## Entrée utilisateur

$ARGUMENTS

(optionnel : numéro de tâche, nom de feature, ou vide pour reprendre automatiquement)

## Étapes

### 1. Trouver le dossier de travail

**Priorité 1** — lis `.sandykit/last-session.json` si présent → utilise `featureDir`

**Priorité 2** — si un argument est fourni, cherche le dossier `specs/` correspondant

**Priorité 3** — scanne `specs/` et prends le dossier le plus récent avec `tasks.md`

### 2. Lire les fichiers de contexte

Dans le dossier trouvé, lis dans cet ordre :
1. `tasks.md` — liste des tâches (vérifie les `- [x]` déjà cochées)
2. `plan.md` — architecture, stack, structure des fichiers
3. `spec.md` — exigences fonctionnelles et critères de succès

**Ne régénère RIEN.** Ces fichiers contiennent déjà tout le contexte.

### 3. Identifier les tâches restantes

- Tâches cochées `- [x]` → déjà faites, skip
- Tâches non cochées `- [ ]` → à implémenter
- Si filtre fourni en argument → commence par cette tâche

Annonce : `X tâche(s) restante(s) sur Y au total`

### 4. Pour chaque tâche non cochée (dans l'ordre)

**a. Annonce la tâche**
```
## Tâche N : [Titre]
```

**b. Écris le test d'abord (TDD)**
- Test unitaire qui échoue pour le comportement attendu
- Lance les tests → confirme qu'ils échouent

**c. Implémente le code minimal**
- Juste ce qu'il faut pour faire passer les tests
- Respecte les patterns existants dans le projet
- Respecte la stack du `plan.md`

**d. Lance les tests** → confirme qu'ils passent

**e. Commit**
```
git add [fichiers modifiés]
git commit -m "feat([nom-feature]): [description courte]"
```

**f. Coche la tâche dans `tasks.md`**
```
- [x] [titre de la tâche]
```

### 5. Rapport final

```
Implémentation terminée

Tâches complétées : X/Y
Tests passants   : N
Fichiers créés   : [liste]
Fichiers modifiés: [liste]

Prochaine étape : /sandykit.review
```

## Règles absolues

- **Ne jamais régénérer spec.md, plan.md ou tasks.md** — ils existent déjà
- **Ne jamais skipper les tests** — TDD obligatoire
- **Commit après chaque tâche** — pas de mega-commit final
- **Si bloqué** : documente le blocage dans `tasks.md` et passe à la suivante
- **Respecter la stack** du `plan.md` — ne pas inventer une autre technologie
