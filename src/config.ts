import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { SandykitConfig } from './types.js';

const CONFIG_FILE = '.sandykit/config.json';

export function saveConfig(cfg: Partial<SandykitConfig>, rootDir = process.cwd()): void {
  const dir = join(rootDir, '.sandykit');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const full: SandykitConfig = {
    projectName: cfg.projectName ?? 'mon-projet',
    integrations: cfg.integrations ?? ['claude'],
    createdAt: new Date().toISOString(),
    ...(cfg.provider ? { provider: cfg.provider } : {}),
  };
  writeFileSync(join(rootDir, CONFIG_FILE), JSON.stringify(full, null, 2), 'utf-8');
}

export function loadConfig(rootDir = process.cwd()): SandykitConfig | null {
  const path = join(rootDir, CONFIG_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SandykitConfig;
  } catch {
    return null;
  }
}
