/**
 * seo.js — one place for page metadata and structured data.
 *
 * Every page builds its metadata with `pageMeta` so it always carries its
 * OWN canonical URL and a complete openGraph block. Next.js merges metadata
 * shallowly: a canonical set in the root layout would be inherited by every
 * page that forgot to set one (all pointing at the home page), and a page's
 * partial openGraph would wipe the parent's siteName/url. Hence no
 * canonical or openGraph in app/layout.js.
 */

export const SITE_URL = 'https://retiresimplified.com';
export const SITE_NAME = 'Retire Simplified';

// app/opengraph-image.js. Listed explicitly because a page's own openGraph
// block replaces the root's, dropping the file-based image with it.
const SHARE_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'Retire Simplified — know what you can spend in retirement, not just whether it lasts',
};

export function pageMeta({ title, description, path, ogTitle, ogDescription, noindex = false }) {
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url,
      title: ogTitle || title,
      description: ogDescription || description,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle || title,
      description: ogDescription || description,
      images: [SHARE_IMAGE],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** schema.org WebApplication. Free, no ratings: never invent reviews. */
export function webAppJsonLd({ name, description, path }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: path === '/' ? SITE_URL : `${SITE_URL}${path}`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any (web browser)',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  };
}
