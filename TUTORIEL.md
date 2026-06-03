# SANDYKIT — Guide de test complet pour débutants

> **Objectif :** Tester chaque fonctionnalité de SANDYKIT de zéro, étape par étape.  
> **Pour qui :** Quelqu'un qui n'a jamais utilisé SANDYKIT.  
> **Durée totale :** 60 à 90 minutes.  
> **Format :** À chaque étape, tu fais la manipulation ET tu vérifies que ça marche avant de passer à la suivante.

---

## 🗺️ Plan du guide

| # | Ce qu'on teste | Durée |
|---|---------------|-------|
| 1 | Vérification des pré-requis | 5 min |
| 2 | Installation de SANDYKIT | 5 min |
| 3 | Création et initialisation d'un projet | 5 min |
| 4 | Mode Autonome — `sandykit dev` | 30–40 min |
| 5 | Slash Commands dans Claude Code | 15 min |
| 6 | Monitoring — `status`, `list`, `watch` | 5 min |
| 7 | Ajout incrémental — `sandykit add` | 10 min |
| 8 | Budget IA — `sandykit budget` | 5 min |
| 9 | Mode Équipe — `sandykit team` | 5 min |
| 10 | Partage — `sandykit share` | 5 min |

À la fin de chaque étape, tu trouveras une case **✅ VÉRIFIÉ** : si tu vois le résultat attendu, tu peux continuer.

---

## 🔧 ÉTAPE 1 — Vérification des pré-requis

Avant d'installer SANDYKIT, vérifie que ces outils sont bien présents sur ton ordinateur.

### 1.1 Node.js

```bash
node --version
```

**Résultat attendu :** Un numéro de version **≥ 18**, exemple : `v20.11.0` ou `v22.0.0`

> ⚠️ **Node v24 et clé API :** Si tu as Node v24, le système de sauvegarde sécurisée de la clé API (keychain) peut ne pas fonctionner. Dans ce cas, utilise la variable d'environnement à la place (expliqué à l'étape 4.2).

Si Node n'est pas installé → https://nodejs.org (télécharge la version LTS)

### 1.2 npm

```bash
npm --version
```

**Résultat attendu :** Un numéro **≥ 9**, exemple : `9.8.1` ou `10.2.0`

### 1.3 Git

```bash
git --version
```

**Résultat attendu :** `git version 2.x.x` ou supérieur

Si Git n'est pas installé → https://git-scm.com

### 1.4 Claude Code (pour la Partie 5)

```bash
claude --version
```

**Résultat attendu :** Un numéro de version, exemple : `1.0.0`

> 💡 Claude Code est optionnel pour les étapes 1 à 4. Tu en as besoin seulement à l'étape 5 (slash commands).

---

**✅ VÉRIFIÉ — Étape 1 :** Tu as `node --version` ≥ 18 et `npm --version` ≥ 9 ? → Passe à l'étape 2.

---

## 📦 ÉTAPE 2 — Installation de SANDYKIT

### 2.1 Télécharger SANDYKIT

Ouvre un terminal dans le dossier où tu veux installer SANDYKIT (par exemple ton bureau) :

```bash
cd ~/Desktop
```

Clone le dépôt :

```bash
git clone https://github.com/kuatejoelparfait-Data/Sandykit.git
```

**Résultat attendu :**
```
Cloning into 'Sandykit'...
remote: Counting objects: ...
✓ Done
```

### 2.2 Entrer dans le dossier et installer

```bash
cd Sandykit
npm install
```

**Résultat attendu :** Des lignes de téléchargement, puis :
```
added 87 packages ...
```

> ⚠️ Si tu vois des erreurs `WARN` ou `deprecated` c'est normal — ce ne sont que des avertissements, pas des erreurs bloquantes.

### 2.3 Compiler le projet

```bash
npm run build
```

**Résultat attendu :**
```
  dist/cli.cjs    xxx kB
```

### 2.4 Rendre disponible globalement

```bash
npm link
```

**Résultat attendu :**
```
added 1 package, ...
```

### 2.5 Vérifier l'installation

```bash
sandykit --version
```

**Résultat attendu :** `2.0.0`

