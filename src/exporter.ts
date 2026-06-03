import type { TeamConfig } from './team.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedTask {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  labels: string[];
}

export interface ExportResult {
  platform: 'jira' | 'linear';
  created: number;
  failed: number;
  links: string[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse a tasks markdown into structured tasks.
 * Supports both "### Tâche N: Title" and "- [ ] Title" formats.
 */
export function parseTasks(tasksMarkdown: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = tasksMarkdown.split('\n');

  let currentTask: ParsedTask | null = null;
  let descLines: string[] = [];

  const flush = () => {
    if (currentTask) {
      currentTask.description = descLines.join('\n').trim();
      tasks.push(currentTask);
      currentTask = null;
      descLines = [];
    }
  };

  for (const line of lines) {
    // Match "### Tâche N: Title" or "### Task N: Title"
    const headerMatch = line.match(/^#{1,4}\s+(?:Tâche|Task|TASK|TÂCHE)\s*\d*\s*[:\-–]?\s*(.+)/i);
    if (headerMatch) {
      flush();
      currentTask = {
        title: headerMatch[1].trim(),
        description: '',
        priority: detectPriority(line),
        labels: detectLabels(line),
      };
      continue;
    }

    // Match "- [ ] Title" or "* [ ] Title"
    const checkboxMatch = line.match(/^[\-\*]\s+\[[ x]\]\s+(.+)/i);
    if (checkboxMatch && !currentTask) {
      flush();
      currentTask = {
        title: checkboxMatch[1].trim(),
        description: '',
        priority: detectPriority(line),
        labels: detectLabels(line),
      };
      flush(); // checkbox tasks are one-liners
      continue;
    }

    if (currentTask) {
      descLines.push(line);
    }
  }

  flush();
  return tasks;
}

function detectPriority(text: string): ParsedTask['priority'] {
  const lower = text.toLowerCase();
  if (lower.includes('critique') || lower.includes('urgent') || lower.includes('critical') || lower.includes('p0') || lower.includes('p1')) return 'high';
  if (lower.includes('important') || lower.includes('p2')) return 'medium';
  return 'low';
}

function detectLabels(text: string): string[] {
  const labels: string[] = [];
  if (/auth|sécurité|security/i.test(text)) labels.push('security');
  if (/api|endpoint|route/i.test(text)) labels.push('api');
  if (/ui|frontend|composant|component/i.test(text)) labels.push('frontend');
  if (/db|base de données|database|migration/i.test(text)) labels.push('database');
  if (/test|spec/i.test(text)) labels.push('testing');
  if (/deploy|ci|cd|infra/i.test(text)) labels.push('infra');
  return labels.length > 0 ? labels : ['feature'];
}

// ─── Jira ─────────────────────────────────────────────────────────────────────

async function createJiraIssue(
  baseUrl: string,
  project: string,
  token: string,
  task: ParsedTask
): Promise<{ key: string } | null> {
  const { default: https } = await import('https');
  const { default: http } = await import('http');

  const payload = JSON.stringify({
    fields: {
      project: { key: project },
      summary: task.title,
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: task.description || task.title }] }],
      },
      issuetype: { name: 'Story' },
      priority: { name: task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Medium' : 'Low' },
      labels: task.labels,
    },
  });

  const url = new URL(`${baseUrl}/rest/api/3/issue`);
  const auth = Buffer.from(`user:${token}`).toString('base64');
  const lib = url.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.key ? { key: parsed.key } : null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

export async function exportToJira(
  tasks: ParsedTask[],
  config: NonNullable<TeamConfig['export']['jira']>
): Promise<ExportResult> {
  const token = process.env.JIRA_API_TOKEN ?? '';
  if (!token) throw new Error('JIRA_API_TOKEN env var not set');

  const result: ExportResult = { platform: 'jira', created: 0, failed: 0, links: [] };

  for (const task of tasks) {
    const issue = await createJiraIssue(config.baseUrl, config.project, token, task);
    if (issue) {
      result.created++;
      result.links.push(`${config.baseUrl}/browse/${issue.key}`);
    } else {
      result.failed++;
    }
  }

  return result;
}

// ─── Linear ───────────────────────────────────────────────────────────────────

async function createLinearIssue(
  teamId: string,
  token: string,
  task: ParsedTask
): Promise<{ id: string; url: string } | null> {
  const { default: https } = await import('https');

  const priorityMap: Record<ParsedTask['priority'], number> = { high: 1, medium: 2, low: 3 };

  const query = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id url }
      }
    }
  `;

  const variables = {
    input: {
      teamId,
      title: task.title,
      description: task.description || task.title,
      priority: priorityMap[task.priority],
      labelNames: task.labels,
    },
  };

  const payload = JSON.stringify({ query, variables });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.linear.app',
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const issue = parsed?.data?.issueCreate?.issue;
            resolve(issue ?? null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

export async function exportToLinear(
  tasks: ParsedTask[],
  config: NonNullable<TeamConfig['export']['linear']>
): Promise<ExportResult> {
  const token = process.env.LINEAR_API_TOKEN ?? '';
  if (!token) throw new Error('LINEAR_API_TOKEN env var not set');

  const result: ExportResult = { platform: 'linear', created: 0, failed: 0, links: [] };

  for (const task of tasks) {
    const issue = await createLinearIssue(config.teamId, token, task);
    if (issue) {
      result.created++;
      result.links.push(issue.url);
    } else {
      result.failed++;
    }
  }

  return result;
}
