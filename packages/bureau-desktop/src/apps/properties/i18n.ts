import { makeT } from '../../core/i18n';

export const messages = {
  fr: {
    title: 'Propriétés système',
    ok: 'OK',
    system: 'Système',
    systemValue: 'jchable Bureau 0.3 (édition « presque stable »)',
    user: 'Utilisateur',
    userValue: 'visiteur, aimablement enregistré nulle part',
    processor: 'Processeur',
    processorValue: 'un cerveau, avec un peu de café',
    memory: 'Mémoire',
    memoryValue: '640 Ko (ça devrait suffire à tout le monde)',
    screen: 'Écran',
    screenValue: '{width} × {height} pixels',
    status: 'Statut',
    statusValue: 'Tout va bien. Probablement.',
  },
  en: {
    title: 'System Properties',
    ok: 'OK',
    system: 'System',
    systemValue: 'jchable Bureau 0.3 ("almost stable" edition)',
    user: 'User',
    userValue: 'visitor, kindly registered nowhere',
    processor: 'Processor',
    processorValue: 'one brain, with a little coffee',
    memory: 'Memory',
    memoryValue: '640 KB (should be enough for anybody)',
    screen: 'Display',
    screenValue: '{width} × {height} pixels',
    status: 'Status',
    statusValue: 'All good. Probably.',
  },
};

export const t = makeT(messages);