```bash
sandykit --help
```

**Résultat attendu :** Un tableau de toutes les commandes disponibles :
```
Commands:
  init [project]           Installer SANDYKIT dans un projet
  dev                      Générer un projet complet ...
  add [description]        Ajouter une feature ...
  status                   État des features
  ...
```

---

**✅ VÉRIFIÉ — Étape 2 :** `sandykit --version` affiche `2.0.0` ? → Passe à l'étape 3.

---

## 🗂️ ÉTAPE 3 — Créer et initialiser un projet de test

### 3.1 Créer un dossier vide

Navigue vers ton bureau (ou un endroit de ton choix) :

```bash
cd ~/Desktop
```

Crée un nouveau dossier pour ton projet test :

```bash
mkdir projet-test-sandykit
cd projet-test-sandykit
```

### 3.2 Initialiser Git dans ce dossier

```bash
git init
git config user.name "Ton Nom"
git config user.email "ton@email.com"
```

**Résultat attendu :**
```
Initialized empty Git repository in .../projet-test-sandykit/.git/
```

### 3.3 Lancer `sandykit init`

```bash
sandykit init
```

Un menu interactif s'affiche. Voici comment le remplir :

**Question 1 — Nom du projet :**
```
◆  Nom du projet ?
│  projet-test-sandykit   ← appuie sur Entrée (le nom est pré-rempli)
```

**Question 2 — Quel agent IA intégrer :**
```
◆  Agent(s) IA à intégrer ?
│  ◉ Claude Code           ← appuie sur Espace pour sélectionner
│  ○ Cursor
│  ○ GitHub Copilot
                           ← appuie sur Entrée pour confirmer
```

**Question 3 — Confirmer :**
```
◆  Confirmer l'installation ?
│  ● Oui                   ← appuie sur Entrée
```

**Résultat attendu :**
```
✓ SANDYKIT installé dans projet-test-sandykit
  Agent : Claude Code → .claude/commands/ (7 fichiers)
```

### 3.4 Vérifier les fichiers créés

```bash
ls .claude/commands/
```

**Résultat attendu :** Une liste de 7 fichiers `.md` :
```
sandykit.back.md
sandykit.clarify.md
sandykit.implement.md
sandykit.plan.md
sandykit.review.md
sandykit.specify.md
sandykit.tasks.md
```

> 💡 Ces fichiers sont les slash commands que tu utiliseras dans Claude Code à l'étape 5.

---

**✅ VÉRIFIÉ — Étape 3 :** Tu vois les 7 fichiers dans `.claude/commands/` ? → Passe à l'étape 4.

---

## 🤖 ÉTAPE 4 — Mode Autonome : `sandykit dev`

C'est la fonctionnalité principale de SANDYKIT. Tu décris un projet en quelques phrases, et SANDYKIT génère automatiquement la spec, le plan, les tâches, et le code.

**Dans cette étape, on va créer un projet concret : une API de gestion de tâches (todo list).**

### 4.1 Se préparer — Clé API

SANDYKIT a besoin d'une clé API pour appeler l'IA. Tu peux utiliser :

| Provider | Où obtenir la clé | Prix |
|----------|------------------|------|
| **Claude** (recommandé) | https://console.anthropic.com → API Keys | ~$0.003 par appel |
| **OpenAI** | https://platform.openai.com → API keys | ~$0.005 par appel |
| **Ollama** | Aucune clé requise | Gratuit (local) |

> 💡 Pour ce tutoriel, un projet simple coûte environ **$0.05 à $0.20**.

### 4.2 Configurer la clé API

Il y a **deux méthodes** selon ta version de Node :

**Méthode A — Via variable d'environnement (recommandé pour Node v24) :**

Sur Windows (PowerShell) :
```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-api03-xxxx"
```

