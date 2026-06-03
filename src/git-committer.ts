import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export type CommitStep = 'spec' | 'plan' | 'tasks' | 'implement' | 'tests';

const COMMIT_MESSAGES: Record<CommitStep, (feature: string) => string> = {
  spec:      (f) => `docs(${f}): add functional specification`,
  plan:      (f) => `docs(${f}): add technical implementation plan`,
  tasks:     (f) => `docs(${f}): add granular task breakdown`,
  implement: (f) => `feat(${f}): generate initial implementation`,
  tests:     (f) => `test(${f}): add generated test suite`,
};

export interface GitCommitResult {
  success: boolean;
  sha?: string;
  message: string;
  skipped?: boolean;
}

/**
 * Returns true if the projectDir is inside a git repo.
 */
export function isGitRepo(projectDir: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--git-dir'], {
    cwd: projectDir,
    encoding: 'utf-8',
  });
  return result.status === 0;
}

/**
 * Stage all changes in projectDir and commit them with a conventional commit message.
 */
export async function autoCommit(
  projectDir: string,
  step: CommitStep,
  featureName: string,
  extra?: string
): Promise<GitCommitResult> {
  if (!isGitRepo(projectDir)) {
    return { success: false, skipped: true, message: 'Not a git repository — skipping auto-commit' };
  }

  const msg = COMMIT_MESSAGES[step](featureName) + (extra ? `\n\n${extra}` : '');

  // Stage all changes
  const addResult = spawnSync('git', ['add', '.'], {
    cwd: projectDir,
    encoding: 'utf-8',
  });

  if (addResult.status !== 0) {
    return { success: false, message: `git add failed: ${addResult.stderr}` };
  }

  // Check if there's anything to commit
  const statusResult = spawnSync('git', ['status', '--porcelain'], {
    cwd: projectDir,
    encoding: 'utf-8',
  });

  if (!statusResult.stdout.trim()) {
    return { success: true, skipped: true, message: 'Nothing to commit' };
  }

  // Commit
  const commitResult = spawnSync('git', ['commit', '-m', msg, '--no-gpg-sign'], {
    cwd: projectDir,
    encoding: 'utf-8',
  });

  if (commitResult.status !== 0) {
    return { success: false, message: `git commit failed: ${commitResult.stderr}` };
  }

  // Get SHA
  const shaResult = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: projectDir,
    encoding: 'utf-8',
  });

  const sha = shaResult.stdout.trim();
  return { success: true, sha, message: msg.split('\n')[0] };
}

/**
 * Initialize a git repo in projectDir if none exists.
 */
export function initGitRepo(projectDir: string): boolean {
  if (isGitRepo(projectDir)) return true;

  const result = spawnSync('git', ['init'], {
    cwd: projectDir,
    encoding: 'utf-8',
  });

  if (result.status === 0) {
    // Create initial commit if there are files
    const statusResult = spawnSync('git', ['status', '--porcelain'], {
      cwd: projectDir,
      encoding: 'utf-8',
    });

    if (statusResult.stdout.trim()) {
      spawnSync('git', ['add', '.'], { cwd: projectDir, encoding: 'utf-8' });
      spawnSync('git', ['commit', '-m', 'chore: initial project setup', '--no-gpg-sign'], {
        cwd: projectDir,
        encoding: 'utf-8',
      });
    }

    return true;
  }

  return false;
}

/**
 * Get a summary of the last N commits in projectDir.
 */
export function getRecentCommits(projectDir: string, n = 5): string[] {
  if (!isGitRepo(projectDir)) return [];

  const result = spawnSync('git', ['log', `--oneline`, `-${n}`], {
    cwd: projectDir,
    encoding: 'utf-8',
  });

  if (result.status !== 0) return [];
  return result.stdout.trim().split('\n').filter(Boolean);
}
