import { existsSync, readdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import type { FeatureStatus } from './types.js';

const PIPELINE_ORDER = ['spec.md', 'plan.md', 'tasks.md', 'review.md'];

export function getFeatureStatus(featureDir: string): FeatureStatus {
  const id = basename(featureDir);
  const name = id.replace(/^\d+-/, '');
  return {
    id,
    name,
    hasSpec: existsSync(join(featureDir, 'spec.md')),
    hasPlan: existsSync(join(featureDir, 'plan.md')),
    hasTasks: existsSync(join(featureDir, 'tasks.md')),
    hasImplement: false,
    hasReview: existsSync(join(featureDir, 'review.md')),
  };
}

export function validatePipelineOrder(featureDir: string, newFile: string): string | null {
  const idx = PIPELINE_ORDER.indexOf(newFile);
  if (idx <= 0) return null;

  const required = PIPELINE_ORDER[idx - 1]!;
  if (!existsSync(join(featureDir, required))) {
    return `${required} manquant — lance la commande précédente d'abord`;
  }
  return null;
}

export function getAllFeatureStatuses(specsDir: string): FeatureStatus[] {
  if (!existsSync(specsDir)) return [];
  return readdirSync(specsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => getFeatureStatus(join(specsDir, d.name)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function startWatcher(rootDir = process.cwd()): void {
  const specsDir = join(rootDir, 'specs');

  // Import dynamique pour éviter d'alourdir les tests
  import('chokidar').then(({ default: chokidar }) => {
    import('chalk').then(({ default: chalk }) => {
      console.log(chalk.cyan('[SANDYKIT]') + ' Watcher démarré → ' + chalk.dim(specsDir));

      const watcher = chokidar.watch(specsDir, {
        ignored: /(^|[/\\])\../,
        persistent: true,
        ignoreInitial: true,
      });

      watcher.on('add', (filePath: string) => {
        const file = basename(filePath);
        const featureDir = dirname(filePath);
        chalk; // déjà importé
        import('chalk').then(({ default: c }) => {
          console.log(c.cyan('[SANDYKIT]') + ' ✓ ' + c.green(filePath.replace(rootDir, '').replace(/\\/g, '/')) + ' créé');
          const warning = validatePipelineOrder(featureDir, file);
          if (warning) {
            console.log(c.cyan('[SANDYKIT]') + ' ⚠ ' + c.yellow(warning));
          }
        });
      });

      watcher.on('change', (filePath: string) => {
        import('chalk').then(({ default: c }) => {
          console.log(c.cyan('[SANDYKIT]') + ' ~ ' + c.dim(filePath.replace(rootDir, '').replace(/\\/g, '/')) + ' modifié');
        });
      });
    });
  });
}