Sur macOS / Linux :
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-xxxx"
```

Puis lance `sandykit dev` dans **le même terminal**.

**Méthode B — Via le keychain (Node ≤ 22 seulement) :**

La clé sera demandée automatiquement par le menu interactif et sauvegardée de façon sécurisée.

### 4.3 Lancer le pipeline

Assure-toi d'être dans le dossier `projet-test-sandykit` :

```bash
pwd
```

**Résultat attendu :** Le chemin doit se terminer par `projet-test-sandykit`

Lance le pipeline :

```bash
sandykit dev
```

---

### 4.4 Naviguer dans le menu interactif

#### 🎛️ Étape A — Choisir le provider IA

```
◆  Quel provider IA ?
│  ● Claude (Anthropic)
│  ○ OpenAI (GPT-4o...)
│  ○ Ollama (local)
│  ○ Provider personnalisé
```

Utilise les flèches ↑↓ pour naviguer. Appuie sur **Entrée** pour valider.

→ Choisis **Claude (Anthropic)**

#### 🎛️ Étape B — Entrer ta clé API

> Si tu as défini `ANTHROPIC_API_KEY` en variable d'environnement, cette étape est sautée automatiquement.

```
◆  Clé API Anthropic :
│  ••••••••••••••••••    ← colle ta clé (elle est masquée)
```

Colle ta clé et appuie sur **Entrée**.

#### 🎛️ Étape C — Choisir le modèle

```
◆  Modèle :
│  ● claude-sonnet-4-6    ← bon équilibre qualité/coût
│  ○ claude-opus-4-7       ← plus puissant, plus cher
│  ○ claude-haiku-4-5      ← rapide et économique
```

→ Choisis **claude-sonnet-4-6** pour commencer.

#### 🎛️ Étape D — Nom du projet

```
◆  Nom du projet ?
│  todo-api
```

Tape `todo-api` et appuie sur **Entrée**.

#### 🎛️ Étape E — Type de projet

```
◆  Type de projet :
│  ○ SaaS Web App
│  ● API REST
│  ○ App Mobile
│  ○ Outil CLI
│  ○ Pipeline Data / IA
│  ○ Fullstack Monorepo
│  ○ Projet personnalisé
```

→ Choisis **API REST**.

#### 🎛️ Étape F — Description du projet

```
◆  Source du cahier des charges :
│  ○ Fichier existant
│  ● Saisir maintenant
│  ○ Coller du texte
```

→ Choisis **Saisir maintenant**, puis écris :

```
Je veux une API REST simple de gestion de tâches (todo list).

Fonctionnalités :
- Créer une tâche (titre, description, statut)
- Lister toutes les tâches
- Marquer une tâche comme terminée
- Supprimer une tâche

Contraintes :
- Node.js + TypeScript
- Base de données SQLite (simple, sans configuration)
- Validation des données
- Tests unitaires
```

Appuie sur **Entrée** puis valide avec `Oui`.

---

### 4.5 Observer la génération automatique

#### 🤖 La spec se génère (1–2 minutes)

Tu vas voir l'IA écrire en temps réel :

```
  Génération de la spec...

  # Spécification fonctionnelle — Todo API

  ## 1. Vue d'ensemble
  API REST permettant la gestion de tâches simples...

  ## 2. Endpoints
  - GET  /tasks       — Lister toutes les tâches
  - POST /tasks       — Créer une tâche
  - PUT  /tasks/:id   — Mettre à jour une tâche
  - DELETE /tasks/:id — Supprimer une tâche
  ...
```

Quand la spec est terminée :

```
◆  Spec — que faire ?
│  ● ✓  Valider et continuer
│  ○ ↺  Régénérer
│  ○ ✏  Modifier manuellement
│  ○ ←  Étape précédente
│  ○ ✗  Annuler
```

Lis la spec. Si elle correspond à ce que tu voulais → **Valider et continuer**.

> 💡 **Test de la régénération :** Si tu veux tester cette fonctionnalité, choisis `↺ Régénérer` et tape : *"Ajouter un champ 'priorité' (basse/moyenne/haute) aux tâches"*. La spec sera régénérée avec ce détail.

#### 🤖 Le plan technique se génère

Même processus. Tu verras quelque chose comme :

```
  # Plan technique — Todo API

  ## Stack
  - Runtime : Node.js 20 + TypeScript
  - Framework : Express
  - Base de données : SQLite via better-sqlite3
  - Validation : Zod
  - Tests : Vitest

  ## Structure
  src/
  ├── routes/
  │   └── tasks.ts
  ├── db/
  │   └── database.ts
  └── app.ts
