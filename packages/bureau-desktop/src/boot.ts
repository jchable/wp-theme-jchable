// Démarrage du bureau. Chargé par main.ts comme un module à part : le code partagé avec les applis
// (traductions, préférences…) vit donc dans des modules communs, évalués une seule fois.
import { bootstrap } from './core/desktop';

function start(): void {
  // Garde : même si ce fichier était chargé deux fois (cache, extension), le bureau ne démarre qu'une fois.
  if (document.documentElement.dataset['bureauStarted']) return;
  document.documentElement.dataset['bureauStarted'] = '1';
  bootstrap();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
