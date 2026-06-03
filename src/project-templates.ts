export interface ProjectTemplate {
  id: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'data-ai' | 'tools' | 'custom';
  label: string;
  hint: string;
  stackHint: string;
  specPromptBoost: string;
  planPromptBoost: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [

  // ── FRONTEND ──────────────────────────────────────────────────────────────
  {
    id: 'react-app',
    category: 'frontend',
    label: 'Web App React / Next.js',
    hint: 'Dashboard, interface utilisateur, SPA',
    stackHint: 'Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, React Query, Zustand',
    specPromptBoost: 'Inclure : pages et layouts, composants UI, gestion d\'état, appels API, routing, responsive design.',
    planPromptBoost: 'Architecture frontend : App Router, Server Components, Client Components, API routes, optimisation images, SEO.',
  },
  {
    id: 'saas-web',
    category: 'fullstack',
    label: 'SaaS Web App',
    hint: 'Next.js + Auth + Stripe + DB',
    stackHint: 'Next.js 14 App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, NextAuth, Stripe',
    specPromptBoost: 'Inclure : gestion des plans/abonnements, onboarding utilisateur, dashboard, rôles admin/user.',
    planPromptBoost: 'Architecture SaaS : multi-tenant, rate limiting, webhooks Stripe, emails transactionnels (Resend), middleware auth.',
  },
  {
    id: 'landing-page',
    category: 'frontend',
    label: 'Landing Page / Vitrine',
    hint: 'Marketing, portfolio, site corporate',
    stackHint: 'Next.js, TypeScript, Tailwind CSS, Framer Motion, Resend (formulaire contact), Vercel',
    specPromptBoost: 'Inclure : sections hero, features, pricing, testimonials, FAQ, formulaire de contact, CTA.',
    planPromptBoost: 'Architecture statique : SSG, optimisation Core Web Vitals, animations scroll, meta tags SEO, sitemap, robots.txt.',
  },

  // ── BACKEND ───────────────────────────────────────────────────────────────
  {
    id: 'api-rest',
    category: 'backend',
    label: 'API REST',
    hint: 'Node.js/Fastify + JWT + OpenAPI',
    stackHint: 'Node.js, TypeScript, Fastify, Prisma, PostgreSQL, Zod, JWT, Swagger/OpenAPI',
    specPromptBoost: 'Inclure : endpoints CRUD, authentification JWT, pagination, filtres, gestion des erreurs standardisée (RFC 7807).',
    planPromptBoost: 'Architecture API : versioning (/api/v1), middleware chain, validation Zod, documentation OpenAPI auto-générée, tests d\'intégration.',
  },
  {
    id: 'api-graphql',
    category: 'backend',
    label: 'API GraphQL',
    hint: 'Apollo Server + subscriptions + ORM',
    stackHint: 'Node.js, TypeScript, Apollo Server 4, Pothos (schema builder), Prisma, PostgreSQL, Redis (subscriptions)',
    specPromptBoost: 'Inclure : queries, mutations, subscriptions, authentification par contexte, pagination cursor-based, gestion des erreurs.',
    planPromptBoost: 'Architecture GraphQL : schema-first avec Pothos, DataLoader pour N+1, persisted queries, subscriptions via Redis PubSub.',
  },
  {
    id: 'microservice',
    category: 'backend',
    label: 'Microservice',
    hint: 'Service isolé, worker, queue (BullMQ)',
    stackHint: 'Node.js, TypeScript, Fastify, BullMQ, Redis, PostgreSQL, Docker, OpenTelemetry',
    specPromptBoost: 'Inclure : responsabilité unique du service, interface API ou événements consommés/produits, health check, métriques.',
    planPromptBoost: 'Architecture microservice : worker BullMQ, dead-letter queue, retry strategy, logs structurés (Pino), healthcheck endpoint, Dockerfile.',
  },

  // ── FULLSTACK ─────────────────────────────────────────────────────────────
  {
    id: 'fullstack-monorepo',
    category: 'fullstack',
    label: 'Fullstack Monorepo',
    hint: 'Turborepo + web + mobile + packages partagés',
    stackHint: 'Turborepo, Next.js (web), React Native/Expo (mobile), shared UI package, TypeScript, tRPC, Prisma',
    specPromptBoost: 'Inclure : apps web et mobile partageant le même backend, composants UI partagés, types partagés.',
    planPromptBoost: 'Structure monorepo Turborepo : apps/web, apps/mobile, packages/ui, packages/db, packages/config. tRPC pour type-safety end-to-end.',
  },

  // ── MOBILE ────────────────────────────────────────────────────────────────
  {
    id: 'mobile-rn',
    category: 'mobile',
    label: 'App Mobile',
    hint: 'React Native + Expo + navigation',
    stackHint: 'React Native, Expo SDK 51, TypeScript, Expo Router, Zustand, React Query, NativeWind',
    specPromptBoost: 'Inclure : navigation (tabs + stack), gestion offline, notifications push, stockage local sécurisé.',
    planPromptBoost: 'Architecture mobile : Expo Router pour la navigation, Zustand pour le state, React Query pour les données, AsyncStorage chiffré.',
  },

  // ── DATA & IA ─────────────────────────────────────────────────────────────
  {
    id: 'ai-agent',
    category: 'data-ai',
    label: 'Agent IA / App LLM',
    hint: 'Chatbot, RAG, embeddings, LangChain',
    stackHint: 'Python 3.11, FastAPI, LangChain ou LlamaIndex, OpenAI/Anthropic, pgvector, PostgreSQL, Redis',
    specPromptBoost: 'Inclure : pipeline RAG (ingest, chunk, embed, retrieve), interface conversationnelle, gestion du contexte, streaming.',
    planPromptBoost: 'Architecture LLM : ingestion de documents → embeddings pgvector → retrieval TF-IDF/cosine → génération avec contexte, streaming SSE.',
  },
  {
    id: 'data-pipeline',
    category: 'data-ai',
    label: 'Pipeline Data / ML',
    hint: 'Python + FastAPI + ML + PostgreSQL',
    stackHint: 'Python 3.11, FastAPI, SQLAlchemy, PostgreSQL, Celery, Redis, pandas, scikit-learn ou PyTorch',
    specPromptBoost: 'Inclure : ingestion de données, transformations, entraînement/inférence de modèle, API d\'exposition, monitoring.',
    planPromptBoost: 'Architecture data : worker Celery pour tâches asynchrones, stockage S3/local, modèle versionné (MLflow), API FastAPI avec OpenAPI.',
  },

  // ── OUTILS ────────────────────────────────────────────────────────────────
  {
    id: 'cli-tool',
    category: 'tools',
    label: 'Outil CLI',
    hint: 'Node.js + Commander + distribution npm',
    stackHint: 'Node.js, TypeScript, Commander.js, @clack/prompts, chalk, esbuild, vitest',
    specPromptBoost: 'Inclure : commandes principales, options/flags, fichier de config utilisateur, messages d\'aide clairs.',
    planPromptBoost: 'Architecture CLI : entry point unique, sous-commandes, config via ~/.config ou .rc, publication npm avec bin field.',
  },
  {
    id: 'vscode-ext',
    category: 'tools',
    label: 'Extension VS Code',
    hint: 'Commands, TreeView, webview, Language Server',
    stackHint: 'TypeScript, VS Code Extension API, vsce, esbuild, vitest',
    specPromptBoost: 'Inclure : commandes enregistrées, activation events, TreeView providers, webview panels, settings contributes.',
    planPromptBoost: 'Architecture extension : manifest contributes, activation lazy, bundling esbuild, tests avec @vscode/test-electron.',
  },

  // ── CUSTOM ────────────────────────────────────────────────────────────────
  {
    id: 'custom',
    category: 'custom',
    label: 'Projet personnalise',
    hint: 'L\'IA choisit la stack selon ta description',
    stackHint: '',
    specPromptBoost: '',
    planPromptBoost: '',
  },
];

export function getTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: ProjectTemplate['category']): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter(t => t.category === category);
}
