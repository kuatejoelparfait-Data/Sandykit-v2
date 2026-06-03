import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createTeamConfig, loadTeamConfig, saveTeamConfig, hasTeamConfig,
  addMember, removeMember, formatTeamConfig
} from '../src/team.js';

const TMP_DIR = join(tmpdir(), '__sandykit_team_test__');

function cleanup(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

describe('team', () => {
  beforeEach(() => { cleanup(TMP_DIR); mkdirSync(TMP_DIR, { recursive: true }); });
  afterEach(() => cleanup(TMP_DIR));

  describe('createTeamConfig()', () => {
    it('creates sandykit.team.json', () => {
      createTeamConfig(TMP_DIR, {
        projectName: 'MonApp',
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        ownerName: 'Alice',
        ownerEmail: 'alice@test.com',
      });
      expect(hasTeamConfig(TMP_DIR)).toBe(true);
    });

    it('sets correct defaults', () => {
      const cfg = createTeamConfig(TMP_DIR, {
        projectName: 'Proj',
        provider: 'openai',
        model: 'gpt-4o',
      });
      expect(cfg.version).toBe(1);
      expect(cfg.autoCommit).toBe(true);
      expect(cfg.dryRun).toBe(false);
      expect(cfg.language).toBe('fr');
    });

    it('adds owner as member when name provided', () => {
      const cfg = createTeamConfig(TMP_DIR, {
        projectName: 'Proj',
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        ownerName: 'Bob',
        ownerEmail: 'bob@test.com',
      });
      expect(cfg.members).toHaveLength(1);
      expect(cfg.members[0].role).toBe('owner');
      expect(cfg.members[0].email).toBe('bob@test.com');
    });
  });

  describe('loadTeamConfig()', () => {
    it('returns null when file does not exist', () => {
      expect(loadTeamConfig(TMP_DIR)).toBeNull();
    });

    it('round-trips correctly', () => {
      createTeamConfig(TMP_DIR, { projectName: 'P', provider: 'ollama', model: 'mistral' });
      const loaded = loadTeamConfig(TMP_DIR);
      expect(loaded?.projectName).toBe('P');
      expect(loaded?.provider).toBe('ollama');
    });
  });

  describe('addMember()', () => {
    it('adds a new member', () => {
      createTeamConfig(TMP_DIR, { projectName: 'P', provider: 'claude', model: 'claude-sonnet-4-6' });
      const updated = addMember(TMP_DIR, { name: 'Carol', email: 'carol@test.com', role: 'contributor' });
      expect(updated?.members).toHaveLength(1);
      expect(updated?.members[0].email).toBe('carol@test.com');
    });

    it('does not duplicate existing member', () => {
      createTeamConfig(TMP_DIR, { projectName: 'P', provider: 'claude', model: 'claude-sonnet-4-6', ownerName: 'Alice', ownerEmail: 'alice@test.com' });
      addMember(TMP_DIR, { name: 'Alice', email: 'alice@test.com', role: 'contributor' });
      const cfg = loadTeamConfig(TMP_DIR);
      expect(cfg?.members).toHaveLength(1);
    });

    it('returns null when no config exists', () => {
      expect(addMember(TMP_DIR, { name: 'X', email: 'x@x.com', role: 'contributor' })).toBeNull();
    });
  });

  describe('removeMember()', () => {
    it('removes a member by email', () => {
      createTeamConfig(TMP_DIR, { projectName: 'P', provider: 'claude', model: 'claude-sonnet-4-6', ownerName: 'Alice', ownerEmail: 'alice@test.com' });
      const updated = removeMember(TMP_DIR, 'alice@test.com');
      expect(updated?.members).toHaveLength(0);
    });
  });

  describe('formatTeamConfig()', () => {
    it('includes project name and provider', () => {
      const cfg = createTeamConfig(TMP_DIR, { projectName: 'SuperApp', provider: 'claude', model: 'claude-sonnet-4-6' });
      const output = formatTeamConfig(cfg);
      expect(output).toContain('SuperApp');
      expect(output).toContain('claude');
    });

    it('shows webhook when set', () => {
      const cfg = createTeamConfig(TMP_DIR, { projectName: 'P', provider: 'claude', model: 'claude-sonnet-4-6' });
      cfg.hooks.webhook = 'https://hooks.slack.com/test';
      const output = formatTeamConfig(cfg);
      expect(output).toContain('https://hooks.slack.com/test');
    });
  });
});
