// Point d'entrée du bureau : charge le style et démarre le bureau quand la page est prête.
import './styles/desktop.css';
import { bootstrap } from './core/desktop';

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bootstrap(), { once: true });
else bootstrap();
