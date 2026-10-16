import { makeT } from '../../core/i18n';

export const messages = {
  fr: {
    title: 'Invite de commandes',
    outputLabel: 'Sortie du terminal',
    inputLabel: 'Commande',
    internalError: 'Une erreur interne est survenue.',
    networkError: 'Impossible de joindre le serveur.',
    welcomeVersion: '{site} [version 1.0]',
    welcomeHint: 'Tapez help pour la liste des commandes.',
    helpTitle: 'Commandes disponibles :',
    helpHelp: '  help          cette liste',
    helpLs: '  ls            les 10 derniers articles',
    helpCat: '  cat <slug>    ouvre un article',
    helpCd: '  cd archives   le plan du site',
    helpWhoami: '  whoami        qui êtes-vous ?',
    helpDate: "  date          la date et l'heure",
    helpClear: "  clear         efface l'écran",
    helpDoom: '  doom          lance DOOM',
    helpWordpad: '  wordpad       ouvre le WordPad',
    helpExit: '  exit          ferme le terminal',
    emptyDir: 'Le répertoire est vide.',
    catSyntax: 'Syntaxe : cat <article>',
    fileNotFound: 'Fichier introuvable : {name}',
    pathNotFound: "Le chemin d'accès spécifié est introuvable.",
    whoami: 'visiteur@{host}',
    unknownCommand: "'{name}' n'est pas reconnu en tant que commande interne ou externe. Tapez help.",
    gagSudoLine: "Suppression de / en cours... Vous n'avez pas les droits, mais Windows s'en moque.",
    gagSudoBsod:
      "Vous avez essayé sudo sur un système qui ne connaît pas sudo. Le système a préféré s'arrêter pour réfléchir à ses choix.",
    gagRmLine: 'Suppression de tous les fichiers... 1%... 2%... Oh non.',
    gagRmBsod:
      "Tous vos fichiers ont été supprimés. Même ceux de vos voisins. Veuillez redémarrer et faire comme si de rien n'était.",
    gagFormatLine: 'ATTENTION : toutes les données du lecteur C: seront perdues. Formatage...',
    gagFormatBsod:
      'Le lecteur C: a été formaté. Le blog va très bien, merci. Appuyez sur une touche pour faire semblant de continuer.',
  },
  en: {
    title: 'Command Prompt',
    outputLabel: 'Terminal output',
    inputLabel: 'Command',
    internalError: 'An internal error occurred.',
    networkError: 'Unable to reach the server.',
    welcomeVersion: '{site} [Version 1.0]',
    welcomeHint: 'Type help for the list of commands.',
    helpTitle: 'Available commands:',
    helpHelp: '  help          this list',
    helpLs: '  ls            the 10 latest posts',
    helpCat: '  cat <slug>    open a post',
    helpCd: '  cd archives   the site map',
    helpWhoami: '  whoami        who are you?',
    helpDate: '  date          the date and time',
    helpClear: '  clear         clear the screen',
    helpDoom: '  doom          launch DOOM',
    helpWordpad: '  wordpad       open WordPad',
    helpExit: '  exit          close the terminal',
    emptyDir: 'The directory is empty.',
    catSyntax: 'Usage: cat <post>',
    fileNotFound: 'File not found: {name}',
    pathNotFound: 'The system cannot find the path specified.',
    whoami: 'visitor@{host}',
    unknownCommand: "'{name}' is not recognized as an internal or external command, operable program or batch file. Type help.",
    gagSudoLine: "Deleting / ... You don't have the rights, but Windows doesn't care.",
    gagSudoBsod:
      "You tried sudo on a system that has never heard of sudo. The system decided to stop and reflect on its life choices.",
    gagRmLine: 'Deleting all files... 1%... 2%... Oh no.',
    gagRmBsod:
      "All your files have been deleted. Even your neighbours'. Please restart and act like nothing happened.",
    gagFormatLine: 'WARNING: all data on drive C: will be lost. Formatting...',
    gagFormatBsod:
      'Drive C: has been formatted. The blog is doing just fine, thanks. Press any key to pretend to continue.',
  },
};

export const t = makeT(messages);
export type MessageKey = keyof typeof messages.fr;
