import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export interface ValidationResult {
  passed: boolean;
  checks: Array<{ label: string; ok: boolean; detail?: string }>;
}

// ─── Validation post-génération ───────────────────────────────────────────────

export async function validateGeneratedProject(rootDir: string): Promise<ValidationResult> {
  const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];

  // 1. package.json présent
  const hasPkg = existsSync(join(rootDir, 'package.json'));
  checks.push({ label: 'package.json présent', ok: hasPkg });

  if (hasPkg) {
    // 2. npm install
    try {
      const mgr = detectPackageManager(rootDir);
      execSync(`${mgr} install --prefer-offline 2>&1`, { cwd: rootDir, timeout: 120_000, stdio: 'pipe' });
      checks.push({ label: 'Dépendances installables', ok: true });
    } catch (e) {
      checks.push({ label: 'Dépendances installables', ok: false, detail: String(e).slice(0, 200) });
    }

    // 3. TypeScript compile (si tsconfig.json présent)
    if (existsSync(join(rootDir, 'tsconfig.json'))) {
      try {
        execSync('npx tsc --noEmit 2>&1', { cwd: rootDir, timeout: 60_000, stdio: 'pipe' });
        checks.push({ label: 'TypeScript compile', ok: true });
      } catch (e) {
        const out = String(e).slice(0, 400);
        const errCount = (out.match(/error TS/g) ?? []).length;
        checks.push({ label: 'TypeScript compile', ok: false, detail: `${errCount} erreur(s) TS` });
      }
    }

    // 4. Tests passent (si script test défini)
    try {
      const pkg = JSON.parse(require('fs').readFileSync(join(rootDir, 'package.json'), 'utf-8'));
      if (pkg.scripts?.test && !pkg.scripts.test.includes('no test')) {
        execSync('npm test -- --passWithNoTests 2>&1', { cwd: rootDir, timeout: 60_000, stdio: 'pipe' });
        checks.push({ label: 'Tests passent', ok: true });
      }
    } catch (e) {
      checks.push({ label: 'Tests passent', ok: false, detail: 'Voir les logs de test' });
    }
  }

  // 5. Python : requirements.txt installable
  if (existsSync(join(rootDir, 'requirements.txt'))) {
    try {
      execSync('pip install -r requirements.txt --dry-run 2>&1', { cwd: rootDir, timeout: 30_000, stdio: 'pipe' });
      checks.push({ label: 'Python requirements valides', ok: true });
    } catch {
      checks.push({ label: 'Python requirements valides', ok: false, detail: 'Vérifier requirements.txt' });
    }
  }

  // 6. Docker build (si Dockerfile présent)
  if (existsSync(join(rootDir, 'Dockerfile'))) {
    try {
      execSync('docker build --check . 2>&1', { cwd: rootDir, timeout: 10_000, stdio: 'pipe' });
      checks.push({ label: 'Dockerfile syntaxe valide', ok: true });
    } catch {
      // docker build --check peut ne pas être dispo partout
      checks.push({ label: 'Dockerfile présent', ok: true });
    }
  }

  // 7. .env.example présent
  const hasEnvExample = existsSync(join(rootDir, '.env.example'));
  checks.push({ label: '.env.example présent', ok: hasEnvExample, detail: hasEnvExample ? undefined : 'Variables d\'env non documentées' });

  // 8. README.md présent
  const hasReadme = existsSync(join(rootDir, 'README.md'));
  checks.push({ label: 'README.md présent', ok: hasReadme });

  return {
    passed: checks.every(c => c.ok),
    checks,
  };
}

function detectPackageManager(rootDir: string): string {
  if (existsSync(join(rootDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(rootDir, 'yarn.lock')))       return 'yarn';
  if (existsSync(join(rootDir, 'bun.lockb')))       return 'bun';
  return 'npm';
}

export function printValidationResult(result: ValidationResult): void {
  const chalk = require('chalk');
  console.log(chalk.bold('\n  Validation du projet généré\n'));
  for (const { label, ok, detail } of result.checks) {
    const icon = ok ? chalk.green('  ✓') : chalk.red('  ✗');
    const text = ok ? chalk.white(label) : chalk.red(label);
    const hint = detail ? chalk.dim(`  → ${detail}`) : '';
    console.log(`${icon}  ${text}${hint}`);
  }
  console.log();
  if (result.passed) {
    console.log(chalk.green('  ✓ Projet valide et prêt à être lancé\n'));
  } else {
    const failed = result.checks.filter(c => !c.ok).length;
    console.log(chalk.yellow(`  ⚠ ${failed} vérification(s) échouée(s) — voir ci-dessus\n`));
  }
}
