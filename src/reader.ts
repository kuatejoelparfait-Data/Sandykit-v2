import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';

export type SupportedFormat = '.txt' | '.md' | '.pdf' | '.docx';

export async function readCahierDesCharges(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`Fichier non trouvé : ${filePath}`);
  }

  const ext = extname(filePath).toLowerCase() as SupportedFormat;

  switch (ext) {
    case '.txt':
    case '.md':
      return readFileSync(filePath, 'utf-8');

    case '.pdf': {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }

    case '.docx': {
      const mammoth = await import('mammoth');
      const buffer = readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    default:
      throw new Error(`Format non supporté : ${ext}. Formats acceptés : .txt, .md, .pdf, .docx`);
  }
}

export function detectFormat(filePath: string): SupportedFormat | null {
  const ext = extname(filePath).toLowerCase();
  if (['.txt', '.md', '.pdf', '.docx'].includes(ext)) return ext as SupportedFormat;
  return null;
}
