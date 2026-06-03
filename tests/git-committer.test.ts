import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { isGitRepo, initGitRepo, autoCommit, getRecentCommits } from '../src/git-committer.js';

// Use OS temp dir (outside the SANDYKIT repo) to avoid git parent traversal
const TMP_DIR = join(tmpdir(), '__sandykit_git_test__');

function setupGitRepo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  spawnSync('git', ['init'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

function cleanup(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

describe('git-committer', () => {
  beforeEach(() => cleanup(TMP_DIR));
  afterEach(() => cleanup(TMP_DIR));

  describe('isGitRepo()', () => {
    it('returns false for a non-git directory', () => {
      mkdirSync(TMP_DIR, { recursive: true });
      expect(isGitRepo(TMP_DIR)).toBe(false);
    });

    it('returns true after git init', () => {
      setupGitRepo(TMP_DIR);
      expect(isGitRepo(TMP_DIR)).toBe(true);
    });
  });

  describe('initGitRepo()', () => {
    it('creates a git repo in a non-git directory', () => {
      mkdirSync(TMP_DIR, { recursive: true });
      writeFileSync(join(TMP_DIR, 'README.md'), '# Test', 'utf-8');
      const result = initGitRepo(TMP_DIR);
      expect(result).toBe(true);
      expect(isGitRepo(TMP_DIR)).toBe(true);
    });

    it('returns true if repo already exists', () => {
      setupGitRepo(TMP_DIR);
      expect(initGitRepo(TMP_DIR)).toBe(true);
    });
  });

  describe('autoCommit()', () => {
    it('commits successfully with a conventional message', async () => {
      setupGitRepo(TMP_DIR);
      writeFileSync(join(TMP_DIR, 'spec.md'), '# Spec', 'utf-8');
      const result = await autoCommit(TMP_DIR, 'spec', 'my-feature');
      expect(result.success).toBe(true);
      expect(result.skipped).toBeFalsy();
      expect(result.sha).toBeTruthy();
      expect(result.message).toContain('my-feature');
      expect(result.message).toContain('docs(my-feature): add functional specification');
    });

    it('skips commit when nothing to commit', async () => {
      setupGitRepo(TMP_DIR);
      writeFileSync(join(TMP_DIR, 'file.md'), '# A', 'utf-8');
      await autoCommit(TMP_DIR, 'plan', 'proj');
      // Second commit with no changes
      const result = await autoCommit(TMP_DIR, 'plan', 'proj');
      expect(result.skipped).toBe(true);
    });

    it('returns skipped=true for non-git directory', async () => {
      mkdirSync(TMP_DIR, { recursive: true });
      const result = await autoCommit(TMP_DIR, 'spec', 'test');
      expect(result.skipped).toBe(true);
      expect(result.success).toBe(false);
    });

    it('generates correct commit message per step', async () => {
      setupGitRepo(TMP_DIR);
      const steps = ['spec', 'plan', 'tasks', 'implement', 'tests'] as const;
      const expectedPrefixes = ['docs', 'docs', 'docs', 'feat', 'test'];
      for (let i = 0; i < steps.length; i++) {
        writeFileSync(join(TMP_DIR, `${steps[i]}.md`), `# ${steps[i]}`, 'utf-8');
        const result = await autoCommit(TMP_DIR, steps[i], 'proj');
        expect(result.message).toMatch(new RegExp(`^${expectedPrefixes[i]}\\(proj\\):`));
      }
    });
  });

  describe('getRecentCommits()', () => {
    it('returns empty array for non-git directory', () => {
      mkdirSync(TMP_DIR, { recursive: true });
      expect(getRecentCommits(TMP_DIR)).toEqual([]);
    });

    it('returns commits after committing', async () => {
      setupGitRepo(TMP_DIR);
      writeFileSync(join(TMP_DIR, 'a.md'), '# A', 'utf-8');
      await autoCommit(TMP_DIR, 'spec', 'feature');
      const commits = getRecentCommits(TMP_DIR, 5);
      expect(commits.length).toBe(1);
      expect(commits[0]).toContain('feature');
    });
  });
});
