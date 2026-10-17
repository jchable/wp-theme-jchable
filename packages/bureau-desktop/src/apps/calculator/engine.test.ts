import { describe, expect, it } from 'vitest';
import { formatNumber, hasMemory, initialState, localizeDisplay, reduce, type Action, type CalcState } from './engine';

/** Raccourci de test : une chaîne de touches devient une suite d'actions. */
const KEY: Record<string, Action> = {
  '.': { type: 'decimal' },
  '+': { type: 'op', op: '+' },
  '-': { type: 'op', op: '-' },
  '*': { type: 'op', op: '*' },
  '/': { type: 'op', op: '/' },
  '=': { type: 'equals' },
  n: { type: 'negate' },
  '%': { type: 'percent' },
  r: { type: 'sqrt' },
  i: { type: 'reciprocal' },
  C: { type: 'clear' },
  E: { type: 'clearEntry' },
  '<': { type: 'backspace' },
};
const MEM: Record<string, Action> = {
  A: { type: 'memory', op: 'MC' },
  B: { type: 'memory', op: 'MR' },
  S: { type: 'memory', op: 'MS' },
  P: { type: 'memory', op: 'M+' },
};

function press(keys: string, from: CalcState = initialState()): CalcState {
  let state = from;
  for (const key of keys) {
    const action: Action | undefined = /\d/.test(key) ? { type: 'digit', digit: Number(key) } : (KEY[key] ?? MEM[key]);
    if (!action) throw new Error(`touche inconnue : ${key}`);
    state = reduce(state, action);
  }
  return state;
}
const shows = (keys: string): string => press(keys).display;

describe('état initial', () => {
  it('affiche 0, sans erreur ni mémoire', () => {
    const s = initialState();
    expect(s.display).toBe('0');
    expect(s.error).toBeNull();
    expect(hasMemory(s)).toBe(false);
  });
});

describe('saisie des chiffres', () => {
  it('saisit des chiffres et remplace le 0 de départ', () => {
    expect(shows('7')).toBe('7');
    expect(shows('123')).toBe('123');
    expect(shows('007')).toBe('7');
    expect(shows('0')).toBe('0');
  });

  it('limite la saisie à 12 chiffres', () => {
    expect(shows('1234567890123456')).toBe('123456789012');
    expect(shows('1.23456789012345')).toBe('1.23456789012');
  });

  it('gère la virgule : un seul séparateur, « 0. » au départ', () => {
    expect(shows('.')).toBe('0.');
    expect(shows('.5')).toBe('0.5');
    expect(shows('1.5.5')).toBe('1.55');
    expect(shows('3.')).toBe('3.');
    expect(shows('0.0')).toBe('0.0');
  });
});

describe('opérations de base', () => {
  it('additionne, soustrait, multiplie, divise', () => {
    expect(shows('2+3=')).toBe('5');
    expect(shows('9-4=')).toBe('5');
    expect(shows('6*7=')).toBe('42');
    expect(shows('8/2=')).toBe('4');
    expect(shows('1/4=')).toBe('0.25');
  });

  it('affiche le résultat intermédiaire quand on enchaîne', () => {
    expect(shows('2+3+')).toBe('5');
    expect(shows('2+3*')).toBe('5');
  });

  it('enchaîne comme une calculatrice simple : pas de priorité des opérateurs', () => {
    expect(shows('2+3*4=')).toBe('20');
    expect(shows('10-2/4=')).toBe('2');
  });

  it("remplace l'opérateur quand on en tape deux de suite", () => {
    expect(shows('5+-3=')).toBe('2');
    expect(shows('5*/2=')).toBe('2.5');
  });

  it('continue avec le résultat après « = »', () => {
    expect(shows('2+3=*4=')).toBe('20');
  });

  it('un nouveau nombre après « = » repart de zéro', () => {
    expect(shows('2+3=7')).toBe('7');
    expect(shows('2+3=7+1=')).toBe('8');
  });
});

