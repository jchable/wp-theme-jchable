import { t } from './i18n';
import { escapeHtml } from './text';

/** Nom du document affiché à l'ouverture (dans la langue courante). */
export const defaultFileName = (): string => t('defaultFileName');

/**
 * Document de départ : une note sur un article (si le titre et l'adresse sont transmis),
 * sinon la présentation du blog. Tout le texte est échappé.
 */
export function initialDocumentHtml(siteName: string, args: Readonly<Record<string, unknown>>): string {
  const { title, url } = args;
  if (typeof title === 'string' && typeof url === 'string' && title !== '' && url !== '') {
    return [
      `<h1>${escapeHtml(defaultFileName())}</h1>`,
      `<p>${t('noteTitle', { title: escapeHtml(title) })}</p>`,
      `<p>${t('noteAddress', { url: escapeHtml(url) })}</p>`,
      `<p>${t('noteTypeHere')}</p>`,
    ].join('');
  }
  const site = escapeHtml(siteName);
  return [
    `<h1>${t('welcomeTitle', { site })}</h1>`,
    `<p>${t('welcomeIntro', { file: escapeHtml(defaultFileName()) })}</p>`,
    `<p>${t('welcomeHowTo')}</p>`,
    `<p>${t('welcomeSave')}</p>`,
  ].join('');
}
