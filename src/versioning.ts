import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';

export type ArtifactType = 'spec' | 'plan' | 'tasks' | 'implement' | 'review';

interface VersionMeta {
  version: number;
  savedAt: string;
  note?: string;
}

interface Changelog {
  artifact: ArtifactType;
  versions: VersionMeta[];
}

// ─── Sauvegarde versionnée ────────────────────────────────────────────────────

export function saveVersioned(
  featureDir: string,
  artifact: ArtifactType,
  content: string,
  note?: string
): number {
  const versionsDir = join(featureDir, '.versions', artifact);
  mkdirSync(versionsDir, { recursive: true });

  // Numéro de version suivant
  const existing = existsSync(versionsDir)
    ? readdirSync(versionsDir).filter(f => f.match(/^v\d+\.md$/)).map(f => parseInt(f.slice(1)))
    : [];
  const nextVersion = existing.length > 0 ? Math.max(...existing) + 1 : 1;

  // Sauvegarde versionnée
  writeFileSync(join(versionsDir, `v${nextVersion}.md`), content, 'utf-8');

  // Mise à jour du fichier courant
  writeFileSync(join(featureDir, `${artifact}.md`), content, 'utf-8');

  // Changelog
  updateChangelog(featureDir, artifact, nextVersion, note);

  return nextVersion;
}

export function loadLatestVersion(featureDir: string, artifact: ArtifactType): string | null {
  const versionsDir = join(featureDir, '.versions', artifact);
  if (!existsSync(versionsDir)) {
    // Fallback sur le fichier courant
    const current = join(featureDir, `${artifact}.md`);
    return existsSync(current) ? readFileSync(current, 'utf-8') : null;
  }
  const versions = readdirSync(versionsDir)
    .filter(f => f.match(/^v\d+\.md$/))
    .map(f => parseInt(f.slice(1)))
    .sort((a, b) => b - a);
  if (versions.length === 0) return null;
  return readFileSync(join(versionsDir, `v${versions[0]}.md`), 'utf-8');
}

export function listVersions(featureDir: string, artifact: ArtifactType): VersionMeta[] {
  const changelog = loadChangelog(featureDir, artifact);
  return changelog?.versions ?? [];
}

export function getVersion(featureDir: string, artifact: ArtifactType, version: number): string | null {
  const path = join(featureDir, '.versions', artifact, `v${version}.md`);
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
}

// ─── Changelog ────────────────────────────────────────────────────────────────

function changelogPath(featureDir: string, artifact: ArtifactType): string {
  return join(featureDir, '.versions', artifact, 'changelog.json');
}

function loadChangelog(featureDir: string, artifact: ArtifactType): Changelog | null {
  const path = changelogPath(featureDir, artifact);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function updateChangelog(featureDir: string, artifact: ArtifactType, version: number, note?: string): void {
  const path = changelogPath(featureDir, artifact);
  const existing = loadChangelog(featureDir, artifact) ?? { artifact, versions: [] };
  existing.versions.push({ version, savedAt: new Date().toISOString(), note });
  writeFileSync(path, JSON.stringify(existing, null, 2), 'utf-8');
}

// ─── Diff simple ─────────────────────────────────────────────────────────────

export function summarizeDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n').length;
  const newLines = newContent.split('\n').length;
  const delta = newLines - oldLines;
  const sign = delta >= 0 ? '+' : '';
  return `${oldLines} → ${newLines} lignes (${sign}${delta})`;
}
