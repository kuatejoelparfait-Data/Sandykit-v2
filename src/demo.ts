import * as p from '@clack/prompts';
import chalk from 'chalk';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { showBanner } from './banner.js';

// ─── Contenu pré-écrit ────────────────────────────────────────────────────────

const DEMO_SPEC = `# Spécification : Task Manager Rapide

**Créé** : ${new Date().toLocaleDateString('fr-FR')}
**Statut** : Validé
**Dossier** : \`specs/001-task-manager-rapide/\`

## Scénarios utilisateur

### Scénario 1 — Créer une tâche (Priorité : P1)
Un utilisateur saisit un titre et une description, sélectionne une priorité (haute/moyenne/basse),
puis clique "Ajouter". La tâche apparaît immédiatement dans la liste.
**Pourquoi P1** : Fonctionnalité centrale sans laquelle l'app n'a pas de valeur.

### Scénario 2 — Marquer une tâche comme terminée (Priorité : P1)
Un utilisateur coche une case à côté de la tâche. Elle passe visuellement en "terminée"
(texte barré, couleur grisée) et se déplace en bas de la liste.
**Pourquoi P1** : Feedback immédiat essentiel à l'expérience utilisateur.

### Scénario 3 — Filtrer les tâches (Priorité : P2)
Un utilisateur clique sur "Actives" / "Terminées" / "Toutes" pour filtrer l'affichage.
**Pourquoi P2** : Améliore la lisibilité sur des listes longues.

## Exigences fonctionnelles

- [ ] Ajouter une tâche avec titre (requis), description (optionnel), priorité
- [ ] Marquer une tâche comme terminée / non terminée
- [ ] Supprimer une tâche avec confirmation
- [ ] Filtrer par statut : toutes / actives / terminées
- [ ] Persistance locale (localStorage ou fichier JSON)
- [ ] Compteur de tâches actives affiché en temps réel

## Critères de succès

- Ajout d'une tâche < 2 secondes
- Interface fonctionnelle sans rechargement de page
- Données persistées après fermeture du navigateur
- 0 erreur console en usage normal

## Hors périmètre

- Authentification utilisateur
- Synchronisation multi-appareils
- Notifications push
`;

const DEMO_PLAN = `# Plan Technique : Task Manager Rapide

**Créé** : ${new Date().toLocaleDateString('fr-FR')}
**Spec** : specs/001-task-manager-rapide/spec.md
**Statut** : Validé

## Résumé technique

Application React SPA avec gestion d'état Zustand, persistance localStorage,
et interface Tailwind CSS. Architecture simple, zéro backend requis.

## Stack technique

- **Langage** : TypeScript 5
- **Framework** : React 18 + Vite
- **État** : Zustand (persist middleware)
- **Style** : Tailwind CSS + shadcn/ui
- **Tests** : Vitest + Testing Library
- **Build** : Vite → dist/

## Architecture

### Composants

| Composant | Rôle | Fichier |
|-----------|------|---------|
| App | Racine, layout global | \`src/App.tsx\` |
| TaskInput | Formulaire d'ajout | \`src/components/TaskInput.tsx\` |
| TaskList | Liste + filtres | \`src/components/TaskList.tsx\` |
| TaskItem | Carte d'une tâche | \`src/components/TaskItem.tsx\` |
| FilterBar | Boutons de filtre | \`src/components/FilterBar.tsx\` |

### Store Zustand

\`\`\`typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'haute' | 'moyenne' | 'basse';
  done: boolean;
  createdAt: string;
}

interface TaskStore {
  tasks: Task[];
  filter: 'toutes' | 'actives' | 'terminees';
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'done'>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  setFilter: (f: TaskStore['filter']) => void;
}
\`\`\`

## Risques

- Conflit localStorage si plusieurs onglets → mitigation : zustand/persist gère ça nativement
`;

const DEMO_TASKS = `# Tâches : Task Manager Rapide

**Total** : 8 tâches | **Estimé** : 1 journée

## Setup

- [ ] **T1** Initialiser projet Vite + React + TypeScript (\`npm create vite\`)
- [ ] **T2** Installer dépendances : zustand, tailwindcss, @testing-library/react, vitest

## Store

- [ ] **T3** Créer \`src/store/taskStore.ts\` avec Zustand + persist middleware
- [ ] **T4** Tests unitaires du store (add, toggle, delete, filter)

## Composants

- [ ] **T5** \`TaskInput.tsx\` : formulaire titre + priorité + bouton Ajouter
- [ ] **T6** \`TaskItem.tsx\` : affichage tâche, checkbox, bouton supprimer
- [ ] **T7** \`TaskList.tsx\` + \`FilterBar.tsx\` : liste filtrée + compteur actives

## Finalisation

- [ ] **T8** \`App.tsx\` : assemblage + style global Tailwind + README.md
`;

