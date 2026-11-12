'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { GA_ID, initAnalytics, trackPageView } from '@/lib/analytics';

/**
 * Loads gtag.js only when analytics is allowed (see lib/analytics.js) and
 * sends a page view per real route. The home route "/" is skipped here: the
 * app on "/" reports its own screens (Plan / Improve / Ask / tools).
 */
export default function Analytics() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(initAnalytics());
  }, []);

  useEffect(() => {
    if (!enabled || !pathname || pathname === '/') return;
    trackPageView(pathname);
  }, [enabled, pathname]);

  if (!enabled) return null;
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />;
}