```

→ **Valider et continuer**

#### 🤖 Les tâches se génèrent

```
  # Tâches — Todo API

  - [ ] Initialiser le projet Express + TypeScript
  - [ ] Configurer SQLite
  - [ ] Créer les routes CRUD pour les tâches
  - [ ] Ajouter la validation Zod
  - [ ] Écrire les tests
```

→ **Valider et continuer**

#### 💰 L'estimation de coût s'affiche

```
  Estimation de coût :
  Modèle : claude-sonnet-4-6
  Coût estimé : $0.09

  Détail :
    implement    ~6 000 tokens   $0.07
    tests        ~2 500 tokens   $0.02
```

→ **Oui** pour continuer

#### 💻 Le code se génère (2–5 minutes)

C'est la partie la plus longue. SANDYKIT génère tous les fichiers :

```
  ## Fichier: package.json
  ## Fichier: tsconfig.json
  ## Fichier: src/app.ts
  ## Fichier: src/routes/tasks.ts
  ## Fichier: src/db/database.ts
  ## Fichier: tests/tasks.test.ts
  ...
```

Un résumé s'affiche :

```
  Résumé des modifications :
  + src/app.ts              (+45 lignes)
  + src/routes/tasks.ts     (+98 lignes)
  + src/db/database.ts      (+32 lignes)
  + package.json            (+24 lignes)
  + tests/tasks.test.ts     (+67 lignes)

◆  Appliquer ces fichiers ?
│  ● Tout appliquer
│  ○ Voir et choisir fichier par fichier
│  ○ Voir le diff complet
│  ○ Annuler
```

→ Choisis **Tout appliquer**

#### ✅ Validation finale

```
  ✓ 6 fichier(s) créés
  ✓ TypeScript — 0 erreur
  ✓ README.md — présent
  ✓ .env.example — présent

✓ Projet "todo-api" livré — specs dans ./specs/001-todo-api
```

---

### 4.6 Vérifier le résultat

```bash
ls -la
```

**Résultat attendu :**
```
projet-test-sandykit/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── .gitignore
├── src/
│   ├── app.ts
│   ├── routes/
│   └── db/
├── tests/
└── specs/
    └── 001-todo-api/
        ├── spec.md
        ├── plan.md
        └── tasks.md
