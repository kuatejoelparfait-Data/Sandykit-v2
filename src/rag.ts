import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodeChunk {
  path: string;
  content: string;
  tokens: number;
}

export interface RAGContext {
  chunks: CodeChunk[];
  totalTokens: number;
  summary: string;
}

// ─── Fichiers à indexer ───────────────────────────────────────────────────────

const INCLUDE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.cs', '.rb', '.php',
  '.json', '.yaml', '.yml', '.toml', '.env.example',
  '.md', '.sql', '.graphql', '.prisma',
]);

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  '.sandykit', 'coverage', '.turbo', 'out', '.cache', 'venv', '.venv',
]);

const EXCLUDE_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
]);

const MAX_FILE_SIZE = 50_000; // 50KB max par fichier
const MAX_TOTAL_TOKENS = 8_000; // Budget token pour le contexte RAG
const APPROX_CHARS_PER_TOKEN = 4;
const MAX_FILES = 300; // Limite de fichiers pour éviter de scanner des dossiers énormes

// ─── Collecte des fichiers ────────────────────────────────────────────────────

function collectFiles(dir: string, rootDir: string, results: string[] = []): string[] {
  if (results.length >= MAX_FILES) return results;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (results.length >= MAX_FILES) break;
    if (EXCLUDE_DIRS.has(entry) || EXCLUDE_FILES.has(entry)) continue;
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        collectFiles(fullPath, rootDir, results);
      } else if (stat.isFile() && stat.size < MAX_FILE_SIZE) {
        const ext = extname(entry).toLowerCase();
        if (INCLUDE_EXTENSIONS.has(ext) || entry === '.env.example') {
          results.push(fullPath);
        }
      }
    } catch { /* ignore */ }
  }

  return results;
}

// ─── TF-IDF simplifié pour pertinence ────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function tfScore(doc: string[], query: string[]): number {
  const docSet = new Set(doc);
  const querySet = new Set(query);
  let hits = 0;
  for (const term of querySet) {
    if (docSet.has(term)) hits++;
  }
  return hits / Math.max(querySet.size, 1);
}

// ─── Index du codebase ───────────────────────────────────────────────────────

export interface CodebaseIndex {
  chunks: Array<{ path: string; content: string; tokens: string[] }>;
  rootDir: string;
  fileCount: number;
}

export function indexCodebase(projectDir: string): CodebaseIndex {
  const files = collectFiles(projectDir, projectDir);
  const chunks: CodebaseIndex['chunks'] = [];

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const relativePath = relative(projectDir, filePath);
      chunks.push({
        path: relativePath,
        content,
        tokens: tokenize(content + ' ' + relativePath),
      });
    } catch { /* ignore */ }
  }

  return { chunks, rootDir: projectDir, fileCount: chunks.length };
}

// ─── Recherche des chunks pertinents ─────────────────────────────────────────

export function findRelevantChunks(
  index: CodebaseIndex,
  query: string,
  maxTokens = MAX_TOTAL_TOKENS
): CodeChunk[] {
  if (index.chunks.length === 0) return [];

  const queryTokens = tokenize(query);
  const scored = index.chunks
    .map(chunk => ({
      path: chunk.path,
      content: chunk.content,
      score: tfScore(chunk.tokens, queryTokens),
      tokens: Math.ceil(chunk.content.length / APPROX_CHARS_PER_TOKEN),
    }))
    .filter(c => c.score > 0 || isPriorityFile(c.path))
    .sort((a, b) => b.score - a.score);

  // Sélectionner les chunks jusqu'à la limite de tokens
  const selected: CodeChunk[] = [];
  let totalTokens = 0;

  // Toujours inclure les fichiers prioritaires
  for (const chunk of scored.filter(c => isPriorityFile(c.path))) {
    if (totalTokens + chunk.tokens > maxTokens) break;
    selected.push({ path: chunk.path, content: chunk.content, tokens: chunk.tokens });
    totalTokens += chunk.tokens;
  }

  // Puis les fichiers pertinents par score
  for (const chunk of scored.filter(c => !isPriorityFile(c.path))) {
    if (totalTokens + chunk.tokens > maxTokens) break;
    selected.push({ path: chunk.path, content: chunk.content, tokens: chunk.tokens });
    totalTokens += chunk.tokens;
  }

  return selected;
}

function isPriorityFile(path: string): boolean {
  const name = path.split(/[/\\]/).pop()?.toLowerCase() ?? '';
  return (
    name === 'package.json' ||
    name === 'tsconfig.json' ||
    name === 'pyproject.toml' ||
    name === 'go.mod' ||
    name === 'cargo.toml' ||
    name === 'prisma.schema' ||
    name === 'schema.prisma' ||
    name === 'docker-compose.yml' ||
    name === '.env.example' ||
    name === 'readme.md'
  );
}

// ─── Formatage du contexte pour le prompt ────────────────────────────────────

export function buildRAGContext(
  projectDir: string,
  query: string,
  maxTokens = MAX_TOTAL_TOKENS
): RAGContext {
  if (!existsSync(projectDir)) {
    return { chunks: [], totalTokens: 0, summary: 'Projet vide' };
  }

  const index = indexCodebase(projectDir);
  if (index.fileCount === 0) {
    return { chunks: [], totalTokens: 0, summary: 'Aucun fichier source trouvé' };
  }

  const chunks = findRelevantChunks(index, query, maxTokens);
  const totalTokens = chunks.reduce((s, c) => s + c.tokens, 0);
  const summary = `${index.fileCount} fichiers indexés, ${chunks.length} pertinents sélectionnés (~${totalTokens} tokens)`;

  return { chunks, totalTokens, summary };
}

export function formatRAGContextForPrompt(context: RAGContext): string {
  if (context.chunks.length === 0) return '';

  const lines = [
    '## Contexte du projet existant',
    '',
    '_Les fichiers suivants représentent la base de code existante. Respecte les conventions, l\'architecture et les patterns déjà en place. Réutilise les utilities existantes au lieu d\'en créer de nouveaux._',
    '',
  ];

  for (const chunk of context.chunks) {
    const ext = chunk.path.split('.').pop() ?? '';
    lines.push(`### ${chunk.path}`);
    lines.push('```' + ext);
    // Tronquer les gros fichiers à 100 lignes
    const contentLines = chunk.content.split('\n');
    if (contentLines.length > 100) {
      lines.push(contentLines.slice(0, 100).join('\n'));
      lines.push(`// ... (${contentLines.length - 100} lignes supplémentaires)`);
    } else {
      lines.push(chunk.content);
    }
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}
