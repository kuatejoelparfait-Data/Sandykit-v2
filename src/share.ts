import https from 'https';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShareArtifact = 'spec' | 'plan' | 'tasks' | 'all';

export interface ShareResult {
  url: string;
  rawUrl: string;
  id: string;
  platform: 'gist';
  files: string[];
}

// ─── GitHub Gist ──────────────────────────────────────────────────────────────

interface GistFile {
  content: string;
}

async function createGist(
  files: Record<string, GistFile>,
  description: string,
  token?: string
): Promise<{ id: string; html_url: string; files: Record<string, { raw_url: string }> } | null> {
  const payload = JSON.stringify({
    description,
    public: false, // secret gist by default
    files,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'sandykit-cli',
    'Content-Length': String(Buffer.byteLength(payload)),
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: '/gists',
        method: 'POST',
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.id && parsed.html_url) {
              resolve(parsed);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(15_000, () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface ShareOptions {
  artifact: ShareArtifact;
  featureDir: string;
  featureName: string;
  token?: string;
}

const ARTIFACT_FILES: Record<Exclude<ShareArtifact, 'all'>, string> = {
  spec:  'spec.md',
  plan:  'plan.md',
  tasks: 'tasks.md',
};

export async function shareFeature(opts: ShareOptions): Promise<ShareResult> {
  const { artifact, featureDir, featureName, token } = opts;

  // Collect files to share
  const toShare: Record<string, string> = {};

  if (artifact === 'all') {
    for (const [key, filename] of Object.entries(ARTIFACT_FILES)) {
      const filePath = join(featureDir, filename);
      if (existsSync(filePath)) {
        toShare[`sandykit-${featureName}-${filename}`] = readFileSync(filePath, 'utf-8');
      }
    }
  } else {
    const filename = ARTIFACT_FILES[artifact];
    const filePath = join(featureDir, filename);
    if (!existsSync(filePath)) {
      throw new Error(`${filename} introuvable dans ${featureDir}`);
    }
    toShare[`sandykit-${featureName}-${filename}`] = readFileSync(filePath, 'utf-8');
  }

  if (Object.keys(toShare).length === 0) {
    throw new Error('Aucun fichier à partager trouvé dans ce feature');
  }

  const gistFiles: Record<string, GistFile> = {};
  for (const [name, content] of Object.entries(toShare)) {
    gistFiles[name] = { content };
  }

  const description = `[SANDYKIT] ${featureName} — ${artifact === 'all' ? 'spec + plan + tasks' : artifact}`;
  const gist = await createGist(gistFiles, description, token);

  if (!gist) {
    throw new Error('Impossible de créer le gist GitHub. Vérifie ta connexion ou ton GITHUB_TOKEN.');
  }

  const fileNames = Object.keys(toShare);
  const firstRaw = gist.files[fileNames[0]]?.raw_url ?? gist.html_url;

  return {
    url: gist.html_url,
    rawUrl: firstRaw,
    id: gist.id,
    platform: 'gist',
    files: fileNames,
  };
}

// ─── Find feature dir from specs/ ────────────────────────────────────────────

export function findFeatureDir(projectDir: string, featureName: string): string | null {
  const specsDir = join(projectDir, 'specs');
  if (!existsSync(specsDir)) return null;

  const entries: string[] = readdirSync(specsDir);

  // Exact match first
  const exact = entries.find(e => e === featureName);
  if (exact) return join(specsDir, exact);

  // Partial match (slug)
  const slug = featureName.toLowerCase().replace(/\s+/g, '-');
  const partial = entries.find(e => e.toLowerCase().includes(slug));
  if (partial) return join(specsDir, partial);

  return null;
}
