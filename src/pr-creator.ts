import { spawnSync } from 'child_process';
import { isGitRepo, getRecentCommits } from './git-committer.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PROptions {
  projectName: string;
  spec: string;
  plan: string;
  tasks: string;
  baseBranch?: string;
  draft?: boolean;
}

export interface PRResult {
  success: boolean;
  url?: string;
  branch?: string;
  error?: string;
}

// ─── Utilitaires Git ─────────────────────────────────────────────────────────

function run(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', timeout: 30_000 });
  return { ok: r.status === 0, stdout: r.stdout?.trim() ?? '', stderr: r.stderr?.trim() ?? '' };
}

function ghRun(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync('gh', args, { cwd, encoding: 'utf-8', timeout: 30_000 });
  return { ok: r.status === 0, stdout: r.stdout?.trim() ?? '', stderr: r.stderr?.trim() ?? '' };
}

export function ghAvailable(cwd: string): boolean {
  const r = spawnSync('gh', ['--version'], { cwd, encoding: 'utf-8', timeout: 5_000 });
  return r.status === 0;
}

function detectBaseBranch(cwd: string): string {
  // Essaie main, puis master, puis HEAD
  for (const branch of ['main', 'master']) {
    const r = run(['rev-parse', '--verify', branch], cwd);
    if (r.ok) return branch;
  }
  const r = run(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  return r.stdout || 'main';
}

function branchExists(cwd: string, branch: string): boolean {
  return run(['rev-parse', '--verify', branch], cwd).ok;
}

// ─── Génération description PR ───────────────────────────────────────────────

function generatePRBody(opts: PROptions, branch: string, commits: string[]): string {
  const taskLines = opts.tasks
    .split('\n')
    .filter(l => l.match(/^[-\*]\s+\[[ x]\]/))
    .slice(0, 15)
    .map(l => l.replace(/^[-\*]\s+\[[ x]\]/, '- [x]'))
    .join('\n');

  const specSummary = opts.spec
    .split('\n')
    .filter(l => l.startsWith('#') || l.startsWith('##'))
    .slice(0, 8)
    .join('\n');

  return `## 📋 Résumé

Généré par **SANDYKIT** — pipeline spec-driven automatique.

> Branche : \`${branch}\`

## 🏗️ Ce qui a été implémenté

${specSummary || opts.spec.slice(0, 500)}

## ✅ Tâches réalisées

${taskLines || '_Voir specs/ pour le détail complet_'}

## 🔍 Plan technique

${opts.plan.slice(0, 600)}${opts.plan.length > 600 ? '\n\n_... (voir specs/ pour le plan complet)_' : ''}

## 📂 Commits inclus

${commits.map(c => `- \`${c}\``).join('\n') || '_Voir git log_'}

## 🧪 Vérification

- [ ] Tests passent localement
- [ ] Pas de secrets exposés
- [ ] README à jour
- [ ] Variables d'env documentées dans .env.example

---
_🤖 Généré avec [SANDYKIT](https://github.com/kuatejoelparfait-Data/Sandykit) — spec-driven development pour agents IA_`;
}

// ─── Création de la PR ────────────────────────────────────────────────────────

export async function createPullRequest(
  projectDir: string,
  opts: PROptions
): Promise<PRResult> {
  if (!isGitRepo(projectDir)) {
    return { success: false, error: 'Pas un dépôt git' };
  }

  if (!ghAvailable(projectDir)) {
    return { success: false, error: 'gh CLI non installé. Installe depuis https://cli.github.com' };
  }

  // 1. Détecter la branche de base
  const baseBranch = opts.baseBranch ?? detectBaseBranch(projectDir);

  // 2. Créer une branche feature
  const slug = opts.projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const date = new Date().toISOString().slice(0, 10);
  let featureBranch = `feature/${slug}-sandykit-${date}`;

  // Éviter les collisions de noms de branche
  if (branchExists(projectDir, featureBranch)) {
    featureBranch = `${featureBranch}-${Date.now().toString(36)}`;
  }

  const checkoutResult = run(['checkout', '-b', featureBranch], projectDir);
  if (!checkoutResult.ok) {
    return { success: false, error: `Impossible de créer la branche : ${checkoutResult.stderr}` };
  }

  // 3. Stage + commit tout
  run(['add', '.'], projectDir);
  const statusR = run(['status', '--porcelain'], projectDir);
  if (statusR.stdout) {
    run(['commit', '-m', `feat(${slug}): sandykit generated implementation`, '--no-gpg-sign'], projectDir);
  }

  // 4. Push
  const pushResult = run(['push', '-u', 'origin', featureBranch], projectDir);
  if (!pushResult.ok) {
    return {
      success: false,
      branch: featureBranch,
      error: `Push échoué : ${pushResult.stderr}\nVérifie que le remote origin est configuré.`,
    };
  }

  // 5. Récupérer les commits récents pour la description
  const commits = getRecentCommits(projectDir, 10);

  // 6. Créer la PR via gh
  const body = generatePRBody(opts, featureBranch, commits);
  const title = `feat(${slug}): ${opts.projectName} — implémentation SANDYKIT`;

  const prArgs = [
    'pr', 'create',
    '--title', title,
    '--body', body,
    '--base', baseBranch,
    '--head', featureBranch,
  ];

  if (opts.draft) prArgs.push('--draft');

  const prResult = ghRun(prArgs, projectDir);

  if (!prResult.ok) {
    return {
      success: false,
      branch: featureBranch,
      error: `gh pr create échoué : ${prResult.stderr}`,
    };
  }

  const url = prResult.stdout.trim();
  return { success: true, url, branch: featureBranch };
}
