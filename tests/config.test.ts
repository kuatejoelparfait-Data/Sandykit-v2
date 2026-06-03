import { describe, it, expect } from 'vitest';
import { loadConfig, saveConfig } from '../src/config.js';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const testDir = join(tmpdir(), 'sandykit-test-' + Date.now());

describe('Config', () => {
  it('saves and loads config', () => {
    saveConfig({ projectName: 'test', integrations: ['claude'] }, testDir);
    const cfg = loadConfig(testDir);
    expect(cfg!.projectName).toBe('test');
    expect(cfg!.integrations).toContain('claude');
  });

  it('returns null when no config exists', () => {
    const cfg = loadConfig('/nonexistent/path');
    expect(cfg).toBeNull();
  });
});
