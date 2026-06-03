import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { findFeatureDir } from '../src/share.js';

const TMP_DIR = join(tmpdir(), '__sandykit_share_test__');

function cleanup(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function createFeature(specsDir: string, name: string, files: string[]): void {
  const dir = join(specsDir, name);
  mkdirSync(dir, { recursive: true });
  files.forEach(f => writeFileSync(join(dir, f), `# ${f}`, 'utf-8'));
}

describe('share', () => {
  beforeEach(() => { cleanup(TMP_DIR); mkdirSync(TMP_DIR, { recursive: true }); });
  afterEach(() => cleanup(TMP_DIR));

  describe('findFeatureDir()', () => {
    it('returns null when specs/ does not exist', () => {
      expect(findFeatureDir(TMP_DIR, 'anything')).toBeNull();
    });

    it('finds feature by exact name', () => {
      const specsDir = join(TMP_DIR, 'specs');
      createFeature(specsDir, '001-my-app', ['spec.md']);
      const result = findFeatureDir(TMP_DIR, '001-my-app');
      expect(result).toBeTruthy();
      expect(result).toContain('001-my-app');
    });

    it('finds feature by partial name slug', () => {
      const specsDir = join(TMP_DIR, 'specs');
      createFeature(specsDir, '001-my-app', ['spec.md']);
      const result = findFeatureDir(TMP_DIR, 'my-app');
      expect(result).toBeTruthy();
      expect(result).toContain('001-my-app');
    });

    it('returns null when feature not found', () => {
      const specsDir = join(TMP_DIR, 'specs');
      createFeature(specsDir, '001-my-app', ['spec.md']);
      expect(findFeatureDir(TMP_DIR, 'non-existent')).toBeNull();
    });

    it('finds feature by case-insensitive slug', () => {
      const specsDir = join(TMP_DIR, 'specs');
      createFeature(specsDir, '001-SuperApp', ['spec.md']);
      const result = findFeatureDir(TMP_DIR, 'superapp');
      expect(result).toBeTruthy();
    });
  });
});
