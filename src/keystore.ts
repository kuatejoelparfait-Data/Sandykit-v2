/**
 * Stockage sécurisé des clés API.
 * Priorité : env var → keytar (OS keychain) → fichier local .sandykit/keys (fallback)
 * Jamais de clés en clair dans config.json ou sandykit.team.json.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SERVICE = 'sandykit';

const ENV_KEYS: Record<string, string> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  custom: 'SANDYKIT_CUSTOM_API_KEY',
};

// ─── Keytar (optionnel — natif OS) ───────────────────────────────────────────

let _keytarChecked = false;
let _keytarInstance: typeof import('keytar') | null = null;

async function getKeytar(): Promise<typeof import('keytar') | null> {
  if (_keytarChecked) return _keytarInstance;
  _keytarChecked = true;

  try {
    const mod = await import('keytar');
    // Vérifier que les méthodes sont bien des fonctions (Node.js v24 compat)
    if (typeof mod?.setPassword !== 'function' || typeof mod?.findPassword !== 'function') {
      _keytarInstance = null;
      return null;
    }
    // Test rapide pour valider que le module natif fonctionne réellement
    await mod.findPassword('__sandykit_probe__');
    _keytarInstance = mod;
  } catch {
    _keytarInstance = null;
  }

  return _keytarInstance;
}

// ─── Fallback : fichier local .sandykit/keys ──────────────────────────────────
// Encodage base64 simple — pas du chiffrement, mais évite le texte en clair évident
// Ce fichier doit être dans .gitignore

function keysFilePath(): string {
  return join(process.cwd(), '.sandykit', 'keys');
}

function readLocalKeys(): Record<string, string> {
  const path = keysFilePath();
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, 'utf-8').trim();
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    return {};
  }
}

function writeLocalKeys(keys: Record<string, string>): void {
  const dir = join(process.cwd(), '.sandykit');
  mkdirSync(dir, { recursive: true });
  const encoded = Buffer.from(JSON.stringify(keys)).toString('base64');
  writeFileSync(keysFilePath(), encoded, { encoding: 'utf-8', mode: 0o600 });

  // S'assurer que .gitignore exclut .sandykit/keys
  ensureGitignore();
}

function ensureGitignore(): void {
  const gitignorePath = join(process.cwd(), '.gitignore');
  const entry = '.sandykit/keys';
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(entry)) {
      writeFileSync(gitignorePath, content.trimEnd() + `\n${entry}\n`, 'utf-8');
    }
  } else {
    writeFileSync(gitignorePath, `${entry}\n`, 'utf-8');
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────

export async function storeApiKey(provider: string, key: string): Promise<void> {
  // 1. Essayer keytar (OS keychain)
  const keytar = await getKeytar();
  if (keytar) {
    try {
      await keytar.setPassword(SERVICE, provider, key);
      return;
    } catch {
      // keytar indisponible en pratique → fallback
    }
  }

  // 2. Fallback : fichier local
  const keys = readLocalKeys();
  keys[provider] = key;
  writeLocalKeys(keys);
}

export async function getApiKey(provider: string): Promise<string | null> {
  // 1. Variable d'environnement (prioritaire)
  const envKey = ENV_KEYS[provider];
  if (envKey && process.env[envKey]) return process.env[envKey]!;

  // 2. Keytar (OS keychain)
  const keytar = await getKeytar();
  if (keytar) {
    try {
      const val = await keytar.getPassword(SERVICE, provider);
      if (val) return val;
    } catch {
      // ignore — fallback
    }
  }

  // 3. Fichier local
  const keys = readLocalKeys();
  return keys[provider] ?? null;
}

export async function deleteApiKey(provider: string): Promise<void> {
  const keytar = await getKeytar();
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE, provider);
    } catch {
      // ignore
    }
  }

  // Supprimer aussi du fichier local
  const keys = readLocalKeys();
  if (keys[provider]) {
    delete keys[provider];
    writeLocalKeys(keys);
  }
}

export async function hasApiKey(provider: string): Promise<boolean> {
  return (await getApiKey(provider)) !== null;
}

export async function keystoreBackend(): Promise<'keychain' | 'file' | 'env'> {
  const keytar = await getKeytar();
  return keytar ? 'keychain' : 'file';
}
