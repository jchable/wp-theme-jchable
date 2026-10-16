import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  chord,
  createBoard,
  flagsLeft,
  isWrongFlag,
  neighbors,
  reveal,
  toggleFlag,
  type Board,
} from './board';

/** RNG déterministe (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plateau de test à mines fixes (déjà « placé »). */
function fixed(cols: number, rows: number, mines: number[]): Board {
  const b = createBoard({ cols, rows, mines: mines.length });
  for (const m of mines) b.cells[m]!.mine = true;
  for (let i = 0; i < b.cells.length; i++) {
    b.cells[i]!.adjacent = neighbors(b, i).filter((n) => b.cells[n]!.mine).length;
  }
  b.placed = true;
  b.status = 'playing';
  return b;
}

describe('niveaux', () => {
  it('définit les trois niveaux', () => {
    expect(LEVELS.beginner).toEqual({ cols: 9, rows: 9, mines: 10 });
    expect(LEVELS.intermediate).toEqual({ cols: 16, rows: 16, mines: 40 });
    expect(LEVELS.expert).toEqual({ cols: 30, rows: 16, mines: 99 });
  });
});

describe('neighbors', () => {
  it('compte 8 voisins au centre, 3 dans un coin, 5 sur un bord', () => {
    const b = createBoard(LEVELS.beginner);
    expect(neighbors(b, 4 * 9 + 4)).toHaveLength(8);
    expect(neighbors(b, 0)).toHaveLength(3);
    expect(neighbors(b, 4)).toHaveLength(5);
    expect(neighbors(b, 8 * 9 + 8)).toHaveLength(3);
  });
  it('ne déborde pas d’un bord à l’autre', () => {
    const b = createBoard(LEVELS.beginner);
    expect(neighbors(b, 8).sort((x, y) => x - y)).toEqual([7, 17, 16].sort((x, y) => x - y));
  });
});

describe('premier clic', () => {
  it('place exactement le bon nombre de mines et jamais sous le premier clic (beaucoup de graines)', () => {
    for (const level of Object.values(LEVELS)) {
      for (let seed = 1; seed <= 60; seed++) {
        const b = createBoard(level);
        const start = (seed * 37) % (level.cols * level.rows);
        reveal(b, start, seeded(seed));
        expect(b.cells.filter((c) => c.mine)).toHaveLength(level.mines);
        expect(b.cells[start]!.mine).toBe(false);
        expect(b.status === 'playing' || b.status === 'won').toBe(true);
      }
    }
  });

  it('évite aussi les voisins du premier clic quand la place le permet', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const b = createBoard(LEVELS.beginner);
      const start = 4 * 9 + 4;
      reveal(b, start, seeded(seed));
      for (const n of neighbors(b, start)) expect(b.cells[n]!.mine).toBe(false);
      expect(b.cells[start]!.adjacent).toBe(0);
    }
  });

  it('retombe sur « seulement la case cliquée » quand le plateau est trop dense', () => {
    const b = createBoard({ cols: 3, rows: 3, mines: 8 });
    reveal(b, 4, seeded(3));
    expect(b.cells.filter((c) => c.mine)).toHaveLength(8);
    expect(b.cells[4]!.mine).toBe(false);
  });

  it('est déterministe avec une même graine', () => {
    const a = createBoard(LEVELS.intermediate);
    const b = createBoard(LEVELS.intermediate);
    reveal(a, 5, seeded(42));
    reveal(b, 5, seeded(42));
    expect(a.cells.map((c) => c.mine)).toEqual(b.cells.map((c) => c.mine));
  });

  it('passe en « playing » au premier dévoilement', () => {
    const b = createBoard(LEVELS.beginner);
    expect(b.status).toBe('ready');
    reveal(b, 0, seeded(1));
    expect(['playing', 'won']).toContain(b.status);
  });
});

describe('nombres de mines voisines', () => {
  it('calcule les voisines après placement', () => {
    const b = createBoard(LEVELS.beginner);
    reveal(b, 40, seeded(7));
    b.cells.forEach((c, i) => {
      if (!c.mine) {
        expect(c.adjacent).toBe(neighbors(b, i).filter((n) => b.cells[n]!.mine).length);
      }
    });
  });
});

describe('dévoilement en cascade', () => {
  it('ouvre les zéros et leur bordure numérotée, sans toucher aux mines', () => {
    // mine en coin haut gauche d’une grille 4x4
    const b = fixed(4, 4, [0]);
    const changed = reveal(b, 15, seeded(1));
    expect(b.cells[0]!.revealed).toBe(false);
    expect(b.cells[1]!.revealed).toBe(true);
    expect(b.cells[1]!.adjacent).toBe(1);
    // 15 cases dévoilées + la mine marquée automatiquement à la victoire
    expect(changed).toHaveLength(16);
    expect(b.status).toBe('won');
  });

  it('un chiffre ne se propage pas', () => {
    const b = fixed(4, 4, [0]);
    reveal(b, 1, seeded(1));
    expect(b.cells.filter((c) => c.revealed)).toHaveLength(1);
  });

  it('ignore une case déjà dévoilée', () => {
    const b = fixed(4, 4, [0]);
    reveal(b, 1, seeded(1));
    expect(reveal(b, 1, seeded(1))).toEqual([]);
  });
});

