---
description: Affiner et clarifier les zones ambiguës de la spécification courante.
handoffs:
  - label: Créer le plan technique
    agent: sandykit.plan
    prompt: Crée le plan technique pour cette spec
---

## Étapes

1. **Trouve la spec courante** :
   - Cherche la spec la plus récente dans `specs/` (dernier dossier modifié)
   - Lis `specs/NNN-nom/spec.md`

2. **Identifie les zones floues** :
   - Repère tous les `[BESOIN DE CLARIFICATION]`
   - Identifie les exigences vagues ou non-testables
   - Note les hypothèses qui pourraient être incorrectes

3. **Pose des questions ciblées** (maximum 5) :
   - Une question par zone floue
   - Propose des options quand c'est possible
   - Format :

## Question 1 : [Sujet]
**Contexte** : [Citation de la spec]
**Question** : [Question précise]
**Options suggérées** :
- A) [Option A] → [Implication]
- B) [Option B] → [Implication]
- C) Autre : [précise]

4. **Attends les réponses** de l'utilisateur

5. **Met à jour `spec.md`** avec les clarifications reçues :
   - Remplace chaque `[BESOIN DE CLARIFICATION]` par la réponse
   - Met à jour le statut : `Brouillon` → `Clarifié`
   - Ajoute une section `## Clarifications` avec la date et les décisions prises
