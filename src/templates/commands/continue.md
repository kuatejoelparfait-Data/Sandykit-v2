---
description: Reprendre exactement là où sandykit dev s'est arrêté. Détecte automatiquement l'état du projet et suggère la prochaine action.
handoffs:
  - label: Implémenter les tâches
    agent: sandykit.implement
    prompt: Implémente les tâches restantes
  - label: Réviser le code
    agent: sandykit.review
    prompt: Révise l'implémentation complète
---

## Ce que tu dois faire

$ARGUMENTS

## Étapes

### 1. Lire l'état de la session (priorité 1)

Lis le fichier `.sandykit/last-session.json` s'il existe :

```json
{
  "projectName": "...",
  "featureDir": "specs/001-mon-projet",
  "completedSteps": ["spec", "plan", "tasks", "implement"],
  "updatedAt": "..."
}
```

Si le fichier n'existe pas, passe à l'étape 2.

### 2. Scanner specs/ pour trouver le projet actif (fallback)

- Liste tous les dossiers dans `specs/` (format `NNN-nom`)
- Pour chaque dossier, vérifie quels fichiers existent :
  - `spec.md` → spec faite
  - `plan.md` → plan fait
  - `tasks.md` → tâches générées
  - `implement.md` → implémentation faite
  - `review.md` → revue faite
- Prends le dossier le plus récemment modifié comme projet actif
- Si plusieurs projets actifs, liste-les et demande lequel reprendre

### 3. Afficher le tableau de bord

Affiche clairement l'état :

```
Projet : [NOM]
Dossier : specs/NNN-nom/

  ✓ Spécification    specs/NNN-nom/spec.md
  ✓ Plan technique   specs/NNN-nom/plan.md
  ✓ Tâches          specs/NNN-nom/tasks.md
  ✓ Implémentation  specs/NNN-nom/implement.md
  ○ Revue code      (pas encore fait)
```

### 4. Recommander la prochaine action

Selon ce qui manque, dis exactement quoi faire :

**Si spec manque** → Lance `/sandykit.specify` en décrivant ton projet
**Si plan manque** → Lance `/sandykit.plan` (la spec est prête dans specs/NNN-nom/spec.md)
**Si tâches manquent** → Lance `/sandykit.tasks`
**Si implémentation manque** → Lance `/sandykit.implement`
**Si tout est fait sauf revue** → Lance `/sandykit.review`
**Si tout est fait** → Le projet est complet. Tu peux lancer `/sandykit.specify` pour une nouvelle feature.

### 5. Si l'implémentation existe déjà (sandykit dev a tourné)

Lis `specs/NNN-nom/tasks.md` et vérifie quelles tâches sont cochées (`- [x]`) vs non cochées (`- [ ]`).

Si des tâches restent non cochées :
- Liste les tâches restantes
- Propose de lancer `/sandykit.implement [numero-tache]` pour les tâches spécifiques

Si toutes les tâches sont cochées :
- Dis que le projet est implémenté
- Propose `/sandykit.review` pour la revue qualité

## Règles

- Ne jamais re-générer quelque chose qui existe déjà
- Toujours lire les fichiers existants avant de proposer quoi que ce soit
- Être précis : indiquer les chemins exacts des fichiers
- Si plusieurs features en cours, toujours demander laquelle reprendre
