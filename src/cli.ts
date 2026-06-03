import { Command } from 'commander';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { showBanner } from './banner.js';
import { saveConfig, loadConfig } from './config.js';
import { install, getIntegrationPaths } from './installer.js';
import { startWatcher, getAllFeatureStatuses } from './watcher.js';
import type { Integration, FeatureStatus } from './types.js';
import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync, copyFileSync, renameSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { runDev } from './dev.js';
import { runDemo } from './demo.js';
import {
  loadTeamConfig, saveTeamConfig, createTeamConfig, addMember, removeMember,
  hasTeamConfig, formatTeamConfig
} from './team.js';
import { keystoreBackend } from './keystore.js';
import { runIncremental } from './incremental.js';
import { getBudgetStatus, loadBudgetConfig, saveBudgetConfig, formatBudgetReport } from './budget.js';
import { parseTasks, exportToJira, exportToLinear } from './exporter.js';
import { getRecentCommits, isGitRepo } from './git-committer.js';
import { shareFeature, findFeatureDir, type ShareArtifact } from './share.js';

const _dirname: string =
  typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath((import.meta as { url?: string }).url ?? ''));

export function buildStatusDisplay(features: FeatureStatus[]): string {
  if (features.length === 0) {
    return chalk.yellow('Aucune feature trouvée dans specs/');
  }

  const lines = features.map(f => {
    const stages = [
      f.hasSpec      ? chalk.green('spec ✓')   : chalk.dim('spec ○'),
      f.hasPlan      ? chalk.green('plan ✓')   : chalk.dim('plan ○'),
      f.hasTasks     ? chalk.green('tasks ✓')  : chalk.dim('tasks ○'),
      f.hasImplement ? chalk.green('impl ✓')   : chalk.dim('impl ○'),
      f.hasReview    ? chalk.green('review ✓') : chalk.dim('review ○'),
    ];
    return `  ${chalk.cyan(f.id.padEnd(25))} ${stages.join('  ')}`;
  });

  return lines.join('\n');
}

async function runInit(projet: string | undefined, opts: { integration: string }): Promise<void> {
  showBanner();
  p.intro(chalk.cyan('Initialisation du projet'));

  const valid: Integration[] = ['claude', 'cursor', 'copilot'];

  const agentOptions = [
    { value: 'claude'  as Integration, label: 'Claude Code',     hint: '.claude/commands/' },
    { value: 'cursor'  as Integration, label: 'Cursor',           hint: '.cursor/rules/' },
    { value: 'copilot' as Integration, label: 'GitHub Copilot',  hint: '.github/instructions/' },
  ];

  let projectName: string;
  let integrations: Integration[];

  // Boucle principale — retour au nom du projet
  outerLoop: while (true) {
    const nameResult = await p.text({
      message: 'Nom du projet :',
      placeholder: projet ?? process.cwd().split(/[/\\]/).pop() ?? 'mon-projet',
      defaultValue: projet ?? process.cwd().split(/[/\\]/).pop() ?? 'mon-projet',
    });
    if (p.isCancel(nameResult)) { p.cancel('Annulé'); process.exit(0); }
    projectName = nameResult as string;

    // Boucle interne — retour au choix des agents uniquement
    while (true) {
      const intResult = await p.multiselect<Integration>({
        message: 'Agents IA à intégrer : (espace = sélectionner, entrée = valider)',
        options: agentOptions,
        initialValues: [],
        required: true,
      });
      if (p.isCancel(intResult)) { p.cancel('Annulé'); process.exit(0); }
      integrations = intResult as Integration[];

      const agentLabels = integrations
        .map(i => agentOptions.find(o => o.value === i)?.label ?? i)
        .join(', ');

      const confirm = await p.select({
        message: `Projet "${projectName}" · Agents : ${agentLabels}`,
        options: [
          { value: 'confirm', label: '✓  Confirmer et installer' },
          { value: 'agents',  label: '↩  Choisir un autre agent' },
          { value: 'restart', label: '⟳  Recommencer depuis le début' },
          { value: 'cancel',  label: '✗  Annuler' },
        ],
      });

      if (p.isCancel(confirm) || confirm === 'cancel') {
        const sure = await p.confirm({
          message: 'Voulez-vous vraiment annuler ?',
          initialValue: false,
        });
        if (p.isCancel(sure) || sure) { p.cancel('Annulé'); process.exit(0); }
        // réponse "non" → on reste dans la boucle, on réaffiche la confirmation
        continue;
      }

      if (confirm === 'restart') {
        console.log(chalk.dim('\nRetour au début...\n'));
        continue outerLoop;
      }

      if (confirm === 'agents') {
        console.log(chalk.dim('\nRetour au choix des agents...\n'));
        continue;
      }

      // confirm === 'confirm'
      break outerLoop;
    }
  }

  const spinner = p.spinner();
  spinner.start('Installation des commandes...');
  await install(integrations);
  saveConfig({ projectName, integrations });
  spinner.stop('Commandes installées');

  const agentPaths: Record<string, string> = {
    claude:  '.claude/commands/',
    cursor:  '.cursor/rules/',
    copilot: '.github/instructions/',
  };

  p.note(
    integrations.map(i => `${chalk.bold(i.padEnd(10))} → ${chalk.dim(agentPaths[i] ?? '')}`).join('\n'),
    'Intégrations installées'
  );

  p.note(
    [
      chalk.bold('— Agent IA —'),
      chalk.cyan('/sandykit.specify')    + '    Décrire une nouvelle feature',
      chalk.cyan('/sandykit.clarify')    + '    Affiner une spec floue',
      chalk.cyan('/sandykit.plan')       + '       Générer le plan technique',
      chalk.cyan('/sandykit.tasks')      + '      Décomposer en tâches',
      chalk.cyan('/sandykit.implement')  + '  Implémenter les tâches',
      chalk.cyan('/sandykit.review')     + '     Réviser le code',
      chalk.cyan('/sandykit.back')       + '       Revenir à l\'étape précédente',
      '',
      chalk.bold('— Terminal —'),
      chalk.yellow('sandykit new')       + '      Créer une feature sans agent',
      chalk.yellow('sandykit reset')     + '    Réinitialiser une feature',
      chalk.yellow('sandykit export')    + '   Exporter une feature',
      chalk.yellow('sandykit update')    + '   Mettre à jour les commandes',
      chalk.yellow('sandykit status')    + '   État des features',
      chalk.yellow('sandykit list')      + '     Lister les features',
    ].join('\n'),
    'Commandes disponibles'
  );

  p.outro(chalk.green(`✓ SANDYKIT prêt dans "${projectName}"`));
}

