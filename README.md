# SANDYKIT

> Transforme tes idées en code production — spec-driven, IA-assisté, du cahier des charges au projet livré.

SANDYKIT est un outil CLI TypeScript avec **deux modes** :

- **Mode Commandes** (v2) — installe des slash commands dans ton agent IA (Claude Code, Cursor, GitHub Copilot, Codex, Anti Gravity) pour guider le développement étape par étape
- **Mode Autonome** (v3) — lit un cahier des charges, génère la spec, le plan, les tâches, le code, les tests et commit tout automatiquement

---

## Sommaire

1. [Installation](#1-installation)
2. [Mode Commandes — Développement spec-driven avec ton agent IA](#2-mode-commandes--développement-spec-driven-avec-ton-agent-ia)
3. [Mode Autonome — De l'idée au code en une commande](#3-mode-autonome--de-lidée-au-code-en-une-commande)
4. [Collaboration équipe](#4-collaboration-équipe)
5. [Partage de specs](#5-partage-de-specs)
6. [Export vers Jira / Linear](#6-export-vers-jira--linear)
7. [Référence complète des commandes](#7-référence-complète-des-commandes)
8. [Structure des fichiers générés](#8-structure-des-fichiers-générés)
9. [Providers IA supportés](#9-providers-ia-supportés)
10. [FAQ](#10-faq)

---

## 1. Installation

### Prérequis

- Node.js ≥ 18
- npm ≥ 9
- Git (recommandé)
- Un agent IA : Claude Code, Cursor, GitHub Copilot, Codex ou Anti Gravity (pour le Mode Commandes)
- Une clé API : Anthropic, OpenAI, ou Ollama installé localement (pour le Mode Autonome)

### Installer SANDYKIT globalement

```bash
git clone https://github.com/kuatejoelparfait-Data/Sandykit.git
cd Sandykit
npm install
npm run build
npm link
```

Vérifier l'installation :

```bash
sandykit --version
# 2.0.0
```

---

## 2. Mode Commandes — Développement spec-driven avec ton agent IA

Ce mode installe des slash commands dans ton agent IA. Tu gardes le contrôle : l'IA t'aide à chaque étape mais ne décide rien sans toi.

### Étape 1 — Initialiser SANDYKIT dans ton projet

Ouvre un terminal à la racine de ton projet et lance :

```bash
cd mon-projet
sandykit init
```

L'assistant interactif te demande :

1. **Le nom du projet** — utilisé pour personnaliser les commandes
2. **L'agent IA à intégrer** — choix multiple parmi :
   - `Claude Code` → installe dans `.claude/commands/`
   - `Cursor` → installe dans `.cursor/rules/`
   - `GitHub Copilot` → installe dans `.github/instructions/`
   - `Codex` → installe dans `.codex/`
   - `Anti Gravity` → installe dans `.antigravity/`

```
┌  SANDYKIT — Initialisation
│
◆  Nom du projet ?
│  Mon API REST
│
◆  Agent(s) IA à intégrer ?
│  ◉ Claude Code
│  ○ Cursor
│  ○ GitHub Copilot
│  ○ Codex
│  ○ Anti Gravity
│
◆  Confirmer l'installation ?
│  ● Oui  ○ Non
└
```

Les commandes sont copiées dans ton projet. Tu peux maintenant **ouvrir l'agent IA dans ce dossier**.

### Étape 2 — Ouvrir l'agent IA dans le projet

```bash
# Claude Code
claude .

# Cursor
cursor .

# VS Code + GitHub Copilot
code .

# Codex (OpenAI)
codex

# Anti Gravity
antigravity .
```

> ⚠️ Important : ouvre l'agent **dans le dossier du projet**, pas dans le dossier SANDYKIT.

### Étape 3 — Utiliser les slash commands

Le pipeline se déroule dans cet ordre :

```
/sandykit.specify → /sandykit.clarify → /sandykit.plan → /sandykit.tasks → /sandykit.implement → /sandykit.review
```

#### `/sandykit.specify` — Décrire la feature

Lance cette commande et décris ta feature en langage naturel. L'IA génère une **spécification fonctionnelle** structurée et la sauvegarde dans `specs/001-nom-feature/spec.md`.

```
/sandykit.specify

> Je veux une API REST pour gérer des utilisateurs avec 
> authentification JWT, rôles admin/user, et pagination.
```

Résultat : `specs/001-api-users/spec.md` avec cas d'usage, contraintes, critères d'acceptation.

#### `/sandykit.clarify` — Affiner une spec floue *(optionnel)*

Si la spec est incomplète ou ambiguë, utilise cette commande pour poser des questions et affiner.

```
/sandykit.clarify

> La spec parle de "rôles" mais ne précise pas les permissions exactes.
```

#### `/sandykit.plan` — Générer le plan technique

À partir de la spec validée, génère un **plan d'architecture** : stack technologique, structure des dossiers, composants, flux de données.

```
/sandykit.plan
```

Résultat : `specs/001-api-users/plan.md`

#### `/sandykit.tasks` — Décomposer en tâches

Décompose le plan en **tâches concrètes** ordonnées, avec dépendances. Chaque tâche est < 1 journée de travail.

```
/sandykit.tasks
```

Résultat : `specs/001-api-users/tasks.md` avec checkboxes markdown.

#### `/sandykit.implement` — Implémenter les tâches

L'IA implémente les tâches une par une en suivant les specs. Elle génère le code, les tests, et coche les tâches au fur et à mesure.

```
/sandykit.implement
```

Résultat : `specs/001-api-users/implement.md` + le code dans ton projet.

#### `/sandykit.review` — Réviser le code

L'IA analyse le code produit, vérifie la conformité avec la spec, identifie les problèmes de qualité.

```
/sandykit.review
```

Résultat : `specs/001-api-users/review.md` avec recommandations.

#### `/sandykit.back` — Revenir en arrière

À n'importe quelle étape, reviens à l'étape précédente sans perdre ton travail.

```
/sandykit.back
```

### Étape 4 — Suivre l'avancement en temps réel

Dans un autre terminal :

```bash
# Surveiller toutes les features en temps réel
sandykit watch

# Afficher l'état actuel
sandykit status

# Lister les features avec progression
sandykit list
```

Exemple de sortie `sandykit status` :

```
  Projet : Mon API REST
  Agent  : Claude Code

  Features (3) :

  ✓ spec  ✓ plan  ✓ tasks  ✓ impl  ✓ review   001-api-users
  ✓ spec  ✓ plan  ✓ tasks  ○ impl  ○ review   002-auth-jwt
  ✓ spec  ○ plan  ○ tasks  ○ impl  ○ review   003-dashboard
```

---

## 3. Mode Autonome — De l'idée au code en une commande

Ce mode lit un cahier des charges et **génère tout le projet** de façon autonome avec validation humaine à chaque étape clé.

### Préparation : créer le cahier des charges

Crée un fichier texte décrivant ton projet. SANDYKIT accepte `.txt`, `.md`, `.pdf` et `.docx`.

**Exemple** (`cahier-des-charges.md`) :

```markdown
# Application de gestion de tâches collaborative

## Contexte
Une startup veut un outil interne pour gérer les tâches de ses équipes.

## Besoins fonctionnels
- Création de projets avec membres
- Tâches avec statuts (todo/en cours/terminé)
- Commentaires sur les tâches
- Notifications en temps réel
- Export CSV des rapports

## Contraintes techniques
- API REST bien documentée (OpenAPI)
- Frontend React
- Déploiement Docker

## Utilisateurs cibles
- Chefs de projet : créent les projets, invitent des membres
- Développeurs : gèrent leurs tâches quotidiennes
```

### Lancer le pipeline autonome

```bash
cd mon-projet
sandykit dev
```

Ou avec un fichier existant :

```bash
sandykit dev --file cahier-des-charges.md
```

### Déroulement du pipeline

#### ① Choix du provider IA

```
◆  Quel provider IA ?
│  ● Claude (Anthropic)     — API key requise
│  ○ OpenAI (GPT-4o...)     — API key requise
│  ○ Ollama (local)          — Aucune clé, modèle local
│  ○ Provider personnalisé   — URL + clé compatible OpenAI
```

Si tu as déjà configuré un provider, SANDYKIT te propose de le réutiliser.

**La clé API est stockée dans le keychain sécurisé de ton OS** (Credential Manager sur Windows, Keychain sur macOS) — jamais en clair dans un fichier.

#### ② Nom du projet et type

```
◆  Nom du projet ?
│  Task Manager Pro

◆  Type de projet :
│  ● SaaS Web App        — Next.js + Auth + Stripe + DB
│  ○ API REST             — Node.js/Express ou Fastify + OpenAPI
│  ○ Outil CLI            — Node.js + Commander + distribution npm
│  ○ App Mobile           — React Native + Expo + navigation
│  ○ Pipeline Data / IA   — Python + FastAPI + ML + PostgreSQL
│  ○ Fullstack Monorepo   — Turborepo + apps + packages partagés
│  ○ Projet personnalisé  — L'IA choisit la stack selon la description
```

#### ③ Source du cahier des charges

```
◆  Source du cahier des charges :
│  ● Fichier existant     — Importer un .txt, .md, .pdf, .docx
│  ○ Saisir maintenant    — Écrire directement dans le terminal
│  ○ Coller du texte      — Copier-coller depuis un autre outil
```

#### ④ Génération de la spec

L'IA génère la spécification fonctionnelle en streaming. Tu vois le texte s'écrire en temps réel.

```
  Génération de la spec...

  # Spécification fonctionnelle — Task Manager Pro
  
  ## 1. Vue d'ensemble
  ...

─────────────────────────────────────────────────────
◆  Spec — que faire ?
│  ● ✓  Valider et continuer
│  ○ ↺  Régénérer (ajouter des précisions)
│  ○ ✏  Modifier manuellement le fichier
│  ○ ←  Étape précédente
│  ○ ✗  Annuler
```

À chaque étape tu peux :
- **Valider** → passer à l'étape suivante
- **Régénérer** → ajouter des précisions et relancer l'IA
- **Modifier** → éditer le fichier dans ton éditeur
- **Revenir** → retourner à l'étape précédente

Si le projet est dans un repo git et que `autoGit` est activé :
```
  git: a3f2c1d — docs(task-manager-pro): add functional specification
```

#### ⑤ Génération du plan technique

```
  Génération du plan...

  # Plan technique — Task Manager Pro
  
  ## Stack
  - Backend: Node.js + Fastify + Prisma + PostgreSQL
  - Frontend: Next.js 14 + Tailwind CSS + Zustand
  ...

◆  Plan — que faire ?
│  ● ✓  Valider et continuer
│  ...
```

#### ⑥ Génération des tâches

```
  # Tâches — Task Manager Pro

  ## Backend
  - [ ] Configurer le projet Fastify + TypeScript
  - [ ] Créer le schéma Prisma (User, Project, Task, Comment)
  - [ ] Implémenter l'authentification JWT
  ...

  git: b8e9f2a — docs(task-manager-pro): add granular task breakdown
```

#### ⑦ Estimation du coût avant implémentation

```
  Estimation de coût :

  Modèle : claude-sonnet-4-6
  Coût estimé : $0.124

  Détail par étape :
    spec         ~1 450 tokens    $0.008
    plan         ~2 100 tokens    $0.014
    tasks        ~1 800 tokens    $0.012
    implement    ~9 200 tokens    $0.073
    tests        ~4 500 tokens    $0.017
```

#### ⑧ Génération du code

L'IA génère **tous** les fichiers du projet :

```
  Génération du code...

  ## Fichier: package.json
  ```json
  { "name": "task-manager-pro", ... }
  ```

  ## Fichier: src/server.ts
  ```typescript
  import Fastify from 'fastify'
  ...
  ```

  ## Fichier: src/routes/tasks.ts
  ...
```

Les fichiers sont écrits dans ton dossier projet au fur et à mesure.

#### ⑨ Génération des tests

```
◆  Générer les tests automatiquement ?
│  ● Oui   ○ Non

  Génération des tests...  ✓ 12 fichier(s) de test générés
```

#### ⑩ Lint + formatage automatique

```
  Lint + formatage du code...
  ✓  Prettier (auto-configuré)
  ✓  ESLint
```

#### ⑪ Validation du projet

```
  Validation du projet...
  ✓ package.json         présent
  ✓ npm install          réussi
  ✓ TypeScript           0 erreur
  ✓ Tests                11/11 passent
  ✓ .env.example         présent
  ✓ README.md            présent

  git: c1d4e7f — feat(task-manager-pro): generate initial implementation
  git: d2e5f8a — test(task-manager-pro): add generated test suite
```

#### Résultat final

```
✓ Projet "Task Manager Pro" livré — specs dans ./specs/001-task-manager-pro
```

### Options avancées

```bash
# Reprendre depuis le dernier checkpoint (si interrompu)
sandykit dev --resume

# Mode dry-run : générer spec + plan uniquement, sans écrire de code
sandykit dev --dry-run

# Avec un cahier des charges PDF
sandykit dev --file brief.pdf
```

### Checkpoints — reprendre après interruption

Si le pipeline est interrompu (Ctrl+C, coupure réseau...), SANDYKIT sauvegarde automatiquement l'état. Au prochain lancement :

```
◆  Session précédente trouvée : "Task Manager Pro" — étape 4/6 — il y a 23 min
│  ● ▶  Reprendre depuis là où j'ai arrêté
│  ○ ✦  Nouveau projet (ignorer le checkpoint)
```

---

## 4. Collaboration équipe

### Initialiser la config équipe

```bash
sandykit team init
```

Crée `sandykit.team.json` à la racine du projet — **à committer dans git** (sans clés API).

```json
{
  "version": 1,
  "projectName": "Task Manager Pro",
  "provider": "claude",
  "model": "claude-sonnet-4-6",
  "language": "fr",
  "autoCommit": true,
  "members": [
    {
      "name": "Alice Martin",
      "email": "alice@company.com",
      "role": "owner"
    }
  ],
  "hooks": {
    "webhook": "https://hooks.slack.com/services/xxx/yyy/zzz"
  },
  "export": {
    "jira": {
      "baseUrl": "https://company.atlassian.net",
      "project": "TMP"
    }
  }
}
```

Partage cette config avec ton équipe :

```bash
git add sandykit.team.json
git commit -m "chore: add sandykit team config"
```

### Gérer les membres

```bash
# Ajouter un membre
sandykit team add bob@company.com "Bob Dupont" contributor

# Retirer un membre
sandykit team remove bob@company.com

# Voir la config + derniers commits
sandykit team show
```

Rôles disponibles : `owner`, `contributor`, `reviewer`

### Webhook de notification

Quand un webhook est configuré, SANDYKIT envoie un POST JSON après chaque étape :

```json
{
  "step": "spec",
  "projectName": "Task Manager Pro",
  "timestamp": "2026-05-17T12:00:00.000Z"
}
```

Compatible avec Slack, Discord, Teams, n8n, Zapier, etc.

### Git auto-commits

Quand `autoCommit: true` (défaut), SANDYKIT crée automatiquement un commit après chaque étape avec des messages conventionnels :

| Étape | Message de commit |
|-------|-------------------|
| Spec | `docs(projet): add functional specification` |
| Plan | `docs(projet): add technical implementation plan` |
| Tâches | `docs(projet): add granular task breakdown` |
| Code | `feat(projet): generate initial implementation` |
| Tests | `test(projet): add generated test suite` |

Pour désactiver :

```bash
# Dans sandykit.team.json
"autoCommit": false
```

---

## 5. Partage de specs

Partage une spec avec un collègue ou un client via un **GitHub Gist secret**.

```bash
# Partager spec + plan + tâches
sandykit share mon-app

# Partager uniquement la spec
sandykit share mon-app --spec

# Partager uniquement le plan
sandykit share mon-app --plan

# Avec authentification GitHub (gist modifiable)
sandykit share mon-app --all --token ghp_xxxxxxxxxxxx
# ou
GITHUB_TOKEN=ghp_xxxxxxxxxxxx sandykit share mon-app
```

Résultat :

```
  🔗 Lien de partage :
     https://gist.github.com/a1b2c3d4e5f6

  Fichiers partagés :
    • sandykit-mon-app-spec.md
    • sandykit-mon-app-plan.md
    • sandykit-mon-app-tasks.md

  Le gist est secret (seules les personnes avec le lien y ont accès)
```

**Créer un token GitHub** (scope `gist`) :
→ https://github.com/settings/tokens/new?scopes=gist

Sans token : fonctionne en anonyme (limite 60 requêtes/heure par IP).

---

## 6. Export vers Jira / Linear

Exporte les tâches générées par SANDYKIT directement vers ton outil de ticketing.

### Configuration

Dans `sandykit.team.json`, ajoute la section `export` :

```json
{
  "export": {
    "jira": {
      "baseUrl": "https://company.atlassian.net",
      "project": "TMP"
    },
    "linear": {
      "teamId": "a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  }
}
```

Ajoute les tokens dans tes variables d'environnement (`.env` ou shell) :

```bash
# Jira : token API depuis id.atlassian.com/manage-profile/security/api-tokens
JIRA_API_TOKEN=your-jira-api-token

# Linear : token API depuis linear.app/settings/api
LINEAR_API_TOKEN=lin_api_xxxxxxxxxxxx
```

### Lancer l'export

```bash
# Export interactif (choix feature + plateforme)
sandykit tickets

# Export direct vers Jira
sandykit tickets mon-app --jira

# Export direct vers Linear
sandykit tickets mon-app --linear
```

Résultat :

```
  12 tâche(s) trouvée(s)

   1. Configurer le projet Fastify [low]
   2. Créer le schéma Prisma [low]
   3. Implémenter l'auth JWT [high]
  ...

  Export vers Jira...  12 ticket(s) créés, 0 échec(s)
  → https://company.atlassian.net/browse/TMP-42
  → https://company.atlassian.net/browse/TMP-43
  ...
```

SANDYKIT détecte automatiquement :
- **La priorité** — `critique`/`urgent` → High, `important` → Medium, sinon Low
- **Les labels** — `api`, `frontend`, `database`, `security`, `testing`, `infra`

---

## 7. Référence complète des commandes

### Commandes principales

| Commande | Description |
|----------|-------------|
| `sandykit init` | Installer SANDYKIT dans un projet (installe les slash commands) |
| `sandykit dev` | Pipeline autonome : cahier des charges → spec → plan → tâches → code |
| `sandykit status` | Afficher l'état de toutes les features |
| `sandykit list` | Lister les features avec barre de progression |
| `sandykit watch` | Surveiller specs/ en temps réel |

### Gestion des features

| Commande | Description |
|----------|-------------|
| `sandykit new [nom]` | Créer une nouvelle feature depuis le terminal |
| `sandykit reset [nom]` | Supprimer une étape ou toute une feature |
| `sandykit export [nom]` | Copier les fichiers d'une feature dans `exports/` |
| `sandykit open [nom]` | Ouvrir le dossier de la feature dans l'explorateur |
| `sandykit rename [nom]` | Renommer une feature |
| `sandykit archive [nom]` | Archiver une feature terminée dans `archives/` |

### Collaboration

| Commande | Description |
|----------|-------------|
| `sandykit team init` | Créer `sandykit.team.json` |
| `sandykit team show` | Afficher la config équipe et les derniers commits |
| `sandykit team add <email> [nom] [role]` | Ajouter un membre |
| `sandykit team remove <email>` | Retirer un membre |
| `sandykit share [feature]` | Partager spec/plan/tâches via GitHub Gist |
| `sandykit tickets [feature]` | Exporter les tâches vers Jira ou Linear |

### Maintenance

| Commande | Description |
|----------|-------------|
| `sandykit update` | Réinstaller les commandes agent après une mise à jour |
| `sandykit doctor` | Vérifier la configuration et les fichiers installés |

### Options de `sandykit dev`

| Option | Description |
|--------|-------------|
| `--file <chemin>` | Cahier des charges à importer (`.txt`, `.md`, `.pdf`, `.docx`) |
| `--resume` | Reprendre depuis le dernier checkpoint |
| `--dry-run` | Générer spec + plan uniquement, sans écrire de code |

### Options de `sandykit share`

| Option | Description |
|--------|-------------|
| `--spec` | Partager uniquement la spec |
| `--plan` | Partager uniquement le plan |
| `--tasks` | Partager uniquement les tâches |
| `--all` | Partager spec + plan + tâches *(défaut)* |
| `--token <token>` | Token GitHub pour gists authentifiés |

### Options de `sandykit tickets`

| Option | Description |
|--------|-------------|
| `--jira` | Exporter vers Jira (`JIRA_API_TOKEN` requis) |
| `--linear` | Exporter vers Linear (`LINEAR_API_TOKEN` requis) |

### Slash commands dans l'agent IA

| Commande | Description |
|----------|-------------|
| `/sandykit.specify` | Décrire une nouvelle feature → génère `spec.md` |
| `/sandykit.clarify` | Affiner une spec floue |
| `/sandykit.plan` | Générer le plan technique → génère `plan.md` |
| `/sandykit.tasks` | Décomposer en tâches → génère `tasks.md` |
| `/sandykit.implement` | Implémenter les tâches → génère `implement.md` + code |
| `/sandykit.review` | Réviser le code produit → génère `review.md` |
| `/sandykit.back` | Revenir à l'étape précédente |

---

## 8. Structure des fichiers générés

```
mon-projet/
├── sandykit.team.json          ← config équipe (à committer)
│
├── .sandykit/
│   ├── config.json             ← config locale (provider, projet)
│   └── checkpoint.json         ← point de reprise (ignoré par git)
│
├── .claude/                    ← slash commands Claude Code
│   └── commands/
│       ├── sandykit.specify.md
│       ├── sandykit.clarify.md
│       ├── sandykit.plan.md
│       ├── sandykit.tasks.md
│       ├── sandykit.implement.md
│       ├── sandykit.review.md
│       └── sandykit.back.md
│
├── .cursor/                    ← règles Cursor
│   └── rules/
│       └── sandykit-*.mdc
│
├── .github/                    ← instructions GitHub Copilot
│   └── instructions/
│       └── sandykit-*.instructions.md
│
├── .codex/                     ← commandes Codex (OpenAI)
│   └── sandykit-*.md
│
├── .antigravity/               ← commandes Anti Gravity
│   └── sandykit-*.md
│
├── specs/                      ← toutes tes features
│   ├── 001-auth-jwt/
│   │   ├── spec.md             ← spécification fonctionnelle
│   │   ├── plan.md             ← plan technique
│   │   ├── tasks.md            ← liste de tâches
│   │   ├── implement.md        ← log d'implémentation
│   │   ├── review.md           ← rapport de révision
│   │   └── .versions/          ← historique de versions
│   │       ├── spec/
│   │       │   ├── v1.md
│   │       │   ├── v2.md
│   │       │   └── changelog.json
│   │       └── plan/
│   └── 002-dashboard/
│       └── ...
│
├── exports/                    ← généré par sandykit export
│   └── 001-auth-jwt/
│
└── archives/                   ← features archivées
    └── 001-auth-jwt/
```

---

## 9. Providers IA supportés

| Provider | Modèles disponibles | Clé requise |
|----------|--------------------|----|
| **Claude (Anthropic)** | claude-sonnet-4-6, claude-opus-4-7, claude-haiku-4-5 | `ANTHROPIC_API_KEY` |
| **OpenAI** | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | `OPENAI_API_KEY` |
| **Ollama** | llama3, mistral, codestral, gemma2... | Aucune (local) |
| **Custom** | Tout modèle compatible API OpenAI | Optionnelle |

### Stockage sécurisé des clés

Les clés API ne sont **jamais** écrites dans un fichier. Elles sont stockées dans le keychain sécurisé de ton OS :

- **Windows** : Windows Credential Manager
- **macOS** : macOS Keychain
- **Linux** : SecretService (GNOME Keyring)

Variables d'environnement alternatives (prioritaires) :

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

### Estimation des coûts

Avant chaque génération de code, SANDYKIT affiche une estimation :

| Modèle | Coût estimé (projet moyen) |
|--------|---------------------------|
| claude-haiku-4-5 | ~$0.01 |
| claude-sonnet-4-6 | ~$0.10 – $0.30 |
| claude-opus-4-7 | ~$0.80 – $2.00 |
| gpt-4o | ~$0.08 – $0.25 |
| Ollama (local) | Gratuit |

---

## 10. FAQ

**Q : Quelle est la différence entre Mode Commandes et Mode Autonome ?**

Le Mode Commandes (v2) installe des slash commands dans ton agent IA. Tu interagis manuellement avec l'agent à chaque étape, tu gardes le contrôle total. Le Mode Autonome (v3, `sandykit dev`) fait tout automatiquement : spec, plan, tâches, code, tests — il demande juste ta validation à chaque étape clé.

---

**Q : Est-ce que SANDYKIT écrit du code dans mon projet ?**

En Mode Commandes : non, c'est ton agent IA qui écrit le code dans la session de chat. En Mode Autonome (`sandykit dev`) : oui, les fichiers sont créés directement dans ton dossier projet.

---

**Q : Je peux utiliser SANDYKIT sans connexion internet ?**

Oui, avec **Ollama** (local). Installe Ollama, télécharge un modèle (`ollama pull llama3`), puis choisis Ollama comme provider.

---

**Q : La clé API est-elle stockée de façon sécurisée ?**

Oui. SANDYKIT utilise le keychain de ton OS (via `keytar`). La clé n'est jamais écrite dans `config.json`, ni dans `sandykit.team.json`, ni dans le checkpoint.

---

**Q : Que se passe-t-il si le pipeline est interrompu ?**

SANDYKIT sauvegarde un checkpoint après chaque étape. Au prochain lancement, il te proposera de reprendre là où tu t'es arrêté. Tu peux aussi forcer la reprise avec `sandykit dev --resume`.

---

**Q : Comment mettre à jour les commandes installées après une mise à jour de SANDYKIT ?**

```bash
cd /chemin/vers/sandykit
git pull
npm run build
cd mon-projet
sandykit update
```

---

**Q : Puis-je utiliser SANDYKIT sur plusieurs projets en même temps ?**

Oui. SANDYKIT est global (`npm link`), chaque projet a sa propre config dans `.sandykit/config.json`. Lance `sandykit init` dans chaque projet séparément.

---

**Q : Comment contribuer ?**

```bash
git clone https://github.com/kuatejoelparfait-Data/Sandykit.git
cd Sandykit
npm install
npm test        # 53 tests
npm run build
```

---

## Développement

```bash
npm run build   # Compiler TypeScript → dist/cli.cjs
npm test        # Lancer les tests (53 tests)
npm link        # Installer globalement pour les tests
sandykit --help # Vérifier
```

**Stack interne :**
- TypeScript + esbuild (bundle CJS)
- @clack/prompts (UI interactive)
- commander (parsing CLI)
- keytar (keychain OS)
- chokidar (watcher fichiers)
- pdf-parse + mammoth (lecture fichiers)
- vitest (tests)

---

*SANDYKIT — Du cahier des charges au code, étape par étape.*