describe('répétition de « = »', () => {
  it("répète la dernière opération avec le dernier opérande", () => {
    expect(shows('2+3==')).toBe('8');
    expect(shows('2+3===')).toBe('11');
    expect(shows('10-3==')).toBe('4');
    expect(shows('2*3==')).toBe('18');
  });

  it("« 5 + = » utilise l'affichage comme second opérande", () => {
    expect(shows('5+=')).toBe('10');
    expect(shows('5*=')).toBe('25');
  });

  it('« = » seul ne change rien', () => {
    expect(shows('=')).toBe('0');
    expect(shows('7=')).toBe('7');
  });

  it("une nouvelle opération oublie l'ancienne répétition", () => {
    expect(shows('2+3=*2==')).toBe('20'); // (5 * 2) = 10, puis 10 * 2 = 20
  });
});

describe('changement de signe', () => {
  it('inverse le signe de la saisie', () => {
    expect(shows('5n')).toBe('-5');
    expect(shows('5nn')).toBe('5');
    expect(shows('5n3')).toBe('-53');
  });
  it('0 reste 0', () => {
    expect(shows('n')).toBe('0');
    expect(shows('0n')).toBe('0');
  });
  it("s'applique au résultat affiché", () => {
    expect(shows('2+3=n')).toBe('-5');
    expect(shows('2+3=n+1=')).toBe('-4');
  });
  it('sert aussi pour le second opérande', () => {
    expect(shows('8-3n=')).toBe('11');
  });
});

describe('pourcentage', () => {
  it('« A + B % » ajoute B % de A', () => {
    expect(shows('200+10%')).toBe('20');
    expect(shows('200+10%=')).toBe('220');
    expect(shows('200-10%=')).toBe('180');
  });
  it('« A × B % » donne directement B % de A', () => {
    expect(shows('200*25%')).toBe('50');
    expect(shows('200/50%')).toBe('400');
  });
  it('sans opération en attente, donne 0', () => {
    expect(shows('50%')).toBe('0');
  });
});

describe('racine carrée et inverse', () => {
  it('calcule la racine carrée', () => {
    expect(shows('9r')).toBe('3');
    expect(shows('2r')).toBe('1.41421356237');
    expect(shows('0r')).toBe('0');
    expect(shows('16r+1=')).toBe('5');
  });
  it("la racine d'un négatif est une entrée incorrecte", () => {
    const s = press('4nr');
    expect(s.error).toBe('invalid');
  });
  it("calcule l'inverse", () => {
    expect(shows('4i')).toBe('0.25');
    expect(shows('8i')).toBe('0.125');
    expect(shows('3i')).toBe('0.333333333333');
  });
  it("l'inverse de 0 est une division par zéro", () => {
    expect(press('0i').error).toBe('divZero');
    expect(press('i').error).toBe('divZero');
  });
  it('agit sur le second opérande', () => {
    expect(shows('1+4i=')).toBe('1.25');
  });
});

describe('effacements', () => {
  it('C efface tout, y compris le calcul en attente, mais pas la mémoire', () => {
    const s = press('2+3C');
    expect(s.display).toBe('0');
    expect(press('5SC', initialState()).display).toBe('0');
    expect(hasMemory(press('5SC'))).toBe(true);
    expect(shows('2+3C4=')).toBe('4');
  });
  it("CE n'efface que la saisie en cours", () => {
    expect(shows('2+345E')).toBe('0');
    expect(shows('2+345E6=')).toBe('8');
    expect(shows('12E')).toBe('0');
  });
  it('Retour arrière supprime le dernier caractère saisi', () => {
    expect(shows('123<')).toBe('12');
    expect(shows('12<<')).toBe('0');
    expect(shows('1<<<')).toBe('0');
    expect(shows('1.5<')).toBe('1.');
    expect(shows('1.5<<')).toBe('1');
    expect(shows('5n<')).toBe('0');
  });
  it('Retour arrière ne touche pas un résultat', () => {
    expect(shows('2+3=<')).toBe('5');
  });
});

