import { describe, it, expect } from 'vitest';
import { buildStatusDisplay } from '../src/cli.js';
import type { FeatureStatus } from '../src/types.js';

describe('CLI status display', () => {
  it('returns message when no features', () => {
    const output = buildStatusDisplay([]);
    expect(output).toContain('Aucune feature');
  });

  it('shows feature id in output', () => {
    const features: FeatureStatus[] = [
      {
        id: '001-auth',
        name: 'auth',
        hasSpec: true,
        hasPlan: true,
        hasTasks: false,
        hasImplement: false,
        hasReview: false,
      },
    ];
    const output = buildStatusDisplay(features);
    expect(output).toContain('001-auth');
  });

  it('shows completed stages with checkmark', () => {
    const features: FeatureStatus[] = [
      {
        id: '001-auth',
        name: 'auth',
        hasSpec: true,
        hasPlan: false,
        hasTasks: false,
        hasImplement: false,
        hasReview: false,
      },
    ];
    const output = buildStatusDisplay(features);
    expect(output).toContain('spec');
    expect(output).toContain('plan');
  });
});