describe('drapeaux', () => {
  it('bascule le drapeau et décompte les mines restantes', () => {
    const b = createBoard(LEVELS.beginner);
    expect(flagsLeft(b)).toBe(10);
    expect(toggleFlag(b, 3)).toBe(true);
    expect(b.cells[3]!.flagged).toBe(true);
    expect(flagsLeft(b)).toBe(9);
    toggleFlag(b, 3);
    expect(b.cells[3]!.flagged).toBe(false);
    expect(flagsLeft(b)).toBe(10);
  });

  it('un drapeau protège la case : pas de dévoilement', () => {
    const b = fixed(4, 4, [0]);
    toggleFlag(b, 0);
    expect(reveal(b, 0, seeded(1))).toEqual([]);
    expect(b.status).toBe('playing');
    expect(b.cells[0]!.revealed).toBe(false);
  });

  it('la cascade saute les cases marquées', () => {
    const b = fixed(4, 4, [0]);
    toggleFlag(b, 14);
    reveal(b, 15, seeded(1));
    expect(b.cells[14]!.revealed).toBe(false);
    expect(b.cells[14]!.flagged).toBe(true);
  });

  it('on ne marque pas une case dévoilée', () => {
    const b = fixed(4, 4, [0]);
    reveal(b, 1, seeded(1));
    expect(toggleFlag(b, 1)).toBe(false);
    expect(b.cells[1]!.flagged).toBe(false);
  });

  it('on peut poser un drapeau avant le premier clic sans lancer la partie', () => {
    const b = createBoard(LEVELS.beginner);
    toggleFlag(b, 5);
    expect(b.status).toBe('ready');
  });
});

describe('victoire et défaite', () => {
  it('gagne quand toutes les cases sans mine sont dévoilées, et pose les drapeaux', () => {
    const b = fixed(3, 1, [0]);
    reveal(b, 1, seeded(1));
    expect(b.status).toBe('playing');
    reveal(b, 2, seeded(1));
    expect(b.status).toBe('won');
    expect(b.cells[0]!.flagged).toBe(true);
    expect(flagsLeft(b)).toBe(0);
  });

  it('perd en dévoilant une mine, révèle les mines et repère les faux drapeaux', () => {
    const b = fixed(4, 1, [0, 3]);
    toggleFlag(b, 1);
    reveal(b, 0, seeded(1));
    expect(b.status).toBe('lost');
    expect(b.exploded).toBe(0);
    expect(b.cells[3]!.revealed).toBe(true);
    expect(b.cells[1]!.flagged).toBe(true);
    expect(isWrongFlag(b, 1)).toBe(true);
    expect(isWrongFlag(b, 0)).toBe(false);
  });

  it('une mine bien marquée reste marquée à la défaite', () => {
    const b = fixed(4, 1, [0, 3]);
    toggleFlag(b, 3);
    reveal(b, 0, seeded(1));
    expect(b.cells[3]!.flagged).toBe(true);
    expect(b.cells[3]!.revealed).toBe(false);
  });

  it('plus aucune action après la fin', () => {
    const b = fixed(4, 1, [0, 3]);
    reveal(b, 0, seeded(1));
    expect(reveal(b, 1, seeded(1))).toEqual([]);
    expect(toggleFlag(b, 2)).toBe(false);
  });
});

describe('chord', () => {
  it('dévoile les voisins quand le nombre de drapeaux égale le chiffre', () => {
    // 3x3, mine au centre-haut… mine en 0 ; la case 4 vaut 1
    const b = fixed(3, 3, [0]);
    reveal(b, 4, seeded(1));
    toggleFlag(b, 0);
    const changed = chord(b, 4);
    expect(changed.length).toBeGreaterThan(0);
    expect(b.status).toBe('won');
  });

  it('ne fait rien si le compte de drapeaux est différent', () => {
    const b = fixed(3, 3, [0]);
    reveal(b, 4, seeded(1));
    expect(chord(b, 4)).toEqual([]);
    toggleFlag(b, 1);
    toggleFlag(b, 2);
    expect(chord(b, 4)).toEqual([]);
    expect(b.status).toBe('playing');
  });

  it('explose si un drapeau est mal placé', () => {
    const b = fixed(3, 3, [0]);
    reveal(b, 4, seeded(1));
    toggleFlag(b, 1);
    chord(b, 4);
    expect(b.status).toBe('lost');
  });

  it('ne fait rien sur une case fermée ou un zéro', () => {
    const b = fixed(4, 4, [0]);
    expect(chord(b, 5)).toEqual([]);
    reveal(b, 15, seeded(1));
    expect(chord(b, 15)).toEqual([]);
  });
});
