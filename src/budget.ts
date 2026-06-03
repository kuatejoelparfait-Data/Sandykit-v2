import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UsageEntry {
  timestamp: string;
  projectName: string;
  step: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
}

export interface BudgetConfig {
  monthlyLimitUSD: number;
  alertAtPercent: number; // ex: 80 → alerte à 80% du budget
  webhookUrl?: string;
}

export interface BudgetStatus {
  spentUSD: number;
  limitUSD: number;
  remainingUSD: number;
  percentUsed: number;
  entries: UsageEntry[];
  currentMonth: string;
}

// ─── Pricing (identique à cost-estimator.ts) ─────────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-opus-4-7':           { input: 15.00, output: 75.00 },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
  'gpt-4o':                    { input: 2.50,  output: 10.00 },
  'gpt-4-turbo':               { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo':             { input: 0.50,  output: 1.50  },
  '__local__':                 { input: 0,     output: 0     },
};

export function computeCost(model: string, provider: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] ?? (
    provider === 'ollama' || provider === 'custom' ? PRICING['__local__'] : PRICING['gpt-4o']
  );
  return ((inputTokens * pricing.input) + (outputTokens * pricing.output)) / 1_000_000;
}

// ─── Fichiers ─────────────────────────────────────────────────────────────────

function usagePath(projectDir: string): string {
  return join(projectDir, '.sandykit', 'usage.json');
}

function budgetConfigPath(projectDir: string): string {
  return join(projectDir, '.sandykit', 'budget.json');
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Lecture / Écriture ───────────────────────────────────────────────────────

function loadEntries(projectDir: string): UsageEntry[] {
  const path = usagePath(projectDir);
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as UsageEntry[];
  } catch {
    return [];
  }
}

function saveEntries(projectDir: string, entries: UsageEntry[]): void {
  const dir = join(projectDir, '.sandykit');
  mkdirSync(dir, { recursive: true });
  writeFileSync(usagePath(projectDir), JSON.stringify(entries, null, 2), 'utf-8');
}

export function loadBudgetConfig(projectDir: string): BudgetConfig | null {
  const path = budgetConfigPath(projectDir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as BudgetConfig;
  } catch {
    return null;
  }
}

export function saveBudgetConfig(projectDir: string, config: BudgetConfig): void {
  const dir = join(projectDir, '.sandykit');
  mkdirSync(dir, { recursive: true });
  writeFileSync(budgetConfigPath(projectDir), JSON.stringify(config, null, 2), 'utf-8');
}

// ─── Enregistrement d'une utilisation ────────────────────────────────────────

export function recordUsage(
  projectDir: string,
  entry: Omit<UsageEntry, 'timestamp' | 'costUSD'>
): UsageEntry {
  const cost = computeCost(entry.model, entry.provider, entry.inputTokens, entry.outputTokens);
  const full: UsageEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    costUSD: cost,
  };
  const entries = loadEntries(projectDir);
  entries.push(full);
  saveEntries(projectDir, entries);
  return full;
}

// ─── Statut budget du mois courant ───────────────────────────────────────────

export function getBudgetStatus(projectDir: string): BudgetStatus {
  const month = currentMonth();
  const entries = loadEntries(projectDir).filter(e => e.timestamp.startsWith(month));
  const spent = entries.reduce((sum, e) => sum + e.costUSD, 0);
  const cfg = loadBudgetConfig(projectDir);
  const limit = cfg?.monthlyLimitUSD ?? Infinity;
  return {
    spentUSD: spent,
    limitUSD: limit,
    remainingUSD: Math.max(0, limit - spent),
    percentUsed: limit === Infinity ? 0 : Math.round((spent / limit) * 100),
    entries,
    currentMonth: month,
  };
}

// ─── Vérification avant génération ───────────────────────────────────────────

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  status: BudgetStatus;
  shouldAlert: boolean;
}