async function runNew(nom: string | undefined): Promise<void> {
  showBanner();
  p.intro(chalk.cyan('Nouvelle feature'));

  const nameResult = await p.text({
    message: 'Nom de la feature :',
    placeholder: nom ?? 'auth-jwt',
    defaultValue: nom,
    validate: v => (v.trim().length === 0 ? 'Le nom est requis' : undefined),
  });
  if (p.isCancel(nameResult)) { p.cancel('Annulé'); process.exit(0); }
  const featureName = (nameResult as string).trim().toLowerCase().replace(/\s+/g, '-');

  const specsDir = join(process.cwd(), 'specs');
  let nextNum = 1;
  if (existsSync(specsDir)) {
    const existing = readdirSync(specsDir).filter(d => /^\d{3}-/.test(d));
    if (existing.length > 0) {
      nextNum = Math.max(...existing.map(d => parseInt(d.slice(0, 3), 10))) + 1;
    }
  }
  const pad = String(nextNum).padStart(3, '0');
  const featureDir = join(specsDir, `${pad}-${featureName}`);

  if (existsSync(featureDir)) {
    p.cancel(`La feature "${pad}-${featureName}" existe déjà.`);
    process.exit(1);
  }

  const spinner = p.spinner();
  spinner.start('Création de la feature...');
  mkdirSync(featureDir, { recursive: true });
  const today = new Date().toISOString().split('T')[0];
  writeFileSync(join(featureDir, 'spec.md'),
    `# Spécification : ${featureName}\n\n**Créé** : ${today}\n**Statut** : Brouillon\n**Dossier** : \`specs/${pad}-${featureName}/\`\n\n## Scénarios utilisateur\n\n<!-- Décris le parcours utilisateur ici -->\n\n## Exigences fonctionnelles\n\n- [ ] \n\n## Critères de succès\n\n- \n\n## Hors périmètre\n\n- \n`,
    'utf-8'
  );
  spinner.stop('Feature créée');

  p.note(`specs/${pad}-${featureName}/spec.md`, `Feature "${featureName}" initialisée`);
  p.outro(chalk.green(`✓ Lance /sandykit.specify dans ton agent IA pour remplir la spec`));
}

