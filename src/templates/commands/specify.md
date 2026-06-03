---
description: Créer ou mettre à jour la spécification fonctionnelle depuis une description en langage naturel.
handoffs:
  - label: Affiner la spécification
    agent: sandykit.clarify
    prompt: Affine les zones floues de la spec
  - label: Créer le plan technique
    agent: sandykit.plan
    prompt: Crée le plan technique pour cette spec
---

## Entrée utilisateur

$ARGUMENTS

Tu **DOIS** prendre en compte l'entrée utilisateur avant de commencer.

## Étapes

1. **Génère un nom court** (2-4 mots) pour la feature :
   - Format : `action-nom` (ex: `auth-jwt`, `dashboard-analytics`)
   - Conserve les termes techniques (JWT, OAuth2, API, etc.)

2. **Détermine le numéro de séquence** :
   - Scanne le dossier `specs/` pour trouver le dernier numéro utilisé
   - Incrémente de 1 (ex: si `002-xxx` existe → utilise `003`)
   - Si `specs/` est vide, commence à `001`

3. **Crée le répertoire et le fichier** :
   - Crée `specs/NNN-nom-feature/`
   - Crée `specs/NNN-nom-feature/spec.md` en utilisant la structure ci-dessous

4. **Remplis la spec** en analysant la description utilisateur :
   - Identifie les acteurs, actions, données, contraintes
   - Maximum 3 zones `[BESOIN DE CLARIFICATION]` — utilise des valeurs par défaut raisonnables pour le reste
   - Chaque exigence doit être testable
   - Critères de succès mesurables et sans détails d'implémentation

5. **Valide la qualité** :
   - Aucun détail d'implémentation dans la spec (pas de framework, langage, API)
   - Focalisé sur la valeur utilisateur
   - Toutes les sections obligatoires remplies

## Structure du fichier spec.md à générer

```markdown
# Spécification : [NOM FEATURE]

**Créé** : [DATE]
**Statut** : Brouillon
**Dossier** : `specs/NNN-nom-feature/`

## Scénarios utilisateur *(obligatoire)*

### Scénario 1 — [Titre] (Priorité : P1)
[Description du parcours utilisateur]
**Pourquoi cette priorité** : [Valeur apportée]

## Exigences fonctionnelles *(obligatoire)*

- [ ] [Exigence testable 1]
- [ ] [Exigence testable 2]

## Critères de succès *(obligatoire)*

- [Métrique mesurable 1]
- [Métrique mesurable 2]

## Hypothèses et contraintes

- [Hypothèse 1]

## Hors périmètre

- [Ce qui n'est pas inclus]
```

## Directives qualité

- Focus sur le **QUOI** et le **POURQUOI**, pas le COMMENT
- Écrit pour des non-techniciens
- Chaque exigence doit être indépendamment testable
