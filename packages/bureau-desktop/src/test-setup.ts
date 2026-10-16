import { beforeEach } from 'vitest';
import { setLang } from './core/i18n';

// Les tests existants vérifient les textes français : chaque test repart en français.
beforeEach(() => setLang('fr'));