async function runReset(nom: string | undefined): Promise<void> {
  showBanner();
  p.intro(chalk.cyan('Réinitialiser une feature'));

  const specsDir = join(process.cwd(), 'specs');
  if (!existsSync(specsDir)) {
    p.cancel('Aucun dossier specs/ trouvé.');
    process.exit(1);
  }

  const features = readdirSync(specsDir).filter(d => /^\d{3}-/.test(d));
  if (features.length === 0) {
    p.cancel('Aucune feature trouvée dans specs/.');
    process.exit(1);
  }

  let target: string;
  if (nom) {
    const match = features.find(f => f.includes(nom));
    if (!match) { p.cancel(`Feature "${nom}" non trouvée.`); process.exit(1); }
    target = match;
  } else {
    const choice = await p.select({
      message: 'Quelle feature réinitialiser ?',
      options: features.map(f => ({ value: f, label: f })),
    });
    if (p.isCancel(choice)) { p.cancel('Annulé'); process.exit(0); }
    target = choice as string;
  }

  const stepOptions = [
    { value: 'spec',     label: 'spec.md     — Supprimer et recommencer la spec' },
    { value: 'plan',     label: 'plan.md     — Supprimer le plan et les suivants' },
    { value: 'tasks',    label: 'tasks.md    — Supprimer les tâches et les suivants' },
    { value: 'implement',label: 'implement.md — Supprimer l\'implémentation et review' },
    { value: 'review',   label: 'review.md   — Supprimer uniquement la review' },
    { value: 'all',      label: 'TOUT        — Supprimer toute la feature' },
  ];

  const step = await p.select({ message: `Que supprimer dans "${target}" ?`, options: stepOptions });
  if (p.isCancel(step)) { p.cancel('Annulé'); process.exit(0); }

  const confirm = await p.confirm({
    message: chalk.red(`Confirmer la suppression de "${step}" dans "${target}" ?`),
    initialValue: false,
  });
  if (p.isCancel(confirm) || !confirm) { p.cancel('Annulé'); process.exit(0); }

  const featureDir = join(specsDir, target);
  const order = ['spec', 'plan', 'tasks', 'implement', 'review'];
  const toDelete = step === 'all' ? null : order.slice(order.indexOf(step as string));

  if (toDelete === null) {
    rmSync(featureDir, { recursive: true, force: true });
    p.outro(chalk.yellow(`✓ Feature "${target}" entièrement supprimée`));
  } else {
    for (const s of toDelete) {
      const f = join(featureDir, `${s}.md`);
      if (existsSync(f)) rmSync(f);
    }
    p.outro(chalk.yellow(`✓ Étapes supprimées dans "${target}"`));
  }
}

async function runUpdate(): Promise<void> {
  showBanner();
  p.intro(chalk.cyan('Mise à jour des commandes'));

  const cfg = loadConfig();
  if (!cfg) {
    p.cancel('Projet non initialisé. Lance sandykit init d\'abord.');
    process.exit(1);
  }

  const spinner = p.spinner();
  spinner.start(`Mise à jour pour ${cfg.integrations.join(', ')}...`);
  await install(cfg.integrations);
  spinner.stop('Commandes mises à jour');

  p.outro(chalk.green(`✓ Commandes mises à jour dans ${cfg.integrations.length} intégration(s)`));
}

async function runExport(nom: string | undefined): Promise<void> {
  showBanner();
  p.intro(chalk.cyan('Exporter une feature'));

  const specsDir = join(process.cwd(), 'specs');
  if (!existsSync(specsDir)) { p.cancel('Aucun dossier specs/ trouvé.'); process.exit(1); }

  const features = readdirSync(specsDir).filter(d => /^\d{3}-/.test(d));
  if (features.length === 0) { p.cancel('Aucune feature trouvée.'); process.exit(1); }

  let target: string;
  if (nom) {
    const match = features.find(f => f.includes(nom));
    if (!match) { p.cancel(`Feature "${nom}" non trouvée.`); process.exit(1); }
    target = match;
  } else {
    const choice = await p.select({
      message: 'Quelle feature exporter ?',
      options: features.map(f => ({ value: f, label: f })),
    });
    if (p.isCancel(choice)) { p.cancel('Annulé'); process.exit(0); }
    target = choice as string;
  }

  const exportDir = join(process.cwd(), 'exports');
  if (!existsSync(exportDir)) mkdirSync(exportDir, { recursive: true });
  const destDir = join(exportDir, target);
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  const spinner = p.spinner();
  spinner.start('Export en cours...');

  const files = ['spec.md', 'plan.md', 'tasks.md', 'implement.md', 'review.md'];
  let count = 0;
  for (const file of files) {
    const src = join(specsDir, target, file);
    if (existsSync(src)) {
      copyFileSync(src, join(destDir, file));
      count++;
    }
  }
  spinner.stop(`${count} fichier(s) exporté(s)`);

  p.note(`exports/${target}/`, 'Dossier d\'export');
  p.outro(chalk.green(`✓ Feature "${target}" exportée`));
}

async function runOpen(nom: string | undefined): Promise<void> {
  showBanner();

  const specsDir = join(process.cwd(), 'specs');
  if (!existsSync(specsDir)) { p.cancel('Aucun dossier specs/ trouvé.'); process.exit(1); }

  const features = readdirSync(specsDir).filter(d => /^\d{3}-/.test(d));
  if (features.length === 0) { p.cancel('Aucune feature trouvée.'); process.exit(1); }

  let target: string;
  if (nom) {
    const match = features.find(f => f.includes(nom));
    if (!match) { p.cancel(`Feature "${nom}" non trouvée.`); process.exit(1); }
    target = match;
  } else {
    const choice = await p.select({
      message: 'Quelle feature ouvrir ?',
      options: features.map(f => ({ value: f, label: f })),
    });
    if (p.isCancel(choice)) { p.cancel('Annulé'); process.exit(0); }
    target = choice as string;
  }

  const featureDir = join(specsDir, target);
  const platform = process.platform;
  try {
    if (platform === 'win32') execSync(`explorer "${featureDir}"`);
    else if (platform === 'darwin') execSync(`open "${featureDir}"`);
    else execSync(`xdg-open "${featureDir}"`);
    console.log(chalk.green(`✓ Ouvert : specs/${target}/`));
  } catch {
    console.log(chalk.yellow(`Chemin : ${featureDir}`));
  }
}

