import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { indexCodebase, findRelevantChunks, buildRAGContext, formatRAGContextForPrompt } from '../src/rag.js';

const TMP_DIR = join(tmpdir(), '__sandykit_rag_test__');

function cleanup(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function writeFile(dir: string, path: string, content: string): void {
  const full = join(dir, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content, 'utf-8');
}

describe('rag', () => {
  beforeEach(() => { cleanup(TMP_DIR); mkdirSync(TMP_DIR, { recursive: true }); });
  afterEach(() => cleanup(TMP_DIR));

  describe('indexCodebase()', () => {
    it('returns empty index for empty directory', () => {
      const index = indexCodebase(TMP_DIR);
      expect(index.fileCount).toBe(0);
      expect(index.chunks).toHaveLength(0);
    });

    it('indexes TypeScript files', () => {
      writeFile(TMP_DIR, 'src/auth.ts', 'export function login() { return true; }');
      writeFile(TMP_DIR, 'src/user.ts', 'export interface User { id: string; email: string; }');
      const index = indexCodebase(TMP_DIR);
      expect(index.fileCount).toBe(2);
    });

    it('excludes node_modules', () => {
      writeFile(TMP_DIR, 'src/app.ts', 'const x = 1;');
      writeFile(TMP_DIR, 'node_modules/lib/index.js', 'module.exports = {};');
      const index = indexCodebase(TMP_DIR);
      expect(index.fileCount).toBe(1);
      expect(index.chunks.every(c => !c.path.includes('node_modules'))).toBe(true);
    });

    it('excludes dist and .git directories', () => {
      writeFile(TMP_DIR, 'src/app.ts', 'const x = 1;');
      writeFile(TMP_DIR, 'dist/app.js', 'var x = 1;');
      writeFile(TMP_DIR, '.git/HEAD', 'ref: refs/heads/main');
      const index = indexCodebase(TMP_DIR);
      expect(index.chunks.every(c => !c.path.includes('dist') && !c.path.includes('.git'))).toBe(true);
    });

    it('always includes package.json as priority file', () => {
      writeFile(TMP_DIR, 'package.json', '{"name":"test","version":"1.0.0"}');
      writeFile(TMP_DIR, 'src/other.ts', 'export const x = 1;');
      const index = indexCodebase(TMP_DIR);
      const hasPackage = index.chunks.some(c => c.path.includes('package.json'));
      expect(hasPackage).toBe(true);
    });
  });

  describe('findRelevantChunks()', () => {
    it('returns empty for empty index', () => {
      const index = { chunks: [], rootDir: TMP_DIR, fileCount: 0 };
      expect(findRelevantChunks(index, 'authentication')).toHaveLength(0);
    });

    it('ranks files by query relevance', () => {
      writeFile(TMP_DIR, 'src/auth.ts', 'export function login(email: string, password: string) { authenticate(email, password); }');
      writeFile(TMP_DIR, 'src/dashboard.ts', 'export function renderDashboard() { return charts; }');
      const index = indexCodebase(TMP_DIR);
      const chunks = findRelevantChunks(index, 'login authentication email password');
      expect(chunks.length).toBeGreaterThan(0);
      // auth.ts should score higher than dashboard.ts for this query
      if (chunks.length >= 2) {
        expect(chunks[0].path).toContain('auth');
      }
    });

    it('respects token budget', () => {
      for (let i = 0; i < 20; i++) {
        writeFile(TMP_DIR, `src/file${i}.ts`, 'x'.repeat(2000)); // ~500 tokens each
      }
      const index = indexCodebase(TMP_DIR);
      const chunks = findRelevantChunks(index, 'x', 2000); // Budget 2000 tokens
      const totalTokens = chunks.reduce((s, c) => s + c.tokens, 0);
      expect(totalTokens).toBeLessThanOrEqual(2200); // Small margin
    });
  });

  describe('buildRAGContext()', () => {
    it('returns empty context for non-existent directory', () => {
      const ctx = buildRAGContext('/non/existent/path', 'query');
      expect(ctx.chunks).toHaveLength(0);
      expect(ctx.totalTokens).toBe(0);
    });

    it('returns context with relevant files', () => {
      writeFile(TMP_DIR, 'src/payments.ts', 'export function processPayment(amount: number) { stripe.charge(amount); }');
      writeFile(TMP_DIR, 'package.json', '{"name":"shop","version":"1.0.0"}');
      const ctx = buildRAGContext(TMP_DIR, 'stripe payment processing');
      expect(ctx.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('formatRAGContextForPrompt()', () => {
    it('returns empty string for empty context', () => {
      expect(formatRAGContextForPrompt({ chunks: [], totalTokens: 0, summary: '' })).toBe('');
    });

    it('includes file paths and content', () => {
      const ctx = {
        chunks: [{ path: 'src/auth.ts', content: 'export function login() {}', tokens: 10 }],
        totalTokens: 10,
        summary: '1 file',
      };
      const result = formatRAGContextForPrompt(ctx);
      expect(result).toContain('src/auth.ts');
      expect(result).toContain('export function login');
      expect(result).toContain('Contexte du projet existant');
    });
  });
});
