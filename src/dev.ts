import * as p from '@clack/prompts';
import chalk from 'chalk';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { showBanner } from './banner.js';
import { createProvider, PROVIDER_MODELS, type ProviderConfig, type ProviderType } from './providers.js';
import { readCahierDesCharges } from './reader.js';
import { saveConfig, loadConfig } from './config.js';
import { saveCheckpoint, loadCheckpoint, clearCheckpoint, describeCheckpoint, type CheckpointState } from './checkpoint.js';
import { saveVersioned, loadLatestVersion, listVersions, summarizeDiff } from './versioning.js';
import { storeApiKey, getApiKey } from './keystore.js';
import { detectStack, stackToPromptContext } from './stack-detector.js';
import { validateGeneratedProject, printValidationResult } from './validator.js';
import { estimateCost, formatCostEstimate } from './cost-estimator.js';
import { PROJECT_TEMPLATES, type ProjectTemplate } from './project-templates.js';
import { generateTests, runLintAndFormat } from './test-generator.js';
import { autoCommit, initGitRepo, type CommitStep } from './git-committer.js';
import { loadTeamConfig, hasTeamConfig, runWebhook } from './team.js';
import { buildRAGContext, formatRAGContextForPrompt } from './rag.js';
import { parseGeneratedFiles, interactiveDiffWrite } from './diff-writer.js';
import { checkBudget, recordUsage, sendBudgetAlert } from './budget.js';
import { createPullRequest, ghAvailable } from './pr-creator.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepResult<T> = { action: 'next'; data: T } | { action: 'back' } | { action: 'cancel' };

// ─── Menu numéroté (évite les bugs de redraw de @clack sur Windows) ───────────

