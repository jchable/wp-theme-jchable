// Adresses et titres créés par tools/env/seed.php.
export const POSTS = {
  latest: {
    path: '/a-folder-of-markdown-you-can-actually-browse/',
    title: 'A folder of markdown you can actually browse: OKF4net 0.7 and the interactive okf-render',
  },
  release: {
    path: '/okf4net-0-6-0/',
    title: 'OKF4net 0.6.0: two months, 642 commits, and a test suite bigger than the code',
  },
  closed: {
    path: '/okf4net-agent-memory-you-can-git-blame/',
    title: 'OKF4net agent memory you can git blame',
  },
  long: { path: '/titre-tres-long/' },
  code: { path: '/bloc-de-code/' },
  filler: { path: '/billet-de-test-1/' },
} as const;

export const PAGES = {
  about: '/a-propos/',
  sitemap: '/plan-du-site/',
  classic: '/contenu-classique/',
} as const;

export const ARCHIVES = {
  category: '/category/divers/',
  month: '/2026/10/',
  search: '/?s=okf4net',
  searchEmpty: '/?s=zzzaucunresultat',
  notFound: '/cette-page-nexiste-pas/',
} as const;

export const TOTAL_POSTS = 13;
