---
description: Revenir à l'étape précédente du pipeline et corriger avant de continuer.
handoffs:
  - label: Réécrire la spécification
    agent: sandykit.specify
    prompt: Réécris la spec depuis le début
  - label: Affiner la spec
    agent: sandykit.clarify
    prompt: Affine les zones floues
  - label: Recréer le plan
    agent: sandykit.plan
    prompt: Recrée le plan technique
  - label: Recréer les tâches
    agent: sandykit.tasks
    prompt: Recrée la décomposition en tâches
---

## Entrée utilisateur

$ARGUMENTS

## Étapes

1. **Identifie la feature ciblée** :
   - Si `$ARGUMENTS` précise un nom de feature, utilise-le
   - Sinon, scanne `specs/` et liste les features avec leur état actuel
   - Demande à l'utilisateur quelle feature modifier si ambiguïté

2. **Détecte l'étape actuelle** :
   - Vérifie quels fichiers existent dans `specs/NNN-nom-feature/` :
     - `spec.md` → étape Specify atteinte
     - `plan.md` → étape Plan atteinte
     - `tasks.md` → étape Tasks atteinte
     - `implement.md` → étape Implement atteinte
     - `review.md` → étape Review atteinte

3. **Propose le retour en arrière** :
   - Affiche l'étape actuelle et les étapes précédentes disponibles
   - Demande à quelle étape revenir
   - Explique ce qui sera modifié (pas supprimé)

4. **Ouvre le fichier concerné** et guide la correction :
   - Lis le contenu actuel du fichier cible
   - Identifie les zones à améliorer
   - Propose des corrections concrètes

5. **Met à jour le fichier** avec les corrections validées par l'utilisateur

6. **Invalide les étapes suivantes si nécessaire** :
   - Si le plan change → avertis que tasks.md devra être révisé
   - Si la spec change → avertis que plan.md et tasks.md devront être révisés
   - Ne supprime **jamais** de fichier sans confirmation explicite

## Règles

- **Ne jamais supprimer** un fichier existant sans confirmation
- **Toujours expliquer** l'impact d'un retour en arrière sur les étapes suivantes
- **Conserver l'historique** — ajouter une note de révision en bas du fichier modifié
- Le format de note de révision : `> **Révisé le [DATE]** : [raison du changement]`
