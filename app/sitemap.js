/**
 * sitemap.js — served at /sitemap.xml (Next.js metadata route).
 *
 * Lists every public, indexable page. The calculators are the SEO entry
 * points; keep this in sync when adding new standalone pages.
 * Submitted to Google Search Console.
 */

const BASE = 'https://retiresimplified.com';

export default function sitemap() {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/verdict`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/methodology`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/calculators/irmaa-cliff-checker`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/calculators/tax-torpedo`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/calculators/social-security-break-even`, changeFrequency: 'monthly', priority: 0.9 },
  ];
}
