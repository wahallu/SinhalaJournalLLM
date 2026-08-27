import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_IMAGE,
  SITE_NAME,
  absoluteUrl,
  buildStructuredData,
  getPageMeta,
} from './site';

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

export function usePageSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = getPageMeta(pathname);
    const canonical = absoluteUrl(page.canonicalPath);
    const robots = page.indexable
      ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      : 'noindex, follow';

    document.title = page.title;
    document.documentElement.lang = 'en';

    upsertMeta('meta[name="description"]', { name: 'description', content: page.description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[name="googlebot"]', { name: 'googlebot', content: robots });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: page.title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: page.description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'si_LK' });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: DEFAULT_IMAGE });
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: 'SinAi Sinhala writing assistant logo' });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: page.title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: page.description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: DEFAULT_IMAGE });

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;

    const existingSchema = document.head.querySelector('#sinai-structured-data');
    if (page.indexable && page.path) {
      const schema = existingSchema || document.createElement('script');
      schema.id = 'sinai-structured-data';
      schema.type = 'application/ld+json';
      schema.textContent = JSON.stringify(buildStructuredData(page)).replace(/</g, '\\u003c');
      if (!existingSchema) document.head.appendChild(schema);
    } else {
      existingSchema?.remove();
    }
  }, [pathname]);
}
