import * as p from '@clack/prompts';
import chalk from 'chalk';
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createProvider, type ProviderConfig } from './providers.js';
import { loadConfig } from './config.js';
import { getApiKey } from './keystore.js';
import { buildRAGContext, formatRAGContextForPrompt } from './rag.js';
import { parseGeneratedFiles, interactiveDiffWrite } from './diff-writer.js';
import { autoCommit } from './git-committer.js';
import { recordUsage } from './budget.js';
import { saveVersioned } from './versioning.js';
import { detectStack, stackToPromptContext } from './stack-detector.js';

// ─── Prompts système ──────────────────────────────────────────────────────────

const SYSTEM_INCREMENT_SPEC = `Tu es un expert en spécification fonctionnelle. Tu analyses une feature à ajouter à un projet EXISTANT.
- Décris uniquement ce qui change ou s'ajoute par rapport à l'existant
- Identifie les fichiers existants qui seront impactés
- Sois précis sur les interfaces/contrats qui changent
- Réponds en markdown`;

const SYSTEM_INCREMENT_PLAN = `Tu es un architecte logiciel. Tu planifies l'ajout d'une feature à un projet EXISTANT.
- Identifie exactement les fichiers à CRÉER et les fichiers à MODIFIER
- Pour les modifications : décris le changement minimal nécessaire
- Respecte l'architecture et les patterns existants
- Réponds en markdown`;

const SYSTEM_INCREMENT_CODE = `Tu es un développeur senior. Tu ajoutes une feature à un projet EXISTANT en générant uniquement les changements nécessaires.

RÈGLES ABSOLUES :
- Pour les NOUVEAUX fichiers : génère le fichier complet
- Pour les fichiers MODIFIÉS : génère le fichier COMPLET avec les modifications intégrées (pas de patch partiel)
- Respecte EXACTEMENT les conventions du projet (nommage, imports, style)
- Réutilise les utilities existantes — ne recrée pas ce qui existe
- Importe depuis les bons chemins relatifs
- Pas de TODO, pas de placeholder

FORMAT pour chaque fichier :
## Fichier: chemin/relatif/depuis/racine.ext
\`\`\`
[contenu complet]
\`\`\``;

// ─── Options ─────────────────────────────────────────────────────────────────

export interface IncrementalOpts {
  description?: string;
  file?: string;
  dryRun?: boolean;
  pr?: boolean;
  autoGit?: boolean;
}

// ─── Entrée principale ───────────────────────────────────────────────────────

