import { describe, it, expect, afterEach } from 'vitest';
import { getFeatureStatus, validatePipelineOrder, getAllFeatureStatuses } from '../src/watcher.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const testDir = join(tmpdir(), 'sandykit-watcher-' + Date.now());

afterEach(() => {
  if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
});

describe('Watcher', () => {
  it('detects feature with only spec', () => {
    const featureDir = join(testDir, 'specs', '001-auth');
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, 'spec.md'), '# Spec', 'utf-8');

    const status = getFeatureStatus(featureDir);
    expect(status.hasSpec).toBe(true);
    expect(status.hasPlan).toBe(false);
    expect(status.hasTasks).toBe(false);
    expect(status.hasReview).toBe(false);
  });

  it('detects all stages when all files present', () => {
    const featureDir = join(testDir, 'specs', '002-dashboard');
    mkdirSync(featureDir, { recursive: true });
    for (const f of ['spec.md', 'plan.md', 'tasks.md', 'review.md']) {
      writeFileSync(join(featureDir, f), `# ${f}`, 'utf-8');
    }
    const status = getFeatureStatus(featureDir);
    expect(status.hasSpec).toBe(true);
    expect(status.hasPlan).toBe(true);
    expect(status.hasTasks).toBe(true);
    expect(status.hasReview).toBe(true);
  });

  it('validates pipeline order — plan without spec returns warning', () => {
    const featureDir = join(testDir, 'specs', '003-test');
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, 'plan.md'), '# Plan', 'utf-8');

    const warning = validatePipelineOrder(featureDir, 'plan.md');
    expect(warning).not.toBeNull();
    expect(warning).toContain('spec.md');
  });

  it('validates pipeline order — tasks without plan returns warning', () => {
    const featureDir = join(testDir, 'specs', '004-test');
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, 'spec.md'), '# Spec', 'utf-8');
    writeFileSync(join(featureDir, 'tasks.md'), '# Tasks', 'utf-8');

    const warning = validatePipelineOrder(featureDir, 'tasks.md');
    expect(warning).not.toBeNull();
    expect(warning).toContain('plan.md');
  });

  it('returns null when pipeline order is correct', () => {
    const featureDir = join(testDir, 'specs', '005-test');
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, 'spec.md'), '# Spec', 'utf-8');
    writeFileSync(join(featureDir, 'plan.md'), '# Plan', 'utf-8');

    const warning = validatePipelineOrder(featureDir, 'plan.md');
    expect(warning).toBeNull();
  });

  it('getAllFeatureStatuses returns sorted list', () => {
    const specsDir = join(testDir, 'specs');
    mkdirSync(join(specsDir, '002-b'), { recursive: true });
    mkdirSync(join(specsDir, '001-a'), { recursive: true });
    writeFileSync(join(specsDir, '001-a', 'spec.md'), '# Spec', 'utf-8');

    const statuses = getAllFeatureStatuses(specsDir);
    expect(statuses.length).toBe(2);
    expect(statuses[0]!.id).toBe('001-a');
    expect(statuses[1]!.id).toBe('002-b');
  });
});