async function runRename(nom: string | undefined): Promise<void> {
  showBanner();
  p.intro(chalk.cyan('Renommer une feature'));

  const specsDir = join(process.cwd(), 'specs');
  if (!existsSync(specsDir)) { p.cancel('Aucun dossier specs/ trouvé.'); process.exit(1); }

  const features = readdirSync(specsDir).filter(d => /^\d{3}-/.test(d));
  if (features.length === 0) { p.cancel('Aucune feature trouvée.'); process.exit(1); }

  let target: string;
  if (nom) {
    const match = features.find(f => f.includes(nom));
    if (!match) { p.cancel(`Feature "${nom}" non trouvée.`); process.exit(1); }
    target = match;
  } else {
    const choice = await p.select({
      message: 'Quelle feature renommer ?',
      options: features.map(f => ({ value: f, label: f })),
    });
    if (p.isCancel(choice)) { p.cancel('Annulé'); process.exit(0); }
    target = choice as string;
  }

  const currentNum = target.slice(0, 3);
  const currentName = target.slice(4);

  const newNameResult = await p.text({
    message: 'Nouveau nom (sans numéro) :',
    placeholder: currentName,
    validate: v => (v.trim().length === 0 ? 'Le nom est requis' : undefined),
  });
  if (p.isCancel(newNameResult)) { p.cancel('Annulé'); process.exit(0); }
  const newName = (newNameResult as string).trim().toLowerCase().replace(/\s+/g, '-');

  const newDirName = `${currentNum}-${newName}`;
  if (newDirName === target) { p.cancel('Nom identique, rien à faire.'); process.exit(0); }

  const oldPath = join(specsDir, target);
  const newPath = join(specsDir, newDirName);

  if (existsSync(newPath)) { p.cancel(`"${newDirName}" existe déjà.`); process.exit(1); }

  const spinner = p.spinner();
  spinner.start('Renommage...');
  renameSync(oldPath, newPath);

  // Update spec.md header if it exists
  const specFile = join(newPath, 'spec.md');
  if (existsSync(specFile)) {
    const content = readFileSync(specFile, 'utf-8');
    writeFileSync(specFile, content.replace(
      /\*\*Dossier\*\* : `specs\/[^`]+`/,
      `**Dossier** : \`specs/${newDirName}/\``
    ), 'utf-8');
  }
  spinner.stop('Renommée');

  p.outro(chalk.green(`✓ "${target}" → "${newDirName}"`));
}

async function runArchive(nom: string | undefined): Promise<void> {
  showBanner();
  p.intro(chalk.cyan('Archiver une feature'));

  const specsDir = join(process.cwd(), 'specs');
  if (!existsSync(specsDir)) { p.cancel('Aucun dossier specs/ trouvé.'); process.exit(1); }

  const features = readdirSync(specsDir).filter(d => /^\d{3}-/.test(d));
  if (features.length === 0) { p.cancel('Aucune feature trouvée.'); process.exit(1); }

  let target: string;
  if (nom) {
    const match = features.find(f => f.includes(nom));
    if (!match) { p.cancel(`Feature "${nom}" non trouvée.`); process.exit(1); }
    target = match;
  } else {
    const choice = await p.select({
      message: 'Quelle feature archiver ?',
      options: features.map(f => ({ value: f, label: f })),
    });
    if (p.isCancel(choice)) { p.cancel('Annulé'); process.exit(0); }
    target = choice as string;
  }

  const confirm = await p.confirm({
    message: `Archiver "${target}" ? (déplacé hors de specs/)`,
    initialValue: true,
  });
  if (p.isCancel(confirm) || !confirm) { p.cancel('Annulé'); process.exit(0); }

  const archivesDir = join(process.cwd(), 'archives');
  if (!existsSync(archivesDir)) mkdirSync(archivesDir, { recursive: true });

  const src = join(specsDir, target);
  const dest = join(archivesDir, target);

  if (existsSync(dest)) { p.cancel(`"${target}" existe déjà dans archives/.`); process.exit(1); }

  const spinner = p.spinner();
  spinner.start('Archivage...');
  renameSync(src, dest);
  spinner.stop('Archivée');

  p.outro(chalk.green(`✓ "${target}" déplacé dans archives/`));
}