const DEMO_CODE = `## Fichier: package.json
\`\`\`json
{
  "name": "task-manager-rapide",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vitest": "^1.5.0",
    "@testing-library/react": "^15.0.0",
    "tailwindcss": "^3.4.0"
  }
}
\`\`\`

## Fichier: src/store/taskStore.ts
\`\`\`typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'haute' | 'moyenne' | 'basse';
  done: boolean;
  createdAt: string;
}

interface TaskStore {
  tasks: Task[];
  filter: 'toutes' | 'actives' | 'terminees';
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'done'>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  setFilter: (f: TaskStore['filter']) => void;
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set) => ({
      tasks: [],
      filter: 'toutes',
      addTask: (t) => set((s) => ({
        tasks: [...s.tasks, { ...t, id: crypto.randomUUID(), done: false, createdAt: new Date().toISOString() }],
      })),
      toggleTask: (id) => set((s) => ({
        tasks: s.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t),
      })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      setFilter: (filter) => set({ filter }),
    }),
    { name: 'task-manager-storage' }
  )
);
\`\`\`

## Fichier: src/App.tsx
\`\`\`tsx
import { TaskInput } from './components/TaskInput';
import { TaskList } from './components/TaskList';
import { useTaskStore } from './store/taskStore';

export default function App() {
  const activeCount = useTaskStore((s) => s.tasks.filter((t) => !t.done).length);
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Task Manager</h1>
        <p className="text-gray-500 mb-6">{activeCount} tâche{activeCount !== 1 ? 's' : ''} active{activeCount !== 1 ? 's' : ''}</p>
        <TaskInput />
        <TaskList />
      </div>
    </div>
  );
}
\`\`\`

## Fichier: README.md
\`\`\`markdown
# Task Manager Rapide

Application de gestion de tâches React + Zustand + Tailwind.

## Installation

\\\`\\\`\\\`bash
npm install
npm run dev
\\\`\\\`\\\`

## Tests

\\\`\\\`\\\`bash
npm test
\\\`\\\`\\\`

## Stack

- React 18 + TypeScript
- Zustand (persistance localStorage)
- Tailwind CSS
- Vitest + Testing Library
\`\`\`
`;

// ─── Streaming simulé ─────────────────────────────────────────────────────────

async function fakeStream(text: string, delayMs = 8): Promise<void> {
  process.stdout.write(chalk.dim('\n'));
  for (const char of text) {
    process.stdout.write(char);
    await new Promise(r => setTimeout(r, delayMs));
  }
  process.stdout.write('\n\n');
}