```

```bash
cat specs/001-todo-api/spec.md | head -20
```

**Résultat attendu :** Les premières lignes de ta spec fonctionnelle.

### 4.7 Tester que le projet généré compile

```bash
npm install
npx tsc --noEmit
```

**Résultat attendu :** Aucune erreur TypeScript affichée. Si tu vois `0 errors`, c'est parfait.

---

**✅ VÉRIFIÉ — Étape 4 :** Tu as le dossier `specs/001-todo-api/` avec `spec.md`, `plan.md`, `tasks.md` et du code TypeScript généré dans `src/` ? → Passe à l'étape 5.

---

## 🖥️ ÉTAPE 5 — Slash Commands dans Claude Code

Les slash commands permettent de travailler feature par feature dans Claude Code, avec plus de contrôle qu'en mode autonome.

### 5.1 Ouvrir Claude Code dans ton projet

```bash
claude .
```

Claude Code s'ouvre dans le terminal.

### 5.2 Test de `/sandykit.specify`

Dans l'interface Claude Code, tape :

```
/sandykit.specify
```

Claude va te demander de décrire la feature. Réponds :

```
Je veux ajouter un système d'authentification simple à mon API.
Un utilisateur peut s'inscrire avec email + mot de passe.
Il peut ensuite se connecter et reçoit un token JWT.
Les routes de tâches doivent être protégées (requièrent le token).
```

**Résultat attendu :** Claude génère un fichier `specs/002-auth/spec.md` avec la spécification complète.

### 5.3 Test de `/sandykit.clarify`

Si la spec générée est incomplète, tape :

```
/sandykit.clarify
```

Ajoute une précision :

```
Les tokens JWT doivent expirer après 24 heures.
Ajoute aussi une route GET /me qui retourne le profil de l'utilisateur connecté.
```

**Résultat attendu :** La spec est mise à jour avec ces détails.

### 5.4 Test de `/sandykit.plan`

```
/sandykit.plan
```

**Résultat attendu :** Claude génère `specs/002-auth/plan.md` avec la stack technique et la structure des fichiers.

### 5.5 Test de `/sandykit.tasks`

```
/sandykit.tasks
```

**Résultat attendu :** Claude génère `specs/002-auth/tasks.md` avec une liste de tâches ordonnées et numérotées.

### 5.6 Test de `/sandykit.implement`

```
/sandykit.implement
```

**Résultat attendu :** Claude crée les fichiers d'authentification dans ton projet (`src/routes/auth.ts`, `src/middleware/jwt.ts`, etc.).

### 5.7 Test de `/sandykit.review`

```
/sandykit.review
```

**Résultat attendu :** Claude analyse le code produit et donne des recommandations d'amélioration (sécurité, performance, bonnes pratiques).

### 5.8 Test de `/sandykit.back`

À n'importe quel moment, tape :

```
/sandykit.back
```

**Résultat attendu :** Tu reviens à l'étape précédente (utile si tu veux modifier la spec avant d'implémenter).

---

**✅ VÉRIFIÉ — Étape 5 :** Tu as `specs/002-auth/spec.md`, `plan.md` et `tasks.md` créés ? → Passe à l'étape 6.

---

## 📊 ÉTAPE 6 — Monitoring : `status`, `list`, `watch`

Ces commandes te permettent de suivre l'avancement de tes features.

### 6.1 Ouvre un deuxième terminal

Garde le premier terminal ouvert (avec Claude Code ou ton projet). Ouvre-en un nouveau et navigue vers ton projet :

```bash
cd ~/Desktop/projet-test-sandykit
```

### 6.2 Test de `sandykit status`

```bash
sandykit status
```

**Résultat attendu :**

```
  Projet : projet-test-sandykit
  Agent  : Claude Code

  Features (2) :

  ✓ spec  ✓ plan  ✓ tasks  ✓ impl  ✓ review   001-todo-api
  ✓ spec  ✓ plan  ✓ tasks  ○ impl  ○ review   002-auth
```

> Les ✓ indiquent les étapes complétées, les ○ celles qui manquent.

### 6.3 Test de `sandykit list`

```bash
sandykit list
```

**Résultat attendu :** Un tableau détaillé avec barre de progression par feature :

```
  ┌──────────────────┬──────────┬──────────────────────┐
  │ Feature          │ Avancée  │ Étapes               │
  ├──────────────────┼──────────┼──────────────────────┤
  │ 001-todo-api     │ ████ 100%│ spec plan tasks impl  │
  │ 002-auth         │ ██░░  60%│ spec plan tasks       │
  └──────────────────┴──────────┴──────────────────────┘
```

### 6.4 Test de `sandykit watch`

```bash
sandykit watch
```

**Résultat attendu :** La vue s'actualise automatiquement (toutes les 2 secondes) si un fichier change.

Arrête avec `Ctrl+C`.

---

**✅ VÉRIFIÉ — Étape 6 :** Tu vois les 2 features dans `sandykit status` ? → Passe à l'étape 7.

---

## ➕ ÉTAPE 7 — Ajout incrémental : `sandykit add`

`sandykit add` permet d'ajouter une feature à un **projet existant**, avec analyse intelligente du code en place (RAG).

### 7.1 Lancer `sandykit add`

```bash
sandykit add "Ajouter un système de catégories pour les tâches"
```

**Ce qui se passe :**

1. SANDYKIT analyse le code existant (ton `src/`, `specs/`, `package.json`)
2. Il comprend la structure de ton projet
3. Il génère uniquement les modifications nécessaires (pas tout réécrire)

**Résultat attendu :**

```
  Analyse du codebase en cours...
  ✓ 8 fichiers indexés

  Génération de la spec pour : "Ajouter un système de catégories"

  # Spécification — Catégories de tâches
  Chaque tâche peut appartenir à une ou plusieurs catégories...
  ...

  Modifications proposées :
  ~ src/routes/tasks.ts         (+12 -3 lignes)
  ~ src/db/database.ts          (+8 lignes)
  + src/routes/categories.ts    (+45 lignes)

