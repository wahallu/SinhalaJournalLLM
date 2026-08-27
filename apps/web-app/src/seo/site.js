export const SITE_URL = 'https://chat.sin-ai.app';
export const SITE_NAME = 'SinAi';
export const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

const tools = [
  {
    title: 'Sinhala grammar checking',
    description: 'Review spelling, grammar, punctuation, and agreement while keeping the original sentence meaning in focus.',
    href: '/sinhala-grammar-checker',
  },
  {
    title: 'Sinhala headline generation',
    description: 'Turn a complete news article into several concise headline candidates for an editor to review.',
    href: '/sinhala-headline-generator',
  },
  {
    title: 'Sinhala news summarization',
    description: 'Condense long Sinhala news copy into a shorter version for briefings, previews, and editorial review.',
    href: '/sinhala-news-summarizer',
  },
  {
    title: 'Sinhala style rewriting',
    description: 'Adapt copy for formal, editorial, sports, or youth-oriented writing without changing the core topic.',
    href: '/sinhala-style-rewriter',
  },
];

export const SEO_PAGES = {
  '/': {
    path: '/',
    title: 'SinAi — Free Sinhala AI Writing Assistant',
    description: 'Use Sinhala AI tools for grammar checking, news headlines, article rewriting, and summarization. Try SinAi free in your browser.',
    eyebrow: 'සිංහල ලේඛන සහායකයා',
    heading: 'Sinhala AI for news and everyday writing',
    intro: 'SinAi brings four focused Sinhala writing tools into one browser workspace. Check grammar, generate news headlines, rewrite an article, or create a concise summary.',
    ctaLabel: 'Open the SinAi workspace',
    ctaHref: '/dashboard',
    items: tools,
    faqs: [
      {
        question: 'What can SinAi do?',
        answer: 'SinAi provides Sinhala grammar checking, headline generation, style rewriting, and news summarization in one web application.',
      },
      {
        question: 'Can I try the Sinhala AI tools without an account?',
        answer: 'Yes. All four writing tools can be tried without an account. Signing in is only needed to save work to your history.',
      },
      {
        question: 'Who is SinAi designed for?',
        answer: 'SinAi is designed for Sinhala journalists, editors, students, content writers, and anyone who needs help reviewing Sinhala text.',
      },
    ],
  },
  '/sinhala-ai': {
    path: '/sinhala-ai',
    title: 'Sinhala AI Writing Assistant for News and Content | SinAi',
    description: 'A free Sinhala AI workspace for grammar correction, news headline generation, style rewriting, and article summarization.',
    eyebrow: 'Sinhala AI writing workspace',
    heading: 'One Sinhala AI workspace for four writing tasks',
    intro: 'Choose the task you need instead of using one generic prompt. SinAi provides dedicated workflows for grammar, headlines, rewriting, and summaries.',
    ctaLabel: 'Try Sinhala AI',
    ctaHref: '/dashboard',
    items: tools,
    faqs: [
      {
        question: 'What is Sinhala AI?',
        answer: 'Sinhala AI refers to artificial intelligence tools that can process and generate text written in Sinhala. SinAi applies this to practical writing and newsroom tasks.',
      },
      {
        question: 'Which Sinhala writing tasks are available?',
        answer: 'The workspace includes grammar checking, headline generation, style rewriting, and news summarization.',
      },
      {
        question: 'Does SinAi replace an editor?',
        answer: 'No. SinAi produces suggestions and drafts for human review. Names, facts, quotations, and publication-sensitive wording should always be verified before publishing.',
      },
    ],
  },
  '/sinhala-grammar-checker': {
    path: '/sinhala-grammar-checker',
    title: 'Free Sinhala Grammar Checker Online | SinAi',
    description: 'Check Sinhala spelling, grammar, punctuation, and agreement online. Review contextual corrections while preserving sentence meaning.',
    eyebrow: 'සිංහල ව්‍යාකරණ පරීක්ෂකය',
    heading: 'Check Sinhala grammar in context',
    intro: 'Paste a Sinhala sentence or paragraph to review grammar, spelling, punctuation, and agreement. The checker is designed to consider the surrounding sentence rather than treating every word in isolation.',
    ctaLabel: 'Check Sinhala grammar',
    ctaHref: '/grammar',
    items: [
      {
        title: 'Context-aware review',
        description: 'Corrections are evaluated in the sentence or paragraph where the words appear.',
      },
      {
        title: 'Meaning first',
        description: 'The goal is to correct language issues without needlessly rewriting the intended message.',
      },
      {
        title: 'Visible suggestions',
        description: 'Review the corrected result and the reported changes before using the text.',
      },
    ],
    faqs: [
      {
        question: 'What does the Sinhala grammar checker review?',
        answer: 'It reviews spelling, grammar, punctuation, and agreement issues in the submitted Sinhala text.',
      },
      {
        question: 'Can I check a full Sinhala paragraph?',
        answer: 'Yes. You can paste a sentence or paragraph into the editor and review the corrected output.',
      },
      {
        question: 'Should I verify the correction before publishing?',
        answer: 'Yes. AI suggestions can be imperfect, especially for names, quotations, and specialist terms, so a human should review the final text.',
      },
    ],
  },
  '/sinhala-headline-generator': {
    path: '/sinhala-headline-generator',
    title: 'Sinhala News Headline Generator | SinAi',
    description: 'Generate several Sinhala news headline candidates from a complete article, with short, medium, and long length options.',
    eyebrow: 'සිංහල පුවත් ශීර්ෂ පාඨ',
    heading: 'Generate Sinhala headlines from a news article',
    intro: 'Paste the full article, choose a headline length and news category, then compare multiple candidates. The article gives the generator the context it needs to keep the headline connected to the story.',
    ctaLabel: 'Generate Sinhala headlines',
    ctaHref: '/headlines',
    items: [
      {
        title: 'Multiple candidates',
        description: 'Compare several headline options instead of accepting the first suggestion.',
      },
      {
        title: 'Length controls',
        description: 'Choose short, medium, or long output to match different editorial layouts.',
      },
      {
        title: 'Article context',
        description: 'Headlines are generated from the article you provide, not from a topic keyword alone.',
      },
    ],
    faqs: [
      {
        question: 'How do I generate a Sinhala news headline?',
        answer: 'Paste the complete article, choose the category and preferred length, then generate and compare the headline candidates.',
      },
      {
        question: 'Can I choose the headline length?',
        answer: 'Yes. The tool provides short, medium, and long length options.',
      },
      {
        question: 'Does the tool verify news facts?',
        answer: 'No. It generates wording from the supplied article. The editor remains responsible for checking facts, names, quotations, and editorial accuracy.',
      },
    ],
  },
  '/sinhala-news-summarizer': {
    path: '/sinhala-news-summarizer',
    title: 'Sinhala News Summarizer Online | SinAi',
    description: 'Summarize long Sinhala news articles into concise text with selectable output lengths. Try the SinAi news summarizer online.',
    eyebrow: 'සිංහල පුවත් සාරාංශකරණය',
    heading: 'Summarize Sinhala news articles',
    intro: 'Turn long-form Sinhala news copy into a shorter summary for a briefing, preview, or editorial starting point. Select the output length and compare the summary with the source before using it.',
    ctaLabel: 'Summarize a Sinhala article',
    ctaHref: '/summarizer',
    items: [
      {
        title: 'Three output lengths',
        description: 'Choose a short, medium, or long summary for the space available.',
      },
      {
        title: 'News-focused workflow',
        description: 'The editor accepts complete articles and returns a concise version of the supplied copy.',
      },
      {
        title: 'Easy comparison',
        description: 'Keep the source beside the result so important details can be checked before publication.',
      },
    ],
    faqs: [
      {
        question: 'What text can the Sinhala summarizer process?',
        answer: 'It is intended for Sinhala articles and long-form news copy pasted into the browser editor.',
      },
      {
        question: 'Can I control how short the summary is?',
        answer: 'Yes. You can choose short, medium, or long output settings.',
      },
      {
        question: 'Can a summary omit an important detail?',
        answer: 'Yes. Any automatic summary can miss context, so compare the output with the original article before publishing it.',
      },
    ],
  },
  '/sinhala-style-rewriter': {
    path: '/sinhala-style-rewriter',
    title: 'Sinhala Article Rewriter and Tone Changer | SinAi',
    description: 'Rewrite Sinhala articles for formal, editorial, sports, or youth-oriented styles while retaining the core subject and meaning.',
    eyebrow: 'සිංහල ලිපි නැවත ලිවීම',
    heading: 'Rewrite Sinhala copy for a different editorial style',
    intro: 'Adapt an existing Sinhala article for a different desk or audience. Choose a style, review the rewritten version, and verify that facts, quotations, and the intended meaning remain correct.',
    ctaLabel: 'Rewrite Sinhala text',
    ctaHref: '/rewriter',
    items: [
      {
        title: 'Editorial style choices',
        description: 'Move between formal, editorial, sports, and youth-oriented writing modes.',
      },
      {
        title: 'Source-led rewriting',
        description: 'The rewritten version starts from the Sinhala copy you provide.',
      },
      {
        title: 'Human review built in',
        description: 'Compare the new version with the source before applying or publishing it.',
      },
    ],
    faqs: [
      {
        question: 'What does a Sinhala article rewriter do?',
        answer: 'It produces a new version of supplied Sinhala text in a selected writing style while keeping the source topic in focus.',
      },
      {
        question: 'Which writing styles are available?',
        answer: 'The workspace supports formal, editorial, sports, and youth-oriented style choices.',
      },
      {
        question: 'Should rewritten news copy be edited by a person?',
        answer: 'Yes. A journalist or editor should verify every fact, name, quotation, and tone choice before publication.',
      },
    ],
  },
};

