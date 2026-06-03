import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Integration } from './types.js';

// CJS-compatible __dirname: works both in ESM (via import.meta.url) and CJS (native __dirname)
const _dirname: string =
  typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath((import.meta as { url?: string }).url ?? ''));
const TEMPLATES_DIR = join(_dirname, 'templates', 'commands');

const COMMANDS = ['specify', 'clarify', 'plan', 'tasks', 'implement', 'review', 'back', 'continue'] as const;

interface IntegrationPaths {
  commandsDir: string;
  extension: string;
}

export function getIntegrationPaths(integration: Integration, rootDir: string): IntegrationPaths {
  switch (integration) {
    case 'claude':
      return {
        commandsDir: join(rootDir, '.claude', 'commands'),
        extension: '.md',
      };
    case 'cursor':
      return {
        commandsDir: join(rootDir, '.cursor', 'rules'),
        extension: '.mdc',
      };
    case 'copilot':
      return {
        commandsDir: join(rootDir, '.github', 'instructions'),
        extension: '.instructions.md',
      };
    case 'codex':
      return {
        commandsDir: join(rootDir, '.codex'),
        extension: '.md',
      };
    case 'antigravity':
      return {
        commandsDir: join(rootDir, '.antigravity'),
        extension: '.md',
      };
  }
}

export async function install(integrations: Integration[], rootDir = process.cwd()): Promise<void> {
  const specsDir = join(rootDir, 'specs');
  if (!existsSync(specsDir)) mkdirSync(specsDir, { recursive: true });

  for (const integration of integrations) {
    const { commandsDir, extension } = getIntegrationPaths(integration, rootDir);
    if (!existsSync(commandsDir)) mkdirSync(commandsDir, { recursive: true });

    for (const cmd of COMMANDS) {
      const src = join(TEMPLATES_DIR, `${cmd}.md`);
      const dest = join(commandsDir, `sandykit.${cmd}${extension}`);
      if (existsSync(src)) {
        copyFileSync(src, dest);
      }
    }
  }
}