describe('mémoire', () => {
  it('MS stocke, MR rappelle, MC efface', () => {
    const stored = press('42S');
    expect(hasMemory(stored)).toBe(true);
    expect(press('C7B', stored).display).toBe('42');
    const cleared = press('A', stored);
    expect(hasMemory(cleared)).toBe(false);
    expect(press('B', cleared).display).toBe('0');
  });
  it('M+ ajoute à la mémoire', () => {
    expect(press('5SC3PB').display).toBe('8');
    expect(press('3PB').display).toBe('3');
  });
  it('le rappel peut servir d’opérande', () => {
    expect(shows('6S2*B=')).toBe('12');
    expect(shows('6S2+B+')).toBe('8');
  });
  it('MS de 0 éteint l’indicateur', () => {
    expect(hasMemory(press('0S'))).toBe(false);
  });
  it('un chiffre tapé après MR repart de zéro', () => {
    expect(press('9SC', initialState()).display).toBe('0');
    expect(shows('9SBB3')).toBe('3');
  });
  it('M+ après un calcul garde le résultat', () => {
    const s = press('2+3=P');
    expect(s.display).toBe('5');
    expect(press('B', s).display).toBe('5');
  });
});

describe('précision et grands nombres', () => {
  it('0,1 + 0,2 donne 0,3', () => {
    expect(shows('.1+.2=')).toBe('0.3');
    expect(shows('.3-.1=')).toBe('0.2');
    expect(shows('1.1*1.1=')).toBe('1.21');
  });
  it('arrondit à 12 chiffres significatifs', () => {
    expect(shows('1/3=')).toBe('0.333333333333');
    expect(shows('2/3=')).toBe('0.666666666667');
  });
  it('bascule en notation exponentielle au-delà de 12 chiffres', () => {
    expect(shows('999999999999+1=')).toBe('1e+12');
    expect(shows('999999999999*10=')).toBe('9.99999999999e+12');
    expect(shows('123456789012*1000=')).toBe('1.23456789012e+14');
  });
  it('les très petits nombres passent en exponentielle', () => {
    expect(shows('1/1000000=')).toBe('0.000001');
    expect(shows('1/10000000=')).toBe('1e-7');
  });
  it('un résultat démesuré est une erreur de dépassement', () => {
    let s = press('999999999999');
    for (let k = 0; k < 10; k++) s = press('*999999999999=', s);
    expect(s.error).toBe('overflow');
  });
  it('un résultat exponentiel reste utilisable comme opérande', () => {
    expect(shows('999999999999+1=*2=')).toBe('2e+12');
  });
});

describe('division par zéro et erreurs', () => {
  it('diviser par zéro est une erreur récupérable', () => {
    const s = press('5/0=');
    expect(s.error).toBe('divZero');
  });
  it('0 ÷ 0 est aussi une erreur', () => {
    expect(press('0/0=').error).toBe('divZero');
  });
  it('en erreur, seuls C et CE ramènent un état sain', () => {
    const bad = press('5/0=');
    for (const keys of ['7', '.', '+', '=', 'n', '%', 'r', 'i', '<', 'S', 'P', 'B']) {
      expect(press(keys, bad).error).toBe('divZero');
    }
    expect(press('C', bad)).toEqual(initialState());
    expect(press('E', bad).error).toBeNull();
    expect(press('C7+1=', bad).display).toBe('8');
  });
  it('la mémoire survit à une erreur, MC reste possible', () => {
    const s = press('5S/0=');
    expect(hasMemory(s)).toBe(true);
    expect(hasMemory(press('A', s))).toBe(false);
  });
  it('un résultat final non fini est écarté', () => {
    expect(press('1/0=').error).toBe('divZero');
  });
});

describe('formatNumber', () => {
  it('formate sans zéros inutiles', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(1.5)).toBe('1.5');
    expect(formatNumber(-12.25)).toBe('-12.25');
    expect(formatNumber(100)).toBe('100');
  });
  it('arrondit les erreurs de flottants', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1.0000000000001)).toBe('1');
  });
  it('utilise la notation exponentielle pour les extrêmes', () => {
    expect(formatNumber(1e12)).toBe('1e+12');
    expect(formatNumber(-2.5e20)).toBe('-2.5e+20');
    expect(formatNumber(1e-7)).toBe('1e-7');
  });
});

describe('localizeDisplay', () => {
  it('met une virgule en français et un point en anglais', () => {
    expect(localizeDisplay('1.5', 'fr')).toBe('1,5');
    expect(localizeDisplay('1.5', 'en')).toBe('1.5');
    expect(localizeDisplay('0.', 'fr')).toBe('0,');
    expect(localizeDisplay('1.5e+20', 'fr')).toBe('1,5e+20');
  });
});