async function pause(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Menu numéroté (copie locale pour ne pas dépendre de dev.ts) ─────────────

async function numMenu<T extends string>(
  message: string,
  options: { value: T; label: string }[],
  backLabel?: string
): Promise<T | '__back__' | symbol> {
  console.log(chalk.cyan(`\n  ${message}\n`));
  options.forEach((opt, i) => {
    console.log(chalk.white(`  ${chalk.bold(String(i + 1))}.  ${opt.label}`));
  });
  if (backLabel) console.log(chalk.dim(`  0.  ${backLabel}`));
  console.log('');
  const max = options.length;
  const answer = await p.text({
    message: backLabel ? `Choix [0-${max}] :` : `Choix [1-${max}] :`,
    validate: (v) => {
      const n = parseInt(v.trim());
      const min = backLabel ? 0 : 1;
      if (isNaN(n) || n < min || n > max) return `Entrez un nombre entre ${min} et ${max}`;
    },
  });
  if (p.isCancel(answer)) return answer as symbol;
  const n = parseInt((answer as string).trim());
  if (n === 0) return '__back__';
  return options[n - 1].value;
}

// ─── Demo principale ──────────────────────────────────────────────────────────

export async function runDemo(): Promise<void> {
  const clearScreen = () => process.stdout.write('\x1Bc');

  clearScreen();
  showBanner();

  console.log(
    chalk.bgCyan.black('  MODE DEMO  ') +
    chalk.dim('  Aucune cle API requise — contenu simule pour illustrer le pipeline\n')
  );

  await pause(800);

  // ── Étape 0 : choix du type de projet ──
  const catChoice = await numMenu('Categorie de projet :', [
    { value: 'frontend',  label: 'Frontend   —  React, Next.js, Dashboard, Landing Page' },
    { value: 'backend',   label: 'Backend    —  API REST, GraphQL, Microservice' },
    { value: 'fullstack', label: 'Fullstack  —  SaaS complet, Monorepo Turborepo' },
    { value: 'mobile',    label: 'Mobile     —  React Native + Expo' },
    { value: 'data-ai',   label: 'Data & IA  —  Agent LLM, RAG, Pipeline ML' },
    { value: 'tools',     label: 'Outils     —  CLI npm, Extension VS Code' },
    { value: 'custom',    label: 'Projet personnalise' },
  ]);
  if (p.isCancel(catChoice)) { p.cancel('Demo annulee'); return; }

  clearScreen();
  console.log(chalk.bold.cyan('\n  Web App React / Next.js\n'));
  console.log(chalk.dim('  Stack cible : React 18, TypeScript, Zustand, Tailwind CSS, Vite\n'));
  await pause(500);

  // ── Étape 1 : provider ──
  p.intro(chalk.bold('① Provider IA'));
  console.log(chalk.dim('  [DEMO] Provider simule — aucun appel API reel ne sera effectue\n'));
  console.log(chalk.green('  ✓ Provider : Demo (streaming simule)'));
  await pause(600);

  // ── Étape 2 : nom du projet ──
  p.intro(chalk.bold('② Nom du projet'));
  const projectName = await p.text({
    message: 'Nom du projet :',
    placeholder: 'Task Manager Rapide',
    defaultValue: 'Task Manager Rapide',
  });
  if (p.isCancel(projectName)) { p.cancel('Demo annulee'); return; }
  const name = (projectName as string) || 'Task Manager Rapide';
  console.log(chalk.green(`\n  ✓ Projet : ${name}`));
  await pause(400);

  // ── Étape 3 : description ──
  p.intro(chalk.bold('③ Description du projet'));
  console.log(chalk.dim('  [DEMO] Description pre-remplie\n'));
  console.log(chalk.white('  Une app web de gestion de taches avec :'));
  console.log(chalk.dim('    - Ajout / suppression de taches'));
  console.log(chalk.dim('    - Priorites haute / moyenne / basse'));
  console.log(chalk.dim('    - Filtre actives / terminees / toutes'));
  console.log(chalk.dim('    - Persistance localStorage\n'));

  const confirmDesc = await numMenu('Description prete ?', [
    { value: 'ok', label: 'Continuer vers la spec' },
  ]);
  if (p.isCancel(confirmDesc)) { p.cancel('Demo annulee'); return; }

  // ── Créer le dossier feature ──
  const specsDir = join(process.cwd(), 'specs');
  const featureDir = join(specsDir, '001-task-manager-rapide');
  mkdirSync(featureDir, { recursive: true });

  // ── Étape 4 : spec ──
  clearScreen();
  p.intro(chalk.bold('④ Specification fonctionnelle'));
  const specSpinner = p.spinner();
  specSpinner.start('Generation de la spec...');
  await pause(1200);
  specSpinner.stop('Spec generee :');
  await fakeStream(DEMO_SPEC, 4);
  writeFileSync(join(featureDir, 'spec.md'), DEMO_SPEC, 'utf-8');
  console.log(chalk.green('  ✓ spec.md sauvegarde'));

  const specAction = await numMenu('Specification — que faire ?', [
    { value: 'ok',     label: 'Valider et continuer' },
    { value: 'refine', label: 'Regenerer (ajouter des precisions)' },
    { value: 'edit',   label: 'Modifier manuellement le fichier' },
  ]);
  if (p.isCancel(specAction)) { p.cancel('Demo annulee'); return; }
  if (specAction === 'refine') {
    console.log(chalk.dim('\n  [DEMO] Dans la vraie version, tu entres des precisions et l\'IA regenere.'));
    await pause(1000);
  }

  // ── Étape 5 : plan ──
  clearScreen();
  p.intro(chalk.bold('⑤ Plan technique'));
  const planSpinner = p.spinner();
  planSpinner.start('Generation du plan...');
  await pause(1000);
  planSpinner.stop('Plan genere :');
  await fakeStream(DEMO_PLAN, 4);
  writeFileSync(join(featureDir, 'plan.md'), DEMO_PLAN, 'utf-8');
  console.log(chalk.green('  ✓ plan.md sauvegarde'));

  const planAction = await numMenu('Plan technique — que faire ?', [
    { value: 'ok', label: 'Valider et continuer' },
  ]);
  if (p.isCancel(planAction)) { p.cancel('Demo annulee'); return; }

  // ── Étape 6 : tâches ──
  clearScreen();
  p.intro(chalk.bold('⑥ Taches de developpement'));
  const tasksSpinner = p.spinner();
  tasksSpinner.start('Generation des taches...');
  await pause(900);
  tasksSpinner.stop('Taches generees :');
  await fakeStream(DEMO_TASKS, 5);
  writeFileSync(join(featureDir, 'tasks.md'), DEMO_TASKS, 'utf-8');
  console.log(chalk.green('  ✓ tasks.md sauvegarde'));

  const tasksAction = await numMenu('Taches — que faire ?', [
    { value: 'ok', label: 'Valider et continuer' },
  ]);
  if (p.isCancel(tasksAction)) { p.cancel('Demo annulee'); return; }

  // ── Étape 7 : implémentation ──
  clearScreen();
  p.intro(chalk.bold('⑦ Implementation'));

  console.log(chalk.bold('\n  Estimation de cout :\n'));
  console.log(chalk.white('  Modele         : ') + chalk.cyan('claude-sonnet-4-6 (demo)'));
  console.log(chalk.white('  Tokens entree  : ') + chalk.dim('~4 200'));
  console.log(chalk.white('  Tokens sortie  : ') + chalk.dim('~8 500'));
  console.log(chalk.white('  Cout estime    : ') + chalk.green('$0.09'));
  console.log('');

  const implProceed = await numMenu('Lancer l\'implementation autonome ?', [
    { value: 'ok', label: 'Oui, ecrire le code' },
  ], '0  <- Revoir les taches');
  if (p.isCancel(implProceed) || implProceed === '__back__') { p.cancel('Demo annulee'); return; }

  const codeSpinner = p.spinner();
  codeSpinner.start('Implementation en cours...');
  await pause(1500);
  codeSpinner.stop('Code genere :');
  await fakeStream(DEMO_CODE, 3);
  writeFileSync(join(featureDir, 'implement.md'), DEMO_CODE, 'utf-8');

  // Écrire les vrais fichiers
  const demoProjectDir = join(process.cwd(), 'demo-task-manager');
  mkdirSync(join(demoProjectDir, 'src', 'store'), { recursive: true });
  mkdirSync(join(demoProjectDir, 'src', 'components'), { recursive: true });

  writeFileSync(join(demoProjectDir, 'package.json'), JSON.stringify({
    name: 'task-manager-rapide', version: '1.0.0',
    scripts: { dev: 'vite', build: 'tsc && vite build', test: 'vitest' },
    dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0', zustand: '^4.5.0' },
    devDependencies: { typescript: '^5.4.0', vite: '^5.2.0', '@vitejs/plugin-react': '^4.2.0', vitest: '^1.5.0', tailwindcss: '^3.4.0' }
  }, null, 2), 'utf-8');

  writeFileSync(join(demoProjectDir, 'src', 'store', 'taskStore.ts'), `import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'haute' | 'moyenne' | 'basse';
  done: boolean;
  createdAt: string;
}

interface TaskStore {
  tasks: Task[];
  filter: 'toutes' | 'actives' | 'terminees';
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'done'>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  setFilter: (f: TaskStore['filter']) => void;
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set) => ({
      tasks: [],
      filter: 'toutes',
      addTask: (t) => set((s) => ({
        tasks: [...s.tasks, { ...t, id: crypto.randomUUID(), done: false, createdAt: new Date().toISOString() }],
      })),
      toggleTask: (id) => set((s) => ({
        tasks: s.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t),
      })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      setFilter: (filter) => set({ filter }),
    }),
    { name: 'task-manager-storage' }
  )
);
`, 'utf-8');

  writeFileSync(join(demoProjectDir, 'README.md'), `# Task Manager Rapide\n\nGenere par SANDYKIT demo.\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`, 'utf-8');

  console.log(chalk.green('  ✓ 3 fichier(s) ecrits dans demo-task-manager/'));
  console.log(chalk.dim(`    demo-task-manager/package.json`));
  console.log(chalk.dim(`    demo-task-manager/src/store/taskStore.ts`));
  console.log(chalk.dim(`    demo-task-manager/README.md`));

  // ── Génération de tests ──
  const genTests = await numMenu('Generer les tests automatiquement ?', [
    { value: 'yes', label: 'Oui' },
    { value: 'no',  label: 'Non' },
  ]);
  if (!p.isCancel(genTests) && genTests === 'yes') {
    const testSpinner = p.spinner();
    testSpinner.start('Generation des tests...');
    await pause(1200);
    const testContent = `import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../store/taskStore';

describe('TaskStore', () => {
  beforeEach(() => useTaskStore.setState({ tasks: [], filter: 'toutes' }));

  it('ajoute une tache', () => {
    useTaskStore.getState().addTask({ title: 'Test', priority: 'haute' });
    expect(useTaskStore.getState().tasks).toHaveLength(1);
    expect(useTaskStore.getState().tasks[0].done).toBe(false);
  });

  it('coche une tache', () => {
    useTaskStore.getState().addTask({ title: 'Test', priority: 'basse' });
    const id = useTaskStore.getState().tasks[0].id;
    useTaskStore.getState().toggleTask(id);
    expect(useTaskStore.getState().tasks[0].done).toBe(true);
  });

  it('supprime une tache', () => {
    useTaskStore.getState().addTask({ title: 'Test', priority: 'moyenne' });
    const id = useTaskStore.getState().tasks[0].id;
    useTaskStore.getState().deleteTask(id);
    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });
});
`;
    mkdirSync(join(demoProjectDir, 'src', '__tests__'), { recursive: true });
    writeFileSync(join(demoProjectDir, 'src', '__tests__', 'taskStore.test.ts'), testContent, 'utf-8');
    testSpinner.stop('3 test(s) generes  ✓');
    console.log(chalk.dim('    demo-task-manager/src/__tests__/taskStore.test.ts'));
  }

  // ── Validation ──
  const validSpinner = p.spinner();
  validSpinner.start('Validation du projet...');
  await pause(800);
  validSpinner.stop('Validation terminee');
  console.log(chalk.green('  ✓') + '  package.json         present');
  console.log(chalk.green('  ✓') + '  README.md            present');
  console.log(chalk.green('  ✓') + '  Structure source     conforme au plan');
  console.log(chalk.dim('\n  [DEMO] Dans la vraie version : npm install + tsc + vitest sont lances ici.'));

  // ── Fichier de liaison ──
  const sandykitDir = join(process.cwd(), '.sandykit');
  mkdirSync(sandykitDir, { recursive: true });
  writeFileSync(join(sandykitDir, 'last-session.json'), JSON.stringify({
    projectName: name,
    featureDir: 'specs/001-task-manager-rapide',
    completedSteps: ['spec', 'plan', 'tasks', 'implement'],
    updatedAt: new Date().toISOString(),
    demo: true,
  }, null, 2), 'utf-8');

  // ── Outro ──
  console.log('');
  p.outro(chalk.green(`✓ Demo terminee — projet "${name}" livre`));

  console.log(chalk.cyan('\n  Fichiers crees :\n'));
  console.log(chalk.white('  specs/001-task-manager-rapide/'));
  console.log(chalk.dim('    spec.md          ← specification fonctionnelle'));
  console.log(chalk.dim('    plan.md          ← plan technique + stack'));
  console.log(chalk.dim('    tasks.md         ← 8 taches ordonnees'));
  console.log(chalk.dim('    implement.md     ← code genere'));
  console.log(chalk.white('\n  demo-task-manager/'));
  console.log(chalk.dim('    package.json'));
  console.log(chalk.dim('    src/store/taskStore.ts'));
  console.log(chalk.dim('    src/__tests__/taskStore.test.ts'));
  console.log(chalk.dim('    README.md'));

  console.log(chalk.cyan('\n  Pour continuer dans ton agent IA :\n'));
  console.log('  ' + chalk.bold('/sandykit.continue') + chalk.dim('  →  voir l\'etat du projet'));
  console.log('  ' + chalk.bold('/sandykit.review  ') + chalk.dim('  →  revue du code genere'));
  console.log('  ' + chalk.bold('/sandykit.implement') + chalk.dim(' →  implementer les taches restantes\n'));

  console.log(chalk.dim('  Pour lancer la vraie version avec ton API :'));
  console.log(chalk.white('  sandykit dev\n'));
}