async function runDoctor(): Promise<void> {
  showBanner();
  console.log(chalk.bold('Diagnostic SANDYKIT\n'));

  const cwd = process.cwd();
  const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];

  // Config
  const cfg = loadConfig();
  checks.push({ label: 'Configuration .sandykit/config.json', ok: cfg !== null, detail: cfg ? `projet: ${cfg.projectName}` : 'non trouvée — lance sandykit init' });

  // specs/
  const specsDir = join(cwd, 'specs');
  checks.push({ label: 'Dossier specs/', ok: existsSync(specsDir) });

  // Agent integrations
  const agentPaths: Record<string, string> = {
    claude:  join(cwd, '.claude', 'commands'),
    cursor:  join(cwd, '.cursor', 'rules'),
    copilot: join(cwd, '.github', 'instructions'),
  };
  const commands = ['specify', 'clarify', 'plan', 'tasks', 'implement', 'review', 'back'];
  const extensions: Record<string, string> = { claude: '.md', cursor: '.mdc', copilot: '.instructions.md' };

  if (cfg) {
    for (const integration of cfg.integrations) {
      const dir = agentPaths[integration];
      checks.push({ label: `Dossier ${integration}`, ok: existsSync(dir), detail: dir.replace(cwd, '.') });

      let missing = 0;
      for (const cmd of commands) {
        const file = join(dir, `sandykit.${cmd}${extensions[integration]}`);
        if (!existsSync(file)) missing++;
      }
      checks.push({
        label: `Commandes ${integration} (${commands.length - missing}/${commands.length})`,
        ok: missing === 0,
        detail: missing > 0 ? `${missing} manquante(s) — lance sandykit update` : undefined,
      });
    }
  } else {
    checks.push({ label: 'Intégrations agents', ok: false, detail: 'config manquante' });
  }

  // Print results
  for (const { label, ok, detail } of checks) {
    const icon = ok ? chalk.green('✓') : chalk.red('✗');
    const text = ok ? chalk.white(label) : chalk.red(label);
    const hint = detail ? chalk.dim(`  ${detail}`) : '';
    console.log(`  ${icon}  ${text}${hint}`);
  }

  // Vérifier le backend de stockage des clés API
  const backend = await keystoreBackend();
  const backendLabels: Record<string, string> = {
    keychain: 'OS Keychain (sécurisé)',
    file:     'Fichier local .sandykit/keys (keytar indisponible sur Node ' + process.versions.node + ')',
    env:      'Variable d\'environnement',
  };
  checks.push({
    label: `Stockage clés API : ${backendLabels[backend]}`,
    ok: backend !== 'file',
    detail: backend === 'file'
      ? 'Installe keytar@7 avec Node 18/20 pour le keychain OS, ou utilise une variable d\'environnement'
      : undefined,
  });

  const allOk = checks.every(c => c.ok);
  console.log();
  if (allOk) {
    console.log(chalk.green('✓ SANDYKIT est correctement configuré'));
  } else {
    console.log(chalk.yellow('⚠ Des éléments nécessitent attention (voir ci-dessus)'));
  }
  console.log();
}

const program = new Command();

program
  .name('sandykit')
  .description('Spec-Driven Development pour agents IA')
  .version('2.0.0');

program
  .command('init [projet]')
  .description('Initialiser SANDYKIT dans le projet courant')
  .option('--integration <liste>', 'Intégrations : claude,cursor,copilot', 'claude')
  .action(runInit);

program
  .command('watch')
  .description('Surveiller les specs et valider le pipeline')
  .action(() => {
    showBanner();
    startWatcher();
  });

program
  .command('status')
  .description("Afficher l'état des features en cours")
  .action(() => {
    showBanner();
    const features = getAllFeatureStatuses('specs');
    const cfg = loadConfig();
    if (cfg) console.log(chalk.bold(`Projet : ${cfg.projectName}\n`));
    console.log('─'.repeat(70));
    console.log(buildStatusDisplay(features));
    console.log('─'.repeat(70) + '\n');
  });

program
  .command('list')
  .description('Lister toutes les features')
  .action(() => {
    showBanner();
    const features = getAllFeatureStatuses('specs');
    if (features.length === 0) {
      console.log(chalk.yellow('Aucune feature trouvée.'));
      return;
    }
    console.log(chalk.bold('Features :\n'));
    for (const f of features) {
      const done = [f.hasSpec, f.hasPlan, f.hasTasks, f.hasImplement, f.hasReview]
        .filter(Boolean).length;
      const bar = '█'.repeat(done) + '░'.repeat(5 - done);
      console.log(`  ${chalk.cyan(f.id.padEnd(25))} ${chalk.green(bar)}  ${done}/5 étapes`);
    }
    console.log();
  });

program
  .command('new [nom]')
  .description('Créer une nouvelle feature dans specs/')
  .action(runNew);

program
  .command('reset [nom]')
  .description('Réinitialiser ou supprimer une feature')
  .action(runReset);

program
  .command('update')
  .description('Mettre à jour les commandes installées dans les agents IA')
  .action(runUpdate);

program
  .command('export [nom]')
  .description('Exporter les fichiers d\'une feature dans exports/')
  .action(runExport);

// ─── sandykit team ─────────────────────────────────────────────────────────────
const teamCmd = program.command('team').description('Gérer la configuration équipe du projet');

