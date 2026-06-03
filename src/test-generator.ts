import { execSync, spawnSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import type { AIProvider } from './providers.js';

const SYSTEM_TESTS = `Tu es un expert en test-driven development. Tu génères des tests complets, maintenables et réalistes.
- Couvre les cas nominaux ET les cas d'erreur
- Utilise les mocks/stubs appropriés
- Pas de tests triviaux (ne teste pas les getters simples)
- Format : même convention de test que le projet (jest/vitest pour JS, pytest pour Python)
- Chaque fichier de test doit être autonome et runnable`;

export async function generateTests(
  provider: AIProvider,
  spec: string,
  tasks: string,
  projectDir: string,
  onChunk: (text: string) => void
): Promise<string> {
  const stack = detectTestFramework(projectDir);

  const prompt = [
    '## Spec fonctionnelle',
    spec,
    '',
    '## Tâches implémentées',
    tasks,
    '',
    `## Framework de test détecté : ${stack.framework}`,
    '',
    '## Instruction',
    'Génère une suite de tests complète pour ce projet.',
    'Priorité : logique métier, API endpoints, fonctions utilitaires.',
    'Format pour chaque fichier de test :',
    '## Fichier: chemin/relatif/test.ext',
    '```',
    '[contenu complet du fichier de test]',
    '```',
  ].join('\n');

  return provider.stream(prompt, SYSTEM_TESTS, onChunk).then(() => '');
}

// ─── Lint + Format ────────────────────────────────────────────────────────────

export interface LintResult {
  tool: string;
  passed: boolean;
  fixed: number;
  errors: number;
}

export async function runLintAndFormat(projectDir: string): Promise<LintResult[]> {
  const results: LintResult[] = [];

  // ESLint
  if (existsSync(join(projectDir, '.eslintrc.js')) ||
      existsSync(join(projectDir, '.eslintrc.json')) ||
      existsSync(join(projectDir, 'eslint.config.js')) ||
      existsSync(join(projectDir, 'eslint.config.mjs'))) {
    try {
      const r = spawnSync('npx', ['eslint', '.', '--fix', '--ext', '.ts,.tsx,.js,.jsx'], {
        cwd: projectDir, encoding: 'utf-8', timeout: 30_000,
      });
      const errors = (r.stdout?.match(/error/gi) ?? []).length;
      results.push({ tool: 'ESLint', passed: r.status === 0, fixed: 0, errors });
    } catch {
      results.push({ tool: 'ESLint', passed: false, fixed: 0, errors: -1 });
    }
  }

  // Prettier
  if (existsSync(join(projectDir, '.prettierrc')) ||
      existsSync(join(projectDir, '.prettierrc.json')) ||
      existsSync(join(projectDir, 'prettier.config.js'))) {
    try {
      spawnSync('npx', ['prettier', '--write', '.'], {
        cwd: projectDir, encoding: 'utf-8', timeout: 30_000,
      });
      results.push({ tool: 'Prettier', passed: true, fixed: 1, errors: 0 });
    } catch {
      results.push({ tool: 'Prettier', passed: false, fixed: 0, errors: -1 });
    }
  }

  // Si aucun config lint trouvé → créer une config minimale Prettier
  if (results.length === 0 && existsSync(join(projectDir, 'package.json'))) {
    try {
      writeFileSync(join(projectDir, '.prettierrc'), JSON.stringify({
        semi: true, singleQuote: true, tabWidth: 2, trailingComma: 'es5', printWidth: 100,
      }, null, 2), 'utf-8');
      spawnSync('npx', ['prettier', '--write', '.', '--ignore-unknown'], {
        cwd: projectDir, encoding: 'utf-8', timeout: 30_000,
      });
      results.push({ tool: 'Prettier (auto-configuré)', passed: true, fixed: 1, errors: 0 });
    } catch {
      results.push({ tool: 'Prettier', passed: false, fixed: 0, errors: 0 });
    }
  }

  // Black (Python)
  if (existsSync(join(projectDir, 'requirements.txt')) || existsSync(join(projectDir, 'pyproject.toml'))) {
    try {
      spawnSync('black', ['.'], { cwd: projectDir, encoding: 'utf-8', timeout: 30_000 });
      results.push({ tool: 'Black (Python)', passed: true, fixed: 1, errors: 0 });
    } catch {
      results.push({ tool: 'Black (Python)', passed: false, fixed: 0, errors: 0 });
    }
  }

  return results;
}

// ─── Détection framework de test ─────────────────────────────────────────────

function detectTestFramework(projectDir: string): { framework: string; ext: string } {
  try {
    const pkg = JSON.parse(require('fs').readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    if (deps.vitest)  return { framework: 'vitest',  ext: '.test.ts' };
    if (deps.jest)    return { framework: 'jest',    ext: '.test.ts' };
    if (deps.mocha)   return { framework: 'mocha',   ext: '.spec.js' };
  } catch { /* ignore */ }
  if (existsSync(join(projectDir, 'requirements.txt'))) return { framework: 'pytest', ext: '_test.py' };
  return { framework: 'jest', ext: '.test.ts' };
}
