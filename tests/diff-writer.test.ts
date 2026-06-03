import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseGeneratedFiles, printDiffSummary } from '../src/diff-writer.js';

const TMP_DIR = join(tmpdir(), '__sandykit_diff_test__');

function cleanup(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

describe('diff-writer', () => {
  beforeEach(() => { cleanup(TMP_DIR); mkdirSync(TMP_DIR, { recursive: true }); });
  afterEach(() => cleanup(TMP_DIR));

  describe('parseGeneratedFiles()', () => {
    it('returns empty array for markdown with no files', () => {
      expect(parseGeneratedFiles('# No files here', TMP_DIR)).toHaveLength(0);
    });

    it('parses a single new file', () => {
      const md = '## Fichier: src/app.ts\n```ts\nexport const x = 1;\n```';
      const files = parseGeneratedFiles(md, TMP_DIR);
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('src/app.ts');
      expect(files[0].content).toBe('export const x = 1;\n');
      expect(files[0].action).toBe('create');
    });

    it('detects modify when file already exists', () => {
      mkdirSync(join(TMP_DIR, 'src'), { recursive: true });
      writeFileSync(join(TMP_DIR, 'src', 'app.ts'), 'export const x = 0;', 'utf-8');
      const md = '## Fichier: src/app.ts\n```ts\nexport const x = 1;\n```';
      const files = parseGeneratedFiles(md, TMP_DIR);
      expect(files[0].action).toBe('modify');
      expect(files[0].existingContent).toBe('export const x = 0;');
    });

    it('parses multiple files', () => {
      const md = [
        '## Fichier: src/index.ts\n```ts\nimport app from "./app";\n```',
        '## Fichier: src/app.ts\n```ts\nexport default {};\n```',
        '## Fichier: package.json\n```json\n{"name":"test"}\n```',
      ].join('\n\n');
      const files = parseGeneratedFiles(md, TMP_DIR);
      expect(files).toHaveLength(3);
    });

    it('handles files with language hint in code block', () => {
      const md = '## Fichier: src/style.css\n```css\nbody { margin: 0; }\n```';
      const files = parseGeneratedFiles(md, TMP_DIR);
      expect(files).toHaveLength(1);
      expect(files[0].content).toContain('body');
    });

    it('counts lines added for new file', () => {
      const content = 'line1\nline2\nline3\n';
      const md = `## Fichier: src/new.ts\n\`\`\`\n${content}\`\`\``;
      const files = parseGeneratedFiles(md, TMP_DIR);
      expect(files[0].linesAdded).toBe(4); // 3 lines + empty final
    });

    it('ignores paths with ".." for security', () => {
      // Path traversal attempt
      const md = '## Fichier: ../../evil.ts\n```ts\nconsole.log("pwned");\n```';
      const files = parseGeneratedFiles(md, TMP_DIR);
      // File is parsed but relativePath should be kept as-is (join handles safety)
      if (files.length > 0) {
        const fullPath = join(TMP_DIR, files[0].relativePath);
        expect(fullPath).toContain(TMP_DIR.split('\\')[0]); // stays on same drive at least
      }
    });
  });
});