export function checkBudget(projectDir: string, estimatedCost: number): BudgetCheckResult {
  const status = getBudgetStatus(projectDir);
  const cfg = loadBudgetConfig(projectDir);

  if (!cfg || status.limitUSD === Infinity) {
    return { allowed: true, status, shouldAlert: false };
  }

  const projectedSpent = status.spentUSD + estimatedCost;
  const projectedPercent = Math.round((projectedSpent / status.limitUSD) * 100);

  if (projectedSpent > status.limitUSD) {
    return {
      allowed: false,
      reason: `Budget mensuel dépassé : $${status.spentUSD.toFixed(3)} dépensé / $${status.limitUSD.toFixed(2)} limite`,
      status,
      shouldAlert: false,
    };
  }

  const alertPercent = cfg.alertAtPercent ?? 80;
  const shouldAlert = projectedPercent >= alertPercent && status.percentUsed < alertPercent;

  return { allowed: true, status, shouldAlert };
}

// ─── Envoi alerte webhook ─────────────────────────────────────────────────────

export async function sendBudgetAlert(
  webhookUrl: string,
  status: BudgetStatus
): Promise<void> {
  try {
    const { default: https } = await import('https');
    const { default: http } = await import('http');
    const payload = JSON.stringify({
      text: `⚠️ SANDYKIT — Budget IA à ${status.percentUsed}% ($${status.spentUSD.toFixed(3)} / $${status.limitUSD.toFixed(2)})`,
      status,
    });
    const url = new URL(webhookUrl);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, () => {});
    req.on('error', () => {});
    req.setTimeout(5000, () => req.destroy());
    req.write(payload);
    req.end();
  } catch { /* best effort */ }
}

// ─── Rapport formaté ─────────────────────────────────────────────────────────

export function formatBudgetReport(projectDir: string): string {
  const month = currentMonth();
  const allEntries = loadEntries(projectDir);
  const monthEntries = allEntries.filter(e => e.timestamp.startsWith(month));
  const status = getBudgetStatus(projectDir);
  const cfg = loadBudgetConfig(projectDir);

  const lines: string[] = [
    `  Mois courant : ${month}`,
    '',
  ];

  if (monthEntries.length === 0) {
    lines.push('  Aucune utilisation ce mois-ci.');
  } else {
    // Grouper par modèle
    const byModel: Record<string, { count: number; cost: number }> = {};
    for (const e of monthEntries) {
      if (!byModel[e.model]) byModel[e.model] = { count: 0, cost: 0 };
      byModel[e.model].count++;
      byModel[e.model].cost += e.costUSD;
    }

    lines.push('  Dépenses par modèle :');
    for (const [model, { count, cost }] of Object.entries(byModel)) {
      lines.push(`    ${model.padEnd(28)} $${cost.toFixed(4).padStart(8)}  (${count} génération${count > 1 ? 's' : ''})`);
    }

    lines.push('');
    lines.push(`  ${'Total mensuel'.padEnd(28)} $${status.spentUSD.toFixed(4).padStart(8)}`);
  }

  if (cfg && status.limitUSD !== Infinity) {
    const bar = buildProgressBar(status.percentUsed);
    lines.push('');
    lines.push(`  Budget : $${status.spentUSD.toFixed(3)} / $${status.limitUSD.toFixed(2)}`);
    lines.push(`  ${bar} ${status.percentUsed}%`);
    lines.push(`  Restant : $${status.remainingUSD.toFixed(3)}`);
  } else {
    lines.push('');
    lines.push('  Pas de limite configurée. Lance : sandykit budget set <montant>');
  }

  // Historique des 10 dernières
  if (allEntries.length > 0) {
    lines.push('');
    lines.push('  10 dernières générations :');
    const recent = [...allEntries].reverse().slice(0, 10);
    for (const e of recent) {
      const date = e.timestamp.slice(0, 16).replace('T', ' ');
      lines.push(`    ${date}  ${e.step.padEnd(10)} ${e.model.padEnd(22)} $${e.costUSD.toFixed(4)}`);
    }
  }

  return lines.join('\n');
}

function buildProgressBar(percent: number, width = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const color = percent >= 90 ? '🔴' : percent >= 80 ? '🟠' : '🟢';
  return `${color} [${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}