export const INDEXABLE_ROUTES = Object.keys(SEO_PAGES);

export const APP_META = {
  '/dashboard': {
    title: 'SinAi Workspace — Sinhala AI Writing Tools',
    description: SEO_PAGES['/'].description,
    canonicalPath: '/',
    indexable: false,
  },
  '/grammar': {
    title: 'Sinhala Grammar Checker Workspace | SinAi',
    description: SEO_PAGES['/sinhala-grammar-checker'].description,
    canonicalPath: '/sinhala-grammar-checker',
    indexable: false,
  },
  '/headlines': {
    title: 'Sinhala Headline Generator Workspace | SinAi',
    description: SEO_PAGES['/sinhala-headline-generator'].description,
    canonicalPath: '/sinhala-headline-generator',
    indexable: false,
  },
  '/rewriter': {
    title: 'Sinhala Style Rewriter Workspace | SinAi',
    description: SEO_PAGES['/sinhala-style-rewriter'].description,
    canonicalPath: '/sinhala-style-rewriter',
    indexable: false,
  },
  '/summarizer': {
    title: 'Sinhala News Summarizer Workspace | SinAi',
    description: SEO_PAGES['/sinhala-news-summarizer'].description,
    canonicalPath: '/sinhala-news-summarizer',
    indexable: false,
  },
  '/optimize': {
    title: 'Optimize a Sinhala News Article | SinAi',
    description: 'Correct, rewrite, generate headlines, and summarize a Sinhala news article in one guided workspace.',
    canonicalPath: '/',
    indexable: false,
  },
};