async function numMenu<T extends string>(
  message: string,
  options: { value: T; label: string }[],
  backLabel?: string
): Promise<T | '__back__' | symbol> {
  console.log(chalk.cyan(`\n  ${message}\n`));
  options.forEach((opt, i) => {
    console.log(chalk.white(`  ${chalk.bold(String(i + 1))}.  ${opt.label}`));
  });
  if (backLabel) {
    console.log(chalk.dim(`  0.  ${backLabel}`));
  }
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

interface DevState {
  providerCfg?: ProviderConfig;
  projectName?: string;
  input?: string;
  spec?: string;
  plan?: string;
  tasks?: string;
  featureDir?: string;
  autoGit?: boolean;
  webhookUrl?: string;
}

// ─── System prompts ───────────────────────────────────────────────────────────

const SYSTEM_SPEC     = `Tu es un expert en spécification fonctionnelle. Rédige des specs claires, orientées valeur utilisateur, sans détails d'implémentation. Chaque exigence doit être testable. Réponds uniquement en markdown.`;
const SYSTEM_PLAN     = `Tu es un architecte logiciel senior. Génère un plan technique concis : stack, structure des dossiers, composants, flux de données. Réponds uniquement en markdown.`;
const SYSTEM_TASKS    = `Tu es un tech lead. Décompose le plan en tâches ordonnées avec dépendances. Chaque tâche < 1 journée. Format : checkboxes markdown par composant.`;
const SYSTEM_CODE = `Tu es un développeur senior full-stack. Tu livres un projet COMPLET et FONCTIONNEL prêt à être lancé.

RÈGLES ABSOLUES :
- Génère TOUS les fichiers nécessaires sans exception
- Toujours inclure : package.json (racine + chaque sous-projet), README.md, .env.example, .gitignore
- Pour un backend : toutes les routes, controllers, models, middlewares, avec package.json complet et versions précises
- Pour un frontend : toutes les pages et composants référencés, router configuré, index.html, vite.config ou équivalent
- Code COMPLET dans chaque fichier — jamais de // TODO, jamais de placeholder, jamais de "reste du code ici"
- .env.example avec toutes les variables d'env et des valeurs d'exemple réalistes
- README.md avec : description, prérequis, installation, lancement, structure du projet
- Commence par lister TOUS les fichiers que tu vas créer (plan de fichiers), puis génère-les un par un dans l'ordre

FORMAT OBLIGATOIRE pour chaque fichier :
## Fichier: chemin/relatif/depuis/racine.ext
\`\`\`
[contenu complet du fichier]
\`\`\``;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cancel(): never {
  p.cancel('Annulé');
  process.exit(0);
}

async function streamToConsole(
  provider: ReturnType<typeof createProvider>,
  prompt: string,
  system: string
): Promise<string> {
  let result = '';
  process.stdout.write(chalk.dim('\n'));
  await provider.stream(prompt, system, (chunk) => {
    process.stdout.write(chunk);
    result += chunk;
  });
  process.stdout.write('\n\n');
  return result;
}

async function actionMenu(label: string, canGoBack: boolean): Promise<'ok' | 'refine' | 'edit' | 'back' | 'cancel'> {
  const options: Array<{ value: string; label: string }> = [
    { value: 'ok',     label: 'Valider et continuer' },
    { value: 'refine', label: 'Regenerer (ajouter des precisions)' },
    { value: 'edit',   label: 'Modifier manuellement le fichier' },
    { value: 'cancel', label: 'Annuler' },
  ];

  const choice = await numMenu(
    `${label} — que faire ?`,
    options,
    canGoBack ? '0  <- Etape precedente' : undefined
  );
  if (p.isCancel(choice)) return 'cancel';
  if (choice === '__back__') return 'back';
  return choice as 'ok' | 'refine' | 'edit' | 'cancel';
}

// ─── Wrappers universels (0 = retour, Ctrl+C = retour) ──────────────────────

async function askText(opts: {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  optional?: boolean;
}): Promise<string | '__back__'> {
  const result = await p.text({
    message: opts.message + chalk.dim('  [0 = retour]'),
    placeholder: opts.placeholder,
    defaultValue: opts.defaultValue,
    validate: v => {
      if (v?.trim() === '0') return undefined;
      if (!opts.optional && !v?.trim()) return 'Requis — ou tapez 0 pour revenir';
    },
  });
  if (p.isCancel(result) || (result as string)?.trim() === '0') return '__back__';
  return result as string;
}

async function askPassword(opts: {
  message: string;
  minLen?: number;
  optional?: boolean;
}): Promise<string | '__back__'> {
  const result = await p.password({
    message: opts.message + chalk.dim('  [0 = retour]'),
    validate: v => {
      if (v?.trim() === '0') return undefined;
      if (!opts.optional && opts.minLen && v.trim().length < opts.minLen)
        return `Minimum ${opts.minLen} caracteres — ou tapez 0 pour revenir`;
    },
  });
  if (p.isCancel(result) || (result as string)?.trim() === '0') return '__back__';
  return result as string;
}

async function askConfirm(message: string): Promise<boolean> {
  const choice = await numMenu(message, [
    { value: 'yes', label: 'Oui' },
    { value: 'no',  label: 'Non, continuer' },
  ]);
  if (p.isCancel(choice) || choice === '__back__' || choice === 'no') return false;
  return true;
}

// ─── Étapes ───────────────────────────────────────────────────────────────────

async function stepProvider(state: DevState): Promise<StepResult<ProviderConfig>> {
  p.intro(chalk.bold('① Provider IA'));

  // ── Provider sauvegarde : proposer de le reutiliser ──
  const cfg = loadConfig();
  if (cfg?.provider) {
    const reuse = await numMenu(
      `Provider sauvegarde : ${cfg.provider.type} — ${cfg.provider.model ?? 'modele par defaut'}`,
      [
        { value: 'reuse',  label: 'Utiliser ce provider' },
        { value: 'change', label: 'Changer de provider' },
        { value: 'cancel', label: 'Annuler' },
      ],
      '0  <- Retour au choix du projet'
    );
    if (p.isCancel(reuse) || reuse === 'cancel') { if (await askConfirm('Quitter SANDYKIT ?')) cancel(); return stepProvider(state); }
    if (reuse === '__back__') return { action: 'back' };
    if (reuse === 'reuse') {
      // Récupérer la clé API depuis le keystore (non stockée dans le fichier config)
      let savedApiKey: string | undefined;
      if (cfg.provider.type === 'claude' || cfg.provider.type === 'openai') {
        savedApiKey = await getApiKey(cfg.provider.type) ?? undefined;
        if (!savedApiKey) {
          const envKey = cfg.provider.type === 'claude' ? process.env['ANTHROPIC_API_KEY'] : process.env['OPENAI_API_KEY'];
          savedApiKey = envKey;
        }
      }
      return { action: 'next', data: { ...cfg.provider, apiKey: savedApiKey } };
    }
  }

  // ── Choix du provider ──
  const providerChoice = await numMenu('Quel provider IA ?', [
    { value: 'claude', label: 'Claude  (Anthropic) — API key requise' },
    { value: 'openai', label: 'OpenAI  (GPT-4o...) — API key requise' },
    { value: 'ollama', label: 'Ollama  (local)     — aucune cle, gratuit' },
    { value: 'custom', label: 'Provider personnalise — URL compatible OpenAI' },
  ], '0  <- Retour au choix du projet');
  if (p.isCancel(providerChoice)) return { action: 'back' };
  if (providerChoice === '__back__') return { action: 'back' };
  const type = providerChoice as ProviderType;

  let apiKey: string | undefined;
  let baseUrl: string | undefined;
  let model: string | undefined;

  // ── Cle API ──
  if (type === 'claude' || type === 'openai') {
    const envKey = type === 'claude' ? process.env['ANTHROPIC_API_KEY'] : process.env['OPENAI_API_KEY'];
    if (envKey) {
      console.log(chalk.green(`  Cle API detectee depuis variable d'environnement.\n`));
      apiKey = envKey;
    } else {
      const key = await askPassword({
        message: `Cle API ${type === 'claude' ? 'Anthropic' : 'OpenAI'} :`,
        minLen: 10,
      });
      if (key === '__back__') return stepProvider(state);
      apiKey = key;
    }
  }

  // ── URL base (Ollama / custom) ──
  if (type === 'ollama' || type === 'custom') {
    const url = await askText({
      message: type === 'ollama' ? 'URL Ollama :' : 'URL du provider :',
      placeholder: type === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com',
      defaultValue: type === 'ollama' ? 'http://localhost:11434' : '',
    });
    if (url === '__back__') return stepProvider(state);
    baseUrl = url;
    if (type === 'custom') {
      const key = await askPassword({ message: 'Cle API (0 pour ignorer) :', optional: true });
      if (key !== '__back__' && key) apiKey = key;
    }
  }

  // ── Choix du modele ──
  const models = PROVIDER_MODELS[type];
  if (models.length > 0) {
    const modelOpts = [
      ...models.map(m => ({ value: m, label: m })),
      { value: '__custom__', label: 'Autre modele (saisir manuellement)' },
    ];
    const modelChoice = await numMenu('Modele :', modelOpts, '0  <- Changer de provider');
    if (p.isCancel(modelChoice) || modelChoice === '__back__') return stepProvider(state);
    if (modelChoice === '__custom__') {
      const custom = await askText({ message: 'Nom du modele :' });
      if (custom === '__back__') return stepProvider(state);
      model = custom;
    } else {
      model = modelChoice as string;
    }
  } else {
    const custom = await askText({ message: 'Nom du modele :' });
    if (custom === '__back__') return stepProvider(state);
    model = custom;
  }

  return { action: 'next', data: { type, apiKey, baseUrl, model } };
}

async function stepProjectName(state: DevState): Promise<StepResult<string>> {
  p.intro(chalk.bold('② Nom du projet'));

  while (true) {
    const nameResult = await askText({
      message: 'Nom du projet :',
      placeholder: process.cwd().split(/[/\\]/).pop() ?? 'mon-projet',
      defaultValue: state.projectName ?? process.cwd().split(/[/\\]/).pop() ?? 'mon-projet',
    });
    if (nameResult === '__back__') return { action: 'back' };

    const confirm = await numMenu(`Projet : "${nameResult}"`, [
      { value: 'ok',     label: 'Continuer' },
      { value: 'redo',   label: 'Changer le nom' },
    ], '0  <- Changer de provider');
    if (p.isCancel(confirm) || confirm === '__back__') return { action: 'back' };
    if (confirm === 'redo') continue;
    return { action: 'next', data: nameResult };
  }
}

async function stepInput(state: DevState, filePath?: string): Promise<StepResult<string>> {
  p.intro(chalk.bold('③ Description du projet'));

  while (true) {
    let input = '';

    if (filePath) {
      const spinner = p.spinner();
      spinner.start(`Lecture de ${filePath}...`);
      try {
        input = await readCahierDesCharges(filePath);
        spinner.stop(`Fichier lu — ${input.length} caracteres`);
        console.log(chalk.dim(input.slice(0, 300) + (input.length > 300 ? '...' : '')));
      } catch (e) {
        spinner.stop('Erreur de lecture');
        console.log(chalk.red((e as Error).message));
      }
    }

    const manualResult = await askText({
      message: filePath ? 'Precisions supplementaires ? (0 = retour, Entree = ignorer) :' : 'Decris ton projet :',
      placeholder: filePath ? 'Contraintes, stack preferee...' : 'Une app de gestion de taches avec authentification...',
      defaultValue: state.input && !filePath ? state.input : undefined,
      optional: !!filePath,
    });
    if (manualResult === '__back__') return { action: 'back' };
    if (manualResult) {
      input = input ? `${input}\n\n---\nPrecisions :\n${manualResult}` : manualResult;
    }

    if (!input.trim()) {
      console.log(chalk.red('  Description requise.'));
      continue;
    }

    const confirm = await numMenu('Description prete ?', [
      { value: 'ok',   label: 'Continuer vers la spec' },
      { value: 'redo', label: 'Reecrire la description' },
    ], '0  <- Changer le nom du projet');
    if (p.isCancel(confirm) || confirm === '__back__') return { action: 'back' };
    if (confirm === 'redo') { state = { ...state, input: undefined }; continue; }
    return { action: 'next', data: input };
  }
}

async function stepSpec(provider: ReturnType<typeof createProvider>, state: DevState): Promise<StepResult<string>> {
  p.intro(chalk.bold('④ Spécification fonctionnelle'));

  let additions = '';
  let spec = state.spec ?? '';

  while (true) {
    const spinner = p.spinner();
    spinner.start('Génération de la spec...');
    const stackCtx    = state.stack    ? stackToPromptContext(state.stack) : '';
    const templateCtx = state.template?.specPromptBoost ? `\n\n## Directives du template ${state.template.label}\n${state.template.specPromptBoost}` : '';
    const stackHint   = state.template?.stackHint ? `\n\nStack cible : ${state.template.stackHint}` : '';
    const ragSection  = state.ragContext ? formatRAGContextForPrompt(state.ragContext) : '';
    const prompt = `Voici la description du projet :\n\n${state.input}${additions ? `\n\nPrécisions :\n${additions}` : ''}${stackCtx ? `\n\n${stackCtx}` : ''}${templateCtx}${stackHint}${ragSection ? `\n\n${ragSection}` : ''}\n\nGénère une spécification fonctionnelle complète en markdown : scénarios utilisateur, exigences fonctionnelles, critères de succès, hors périmètre.`;
    spinner.stop('Spec générée :');
    spec = await streamToConsole(provider, prompt, SYSTEM_SPEC);

    const action = await actionMenu('Spécification', true);

    if (action === 'cancel') { if (await askConfirm('Annuler et quitter ?')) cancel(); continue; }
    if (action === 'back') return { action: 'back' };
    if (action === 'ok') return { action: 'next', data: spec };

    if (action === 'refine') {
      const add = await askText({ message: 'Precisions pour la spec :', placeholder: 'Contrainte de securite, persona specifique...' });
      if (add !== '__back__' && add) additions = add;
      continue;
    }

    if (action === 'edit') {
      writeFileSync(join(state.featureDir!, 'spec.md'), spec, 'utf-8');
      console.log(chalk.yellow(`\nEdite le fichier puis reviens ici :\n  ${join(state.featureDir!, 'spec.md')}`));
      await askText({ message: 'Appuie sur Entree quand tu as termine...', optional: true });
      spec = readFileSync(join(state.featureDir!, 'spec.md'), 'utf-8');
      return { action: 'next', data: spec };
    }
  }
}

async function stepPlan(provider: ReturnType<typeof createProvider>, state: DevState): Promise<StepResult<string>> {
  p.intro(chalk.bold('⑤ Plan technique'));

  let additions = '';
  let plan = state.plan ?? '';

  while (true) {
    const spinner = p.spinner();
    spinner.start('Génération du plan...');
    const stackCtx    = state.stack    ? stackToPromptContext(state.stack) : '';
    const templateCtx = state.template?.planPromptBoost ? `\n\n## Directives d'architecture ${state.template.label}\n${state.template.planPromptBoost}` : '';
    const stackHint   = state.template?.stackHint ? `\n\nStack : ${state.template.stackHint}` : '';
    const prompt = `Spec :\n${state.spec}${additions ? `\n\nPrécisions :\n${additions}` : ''}${stackCtx ? `\n\n${stackCtx}` : ''}${templateCtx}${stackHint}\n\nGénère un plan technique : stack, architecture, structure des dossiers, composants, API/endpoints.`;
    spinner.stop('Plan généré :');
    plan = await streamToConsole(provider, prompt, SYSTEM_PLAN);

    const action = await actionMenu('Plan technique', true);

    if (action === 'cancel') { if (await askConfirm('Annuler et quitter ?')) cancel(); continue; }
    if (action === 'back') return { action: 'back' };
    if (action === 'ok') return { action: 'next', data: plan };

    if (action === 'refine') {
      const add = await askText({ message: 'Precisions pour le plan :', placeholder: 'Stack specifique, contrainte infra...' });
      if (add !== '__back__' && add) additions = add;
      continue;
    }

    if (action === 'edit') {
      writeFileSync(join(state.featureDir!, 'plan.md'), plan, 'utf-8');
      console.log(chalk.yellow(`\nEdite :\n  ${join(state.featureDir!, 'plan.md')}`));
      await askText({ message: 'Entree quand termine...', optional: true });
      plan = readFileSync(join(state.featureDir!, 'plan.md'), 'utf-8');
      return { action: 'next', data: plan };
    }
  }
}

async function stepTasks(provider: ReturnType<typeof createProvider>, state: DevState): Promise<StepResult<string>> {
  p.intro(chalk.bold('⑥ Tâches de développement'));

  let additions = '';
  let tasks = state.tasks ?? '';

  while (true) {
    const spinner = p.spinner();
    spinner.start('Génération des tâches...');
    const prompt = `Spec :\n${state.spec}\n\nPlan :\n${state.plan}${additions ? `\n\nPrécisions :\n${additions}` : ''}\n\nDécompose en tâches ordonnées, groupées par composant, avec checkboxes markdown.`;
    spinner.stop('Tâches générées :');
    tasks = await streamToConsole(provider, prompt, SYSTEM_TASKS);

    const action = await actionMenu('Tâches', true);

    if (action === 'cancel') { if (await askConfirm('Annuler et quitter ?')) cancel(); continue; }
    if (action === 'back') return { action: 'back' };
    if (action === 'ok') return { action: 'next', data: tasks };

    if (action === 'refine') {
      const add = await askText({ message: 'Precisions pour les taches :', placeholder: 'Ordre de priorite, tache manquante...' });
      if (add !== '__back__' && add) additions = add;
      continue;
    }

    if (action === 'edit') {
      writeFileSync(join(state.featureDir!, 'tasks.md'), tasks, 'utf-8');
      console.log(chalk.yellow(`\nEdite :\n  ${join(state.featureDir!, 'tasks.md')}`));
      await askText({ message: 'Entree quand termine...', optional: true });
      tasks = readFileSync(join(state.featureDir!, 'tasks.md'), 'utf-8');
      return { action: 'next', data: tasks };
    }
  }
}

async function stepImplement(provider: ReturnType<typeof createProvider>, state: DevState): Promise<StepResult<void>> {
  p.intro(chalk.bold('⑦ Implémentation'));

  const proceed = await numMenu('Lancer l\'implementation autonome ?', [
    { value: 'ok',     label: 'Oui, ecrire le code' },
    { value: 'cancel', label: 'Annuler' },
  ], '0  <- Revoir les taches');
  if (p.isCancel(proceed) || proceed === 'cancel') { if (await askConfirm('Annuler et quitter ?')) cancel(); return stepImplement(provider, state); }
  if (proceed === '__back__') return { action: 'back' };

  const addResult = await askText({
    message: 'Precisions pour l\'implementation ? (optionnel) :',
    placeholder: 'Framework UI, version Node, contraintes specifiques...',
    optional: true,
  });
  const additions = (addResult !== '__back__' && addResult) ? addResult : '';

  const spinner = p.spinner();
  spinner.start('Implémentation en cours...');
  const prompt = [
    'Tu dois implémenter un projet complet et livrable.',
    '',
    '## Spécification fonctionnelle',
    state.spec,
    '',
    '## Plan technique',
    state.plan,
    '',
    '## Tâches',
    state.tasks,
    additions ? `\n## Précisions supplémentaires\n${additions}` : '',
    '',
    '## Instructions impératives',
    '1. Liste dabord TOUS les fichiers que tu vas créer (liste complète)',
    '2. Génère ensuite chaque fichier en entier, sans rien omettre',
    '3. Inclus OBLIGATOIREMENT : package.json pour chaque module, README.md, .env.example, .gitignore',
    '4. Chaque fichier doit être complet — pas de placeholder, pas de TODO, pas de "reste du code"',
    '5. Les imports doivent correspondre exactement aux fichiers créés',
    '',
    'FORMAT pour chaque fichier :',
    '## Fichier: chemin/relatif/depuis/racine.ext',
    '```',
    '[contenu complet]',
    '```',
  ].join('\n');
  spinner.stop('Code généré :');

  const code = await streamToConsole(provider, prompt, SYSTEM_CODE);
  writeFileSync(join(state.featureDir!, 'implement.md'), code, 'utf-8');

  // ── Diff interactif avant écriture ──
  const parsedFiles = parseGeneratedFiles(code, process.cwd());
  if (parsedFiles.length > 0) {
    const writeResult = await interactiveDiffWrite(parsedFiles, process.cwd());
    console.log(chalk.green(`\n  ${writeResult.written.length} fichier(s) écrits`));
    if (writeResult.skipped.length > 0) {
      console.log(chalk.dim(`  ${writeResult.skipped.length} fichier(s) ignorés`));
    }
  } else {
    console.log(chalk.yellow('  Aucun fichier extrait — l\'IA n\'a pas utilisé le format ## Fichier:'));
    console.log(chalk.dim(`  Le code complet est dans : ${join(state.featureDir!, 'implement.md')}`));
  }

  return { action: 'next', data: undefined };
}

// ─── Machine à états ──────────────────────────────────────────────────────────

export async function runDev(opts: { file?: string; resume?: boolean; dryRun?: boolean; pr?: boolean }): Promise<void> {
  // (banner affiché dans la boucle de sélection de categorie)
  p.intro(chalk.cyan('SANDYKIT Dev — Agent autonome spec → code'));

  if (opts.dryRun) {
    console.log(chalk.yellow('  Mode --dry-run : spec + plan generes, aucun fichier de code ecrit\n'));
  }

  // ── Détection du stack existant ──
  const stack = detectStack();
  if (stack.language.length || stack.framework.length) {
    console.log(chalk.dim(`  Stack détecté : ${stack.summary}\n`));
  }

  // ── RAG : indexation du codebase existant (seulement si projet existant) ──
  const hasExistingProject = existsSync(join(process.cwd(), 'package.json'))
    || existsSync(join(process.cwd(), 'pyproject.toml'))
    || existsSync(join(process.cwd(), 'go.mod'))
    || existsSync(join(process.cwd(), 'Cargo.toml'));

  let ragContext: ReturnType<typeof buildRAGContext> = { chunks: [], totalTokens: 0, summary: '' };
  if (hasExistingProject) {
    const ragSpinner = p.spinner();
    ragSpinner.start('Analyse du codebase existant...');
    ragContext = buildRAGContext(process.cwd(), '', 5_000);
    ragSpinner.stop(ragContext.chunks.length > 0
      ? `${ragContext.chunks.length} fichier(s) de contexte indexés`
      : 'Aucun fichier source trouvé'
    );
  }

  // ── Fonctions d'aide ──────────────────────────────────────────────────────

  function showHelp(): void {
    console.log('');
    console.log(chalk.cyan('  ══════════════════════════════════════════════════'));
    console.log(chalk.bold.white('  COMMENT CA MARCHE'));
    console.log(chalk.cyan('  ══════════════════════════════════════════════════'));
    console.log('');
    console.log(chalk.white('  SANDYKIT suit un pipeline en 7 etapes :'));
    console.log('');
    console.log(chalk.bold('  1. Provider IA  ') + chalk.dim('→ choisir Claude, OpenAI ou Ollama'));
    console.log(chalk.bold('  2. Nom projet   ') + chalk.dim('→ nommer ton projet'));
    console.log(chalk.bold('  3. Description  ') + chalk.dim('→ decrire ce que tu veux construire'));
    console.log(chalk.bold('  4. Spec         ') + chalk.dim('→ l\'IA redige la specification fonctionnelle'));
    console.log(chalk.bold('  5. Plan         ') + chalk.dim('→ l\'IA genere le plan technique + stack'));
    console.log(chalk.bold('  6. Taches       ') + chalk.dim('→ l\'IA decompose en taches ordonnees'));
    console.log(chalk.bold('  7. Code         ') + chalk.dim('→ l\'IA genere tous les fichiers du projet'));
    console.log('');
    console.log(chalk.cyan('  ── NAVIGATION ───────────────────────────────────'));
    console.log(chalk.white('  Tapez un numero  ') + chalk.dim('→ selectionner une option'));
    console.log(chalk.white('  Option 0         ') + chalk.dim('→ retourner a l\'etape precedente'));
    console.log(chalk.white('  Ctrl+C           ') + chalk.dim('→ annuler et quitter'));
    console.log('');
    console.log(chalk.cyan('  ── CONSEILS ─────────────────────────────────────'));
    console.log(chalk.dim('  → Plus ta description est precise, meilleur est le code genere'));
    console.log(chalk.dim('  → Tu peux valider, regenerer ou modifier chaque etape'));
    console.log(chalk.dim('  → Si tu fermes le terminal : sandykit dev --resume pour reprendre'));
    console.log(chalk.dim('  → Le resultat est dans specs/001-nom-projet/'));
    console.log('');
    console.log(chalk.cyan('  ══════════════════════════════════════════════════\n'));
  }

  function showAllCommands(): void {
    console.log('');
    console.log(chalk.cyan('  ══════════════════════════════════════════════════'));
    console.log(chalk.bold.white('  TOUTES LES COMMANDES SANDYKIT'));
    console.log(chalk.cyan('  ══════════════════════════════════════════════════'));
    console.log('');
    console.log(chalk.bold.yellow('  PIPELINE'));
    console.log(chalk.white('  sandykit dev              ') + chalk.dim('→ generer un projet complet'));
    console.log(chalk.white('  sandykit dev --resume     ') + chalk.dim('→ reprendre une session interrompue'));
    console.log(chalk.white('  sandykit dev --dry-run    ') + chalk.dim('→ spec + plan sans ecrire de code'));
    console.log(chalk.white('  sandykit dev --pr         ') + chalk.dim('→ creer une PR apres generation'));
    console.log(chalk.white('  sandykit add [desc]       ') + chalk.dim('→ ajouter une feature a un projet existant'));
    console.log('');
    console.log(chalk.bold.yellow('  PROJET'));
    console.log(chalk.white('  sandykit init             ') + chalk.dim('→ installer dans un projet (slash commands)'));
    console.log(chalk.white('  sandykit status           ') + chalk.dim('→ etat de toutes les features'));
    console.log(chalk.white('  sandykit list             ') + chalk.dim('→ liste detaillee avec progression'));
    console.log(chalk.white('  sandykit watch            ') + chalk.dim('→ surveillance en temps reel'));
    console.log('');
    console.log(chalk.bold.yellow('  BUDGET IA'));
    console.log(chalk.white('  sandykit budget show      ') + chalk.dim('→ voir les depenses du mois'));
    console.log(chalk.white('  sandykit budget set 10    ') + chalk.dim('→ fixer limite mensuelle en $'));
    console.log(chalk.white('  sandykit budget reset     ') + chalk.dim('→ reinitialiser les depenses'));
    console.log('');
    console.log(chalk.bold.yellow('  EQUIPE'));
    console.log(chalk.white('  sandykit team init        ') + chalk.dim('→ configurer le mode equipe'));
    console.log(chalk.white('  sandykit team show        ') + chalk.dim('→ voir la configuration equipe'));
    console.log(chalk.white('  sandykit team add         ') + chalk.dim('→ ajouter un membre'));
    console.log('');
    console.log(chalk.bold.yellow('  PARTAGE & EXPORT'));
    console.log(chalk.white('  sandykit share [f] --spec ') + chalk.dim('→ partager la spec via Gist'));
    console.log(chalk.white('  sandykit share [f] --all  ') + chalk.dim('→ partager spec + plan + taches'));
    console.log(chalk.white('  sandykit tickets [f] --jira   ') + chalk.dim('→ exporter vers Jira'));
    console.log(chalk.white('  sandykit tickets [f] --linear ') + chalk.dim('→ exporter vers Linear'));
    console.log('');
    console.log(chalk.bold.yellow('  SLASH COMMANDS  (dans Claude Code / Cursor)'));
    console.log(chalk.white('  /sandykit.specify         ') + chalk.dim('→ generer la specification'));
    console.log(chalk.white('  /sandykit.clarify         ') + chalk.dim('→ affiner la specification'));
    console.log(chalk.white('  /sandykit.plan            ') + chalk.dim('→ generer le plan technique'));
    console.log(chalk.white('  /sandykit.tasks           ') + chalk.dim('→ decomposer en taches'));
    console.log(chalk.white('  /sandykit.implement       ') + chalk.dim('→ implementer le code'));
    console.log(chalk.white('  /sandykit.review          ') + chalk.dim('→ revue de code'));
    console.log(chalk.white('  /sandykit.back            ') + chalk.dim('→ revenir a l\'etape precedente'));
    console.log('');
    console.log(chalk.cyan('  ══════════════════════════════════════════════════\n'));
  }

  // ── Choix du template de projet (menu 2 niveaux avec retour) ──
  const savedCfg = loadConfig();
  const providerLine = savedCfg?.provider
    ? `${savedCfg.provider.type}  ${savedCfg.provider.model ?? ''}`
    : 'non configure';

  const CATEGORIES = [
    { value: 'frontend'  as const, label: 'Frontend   —  React, Next.js, Dashboard, Landing Page' },
    { value: 'backend'   as const, label: 'Backend    —  API REST, GraphQL, Microservice'         },
    { value: 'fullstack' as const, label: 'Fullstack  —  SaaS complet, Monorepo Turborepo'        },
    { value: 'mobile'    as const, label: 'Mobile     —  React Native + Expo'                     },
    { value: 'data-ai'   as const, label: 'Data & IA  —  Agent LLM, RAG, Pipeline ML'             },
    { value: 'tools'     as const, label: 'Outils     —  CLI npm, Extension VS Code'              },
    { value: 'custom'    as const, label: 'Projet personnalise  —  stack choisie par l\'IA'       },
    { value: 'provider'  as const, label: `[P] Provider IA  —  actuel : ${providerLine}`          },
    { value: 'help'      as const, label: '[?] Aide   —  comment ca marche, navigation, conseils' },
    { value: 'cmds'      as const, label: '[C] Commandes  —  toutes les commandes sandykit'       },
  ];

  const clearScreen = () => process.stdout.write('\x1Bc');

  // Pause après affichage d'un écran d'info (sinon clearScreen efface immédiatement)
  async function pauseAndContinue(): Promise<void> {
    await p.text({ message: chalk.dim('Appuie sur Entree pour revenir au menu...') });
  }

  let template: ProjectTemplate | undefined;
  while (!template) {
    clearScreen();
    showBanner();
    const catChoice = await numMenu('Categorie de projet :', CATEGORIES);
    if (p.isCancel(catChoice)) { p.cancel('Annulé'); return; }

    if (catChoice === 'provider') {
      // Configurer le provider directement depuis le menu de départ
      clearScreen();
      p.intro(chalk.bold('Configuration du provider IA'));
      const tempState: DevState = {};
      const provRes = await stepProvider(tempState);
      if (provRes.action === 'next') {
        const { apiKey, ...cfgWithoutKey } = provRes.data;
        if (apiKey) await storeApiKey(provRes.data.type, apiKey);
        const existingCfg = loadConfig();
        saveConfig({ ...(existingCfg ?? {}), provider: cfgWithoutKey });
        console.log(chalk.green(`\n  Provider sauvegarde : ${provRes.data.type} — ${provRes.data.model ?? 'modele par defaut'}\n`));
        await pauseAndContinue();
      }
      continue;
    }
    if (catChoice === 'help')  { clearScreen(); showHelp();        await pauseAndContinue(); continue; }
    if (catChoice === 'cmds')  { clearScreen(); showAllCommands(); await pauseAndContinue(); continue; }
    if (catChoice === '__back__') continue;

    if (catChoice === 'custom') {
      template = PROJECT_TEMPLATES.find(t => t.id === 'custom')!;
      break;
    }

    clearScreen();
    const catLabel = CATEGORIES.find(c => c.value === catChoice)?.label ?? catChoice;
    console.log(chalk.cyan(`\n  ${catLabel}\n`));

    const categoryTemplates = PROJECT_TEMPLATES.filter(t => t.category === catChoice);
    const typeChoice = await numMenu(
      'Type de projet :',
      categoryTemplates.map(t => ({ value: t.id, label: t.label })),
      'Retour aux categories'
    );
    if (p.isCancel(typeChoice) || typeChoice === '__back__') continue;
    template = PROJECT_TEMPLATES.find(t => t.id === typeChoice as string)!;
  }
  clearScreen();

  // ── Team config : defaults partagés ──
  const teamCfg = loadTeamConfig(process.cwd());
  const state: DevState & { stack?: typeof stack; template?: ProjectTemplate; ragContext?: typeof ragContext } = {
    stack,
    template,
    autoGit: teamCfg?.autoCommit ?? true,
    webhookUrl: teamCfg?.hooks?.webhook,
    ragContext,
  };
  let step = 0;

  const cp = loadCheckpoint();
  if (cp && !opts.resume) {
    const resume = await numMenu(`Session precedente trouvee : ${describeCheckpoint(cp)}`, [
      { value: 'resume', label: 'Reprendre depuis la ou j\'ai arrete' },
      { value: 'new',    label: 'Nouveau projet (ignorer le checkpoint)' },
    ]);
    if (!p.isCancel(resume) && resume !== '__back__' && resume === 'resume') {
      state.providerCfg = cp.providerCfg;
      state.projectName = cp.projectName;
      state.featureDir  = cp.featureDir;
      state.input       = cp.input;
      state.spec        = cp.spec;
      state.plan        = cp.plan;
      state.tasks       = cp.tasks;
      step = cp.step;
      // Récupérer la clé API depuis le keystore (non stockée dans le checkpoint)
      if (state.providerCfg && !state.providerCfg.apiKey) {
        const key = await getApiKey(state.providerCfg.type);
        if (key) state.providerCfg = { ...state.providerCfg, apiKey: key };
      }
      console.log(chalk.green(`  ✓ Reprise à l'étape ${step}\n`));
    }
  }

  while (step <= 6) {
    switch (step) {
      case 0: { // Provider
        const res = await stepProvider(state);
        if (res.action === 'cancel') return;
        if (res.action === 'back') {
          // Retour au menu de selection de categorie
          return runDev(opts);
        }
        if (res.action === 'next') {
          state.providerCfg = res.data;
          if (res.data.apiKey) await storeApiKey(res.data.type, res.data.apiKey);
          const existingCfg = loadConfig();
          saveConfig({ ...(existingCfg ?? {}), provider: { ...res.data, apiKey: undefined } });
          step++;
        }
        break;
      }

      case 1: { // Nom du projet
        const res = await stepProjectName(state);
        if (res.action === 'back') { step--; break; }
        if (res.action === 'next') {
          state.projectName = res.data;
          saveCheckpoint({ version: 1, projectName: res.data, featureDir: state.featureDir ?? '', providerCfg: state.providerCfg!, step: 1, savedAt: new Date().toISOString() });
          step++;
        }
        break;
      }

      case 2: { // Input + création du dossier feature
        if (!state.featureDir) {
          const specsDir = join(process.cwd(), 'specs');
          const existing = existsSync(specsDir) ? readdirSync(specsDir).filter(d => /^\d{3}-/.test(d)) : [];
          const nextNum = existing.length > 0 ? Math.max(...existing.map(d => parseInt(d.slice(0, 3), 10))) + 1 : 1;
          const pad = String(nextNum).padStart(3, '0');
          const slug = (state.projectName ?? 'projet').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          state.featureDir = join(specsDir, `${pad}-${slug}`);
          mkdirSync(state.featureDir, { recursive: true });
        }
        const res = await stepInput(state, opts.file);
        if (res.action === 'back') { step--; break; }
        if (res.action === 'next') {
          state.input = res.data;
          saveCheckpoint({ version: 1, projectName: state.projectName!, featureDir: state.featureDir, providerCfg: state.providerCfg!, input: state.input, step: 2, savedAt: new Date().toISOString() });
          step++;
        }
        break;
      }

      case 3: { // Spec
        const provider = createProvider(state.providerCfg!);
        const res = await stepSpec(provider, state);
        if (res.action === 'back') { step--; break; }
        if (res.action === 'next') {
          const prev = loadLatestVersion(state.featureDir!, 'spec');
          const version = saveVersioned(state.featureDir!, 'spec', res.data, 'Généré par IA');
          if (prev) console.log(chalk.dim(`  spec.md v${version} — ${summarizeDiff(prev, res.data)}`));
          else console.log(chalk.green(`  ✓ spec.md v${version} sauvegardé`));
          state.spec = res.data;
          saveCheckpoint({ version: 1, projectName: state.projectName!, featureDir: state.featureDir!, providerCfg: state.providerCfg!, input: state.input, spec: state.spec, step: 3, savedAt: new Date().toISOString() });
          if (state.autoGit) {
            const commit = await autoCommit(process.cwd(), 'spec', state.projectName!);
            if (commit.success && !commit.skipped) console.log(chalk.dim(`  git: ${commit.sha} — ${commit.message}`));
          }
          if (state.webhookUrl) runWebhook(state.webhookUrl, { step: 'spec', projectName: state.projectName!, timestamp: new Date().toISOString() });
          step++;
        }
        break;
      }

      case 4: { // Plan
        const provider = createProvider(state.providerCfg!);
        const res = await stepPlan(provider, state);
        if (res.action === 'back') { step--; break; }
        if (res.action === 'next') {
          const prev = loadLatestVersion(state.featureDir!, 'plan');
          const version = saveVersioned(state.featureDir!, 'plan', res.data, 'Généré par IA');
          if (prev) console.log(chalk.dim(`  plan.md v${version} — ${summarizeDiff(prev, res.data)}`));
          else console.log(chalk.green(`  ✓ plan.md v${version} sauvegardé`));
          state.plan = res.data;
          saveCheckpoint({ version: 1, projectName: state.projectName!, featureDir: state.featureDir!, providerCfg: state.providerCfg!, input: state.input, spec: state.spec, plan: state.plan, step: 4, savedAt: new Date().toISOString() });
          if (state.autoGit) {
            const commit = await autoCommit(process.cwd(), 'plan', state.projectName!);
            if (commit.success && !commit.skipped) console.log(chalk.dim(`  git: ${commit.sha} — ${commit.message}`));
          }
          if (state.webhookUrl) runWebhook(state.webhookUrl, { step: 'plan', projectName: state.projectName!, timestamp: new Date().toISOString() });
          step++;
        }
        break;
      }

      case 5: { // Tâches
        const provider = createProvider(state.providerCfg!);
        const res = await stepTasks(provider, state);
        if (res.action === 'back') { step--; break; }
        if (res.action === 'next') {
          const prev = loadLatestVersion(state.featureDir!, 'tasks');
          const version = saveVersioned(state.featureDir!, 'tasks', res.data, 'Généré par IA');
          if (prev) console.log(chalk.dim(`  tasks.md v${version} — ${summarizeDiff(prev, res.data)}`));
          else console.log(chalk.green(`  ✓ tasks.md v${version} sauvegardé`));
          state.tasks = res.data;
          saveCheckpoint({ version: 1, projectName: state.projectName!, featureDir: state.featureDir!, providerCfg: state.providerCfg!, input: state.input, spec: state.spec, plan: state.plan, tasks: state.tasks, step: 5, savedAt: new Date().toISOString() });
          if (state.autoGit) {
            const commit = await autoCommit(process.cwd(), 'tasks', state.projectName!);
            if (commit.success && !commit.skipped) console.log(chalk.dim(`  git: ${commit.sha} — ${commit.message}`));
          }
          if (state.webhookUrl) runWebhook(state.webhookUrl, { step: 'tasks', projectName: state.projectName!, timestamp: new Date().toISOString() });
          step++;
        }
        break;
      }

      case 6: { // Implémentation
        // ── Estimation de coût + vérification budget ──
        if (state.input && state.providerCfg?.model) {
          const est = estimateCost(state.providerCfg.model, state.providerCfg.type, state.input);
          console.log(chalk.bold('\n  Estimation de coût :\n'));
          console.log(formatCostEstimate(est));
          console.log();

          // Vérification budget mensuel
          const budgetCheck = checkBudget(process.cwd(), est.estimatedUSD);
          if (!budgetCheck.allowed) {
            console.log(chalk.red(`  ✗ ${budgetCheck.reason}`));
            console.log(chalk.dim('  Modifie le budget : sandykit budget set <montant>'));
            clearCheckpoint();
            step++;
            break;
          }
          if (budgetCheck.shouldAlert && state.webhookUrl) {
            sendBudgetAlert(state.webhookUrl, budgetCheck.status);
          }
          if (budgetCheck.status.percentUsed >= 80 && budgetCheck.status.limitUSD !== Infinity) {
            console.log(chalk.yellow(`  ⚠ Budget à ${budgetCheck.status.percentUsed}% ($${budgetCheck.status.spentUSD.toFixed(3)} / $${budgetCheck.status.limitUSD.toFixed(2)})`));
          }
        }

        // ── Mode dry-run : s'arrête ici ──
        if (opts.dryRun) {
          console.log(chalk.yellow('  Mode --dry-run : arrêt avant l\'implémentation'));
          console.log(chalk.dim(`  Specs sauvegardées dans : ${state.featureDir}`));
          clearCheckpoint();
          step++;
          break;
        }

        const provider = createProvider(state.providerCfg!);
        const res = await stepImplement(provider, state);
        if (res.action === 'back') { step--; break; }
        if (res.action === 'next') {
          // ── Génération de tests ──
          const genTests = await askConfirm('Generer les tests automatiquement ?');
          if (genTests) {
            const testSpinner = p.spinner();
            testSpinner.start('Génération des tests...');
            let testCode = '';
            await generateTests(provider, state.spec!, state.tasks!, process.cwd(), (chunk) => { testCode += chunk; });
            // Extraire et écrire les fichiers de test
            const testBlocks = [...testCode.matchAll(/## Fichier:\s*(.+?)\n```(?:\w+)?\n([\s\S]+?)```/g)];
            for (const [, filePath, content] of testBlocks) {
              const fullPath = join(process.cwd(), filePath.trim());
              mkdirSync(join(fullPath, '..'), { recursive: true });
              writeFileSync(fullPath, content, 'utf-8');
            }
            testSpinner.stop(`${testBlocks.length} fichier(s) de test générés`);
          }

          // ── Lint + Format ──
          const lintSpinner = p.spinner();
          lintSpinner.start('Lint + formatage du code...');
          const lintResults = await runLintAndFormat(process.cwd());
          lintSpinner.stop('Lint terminé');
          for (const r of lintResults) {
            const icon = r.passed ? chalk.green('  ✓') : chalk.yellow('  ⚠');
            console.log(`${icon}  ${r.tool}${r.errors > 0 ? chalk.red(` — ${r.errors} erreur(s)`) : ''}`);
          }

          // ── Validation post-génération ──
          const validSpinner = p.spinner();
          validSpinner.start('Validation du projet...');
          const validation = await validateGeneratedProject(process.cwd());
          validSpinner.stop('Validation terminée');
          printValidationResult(validation);

          // ── Auto-commit implementation ──
          if (state.autoGit) {
            const commitImpl = await autoCommit(process.cwd(), 'implement', state.projectName!);
            if (commitImpl.success && !commitImpl.skipped) console.log(chalk.dim(`  git: ${commitImpl.sha} — ${commitImpl.message}`));
            const commitTests = await autoCommit(process.cwd(), 'tests', state.projectName!);
            if (commitTests.success && !commitTests.skipped) console.log(chalk.dim(`  git: ${commitTests.sha} — ${commitTests.message}`));
          }
          if (state.webhookUrl) runWebhook(state.webhookUrl, { step: 'implement', projectName: state.projectName!, timestamp: new Date().toISOString() });

          // ── Enregistrement coût réel ──
          if (state.providerCfg?.model) {
            recordUsage(process.cwd(), {
              projectName: state.projectName ?? 'unknown',
              step: 'implement',
              model: state.providerCfg.model,
              provider: state.providerCfg.type,
              inputTokens: Math.ceil((state.spec?.length ?? 0 + (state.plan?.length ?? 0) + (state.tasks?.length ?? 0)) / 4),
              outputTokens: Math.ceil(8000),
            });
          }

          // ── Pull Request automatique ──
          if (opts.pr) {
            if (ghAvailable(process.cwd())) {
              const prSpinner = p.spinner();
              prSpinner.start('Création de la Pull Request...');
              const pr = await createPullRequest(process.cwd(), {
                projectName: state.projectName!,
                spec: state.spec!,
                plan: state.plan!,
                tasks: state.tasks!,
                draft: false,
              });
              if (pr.success) {
                prSpinner.stop('Pull Request créée !');
                console.log(chalk.cyan(`  → ${pr.url}`));
              } else {
                prSpinner.stop(`PR non créée : ${pr.error}`);
              }
            } else {
              console.log(chalk.yellow('  ⚠ gh CLI non disponible — installe depuis https://cli.github.com'));
            }
          }

          clearCheckpoint();

          // ── Fichier de liaison pour slash commands ──
          const sandykitDir = join(process.cwd(), '.sandykit');
          mkdirSync(sandykitDir, { recursive: true });
          writeFileSync(
            join(sandykitDir, 'last-session.json'),
            JSON.stringify({
              projectName: state.projectName,
              featureDir: state.featureDir?.replace(process.cwd() + '/', '').replace(process.cwd() + '\\', ''),
              completedSteps: ['spec', 'plan', 'tasks', 'implement'],
              updatedAt: new Date().toISOString(),
            }, null, 2),
            'utf-8'
          );

          step++;
        }
        break;
      }
    }
  }

  p.outro(chalk.green(`✓ Projet "${state.projectName}" livre — specs dans ${state.featureDir?.replace(process.cwd(), '.')}`));
  console.log(chalk.dim('\n  Pour continuer dans ton agent IA (Claude Code, Cursor...) :'));
  console.log(chalk.cyan('  /sandykit.continue') + chalk.dim('  →  reprend exactement ou tu en es'));
  console.log(chalk.cyan('  /sandykit.review  ') + chalk.dim('  →  revue du code genere\n'));
}
