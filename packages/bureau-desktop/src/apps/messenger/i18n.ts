import { makeT } from '../../core/i18n';

export const messages = {
  fr: {
    online: 'En ligne',
    connecting: 'Connexion…',
    empty: 'Aucun message pour le moment. Soyez le premier à commenter !',
    retry: 'Réessayer',
    unreachable: 'Impossible de joindre le serveur.',
    newBadge: 'nouveau',
    reply: 'Répondre',
    replyTo: 'Répondre à {author}',
    conversation: 'Conversation',
    anonymous: 'Anonyme',
    justNow: 'à l’instant',
    minutesAgo: 'il y a {n} min',
    hoursAgo: 'il y a {n} h',
    yesterday: 'hier',
  },
  en: {
    online: 'Online',
    connecting: 'Connecting…',
    empty: 'No messages yet. Be the first to comment!',
    retry: 'Try again',
    unreachable: 'Could not reach the server.',
    newBadge: 'new',
    reply: 'Reply',
    replyTo: 'Reply to {author}',
    conversation: 'Conversation',
    anonymous: 'Anonymous',
    justNow: 'just now',
    minutesAgo: '{n} min ago',
    hoursAgo: '{n} h ago',
    yesterday: 'yesterday',
  },
};

export const t = makeT(messages);
