import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface DetectedStack {
  language: string[];
  framework: string[];
  runtime: string[];
  database: string[];
  packageManager: string;
  hasTests: boolean;
  hasDocker: boolean;
  hasCI: boolean;
  summary: string;
}

// ─── Détection ────────────────────────────────────────────────────────────────

export function detectStack(rootDir = process.cwd()): DetectedStack {
  const has = (file: string) => existsSync(join(rootDir, file));
  const readJson = (file: string): Record<string, unknown> => {
    try { return JSON.parse(readFileSync(join(rootDir, file), 'utf-8')); } catch { return {}; }
  };

  const language: string[] = [];
  const framework: string[] = [];
  const runtime: string[] = [];
  const database: string[] = [];

  // ─── Languages ───
  if (has('package.json'))           language.push('JavaScript/TypeScript');
  if (has('requirements.txt') || has('pyproject.toml') || has('setup.py')) language.push('Python');
  if (has('go.mod'))                 language.push('Go');
  if (has('Cargo.toml'))             language.push('Rust');
  if (has('pom.xml') || has('build.gradle')) language.push('Java');
  if (has('composer.json'))          language.push('PHP');
  if (has('Gemfile'))                language.push('Ruby');
  if (has('*.csproj') || has('*.sln')) language.push('C#');

  // ─── Package manager ───
  let packageManager = 'npm';
  if (has('pnpm-lock.yaml'))         packageManager = 'pnpm';
  else if (has('yarn.lock'))         packageManager = 'yarn';
  else if (has('bun.lockb'))         packageManager = 'bun';

  // ─── Frameworks JS ───
  const pkg = readJson('package.json') as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  if (allDeps['next'])               framework.push('Next.js');
  if (allDeps['react'])              framework.push('React');
  if (allDeps['vue'])                framework.push('Vue');
  if (allDeps['nuxt'])               framework.push('Nuxt');
  if (allDeps['@angular/core'])      framework.push('Angular');
  if (allDeps['svelte'])             framework.push('Svelte');
  if (allDeps['express'])            framework.push('Express');
  if (allDeps['fastify'])            framework.push('Fastify');
  if (allDeps['nestjs'] || allDeps['@nestjs/core']) framework.push('NestJS');
  if (allDeps['vite'])               framework.push('Vite');

  // ─── Runtimes ───
  if (has('package.json'))           runtime.push('Node.js');
  if (has('.nvmrc') || has('.node-version')) {
    try { runtime.push(`Node ${readFileSync(join(rootDir, '.nvmrc'), 'utf-8').trim()}`); } catch { /* ignore */ }
  }
  if (has('Dockerfile') || has('docker-compose.yml') || has('docker-compose.yaml')) {
    runtime.push('Docker');
  }

  // ─── Databases ───
  if (allDeps['mongoose'] || allDeps['mongodb']) database.push('MongoDB');
  if (allDeps['pg'] || allDeps['postgres'])      database.push('PostgreSQL');
  if (allDeps['mysql2'] || allDeps['mysql'])     database.push('MySQL');
  if (allDeps['sqlite3'] || allDeps['better-sqlite3']) database.push('SQLite');
  if (allDeps['redis'] || allDeps['ioredis'])    database.push('Redis');
  if (allDeps['prisma'] || allDeps['@prisma/client']) database.push('Prisma ORM');
  if (allDeps['typeorm'])                        database.push('TypeORM');
  if (allDeps['drizzle-orm'])                    database.push('Drizzle ORM');

  // ─── Tests ───
  const hasTests = !!(
    allDeps['jest'] || allDeps['vitest'] || allDeps['mocha'] ||
    allDeps['@testing-library/react'] || has('jest.config.js') || has('vitest.config.ts')
  );

  // ─── Infra ───
  const hasDocker = has('Dockerfile') || has('docker-compose.yml') || has('docker-compose.yaml');
  const hasCI = has('.github/workflows') || has('.gitlab-ci.yml') || has('.circleci/config.yml');

  // ─── Summary ───
  const parts: string[] = [];
  if (language.length)   parts.push(language.join(', '));
  if (framework.length)  parts.push(framework.join(' + '));
  if (database.length)   parts.push(database.join(' + '));
  if (hasDocker)         parts.push('Docker');
  const summary = parts.length ? parts.join(' · ') : 'Projet vide (nouveau)';

  return { language, framework, runtime, database, packageManager, hasTests, hasDocker, hasCI, summary };
}

export function stackToPromptContext(stack: DetectedStack): string {
  if (!stack.language.length && !stack.framework.length) return '';
  const lines = [
    '## Contexte du projet existant (RESPECTER ABSOLUMENT)',
    stack.language.length  ? `- Language(s) : ${stack.language.join(', ')}` : '',
    stack.framework.length ? `- Framework(s) : ${stack.framework.join(', ')}` : '',
    stack.database.length  ? `- Base(s) de données : ${stack.database.join(', ')}` : '',
    `- Gestionnaire de paquets : ${stack.packageManager}`,
    stack.hasTests  ? '- Tests : déjà configurés (conserver la convention existante)' : '',
    stack.hasDocker ? '- Docker : présent (adapter les Dockerfiles si nécessaire)' : '',
  ].filter(Boolean);
  return lines.join('\n');
}
