import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeParams } from '@/lib/analytics';
import { pageMeta, SITE_URL } from '@/lib/seo';
import sitemap from '@/app/sitemap';

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('analytics never receives plan figures', () => {
  it('drops numeric params outright', () => {
    expect(sanitizeParams({ balance: 1250000, age: 62, move: 'roth-ladder' })).toEqual({ move: 'roth-ladder' });
  });

  it('strips digits that ride inside a label', () => {
    expect(sanitizeParams({ move: 'retire-later-3' })).toEqual({ move: 'retire-later' });
    expect(sanitizeParams({ label: '$1,250,000' })).toEqual({});
  });

  it('keeps booleans and rejects malformed keys', () => {
    expect(sanitizeParams({ skipped: true, 'Bad-Key': 'x', ['a'.repeat(41)]: 'y' })).toEqual({ skipped: true });
  });

  it('caps label length', () => {
    expect(sanitizeParams({ move: 'a'.repeat(200) }).move).toHaveLength(60);
  });
});

describe('page metadata', () => {
  it('builds a self-referencing canonical and matching og:url', () => {
    const m = pageMeta({ title: 'T', description: 'D', path: '/accuracy' });
    expect(m.alternates.canonical).toBe('/accuracy');
    expect(m.openGraph.url).toBe(`${SITE_URL}/accuracy`);
    expect(m.openGraph.siteName).toBeTruthy();
    expect(m.robots).toBeUndefined();
  });

  it('home canonical is the bare origin', () => {
    expect(pageMeta({ title: 'T', description: 'D', path: '/' }).openGraph.url).toBe(SITE_URL);
  });

  it('noindex pages say so', () => {
    expect(pageMeta({ title: 'T', description: 'D', path: '/report', noindex: true }).robots).toEqual({ index: false, follow: true });
  });

  // Next.js merges metadata shallowly: a canonical or openGraph in the root
  // layout is inherited by any page that omits its own, pointing every such
  // page's canonical at the home page.
  it('root layout sets no canonical or openGraph', () => {
    const layout = read('app/layout.js');
    expect(layout).not.toMatch(/\bcanonical\s*:/);
    expect(layout).not.toMatch(/\bopenGraph\s*:/);
  });

  it('every sitemap URL declares its own canonical via pageMeta', () => {
    for (const { url } of sitemap()) {
      const route = url.replace(SITE_URL, '') || '/';
      const dir = path.join('app', route);
      const files = ['page.js', 'layout.js'].map((f) => path.join(dir, f)).filter((f) => fs.existsSync(path.join(root, f)));
      const src = files.map(read).join('\n');
      expect(src, route).toMatch(/pageMeta\(/);
      expect(src, route).toContain(`path: '${route}'`);
    }
  });
});
