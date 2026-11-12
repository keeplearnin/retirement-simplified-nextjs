/**
 * analytics.js — Google Analytics 4, with the plan kept out of it.
 *
 * Off unless NEXT_PUBLIC_GA_ID is set at build time (so local dev and
 * preview builds send nothing). Also off when the browser sends Global
 * Privacy Control or the visitor opted out on /assistant-rules.
 *
 * What GA may receive: page paths, screen names, and a few event names with
 * short labels. What it must never receive: any plan figure — balances,
 * income, ages, spending, results. `sanitizeParams` enforces that by
 * allowing only short label strings and booleans; numbers are dropped.
 */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';
export const OPT_OUT_KEY = 'analytics-opt-out';

export function analyticsAllowed() {
  if (!GA_ID || typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem(OPT_OUT_KEY) === '1') return false;
  } catch {
    // Storage blocked: fall through to the GPC check.
  }
  if (window.navigator?.globalPrivacyControl === true) return false;
  return true;
}

export function setAnalyticsOptOut(optOut) {
  try {
    if (optOut) window.localStorage.setItem(OPT_OUT_KEY, '1');
    else window.localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // Storage blocked: the ga-disable flag below still stops this page view.
  }
  // GA honors this flag immediately, without a reload.
  if (GA_ID) window[`ga-disable-${GA_ID}`] = !!optOut;
}

// Labels only: lowercase words, digits stripped, capped length. Numbers
// are rejected outright so a dollar figure can't slip through as a param.
export function sanitizeParams(params = {}) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (!/^[a-z_]{1,40}$/.test(key)) continue;
    if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string') {
      const label = value.toLowerCase().replace(/[^a-z:_-]/g, '').replace(/[-_:]+$/, '').slice(0, 60);
      if (label) out[key] = label;
    }
  }
  return out;
}

// Idempotent: defines the gtag queue and config once. Calls queued before
// gtag.js finishes loading are replayed from dataLayer.
function ensureGtag() {
  if (!analyticsAllowed()) return false;
  if (typeof window.gtag === 'function') return true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  return true;
}

export function initAnalytics() {
  return ensureGtag();
}

/**
 * Page view with the query string and hash stripped. `path` may be a
 * virtual path for in-app screens (e.g. /app/plan), since Plan / Improve /
 * Ask are client state on "/" rather than routes.
 */
export function trackPageView(path, title) {
  if (!ensureGtag()) return;
  const clean = `/${String(path).replace(/[?#].*$/, '').replace(/^\/+/, '')}`;
  window.gtag('event', 'page_view', {
    page_location: `${window.location.origin}${clean}`,
    page_path: clean,
    page_title: title || document.title,
  });
}

export function trackEvent(name, params) {
  if (!/^[a-z_]{1,40}$/.test(name)) return;
  if (!ensureGtag()) return;
  window.gtag('event', name, sanitizeParams(params));
}
