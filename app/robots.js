/**
 * robots.js — served at /robots.txt (Next.js metadata route).
 *
 * Everything public is crawlable; /api and /report (personal, reads the
 * visitor's own localStorage — nothing for a crawler) are excluded.
 */

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/report'],
      },
    ],
    sitemap: 'https://retiresimplified.com/sitemap.xml',
  };
}