export async function runIncremental(opts: IncrementalOpts): Promise<void> {
  p.intro(chalk.bold('➕ SANDYKIT — Ajout incrémental de feature'));

  // ── Provider ──
  const cfg = loadConfig();
  let providerCfg: ProviderConfig;

  if (cfg?.provider) {
    const reuse = await p.select({
      message: `Provider : ${chalk.cyan(cfg.provider.type)} — ${cfg.provider.model}`,
      options: [
        { value: 'reuse',  label: '✓  Utiliser ce provider' },
        { value: 'change', label: '↺  Changer' },
      ],
    });
    if (p.isCancel(reuse)) { p.cancel('Annulé'); return; }

    if (reuse === 'reuse') {
      const key = await getApiKey(cfg.provider.type);
      providerCfg = { ...cfg.provider, apiKey: key ?? undefined };
    } else {
      p.cancel('Lance sandykit dev pour reconfigurer le provider');
      return;
    }
  } else {
    p.cancel('Aucun provider configuré. Lance sandykit dev d\'abord pour configurer.');
    return;
  }

  // ── Description de la feature à ajouter ──
  let description = opts.description;
  if (!description) {
    const input = await p.text({
      message: 'Décris la feature à ajouter :',
      placeholder: 'ex: ajouter un système de notifications push en temps réel',
      validate: v => (!v?.trim() ? 'La description est requise' : undefined),
    });
    if (p.isCancel(input)) { p.cancel('Annulé'); return; }
    description = input as string;
  }

  // ── Analyse du codebase existant ──
  const ragSpinner = p.spinner();
  ragSpinner.start('Analyse du codebase existant...');
  const stack = detectStack(process.cwd());
  const ragContext = buildRAGContext(process.cwd(), description, 6_000);
  ragSpinner.stop(`${ragContext.summary}`);

  if (ragContext.chunks.length > 0) {
    console.log(chalk.dim(`  Fichiers pertinents trouvés :`));
    ragContext.chunks.slice(0, 8).forEach(c =>
      console.log(chalk.dim(`    • ${c.path}`))
    );
    console.log('');
  }

  const provider = createProvider(providerCfg);
  const ragSection = formatRAGContextForPrompt(ragContext);
  const stackContext = stackToPromptContext(stack);

  // ── Numéro de la feature ──
  const specsDir = join(process.cwd(), 'specs');
  const existing = existsSync(specsDir) ? readdirSync(specsDir).filter(d => /^\d{3}-/.test(d)) : [];
  const nextNum = existing.length > 0 ? Math.max(...existing.map(d => parseInt(d.slice(0, 3), 10))) + 1 : 1;
  const pad = String(nextNum).padStart(3, '0');
  const slug = description.toLowerCase().slice(0, 30).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const featureDir = join(specsDir, `${pad}-${slug}`);
  mkdirSync(featureDir, { recursive: true });

  // ── Spec incrémentale ──
  p.intro(chalk.bold('① Spec de la feature'));

  const specPrompt = [
    '## Description de la feature à ajouter',
    description,
    '',
    stackContext ? `## Stack du projet\n${stackContext}` : '',
    '',
    ragSection,
  ].filter(Boolean).join('\n');

  let spec = '';
  process.stdout.write(chalk.dim('\n'));
  await provider.stream(specPrompt, SYSTEM_INCREMENT_SPEC, chunk => {
    process.stdout.write(chunk);
    spec += chunk;
  });
  process.stdout.write('\n\n');

  saveVersioned(featureDir, 'spec', spec, 'Généré par sandykit add');
  console.log(chalk.green('  ✓ spec.md sauvegardé'));

  const specAction = await p.select({
    message: 'Spec — que faire ?',
    options: [
      { value: 'ok',     label: '✓  Valider et générer le plan' },
      { value: 'refine', label: '↺  Régénérer avec précisions' },
      { value: 'cancel', label: '✗  Annuler' },
    ],
  });

  if (p.isCancel(specAction) || specAction === 'cancel') { p.cancel('Annulé'); return; }

  if (specAction === 'refine') {
    const precisions = await p.text({ message: 'Précisions à ajouter :' });
    if (!p.isCancel(precisions) && precisions) {
      spec = '';
      process.stdout.write(chalk.dim('\n'));
      await provider.stream(specPrompt + '\n\nPrécisions : ' + precisions, SYSTEM_INCREMENT_SPEC, chunk => {
        process.stdout.write(chunk);
        spec += chunk;
      });
      process.stdout.write('\n\n');
      saveVersioned(featureDir, 'spec', spec);
    }
  }

  recordUsage(process.cwd(), {
    projectName: slug, step: 'spec', model: providerCfg.model ?? '', provider: providerCfg.type,
    inputTokens: Math.ceil(specPrompt.length / 4), outputTokens: Math.ceil(spec.length / 4),
  });

  if (opts.dryRun) {
    console.log(chalk.yellow('\n  Mode --dry-run : arrêt après la spec'));
    p.outro(chalk.green(`✓ Spec sauvegardée dans ${featureDir.replace(process.cwd(), '.')}`));
    return;
  }

  // ── Plan incrémental ──
  p.intro(chalk.bold('② Plan d\'implémentation'));

  const planPrompt = [
    '## Spec de la feature',
    spec,
    '',
    ragSection,
    '',
    '## Instruction',
    'Génère un plan détaillé des fichiers à créer et modifier. Pour chaque fichier, explique précisément ce qui change.',
  ].join('\n');

  let plan = '';
  process.stdout.write(chalk.dim('\n'));
  await provider.stream(planPrompt, SYSTEM_INCREMENT_PLAN, chunk => {
    process.stdout.write(chunk);
    plan += chunk;
  });
  process.stdout.write('\n\n');

  saveVersioned(featureDir, 'plan', plan, 'Généré par sandykit add');
  console.log(chalk.green('  ✓ plan.md sauvegardé'));

  recordUsage(process.cwd(), {
    projectName: slug, step: 'plan', model: providerCfg.model ?? '', provider: providerCfg.type,
    inputTokens: Math.ceil(planPrompt.length / 4), outputTokens: Math.ceil(plan.length / 4),
  });

  const planAction = await p.select({
    message: 'Plan — que faire ?',
    options: [
      { value: 'ok',     label: '✓  Valider et générer le code' },
      { value: 'cancel', label: '✗  Annuler' },
    ],
  });

  if (p.isCancel(planAction) || planAction === 'cancel') { p.cancel('Annulé'); return; }

  // ── Génération du code incrémental ──
  p.intro(chalk.bold('③ Génération du code'));

  const codePrompt = [
    '## Spec de la feature',
    spec,
    '',
    '## Plan d\'implémentation',
    plan,
    '',
    ragSection,
    '',
    '## Instruction',
    'Génère maintenant le code complet pour chaque fichier à créer ou modifier.',
    'Commence par lister tous les fichiers que tu vas générer, puis génère-les un par un.',
  ].join('\n');

  let code = '';
  process.stdout.write(chalk.dim('\n'));
  await provider.stream(codePrompt, SYSTEM_INCREMENT_CODE, chunk => {
    process.stdout.write(chunk);
    code += chunk;
  });
  process.stdout.write('\n\n');

  recordUsage(process.cwd(), {
    projectName: slug, step: 'implement', model: providerCfg.model ?? '', provider: providerCfg.type,
    inputTokens: Math.ceil(codePrompt.length / 4), outputTokens: Math.ceil(code.length / 4),
  });

  // ── Diff interactif avant écriture ──
  const parsedFiles = parseGeneratedFiles(code, process.cwd());

  if (parsedFiles.length === 0) {
    console.log(chalk.yellow('  ⚠ Aucun fichier parsé depuis la génération'));
    p.outro(chalk.yellow('Vérifie le code généré ci-dessus'));
    return;
  }

  const writeResult = await interactiveDiffWrite(parsedFiles, process.cwd());

  console.log('');
  console.log(chalk.green(`  ✓ ${writeResult.written.length} fichier(s) écrits`));
  if (writeResult.skipped.length > 0) {
    console.log(chalk.dim(`  ○ ${writeResult.skipped.length} fichier(s) ignorés`));
  }

  // ── Auto-commit ──
  if (opts.autoGit !== false) {
    const commit = await autoCommit(process.cwd(), 'implement', slug);
    if (commit.success && !commit.skipped) {
      console.log(chalk.dim(`  git: ${commit.sha} — ${commit.message}`));
    }
  }

  // ── PR automatique ──
  if (opts.pr) {
    const { createPullRequest, ghAvailable } = await import('./pr-creator.js');
    if (ghAvailable(process.cwd())) {
      const prSpinner = p.spinner();
      prSpinner.start('Création de la Pull Request...');
      const pr = await createPullRequest(process.cwd(), {
        projectName: slug,
        spec,
        plan,
        tasks: '',
      });
      if (pr.success) {
        prSpinner.stop('Pull Request créée !');
        console.log(chalk.cyan(`  → ${pr.url}`));
      } else {
        prSpinner.stop(`PR échouée : ${pr.error}`);
      }
    } else {
      console.log(chalk.yellow('  ⚠ gh CLI non disponible — PR non créée'));
    }
  }

  p.outro(chalk.green(`✓ Feature "${description.slice(0, 40)}" ajoutée — specs dans ${featureDir.replace(process.cwd(), '.')}`));
}
