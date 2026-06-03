import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import * as p from '@clack/prompts';
import chalk from 'chalk';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileAction = 'create' | 'modify' | 'skip';

export interface ParsedFile {
  relativePath: string;
  content: string;
  action: FileAction;
  existingContent?: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface DiffWriteResult {
  written: string[];
  skipped: string[];
  totalFiles: number;
}

// ─── Parser : extrait les fichiers du markdown généré ────────────────────────

export function parseGeneratedFiles(markdown: string, projectDir: string): ParsedFile[] {
  const files: ParsedFile[] = [];

  // Supporte les formats :
  // ## Fichier: chemin/relatif.ext
  // ```[lang]
  // contenu
  // ```
  const blockRegex = /##\s+Fichier\s*:\s*(.+?)\s*\n```(?:\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(markdown)) !== null) {
    const relativePath = match[1].trim();
    const content = match[2];
    const fullPath = join(projectDir, relativePath);
    const exists = existsSync(fullPath);

    let existingContent: string | undefined;
    let linesAdded = 0;
    let linesRemoved = 0;

    if (exists) {
      existingContent = readFileSync(fullPath, 'utf-8');
      const oldLines = existingContent.split('\n');
      const newLines = content.split('\n');
      linesAdded = newLines.filter(l => !oldLines.includes(l)).length;
      linesRemoved = oldLines.filter(l => !newLines.includes(l)).length;
    } else {
      linesAdded = content.split('\n').length;
    }

    files.push({
      relativePath,
      content,
      action: exists ? 'modify' : 'create',
      existingContent,
      linesAdded,
      linesRemoved,
    });
  }

  return files;
}

// ─── Affichage du résumé des changements ─────────────────────────────────────

export function printDiffSummary(files: ParsedFile[]): void {
  const creates = files.filter(f => f.action === 'create');
  const modifies = files.filter(f => f.action === 'modify');

  console.log(chalk.bold('\n  Fichiers à créer / modifier :\n'));

  for (const f of creates) {
    console.log(
      `  ${chalk.green('+')} ${chalk.white(f.relativePath.padEnd(50))} ` +
      chalk.green(`+${f.linesAdded} lignes`)
    );
  }

  for (const f of modifies) {
    const changes = [
      f.linesAdded > 0 ? chalk.green(`+${f.linesAdded}`) : '',
      f.linesRemoved > 0 ? chalk.red(`-${f.linesRemoved}`) : '',
    ].filter(Boolean).join(' ');
    console.log(
      `  ${chalk.yellow('~')} ${chalk.white(f.relativePath.padEnd(50))} ` + changes
    );
  }

  console.log('');
  console.log(
    chalk.dim(`  ${creates.length} nouveau(x)  •  ${modifies.length} modifié(s)  •  ${files.length} fichier(s) total`)
  );
  console.log('');
}

// ─── Affichage d'un diff inline simplifié ────────────────────────────────────

function printInlineDiff(file: ParsedFile): void {
  if (!file.existingContent) return;

  const oldLines = file.existingContent.split('\n');
  const newLines = file.content.split('\n');

  console.log(chalk.bold(`\n  diff — ${file.relativePath}\n`));

  // Simplified unified diff: show removed lines (red) and added lines (green)
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let shown = 0;
  const MAX_LINES = 40;

  for (const line of newLines) {
    if (shown >= MAX_LINES) { console.log(chalk.dim('  ... (diff tronqué)')); break; }
    if (!oldSet.has(line)) {
      console.log(chalk.green(`  + ${line}`));
      shown++;
    }
  }
  for (const line of oldLines) {
    if (shown >= MAX_LINES) break;
    if (!newSet.has(line)) {
      console.log(chalk.red(`  - ${line}`));
      shown++;
    }
  }

  console.log('');
}

// ─── Flow interactif principal ────────────────────────────────────────────────

export async function interactiveDiffWrite(
  files: ParsedFile[],
  projectDir: string,
  skipConfirm = false
): Promise<DiffWriteResult> {
  const result: DiffWriteResult = { written: [], skipped: [], totalFiles: files.length };

  if (files.length === 0) return result;

  printDiffSummary(files);

  if (skipConfirm) {
    // Mode non-interactif : tout écrire
    writeFiles(files, projectDir, result);
    return result;
  }

  const choice = await p.select({
    message: 'Appliquer les changements ?',
    options: [
      { value: 'all',    label: '✓  Appliquer tous les fichiers' },
      { value: 'review', label: '👁  Revoir fichier par fichier' },
      { value: 'diff',   label: '📄  Voir le diff complet d\'abord' },
      { value: 'skip',   label: '✗  Annuler — ne rien écrire' },
    ],
  });

  if (p.isCancel(choice) || choice === 'skip') {
    result.skipped = files.map(f => f.relativePath);
    return result;
  }

  if (choice === 'diff') {
    for (const f of files.filter(f => f.action === 'modify')) {
      printInlineDiff(f);
    }
    // Reproposer après le diff
    const confirm = await p.confirm({ message: 'Appliquer maintenant ?', initialValue: true });
    if (p.isCancel(confirm) || !confirm) {
      result.skipped = files.map(f => f.relativePath);
      return result;
    }
    writeFiles(files, projectDir, result);
    return result;
  }

  if (choice === 'review') {
    // Fichier par fichier
    for (const file of files) {
      const action = file.action === 'create'
        ? chalk.green('NOUVEAU')
        : chalk.yellow('MODIFICATION');

      console.log(`\n  ${action} — ${chalk.bold(file.relativePath)}`);
      console.log(chalk.dim(`  ${file.content.split('\n').length} lignes`));

      if (file.action === 'modify') {
        printInlineDiff(file);
      } else {
        // Aperçu des 15 premières lignes
        const preview = file.content.split('\n').slice(0, 15).join('\n');
        console.log(chalk.dim(preview));
        if (file.content.split('\n').length > 15) console.log(chalk.dim('  ...'));
        console.log('');
      }

      const fileChoice = await p.select({
        message: `${file.relativePath} — que faire ?`,
        options: [
          { value: 'write', label: '✓  Écrire ce fichier' },
          { value: 'skip',  label: '○  Ignorer ce fichier' },
        ],
      });

      if (!p.isCancel(fileChoice) && fileChoice === 'write') {
        writeSingleFile(file, projectDir);
        result.written.push(file.relativePath);
      } else {
        result.skipped.push(file.relativePath);
      }
    }
    return result;
  }

  // 'all' → tout écrire
  writeFiles(files, projectDir, result);
  return result;
}

// ─── Écriture effective ───────────────────────────────────────────────────────

function writeSingleFile(file: ParsedFile, projectDir: string): void {
  const fullPath = join(projectDir, file.relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, file.content, 'utf-8');
}

function writeFiles(files: ParsedFile[], projectDir: string, result: DiffWriteResult): void {
  for (const file of files) {
    try {
      writeSingleFile(file, projectDir);
      result.written.push(file.relativePath);
    } catch (err: any) {
      console.error(chalk.red(`  ✗ Erreur écriture ${file.relativePath}: ${err.message}`));
      result.skipped.push(file.relativePath);
    }
  }
}
