/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache policy.
  //
  // Next.js marks statically-prerendered pages with `Cache-Control:
  // s-maxage=31536000` (one year). On Amplify/CloudFront that means the CDN
  // keeps serving OLD HTML — which references the OLD hashed JS chunks — for
  // up to a year after a deploy. A browser hard-refresh bypasses the browser
  // cache but NOT the CDN, so users get stuck on a stale bundle and never see
  // new fixes ("hard refresh didn't help").
  //
  // Fix: force the HTML documents to revalidate every load. The content-hashed
  // assets under /_next/static stay immutable (safe — their names change on
  // every build), so only the tiny HTML shell is re-fetched.
  async headers() {
    const revalidate = {
      key: 'Cache-Control',
      value: 'public, max-age=0, must-revalidate',
    };
    return [
      { source: '/', headers: [revalidate] },
      { source: '/verdict', headers: [revalidate] },
      { source: '/methodology', headers: [revalidate] },
      { source: '/report', headers: [revalidate] },
      { source: '/calculators/:slug*', headers: [revalidate] },
      // Note: /_next/static assets are content-hashed and already served
      // `immutable` by Next.js — no override needed (and overriding them
      // triggers a build warning).
    ];
  },
};

export default nextConfig;
