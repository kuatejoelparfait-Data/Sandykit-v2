import type { ProviderType } from './providers.js';

// Prix en USD pour 1M tokens (mai 2026)
const PRICING: Record<string, { input: number; output: number }> = {
  // Claude
  'claude-sonnet-4-6':          { input: 3.00,  output: 15.00 },
  'claude-opus-4-7':            { input: 15.00, output: 75.00 },
  'claude-haiku-4-5-20251001':  { input: 0.80,  output: 4.00  },
  // OpenAI
  'gpt-4o':                     { input: 2.50,  output: 10.00 },
  'gpt-4-turbo':                { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo':              { input: 0.50,  output: 1.50  },
  // Ollama / custom = gratuit
  '__local__':                  { input: 0,     output: 0     },
};

export interface CostEstimate {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedUSD: number;
  breakdown: Array<{ step: string; tokens: number; usd: number }>;
}

// Estimation grossière : 1 token ≈ 4 chars en anglais, 3.5 en français
function countTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

// Estimation par étape basée sur des runs réels
const STEP_OUTPUT_TOKENS: Record<string, number> = {
  spec:       1_200,
  plan:       1_500,
  tasks:      1_000,
  implement:  8_000,
  tests:      4_000,
};

export function estimateCost(
  model: string,
  providerType: ProviderType,
  inputText: string
): CostEstimate {
  const pricing = PRICING[model] ?? (providerType === 'ollama' || providerType === 'custom'
    ? PRICING['__local__']
    : PRICING['gpt-4o']); // fallback

  const baseInputTokens = countTokens(inputText);
  const breakdown: CostEstimate['breakdown'] = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (const [step, outputTk] of Object.entries(STEP_OUTPUT_TOKENS)) {
    // Chaque étape reçoit en entrée le texte précédent + prompt système
    const inputTk = baseInputTokens + (step === 'spec' ? 0 : totalOutput);
    const usd = ((inputTk * pricing.input) + (outputTk * pricing.output)) / 1_000_000;
    breakdown.push({ step, tokens: inputTk + outputTk, usd });
    totalInput += inputTk;
    totalOutput += outputTk;
  }

  const estimatedUSD = breakdown.reduce((sum, b) => sum + b.usd, 0);

  return { model, inputTokens: totalInput, outputTokens: totalOutput, estimatedUSD, breakdown };
}

export function formatCostEstimate(est: CostEstimate): string {
  const lines: string[] = [
    `  Modèle : ${est.model}`,
    `  Coût estimé : ${est.estimatedUSD < 0.01 ? '< $0.01' : `$${est.estimatedUSD.toFixed(3)}`}`,
    '',
    '  Détail par étape :',
    ...est.breakdown.map(b =>
      `    ${b.step.padEnd(12)} ~${b.tokens.toLocaleString()} tokens   ${b.usd < 0.001 ? '< $0.001' : `$${b.usd.toFixed(3)}`}`
    ),
  ];
  return lines.join('\n');
}
