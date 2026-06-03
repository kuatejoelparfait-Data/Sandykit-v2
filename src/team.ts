import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ProviderType } from './providers.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamMember {
  name: string;
  email: string;
  role: 'owner' | 'contributor' | 'reviewer';
  joinedAt: string;
}

export interface TeamConfig {
  version: 1;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  provider: ProviderType;
  model: string;
  /** Never store apiKey in team config — use env vars or keychain */
  language: 'fr' | 'en';
  autoCommit: boolean;
  dryRun: boolean;
  members: TeamMember[];
  hooks: {
    /** Shell command run after each step completes */
    afterStep?: string;
    /** Shell command run after full generation */
    afterGenerate?: string;
    /** Webhook URL to POST step results to */
    webhook?: string;
  };
  export: {
    jira?: {
      baseUrl: string;
      project: string;
      /** Token stored in env: JIRA_API_TOKEN */
    };
    linear?: {
      teamId: string;
      /** Token stored in env: LINEAR_API_TOKEN */
    };
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAM_CONFIG_FILENAME = 'sandykit.team.json';
const GITIGNORE_SAFE_FIELDS = ['members', 'hooks.webhook', 'export'];

// ─── Load / Save ──────────────────────────────────────────────────────────────

export function teamConfigPath(projectDir: string): string {
  return join(projectDir, TEAM_CONFIG_FILENAME);
}

export function hasTeamConfig(projectDir: string): boolean {
  return existsSync(teamConfigPath(projectDir));
}

export function loadTeamConfig(projectDir: string): TeamConfig | null {
  const path = teamConfigPath(projectDir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as TeamConfig;
  } catch {
    return null;
  }
}

export function saveTeamConfig(projectDir: string, config: TeamConfig): void {
  const path = teamConfigPath(projectDir);
  config.updatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function createTeamConfig(
  projectDir: string,
  opts: {
    projectName: string;
    provider: ProviderType;
    model: string;
    language?: 'fr' | 'en';
    autoCommit?: boolean;
    ownerName?: string;
    ownerEmail?: string;
  }
): TeamConfig {
  const config: TeamConfig = {
    version: 1,
    projectName: opts.projectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provider: opts.provider,
    model: opts.model,
    language: opts.language ?? 'fr',
    autoCommit: opts.autoCommit ?? true,
    dryRun: false,
    members: opts.ownerName
      ? [{ name: opts.ownerName, email: opts.ownerEmail ?? '', role: 'owner', joinedAt: new Date().toISOString() }]
      : [],
    hooks: {},
    export: {},
  };
  saveTeamConfig(projectDir, config);
  return config;
}

// ─── Members ──────────────────────────────────────────────────────────────────

export function addMember(
  projectDir: string,
  member: Omit<TeamMember, 'joinedAt'>
): TeamConfig | null {
  const config = loadTeamConfig(projectDir);
  if (!config) return null;
  if (config.members.some(m => m.email === member.email)) return config; // already in team
  config.members.push({ ...member, joinedAt: new Date().toISOString() });
  saveTeamConfig(projectDir, config);
  return config;
}

export function removeMember(projectDir: string, email: string): TeamConfig | null {
  const config = loadTeamConfig(projectDir);
  if (!config) return null;
  config.members = config.members.filter(m => m.email !== email);
  saveTeamConfig(projectDir, config);
  return config;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export async function runWebhook(
  webhook: string,
  payload: {
    step: string;
    projectName: string;
    timestamp: string;
    data?: unknown;
  }
): Promise<{ ok: boolean; status?: number }> {
  try {
    // Use dynamic import to avoid bundling issues
    const { default: https } = await import('https');
    const { default: http } = await import('http');
    const body = JSON.stringify(payload);
    const url = new URL(webhook);
    const lib = url.protocol === 'https:' ? https : http;

    return new Promise((resolve) => {
      const req = lib.request(
        { hostname: url.hostname, port: url.port, path: url.pathname + url.search,
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res) => resolve({ ok: (res.statusCode ?? 0) < 400, status: res.statusCode })
      );
      req.on('error', () => resolve({ ok: false }));
      req.setTimeout(5000, () => { req.destroy(); resolve({ ok: false }); });
      req.write(body);
      req.end();
    });
  } catch {
    return { ok: false };
  }
}

// ─── Display ──────────────────────────────────────────────────────────────────

export function formatTeamConfig(config: TeamConfig): string {
  const lines: string[] = [
    `  Projet   : ${config.projectName}`,
    `  Provider : ${config.provider} / ${config.model}`,
    `  Langue   : ${config.language}`,
    `  AutoGit  : ${config.autoCommit ? '✅ activé' : '❌ désactivé'}`,
  ];

  if (config.members.length > 0) {
    lines.push('', '  Équipe :');
    for (const m of config.members) {
      lines.push(`    • ${m.name} <${m.email}> [${m.role}]`);
    }
  }

  if (config.hooks.webhook) {
    lines.push('', `  Webhook : ${config.hooks.webhook}`);
  }

  if (config.export.jira) {
    lines.push(`  Jira    : ${config.export.jira.baseUrl} — projet ${config.export.jira.project}`);
  }

  if (config.export.linear) {
    lines.push(`  Linear  : team ${config.export.linear.teamId}`);
  }

  return lines.join('\n');
}