teamCmd
  .command('init')
  .description('Initialiser la config équipe (sandykit.team.json)')
  .action(async () => {
    showBanner();
    p.intro(chalk.bold('Configuration équipe'));

    if (hasTeamConfig(process.cwd())) {
      const overwrite = await p.confirm({
        message: 'sandykit.team.json existe déjà. Écraser ?',
        initialValue: false,
      });
      if (p.isCancel(overwrite) || !overwrite) { p.cancel('Annulé'); return; }
    }

    const projectName = await p.text({ message: 'Nom du projet :', validate: v => (!v ? 'Requis' : undefined) });
    if (p.isCancel(projectName)) { p.cancel('Annulé'); return; }

    const ownerName = await p.text({ message: 'Votre nom (owner) :', placeholder: 'John Doe' });
    if (p.isCancel(ownerName)) { p.cancel('Annulé'); return; }

    const ownerEmail = await p.text({ message: 'Votre email :', placeholder: 'john@example.com' });
    if (p.isCancel(ownerEmail)) { p.cancel('Annulé'); return; }

    const autoCommitChoice = await p.confirm({ message: 'Activer les git auto-commits ?', initialValue: true });

    const webhook = await p.text({ message: 'Webhook URL (optionnel — laisser vide pour ignorer) :', placeholder: 'https://hooks.slack.com/...' });

    const cfg = loadConfig();
    const teamConfig = createTeamConfig(process.cwd(), {
      projectName: projectName as string,
      provider: (cfg?.provider?.type as any) ?? 'claude',
      model: cfg?.provider?.model ?? 'claude-sonnet-4-6',
      ownerName: ownerName as string,
      ownerEmail: ownerEmail as string,
      autoCommit: !p.isCancel(autoCommitChoice) ? autoCommitChoice as boolean : true,
    });

    if (!p.isCancel(webhook) && (webhook as string).startsWith('http')) {
      teamConfig.hooks.webhook = webhook as string;
      saveTeamConfig(process.cwd(), teamConfig);
    }

    p.outro(chalk.green(`✓ sandykit.team.json créé pour "${projectName}"`));
    console.log(chalk.dim('\n  Partage ce fichier dans ton repo (sans les clés API !) :\n'));
    console.log(chalk.cyan('  git add sandykit.team.json && git commit -m "chore: add sandykit team config"'));
  });

teamCmd
  .command('show')
  .description('Afficher la config équipe actuelle')
  .action(() => {
    const teamCfg = loadTeamConfig(process.cwd());
    if (!teamCfg) {
      console.log(chalk.yellow('Aucune config équipe. Lance : sandykit team init'));
      return;
    }
    console.log(chalk.bold('\n  Config équipe :\n'));
    console.log(formatTeamConfig(teamCfg));
    console.log();

    if (isGitRepo(process.cwd())) {
      const commits = getRecentCommits(process.cwd(), 5);
      if (commits.length > 0) {
        console.log(chalk.bold('  Derniers commits :'));
        commits.forEach(c => console.log(chalk.dim(`    ${c}`)));
        console.log();
      }
    }
  });

teamCmd
  .command('add <email> [nom] [role]')
  .description('Ajouter un membre à l\'équipe')
  .action((email: string, nom: string, role: string) => {
    const updated = addMember(process.cwd(), {
      email,
      name: nom ?? email.split('@')[0],
      role: (['owner', 'contributor', 'reviewer'].includes(role) ? role : 'contributor') as any,
    });
    if (!updated) { console.log(chalk.yellow('Aucune config équipe. Lance : sandykit team init')); return; }
    console.log(chalk.green(`✓ ${email} ajouté comme ${role ?? 'contributor'}`));
  });

teamCmd
  .command('remove <email>')
  .description('Retirer un membre de l\'équipe')
  .action((email: string) => {
    const updated = removeMember(process.cwd(), email);
    if (!updated) { console.log(chalk.yellow('Aucune config équipe.')); return; }
    console.log(chalk.green(`✓ ${email} retiré`));
  });