◆  Appliquer ces modifications ?
│  ● Tout appliquer
│  ○ Voir et choisir fichier par fichier
│  ○ Annuler
```

→ Choisis **Tout appliquer** pour tester.

### 7.2 Vérifier les modifications

```bash
git diff --stat
```

**Résultat attendu :** Une liste des fichiers modifiés avec le nombre de lignes ajoutées/supprimées.

---

**✅ VÉRIFIÉ — Étape 7 :** `sandykit add` a proposé des modifications et les a appliquées ? → Passe à l'étape 8.

---

## 💰 ÉTAPE 8 — Gestion du budget IA : `sandykit budget`

Cette fonctionnalité te permet de suivre combien tu dépenses en appels IA et de fixer une limite mensuelle.

### 8.1 Voir le budget actuel

```bash
sandykit budget show
```

**Résultat attendu :**

```
  Budget IA — projet-test-sandykit

  Dépenses du mois :
  ████████░░░░░░░░░░░░  $0.12 / ∞

  Détail par étape :
  spec         2 appels   $0.02
  plan         1 appel    $0.01
  implement    1 appel    $0.09
```

### 8.2 Fixer une limite mensuelle

```bash
sandykit budget set 5
```

**Résultat attendu :**

```
✓ Budget mensuel configuré : $5.00
  Alerte à 80% ($4.00)
```

### 8.3 Vérifier que la limite est prise en compte

```bash
sandykit budget show
```

**Résultat attendu :** La barre de progression affiche maintenant `$X.XX / $5.00`.

### 8.4 Réinitialiser le budget

```bash
sandykit budget reset
```

**Résultat attendu :**
```
✓ Budget réinitialisé (historique effacé)
```

---

**✅ VÉRIFIÉ — Étape 8 :** `sandykit budget show` affiche tes dépenses et `sandykit budget set 5` configure la limite ? → Passe à l'étape 9.

---

## 👥 ÉTAPE 9 — Mode Équipe : `sandykit team`

Le mode équipe permet de partager la configuration SANDYKIT avec tes collègues (sans partager tes clés API).

### 9.1 Initialiser la config équipe

```bash
sandykit team init
```

Un menu interactif s'affiche :

```
◆  Nom de l'équipe ?
│  mon-equipe

◆  Provider IA pour l'équipe ?
│  ● Claude (Anthropic)

◆  Modèle par défaut ?
│  ● claude-sonnet-4-6

◆  Commits automatiques après chaque étape ?
│  ● Oui

◆  URL webhook pour alertes budget (optionnel) ?
│  (appuie sur Entrée pour ignorer)
```

**Résultat attendu :**

```
✓ sandykit.team.json créé
  Partage ce fichier avec ton équipe via Git
  (les clés API ne sont PAS incluses — chacun configure la sienne)
```

### 9.2 Voir la configuration équipe

```bash
sandykit team show
```

**Résultat attendu :** Un tableau avec la configuration actuelle de l'équipe.

### 9.3 Voir le fichier créé

```bash
cat sandykit.team.json
```

**Résultat attendu :**

```json
{
  "version": "2.0.0",
  "projectName": "projet-test-sandykit",
  "provider": "claude",
  "model": "claude-sonnet-4-6",
  "autoCommit": true,
  "members": []
}
```

> 💡 Ce fichier doit être **committé dans Git** pour que toute l'équipe partage la même configuration. Les clés API ne sont jamais dedans.

---

**✅ VÉRIFIÉ — Étape 9 :** `sandykit.team.json` est créé et `sandykit team show` affiche la config ? → Passe à l'étape 10.

---

## 🔗 ÉTAPE 10 — Partage : `sandykit share`

Partage ta spec avec un collègue via un lien GitHub Gist (sans donner accès à ton code).

### 10.1 Partager la spec d'une feature

```bash
sandykit share todo-api --spec
```

**Résultat attendu :**

```
  ✓ Gist créé (anonyme)

  🔗 Lien de partage :
     https://gist.github.com/a1b2c3d4e5f6789

  La spec de "todo-api" est maintenant accessible à ce lien.
  (Seules les personnes avec le lien peuvent y accéder)
