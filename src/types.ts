export type Integration = 'claude' | 'cursor' | 'copilot' | 'codex' | 'antigravity';

export interface SandykitConfig {
  projectName: string;
  integrations: Integration[];
  createdAt: string;
  provider?: import('./providers.js').ProviderConfig;
}

export interface FeatureStatus {
  id: string;
  name: string;
  hasSpec: boolean;
  hasPlan: boolean;
  hasTasks: boolean;
  hasImplement: boolean;
  hasReview: boolean;
}
