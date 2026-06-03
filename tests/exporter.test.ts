import { describe, it, expect } from 'vitest';
import { parseTasks } from '../src/exporter.js';

describe('exporter', () => {
  describe('parseTasks()', () => {
    it('parses ### Tâche N: format', () => {
      const md = `
### Tâche 1: Créer l'authentification
Implémenter JWT avec refresh tokens.

### Tâche 2: Dashboard utilisateur
Afficher les stats.
      `;
      const tasks = parseTasks(md);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe("Créer l'authentification");
      expect(tasks[1].title).toBe('Dashboard utilisateur');
    });

    it('parses checkbox format', () => {
      const md = `
- [ ] Configurer la base de données
- [ ] Créer les migrations
- [x] Initialiser le projet
      `;
      const tasks = parseTasks(md);
      expect(tasks.length).toBeGreaterThanOrEqual(3);
    });

    it('detects high priority for "critique"', () => {
      const md = '### Tâche 1: Fix critique de sécurité auth\nContenu.';
      const tasks = parseTasks(md);
      expect(tasks[0].priority).toBe('high');
    });

    it('detects medium priority for "important"', () => {
      const md = '### Tâche 1: Feature important\nContenu.';
      const tasks = parseTasks(md);
      expect(tasks[0].priority).toBe('medium');
    });

    it('defaults to low priority', () => {
      const md = '### Tâche 1: Simple refactor\nContenu.';
      const tasks = parseTasks(md);
      expect(tasks[0].priority).toBe('low');
    });

    it('detects labels from keywords', () => {
      const md = '### Tâche 1: Créer endpoint API REST\nContenu.';
      const tasks = parseTasks(md);
      expect(tasks[0].labels).toContain('api');
    });

    it('assigns "feature" label when no keyword matches', () => {
      const md = '### Tâche 1: Ajouter un bouton\nContenu.';
      const tasks = parseTasks(md);
      expect(tasks[0].labels).toContain('feature');
    });

    it('returns empty array for empty input', () => {
      expect(parseTasks('')).toHaveLength(0);
      expect(parseTasks('# Titre sans tâches')).toHaveLength(0);
    });

    it('handles mixed formats', () => {
      const md = `
### Tâche 1: Auth
Description

- [ ] Sous-tâche checkbox
      `;
      const tasks = parseTasks(md);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].title).toBe('Auth');
    });
  });
});
