import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ProviderConfig } from './providers.js';

export interface CheckpointState {
  version: 1;
  projectName: string;
  featureDir: string;
  providerCfg: ProviderConfig;
  input?: string;
  spec?: string;
  plan?: string;
  tasks?: string;
  step: number; // dernière étape complétée (0=provider, 1=nom, 2=input, 3=spec, 4=plan, 5=tasks, 6=impl)
  savedAt: string;
}

const CHECKPOINT_FILE = '.sandykit/.dev-checkpoint.json';

export function saveCheckpoint(state: CheckpointState, rootDir = process.cwd()): void {
  const dir = join(rootDir, '.sandykit');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Ne pas sauvegarder la clé API dans le checkpoint
  const safe: CheckpointState = {
    ...state,
    providerCfg: { ...state.providerCfg, apiKey: undefined },
  };
  writeFileSync(join(rootDir, CHECKPOINT_FILE), JSON.stringify(safe, null, 2), 'utf-8');
}

export function loadCheckpoint(rootDir = process.cwd()): CheckpointState | null {
  const path = join(rootDir, CHECKPOINT_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as CheckpointState;
  } catch {
    return null;
  }
}

export function clearCheckpoint(rootDir = process.cwd()): void {
  const path = join(rootDir, CHECKPOINT_FILE);
  if (existsSync(path)) {
    try { require('fs').unlinkSync(path); } catch { /* ignore */ }
  }
}

export function formatCheckpointAge(savedAt: string): string {
  const ms = Date.now() - new Date(savedAt).getTime();
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  if (hours > 0) return `il y a ${hours}h${mins % 60}m`;
  if (mins > 0) return `il y a ${mins}m`;
  return 'à l\'instant';
}

const STEP_LABELS: Record<number, string> = {
  0: 'Provider configuré',
  1: 'Nom du projet défini',
  2: 'Description collectée',
  3: 'Spec générée',
  4: 'Plan généré',
  5: 'Tâches générées',
  6: 'Implémentation terminée',
};

export function describeCheckpoint(cp: CheckpointState): string {
  return `"${cp.projectName}" — ${STEP_LABELS[cp.step] ?? `étape ${cp.step}`} (${formatCheckpointAge(cp.savedAt)})`;
}
