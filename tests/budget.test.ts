import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  recordUsage, getBudgetStatus, saveBudgetConfig, loadBudgetConfig,
  checkBudget, computeCost
} from '../src/budget.js';

const TMP_DIR = join(tmpdir(), '__sandykit_budget_test__');

function cleanup(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

describe('budget', () => {
  beforeEach(() => { cleanup(TMP_DIR); mkdirSync(TMP_DIR, { recursive: true }); });
  afterEach(() => cleanup(TMP_DIR));

  describe('computeCost()', () => {
    it('computes cost for claude-sonnet-4-6', () => {
      const cost = computeCost('claude-sonnet-4-6', 'claude', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(18.0, 1); // (3.00 + 15.00) = 18.00
    });

    it('returns 0 for ollama (local)', () => {
      expect(computeCost('llama3', 'ollama', 100_000, 100_000)).toBe(0);
    });

    it('uses fallback pricing for unknown model', () => {
      const cost = computeCost('unknown-model', 'openai', 1_000_000, 1_000_000);
      expect(cost).toBeGreaterThan(0); // fallback gpt-4o
    });
  });

  describe('recordUsage()', () => {
    it('creates usage.json on first record', () => {
      recordUsage(TMP_DIR, {
        projectName: 'test', step: 'spec',
        model: 'claude-sonnet-4-6', provider: 'claude',
        inputTokens: 1000, outputTokens: 500,
      });
      expect(existsSync(join(TMP_DIR, '.sandykit', 'usage.json'))).toBe(true);
    });

    it('accumulates multiple entries', () => {
      recordUsage(TMP_DIR, { projectName: 'p', step: 'spec', model: 'claude-sonnet-4-6', provider: 'claude', inputTokens: 100, outputTokens: 50 });
      recordUsage(TMP_DIR, { projectName: 'p', step: 'plan', model: 'claude-sonnet-4-6', provider: 'claude', inputTokens: 200, outputTokens: 100 });
      const status = getBudgetStatus(TMP_DIR);
      expect(status.entries.length).toBe(2);
      expect(status.spentUSD).toBeGreaterThan(0);
    });
  });

  describe('getBudgetStatus()', () => {
    it('returns zero spent when no usage', () => {
      const status = getBudgetStatus(TMP_DIR);
      expect(status.spentUSD).toBe(0);
      expect(status.entries).toHaveLength(0);
      expect(status.limitUSD).toBe(Infinity);
    });

    it('reflects configured budget limit', () => {
      saveBudgetConfig(TMP_DIR, { monthlyLimitUSD: 10, alertAtPercent: 80 });
      const status = getBudgetStatus(TMP_DIR);
      expect(status.limitUSD).toBe(10);
      expect(status.remainingUSD).toBe(10);
    });
  });

  describe('checkBudget()', () => {
    it('allows when no budget configured', () => {
      const result = checkBudget(TMP_DIR, 5.0);
      expect(result.allowed).toBe(true);
    });

    it('allows when under limit', () => {
      saveBudgetConfig(TMP_DIR, { monthlyLimitUSD: 20, alertAtPercent: 80 });
      const result = checkBudget(TMP_DIR, 5.0);
      expect(result.allowed).toBe(true);
    });

    it('blocks when estimated cost exceeds remaining budget', () => {
      saveBudgetConfig(TMP_DIR, { monthlyLimitUSD: 5, alertAtPercent: 80 });
      recordUsage(TMP_DIR, { projectName: 'p', step: 'spec', model: 'claude-sonnet-4-6', provider: 'claude', inputTokens: 300_000, outputTokens: 300_000 });
      const result = checkBudget(TMP_DIR, 10.0); // On demande 10$ mais budget est 5$
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it('signals alert when crossing alert threshold', () => {
      // Budget $10, alerte à 80% = $8
      // Dépenser $6 (60%) avec gpt-4o: 480k tokens input + 480k output
      // (480k × $2.50 + 480k × $10) / 1M = ($1200 + $4800) / 1M = $6
      // Puis demander $2.50 → projeté $8.50 (85%) ≥ 80% → shouldAlert
      saveBudgetConfig(TMP_DIR, { monthlyLimitUSD: 10, alertAtPercent: 80 });
      recordUsage(TMP_DIR, { projectName: 'p', step: 'impl', model: 'gpt-4o', provider: 'openai', inputTokens: 480_000, outputTokens: 480_000 });
      const result = checkBudget(TMP_DIR, 2.5); // $6 + $2.5 = $8.5 (85%) < $10 → allowed, shouldAlert
      expect(result.allowed).toBe(true);
      expect(result.shouldAlert).toBe(true);
    });
  });

  describe('saveBudgetConfig() / loadBudgetConfig()', () => {
    it('round-trips correctly', () => {
      saveBudgetConfig(TMP_DIR, { monthlyLimitUSD: 15, alertAtPercent: 75, webhookUrl: 'https://hooks.slack.com/x' });
      const loaded = loadBudgetConfig(TMP_DIR);
      expect(loaded?.monthlyLimitUSD).toBe(15);
      expect(loaded?.alertAtPercent).toBe(75);
      expect(loaded?.webhookUrl).toBe('https://hooks.slack.com/x');
    });

    it('returns null when no config exists', () => {
      expect(loadBudgetConfig(TMP_DIR)).toBeNull();
    });
  });
});
