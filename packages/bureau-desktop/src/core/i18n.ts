/**
 * Traduction de l'interface du bureau (français / anglais), sans plugin.
 * Chaque module déclare ses messages dans les deux langues ; TypeScript impose les mêmes clés.
 */

export type Lang = 'fr' | 'en';
export type LangPref = 'auto' | Lang;

let current: Lang = 'fr';

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
}

/** Français si la première langue du navigateur est le français (ou s'il n'en dit rien), anglais sinon. */
export function detectLang(languages: readonly string[]): Lang {
  const first = languages[0];
  if (!first) return 'fr';
  return first.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/** Le choix explicite du visiteur l'emporte ; « auto » (ou une valeur inconnue) suit le navigateur. */
export function resolveLang(pref: string, languages: readonly string[]): Lang {
  return pref === 'fr' || pref === 'en' ? pref : detectLang(languages);
}

export interface Messages<K extends string> {
  fr: Record<K, string>;
  en: Record<K, string>;
}

export type Params = Readonly<Record<string, string | number>>;

/**
 * Crée la fonction `t(clé, paramètres)` d'un module. Une traduction vide retombe sur le français,
 * puis sur la clé elle-même. `{nom}` est remplacé par le paramètre correspondant.
 */
export function makeT<K extends string>(messages: Messages<K>): (key: K, params?: Params) => string {
  return (key, params) => {
    const text = messages[current][key] || messages.fr[key] || key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
  };
}

/** Pour les tests : clés absentes ou vides, sous la forme « langue.clé ». */
export function missingKeys(messages: { fr: Record<string, string>; en: Record<string, string> }): string[] {
  const keys = new Set([...Object.keys(messages.fr), ...Object.keys(messages.en)]);
  const missing: string[] = [];
  for (const lang of ['fr', 'en'] as const) {
    for (const key of keys) if (!messages[lang][key]) missing.push(`${lang}.${key}`);
  }
  return missing;
}