export const PRIVATE_PATH_PREFIXES = [
  '/admin',
  '/history',
  '/settings',
  '/profile',
  '/plans',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

export function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString();
}

export function getPageMeta(pathname) {
  const publicPage = SEO_PAGES[pathname];
  if (publicPage) return { ...publicPage, canonicalPath: publicPage.path, indexable: true };

  const appPage = APP_META[pathname];
  if (appPage) return appPage;

  const privatePage = PRIVATE_PATH_PREFIXES.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));

  return {
    title: privatePage ? `Private workspace | ${SITE_NAME}` : `Page not found | ${SITE_NAME}`,
    description: 'SinAi private workspace.',
    canonicalPath: pathname,
    indexable: false,
  };
}

export function buildStructuredData(page) {
  const canonical = absoluteUrl(page.path);
  const graph = [
    {
      '@type': 'Organization',
      '@id': 'https://sin-ai.app/#organization',
      name: 'SinAi Research & Engineering Group',
      url: 'https://sin-ai.app/',
      logo: `${SITE_URL}/logo.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: SEO_PAGES['/'].description,
      inLanguage: ['si', 'en'],
      publisher: { '@id': 'https://sin-ai.app/#organization' },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#application`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Web',
      description: SEO_PAGES['/'].description,
      inLanguage: ['si', 'en'],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      creator: { '@id': 'https://sin-ai.app/#organization' },
    },
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: page.title,
      description: page.description,
      inLanguage: ['si', 'en'],
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#application` },
    },
  ];

  if (page.path !== '/') {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'SinAi',
          item: `${SITE_URL}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: page.heading,
          item: canonical,
        },
      ],
    });
  }

  if (page.faqs?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: page.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