// ─── sandykit tickets ──────────────────────────────────────────────────────────
program
  .command('tickets [feature]')
  .description('Exporter les tâches vers Jira ou Linear')
  .option('--jira', 'Exporter vers Jira (nécessite JIRA_API_TOKEN)')
  .option('--linear', 'Exporter vers Linear (nécessite LINEAR_API_TOKEN)')
  .action(async (feature: string | undefined, opts: { jira?: boolean; linear?: boolean }) => {
    showBanner();
    p.intro(chalk.bold('Export vers ticketing'));

    const teamCfg = loadTeamConfig(process.cwd());

    // Trouver le fichier tasks.md
    const specsDir = join(process.cwd(), 'specs');
    if (!existsSync(specsDir)) {
      p.cancel('Aucun dossier specs/ trouvé. Lance sandykit dev d\'abord.');
      return;
    }

    const features = readdirSync(specsDir).filter(d => existsSync(join(specsDir, d, 'tasks.md')));
    if (features.length === 0) {
      p.cancel('Aucune feature avec tasks.md trouvée.');
      return;
    }

    let targetFeature = feature;
    if (!targetFeature) {
      const choice = await p.select({
        message: 'Quelle feature exporter ?',
        options: features.map(f => ({ value: f, label: f })),
      });
      if (p.isCancel(choice)) { p.cancel('Annulé'); return; }
      targetFeature = choice as string;
    }

    const tasksPath = join(specsDir, targetFeature, 'tasks.md');
    if (!existsSync(tasksPath)) {
      p.cancel(`tasks.md introuvable dans specs/${targetFeature}/`);
      return;
    }

    const tasksContent = readFileSync(tasksPath, 'utf-8');
    const tasks = parseTasks(tasksContent);

    if (tasks.length === 0) {
      p.cancel('Aucune tâche parsée depuis tasks.md');
      return;
    }

    console.log(chalk.bold(`\n  ${tasks.length} tâche(s) trouvée(s)\n`));
    tasks.forEach((t, i) => console.log(chalk.dim(`  ${i + 1}. ${t.title} [${t.priority}]`)));
    console.log();

    const platform = opts.jira ? 'jira' : opts.linear ? 'linear' : null;
    if (!platform) {
      const choice = await p.select({
        message: 'Vers quelle plateforme ?',
        options: [
          { value: 'jira',   label: 'Jira (JIRA_API_TOKEN)' },
          { value: 'linear', label: 'Linear (LINEAR_API_TOKEN)' },
        ],
      });
      if (p.isCancel(choice)) { p.cancel('Annulé'); return; }
    }

    const finalPlatform = platform ?? 'linear';
    const spinner = p.spinner();

    try {
      if (finalPlatform === 'jira') {
        if (!teamCfg?.export?.jira) {
          p.cancel('Configure export.jira dans sandykit.team.json (baseUrl + project)');
          return;
        }
        spinner.start('Export vers Jira...');
        const result = await exportToJira(tasks, teamCfg.export.jira);
        spinner.stop(`${result.created} ticket(s) créés, ${result.failed} échec(s)`);
        result.links.forEach(l => console.log(chalk.cyan(`  → ${l}`)));
      } else {
        if (!teamCfg?.export?.linear) {
          p.cancel('Configure export.linear dans sandykit.team.json (teamId)');
          return;
        }
        spinner.start('Export vers Linear...');
        const result = await exportToLinear(tasks, teamCfg.export.linear);
        spinner.stop(`${result.created} issue(s) créées, ${result.failed} échec(s)`);
        result.links.forEach(l => console.log(chalk.cyan(`  → ${l}`)));
      }
    } catch (err: any) {
      spinner.stop('Erreur');
      console.log(chalk.red(`  ✗ ${err.message}`));
    }

    p.outro(chalk.green('✓ Export terminé'));
  });

program
  .command('dev')
  .description('Agent autonome : spec → plan → tâches → code (v3)')
  .option('--file <chemin>', 'Chemin vers un cahier des charges (.txt, .md, .pdf, .docx)')
  .option('--resume', 'Reprendre depuis le dernier checkpoint sauvegardé')
  .option('--dry-run', 'Générer spec + plan uniquement, sans écrire de code')
  .option('--pr', 'Créer une Pull Request automatiquement après génération')
  .option('--demo', 'Mode demo : pipeline complet sans clé API (contenu simulé)')
  .action((opts) => opts.demo ? runDemo() : runDev({ ...opts, dryRun: opts.dryRun, pr: opts.pr }));

program
  .command('add [description]')
  .description('Ajouter une feature à un projet existant (génération incrémentale + RAG)')
  .option('--file <chemin>', 'Cahier des charges pour la feature')
  .option('--dry-run', 'Générer spec + plan uniquement')
  .option('--pr', 'Créer une Pull Request après génération')
  .option('--no-git', 'Désactiver les auto-commits')
  .action((description: string | undefined, opts) =>
    runIncremental({ description, file: opts.file, dryRun: opts.dryRun, pr: opts.pr, autoGit: opts.git !== false })
  );

// ─── sandykit budget ────────────────────────────────────────────────────────────
const budgetCmd = program.command('budget').description('Gérer le budget mensuel de dépenses IA');

budgetCmd
  .command('show')
  .description('Afficher les dépenses IA du mois courant')
  .action(() => {
    showBanner();
    console.log(chalk.bold('\n  Budget IA — Dépenses du mois\n'));
    console.log(formatBudgetReport(process.cwd()));
    console.log();
  });

budgetCmd
  .command('set <montant>')
  .description('Définir un budget mensuel maximum en USD')
  .option('--alert <pourcent>', 'Alerte à X% du budget (défaut: 80)', '80')
  .option('--webhook <url>', 'URL webhook pour alertes')
  .action((montant: string, opts) => {
    const limit = parseFloat(montant);
    if (isNaN(limit) || limit <= 0) {
      console.log(chalk.red('  ✗ Montant invalide. Exemple : sandykit budget set 20'));
      return;
    }
    const existing = loadBudgetConfig(process.cwd()) ?? {} as any;
    saveBudgetConfig(process.cwd(), {
      ...existing,
      monthlyLimitUSD: limit,
      alertAtPercent: parseInt(opts.alert, 10) || 80,
      webhookUrl: opts.webhook ?? existing.webhookUrl,
    });
    console.log(chalk.green(`  ✓ Budget mensuel fixé à $${limit.toFixed(2)}`));
    console.log(chalk.dim(`  Alerte à ${opts.alert}% du budget`));
    if (opts.webhook) console.log(chalk.dim(`  Webhook : ${opts.webhook}`));
  });

