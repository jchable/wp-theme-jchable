import { escapeHtml } from './text';

/** Nom du document affiché à l'ouverture. */
export const DEFAULT_FILE_NAME = 'lisez-moi.rtf';

/**
 * Document de départ : une note sur un article (si le titre et l'adresse sont transmis),
 * sinon la présentation du blog. Tout le texte est échappé.
 */
export function initialDocumentHtml(siteName: string, args: Readonly<Record<string, unknown>>): string {
  const { title, url } = args;
  if (typeof title === 'string' && typeof url === 'string' && title !== '' && url !== '') {
    return [
      `<h1>${escapeHtml(DEFAULT_FILE_NAME)}</h1>`,
      `<p>Note à propos de l'article : <b>${escapeHtml(title)}</b></p>`,
      `<p>Adresse : ${escapeHtml(url)}</p>`,
      '<p>Tapez ici…</p>',
    ].join('');
  }
  const site = escapeHtml(siteName);
  return [
    `<h1>Bienvenue sur ${site}</h1>`,
    `<p>Ceci est ${escapeHtml(DEFAULT_FILE_NAME)}, un petit éditeur de texte pour faire connaissance.</p>`,
    `<p>Vous pouvez écrire ici : mettez du texte en <b>gras</b>, en <i>italique</i> ou changez la police avec la barre d'outils.</p>`,
    '<p>Le bouton Enregistrer sous… télécharge votre texte sur votre ordinateur, en HTML ou en texte brut. Bonne visite !</p>',
  ].join('');
}