```

Copie le lien et ouvre-le dans ton navigateur pour vérifier qu'il fonctionne.

### 10.2 Partager tout (spec + plan + tâches)

```bash
sandykit share todo-api --all
```

**Résultat attendu :** Un nouveau lien avec les trois fichiers dans le même Gist.

### 10.3 Partager avec un token GitHub (authentifié)

Pour créer des Gists modifiables dans ton compte :

1. Va sur https://github.com/settings/tokens/new?scopes=gist
2. Crée un token avec la permission `gist`
3. Lance :

```bash
GITHUB_TOKEN=ton-token sandykit share todo-api --all
```

**Résultat attendu :** Le Gist apparaît dans ton compte GitHub.

---

**✅ VÉRIFIÉ — Étape 10 :** `sandykit share` génère un lien accessible dans le navigateur ? → **Tu as terminé le guide !**

---

## 🏆 Bilan — Checklist finale

Coche ce que tu as testé avec succès :

- [ ] `sandykit --version` → `2.0.0`
- [ ] `sandykit init` → 7 fichiers dans `.claude/commands/`
- [ ] `sandykit dev` → spec + plan + tâches + code générés dans `specs/001-todo-api/`
- [ ] Régénération d'une étape (spec ou plan)
- [ ] `/sandykit.specify` dans Claude Code → `specs/002-auth/spec.md` créé
- [ ] `/sandykit.plan` → `plan.md` créé
- [ ] `/sandykit.tasks` → `tasks.md` créé
- [ ] `sandykit status` → 2 features affichées
- [ ] `sandykit list` → barre de progression visible
- [ ] `sandykit add` → modification proposée et appliquée
- [ ] `sandykit budget show` → dépenses affichées
- [ ] `sandykit budget set 5` → limite configurée
- [ ] `sandykit team init` → `sandykit.team.json` créé
- [ ] `sandykit share todo-api --spec` → lien généré

**14/14 ✓ → Bravo, tu maîtrises SANDYKIT ! 🎉**

---

## 🚨 Problèmes courants et solutions

### "sandykit: command not found"

```bash
# Relancer le link depuis le dossier Sandykit
cd ~/Desktop/Sandykit
npm link
```

### Clé API non reconnue (Node v24)

Sur Node v24, le keychain peut ne pas fonctionner. Utilise la variable d'environnement :

```bash
# Windows (PowerShell)
$env:ANTHROPIC_API_KEY = "sk-ant-api03-xxxx"

# macOS / Linux
export ANTHROPIC_API_KEY="sk-ant-api03-xxxx"
```

Lance toujours `sandykit dev` dans le même terminal que celui où tu as défini la variable.

### Le pipeline s'est arrêté en cours de route

```bash
# Reprendre exactement là où tu t'es arrêté
sandykit dev --resume
```

### "keytar is not a function" dans les logs

C'est un bug connu sur Node v24. Utilise la Méthode A (variable d'environnement) de l'étape 4.2. Ça n'empêche pas SANDYKIT de fonctionner.

### Le code généré ne compile pas

```bash
npx tsc --noEmit
```

Les erreurs TypeScript s'affichent avec le numéro de ligne. Souvent c'est :
- Une variable d'environnement manquante → vérifie ton `.env`
- Une dépendance non installée → `npm install`

### Vérification globale

```bash
sandykit doctor
```

Cette commande vérifie toute la configuration et signale les problèmes.

---

## 📚 Prochaines étapes

Maintenant que tu as testé toutes les fonctionnalités :

1. **Crée un vrai projet** avec `sandykit dev` en décrivant quelque chose que tu veux vraiment construire
2. **Partage avec un collègue** : envoie-lui le lien `sandykit share`
3. **Export vers Jira/Linear** : `sandykit tickets todo-api --jira` (nécessite une config Jira)
4. **Active les commits automatiques** : dans `sandykit.team.json`, mets `"autoCommit": true`
5. **Teste la génération incrémentale** : sur un vrai projet existant avec `sandykit add`

---

*SANDYKIT v2.0.0 — Guide de test rédigé le 2026-05-18*
