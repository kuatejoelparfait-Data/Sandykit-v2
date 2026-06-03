import { describe, it, expect, afterEach } from 'vitest';
import { install, getIntegrationPaths } from '../src/installer.js';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const testDir = join(tmpdir(), 'sandykit-install-' + Date.now());

afterEach(() => {
  if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
});

describe('Installer', () => {
  it('returns correct path for claude integration', () => {
    const paths = getIntegrationPaths('claude', testDir);
    expect(paths.commandsDir).toContain('.claude');
    expect(paths.commandsDir).toContain('commands');
  });

  it('returns correct path for cursor integration', () => {
    const paths = getIntegrationPaths('cursor', testDir);
    expect(paths.commandsDir).toContain('.cursor');
    expect(paths.commandsDir).toContain('rules');
  });

  it('returns correct path for copilot integration', () => {
    const paths = getIntegrationPaths('copilot', testDir);
    expect(paths.commandsDir).toContain('.github');
    expect(paths.commandsDir).toContain('instructions');
  });

  it('installs command files for claude', async () => {
    await install(['claude'], testDir);
    const commands = ['specify', 'clarify', 'plan', 'tasks', 'implement', 'review'];
    for (const cmd of commands) {
      expect(existsSync(join(testDir, '.claude', 'commands', `sandykit.${cmd}.md`))).toBe(true);
    }
  });

  it('installs command files for cursor', async () => {
    await install(['cursor'], testDir);
    expect(existsSync(join(testDir, '.cursor', 'rules', 'sandykit.specify.mdc'))).toBe(true);
  });

  it('installs command files for copilot', async () => {
    await install(['copilot'], testDir);
    expect(existsSync(join(testDir, '.github', 'instructions', 'sandykit.specify.instructions.md'))).toBe(true);
  });

  it('creates specs/ directory', async () => {
    await install(['claude'], testDir);
    expect(existsSync(join(testDir, 'specs'))).toBe(true);
  });
});