budgetCmd
  .command('reset')
  .description('Supprimer le budget mensuel configuré')
  .action(() => {
    const existing = loadBudgetConfig(process.cwd());
    if (!existing) { console.log(chalk.yellow('  Aucun budget configuré.')); return; }
    saveBudgetConfig(process.cwd(), { ...existing, monthlyLimitUSD: Infinity });
    console.log(chalk.green('  ✓ Limite de budget supprimée'));
  });

program
  .command('open [nom]')
  .description("Ouvrir le dossier d'une feature dans l'explorateur")
  .action(runOpen);

program
  .command('rename [nom]')
  .description('Renommer une feature')
  .action(runRename);

program
  .command('archive [nom]')
  .description("Archiver une feature terminée dans archives/")
  .action(runArchive);

program
  .command('doctor')
  .description('Vérifier la configuration et les fichiers installés')
  .action(() => runDoctor());

// ─── sandykit share ────────────────────────────────────────────────────────────
program
  .command('share [feature]')
  .description('Partager spec/plan/tâches via un GitHub Gist secret')
  .option('--spec',  'Partager uniquement la spec')
  .option('--plan',  'Partager uniquement le plan')
  .option('--tasks', 'Partager uniquement les tâches')
  .option('--all',   'Partager spec + plan + tâches (défaut)')
  .option('--token <token>', 'GitHub token (ou env GITHUB_TOKEN)')
  .action(async (feature: string | undefined, opts: { spec?: boolean; plan?: boolean; tasks?: boolean; all?: boolean; token?: string }) => {
    showBanner();
    p.intro(chalk.bold('Partager une feature'));

    // Résoudre l'artifact à partager
    const artifact: ShareArtifact =
      opts.spec  ? 'spec'  :
      opts.plan  ? 'plan'  :
      opts.tasks ? 'tasks' : 'all';

    // Résoudre le token GitHub
    const token = opts.token ?? process.env.GITHUB_TOKEN;
    if (!token) {
      console.log(chalk.yellow('  💡 Sans GITHUB_TOKEN le gist sera créé anonymement (rate limit: 60 req/h)\n'));
      console.log(chalk.dim('  Crée un token sur https://github.com/settings/tokens (scope: gist)\n'));
    }

    // Sélectionner la feature
    const specsDir = join(process.cwd(), 'specs');
    if (!existsSync(specsDir)) {
      p.cancel('Aucun dossier specs/ trouvé. Lance sandykit dev d\'abord.');
      return;
    }

    const features = readdirSync(specsDir).filter(d => {
      return existsSync(join(specsDir, d, 'spec.md')) ||
             existsSync(join(specsDir, d, 'plan.md')) ||
             existsSync(join(specsDir, d, 'tasks.md'));
    });

    if (features.length === 0) {
      p.cancel('Aucune feature avec des fichiers à partager.');
      return;
    }

    let targetFeature = feature;
    let featureDir: string | null = null;

    if (targetFeature) {
      featureDir = findFeatureDir(process.cwd(), targetFeature);
      if (!featureDir) {
        p.cancel(`Feature "${targetFeature}" introuvable dans specs/`);
        return;
      }
    } else {
      const choice = await p.select({
        message: 'Quelle feature partager ?',
        options: features.map(f => ({ value: f, label: f })),
      });
      if (p.isCancel(choice)) { p.cancel('Annulé'); return; }
      targetFeature = choice as string;
      featureDir = join(specsDir, targetFeature);
    }

    // Confirmer ce qu'on partage
    const artifactLabel = artifact === 'all' ? 'spec + plan + tâches' : artifact;
    const confirm = await p.confirm({
      message: `Partager ${chalk.cyan(artifactLabel)} de "${targetFeature}" via GitHub Gist ?`,
      initialValue: true,
    });
    if (p.isCancel(confirm) || !confirm) { p.cancel('Annulé'); return; }

    const spinner = p.spinner();
    spinner.start(`Création du gist GitHub (${artifact})...`);

    try {
      const result = await shareFeature({
        artifact,
        featureDir,
        featureName: targetFeature,
        token,
      });

      spinner.stop('Gist créé avec succès !');

      console.log('');
      console.log(chalk.bold('  🔗 Lien de partage :'));
      console.log(chalk.cyan(`     ${result.url}`));
      console.log('');

      if (result.files.length > 1) {
        console.log(chalk.dim('  Fichiers partagés :'));
        result.files.forEach(f => console.log(chalk.dim(`    • ${f}`)));
        console.log('');
      }

      console.log(chalk.dim('  Le gist est secret (seules les personnes avec le lien y ont accès)'));
      if (!token) {
        console.log(chalk.dim('  Tip: ajoute GITHUB_TOKEN pour créer des gists authentifiés et les modifier plus tard'));
      }

      p.outro(chalk.green('✓ Feature partagée'));
    } catch (err: any) {
      spinner.stop('Erreur');
      console.log(chalk.red(`  ✗ ${err.message}`));
      process.exit(1);
    }
  });

// Only parse CLI args when run directly (not when imported by tests)
if (process.argv[1] && (process.argv[1].endsWith('cli.ts') || process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.cjs'))) {
  program.parse();
}
